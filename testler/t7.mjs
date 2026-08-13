import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
import crypto from "crypto";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: dataH } = await import("../api/data.js");
const { default: backup } = await import("../api/backup.js");

console.log("GENEL VERİ KORUMA DENETİMİ\n");

// 1) Guvenlik freni: musteri sayisi ani dususte yazma reddediliyor mu (owner)
await kv.set("marcus-os-data", { ...TEMIZ_VERI(), clients: [1,2,3,4,5].map(i=>({id:i,ad:"M"+i})) });
let gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
let d = gr.govde.data;
let w = await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, clients: [{id:1,ad:"M1"}] }, _v: d._v } });
let son = await kv.get("marcus-os-data");
kontrol("güvenlik freni: %40+ müşteri kaybı engellendi", son.clients.length === 5, `HTTP ${w.kod}, kalan: ${son.clients.length}`);

// 2) force ile bilincli gecis calisiyor mu
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
w = await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, clients: [{id:1,ad:"M1"}] }, _v: d._v, force: true } });
son = await kv.get("marcus-os-data");
kontrol("force ile bilinçli silme mümkün", son.clients.length === 1, `kalan: ${son.clients.length}`);

// 3) Versiyon sayaci her yazmada artiyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
const v0 = (await kv.get("marcus-os-data"))._v;
const { default: pay } = await import("../api/paylasim.js");
await cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "haftalikAltMetin", planId: 1, altMetin: "x" } });
const v1 = (await kv.get("marcus-os-data"))._v;
kontrol("paylasim yazması _v artırıyor", v1 > v0, `${v0} → ${v1}`);

// 4) Yedek aliniyor mu
const anahtarlar = await kv.keys("marcus-os-*");
kontrol("günlük yedek yazıldı", anahtarlar.some(a => a.includes("snapshot")), anahtarlar.filter(a=>a.includes("snapshot")).join(","));
kontrol("saatlik yedek yazıldı", anahtarlar.some(a => a.includes("saatlik")));

// 5) Geri yukleme oncesi guvenlik kopyasi
const w2 = await cagir(backup, { method: "POST", headers: OWNER, query: {}, body: { key: anahtarlar.find(a=>a.includes("snapshot")) } });
const anahtar2 = await kv.keys("marcus-os-*");
kontrol("geri yükleme öncesi kopya alındı", anahtar2.some(a => a.includes("geri-alma")), `HTTP ${w2.kod}`);

// 6) Yedek anahtari disindan rastgele anahtar okunamiyor mu
const r3 = await cagir(backup, { method: "GET", headers: OWNER, query: { key: "marcus-os-data" }, body: {} });
kontrol("rastgele KV anahtarı okunamıyor", r3.kod === 400, `HTTP ${r3.kod}`);

// 7) Personel sifre hash'leri owner'a bile gonderilmiyor mu
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
const metin = JSON.stringify(gr.govde.data || {});
kontrol("şifre hash'leri gönderilmiyor", !metin.includes("sifreHash") && !metin.includes("kasaSifresiHash"));

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
