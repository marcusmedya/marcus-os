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

## Notlar
- Uygulama şu an örnek (demo) verilerle geliyor. Gerçek verilerini bağlamak istediğinde `src/App.jsx` içindeki `clients`, `monthly`, `operasyonlar` gibi listeleri kendi verilerinle değiştirebiliriz, ya da bir sonraki adımda bunları düzenleyebileceğin bir veri giriş ekranı ekleyebiliriz.
- API anahtarın hiçbir zaman tarayıcıya gönderilmiyor; `api/chat.js` sunucu tarafında çalışıyor.
