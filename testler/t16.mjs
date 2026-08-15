import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const M = { "x-musteri-username-b64": b64("diren"), "x-musteri-password-b64": b64("1234"), "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const VERI = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "Kanatçı Diren" }],
  musteriHesaplari: [{ id: "m1", ad: "Diren", kullaniciAdi: "diren", clientId: 1, sifreHash: hash("1234", "s"), sifreSalt: "s" }],
  cekimIsleri: [
    { id: 10, marka: "Kanatçı Diren", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "TREND REELS", gecmis: [] },
    { id: 11, marka: "Kanatçı Diren", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "YORUMLAR", gecmis: [] },
  ],
  musteriIcerikleri: [
    // Eski kopya — 10 numarali isin kopyasi, artik gonderilmemeli
    { id: 1, clientId: 1, tur: "video", aciklama: "TREND REELS (eski kopya)", durum: "bekliyor", kaynakIsId: 10 },
    // Cekim plani — Operasyon'da karsiligi yok, gonderilmeli
    { id: 2, clientId: 1, tur: "cekim", aciklama: "Yeni çekim fikri", durum: "bekliyor" },
    // Elle eklenmis, ise bagli olmayan icerik
    { id: 3, clientId: 1, tur: "gorsel", aciklama: "Elle eklenen görsel", durum: "bekliyor" },
  ],
});

console.log("BİREBİR SENKRON DENETİMİ\n");
await kv.set("marcus-os-data", VERI());
let r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
let ic = r.govde.icerikler || [], hz = r.govde.hazirIcerikler || [];
kontrol("Operasyon kopyası artık gönderilmiyor", !JSON.stringify(ic).includes("eski kopya"), `${ic.length} içerik`);
kontrol("çekim planı gönderiliyor", JSON.stringify(ic).includes("çekim fikri"));
kontrol("elle eklenen içerik gönderiliyor", JSON.stringify(ic).includes("Elle eklenen"));
kontrol("her iş TEK KEZ görünüyor", hz.length === 2 && ic.filter(x => x.kaynakIsId).length === 0, `hazır:${hz.length} içerik:${ic.length}`);

// ONAY -> Onaylandi sutunu
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "onayla", isId: 10 } });
let son = await kv.get("marcus-os-data");
kontrol("onay → 'Onaylandı' sütununa düştü", (son.cekimIsleri.find(j=>j.id===10)||{}).asama === "Onaylandı", `HTTP ${r.kod}`);

// REVIZE -> Revize Istendi sutunu
r = await cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "revizeIste", isId: 11, revizeNotu: "Müzik değişsin" } });
son = await kv.get("marcus-os-data");
const is11 = son.cekimIsleri.find(j=>j.id===11) || {};
kontrol("revize → 'Revize İstendi' sütununa düştü", is11.asama === "Revize İstendi", `HTTP ${r.kod}`);
kontrol("revize notu işe yazıldı", (is11.gecmis||[]).some(x=>String(x.aciklama).includes("Müzik değişsin")));

// Ikisi de listeden dustu mu
r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
// Artık kaybolmuyorlar: durum değiştirip "revize"/"onaylandi" kovasına geçiyorlar.
const kalanBekleyen = (r.govde.hazirIcerikler || []).filter(x => x.durum === "bekliyor");
kontrol("işlem görenler ONAY BEKLEYENLER'den düştü", kalanBekleyen.length === 0, `${kalanBekleyen.length} bekleyen kaldı`);
kontrol("işlem görenler kayıt olarak duruyor", (r.govde.hazirIcerikler || []).length === 2);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);

// EK: revize/onayli kartlar aynada duruyor mu
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "Kanatçı Diren" }],
  musteriHesaplari: [{ id: "m1", ad: "Diren", kullaniciAdi: "diren", clientId: 1, sifreHash: hash("1234", "s"), sifreSalt: "s" }],
  cekimIsleri: [
    { id: 20, marka: "Kanatçı Diren", asama: "Kontrol Bekliyor", icerikTuru: "BEKLEYEN" },
    { id: 21, marka: "Kanatçı Diren", asama: "Revize İstendi", icerikTuru: "REVIZELI", musteriRevizeNotu: "Müzik" },
    { id: 22, marka: "Kanatçı Diren", asama: "Onaylandı", icerikTuru: "ONAYLI" },
    { id: 23, marka: "Kanatçı Diren", asama: "Teslim Edildi", icerikTuru: "TESLIM" },
    { id: 24, marka: "Kanatçı Diren", asama: "Edit Yapılıyor", icerikTuru: "GORUNMEMELI" },
  ],
  musteriIcerikleri: [],
});
r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
const hepsi = r.govde.hazirIcerikler || [];
const durumlar = (d) => hepsi.filter(x => x.durum === d).map(x => x.baslik);
kontrol("bekleyen doğru durumda", durumlar("bekliyor").join() === "BEKLEYEN");
kontrol("revize durumu görünüyor", durumlar("revize").join() === "REVIZELI");
kontrol("onaylı + teslim 'onaylandi' altında", durumlar("onaylandi").sort().join() === "ONAYLI,TESLIM");
kontrol("üretimdeki iş görünmüyor", !JSON.stringify(hepsi).includes("GORUNMEMELI"));
kontrol("revize notu taşınıyor", (hepsi.find(x=>x.durum==="revize")||{}).revizeNotu === "Müzik");
console.log(`\nGENEL: ${g} geçti, ${k} kaldı`);
