/* DRIVE OTORİTELİ STOK — "stok = ONAYLANANLAR'da dosyası FİİLEN duran kartlar"
 *
 * Sapmanın kaynağı şuydu: kart "Onaylandı" aşamasına geçtiği anda stoğa yazılıyordu,
 * dosyanın Drive'da gerçekten o klasöre geçip geçmediğine bakılmadan. Taşıma sessizce
 * başarısız olduğunda stok, arkasında içerik OLMAYAN bir sayı gösteriyordu.
 *
 * BU TESTİN ASIL İŞİ ÜÇ ŞEY:
 *   1. Sayılan şey DOSYA değil KART — bir carousel on slayt, bir içeriktir.
 *   2. Aşaması onaylı ama dosyası başka klasörde olan kart stoğa SAYILMAZ.
 *   3. Kartsız dosya stoğa yazılmaz — türü bilinmiyor, uydurulamaz.
 */
import { driveDurumRaporu, driveyeGoreStok, beklenenDurum } from "../lib/drive-eslestirme.js";
import { paylasimTuru } from "../lib/stok.js";

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

const d = (id, durum, ad = "dosya.jpg") => ({ id, ad, durum });

/* ---------------------------------------------------------------- */
bolum("1) TÜR KIRILIMI — kart sayılır, dosya değil", 5, () => {
  const dosyalar = [
    d("R1AAAAAAAAAAA", "onaylanan"), d("R2AAAAAAAAAAA", "onaylanan"),
    d("C1AAAAAAAAAAA", "onaylanan"), d("C2AAAAAAAAAAA", "onaylanan"), d("C3AAAAAAAAAAA", "onaylanan"),
    d("B1AAAAAAAAAAA", "onayBekleyen"), d("B2AAAAAAAAAAA", "onayBekleyen"),
    d("P1AAAAAAAAAAA", "paylasilan"),
  ];
  const kartlar = [
    { id: 1, icerikTuru: "Reels tanıtım", asama: "Onaylandı", medya: [{ dosyaId: "R1AAAAAAAAAAA" }] },
    { id: 2, icerikTuru: "Reels menü", asama: "Onaylandı", medya: [{ dosyaId: "R2AAAAAAAAAAA" }] },
    { id: 3, icerikTuru: "Karosel", kategori: "Carousel", asama: "Onaylandı",
      medya: [{ dosyaId: "C1AAAAAAAAAAA" }, { dosyaId: "C2AAAAAAAAAAA" }, { dosyaId: "C3AAAAAAAAAAA" }] },
    { id: 4, icerikTuru: "Görsel kampanya", asama: "Onaya Sunuldu", medya: [{ dosyaId: "B1AAAAAAAAAAA" }] },
    { id: 5, icerikTuru: "Reels teklif", asama: "Revize İstendi", medya: [{ dosyaId: "B2AAAAAAAAAAA" }] },
    { id: 6, icerikTuru: "Görsel eski", asama: "Teslim Edildi", medya: [{ dosyaId: "P1AAAAAAAAAAA" }] },
  ];
  const r = driveDurumRaporu(dosyalar, kartlar, paylasimTuru);

  t("ONAYLANANLAR tür kırılımı doğru",
    JSON.stringify(r.durumlar.onaylanan.turler) === JSON.stringify({ Reels: 2, Carousel: 1 }),
    JSON.stringify(r.durumlar.onaylanan.turler));
  t("ÜÇ SLAYT TEK CAROUSEL sayılıyor",
    r.durumlar.onaylanan.turler.Carousel === 1 && r.durumlar.onaylanan.dosyaSayisi === 5,
    "dosya sayılsaydı 3 Carousel görünürdü");
  t("ONAY BEKLEYENLER ayrı raporlanıyor",
    JSON.stringify(r.durumlar.onayBekleyen.turler) === JSON.stringify({ Post: 1, Reels: 1 }),
    JSON.stringify(r.durumlar.onayBekleyen.turler));
  t("PAYLAŞILDI ayrı raporlanıyor", r.durumlar.paylasilan.turler.Post === 1);
  t("her satırda KART ADI var",
    r.durumlar.onaylanan.kartlar.some((x) => x.isAdi === "Reels tanıtım" && x.isId === 1));
});

/* ---------------------------------------------------------------- */
bolum("2) STOK — dosyası taşınmamış kart SAYILMAZ", 4, () => {
  const dosyalar = [
    d("R1AAAAAAAAAAA", "onaylanan"),
    d("T1AAAAAAAAAAA", "onayBekleyen"),      // kart onaylı ama dosya taşınmamış
  ];
  const kartlar = [
    { id: 1, icerikTuru: "Reels", asama: "Onaylandı", medya: [{ dosyaId: "R1AAAAAAAAAAA" }] },
    { id: 2, icerikTuru: "Görsel", asama: "Onaylandı", medya: [{ dosyaId: "T1AAAAAAAAAAA" }] },
  ];
  const stok = driveyeGoreStok(dosyalar, kartlar, paylasimTuru);
  const r = driveDurumRaporu(dosyalar, kartlar, paylasimTuru);

  t("TAŞINMAMIŞ KART STOĞA GİRMİYOR", stok.Post === undefined,
    JSON.stringify(stok) + " — aşama onaylı ama dosya ONAYLANANLAR'da değil");
  t("taşınmış kart sayılıyor", stok.Reels === 1, JSON.stringify(stok));
  t("YANLIŞ YERDEKİ kart adıyla bildiriliyor",
    r.yanlisYerdekiler.length === 1 && r.yanlisYerdekiler[0].isId === 2
      && r.yanlisYerdekiler[0].beklenen === "onaylanan",
    JSON.stringify(r.yanlisYerdekiler));
  t("aşama → beklenen klasör eşlemesi",
    beklenenDurum("Onaylandı") === "onaylanan"
    && beklenenDurum("Teslim Edildi") === "paylasilan"
    && beklenenDurum("Çekim Yapılacak") === null);
});

/* ---------------------------------------------------------------- */
bolum("3) KARTSIZ DOSYA — stoğa yazılmaz, ama bildirilir", 3, () => {
  const dosyalar = [d("R1AAAAAAAAAAA", "onaylanan"), d("XXAAAAAAAAAAA", "onaylanan", "kimsesiz.jpg")];
  const kartlar = [{ id: 1, icerikTuru: "Reels", asama: "Onaylandı", medya: [{ dosyaId: "R1AAAAAAAAAAA" }] }];
  const r = driveDurumRaporu(dosyalar, kartlar, paylasimTuru);
  const stok = driveyeGoreStok(dosyalar, kartlar, paylasimTuru);

  t("kartsız dosya stoğa YAZILMIYOR", stok.Reels === 1 && Object.keys(stok).length === 1,
    JSON.stringify(stok) + " — türü bilinmiyor, uydurulamaz");
  t("kartsız dosya bildiriliyor", r.kartsizSayisi === 1 && r.kartsiz[0].ad === "kimsesiz.jpg");
  t("hangi durumda olduğu duruyor", r.durumlar.onaylanan.kartsizSayisi === 1);
});

/* ---------------------------------------------------------------- */
bolum("4) DOSYASIZ ONAYLI KART", 2, () => {
  const kartlar = [
    { id: 1, icerikTuru: "Görsel", asama: "Onaylandı" },
    { id: 2, icerikTuru: "Video", asama: "Çekim Yapılacak" },
  ];
  const r = driveDurumRaporu([], kartlar, paylasimTuru);
  t("dosyasız onaylı kart bildiriliyor", r.dosyasizKartlar.length === 1 && r.dosyasizKartlar[0].isId === 1);
  t("henüz çekilmemiş kart bildirilmiyor", !r.dosyasizKartlar.some((x) => x.isId === 2),
    "çekim aşamasındaki kartın Drive'da dosyası olması beklenmez");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
