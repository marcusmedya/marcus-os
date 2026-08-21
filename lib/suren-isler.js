/**
 * SÜREN UZUN İŞLER — arka plan tazelemesi bunların üstüne yazmasın.
 *
 * HATA NEYDİ: uygulama 25 saniyede bir sunucudaki veriyi çekip yerel duruma yazıyor
 * (`veriyiYenile`). Bunun tek koruması vardı: "bekleyen bir KAYIT varsa dokunma".
 *
 * Ama Drive'a dosya yüklemek bir kayıt değil — tarayıcı baytları doğrudan Google'a
 * gönderiyor ve bu 80 MB'lık bir videoda dakikalarca sürüyor. O süre boyunca uygulama
 * kendini "boşta" sanıyor ve tazeleme çalışıp kartların tamamını sunucudaki hâliyle
 * değiştiriyordu.
 *
 * Üstelik tazeleme dosya seçme penceresi kapanır kapanmaz da tetikleniyor: pencere odağı
 * geri aldığında `focus` olayı çalışıyor. Yani HER yüklemenin başında bir tazeleme vardı.
 *
 * ZAMAN AŞIMI ŞART: bir bileşen iş sürerken sökülürse (kullanıcı sekmeyi değiştirdi,
 * kart kapandı) "bitti" haberi hiç gelmeyebilir. Sayaç öylece asılı kalsaydı tazeleme
 * oturum boyunca bir daha hiç çalışmazdı — bu sefer ters yönde bir hata olurdu.
 */

const ZAMAN_ASIMI_MS = 10 * 60 * 1000;   // 10 dakika: en yavaş yükleme bile bunu aşmamalı
const surenler = new Map();              // kimlik -> başlangıç zamanı

export function isBasladi(kimlik) {
  surenler.set(String(kimlik), Date.now());
}

export function isBitti(kimlik) {
  surenler.delete(String(kimlik));
}

/** Zaman aşımına uğramış kayıtları temizler ve geriye canlı iş kalıp kalmadığını söyler. */
export function surenIsVarMi(simdi = Date.now()) {
  for (const [kimlik, baslangic] of [...surenler]) {
    if (simdi - baslangic > ZAMAN_ASIMI_MS) surenler.delete(kimlik);
  }
  return surenler.size > 0;
}

export function surenIsSayisi() {
  return surenler.size;
}

/** Test için. */
export function surenleriSifirla() {
  surenler.clear();
}
