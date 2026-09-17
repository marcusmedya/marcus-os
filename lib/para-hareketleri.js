/**
 * PARA HAREKETLERİ — "hangi dönemde ne girdi, ne çıktı" dökümü.
 *
 * Ön muhasebenin belkemiği: raporlar (PDF) ve sade özet bu modülden besleniyor. Rakamları
 * tek yerden üretmek zorunlu — aynı dönemi iki ekran farklı toplarsa hangisinin doğru
 * olduğu sorusu cevapsız kalır ve bu projede tam olarak o yaşandı.
 *
 * ----------------------------------------------------------------------------
 * TARİH: KAYITLAR İKİ FARKLI ALAN TAŞIYOR
 *
 * `tarih` (gün, "YYYY-AA-GG") her kayıtta YOK; eski kayıtlarda yalnızca `ay` var.
 * Bu yüzden dönem süzgeci ÖNCE `tarih`in ayına, o yoksa `ay` alanına bakar. Tarihi de ayı
 * da olmayan kayıt hiçbir döneme girmez — uydurulmaz, ama TOPLAMDAN DÜŞMESİN diye ayrıca
 * `tarihsiz` olarak sayılır ve ekranda söylenir. Sessizce atlamak, raporu eksik yapıp
 * kullanıcıya tam gibi gösterirdi.
 *
 * ÇIKAN PARA İKİ LİSTEDE: `odemeler` (maaş/hak ediş ödemesi) ve `avanslar`. İkisi de
 * gerçekten hesaptan çıkan paradır (`hesapBakiyesi` ikisini de düşüyor), bu yüzden gider
 * dökümünde birlikte listelenirler — ama TÜRÜ yazılır, çünkü avans bir ön ödemedir.
 *
 * SAF: ağ yok, yan etki yok, gelen veriyi değiştirmez.
 */

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();
const sayi = (x) => Number(x) || 0;
const AY = /^\d{4}-\d{2}$/;

/** Kaydın düştüğü ay: önce `tarih`in ayı, yoksa `ay` alanı. Çözülemezse null. */
export function kaydinAyi(kayit) {
  if (!kayit) return null;
  const t = metin(kayit.tarih).slice(0, 7);
  if (AY.test(t)) return t;
  const a = metin(kayit.ay).slice(0, 7);
  return AY.test(a) ? a : null;
}

/** Ekranda gösterilecek tarih: gün varsa gün, yoksa ay. */
export function kaydinTarihi(kayit) {
  const t = metin(kayit && kayit.tarih);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return kaydinAyi(kayit) || "";
}

const araliktaMi = (ay, bas, bit) => Boolean(ay) && (!bas || ay >= bas) && (!bit || ay <= bit);

/** Hesap kimliğinden ad. Bulunamazsa boş metin — "Bilinmeyen hesap" yazmak uydurmadır. */
export function hesabinAdi(hesaplar, hesapId) {
  const h = (Array.isArray(hesaplar) ? hesaplar : []).find((x) => x && String(x.id) === String(hesapId));
  return h ? metin(h.ad) : "";
}

/**
 * GİREN PARA — müşterilerden alınan tahsilatlar.
 * Marka durumu süzgeci YOK: alınan para alınmıştır, marka bugün dondurulmuş olsa bile.
 */
export function tahsilatDokumu({ clients, hesaplar, bas, bit } = {}) {
  const satirlar = [];
  let tarihsiz = 0;
  (Array.isArray(clients) ? clients : []).forEach((c) => {
    if (!c) return;
    (c.odemeKayitlari || []).forEach((k) => {
      if (!k) return;
      const ay = kaydinAyi(k);
      if (!ay) { tarihsiz += 1; return; }
      if (!araliktaMi(ay, bas, bit)) return;
      satirlar.push({
        ay,
        tarih: kaydinTarihi(k),
        kim: metin(c.ad),
        tutar: sayi(k.tutar),
        hesap: hesabinAdi(hesaplar, k.hesapId),
        not: metin(k.not),
      });
    });
  });
  satirlar.sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
  return { satirlar, toplam: satirlar.reduce((s, r) => s + r.tutar, 0), tarihsiz };
}

/** Ödeme/avans kaydının kime ait olduğu — kayıtta ad varsa o, yoksa tür etiketi. */
function kiminOdemesi(kayit) {
  const ad = metin(kayit && kayit.kisiAd);
  if (ad) return ad;
  const tur = metin(kayit && kayit.tur);
  if (tur === "personel") return "Personel";
  if (tur === "freelancer") return "Freelancer";
  return "";
}

/**
 * ÇIKAN PARA — yapılan ödemeler ve verilen avanslar.
 *
 * NOT: ofis gideri, üyelikler ve gider kalemleri BURADA YOK. Onlar tarihsiz kayıtlar
 * (yalnızca bugünkü aylık tutarları var), bir döneme yazılamazlar. Bkz. `lib/aylik-ozet.js`.
 */
export function odemeDokumu({ odemeler, avanslar, hesaplar, bas, bit } = {}) {
  const satirlar = [];
  let tarihsiz = 0;
  const ekle = (liste, tur) => (Array.isArray(liste) ? liste : []).forEach((o) => {
    if (!o) return;
    const ay = kaydinAyi(o);
    if (!ay) { tarihsiz += 1; return; }
    if (!araliktaMi(ay, bas, bit)) return;
    satirlar.push({
      ay,
      tarih: kaydinTarihi(o),
      kim: kiminOdemesi(o),
      tur,
      tutar: sayi(o.tutar),
      hesap: hesabinAdi(hesaplar, o.hesapId),
      not: metin(o.not),
    });
  });
  ekle(odemeler, "Ödeme");
  ekle(avanslar, "Avans");
  satirlar.sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
  return { satirlar, toplam: satirlar.reduce((s, r) => s + r.tutar, 0), tarihsiz };
}

/** Bir dönemin iki yönlü özeti — rapor başlıklarında kullanılıyor. */
export function donemOzeti({ clients, odemeler, avanslar, hesaplar, bas, bit } = {}) {
  const giren = tahsilatDokumu({ clients, hesaplar, bas, bit });
  const cikan = odemeDokumu({ odemeler, avanslar, hesaplar, bas, bit });
  return {
    giren, cikan,
    net: giren.toplam - cikan.toplam,
    tarihsiz: giren.tarihsiz + cikan.tarihsiz,
  };
}
