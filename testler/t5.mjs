import { kv } from "@vercel/kv";
import { TEMIZ_VERI, KIMLIK, cagir, sizintiAra } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const H = { ...KIMLIK, "content-type": "application/json" };
let gecti = 0, kaldi = 0;
const kontrol = (ad, ok, detay = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${detay ? " — " + detay : ""}`); ok ? gecti++ : kaldi++; };

console.log("DÜZELTME SONRASI DENETİM\n");

const { default: pay } = await import("../api/paylasim.js");
const { default: cp } = await import("../api/client-payment.js");
const { default: nj } = await import("../api/notify-job.js");
const { default: dt } = await import("../api/devir-teslim.js");

// 1) Baska markanin alt metnini degistirme
await kv.set("marcus-os-data", TEMIZ_VERI());
let r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikAltMetin", planId: 2, altMetin: "ELE GEÇİRİLDİ" } });
let son = await kv.get("marcus-os-data");
kontrol("paylasim: başka markanın alt metni korunuyor", (son.haftalikPaylasimlar.find(p=>p.id===2)||{}).altMetin === "GİZLİ METİN", `HTTP ${r.kod}`);

// 2) Baska markanin planini silme
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikSil", planId: 2 } });
son = await kv.get("marcus-os-data");
kontrol("paylasim: başka markanın planı silinemiyor", son.haftalikPaylasimlar.some(p=>p.id===2), `HTTP ${r.kod}`);

// 3) Kendi markasinda calisabiliyor mu (islevsellik bozulmamis mi)
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikAltMetin", planId: 1, altMetin: "kendi metnim" } });
son = await kv.get("marcus-os-data");
kontrol("paylasim: KENDİ markasında çalışıyor", (son.haftalikPaylasimlar.find(p=>p.id===1)||{}).altMetin === "kendi metnim", `HTTP ${r.kod}`);
kontrol("paylasim: yanıtta sızıntı yok", sizintiAra(r.govde).length === 0, sizintiAra(r.govde).join(",") || "temiz");

// 4) client-payment kapali mi
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(cp, { method: "POST", headers: H, query: {}, body: { action: "addKaydi", clientId: 2, kayit: { tutar: 1 } } });
kontrol("client-payment: kilitli hesaba kapalı", r.kod === 401 || r.kod === 403, `HTTP ${r.kod}`);

// 5) notify-job baska marka
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(nj, { method: "POST", headers: H, query: {}, body: { email: "x@y.com", marka: "GİZLİ Marka" } });
kontrol("notify-job: başka marka adına gönderilemiyor", r.kod === 403, `HTTP ${r.kod}`);

// 6) devir-teslim baska marka
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(dt, { method: "POST", headers: H, query: {}, body: { email: "x@y.com", marka: "GİZLİ Marka" } });
kontrol("devir-teslim: başka marka adına gönderilemiyor", r.kod === 403, `HTTP ${r.kod}`);

console.log(`\nSONUÇ: ${gecti} geçti, ${kaldi} kaldı`);
