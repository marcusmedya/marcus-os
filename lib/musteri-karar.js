/* ------------------------------------------------------------------ */
/* MÜŞTERİ DETAYI — KARAR ŞERİDİ, ROZETLER VE KİMLİK SATIRI            */
/* ------------------------------------------------------------------ */
/**
 * Müşteri detay panelinin ÜST BLOĞU ne gösterecek? Bu bir görünürlük kuralı ve
 * eskiden tamamı `src/App.jsx` içindeki JSX'e gömülüydü: ödeme kutusu, gecikme
 * kutusu ve "ödeme günü tanımlı değil" satırı birbirinden habersiz üç `&&` dalıydı.
 * Sonuç, üç aydır ödemeyen bir markada ekranda AYNI ANDA iki kutu ve iki birincil
 * düğme çizilmesiydi — hangisinin asıl karar olduğu okunmuyordu.
 *
 * Daha önemlisi: JSX'e gömülü bir kural Node'dan ÇAĞRILAMIYOR, yani hiçbir test onu
 * sınayamıyor (`marcus-mimari` §4 — bu sınıftan dört hata çıktı ve hepsi ancak sahada
 * görüldü). Kural bu yüzden buraya alındı; JSX yalnızca çağırıyor ve çizim yapıyor.
 *
 * ÜÇ KURAL:
 *
 *  1. **Aynı anda TEK şerit.** En ağır olan kazanır:
 *     gecikme > ödeme uyarısı > ödeme günü yok > sakin.
 *  2. **Sağlıklı markada birincil eylem ÜRETİLMEZ.** "Ekranda tek birincil eylem"
 *     kuralının karşılığı: yapılacak bir şey yoksa düğme de yok. `eylem: null`.
 *  3. **Uydurma sayı yok.** Başlangıç ayı okunamıyorsa "N. ay" parçası hiç yazılmaz;
 *     ücreti girilmemiş markada faturalama rozeti çizilmez (faturalanacak bedel yok).
 *
 * Bu dosya SAF: verilen veriyi değiştirmez, yeni nesne döndürür. Hesap yapmaz —
 * `clientPaymentStatus`, `clientOverdueMonths`, `clientOverdueBalance`,
 * `clientFaturaliTutar` çağıranda hesaplanır ve buraya SONUÇ olarak verilir.
 * Burası yalnızca "ekranda hangi karar görünsün" sorusunu cevaplar.
 */

/** Şerit türleri — hangi kutunun çizileceği. */
export const SERIT = {
  GECIKME: "gecikme",
  ODEME_UYARISI: "odemeUyarisi",
  ODEME_GUNU_YOK: "odemeGunuYok",
  SAKIN: "sakin",
};

/** Birincil eylemler. Çağıran taraf bu anahtara göre hangi işi bağlayacağını bilir. */
export const EYLEM = {
  TEBLIG: "teblig",
  ODEME_KAYDET: "odemeKaydet",
  ODEME_GUNU_EKLE: "odemeGunuEkle",
};

/** Ton adları. Renk jetonuna çevirmek çağıranın işi — bu dosya `T`'yi tanımaz. */
export const TON = {
  TEHLIKE: "tehlike",
  UYARI: "uyari",
  BASARI: "basari",
  VURGU: "vurgu",
  NOTR: "notr",
};

/**
 * Ödeme rozetinin SÖZCÜĞÜ — Müşteriler tablosundakiyle birebir aynı.
 * Ayrı yazılsaydı iki yüzey aynı durumu farklı adlandırırdı; bu projede aynı eylemin
 * her yerde aynı adla anılması kural (`marcus-design` → kompozisyon §7).
 */
export const ODEME_SOZCUGU = {
  odendi: "Ödendi",
  yaklasiyor: "Yaklaşıyor",
  bekliyor: "Bekliyor",
  gecikti: "Gecikti",
};

const ODEME_TONU = {
  odendi: TON.BASARI,
  yaklasiyor: TON.NOTR,
  bekliyor: TON.UYARI,
  gecikti: TON.TEHLIKE,
};

/** Müşteri durumunun tonu — `CLIENT_DURUM` etiketleriyle aynı anlam. */
export const DURUM_TONU = {
  aktif: TON.BASARI,
  yeni: TON.VURGU,
  donduruldu: TON.UYARI,
  ayrildi: TON.NOTR,
};

const sayi = (x) => Number(x) || 0;

/**
 * Panelin üstünde hangi karar şeridi çizilecek?
 *
 * Girdi hesaplanmış DEĞERLERDİR, müşteri kaydı değil: böylece hesap yapan fonksiyonlara
 * (ve dolayısıyla bugünün tarihine) hiç bağımlı değil, test edilebilir.
 *
 * @param {object} girdi
 * @param {number} girdi.gecikenAy        `clientOverdueMonths` sonucu
 * @param {number} girdi.gecikenBakiye    `clientOverdueBalance` sonucu
 * @param {number} girdi.aylikUcret       markanın bugünkü aylık ücreti
 * @param {?object} girdi.odemeDurumu     `clientPaymentStatus` sonucu ({status,label}) ya da null
 * @param {*} girdi.odemeGunu             `client.odemeGunu`
 */
export function musteriKararSeridi({
  gecikenAy = 0, gecikenBakiye = 0, aylikUcret = 0, odemeDurumu = null, odemeGunu = null,
} = {}) {
  const ay = sayi(gecikenAy);

  /* 1 · GECİKME — en ağır hâl. Tek 28px rakam BURADA, başka hiçbir yerde:
   * "kaç ay" değil "ne kadar" karar verdiriyor. Bakiye `clientOverdueBalance`'tan
   * geliyor, `aylikUcret × ay` çarpımından DEĞİL (→ marcus-operasyon/para.md). */
  if (ay > 0) {
    return {
      serit: SERIT.GECIKME,
      ton: TON.TEHLIKE,
      baslik: `${ay} aydır ödenmedi`,
      vurguEtiketi: "Kalan bakiye",
      vurguTutar: sayi(gecikenBakiye),
      yanEtiketi: "Yeni ay ücreti",
      yanTutar: sayi(aylikUcret),
      eylem: { anahtar: EYLEM.TEBLIG, ad: "Tebliğ oluştur" },
    };
  }

  const durum = odemeDurumu && odemeDurumu.status;

  /* 2 · ÖDEME UYARISI — metin AYNEN `clientPaymentStatus`'tan gelir.
   * Kendi cümlemizi kursaydık kısmi ödeme notu ("— kalan ₺12.000") kaybolurdu. */
  if (durum === "gecikti" || durum === "bekliyor") {
    return {
      serit: SERIT.ODEME_UYARISI,
      ton: TON.UYARI,
      baslik: odemeDurumu.label,
      vurguEtiketi: null, vurguTutar: null, yanEtiketi: null, yanTutar: null,
      eylem: { anahtar: EYLEM.ODEME_KAYDET, ad: "Ödemeyi kaydet" },
    };
  }

  /* 3 · ÖDEME GÜNÜ YOK — sessiz bir eksik. Ekranda söylenmezse kullanıcı takibin
   * çalıştığını sanır; bu panelin kendisi "bu marka ödedi mi" diye bakılan yer. */
  if (!odemeGunu) {
    return {
      serit: SERIT.ODEME_GUNU_YOK,
      ton: TON.NOTR,
      baslik: "Ödeme günü tanımlı değil — otomatik takip başlamıyor.",
      vurguEtiketi: null, vurguTutar: null, yanEtiketi: null, yanTutar: null,
      eylem: { anahtar: EYLEM.ODEME_GUNU_EKLE, ad: "Ödeme günü ekle" },
    };
  }

  /* 4 · SAKİN — ödendi ya da vadesi yaklaşıyor. BİRİNCİL DÜĞME ÇİZİLMEZ.
   * Yapılacak bir şey yokken düğme koymak, gerçekten karar isteyen markalarda
   * düğmenin anlamını yok ediyor. */
  return {
    serit: SERIT.SAKIN,
    ton: TON.NOTR,
    baslik: (odemeDurumu && odemeDurumu.label) || "Ödeme takibi açık.",
    vurguEtiketi: null, vurguTutar: null, yanEtiketi: null, yanTutar: null,
    eylem: null,
  };
}

/**
 * Faturalama SAPMASI — rozet yalnızca sapma varsa çizilir.
 *
 * "Tamamen faturalı" beklenen hâldir; onu da rozetleyince kimlik şeridinde her marka
 * için üç rozet doluyor ve gerçekten dikkat isteyen (kısmi/faturasız) markalar
 * diğerlerinden ayırt edilemiyordu. Ücreti girilmemiş markada faturalanacak bedel
 * yoktur — rozet uydurulmaz.
 *
 * ROZET İÇİNE RAKAM YAZILMAZ: tutarlar para satırına ait.
 */
export function faturaSapmasi({ aylikUcret = 0, faturaliTutar = 0 } = {}) {
  const ucret = sayi(aylikUcret);
  if (ucret <= 0) return null;
  const fatura = sayi(faturaliTutar);
  if (fatura >= ucret) return null;
  if (fatura <= 0) return { anahtar: "fatura", metin: "Faturasız", ton: TON.NOTR };
  return { anahtar: "fatura", metin: "Kısmi faturalı", ton: TON.UYARI };
}

/**
 * Kimlik şeridinin rozetleri — EN FAZLA ÜÇ: durum · ödeme durumu · faturalama sapması.
 * Sınır `slice` ile de garanti altında: listeye dördüncü bir rozet eklenirse sessizce
 * şeride sızmaz, testte düşer.
 */
export function musteriRozetleri({
  durum = null, durumEtiketi = null, odemeDurumu = null, aylikUcret = 0, faturaliTutar = 0,
} = {}) {
  const liste = [];

  if (durumEtiketi) {
    liste.push({ anahtar: "durum", metin: durumEtiketi, ton: DURUM_TONU[durum] || TON.NOTR });
  }

  const d = odemeDurumu && odemeDurumu.status;
  if (d && ODEME_SOZCUGU[d]) {
    liste.push({ anahtar: "odeme", metin: ODEME_SOZCUGU[d], ton: ODEME_TONU[d] || TON.NOTR });
  }

  const fatura = faturaSapmasi({ aylikUcret, faturaliTutar });
  if (fatura) liste.push(fatura);

  return liste.slice(0, 3);
}

/**
 * Markayla kaçıncı aydır çalışıldığı. `client.baslangic` "YYYY-MM" biçiminde
 * (CLIENT_FIELDS'te `type: "month"`), ama eski kayıtlarda gün de eklenmiş olabiliyor.
 *
 * Okunamayan ya da GELECEKTEKİ bir başlangıçta `null` döner — sayı uydurulmaz.
 * Başlangıç ayının kendisi 1. aydır.
 */
export function calismaAyi(baslangic, bugun = new Date()) {
  const eslesme = /^(\d{4})-(\d{1,2})/.exec(String(baslangic == null ? "" : baslangic).trim());
  if (!eslesme) return null;
  const yil = Number(eslesme[1]);
  const ay = Number(eslesme[2]);
  if (!(ay >= 1 && ay <= 12)) return null;
  const fark = (bugun.getFullYear() - yil) * 12 + (bugun.getMonth() + 1 - ay);
  if (fark < 0) return null;
  return fark + 1;
}

/**
 * Marka adının ALTINDAKİ satır: `kategori · başlangıç · N. ay`.
 *
 * Parçalar yazı tipiyle birlikte dönüyor (`tur: "sayi"` → mono + tabular-nums), çünkü
 * "her rakam mono" kuralı çizim tarafında tek tek hatırlanmak zorunda kalırsa
 * unutuluyor. Olmayan parça HİÇ yazılmaz — boş bir "·" ayıracı bırakmaz.
 */
export function kimlikParcalari({ kategori = "", baslangic = "" } = {}, bugun = new Date()) {
  const parcalar = [];
  const k = String(kategori || "").trim();
  if (k) parcalar.push({ tur: "metin", metin: k });
  const b = String(baslangic || "").trim();
  if (b) parcalar.push({ tur: "sayi", metin: b });
  const ay = calismaAyi(baslangic, bugun);
  if (ay) parcalar.push({ tur: "sayi", metin: `${ay}. ay` });
  return parcalar;
}
