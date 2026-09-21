/* FİNANS MENÜSÜ VE SEKMELERİ — `lib/finans-sekmeleri.js`
 *
 * NEDEN VAR: para ekranları menüde İKİ maddeydi ("Finans" ve "Ödeme Takvimi"). İkincisi
 * yalnızca `odemeTakvimi` izni olup `finans` izni OLMAYAN personel için duruyordu —
 * kaldırılsaydı o kişi ödeme ekranına HİÇ ULAŞAMAZDI. Menü tek maddeye indirildi ve
 * sekmeler kişinin iznine göre çiziliyor.
 *
 * BU DEĞİŞİKLİĞİN TEK KABUL ÖLÇÜTÜ: kimse yetki kazanmayacak, kimse erişim kaybetmeyecek.
 * Aşağıdaki bölümler tam olarak bunu ölçüyor — dört izin bileşiminin DÖRDÜ birden:
 *
 *   1. finans VAR · odemeTakvimi YOK  → menüde var, Ödemeler sekmesi YOK (yetki kazanmadı)
 *   2. finans YOK · odemeTakvimi VAR  → menüde VAR (erişim kaybı yok!), yalnızca Ödemeler
 *   3. ikisi de YOK                   → menüde HİÇ YOK
 *   4. ikisi de VAR                   → hepsi
 *
 * 2. madde bu işin asıl riski: kırarak ölçülürken kasıtlı olarak bozulan yer orası.
 *
 * DAVRANIŞ sınanıyor, kaynak metni değil: hiçbir kontrol dosyanın içine `grep` atmıyor,
 * hepsi modülü ÇAĞIRIP dönen listeye bakıyor.
 */
import {
  FINANS_SEKME_TANIMLARI, finansSekmeleri, finansMenudeMi, aktifFinansSekmesi,
} from "../lib/finans-sekmeleri.js";

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

const adlar = (izinler) => finansSekmeleri(izinler).map((s) => s.label);
const anahtarlar = (izinler) => finansSekmeleri(izinler).map((s) => s.key);

/* ÖDEMELER SEKMESİNİN ANAHTARI tanımdan okunuyor, elle yazılmıyor: anahtar bir gün
 * değişirse test yanlış alarm vermesin, kuralı ölçmeye devam etsin. */
const ODEMELER = FINANS_SEKME_TANIMLARI.find((s) => s.izin === "odemeTakvimi");
/* Finans'ın KENDİ sekmeleri (yöneticiye özel olan hariç) — "yalnızca Ödemeler" ve
 * "Ödemeler yok" iddialarının karşı tarafı. */
const FINANS_ANAHTARLARI = FINANS_SEKME_TANIMLARI
  .filter((s) => s.izin === "finans" && !s.yalnizcaYonetici).map((s) => s.key);

await bolum("1 · finans VAR + odemeTakvimi YOK — ödeme kayıtlarına erişim AÇILMAZ", 5, () => {
  const izin = { finans: true, odemeTakvimi: false, yonetici: false };
  t("Finans menüde çiziliyor", finansMenudeMi(izin) === true);
  t("Ödemeler sekmesi YOK (yetki kazanılmadı)",
    !anahtarlar(izin).includes(ODEMELER.key), JSON.stringify(adlar(izin)));
  t("Finans'ın kendi sekmelerinin HEPSİ var",
    FINANS_ANAHTARLARI.every((a) => anahtarlar(izin).includes(a)), JSON.stringify(anahtarlar(izin)));
  t("Doğrulama sekmesi YOK (personel)", !anahtarlar(izin).includes("dogrulama"));
  /* Kişinin hatırladığı sekme artık görünmüyorsa ekran BOŞ AÇILMAMALI. */
  t("görünmeyen bir sekme hatırlanıyorsa ilk görünür sekmeye düşülür",
    aktifFinansSekmesi(ODEMELER.key, finansSekmeleri(izin)) === anahtarlar(izin)[0]);
});

await bolum("2 · finans YOK + odemeTakvimi VAR — ERİŞİM KAYBI OLMAMALI", 6, () => {
  const izin = { finans: false, odemeTakvimi: true, yonetici: false };
  /* BU İŞİN ASIL RİSKİ. Eski menüdeki ayrı "Ödeme Takvimi" maddesi tam olarak bu kişi
   * için duruyordu; Finans maddesi ona da çizilmezse ekrana HİÇ ULAŞAMAZ. */
  t("Finans menüde ÇİZİLİYOR (ayrı menü maddesi kalktı, erişim kalmalı)",
    finansMenudeMi(izin) === true, JSON.stringify(adlar(izin)));
  t("Ödemeler sekmesi var", anahtarlar(izin).includes(ODEMELER.key), JSON.stringify(adlar(izin)));
  t("YALNIZCA Ödemeler sekmesi var (Finans rakamları sızmıyor)",
    anahtarlar(izin).length === 1, JSON.stringify(anahtarlar(izin)));
  t("Finans'ın kendi sekmelerinin HİÇBİRİ yok",
    FINANS_ANAHTARLARI.every((a) => !anahtarlar(izin).includes(a)), JSON.stringify(anahtarlar(izin)));
  t("Doğrulama sekmesi YOK", !anahtarlar(izin).includes("dogrulama"));
  /* Bileşenin başlangıç değeri "ozet" ve bu kişide o sekme hiç çizilmiyor: düzeltilmezse
   * ekran bomboş açılır. */
  t('varsayılan "ozet" hatırlanıyorsa Ödemeler sekmesine düşülür',
    aktifFinansSekmesi("ozet", finansSekmeleri(izin)) === ODEMELER.key);
});

await bolum("3 · ikisi de YOK — menüde hiç görünmez", 4, () => {
  const izin = { finans: false, odemeTakvimi: false, yonetici: false };
  t("Finans menüde YOK", finansMenudeMi(izin) === false);
  t("hiç sekme çizilmiyor", finansSekmeleri(izin).length === 0, JSON.stringify(adlar(izin)));
  t("aktif sekme null (çizilecek bir şey yok)",
    aktifFinansSekmesi("ozet", finansSekmeleri(izin)) === null);
  /* FAIL-CLOSE: izin nesnesi hiç verilmezse de kimse bir şey görmemeli. */
  t("izin nesnesi hiç verilmezse de menüde YOK (fail-close)",
    finansMenudeMi(undefined) === false && finansMenudeMi({}) === false);
});

await bolum("4 · ikisi de VAR — hepsi görünür", 4, () => {
  const personel = { finans: true, odemeTakvimi: true, yonetici: false };
  const yonetici = { finans: true, odemeTakvimi: true, yonetici: true };
  t("personelde Finans sekmeleri + Ödemeler birlikte var",
    FINANS_ANAHTARLARI.every((a) => anahtarlar(personel).includes(a))
      && anahtarlar(personel).includes(ODEMELER.key), JSON.stringify(anahtarlar(personel)));
  t("personelde Doğrulama sekmesi YOK", !anahtarlar(personel).includes("dogrulama"));
  t("yöneticide Doğrulama sekmesi VAR", anahtarlar(yonetici).includes("dogrulama"));
  t("yönetici bütün sekmeleri görüyor",
    anahtarlar(yonetici).length === FINANS_SEKME_TANIMLARI.length,
    `${anahtarlar(yonetici).length} / ${FINANS_SEKME_TANIMLARI.length}`);
});

await bolum("5 · sınır durumlar — sıra, saflık ve fail-close", 5, () => {
  const hepsi = { finans: true, odemeTakvimi: true, yonetici: true };
  /* SIRA TANIMDAN GELİYOR: sekme çubuğunun düzeni izne göre karışmamalı. */
  const beklenenSira = FINANS_SEKME_TANIMLARI.map((s) => s.key);
  t("sekme sırası tanım sırasını koruyor",
    anahtarlar(hepsi).join("|") === beklenenSira.join("|"), anahtarlar(hepsi).join("|"));
  /* SAF MODÜL: verilen nesneyi DEĞİŞTİRMEZ, tanım tablosunu da paylaşmaz. */
  const girdi = { finans: true, odemeTakvimi: false, yonetici: false };
  const kopya = JSON.stringify(girdi);
  const cikti = finansSekmeleri(girdi);
  cikti.forEach((x) => { x.label = "BOZULDU"; });
  t("girdi nesnesi değiştirilmiyor", JSON.stringify(girdi) === kopya);
  t("dönen sekmeler tanım tablosunun KOPYASI (dışarıdan bozulamıyor)",
    FINANS_SEKME_TANIMLARI.every((s) => s.label !== "BOZULDU"),
    JSON.stringify(FINANS_SEKME_TANIMLARI.map((s) => s.label)));
  /* "true değilse kapalı": `"evet"`, `1` gibi doğruya yakın değerler izin AÇMAZ. */
  t('izin "true" değilse açılmıyor (1 ve "evet" yetmez)',
    finansMenudeMi({ finans: 1, odemeTakvimi: "evet" }) === false);
  /* Yönetici bayrağı tek başına bir şey AÇMAZ — izinsiz yöneticiye de sekme yok. */
  t("yalnızca yonetici:true izin açmıyor",
    finansSekmeleri({ yonetici: true }).length === 0,
    JSON.stringify(adlar({ yonetici: true })));
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bir bölüm `await` edilmezse ya da `bolum()` çağrısı silinirse test hiçbir şey ölçmeden
 * 0 ile çıkar — koşucu da yakalayamaz (çıkış kodu 0, ✗ yok). Bu yaşandı (t95).
 * KONTROL EKLERKEN BU SAYIYI DA ARTIR. */
const BEKLENEN = 24;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
