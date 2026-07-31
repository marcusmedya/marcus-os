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

## Notlar
- Uygulama şu an örnek (demo) verilerle geliyor. Gerçek verilerini bağlamak istediğinde `src/App.jsx` içindeki `clients`, `monthly`, `operasyonlar` gibi listeleri kendi verilerinle değiştirebiliriz, ya da bir sonraki adımda bunları düzenleyebileceğin bir veri giriş ekranı ekleyebiliriz.
- API anahtarın hiçbir zaman tarayıcıya gönderilmiyor; `api/chat.js` sunucu tarafında çalışıyor.
