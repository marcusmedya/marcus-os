/* ------------------------------------------------------------------ */
/* AYLIK ÖDEME HESABI                                                   */
/* ------------------------------------------------------------------ */
/**
 * `src/tema.jsx` içinden buraya alındı. Sebep tek: bu üç işlev PARA hesaplıyor ve
 * `.jsx` dosyası Node'da çalıştırılamadığı için hiçbir test onları ÇAĞIRAMIYORDU —
 * yalnızca kaynak metinlerine bakılabiliyordu, ki bu projede açıkça yasak. Ücretin
 * aya göre çözülmesi (`ayinUcreti`) tam da burada devreye giriyor; bağlanmadığı
 * ölçülemezse özellik sessizce çalışmıyor olabilir.
 *
 * Arayüz için hiçbir şey değişmedi: `src/tema.jsx` üçünü de yeniden dışa veriyor.
 */
import { ayinUcreti } from "./marka-ucreti.js";

/** Belirli bir ay için o müşteriden gerçekten tahsil edilen toplam tutar (kısmi ödemeler dahil).
 * Eski sistemde (odemeler dizisinde işaretli ama hiç ödeme kaydı yoksa) geriye dönük uyumluluk için
 * tam ödenmiş sayılır. */
export function monthPaidAmount(client, key) {
  const kayitlar = (client.odemeKayitlari || []).filter((k) => k.ay === key);
  const sum = kayitlar.reduce((s, k) => s + (Number(k.tutar) || 0), 0);
  if (sum > 0) return sum;
  /* Eski sistemde tutar yazılmadan işaretlenmiş ay: O AYIN ücreti sayılır, bugünkü
   * değil. Bugünküyle sayılırsa ücret sonradan düştüğünde geçmişte tahsil edilmiş
   * tutar da düşerdi. */
  if ((client.odemeler || []).includes(key)) return ayinUcreti(client, key);
  return 0;
}
/** O ay için kalan (henüz ödenmemiş) bakiye. */
export function monthRemaining(client, key) {
  return Math.max(0, ayinUcreti(client, key) - monthPaidAmount(client, key));
}
/** O ay tam olarak ödenmiş mi? */
export function isMonthPaid(client, key) {
  const tutar = ayinUcreti(client, key);
  if (tutar <= 0) return true;
  return monthPaidAmount(client, key) >= tutar;
}

