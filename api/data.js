import { kv } from "@vercel/kv";
import crypto from "crypto";
import { KEY, guvenliGuncelle, kilitAl, kilitBirak, guvenliYaz, deftereYaz, defteriOku } from "../lib/kv-yaz.js";
import { girisKoduGonder, koduDogrula, oturumAc, oturumKapat, oturumGecerliMi, tumOturumlariIptalEt, ikiAdimliAktifMi, esitMi, baslikOku } from "../lib/oturum.js";
import { markayaGoreSuz, icBilgiyiTemizle, izinleriDaralt, yazmayiBirlestir, trKucult, markaEslestirici } from "../lib/marka-kilidi.js";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { epostaGonder, revizeBildirimHtml } from "../lib/eposta.js";
import { onaylananiTasi } from "../lib/drive-tasima.js";
import { yuklemeOturumuAc, yuklemeyiTamamla, yuklenenDosyayiSil, yuklemeHazirMi } from "../lib/drive-yukleme.js";

/** Bir kayıt (eski veri, yeni veri) arasındaki ÖNEMLİ değişiklikleri (müşteri/personel/üyelik
 * ekleme-silme, müşteri durum değişikliği) otomatik tespit edip okunabilir işlem geçmişi
 * kayıtları üretir. Amaç: her tek tek işlemi elle loglamak yerine, kayıt anında ne değiştiğini
 * karşılaştırarak "kim ne zaman ne yaptı" defterini kendiliğinden doldurmak. */
function degisiklikleriTespitEt(eski, yeni, kisi) {
  const aciklamalar = [];
  const listeKarsilastir = (alan, etiket, adAlani) => {
    const eskiListe = Array.isArray(eski && eski[alan]) ? eski[alan] : [];
    const yeniListe = Array.isArray(yeni && yeni[alan]) ? yeni[alan] : [];
    const eskiIds = new Set(eskiListe.map((x) => x.id));
    const yeniIds = new Set(yeniListe.map((x) => x.id));
    yeniListe.forEach((x) => { if (!eskiIds.has(x.id)) aciklamalar.push(`${etiket} eklendi: "${x[adAlani] || x.id}"`); });
    eskiListe.forEach((x) => {
      if (!yeniIds.has(x.id)) { aciklamalar.push(`${etiket} silindi: "${x[adAlani] || x.id}"`); return; }
      // Müşteri durum değişikliği (aktif/donduruldu/ayrıldı) ayrıca not edilir.
      if (alan === "clients") {
        const yenisi = yeniListe.find((y) => y.id === x.id);
        if (yenisi && yenisi.durum !== x.durum) aciklamalar.push(`"${x.ad}" durumu değişti: ${x.durum} → ${yenisi.durum}`);
      }
    });
  };
  listeKarsilastir("clients", "Müşteri", "ad");
  listeKarsilastir("personel", "Personel", "ad");
  listeKarsilastir("uyelikler", "Üyelik", "ad");
  listeKarsilastir("teklifler", "Teklif", "musteri");
  return aciklamalar.map((aciklama) => ({ id: nid(), tarih: new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }), kisi, aciklama }));
}
function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/** Kaba kuvvet (brute-force) koruması: aynı IP'den 15 dakikada 20'den fazla başarısız
 * giriş denemesi olursa, şifre doğru olsa bile bir süre reddedilir. */
const RATE_LIMIT_ESIK = 20;
const RATE_LIMIT_PENCERE_SN = 900; // 15 dakika
function istekIP(req) {
  return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "bilinmeyen").split(",")[0].trim();
}
async function rateLimitAsildiMi(req) {
  try {
    const sayac = (await kv.get(`login-fail-${istekIP(req)}`)) || 0;
    return sayac >= RATE_LIMIT_ESIK;
  } catch (e) {
    return false; // KV'ye ulaşılamıyorsa girişi tamamen engelleme, sadece koruma devre dışı kalır
  }
}
/** Başarılı girişte sayaç sıfırlanır. Bu olmadan, gün içinde biriken hatalı denemeler
 * (çoğu zaman kendi test denemelerin) 15 dakika boyunca PERSONEL ve MÜŞTERİ girişlerini de
 * kilitliyordu — sayaç IP başına tutulduğu için doğru şifreyi bilen kişi de giremiyordu. */
async function basariliGirisiSifirla(req) {
  try { await kv.del(`login-fail-${istekIP(req)}`); } catch (e) { /* kritik değil */ }
}
async function basarisizGirisiKaydet(req) {
  try {
    const key = `login-fail-${istekIP(req)}`;
    const sayac = (await kv.get(key)) || 0;
    await kv.set(key, sayac + 1, { ex: RATE_LIMIT_PENCERE_SN });
  } catch (e) {
    // sayaç kaydedilemezse sessizce geç, bu kritik değil
  }
}

// Her izin, personel görürse hangi veri alanlarına ihtiyaç duyacağını belirler.
// CEO Paneli'nden bu izinlerden hangileri açıksa, personelin GET yanıtına o alanlar dahil edilir
// ve POST ile o alanlara yazması kabul edilir. Ayarlar bilerek bu listede YOK — personel hesap
// yönetimi, şifre koruması gibi güvenlik ayarlarına personelin asla erişimi olmaz.
const PERMISSION_DATA_FIELDS = {
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar", "musteriIcerikleri"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar", "clients", "hesapOlcumleri"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "clients", "haftalikPaylasimlar", "subeler"],
  cekimListesi: ["stoklar", "paylasimGecmisi", "clients", "subeler"],
  cekimEdit: ["cekimIsleri", "clients", "markalasmaSurecleri", "musteriIcerikleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  uyelikler: ["uyelikler"],
  sifreKasasi: ["musteriGirisleri", "clients"],
  /* İÇERİK AKIŞI — çözüm ortağının kendi markalarının içerik durumunu (onay bekleyen /
   * revize istenen / onaylanan) görebilmesi için. SALT OKUNUR: PERMISSION_WRITE_FIELDS'ta
   * karşılığı yok, yani bu izinle hiçbir şey yazılamaz. */
  musteriAkisi: ["musteriIcerikleri", "clients", "cekimIsleri"],
};
// YAZMA izinleri OKUMA izinlerinden bilerek farklı: paylasimlar/cekimEdit gibi dar izinler
// "clients"i sadece marka adı GÖRMEK için (sadeleştirilmiş) alır — asıl (zengin) müşteri
// verisinin bu sadeleştirilmiş haliyle EZİLMEMESİ için o izinlerden clients YAZILAMAZ.
const PERMISSION_WRITE_FIELDS = {
  /* DASHBOARD SALT OKUNUR (denetim bulgusu).
   * Eskiden clients, personel, hesaplar dahil 11 alanı YAZABİLİYORDU. Dashboard bir
   * görüntüleme ekranı — KPI kartları gösterir, kayıt düzenlemez. Sadece Dashboard izni
   * verilen bir hesap maaşları ve müşteri kayıtlarını değiştirebiliyordu.
   * Gerçek düzenleme Finans / Müşteriler / Personel izinlerinden yapılır. */
  dashboard: [],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar", "musteriIcerikleri"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  /* TAKVİM müşteri kaydını YAZAMAZ (denetim bulgusu): takvimde müşteri adı yalnızca
   * gösteriliyor, düzenlenmiyor. Yazma hakkı varken sadece Takvim izinli bir hesap tüm
   * müşteri listesini değiştirebiliyordu. Vergi takvimi kayıtları buradan yazılabilir. */
  takvim: ["vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar", "hesapOlcumleri"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "haftalikPaylasimlar", "subeler"],
  cekimListesi: [],
  cekimEdit: ["cekimIsleri", "markalasmaSurecleri", "musteriIcerikleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  uyelikler: ["uyelikler"],
  sifreKasasi: ["musteriGirisleri"],
};
const FULL_CLIENT_PERMS = ["dashboard", "musteriler", "finans", "takvim", "odemeTakvimi"];
const DEFAULT_FIELD_VALUES = {
  clients: [], monthly: [], gelirKalemleri: [], giderKalemleri: [], ofisGiderleri: [], bekleyenTahsilatlar: [],
  personel: [], vergiTakvimi: [], hesaplar: [{ id: "ana", ad: "Marcus Medya", anaHesap: true }], hesapTransferleri: [],
  teklifler: [], teklifSablonlari: [], sozlesmeSablonlari: [], markaKimligiGorseli: null,
  reklamlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: null, cekimIsleri: [], birikimler: [], haftalikPaylasimlar: [], subeler: [], markalasmaSurecleri: [], musteriIcerikleri: [], uyelikler: [],
};
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimListesi: false, cekimEdit: true, markaYoneticisi: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false,
};

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Şifreyi/kimlik bilgilerini kontrol edip rolü döndürür.
 * "owner" (tam yetki), "staff" (izinli alanlar, opsiyonel kişisel kimlikle), ya da null (yetkisiz). */
async function resolveRole(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");

  // Yeni yol: tarayıcı artık şifre yerine süreli bir oturum anahtarı gönderiyor.
  if (req.headers["x-oturum"] && (await oturumGecerliMi(req.headers["x-oturum"]))) return { role: "owner" };

  if (!ownerPw && !staffPwLegacy) {
    const username = baslikOku(req, "x-staff-username");
    if (!username) return { role: "owner" };
  }
  if (ownerPw && provided === ownerPw) return { role: "owner" };
  if (staffPwLegacy && provided === staffPwLegacy) return { role: "staff", staffId: null, staffName: null };

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "staff", staffId: hesap.id, staffName: hesap.ad, staffPerms: hesap.izinler || null, staffEmail: hesap.email || "", staffMarkalar: hesap.markalar || [] };
    }
  }

  // Müşteri Paneli girişi — tamamen ayrı bir kullanıcı adı/şifre çifti kullanır,
  // personel/owner girişleriyle hiç karışmaz. Sadece KENDİ marka bilgisine erişebilir.
  const musteriUsername = baslikOku(req, "x-musteri-username");
  const musteriPassword = baslikOku(req, "x-musteri-password");
  if (musteriUsername && musteriPassword) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.musteriHesaplari) || []).find((h) => h.kullaniciAdi === musteriUsername);
    if (hesap) {
      const hash = hashSifre(musteriPassword, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "musteri", musteriId: hesap.id, musteriClientId: hesap.clientId, musteriAd: hesap.ad };
    }
  }
  return null;
}


/**
 * AŞAMA DEĞİŞİMİNDE DRIVE TAŞIMA.
 *
 * Kayıt öncesi ve sonrası iş listeleri karşılaştırılır; bir iş "Teslim Edildi" aşamasına
 * YENİ geçtiyse dosyası PAYLAŞILANLAR/<AY> klasörüne taşınır.
 *
 * Neden aşama üzerinden: paylaşım planı kaydında dosya bağlantısı yok, iş kartında var.
 * "Teslim Edildi" zaten "paylaşıldı" anlamına gelen son aşama.
 *
 * ASLA HATA FIRLATMAZ — kaydın kendisi her koşulda geçerli kalır.
 */
/**
 * AŞAMA -> DRIVE KLASÖRÜ eşlemesi.
 *
 * Listede olmayan aşamalarda dosyaya DOKUNULMAZ — erken aşamalarda (çekim, edit) dosya
 * henüz ekibin çalışma alanındadır, sistemin oraya karışmaması gerekir.
 */
const ASAMA_KLASORU = {
  "Kontrol Bekliyor": "ONAY BEKLEYENLER",
  "Revize İstendi": "ONAY BEKLEYENLER",
  "Onaylandı": "ONAYLANANLAR",
  "Teslim Edildi": "PAYLAŞILDI",
};

/**
 * AŞAMASI DEĞİŞEN İŞLERİN DOSYALARINI DOĞRU KLASÖRE TAŞIR.
 *
 * Kayıt öncesi ve sonrası iş listeleri karşılaştırılır; aşaması değişen her işin dosyası,
 * yeni aşamasının karşılığı olan klasöre taşınır.
 *
 * İKİ YÖNLÜ: aşama geri alınırsa dosya da geri gelir. Teslim geri alınınca ONAYLANANLAR'a,
 * onay geri alınınca ONAY BEKLEYENLER'e döner. Böylece Drive her zaman kartın gerçek
 * aşamasını gösterir — yanlışlıkla teslim işaretlenen bir iş Drive'da yanlış yerde kalmaz.
 *
 * ASLA HATA FIRLATMAZ — kaydın kendisi her koşulda geçerli kalır.
 */
async function asamayaGoreTasi(oncekiVeri, sonrakiVeri) {
  const onceki = new Map(((oncekiVeri && oncekiVeri.cekimIsleri) || []).map((j) => [String(j.id), j.asama]));
  const degisenler = ((sonrakiVeri && sonrakiVeri.cekimIsleri) || []).filter((j) => {
    /* KARŞILAŞTIRMA AŞAMAYA DEĞİL, HEDEF KLASÖRE BAKAR.
     *
     * İki aşama aynı klasöre düşüyor: "Kontrol Bekliyor" ve "Revize İstendi" ikisi de
     * ONAY BEKLEYENLER. Aşamaya bakılsaydı her revize turunda dosya zaten bulunduğu klasöre
     * "taşınmaya" çalışılır, Google'a boşuna 7 çağrı gider ve karta "taşıma yapılamadı: dosya
     * zaten orada" diye SAHTE bir hata notu düşerdi. Onay döngüsündeki en sık geçiş bu
     * olduğu için kartın geçmişi turlarca sahte notla dolardı.
     *
     * Önceki aşamanın olmaması (yeni açılan kart) da bir değişimdir: eskiKlasor undefined
     * olur, hedef klasörden farklıdır, dosya taşınır. Doğrudan "Kontrol Bekliyor" ya da
     * "Teslim Edildi" aşamasında açılan kartların dosyası bu yüzden yerinde kalmaz. */
    const eskiKlasor = ASAMA_KLASORU[onceki.get(String(j.id))];
    const yeniKlasor = ASAMA_KLASORU[j.asama];
    if (!yeniKlasor) return false;              // bu aşamanın klasör karşılığı yok — dokunma
    return eskiKlasor !== yeniKlasor;           // hedef değişmediyse yapacak iş yok
  });
  if (degisenler.length === 0) return [];

  const sonuclar = [];
  /* TOPLAM SÜRE SINIRI. Taşıma, kaydın yanıtı gönderilmeden önce çalışıyor; tek tek çağrılar
   * sınırlı olsa da aynı anda 10 iş aşama değiştirirse toplam süre kabul edilemez olur.
   * Süre dolunca kalanlar taşınmaz ama SESSİZ KALINMAZ — sebep geçmişe yazılır. */
  const BITIS = Date.now() + 20000;
  for (const is of degisenler) {
    if (Date.now() > BITIS) {
      sonuclar.push({ isId: is.id, tasindi: false, sebep: "süre sınırı doldu, bu iş taşınmadı" });
      continue;
    }
    const marka = ((sonrakiVeri.clients || []).find((c) => trKucult(c.ad) === trKucult(is.marka)) || {});
    const markaKlasoru = marka.driveOnayKlasoru || "";
    /* BU MARKA İÇİN DRIVE HİÇ KURULMAMIŞSA SESSİZ GEÇ.
     *
     * Kurulmamış bir şeyin "çalışmadığını" her aşama değişiminde geçmişe yazmak gürültüdür;
     * Drive kullanmayan bir markanın kartı sistem notlarıyla dolar ve gerçek notlar kaybolur.
     * Not yalnızca kullanıcı o marka için Drive'ı KURDUĞUNDA anlamlıdır — o zaman "neden
     * taşınmadı" gerçek bir sorudur ve cevabı görünür olmalıdır. */
    if (!markaKlasoru && !process.env.DRIVE_ONAY_KLASOR_ID) continue;

    const link = is.editliDosyaLink || is.dosyaLinki || is.hamDosyaLink || "";
    /* Bağlantı yokken SESSİZ KALMA. Eskiden burada koşulsuz `continue` vardı: taşıma
     * denenmiyor ve geçmişe hiçbir not düşülmüyordu. Kullanıcı "neden taşınmadı" sorusunun
     * cevabını hiçbir yerde bulamıyordu — bu bir kez gerçek bir teşhis saatine mal oldu. */
    if (!link) {
      sonuclar.push({ isId: is.id, tasindi: false, sebep: "kartta dosya bağlantısı yok" });
      continue;
    }
    const sonuc = await onaylananiTasi({
      dosyaLinki: link, markaAdi: is.marka,
      markaKlasoru, hedefAd: ASAMA_KLASORU[is.asama],
    });
    sonuclar.push({ isId: is.id, ...sonuc });
  }
  return sonuclar;
}

/**
 * "Teslim Edildi"ye yeni geçen işlerin dosyalarını taşır ve sonucu işin geçmişine yazar.
 *
 * NEDEN AYRI FONKSİYON: bu iş hem personel hem yönetici kayıt yolunda yapılmalı. Daha önce
 * yalnızca personel yolunda çağrılıyordu; yönetici (asıl kullanıcı) kaydettiğinde taşıma
 * hiç tetiklenmiyor, üstelik hiçbir iz de bırakmıyordu. İki kopya yazmak yerine tek yerden
 * çağrılıyor ki bir daha ayrışmasın.
 *
 * KİLİT UYARISI: guvenliGuncelle kendi yazma kilidini alır. Bu yüzden bu fonksiyon ASLA
 * açık bir kilidin içinden çağrılmamalıdır — çağrılırsa kilit alınamaz ve not düşülemez.
 *
 * SÜRÜM UYARISI — BURASI VERİ KAYBI ÜRETMİŞTİ: not düşmek İKİNCİ bir yazmadır ve _v sayacını
 * bir daha artırır. Çağıran taraf yanıtta hâlâ ilk yazmanın _v'sini döndürürse, tarayıcı bir
 * tur geride kalır; sonraki kayıt sahte "staleConflict" alır ve ön yüz kullanıcının o anki
 * düzenlemesini sunucu verisiyle ezer. Bu yüzden yazılan SON hâl döndürülür ve yanıtta onun
 * _v'si kullanılmalıdır.
 *
 * ASLA HATA FIRLATMAZ: taşıma da not düşme de başarısız olsa asıl kayıt geçerli kalır.
 * Not düşülmediyse null döner — o zaman çağıranın elindeki _v zaten günceldir.
 */
async function tasimalariIsleVeNotDus(oncekiVeri, sonrakiVeri) {
  try {
    const tasimalar = await asamayaGoreTasi(oncekiVeri || {}, sonrakiVeri || {});
    if (tasimalar.length === 0) return null;
    const notSonucu = await guvenliGuncelle((guncel) => ({
      veri: {
        ...guncel,
        cekimIsleri: (guncel.cekimIsleri || []).map((j) => {
          const t = tasimalar.find((x) => String(x.isId) === String(j.id));
          if (!t) return j;
          return { ...j, gecmis: [...(j.gecmis || []), {
            id: (j.gecmis || []).length + 1,
            tarih: new Date().toLocaleString("tr-TR"),
            yazan: "Sistem",
            /* zatenOrada bir HATA DEĞİL: dosya olması gereken yerde. Bunu "yapılamadı"
             * diye yazmak kullanıcıyı olmayan bir sorunla uğraştırır. */
            aciklama: t.tasindi
              ? `Dosya Drive'da "${t.klasor}" klasörüne taşındı.`
              : t.zatenOrada
                ? `Dosya zaten "${t.klasor}" klasöründe.`
                : `Drive taşıma yapılamadı: ${t.sebep}`,
          }] };
        }),
      },
    }));
    return notSonucu && notSonucu.ok ? notSonucu.veri : null;
  } catch (e) {
    /* Taşıma ya da not düşme çökerse kaydın kendisi zarar görmemeli. */
    return null;
  }
}

export default async function handler(req, res) {
  /* KİLİT AÇMA, hız sınırının ÖNÜNDE çalışır — aksi halde kısır döngü olurdu: kilitliyken
   * kilidi açma isteği de engellenirdi. Erişim vermez, sadece sayacı sıfırlar ve yönetici
   * şifresi ister.
   *
   * Bunun sınırsız bir şifre deneme kapısına dönüşmemesi için AYRI ve çok daha dar bir
   * sayaç kullanılır: saatte 5 hatalı deneme. */
  if (req.method === "POST" && req.body && req.body.authAction === "kilidiAc") {
    const ownerPw = process.env.SITE_PASSWORD;
    const acmaKey = `unlock-fail-${istekIP(req)}`;
    let acmaSayac = 0;
    try { acmaSayac = (await kv.get(acmaKey)) || 0; } catch (e) { acmaSayac = 0; }
    if (acmaSayac >= 5) {
      return res.status(429).json({ error: "Kilit açma da geçici olarak durduruldu. 1 saat sonra tekrar dene." });
    }
    if (ownerPw && (!req.body.sifre || !esitMi(req.body.sifre, ownerPw))) {
      try { await kv.set(acmaKey, acmaSayac + 1, { ex: 3600 }); } catch (e) { /* kritik değil */ }
      return res.status(401).json({ error: "Şifre hatalı." });
    }
    await basariliGirisiSifirla(req);
    try { await kv.del(acmaKey); } catch (e) { /* kritik değil */ }
    return res.status(200).json({ ok: true });
  }

  /* HIZ SINIRI — SADECE GİRİŞ DENEMELERİNE UYGULANIR.
   *
   * TASARIM HATASI DÜZELTİLDİ: Bu kontrol eskiden HER isteğin başında, kimlik
   * doğrulamasından ÖNCE çalışıyordu. Sonuç: sayaç bir kez dolduğunda, geçerli oturumu olan
   * kullanıcı da dahil herkes 15 dakika boyunca dışarıda kalıyordu — uygulama tamamen
   * kullanılamaz hâle geliyor ve "Verilerine ulaşılamadı" ekranı çıkıyordu. Üstelik kilidi
   * açma bağlantısı yalnızca giriş ekranında göründüğü için, zaten girmiş olan kullanıcının
   * ona ulaşma yolu da yoktu.
   *
   * Doğrusu: hız sınırı brute-force denemelerini durdurmalı, kimliği DOĞRULANMIŞ kullanıcıyı
   * değil. Bu yüzden artık yalnızca giriş denemelerinde (authAction POST) uygulanıyor;
   * normal isteklerde ise kimlik doğrulanamazsa aşağıda uygulanıyor. */
  if (req.method === "POST" && req.body && req.body.authAction && await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }

  /* ---------------------------------------------------------------- *
   * GİRİŞ AKIŞI (oturum + iki adımlı doğrulama)
   * Yeni bir api dosyası açmamak için buraya "authAction" olarak eklendi.
   * Bu blok resolveRole'den ÖNCE çalışır, çünkü giriş yapan kişinin henüz oturumu yoktur.
   * ---------------------------------------------------------------- */
  if (req.method === "POST" && req.body && req.body.authAction) {
    const { authAction, sifre, kod, hatirla } = req.body;
    const ownerPw = process.env.SITE_PASSWORD;

    // Adım 1: şifre kontrolü. Doğruysa ya kod gönderilir ya da doğrudan oturum açılır.
    if (authAction === "girisBasla") {
      if (!ownerPw) {
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false });
      }
      if (!sifre || !esitMi(sifre, ownerPw)) {
        await basarisizGirisiKaydet(req);
        await deftereYaz("giris-basarisiz", { ip: istekIP(req) });
        return res.status(401).json({ error: "Şifre hatalı." });
      }
      if (!ikiAdimliAktifMi()) {
        // E-posta doğrulaması yapılandırılmamış — kilitlenmeyi önlemek için doğrudan giriş.
        await basariliGirisiSifirla(req);
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false });
      }
      await deftereYaz("giris-basarili", { rol: "owner", ip: istekIP(req) });
      const sonuc = await girisKoduGonder(req.headers["x-forwarded-for"] || null);
      if (!sonuc.gonderildi) {
        // E-posta gönderilemedi — sistemden tamamen kilitlenme, şifreyle devam et.
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false, uyari: `Kod e-postası gönderilemedi (${sonuc.sebep || "sebep bilinmiyor"}), bu yüzden kod adımı atlandı.` });
      }
      return res.status(200).json({ ok: true, kodGerekli: true });
    }

    // Adım 2: e-postaya gelen kodun doğrulanması.
    if (authAction === "kodDogrula") {
      if (ownerPw && (!sifre || !esitMi(sifre, ownerPw))) {
        await basarisizGirisiKaydet(req);
        return res.status(401).json({ error: "Şifre hatalı." });
      }
      if (!(await koduDogrula(kod))) {
        await basarisizGirisiKaydet(req);
        return res.status(401).json({ error: "Kod hatalı ya da süresi dolmuş." });
      }
      const { token, sure } = await oturumAc(!!hatirla);
      return res.status(200).json({ ok: true, token, sure });
    }

    // Bu cihazdan çıkış.
    if (authAction === "cikis") {
      await oturumKapat(req.headers["x-oturum"]);
      return res.status(200).json({ ok: true });
    }

    // Tüm cihazlardan çıkış — sadece yetkili yapabilir.
    if (authAction === "tumCihazlardanCikis") {
      await deftereYaz("tum-oturumlar-iptal", { ip: istekIP(req) });
      const yetkili = (req.headers["x-oturum"] && (await oturumGecerliMi(req.headers["x-oturum"])))
        || (ownerPw && esitMi(baslikOku(req, "x-site-password"), ownerPw));
      if (!yetkili) return res.status(401).json({ error: "Yetkisiz." });
      await tumOturumlariIptalEt();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Geçersiz giriş işlemi." });
  }

  const auth = await resolveRole(req);
  // Kimlik doğrulandıysa hatalı deneme sayacını temizle — yoksa eski denemeler geçerli
  // girişleri de engellemeye devam ederdi.
  if (auth) {
    await basariliGirisiSifirla(req);
  } else if (await rateLimitAsildiMi(req)) {
    // Kimliği doğrulanamayan isteklerde hız sınırı burada devreye girer. Geçerli oturumu
    // olan kullanıcı bu noktaya hiç gelmez, dolayısıyla kilitlenemez.
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }
  if (!auth) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  }
  const { role, staffId, staffName, staffPerms, staffEmail, staffMarkalar, musteriId, musteriClientId, musteriAd } = auth;

  // Müşteri Paneli — tamamen izole bir akış. Owner/personel akışının hiçbir parçasına
  // dokunmaz; müşteri SADECE kendi marka bilgisine ve SADECE kendi içerik onaylarına erişebilir.
  /* ---------------------------------------------------------------------------------
   * KART İÇİNDEN DOSYA YÜKLEME
   *
   * Üç uç: oturum aç, tamamla, iptal. Yeni bir api/ dosyası AÇILMADI — Vercel Hobby planı
   * en fazla 12 sunucu fonksiyonuna izin veriyor ve 11'i dolu. Bu sınır bir kez aşıldı ve
   * derleme kırıldı (v120), tekrarlanmamalı.
   *
   * DOSYANIN KENDİSİ BURADAN GEÇMEZ. Sunucu yalnızca Google'dan bir yükleme adresi alıp
   * tarayıcıya verir; baytlar tarayıcıdan doğrudan Google'a gider. Vercel'in ~4.5 MB istek
   * sınırı bu yüzden devrede değil.
   * --------------------------------------------------------------------------------- */
  if (req.method === "POST" && req.body && req.body.driveAction) {
    /* Yükleme, iş kartı üzerinde çalışmayı gerektirir — müşteri hesapları buraya giremez.
     * Personelde ayrıca cekimEdit izni aranır; marka kilidi olan hesap yalnızca kendi
     * markasına yükleyebilir. */
    if (role !== "owner" && role !== "staff") return res.status(403).json({ error: "Yetkin yok." });

    const { driveAction, isId, dosyaAdi, mimeTur, boyut, dosyaId } = req.body;
    const veri = (await kv.get(KEY)) || {};

    /* İzinler BU BLOKTA hesaplanıyor. Diğer bloklardaki perms/izinli kendi kapsamlarında
     * tanımlı — buradan görünmüyorlar ve referans vermek çalışma anında çöktürüyordu. */
    let izinli = [];
    if (role === "staff") {
      const perms = izinleriDaralt(
        staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...(veri.staffPermissions || {}) },
        Array.isArray(staffMarkalar) && staffMarkalar.length > 0,
      );
      if (perms.cekimEdit !== true) return res.status(403).json({ error: "Yetkin yok." });
      izinli = Array.isArray(staffMarkalar) ? staffMarkalar : [];
    }
    const is = (veri.cekimIsleri || []).find((j) => String(j.id) === String(isId));
    if (!is) return res.status(404).json({ error: "İş kartı bulunamadı." });
    if (role === "staff" && izinli.length > 0 && !izinli.some((m) => trKucult(m) === trKucult(is.marka))) {
      return res.status(403).json({ error: "Bu markaya erişim yetkin yok." });
    }

    if (driveAction === "yuklemeBasla") {
      if (!yuklemeHazirMi()) {
        return res.status(400).json({ error: "Drive yükleme kurulu değil. Ayarlardaki Google bağlantısını tamamla." });
      }
      const marka = (veri.clients || []).find((c) => trKucult(c.ad) === trKucult(is.marka)) || {};
      /* Sıradaki versiyon numarası SUNUCUDA hesaplanır — tarayıcıdan gelen sayıya güvenilmez,
       * iki kişi aynı anda yüklerse aynı numarayı gönderirdi. */
      const versiyon = ((is.medya || []).reduce((e, m) => Math.max(e, Number(m.versiyon) || 0), 0)) + 1;
      const sonuc = await yuklemeOturumuAc({
        markaKlasoru: marka.driveOnayKlasoru || "", markaAdi: is.marka,
        icerikAdi: is.icerikTuru || "", versiyon, orijinalAd: dosyaAdi, mimeTur, boyut,
      });
      if (!sonuc.ok) return res.status(400).json({ error: sonuc.sebep });
      return res.status(200).json({ ok: true, ...sonuc, versiyon });
    }

    if (driveAction === "yuklemeBitti") {
      if (!dosyaId) return res.status(400).json({ error: "dosyaId eksik." });
      const bilgi = await yuklemeyiTamamla({ dosyaId });
      if (!bilgi.ok) {
        /* Yetki verilemediyse dosya Drive'da öksüz kalır ve sonraki taşımalar çalışmaz.
         * Yarım işi bırakmaktansa temizleyip hatayı bildirmek doğru. */
        await yuklenenDosyayiSil(dosyaId);
        return res.status(400).json({ error: bilgi.sebep });
      }
      /* BURADA KV'YE YAZILMIYOR — bilerek.
       *
       * Yazsaydık _v sayacı artardı ama tarayıcı bunu bilmezdi; bir sonraki kaydı sahte
       * "staleConflict" alır ve ön yüz kullanıcının o anki düzenlemesini sunucu verisiyle
       * ezerdi. Bu hata bu projede bir kez yaşandı, veri kaybı üretti.
       *
       * Bunun yerine dosya bilgisi tarayıcıya döndürülür ve kayıt uygulamanın NORMAL kayıt
       * akışından geçer — sürüm sayacı orada zaten doğru yönetiliyor.
       *
       * Tarayıcı arada kapanırsa dosya Drive'da doğru klasörde durur, sadece karta
       * işlenmemiş olur; kaybolmaz. */
      return res.status(200).json({ ok: true, dosya: bilgi });
    }

    if (driveAction === "yuklemeIptal") {
      if (dosyaId) await yuklenenDosyayiSil(dosyaId);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  }

  if (role === "musteri") {
    try {
      const data = (await kv.get(KEY)) || {};
      const kendiMarka = (data.clients || []).find((c) => String(c.id) === String(musteriClientId));

      // Marka silinmiş ya da dondurulmuşsa, panele hiç giriş yapılamaz — hesap var olsa bile
      // "kullanım dışı" sayılır. Silme durumunda ayrıca deleteClient tarafında hesabın
      // kendisi de otomatik siliniyor; bu kontrol dondurma durumunu ve olası gecikmeleri kapsar.
      if (!kendiMarka || kendiMarka.durum === "donduruldu") {
        return res.status(403).json({ error: "Bu hesap şu anda kullanım dışı. Sorularınız için ajansınızla iletişime geçin." });
      }

      /* Görünüm ORTAK fonksiyondan üretilir (lib/musteri-gorunumu.js).
       * Çözüm ortağının "Marka Paneli" ekranı da aynı fonksiyonu çağırır; böylece müşteri
       * ne görüyorsa ortak da birebir aynısını görür ve ikisi hiçbir zaman ayrışamaz. */
      const gorunum = musteriGorunumuUret(data, kendiMarka, markaEslestirici);

      if (req.method === "GET") {
        return res.status(200).json({ role: "musteri", musteriAd, ...gorunum });
      }

      if (req.method === "POST") {
        const { musteriAction, icerikId, isId, revizeNotu, talep } = req.body || {};

        /* İÇERİK TALEBİ — müşteri panelinden gelen istek.
         *
         * Talep DOĞRUDAN Operasyon'a düşmez; önce yöneticinin Planım onay kutusuna gider.
         * Yönetici onaylayınca "Talep Alındı" aşamasında bir Operasyon kartına dönüşür —
         * yani her talep bir işe dönüşmeden önce süzülür.
         *
         * AÇIK TALEP SINIRI 3: sınırsız olsaydı pano şişer ve gerçekten acil olan kaybolurdu.
         * Sayım yalnızca bekleyen talepleri kapsar; onaylanan/reddedilen sayılmaz. */
        if (musteriAction === "talepOlustur") {
          const t = talep || {};
          if (!t.tur || !String(t.aciklama || "").trim()) {
            return res.status(400).json({ error: "Tür ve açıklama zorunlu." });
          }
          const sonucTalep = await guvenliGuncelle((guncel) => {
            const liste = guncel.musteriTalepleri || [];
            const acikSayi = liste.filter((x) => String(x.clientId) === String(musteriClientId) && x.durum === "bekliyor").length;
            if (acikSayi >= 3) {
              return { iptal: true, hata: "Aynı anda en fazla 3 açık talebin olabilir. Mevcut talepler sonuçlanınca yenisini gönderebilirsin.", kod: 409 };
            }
            const yeniId = liste.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
            return {
              veri: {
                ...guncel,
                musteriTalepleri: [...liste, {
                  id: yeniId,
                  clientId: musteriClientId,          // sunucudan gelir, tarayıcıdan DEĞİL
                  tur: String(t.tur).slice(0, 40),
                  aciklama: String(t.aciklama).trim().slice(0, 2000),
                  neZaman: String(t.neZaman || "").slice(0, 20),
                  referans: String(t.referans || "").trim().slice(0, 500),
                  dosyalar: Array.isArray(t.dosyalar) ? t.dosyalar.slice(0, 5).map((d) => ({
                    ad: String(d.ad || "").slice(0, 200),
                    baglanti: String(d.baglanti || "").slice(0, 400),
                  })) : [],
                  acil: t.acil === true,
                  durum: "bekliyor",
                  tarih: new Date().toLocaleString("tr-TR"),
                }],
              },
            };
          });
          if (!sonucTalep.ok) return res.status(sonucTalep.kod || 409).json({ error: sonucTalep.hata || "Talep kaydedilemedi." });
          return res.status(200).json({ ok: true });
        }

        if (musteriAction !== "onayla" && musteriAction !== "revizeIste") {
          return res.status(400).json({ error: "Geçersiz işlem." });
        }
        if (musteriAction === "revizeIste" && (!revizeNotu || !revizeNotu.trim())) {
          return res.status(400).json({ error: "Revize notu boş olamaz." });
        }

        /* HAZIR İÇERİK (Operasyon kartı) üzerinde işlem — isId gönderildiğinde.
         * Bu kartlar müşteri paneline kopyalanmıyor, canlı yansıtılıyor; dolayısıyla onay ve
         * revize doğrudan Operasyon kartının aşamasını değiştirir:
         *   onayla     → "Onaylandı"   (teslim adımı ekipte kalır)
         *   revizeIste → "Revize İstendi" + notu işin geçmişine yazılır
         * Her iki durumda da iş "Kontrol Bekliyor"dan çıktığı için müşteri panelinden
         * kendiliğinden kaybolur — ayrıca bir temizlik gerekmez. */
        if (isId !== undefined && isId !== null) {
          /* guvenliGuncelle, geri dönüşte { veri } bekler — doğrudan veriyi döndürmek
           * kaydı bozar. İzin verilmeyen durumlarda { iptal: true } döndürülür. */
          const sonucIs = await guvenliGuncelle((guncel) => {
            const isler = guncel.cekimIsleri || [];
            const hedef = isler.find((j) => String(j.id) === String(isId));
            if (!hedef) return { iptal: true, hata: "Kart bulunamadı.", kod: 404 };

            // Güvenlik: müşteri yalnızca KENDİ markasının ve yalnızca Kontrol Bekliyor'daki
            // bir kartına dokunabilir.
            const markaAdiKendi = ((guncel.clients || []).find((c) => String(c.id) === String(musteriClientId)) || {}).ad || "";
            if (trKucult(hedef.marka) !== trKucult(markaAdiKendi)) {
              return { iptal: true, hata: "Bu içeriğe erişim yetkin yok.", kod: 403 };
            }
            if (hedef.asama !== "Kontrol Bekliyor") {
              return { iptal: true, hata: "Bu içerik artık onayını beklemiyor. Sayfayı yenile.", kod: 409 };
            }

            const zaman = new Date().toLocaleString("tr-TR");
            const yeniAsama = musteriAction === "onayla" ? "Onaylandı" : "Revize İstendi";
            const not = musteriAction === "onayla"
              ? "Müşteri paneli üzerinden ONAYLANDI."
              : `Müşteri revize istedi: "${revizeNotu.trim()}"`;
            /* REVİZE SAYACI — kaçıncı tur olduğu kartın üstünde saklanır.
             * Eskiden bu bilgi yalnızca işlem geçmişinde satır satır duruyordu; "bu içerik
             * kaç kez revize edildi?" sorusu ancak geçmiş okunarak cevaplanabiliyordu.
             * Dördüncü tura giden bir içerik brief'in ya da beklentinin sorunlu olduğunu
             * gösterir — bu yüzden sayı olarak tutuluyor. */
            const yeniSayi = musteriAction === "revizeIste" ? (Number(hedef.revizeSayisi) || 0) + 1 : (Number(hedef.revizeSayisi) || 0);
            return {
              veri: {
                ...guncel,
                cekimIsleri: isler.map((j) => (String(j.id) === String(isId)
                  ? {
                      ...j,
                      asama: yeniAsama,
                      musteriRevizeNotu: musteriAction === "revizeIste" ? revizeNotu.trim() : null,
                      revizeSayisi: yeniSayi,
                      gecmis: [...(j.gecmis || []), { id: (j.gecmis || []).length + 1, tarih: zaman, yazan: "Müşteri", aciklama: not }],
                    }
                  : j)),
              },
              ek: { hedefIs: hedef, yeniSayi },
            };
          });
          if (!sonucIs.ok) {
            return res.status(sonucIs.kod || 409).json({ error: sonucIs.hata || "Kaydedilemedi, sayfayı yenileyip tekrar dene." });
          }

          /* ONAYLANAN DOSYAYI DRIVE'DA TAŞI.
           *
           * Müşteri onayladığında işin dosyası "Onaylananlar" klasörüne (marka alt klasörüne)
           * taşınır; ekip Drive'da da neyin yayına hazır olduğunu görür.
           *
           * TAŞIMA ASLA ONAYI ENGELLEMEZ: Drive kurulu değilse, yetki yoksa ya da bağlantı
           * koparsa onay yine geçerlidir. Sonuç işin geçmişine not olarak düşülür ki sessizce
           * kaybolmasın. */
          /* MÜŞTERİ İŞLEMİ SONRASI DRIVE TAŞIMA.
           *
           * Onay "Onaylandı", revize "Revize İstendi" aşamasına geçirir; her ikisinin de bir
           * Drive klasörü karşılığı var. Yönetici/personel kaydıyla AYNI fonksiyon kullanılır
           * — burada ikinci bir kopya tutulursa zamanla ayrışır ve müşteri onayı ile ekip
           * işaretlemesi farklı davranmaya başlar.
           *
           * TAŞIMA ASLA ONAYI ENGELLEMEZ: Drive kurulu değilse, yetki yoksa ya da bağlantı
           * koparsa onay yine geçerlidir; sonuç işin geçmişine not düşülür. */
          if (sonucIs.ok) {
            await tasimalariIsleVeNotDus(sonucIs.oncekiVeri, sonucIs.veri);
          }

          /* ATANAN KİŞİYE OTOMATİK BİLDİRİM.
           *
           * Eskiden revize geldiğinde kimseye haber gitmiyordu; kart Operasyon'da sütun
           * değiştiriyor ama atanan kişi panele bakmadıkça bunu bilmiyordu. Elle "Durum
           * Bildirimi Gönder" düğmesi vardı, yani yöneticinin hatırlamasına bağlıydı.
           *
           * Gönderim BAŞARISIZ OLSA BİLE revize kaydı geçerlidir — bu yüzden yanıt
           * beklenmeden, hata yutularak yapılır. E-posta, kaydın önüne geçmemeli. */
          if (musteriAction === "revizeIste" && sonucIs.ek && sonucIs.ek.hedefIs) {
            const is = sonucIs.ek.hedefIs;
            const guncelVeri = sonucIs.veri || {};
            const hesaplar = guncelVeri.personelHesaplari || [];
            const adlar = [is.editor, is.kameraman].filter(Boolean).map((x) => String(x).trim().toLocaleLowerCase("tr"));
            const alicilar = [...new Set(hesaplar
              .filter((h) => h.email && adlar.includes(String(h.ad || "").trim().toLocaleLowerCase("tr")))
              .map((h) => h.email))];
            const html = revizeBildirimHtml({
              marka: is.marka, icerikTuru: is.icerikTuru, not: revizeNotu.trim(),
              revizeSayisi: sonucIs.ek.yeniSayi, firmaAdi: guncelVeri.firmaAdi,
            });
            const konu = `Revize istendi — ${is.marka || ""} · ${is.icerikTuru || "İçerik"}`;
            // Kimse atanmamışsa yönetici haberdar olsun ki iş sahipsiz kalmasın.
            const hedefler = alicilar.length > 0 ? alicilar : [process.env.OWNER_EMAIL].filter(Boolean);
            await Promise.all(hedefler.map((e) => epostaGonder(e, konu, html))).catch(() => {});
          }

          return res.status(200).json({ ok: true });
        }

        // Kilit altında, EN GÜNCEL veri üzerinde çalışılır — eskiden yukarıda okunan
        // (bu noktada bayatlamış olabilecek) kopya yazıldığı için, arada ekibin yaptığı
        // değişiklikler silinebiliyordu.
        const sonuc = await guvenliGuncelle(async (guncel) => {
          const liste = guncel.musteriIcerikleri || [];
          const icerik = liste.find((i) => i.id === icerikId && String(i.clientId) === String(musteriClientId));
          if (!icerik) return { iptal: true, hata: "İçerik bulunamadı.", kod: 404 };

          const yeni = { ...guncel };
          if (musteriAction === "onayla") {
            // onaylayan: "Müşteri" — yönetici de müşteri adına onaylayabildiği için (müşteri
            // unuttuğunda iş takılı kalmasın diye), onayın kimden geldiği kaydediliyor.
            yeni.musteriIcerikleri = liste.map((i) => (i.id === icerikId ? { ...i, durum: "onaylandi", revizeNotu: null, onaylayan: "Müşteri", yanitTarihi: new Date().toLocaleDateString("tr-TR") } : i));

            /* NOT: Müşteri bir çekim planını onayladığında Operasyon'da iş OTOMATİK AÇILMAZ.
             * İş, yöneticinin Planım > Onay Kutusu'ndan onaylamasıyla ve orada yaptığı
             * atamalarla (kim yapacak, hangi aşamada başlayacak) açılır. Böylece panoya
             * kimsenin üstünde olmayan, aşaması yanlış işler düşmez. */

            // Bağlı bir Operasyon işi varsa (Kontrol Bekliyor'dan otomatik düşmüşse), müşteri
            // onaylayınca o iş de "Teslim Edildi" olarak işaretlenir — döngü kapanır.
            //
            // ÇEKİM PLANLARI HARİÇ: bir çekim planının onaylanması "iş bitti" demek değil,
            // "çekime başlayabiliriz" demektir. Bu ayrım olmasaydı, revize sonrası tekrar
            // onaylanan bir plan, çekim hiç yapılmadan "Teslim Edildi"ye atlardı.
            if (icerik.tur !== "cekim" && icerik.kaynakIsId && yeni.cekimIsleri) {
              yeni.cekimIsleri = yeni.cekimIsleri.map((j) => {
                if (j.id !== icerik.kaynakIsId) return j;
                const not = { id: (j.gecmis || []).length + 1, tarih: new Date().toLocaleString("tr-TR"), yazan: "Müşteri", aciklama: "Müşteri içeriği onayladı." };
                // Aylık İş Raporu bu tarihe göre sayıyor — müşteri onayıyla teslim edilen
                // işler de sayıma girsin diye burada da kaydediliyor.
                return { ...j, asama: "Teslim Edildi", teslimEdilmeTarihi: new Date().toISOString().slice(0, 10), gecmis: [...(j.gecmis || []), not] };
              });
            }
          } else {
            // operasyonaAktarildi sıfırlanır — bu YENİ bir revize isteği, yöneticinin onay
            // kutusunda tekrar görünmeli (önceki istek aktarılmış olsa bile).
            yeni.musteriIcerikleri = liste.map((i) => (i.id === icerikId ? { ...i, durum: "revize", revizeNotu: revizeNotu.trim(), operasyonaAktarildi: false, yanitTarihi: new Date().toLocaleDateString("tr-TR") } : i));
            // Bağlı bir Operasyon işi varsa, otomatik olarak "Revize İstendi" aşamasına döner ve
            // müşterinin notu işin geçmişine düşer — ekip ekstra bir yere bakmadan görsün.
            if (icerik.kaynakIsId && yeni.cekimIsleri) {
              yeni.cekimIsleri = yeni.cekimIsleri.map((j) => {
                if (j.id !== icerik.kaynakIsId) return j;
                const not = { id: (j.gecmis || []).length + 1, tarih: new Date().toLocaleString("tr-TR"), yazan: "Müşteri", aciklama: `Müşteri revize istedi: "${revizeNotu.trim()}"` };
                return { ...j, asama: "Revize İstendi", gecmis: [...(j.gecmis || []), not] };
              });
            }
          }
          return { veri: yeni };
        });

        if (!sonuc.ok) return res.status(sonuc.kod || 400).json({ error: sonuc.hata || "İşlem yapılamadı." });
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: "Desteklenmeyen istek." });
    } catch (e) {
      return res.status(500).json({ error: "Sunucu hatası: " + e.message });
    }
  }

  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);

      /* ÇÖZÜM ORTAĞI — MARKA PANELİ
       *
       * Ortak, kendisine atanmış bir markanın panelini müşterinin gördüğü HÂLİYLE görür.
       * Görünüm kopyalanmaz: müşteri paneliyle AYNI fonksiyondan (musteriGorunumuUret)
       * üretilir, böylece ikisi hiçbir zaman ayrışamaz.
       *
       * Güvenlik: istenen marka, hesabın kendi marka listesinde DEĞİLSE reddedilir. Liste
       * tarayıcıdan değil, sunucudaki hesap kaydından okunur (staffMarkalar) — yoksa kilit
       * kolayca aşılırdı. Marka kilidi olmayan bir hesap bu ekranı kullanamaz. */
      if (role === "staff" && req.query && req.query.markaPaneli) {
        const perms = izinleriDaralt(
          staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...((data && data.staffPermissions) || {}) },
          Array.isArray(staffMarkalar) && staffMarkalar.length > 0,
        );
        if (perms.musteriAkisi !== true) {
          return res.status(403).json({ error: "Bu ekran için yetkin yok." });
        }
        const izinli = Array.isArray(staffMarkalar) ? staffMarkalar : [];
        if (izinli.length === 0) {
          return res.status(403).json({ error: "Bu ekran yalnızca belirli markalara atanmış hesaplar içindir." });
        }
        const hedefMarka = (data.clients || []).find((c) => String(c.id) === String(req.query.markaPaneli));
        if (!hedefMarka || !izinli.some((m) => trKucult(m) === trKucult(hedefMarka.ad))) {
          return res.status(403).json({ error: "Bu markaya erişimin yok." });
        }
        return res.status(200).json({
          ok: true,
          markaPaneli: musteriGorunumuUret(data, hedefMarka, markaEslestirici),
          markalarim: (data.clients || [])
            .filter((c) => izinli.some((m) => trKucult(m) === trKucult(c.ad)))
            .map((c) => ({ id: c.id, ad: c.ad })),
        });
      }

      if (role === "staff") {
        // Kişiye özel hesapla girildiyse o hesabın kendi izinleri kullanılır; eski ortak
        // personel şifresiyle (STAFF_PASSWORD) girildiyse genel (herkes için ortak) izinler kullanılır.
        const hamPerms = staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...((data && data.staffPermissions) || {}) };
        // Marka kilitli hesapta ajans geneli bölümler (Finans, Personel, Dashboard...) izin
        // verilmiş olsa bile kapatılır — o bölümlerin verisi markaya göre süzülemez.
        const perms = izinleriDaralt(hamPerms, Array.isArray(staffMarkalar) && staffMarkalar.length > 0);
        // _v (versiyon sayacı) personele de gönderilir — eskiden gönderilmediği için
        // personel kayıtlarında çakışma kontrolü hiç devreye giremiyordu ve bayat bir
        // personel sekmesi, arada yapılan değişikliklerin üzerine yazabiliyordu.
        const restricted = { staffPermissions: perms, firmaAdi: (data && data.firmaAdi) || "Marcus Medya", _v: (data && typeof data._v === "number") ? data._v : 0 };

        /* MARKA KİLİDİ: hesaba marka listesi tanımlıysa, veri daha izinlere dağıtılmadan
         * ÖNCE süzülür. Böylece hangi izin açık olursa olsun, o hesap başka markanın
         * verisini asla göremez. Kilitli hesaplardan reklam bütçesi ve müşteri finansalları
         * da temizlenir. */
        const izinliMarkalar = Array.isArray(staffMarkalar) ? staffMarkalar : [];
        const markaKilitliMi = izinliMarkalar.length > 0;
        restricted.markaKilidi = markaKilitliMi ? izinliMarkalar : null;
        const kaynak = icBilgiyiTemizle(markayaGoreSuz(data || {}, izinliMarkalar), markaKilitliMi);

        // Hangi izinler açıksa, o izne bağlı alanları gerçek veriyle dolduruyoruz.
        Object.entries(PERMISSION_DATA_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => { restricted[f] = (kaynak[f] !== undefined) ? kaynak[f] : DEFAULT_FIELD_VALUES[f]; });
        });

        // clients alanı: geniş kapsamlı bir izin varsa TAM veri, sadece paylasimlar/cekimEdit gibi
        // dar izinler varsa sadece marka kartları için isim/durum ile sınırlı veri gönderilir.
        const genisIzinVarMi = FULL_CLIENT_PERMS.some((p) => perms[p] === true);
        if (!genisIzinVarMi && restricted.clients) {
          restricted.clients = (kaynak.clients || []).map((c) => ({ id: c.id, ad: c.ad, durum: c.durum }));
        }

        // İş atarken/üyelik bilgisi gönderirken kime gönderdiğini seçebilmesi için
        // isim/e-posta listesi (giriş bilgisi YOK).
        if (perms.cekimEdit === true || perms.uyelikler === true) {
          restricted.personelRosteri = ((data && data.personelHesaplari) || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
        }

        return res.status(200).json({ data: restricted, role, staffId, staffName });
      }
      // Sahibe (owner) bile şifre hash'lerini asla gönderme — ayrı, korumalı bir uçtan yönetiliyor.
      /* Güvenlik defteri ayrı bir anahtarda tutuluyor ve yalnızca istendiğinde gönderilir —
       * her veri çekilişinde 500 kaydı taşımak gereksiz yük olurdu. */
      if (req.query && req.query.defter === "1") {
        return res.status(200).json({ defter: await defteriOku() });
      }
      const { personelHesaplari, kasaSifresiHash, kasaSifresiSalt, musteriHesaplari, ...safeData } = data || {};
      const personelRosteri = (personelHesaplari || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
      const musteriRosteri = (musteriHesaplari || []).map((h) => ({ id: h.id, clientId: h.clientId, ad: h.ad, kullaniciAdi: h.kullaniciAdi }));
      /* Güvenlik durumu — arayüz, iki adımlı doğrulamanın gerçekten açık olup olmadığını
       * ancak sunucudan öğrenebilir (ortam değişkenleri tarayıcıya gönderilmez). Bu bayrak
       * olmadan kullanıcı "kurdum" sanıp kapalı bir sistemle devam edebilirdi. */
      return res.status(200).json({
        data: data ? { ...safeData, personelRosteri, musteriRosteri } : null,
        role,
        /* Hangi değişkenin eksik olduğu AYRI AYRI raporlanır. Tek bir "kapalı" bilgisi,
         * OWNER_EMAIL mi RESEND_API_KEY mi eksik ayırt edilemediği için teşhis ettirmiyordu. */
        guvenlik: {
          ikiAdimliAktif: ikiAdimliAktifMi(),
          ownerEmailVar: !!process.env.OWNER_EMAIL,
          resendVar: !!process.env.RESEND_API_KEY,
          yedekEpostaSayisi: String(process.env.BACKUP_EMAIL || "").split(",").filter((x) => x.trim()).length,
          /* Ortak personel şifresi (STAFF_PASSWORD) tanımlı mı? Tanımlı DEĞİLSE "Genel
           * Yetkiler" kartının hiçbir etkisi yoktur — herkes kişisel hesabıyla girer ve
           * kendi yetkileri geçerlidir. Bu bayrak olmadan kart boşuna ayarlanabilirdi. */
          ortakSifreAktif: !!process.env.STAFF_PASSWORD,
        },
      });
    }

    /* ÇÖZÜM ORTAĞI — İŞ YÜRÜTME
     *
     * Ortak, atandığı markanın işini ilerletebilir ama müşteri adına ONAY/REVİZE veremez.
     * Bu yüzden yalnızca TEK bir geçişe izin var: "Revize İstendi" → "Kontrol Bekliyor",
     * yani "düzeltmeyi bitirdim, müşteri tekrar baksın". Başka bir aşamaya atlamak ya da
     * müşterinin kararını taklit etmek mümkün değil.
     *
     * Marka listesi sunucudaki hesap kaydından okunur; tarayıcının gönderdiğine güvenilmez. */
    if (req.method === "POST" && req.body && req.body.ortakAction) {
      if (role !== "staff") return res.status(403).json({ error: "Yetkin yok." });
      const mevcutVeri = (await kv.get(KEY)) || {};
      const perms = izinleriDaralt(
        staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...(mevcutVeri.staffPermissions || {}) },
        Array.isArray(staffMarkalar) && staffMarkalar.length > 0,
      );
      const izinli = Array.isArray(staffMarkalar) ? staffMarkalar : [];
      if (perms.musteriAkisi !== true || izinli.length === 0) {
        return res.status(403).json({ error: "Bu işlem için yetkin yok." });
      }
      if (req.body.ortakAction !== "asamaIlerlet" || req.body.hedefAsama !== "Kontrol Bekliyor") {
        return res.status(400).json({ error: "Geçersiz işlem." });
      }
      const sonucOrtak = await guvenliGuncelle((guncel) => {
        const isler = guncel.cekimIsleri || [];
        const hedef = isler.find((j) => String(j.id) === String(req.body.isId));
        if (!hedef) return { iptal: true, hata: "Kart bulunamadı.", kod: 404 };
        if (!izinli.some((m) => trKucult(m) === trKucult(hedef.marka))) {
          return { iptal: true, hata: "Bu markaya erişimin yok.", kod: 403 };
        }
        if (hedef.asama !== "Revize İstendi") {
          return { iptal: true, hata: "Bu kart revize aşamasında değil.", kod: 409 };
        }
        const zaman = new Date().toLocaleString("tr-TR");
        return {
          veri: {
            ...guncel,
            cekimIsleri: isler.map((j) => (String(j.id) === String(req.body.isId)
              ? { ...j, asama: "Kontrol Bekliyor", musteriRevizeNotu: null,
                  gecmis: [...(j.gecmis || []), { id: (j.gecmis || []).length + 1, tarih: zaman, yazan: staffName || "Çözüm Ortağı", aciklama: "Revize tamamlandı, kontrole gönderildi." }] }
              : j)),
          },
        };
      });
      if (!sonucOrtak.ok) return res.status(sonucOrtak.kod || 409).json({ error: sonucOrtak.hata || "Kaydedilemedi." });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST") {
      const { data, force, kilitAction, _v: clientVersion } = req.body || {};

      // Düzenleme kilidi (eşzamanlı düzenleme uyarısı) — ayrı bir uç noktaydı, Vercel'in
      // Hobby planındaki 12 fonksiyon sınırına takılmamak için buraya taşındı. Owner ya da
      // HERHANGİ bir geçerli personel girişi kullanabilir (özel bir izin gerektirmez —
      // amaç sadece "bu kaydı başka biri de açtı" diye erken uyarı vermek).
      if (kilitAction) {
        const { tur, id, kisi } = req.body || {};
        if (!tur || !id) return res.status(400).json({ error: "tur ve id gerekli." });
        const kilitKey = `marcus-os-kilit:${tur}:${id}`;
        if (kilitAction === "al") {
          const mevcut = await kv.get(kilitKey);
          if (mevcut && mevcut.kisi && mevcut.kisi !== kisi) {
            return res.status(200).json({ kilitli: true, kilitleyen: mevcut.kisi });
          }
          await kv.set(kilitKey, { kisi, zaman: Date.now() }, { ex: 90 });
          return res.status(200).json({ kilitli: false });
        }
        if (kilitAction === "birak") {
          const mevcut = await kv.get(kilitKey);
          if (mevcut && mevcut.kisi === kisi) await kv.del(kilitKey);
          return res.status(200).json({ ok: true });
        }
        return res.status(400).json({ error: "Geçersiz kilit işlemi." });
      }

      if (!data) return res.status(400).json({ error: "data eksik" });

      // PERSONEL: sadece izin verilen alanları değiştirebilir, geri kalan veri sunucuda
      // korunur ve gönderilen içerik ne olursa olsun yok sayılır. "clients" alanı SADECE
      // geniş kapsamlı izinlerden (musteriler/finans/takvim/odemeTakvimi/dashboard) yazılabilir —
      // paylasimlar/cekimEdit gibi dar izinler clients'i sadece okuyabilir, asla yazamaz
      // (yoksa sadeleştirilmiş liste, zengin müşteri verisinin üzerine yazardı).
      if (role === "staff") {
        // Personel kaydı da artık kilit altında, EN GÜNCEL veri okunarak yapılıyor ve
        // versiyon sayacını artırıyor. Ayrıca çakışma kontrolü personel için de geçerli:
        // iki editör aynı anda çalışırken biri diğerinin işini geri alamıyor.
        const sonuc = await guvenliGuncelle(async (existing) => {
          if (!force && typeof existing._v === "number" && typeof clientVersion === "number" && existing._v !== clientVersion) {
            return { iptal: true, kod: 409, hata: "stale", ek: { serverVersion: existing._v } };
          }
          const guncelHesap = staffId ? ((existing.personelHesaplari || []).find((h) => h.id === staffId)) : null;
          // İzinli markalar HER ZAMAN sunucudaki güncel hesap kaydından okunur — tarayıcının
          // gönderdiğine asla güvenilmez, yoksa kilit kolayca aşılırdı.
          const yaziMarkalari = (guncelHesap && Array.isArray(guncelHesap.markalar)) ? guncelHesap.markalar : [];
          const yaziKilitli = yaziMarkalari.length > 0;
          // Okumada olduğu gibi YAZMADA da izinler daraltılır: kilitli hesap, izni açık olsa
          // bile Finans/Personel gibi ajans geneli alanlara yazamaz.
          const hamYaziPerms = guncelHesap ? { ...DEFAULT_PERMS, ...(guncelHesap.izinler || {}) } : { ...DEFAULT_PERMS, ...(existing.staffPermissions || {}) };
          const perms = izinleriDaralt(hamYaziPerms, yaziKilitli);
          const merged = { ...existing };
          Object.entries(PERMISSION_WRITE_FIELDS).forEach(([permKey, fields]) => {
            if (perms[permKey] !== true) return;
            fields.forEach((f) => {
              if (data[f] === undefined) return;
              if (f === "clients") {
                // Personel yazımlarında da aynı güvenlik freni: müşteri sayısı çarpıcı biçimde
                // azalıyorsa (bayat/eksik veri olabilir) bu alanı yazmayı reddet.
                const existingCount = Array.isArray(existing.clients) ? existing.clients.length : 0;
                const newCount = Array.isArray(data.clients) ? data.clients.length : 0;
                if (existingCount >= 2 && newCount < existingCount * 0.6) return;
              }

              /* MARKA KİLİDİNDE VERİ KAYBI + YETKİSİZ YAZMA KORUMASI (kritik)
               * Kilitli hesap yalnızca kendi markalarının kayıtlarını gördüğü için, listeyi
               * olduğu gibi geri yazarsa diğer markaların kayıtları SİLİNİRDİ. Ortak katman
               * alan alan birleştirir: başkasının kayıtları sunucudaki hâliyle korunur,
               * sadece bu hesabın markalarına ait olanlar güncellenir. Dizi ve nesne
               * (stoklar, gunlukKontrol, musteriGirisleri) alanları ayrı ayrı ele alınır. */
              if (yaziKilitli) {
                merged[f] = yazmayiBirlestir(existing, data, f, yaziMarkalari);
                return;
              }

              merged[f] = data[f];
            });
          });
          // Bu kayıtta ne değişti (müşteri/personel/üyelik eklendi-silindi, durum değişti) —
          // İşlem Geçmişi defterine otomatik not düşülür. Son 200 kayıtla sınırlı tutulur.
          const yeniKayitlar = degisiklikleriTespitEt(existing, merged, staffName || "Personel");
          if (yeniKayitlar.length > 0) {
            merged.islemGecmisi = [...(existing.islemGecmisi || []), ...yeniKayitlar].slice(-200);
          }
          return { veri: merged };
        });

        /* Kayıt başarılıysa "Teslim Edildi"ye yeni geçen işlerin dosyalarını taşı.
         * Taşıma sonucu iş geçmişine not düşülür; taşıma başarısız olsa da kayıt geçerli. */
        /* Not düşme ikinci bir yazmadır ve _v'yi artırır — yanıtta MUTLAKA son _v
         * dönmeli, yoksa tarayıcı bir tur geride kalır ve sonraki kayıt sahte
         * çakışmayla kullanıcının düzenlemesini siler. */
        let staffSonHal = sonuc.veri;
        if (sonuc.ok) {
          staffSonHal = (await tasimalariIsleVeNotDus(sonuc.oncekiVeri, sonuc.veri)) || sonuc.veri;
        }

        if (!sonuc.ok) {
          if (sonuc.kod === 409) {
            return res.status(409).json({
              staleConflict: true,
              error: "Bu veri, sen düzenlerken başka bir cihazdan/sekmeden değişmiş. Kaybını önlemek için önce en güncel veriyi çekip senin değişikliğini tekrar uygulaman gerekiyor.",
              serverVersion: sonuc.mevcut && sonuc.mevcut._v,
            });
          }
          return res.status(sonuc.kod || 400).json({ error: sonuc.hata || "Kayıt yapılamadı." });
        }
        return res.status(200).json({ ok: true, _v: staffSonHal._v });
      }

      // Owner kaydı da artık kilit altında: okuma, çakışma kontrolü, güvenlik freni ve
      // yazma tek bir bölünmez blok halinde yapılıyor. Eskiden bu adımlar arasında başka
      // bir isteğin araya girip yazdığı değişiklik fark edilmeden siliniyordu.
      const ownerKilidi = await kilitAl();
      /* Drive taşıma, kilit BIRAKILDIKTAN SONRA yapılacağı için kaydın öncesi/sonrası
       * buraya taşınır. Kilit içinde taşıma yapılamaz: not düşen guvenliGuncelle kendi
       * kilidini almak ister ve alamaz. */
      let ownerOncekiVeri = null;
      let ownerYazilanVeri = null;
      try {
      // Owner'ın yerel kopyasında personelHesaplari hiç yok (GET'te hiç gönderilmiyor) —
      // bu yüzden her kayıtta mevcut hesapları sunucudan alıp geri ekliyoruz, yoksa
      // ilk kayıtta tüm personel hesapları sessizce silinmiş olurdu.
      const existingFull = await kv.get(KEY);

      // ÇAKIŞMA KONTROLÜ: her kayıt bir versiyon sayacını (_v) bir artırır. İstek, en son
      // GÖRDÜĞÜ versiyonu (clientVersion) da gönderir. Sunucudaki versiyon bundan farklıysa,
      // bu araya BAŞKA bir kayıt girmiş demektir (örn. az önce başka bir cihaz/sekme kaydetti,
      // ya da bu istek uzun süre arka planda/uykuda bekleyip GEÇ gönderildi) — böyle bir
      // durumda üzerine kör kör yazmak yerine reddedip ön yüzün önce en güncel veriyi
      // çekmesini istiyoruz. "force: true" ile (kullanıcı bilerek üzerine yazmak isterse) bu
      // kontrol atlanabilir.
      if (!force && existingFull && typeof existingFull._v === "number" && typeof clientVersion === "number" && existingFull._v !== clientVersion) {
        return res.status(409).json({
          staleConflict: true,
          error: "Bu veri, sen düzenlerken başka bir cihazdan/sekmeden değişmiş. Kaybını önlemek için önce en güncel veriyi çekip senin değişikliğini tekrar uygulaman gerekiyor.",
          serverVersion: existingFull._v,
        });
      }

      // GÜVENLİK FRENİ: müşteri sayısı mevcut veriye göre çarpıcı biçimde azalıyorsa
      // (örn. bir hata sonucu boş/demo veri yazılmaya çalışılıyorsa) kaydı reddet.
      // Bilinçli bir toplu silme durumunda ön yüz "force: true" ile tekrar dener.
      // Aynı fren, Personel (İK) kayıtları için de geçerli — sadece müşteri verisi değil,
      // ekip kayıtlarının da yanlışlıkla toplu silinmesine karşı korunuyor.
      if (!force) {
        const existingCount = existingFull && Array.isArray(existingFull.clients) ? existingFull.clients.length : 0;
        const newCount = Array.isArray(data.clients) ? data.clients.length : 0;
        if (existingCount >= 2 && newCount < existingCount * 0.6) {
          return res.status(409).json({
            blocked: true,
            error: `Güvenlik freni: mevcut ${existingCount} müşteriden ${newCount}'a düşen bir kayıt engellendi. Bu istenmeyen bir veri kaybı olabilir.`,
            existingCount,
            newCount,
          });
        }
        const existingPersonelCount = existingFull && Array.isArray(existingFull.personel) ? existingFull.personel.length : 0;
        const newPersonelCount = Array.isArray(data.personel) ? data.personel.length : 0;
        if (existingPersonelCount >= 2 && newPersonelCount < existingPersonelCount * 0.6) {
          return res.status(409).json({
            blocked: true,
            error: `Güvenlik freni: mevcut ${existingPersonelCount} personel kaydından ${newPersonelCount}'a düşen bir kayıt engellendi. Bu istenmeyen bir veri kaybı olabilir.`,
            existingCount: existingPersonelCount,
            newCount: newPersonelCount,
            alan: "personel",
          });
        }
      }

      // Owner'ın yerel kopyasında ASLA bulunmayan (GET'te hiç gönderilmeyen) alanlar burada
      // sunucudaki mevcut değerleriyle geri eklenir — yoksa her kayıtta sessizce silinirler.
      // personelHesaplari için bu zaten yapılıyordu; kasaSifresiHash/Salt de AYNI kategoride
      // olduğu halde unutulmuştu — bu da "kasa şifresi kendiliğinden sıfırlanıyor" hatasının sebebiydi.
      const finalData = {
        ...data,
        personelHesaplari: (existingFull && existingFull.personelHesaplari) || [],
        musteriHesaplari: (existingFull && existingFull.musteriHesaplari) || [],
        kasaSifresiHash: existingFull ? existingFull.kasaSifresiHash : undefined,
        kasaSifresiSalt: existingFull ? existingFull.kasaSifresiSalt : undefined,
        // Sayacı SUNUCUDAKİ değerden alıyoruz (tarayıcının gönderdiğinden değil);
        // bir artırma işini guvenliYaz yapıyor, böylece tüm uç noktalarda tek bir kural var.
        _v: (existingFull && typeof existingFull._v === "number" ? existingFull._v : 0),
      };
      // Bu kayıtta ne değişti (müşteri/personel/üyelik eklendi-silindi, durum değişti) —
      // İşlem Geçmişi defterine otomatik not düşülür. Son 200 kayıtla sınırlı tutulur.
      const yeniKayitlar = degisiklikleriTespitEt(existingFull, finalData, "Yönetici (CEO)");
      if (yeniKayitlar.length > 0) {
        finalData.islemGecmisi = [...((existingFull && existingFull.islemGecmisi) || []), ...yeniKayitlar].slice(-200);
      } else if (existingFull && existingFull.islemGecmisi) {
        finalData.islemGecmisi = existingFull.islemGecmisi;
      }
      // Versiyonu artırır, günlük + saatlik yedeği yazar, yetim müşteri hesaplarını temizler.
      const yazilan = await guvenliYaz(finalData);

      if (Math.random() < 0.08) {
        try {
          const keys = await kv.keys("marcus-os-snapshot-*");
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          for (const k of keys) {
            const d = k.replace("marcus-os-snapshot-", "");
            if (new Date(d) < cutoff) await kv.del(k);
          }
        } catch (e) {
          // temizlik hatası kritik değil
        }
      }

      ownerOncekiVeri = existingFull;
      ownerYazilanVeri = yazilan;
      } finally {
        await kilitBirak(ownerKilidi);
      }

      /* KİLİT BIRAKILDI — taşıma ve not düşme burada yapılır.
       * Yanıttan ÖNCE çalışır: yanıt gönderildikten sonra sunucu fonksiyonu donabilir ve
       * arkada kalan iş hiç bitmeyebilir. */
      const ownerSonHal = (await tasimalariIsleVeNotDus(ownerOncekiVeri, ownerYazilanVeri)) || ownerYazilanVeri;

      return res.status(200).json({ ok: true, _v: ownerSonHal._v });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({
      error:
        "Veritabanına bağlanılamadı. Vercel projende bir KV (Storage) veritabanı bağlı olduğundan emin ol. Detay: " +
        e.message,
    });
  }
}
