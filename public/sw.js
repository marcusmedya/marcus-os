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
self.addEventListener("fetch", (e) => { e.respondWith(fetch(e.request)); });
