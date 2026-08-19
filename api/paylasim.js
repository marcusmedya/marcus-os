import { kv } from "@vercel/kv";
import { KEY, guvenliYaz, kilitAl, kilitBirak, bugunISO } from "../lib/kv-yaz.js";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { markaErisimiVarMi } from "../lib/marka-kilidi.js";
import { onaylananiTasi, DURUM_KLASORLERI } from "../lib/drive-tasima.js";
import { tasinacakDosyalar } from "../lib/asamalar.js";
import { onaylananlaraGoreStok, paylasimTuru } from "../lib/stok.js";

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
function bagliKartiIsaretle(data, isId, paylasildi, kim) {
  const zaman = new Date().toLocaleString("tr-TR");
  let etkilenen = null;
  data.cekimIsleri = (data.cekimIsleri || []).map((j) => {
    if (String(j.id) !== String(isId)) return j;
    const yeniAsama = paylasildi ? PAYLASILDI_ASAMASI : PAYLASIMA_HAZIR;
    if (j.asama === yeniAsama) { etkilenen = j; return j; }
    const guncel = {
      ...j,
      asama: yeniAsama,
      teslimEdilmeTarihi: paylasildi ? bugunISO() : null,
      gecmis: [...(j.gecmis || []), {
        id: (j.gecmis || []).length + 1, tarih: zaman, yazan: kim,
        aciklama: paylasildi
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
  try {
    const sonuclar = [];
    for (const d of dosyalar) {
      sonuclar.push(await onaylananiTasi({ dosyaLinki: d.link, markaAdi: is.marka, markaKlasoru, hedefAd }));
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

function gecmiseEkle(data, clientId, marka, tur, tip) {
  const liste = data.paylasimGecmisi || [];
  data.paylasimGecmisi = [...liste, { id: nid(), clientId, marka, tur, tip, tarih: bugunTR() }];
}

/** Her kayıtta ana veriyi VE o günün yedeğini birlikte yazar — bu uç nokta üzerinden yapılan
 * (stok/paylaşım/haftalık plan/şube/günlük kontrol) değişiklikler daha önce günlük yedeğe hiç
 * dahil edilmiyordu, bu da bu verinin bir "bu tarihe dön" işleminde kaybolabileceği anlamına geliyordu. */
async function kaydetVeYedekle(data) {
  // Ortak yazma katmanı: versiyon sayacını artırır, günlük + saatlik yedeği yazar.
  // Sayacın artması kritik — eskiden bu uç noktadan yapılan stok/plan değişiklikleri
  // sayacı artırmadığı için, açık duran bir yönetici sekmesi bunların üzerine yazabiliyordu.
  //
  // YAZILAN SÜRÜM GERİ DÖNÜYOR — bu bir hatanın düzeltmesiydi: yazma sayacı artırıyor ama
  // yanıt _v taşımadığı için tarayıcı bir tur geride kalıyordu. Sonraki yönetici kaydı
  // sahte bir "başka cihazdan değişmiş" uyarısı alıp kullanıcının o anki düzenlemesini
  // sunucu verisiyle eziyordu. Paylaşım paneline dokunmak, Operasyon'daki düzenlemeyi
  // kaybettiriyordu ve arada bir bağ görünmediği için sebebi anlaşılmıyordu.
  const yazilan = await guvenliYaz(data);
  return (yazilan && typeof yazilan._v === "number") ? yazilan._v : undefined;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  const kimlik = await yetkiliMi(req);
  if (!kimlik.yetkili) return res.status(401).json({ error: "Yetkisiz." });

  // Tüm işlem (oku → değiştir → yaz) kilit altında yapılır: iki personel aynı anda
  // stok işaretlediğinde birinin değişikliği diğerini silmesin.
  let kilitAlindi = await kilitAl();
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
      const { clientId, gun, haftaKey, tur, isId } = body;
      const liste = data.haftalikPaylasimlar || [];
      /* OPERASYON KARTI BAĞLAMA (isteğe bağlı).
       * Bağlanırsa paylaşım işaretlendiğinde kart "Teslim Edildi"ye geçer ve dosyası Drive'da
       * 3 PAYLAŞILDI klasörüne taşınır — marka yöneticisi Operasyon'a hiç girmez.
       * Bağlanmazsa plan eskisi gibi çalışır; her paylaşımın bir kartı olmayabilir. */
      let bagliIs = null;
      if (isId !== undefined && isId !== null && isId !== "") {
        const coz = bagliKartiCoz(data, isId, clientId);
        if (coz.hata) return res.status(400).json({ error: coz.hata });
        if (coz.is.asama !== PAYLASIMA_HAZIR && coz.is.asama !== PAYLASILDI_ASAMASI) {
          return res.status(400).json({ error: `Bu kart henüz paylaşıma hazır değil (${coz.is.asama}). Önce müşteri onayı gerekiyor.` });
        }
        if (liste.some((p) => String(p.isId) === String(isId))) {
          return res.status(400).json({ error: "Bu kart zaten bir paylaşım planına bağlı." });
        }
        bagliIs = coz.is;
      }
      const yeni = { id: nid(), clientId, gun, haftaKey, tur, yapildi: false, yapildigiTarih: null,
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
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, haftalikPaylasimlar: yanitSuz(data.haftalikPaylasimlar), gunlukKontrol: data.gunlukKontrol });
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
        const stokSonuc = onaylananlaraGoreStok(isleriOnce, data.cekimIsleri, data.stoklar, data.clients);
        if (stokSonuc) { data.stoklar = stokSonuc.stoklar; data.cekimIsleri = stokSonuc.cekimIsleri; }
      } else {
        stokDegistirDahili(data, plan.clientId, plan.tur, yeniYapildi ? -1 : 1);
      }
      gecmiseEkle(data, plan.clientId, markaAdi(plan.clientId), stokTuru, yeniYapildi ? "paylasim" : "cekim");
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
      const _v = await kaydetVeYedekle(data);

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
      const yeni = { id: nid(), clientId, ad: ad.trim() };
      data.subeler = [...liste, yeni];
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, subeler: yanitSuz(data.subeler) });
    }

    if (action === "subeSil") {
      const { subeId } = body;
      data.subeler = (data.subeler || []).filter((s) => s.id !== subeId);
      const _v = await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, _v, subeler: yanitSuz(data.subeler) });
    }

    if (action === "subeStokDegistir") {
      const { clientId, subeId, tur, delta } = body;
      const sube = (data.subeler || []).find((s) => s.id === subeId);
      const subeAdi = sube ? sube.ad : "";
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
    await kilitBirak(kilitAlindi);
  }
}
