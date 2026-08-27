/* OYNATICI: AÇILIŞ MALİYETİ VE KUTU ORANI
 *
 * İki sahada görülen belirti:
 *
 *   1. "Video geç açılıyor." Adres her kart açılışında sunucudan yeniden isteniyordu:
 *      bir tur ağ gecikmesi ARTI sunucuda belge okuması — hepsi video başlamadan önce.
 *      Adres saatlik ızgaraya oturduğu için artık saklanabiliyor.
 *
 *   2. "Önce yatay çıkıyor, sonra dikeye dönüyor." `<video>` etiketine oran
 *      verilmediğinde kutunun boyunu POSTER görseli belirliyor; Drive'ın küçük resmi
 *      çoğu zaman yatay olduğu için dikey bir Reels önce yatay açılıp metadata gelince
 *      atlıyordu.
 */
import { videoAdresAnahtari, videoAdresOku, videoAdresYaz, onizlemeyiTazele, bellegiBosalt }
  from "../lib/onizleme-bellegi.js";
import { oynaticiOrani, videoYonuBul } from "../lib/video-yon.js";

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
bolum("1) ADRES ÖNBELLEĞİ — ikinci açılış ağa çıkmıyor", 6, () => {
  bellegiBosalt();
  const a = videoAdresAnahtari({ isId: 7, slot: "1" });
  t("anahtar kartın önekiyle başlıyor", String(a).startsWith("is:7:"),
    a + " — önek tutmazsa yükleme sonrası temizlik onu düşüremez");

  t("boşken null", videoAdresOku(a) === null);
  videoAdresYaz(a, "/api/data?video=7&j=JETON");
  t("yazılan adres okunuyor", videoAdresOku(a) === "/api/data?video=7&j=JETON");

  /* SÜRE: jetonun en kısa ömrü bir saat; önbellek onun ALTINDA kalmalı, yoksa
   * süresi dolmuş bir adres önbellekten çıkıp oynatıcı sessizce boş kalır. */
  t("30 dakika sonra hâlâ geçerli", videoAdresOku(a, Date.now() + 29 * 60 * 1000) !== null);
  t("bir saat sonra DÜŞÜYOR", videoAdresOku(a, Date.now() + 61 * 60 * 1000) === null,
    "jeton ömrünü aşan bir adres oynatıcıyı boş bırakır");

  /* YENİ VERSİYON YÜKLENİNCE ADRES DÜŞMELİ: jeton dosya kimliğini taşıyor, düşmezse
   * eski dosya oynatılırdı. */
  bellegiBosalt();
  videoAdresYaz(a, "/api/data?video=7&j=ESKI");
  onizlemeyiTazele(7);
  t("KART TAZELENİNCE ADRES DE DÜŞÜYOR", videoAdresOku(a) === null,
    "düşmezse yeni versiyon yüklendikten sonra ESKİ dosya oynatılır");
});

/* ---------------------------------------------------------------- */
bolum("2) KUTU ORANI — ilk kareden itibaren doğru", 5, () => {
  t("gerçek oran biliniyorsa o kullanılıyor", oynaticiOrani(0.5625, "yatay") === "0.5625",
    oynaticiOrani(0.5625, "yatay") + " — metadata geldiyse kayıtlı yön geçersiz");
  t("oran yokken DİKEY kartın oranı", oynaticiOrani(null, "dikey") === videoYonuBul("dikey").oran,
    oynaticiOrani(null, "dikey"));
  t("oran yokken YATAY kartın oranı", oynaticiOrani(null, "yatay") === videoYonuBul("yatay").oran);
  t("yön hiç yoksa dikey varsayılıyor", oynaticiOrani(null, undefined) === videoYonuBul("dikey").oran,
    oynaticiOrani(null, undefined) + " — içeriğin çoğu Reels");
  t("bozuk oran kayıtlı yöne düşüyor",
    oynaticiOrani(0, "kare") === videoYonuBul("kare").oran && oynaticiOrani(NaN, "kare") === videoYonuBul("kare").oran);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
