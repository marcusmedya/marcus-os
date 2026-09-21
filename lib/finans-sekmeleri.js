/**
 * FİNANS SEKMELERİ — kimin hangi sekmeyi göreceği, TEK yerde.
 *
 * Neden ayrı bir saf modül:
 *
 * "Ödeme Takvimi" bir süre AYRI bir menü maddesiydi ve yalnızca `odemeTakvimi` izni olup
 * `finans` izni OLMAYAN personel için duruyordu — o kişi kaldırılsaydı ekrana hiç
 * ulaşamazdı. Menüde iki madde, izinde iki kapı, çizimde iki yer (yönetici + personel
 * kabuğu): kural dört parçaya dağılmıştı ve hiçbiri Node'dan çağrılamıyordu.
 *
 * Artık menüde TEK "Finans" maddesi var; içindeki sekmeler kişinin iznine göre çiziliyor.
 * Kural JSX'e GÖMÜLMEDİ (`marcus-mimari` §4: gömülen kural hiçbir testten çağrılamaz),
 * burada duruyor ve iki kabuk da buradan okuyor.
 *
 * ÜÇ KURAL:
 *
 * 1. **Kimse yetki kazanmaz, kimse erişim kaybetmez.** `odemeTakvimi` izni olan kişi
 *    Finans maddesini GÖRÜR (yoksa ekrana hiç ulaşamaz), ama yalnızca Ödemeler sekmesini.
 *    `finans` izni olan kişi Ödemeler sekmesini GÖRMEZ — ödeme kayıtları ayrı bir izin.
 * 2. **Fail-close.** İzin açıkça `true` değilse sekme çizilmez; bilinmeyen bir izin adı
 *    taşıyan sekme de çizilmez.
 * 3. **Gizli sekme bir güvenlik sınırı DEĞİLDİR** (`marcus-yetki`). Burası yalnızca
 *    "kime ne gösteriliyor" katmanı; verinin kime gittiği `api/data.js` →
 *    `PERMISSION_DATA_FIELDS` ile belirleniyor ve bu dosya ona dokunmaz.
 */

/** Sekme tanımları. `izin` alanı bu sekmeyi AÇAN izin adıdır. */
export const FINANS_SEKME_TANIMLARI = [
  { key: "ozet", label: "Özet", izin: "finans" },
  { key: "gelir-gider", label: "Gelir-Gider", izin: "finans" },
  { key: "karsilastirma", label: "Ay Ay Karşılaştırma", izin: "finans" },
  /* ÖDEMELER = eski "Ödeme Takvimi" ekranı, sekme hâlinde. Kapısı `odemeTakvimi`:
   * Finans'ı görebilen herkes ödeme kayıtlarını görmemeli. */
  { key: "tahsilat", label: "Ödemeler", izin: "odemeTakvimi" },
  { key: "raporlar", label: "Raporlar (PDF)", izin: "finans" },
  { key: "hesaplar", label: "Hesaplar", izin: "finans" },
  { key: "vergi", label: "Vergi & Arşiv", izin: "finans" },
  /* YÖNETİCİYE ÖZEL. Doğrulama ekranı belgenin BÜTÜN para kayıtlarını (her markanın
   * tahsilatı, her personelin maaşı, her hesabın bakiyesi) tek tabloda topluyor;
   * Finans'ı görebilen her personel bunu görmemeli. Bugünkü davranış — değişmedi. */
  { key: "dogrulama", label: "Doğrulama", izin: "finans", yalnizcaYonetici: true },
];

/** Bu sekmeyi açan iznin adı. Bilinmeyen izin → hiç kimse. */
function izinAcikMi(sekme, izinler) {
  if (sekme.izin === "finans") return izinler.finans === true;
  if (sekme.izin === "odemeTakvimi") return izinler.odemeTakvimi === true;
  return false;
}

/**
 * Kişinin göreceği sekmeler, tanım sırasında.
 *
 * @param {{finans?:boolean, odemeTakvimi?:boolean, yonetici?:boolean}} izinler
 * @returns {Array<{key:string,label:string}>} yeni dizi — girdi DEĞİŞTİRİLMEZ
 */
export function finansSekmeleri(izinler) {
  const i = izinler || {};
  return FINANS_SEKME_TANIMLARI.filter((s) => {
    if (s.yalnizcaYonetici && i.yonetici !== true) return false;
    return izinAcikMi(s, i);
  }).map((s) => ({ key: s.key, label: s.label }));
}

/**
 * Menüde "Finans" maddesi çizilsin mi.
 *
 * Tek ölçüt: kişinin görebileceği EN AZ BİR sekme var mı. `finans` izni olmayıp yalnızca
 * `odemeTakvimi` izni olan personel de `true` alır — aksi hâlde o kişi ödeme ekranına
 * hiç ulaşamaz ve bu iş TAM OLARAK bunu önlemek için yapıldı.
 */
export function finansMenudeMi(izinler) {
  return finansSekmeleri(izinler).length > 0;
}

/**
 * Seçili sekme artık görünmüyorsa (izin değişti, ya da kişi hiç göremeyeceği bir sekmeyi
 * hatırlıyor) ilk görünür sekmeye düşer. Hiç sekme yoksa `null`.
 *
 * Durum SIFIRLANMAZ, TÜRETİLİR: `setState` ile düzeltmek render döngüsü açar ve bir an
 * için yanlış sekmeyi çizer.
 */
export function aktifFinansSekmesi(secili, sekmeler) {
  const liste = Array.isArray(sekmeler) ? sekmeler : [];
  if (liste.some((s) => s.key === secili)) return secili;
  return liste.length ? liste[0].key : null;
}
