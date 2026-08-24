/**
 * DRIVE DENETİMİ — kayıtlı stok ile Drive'ın söylediği stoğu karşılaştırır.
 *
 * Kullanıcının kararı: stokta son söz Drive'ın. "Stok = ONAYLANANLAR klasöründe dosyası
 * FİİLEN duran kartlar." Bu modül kararı UYGULAMAZ, yalnızca farkı ve uygulanıp
 * uygulanamayacağını hesaplar — böylece hem gece işi hem ekran aynı mantığı kullanır.
 *
 * YALNIZCA GENEL STOK. Şube stoğu (`clientId_subeId_tur`) Drive'dan türetilemez: bir
 * dosyanın hangi şubede paylaşıldığı Drive'da yazmıyor, o plan verisidir. Şube
 * satırlarına dokunulmaz — dokunulsaydı çok şubeli markaların sayıları silinirdi.
 *
 * SAF: ağ yok, yan etki yok.
 */

/** Toplu kayıp freni — Drive geçici olarak eksik okunduysa stoğu boşaltmasın. */
export const TOPTAN_KAYIP_SINIRI = 20;

/** `clientId_tur` — genel stok anahtarı. Şube anahtarları iki alt çizgi taşır. */
export function genelStokAnahtari(clientId, tur) {
  return `${clientId}_${tur}`;
}

/** Bu anahtar bu markanın GENEL stoğu mu (şube satırı değil)? */
export function markaninGenelAnahtariMi(anahtar, clientId, turler) {
  const on = `${clientId}_`;
  if (!String(anahtar).startsWith(on)) return false;
  return turler.includes(String(anahtar).slice(on.length));
}

/**
 * @param kayitliStoklar  belgedeki `stoklar`
 * @param driveStok       { "Reels": 2, ... } — driveyeGoreStok çıktısı
 * @param clientId        marka
 * @param turler          stok türleri (lib/stok.js PAYLASIM_TURLERI)
 * @returns [{ tur, kayitli, driveGore, fark }]  — yalnızca FARKLI olanlar
 */
export function stokFarklari(kayitliStoklar, driveStok, clientId, turler) {
  const stoklar = kayitliStoklar || {};
  return (turler || []).map((tur) => {
    const kayitli = Number(stoklar[genelStokAnahtari(clientId, tur)]) || 0;
    const driveGore = Number((driveStok || {})[tur]) || 0;
    return { tur, kayitli, driveGore, fark: driveGore - kayitli };
  }).filter((x) => x.fark !== 0);
}

/**
 * Fark uygulanmalı mı? Fail-safe: Drive eksik okunduysa ASLA uygulanmaz.
 *
 * Neden bu kadar temkinli: tarama bütçesi dolduğunda ya da bir ay klasörü okunamadığında
 * Drive "daha az içerik" gösterir. O sayıyı yazmak, gerçekte duran içeriği stoktan
 * silmek demek. Eksik bir okuma yüzünden veri kaybetmektense hiç dokunmamak yeğdir.
 */
export function uygulanabilirMi(tarama, farklar, sinir = TOPTAN_KAYIP_SINIRI) {
  if (!tarama || !tarama.ok) return { uygula: false, sebep: (tarama && tarama.sebep) || "Drive okunamadı" };
  if (tarama.tamamlanmadi) return { uygula: false, sebep: "Tarama tamamlanmadı — eksik listeyle stok yazılmaz" };
  /* AY KLASÖRÜ YOKSA otorite yok. "Hiç dosya görmedim" ile "hiç klasör bulamadım"
   * aynı şey değil; ikincisi bir yapı sorunudur ve stoğu sıfırlamak için gerekçe olamaz. */
  if (tarama.ayBulunamadi) {
    return { uygula: false, sebep: "Drive'da ay klasörü bulunamadı — klasör yapısı beklenenden farklı, stok değiştirilmedi" };
  }
  if (!farklar || farklar.length === 0) return { uygula: false, sebep: "Fark yok" };

  const toplamKayip = farklar.reduce((t, f) => t + (f.fark < 0 ? -f.fark : 0), 0);
  if (toplamKayip >= sinir) {
    return { uygula: false, sebep: `Toplu kayıp freni: ${toplamKayip} içerik birden düşecekti` };
  }
  return { uygula: true };
}

/**
 * Farkları GENEL stok satırlarına uygular. Şube satırlarına dokunmaz.
 *
 * ESKİ TÜR ANAHTARLARI SİLİNİYOR (`1_Görsel`, `1_Video`, `1_Story`, `1_Tasarım`).
 * Okuma anında bunlar yeni türlere toplanıyor; silinmezlerse doğru sayının ÜSTÜNE
 * eklenmeye devam eder ve stok hiç düşmeyen bir kalıntı taşır. Düzeltme zaten o markanın
 * gerçek sayısını yazıyor — kalıntının yeri yok.
 *
 * `eskiAnahtarlar` DIŞARIDAN veriliyor: bu dosya saf kalsın, tür listesini bilen taraf
 * (lib/stok.js) karar versin.
 */
export function farklariUygula(stoklar, farklar, clientId, eskiAnahtarlar) {
  const yeni = { ...(stoklar || {}) };
  (eskiAnahtarlar || []).forEach((a) => { delete yeni[a]; });
  (farklar || []).forEach((f) => { yeni[genelStokAnahtari(clientId, f.tur)] = f.driveGore; });
  return yeni;
}
