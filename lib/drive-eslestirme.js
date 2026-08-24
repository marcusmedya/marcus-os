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
