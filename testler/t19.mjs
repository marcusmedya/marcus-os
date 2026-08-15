import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
const M = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

console.log("BULGU 1 DOĞRULAMA — müşteri paneli hâlâ çalışıyor mu\n");
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
  cekimIsleri: [],
  musteriIcerikleri: [
    { id: 1, clientId: 1, tur: "gorsel", aciklama: "Görsel 1", durum: "bekliyor", driveLinki: "L1", sira: 2, gizli: "SIZMAMALI", onaylayan: "Yönetici" },
    { id: 2, clientId: 1, tur: "cekim", aciklama: "Plan", durum: "bekliyor", referansLink: "R", konusmaMetni: "METİN", cekimNotu: "NOT", planlananTarih: "2026-09-01", konusmali: "konusmali", sira: 1 },
    { id: 3, clientId: 1, tur: "video", aciklama: "Reels", durum: "revize", revizeNotu: "Müzik", driveLinki: "L3", videoYonu: "dikey" },
  ],
});
let r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
const ic = r.govde.icerikler || [];
t("3 içerik geliyor", ic.length === 3);
t("başlık/açıklama geliyor", ic.every(x => "aciklama" in x));
t("dosya bağlantısı geliyor", (ic.find(x => x.id === 1) || {}).driveLinki === "L1");
t("revize notu geliyor", (ic.find(x => x.id === 3) || {}).revizeNotu === "Müzik");
t("video yönü geliyor", (ic.find(x => x.id === 3) || {}).videoYonu === "dikey");
const plan = ic.find(x => x.id === 2) || {};
t("çekim planı alanları tam", plan.referansLink === "R" && plan.konusmaMetni === "METİN" && plan.cekimNotu === "NOT" && plan.planlananTarih === "2026-09-01" && plan.konusmali === "konusmali");
t("sıralama alanı geliyor", (ic.find(x => x.id === 1) || {}).sira === 2);
const metin = JSON.stringify(ic);
t("bilinmeyen iç alan SIZMIYOR", !metin.includes("SIZMAMALI"));
t("onaylayan SIZMIYOR", !metin.includes("Yönetici"));

// Onay hala calisiyor mu
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", icerikId: 1 } });
const son = await kv.get("marcus-os-data");
t("müşteri onayı hâlâ çalışıyor", (son.musteriIcerikleri.find(x => x.id === 1) || {}).durum === "onaylandi", `HTTP ${r.kod}`);
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", icerikId: 3, revizeNotu: "Yeni not" } });
const son2 = await kv.get("marcus-os-data");
t("revize isteği hâlâ çalışıyor", (son2.musteriIcerikleri.find(x => x.id === 3) || {}).revizeNotu === "Yeni not");
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
