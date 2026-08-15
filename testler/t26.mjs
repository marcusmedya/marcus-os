import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: dat } = await import("../api/data.js");
const { default: pay } = await import("../api/paylasim.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const KAPALI = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false, musteriAkisi: false };

console.log("UÇTAN UCA AKIŞ TESTİ\n");
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", durum: "aktif", logoUrl: "L" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s",
    izinler: { ...KAPALI, musteriAkisi: true, paylasimlar: true }, markalar: ["İbo Burger"] }],
  cekimIsleri: [], musteriIcerikleri: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
});
const M = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const O = { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };

// 1) Yonetici is olusturur -> Kontrol Bekliyor
let d = await kv.get("marcus-os-data");
d.cekimIsleri = [{ id: 1, marka: "İbo Burger", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "Reels 1", editliDosyaLink: "DOSYA1", brief: "İÇ BRIEF" }];
await kv.set("marcus-os-data", d);

// 2) Musteri gorur
let r = await cagir(dat, { method: "GET", headers: M, query: {}, body: {} });
t("müşteri içeriği görüyor", (r.govde.hazirIcerikler || []).length === 1);
t("iç brief müşteriye gitmiyor", !JSON.stringify(r.govde).includes("İÇ BRIEF"));

// 3) Musteri revize ister
r = await cagir(dat, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: "Müzik değişsin" } });
d = await kv.get("marcus-os-data");
t("revize → Revize İstendi", (d.cekimIsleri[0] || {}).asama === "Revize İstendi", `HTTP ${r.kod}`);

// 4) Musteri revize sekmesinde gorur
r = await cagir(dat, { method: "GET", headers: M, query: {}, body: {} });
const rev = (r.govde.hazirIcerikler || []).find((x) => x.durum === "revize");
t("revize sekmesinde görünüyor", !!rev && rev.revizeNotu === "Müzik değişsin");

// 5) Ekip tamamlar -> Kontrol Bekliyor
d = await kv.get("marcus-os-data");
d.cekimIsleri[0].asama = "Kontrol Bekliyor";
await kv.set("marcus-os-data", d);

// 6) Musteri onaylar
r = await cagir(dat, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", isId: 1 } });
d = await kv.get("marcus-os-data");
t("onay → Onaylandı", (d.cekimIsleri[0] || {}).asama === "Onaylandı", `HTTP ${r.kod}`);

// 7) ORTAK onaylananlari gorur + dosya linki
r = await cagir(dat, { method: "GET", headers: O, query: { markaPaneli: "1" }, body: {} });
const onayli = ((r.govde.markaPaneli || {}).hazirIcerikler || []).find((x) => x.durum === "onaylandi");
t("ortak onaylananı görüyor", !!onayli);
t("ortak paylaşmak için dosya linkini alıyor", onayli && onayli.dosyaLinki === "DOSYA1");
t("ortağa da iç brief gitmiyor", !JSON.stringify(r.govde).includes("İÇ BRIEF"));

// 8) Ortak paylasim planlar
r = await cagir(pay, { method: "POST", headers: O, query: {}, body: { action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-10", tur: "Reels" } });
d = await kv.get("marcus-os-data");
t("ortak paylaşım planlayabiliyor", (d.haftalikPaylasimlar || []).length === 1, `HTTP ${r.kod}`);

// 9) Gunluk kontrolde gorunur (plan verisi geliyor mu)
r = await cagir(dat, { method: "GET", headers: O, query: {}, body: {} });
t("plan Günlük Kontrol'e ulaşıyor", ((r.govde.data || {}).haftalikPaylasimlar || []).length === 1);

// 10) Ortak paylasildi isaretler
const pid = d.haftalikPaylasimlar[0].id;
r = await cagir(pay, { method: "POST", headers: O, query: {}, body: { action: "haftalikToggle", planId: pid } });
d = await kv.get("marcus-os-data");
t("paylaşıldı işaretlenebiliyor", (d.haftalikPaylasimlar[0] || {}).yapildi === true, `HTTP ${r.kod}`);

// 11) Yedek hala calisiyor
r = await cagir(dat, { method: "GET", headers: OWNER, query: {}, body: {} });
t("yönetici verisi bozulmadı", (r.govde.data.clients || []).length === 1 && (r.govde.data.cekimIsleri || []).length === 1);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
