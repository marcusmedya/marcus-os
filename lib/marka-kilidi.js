/**
 * MARKA KİLİDİ — ORTAK KATMAN
 * ===========================
 * api/ klasörünün DIŞINDA olduğu için Vercel fonksiyon sayısını etkilemez (12/12 korunur).
 *
 * Bir personel hesabına "markalar" listesi tanımlandığında (dışarıdan çalışan iş ortağı gibi),
 * o hesap yalnızca o markaların verisini görebilmeli ve YALNIZCA onlara yazabilmelidir.
 *
 * Bu dosya tek doğruluk kaynağıdır: api/data.js, api/paylasim.js ve api/client-payment.js
 * aynı kuralları buradan kullanır. Kurallar tek yerde olmazsa, bir uç noktada unutulan kontrol
 * sessiz bir veri sızıntısına ya da başka markanın verisinin silinmesine yol açar.
 */

export const trKucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/**
 * MARKA ADI EŞLEŞTİRME ANAHTARI
 *
 * Markalar işlerde, reklamlarda ve müşteri kaydında AYRI AYRI metin olarak yazılıyor. Aynı
 * markanın iki yerde farklı yazılması, o markanın içeriğinin müşteri paneline hiç düşmemesine
 * yol açıyordu — sessizce, hiçbir uyarı vermeden.
 *
 * Gerçekte kırılan üç durum:
 *   "KANATÇI DIREN"  (büyük İ yerine I)   → Türkçe küçültmede "dıren" olur, eşleşmez
 *   "Kanatçı  Diren" (çift boşluk)
 *   "Kanatci Diren"  (Türkçe karakter yazılmamış)
 *
 * Bu anahtar üçünü de tolere eder: boşluklar sadeleşir, Türkçe harfler ASCII karşılığına
 * indirgenir. DİKKAT: bu, iki FARKLI markanın aynı anahtara düşme ihtimalini doğurur; o yüzden
 * kullanan taraf çakışma kontrolü yapmalı (bkz. markaEslestirici).
 */
export function markaAnahtari(x) {
  return String(x || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/i̇/g, "i")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o")
    .replace(/ş/g, "s").replace(/ü/g, "u");
}

/**
 * Bir müşteri listesi için "bu metin bu markaya mı ait?" sorusunu cevaplayan bir fonksiyon
 * üretir.
 *
 * Toleranslı anahtar kullanır; ANCAK iki farklı müşteri aynı anahtara düşüyorsa (örneğin
 * "Cem" ve "Çem") o markalar için TAM eşleşmeye döner. Aksi halde bir markanın içeriği
 * yanlışlıkla başka bir müşteriye gösterilebilirdi — bu bir gizlilik sorunudur.
 */
export function markaEslestirici(clients, markaAdi) {
  const sayac = {};
  (clients || []).forEach((c) => {
    const k = markaAnahtari(c.ad);
    sayac[k] = (sayac[k] || 0) + 1;
  });
  const kendiAnahtar = markaAnahtari(markaAdi);
  const cakisiyor = (sayac[kendiAnahtar] || 0) > 1;

  if (cakisiyor) {
    // Belirsizlik varsa güvenli tarafta kal: yalnızca birebir aynı yazım eşleşsin.
    return (deger) => trKucult(deger) === trKucult(markaAdi);
  }
  return (deger) => markaAnahtari(deger) === kendiAnahtar;
}

/**
 * Marka kilitli bir hesabın kullanabileceği izinler.
 *
 * Kilit "dışarıdan biri" anlamına geldiği için, ajans geneli bölümler (Finans, Personel,
 * Dashboard, Birikim, Ödeme Takvimi, Teklif) izin verilmiş olsa bile YOK SAYILIR. Bu bölümlerin
 * verisi markaya göre süzülemez — ajansın tamamına aittir.
 */
export const KILITLI_IZINLER = ["paylasimlar", "cekimListesi", "cekimEdit", "reklamlar", "uyelikler", "sifreKasasi", "takvim"];

/**
 * Marka kilitli hesaba ASLA gönderilmeyen ajans geneli alanlar.
 * Markaya göre süzülemedikleri için tamamen çıkarılırlar.
 */
export const AJANS_GENELI_ALANLAR = [
  "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "monthly", "vergiTakvimi",
  "personel", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri", "birikimler",
  "islemGecmisi", "teklifSablonlari", "sozlesmeSablonlari", "kisiselGorevler",
  "isUcretleri", "isUcretDetaylari", "avanslar", "freelancerlar", "personelOdemeleri",
  "silinenler",
];

/** İzin haritasını kilitli hesap için daraltır. */
export function izinleriDaralt(perms, kilitliMi) {
  if (!kilitliMi) return perms;
  const daraltilmis = {};
  Object.keys(perms || {}).forEach((k) => { daraltilmis[k] = KILITLI_IZINLER.includes(k) ? perms[k] : false; });
  return daraltilmis;
}

/**
 * Bir hesabın erişebileceği müşteri kimliklerini döndürür.
 * Liste boşsa null döner — "kilit yok, hepsi görünür" demektir.
 */
export function izinliIdSeti(data, izinliMarkalar) {
  if (!Array.isArray(izinliMarkalar) || izinliMarkalar.length === 0) return null;
  const adSeti = new Set(izinliMarkalar.map(trKucult));
  const idler = (data.clients || []).filter((c) => adSeti.has(trKucult(c.ad))).map((c) => String(c.id));
  return { adSeti, idSeti: new Set(idler) };
}

/**
 * Marka bilgisi taşıyan TÜM koleksiyonlar ve bu bilginin hangi alanda tutulduğu.
 * Yeni bir alan eklendiğinde buraya da eklenmeli — aksi halde kilitli hesaba sızar.
 */
const DIZI_ALANLARI = [
  { ad: "reklamlar", marka: "marka" },
  { ad: "cekimIsleri", marka: "marka" },
  { ad: "markalasmaSurecleri", marka: "marka" },
  { ad: "teklifler", marka: "marka" },
  { ad: "uyelikler", marka: "marka" },
  { ad: "bekleyenTahsilatlar", marka: "musteri" },
  { ad: "haftalikPaylasimlar", client: "clientId" },
  { ad: "musteriIcerikleri", client: "clientId" },
  { ad: "hesapOlcumleri", client: "clientId" },
  { ad: "subeler", client: "clientId", marka: "marka" },
  { ad: "paylasimGecmisi", client: "clientId", marka: "marka" },
  { ad: "gunlukKontrol", client: "clientId", marka: "marka" },
];

/** Anahtarları "clientId_..." biçiminde olan NESNE alanları (dizi değil). */
const NESNE_ALANLARI = ["stoklar", "gunlukKontrol", "musteriGirisleri"];

/** Bir kaydın bu hesaba ait olup olmadığını söyler. */
export function kayitIzinliMi(kayit, tanim, setler) {
  if (!kayit || typeof kayit !== "object") return false;
  if (tanim.client && kayit[tanim.client] !== undefined && kayit[tanim.client] !== null) {
    return setler.idSeti.has(String(kayit[tanim.client]));
  }
  if (tanim.marka && kayit[tanim.marka] !== undefined) {
    return setler.adSeti.has(trKucult(kayit[tanim.marka]));
  }
  return false;
}

/**
 * Veriyi markaya göre süzer. Kilit yoksa veri olduğu gibi döner.
 * Dizi olmayan alanlara asla .filter() uygulanmaz (bu, sunucuyu çökerten bir hataydı).
 */
export function markayaGoreSuz(data, izinliMarkalar) {
  const setler = izinliIdSeti(data || {}, izinliMarkalar);
  if (!setler) return data;

  const suz = { ...data };
  suz.clients = (data.clients || []).filter((c) => setler.adSeti.has(trKucult(c.ad)));

  DIZI_ALANLARI.forEach((tanim) => {
    if (Array.isArray(data[tanim.ad])) {
      suz[tanim.ad] = data[tanim.ad].filter((k) => kayitIzinliMi(k, tanim, setler));
    }
  });

  NESNE_ALANLARI.forEach((ad) => {
    const deger = data[ad];
    if (!deger || typeof deger !== "object" || Array.isArray(deger)) return;
    const yeni = {};
    Object.entries(deger).forEach(([anahtar, v]) => {
      // Anahtar ya doğrudan clientId ("2") ya da "clientId_..." biçimindedir.
      if (setler.idSeti.has(String(anahtar).split("_")[0])) yeni[anahtar] = v;
    });
    suz[ad] = yeni;
  });

  // Ajans geneli alanlar markaya göre süzülemez — tamamen çıkarılır.
  AJANS_GENELI_ALANLAR.forEach((ad) => { delete suz[ad]; });

  return suz;
}

/** Kilitli hesaptan gizlenen iç bilgiler: reklam bütçesi ve müşteri finansalları. */
export function icBilgiyiTemizle(data, kilitliMi) {
  if (!kilitliMi) return data;
  const temiz = { ...data };
  if (Array.isArray(temiz.reklamlar)) temiz.reklamlar = temiz.reklamlar.map(({ butce, ...r }) => r);
  if (Array.isArray(temiz.clients)) {
    temiz.clients = temiz.clients.map((c) => {
      const { maliyetler, odemeKayitlari, aylikUcret, sozlesmeBedeli, ...kalan } = c;
      return kalan;
    });
  }
  return temiz;
}

/**
 * YAZMA KORUMASI — iki ayrı tehlikeyi birden karşılar:
 *  1. Kilitli hesap başka markanın kaydını değiştiremez/silemez
 *  2. Kilitli hesap kendi süzülmüş listesini geri yazarken başkasının kayıtlarını silemez
 *
 * Sunucudaki mevcut veriyle gönderilen veriyi alan alan birleştirir.
 */
export function yazmayiBirlestir(mevcut, gonderilen, alan, izinliMarkalar) {
  const setler = izinliIdSeti(mevcut || {}, izinliMarkalar);
  if (!setler) return gonderilen[alan];

  const tanim = DIZI_ALANLARI.find((t) => t.ad === alan);
  if (tanim && Array.isArray(gonderilen[alan]) && Array.isArray(mevcut[alan])) {
    const baskalarininki = mevcut[alan].filter((k) => !kayitIzinliMi(k, tanim, setler));
    const benimkiler = gonderilen[alan].filter((k) => kayitIzinliMi(k, tanim, setler));
    return [...baskalarininki, ...benimkiler];
  }

  if (NESNE_ALANLARI.includes(alan)
      && gonderilen[alan] && typeof gonderilen[alan] === "object" && !Array.isArray(gonderilen[alan])
      && mevcut[alan] && typeof mevcut[alan] === "object" && !Array.isArray(mevcut[alan])) {
    const birlesik = {};
    Object.entries(mevcut[alan]).forEach(([a, v]) => {
      if (!setler.idSeti.has(String(a).split("_")[0])) birlesik[a] = v;
    });
    Object.entries(gonderilen[alan]).forEach(([a, v]) => {
      if (setler.idSeti.has(String(a).split("_")[0])) birlesik[a] = v;
    });
    return birlesik;
  }

  // Tanınmayan bir alan: kilitli hesabın yazmasına İZİN VERİLMEZ, sunucudaki değer korunur.
  // (Güvenli taraf: bilinmeyen bir alanı körlemesine yazmak veri kaybı riskidir.)
  return mevcut[alan];
}

/**
 * Tek bir kaydın bu hesap tarafından değiştirilip değiştirilemeyeceğini söyler.
 * paylasim.js / client-payment.js gibi TEK KAYIT üzerinde çalışan uç noktalar bunu kullanır.
 */
export function markaErisimiVarMi(data, izinliMarkalar, { clientId, marka } = {}) {
  const setler = izinliIdSeti(data || {}, izinliMarkalar);
  if (!setler) return true; // kilit yok
  if (clientId !== undefined && clientId !== null) return setler.idSeti.has(String(clientId));
  if (marka !== undefined && marka !== null) return setler.adSeti.has(trKucult(marka));
  return false; // kilitli hesapta hedef belirsizse reddet
}

/** Bir personel hesabının izinli marka listesini SUNUCUDAKİ kayıttan okur.
 * Tarayıcının gönderdiğine asla güvenilmez. */
export function hesabinMarkalari(data, staffId) {
  if (!staffId) return [];
  const hesap = ((data && data.personelHesaplari) || []).find((h) => h.id === staffId);
  return hesap && Array.isArray(hesap.markalar) ? hesap.markalar : [];
}
