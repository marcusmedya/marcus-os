/* FOTOĞRAF TEK GÖRSEL — çoklu gönderi Carousel'in işi
 *
 * Carousel kategorisi gelmeden önce çoklu görsel Fotoğraf kartına yükleniyordu. İkisi
 * birden çoklu olunca "bu kaydırmalı gönderi mi, ayrı ayrı postlar mı" ayrımı kartta
 * kayboluyor; stok da yanlış türe yazılıyordu (Fotoğraf → Görsel, oysa kaydırmalı
 * gönderi → Carousel). Fotoğraf artık TEK görsellik.
 *
 * ÜÇ ŞEY BU TESTİN ASIL İŞİ:
 *
 * 1. STORY YUVASI KAPANMAMALI. Story ikinci bir görsel değil, aynı gönderinin story
 *    boyutu. Sınır ona uygulanırsa fotoğraf gönderisinin story versiyonu yüklenemez
 *    hale gelir — kimse fark etmeden bir yetenek kaybolur.
 *
 * 2. ESKİ ÇOK SLAYTLI FOTOĞRAF KARTLARI KAYBOLMAMALI. Kural gelmeden önce yüklenmiş
 *    kartlarda beş slayt olabilir. Sınır GÖRÜNTÜLEMEYE uygulanırsa o dosyalar ekrandan
 *    silinir; Drive'da durmaya devam ederler ama kimse bulamaz. Sınır yalnızca YENİ
 *    slayt açmayı engelliyor.
 *
 * 3. KURAL SUNUCUDA DA OLMALI. Yalnızca arayüzde olsaydı açık kalmış eski bir sekme
 *    ya da tekrar gönderilen bir istek ikinci slaydı yine de açardı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { readFileSync } from "node:fs";
import { enFazlaSlayt, slotKategoriyeUygunMu, bosSlot, guncelMedyalar, EN_FAZLA_SLAYT } from "../lib/asamalar.js";
const { default: veriUcu } = await import("../api/data.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };

/* ---------------------------------------------------------------- */
await bolum("1) SLAYT SINIRI — kategoriye göre", 5, () => {
  t("Fotoğraf tek slayt", enFazlaSlayt("Fotoğraf") === 1);
  t("Carousel tam sınır", enFazlaSlayt("Carousel") === EN_FAZLA_SLAYT);
  t("Video etkilenmedi", enFazlaSlayt("Video") === EN_FAZLA_SLAYT);
  t("Grafik Tasarım etkilenmedi", enFazlaSlayt("Grafik Tasarım") === EN_FAZLA_SLAYT);
  t("kategorisiz eski kayıt kısıtlanmıyor", enFazlaSlayt(undefined) === EN_FAZLA_SLAYT,
    "eski kartlar bu kural yokken açıldı, sessizce daraltılmamalı");
});

/* ---------------------------------------------------------------- */
await bolum("2) BOŞ SLOT — ikinci görsel için yer yok", 4, () => {
  const bosFoto = { kategori: "Fotoğraf", medya: [] };
  const doluFoto = { kategori: "Fotoğraf", medya: [{ slot: "1", versiyon: 1 }] };

  t("boş fotoğraf kartına ilk görsel eklenebiliyor", bosSlot(bosFoto) === "1");
  t("dolu fotoğraf kartına İKİNCİ görsel eklenemiyor", bosSlot(doluFoto) === null,
    "gelen: " + bosSlot(doluFoto));
  t("story dolu olsa da ilk görsel yeri duruyor",
    bosSlot({ kategori: "Fotoğraf", medya: [{ slot: "story", versiyon: 1 }] }) === "1");
  t("Carousel'de ikinci yuva açık",
    bosSlot({ kategori: "Carousel", medya: [{ slot: "1", versiyon: 1 }] }) === "2");
});

/* ---------------------------------------------------------------- */
await bolum("3) STORY — sınırın dışında", 3, () => {
  t("Fotoğraf kartına story yüklenebiliyor", slotKategoriyeUygunMu("story", "Fotoğraf") === true,
    "story ikinci görsel değil, aynı gönderinin story boyutu");
  t("Fotoğraf kartına 2. slayt yüklenemiyor", slotKategoriyeUygunMu("2", "Fotoğraf") === false);
  t("Fotoğraf kartına 1. slayt yüklenebiliyor", slotKategoriyeUygunMu("1", "Fotoğraf") === true);
});

/* ---------------------------------------------------------------- */
await bolum("4) ESKİ ÇOK SLAYTLI KARTLAR — hiçbir dosya kaybolmuyor", 3, () => {
  /* Kural gelmeden önce yüklenmiş fotoğraf kartı. */
  const eski = {
    kategori: "Fotoğraf",
    medya: [
      { slot: "1", versiyon: 1, ad: "a" }, { slot: "2", versiyon: 1, ad: "b" },
      { slot: "3", versiyon: 1, ad: "c" }, { slot: "story", versiyon: 1, ad: "s" },
    ],
  };
  const gorunen = guncelMedyalar(eski);
  t("dört dosyanın hepsi görünüyor", gorunen.length === 4, "gelen: " + gorunen.length);
  t("sıra bozulmadı, story sonda",
    gorunen.map((m) => m.slot).join(",") === "1,2,3,story");
  t("ama YENİ slayt açılamıyor", bosSlot(eski) === null,
    "sınır görüntülemeye değil, yeni yuva açmaya uygulanıyor");
});

/* ---------------------------------------------------------------- */
await bolum("5) SUNUCU — arayüz atlansa bile reddediyor", 4, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }],
    cekimIsleri: [
      { id: 5, marka: "Smell Coffee", kategori: "Fotoğraf", icerikTuru: "Ürün", asama: "Düzenleniyor", medya: [] },
      { id: 6, marka: "Smell Coffee", kategori: "Carousel", icerikTuru: "Menü", asama: "Düzenleniyor", medya: [] },
    ],
    subeler: [], haftalikPaylasimlar: [], stoklar: {}, _alanSurumleri: {},
  });

  const istek = (isId, slot) => cagir(veriUcu, {
    method: "POST", headers: OWNER,
    body: { driveAction: "yuklemeBasla", isId, slot, dosyaAdi: "x.jpg", mimeTur: "image/jpeg", boyut: 1000 },
  });

  const ikinciSlayt = await istek(5, "2");
  t("fotoğraf kartına 2. slayt REDDEDİLİYOR", ikinciSlayt.kod === 400, "gelen: " + ikinciSlayt.kod);
  t("sebep kullanıcıya anlatılıyor",
    /tek görsel/i.test(ikinciSlayt.govde.error || "") && /Carousel/.test(ikinciSlayt.govde.error || ""),
    "gelen: " + ikinciSlayt.govde.error);

  /* Geçerli slotlar bu kontrolde takılmamalı — takılırsa yükleme tamamen ölür.
   * Drive kurulu olmadığı için yanıt yine 400 ama SEBEBİ farklı olmalı. */
  const story = await istek(5, "story");
  t("story bu kontrole TAKILMIYOR", !/tek görsel/i.test(story.govde.error || ""),
    "gelen: " + story.govde.error);
  const carousel = await istek(6, "5");
  t("Carousel'in 5. slaydı takılmıyor", !/tek görsel/i.test(carousel.govde.error || ""),
    "gelen: " + carousel.govde.error);
});

/* ---------------------------------------------------------------- */
await bolum("6) ARAYÜZ — çoklu seçim tek slaytlık kartta kapalı", 3, () => {
  const cekim = readFileSync(new URL("../src/CekimEditTakibi.jsx", import.meta.url), "utf8");

  t("dosya seçici sınıra bakıyor",
    /girdiRef\.current\.multiple = !slot && slaytSiniri > 1/.test(cekim),
    "açık kalırsa kullanıcı sekiz dosya seçip biri yüklenince şaşırır");
  t("yükleme döngüsü sınıra bakıyor",
    /for \(let n = 1; n <= slaytSiniri; n \+= 1\)/.test(cekim),
    "sabit sınırla dönerse Fotoğraf kartı yine 10 slayt açar");
  t("'ayrı parçaya taşı' tek slaytlık kartta kapalı",
    /parcaYapilabilir = bosSlotVar && slaytSiniri > 1/.test(cekim),
    "gidecek ikinci yuva yokken düğme anlamsız");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
