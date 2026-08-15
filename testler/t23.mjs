import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: pay } = await import("../api/paylasim.js");
const { default: dat } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const H = { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };
const KAPALI = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false, musteriAkisi: false };

console.log("ÇÖZÜM ORTAĞI — PAYLAŞIM PLANLAMA\n");
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", durum: "aktif" }, { id: 2, ad: "GİZLİ Marka", durum: "aktif" }],
  haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], subeler: [],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s",
    izinler: { ...KAPALI, musteriAkisi: true, paylasimlar: true }, markalar: ["İbo Burger"] }],
});

// 1) Izgara cizilebiliyor mu — marka listesi ve durum alani
let r = await cagir(dat, { method: "GET", headers: H, query: {}, body: {} });
const d0 = r.govde.data || {};
const markalar = d0.clients || [];
t("marka listesi geliyor", markalar.length === 1, `${markalar.length} marka`);
t("durum alanı var (ızgara çizilebilsin)", markalar[0] && (markalar[0].durum === "aktif" || markalar[0].durum === "yeni"), String(markalar[0] && markalar[0].durum));
t("BAŞKA marka listede yok", !JSON.stringify(markalar).includes("GİZLİ"));
t("haftalık plan alanı geliyor", Array.isArray(d0.haftalikPaylasimlar));

// 2) Plan ekleme
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-10", tur: "Reels" } });
let veri = await kv.get("marcus-os-data");
t("plan EKLEYEBİLİYOR", (veri.haftalikPaylasimlar || []).length === 1, `HTTP ${r.kod} ${r.govde.error || ""}`);

// 3) Isaretleme
const planId = (veri.haftalikPaylasimlar[0] || {}).id;
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikToggle", planId } });
veri = await kv.get("marcus-os-data");
t("paylaşıldı İŞARETLEYEBİLİYOR", (veri.haftalikPaylasimlar[0] || {}).yapildi === true, `HTTP ${r.kod}`);

// 4) Silme
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikSil", planId } });
veri = await kv.get("marcus-os-data");
t("plan SİLEBİLİYOR", (veri.haftalikPaylasimlar || []).length === 0, `HTTP ${r.kod}`);

// 5) BASKA markaya plan ekleyemez
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikEkle", clientId: 2, gun: 1, haftaKey: "2026-08-10", tur: "Reels" } });
veri = await kv.get("marcus-os-data");
t("BAŞKA markaya plan EKLEYEMİYOR", (veri.haftalikPaylasimlar || []).length === 0, `HTTP ${r.kod}`);

// 6) Izin kapaliyken engelli
await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "İbo Burger", durum: "aktif" }], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s",
    izinler: { ...KAPALI, musteriAkisi: true }, markalar: ["İbo Burger"] }],
});
r = await cagir(pay, { method: "POST", headers: H, query: {}, body: { action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-10", tur: "Reels" } });
veri = await kv.get("marcus-os-data");
t("izin KAPALIYKEN eklenemiyor", (veri.haftalikPaylasimlar || []).length === 0, `HTTP ${r.kod}`);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
