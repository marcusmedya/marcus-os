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

## Notlar
- Uygulama şu an örnek (demo) verilerle geliyor. Gerçek verilerini bağlamak istediğinde `src/App.jsx` içindeki `clients`, `monthly`, `operasyonlar` gibi listeleri kendi verilerinle değiştirebiliriz, ya da bir sonraki adımda bunları düzenleyebileceğin bir veri giriş ekranı ekleyebiliriz.
- API anahtarın hiçbir zaman tarayıcıya gönderilmiyor; `api/chat.js` sunucu tarafında çalışıyor.
