/**
 * AŞAMA KURALLARI — hem tarayıcı hem sunucu buradan okur.
 *
 * NEDEN ORTAK DOSYA: "dosya yüklenmeden kontrole çıkılamaz" kuralı iki yerde uygulanıyor.
 * Tarayıcı kullanıcıya anında söylüyor, sunucu ise kuralı gerçekten uyguluyor. İki kopya
 * yazılsaydı biri güncellenip diğeri unutulacaktı ve kural sessizce delinecekti.
 */

/** İşin bittiği ama dosyanın HENÜZ yüklendiği aşama — kategoriye göre adı değişir. */
export const YUKLEME_ASAMASI = {
  "Video": "Edit Yapıldı",
  "Fotoğraf": "Düzenleme Yapıldı",
  "Grafik Tasarım": "Tasarım Yapıldı",
};

/** Kategorisiz eski kayıtlar Video akışını kullanır. */
export const yuklemeAsamasi = (kategori) => YUKLEME_ASAMASI[kategori] || YUKLEME_ASAMASI.Video;

/** Dosya yüklenmeden GİRİLEMEYEN aşama. */
export const KAPILI_ASAMA = "Kontrol Bekliyor";

/**
 * Kartta müşteriye gösterilecek bir dosya var mı?
 *
 * Karta yüklenen dosya (medya dizisi) ya da elle yapıştırılmış bir bağlantı sayılır.
 * Bağlantının da sayılması bilinçli: Drive dışından gelen işler (WeTransfer) ve yükleme
 * sisteminden önce açılmış kartlar hâlâ bu alanı kullanıyor. Kuralın amacı "uygulamadan
 * yüklensin" değil, "müşterinin önüne bakacak bir şey olmadan kart çıkmasın".
 */
export function medyaVarMi(is) {
  if (!is) return false;
  if (Array.isArray(is.medya) && is.medya.length > 0) return true;
  return Boolean(is.editliDosyaLink);
}

/**
 * DOSYASIZ KONTROLE ÇIKMIŞ KARTLARI GERİ ALIR.
 *
 * Sunucu tarafındaki uygulama noktası. Kaydın TAMAMINI reddetmiyor — reddetmek, aynı
 * kayıttaki ilgisiz düzenlemeleri de çöpe atardı; bu projede tam olarak o yoldan veri
 * kaybı yaşandı. Onun yerine yalnızca kuralı delen kartın aşaması geri alınıyor ve karta
 * sebebi yazılıyor: kullanıcı ne olduğunu kartın geçmişinde görüyor.
 *
 * Yalnızca YENİ giren kartlara bakar; zaten "Kontrol Bekliyor"da duran eski kartlara
 * dokunmaz — geçmişte bu kural yokken oraya gelmiş olabilirler.
 */
export function dosyasizKontroleGirenleriGeriAl(oncekiIsler, sonrakiIsler, zaman) {
  const onceki = new Map((oncekiIsler || []).map((j) => [String(j.id), j]));
  let degisti = false;
  const duzeltilmis = (sonrakiIsler || []).map((j) => {
    if (j.asama !== KAPILI_ASAMA) return j;
    const eski = onceki.get(String(j.id));
    if (eski && eski.asama === KAPILI_ASAMA) return j;     // zaten oradaydı
    if (medyaVarMi(j)) return j;                            // dosyası var, kural sağlanıyor
    degisti = true;
    const geriAsama = (eski && eski.asama) || yuklemeAsamasi(j.kategori);
    return {
      ...j,
      asama: geriAsama,
      gecmis: [...(j.gecmis || []), {
        id: (j.gecmis || []).length + 1,
        tarih: zaman,
        yazan: "Sistem",
        aciklama: `Dosya yüklenmediği için kontrole gönderilemedi; kart "${geriAsama}" aşamasında kaldı.`,
      }],
    };
  });
  return degisti ? duzeltilmis : null;
}
