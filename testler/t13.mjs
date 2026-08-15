import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: dataH } = await import("../api/data.js");
const { default: backup } = await import("../api/backup.js");

console.log("MANTIK VE KURTARMA DENETİMİ\n");

// 1) Bos/bozuk veri gonderilirse mevcut veri silinir mi?
await kv.set("marcus-os-data", TEMIZ_VERI());
let gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
let d = gr.govde.data;
let w = await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: null, _v: d._v } });
let son = await kv.get("marcus-os-data");
kontrol("null veri müşterileri silmedi", (son.clients||[]).length === 2, `${(son.clients||[]).length} müşteri, HTTP ${w.kod}`);

w = await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: {}, _v: d._v } });
son = await kv.get("marcus-os-data");
kontrol("boş nesne müşterileri silmedi", (son.clients||[]).length === 2, `${(son.clients||[]).length} müşteri, HTTP ${w.kod}`);

// 2) Yedek geri yukleme oncesi kopya + geri alinabilirlik
await kv.set("marcus-os-data", TEMIZ_VERI());
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "ORIJINAL" }, _v: d._v } });
const snaps = await kv.keys("marcus-os-snapshot-*");
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "DEGISTI" }, _v: d._v } });
const gy = await cagir(backup, { method: "POST", headers: OWNER, query: {}, body: { key: snaps[0] } });
const geriAlma = await kv.keys("marcus-os-geri-alma-*");
kontrol("geri yükleme öncesi kopya alındı", geriAlma.length > 0, `${geriAlma.length} kopya`);
// Geri almayi geri al
const ga = await cagir(backup, { method: "POST", headers: OWNER, query: {}, body: { key: geriAlma[0] } });
son = await kv.get("marcus-os-data");
kontrol("yanlış geri yükleme GERİ ALINABİLİYOR", son.firmaAdi === "DEGISTI", `firmaAdi: ${son.firmaAdi}`);

// 3) Silinenler kutusu: silinen kayit gercekten saklaniyor mu
await kv.set("marcus-os-data", { ...TEMIZ_VERI(), silinenler: [] });
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
const silinen = (d.clients||[]).find(c => c.id === 2);
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: {
  data: { ...d, clients: (d.clients||[]).filter(c => c.id !== 2),
          silinenler: [{ silmeId: "x1", alan: "clients", tur: "Müşteri", etiket: silinen.ad, kayit: silinen, silmeZamani: Date.now() }] },
  _v: d._v, force: true } });
son = await kv.get("marcus-os-data");
kontrol("silinen kayıt kutuda saklandı", (son.silinenler||[]).length === 1 && son.silinenler[0].kayit.ad === "GİZLİ Marka");
kontrol("geri almak için tüm veri gerekmiyor", !!(son.silinenler||[])[0].kayit.id);

// 4) Snapshot gunluk: ayni gun ikinci yazma ILK hali mi koruyor (uzerine yazip bozmuyor mu)
await kv.set("marcus-os-data", TEMIZ_VERI());
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "A" }, _v: d._v } });
gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
d = gr.govde.data;
await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "B" }, _v: d._v } });
const saatlik = await kv.keys("marcus-os-saatlik-*");
kontrol("saatlik yedek de tutuluyor", saatlik.length > 0, `${saatlik.length} saatlik kopya`);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
