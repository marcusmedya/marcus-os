/* MP4 "FAST START" TEŞHİSİ — "video neden geç açılıyor"
 *
 * Oynatma bilgisi (`moov`) dosyanın SONUNDA ise tarayıcı videoyu başlatmadan önce onu
 * bulmak zorunda: önce sonu istiyor, sonra başa dönüyor. Kendi sunucumuz üzerinden
 * geçen bir dosyada bu iki fazladan tur demek ve bekleme onlarca saniyeye çıkıyor —
 * sahada "oynatıyor ama bazen 30 sn bazen 1 dk bekliyor" diye görüldü. "Bazen" olması
 * dosyaya bağlı olduğunun işareti: `moov`un yeri dışa aktarım ayarına göre değişiyor.
 *
 * BU TEŞHİS DOSYAYI DEĞİŞTİRMEZ. Doğrusu dışa aktarımı düzeltmek; ama hangi dosyanın
 * yavaş olduğunu SÖYLEMEK, soruyu tahminden çıkarıyor.
 */
import { hizliBaslangicMi, faststartUyarisi } from "../lib/mp4-faststart.js";

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

/** Gerçek MP4 kutu biçimi: [4 bayt boyut][4 bayt tür][dolgu]. */
const kutu = (tur, boyut) => {
  const b = [(boyut >>> 24) & 255, (boyut >>> 16) & 255, (boyut >>> 8) & 255, boyut & 255];
  for (const c of tur) b.push(c.charCodeAt(0));
  while (b.length < boyut) b.push(0);
  return b;
};
const dosya = (...kutular) => new Uint8Array([].concat(...kutular));

/* ---------------------------------------------------------------- */
bolum("1) KARAR — hangisi önce geliyor", 5, () => {
  t("moov BAŞTA → hızlı",
    hizliBaslangicMi(dosya(kutu("ftyp", 24), kutu("moov", 40), kutu("mdat", 200))) === true);
  t("mdat ÖNCE → yavaş",
    hizliBaslangicMi(dosya(kutu("ftyp", 24), kutu("mdat", 200))) === false,
    "bu dosyada tarayıcı önce sonu indirmek zorunda");
  t("aradaki küçük kutular karar bozmuyor",
    hizliBaslangicMi(dosya(kutu("ftyp", 24), kutu("free", 16), kutu("wide", 16), kutu("moov", 40))) === true);
  t("mdat'tan önce free varsa yine yavaş",
    hizliBaslangicMi(dosya(kutu("ftyp", 24), kutu("free", 16), kutu("mdat", 200))) === false);
  t("moov mdat'tan sonra gelse bile İLK karşılaşılan kazanıyor",
    hizliBaslangicMi(dosya(kutu("ftyp", 24), kutu("mdat", 64), kutu("moov", 40))) === false,
    "tarayıcı da ilk mdat'ı görüp sonu aramaya gidiyor");
});

/* ---------------------------------------------------------------- */
bolum("2) KARAR VERİLEMEYEN HÂLLER — yanlış uyarı vermiyor", 5, () => {
  /* Yanlış bir uyarı, uyarı olmamasından kötü: kullanıcı olmayan bir sorunla uğraşır. */
  t("boş girdi", hizliBaslangicMi(new Uint8Array([])) === null);
  t("tanımsız girdi", hizliBaslangicMi(null) === null && hizliBaslangicMi(undefined) === null);
  t("yalnızca ftyp — henüz karar yok", hizliBaslangicMi(dosya(kutu("ftyp", 24))) === null,
    "bayt yetmiyorsa susmalı");
  t("MP4 olmayan içerik", hizliBaslangicMi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])) === null);
  t("boyutu 0 olan kutu sonsuz döngü yapmıyor",
    hizliBaslangicMi(new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112, 0, 0])) === null,
    "boyut 0 'sonuna kadar' demek — ilerlenemez");
});

/* ---------------------------------------------------------------- */
bolum("3) UYARI METNİ", 3, () => {
  t("yavaş dosyada uyarı var", /fast start|optimize değil/i.test(String(faststartUyarisi(false))));
  t("hızlı dosyada uyarı YOK", faststartUyarisi(true) === null,
    "gereksiz uyarı kullanıcıyı olmayan bir sorunla uğraştırır");
  t("teşhis yapılamadıysa uyarı YOK", faststartUyarisi(null) === null);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
