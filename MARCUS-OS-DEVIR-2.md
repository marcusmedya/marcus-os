# Marcus OS — Devir Raporu 2

**Tarih:** 18 Ağustos 2026 · **Önceki belge:** `MARCUS-OS-DEVIR-RAPORU.md` (v155)

Bu belge, Claude Code oturumunda yapılan işleri ve **nerede kalındığını** aktarır.
Birinci devir raporu hâlâ geçerli — orada yazan kurallar değişmedi. Bu belge onun üstüne gelir.

---

# 1. Şu an nerede duruyoruz

| | |
|---|---|
| **Canlı (`main`)** | `d9ad2b0` — v155 + yönetici yolu düzeltmesi + sürüm sayacı düzeltmesi |
| **Dal (`claude/proje-kontrolu-fon3os`)** | `bb4ddad` — yeni klasör düzeni, **henüz yayında değil** |
| **Testler** | 275 sunucu kontrolü + 17 statik denetim, hepsi geçiyor |
| **Serverless slot** | 11/12 — yeni `api/` dosyası açılmadı |

Daldaki iş `main`'e alınmadı çünkü kullanıcı yeni bir kapsam tanımladı (bkz. bölüm 5);
mevcut taşıma davranışı o kapsamın içinde yeniden ele alınacak.

---

# 2. Bu oturumda ne yapıldı

## Depo v154'teymiş

GitHub'daki kod v155 değildi — Drive taşıma işi hiç yüklenmemişti. `lib/drive-tasima.js`
dosyası yoktu, `api/data.js` ve `src/App.jsx` eski haldeydi. Zip'ten uygulandı.

## Gerçek derleme ilk kez yapıldı

`npm run build` temiz geçti (2310 modül). Önceki sohbette bu mümkün değildi.

## Üç gerçek hata bulundu ve düzeltildi

**1. Taşıma yönetici yolunda hiç çalışmıyordu.** Tetikleyici yalnızca `role === "staff"`
dalında çağrılıyordu. Sistemi asıl kullanan yönetici bir işi "Teslim Edildi"ye aldığında
taşıma tetiklenmiyor, üstelik geçmişe hiçbir iz de bırakmıyordu. Canlıda ancak Drive'a elle
bakılarak fark edildi.

**2. Sürüm sayacı veri kaybı üretiyordu.** (Düzeltme sırasında ortaya çıktı, bağımsız denetim
yakaladı.) Geçmişe not düşmek **ikinci bir yazmadır** ve `_v` sayacını bir daha artırıyor;
yanıt ise hâlâ ilk yazmanın `_v`'sini döndürüyordu:

```
yanıt _v: 2   KV _v: 3   -> tarayıcı bir tur geride
sonraki kayıt -> sahte 409 staleConflict
ön yüz (App.jsx:6453) kullanıcının düzenlemesini sunucu verisiyle EZİYOR
```

Yani bir iş "Teslim Edildi"ye alındıktan sonraki ilk düzenleme sessizce kayboluyordu. Aynı
kusur personel yolunda v155'ten beri varmış.

**3. Sahte hata notları + yeni kartın atlanması.** (İkinci denetim yakaladı.) "Kontrol
Bekliyor" ve "Revize İstendi" aynı klasöre düşüyor; tetikleyici aşamaya bakıp hedef klasöre
bakmadığı için her revize turunda sahte "taşıma yapılamadı" notu düşüyordu. Ayrıca doğrudan
bir aşamada açılan yeni kartın dosyası hiç taşınmıyordu.

## Kalıcı dersler

- **Sessizlik yasak.** Taşıma yapılmadığında sebep mutlaka kartın işlem geçmişine yazılır.
  Bir hata bir kez tam da bu yüzden bir saat teşhis süresine mal oldu.
- **Üç kayıt yolu var** (yönetici / personel / müşteri) ve hepsi ayrı ayrı test edilmeli.
  Hata #1 tam olarak owner yolunun testi olmadığı için kaçmıştı.
- **Not düşmek ikinci yazmadır.** Yanıtta dönen `_v` mutlaka son yazmanın `_v`'si olmalı.

---

# 3. Kurulum durumu

## Tamamlananlar ✅

- Google Cloud projesi **MARCUS APP** (`marcus-app-505912`), Drive API açık
- Servis hesabı: `marcus-drive@marcus-app-505912.iam.gserviceaccount.com`
- Drive kök klasörü **SOSYAL MEDYA PAYLAŞIM** (`1clRMuUOI9rLzX9F9agPHztLCLiNurupg`)
  servis hesabına **Düzenleyici** olarak paylaşıldı — doğrulandı
- Vercel'de `GOOGLE_SERVICE_ACCOUNT_EMAIL` ve `GOOGLE_PRIVATE_KEY` tanımlı (Production+Preview)
- Taşıma canlıda **çalıştığı doğrulandı**: dosya `PAYLAŞILANLAR/AĞUSTOS` klasörüne taşındı

## Düzeltmeler (önceki rapor yanlıştı)

- `RESEND_API_KEY` **eksik değil**, 28 Temmuz'dan beri tanımlı
- `OWNER_EMAIL` **tanımlı**
- `lib/drive-yukleme.js` repoda **yok**, silinecek bir şey kalmamış

## Kalanlar ⏳

- **Servis hesabı anahtarı değiştirilmeli.** JSON sohbete yüklendiği için güvenliğini
  kaybetti. Google Cloud → IAM → Hizmet Hesapları → `marcus-drive` → Anahtarlar →
  eskisini sil, yenisini oluştur, Vercel'de `GOOGLE_PRIVATE_KEY`'i güncelle.
- **Müşteri kayıtlarına Drive klasörü girilmeli.** Şu an sadece VIZZ'de var ve o da yanlış
  klasörü gösteriyor (elle açılan `ONAY BEKLEYENLER` klasörünü; marka kökü olmalı).
- VIZZ'de elle açılmış `PAYLAŞIM` ve `ONAY BEKLEYENLER` klasörleri silinebilir.

---

# 4. Drive klasör düzeni — verilen kararlar

Kullanıcı 17 markanın Drive yapısı taranarak sunulan seçenekler arasından şunları seçti:

```
VIZZ/                        <- müşteri kaydındaki "Drive Onay Klasörü" MARKA KÖKÜNÜ gösterir
  AĞUSTOS/
    ONAY BEKLEYENLER/        <- Kontrol Bekliyor · Revize İstendi
    ONAYLANANLAR/            <- Onaylandı
    PAYLAŞILDI/              <- Teslim Edildi
  LOGO/  ÇALIŞMA DOSYASI/    <- dokunulmaz
```

| Karar | Seçim | Gerekçe |
|---|---|---|
| Sıralama | **önce AY, sonra durum** | Ay boyutu kullanan 4 markanın dördü de böyle |
| Kök | **markanın ana klasörü** | En kısa yol |
| İsimler | ONAY BEKLEYENLER / ONAYLANANLAR / **PAYLAŞILDI** | Son ad bilerek: çoğu markada o klasör zaten bu adla var, yenisi açılmasın |
| Geri alma | **dosya aşamayı iki yönde takip etsin** | Drive her zaman kartın gerçek aşamasını göstersin |

### Uygulanan ek kurallar

- **Ay, dosyanın bulunduğu yerden okunur**, içinde bulunulan aydan değil. 30 Ağustos'ta
  yüklenip 1 Eylül'de onaylanan dosya `EYLÜL`'e sıçramaz. Kullanıcının "hangi ay yüklendiyse
  o ayın klasörü" isteği bu.
- **Klasör eşleşmesi büyük/küçük harfe duyarsız.** Kusurdu: KANATÇI DİREN'de klasör `Ağustos`
  yazarken kod `AĞUSTOS` arayıp ikinci bir klasör açacaktı.
- **Drive'ı kurulmamış markada sessiz geçilir.** Kurulmamış bir şeyin çalışmadığını her aşama
  değişiminde yazmak kartı gürültüyle doldurur.
- **Erken aşamalarda (çekim, edit) dosyaya dokunulmaz** — orası ekibin çalışma alanı.

---

# 5. YENİ KAPSAM — medya yükleme, önizleme, versiyon

Kullanıcının son mesajıyla tanımladığı kapsam. **Henüz yazılmadı.**

## Ana mantık

> Panel = çalışma alanı · Google Drive = arka planda depolama ve arşiv
> Personel günlük işini tamamen panel üzerinden yapmalı, Drive'a girmemeli.

## İstenen özellikler

**1. Karta medya yükleme** — Operasyon kartında "Video Yükle" / "Görsel Yükle". Dosya
otomatik olarak ilgili firmanın ilgili ayının `1 - ONAY BEKLEYENLER` klasörüne gider.

**2. Kart içinde önizleme** — video için oynatıcı (play/pause, tam ekran, ses, süre),
görsel için önizleme ve büyütme. Drive'a gitmeye gerek kalmamalı.

**3. Otomatik Drive bağlantısı** — Drive File ID, URL, dosya adı, türü, yükleme tarihi karta
kaydedilir. "Drive'da Aç" düğmesi ikincil özellik.

**4. Versiyon sistemi** — V1/V2/V3. "Yeni Versiyon Yükle" düğmesi. Eski dosya SİLİNMEZ.
Kart açıldığında en son versiyon ana medya olarak gösterilir; eskiler "Versiyon Geçmişi"nde.

**5. Drive dosya yapısı** — versiyonlar aynı klasörde:
`VIZZ_REELS_01_V1.mp4`, `..._V2.mp4`, `..._V3.mp4`. İsimlendirme sistem tarafından otomatik.

**6. Tamamlandı akışı** — kart "TAMAMLANDI"ya çekilince dosyalar `2 - PAYLAŞILDI` klasörüne
**taşınır** (kopyalanmaz, yeniden yüklenmez). Taşınınca önizleme bozulmamalı — bu yüzden
klasör yolu değil **Google Drive File ID** referans alınmalı.

**7. Personelin göreceği ekran** — Medya Önizleme · Güncel Versiyon: V3 · Yeni Versiyon Yükle ·
Versiyon Geçmişi · Drive'da Aç · Tamamlandı

## ⚠ Bu kapsam mevcut kararlarla çelişiyor — netleştirilmeli

Kullanıcının son mesajındaki klasör adları, bölüm 4'te verdiği kararlardan farklı:

| Bölüm 4'te kararlaştırılan | Son mesajda geçen |
|---|---|
| `VIZZ/AĞUSTOS/ONAY BEKLEYENLER` | `VIZZ/1 - SOSYAL MEDYA/08 - AĞUSTOS 2026/1 - ONAY BEKLEYENLER` |
| `PAYLAŞILDI` | `2 - PAYLAŞILDI` |
| Kök = marka klasörü | Kök = marka altında `1 - SOSYAL MEDYA` |
| Ay adı `AĞUSTOS` | `08 - AĞUSTOS 2026` |

**Devralan kişi önce bunu sormalı.** Numaralı önek (`1 - `, `2 - `) klasörlerin Drive'da
sıralı görünmesini sağlar, mantıklı bir tercih; ama mevcut `PAYLAŞILDI` klasörlerinin
yeniden kullanılması kararıyla çelişir (yeni ad `2 - PAYLAŞILDI` olursa mevcut klasör
kullanılmaz, yanına ikincisi açılır).

Ayrıca "TAMAMLANDI" diye bir aşama **yok**; mevcut son aşama "Teslim Edildi". Yeni bir aşama
mı ekleniyor, yoksa "Teslim Edildi" mi kastediliyor — sorulmalı.

## Yüklemenin iki teknik engeli ve çözüm planı

**Engel 1 — servis hesabının depolama kotası yok.** Deneyerek doğrulandı:

```
Klasör oluşturma -> ✓ BAŞARILI   (klasörler yer kaplamaz)
Dosya yükleme    -> ✗ 403 "Service Accounts do not have storage quota"
```

Kullanıcı **OAuth (kendi Gmail hesabıyla)** yolunu seçti. Ortak Drive + Workspace seçeneği
reddedildi (ücretli, alan adı gerektiriyor).

**Engel 2 — Vercel istek gövdesi sınırı ~4.5 MB.** Reels videoları 30–80 MB. Dosya sunucudan
geçemez.

**Planlanan mimari** (kullanıcı onayladı):

```
1. Tarayıcı -> dosyayı DOĞRUDAN Google'a yükler (Vercel'e uğramaz, boyut sınırı yok)
   Yükleyen: kullanıcının Google hesabı, dar yetkiyle (drive.file)
2. Uygulama, servis hesabına o dosya için izin verir
3. Servis hesabı -> dosyayı doğru klasöre taşır (bu kısım zaten çalışıyor)
```

`drive.file` kapsamı Google'ın "kısıtlı izin" listesinde **değil** — doğrulama süreci yok ve
yenileme jetonu süresiz. Tam `drive` kapsamı seçilirse uygulama "Test" modunda kalır ve
**izin 7 günde bir yenilenmek zorunda kalır**; bu kabul edilemez.

**⚠ Doğrulanmamış varsayım:** 2. adımda `drive.file` kapsamının `permissions.create`
çağrısına izin verip vermediği **test edilmedi** — OAuth jetonu gerektiriyor, o da kullanıcının
onayına bağlı. Kod yazmadan önce bu deneyle doğrulanmalı. Çalışmazsa tam `drive` kapsamına
düşülür ve 7 gün meselesi ayrıca çözülmelidir.

**Gerekecek yeni ortam değişkenleri:** `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REFRESH_TOKEN`.

**Slot:** yükleme oturumu üreten uç nokta `api/data.js` içine `action` olarak eklenmeli.
Yeni `api/` dosyası açılmamalı — 11/12 dolu.

---

# 6. Bu ortamın kısıtları (devralan bilmeli)

| Erişim | Durum |
|---|---|
| Google API'leri | ✅ açık — Drive testleri buradan yapıldı |
| GitHub (okuma+yazma) | ✅ açık — commit, push, PR, merge yapılabiliyor |
| `api.vercel.com` | ❌ **engelli** — ağ politikası, ortam değişkeni ayarlanamıyor |
| `marcus-os-iota.vercel.app` | ❌ **engelli** — canlı uygulama test edilemiyor |

Yani Vercel tarafındaki her işi kullanıcı yapmak zorunda. Test ikiye bölünüyor: kullanıcı
uygulamada işlem yapar, Claude Drive'dan sonucu doğrular.

---

# 7. Çalışma yöntemi — bu oturumda işe yarayan

**Bağımsız denetim iki gerçek hata yakaladı.** Ana kayıt yolu değiştikten sonra, push
etmeden önce, değişiklik dört ayrı mercekten (kilit, veri kaybı, yanıt akışı, tetikleyici)
incelendi ve her bulgu çürütülmeye çalışıldı. İkisi de gerçek çıktı; biri canlıya gitseydi
veri kaybı üretecekti. **Ana yazma yolunda bu adım atlanmamalı.**

**Regresyon testi, hatayı yakaladığı kanıtlanmadan yazılmış sayılmaz.** `t33.mjs` yazıldıktan
sonra eski koda karşı çalıştırıldı ve düştüğü görüldü. Düşmeyen test, testi olmayan koddur.

**Testleri çalıştırma:** `./testler/sunucutestleri.sh` — sahte `@vercel/kv` kurar, t1–t33'ü
çalıştırır, sonunda gerçek paketi geri koyar. Stub `nx` seçeneğini desteklemeli, yoksa yazma
kilidi devreye girmez ve testler olmayan veri kaybı raporlar.

---

# 8. Sohbete dönerken

Normal Claude sohbetinde **depo erişimi, derleme ve test çalıştırma yoktur.** Yani:

- Kod okunabilir, tasarım tartışılabilir, plan yapılabilir
- Ama `npm run build`, testler ve doğrudan commit **yapılamaz** — zip döngüsüne dönülür
- Drive/Google testleri de yapılamaz

Bölüm 5'teki yükleme işi ciddi miktarda kod ve test gerektiriyor; sohbette yapılırsa v155
öncesindeki koşullara dönülür (bu oturumda bulunan üç hatanın üçü de ancak gerçek çalıştırma
ile bulunmuştu).

**Öneri:** tasarım ve karar konuşmaları sohbette yapılabilir, ama kod yazma işi Claude Code
oturumunda kalsın.

---

# 9. Sıradaki işler

1. **Anahtarı değiştir** — güvenlik, en acili
2. **Klasör adlandırmasını netleştir** — bölüm 5'teki çelişki
3. **"TAMAMLANDI" aşaması** yeni mi, "Teslim Edildi" mi — netleştir
4. **`drive.file` + `permissions.create` varsayımını test et** — kod yazmadan önce
5. Google Cloud'da OAuth istemcisi oluştur, bir kez izin ver
6. Yükleme + önizleme + versiyon sistemini yaz
7. Daldaki `bb4ddad` işini `main`'e al (yeni kapsamla birlikte gözden geçirilerek)
8. Müşteri kayıtlarına Drive klasörlerini gir (17 marka)
