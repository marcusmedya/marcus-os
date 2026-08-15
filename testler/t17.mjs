import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const ORTAK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const VERI = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", aylikUcret: 30000 }, { id: 2, ad: "GİZLİ Marka", aylikUcret: 90000 }],
  musteriIcerikleri: [
    { id: 1, clientId: 1, tur: "gorsel", aciklama: "Görsel 1", durum: "bekliyor" },
    { id: 2, clientId: 1, tur: "video", aciklama: "Reels 1", durum: "revize", revizeNotu: "Müzik" },
    { id: 3, clientId: 2, tur: "gorsel", aciklama: "BAŞKA MARKA İÇERİĞİ", durum: "bekliyor" },
  ],
  cekimIsleri: [
    { id: 10, marka: "İbo Burger", asama: "Kontrol Bekliyor", icerikTuru: "Reels 2", brief: "İÇ BRIEF" },
    { id: 11, marka: "GİZLİ Marka", asama: "Kontrol Bekliyor", icerikTuru: "BAŞKA MARKA İŞİ" },
  ],
  gelirKalemleri: [{ id: 1, kalem: "GİZLİ GELİR" }],
  personel: [{ id: 1, ad: "GİZLİ PERSONEL", maas: 50000 }],
  personelHesaplari: [{
    id: "p1", ad: "Çözüm Ortağı", kullaniciAdi: "ortak",
    sifreHash: hash("1234", "s"), sifreSalt: "s",
    // SADECE içerik akışı izni — cekimEdit verilmedi, çünkü onun YAZMA izni zaten
    // musteriIcerikleri içeriyor ve testin amacı yeni iznin salt okunur olduğunu görmek.
    /* cekimEdit AÇIKÇA kapatıldı: varsayılan izinlerde açık geliyor ve onun YAZMA izni
     * musteriIcerikleri'ni kapsıyor. Testin amacı yeni musteriAkisi izninin tek başına
     * salt okunur olduğunu doğrulamak. */
    izinler: { musteriAkisi: true, cekimEdit: false, paylasimlar: false, reklamlar: false, finans: true, personel: true },
    markalar: ["İbo Burger"],
  }],
});

console.log("ÇÖZÜM ORTAĞI İÇERİK AKIŞI DENETİMİ\n");
await kv.set("marcus-os-data", VERI());
let r = await cagir(h, { method: "GET", headers: ORTAK, query: {}, body: {} });
const d = r.govde.data || {};
const metin = JSON.stringify(d);

kontrol("içerik akışı verisi geliyor", (d.musteriIcerikleri || []).length === 2, `${(d.musteriIcerikleri||[]).length} içerik`);
kontrol("kendi markasının içerikleri var", metin.includes("Görsel 1") && metin.includes("Reels 1"));
kontrol("BAŞKA markanın içeriği YOK", !metin.includes("BAŞKA MARKA İÇERİĞİ"));
kontrol("BAŞKA markanın işi YOK", !metin.includes("BAŞKA MARKA İŞİ"));
kontrol("izin verilse bile finans YOK", !metin.includes("GİZLİ GELİR"));
kontrol("izin verilse bile personel YOK", !metin.includes("GİZLİ PERSONEL"));
kontrol("müşteri ücreti gizli", !metin.includes("90000") && !metin.includes("30000"));
const izin = (r.govde.data || {}).staffPermissions || {};
kontrol("izinler daraltıldı (finans kapalı)", izin.finans === false, JSON.stringify(izin).slice(0, 110));
kontrol("içerik akışı izni AÇIK", izin.musteriAkisi === true);

// YAZMA denemesi — salt okunur olmali
const yazma = await cagir(h, { method: "POST", headers: ORTAK, query: {}, body: {
  data: { ...d, musteriIcerikleri: [{ id: 1, clientId: 1, tur: "gorsel", aciklama: "DEĞİŞTİRİLDİ", durum: "onaylandi" }] }, _v: d._v } });
const son = await kv.get("marcus-os-data");
const ic1 = (son.musteriIcerikleri || []).find((x) => x.id === 1) || {};
kontrol("içerik DEĞİŞTİRİLEMEDİ (salt okunur)", ic1.aciklama === "Görsel 1", `HTTP ${yazma.kod}, aciklama: ${ic1.aciklama}`);
kontrol("başka markanın içeriği duruyor", (son.musteriIcerikleri || []).some((x) => x.id === 3));

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
