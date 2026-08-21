/**
 * İŞLEM KİMLİĞİ — AYNI İŞLEM İKİ KEZ UYGULANMASIN
 *
 * NEDEN GEREKTİ: Marcus OS'ta iki ayrı yazma yolu var ve ikisi farklı davranıyor.
 *
 *   BELGE KAYDI (kart düzenleme, müşteri, finans) bir DURUM bildirimi: "şu alan şu hâle
 *   gelsin". Aynısını iki kez göndermek aynı sonucu verir; üstelik alan bazlı sürüm
 *   kontrolü ikinciyi zaten eler. Burada kimliğe gerek YOK ve eklenmedi.
 *
 *   EYLEM UÇLARI (stok değiştir, plan ekle, ödeme kaydı, talep) bir FARK bildirimi:
 *   "şunu bir artır", "şunu ekle". İki kez gönderilirse İKİ KEZ uygulanır. Ölçüldü:
 *   dokuz işlemin yedisi savunmasızdı — stok 10'dan 12'ye çıkıyor, ödeme kaydı iki kez
 *   ekleniyor, toggle ise geri alınıp SESSİZCE iptal oluyordu.
 *
 * ÇÖZÜM: istemci her işlem için benzersiz bir kimlik üretir. Sunucu, işlemi uygulamadan
 * önce "bu kimliği daha önce gördüm mü" diye bakar; gördüyse İŞLEMİ TEKRAR UYGULAMAZ ve
 * ilk seferki yanıtı döndürür. Kullanıcı açısından tekrar denemek zararsız hale gelir.
 *
 * İKİ KURAL — İKİSİ DE İHLAL EDİLİRSE DÜZELTMEK İSTEDİĞİMİZİN TERSİ OLUR:
 *
 *   1. KİMLİK YALNIZCA GERÇEKTEN YAZILDIYSA İŞARETLENİR. Kilit alınamayıp istek 503 ile
 *      reddedildiyse kimlik yazılmamalı; yazılırsa tarayıcının otomatik tekrarı "bunu
 *      zaten yaptım" sanılır ve işlem sessizce kaybolur.
 *   2. KONTROL YAZMAYLA AYNI KİLİDİN İÇİNDE OLMALI. Dışarıda yapılırsa iki hızlı tıklama
 *      aynı anda "görmedim" cevabı alır ve ikisi de uygulanır — korumanın hiç olmaması
 *      gibi.
 *
 * SÜRE: 24 saat. Gerçek tekrar denemeler saniyeler içinde olduğu için fazlasıyla yeterli.
 * Süre dolduktan sonra aynı kimlik yeniden uygulanır — bilinen ve kabul edilen davranış.
 */
import { kv } from "@vercel/kv";

const ONEK = "marcus-os-islem-";
export const ISLEM_OMRU_SN = 60 * 60 * 24;   // 24 saat

/**
 * KİMLİK BİÇİMİ SIKI DOĞRULANIR — bu bir güvenlik kontrolü.
 *
 * Kimlik tarayıcıdan geliyor ve doğrudan bir Redis anahtarına giriyor. Serbest bırakılsaydı
 * uydurulmuş bir kimlikle başka anahtarların üzerine yazılabilirdi (örneğin ana verinin
 * durduğu anahtar). Yalnızca harf, rakam, tire ve alt çizgi kabul ediliyor.
 */
export function kimlikGecerliMi(islemId) {
  return typeof islemId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(islemId);
}

export function islemAnahtari(islemId) {
  return kimlikGecerliMi(islemId) ? `${ONEK}${islemId}` : null;
}

/**
 * Bu kimlik daha önce uygulandı mı?
 * @returns null (görülmedi) | { kod, yanit } (görüldü — ilk seferki sonuç)
 */
export async function kayitliYanit(islemId) {
  const anahtar = islemAnahtari(islemId);
  if (!anahtar) return null;
  try {
    const kayit = await kv.get(anahtar);
    if (!kayit || typeof kayit !== "object") return null;
    return { kod: Number(kayit.kod) || 200, yanit: kayit.yanit };
  } catch (e) {
    /* Kimlik okunamadıysa işlemi ENGELLEME. Bu bir kolaylık katmanı; erişilemediğinde
     * sistem eski davranışına düşer (işlem uygulanır), durmaz. */
    return null;
  }
}

/**
 * Sonucu sakla. YALNIZCA BAŞARILI (2xx) yanıtlar saklanır.
 *
 * Hata yanıtları saklanmaz çünkü hepsi tekrar denenebilir olmalı: 503 zaten hiçbir şey
 * yazmadan dönüyor, 401 oturum tazelenince geçebilir, 409 bir sonraki turda çözülebilir.
 * Bunları saklamak, düzelen bir durumu kalıcı hataya çevirirdi.
 */
export async function yanitiSakla(islemId, kod, yanit) {
  const anahtar = islemAnahtari(islemId);
  if (!anahtar) return false;
  if (!(Number(kod) >= 200 && Number(kod) < 300)) return false;
  try {
    await kv.set(anahtar, { kod: Number(kod), yanit, zaman: Date.now() }, { ex: ISLEM_OMRU_SN });
    return true;
  } catch (e) {
    /* Saklanamadıysa işlem yine de geçerli — en kötü ihtimalle tekrar denemede bir daha
     * uygulanır, yani bugünkü davranışa düşeriz. Kaydı geri almak çok daha kötü olurdu. */
    return false;
  }
}

/**
 * Yanıtı yakalayan sarmalayıcı.
 *
 * Handler'ın kendi kilidini tuttuğu uçlarda (api/paylasim.js) kullanılıyor: handler
 * onlarca farklı yerden `res.status(...).json(...)` çağırıyor; her birine tek tek dokunmak
 * yerine yanıt tek noktadan yakalanıyor.
 *
 * `sakla` geri çağrısı YALNIZCA 2xx'te tetiklenir ve saklama işi kilit içinde bitsin diye
 * beklenebilir bir söz döndürür.
 */
export function yanitiYakala(res, sakla) {
  let sonKod = 200;
  const asilStatus = res.status.bind(res);
  const asilJson = res.json.bind(res);
  res.status = (kod) => { sonKod = kod; asilStatus(kod); return res; };
  res.json = (govde) => {
    if (sonKod >= 200 && sonKod < 300) {
      const sonuc = sakla(sonKod, govde);
      if (sonuc && typeof sonuc.catch === "function") sonuc.catch(() => {});
    }
    return asilJson(govde);
  };
  return res;
}

/** Test ve teşhis için — üretimde çağrılmıyor. */
export async function kimligiUnut(islemId) {
  const anahtar = islemAnahtari(islemId);
  if (!anahtar) return false;
  try { await kv.del(anahtar); return true; } catch (e) { return false; }
}
