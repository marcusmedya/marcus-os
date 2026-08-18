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

/** Klasörü ada göre bulur, yoksa oluşturur. Her markanın onaylıları kendi klasörüne düşsün. */
async function klasorBulVeyaOlustur(jeton, ad, ustKlasor) {
  const temizAd = String(ad).replace(/'/g, "\\'");
  const sorgu = encodeURIComponent(
    `name='${temizAd}' and '${ustKlasor}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const ara = await getir(`https://www.googleapis.com/drive/v3/files?q=${sorgu}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  const bulunan = await ara.json();
  if (bulunan.files && bulunan.files.length > 0) return bulunan.files[0].id;

  const olustur = await getir("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: ad, mimeType: "application/vnd.google-apps.folder", parents: [ustKlasor] }),
  });
  const yeni = await olustur.json();
  if (!yeni.id) throw new Error(yeni.error?.message || "Klasör oluşturulamadı.");
  return yeni.id;
}

/**
 * Onaylanan dosyayı hedef klasöre taşır.
 *
 * ASLA HATA FIRLATMAZ: taşıma başarısız olsa bile müşterinin onayı geçerli kalmalıdır.
 * Sonuç nesnesi döner, çağıran taraf isterse kaydeder.
 */
const AYLAR = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
               "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];

/**
 * Markanın ana klasörü altında "<ÜST>/<AY>" yolunu kurar, yoksa oluşturur.
 *
 * Örn. İBO BURGER/ONAYLANANLAR/AĞUSTOS
 * Üst klasör (ONAYLANANLAR) zaten varsa yeniden kullanılır; yalnızca eksik olan oluşturulur.
 * Ay ayrımı sonradan aramayı kolaylaştırır — bir markanın klasöründe yüzlerce dosya birikmez.
 */
async function ayKlasoruKur(jeton, markaKlasoru, ustAd) {
  const ust = await klasorBulVeyaOlustur(jeton, ustAd, markaKlasoru);
  const ayAdi = AYLAR[new Date().getMonth()];
  return klasorBulVeyaOlustur(jeton, ayAdi, ust);
}

export async function onaylananiTasi({ dosyaLinki, markaAdi, markaKlasoru, hedefAd = "ONAYLANANLAR" }) {
  /* HEDEF KLASÖR iki kaynaktan gelebilir:
   *  1. markaKlasoru — müşteri kaydındaki "Drive Onay Klasörü". Her markanın kendi klasör
   *     düzeni olduğu için ASIL YOL budur.
   *  2. DRIVE_ONAY_KLASOR_ID — ortak bir üst klasör; markanın kendi klasörü tanımlı değilse
   *     içinde marka adıyla alt klasör açılır.
   * İkisi de yoksa taşıma yapılmaz ve onay normal tamamlanır. */
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
    /* Markanın ana klasörü verilmişse içinde "<hedefAd>/<AY>" yolu kurulur.
     * Verilmemişse ortak kök klasör altında marka adıyla klasör açılır (eski davranış). */
    const markaKoku = markaHedef || (markaAdi && kokKlasor ? await klasorBulVeyaOlustur(jeton, markaAdi, kokKlasor) : null);
    if (!markaKoku) return { tasindi: false, sebep: "Bu marka için Drive klasörü tanımlı değil." };
    const hedef = await ayKlasoruKur(jeton, markaKoku, hedefAd);
    const ayAdi = AYLAR[new Date().getMonth()];

    /* Mevcut klasörleri öğrenmek şart: taşımak, eski klasörü KALDIRIP yenisini eklemektir.
     * Sadece eklenirse dosya iki klasörde birden görünür. */
    const bilgi = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=parents,name&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    const dosya = await bilgi.json();
    if (!bilgi.ok) return { tasindi: false, sebep: dosya.error?.message || "Dosya bulunamadı." };

    const eskiler = (dosya.parents || []).join(",");
    if ((dosya.parents || []).includes(hedef)) {
      return { tasindi: false, sebep: `Dosya zaten ${hedefAd}/${ayAdi} klasöründe.`, zatenOrada: true };
    }

    const tasi = await getir(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?addParents=${hedef}${eskiler ? `&removeParents=${eskiler}` : ""}&fields=id,parents&supportsAllDrives=true`,
      { method: "PATCH", headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" }, body: "{}" },
    );
    const sonuc = await tasi.json();
    if (!tasi.ok) return { tasindi: false, sebep: sonuc.error?.message || "Taşınamadı." };
    return { tasindi: true, dosyaAdi: dosya.name || "", klasor: `${hedefAd}/${ayAdi}` };
  } catch (e) {
    return { tasindi: false, sebep: String(e.message || e) };
  }
}
