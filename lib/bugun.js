/**
 * BUGÜN — GÜNE BAŞLARKEN BAKILACAK TEK EKRANIN ÇEKİRDEĞİ.
 *
 * Denetimde çıkan en yüksek değerli eksik buydu: "bugün ne yapılacak, hangi marka
 * gecikiyor, ne onay bekliyor, hangi içerik paylaşılacak" sorularının cevabı DÖRT ayrı
 * ekrana dağılmıştı (Dashboard finans odaklı, Operasyon panosu kategori sütunlu, Panom
 * yalnızca personelde, geciken paylaşımlar Günlük Kontrol'de). Bir iş gözden kaçarsa
 * sistem bunu kimseye söylemiyordu.
 *
 * YENİ VERİ YOK — hepsi mevcut alanlardan türetiliyor. Bu modül SAF ve yalnızca OKUR;
 * hiçbir şey yazmaz, hiçbir aşama değiştirmez. Ekran salt okunur olduğu için yanlış bir
 * satırın en kötü sonucu "gereksiz yere bakmak"tır, veri kaybı değil.
 *
 * TARİH KARŞILAŞTIRMASI METİNLE yapılıyor (`YYYY-AA-GG`): kartlardaki `teslimTarihi` ve
 * plan kayıtlarındaki tarih zaten bu biçimde saklanıyor. `new Date()` ile karşılaştırmak
 * saat dilimi kaydırması üretir — sunucu UTC'de çalışıyor, Türkiye UTC+3; gece yarısından
 * sonra "bugün" bir gün geriye kayardı. Bu proje o hatayı daha önce yaşadı.
 */
import { kategoriEsle } from "./kategori.js";

/** Müşterinin/ajansın cevabını bekleyen aşamalar. */
export const MUSTERI_BEKLIYOR = "Kontrol Bekliyor";
export const REVIZE = "Revize İstendi";
/** İş bitmiş sayılan aşamalar — "yapılacak" listesine girmezler. */
export const BITMIS_ASAMALAR = ["Teslim Edildi"];

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();

/**
 * Bir paylaşım planının gerçek tarihi: `haftaKey` (haftanın pazartesisi, "YYYY-AA-GG")
 * artı `gun` (0 = pazartesi … 6 = pazar). Kayıtta hazır tarih YOK.
 *
 * Tarih parçalardan kurulup parçalara geri çevriliyor; araya UTC dönüşümü girmiyor.
 * Bu proje o kaymayı daha önce yaşadı: sunucu UTC'de çalıştığı için gece yarısından
 * sonra "bugün" bir gün geriye kayıyordu.
 */
export function planTarihi(kayit) {
  const m = metin(kayit && kayit.haftaKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const kayma = Number(kayit.gun);
  d.setDate(d.getDate() + (Number.isFinite(kayma) ? kayma : 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Bir kartın kullanıcıya gösterilecek kısa özeti. */
function kartOzeti(j) {
  return {
    id: j.id,
    marka: metin(j.marka),
    ad: metin(j.icerikTuru) || "(adsız)",
    kategori: kategoriEsle(j.kategori),
    asama: metin(j.asama),
    teslimTarihi: metin(j.teslimTarihi),
    sorumlu: metin(j.editor) || metin(j.kameraman) || "",
  };
}

/**
 * Günün özeti.
 *
 * @param bugun "YYYY-AA-GG" — çağıran veriyor ki saat dilimi kararı TEK yerde kalsın.
 */
export function bugunOzeti({ isler, planlar, bugun } = {}) {
  const gun = metin(bugun);
  const kartlar = (Array.isArray(isler) ? isler : []).filter(Boolean);
  const plan = (Array.isArray(planlar) ? planlar : []).filter(Boolean);

  const acikKartlar = kartlar.filter((j) => !BITMIS_ASAMALAR.includes(metin(j.asama)));

  /* GECİKEN: teslim tarihi BUGÜNDEN ÖNCE ve iş hâlâ bitmemiş. Tarihi olmayan kart
   * gecikmiş sayılmaz — tarih girilmemiş olması gecikme değildir. */
  const geciken = acikKartlar
    .filter((j) => metin(j.teslimTarihi) && metin(j.teslimTarihi) < gun)
    .map(kartOzeti)
    .sort((a, b) => a.teslimTarihi.localeCompare(b.teslimTarihi));

  const bugunTeslim = acikKartlar
    .filter((j) => metin(j.teslimTarihi) === gun)
    .map(kartOzeti);

  /* ONAY BEKLEYEN: müşteriye çıkmış, cevabı bekleniyor. Bu ayrım önemli — "bizde bekleyen"
   * iş ile "müşteride bekleyen" iş aynı sütunda duruyordu ve kimin topu olduğu
   * anlaşılmıyordu. */
  const musteride = acikKartlar
    .filter((j) => metin(j.asama) === MUSTERI_BEKLIYOR)
    .map(kartOzeti);

  /* BİZDE: revize istenmiş, top yeniden ajansta. */
  const revizede = acikKartlar
    .filter((j) => metin(j.asama) === REVIZE)
    .map(kartOzeti);

  /* BUGÜN PAYLAŞILACAK ve GECİKEN PAYLAŞIM.
   *
   * Plan kaydı mutlak tarih TUTMUYOR: `haftaKey` (haftanın pazartesisi) + `gun` (0-6 gün
   * kayması) şeklinde duruyor. Tarihi bu ikisinden üretmek zorunlu — kayıttaki `tarih`
   * alanına bakmak sessizce hiçbir şey bulmazdı. */
  const planSatiri = (k) => ({
    id: k.id,
    clientId: k.clientId,
    tarih: planTarihi(k),
    marka: metin(k.marka),
    tur: metin(k.tur),
    subeAdi: metin(k.subeAdi) || null,
  });
  const bekleyenPlanlar = plan.filter((k) => !k.yapildi && planTarihi(k));
  const bugunPaylasim = bekleyenPlanlar.filter((k) => planTarihi(k) === gun).map(planSatiri);
  const gecikenPaylasim = bekleyenPlanlar
    .filter((k) => planTarihi(k) < gun)
    .map(planSatiri)
    .sort((a, b) => a.tarih.localeCompare(b.tarih));

  return {
    gun,
    geciken,
    bugunTeslim,
    musteride,
    revizede,
    bugunPaylasim,
    gecikenPaylasim,
    /* Tek bakışta "bugün bir şey var mı" — hepsi boşsa ekran bunu açıkça söylesin,
     * boş bir liste yığını göstermek yerine. */
    bosMu: geciken.length === 0 && bugunTeslim.length === 0 && musteride.length === 0
      && revizede.length === 0 && bugunPaylasim.length === 0 && gecikenPaylasim.length === 0,
  };
}

/** Başlıktaki tek cümlelik durum. */
export function bugunBasligi(ozet) {
  if (!ozet || ozet.bosMu) return "Bugün acil bir şey görünmüyor.";
  const parcalar = [];
  if (ozet.geciken.length) parcalar.push(`${ozet.geciken.length} geciken iş`);
  if (ozet.bugunTeslim.length) parcalar.push(`${ozet.bugunTeslim.length} bugün teslim`);
  if (ozet.musteride.length) parcalar.push(`${ozet.musteride.length} müşteride`);
  if (ozet.revizede.length) parcalar.push(`${ozet.revizede.length} revizede`);
  if (ozet.bugunPaylasim.length) parcalar.push(`${ozet.bugunPaylasim.length} bugün paylaşım`);
  if (ozet.gecikenPaylasim.length) parcalar.push(`${ozet.gecikenPaylasim.length} geciken paylaşım`);
  return parcalar.join(" · ");
}
