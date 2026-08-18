/*
 * Service Worker — BİLEREK SADE.
 *
 * Amacı yalnızca uygulamanın telefona kurulabilmesini sağlamak (Chrome, kurulabilirlik için
 * fetch olayını dinleyen bir service worker şartı koyuyor).
 *
 * ÖNBELLEKLEME YAPMIYOR. Yapsaydı, sen yeni sürüm yüklediğinde telefonlarda ESKİ sürüm
 * açılmaya devam ederdi — düzelttiğimiz bir hata düzelmemiş gibi görünürdü ve hangi sürümün
 * çalıştığını bilemezdik. Veri hassasiyeti olan bir uygulamada bu riski almıyoruz.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
/* DIŞ KÖKENE GİDEN İSTEKLERE KARIŞMIYORUZ.
 *
 * Eskiden burada koşulsuz `e.respondWith(fetch(e.request))` vardı. Zararsız görünüyordu ama
 * DEĞİLDİ: kart içinden Drive'a yapılan dosya yüklemesi de buradan geçiyor ve service worker
 * isteği yeniden kurmaya çalışırken gövde akışı kopuyordu. Kullanıcı "Bağlantı koptu" hatası
 * alıyor, yükleme hiç başlamıyordu.
 *
 * Aynı kökene giden isteklerde davranış değişmedi; kurulabilirlik için gereken fetch
 * dinleyicisi de yerinde duruyor. */
self.addEventListener("fetch", (e) => {
  let ayniKoken = false;
  try { ayniKoken = new URL(e.request.url).origin === self.location.origin; } catch (err) { ayniKoken = false; }
  if (!ayniKoken) return;              // Google'a giden yükleme buradan geçmez
  e.respondWith(fetch(e.request));
});
