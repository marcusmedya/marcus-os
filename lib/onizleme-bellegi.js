/**
 * ÖNİZLEME ÖNBELLEĞİ VE TAZELEME
 *
 * NEDEN AYRI DOSYA: burada tutulan mantık bir hataya sebep oldu ve o hatanın bir daha
 * sessizce dönmemesi için SINANABİLİR olması gerekiyor. React bileşeninin içinde kalsaydı
 * Node testinden çağrılamazdı.
 *
 * HATA NEYDİ: önbellek anahtarı `is:<kartId>:<slot>:<boyut>` idi — yani içerikle ilgili
 * hiçbir şey taşımıyordu. İki sonucu vardı:
 *
 *   1. Kart açıldığında henüz dosya yokken önizleme isteniyor, sunucu "dosya yok" diyordu.
 *      Sonra kullanıcı dosyayı yüklüyordu. Anahtar DEĞİŞMEDİĞİ için istek bir daha hiç
 *      yapılmıyordu: dosya Drive'da duruyor, kartta hiçbir zaman görünmüyordu. Sayfa
 *      yenilenene kadar. Kullanıcının gördüğü tam olarak buydu.
 *
 *   2. Aynı slota yeni versiyon yüklendiğinde önbellekteki ESKİ görsel dönüyordu; yeni
 *      dosya oturum boyunca hiç görünmüyordu.
 *
 * ÇÖZÜM: karta bir şey olduğunda (yükleme, silme, parça taşıma) o kartın önizlemeleri
 * geçersiz kılınır ve YALNIZCA o kartı dinleyen bileşenler yeniden ister. Tümünü birden
 * tazelemek olmaz: pano otuz kart gösterebiliyor ve bir zamanlar aynı anda otuz istek
 * uygulamanın kendi kaba kuvvet korumasını tetikleyip kullanıcıyı kilitledi.
 */

const bellek = new Map();
const dinleyiciler = new Set();

/** Kart önizlemelerinin anahtar öneki — tazeleme bu önekle siliyor. */
export function isOneki(isId) {
  return `is:${isId}:`;
}

export function onizlemeAnahtari({ isId, icerikId, alan, slot, boyut = 800 }) {
  if (isId !== undefined && isId !== null) return `${isOneki(isId)}${slot || ""}:${boyut}`;
  if (icerikId !== undefined && icerikId !== null) return `icerik:${icerikId}:${alan || ""}:${boyut}`;
  return null;
}

export function onizlemeOku(anahtar) {
  return anahtar ? bellek.get(anahtar) || null : null;
}

export function onizlemeYaz(anahtar, veri) {
  if (anahtar) bellek.set(anahtar, veri);
}

/** Test ve oturum kapanışı için — üretimde çağrılmıyor. */
export function bellegiBosalt() {
  bellek.clear();
}

export function bellekBoyutu() {
  return bellek.size;
}

/**
 * Bir kartın önizlemelerini geçersiz kıl.
 * Hem önbellekten siler hem de o kartı dinleyen bileşenlere haber verir — silmek tek
 * başına yetmez, çünkü bileşenin isteği yalnızca anahtarı değişince tekrarlanır.
 */
export function onizlemeyiTazele(isId) {
  if (isId === undefined || isId === null) return 0;
  const onek = isOneki(isId);
  let silinen = 0;
  for (const anahtar of [...bellek.keys()]) {
    if (anahtar.startsWith(onek)) { bellek.delete(anahtar); silinen += 1; }
  }
  for (const dinleyici of [...dinleyiciler]) {
    try { dinleyici(isId); } catch (e) { /* bir dinleyici patlarsa diğerleri çalışsın */ }
  }
  return silinen;
}

/**
 * SUNUCUYU BEKLEYEN TAZELEME.
 *
 * SORUN: dosya yüklenince önizleme hemen tazeleniyordu — ama kayıt 500 ms gecikmeli
 * gidiyor ve sunucu önizlemeyi VERİTABANINDAN okuyor. Yani tazeleme, medya kaydı sunucuya
 * ULAŞMADAN önce soruyor; sunucu haklı olarak "bu kartta dosya yok" diyor ve önizleme boş
 * kalıyordu. Dosya Drive'da duruyor, kartta sayfa yenilenene kadar görünmüyordu.
 *
 * Kayıtlar sıraya alındıktan sonra (bkz. App.jsx) kayıt daha da geç ulaşabiliyor, yani
 * yarış büyüdü.
 *
 * ÇÖZÜM: kart "sunucuyu bekliyor" diye işaretleniyor; kayıt sunucuya ulaştığında
 * `bekleyenleriTazele()` çağrılıp önizlemeler O AN yeniden isteniyor. Sabit bir gecikme
 * tahmini yerine gerçek olaya bağlanıyor.
 */
const sunucuyuBekleyenler = new Set();

export function sunucuyuBekle(isId) {
  if (isId === undefined || isId === null) return;
  sunucuyuBekleyenler.add(String(isId));
}

/** Kayıt sunucuya ulaştığında çağrılır. Bekleyen kartların önizlemesi yeniden istenir. */
export function bekleyenleriTazele() {
  if (sunucuyuBekleyenler.size === 0) return 0;
  const liste = [...sunucuyuBekleyenler];
  sunucuyuBekleyenler.clear();
  liste.forEach((isId) => onizlemeyiTazele(isId));
  return liste.length;
}

export function bekleyenSayisi() {
  return sunucuyuBekleyenler.size;
}

export function tazelemeyiDinle(dinleyici) {
  dinleyiciler.add(dinleyici);
  return () => { dinleyiciler.delete(dinleyici); };
}

export function dinleyiciSayisi() {
  return dinleyiciler.size;
}


/* ================================================================
 * VİDEO ADRESİ ÖNBELLEĞİ
 *
 * Video adresi (imzalı jeton içeren) her kart açılışında sunucudan yeniden isteniyordu:
 * bir tur ağ gecikmesi ARTI sunucuda tüm belgenin okunması — ve bunların hepsi video
 * daha başlamadan önce. Adres artık saatlik ızgaraya oturduğu için (bkz.
 * `lib/video-jeton.js`) aynı saat içinde aynı; saklanabilir.
 *
 * AYNI `is:<id>:` ÖNEKİNİ KULLANIYOR — bu bilerek: kart yükleme/silme yaptığında
 * `onizlemeyiTazele` önekle temizliyor ve adres de düşüyor. Düşmeseydi yeni versiyon
 * yüklendikten sonra ESKİ dosyanın adresi oynatılırdı; jeton dosya kimliğini taşıdığı
 * için bu gerçek bir hata olurdu.
 *
 * ÖMÜR jetonun en kısa ömrünün ALTINDA (30 dk < 1 saat): önbellekten süresi dolmuş bir
 * adres çıkıp oynatıcı sessizce boş kalmasın.
 * ================================================================ */
const ADRES_OMRU_MS = 30 * 60 * 1000;

export function videoAdresAnahtari({ isId, icerikId, alan, slot }) {
  if (isId !== undefined && isId !== null) return `${isOneki(isId)}${slot || ""}:video`;
  if (icerikId !== undefined && icerikId !== null) return `icerik:${icerikId}:${alan || ""}:video`;
  return null;
}

export function videoAdresOku(anahtar, simdi = Date.now()) {
  if (!anahtar) return null;
  const kayit = bellek.get(anahtar);
  if (!kayit || typeof kayit !== "object" || !kayit.adres) return null;
  if (!(kayit.biter > simdi)) { bellek.delete(anahtar); return null; }
  return kayit.adres;
}

export function videoAdresYaz(anahtar, adres, simdi = Date.now()) {
  if (!anahtar || !adres) return;
  bellek.set(anahtar, { adres, biter: simdi + ADRES_OMRU_MS });
}
