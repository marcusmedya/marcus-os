import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const MUSTERI = { "x-musteri-username-b64": b64("ibo"), "x-musteri-password-b64": b64("1234"), "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const VERI = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger" }, { id: 2, ad: "Başka Marka" }],
  musteriHesaplari: [{ id: "m1", ad: "İbo", kullaniciAdi: "ibo", clientId: 1, sifreHash: hash("1234", "s"), sifreSalt: "s" }],
  cekimIsleri: [
    { id: 10, marka: "İbo Burger", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "Reels 1", editliDosyaLink: "https://drive.google.com/file/d/AAA/view", brief: "GİZLİ BRIEF", kameraman: "GİZLİ KİŞİ", gecmis: [], yorumlar: [{ x: "GİZLİ YORUM" }] },
    { id: 11, marka: "İbo Burger", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "Reels 2 (dosyasız)" },
    { id: 12, marka: "İbo Burger", kategori: "Video", asama: "Edit Yapılıyor", icerikTuru: "GÖRÜNMEMELİ" },
    { id: 13, marka: "Başka Marka", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "BAŞKA MARKA İŞİ" },
  ],
  musteriIcerikleri: [],
});

console.log("HAZIR İÇERİKLER SENKRON DENETİMİ\n");
await kv.set("marcus-os-data", VERI());
let r = await cagir(h, { method: "GET", headers: MUSTERI, query: {}, body: {} });
const hz = r.govde.hazirIcerikler || [];
kontrol("Kontrol Bekliyor kartları geliyor", hz.length === 2, `${hz.length} kart: ${hz.map(x=>x.baslik).join(", ")}`);
kontrol("dosyasız kart da geliyor", hz.some(x => x.baslik.includes("dosyasız")));
kontrol("başka aşamadaki iş GELMİYOR", !JSON.stringify(hz).includes("GÖRÜNMEMELİ"));
kontrol("başka markanın işi GELMİYOR", !JSON.stringify(hz).includes("BAŞKA MARKA"));
kontrol("brief/kişi/yorum sızmıyor", !JSON.stringify(hz).includes("GİZLİ"));

// Onay -> Onaylandi
r = await cagir(h, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "onayla", isId: 10 } });
let son = await kv.get("marcus-os-data");
kontrol("onay → iş 'Onaylandı' oldu", (son.cekimIsleri.find(j=>j.id===10)||{}).asama === "Onaylandı", `HTTP ${r.kod}`);
r = await cagir(h, { method: "GET", headers: MUSTERI, query: {}, body: {} });
kontrol("onaylanan kart listeden DÜŞTÜ", !(r.govde.hazirIcerikler||[]).some(x=>x.isId===10));

// Revize -> Revize Istendi + not
r = await cagir(h, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "revizeIste", isId: 11, revizeNotu: "Müzik değişsin" } });
son = await kv.get("marcus-os-data");
const is11 = son.cekimIsleri.find(j=>j.id===11) || {};
kontrol("revize → iş 'Revize İstendi' oldu", is11.asama === "Revize İstendi", `HTTP ${r.kod}`);
kontrol("revize notu işin geçmişine yazıldı", (is11.gecmis||[]).some(x => String(x.aciklama).includes("Müzik değişsin")));

// Guvenlik: baska markanin isine dokunamamali
await kv.set("marcus-os-data", VERI());
r = await cagir(h, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "onayla", isId: 13 } });
son = await kv.get("marcus-os-data");
kontrol("başka markanın işi DEĞİŞTİRİLEMEDİ", (son.cekimIsleri.find(j=>j.id===13)||{}).asama === "Kontrol Bekliyor");

// Guvenlik: Kontrol Bekliyor disindaki ise dokunamamali
r = await cagir(h, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "onayla", isId: 12 } });
son = await kv.get("marcus-os-data");
kontrol("başka aşamadaki iş DEĞİŞTİRİLEMEDİ", (son.cekimIsleri.find(j=>j.id===12)||{}).asama === "Edit Yapılıyor");

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
