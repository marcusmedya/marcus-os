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

## Notlar
- Uygulama şu an örnek (demo) verilerle geliyor. Gerçek verilerini bağlamak istediğinde `src/App.jsx` içindeki `clients`, `monthly`, `operasyonlar` gibi listeleri kendi verilerinle değiştirebiliriz, ya da bir sonraki adımda bunları düzenleyebileceğin bir veri giriş ekranı ekleyebiliriz.
- API anahtarın hiçbir zaman tarayıcıya gönderilmiyor; `api/chat.js` sunucu tarafında çalışıyor.
