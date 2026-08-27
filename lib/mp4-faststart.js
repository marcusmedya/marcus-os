/**
 * MP4 "FAST START" — OYNATMA BİLGİSİ BAŞTA MI, SONDA MI?
 *
 * Bir MP4/MOV dosyasında oynatma bilgisi `moov` kutusunda durur. Kutu dosyanın SONUNDA
 * ise tarayıcı videoyu oynatmaya başlamadan önce onu bulmak zorunda: dosyanın sonunu
 * istiyor, sonra başa dönüyor. Kendi sunucumuz üzerinden geçen bir dosyada bu iki
 * fazladan tur demek ve bekleme onlarca saniyeye çıkabiliyor — sahada görülen
 * "oynatıyor ama bazen 30 sn, bazen 1 dk bekliyor" tarifi tam olarak budur. Bekleme
 * dosyadan dosyaya değişiyor, çünkü `moov`un yeri dışa aktarım ayarına bağlı.
 *
 * Premiere / After Effects gibi programların varsayılan çıktısı `moov`u SONA koyar;
 * "fast start" / "web'e uygun" seçeneği açıldığında BAŞA alır.
 *
 * BURASI YALNIZCA TEŞHİS EDER. Dosyayı değiştirmek (remux) bu uygulamanın işi değil;
 * doğrusu dışa aktarımı düzeltmek. Ama hangi dosyanın yavaş olduğunu SÖYLEMEK, "video
 * neden geç açılıyor" sorusunu tahminden çıkarıyor.
 *
 * SAF: ağ yok, yan etki yok — baytlar dışarıdan veriliyor.
 */

const KUTU_BASLIK = 8;                       // [4 bayt boyut][4 bayt tür]

/** Baytlardan bir üst düzey kutu türünü okur. */
function kutuTuru(baytlar, konum) {
  let ad = "";
  for (let i = konum + 4; i < konum + 8; i += 1) ad += String.fromCharCode(baytlar[i]);
  return ad;
}

/** 32 bitlik büyük-uçlu boyut. */
function kutuBoyutu(baytlar, konum) {
  return (baytlar[konum] * 0x1000000) + (baytlar[konum + 1] << 16) + (baytlar[konum + 2] << 8) + baytlar[konum + 3];
}

/**
 * @param baytlar dosyanın BAŞINDAN birkaç kilobayt (Uint8Array / Buffer)
 * @returns true  → `moov` başta, oynatma hemen başlar
 *          false → `mdat` önce geliyor, `moov` sonda — ilk açılış yavaş
 *          null  → karar verilemedi (yeterli bayt yok ya da MP4 değil)
 */
export function hizliBaslangicMi(baytlar) {
  if (!baytlar || baytlar.length < KUTU_BASLIK) return null;
  let konum = 0;
  let mp4Mi = false;

  while (konum + KUTU_BASLIK <= baytlar.length) {
    const tur = kutuTuru(baytlar, konum);
    const boyut = kutuBoyutu(baytlar, konum);

    if (tur === "ftyp") mp4Mi = true;
    /* KARAR ANI: hangisi önce geliyor. */
    if (tur === "moov") return true;
    if (tur === "mdat") return mp4Mi ? false : null;

    /* Boyut 0 "dosyanın sonuna kadar", 1 ise 64 bitlik boyut demek — ikisinde de
     * ilerleyemiyoruz, karar verilemez. Sonsuz döngüye girmemek için de şart. */
    if (boyut <= KUTU_BASLIK) return null;
    konum += boyut;
  }
  return null;                                // yeterli bayt yok
}

/** Kullanıcıya gösterilecek kısa açıklama; `null` ise bir şey söylenmiyor. */
export function faststartUyarisi(hizliMi) {
  if (hizliMi !== false) return null;
  return "Bu dosya web için optimize değil (oynatma bilgisi dosyanın sonunda) — ilk açılış yavaş olabilir. Dışa aktarırken \"fast start\" seçeneğini açmak bunu kökten çözer.";
}
