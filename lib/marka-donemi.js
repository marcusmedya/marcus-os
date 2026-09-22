/**
 * MARKANIN ÇALIŞMA DÖNEMİ — "bu marka o ay çalışıyor muydu / çalışacak mı?"
 *
 * ----------------------------------------------------------------------------
 * NEDEN VAR
 *
 * Müşteri kaydında `baslangic` (başlangıç ayı) vardı ama BİTİŞ AYI YOKTU. `durum`
 * ("aktif" / "yeni" / "donduruldu" / "ayrildi") tarihsizdir ve işaretlendiği ANDA
 * geçerli olur. Sonuç, sahada şu çıkmazdı:
 *
 *   Eylül'de çalışan, Ekim'de çalışmayacak bir markayı BUGÜN işaretlemenin doğru
 *   yolu yok. "aktif" bırakırsan Ekim tahmini şişer; "ayrildi" yaparsan Eylül geliri
 *   de düşer. Yani kullanıcı ya geleceği ya geçmişi yanlış göstermek zorunda kalıyordu.
 *
 * `bitisAyi` alanı tam olarak bu boşluk için eklendi: **ne zamana kadar çalışılacağı**
 * bir TARİH olarak kayıtlı, durum ise yine anlık bir etiket.
 *
 * ----------------------------------------------------------------------------
 * ÜÇ KURAL — sırası önemli
 *
 * 1. `baslangic`tan ÖNCEKİ ay → hayır. (Ekstre ve `lib/aylik-ozet.js` de bu kuralda.)
 * 2. `bitisAyi` DOLUYSA tarih kazanır: bitiş ayına kadar (DAHİL) evet, sonrası hayır —
 *    `durum` ne olursa olsun. Kullanıcı "15 Ekim'de bitiyor" dediyse Ekim çalışılan
 *    bir aydır; markayı bugünden "ayrildi" işaretlemiş olması Ekim'i silmemeli.
 * 3. `bitisAyi` BOŞSA **bugünkü davranış birebir korunur**: `donduruldu` / `ayrildi`
 *    ise aktif sayılmaz, değilse sayılır. Alanı hiç kullanmayan bir belgede bu modül
 *    hiçbir şeyi değiştirmez — geriye dönük uyumluluk bu maddede duruyor.
 *
 * ----------------------------------------------------------------------------
 * KAPSAM DIŞI — bilerek
 *
 * GEÇMİŞ ay hesabına (`lib/aylik-ozet.js` → `markaAktifMiydi`) DOKUNULMADI. Orası
 * "kanıt yoksa tahakkuk yazma" kuralıyla çalışıyor (o ay ödeme kaydı varsa evet).
 * `bitisAyi` o kuralı da iyileştirebilir — ama o AYRI bir iş: geçmiş aylardaki
 * tahakkuk rakamlarını değiştirir ve bu değişiklikte hiçbir mevcut tutar değişmiyor.
 *
 * SAF: `new Date` YOK — ay her zaman parametre olarak gelir. Girdi DEĞİŞTİRİLMEZ.
 */
import { ayNormalle } from "./aylik-ozet.js";

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();

/** Markanın normalleştirilmiş bitiş ayı ("YYYY-AA") ya da `null` (boşsa/bozuksa). */
export function markaninBitisAyi(client) {
  if (!client) return null;
  return ayNormalle(client.bitisAyi);
}

/** Markanın normalleştirilmiş başlangıç ayı ("YYYY-AA") ya da `null`. */
export function markaninBaslangicAyi(client) {
  if (!client) return null;
  return ayNormalle(client.baslangic);
}

/**
 * Marka verilen ayda çalışıyor (ya da çalışacak) mı?
 *
 * @param client müşteri kaydı
 * @param ay     "YYYY-AA"
 * @returns {boolean} — ay çözülemezse `false` (fail-close: uydurma dönem üretilmez)
 */
export function markaAydaAktifMi(client, ay) {
  const a = ayNormalle(ay);
  if (!a || !client) return false;

  const bas = markaninBaslangicAyi(client);
  if (bas && a < bas) return false;

  /* BİTİŞ AYI VARSA TARİH KAZANIR — durum etiketi anlıktır, tarih değildir. */
  const bitis = markaninBitisAyi(client);
  if (bitis) return a <= bitis;

  /* BİTİŞ AYI YOKSA BUGÜNKÜ DAVRANIŞ. Bu satır değişirse `bitisAyi` girilmemiş
   * bütün markaların davranışı değişir — geriye dönük uyumluluğun tamamı burada. */
  const durum = metin(client.durum);
  return durum !== "donduruldu" && durum !== "ayrildi";
}

/**
 * Verilen ayda çalışan markalar. Yeni dizi döner; girdi dizisi ve kayıtlar değişmez.
 */
export function aydaAktifMarkalar(clients, ay) {
  return (Array.isArray(clients) ? clients : []).filter((c) => markaAydaAktifMi(c, ay));
}

/**
 * Bitiş ayı GİRİLMEMİŞ markalar — "süresiz sayıldı" uyarısının kaynağı.
 * Tahminde eksik veriyi gizlememek için kullanılıyor.
 */
export function bitisAyiGirilmemisler(clients, ay) {
  return aydaAktifMarkalar(clients, ay).filter((c) => markaninBitisAyi(c) === null);
}
