/**
 * İŞ BAŞI ÜCRET MATEMATİĞİ — freelancer hak edişi ve şirket maliyeti.
 *
 * NEDEN `lib/` ALTINDA: bu hesap `src/CekimEditTakibi.jsx` içindeydi ve `.jsx` Node'da
 * çalışmadığı için hiçbir testten ÇAĞRILAMIYORDU — yalnızca kaynak metnine bakılabiliyordu.
 * Aynı sebeple ödeme hesabı da `lib/odeme-hesabi.js`'e taşınmıştı. Para hesabı bu projede
 * test edilemez bir yerde durmamalı.
 *
 * İKİNCİ SEBEP: şirketin aylık gider toplamı (`computeLive`, `src/tema.jsx`) bu rakama
 * ihtiyaç duyuyor. `.jsx`'ten `.jsx`'e import etmek DAİRESEL bağımlılık üretirdi
 * (CekimEditTakibi zaten tema.jsx'ten import ediyor). Ortak mantık `lib/`e taşınınca ikisi
 * de aynı kaynaktan okuyor ve iki ekran farklı rakam gösteremiyor.
 *
 * SAF: ağ yok, yan etki yok, gelen veriyi değiştirmez.
 *
 * ---------------------------------------------------------------------------
 * ÜÇ ÜCRET MODU (`isUcretDetaylari[isId].mod`):
 *   "varsayilan" → kişinin iş başı ücreti (Freelancer sekmesinde girilen tutar)
 *   "sabit"      → bu işe özel TEK tutar ("10 tasarım yapacak ama tek ücret alacak")
 *   "ucretsiz"   → 0 ₺ (pakete dahil)
 *
 * "sabit" ve "ucretsiz" modda işte iki kişi varsa tutarın kime yazılacağı `kime` alanıyla
 * belirlenir ("editor" | "kameraman" | "ikisi") — böylece tek ücret iki kez sayılmaz.
 *
 * DÖNEM = İŞİN TESLİM EDİLDİĞİ AY (`isTeslimTarihi`). Kartın bugünkü aşaması değil:
 * hak ediş işin bittiği ayda doğar.
 */

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();
const kucult = (x) => metin(x).toLocaleLowerCase("tr");

export const UCRET_MODLARI = [
  { key: "varsayilan", label: "Varsayılan (kişinin iş başı ücreti)" },
  { key: "sabit", label: "Bu işe tek sabit ücret" },
  { key: "ucretsiz", label: "Ücretsiz (pakete dahil)" },
];

/**
 * İşin GERÇEKTEN teslim edildiği gün, "YYYY-AA-GG".
 *
 * Yeni işlerde bilgi doğrudan `teslimEdilmeTarihi` alanında duruyor. Bu alan eklenmeden
 * ÖNCE teslim edilmiş işler için bilgi, işlem geçmişindeki "→ Teslim Edildi" satırının
 * tarihinden geri kazanılıyor — böylece rapor eski işleri de sayabiliyor. O satırdaki
 * tarih bir ekran metni ("11.08.2026" ya da tek haneli günle "2.08.2026").
 */
export function isTeslimTarihi(job) {
  if (!job) return null;
  if (job.teslimEdilmeTarihi) return job.teslimEdilmeTarihi;
  const gecmis = Array.isArray(job.gecmis) ? job.gecmis : [];
  const kayit = [...gecmis].reverse().find((g) => metin(g && g.aciklama).includes("→ Teslim Edildi"));
  if (!kayit || !kayit.tarih) return null;
  const gun = metin(kayit.tarih).split(" ")[0];
  const p = gun.split(".");
  if (p.length !== 3) return null;
  const [g, a, y] = p;
  if (!y || y.length !== 4) return null;
  return `${y}-${metin(a).padStart(2, "0")}-${metin(g).padStart(2, "0")}`;
}

/** İki kişili bir işte sabit ücretin varsayılan olarak kime yazılacağı. */
export function varsayilanKime(job) {
  if (job && job.editor) return "editor";
  if (job && job.kameraman) return "kameraman";
  return "editor";
}

/** Bir işin, belirli bir kişiye yazılacak ücreti. */
export function isUcretiHesapla(job, kisiAdi, detay, kisiVarsayilanUcret) {
  const mod = (detay && detay.mod) || "varsayilan";
  if (mod === "ucretsiz") return 0;
  if (mod === "sabit") {
    const tutar = Number(detay && detay.tutar) || 0;
    const kime = (detay && detay.kime) || varsayilanKime(job);
    if (kime === "ikisi") return tutar;
    if (kime === "kameraman") return (job && job.kameraman) === kisiAdi ? tutar : 0;
    return (job && job.editor) === kisiAdi ? tutar : 0;
  }
  return Number(kisiVarsayilanUcret) || 0;
}

/** O ay teslim edilmiş işler. */
const ayinIsleri = (jobs, ay) => (Array.isArray(jobs) ? jobs : []).filter((j) => {
  const t = isTeslimTarihi(j);
  return Boolean(t) && t.slice(0, 7) === ay;
});

/**
 * Bir kişinin belirli bir aydaki OPERASYON hak edişi.
 * Personel > Freelancer sekmesi bunu kullanır — hak ediş matematiği tek yerde kalsın ve
 * iki ekran farklı rakam göstermesin.
 */
export function operasyonAylikHakEdis(jobs, kisiAd, ay, ucretler, ucretDetaylari) {
  if (!kisiAd) return { isSayisi: 0, tutar: 0, parca: 0 };
  const varsayilan = Number((ucretler || {})[kisiAd]) || 0;
  const liste = ayinIsleri(jobs, ay).filter((j) => j.kameraman === kisiAd || j.editor === kisiAd);
  const tutar = liste.reduce(
    (s, j) => s + isUcretiHesapla(j, kisiAd, (ucretDetaylari || {})[j.id] || null, varsayilan), 0);
  const parca = liste.reduce((s, j) => s + (Number(j.uretilenAdet) || 0), 0);
  return { isSayisi: liste.length, tutar, parca };
}

/** Bir iş listesinin toplam iş başı maliyeti + ücreti tanımsız kişi-iş sayısı. */
function listeninMaliyeti(liste, ucretler, ucretDetaylari) {
  let tutar = 0;
  let eksikUcret = 0;
  liste.forEach((j) => {
    /* Bir işte hem kameraman hem editör olabilir; ikisi de ayrı ücret alır. */
    [j.kameraman, j.editor].filter(Boolean).forEach((kisi) => {
      const varsayilan = Number((ucretler || {})[kisi]) || 0;
      const detay = (ucretDetaylari || {})[j.id] || null;
      tutar += isUcretiHesapla(j, kisi, detay, varsayilan);
      /* Ne kişinin ücreti girilmiş ne de işe özel bir mod seçilmiş: bu iş maliyete
       * SIFIR yazıyor ama gerçekte bir bedeli var. Sayılıyor ki ekran "bu rakam eksik"
       * diyebilsin — sessizce sıfır yazmak maliyeti olduğundan düşük gösterir. */
      if (!varsayilan && !detay) eksikUcret += 1;
    });
  });
  return { tutar, eksikUcret };
}

/**
 * MARKA BAZLI FREELANCER MALİYETİ — bir markaya o ay harcanan iş başı ücretler.
 *
 * Kâr hesabı eskiden yalnızca elle girilen maliyetlere bakıyordu; Operasyon'da o marka
 * için ödenen freelancer ücretleri hiç girmiyordu ve çok iş üretilen marka olduğundan
 * kârlı görünüyordu.
 */
export function markaAylikIsMaliyeti(jobs, marka, ay, ucretler, ucretDetaylari) {
  const anahtar = kucult(marka);
  if (!anahtar) return { tutar: 0, isSayisi: 0, eksikUcret: 0 };
  const liste = ayinIsleri(jobs, ay).filter((j) => kucult(j.marka) === anahtar);
  const { tutar, eksikUcret } = listeninMaliyeti(liste, ucretler, ucretDetaylari);
  return { tutar, isSayisi: liste.length, eksikUcret };
}

/**
 * ŞİRKETİN AYLIK İŞ BAŞI MALİYETİ — bütün markaların toplamı.
 *
 * NEDEN AYRI BİR FONKSİYON: şirket toplamı, markaların toplamı DEĞİLDİR. Markası
 * girilmemiş bir iş `markaAylikIsMaliyeti`'nin hiçbir çağrısına girmez ve marka marka
 * toplandığında sessizce KAYBOLUR. Şirket gideri eksik çıkar. Bu fonksiyon o ay teslim
 * edilmiş HER işi sayar; markası olsun olmasın.
 *
 * Bu rakam `computeLive`'daki gider toplamına giriyor. Girmediği dönemde şirket kârı
 * freelancer'a ödenen parayı hiç görmüyordu: kasa her ödemede azalıyor, kâr azalmıyordu.
 */
export function sirketAylikIsMaliyeti(jobs, ay, ucretler, ucretDetaylari) {
  if (!metin(ay)) return { tutar: 0, isSayisi: 0, eksikUcret: 0 };
  const liste = ayinIsleri(jobs, ay);
  const { tutar, eksikUcret } = listeninMaliyeti(liste, ucretler, ucretDetaylari);
  return { tutar, isSayisi: liste.length, eksikUcret };
}

/** Operasyon'da atanmış ama kayıtlı olmayan kişiler — Freelancer sekmesi bunları önerir. */
export function operasyonKisiIsimleri(jobs) {
  const kume = new Set();
  (Array.isArray(jobs) ? jobs : []).forEach((j) => {
    if (metin(j && j.kameraman)) kume.add(metin(j.kameraman));
    if (metin(j && j.editor)) kume.add(metin(j.editor));
  });
  return [...kume];
}
