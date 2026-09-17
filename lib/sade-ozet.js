/**
 * SADE ÖZET — muhasebe bilmeyen birinin okuyup anlayacağı cümleler.
 *
 * NEDEN: Finans ekranı doğru rakamları gösteriyordu ama hangisinin ne demek olduğunu
 * hiçbir yerde yazmıyordu. "Bu ay kazanç" ile "Kasada" yan yana duruyor, tutmuyorlar ve
 * sebebi yazmıyor — kullanıcı haklı olarak "kafam karışıyor" dedi.
 *
 * KURAL: MUHASEBE TERİMİ KULLANILMAZ. "Tahakkuk", "cari", "mutabakat" gibi kelimeler
 * burada geçmez. Karşılıkları: *hak ettiğin* · *tahsil ettiğin* · *bekleyen* · *harcadığın*.
 *
 * İKİNCİ KURAL: RAKAM UYDURULMAZ, EKSİKLİK SÖYLENİR. Bir rakam eksik hesaplanıyorsa
 * (ücreti girilmemiş freelancer işi gibi) cümle bunu açıkça söyler. Eksik bir rakamı tam
 * gibi sunmak, hiç göstermemekten kötüdür — kullanıcı ona bakıp karar veriyor.
 *
 * SAF: ağ yok, yan etki yok. Para biçimlendirme ÇAĞIRANA bırakılıyor (`bicim`), çünkü
 * uygulamada Gizlilik Modu var ve tutarlar "₺ •••" gösterilebiliyor.
 */

const sayi = (x) => Number(x) || 0;

/** Varsayılan biçim — çağıran `fmt` verirse o kullanılır (Gizlilik Modu'na uyar). */
const varsayilanBicim = (n) => `${Math.round(sayi(n)).toLocaleString("tr-TR")} ₺`;

/**
 * "Bu ay ne oldu" — sırayla okunan cümleler.
 *
 * @param live    `computeLive` çıktısı
 * @param markaSayisi kaç aktif marka
 * @param bicim   para biçimlendirici (varsayılan: "12.345 ₺")
 *
 * @returns [{ tur, metin }] — `tur`: "gelir" | "tahsilat" | "bekleyen" | "gider" | "sonuc" | "uyari"
 */
export function buAyinCumleleri({ live, markaSayisi, bicim = varsayilanBicim } = {}) {
  const L = live || {};
  const p = (n) => bicim(sayi(n));
  const cumleler = [];

  const ciro = sayi(L.ciro);
  const tahsil = sayi(L.tahsilEdilen);
  const bekleyen = sayi(L.bekleyenToplam);
  const gider = sayi(L.gider);
  const net = sayi(L.net);

  cumleler.push({
    tur: "gelir",
    metin: markaSayisi
      ? `Bu ay ${markaSayisi} markadan ${p(ciro)} hak ettin.`
      : `Bu ay ${p(ciro)} hak ettin.`,
  });

  /* TAHSİLAT AYRI CÜMLE: "hak etmek" ile "almak" aynı şey değil ve bu ayrımın
   * anlaşılmaması, kafa karışıklığının ana kaynağıydı. */
  if (tahsil >= ciro && ciro > 0) {
    cumleler.push({ tur: "tahsilat", metin: `Tamamını tahsil ettin — bekleyen alacağın yok.` });
  } else {
    cumleler.push({ tur: "tahsilat", metin: `${p(tahsil)}'sini tahsil ettin.` });
    if (bekleyen > 0) {
      cumleler.push({ tur: "bekleyen", metin: `${p(bekleyen)} hâlâ bekliyor.` });
    }
  }

  cumleler.push({ tur: "gider", metin: `Bu ay ${p(gider)} gider yazdın.` });

  cumleler.push({
    tur: "sonuc",
    metin: net >= 0
      ? `Geriye ${p(net)} kaldı.`
      : `Bu ay ${p(Math.abs(net))} zarardasın.`,
  });

  /* EKSİK VERİ SÖYLENİR — sessiz kalmak gideri düşük, kârı yüksek gösterir. */
  if (sayi(L.isUcretiEksik) > 0) {
    cumleler.push({
      tur: "uyari",
      metin: `Dikkat: ${L.isUcretiEksik} işte freelancer ücreti girilmemiş, sıfır sayıldı. `
        + `Gerçek giderin bundan yüksek, kârın daha düşük.`,
    });
  }

  return cumleler;
}

/**
 * "Kasada" ile "kâr" neden tutmuyor — tek cümlelik açıklama.
 * Bu iki rakam farklı soruların cevabı ve yan yana durdukları için sürekli karşılaştırılıyor.
 */
export function kasaKarFarki({ kasa, net, bicim = varsayilanBicim } = {}) {
  const fark = sayi(kasa) - sayi(net);
  return {
    fark,
    metin: `Kasadaki para (${bicim(sayi(kasa))}) ile bu ayın kârı (${bicim(sayi(net))}) `
      + `aynı şey değil: kasa geçmişten bugüne biriken NAKİT, kâr ise yalnızca BU AYIN hesabı. `
      + `Birbirini tutmaları beklenmez.`,
  };
}

/** Bir ay satırının tek cümlelik okunuşu (Ay Ay Karşılaştırma tablosunda). */
export function ayCumlesi(satir, bicim = varsayilanBicim) {
  const r = satir || {};
  const fark = sayi(r.fark);
  if (fark > 0) return `${bicim(sayi(r.tahakkuk))} hak ettin, ${bicim(sayi(r.tahsilat))} aldın — ${bicim(fark)} bekliyor.`;
  if (fark < 0) return `${bicim(sayi(r.tahakkuk))} hak ettin, ${bicim(sayi(r.tahsilat))} aldın — ${bicim(Math.abs(fark))} fazla tahsilat (önceki aylardan olabilir).`;
  return `${bicim(sayi(r.tahakkuk))} hak ettin, tamamını aldın.`;
}
