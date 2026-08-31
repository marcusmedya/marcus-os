/**
 * ÇEKİM LİSTESİ SIRASI — ELLE DÜZENLENEBİLİR.
 *
 * Liste kendiliğinden "en acil üstte" (stoğu en az olan) diye sıralanıyordu. Ama aciliyet
 * yalnızca stok değil: bir markanın çekimi mekâna, hava durumuna, müşterinin uygunluğuna
 * bağlı olabiliyor. Bu yüzden sıra elle de düzenlenebiliyor ve kaydediliyor — ekip aynı
 * önceliğe bakıyor.
 *
 * LİSTE DİNAMİK: marka yalnızca stoğu eşiğin altındayken görünüyor, çekim yapılınca
 * listeden çıkıyor, stok azalınca geri geliyor. Elle sıra bu gidiş gelişe dayanmak zorunda:
 * kayıtta olmayan marka kuralı bozmamalı, listeden çıkan marka sırasını KAYBETMEMELİ
 * (geri geldiğinde yine aynı yerde olsun).
 *
 * SAF: ağ yok, yan etki yok.
 */

/** Otomatik kural: stoğu az olan üstte, eşitlikte marka adına göre. */
function otomatikKarsilastir(a, b) {
  if (a.toplam !== b.toplam) return a.toplam - b.toplam;
  return String(a.marka || "").localeCompare(String(b.marka || ""), "tr");
}

/**
 * Grupları elle verilmiş sıraya göre dizer.
 *
 * Elle sırası olanlar ÖNCE ve o sırada; hiç sıra verilmemiş olanlar (yeni eklenen ya da
 * ilk kez görünen markalar) sonra, otomatik kurala göre. Sıra hiç yoksa liste bugünkü
 * davranışını aynen sürdürür.
 */
export function siraliGruplar(gruplar, sira) {
  const liste = Array.isArray(gruplar) ? [...gruplar] : [];
  const yerler = new Map((Array.isArray(sira) ? sira : []).map((id, i) => [String(id), i]));
  return liste.sort((a, b) => {
    const ai = yerler.has(String(a.clientId)) ? yerler.get(String(a.clientId)) : Infinity;
    const bi = yerler.has(String(b.clientId)) ? yerler.get(String(b.clientId)) : Infinity;
    if (ai !== bi) return ai - bi;
    return otomatikKarsilastir(a, b);
  });
}

/**
 * Bir markayı bir sıra yukarı/aşağı taşır ve KAYDEDİLECEK yeni sırayı döndürür.
 *
 * Taban, o an GÖRÜNEN sıra: kullanıcı ekranda ne görüyorsa onun üzerinden taşıyor. Kayıtlı
 * sıra boşken de çalışması bu yüzden — ilk taşımada görünen sıranın tamamı yazılıyor,
 * yoksa tek bir markaya sıra verip diğerlerini otomatik bırakmak sırayı öngörülemez
 * yapardı.
 *
 * LİSTEDE OLMAYAN ESKİ KAYITLAR KORUNUYOR: marka çekimi yapılınca listeden çıkıyor;
 * kaydından da düşseydi geri geldiğinde yerini kaybederdi.
 *
 * @param mevcutSira   kayıtlı sıra (olmayabilir)
 * @param gorunenIdler ekrandaki sıra (yukarıdan aşağıya)
 * @param clientId     taşınacak marka
 * @param yon          -1 yukarı, +1 aşağı
 */
export function sirayiTasi(mevcutSira, gorunenIdler, clientId, yon) {
  const gorunen = (Array.isArray(gorunenIdler) ? gorunenIdler : []).map(String);
  const hedef = String(clientId);
  const i = gorunen.indexOf(hedef);
  if (i === -1) return Array.isArray(mevcutSira) ? mevcutSira.map(String) : [];

  const j = i + (yon < 0 ? -1 : 1);
  if (j < 0 || j >= gorunen.length) return gorunen.slice();   // uçlarda hareket yok

  const yeni = gorunen.slice();
  yeni[i] = gorunen[j];
  yeni[j] = gorunen[i];

  /* Görünmeyen ama daha önce sıralanmış markalar korunuyor — listeden çıkan marka geri
   * geldiğinde yerini kaybetmesin. Görünenler yeni sıralarıyla önde. */
  const gorunenKume = new Set(yeni);
  const kalanlar = (Array.isArray(mevcutSira) ? mevcutSira : [])
    .map(String).filter((x) => !gorunenKume.has(x));
  return [...yeni, ...kalanlar];
}

/** Elle sıra kullanılıyor mu — arayüz "otomatik sıraya dön" düğmesini buna göre gösteriyor. */
export function elleSiraVarMi(sira) {
  return Array.isArray(sira) && sira.length > 0;
}
