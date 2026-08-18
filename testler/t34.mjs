/* KART İÇİNDEN MEDYA YÜKLEME — yetki, versiyon ve veri güvenliği
 *
 * NEDEN BU TEST VAR:
 *   1. Yükleme uçları marka kilidini deliyor mu — personel başka markanın kartına
 *      dosya yükleyebilmemeli.
 *   2. Sunucu yükleme sonrası KV'ye YAZMAMALI. Yazarsa _v sayacı artar, tarayıcı geride
 *      kalır, sonraki kayıt sahte staleConflict alır ve kullanıcının düzenlemesi silinir.
 *      Bu hata bu projede bir kez yaşandı; testi olmadan tekrar eder.
 *   3. Versiyon numarası SUNUCUDA hesaplanmalı — tarayıcıdan gelene güvenilirse iki kişi
 *      aynı anda yüklediğinde aynı numarayı alır.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_OAUTH_CLIENT_ID;
delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const KILITLI = { "x-staff-username-b64": b64("k"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const IZINSIZ = { "x-staff-username-b64": b64("i"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const MUSTERI = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const VERI = () => ({
  _v: 1,
  clients: [
    { id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" },
    { id: 2, ad: "GİZLİ Marka", driveOnayKlasoru: "https://drive.google.com/drive/folders/1ZzZdefGHIjklMNOpqrs" },
  ],
  cekimIsleri: [
    { id: 7, marka: "VIZZ", kategori: "Video", icerikTuru: "Sivrisinek Kampanya", asama: "Edit Yapılıyor",
      medya: [{ versiyon: 1, dosyaId: "aaa", ad: "VIZZ_SIVRISINEK_KAMPANYA_V1.mp4" },
              { versiyon: 2, dosyaId: "bbb", ad: "VIZZ_SIVRISINEK_KAMPANYA_V2.mp4" }], gecmis: [] },
    { id: 9, marka: "GİZLİ Marka", kategori: "Video", icerikTuru: "X", asama: "Edit Yapılıyor", gecmis: [] },
  ],
  personelHesaplari: [
    { id: "k1", ad: "Kilitli", kullaniciAdi: "k", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { cekimEdit: true }, markalar: ["VIZZ"] },
    /* cekimEdit AÇIKÇA false. DEFAULT_PERMS.cekimEdit varsayılanı true olduğu için,
     * anahtarı hiç yazmamak yetki VERİR — bu uygulamanın kuralı. Yetkisizliği sınamak
     * için açıkça kapatmak gerekiyor. */
    { id: "i1", ad: "İzinsiz", kullaniciAdi: "i", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { paylasimlar: true, cekimEdit: false } },
  ],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
});

const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

console.log("MEDYA YÜKLEME\n");

/* ---- 1. YETKİ SINIRLARI ---- */
console.log(" Kimler yükleyebilir");
await kv.set("marcus-os-data", VERI());
let r = await cagri(MUSTERI, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("müşteri hesabı yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(IZINSIZ, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("cekimEdit izni olmayan personel yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(KILITLI, { driveAction: "yuklemeBasla", isId: 9, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("marka kilitli personel BAŞKA markaya yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);
t("yanıtta başka markanın adı sızmıyor", !JSON.stringify(r.govde).includes("GİZLİ"));

r = await cagri(OWNER, { driveAction: "yuklemeBasla", isId: 999, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("olmayan kart 404", r.kod === 404, `HTTP ${r.kod}`);

/* ---- 2. KURULU DEĞİLKEN ---- */
console.log("\n Drive yükleme kurulu değilken");
r = await cagri(OWNER, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("anlaşılır hata dönüyor, çökmüyor", r.kod === 400 && /kurulu değil/i.test(r.govde.error || ""), r.govde.error);
let d = await kv.get("marcus-os-data");
t("veri bozulmadı", (d.cekimIsleri || []).length === 2 && d._v === 1);

/* ---- 3. SUNUCU KV'YE YAZMAMALI (veri kaybı koruması) ---- */
console.log("\n Sunucu kendi başına yazmıyor mu");
const oncekiV = (await kv.get("marcus-os-data"))._v;
r = await cagri(OWNER, { driveAction: "yuklemeBitti", isId: 7, dosyaId: "zzz" });
d = await kv.get("marcus-os-data");
t("_v ARTMADI (tarayıcı geride kalmaz)", d._v === oncekiV, `önce ${oncekiV} / sonra ${d._v}`);
t("medya listesi sunucudan değişmedi", (d.cekimIsleri[0].medya || []).length === 2);

/* ---- 4. GEÇERSİZ İŞLEM ---- */
console.log("\n Geçersiz istekler");
r = await cagri(OWNER, { driveAction: "olmayanIslem", isId: 7 });
t("bilinmeyen işlem reddediliyor", r.kod === 400, `HTTP ${r.kod}`);
r = await cagri(OWNER, { driveAction: "yuklemeBitti", isId: 7 });
t("dosyaId eksikse reddediliyor", r.kod === 400, `HTTP ${r.kod}`);

/* ---- 5. DOSYA ADI ÜRETİMİ ---- */
console.log("\n Otomatik dosya adlandırma");
const { dosyaAdiUret } = await import("../lib/drive-yukleme.js");
t("Türkçe karakterler sadeleşiyor",
  dosyaAdiUret({ marka: "ÇORBACI ŞEMSİ", icerikAdi: "Güncel İçerik", versiyon: 3, orijinalAd: "x.mp4" })
    === "CORBACI_SEMSI_GUNCEL_ICERIK_V3.mp4",
  dosyaAdiUret({ marka: "ÇORBACI ŞEMSİ", icerikAdi: "Güncel İçerik", versiyon: 3, orijinalAd: "x.mp4" }));
t("uzantı MIME türünden çıkarılıyor",
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "R", versiyon: 1, orijinalAd: "", mimeTur: "image/jpeg" }) === "VIZZ_R_V1.jpg");
t("uzantı orijinal addan korunuyor",
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "R", versiyon: 2, orijinalAd: "kamera.MOV" }) === "VIZZ_R_V2.mov");
t("boş içerik adında da geçerli ad üretiliyor",
  /^VIZZ_V1\./.test(dosyaAdiUret({ marka: "VIZZ", icerikAdi: "", versiyon: 1, orijinalAd: "a.mp4" })),
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "", versiyon: 1, orijinalAd: "a.mp4" }));

/* ---- 6. ORIGIN BAŞLIĞI — bu satır olmadan yükleme tarayıcıda ÇALIŞMIYORDU ----
 *
 * Google, yükleme oturumu açılırken Origin gönderilmezse ASIL yükleme yanıtına
 * Access-Control-Allow-Origin koymuyor. Ön kontrol yine de izin verdiği için sorun gizli
 * kalıyor: dosya Google'a yükleniyor (HTTP 200) ama tarayıcı yanıtı okuyamayıp "Load failed"
 * diyor. Canlıda tam olarak bu yaşandı ve teşhisi saatler aldı.
 *
 * Ölçülen davranış:
 *   Origin olmadan → PUT 200, ACAO YOK  → tarayıcı reddeder
 *   Origin ile     → PUT 200, ACAO var  → tarayıcı okur
 */
console.log("\n Origin başlığı Google'a iletiliyor mu");
{
  const { generateKeyPairSync } = await import("crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.GOOGLE_OAUTH_CLIENT_ID = "x";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "y";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "z";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey;

  const { yuklemeOturumuAc } = await import("../lib/drive-yukleme.js");
  const gercekFetch = globalThis.fetch;
  let yuklemeBasliklari = null;

  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    if (u.includes("/upload/drive/")) {
      yuklemeBasliklari = opt.headers || {};
      return { ok: true, status: 200, headers: new Map([["location", "https://ornek/yukle"]]), json: async () => ({}) };
    }
    if (u.includes("drive/v3/files?q=")) {           // klasör arama
      return { ok: true, status: 200, json: async () => ({ files: [{ id: "klasor1", name: "AĞUSTOS" }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };

  const cagir2 = (origin) => yuklemeOturumuAc({
    markaKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs",
    markaAdi: "VIZZ", icerikAdi: "Test", versiyon: 1, orijinalAd: "a.mp4",
    mimeTur: "video/mp4", boyut: 10, origin,
  });

  const s1 = await cagir2("https://marcus-os-iota.vercel.app");
  t("oturum açıldı", s1.ok === true, s1.sebep || "");
  t("geçerli Origin Google'a İLETİLİYOR",
    !!yuklemeBasliklari && yuklemeBasliklari.Origin === "https://marcus-os-iota.vercel.app",
    yuklemeBasliklari ? String(yuklemeBasliklari.Origin) : "istek yapılmadı");

  yuklemeBasliklari = null;
  await cagir2("javascript:kotu");
  t("geçersiz Origin başlığa GİRMİYOR",
    !!yuklemeBasliklari && yuklemeBasliklari.Origin === undefined,
    yuklemeBasliklari ? String(yuklemeBasliklari.Origin) : "istek yapılmadı");

  yuklemeBasliklari = null;
  await cagir2("");
  t("boş Origin başlığa girmiyor",
    !!yuklemeBasliklari && yuklemeBasliklari.Origin === undefined);

  globalThis.fetch = gercekFetch;
}

/* ---- 7. KLASÖR ADI EŞLEŞTİRME — mevcut klasörler yeniden kullanılmalı ----
 *
 * Gerçek Drive'da aynı klasör üç ayrı yazımla duruyor: "AĞUSTOS", "Ağustos",
 * "08 AGUSTOS 2026". Katı eşleştirme yapılırsa sistem var olanı bulamayıp yenisini açar,
 * dosyalar ikiye bölünür ve kimse fark etmez. Bir markada tam olarak bu oldu. */
console.log("\n Klasör adı eşleştirme");
{
  const { DURUM_KLASORLERI } = await import("../lib/drive-tasima.js");
  t("durum klasörleri numaralı", DURUM_KLASORLERI.onayBekleyen === "1 ONAY BEKLEYENLER"
    && DURUM_KLASORLERI.onaylanan === "2 ONAYLANANLAR"
    && DURUM_KLASORLERI.paylasilan === "3 PAYLAŞILDI",
    Object.values(DURUM_KLASORLERI).join(" | "));

  /* klasorBulVeyaOlustur dışa açık değil; davranışı hedefKlasoruHazirla üzerinden,
   * Drive'ı taklit ederek sınıyoruz. */
  const { generateKeyPairSync } = await import("crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey;
  const { hedefKlasoruHazirla } = await import("../lib/drive-tasima.js");

  const gercekFetch = globalThis.fetch;
  let acilanKlasorler = [];
  const kur = (mevcutlar) => {
    acilanKlasorler = [];
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };
      if (u.includes("files?q=")) {
        const ust = decodeURIComponent(u.match(/'([^']+)'\+?in\+?parents|%27([^%]+)%27/) ? "" : "");
        return { ok: true, json: async () => ({ files: mevcutlar.map((ad, i) => ({ id: "m" + i, name: ad })) }) };
      }
      if (u.includes("drive/v3/files?fields=id") && opt.method === "POST") {
        const govde = JSON.parse(opt.body || "{}");
        acilanKlasorler.push(govde.name);
        return { ok: true, json: async () => ({ id: "yeni" }) };
      }
      return { ok: true, json: async () => ({}) };
    };
  };

  // Drive'da "08 AGUSTOS 2026" (Ğ'siz) ve "PAYLAŞILDI" (numarasız) var
  kur(["08 AGUSTOS 2026", "PAYLAŞILDI"]);
  await hedefKlasoruHazirla({ markaKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs",
    markaAdi: "VIZZ", durumAdi: DURUM_KLASORLERI.paylasilan });
  t("Ğ'siz ay klasörü YENİDEN KULLANILDI", !acilanKlasorler.some((a) => /A[ĞG]USTOS/i.test(a)),
    acilanKlasorler.join(", ") || "hiç klasör açılmadı");
  t("numarasız PAYLAŞILDI yeniden kullanıldı", !acilanKlasorler.some((a) => /PAYLA/i.test(a)),
    acilanKlasorler.join(", ") || "hiç klasör açılmadı");

  // Hiçbiri yoksa yeni ve NUMARALI adla açılmalı
  kur([]);
  await hedefKlasoruHazirla({ markaKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs",
    markaAdi: "VIZZ", durumAdi: DURUM_KLASORLERI.onayBekleyen });
  t("eksik klasörler numaralı adla açılıyor",
    acilanKlasorler.some((a) => /^\d\d .+ \d{4}$/.test(a)) && acilanKlasorler.includes("1 ONAY BEKLEYENLER"),
    acilanKlasorler.join(", "));

  globalThis.fetch = gercekFetch;
}

/* ---- 8. KLASÖR DURUM RAPORU ----
 *
 * "Bağlantı dolu mu" bakmak yetmiyor: dolu ama BAŞKA klasörü gösteriyor olabilir. VIZZ'de
 * tam olarak bu yaşandı, dosyalar bir kat derine gömüldü ve hiçbir yerde uyarı yoktu. */
console.log("\n Klasör durum raporu");
{
  await kv.set("marcus-os-data", { ...VERI(),
    clients: [
      { id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" },
      { id: 2, ad: "BOŞ MARKA" },
      { id: 3, ad: "BOZUK MARKA", driveOnayKlasoru: "bu bir bağlantı değil" },
    ] });
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;

  const r = await cagri(OWNER, { driveAction: "klasorDurumu" });
  t("rapor dönüyor", r.kod === 200 && Array.isArray(r.govde.markalar), `HTTP ${r.kod}`);
  const bul = (ad) => (r.govde.markalar || []).find((m) => m.ad === ad) || {};
  t("bağlantısı olmayan marka 'yok' işaretleniyor", bul("BOŞ MARKA").durum === "yok", bul("BOŞ MARKA").durum);
  t("bozuk bağlantı 'gecersiz' işaretleniyor", bul("BOZUK MARKA").durum === "gecersiz", bul("BOZUK MARKA").durum);
  t("Drive kurulu değilken çökmüyor", bul("VIZZ").durum === "kurulusuz", bul("VIZZ").durum);
  t("üç markanın da durumu var", (r.govde.markalar || []).length === 3);

  // marka kilitli personel yalnızca kendi markasını görmeli
  const rk = await cagri(KILITLI, { driveAction: "klasorDurumu" });
  t("marka kilitli personel sadece kendi markasını görüyor",
    rk.kod === 200 && (rk.govde.markalar || []).length === 1 && rk.govde.markalar[0].ad === "VIZZ",
    `${(rk.govde.markalar || []).length} marka`);
  t("başka markanın adı sızmıyor", !JSON.stringify(rk.govde).includes("BOZUK"));

  const rm = await cagri(MUSTERI, { driveAction: "klasorDurumu" });
  t("müşteri hesabı rapor alamıyor", rm.kod === 403, `HTTP ${rm.kod}`);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
