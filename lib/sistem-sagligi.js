/**
 * SİSTEM SAĞLIĞI — ÖLÇÜM, MÜDAHALE DEĞİL
 *
 * Tüm uygulama verisi TEK bir JSON belgesinde duruyor ve bazı alanlar hiç küçülmüyor:
 * her paylaşım `paylasimGecmisi`'ne, her işlem `islemGecmisi`'ne, her silme
 * `silinenler`e bir kayıt daha ekliyor. Belge büyüdükçe her okuma ve her yazma
 * yavaşlıyor — ama bunu fark etmenin bir yolu yoktu.
 *
 * Bu modül yalnızca ÖLÇER. Veri yapısını değiştirmez, hiçbir şey silmez, hiçbir şey
 * taşımaz. Amacı "ne zaman bir şey yapmak gerekecek" sorusunu zamanında sorabilmek.
 *
 * Saf fonksiyonlar — Node'da test edilebilir, ağ ya da ortam gerektirmez.
 */

/** Vercel Hobby sınırı. Aşılırsa dağıtım tamamen başarısız olur. */
export const FONKSIYON_SINIRI = 12;

/**
 * Kullanılan serverless fonksiyon sayısı.
 *
 * Çalışma anında `api/` klasörünü saymak güvenilir değil: fonksiyon paketlenmiş
 * halde çalışıyor ve dosya sistemi kaynak ağacını yansıtmayabiliyor. Bu yüzden sayı
 * burada sabit tutuluyor ve `testler/fonksiyonSayisi.mjs` denetimi gerçek dosya
 * sayısıyla karşılaştırıyor — sayı bayatlarsa denetim düşer.
 */
export const API_FONKSIYON_SAYISI = 11;

/** Sürekli büyüyen, hiç küçülmeyen alanlar — asıl izlenmesi gerekenler. */
export const BUYUYEN_ALANLAR = [
  "cekimIsleri", "haftalikPaylasimlar", "paylasimGecmisi",
  "islemGecmisi", "silinenler", "gunlukKontrol",
];

/** Bir değerin yaklaşık JSON boyutu (bayt). Hesaplanamıyorsa 0. */
export function yaklasikBoyut(deger) {
  if (deger === undefined) return 0;
  try {
    /* Türkçe karakterler UTF-8'de iki bayt; uzunluk değil BAYT ölçülüyor,
     * yoksa Türkçe metinli bir belge olduğundan küçük görünürdü. */
    return Buffer.byteLength(JSON.stringify(deger), "utf8");
  } catch (e) {
    return 0;                              // döngüsel referans vb. — ölçüm hata vermez
  }
}

/** Bir alanın kayıt sayısı: dizi ise uzunluk, nesne ise anahtar sayısı, yoksa null. */
export function kayitSayisi(deger) {
  if (Array.isArray(deger)) return deger.length;
  if (deger && typeof deger === "object") return Object.keys(deger).length;
  return null;
}

/**
 * BELGE ÖLÇÜMÜ — her üst düzey alanın kayıt sayısı ve yaklaşık boyutu.
 *
 * En büyükten küçüğe sıralanır: "hangi alan belgeyi şişiriyor" sorusunun cevabı
 * listenin başında durur.
 */
export function belgeOlcumu(veri) {
  const belge = veri && typeof veri === "object" ? veri : {};
  const alanlar = Object.keys(belge)
    .filter((ad) => !ad.startsWith("_"))       // _v, _alanSurumleri iç muhasebe
    .map((ad) => ({
      alan: ad,
      kayit: kayitSayisi(belge[ad]),
      bayt: yaklasikBoyut(belge[ad]),
      buyuyen: BUYUYEN_ALANLAR.includes(ad),
    }))
    .sort((a, b) => b.bayt - a.bayt);

  return {
    toplamBayt: yaklasikBoyut(belge),
    alanSayisi: alanlar.length,
    alanlar,
    /* En büyük on alan yeter — otuz alanlık bir liste ekranda okunmuyor. */
    enBuyukler: alanlar.slice(0, 10),
  };
}

/**
 * ÖZET SAYILAR — ekranın üst şeridi.
 *
 * Alan adları belgede sabit; olmayan alan 0 döner, hata vermez. Eski bir belgede
 * `subeler` hiç bulunmayabilir ve bu normal.
 */
export function ozetSayilar(veri) {
  const belge = veri && typeof veri === "object" ? veri : {};
  const say = (ad) => kayitSayisi(belge[ad]) || 0;
  return {
    operasyonKarti: say("cekimIsleri"),
    musteri: say("clients"),
    sube: say("subeler"),
    haftalikPaylasim: say("haftalikPaylasimlar"),
    islemGecmisi: say("islemGecmisi"),
    silinen: say("silinenler"),
    personelHesabi: say("personelHesaplari"),
    musteriHesabi: say("musteriHesaplari"),
    sonYedek: belge.sonYedekTarihi || null,
  };
}

/**
 * BOYUT UYARISI.
 *
 * Eşikler ölçüme değil, tek belge modelinin doğasına dayanıyor: her yazma belgenin
 * TAMAMINI okuyup TAMAMINI geri yazıyor. Belge büyüdükçe her işlem yavaşlar ve kilit
 * daha uzun tutulur — üç kişi aynı anda çalışırken bu doğrudan hissedilir.
 *
 * Uyarı bir ÖNERİ üretmez; kararı kullanıcı verir. Amaç sürprizi önlemek.
 */
export const BOYUT_ESIKLERI = { dikkat: 1_500_000, yuksek: 4_000_000 };

export function boyutDurumu(toplamBayt) {
  if (toplamBayt >= BOYUT_ESIKLERI.yuksek) return "yuksek";
  if (toplamBayt >= BOYUT_ESIKLERI.dikkat) return "dikkat";
  return "normal";
}

/**
 * ORTAM DEĞİŞKENİ DURUMU — YALNIZCA VAR/YOK.
 *
 * Değerin kendisi ASLA döndürülmez. Tarayıcıya giden şey bir boolean; sır sızdırmaz.
 * `env` dışarıdan veriliyor ki fonksiyon saf kalsın ve test edilebilsin.
 */
export const KRITIK_DEGISKENLER = [
  { ad: "SITE_PASSWORD", ne: "Yönetici girişi — tanımsızsa kimse giremez", kritik: true },
  { ad: "CRON_SECRET", ne: "Gece yedeği ve günlük hatırlatma", kritik: true },
  { ad: "OWNER_EMAIL", ne: "İki adımlı doğrulama kodu", kritik: true },
  { ad: "RESEND_API_KEY", ne: "E-posta gönderimi", kritik: true },
  { ad: "BACKUP_EMAIL", ne: "Gece yedeğinin gittiği adres", kritik: true },
  { ad: "RESEND_FROM", ne: "Gönderen adresi", kritik: false },
  { ad: "GOOGLE_SERVICE_ACCOUNT_EMAIL", ne: "Drive: klasör açma ve taşıma", kritik: true },
  { ad: "GOOGLE_PRIVATE_KEY", ne: "Drive: servis hesabı anahtarı", kritik: true },
  { ad: "GOOGLE_OAUTH_CLIENT_ID", ne: "Drive: dosya yükleme", kritik: true },
  { ad: "GOOGLE_OAUTH_CLIENT_SECRET", ne: "Drive: dosya yükleme", kritik: true },
  { ad: "GOOGLE_OAUTH_REFRESH_TOKEN", ne: "Drive: dosya yükleme", kritik: true },
  { ad: "DRIVE_ONAY_KLASOR_ID", ne: "Ortak üst klasör (opsiyonel)", kritik: false },
  { ad: "STAFF_PASSWORD", ne: "Eski ortak personel şifresi (opsiyonel)", kritik: false },
  { ad: "KILIT_DENEME", ne: "Yazma kilidi deneme sayısı (opsiyonel)", kritik: false },
];

export function degiskenDurumu(env) {
  const kaynak = env || {};
  const liste = KRITIK_DEGISKENLER.map((d) => ({
    ad: d.ad, ne: d.ne, kritik: d.kritik,
    /* Boş metin "tanımlı" sayılmaz: `SITE_PASSWORD=""` tanımsızla aynı sonucu verir
     * ama ekranda yeşil görünürdü. */
    var: Boolean(String(kaynak[d.ad] || "").trim()),
  }));
  return {
    liste,
    eksikKritik: liste.filter((x) => x.kritik && !x.var).map((x) => x.ad),
  };
}
