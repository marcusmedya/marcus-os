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
    acilanKlasorler.some((a) => /^\d\d [A-ZÇĞİÖŞÜ]+$/.test(a)) && acilanKlasorler.includes("1 ONAY BEKLEYENLER"),
    acilanKlasorler.join(", "));
  t("yıl klasörü de açılıyor", acilanKlasorler.some((a) => /^(19|20)\d{2}$/.test(a)),
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

/* ---- 9. SOSYAL MEDYA KLASÖRÜNE KENDİLİĞİNDEN İNME ----
 *
 * Müşteri kaydına marka klasörü de girilebiliyor, "1 SOSYAL MEDYA" klasörü de; ikisi de
 * geçerli bir bağlantı gibi görünüyor. Marka klasörü girildiğinde ay klasörleri markanın
 * köküne, LOGO ve PROFİL'in yanına açılıyordu — BİNPARK AVM'de tam olarak bu yaşandı.
 *
 * Bu testler olmadan iniş sessizce bozulabilir: iniş kaybolursa klasörler yine açılır,
 * sistem hata vermez, sadece YANLIŞ YERE açar. Kimse fark etmez. */
console.log("\n SOSYAL MEDYA klasörüne inme");
{
  const { hedefKlasoruHazirla, onaylananiTasi, klasorDurumu, DURUM_KLASORLERI } =
    await import("../lib/drive-tasima.js");
  /* Bir önceki bölüm kimlik değişkenlerini siliyor; burada gerçek bir anahtar gerekiyor
   * çünkü imzalama adımı sahte metinle çalışmaz. */
  {
    const { generateKeyPairSync } = await import("crypto");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = privateKey;
  }
  const MARKA_KOK = "1AbCdefGHIjklMNOpqrs";
  const LINK = `https://drive.google.com/drive/folders/${MARKA_KOK}`;

  const gercekFetch = globalThis.fetch;
  let acilan = [];        // { ad, ust }
  let tasimaHedefi = null;

  /* Üst klasöre GÖRE cevap veren taklit Drive: iniş ancak böyle sınanabilir, tek listeyle
   * dönen bir taklit "hangi klasörün altına açıldı" sorusunu hiç sormaz. */
  const kur = (agac, dosyaUstleri = ["baska"]) => {
    acilan = []; tasimaHedefi = null;
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };

      if (u.includes("files?q=")) {
        /* encodeURIComponent tek tırnağı KAÇIRMAZ (' korunur), ama biçim değişirse diye
         * her iki yazımı da tanıyoruz. */
        const m = u.match(/'([^']+)'/) || u.match(/%27([^%]+)%27/);
        const ust = m ? m[1] : "";
        return { ok: true, json: async () => ({ files: agac[ust] || [] }) };
      }
      if (u.includes("drive/v3/files?fields=id") && opt.method === "POST") {
        const govde = JSON.parse(opt.body || "{}");
        acilan.push({ ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, json: async () => ({ id: `yeni:${govde.name}` }) };
      }
      // Taşınacak dosyanın bilgisi
      if (/drive\/v3\/files\/[^?]+\?fields=parents/.test(u)) {
        return { ok: true, json: async () => ({ parents: dosyaUstleri, name: "V1.mp4" }) };
      }
      // Klasör bilgisi (klasorDurumu ve ay tespiti)
      const km = u.match(/drive\/v3\/files\/([^?]+)\?fields=/);
      if (km && opt.method === undefined) {
        const id = km[1];
        return { ok: true, json: async () => ({
          id, name: id === MARKA_KOK ? "BİNPARK AVM" : id === "sos" ? "1 SOSYAL MEDYA" : id,
          mimeType: "application/vnd.google-apps.folder",
          parents: id === MARKA_KOK ? ["ustkok"] : [],
        }) };
      }
      if (opt.method === "PATCH") {
        tasimaHedefi = (u.match(/addParents=([^&]+)/) || [])[1] || null;
        return { ok: true, json: async () => ({ id: "d", parents: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    };
  };

  // (a) Bağlantı MARKA klasörünü gösteriyor, içinde SOSYAL MEDYA var → inilmeli
  kur({ [MARKA_KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }, { id: "logo", name: "LOGO" }], sos: [] });
  let s = await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "BİNPARK AVM",
    durumAdi: DURUM_KLASORLERI.onayBekleyen });
  const yilKaydi = acilan.find((a) => /^(19|20)\d{2}$/.test(a.ad));
  t("yıl klasörü SOSYAL MEDYA'nın içine açılıyor", Boolean(yilKaydi) && yilKaydi.ust === "sos",
    yilKaydi ? `üst: ${yilKaydi.ust}` : "yıl klasörü hiç açılmadı");
  t("hiçbir klasör marka KÖKÜNE açılmıyor", !acilan.some((a) => a.ust === MARKA_KOK),
    acilan.map((a) => `${a.ad}@${a.ust}`).join(", "));
  t("yükleme hedefi hazırlandı", s.ok === true, s.sebep || "");

  // (b) "1 " öneki olmadan da tanınmalı — Drive'da yazımlar tutarsız
  kur({ [MARKA_KOK]: [{ id: "sos", name: "SOSYAL MEDYA" }], sos: [] });
  await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "X", durumAdi: DURUM_KLASORLERI.onayBekleyen });
  t("numarasız 'SOSYAL MEDYA' da tanınıyor", acilan.every((a) => a.ust !== MARKA_KOK),
    acilan.map((a) => `${a.ad}@${a.ust}`).join(", "));

  // (c) Marka klasöründe SOSYAL MEDYA hiç yoksa sistem onu açar; ay klasörü yine kökte kalmaz
  kur({ [MARKA_KOK]: [{ id: "ay0", name: "07 TEMMUZ 2026" }] });
  await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "X", durumAdi: DURUM_KLASORLERI.onayBekleyen });
  const yilB = acilan.find((a) => /^(19|20)\d{2}$/.test(a.ad));
  t("SOSYAL MEDYA yokken de yıl klasörü marka köküne açılmıyor", Boolean(yilB) && yilB.ust !== MARKA_KOK,
    yilB ? `üst: ${yilB.ust}` : "yıl klasörü açılmadı");

  // (d) Taşıma da aynı yere inmeli — yükleme ve taşıma ayrışırsa dosya kaybolur
  kur({ [MARKA_KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }], sos: [] });
  await onaylananiTasi({ dosyaLinki: "https://drive.google.com/file/d/DOSYA123456/view",
    markaKlasoru: LINK, markaAdi: "BİNPARK AVM", hedefAd: DURUM_KLASORLERI.onaylanan });
  t("taşıma da SOSYAL MEDYA'nın içine yapılıyor", acilan.length > 0 && acilan.every((a) => a.ust !== MARKA_KOK),
    acilan.map((a) => `${a.ad}@${a.ust}`).join(", "));
  t("dosya gerçekten taşındı", Boolean(tasimaHedefi), String(tasimaHedefi));

  // (e) Durum raporu inişi SÖYLEMELİ — sessiz kalırsa kullanıcı doğru bağlantıyı yanlış sanır
  kur({ [MARKA_KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }], sos: [] });
  const rapor = await klasorDurumu(LINK);
  t("rapor inişi bildiriyor", rapor.durum === "tamam" && rapor.indi === true, `${rapor.durum} / indi=${rapor.indi}`);
  t("rapor GERÇEK hedef yolu gösteriyor", /SOSYAL MEDYA$/.test(rapor.hedefYol || ""), rapor.hedefYol);

  kur({ [MARKA_KOK]: [{ id: "ay0", name: "07 TEMMUZ 2026" }] });
  const rapor2 = await klasorDurumu(LINK);
  t("SOSYAL MEDYA yoksa rapor 'açılacak' diyor, 'inildi' demiyor",
    rapor2.indi === false && rapor2.sosyalMedya === "acilacak", `${rapor2.sosyalMedya} / indi=${rapor2.indi}`);

  globalThis.fetch = gercekFetch;
}

/* ---- 10. AY / YIL DÜZENİ ----
 *
 * Düzen:  <marka>/1 SOSYAL MEDYA/<yıl>/<AY>/<AŞAMA>
 *
 * Sınanan üç şey:
 *   - ay geçişinde ayrı klasör açılıyor, var olan yeniden kullanılıyor
 *   - YIL DÖNÜMÜ: 2027'nin ağustosu 2026'nınkine düşmüyor (bu gerçek bir hataydı)
 *   - ESKİ DÜZEN terk edilmiyor: Drive'da zaten "08 AĞUSTOS 2026" varsa yanına
 *     "2026/08 AĞUSTOS" kurulmuyor. Yoksa aynı ayın dosyaları ikiye bölünür. */
console.log("\n Ay / yıl düzeni");
{
  const { hedefKlasoruHazirla, DURUM_KLASORLERI } = await import("../lib/drive-tasima.js");
  const { generateKeyPairSync } = await import("crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey;

  const KOK = "1AbCdefGHIjklMNOpqrs";
  const LINK = `https://drive.google.com/drive/folders/${KOK}`;
  const gercekFetch = globalThis.fetch;
  let acilan = [];

  /* Takvim ileri sarılıyor: sistem "bugünün" ayına göre klasör seçtiği için, gelecekteki
   * davranışı sınamanın tek yolu saati oynatmak. */
  const gercekDate = globalThis.Date;
  const saatiKur = (isoTarih) => {
    class SahteDate extends gercekDate {
      constructor(...a) { super(...(a.length ? a : [isoTarih])); }
      static now() { return new gercekDate(isoTarih).getTime(); }
    }
    globalThis.Date = SahteDate;
  };

  /* agac: klasör kimliği -> alt klasörleri. Marka kökünde SOSYAL MEDYA var. */
  const kur = (agac) => {
    acilan = [];
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };
      if (u.includes("files?q=")) {
        const ust = (u.match(/'([^']+)'/) || [])[1] || "";
        if (ust === KOK) return { ok: true, json: async () => ({ files: [{ id: "sos", name: "1 SOSYAL MEDYA" }] }) };
        return { ok: true, json: async () => ({ files: agac[ust] || [] }) };
      }
      if (u.includes("drive/v3/files?fields=id") && opt.method === "POST") {
        const govde = JSON.parse(opt.body || "{}");
        acilan.push({ ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, json: async () => ({ id: `yeni:${govde.name}` }) };
      }
      return { ok: true, json: async () => ({}) };
    };
  };

  const yukle = () => hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "VIZZ",
    durumAdi: DURUM_KLASORLERI.onayBekleyen });
  const adlar = () => acilan.map((a) => a.ad).join(", ") || "hiçbir şey açılmadı";

  try {
    // (a) SIFIRDAN: yıl ve ay klasörü açılmalı, aşama ayın içine girmeli
    saatiKur("2026-08-18T10:00:00Z");
    kur({ sos: [] });
    let s = await yukle();
    t("yıl klasörü açılıyor", acilan.some((a) => a.ad === "2026" && a.ust === "sos"), adlar());
    t("ay klasörü yılın içine açılıyor",
      acilan.some((a) => a.ad === "08 AĞUSTOS" && a.ust === "yeni:2026"), adlar());
    t("aşama klasörü ayın içine açılıyor",
      acilan.some((a) => a.ad === "1 ONAY BEKLEYENLER" && a.ust === "yeni:08 AĞUSTOS"), adlar());
    t("yol tam", s.yol === "2026/08 AĞUSTOS/1 ONAY BEKLEYENLER", s.yol);

    // (b) AY GEÇİŞİ: eylülde ağustosun yanına ayrı klasör
    saatiKur("2026-09-15T10:00:00Z");
    kur({ sos: [{ id: "y26", name: "2026" }], y26: [{ id: "a08", name: "08 AĞUSTOS" }] });
    s = await yukle();
    t("eylülde ayrı ay klasörü açılıyor",
      acilan.some((a) => a.ad === "09 EYLÜL" && a.ust === "y26"), adlar());
    t("var olan yıl klasörü yeniden kullanılıyor", !acilan.some((a) => a.ad === "2026"), adlar());
    t("ağustos klasörü eylül için kullanılmıyor", s.yol.startsWith("2026/09 EYLÜL"), s.yol);

    // (c) AYNI AY TEKRAR: hiçbir şey açılmamalı
    kur({ sos: [{ id: "y26", name: "2026" }], y26: [{ id: "a09", name: "09 EYLÜL" }],
          a09: [{ id: "ob", name: "1 ONAY BEKLEYENLER" }] });
    await yukle();
    t("aynı ay ikinci kez klasör açmıyor", acilan.length === 0, adlar());

    // (d) YIL DÖNÜMÜ — asıl hata buydu
    saatiKur("2027-08-10T10:00:00Z");
    kur({ sos: [{ id: "y26", name: "2026" }], y26: [{ id: "a08", name: "08 AĞUSTOS" }] });
    s = await yukle();
    t("2027 için ayrı yıl klasörü açılıyor",
      acilan.some((a) => a.ad === "2027" && a.ust === "sos"), adlar());
    t("2027 ağustosu 2026'nın klasörüne DÜŞMÜYOR", s.yol === "2027/08 AĞUSTOS/1 ONAY BEKLEYENLER", s.yol);

    // (e) OCAK 2027 — ay numarası ve yıl birlikte doğru
    saatiKur("2027-01-05T10:00:00Z");
    kur({ sos: [] });
    s = await yukle();
    t("ocak '01 OCAK' adıyla, 2027'nin içine açılıyor",
      s.yol === "2027/01 OCAK/1 ONAY BEKLEYENLER", s.yol);

    // (f) ESKİ DÜZEN KORUNUYOR: "08 AĞUSTOS 2026" duruyorsa yeni yapı kurulmamalı
    saatiKur("2026-08-18T10:00:00Z");
    kur({ sos: [{ id: "duz", name: "08 AĞUSTOS 2026", createdTime: "2026-08-01T00:00:00Z" }] });
    s = await yukle();
    t("var olan düz ay klasörü kullanılıyor, yanına yıl yapısı kurulmuyor",
      !acilan.some((a) => a.ad === "2026") && s.yol === "08 AĞUSTOS 2026/1 ONAY BEKLEYENLER", `${s.yol} | ${adlar()}`);

    // (g) Yılsız eski klasör: kendi yılında kullanılır, sonraki yılda kullanılmaz
    kur({ sos: [{ id: "duz", name: "AĞUSTOS", createdTime: "2026-03-01T00:00:00Z" }] });
    s = await yukle();
    t("yılsız eski klasör kendi yılında kullanılıyor", s.yol === "AĞUSTOS/1 ONAY BEKLEYENLER", s.yol);

    saatiKur("2027-08-10T10:00:00Z");
    kur({ sos: [{ id: "duz", name: "AĞUSTOS", createdTime: "2026-03-01T00:00:00Z" }] });
    s = await yukle();
    t("yılsız eski klasör SONRAKİ yılda kullanılmıyor", s.yol === "2027/08 AĞUSTOS/1 ONAY BEKLEYENLER", s.yol);
  } finally {
    globalThis.Date = gercekDate;
    globalThis.fetch = gercekFetch;
  }
}

/* ---- 11. SOSYAL MEDYA KLASÖRÜ YOKSA AÇILSIN ----
 *
 * Yeni bir marka eklendiğinde klasör yapısının elle kurulmasını beklemek, unutulacak bir adım
 * demek. Sistem kendi çalışma alanını kendisi kuruyor. Ama körlemesine değil: bağlantı
 * yanlışlıkla bir ay ya da aşama klasörünü gösteriyorsa açmak durumu daha da bozar. */
console.log("\n SOSYAL MEDYA klasörünü kendi açma");
{
  const { hedefKlasoruHazirla, klasorDurumu, DURUM_KLASORLERI } = await import("../lib/drive-tasima.js");
  const KOK = "1AbCdefGHIjklMNOpqrs";
  const LINK = `https://drive.google.com/drive/folders/${KOK}`;
  const gercekFetch = globalThis.fetch;
  let acilan = [];

  const kur = (kokAdi, cocuklar) => {
    acilan = [];
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };
      if (u.includes("files?q=")) {
        const ust = (u.match(/'([^']+)'/) || [])[1] || "";
        return { ok: true, json: async () => ({ files: ust === KOK ? cocuklar : [] }) };
      }
      if (u.includes("drive/v3/files?fields=id") && opt.method === "POST") {
        const govde = JSON.parse(opt.body || "{}");
        acilan.push({ ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, json: async () => ({ id: `yeni:${govde.name}` }) };
      }
      const km = u.match(/drive\/v3\/files\/([^?]+)\?fields=/);
      if (km) {
        const id = km[1];
        return { ok: true, json: async () => ({ id, name: id === KOK ? kokAdi : id,
          mimeType: "application/vnd.google-apps.folder", parents: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    };
  };

  try {
    // (a) Marka klasörü, içinde SOSYAL MEDYA yok → sistem açmalı ve ay klasörünü ONUN içine koymalı
    kur("YENİ MARKA", [{ id: "logo", name: "LOGO" }]);
    await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "YENİ MARKA", durumAdi: DURUM_KLASORLERI.onayBekleyen });
    const sm = acilan.find((a) => /SOSYAL MEDYA/.test(a.ad));
    t("SOSYAL MEDYA klasörü kendiliğinden açılıyor", Boolean(sm) && sm.ust === KOK, acilan.map((a) => a.ad).join(", "));
    const yil = acilan.find((a) => /^(19|20)\d{2}$/.test(a.ad));
    t("yıl klasörü YENİ açılan SOSYAL MEDYA'nın içine giriyor", Boolean(yil) && yil.ust === `yeni:${sm && sm.ad}`,
      yil ? `üst: ${yil.ust}` : "yıl klasörü açılmadı");
    const ay = acilan.find((a) => /^\d\d [A-ZÇĞİÖŞÜ]+$/.test(a.ad));
    t("ay klasörü yılın içine giriyor", Boolean(ay) && ay.ust === `yeni:${yil && yil.ad}`,
      ay ? `üst: ${ay.ust}` : "ay klasörü açılmadı");

    // (b) Bağlantı ZATEN sosyal medyayı gösteriyor → içine ikinci bir tane açılmamalı
    kur("1 SOSYAL MEDYA", []);
    await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "X", durumAdi: DURUM_KLASORLERI.onayBekleyen });
    t("sosyal medya klasörünün içine ikincisi açılmıyor", !acilan.some((a) => /SOSYAL MEDYA/.test(a.ad)),
      acilan.map((a) => a.ad).join(", "));

    // (c) Bağlantı bir AY klasörünü gösteriyor → hiçbir şey açılmamalı, uyarılmalı
    kur("08 AĞUSTOS 2026", []);
    await hedefKlasoruHazirla({ markaKlasoru: LINK, markaAdi: "X", durumAdi: DURUM_KLASORLERI.onayBekleyen });
    t("ay klasörünün içine SOSYAL MEDYA açılmıyor", !acilan.some((a) => /SOSYAL MEDYA/.test(a.ad)),
      acilan.map((a) => a.ad).join(", "));

    // (d) RAPOR HİÇBİR ŞEY AÇMAMALI — durum bakmak durumu değiştirmemeli
    kur("YENİ MARKA", [{ id: "logo", name: "LOGO" }]);
    const rapor = await klasorDurumu(LINK);
    t("durum raporu Drive'da klasör AÇMIYOR", acilan.length === 0, acilan.map((a) => a.ad).join(", "));
    t("rapor 'açılacak' diyor", rapor.sosyalMedya === "acilacak", rapor.sosyalMedya);
    t("rapor hedef yolu SOSYAL MEDYA ile bitiyor", /SOSYAL MEDYA$/.test(rapor.hedefYol || ""), rapor.hedefYol);

    kur("08 AĞUSTOS 2026", []);
    const rapor2 = await klasorDurumu(LINK);
    t("yanlış klasörü gösteren bağlantı raporda uyarılıyor",
      rapor2.sosyalMedya === "beklenmedik" && /yanlış/.test(rapor2.hedefNot || ""), rapor2.hedefNot);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

/* ---- 12. TAŞIMA DOSYANIN AYINDA KALIR ----
 *
 * 30 Ağustos'ta yüklenip 1 Eylül'de onaylanan dosya EYLÜL'e sıçramamalı; yoksa aynı işin
 * parçaları iki aya bölünür. Yıl dönümünde aynısı daha da kötü: aralıkta yüklenen bir dosya
 * ocakta onaylanınca yıl bile değişirdi.
 *
 * Bu yüzden taşıma "bugün hangi ay" diye sormaz, DOSYANIN NEREDE OLDUĞUNA bakar. */
console.log("\n Taşıma dosyanın ayında kalıyor");
{
  const { onaylananiTasi, DURUM_KLASORLERI } = await import("../lib/drive-tasima.js");
  const KOK = "1AbCdefGHIjklMNOpqrs";
  const LINK = `https://drive.google.com/drive/folders/${KOK}`;
  const gercekFetch = globalThis.fetch;
  const gercekDate = globalThis.Date;
  const saatiKur = (iso) => {
    class SahteDate extends gercekDate {
      constructor(...a) { super(...(a.length ? a : [iso])); }
      static now() { return new gercekDate(iso).getTime(); }
    }
    globalThis.Date = SahteDate;
  };

  let acilan = [];
  let hedefKlasor = null;

  /* klasorler: id -> { name, parents }.  agac: id -> alt klasörler. */
  const kur = (klasorler, agac, dosyaUstleri) => {
    acilan = []; hedefKlasor = null;
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "j" }) };
      if (u.includes("files?q=")) {
        const ust = (u.match(/'([^']+)'/) || [])[1] || "";
        return { ok: true, json: async () => ({ files: agac[ust] || [] }) };
      }
      if (u.includes("drive/v3/files?fields=id") && opt.method === "POST") {
        const govde = JSON.parse(opt.body || "{}");
        acilan.push({ ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, json: async () => ({ id: `yeni:${govde.name}` }) };
      }
      if (/drive\/v3\/files\/[^?]+\?fields=parents/.test(u)) {
        return { ok: true, json: async () => ({ parents: dosyaUstleri, name: "V1.mp4" }) };
      }
      const km = u.match(/drive\/v3\/files\/([^?]+)\?fields=/);
      if (km && opt.method === undefined) {
        const id = km[1];
        const k = klasorler[id] || { name: id, parents: [] };
        return { ok: true, json: async () => ({ id, name: k.name, parents: k.parents,
          mimeType: "application/vnd.google-apps.folder" }) };
      }
      if (opt.method === "PATCH") {
        hedefKlasor = (u.match(/addParents=([^&]+)/) || [])[1] || null;
        return { ok: true, json: async () => ({ id: "d", parents: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    };
  };

  const tasi = () => onaylananiTasi({ dosyaLinki: "https://drive.google.com/file/d/DOSYA123456/view",
    markaKlasoru: LINK, markaAdi: "VIZZ", hedefAd: DURUM_KLASORLERI.onaylanan });

  try {
    /* Dosya 2026/08 AĞUSTOS/1 ONAY BEKLEYENLER içinde. Bugün 2027 OCAK. */
    saatiKur("2027-01-04T10:00:00Z");
    const klasorler = {
      [KOK]: { name: "VIZZ", parents: [] },
      sos:   { name: "1 SOSYAL MEDYA", parents: [KOK] },
      y26:   { name: "2026", parents: ["sos"] },
      a08:   { name: "08 AĞUSTOS", parents: ["y26"] },
      ob:    { name: "1 ONAY BEKLEYENLER", parents: ["a08"] },
    };
    kur(klasorler, { [KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }], sos: [{ id: "y26", name: "2026" }],
                     y26: [{ id: "a08", name: "08 AĞUSTOS" }], a08: [{ id: "ob", name: "1 ONAY BEKLEYENLER" }] },
        ["ob"]);
    let r = await tasi();
    t("dosya kendi ayında kalıyor, bugünkü aya sıçramıyor", r.klasor === "2026/08 AĞUSTOS/2 ONAYLANANLAR", r.klasor);
    t("yeni yıl klasörü AÇILMIYOR", !acilan.some((a) => a.ad === "2027"),
      acilan.map((a) => a.ad).join(", ") || "hiçbir şey açılmadı");
    t("aşama klasörü dosyanın ayının içine açıldı",
      acilan.some((a) => a.ad === "2 ONAYLANANLAR" && a.ust === "a08"),
      acilan.map((a) => `${a.ad}@${a.ust}`).join(", "));
    t("dosya gerçekten taşındı", hedefKlasor === "yeni:2 ONAYLANANLAR", String(hedefKlasor));

    /* Dosya ESKİ düz düzende: SOSYAL MEDYA/08 AĞUSTOS 2026/1 ONAY BEKLEYENLER */
    const eskiKlasorler = {
      [KOK]: { name: "VIZZ", parents: [] },
      sos:   { name: "1 SOSYAL MEDYA", parents: [KOK] },
      duz:   { name: "08 AĞUSTOS 2026", parents: ["sos"] },
      ob:    { name: "1 ONAY BEKLEYENLER", parents: ["duz"] },
    };
    kur(eskiKlasorler, { [KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }],
                         sos: [{ id: "duz", name: "08 AĞUSTOS 2026", createdTime: "2026-08-01T00:00:00Z" }],
                         duz: [{ id: "ob", name: "1 ONAY BEKLEYENLER" }] }, ["ob"]);
    r = await tasi();
    t("eski düzendeki dosya kendi klasöründe kalıyor", r.klasor === "08 AĞUSTOS 2026/2 ONAYLANANLAR", r.klasor);
    t("eski düzendeki dosya için yıl klasörü açılmıyor", !acilan.some((a) => /^\d{4}$/.test(a.ad)),
      acilan.map((a) => a.ad).join(", ") || "hiçbir şey açılmadı");

    /* Dosya hiçbir ay klasörünün altında değil (elle atılmış) -> bugünün ayı kurulur */
    kur({ [KOK]: { name: "VIZZ", parents: [] }, sos: { name: "1 SOSYAL MEDYA", parents: [KOK] },
          baska: { name: "ÇALIŞMA DOSYALARI", parents: ["sos"] } },
        { [KOK]: [{ id: "sos", name: "1 SOSYAL MEDYA" }], sos: [] }, ["baska"]);
    r = await tasi();
    t("ayı belirsiz dosya bugünün ayına yerleşiyor", r.klasor === "2027/01 OCAK/2 ONAYLANANLAR", r.klasor);
  } finally {
    globalThis.Date = gercekDate;
    globalThis.fetch = gercekFetch;
  }
}

/* ---- 13. KARTIN KÜÇÜK RESMİ ----
 *
 * Paylaşım panelinde marka yöneticisi "Görsel 4" gibi bir addan hangi içerik olduğunu
 * çıkaramıyor; önizleme şart. Ama dosyalar Drive'da BİLEREK kısıtlı — tarayıcı
 * drive.google.com'dan küçük resmi okuyamıyor. Bu yüzden resim sunucudan geçiyor.
 *
 * Sınananlar: yetki kapısı, marka kilidi, dosyası olmayan kartın AYIRT EDİLMESİ. */
console.log("\n Kartın küçük resmi");
{
  await kv.set("marcus-os-data", VERI());
  const OWNER_H = OWNER;

  // Drive kurulu değilken çökmemeli
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  let r = await cagri(OWNER_H, { driveAction: "kucukResim", isId: 7 });
  t("Drive kurulu değilken çökmüyor", r.kod === 200 && r.govde.ok === false, `HTTP ${r.kod}`);
  t("sebep bildiriliyor", Boolean(r.govde.sebep), r.govde.sebep);

  // Dosyası OLMAYAN kart, alınamayan resimden AYRI bildirilmeli
  r = await cagri(OWNER_H, { driveAction: "kucukResim", isId: 9 });
  t("dosyası olmayan kart ayırt ediliyor", r.govde.kod === "dosya-yok", r.govde.kod);
  t("mesaj ne olduğunu söylüyor", /dosya yok/i.test(r.govde.sebep || ""), r.govde.sebep);

  // Yetki
  r = await cagri(MUSTERI, { driveAction: "kucukResim", isId: 7 });
  t("müşteri hesabı küçük resim isteyemiyor", r.kod === 403, `HTTP ${r.kod}`);

  r = await cagri(KILITLI, { driveAction: "kucukResim", isId: 9 });
  t("marka kilitli personel BAŞKA markanın kartını isteyemiyor", r.kod === 403, `HTTP ${r.kod}`);

  r = await cagri(OWNER_H, { driveAction: "kucukResim", isId: 999 });
  t("olmayan kart 404", r.kod === 404, `HTTP ${r.kod}`);

  /* Yalnızca paylasimlar izni olan hesap da isteyebilmeli — marka yöneticisinin cekimEdit
   * izni olmayabilir ama paylaşacağı içeriği görmesi gerekiyor. */
  const veriPaylasim = VERI();
  veriPaylasim.personelHesaplari = [{ id: "y1", ad: "Yönetici", kullaniciAdi: "y",
    sifreHash: hash("1234", "s"), sifreSalt: "s", izinler: { paylasimlar: true, cekimEdit: false } }];
  await kv.set("marcus-os-data", veriPaylasim);
  const YONETICI = { "x-staff-username-b64": b64("y"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
  r = await cagri(YONETICI, { driveAction: "kucukResim", isId: 7 });
  t("yalnızca paylasimlar izni olan hesap isteyebiliyor", r.kod === 200, `HTTP ${r.kod}`);
  r = await cagri(YONETICI, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
  t("ama YÜKLEME yapamıyor", r.kod === 403, `HTTP ${r.kod}`);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
