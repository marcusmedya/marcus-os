/* EŞZAMANLILIK HARİTASINDAKİ DÖRT BULGU
 *
 * Bu dosya, "Aynı anda çalışırken ne kayboluyor" incelemesinde ölçülen dört sorunu
 * ve düzeltmelerini sınar. Senaryolar rapordakiyle AYNI — düzeltmeden önce üretilmiş,
 * şimdi üretilememeleri gerekiyor.
 *
 * 1. Marka kilitli hesap var olan bir kaydın numarasını üretiyordu → aynı numaradan iki kayıt.
 * 2. Aynı anda kart açan ikinci kişinin kartı, çakışma tazelemesinde sessizce siliniyordu.
 * 3. Hiçbir alan değişmediğinde kayıt yine gidiyor ve ON BİR sayacı birden artırıyordu.
 * 4. Yalnızca ekran için üretilen listeler kalıcı belgeye yazılıyordu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "3";

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kimlikCakismalariniOnar, belgedekiCakismalariOnar, yeniKayitlariKoru,
         turetilmisleriAyikla, numarali, TURETILMIS_ALANLAR } from "../lib/kimlik.js";

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
  _v: 10, _alanSurumleri: { cekimIsleri: 4, clients: 2, stoklar: 1 },
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "BINPARK" }],
  cekimIsleri: [
    { id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "A", asama: "Edit Bekliyor" },
    { id: 2, marka: "BINPARK", kategori: "Video", icerikTuru: "B", asama: "Edit Bekliyor" },
    { id: 3, marka: "BINPARK", kategori: "Video", icerikTuru: "C", asama: "Edit Bekliyor" },
  ],
  stoklar: {}, musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [], gelirKalemleri: [],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "ortak", sifreHash: hash("1234", salt),
    sifreSalt: salt, izinler: { cekimEdit: true }, markalar: ["VIZZ"] }],
  musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const GET = (h) => cagir(veriUcu, { method: "GET", headers: h, query: {} }).then((r) => r.govde.data);
const KAYDET = (h, d, alanlar) => cagir(veriUcu, { method: "POST", headers: h, query: {},
  body: { data: { ...d, _v: undefined }, _v: d._v,
          ...(alanlar ? { degisenAlanlar: alanlar, alanSurumleri: d._alanSurumleri || {} } : {}) } });

/* ---------------------------------------------------------------- */
console.log("\n1) NUMARA ÇAKIŞMASI — hesap katmanı");

t("çakışan numara onarılıyor",
  kimlikCakismalariniOnar([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }, { id: 2 }]).onarilanlar.length === 1);
t("İLK gelen numarasını koruyor",
  kimlikCakismalariniOnar([{ id: 2 }], [{ id: 2, ad: "eski" }, { id: 2, ad: "yeni" }]).liste[0].ad === "eski",
  "var olan kaydın kimliği değişmemeli");
t("yeni numara İKİ listenin birden üstünden veriliyor",
  kimlikCakismalariniOnar([{ id: 9 }], [{ id: 1 }, { id: 1 }]).liste[1].id === 10,
  "yalnız gelen listeye bakılsaydı 2 verilir ve başka çakışma üretilirdi");
t("çakışma yoksa liste AYNI referansla dönüyor",
  (() => { const l = [{ id: 1 }, { id: 2 }]; return kimlikCakismalariniOnar([], l).liste === l; })(),
  "gereksiz yazma ve sürüm artışı olmasın");
t("numarasız dizilere dokunulmuyor",
  numarali(["a", "b"]) === false && kimlikCakismalariniOnar([], ["a", "b"]).liste.length === 2);
t("boş dizi sorun çıkarmıyor", kimlikCakismalariniOnar([], []).onarilanlar.length === 0);
t("belge düzeyinde tüm alanlar taranıyor",
  belgedekiCakismalariOnar(
    { cekimIsleri: [{ id: 1 }], clients: [{ id: 1 }] },
    { cekimIsleri: [{ id: 1 }, { id: 1 }], clients: [{ id: 1 }, { id: 1 }] },
  ).onarilanlar.length === 2, "alan listesi elle sayılmıyor");

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — çözüm ortağı eksik liste üzerinden numara üretiyor");

await sifirla();
{
  const ortak = await GET(ORTAK);
  const gorunen = ortak.cekimIsleri.map((j) => j.id);
  const uretilen = Math.max(...gorunen) + 1;      // tarayıcının nextId'si tam olarak bu
  t("çözüm ortağı eksik liste görüyor", gorunen.length === 1 && uretilen === 2,
    "gördüğü: " + JSON.stringify(gorunen));

  const y = await KAYDET(ORTAK, { ...ortak, cekimIsleri: [...ortak.cekimIsleri,
    { id: uretilen, marka: "VIZZ", kategori: "Tasarım", icerikTuru: "YENİ", asama: "Çekim Planlandı" }] },
    ["cekimIsleri"]);
  const son = await kv.get(KEY);
  const sayim = {};
  son.cekimIsleri.forEach((j) => { sayim[j.id] = (sayim[j.id] || 0) + 1; });
  const cift = Object.entries(sayim).filter(([, n]) => n > 1);

  t("kayıt geçiyor", y.kod === 200, "gelen: " + y.kod);
  t("AYNI NUMARADAN İKİ KAYIT YOK", cift.length === 0,
    cift.length ? cift.map(([id, n]) => `id ${id} × ${n}`).join(", ") : "temiz");
  t("yeni kart yazıldı", son.cekimIsleri.some((j) => j.icerikTuru === "YENİ"));
  t("var olan kartların numarası değişmedi",
    [1, 2, 3].every((id) => son.cekimIsleri.some((j) => j.id === id && j.icerikTuru !== "YENİ")),
    "eski kayıtların kimliği sabit kalmalı");
  t("onarım tarayıcıya BİLDİRİLİYOR", Array.isArray(y.govde.kimlikOnarildi) && y.govde.kimlikOnarildi.length === 1,
    "bildirilmezse tarayıcı eski numarayla çalışmaya devam eder");
  t("hangi alanda olduğu belli", y.govde.kimlikOnarildi[0].alan === "cekimIsleri");
}

/* ---------------------------------------------------------------- */
console.log("\n3) YENİ KAYIT ÇAKIŞMA TAZELEMESİNDE KAYBOLMUYOR");

t("sunucuda olmayan yeni kayıt korunuyor",
  yeniKayitlariKoru([{ id: 1 }], [{ id: 1 }, { id: 5, ad: "BENİM" }], [{ id: 1 }])
    .some((x) => x.ad === "BENİM"));
t("numarası kapılmışsa YENİ numarayla korunuyor",
  (() => {
    const r = yeniKayitlariKoru([{ id: 1 }, { id: 4, ad: "A" }], [{ id: 1 }, { id: 4, ad: "B" }], [{ id: 1 }]);
    return r.length === 3 && r.some((x) => x.ad === "B" && x.id !== 4);
  })(), "iki kişi aynı numarayı aldığında ikincisi kaybolmasın");
t("BAŞKASININ SİLDİĞİ kayıt diriltilmiyor",
  yeniKayitlariKoru([{ id: 1 }], [{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }]).length === 1,
  "tabanda vardı, sunucuda yok → silinmiş demektir");
t("zaten yazılmış kayıt kopyalanmıyor",
  yeniKayitlariKoru([{ id: 1 }, { id: 4, ad: "X" }], [{ id: 1 }, { id: 4, ad: "X" }], [{ id: 1 }]).length === 2);
t("korunacak bir şey yoksa sunucu listesi AYNI referansla dönüyor",
  (() => { const su = [{ id: 1 }]; return yeniKayitlariKoru(su, [{ id: 1 }], [{ id: 1 }]) === su; })());
t("numarasız listelerde eski davranış",
  yeniKayitlariKoru(["a"], ["a", "b"], []).length === 1, "belirsizse sunucu kazanır");

/* ---------------------------------------------------------------- */
console.log("\n4) BOŞ KAYIT TÜM SAYAÇLARI ARTIRMIYOR");

await sifirla();
{
  /* Tarayıcı artık böyle bir istek göndermiyor; sunucu yine de dayanıklı olmalı:
   * alan bildiren bir kayıt YALNIZCA o alanın sayacını artırsın. */
  const d = await GET(OWNER);
  const once = { ...(await kv.get(KEY))._alanSurumleri };
  await KAYDET(OWNER, { ...d, cekimIsleri: d.cekimIsleri.map((j) => ({ ...j, brief: "x" })) }, ["cekimIsleri"]);
  const sonra = (await kv.get(KEY))._alanSurumleri;
  const artan = Object.keys(sonra).filter((a) => (sonra[a] || 0) !== (once[a] || 0));
  t("yalnızca dokunulan alanın sayacı arttı", artan.length === 1 && artan[0] === "cekimIsleri",
    "artan: " + artan.join(", "));
}

/* ---------------------------------------------------------------- */
console.log("\n5) TÜRETİLMİŞ ALANLAR KALICI BELGEYE YAZILMIYOR");

t("ayıklama listesi tanımlı", TURETILMIS_ALANLAR.includes("personelRosteri") && TURETILMIS_ALANLAR.includes("musteriRosteri"));
t("alanlar gövdeden çıkarılıyor",
  turetilmisleriAyikla({ a: 1, personelRosteri: [], musteriRosteri: [] }).personelRosteri === undefined);
t("diğer alanlara dokunulmuyor", turetilmisleriAyikla({ a: 1, personelRosteri: [] }).a === 1);
t("yoksa AYNI referans dönüyor",
  (() => { const o = { a: 1 }; return turetilmisleriAyikla(o) === o; })());

await sifirla();
{
  const d = await GET(OWNER);
  t("yönetici GET'inde personelRosteri var (ekran için gerekli)", "personelRosteri" in d);
  /* ALAN BİLDİRMEYEN kayıt — kirlenme tam olarak bu yoldan oluyordu. Alan bazlı kayıtta
   * gövde sunucudaki belgeden kuruluyor ve türetilmiş alanlar zaten giremiyor; bu yüzden
   * korumayı ancak bu yol sınayabilir. */
  await KAYDET(OWNER, { ...d, cekimIsleri: d.cekimIsleri.map((j) => ({ ...j, brief: "y" })) }, null);
  const son = await kv.get(KEY);
  t("VERİTABANINDA personelRosteri yok", son.personelRosteri === undefined,
    "kalıcı belgeye girmemeli — bayat kopya + gereksiz şişme");
  t("VERİTABANINDA musteriRosteri yok", son.musteriRosteri === undefined);
  t("sayaçlar arasında da yer tutmuyor",
    !("personelRosteri" in (son._alanSurumleri || {})) && !("musteriRosteri" in (son._alanSurumleri || {})));
  t("gerçek veri yerinde", son.cekimIsleri.length === 3 && (son.personelHesaplari || []).length === 1);
  t("düzenleme gerçekten yazıldı", son.cekimIsleri.every((j) => j.brief === "y"),
    "kayıt geçmediyse yukarıdaki kontroller bir şey ispat etmez");
}

/* ---------------------------------------------------------------- */
console.log("\n6) DÜZELTMELER BİRBİRİNİ BOZMUYOR");

await sifirla();
{
  const a = await GET(OWNER);
  const b = await GET(OWNER);
  const aY = await KAYDET(OWNER, { ...a, cekimIsleri: [...a.cekimIsleri,
    { id: 4, marka: "VIZZ", kategori: "Video", icerikTuru: "A-YENİ", asama: "Çekim Planlandı" }] }, ["cekimIsleri"]);
  const bY = await KAYDET(OWNER, { ...b, cekimIsleri: [...b.cekimIsleri,
    { id: 4, marka: "VIZZ", kategori: "Video", icerikTuru: "B-YENİ", asama: "Çekim Planlandı" }] }, ["cekimIsleri"]);
  t("A geçiyor, B çakışma alıyor", aY.kod === 200 && bY.kod === 409,
    `A=${aY.kod} B=${bY.kod} — çakışma koruması hâlâ çalışıyor`);

  /* B'nin tarayıcısı ne yapacak: tazelemede kendi kartını koruyup yeni numarayla saklıyor. */
  const sunucu = (await kv.get(KEY)).cekimIsleri;
  const birlesik = yeniKayitlariKoru(sunucu, [...b.cekimIsleri,
    { id: 4, marka: "VIZZ", kategori: "Video", icerikTuru: "B-YENİ", asama: "Çekim Planlandı" }], b.cekimIsleri);
  t("B'nin kartı ekranda KALIYOR", birlesik.some((j) => j.icerikTuru === "B-YENİ"),
    "eski davranışta bu kart sessizce siliniyordu");
  t("A'nın kartı da duruyor", birlesik.some((j) => j.icerikTuru === "A-YENİ"));
  t("iki kart farklı numarada",
    birlesik.find((j) => j.icerikTuru === "A-YENİ").id !== birlesik.find((j) => j.icerikTuru === "B-YENİ").id);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
