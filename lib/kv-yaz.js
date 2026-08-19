import { kv } from "@vercel/kv";

/**
 * ORTAK YAZMA KATMANI
 * -------------------
 * Bu dosya api/ klasörünün DIŞINDA olduğu için Vercel bunu bir serverless function
 * saymaz — fonksiyon sayısı 12/12 olarak kalır. Sadece api/*.js dosyalarının içe
 * aktardığı paylaşılan bir yardımcı kütüphanedir.
 *
 * Neden var: veritabanına yazan 7 ayrı yol vardı (owner kaydı, personel kaydı, ödeme
 * kayıtları, paylaşım/stok, kasa, personel hesapları, müşteri paneli) ve bunların
 * SADECE BİRİ versiyon sayacını (_v) artırıyordu. Bu yüzden çakışma tespiti diğer
 * altısına karşı kördü: açık duran bir sekme, başkasının yaptığı değişikliğin üzerine
 * fark etmeden yazabiliyordu. Artık her yazma buradan geçiyor.
 */

export const KEY = "marcus-os-data";
const KILIT_KEY = "marcus-os-yazma-kilidi";

/** Sunucu UTC'de çalışır — gece yarısı ile 03:00 arası (Türkiye UTC+3) yedek
 * anahtarının bir gün geriden etiketlenmesini önler. */
export function bugunISO() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const al = (t) => p.find((x) => x.type === t).value;
  return `${al("year")}-${al("month")}-${al("day")}`;
}

/** Saatlik yedek anahtarı: 2026-08-11-14 gibi. */
export function saatISO() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const al = (t) => p.find((x) => x.type === t).value;
  return `${al("year")}-${al("month")}-${al("day")}-${String(al("hour")).padStart(2, "0")}`;
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * KISA ÖMÜRLÜ YAZMA KİLİDİ
 * Tüm uç noktalar "oku → değiştir → yaz" yapıyor. İki kişi aynı anda işlem yaparsa
 * ikinci yazma birincinin değişikliğini siliyordu. Kilit bunu sıraya sokar.
 * 10 saniyede kendiliğinden düşer — bir istek çökse bile sistem kilitli kalmaz.
 * KİLİT ALINAMAZSA YAZMA YAPILMAZ.
 *
 * Eskiden tam tersiydi: kilit alınamayınca yazma yine de yapılıyordu. Bu, korumayı tam
 * olarak korumaya en çok ihtiyaç duyulan anda kaldırıyordu — kilidin kapılamadığı an,
 * zaten çok sayıda isteğin aynı anda yazmaya çalıştığı andır. Yani sistem, veri kaybı
 * riskinin en yüksek olduğu anda kilitsiz yazıyordu.
 *
 * Artık kilit alınamazsa istek 503 ile reddedilir; ön yüz birkaç saniye sonra kendiliğinden
 * tekrar dener. Kullanıcı çoğu zaman bunu hiç görmez, ama sessiz veri kaybı olmaz.
 *
 * Geçici bir Redis hatası da artık "pes et" değil, "bu deneme başarısız" sayılır — anlık
 * bir aksaklık tüm denemeleri iptal etmez.
 */
/* Deneme sayısı ayarlanabilir: testler saniyelerce beklemesin, üretimde gerekirse
 * yoğunluğa göre ortam değişkeniyle ayarlanabilsin. Varsayılan 12 ≈ 3 saniye. */
const KILIT_DENEME = Math.max(1, Number(process.env.KILIT_DENEME) || 12);

export async function kilitAl(denemeSayisi = KILIT_DENEME) {
  for (let i = 0; i < denemeSayisi; i++) {
    try {
      const sonuc = await kv.set(KILIT_KEY, Date.now(), { nx: true, ex: 10 });
      if (sonuc) return true;
    } catch (e) {
      /* Anlık bir Redis aksaklığı olabilir — hemen pes etme, sıradaki denemeye geç. */
    }
    if (i < denemeSayisi - 1) await bekle(180 + Math.floor(Math.random() * 140));
  }
  return false;
}

/**
 * Kilit alınamadığında dönülecek standart cevap.
 * Tek yerde tanımlı: her uç aynı mesajı ve aynı kodu döndürsün, ön yüz tek bir
 * kurala bakarak otomatik tekrar deneyebilsin.
 */
export const MESGUL_KOD = 503;
export const MESGUL_MESAJI =
  "Sistem şu anda yoğun — değişikliğiniz KAYDEDİLMEDİ. Birkaç saniye sonra otomatik tekrar denenecek.";

export function mesgulYanit(res) {
  try { res.setHeader("Retry-After", "2"); } catch (e) { /* başlık yazılamazsa önemli değil */ }
  return res.status(MESGUL_KOD).json({ error: MESGUL_MESAJI, mesgul: true });
}

export async function kilitBirak(kilitAlindi) {
  if (!kilitAlindi) return; // başkasının kilidini bırakma
  try { await kv.del(KILIT_KEY); } catch (e) { /* kilit zaten süresi dolup düşmüş olabilir */ }
}

/**
 * GÜVENLİK DEFTERİ — kritik işlemlerin silinemez kaydı.
 *
 * Ana verinin içindeki islemGecmisi son 200 kayıtla sınırlı ve kullanıcı verisiyle birlikte
 * geri yüklendiğinde o da geri gider. Oysa "kim ne zaman ne sildi, kim geri yükleme yaptı,
 * kim izin değiştirdi" sorusunun cevabı, veri geri alınsa bile durmalı.
 *
 * Bu yüzden ayrı bir anahtarda tutulur, ana veriyle birlikte yazılmaz/geri yüklenmez.
 * Son 500 kayıt saklanır.
 */
const DEFTER_KEY = "marcus-os-guvenlik-defteri";

export async function deftereYaz(olay, detay = {}) {
  try {
    const mevcut = (await kv.get(DEFTER_KEY)) || [];
    const kayit = { zaman: new Date().toISOString(), olay, ...detay };
    await kv.set(DEFTER_KEY, [...mevcut, kayit].slice(-500));
  } catch (e) {
    // Defter yazılamazsa asıl işlem yine de sürer — kayıt tutmak işi engellememeli.
  }
}

export async function defteriOku() {
  try { return (await kv.get(DEFTER_KEY)) || []; } catch (e) { return []; }
}

/** Versiyon sayacını bir artırır. Çakışma tespitinin çalışabilmesi için HER yazmada gerekli. */
export function versiyonArtir(veri) {
  const mevcut = veri && typeof veri._v === "number" ? veri._v : 0;
  return { ...veri, _v: mevcut + 1 };
}

/**
 * ALAN BAZLI SÜRÜM SAYAÇLARI — ÇAKIŞMANIN ASIL ÇÖZÜMÜ.
 *
 * YAŞANAN SORUN: `_v` TEK bir genel sayaçtı. Şifre kasasına kayıt giren biri onu artırıyor,
 * o anda kart düzenleyen herkes bir anda "bayat" oluyor ve kaydı 409 ile geri çevriliyordu.
 * Üç kişi aynı anda çalıştığında sistem pratikte kilitleniyordu — biri kaydediyor, diğer
 * ikisi atılıyor, tekrar deniyorlar, bu sefer başkası kaydediyor…
 *
 * Oysa şifre kasasıyla Operasyon kartlarının birbiriyle hiçbir ilgisi yok. Sayaç "belge
 * değişti" diyordu; sorulması gereken soru ise "BENİM dokunduğum alan değişti mi".
 *
 * Artık her üst düzey alanın kendi sayacı var:
 *   _alanSurumleri: { cekimIsleri: 42, ownerKisiselSifreler: 7, clients: 19, ... }
 *
 * Yazan taraf hangi alanlara dokunduğunu bildiriyor; yalnızca onların sayacı artıyor.
 * Bildirmezse HEPSİ artar — yani eski davranış. Güvenli taraf bu: bildirmeyi unutmak
 * "çakışma yakalanmaz"a değil, "gereksiz çakışma yakalanır"a düşer.
 */
/* Sayaç haritasına GİRMEYECEK alanlar.
 *
 * `_alanSurumleri` yönetici GET'inde tarayıcıya gönderiliyor. Değerler yalnızca birer sayı —
 * sızıntı yok — ama gizli alanların ADLARINI da taşımaya gerek yok. Bunlar zaten GET'te
 * ayıklanan alanların aynısı; tarayıcı onları hiç göndermediği için sayaçlarına da
 * ihtiyaç duymuyor. */
const SAYACA_GIRMEYEN = ["personelHesaplari", "musteriHesaplari", "kasaSifresiHash", "kasaSifresiSalt"];

export function alanSurumleriniArtir(veri, degisenAlanlar) {
  const onceki = (veri && veri._alanSurumleri) || {};
  const yeni = { ...onceki };
  for (const gizli of SAYACA_GIRMEYEN) delete yeni[gizli];

  /* Bildirilmemişse tüm alanlar değişmiş sayılır. Bu, eski davranışın aynısı:
   * herkes bayat olur. Yanlış tarafa düşmek yerine gereksiz katı davranmak. */
  const hedefler = Array.isArray(degisenAlanlar) && degisenAlanlar.length > 0
    ? degisenAlanlar
    : Object.keys(veri || {}).filter((a) => a !== "_v" && a !== "_alanSurumleri");

  for (const alan of hedefler) {
    if (SAYACA_GIRMEYEN.includes(alan)) continue;
    yeni[alan] = (Number(onceki[alan]) || 0) + 1;
  }
  return { ...veri, _alanSurumleri: yeni };
}

/**
 * Bir yazma isteğinin GERÇEKTEN çakışıp çakışmadığını söyler.
 *
 * Yalnızca yazanın DOKUNDUĞU alanlara bakılır. Başkasının başka bir alanı değiştirmiş
 * olması çakışma değildir — asıl düzeltme bu.
 *
 * Taban sürüm bilgisi hiç gelmemişse çakışma yok sayılır: bu, alan bazlı yolu HİÇ
 * kullanmayan eski istemcilerin `_v` üzerinden ayrıca kontrol edilmesi demek.
 */
export function catisanAlanlar(mevcutVeri, degisenAlanlar, tabanSurumler) {
  if (!Array.isArray(degisenAlanlar) || degisenAlanlar.length === 0) return [];
  if (!tabanSurumler || typeof tabanSurumler !== "object") return [];
  const sunucu = (mevcutVeri && mevcutVeri._alanSurumleri) || {};
  return degisenAlanlar.filter((alan) => {
    const taban = tabanSurumler[alan];
    const sunucudaVar = sunucu[alan] !== undefined && sunucu[alan] !== null;

    /* TABAN BİLİNMİYORSA İKİ AYRI DURUM VAR — ilk sürümde ikisi de "çakışma yok" sayılmıştı
     * ve bu gerçek bir veri kaybı üretti (testte ölçüldü):
     *
     *   Sunucuda da sayaç yoksa → o alana yeni düzenle hiç yazılmamış. Çakışma yok.
     *   Sunucuda sayaç VARSA   → biri o alanı yazmış, istemci ise onu HİÇ görmemiş.
     *                             İstemci kesinlikle geride. Bu bir ÇAKIŞMADIR.
     *
     * İkincisini "çakışma yok" saymak, bayat kopyanın az önce yazılanın üstüne
     * gitmesi demekti: A kartı düzenler, B eski kopyasıyla kaydeder, A'nın düzenlemesi
     * sessizce silinir. */
    if (taban === undefined || taban === null) return sunucudaVar;

    const simdi = Number(sunucu[alan]) || 0;
    return Number(taban) !== simdi;
  });
}

/**
 * Silinmiş bir markaya bağlı kalmış Müşteri Paneli hesaplarını temizler.
 * Müşteri silme hangi yoldan yapılırsa yapılsın (owner, personel, toplu düzenleme)
 * yetim hesap kalmasın diye her yazmada kontrol edilir.
 */
export function yetimMusteriHesaplariniTemizle(veri) {
  if (!veri || !Array.isArray(veri.musteriHesaplari) || !Array.isArray(veri.clients)) return veri;
  if (veri.musteriHesaplari.length === 0) return veri;
  const idler = new Set(veri.clients.map((c) => String(c.id)));
  const temiz = veri.musteriHesaplari.filter((h) => idler.has(String(h.clientId)));
  if (temiz.length === veri.musteriHesaplari.length) return veri;
  return { ...veri, musteriHesaplari: temiz };
}

/**
 * Ana veriyi yazar: versiyonu artırır, yetim hesapları temizler, günlük VE saatlik
 * yedeği günceller. Saatlik yedekler 48 saat sonra kendiliğinden silinir (ek temizlik
 * koduna gerek yok) — böylece "dünün son hâli"ne değil, günün içindeki bir saate de
 * dönebilirsin.
 */
export async function guvenliYaz(veri, degisenAlanlar) {
  const yeni = alanSurumleriniArtir(
    versiyonArtir(yetimMusteriHesaplariniTemizle(veri)),
    degisenAlanlar,
  );
  await kv.set(KEY, yeni);
  await kv.set(`marcus-os-snapshot-${bugunISO()}`, yeni);
  try {
    await kv.set(`marcus-os-saatlik-${saatISO()}`, yeni, { ex: 172800 });
  } catch (e) {
    // saatlik yedek yazılamazsa asıl kayıt yine de geçerli — sessizce geç
  }
  return yeni;
}

/**
 * "oku → değiştir → yaz" döngüsünün tamamını kilit altında yapar.
 *
 * degistir(mevcutVeri) şunlardan birini döndürmeli:
 *   { veri: yeniVeri, ek: {...} }   → yazılır
 *   { iptal: true, hata: "...", kod: 404 } → hiçbir şey yazılmaz
 *
 * Önemli olan: veriyi kilit ALINDIKTAN SONRA okumak. Eskiden veri kilitsiz okunup
 * sonra yazıldığı için, arada başkasının yaptığı değişiklik siliniyordu.
 */
export async function guvenliGuncelle(degistir) {
  const kilitAlindi = await kilitAl();
  /* Kilit alınamadıysa YAZMA. Çağıran taraf zaten { ok:false, iptal, hata, kod } şeklini
   * işliyor; burada sadece kod 503 ve mesgul bayrağı ekleniyor. */
  if (!kilitAlindi) {
    return { ok: false, iptal: true, mesgul: true, kod: MESGUL_KOD, hata: MESGUL_MESAJI };
  }
  try {
    const mevcut = (await kv.get(KEY)) || {};
    const sonuc = await degistir(mevcut);
    if (!sonuc || sonuc.iptal) {
      return { ok: false, iptal: true, hata: sonuc && sonuc.hata, kod: (sonuc && sonuc.kod) || 400,
               ek: sonuc && sonuc.ek, mevcut };
    }
    const yazilan = await guvenliYaz(sonuc.veri, sonuc.degisenAlanlar);
    /* oncekiVeri: çağıran taraf "ne değişti" karşılaştırması yapabilsin diye yazma
     * öncesindeki hâl de döndürülür (örn. aşama değişiminde Drive taşıma tetiklemek). */
    return { ok: true, veri: yazilan, oncekiVeri: mevcut, ek: sonuc.ek };
  } finally {
    await kilitBirak(kilitAlindi);
  }
}
