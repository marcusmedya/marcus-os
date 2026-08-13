import { kv } from "@vercel/kv";
import { TEMIZ_VERI, KIMLIK, cagir, sizintiAra } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const H = { ...KIMLIK, "content-type": "application/json" };

// 5) kasa: baska markanin sifrelerini gorebiliyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: kasa } = await import("../api/kasa.js");
let r = await cagir(kasa, { method: "GET", headers: H, query: {}, body: {} });
console.log("5) kasa GET                    ->", r.kod, "| yanit:", JSON.stringify(r.govde).slice(0, 90));
r = await cagir(kasa, { method: "POST", headers: H, query: {}, body: { action: "dogrula", sifre: "" } });
console.log("   kasa dogrula (sifre yokken) ->", r.kod, JSON.stringify(r.govde).slice(0, 120));

// 6) devir-teslim
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: dt } = await import("../api/devir-teslim.js");
r = await cagir(dt, { method: "POST", headers: H, query: {}, body: {} });
console.log("6) devir-teslim POST           ->", r.kod, "| sizinti:", sizintiAra(r.govde).join(", ") || "yok", JSON.stringify(r.govde).slice(0, 80));

// 7) notify-job: baska markanin isini bildirebilir mi (bilgi sizdirir mi)
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: nj } = await import("../api/notify-job.js");
r = await cagir(nj, { method: "POST", headers: H, query: {}, body: { jobId: 2, aliciEmail: "saldirgan@example.com" } });
console.log("7) notify-job (BAŞKA marka isi)->", r.kod, "| sizinti:", sizintiAra(r.govde).join(", ") || "yok", JSON.stringify(r.govde).slice(0, 100));

// 8) data.js POST: kilitli hesap izinsiz alana yazabiliyor mu (ornegin clients)
await kv.set("marcus-os-data", TEMIZ_VERI());
const { default: dataH } = await import("../api/data.js");
const g = await cagir(dataH, { method: "GET", headers: H, query: {}, body: {} });
const d = g.govde.data;
console.log("8) data GET kilitli            ->", g.kod, "| gorunen marka:", (d.clients||[]).map(c=>c.ad), "| sizinti:", sizintiAra(d).join(", ") || "yok");
