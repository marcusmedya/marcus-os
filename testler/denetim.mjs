import crypto from "crypto";
import { kv } from "@vercel/kv";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const salt = "s1";

export const TEMIZ_VERI = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "Şişçi İbo", aylikUcret: 15000 }, { id: 2, ad: "GİZLİ Marka", aylikUcret: 90000, odemeKayitlari: [{ id: 1, tutar: 50000 }] }],
  reklamlar: [{ id: 1, marka: "Şişçi İbo", butce: 5000 }, { id: 2, marka: "GİZLİ Marka", butce: 99000 }],
  stoklar: { "1_Reels": 5, "2_Reels": 7 },
  haftalikPaylasimlar: [{ id: 1, clientId: 1, gun: "Pzt", tur: "Reels" }, { id: 2, clientId: 2, gun: "Sal", tur: "Post", altMetin: "GİZLİ METİN" }],
  cekimIsleri: [{ id: 1, marka: "Şişçi İbo" }, { id: 2, marka: "GİZLİ Marka", brief: "GİZLİ BRIEF" }],
  subeler: [], paylasimGecmisi: [], gunlukKontrol: null, musteriIcerikleri: [],
  kasaSifresiHash: null, kasaSifresiSalt: null,
  sifreler: [{ id: 1, platform: "Instagram", clientId: 2, kullanici: "gizli", sifre: "GIZLISIFRE" }],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "ortak", sifreHash: hash("1234", salt), sifreSalt: salt,
    izinler: { paylasimlar: true, reklamlar: true, cekimEdit: true, sifreKasasi: true, musteriler: true, odemeTakvimi: true }, markalar: ["Şişçi İbo"] }],
  musteriHesaplari: [],
});
export const KIMLIK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234") };
export const R = () => {
  const r = { basliklar: {} };
  r.status = (k) => { r.kod = k; return r; };
  r.json = (g) => { r.govde = g; return r; };
  /* setHeader gerçek Vercel yanıtında var; taklitte yoksa Retry-After gibi başlıklar
     test edilemez ve sessizce atlanır. */
  r.setHeader = (ad, deger) => { r.basliklar[String(ad).toLowerCase()] = deger; return r; };
  return r;
};
export async function cagir(handler, req) { const res = R(); await handler(req, res); return res; }
export function sizintiAra(nesne, gizliler = ["GİZLİ", "GIZLISIFRE", "99000", "90000"]) {
  const metin = JSON.stringify(nesne || {});
  return gizliler.filter((g) => metin.includes(g));
}
