import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
process.env.CRON_SECRET = "cs";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
console.log("DUMAN TESTİ — her uç nokta çağrılıp çöküyor mu bakılıyor\n");
const uclar = [
  ["data",            { method: "GET",  body: {} }],
  ["backup",          { method: "GET",  body: {} }],
  ["paylasim",        { method: "POST", body: { action: "stokDegistir", clientId: 1, tur: "Reels", yeniDeger: 3 } }],
  ["client-payment",  { method: "POST", body: { action: "setOdemeGunu", clientId: 1, odemeGunu: 5 } }],
  ["kasa",            { method: "GET",  body: {} }],
  ["manage-staff",    { method: "GET",  body: {} }],
  ["devir-teslim",    { method: "POST", body: { email: "a@b.c", marka: "Şişçi İbo" } }],
  ["notify-job",      { method: "POST", body: { email: "a@b.c", marka: "Şişçi İbo" } }],
  ["daily-backup",    { method: "GET",  body: {} }],
  ["daily-reminders", { method: "GET",  body: {} }],
];
for (const [ad, cfg] of uclar) {
  await kv.set("marcus-os-data", TEMIZ_VERI());
  try {
    const { default: h } = await import(`../api/${ad}.js`);
    const r = await cagir(h, { method: cfg.method, headers: OWNER, query: {}, body: cfg.body });
    const ok = r.kod < 500;
    console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad.padEnd(16)} HTTP ${r.kod}${!ok ? " " + JSON.stringify(r.govde).slice(0,80) : ""}`);
    ok ? g++ : k++;
  } catch (e) {
    console.log(`  ✗ !!! ${ad.padEnd(16)} ÇÖKTÜ: ${e.message}`);
    k++;
  }
}
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
