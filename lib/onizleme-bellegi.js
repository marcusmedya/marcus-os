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

export function tazelemeyiDinle(dinleyici) {
  dinleyiciler.add(dinleyici);
  return () => { dinleyiciler.delete(dinleyici); };
}

export function dinleyiciSayisi() {
  return dinleyiciler.size;
}
