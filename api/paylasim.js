import { kv } from "@vercel/kv";
import { planSubesi, subeStokAnahtari, planlananlarTamamlandiMi, enAzBirSubedePaylasildi,
         markaninSubeleri } from "../lib/sube-kullanimi.js";
import { SUBE_PAYLASIM_ASAMASI } from "../lib/asamalar.js";
import { ucretleriTazele, ayAnahtari, ucretDagilimi } from "../lib/marka-ucreti.js";
import { KEY, guvenliYaz, kilitAl, kilitBirak, bugunISO, mesgulYanit } from "../lib/kv-yaz.js";
import { kayitliYanit, yanitiSakla, yanitiYakala } from "../lib/islem-kimligi.js";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { markaErisimiVarMi } from "../lib/marka-kilidi.js";
import { onaylananiTasi, kartKlasorunuTasi, driveDosyaIdCikar, markaninDriveDosyalari, DURUM_KLASORLERI } from "../lib/drive-tasima.js";
import { tasinacakDosyalar, kartKlasorAdi } from "../lib/asamalar.js";
import { onaylananlaraGoreStok, paylasimTuru, PAYLASIM_TURLERI, eskiTurAnahtarlari, stoklariBirlestir } from "../lib/stok.js";
import { kartlaraGoreStok } from "../lib/stok-mutabakat.js";
import { driveDurumRaporu, driveyeGoreStok, kartinDosyaKimlikleri, ASAMA_DURUMU } from "../lib/drive-eslestirme.js";
import { stokFarklari, uygulanabilirMi, farklariUygula } from "../lib/drive-denetimi.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";

const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stokAnahtari = (clientId, tur) => `${clientId}_${tur}`;
const bugunTR = () => new Date().toLocaleDateString("tr-TR");
/** Sunucu (Vercel) UTC saat diliminde çalışır — bu, gece yarısı ile saat 03:00 arası
 * (Türkiye UTC+3) "bugün"ün bir gün geriden hesaplanmasına yol açıyordu (Günlük Kontrol
 * geç sıfırlanıyordu). Artık her zaman Türkiye'nin takvim gününü baz alır. */
/** Owner her zaman yetkili. Personel ise "paylasimlar" iznine sahipse yetkilidir. */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  // { yetkili, markalar } döner. markalar boş dizi = kilit yok (tüm markalar).
  if (await ownerYetkiliMi(req)) return { yetkili: true, markalar: [] };
  if (!ownerPw && !staffPwLegacy && !baslikOku(req, "x-staff-username")) return { yetkili: true, markalar: [] };
  if (staffPwLegacy && provided === staffPwLegacy) return { yetkili: true, markalar: [] };

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const crypto = await import("crypto");
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        if (perms.paylasimlar === true || perms.uyelikler === true) {
          // Marka kilidi SUNUCUDAKİ hesap kaydından okunur.
          return { yetkili: true, markalar: Array.isArray(hesap.markalar) ? hesap.markalar : [] };
        }
      }
    }
  }
  return { yetkili: false, markalar: [] };
}

const trKucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/* PAYLAŞIMA HAZIR KART = müşterinin onayladığı, henüz teslim edilmemiş Operasyon kartı.
 * Paylaşım planına yalnızca bunlar bağlanabilir; "hazır değil" bir işi paylaşılmış saymak
 * en baştan önlemek istediğimiz karışıklığın ta kendisi. */
const PAYLASIMA_HAZIR = "Onaylandı";
const PAYLASILDI_ASAMASI = "Teslim Edildi";

/** Plana bağlanacak kartı bulur ve markasının doğru olduğunu doğrular. */
function bagliKartiCoz(data, isId, clientId) {
  const is = (data.cekimIsleri || []).find((j) => String(j.id) === String(isId));
  if (!is) return { hata: "Bağlanacak kart bulunamadı — sayfayı yenileyip tekrar dene." };
  const marka = (data.clients || []).find((c) => c.id === clientId);
  if (!marka) return { hata: "Marka bulunamadı." };
  /* Kartın markası ile planın markası tutmalı. Tutmazsa bir markanın içeriği başka bir
   * markanın planında paylaşılmış görünür — hem yanlış hem de Drive'da yanlış klasöre
   * dosya taşır. */
  if (trKucult(is.marka) !== trKucult(marka.ad)) {
    return { hata: "Bu kart başka bir markaya ait." };
  }
  return { is };
}

/**
 * Bağlı kartın aşamasını paylaşım durumuna göre değiştirir.
 *
 * Paylaşıldı  -> "Teslim Edildi"  (Drive'da 3 PAYLAŞILDI klasörüne taşınır)
 * Geri alındı -> "Onaylandı"      (dosya da geri gelir — taşıma iki yönlü)
 *
 * Aşama değişimini BURADA yapıyoruz ki marka yöneticisi Operasyon panosuna hiç girmesin:
 * paylaşımı işaretlemek tek hareket olsun. Kartın geçmişine kimin ne zaman paylaştığı
 * yazılıyor, sonradan "bu ne zaman yayına çıktı" sorusunun cevabı kartın üstünde duruyor.
 */
/**
 * Bağlı kartın yeni aşamasını hesaplar.
 *
 * ÇOK ŞUBELİ MARKA: kart, ilk şube paylaştığında "Şubelerde Paylaşılıyor"a geçer —
 * Operasyon panosunda GÖRÜNÜR kalır ki bekleyen şubeler unutulmasın — ve stok orada
 * düşer (stok motoru "Onaylandı"dan çıkışa bakıyor). Planlanan TÜM şubeler bitince
 * "Teslim Edildi"ye geçer; Drive'a taşıma da o an olur.
 *
 * ŞUBESİZ / MARKA GENELİ: doğrudan "Teslim Edildi". Bugünkü davranış birebir aynı.
 */
function kartinYeniAsamasi(planlar, isId) {
  if (!enAzBirSubedePaylasildi(isId, planlar)) return PAYLASIMA_HAZIR;
  const subeliPlanVar = (planlar || []).some((p) =>
    p && String(p.isId) === String(isId) && planSubesi(p) !== null);
  if (!subeliPlanVar) return PAYLASILDI_ASAMASI;
  return planlananlarTamamlandiMi(isId, planlar) ? PAYLASILDI_ASAMASI : SUBE_PAYLASIM_ASAMASI;
}

function bagliKartiIsaretle(data, isId, _paylasildi, kim) {
  const zaman = new Date().toLocaleString("tr-TR");
  let etkilenen = null;
  const yeniAsama = kartinYeniAsamasi(data.haftalikPaylasimlar, isId);
  data.cekimIsleri = (data.cekimIsleri || []).map((j) => {
    if (String(j.id) !== String(isId)) return j;
    const paylasildi = yeniAsama !== PAYLASIMA_HAZIR;
    if (j.asama === yeniAsama) { etkilenen = j; return j; }
    const guncel = {
      ...j,
      asama: yeniAsama,
      teslimEdilmeTarihi: yeniAsama === PAYLASILDI_ASAMASI ? bugunISO() : null,
      gecmis: [...(j.gecmis || []), {
        id: (j.gecmis || []).length + 1, tarih: zaman, yazan: kim,
        aciklama: yeniAsama === SUBE_PAYLASIM_ASAMASI
          ? "Bir şubede paylaşıldı; diğer planlanan şubeler bekliyor."
          : paylasildi
            ? "Paylaşım panelinden PAYLAŞILDI olarak işaretlendi."
            : "Paylaşım işareti geri alındı; kart tekrar onaylı içeriklere döndü.",
      }],
    };
    etkilenen = guncel;
    return guncel;
  });
  return etkilenen;
}

/**
 * Bağlı kartın dosyasını yeni aşamasının klasörüne taşır.
 *
 * KİLİT UYARISI: bu fonksiyon YAZMA KİLİDİ BIRAKILDIKTAN SONRA çağrılmalı. Google çağrıları
 * saniyeler sürebiliyor; kilidi elde tutarak beklemek, o sırada paylaşım işaretlemeye çalışan
 * herkesi bekletir. Hata fırlatmaz — taşıma başarısız olsa da paylaşım kaydı geçerli kalır.
 */
async function bagliKartinDosyasiniTasi(data, is) {
  if (!is) return null;
  const marka = (data.clients || []).find((c) => trKucult(c.ad) === trKucult(is.marka)) || {};
  const markaKlasoru = marka.driveOnayKlasoru || "";
  if (!markaKlasoru && !process.env.DRIVE_ONAY_KLASOR_ID) return null;   // Drive kurulu değil
  /* KARTIN TÜM DOSYALARI — karosel gönderide 8 slayt ve bir story boyutu aynı kartta.
   * Tek bağlantı taşımak, kalan slaytları eski klasörde bırakırdı. */
  const dosyalar = tasinacakDosyalar(is);
  if (dosyalar.length === 0) return { tasindi: false, sebep: "kartta dosya bağlantısı yok" };
  const hedefAd = is.asama === PAYLASILDI_ASAMASI ? DURUM_KLASORLERI.paylasilan : DURUM_KLASORLERI.onaylanan;
  const kartKlasoru = kartKlasorAdi(is);
  try {
    const sonuclar = [];

    /* ÖNCE KLASÖRÜN KENDİSİ — `api/data.js`'deki taşımanın aynısı.
     *
     * Burası dosyaları TEK TEK taşıyordu ve `kartKlasoru` hiç geçirmiyordu. Sonuç,
     * paylaşım İPTAL edilince ortaya çıkıyordu: Carousel kartının slaytları
     * "3 PAYLAŞILDI/#9 Karosel" içinden çıkarılıp doğrudan "2 ONAYLANANLAR"a
     * bırakılıyor, kart klasörü boş olarak PAYLAŞILDI'da kalıyordu. Kullanıcı
     * ONAYLANANLAR'da klasörü arıyor ve bulamıyordu — ölçüldü.
     *
     * İleri yön (`api/data.js`) klasör taşımaya geçirilmişti; bu uç geride kalmıştı.
     * Aynı davranışı buraya da veriyoruz: tek çağrı, kaynakta boş klasör kalmıyor,
     * klasörün kimliği korunuyor. */
    let klasorTasima = null;
    if (kartKlasoru) {
      klasorTasima = await kartKlasorunuTasi({
        kartKlasoru, markaAdi: is.marka, markaKlasoru, hedefAd, ipucuDosyaLinki: dosyalar[0].link,
      });
      if (klasorTasima.tasindi || klasorTasima.zatenOrada) sonuclar.push(klasorTasima);
    }
    /* Klasörle birlikte taşınan dosyalar tekrar taşınmaya çalışılmaz. Klasör dışında
     * kalmış dosya varsa (elle yapıştırılmış bağlantı, özellik öncesi yükleme) o tek
     * tek taşınmaya devam eder — sessiz atlama yok. */
    const klasorleGidenler = new Set((klasorTasima && klasorTasima.icerdekiDosyalar) || []);

    for (const d of dosyalar) {
      if (klasorleGidenler.has(driveDosyaIdCikar(d.link))) continue;
      sonuclar.push(await onaylananiTasi({ dosyaLinki: d.link, markaAdi: is.marka, markaKlasoru, hedefAd, kartKlasoru }));
    }
    const basarili = sonuclar.filter((x) => x && x.tasindi).length;
    const zaten = sonuclar.filter((x) => x && x.zatenOrada).length;
    const hatali = sonuclar.filter((x) => x && !x.tasindi && !x.zatenOrada);
    return {
      tasindi: basarili > 0,
      zatenOrada: basarili === 0 && zaten === sonuclar.length,
      klasor: hedefAd,
      adet: sonuclar.length,
      sebep: hatali.length ? hatali.map((x) => x.sebep).filter(Boolean).join("; ") : undefined,
    };
  } catch (e) {
    return { tasindi: false, sebep: String(e.message || e) };
  }
}

function stokDegistirDahili(data, clientId, tur, delta) {
  const key = stokAnahtari(clientId, tur);
  const mevcut = (data.stoklar || {})[key] || 0;
  const yeni = Math.max(0, mevcut + delta);
  data.stoklar = { ...(data.stoklar || {}), [key]: yeni };
  return yeni;
}

/**
 * Paylaşım geçmişi kaydı.
 *
 * `subeId` ve `isId` eklendi: "bu içerik bu şubede paylaşıldı mı?" sorusunun asıl kaynağı
 * burası. Eski kayıtlarda bu alanlar yok — onlar marka geneli sayılır, hiçbir şubeye
 * yazılmaz. `marka` metni eskiden şube adını parantez içinde taşıyordu; o gösterim için
 * kalıyor ama artık ARAMA ona değil, `subeId` alanına bakıyor.
 */
function gecmiseEkle(data, clientId, marka, tur, tip, ek) {
  const liste = data.paylasimGecmisi || [];
  data.paylasimGecmisi = [...liste, {
    id: nid(), clientId, marka, tur, tip, tarih: bugunTR(),
    ...(ek && ek.subeId ? { subeId: ek.subeId } : {}),
    ...(ek && ek.isId ? { isId: ek.isId } : {}),
    /* Mutabakat düzeltmesinde "neden bu sayı" sorusu cevaplanabilsin: eski ve yeni
     * değer kayda giriyor. Elle keyfi düzeltme kaldırıldığı için tek iz bu. */
    ...(ek && ek.eski !== undefined ? { eski: ek.eski, yeni: ek.yeni } : {}),
  }];
}

/** Bu uç noktanın dokunabildiği alanlar — sayaç yalnızca bunlar için artar.
 *
 * `cekimIsleri` BİLEREK YOK: yalnızca plana bağlı kart işaretlenirken dokunuluyor. Listeye
 * konsaydı stok değiştirmek bile Operasyon'da çalışan herkesi bayat yapardı — düzeltmeye
 * çalıştığımız sorunun aynısı, küçük ölçekte. O işlem alanı kendisi bildiriyor. */
const BU_UCUN_ALANLARI = [
  "stoklar", "paylasimGecmisi", "gunlukKontrol", "haftalikPaylasimlar",
  "subeler", "uyelikler", "cekimSirasi",
];

/** Şube ücreti değişince markanın toplam aylık ücreti de değişir.
 *
 * Şube ekleme/silme ve şube ücreti düzenleme bu uçtan geçiyor ama toplam `clients`
 * alanında duruyor. Tazeleme yapılmazsa şube ayrıldığında toplam eski hâlinde kalır —
 * kullanıcının bildirdiği sorunun ta kendisi. Yalnızca GERÇEKTEN değiştiğinde
 * `clients` yazılan alanlara ekleniyor; şube adı düzeltmek gibi ücretle ilgisiz bir
 * işlem müşteri kartı üzerinde çalışan başkasını bayat yapmasın. */
function ucretiTazele(data) {
  const tazelenmis = ucretleriTazele(data.clients, data.clients, data.subeler, ayAnahtari());
  if (!tazelenmis) return [];
  data.clients = tazelenmis;
  return ["clients"];
}

/** Her kayıtta ana veriyi VE o günün yedeğini birlikte yazar — bu uç nokta üzerinden yapılan
 * (stok/paylaşım/haftalık plan/şube/günlük kontrol) değişiklikler daha önce günlük yedeğe hiç
 * dahil edilmiyordu, bu da bu verinin bir "bu tarihe dön" işleminde kaybolabileceği anlamına geliyordu. */
async function kaydetVeYedekle(data, degisenAlanlar) {
  // Ortak yazma katmanı: versiyon sayacını artırır, günlük + saatlik yedeği yazar.
  // Sayacın artması kritik — eskiden bu uç noktadan yapılan stok/plan değişiklikleri
  // sayacı artırmadığı için, açık duran bir yönetici sekmesi bunların üzerine yazabiliyordu.
  //
  // YAZILAN SÜRÜM GERİ DÖNÜYOR — bu bir hatanın düzeltmesiydi: yazma sayacı artırıyor ama
  // yanıt _v taşımadığı için tarayıcı bir tur geride kalıyordu. Sonraki yönetici kaydı
  // sahte bir "başka cihazdan değişmiş" uyarısı alıp kullanıcının o anki düzenlemesini
  // sunucu verisiyle eziyordu. Paylaşım paneline dokunmak, Operasyon'daki düzenlemeyi
  // kaybettiriyordu ve arada bir bağ görünmediği için sebebi anlaşılmıyordu.
  /* ALAN BAZLI SAYAÇ: bu uç yalnızca aşağıdaki alanlara dokunuyor. Bildirmeseydik TÜM
   * alanların sayacı artardı ve paylaşım panelinde bir kutu işaretlemek, o sırada Operasyon'da
   * kart düzenleyen herkesi bayat yapıp kaydını 409 ile geri çevirirdi. Yaşanan tam olarak buydu. */
  const yazilan = await guvenliYaz(data, degisenAlanlar || BU_UCUN_ALANLARI);
  return (yazilan && typeof yazilan._v === "number") ? yazilan._v : undefined;
}

/* Dosyanın DURDUĞU klasör, kartın aşamasını belirler — uydurma bir aşama stok motorunu
 * yanlış yöne çalıştırırdı. Her durumun İLK aşaması alınıyor (en erken hâli). */
const DURUMDAN_ASAMA = Object.fromEntries(
  Object.entries(ASAMA_DURUMU).map(([durum, asamalar]) => [durum, asamalar[0]]));

/* Dosya adından kategori tahmini. Yanlış tahmin sorun değil — kart açılır, kullanıcı
 * düzeltir; hiç kart açılmaması ise içeriğin görünmez kalması demek. */
function dosyaAdindanKategori(ad) {
  const s = String(ad || "").toLocaleLowerCase("tr");
  if (/\.(mp4|mov|m4v|avi|webm)$/.test(s) || /reels|video/.test(s)) return "Video";
  if (/karosel|carousel|carrousel/.test(s)) return "Carousel";
  if (/tasarım|tasarim|design|dizayn/.test(s)) return "Grafik Tasarım";
  return "Fotoğraf";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  const kimlik = await yetkiliMi(req);
  if (!kimlik.yetkili) return res.status(401).json({ error: "Yetkisiz." });
  /* ÜCRET YALNIZCA YÖNETİCİNİN İŞİ. Bu uca `paylasimlar` izni olan herkes girebiliyor —
   * stok işaretlemek için yeterli olan izin, fiyat belirlemek için değil. Şube ücreti
   * markanın faturasını doğrudan değiştirdiği için ayrıca yönetici aranıyor. */
  const yoneticiMi = await ownerYetkiliMi(req);

  // Tüm işlem (oku → değiştir → yaz) kilit altında yapılır: iki personel aynı anda
  // stok işaretlediğinde birinin değişikliği diğerini silmesin.
  let kilitAlindi = await kilitAl();
  /* Kilit alınamadıysa yazma yapılmaz — iki personel aynı anda stok işaretlediğinde
   * birinin değişikliğinin diğerini silmesi, tam olarak bu anda oluyordu.
   *
   * İŞLEM KİMLİĞİ BURADA YAZILMIYOR: 503 hiçbir şey yazmadan dönüyor, dolayısıyla
   * tarayıcının otomatik tekrarı gerçekten yeniden denemeli. İşaretlenseydi "bunu zaten
   * yaptım" sanılır ve işlem sessizce kaybolurdu. */
  if (!kilitAlindi) return mesgulYanit(res);

  /* AYNI İŞLEM İKİ KEZ UYGULANMASIN.
   *
   * Bu uçtaki işlemler FARK bildirimi: "stoğu bir artır", "plan ekle". Aynı isteği iki kez
   * göndermek iki kez uyguluyordu — ölçüldü: stok 10'dan 12'ye çıkıyor, toggle ise geri
   * alınıp sessizce iptal oluyordu.
   *
   * Kontrol KİLİDİN İÇİNDE: dışarıda olsaydı iki hızlı tıklama aynı anda "görmedim"
   * cevabı alır, ikisi de uygulanırdı. İşlem kimliği gönderilmezse eski davranış sürüyor. */
  const islemId = (req.body && req.body.islemId) || null;
  let saklama = null;
  if (islemId) {
    const kayitli = await kayitliYanit(islemId);
    if (kayitli) {
      await kilitBirak(kilitAlindi);
      kilitAlindi = false;
      return res.status(kayitli.kod).json({ ...kayitli.yanit, tekrarlandi: true });
    }
    /* Bundan sonraki her başarılı yanıt bu kimliğe kaydedilir. Yalnızca 2xx saklanır:
     * hata yanıtları tekrar denenebilir olmalı.
     *
     * Saklama sözü tutuluyor ve KİLİT BIRAKILMADAN ÖNCE bekleniyor. Beklenmeseydi
     * işaretleme kilidin dışına taşardı; en kötü ihtimalde bugünkü davranışa düşerdik
     * ama kuralı yarım uygulamaktansa tam uygulamak daha az sürpriz üretir. */
    yanitiYakala(res, (kod, govde) => { saklama = yanitiSakla(islemId, kod, govde); return saklama; });
  }

  try {
    const body = req.body || {};
    const { action } = body;
    const data = (await kv.get(KEY)) || {};
    const clients = data.clients || [];
    const markaAdi = (clientId) => (clients.find((c) => c.id === clientId) || {}).ad || "";

    /* ---------------------------------------------------------------- *
     * MARKA KİLİDİ KAPISI
     * Marka kilitli bir hesap (dışarıdan çalışan iş ortağı gibi) BAŞKA bir markanın
     * kaydını değiştiremez ya da silemez. Bu kontrol olmadan, kilitli hesap plan
     * kimliğini bilerek başka markanın alt metnini değiştirebiliyor, hatta planını
     * silebiliyordu (gerçek testte doğrulandı).
     *
     * Her action için hedefin hangi markaya ait olduğu tek yerde çözülür — action
     * başına ayrı kontrol yazmak, birini unutmaya açık olurdu.
     * ---------------------------------------------------------------- */
    if (Array.isArray(kimlik.markalar) && kimlik.markalar.length > 0) {
      const hedefClientId = (() => {
        if (body.clientId !== undefined && body.clientId !== null) return body.clientId;
        if (body.planId !== undefined) {
          const plan = (data.haftalikPaylasimlar || []).find((x) => x.id === body.planId);
          return plan ? plan.clientId : undefined;
        }
        if (body.subeId !== undefined) {
          const sube = (data.subeler || []).find((x) => x.id === body.subeId);
          return sube ? sube.clientId : undefined;
        }
        if (body.uyelikId !== undefined) {
          const uyelik = (data.uyelikler || []).find((x) => x.id === body.uyelikId);
          return uyelik ? uyelik.clientId : undefined;
        }
        /* YENİ KAYITTA KİMLİK İÇ NESNEDE. `uyelikEkle` markayı `body.uyelik.clientId`
         * içinde taşıyor, üst düzeyde değil. Çözümleyici onu göremediği için hedef
         * "belirsiz" kalıyor ve fail-close devreye giriyordu: çözüm ortağı KENDİ
         * markasına bile üyelik ekleyemiyordu — `uyelikler` izni onun için
         * işlevsizdi. Güvenlik tarafı doğruydu, eksik olan çözümlemeydi. */
        if (body.uyelik && body.uyelik.clientId !== undefined && body.uyelik.clientId !== null) {
          return body.uyelik.clientId;
        }
        return undefined;
      })();

      const hedefMarka = body.marka !== undefined ? body.marka
        : (hedefClientId !== undefined ? markaAdi(hedefClientId) : undefined);

      const izinli = markaErisimiVarMi(data, kimlik.markalar,
        hedefClientId !== undefined ? { clientId: hedefClientId } : { marka: hedefMarka });

      if (!izinli) {
        return res.status(403).json({ error: "Bu markaya erişim yetkin yok." });
      }
    }

    /** Yanıtlarda TÜM markaların listesi dönüyordu — kilitli hesaba yalnızca kendi
     * markalarının kayıtları gönderilir, aksi halde yanıt üzerinden veri sızardı. */
    /* Operasyon kartlarında clientId yok, marka ADI var — ayrı süzgeç gerekiyor.
     * Süzülmezse marka kilitli bir hesap, paylaşım işaretlediğinde yanıt üzerinden BÜTÜN
     * markaların kartlarını görürdü. */
    const kartlariSuz = (liste) => {
      if (!Array.isArray(liste)) return liste;
      if (!Array.isArray(kimlik.markalar) || kimlik.markalar.length === 0) return liste;
      return liste.filter((j) => markaErisimiVarMi(data, kimlik.markalar, { marka: j && j.marka }));
    };

    const yanitSuz = (liste, alan = "clientId") => {
      if (!Array.isArray(liste)) return liste;
      if (!Array.isArray(kimlik.markalar) || kimlik.markalar.length === 0) return liste;
      return liste.filter((k) => markaErisimiVarMi(data, kimlik.markalar,
        k && k[alan] !== undefined ? { clientId: k[alan] } : { marka: k && k.marka }));
    };

    if (action === "stokDegistir") {
      const { clientId, tur, delta } = body;
      stokDegistirDahili(data, clientId, tur, delta);
      gecmiseEkle(data, clientId, markaAdi(clientId), tur, delta < 0 ? "paylasim" : "cekim");
      // Paylaşımlar'dan "Paylaşıldı" ile bir şey paylaşıldıysa, Günlük Kontrol paneli de
      // bunu bugün için otomatik "yapıldı" işaretlesin — iki panel birbirinden habersiz
      // ilerleyip birbiriyle çelişen bir görünüm vermesin.
      if (delta < 0) {
        const bugun = bugunISO();
        const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
        const itemKey = `${clientId}_${tur}`;
        if (!kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: [...kontrol.yapilanlar, itemKey] };
        }
      }
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, stoklar: data.stoklar, paylasimGecmisi: yanitSuz(data.paylasimGecmisi), gunlukKontrol: data.gunlukKontrol });
    }

    if (action === "haftalikEkle") {
      const { clientId, gun, haftaKey, tur, isId, subeId } = body;
      /* ŞUBE — isteğe bağlı. Verilmezse MARKA GENELİ kayıt olur, yani bugünkü davranış.
       * Şube adı da kopyalanıyor: şube silinse bile geçmişte neyin nerede paylaşıldığı
       * okunabilsin (kart adı için kullanılan `isAdi` ile aynı gerekçe). */
      const secilenSube = subeId
        ? markaninSubeleri(data.subeler, clientId).find((x) => String(x.id) === String(subeId))
        : null;
      if (subeId && !secilenSube) {
        return res.status(400).json({ error: "Şube bulunamadı — sayfayı yenileyip tekrar dene." });
      }
      const liste = data.haftalikPaylasimlar || [];
      /* OPERASYON KARTI BAĞLAMA (isteğe bağlı).
       * Bağlanırsa paylaşım işaretlendiğinde kart "Teslim Edildi"ye geçer ve dosyası Drive'da
       * 3 PAYLAŞILDI klasörüne taşınır — marka yöneticisi Operasyon'a hiç girmez.
       * Bağlanmazsa plan eskisi gibi çalışır; her paylaşımın bir kartı olmayabilir. */
      let bagliIs = null;
      if (isId !== undefined && isId !== null && isId !== "") {
        const coz = bagliKartiCoz(data, isId, clientId);
        if (coz.hata) return res.status(400).json({ error: coz.hata });
        if (coz.is.asama !== PAYLASIMA_HAZIR && coz.is.asama !== SUBE_PAYLASIM_ASAMASI
            && coz.is.asama !== PAYLASILDI_ASAMASI) {
          return res.status(400).json({ error: `Bu kart henüz paylaşıma hazır değil (${coz.is.asama}). Önce müşteri onayı gerekiyor.` });
        }
        /* AYNI KART AYNI ŞUBEDE İKİ KEZ PLANLANAMAZ — ama FARKLI ŞUBELERDE PLANLANABİLİR.
         *
         * Eski kural "bu kart zaten bir plana bağlı" diyerek her ikinci planı reddediyordu;
         * çok şubeli markada aynı içeriği ikinci bir şubede kullanmayı tam olarak bu
         * kesiyordu. Kural kaldırılmadı, ŞUBE BAZINA daraltıldı. */
        const hedefSube = secilenSube ? String(secilenSube.id) : null;
        if (liste.some((p) => String(p.isId) === String(isId) && planSubesi(p) === hedefSube)) {
          return res.status(400).json({
            error: hedefSube
              ? `Bu kart ${secilenSube.ad} şubesi için zaten planlanmış.`
              : "Bu kart zaten bir paylaşım planına bağlı.",
          });
        }
        bagliIs = coz.is;
      }
      const yeni = { id: nid(), clientId, gun, haftaKey, tur, yapildi: false, yapildigiTarih: null,
        subeId: secilenSube ? secilenSube.id : null,
        subeAdi: secilenSube ? secilenSube.ad : null,
        isId: bagliIs ? bagliIs.id : null,
        /* Kartın adı plan kaydında da tutuluyor: kart sonradan silinse bile planda neyin
         * paylaşıldığı okunabilsin. Kimlik kaybolursa geriye ad kalır. */
        isAdi: bagliIs ? (bagliIs.icerikTuru || "") : null };
      data.haftalikPaylasimlar = [...liste, yeni];
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, haftalikPaylasimlar: yanitSuz(data.haftalikPaylasimlar) });
    }

    /* Planlanan bir paylaşımın ALT METNİ (caption). Müşteri panelinde gösterilir, böylece
     * müşteri neyin ne zaman, hangi metinle paylaşılacağını önceden görebilir. */
    if (action === "haftalikAltMetin") {
      // Alt metin ve/veya görsel. Sadece GÖNDERİLEN alan değişir — biri güncellenirken
      // diğerinin sıfırlanmaması için "undefined mı?" kontrolü yapılıyor.
      const { planId, altMetin, gorselUrl } = body;
      const liste = data.haftalikPaylasimlar || [];
      if (!liste.some((p) => p.id === planId)) return res.status(404).json({ error: "Plan bulunamadı." });
      data.haftalikPaylasimlar = liste.map((p) => {
        if (p.id !== planId) return p;
        const yeniPlan = { ...p };
        if (altMetin !== undefined) yeniPlan.altMetin = (altMetin || "").trim() || null;
        if (gorselUrl !== undefined) yeniPlan.gorselUrl = gorselUrl || null;
        return yeniPlan;
      });
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, haftalikPaylasimlar: yanitSuz(data.haftalikPaylasimlar) });
    }

    if (action === "haftalikSil") {
      const { planId } = body;
      const silinen = (data.haftalikPaylasimlar || []).find((p) => p.id === planId);
      data.haftalikPaylasimlar = (data.haftalikPaylasimlar || []).filter((p) => p.id !== planId);
      // Silinen plan "yapıldı" işaretliyse, o an Günlük Kontrol'de duran kaydı da temizlenir.
      // (Hangi güne planlandığına bakan bir kontrol denemiştik ama saat dilimi hesaplamasına
      // bağımlı olduğu için kırılgandı — silme her zaman geçerli bir "geri al" sinyalidir,
      // basit ve güvenilir olsun diye o kontrolü kaldırdık.) Aynı marka+tür için başka
      // işaretli bir plan daha varsa (gün fark etmeksizin), o hâlâ geçerli sayılır, kaldırmayız.
      if (silinen && silinen.yapildi) {
        const bugun = bugunISO();
        const itemKey = `${silinen.clientId}_${silinen.tur}`;
        const baskaIsaretliPlanVarMi = data.haftalikPaylasimlar.some(
          (p) => p.clientId === silinen.clientId && p.tur === silinen.tur && p.yapildi === true
        );
        if (!baskaIsaretliPlanVarMi && data.gunlukKontrol && data.gunlukKontrol.tarih === bugun && data.gunlukKontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: data.gunlukKontrol.yapilanlar.filter((k) => k !== itemKey) };
        }
      }
      /* PLAN SİLMEK = TAM GERİ ALMA.
       *
       * Bu işlem KARTA HİÇ DOKUNMUYORDU. Paylaşıldı işaretli bir plan silinince:
       * kart "Teslim Edildi"de kalıyor, stok geri gelmiyor ve Drive dosyası
       * PAYLAŞILDI klasöründe kalıyordu. Üstelik kart artık "Onaylandı" olmadığı
       * için paylaşım seçicisinde de ÇIKMIYOR — kullanıcı aynı içeriği başka bir
       * güne planlamak isteyince bulamıyordu. Sahadan bildirilen sorun tam buydu:
       * "iptal etsem de tekrar göstermiyor, sadece kalan görünüyor".
       *
       * `bagliKartiIsaretle` aşamayı KALAN planlardan hesapladığı için, plan
       * listeden çıkarıldıktan SONRA çağrılması yeterli: tek şubeli markada kart
       * "Onaylandı"ya döner, çok şubelide kalan şubeler varsa "Şubelerde
       * Paylaşılıyor"da kalır. */
      const isleriOnceSil = data.cekimIsleri || [];
      let geriAlinanIs = null;
      if (silinen && silinen.isId) {
        geriAlinanIs = bagliKartiIsaretle(data, silinen.isId,
          false, kimlik.markalar.length ? "Marka Yöneticisi" : "Yönetici (CEO)");
      }

      if (geriAlinanIs) {
        /* Stoğun tek sahibi kartın aşaması — motor farkı kendisi uyguluyor. */
        const stokSonucSil = onaylananlaraGoreStok(isleriOnceSil, data.cekimIsleri, data.stoklar,
          data.clients, undefined, data.subeler);
        if (stokSonucSil) { data.stoklar = stokSonucSil.stoklar; data.cekimIsleri = stokSonucSil.cekimIsleri; }
      } else if (silinen && silinen.yapildi) {
        /* Karta bağlı olmayan işaretli plan: sayıyı plan tutuyordu, geri veriliyor. */
        stokDegistirDahili(data, silinen.clientId, silinen.tur, 1);
      }

      const _v = await kaydetVeYedekle(data,
        geriAlinanIs ? [...BU_UCUN_ALANLARI, "cekimIsleri"] : undefined);

      /* Drive taşıması kilit DIŞINDA — Google çağrıları saniyeler sürebiliyor. */
      await kilitBirak(kilitAlindi); kilitAlindi = false;
      const silmeTasima = geriAlinanIs ? await bagliKartinDosyasiniTasi(data, geriAlinanIs) : null;

      return res.status(200).json({ ok: true, _v,
        haftalikPaylasimlar: yanitSuz(data.haftalikPaylasimlar),
        gunlukKontrol: data.gunlukKontrol,
        stoklar: data.stoklar,
        cekimIsleri: kartlariSuz(data.cekimIsleri),
        driveSonuc: silmeTasima });
    }

    if (action === "haftalikToggle") {
      const { planId } = body;
      const liste = data.haftalikPaylasimlar || [];
      const plan = liste.find((p) => p.id === planId);
      if (!plan) return res.status(404).json({ error: "Plan bulunamadı — sayfayı yenileyip tekrar dene." });
      const yeniYapildi = !plan.yapildi;
      data.haftalikPaylasimlar = liste.map((p) => (p.id === planId ? { ...p, yapildi: yeniYapildi, yapildigiTarih: yeniYapildi ? bugunTR() : null } : p));

      /* BAĞLI KART DA İLERLESİN. Marka yöneticisi paylaşımı işaretlediği anda Operasyon
       * kartı "Teslim Edildi"ye geçiyor; ayrıca panoya girip aynı işi ikinci kez yapması
       * gerekmiyor. Karışıklığın kaynağı buydu: editör hazırlıyor, yönetici paylaşıyor ve
       * iki panel birbirinden habersiz kalıyordu. */
      const isleriOnce = data.cekimIsleri || [];
      let tasinacakIs = null;
      if (plan.isId) {
        tasinacakIs = bagliKartiIsaretle(data, plan.isId, yeniYapildi,
          kimlik.markalar.length ? "Marka Yöneticisi" : "Yönetici (CEO)");
      }

      /* STOĞUN TEK SAHİBİ VAR.
       *
       * Kart bağlıysa stoğu KARTIN AŞAMASI yönetir (onaya girince artar, onaydan çıkınca
       * azalır). Plan da ayrıca düşseydi aynı içerik iki kez düşerdi — üstelik planın türü
       * kartınkinden farklı olabildiği için (plan "Görsel" derken kart Reels olabilir) yanlış
       * stoktan düşerdi. Bağsız planda böyle bir kart yok; orada sayıyı plan tutar. */
      const stokTuru = tasinacakIs ? paylasimTuru(tasinacakIs) : plan.tur;
      if (tasinacakIs) {
        /* Şubeler stok motoruna veriliyor: kart onaya girip çıkarken şube sayaçları da
         * birlikte hareket etsin. Verilmezse yalnızca genel stok değişir (şubesiz marka). */
        const stokSonuc = onaylananlaraGoreStok(isleriOnce, data.cekimIsleri, data.stoklar,
          data.clients, undefined, data.subeler);
        if (stokSonuc) { data.stoklar = stokSonuc.stoklar; data.cekimIsleri = stokSonuc.cekimIsleri; }
      } else {
        stokDegistirDahili(data, plan.clientId, plan.tur, yeniYapildi ? -1 : 1);
      }

      /* ŞUBE STOĞU — o şube paylaşınca kendi sayısı düşer.
       *
       * Genel stok kartın aşamasına bağlı ve yalnızca İLK paylaşımda düşüyor: dört şubede
       * kullanılan tek bir video, yine tek bir içerik. Şube sayacı ise her şube için ayrı
       * ilerliyor — "bu şubede kaç içerik bekliyor" sorusunun cevabı o. */
      const planSube = planSubesi(plan);
      if (planSube) {
        const subeAnahtar = subeStokAnahtari(plan.clientId, planSube, stokTuru);
        data.stoklar = {
          ...(data.stoklar || {}),
          [subeAnahtar]: Math.max(0, ((data.stoklar || {})[subeAnahtar] || 0) + (yeniYapildi ? -1 : 1)),
        };
      }

      gecmiseEkle(data, plan.clientId,
        `${markaAdi(plan.clientId)}${plan.subeAdi ? " (" + plan.subeAdi + ")" : ""}`,
        stokTuru, yeniYapildi ? "paylasim" : "cekim",
        { subeId: planSube, isId: plan.isId });
      // Haftalık Plan'dan bir paylaşım "yapıldı" işaretlenince/geri alınınca, Günlük Kontrol
      // paneli de bunu otomatik yansıtır. (Önceden "sadece bugüne aitse" diye ek bir kontrol
      // vardı ama saat dilimi hesaplamasına bağımlı olduğu için kırılgandı ve bazen hiç
      // yansımamasına yol açıyordu — kaldırıldı, basit ve güvenilir olsun istiyoruz.)
      const bugun = bugunISO();
      const itemKey = `${plan.clientId}_${plan.tur}`;
      const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
      if (yeniYapildi) {
        if (!kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: [...kontrol.yapilanlar, itemKey] };
        }
      } else {
        // Aynı marka+tür için başka işaretli bir plan daha varsa (gün fark etmeksizin),
        // o hâlâ geçerli sayılır, Günlük Kontrol'den kaldırmayız.
        const baskaIsaretliPlanVarMi = data.haftalikPaylasimlar.some(
          (p) => p.id !== planId && p.clientId === plan.clientId && p.tur === plan.tur && p.yapildi === true
        );
        if (!baskaIsaretliPlanVarMi && kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: kontrol.yapilanlar.filter((k) => k !== itemKey) };
        }
      }
      /* Bu işlem plana BAĞLI Operasyon kartına da dokunabiliyor (aşama + stok işareti),
       * o yüzden cekimIsleri burada ayrıca bildiriliyor. Diğer işlemler kartlara
       * dokunmadığı için onları bayat yapmıyor. */
      const _v = await kaydetVeYedekle(data, [...BU_UCUN_ALANLARI, "cekimIsleri"]);

      /* DRIVE TAŞIMASI KİLİT DIŞINDA. Google çağrıları saniyeler sürebiliyor; kilidi elde
       * tutarak beklemek o sırada işaretleme yapan herkesi bekletirdi. Kayıt zaten yazıldı;
       * taşıma başarısız olsa bile paylaşım geçerli. */
      await kilitBirak(kilitAlindi); kilitAlindi = false;
      const tasima = tasinacakIs ? await bagliKartinDosyasiniTasi(data, tasinacakIs) : null;

      return res.status(200).json({ ok: true, _v, haftalikPaylasimlar: yanitSuz(data.haftalikPaylasimlar),
        stoklar: data.stoklar, paylasimGecmisi: yanitSuz(data.paylasimGecmisi), gunlukKontrol: data.gunlukKontrol,
        cekimIsleri: kartlariSuz(data.cekimIsleri),
        /* Taşıma sonucu yanıtta: kullanıcı dosyanın gerçekten yerine gidip gitmediğini
         * görmeli. Sessiz başarısızlık, Drive'a elle bakmadan fark edilmez. */
        driveSonuc: tasima });
    }

    if (action === "gunlukToggle") {
      const { clientId, tur } = body;
      const bugun = bugunISO();
      const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
      const itemKey = `${clientId}_${tur}`;
      const varMi = kontrol.yapilanlar.includes(itemKey);
      const yeniYapilanlar = varMi ? kontrol.yapilanlar.filter((k) => k !== itemKey) : [...kontrol.yapilanlar, itemKey];
      data.gunlukKontrol = { tarih: bugun, yapilanlar: yeniYapilanlar };
      stokDegistirDahili(data, clientId, tur, varMi ? 1 : -1);
      gecmiseEkle(data, clientId, markaAdi(clientId), tur, varMi ? "cekim" : "paylasim");
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, gunlukKontrol: data.gunlukKontrol, stoklar: data.stoklar, paylasimGecmisi: yanitSuz(data.paylasimGecmisi) });
    }

    // ŞUBELER: bir markanın birden fazla şubesi/lokasyonu varsa her biri kendi adıyla
    // eklenir. Şube stoğu değiştirildiğinde HEM o şubenin kendi stoğu HEM de markanın
    // genel (toplam) stoğu aynı anda güncellenir — böylece Günlük Kontrol, Haftalık Plan
    // ve bildirimler gibi diğer tüm bölümler hiçbir değişiklik gerekmeden doğru toplamı görür.
    if (action === "subeEkle") {
      const { clientId, ad } = body;
      if (!ad || !ad.trim()) return res.status(400).json({ error: "Şube adı gerekli." });
      const liste = data.subeler || [];

      /* AYNI ADLA İKİNCİ ŞUBE AÇILMASIN.
       *
       * Şube adı her paylaşım kaydına KOPYALANIYOR (şube sonradan silinse bile geçmiş
       * okunabilir kalsın diye). İki "Smell Lara" varsa geçmişte hangisinin kastedildiği
       * bir daha ayırt edilemez. İstemci de kontrol ediyor ama tek başına yetmez: iki
       * kişi aynı anda ekleyince ikisi de "yok" görüp gönderiyor. Son söz sunucuda. */
      const temizAd = ad.trim();
      const ayniAd = liste.some((x) => x && String(x.clientId) === String(clientId)
        && (x.ad || "").trim().toLocaleLowerCase("tr") === temizAd.toLocaleLowerCase("tr"));
      if (ayniAd) return res.status(409).json({ error: `"${temizAd}" adında bir şube zaten var.` });

      const yeni = { id: nid(), clientId, ad: temizAd };
      /* Ücret yalnızca GİRİLDİYSE yazılır. Varsayılan 0 yazılsaydı, ücretlendirmesi
       * şubeye bağlı olmayan bir markada "şube ücreti kullanılıyor" sayılır ve marka
       * toplamı bir anda temel ücrete inerdi. */
      if (yoneticiMi && body.aylikUcret !== undefined && body.aylikUcret !== null && body.aylikUcret !== "") {
        yeni.aylikUcret = Number(body.aylikUcret) || 0;
      }
      data.subeler = [...liste, yeni];
      const _v = await kaydetVeYedekle(data, ["subeler", ...ucretiTazele(data)]);
      return res.status(200).json({ ok: true, _v, subeler: yanitSuz(data.subeler), ...(yoneticiMi ? { clients: data.clients } : {}) });
    }

    /* MARKA TEMEL ÜCRETİ. Şube ücretleriyle AYNI blokta girildiği için (ikisi ayrı
     * ekranda olsaydı "60.000 neyin toplamı" sorusu yine cevapsız kalırdı) müşteri
     * kartının form listesinden değil buradan yazılıyor. Boş gönderilirse alan silinir
     * ve şube ücreti de yoksa marka eski tek kalemli düzenine döner. */
    if (action === "markaTemelUcret") {
      if (!yoneticiMi) return res.status(403).json({ error: "Marka ücretini yalnızca yönetici değiştirebilir." });
      const { clientId } = body;
      const hedef = (data.clients || []).find((c) => String(c.id) === String(clientId));
      if (!hedef) return res.status(404).json({ error: "Marka bulunamadı." });
      const bosalt = body.temelUcret === undefined || body.temelUcret === null || body.temelUcret === "";
      data.clients = (data.clients || []).map((c) => {
        if (String(c.id) !== String(clientId)) return c;
        if (bosalt) { const { temelUcret, ...kalan } = c; return kalan; }
        return { ...c, temelUcret: Number(body.temelUcret) || 0 };
      });
      ucretiTazele(data);
      const _v = await kaydetVeYedekle(data, ["clients"]);
      return res.status(200).json({ ok: true, _v, clients: data.clients });
    }

    /* ŞUBE ÜCRETİ. Marka toplamı = temel ücret + şube ücretleri; bu uç ikisini de
     * yazar. Boş gönderilirse alan
     * SİLİNİR — "0 ₺ alıyoruz" ile "bu markada şube bazlı ücret kullanmıyoruz" farklı
     * şeyler ve ikincisi markayı eski tek kalemli düzenine geri döndürür. */
    if (action === "subeUcret") {
      if (!yoneticiMi) return res.status(403).json({ error: "Şube ücretini yalnızca yönetici değiştirebilir." });
      const { subeId } = body;
      const mevcut = (data.subeler || []).find((s) => String(s.id) === String(subeId));
      if (!mevcut) return res.status(404).json({ error: "Şube bulunamadı." });
      const bosalt = body.aylikUcret === undefined || body.aylikUcret === null || body.aylikUcret === "";
      data.subeler = (data.subeler || []).map((s) => {
        if (String(s.id) !== String(subeId)) return s;
        if (bosalt) { const { aylikUcret, ...kalan } = s; return kalan; }
        return { ...s, aylikUcret: Number(body.aylikUcret) || 0 };
      });
      const _v = await kaydetVeYedekle(data, ["subeler", ...ucretiTazele(data)]);
      return res.status(200).json({ ok: true, _v, subeler: yanitSuz(data.subeler), ...(yoneticiMi ? { clients: data.clients } : {}) });
    }

    if (action === "subeSil") {
      const { subeId } = body;
      /* PLANI OLAN ŞUBE SESSİZCE SİLİNMEZ.
       *
       * Silinen şubenin planları sahipsiz kalır ve "hangi içerik nerede paylaşıldı"
       * geçmişi okunamaz hale gelirdi. Plan kayıtları `subeAdi` kopyası taşıdığı için
       * GEÇMİŞ silinmiyor — ama kullanıcı ne olduğunu bilerek karar vermeli. */
      const bagliPlanlar = (data.haftalikPaylasimlar || []).filter((p) => String(p.subeId) === String(subeId));
      /* Yalnızca bu şubeye kilitli kartlar da uyarıya girsin — silme onlar için
       * "marka geneline dön" anlamına geliyor, kullanıcı bilerek karar vermeli. */
      const kilitliKartlar = (data.cekimIsleri || []).filter((j) =>
        j && Array.isArray(j.sadeceSubeler) && j.sadeceSubeler.map(String).includes(String(subeId)));
      if ((bagliPlanlar.length > 0 || kilitliKartlar.length > 0) && !body.onayliSil) {
        const paylasilan = bagliPlanlar.filter((p) => p.yapildi).length;
        const parcalar = [];
        if (bagliPlanlar.length > 0) parcalar.push(`${bagliPlanlar.length} paylaşım kaydı var (${paylasilan} tanesi paylaşılmış)`);
        if (kilitliKartlar.length > 0) parcalar.push(`${kilitliKartlar.length} kart yalnızca bu şubeye açık`);
        return res.status(409).json({
          error: `Bu şubenin ${parcalar.join(", ")}. `
               + "Şube silinirse paylaşım kayıtları geçmişte kalır. Yalnızca bu şubeye açık kartlar "
               + "MARKA GENELİNE DÖNMEZ — kapsamları kayıp sayılır ve siz yeni şube seçene kadar "
               + "hiçbir şubede kullanılamaz. Böylece yanlış şubede paylaşılmazlar.",
          onayGerekli: true, planSayisi: bagliPlanlar.length, paylasilanSayisi: paylasilan,
          kilitliKartSayisi: kilitliKartlar.length,
        });
      }
      data.subeler = (data.subeler || []).filter((s) => s.id !== subeId);

      /* O ŞUBEYE KİLİTLİ KARTLAR — KAPSAM AÇILMAZ.
       *
       * Kart birden çok şubeye kilitliyse silinen kimlik çıkarılır; kart kalan
       * şubelerde kullanılmaya devam eder. Doğru davranış bu.
       *
       * AMA LİSTE BOŞALACAKSA KİMLİK BIRAKILIR. Önce çıkarılıyordu ve
       * `sadeceSubeler: []` "marka geneli" anlamına geldiği için "yalnızca Lara için
       * hazırlanmış içerik" bir anda BÜTÜN şubelerde kullanılabilir hale geliyordu —
       * ölçüldü, iki şubeli markada kart Merkez'de kullanılabilir oluyordu. İş
       * mantığı açısından tehlikeli: içerik yanlış şubede paylaşılabilir.
       *
       * Kimlik kalınca kart hiçbir şubede kullanılamaz — kasıtlı ve güvenli durum.
       * Sessiz de değil: `kapsamiKayipMi` bunu ADI OLAN bir hale çeviriyor ve
       * Operasyon kartında uyarı olarak görünüyor. Kullanıcı kapsamı yeniden
       * seçince kart normale döner. Yeni bir alan eklenmedi. */
      data.cekimIsleri = (data.cekimIsleri || []).map((j) => {
        if (!j || !Array.isArray(j.sadeceSubeler)) return j;
        const kalan = j.sadeceSubeler.filter((x) => String(x) !== String(subeId));
        if (kalan.length === j.sadeceSubeler.length) return j;   // bu kartta yok
        if (kalan.length === 0) return j;                        // boşalacak — kimlik BIRAKILIR
        return { ...j, sadeceSubeler: kalan };
      });

      /* ŞUBE AYRILINCA MARKA TOPLAMI DÜŞER. Kullanıcının bildirdiği durum bu: üç şubeli
       * markada toplam 60.000'di, bir şube gidince 45.000 olmalı. Geçmiş aylar eski
       * tutarda DONDURULUYOR (`ucretGecmisi`), yani kesilmiş faturalar değişmiyor. */
      const _v = await kaydetVeYedekle(data, ["subeler", "cekimIsleri", ...ucretiTazele(data)]);
      return res.status(200).json({ ok: true, _v, subeler: yanitSuz(data.subeler), cekimIsleri: yanitSuz(data.cekimIsleri), ...(yoneticiMi ? { clients: data.clients } : {}) });
    }

    /* STOK MUTABAKATI — kayıtlı sayıyı KARTLARA GÖRE düzeltir.
     *
     * Elle keyfi +/− kaldırıldı: stok kartların yansıması olmalı. Geriye tek bir
     * düzeltme yolu kaldı ve o da rastgele bir sayı girmiyor — hedef değeri SUNUCU
     * kartlardan hesaplıyor. Tarayıcıdan gelen sayıya güvenilseydi, düzeltme
     * sapmayı gidermek yerine yeni bir sapma üretebilirdi.
     *
     * Marka kilidi `clientId` üzerinden zaten çözülüyor; ham anahtar yerine
     * clientId/tur/subeId alınmasının sebebi bu. */
    /* DRIVE EŞLEŞTİRME — "Drive'da içerik var ama kartı yok mu?"
     *
     * SALT OKUNUR: hiçbir klasör açılmaz, hiçbir dosya taşınmaz ya da silinmez.
     * Yalnızca markanın ONAYLANANLAR klasörleri listelenir ve kartların dosya
     * kimlikleriyle karşılaştırılır.
     *
     * Kilit ALINMAZ: yazma yok ve Google çağrıları saniyeler sürüyor — kilidi
     * tutmak o sırada paylaşım işaretleyen herkesi bekletirdi. */
    /* DRIVE DENETİMİ — "hangi klasörde ne var, kartlarla tutuyor mu, stok doğru mu".
     *
     * SALT OKUNUR: hiçbir dosya taşınmaz, hiçbir klasör açılmaz. Kilit ALINMAZ —
     * Google çağrıları saniyeler sürüyor, o süre boyunca herkesin yazmasını
     * engellemek sistemi durdururdu. */
    if (action === "driveEslestir") {
      const { clientId } = body;
      const marka = (data.clients || []).find((c) => String(c.id) === String(clientId));
      if (!marka) return res.status(404).json({ error: "Marka bulunamadı." });

      /* TARAMADAN ÖNCE KİLİT BIRAKILIYOR. Bir markanın ay klasörlerini gezmek saniyeler
       * sürüyor; kilidi elde tutmak o süre boyunca herkesin yazmasını engellerdi. Bu
       * işlem hiçbir şey yazmıyor, kilide zaten ihtiyacı yok. */
      await kilitBirak(kilitAlindi); kilitAlindi = false;

      const liste = await markaninDriveDosyalari({
        markaKlasoru: marka.driveOnayKlasoru || "", markaAdi: marka.ad,
      });
      if (!liste.ok) return res.status(200).json({ ok: true, eslestirme: null, sebep: liste.sebep });

      const esit = markaEslestirici(data.clients || [], marka.ad);
      const markaKartlari = (data.cekimIsleri || []).filter((j) => j && esit(j.marka));
      const rapor = driveDurumRaporu(liste.dosyalar, markaKartlari, paylasimTuru);
      const driveStok = driveyeGoreStok(liste.dosyalar, markaKartlari, paylasimTuru);
      const farklar = stokFarklari(stoklariBirlestir(data.stoklar), driveStok, marka.id, PAYLASIM_TURLERI);
      const karar = uygulanabilirMi(liste, farklar);

      return res.status(200).json({
        ok: true,
        eslestirme: {
          ...rapor,
          driveStok,
          stokFarklari: farklar,
          uygulanabilir: karar.uygula === true,
          uygulanamamaSebebi: karar.uygula ? undefined : karar.sebep,
          bakilanAylar: liste.bakilanAylar,
          toplamAy: liste.toplamAy,
          /* "Hiç dosya görmedim" ile "hiç klasör bulamadım" aynı şey değil — ikincisi
           * bir yapı sorunudur ve stoğu sıfırlamak için gerekçe olamaz. */
          ayBulunamadi: liste.ayBulunamadi,
          /* Bütçe dolduysa liste EKSİK — sessizce kesilmiş bir liste "her şeyi
           * gördük" sanılır ve yanlış karar verdirir. */
          tamamlanmadi: liste.tamamlanmadi,
        },
      });
    }

    /* DRIVE'A GÖRE STOĞU YAZ. Tarama İSTEMCİDEN GELMEZ — sunucu yeniden tarar.
     * Tarayıcıdan gelen sayıya güvenmek, ekranı açıp sayı uydurabilen herkese stok
     * yazma yetkisi vermek olurdu; stok otoritesi kuralı bunu yasaklıyor. */
    if (action === "driveStokUygula") {
      const { clientId } = body;
      const marka = (data.clients || []).find((c) => String(c.id) === String(clientId));
      if (!marka) return res.status(404).json({ error: "Marka bulunamadı." });

      /* Tarama kilit DIŞINDA — Google çağrıları saniyeler sürüyor. */
      await kilitBirak(kilitAlindi); kilitAlindi = false;

      const liste = await markaninDriveDosyalari({
        markaKlasoru: marka.driveOnayKlasoru || "", markaAdi: marka.ad, durumlar: ["onaylanan"],
      });
      const esit2 = markaEslestirici(data.clients || [], marka.ad);
      const kartlar2 = (data.cekimIsleri || []).filter((j) => j && esit2(j.marka));
      const driveStok2 = liste.ok ? driveyeGoreStok(liste.dosyalar, kartlar2, paylasimTuru) : {};
      const farklar2 = liste.ok ? stokFarklari(stoklariBirlestir(data.stoklar), driveStok2, marka.id, PAYLASIM_TURLERI) : [];
      const karar2 = uygulanabilirMi(liste, farklar2);
      if (!karar2.uygula) return res.status(200).json({ ok: true, uygulanmadi: true, sebep: karar2.sebep });

      /* YAZMA İÇİN KİLİT GERİ ALINIYOR ve belge TAZE okunuyor: tarama sürerken başkası
       * kart onaylamış olabilir; elimizdeki kopyayı yazmak onun işini silerdi. */
      kilitAlindi = await kilitAl();
      if (!kilitAlindi) return mesgulYanit(res);
      const taze = (await kv.get(KEY)) || {};
      const tazeFark = stokFarklari(stoklariBirlestir(taze.stoklar), driveStok2, marka.id, PAYLASIM_TURLERI);
      taze.stoklar = farklariUygula(taze.stoklar, tazeFark, marka.id, eskiTurAnahtarlari(taze.stoklar, marka.id));
      taze.paylasimGecmisi = [...(taze.paylasimGecmisi || []), ...tazeFark.map((f, i) => ({
        id: `drivestok_${Date.now().toString(36)}_${i}`,
        tarih: new Date().toISOString(),
        clientId: marka.id, marka: marka.ad, tur: f.tur,
        islem: "Drive denetimi", eski: f.kayitli, yeni: f.driveGore,
      }))];
      const _vDrive = await kaydetVeYedekle(taze, ["stoklar", "paylasimGecmisi"]);
      await kilitBirak(kilitAlindi); kilitAlindi = false;

      return res.status(200).json({ ok: true, _v: _vDrive, stoklar: taze.stoklar,
        paylasimGecmisi: yanitSuz(taze.paylasimGecmisi), uygulanan: tazeFark });
    }

    /* KARTSIZ DOSYADAN KART AÇ.
     *
     * Drive'da içerik var ama sistemde kartı yok — stok onu göremiyor, plan seçicisinde
     * çıkmıyor, kimse üzerinde çalışamıyor. Kullanıcı onaylarsa taslak kart açılır.
     *
     * KARTSIZ LİSTESİ İSTEMCİDEN GELMEZ: sunucu yeniden tarar ve YALNIZCA gerçekten
     * kartsız olan dosyalar için kart açar. Tarayıcıdan gelen listeye güvenmek, ekranı
     * açabilen herkese "şu dosya için kart aç" dedirtmek olurdu; üstelik ekrandaki liste
     * bayat olabilir ve az önce bağlanmış bir dosya için İKİNCİ bir kart açılırdı.
     *
     * Aşama, dosyanın DURDUĞU KLASÖRDEN geliyor: onay bekleyendeki dosya "Onaya
     * Sunuldu", onaylananlardaki "Onaylandı" olur. Uydurma bir aşama vermek, stok
     * motorunu yanlış tarafa çalıştırırdı. */
    if (action === "kartsizdanKartAc") {
      const { clientId, dosyaIdleri } = body;
      const marka = (data.clients || []).find((c) => String(c.id) === String(clientId));
      if (!marka) return res.status(404).json({ error: "Marka bulunamadı." });
      const istenen = new Set((Array.isArray(dosyaIdleri) ? dosyaIdleri : []).map(String));
      if (istenen.size === 0) return res.status(400).json({ error: "Kart açılacak dosya seçilmedi." });

      await kilitBirak(kilitAlindi); kilitAlindi = false;
      const liste = await markaninDriveDosyalari({
        markaKlasoru: marka.driveOnayKlasoru || "", markaAdi: marka.ad,
      });
      if (!liste.ok) return res.status(200).json({ ok: true, acilmadi: true, sebep: liste.sebep });

      const esitK = markaEslestirici(data.clients || [], marka.ad);
      const kartlarK = (data.cekimIsleri || []).filter((j) => j && esitK(j.marka));
      const raporK = driveDurumRaporu(liste.dosyalar, kartlarK, paylasimTuru);
      const acilacak = raporK.kartsiz.filter((x) => istenen.has(String(x.id)));
      if (acilacak.length === 0) {
        return res.status(200).json({ ok: true, acilmadi: true,
          sebep: "Seçilen dosyaların hepsinin zaten bir kartı var — liste tazelendi." });
      }

      kilitAlindi = await kilitAl();
      if (!kilitAlindi) return mesgulYanit(res);
      const taze = (await kv.get(KEY)) || {};
      const mevcut = taze.cekimIsleri || [];
      /* Aynı dosyaya İKİNCİ kart açılmasın: tarama ile yazma arasında biri kartı
       * elle açmış olabilir. */
      const bagliKimlikler = new Set();
      mevcut.forEach((j) => kartinDosyaKimlikleri(j).forEach((x) => bagliKimlikler.add(x)));
      const gercektenAcilacak = acilacak.filter((x) => !bagliKimlikler.has(String(x.id)));

      let sonrakiId = mevcut.reduce((m, j) => Math.max(m, Number(j.id) || 0), 0);
      const zamanK = new Date().toLocaleString("tr-TR");
      const yeniKartlar = gercektenAcilacak.map((dosya) => {
        sonrakiId += 1;
        const kategori = dosyaAdindanKategori(dosya.ad);
        return {
          id: sonrakiId,
          marka: marka.ad,
          kategori,
          icerikTuru: String(dosya.ad || "İçerik").replace(/\.[a-zA-Z0-9]+$/, "").slice(0, 120),
          asama: DURUMDAN_ASAMA[dosya.durum] || "Onaya Sunuldu",
          cekimTarihi: bugunISO(), teslimTarihi: bugunISO(),
          kameraman: "", editor: "", oncelik: "Normal", istenenAdet: "", uretilenAdet: "",
          brief: "", hamDosyaLink: "", editliDosyaLink: "",
          medya: [{ slot: 1, dosyaId: dosya.id, ad: dosya.ad,
            url: `https://drive.google.com/file/d/${dosya.id}/view` }],
          gecmis: [{ id: 1, tarih: zamanK, yazan: "Sistem",
            aciklama: `Drive denetiminde kartsız dosya bulundu — "${dosya.klasor}" klasöründeki dosya için kart açıldı. Tür ve ayrıntıları gözden geçir.` }],
          yorumlar: [],
          driveDenetimindenAcildi: true,
        };
      });

      if (yeniKartlar.length === 0) {
        await kilitBirak(kilitAlindi); kilitAlindi = false;
        return res.status(200).json({ ok: true, acilmadi: true, sebep: "Bu dosyalar bu arada bir karta bağlanmış." });
      }
      taze.cekimIsleri = [...mevcut, ...yeniKartlar];
      const _vKart = await kaydetVeYedekle(taze, ["cekimIsleri"]);
      await kilitBirak(kilitAlindi); kilitAlindi = false;
      return res.status(200).json({ ok: true, _v: _vKart, cekimIsleri: kartlariSuz(taze.cekimIsleri),
        acilanKartlar: yeniKartlar.map((j) => ({ isId: j.id, isAdi: j.icerikTuru, asama: j.asama })) });
    }

    /* ÇEKİM LİSTESİNİN ELLE SIRASI.
     *
     * Liste "stoğu en az olan üstte" diye sıralanıyordu; aciliyet her zaman stokla
     * ölçülmüyor (mekân, hava, müşterinin uygunluğu). Sıra elle düzenlenip kaydediliyor
     * ve HERKES aynı sırayı görüyor — ekip aynı önceliğe baksın.
     *
     * MARKA KİLİTLİ HESAP KAYDEDEMEZ. Bu liste ajans geneli; kendi markalarını gören bir
     * çözüm ortağı, göremediği markaların sırasını da değiştirmiş olurdu. Fail-close. */
    if (action === "cekimSirasiKaydet") {
      /* MARKA KİLİDİ AYRICA KONTROL EDİLMİYOR — ucun merkezî kuralı zaten reddediyor:
       * hedef marka çözülemeyen bir işlemde kilitli hesap fail-close ile 403 alıyor. Burada
       * ikinci bir kontrol yazılmıştı; bozulduğunda hiçbir kontrol düşmedi (ölçüldü), yani
       * hiç çalışmıyordu. Ölçülemeyen koruma tutmak, sonraki kişiye çalışıyormuş gibi
       * görünen bir güvence devretmek olurdu. */
      const gelen = Array.isArray(body.sira) ? body.sira : null;
      if (!gelen) return res.status(400).json({ error: "Sıra listesi gönderilmedi." });

      /* TEKİLLEŞTİRME VE SINIR: aynı kimlik iki kez gelirse sıralama belirsizleşir; sınır
       * ise belgenin sınırsız büyümesini engelliyor (tek JSON belge, boyut sınırı var). */
      const gorulen = new Set();
      const temiz = [];
      for (const x of gelen) {
        const k = String(x === null || x === undefined ? "" : x).trim();
        if (!k || gorulen.has(k)) continue;
        gorulen.add(k);
        temiz.push(k);
        if (temiz.length >= 300) break;
      }
      data.cekimSirasi = temiz;
      const _vSira = await kaydetVeYedekle(data, ["cekimSirasi"]);
      return res.status(200).json({ ok: true, _v: _vSira, cekimSirasi: data.cekimSirasi });
    }

    if (action === "stokDuzelt") {
      const { clientId, tur, subeId } = body;
      if (!clientId || !tur) return res.status(400).json({ error: "Marka ve tür gerekli." });
      if (subeId) {
        const sube = markaninSubeleri(data.subeler, clientId).find((x) => String(x.id) === String(subeId));
        if (!sube) return res.status(400).json({ error: "Şube bu markaya ait değil." });
      }
      const anahtar = subeId ? `${clientId}_${subeId}_${tur}` : `${clientId}_${tur}`;
      const gereken = kartlaraGoreStok(data)[anahtar] || 0;
      /* Toplanmış hâl okunuyor: eski tür anahtarları (`1_Görsel`) yeni türe eklenmiş
       * olarak görülsün, yoksa düzeltilecek bir şey yokken "0 → 5" gibi sahte bir
       * düzeltme yazılırdı. */
      const kayitli = stoklariBirlestir(data.stoklar || {})[anahtar] || 0;
      if (gereken === kayitli) {
        return res.status(200).json({ ok: true, _v: data._v, stoklar: data.stoklar, degismedi: true });
      }
      /* Eski tür anahtarları siliniyor: okuma anındaki toplama onları doğru sayının
       * ÜSTÜNE eklemeye devam ederdi. */
      const temiz = { ...(data.stoklar || {}) };
      eskiTurAnahtarlari(temiz, clientId).forEach((a) => { delete temiz[a]; });
      data.stoklar = { ...temiz, [anahtar]: gereken };
      gecmiseEkle(data, clientId,
        `${markaAdi(clientId)}${subeId ? ` (${(data.subeler || []).find((x) => String(x.id) === String(subeId))?.ad || ""})` : ""}`,
        tur, "duzeltme", { eski: kayitli, yeni: gereken });
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, stoklar: data.stoklar,
        paylasimGecmisi: yanitSuz(data.paylasimGecmisi), duzeltildi: { anahtar, eski: kayitli, yeni: gereken } });
    }

    if (action === "subeStokDegistir") {
      const { clientId, subeId, tur, delta } = body;
      /* ŞUBE, VERİLEN MARKAYA AİT OLMALI.
       *
       * Şube TÜM şubeler arasında aranıyordu. Marka kilidi `clientId`'yi ilk sırada
       * çözdüğü için, kilitli bir hesap kendi `clientId`'sini ve BAŞKA markanın
       * `subeId`'sini gönderdiğinde istek geçiyordu — ölçüldü. İki sonucu vardı:
       * `1_onun_Video` gibi hiçbir şubeye karşılık gelmeyen çöp bir stok anahtarı
       * oluşuyor, ve BAŞKA MARKANIN ŞUBE ADI geçmişe yazılıyordu.
       *
       * Kural yalnızca yetki değil VERİ BÜTÜNLÜĞÜ meselesi: yöneticide de geçerli,
       * çünkü çöp anahtar stok sayılarını bozar. `haftalikEkle` bu doğrulamayı zaten
       * yapıyordu; burada eksikti. */
      const sube = markaninSubeleri(data.subeler, clientId).find((s) => String(s.id) === String(subeId));
      if (!sube) {
        return res.status(400).json({ error: "Şube bu markaya ait değil — sayfayı yenileyip tekrar dene." });
      }
      const subeAdi = sube.ad || "";
      const subeKey = `${clientId}_${subeId}_${tur}`;
      const mevcutSube = (data.stoklar || {})[subeKey] || 0;
      const yeniSube = Math.max(0, mevcutSube + delta);
      data.stoklar = { ...(data.stoklar || {}), [subeKey]: yeniSube };
      // Genel (toplam) stok da aynı miktarda değişir.
      stokDegistirDahili(data, clientId, tur, delta);
      gecmiseEkle(data, clientId, `${markaAdi(clientId)}${subeAdi ? " (" + subeAdi + ")" : ""}`, tur, delta < 0 ? "paylasim" : "cekim");
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, stoklar: data.stoklar, paylasimGecmisi: yanitSuz(data.paylasimGecmisi) });
    }

    if (action === "uyelikEkle") {
      const { uyelik } = body;
      const liste = data.uyelikler || [];
      const yeni = { ...uyelik, id: nid() };
      data.uyelikler = [...liste, yeni];
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, uyelikler: yanitSuz(data.uyelikler) });
    }

    if (action === "uyelikGuncelle") {
      const { uyelikId, patch } = body;
      data.uyelikler = (data.uyelikler || []).map((u) => (u.id === uyelikId ? { ...u, ...patch } : u));
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, uyelikler: yanitSuz(data.uyelikler) });
    }

    if (action === "uyelikSil") {
      const { uyelikId } = body;
      /* Kalıcı silme yerine Silinenler Kutusu'na taşınır — arayüzdeki diğer silmelerle
       * aynı davranış. Yanlışlıkla silinen bir üyelik 30 gün içinde geri alınabilir. */
      const silinen = (data.uyelikler || []).find((u) => u.id === uyelikId);
      data.uyelikler = (data.uyelikler || []).filter((u) => u.id !== uyelikId);
      if (silinen) {
        const sinir = Date.now() - 30 * 24 * 60 * 60 * 1000;
        data.silinenler = [
          ...(data.silinenler || []).filter((x) => !x.silmeZamani || x.silmeZamani > sinir),
          { silmeId: `uyelikler-${uyelikId}-${Date.now()}`, alan: "uyelikler", tur: "Üyelik",
            etiket: String(silinen.ad || silinen.marka || ""), kayit: silinen,
            silmeZamani: Date.now(), silen: "Yönetici (CEO)" },
        ];
      }
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, uyelikler: yanitSuz(data.uyelikler) });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  } finally {
    if (saklama) await saklama.catch(() => {});
    await kilitBirak(kilitAlindi);
  }
}
