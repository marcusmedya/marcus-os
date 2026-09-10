/**
 * PAYLAŞIM PLANINDA KART SEÇİCİ — hangi kart hangi türün altında çıkar.
 *
 * Plan hücresine tıklayınca önce TÜR seçiliyor (Reels · Post · Carousel), sonra o türe
 * bağlanacak kart. Seçici bir süre türü hiç dikkate almadı: "Post" seçildiğinde Reels
 * kartları da listeleniyordu ve marka yöneticisi listeden doğru içeriği gözle ayıklamak
 * zorunda kalıyordu (sahadan bildirildi). Kartın türü zaten `paylasimTuru` ile biliniyor —
 * eksik olan tek şey seçicinin ona bakmasıydı.
 *
 * TÜR TUTMAYAN KART GİZLENMİYOR, AYRILIYOR. Tür çoğu kartta ADDAN tahmin ediliyor
 * (`paylasimTuru`); yanlış tahmin edilen kart tamamen gizlenseydi hiçbir plana
 * bağlanamaz, kullanıcı da sebebini göremezdi. Bu yüzden ayrı ve soluk bir bölümde
 * duruyor — bilerek seçilebilir, yanlışlıkla seçilmesi zorlaşır.
 *
 * Modül SAF: veriyi değiştirmez, yalnızca üç liste döndürür. Kural burada duruyor çünkü
 * JSX içindeki bir koşul Node'dan çağrılamıyor ve bu projede aynı sınıftan beş hata çıktı.
 */

import { paylasimTuru } from "./stok.js";
import { SUBE_PAYLASIM_ASAMASI } from "./asamalar.js";

/** Kart bu türün altında mı? Tür verilmezse ayrım yapılmaz (eski davranış). */
export function turUyuyorMu(is, tur) {
  if (!tur) return true;
  return paylasimTuru(is) === tur;
}

const kucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/**
 * Seçicinin üç bölümü.
 *
 * @param isler        tüm kartlar
 * @param markaAd      seçilen markanın adı (kartlar markayı ADIYLA saklıyor)
 * @param tur          seçilen paylaşım türü
 * @param bagliIdler   bu şubede zaten planlanmış kart kimlikleri (Set ya da dizi)
 * @param subedeKullanilabilir  (is) => boolean — şube kapsamı süzgeci
 *
 * @returns { hazir, dahaOnce, baskaTur }
 *   hazir     — türü tutan, paylaşıma hazır kartlar (Onaylandı / Şubelerde Paylaşılıyor)
 *   dahaOnce  — türü tutan ama zaten paylaşılmış kartlar (Teslim Edildi)
 *   baskaTur  — kullanılabilir ama BAŞKA türde görünen kartlar
 */
export function seciciKartlari({ isler, markaAd, tur, bagliIdler, subedeKullanilabilir } = {}) {
  const bagli = bagliIdler instanceof Set ? bagliIdler : new Set(bagliIdler || []);
  const uygunMu = typeof subedeKullanilabilir === "function" ? subedeKullanilabilir : () => true;
  const marka = kucult(markaAd);

  const hazir = [];
  const dahaOnce = [];
  const baskaTur = [];

  (Array.isArray(isler) ? isler : []).forEach((j) => {
    if (!j) return;
    if (kucult(j.marka) !== marka) return;
    if (bagli.has(String(j.id))) return;

    /* "Şubelerde Paylaşılıyor" da hazır sayılıyor: içerik bir şubede kullanıldı ama
     * diğerlerinde hâlâ kullanılabilir. */
    const hazirMi = j.asama === "Onaylandı" || j.asama === SUBE_PAYLASIM_ASAMASI;
    const paylasilmisMi = j.asama === "Teslim Edildi";
    if (!hazirMi && !paylasilmisMi) return;

    if (!uygunMu(j)) return;

    if (!turUyuyorMu(j, tur)) { baskaTur.push(j); return; }
    (hazirMi ? hazir : dahaOnce).push(j);
  });

  return { hazir, dahaOnce, baskaTur };
}
