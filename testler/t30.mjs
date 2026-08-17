import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: logo } = await import("../api/logo.js");
const { default: dat } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const res = () => { const o = { kod: 0, b: {}, govde: null, yon: null };
  o.setHeader = (a, v) => { o.b[a.toLowerCase()] = v; }; o.status = (c) => { o.kod = c; return o; };
  o.json = (x) => { o.govde = x; return o; }; o.send = (x) => { o.govde = x; return o; };
  o.redirect = (c, u) => { o.kod = c; o.yon = u; return o; }; return o; };
const PNG = (n) => "data:image/png;base64," + Buffer.from("X".repeat(n)).toString("base64");

console.log("ÜÇ GÖRSEL ALANI\n");
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  markaKimligiGorseli: PNG(30), paylasimGorseli: PNG(90), acikZeminLogosu: PNG(60),
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [], cekimIsleri: [],
  personelHesaplari: [{ id: "p1", ad: "P", kullaniciAdi: "p", sifreHash: hash("1","s"), sifreSalt: "s", izinler: { paylasimlar: true } }],
});
const boy = async (tip) => { const r = res(); await logo({ method: "GET", headers: {}, query: tip ? { tip } : {} }, r); return r; };
const kare = await boy(null), pay = await boy("paylasim"), acik = await boy("acik");
t("kare logo dönüyor", kare.kod === 200 && kare.govde.length === 30);
t("paylaşım görseli AYRI dönüyor", pay.kod === 200 && pay.govde.length === 90);
t("açık zemin logosu AYRI dönüyor", acik.kod === 200 && acik.govde.length === 60);

// Yoksa kare logoya duser
await kv.set("marcus-os-data", { _v: 1, markaKimligiGorseli: PNG(30), clients: [] });
const pay2 = await boy("paylasim"), acik2 = await boy("acik");
t("paylaşım yoksa kare logoya düşer", pay2.kod === 200 && pay2.govde.length === 30);
t("açık zemin yoksa kare logoya düşer", acik2.kod === 200 && acik2.govde.length === 30);

// Hicbiri yoksa varsayilan
await kv.set("marcus-os-data", { _v: 1, clients: [] });
const bos = await boy("paylasim");
t("hiçbiri yoksa varsayılan simge", bos.kod === 302 && bos.yon === "/icon.svg");

// Musteri paneli ACIK ZEMIN logosunu aliyor mu
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  markaKimligiGorseli: "KARE", acikZeminLogosu: "ACIK",
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [], cekimIsleri: [],
});
let r = await cagir(dat, { method: "GET", headers: { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1") }, query: {}, body: {} });
t("müşteri paneli AÇIK ZEMİN logosunu alıyor", r.govde.ajansLogo === "ACIK", String(r.govde.ajansLogo));

// Acik zemin yoksa kare
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }], markaKimligiGorseli: "KARE",
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [], cekimIsleri: [],
});
r = await cagir(dat, { method: "GET", headers: { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1") }, query: {}, body: {} });
t("açık zemin yoksa kare logo gider", r.govde.ajansLogo === "KARE");

// Personele sizmiyor mu
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }], markaKimligiGorseli: "KARE",
  paylasimGorseli: "SIZMAMALI-PAYLASIM", acikZeminLogosu: "SIZMAMALI-ACIK", stoklar: {}, haftalikPaylasimlar: [],
  personelHesaplari: [{ id: "p1", ad: "P", kullaniciAdi: "p", sifreHash: hash("1","s"), sifreSalt: "s", izinler: { paylasimlar: true } }],
});
r = await cagir(dat, { method: "GET", headers: { "x-staff-username-b64": b64("p"), "x-staff-password-b64": b64("1") }, query: {}, body: {} });
const metin = JSON.stringify(r.govde);
t("paylaşım görseli personele gitmiyor", !metin.includes("SIZMAMALI-PAYLASIM"));
t("açık zemin logosu personele gitmiyor", !metin.includes("SIZMAMALI-ACIK"));
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
