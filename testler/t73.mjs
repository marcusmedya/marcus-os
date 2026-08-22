/* CAROUSEL KATEGORİSİ
 *
 * Dördüncü üretim kategorisi: çoklu fotoğraf gönderisi. Video / Fotoğraf / Grafik
 * Tasarım nasıl çalışıyorsa aynı şekilde — kendi aşama tablosu, kendi stok türü,
 * kendi panosu.
 *
 * BU TESTİN ASIL İŞİ, KATEGORİ EKLEMENİN "YARIM KALMASINI" YAKALAMAK. Kategori birden
 * çok tabloya bağlı: aşama listesi, "yapılıyor" aşaması, stok türü, kart etiketi. Biri
 * unutulursa hata çıkmaz — kart sessizce YANLIŞ akışa düşer. Örneğin aşama tablosuna
 * eklenmezse `asamaListesi` Video akışına düşüyor ve Carousel kartı panoda hiç
 * görünmeyen sütunlara dağılıyor.
 *
 * DRIVE KLASÖRÜ. Carousel kartında sekiz on slayt olabiliyor; hepsi ONAYLANANLAR'a tek
 * tek düştüğünde hangi karenin hangi gönderiye ait olduğu ayırt edilemiyor. Kartın
 * dosyaları kendi klasörüne gidiyor: ONAYLANANLAR/#124 Bowl Karosel/…
 */
import { readFileSync } from "node:fs";
import {
  asamaListesi, ILK_ASAMA, yapiliyorAsamasi, ASAMALAR_CAROUSEL, ASAMALAR_FOTOGRAF,
  SUBE_PAYLASIM_ASAMASI, asamalariDuzelt, kartKlasorAdi, KLASORLU_KATEGORI,
} from "../lib/asamalar.js";
import { paylasimTuru, PAYLASIM_TURLERI, onaylananlaraGoreStok } from "../lib/stok.js";

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

/* ---------------------------------------------------------------- */
bolum("1) AŞAMA TABLOSU — kendi akışı var, Video'ya düşmüyor", 6, () => {
  const liste = asamaListesi("Carousel");

  t("Carousel'in kendi tablosu dönüyor", liste === ASAMALAR_CAROUSEL,
    "tabloya eklenmezse asamaListesi Video akışına düşer");
  t("Video akışına DÜŞMÜYOR", liste !== asamaListesi("Video"));
  t("akış Fotoğraf ile aynı ŞEKİLDE",
    JSON.stringify(liste) === JSON.stringify(ASAMALAR_FOTOGRAF));
  t("ama AYRI bir tablo", ASAMALAR_CAROUSEL !== ASAMALAR_FOTOGRAF,
    "aynı dizi paylaşılsaydı Fotoğraf değişince Carousel sessizce değişirdi");
  t("ilk aşama Çekim Yapıldı", ILK_ASAMA("Carousel") === "Çekim Yapıldı");
  t("şube ara aşaması akışta", liste.includes(SUBE_PAYLASIM_ASAMASI));
});

/* ---------------------------------------------------------------- */
bolum("2) YAPILIYOR AŞAMASI — dosya nereye yükleniyor", 2, () => {
  t("Carousel'in yapılıyor aşaması Düzenleniyor", yapiliyorAsamasi("Carousel") === "Düzenleniyor");
  t("bu aşama gerçekten kendi listesinde",
    asamaListesi("Carousel").includes(yapiliyorAsamasi("Carousel")),
    "listede olmayan aşamaya yüklenen dosya kartı çıkmaza sokar");
});

/* ---------------------------------------------------------------- */
bolum("3) AŞAMA ONARIMI — Carousel kartı geçerli sayılıyor", 3, () => {
  const isler = [
    { id: 1, kategori: "Carousel", asama: "Düzenleniyor" },
    { id: 2, kategori: "Carousel", asama: "Edit Yapılıyor" },   // Video aşaması, Carousel'de yok
  ];
  const sonuc = asamalariDuzelt(isler);
  const bul = (id) => sonuc.find((x) => x.id === id);

  t("geçerli Carousel aşaması korunuyor", bul(1).asama === "Düzenleniyor",
    "tabloya eklenmemişse bu aşama 'geçersiz' sanılıp onarılırdı");
  t("başka kategorinin aşaması onarılıyor",
    asamaListesi("Carousel").includes(bul(2).asama), "gelen: " + bul(2).asama);
  t("onarım kartı listenin İÇİNE çekiyor",
    bul(2).asama !== "Edit Yapılıyor");
});

/* ---------------------------------------------------------------- */
bolum("4) STOK TÜRÜ — Carousel kendi sayacına yazıyor", 5, () => {
  t("Carousel stok türü listede", PAYLASIM_TURLERI.includes("Carousel"));
  t("kategori Carousel ise tür Carousel",
    paylasimTuru({ kategori: "Carousel", icerikTuru: "Yaz Menüsü" }) === "Carousel",
    "eşleme yoksa Görsel'e düşer ve yanlış sayaç artar");
  t("içerik adı hâlâ öncelikli",
    paylasimTuru({ kategori: "Carousel", icerikTuru: "Reels çekimi" }) === "Reels");
  t("Fotoğraf bozulmadı", paylasimTuru({ kategori: "Fotoğraf", icerikTuru: "Ürün" }) === "Görsel");

  /* Onaylanınca gerçekten Carousel sayacı artıyor mu — kural değil, sonuç sınanıyor. */
  const r = onaylananlaraGoreStok(
    [{ id: 7, marka: "Smell Coffee", kategori: "Carousel", asama: "Kontrol Bekliyor" }],
    [{ id: 7, marka: "Smell Coffee", kategori: "Carousel", asama: "Onaylandı" }],
    {}, [{ id: 1, ad: "Smell Coffee" }], null, [],
  );
  t("onayda Carousel stoğu artıyor", r && r.stoklar["1_Carousel"] === 1,
    JSON.stringify(r && r.stoklar));
});

/* ---------------------------------------------------------------- */
bolum("5) DRIVE KART KLASÖRÜ", 6, () => {
  t("Carousel kartı kendi klasörünü istiyor",
    kartKlasorAdi({ id: 124, kategori: "Carousel", icerikTuru: "Bowl Karosel" }) === "#124 Bowl Karosel");
  t("ad kart NUMARASIYLA başlıyor",
    kartKlasorAdi({ id: 124, kategori: "Carousel", icerikTuru: "Bowl Karosel" }).startsWith("#124"),
    "aynı adlı iki kart aynı klasöre düşmesin");
  t("içerik adı boşsa yalnızca numara",
    kartKlasorAdi({ id: 9, kategori: "Carousel", icerikTuru: "" }) === "#9");
  t("eğik çizgi temizleniyor",
    kartKlasorAdi({ id: 3, kategori: "Carousel", icerikTuru: "A/B testi" }) === "#3 A B testi",
    "Drive'da klasör adındaki eğik çizgi yol sanılıyor");

  t("DİĞER kategoriler klasör istemiyor",
    kartKlasorAdi({ id: 5, kategori: "Fotoğraf", icerikTuru: "Ürün" }) === null
    && kartKlasorAdi({ id: 5, kategori: "Video", icerikTuru: "Reels" }) === null,
    "mevcut davranış değişmemeli — dosya doğrudan durum klasörüne gider");
  t("klasörlü kategori tek yerde tanımlı", KLASORLU_KATEGORI === "Carousel");
});

/* ---------------------------------------------------------------- */
bolum("6) TAŞIMA — kart klasörü gerçekten kullanılıyor", 5, () => {
  const tasima = readFileSync(new URL("../lib/drive-tasima.js", import.meta.url), "utf8");
  const veri = readFileSync(new URL("../api/data.js", import.meta.url), "utf8");

  t("taşıma ucu kartKlasoru alıyor", /kartKlasoru = null/.test(tasima));
  t("kart klasörü DURUM klasörünün ALTINDA açılıyor",
    /klasorBulVeyaOlustur\(jeton, kartKlasoru, durumKlasoru\)/.test(tasima),
    "ay klasörünün altına açılırsa durum bilgisi kaybolur");
  t("klasör verilmezse eski yol korunuyor",
    /kartKlasoru\s*\n?\s*\?\s*await klasorBulVeyaOlustur[\s\S]{0,80}:\s*durumKlasoru/.test(tasima));

  const cagrilar = (veri.match(/onaylananiTasi\(\{[\s\S]{0,260}?\}\)/g) || []);
  /* İDDİA "kart klasörü geçiliyor mu", yazımı değil. Önce `kartKlasoru: kartKlasorAdi(is)`
   * kalıbı sabitlenmişti; çağrı yerlerinden biri yerel değişkene geçince test niyet
   * değişmediği hâlde düştü. Kısa yazım da (`kartKlasoru,`) kabul ediliyor. */
  t("her taşıma çağrısı kart klasörünü geçiriyor",
    cagrilar.length >= 2 && cagrilar.every((c) => /\bkartKlasoru\s*[,:}]/.test(c)),
    "gelen çağrı sayısı: " + cagrilar.length);
  t("yükleme oturumu da kart klasörünü geçiriyor",
    /kartKlasoru:\s*kartKlasorAdi\(is\)/.test(veri),
    "yükleme bağlanmazsa slaytlar durum klasörüne tek tek iner");
});

/* ---------------------------------------------------------------- */
bolum("7) ARAYÜZ — kategori her yerde tanınıyor", 5, () => {
  const cekim = readFileSync(new URL("../src/CekimEditTakibi.jsx", import.meta.url), "utf8");

  t("kategori listesinde", /KATEGORILER = \[[^\]]*"Carousel"/.test(cekim),
    "listede yoksa pano sekmesi ve form seçeneği hiç çıkmaz");
  t("Grafik Tasarım'dan ÖNCE duruyor",
    cekim.indexOf('"Carousel"') < cekim.indexOf('"Grafik Tasarım"'),
    "çekilen içerikler bir arada");
  t("tamamladım etiketi var", /"Carousel": "Düzenlemeyi Tamamladım"/.test(cekim),
    "eksikse düğme boş metinle çıkar");

  /* .jsx Node'da doğrudan içe aktarılamıyor; eşleme kaynaktan doğrulanıyor. */
  const tema = readFileSync(new URL("../src/tema.jsx", import.meta.url), "utf8");
  t("kendi rozet etiketi ve rengi var",
    /"Carousel": \{ ad: "Karosel", renk: "#[0-9A-Fa-f]{6}"/.test(tema),
    "eşleme yoksa gri 'Carousel' yazar, Görsel'le karışır");

  /* Carousel çekiliyor — kameraman alanı görünmeli. Kural "Grafik Tasarım değilse
   * çekim var" olduğu için kendiliğinden doğru; yine de sabitlensin. */
  t("Carousel'de çekim alanları açık",
    /cekimVarMi = \(kategori\) => \(kategori \|\| "Video"\) !== "Grafik Tasarım"/.test(cekim));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
