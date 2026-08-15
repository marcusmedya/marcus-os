import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: p } = await import("../api/paylasim.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

console.log("GÜNLÜK KONTROL ↔ PAYLAŞIMLAR SENKRONU\n");
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A", durum: "aktif" }], stoklar: {}, paylasimGecmisi: [],
  haftalikPaylasimlar: [
    { id: 1, clientId: 1, haftaKey: "2026-08-10", gun: 5, tur: "Reels", yapildi: false },
    { id: 2, clientId: 1, haftaKey: "2026-08-10", gun: 3, tur: "Post", yapildi: false },
  ],
});
// Gunluk Kontrol'den isaretleme = ayni islem
let r = await cagir(p, { method: "POST", headers: OWNER, query: {}, body: { action: "haftalikToggle", planId: 1 } });
let d = await kv.get("marcus-os-data");
const k1 = (d.haftalikPaylasimlar || []).find(x => x.id === 1) || {};
t("işaretleme plana yazıldı", k1.yapildi === true, `HTTP ${r.kod}`);
t("yapıldığı tarih kaydedildi", !!k1.yapildigiTarih, k1.yapildigiTarih || "yok");
t("diğer kayıt etkilenmedi", ((d.haftalikPaylasimlar || []).find(x => x.id === 2) || {}).yapildi === false);

// Geri alma
r = await cagir(p, { method: "POST", headers: OWNER, query: {}, body: { action: "haftalikToggle", planId: 1 } });
d = await kv.get("marcus-os-data");
t("geri alınabiliyor", ((d.haftalikPaylasimlar || []).find(x => x.id === 1) || {}).yapildi === false);

// Iki panel AYNI veriyi okuyor mu
r = await cagir(p, { method: "POST", headers: OWNER, query: {}, body: { action: "haftalikToggle", planId: 2 } });
d = await kv.get("marcus-os-data");
const bekleyen = (d.haftalikPaylasimlar || []).filter(x => !x.yapildi).length;
t("iki panel tek kaynaktan besleniyor", bekleyen === 1, `${bekleyen} bekleyen kaldı`);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
