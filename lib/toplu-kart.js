/**
 * TOPLU KART AÇMA — "elimde 20 fotoğraf var, hepsi ayrı kart olacak".
 *
 * Yirmi içeriği tek tek forma girmek yirmi kez aynı alanları doldurmak demekti; marka,
 * kategori, tarihler ve sorumlular her seferinde aynı. Burada bir kez giriliyor, ad
 * NUMARALANDIRILARAK çoğaltılıyor: "Post 1", "Post 2", …
 *
 * NUMARA KALDIĞI YERDEN DEVAM EDER — bu modülün asıl sebebi. Her toplu açılış 1'den
 * başlasaydı aynı markada iki "Post 3" olurdu; kart adı Drive'da dosya adına, paylaşım
 * planında satır etiketine ve müşteri paneline gidiyor, yani aynı ad iki içeriği
 * ayırt edilemez yapardı. Bu yüzden markanın MEVCUT kart adlarına bakılıp en büyük
 * numaranın bir fazlasından başlanıyor.
 *
 * SAF: ağ yok, tarih yok, rastgelelik yok. Kimlik ve aşama çağıranın işi — kayıt
 * numarasının son sözü sunucuda (bkz. lib/kimlik.js), bu modül numara UYDURMAZ.
 */

/** Tek seferde açılabilecek en fazla kart. Tek JSON belge var; sınırsız çoğaltma
 * belgeyi bir yanlış tıklamayla şişirebilir. Kullanıcı 20 diyor, 50 rahat pay. */
export const EN_FAZLA_TOPLU = 50;

const trKucult = (x) => String(x === null || x === undefined ? "" : x).trim().toLocaleLowerCase("tr");

/** Ad tabanını temizler: baştaki/sondaki boşluk ve arka arkaya boşluklar gider. */
export function tabanTemizle(taban) {
  return String(taban === null || taban === undefined ? "" : taban).replace(/\s+/g, " ").trim();
}

/**
 * Verilen adlar içinde "<taban> <sayı>" kalıbına uyanların en büyüğünün bir fazlası.
 * Hiç yoksa 1.
 *
 * Karşılaştırma Türkçe küçültmeyle: "POST 3" ile "Post 3" aynı seriden. Kartlar markayı
 * ADIYLA sakladığı için çağıran YALNIZCA o markanın adlarını verir — başka markanın
 * "Post 40"ı bu markanın numarasını ileri atmasın.
 */
export function sonrakiNumara(mevcutAdlar, taban) {
  const t = trKucult(taban);
  if (!t) return 1;
  let enBuyuk = 0;
  for (const ad of Array.isArray(mevcutAdlar) ? mevcutAdlar : []) {
    const s = trKucult(ad);
    if (!s.startsWith(t)) continue;
    const kalan = s.slice(t.length).trim();
    if (!/^\d+$/.test(kalan)) continue;      // "Post tanıtım" seriye girmez
    const n = Number(kalan);
    if (Number.isFinite(n) && n > enBuyuk) enBuyuk = n;
  }
  return enBuyuk + 1;
}

/** Kaç kart açılabilir — geçersizse 0 döner, çağıran isteği reddeder. */
export function adetiCoz(adet) {
  const n = Math.floor(Number(adet));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, EN_FAZLA_TOPLU);
}

/**
 * Açılacak kartların adları — sırayla.
 *
 * Taban boşsa boş dizi döner: adsız yirmi kart açmak, sonradan hangisinin ne olduğu
 * anlaşılmayan yirmi kayıt demek. Çağıran bunu hata olarak gösterir.
 */
export function topluAdlar(taban, adet, mevcutAdlar) {
  const t = tabanTemizle(taban);
  const n = adetiCoz(adet);
  if (!t || n === 0) return [];
  const bas = sonrakiNumara(mevcutAdlar, t);
  const liste = [];
  for (let i = 0; i < n; i++) liste.push(`${t} ${bas + i}`);
  return liste;
}

/**
 * Açılacak kartların alanları. Ortak alanlar (marka, kategori, tarihler, sorumlular,
 * şube kapsamı, brief) her kartta AYNI; yalnızca ad değişiyor.
 *
 * `topluId` ile `topluSira` kartın üstünde kalıyor: dosyalar kartlar KAYDEDİLDİKTEN
 * sonra yükleniyor ve o sırada kartın numarası sunucu tarafından değiştirilmiş olabilir
 * (çakışma onarımı). Dosyanın hangi karta gideceği bu iki alanla bulunuyor — numaraya
 * güvenilseydi onarım sonrası dosya BAŞKA kartın içine düşerdi.
 *
 * `sadeceSubeler` her kart için KOPYALANIR: aynı dizi paylaşılsaydı bir kartın kapsamını
 * düzenlemek diğer on dokuzunu da değiştirirdi.
 */
export function topluIsleriUret({ taban, adet, mevcutAdlar, ortak, topluId }) {
  const adlar = topluAdlar(taban, adet, mevcutAdlar);
  const temelAlanlar = ortak && typeof ortak === "object" ? ortak : {};
  return adlar.map((ad, i) => ({
    ...temelAlanlar,
    sadeceSubeler: Array.isArray(temelAlanlar.sadeceSubeler) ? [...temelAlanlar.sadeceSubeler] : [],
    icerikTuru: ad,
    ...(topluId ? { topluId: String(topluId), topluSira: i + 1 } : {}),
  }));
}

/** Bir toplu açılışta üretilen kartı bulur — dosya yüklemesi kartı BUNUNLA eşler. */
export function topludanKartBul(isler, topluId, sira) {
  /* Boş etiket için ayrı bir bekçi YOK: etiketsiz kartın `topluSira`sı da olmadığı için
   * eşleşme zaten kurulamıyor. Bekçi yazılmıştı; kaldırıldığında hiçbir kontrol düşmedi
   * (ölçüldü), yani çalışmıyordu. Ölçülemeyen koruma tutmak, sonraki kişiye çalışıyormuş
   * gibi görünen bir güvence devretmek olurdu. */
  const hedef = String(topluId === null || topluId === undefined ? "" : topluId);
  return (Array.isArray(isler) ? isler : [])
    .find((j) => j && String(j.topluId || "") === hedef && Number(j.topluSira) === Number(sira)) || null;
}
