/**
 * SİLİNEN KAYITLARI BULUR — GÜVENLİK DEFTERİ İÇİN.
 *
 * Denetimde ölçüldü: defterde on üç kayıt noktası var ve hepsi giriş / hesap yönetimi /
 * yedek geri yükleme. **Kart silme, müşteri silme, reklam silme hiç kaydedilmiyordu** —
 * "bu kartı kim sildi" sorusunun cevabı hiçbir yerde yoktu. Silme bu sistemde geri alması
 * en zor işlem; izinin olmaması kabul edilebilir değil.
 *
 * NEDEN AYRI BİR MODÜL: silme, ayrı bir "sil" ucundan geçmiyor — tarayıcı listeden kaydı
 * çıkarıp BELGENİN TAMAMINI kaydediyor. Yani silmeyi görmenin tek yolu, yazmadan önceki
 * hâlle sonraki hâli karşılaştırmak. Karşılaştırma saf ve test edilebilir olsun diye burada.
 *
 * DEFTER AYRI ANAHTARDA tutuluyor (`lib/kv-yaz.js` → `deftereYaz`, son 500 kayıt): ana
 * belgeyi büyütmüyor, yedeğe girmiyor, geri yüklemede ezilmiyor.
 *
 * SAF: ağ yok, yan etki yok.
 */

/** Defterde izlenen listeler. Hepsi `id` taşıyan üst düzey diziler. */
export const IZLENEN_ALANLAR = [
  { alan: "cekimIsleri", etiket: "operasyon kartı", adAlani: "icerikTuru" },
  { alan: "clients", etiket: "müşteri", adAlani: "ad" },
  { alan: "reklamlar", etiket: "reklam", adAlani: "marka" },
  { alan: "haftalikPaylasimlar", etiket: "paylaşım planı", adAlani: "marka" },
  { alan: "subeler", etiket: "şube", adAlani: "ad" },
  { alan: "uyelikler", etiket: "üyelik", adAlani: "ad" },
];

/** Tek seferde deftere yazılacak en fazla kayıt. Bir kullanıcı yüz kaydı birden silerse
 * defterin tamamı o tek işlemle dolmamalı; sayı yine de tam bildiriliyor. */
export const EN_FAZLA_AYRINTI = 20;

const kimlik = (x) => String((x && x.id) !== undefined ? x.id : "");

/**
 * Yazmadan önceki ve sonraki hâli karşılaştırıp SİLİNEN kayıtları döndürür.
 *
 * Alan gelen belgede HİÇ YOKSA silme sayılmaz: personel yalnızca dokunduğu alanları
 * gönderiyor, göndermediği alan "silinmiş" değil "gönderilmemiş" demektir. Bu ayrım
 * yapılmazsa her personel kaydı, dokunmadığı her listeyi silinmiş gösterirdi.
 */
export function silinenleriBul(onceki, sonraki, alanlar = IZLENEN_ALANLAR) {
  const o = onceki && typeof onceki === "object" ? onceki : {};
  const s = sonraki && typeof sonraki === "object" ? sonraki : {};
  const bulunanlar = [];
  for (const { alan, etiket, adAlani } of alanlar) {
    const eski = Array.isArray(o[alan]) ? o[alan] : null;
    const yeni = Array.isArray(s[alan]) ? s[alan] : null;
    if (!eski || !yeni) continue;                 // gönderilmemiş alan silme değildir
    const kalanlar = new Set(yeni.map(kimlik));
    for (const kayit of eski) {
      if (!kayit || kalanlar.has(kimlik(kayit))) continue;
      bulunanlar.push({
        alan, etiket,
        id: kayit.id,
        ad: String((adAlani && kayit[adAlani]) || "").slice(0, 80) || null,
      });
    }
  }
  return bulunanlar;
}

/** Defter kaydının gövdesi. Ayrıntı kırpılsa bile SAYI tam kalır. */
export function silmeKaydi(silinenler, kim) {
  const hepsi = Array.isArray(silinenler) ? silinenler : [];
  if (hepsi.length === 0) return null;
  const sayim = {};
  hepsi.forEach((x) => { sayim[x.etiket] = (sayim[x.etiket] || 0) + 1; });
  return {
    toplam: hepsi.length,
    sayim,
    kayitlar: hepsi.slice(0, EN_FAZLA_AYRINTI),
    ...(hepsi.length > EN_FAZLA_AYRINTI ? { kirpildi: hepsi.length - EN_FAZLA_AYRINTI } : {}),
    ...(kim ? { kim } : {}),
  };
}
