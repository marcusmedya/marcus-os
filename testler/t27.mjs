import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const M = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

const KUR = async () => kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [],
  personelHesaplari: [{ id: "p1", ad: "Önder", kullaniciAdi: "e", email: "onder@x.com", sifreHash: hash("1","s"), sifreSalt: "s", izinler: {} }],
  cekimIsleri: [{ id: 1, marka: "A", asama: "Kontrol Bekliyor", icerikTuru: "Reels", editor: "Önder", gecmis: [] }],
});

console.log("REVİZE GELİŞTİRMELERİ\n");

// 1) RESEND yokken bile revize kaydediliyor mu (en kritik)
delete process.env.RESEND_API_KEY;
await KUR();
let r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "Müzik" } });
let d = await kv.get("marcus-os-data");
t("RESEND YOKKEN revize yine kaydedildi", (d.cekimIsleri[0] || {}).asama === "Revize İstendi", `HTTP ${r.kod}`);
t("sayaç 1 oldu", (d.cekimIsleri[0] || {}).revizeSayisi === 1);
t("not karta yazıldı", (d.cekimIsleri[0] || {}).musteriRevizeNotu === "Müzik");

// 2) Sayac birikiyor mu
d.cekimIsleri[0].asama = "Kontrol Bekliyor";
await kv.set("marcus-os-data", d);
await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "Renk" } });
d = await kv.get("marcus-os-data");
t("ikinci revizede sayaç 2", (d.cekimIsleri[0] || {}).revizeSayisi === 2);
t("yeni not eskisinin yerine geçti", (d.cekimIsleri[0] || {}).musteriRevizeNotu === "Renk");
t("eski not GEÇMİŞTE duruyor", JSON.stringify(d.cekimIsleri[0].gecmis).includes("Müzik"));

// 3) Onay sayaci artirmiyor
d.cekimIsleri[0].asama = "Kontrol Bekliyor";
await kv.set("marcus-os-data", d);
await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", isId: 1 } });
d = await kv.get("marcus-os-data");
t("onay sayacı ARTIRMIYOR", (d.cekimIsleri[0] || {}).revizeSayisi === 2);
t("onayda not temizlendi", (d.cekimIsleri[0] || {}).musteriRevizeNotu === null);

// 4) Sayac musteriye SIZMIYOR
r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
t("revize sayısı müşteriye gitmiyor", !JSON.stringify(r.govde).includes("revizeSayisi"));

// 5) Bozuk RESEND anahtariyla da kayit gecerli
process.env.RESEND_API_KEY = "gecersiz-anahtar";
await KUR();
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "X" } });
d = await kv.get("marcus-os-data");
t("BOZUK anahtarla da revize kaydedildi", (d.cekimIsleri[0] || {}).asama === "Revize İstendi", `HTTP ${r.kod}`);
delete process.env.RESEND_API_KEY;

// 6) Atanmamis iste de kayit gecerli
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [], personelHesaplari: [],
  cekimIsleri: [{ id: 1, marka: "A", asama: "Kontrol Bekliyor", icerikTuru: "R", gecmis: [] }],
});
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "Y" } });
d = await kv.get("marcus-os-data");
t("kimse atanmamışken de revize kaydedildi", (d.cekimIsleri[0] || {}).asama === "Revize İstendi", `HTTP ${r.kod}`);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
