/* PAYLAŞIM PANELİ ↔ OPERASYON KARTI BAĞI
 *
 * NEDEN BU TEST VAR:
 *   Editör içeriği hazırlıyor, marka yöneticisi paylaşıyor. İki panel birbirinden habersiz
 *   çalıştığı sürece "bu hangi karttı?" sorusu cevapsız kalıyor ve Drive elle yönetiliyordu.
 *   Artık paylaşım planı hücresi bir Operasyon kartına bağlanabiliyor; işaretlenince kart
 *   "Teslim Edildi"ye geçiyor ve dosya 3 PAYLAŞILDI klasörüne taşınıyor.
 *
 *   İki ayrı hata da burada sınanıyor:
 *     1. Yanıtlar _v taşımıyordu -> tarayıcı bir tur geride kalıp sonraki kayıtta sahte
 *        çakışma alıyor ve kullanıcının düzenlemesini kaybediyordu.
 *     2. Marka kilitli hesaba yanıtta BÜTÜN markaların kayıtları dönüyordu.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.DRIVE_ONAY_KLASOR_ID;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const KILITLI = { "x-staff-username-b64": b64("k"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/paylasim.js");

const VERI = () => ({
  _v: 5,
  clients: [
    { id: 1, ad: "VIZZ", durum: "aktif" },
    { id: 2, ad: "GİZLİ Marka", durum: "aktif" },
  ],
  stoklar: { "1_Reels": 3 },
  paylasimGecmisi: [],
  haftalikPaylasimlar: [],
  cekimIsleri: [
    { id: 10, marka: "VIZZ", kategori: "Video", icerikTuru: "Sivrisinek", asama: "Onaylandı",
      editliDosyaLink: "https://drive.google.com/file/d/DOSYA1/view", gecmis: [] },
    { id: 11, marka: "VIZZ", kategori: "Video", icerikTuru: "Yeni İş", asama: "Edit Yapılıyor", gecmis: [] },
    { id: 12, marka: "GİZLİ Marka", kategori: "Video", icerikTuru: "Gizli", asama: "Onaylandı", gecmis: [] },
  ],
  personelHesaplari: [
    { id: "k1", ad: "Kilitli", kullaniciAdi: "k", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { paylasimlar: true }, markalar: ["VIZZ"] },
  ],
});
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });
const oku = () => kv.get("marcus-os-data");
const kart = (d, id) => (d.cekimIsleri || []).find((j) => j.id === id) || {};

console.log("PAYLAŞIM ↔ OPERASYON BAĞI\n");

/* ---- 1. SÜRÜM SAYACI ---- */
console.log(" Sürüm sayacı yanıtta");
await kv.set("marcus-os-data", VERI());
let r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 0, haftaKey: "2026-08-17", tur: "Reels" });
let d = await oku();
t("yanıt _v taşıyor", typeof r.govde._v === "number", String(r.govde._v));
t("yanıttaki _v sunucudakiyle AYNI", r.govde._v === d._v, `yanıt ${r.govde._v} / kv ${d._v}`);
t("sayaç gerçekten arttı", d._v === 6, String(d._v));

/* ---- 2. KART BAĞLAMA ---- */
console.log("\n Plana kart bağlama");
await kv.set("marcus-os-data", VERI());
r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 1, haftaKey: "2026-08-17", tur: "Reels", isId: 10 });
d = await oku();
let plan = (d.haftalikPaylasimlar || [])[0] || {};
t("plan karta bağlandı", plan.isId === 10, String(plan.isId));
t("kartın adı da saklandı", plan.isAdi === "Sivrisinek", String(plan.isAdi));
t("kartın aşaması HENÜZ değişmedi", kart(d, 10).asama === "Onaylandı", kart(d, 10).asama);

r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-17", tur: "Reels", isId: 11 });
t("onaylanmamış kart bağlanamıyor", r.kod === 400 && /hazır değil/i.test(r.govde.error || ""), r.govde.error);

r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-17", tur: "Reels", isId: 12 });
t("BAŞKA markanın kartı bağlanamıyor", r.kod === 400 && /başka bir markaya/i.test(r.govde.error || ""), r.govde.error);

r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 3, haftaKey: "2026-08-17", tur: "Reels", isId: 10 });
t("aynı kart ikinci plana bağlanamıyor", r.kod === 400 && /zaten/i.test(r.govde.error || ""), r.govde.error);

r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 4, haftaKey: "2026-08-17", tur: "Reels", isId: 999 });
t("olmayan kart bağlanamıyor", r.kod === 400, `HTTP ${r.kod}`);

r = await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 5, haftaKey: "2026-08-17", tur: "Reels" });
d = await oku();
t("kart bağlamadan da plan eklenebiliyor",
  (d.haftalikPaylasimlar || []).some((p) => p.gun === 5 && p.isId === null), JSON.stringify(d.haftalikPaylasimlar.map((p) => p.gun)));

/* ---- 3. PAYLAŞILDI İŞARETLEME ---- */
console.log("\n Paylaşıldı işaretlenince");
await kv.set("marcus-os-data", VERI());
await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 1, haftaKey: "2026-08-17", tur: "Reels", isId: 10 });
d = await oku();
const planId = d.haftalikPaylasimlar[0].id;

r = await cagri(OWNER, { action: "haftalikToggle", planId });
d = await oku();
t("bağlı kart Teslim Edildi'ye geçti", kart(d, 10).asama === "Teslim Edildi", kart(d, 10).asama);
t("teslim tarihi yazıldı", Boolean(kart(d, 10).teslimEdilmeTarihi), String(kart(d, 10).teslimEdilmeTarihi));
t("kartın geçmişine not düştü",
  (kart(d, 10).gecmis || []).some((x) => /PAYLAŞILDI/i.test(x.aciklama || "")),
  JSON.stringify((kart(d, 10).gecmis || []).map((x) => x.aciklama)));
t("plan da işaretlendi", d.haftalikPaylasimlar[0].yapildi === true);
t("stok düştü", d.stoklar["1_Reels"] === 2, String(d.stoklar["1_Reels"]));
t("yanıt güncel kartları taşıyor", Array.isArray(r.govde.cekimIsleri)
  && (r.govde.cekimIsleri.find((j) => j.id === 10) || {}).asama === "Teslim Edildi");
t("Drive kurulu değilken çökmüyor", r.kod === 200, `HTTP ${r.kod}`);

/* ---- 4. GERİ ALMA ---- */
console.log("\n Geri alınınca");
r = await cagri(OWNER, { action: "haftalikToggle", planId });
d = await oku();
t("kart Onaylandı'ya döndü", kart(d, 10).asama === "Onaylandı", kart(d, 10).asama);
t("teslim tarihi temizlendi", kart(d, 10).teslimEdilmeTarihi === null, String(kart(d, 10).teslimEdilmeTarihi));
t("geri alma da geçmişe yazıldı",
  (kart(d, 10).gecmis || []).some((x) => /geri alındı/i.test(x.aciklama || "")));
t("stok geri geldi", d.stoklar["1_Reels"] === 3, String(d.stoklar["1_Reels"]));

/* ---- 5. BAĞSIZ PLAN KARTLARA DOKUNMUYOR ---- */
console.log("\n Bağsız plan");
await kv.set("marcus-os-data", VERI());
await cagri(OWNER, { action: "haftalikEkle", clientId: 1, gun: 0, haftaKey: "2026-08-17", tur: "Reels" });
d = await oku();
await cagri(OWNER, { action: "haftalikToggle", planId: d.haftalikPaylasimlar[0].id });
d = await oku();
t("bağsız planda hiçbir kart değişmiyor",
  kart(d, 10).asama === "Onaylandı" && kart(d, 11).asama === "Edit Yapılıyor",
  `${kart(d, 10).asama} / ${kart(d, 11).asama}`);

/* ---- 6. MARKA KİLİDİ — YANITTAN SIZINTI ---- */
console.log("\n Marka kilitli hesap");
await kv.set("marcus-os-data", VERI());
r = await cagri(KILITLI, { action: "haftalikEkle", clientId: 1, gun: 0, haftaKey: "2026-08-17", tur: "Reels", isId: 10 });
t("kilitli hesap kendi markasına plan ekleyebiliyor", r.kod === 200, `HTTP ${r.kod}`);
d = await oku();
r = await cagri(KILITLI, { action: "haftalikToggle", planId: d.haftalikPaylasimlar[0].id });
t("işaretleme çalışıyor", r.kod === 200, `HTTP ${r.kod}`);
t("yanıtta BAŞKA markanın kartı YOK",
  !(r.govde.cekimIsleri || []).some((j) => j.marka === "GİZLİ Marka"),
  JSON.stringify((r.govde.cekimIsleri || []).map((j) => j.marka)));
t("yanıtta başka markanın adı hiç geçmiyor", !JSON.stringify(r.govde).includes("GİZLİ"));

r = await cagri(KILITLI, { action: "haftalikEkle", clientId: 2, gun: 0, haftaKey: "2026-08-17", tur: "Reels" });
t("kilitli hesap başka markaya plan ekleyemiyor", r.kod === 403, `HTTP ${r.kod}`);

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
