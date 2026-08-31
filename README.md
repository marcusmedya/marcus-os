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

## Güncelleme 34: Revize Doğru Aşamaya Düşüyor

**Hata:** Onay kutusundan "Operasyona Aktar" dendiğinde, henüz bir işe bağlı olmayan revize
istekleri için **"Çekim Planlandı"** (Grafik Tasarım'da "Talep Alındı") aşamasında iş
açılıyordu. Bu yanlış — o aşama yeni bir çekim için ayrılmış olmalı.

**Düzeltme:** Revizeden açılan iş artık doğrudan **"Revize İstendi"** aşamasında başlıyor.
Her iki kategoride de geçerli. Zaten bağlı bir iş varsa o da eskisi gibi "Revize İstendi"ye
alınıyor — yani iki yol da aynı yere çıkıyor.

Akış artık şöyle:

| Olay | Düştüğü aşama |
|---|---|
| Müşteri çekim planını **ilk kez onaylar** | Video → **Çekim Planlandı** · Grafik → **Talep Alındı** |
| Müşteri **revize ister**, sen aktarırsın | **Revize İstendi** |

### Yan etki de düzeltildi
Aktarım sonrası kaydın durumu "bekliyor"a çekiliyordu — müşteri panelinde "incelemeni
bekliyor" diye görünüyordu, oysa müşterinin inceleyeceği yeni bir şey yoktu.

Artık durum **"Revize İstendi"** olarak kalıyor; kayıt onay kutusundan ayrı bir işaretle
(`operasyonaAktarildi`) düşüyor. Düzeltilmiş içeriği gönderdiğinde durum kendiliğinden
"Bekliyor"a dönüyor.

Bu işaret iki yerde sıfırlanıyor, böylece kilitlenme olmuyor:
- Sen içeriği düzenleyip tekrar gönderdiğinde
- Müşteri **yeniden** revize istediğinde (önceki istek aktarılmış olsa bile yeni istek
  onay kutusunda tekrar görünür)

## Güncelleme 35: Onaylanan Çekim Planları da Senin Onayınla ve Atamanla Düşüyor

**Önceki durum:** Müşteri bir çekim planını onaylayınca Operasyon'da iş **otomatik** açılıyordu —
kimseye atanmamış hâlde ve her zaman "Çekim Planlandı" aşamasında. Oysa siz içerik fikrini
çekimden önce gönderiyorsunuz; onay geldiğinde çekim çoktan yapılmış oluyor ve iş doğrudan edit
sırasına girmeli.

**Yeni akış:** Otomatik iş açılması **kaldırıldı**. Müşteri onayladığında kayıt
**Planım → Onayını Bekleyenler** kutusuna düşüyor. Sen "Operasyona Aktar" dediğinde açılan formda:

- **Hangi alana düşsün?** Video / Grafik Tasarım
- **Kim yapacak?** Kameraman ve Editör/Tasarımcı
- **Teslim tarihi**
- **Hangi aşamada başlasın?** — tüm aşamalar listelenir, istediğini seçersin

Varsayılan aşamalar duruma göre farklı:

| Durum | Varsayılan aşama |
|---|---|
| Müşteri **onayladı** (Video) | **Çekim Yapıldı** |
| Müşteri **onayladı** (Grafik Tasarım) | **Tasarım Bekliyor** |
| Müşteri **revize istedi** | **Revize İstendi** |

Hepsi formdan değiştirilebilir — varsayılan sadece en sık kullanılan seçenek.

Konuşma metni, çekim notu, içerik tipi ve varsa müşterinin revize notu işin **brief**'ine
yazılıyor; işlem geçmişine de kimin aktardığı kaydediliyor.

### Kod tarafında
Revize ve onay akışları **aynı aktarım formunu** (`AktarimFormu`) kullanıyor — tek yerde tanımlı
olduğu için iki akış zamanla birbirinden ayrışamaz. Kutu hâlâ hesaplanan bir liste, saklanmıyor;
aktarılan kayıt kendiliğinden düşüyor.

## Güncelleme 36: Yönetici de Müşteri Adına Onaylayabiliyor

Müşteri onaylamayı unuttuğunda iş takılı kalıyordu — çekim planı "Bekliyor"da duruyor, Operasyon'a
düşmüyordu. Artık **sen de onaylayabiliyorsun.**

### Nasıl
**Müşteri Paneli** sekmesinde (ve müşteri detayındaki kısa görünümde) "Bekliyor" durumundaki her
kaydın yanında yeşil çerçeveli **"✓ Onayla"** butonu var. Onay istiyor, yanlışlıkla basılmıyor.

### Sonuç müşterinin onayıyla birebir aynı
Bu bilinçli bir tercih — iki farklı onay yolu farklı sonuç vermesin:
- **Çekim planı** → Planım > Onay Kutusu'na düşer, oradan atamanla Operasyon'a aktarılır
- **Bağlı işi olan normal içerik** → iş "Teslim Edildi" olarak kapanır (sunucudaki müşteri
  onayı akışının aynısı)

### Kim onayladı görünüyor
Artık onayın kimden geldiği kaydediliyor. Listede senin onayladıkların **"Onaylandı ✓ (sen)"**
olarak görünür; etiketin üzerine gelince de yazar. Onay Kutusu'nda da **"Sen onayladın"** /
**"Müşteri onayladı"** ayrımı yapılır — böylece gerçekten müşteriden gelen onayla senin
kapattığın işi karıştırmazsın.

Bu alan sunucu tarafına da eklendi, yani müşterinin kendi onayları da "Müşteri" olarak
işaretleniyor.

## Güncelleme 37: Revize İstekleri Onay Kutusundan Kaybolmuyor

**Sorun:** Revize istekleri "Onayını Bekleyenler" kutusunda görünmüyordu.

**Sebep:** Bir revizeyi Operasyon'a aktarınca kayıt `operasyonaAktarildi` olarak işaretleniyor ve
**listeden düşüyordu.** Ama işi Operasyon'a aktarmak müşterinin talebini çözmez — talep, ancak
düzeltilmiş içerik müşteriye tekrar gönderildiğinde kapanır. Bu yüzden bir kere aktardığın
revize, düzeltmeyi göndermeyi unutsan bile gözünden kayboluyordu.

**Düzeltme:** Revize istekleri artık **düzeltilmiş içerik gönderilene kadar** kutuda kalıyor.
Düzeltmeyi gönderdiğinde durum kendiliğinden "Bekliyor"a döner ve kayıt kutudan düşer — yani
liste gerçekten "senden aksiyon bekleyenler" listesi oluyor.

Aktarılmış olanlar kaybolmuyor, sadece **"✓ Operasyon'a aktarıldı"** işareti alıyor ve butonu
"Tekrar Aktar" oluyor (yanlışlıkla ikinci bir iş açmayasın diye).

### Menüde sayaç
Sol menüde **Planım**'ın yanında turuncu bir sayaç var artık — bekleyen iş varsa sekmeye girmeden
görüyorsun. Sayaç, kutunun kendisiyle **birebir aynı kuralı** kullanıyor; ikisi farklı sayı
gösteremez.

Sayaca dahil olanlar: müşteri revize istekleri + onaylanmış ama henüz aktarılmamış çekim
planları + kimseye atanmamış işler.

## Güncelleme 38: Dikey Videolar Artık Yanları Siyah Çıkmıyor

**Sorun:** Drive'a yüklenen dikey (Reels/Story) videolar oynatıcıda ortada küçük kalıyor, sağ ve
sol tarafları siyah bantla doluyordu.

**Sebep:** Drive'ın gömülü oynatıcısı, kendisine verilen çerçevenin şeklini alır. Çerçeve sabit
16:9 (yatay) olduğu için 9:16 bir video ortaya sıkışıyordu. Sorun videoda değil, çerçevedeydi.

**Çözüm:** Oynatıcı çerçevesi artık videonun yönüne göre şekilleniyor:

| Yön | Çerçeve | Genişlik |
|---|---|---|
| **Dikey** (Reels/Story) | 9:16 | 340px |
| **Kare** | 1:1 | 440px |
| **Yatay** | 16:9 | 640px |

**Varsayılan dikey** — sosyal medya içeriklerinin neredeyse tamamı 9:16 olduğu için. Yönü
belirtilmemiş eski kayıtlar da dikey kabul edilir.

### Nereden değiştirirsin
- **İçerik/çekim planı eklerken:** forma "Video yönü" seçimi eklendi, seçtiğin anda önizleme
  aynı çerçevede görünür — müşteriye göndermeden nasıl duracağını görürsün
- **Operasyon'da:** iş detayında oynatıcının altında Dikey / Kare / Yatay düğmeleri var, mevcut
  işlerin yönünü tek tıkla değiştirebilirsin

Değişiklik hem senin ekranında hem müşteri panelinde geçerli — ikisi de aynı çerçeve mantığını
kullanıyor.

## Güncelleme 39: ACİL DÜZELTME — Siyah Ekran

**Sorun:** 58. sürümden sonra uygulama açılmıyordu, ekran siyah kalıyordu.

**Sebep — benim hatam.** Video yönü özelliğini eklerken yeni bileşen, `driveEmbedUrl`
fonksiyonunun içindeki metin şablonunun **ortasına** yazılmış. Şöyle bozulmuştu:

```
return `https://drive.google.com/file/d/${id}/
   ...bileşen kodu araya girmiş...
preview`;
```

JavaScript dosyası bu hâlde derlenemez; derlenemeyince de sayfa tamamen boş kalır. Düzenleme
ikonuyla ilgisi yoktu — uygulama zaten hiç çalışmıyordu, sadece o tıklamada fark edildi.

**Düzeltme:** Fonksiyon ve bileşen doğru sırayla ayrıldı, araya kaçan kalıntı temizlendi.
Video yönü özelliği (58. güncelleme) olduğu gibi çalışıyor.

**Bir daha olmaması için:** Bu tür bozulma parantez sayımıyla dengeli görünür, o yüzden
mevcut kontrollerden kaçmıştı. Artık her pakete çıkmadan önce şablon literallerinin içinde
kod parçası (fonksiyon tanımı, yorum bloğu, import satırı) olup olmadığı ayrıca taranıyor —
tam olarak bu hatayı yakalayan bir kontrol.

## Güncelleme 40: Müşteri Paneli Artık Kendiliğinden Çıkış Yapmıyor

**Sorun:** Müşteri paneli bir süre sonra kendiliğinden giriş ekranına dönüyordu.

**Sebep:** Panelde koşulsuz **1 dakikalık** bir hareketsizlik çıkışı vardı. Müşteri uzun bir
konuşma metnini okurken bile (fareye dokunmadan 60 saniye geçmesi yeterli) dışarı atılıyordu.

Daha kötüsü: bu otomatik çıkış, kayıtlı giriş bilgilerini de siliyordu. Yani geçen güncellemede
eklenen **"Beni hatırla" tamamen işlevsizdi** — 60 saniye sonra zaten siliniyordu.

**Düzeltme — "Beni hatırla" seçimine göre davranıyor:**

| Durum | Davranış |
|---|---|
| **"Beni hatırla" seçili** (varsayılan) | Otomatik çıkış **yok**. Müşteri istediğinde çıkış butonuyla çıkar. |
| **Seçili değil** (ortak/paylaşılan bilgisayar) | 20 dakika hareketsizlikte çıkış |

Böylece hem müşteri rahatsız edilmiyor hem de ortak bir bilgisayarda panelin açık unutulmasına
karşı koruma duruyor — ama bu korumayı isteyip istemediğine müşteri karar veriyor.

### Not
Bu paket ayrıca 39. güncellemede eklenen şablon-bozulması kontrolünden geçirildi.

## Güncelleme 41: İş Ortağı Sistemi — Markaya Kilitli Hesap + Hesap Gelişimi Takibi

Şişçi İbo ve İbo Burger paylaşımlarını yapan iş ortağı için kuruldu. Dört parçadan oluşuyor.

### 1. Marka kilidi (temel taş)
Ayarlar → Personel Hesapları → bir hesabın "Yetkiler" panelinde artık **MARKA KİLİDİ** var.
Marka seçersen o hesap **sadece o markaların** verisini görür.

**Bu bir arayüz gizlemesi değil** — seçilmeyen markaların verisi sunucudan hiç gönderilmez.
Tarayıcı araçlarıyla bile ulaşılamaz. İş ortağın diğer 19 müşterinin varlığından haberdar olmaz.

Kilitli hesaplardan ayrıca **reklam bütçesi** ve müşteri finansalları (maliyetler, ödeme
kayıtları, aylık ücret) temizlenir — senin tercihin doğrultusunda.

**Veri kaybına karşı kritik koruma:** Kilitli hesap listenin sadece kendi markalarına ait
kısmını gördüğü için, kaydederken listeyi olduğu gibi geri yazsa diğer markaların kayıtlarını
silerdi. Bu yüzden sunucu tarafında birleştirme yapılıyor: başkasının kayıtları sunucudaki
hâliyle korunur, sadece o hesabın markalarına ait olanlar güncellenir. İzinli marka listesi her
zaman sunucudaki hesap kaydından okunur — tarayıcının gönderdiğine asla güvenilmez.

### 2. İş ortağının izinleri
Kilitli hesaba şu izinleri ver: **Paylaşımlar** (takvim, görsel, alt metin), **Reklamlar**
(kampanya + istatistik), **Operasyon** (isterse üretim takibi). Girdiği alt metin senin
gördüğün ve müşterinin panelinde çıkan alt metinle **aynı kayıt** — ayrı bir sistem yok.

### 3. Hesap Gelişimi — takipçi & görünürlük (yeni)
**Reklamlar** sekmesinin üstüne yeni bir bölüm eklendi. Marka seç, ay seç, gir:
**Takipçi · Erişim · Profil Ziyareti · Web Sitesi Tıklaması**

Ayda bir Instagram istatistiklerinden okunup girilir. **Artış rakamları saklanmaz, hesaplanır**
(bu ay − önceki kayıt): kaç kişi arttı, yüzde kaç. Bir ayın rakamını düzeltirsen artışlar da
kendiliğinden düzelir.

Arada boş ay varsa da çalışır — bir önceki *ay* değil, **bu aydan önceki en yakın kayıt**ла
karşılaştırır.

### 4. Aylık rapora "Hesap Gelişimi" bölümü
Rapora yeni bir tablo geldi: her ölçüm, bu ayki değeri ve önceki döneme göre değişimi
(yeşil ▲ / kırmızı ▼, yüzdesiyle). Müşteriye "bu ay 340 takipçi kazandık, erişim %62 arttı"
diyebilirsin. Ölçüm girilmemişse bölüm rapora hiç basılmaz — boş tablo göndermezsin.

### 5. Kampanya kapanış takibi
Biten ama **sonuç istatistiği girilmemiş** kampanyalar artık Planım → Onayını Bekleyenler
kutusunda ve menü sayacında görünüyor. "İstatistikleri Gir" butonu doğrudan Reklamlar'a götürür.
Böylece istatistiği girilmemiş bir kampanya gözden kaçıp raporu eksik bırakmaz.

## Güncelleme 42: Personel/Müşteri Girişi "Giriş Yap"a Basınca Tepki Vermiyordu

Sunucu tarafı test edildi ve sorunsuz çıktı (personel ve müşteri girişleri, marka kilidi,
bütçe gizleme — hepsi doğru çalışıyor). Sorun **hatanın hiç gösterilmemesiydi.**

### Asıl sebep: sessizce yutulan hata
Giriş ekranı, ekran sırasında `needsAuth` kontrolünden geçiyor ve bu kontrol `loadError`
kontrolünden **önce** geliyor. Yani 401 dışındaki her hata (429 hız sınırı, 500 sunucu hatası,
ağ kopukluğu) hiçbir yere yansımıyordu: butona basıyorsun, istek gidiyor, hata dönüyor ve
ekranda **hiçbir şey olmuyor.**

Artık bütün hatalar giriş ekranında net bir mesajla görünüyor.

### Muhtemel tetikleyici: IP başına hız sınırı
Sistem 15 dakika içinde 20 başarısız giriş denemesinden sonra o IP'yi kilitliyordu. İki sorun:

1. **Başarılı girişte sayaç sıfırlanmıyordu** — gün içinde biriken hatalı denemeler (genelde
   kendi testlerin) sonradan yapılan doğru girişleri de engelliyordu
2. Sayaç IP başına olduğu için, **senin hatalı denemelerin personel ve müşteri girişlerini de
   kilitliyordu** — doğru şifreyi bilen kişi bile giremiyordu

**Düzeltmeler:**
- Başarılı her girişte sayaç sıfırlanıyor
- Giriş ekranında hız sınırı mesajı çıkınca **"Yönetici şifresiyle kilidi aç"** bağlantısı
  beliriyor — 15 dakika beklemene gerek yok
- Kilit açma isteği hız sınırının önünde çalışıyor (yoksa kısır döngü olurdu: kilitliyken
  kilidi açamazdın), ama sınırsız şifre deneme kapısına dönüşmesin diye kendi dar sayacı var:
  saatte 5 hatalı deneme

### Ayrıca: gerçek bir JSX sözdizimi denetleyicisi
39. güncellemedeki siyah ekran olayından sonra eklenen şablon kontrolü yetersizdi. Artık dize,
şablon, yorum, **regex literali** ve JSX etiketlerini (`</div>`, `/>`) doğru ayırt eden tam bir
denetleyici var — Türkçe metindeki kesme işaretlerini (`Drive'ın`, `</strong>'e`) yanlış
yorumlamıyor. Her paket öncesi tüm kaynak dosyalarda çalıştırılıyor.

## Güncelleme 43: CEO Panelinde Çıkış Butonu

Çıkış butonu personel ve müşteri panellerinde vardı ama **CEO panelinde yoktu** — yönetici
oturumunu kapatmak için tarayıcı verilerini temizlemek gerekiyordu.

Sol menünün en altına, "AI CEO'ya Sor" butonunun hemen altına eklendi. Mobilde de hamburger
menüsünün içinde görünür.

**Diğer panellerdekiyle aynı işi yapar:** sunucudaki oturumu da kapatır (sadece tarayıcıdan
silmek yetmez), personel/müşteri kimliklerini de temizler ve sayfayı yeniler.

### Veri kaybına karşı
Kayıt işlemi 500 milisaniye gecikmeli çalışıyor. Tam o aralıkta çıkış yapılsaydı, gönderilmemiş
değişiklik sayfa yenilendiği için kaybolurdu. Bu yüzden buton önce kontrol ediyor:
- **Bekleyen bir kayıt varsa:** "Kaydedilmemiş bir değişiklik var, yine de çıkılsın mı?" diye
  uyarır ve birkaç saniye beklemeyi önerir
- **Yoksa:** normal çıkış onayı sorar

## Güncelleme 44: Türkçe Karakterli Kullanıcı Adı/Şifre Girişi Engelliyordu

**Sorun:** Personel ve müşteri girişinde "Giriş Yap"a basınca *"Sunucuya ulaşılamadı"* çıkıyordu.

**Sebep:** Kullanıcı adı ve şifre HTTP **başlığında** gönderiliyordu. HTTP başlık değerleri
yalnızca ASCII karakter taşıyabilir — `saygı` içindeki **ı** harfi başlığa konulamıyor ve
tarayıcı isteği **göndermeden** hata veriyor. Yani sunucuya hiç ulaşılmıyordu; hata mesajı
teknik olarak doğruydu ama asıl nedeni gizliyordu.

Yönetici girişinin etkilenmemesinin sebebi de bu: onun şifresi başlıkta değil, istek gövdesinde
gidiyor.

Etkilenen her şey: Türkçe karakter içeren kullanıcı adları (**saygı, çağrı, gülşen, ışıl**) ve
Türkçe karakter içeren şifreler — personel, müşteri ve hatta yönetici şifresi.

**Düzeltme:** Kimlik bilgileri artık base64'e çevrilerek (`…-B64` başlıklarıyla) gönderiliyor;
sunucu bunları çözüyor. Base64 çıktısı saf ASCII olduğu için hangi karakter olursa olsun
sorunsuz taşınıyor.

**Geriye dönük uyumlu:** Sunucu önce base64 başlığa bakıyor, yoksa eski düz başlığa düşüyor.
Yani güncellenmemiş bir sekme ya da mevcut ASCII kullanıcı adları da çalışmaya devam ediyor.
Beş senaryo (Türkçe personel, Türkçe müşteri, eski ASCII personel, yönetici base64, yönetici
düz) gerçek istekle test edildi, hepsi geçti.

### Hata mesajı da dürüstleştirildi
Önceki mesaj her hata için "internet bağlantını kontrol et" diyordu — oysa aynı blok, yanıt
işlenirken oluşan kod hatalarında da çalışıyor. Bu, insanı saatlerce yanlış yönde arattırabilir.
Artık gerçek ağ hatası ile kod hatası ayrılıyor ve hatanın teknik açıklaması da gösteriliyor.

## Güncelleme 45: Marka Kilidi Sunucuyu Çökertiyordu (stoklar nesne, dizi değil)

Türkçe karakter düzeltmesi (44) işe yaradı — istek artık sunucuya ulaşıyor. Ardından çıkan
gerçek hata: **`data.stoklar.filter is not a function`**.

**Sebep:** 41. güncellemedeki marka kilidi süzgecini yazarken, süzülen alanların hepsinin dizi
olduğunu varsaymıştım. Oysa:
- **`stoklar` bir NESNE** — anahtarları `clientId_tür` (ve şubeler için `clientId_subeId_tür`)
- **`gunlukKontrol` null olabiliyor**

Dizi olmayan bir alanda `.filter()` çağrılınca sunucu çöküyor ve marka kilitli her personel
girişi hata veriyordu.

**Düzeltme:**
- Dizi alanları artık `Array.isArray` kontrolünden geçiyor; dizi olmayan alana hiç dokunulmuyor
- `stoklar` kendi yapısına göre süzülüyor: anahtarın başındaki müşteri kimliğine bakılıyor
- `gunlukKontrol` null/nesne olduğunda olduğu gibi bırakılıyor

### Ayrıca kapatılan bir VERİ KAYBI deliği
Kilitli hesap `stoklar` nesnesinin sadece kendi markasına ait anahtarlarını görüyor. Kaydederken
bu nesneyi olduğu gibi geri yazsaydı **diğer markaların stokları silinirdi.** Dizi alanları için
zaten birleştirme vardı ama nesneler için yoktu.

Artık `stoklar` da anahtar bazında birleştiriliyor: başkasının anahtarları sunucudaki hâliyle
korunuyor, sadece o hesabın markalarına ait olanlar güncelleniyor. Gerçek veriyle test edildi —
kilitli hesap kendi stoğunu değiştirdiğinde diğer markanın stoğu ve reklamı korunuyor.

## Güncelleme 46: KAPSAMLI GÜVENLİK VE VERİ DENETİMİ

Tüm sistem, tahminle değil **kod gerçekten çalıştırılarak** denetlendi (sahte bir veritabanıyla
her uç noktaya istek atıldı). Bulunan her sorun düzeltildi ve testler `testler/` klasörüne
kalıcı olarak eklendi.

### 🔴 KRİTİK 1 — Yedekten geri yükleme tamamen çökük
`api/backup.js` dosyasında `ownerYetkiliMi` fonksiyonu **kullanılıyor ama import edilmemişti.**
Yani yedek listeleme ve geri yükleme uç noktası her çağrıldığında çöküyordu — veri kaybı
yaşasan kurtarma yolun kapalıydı. Bu, sistemdeki en tehlikeli hataydı çünkü **tam da veri
kaybına karşı kurduğumuz güvenlik ağıydı.**

Düzeltildi. Ayrıca bu tür sessiz kırılmaları yakalamak için 12 uç noktanın hepsini çağıran bir
duman testi eklendi (`testler/t8.mjs`).

### 🔴 KRİTİK 2 — Marka kilitli hesap başka markanın verisini değiştirebiliyordu
Marka kilidi yalnızca `api/data.js` içinde uygulanıyordu. Diğer uç noktalarda hiç kontrol yoktu.
Gerçek testle doğrulanan açıklar:

| Açık | Sonuç |
|---|---|
| `paylasim` → başka markanın alt metnini değiştirme | ✗ değiştirebiliyordu |
| `paylasim` → başka markanın planını **silme** | ✗ **silebiliyordu (veri kaybı)** |
| `client-payment` → başka markanın ödeme kaydı | ✗ değiştirebiliyordu |
| Yanıtlarda tüm markaların verisi | ✗ sızıyordu |

**Düzeltme:** Yeni `lib/marka-kilidi.js` ortak katmanı. Kurallar tek yerde tanımlı — bir uç
noktada unutulan kontrol artık mümkün değil. `paylasim.js`'e merkezî bir "marka kapısı"
eklendi (her işlemin hedefi tek yerde çözülüp doğrulanıyor), `client-payment.js` kilitli
hesaplara tamamen kapatıldı (finansal veri), `notify-job` ve `devir-teslim`'e marka kontrolü
eklendi. Yanıtlar da süzülüyor.

### 🔴 KRİTİK 3 — Ajans geneli veriler kilitli hesaba sızıyordu
Marka kilidi sadece bazı alanları süzüyordu. Testte sızdığı görülenler: **teklifler,
bekleyen tahsilatlar, üyelikler, personel maaşları, gelir kalemleri, müşteri giriş bilgileri,
günlük kontrol kayıtları.**

**Düzeltme:** İki katmanlı. (1) Marka bilgisi taşıyan **tüm** koleksiyonlar artık süzülüyor —
dizi ve nesne biçimindeki alanlar ayrı ayrı ele alınıyor. (2) Markaya göre süzülemeyen ajans
geneli alanlar (finans, personel, birikim, işlem geçmişi…) kilitli hesaba **hiç
gönderilmiyor**; üstelik o bölümlerin izinleri, açık bırakılmış olsa bile otomatik kapatılıyor.

### 🟠 Yazma tarafında da aynı daraltma
Kilitli hesap, izni yanlışlıkla açık bırakılsa bile Finans/Personel gibi ajans geneli alanlara
**yazamıyor**. Okuma ve yazma aynı kuralı kullanıyor.

### Doğrulanan korumalar (hepsi test edildi)
- ✓ Diğer markanın işi/stoğu, kilitli hesap kayıt yaptığında korunuyor (dizi ve nesne alanlar)
- ✓ Çakışma tespiti (409) çalışıyor; araya giren değişiklik kaybolmuyor
- ✓ Güvenlik freni: %40+ müşteri kaybı engelleniyor, `force` ile bilinçli geçiş mümkün
- ✓ Her yazmada `_v` artıyor, günlük ve saatlik yedek alınıyor
- ✓ Geri yükleme öncesi güvenlik kopyası alınıyor
- ✓ Yedek uç noktasından rastgele veritabanı anahtarı okunamıyor
- ✓ Şifre hash'leri hiçbir role gönderilmiyor
- ✓ 12 uç noktanın hepsi ayakta

**Sonuç: 35 kontrolün tamamı geçti.**

## Güncelleme 47: Müşteri Bildirimi, Telefona Kurulum, Otomatik Rapor Hatırlatması, Operasyon Sadeleştirme

### 1. Müşteriye içerik bildirimi (en önemlisi)
Panele çekim planı ya da içerik eklendiğinde müşterinin **haberi olmuyordu** — girip bakması
gerekiyordu, girmezse onay beklemede kalıyor ve tüm akış tıkanıyordu.

Artık içerik eklenince müşteriye otomatik e-posta gidiyor: hangi marka, ne eklendi ve panele
gitmek için bir buton. Formun altında sonucu da görüyorsun ("✓ Müşteriye e-posta gönderildi"
ya da "Müşterinin kayıtlı e-postası yok").

E-posta müşterinin kartındaki **Yetkili E-postası** alanından alınır. Boşsa bildirim gönderilmez
ama içerik yine de eklenir — akış hiçbir durumda durmaz.

### 2. Telefona uygulama gibi kurulabiliyor (PWA)
Artık hem senin hem müşterilerin siteyi ana ekrana ekleyip **kendi ikonuyla, tarayıcı çubuğu
olmadan** açabilirsiniz.

- **iPhone:** Safari'de siteyi aç → Paylaş → "Ana Ekrana Ekle"
- **Android:** Chrome'da siteyi aç → menü → "Uygulamayı yükle"

**Önemli teknik karar:** Service worker bilerek **önbellekleme yapmıyor**. Yapsaydı, yeni sürüm
yüklediğinde telefonlarda eski sürüm açılmaya devam ederdi — düzelttiğimiz bir hata düzelmemiş
gibi görünürdü. Veri hassasiyeti olan bir uygulamada bu riski almadık.

### 3. Aylık rapor hatırlatması
Her ayın 1'inde e-posta geliyor: hangi markaların raporu hazır, her birinde kaç teslim, kaç
paylaşım, kaç kampanya var.

**Rapor müşteriye otomatik GÖNDERİLMEZ** — bilerek böyle. Gözden geçirilmemiş bir rapor
müşteriye gitseydi, eksik ya da yanlış bir rakam fark edilmeden dışarı çıkabilirdi. Sen açıp
kontrol edip gönderiyorsun.

### 4. Operasyon sadeleşti
**Aylık İş Raporu**, Operasyon'dan **Personel → Freelancer** sekmesine taşındı. Aynı bilgiyi
(kimin ne kadar hak ettiği) iki ayrı yerde göstermek "hangisine bakacağım?" sorusunu
doğuruyordu. Artık ödemeyle ilgili her şey Personel sekmesinde toplu; Operasyon yalnızca
üretim takibine odaklı (Tüm İşler · Markalaşma · İstatistikler).

Bir şey kaybolmadı — rapor aynı rapor, sadece daha mantıklı bir yerde.

### Doğrulama
35 denetim kontrolünün tamamı bu değişikliklerden sonra da geçiyor.

## Güncelleme 48: App.jsx Bölündü (10.068 → 7.763 satır)

Bu paket **sadece bu işi** içeriyor. Bilerek: dosya bölme ile yeni özellikleri aynı pakete
koymak, bir şey ters gittiğinde sebebi bulmayı imkânsızlaştırırdı.

### Neden gerekliydi
`App.jsx` 10.068 satıra ulaşmıştı ve bu kendi başına bir risk hâline gelmişti. Bir kez tam
olarak bu yüzden uygulama hiç açılmadı: yeni bir bileşen eklenirken kod, bir metin şablonunun
ortasına düştü ve dosya derlenemez oldu. Dosya ne kadar büyükse böyle bir hatanın olma ve
gözden kaçma ihtimali o kadar yüksek.

### Yeni yapı

| Dosya | Satır | İçerik |
|---|---|---|
| `src/tema.jsx` | 807 | Tema, stiller, ortak arayüz parçaları, genel yardımcılar |
| `src/drive.jsx` | 121 | Google Drive görsel/video gösterimi |
| `src/instagram.jsx` | 342 | Instagram önizleme/ızgara + aylık rapor HTML'i |
| `src/musteriPaneli.jsx` | 536 | Müşterinin gördüğü panel |
| `src/personel.jsx` | 694 | Kadrolu personel + freelancer, avans, ödeme |
| `src/App.jsx` | 7.763 | Geri kalan ekranlar ve ana uygulama |

Hiçbir davranış değişmedi — sadece kodun yeri değişti.

### Nasıl doğrulandı
Tarayıcı derleyicisi olmadan bölme yapmak riskli olduğu için üç denetleyici yazıldı ve her
adımda çalıştırıldı (`testler/` klasöründe, kullanım talimatıyla birlikte):

1. **Sözdizimi** — JSX-farkında kontrol, tüm dosyalar temiz
2. **Şablon bozulması** — kod parçasının metin içine kaçması, tüm dosyalar temiz
3. **Eksik import** — bölmenin asıl riski. Her dosyada kullanılan ama tanımlanmayan/import
   edilmeyen adlar arandı; bulunanların hepsi düzeltildi
4. **Eksik export** — import edilen her adın kaynağında gerçekten export edildiği doğrulandı (0 eksik)
5. **Döngüsel bağımlılık** — bağımlılık haritası çıkarıldı, döngü yok (tek yönlü akış)
6. **Sunucu denetimleri** — 35 kontrolün tamamı bölme sonrası da geçiyor

### Yol boyunca çıkan bir sorun
`GIZLILIK_MODU` bayrağı App.jsx içinde tanımlanıp doğrudan **yazılıyordu**. Dosya bölününce bu
geçersiz hâle geldi: ES modüllerinde import edilmiş bir değişkene atama yapılamaz. Okuma/yazma
fonksiyonlarına çevrildi (`gizlilikModuOku` / `gizlilikModuYaz`).

### Not
App.jsx hâlâ 7.763 satır. Daha fazla bölünebilir (Finans, Müşteriler, Ayarlar kendi
dosyalarına), ama bu paket oturmadan devam etmek doğru olmaz — her bölme adımı ayrı ayrı
doğrulanmalı.

## Güncelleme 49: CEO Panelinde Otomatik Dashboard'a Dönme Kaldırıldı

**Sorun:** Bir sekmede çalışırken 3 dakika hiçbir şeye dokunmayınca sayfa kendiliğinden
Dashboard'a dönüyordu. Uzun bir raporu okurken, bir listeyi incelerken ya da telefonda başka
bir işle uğraşırken sürekli yerini kaybediyordun.

**Kaldırıldı.** Koda bakınca özelliğin **kendi amacını zaten karşılamadığı** görüldü:

- Gerekçesi "açık unutulan yarım bir form yanlışlıkla kaydedilmesin" idi — ama zaten **dolu
  bir form varken yönlendirme yapılmıyordu.** Yani koruma, ortada korunacak bir şey YOKKEN
  devreye giriyordu.
- Gizlilik açısından da bir kazancı yoktu: Dashboard finansal rakamları gösteriyor.

Geriye sadece rahatsızlık kalıyordu, o yüzden tamamen kaldırıldı.

**Yerinde duran gerçek korumalar:**
- Kaydedilmemiş değişiklik varken sekme kapatma uyarısı
- Çıkış butonunda bekleyen kayıt kontrolü
- Gizlilik Modu (tüm ₺ tutarlarını gizler)

Personel panelinde böyle bir yönlendirme zaten yoktu; müşteri panelindeki otomatik çıkış ise
44. güncellemede "Beni hatırla" seçimine bağlanmıştı.

## Güncelleme 50: Rakamlar Varsayılan Olarak Gizli

**Gizlilik Modu artık varsayılan olarak AÇIK.** Uygulamayı açtığında tüm ₺ tutarları
"₺ •••" olarak gelir; görmek istediğinde sen açarsın.

Gerekçe: panel çoğu zaman başkalarının da görebileceği ortamlarda açılıyor — çekimde, kafede,
birinin yanında. Varsayılan görünür olsaydı her seferinde gizlemeyi hatırlaman gerekirdi;
varsayılan gizli olunca **göstermek bilinçli bir hareket** oluyor.

### Üst çubuğa göz simgesi eklendi
Rakamları göstermek/gizlemek için artık Ayarlar'a gitmene gerek yok — üst çubukta, bildirim
zilinin yanında bir **göz simgesi** var. Her ekrandan tek tıkla açıp kapatırsın. Gizliyken
simge turuncu yanar, böylece hangi durumda olduğun bir bakışta belli olur.

Seçimin bu cihazda hatırlanır: bir kez açık bırakırsan sonraki açılışlarda açık gelir.

### Kapsam genişletildi
Operasyon'daki freelancer ücret gösterimleri (iş başı ücret, aylık hak ediş) Gizlilik Modu'nu
**atlıyordu** — kendi para biçimlendirmelerini kullanıyorlardı. Onlar da ortak `fmt()`
fonksiyonuna bağlandı. Artık gizlilik açıkken hiçbir ekranda rakam görünmüyor:

Dashboard KPI'ları · Finans · Müşteri ücretleri · Personel maaşları · Avans ve ödemeler ·
Hesap bakiyeleri · Birikimler · Teklifler · **Operasyon ücretleri (yeni)**

## Güncelleme 51: Güvenlik ve Veri Dayanıklılığı — Altı Geliştirme

Denetim sonucu bulunan altı boşluk kapatıldı. Önce iyi haber: **XSS riski yok** (hiçbir yerde
ham HTML basılmıyor) ve gece yedeği **tam veriyi** ek dosya olarak gönderiyor.

### 1. 🗑 Silinenler Kutusu — en çok işine yarayacak olan
Bir müşteriyi, işi, panel içeriğini, personeli, freelancer'ı ya da reklamı silince artık
**kalıcı olarak gitmiyor**: 30 gün Ayarlar → Silinenler Kutusu'nda duruyor, tek tıkla geri
geliyor.

Eskiden geri almanın tek yolu tüm veriyi bir yedekten geri yüklemekti — o da o andan sonraki
**her şeyi** geri alırdı. Yani küçük bir yanlış tıklamanın bedeli çok büyüktü. Artık sıfır.

Süre dolunca kendiliğinden temizlenir; istersen "Kalıcı Sil" ile hemen de çıkarabilirsin.

### 2. 📦 Yedek artık tek yere bağlı değil
**Bu bir felaket senaryosuydu:** günlük, saatlik ve geri-yükleme-öncesi kopyaların hepsi aynı
veritabanının (Upstash) içinde. O hesap silinir ya da askıya alınırsa hepsi birden giderdi.

- `BACKUP_EMAIL` artık **virgülle birden fazla adres** kabul ediyor:
  `ben@ornek.com, yedek@gmail.com` — farklı sağlayıcılarda adres kullanmak en güçlü koruma
- Her **pazar** ayrı konuyla bir **haftalık arşiv** kopyası gönderiliyor ("SAKLA" etiketli),
  çünkü günlük yedekler posta kutusunda birikip kayboluyor

### 3. 🔐 Güvenlik durumu artık görünür
Ayarlar → Güvenlik'te iki uyarı kartı var. Bir korumanın **"kurulduğunu sanmak" ile gerçekten
açık olması** arasındaki farkı gösteriyor (ortam değişkenleri tarayıcıya gönderilmediği için bu
bilgi sunucudan geliyor):

- İki adımlı doğrulama açık mı? Kapalıysa nasıl açılacağı yazılı
- Yedek kaç adrese gidiyor? Tek adresse neden yetersiz olduğu açıklanıyor

### 4. 📋 Güvenlik Defteri
Girişler, **başarısız giriş denemeleri**, yedekten geri yüklemeler ve hesap/yetki değişiklikleri
ayrı bir deftere yazılıyor. Ayarlar → Güvenlik Defteri'nden okunur.

Kritik farkı: **veriyle birlikte geri yüklenmez.** Bir yedeğe dönsen bile "kim ne zaman ne yaptı"
kaydı yerinde kalır. Test edildi: geri yükleme sonrası defter siliniyor mu → hayır, duruyor.

### 5. 📊 Veri boyutu otomatik uyarısı
Veri ~4.5 MB sınırına yaklaşınca (%60'ta uyarı, %85'te "ACİL") e-posta geliyor. Bu sınır
aşılırsa **kayıtlar sessizce durur** — hata mesajı bile çıkmaz. Ayarlar'daki gösterge duruyordu
ama oraya bakmak gerekiyordu; artık uyarı ayağına geliyor.

### 6. Silinenler kutusu personele sızmıyor
`silinenler` alanı marka kilitli hesaplardan ve personel izin listesinden dışlandı — silinmiş
kayıtlar üzerinden veri sızıntısı olmaz.

### Doğrulama
45 otomatik kontrolün tamamı geçiyor (`testler/` klasörü, t5–t10). Yeni eklenen t9 ve t10
özellikle şunları doğruluyor: güvenlik durumu doğru raporlanıyor, silinenler personele
gitmiyor, başarısız girişler deftere yazılıyor, defter geri yüklemeden etkilenmiyor.

## Güncelleme 52: İki Adımlı Doğrulama Sessizce Atlanıyordu

**Sorun:** OWNER_EMAIL tanımlanmasına rağmen giriş yaparken kod sorulmadı, doğrudan içeri alındı.

**Sebep — tasarımın görünmeyen yüzü:** Sistem, kod e-postası gönderilemediğinde kod adımını
atlayıp şifreyle girişe izin verecek şekilde kurulmuştu. Bu bilinçli bir tercihti (e-posta
servisi çalışmazsa kendi uygulamandan kilitlenmeyesin diye). **Ama bunu sessizce yapıyordu.**

Sonuç: koruma çalışmıyorken çalışıyor sanılıyordu — güvenlik açısından en kötü durum.

**Düzeltmeler:**
- Kod adımı atlandığında ekranın üstünde **turuncu bir uyarı şeridi** çıkıyor
- Uyarıda **gerçek sebep** yazıyor (alan adı doğrulanmamış, adres hatalı, kota dolmuş vb.) —
  önceden genel bir "gönderilemedi" mesajı sorunu gizliyordu; artık Resend'in kendi hata
  metni taşınıyor

Bu iki değişiklik sorunu çözmüyor, **görünür kılıyor** — asıl sebebi ancak uyarıdaki metinle
teşhis edebiliriz.

## Güncelleme 74: "Verilerine Ulaşılamadı" — Hız Sınırı Kilitlenmesi

Vercel logları sorunu kesin olarak gösterdi: `/api/data` isteklerinin neredeyse tamamı
**HTTP 429** dönüyordu. Yani sunucu çökmüş değildi — uygulama seni brute-force saldırganı
sanıp kilitlemişti.

### Tasarım hatası
Hız sınırı kontrolü **her isteğin başında, kimlik doğrulamasından ÖNCE** çalışıyordu.

Sonuç: sayaç bir kez dolduğunda (test sırasında yapılan hatalı giriş denemeleri yetti),
**geçerli oturumu olan kullanıcı da dahil** herkes 15 dakika boyunca dışarıda kalıyordu.
Uygulama tamamen kullanılamaz hâle geliyordu.

Daha kötüsü: kilidi açma bağlantısı yalnızca giriş ekranında görünüyordu. Zaten giriş yapmış
biri o ekranı hiç görmediği için kilidi açmanın da yolu yoktu.

### Düzeltme
Hız sınırı artık **kimliği doğrulanamayan** isteklere uygulanıyor:

- **Giriş denemeleri** (authAction) → sınır uygulanır, brute-force korumasi aynen duruyor
- **Normal istekler** → önce kimlik doğrulanır; geçerliyse sınır hiç devreye girmez
- Kimlik doğrulanamazsa sınır uygulanır

Yani doğru davranış: sınır saldırganı durdurur, kullanıcıyı değil. Geçerli oturumu olan biri
artık hiçbir koşulda kilitlenemez.

### Doğrulama (testler/t11.mjs)
Sayaç bilerek doldurulup dört senaryo test edildi:
- ✓ Brute-force hâlâ engelleniyor (429)
- ✓ Geçerli kimlikle veri çekilebiliyor (200) — **asıl hata buydu**
- ✓ Başarılı giriş mümkün, sayaç sıfırlanıyor
- ✓ Kimliksiz istek hâlâ engelleniyor

Test paketi 49 kontrole çıktı, hepsi geçiyor.

## Güncelleme 75: Hangi Ortam Değişkeninin Eksik Olduğu Yazıyor

Güvenlik kartı "İki adımlı doğrulama KAPALI" diyordu ama **hangi değişkenin** eksik olduğunu
söylemiyordu. İki adımlı doğrulama iki şey ister:

- `OWNER_EMAIL` — kodun gönderileceği adres
- `RESEND_API_KEY` — e-posta servisinin anahtarı

Biri bile eksikse özellik kapalı kalır. Tek bir "kapalı" bilgisi hangisini arayacağımızı
söylemediği için teşhis ettirmiyordu.

Artık kart doğrudan **eksik olanın adını** yazıyor: sadece OWNER_EMAIL mi, sadece
RESEND_API_KEY mi, yoksa ikisi de mi.

## Güncelleme 76: Düzenle Butonunda Siyah Ekran

**Sorun:** Müşteri düzenleme (kalem) ikonuna tıklayınca sayfa tamamen siyah oluyordu.

**Sebep:** 48. güncellemede `App.jsx` bölünürken `FieldForm` ve `KpiCard` bileşenleri
`tema.jsx`'e taşındı — ama kullandıkları **lucide-react ikon import'u taşınmadı.**
`tema.jsx` dosyasında `ArrowUpRight`, `ArrowDownRight` ve `Check` ikonları kullanılıyor ama
hiç import edilmiyordu.

`FieldForm` her düzenleme formunun altyapısı; kaydet butonundaki `<Check>` ikonu tanımsız
olduğu için form açıldığı anda uygulama çöküyordu.

**Düzeltme:** İkon import'u `tema.jsx`'e eklendi.

### Bu hata neden beş kontrolden de geçti
Sözdizimi geçerliydi, parantezler dengeliydi, şablon bozulması yoktu, çift tanım yoktu ve
`importdenetle.py` de göremedi — çünkü o kontrol yalnızca **bizim dosyalarımızda tanımlı**
adları arıyor. Eksik olan ad ise dış bir kütüphaneye ait.

**Altıncı denetleyici eklendi:** `testler/ikondenetle.py` — JSX'te kullanılan her bileşenin
o dosyada tanımlı ya da import edilmiş olduğunu doğrular. Hem yapay bozuk dosyalarla hem de
bu hatanın gerçek hâliyle test edildi, ikisini de yakalıyor.

## Güncelleme 77: Tüm Sistem Taraması — Çökme Hatalarına Karşı

"Siyah ekran" türü hataların hepsini bulmak için sistem baştan sona tarandı. **Veriye hiç
dokunulmadı** — tüm kontroller yalnızca kaynak dosyaları okur; sunucu testleri sahte bir
veritabanı kullanır.

### Bulunan durum
Bu taramada **yeni bir çökme hatası bulunamadı.** 76. güncellemedeki ikon düzeltmesinden sonra
kod temiz. Ama tarama sırasında, aynı hatanın başka biçimlerini yakalayacak **üç yeni denetleyici**
yazıldı — çünkü mevcut altı kontrol o hatayı kaçırmıştı ve benzerlerini de kaçırırdı.

### Yeni denetleyiciler
| Denetleyici | Yakaladığı hata |
|---|---|
| **hookdenetle.py** | Bileşen taşınmış ama `useMemo`/`useRef` import edilmemiş |
| **cagridenetle.py** | Çağrılan bir fonksiyon o dosyada tanımlı/import edilmiş değil |
| **butondenetle.py** | `onClick` tanımsız bir şeye bağlı — ancak o butona basınca çöker |

Üçü de yapay bozuk dosyalarla **ve** gerçek hataların simüle edilmiş hâliyle test edildi.

### Yapılan kontroller
- ✓ 8 kod denetimi — hepsi temiz
- ✓ **18 menü sekmesi** ve **15 personel sekmesi** — hepsinin ekranı bağlı, eksik yok
- ✓ Tüm buton/olay bağlantıları tanımlı
- ✓ 49 sunucu denetimi (t5–t11) — hepsi geçiyor
- ✓ 12 uç noktanın hepsi ayakta

### Tek komut
`./testler/hepsinidenetle.sh` — sekiz denetimi sırayla çalıştırır.

## Güncelleme 78: Veri Kaybı Riski Denetimi

"Veri kaybına yol açabilecek bir mantık hatası var mı?" sorusu için sistem baştan sona tarandı.
**Gerçek veriye hiç dokunulmadı** — tüm testler sahte bir veritabanıyla çalıştı.

### Test edilen ve SAĞLAM çıkanlar
| Senaryo | Sonuç |
|---|---|
| Aynı anda 3 farklı işlem yazarsa | ✓ Üçü de korunuyor (kilit çalışıyor) |
| İki farklı uç nokta aynı anda yazarsa | ✓ İkisi de korunuyor |
| Açık kalmış bayat sekme yazmaya çalışırsa | ✓ Reddediliyor (409), araya giren değişiklik korunuyor |
| `null` veri gönderilirse | ✓ Reddediliyor, müşteriler silinmiyor |
| Boş nesne gönderilirse | ✓ Reddediliyor |
| Yanlış yedek geri yüklenirse | ✓ Öncesinde kopya alınıyor, **geri alınabiliyor** |
| Bileşen içinde bayat veri okuma | ✓ 81 durum güncellemesinin hiçbirinde yok |

### Bulunan gerçek eksik: kalıcı silmeler
Silinenler Kutusu 71. güncellemede eklenmişti ama **yalnızca 6 kayıt türünü** kapsıyordu.
Geri kalanlar hâlâ kalıcı olarak siliniyordu.

Kutuya eklenen 9 tür daha:
**Gelir kalemi · Gider kalemi · Ofis gideri · Bekleyen tahsilat · Üyelik · Şifre kaydı ·
Birikim fonu · Vergi kaydı · Markalaşma süreci**

Artık 15 kayıt türü 30 gün geri alınabilir durumda. Kalanlar (avans, ödeme kaydı, transfer,
hesap düzeltmesi) zaten kendi ekranlarında tek tıkla geri alınabiliyor.

### Bir not: test aracının kendi hatası
İlk çalıştırmada "eşzamanlı yazmada veri kayboluyor" alarmı çıktı. İncelenince sebep koddaki
bir hata değil, **test aracının** kilit mekanizmasını (`nx` seçeneği) taklit etmemesiydi.
Taklit düzeltilince sekiz senaryo da geçti. Test aracı düzeltilmeseydi var olmayan bir hatayı
kovalayacaktık.

Test paketi 64 kontrole çıktı (t5–t13), hepsi geçiyor.

## Güncelleme 79: İçerik Sıralama

Müşteri Paneli'ndeki içerikleri artık **elle sıralayabilirsin**. Her satırın sağında
**▲ ▼** okları var; bir kaydı yukarı ya da aşağı taşıyorsun.

### Neden ok, neden sürükle-bırak değil
Sürükle-bırak dokunmatik ekranda ve uzun listelerde güvenilir çalışmıyor; yanlışlıkla bırakıp
sırayı bozmak kolay. Oklar her cihazda aynı şekilde çalışır ve yaptığın şey belirsiz kalmaz.

### Müşteri de aynı sırayı görüyor
Sıra numarası **kayıtta saklanıyor**, ekranda hesaplanmıyor. Yönetici ekranı ve müşteri paneli
aynı veriyi okuduğu için ikisi asla farklı sıralayamaz — "bende böyle görünüyor ama müşteride
başka" durumu oluşamaz.

### Eski kayıtlar bozulmadı
Sıra numarası olmayan kayıtlar eskisi gibi davranır (bekleyenler önce). Bir listeyi ilk kez
sıraladığında o listedeki **tüm** kayıtlara numara yazılır — yarısı numaralı yarısı numarasız
karışık bir sıra oluşmaz.

### Yeni içerik en üste gelir
Yeni eklenen içerik listenin başına yerleşir. Aksi halde elle sıraladığın bir listede yeni
kayıt en alta düşer ve müşteri onu en son görürdü.

Sıralama mantığı dokuz senaryoyla test edildi: sıra yokken eski davranış, karışık liste,
yönetici–müşteri tutarlılığı, taşıma, liste sınırları ve yeni kayıt yerleşimi.

## Güncelleme 80: Müşteri Paneli Yeniden Tasarlandı

Müşteri paneli CEO paneliyle aynı koyu operasyon temasını kullanıyordu. Ama bu panel bir iç
araç değil, **müşteriye teslim edilen bir yüzey** — koyu tema ona "sizin için hazırlanmış bir
sunum" değil, "bizim yazılımımıza bakıyorsunuz" hissi veriyordu.

### Yön: baskı provası
Fotoğrafçının müşteriye gönderdiği prova mantığı kuruldu. Açık, kağıt hissi veren soğuk gri
zemin; beyaz kartlar; numaralandırılmış içerikler; onay ve revize durumları **damga** olarak.

Numaralandırma süs değil: 79. güncellemede eklenen sıralama sayesinde sıra artık gerçek bilgi
taşıyor — hangi içeriğin önce yayınlanacağı.

### Ortak logo bandı
Üstte beyaz bir bant: **Marcus Medya × Marka** logoları, aralarında gerçek bir çarpı işareti,
altında ince mor bir çizgi (ajansın kurumsal rengi). Logo yoksa markanın baş harfiyle bir
monogram karesi çıkıyor — boş alan bırakmaktansa.

Marka logosu için müşteri kartına **"Marka Logosu"** alanı eklendi (Drive bağlantısı, diğer
görsellerle aynı yöntem). Ajans logosu Ayarlar'daki marka kimliği görselinden geliyor.

### Tipografi ve renk
- Başlıklar **Space Grotesk** (zaten yüklüydü), gövde **Inter**
- Küçük etiketler **IBM Plex Mono**, büyük harf ve harf aralıklı — "üretim föyü" hissi
- Zemin `#EEF0EF` soğuk kağıt grisi, mürekkep `#16181B`, kurumsal mor `#5B5BD6` sabit çerçeve
- Durum renkleri damgalarda: bekleyen kehribar, onay yeşil, revize kırmızı

Cesaret tek bir yerde harcandı — **damgalar**. Onaylananlar ve revize istenenler hafifçe eğik,
çerçeveli birer mühür gibi görünüyor. Panelin tamamı prova mantığında kurulduğu ve müşterinin
yaptığı şey tam olarak "damga vurmak" olduğu için bu süs değil, işin kendisi.

### Metin dili de elden geçti
Butonlar ne yapacaklarını söylüyor: "Onayla", "Değişiklik iste". Boş ekran bir yönlendirme:
"Şu an bekleyen bir şey yok — yeni bir içerik hazırlandığında burada görünecek ve e-posta
alacaksınız."

## Güncelleme 81: Build Hatası — Eksik Export

80. sürümün build'i başarısız oldu. Vercel kaydı sebebi net söyledi:

```
"MusteriPaneli" is not exported by "src/musteriPaneli.jsx"
```

**Sebep:** Müşteri paneli tasarım katmanı eklenirken kod, `export function MusteriPaneli`
ifadesinin **ortasına** girdi. `export` kelimesi yukarıda yalnız kaldı, fonksiyon export
edilmemiş oldu.

Bu, kodun kendi içinde geçerli olduğu için sekiz denetleyicinin hiçbiri göremedi — sözdizimi
doğru, parantezler dengeli, tüm adlar tanımlı. Hata yalnızca **dosyalar arası** bakıldığında
görünüyor.

**Düzeltme:** Export geri kondu, öksüz satır temizlendi.

**Dokuzuncu denetleyici eklendi:** `testler/exportdenetle.py` — import edilen her adın
kaynağında export edildiğini doğrular ve yalnız kalmış `export` satırlarını yakalar. Build'i
kıran hatanın birebir kopyasıyla test edildi, yakalıyor.

Bu, aynı kök sebebin dördüncü tekrarı: metin araması yaparak kod eklemek, eklemeyi yanlış yere
düşürüyor. Denetleyiciler bu sınıfın her biçimini artık ayrı ayrı yakalıyor.

## Güncelleme 82: Koyu / Açık Tema Seçeneği

Üst çubukta, göz simgesinin yanında bir **güneş/ay düğmesi** var. Tek tıkla koyu ve açık tema
arasında geçiş yapıyorsun. Seçimin bu cihazda hatırlanıyor.

Varsayılan **koyu** — uygulamanın alışılmış görünümü. Daha önce bir seçim yapmadıysan hiçbir
şey değişmez.

### Açık tema neye göre kuruldu
Koyunun basit bir tersi değil:
- Zemin saf beyaz değil, hafif soğuk gri (`#F4F5F7`) — aynı ekranda saatlerce rakam okunuyor,
  saf beyaz göz yorar
- Vurgu renkleri beyaz üstünde okunacak biçimde koyulaştırıldı
- Yumuşak zeminler (uyarı, başarı, hata kutucukları) saydam katman yerine düz açık ton —
  saydamlık beyaz üstünde soluk ve okunaksız kalıyordu

### Operasyon da uyuyor
Operasyon sekmesinin kendi ayrı renk paleti vardı ve sabit koyu değerler içeriyordu; tema
değişse bile o sekme koyu kalırdı. Artık ortak temadan türetiliyor.

### İlk açılışta yanıp sönme yok
Tema tercihi, React yüklenmeden önce sayfaya uygulanıyor. Aksi halde açık tema seçiliyken
sayfa önce koyu boyanıp sonra beyaza dönüyordu ve bu her açılışta göze çarpıyordu.

### Müşteri paneli
Bilerek açık kaldı — 80. güncellemede müşteriye teslim edilen bir yüzey olarak tasarlandı ve
kendi renk sistemi var. İstersen ona da koyu seçeneği ekleyebiliriz.

## Güncelleme 83: Geçmişte Görseller de Görünüyor

Müşteri panelindeki **Geçmiş** bölümünde yalnızca başlık, tarih ve revize notu vardı. Görsel
görünmediği için "hangi görsele ne demiştim?" sorusunun cevabı kayboluyordu — 11 satırlık bir
listede "Görsel 8" başlığı tek başına hiçbir şey anlatmıyor.

### İki katmanlı çözüm
- **Küçük kare önizleme** her satırda: listeye bakar bakmaz hangisinin hangisi olduğu belli
- **Satıra tıklayınca açılıyor**: görselin tam hâli, video ise oynatıcı, çekim planıysa referans
  video ve konuşma metni

Onaylanmış ya da revize istenmiş fark etmez — hepsi görünür kalıyor. Revize notu artık kırmızı
renkte, hangi kayda ait olduğu net.

### Yönetici tarafına da eklendi
Müşteri Paneli sekmesindeki içerik listesinde de aynı sorun vardı: 10 satırlık listede
başlıktan hangi görselin hangisi olduğunu anlamak mümkün değildi. Oraya da küçük önizleme
eklendi.

Görseli olmayan kayıtlarda tür simgesi çıkıyor (🎬 çekim planı, ▶ video, 🖼 görsel).

## Güncelleme 84: Operasyon ↔ Müşteri Paneli Senkronu

### 1. "Hazır İçerikler" — canlı ayna
Müşteri paneline yeni bir sekme geldi: Operasyon'da **"Kontrol Bekliyor"** aşamasındaki tüm
kartlar, o markaya ait olanlar burada görünüyor.

**Kopya değil, ayna.** Bu ayrım önemli: eskiden bir iş Kontrol Bekliyor'a geçtiğinde müşteri
paneline bir kopya kayıt oluşturuluyordu. İki sorunu vardı —
- Yalnızca işte **dosya linki varsa** çalışıyordu; dosyasız kartlar müşteriye hiç gitmiyordu
- Kopya olduğu için, iş o aşamadan geri alınsa bile müşteri panelinde onay bekliyor gibi
  asılı kalıyordu

Artık iş Kontrol Bekliyor'dan çıktığı anda müşteri panelinden de kayboluyor. "Orada olmayan
bir şey müşteri panelinde gözükmesin" kuralı kendiliğinden sağlanıyor — ayrıca bir temizlik
gerekmiyor.

Dosyası olmayan kartlar da görünüyor; müşteriye "dosya henüz eklenmedi" diye yazıyor.

### Onay ve revize doğrudan Operasyon kartını hareket ettiriyor
| Müşteri ne yaparsa | Operasyon kartı |
|---|---|
| **Onayla** | → **Onaylandı** (teslim adımı ekipte kalır) |
| **Değişiklik iste** | → **Revize İstendi**, notu işin geçmişine yazılır |

### Gizlilik
Kartlar alan alan seçilerek gönderiliyor. **Brief, kameraman/editör adları, iç yorumlar ve
işlem geçmişi müşteriye gitmiyor.** Test edildi.

Ayrıca müşteri yalnızca **kendi markasının** ve yalnızca **Kontrol Bekliyor'daki** bir kartına
dokunabiliyor — başka marka ya da başka aşama denemesi sunucuda reddediliyor.

### 2. Çekim planlarına "✓ Çekildi"
Müşteri Paneli sekmesinde çekim planı satırlarına **"✓ Çekildi"** düğmesi eklendi. Tıklayınca
Operasyon'da iş doğrudan **"Çekim Yapıldı"** aşamasına düşüyor (Grafik Tasarım'da "Tasarım
Bekliyor").

Onay Kutusu'ndan geçmiyor — onay kutusu "ne yapılacak, kim yapacak" kararı içindir; burada
karar zaten verilmiştir, çekim yapılmıştır. Kimse atanmadığı için iş onay kutusunda
"atanmamış" olarak yine görünür ve oradan kişi atanabilir.

Zaten bağlı bir iş varsa ikinci kart açılmaz, mevcut iş ilerletilir. İşaretlenen plan satırında
"✓ Çekildi" yazısı kalır.

### Doğrulama
Yeni test dosyası `testler/t14.mjs` — 11 kontrol: aşama süzmesi, marka süzmesi, dosyasız kart,
gizli alan sızıntısı, onay/revize sonrası aşama, listeden düşme ve iki yetkisiz erişim denemesi.
Hepsi geçiyor.

## Güncelleme 85: Marka Adı Eşleşmesi — Kartların Müşteri Paneline Düşmemesi

Kontrol Bekliyor'daki bazı kartlar (Kanatçı Diren) müşteri paneline düşmüyordu.

**Sebep:** İşler markayı **metin olarak** tutuyor ve müşteri kaydıyla birebir eşleşmesi
gerekiyordu. Test edince üç yazım farkının eşleşmeyi kırdığı görüldü:

| Yazım | Sonuç (eski) |
|---|---|
| `KANATÇI DIREN` (büyük İ yerine I) | ✗ eşleşmiyor |
| `Kanatçı  Diren` (çift boşluk) | ✗ eşleşmiyor |
| `Kanatci Diren` (Türkçe karakter yok) | ✗ eşleşmiyor |

Büyük I sorunu Türkçeye özgü: `I` küçültülünce `ı` olur, `İ` küçültülünce `i`. Yani tamamı
büyük yazılmış bir marka adı, düzgün yazılmışla eşleşmiyordu.

### Çözüm — iki katman
**1. Toleranslı eşleştirme.** Yeni `markaAnahtari()` boşlukları sadeleştirir ve Türkçe harfleri
ASCII karşılığına indirger. Yukarıdaki üç yazım da artık eşleşiyor.

**Gizlilik koruması:** İki farklı müşteri aynı anahtara düşerse (ör. "Cem" ve "Çem") o markalar
için **tam eşleşmeye** dönülür. Aksi halde bir markanın içeriği yanlışlıkla başka bir müşteriye
gösterilebilirdi. Test edildi.

**2. Bağlanamayan kartlar uyarısı.** Müşteri Paneli sekmesinin en üstünde: marka adı hiçbir
müşteriyle eşleşmeyen Kontrol Bekliyor kartları adlarıyla listeleniyor. Böyle bir kart artık
sessizce kaybolmuyor.

### Onuncu denetleyici
Bu çalışma sırasında **kendi hatam** ortaya çıktı: uyarı kartını ekledim ama beslediği değişkeni
tanımlamayı atladım — sayfa açılır açılmaz çökerdi. Dokuz denetleyicinin hiçbiri göremedi,
çünkü kullanım bir *çağrı* değildi (`{bagsizKartlar.length}`).

`testler/degiskendenetle.py` eklendi: JSX içinde kullanılan ama hiçbir yerde bildirilmemiş
adları bulur. Dokuz temiz dosyada yanlış alarm vermiyor, bozuk hâli yakalıyor.

## Güncelleme 86: Marka Artık Listeden Seçiliyor

Operasyon'da marka alanı **serbest metindi**. Bir önceki güncellemedeki "kart müşteri paneline
düşmüyor" sorununun kaynağı buydu: tek bir yazım farkı (büyük I, çift boşluk, Türkçe karakter
yazılmaması) eşleşmeyi kırıyordu.

**Artık listeden seçiliyor.** Hem yeni iş formunda hem düzenleme penceresinde. Yazım farkı
doğması artık mümkün değil — sorun kaynağında çözüldü.

Müşteri listesinde olmayan işler için **"Diğer (elle yaz)"** seçeneği duruyor. Seçilince
serbest metin alanı açılıyor ve altında uyarı çıkıyor: *"Bu marka müşteri listende yok — bu
kart müşteri paneline düşmez."* Yani elle yazmak hâlâ mümkün, ama sonucu artık sürpriz değil.

Düzenleme penceresinde marka alanı zaten **hiçbir öneri sunmuyordu**; müşteri listesi o
pencereye hiç aktarılmıyordu. Şimdi aktarılıyor.

### Eski kartlar için tek tıkla düzeltme
Müşteri Paneli sekmesindeki "bağlanamayan kartlar" uyarısında, yazımı farklı ama aynı markayı
kasteden kartların yanında artık bir düğme var: **"Kanatçı Diren olarak düzelt"**. Tek tıkla
kartın markası müşteri kaydındaki yazımla eşitleniyor.

## Güncelleme 87: Hazır İçerikler Müşteriye Ulaşmıyordu

Sunucu, Kontrol Bekliyor'daki kartları müşteri paneline **gönderiyordu** — ama arayüz onları
almıyordu. Sekme görünüyor, içi boş kalıyordu.

**Sebep:** Müşteri giriş yanıtı arayüzde **alan alan kopyalanıyordu**. Sunucuya yeni bir alan
eklendiğinde bu listeye de eklenmezse, alan sessizce düşüyor. Hata çıkmıyor, uyarı çıkmıyor —
özellik sadece "çalışmıyor" görünüyor.

**Bu aynı hatanın ikinci tekrarıydı.** İlkinde reklamlar ve paylaşım planı aynı şekilde
düşmüştü.

### Kalıcı çözüm
Arayüz artık yanıtın **tamamını** alıyor, tek tek kopyalamıyor. Sunucuya eklenen her yeni alan
kendiliğinden geçiyor. Bu güvenli, çünkü sunucu zaten müşteriye yalnızca göstermesi gereken
alanları gönderiyor — alanlar orada tek tek seçiliyor.

### On birinci denetleyici
`testler/musteriAlanDenetle.py` — sunucunun müşteriye gönderdiği alanların arayüzde gerçekten
okunabildiğini doğrular. Alan alan kopyalamaya geri dönülürse, düşen alanı adıyla bildirir.
Bozuk hâliyle test edildi, yakalıyor.

## Güncelleme 88: Hazır İçerikler, Onay Bekleyenler'in İçine Taşındı

Ayrı bir "Hazır İçerikler" sekmesi vardı. Müşteri açısından ikisi de aynı şeyi söylüyor:
*onayını bekleyen bir içerik.* İki ayrı sekme "hangisine bakacağım?" sorusunu doğuruyordu.

Artık hepsi **Onay Bekleyenler** sekmesinde. Sekmedeki sayı ikisinin toplamını gösteriyor.

Operasyon'dan gelen hazır içerikler listenin **üstünde** duruyor — üretimi bitmiş, teslime en
yakın işler onlar.

Davranış değişmedi: onaylayınca Operasyon kartı "Onaylandı"ya geçiyor, değişiklik isteyince
"Revize İstendi"ye. Her iki durumda da kart listeden kendiliğinden düşüyor.

**Boş durum mantığı:** "Şu an bekleyen bir şey yok" mesajı yalnızca ikisi de boşken çıkıyor.
Aksi halde hazır içerik dururken altında "bekleyen yok" yazacaktı ve müşteri hangisine
inanacağını bilemeyecekti. Dört durumun hepsi doğrulandı.

## Güncelleme 89: Birebir Senkron — Aynı İş İki Kez Görünmüyor

Müşteri panelinde **aynı iş iki kez** görünüyordu: bir kez Operasyon'dan canlı yansıyan kart,
bir kez de eski sistemin bıraktığı kopya kayıt.

Eski sistem, bir iş "Kontrol Bekliyor"a geçtiğinde müşteri paneline bir kopya yaratıyordu.
Canlı yansıtmaya geçtikten sonra bu kopyalar gereksiz hâle geldi — üstelik kopya, iş
Operasyon'da ilerlese bile yerinde kalıyordu.

**Artık bir Operasyon işine bağlı kayıtlar müşteriye gönderilmiyor.** Müşteri paneli
Operasyon'un birebir aynası.

**Çekim planları istisna** — bunlar henüz Operasyon'da bir iş değil, çekim öncesi müşteriye
sunulan fikirler. Gönderilmeye devam ediyor.

Kayıtlar **silinmedi**, yalnızca müşteriye gönderilmiyor; geçmişleri yönetici tarafında duruyor.

### Onay ve revize akışı doğrulandı
| Müşteri | Operasyon kartı |
|---|---|
| Onayla | → **Onaylandı** sütunu |
| Değişiklik iste | → **Revize İstendi** sütunu, notu işin geçmişine yazılır |

Bu davranışlar zaten çalışıyordu; `testler/t16.mjs` ile (8 kontrol) doğrulandı. Asıl sorun
çift görünmeydi.

## Güncelleme 90: Müşteri Paneli Üç Duruma Ayrıldı

Müşteri paneli artık üç sekme: **Onay Bekleyenler · Revize İstediklerin · Onayladıkların**.
Karışık bir "Geçmiş" listesi yerine, müşterinin ne yaptığına göre ayrılmış üç net kova.

### Bunu yaparken bir eksik ortaya çıktı
Ayna yalnızca "Kontrol Bekliyor" aşamasını kapsıyordu. Müşteri bir kartı revize ettiğinde iş o
aşamadan çıkıyor ve kart **panelden tamamen kayboluyordu** — "neye revize istemiştim?"
sorusunun cevabı yok oluyordu, "Revize İstediklerin" sekmesi de boş kalırdı.

Ayna genişletildi:

| Operasyon aşaması | Müşteri panelinde |
|---|---|
| Kontrol Bekliyor | Onay Bekleyenler (işlem yapılabilir) |
| Revize İstendi | Revize İstediklerin (notuyla birlikte) |
| Onaylandı / Teslim Edildi | Onayladıkların |
| Diğer aşamalar | görünmez (üretim devam ediyor) |

Revize ve onaylı kartlar **salt okunur** — kayıt olarak duruyor, tekrar işlem yapılamıyor.

### Numaralandırma düzeltildi
Liste 01, 02 sonra tekrar 01, 02 diye numaralanıyordu. Artık kesintisiz.

Bu sırada gerçek bir hata bulundu: numara kaydırması için kullanılan değer **başka bir
bileşenin parametresiydi**, o listede tanımsızdı. Denetleyici dosya genelinde baktığı için
göremedi — artık **kapsam farkında**: bir ad, başka bir bileşenin parametresi olduğu için
"tanımlı" sayılmıyor.

Bilinen sınırı `testler/OKUBENI.md`'ye yazıldı: doğrudan `{ad}` kullanımlarını yakalar, bir
fonksiyon çağrısının içinde geçeni göremez.

## Güncelleme 91: "Revize İstediklerin" Sekmesinde Siyah Ekran

Yeni sekmelere tıklandığında sayfa siyah oluyordu.

**Sebep:** Durum etiketleri (`DURUM_STIL`) **MusteriPaneli bileşeninin içinde** tanımlıydı.
Yeni `DurumListesi` bileşeni onu kullanıyordu ama başka bir bileşenin içindeki bir tanıma
erişemez. Kod sözdizimi olarak geçerli; hata ancak o bileşen **ekrana geldiğinde** ortaya
çıkıyor — yani o sekmeye tıklandığında.

**Düzeltme:** `DURUM_STIL` modül seviyesine taşındı, iki bileşen de erişiyor. Bileşenden
kalan fazladan bir kapanış etiketi de temizlendi.

### On ikinci denetleyici
Bu hata **on bir denetleyicinin hepsinden geçti.** Hiçbiri "bu ad hangi kapsamda tanımlı"
sorusunu sormuyordu.

`testler/kapsamdenetle.py` eklendi: dosyayı bileşenlere böler, bir bileşenin içinde tanımlanan
sabitin başka bir bileşende kullanılıp kullanılmadığına bakar. Bozuk hâliyle test edildi,
hatayı adıyla bildiriyor:

```
✗ DURUM_STIL: MusteriPaneli içinde tanımlı, DurumListesi kullanıyor
```

Bu, aynı kök sebebin bir başka yüzü: bileşen çıkarırken taşınan kodun bağımlılıkları geride
kalıyor. Artık bu sınıfın üç biçimi de yakalanıyor — eksik import (5), tanımsız değişken (10),
kapsam dışı kullanım (12).

## Güncelleme 92: Fotoğraf Kategorisi

Operasyon'da Video ve Grafik Tasarım vardı; **fotoğraf çekimi** için bir yer yoktu. Eklendi.

### Aşamalar (bilerek kısa)
```
Çekim Yapıldı → Düzenleniyor → Kontrol Bekliyor → Revize İstendi → Onaylandı → Teslim Edildi
```
Video'daki "Dosyalar Aktarıldı / Edit Bekliyor" ayrımı fotoğrafta bir işe yaramıyor —
fotoğrafçı çekimi bitirir bitirmez düzenlemeye geçiyor.

### Yapısal değişiklik
Kategori, kodun **15 ayrı yerinde** "Grafik Tasarım mı, değilse Video" biçiminde ikili kontrol
olarak duruyordu. Üçüncü kategori bu yapıya sığmıyordu; hepsi tabloya çevrildi:

| Yardımcı | Ne yapar |
|---|---|
| `asamaListesi(kategori)` | O kategorinin aşama listesi |
| `ILK_ASAMA(kategori)` | Yeni iş hangi aşamada başlar |
| `ciktiVideoMu(kategori)` | Çıktı video mu, görsel mi |
| `cekimVarMi(kategori)` | Kameraman/çekim tarihi alanları gösterilsin mi |

Bu, gizli bir hatayı da düzeltti: çıktı türü "Grafik Tasarım değilse video" varsayılıyordu.
Fotoğraf işlerinde bu yanlış olurdu — video oynatıcı açılıp görsel gösterilmezdi. Artık
**yalnızca Video kategorisinin çıktısı video**; fotoğraf ve tasarım görsel olarak önizleniyor.

### Alan adları kategoriye göre
Editör alanı artık Video'da "Editör", Fotoğraf'ta "Düzenleyen", Tasarım'da "Tasarımcı".
Fotoğrafta kameraman ve çekim tarihi alanları duruyor (tasarımda gizli).

### Geriye dönük uyumluluk
Kategorisi olmayan eski kayıtlar Video akışını kullanmaya devam ediyor — test edildi.

### Doğrulama
11 kategori mantığı kontrolü (ilk aşamalar, çıktı türü, eski kayıtlar) + 4 uçtan uca sunucu
kontrolü: fotoğraf işi müşteri paneline düşüyor, kategori taşınıyor, ara aşama görünmüyor,
onay Operasyon'da doğru sütuna geçiyor.

## Güncelleme 93: İçerik Türleri Ayrıştırıldı + Elle Ekleme Artık Operasyon Kartı Açıyor

### 1. Müşteri panelinde Reels / Görsel / Tasarım
Müşteri artık üretim kategorisi ("Video", "Fotoğraf", "Grafik Tasarım") değil, kendi dilindeki
karşılığını görüyor:

| Kategori | Müşteri panelinde |
|---|---|
| Video | **Reels** (mor) |
| Fotoğraf | **Görsel** (turkuaz) |
| Grafik Tasarım | **Tasarım** (kehribar) |

Her kartta renkli bir tür rozeti var — bekleyenlerde, revize istediklerinde ve onayladıklarında.

**Tür süzgeci** eklendi: "Hepsi · Reels · Görsel · Tasarım" düğmeleriyle müşteri sadece
aradığı türe bakabiliyor. Süzgeç yalnızca listede birden fazla tür varsa çıkıyor — tek türlü
bir listede gereksiz gürültü olurdu.

Sekmedeki sayı **süzgeçten etkilenmiyor**: süzgeç bir görünüm tercihi, sekmedeki sayı ise
gerçek bekleyen adedi. Birlikte düşseydi "3 içerik vardı, 1 oldu" gibi görünürdü.

### 2. Elle eklenen içerik artık Operasyon kartı oluşturuyor
Müşteri Paneli → **İçerik Ekle** formu artık kart bilgilerini istiyor:

- **Kategori** (Video / Fotoğraf / Grafik Tasarım)
- **Aşama** — o kategorinin tüm aşamaları listeden seçiliyor
- **Kameraman** (çekim içeren kategorilerde) ve **Editör / Düzenleyen / Tasarımcı**
- **Teslim tarihi**

Buton adı "Müşteri Paneline Ekle" yerine **"Operasyon Kartı Oluştur"** oldu, çünkü yaptığı iş
bu.

**Neden:** müşteri paneli Operasyon'un aynası. İçeriği yalnızca panele eklersek Operasyon'da
hiç görünmez, kimse üzerinde çalışmaz ve iki taraf ayrışır — "dışarıdan ekleme" tam olarak
buydu.

Aşama seçimi sayesinde: içerik hazırsa **Kontrol Bekliyor** seçip müşteriye hemen
gönderebilirsin; henüz üretilmediyse baştaki bir aşamaya alırsın ve müşteri onu ancak
kontrole geldiğinde görür. Form bunu altında yazıyla da belirtiyor.

Çekim planları bu değişiklikten etkilenmedi — onlar hâlâ üretim öncesi fikirler.

## Güncelleme 94: Yönetici Panelinde de Tür Ayrımı

Müşteri Paneli sekmesindeki içerik listesi karışıktı — Görsel 7, Görsel 5, Reels 1, Görsel 1…
13 satırlık bir listede ne aradığını bulmak zordu.

Aynı ayrım artık burada da var:
- Her satırda **renkli tür rozeti** (Reels · Görsel · Tasarım · Çekim Planı)
- Üstte **süzgeç düğmeleri**, her birinde o türden kaç kayıt olduğu yazılı:
  `Hepsi 13 · Görsel 9 · Reels 3 · Çekim Planı 1`

Süzgeç yalnızca listede birden fazla tür varsa çıkıyor.

### Etiketler artık ortak
Tür etiketleri `tema.jsx`'e taşındı; yönetici paneli ve müşteri paneli **aynı tanımı**
kullanıyor. Ayrı dursaydı biri "Reels" derken diğeri "Video" diyebilir, aynı içerik iki farklı
adla görünürdü — daha önce sıralama ve durum etiketlerinde bu kuralı koymuştuk, tür
etiketlerinde de aynısı geçerli.

Renkler her iki temada da (koyu/açık) okunacak şekilde sabit seçildi.

## Güncelleme 95: Onay Kutusunda Önizleme + "Planı Düzenle" Doğru Yere Gidiyor

### 1. Önizleme eklendi
Planım → Onayını Bekleyenler'de yalnızca başlık ve müşterinin notu görünüyordu. Bir revizeyi
Operasyon'a aktarırken **neye baktığını göremiyordun** — "hangi görsele ne demiş?" sorusu için
başka bir sekmeye gidip içeriği elle bulmak gerekiyordu.

Artık her satırda:
- **Küçük kare önizleme** — hangisi olduğu bir bakışta belli
- **"İçeriği gör"** — görselin tamamı, video ise oynatıcı, çekim planıysa referans video ve
  konuşma metni

Hem revize istekleri hem onaylanmış planlar için.

### 2. "Planı Düzenle" artık doğrudan içeriği açıyor
Buton yalnızca sekmeyi değiştiriyordu. Marka seçili gelmediği için **boş bir sayfaya**
düşüyordun; doğru içeriği listede elle bulman gerekiyordu. Yanlış satıra tıklandığında da
"link görünmüyor" izlenimi doğuyordu — aslında farklı bir kaydın formu açılıyordu.

Artık buton:
1. Müşteri Paneli sekmesine geçer
2. **O markayı seçer**
3. **O içeriğin düzenleme formunu açar** — link, açıklama, görsel hepsi dolu gelir

Aynı içeriğe ikinci kez tıklandığında da çalışır (her tıklama ayrı bir hedef damgası taşır).

## Güncelleme 96: Aktarılan Kartta Dosya Bağlantısı Boş Geliyordu

Planım'dan bir revizeyi Operasyon'a aktarınca kart açılıyordu ama **dosya bağlantısı boştu**.
Editör kartı açıyor, neyi düzelteceğini göremiyordu.

**Sebep:** Aktarım yalnızca `referansLink` alanına bakıyordu — o alan ise **sadece çekim
planlarında** dolu. Görsel ve Reels içeriklerinde dosya `driveLinki` alanında duruyor ve hiç
kopyalanmıyordu.

**Düzeltme:** Artık hangi alanda varsa oradan alınıyor. Video yönü de taşınıyor, böylece
oynatıcı çerçevesi doğru şekilleniyor (dikey Reels yanlarda siyah bant almıyor).

### Mevcut işin dosyası korunuyor
Zaten bağlı bir iş varsa ve o işin dosyası doluysa **dokunulmuyor**. Ekibin yüklediği güncel
dosyanın üzerine içerikteki eski bağlantıyı yazmak veri kaybı olurdu. Yalnızca boşsa
dolduruluyor.

### "Çekildi" düğmesi de düzeltildi
Çekim planından oluşturulan kartta referans video artık **Ham Dosya** alanına yazılıyor —
çekim yeni yapıldığı için editli dosya henüz yok, ama editör neye bakarak çalışacağını görüyor.

Altı senaryo doğrulandı: görsel revizesi, video revizesi, çekim planı referansı, dosyasız
içerik, mevcut dosyanın korunması ve boş işin doldurulması.

## Güncelleme 97: Aktarılan Revizeler Kutuda Birikiyordu

Operasyon'a aktarılmış revizeler onay kutusunda **sonsuza kadar kalıyordu** — "✓ Operasyon'a
aktarıldı" işaretiyle, ama düşmeden. Altı kayıt birikmişti.

**Eski kural:** revize, düzeltilmiş içerik müşteriye tekrar gönderilene kadar kutuda kalır.
Bu kural, müşteri paneli ayrı bir kayıt tutarken doğruydu.

**Artık geçerli değil:** müşteri paneli Operasyon'un aynası. Ekip düzeltmeyi bitirip kartı
"Kontrol Bekliyor"a gönderdiğinde müşteri onu zaten yeniden görüyor. Kutuda kalması gereksiz.

**Yeni kural:** Bağlı bir Operasyon işi varsa, o iş **"Revize İstendi" aşamasından çıktığı an**
kutudan düşer. Yani ekip "Revizeyi Tamamladım" dediğinde iş kendiliğinden kapanır.

Bağlı iş yoksa (elle eklenmiş eski kayıtlar) eski kural geçerli — içerik tekrar gönderilene
kadar kalır. Silinmiş bir işe bağlıysa da kutuda kalır, sessizce kaybolmaz.

Sol menüdeki sayı rozeti **aynı kuralı** kullanıyor; farklı olsaydı rozet "6" derken kutuda 2
kayıt görünürdü.

Altı senaryo doğrulandı: iş hâlâ revizede, ekip düzeltti, teslim edildi, bağlı iş yok, silinmiş
işe bağlı, revize olmayan kayıt.

## Güncelleme 98: Yönetici Listesi de Müşteri Paneliyle Aynı Yapıda

Müşteri Paneli sekmesindeki liste tek karışık akıştı — bekleyen, revize istenen ve onaylanan
içerikler iç içeydi. Müşteri panelinde bunları üç sekmeye ayırmıştık; burada da aynı ayrım
yapıldı.

### Durum grupları
Liste artık üç başlık altında:
```
ONAY BEKLEYENLER · 2
REVİZE İSTEDİKLERİ · 6
ONAYLADIKLARI · 5
```

Adlar müşteri panelindekiyle **aynı** ve ortak bir yerden geliyor — farklı isimlendirilseydi
iki taraf aynı içeriği farklı adlandırırdı.

Sıralama gruplarla uyumlu hale getirildi: önce bekleyenler, sonra revize, sonra onaylananlar.
Grup içinde senin ▲▼ ile belirlediğin sıra korunuyor. Bu gerekliydi — başlıklar ardışık
kayıtlara bakarak çizildiği için, sıralama gruplarla uyumsuz olsaydı aynı başlık defalarca
tekrarlanırdı.

### Her satır açılıyor
Eskiden yalnızca çekim planları açılabiliyordu. Artık **her satıra tıklayınca içerik açılıyor**:
görselin tamamı, video ise oynatıcı, çekim planıysa referans ve konuşma metni. Altında
"Drive'da aç" bağlantısı da var.

Ne gönderdiğini görmek için artık müşteri paneline girmen gerekmiyor.

## Güncelleme 99: Müşteri Paneli Sekmelere Ayrıldı, Şifreler Müşteriler'e Taşındı

### 1. Dört sekme
Tek uzun liste yerine sekmeler — müşteri panelindekiyle aynı ayrım:

```
Onay Bekleyenler 2 · Revize İstedikleri 6 · Onayladıkları 4 · İçerik Fikirleri 3
```

### 2. İçerik Fikirleri ayrı
Çekim planları artık kendi sekmesinde, **durumundan bağımsız**. Onlar henüz üretilmemiş,
müşteriye sunulan fikirler; üretilmiş içeriklerle aynı kovada durmaları kafa karıştırıyordu.

Doğrulandı: her kayıt yalnızca **tek bir sekmede** görünüyor, hiçbiri kaybolmuyor.

### 3. Kullanıcı adı / şifre Müşteriler sekmesine taşındı
Müşteri Paneli giriş hesapları kartı artık **Müşteriler** sekmesinin altında. Kullanıcı adı ve
şifre müşterinin kendi kaydına ait bir bilgi; içerik yönetimiyle aynı ekranda durunca iki ayrı
iş karışıyordu.

Tür süzgeci (Reels / Görsel / Tasarım) sekme içinde çalışmaya devam ediyor ve sekme
değiştirince sıfırlanıyor — önceki sekmeden kalan bir süzgeç yüzünden boş liste görünmesin diye.

## Güncelleme 100: Sekme Çubuğu Eksik Kalmıştı — Kayıtlara Erişilemiyordu

99. sürümde sekme **süzgeci** eklendi ama **sekme çubuğu dosyaya yazılmadı**. Sonuç: liste
"Onay Bekleyenler"e sabitlendi ve diğer 10 kayda ulaşmanın hiçbir yolu kalmadı.

Kod çalışıyordu, hata vermiyordu — sadece verinin bir kısmı **erişilemez** hâle gelmişti.
Bu, sessiz kalması en tehlikeli hata türlerinden biri.

**Sebep:** Çok adımlı bir düzenleme yarıda kesildi; ilk parça (süzgeç mantığı) yazıldı, ikinci
parça (çubuk) yazılmadan durdu ve bunu fark etmedim.

**Düzeltme:** Sekme çubuğu eklendi. Dört sekme sayılarıyla birlikte görünüyor, tür süzgeci de
altında.

### On üçüncü denetleyici
`testler/olusetter.py` — bir `useState` değişkenini değiştirecek hiçbir yol yoksa uyarır.

Bu tam olarak yukarıdaki hatanın imzası: süzgeç değişkeni var, onu değiştiren düğme yok.
On iki denetleyicinin hiçbiri göremezdi, çünkü kod her açıdan geçerli.

Setter'ın doğrudan çağrılması ya da bir bileşene prop olarak geçirilmesi (`onChange={setAy}`)
"değiştirilebiliyor" sayılır — dokuz dosyada yanlış alarm vermiyor, bozuk hâli yakalıyor.

## Güncelleme 101: Çözüm Ortağı İçin "İçerik Akışı"

Çözüm ortağı artık **kendi markalarının** içerik durumunu görebiliyor: onay bekleyen, revize
istenen, onaylanan.

### Yeni izin: İçerik Akışı
Ayarlar → Personel Hesapları → Yetkiler'de yeni bir seçenek. Açılınca ortağın menüsünde
**İçerik Akışı** sekmesi çıkıyor — yönetici tarafındakiyle aynı dört sekme (Onay Bekleyenler ·
Revize İstedikleri · Onayladıkları · İçerik Fikirleri), aynı tür rozetleri, aynı önizlemeler.

### SALT OKUNUR
Bu izin hiçbir yazma hakkı vermiyor. Sunucu tarafında yazılabilir alanlar listesinde karşılığı
yok; test edildi: bu izne sahip bir hesap içeriği değiştiremiyor.

Görünümde de ekleme, düzenleme, silme, onaylama düğmelerinin **hiçbiri çıkmıyor**. Aylık rapor
ve panel ekleri de gizli — ortağın işi içeriğin nerede olduğunu görmek.

### Marka kilidi geçerli
Ortak yalnızca kendisine atanmış markaları görüyor. Test edilenler: başka markanın içeriği
gelmiyor, başka markanın Operasyon işi gelmiyor, finans ve personel verisi izin verilse bile
gönderilmiyor, müşteri ücretleri gizli.

### Not: varsayılan izinler
Bir personel hesabında **Operasyon (cekimEdit)** izni açıksa, o iznin yazma hakkı zaten içerik
kayıtlarını kapsıyor — yani ortak içeriği değiştirebilir. Yalnızca görüntülemesini istiyorsan
Yetkiler'de Operasyon'u kapalı bırak, İçerik Akışı'nı aç.

## Güncelleme 102: Hesaplar ve Yetkiler Personel Sekmesine Taşındı

Giriş hesapları, kullanıcı adı/şifre ve yetkiler Ayarlar'daydı. Artık **Personel → Hesaplar &
Yetkiler** alt sekmesinde.

Sebep: kişiyi işe alıyorsun, ücretini giriyorsun, sonra hesabını açıp yetkisini veriyorsun —
üçü aynı iş. Ayrı ekranlarda olmaları gereksiz gidip gelme demekti.

### Personel sekmesi artık üç alt sekme
```
Kadrolu (5) · Freelancer (8) · Hesaplar & Yetkiler
```

İçinde iki kart:
- **Personel Hesapları** — kullanıcı adı, şifre, kişiye özel yetkiler, marka kilidi
- **Genel Yetkiler** — kişisel hesabı olmayanlar (ortak personel şifresi) için ortak ayar

### Ayarlar'da kopya bırakılmadı
Kart iki ayrı ekranda dururken aynı hesapları iki yerden düzenlemek karışıklık yaratırdı.
Ayarlar'da yalnızca nereye taşındığını söyleyen bir not var.

Kaydetme yolu değişmedi — mevcut `updateStaffPermissions` kullanılıyor, ayrı bir yol açılmadı.

## Güncelleme 103: "Genel Yetkiler" Kartı Ne İşe Yarıyor?

Personel → Hesaplar & Yetkiler'deki ikinci kart kafa karıştırıyordu: madem kişi bazında
yetkilendiriyoruz, bu ne?

**Cevap:** O kart yalnızca **ortak personel şifresiyle** girenler için geçerli. Kişisel hesabı
olan herkesin kendi "Yetkiler" paneli var ve o, bu ayarın yerine geçer.

Ortak şifre, Vercel'de `STAFF_PASSWORD` ortam değişkeni tanımlıysa çalışır. Tanımlı değilse
**kimse o yolla giremez** ve kart hiçbir şeyi etkilemez.

### Artık durumu görüyorsun
Kart, ortak şifrenin tanımlı olup olmadığını sunucudan öğrenip yazıyor. Tanımlı değilse
üstünde açıkça duruyor:

> **Bu bölüm şu an bir işe yaramıyor** — ortak personel şifresi tanımlı değil, ekipteki herkes
> kişisel hesabıyla giriyor ve ona verdiğin yetkiler geçerli oluyor.

Kart silinmedi: ortak şifre yolu hâlâ çalışıyor (test edildi) ve ileride tanımlarsan devreye
girer. Ama artık boşuna ayar yapma ihtimalin yok.

Başlığı da düzeltildi: "CEO Paneli — Personel Yetkileri" yerine **"Genel Yetkiler (ortak
personel şifresi)"**. Eski açıklama "ekipteki herkes için ortak bir ayardır" diyordu; kişisel
hesapların bunu ezdiğini söylemiyordu.

## Güncelleme 104: Genel Yetkiler Kartı Kaldırıldı (Koşullu)

Ortak personel şifresi kullanılmıyor, o yüzden "Genel Yetkiler" kartı artık **görünmüyor**.
Personel → Hesaplar & Yetkiler'de yalnızca kişisel hesaplar listesi var — yetkiler her hesabın
kendi **Yetkiler / E-posta** panelinden veriliyor.

### Neden tamamen silmedim
Kart, ortak şifre (`STAFF_PASSWORD`) tanımlıysa **kendiliğinden geri gelir**. Tamamen
silseydim ve ileride o şifreyi tanımlasaydın, ayarlanamayan — varsayılan izinlerle çalışan —
bir giriş yolu ortaya çıkardı. Bu, sessiz bir güvenlik boşluğu olurdu.

Şimdi ise: şifre yok → kart yok → o yol zaten kapalı. Şifre tanımlarsan → kart döner ve
ayarlayabilirsin.

### Doğrulandı
- Ortak şifre yokken kişisel hesap girişi çalışıyor
- Yönetici girişi etkilenmedi
- Ortak şifre tanımlanırsa yol ve kart yeniden devreye giriyor

## Güncelleme 105: Genel Yetkiler Katlanabilir Oldu

Kart gizlenmek yerine **katlanabilir** yapıldı ve **kapalı başlıyor**. Başlıkta durumu
açmadan görüyorsun:

```
Genel Yetkiler (ortak personel şifresi)
4 açık · 13 kapalı · ortak şifre tanımlı değil, şu an kullanılmıyor
Aç ▼
```

17 satırlık liste artık her açılışta yer kaplamıyor; gerektiğinde tek tıkla açılıyor.

### Sayım varsayılanları hesaba katıyor
Hiç dokunulmamış bir izin "kapalı" sayılsaydı rakam gerçekle uyuşmazdı — bazı izinler (Reklamlar,
Paylaşımlar, Operasyon, Marka Yöneticisi) varsayılan olarak **açık**. Sayım bunu hesaba
katıyor; beş senaryo doğrulandı.

### İzin listesi tek yerde
Liste artık modül seviyesinde bir sabit. Hem kartın içinde çizilirken hem başlıktaki sayımda
aynı liste kullanılıyor — iki ayrı kopya olsaydı biri güncellenip diğeri unutulduğunda sayı
yanlış çıkardı.

## Güncelleme 106: Ayarlar Sekmelere Ayrıldı

Ayarlar tek sayfada 18 bölümdü; aradığını bulmak için uzun uzun kaydırmak gerekiyordu.
Beş sekmeye ayrıldı:

| Sekme | İçindekiler |
|---|---|
| **Görünüm & Marka** | Tema/gizlilik modu, işlem geçmişi, marka kimliği |
| **Veri & Yedek** | Veri durumu, otomatik yedekler, veri boyutu, tam yedek, e-posta yedeği, geri dönüşüm kutusu |
| **Güvenlik** | Şifre koruması, personel erişimi, güvenlik defteri, güvenlik durumu, kasa şifresi |
| **Bildirimler** | Sabah AI özeti, Operasyon & günlük kontrol hatırlatmaları |
| **Hesaplar** | Müşteri paneli hesapları, personel hesapları yönlendirmesi |

### Nasıl yapıldı — riskli olduğu için
Kartların **hiçbirinin içine dokunulmadı**. Her bölümün sınırları önce programatik olarak
çıkarıldı (açılış/kapanış etiketleri sayılarak), sonra bloklar **birebir** alınıp gruplandı.
Tek eklenen şey sekme çubuğu ve `{ayarSekme === "x" && <>...</>}` sarmalayıcıları.

### Doğrulama
- 18 bölümün hepsi hâlâ mevcut — adları tek tek arandı, kaybolan yok
- Bir önceki sürümle karşılaştırıldı: 13 başlığın hepsi duruyor, kaybolan/eklenen yok
- Boşluksuz kod uzunluğu farkı yalnızca eklenen sekme kodu kadar
- Tüm etiketler dengeli (Card, div, button, span, p, label)
- 13 kod denetimi + 8 sunucu denetimi (79 kontrol) geçti

## Güncelleme 107: Sistem Denetimi ve Altı Düzeltme

Tüm sistem baştan sona denetlendi (senkron, mantık, veri kaybı, güvenlik, yetkilendirme,
yedek). Sağlam çıkanlar: marka kilidi kapsamı tam, müşteriler arası sınır sağlam, boş/bozuk
veri yazma reddediliyor, yedek her alanı kapsıyor, giriş güvenliği çalışıyor.

Altı bulgu düzeltildi:

### 1 🚨 Müşteri içerik kayıtları olduğu gibi gönderiliyordu
Mimari kural "müşteriye giden veri alan alan seçilir" diyor; reklamlar ve paylaşımlar için
uygulanmış ama `musteriIcerikleri` için atlanmıştı. Sızanlar: `kaynakIsId`,
`operasyonaAktarildi`, `olusturulanIsId`, `cekildi` ve **`onaylayan`** (müşteriye senin onun
adına onayladığını gösteriyordu). Asıl risk gelecekteydi: bu kayda eklenecek her iç alan
kendiliğinden müşteriye giderdi. Artık 16 alan tek tek seçiliyor.

### 2 ⚠ Dashboard izni maaş yazabiliyordu
Sadece Dashboard açık bir hesap `personel`, `clients`, `hesaplar` dahil 11 alanı
**değiştirebiliyordu**. Dashboard bir görüntüleme ekranı — yazma izni tamamen kaldırıldı.
Okuma aynen duruyor.

### 3 ⚠ Takvim izni müşteri kaydını değiştirebiliyordu
Takvimde müşteri adı sadece gösteriliyor. `clients` yazma hakkı kaldırıldı, vergi takvimi
yazma hakkı kaldı.

### 4 ⚠ Marka adı değişince tüm içerik panelden düşüyordu
Ad değiştirilince `cekimIsleri.marka` eski adda kalıyor, eşleşme kopuyor ve o markanın bütün
içeriği müşteri panelinden kayboluyordu. Artık ad değişikliği işlere, reklamlara, tekliflere,
üyeliklere ve markalaşma süreçlerine **birlikte** taşınıyor. Sadece o markanın kayıtları
etkileniyor; boşluk farkı değişiklik sayılmıyor.

### 5 ⚠ Silinen işe bağlı içerik izsiz kayboluyordu
Operasyon kartı silinince ona bağlı içerik müşteri panelinden de kayboluyordu — müşteri revize
istemişse izi yok oluyordu. Artık bağlı iş silinmişse kayıt müşteriye geri gösteriliyor.

### 6 ℹ Müşteri silinince içerikleri sahipsiz kalıyordu
Veri kaybı değil ama hiçbir ekranda görünmüyordu. Müşteri Paneli sekmesinde artık sayılıyor.

### Bu sırada kendi hatamı da yakaladım
2. ve 3. düzeltmeyi yaparken okuma ve yazma listelerindeki satırlar birebir aynı olduğu için
değişiklik **ikisine birden** uygulandı ve Dashboard'ın okuma izni de silindi — ekran boş
kalacaktı. Bir önceki sürümle karşılaştırınca çıktı, geri alındı.

Yeni kalıcı testler: `t19.mjs` (müşteri paneli alan seçimi, 11 kontrol),
`t20.mjs` (yetki sınırları, 5 kontrol).

## Güncelleme 108: "Revize İste" Siyah Ekranı ve On Dördüncü Denetleyici

Müşteri panelinde **Revize İste**'ye basınca sayfa siyah oluyordu.

**Sebep:** Revize kutusu `inputStyle` ve `saveBtnStyle` kullanıyor ama ikisi de
**import edilmemişti**. Sayfa açılışta sorunsuz görünüyor — o blok ancak düğmeye basılınca
çiziliyor ve hata o an ortaya çıkıyor.

**Düzeltme:** İki import eklendi.

### Neden hiçbir denetleyici görmedi
On üç denetleyicinin ilgili olanı (10 numara) yalnızca `{ad...}` biçimindeki doğrudan
kullanımları yakalıyor. Buradaki kullanım ise **yayılım** içindeydi:
```
style={{ ...inputStyle, width: "100%" }}
```

### On dördüncü denetleyici
`testler/kullanimdenetle.py` — yayılım (`...ad`) ile kullanılan ama dosyada tanımlı da olmayan,
import da edilmemiş adları bulur.

Yayılım seçildi çünkü kesin sonuç veriyor: `...ad` ancak gerçek bir nesne/dizi üzerinde
yapılabilir, JSX içindeki Türkçe metinlerle karışmaz. (Daha geniş bir tarama denendi, cümle
içindeki kelimeleri kod sanıp yanlış alarm yağdırdı.)

24 dosyanın hepsinde sessiz, bozuk hâlinde ise hatayı adıyla bildiriyor.

Bu, aynı kök sebebin dördüncü yüzü: bileşen taşırken bağımlılıklar geride kalıyor. Artık
dördü de yakalanıyor — eksik import (5), tanımsız değişken (10), kapsam dışı kullanım (12),
yayılımda gelmeyen ad (14).

## Güncelleme 109: Günlük Kontrol Artık Haftalık Planla Senkron

Günlük Kontrol **stok sayılarından** çalışıyordu: "bu markanın 3 reels stoğu var" derdi ama
hangi gün paylaşılacağını bilmezdi. Haftalık Plan ise gün bazlıydı. İki ekran ayrı kaynaktan
besleniyor ve birbirini tutmuyordu.

Artık **tek kaynak var**: haftalık plan.

### Gün gün, tarih tarih
Plan kaydı `haftaKey` (haftanın pazartesisi) ve `gun` (0–6) tuttuğu için gerçek tarih
hesaplanıyor. Ekran o tarihlere göre bölünüyor:

```
GECİKENLER
  Perşembe, 13 Ağustos      0 / 1 paylaşıldı
BUGÜN
  Cumartesi, 15 Ağustos     1 / 2 paylaşıldı
SIRADAKİ GÜNLER
  Pazartesi, 17 Ağustos     0 / 1 paylaşıldı
```

Tamamlanmış geçmiş günler katlanmış duruyor, istenince açılıyor.

### Yeşile dönmemiş her kayıt burada
Planda `yapildi=false` olan her şey görünüyor. Tarihi geçmişse **"Gecikti"** (kırmızı),
bugünse **"Bekliyor"** (turuncu) yazıyor. Yanındaki düğmeyle buradan da işaretlenebiliyor.

### Ayrışma imkânsız
İşaretleme **aynı sunucu işlemini** (`haftalikToggle`) kullanıyor. Günlük Kontrol'den
işaretlediğin plana işleniyor, planda işaretlediğin burada yeşile dönüyor.

### Gece hatırlatma e-postası da düzeltildi
E-posta hâlâ eski stok mantığını kullanıyordu — ekran "bugün eksik yok" derken e-posta
"5 eksik" diyebilirdi. O da plana bağlandı ve artık **gecikmiş kayıtları da** yazıyor;
gelecek günler hatırlatılmıyor.

### Doğrulama
13 tarih/gruplama kontrolü (ay ve yıl sınırı dahil), 5 senkron kontrolü (`t21.mjs`),
5 hatırlatma süzme kontrolü. Her gün tek grupta, kaybolan kayıt yok.

## Güncelleme 110: Çözüm Ortağı — Marka Paneli

Çözüm ortağı artık atandığı markanın panelini **müşterinin gördüğü hâliyle** görüyor.

### Görünüm kopyalanmadı, veri tek yerden üretiliyor
Müşteri paneli verisini üreten kod `lib/musteri-gorunumu.js`'e taşındı. Hem müşterinin kendi
paneli hem ortağın ekranı **aynı fonksiyonu** çağırıyor ve **aynı bileşenle** çiziliyor.

Kopyalasaydık zamanla ayrışırdı — müşteri bir şey görürken ortak başka bir şey görürdü ve
"müşteri ne görüyorsa ortak da görsün" kuralı sessizce bozulurdu. Buraya eklenen her yeni alan
iki tarafa da aynı anda gidiyor.

### Ortak ne yapabilir, ne yapamaz
| | |
|---|---|
| ✓ Müşterinin gördüğü her şeyi görür | Onay bekleyenler, revize istenenler, onaylananlar, paylaşım takvimi, üretim durumu |
| ✓ İş yürütür | "Revizeyi tamamladım → kontrole gönder" |
| ✗ Müşteri adına karar veremez | Onay ve revize düğmeleri ortağa hiç çıkmaz |

Sunucu tarafında tek bir geçişe izin var: **Revize İstendi → Kontrol Bekliyor**. Başka bir
aşamaya atlamak ya da müşterinin kararını taklit etmek reddediliyor.

### Güvenlik
- İstenen marka, hesabın marka listesinde değilse **403**
- Marka listesi tarayıcıdan değil, sunucudaki hesap kaydından okunuyor
- Marka kilidi olmayan hesap bu ekranı kullanamıyor
- İç brief, kameraman adı, iç yorumlar ortağa da gitmiyor (müşteriyle birebir aynı)

### Küçük ama önemli ayrıntı
Müşteri panelindeki 20 dakikalık otomatik çıkış zamanlayıcısı ortak modunda kapalı — açık
kalsaydı ortağı kendi uygulamasından atardı.

### Doğrulama
`t22.mjs` — 17 kontrol: erişim, sızıntı, marka sınırı, yetkisiz hesap, iş yürütme ve müşteri
kararını taklit etme denemesi. Müşteri tarafının bozulmadığı ayrıca 51 mevcut kontrolle
doğrulandı.

## Güncelleme 111: Ortak Sadece İlerleyişi ve Onaylananları Görüyor

Ortağa iki sekme kaldı:

| Sekme | Ne için |
|---|---|
| **Üretim Durumu** | İşler nerede — ilerleyişi takip eder |
| **Onaylananlar (paylaşıma hazır)** | Müşterinin onayladığı içerikler |

Kaldırılanlar: Onay Bekleyenler, Revize İstediklerin, Paylaşım Takvimi, Reklamlar.

**Neden:** Ortağın işi üretimi takip edip onaylanan içeriği paylaşmak. Müşterinin karar süreci
(neyi onaylamadı, neye revize istedi) onu ilgilendirmiyor; reklam ve paylaşım takvimi de
ajans-müşteri ilişkisine ait.

Ortağın ekranı **Üretim Durumu** ile açılıyor — ilk sorusu "işler nerede?". Müşterininki
"onayımı bekleyen ne var?" olduğu için o hâlâ Onay Bekleyenler ile açılıyor.

### Paylaşabilmesi için dosya bağlantısı
Onaylanan kartlarda artık **"Dosyayı aç ↗"** düğmesi var. Önizleme tek başına yeterli değildi —
paylaşmak için dosyayı indirip yüklemesi gerekiyor.

Durum yazısı da netleştirildi: onaylanmış kartlarda **"✓ Onaylandı — paylaşılabilir"**.

### İş yürütme kaldırıldı
"Revizeyi tamamladım" düğmesi kaldırıldı — revize sekmesi ortağa artık hiç açılmıyor, düğme
ulaşılamaz hale gelmişti. Sunucudaki karşılığı (marka kontrolüyle birlikte) duruyor; ileride
ortağa iş yürütme yetkisi vermek istersen arayüzde düğmeyi geri koymak yeterli.

### Doğrulama
10 sekme daraltma kontrolü + müşteri tarafının bozulmadığı 68 mevcut kontrolle doğrulandı.

## Güncelleme 112: İkinci Tam Tarama

v108–v111 arasında eklenen yeni yüzeyler (ortak paneli, ortak veri üreticisi, Günlük Kontrol
yeniden yazımı) baştan tarandı.

### Temiz çıkanlar
- **Ortak paneli saldırı testi:** 14 tuzak alanının hiçbiri sızmıyor; bozuk `markaPaneli`
  değerleri (boş, yıldız, dizi, nesne, negatif, SQL benzeri) reddediliyor; kilitsiz hesap,
  yetkisiz hesap, müşteri hesabı ve silinmiş marka hepsi 401/403
- **Müşteri ↔ ortak ayna:** 9 alanın tamamı birebir aynı — tek kaynak iddiası doğrulandı
- **Üretim durumu:** yalnızca 8 güvenli alan taşıyor, brief ve kameraman yok
- **Günlük Kontrol:** 8 bozuk kayıt tipinin hiçbiri çökmeye yol açmıyor; 41 kaydın hepsi
  hesaplanıyor, kayıp yok
- **Yetki matrisi:** yazma/okuma tutarlı; görüntüleme ekranlarının (Dashboard, Çekim listesi,
  İçerik Akışı) yazma hakkı yok
- **Marka kilidi:** 28 alanın hepsi kapsanıyor

### Düzeltilen iki bulgu
**Ölü kod:** `toggleGunlukKontrol` v109'dan beri hiçbir yerde kullanılmıyordu — kaldırıldı.
Sunucudaki `gunlukToggle` duruyor çünkü stok düşümü ve paylaşım geçmişini o yönetiyor.

**Tarihsiz plan kaydı:** `haftaKey`'i olmayan ya da bozuk bir plan kaydı Günlük Kontrol'de
hiçbir güne düşemiyor ve sessizce kayboluyordu. Artık üstte sayısıyla uyarılıyor.

### Kendi test hatam
"Üretimdeki iş sızıyor" diye alarm verdim — yanlış varsayımdı. O kayıt Üretim Durumu
sekmesinde **görünmesi gereken** bir şey; kontrol edilmesi gereken iç alanların olmaması.
Test düzeltildi ve doğru kontrolü yapar hale getirildi.

Yeni kalıcı testler: `t23` (ortak paylaşım planlama, 9), `t24` (ortak paneli saldırı, 6),
`t25` (ayna doğrulaması, 3).

## Güncelleme 113: Açıklama Metinleri Temizlendi

Ayarlar başta olmak üzere her ekrandaki uzun bilgilendirme paragrafları kaldırıldı.
**29 paragraf silindi**, 5 tanesi tek satıra indirildi, 124 satır azaldı.

### Korunanlar
Üç şeye dokunulmadı, çünkü bunlar bilgilendirme değil:

- **Sembol açıklamaları** — "✓ tam ödendi · ½ kısmi · ✕ ödenmedi" ve paylaşım takvimindeki
  renk/harf anahtarı. Bunlar olmadan ekran okunmuyor.
- **Veri kaybı onay uyarısı** — "Kaydetmeye çalıştığın veri, mevcut kayıtlı veriden çok daha
  az içeriyor" ve devamındaki seçenekler. Bu bir güvenlik freni.
- **Kurulum bilgisi** — SITE_PASSWORD / STAFF_PASSWORD / OWNER_EMAIL nasıl tanımlanır. Tek
  cümleye indirildi ama silinmedi; silinseydi bir daha nasıl yapılacağı hiçbir yerde yazmazdı.

### Doğrulama
- 30 bölüm başlığının hepsi duruyor
- 228 düğmenin hepsi duruyor
- Hiçbir işlevsel öğe kaybolmadı (15 kritik öğe tek tek arandı)
- 14 kod denetimi + 25 sunucu test dosyası temiz

## Güncelleme 114: Tam Test + On Beşinci Denetleyici

Test edilebilen her şey test edildi.

### Sonuç
- **15 kod denetimi** temiz
- **173 sunucu kontrolü** (26 test dosyası) geçti, düşen yok
- **14 ekranın 50 işlevsel öğesi** yerinde
- **12 adımlı uçtan uca akış** çalışıyor

### Uçtan uca doğrulanan zincir
```
Yönetici iş açar → müşteri görür (iç brief gitmez) → revize ister →
revize sekmesinde notuyla görünür → ekip tamamlar → müşteri onaylar →
ORTAK onaylananı görür + dosya linkini alır → paylaşım planlar →
Günlük Kontrol'e düşer → paylaşıldı işaretler → yönetici verisi bozulmaz
```

### On beşinci denetleyici
`testler/ekrandenetle.py` — 14 ekranın olmazsa olmaz öğelerinin kodda var olduğunu doğrular.

v113'te 29 paragraf konum bazlı silinmişti; yanlışlıkla işlevsel bir öğenin gitmesi mümkündü
ve hiçbir denetleyici bunu göremezdi (kod yine geçerli olurdu). Artık her temizlikte güvenlik
ağı var.

### Test hatam
"Veri kaybı freni eksik" alarmı verdi — metnin ortasında değişken olduğu için arama tutmamıştı.
Uyarı tam ve sağlamdı; testin arama metni düzeltildi.

### Test edemediğim
Tarayıcıda tıklama. Kod düzeyinde varlık ve sunucu davranışı doğrulanabiliyor, ama bir düğmeye
basınca ekranın gerçekten çizildiğini ancak sen görebilirsin.

## Güncelleme 115: Revize Akışında Üç Geliştirme

### 1. Atanan kişiye otomatik bildirim
Müşteri revize istediğinde kimseye haber gitmiyordu; kart Operasyon'da sütun değiştiriyor ama
atanan kişi panele bakmadıkça bilmiyordu. Elle "Durum Bildirimi Gönder" düğmesi vardı, yani
hatırlamana bağlıydı.

Artık revize gelir gelmez **editöre ve kameramana** otomatik e-posta gidiyor. Kimse atanmamışsa
yöneticiye gidiyor ki iş sahipsiz kalmasın.

E-posta gönderici `lib/eposta.js`'e taşındı — aynı fonksiyon gece hatırlatmalarında da
kullanılıyordu, iki kopya olsaydı biri düzeltilip diğeri unutulurdu.

**Kritik tasarım kararı:** Bildirim başarısız olsa bile **revize kaydı geçerli kalır.**
Test edildi: RESEND_API_KEY yokken, anahtar bozukken ve kimse atanmamışken de revize
kaydediliyor. E-posta asla kaydın önüne geçmiyor.

### 2. Müşterinin notu iş kartında
Not kaydediliyordu ama **hiçbir yerde gösterilmiyordu** — editör ne isteneceğini ancak işlem
geçmişini okuyarak bulabiliyordu.

Artık kartın en üstünde, brief'ten önce, kırmızı çerçeveli bir kutuda: **"MÜŞTERİ NE İSTEDİ"**.

### 3. Revize turu sayacı
Her revize öncekinin notunu eziyordu ve kaçıncı tur olduğu hiçbir yerde görünmüyordu.

Artık `revizeSayisi` kartta tutuluyor:
- **Panoda rozet** — ikinci turdan itibaren `↻ 3` (kartı açmadan görünür)
- **Kartta** — "3. revize turu"
- **Aylık raporda** — yeni "Revize Turu" sütunu

Eski notlar işlem geçmişinde duruyor; sayaç onayla sıfırlanmıyor, müşteriye de gönderilmiyor.

### Doğrulama
`t27.mjs` — 11 kontrol: anahtar yokken/bozukken/atanmamışken kayıt geçerli, sayaç birikiyor,
onay sayacı artırmıyor, eski not geçmişte duruyor, sayaç müşteriye sızmıyor.

## Güncelleme 116: Sol Menü Gruplandı

18 satırlık düz liste 7 satıra indi.

### Gruplama
Günlük ritme göre yapıldı — hangi işi yaparken hangi ekranlara **birlikte** ihtiyaç
duyulduğuna göre, alfabetik ya da teknik benzerliğe göre değil.

```
Dashboard · Planım · Takvim          ← grupsuz, her gün açılanlar
📹 ÜRETİM      Operasyon · Çekim · Günlük Kontrol · Paylaşımlar
👥 MÜŞTERİ     Müşteriler · Müşteri Paneli · Teklif & Sözleşme · Reklamlar
💰 PARA        Finans · Ödeme Takvimi · Birikim · Üyelikler
⚙️ EKİP & SİSTEM  Personel · Şifre Kasası · Ayarlar
```

### Davranış
- **Bulunduğun grup her zaman açık** ve kapatılamaz — açık sayfayı menüde göremezsen nerede
  olduğunu kaybedersin
- Diğer gruplar tıklamayla açılıp kapanır
- Dashboard/Planım/Takvim'deyken hiçbir grup açık değil

### Değişmeyenler
Sayfa içerikleri, izinler, veri — hiçbirine dokunulmadı. Bu tamamen menünün çizildiği yerdeki
bir değişiklik.

**Personel menüsü değiştirilmedi.** Orası yan menü değil, yatay düğme sırası ve zaten izinlere
göre süzülüyor; ortak 2-4 düğme görüyor. Gruplamak fayda değil, fazladan tık getirirdi.

### Doğrulama
18 maddenin hepsi menüde, tekrar eden yok, açılma mantığı 7 senaryoda doğrulandı.
15 kod denetimi + 27 sunucu test dosyası temiz.

## Güncelleme 117: Yapay Zeka Kaldırıldı, "Bugünün Kararı" Veriye Bağlandı

### Neden
"En kârlı VİOLLA" yanlıştı — ve sebebi yapay zeka değil, **kendi hesabımızdı**. İki hata:

1. **Elle yazılmış sayıya güveniyordu.** Maliyeti girilmemiş bir müşteride `karMarji`
   alanındaki elle yazılmış yüzdeye düşüyordu. Bir kez "%90" yazılmış marka, hiçbir doğrulama
   olmadan birinci çıkıyordu.
2. **Yüzdeye göre sıralıyordu, tutara göre değil.** ₺5.000 alıp ₺500 harcanan müşteri (%90),
   ₺50.000 alıp ₺15.000 harcanandan (%70) önce geliyordu — oysa ikincisi ₺35.000 kazandırıyor,
   birincisi ₺4.500.

### Yeni kârlılık hesabı
`musteriKarlilik()` artık **tutar** üretiyor: gelir − elle girilen maliyet − o markaya ait
freelancer iş ücretleri − reklam bütçesi.

Freelancer ücretleri `markaAylikIsMaliyeti()` ile hesaplanıyor ve personel raporuyla **aynı
ücret fonksiyonunu** kullanıyor — ayrı yazılsaydı iki ekrandaki rakam birbirini tutmazdı.

### Kendi kendini denetliyor
Veri yetersizse **sayı uydurmuyor**. "VİOLLA — maliyet girilmemiş" diyor ve o müşteriyi
sıralamaya hiç almıyor. Ücreti tanımsız kişi varsa onu da bildiriyor.

### Bugünün Kararı — kural tabanlı
Dashboard'da tek kart, model çağırmıyor, maliyeti sıfır:
- En çok kazandıran müşteri (tutarla)
- Zarar ettiren ya da marjı %30 altındaki müşteri
- Kârın %40+'ı tek müşteriden geliyorsa bağımlılık uyarısı
- Kârı hesaplanamayan müşteriler ve eksiğin ne olduğu
- Geciken paylaşımlar · 3+ revize alan içerikler · bekleyen tahsilatlar

### Kaldırılanlar
AI CEO sohbet paneli, AI özet kartı, sabah AI özeti e-postası, `api/chat.js`,
`api/daily-summary.js` ve cron kaydı.

**Serverless slot 12/12 → 10/12.** İki slot açıldı; artık yeni bir uç nokta eklenebilir.

### Doğrulama
7 kârlılık mantığı kontrolü (yüzde-tutar çelişkisi, eksik veri, birleşik maliyetler),
Dashboard'ın 6 KPI kartı korundu, 15 kod denetimi ve 27 sunucu test dosyası temiz.

## Güncelleme 118: Veri Bütünlüğü Kontrolü

v117'de büyük bir silme yapıldı (AI kodu, iki uç nokta). Verinin etkilenip etkilenmediği
baştan sona test edildi.

### Sonuç: veri güvende
| Kontrol | Sonuç |
|---|---|
| 31 veri alanının hepsi okunuyor | ✓ |
| Kayıt sonrası alan kaybı yok | ✓ |
| Boş veri yazımı engelleniyor (409) | ✓ |
| Günlük yedek alınıyor | ✓ |
| Yedek 31 alanın hepsini içeriyor | ✓ |
| Geri dönüşüm kutusu duruyor | ✓ |
| 28 test dosyası, düşen yok | ✓ |

### Silinen kod veriye dokunmuyordu
`api/chat.js` ve `api/daily-summary.js` yalnızca **okuyup** e-posta gönderiyordu; hiçbir veri
yazmıyorlardı. Yeni kârlılık hesabı da salt okunur — hesaplar ekranda yapılıyor, kayda
yazılmıyor.

Gece yedeği (03:00) ve hatırlatma cron'u yerinde; yalnızca AI özeti cron'u kaldırıldı.

### Test hatam (üçüncü kez)
"Yedek tüm alanları kapsamıyor" alarmı verdim. `api/backup.js` GET isteği veriyi değil
**mevcut yedeklerin listesini** döndürüyor; anlık görüntüyü `daily-backup` üretiyor. Testim
yanlış uç noktaya bakıyordu. Gerçek akış (yedek al → listele → içeriği doğrula) test edildi
ve sorunsuz.

Yeni kalıcı test: `t28.mjs` — 9 kontrol.

## Güncelleme 119: Gerçek Logo — Her Yerde, Değiştirilebilir

Link gönderildiğinde mavi "M" simgesi görünüyordu. Sebebi: uygulama içi logo veriden geliyordu
ama **tarayıcı simgesi, telefon simgesi ve link önizlemesi sabit dosyalardan** geliyordu.

Ayrıca link önizleme etiketleri (og:) **hiç yoktu** — paylaşılan bağlantı çıplak görünüyordu.

### Çözüm: /api/logo
Ayarlar > Marka Kimliği'ne yüklenen logo veride base64 olarak duruyor; tarayıcı ve WhatsApp
bunu okuyamaz, gerçek bir görsel adresi isterler. Yeni uç nokta kayıtlı logoyu **normal bir
resim gibi** sunuyor.

Sonuç: logoyu Ayarlar'dan değiştirdiğinde **her yer birden güncellenir** — dosya değiştirmeye
ya da yeniden yayına almaya gerek yok.

| Nerede | Öncesi | Şimdi |
|---|---|---|
| Tarayıcı sekmesi | mavi M | senin logon |
| Telefon ana ekranı | mavi M | senin logon |
| WhatsApp/Slack önizleme | yoktu | başlık + logo kartı |
| Yönetici paneli başlığı | mavi M | senin logon |
| Personel paneli başlığı | mavi M | senin logon |
| Müşteri paneli | zaten logo | değişmedi |

Logo yüklenmemişse hepsi varsayılan M rozetine düşüyor — hiçbir yerde boşluk kalmıyor.

### Güvenlik
Uç nokta **şifresiz** olmak zorunda: link önizlemesini oluşturan WhatsApp/Slack sunucuları
giriş yapamaz. Bu bir açık değil — yalnızca logo dönüyor.

Test edildi: şifre kasası ve personel verisi yanıtta yok, yalnızca görsel baytları dönüyor.
Bozuk değer, eksik logo ve veri yokluğunda çökmüyor; POST reddediliyor.

### Slot durumu
12/12 → 10/12 (v117) → **11/12**. Bir slot payı kaldı.

### Doğrulama
`t29.mjs` — 10 kontrol. 15 kod denetimi + 29 test dosyası temiz.

## Güncelleme 120: Müşteriler Siyah Ekran + On Altıncı Denetleyici

### Hata
Müşteriler sekmesi siyah ekran veriyordu. Sebep: v117'de App.jsx eski bir kopyadan geri
yüklenirken **CLIENT_FIELDS ve CLIENT_DURUM sabitleri kesilmiş.** İkisi de Müşteriler
ekranının olmazsa olmazı — biri müşteri formunun alanlarını, diğeri durum etiketlerini
tanımlıyor.

Kod sözdizimi olarak geçerliydi; hata ancak o sekme açıldığında ortaya çıkıyordu.

**Düzeltildi** — iki sabit önceki sürümden geri alındı.

### Neden 15 denetleyicinin hiçbiri görmedi
- **10 (tanımsız değişken)** yalnızca küçük harfli adlara bakıyor
- **12 (kapsam dışı)** bir bileşende tanımlı olup başkasında kullanılanı arıyor; burada ad
  **hiçbir yerde** tanımlı değildi
- **5 (eksik bileşen)** yalnızca `<Bileşen>` biçimindekileri kapsıyor

`testler/sabitdenetle.py` eklendi: BÜYÜK_HARFLİ sabitlerin tanımlı olduğunu doğrular.
Her iki sabit için ayrı ayrı test edildi, temiz dosyalarda susuyor.

Bilinen yanlış alarmlar (OKUBENI'ye eklendi): CEO, KAPALI, KDV, PDF, CSV, API — hepsi JSX
metninde geçen Türkçe kelimeler, kod değil.

### Tam sistem taraması — sonuç
| Alan | Sonuç |
|---|---|
| 16 kod denetimi | temiz |
| 29 test dosyası | düşen yok |
| Marka kilidi kapsamı | 25 alanın hepsi kapsanıyor |
| Ortak paneli sızıntı testi | 14 tuzak alanı, sızıntı yok |
| Yeni logo uç noktası | yalnızca görsel baytları dönüyor |
| Yedek kapsamı | tüm blok kopyalanıyor, alan listesi yok → yeni alanlar kendiliğinden dahil |

**Yedek alınmayan yer bulunamadı.** daily-backup veriyi alan alan değil bütün olarak
kopyaladığı için, ileride eklenecek her alan otomatik olarak yedeğe girer.

## Güncelleme 121: Maliyeti Girilmemiş Markalar %100 Marjla Hesaplanıyor

14 marka "kârı hesaplanamıyor" diye sıralamanın dışında kalıyordu. Artık hesaba giriyorlar.

### Neden bu doğru
Sistemdeki maliyetler **doğrudan** maliyetlerdir: elle girilen kalemler, o markaya ait
freelancer iş ücretleri, reklam bütçesi. **Maaşlı ekibin zamanı hiçbir müşteriye
dağıtılmıyor** — hiçbiri için.

Dolayısıyla doğrudan maliyeti olmayan bir markanın marjı gerçekten %100'dür: o iş maaşlı
ekiple yapılmış demektir.

### Ama işaretleniyor
Bu, kendi ekiple çalışılan markaları freelancer'la çalışılanlardan kârlı gösterir. Hata değil,
maaşın müşterilere dağıtılmamasının sonucu — ama karar verirken bilinmeli.

Bu yüzden:
- En çok kazandıran o markaysa adının yanına **\*** konur ve altında sebebi yazar
- Ayrı bir satır: **"3 markada doğrudan maliyet girilmemiş — %100 marjla hesaplandı"**,
  isimleri ve tutarlarıyla
- Uyarı metni açıkça söyler: freelancer'la çalıştığın markalar yanlarında daha az kârlı görünür

### Hesaba hiç girmeyenler
Yalnızca **aylık ücreti girilmemiş** müşteriler dışarıda kalıyor — onlarda hesaplanacak bir
gelir yok. Ayrı bir satırda isimleriyle listeleniyor.

### Doğrulama
9 kârlılık kontrolü + gerçek veriye yakın bir senaryoyla sıralama simülasyonu.
16 kod denetimi ve 29 test dosyası temiz.

## Güncelleme 122: Üç Ayrı Marka Görseli

Tek logo alanı üç farklı iş yapmaya çalışıyordu; üçünün ihtiyacı gerçekten farklı.

Ayarlar > Görünüm & Marka > Marka Kimliği artık üç alan:

| Alan | Ölçü | Nerede kullanılır |
|---|---|---|
| **Kare logo** | kare, şeffaf PNG | Tarayıcı sekmesi, telefon ana ekranı, panel başlığı |
| **Paylaşım görseli** | yatay, 1200×630 | WhatsApp/Slack'te bağlantı paylaşınca çıkan kart |
| **Açık zemin logosu** | kare | Müşteri paneli (açık zeminli) |

### Neden ayrı
**Paylaşım görseli:** WhatsApp kare bir logoyu minik ikon olarak gösterir. Tam genişlikte kart
için yatay görsel gerekiyor. Etiket de `summary` yerine `summary_large_image` yapıldı.

**Açık zemin logosu:** Müşteri paneli açık zeminli, uygulama koyu. Koyu zemin için yapılmış bir
logo orada kaybolabilir ya da göze batabilir.

### Boş bırakılabilir
Her alan kendi görseli yoksa **kare logoya** düşer, o da yoksa varsayılan simgeye. Hiçbir yerde
boşluk kalmaz — yani sadece kare logo yükleyip devam edebilirsin.

### Paylaşım kartı metni
Sabit ama düzgün yazıldı:
> **Marcus Medya — İçerik Onay Paneli**
> Hazırladığımız içerikleri buradan inceleyip onaylayabilir ya da değişiklik isteyebilirsiniz.

Değiştirmek istersen söyle, tek satırlık iş.

### Doğrulama
`t30.mjs` — 10 kontrol: üç görsel ayrı ayrı dönüyor, eksik olanlar kare logoya düşüyor,
hiçbiri yoksa varsayılan, müşteri paneli açık zemin logosunu alıyor, yeni alanlar personele
sızmıyor. 16 kod denetimi + 30 test dosyası temiz.

## Güncelleme 123: Önerilen Ölçüler Kalıcı Olarak Görünüyor

Ölçü bilgisi yükleme kutusunun İÇİNDEydi, yani yalnızca kutu boşken görünüyordu. Görsel
yüklenince kayboluyor ve "bu neydi?" sorusu cevapsız kalıyordu.

Ölçüler artık kutunun **altında**, kalıcı:

- **Kare logo** — 512×512 px · şeffaf PNG · uygulama simgesi, telefon ana ekranı, panel başlığı
- **Paylaşım görseli** — 1200×630 px · yatay · WhatsApp/Slack'te bağlantı paylaşınca çıkan kart
- **Açık zemin logosu** — 512×512 px · şeffaf PNG · müşteri paneli açık zeminli, boş bırakırsan
  kare logo kullanılır

Kutu içindeki metin sadeleşti: "Görsel yüklemek için tıkla".

## Güncelleme 124: Logolar Büyütüldü + Zemine Göre Otomatik Uyum

### Boyut
Müşteri panelindeki marka bandında logolar 34px'ti ve kaybolup gidiyordu:

| | Öncesi | Şimdi |
|---|---|---|
| Müşteri paneli logoları | 34 px | **52 px** |
| Monogram (logo yoksa) | 34 px | 52 px |
| Yönetici/personel paneli başlığı | 30-32 px | 38 px |

### Açık renkli logo artık kaybolmuyor
Müşteri paneli açık zeminli. Beyaz ya da açık gri bir logo orada görünmez oluyordu.

Sistem artık logonun parlaklığını **ölçüyor**: görseli küçük bir tuvale çizip saydam olmayan
piksellerin ortalama parlaklığına bakıyor. Açık renkliyse (parlaklık > 170) arkasına koyu bir
zemin koyuyor; koyu logolara dokunmuyor — zaten görünüyorlar.

**Saydam pikseller sayılmıyor.** Bu şart: çoğu logo saydam zeminli PNG ve onlar da sayılsaydı
her logo "açık" çıkar, hepsine gereksiz koyu zemin eklenirdi.

Drive bağlantılı müşteri logolarında tarayıcı güvenlik kuralları piksel okumayı engelliyor —
o durumda ölçüm yapılmıyor ve zemin eklenmiyor, yani mevcut davranış korunuyor.

### Doğrulama
8 parlaklık senaryosu: beyaz, siyah, mor, saydam zeminli beyaz, saydam zeminli siyah, tamamen
saydam, açık gri, orta gri. 16 kod denetimi + 30 test dosyası temiz.

## Güncelleme 125: Menü Yeniden Düzenlendi

```
Dashboard  (Planım artık burada)
Şifre Kasası
📹 ÜRETİM       Operasyon · Çekim · Günlük Kontrol · Paylaşımlar
👥 MÜŞTERİ      Müşteriler · Müşteri Paneli · Teklif & Sözleşme · Reklamlar
💰 PARA         Finans · Ödeme Takvimi · Personel · Birikim · Üyelikler
⚙️ SİSTEM       Ayarlar
```

### Planım → Dashboard
Kişisel görevlerin ve Onayını Bekleyenler kutusu artık Dashboard'ın altında. Ayrı sekmede
dururken her sabah iki yere bakmak gerekiyordu.

Bekleyen iş sayacı da Dashboard'a taşındı — sekmeye girmeden görünüyor.

### Takvim kaldırıldı
Hem yönetici hem personel tarafından, bileşeniyle birlikte.

**Veri kaybı yok:** Takvim yalnızca bir görünümdü. Vergi kayıtları **Finans** sekmesinden
düzenlenmeye devam ediyor, müşteri ödeme günleri **Ödeme Takvimi**'nde. Kaldırılmadan önce
kontrol edildi.

Yetki listesinden de çıkarıldı, artık kimseye verilemiyor.

### Personel → Para
Maaş, avans ve ödemelerle ilgili olduğu için Para grubunda daha doğru yerde.

### Şifre Kasası üst seviyede
Gruptan çıkarıldı — tek başına ve sık açılan bir ekran, bir tık daha eklemenin anlamı yoktu.

Menü artık **6 satır** (önce 7, başlangıçta 18).

### Doğrulama
16 menü maddesinin hepsi kapsanıyor, kapsanmayan yok. 16 kod denetimi + 30 test dosyası temiz.

## Güncelleme 126: Menü Sırası

Kullanıcının istediği sıra:

```
Dashboard
👥 MÜŞTERİ      Müşteriler · Müşteri Paneli · Teklif & Sözleşme · Reklamlar
💰 PARA         Finans · Ödeme Takvimi · Personel · Birikim · Üyelikler
📹 ÜRETİM       Operasyon · Çekim · Günlük Kontrol · Paylaşımlar
⚙️ SİSTEM       Ayarlar
🔑 Şifre Kasası
```

Şifre Kasası grupların üstündeydi, artık en altta ve gruplu değil — tek başına bir madde
olarak duruyor.

16 menü maddesinin hepsi hâlâ kapsanıyor, kapsanmayan yok. Tanıtım dosyası da güncellendi.

## Güncelleme 127: Menü Yerleşimi + Kapanmama Hatası

```
Dashboard
👥 MÜŞTERİ      Müşteriler · Teklif & Sözleşme · Reklamlar
💰 PARA         Finans · Ödeme Takvimi · Personel · Birikim · Üyelikler
📹 ÜRETİM       Operasyon · Çekim · Günlük Kontrol · Paylaşımlar · Müşteri Paneli
🔑 Şifre Kasası
⚙️ Ayarlar
```

Müşteri Paneli **Üretim**'e taşındı — içerik akışının son halkası orası. Ayarlar tek başına
en altta, artık grup değil; Sistem grubu tamamen kalktı.

### Kapanmama hatası
İçinde bulunduğun grup **kilitliydi** — bilerek koymuştum ("açık sayfayı menüde göremezsen
nerede olduğunu kaybedersin"). Ama pratikte bu, tıklayınca kapanmayan bir menü demekti ve
gerekçem kullanıcının işine engel oluyordu.

Artık **her grup kapanabiliyor.** Yerini kaybetmemen için: grup kapalıyken başlığı vurgulanıyor
ve **altında açık olduğun sayfanın adı yazıyor**. Yani menüyü toplayabiliyorsun ama nerede
olduğunu yine görüyorsun.

Elle kapattığın grup, o sekmedeyken bile kapalı kalıyor; tekrar tıklayınca açılıyor.

### Doğrulama
12 senaryo: aktif grubun kapanması, tekrar açılması, başka grubun açılıp kapanması, elle
kapatılmışken davranış, Dashboard'da hiçbir grubun açılmaması, yeni yerleşim. 16 kod denetimi
+ 30 test dosyası temiz.

## Güncelleme 128: Görsel Sadeleştirme (dört adım)

### 1. Yazı ölçeği — 10 boyut → 5
Öncesi: 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 14.5 · 15 · 16 · 17 · 18 · 20 · 22 · 28

Sonrası: **11** (etiket) · **13** (gövde) · **15** (vurgulu) · **20** (başlık) · **28** (rakam)

Birbirine bu kadar yakın değerler hiyerarşi kurmuyor, sadece göz yoruyordu — 12 ile 12.5
arasındaki fark okunmuyor ama beyin "bunlar farklı mı?" diye uğraşıyor. 691 yer düzenlendi.

### 2. Kart dolgusu — 8+ değer → 3
**6×10** (rozet) · **12×15** (liste satırı) · **18×22** (kart). 353 yer düzenlendi.
Geniş düğmelerin yatay dolgusu korundu, yoksa metin sıkışırdı.

### 3. Genişlik kullanımı
Ayarlar 560px'e sıkışmıştı, geniş ekranda sağın yarısı boştu. Kartlar artık iki sütuna
yayılıyor, dar ekranda tek sütuna düşüyor.

### 4. Dashboard hiyerarşisi
Altı kart eşit ağırlıktaydı — ₺480.000 ciro ile ₺225.000 bekleyen tahsilat aynı önemde
görünüyordu, oysa biri sonuç biri uyarı.

Artık **Toplam Ciro** ve **Net Kazanç** üstte büyük (40px rakam), diğer dördü altta destek
satırında.

### Doğrulama
v127 ile birebir karşılaştırıldı: 28 bölüm başlığı, 221 düğme, 78 kart, 39 KPI kartı —
hiçbiri değişmedi, kaybolan başlık yok, etiket dengeleri aynı. 16 kod denetimi + 30 test
dosyası temiz.

### Not
Bu çalışmaya başlarken çalışma klasöründeki dosyaların benim dışımda değiştirildiği görüldü.
Kaynağı doğrulanamadığı için v127 paketine dönülüp tüm işlem baştan yapıldı.

## Güncelleme 129: Maliyet Uyarısı Kaldırıldı

"14 markada doğrudan maliyet girilmemiş — %100 marjla hesaplandı" satırı kaldırıldı. En çok
kazandıran markanın yanındaki **\*** işareti de.

**Gerekçe:** Maliyet girilmemiş olması eksik veri değil, bilgidir. O iş maaşlı ekiple yapılmış
demektir ve marjı gerçekten %100'dür. Kullanıcıyı maliyet girmeye zorlamak yanlıştı.

Bu markalar sıralamaya normal şekilde giriyor, sadece artık uyarı üretmiyorlar.

### Kaldırılmayanlar
- **"X marjı düşük (%0)"** — bu uyarı doğru: o markada gerçek bir freelancer iş maliyeti var
  ve gelirin tamamını yiyor. Kontrol edildi, yerinde duruyor.
- **"Aylık ücreti girilmemiş"** — bu gerçekten eksik veri; o müşteride hesaplanacak gelir yok.

## Güncelleme 130: Menü ve Düğmeler Yeniden Nefes Aldı

v128'de dolgular üç basamağa indirilirken **tıklanabilir öğeler dar basamağa düştü** ve
sıkıştı. Kullanıcı bunu menüde fark etti: "bu yazı büyüklüğü ve tıkladığında beyaz gözükmesi
ile çok daha güzeldi".

### Menü
| | v128 | Şimdi |
|---|---|---|
| Yazı | 13 px | **15 px** |
| Dolgu | 6×10 | **12×15** |
| İkon | 16 px | 18 px |
| Aktif madde | 600 ağırlık | **700 ağırlık, beyaz** |

Menü kalabalık bir liste değil, az sayıda büyük hedef — ölçeğin üst basamağında olmalı.

### Aynı sorun 36 yerde daha vardı
Düğmeler ve sekmeler de 6px'e düşmüştü. Kural eklendi: içinde `cursor: pointer` olan bir öğe
dar basamakta kalamaz, orta basamağa (12×15) çıkar. Salt görsel rozetler 6×10'da kalır.

Dolgu ölçeği hâlâ üç basamak, yazı ölçeği hâlâ beş basamak — sadeleştirme bozulmadı.

### Ders
Ölçek kurarken "ne kadar küçülebilir" değil, **öğenin ne işe yaradığı** belirleyici olmalı.
Rozet küçülebilir, tıklanan şey küçülemez.

## Güncelleme 131: Müşteriler Ekranı Yeniden Düzenlendi

### Sıra değişti
Önce: dokuz satırlık ödenmeyen listesi → sonra KPI'lar → sonra müşteri listesi.
Ekranın tamamını uyarı kaplıyor, asıl sayılar aşağıda kalıyordu.

Şimdi: **KPI'lar en üstte** → ödenmeyen ödemeler (katlanmış) → müşteri listesi.

### Ödenmeyen ödemeler katlanabilir
Kapalı başlıkta **sayı ve toplam tutar** duruyor, yani açmadan da durumu görüyorsun.
Varsayılan kapalı; tıklayınca liste açılıyor.

### Müşteri Hesapları ayrı sekme
`MÜŞTERİ → Müşteriler → Müşteri Hesapları`

Panel giriş hesapları müşteri listesinin altındaydı; sayfa uzuyor ve iki ayrı iş karışıyordu.
Artık kendi sekmesinde.

### Doğrulama
9 "Tebliğ Oluştur" düğmesi, 5 KPI kartı, 9 ödenmemiş satır — hepsi korundu. 16 kod denetimi +
30 test dosyası temiz.

### Not
Katlanabilir başlıkta kullandığım AlertTriangle ikonu import edilmemişti — beşinci denetleyici
yakaladı. Tam da bunun için var.

## Güncelleme 132: Gereksiz Boşluklar Toplandı

### Tek başına kalan kartlar
Bir ya da iki küçük rakam için KpiCard fazla geliyordu: tek kart koca bir satır kaplayıp
sağında bomboş alan bırakıyordu ("AÇIK NOT 3" gibi).

Yeni `SayacRozetleri` bileşeni — rakam + etiket, yan yana küçük rozetler:

```
 3 açık not   1 tarihi geçti   2 bugün
```

Üç ekranda uygulandı: Dashboard (Planım sayaçları), Çekim, Müşteri Paneli. Beş KpiCard rozete
dönüştü, hiçbir sayı kaybolmadı.

### Yan menü başlığı
"Marcus Medya App" iki satıra kayıyordu → tek satır, "Marcus Medya".

### Dikey boşluklar
Bölümler arası 22px → 14px, kart araları 14px → 12px.

### Doğrulama
7 sayacın hepsi yerinde, 16 kod denetimi + 30 test dosyası temiz.

### İlke
Sayfayı doldurmak amaç değil. Küçük bir rakam küçük bir yer kaplamalı; kart formatı onu
büyütmüyor, sadece etrafında boşluk yaratıyor.

## Güncelleme 133: Yan Menü Genişletilebilir

### Sürüklenebilir kenar
Menünün sağ kenarına tutma alanı eklendi. İmleç üzerine gelince `col-resize`'a dönüşüyor,
sürükleyerek genişletiyorsun.

- Sınırlar: **180 – 420 px** (varsayılan 220)
- Genişlik **cihazda hatırlanıyor** — her açılışta yeniden ayarlamak gerekmiyor
- **Çift tıklayınca** varsayılana döner
- Dokunmatik ekranda da çalışır
- Mobilde kol görünmez (menü zaten tam ekran açılıyor)

### Asıl sorun: yazıların alta kayması
Genişletme tek başına yetmezdi. "Müşteri Hesapları" ve "Teklif & Sözleşme" iki satıra kayıp
menüyü zıplatıyordu.

Menü yazıları artık **tek satırda** kalıyor; sığmazsa `...` ile kısalıyor ve üzerine gelince
tam adı görünüyor. Tamamını kalıcı görmek istersen menüyü genişletiyorsun.

Grup başlıkları ve alttaki yedek durumu kutusu da aynı şekilde taşmıyor.

### Doğrulama
9 kontrol: sürükleme sınırları (180'de ve 420'de durma), negatif değer, ondalık yuvarlama,
bozuk/sınır dışı kayıtta varsayılana dönme. 16 kod denetimi + 30 test dosyası temiz.

## Güncelleme 134: "7 Lezzet marjı %0" — Reklam Bütçesi Hatası

Net tam ₺0 çıkması tesadüf değildi. İki hata vardı, ikisi de kâr hesabında:

### 1. Reklam bütçesi ajansın gideri sayılıyordu
Reklam bütçesi **müşterinin harcamasıdır** — ajans kampanyayı yönetir, parayı müşteri öder.
Gider sayılınca kâr haksız yere sıfırlanıyordu:

```
7 Lezzet: gelir ₺35.000 − kampanya bütçesi ₺35.000 = net ₺0  ← yanlış
7 Lezzet: gelir ₺35.000 − gerçek maliyet ₺0      = net ₺35.000  ← doğru
```

### 2. Tarih filtresi yoktu
Markaya ait TÜM kampanyaların bütçesi toplanıyordu. Aylar önceki bir kampanya bu ayın
kârından düşüyordu.

### Düzeltme
Reklam bütçesi kâr hesabından tamamen çıkarıldı. `musteriKarlilik`'in `reklamButcesi`
parametresi duruyor ama varsayılanı 0 ve açıklamasına "öyle kalmalı" notu eklendi.

**Ajans reklam parasını kendi cebinden ödüyorsa** doğru yer Müşteri > Maliyetler kalemi —
orası zaten hesaba katılıyor.

### Değişmeyenler
Freelancer iş ücretleri ve elle girilen maliyetler hâlâ sayılıyor. Smell Coffee gibi gerçek
maliyeti olan markaların rakamları aynı kaldı.

## Güncelleme 135: Dashboard Sadeleşti, Planım Geri Ayrıldı

```
Dashboard    → Bugünün Kararı + 6 finansal kart. Başka hiçbir şey yok.
Planım       → kişisel görevler + Onayını Bekleyenler kutusu
```

v125'te Planım'ı Dashboard'a taşımıştım ("her sabah iki yere bakmak gerekiyordu" diye). Ama
sonuç Dashboard'ı uzattı: finansal durum ile yapılacak işler farklı iki soru —
**"işler nasıl gidiyor"** ve **"benim ne yapmam gerekiyor"**. Aynı ekranda birleşince ikisi de
zayıfladı.

Planım sol menüde, Dashboard'ın hemen altında. Bekleyen iş sayacı da oraya döndü — sekmeye
girmeden görünüyor.

Dashboard içeriği doğrulandı: KararSeridi + 6 KpiCard, başka bileşen yok.

## Güncelleme 136: Finans Yerleşimi + Gider Dağılımı

### Yerleşim
Altı kart eşit ağırlıktaydı, göz nereye bakacağını bilmiyordu.

Şimdi iki ana rakam üstte büyük — **NAKİT AKIŞI** (bu ay ne kazandın) ve **KASADA BULUNAN**
(şu an elinde ne var). Ciro, KDV, tahsilat oranı ve bekleyen ödeme altta destek satırında.

"Kasada bulunan" yeni: tüm hesapların bakiyesi toplamı. Bakiye saklanmıyor, her seferinde
hesaplanıyor — geri almaların güvenli olmasının sebebi bu.

### Gider Dağılımı kartı
"Toplam gider ₺250.690" tek rakamdı, neyin toplamı olduğu görünmüyordu. Artık kalem kalem:

```
Personel                    ₺92.000
   Maaş                     ₺70.000
   SGK / sigorta            ₺14.000
   Yemek                     ₺6.000
   Kıdem tazminatı           ₺2.000
Ofis gideri                 ₺16.500
Müşteri maliyetleri          ₺9.000
Üyelikler                      ₺600
Diğer gider kalemleri        ₺3.200
─────────────────────────────────────
Toplam gider               ₺121.300
```

Sıfır olan kalemler hiç gösterilmiyor — boş satır kalabalığı olmuyor.

### Muhasebe değişmedi
Maaş, sigorta, yemek ve kıdem tazminatı **zaten** toplam gidere dahildi; sadece görünmüyordu.
Toplamın birebir aynı kaldığı ayrıca doğrulandı: dağılım toplamı = toplam gider, personel alt
kalemleri = personel gideri.

## Güncelleme 137: Finans Beş Sekmeye Ayrıldı

Bir muhasebe programı gibi görünüyordu. Artık bir işletme sahibinin kontrol paneli.

### Yeni dosya: src/finans.jsx (777 satır)
App.jsx 8.953 → 8.237 satır. Taşınanlar: `Finans`, `MiniList`, `Karsilastirma`,
`HesapBakiyeleri`, `hesapBakiyesi` ve beş alan tanımı — hepsi **birebir**, içlerine
dokunulmadan.

### Sekmeler
| Sekme | İçerik |
|---|---|
| **Özet** | 4 ana KPI · Bu Ay kartı · tahsilat çubuğu · Para Nereye Gidiyor? · Paralarım toplamı |
| **Gelir-Gider** | Gelirler · Giderler · Ofis Giderleri · Faturalı İşler |
| **Hesaplar** | Banka hareketleri, transfer, bakiye düzeltme |
| **Vergi & Arşiv** | Vergi Takibi · Geçmiş Aylar · CSV · Ay kapatma |

### Dört ana rakam
KASADA · BU AY KAZANÇ · TAHSİL EDİLECEK · BU AY GİDER

Ciro, KDV, faturalı ciro ve tahsilat oranı silinmedi — Bu Ay kartına indi.

### Arayüz dili
Nakit Akışı → **Bu Ay Kazanç** · Kasada Bulunan → **Kasada** · Bekleyen Ödeme →
**Tahsil Edilecek** · Gider Dağılımı → **Para Nereye Gidiyor?** · Hesap Bakiyeleri →
**Paralarım**

### Bekleyen Tahsilatlar → Ödeme Takvimi
Kullanıcının isteğiyle Finans'tan çıktı. Silinmedi, **taşındı** — ekleme ve silme işlevleri
korundu, mevcut kayıtlara erişim sürüyor.

### İki işlev artık gerçekten çalışıyor
`onExport` (CSV) ve `onCloseMonth` (ay kapatma) v136'da Finans'a prop olarak geçiyor ama
**hiçbir düğmeye bağlı değildi** — yani erişilemiyorlardı. Vergi & Arşiv sekmesine
"Arşiv İşlemleri" kartı eklendi.

### HESAPLAMA MOTORUNA DOKUNULMADI
`tema.jsx` değiştirilmedi. Aynı veriyle v136 ve v137 karşılaştırıldı:

**computeLive'ın döndürdüğü 24 değerin hepsi birebir aynı** — ciro, KDV, gider, net,
tahsilat, personel gideri, bekleyen toplam dahil.

21 finans işlevinin hepsi bağlı, 9 bölümün hepsi erişilebilir. 16 kod denetimi + 30 test
dosyası temiz.

## Güncelleme 138: Derleme Hatası Düzeltildi + Denetleyici 3 Yeniden Yazıldı

### Hata
v137 Vercel'de derlenmedi:
```
src/finans.jsx:443:8: ERROR: The symbol "kasaToplami" has already been declared
```

Finans'ı taşırken `kasaToplami`'yi iki kez tanımlamışım — biri v136'da eklediğim ve taşınan
blokta zaten var olan, diğeri yeni yazdığım. Fazlalık kaldırıldı.

### Denetleyici 3 neden görmedi
Eski sürüm yalnızca **"3 satır içindeki"** tekrarlara bakıyordu. İki tanımım 4 satır aralıklıydı.

Yeniden yazıldı: artık **süslü parantez derinliğini takip eden bir kapsam yığını** kullanıyor.
Bir ad yalnızca içinde bulunduğu blokta tekrar tanımlanmışsa hata veriyor.

**İlk denemem yanlıştı:** fonksiyon bloklarına bölüp mesafe sınırını kaldırdım, 90'dan fazla
yanlış alarm verdi — çünkü farklı `if`/`for` bloklarında aynı adı kullanmak JavaScript'te
tamamen geçerlidir. Doğru kural blok kapsamı; öyle uygulandı.

Doğrulandı: 24 dosyada sessiz, v137'nin bozuk hâlini satır numarasıyla yakalıyor.

### Ders
Bir denetleyiciyi genişletirken dilin gerçek kuralına bakmak gerekiyor. "Daha geniş ara"
demek yeterli değil — neyin gerçekten hata olduğunu bilmek gerekiyor.

## Güncelleme 139: Siyah Ekranlar — Dört Hata + On Yedinci Denetleyici

v137'de Finans yeni dosyaya taşınırken **dört ad geride kaldı.** Hepsi siyah ekran demekti.

| Ad | Sorun | Etkilenen ekran |
|---|---|---|
| `fmtShort` | finans.jsx'te kullanılıyor, import edilmemiş | Finans |
| `iconBtnStyle` | finans.jsx'te kullanılıyor, import edilmemiş | Finans |
| `bekleyenFields` | App.jsx'te kullanılıyor, tanımı finans.jsx'te kaldı | Ödeme Takvimi |
| `hesapBakiyesi` | App.jsx'te kullanılıyor, export edilmemişti | CSV dışa aktarma |

Dördü de düzeltildi: iki import eklendi, `hesapBakiyesi` export edildi, `bekleyenFields`
Ödeme Takvimi içinde yeniden tanımlandı (Finans'takiyle aynı mantık).

### On altı denetleyici neden göremedi
- **5** yalnızca `<Bileşen>` biçimini kapsıyor
- **10** ve **12** tek dosya içinde bakıyor
- **16** yalnızca BÜYÜK_HARFLİ sabitlere bakıyor
- **9** "import edilen ad kaynağında var mı" diye soruyor — **"kullanılan ad import edilmiş mi"
  diye sormuyor**

### testler/erisimdenetle.py
Tersini sorar: JSX'te `prop={ad}` olarak kullanılan her ad, o dosyada tanımlı mı ya da import
edilmiş mi?

**İlk sürümü bir hatayı kaçırdı:** ok fonksiyonu parametre kalıbı (`(...) =>`) JSX gövdesinin
tamamını parametre listesi sanıp içindeki her adı "tanımlı" kabul ediyordu. Kalıp tek satırla
ve JSX içermeyecek şekilde daraltıldı.

Doğrulandı: temiz dosyalarda sessiz, üç hatanın üçünü de adıyla yakalıyor.

### Ders
Dosya bölmek bu projede tekrar eden en riskli işlem — v81, v91, v108, v120 ve şimdi v137.
Her seferinde "bağımlılık geride kaldı" ile bitiyor. Artık beş yüzü de denetleniyor:
eksik import (5) · tanımsız değişken (10) · kapsam dışı (12) · yayılım (14) · sabit (16) ·
**erişilemeyen ad (17)**.

## Güncelleme 140: Özet Sekmesi Düzeni

### Ay adı
"ağu 2026" → **"Ağustos 2026"**. Grafik eksenlerindeki kısaltmalar (`TR_AYLAR_KISA`) başlıkta
kullanılıyordu; hem eksik hem küçük harfliydi. `TR_AYLAR` eklendi, kısaltmalar olduğu yerde
kaldı.

### İkincil rakamlar kart oldu
Tahsil edilen · Faturalı ciro · KDV küçük rozetlerdi, "kalem gibi" görünüp okunmuyordu.
Artık üstteki dört kartla aynı biçimde.

### Yeni sıra
```
KASADA · BU AY KAZANÇ · TAHSİL EDİLECEK · BU AY GİDER
Ağustos 2026 (gelir / gider / net + tek cümle)
Tahsilat (%42 çubuk)
Para Nereye Gidiyor? (kalem kalem)
TAHSİL EDİLEN · FATURALI CİRO · KDV
Paralarım
```

Hesaplamalara dokunulmadı. 17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 141: Siyah Ekran Artık İmkânsız

### Siyah ekran neden oluyordu
React'te bir bileşen çizilirken hata olursa React **tüm ağacı söker**. Sonuç: bomboş siyah
sayfa. Ne hata mesajı, ne geri dönüş, ne menü. Uygulamanın geri kalanı sapasağlam olsa bile
erişilemez.

Bu projedeki siyah ekranların hepsi aynı türdendi: bir ad taşınırken geride kaldı ve
**o bileşen ekrana gelene kadar** hata ortaya çıkmadı. Kod geçerli, denetimler geçiyor —
hata yalnızca o sekmeye tıklanınca doğuyor. Tarayıcıda çalıştıramadığım için statik
denetleyiciler bu sınıfın bir kısmını yakalıyor ama hepsini yakalaması mümkün değil.

### src/hataYakalayici.jsx
React sınıf bileşeni (`getDerivedStateFromError` + `componentDidCatch`). Hatayı bölümün kendi
sınırında durdurur:

- **Menü ve uygulama ayakta kalır** — başka sekmeye geçilebilir
- **Hata metni ekranda yazar** — "siyah ekran" yerine "X tanımlı değil" denebilir
- **Kopyala düğmesi** — hatayı bana aynen iletmek için
- **Tekrar dene** düğmesi
- Sekme değişince hata ekranı otomatik temizlenir (`anahtar` prop'u)
- Veriye dokunmaz

### Kapsam
| Panel | Korunan sekme |
|---|---|
| Yönetici | 18 |
| Personel | 15 |
| Müşteri | tamamı |

Açılış/kapanış dengeli, 33 sekmenin hepsi koruma içinde.

### Denetleyici 7 güncellendi
React sınıf metotları (`render`, `componentDidCatch`, `super`…) "tanımsız çağrı" sanılıyordu —
projedeki ilk sınıf bileşen bu. Tanınan adlar listesine eklendi.

### Bu bir mazeret değil
Koruma katmanı hatayı önlemiyor, **felaket olmaktan çıkarıyor**. Asıl iş hâlâ hatayı
yapmamak: dosya bölerken taşınan her adı tek tek doğrulamak.

## Güncelleme 142: Ayarlar Tek Sütuna Döndü

v128'de "geniş ekranda sağ taraf boş kalıyor" diye Ayarlar kartlarını iki sütuna yaymıştım.
Sonuç dağınık oldu: kartlar yan yana gelince göz nereden okuyacağını şaşırıyor.

Ayarlar sırayla okunan bir liste, gazete sayfası değil. Her kart kendi başlığının altında,
alt alta (maksimum 720px).

**Boşluk kalması sorun değil; dağınıklık sorun.**

Diğer ekranlardaki `auto-fit` ızgaralar kontrol edildi — dördü de yalnızca KPI kartları
içeriyor, onlar yan yana doğru duruyor. Dokunulmadı.

## Güncelleme 143: Dağınık Yerleşim Taraması

Ayarlar'daki iki sütun sorunu diğer ekranlarda da var mı diye tüm dosyalar tarandı.

### Sonuç: başka yok
Yedi aday çıktı, hepsi incelendi ve **yedisi de doğru kullanım**:

| Yer | Ne olduğu |
|---|---|
| Paylaşımlar (satır 2176) | Marka stok kartları ızgarası — yan yana doğru |
| Ayarlar (5028) | Düğme sırası |
| Finans (490) | Tahsilat etiket satırı |
| Müşteri Paneli (1180) | Düğme sırası |
| Haftalık Plan (2046) | Başlık + kontrol satırı |
| Operasyon (4056) | Marka süzgeç düğmeleri |
| Personel (320) | Önerilen kişi düğmeleri |

Kart yan yana koyan tek yer Ayarlar'dı; o da v142'de düzeltildi (14 kart, 5 sekme, tek sütun,
maksimum 720px).

### Genişlik tutarlılığı
Ana ekranların hiçbirinde sabit genişlik sınırı yok — hepsi ekranı doldurup aynı şekilde
davranıyor. Yalnızca giriş ekranı (380px) ve Instagram ızgarası (500px) sınırlı, ikisi de
kasıtlı.

17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 144: Banka Hesapları + Katlanabilir Gider Kutucukları

### Banka hesapları kayıptı
Hesaplar sekmesi yalnızca "Banka Hareketleri" gösteriyordu — **hesapların kendisi ve bakiyeleri
hiç görünmüyordu.** `HesapBakiyeleri` bileşeni Finans'ta hiç çağrılmıyordu (Ödeme Takvimi'nde
duruyordu). v137'de sekmelere bölerken atlanmış.

Şimdi:
- **Hesaplar sekmesi**: hesap listesi, bakiyeler, transfer, bakiye düzeltme, hesap ekleme
- **Özet > Paralarım**: toplam üstte, altında her hesabın bakiyesi kutucuk halinde

Hesap yoksa "Hesaplar sekmesinden ekleyebilirsin" yazıyor.

### Para Nereye Gidiyor? — kutucuk ve katlanabilir
Satır listesi yerine kutucuklar. Alt kalemi olanlar (Personel) tıklanınca açılıyor,
ilk açılışta kapalı.

Sıfır olan kalemler gösterilmiyor. Toplam gider altta ayrı satırda.

### Doğrulama
Kutucuk toplamı = toplam gider, personel alt kalemleri = personel gideri. Hesap bakiyesi
`hesapBakiyesi()` ile hesaplanıyor — hesaplama mantığına dokunulmadı.
17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 145: Takvim Seçici + Maaş Ödeme Zamanı

### Tarih alanları artık takvim
| Alan | Öncesi | Şimdi |
|---|---|---|
| Personel · İşe Başlama | serbest metin ("2026-01") | **takvim** |
| Bekleyen tahsilat · Vade | serbest metin ("3 gün gecikti") | **takvim** |

`FieldForm` `type: "date"` zaten destekliyordu; alanlar metin bırakılmıştı.

### Maaş "peşin görünüyor" sorunu
`maasOdemeDurumu` maaşın **aynı ay içinde** ödendiğini varsayıyordu: Ağustos maaşı Ağustos'un
5'inde beklenir, o gün geçince "Gecikti" derdi. Ertesi ay ödeyen bir işletmede bu her ay
yanlış alarm demekti — kullanıcı kaydı elle ileri atmak zorunda kalıyordu.

Personel kaydına **"Maaş Ne Zaman Ödenir"** alanı eklendi:
- **Ertesi ay** (varsayılan) — Ağustos maaşının vadesi Eylül'ün ödeme günü
- **Aynı ay içinde** — eski davranış

Kişi bazında ayarlanabiliyor; farklı çalışanlar için farklı olabilir.

### Doğrulama
7 vade kontrolü: ay kayması, yıl dönümü (Aralık → Ocak), "ayni" seçiliyken kaymaması, bozuk
ve boş değerde çökmemesi. 17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 146: Boş Kartlar Temizlendi

### Ayarlar > Hesaplar boştu
İki kart yalnızca başlıktan ibaretti. Sebep zincirleme: içerikleri kendi ekranlarına taşınmış
(müşteri hesapları Müşteri > Müşteri Hesapları'na, personel hesapları Personel > Hesaplar &
Yetkiler'e), v113'te açıklama yazıları temizlenince geriye başlık kalmış.

Silmek yerine **çalışır kısayola** çevrildi — tek kart, iki düğme, tıklayınca doğru ekrana
götürüyor. Buraya bakan biri nereye gideceğini bilsin diye.

### Kalıntı AI kartı
"Sabah E-postasıyla AI Özeti" kartı duruyordu — AI v117'de silinmişti, kart boş kabuk olarak
kalmış. Kaldırıldı, ekran envanterinden de çıkarıldı.

### Tarama
Tüm dosyalarda "başlık var, içerik yok" kalıbı arandı. Bu ikisi dışında boş kart yok.
("Otomatik Yedekler" ve "Operasyon Hatırlatmaları" yanlış alarm — ikisi de bileşen içeriyor.)

17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 147: Ekip Hatırlatmaları Planım'da

### "Şimdi Test Et" çalışıyor mu?
Kod çalışıyor, **e-posta gitmiyor**. Uç nokta test edildi:

```
RESEND_API_KEY yok  → HTTP 200 {"skipped": true, "reason": "RESEND_API_KEY tanımlı değil"}
RESEND_API_KEY var  → HTTP 200 {"ok": true, operasyonHatirlatma: [{kisi: "Önder", gecikmis: 1}]}
```

Yani kural mantığı sağlam; eksik olan yalnızca gönderim kanalı. Anahtar Vercel'de tanımlı
değil, o yüzden hatırlatma kimseye ulaşmıyor.

### Planım'a taşındı
`EkipHatirlatmalari` kartı Planım'ın en üstünde. E-posta ile **birebir aynı kuralları**
uygular:
- Teslim tarihi geçmiş ve "Teslim Edildi" olmayan işler
- "Talep Alındı" aşamasında bekleyen işler (kişi başlamış mı belli olsun)

Kişi başına gruplanır, bir işte hem kameraman hem editör varsa ikisine de sayılır.
Hiç bekleyen iş yoksa kart hiç görünmez.

E-posta çalışmasa da bilgi kaybolmuyor. Anahtar tanımlanınca e-posta da gitmeye başlar —
ikisi aynı kuralı okuduğu için ayrışamazlar.

### Doğrulama
7 kontrol: iki mantık aynı kişileri ve aynı işleri üretiyor, "Teslim Edildi" ve gelecek
tarihli işler sayılmıyor, kimse atanmamış iş listeye girmiyor, iki kişili iş ikisine de
sayılıyor. 17 kod denetimi + 30 test dosyası temiz.

## Güncelleme 148: Müşteri İçerik Talebi

Müşteri panelinde **"İçerik İste"** sekmesi. Talep doğrudan Operasyon'a düşmez — önce
yöneticinin onayından geçer.

### Akış
```
Müşteri istek gönderir
   ↓
Planım > Onayını Bekleyenler (en üstte, çünkü müşteri cevap bekliyor)
   ↓  "Operasyon'a al"
"Talep Alındı" aşamasında Operasyon kartı
   ↓
Ekibin Bekleyen İşleri kartı onu zaten takip ediyor
```

Yeni mekanizma kurulmadı: "Talep Alındı" zaten Grafik Tasarım akışının ilk adımıydı ve gece
hatırlatması onu izliyordu.

### Form alanları
Ne istiyorsun (Reels/Görsel/Tasarım) · Nasıl olsun (açıklama) · Ne zaman lazım · Referans ·
Acil mi.

Bilinçli olarak **sorulmayanlar**: fiyat (ilişkinin konusu), kim yapacak (yöneticinin kararı),
aşama (hep Talep Alındı'dan başlar).

### Onaylanınca ne oluyor
- Reels → Video · Görsel → Fotoğraf · Tasarım → Grafik Tasarım kategorisi
- Açıklama ve referans **brief'e** yazılır
- İstenen tarih **teslim tarihi** olur
- Acil işaretliyse **yüksek öncelik**

Ret kaydı silmez, "reddedildi" olarak işaretler — müşteri "şimdilik alınmadı" görür ve o talep
sınırdan düşer.

### Güvenlik ve sınır
- **En fazla 3 açık talep** (sonuçlananlar sayılmaz)
- `clientId` sunucudan alınır, tarayıcıdan değil
- Başka markanın talebi ne görünür ne de sınırı etkiler
- `musteriTalepleri` marka kilidine kaydedildi
- Müşteriye giden alanlar tek tek seçilir — iç notlar gitmez

### Doğrulama
`t31.mjs` 13 sunucu kontrolü + 14 onay akışı kontrolü. 17 kod denetimi + 31 test dosyası temiz.

## Güncelleme 149: Gerçek Google Drive Yüklemesi

Müşteri talebe görsel ve **video** ekleyebiliyor. Dosya doğrudan Drive'a gidiyor.

### Neden dosya sunucudan geçmiyor
Video yüzlerce MB olabilir. Vercel'in istek sınırı ~4.5 MB, veri deposu da toplam ~4.5 MB.
Dosya bizim sunucumuzdan geçemez.

Akış: sunucu Google'dan bir **yükleme oturumu adresi** alır ve tarayıcıya verir → tarayıcı
dosyayı doğrudan Google'a yükler → sunucu dosyayı görüntülenebilir yapar. Baytlar bize hiç
uğramaz.

Yükleme **yeniden başlatılabilir**: bağlantı koparsa büyük video baştan yüklenmez.

### Slot harcanmadı
Yeni api dosyası açılmadı — `musteriAction: "driveOturum"` ve `"drivePaylas"` olarak mevcut
uç noktaya eklendi. **11/12** olarak kaldı.

### Klasör düzeni
Her müşterinin dosyası kendi marka klasörüne düşer (yoksa oluşturulur). Klasör adı
**sunucuda** belirlenir — tarayıcıdan gelseydi başka markanın klasörüne yazılabilirdi.

### Kurulu değilken
Drive ortam değişkenleri yoksa yükleme alanı anlaşılır bir hata verir, **talep sistemi
normal çalışmaya devam eder**. Test edildi.

### Kurulum (kullanıcının yapacağı)
Google Cloud'da proje → Drive API → servis hesabı → anahtar → hedef klasörü paylaş.
Sonra Vercel'e üç değişken: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`DRIVE_KLASOR_ID`.

### Onaylanınca
Dosya bağlantıları **brief'e** yazılır, ilki `hamDosyaLink` olarak kartın üstüne konur —
ekip Drive'da aramak zorunda kalmaz.

### Doğrulama
`t31.mjs` 19 kontrol: dosyalı/dosyasız talep, en fazla 5 dosya, Drive kurulu değilken sistemin
çalışmaya devam etmesi, müşterinin kendi dosyalarını görmesi. 17 kod denetimi + 31 test
dosyası temiz.

## Güncelleme 150: Dosya Yükleme Yerine Bağlantı

v149'daki Google Drive yükleme kodu **kaldırıldı**, yerine bağlantı alanı kondu.

### Neden vazgeçildi
Kurulum öncesi araştırıldı: servis hesaplarının depolama kotası yok. Kişisel bir Google
hesabına ait klasöre yükleme yapıldığında Google "Service Accounts do not have storage quota"
hatası veriyor. Çalışması için ya Google Workspace + Ortak Drive (aylık ücretli) ya da OAuth
yetkilendirmesi gerekiyordu.

Kullanıcı WeTransfer bağlantısını tercih etti: **ücretsiz, kurulumsuz, boyut sınırı yok.**

### Ne değişti
Müşteri panelindeki yükleme alanı → **"Görsel / video bağlantısı"** alanı.
WeTransfer, Drive ya da benzeri bir bağlantı yapıştırılıyor.

### Zincir aynen korundu
Bağlantı, `dosyalar` listesine tek kayıt olarak giriyor — yani onaylanınca **brief'e yazılıyor**
ve kartın `hamDosyaLink` alanına geçiyor. Yükleme için yazılan alt yapı boşa gitmedi.

### Silinen dosya
`lib/drive-yukleme.js` — **GitHub'dan elle silinmeli.**

### Doğrulama
17 sunucu kontrolü + 3 bağlantı zinciri kontrolü. 17 kod denetimi + 31 test dosyası temiz.
Serverless slot 11/12 (hiç değişmedi).

## Güncelleme 151: "Yetkisiz" Hatası — Eski Kimlik Kopyası

Operasyon kartındaki **Durum Bildirimi Gönder** düğmesi "Gönderilemedi: (Yetkisiz.)" veriyordu.

### Sebep
`CekimEditTakibi.jsx` içinde `authHeadersLokal` adında **yerel bir kimlik başlığı kopyası**
vardı ve şifreyi `localStorage`'dan okumaya çalışıyordu.

Yönetici şifresi v62'de güvenlik gerekçesiyle tarayıcıdan kaldırılmış, yerine **oturum
anahtarı** getirilmişti. Ortak `authHeaders` güncellenmiş ama bu yerel kopya güncellenmemiş —
boş başlık üretmeye başlamış. Sunucu haklı olarak 401 dönüyordu.

Yani e-posta altyapısı çalışıyordu; istek kimliksiz gidiyordu.

### Düzeltme
Yerel kopya kaldırıldı, `tema.jsx`'teki ortak `authHeaders` kullanılıyor. Üç çağrı da
düzeltildi.

### Tarama
`localStorage.getItem("marcus-os-pw")` kalıbı tüm dosyalarda arandı — başka kopya yok.
Diğer 19 fetch çağrısı incelendi, hepsi oturum anahtarını gönderiyor (yalnızca farklı
yazılmışlar).

### Ders
Aynı işi yapan ikinci bir kopya, güncellenmediğinde sessizce bozulur. Bu projede üçüncü kez:
e-posta göndericisi (v115'te birleştirildi), müşteri görünümü (v110'da birleştirildi), şimdi
kimlik başlıkları.

## Güncelleme 152: Eski İçerikleri Operasyona Aktarma

### Durum tespiti
Müşteri panelindeki onaylı içerikler Operasyon'da görünmüyordu. Sebep: müşteri paneli **iki
kaynaktan** besleniyor —

1. Operasyon kartlarının canlı aynası (`hazirIcerikler`)
2. Müşteri Paneli'nden elle eklenen kayıtlar (`musteriIcerikleri`)

İkincisinin Operasyon'da karşılığı yok. **Yeni eklenenler zaten kart olarak açılıyor** (v93);
sorun o değişiklikten önce eklenmiş eski kayıtlardaydı.

### Çözüm
İçerik satırlarına **"→ Operasyona"** düğmesi eklendi. Yalnızca kartı olmayan içeriklerde
görünür — yeni eklenenlerde zaten kart var, bir daha çıkmaz.

Aşama içeriğin durumuna göre seçilir:
- onaylı → **Onaylandı**
- revize istenmiş → **Revize İstendi**
- bekliyor → **Kontrol Bekliyor**

Müşteri zaten onayladıysa kartı geriye alıp tekrar onaya göndermek yanlış olurdu.

Dosya bağlantısı da (Drive linki ya da yüklenmiş görsel) karta taşınır.

### İçerik silinmez, bağlanır
Kayıt `kaynakIsId` ile karta bağlanır. Böylece:
- Müşteri panelindeki onay geçmişi korunur
- Aynı içerik iki kere aktarılamaz (düğme kaybolur)
- Kopya kayıt oluşmaz — içerik artık kart üzerinden görünür
- Kart silinirse içerik müşteri paneline geri döner (v107 kuralı)

### Doğrulama
12 kontrol: üç durum için doğru aşama, kategori eşlemesi, dosya taşınması, içeriğin
silinmemesi, diğer kayıtların etkilenmemesi, tekrar aktarılamaması.
17 kod denetimi + 31 test dosyası temiz.

## Güncelleme 153: Onaylanan Dosya Drive'da Taşınıyor

Müşteri bir içeriği onayladığında, o işin Drive dosyası **"Onaylananlar" klasörüne** (marka
alt klasörüne) otomatik taşınıyor.

### Neden bu sefer çalışıyor
v149'da Drive YÜKLEME denenmiş, servis hesaplarının depolama kotası olmadığı için kişisel
Google hesabında çalışmayacağı anlaşılıp vazgeçilmişti.

**Taşıma farklı bir iş:** yeni dosya oluşturulmuyor, var olan dosyanın klasörü değiştiriliyor
(`files.update` + `addParents`/`removeParents`). Servis hesabının dosyaya düzenleme yetkisi
olması yeterli, sahip olması gerekmiyor. Kota sorunu doğmuyor.

### Taşıma ONAYI ASLA ENGELLEMEZ
Drive kurulu değilse, yetki yoksa, bağlantı koparsa ya da iş Drive bağlantısı taşımıyorsa
onay yine geçerli. Sonuç işin geçmişine not olarak düşülür — sessizce kaybolmaz.

Test edildi: kurulu değilken onay tamamlanıyor, bağlantısız işte gereksiz not düşülmüyor,
revize isteği taşıma tetiklemiyor.

### Kurulum (kullanıcının yapacağı)
Google Cloud projesi → Drive API → servis hesabı → anahtar → **kaynak ve hedef klasörleri
servis hesabına DÜZENLEYİCİ olarak paylaş**.

Vercel'e üç değişken: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`DRIVE_ONAY_KLASOR_ID`.

Slot harcanmadı — taşıma mevcut onay akışının içinde, 11/12 sabit.

### Doğrulama
`t32.mjs` 12 kontrol: üç bağlantı biçiminden kimlik çıkarma, Drive olmayan bağlantı, kurulu
değilken çökmeme, onayın her koşulda tamamlanması. 17 kod denetimi + 32 test dosyası temiz.

## Güncelleme 154: Her Müşterinin Kendi Onay Klasörü

Ajansın Drive düzeninde her müşterinin zaten kendi klasörü var; tek bir "ONAYLANANLAR" üst
klasörü mantığı bu yapıya uymuyordu.

### Müşteri kaydına yeni alan
**"Drive Onay Klasörü"** — o markanın onaylanan dosyalarının taşınacağı klasörün bağlantısı.

Bağlantının tamamı yapıştırılabilir (`https://drive.google.com/drive/folders/1AbC...`) ya da
doğrudan klasör kimliği. İkisi de tanınıyor.

### Hedef klasör sırası
1. Müşteri kaydındaki **Drive Onay Klasörü** — asıl yol
2. Yoksa `DRIVE_ONAY_KLASOR_ID` altında marka adıyla alt klasör
3. İkisi de yoksa taşıma yapılmaz, **onay normal tamamlanır**

Boş bırakılan müşteride hiçbir şey bozulmaz.

### Doğrulama
6 kontrol: klasör bağlantısı, `?usp=sharing` ekli hâli, doğrudan kimlik, boş değer, alakasız
metin, dosya bağlantısının klasör sanılmaması. 17 kod denetimi + 32 test dosyası temiz.

## Güncelleme 155: Drive Klasör Akışı — Onaylananlar / Paylaşılanlar, Ay Ay

Ajansın Drive düzenine göre iki aşamalı taşıma:

```
İBO BURGER/                        ← müşteri kaydına GİRİLEN tek klasör
   ONAY BEKLEYENLER/
   ONAYLANANLAR/
      AĞUSTOS/                     ← müşteri onaylayınca
   PAYLAŞILANLAR/
      AĞUSTOS/                     ← "Teslim Edildi" olunca
```

Üst klasörler (ONAYLANANLAR / PAYLAŞILANLAR) ve **ay klasörleri sistem tarafından
oluşturulur**; varsa yeniden kullanılır. Kullanıcı yalnızca markanın ana klasörünü girer.

Ay ayrımı sonradan aramayı kolaylaştırır — bir markanın klasöründe yüzlerce dosya birikmez.

### İki tetikleyici
| Olay | Hedef |
|---|---|
| Müşteri onayladı | `ONAYLANANLAR/<AY>` |
| Kart "Teslim Edildi" oldu | `PAYLAŞILANLAR/<AY>` |

**Neden aşama üzerinden:** paylaşım planı kaydında dosya bağlantısı yok, iş kartında var.
"Teslim Edildi" zaten "paylaşıldı" anlamına gelen son aşama.

### Tekrar taşıma yok
Kayıt öncesi ve sonrası karşılaştırılır; yalnızca **yeni** geçen işler taşınır. Zaten "Teslim
Edildi" olan bir iş her kayıtta tekrar taşınmaz. `kv-yaz.js` artık `oncekiVeri` de döndürüyor.

### Doğrulama
7 aşama yakalama kontrolü (yeni geçen, zaten öyle olan, başka aşamaya geçen, yeni eklenen,
değişiklik yok, boş veri) + 6 klasör kimliği kontrolü. 17 kod denetimi + 32 test dosyası temiz.

---

## Güncelleme 156: Güvenilirlik Denetimi — Şube Kapsamı, Sistem Sağlığı, Bozuk Veri Koruması

Bu tur yeni özellik eklemek için değil, **mevcut sistemi daha hataya dayanıklı hale
getirmek** için yapıldı. Dört gerçek kusur bulundu; hepsi önce testle kanıtlandı,
sonra düzeltildi, sonra koruma bozulup testin gerçekten düştüğü ölçüldü.

### 1. Şube silinince içerik kapsamı açılıyordu (en ciddi)

Kart `sadeceSubeler: ["lara"]` ile **yalnızca Lara için** hazırlanmışken Lara
silinince kimlik karttan çıkarılıyor ve liste boşalıyordu. `sadeceSubeler: []` bu
sistemde **marka geneli** demek — yani içerik bir anda markanın **bütün şubelerinde**
kullanılabilir hale geliyordu. İki şubeli markada kanıtlandı.

Artık liste boşalacaksa kimlik **bırakılıyor**: kart hiçbir şubede kullanılamaz kalıyor.
Kasıtlı ve güvenli durum. Sessiz değil — Operasyon kartında **ŞUBE KAPSAMI KAYIP**
uyarısı çıkıyor, düzenlemede ölü kimlik seçim anında temizleniyor. Çok şubeli kartlar
etkilenmedi: iki şubeye kilitli karttan biri silinince kart diğerinde çalışmaya
devam ediyor.

### 2. Marka kilidinde iki kusur

**Üyelik:** `uyelikEkle` markayı `body.uyelik.clientId` içinde taşıyor. Kilit
çözümleyicisi yalnızca üst düzeye bakıyordu, hedef "belirsiz" kalıyor ve fail-close
devreye giriyordu — çözüm ortağı **kendi markasına bile** üyelik ekleyemiyordu.
Sızıntı yoktu, ama izin işlevsizdi.

**Şube stoğu:** `subeStokDegistir` şubeyi tüm şubeler arasında arıyordu. Kilitli hesap
kendi `clientId`'siyle **başka markanın** `subeId`'sini gönderince istek geçiyordu:
çöp bir stok anahtarı oluşuyor ve **başka markanın şube adı** geçmişe yazılıyordu.
Artık şubenin o markaya ait olduğu doğrulanıyor — yöneticide de, çünkü bu bir veri
bütünlüğü kuralı.

### 3. Bozuk veri sessizce boş uygulama olarak açılıyordu

`kv.get` metin, dizi ya da sayı döndürebiliyor. Eskiden bu boş bir belgeye çevriliyor
ve sistem hiçbir şey söylemeden çalışmaya devam ediyordu: kullanıcı **bomboş** bir
uygulama görüyor, "her şey silinmiş" sanıp kayıt giriyor ve o kayıt kurtarılabilir
verinin **üstüne** yazılıyordu. Artık okuma da yazma da reddediliyor ve yedekten dönme
yönlendirmesi gösteriliyor. Boş belge bozuk sayılmıyor — ilk kurulumda belge yoktur.

### 4. Yedek geri yüklerken içerik hiç doğrulanmıyordu

Geri yükleme kilidi ve geri-alma kopyasını zaten doğru yapıyordu, ama yedeğin
**yapısı** hiç kontrol edilmiyordu: `clients` metin olmuş bozuk bir yedek doğrudan
üretime yazılırdı. Artık yapı doğrulaması kilitten önce çalışıyor; ayrıca `?ozet=1`
"bu yedeğe dönersem **ne kaybederim**" sorusunu alan alan cevaplıyor.

### Yeni: Ayarlar > Sistem Sağlığı

Yeni API dosyası açılmadı (Vercel sınırı 12, kullanılan 11) — mevcut uca action
eklendi, yalnızca yönetici erişebiliyor. **Hiçbir şey yazmaz.**

Gösterdikleri: JSON belge boyutu ve eşik durumu, en çok yer kaplayan on alan (sürekli
büyüyenler işaretli), kart/müşteri/şube/plan/geçmiş/silinen sayıları, son yedek,
fonksiyon sayısı, kritik ortam değişkenlerinin **var/yok** durumu (değerler asla
tarayıcıya gitmez), ve isteğe bağlı **salt okunur** Drive kontrolü.

Drive kontrolü üretim Drive'ında hiçbir şey oluşturmaz; yazma yeteneği denenmeden
Google'ın `capabilities` bilgisinden okunur, okunamayan yetenek "doğrulanamadı" der.
Yakaladığı sessiz bozulmalar: ana klasör elle çöpe atılmış, servis hesabının yetkisi
kaldırılmış, OAuth jetonu geçersiz, Drive alanı dolmuş.

### Doğrulama

80 test dosyası, **1678 kontrol**, 19 statik denetim (ikisi bu turda eklendi: sistem
belgesi envanteri ve API fonksiyon sayısı sabiti), temiz derleme, 11/12 fonksiyon.
Veri modeli değişmedi — tek JSON belgesi, migration yok.

---

## Güncelleme 157: Paylaşım Hücresi, Stok Mutabakatı, Marka Süzgeci ve Drive Eşleştirmesi

Bu tur sahadan gelen dört şikâyetle başladı ve hepsi aynı kök soruya çıktı:
**"ekranda gördüğüm sayı gerçekten kartların hâli mi?"**

### Paylaşım planında hangi kartın planlandığı görünüyor

Plan hücresi yalnızca bir harf gösteriyordu; hangi içeriğin planlandığı yalnızca onu
planlayanın aklındaydı. Artık hücrenin üstüne gelince **planlanan kart** açılıyor:
numarası, içerik türü, önizlemesi. Çözüm ortakları da görüyor — görünürlük kuralı
`lib/musteri-gorunumu.js`'de, panellerin tek kaynağında.

Aynı kutuda **Paylaş** düğmesi var; basınca "paylaşıldığını onaylıyor musun?" diye
son kez soruyor, ancak ondan sonra Drive'da dosya hareket ediyor. Shift+tık ile iptal
de aynı kutuya taşındı.

### İptal edilen paylaşım gerçekten geri dönüyor

İptal edildiğinde kart aşaması geri alınıyordu ama **dosya PAYLAŞILDI klasöründe
kalıyordu**. Carousel kartlarında daha kötüydü: slaytlar kart klasöründen çıkıp
ONAYLANANLAR'a dağınık düşüyor, boş klasör PAYLAŞILDI'da kalıyordu. Paylaşım ucu artık
taşımayı `kartKlasorunuTasi` ile yapıyor — `api/data.js` ile aynı yol.

**Plan silmek artık tam geri almadır**: aşama geri alınır, stok geri gelir, dosya
ONAYLANANLAR'a döner. Eskiden karta hiç dokunulmadığı için kart "Teslim Edildi"de kalıyor,
seçicide çıkmıyor ve aynı içerik bir daha planlanamıyordu.

### Stok kartların yansıması oldu — elle +/− kaldırıldı

Sayıyı elle oynatmak stoğun kartlarla bağını koparıyordu: içerik onaylanmadan stok
artıyor, paylaşılmadan düşüyor, "bu sayı neden böyle" sorusu cevapsız kalıyordu.
Elle +/− kaldırıldı. Tek düzeltme yolu **mutabakat** (`lib/stok-mutabakat.js`):
kartlardan olması gereken hesaplanır, sapan satırlar Paylaşımlar'da gösterilir ve
düzeltmede **hedef sayıyı sunucu hesaplar** — tarayıcıdan gelen sayıya güvenilmez.
Düzeltme `paylasimGecmisi`'ne eski/yeni değerle yazılır.

t83 bu türetmenin stok motoruyla birebir aynı sonucu verdiğini ölçüyor; ayrışırlarsa
mutabakat, olmayan sapmaları "düzeltmeye" başlar ve doğru sayıları bozar.

### Operasyon panosunda marka süzgeci

Kart sayısı arttıkça pano okunmaz hâle geliyordu. Kategori süzgecinin yanına **marka**
seçimi eklendi. Süzgeç mantığı `lib/pano-suzgeci.js`'e alındı — testin uygulamanın
kendi koduyla aynı yolu sınaması için; ayrı yazılan süzgeç, ayrı davranış demek.

### Drive ile eşleştirme: "eksik kart mı var?"

Mutabakat "sayı sapmış" diyor ama sapmanın iki sebebi olabilir: sayaç kaymıştır, ya da
**Drive'da içerik vardır, sistemde kartı yoktur**. İkincisini ancak dosyalara bakarak
anlarız. Marka stok kartına **"Drive ile eşleştir"** eklendi: markanın ONAYLANANLAR
klasörlerini ay ay okur ve kartların dosya kimlikleriyle karşılaştırır. Sonuç:
kartsız dosyalar (adı ve klasörüyle), dosyası hiç olmayan onaylı kartlar ve kartta
yazılı olup Drive'da bulunmayan dosyalar.

Üç kural bilerek böyle:

- **Yalnızca listeler, hiçbir şey onarmaz.** Tarama üretim Drive'ında tek bir yazma
  yapmaz — klasör açmaz, taşımaz, silmez. t85 bunu isteklerin yöntemini sayarak ölçüyor;
  koruma kaldırıldığında kontrol düşüyor. Teşhis aracının kendisi hasar üretmemeli.
- **Elle yapıştırılmış bağlantılar da karttır.** Dosya kimliği yalnızca `medya[].dosyaId`
  içinde olmayabilir. Okunmazsa elle bağlanan içerik "kartsız" sanılır ve araç olmayan
  bir sorun gösterir — güveni ilk yitiren şey budur.
- **Bütçe dolarsa söylenir.** Çok aylı markada tarama sınırsız süremez; çağrı bütçesi
  dolduğunda liste eksiktir ve `tamamlanmadi` bildirilir. Sessiz kırpma, eksik listeyi
  "temiz" göstermek demekti. Aylar en yeniden eskiye taranır.

Eşleştirme tek markada ve istendiğinde çalışır — otomatik, arka planda tarama yok.

**Testler:** t85 eklendi (16 kontrol). Toplam **1793 kontrol**, 85 test dosyası,
20 statik denetim. Yeni API dosyası açılmadı — `driveEslestir`, `api/paylasim.js`
üzerine bir action olarak eklendi; fonksiyon sayısı 11'de kaldı.

### 157.1 — Eşleştirme ekrana ulaşmıyordu, üstelik belgeye sızıyordu

Sahadan gelen ilk ekran görüntüsünde tarama "Drive taranamadı." diyordu. Sebep, sanılanın
aksine Drive değildi: `paylasimIstek` başarı dalında **çıplak `return`** yapıyordu, yani
yanıtı okuyan her çağrı `undefined` alıyordu. Eşleştirme sonucu — başarılı olsa bile —
ekrana hiç ulaşmıyor, arayüz de elinde bir şey olmadığı için genel hata metnini yazıyordu.

Aynı yerde ikinci bir kusur çıktı: yanıt gövdesi `setData` içine olduğu gibi yayılıyor ve
`BELGE_DISI_ALANLAR` listesinde olmayan alanlar **belgeye karışıyordu**. `eslestirme`
(yüzlerce dosya adı) ve `duzeltildi` böyle sızıyordu; bir sonraki kayıtta Redis'e
yazılacaklardı.

Üçüncüsü en ağırı: marka klasörü tanımsızken tarama `klasorBulVeyaOlustur` çağırıyordu —
"bakıyorum" derken ortak klasörün altında marka adıyla **yeni klasör açıyor**, sonra boş
listeye bakıp "her dosyanın bir kartı var" diyordu. Hem üretim Drive'ına yazma, hem sahte
temiz rapor. Artık aranır, bulunamazsa sebep söylenir.

**Denetim 21 eklendi** (`testler/yanitAlanlari.mjs`): uçta üretilen her başarılı-yanıt
alanı ya belgenin gerçek bir alanıdır ya da `BELGE_DISI_ALANLAR`'dadır; ayrıca yanıtı
okuyan bir çağrı varken gönderenin yanıtı döndürdüğü doğrulanır. Üç bozma ile ölçüldü:
listeden alan çıkarmak, uca yeni alan eklemek ve çıplak `return`'e dönmek denetimi
düşürüyor. İlk yazımda "başarı dalı" kontrolü fonksiyonun başka dalındaki `return res;`
ile eşleştiği için hiçbir şey sınamıyordu — daraltıldı ve tekrar ölçüldü.

t85 üç kontrol daha aldı (19). Toplam **1796 kontrol**, 21 statik denetim.

### 158 — Stokta son söz Drive'ın: kart aynası + Drive doğrulaması

Sahadan gelen soru şuydu: *"Skylon Mimarlıkta 2 adet reels var, Drive'da 2 adet kart
mevcut — doğru, ama stok bilgisi yanlış."* Sapmanın kaynağı, stok ile Drive'ın
birbirinden bağımsız ilerlemesiydi: kart `Onaylandı` aşamasına geçtiği anda stoğa
yazılıyordu, dosyanın Drive'da gerçekten o klasöre geçip geçmediğine bakılmadan.
Taşıma sessizce başarısız olduğunda stok, arkasında içerik OLMAYAN bir sayı gösteriyordu.

**Yeni kural:** *stok = ONAYLANANLAR klasöründe dosyası FİİLEN duran kartlar.* Kartın
aşamasının onaylı olması yetmiyor. Tür yine karttan geliyor — Drive bir dosyanın Reels
mi Görsel mi olduğunu bilmiyor.

**Rapor tür kırılımlı.** `ONAYLANANLAR: 2 Reels · 1 Carousel`, `ONAY BEKLEYENLER: 1 Görsel`
— ve her satırın altında kartın numarası ve adı. Sayılan şey dosya değil KART: bir
carousel on slayttan oluşuyor, on içerik değil bir içerik.

**Onay kilidi.** Yeni onaylanmış bir kartın dosyası Drive'da doğru klasöre taşınamadıysa
onay GERİ ALINIR: aşama eski hâline döner, stok düşer, sebep kartın geçmişine yazılır,
istek 409 ile reddedilir. Drive'ı kurulu olmayan marka bu kilidin dışında.

**Kartsız dosyadan kart açma.** Drive'da içerik var ama kartı yoksa tek tuşla taslak kart
açılıyor; aşama dosyanın DURDUĞU klasörden, kategori dosya adından geliyor. Kartsız
listesini sunucu yeniden hesaplıyor — tarayıcıdan gelen listeye güvenilmiyor.

**Gece denetimi.** Her aktif marka taranıp genel stok Drive'a eşitleniyor, rapor
`driveDenetimi` alanına yazılıyor. Yeni fonksiyon açılmadı, mevcut cron ucuna eklendi.

#### Üç fren — ve neden üçü de gerekli

Drive'ı otorite yapmak güçlü ama tehlikeli: Drive EKSİK okunduğunda "içerik azalmış"
görünür ve gerçekte duran içerik stoktan silinir. Üç fren var:

1. **Tarama tamamlanmadıysa yazılmaz.** Ölçüldü: fren kaldırılınca yarıda kesilen bir
   taramada stok 3→0 düştü.
2. **Ay klasörü hiç bulunamadıysa yazılmaz.** Bu, geliştirme sırasında ÖLÇÜLEREK bulundu:
   klasör adları beklenen ay biçiminde değilken tarama "0 dosya, tamamlandı" diyor ve
   bütün sayıları sıfırlıyordu. "Hiç dosya görmedim" ile "hiç klasör bulamadım" aynı şey
   değil.
3. **Toplu kayıp freni** (20+ düşüş) — marka atlanır, rapora yazılır.

Ayrıca **yalnızca genel stok** Drive'dan türer; şube satırlarına dokunulmaz — bir dosyanın
hangi şubede paylaşıldığı Drive'da yazmıyor.

#### Ölçümler

Her koruma bozularak ölçüldü: kart yerine dosya saymak 2 kontrol, stoğu yine kartın
aşamasına bağlamak 1, kartsız dosyayı "Görsel" varsaymak 1, onay kilidini kaldırmak 3
(kart Onaylandı'da kalıyor + stok 1 şişiyor), eksik tarama frenini kaldırmak 2, ay
klasörü frenini kaldırmak 2, şube satırlarına yazmak 1, kart açmada sunucu taramasını
atlamak 3, yarış frenini kaldırmak 1 kontrol düşürüyor.

t86 (14) ve t87 (27) eklendi. Toplam **1841 kontrol**, 21 statik denetim.

**Kural değişikliği kaydı:** t32 uzun süre "taşıma başarısız olsa da onay geçerli"
kuralını sabitliyordu. Kullanıcının kararıyla tersine çevrildi; gerekçe testin başlığına
yazıldı ki ileride "bozulmuş" sanılıp geri alınmasın.

### 159 — Tür artık tahmin değil, seçim

Sahadan: *"Neden Video ve Reels olarak ayrıldı, normalde Reels olması gerekiyor."* Aynı
markanın iki kartı, ikisi de `Video` kategorisinde, biri Reels stoğuna biri Video
stoğuna yazılmıştı.

Sebep, türün **serbest metinden tahmin edilmesiydi**: önce içerik adında tür adı
aranıyor, bulunamazsa kategoriye düşülüyordu.

- `#19 Reels white dent studio` → adında "Reels" geçiyor → **Reels**
- `#131 Q PREMIUM` → adında hiçbir tür geçmiyor → kategori Video → **Video**

İki kart arasındaki tek fark, birinin adına o kelimenin yazılmış olmasıydı. Kodda
`paylasimTuru` diye açık bir alan vardı ama **arayüzde onu ayarlayan hiçbir yer yoktu** —
yani tür her kart için tahminden ibaretti.

**İki değişiklik:**

1. **Kategori `Video` artık REELS'e düşüyor.** Ajansın çektiği video içerik pratikte
   Reels olarak paylaşılıyor. `Video` stoğu yalnızca kartta açıkça seçilirse kullanılıyor.
2. **Operasyon kartına "Paylaşım Türü (stok)" seçicisi eklendi.** Boş bırakılırsa tahmin
   çalışır (seçenekte hangi türe düşeceği yazıyor); seçilirse tahmin tamamen devre dışı
   kalır — addaki kelimeyi de geçersiz kılar.

Ölçüm: seçimi yok saymak 4 kontrol, kategori düşümünü Video'ya geri çevirmek 2 kontrol
düşürüyor. Kontrol yalnızca saf fonksiyonu değil **motoru** sınıyor — seçim motora
ulaşmazsa kullanıcı ekranda "Video" seçer, stok yine Reels'e yazılır ve seçici sahte bir
kontrol olurdu.

Kural değişikliği t38, t68, t70, t83'te güncellendi; gerekçe t38'in başlığına yazıldı.

Mevcut kartların stoğu kendiliğinden düzelmiyor — ama gece Drive denetimi ve Paylaşımlar'daki
"Drive'a göre düzelt" bunu bir turda kapatıyor: Video satırı 0'a iner, Reels satırı gerçek
sayıya çıkar. Toplam **1845 kontrol**.

### 160 — Üç kategori: Reels · Post · Carousel

Kullanıcının kararı: kategoriler ve stok türleri üçe insin, "tasarım falan olmasın".
Eskiden dört kategori (Video / Fotoğraf / Carousel / Grafik Tasarım) ve **altı** stok
türü (Görsel / Video / Reels / Story / Carousel / Tasarım) vardı — üstelik ikisi ayrı
listelerdi ve aralarındaki çeviri koda dağılmıştı.

Artık ikisi de **aynı liste**: `lib/kategori.js`.

| | Reels | Post | Carousel |
|---|---|---|---|
| eski kategori | Video | Fotoğraf + Grafik Tasarım | Carousel |
| eski stok türü | Video | Görsel + Story + Tasarım | Carousel |

**Eski kayıtlara dokunulmadı.** Belgede hâlâ "Video", "Fotoğraf", "Grafik Tasarım"
kategorili yüzlerce kart ve `1_Görsel` / `1_Story` / `1_Tasarım` anahtarları var. Eşleme
okuma anında yapılıyor; kart normal akışında kaydedildiğinde kategorisi kendiliğinden
yeni ada dönüyor.

#### Geliştirme sırasında ölçülerek bulunan üç kayıp riski

1. **Eski kartlar hiçbir sekmede görünmüyordu.** `panoSuzgeci` ham `kategori` alanına
   bakıyordu; eşlemeden geçirilmeyince "Grafik Tasarım" kartı ne Post'ta ne başka bir
   sekmede çıkıyordu. Aylardır süren işler panodan kaybolurdu.
2. **Kategorisiz kartlar akışın başına düşüyordu.** Belgede kategorisi hiç olmayan
   kartlar var (her şeyin video olduğu dönemden). İlk yazımda bunlar Post sayılıyordu;
   aşamaları ("Edit Bekliyor") Post listesinde bulunmadığı için onarım onları başa
   çekiyordu. Varsayılan Reels'e alındı — eski davranışın aynısı.
3. **Yapılmamış çekim yapılmış sayılıyordu.** Eski tasarım aşamalarını Post'a eşlerken
   `Talep Alındı` → `Çekim Yapıldı` da yazmıştım; ama "Talep Alındı" Reels kartlarında da
   bulunuyor ve o kartlar "çekim yapıldı" sütununa düşüyordu. Eşleme yalnızca
   `Tasarım Yapılıyor` → `Düzenleniyor` ile sınırlandı; diğerleri kendi kategorisinin
   ilk aşamasına iniyor.

Ayrıca `CekimEditTakibi.jsx` **kendi `YAPILIYOR_ASAMASI` kopyasını** tutuyormuş — bayat
ve Carousel'i hiç içermiyordu, yani karosel kartında "üzerinde çalışılıyor" dalı hiç
eşleşmiyordu. Kopya kaldırıldı, tek kaynağa bağlandı. Statik denetim bunu yakaladı.

#### Stok anahtarları

Eski anahtarlar okuma anında yeni türlere toplanıyor (genel VE şube satırları) — yoksa
43 markanın stoğu sıfır görünürdü. Ama bu kalıcı çözüm değil: eski anahtar hiç düşmez.
Bu yüzden stok düzeltmesi (Drive denetimi / mutabakat) yazarken o markanın eski
anahtarlarını siliyor. Bir düzeltme turundan sonra toplama işlevsiz kalıyor.

#### Ölçüm

t88 eklendi (26 kontrol). Bozmalar: pano süzgecini ham kategoriye bağlamak 4 kontrol,
kategorisiz kaydı Post saymak 7, stok anahtarlarını toplamamak 3, süren tasarım işini
eşlememek 1 kontrol düşürüyor.

Kural değişikliği t35, t38, t47, t48, t51, t53, t73, t74, t86, t87'de güncellendi;
gerekçeler test başlıklarına yazıldı. Toplam **1877 kontrol**, 21 statik denetim.

### 160.1 — `export { X } from` yerel bağ oluşturmuyor: Operasyon hiç açılmadı

Üç kategoriye geçerken `KATEGORILER` listesini `lib/kategori.js`'e taşıdım ve arayüzde
şöyle yazdım:

```js
export { KATEGORILER } from "../lib/kategori.js";
```

Bu bir **köprü**: adı dışarı taşır ama dosyanın kendi kapsamında `KATEGORILER` diye bir
değişken **oluşturmaz**. Aynı dosyadaki dört kullanım tanımsız kaldı ve Operasyon bölümü
`Can't find variable: KATEGORILER` ile hiç açılmadı.

**Hiçbir katman yakalamadı:** `npm run build` geçti, 1877 sunucu kontrolü geçti, 21
statik denetim geçti. Sunucu testleri React bileşenini çalıştırmıyor, paketleyici de
bunu hata saymıyor. Hata ancak kullanıcının ekranında göründü.

**Denetim 22 eklendi** (`testler/yenidenDisaVerme.mjs`): `export {…} from` ile yeniden
dışa verilen bir ad, aynı dosyada kullanılıyor mu ve ayrıca içe aktarılmış mı diye bakar.

İlk yazımı **işe yaramıyordu** — bozmayı geri koyduğumda "temiz" dedi. Sebep: yorumlarla
birlikte dize sabitlerini de siliyordum, `from "../lib/x.js"` → `from ""` olduğu için
köprü hiç eşleşmiyordu ve kullanım sayısı 4 yerine 2 çıkıyordu. Yalnızca yorum ayıklamaya
indirildi ve tekrar ölçüldü: bozma geri konduğunda denetim düşüyor, onarınca geçiyor.

Doğrusu: önce içe aktar, sonra `export { KATEGORILER };`.

### 160.2 — Toplama yalnızca ekranda yapılıyordu: bütün markalar sahte sapmalı göründü

Sahadan gelen ekran görüntüsünde Violla kartında **"Post 5"** yazıyordu; hemen altındaki
Drive raporu ise **"Post: 0 kayıtlı → 5 Drive'a göre"** diyordu. Mutabakat paneli de
**"22 satırda kayıtlı sayı kartlarla uyuşmuyor"** gösteriyordu.

Sebep: eski stok anahtarlarının yeni türlere toplanması **yalnızca ekranda** yapılıyordu.
Karşılaştırma yapan iki yer — sunucudaki Drive farkı ve `stokMutabakati` — ham belgeyi
okuyordu. Belgede `Violla_Görsel: 5` duruyor; sunucu yeni türde `Post` arıyor, bulamıyor
ve **sıfır** sayıyordu. Sayılar aslında doğruydu; yalnızca anahtarların adı eskiydi.

Sonuç, teşhis aracının olmayan bir sorunu göstermesiydi — düzeltmeye çalıştığımız
güven kaybının aynısı.

**Düzeltme:** toplama artık karşılaştırmanın yapıldığı her yerde uygulanıyor —
`stokMutabakati`, `driveEslestir`, `driveStokUygula`, gece denetimi ve `stokDuzelt`.
`stokDuzelt` ayrıca yazarken o markanın eski anahtarlarını siliyor (Drive düzeltmesi
bunu zaten yapıyordu); yoksa okuma anındaki toplama doğru sayının üstüne eklemeye
devam ederdi.

#### Ölçüm

t88'e 4, t87'ye 3 kontrol eklendi — ikisi de sahadan gelen hâli birebir kuruyor
(eski anahtarlı ama sayıları DOĞRU bir marka).

- mutabakatı yine ham stoka bağlamak → 3 kontrol düşüyor
- Drive farkını yine ham stoka bağlamak → 2 kontrol düşüyor

Her iki bölüm ayrıca **gerçek sapmanın hâlâ yakalandığını** sınıyor: toplama, sapmayı
gizlemeye başlarsa düzeltme aracı da işlevsiz kalırdı. Toplam **1884 kontrol**.

### 160.3 — "Drive'da dosya var ama 0 gösteriyor": rapor sebebi söylemiyordu

Violla kartında `Reels: 1 kayıtlı → 0 Drive'a göre` yazıyordu ve haklı bir itiraz geldi:
*"Drive'da dosya mevcut."* Dosya gerçekten oradaydı — ama **`1 ONAY BEKLEYENLER`**
klasöründe, `2 ONAYLANANLAR`'da değil. Stok kuralı gereği sayı **doğruydu**: stok yalnızca
onaylanmış, yani ONAYLANANLAR klasöründe duran içeriği sayıyor.

Kusur rakamda değil, raporun sebebi söylememesindeydi. Artık fark satırının altında
şöyle yazıyor:

```
Reels: 1 kayıtlı → 0 Drive'a göre
   bu türden 1 onay bekleyenler — stoğa yalnızca onaylananlar sayılır
```

Dağılım `turunDagilimi` ile üretiliyor (saf, rakamı değiştirmez).

Test yazarken ikinci bir şey çıktı: adı yalnızca **"FOTOĞRAF"** olan kategorisiz bir kart
**Reels'e** düşüyordu — ad tahmininde `görsel|post` aranıyor ama "fotoğraf" aranmıyordu.
Kelime eklendi; çıkarıldığında kontrol düşüyor.

Ölçüm: dağılımı boş döndürmek 2 kontrol, "fotoğraf" kelimesini çıkarmak 1 kontrol
düşürüyor. Toplam **1889 kontrol**.

### 160.4 — Uyarılar hangi kart olduğunu söylemiyordu

Animed kartında `1 kartın dosyası Drive'da bulunamadı` yazıyordu ama **hangi kart**
olduğu yazmıyordu. Sayı vermek sorunu göstermek değil, yalnızca varlığını duyurmak:
kullanıcı hangi kartı açacağını bilmiyor.

Rapor kimliği zaten taşıyordu (`isId`, `isAdi`, `tur`, `asama`, `eksikSayisi`); arayüz
onu kullanmıyordu. İki uyarı da artık kartları listeliyor — diğer listelerle aynı
biçimde (ilk 8, sonra "… ve N kart daha"):

```
1 kartın dosyası Drive'da bulunamadı (elle silinmiş ya da taşınmış olabilir)
   · #97 kitle 123 (Reels, Teslim Edildi)
2 kartta hiç dosya bağlantısı yok
   · #60 Menü görseli (Post, Onaylandı)
```

Ölçüm: raporu yine yalnızca sayıya indirmek 3 kontrol düşürüyor (t86). Toplam
**1894 kontrol**.

### 161 — Rapordaki karta tek tıkla gitme

Drive raporu kartı adıyla söylüyordu (`#95 Post (Post, Onaylandı)`) ama kullanıcı onu
Operasyon'da elle aramak zorundaydı: doğru sekmeyi seç, markayı süz, sütunlarda gözle bul.

Artık rapordaki her kart satırı tıklanabilir. Tıklanınca Operasyon'a geçiliyor, **sekme
ve marka süzgeci o karta göre ayarlanıyor** ve kart açılıyor. Süzgeç ayarlanmasaydı kart
açılır ama detay kapandığında arkada başka bir kategori kalır ve kullanıcı kartı yine
kaybederdi.

İstek tek seferlik: kart açıldıktan sonra temizleniyor, yoksa kullanıcı kartı kapattığı
anda aynı kart yeniden açılır ve panodan çıkamazdı.

**Operasyon yetkisi olmayan hesapta düğme hiç çıkmıyor** — tıklanınca hiçbir şey olmayan
bir bağlantı göstermek, yetkisi olmadığını söylememekten kötü.

Ayrıca panonun varsayılan sekmesi `"Video"` yazılıydı — kategori adları değişince o ad
listede kalmadığı için açılışta hiçbir sekme seçili görünmüyordu. Listeden alınıyor.

#### Yazarken çıkan hata ve denetim sınırı

İlk yazımda iki render yerini karıştırdım: personel bloğuna yöneticininkini, yönetici
bloğuna `izinler.cekimEdit` ve `setStaffTab` verdim. `izinler` yönetici kapsamında yok,
`setStaffTab` diye bir şey ise hiç yok — yani Paylaşımlar ekranı **açılırken** patlardı.

Ölçüldü: **ne derleme ne de 22 statik denetim bunu yakaladı.** KATEGORILER hatasıyla aynı
sınıf. İki farklı denetim denendi:

- tüm dosyada tanımsız tanımlayıcı taraması → `src/App.jsx` için **673 yanlış alarm**
- yalnızca `setX(` / `handleX(` çağrı hedefleri → hâlâ **13 yanlış alarm**

Gürültülü bir denetim, olmayan denetimden kötüdür (öğrenilen refleks: görmezden gelmek).
Bu yüzden eklenmedi. **Gerçek boşluk şu: hiçbir test arayüzü render etmiyor.** Bunun
karşılığı bir tarayıcı duman testidir (yüklenen sayfada yakalanmamış hata var mı) —
ayrı bir iş olarak duruyor.

### 161 — Video: istek başına maliyet düşürüldü

Sahadan: *"Müşteri panelinde ve Operasyon'da video geç başlıyor, ileri geri yaparken
sorun çıkıyor."* Önce hiçbir değişiklik yapmadan kod okundu; aralık (Range) desteğinin
zaten çalıştığı, sorunun **her isteğin maliyetinde** olduğu görüldü. Tarayıcı her sarmada
yeni bir aralık isteği attığı için bu maliyet doğrudan sarma deneyimi demek.

Üç düzeltme — hiçbiri davranışı değiştirmiyor, aynı işi ucuza yapıyor:

**1. Belge okuması kalktı.** Video ucu, dosyanın Drive kimliğini bulmak için tüm uygulama
belgesini Redis'ten çekiyordu (tek JSON, içinde gömülü görseller, megabaytlar). Kimlik
artık jetonun içinde ve imzalı. Eski jetonlar (iki saat ömürlü) kimlik taşımadığı için
onlarda eski yol duruyor — dağıtım anında video izleyenin oynatıcısı kesilmesin.

**2. Google jetonu yeniden kullanılıyor.** Bir saat geçerli olduğu hâlde her çağrıda RSA
imza + ayrı HTTP turu yapılıyordu. Modül düzeyinde önbelleklendi, süresinden 60 saniye
önce yenileniyor, uçuştaki istek paylaşılıyor.

**3. İstemci vazgeçince indirme duruyor.** İleri sarmada tarayıcı isteği keser; bağ
olmadığı için Google'dan indirme sürüyor ve fonksiyon ayakta kalıyordu. Hızlı sarmada ölü
indirmeler birikip yeni istekleri eşzamanlılık sınırına düşürüyordu.

#### Önbelleğin getirdiği yeni risk — kapatıldı

Jeton süresi dolmadan geçersiz kılınabiliyor (anahtar döndürüldü, saat kayması). Körü
körüne tutulsa istekler süre dolana kadar 401 alırdı — **önbellekten önce olmayan** bir
takılma. 401 gelince jeton unutuluyor ve tek kez yeniden deneniyor.

OAuth jetonu ayrı modülde duruyor; önbellek onu kapsamıyor, iki kimlik karışmıyor.

#### Ölçümler

t89 eklendi (13 kontrol). Bozmalar: kimliği jetondan okumamak 1, jeton önbelleğini
kaldırmak 1, iptal bağını kaldırmak 2, 401 onarımını kaldırmak 1 kontrol düşürüyor.

Test yazarken üç ölçüm **hiçbir şey sınamıyordu** ve düzeltildi: jeton bölümü sonda
dururken önbellek zaten sıcak olduğu için "0 çağrı" veriyordu (başa alındı); 401
bölümünde taklit tesadüfen aynı jeton metnini üretiyordu (ayırt edilir yapıldı); "iki
jeton çağrısı" beklentisi sıcak önbellekte yanlıştı (jetonun değişmesine bağlandı).

Yan etkiler: `jetonCoz` artık `dosyaId` de dönüyor (t42 güncellendi); t52 jeton
isteklerini sayarak yedek yolu gözlüyordu, önbellek bunu kör ettiği için taklitleri kısa
ömürlü jeton döndürüyor. Statik denetim `async () =>` kalıbını "async çağrısı" sanıyordu —
yanlış alarm giderildi, gerçek tanımsız çağrıyı hâlâ yakalıyor (ölçüldü).

Toplam **1908 kontrol**, 22 statik denetim.

### 161.1 — İzlerken donma: tek yanıtta tüm dosya akıtılıyordu

İstek başına maliyet düşürüldükten sonra bile video **izlerken donuyordu**. Sebep
başlangıç gecikmesi değil, akışın kendisiydi.

Tarayıcı videoyu açarken `Range: bytes=0-` diyor — "buradan dosyanın sonuna kadar".
Bu aralık Google'a aynen iletiliyordu, yani fonksiyon **dosyanın tamamını tek yanıtta**
akıtmaya çalışıyordu. Sunucusuz fonksiyonun çalışma süresi sınırlı (60 sn); uzun bir
akış o sınıra takılıp **ortasından kesiliyor** ve video donuyordu. Büyük gövdeler ayrıca
yanıt boyutu sınırlarına da yaklaşıyor.

Artık her istek en fazla **3 MB**'lık bir parça döndürüyor; tarayıcı kaldığı yerden yeni
bir aralık istiyor — normal bir dosya sunucusu da böyle davranır. Her parça saniyeler
içinde bitiyor, kesilecek uzun bir akış kalmıyor. Yan fayda: parça sınırları sabit
olduğu için geri sarmada tarayıcı önbelleği devreye giriyor.

Küçük aralıklar **büyütülmüyor**: Safari önce iki bayt istiyor, onu 3 MB'a çıkarmak
gereksiz aktarım olurdu. Sondan aralık (`bytes=-500`) olduğu gibi geçiyor.

Ölçüm: aralığı aynen iletmek 3 kontrol, küçük aralığı da parçaya büyütmek 1 kontrol
düşürüyor. Toplam **1913 kontrol**.

### 161.2 — Adres kararlı: aynı videoyu ikinci kez açmak artık bedava

Jetonun bitiş zamanı jetonun **içinde** ve imzalı. Saniye saniye değiştiği için her
açılışta bambaşka bir adres üretiliyordu; adres değişince tarayıcı önbelleği de
değişiyor, yani **hiçbir parça yeniden kullanılmıyordu**. Aynı videoyu ikinci kez açmak
ilk kez açmakla birebir aynı maliyetteydi.

Bitiş zamanı artık bir saatlik ızgaraya oturuyor: aynı saat içinde aynı kayıt için
üretilen jetonlar birebir aynı, dolayısıyla adres de aynı. Önbellek süresi de bu
pencereye eşitlendi (`max-age=3600`).

**Ömür UZAMADI.** Izgara `simdi`nin tabanına oturtuluyor: jeton en fazla 2 saat (pencere
başında), en az 1 saat (pencere sonunda) yaşıyor. Üst sınır eskisiyle aynı. Yukarı
yuvarlansaydı üç saate çıkardı.

**Bayatlama riski yok:** yeni versiyon Drive'a *yeni dosya* olarak yükleniyor
(`uploadType=resumable`), yeni dosya kimliği yeni jeton ve yeni adres demek. Önbellekte
eski görüntü kalamaz.

Ölçüm: bitişi yine saniyeye bağlamak ve yukarı yuvarlamak kararlılık kontrolünü,
önbellek süresini kısaltmak başlık kontrolünü düşürüyor. Ömür kontrolü ilk yazımda
pencerenin BAŞINDAN ölçüyordu — orada taban ve tavan yuvarlama aynı sonucu verdiği için
kuralı sınamıyordu; pencere ortasına alındı ve yukarı yuvarlama bozmasında artık
düşüyor (10500 sn ≈ 3 saat). Toplam **1922 kontrol**.

### 161.3 — Açılış: adres artık tarayıcıda; ve "önce yatay, sonra dikey" giderildi

Sahadan iki belirti geldi: video hâlâ geç açılıyor, ve **oynatıcı önce yatay çıkıp
sonra dikeye dönüyor** (müşteri paneli dahil).

**Geç açılma — kalan sebep.** Video adresi (imzalı jeton) her kart açılışında sunucudan
yeniden isteniyordu: bir tur ağ gecikmesi ARTI sunucuda belge okuması, hepsi video daha
başlamadan. Adres bir önceki turda saatlik ızgaraya oturtulmuştu; artık tarayıcıda
saklanıyor ve ikinci açılışta ağa hiç çıkılmıyor.

Önbellek anahtarı bilerek `is:<kartId>:` önekiyle duruyor: kart yükleme/silme yaptığında
`onizlemeyiTazele` aynı önekle temizliyor ve adres de düşüyor. Düşmeseydi yeni versiyon
yüklendikten sonra **eski dosya** oynatılırdı — jeton dosya kimliğini taşıyor. Ömrü
30 dakika, yani jetonun en kısa ömrünün (1 saat) altında: süresi dolmuş bir adres
önbellekten çıkıp oynatıcıyı sessizce boş bırakmasın.

**Önce yatay, sonra dikey.** `<video>` etiketine oran verilmediğinde, metadata gelene
kadar kutunun boyunu **poster görseli** belirliyor. Drive'ın küçük resmi çoğu zaman
yatay olduğu için dikey bir Reels önce yatay açılıyor, metadata gelince dikeye
atlıyordu. Artık oran ilk kareden itibaren veriliyor: gerçek oran gelene kadar kartın
kayıtlı yönü (varsayılan dikey — içeriğin çoğu Reels), sonra gerçek oran devralıyor.

Yön mantığı `lib/video-yon.js`'e taşındı: React dosyasının içinde kalsaydı Node
testinden çağrılamazdı ve test kodun bir KOPYASINI sınardı.

Ölçüm (t90, 11 kontrol): oranı vermemek 4, önbelleğin sönmemesi 1, anahtarın kart
önekini taşımaması 2 kontrol düşürüyor. Toplam **1933 kontrol**.

### 161.4 — Video hiç oynamıyordu: iptal sinyali yanlış olaydan okunuyordu

Bir önceki turda eklenen iptal bağı videoyu tamamen durdurdu: oynatıcı açılıyor, süre
`--:--` kalıyor, hiçbir şey oynamıyordu.

Sebep, "istemci ayrıldı" sinyalinin **istek** (`req.on("close")`) üzerinden okunmasıydı.
GET isteğinin gövdesi yok; istek anında "tamamlanmış" sayılıyor ve Node `close` olayını
**hemen** yayıyor. Bu "istemci gitti" demek değil — ama iptal ona bağlıydı, dolayısıyla
akış daha başlamadan üst akış iptal ediliyordu.

Doğru sinyal **yanıtın** kapanması ve akışın henüz bitmemiş olması: `res.on("close")` +
`bitti` bayrağı. Bayrak normal bitişi iptalden ayırıyor; bitişte de `close` geliyor.

#### Testin kendisi hatalıydı

Bu hatanın kullanıcıya kadar gitmesinin sebebi, testin **yanlış davranışı sabitlemesiydi**:
iptali `req.emit("close")` ile ölçüyordu, yani gerçek hayatta hemen gelen bir olayı
"istemci ayrıldı" sayan kodu doğruluyordu. Test geçtiği için hata görünmedi.

Bölüm yeniden yazıldı ve artık üç şeyi birden sınıyor:
- **istek kapanması tek başına iptal ETMEMELİ** (yaşanan hatanın koruması)
- yanıt kapanınca ve akış bitmemişse iptal edilmeli
- tamamlanan aktarım iptal sayılmamalı

Ölçüm: hatayı birebir geri koymak (iptali `req`e bağlamak) 1 kontrol, `bitti` bayrağını
kaldırmak 1 kontrol düşürüyor.

Ayrıca `res.writableEnded` kontrolü kaldırıldı: hiçbir davranışı değiştirmediği ölçüldü
(bozulduğunda hiçbir kontrol düşmedi). Ölçülemeyen koruma tutmak yerine sadeleştirildi.
Toplam **1935 kontrol**.

### 162 — Paylaşım ekranı: alt yazıyı gör, kopyala, sonra işaretle

Personel içeriği Instagram'a koyarken alt yazıyı da elle taşıyor. Metin uygulamada
duruyordu (`altMetin`) ama yalnızca müşteri panelinde görünüyordu: paylaşan kişi onu
görmek için başka ekrana gidiyor, seçip kopyalıyor, geri dönüp işaretliyordu.

**İki yere eklendi:**

- **Hücrenin kutusunda** alt yazı görünüyor ve tek tuşla kopyalanıyor (salt okunur).
- **"Paylaşıldı olarak işaretle"** artık düz bir onay kutusu açmıyor: içeriğin karesi,
  alt yazı ve kopyala düğmesi olan bir ekran açılıyor. Personel kopyalar, yapıştırır,
  sonra işaretler.

Alt yazı bu ekrandan **yazılabiliyor** da — yoksa akış paylaşım anında kesilmesin diye.
Boş alt yazı **engel değil, uyarı**: bazı içerikler alt yazısız paylaşılıyor.

**Sıra önemli:** alt yazı değiştiyse işaretlemeden ÖNCE kaydediliyor. Sonra kaydedilseydi
kart "Teslim Edildi"ye geçip Drive dosyası taşındıktan sonra metin arkada kalırdı.

#### Sınanmamış bir korunma ortaya çıktı

Yeni akış alt yazıyı **tek başına** kaydediyor. Uç yalnızca gönderilen alanı değiştiriyor
(`if (gorselUrl !== undefined)`) — bu korunma vardı ama **hiçbir kontrol onu
sınamıyordu**. Bozulsaydı her paylaşımda planın müşteri panelindeki görseli sessizce
silinirdi. t12'ye altı kontrol eklendi; korunma kaldırıldığında üçü düşüyor.

#### Kural değişikliği

t81 onayı "Paylaşıldığını onaylıyor musun?" metnini arayarak sınıyordu — yani onay
KUTUSUNUN sözünü, niyetini değil. Kontroller niyete çevrildi: paylaş doğrudan
işaretlemiyor, ayrı bir onay adımı var, sonuçlar listeleniyor, alt yazı kutusu ekranda,
kaydetme işaretlemeden önce.

"Kaydetme önce" kontrolü ilk yazımda **sırayı sınamıyordu** (iki çağrı da kodda geçiyor
mu diye bakıyordu; işaretlemeyi başa alıp geçmek mümkündü — ölçüldü). Zincirin kendisine
bağlandı ve tekrar ölçüldü. Toplam **1946 kontrol**.

### 162.1 — Alt yazı kartın özelliği oldu, plan devralıyor

Alt yazı yalnızca paylaşım anında yazılabiliyordu. Oysa metin **içerik üretilirken**
düşünülüyor; paylaşan kişi onu sadece taşıyor.

**Yeni yapı:** alt yazı Operasyon kartının alanı — **onaydan önce de** yazılabiliyor.
Kart planlandığı her güne ve her şubeye metni kendiliğinden götürüyor.

Aynı kart dört şubede paylaşılabildiği için plan üzerinde **değiştirilebiliyor**; o
değişiklik yalnızca o planı etkiliyor. Kutuda hangisinin geçerli olduğu yazıyor:
*"kartın alt yazısı"* / *"bu güne özel yazılmış"*.

**Planlama ekranında da yazılabiliyor:** hücrenin kutusundaki "Alt yazıyı düzenle" aynı
ekranı *yalnızca alt yazı* kipinde açıyor — işaretleme yapmıyor, stok düşmüyor.

#### İki sessiz tuzak kapatıldı

**Kartla aynı metin plana yazılmıyor.** Yazılsaydı kart metni sonradan güncellendiğinde
o plan eski metinde takılı kalırdı — kullanıcı "değiştirmedim" derken devralmanın
kopması.

**Devralma müşteri yükünde de çözülüyor.** Müşteri paneli veriyi sunucudan alıyor ve
kartları görmüyor; orada çözülmeseydi kartta yazılan metin müşteriye **hiç ulaşmazdı** ve
özellik "yazdım ama görünmüyor" diye geri gelirdi.

#### Ölçüm

t91 eklendi (14 kontrol). Bozmalar: müşteri yükünde devralmayı kaldırmak 3 kontrol,
kartla aynı metni plana yazmak 2, boşluğu "yazılmış" saymak 1 kontrol düşürüyor.

Toplam **1960 kontrol**, 22 statik denetim.

### 162.2 — Paylaşımlar açılmıyordu: düzeltme yanlış düğmeye gitmişti

Planlı bir hücrenin üstüne gelince bölüm `null is not an object (evaluating
'paylasimEkrani.sadeceAltYazi')` ile açılmıyordu.

Sebep bir düzenleme hatası: "yalnızca alt yazı" kipinin düğme yazısını eklerken metin
dosyada **iki yerde** geçiyordu — popover'ın düğmesi ve paylaşım ekranının düğmesi.
Değişiklik ilk eşleşmeye, yani **popover'a** uygulanmıştı. Popover `paylasimEkrani`
null'ken de görünüyor; dolayısıyla üstüne gelmek bölümü düşürüyordu. Paylaşım ekranının
düğmesi ise hiç güncellenmemişti.

Popover düğmesi eski hâline döndü, kip yazısı doğru düğmeye taşındı. Artık
`paylasimEkrani` okumalarının hepsi kendi koruma bloğunun içinde.

**Bu sınıf hatanın üçüncü tekrarı** (önce `KATEGORILER`, sonra `izinler`/`setStaffTab`).
Üçünde de ortak nokta aynı: arayüz kodu değişiyor, derleme ve 1960 kontrol geçiyor, hata
ancak ekranda görünüyor. Bu turda düzenlemeler tekil eşleşme doğrulamasıyla yapıldı
(`count(...) == 1`); asıl boşluk ise duruyor — hiçbir test arayüzü render etmiyor.

### 162.3 — "Oynuyor, 1-2 sn sonra donuyor": parça çok küçüktü

Sahadan gelen tarif belirleyiciydi: *"çok geç oynuyor ve 1-2 sn sonra donup bir süre
sonra tekrar oynuyor."* Bu, parça sınırının tarifi.

Aralık parçalama 3 MB'a ayarlıydı. Yüksek bit hızlı bir Reels'te 3 MB ancak birkaç
saniyelik görüntü; her parça bitişinde yeni bir istek atılıyor ve donma tam orada
yaşanıyordu. **12 MB**'a çıkarıldı — aynı videoda on saniyeye yakın görüntü, tarayıcı
arabelleği tükenmeden bir sonrakini isteyebiliyor. Süre sınırı hâlâ uzakta: 200 KB/s gibi
kötü bir hatta bile 60 saniyenin altında iniyor.

Kontrol iki uçtan da sınırlıyor: **8 MB'dan küçük olamaz** (donma geri gelir), **24 MB'dan
büyük olamaz** (süre sınırına yaklaşır).

#### Oynatıcı artık konuşuyor

`<video>` başarısız olduğunda ekran **sessizce siyah kalıyordu** — ne kullanıcı ne de
geliştirici ne olduğunu görebiliyordu. "Neden oynamıyor" sorusu üç tur boyunca tahminle
cevaplandı; her tur bir dağıtım ve bir deneme demekti.

Artık hata yakalanıyor ve sebebi yazılıyor (ağ hatası / dosya çözümlenemedi / bağlantının
süresi dolmuş), yanında "Tekrar dene" ve "Drive'da Aç". Tekrar denemede adrese bir sayaç
ekleniyor: bozuk bir yanıt tarayıcı önbelleğine girmişse onu aşabilsin.

Ölçüm: hata mesajını boş döndürmek 1 kontrol düşürüyor (t90). Toplam **1965 kontrol**.

### 162.4 — "Bazen 30 sn, bazen 1 dk bekliyor": dosyanın kendisi ölçüldü

Parça büyütüldükten sonra donma bitti ama yeni tarif geldi: *"oynatıyor ama burada 30 sn,
1 dk bekliyor bazen."* **"Bazen"** kelimesi belirleyici — bekleme dosyadan dosyaya
değişiyorsa sebep ağ ya da sunucu değil, **dosyanın kendisi**.

Bir MP4/MOV dosyasında oynatma bilgisi `moov` kutusunda durur. Kutu **sonda** ise tarayıcı
videoyu başlatmadan önce onu bulmak zorunda: önce dosyanın sonunu istiyor, sonra başa
dönüyor. Kendi sunucumuz üzerinden geçen bir dosyada bu iki fazladan tur demek. Premiere /
After Effects'in varsayılan çıktısı `moov`u sona koyar; "fast start" seçeneği açıldığında
başa alır — bu yüzden bazı dosyalar hızlı, bazıları çok yavaş.

**Artık ölçülüyor.** Jeton verilirken dosyanın ilk birkaç kilobaytı okunuyor ve kutuların
sırası çıkarılıyor. Sonuç oynatıcının altında yazıyor:

> Bu dosya web için optimize değil (oynatma bilgisi dosyanın sonunda) — ilk açılış yavaş
> olabilir. Dışa aktarırken "fast start" seçeneğini açmak bunu kökten çözer.

**Uygulama dosyayı değiştirmiyor.** Remux etmek bu uygulamanın işi değil; doğrusu dışa
aktarımı düzeltmek. Ama hangi dosyanın yavaş olduğunu söylemek, soruyu tahminden
çıkarıyor — üç turdur tahminle ilerleniyordu.

**Teşhis yapılamazsa hiçbir şey yazılmıyor.** Yanlış bir uyarı, uyarı olmamasından kötü:
kullanıcıyı olmayan bir sorunla uğraştırır.

Ölçüm (t92, 13 kontrol): `mdat` kontrolünü kaldırmak 3, uyarıyı "teşhis edilemeyen"
dosyalara da vermek 1 kontrol düşürüyor. Kutu boyutu frenini kaldırmak testi **sonsuz
döngüye** sokuyor (çıkış kodu 124) — bozuk bir dosyanın sunucuyu kilitlemesini engelleyen
koruma.

Statik denetim `Uint8Array`'i tanımsız çağrı sanıyordu; tipli dizi kurucuları bilinen
küresellere eklendi, denetimin gerçek hatayı hâlâ yakaladığı ölçüldü.

Toplam **1978 kontrol**.

### 163 — Parçalama geri alındı: takılmanın sebebi bendim

Kullanıcı belirleyici bilgiyi verdi: *"Drive'dan alınan videolar **eskiden** daha hızlı
açılıyor ve sorunsuz oynuyordu, takılmıyordu."*

Karşılaştırma net:

| | eskiden (`fa95061`) | parçalamadan sonra |
|---|---|---|
| tarayıcı `bytes=0-` diyor | **aynen** iletiliyor → dosya **tek bağlantıda** akıyor | 12 MB'lık parçaya kırpılıyor |
| sonuç | sınır yok, kesinti yok | her 12 MB'ta yeni istek + yeni fonksiyon + yeni Google turu |

Parçalamayı 60 saniyelik fonksiyon sınırına karşı eklemiştim. **O gerekçe koddan
çıkarılmıştı, ölçülmemişti** — ve gerçek ölçüm (kullanıcının kendi deneyimi) tersini
söyledi. Daraltma kaldırıldı; aralık artık tarayıcı ne istediyse o şekilde gidiyor.

60 saniye sınırı hâlâ duruyor ama zararı çok daha az: akış oynatılan noktanın **önünde**
ilerliyor, kesilirse tarayıcı kalan aralığı bir kez yeniden istiyor. Her 12 MB'ta bir
duraklamadan iyi.

`VIDEO_PARCA_BAYT` ve `aralikDarailt` **silindi** — ölçülmemiş bir varsayıma dayanan kodu
tutmak, bir sonraki kişiye o varsayımı doğruymuş gibi devretmek olurdu.

Ölçüm: parçalamayı geri koymak t89'da 3 kontrol düşürüyor. Bölüm artık dersin kendisini
sabitliyor — tarayıcı ne isterse Google'a o gitmeli (açık uçlu, ortadan, küçük, sondan
aralık ve "aralık yok" hâlleri ayrı ayrı).

Toplam **1977 kontrol**.

### 164 — Karosel slayt sınırı 10'dan 30'a

Kullanıcı isteği: Operasyon'da karosel gönderilerin 10 fotoğraf sınırı 30'a çıkarıldı.

Sayı **tek bir sabitte** duruyor (`EN_FAZLA_SLAYT`) ve üç yer ona bakıyor: sunucu
doğrulaması (`slotGecerliMi`), boş slot bulma (`bosSlot`) ve arayüzdeki uyarı metni.
Ayrışsalardı tarayıcı 30 yuva gösterirken sunucu 11'inciyi reddederdi — ya da tersi.
Post'un tek görsellik kuralı bundan bağımsız (`enFazlaSlayt`), değişmedi.

Kontroller **sayıya değil davranışa** bakıyor: son slayt kabul, bir fazlası ret, story
slotu sınırın dışında. Ölçüm: sınırı 10'a geri çevirmek 2 kontrol, doğrulamayı sabitten
koparmak (arayüz 30 / sunucu 10) 1 kontrol düşürüyor.

Bu arada t52'de eskiden beri duran bir kusur çıktı: sınır oraya **sayıyla** yazılmıştı
("11 reddedilmeli"). Davranış doğru olduğu hâlde test düştü. Sabitten okuyacak şekilde
düzeltildi — kuralı sınıyor, sayıyı değil.

Toplam **1982 kontrol**.

### 165 — "Paylaştık ama yeşile dönmedi": kutu ekranın dışına taşıyordu

Sahadan (Şişçi İbo ekibi): *"bunu paylaştık ama tıklayınca yeşile dönmedi, bir de buradan
seçmiştim ama stok kartıyla birleşmedi."*

İkisi de tek bir sebebe çıkıyor: **işlem hiç çalışmamış.**

Hücrenin kutusu her zaman hücrenin **altına** açılıyor ve yüksekliği **sınırsızdı**.
Kutuya önizleme görseli (v161) ve alt yazı bölümü (v162) eklenince boyu ~200 px'ten
~470 px'e çıktı. Alt satırlardaki bir hücrede kutu ekranın altını taşıyor, **"Paylaşıldı
olarak işaretle" düğmesi görünmeyen bölgede kalıyor** ve tıklanamıyordu. Kutu `fixed` ve
kaydırılamaz olduğu için düğmeye ulaşmanın yolu da yoktu.

Üç koruma birden kondu — biri eksik olsa düğme yine kaçabilir:

1. Altta yer yoksa kutu **yukarı** açılıyor.
2. Boyu kalan alana göre **sınırlanıyor** ve taşarsa kaydırılıyor.
3. İşlem düğmeleri kutunun dibine **sabit** — içerik kaydırılsa bile görünür kalıyorlar.

Önizleme yüksekliği de 170'ten 130'a indirildi; kutu daha az taşıyor.

**"Stok kartıyla birleşmedi" kısmı yanlış alarm:** ekran görüntüsündeki uyarı ("Bu marka
için Drive onay klasörü tanımlı değil") yalnızca **karta bağlı** planlarda çıkıyor — yani
plan "SALON" kartına bağlıydı. Stok düşmemesinin sebebi bağlantı değil, işlemin hiç
çalışmamasıydı.

Ayrı bir gerçek eksik: **Şişçi İbo markasında Drive onay klasörü tanımlı değil.** İşaretleme
düzelse bile o marka için dosya taşınmaz; müşteri kartından tanımlanması gerekiyor.

Ölçüm: üç korumayı da kaldırmak t81'de 3 kontrol düşürüyor. Toplam **1985 kontrol**.

### 166 — Çekim listesi elle sıralanabiliyor

Liste "stoğu en az olan üstte" diye sıralanıyordu. Ama aciliyet her zaman stokla
ölçülmüyor: çekim mekâna, havaya, müşterinin uygunluğuna bağlı olabiliyor.

Artık her satırda **▲▼** var; sıra sunucuya kaydediliyor ve **herkes aynı sırayı
görüyor** — ekip aynı önceliğe bakıyor. Sıra verilmemiş markalar otomatik kurala göre
arkadan geliyor, yani sıralama hiç kullanılmazsa liste bugünkü davranışını sürdürüyor.
Üstteki "Otomatik sıraya dön" ile tek tuşla geri alınıyor.

**Sürükle-bırak yerine yukarı/aşağı tuşu:** dokunmatik ekranda da çalışıyor, yanlışlıkla
sürüklenip sıra bozulmuyor ve ek bir kütüphane gerektirmiyor.

#### Dinamik listeye dayanması gerekiyordu

Marka yalnızca stoğu eşiğin altındayken listede; çekim yapılınca çıkıyor, stok azalınca
geri geliyor. Görünmeyen markanın sırası **kayıtta korunuyor** — düşseydi kullanıcı her
turda listeyi yeniden dizerdi.

Elle sıra açıkken yeni giren markalar sona geliyor; bu, acil bir markanın aşağıda
kalabileceği anlamına geliyor. Bu yüzden ekranda uyarı yazıyor ve otomatiğe dönüş yolu
her zaman açık.

#### Ölçüm ve iki düzeltilen kusur

t93 eklendi (15 kontrol). Bozmalar: görünmeyen markanın sırasını korumamak 1, otomatik
kuralı kaldırmak 2, tekilleştirmeyi kaldırmak 1 kontrol düşürüyor.

İki ölçüm ilk turda **hiçbir şey sınamıyordu**:

- Otomatik sıra kontrolü, girdiyi zaten doğru sırada veriyordu — sıralama hiç çalışmasa
  bile geçiyordu. Girdi bilerek yanlış sıraya çevrildi.
- Uca yazdığım marka kilidi kontrolü bozulduğunda hiçbir kontrol düşmedi: ucun **merkezî**
  fail-close kuralı bu işlemi zaten reddediyormuş. Ölçülemeyen koruma **kaldırıldı** —
  tutmak, sonraki kişiye çalışıyormuş gibi görünen bir güvence devretmek olurdu.

Ayrıca t69'un `CekimListesi` gövdesini **sabit 6000 karakterle** kesmesi düzeltildi:
bileşene bir şey eklenince pencerenin dışında kalan kontroller, davranış bozulmadığı
hâlde düşüyordu — daha kötüsü, pencere kodun bir kısmını sessizce sınamayı bırakıyordu.

Toplam **2000 kontrol**.

---

## Güncelleme 158: Şube Bazlı Aylık Ücret — Toplam Şubelerden Türer, Geçmiş Ay Dondurulur

**Sorun.** Smell Coffee'nin üç şubesi ayrı ayrı faturalanıyor ve toplam 60.000 ₺ ediyordu.
Bir şube ayrılınca toplamın 45.000'e düşmesi gerekiyordu ama `aylikUcret` müşteri kaydında
**tek bir sayı** olduğu için düşmedi; ücretin neyin toplamı olduğu da hiçbir yerde
yazmıyordu. Kullanıcının isteği açıktı: eski veriyi silmeden ücreti şubelere bölmek.

**Çözüm — toplam artık elle girilmiyor.** Şubelerine ayrı ücret kesilen markalarda

> **aylık toplam = `client.temelUcret` + o markanın `subeler[].aylikUcret` toplamı**

Toplam yine `client.aylikUcret`'te duruyor — ciro, kâr marjı, ödeme takvimi, tebligat
mektubu ve dışa aktarımlar dahil 19 yerde okunuyor, hiçbiri değişmek zorunda kalmadı —
ama artık sunucu yazıyor. Şube eklenince/çıkınca toplam kendiliğinden değişiyor.

**Kurulum tek blokta:** Müşteriler → Düzenle → ŞUBELER. Üstte marka temel ücreti, altında
her şubenin kendi ücreti, en altta "60.000 = temel 15.000 + Merkez 15.000 + …" dökümü;
rakamın neyin toplamı olduğu ilk kez yazıyor. Temel ücret bilerek müşteri formunun alan
listesine KONMADI: o liste iki sütunlu ızgaraya sırayla diziliyor, araya tek alan eklemek
altındaki bütün alanların eşleşmesini kaydırıyordu (Kâr Marjı ile Ödeme Günü yan yana
düşüyordu) — istenmemiş bir arayüz değişikliği. Ayrıca temel ücret ancak şube ücretleriyle
birlikte anlam taşıyor, yeri onların yanı.

**Asıl tehlike ücret değil, GEÇMİŞTİ.** Ödeme durumu geçmiş ayları saklamıyor, her ay için
**bugünkü** ücretten hesaplıyordu. Ücret 60.000'den 45.000'e düşürülünce Temmuz da geriye
dönük 45.000 oluyordu: kısmi ödenmiş bir ay "kapanmış" görünüyor, 10.000'lik alacak
sessizce siliniyor, tahsil edilmiş 60.000 ise "fazla ödeme" gibi duruyordu. Yani ücreti
güncellemek fatura geçmişini bozuyordu.

Artık ücret her değiştiğinde `client.ucretGecmisi`'ne bir **dönem** düşülüyor
(`{ baslangicAy, tutar, dagilim }`) ve ödeme hesabı o ayı kapsayan dönemin tutarını
kullanıyor. Ay ay değil dönem kaydı tutuluyor: liste yalnızca ücret değiştikçe uzuyor.
`0000-00` "geçmişin tamamı" demek.

**Tutar aynıyken dağılım değişirse yeni dönem AÇILMIYOR**, yürürlükteki döneme yazılıyor.
60.000'i ilk kez "15.000 temel + 3×15.000 şube" diye tanımlamak tam olarak bu: **tutar
korunuyor, geçmiş aylar aynı rakamla ama artık şube şube okunabilir hale geliyor** —
kullanıcının istediği "eski veriyi silmeden bölmek".

**Özelliği kullanmayan markada hiçbir şey değişmiyor.** İkisi de girilmemişse
`ucretleriTazele` `null` dönüyor ve `clients` alanına dokunulmuyor — dokunsaydı sürüm
sayacı boş yere artar, aynı anda çalışan başkası 409 alırdı.

**Yan düzeltme: gecikmiş borç `aylikUcret × ay sayısı` ile hesaplanmıyor artık.** Panodaki
"Ödenmeyen Ödemeler" bu çarpımı kullanıyordu; ücret değişmiş bir markada bütün geçmişi
YENİ ücretle sayar ve tebligata yanlış tutar yazardı. Müşteri detayının zaten kullandığı
`clientOverdueBalance` (ay ay gerçek bakiye) buraya da bağlandı — iki ekran artık aynı
rakamı gösteriyor.

**Yetki.** Şube ücretini yalnızca yönetici değiştirebiliyor (`subeUcret` → 403). Bu uca
`paylasimlar` izni olan herkes girebiliyor; stok işaretlemeye yeten izin fiyat belirlemeye
yetmez. Aynı sebeple yanıtta `clients` yalnızca yöneticiye gönderiliyor — içinde
`aylikUcret`, `maliyetler`, `odemeKayitlari` var.

**Ödeme hesabı `src/tema.jsx`'ten `lib/odeme-hesabi.js`'e taşındı.** Sebep tek: `.jsx`
Node'da çalışmadığı için para hesabı yapan bu üç işlev hiçbir testten **çağrılamıyordu**,
yalnızca kaynak metnine bakılabiliyordu — bu projede açıkça yasak olan şey. Arayüz için
hiçbir şey değişmedi, `tema.jsx` üçünü de yeniden dışa veriyor.

**Ölçüm (t94, 56 kontrol).** Korumalar tek tek geri konulup kaç kontrolün düştüğü ölçüldü.
Saf mantıkta: geçmiş ay dondurmasını kaldırmak **4**, ücret dönemi kaydını kaldırmak **4**,
şubelerin marka süzgecini kaldırmak **17**, "değişiklik yoksa `null`" korumasını kaldırmak
**2**, aynı ay tek dönem kuralını kaldırmak **1**, geriye dönük döküm yazımını kaldırmak
**9**. Uç bağlantılarında: `api/paylasim.js` tazelemesini kaldırmak **5**, yönetici
kontrolünü kaldırmak **2**, boş ücret alanının silinmesini kaldırmak **1**,
`api/data.js`in yönetici yolunu kaldırmak **3**, personel yolunu kaldırmak **1**.

İki kez ölçüm bir şey yakaladı:

- İlk yazımda iki kontrol **hiçbir şey ölçmüyordu**: geçmiş ayı *tam* ödenmiş seçmiştim ve
  60.000'lik ödeme 45.000'lik ayı da kapattığı için koruma kaldırıldığında da geçiyorlardı.
  Senaryo kısmi ödemeye çevrildi; o iki kontrol artık gerçekten düşüyor.
- Uca gerçek istek atan bölüm eklenince **gerçek bir eksik** çıktı: `api/data.js`in İKİ
  ayrı kayıt yolu var (yönetici blob'u ve personelin alan bazlı birleştirmesi) ve tazeleme
  yalnızca ikincisine bağlanmıştı. Yani yönetici müşteri kartından temel ücreti
  değiştirdiğinde toplam eski hâlinde kalıyordu — günlük kullanımdaki en sık yol. Saf
  modül testleri bunu göremezdi.

Toplam **2056 kontrol**.

---

## Güncelleme 159: Müşteri Hesap Özeti (Ekstre) ve Fatura Kaydı

**İstek.** "Fatura kesildi, faturadan kalan ödeme, diğer ödemeler — hepsinin detaylı
dökümanını müşterime iletmek istiyorum."

**Eksik olan tek şeydi: fatura kaydı.** Sistemde fatura no, fatura tarihi, fatura tutarı
yoktu; yalnızca "aylık ücretin ne kadarı faturalı" diye tek bir sayı vardı ve o ay bazlı
değildi. Artık ödeme kaydının yanında **fatura kaydı** da tutuluyor
(`{ ay, no, tarih, tutar, not }`), ödeme kayıtlarıyla aynı uçtan, aynı yetkiyle, aynı işlem
kimliğiyle — para verisinde sessiz tekrar en pahalı hata. Yeni fonksiyon dosyası açılmadı.

**Hesap özeti.** Müşteri kartında "Hesap Özeti" düğmesi: tarih aralığı seçiliyor, ekranda
özet görünüyor, **Yazdır / PDF** ile tebliğ mektubuyla aynı yoldan çıktı alınıyor. Belgede
her ay için hizmet bedeli (varsa şube dökümüyle), o ayın faturaları, tahsilatları ve kalan
bakiye; altta toplam.

**Üç kavram karışmıyor — karışsaydı müşteriye yanlış borç gösterirdik:**

| | |
|---|---|
| **Tahakkuk** | O ayın hizmet bedeli. Kaynağı `ayinUcreti` — o ayda **yürürlükte olan** ücret, bugünkü değil. |
| **Fatura** | Tahakkukun **belgelenen** kısmı. Tahakkuka **eklenmez**, onun içindedir. |
| **Tahsilat** | O aya işlenmiş ödeme kayıtları. |

`bakiye = tahakkuk − tahsilat`. Fatura bakiyeyi değiştirmez; eklenseydi faturalı bir ay
müşteriye **iki kez** borçlandırılırdı — belge müşteriye gittiği için en pahalı hata orası.

Ödemeler tek tek faturalara **bağlanmıyor**: veride böyle bir bağ yok ve olmayan bir
eşleştirmeyi uydurmak, müşterinin belgesinde doğrulanamayan bir iddia olurdu. Ekstrenin
birimi ay — ödeme kayıtları zaten ay taşıyor.

**Belge müşteriye gidiyor**, bu yüzden `lib/ekstre-belgesi.js` iç bilgi taşımıyor (maliyet,
kâr marjı, diğer markalar) ve marka adı HTML'e kaçırılarak giriyor.

### Testin yakaladığı iki şey

**1. Başlamadığı aya bedel yazılıyordu.** Ücret dönemlerinin ilki `0000-00` ("geçmişin
tamamı") olduğu için geriye doğru sorulan bir ekstre, markanın **hiç çalışmadığı** aylara
da hizmet bedeli yazıyordu: Haziran 2026'da başlayan marka 2020'den beri borçlu çıkıyordu.
Müşteriye giden bir belgede olmayan bir alacağın iddia edilmesi olurdu. `client.baslangic`
öncesinde tahakkuk sıfır; o aylardaki ödeme/fatura kayıtları yine gösteriliyor — kayıt
varsa gerçekten olmuştur.

**2. Testin kendisi hiçbir şey ölçmüyordu.** Bölümler `await` edilmediği için hiç çalışmadı;
dosya "43 kontrolden 15'i geçti, 0 kaldı" deyip **başarıyla** çıktı ve koşucu da yakalayamadı
(çıkış kodu 0, ✗ yok). Hiçbir şey ölçmeyen bir testin geçmesi, testin hiç olmamasından
tehlikeli: koruma var sanılır. Bölümler `await`e alındı ve dosyanın sonuna, çalışan kontrol
sayısını sabitle karşılaştıran bir bekçi kondu.

Ayrıca **olmayan bir koruma anlattığım bir yorum silindi**: "toplam bakiye satır
bakiyelerinin toplamı değildir" diye uzun bir gerekçe yazmıştım — ölçüldü, ikisi
matematiksel olarak aynı şey (Σ(a−b) = Σa−Σb). Olmayan bir korumayı anlatan yorum sonraki
oturumu yanlış yönlendirir.

### Ölçüm

t95 · **44 kontrol**. Korumalar tek tek geri konuldu:

| Kaldırılan koruma | Düşen kontrol |
|---|---|
| Fatura bakiyeye eklenmiyor | 28 |
| Her ay kendi ücretiyle | 11 |
| Ay normalleme (`2025-1` → `2025-01`) | 12 |
| Hareketsiz ay atlama | 22 |
| Başlangıç öncesi aya bedel yazılmaması | 4 |
| Fazla ödemenin sıfırlanmaması | 1 |
| Ters aralık koruması | 1 |
| HTML kaçırma | 1 |
| Aysız fatura reddi | 1 |
| Kontrol sayısı bekçisi | 1 |

### Sonradan çıkan eksik: geçmiş ayın faturası girilemiyordu

Fatura kutusu ilk turda yalnızca müşteri kartındaki ödeme kutusuna bağlanmıştı; o kutu
`monthKey()` ile **içinde bulunulan ayı** açıyor. Yani Temmuz'da kesilmiş bir faturayı
kaydetmenin yolu yoktu ve ekstre geçmiş faturaları hiç gösteremezdi. Ödeme Takvimi'ndeki
aynı kutu (hangi aya tıklarsan o ay) da bağlandı.

Bu, bu turda ikinci kez tekrarlayan bir hata sınıfı: **bir işleyici tanımlanıyor ama
bileşenin bütün çağrı yerlerine geçirilmiyor.** Aynısı şube ücretinde de oldu
(`api/data.js`in iki kayıt yolundan yalnızca birine bağlanmıştı). Derleme ve testler
ikisini de göremiyor; ilkini uca istek atan bir test yakaladı, ikincisini kullanım
adımlarını anlatırken koddan doğrularken fark ettim. Arayüzü gerçekten çizen bir test
katmanı olmadığı sürece bu sınıf açık kalıyor.

Toplam **2100 kontrol**.
