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
    .replace(/\s*\b(19|20)\d{2}\b\s*/g, " ") // yıl
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const adlarAyniMi = (a, b) => adSadelestir(a) === adSadelestir(b);

/** Bir klasör adı ay adı mı? "AĞUSTOS", "Ağustos", "08 AGUSTOS 2026" hepsi evet. */
function ayMi(ad) {
  const sade = adSadelestir(ad);
  return AYLAR.some((a) => adSadelestir(a) === sade);
}

/**
 * Ay klasörünün ADI: "08 AĞUSTOS 2026"
 *
 * Numara öneki Drive'da klasörlerin takvim sırasında dizilmesini sağlıyor (alfabetik sırada
 * Ağustos, Aralık, Ekim... diye saçmalıyordu). Yıl da adın içinde: gelecek yılın ağustosu
 * ayrı bir klasör olsun, üzerine yazılmasın.
 */
function ayKlasoruAdi(tarih = new Date()) {
  const ay = tarih.getMonth();
  return `${String(ay + 1).padStart(2, "0")} ${AYLAR[ay]} ${tarih.getFullYear()}`;
}

/* AŞAMA KLASÖRLERİ — numaralı, iş sırasına göre dizilsinler diye. */
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
async function klasorBulVeyaOlustur(jeton, ad, ustKlasor) {
  const sorgu = encodeURIComponent(
    `'${ustKlasor}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const ara = await getir(
    `https://www.googleapis.com/drive/v3/files?q=${sorgu}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${jeton}` } },
  );
  const bulunan = await ara.json();
  if (!ara.ok) throw new Error(bulunan.error?.message || "Klasör listelenemedi.");
  const eslesen = (bulunan.files || []).find((f) => adlarAyniMi(f.name, ad));
  if (eslesen) return eslesen.id;

  const olustur = await getir("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: ad, mimeType: "application/vnd.google-apps.folder", parents: [ustKlasor] }),
  });
  const yeni = await olustur.json();
  if (!yeni.id) throw new Error(yeni.error?.message || "Klasör oluşturulamadı.");
  return yeni.id;
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

/**
 * Dosyanın HANGİ AY klasörüne ait olduğunu bulur.
 *
 * NEDEN MEVCUT AY DEĞİL: iş "hangi ay yüklendiyse o ayın klasöründe kalsın" kuralına göre
 * çalışıyor. 30 Ağustos'ta yüklenip 1 Eylül'de onaylanan bir dosya EYLÜL'e sıçramamalı —
 * yoksa aynı işin parçaları iki aya bölünür.
 *
 * Bu yüzden dosyanın şu anki yerine bakılır: zaten markanın bir ay klasörünün altındaysa
 * o ay korunur. Değilse (ilk yerleştirme) içinde bulunulan ay kullanılır.
 */
async function dosyaninAyiniBul(jeton, dosyaParents, markaKoku) {
  const simdikiAy = ayKlasoruAdi();
  for (const ustId of dosyaParents || []) {
    const ust = await klasorBilgisi(jeton, ustId);
    if (!ust) continue;
    // Dosya doğrudan bir ay klasörünün içinde mi?
    if (ayMi(ust.name) && (ust.parents || []).includes(markaKoku)) return ust.name;
    // Dosya <AY>/<DURUM> içinde mi? Bir kat yukarı bak.
    for (const dedeId of ust.parents || []) {
      const dede = await klasorBilgisi(jeton, dedeId);
      if (dede && ayMi(dede.name) && (dede.parents || []).includes(markaKoku)) return dede.name;
    }
  }
  return simdikiAy;
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
    const markaKoku = markaHedef || (markaAdi && kokKlasor ? await klasorBulVeyaOlustur(jeton, markaAdi, kokKlasor) : null);
    if (!markaKoku) return { tasindi: false, sebep: "Bu marka için Drive klasörü tanımlı değil." };

    /* Dosyanın MEVCUT yerini önce öğren: hem ayını buluruz hem de taşırken eski klasörü
     * kaldırmamız gerekir. Sadece yeni klasör eklenirse dosya iki yerde birden görünür. */
    const bilgi = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=parents,name&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    const dosya = await bilgi.json();
    if (!bilgi.ok) return { tasindi: false, sebep: dosya.error?.message || "Dosya bulunamadı." };

    const ayAdi = await dosyaninAyiniBul(jeton, dosya.parents, markaKoku);
    const ayKlasoru = await klasorBulVeyaOlustur(jeton, ayAdi, markaKoku);
    const hedef = await klasorBulVeyaOlustur(jeton, hedefAd, ayKlasoru);
    const yol = `${ayAdi}/${hedefAd}`;

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
export async function hedefKlasoruHazirla({ markaKlasoru, markaAdi, durumAdi, ayAdi }) {
  const markaHedef = driveKlasorIdCikar(markaKlasoru);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, sebep: "Drive kimlik bilgileri tanımlı değil." };
  }
  const kok = process.env.DRIVE_ONAY_KLASOR_ID;
  try {
    const jeton = await erisimJetonu();
    const markaKoku = markaHedef || (markaAdi && kok ? await klasorBulVeyaOlustur(jeton, markaAdi, kok) : null);
    if (!markaKoku) return { ok: false, sebep: "Bu marka için Drive klasörü tanımlı değil." };
    const ay = ayAdi || ayKlasoruAdi();
    const ayKlasoru = await klasorBulVeyaOlustur(jeton, ay, markaKoku);
    const hedef = await klasorBulVeyaOlustur(jeton, durumAdi, ayKlasoru);
    return { ok: true, klasorId: hedef, yol: `${ay}/${durumAdi}`, ayAdi: ay };
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
