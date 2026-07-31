/**
 * MARCUS OS — TEKLİF & SÖZLEŞME KATALOĞU
 * ----------------------------------------------------
 * Yeni bir hizmet eklemek için sadece ilgili kategorideki diziye
 * yeni bir { id, ad, adetli?, madde } objesi ekle. Fiyat bu katalogda
 * yoktur — teklifin toplam fiyatını kullanıcı elle girer.
 *
 * adetli: true olan hizmetlerde (Reels, Carousel, Tek Görsel, Story) adet
 * seçilebilir; diğerleri sade bir işaretleme kutusudur (checkbox).
 *
 * madde: sözleşmeye otomatik eklenecek madde metni. {adet} yer tutucusu,
 * sadece adetli hizmetlerde seçilen adetle değiştirilir.
 */

export const HIZMET_KATALOGU = {
  "İçerik": [
    { id: "reels", ad: "Reels", adetli: true, varsayilanAdet: 8, madde: "Aylık {adet} adet Reels içeriği üretilecek, kurgulanacak ve müşteri onayı sonrası yayınlanacaktır." },
    { id: "carousel", ad: "Carousel", adetli: true, varsayilanAdet: 4, madde: "Aylık {adet} adet çok görselli (carousel) gönderi tasarlanıp yayınlanacaktır." },
    { id: "tekGorsel", ad: "Tek Görsel / Post", adetli: true, varsayilanAdet: 8, madde: "Aylık {adet} adet tekil görsel (post) içerik üretilecektir." },
    { id: "story", ad: "Story", adetli: true, varsayilanAdet: 20, madde: "Aylık {adet} adet story içeriği hazırlanıp paylaşılacaktır." },
    { id: "profFoto", ad: "Profesyonel Fotoğraf", madde: "Profesyonel fotoğraf çekimi gerçekleştirilecektir." },
    { id: "profVideo", ad: "Profesyonel Video", madde: "Profesyonel video prodüksiyonu gerçekleştirilecektir." },
    { id: "drone", ad: "Drone Çekimi", madde: "İhtiyaç halinde drone ile havadan görüntü/video çekimi yapılacaktır." },
  ],
  "Sosyal Medya": [
    { id: "planlama", ad: "İçerik Planlaması", madde: "Aylık içerik planlaması Marcus Medya tarafından hazırlanıp müşteri onayına sunulacaktır." },
    { id: "icerikTakvimi", ad: "İçerik Takvimi", madde: "Her ay için detaylı bir içerik takvimi oluşturulacak ve paylaşılacaktır." },
    { id: "paylasimYonetimi", ad: "Paylaşım Yönetimi", madde: "Onaylanan içeriklerin ilgili sosyal medya hesaplarında zamanlanması ve paylaşılması Marcus Medya tarafından yürütülecektir." },
    { id: "metaBusiness", ad: "Meta Business Yönetimi", madde: "Meta Business Suite hesabının kurulumu, ayarları ve düzenli yönetimi sağlanacaktır." },
    { id: "instagramYonetimi", ad: "Instagram Yönetimi", madde: "Instagram hesabının içerik, mesaj ve etkileşim yönetimi Marcus Medya tarafından yürütülecektir." },
    { id: "facebookYonetimi", ad: "Facebook Yönetimi", madde: "Facebook sayfasının içerik ve etkileşim yönetimi sağlanacaktır." },
    { id: "tiktokYonetimi", ad: "TikTok Yönetimi", madde: "TikTok hesabının içerik üretimi ve yönetimi Marcus Medya tarafından yürütülecektir." },
    { id: "googleBusinessYonetimi", ad: "Google Business Yönetimi", madde: "Google Business profili düzenli olarak güncellenecek ve yönetilecektir." },
    { id: "rakipAnalizi", ad: "Rakip Analizi", madde: "Sektördeki rakiplerin dijital varlığı periyodik olarak analiz edilip raporlanacaktır." },
    { id: "markaAnalizi", ad: "Marka Analizi", madde: "Müşteri markasının dijital algısı ve konumlandırması analiz edilecektir." },
    { id: "aylikRaporlama", ad: "Aylık Raporlama", madde: "Her ay sonunda performans metriklerini içeren detaylı bir rapor sunulacaktır." },
  ],
  "Reklam": [
    { id: "metaReklam", ad: "Meta Reklam Yönetimi", madde: "Meta (Instagram/Facebook) reklam hesabının kurulumu, kampanya yönetimi ve optimizasyonu Marcus Medya tarafından yürütülecektir. Reklam harcama bütçesi bu tutara dahil değildir, ayrıca müşteri tarafından karşılanır." },
    { id: "pixelKurulumu", ad: "Pixel Kurulumu", madde: "Meta Pixel ve gerekli izleme kodları hesaba kurulacaktır." },
    { id: "remarketing", ad: "Remarketing", madde: "Ziyaretçilere yönelik remarketing kampanyaları kurgulanıp yönetilecektir." },
    { id: "kampanyaOptimizasyonu", ad: "Kampanya Optimizasyonu", madde: "Yürütülen reklam kampanyaları düzenli olarak analiz edilip optimize edilecektir." },
    { id: "abTest", ad: "A/B Testleri", madde: "Reklam performansını artırmak amacıyla düzenli A/B testleri uygulanacaktır." },
  ],
  "SEO / GEO": [
    { id: "seoAltyazi", ad: "SEO Uyumlu Alt Yazılar", madde: "Paylaşılan içeriklerin alt yazıları arama motoru optimizasyonuna (SEO) uygun şekilde hazırlanacaktır." },
    { id: "geoAltyazi", ad: "GEO Uyumlu Alt Yazılar", madde: "Paylaşılan içeriklerin alt yazıları, yapay zeka arama motorları için optimize edilecek şekilde (GEO) hazırlanacaktır." },
    { id: "anahtarKelime", ad: "Anahtar Kelime Analizi", madde: "Sektöre uygun anahtar kelime analizi yapılıp içerik stratejisine yansıtılacaktır." },
    { id: "googleBusinessOpt", ad: "Google Business Optimizasyonu", madde: "Google Business profili arama sıralamasını iyileştirecek şekilde optimize edilecektir." },
    { id: "hashtagStratejisi", ad: "Hashtag Stratejisi", madde: "İçeriklerin erişimini artıracak hashtag stratejisi belirlenip uygulanacaktır." },
    { id: "trendAnalizi", ad: "Trend Analizi", madde: "Güncel platform trendleri takip edilerek içerik stratejisine entegre edilecektir." },
  ],
  "Tasarım": [
    { id: "storyTasarim", ad: "Story Tasarımı", madde: "Özel story tasarımları hazırlanacaktır." },
    { id: "postTasarim", ad: "Post Tasarımı", madde: "Grafik post tasarımları hazırlanacaktır." },
    { id: "carouselTasarim", ad: "Carousel Tasarımı", madde: "Çok sayfalı (carousel) tasarımlar hazırlanacaktır." },
    { id: "banner", ad: "Banner", madde: "İhtiyaç halinde dijital banner tasarımı hazırlanacaktır." },
    { id: "menuTasarim", ad: "Menü Tasarımı", madde: "Menü tasarımı hazırlanıp teslim edilecektir." },
    { id: "billboard", ad: "Billboard", madde: "Billboard/açık hava reklam tasarımı hazırlanacaktır." },
    { id: "thumbnail", ad: "Thumbnail", madde: "Video kapak (thumbnail) tasarımları hazırlanacaktır." },
  ],
  "Video": [
    { id: "kurgu", ad: "Kurgu", madde: "Çekilen video içeriklerinin kurgusu Marcus Medya tarafından yapılacaktır." },
    { id: "color", ad: "Color", madde: "Video içeriklere profesyonel renk düzenlemesi (color grading) uygulanacaktır." },
    { id: "sesDuzenleme", ad: "Ses Düzenleme", madde: "Video içeriklerin ses kalitesi düzenlenip iyileştirilecektir." },
    { id: "motionGraphics", ad: "Motion Graphics", madde: "İçeriklere motion graphics/animasyon öğeleri eklenecektir." },
    { id: "altyazi", ad: "Altyazı", madde: "Video içeriklere Türkçe altyazı eklenecektir." },
    { id: "lisansliMuzik", ad: "Lisanslı Müzik", madde: "Video içeriklerde telif sorunu oluşturmayacak lisanslı müzik kullanılacaktır." },
  ],
};

/** Tüm hizmetleri tek düz listede döndürür (id ile hızlı arama için). */
export const TUM_HIZMETLER = Object.values(HIZMET_KATALOGU).flat();
export const hizmetBul = (id) => TUM_HIZMETLER.find((h) => h.id === id);

export const KATEGORI_SIRASI = Object.keys(HIZMET_KATALOGU);
export const SOZLESME_SURELERI = [1, 3, 6, 12];
