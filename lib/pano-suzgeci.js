/**
 * OPERASYON PANOSU SÜZGECİ — kategori + marka.
 *
 * Pano on yedi markanın kartlarını birlikte gösteriyordu; tek bir markanın işini
 * takip etmek gözle ayıklamak demekti.
 *
 * Mantık `lib/` altında, çünkü test edilebilir olması gerekiyor: arayüzün içinde
 * kalsaydı test onun bir KOPYASINI sınardı ve kopya ile gerçek kod ayrıştığında
 * test bunu fark etmezdi — bu, bu projede bir kez yaşandı ve kırma ölçümünde
 * "0 düştü" olarak görüldü.
 */

const kucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/**
 * @param isler       tüm kartlar
 * @param kategori    seçili kategori
 * @param marka       seçili marka adı ("" = tümü)
 * @param kategoriler tanınan kategori listesi (bilinmeyen kategori Video sayılır)
 */
export function panoSuzgeci(isler, kategori, marka, kategoriler) {
  const taninan = Array.isArray(kategoriler) ? kategoriler : [];
  const kategoriIsleri = (isler || []).filter((j) =>
    j && (taninan.includes(j.kategori) ? j.kategori : "Video") === kategori);

  const panoIsleri = marka
    ? kategoriIsleri.filter((j) => kucult(j.marka) === kucult(marka))
    : kategoriIsleri;

  /* SEÇİCİDE YALNIZCA BU KATEGORİDE KARTI OLAN MARKALAR. On yedi markalık bir
   * listede on beşi boşsa süzgeç işe yaramıyor. Markası girilmemiş kart panoda
   * görünmeye devam eder, yalnızca seçiciye girmez. */
  const sayac = new Map();
  kategoriIsleri.forEach((j) => {
    const ad = String(j.marka || "").trim();
    if (ad) sayac.set(ad, (sayac.get(ad) || 0) + 1);
  });
  const panoMarkalari = [...sayac.entries()]
    .map(([ad, adet]) => ({ ad, adet }))
    .sort((a, b) => a.ad.localeCompare(b.ad, "tr"));

  /* SEÇİLİ MARKA, O KATEGORİDE KARTI OLMASA BİLE LİSTEDE KALIR. Düşerse seçim
   * sessizce kaybolur ve kullanıcı "süzgeci ben mi kapattım" diye düşünür. */
  if (marka && !panoMarkalari.some((x) => kucult(x.ad) === kucult(marka))) {
    panoMarkalari.unshift({ ad: marka, adet: 0 });
  }

  return { panoIsleri, panoMarkalari, kategoriSayisi: kategoriIsleri.length };
}
