/* VİDEO TEŞHİS SATIRI + preload GERİ ALINDI
 *
 * "Video geç açılıyor / takılıyor" tartışması bu projede aylardır TAHMİNLE yürüdü ve
 * ölçmeden yapılan iki değişiklik videoyu bozdu (biri videoyu tamamen durdurdu). Bu
 * satır o tartışmayı rakama bağlıyor: çözünürlük · boyut · bit hızı · hızlı başlangıç.
 *
 * BU TESTİN ASIL İŞİ:
 *   1. EKSİK BİLGİYLE SAYI UYDURULMUYOR. Boyut ya da süre yoksa o parça hiç yazılmıyor;
 *      "0 MB" ya da "NaN Mbps" yazmak, hiç yazmamaktan kötü — yanlış rakama göre karar
 *      verilir.
 *   2. BİT HIZI DOĞRU HESAPLANIYOR. Asıl teşhis bu; boyut tek başına yanıltıcı çünkü
 *      uzun video doğal olarak büyüktür.
 *   3. `hizliBaslangic` ÜÇ DEĞERLİ. null (teşhis edilemedi) iken hiçbir şey yazılmamalı —
 *      yanlış uyarı, uyarı olmamasından kötü.
 *   4. Dosya boyutu EK İSTEK ATMADAN alınıyor — `content-range` başlığından.
 */
import {
  videoBilgiSatiri, baytBicimle, bitHizi, bitHiziBicimle, agirMi, AGIR_BIT_HIZI,
} from "../lib/video-bilgi.js";

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

const MB = 1024 * 1024;

/* ---------------------------------------------------------------- */
bolum("1) EKSİK BİLGİYLE SAYI UYDURULMUYOR", 9, () => {
  t("hiç bilgi yoksa satır boş", videoBilgiSatiri({}) === "",
    "boş satır çizilmesin diye çağıran taraf bunu kontrol ediyor");
  t("tanımsız girdi çökertmiyor", videoBilgiSatiri() === "");
  t("yalnızca çözünürlük varsa yalnızca o yazılıyor",
    videoBilgiSatiri({ genislik: 1920, yukseklik: 1080 }) === "1920×1080");
  t("boyut yoksa bit hızı yazılmıyor",
    !videoBilgiSatiri({ genislik: 1920, yukseklik: 1080, sureSn: 18 }).includes("bps"),
    "süre var ama boyut yok — bit hızı hesaplanamaz, uydurulmamalı");
  t("süre yoksa bit hızı yazılmıyor",
    !videoBilgiSatiri({ boyut: 67 * MB, sureSn: 0 }).includes("bps"));
  t("sıfır boyut yazılmıyor", videoBilgiSatiri({ boyut: 0, genislik: 1920, yukseklik: 1080 }) === "1920×1080",
    "'0 MB' yanlış bilgi verir");

  /* Girdiler SUNUCUDAN ve TARAYICI API'sinden geliyor; ikisi de bir gün beklenmedik bir
   * değer verebilir. Ekranda "-5 B · -0 kbps" yazması, hiçbir şey yazmamaktan kötü —
   * kullanıcı o rakama bakıp karar veriyor. Ölçüldü: koruma kalkınca tam bu çıkıyor. */
  t("negatif boyut satıra girmiyor", videoBilgiSatiri({ boyut: -5, sureSn: 18 }) === "",
    "koruma olmadan '-5 B · -0 kbps' yazıyor");
  t("negatif çözünürlük yazılmıyor", videoBilgiSatiri({ genislik: -1920, yukseklik: 1080 }) === "");
  t("süre Infinity iken bit hızı yazılmıyor",
    !videoBilgiSatiri({ boyut: 5 * 1024 * 1024, sureSn: Infinity }).includes("bps"),
    "tarayıcı süreyi bilmiyorken duration Infinity döner — gerçek bir hâl");
});

/* ---------------------------------------------------------------- */
bolum("2) BİT HIZI — asıl teşhis", 5, () => {
  /* 67 MB / 18 sn ≈ 31 Mbps — proxy üzerinden izlenemez. */
  const agir = bitHizi(67 * MB, 18);
  t("ağır dosyanın bit hızı hesaplanıyor", agir > 30e6 && agir < 33e6, `bulunan ${(agir / 1e6).toFixed(1)} Mbps`);
  /* 5 MB / 18 sn ≈ 2.3 Mbps — rahat akar. */
  const hafif = bitHizi(5 * MB, 18);
  t("hafif dosyanın bit hızı hesaplanıyor", hafif > 2e6 && hafif < 2.5e6, `bulunan ${(hafif / 1e6).toFixed(1)} Mbps`);
  t("süre sıfırken bölme hatası yok", bitHizi(67 * MB, 0) === 0);
  t("ağır dosya ağır işaretleniyor", agirMi(67 * MB, 18) === true);
  t("hafif dosya ağır sayılmıyor", agirMi(5 * MB, 18) === false,
    `eşik ${(AGIR_BIT_HIZI / 1e6)} Mbps`);
});

/* ---------------------------------------------------------------- */
bolum("3) HIZLI BAŞLANGIÇ ÜÇ DEĞERLİ", 3, () => {
  const temel = { boyut: 5 * MB, genislik: 1280, yukseklik: 720, sureSn: 18 };
  t("kapalıysa uyarı yazılıyor",
    videoBilgiSatiri({ ...temel, hizliBaslangic: false }).includes("KAPALI"));
  t("açıksa öyle yazılıyor",
    videoBilgiSatiri({ ...temel, hizliBaslangic: true }).includes("açık"));
  t("teşhis edilemediyse HİÇBİR ŞEY yazılmıyor",
    !videoBilgiSatiri({ ...temel, hizliBaslangic: null }).toLocaleLowerCase("tr").includes("başlangıç"),
    "yanlış uyarı, uyarı olmamasından kötü");
});

/* ---------------------------------------------------------------- */
bolum("4) BİÇİMLENDİRME", 5, () => {
  t("megabayt", baytBicimle(5 * MB) === "5.0 MB");
  t("büyük megabayt ondalıksız", baytBicimle(67 * MB) === "67 MB");
  t("kilobayt", baytBicimle(500 * 1024) === "500 KB");
  t("gigabayt", baytBicimle(2.5 * 1024 * MB).includes("GB"));
  t("bit hızı 1 Mbps altında kbps", bitHiziBicimle(800e3).includes("kbps"));
});

/* ---------------------------------------------------------------- */
bolum("5) TAM SATIR", 3, () => {
  const satir = videoBilgiSatiri({ boyut: 67 * MB, genislik: 1920, yukseklik: 1080, sureSn: 18, hizliBaslangic: false });
  t("dört parça da var",
    satir.includes("1920×1080") && satir.includes("67 MB") && satir.includes("Mbps") && satir.includes("KAPALI"),
    satir);
  t("ayraçla birleşiyor", satir.split(" · ").length === 4);
  t("hafif dosyada da tam", videoBilgiSatiri({ boyut: 5 * MB, genislik: 1280, yukseklik: 720, sureSn: 18, hizliBaslangic: true }).split(" · ").length === 4);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
