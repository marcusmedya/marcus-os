import { kv } from "@vercel/kv";
process.env.SITE_PASSWORD = "ownerpw";
const { default: logo } = await import("../api/logo.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

// Sahte res
const sahteRes = () => {
  const o = { kod: 0, basliklar: {}, govde: null, yonlendirme: null };
  o.setHeader = (k2, v) => { o.basliklar[k2.toLowerCase()] = v; };
  o.status = (c) => { o.kod = c; return o; };
  o.json = (b) => { o.govde = b; return o; };
  o.send = (b) => { o.govde = b; return o; };
  o.redirect = (c, u) => { o.kod = c; o.yonlendirme = u; return o; };
  return o;
};
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

console.log("LOGO SUNUCUSU\n");

// 1) Logo yuklenmisse gorsel doner
await kv.set("marcus-os-data", {
  _v: 1, markaKimligiGorseli: `data:image/png;base64,${PNG}`,
  clients: [{ id: 1, ad: "A" }], musteriGirisleri: { 1: { instagram: { sifre: "GİZLİ ŞİFRE" } } },
  personel: [{ id: 1, ad: "GİZLİ PERSONEL", maas: 99999 }],
});
let r = sahteRes();
await logo({ method: "GET", headers: {} }, r);
t("logo görsel olarak dönüyor", r.kod === 200 && Buffer.isBuffer(r.govde), `HTTP ${r.kod}`);
t("içerik tipi doğru", r.basliklar["content-type"] === "image/png", r.basliklar["content-type"]);
t("önbellek başlığı var", String(r.basliklar["cache-control"] || "").includes("max-age"));

// 2) BASKA VERI SIZIYOR MU — en kritik kontrol
const metin = Buffer.isBuffer(r.govde) ? r.govde.toString("utf8") : JSON.stringify(r.govde);
t("şifre SIZMIYOR", !metin.includes("GİZLİ ŞİFRE"));
t("personel SIZMIYOR", !metin.includes("GİZLİ PERSONEL"));
t("yalnızca görsel baytları dönüyor", r.govde.length === Buffer.from(PNG, "base64").length);

// 3) Logo yoksa varsayilana dusuyor
await kv.set("marcus-os-data", { _v: 1, clients: [] });
r = sahteRes();
await logo({ method: "GET", headers: {} }, r);
t("logo yokken varsayılana yönlendiriyor", r.kod === 302 && r.yonlendirme === "/icon.svg", `HTTP ${r.kod} → ${r.yonlendirme}`);

// 4) Bozuk logo degeri
await kv.set("marcus-os-data", { _v: 1, markaKimligiGorseli: "https://drive.google.com/x" });
r = sahteRes();
await logo({ method: "GET", headers: {} }, r);
t("bozuk/base64 olmayan değerde çökmüyor", r.kod === 302, `HTTP ${r.kod}`);

// 5) POST reddediliyor
r = sahteRes();
await logo({ method: "POST", headers: {} }, r);
t("POST reddediliyor", r.kod === 405);

// 6) Veri hic yokken
await kv.del("marcus-os-data");
r = sahteRes();
await logo({ method: "GET", headers: {} }, r);
t("veri yokken çökmüyor", r.kod === 302);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
