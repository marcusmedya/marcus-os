import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { driveDosyaIdCikar, driveTasimaHazirMi, onaylananiTasi } = await import("../lib/drive-tasima.js");
const { default: h } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const M = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

console.log("DRIVE TAŞIMA\n");
console.log(" Bağlantıdan kimlik çıkarma");
t("/file/d/ biçimi", driveDosyaIdCikar("https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing") === "1AbC_def-123");
t("?id= biçimi", driveDosyaIdCikar("https://drive.google.com/uc?export=view&id=1AbC_def-123") === "1AbC_def-123");
t("/d/ biçimi", driveDosyaIdCikar("https://docs.google.com/d/1AbC_def-123/edit") === "1AbC_def-123");
t("Drive olmayan bağlantı null", driveDosyaIdCikar("https://wetransfer.com/x") === null);
t("boş değer null", driveDosyaIdCikar("") === null);

console.log("\n Kurulu değilken");
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.DRIVE_ONAY_KLASOR_ID;
t("hazır değil", driveTasimaHazirMi() === false);
const sonuc = await onaylananiTasi({ dosyaLinki: "https://drive.google.com/file/d/1AbC_def-123/view", markaAdi: "A" });
t("taşıma sessizce atlanıyor, ÇÖKMÜYOR", sonuc.tasindi === false && !!sonuc.sebep, sonuc.sebep);

console.log("\n ONAY hâlâ çalışıyor mu (en kritik)");
/* Markaya Drive klasörü TANIMLI: "kurulu ama başarısız" senaryosu bu. Klasör tanımsızken
 * sistem sessiz geçer (Drive kullanmayan markanın kartı sistem notlarıyla dolmasın diye),
 * bu yüzden başarısızlığın görünürlüğünü sınamak için klasörün tanımlı olması gerekir. */
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "İbo Burger", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [],
  cekimIsleri: [{ id: 1, marka: "İbo Burger", asama: "Kontrol Bekliyor", icerikTuru: "Reels",
    editliDosyaLink: "https://drive.google.com/file/d/1AbC_def-123/view", gecmis: [] }],
});
let r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", isId: 1 } });
let d = await kv.get("marcus-os-data");
t("onay tamamlandı", (d.cekimIsleri[0] || {}).asama === "Onaylandı", `HTTP ${r.kod}`);
t("başarısız taşıma geçmişe not düştü", JSON.stringify(d.cekimIsleri[0].gecmis).includes("Drive taşıma yapılamadı"));

console.log("\n Drive bağlantısı OLMAYAN iş");
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [],
  cekimIsleri: [{ id: 1, marka: "A", asama: "Kontrol Bekliyor", icerikTuru: "R", gecmis: [] }],
});
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", isId: 1 } });
d = await kv.get("marcus-os-data");
t("bağlantısız işte onay sorunsuz", (d.cekimIsleri[0] || {}).asama === "Onaylandı", `HTTP ${r.kod}`);
t("gereksiz not düşülmedi", !JSON.stringify(d.cekimIsleri[0].gecmis).includes("Drive"));

console.log("\n REVİZE taşıma tetiklemiyor");
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [],
  cekimIsleri: [{ id: 1, marka: "A", asama: "Kontrol Bekliyor", icerikTuru: "R",
    editliDosyaLink: "https://drive.google.com/file/d/1AbC_def-123/view", gecmis: [] }],
});
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "x" } });
d = await kv.get("marcus-os-data");
t("revizede taşıma denenmiyor", !JSON.stringify(d.cekimIsleri[0].gecmis).includes("Drive"));
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
