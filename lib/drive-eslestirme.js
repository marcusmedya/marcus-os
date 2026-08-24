/**
 * DRIVE ↔ KART EŞLEŞTİRMESİ — "eksik kart mı var?"
 *
 * Stok sayısı kartlardan fazla göründüğünde iki ihtimal var: sayaç sapmış olabilir
 * (mutabakat bunu gösteriyor), ya da Drive'da içerik var ama sistemde kartı yok.
 * İkincisini ancak Drive'daki dosyalarla kartların dosya kimliklerini karşılaştırarak
 * anlayabiliyoruz.
 *
 * Kartlar yükledikleri her dosyanın Drive kimliğini `medya[].dosyaId` içinde saklıyor;
 * ayrıca elle yapıştırılmış bağlantılar da olabiliyor (`editliDosyaLink` vb.). İkisi de
 * hesaba katılıyor — yoksa elle bağlanmış içerik "kartsız" sanılırdı.
 *
 * SAF: ağ yok, yan etki yok. Drive listesi dışarıdan veriliyor.
 */

/** Bir Drive bağlantısından ya da ham kimlikten dosya kimliği. */
function baglantidanKimlik(deger) {
  const s = String(deger || "");
  if (!s) return null;
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{15,}$/.test(s.trim()) ? s.trim() : null;
}

/** Bir kartın bağlı olduğu tüm Drive dosya kimlikleri. */
export function kartinDosyaKimlikleri(is) {
  const kimlikler = new Set();
  (Array.isArray(is && is.medya) ? is.medya : []).forEach((m) => {
    if (!m) return;
    const k = m.dosyaId || baglantidanKimlik(m.url);
    if (k) kimlikler.add(String(k));
  });
  ["editliDosyaLink", "dosyaLinki", "hamDosyaLink"].forEach((alan) => {
    const k = baglantidanKimlik(is && is[alan]);
    if (k) kimlikler.add(k);
  });
  return kimlikler;
}

/* Kartın aşaması hangi DURUM klasörüne karşılık geliyor. */
export const ASAMA_DURUMU = {
  onayBekleyen: ["Onaya Sunuldu", "Revize İstendi"],
  onaylanan: ["Onaylandı"],
  paylasilan: ["Şubelerde Paylaşılıyor", "Teslim Edildi"],
};

/** Bir aşamanın beklenen durum klasörü — bilinmiyorsa null (kontrol edilmez). */
export function beklenenDurum(asama) {
  const g = Object.entries(ASAMA_DURUMU).find(([, liste]) => liste.includes(asama));
  return g ? g[0] : null;
}

/**
 * @param driveDosyalari  [{ id, ad, klasor }]  — ONAYLANANLAR altındaki dosyalar
 * @param markaKartlari   o markanın kartları
 */
export function driveKartEslestir(driveDosyalari, markaKartlari) {
  const dosyalar = Array.isArray(driveDosyalari) ? driveDosyalari.filter(Boolean) : [];
  const kartlar = Array.isArray(markaKartlari) ? markaKartlari.filter(Boolean) : [];

  /* Kimlik → kart eşlemesi. Aynı dosya iki kartta görünüyorsa ilki yeter; amaç
   * "bir kartı var mı" sorusuna cevap vermek. */
  const kimlikKart = new Map();
  kartlar.forEach((j) => {
    kartinDosyaKimlikleri(j).forEach((k) => { if (!kimlikKart.has(k)) kimlikKart.set(k, j); });
  });

  const kartli = [];
  const kartsiz = [];
  dosyalar.forEach((d) => {
    const kart = kimlikKart.get(String(d.id));
    if (kart) kartli.push({ ...d, isId: kart.id, isAdi: kart.icerikTuru || "", asama: kart.asama || "" });
    else kartsiz.push(d);
  });

  /* KARTTA OLUP DRIVE'DA BULUNMAYANLAR. Yalnızca "Onaylandı" kartlar için anlamlı:
   * başka aşamadaki kartın dosyası zaten ONAYLANANLAR klasöründe olmaz. Dosya elle
   * silinmiş ya da başka bir yere taşınmış olabilir. */
  const driveKimlikleri = new Set(dosyalar.map((d) => String(d.id)));
  const kayipDosyalar = [];
  kartlar.filter((j) => j.asama === "Onaylandı").forEach((j) => {
    const kimlikler = [...kartinDosyaKimlikleri(j)];
    if (kimlikler.length === 0) return;                       // dosyasız kart — ayrı mesele
    const eksikler = kimlikler.filter((k) => !driveKimlikleri.has(k));
    if (eksikler.length > 0) {
      kayipDosyalar.push({ isId: j.id, isAdi: j.icerikTuru || "", eksikSayisi: eksikler.length });
    }
  });

  /* DOSYASI HİÇ OLMAYAN ONAYLI KARTLAR. Stoğa sayılıyor ama arkasında dosya yok. */
  const dosyasizKartlar = kartlar
    .filter((j) => j.asama === "Onaylandı" && kartinDosyaKimlikleri(j).size === 0)
    .map((j) => ({ isId: j.id, isAdi: j.icerikTuru || "" }));

  return {
    kartli, kartsiz, kayipDosyalar, dosyasizKartlar,
    driveDosyaSayisi: dosyalar.length,
    kartsizSayisi: kartsiz.length,
  };
}


/* ================================================================
 * DURUM RAPORU — "ONAYLANANLAR'da 3 Görsel 1 Reels var" sorusunun cevabı.
 *
 * Sayılan şey DOSYA değil KART. Bir carousel on slayttan oluşuyor; on dosya
 * "10 Carousel" demek değil, bir karttır. Dosya sayarak raporlanınca çoklu
 * içerikli her kart sayıyı şişiriyordu.
 * ================================================================ */

/**
 * @param driveDosyalari  [{ id, ad, durum, klasor }]
 * @param markaKartlari   o markanın kartları
 * @param turBul          kart → stok türü (lib/stok.js paylasimTuru)
 */
export function driveDurumRaporu(driveDosyalari, markaKartlari, turBul) {
  const dosyalar = Array.isArray(driveDosyalari) ? driveDosyalari.filter(Boolean) : [];
  const kartlar = Array.isArray(markaKartlari) ? markaKartlari.filter(Boolean) : [];
  const tur = typeof turBul === "function" ? turBul : () => "Görsel";

  const kimlikKart = new Map();
  kartlar.forEach((j) => {
    kartinDosyaKimlikleri(j).forEach((k) => { if (!kimlikKart.has(k)) kimlikKart.set(k, j); });
  });

  const durumlar = {};
  const kartsiz = [];
  /* Kart → hangi durum klasörlerinde dosyası var. Onay kilidi buna bakıyor. */
  const kartinDurumlari = new Map();

  dosyalar.forEach((d) => {
    const durum = d.durum || "onaylanan";
    if (!durumlar[durum]) durumlar[durum] = { dosyaSayisi: 0, turler: {}, kartlar: [], kartsizSayisi: 0 };
    const kutu = durumlar[durum];
    kutu.dosyaSayisi++;

    const kart = kimlikKart.get(String(d.id));
    if (!kart) { kutu.kartsizSayisi++; kartsiz.push(d); return; }

    if (!kartinDurumlari.has(String(kart.id))) kartinDurumlari.set(String(kart.id), new Set());
    kartinDurumlari.get(String(kart.id)).add(durum);

    let satir = kutu.kartlar.find((x) => String(x.isId) === String(kart.id));
    if (!satir) {
      satir = { isId: kart.id, isAdi: kart.icerikTuru || "", tur: tur(kart), asama: kart.asama || "", dosyaSayisi: 0 };
      kutu.kartlar.push(satir);
      kutu.turler[satir.tur] = (kutu.turler[satir.tur] || 0) + 1;   // KART sayılıyor, dosya değil
    }
    satir.dosyaSayisi++;
  });

  /* YANLIŞ YERDEKİ DOSYALAR. Kartın aşaması bir klasör söylüyor, dosya başka
   * klasörde duruyor. Onay verilmiş ama dosya taşınmamışsa stok gerçekte olmayan
   * bir içeriği sayar — aranan sapmanın ta kendisi. */
  const yanlisYerdekiler = [];
  kartlar.forEach((j) => {
    const beklenen = beklenenDurum(j.asama);
    if (!beklenen) return;
    const bulunan = kartinDurumlari.get(String(j.id));
    if (!bulunan || bulunan.size === 0) return;         // dosyasız kart — ayrı mesele
    if (bulunan.has(beklenen)) return;
    yanlisYerdekiler.push({
      isId: j.id, isAdi: j.icerikTuru || "", tur: tur(j), asama: j.asama,
      beklenen, bulunan: [...bulunan],
    });
  });

  const dosyasizKartlar = kartlar
    .filter((j) => beklenenDurum(j.asama) && kartinDosyaKimlikleri(j).size === 0)
    .map((j) => ({ isId: j.id, isAdi: j.icerikTuru || "", tur: tur(j), asama: j.asama }));

  /* KARTTA BAĞLANTI VAR AMA DOSYA DRIVE'DA YOK.
   *
   * `dosyasizKartlar`'dan farklı bir hâl: kart bir dosyaya bağlı ama o dosya taranan
   * hiçbir klasörde bulunamadı — elle silinmiş ya da başka yere taşınmış olabilir.
   * Ayırt edilmezse "kartı var, demek ki içeriği var" sanılır; oysa arkasında hiçbir
   * şey yoktur ve stok onu sayıyordur. */
  const driveKimlikleri = new Set(dosyalar.map((d) => String(d.id)));
  const kayipDosyalar = [];
  kartlar.forEach((j) => {
    if (!beklenenDurum(j.asama)) return;
    const kimlikler = [...kartinDosyaKimlikleri(j)];
    if (kimlikler.length === 0) return;                    // dosyasız kart — üstte
    const eksikler = kimlikler.filter((x) => !driveKimlikleri.has(x));
    if (eksikler.length === 0) return;
    kayipDosyalar.push({ isId: j.id, isAdi: j.icerikTuru || "", tur: tur(j), asama: j.asama,
      eksikSayisi: eksikler.length, tumuKayip: eksikler.length === kimlikler.length });
  });

  return { durumlar, kartsiz, kartsizSayisi: kartsiz.length, yanlisYerdekiler, dosyasizKartlar,
    kayipDosyalar, driveDosyaSayisi: dosyalar.length };
}

/**
 * DRIVE OTORİTELİ STOK — "stok = ONAYLANANLAR'da dosyası FİİLEN duran kartlar".
 *
 * Kartın aşamasının `Onaylandı` olması yetmiyor: dosya gerçekten o klasörde
 * olacak. Taşınmamış bir dosya için stok gösterilmesi, aranan sapmanın kaynağıydı.
 *
 * Tür karttan geliyor — Drive bir dosyanın Reels mi Görsel mi olduğunu bilmiyor.
 * KARTSIZ dosya stoğa SAYILMAZ: türü bilinmediği için sayılsa hangi satıra
 * yazılacağı uydurma olurdu; onun yolu kart açmak.
 */
export function driveyeGoreStok(driveDosyalari, markaKartlari, turBul) {
  const rapor = driveDurumRaporu(driveDosyalari, markaKartlari, turBul);
  const onaylanan = rapor.durumlar.onaylanan || { turler: {} };
  return { ...onaylanan.turler };
}


/**
 * BİR TÜRÜN İÇERİĞİ NEREDE DURUYOR — "neden stok 0?" sorusunun cevabı.
 *
 * Sahadan gelen soru şuydu: "Drive'da dosya mevcut, neden 0 gösteriyor?" Dosya
 * gerçekten Drive'daydı — ama ONAY BEKLEYENLER klasöründe. Stok yalnızca ONAYLANANLAR'ı
 * sayıyor; rapor bunu SÖYLEMEDİĞİ için sayı yanlış sanılıyordu.
 *
 * Rakamı değiştirmez, yalnızca dağılımı verir: { onayBekleyen: 1, paylasilan: 2 }.
 */
export function turunDagilimi(rapor, tur) {
  const durumlar = (rapor && rapor.durumlar) || {};
  const sonuc = {};
  Object.keys(durumlar).forEach((durum) => {
    const adet = Number((durumlar[durum].turler || {})[tur]) || 0;
    if (adet > 0) sonuc[durum] = adet;
  });
  return sonuc;
}
