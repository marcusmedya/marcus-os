/* ------------------------------------------------------------------ */
/* VİDEONUN TEŞHİS SATIRI                                              */
/* ------------------------------------------------------------------ */
/**
 * "Video geç açılıyor / takılıyor" tartışması bu projede aylardır TAHMİNLE yürüdü:
 * dosyanın gerçekte kaç megabayt olduğunu, kaç Mbps olduğunu kimse bilmiyordu. İki kez
 * ölçmeden değişiklik yapıldı ve ikisi de videoyu bozdu.
 *
 * Bu modül tek bir satır üretiyor: **çözünürlük · boyut · bit hızı · hızlı başlangıç.**
 * "18 saniyelik video 80 MB" ile "8 MB" tamamen farklı iki sorun ve farklı çözüm ister;
 * bu satır o ayrımı bakışta veriyor.
 *
 * BİT HIZI ASIL RAKAM. Boyut tek başına yanıltıcı — uzun bir video doğal olarak büyüktür.
 * Takılmayı belirleyen, saniyede kaç bit indirilmesi gerektiğidir.
 */

const sayi = (x) => (typeof x === "number" && isFinite(x) && x > 0 ? x : 0);

/** Bayt → okunur boyut. 1 MB = 1024 KB (dosya yöneticilerinin gösterdiği gibi). */
export function baytBicimle(bayt) {
  const b = sayi(bayt);
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  const mb = b / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Ortalama bit hızı — boyut ve süreden. İkisinden biri yoksa boş döner. */
export function bitHizi(bayt, sureSn) {
  const b = sayi(bayt), s = sayi(sureSn);
  if (!b || !s) return 0;
  return (b * 8) / s;   // bit/sn
}

export function bitHiziBicimle(bitSn) {
  const v = sayi(bitSn);
  if (!v) return "";
  const mbps = v / 1e6;
  return mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${(v / 1e3).toFixed(0)} kbps`;
}

/**
 * Oynatıcının altına yazılacak satır. Bilinmeyen parçalar sessizce atlanır —
 * eksik bilgiyle "0 MB" ya da "NaN" yazmak, hiç yazmamaktan kötü.
 *
 * `hizliBaslangic` üç değerli: true (başta), false (sonda), null (teşhis edilemedi).
 * `null` iken hiçbir şey yazılmıyor; yanlış uyarı, uyarı olmamasından kötü.
 */
export function videoBilgiSatiri({ boyut, genislik, yukseklik, sureSn, hizliBaslangic } = {}) {
  const parcalar = [];

  const g = sayi(genislik), y = sayi(yukseklik);
  if (g && y) parcalar.push(`${g}×${y}`);

  const boyutMetni = baytBicimle(boyut);
  if (boyutMetni) parcalar.push(boyutMetni);

  const hiz = bitHiziBicimle(bitHizi(boyut, sureSn));
  if (hiz) parcalar.push(hiz);

  if (hizliBaslangic === false) parcalar.push("hızlı başlangıç KAPALI");
  else if (hizliBaslangic === true) parcalar.push("hızlı başlangıç açık");

  return parcalar.join(" · ");
}

/** Bu dosya izlemek için ağır mı? Eşik ölçüme değil deneyime dayanıyor: proxy üzerinden
 * ~8 Mbps'in üstü, uzaktan izlerken takılmanın başladığı yer. Kesin bir sınır değil,
 * kullanıcıya "sorun dosyada" diyebilmek için bir işaret. */
export const AGIR_BIT_HIZI = 8e6;

export function agirMi(boyut, sureSn) {
  return bitHizi(boyut, sureSn) > AGIR_BIT_HIZI;
}
