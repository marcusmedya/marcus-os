import { kv } from "@vercel/kv";
import { TEMIZ_VERI, KIMLIK, cagir, sizintiAra } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const H = { ...KIMLIK, "content-type": "application/json" };

console.log("MARKA KİLİTLİ PERSONEL — POST ile başka markaya müdahale\n");

// 1) paylasim: baska markanin stogunu degistirebilir mi + yanitta sizinti
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: pay } = await import("../api/paylasim.js");
let r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "stokDegistir", clientId: 2, tur: "Reels", yeniDeger: 999 } });
let son = await kv.get("marcus-os-data");
console.log("1) paylasim stokDegistir (BAŞKA marka) ->", r.kod, "| stok degisti mi:", son.stoklar["2_Reels"] === 999 ? "!!! EVET (YAZMA AÇIĞI)" : "hayır");
console.log("   yanitta sizinti:", sizintiAra(r.govde).join(", ") || "yok");

// 2) paylasim: baska markanin alt metnini degistirebilir mi
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikAltMetin", planId: 2, altMetin: "ELE GEÇİRİLDİ" } });
son = await kv.get("marcus-os-data");
const p2 = (son.haftalikPaylasimlar || []).find(p => p.id === 2);
console.log("2) paylasim haftalikAltMetin (BAŞKA) ->", r.kod, "| metin degisti mi:", p2 && p2.altMetin === "ELE GEÇİRİLDİ" ? "!!! EVET" : "hayır");
console.log("   yanitta sizinti:", sizintiAra(r.govde).join(", ") || "yok");

// 3) paylasim: baska markanin planini SILEBILIR mi
await kv.set("marcus-os-data", TEMIZ_VERI());
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikSil", planId: 2 } });
son = await kv.get("marcus-os-data");
console.log("3) paylasim haftalikSil (BAŞKA marka) ->", r.kod, "| plan silindi mi:", !(son.haftalikPaylasimlar || []).some(p => p.id === 2) ? "!!! EVET (VERİ KAYBI)" : "hayır");

// 4) client-payment: baska markanin odemesine dokunabilir mi
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: cp } = await import("../api/client-payment.js");
r = await cagir(cp, { method: "POST", headers: H, query: {}, body: { action: "addKaydi", clientId: 2, kayit: { tutar: 1 } } });
son = await kv.get("marcus-os-data");
const c2 = (son.clients || []).find(c => c.id === 2);
console.log("4) client-payment (BAŞKA marka)      ->", r.kod, "| kayit eklendi mi:", (c2.odemeKayitlari || []).length > 1 ? "!!! EVET" : "hayır");
console.log("   yanitta sizinti:", sizintiAra(r.govde).join(", ") || "yok");
