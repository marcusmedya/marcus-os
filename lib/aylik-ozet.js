/**
 * AY AY GELİR–GİDER KARŞILAŞTIRMASI.
 *
 * Bugüne kadar aylık geçmişin tek kaynağı "Ayı kapat" düğmesiyle yazılan `monthly`
 * dizisiydi: düğmeye BASILDIĞI ANDAKİ fotoğraf. Ayın 10'unda basılırsa o ay eksik
 * kayıtlanıyor, hiç basılmazsa o ay geçmişte HİÇ YOK ve tahsilat zaten saklanmıyordu.
 *
 * Bu modül geçmişi elle kaydedilmiş fotoğraflardan değil, KAYITLARIN KENDİSİNDEN
 * türetiyor. Üç rakamın gerçek aylık geçmişi zaten belgede duruyor:
 *   · tahakkuk  → `ayinUcreti(client, ay)` (ücret geçmişiyle, bugünkü ücretle DEĞİL)
 *   · tahsilat  → `odemeKayitlari[].ay`
 *   · freelancer gideri → işin TESLİM EDİLDİĞİ ay
 *
 * ----------------------------------------------------------------------------
 * NE TÜRETİLEMEZ — BUNU GİZLEMİYORUZ
 *
 * Sabit giderlerin (ofis, maaşlı personel, üyelikler, gider kalemleri) AY AY GEÇMİŞİ
 * TUTULMUYOR: belgede yalnızca BUGÜNKÜ değerleri var. Geçmiş bir aya bugünkü kirayı
 * yazmak, o ay farklıysa yalan üretir. Bu yüzden bu modül sabit gideri hiç raporlamaz;
 * ekran bunu açıkça söyler. Aylık TOPLAM gider isteniyorsa yol, sabit giderleri de
 * tarihli kaydetmektir — bu ayrı ve daha büyük bir iş.
 *
 * ----------------------------------------------------------------------------
 * AYRILAN / DONDURULAN MARKA: NE ZAMAN AYRILDIĞI KAYITLI DEĞİL
 *
 * Müşteri kaydında `baslangic` var ama BİTİŞ ayı yok. Bu yüzden geçmiş bir ayda
 * "bu marka o sırada çalışıyor muydu" sorusuna ancak KANITLA cevap veriyoruz:
 *   · `baslangic`tan önceki aylar → hayır (ekstre de bu kuralı kullanıyor)
 *   · o ay ödeme kaydı varsa → EVET (kesin kanıt)
 *   · marka bugün aktif/yeni ise → evet (bugüne kadar sürdüğü varsayımı)
 *   · marka donduruldu/ayrıldı ise → HAYIR
 * Son madde bilinçli: ayrılmış bir markaya geçmiş ay tahakkuku yazmak, ne zaman
 * ayrıldığını BİLMEDEN fatura kesmektir. Ödemesi kayıtlıysa zaten üstteki madde
 * onu yakalıyor.
 *
 * SAF: ağ yok, yan etki yok, gelen veriyi değiştirmez.
 */

import { ayinUcreti } from "./marka-ucreti.js";
import { monthPaidAmount } from "./odeme-hesabi.js";
import { sirketAylikIsMaliyeti } from "./is-ucreti.js";

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();
const AY_BICIMI = /^\d{4}-\d{2}$/;

/** "YYYY-AA" biçimine getirir; uymuyorsa null. */
export function ayNormalle(x) {
  const t = metin(x).slice(0, 7);
  return AY_BICIMI.test(t) ? t : null;
}

/** Aya `adet` ay ekler (eksi de olabilir). */
export function ayKaydir(ay, adet) {
  const n = ayNormalle(ay);
  if (!n) return null;
  const [y, a] = n.split("-").map(Number);
  const toplam = y * 12 + (a - 1) + adet;
  const yy = Math.floor(toplam / 12);
  const aa = (toplam % 12 + 12) % 12 + 1;
  return `${yy}-${String(aa).padStart(2, "0")}`;
}

/** Marka o ay çalışıyor muydu? Kanıt yoksa HAYIR — uydurulmaz (yukarıdaki nota bak). */
export function markaAktifMiydi(client, ay) {
  const a = ayNormalle(ay);
  if (!a || !client) return false;

  const bas = ayNormalle(client.baslangic);
  if (bas && a < bas) return false;

  /* KESİN KANIT: o ay para alınmışsa marka o ay çalışıyordu — durumu bugün ne olursa olsun. */
  if (monthPaidAmount(client, a) > 0) return true;

  const durum = metin(client.durum);
  return durum !== "donduruldu" && durum !== "ayrildi";
}

/** O ayın tahakkuku: o ay çalışan markaların o aya ait ücretleri. */
export function ayinTahakkuku(clients, ay) {
  return (Array.isArray(clients) ? clients : [])
    .filter((c) => c && markaAktifMiydi(c, ay))
    .reduce((s, c) => s + (Number(ayinUcreti(c, ay)) || 0), 0);
}

/** O ayın tahsilatı: kayıtlı ödemeler. Durum süzgeci YOK — alınan para alınmıştır. */
export function ayinTahsilati(clients, ay) {
  const a = ayNormalle(ay);
  if (!a) return 0;
  return (Array.isArray(clients) ? clients : [])
    .reduce((s, c) => s + (Number(monthPaidAmount(c || {}, a)) || 0), 0);
}

/** Veride geçen en eski ay — listenin nereden başlayacağını belirler. */
export function enEskiAy({ clients, cekimIsleri } = {}) {
  const aylar = [];
  (Array.isArray(clients) ? clients : []).forEach((c) => {
    if (!c) return;
    const bas = ayNormalle(c.baslangic);
    if (bas) aylar.push(bas);
    (c.odemeKayitlari || []).forEach((k) => { const a = ayNormalle(k && k.ay); if (a) aylar.push(a); });
  });
  (Array.isArray(cekimIsleri) ? cekimIsleri : []).forEach((j) => {
    const a = ayNormalle(j && j.teslimEdilmeTarihi);
    if (a) aylar.push(a);
  });
  return aylar.length ? aylar.sort()[0] : null;
}

/**
 * AY AY ÖZET — en yeni ay üstte.
 *
 * @param bugunAy   "YYYY-AA"; verilmezse içinde bulunulan ay
 * @param enFazlaAy kaç ay geriye gidileceği (varsayılan 12). Veri daha eskiye gitmiyorsa
 *                  liste kendiliğinden kısalır — boş aylarla sayfa doldurulmaz.
 *
 * @returns { satirlar, toplam, enEski }
 *   satirlar[] = { ay, tahakkuk, tahsilat, fark, freelancerGideri, isSayisi, isUcretiEksik }
 *   `fark` = tahakkuk − tahsilat → "o aydan ne kadarı hâlâ tahsil edilmedi"
 */
export function aylikOzet({ clients, cekimIsleri, isUcretleri, isUcretDetaylari,
  bugunAy, enFazlaAy = 12 } = {}) {
  const son = ayNormalle(bugunAy) || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const eskiVeri = enEskiAy({ clients, cekimIsleri });
  const sinir = ayKaydir(son, -(Math.max(1, enFazlaAy) - 1));
  /* Veri sınırdan daha yeniyse ondan başla: geçmişte hiç hareket olmayan aylara
   * "0 ₺" satırı basmak tabloyu okunmaz yapıyor (ekstre de bu kuralı kullanıyor). */
  const bas = eskiVeri && eskiVeri > sinir ? eskiVeri : sinir;

  const satirlar = [];
  /* SONSUZ DÖNGÜYE KARŞI ÜST SINIR — `lib/ekstre.js` de aynı korumayı taşıyor.
   * Döngü `ayKaydir`in her turda geriye gitmesine güveniyor; o bozulursa (ya da bozuk
   * bir tarih girerse) tarayıcı kilitlenir. Ölçüldü: koruma yokken test sonsuza girdi. */
  const ENFAZLA_TUR = 600;                 // 50 yıl
  for (let a = son, tur = 0; a && a >= bas && tur < ENFAZLA_TUR; a = ayKaydir(a, -1), tur++) {
    const tahakkuk = ayinTahakkuku(clients, a);
    const tahsilat = ayinTahsilati(clients, a);
    const is = sirketAylikIsMaliyeti(cekimIsleri, a, isUcretleri, isUcretDetaylari);
    satirlar.push({
      ay: a,
      tahakkuk,
      tahsilat,
      fark: tahakkuk - tahsilat,
      freelancerGideri: is.tutar,
      isSayisi: is.isSayisi,
      isUcretiEksik: is.eksikUcret,
    });
  }

  const topla = (alan) => satirlar.reduce((s, r) => s + r[alan], 0);
  return {
    satirlar,
    enEski: bas,
    toplam: {
      tahakkuk: topla("tahakkuk"),
      tahsilat: topla("tahsilat"),
      fark: topla("fark"),
      freelancerGideri: topla("freelancerGideri"),
      isUcretiEksik: topla("isUcretiEksik"),
    },
  };
}
