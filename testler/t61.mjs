/* OPERASYON YETKİSİ OLAN PERSONEL KARTI İŞLEYEMİYORDU
 *
 * ŞİKÂYET: "İbrahim personelim ve yetkisinde Operasyon olmasına rağmen kartı ileri
 * aktaramıyor, işi oluşturamıyor ve görsel ya da video yükleyemiyor."
 *
 * SEBEP: kartı kimin işleyebileceğine karar veren kapı Operasyon yetkisine HİÇ BAKMIYORDU.
 * Personel bir kartı ancak o kartın "Sorumlu Kameraman" ya da "Sorumlu Editör" alanında
 * ADI YAZIYORSA işleyebiliyordu. Üç belirtinin üçü de bu tek kapıdan geliyordu:
 *
 *   - aşama düğmeleri hiç çizilmiyor        → kart ileri aktarılamıyor
 *   - medya yükleyici kapalı geliyor        → görsel/video yüklenemiyor
 *   - yeni iş formunda atama BOŞ başlıyor   → kartı oluşturan kişi kendi kartında kilitli
 *     kalıyor, dışarıdan "oluşturamıyor" gibi görünüyor
 *
 * Ayrıca eşleşme serbest metin üzerinde birebir karşılaştırmaydı: hesap adı "İbrahim",
 * kartta "İbrahim Gümüş" yazıyorsa hiçbir zaman tutmuyordu.
 *
 * YENİ KURAL: Operasyon yetkisi olan personel gördüğü her kartı işler.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "3";

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kartiIsleyebilirMi } from "../lib/is-yetkisi.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const salt = "s1";
const IBRAHIM = { "x-staff-username-b64": b64("ibog"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const YETKISIZ = { "x-staff-username-b64": b64("baska"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { cekimIsleri: 2 },
  clients: [{ id: 1, ad: "VIZZ" }],
  /* Kartlar BAŞKASINA atanmış — eski kuralda İbrahim hiçbirine dokunamıyordu. */
  cekimIsleri: [
    { id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels", asama: "Edit Bekliyor",
      kameraman: "Mehmet", editor: "Ayşe" },
    { id: 2, marka: "VIZZ", kategori: "Tasarım", icerikTuru: "Logo", asama: "Çekim Planlandı",
      kameraman: "", editor: "" },
  ],
  stoklar: {}, musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [], gelirKalemleri: [],
  personelHesaplari: [
    { id: "p1", ad: "İbrahim", kullaniciAdi: "ibog", sifreHash: hash("1234", salt), sifreSalt: salt,
      izinler: { cekimEdit: true, paylasimlar: true, reklamlar: true }, markalar: [] },
    { id: "p2", ad: "Başka", kullaniciAdi: "baska", sifreHash: hash("1234", salt), sifreSalt: salt,
      izinler: { cekimEdit: false, paylasimlar: true }, markalar: [] },
  ],
  musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const GET = (h) => cagir(veriUcu, { method: "GET", headers: h, query: {} }).then((r) => r.govde.data);
const KAYDET = (h, d, alanlar) => cagir(veriUcu, { method: "POST", headers: h, query: {},
  body: { data: { ...d, _v: undefined }, _v: d._v,
          ...(alanlar ? { degisenAlanlar: alanlar, alanSurumleri: d._alanSurumleri || {} } : {}) } });

/* ---------------------------------------------------------------- */
console.log("\n1) KURAL — yetkiye bakıyor, atamaya değil");

t("Operasyon yetkisi olan personel işleyebiliyor", kartiIsleyebilirMi("staff", true) === true);
t("yetkisi olmayan işleyemiyor", kartiIsleyebilirMi("staff", false) === false);
t("yönetici her zaman işleyebiliyor", kartiIsleyebilirMi("owner", false) === true,
  "yöneticinin yetki kutucuğu yok, hepsi zaten açık");
t("yetki bildirilmemişse işleyemiyor", kartiIsleyebilirMi("staff", undefined) === false,
  "belirsizse kapalı taraf");
t("yetki 'doğru gibi' değerlerle açılmıyor", kartiIsleyebilirMi("staff", "evet") === false
  && kartiIsleyebilirMi("staff", 1) === false, "yalnızca gerçek true kabul ediliyor");
/* ASIL KURAL BU: karar YALNIZCA yetkiye bağlı. Fazladan argüman verilse bile
 * (eski imza kart ve isim alıyordu) sonuç değişmemeli. */
t("başkasına atanmış kartta bile yetki yetiyor",
  kartiIsleyebilirMi("staff", true, { kameraman: "Bambaşka", editor: "Bambaşka" }, "İbrahim") === true,
  "eski kuralda burada kilitleniyordu");
t("atanmış olmak yetkinin yerine GEÇMİYOR",
  kartiIsleyebilirMi("staff", false, { kameraman: "İbrahim", editor: "İbrahim" }, "İbrahim") === false,
  "yetki yoksa atama tek başına yetmez");
t("boş atama kararı etkilemiyor",
  kartiIsleyebilirMi("staff", true, { kameraman: "", editor: "" }, "İbrahim") === true,
  "yeni iş formu atamayı boş başlatıyor — oluşturan kişi kilitli kalmasın");
t("isim yazılmamışsa da çalışıyor",
  kartiIsleyebilirMi("staff", true, { kameraman: "Mehmet" }, "") === true,
  "ad-soyad farkları artık kararı bozmuyor");

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — İbrahim başkasına atanmış kartı ilerletiyor");

await sifirla();
{
  const d = await GET(IBRAHIM);
  const kart = (d.cekimIsleri || []).find((j) => j.id === 1);
  t("İbrahim kartı görüyor", Boolean(kart));
  t("kart BAŞKASINA atanmış", kart.kameraman === "Mehmet" && kart.editor === "Ayşe",
    "eski kuralda tam da bu yüzden dokunamıyordu");

  const y = await KAYDET(IBRAHIM, { ...d,
    cekimIsleri: d.cekimIsleri.map((j) => (j.id === 1 ? { ...j, asama: "Edit Yapılıyor" } : j)) },
    ["cekimIsleri"]);
  const son = await kv.get(KEY);
  t("aşama değişikliği kaydediliyor", y.kod === 200, "gelen: " + y.kod);
  t("kart gerçekten ilerledi", son.cekimIsleri.find((j) => j.id === 1).asama === "Edit Yapılıyor",
    "gelen: " + son.cekimIsleri.find((j) => j.id === 1).asama);
  t("atama bilgisi korundu", son.cekimIsleri.find((j) => j.id === 1).kameraman === "Mehmet",
    "kimin sorumlu olduğu hâlâ kayıtlı — sadece kararı belirlemiyor");
}

/* ---------------------------------------------------------------- */
console.log("\n3) OLUŞTURDUĞU KARTTA KİLİTLİ KALMIYOR");

await sifirla();
{
  const d = await GET(IBRAHIM);
  const yeni = { id: 3, marka: "VIZZ", kategori: "Tasarım", icerikTuru: "Banner",
                 asama: "Çekim Planlandı", kameraman: "", editor: "" };   // form böyle başlıyor
  const y1 = await KAYDET(IBRAHIM, { ...d, cekimIsleri: [...d.cekimIsleri, yeni] }, ["cekimIsleri"]);
  t("kartı oluşturabiliyor", y1.kod === 200, "gelen: " + y1.kod);

  const d2 = await GET(IBRAHIM);
  const y2 = await KAYDET(IBRAHIM, { ...d2,
    cekimIsleri: d2.cekimIsleri.map((j) => (j.id === 3 ? { ...j, asama: "Çekim Yapıldı" } : j)) },
    ["cekimIsleri"]);
  const son = await kv.get(KEY);
  t("ATAMA BOŞ olsa da kendi kartını ilerletebiliyor", y2.kod === 200 &&
    son.cekimIsleri.find((j) => j.id === 3).asama === "Çekim Yapıldı",
    "eski kuralda oluşturan kişi kendi kartında kilitli kalıyordu");
}

/* ---------------------------------------------------------------- */
console.log("\n4) YETKİSİ OLMAYAN HÂLÂ YAZAMIYOR — kural gevşetilmedi");

await sifirla();
{
  const d = await GET(YETKISIZ);
  t("Operasyon yetkisi olmayan kartları hiç GÖRMÜYOR", d.cekimIsleri === undefined,
    "gelen: " + JSON.stringify(d.cekimIsleri));

  /* Yine de elle göndermeyi denesin — sunucu reddetmeli. */
  const y = await KAYDET(YETKISIZ, { ...d, cekimIsleri: [
    { id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "ELE GEÇİRİLDİ", asama: "Onaylandı" }] },
    ["cekimIsleri"]);
  const son = await kv.get(KEY);
  t("yetkisiz yazma sunucuda engelleniyor",
    son.cekimIsleri.length === 2 && !son.cekimIsleri.some((j) => j.icerikTuru === "ELE GEÇİRİLDİ"),
    "asıl güvenlik sınırı burası — arayüzdeki kapı değil");
  t("var olan kartlar bozulmadı", son.cekimIsleri[0].icerikTuru === "Reels",
    "yanıt: " + y.kod);
}

/* ---------------------------------------------------------------- */
console.log("\n5) MARKA KİLİDİ BU KURALDAN ETKİLENMİYOR");

await sifirla();
{
  await kv.set(KEY, {
    ...(await kv.get(KEY)),
    clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "BINPARK" }],
    cekimIsleri: [
      { id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "A", asama: "Edit Bekliyor" },
      { id: 2, marka: "BINPARK", kategori: "Video", icerikTuru: "GİZLİ", asama: "Edit Bekliyor" },
    ],
    personelHesaplari: [{ id: "p1", ad: "İbrahim", kullaniciAdi: "ibog",
      sifreHash: hash("1234", salt), sifreSalt: salt,
      izinler: { cekimEdit: true }, markalar: ["VIZZ"] }],   // marka kilitli
  });
  const d = await GET(IBRAHIM);
  t("kilitli hesap yalnızca kendi markasını görüyor",
    d.cekimIsleri.length === 1 && d.cekimIsleri[0].marka === "VIZZ",
    "gördüğü: " + JSON.stringify(d.cekimIsleri.map((j) => j.marka)));
  t("başka markanın kartı sızmıyor", !JSON.stringify(d).includes("GİZLİ"));

  const y = await KAYDET(IBRAHIM, { ...d,
    cekimIsleri: d.cekimIsleri.map((j) => ({ ...j, asama: "Edit Yapılıyor" })) }, ["cekimIsleri"]);
  const son = await kv.get(KEY);
  t("kendi markasının kartını ilerletebiliyor", y.kod === 200 &&
    son.cekimIsleri.find((j) => j.id === 1).asama === "Edit Yapılıyor");
  t("başka markanın kartı yerinde duruyor",
    son.cekimIsleri.find((j) => j.id === 2).asama === "Edit Bekliyor",
    "kural marka sınırını genişletmiyor");
}

/* ---------------------------------------------------------------- */
console.log("\n6) BAĞLANTI YERİNDE Mİ");

/* Kural doğru olsa da arayüz onu yanlış çağırırsa hata sürer. React'i burada
 * çizemediğimiz için bağlantı kaynaktan doğrulanıyor — kural testinin yerine değil,
 * yanına. */
const { readFileSync } = await import("fs");
const oku = (yol) => readFileSync(new URL(yol, import.meta.url), "utf8");
const takip = oku("../src/CekimEditTakibi.jsx");
const app = oku("../src/App.jsx");

t("arayüz kuralı tek kaynaktan çağırıyor",
  takip.includes('from "../lib/is-yetkisi.js"') && takip.includes("kartiIsleyebilirMi(role, islemYetkisi)"),
  "kuralın kopyası kalmasın");
t("eski atama karşılaştırması kaldırıldı",
  !/job\.kameraman[^\n]*toLocaleLowerCase/.test(takip),
  "kalırsa iki kural birden çalışır");
t("App Operasyon iznini geçiriyor",
  app.includes("islemYetkisi={izinler.cekimEdit === true}"),
  "geçirilmezse personel varsayılana düşer");
t("medya yükleyici de aynı kapıdan geçiyor",
  takip.includes("duzenlenebilir={duzenleyebilirMi(job, role, islemYetkisi)}"),
  "görsel/video yükleme şikâyetin bir parçasıydı");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
