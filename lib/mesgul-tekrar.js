/**
 * "SİSTEM MEŞGUL" DURUMUNDA OTOMATİK TEKRAR DENEME
 *
 * Sunucu, yazma kilidini alamadığında artık kilitsiz yazmıyor; isteği 503 ile reddediyor
 * (bkz. lib/kv-yaz.js). Bu, sessiz veri kaybını bitirir — ama tek başına bırakılırsa
 * kullanıcı yoğun anlarda "kaydedilemedi" hatası görürdü.
 *
 * Bu dosya o boşluğu kapatır: /api/ altına giden bir istek 503 alırsa, tarayıcı kısa bir
 * bekleyişten sonra AYNI isteği kendiliğinden tekrar gönderir. Kullanıcı çoğu zaman
 * hiçbir şey fark etmez.
 *
 * TEKRAR GÖNDERMEK NEDEN GÜVENLİ:
 * 503 yanıtı, sunucunun HİÇBİR ŞEY YAZMADAN önce döndürdüğü tek yanıttır — kilit
 * alınamadıysa okuma/değiştirme/yazma bloğuna hiç girilmez. Yani yarım kalmış bir işlem
 * yoktur; isteği tekrar göndermek "iki kez uygulanma" riski taşımaz.
 *
 * 61 ayrı fetch çağrısını tek tek sarmalamak yerine tek yerden kuruluyor: yeni bir çağrı
 * eklendiğinde kimsenin bir şey hatırlaması gerekmesin.
 */

/* Beklemeler ms. Sunucu kilidi ~3 sn deniyor; buradaki beklemeler onun üstüne biner. */
export const MESGUL_BEKLEMELERI = [800, 2200];
export const MESGUL_KOD = 503;

export function tekrarDenemeyiKur(kap) {
  const g = kap || (typeof globalThis !== "undefined" ? globalThis : null);
  if (!g || typeof g.fetch !== "function") return false;
  if (g.__mesgulTekrarKuruldu) return false;   // iki kez sarmalama
  const asilFetch = g.fetch.bind(g);
  g.__mesgulTekrarKuruldu = true;

  g.fetch = async function mesgulFarkindaFetch(girdi, ayar) {
    /* Sadece string URL'li kendi API çağrılarımız. Request nesnesi verilmişse gövdesi
     * ilk okumada tükenir — onu tekrar göndermek bozuk istek üretirdi, dokunmuyoruz. */
    const izlenir = typeof girdi === "string" && girdi.indexOf("/api/") === 0;
    let yanit = await asilFetch(girdi, ayar);
    if (!izlenir) return yanit;

    for (let i = 0; i < MESGUL_BEKLEMELERI.length; i++) {
      if (!yanit || yanit.status !== MESGUL_KOD) break;
      await new Promise((coz) => setTimeout(coz, MESGUL_BEKLEMELERI[i]));
      yanit = await asilFetch(girdi, ayar);
    }
    return yanit;
  };
  return true;
}
