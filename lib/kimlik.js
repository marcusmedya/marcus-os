/**
 * KAYIT NUMARASI ÇAKIŞMALARI
 *
 * SORUN: yeni kayıt numarası tarayıcıda "gördüğüm en büyük numara + 1" diye üretiliyor.
 * Marka kilitli bir hesap (çözüm ortağı) yalnızca kendi markalarının kayıtlarını görüyor —
 * yani EKSİK bir listenin üzerinden sayıyor. Ürettiği numara, göremediği bir kaydın
 * numarasıyla çakışıyor ve sunucu bunu engellemiyordu.
 *
 * Ölçüldü: ortak yalnızca 1 numaralı kartı görüyor, 2 üretiyor, sunucuda zaten 2 ve 3 var.
 * Kayıt 200 dönüyor ve veritabanında 2 numaralı İKİ kart oluşuyor.
 *
 * NEDEN CİDDİ: numara sistemin her yerinde kimlik. İki kayıt aynı numarayı taşıyınca kartı
 * açmak yanlış kaydı gösterebiliyor, düzenleme yanlış kayda gidiyor, Drive yüklemesi yanlış
 * karta bağlanıyor, silmek ikisini birden silebiliyor, stok yanlış markaya yazılıyor.
 * Hangisinin olacağı dizideki sıraya bağlı — yani öngörülemez.
 *
 * ÇÖZÜM BURADA, SUNUCUDA: yazmadan hemen önce çakışan numaralar onarılır. Tarayıcıya
 * güvenmek yerine son sözü sunucu söylüyor; eski sürüm bir sekme açık kalsa bile korunuyor.
 *
 * İLK GELEN NUMARAYI KORUR. Bu keyfi değil: birleştirmede sunucudaki kayıtlar diziye ÖNCE
 * konuyor (lib/marka-kilidi.js), yönetici yolunda da yeni kart listenin SONUNA ekleniyor.
 * Yani her iki gerçek yolda da "önce gelen" var olan kayıttır; numarasını değiştirmemiz
 * gereken taraf yeni gelendir.
 */

/** Bir dizinin "numaralı kayıt listesi" olup olmadığını söyler. */
export function numarali(liste) {
  return Array.isArray(liste)
    && liste.length > 0
    && liste.every((k) => k && typeof k === "object" && !Array.isArray(k)
                          && k.id !== undefined && k.id !== null);
}

/**
 * Çakışan numaraları onarır.
 * @returns { liste, onarilanlar: [{ eski, yeni }] } — hiçbir şey değişmediyse liste AYNI
 *          referansla döner (gereksiz yazma ve sürüm artışı olmasın).
 */
export function kimlikCakismalariniOnar(mevcutListe, gelenListe) {
  if (!numarali(gelenListe)) return { liste: gelenListe, onarilanlar: [] };

  /* Yeni numara, İKİ listenin birden en büyüğünden devam eder. Yalnızca gelen listeye
   * bakmak yetmez: sunucuda olup gelende olmayan (başka markanın) bir kaydın numarasını
   * yeniden dağıtırdık ve çakışmayı bu kez başka yerde üretirdik. */
  let enBuyuk = 0;
  const say = (k) => {
    const n = Number(k && k.id);
    if (Number.isFinite(n) && n > enBuyuk) enBuyuk = n;
  };
  if (Array.isArray(mevcutListe)) mevcutListe.forEach(say);
  gelenListe.forEach(say);

  const gorulen = new Set();
  const onarilanlar = [];
  const yeni = gelenListe.map((kayit) => {
    const anahtar = String(kayit.id);
    if (!gorulen.has(anahtar)) { gorulen.add(anahtar); return kayit; }
    enBuyuk += 1;
    onarilanlar.push({ eski: kayit.id, yeni: enBuyuk });
    gorulen.add(String(enBuyuk));
    return { ...kayit, id: enBuyuk };
  });

  return onarilanlar.length > 0
    ? { liste: yeni, onarilanlar }
    : { liste: gelenListe, onarilanlar: [] };
}

/**
 * Belgenin TÜM numaralı dizi alanlarını onarır.
 * Alan listesi elle sayılmıyor: yeni bir alan eklendiğinde kimsenin bir şey hatırlaması
 * gerekmesin diye, numaralı dizi olan her üst düzey alan otomatik kapsanıyor.
 */
export function belgedekiCakismalariOnar(mevcutBelge, gelenBelge) {
  const rapor = [];
  let sonuc = gelenBelge;
  Object.keys(gelenBelge || {}).forEach((alan) => {
    const { liste, onarilanlar } = kimlikCakismalariniOnar(
      (mevcutBelge || {})[alan], gelenBelge[alan]);
    if (onarilanlar.length === 0) return;
    if (sonuc === gelenBelge) sonuc = { ...gelenBelge };
    sonuc[alan] = liste;
    onarilanlar.forEach((x) => rapor.push({ alan, ...x }));
  });
  return { belge: sonuc, onarilanlar: rapor };
}

/**
 * SUNUCUNUN ÜRETTİĞİ, KALICI OLMAYAN ALANLAR.
 *
 * Bunlar veri gönderilirken hesaplanıyor (iş atarken isim seçebilmek için personel listesi
 * gibi). Tarayıcı kaydederken geri gönderiyordu ve veritabanına yazılıyorlardı: belge
 * gereksiz büyüyor, personel bilgisinin BAYAT bir kopyası asıl kaydın yanında duruyor ve
 * sürüm sayaçları arasında gerçek olmayan alanlar yer tutuyordu.
 */
export const TURETILMIS_ALANLAR = ["personelRosteri", "musteriRosteri"];

export function turetilmisleriAyikla(belge) {
  if (!belge || typeof belge !== "object") return belge;
  if (!TURETILMIS_ALANLAR.some((a) => a in belge)) return belge;
  const temiz = { ...belge };
  TURETILMIS_ALANLAR.forEach((a) => { delete temiz[a]; });
  return temiz;
}

/**
 * ÇAKIŞMA TAZELEMESİNDE KULLANICININ YENİ KAYITLARINI KORU.
 *
 * SORUN: iki kişi aynı dakikada kart eklediğinde ikincisi 409 alıyor — burası doğru. Sonrası
 * değil: tarayıcı çakışan alanı sunucudan tazelerken listenin TAMAMINI değiştiriyordu.
 * Kullanıcının az önce oluşturduğu kayıt o listede olmadığı için ekrandan siliniyordu ve
 * çıkan uyarı "diğer değişikliklerin korundu" diyerek kaybı gizliyordu.
 *
 * ÇÖZÜM: kullanıcının SUNUCUDA HİÇ BULUNMAYAN ve TABANDA DA OLMAYAN kayıtları geri eklenir.
 * Bu iki koşul birlikte "bunu kullanıcı yeni oluşturdu" demek olur; öyle bir kayıt tanım
 * gereği çakışamaz, çünkü onu henüz kimse görmedi.
 *
 * TABAN KONTROLÜ ŞART: yalnızca "sunucuda yok" demek yetmez. Tabanda olup sunucuda olmayan
 * bir kaydı BAŞKASI SİLMİŞTİR; onu geri eklemek silinen kaydı diriltirdi.
 */
export function yeniKayitlariKoru(sunucuListe, benimListe, tabanListe) {
  if (!numarali(sunucuListe) || !numarali(benimListe)) return sunucuListe;

  const sunucudakiler = new Map(sunucuListe.map((k) => [String(k.id), k]));
  const tabanda = new Set(Array.isArray(tabanListe)
    ? tabanListe.filter((k) => k && k.id !== undefined && k.id !== null).map((k) => String(k.id))
    : []);

  /* Tabanda olmayan = kullanıcının bu tur oluşturduğu kayıt. */
  const benimYenilerim = benimListe.filter((k) => !tabanda.has(String(k.id)));
  if (benimYenilerim.length === 0) return sunucuListe;

  let enBuyuk = 0;
  const say = (k) => { const n = Number(k && k.id); if (Number.isFinite(n) && n > enBuyuk) enBuyuk = n; };
  sunucuListe.forEach(say);
  benimListe.forEach(say);

  const sonuc = [...sunucuListe];
  let eklendi = false;
  benimYenilerim.forEach((kayit) => {
    const sunucudaki = sunucudakiler.get(String(kayit.id));
    if (!sunucudaki) { sonuc.push(kayit); eklendi = true; return; }
    /* Numara sunucuda TUTULMUŞ. İki ihtimal var:
     *   - Aynı kayıt: benim kaydım aslında yazılmış, tabanım bayat. Kopyalama, geç.
     *   - Farklı kayıt: aynı anda başkası o numarayı aldı. Benimkine yeni numara ver;
     *     yoksa kayıt kaybolur (ölçülen senaryo tam olarak buydu). */
    if (JSON.stringify(sunucudaki) === JSON.stringify(kayit)) return;
    enBuyuk += 1;
    sonuc.push({ ...kayit, id: enBuyuk });
    eklendi = true;
  });

  return eklendi ? sonuc : sunucuListe;
}
