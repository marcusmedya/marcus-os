/* PERSONEL VE ÇÖZÜM ORTAĞI HİÇBİR ŞEY KAYDEDEMİYORDU
 *
 * ŞİKÂYET: "Tasarım kartı açıyoruz, görsel yüklediğimizde kırmızı yazıyla 'iş bulunamadı'
 * diyor; orayı kapattığımızda iş kartı kayboluyor."
 *
 * SEBEP: çakışma kontrolü alan bazlı. İstemci, dokunduğu alanın SON GÖRDÜĞÜ sürüm sayacını
 * gönderiyor; sunucu onunla karşılaştırıyor. "Tabanı bilmiyorum" demek üzerine körlemesine
 * yazma isteği demektir ve haklı olarak reddediliyor.
 *
 * AMA bu sayaçlar personel/çözüm ortağı yanıtına hiç konmuyordu. Tarayıcı boş harita
 * gönderiyor, sunucu her alanı "tabanı bilinmiyor" sayıp 409 dönüyordu. Sonuç: personel ve
 * çözüm ortakları normal yoldan HİÇBİR ŞEY kaydedemiyordu.
 *
 * Kullanıcının gördüğü zincir tam olarak şuydu: kart tarayıcıda oluşuyor ama sunucuya hiç
 * ulaşmıyor → o karta dosya yüklenmek istendiğinde sunucu kartı bulamıyor ("İş kartı
 * bulunamadı") → ilk tazelemede kart ekrandan da kayboluyor. Hiçbir adımda kaydın
 * reddedildiğini söyleyen bir uyarı yok.
 *
 * İKİNCİ BULGU: marka kilidi yüzünden elenen kayıtlar "ok: true" ile SESSİZCE düşüyordu.
 * Elemek doğru; sessizce elemek aynı hayaleti üretiyordu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "3";

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { birlestirmedeDusenler } from "../lib/marka-kilidi.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const salt = "s1";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const ORTAK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { cekimIsleri: 3, clients: 2 },
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "BINPARK" }],
  cekimIsleri: [{ id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels", asama: "Edit Bekliyor" }],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "ortak", sifreHash: hash("1234", salt), sifreSalt: salt,
    izinler: { cekimEdit: true, paylasimlar: true }, markalar: ["VIZZ"] }],
  musteriHesaplari: [], stoklar: {}, reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [], musteriIcerikleri: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };

/** Uygulamanın gerçekte yaptığı akış: GET al, listeye kart ekle, alan bazlı kaydet. */
async function kartOlusturVeKaydet(kimlik, kart) {
  const gorunen = await cagir(veriUcu, { method: "GET", headers: kimlik, query: {} });
  const d = gorunen.govde.data;
  const kayit = await cagir(veriUcu, {
    method: "POST", headers: kimlik, query: {},
    body: {
      data: { ...d, cekimIsleri: [...(d.cekimIsleri || []), kart], _v: undefined },
      _v: d._v,
      degisenAlanlar: ["cekimIsleri"],
      alanSurumleri: d._alanSurumleri || {},
    },
  });
  return { gorunen, kayit };
}
const yuklemeDene = (kimlik, isId) => cagir(veriUcu, {
  method: "POST", headers: kimlik, query: {},
  body: { driveAction: "yuklemeBasla", isId, slot: "1", dosyaAdi: "tasarim.png", mimeTur: "image/png", boyut: 1000 },
});

const TASARIM = { id: 99, marka: "VIZZ", kategori: "Tasarım", icerikTuru: "Logo", asama: "Çekim Planlandı" };

/* ---------------------------------------------------------------- */
console.log("\n1) SÜRÜM SAYAÇLARI PERSONELE DE GİDİYOR");

await sifirla();
{
  const y = await cagir(veriUcu, { method: "GET", headers: ORTAK, query: {} });
  const d = y.govde.data;
  /* Sayaçlar hiç gelmemiş olabilir — test o zaman ÇÖKMEMELİ, düşmeli. Çöken test
   * kaç kontrolün gerçekten kaybolduğunu gizler; bu projede bir kez öyle oldu. */
  const sayaclar = (d && d._alanSurumleri) || null;
  t("çözüm ortağı GET'inde alan sürümleri var", sayaclar !== null && typeof sayaclar === "object",
    "yoksa istemci boş taban gönderir ve HER kayıt 409 alır");
  t("sayaçlar sunucudaki değerlerle aynı", Boolean(sayaclar) && sayaclar.cekimIsleri === 3);
  t("sayaçlar sadece sayı taşıyor",
    Boolean(sayaclar) && Object.values(sayaclar).every((v) => typeof v === "number"));
  t("gizli alan adları sayaca girmiyor",
    Boolean(sayaclar) && !("kasaSifresiHash" in sayaclar) && !("personelHesaplari" in sayaclar));
}

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — çözüm ortağı Tasarım kartı açıp görsel yüklüyor");

await sifirla();
{
  const { kayit } = await kartOlusturVeKaydet(ORTAK, TASARIM);
  const sonHal = await kv.get(KEY);
  const sunucuda = (sonHal.cekimIsleri || []).some((j) => String(j.id) === "99");

  t("kayıt 409 ile reddedilmiyor", kayit.kod === 200, "gelen: " + kayit.kod);
  t("kart SUNUCUYA ULAŞIYOR", sunucuda === true, "ulaşmazsa kart yalnızca tarayıcıda yaşar");
  t("başka markanın kartı silinmedi", (sonHal.cekimIsleri || []).some((j) => String(j.id) === "1"));

  const yukleme = await yuklemeDene(ORTAK, 99);
  t("görsel yüklerken 'İş kartı bulunamadı' ÇIKMIYOR", yukleme.kod !== 404,
    "gelen: " + yukleme.kod + " " + ((yukleme.govde && yukleme.govde.error) || ""));
}

/* ---------------------------------------------------------------- */
console.log("\n3) YÖNETİCİ YOLU BOZULMADI");

await sifirla();
{
  const { kayit } = await kartOlusturVeKaydet(OWNER, TASARIM);
  const sonHal = await kv.get(KEY);
  t("yönetici kaydı geçiyor", kayit.kod === 200);
  t("kart sunucuda", (sonHal.cekimIsleri || []).some((j) => String(j.id) === "99"));
  const yukleme = await yuklemeDene(OWNER, 99);
  t("yönetici için de kart bulunuyor", yukleme.kod !== 404, "gelen: " + yukleme.kod);
}

/* ---------------------------------------------------------------- */
console.log("\n4) ÇAKIŞMA KORUMASI HÂLÂ ÇALIŞIYOR — sayaç göndermek onu delmiyor");

await sifirla();
{
  /* Çözüm ortağı bayat bir sayaçla gelirse yine reddedilmeli; yoksa bu düzeltme
   * çakışma korumasını tamamen kapatmış olurdu. */
  const gorunen = await cagir(veriUcu, { method: "GET", headers: ORTAK, query: {} });
  const d = gorunen.govde.data;
  const bayat = await cagir(veriUcu, {
    method: "POST", headers: ORTAK, query: {},
    body: {
      data: { ...d, cekimIsleri: [...(d.cekimIsleri || []), TASARIM], _v: undefined },
      _v: d._v, degisenAlanlar: ["cekimIsleri"],
      alanSurumleri: { ...d._alanSurumleri, cekimIsleri: 1 },   // sunucuda 3
    },
  });
  t("bayat sayaç hâlâ 409 alıyor", bayat.kod === 409, "gelen: " + bayat.kod);
  t("bayat kayıt yazılmadı", !((await kv.get(KEY)).cekimIsleri || []).some((j) => String(j.id) === "99"));
}

/* ---------------------------------------------------------------- */
console.log("\n5) ELENEN KAYIT SESSİZCE DÜŞMÜYOR");

t("markasız kayıt 'markasiz' sebebiyle işaretleniyor",
  birlestirmedeDusenler(
    { clients: [{ id: 1, ad: "VIZZ" }] },
    { cekimIsleri: [{ id: 5, marka: "" }] },
    "cekimIsleri", ["VIZZ"],
  )[0].sebep === "markasiz");
t("yetkisiz marka 'yetkisiz' sebebiyle işaretleniyor",
  birlestirmedeDusenler(
    { clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "BINPARK" }] },
    { cekimIsleri: [{ id: 6, marka: "BINPARK" }] },
    "cekimIsleri", ["VIZZ"],
  )[0].sebep === "yetkisiz");
t("kendi markası elenmiyor",
  birlestirmedeDusenler(
    { clients: [{ id: 1, ad: "VIZZ" }] },
    { cekimIsleri: [{ id: 7, marka: "VIZZ" }] },
    "cekimIsleri", ["VIZZ"],
  ).length === 0);
t("kilitsiz hesapta hiçbir şey elenmiyor",
  birlestirmedeDusenler(
    { clients: [{ id: 1, ad: "VIZZ" }] },
    { cekimIsleri: [{ id: 8, marka: "BINPARK" }] },
    "cekimIsleri", [],
  ).length === 0);

await sifirla();
{
  const gorunen = await cagir(veriUcu, { method: "GET", headers: ORTAK, query: {} });
  const d = gorunen.govde.data;
  const kayit = await cagir(veriUcu, {
    method: "POST", headers: ORTAK, query: {},
    body: {
      data: { ...d, cekimIsleri: [...(d.cekimIsleri || []), { id: 77, marka: "BINPARK", kategori: "Tasarım" }], _v: undefined },
      _v: d._v, degisenAlanlar: ["cekimIsleri"], alanSurumleri: d._alanSurumleri || {},
    },
  });
  const bildirim = (kayit.govde && kayit.govde.kaydedilmeyenler) || [];
  t("kaydedilmeyen kayıt YANITTA bildiriliyor", Array.isArray(bildirim) && bildirim.length === 1,
    "bildirilmezse kullanıcı kartı ekranda görmeye devam eder, sunucuda yoktur");
  t("hangi kayıt olduğu belli", Boolean(bildirim[0]) && bildirim[0].id === 77 && bildirim[0].alan === "cekimIsleri");
  t("sebep taşınıyor", Boolean(bildirim[0]) && bildirim[0].sebep === "yetkisiz");
  t("başka markanın kaydı yine de yazılmadı",
    !((await kv.get(KEY)).cekimIsleri || []).some((j) => String(j.id) === "77"),
    "bildirim, izni gevşetmek değil — sadece görünür kılmak");

  /* Her şey yolundaysa gereksiz uyarı çıkmamalı. */
  const temiz = await cagir(veriUcu, { method: "GET", headers: ORTAK, query: {} });
  const td = temiz.govde.data;
  const iyi = await cagir(veriUcu, {
    method: "POST", headers: ORTAK, query: {},
    body: { data: { ...td, cekimIsleri: [...(td.cekimIsleri || []), TASARIM], _v: undefined },
            _v: td._v, degisenAlanlar: ["cekimIsleri"], alanSurumleri: td._alanSurumleri || {} },
  });
  t("sorun yokken bildirim gönderilmiyor", iyi.govde.kaydedilmeyenler === undefined,
    "her kayıtta uyarı çıkarsa kullanıcı uyarıya bakmayı bırakır");
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
