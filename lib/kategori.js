/**
 * KATEGORİLER — TEK KAYNAK.
 *
 * Sistem üç içerik biçimi tanıyor: REELS · POST · CAROUSEL. Eskiden dört kategori
 * vardı (Video / Fotoğraf / Carousel / Grafik Tasarım) ve stok altı türde tutuluyordu;
 * ikisi ayrı listelerdi ve aralarındaki çeviri koda dağılmıştı.
 *
 * ESKİ KAYITLARA DOKUNULMUYOR. Belgede hâlâ "Video", "Fotoğraf", "Grafik Tasarım"
 * yazan yüzlerce kart var; onları toplu dönüştürmek geri dönüşü olmayan bir yazma
 * olurdu. Bunun yerine eşleme OKUMA ANINDA yapılıyor: kayıt eski adı taşımaya devam
 * eder, sistem her yerde yeni adı görür. Kart normal akışında kaydedildiğinde kategorisi
 * kendiliğinden yeni ada döner.
 *
 * SAF: ağ yok, yan etki yok — hem tarayıcı hem sunucu aynı dosyayı kullanıyor.
 */

/** Operasyon sekmeleri ve stok satırları — ikisi de bu liste. */
export const KATEGORILER = ["Reels", "Post", "Carousel"];

/**
 * Eski kategori adları → yeni.
 *
 * Grafik Tasarım POST'a katılıyor: tasarım işleri de tek görsellik gönderi. Çoklu
 * görsel Carousel'in işi — ikisi de çoklu olduğunda "kaydırmalı gönderi mi, ayrı
 * postlar mı" ayrımı kaybolur ve stok yanlış türe yazılır.
 */
export const ESKI_KATEGORILER = {
  "Video": "Reels",
  "Fotoğraf": "Post",
  "Grafik Tasarım": "Post",
  "Carousel": "Carousel",
};

/** Eski stok türleri → yeni. Story ayrı bir stok satırı değil artık: o ikinci bir
 * içerik değil, aynı gönderinin story boyutu — kartta zaten kendi yuvası var. */
export const ESKI_TURLER = {
  "Video": "Reels",
  "Reels": "Reels",
  "Görsel": "Post",
  "Story": "Post",
  "Tasarım": "Post",
  "Post": "Post",
  "Carousel": "Carousel",
};

/**
 * Bir kategoriyi yeni ada çevirir.
 *
 * TANINMAYAN VE BOŞ DEĞER REELS SAYILIR — eski davranışın aynısı (`|| ASAMALAR_VIDEO`).
 * Belgede kategorisi HİÇ OLMAYAN kartlar var; onlar her şeyin video olduğu dönemden
 * kalma. Post sayılsalardı aşamaları ("Edit Bekliyor", "Dosyalar Aktarıldı") Post
 * listesinde bulunmadığı için onarım kartları akışın BAŞINA çekerdi — süren işler
 * panoda sıfırlanırdı.
 */
export function kategoriEsle(kategori) {
  const k = String(kategori || "").trim();
  if (KATEGORILER.includes(k)) return k;
  return ESKI_KATEGORILER[k] || "Reels";
}

/** Bir stok türünü yeni ada çevirir. */
export function turEsle(tur) {
  const t = String(tur || "").trim();
  if (KATEGORILER.includes(t)) return t;
  return ESKI_TURLER[t] || "Post";
}

/** Bu kategori artık kullanılmayan eski bir ad mı? */
export function eskiKategoriMi(kategori) {
  const k = String(kategori || "").trim();
  return Boolean(k) && !KATEGORILER.includes(k) && Boolean(ESKI_KATEGORILER[k]);
}
