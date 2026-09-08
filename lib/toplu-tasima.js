/**
 * KARTLARI TOPLU TAŞIMA — panoda seçilen kartları tek seferde başka bir aşamaya alır.
 *
 * Yirmi kartı tek tek açıp aşama ilerletmek yirmi kart açılışı, yirmi kayıt ve yirmi
 * bekleme demekti. Seçilenler tek kayıtta taşınıyor.
 *
 * ÜÇ ELEME, ÜÇÜ DE VERİ BOZULMASINA KARŞI:
 *   1. Hedef aşama kartın KATEGORİSİNDE yoksa o kart taşınmaz. Reels'in "Edit Yapılıyor"
 *      aşaması Post listesinde yok; yazılsaydı sunucudaki `asamalariDuzelt` onu tanımadığı
 *      aşamadan alıp akışın BAŞINA çekerdi — kullanıcı "taşıdım" sanır, kart geri düşerdi.
 *   2. Zaten hedefte olan kart listeye alınmaz. Alınsaydı dizi yeni referans olur, sürüm
 *      sayacı boşuna artar ve o sırada kart üzerinde çalışan herkes 409 alırdı.
 *   3. Hiçbir kart taşınmıyorsa GELEN DİZİ aynen döner — aynı sebep.
 *
 * SAF: ağ yok, yan etki yok. Stok ve Drive taşıması sunucunun işi; burada yalnızca
 * kartın aşaması ve geçmiş notu değişiyor.
 */
import { asamaListesi } from "./asamalar.js";

/** Bu kart bu aşamaya taşınabilir mi — kategorisinin akışında böyle bir aşama var mı. */
export function tasinabilirMi(is, hedefAsama) {
  if (!is || !hedefAsama) return false;
  return asamaListesi(is.kategori).includes(hedefAsama);
}

/**
 * Seçilen kimlikleri üç gruba ayırır: taşınacaklar, zaten hedefte olanlar, kategorisi
 * uymayanlar. Arayüz bunu taşımadan ÖNCE gösteriyor — "20 kart seçtim ama 14'ü taşındı"
 * sürprizi yaşanmasın.
 */
export function tasimaAdaylari(isler, idler, hedefAsama) {
  const secili = new Set((Array.isArray(idler) ? idler : []).map(String));
  const tasinacak = [], zatenOrada = [], uygunsuz = [];
  (Array.isArray(isler) ? isler : []).forEach((j) => {
    if (!j || !secili.has(String(j.id))) return;
    if (!tasinabilirMi(j, hedefAsama)) { uygunsuz.push(j); return; }
    if (j.asama === hedefAsama) { zatenOrada.push(j); return; }
    tasinacak.push(j);
  });
  return { tasinacak, zatenOrada, uygunsuz };
}

/**
 * Taşımayı uygular ve her karta geçmiş notu düşer.
 *
 * @returns { isler, tasinan } — `isler` yeni referans YALNIZCA gerçekten taşıma olduysa.
 */
export function tasimayiUygula(isler, idler, hedefAsama, yazan) {
  const { tasinacak } = tasimaAdaylari(isler, idler, hedefAsama);
  if (tasinacak.length === 0) return { isler, tasinan: 0 };
  const kume = new Set(tasinacak);
  const zaman = new Date().toLocaleString("tr-TR");
  const yeni = isler.map((j) => (kume.has(j)
    ? {
      ...j, asama: hedefAsama,
      gecmis: [...(Array.isArray(j.gecmis) ? j.gecmis : []), {
        id: (Array.isArray(j.gecmis) ? j.gecmis.length : 0) + 1,
        tarih: zaman, yazan: yazan || "Sistem",
        aciklama: `Toplu taşıma: "${j.asama}" → "${hedefAsama}".`,
      }],
    }
    : j));
  return { isler: yeni, tasinan: tasinacak.length };
}

/** Taşımadan önce kullanıcıya gösterilecek özet. */
export function tasimaOzeti({ tasinacak, zatenOrada, uygunsuz }, hedefAsama) {
  const parcalar = [`${tasinacak.length} kart "${hedefAsama}" aşamasına taşınacak`];
  if (zatenOrada.length > 0) parcalar.push(`${zatenOrada.length} kart zaten orada`);
  if (uygunsuz.length > 0) {
    parcalar.push(`${uygunsuz.length} kart taşınamaz (kategorisinde bu aşama yok)`);
  }
  return parcalar.join(" · ");
}
