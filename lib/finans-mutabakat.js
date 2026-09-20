/* ------------------------------------------------------------------ */
/* FİNANS MUTABAKATI — gerçek migrasyonun önündeki KAPI                 */
/* ------------------------------------------------------------------ */
/**
 * `lib/finans-hareketleri.js` belgedeki para kayıtlarını tek biçime çeviriyor. Bu modül
 * tek bir soruyu cevaplıyor: **yeni biçim, bugün ekranda görünen rakamların AYNISINI
 * veriyor mu?** Vermiyorsa geçiş yapılmaz.
 *
 * NEDEN BİR KAPI GEREKİYOR: bu projede en pahalı hata sınıfı "aynı dönemi iki ekran
 * farklı topluyor" (para.md). Bir migrasyon, tam olarak o durumu ÜRETMEK için en uygun
 * andır: eski ekranlar eski listeden, yeni ekranlar yeni listeden okur ve fark aylar
 * sonra fark edilir. Bu yüzden fark SIFIR olana kadar `bloke: true`.
 *
 * ESKİ TARAF YENİDEN HESAPLANMAZ. Rakamlar mevcut motorlardan OLDUĞU GİBİ okunuyor:
 *   · `computeLive` (`src/tema.jsx`)        → gider parçaları, ek gelir, bekleyen alacak
 *   · `hesapBakiyesi` (`src/finans.jsx`)    → hesap bakiyeleri
 *   · `lib/para-hareketleri.js`             → tahsilat ve ödeme dökümü + tarihsiz sayaçları
 *   · `lib/ekstre.js`                       → fatura toplamı
 *
 * İKİSİ `.jsx` İÇİNDE VE NODE'DAN İMPORT EDİLEMİYOR (`marcus-mimari` §1: `src/` Node'dan
 * import edilemez). Bu yüzden `computeLive` ve `hesapBakiyesi` DIŞARIDAN VERİLİR. Kopyasını
 * buraya yazmak, önlemeye çalıştığımız ikinci kaynağın ta kendisi olurdu. Verilmezlerse
 * karşılaştırma yapılamaz ve modül **fail-close** davranır: `bloke: true`, sebebi yazılı.
 *
 * SAF: ağ yok, `Date` yok, yan etki yok; `data` ve `hareketler` DEĞİŞTİRİLMEZ.
 *
 * ----------------------------------------------------------------------------
 * BİLEREK KARŞILAŞTIRILMAYAN TEK RAKAM: ÜYELİĞİN AYLIK KARŞILIĞI
 *
 * `computeLive` yıllık üyeliği `tutar / 12` diye aylığa çeviriyor ve efektif aktifliği
 * bitiş tarihine bakarak belirliyor (`uyelikEfektifAktifMi`). İkisi de arayüz katmanında
 * yaşayan kurallar. Hareket katmanı üyeliğin KAYITLI tutarını taşıyor; o iki kuralın
 * üçüncü bir kopyasını buraya yazmak, bu dosyanın var oluş sebebiyle çelişirdi.
 *
 * Bu yüzden para satırı üyeliği DIŞARIDA bırakır ("Aylık gider — üyelik hariç") ve
 * üyelik ayrıca SAYIYLA mutabakata girer: dönüşümde bir üyelik kaybolursa yakalanır,
 * rakamı ise dönüştürüldüğü yerde (ekran katmanında) ölçülür.
 */
import { tahsilatDokumu, odemeDokumu } from "./para-hareketleri.js";
import { ekstreUret, ayNormalle } from "./ekstre.js";
import { ustKaynak, kayitAnahtari } from "./finans-hareketleri.js";

const dizi = (x) => (Array.isArray(x) ? x : []);
const sayi = (x) => Number(x) || 0;

/* Kuruş altı kayan nokta gürültüsü fark sayılmasın: 0.1 + 0.2 farkı bir mutabakatsızlık
 * değildir. Kuruş ve üstü her fark BLOKE EDER. */
const yuvarla = (x) => Math.round(sayi(x) * 100) / 100;

/** `computeLive`'daki aktif müşteri ölçütü — gelir ve gider AYNI kümeden hesaplanır. */
const markaAktifMi = (c) => Boolean(c) && c.durum !== "ayrildi" && c.durum !== "donduruldu";

/** Verilen süzgece uyan hareketlerin tutar toplamı. Tutarı bilinmeyen (`null`) hareket
 * toplamı BOZMAZ, sıfır sayılır — ama `eksikBilgi` taşıdığı için kaybolmuş olmaz. */
function hareketToplami(hareketler, suzgec) {
  return dizi(hareketler).reduce((s, h) => (h && suzgec(h) ? s + sayi(h.tutar) : s), 0);
}

/** Bir markanın ekstresini kapsayacak ay aralığı — kayıtların kendisinden çıkarılır.
 * Sabit bir aralık yazmak, aralığın dışındaki faturaları sessizce dışarıda bırakırdı. */
function markaninAyAraligi(client) {
  const aylar = [
    ayNormalle(client && client.baslangic),
    ...dizi(client && client.faturalar).map((f) => ayNormalle(f && f.ay)),
    ...dizi(client && client.odemeKayitlari).map((k) => ayNormalle(k && k.ay)),
  ].filter(Boolean).sort();
  return aylar.length ? { bas: aylar[0], bit: aylar[aylar.length - 1] } : null;
}

/** ESKİ fatura toplamı — `lib/ekstre.js` ile, marka marka. */
function eskiFaturaToplami(clients) {
  return dizi(clients).reduce((s, c) => {
    if (!c) return s;
    const aralik = markaninAyAraligi(c);
    if (!aralik) return s;
    const ekstre = ekstreUret(c, { baslangicAy: aralik.bas, bitisAy: aralik.bit });
    return s + sayi(ekstre.toplam.faturaliTutar);
  }, 0);
}

/**
 * ESKİ MOTORLA YENİ HAREKETLERİ YAN YANA KOYAR.
 *
 * @param data        Uygulama belgesi (DEĞİŞTİRİLMEZ)
 * @param hareketler  `finansHareketleri(...).hareketler`
 * @param secenekler  `{ live, hesapBakiyesi, donusturulmeTarihi }` — ilk ikisi `.jsx`
 *                    içinde yaşadığı için dışarıdan verilir (yukarıdaki nota bak).
 *                    `donusturulmeTarihi` "YYYY-AA-GG"; freelancer satırı AY bazlı
 *                    olduğu için gerekli ve modül `new Date()` çağırmaz.
 * @returns { esitMi, satirlar, bloke, sebepler }
 */
export function finansMutabakati(data, hareketler, secenekler = {}) {
  const belge = data && typeof data === "object" ? data : {};
  const liste = dizi(hareketler);
  const { live, hesapBakiyesi, donusturulmeTarihi } = secenekler || {};

  const satirlar = [];
  const sebepler = [];
  const satir = (ad, eski, yeni) => {
    const e = yuvarla(eski);
    const y = yuvarla(yeni);
    satirlar.push({ ad, eski: e, yeni: y, fark: yuvarla(y - e) });
  };

  const clients = dizi(belge.clients);
  const hesaplar = dizi(belge.hesaplar);

  /* ── 1 · TAHSİLAT — `lib/para-hareketleri.js` ────────────────────────────
   * Döküm tarihi çözülemeyen kaydı listeye ALMIYOR ama SAYIYOR. Yeni taraf da aynı
   * ayrımı yapmalı, yoksa iki rakam "aynı şeyi" söylemiyor olur. Bu yüzden iki satır:
   * dönemli tutar ve tarihsiz KAYIT SAYISI. */
  const eskiTahsilat = tahsilatDokumu({ clients, hesaplar });
  satir("Tahsilat toplamı (dönemli)", eskiTahsilat.toplam,
    hareketToplami(liste, (h) => h.tur === "tahsilat" && h.donem));
  satir("Tarihsiz tahsilat kaydı (adet)", eskiTahsilat.tarihsiz,
    liste.filter((h) => h.tur === "tahsilat" && !h.donem).length);

  /* ── 2 · ÖDEME + AVANS ───────────────────────────────────────────────── */
  const eskiOdeme = odemeDokumu({
    odemeler: belge.personelOdemeleri, avanslar: belge.avanslar, hesaplar,
  });
  satir("Ödeme toplamı (dönemli, avans dahil)", eskiOdeme.toplam,
    hareketToplami(liste, (h) => h.tur === "odeme" && h.donem));
  satir("Tarihsiz ödeme kaydı (adet)", eskiOdeme.tarihsiz,
    liste.filter((h) => h.tur === "odeme" && !h.donem).length);

  /* AVANS İKİNCİ KEZ GİDER SAYILMASIN — bu satır tam olarak onu bekler: avans
   * hareketleri `tur: "odeme"` olduğu için gider toplamında HİÇ görünmemeli. */
  satir("Avansın gider toplamındaki payı (0 olmalı)", 0,
    hareketToplami(liste, (h) => h.tur === "gider" && h.kategori === "avans"));

  /* ── 3 · FATURA — `lib/ekstre.js` ───────────────────────────────────── */
  satir("Fatura toplamı", eskiFaturaToplami(clients),
    hareketToplami(liste, (h) => h.tur === "fatura"));

  /* ── 4 · `computeLive` PARÇALARI ─────────────────────────────────────── */
  if (!live || typeof live !== "object") {
    sebepler.push("Eski motorun çıktısı (`computeLive`) verilmedi — gider, gelir ve "
      + "bekleyen alacak satırları karşılaştırılamadı. Karşılaştırılamayan rakam "
      + "'tutuyor' sayılmaz.");
  } else {
    satir("Gider kalemleri", live.giderKalemToplam,
      hareketToplami(liste, (h) => h.kaynakAlan === "giderKalemleri"));
    satir("Ofis giderleri", live.ofisGiderToplam,
      hareketToplami(liste, (h) => h.kaynakAlan === "ofisGiderleri"));

    /* Marka maliyetleri YALNIZCA aktif markalardan sayılıyor (`computeLive`): gelir ve
     * gider aynı kümeden gelmezse dondurulmuş marka her ay zarar yazar. Hareket katmanı
     * ise HİÇBİR markayı elemez — geçmiş kayıt korunur. Eleme burada, karşılaştırma
     * anında yapılıyor. */
    const aktifAnahtarlar = new Set(
      clients.map((c, i) => (markaAktifMi(c) ? kayitAnahtari(c, i).anahtar : null)).filter(Boolean));
    satir("Marka maliyetleri (aktif markalar)", live.clientCosts,
      hareketToplami(liste, (h) => h.kaynakAlan === "clients.maliyetler"
        && aktifAnahtarlar.has(ustKaynak(h))));

    satir("Personel gideri", live.personelGideri,
      hareketToplami(liste, (h) => h.kaynakAlan === "personel"));

    const buAy = String(donusturulmeTarihi || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(buAy)) {
      sebepler.push("Dönüştürülme tarihi verilmedi ya da 'YYYY-AA-GG' biçiminde değil — "
        + "freelancer hak edişi AY bazlı olduğu için karşılaştırılamadı.");
    } else {
      satir("Freelancer hak edişi (bu ay)", live.freelancerGideri,
        hareketToplami(liste, (h) => h.tur === "hakedis" && h.donem === buAy));
      satir("Aylık gider (üyelik aylık karşılığı hariç)",
        sayi(live.gider) - sayi(live.uyelikGideri),
        hareketToplami(liste, (h) => (h.tur === "gider"
          && h.kaynakAlan !== "uyelikler"
          && (h.kaynakAlan !== "clients.maliyetler" || aktifAnahtarlar.has(ustKaynak(h))))
          || (h.tur === "hakedis" && h.donem === buAy)));
    }

    satir("Ek gelir kalemleri", live.extra,
      hareketToplami(liste, (h) => h.tur === "gelir"));
    satir("Bekleyen alacak (elle girilen)", live.manuelBekleyen,
      hareketToplami(liste, (h) => h.tur === "bekleyen"));
  }

  /* Üyelik: tutarı değil SAYISI mutabık olmalı (yukarıdaki nota bak). */
  satir("Üyelik kaydı (adet)", dizi(belge.uyelikler).length,
    liste.filter((h) => h.kaynakAlan === "uyelikler").length);

  /* ── 5 · TRANSFER NE GELİR NE GİDER ──────────────────────────────────── */
  satir("Transferin gelir toplamındaki payı (0 olmalı)", 0,
    hareketToplami(liste, (h) => h.tur === "gelir" && h.kaynakAlan === "hesapTransferleri"));
  satir("Transferin gider toplamındaki payı (0 olmalı)", 0,
    hareketToplami(liste, (h) => h.tur === "gider" && h.kaynakAlan === "hesapTransferleri"));
  /* Transfer iki bacaklı: çıkan ile giren EŞİT olmalı. Eşit değilse bir bacak kaybolmuş
   * demektir ve hiçbir bakiye tutmaz. */
  satir("Transfer çıkış − giriş (0 olmalı)", 0,
    hareketToplami(liste, (h) => h.tur === "transfer" && h.kategori === "cikis")
    - hareketToplami(liste, (h) => h.tur === "transfer" && h.kategori === "giris"));

  /* ── 6 · HESAP BAKİYELERİ ────────────────────────────────────────────── */
  if (typeof hesapBakiyesi !== "function") {
    sebepler.push("Eski bakiye hesabı (`hesapBakiyesi`) verilmedi — hesap bakiyeleri "
      + "karşılaştırılamadı.");
  } else {
    hesaplar.forEach((h) => {
      if (!h) return;
      const eski = hesapBakiyesi(h.id, {
        clients,
        transferler: belge.hesapTransferleri,
        avanslar: belge.avanslar,
        odemeler: belge.personelOdemeleri,
        hesaplar,
        duzeltmeler: belge.hesapDuzeltmeleri,
      });
      /* Elle takip edilen hesapta tahsilatlar bakiyeye GİRMEZ — para oraya kaydedilmeden
       * gidiyor. Kural `hesapBakiyesi`'nde; burada yalnızca aynı ayrım uygulanıyor. */
      const girisler = h.elleTakip ? 0
        : hareketToplami(liste, (x) => x.tur === "tahsilat" && x.hesapId === h.id);
      const yeni = girisler
        + hareketToplami(liste, (x) => x.tur === "transfer" && x.kategori === "giris" && x.hesapId === h.id)
        - hareketToplami(liste, (x) => x.tur === "transfer" && x.kategori === "cikis" && x.hesapId === h.id)
        - hareketToplami(liste, (x) => x.tur === "odeme" && x.hesapId === h.id)
        + hareketToplami(liste, (x) => x.tur === "duzeltme" && x.hesapId === h.id);
      satir(`Hesap bakiyesi — ${String(h.ad || h.id)}`, eski, yeni);
    });
  }

  /* ── SONUÇ ───────────────────────────────────────────────────────────── */
  satirlar.forEach((s) => {
    if (s.fark === 0) return;
    sebepler.push(`${s.ad}: eski ${s.eski}, yeni ${s.yeni} — fark ${s.fark}.`);
  });

  const esitMi = satirlar.every((s) => s.fark === 0);
  /* FAIL-CLOSE: yalnızca "hiçbir satır tutmuyor" değil, "karşılaştıramadım" da bloke eder.
   * Ölçülmemiş bir rakamı tutuyor saymak, bu projenin en pahalı hata sınıfı. */
  return { esitMi, satirlar, bloke: !esitMi || sebepler.length > 0, sebepler };
}
