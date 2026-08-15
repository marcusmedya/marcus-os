import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const KAPALI = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false, musteriAkisi: false };
const VERI = (izinler, markalar) => ({
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", logoUrl: "L" }, { id: 2, ad: "GİZLİ Marka" }],
  musteriIcerikleri: [
    { id: 1, clientId: 1, tur: "gorsel", aciklama: "Görsel 1", durum: "bekliyor" },
    { id: 2, clientId: 2, tur: "gorsel", aciklama: "BAŞKA MARKA", durum: "bekliyor" },
  ],
  cekimIsleri: [
    { id: 10, marka: "İbo Burger", asama: "Kontrol Bekliyor", icerikTuru: "Reels", brief: "İÇ BRIEF", kameraman: "GİZLİ KİŞİ" },
    { id: 11, marka: "GİZLİ Marka", asama: "Kontrol Bekliyor", icerikTuru: "BAŞKA İŞ" },
  ],
  gelirKalemleri: [{ id: 1, x: "GİZLİ GELİR" }],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s", izinler, markalar }],
});
const H = { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };

console.log("ÇÖZÜM ORTAĞI MARKA PANELİ\n");
await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, ["İbo Burger"]));
let r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
const p = r.govde.markaPaneli || {};
t("kendi markasının paneli geliyor", r.kod === 200 && p.marka === "İbo Burger", `HTTP ${r.kod}`);
t("içerikler geliyor", (p.icerikler || []).length === 1);
t("hazır içerikler geliyor", (p.hazirIcerikler || []).length === 1);
t("marka listesi geliyor", (r.govde.markalarim || []).length === 1);
const metin = JSON.stringify(r.govde);
t("başka markanın içeriği YOK", !metin.includes("BAŞKA MARKA"));
t("başka markanın işi YOK", !metin.includes("BAŞKA İŞ"));
t("iç brief SIZMIYOR (müşteriyle aynı)", !metin.includes("İÇ BRIEF") && !metin.includes("GİZLİ KİŞİ"));
t("finans SIZMIYOR", !metin.includes("GİZLİ GELİR"));

r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "2" }, body: {} });
t("BAŞKA markanın paneli REDDEDİLDİ", r.kod === 403, `HTTP ${r.kod}`);

await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: false }, ["İbo Burger"]));
r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
t("yetkisiz hesap REDDEDİLDİ", r.kod === 403, `HTTP ${r.kod}`);

await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, []));
r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
t("marka kilidi olmayan hesap REDDEDİLDİ", r.kod === 403, `HTTP ${r.kod}`);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);

console.log("\nORTAK İŞ YÜRÜTME");
await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, ["İbo Burger"]));
let d = await kv.get("marcus-os-data");
d.cekimIsleri = [
  { id: 20, marka: "İbo Burger", asama: "Revize İstendi", icerikTuru: "R", musteriRevizeNotu: "Müzik" },
  { id: 21, marka: "İbo Burger", asama: "Kontrol Bekliyor", icerikTuru: "R2" },
  { id: 22, marka: "GİZLİ Marka", asama: "Revize İstendi", icerikTuru: "R3" },
];
await kv.set("marcus-os-data", d);
r = await cagir(h, { method: "POST", headers: H, query: {}, body: { ortakAction: "asamaIlerlet", isId: 20, hedefAsama: "Kontrol Bekliyor" } });
let son = await kv.get("marcus-os-data");
t("revize → kontrole gönderildi", (son.cekimIsleri.find(x => x.id === 20) || {}).asama === "Kontrol Bekliyor", `HTTP ${r.kod}`);
t("revize notu temizlendi", (son.cekimIsleri.find(x => x.id === 20) || {}).musteriRevizeNotu === null);
t("geçmişe yazıldı", ((son.cekimIsleri.find(x => x.id === 20) || {}).gecmis || []).length === 1);
r = await cagir(h, { method: "POST", headers: H, query: {}, body: { ortakAction: "asamaIlerlet", isId: 22, hedefAsama: "Kontrol Bekliyor" } });
son = await kv.get("marcus-os-data");
t("BAŞKA markanın işi ilerletilemedi", (son.cekimIsleri.find(x => x.id === 22) || {}).asama === "Revize İstendi", `HTTP ${r.kod}`);
r = await cagir(h, { method: "POST", headers: H, query: {}, body: { ortakAction: "asamaIlerlet", isId: 21, hedefAsama: "Kontrol Bekliyor" } });
t("revizede olmayan kart reddedildi", r.kod === 409, `HTTP ${r.kod}`);
r = await cagir(h, { method: "POST", headers: H, query: {}, body: { ortakAction: "asamaIlerlet", isId: 20, hedefAsama: "Onaylandı" } });
son = await kv.get("marcus-os-data");
t("müşteri adına ONAY verilemedi", (son.cekimIsleri.find(x => x.id === 20) || {}).asama !== "Onaylandı", `HTTP ${r.kod}`);
console.log(`\nTOPLAM: ${g} geçti, ${k} kaldı`);
