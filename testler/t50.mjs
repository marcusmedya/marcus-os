/* STOK TABLOSU İSTEMCİDEN ALINMIYOR — ÖLÇÜLMÜŞ VERİ KAYBI
 *
 * BULUNAN HATA. Yönetici Operasyon'dan iki kartı arka arkaya onayladığında stok 2 değil
 * 1 oluyordu. Sebep, blob kaydında `stoklar` alanının TARAYICIDAN gelmesiydi:
 *
 *   1. kartı onayla -> sunucu {"1_Reels":1} yazıyor; yanıt stoğu geri vermiyor,
 *                      tarayıcının kopyası {} olarak kalıyor
 *   2. kartı onayla -> tarayıcı {} gönderiyor, sunucu bunu TABAN alıp üstüne 1 ekliyor
 *   sonuç: {"1_Reels":1} — iki onay yapıldı, stok bir. İlk artış silindi.
 *
 * Hiçbir hata görünmüyordu; sayı yanlış olup susuyordu.
 *
 * Stok yalnızca /api/paylasim üzerinden değiştiriliyor (+/- düğmeleri, paylaşım
 * işaretleme) ve onay geçişlerinde sunucu hesaplıyor. Blob kaydındaki kopya pasif —
 * taze olması için hiçbir sebep yok. Artık taban her zaman sunucudaki değer.
 *
 * BU TEST TARAYICIYI BİLEREK "SAĞIR" OYNUYOR: yanıttaki stoğu işlemiyor, yalnızca sürümü
 * alıyor. Böylece koruma, tarayıcının doğru davranmasına bağlı kalmadan sınanıyor.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const { default: paylasimUcu } = await import("../api/paylasim.js");
const oku = () => kv.get("marcus-os-data");

const KART = (id, ad) => ({ id, marka: "VIZZ", kategori: "Video", icerikTuru: ad, asama: "Kontrol Bekliyor" });
const TEMEL = () => ({
  _v: 1, clients: [{ id: 1, ad: "VIZZ" }], stoklar: {},
  cekimIsleri: [KART(1, "Reels 1"), KART(2, "Reels 2"), KART(3, "Reels 3")],
  paylasimGecmisi: [], haftalikPaylasimlar: [], subeler: [],
  personelHesaplari: [{ id: "p1", ad: "Editör", kullaniciAdi: "ed", sifreHash: hash("1", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true, paylasimlar: true }, markalar: [] }],
  musteriHesaplari: [],
});
const KIMLIK = { "x-staff-username-b64": b64("ed"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };

/* ---------------------------------------------------------------- */
console.log("\n1) YÖNETİCİ — arka arkaya onay");

await kv.set("marcus-os-data", TEMEL());
/* SAĞIR TARAYICI: yanıttan yalnızca _v alıyor, stoğu hiç işlemiyor. */
let yerel = await oku();
const onayla = async (id, headers, veriMi = true) => {
  yerel = { ...yerel, cekimIsleri: yerel.cekimIsleri.map((j) => (j.id === id ? { ...j, asama: "Onaylandı" } : j)) };
  const govde = veriMi
    ? { data: { ...yerel, _v: undefined }, _v: yerel._v }
    : { data: { cekimIsleri: yerel.cekimIsleri, stoklar: yerel.stoklar }, _v: yerel._v };
  const r = await cagir(veriUcu, { method: "POST", headers, query: {}, body: govde });
  if (typeof r.govde._v === "number") yerel._v = r.govde._v;
  return r;
};

let r = await onayla(1, OWNER);
t("1. onay geçti", r.kod === 200, JSON.stringify(r.govde).slice(0, 100));
t("stok 1 oldu", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

r = await onayla(2, OWNER);
t("2. onay geçti", r.kod === 200);
t("stok 2 OLDU — ilk artış silinmedi", (await oku()).stoklar["1_Reels"] === 2,
  JSON.stringify((await oku()).stoklar));

r = await onayla(3, OWNER);
t("üçüncüsü de sayıldı", (await oku()).stoklar["1_Reels"] === 3, JSON.stringify((await oku()).stoklar));

console.log("\n   Onaydan çıkış da doğru sayıyor");
yerel = { ...yerel, cekimIsleri: yerel.cekimIsleri.map((j) => (j.id === 3 ? { ...j, asama: "Revize İstendi" } : j)) };
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...yerel, _v: undefined }, _v: yerel._v } });
yerel._v = r.govde._v;
t("geri alınca 2'ye düştü", (await oku()).stoklar["1_Reels"] === 2, JSON.stringify((await oku()).stoklar));

/* ---------------------------------------------------------------- */
console.log("\n2) BAYAT STOK TABLOSU ÜZERİNE YAZAMIYOR");

await kv.set("marcus-os-data", { ...TEMEL(), stoklar: { "1_Reels": 7, "1_Görsel": 4 } });
let d = await oku();
/* Tarayıcı stoğu SIFIRLAMAYA çalışıyor — bayat ya da bozuk bir kopya. */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, stoklar: {}, _v: undefined }, _v: d._v } });
d = await oku();
t("gönderilen boş tablo yok sayıldı", d.stoklar["1_Reels"] === 7 && d.stoklar["1_Görsel"] === 4,
  JSON.stringify(d.stoklar));

/* Uydurma sayı da geçmemeli. */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, stoklar: { "1_Reels": 999 }, _v: undefined }, _v: d._v } });
d = await oku();
t("uydurma sayı da yok sayıldı", d.stoklar["1_Reels"] === 7, JSON.stringify(d.stoklar));

/* ---------------------------------------------------------------- */
console.log("\n3) STOK HÂLÂ KENDİ UCUNDAN DEĞİŞTİRİLEBİLİYOR");

r = await cagir(paylasimUcu, { method: "POST", headers: OWNER, query: {},
  body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1 } });
t("+ düğmesi çalışıyor", r.kod === 200 && (await oku()).stoklar["1_Reels"] === 8,
  JSON.stringify((await oku()).stoklar));
r = await cagir(paylasimUcu, { method: "POST", headers: OWNER, query: {},
  body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: -1 } });
t("− düğmesi çalışıyor", (await oku()).stoklar["1_Reels"] === 7, JSON.stringify((await oku()).stoklar));

/* ---------------------------------------------------------------- */
console.log("\n4) PERSONEL — aynı koruma");

await kv.set("marcus-os-data", TEMEL());
yerel = await oku();
r = await onayla(1, KIMLIK, false);
t("personel 1. onayı geçti", r.kod === 200, JSON.stringify(r.govde).slice(0, 100));
t("stok 1 oldu", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));
r = await onayla(2, KIMLIK, false);
t("stok 2 OLDU — personelde de silinmiyor", (await oku()).stoklar["1_Reels"] === 2,
  JSON.stringify((await oku()).stoklar));

await kv.set("marcus-os-data", { ...TEMEL(), stoklar: { "1_Reels": 5 } });
d = await oku();
r = await cagir(veriUcu, { method: "POST", headers: KIMLIK, query: {},
  body: { data: { stoklar: { "1_Reels": 0 } }, _v: d._v } });
t("personel stok tablosunu doğrudan yazamıyor", (await oku()).stoklar["1_Reels"] === 5,
  JSON.stringify((await oku()).stoklar));

const api = fs.readFileSync(path.join(kok, "api", "data.js"), "utf8");
t("stoklar personel yazma listesinde yok",
  /paylasimlar: \["paylasimGecmisi"/.test(api));
t("yönetici yolunda taban sunucudan alınıyor",
  /existingFull && existingFull\.stoklar,\n\s*finalData\.clients/.test(api));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
