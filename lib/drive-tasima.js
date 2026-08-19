import crypto from "crypto";

/**
 * GOOGLE DRIVE — ONAYLANAN DOSYAYI TAŞIMA
 *
 * Müşteri bir içeriği onayladığında, o işin Drive dosyası "Onaylananlar" klasörüne taşınır.
 * Ekip artık hangi dosyanın yayına hazır olduğunu Drive'da da görür; panele bakmadan
 * bulabilir.
 *
 * NEDEN BU SEFER ÇALIŞIYOR: daha önce yükleme denenmişti ve servis hesaplarının depolama
 * kotası olmadığı için kişisel Google hesabında başarısız oluyordu. TAŞIMA farklı bir iş:
 * yeni dosya oluşturulmuyor, var olan dosyanın klasörü değiştiriliyor. Servis hesabının
 * dosyaya düzenleme yetkisi olması yeterli, sahip olması gerekmiyor.
 *
 * GEREKEN ORTAM DEĞİŞKENLERİ:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — servis hesabının e-postası
 *   GOOGLE_PRIVATE_KEY            — indirilen JSON'daki private_key alanı
 *   DRIVE_ONAY_KLASOR_ID          — onaylananların taşınacağı klasörün kimliği
 *
 * Servis hesabının e-postası hem kaynak klasöre hem hedef klasöre DÜZENLEYİCİ olarak
 * eklenmiş olmalı; yoksa taşıma yetki hatası verir.
 */

const YETKI = "https://www.googleapis.com/auth/drive";

/* HER GOOGLE ÇAĞRISI ZAMAN SINIRLI.
 *
 * Neden: taşıma, kaydın HTTP yanıtı gönderilmeden önce çalışıyor. Google yavaşlar ya da hiç
 * yanıt vermezse kayıt yanıtı da asılı kalır; tarayıcı "kaydedilemedi" gösterir — oysa kayıt
 * çoktan yazılmıştır. Sınır konmazsa Drive'ın kötü günü uygulamanın kötü günü olur. */
const CAGRI_SINIRI_MS = 8000;

async function getir(url, secenekler = {}) {
  const iptal = new AbortController();
  const sayac = setTimeout(() => iptal.abort(), CAGRI_SINIRI_MS);
  try {
    return await fetch(url, { ...secenekler, signal: iptal.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Google yanıt vermedi (zaman aşımı).");
    throw e;
  } finally {
    clearTimeout(sayac);
  }
}

/** Üç değişken de tanımlı mı — değilse taşıma sessizce atlanır, onay normal tamamlanır. */
/**
 * Servis hesabının kimlik bilgileri var mı?
 *
 * driveTasimaHazirMi'den AYRI: o, taşıma için eski genel klasör değişkenini (DRIVE_ONAY_
 * KLASOR_ID) de şart koşuyor. Klasörler artık marka kaydında tutulduğu için o değişken
 * tanımlı olmayabiliyor — ve tanımlı olmaması ÖNİZLEMEYİ engellememeli. Önizlemenin
 * klasörle bir işi yok, yalnızca dosyayı okumakla ilgili. Bu ayrım yapılmadığında önizleme
 * sessizce hiç denenmiyordu.
 */
export function servisHesabiHazirMi() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

export function driveTasimaHazirMi() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.DRIVE_ONAY_KLASOR_ID,
  );
}

/** Drive bağlantısından dosya kimliğini çıkarır. Farklı bağlantı biçimleri desteklenir. */
/** Klasör bağlantısından klasör kimliğini çıkarır. Kullanıcı ham kimlik de yapıştırabilir. */
export function driveKlasorIdCikar(link) {
  const s = String(link || "").trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  // Bağlantı değil de doğrudan kimlik yapıştırılmışsa
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) return s;
  return null;
}

export function driveDosyaIdCikar(link) {
  const s = String(link || "");
  const kaliplar = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,     // .../file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]{10,})/,          // ...?id=ID
    /\/d\/([a-zA-Z0-9_-]{10,})/,            // .../d/ID
  ];
  for (const k of kaliplar) {
    const m = s.match(k);
    if (m) return m[1];
  }
  return null;
}

function base64url(veri) {
  return Buffer.from(veri).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function erisimJetonu() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  /* Ortam değişkenlerinde satır sonları "\n" METNİ olarak saklanır; gerçek satır sonuna
   * çevrilmezse imzalama başarısız olur. Kurulumda en sık yapılan hata budur. */
  const anahtar = String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !anahtar) throw new Error("Drive kimlik bilgileri eksik.");

  const simdi = Math.floor(Date.now() / 1000);
  const baslik = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const govde = base64url(JSON.stringify({
    iss: email, scope: YETKI, aud: "https://oauth2.googleapis.com/token",
    iat: simdi, exp: simdi + 3600,
  }));
  const imza = crypto.createSign("RSA-SHA256").update(`${baslik}.${govde}`).sign(anahtar);

  const r = await getir("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${baslik}.${govde}.${base64url(imza)}`,
    }),
  });
  const veri = await r.json();
  if (!r.ok || !veri.access_token) {
    throw new Error(veri.error_description || veri.error || "Google jetonu alınamadı.");
  }
  return veri.access_token;
}

const AYLAR = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
               "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];

/* KLASÖR ADI EŞLEŞTİRME — TOLERANSLI OLMAK ZORUNDA.
 *
 * Gerçek Drive'da aynı klasör üç ayrı yazımla karşımıza çıkıyor:
 *   "AĞUSTOS" / "Ağustos" / "08 AGUSTOS 2026"      (harf, büyüklük, numara öneki, yıl)
 *   "PAYLAŞILDI" / "3 PAYLAŞILDI" / "Paylaşıldı"
 *
 * Katı eşleştirme yapılırsa sistem var olanı bulamayıp YENİSİNİ açar; dosyalar ikiye bölünür
 * ve kimse fark etmez. Bu yüzden karşılaştırma öncesinde ad sadeleştiriliyor: Türkçe harfler
 * ASCII'ye indiriliyor, baştaki numara öneki ("1 ", "1 - ", "08 ") ve sondaki yıl atılıyor. */
const HARF_SADE = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

function adSadelestir(ad) {
  return String(ad || "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (h) => HARF_SADE[h] || h)
    .replace(/^\s*\d+\s*[-.]?\s*/, "")     // baştaki "1 ", "08 - " gibi önekler
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const adlarAyniMi = (a, b) => adSadelestir(a) === adSadelestir(b);

/* AY KLASÖRLERİ YIL BAKIMINDAN AYRI TUTULMAK ZORUNDA.
 *
 * Sadeleştirme bir ara yılı da atıyordu; "08 AĞUSTOS 2026" ile "08 AĞUSTOS 2027" aynı ada
 * indiği için 2027'nin dosyaları 2026'nın klasörüne düşerdi. Yıl dönümünde fark edilirdi,
 * yani en geç fark edilecek anda. Bu yüzden ay karşılaştırması ayrı bir iş:
 *
 *   ay adı tutmuyorsa            -> farklı
 *   ikisinde de yıl varsa        -> yıllar da tutmalı
 *   HEDEFTE yıl yoksa            -> ay yeter (var olan bir klasörün kendi adı yankılanıyor)
 *   KLASÖRDE yıl yoksa           -> klasörün AÇILDIĞI yıla bakılır
 *
 * Son madde eski klasörler için: Drive'da yılsız "AĞUSTOS" klasörleri var. Bunlar açıldıkları
 * yılın ağustosudur; 2027'de o klasör artık uygun bir hedef değildir. */
function ayBilgisi(ad) {
  const sade = adSadelestir(ad);
  const i = AYLAR.findIndex((a) => sade === adSadelestir(a) || sade.startsWith(adSadelestir(a) + " "));
  if (i < 0) return null;
  const y = String(ad || "").match(/\b(19|20)\d{2}\b/);
  return { ay: i, yil: y ? Number(y[0]) : null };
}

/** Bir klasör adı ay adı mı? "AĞUSTOS", "Ağustos", "08 AGUSTOS 2026" hepsi evet. */
function ayMi(ad) {
  return ayBilgisi(ad) !== null;
}

/** Drive'daki bir klasör, aranan ay klasörü mü? */
function ayKlasoruEslesiyorMu(klasor, hedefAd) {
  const k = ayBilgisi(klasor && klasor.name);
  const h = ayBilgisi(hedefAd);
  if (!k || !h || k.ay !== h.ay) return false;
  if (h.yil === null) return true;
  if (k.yil !== null) return k.yil === h.yil;
  const acilis = String((klasor && klasor.createdTime) || "").slice(0, 4);
  return acilis ? Number(acilis) === h.yil : false;
}

/**
 * KLASÖR DÜZENİ — sistemin uyduğu tek şema:
 *
 *   <MARKA>/
 *     1 SOSYAL MEDYA/
 *       2026/
 *         08 AĞUSTOS/
 *           1 ONAY BEKLEYENLER/
 *           2 ONAYLANANLAR/
 *           3 PAYLAŞILDI/
 *         09 EYLÜL/
 *       2027/
 *         01 OCAK/
 *
 * NEDEN YIL AYRI BİR KAT — düz "08 AĞUSTOS 2026" adlandırması yıl dönümünde sıralamayı
 * bozuyordu: Drive alfabetik dizdiği için "01 OCAK 2027", "08 AĞUSTOS 2026"nın ÜSTÜNDE
 * çıkıyor, takvim sırası karışıyordu. Yıl üst klasör olunca sıra her zaman doğru: bir yılın
 * içinde en fazla 12 klasör var ve 01…12 numaraları doğru diziliyor.
 *
 * Ayrıca bir yılın işi tek klasör: arşivleme, devir, temizlik tek hareket.
 *
 * ESKİ DÜZEN TERK EDİLMİYOR: Drive'da hâlihazırda "08 AĞUSTOS 2026" ya da yılsız "AĞUSTOS"
 * klasörleri var. Aynı ay için bunlardan biri varsa sistem ONU kullanmaya devam eder,
 * yanına ikinci bir yapı kurmaz — yoksa aynı ayın dosyaları iki yere bölünür ve kimse fark
 * etmez. Yeni düzen yalnızca sıfırdan açılan aylarda uygulanır.
 */
function ayKlasoruAdi(tarih = new Date()) {
  const ay = tarih.getMonth();
  return `${String(ay + 1).padStart(2, "0")} ${AYLAR[ay]}`;
}

/** Yıl klasörü sade bir sayıdır: "2026". Ay adı sadeleştirmesi burada işe yaramaz. */
const yilKlasoruMu = (ad) => /^\s*(19|20)\d{2}\s*$/.test(String(ad || ""));
const yilAyni = (ad, yil) => String(ad || "").trim() === String(yil);

/* AŞAMA KLASÖRLERİ — numaralı, iş sırasına göre dizilsinler diye. */
/**
 * SERVİS HESABIYLA ÇÖPE ATMA — YEDEK YOL.
 *
 * ASIL YOL OAUTH (bkz. drive-yukleme.js → dosyayiCopeAt). Sebebi denenerek öğrenildi:
 * Google Drive'da bir dosyayı çöpe atmak DÜZENLEME yetkisi değil SAHİPLİK istiyor. Uygulamanın
 * yüklediği dosyaların sahibi kullanıcı (servis hesaplarının depolama kotası yok, yükleyemiyorlar);
 * servis hesabı klasörde "Düzenleyen" olsa bile o dosyaları çöpe atamıyor ve Google şunu diyor:
 *
 *     "The user does not have sufficient permissions for this file."
 *
 * Bu yol yine de duruyor: servis hesabının SAHİBİ olduğu dosyalar (klasörler ve ileride
 * onun oluşturacağı kayıtlar) için çalışan tek yol bu.
 */
export async function servisleCopeAt(dosyaId) {
  if (!dosyaId) return { ok: false, sebep: "Dosya kimliği yok." };
  if (!servisHesabiHazirMi()) return { ok: false, sebep: "Drive servis hesabı kurulu değil." };
  try {
    const jeton = await erisimJetonu();
    const y = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}?supportsAllDrives=true`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    /* DOSYA ZATEN YOKSA BU BİR HATA DEĞİL.
     *
     * Kullanıcı dosyayı Drive'dan eliyle silmiş olabilir. "Bulunamadı" deyip başarısız
     * saymak kartı kilitlerdi: kart silinemez, çünkü dosyası silinemiyor, çünkü dosya
     * zaten yok. İstenen sonuç (dosya orada değil) sağlanmış durumda.
     *
     * Bu yalnızca SERVİS HESABI için geçerli: o, paylaşılan ağacın tamamını görüyor.
     * OAuth'un 404'ü "yok" demek değil, "benim dar kapsamım bunu görmüyor" demek olabilir. */
    if (y.status === 404) return { ok: true, nasil: "zaten-yok" };
    if (!y.ok) {
      const hata = await y.json().catch(() => ({}));
      return { ok: false, sebep: (hata.error && hata.error.message) || `HTTP ${y.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, sebep: String((e && e.message) || e) };
  }
}

export const DURUM_KLASORLERI = {
  onayBekleyen: "1 ONAY BEKLEYENLER",
  onaylanan: "2 ONAYLANANLAR",
  paylasilan: "3 PAYLAŞILDI",
};

/**
 * Klasörü ada göre bulur, yoksa oluşturur.
 *
 * BÜYÜK/KÜÇÜK HARFE DUYARSIZ ARAR — bu bir kusurdu: Drive'da klasör "Ağustos" yazıyorken kod
 * "AĞUSTOS" arıyor, bulamayıp İKİNCİ bir klasör açıyordu. Aynı şey "Paylaşıldı"/"PAYLAŞILDI"
 * için de geçerliydi. Bu yüzden ada göre sorgu yerine üst klasörün altındaki klasörler
 * listelenip karşılaştırma kod tarafında yapılıyor.
 */
async function altKlasorler(jeton, ustKlasor) {
  const sorgu = encodeURIComponent(
    `'${ustKlasor}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const ara = await getir(
    `https://www.googleapis.com/drive/v3/files?q=${sorgu}&fields=files(id,name,createdTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${jeton}` } },
  );
  const bulunan = await ara.json();
  if (!ara.ok) throw new Error(bulunan.error?.message || "Klasör listelenemedi.");
  return bulunan.files || [];
}

async function klasorOlustur(jeton, ad, ustKlasor) {
  const olustur = await getir("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: ad, mimeType: "application/vnd.google-apps.folder", parents: [ustKlasor] }),
  });
  const yeni = await olustur.json();
  if (!yeni.id) throw new Error(yeni.error?.message || "Klasör oluşturulamadı.");
  return yeni.id;
}

async function klasorBulVeyaOlustur(jeton, ad, ustKlasor) {
  const eslesen = (await altKlasorler(jeton, ustKlasor)).find((f) => adlarAyniMi(f.name, ad));
  if (eslesen) return eslesen.id;
  return klasorOlustur(jeton, ad, ustKlasor);
}

/** Bir klasörün adını ve üst klasörünü getirir. Bulunamazsa null. */
async function klasorBilgisi(jeton, id) {
  try {
    const r = await getir(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,parents&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    const d = await r.json();
    return r.ok ? d : null;
  } catch (e) {
    return null;
  }
}

/* SOSYAL MEDYA klasörünün adı — bağlantı marka klasörünü gösteriyorsa buraya inilir. */
const SOSYAL_MEDYA = "1 SOSYAL MEDYA";

/**
 * Bağlantının gösterdiği klasörden ÇALIŞMA KÖKÜNE iner.
 *
 * NEDEN: müşteri kaydına marka klasörü de girilebiliyor, "1 SOSYAL MEDYA" klasörü de.
 * İkisi de doğru görünüyor ama sonuç farklı: marka klasörü girilirse ay klasörleri markanın
 * köküne, LOGO ve PROFİL'in yanına açılıyor — istenen bu değil.
 *
 * 17 markada bu ayrımı elle doğru yapmak yerine sistem kendisi iniyor: gösterilen klasörün
 * içinde "SOSYAL MEDYA" varsa çalışma kökü odur. Yoksa gösterilen klasör kullanılır
 * (markada öyle bir klasör yoksa ya da bağlantı zaten onu gösteriyorsa).
 */
async function calismaKoku(jeton, klasorId, olustur = false) {
  const yerinde = { id: klasorId, nasil: "yerinde" };
  try {
    const cocuklar = await altKlasorler(jeton, klasorId);
    const sosyal = cocuklar.find((f) => adlarAyniMi(f.name, SOSYAL_MEDYA));
    if (sosyal) return { id: sosyal.id, nasil: "inildi" };

    /* SOSYAL MEDYA yok. Bu iki anlama gelebilir:
     *   (a) bağlantı ZATEN sosyal medya klasörünü gösteriyor — inilecek bir yer yok,
     *   (b) markada henüz böyle bir klasör açılmamış — sistem açmalı.
     * Ayırt etmek için gösterilen klasörün KENDİ adına bakılıyor. */
    const bilgi = await klasorBilgisi(jeton, klasorId);
    const ad = (bilgi && bilgi.name) || "";
    if (!ad) return yerinde;
    if (adlarAyniMi(ad, SOSYAL_MEDYA)) return { id: klasorId, nasil: "kendisi" };

    /* Bağlantı yanlışlıkla bir ay ya da aşama klasörünü gösteriyorsa İÇİNE sosyal medya
     * klasörü açmak durumu daha da bozar. Böyle bir yerde hiçbir şey açmadan duruluyor. */
    if (ayMi(ad) || yilKlasoruMu(ad) || Object.values(DURUM_KLASORLERI).some((d) => adlarAyniMi(ad, d))) {
      return { ...yerinde, nasil: "beklenmedik" };
    }
    if (!olustur) return { id: klasorId, nasil: "acilacak" };
    return { id: await klasorOlustur(jeton, SOSYAL_MEDYA, klasorId), nasil: "acildi" };
  } catch (e) {
    return yerinde;   // Drive erişilemezse gösterilen klasörle devam — taşıma durmasın
  }
}

/** Yükleme ve taşımanın kullandığı kısa yol: gerekiyorsa klasörü de açar. */
async function calismaKokunuBul(jeton, klasorId) {
  return (await calismaKoku(jeton, klasorId, true)).id;
}

/**
 * O AYIN KLASÖRÜNÜ BULUR, GEREKİRSE AÇAR.
 *
 * Sıra önemli — önce var olana bakılıyor, sonra yenisi kuruluyor:
 *   1. Çalışma kökünde ESKİ düzende bir ay klasörü ("08 AĞUSTOS 2026", yılsız "AĞUSTOS")
 *      duruyorsa o kullanılır. Yanına yeni yapı kurmak aynı ayı ikiye böler.
 *   2. Yoksa YENİ düzen: <yıl>/<ay>.
 *
 * olustur=false ile çağrılırsa Drive'da hiçbir şey açmaz; yalnızca nereye açılacağını söyler.
 * Durum raporu bunu kullanıyor: duruma bakmak durumu değiştirmemeli.
 */
async function ayKlasoruHazirla(jeton, calismaKoku, tarih = new Date(), olustur = true) {
  const yil = tarih.getFullYear();
  const ayAd = ayKlasoruAdi(tarih);
  const kokAlti = await altKlasorler(jeton, calismaKoku);

  const eski = kokAlti.find((f) => ayKlasoruEslesiyorMu(f, `${ayAd} ${yil}`));
  if (eski) return { id: eski.id, yol: eski.name, duzen: "eski" };

  const yilKlasoru = kokAlti.find((f) => yilAyni(f.name, yil));
  const yol = `${yil}/${ayAd}`;
  if (!yilKlasoru) {
    if (!olustur) return { id: null, yol, duzen: "acilacak" };
    const yeniYil = await klasorOlustur(jeton, String(yil), calismaKoku);
    return { id: await klasorOlustur(jeton, ayAd, yeniYil), yol, duzen: "yeni" };
  }

  const ayKlasoru = (await altKlasorler(jeton, yilKlasoru.id)).find((f) => adlarAyniMi(f.name, ayAd));
  if (ayKlasoru) return { id: ayKlasoru.id, yol, duzen: "yeni" };
  if (!olustur) return { id: null, yol, duzen: "acilacak" };
  return { id: await klasorOlustur(jeton, ayAd, yilKlasoru.id), yol, duzen: "yeni" };
}

/**
 * DOSYA HÂLİHAZIRDA HANGİ AY KLASÖRÜNÜN İÇİNDE?
 *
 * NEDEN MEVCUT AY DEĞİL: iş "hangi ay yüklendiyse o ayın klasöründe kalsın" kuralına göre
 * çalışıyor. 30 Ağustos'ta yüklenip 1 Eylül'de onaylanan bir dosya EYLÜL'e sıçramamalı —
 * yoksa aynı işin parçaları iki aya bölünür.
 *
 * Ay klasörü ADIYLA değil KİMLİĞİYLE döndürülüyor. Adla dönmek, sonra o adı yeniden aramak
 * demekti; iki düzen bir arada yaşadığı için (eski düz klasörler ve yeni <yıl>/<ay>) arama
 * bu sefer başka bir klasörü bulabilirdi. Kimlik tekil, tartışma bitiyor.
 *
 * Dosya bulunamazsa null döner — çağıran o ayın klasörünü açtırır.
 */
async function dosyaninAyKlasoru(jeton, dosyaParents, calismaKoku) {
  /* Bu klasör, çalışma kökünün altındaki bir ay klasörü mü? İki yerleşim de kabul:
   * doğrudan kökün altında (eski düzen) ya da bir yıl klasörünün altında (yeni düzen). */
  async function ayKlasoruMu(k) {
    if (!k || !ayMi(k.name)) return null;
    if ((k.parents || []).includes(calismaKoku)) return { id: k.id, yol: k.name };
    for (const ustId of k.parents || []) {
      const ust = await klasorBilgisi(jeton, ustId);
      if (ust && yilKlasoruMu(ust.name) && (ust.parents || []).includes(calismaKoku)) {
        return { id: k.id, yol: `${ust.name}/${k.name}` };
      }
    }
    return null;
  }

  for (const ustId of dosyaParents || []) {
    const ust = await klasorBilgisi(jeton, ustId);
    if (!ust) continue;
    const dogrudan = await ayKlasoruMu(ust);      // dosya doğrudan ay klasöründe
    if (dogrudan) return dogrudan;
    for (const dedeId of ust.parents || []) {     // dosya <AY>/<DURUM> içinde
      const dede = await klasorBilgisi(jeton, dedeId);
      const bir = await ayKlasoruMu(dede);
      if (bir) return bir;
    }
  }
  return null;
}

/**
 * ÖNİZLEME GÖRSELİ — SERVİS HESABIYLA.
 *
 * NEDEN OAUTH DEĞİL: uygulamanın OAuth izni `drive.file` — dar ve bilinçli olarak dar,
 * Google doğrulaması istemesin diye. Ama o izin YALNIZCA uygulamanın kendi yüklediği
 * dosyaları kapsıyor. Drive'a elle konmuş eski dosyalar (yükleme sistemi gelmeden önce
 * açılmış bütün kartlar) o token'a görünmez; istek 404 dönüyor ve önizleme boş kalıyor.
 *
 * Servis hesabı ise marka klasörlerine açıkça üye yapıldı ve tam `drive` yetkisi taşıyor —
 * eski dosyaları da okuyabiliyor. Bu yüzden önizleme onun üzerinden alınıyor.
 */
export async function onizlemeGetir(dosyaId, boyut = 800) {
  if (!servisHesabiHazirMi()) return { ok: false, sebep: "Drive servis hesabı kurulu değil." };
  try {
    const jeton = await erisimJetonu();
    const r = await getir(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    const bilgi = await r.json();
    if (!r.ok) return { ok: false, sebep: bilgi.error?.message || "Dosya bilgisi alınamadı." };
    if (!bilgi.thumbnailLink) return { ok: false, sebep: "Bu dosyanın küçük resmi yok." };

    const olcu = Math.max(80, Math.min(1600, Number(boyut) || 800));
    const adres = String(bilgi.thumbnailLink).replace(/=s\d+$/, `=s${olcu}`);
    const g = await getir(adres, { headers: { Authorization: `Bearer ${jeton}` } });
    if (!g.ok) return { ok: false, sebep: "Küçük resim indirilemedi." };
    const bayt = Buffer.from(await g.arrayBuffer());
    const tur = g.headers.get("content-type") || "image/jpeg";
    return { ok: true, veri: `data:${tur};base64,${bayt.toString("base64")}`, mimeTur: bilgi.mimeType || "" };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/**
 * VİDEONUN HAM BAYTLARINI GETİRİR — TARAYICIYA AKITMAK İÇİN.
 *
 * NEDEN SUNUCUDAN GEÇİYOR: dosyalar Drive'da bilerek kısıtlı. Gömülü Drive oynatıcısı
 * çerçeve içinden Google'ın çerezlerine erişmek zorunda; Safari (ve iOS'taki bütün
 * tarayıcılar) bunu varsayılan olarak engelliyor ve ekranda siyah bir kutu kalıyor.
 * Dosyayı "bağlantısı olan herkese" açmak sorunu çözerdi ama kapatılan gizlilik açığını
 * geri getirirdi. Video kendi sunucumuzdan gelince üçüncü taraf çerezi hiç devreye girmiyor.
 *
 * ZAMAN AŞIMI YOK — bilerek. Diğer çağrılarda 8 saniyelik sınır var çünkü onlar bir isteğin
 * yanıtını bekletiyor. Burada iş, dosyanın kendisini aktarmak; 40 MB'lık bir Reels sekiz
 * saniyeden uzun sürebilir ve yarıda kesmek videoyu bozuk gösterir.
 *
 * ARALIK (Range) OLDUĞU GİBİ İLETİLİYOR: tarayıcı videoda ileri sarınca yalnızca gereken
 * parçayı ister. İletilmezse her atlama dosyanın tamamını baştan indirir.
 */
export async function videoAkisi(dosyaId, aralik) {
  if (!servisHesabiHazirMi()) return { ok: false, sebep: "Drive servis hesabı kurulu değil." };
  try {
    const jeton = await erisimJetonu();
    const yanit = await fetch(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${jeton}`, ...(aralik ? { Range: aralik } : {}) } },
    );
    if (!yanit.ok && yanit.status !== 206) {
      return { ok: false, durum: yanit.status, sebep: `Dosya alınamadı (HTTP ${yanit.status}).` };
    }
    return { ok: true, yanit };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/**
 * Dosyayı markanın "<AY>/<DURUM>" klasörüne taşır.
 *
 * Örn. VIZZ/AĞUSTOS/ONAYLANANLAR
 * Ay önce, durum sonra — kullanıcının Drive'daki mevcut düzeni böyle. Var olan klasörler
 * (büyük/küçük harf farkı olsa bile) yeniden kullanılır, yalnızca eksik olan açılır.
 *
 * ASLA HATA FIRLATMAZ: taşıma başarısız olsa bile asıl işlem (onay, aşama değişimi) geçerli
 * kalmalıdır. Sonuç nesnesi döner, çağıran taraf geçmişe not düşer.
 */
export async function onaylananiTasi({ dosyaLinki, markaAdi, markaKlasoru, hedefAd = DURUM_KLASORLERI.onaylanan }) {
  /* HEDEF KÖK iki kaynaktan gelebilir:
   *  1. markaKlasoru — müşteri kaydındaki "Drive Onay Klasörü". ASIL YOL budur.
   *  2. DRIVE_ONAY_KLASOR_ID — ortak üst klasör; markanın kendi klasörü yoksa içinde marka
   *     adıyla alt klasör açılır.
   * İkisi de yoksa taşıma yapılmaz ve asıl işlem normal tamamlanır. */
  const markaHedef = driveKlasorIdCikar(markaKlasoru);
  if (!markaHedef && !driveTasimaHazirMi()) return { tasindi: false, sebep: "Drive taşıma kurulu değil." };
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { tasindi: false, sebep: "Drive kimlik bilgileri tanımlı değil." };
  }
  const dosyaId = driveDosyaIdCikar(dosyaLinki);
  if (!dosyaId) return { tasindi: false, sebep: "Bağlantıdan dosya kimliği çıkarılamadı." };

  try {
    const jeton = await erisimJetonu();
    const kokKlasor = process.env.DRIVE_ONAY_KLASOR_ID;
    const gosterilenKlasor = markaHedef || (markaAdi && kokKlasor ? await klasorBulVeyaOlustur(jeton, markaAdi, kokKlasor) : null);
    if (!gosterilenKlasor) return { tasindi: false, sebep: "Bu marka için Drive klasörü tanımlı değil." };
    /* Yükleme nereye yapıldıysa taşıma da oraya — aynı iniş kuralı. */
    const markaKoku = await calismaKokunuBul(jeton, gosterilenKlasor);

    /* Dosyanın MEVCUT yerini önce öğren: hem ayını buluruz hem de taşırken eski klasörü
     * kaldırmamız gerekir. Sadece yeni klasör eklenirse dosya iki yerde birden görünür. */
    const bilgi = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=parents,name&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    const dosya = await bilgi.json();
    if (!bilgi.ok) return { tasindi: false, sebep: dosya.error?.message || "Dosya bulunamadı." };

    /* Dosya zaten bir ay klasörünün altındaysa O AY korunur; değilse (ilk yerleştirme)
     * içinde bulunulan ayın klasörü hazırlanır. */
    const ay = (await dosyaninAyKlasoru(jeton, dosya.parents, markaKoku))
            || (await ayKlasoruHazirla(jeton, markaKoku));
    const hedef = await klasorBulVeyaOlustur(jeton, hedefAd, ay.id);
    const yol = `${ay.yol}/${hedefAd}`;

    const eskiler = (dosya.parents || []).join(",");
    if ((dosya.parents || []).includes(hedef)) {
      return { tasindi: false, sebep: `Dosya zaten ${yol} klasöründe.`, zatenOrada: true, klasor: yol };
    }

    const tasi = await getir(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?addParents=${hedef}${eskiler ? `&removeParents=${eskiler}` : ""}&fields=id,parents&supportsAllDrives=true`,
      { method: "PATCH", headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" }, body: "{}" },
    );
    const sonuc = await tasi.json();
    if (!tasi.ok) return { tasindi: false, sebep: sonuc.error?.message || "Taşınamadı." };
    return { tasindi: true, dosyaAdi: dosya.name || "", klasor: yol };
  } catch (e) {
    return { tasindi: false, sebep: String(e.message || e) };
  }
}

/**
 * Markanın "<AY>/<DURUM>" klasörünü hazırlar ve kimliğini döndürür.
 *
 * Yükleme katmanı da aynı klasör mantığına ihtiyaç duyuyor. İkinci bir kopya yazmak yerine
 * buradan dışa açılıyor — deponun kendi kuralı: aynı işi yapan ikinci kopya güncellenmediğinde
 * sessizce bozulur.
 *
 * Servis hesabı klasör AÇABİLİR (klasörler depolama yer kaplamaz); dosya yükleyemez.
 */
export async function hedefKlasoruHazirla({ markaKlasoru, markaAdi, durumAdi }) {
  const markaHedef = driveKlasorIdCikar(markaKlasoru);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, sebep: "Drive kimlik bilgileri tanımlı değil." };
  }
  const kok = process.env.DRIVE_ONAY_KLASOR_ID;
  try {
    const jeton = await erisimJetonu();
    const gosterilen = markaHedef || (markaAdi && kok ? await klasorBulVeyaOlustur(jeton, markaAdi, kok) : null);
    if (!gosterilen) return { ok: false, sebep: "Bu marka için Drive klasörü tanımlı değil." };
    /* Bağlantı marka klasörünü gösteriyorsa "SOSYAL MEDYA"nın içine in — ay klasörleri
     * LOGO / PROFİL'in yanına değil, sosyal medya çalışmasının içine açılmalı. */
    const markaKoku = await calismaKokunuBul(jeton, gosterilen);
    const ay = await ayKlasoruHazirla(jeton, markaKoku);
    const hedef = await klasorBulVeyaOlustur(jeton, durumAdi, ay.id);
    return { ok: true, klasorId: hedef, yol: `${ay.yol}/${durumAdi}`, ayAdi: ay.yol };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/** Bir dosyaya servis hesabı adına yazma yetkisi verir — taşıyabilmesi için şart. */
export async function servisHesabinaYetkiVer(erisimJetonuOAuth, dosyaId) {
  const r = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}/permissions?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${erisimJetonuOAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "writer", type: "user", emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL }),
  });
  if (!r.ok) {
    const h = await r.json().catch(() => ({}));
    throw new Error(h.error?.message || "Servis hesabına yetki verilemedi.");
  }
}

/**
 * BİR MARKANIN DRIVE KLASÖRÜ DOĞRU MU?
 *
 * Sadece "bağlantı dolu mu" bakmak yetmiyor — bağlantı dolu ama BAŞKA bir klasörü
 * gösteriyor olabilir. Bu gerçekten yaşandı: bağlantı marka kökü yerine içeride elle
 * açılmış bir alt klasörü gösteriyordu ve dosyalar bir kat derine gömülüyordu.
 *
 * Bu yüzden klasör Drive'da gerçekten açılıp ADI geri getiriliyor; kullanıcı doğru klasörü
 * seçip seçmediğini gözüyle görebilsin.
 */
export async function klasorDurumu(markaKlasoru) {
  const ham = String(markaKlasoru || "").trim();
  if (!ham) return { durum: "yok", mesaj: "Bağlantı girilmemiş" };

  const id = driveKlasorIdCikar(ham);
  if (!id) return { durum: "gecersiz", mesaj: "Bu bir Drive klasör bağlantısı değil" };

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { durum: "kurulusuz", mesaj: "Drive bağlantısı kurulu değil" };
  }
  try {
    const jeton = await erisimJetonu();
    const r = await getir(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,parents&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    const d = await r.json();
    if (!r.ok) {
      return { durum: "erisilemiyor", mesaj: d.error?.message || "Klasöre erişilemiyor" };
    }
    if (d.mimeType !== "application/vnd.google-apps.folder") {
      return { durum: "gecersiz", mesaj: "Bağlantı bir klasörü değil, bir dosyayı gösteriyor" };
    }
    /* Üst klasörün adı da getiriliyor: "1 SOSYAL MEDYA" tek başına hangi markaya ait
     * olduğunu söylemiyor, "VIZZ / 1 SOSYAL MEDYA" söylüyor. */
    let ust = "";
    if (Array.isArray(d.parents) && d.parents[0]) {
      const u = await getir(`https://www.googleapis.com/drive/v3/files/${d.parents[0]}?fields=name&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${jeton}` } });
      if (u.ok) ust = (await u.json()).name || "";
    }
    /* Sistem gerçekte NEREYE yazacak — gösterilen klasöre mi, içindeki SOSYAL MEDYA'ya mı?
     * Bu iniş sessiz kalırsa kullanıcı raporda marka klasörünü görüp "yanlış" sanır ya da
     * tersine yanlış bir bağlantıyı doğru sanır. Rapor gerçek hedefi söylemek zorunda. */
    /* RAPOR HİÇBİR ŞEY AÇMAZ. "Klasörleri Kontrol Et" düğmesi 17 markanın Drive'ında klasör
     * açsaydı, durum bakmak durumu değiştirmiş olurdu. Bu yüzden olustur=false. */
    const kok = await calismaKoku(jeton, d.id, false);
    const yol = ust ? `${ust} / ${d.name}` : d.name;
    const HEDEF = {
      inildi:      { hedefYol: `${yol} / ${SOSYAL_MEDYA}`, not: "(kendiliğinden inildi)" },
      kendisi:     { hedefYol: yol, not: "" },
      acilacak:    { hedefYol: `${yol} / ${SOSYAL_MEDYA}`, not: "(ilk yüklemede açılacak)" },
      beklenmedik: { hedefYol: yol, not: "(bir ay/aşama klasörünü gösteriyor — bağlantı yanlış olabilir)" },
      yerinde:     { hedefYol: yol, not: "" },
    };
    const h = HEDEF[kok.nasil] || HEDEF.yerinde;

    /* Bu ay yüklenirse dosya tam olarak nereye düşecek? Kullanıcının gözüyle doğrulayabilmesi
     * için yol sonuna kadar yazılıyor. Çalışma kökü henüz açılmamışsa (kok.id yok sayılır)
     * ay klasörü de sorulamaz; o durumda yeni düzenin adı gösteriliyor. */
    let ayYolu = `${new Date().getFullYear()}/${ayKlasoruAdi()}`;
    if (kok.nasil !== "acilacak" && kok.nasil !== "beklenmedik") {
      const ay = await ayKlasoruHazirla(jeton, kok.id, new Date(), false);
      ayYolu = ay.yol;
    }
    return {
      durum: "tamam", klasorAdi: d.name, ustKlasor: ust, yol,
      indi: kok.nasil === "inildi",
      hedefYol: h.hedefYol,
      hedefNot: h.not,
      sosyalMedya: kok.nasil,
      buAyYolu: kok.nasil === "beklenmedik" ? "" : `${ayYolu}/${DURUM_KLASORLERI.onayBekleyen}`,
    };
  } catch (e) {
    return { durum: "erisilemiyor", mesaj: String(e.message || e) };
  }
}
