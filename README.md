# Marcus OS

Marcus Medya için AI destekli CEO yönetim paneli.

## Bunu gerçek bir web adresinde yayınlama (Vercel ile, ~10 dakika)

### 1) Anthropic API anahtarı al
AI CEO sohbet özelliğinin çalışması için bir API anahtarına ihtiyacın var:
- https://console.anthropic.com adresine git, hesap oluştur
- "API Keys" bölümünden yeni bir anahtar oluştur (sk-ant-... ile başlar)
- Not: Bu ücretli bir API — her soru-cevap küçük bir maliyet çıkarır (genelde kuruşlarla ifade edilecek kadar düşük, ama takip etmekte fayda var)

### 2) Projeyi GitHub'a yükle
- github.com üzerinde yeni, boş bir repo oluştur (örn. `marcus-os`)
- Bu klasördeki tüm dosyaları o repoya yükle (GitHub Desktop kullanabilir ya da GitHub'ın web arayüzünden dosyaları sürükleyip bırakabilirsin)

### 3) Vercel'e bağla
- https://vercel.com adresine git, GitHub hesabınla giriş yap
- "Add New Project" → GitHub reponu seç → "Import"
- Framework otomatik olarak "Vite" algılanacak, ayar değiştirmene gerek yok
- **Environment Variables** kısmına şunu ekle:
  - Key: `ANTHROPIC_API_KEY`
  - Value: 1. adımda aldığın anahtar
- "Deploy" butonuna bas

2-3 dakika içinde `senin-projen.vercel.app` şeklinde gerçek bir adres alacaksın. Bu adresi telefonuna/bilgisayarına ana ekran olarak ekleyebilirsin.

### 4) Güncelleme yapmak istersen
Kodda değişiklik yapıp GitHub'a her push ettiğinde Vercel otomatik olarak yeniden yayınlar.

## Yerelde (kendi bilgisayarında) çalıştırmak istersen

```bash
npm install
npm run dev
```

AI sohbetinin yerelde çalışması için `.env.example` dosyasını `.env` olarak kopyala ve içine kendi API anahtarını yaz, ardından `vercel dev` ile çalıştır (düz `npm run dev` sadece arayüzü açar, `/api/chat` fonksiyonunu çalıştırmaz — o kısım Vercel'in kendi ortamını gerektirir).

## Güncelleme: Müşteri/Finans/Operasyon verilerini kalıcı kaydetme

Bu sürümde Müşteriler, Finans ve Operasyon bölümlerine ekleme/düzenleme/silme özelliği eklendi. Bunun
çalışması için Vercel projene bir **KV (veritabanı)** bağlaman gerekiyor — ek bir hesap açmana gerek yok,
aynı Vercel panelinden yapılıyor:

1. Vercel'de projenin sayfasına git (`marcus-os` projesi)
2. Sol menüden **Storage** sekmesine tıkla
3. **Create Database** → **KV** (Redis tabanlı) seç
4. Bir isim ver (örn. `marcus-os-db`) → **Create**
5. Açılan ekranda **"Connect to Project"** de, `marcus-os` projeni seç → onayla

   Bu adım gerekli ortam değişkenlerini (`KV_REST_API_URL`, `KV_REST_API_TOKEN` vb.) otomatik olarak projene ekler, elle bir şey yazmana gerek yok.

6. Ardından bu klasördeki güncellenmiş dosyaları (özellikle `src/App.jsx`, yeni eklenen `src/data.js` ve `api/data.js`, güncellenmiş `package.json`) GitHub reponuza yükle (var olan dosyaların üzerine yaz — GitHub "Upload files" ekranı otomatik günceller)
7. Vercel, GitHub'a her push'ta otomatik olarak yeniden deploy eder — birkaç dakika içinde site güncellenmiş olur

Veritabanı bağlandıktan sonra Müşteriler/Finans/Operasyon'da yaptığın her ekleme/düzenleme/silme otomatik
olarak kaydedilir (sağ altta "Kaydedildi" yazısını görürsün) ve sayfayı kapatıp açsan bile kalır.

## Sekmeler nasıl birbirine bağlı? (önemli)

- **Toplam Ciro** = Müşteriler sekmesindeki aktif/yeni müşterilerin aylık ücretleri **+** Finans > Gelirler'deki ek gelir kalemleri. Bir müşteri eklediğinde/sildiğinde ya da ücretini değiştirdiğinde, Dashboard'daki ciro anında güncellenir.
- **Toplam Gider** = Finans > Giderler'deki kalemlerin toplamı.
- **Net Kazanç / Kâr Marjı / Bekleyen Tahsilat / Tahsil Edilen** hepsi bu iki sayıdan ve Finans > Bekleyen Tahsilatlar'dan canlı olarak hesaplanır — elle "ay ekleme" gerektirmez.
- Finans sekmesindeki **"Geçmiş ay ekle (arşiv)"** özelliği sadece grafikte geçmiş ayları görmek içindir; güncel hesaplamayı etkilemez.
- **Operasyon** ve **Bekleyen Tahsilatlar**'da "Müşteri" alanı artık Müşteriler sekmesindeki isimlerden seçilir (en az bir müşteri eklemeden bu alanlar serbest metin olarak kalır).
- **AI CEO** sohbeti de bu canlı hesaplanmış verileri görür, yani sorduğun sorular güncel duruma göre cevaplanır.

## Yeni özellikler (bu sürüm)

- **Şifre koruması**: Vercel projende **Settings → Environment Variables** kısmına `SITE_PASSWORD` adında bir değişken ekleyip istediğin şifreyi tanımla. Ekledikten sonra **Deployments** sekmesinden en son deploy'un yanındaki **"Redeploy"** butonuna bas (ortam değişkeni değişiklikleri otomatik yayına yansımaz, yeniden deploy gerekir). Şifreyi eklemezsen site eskisi gibi korumasız çalışmaya devam eder.
- **Ayı Kapat**: Finans sekmesinde, ayın sonunda bu butona basınca o ayki gerçek ciro/gider otomatik arşive eklenir; "sabit" işaretlediğin gelir/gider kalemleri bir sonraki aya taşınır, "tek seferlik" olanlar temizlenir. Her ay elle silip yeniden girmene gerek kalmaz.
- **Müşteri detay sayfası**: Müşteriler sekmesinde bir müşterinin adına tıkla — o müşteriye ait tüm operasyon işlerini ve bekleyen tahsilatlarını tek yerde gör.
- **Çalışan arama kutusu**: Üstteki arama kutusuna müşteri, iş veya finans kalemi adı yaz; sonuca tıklayınca ilgili sekmeye/detaya gider.
- **CSV dışa aktarma**: Finans veya Ayarlar sekmesinden "CSV indir" ile tüm finans verilerini Excel'de açılabilir dosya olarak indir.

- **Müşteri bazlı maliyetler**: Bir müşterinin detay sayfasında (Müşteriler'de isme tıkla) "Maliyet ekle" ile freelancer ödemesi, dış hizmet gibi giderleri o müşteriye bağlayabilirsin. Eklediğinde: (1) o müşterinin Kâr Marjı'sı otomatik yeniden hesaplanır, (2) tutar Toplam Gider'e otomatik eklenir — elle Finans'a ayrıca girmene gerek yok.

- **Aylık ödeme takibi + bildirimler**: Müşteriler'de bir müşteriyi düzenleyip "Ödeme Günü" alanını doldur (örn. 5 = ayın 5'i). Sistem her ay otomatik olarak takip eder: gün gelmeden "Yaklaşıyor", geçtiğinde "Bekliyor", 7+ gün geçtiğinde "Gecikti" gösterir — bu tutarlar Dashboard'daki "Bekleyen Tahsilat"a otomatik eklenir. Müşteri detay sayfasından "Ödendi işaretle" ile o ayı kapatırsın, bir sonraki ay otomatik sıfırlanır. Üstteki zil ikonu artık gerçek bir bildirim listesi — gecikmiş ödemeler, gecikmiş operasyon işleri ve yaklaşan vergi tarihlerini tek yerde gösterir.

- **Personel sekmesi**: Yeni bir ana sekme. Her ekip üyesi için Maaş, SGK/Sigorta ve Kıdem Tazminatı Birikimi gir — toplamı otomatik olarak Dashboard ve Finans'taki Toplam Gider'e yansır, elle "gider kalemi" olarak ayrıca eklemene gerek kalmaz.

- **Faturalı/Faturasız takibi + otomatik KDV**: Müşteri eklerken/düzenlerken "Faturalı mı?" seçeneğini işaretle — faturalı olanların toplamı üzerinden Finans sekmesinde otomatik %20 KDV hesaplanır (Faturalı Ciro, Faturasız Ciro, Hesaplanan KDV KPI'ları). Aynı seçenek Gelirler'deki ek gelir kalemlerinde de var. Bu tahmini bir hesaplamadır, resmi beyanname yerine geçmez.

- **Kısmi faturalı müşteriler**: Müşteri formundaki alan artık evet/hayır değil, **"Faturalı Tutar (₺/ay)"** — aylık ücretin ne kadarının faturalı olduğunu tam sayı olarak girebilirsin (örn. 40.000₺'lik müşterinin 20.000₺'si faturalı, 20.000₺'si faturasız olabilir). Kalan kısım otomatik faturasız sayılır ve KDV sadece faturalı kısım üzerinden hesaplanır.

- **Birikim paneli**: Yeni bir sekme. Kıdem tazminatı, acil müdahale fonu gibi istediğin kadar "fon" oluşturup her birine "Para Ekle" / "Para Kullan" ile hareket işleyebilirsin. Hedef tutar girersen ilerleme çubuğu gösterir. Bu tutarlar Toplam Gider'e dahil değildir (zaten kazandığın paranın kenara ayrılmış hali) — sadece nerede ne kadar biriktirdiğini takip etmen için.

- **Ofis Giderleri tablosu**: Finans sekmesinde, genel Giderler listesinden ayrı, kendi başına bir bölüm — Kira, Elektrik, Su, İnternet, Aidat gibi kalemleri tek tek ekleyip takip edebilirsin. Toplamı otomatik olarak Toplam Gider'e dahil olur.

- **Veri güvenliği düzeltmesi**: Daha önce sunucudan veri okuma başarısız olursa uygulama yanlışlıkla demo veriyle devam edip onu kaydediyordu (gerçek verinin üzerine yazma riski). Artık okuma başarısız olursa hiçbir kayıt yapılmıyor, sadece "Tekrar Dene" ekranı gösteriliyor.
- **Tam Yedek (JSON)**: Ayarlar sekmesinden tüm verinin tam bir kopyasını indirebilir, istediğin an aynı dosyadan geri yükleyebilirsin (CSV'nin aksine hiçbir detay kaybolmaz). Düzenli aralıklarla yedek almanı öneririz.

- **Otomatik günlük yedekler + geri yükleme**: Her kayıt işleminde o günün son hali sunucuda otomatik saklanır (son 30 gün). Ayarlar sekmesinden istediğin tarihe tek tıkla geri dönebilirsin. Sol menünün altında artık "Son kayıt saati" ve "Son tam yedek indirme" bilgisi de sürekli görünüyor.
- **Ekstra öneri**: Upstash panelinde (Vercel > Storage > veritabanı > Open in Upstash > Backups sekmesi) "Daily Backup" seçeneğini de açık tutman, üçüncü bir güvenlik katmanı sağlar.

## Güncelleme: E-posta ile otomatik günlük yedek (isteğe bağlı, önerilir)

Her gece 03:00'te tam veri yedeğin otomatik olarak e-postana gönderilsin istersen:

1. https://resend.com adresinde ücretsiz hesap aç
2. **API Keys** → **Create API Key**
3. Vercel'de projenin **Settings → Environment Variables** kısmına ekle:
   - `RESEND_API_KEY` = Resend'den aldığın anahtar
   - `BACKUP_EMAIL` = yedeği almak istediğin e-posta adresi
4. **Deployments** sekmesinden en son deploy'u **Redeploy** et

Kurulumdan sonra Ayarlar sayfasındaki **"Şimdi Test Et"** butonuyla hemen deneyebilirsin — beklemene gerek yok.

- **Saatlik yedekleme hatırlatıcısı**: Uygulama açıkken her saat başı (ve son yedeğin 1 saatten eskiyse sayfa açılışından birkaç dakika sonra) ekranın ortasında "Şimdi Yedek Al" butonlu bir pencere çıkar. Tek tıkla JSON yedek indirir ve pencere kapanır; "1 saat sonra tekrar sor" ile erteleyebilirsin.

- **Mobil uyumluluk**: Telefon ekranında (dar ekranlarda) kenar menü otomatik olarak gizlenir, üstte çıkan hamburger (☰) butonuyla açılan bir çekmeceye dönüşür. Tablolar (Müşteriler, Personel) yatay kaydırılabilir; Operasyon panosu da yatay kaydırmayla açılır. İki sütunlu düzenler (Dashboard grafikleri, Finans bölümleri, formlar) telefonda tek sütuna iner.

- **Takvim sekmesi**: Yeni bir ana sekme. Operasyon işlerini (tarih alanına göre), müşterilerin ödeme günlerini ve vergi tarihlerini aylık bir takvimde gösterir. Bir güne tıklayınca o güne ait detayları listeler.
- **Aylık & Yıllık Karşılaştırma**: Finans sekmesine eklendi. Tüm ayları (geçmiş + bu ay) bir tabloda, ay-ay % değişimle birlikte gösterir; yıl bazında toplamları karşılaştırır (en az 2 yıllık veri birikince otomatik devreye girer). Geçmiş ay eklerken artık "Yıl" alanı da isteniyor.

- **Mobil kullanılabilirlik iyileştirmeleri**: Giriş kutularının yazı boyutu büyütüldü (iPhone'da dokununca ekranın otomatik yakınlaşması engellendi), butonlar ve tıklanabilir alanlar büyütüldü (parmakla dokunması kolaylaştı), kartların iç boşluğu telefonda daralttırıldı, açılır menüler (arama/bildirim) dar ekranlarda taşmayacak şekilde sınırlandırıldı, kenar menüsü (çekmece) artık kaydırılabilir.

- **Otomatik (dinamik) AI CEO Özeti**: Dashboard'daki özet artık sabit bir metin değil — sayfayı her açtığında güncel verilerine bakarak gerçek zamanlı oluşuyor, bekleyen/gecikmiş ödemeleri isim isim ve tutarlarıyla belirtiyor. Bunun için `ANTHROPIC_API_KEY` ortam değişkeninin tanımlı olması gerekiyor (AI CEO sohbeti için daha önce alınan anahtarla aynı).
- **Sabah 06:00 e-posta özeti**: Ayarlar sekmesinden kurulabilir — her sabah aynı AI özeti e-postana da düşer. `RESEND_API_KEY`, `BACKUP_EMAIL` ve `ANTHROPIC_API_KEY` gerektirir.
- **Bildirimler tutar gösteriyor**: Zil ikonundaki bekleyen/gecikmiş ödeme bildirimleri artık tutarlarıyla birlikte listeleniyor.

## Kaldırılan özellik

- **Operasyon sekmesi (Kanban pano) kaldırıldı.** Menüden, Dashboard'dan, Takvim'den ve Müşteri detay sayfasından tamamen temizlendi.

- **Ödenmeyen Ödemeler + Tebliğ Oluşturma**: Müşteriler sekmesinin en üstünde, ödeme günü geçtiği halde birden fazla aydır ödenmemiş müşteriler otomatik listelenir (kaç ay, toplam ne kadar borç birikmiş dahil). Her biri için **"Tebliğ Oluştur"** ile resmi bir ödeme hatırlatma yazısı yeni pencerede açılır ve yazdırma penceresi gelir — oradan "PDF olarak kaydet" ile dosya indirip müşteriye gönderebilirsin. "Metni Kopyala" ile de WhatsApp/e-posta için düz metin alabilirsin. Aynı özellik müşteri detay sayfasında da mevcut.

- **Ödeme Takvimi sekmesi (yeni)**: Ödeme günü tanımlı her müşterinin son 6/12 ayının ödenip ödenmediğini bir tabloda gösterir (✓ ödendi, ✕ ödenmedi, · henüz vadesi gelmedi). Hücrelere tıklayarak geçmişe dönük ayları da ödendi/ödenmedi olarak işaretleyebilirsin — Müşteriler sekmesindeki verilerle aynı yerden besleniyor. Her müşterinin ve toplamın birikmiş borcunu gösterir.
- **Düzeltme**: "Kaç aydır ödenmedi" hesaplaması artık müşterinin başlangıç tarihinden öncesini saymıyor (önceden hiç "ödendi" işaretlenmemiş müşterilerde 24 aya kadar şişebiliyordu).

- **İkinci güvenlik katmanı (sunucu tarafı fren)**: Artık ön yüzdeki hatadan bağımsız olarak, sunucu da her kayıt isteğinde kontrol yapıyor — eğer müşteri sayısı mevcut kayıtlı veriye göre %40'ın altına düşüyorsa (örn. bir hata sonucu boş/demo veri yazılmaya çalışılıyorsa), kayıt otomatik reddedilir ve ekranda "Kayıt güvenlik nedeniyle durduruldu" penceresi çıkar. Bilinçli bir toplu silme yaptıysan "Evet, bu doğru" ile devam edebilirsin.
- **Kritik hata düzeltmesi**: Uygulamanın ilk açılışında veritabanından okunan veri, önceden yanlışlıkla hemen geri kaydediliyordu — okuma bir anlığına boş dönerse (örn. yeni bir deploy sonrası), bu durum gerçek veriyi örnek veriyle eziyordu. Artık ilk yükleme asla otomatik kaydetmiyor; veritabanı gerçekten boşsa açıkça onay isteyen bir ekran çıkıyor.

- **Ödeme Takvimi'nde doğrudan ödeme günü girme**: Artık Müşteriler sekmesine gitmeden, Ödeme Takvimi tablosundaki "Ödeme Günü" sütununa tıklayıp her müşterinin ödeme gününü girebilir/değiştirebilirsin. Ödeme günü tanımlı olmayan müşteriler de listede görünür (ay hücreleri "—" ile işaretli, tıklanamaz — önce gün girilmesi gerekir).

- **Kısmi ödeme + banka takibi**: Ödeme Takvimi'ndeki hücrelere tıklayınca artık tutar, banka ve tarih girerek gerçek ödeme kayıtları oluşturabilirsin. Bir ay kısmen ödendiyse (½ işareti) kalan tutar otomatik hesaplanır ve Dashboard/Finans'a yansır. Finans sekmesine tüm bu kayıtları listeleyen "Banka Hareketleri" bölümü eklendi.
- **Düzenlenebilir tebliğ metni**: "Tebliğ Oluştur" artık serbestçe düzenleyebileceğin bir pencere açıyor. Ayarlar > "Tebliğ Şablonu"ndan genel şablonu ve firma adını kalıcı olarak değiştirebilirsin.
- **Teklif & Sözleşme modülü (yeni sekme)**: 55+ hazır hizmetten (İçerik, Sosyal Medya, Reklam, SEO/GEO, Tasarım, Video, Ek Hizmetler) seçim yaparak saniyeler içinde teklif ve otomatik olarak seçilen hizmetlere göre madde madde oluşan bir sözleşme üretir. 6 hazır paket (Restaurant/Hotel/Jewellery/Corporate) tüm seçimleri tek tıkla dolduruyor. Teklifi/sözleşmeyi yazdır-PDF yap, WhatsApp'ta paylaş, mail ile gönder. Açık/koyu tema desteği kendi içinde ayrı.

## Güncelleme: Reklamlar, Paylaşımlar ve Personel Erişimi

- **Reklamlar sekmesi**: Her markanın reklam/kampanya başlangıç-bitiş tarihlerini gir; bitmesine 3 gün kalınca ya da bittiğinde zil ikonundaki bildirimlerde otomatik uyarı çıkar.
- **Paylaşımlar sekmesi**: Her marka için planlanan görsel/video/reels/story paylaşımlarını "yapıldı/yapılmadı" olarak takip et. Bekleyen (stoktaki) içerik sayısı türe göre otomatik gösterilir.
- **Personel Erişimi (yeni)**: Ekibine sadece bu iki sekmeyi görebilecekleri, diğer hiçbir veriye (müşteri/finans/personel) erişemeyecekleri ayrı bir giriş verebilirsin.
  1. Vercel'de **Settings → Environment Variables** kısmına `STAFF_PASSWORD` ekle (SITE_PASSWORD'dan farklı bir şifre)
  2. **Redeploy** et
  3. Bu şifreyi ekibinle paylaş — o şifreyle girdiklerinde sadece Reklamlar ve Paylaşımlar'ı görür, sunucu diğer verileri tarayıcılarına hiç göndermez

## Güncelleme 2: Marka Bazlı Stok Sistemi, Tarih Seçici Düzeltmesi

- **Paylaşımlar artık marka kartlı stok sistemi**: Müşteriler sekmesindeki aktif/yeni müşteriler otomatik olarak burada kart olarak çıkar. Her kartta Görsel/Video/Reels/Story/Carousel için ayrı stok sayacı var. "Paylaşıldı" tıklanınca o türün stoğu 1 azalır, "+" tıklanınca (çekim yapıldığında) 1 artar. Üstte tür bazında toplam stok özeti, altta son hareketler listesi var.
- **Reklamlar ve Paylaşımlar'da tarih alanları artık gerçek takvim seçici**: Önceden düz metin kutusuydu, artık tıklayınca küçük bir takvim açılıp oradan seçiliyor. Bu aynı zamanda "biten reklamlar" filtresinin daha güvenilir çalışmasını sağlıyor (tarih formatı artık her zaman tutarlı).
- **Ayarlar'daki bozuk "Tebliğ Şablonu" kartı kaldırıldı.** Tebliğ metnini düzenleme özelliği (Müşteriler'de "Tebliğ Oluştur"a tıklayınca açılan pencere) olduğu gibi çalışmaya devam ediyor.

## Güncelleme 3: Teklif & Sözleşme — Fiyatsız Katalog, Logo, Kendi Şablonların

- **Fiyat kaldırıldı**: Hizmetlerin artık birim fiyatı yok. Sadece Reels, Carousel, Tek Görsel/Post ve Story'de adet seçilebiliyor; diğerleri sade işaretleme kutusu. Toplam fiyatı sağ panelden **tek elden sen giriyorsun**, "KDV ekle" işaretini açıp kapatabiliyorsun.
- **"Ek Hizmetler" kategorisi (Web Sitesi, SEO, Google Ads vb.) kaldırıldı.**
- **Logo alanları**: Sol panelde kendi logonu ve müşteri logosunu yükleyebiliyorsun; sağ önizlemede ve yazdırılan çıktıda otomatik görünüyor.
- **Son hali gör/düzenle**: "Teklifin Son Halini Gör" / "Sözleşmenin Son Halini Gör" artık önce düzenlenebilir bir pencere açıyor — değişiklik yapıp öyle yazdırıyorsun.
- **Hazır paketler kaldırıldı, yerine "Şablonlarım" geldi**: İstediğin bir seçimi "Şablon Olarak Kaydet" ile kendi adınla kaydedip sonra tek tıkla tekrar uygulayabiliyorsun. İstemediğin şablonu silebilirsin.

## Güncelleme 4: Çekim & Edit Takibi, CEO Paneli (Yetkiler), Sözleşme Şablonları

- **Çekim & Edit Takibi (yeni sekme)**: Her iş marka bazlı bir kart — içerik türü, çekim/teslim tarihi, kameraman, editör, öncelik, ilerleme yüzdesi. 9 aşamalı akış (Çekim Planlandı → ... → Teslim Edildi). Karta tıklayınca detay ekranı açılır: brief, notlar, ham/edit dosya linki, yorumlar, işlem geçmişi. "Editi Tamamladım" işi doğrudan bitirmez, "Kontrol Bekliyor"a alır — onay ve teslim sadece yöneticide. Revize isterken açıklama zorunlu. Personel girişinde "Panom" (Bugün Yapılacaklar / Geciken / Yaklaşan / Revize Bekleyen / Tamamlanan), yönetici girişinde "İstatistikler" (personel bazlı aktif/geciken iş, haftalık tamamlanan çekim/edit, ortalama süre) var.
  - *Not:* Personelin ayrı hesabı olmadığı için (tek ortak şifre var), personel paneline ilk girişte bir kere isim giriyor — işlemler o isimle kaydediliyor.
- **CEO Paneli — Personel Yetkileri**: Ayarlar'da artık Reklamlar / Paylaşımlar / Çekim & Edit Takibi'nin her birini personelden ayrı ayrı açıp kapatabiliyorsun. Kapattığın bölüm sunucu seviyesinde de engellenir.
- **Sözleşme Şablonların**: Sözleşmenin son halini düzenlerken "Bu Metni Şablon Kaydet" ile istediğin sözleşmeyi adlandırıp saklayabiliyorsun, bir sonraki teklifte açılır listeden seçip yükleyebiliyorsun.
- **Teklif artık görsel olarak zengin**: "Teklifi Yazdır/PDF" numaralı, sol çizgili, açıklamalı madde madde bir PDF üretiyor.
- **Marka Kimliği**: Ayarlar'a yüklediğin görsel, her teklifin ve sözleşmenin en altında otomatik çıkıyor.
- **Paylaşımlar'da markaya özel düşük stok tahmini**: Son 30 günün paylaşım hızına bakıp "~X gün içinde bitecek" şeklinde hem bildirim (zil ikonu) hem de kart üzerinde küçük turuncu bir noktayla uyarıyor.

## Güncelleme 5: Gerçek Personel Hesapları

- **Artık her ekip üyesine kendi kullanıcı adı + şifresi verilebiliyor** (tek ortak personel şifresi yerine, ya da onunla birlikte). Ayarlar > "Personel Hesapları"ndan ekleyip yönetiyorsun.
- Giriş ekranında artık **"Şifreyle Gir"** (senin şifren) ve **"Personel Girişi"** (kullanıcı adı + şifre) olmak üzere iki seçenek var.
- Kişisel hesapla giren bir personelin adı **otomatik olarak** biliniyor — Çekim & Edit Takibi'nde artık ismini elle girmesine gerek yok, işlem geçmişinde otomatik kendi adıyla görünüyor.
- Şifreler sunucuda **hash'lenmiş** olarak saklanıyor (düz metin hiçbir zaman tutulmuyor), ayrı ve korumalı bir uçtan (`/api/manage-staff`) yönetiliyor — ana veri akışına hiç karışmıyor, owner dahil kimseye şifre/hash geri gönderilmiyor.
- Eski tek şifreli personel girişi (`STAFF_PASSWORD`) hâlâ çalışmaya devam ediyor — istersen ikisini birlikte de kullanabilirsin.

## Güncelleme 6: Güvenlik Denetimi

- **Giriş ekranındaki tarayıcı otomatik-doldurma sorunu düzeltildi.** Kullanıcı adı/şifre kutularına doğru `autocomplete` özellikleri eklendi — tarayıcı artık alakasız/eski bir kayıtlı değeri oraya doldurmaya çalışmayacak.
- **İki tamamen korumasız uç nokta kapatıldı**: `/api/daily-backup` ve `/api/daily-summary` önceden URL'yi bilen HERKES tarafından tetiklenebiliyordu (senin adına e-posta ve AI maliyeti oluşturabilirdi). Artık `CRON_SECRET` (Vercel'in otomatik cron çağrıları için) veya `SITE_PASSWORD` (Ayarlar'daki "Şimdi Test Et" butonun için) gerektiriyor.
  - **ÖNEMLİ — bir şey yapman gerekiyor:** Vercel'de ortam değişkenlerine yeni bir `CRON_SECRET` ekle (rastgele, uzun bir metin — örn. bir şifre üretici ile oluşturabilirsin) ve Redeploy et. Bunu eklemezsen gece 03:00 ve 06:00'daki **otomatik** yedek/özet e-postaları artık çalışmaz (elle "Şimdi Test Et" butonu SITE_PASSWORD ile zaten çalışmaya devam eder).
- **Teklif/Sözleşme/Tebliğ çıktılarında HTML kod enjeksiyonu riski kapatıldı.** Yazdırılan belgelere eklenen metinler artık güvenli şekilde işleniyor.
- **Personel hesap yönetimi zaten şifreleri hash'lenmiş saklıyordu** — bu denetimde ek bir sorun bulunmadı, mevcut haliyle güvenli.
- **Veri kaybı korumaları (skipNextSave, güvenlik freni, seed-onay ekranı) tam olarak sağlam** — yeni eklenen personel hesabı mantığı bunlarla çakışmıyor.

## Güncelleme 7: Operasyon — Video ve Grafik Tasarım Ayrımı

- **"Çekim & Edit Takibi" artık "Operasyon" olarak adlandırıldı** ve iki kategoriyi kapsıyor: **Video** ve **Grafik Tasarım**.
- Yeni iş oluştururken artık en üstte bir **Kategori** seçiyorsun. Video seçersen iş, Video Edit akışına (Çekim Planlandı → ... → Teslim Edildi) düşüyor; Grafik Tasarım seçersen tasarıma özel bir akışa (Talep Alındı → Tasarım Bekliyor → Tasarım Yapılıyor → Kontrol Bekliyor → ... → Teslim Edildi) düşüyor — çekimle ilgisi olmayan gereksiz adımlar (Çekim Tarihi, Kameraman) otomatik gizleniyor.
- "Tüm İşler" görünümünde artık üstte **Video / Grafik Tasarım** sekmesi var, her biri kendi panosunu (kanban) gösteriyor.
- Personel ve yönetici panelleri, istatistikler bu ayrımla uyumlu çalışıyor.

## Güncelleme 8: "Tahsil Edilen" Hesaplama Düzeltmesi

- **Dashboard'daki "Tahsil Edilen" rakamı artık gerçek ödeme kayıtlarından hesaplanıyor**, önceki gibi ciro'dan bekleyeni çıkararak tahmin edilmiyor. Eski yöntem, ödeme günü henüz gelmemiş müşterileri de "tahsil edildi" sayıyordu — örneğin ayın 1'inde, hiç ödeme alınmamışken bile "Tahsil Edilen" büyük bir rakam gösterebiliyordu. Artık sadece Ödeme Takvimi'nden gerçekten "ödendi" olarak işaretlenmiş/kaydedilmiş tutarlar sayılıyor.

## Güncelleme 9: Günlük Marka Kontrol

- **Yeni sekme: "Günlük Kontrol"**. Müşteriler'deki aktif/yeni her marka için ayrı bir satır — o markanın Paylaşımlar'daki güncel stok durumu (Görsel/Video/Reels/Story/Carousel) ve en son ne zaman paylaşım yapıldığı görünür.
- Her markanın yanında bir işaret kutusu var — "bugün kontrol ettim" demek için tıklıyorsun. Üstte "X / Y kontrol edildi" ilerlemesi var.
- **Liste her gün gece yarısı otomatik sıfırlanır** — yeni güne her zaman temiz bir liste ile başlarsın.
- Personel de (izin verilmişse) bu sekmeyi görüp işaretleyebiliyor.

## Güncelleme 10: Ödeme Takvimi Veri Kaybı Düzeltmesi, Hesap Sistemi, Tam Personel Yetkileri

- **Ödeme Takvimi veri kaybı kök nedeniyle düzeltildi.** Ödeme ekleme/silme ve ödeme günü girme artık sunucuda doğrudan, hedefe yönelik çalışan ayrı bir uç noktadan (`api/client-payment.js`) geçiyor — tarayıcıdaki verinin bayat olması artık bu işlemler için veri kaybına yol açamaz.
- **Hesap/Banka sistemi**: Ödeme Takvimi ve Finans'a "Hesap Bakiyeleri" kartı eklendi. İstediğin kadar hesap tanımlayabilirsin (örn. "Aynur Akyalçın"), ödeme kaydederken hangi hesaba geldiğini seçersin, her hesabın bakiyesi otomatik hesaplanır. "Ana Hesaba Aktar" ile o hesaptaki bakiyeyi Marcus Medya'ya aktarabilirsin.
- **CEO Paneli artık TÜM sekmeleri kapsıyor**: Dashboard, Müşteriler, Finans, Takvim, Ödeme Takvimi, Teklif & Sözleşme, Personel, Birikim de dahil (Reklamlar/Paylaşımlar/Operasyon zaten vardı). Hepsi **varsayılan kapalı** — sadece açtığın sekmeyi personel görebilir. **Tek istisna: Ayarlar** — güvenlik ayarları (şifreler, personel hesapları) hiçbir zaman personele açılmaz, bilerek listede yok.
- Sunucu (api/data.js) bu yeni izin sistemine göre tamamen yeniden yazıldı — hangi sekme kapalıysa o verinin karşılığı personelin tarayıcısına hiç gönderilmiyor.

### Bilmen gereken sınırlamalar
- Personelin hâlâ ayrı "yetki seviyesi" (owner/staff) var ama **her yetkili sekmedeki tüm işlemleri yapabiliyor** (örn. Müşteriler açıksan, personel müşteri silme dahil her şeyi yapabilir) — sekme bazında ayrım var, işlem bazında ince ayrım yok.
- Dashboard'u personele açarsan, AI CEO Özeti/Sohbeti kısmı onlar için pasif kalır (sadece senin şifrenle çalışıyor) — bu bilgi artık nazikçe "kapalı" olarak gösteriliyor, hata vermiyor.

## Güncelleme 11: KRİTİK — Personel Yazımı Müşteri Verisini Eziyordu (Düzeltildi)

- **Bulunan hata**: Reklamlar/Paylaşımlar/Operasyon iznine sahip personel, kendi işini yaparken (örn. bir stok işaretlerken), arka planda sadeleştirilmiş (sadece isim) müşteri listesini de sunucuya "kaydet" olarak gönderiyordu — sunucu bunu gerçek, zengin müşteri verisinin (ödeme bilgileri, vergi bilgileri, maliyetler vb.) üzerine yazıyordu.
- **Düzeltme**: Artık "clients" (müşteri) verisi sadece Müşteriler/Finans/Takvim/Ödeme Takvimi/Dashboard gibi geniş yetkilerden yazılabiliyor. Reklamlar/Paylaşımlar/Operasyon izni olan personel müşteri isimlerini görmeye devam ediyor ama bu veriyi asla geri yazamıyor. Ayrıca personel yazımlarına da (owner'da zaten olan) müşteri sayısı güvenlik freni eklendi.

### ⚠️ Eğer veri kaybı yaşadıysan
Ayarlar → **Otomatik Günlük Yedekler**'e bak. Bu hatanın ortaya çıkmasından **önceki bir tarih** varsa (dünkü ya da daha öncesi), oradan geri yükleyebilirsin. Bugünün yedeği de etkilenmiş olabilir, dikkatli kontrol et.

## Güncelleme 12: Doğru Personel Eşleşmesi, Kişi Bazlı Yetki, İş Bildirimi, Haftalık Paylaşım Planı

- **Operasyon'da iş atama artık doğru eşleşiyor**: Kameraman/Editör alanları artık kayıtlı personel hesaplarından seçilebiliyor (yazarken öneri çıkıyor) — böylece isim yazım hatası/tutarsızlığı yüzünden işin personelin "Panom" ekranına düşmemesi sorunu ortadan kalktı.
- **Kişi bazlı yetkiler**: Ayarlar → Personel Hesapları'nda her hesabın yanındaki "Yetkiler / E-posta" ile artık **her kişiye ayrı ayrı** hangi sekmeleri göreceğini belirleyebiliyorsun (CEO Paneli'ndeki genel ayarın yerine geçer).
- **İş atama e-posta bildirimi**: Aynı panelden bir kişiye e-posta ekleyip Operasyon'da ona bir iş atadığında (kameraman/editör olarak seçtiğinde), otomatik bir bildirim e-postası gidiyor.
- **Paylaşımlar'a Haftalık Paylaşım Planı eklendi**: Her marka için haftanın günlerine (Pzt-Paz) paylaşım planlayabiliyorsun (tür seçerek). Plan yapıldığında güne tıklayınca **yeşil ✓** işareti çıkıyor. Hafta ileri/geri gezinebiliyorsun.

## Notlar
- Uygulama şu an örnek (demo) verilerle geliyor. Gerçek verilerini bağlamak istediğinde `src/App.jsx` içindeki `clients`, `monthly`, `operasyonlar` gibi listeleri kendi verilerinle değiştirebiliriz, ya da bir sonraki adımda bunları düzenleyebileceğin bir veri giriş ekranı ekleyebiliriz.
- API anahtarın hiçbir zaman tarayıcıya gönderilmiyor; `api/chat.js` sunucu tarafında çalışıyor.

## Güncellemeler 13: Veri Kaybı Denetimi — 9 Bulgunun Tamamı Kapatıldı

Tüm sistem baştan sona veri kaybı riski açısından tarandı. Bulunan 9 sorunun hepsi düzeltildi.

### 1. Çakışma koruması artık TÜM yazma yollarında çalışıyor (kritik)
Versiyon sayacı (`_v`) sadece yöneticinin ana kaydında artıyordu. Ödeme kayıtları, paylaşım/stok
işlemleri, personel kayıtları, kasa, personel hesapları ve müşteri paneli onayları veriyi
değiştiriyor ama sayacı olduğu gibi bırakıyordu — bu yüzden çakışma tespiti bu yolların hepsine
karşı **kördü**. Açık duran bir sekme, personelin az önce yaptığı işin üzerine fark etmeden
yazabiliyordu. Artık her yazma ortak bir katmandan (`lib/kv-yaz.js`) geçiyor ve sayacı artırıyor.

*Not: `lib/` klasörü `api/` dışında olduğu için Vercel'in 12 fonksiyon sınırını etkilemez — hâlâ 12/12.*

### 2. Yedekten geri yükleme artık geri alınabilir (kritik)
Eskiden geri yükleme mevcut veriyi hiçbir yere kaydetmiyordu: yanlış tarihe dönüp sonra biri bir
şey kaydettiğinde, geri yükleme öncesindeki hâl **kalıcı olarak** kayboluyordu. Artık geri
yüklemeden hemen önce mevcut verinin tam bir kopyası alınıyor (30 gün saklanır) ve
Ayarlar → **"Geri Yükleme Öncesi"** sekmesinden tek tıkla geri dönülebiliyor.
Ayrıca geri yüklemeden önce **"bu yedekte kaç müşteri/personel/iş var"** özeti gösteriliyor.

### 3. Eşzamanlı yazma kilidi eklendi
Tüm uç noktalar "oku → değiştir → yaz" yapıyordu; iki kişi aynı anda işlem yaptığında ikincisi
birincinin değişikliğini siliyordu. Artık bu döngü kısa ömürlü bir kilit altında yapılıyor
(10 saniyede kendiliğinden düşer, sistem asla kilitli kalmaz).

### 4. Personel kayıtlarında da çakışma kontrolü
İki editör aynı anda çalışırken biri diğerinin işini geri alabiliyordu. Personele de artık
versiyon bilgisi gönderiliyor ve bayat bir kayıt reddedilip en güncel veri çekiliyor.

### 5. Saatlik yedekler (son 48 saat)
Günlük yedek günde tek kayıttı — "dün'e dön" aslında "dünün SON hâline dön" demekti. Bozulma dün
sabah olduysa dünün yedeği de bozuktu. Artık her saatin ayrı bir yedeği tutuluyor (48 saat sonra
kendiliğinden silinir). Ayarlar → **"Saatlik"** sekmesinden saat saat geri dönülebilir.

### 6. Görseller otomatik küçültülüyor (sessiz uçurum kapatıldı)
Marka kimliği, teklif logoları ve müşteri içerik görselleri base64 olarak tek bir veri bloğunun
içinde saklanıyor. Vercel tek istekte ~4.5 MB kabul eder — görseller biriktikçe **kayıtlar
tamamen çalışmaz hâle gelirdi.** Artık her görsel tarayıcıda, sunucuya gitmeden önce küçültülüp
sıkıştırılıyor (genelde 10-40 kat küçülüyor, gözle fark edilmiyor). Eski 2 MB yükleme sınırı
kaldırıldı — telefondan çekilmiş fotoğraflar da artık sorunsuz yükleniyor.
Ayarlar'a bir **"Veri Boyutu"** kartı eklendi; sınıra yaklaşırsan uyarı veriyor.

### 7. Kaydedilmemiş değişiklik uyarısı
Kayıt 500ms gecikmeli gönderiliyor; tam o aralıkta sekme kapatılırsa değişiklik sessizce
kayboluyordu. Artık tarayıcı ayrılmadan önce uyarıyor.
Ayrıca hareketsizlik yönlendirmesi 60 saniyeden **3 dakikaya** çıkarıldı ve **doldurulmuş bir form
açıkken artık hiç yönlendirme yapmıyor** (eskiden yarım kalan formu uyarısız siliyordu).

### 8. İlk kurulum artık boş başlıyor
Veritabanı boş göründüğünde sunulan seçenek sahte müşteriler ve sahte finans rakamları
yazıyordu. Artık birincil seçenek **"Boş Başlat"**; örnek verilerle başlatma ayrı, ikincil ve
ekstra uyarılı bir seçenek olarak duruyor. Ayrıca "Tekrar Dene" en üste alındı.

### 9. Yetim müşteri hesapları otomatik temizleniyor
Bir marka silindiğinde ona bağlı Müşteri Paneli hesabı bazı yollardan silinmeden kalabiliyordu.
Artık her kayıtta sunucu tarafında otomatik kontrol edilip temizleniyor.

## Güncelleme 14: Drive Görseli Görünmüyor Sorunu

**Sorun:** Grafik Tasarım işlerinde Drive bağlantısı eklendiği halde görsel hiç görünmüyordu ve
ekranda bunun sebebini açıklayan HİÇBİR şey yazmıyordu.

**İki ayrı kök neden vardı, ikisi de sessizce başarısız oluyordu:**

1. **Klasör bağlantısı yapıştırılmışsa** hiçbir şey çizilmiyordu. Bir Drive *klasörü* tek bir
   görsel olarak gösterilemez — ama bu ekranda hiç belirtilmiyordu.
2. **Adres biçimi artık çalışmıyor.** Google, eski `uc?export=view` adresini çoğu dosya için
   doğrudan görsel olarak servis etmiyor; bunun yerine bir yönlendirme/onay sayfası dönüyor.
   Görsel yüklenemeyince kod `onError` ile onu **gizliyordu** — yani hata da görünmüyordu.

**Yapılanlar:**
- Artık önce Google'ın bu iş için tasarlanmış `thumbnail` adresi deneniyor; olmazsa `lh3` ve
  eski `uc` adresleri sırayla yedek olarak deneniyor.
- **Hiçbir durumda sessizce kaybolmuyor.** Görsel gösterilemiyorsa ekranda nedeni yazıyor:
  klasör bağlantısı mı, tanınmayan bir bağlantı mı, yoksa paylaşım ayarı kapalı mı.
- Aynı açıklama Video kategorisi için de eklendi (klasör/tanınmayan bağlantı durumunda).
- Klasör bağlantıları artık dosya sanılmıyor (adres ayrıştırma düzeltildi).

## Güncelleme 15: Aylık İş Raporu — Kim Kaç İş Yaptı (sadece yönetici)

Operasyon sekmesine yeni bir görünüm eklendi: **"Aylık İş Raporu"**. Ay ay, hangi kişinin kaç iş
tamamladığını gösterir — özellikle freelancer'larla ay sonu hesaplaşmak için.

### Nasıl sayıyor
- Bir iş, **"Teslim Edildi" aşamasına geçtiği tarihe** göre ilgili aya yazılır (planlanan teslim
  tarihine göre değil — gerçekte ne zaman bittiği önemli).
- Bir işte hem kameraman hem editör varsa, iş **ikisinin de** hanesine yazılır. Bu yüzden kişi
  toplamlarının toplamı, üstteki benzersiz iş sayısından fazla olabilir — bu normal.
- Kayıtlı personel olmayan (Operasyon'da isim olarak elle yazılan) **freelancer'lar da otomatik
  listeye girer** — ayrıca tanımlamana gerek yok.

### Neler görünüyor
- Ay seçici (ileri/geri), ay özeti: tamamlanan iş, çalışan kişi, toplam ödeme
- Kişi başına: toplam iş, Video / Grafik Tasarım kırılımı, kameraman mı editör mü olarak yaptığı
- Bir kişiye tıklayınca **yaptığı işlerin tam listesi** (marka, içerik türü, rol, teslim tarihi)
- **"Onaylandı"da bekleyen** işler ayrıca gösterilir — kişi çalışmış ama iş henüz teslim
  edilmemişse "sayılmadı" izlenimi oluşmasın diye
- **İş başı ücret (isteğe bağlı)**: bir kişiye iş başı ücret girersen aylık toplam ödemesi
  otomatik hesaplanır. Boş bırakırsan sadece adet sayılır.
- **CSV indir** — ay sonu ödemeleri için tabloyu Excel'de açabilirsin

### Gerçek tamamlanma tarihi artık kaydediliyor
Eskiden bir işin ne zaman teslim edildiği **hiçbir yerde alan olarak tutulmuyordu** — sadece işlem
geçmişindeki metnin ("Aşama değişti: ... → Teslim Edildi") içinden ayrıştırılabiliyordu. Artık
teslim anında gerçek tarih ayrı bir alana yazılıyor. İş geri alınırsa tarih temizleniyor, yani
rapor yanlış saymıyor. **Bu güncellemeden önce teslim edilmiş işler de sayılıyor** — onların
tarihi işlem geçmişinden geri kazanılıyor, yani geçmiş aylara da bakabilirsin.
Müşteri panelinden onaylanarak teslim edilen işler de sayıma dahil.

### Sadece yönetici görür
Bu görünüm personel panelinde **hiç görünmüyor** (sekme butonu ve içerik, ikisi de yönetici
kontrolünden geçiyor). Ayrıca iş başı ücret bilgisi sunucudaki personel izin listesinde yer
almadığı için **personelin tarayıcısına hiç gönderilmiyor** ve personel tarafından yazılamıyor.

## Güncelleme 16: Esnek Ücretlendirme — Toplu İşler ve Ücretsiz İşler

"10 tasarım yapacak ama tek ücret alınacak" ya da "öne çıkan ikonları yapacak ama ücret
almayacak" gibi durumlar, "kişi ücreti × iş sayısı" mantığıyla doğru hesaplanamıyordu.
Artık her işin ücreti ayrı ayrı belirlenebiliyor.

### Üç ücret modu
Bir işi Operasyon panosundan aç → **"Ücretlendirme"** bölümü (sadece yönetici görür):

| Mod | Ne yapar | Örnek |
|---|---|---|
| **Varsayılan** | Kişinin iş başı ücreti kullanılır | Normal tek iş |
| **Bu işe tek sabit ücret** | İş kaç parça içerirse içersin, tek tutar sayılır | 10 tasarım → tek ücret |
| **Ücretsiz (pakete dahil)** | İş raporda görünür ve sayılır, ödemeye 0 ₺ yazılır | Öne çıkan ikonları |

İşte hem kameraman hem editör varsa, sabit ücretin **kime yazılacağını** seçebiliyorsun
(editöre / kameramana / ikisine ayrı ayrı) — böylece tek bir ücret yanlışlıkla iki kez sayılmaz.

### "Kaç Parça?" alanı
İş formuna sayısal bir **"Kaç Parça?"** alanı eklendi (mevcut serbest metin "İstenen Adet"
alanından ayrı). Böylece iş sayısıyla üretim adedini ayrı ayrı takip edebiliyorsun:
*"bu ay 12 iş kaleminde 47 tasarım üretildi"* gibi. Rapor bunu hem ay özetinde hem kişi
bazında topluyor.

### Rapordaki değişiklikler
- Ay özetine **"Üretilen Parça"** kutusu eklendi
- Kişi satırında parça sayısı ve **kaç ücretsiz iş** yaptığı görünüyor
- İş listesinde her işin yanında ücretlendirmesi yazıyor ("Ücretsiz", "3.000 ₺ sabit", vb.)
- CSV'ye üretilen parça, ücretsiz iş sayısı ve ayrıca **iş bazlı detaylı döküm** eklendi

### Gizlilik
İş bazlı ücretler, işin kendi kaydında **değil**, ayrı ve yöneticiye özel bir alanda
(`isUcretDetaylari`) tutuluyor. Sebebi: iş kayıtları personelin tarayıcısına olduğu gibi
gönderiliyor — ücretler oraya konsaydı personel hepsini görebilirdi. Bu alan sunucudaki
personel izin listesinde yer almadığı için personele hiç ulaşmıyor ve personel tarafından
yazılamıyor.

## Güncelleme 17: Hesap Transferleri Artık Çift Yönlü ve Geri Alınabilir

**Sorun:** "Ana Hesaba Aktar" butonu tek yönlü ve hep-ya-hiç çalışıyordu. Aktarım her zaman
ana hesaba gidiyor, her zaman bakiyenin TAMAMINI götürüyordu. Sonuç olarak:
- Ana hesaptan bir alt hesaba **geri aktarmak imkânsızdı**
- İki alt hesap arasında aktarım yapılamıyordu
- Kısmi tutar aktarılamıyordu
- Yanlış yapılan bir aktarımı **geri almanın hiçbir yolu yoktu**
- Bakiye sıfırlanınca buton da kayboluyordu, yani ekran "öylece kalıyordu"

**Düzeltmeler:**
- Buton artık **"Aktar"** ve **her hesapta** (ana hesap dahil) çıkıyor
- Tıklayınca **hedef hesabı seçiyorsun** — herhangi bir hesaptan herhangi bir hesaba
- **Tutarı serbestçe giriyorsun**; "Tamamı" butonu tek tıkla bakiyenin hepsini yazar
- Bakiyeden fazlasını aktarmaya çalışırsan uyarı verir, işlem yapılmaz
- Yeni **"Transfer Geçmişi"** bölümü: her aktarım tarih, kaynak → hedef ve tutarla listeleniyor,
  yanındaki çöp kutusuyla **tek tıkla geri alınabiliyor**. Kayıt silinince bakiyeler
  kendiliğinden eski haline döner (bakiye her zaman transfer kayıtlarından hesaplanıyor,
  ayrı bir yerde tutulmuyor — bu yüzden geri alma güvenli).

## Güncelleme 18: Personel & Freelancer Avans Sistemi

Hem kadrolu personele hem freelancer'lara avans verilebiliyor — ikisi ayrı ayrı takip ediliyor.

### ⚠ En önemli kural: avans YENİ BİR GİDER DEĞİLDİR
Sistem maaşın tamamını zaten her ay gider sayıyor. Avans, o maaşın erken ödenmiş kısmıdır.
Ayrıca gider olarak eklenseydi **aynı para iki kez sayılır**, kâr olduğundan düşük görünürdü.
Bu yüzden avansın Toplam Gider'e etkisi **yoktur**. İki gerçek etkisi vardır:
1. Ay sonunda o kişiye ödenecek tutar, avans kadar azalır
2. Avansın çıktığı hesabın bakiyesi, avans kadar azalır (gerçekten çıkan para)

### Kadrolu personel (Personel sekmesi)
- Üstte bir **"Avans ayı"** seçici — hangi ayın avanslarına baktığını belirler
- Her satırda cüzdan ikonuyla **"Avans Ver"**: tutar, hangi aydan kesileceği, hangi hesaptan
  çıktığı ve not
- İki yeni sütun: **Avans** (o ay verilen toplam) ve **Maaştan Ödenecek** (maaş − avans)
- Avans tutarına tıklayınca o kişinin tüm avans geçmişi açılır; her kayıt **tek tıkla silinebilir**
  (silince hem ödenecek tutar hem hesap bakiyesi eski haline döner)

### Freelancer'lar (Operasyon → Aylık İş Raporu)
- Bir kişiyi açınca **"+ Avans ver"** bağlantısı
- Kişi satırında hesap açıkça görünür: `6.000 ₺ −2.000 ₺ = 4.000 ₺`
- Ay özetine **Verilen Avans** ve **Ödenecek Kalan** kutuları eklendi
- CSV'ye **Avans** ve **Ödenecek Kalan** sütunları eklendi

### Hesap bakiyesine etkisi
Avans verirken hangi hesaptan çıktığını seçiyorsun ve o hesabın bakiyesinden düşülüyor.
Bakiye hâlâ hiçbir yerde saklanmıyor — ödeme kayıtları, transferler ve avanslardan
hesaplanıyor. Bu yüzden bir avansı silmek bakiyeyi otomatik olarak eski haline döndürür.

### Sadece yönetici
Avans verileri sunucudaki personel izin listesinde yer almıyor — personelin tarayıcısına
hiç gönderilmiyor ve personel tarafından yazılamıyor. Avans arayüzü de yalnızca yönetici
ekranında görünür.

## Güncelleme 19: Personel Sekmesi İkiye Ayrıldı — Kadrolu / Freelancer + Ödeme Takibi

Personel sekmesi artık iki bölümden oluşuyor. **Ay seçici iki bölüm arasında paylaşılıyor** —
sekme değiştirince ay sıfırlanmaz, iki liste hep aynı dönemi gösterir.

### Kadrolu sekmesi — maaş ödeme takibi
- Personel formuna **"Maaş Ödeme Günü"** alanı eklendi (ayın kaçı — müşterilerdeki mantığın aynısı)
- Tabloya yeni sütunlar: **Ödeme Günü · Avans · Ödenen · Kalan · Durum**
- **Kalan = Maaş − Avans − Yapılan Ödemeler**
- Durum otomatik: *X gün sonra / Bugün / Bekliyor / Gecikti / Ödendi*
- Her satırdaki **"Öde"** butonuyla ödeme kaydı: tutar, tarih, hangi hesaptan, not
- Avans tutarına tıklayınca o kişinin **tüm avans ve ödeme geçmişi** açılır; her kayıt tek tıkla
  geri alınabilir

### Freelancer sekmesi (yeni)
Gerçek bir freelancer kaydı (ad, rol, telefon, e-posta, not) ve **üç kaynaktan otomatik senkron**:

1. **Müşteri detayındaki Maliyetler** — maliyet formuna *"Kime ödenecek? (freelancer)"* alanı
   eklendi. Bir kalemi bir kişiye bağlayınca, o kalem otomatik olarak kişinin aylık hak edişine
   sayılır ve müşteri detayında kimin altında olduğu görünür. Elle kopyalama yok.
2. **Operasyon işleri** — kameraman/editör olarak yaptığı işlerin hak edişi otomatik gelir.
   Bu hesap, Aylık İş Raporu'yla **aynı fonksiyonu** kullanır (`operasyonAylikHakEdis`), yani iki
   ekran asla farklı rakam gösteremez.
3. **Otomatik öneri** — Operasyon'da iş atanmış ama kayıtlı olmayan isimler üstte listelenir,
   tek tıkla freelancer olarak eklenir.

Her freelancer kartında dökümü görürsün:
**Müşteri kalemleri + Operasyon işleri = Hak Ediş − Avans − Ödenen = Kalan**

Avans verme ve ödeme kaydetme aynı karttan yapılır.

### Toplam Gider yine değişmiyor
Ne maaş ödemesi ne freelancer ödemesi Toplam Gider'i artırır:
- Kadrolunun maaşı zaten `personelGideri` içinde sayılıyor
- Freelancer'ın müşteri kalemi zaten `clientCosts` içinde sayılıyor

Ödeme kaydının işi sadece "ödendi mi, ne kadar kaldı" takibi yapmak ve **ödemenin çıktığı hesabın
bakiyesini azaltmak**. Bakiye artık şuradan hesaplanıyor:
`müşteri ödemeleri + transfer girişleri − transfer çıkışları − avanslar − personel/freelancer ödemeleri`

Hiçbiri saklanmadığı için, bir kaydı silmek bakiyeyi otomatik eski haline döndürür.

### Sadece yönetici
`freelancerlar` ve `personelOdemeleri` sunucudaki personel izin listesinde yer almıyor —
personelin tarayıcısına hiç gönderilmiyor. Personel ekranında Personel sekmesi açıksa bile
sadece eski sade tabloyu görür; Freelancer sekmesi, avans ve ödeme sütunları görünmez.

## Güncelleme 20: Tüm Tarih Alanları Gerçek Takvim Seçici Oldu

Birkaç yerde tarih alanları hâlâ düz metin kutusuydu — elle "26 Ağu" gibi yazmak gerekiyordu,
takvim açılmıyordu. Hepsi gerçek tarih seçiciye (tıklayınca takvim açılan alan) çevrildi:

| Nerede | Önce | Şimdi |
|---|---|---|
| Finans → Vergi Takvimi | metin ("örn. 26 Ağu") | takvim seçici |
| Ödeme Takvimi → ödeme kaydı | metin | takvim seçici |
| Personel/Freelancer → ödeme kaydı | metin | takvim seçici |
| Avans verme (her iki yer) | tarih hiç sorulmuyordu, otomatik bugün | takvim seçici (geçmiş tarihli avans girebilirsin) |
| Birikim → para ekle/kullan | tarih hiç sorulmuyordu, otomatik bugün | takvim seçici |

Ayrıca yeni eklenen formlarda tarih alanı **bugünle dolu geliyor** — çoğu zaman hiç dokunman
gerekmiyor.

### Eski kayıtlar bozulmadı
Geçmişte girilmiş serbest metin tarihler ("26 Ağu", "11.08.2026") olduğu gibi çalışmaya devam
ediyor. Tarih okuyucu artık her iki biçimi de anlıyor, ekranda ise hepsi "26 Ağustos 2026"
şeklinde okunur biçimde gösteriliyor.

### Takvimde yıl kontrolü
Tarih seçiciden gelen kayıtlar artık yıl bilgisi de taşıdığı için, Takvim sekmesi bunları doğru
yıla yerleştiriyor. Eski (yılsız) kayıtlar eskisi gibi her yıl aynı gün görünmeye devam eder.

## Güncelleme 21: Hesap Bakiyeleri Artık Elle Düzenlenebilir

**Bakiyeye tıkla, istediğin rakamı yaz.** Ekranda tam olarak yazdığın tutar görünür.

### İki mod — her hesap için ayrı
Hesap adının yanındaki küçük düğmeyle seçiyorsun:

- **otomatik** (varsayılan): müşteri ödemeleri o hesaba otomatik akar (eski davranış)
- **elle takip**: müşteri ödemeleri o hesaba **hiç akmaz**, bakiye tamamen senin kontrolünde

"Altın Olarak Alındı" gibi banka hesabı olmayan kalemleri **elle takip**'e alman mantıklı —
böylece hiçbir yere bağlı kalmaz, sadece kendi içinde durur.

Her iki modda da transferler, avanslar ve personel/freelancer ödemeleri bakiyeyi etkilemeye
devam eder — bunlar zaten o kartta bilerek yaptığın hareketler, yansımasalar kafa karıştırırdı.

### Neden "kaydedilen sayı" değil de düzeltme kaydı
Elle girdiğin rakam, mevcut bakiyeyle arasındaki **fark** olarak bir düzeltme kaydına yazılır.
Ekranda yazdığın rakamı görürsün ama:
- Hiçbir hareket kaybolmaz (hangi paranın nereden geldiği izlenebilir kalır)
- Yaptığın her düzeltme **"Elle Bakiye Düzeltmeleri"** listesinde durur ve **tek tıkla geri alınır**
- Bakiye hâlâ hiçbir yerde sabit sayı olarak saklanmadığı için, herhangi bir kaydı silmek her
  şeyi kendiliğinden eski haline döndürür

Bakiyeyi doğrudan bir sayı olarak saklasaydık bu güvenlik ağının hepsini kaybederdik — bir hata
olduğunda geri dönecek bir şey kalmazdı.

### Not
Personele Finans/Ödeme Takvimi açtıysan, onların gördüğü bakiyeler avans ve personel ödemelerini
içermez (bu veriler güvenlik gereği personele hiç gönderilmiyor), dolayısıyla senin gördüğünden
yüksek görünebilir. Bu sekmeler personele varsayılan olarak kapalıdır.

## Güncelleme 22: "Planım" — Kişisel Not Defteri (sadece yönetici)

Sol menüye, Dashboard'ın hemen altına **Planım** sekmesi eklendi. Yapman gerekenleri not
aldığın kişisel alan — müşteri işlerinden (Operasyon) tamamen ayrı.

### Nasıl çalışıyor
- Kutuya yaz, **Enter**'a bas — not eklenir. Çoğu not için başka hiçbir şeye dokunman gerekmez.
- **Tarih** isteğe bağlı. Verirsen not otomatik olarak doğru gruba düşer:
  *Tarihi Geçti · Bugün · Bu Hafta · Sonra · Tarihsiz*
- **● Önemli** işaretlediklerin kendi grubunun en üstünde ve kalın görünür
- Nota tıklayınca metnini düzenlersin, soldaki kutucukla tamamlarsın
- Tamamlananlar listeden çıkar, altta kapalı bir bölümde birikir (istersen geri alabilirsin)

### Unutulmaya karşı
Tarih verdiğin notlardan **bugüne ait** ve **tarihi geçmiş** olanlar, üstteki zil (bildirimler)
listesine de düşer. Böylece not aldıktan sonra Planım'a girmeyi unutsan bile karşına çıkar.

### Sadece sen görürsün
`kisiselGorevler` sunucudaki personel izin listesinde yer almıyor — personelin tarayıcısına hiç
gönderilmiyor. Personel menüsünde Planım sekmesi de yok.

### Not: Operasyon'un dağınıklığı
Operasyon şu an dört ayrı işi birden yapıyor (günlük takip / markalaşma / ay sonu ödeme raporu /
istatistik) ve **Aylık İş Raporu** ile yeni **Personel → Freelancer** sekmesi büyük ölçüde aynı
bilgiyi gösteriyor. Sadeleştirme için bir öneri hazır ama henüz uygulanmadı — karar senin.

## Güncelleme 23: Çekim Planı — Müşteriye Sunulan İçerik Planı

Müşteriye çekimden ÖNCE "şunları çekeceğiz, şunları konuşacaksın" diye sunabileceğin plan
özelliği eklendi. Ayrı bir sistem kurulmadı — mevcut **Müşteri Paneli**'ne yeni bir içerik türü
olarak eklendi, böylece onay/revize akışı, giriş sistemi ve bildirimler hazır geldi.

### Nasıl ekliyorsun
Müşteriler → markayı aç → **Müşteri Paneli İçerikleri** → *+ İçerik / Çekim Planı Ekle* →
**Çekim Planı** sekmesi. Alanlar:

- **Başlık** — örn. "Reels 1: Ürün tanıtımı"
- **Referans video linki** — seçtiğiniz örnek video (Drive linkiyse panelde gömülü oynatıcı
  olarak açılır, Instagram/TikTok linkiyse tıklanabilir bağlantı olur)
- **Konuşmalı / Konuşmasız / Dış ses** — içeriğin tipi
- **Konuşma metni** — kamera karşısında söyleyeceği metin (dış ses seçilirse "dış ses metni"
  olur; konuşmasızda bu alan hiç çıkmaz)
- **Çekim notu** — mekan, kıyafet, aksesuar gibi detaylar
- **Planlanan çekim tarihi** — takvimden seçilir (opsiyonel)

### Müşteri ne görüyor
Müşteri panelinde plan düzenli bir kart olarak açılır: tip etiketi, referans video (gömülü),
konuşma metni okunaklı bir blok içinde (satır boşlukları korunur), çekim notu ve planlanan tarih.
Altında **"✓ Planı Onayla"** ve **"Revize İste"** butonları — mevcut onay akışının aynısı.

### Sen ne görüyorsun
Listede çekim planları 🎬 işaretiyle ayrışır. Başlığa tıklayınca **gönderdiğin metni yeniden
okuyabilirsin** — müşteri revize isterse neyi değiştireceğini görmek için gerekli.

### Yeni bildirimler
Müşteri Paneli yanıtları artık üstteki zil listesine düşüyor:
- Müşteri **revize istediyse** (notuyla birlikte) — kırmızı
- Bir **çekim planı müşteri onayı bekliyorsa** — sarı

Eskiden bunu görmek için marka detayındaki bölümü elle açman gerekiyordu; revize isteği fark
edilmeden bekleyebiliyordu.

### Not
Çekim planı onaylandığında Operasyon'da otomatik iş açılmıyor — plan ile üretim şu an ayrı.
İstenirse "onaylanan plandan çekim işi oluştur" bağlantısı sonradan eklenebilir.

## Güncelleme 24: Müşteri Paneli Kendi Sekmesine Taşındı

Çekim planı/içerik yönetimi müşteri detayının içindeydi ve orası zaten kalabalık olduğu için
kayboluyordu. Ayrıca panel **iki ayrı yerden** yönetiliyordu: içerikler müşteri detayında,
giriş hesapları Ayarlar'da. İkisi de tek bir sekmede toplandı.

### Yeni: sol menüde "Müşteri Paneli"
- Üstte özet: **Müşteri onayı bekleyen · Revize istenen · Çekim planı** sayıları
- **Marka seç** — her markanın yanında rozetler: kırmızı = revize istedi, sarı = onay bekliyor.
  Böylece hangi markada ne olduğunu tek bakışta görürsün.
- Markaya tıkla → o markanın tüm içerikleri ve çekim planları açılır; **🎬 Yeni Çekim Planı** ve
  **İçerik Ekle** butonları doğrudan orada, katlanmış bir bölümün içinde saklı değil
- En altta **Müşteri Paneli Hesapları** (Ayarlar'dan buraya taşındı)

### Müşteri detayında ne oldu
Bölüm tamamen kaldırılmadı — hâlâ orada duruyor (bir markayla ilgilenirken hızlıca bakabilmen
için), ama başlığında "asıl yönetim: Müşteri Paneli sekmesi" notu var. İki görünüm **aynı kodu**
kullanıyor, yani birinde yaptığın değişiklik diğerinde de aynen görünür; ayrışma riski yok.

Ayarlar'daki hesap bölümünün yerinde de nereye taşındığını söyleyen kısa bir not bırakıldı.

## Güncelleme 25: GÜVENLİK — Şifre Otomatik Doldurma Açığı Kapatıldı, Oturum + İki Adımlı Doğrulama

### Açık neydi
İki ayrı hata birleşince, o cihaza oturan herkes CEO paneline girebiliyordu:

1. **Giriş alanı `autocomplete="current-password"` idi** → tarayıcı şifreyi kaydediyor ve bir
   sonraki açılışta otomatik dolduruyordu. "Şifre otomatik çıkıyor" sorununun kaynağı buydu.
2. **Şifre localStorage'da SÜRESİZ duruyordu** → tarayıcıyı açan herkes zaten yetkiliydi,
   oturum hiç sona ermiyordu.

### Yapılan düzeltmeler

**1. Otomatik doldurma tamamen kapatıldı**
Yönetici, personel ve müşteri giriş alanlarının üçünde de `autoComplete="off"` ve şifre
yöneticilerini de kapsayan işaretler (`data-lpignore`, `data-1p-ignore`) eklendi. Alan adı da
tarayıcının tanıyamayacağı bir isimle değiştirildi.

**2. Şifre artık tarayıcıda HİÇ saklanmıyor**
Girişten sonra sadece süreli bir **oturum anahtarı** saklanıyor:
- Normal giriş: **12 saat**, "Bu cihazı 30 gün hatırla" seçilirse **30 gün**
- Süresi dolunca giriş ekranı geri gelir
- Anahtar ele geçse bile şifreyi ifşa etmez
- Eski sürümden kalan düz şifre, ilk girişte otomatik silinir

**3. İki adımlı doğrulama (e-posta kodu)**
Vercel'de `OWNER_EMAIL` ortam değişkenine e-posta adresini yazman yeterli. Sonrasında her
girişte o adrese **6 haneli kod** gider; kod 10 dakika geçerli ve tek kullanımlık.
Şifreni bilen biri bile e-postana erişemeden giremez.

**4. Tüm cihazlardan çıkış**
Ayarlar → Güvenlik → **"Tüm Cihazlardan Çıkış Yap"**. Bir şüphe duyduğunda tek tıkla her
cihazdaki oturum geçersiz olur.

**5. Çıkış artık gerçekten çıkış yapıyor**
Eskiden sadece tarayıcıdan siliniyordu; artık sunucudaki oturum da kapatılıyor.

### Kilitlenme koruması (önemli)
`OWNER_EMAIL` veya `RESEND_API_KEY` tanımlı değilse, ya da e-posta gönderilemezse, kod adımı
**otomatik atlanır** ve şifreyle giriş yapılır. Yani e-posta servisi çalışmasa bile kendi
uygulamandan kilitlenmezsin.

### Yol boyunca bulunan ikinci bir hata
`daily-backup`, `daily-reminders` ve `daily-summary` uç noktalarında yetki kontrolü `await`
edilmeden çağrılıyordu. JavaScript'te bu, kontrolün **her zaman "yetkili" sayılması** demek —
yani bu üç uç nokta şifresiz tetiklenebilir durumdaydı. Düzeltildi.

### Teknik not
Oturum katmanı `lib/oturum.js` içinde; `api/` dışında olduğu için Vercel fonksiyon sayısı
**12/12** olarak kaldı. Giriş uç noktaları `api/data.js` içine `authAction` olarak eklendi.

## Güncelleme 26: İçerik / Çekim Planı Düzenleme

### Düzenleme eklendi
Müşteri Paneli sekmesinde (ve müşteri detayındaki kısa görünümde) her kaydın yanına
**kalem ikonu** geldi. Tıklayınca form o kaydın bilgileriyle dolar; başlığı, referans linkini,
konuşma metnini, çekim notunu, tarihi — hepsini değiştirip **"Değişiklikleri Kaydet"** dersin.
Eskiden tek yol silip yeniden yazmaktı.

**Kaydedince içerik müşteriye yeniden onaya gider:** durumu "Bekliyor"a döner ve varsa eski
revize notu temizlenir. Bu bilerek böyle — müşteri revize istedi, sen metni düzelttin, müşterinin
düzeltilmiş hâli görüp onaylaması gerekiyor. Düzenleme modundayken formun üstünde bunu
hatırlatan bir uyarı çıkar. Liste satırında da "düzenlendi <tarih>" notu görünür.

Düzenleme sırasında kaydın kimliği, bağlı olduğu marka ve Operasyon iş bağlantısı korunur —
düzenleme bir kaydı yanlışlıkla başka markaya taşıyamaz ya da iş bağlantısını koparamaz.

### Başlıklardaki üst üste binen 🎬 düzeltildi
Arayüz çekim planlarının başına kendi 🎬 ikonunu koyuyor. Başlığa elle de 🎬 yazıldığında
"🎬 🎬 🎬 Konu Başlığı" gibi görünüyordu. Artık başlığın başındaki emojiler gösterimde
otomatik temizleniyor — kayıtlı veriye dokunulmuyor, sadece ekranda düzgün görünüyor.
Hem senin listende hem müşterinin panelinde geçerli.

## Güncelleme 27: Müşteri Paneline Reklamlar, Paylaşım Planı ve Üretim Durumu

Müşteri artık kendi panelinde sadece onay bekleyen içerikleri değil, işin tamamını görüyor.

### Müşterinin gördüğü yeni bölümler
**Paylaşım Planı** — hangi gün ne paylaşılacak, hafta hafta gruplanmış. Her planın altında
**alt metni (caption)** okunur biçimde görünür. Paylaşılanlar "Paylaşıldı" etiketi alır, geçmiş
haftalar altta katlanmış durur.

**Reklam Kampanyaları** — kampanya adı, başlangıç/bitiş tarihi, durumu (Yayında / Yakında
bitiyor / Sona erdi) ve varsa not.

**Üretim Durumu** — markanın tüm Operasyon işleri, hangi aşamada oldukları ve teslim tarihleriyle.
Devam edenler üstte, tamamlananlar altta (son 5, istenirse hepsi açılır).

### Alt metin (caption) alanı eklendi
Haftalık paylaşım planına `altMetin` alanı eklendi. Yazmak için: **Müşteri Paneli** sekmesi →
markayı seç → **"Müşteri Panelinde Ayrıca Görünenler"** → *Paylaşım Planı* → ilgili planda
"+ Alt metin ekle". Sunucu tarafında yeni bir dosya açılmadı; `api/paylasim.js` içine
`haftalikAltMetin` action'ı olarak eklendi (fonksiyon sayısı hâlâ 12/12).

### Yönetici tarafı: "müşteri ne görüyor?"
Müşteri Paneli sekmesinde, seçili markanın altında yeni bir bölüm var. Paylaşım planı, reklamlar
ve operasyon işleri müşterinin göreceği hâliyle listeleniyor — bu veriler kendi sekmelerinde
(Paylaşımlar / Reklamlar / Operasyon) yönetilmeye devam ediyor, burası aynanın müşteri tarafı.
Tek düzenlenebilir alan alt metinler.

### Gizlilik — ne gönderilmiyor
Kayıtlar müşteriye olduğu gibi DEĞİL, **alan alan seçilerek** gönderiliyor. Bilerek dışarıda
bırakılanlar:
- **Reklam bütçesi**
- Operasyon işlerinde **kameraman/editör adları**, **iç yorumlar**, **işlem geçmişi**, **brief**
- Her türlü maliyet, ücret ve personel bilgisi

Bu yaklaşım ileriye dönük de korur: bu kayıtlara sonradan eklenecek yeni bir iç alan (yeni bir
maliyet kalemi, personel notu vb.) müşteri paneline kendiliğinden sızamaz — açıkça eklenmedikçe
gitmez.

## Güncelleme 28: Müşteri Panelinde Reklam/Plan/Durum Görünmeme Sorunu

Bir önceki güncellemede eklenen bölümler müşteri panelinde boş çıkıyordu. **İki ayrı hata** vardı:

### 1. Veri sunucudan geliyordu ama tarayıcı atıyordu (asıl sebep)
Müşteri girişinden dönen yanıt işlenirken alanlar tek tek kopyalanıyordu:
`{ musteriAd, marka, firmaAdi, icerikler }`. Yeni eklenen `reklamlar`, `paylasimPlani` ve
`operasyonIsleri` bu listede olmadığı için sunucu göndermesine rağmen **sessizce siliniyordu**.
Artık üçü de alınıyor.

### 2. İçerik listesi ilk açılıştan sonra hiç tazelenmiyordu
Müşteri panelindeki içerik listesi `useState(musteriData.icerikler)` ile kuruluyordu. Bu başlangıç
değeri **sadece ilk render'da** okunur — sonrasında sunucudan yeni veri gelse bile liste
güncellenmiyordu. Yani yönetici bir içerik ekleyip düzenlediğinde ya da onay sonrası veri
yenilendiğinde müşterinin ekranı ilk açılıştaki hâlinde donuyordu. Artık sunucu verisi
değiştiğinde liste otomatik tazeleniyor.

### Ek sağlamlaştırma: marka eşleştirmesi
Reklam ve Operasyon kayıtlarında marka, ID ile değil **adıyla** tutuluyor ve "Diğer (elle yaz)"
seçeneğiyle serbest metin de girilebiliyor. Tek bir fazla boşluk ya da büyük/küçük harf farkı
("Kanatçı Diren " vs "Kanatçı Diren") o markanın hiçbir reklamının görünmemesine yol açabilirdi.
E�leştirme artık boşluk ve harf büyüklüğüne takılmıyor — hem sunucuda hem yönetici ekranında
**aynı kural** kullanılıyor, böylece iki taraf asla farklı sonuç gösteremez.

## Güncelleme 29: Müşteri Paneli Sekmeli Oldu + Instagram Önizlemeli Paylaşım Takvimi

### 1. Uzun kartlar artık açılıp kapanıyor
Konuşma metinleri uzun olduğu için tek bir çekim planı ekranı metrelerce uzatıyor, 7 planlı bir
markada alt bölümlere ulaşmak imkânsız hâle geliyordu. Artık **her kart kapalı başlıyor** —
başlıkta konu adı, tarih ve "Aç ▼" görünüyor, tıklayınca içerik açılıyor.

### 2. Müşteri paneline sekmeler geldi
Her şey alt alta akmak yerine dört bölüme ayrıldı:

| Sekme | İçerik |
|---|---|
| **Onay Bekleyenler** | Çekim planları ve içerikler (bekleyen sayısı rozet olarak görünür) |
| **Paylaşım Takvimi** | Instagram önizlemeleri |
| **Reklamlar** | Kampanyalar ve durumları |
| **Üretim Durumu** | Operasyon işlerinin aşamaları |

### 3. Paylaşım takvimi artık Instagram önizlemesi
Planlanan her gönderi, gerçek bir Instagram gönderisi gibi görünüyor: marka avatarı, kare görsel,
beğeni/yorum ikon şeridi ve altında **marka adı + açıklama metni**. Uzun metinler "devamı"
bağlantısıyla kısaltılıyor — tıpkı Instagram'daki gibi. Paylaşılmış olanlar "✓ Paylaşıldı"
etiketi alıyor. Gönderiler hafta hafta gruplanıyor, geçmiş haftalar altta katlanmış duruyor.

### 4. Paylaşım görseli yükleme (yönetici tarafı)
**Müşteri Paneli** sekmesi → markayı seç → **"Müşteri Panelinde Ayrıca Görünenler"** →
*Paylaşım Takvimi*. Her planın altında **"Görsel / metin ekle"** butonu var:
- Görsel yükle (tarayıcıda otomatik küçültülüp sıkıştırılır — 1080px, ~400KB hedefli)
- Açıklama metnini yaz
- Yaptığın değişikliği **anında aynı Instagram önizlemesinde** görürsün

Yönetici ve müşteri **aynı önizleme bileşenini** kullanır — senin gördüğünle müşterinin gördüğü
asla ayrışamaz.

### Teknik notlar
- `haftalikPaylasimlar` kayıtlarına `gorselUrl` alanı eklendi; sunucu tarafı mevcut
  `haftalikAltMetin` action'ı genişletilerek yapıldı (yeni dosya yok, hâlâ **12/12**)
- Action sadece **gönderilen** alanı değiştirir: görseli güncellerken metin, metni güncellerken
  görsel sıfırlanmaz
- Görseller base64 olarak veri bloğunda saklandığı için sıkıştırma önemli — Ayarlar'daki
  **Veri Boyutu** kartından toplam boyutu takip edebilirsin

## Güncelleme 30: Instagram Genel Görünüm + Reklam İstatistikleri + Aylık Müşteri Raporu

### 1. Instagram genel görünümü (ızgara)
Paylaşım Takvimi'ne **Genel Görünüm / Tek Tek** geçişi eklendi. Genel görünüm, gerçek bir
Instagram profili gibi: yuvarlak marka avatarı, gönderi sayısı ve **3'lü kare ızgara**.
Her karenin sol üstünde gün etiketi, paylaşılmışsa sağ altında ✓ işareti var. Bir kareye
tıklayınca o gönderi tam önizlemesiyle (alt metniyle birlikte) altta açılıyor.

Bu görünüm "hesabın genel estetiği nasıl duruyor?" sorusuna cevap verir — marka bütünlüğünü
değerlendirmek için asıl bakılan yer burasıdır. Hem sen hem müşteri aynı görünümü kullanır.

### 2. Reklam istatistikleri
Reklam kaydına yeni alanlar eklendi: **Erişim · Gösterim · Tıklama · Etkileşim · Sonuç**.
Girilen rakamlardan **tıklama oranı (CTR)**, tıklama başına maliyet, sonuç başına maliyet ve
bin gösterim başına maliyet otomatik hesaplanır — elle girilmez, böylece tutarsızlık olmaz.

İstatistikler müşteri panelindeki Reklamlar sekmesinde kutucuklar hâlinde görünür.
**Bütçe müşteriye hâlâ gönderilmiyor** (iç bilgi olarak kalıyor).

### 3. Aylık Müşteri Raporu
**Müşteri Paneli** sekmesi → markayı seç → **Aylık Müşteri Raporu** kartı → ayı seç →
"Raporu Aç". Yeni pencerede açılır; oradan yazdırabilir ya da **PDF olarak kaydedip**
WhatsApp/e-posta ile müşteriye gönderebilirsin.

Rapor mevcut verilerden **otomatik üretilir**, ayrıca veri girmen gerekmez:

| Bölüm | Kaynağı |
|---|---|
| **Bu ay neler yaptık** | O ay "Teslim Edildi"ye geçen Operasyon işleri (içerik, kategori, adet, teslim tarihi) |
| **Bu ay neler paylaştık** | O ay paylaşıldı işaretlenen gönderiler — görselleri ve alt metinleriyle |
| **Ne paylaşacağız** | Bu haftadan itibaren planlanan gönderiler — gün, hafta ve alt metinleriyle |
| **Reklam kampanyaları** | O ayla kesişen kampanyalar ve tüm istatistikleri |

Üstte özet kutuları (teslim edilen iş, paylaşılan, planlanan, kampanya, toplam erişim, toplam
sonuç), üstte marka kimliği görselin ve tarih. Kart üzerinde raporu açmadan önce bu sayıları
görebilirsin — boş bir ay için rapor göndermezsin.

Uzun süren kampanyalar, ay içinde başlamamış olsalar bile o ay yayındaysa rapora dahil edilir.

## Güncelleme 31: Görseller Artık Drive Bağlantısıyla (Dosya Yükleme Kaldırıldı)

### Neden değişti
Müşteri paneli içeriklerinde "Görsel" türü dosya yükleme istiyordu ve yüklenen görsel base64
olarak veri bloğunun içinde saklanıyordu. Bu hem veri boyutunu şişiriyor (Vercel'in ~4.5 MB
istek sınırına yaklaştırıyor) hem de zaten Drive kullanılan bir akışta gereksiz ikinci bir
yöntem yaratıyordu.

### Ne değişti
**Müşteri Paneli → İçerik Ekle → Görsel** artık dosya değil **Drive bağlantısı** istiyor —
Video ve Çekim Planı ile aynı mantık. Bağlantıyı yapıştırdığın anda **önizleme** çıkıyor,
böylece yanlış link müşteriye gitmeden fark ediliyor.

**Paylaşım Takvimi görselleri** de aynı şekilde Drive bağlantısına geçti.

### Drive adres sorunu çözülmüş hâliyle taşındı
Google, eski `uc?export=view` adresini artık çoğu dosya için doğrudan görsel olarak servis
etmiyor. Operasyon'da çözülen bu sorunun aynı çözümü buraya da getirildi: sırayla
`thumbnail` → `lh3` → `uc` adresleri deneniyor. Hiçbiri açılmazsa **sessizce kaybolmuyor**,
nedenini yazıyor: klasör bağlantısı mı, tanınmayan bağlantı mı, yoksa paylaşım ayarı mı kapalı.

Form altında da hatırlatma var: *Drive'da görsele sağ tık → Paylaş → "Bağlantıya sahip olan
herkes / Görüntüleyen"*.

### Eski kayıtlar bozulmadı
Daha önce yüklenmiş base64 görseller olduğu gibi çalışmaya devam ediyor — hem müşteri
panelinde, hem Instagram önizlemesinde, hem ızgarada, hem aylık raporda. Sistem kaydın
base64 mi Drive bağlantısı mı olduğunu kendi anlıyor.

Aylık raporda Drive bağlantıları otomatik olarak gösterilebilir `thumbnail` adresine çevriliyor
(ham paylaşım linki bir `<img>` etiketinde açılmaz).

### Dosya yükleme nerede kaldı
Marka kimliği görseli ve teklif/sözleşme logoları hâlâ dosya yüklemeyle çalışıyor — onlar tek
seferlik, küçük ve sıkıştırılmış kayıtlar; Drive'a taşınmaları anlamsız olurdu.

## Güncelleme 32: Çekim Planı → Operasyon Senkronu + Müşteri Girişi "Beni Hatırla"

### 1. Onaylanan çekim planı Operasyon'da otomatik iş açıyor
Müşteri bir çekim planını onayladığında, Operasyon'da **otomatik olarak iş oluşuyor** — elle
aktarmana gerek yok. Kategoriye göre doğru akışa düşüyor:

| Kategori | Açılan aşama |
|---|---|
| **Video** | Çekim Planlandı |
| **Grafik Tasarım** | Talep Alındı |

Çekim planı formuna **"Onaylanınca Operasyon'da açılacak iş türü"** seçimi eklendi (Video /
Grafik Tasarım). Konuşma metni ve çekim notu işin **brief** alanına taşınıyor, referans video
bağlantısı da işe ekleniyor — ekip planı Operasyon'da görüyor, müşteri paneline bakmasına gerek
kalmıyor.

Onaylanan planın yanında **"✓ Operasyon'da iş açıldı"** işareti çıkıyor.

**Çift iş açılmasına karşı:** plan bir kez bir işe bağlandıktan sonra tekrar onaylanırsa yeni iş
oluşmuyor.

**Dikkat edilen bir tuzak:** sistemde "müşteri onayladıysa işi Teslim Edildi yap" kuralı vardı.
Çekim planları bu kuralın dışında tutuldu — çünkü bir çekim planının onaylanması "iş bitti"
değil, **"çekime başlayabiliriz"** demektir. Bu ayrım olmasaydı revize sonrası tekrar onaylanan
bir plan, çekim hiç yapılmadan "Teslim Edildi"ye atlardı.

### 2. Müşteri girişinde "Beni hatırla"
Giriş ekranına **varsayılan olarak açık** bir "Beni hatırla" seçeneği eklendi:
- **İşaretliyken:** bilgiler kalıcı saklanır, müşteri bir daha şifre yazmaz
- **Kapatılırsa:** sadece o sekme açık kaldığı sürece hatırlanır, sekme kapanınca silinir

Ayrıca **kullanıcı adı önceki girişten hazır geliyor** — müşteri en fazla şifresini yazar.

*Not: bazı tarayıcılar (özellikle iPhone Safari) uzun süre girilmeyen sitelerin kayıtlı
bilgilerini kendiliğinden siler. Bu tarayıcı davranışıdır; o durumda müşteri bir kez daha
giriş yapar.*

### 3. Çıkış butonu belirginleştirildi
Müşteri panelinde çıkış butonu zaten vardı ama küçük ve dikkat çekmiyordu. Artık ikonlu ve
belirgin, üstelik **panelin altına da bir tane** eklendi (uzun listelerde en yukarı dönmek
zorunda kalınmasın). İkisi de onay soruyor, yanlışlıkla çıkış olmuyor.

## Güncelleme 33: Onay Kutusu — Revize İstekleri Senin Onayınla Operasyon'a Düşüyor

Müşteri revize istediğinde bunu görmek için Müşteri Paneli sekmesine girmen gerekiyordu ve
üretime aktarmanın otomatik bir yolu yoktu. Artık **Planım** sekmesinin en üstünde
**"Onayını Bekleyenler"** kutusu var.

### Kutuda ne görünüyor
**1. Müşterinin revize istedikleri** — marka adı, hangi içerik ve müşterinin notu.
İki seçenek:
- **Planı Düzenle** → doğrudan Müşteri Paneli sekmesine götürür (metni düzeltip tekrar
  göndermek istiyorsan)
- **Operasyona Aktar** → küçük bir form açılır:
  - **Hangi alana düşsün?** Video / Grafik Tasarım
  - **Kim yapacak?** Kameraman ve Editör (kayıtlı personel + freelancer'lar tek listede)
  - **Teslim tarihi**

  Aktarınca iş doğru sütunda ve doğru kişinin üstünde açılır. Müşterinin revize notu işin
  **brief**'ine yazılır, işlem geçmişine de kayıt düşer.

**2. Kimseye atanmamış işler** — Operasyon'a düşmüş ama üstünde kimse olmayan işler (örneğin
müşteri bir çekim planını onayladığında otomatik açılanlar). Buradan tek tıkla kişi atarsın.
Atanınca kutudan kendiliğinden düşer.

### Bağlı iş varsa yeni iş açılmaz
Revize edilen içerik zaten bir Operasyon işine bağlıysa yeni iş açılmaz — mevcut iş
**"Revize İstendi"** aşamasına alınır ve atama güncellenir. Böylece aynı iş için ikinci bir
kart oluşmaz.

### Liste saklanmıyor, hesaplanıyor
Onay kutusu kalıcı bir kayıt tutmaz; her açılışta mevcut veriden hesaplanır. Bir kayıt
hallolduğunda kutudan kendiliğinden düşer — senkronu bozacak ikinci bir kopya oluşmaz.

### Bildirimler
Üstteki zil listesine artık **atanmamış işler** de düşüyor. Revize bildirimleri de nereden
işlem yapacağını söylüyor ("Planım'daki onay kutusundan Operasyon'a aktarabilirsin").
