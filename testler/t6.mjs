import { kv } from "@vercel/kv";
import { TEMIZ_VERI, KIMLIK, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const H = { ...KIMLIK, "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: dataH } = await import("../api/data.js");
const { default: pay } = await import("../api/paylasim.js");

console.log("VERİ KAYBI VE SENKRON DENETİMİ\n");

// 1) Kilitli hesabin kaydi digerlerini silmiyor mu (dizi)
await kv.set("marcus-os-data", TEMIZ_VERI());
let gr = await cagir(dataH, { method: "GET", headers: KIMLIK, query: {}, body: {} });
let d = gr.govde.data;
let w = await cagir(dataH, { method: "POST", headers: H, query: {}, body: { data: { ...d, cekimIsleri: [...(d.cekimIsleri||[]), { id: 99, marka: "Şişçi İbo" }] }, _v: d._v } });
let son = await kv.get("marcus-os-data");
kontrol("dizi: diğer markanın işi korundu", son.cekimIsleri.some(j=>j.id===2), `HTTP ${w.kod}`);
kontrol("dizi: kendi eklediği kaydedildi", son.cekimIsleri.some(j=>j.id===99));

// 2) Nesne (stoklar)
await kv.set("marcus-os-data", TEMIZ_VERI());
gr = await cagir(dataH, { method: "GET", headers: KIMLIK, query: {}, body: {} });
d = gr.govde.data;
w = await cagir(dataH, { method: "POST", headers: H, query: {}, body: { data: { ...d, stoklar: { "1_Reels": 42 } }, _v: d._v } });
son = await kv.get("marcus-os-data");
kontrol("nesne: diğer markanın stoğu korundu", son.stoklar["2_Reels"] === 7);
kontrol("nesne: kendi stoğu güncellendi", son.stoklar["1_Reels"] === 42);

// 3) Kilitli hesap ajans geneli alana yazamiyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
const oncekiClients = (await kv.get("marcus-os-data")).clients.length;
gr = await cagir(dataH, { method: "GET", headers: KIMLIK, query: {}, body: {} });
d = gr.govde.data;
w = await cagir(dataH, { method: "POST", headers: H, query: {}, body: { data: { ...d, gelirKalemleri: [{ id: 1, kalem: "SAHTE", tutar: 999 }], personel: [] }, _v: d._v } });
son = await kv.get("marcus-os-data");
kontrol("ajans alanı: gelirKalemleri yazılamadı", !(son.gelirKalemleri||[]).some(x=>x.kalem==="SAHTE"), `HTTP ${w.kod}`);
kontrol("müşteri listesi bozulmadı", son.clients.length === oncekiClients);

// 4) Cakisma tespiti (_v) hala calisiyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
gr = await cagir(dataH, { method: "GET", headers: KIMLIK, query: {}, body: {} });
d = gr.govde.data;
await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikAltMetin", planId: 1, altMetin: "baskasi yazdi" } });
w = await cagir(dataH, { method: "POST", headers: H, query: {}, body: { data: d, _v: d._v } });
kontrol("çakışma tespiti çalışıyor (409)", w.kod === 409, `HTTP ${w.kod}`);
son = await kv.get("marcus-os-data");
kontrol("araya giren değişiklik korundu", (son.haftalikPaylasimlar.find(p=>p.id===1)||{}).altMetin === "baskasi yazdi");

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
