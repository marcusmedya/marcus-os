import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const MUSTERI = { "x-musteri-username-b64": b64("diren"), "x-musteri-password-b64": b64("1234"), "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

console.log("MARKA ADI YAZIM FARKI DENETİMİ\n");
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "Kanatçı Diren" }, { id: 2, ad: "İbo Burger" }],
  musteriHesaplari: [{ id: "m1", ad: "Diren", kullaniciAdi: "diren", clientId: 1, sifreHash: hash("1234", "s"), sifreSalt: "s" }],
  cekimIsleri: [
    { id: 1, marka: "Kanatçı Diren", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "reels" },
    { id: 2, marka: "KANATÇI DIREN", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "yorumlar" },
    { id: 3, marka: "Kanatçı  Diren", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "reels trend" },
    { id: 4, marka: "Kanatci Diren", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "türkçesiz" },
    { id: 5, marka: "İbo Burger", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "BAŞKA MARKA" },
  ],
  reklamlar: [{ id: 1, marka: "KANATÇI DIREN", reklamAdi: "Kampanya" }],
  musteriIcerikleri: [],
});
let r = await cagir(h, { method: "GET", headers: MUSTERI, query: {}, body: {} });
const hz = r.govde.hazirIcerikler || [];
kontrol("4 yazım biçiminin hepsi geldi", hz.length === 4, `${hz.length} kart: ${hz.map(x=>x.baslik).join(", ")}`);
kontrol("başka markanın işi gelmedi", !JSON.stringify(hz).includes("BAŞKA MARKA"));
kontrol("reklam da eşleşti", (r.govde.reklamlar || []).length === 1);

// CAKISMA: iki musteri ayni anahtara duserse tam eslesmeye donmeli
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "Cem" }, { id: 2, ad: "Çem" }],
  musteriHesaplari: [{ id: "m1", ad: "Cem", kullaniciAdi: "diren", clientId: 1, sifreHash: hash("1234", "s"), sifreSalt: "s" }],
  cekimIsleri: [
    { id: 1, marka: "Cem", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "BENIM" },
    { id: 2, marka: "Çem", kategori: "Video", asama: "Kontrol Bekliyor", icerikTuru: "DIGERININ" },
  ],
  musteriIcerikleri: [],
});
r = await cagir(h, { method: "GET", headers: MUSTERI, query: {}, body: {} });
const hz2 = r.govde.hazirIcerikler || [];
kontrol("çakışmada kendi kartı geldi", JSON.stringify(hz2).includes("BENIM"));
kontrol("çakışmada DİĞER markanınki gelmedi", !JSON.stringify(hz2).includes("DIGERININ"), `${hz2.length} kart`);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
