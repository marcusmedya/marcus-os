import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: dataH } = await import("../api/data.js");
const { default: backup } = await import("../api/backup.js");

console.log("YEDEK GERİ YÜKLEME + DEFTER DAYANIKLILIĞI\n");

// Veri yaz -> snapshot olussun
await kv.set("marcus-os-data", TEMIZ_VERI());
let r = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
let d = r.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "ILK HAL" }, _v: d._v } });
const anahtarlar = await kv.keys("marcus-os-snapshot-*");
kontrol("snapshot oluştu", anahtarlar.length > 0, anahtarlar.join(","));

// Veriyi degistir
r = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = r.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "SONRAKI HAL" }, _v: d._v } });

const defterOnce = ((await kv.get("marcus-os-guvenlik-defteri")) || []).length;

// Geri yukle
const gy = await cagir(backup, { method: "POST", headers: OWNER, query: {}, body: { key: anahtarlar[0] } });
kontrol("geri yükleme çalıştı", gy.kod === 200, `HTTP ${gy.kod} ${JSON.stringify(gy.govde).slice(0,80)}`);

const defterSonra = (await kv.get("marcus-os-guvenlik-defteri")) || [];
kontrol("geri yükleme deftere yazıldı", defterSonra.some(x => x.olay === "yedek-geri-yuklendi"));
kontrol("defter geri yüklemeden ETKİLENMEDİ", defterSonra.length > defterOnce, `${defterOnce} → ${defterSonra.length}`);

// Geri yukleme oncesi guvenlik kopyasi alindi mi
const gaKeys = await kv.keys("marcus-os-geri-alma-*");
kontrol("geri yükleme öncesi kopya alındı", gaKeys.length > 0);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
