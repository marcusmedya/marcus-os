/**
 * İLERİYE DÖNÜK MALİ TAHMİN — "önümüzdeki aylarda ne olacak?"
 *
 * ----------------------------------------------------------------------------
 * NEDEN VAR
 *
 * Bütün para ekranları GERİYE bakıyordu: bu ay ne kazandım, geçen ay ne tahsil ettim,
 * ay ay karşılaştırma. Oysa bir markanın Ekim'de biteceğini bilen kişi, Ekim gelirinin
 * ne olacağını hiçbir ekranda göremiyordu. `bitisAyi` alanı (`lib/marka-donemi.js`)
 * o bilgiyi kayıtlı hale getirdi; bu modül onu ileriye doğru çalıştırıyor.
 *
 * ----------------------------------------------------------------------------
 * İKİ SERT KURAL
 *
 * 1. **GELİR `ayinUcreti(client, ay)` İLE HESAPLANIR, `client.aylikUcret` İLE DEĞİL.**
 *    Sebep `para.md`'de: bugünkü ücretle başka bir ayı hesaplamak, ücreti değişmiş
 *    markada yanlış tutar üretir. Geçmişte tam olarak bu yüzden tahsil edilmiş para
 *    "fazla ödeme" görünüyordu; ileri yönde de ücret dönemi bugünden sonra başlayan
 *    markada (zam kaydedilmiş, gelecek aydan geçerli) aynı hatayı üretirdi.
 *
 * 2. **GİDER DIŞARIDAN GELİR VE VERİLMEZSE SESSİZCE SIFIR YAZILMAZ.** Şirketin aylık
 *    gider toplamını `computeLive` hesaplıyor ve o `src/tema.jsx` içinde — `lib/`
 *    bir `.jsx` dosyasını import EDEMEZ (`marcus-mimari` §1). Bu yüzden `sabitGider`
 *    parametre olarak veriliyor. Verilmezse `gider` ve `net` **`null`** döner ve
 *    `varsayimlar` sebebi yazar. Sıfır yazmak gideri yok, kârı olduğundan yüksek
 *    gösterirdi — bu projenin tekrar tekrar reddettiği şey.
 *
 * ----------------------------------------------------------------------------
 * `dusenler` — RAKAM TEK BAŞINA "NEDEN DÜŞTÜ"YÜ CEVAPLAMAZ
 *
 * Bir ayın geliri bir öncekinden düşükse kullanıcı "hangi marka?" diye soruyor. Her ay
 * için, bir önceki ayda çalışıp O AY çalışmayan markalar ADIYLA ve o markanın bir
 * önceki aydaki ücretiyle listeleniyor. İlk ayın "önceki"si, başlangıç ayından bir
 * önceki aydır — yani bu ay biten bir marka da görünür.
 *
 * ----------------------------------------------------------------------------
 * `varsayimlar` — İNSAN DİLİYLE, EKSİK VERİ GİZLENMEDEN
 *
 * "Eksik bir dökümü tam gibi göstermek, hiç göstermemekten kötüdür." Sabit giderlerin
 * ay ay geçmişi yok (`lib/aylik-ozet.js` aynı şeyi söylüyor), bitiş ayı girilmemiş
 * marka süresiz sayılıyor, ücreti tanımsız marka sıfır sayılıyor — üçü de yazılıyor.
 *
 * SAF: `new Date` YOK (`baslangicAy` parametre), ağ yok, girdi DEĞİŞTİRİLMEZ.
 */
import { ayNormalle, ayKaydir } from "./aylik-ozet.js";
import { ayinUcreti } from "./marka-ucreti.js";
import { markaAydaAktifMi, markaninBitisAyi } from "./marka-donemi.js";

/* SONSUZ DÖNGÜYE KARŞI ÜST SINIR — `lib/ekstre.js` ve `lib/aylik-ozet.js` de aynı
 * korumayı taşıyor. Döngü `ayKaydir`in her turda ilerlemesine güveniyor; o bozulursa
 * (ya da çağıran uçuk bir `ayAdedi` verirse) tarayıcı KİLİTLENİR. Ölçüldü: koruma
 * yokken bozuk ay aritmetiği testi sonsuza soktu. */
export const ENFAZLA_AY = 600;                 // 50 yıl

/** Varsayılan ufuk — ekran da bunu kullanıyor. */
export const VARSAYILAN_AY_ADEDI = 6;

const sayi = (x) => Number(x) || 0;
const metin = (x) => String(x === null || x === undefined ? "" : x).trim();

/** Markanın ekranda görünecek adı. Belgede iki alan da dolaşıyor (`ad` ve `name`). */
function markaAdi(client) {
  return metin(client && (client.ad || client.name)) || "(adsız marka)";
}

/** `sabitGider` gerçekten VERİLDİ mi? `null`, `undefined` ve `""` "verilmedi" demek;
 *  `0` geçerli bir karardır ("bu ay sabit gider yok") ve sıfır olarak kullanılır. */
function giderVerildiMi(x) {
  if (x === null || x === undefined || x === "") return false;
  return Number.isFinite(Number(x));
}

/** Ay adedini güvenli aralığa çeker: en az 1, en fazla `ENFAZLA_AY`. */
export function ayAdediniSinirla(x) {
  const n = Math.floor(Number(x));
  if (!Number.isFinite(n) || n < 1) return VARSAYILAN_AY_ADEDI;
  return Math.min(n, ENFAZLA_AY);
}

/**
 * İLERİYE DÖNÜK TAHMİN.
 *
 * @param data                      belge — yalnızca `clients` okunuyor
 * @param opts.baslangicAy          "YYYY-AA" — ZORUNLU (saflık: `new Date` yok)
 * @param opts.ayAdedi              kaç ay ileriye bakılacak (varsayılan 6, üst sınır 600)
 * @param opts.sabitGider           şirketin aylık gider toplamı; verilmezse `gider: null`
 *
 * @returns {{aylar: Array<{ay:string, gelir:number, gider:number|null, net:number|null,
 *            markaSayisi:number, dusenler:Array<{ad:string,tutar:number}>}>,
 *           varsayimlar: string[]}}
 */
export function maliTahmin(data, opts = {}) {
  const { baslangicAy, ayAdedi, sabitGider } = opts;
  const clients = Array.isArray(data && data.clients) ? data.clients : [];
  const varsayimlar = [];

  const bas = ayNormalle(baslangicAy);
  if (!bas) {
    /* Başlangıç ayı çözülemedi. Uydurulmaz — `new Date()`e düşmek bu modülün saflığını
     * bozar ve testi takvime bağlar. Boş sonuç + sebep. */
    return {
      aylar: [],
      varsayimlar: ['Başlangıç ayı okunamadı ("YYYY-AA" bekleniyor), bu yüzden tahmin '
        + "üretilmedi. Ekranı yenilemek çözmezse bu bir hatadır."],
    };
  }

  const adet = ayAdediniSinirla(ayAdedi);
  const giderVar = giderVerildiMi(sabitGider);
  const gider = giderVar ? sayi(sabitGider) : null;

  const aylar = [];
  let oncekiAy = ayKaydir(bas, -1);
  let oncekiAktifler = oncekiAy
    ? clients.filter((c) => markaAydaAktifMi(c, oncekiAy))
    : [];

  let ucretiTanimsiz = 0;
  let bitisiYok = 0;

  for (let a = bas, tur = 0; a && tur < adet && tur < ENFAZLA_AY; a = ayKaydir(a, 1), tur++) {
    const aktifler = clients.filter((c) => markaAydaAktifMi(c, a));
    const gelir = aktifler.reduce((s, c) => s + sayi(ayinUcreti(c, a)), 0);

    aktifler.forEach((c) => {
      if (sayi(ayinUcreti(c, a)) <= 0) ucretiTanimsiz++;
      if (markaninBitisAyi(c) === null) bitisiYok++;
    });

    /* DÜŞENLER — bir önceki ayda çalışıp bu ay çalışmayanlar. Tutar, markanın BİR
     * ÖNCEKİ aydaki ücretidir: kaybolan gelir odur, bu ayki (sıfır) değil. */
    const kimlik = (c) => String(c && c.id !== undefined && c.id !== null ? c.id : markaAdi(c));
    const buAykiler = new Set(aktifler.map(kimlik));
    const dusenler = oncekiAktifler
      .filter((c) => !buAykiler.has(kimlik(c)))
      .map((c) => ({ ad: markaAdi(c), tutar: sayi(ayinUcreti(c, oncekiAy)) }));

    aylar.push({
      ay: a,
      gelir,
      gider,
      net: giderVar ? gelir - gider : null,
      markaSayisi: aktifler.length,
      dusenler,
    });

    oncekiAy = a;
    oncekiAktifler = aktifler;
  }

  /* ── VARSAYIMLAR — insan diliyle, eksik olan gizlenmeden ──────────────────── */
  varsayimlar.push("Gelir, her markanın O AYDA geçerli ücretiyle hesaplandı "
    + "(ücret geçmişiyle) — bugünkü ücretle değil.");

  if (giderVar) {
    varsayimlar.push("Giderler bugünkü değerlerle hesaplandı — sabit giderlerin ay ay "
      + "geçmişi sistemde yok, bu yüzden her ay aynı tutar varsayıldı.");
  } else {
    varsayimlar.push("Gider toplamı bu hesaba geçirilemedi, bu yüzden gider ve net "
      + "satırları boş bırakıldı. Sıfır yazılmadı: sıfır gider, kârı olduğundan "
      + "yüksek gösterirdi.");
  }

  if (bitisiYok > 0) {
    varsayimlar.push(`Bitiş ayı girilmemiş markalar süresiz sayıldı (${bitisiYok} `
      + "marka–ay). Bir markanın biteceğini biliyorsan müşteri kartına Bitiş Ayı yaz.");
  }
  if (ucretiTanimsiz > 0) {
    varsayimlar.push(`${ucretiTanimsiz} marka–ayda aylık ücret tanımlı değil ve sıfır `
      + "sayıldı — tahmin edilen gelir olduğundan düşük olabilir.");
  }
  if (clients.length === 0) {
    varsayimlar.push("Hiç müşteri kaydı okunamadı, bu yüzden gelir sıfır çıktı.");
  }

  return { aylar, varsayimlar };
}

/**
 * Tahminin düşen markalarını tek listede toplar — ekrandaki "Düşen markalar" bölümü
 * bunu çiziyor. Ay bilgisi korunur, yoksa "hangi ay?" sorusu cevapsız kalır.
 */
export function dusenMarkaSatirlari(tahmin) {
  const aylar = (tahmin && Array.isArray(tahmin.aylar)) ? tahmin.aylar : [];
  const satirlar = [];
  aylar.forEach((r) => {
    (r.dusenler || []).forEach((d) => satirlar.push({ ay: r.ay, ad: d.ad, tutar: d.tutar }));
  });
  return satirlar;
}
