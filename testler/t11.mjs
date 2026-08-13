import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const IP = { "x-forwarded-for": "1.2.3.4" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

console.log("HIZ SINIRI KİLİTLENMESİ DENETİMİ\n");
await kv.set("marcus-os-data", TEMIZ_VERI());

// Sayaci doldur (25 hatali giris denemesi)
for (let i = 0; i < 25; i++) {
  await cagir(h, { method: "POST", headers: { ...IP, "content-type": "application/json" }, query: {}, body: { authAction: "girisBasla", sifre: "yanlis" } });
}

// 1) Giris denemesi engellenmeli (brute-force korumasi calisiyor mu)
let r = await cagir(h, { method: "POST", headers: { ...IP, "content-type": "application/json" }, query: {}, body: { authAction: "girisBasla", sifre: "yanlis" } });
kontrol("brute-force hâlâ engelleniyor", r.kod === 429, `HTTP ${r.kod}`);

// 2) GEÇERLİ ŞİFREYLE veri çekme ENGELLENMEMELİ (asıl hata buydu)
r = await cagir(h, { method: "GET", headers: { ...IP, "x-site-password": "ownerpw" }, query: {}, body: {} });
kontrol("geçerli kimlikle veri ÇEKİLEBİLİYOR", r.kod === 200, `HTTP ${r.kod}`);

// 3) Gecerli istek sayaci sifirlamis olmali
r = await cagir(h, { method: "POST", headers: { ...IP, "content-type": "application/json" }, query: {}, body: { authAction: "girisBasla", sifre: "ownerpw" } });
kontrol("başarılı giriş artık mümkün", r.kod === 200, `HTTP ${r.kod}`);

// 4) Kimliksiz istek hala engelleniyor mu (sayac dolduktan sonra)
for (let i = 0; i < 25; i++) {
  await cagir(h, { method: "POST", headers: { "x-forwarded-for": "9.9.9.9", "content-type": "application/json" }, query: {}, body: { authAction: "girisBasla", sifre: "yanlis" } });
}
r = await cagir(h, { method: "GET", headers: { "x-forwarded-for": "9.9.9.9", "x-site-password": "yanlissifre" }, query: {}, body: {} });
kontrol("kimliksiz istek engelleniyor", r.kod === 429 || r.kod === 401, `HTTP ${r.kod}`);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
