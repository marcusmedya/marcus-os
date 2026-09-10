/* PLAN SEÇİCİDE TÜR AYRIMI
 *
 * BU TESTİN ASIL İŞİ:
 *   1. SEÇİCİ TÜRE BAKIYOR. Sahadan bildirildi: plan hücresinde "Post" seçilince listede
 *      Reels kartları da çıkıyordu. Seçici kartların türünü hiç okumuyordu.
 *   2. TÜR TUTMAYAN KART GİZLENMİYOR, AYRILIYOR. Tür çoğu kartta ADDAN tahmin ediliyor;
 *      yanlış tahmin edilen kart tamamen gizlenseydi hiçbir plana bağlanamazdı.
 *   3. TÜRÜN TEK SAHİBİ `lib/stok.js` → `paylasimTuru`. Kartta AÇIKÇA seçilmiş tür
 *      (`paylasimTuru` alanı) ada bakan tahmini ezer; `src/App.jsx` içindeki ikinci kopya
 *      bunu hiç okumuyordu ve üçe inen tür listesinden habersizdi ("Görsel", "Video").
 *   4. ŞUBE VE "ZATEN PLANLANMIŞ" ELEMELERİ TÜR AYRIMINDAN SONRA DA ÇALIŞIYOR.
 */
import { seciciKartlari, turUyuyorMu } from "../lib/kart-secici.js";
import { paylasimTuru } from "../lib/stok.js";

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

const ISLER = [
  { id: 1, marka: "Animed", icerikTuru: "Post 1", kategori: "Post", asama: "Onaylandı" },
  { id: 2, marka: "Animed", icerikTuru: "Post 2", kategori: "Post", asama: "Onaylandı" },
  { id: 3, marka: "Animed", icerikTuru: "Köpeğiniz bu 5 hareketi", kategori: "Reels", asama: "Onaylandı" },
  { id: 4, marka: "Animed", icerikTuru: "Kediler kutu", kategori: "Carousel", asama: "Onaylandı" },
  { id: 5, marka: "Animed", icerikTuru: "Eski Post", kategori: "Post", asama: "Teslim Edildi" },
  { id: 6, marka: "Animed", icerikTuru: "Eski Reels", kategori: "Reels", asama: "Teslim Edildi" },
  { id: 7, marka: "Animed", icerikTuru: "Hazır değil", kategori: "Post", asama: "Kontrol Bekliyor" },
  { id: 8, marka: "Başka Marka", icerikTuru: "Post 9", kategori: "Post", asama: "Onaylandı" },
];
const idler = (liste) => liste.map((x) => x.id).sort((a, b) => a - b);

/* ---------------------------------------------------------------- */
await bolum("1) SEÇİCİ TÜRE BAKIYOR", 8, () => {
  const post = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Post" });
  t("Post seçilince yalnızca Post kartları hazır listede",
    String(idler(post.hazir)) === "1,2",
    `gelen: ${idler(post.hazir)} — Reels/Carousel kartı Post listesinde görünüyordu`);
  t("Reels kartı Post'un hazır listesinde YOK", !post.hazir.some((x) => x.id === 3));
  t("Carousel kartı Post'un hazır listesinde YOK", !post.hazir.some((x) => x.id === 4));
  t("Post'un 'daha önce paylaşılmış'ı da yalnızca Post",
    String(idler(post.dahaOnce)) === "5");

  const reels = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Reels" });
  t("Reels seçilince yalnızca Reels kartı hazır listede",
    String(idler(reels.hazir)) === "3", `gelen: ${idler(reels.hazir)}`);
  t("Reels'in paylaşılmışı da ayrı", String(idler(reels.dahaOnce)) === "6");

  const carousel = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Carousel" });
  t("Carousel kendi alanında", String(idler(carousel.hazir)) === "4");

  t("tür verilmezse ayrım yapılmaz (eski davranış)",
    seciciKartlari({ isler: ISLER, markaAd: "Animed" }).hazir.length === 4);
});

/* ---------------------------------------------------------------- */
await bolum("2) TÜR TUTMAYAN KART GİZLENMİYOR, AYRILIYOR", 4, () => {
  const post = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Post" });
  t("başka tür kartları ayrı listede duruyor",
    String(idler(post.baskaTur)) === "3,4,6",
    `gelen: ${idler(post.baskaTur)} — gizlenirse yanlış tahmin edilmiş kart hiçbir plana bağlanamaz`);
  t("başka tür listesi hazır listeye karışmıyor",
    post.hazir.every((x) => !post.baskaTur.includes(x)));
  t("hazır olmayan kart hiçbir listede yok (Kontrol Bekliyor)",
    ![...post.hazir, ...post.dahaOnce, ...post.baskaTur].some((x) => x.id === 7),
    "onaylanmamış içerik paylaşıma sunulamaz");
  t("başka markanın kartı hiçbir listede yok",
    ![...post.hazir, ...post.dahaOnce, ...post.baskaTur].some((x) => x.id === 8),
    "marka sızıntısı");
});

/* ---------------------------------------------------------------- */
await bolum("3) TÜRÜN TEK SAHİBİ lib/stok.js", 4, () => {
  /* Kartta AÇIKÇA seçilmiş tür, addan yapılan tahmini EZER. `src/App.jsx` içindeki eski
   * kopya bu alanı hiç okumuyordu. */
  const acikca = { id: 20, marka: "Animed", icerikTuru: "Kediler kutu", kategori: "Reels",
    asama: "Onaylandı", paylasimTuru: "Post" };
  const post = seciciKartlari({ isler: [acikca], markaAd: "Animed", tur: "Post" });
  t("kartta seçilmiş tür ada/kategoriye göre öncelikli",
    post.hazir.length === 1 && post.baskaTur.length === 0,
    "kategori Reels ama kartta Post seçilmiş; seçili tür kazanmalı");

  /* Eski tür adları okuma anında eşleniyor — belgede hâlâ "Görsel" kartlar var. */
  const eski = { id: 21, marka: "Animed", icerikTuru: "Görsel 3", kategori: "Fotoğraf", asama: "Onaylandı" };
  t("eski 'Fotoğraf' kartı Post altında çıkıyor",
    seciciKartlari({ isler: [eski], markaAd: "Animed", tur: "Post" }).hazir.length === 1,
    `paylasimTuru: ${paylasimTuru(eski)}`);
  t("eski 'Fotoğraf' kartı Reels altında çıkmıyor",
    seciciKartlari({ isler: [eski], markaAd: "Animed", tur: "Reels" }).hazir.length === 0);

  t("turUyuyorMu stok kuralıyla birebir",
    ISLER.every((j) => turUyuyorMu(j, paylasimTuru(j))),
    "iki ayrı tür kuralı bu projede zaten bir kez ayrıştı");
});

/* ---------------------------------------------------------------- */
await bolum("4) ŞUBE VE 'ZATEN PLANLANMIŞ' ELEMELERİ DURUYOR", 3, () => {
  const bagli = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Post", bagliIdler: ["1"] });
  t("bu şubede zaten planlanmış kart listeden çıkıyor",
    String(idler(bagli.hazir)) === "2");
  t("elenen kart 'başka tür'e de düşmüyor",
    !bagli.baskaTur.some((x) => x.id === 1),
    "eleme tür ayrımından kaçarsa kart iki kez planlanır");

  const sube = seciciKartlari({ isler: ISLER, markaAd: "Animed", tur: "Post",
    subedeKullanilabilir: (j) => j.id !== 2 });
  t("şube kapsamı dışındaki kart listede yok", String(idler(sube.hazir)) === "1");
});

/* ---------------------------------------------------------------- */
await bolum("5) MARKA EŞLEŞMESİ BÜYÜK/KÜÇÜK HARFE TAKILMIYOR", 2, () => {
  const karisik = [{ id: 30, marka: "  ANİMED ", icerikTuru: "Post 5", kategori: "Post", asama: "Onaylandı" }];
  t("boşluk ve büyük harf marka eşleşmesini bozmuyor",
    seciciKartlari({ isler: karisik, markaAd: "animed", tur: "Post" }).hazir.length === 1,
    "kartlar markayı ADIYLA saklıyor; eşleşme kaçarsa kart hiç görünmez");
  t("gerçekten başka marka eşleşmiyor",
    seciciKartlari({ isler: karisik, markaAd: "Animal", tur: "Post" }).hazir.length === 0);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
