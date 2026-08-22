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
    if (!izlenir) return asilFetch(girdi, ayar);

    /* AĞ HATASINDA TEKRAR DENEME — YALNIZCA İŞLEM KİMLİĞİ TAŞIYAN İSTEKLERDE.
     *
     * Bu kural bu dosyadaki en önemli satır. Ağ koptuğunda kaybolan şey YANIT'tır,
     * İSTEK DEĞİL: istek sunucuya ulaşmış ve uygulanmış olabilir, biz sonucu
     * göremiyoruzdur. Körü körüne tekrar göndermek o durumda aynı işlemi İKİNCİ KEZ
     * uygular — stok iki artar, ödeme iki kez eklenir.
     *
     * İşlem kimliği taşıyan istekte bu tehlike yok: sunucu aynı kimliği ikinci kez
     * görürse uygulamaz, ilk seferki sonucu döndürür. Bu yüzden ağ tekrarı fazların
     * SONUNA bırakıldı — kimlik korumaları olmadan güvenli değildi.
     *
     * Kimliği olmayan istekler (örneğin belge kaydı) tekrar DENENMİYOR. Belge kaydı
     * zaten bir durum bildirimi ve bir sonraki değişiklikte yeniden gönderiliyor;
     * ekranda "kaydetme hatası" görünüyor. */
    const kimlikli = istekKimlikTasiyorMu(ayar);

    for (let deneme = 0; ; deneme += 1) {
      let yanit;
      try {
        yanit = await asilFetch(girdi, ayar);
      } catch (agHatasi) {
        if (!kimlikli || deneme >= MESGUL_BEKLEMELERI.length) throw agHatasi;
        await new Promise((coz) => setTimeout(coz, MESGUL_BEKLEMELERI[deneme]));
        continue;
      }
      if (deneme < MESGUL_BEKLEMELERI.length && (await bizimMesgulYanitimizMi(yanit))) {
        await new Promise((coz) => setTimeout(coz, MESGUL_BEKLEMELERI[deneme]));
        continue;
      }
      return yanit;
    }
  };
  return true;
}

/**
 * İstek gövdesinde işlem kimliği var mı?
 *
 * Kimlik yoksa ağ hatasında tekrar denemek güvenli değil (istek uygulanmış olabilir).
 * Gövde metin değilse (dosya yüklemesi gibi) ya da çözümlenemiyorsa kimliksiz sayılır —
 * belirsizlikte tekrar etmemek doğru taraf.
 */
export function istekKimlikTasiyorMu(ayar) {
  const govde = ayar && ayar.body;
  if (typeof govde !== "string") return false;
  try {
    const cozulmus = JSON.parse(govde);
    return Boolean(cozulmus && typeof cozulmus.islemId === "string" && cozulmus.islemId.length >= 8);
  } catch (e) {
    return false;
  }
}

/**
 * SADECE KENDİ "MEŞGUL" YANITIMIZI TEKRAR DENE.
 *
 * Yalnızca durum koduna bakmak yeterli değil: 503'ü barındırma katmanı da döndürebilir
 * (fonksiyon yanıt vermedi, dağıtım duraklatıldı gibi). O durumda isteğin sunucuda
 * KISMEN uygulanmış olma ihtimali vardır — körü körüne tekrar göndermek aynı işlemi iki
 * kez uygulayabilirdi (örneğin aynı ödeme kaydının iki kez eklenmesi).
 *
 * Bizim meşgul yanıtımız ise hiçbir şey yazılmadan ÖNCE dönüyor ve gövdesinde
 * `mesgul: true` taşıyor. Tekrar göndermek yalnızca bu imzayı gördüğümüzde güvenli.
 * Gövde okunamıyorsa tekrar DENEMİYORUZ — güvenli taraf budur.
 */
async function bizimMesgulYanitimizMi(yanit) {
  if (!yanit || yanit.status !== MESGUL_KOD) return false;
  if (typeof yanit.clone !== "function") return false;
  try {
    const govde = await yanit.clone().json();
    return Boolean(govde && govde.mesgul === true);
  } catch (e) {
    return false;   // 503 ama bizim yanıtımız değil
  }
}
