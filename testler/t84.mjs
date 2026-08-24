/* OPERASYON PANOSUNDA MARKA SÜZGECİ
 *
 * Pano on yedi markanın kartlarını birlikte gösteriyordu; tek bir markanın işini
 * takip etmek için gözle ayıklamak gerekiyordu. Süzgeç kategori sekmelerinin
 * yanına eklendi.
 *
 * ÜÇ KURAL BU TESTİN İŞİ:
 *
 * 1. SEÇİM KATEGORİ DEĞİŞİNCE KORUNUR. Bir markanın işini takip eden kişi
 *    Video'dan Fotoğraf'a geçerken süzgeci tekrar kurmak zorunda kalmamalı.
 *
 * 2. SEÇİCİDE YALNIZCA O KATEGORİDE KARTI OLAN MARKALAR olur. On yedi markalık
 *    bir listede on beşi boşsa süzgeç işe yaramaz.
 *
 * 3. SEÇİLİ MARKA, O KATEGORİDE KARTI OLMASA BİLE LİSTEDE KALIR. Yoksa seçim
 *    sessizce kaybolur ve kullanıcı "süzgeci ben mi kapattım" diye düşünür.
 *
 * Süzgeç bir GÖRÜNÜM aracı: marka kilidini ne gevşetir ne sıkar. Kilitli hesabın
 * `clients` listesi zaten yalnızca kendi markalarını içeriyor.
 */
import { readFileSync } from "node:fs";
import { trKucult } from "../lib/marka-kilidi.js";
import { panoSuzgeci } from "../lib/pano-suzgeci.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  try { fn(); }
  catch (e) { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } }
};

const cekim = readFileSync(new URL("../src/CekimEditTakibi.jsx", import.meta.url), "utf8");

/* GERÇEK KODUN KENDİSİ sınanıyor. İlk yazımda test, süzme mantığının bir
 * KOPYASINI taşıyordu; uygulama kodu bozulduğunda test bunu fark etmiyordu —
 * kırma ölçümünde "0 düştü" olarak görüldü. Mantık `lib/pano-suzgeci.js`'e
 * çıkarıldı ve hem arayüz hem test aynı koda bağlandı. */
const KATEGORILER = ["Video", "Fotoğraf", "Carousel", "Grafik Tasarım"];
const panoSuz = (isler, kategori, marka) => panoSuzgeci(isler, kategori, marka, KATEGORILER);

const ISLER = [
  { id: 1, marka: "Smell Coffee", kategori: "Video", asama: "Edit Yapılıyor" },
  { id: 2, marka: "Smell Coffee", kategori: "Video", asama: "Onaylandı" },
  { id: 3, marka: "İbo Burger", kategori: "Video", asama: "Onaylandı" },
  { id: 4, marka: "Smell Coffee", kategori: "Carousel", asama: "Düzenleniyor" },
  { id: 5, marka: "Violla", kategori: "Fotoğraf", asama: "Onaylandı" },
  { id: 6, marka: "  Smell Coffee  ", kategori: "Video", asama: "Onaylandı" },   // boşluklu yazım
  { id: 7, marka: "", kategori: "Video", asama: "Onaylandı" },                    // markasız kart
];

/* ---------------------------------------------------------------- */
bolum("1) SÜZME — yalnızca seçilen markanın kartları", 5, () => {
  const hepsi = panoSuz(ISLER, "Video", "");
  /* Video kartları: 1, 2, 3, 6 ve markasız 7 → beş. Markasız kart panoda görünür
   * (kart var, markası girilmemiş); yalnızca marka SEÇİCİSİNE girmez. */
  t("süzgeçsiz tüm kategori kartları", hepsi.panoIsleri.length === 5,
    "gelen: " + hepsi.panoIsleri.length);

  const smell = panoSuz(ISLER, "Video", "Smell Coffee");
  t("yalnızca o markanın kartları", smell.panoIsleri.every((j) => trKucult(j.marka) === "smell coffee"));
  t("baştaki/sondaki boşluk aynı marka sayılıyor", smell.panoIsleri.length === 3,
    "gelen: " + smell.panoIsleri.length + " — '  Smell Coffee  ' dışarıda kalmamalı");

  t("büyük/küçük harf farkı sorun değil",
    panoSuz(ISLER, "Video", "smell coffee").panoIsleri.length === 3);

  t("başka markanın kartı sızmıyor",
    !smell.panoIsleri.some((j) => trKucult(j.marka) === "i̇bo burger"));
});

/* ---------------------------------------------------------------- */
bolum("2) SEÇİM KATEGORİ DEĞİŞİNCE KORUNUYOR", 3, () => {
  const video = panoSuz(ISLER, "Video", "Smell Coffee");
  const carousel = panoSuz(ISLER, "Carousel", "Smell Coffee");
  t("Video'da 3 kart", video.panoIsleri.length === 3);
  t("Carousel'e geçince süzgeç hâlâ çalışıyor", carousel.panoIsleri.length === 1,
    "gelen: " + carousel.panoIsleri.length);
  t("Fotoğraf'ta bu markanın kartı yok — boş pano",
    panoSuz(ISLER, "Fotoğraf", "Smell Coffee").panoIsleri.length === 0);
});

/* ---------------------------------------------------------------- */
bolum("3) SEÇİCİ LİSTESİ", 5, () => {
  const video = panoSuz(ISLER, "Video", "");
  const adlar = video.panoMarkalari.map((x) => x.ad);
  t("yalnızca bu kategoride kartı olanlar",
    adlar.includes("Smell Coffee") && adlar.includes("İbo Burger") && !adlar.includes("Violla"),
    JSON.stringify(adlar));
  t("markasız kart listeye girmiyor", !adlar.includes(""));
  /* Boşluklu yazım AYRI bir marka sayılmıyor: `trim` ikisini aynı anahtarda
   * topluyor, dolayısıyla sayı 3. İlk yazımda 2 beklenmişti ve test kodu haksız
   * yere suçluyordu. */
  t("kart sayısı doğru ve boşluklu yazım aynı markaya toplanıyor",
    (video.panoMarkalari.find((x) => x.ad === "Smell Coffee") || {}).adet === 3,
    JSON.stringify(video.panoMarkalari));
  t("alfabetik sıralı (Türkçe)",
    adlar.join(",") === [...adlar].sort((a, b) => a.localeCompare(b, "tr")).join(","));

  /* ASIL KURAL: seçili marka bu kategoride kartı olmasa bile listede kalmalı. */
  const bos = panoSuz(ISLER, "Fotoğraf", "Smell Coffee");
  t("kartı olmayan seçili marka listede KALIYOR",
    bos.panoMarkalari.some((x) => x.ad === "Smell Coffee" && x.adet === 0),
    "listeden düşerse seçim sessizce kaybolur");
});

/* ---------------------------------------------------------------- */
bolum("4) ARAYÜZ BAĞLANTISI", 4, () => {
  /* Seçilen markanın süzgece GERÇEKTEN geçtiği sınanıyor. Çağrı duruyor ama
   * `panoMarka` yerine "" geçirilse süzgeç görüntüden ibaret kalırdı. */
  t("seçilen marka süzgece geçiriliyor",
    /panoSuzgeci\(isler, panoKategori, panoMarka, KATEGORILER\)/.test(cekim),
    "seçim panoyu süzmüyorsa süzgeç görüntüden ibaret kalır");
  /* Mesafe sınırı kırılgandı (kategori sekmeleri bloğu uzun); seçicinin pano
   * bloğunun İÇİNDE olduğu blok sınırlarıyla sınanıyor. */
  const panoBlok = (() => {
    const i = cekim.indexOf('{view === "pano" && (');
    return i >= 0 ? cekim.slice(i, cekim.indexOf("{adding &&", i)) : "";
  })();
  t("seçici yalnızca pano görünümünde",
    /setPanoMarka/.test(panoBlok) && panoBlok.length > 0,
    "pano bloğu bulunamadı ya da seçici dışında");
  t("süzgeci kaldırma yolu var", /süzgeci kaldır/.test(cekim),
    "aktif süzgeçten çıkış görünür olmalı");
  t("süzgeç aktifken seçici vurgulanıyor",
    /borderColor: panoMarka \? C\.accent/.test(cekim),
    "aktif süzgeç fark edilmezse 'kartlarım kayboldu' sanılır");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
