# Marcus Medya App — Sistem Tanıtımı

Bu belge, uygulamayı hiç bilmeyen birine (ya da bir yapay zekaya) baştan anlatmak için
hazırlandı. Okuyan kişi bunu okuduktan sonra sistemin ne yaptığını, nasıl kurulduğunu ve
hangi kurallarla çalıştığını bilir.

---

## 1. Bu nedir

**Marcus Medya App**, bir medya/reklam ajansının tüm işini tek yerden yöneten özel yazılım.
Hazır bir ürün değil, sıfırdan bu ajans için yazıldı.

Üç farklı kişi kullanır:

| Kim | Ne yapar |
|---|---|
| **Yönetici (CEO)** | Her şeyi görür ve yönetir |
| **Personel / çözüm ortağı** | Yalnızca kendisine verilen bölümleri ve atandığı markaları görür |
| **Müşteri** | Kendi markasının içeriklerini görür, onaylar ya da revize ister |

Canlı adres: `marcus-os-iota.vercel.app`

---

## 2. Ne işe yarıyor — asıl akış

Sistemin kalbi şu döngü:

```
1. İçerik fikri hazırlanır      → Müşteri Paneli'nden müşteriye gönderilir
2. Çekim yapılır                 → Operasyon'da kart açılır
3. Edit / tasarım yapılır        → Kart aşama aşama ilerler
4. "Kontrol Bekliyor" olur       → Müşteri panelinde otomatik görünür
5. Müşteri onaylar ya da revize ister
   • Onay   → kart "Onaylandı"ya geçer
   • Revize → kart "Revize İstendi"ye geçer, atanan kişiye e-posta gider
6. Onaylanan içerik paylaşım planına konur
7. Paylaşıldıkça işaretlenir     → Günlük Kontrol'de takip edilir
```

**En önemli tasarım kararı:** Müşteri paneli, Operasyon'un **canlı aynasıdır.** Ayrı bir
kopya tutulmaz. Bir iş "Kontrol Bekliyor" aşamasındaysa müşteri onu görür; aşama değişince
görünürlüğü de anında değişir. Bu yüzden iki taraf hiçbir zaman birbirinden farklı bir şey
gösteremez.

---

## 3. Teknik yapı

| Katman | Teknoloji |
|---|---|
| Arayüz | React + Vite (tek sayfa uygulama) |
| Sunucu | Vercel serverless fonksiyonları (`api/*.js`) |
| Veritabanı | Upstash Redis (`@vercel/kv`) — tek bir JSON bloğu |
| E-posta | Resend |
| Barındırma | Vercel (Hobby planı) |
| Kod deposu | GitHub — `marcusmedya/marcus-os` |

**Toplam ~15.000 satır kod.** Ana dosyalar:

- `src/App.jsx` — yönetici paneli (en büyük dosya)
- `src/tema.jsx` — renkler, ortak bileşenler, hesaplama yardımcıları
- `src/musteriPaneli.jsx` — müşteri paneli
- `src/CekimEditTakibi.jsx` — Operasyon (iş takibi)
- `src/personel.jsx`, `src/TeklifSozlesme.jsx`, `src/drive.jsx`, `src/instagram.jsx`
- `lib/` — sunucu ortak katmanları (yazma güvenliği, oturum, marka kilidi, müşteri görünümü, e-posta)

### Önemli kısıt
Vercel Hobby planı **en fazla 12 serverless fonksiyon** izin veriyor. Şu an 11 kullanılıyor.
Yeni sunucu yeteneği gerektiğinde ayrı dosya açmak yerine mevcut bir uç noktaya "action"
parametresi eklenir.

---

## 4. Veri modeli

Tüm veri **tek bir JSON nesnesi** olarak Redis'te durur. 28 ana alan:

**Müşteri & iş:** `clients`, `musteriIcerikleri`, `cekimIsleri`, `markalasmaSurecleri`, `subeler`

**Para:** `gelirKalemleri`, `giderKalemleri`, `ofisGiderleri`, `bekleyenTahsilatlar`,
`hesaplar`, `hesapTransferleri`, `hesapDuzeltmeleri`, `birikimler`, `vergiTakvimi`, `monthly`

**Ekip:** `personel`, `freelancerlar`, `avanslar`, `personelOdemeleri`, `isUcretleri`

**Paylaşım:** `haftalikPaylasimlar`, `paylasimGecmisi`, `stoklar`, `gunlukKontrol`

**Diğer:** `reklamlar`, `hesapOlcumleri`, `teklifler`, `uyelikler`, `musteriGirisleri`,
`silinenler`, `markaKimligiGorseli`

### Kırılmaması gereken muhasebe kuralları

1. **Avanslar ve maaş ödemeleri Toplam Gider'i değiştirmez.** Maaş zaten personel giderinde,
   freelancer ücreti müşteri maliyetinde sayılıyor. Tekrar sayılırsa çift hesap olur. Bunlar
   yalnızca o ayın ödenecek tutarını ve hesap bakiyesini düşürür.

2. **Hesap bakiyesi saklanmaz, hesaplanır:** müşteri ödemeleri + gelen transferler − giden
   transferler − avanslar − ödemeler + düzeltmeler. Her işlemin geri alınabilir olmasının
   sebebi budur.

3. **Kârlılık tutar üzerinden ölçülür, yüzde üzerinden değil.** Maliyetler *doğrudan*
   maliyetlerdir: elle girilen kalemler + o markanın o ayki freelancer iş ücretleri.
   Maaşlı ekip zamanı hiçbir müşteriye dağıtılmaz — bu yüzden doğrudan maliyeti olmayan bir
   markanın marjı gerçekten %100'dür ve öyle hesaplanır.

   **Reklam bütçesi maliyete DAHİL DEĞİLDİR.** O para müşterinin harcamasıdır, ajansın gideri
   değil. Ajans reklam parasını kendi ödüyorsa Müşteri > Maliyetler kalemine girilmelidir.

---

## 5. Ekranlar

Sol menü altı satır, gruplu:

```
Dashboard          → finansal KPI'lar ve "Bugünün Kararı" (başka hiçbir şey yok)
Planım             → kişisel görevler ve Onayını Bekleyenler kutusu
MÜŞTERİ            Müşteriler · Müşteri Hesapları · Teklif & Sözleşme · Reklamlar
PARA               Finans · Ödeme Takvimi · Personel · Birikim · Üyelikler
ÜRETİM             Operasyon · Çekim · Günlük Kontrol · Paylaşımlar · Müşteri Paneli
Şifre Kasası       → müşteri hesaplarının sosyal medya şifreleri
Ayarlar

Sol menü kenarından sürüklenerek genişletilebilir (180–420 px), genişlik cihazda hatırlanır.
```

### Operasyon (iş takibi)
Üç kategori, her birinin kendi aşama akışı var:

- **Video:** Çekim Planlandı → Çekim Yapıldı → Dosyalar Aktarıldı → Edit Bekliyor →
  Edit Yapılıyor → Kontrol Bekliyor → Revize İstendi → Onaylandı → Teslim Edildi
- **Fotoğraf:** Çekim Yapıldı → Düzenleniyor → Kontrol Bekliyor → …
- **Grafik Tasarım:** Talep Alındı → Tasarım Bekliyor → Tasarım Yapılıyor → Kontrol Bekliyor → …

### Müşteri Paneli (müşterinin gördüğü)
Altı sekme: Onay Bekleyenler · Revize İstediklerin · Onayladıkların · Paylaşım Takvimi ·
Reklamlar · Üretim Durumu.

İçerik türleri müşteriye kendi dilinde gösterilir: **Reels · Görsel · Tasarım**
(sistemdeki karşılıkları Video · Fotoğraf · Grafik Tasarım).

### Finans
İki ana rakam üstte: **Nakit Akışı** (bu ayki net) ve **Kasada Bulunan** (tüm hesapların
türetilmiş bakiyesi). Altında ciro, KDV, tahsilat oranı, bekleyen ödeme.

**Gider Dağılımı** kartı toplam gideri kalem kalem açar:
Personel (maaş / SGK / yemek / kıdem tazminatı birikimi) · Ofis gideri · Müşteri maliyetleri ·
Üyelikler · Diğer gider kalemleri. Sıfır olan kalemler gösterilmez.

### Bugünün Kararı (Dashboard)
Yapay zeka **kullanmaz** — tamamen kural tabanlıdır, maliyeti sıfırdır. Verilerden doğrudan
çıkarır: en çok kazandıran müşteri, zarar ettiren müşteri, tek müşteriye bağımlılık oranı,
geciken paylaşımlar, üç kereden fazla revize almış içerikler, bekleyen tahsilatlar.

---

## 6. Yetkilendirme

15 ayrı izin var: `dashboard`, `musteriler`, `finans`, `odemeTakvimi`, `teklif`, `reklamlar`,
`paylasimlar`, `cekimListesi`, `cekimEdit`, `personel`, `birikim`, `uyelikler`, `sifreKasasi`,
`musteriAkisi`.

**Kritik nokta:** İzinler yalnızca arayüzü gizlemez — **sunucu, izin verilmeyen veriyi
tarayıcıya hiç göndermez.** Yani kapalı bir bölümün verisi personelin bilgisayarına ulaşmaz.

### Marka kilidi
Bir personel hesabına marka listesi atanabilir ("çözüm ortağı"). O hesap yalnızca o markaların
verisini görür. Marka kilidi olan hesapta ajans geneli bölümler (Finans, Personel, Dashboard)
izin verilmiş olsa bile kapanır — çünkü o veriler markaya göre süzülemez.

### Çözüm ortağı paneli
Ortak, atandığı markanın panelini **müşterinin gördüğü hâliyle** görür — ama iki sekmeyle
sınırlı: Üretim Durumu ve Onaylananlar. Müşteri adına onay veremez.

Bu görünüm kopyalanmaz; müşteri paneliyle **aynı sunucu fonksiyonundan** üretilir, böylece
ikisi ayrışamaz.

---

## 7. Veri güvenliği ve yedekleme

Yedek katmanları:

- Günlük anlık görüntü (30 gün saklanır)
- Saatlik anlık görüntü (48 saat)
- Geri yükleme öncesi güvenlik kopyası (30 gün) — yanlış geri yükleme de geri alınabilir
- Her gece 03:00 tam JSON eki ile e-posta yedeği
- Pazar günleri haftalık arşiv kopyası
- Elle JSON dışa/içe aktarma
- Veri boyutu %60 ve %85'e ulaşınca uyarı e-postası

Yedek **tüm veri bloğunu** kopyalar, alan listesi tutmaz — yani sonradan eklenen her alan
otomatik olarak yedeğe girer.

### Veri kaybı frenleri
- Boş, eksik ya da bozuk veri yazma denemesi reddedilir (400/409)
- Müşteri sayısı ani düşerse kayıt durur ve onay ister
- Aynı anda iki sekmeden yazma çakışması tespit edilir
- Silinen 15 tür kayıt 30 gün geri dönüşüm kutusunda durur, tek tıkla geri alınır
- Güvenlik defteri ayrı bir anahtarda tutulur — geri yükleme onu silmez

---

## 8. Kalite kontrol altyapısı

Her paket öncesi **16 otomatik kod denetimi** ve **30 sunucu test dosyası (~200 kontrol)**
çalıştırılır.

Denetimler şunları yakalar: sözdizimi hataları, çift tanım, eksik import, tanımsız değişken,
kapsam dışı kullanım, bağlanmamış düğme, değiştirilemeyen durum, eksik ekran öğesi, tanımsız
sabit, müşteri panelinde düşen alan.

Sunucu testleri: marka kilidi sızıntısı, markalar arası yazma, eşzamanlı yazma, eski sekme
çakışması, geri yükleme, oran sınırlama, müşteri/ortak yetki sınırları, kâr hesabı, paylaşım
senkronu.

Bu altyapı baştan planlanmadı — **her gerçek hatadan sonra bir denetim eklendi.**

---

## 9. Bilinen sınırlar ve açık işler

- Vercel Hobby: 11/12 fonksiyon dolu (1 boş slot)
- `RESEND_API_KEY` doğrulanmadı — eksikse gece yedek e-postaları ve revize bildirimleri gitmez
- Google Drive gerçek entegrasyonu yok (şu an yalnızca bağlantı saklanıyor)
- Meta/Instagram reklam entegrasyonu araştırıldı ama yapılmadı
- Mobil uyum yapıldı ama detaylı test edilmedi

---

## 10. Çalışma yöntemi

Kod, Claude ile sohbet üzerinden geliştiriliyor. Her sürüm bir zip olarak veriliyor, kullanıcı
GitHub'a yüklüyor, Vercel otomatik yayına alıyor.

**Dikkat:** GitHub'ın "Upload files" özelliği dosya **silmez.** Bir dosya kaldırıldığında
kullanıcının elle silmesi gerekir, yoksa eski dosya repoda kalır.

Şu anki sürüm: **v136**.
