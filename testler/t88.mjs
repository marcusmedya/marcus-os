/* ÜÇ KATEGORİ — REELS · POST · CAROUSEL
 *
 * Kategoriler dörtten üçe, stok türleri altıdan üçe indi. ESKİ KAYITLARA DOKUNULMADI:
 * belgede hâlâ "Video", "Fotoğraf", "Grafik Tasarım" kategorili ve `1_Görsel`,
 * `1_Story`, `1_Tasarım` anahtarlı yüzlerce kayıt var.
 *
 * BU TESTİN ASIL İŞİ ÜÇ KAYIP RİSKİ:
 *   1. Eski kategorili kart HİÇBİR SEKMEDE görünmeyebilir — pano kategoriye göre süzüyor.
 *   2. Süren iş AKIŞIN BAŞINA düşebilir — aşama yeni listede yoksa onarım başa çeker.
 *   3. Eski stok anahtarları SIFIR görünebilir — türler değişti, anahtarlar değişmedi.
 */
import { KATEGORILER, kategoriEsle, turEsle } from "../lib/kategori.js";
import { asamaListesi, ILK_ASAMA, asamalariDuzelt, yapiliyorAsamasi, enFazlaSlayt } from "../lib/asamalar.js";
import { paylasimTuru, PAYLASIM_TURLERI, stoklariBirlestir, eskiTurAnahtarlari, onaylananlaraGoreStok } from "../lib/stok.js";
import { panoSuzgeci } from "../lib/pano-suzgeci.js";
import { stokMutabakati } from "../lib/stok-mutabakat.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  try { fn(); } catch (e) { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } }
};

/* ---------------------------------------------------------------- */
bolum("1) LİSTE — tam olarak üç", 3, () => {
  t("kategoriler üç", KATEGORILER.join(",") === "Reels,Post,Carousel", KATEGORILER.join(","));
  t("stok türleri kategorilerle AYNI", PAYLASIM_TURLERI.join(",") === KATEGORILER.join(","),
    PAYLASIM_TURLERI.join(",") + " — iki liste ayrışırsa stok satırı olmayan kategori doğar");
  t("Tasarım ve Story artık yok",
    !PAYLASIM_TURLERI.includes("Tasarım") && !PAYLASIM_TURLERI.includes("Story"));
});

/* ---------------------------------------------------------------- */
bolum("2) ESKİ KARTLAR PANODA GÖRÜNÜYOR", 5, () => {
  const isler = [
    { id: 1, marka: "A", kategori: "Video", asama: "Edit Bekliyor" },
    { id: 2, marka: "A", kategori: "Fotoğraf", asama: "Düzenleniyor" },
    { id: 3, marka: "A", kategori: "Grafik Tasarım", asama: "Kontrol Bekliyor" },
    { id: 4, marka: "A", kategori: "Carousel", asama: "Onaylandı" },
    { id: 5, marka: "A", asama: "Çekim Planlandı" },                    // kategorisiz eski kayıt
  ];
  const reels = panoSuzgeci(isler, "Reels", "", KATEGORILER);
  const post = panoSuzgeci(isler, "Post", "", KATEGORILER);
  const carousel = panoSuzgeci(isler, "Carousel", "", KATEGORILER);

  t("eski Video kartı REELS sekmesinde", reels.panoIsleri.some((j) => j.id === 1),
    JSON.stringify(reels.panoIsleri.map((j) => j.id)));
  t("eski Fotoğraf kartı POST sekmesinde", post.panoIsleri.some((j) => j.id === 2));
  t("eski Grafik Tasarım kartı POST sekmesinde", post.panoIsleri.some((j) => j.id === 3),
    "kaybolursa aylardır süren tasarım işi hiçbir sekmede görünmez");
  t("Carousel yerinde", carousel.panoIsleri.some((j) => j.id === 4));
  t("KATEGORİSİZ eski kayıt da bir sekmede", reels.panoIsleri.some((j) => j.id === 5),
    JSON.stringify(reels.panoIsleri.map((j) => j.id)) + " — video döneminden kalma kartlar");
});

/* ---------------------------------------------------------------- */
bolum("3) SÜREN İŞ BAŞA DÖNMÜYOR", 5, () => {
  const kartlar = [
    { id: 1, kategori: "Grafik Tasarım", asama: "Tasarım Yapılıyor" },
    { id: 2, kategori: "Grafik Tasarım", asama: "Onaylandı" },
    { id: 3, kategori: "Grafik Tasarım", asama: "Kontrol Bekliyor" },
    { id: 4, kategori: "Video", asama: "Edit Bekliyor" },
    { id: 5, kategori: "Video", asama: "Talep Alındı" },
  ];
  const d = asamalariDuzelt(kartlar);
  const bul = (id) => d.find((x) => x.id === id).asama;

  t("çalışılan tasarım işi DÜZENLENİYOR'a taşındı", bul(1) === "Düzenleniyor", bul(1));
  t("ONAYLI tasarım işi onaylı KALDI", bul(2) === "Onaylandı", bul(2) + " — başa düşseydi stok da kayardı");
  t("kontrol bekleyen tasarım işi yerinde", bul(3) === "Kontrol Bekliyor", bul(3));
  t("eski Video kartının aşaması bozulmadı", bul(4) === "Edit Bekliyor", bul(4));
  t("YAPILMAMIŞ çekim yapılmış sayılmıyor", bul(5) === ILK_ASAMA("Reels") && bul(5) === "Çekim Planlandı",
    bul(5) + " — 'Talep Alındı' bir süre 'Çekim Yapıldı'ya eşleniyordu");
});

/* ---------------------------------------------------------------- */
bolum("4) ESKİ STOK ANAHTARLARI SIFIR GÖRÜNMÜYOR", 5, () => {
  const eski = {
    "1_Görsel": 2, "1_Story": 1, "1_Tasarım": 1, "1_Video": 3, "1_Carousel": 1,
    "1_9_Görsel": 4, "1_9_Video": 2, "2_Post": 5,
  };
  const yeni = stoklariBirlestir(eski);

  t("Görsel + Story + Tasarım → POST", yeni["1_Post"] === 4, JSON.stringify(yeni));
  t("Video → REELS", yeni["1_Reels"] === 3, JSON.stringify(yeni));
  t("Carousel olduğu gibi", yeni["1_Carousel"] === 1);
  t("ŞUBE anahtarları da toplanıyor", yeni["1_9_Post"] === 4 && yeni["1_9_Reels"] === 2,
    JSON.stringify(yeni) + " — şube satırları toplanmazsa çok şubeli markalar sıfır görür");
  t("eski anahtarlar temizlenecek listede",
    eskiTurAnahtarlari(eski, 1).sort().join(",") === "1_9_Görsel,1_9_Video,1_Görsel,1_Story,1_Tasarım,1_Video",
    eskiTurAnahtarlari(eski, 1).join(","));
});

/* ---------------------------------------------------------------- */
bolum("5) STOK MOTORU — eski kartlar doğru satıra yazıyor", 4, () => {
  const client = [{ id: 1, ad: "A" }];
  const gecis = (kart) => onaylananlaraGoreStok(
    [{ ...kart, asama: "Kontrol Bekliyor" }], [{ ...kart, asama: "Onaylandı" }], {}, client);

  t("eski Video kartı → 1_Reels",
    gecis({ id: 1, marka: "A", kategori: "Video", icerikTuru: "Q PREMIUM" }).stoklar["1_Reels"] === 1);
  t("eski Fotoğraf kartı → 1_Post",
    gecis({ id: 1, marka: "A", kategori: "Fotoğraf", icerikTuru: "Ürün" }).stoklar["1_Post"] === 1);
  t("eski Grafik Tasarım kartı → 1_Post",
    gecis({ id: 1, marka: "A", kategori: "Grafik Tasarım", icerikTuru: "Logo" }).stoklar["1_Post"] === 1);
  t("Carousel → 1_Carousel",
    gecis({ id: 1, marka: "A", kategori: "Carousel", icerikTuru: "Bowl" }).stoklar["1_Carousel"] === 1);
});

/* ---------------------------------------------------------------- */
bolum("6) AKIŞ VE SLAYT SINIRI", 4, () => {
  t("eski Video kartı REELS akışını kullanıyor", asamaListesi("Video")[0] === "Çekim Planlandı");
  t("eski tasarım kartı POST akışını kullanıyor",
    asamaListesi("Grafik Tasarım").join(",") === asamaListesi("Post").join(","));
  t("çalışma aşaması eşleniyor",
    yapiliyorAsamasi("Grafik Tasarım") === "Düzenleniyor" && yapiliyorAsamasi("Video") === "Edit Yapılıyor");
  t("Post tek görsellik, Carousel çoklu",
    enFazlaSlayt("Post") === 1 && enFazlaSlayt("Fotoğraf") === 1 && enFazlaSlayt("Carousel") > 1);
});

/* ---------------------------------------------------------------- */
bolum("7) SAHTE SAPMA — eski anahtarlı marka 'uyuşmuyor' görünmesin", 4, () => {
  /* SAHADAN GELEN HÂL (Violla): kartta "Post 5" yazıyor ama mutabakat "Post: 0 kayıtlı"
   * diyordu. Sebep, toplamanın YALNIZCA EKRANDA yapılması, karşılaştırmada
   * yapılmamasıydı: sunucu ham `Violla_Görsel: 5` anahtarını görüyor, yeni türde `Post`
   * arıyor, bulamıyor ve sıfır sayıyordu. Bütün markalar sapmalı görünüyordu — panelde
   * 22 satır sahte uyuşmazlık çıktı. */
  const veri = {
    clients: [{ id: 1, ad: "Violla", durum: "aktif" }],
    subeler: [],
    haftalikPaylasimlar: [],
    cekimIsleri: [
      { id: 109, marka: "Violla", kategori: "Fotoğraf", icerikTuru: "Görsel2", asama: "Onaylandı", stokSayildi: true },
      { id: 110, marka: "Violla", kategori: "Fotoğraf", icerikTuru: "Görsel 3", asama: "Onaylandı", stokSayildi: true },
      { id: 111, marka: "Violla", kategori: "Fotoğraf", icerikTuru: "Görsel 4", asama: "Onaylandı", stokSayildi: true },
      { id: 119, marka: "Violla", kategori: "Fotoğraf", icerikTuru: "violla fotoğraf", asama: "Onaylandı", stokSayildi: true },
      { id: 120, marka: "Violla", kategori: "Fotoğraf", icerikTuru: "küpe", asama: "Onaylandı", stokSayildi: true },
      { id: 177, marka: "Violla", kategori: "Video", icerikTuru: "REELS 1 KARMA", asama: "Onaya Sunuldu" },
    ],
    /* Belgede yalnızca ESKİ anahtar var — sayılar doğru, adı eski. */
    stoklar: { "1_Görsel": 5 },
  };

  const rapor = stokMutabakati(veri);
  t("ESKİ ANAHTARLI DOĞRU SAYI sapma göstermiyor",
    !rapor.satirlar.some((x) => String(x.clientId) === "1"),
    JSON.stringify(rapor.satirlar) + " — 'Post 5' yazarken '0 kayıtlı' demek kullanıcıyı olmayan bir sorunla uğraştırır");

  /* Onaya sunulmuş kart stoğa sayılmaz — Reels satırı 0 olmalı ve sapma değil. */
  t("onay bekleyen kart Reels sapması üretmiyor",
    !rapor.satirlar.some((x) => x.tur === "Reels" && String(x.clientId) === "1"),
    JSON.stringify(rapor.satirlar));

  /* GERÇEK sapma hâlâ görülüyor mu — toplama, sapmayı gizlemeye başlamasın. */
  const sapmali = { ...veri, stoklar: { "1_Görsel": 9 } };
  const rapor2 = stokMutabakati(sapmali);
  t("GERÇEK sapma hâlâ yakalanıyor",
    rapor2.satirlar.some((x) => x.tur === "Post" && x.kayitli === 9 && x.gereken === 5),
    JSON.stringify(rapor2.satirlar));

  /* Eski + yeni anahtar bir arada: toplam doğru sayılmalı (3 + 2 = 5). */
  const karisik = { ...veri, stoklar: { "1_Görsel": 3, "1_Post": 2 } };
  t("eski ve yeni anahtar bir arada toplanıyor",
    !stokMutabakati(karisik).satirlar.some((x) => String(x.clientId) === "1"),
    JSON.stringify(stokMutabakati(karisik).satirlar));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
