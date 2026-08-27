/**
 * ALT YAZI — HANGİ METİN GEÇERLİ?
 *
 * Alt yazı içeriğin özelliği: kartta yazılıyor (onaydan önce de), plan onu devralıyor.
 * Ama aynı kart dört şubede paylaşılabiliyor ve şubeye özel bir cümle gerekebiliyor —
 * bu yüzden plan üzerinde DEĞİŞTİRİLEBİLİYOR ve o değişiklik yalnızca o planı etkiliyor.
 *
 * Kural tek satır: PLANIN kendi metni varsa o, yoksa KARTINKİ.
 *
 * NEDEN lib/ ALTINDA: aynı kural beş yerde okunuyor — plan kutusu, paylaşım ekranı,
 * müşteri paneli, haftalık liste, kart. Her birine ayrı yazılsaydı biri güncellenip
 * diğeri unutulurdu; bu projede aynı hata bir kez panel senkron sorununa yol açtı.
 *
 * SAF: ağ yok, yan etki yok.
 */

const temiz = (x) => String(x === null || x === undefined ? "" : x).trim();

/** Planda gösterilecek/kopyalanacak alt yazı. */
export function etkinAltMetin(plan, kart) {
  const planinki = temiz(plan && plan.altMetin);
  if (planinki) return planinki;
  return temiz(kart && kart.altMetin);
}

/**
 * Metin nereden geliyor: "plan" (bu plana özel), "kart" (içerikten devralındı), "yok".
 * Arayüz bunu söylüyor — kullanıcı düzenlediğinde neyi değiştirdiğini bilmeli.
 */
export function altMetinKaynagi(plan, kart) {
  if (temiz(plan && plan.altMetin)) return "plan";
  if (temiz(kart && kart.altMetin)) return "kart";
  return "yok";
}

/**
 * Plana kaydedilecek değer. Kartınkiyle AYNIYSA null dönüyor — aynı metni plana da
 * yazmak, sonradan kart metni güncellendiğinde planın eski metinde takılı kalması
 * demek olurdu. Kullanıcı "değiştirmedim" dediğinde devralma sürmeli.
 */
export function planaYazilacak(yeniMetin, kart) {
  const yeni = temiz(yeniMetin);
  if (!yeni) return null;
  return yeni === temiz(kart && kart.altMetin) ? null : yeni;
}
