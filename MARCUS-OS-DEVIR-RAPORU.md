# Marcus OS — Devir Raporu

**Tarih:** 18 Ağustos 2026 · **Sürüm:** v155 · **Durum:** Yayında, çalışıyor

Bu belge, projeyi Claude Code ile devralacak olan için hazırlandı. Uygulamanın ne olduğu,
nasıl kurulduğu, hangi kuralların kırılmaması gerektiği ve **nerede kalındığı** burada.

---

# 1. Proje nedir

**Marcus Medya App** — bir medya/reklam ajansının işini tek yerden yöneten özel yazılım.
Hazır ürün değil, sıfırdan bu ajans için yazıldı. Yaklaşık **16.600 satır** kod.

Üç kullanıcı tipi:

| Kim | Ne yapar |
|---|---|
| **Yönetici (CEO)** | Her şeyi görür ve yönetir |
| **Personel / çözüm ortağı** | Yalnızca verilen bölümleri ve atandığı markaları görür |
| **Müşteri** | Kendi markasının içeriklerini görür, onaylar, revize ister, içerik talep eder |

**Canlı:** `marcus-os-iota.vercel.app`
**Depo:** GitHub → `marcusmedya/marcus-os`

---

# 2. Teknik yapı

| Katman | Teknoloji |
|---|---|
| Arayüz | React + Vite (tek sayfa uygulama) |
| Sunucu | Vercel serverless (`api/*.js`) |
| Veritabanı | Upstash Redis (`@vercel/kv`) — **tek bir JSON bloğu** |
| E-posta | Resend |
| Barındırma | Vercel **Hobby planı** |

## Dosya haritası

**Arayüz (`src/`)**
```
App.jsx              8.507 satır   yönetici paneli, en büyük dosya
CekimEditTakibi.jsx  1.757         Operasyon (iş takibi)
musteriPaneli.jsx    1.322         müşteri paneli
tema.jsx             1.004         renkler, ortak bileşenler, computeLive()
finans.jsx             823         Finans (5 sekme)
personel.jsx           721         personel, maaş, avans
TeklifSozlesme.jsx     619         teklif ve sözleşme
drive.jsx, instagram.jsx, hataYakalayici.jsx, gorselKucult.js, data.js
```

**Sunucu (`api/` — 11/12 dolu)**
```
data.js            ana veri uç noktası — okuma, yazma, müşteri işlemleri, Drive taşıma
paylasim.js        paylaşım planı ve stok
backup.js          yedek listesi
daily-backup.js    gece yedeği (cron 03:00)
daily-reminders.js hatırlatma e-postaları (cron 15:00 UTC)
manage-staff.js    personel ve müşteri hesapları
notify-job.js      durum bildirimi e-postaları
kasa.js, client-payment.js, devir-teslim.js, logo.js
```

**Ortak katmanlar (`lib/` — slot saymaz)**
```
kv-yaz.js           yazma güvenliği, kilit, sürüm çakışması, güvenlik defteri
oturum.js           oturum anahtarı, 2FA
marka-kilidi.js     marka bazlı veri süzme
musteri-gorunumu.js müşteri + ortak görünümünü üreten TEK kaynak
eposta.js           ortak e-posta göndericisi
drive-tasima.js     Google Drive dosya taşıma (YENİ, kurulum yarım)
```

## ⚠ Sert kısıt: 11/12 serverless fonksiyon

Vercel Hobby planı **en fazla 12** fonksiyona izin veriyor. Yeni bir `api/` dosyası açmak
yerine **mevcut uç noktaya "action" parametresi ekle**. `lib/` altındaki kod slot saymaz.

Bu sınır bir kez aşıldı ve derleme kırıldı (v120).

---

# 3. Veri modeli

Tüm veri **tek bir JSON nesnesi** olarak Redis'te durur. Ana alanlar (28 + birkaç yönetici-özel):

**Müşteri & iş:** `clients`, `musteriIcerikleri`, `musteriTalepleri`, `cekimIsleri`,
`markalasmaSurecleri`, `subeler`

**Para:** `gelirKalemleri`, `giderKalemleri`, `ofisGiderleri`, `bekleyenTahsilatlar`,
`hesaplar`, `hesapTransferleri`, `hesapDuzeltmeleri`, `birikimler`, `vergiTakvimi`, `monthly`

**Ekip:** `personel`, `freelancerlar`, `avanslar`, `personelOdemeleri`, `isUcretleri`,
`isUcretDetaylari`

**Paylaşım:** `haftalikPaylasimlar`, `paylasimGecmisi`, `stoklar`, `gunlukKontrol`

**Diğer:** `reklamlar`, `hesapOlcumleri`, `teklifler`, `uyelikler`, `musteriGirisleri`,
`silinenler`, `markaKimligiGorseli`, `paylasimGorseli`, `acikZeminLogosu`

**Boyut sınırı:** Vercel istek sınırı ~4.5 MB. Veri bunu aşarsa **kayıtlar tamamen durur.**
Uyarı %60 ve %85'te geliyor. Şu an ~390 KB, rahat.

---

# 4. KIRILMAMASI GEREKEN KURALLAR

Bunlar acı çekilerek öğrenildi. Değiştirmeden önce iki kez düşün.

## Muhasebe

1. **Avanslar ve maaş ödemeleri Toplam Gider'i İKİNCİ KEZ artırmaz.** Maaş zaten
   `personelGideri` içinde, freelancer ücreti `clientCosts` içinde. Tekrar sayılırsa çift
   hesap olur. Bunlar yalnızca o ayın ödenecek tutarını ve hesap bakiyesini düşürür.

2. **Hesap bakiyesi SAKLANMAZ, hesaplanır:** müşteri ödemeleri + gelen transferler − giden
   transferler − avanslar − ödemeler + düzeltmeler. Her işlemin geri alınabilir olmasının
   sebebi budur.

3. **Kârlılık TUTAR üzerinden ölçülür, yüzde üzerinden değil.** Maliyetler *doğrudan*
   maliyetlerdir: elle girilen kalemler + o markanın o ayki freelancer iş ücretleri.
   Maaşlı ekip zamanı hiçbir müşteriye dağıtılmaz — bu yüzden doğrudan maliyeti olmayan bir
   markanın marjı gerçekten %100'dür.

4. **Reklam bütçesi maliyete DAHİL DEĞİLDİR.** O para müşterinin harcamasıdır. Bir kez dahil
   edildi ve "7 Lezzet marjı %0" gibi yanlış sonuçlar üretti (v134'te düzeltildi).

## Mimari

5. **Müşteri paneli Operasyon'un CANLI AYNASIDIR**, kopya değil. Bir iş "Kontrol Bekliyor"
   aşamasındaysa müşteri onu görür; aşama değişince görünürlüğü de değişir. "Kopyalayalım"
   önerisi bu mimariyi bozar.

6. **Müşteri ve ortak görünümü TEK fonksiyondan üretilir** (`lib/musteri-gorunumu.js`).
   Kopyalanırsa zamanla ayrışır ve "müşteri ne görüyorsa ortak da görsün" kuralı sessizce
   bozulur.

7. **Müşteriye giden alanlar TEK TEK seçilir**, blok halinde geçirilmez. Yoksa iç notlar,
   maliyetler, kameraman adları sızar.

8. **MARKA KİLİDİ:** personel hesabına `markalar` listesi atanabilir. Yeni eklenen her
   marka/müşteri taşıyan alan `lib/marka-kilidi.js` içindeki `DIZI_ALANLARI` ya da
   `NESNE_ALANLARI` listesine eklenmelidir; ajans geneli alanlar `AJANS_GENELI_ALANLAR`'a.
   Eklenmezse kilitli hesaplara sızar.

9. **İzinler sunucu tarafındadır.** Kapalı bir bölümün verisi tarayıcıya hiç gönderilmez.
   "Arayüzde gizleyelim" yetersizdir.

10. **`guvenliGuncelle` geri çağrısı `{ veri }` döndürmelidir** (ya da
    `{ iptal: true, hata, kod }`). Doğrudan veri döndürmek kaydı sessizce bozar.

11. **Sayfaları birleştirmeden önce:** her menü maddesinin kendi izni var. Birleştirilirse
    her bölüm ayrı ayrı izne bağlanmalı, yoksa Müşteriler izni olan Finans'ı görür.

---

# 5. Yedekleme ve veri güvenliği

Katmanlar:
- Günlük anlık görüntü (30 gün)
- Saatlik anlık görüntü (48 saat)
- Geri yükleme öncesi güvenlik kopyası (30 gün) — yanlış geri yükleme de geri alınabilir
- Her gece 03:00 tam JSON ekli e-posta yedeği
- Pazar haftalık arşiv
- Elle JSON dışa/içe aktarma
- Veri boyutu uyarısı (%60, %85)

**daily-backup tüm veri bloğunu kopyalar**, alan listesi tutmaz — sonradan eklenen her alan
otomatik yedeğe girer.

Frenler:
- Boş/eksik/bozuk veri yazımı reddedilir (400/409)
- Müşteri sayısı ani düşerse kayıt durur ve onay ister
- Eşzamanlı yazma çakışması tespit edilir (sürüm karşılaştırma)
- 15 tür kayıt 30 gün geri dönüşüm kutusunda durur

---

# 6. Test ve denetim altyapısı

**Her paket öncesi `./testler/hepsinidenetle.sh` çalıştırılır.**

## 17 statik kod denetimi (`testler/*.py`)
```
 1 sözdizimi                    10 JSX'te tanımsız değişken
 2 şablon bozulması             11 müşteri paneli alan kaybı
 3 çift tanım (blok kapsamlı)   12 kapsam dışı kullanım
 4 JSX yapısı                   13 değiştirilemeyen durum
 5 eksik bileşen/ikon           14 yayılımda gelmeyen ad
 6 React hook kuralları         15 ekran öğeleri envanteri
 7 tanımsız çağrı               16 tanımsız BÜYÜK_HARF sabit
 8 buton bağlantıları           17 erişilemeyen ad (dosyalar arası)
 9 eksik export
```

## 32 sunucu test dosyası (`testler/t1–t32.mjs`)
~200 kontrol. Sahte `@vercel/kv` ile çalışır, gerçek veriye dokunmaz.

**Stub şart:** `nx` seçeneğini desteklemeli, yoksa yazma kilidi devreye girmez ve testler
hayalet veri kaybı raporlar.

## Bilinen yanlış alarmlar
`OKUBENI.md` içinde listeli: JSX metnindeki Türkçe kelimelerin kod sanılması
(C, Personel, Dashboard, Finans, Ciro, CEO, KAPALI, KDV, PDF, CSV, API, Tamamlananlar).

## Neden bu kadar çok denetleyici var

Tarayıcıda çalıştırma imkânı olmadığı için (node_modules ve ağ yok), bu denetimler derleme
ve çalışma anı hatalarının yerini tutmaya çalışıyor. **Claude Code'da bu kısıt kalkıyor** —
`npm run build` ve gerçek bir tarayıcı çok daha güvenilir. Denetleyiciler yine faydalı ama
artık tek savunma hattı değil.

---

# 7. NEREDE KALDIK — Google Drive entegrasyonu

**Bu, devralınacak yarım iş.**

## Ne yapılmak isteniyor

Müşteri bir içeriği onayladığında ve iş "Teslim Edildi" olduğunda, Drive'daki dosya otomatik
olarak doğru klasöre taşınsın:

```
İBO BURGER/                    ← müşteri kaydına girilen tek klasör
   ONAY BEKLEYENLER/
   ONAYLANANLAR/
      AĞUSTOS/                 ← müşteri onaylayınca buraya
   PAYLAŞILANLAR/
      AĞUSTOS/                 ← "Teslim Edildi" olunca buraya
```

Üst klasörler ve **ay klasörleri sistem tarafından oluşturulur**, varsa yeniden kullanılır.

## Kod tarafı: TAMAM ✅

- `lib/drive-tasima.js` yazıldı — servis hesabı JWT imzalama, jeton alma, klasör bulma/açma,
  dosya taşıma (`files.update` + `addParents`/`removeParents`)
- `api/data.js` içine iki tetikleyici eklendi:
  - Müşteri onayı → `ONAYLANANLAR/<AY>`
  - Aşama "Teslim Edildi"ye geçince → `PAYLAŞILANLAR/<AY>`
- Müşteri kaydına **"Drive Onay Klasörü"** alanı eklendi
- `lib/kv-yaz.js` artık `oncekiVeri` de döndürüyor (aşama değişimi karşılaştırması için)
- **Taşıma asla onayı engellemez** — Drive kurulu değilse, yetki yoksa, bağlantı koparsa
  onay yine geçerli; sonuç işin geçmişine not düşülür
- Slot harcanmadı (11/12 sabit)
- Test edildi: 12 taşıma kontrolü + 7 aşama yakalama + 6 klasör kimliği kontrolü

## Kurulum tarafı: YARIM ⏳

**Tamamlananlar:**
1. ✅ Google Cloud projesi oluşturuldu — **MARCUS APP** (`marcus-app-505912`)
2. ✅ Google Drive API etkinleştirildi
3. ✅ Servis hesabı oluşturuldu:
   `marcus-drive@marcus-app-505912.iam.gserviceaccount.com`
4. ✅ JSON anahtar indirildi — `marcus-app-505912-aa4a860ef6e8.json`
   (kullanıcının bilgisayarında, İndirilenler klasöründe)

**Kalanlar:**

5. ⏳ **Drive klasörünü paylaş** — markaların bulunduğu üst klasör, servis hesabı e-postasına
   **Düzenleyici** olarak paylaşılacak. Alt klasörler yetkiyi devralır.
   *Not: taşıma hem kaynak hem hedef klasörde yetki ister; üst klasörü paylaşmak ikisini de
   çözer.*

6. ⏳ **Vercel'e iki ortam değişkeni:**
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `marcus-drive@marcus-app-505912.iam.gserviceaccount.com`
   - `GOOGLE_PRIVATE_KEY` = JSON dosyasındaki `private_key` alanının tırnak içindeki tamamı
     (`-----BEGIN PRIVATE KEY-----` ile başlar, `\n` işaretleri **silinmemeli**)

   Sonra **Redeploy**.

7. ⏳ **Her müşteri kaydına** Drive ana klasör bağlantısını gir
   (Müşteriler → düzenle → "Drive Onay Klasörü")

8. ⏳ **Test:** bir içeriği müşteri hesabıyla onayla, Operasyon kartının **işlem geçmişine**
   bak. "Dosya Drive'da ... klasörüne taşındı" ya da hata sebebi yazacak.

## Bilinmesi gereken teknik ayrıntı

Daha önce Drive'a **yükleme** denendi ve vazgeçildi: servis hesaplarının depolama kotası yok,
kişisel Google hesabına yükleme "Service Accounts do not have storage quota" hatası veriyor.

**Taşıma farklı bir iş** — yeni dosya oluşturulmuyor, var olanın klasörü değişiyor. Servis
hesabının dosyaya düzenleme yetkisi olması yeterli. Bu yüzden taşıma çalışır, yükleme çalışmaz.

Müşteri dosya göndermek isterse **WeTransfer bağlantısı** yapıştırıyor (v150).

---

# 8. Diğer açık işler

| İş | Durum |
|---|---|
| `RESEND_API_KEY` | Vercel'de tanımlı değil. Bu yüzden **gece yedek e-postaları ve hatırlatma/revize bildirimleri gitmiyor**. Kod çalışıyor, sadece anahtar eksik. |
| 2FA | `OWNER_EMAIL` durumu belirsiz; Güvenlik kartı hangisinin eksik olduğunu söylüyor |
| Meta/Instagram reklam entegrasyonu | Araştırıldı, yapılmadı |
| Mobil uyum | Yapıldı ama detaylı test edilmedi |
| Serverless slot | 11/12 — bir slot payı kaldı |

---

# 9. Çalışma yöntemi ve dikkat edilecekler

## Sürüm akışı
Kod düzenlenir → zip verilir → kullanıcı GitHub'a yükler → Vercel otomatik yayına alır.

⚠ **GitHub "Upload files" DOSYA SİLMEZ.** Bir dosya kaldırıldığında kullanıcının elle silmesi
gerekir. Bu bir kez unutuldu ve 12/12 sınırı aşılıp derleme kırıldı.

*Şu an silinmesi gereken: `lib/drive-yukleme.js` (v150'de kaldırıldı, repoda kalmış olabilir).*

Claude Code'a geçince bu sorun ortadan kalkar — doğrudan commit yapılabilir.

## Tekrar eden hatalar (beş kez oldu)

**Dosya bölmek bu projedeki en riskli işlem.** v81, v91, v108, v120, v137 — hepsi aynı şekilde
bitti: bir ad taşınırken geride kaldı, o ekran siyah oldu.

Alınan önlem: 5, 10, 12, 14, 16, 17 numaralı denetleyiciler bu hatanın altı yüzünü kapsıyor.
Ama asıl çözüm dikkat: **taşınan her adı tek tek doğrula.**

## Diğer öğrenilenler

- Satır numarasıyla düzenleme yalnızca o satırları okuduktan hemen sonra güvenli
- Eski bir zip'ten dosya geri yüklemek tehlikeli (v117'de iki sabit kayboldu, üç sürüm sonra
  fark edildi)
- Aynı işi yapan ikinci bir kopya, güncellenmediğinde sessizce bozulur (e-posta göndericisi,
  müşteri görünümü, kimlik başlıkları — üçü de birleştirildi)
- Test aracının kendisi yanlış alarm verebilir; bir alanı "sızıntı" ilan etmeden önce ne işe
  yaradığını doğrula (üç kez yaşandı)

## Siyah ekran koruması

`src/hataYakalayici.jsx` — React sınıf bileşeni. Bir bölüm çizilirken hata olursa tüm sayfa
düşmüyor; menü ayakta kalıyor, hata metni ekranda yazıyor, "kopyala" düğmesi var. 33 sekmenin
hepsi koruma altında.

---

# 10. Ekranlar

```
Dashboard          finansal KPI'lar + "Bugünün Kararı" (kural tabanlı, AI yok)
Planım             kişisel görevler + Onayını Bekleyenler + Ekibin Bekleyen İşleri
MÜŞTERİ            Müşteriler · Müşteri Hesapları · Teklif & Sözleşme · Reklamlar
PARA               Finans · Ödeme Takvimi · Personel · Birikim · Üyelikler
ÜRETİM             Operasyon · Çekim · Günlük Kontrol · Paylaşımlar · Müşteri Paneli
Şifre Kasası
Ayarlar
```

Sol menü kenarından sürüklenerek genişletilebilir (180–420 px), genişlik hatırlanır.

## Operasyon aşamaları
- **Video:** Çekim Planlandı → Çekim Yapıldı → Dosyalar Aktarıldı → Edit Bekliyor →
  Edit Yapılıyor → Kontrol Bekliyor → Revize İstendi → Onaylandı → Teslim Edildi
- **Fotoğraf:** Çekim Yapıldı → Düzenleniyor → Kontrol Bekliyor → …
- **Grafik Tasarım:** Talep Alındı → Tasarım Bekliyor → Tasarım Yapılıyor → Kontrol Bekliyor → …

Yeni kategori eklenecekse: her şey `KATEGORILER` ve `asamaListesi/ILK_ASAMA/ciktiVideoMu/
cekimVarMi` üzerinden gider; ikili kategori kontrolü kalmamalı.

## Müşteri paneli (müşterinin gördüğü)
Onay Bekleyenler · Revize İstediklerin · Onayladıkların · Paylaşım Takvimi · Reklamlar ·
Üretim Durumu · **İçerik İste**

İçerik türleri müşteriye kendi dilinde: **Reels · Görsel · Tasarım**
(sistemdeki karşılıkları Video · Fotoğraf · Grafik Tasarım)

## İçerik talebi akışı (v148)
Müşteri istek gönderir → Planım'daki onay kutusuna düşer → "Operasyon'a al" denince
"Talep Alındı" aşamasında iş kartı doğar. En fazla 3 açık talep; `clientId` sunucudan alınır.

---

# 11. Ortam değişkenleri

| Değişken | Durum | Ne işe yarar |
|---|---|---|
| `SITE_PASSWORD` | ✅ tanımlı | Yönetici girişi |
| `BACKUP_EMAIL` | ✅ tanımlı | Gece yedeğinin gideceği adres (virgülle çoklu) |
| `RESEND_API_KEY` | ❌ eksik | E-posta gönderimi — **yedek ve bildirimler bunsuz gitmiyor** |
| `OWNER_EMAIL` | ❓ belirsiz | 2FA kodu |
| `STAFF_PASSWORD` | opsiyonel | Ortak personel şifresi (kişisel hesaplar tercih ediliyor) |
| `CRON_SECRET` | opsiyonel | Cron uç noktalarını korur |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ⏳ eklenecek | Drive taşıma |
| `GOOGLE_PRIVATE_KEY` | ⏳ eklenecek | Drive taşıma |
| `DRIVE_ONAY_KLASOR_ID` | opsiyonel | Müşteri kaydında klasör yoksa ortak kök |

---

# 12. Claude Code'a geçerken

## İlk yapılacaklar
1. Depoyu klonla, `npm install` çalıştır
2. `npm run build` ile gerçek bir derleme yap — bu projede uzun süredir yapılamıyordu
3. `./testler/hepsinidenetle.sh` ve `testler/t*.mjs` çalıştır (stub için README'ye bak)
4. Yukarıdaki **7. bölümdeki Drive kurulumunu** tamamla

## Neyin farklı olacağı
Bu sohbette tarayıcı, `node_modules` ve ağ erişimi yoktu. Bu yüzden:
- Kod çalıştırılamıyordu → 17 statik denetleyici yazıldı
- Tıklama testi yapılamıyordu → siyah ekranlar ancak kullanıcı fark edince öğreniliyordu

**Claude Code'da bu kısıtlar yok.** Gerçek derleme ve gerçek çalıştırma mümkün; denetleyiciler
yardımcı kalır ama tek savunma olmaktan çıkar.

## Kullanıcı hakkında
Kod yazmıyor. Google Cloud, Vercel, GitHub gibi panellerde **tıklama tıklama, tek adım tek
adım** yönlendirme gerekiyor. Ekran görüntüsü göndererek ilerliyor. Veri kaybına karşı
hassas — bu konuda daha önce kötü deneyim yaşamış.

---

**Son paket:** `marcus-os-app-155.zip`
