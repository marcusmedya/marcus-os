/**
 * VİDEO YÖNÜ VE OYNATICI KUTUSUNUN ORANI.
 *
 * NEDEN lib/ ALTINDA: burada bir hata yaşandı ve bir daha sessizce dönmemesi için
 * SINANABİLİR olması gerekiyor. React dosyasının içinde kalsaydı Node testinden
 * çağrılamazdı — bu projede aynı sebeple `pano-suzgeci.js` de buraya taşındı.
 */

export const VIDEO_YONLERI = [
  { key: "dikey", label: "Dikey (Reels/Story)", oran: "9 / 16", maxGenislik: 340 },
  { key: "kare", label: "Kare (1:1)", oran: "1 / 1", maxGenislik: 440 },
  { key: "yatay", label: "Yatay (16:9)", oran: "16 / 9", maxGenislik: 640 },
];

export const videoYonuBul = (yon) => VIDEO_YONLERI.find((y) => y.key === yon) || VIDEO_YONLERI[0];

/**
 * OYNATICI KUTUSUNUN ORANI — İLK KAREDEN İTİBAREN DOĞRU.
 *
 * `<video>` etiketine oran verilmediğinde, metadata gelene kadar kutunun boyunu POSTER
 * görseli belirliyor. Drive'ın küçük resmi çoğu zaman yatay olduğu için dikey bir Reels
 * önce YATAY açılıyor, metadata gelince dikeye atlıyordu — sahada görülen "önce yatay
 * çıkıyor sonra dikeye dönüyor" tam olarak buydu.
 *
 * Gerçek oran gelene kadar kartın KAYITLI yönü kullanılıyor (varsayılan dikey: içeriğin
 * çoğu Reels). Metadata gelince gerçek oran devralıyor; yön yanlış girilmiş olsa bile
 * sonuç doğru, yalnızca ilk saniyede kutu bir kez düzeliyor.
 */
export function oynaticiOrani(oran, yon) {
  if (oran && Number.isFinite(oran) && oran > 0) return String(oran);
  return videoYonuBul(yon).oran;
}


/**
 * OYNATICI HATASININ İNSAN DİLİNDEKİ KARŞILIĞI.
 *
 * `<video>` başarısız olduğunda ekran SESSİZCE siyah kalıyordu; ne kullanıcı ne de
 * geliştirici ne olduğunu görebiliyordu. Üç tur boyunca "neden oynamıyor" sorusu
 * tahminle cevaplandı. Kod tarayıcıdan geliyor (MediaError.code).
 */
export const VIDEO_HATA_KODLARI = {
  1: "Yükleme yarıda kesildi.",
  2: "Ağ hatası — video indirilemedi.",
  3: "Video çözümlenemedi (dosya bozuk ya da bu tarayıcı bu biçimi açamıyor).",
  4: "Bu video kaynağı açılamadı (bağlantının süresi dolmuş ya da dosya bulunamıyor).",
};

export function videoHataMesaji(kod) {
  return VIDEO_HATA_KODLARI[kod] || "Video oynatılamadı.";
}
