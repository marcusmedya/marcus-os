import { kv } from "@vercel/kv";
import { TEMIZ_VERI, KIMLIK, cagir, sizintiAra } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const uclar = ["paylasim", "client-payment", "devir-teslim", "kasa", "notify-job"];
console.log("MARKA KİLİTLİ PERSONEL — diğer markanın verisine erişebiliyor mu?\n");
for (const u of uclar) {
  await kv.set("marcus-os-data", TEMIZ_VERI());
  const { default: h } = await import(`../api/${u}.js`);
  const res = await cagir(h, { method: "GET", headers: { ...KIMLIK }, query: {}, body: {} });
  const sizinti = sizintiAra(res.govde);
  console.log(`${u.padEnd(16)} GET  ${String(res.kod).padEnd(4)} sızıntı: ${sizinti.length ? "!!! " + sizinti.join(", ") : "yok"}`);
}
