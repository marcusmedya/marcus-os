/**
 * SUNUCU YANITINI KULLANICIYA ANLATILABİLİR BİR HATAYA ÇEVİRİR — TEK SAHİBİ BURASI.
 *
 * ÇÖZÜLEN SORUN (sahadan bildirildi, doğrulandı):
 * Yönetici, Üyelikler ekranında bir işlem yaptı ve beyaz bir `alert` kutusunda yalnızca
 * "Yetkisiz." gördü. Sayfa saatlerdir açıktı, veriler ekranda duruyordu; oturum süresi
 * dolmuştu (`lib/oturum.js`: normal giriş 12 saat, "Beni hatırla" 30 gün) ve
 * `api/paylasim.js` yazma isteğini 401 ile reddediyordu. Ham sunucu metni doğrudan
 * ekrana basıldığı için mesaj İKİ ŞEYİ birden yapmıyordu:
 *   · SEBEBİ söylemiyordu — kullanıcı "yetkim alınmış" sanıyor, oysa sunucu
 *     "kim olduğunu doğrulayamadım" diyor.
 *   · NE YAPILACAĞINI söylemiyordu — çıkış yapıp yeniden girmesi gerektiğini bilmiyordu.
 *
 * Emsal `lib/eposta-hata.js` → `neYapmali`: bu projede ham hata metnini kullanıcıya
 * basmak bir kez GÜNLERCE teşhis edilemeyen bir soruna yol açtı. Aynı disiplin burada.
 *
 * 401 İLE 403 AYRI DALLAR — karıştırılmaları pahalı:
 *   · 401 = KİMLİK. "Seni tanıyamadım." Çözümü yeniden giriş yapmak.
 *   · 403 = YETKİ.  "Seni tanıdım ama bunu yapamazsın." Çözümü yöneticiden izin istemek.
 * İkisi aynı dala inseydi, yetkisi olmayan kişi boş yere çıkış yapıp yeniden girer ve
 * aynı duvara toslardı; ya da oturumu düşen kişiye "yöneticinden izin iste" denirdi.
 *
 * SAF: `Date`, `window`, ağ, ortam değişkeni YOK. Girdi DEĞİŞTİRİLMEZ — yalnızca okunur
 * ve yeni bir nesne döndürülür. Bu yüzden hem `src/` içinden hem Node testinden çağrılır.
 */

/**
 * OTURUM SÜRELERİ — KAYNAK `lib/oturum.js`.
 *
 * Değerler oradan İKİNCİ KEZ yazılmıyor; burada yalnızca kullanıcıya söylenecek
 * İNSAN BİRİMİ duruyor (saat / gün). `lib/oturum.js` `@vercel/kv` ve `crypto` import
 * ediyor, yani tarayıcıya import edilemez — sabiti oradan çekmek bu saf modülü
 * kirletirdi. Bunun yerine `lib/oturum.js` sabitleri DIŞA AÇIYOR ve `testler/t117.mjs`
 * ikisinin birbirini tuttuğunu ölçüyor: süre orada değişip burada değişmezse test
 * gürültülü kırılır. Sessiz bayatlama yolu kapalı.
 *
 *   SURE_NORMAL  = 60 * 60 * 12          → 12 saat
 *   SURE_HATIRLA = 60 * 60 * 24 * 30     → 30 gün
 */
export const OTURUM_SURESI_SAAT = 12;
export const OTURUM_HATIRLA_GUN = 30;

/**
 * Sunucunun kendi mesajını çıkarır. Gövde metin de olabilir, nesne de, hiç de olmayabilir.
 * Resend'de olduğu gibi burada da alan adı tek değil: `error` · `message` · `hata`.
 * SUNUCUNUN MESAJI YUTULMAZ — bilinmeyen bir durumda ekrana çıkacak tek ipucu odur.
 */
export function sunucuMesaji(govde) {
  if (!govde) return "";
  if (typeof govde === "string") return govde.trim();
  if (typeof govde !== "object") return "";
  const m = govde.error || govde.message || govde.hata;
  return typeof m === "string" ? m.trim() : "";
}

/* "Yetkisiz." gibi tek kelimelik sunucu metinleri kullanıcıya hiçbir şey anlatmıyor;
 * mesajın SONUNA eklenmeleri gürültü yapardı. Ayrıntı gerektiğinde yine gösteriliyor
 * ama yalnızca gerçekten bir şey söylüyorsa (bu liste dışında ve yeterince uzunsa). */
const BOS_SAYILAN_SUNUCU_METINLERI = [
  "yetkisiz.", "yetkisiz", "unauthorized", "forbidden", "hata", "bir sorun oluştu.",
];

function ayrintiEklenirMi(metin) {
  if (!metin) return false;
  return !BOS_SAYILAN_SUNUCU_METINLERI.includes(metin.toLocaleLowerCase("tr"));
}

/* Her mesaj İKİ ŞEYİ birden söyler: SEBEP (neden oldu) ve YAPILACAK (şimdi ne yapmalı).
 * Başlık mesajın içinde TEKRARLANMAZ — `hataMetni` ikisini "başlık — mesaj" diye
 * birleştiriyor, tekrarlanan cümle ekranda iki kez okunurdu. */
const OTURUM_MESAJI =
  "Oturum süren dolduğu için sunucu kim olduğunu doğrulayamadı ve bu işlem KAYDEDİLMEDİ. "
  + "Çıkış yapıp yeniden gir; ekranda yazdığın ama henüz kaydedilmemiş bilgileri yeniden girmen gerekecek. "
  + `Giriş ekranında "Beni hatırla"yı işaretlersen oturum ${OTURUM_HATIRLA_GUN} gün açık kalır; `
  + `işaretlemezsen ${OTURUM_SURESI_SAAT} saat sonra tekrar sorar.`;

const YETKI_MESAJI =
  "Girişin geçerli, sunucu seni tanıdı; eksik olan bu işlemin izni. "
  + "Gerekiyorsa yöneticinden iste: Ayarlar → Personel Hesapları ekranından bu izni açabilir. "
  + "Marka kilitli bir hesapsan yalnızca sana atanan markalarda işlem yapabilirsin.";

/* 409 İKİ FARKLI ŞEY İÇİN DÖNÜYOR: sürüm çakışması / bozuk belge VE iş kuralı ihlali
 * ("bu adda bir şube zaten var"). İkincisinde sunucunun kendi cümlesi asıl bilgidir;
 * genel çakışma metninin arkasına gömmek kullanıcıyı sayfa yenilemeye yollardı — oysa
 * yenilemek o sorunu çözmez. Bu yüzden sunucu bir şey söylediyse ÖNCE o yazılır. */
const CAKISMA_MESAJI =
  "Bu bölümü başka biri (ya da başka bir sekme) aynı anda değiştirmiş olabilir, bu yüzden "
  + "üzerine yazılmadı. Sayfayı yenile, güncel hâli gör ve işlemi bir kez daha yap. "
  + "Yenileyince de aynı satırı görüyorsan kayıt okunamıyor olabilir; bu durumda hiçbir şey yazma ve yöneticiye haber ver.";

const CAKISMA_KUYRUGU =
  "Kaydedilmedi. Başka biri aynı anda değiştirmiş de olabilir: sayfayı yenile, güncel hâli "
  + "gör ve işlemi bir kez daha yap.";

/* "hata" kelimesi bilerek YOK: bir şey bozulmadı, sistem sırayla yazıyor ve tarayıcı
 * (lib/mesgul-tekrar.js) isteği kendiliğinden tekrarlıyor. Kullanıcıyı telaşlandıran
 * bir "hata" kutusu, aslında normal olan bir duruma yanlış ad takar. */
const MESGUL_MESAJI =
  "Aynı anda başka bir kayıt yazılıyor. Tarayıcı isteği kendiliğinden tekrar deniyor, "
  + "senin bir şey yapmana gerek yok. Birkaç saniye sonra hâlâ bu satırı görüyorsan aynı "
  + "işlemi bir kez daha başlat; hiçbir kayıt kaybolmadı.";

const AG_MESAJI =
  "Sunucuya ulaşılamadı — internet bağlantın kopmuş ya da sunucu yanıt vermiyor olabilir. "
  + "Bağlantını kontrol edip aynı işlemi tekrar yap.";

const GENEL_MESAJI =
  "Sunucu bu işlemi tamamlayamadı ve sebebini bildirmedi. Birkaç saniye sonra tekrar dene; "
  + "sürüyorsa sayfayı yenile. Yine olmuyorsa ekran görüntüsüyle yöneticine bildir.";

/**
 * Sunucu yanıtını kullanıcıya anlatılabilir bir hataya çevirir.
 *
 * @param {number} durum   HTTP durum kodu. Ağ hatasında 0 / undefined verilir.
 * @param {object|string} govde  Sunucunun JSON gövdesi (ya da ham metin). DEĞİŞTİRİLMEZ.
 * @returns {{tur: string, baslik: string, mesaj: string, oturumDustu: boolean}}
 *          `tur`: "oturum" | "yetki" | "cakisma" | "mesgul" | "ag" | "sunucu"
 *          `oturumDustu`: YALNIZCA 401'de true — kullanıcı giriş ekranına alınır.
 */
export function istekHatasi(durum, govde) {
  const kod = Number(durum);
  const sunucu = sunucuMesaji(govde);
  const ayrinti = ayrintiEklenirMi(sunucu) ? ` (sunucu: ${sunucu})` : "";
  const mesgulMu = Boolean(govde && typeof govde === "object" && govde.mesgul === true);

  if (kod === 401) {
    return { tur: "oturum", baslik: "Oturumun sona erdi", mesaj: OTURUM_MESAJI, oturumDustu: true };
  }
  if (kod === 403) {
    return { tur: "yetki", baslik: "Bu işlem için yetkin yok", mesaj: YETKI_MESAJI + ayrinti, oturumDustu: false };
  }
  if (kod === 409) {
    return {
      tur: "cakisma",
      baslik: "Kayıt çakıştı",
      mesaj: ayrinti ? `${sunucu} ${CAKISMA_KUYRUGU}` : CAKISMA_MESAJI,
      oturumDustu: false,
    };
  }
  if (kod === 503 && mesgulMu) {
    return { tur: "mesgul", baslik: "Sistem şu an meşgul", mesaj: MESGUL_MESAJI, oturumDustu: false };
  }
  /* AĞ / YANITSIZLIK: `fetch` hiç yanıt getiremediğinde durum kodu yoktur. Bunu "sunucu
   * hatası" diye sunmak yanlış yere baktırır — sorun büyük ihtimalle bağlantıda. */
  if (!Number.isFinite(kod) || kod <= 0) {
    return { tur: "ag", baslik: "Sunucuya ulaşılamadı", mesaj: sunucu || AG_MESAJI, oturumDustu: false };
  }
  /* 500 VE BİLİNMEYEN KODLAR: sunucunun kendi mesajı VARSA o gösterilir — yutulursa
   * geriye teşhis edilecek hiçbir ipucu kalmaz (lib/eposta-hata.js dersi). Yoksa genel
   * metin; her iki hâlde de ne yapılacağı yazıyor. */
  return {
    tur: "sunucu",
    baslik: `Sunucu bu işlemi yapamadı (${kod})`,
    mesaj: sunucu
      ? `${sunucu} Birkaç saniye sonra tekrar dene; sürüyorsa sayfayı yenile ve yöneticine bildir.`
      : GENEL_MESAJI,
    oturumDustu: false,
  };
}

/** Uyarı yığınına yazılacak TEK SATIR: başlık + mesaj. Ekranın tek metin alanı var. */
export function hataMetni(hata) {
  if (!hata || typeof hata !== "object") return "";
  const baslik = typeof hata.baslik === "string" ? hata.baslik.trim() : "";
  const mesaj = typeof hata.mesaj === "string" ? hata.mesaj.trim() : "";
  if (!baslik) return mesaj;
  if (!mesaj) return baslik;
  return `${baslik} — ${mesaj}`;
}
