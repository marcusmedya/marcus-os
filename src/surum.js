/**
 * SÜRÜM SAYACI KÖPRÜSÜ.
 *
 * Uygulamanın tüm verisi tek bir JSON bloğunda tutuluyor ve her kaydın yanında bir sürüm
 * sayacı (_v) gidiyor. Sunucudaki sayaç tarayıcınınkinden farklıysa kayıt reddediliyor —
 * "başka bir cihazdan değişmiş" uyarısı çıkıyor ve ön yüz kullanıcının O ANKİ düzenlemesini
 * sunucu verisiyle eziyor.
 *
 * SORUN ŞUYDU: /api/manage-staff, /api/kasa, /api/client-payment gibi YARDIMCI uçlar da
 * KV'ye yazıp sayacı artırıyor. Yanıtları sayacı taşımayınca ya da taşıyıp kimse okumayınca
 * tarayıcı bir tur geride kalıyor; personel hesabı eklemek, sonra bir müşteriyi düzenlemek
 * o düzenlemeyi kaybettiriyordu. Sebep hiçbir ekranda görünmüyordu.
 *
 * NEDEN AYRI DOSYA: bu çağrıların çoğu App'in ana kapsamında değil, alt bileşenlerin içinde
 * (Şifre Kasası kartı, Personel Hesapları kartı…). Her birine setData'yı prop olarak
 * indirmek yerine tek bir bildirim noktası kullanılıyor. Alternatifi, her bileşene ayrı
 * bağlantı yazmaktı — biri unutulduğunda hata sessizce geri gelirdi.
 */

let dinleyici = null;

/** Uygulama açılışında bir kez kaydolur. */
export function surumDinle(fn) {
  dinleyici = typeof fn === "function" ? fn : null;
}

/**
 * Bir yanıtı geçirirken içindeki sürümü bildirir ve YANITI AYNEN döndürür.
 * Zincire `.then(surumBildir)` olarak eklenebilsin diye böyle: araya girmesi, çağıran
 * kodun geri kalanını değiştirmemeli.
 */
export function surumBildir(yanit) {
  if (yanit && typeof yanit._v === "number" && dinleyici) dinleyici(yanit._v);
  return yanit;
}
