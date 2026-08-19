/* ÖNİZLEME GÖRSELİ — YETKİ SINIRLARI
 *
 * NEDEN BU TEST VAR:
 *   Dosyalar Drive'da kısıtlı olduğu için önizleme sunucudan geçiyor. Bu uç, uygulamanın
 *   KENDİ Drive yetkisiyle dosya okuyor — yani sınırları yanlış çizilirse, kimliğini bilen
 *   herkesin her dosyayı okuyabildiği bir kapı olur.
 *
 *   İki şey kritik:
 *     1. MÜŞTERİ yalnızca kendi markasının içeriğini görebilmeli. Bir müşterinin başka bir
 *        müşterinin içeriğini görmesi, bu uygulamada olabilecek en ağır hatalardan biri.
 *     2. Kaynak bağlantı KAYITTAN çözülmeli; tarayıcının verdiği serbest bağlantı
 *        kullanılırsa kayıt doğrulaması hiçbir işe yaramaz.
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
const MUSTERI_A = { "x-musteri-username-b64": b64("ma"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const MUSTERI_B = { "x-musteri-username-b64": b64("mb"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const KILITLI = { "x-staff-username-b64": b64("k"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

const LINK = (id) => `https://drive.google.com/file/d/${id}/view`;

await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "GİZLİ Marka" }],
  cekimIsleri: [
    { id: 10, marka: "VIZZ", icerikTuru: "A", asama: "Kontrol Bekliyor",
      medya: [{ versiyon: 1, dosyaId: "VIZZ_DOSYA" }], gecmis: [] },
    { id: 11, marka: "GİZLİ Marka", icerikTuru: "B", asama: "Kontrol Bekliyor",
      editliDosyaLink: LINK("GIZLI_DOSYA"), gecmis: [] },
    { id: 12, marka: "VIZZ", icerikTuru: "Dosyasız", asama: "Çekim Planlandı", gecmis: [] },
  ],
  musteriIcerikleri: [
    { id: "i1", clientId: 1, tur: "gorsel", driveLinki: LINK("VIZZ_ICERIK"),
      referansLink: LINK("VIZZ_REFERANS"),
      /* Beyaz listede OLMAYAN, bağlantı taşıyan bir alan: serbest alan adı kabul edilirse
       * bu uç kaydın her alanını okuyan bir kapıya döner. */
      gizliNot: LINK("OKUNMAMALI_DOSYA") },
    { id: "i2", clientId: 2, tur: "gorsel", driveLinki: LINK("GIZLI_ICERIK") },
  ],
  personelHesaplari: [
    { id: "k1", ad: "Kilitli", kullaniciAdi: "k", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { cekimEdit: true }, markalar: ["VIZZ"] },
  ],
  musteriHesaplari: [
    { id: "ma1", ad: "A", kullaniciAdi: "ma", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" },
    { id: "mb1", ad: "B", kullaniciAdi: "mb", clientId: 2, sifreHash: hash("1", "s"), sifreSalt: "s" },
  ],
});

console.log("ÖNİZLEME YETKİ SINIRLARI\n");

/* ---- 1. MÜŞTERİ KENDİ İÇERİĞİ ---- */
console.log(" Müşteri");
let r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1" });
t("kendi içeriğini isteyebiliyor", r.kod === 200, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i2" });
t("BAŞKA müşterinin içeriğini göremiyor", r.kod === 403, `HTTP ${r.kod}`);
t("yanıtta başka markanın izi yok", !JSON.stringify(r.govde).includes("GIZLI"), JSON.stringify(r.govde));

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", isId: 10 });
t("kendi markasının kartını isteyebiliyor", r.kod === 200, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", isId: 11 });
t("BAŞKA markanın kartını göremiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_B, { onizlemeAction: "gorsel", icerikId: "i1" });
t("ters yönde de kapalı", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 2. MARKA KİLİTLİ PERSONEL ---- */
console.log("\n Marka kilitli personel");
r = await cagri(KILITLI, { onizlemeAction: "gorsel", isId: 10 });
t("kendi markasını görebiliyor", r.kod === 200, `HTTP ${r.kod}`);
r = await cagri(KILITLI, { onizlemeAction: "gorsel", isId: 11 });
t("başka markayı göremiyor", r.kod === 403, `HTTP ${r.kod}`);
r = await cagri(KILITLI, { onizlemeAction: "gorsel", icerikId: "i2" });
t("başka markanın içeriğini de göremiyor", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 3. KAYNAK KAYITTAN ÇÖZÜLÜYOR ----
 * Tarayıcının verdiği serbest bağlantı kullanılsaydı kayıt doğrulaması işe yaramazdı. */
console.log("\n Kaynak kayıttan çözülüyor");
r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1", link: LINK("BASKASININ_DOSYASI"), driveLinki: LINK("BASKASININ_DOSYASI") });
t("gövdeye konan serbest bağlantı yok sayılıyor", r.kod === 200 && !JSON.stringify(r.govde).includes("BASKASININ"),
  "kaydın kendi bağlantısı kullanılmalı");

r = await cagri(OWNER, { onizlemeAction: "gorsel" });
t("kayıt belirtilmezse 400", r.kod === 400, `HTTP ${r.kod}`);
r = await cagri(OWNER, { onizlemeAction: "gorsel", icerikId: "yok" });
t("olmayan içerik 404", r.kod === 404, `HTTP ${r.kod}`);
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 999 });
t("olmayan kart 404", r.kod === 404, `HTTP ${r.kod}`);

/* ---- 4. DOSYASI OLMAYAN KAYIT ---- */
console.log("\n Dosyasız kayıt ve kurulmamış Drive");
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 12 });
t("dosyası olmayan kart ayırt ediliyor", r.kod === 200 && r.govde.kod === "dosya-yok", r.govde.kod);
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 10 });
t("Drive kurulu değilken çökmüyor", r.kod === 200 && r.govde.ok === false, `HTTP ${r.kod}`);
t("sebep bildiriliyor", Boolean(r.govde.sebep), r.govde.sebep);

/* ---- 5. KİMLİK SIRASI: ÖNCE SERVİS HESABI ----
 *
 * Uygulamanın OAuth izni `drive.file` — bilinçli olarak dar (Google doğrulaması istemesin
 * diye). Ama o izin YALNIZCA uygulamanın kendi yüklediği dosyaları kapsıyor. Drive'a elle
 * konmuş eski dosyalar (yükleme sistemi gelmeden önce açılmış bütün kartlar) o token'a
 * görünmez ve önizleme boş kalır. Gerçekte tam olarak bu yaşandı.
 *
 * Servis hesabı marka klasörlerine üye olduğu için eskileri de okuyabiliyor — bu yüzden
 * ÖNCE o deneniyor. Sıra bozulursa eski kartların hiçbirinde önizleme çıkmaz. */
console.log("\n Kimlik sırası");
{
  const { generateKeyPairSync } = await import("crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey;
  process.env.GOOGLE_OAUTH_CLIENT_ID = "c";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "s";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "r";

  const gercekFetch = globalThis.fetch;
  let kullanilanJetonlar = [];
  /* Servis hesabı çalışıyor, OAuth çalışmıyor: eski dosyaların gerçek durumu bu. */
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com")) {
      const govde = String(opt.body || "");
      const kim = govde.includes("refresh_token") ? "oauth" : "servis";
      kullanilanJetonlar.push(kim);
      return { ok: true, json: async () => ({ access_token: kim }) };
    }
    if (u.includes("drive/v3/files/")) {
      const jeton = String((opt.headers || {}).Authorization || "");
      if (jeton.includes("servis")) {
        return { ok: true, json: async () => ({ thumbnailLink: "https://lh3.googleusercontent.com/x=s220", mimeType: "image/jpeg" }) };
      }
      return { ok: false, json: async () => ({ error: { message: "File not found" } }) };
    }
    if (u.includes("lh3.googleusercontent.com")) {
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        headers: { get: () => "image/jpeg" } };
    }
    return gercekFetch(url, opt);
  };

  try {
    kullanilanJetonlar = [];
    const r5 = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 11 });   // eski, elle konmuş dosya
    t("elle konmuş eski dosyanın önizlemesi geliyor", r5.kod === 200 && r5.govde.ok === true,
      r5.govde.sebep || `HTTP ${r5.kod}`);
    t("ÖNCE servis hesabı deneniyor", kullanilanJetonlar[0] === "servis", kullanilanJetonlar.join(" → "));
    t("servis hesabı yetince OAuth'a hiç gidilmiyor", !kullanilanJetonlar.includes("oauth"),
      kullanilanJetonlar.join(" → "));
    t("veri data URI olarak dönüyor", String(r5.govde.veri || "").startsWith("data:image/"),
      String(r5.govde.veri || "").slice(0, 24));
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

/* ---- 6. İÇERİĞİN HANGİ ALANI ----
 *
 * Müşteri panelinde asıl dosyanın yanında REFERANS VİDEO da gösteriliyor; o ayrı bir alanda
 * duruyor. Alan adı serbest bırakılsaydı bu uç, kaydın herhangi bir alanındaki bağlantıyı
 * okuyan bir kapı olurdu — beyaz liste bu yüzden var. */
console.log("\n İçeriğin hangi alanı");
{
  r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1", alan: "referansLink" });
  t("referans video alanı istenebiliyor", r.kod === 200, `HTTP ${r.kod}`);

  /* HANGİ DOSYANIN İSTENDİĞİNİ GÖRMEK ŞART. Yalnızca yanıta bakmak yetmiyor: Drive kurulu
   * değilken her iki durumda da aynı hata dönüyor ve test hiçbir şey ayırt etmiyor —
   * ilk yazdığım hâl tam olarak böyleydi ve beyaz liste kaldırılınca yine "geçti" diyordu. */
  {
    const gercekFetch = globalThis.fetch;
    const { generateKeyPairSync } = await import("crypto");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = privateKey;

    let istenenDosya = null;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };
      const m = u.match(/drive\/v3\/files\/([^?]+)\?/);
      if (m) { istenenDosya = m[1]; return { ok: false, json: async () => ({ error: { message: "dur" } }) }; }
      return { ok: false, json: async () => ({}) };
    };
    try {
      istenenDosya = null;
      await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1", alan: "gizliNot" });
      t("beyaz listede olmayan alandaki dosya İSTENMİYOR",
        istenenDosya === "VIZZ_ICERIK", `istenen: ${istenenDosya}`);

      istenenDosya = null;
      await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1", alan: "referansLink" });
      t("izinli alan istendiğinde O dosya getiriliyor", istenenDosya === "VIZZ_REFERANS", `istenen: ${istenenDosya}`);
    } finally {
      globalThis.fetch = gercekFetch;
      delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      delete process.env.GOOGLE_PRIVATE_KEY;
    }
  }

  r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1" });
  t("alan verilmezse asıl dosya kullanılıyor", r.kod === 200, `HTTP ${r.kod}`);

  r = await cagri(MUSTERI_A, { onizlemeAction: "videoJetonu", icerikId: "i1", alan: "referansLink" });
  t("referans video için jeton da alınabiliyor", r.kod === 200 && r.govde.ok === true, `HTTP ${r.kod}`);

  r = await cagri(MUSTERI_B, { onizlemeAction: "gorsel", icerikId: "i1", alan: "referansLink" });
  t("başka müşteri referans videoyu da göremiyor", r.kod === 403, `HTTP ${r.kod}`);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
