/**
 * MARCUS OS — TEKLİF & SÖZLEŞME KATALOĞU
 * ----------------------------------------------------
 * Yeni bir hizmet eklemek için sadece ilgili kategorideki diziye
 * yeni bir { id, ad, varsayilanAdet, varsayilanFiyat, madde } objesi ekle.
 * Teklif, sözleşme ve PDF üretimi hepsi buradan otomatik beslenir.
 *
 * madde: sözleşmeye otomatik eklenecek madde metni. {adet} yer tutucusu varsa
 * seçilen adetle değiştirilir.
 */

export const HIZMET_KATALOGU = {
  "İçerik": [
    { id: "reels", ad: "Reels", varsayilanAdet: 8, varsayilanFiyat: 1500, madde: "Aylık {adet} adet Reels içeriği üretilecek, kurgulanacak ve müşteri onayı sonrası yayınlanacaktır." },
    { id: "carousel", ad: "Carousel", varsayilanAdet: 4, varsayilanFiyat: 1200, madde: "Aylık {adet} adet çok görselli (carousel) gönderi tasarlanıp yayınlanacaktır." },
    { id: "tekGorsel", ad: "Tek Görsel", varsayilanAdet: 8, varsayilanFiyat: 600, madde: "Aylık {adet} adet tekil görsel içerik üretilecektir." },
    { id: "story", ad: "Story", varsayilanAdet: 20, varsayilanFiyat: 300, madde: "Aylık {adet} adet story içeriği hazırlanıp paylaşılacaktır." },
    { id: "profFoto", ad: "Profesyonel Fotoğraf", varsayilanAdet: 1, varsayilanFiyat: 8000, madde: "Aylık {adet} çekim günü profesyonel fotoğraf çekimi gerçekleştirilecektir." },
    { id: "profVideo", ad: "Profesyonel Video", varsayilanAdet: 1, varsayilanFiyat: 15000, madde: "Aylık {adet} çekim günü profesyonel video prodüksiyonu gerçekleştirilecektir." },
    { id: "drone", ad: "Drone Çekimi", varsayilanAdet: 1, varsayilanFiyat: 6000, madde: "İhtiyaç halinde {adet} seans drone ile havadan görüntü/video çekimi yapılacaktır." },
  ],
  "Sosyal Medya": [
    { id: "planlama", ad: "İçerik Planlaması", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "Aylık içerik planlaması Marcus Medya tarafından hazırlanıp müşteri onayına sunulacaktır." },
    { id: "icerikTakvimi", ad: "İçerik Takvimi", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Her ay için detaylı bir içerik takvimi oluşturulacak ve paylaşılacaktır." },
    { id: "paylasimYonetimi", ad: "Paylaşım Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 4000, madde: "Onaylanan içeriklerin ilgili sosyal medya hesaplarında zamanlanması ve paylaşılması Marcus Medya tarafından yürütülecektir." },
    { id: "metaBusiness", ad: "Meta Business Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 2500, madde: "Meta Business Suite hesabının kurulumu, ayarları ve düzenli yönetimi sağlanacaktır." },
    { id: "instagramYonetimi", ad: "Instagram Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 5000, madde: "Instagram hesabının içerik, mesaj ve etkileşim yönetimi Marcus Medya tarafından yürütülecektir." },
    { id: "facebookYonetimi", ad: "Facebook Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 3500, madde: "Facebook sayfasının içerik ve etkileşim yönetimi sağlanacaktır." },
    { id: "tiktokYonetimi", ad: "TikTok Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 4000, madde: "TikTok hesabının içerik üretimi ve yönetimi Marcus Medya tarafından yürütülecektir." },
    { id: "googleBusinessYonetimi", ad: "Google Business Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Google Business profili düzenli olarak güncellenecek ve yönetilecektir." },
    { id: "rakipAnalizi", ad: "Rakip Analizi", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "Sektördeki rakiplerin dijital varlığı periyodik olarak analiz edilip raporlanacaktır." },
    { id: "markaAnalizi", ad: "Marka Analizi", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "Müşteri markasının dijital algısı ve konumlandırması analiz edilecektir." },
    { id: "aylikRaporlama", ad: "Aylık Raporlama", varsayilanAdet: 1, varsayilanFiyat: 1500, madde: "Her ay sonunda performans metriklerini içeren detaylı bir rapor sunulacaktır." },
  ],
  "Reklam": [
    { id: "metaReklam", ad: "Meta Reklam Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 6000, madde: "Meta (Instagram/Facebook) reklam hesabının kurulumu, kampanya yönetimi ve optimizasyonu Marcus Medya tarafından yürütülecektir. Reklam harcama bütçesi bu tutara dahil değildir, ayrıca müşteri tarafından karşılanır." },
    { id: "pixelKurulumu", ad: "Pixel Kurulumu", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Meta Pixel ve gerekli izleme kodları web sitesine/hesaba kurulacaktır." },
    { id: "remarketing", ad: "Remarketing", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "Web sitesi/hesap ziyaretçilerine yönelik remarketing kampanyaları kurgulanıp yönetilecektir." },
    { id: "kampanyaOptimizasyonu", ad: "Kampanya Optimizasyonu", varsayilanAdet: 1, varsayilanFiyat: 2500, madde: "Yürütülen reklam kampanyaları düzenli olarak analiz edilip optimize edilecektir." },
    { id: "abTest", ad: "A/B Testleri", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Reklam performansını artırmak amacıyla düzenli A/B testleri uygulanacaktır." },
  ],
  "SEO / GEO": [
    { id: "seoAltyazi", ad: "SEO Uyumlu Alt Yazılar", varsayilanAdet: 1, varsayilanFiyat: 1500, madde: "Paylaşılan içeriklerin alt yazıları arama motoru optimizasyonuna (SEO) uygun şekilde hazırlanacaktır." },
    { id: "geoAltyazi", ad: "GEO Uyumlu Alt Yazılar", varsayilanAdet: 1, varsayilanFiyat: 1500, madde: "Paylaşılan içeriklerin alt yazıları, yapay zeka arama motorları için optimize edilecek şekilde (GEO) hazırlanacaktır." },
    { id: "anahtarKelime", ad: "Anahtar Kelime Analizi", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Sektöre uygun anahtar kelime analizi yapılıp içerik stratejisine yansıtılacaktır." },
    { id: "googleBusinessOpt", ad: "Google Business Optimizasyonu", varsayilanAdet: 1, varsayilanFiyat: 2000, madde: "Google Business profili arama sıralamasını iyileştirecek şekilde optimize edilecektir." },
    { id: "hashtagStratejisi", ad: "Hashtag Stratejisi", varsayilanAdet: 1, varsayilanFiyat: 1000, madde: "İçeriklerin erişimini artıracak hashtag stratejisi belirlenip uygulanacaktır." },
    { id: "trendAnalizi", ad: "Trend Analizi", varsayilanAdet: 1, varsayilanFiyat: 1500, madde: "Güncel platform trendleri takip edilerek içerik stratejisine entegre edilecektir." },
  ],
  "Tasarım": [
    { id: "storyTasarim", ad: "Story Tasarımı", varsayilanAdet: 10, varsayilanFiyat: 250, madde: "Aylık {adet} adet özel story tasarımı hazırlanacaktır." },
    { id: "postTasarim", ad: "Post Tasarımı", varsayilanAdet: 10, varsayilanFiyat: 400, madde: "Aylık {adet} adet grafik post tasarımı hazırlanacaktır." },
    { id: "carouselTasarim", ad: "Carousel Tasarımı", varsayilanAdet: 4, varsayilanFiyat: 800, madde: "Aylık {adet} adet çok sayfalı (carousel) tasarım hazırlanacaktır." },
    { id: "banner", ad: "Banner", varsayilanAdet: 2, varsayilanFiyat: 1000, madde: "İhtiyaç halinde {adet} adet dijital banner tasarımı hazırlanacaktır." },
    { id: "menuTasarim", ad: "Menü Tasarımı", varsayilanAdet: 1, varsayilanFiyat: 3500, madde: "{adet} adet menü tasarımı hazırlanıp teslim edilecektir." },
    { id: "billboard", ad: "Billboard", varsayilanAdet: 1, varsayilanFiyat: 5000, madde: "{adet} adet billboard/açık hava reklam tasarımı hazırlanacaktır." },
    { id: "thumbnail", ad: "Thumbnail", varsayilanAdet: 4, varsayilanFiyat: 300, madde: "Aylık {adet} adet video kapak (thumbnail) tasarımı hazırlanacaktır." },
  ],
  "Video": [
    { id: "kurgu", ad: "Kurgu", varsayilanAdet: 1, varsayilanFiyat: 2500, madde: "Çekilen video içeriklerinin kurgusu Marcus Medya tarafından yapılacaktır." },
    { id: "color", ad: "Color", varsayilanAdet: 1, varsayilanFiyat: 1500, madde: "Video içeriklere profesyonel renk düzenlemesi (color grading) uygulanacaktır." },
    { id: "sesDuzenleme", ad: "Ses Düzenleme", varsayilanAdet: 1, varsayilanFiyat: 1000, madde: "Video içeriklerin ses kalitesi düzenlenip iyileştirilecektir." },
    { id: "motionGraphics", ad: "Motion Graphics", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "İçeriklere motion graphics/animasyon öğeleri eklenecektir." },
    { id: "altyazi", ad: "Altyazı", varsayilanAdet: 1, varsayilanFiyat: 500, madde: "Video içeriklere Türkçe altyazı eklenecektir." },
    { id: "lisansliMuzik", ad: "Lisanslı Müzik", varsayilanAdet: 1, varsayilanFiyat: 500, madde: "Video içeriklerde telif sorunu oluşturmayacak lisanslı müzik kullanılacaktır." },
  ],
  "Ek Hizmetler": [
    { id: "webSitesi", ad: "Web Sitesi", varsayilanAdet: 1, varsayilanFiyat: 25000, madde: "Müşteriye ait kurumsal web sitesi tasarlanıp geliştirilecektir." },
    { id: "seo", ad: "SEO", varsayilanAdet: 1, varsayilanFiyat: 5000, madde: "Web sitesi için aylık arama motoru optimizasyonu (SEO) çalışması yürütülecektir." },
    { id: "googleAds", ad: "Google Ads", varsayilanAdet: 1, varsayilanFiyat: 4000, madde: "Google Ads reklam hesabı kurulup kampanyalar yönetilecektir. Reklam harcama bütçesi bu tutara dahil değildir." },
    { id: "kurumsalKimlik", ad: "Kurumsal Kimlik", varsayilanAdet: 1, varsayilanFiyat: 12000, madde: "Marka için kurumsal kimlik çalışması (renk paleti, tipografi, kullanım kılavuzu) hazırlanacaktır." },
    { id: "logoTasarim", ad: "Logo Tasarımı", varsayilanAdet: 1, varsayilanFiyat: 8000, madde: "Müşteriye özel logo tasarımı hazırlanıp tüm formatlarda teslim edilecektir." },
    { id: "influencerYonetimi", ad: "Influencer Yönetimi", varsayilanAdet: 1, varsayilanFiyat: 5000, madde: "İşbirliği yapılacak influencer'ların araştırılması, süreç yönetimi ve raporlaması sağlanacaktır." },
    { id: "crm", ad: "CRM", varsayilanAdet: 1, varsayilanFiyat: 6000, madde: "Müşteri ilişkileri yönetim sistemi (CRM) kurulumu ve entegrasyonu yapılacaktır." },
    { id: "mailMarketing", ad: "Mail Marketing", varsayilanAdet: 1, varsayilanFiyat: 3000, madde: "E-posta pazarlama altyapısı kurulup aylık kampanyalar yönetilecektir." },
  ],
};

/** Tüm hizmetleri tek düz listede döndürür (id ile hızlı arama için). */
export const TUM_HIZMETLER = Object.values(HIZMET_KATALOGU).flat();
export const hizmetBul = (id) => TUM_HIZMETLER.find((h) => h.id === id);

/**
 * HAZIR PAKETLER
 * Her paket: { [hizmetId]: adet } şeklinde bir harita. Paket seçilince bu
 * hizmetler, kendi varsayılan birim fiyatlarıyla otomatik işaretlenir.
 */
export const PAKETLER = {
  "Restaurant Basic": {
    reels: 4, tekGorsel: 10, story: 15,
    planlama: 1, paylasimYonetimi: 1, instagramYonetimi: 1, aylikRaporlama: 1,
    postTasarim: 8,
  },
  "Restaurant Premium": {
    reels: 8, carousel: 4, tekGorsel: 12, story: 30, profFoto: 1,
    planlama: 1, icerikTakvimi: 1, paylasimYonetimi: 1, instagramYonetimi: 1, facebookYonetimi: 1, googleBusinessYonetimi: 1, aylikRaporlama: 1,
    metaReklam: 1, seoAltyazi: 1, geoAltyazi: 1,
    postTasarim: 10, storyTasarim: 10,
  },
  "Hotel Growth": {
    reels: 6, story: 20, tekGorsel: 10,
    planlama: 1, instagramYonetimi: 1, googleBusinessYonetimi: 1,
    metaReklam: 1, remarketing: 1,
  },
  "Hotel Premium": {
    reels: 10, carousel: 6, story: 30, profFoto: 1, profVideo: 1, drone: 1,
    planlama: 1, icerikTakvimi: 1, instagramYonetimi: 1, facebookYonetimi: 1, googleBusinessYonetimi: 1, googleBusinessOpt: 1, aylikRaporlama: 1,
    metaReklam: 1, pixelKurulumu: 1, remarketing: 1, kampanyaOptimizasyonu: 1,
  },
  "Jewellery Premium": {
    reels: 8, carousel: 6, tekGorsel: 12, story: 25, profFoto: 1,
    planlama: 1, instagramYonetimi: 1, aylikRaporlama: 1,
    metaReklam: 1, hashtagStratejisi: 1,
    postTasarim: 10,
  },
  "Corporate Premium": {
    postTasarim: 10, carousel: 4, tekGorsel: 10,
    icerikTakvimi: 1, aylikRaporlama: 1,
    kurumsalKimlik: 1, logoTasarim: 1, webSitesi: 1, seo: 1, googleAds: 1,
  },
};

export const KATEGORI_SIRASI = Object.keys(HIZMET_KATALOGU);
export const SOZLESME_SURELERI = [1, 3, 6, 12];
