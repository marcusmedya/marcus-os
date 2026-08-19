/* AYNI ANDA ÇALIŞMA — ÜÇ KİŞİ, ÜÇ FARKLI BÖLÜM, HİÇ KAYIP YOK
 *
 * ŞİKÂYET: "birisi şifre kasasına şifre giriyor, diğeri kart düzenliyor, bir başkası başka
 * kartı hareket ettiriyor — sistem geriye atıyor."
 *
 * SEBEP: `_v` TEK bir genel sayaçtı. 28 alanın hepsi için ortak. Şifre kasasına kayıt giren
 * biri onu artırıyor, o anda kart düzenleyen HERKES bir anda bayat oluyor, kaydı 409 ile
 * geri çevriliyor ve ön yüz kullanıcının o anki düzenlemesini ATIYORDU. Üç kişide sistem
 * pratikte kilitleniyordu: biri kaydediyor, ikisi atılıyor, tekrar deniyorlar, bu sefer
 * başkası kaydediyor…
 *
 * ÇÖZÜM: her üst düzey alanın kendi sayacı (`_alanSurumleri`). İstemci yalnızca DOKUNDUĞU
 * alanları bildiriyor; sunucu yalnızca onların sayacına bakıyor ve yalnızca onları yazıyor.
 * Şifre kasasıyla Operasyon kartlarının artık birbiriyle ilgisi yok.
 *
 * BU TEST ÜÇ KİŞİYİ GERÇEKTEN AYNI TABANDAN BAŞLATIYOR — yani hepsi aynı `_v` ve aynı alan
 * sürümleriyle işe koyuluyor, tıpkı üç tarayıcı sekmesi gibi. Eski kodda bu senaryoda iki
 * kişi kaybediyordu.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { alanSurumleriniArtir, catisanAlanlar } from "../lib/kv-yaz.js";
process.env.SITE_PASSWORD = "ownerpw";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const { default: paylasimUcu } = await import("../api/paylasim.js");
const { default: kasaUcu } = await import("../api/kasa.js");
const oku = () => kv.get("marcus-os-data");

const TEMEL = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "BINPARK" }],
  cekimIsleri: [
    { id: 10, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels 1", asama: "Edit Yapılıyor" },
    { id: 11, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels 2", asama: "Edit Bekliyor" },
  ],
  ownerKisiselSifreler: [],
  reklamlar: [], stoklar: {}, paylasimGecmisi: [], haftalikPaylasimlar: [], subeler: [],
  personelHesaplari: [], musteriHesaplari: [], musteriIcerikleri: [],
});

const kaydet = (veri, degisenAlanlar, taban) => cagir(veriUcu, {
  method: "POST", headers: OWNER, query: {},
  body: { data: { ...veri, _v: undefined }, _v: taban._v, degisenAlanlar, alanSurumleri: taban._alanSurumleri || {} },
});

/* ---------------------------------------------------------------- */
console.log("\n1) HESAP KATMANI");

let v = alanSurumleriniArtir({ cekimIsleri: [], ownerKisiselSifreler: [] }, ["cekimIsleri"]);
t("yalnızca bildirilen alanın sayacı artıyor",
  v._alanSurumleri.cekimIsleri === 1 && v._alanSurumleri.ownerKisiselSifreler === undefined,
  JSON.stringify(v._alanSurumleri));
v = alanSurumleriniArtir(v, ["ownerKisiselSifreler"]);
t("başka alan artınca ilki sabit kalıyor",
  v._alanSurumleri.cekimIsleri === 1 && v._alanSurumleri.ownerKisiselSifreler === 1,
  JSON.stringify(v._alanSurumleri));

t("dokunmadığım alan değişse bile ÇAKIŞMA YOK",
  catisanAlanlar(v, ["cekimIsleri"], { cekimIsleri: 1 }).length === 0,
  "asıl düzeltme bu");
t("dokunduğum alan değiştiyse çakışma VAR",
  catisanAlanlar(v, ["ownerKisiselSifreler"], { ownerKisiselSifreler: 0 }).length === 1);
t("bildirim yoksa çakışma yok sayılıyor (eski yola düşer)",
  catisanAlanlar(v, null, { cekimIsleri: 0 }).length === 0);
t("taban bilinmeyen alan reddedilmiyor",
  catisanAlanlar(v, ["yeniAlan"], { cekimIsleri: 1 }).length === 0,
  "yeni alan yüzünden kayıt reddedilmesin");
t("gizli alan adları sayaca girmiyor",
  alanSurumleriniArtir({ kasaSifresiHash: "x", personelHesaplari: [] }, undefined)._alanSurumleri.kasaSifresiHash === undefined);

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — üç kişi, aynı taban");

await kv.set("marcus-os-data", TEMEL());
/* Üçü de AYNI ANDA sayfayı açtı: aynı _v, aynı alan sürümleri. */
const taban = await oku();
t("üçü de aynı tabandan başlıyor", typeof taban._v === "number");

// A: şifre kasasına kayıt girer
let r = await kaydet(
  { ...taban, ownerKisiselSifreler: [{ id: 1, platform: "Instagram", sifre: "abc" }] },
  ["ownerKisiselSifreler"], taban);
t("A şifre kaydını yazdı", r.kod === 200, JSON.stringify(r.govde).slice(0, 90));

// B: kart düzenler — TABANI HÂLÂ ESKİ (A'nın yazdığını görmedi)
r = await kaydet(
  { ...taban, cekimIsleri: taban.cekimIsleri.map((j) => (j.id === 10 ? { ...j, icerikTuru: "Reels 1 — düzenlendi" } : j)) },
  ["cekimIsleri"], taban);
t("B ÇAKIŞMA ALMADI (eskiden 409 alıyordu)", r.kod === 200, `${r.kod} ${JSON.stringify(r.govde).slice(0, 90)}`);

// C: başka kartı taşır — tabanı hâlâ eski
r = await kaydet(
  { ...taban, cekimIsleri: taban.cekimIsleri.map((j) => (j.id === 11 ? { ...j, asama: "Edit Yapılıyor" } : j)) },
  ["cekimIsleri"], taban);
t("C aynı alana dokunduğu için ÇAKIŞMA ALDI", r.kod === 409, String(r.kod));
t("çakışan bölüm adıyla bildiriliyor",
  Array.isArray(r.govde.catisanAlanlar) && r.govde.catisanAlanlar.includes("cekimIsleri"),
  JSON.stringify(r.govde.catisanAlanlar));

const son = await oku();
t("A'nın şifre kaydı DURUYOR", (son.ownerKisiselSifreler || []).length === 1, JSON.stringify(son.ownerKisiselSifreler));
t("B'nin kart düzenlemesi DURUYOR",
  son.cekimIsleri.find((j) => j.id === 10).icerikTuru === "Reels 1 — düzenlendi",
  son.cekimIsleri.find((j) => j.id === 10).icerikTuru);
t("iki farklı bölüm aynı anda yazıldı, biri diğerini ezmedi",
  (son.ownerKisiselSifreler || []).length === 1 && son.cekimIsleri.find((j) => j.id === 10).icerikTuru.includes("düzenlendi"));

/* C tazeledikten sonra yazabilmeli. */
const tazeC = await oku();
r = await kaydet(
  { ...tazeC, cekimIsleri: tazeC.cekimIsleri.map((j) => (j.id === 11 ? { ...j, asama: "Edit Yapılıyor" } : j)) },
  ["cekimIsleri"], tazeC);
t("C tazeledikten sonra yazabiliyor", r.kod === 200, String(r.kod));
t("C'nin taşıması uygulandı", (await oku()).cekimIsleri.find((j) => j.id === 11).asama === "Edit Yapılıyor");
t("A ve B'nin işi hâlâ yerinde",
  (await oku()).ownerKisiselSifreler.length === 1 &&
  (await oku()).cekimIsleri.find((j) => j.id === 10).icerikTuru.includes("düzenlendi"));

/* ---------------------------------------------------------------- */
console.log("\n3) BAYAT KOPYA ÜZERİNE YAZAMIYOR");

await kv.set("marcus-os-data", TEMEL());
const t2 = await oku();
await kaydet({ ...t2, ownerKisiselSifreler: [{ id: 1, platform: "X" }] }, ["ownerKisiselSifreler"], t2);

/* B, ownerKisiselSifreler'i BOŞ olan bayat kopyasıyla kart kaydediyor.
 * Sunucu bildirilmeyen alanları kendi kopyasından koruduğu için şifre kaydı silinmemeli. */
r = await kaydet({ ...t2, cekimIsleri: [...t2.cekimIsleri, { id: 12, marka: "VIZZ", asama: "Edit Bekliyor" }] },
  ["cekimIsleri"], t2);
t("bayat kopyayla kart kaydı geçti", r.kod === 200, String(r.kod));
const s3 = await oku();
t("BAYAT KOPYA ŞİFRE KAYDINI SİLMEDİ", (s3.ownerKisiselSifreler || []).length === 1,
  JSON.stringify(s3.ownerKisiselSifreler));
t("yeni kart eklendi", s3.cekimIsleri.some((j) => j.id === 12));

/* ---------------------------------------------------------------- */
console.log("\n4) DİĞER UÇLAR DA HERKESİ BAYAT YAPMIYOR");

await kv.set("marcus-os-data", TEMEL());
const t3 = await oku();
/* Paylaşım panelinden stok değiştir — bu, Operasyon'da çalışanı etkilememeli. */
await cagir(paylasimUcu, { method: "POST", headers: OWNER, query: {},
  body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1 } });
const t3sonra = await oku();
t("paylaşım ucu cekimIsleri sayacını artırmadı",
  (t3sonra._alanSurumleri || {}).cekimIsleri === (t3._alanSurumleri || {}).cekimIsleri,
  `${JSON.stringify((t3._alanSurumleri||{}).cekimIsleri)} -> ${JSON.stringify((t3sonra._alanSurumleri||{}).cekimIsleri)}`);
r = await kaydet({ ...t3, cekimIsleri: t3.cekimIsleri.map((j) => (j.id === 10 ? { ...j, oncelik: "yuksek" } : j)) },
  ["cekimIsleri"], t3);
t("stok değişimi sonrası kart kaydı ÇAKIŞMADI", r.kod === 200, String(r.kod));
t("stok da yerinde", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

/* Kasa şifresi değişimi de Operasyon'u etkilememeli. */
await kv.set("marcus-os-data", TEMEL());
const t4 = await oku();
await cagir(kasaUcu, { method: "POST", headers: OWNER, query: {}, body: { action: "degistir", yeniSifre: "yeni1234" } });
r = await kaydet({ ...t4, cekimIsleri: t4.cekimIsleri.map((j) => (j.id === 10 ? { ...j, oncelik: "yuksek" } : j)) },
  ["cekimIsleri"], t4);
t("kasa şifresi değişimi kart kaydını engellemedi", r.kod === 200, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n5) GERİYE DÖNÜK UYUM — eski sekme bozulmuyor");

await kv.set("marcus-os-data", TEMEL());
const t5 = await oku();
/* Alan bilgisi GÖNDERMEYEN eski istemci: eski _v kuralı geçerli olmalı. */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...t5, firmaAdi: "Yeni Ad", _v: undefined }, _v: t5._v } });
t("alan bilgisi olmayan kayıt kabul ediliyor", r.kod === 200, String(r.kod));
t("kayıt uygulandı", (await oku()).firmaAdi === "Yeni Ad");

const t5b = await oku();
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...t5, firmaAdi: "Başka", _v: undefined }, _v: t5._v } });
t("eski yolda bayat _v hâlâ 409 alıyor", r.kod === 409, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n6) YANIT TABANI TAZELİYOR");

await kv.set("marcus-os-data", TEMEL());
const t6 = await oku();
r = await kaydet({ ...t6, cekimIsleri: t6.cekimIsleri.map((j) => ({ ...j, oncelik: "normal" })) }, ["cekimIsleri"], t6);
t("yanıt alan sürümlerini geri veriyor", Boolean(r.govde.alanSurumleri), JSON.stringify(r.govde.alanSurumleri));
t("geri verilen sürüm sunucudakiyle aynı",
  r.govde.alanSurumleri.cekimIsleri === (await oku())._alanSurumleri.cekimIsleri);
/* Aynı istemci arka arkaya iki kez kaydedebilmeli — kendi yazdığı yüzünden çakışma sanmasın. */
const t6b = { ...(await oku()) };
r = await kaydet({ ...t6b, cekimIsleri: t6b.cekimIsleri.map((j) => ({ ...j, oncelik: "yuksek" })) }, ["cekimIsleri"], t6b);
t("aynı istemci arka arkaya kaydedebiliyor", r.kod === 200, String(r.kod));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
