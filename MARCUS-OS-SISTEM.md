# Marcus OS — Sistem Envanteri

Bu belge **şu anda çalışan sistemin tam dökümü**: hangi uç ne yapıyor, hangi modül
neyi sahipleniyor, veri belgesinde ne var, hangi ekran neyi okuyup yazıyor.

`CLAUDE.md`'den farkı: orası her oturumda okunan, "bilmeden dokunulursa bir şey
kırılır" bilgisini taşıyan kısa dosya. Burası envanter — arandığında bakılır.
Değişiklik geçmişi ve gerekçeler `README.md`'de.

**Her teknik iddia koddan doğrulandı.** Bir cümle koda uymuyorsa kod haklıdır ve bu
belge yanlıştır; düzeltilmesi gerekir.

---

## 1. Mimari

```
Tarayıcı (React 18 + Vite SPA)
    │  fetch
    ▼
Vercel serverless fonksiyonları  (api/*.js — 11 dosya, sınır 12)
    │
    ▼
Upstash Redis (@vercel/kv)
    └── marcus-os-data  ←  TÜM uygulama verisi TEK bir JSON belgesi
```

Yan sistemler: **Google Drive** (dosya deposu, iki ayrı kimlik), **Resend** (e-posta),
**Vercel Cron** (gece yedeği + günlük hatırlatma).

Kod ve arayüz tamamen Türkçe — değişken ve fonksiyon adları dahil.

### Dosya düzeni

| Klasör | İçerik |
|---|---|
| `src/` | React arayüzü (Vite ile derlenir) |
| `api/` | Serverless fonksiyonlar — **her dosya bir fonksiyon**, Hobby sınırı 12 |
| `lib/` | Ortak mantık — hem `api/` hem `src/` buradan import eder, **fonksiyon sayılmaz** |
| `testler/` | 89 test dosyası (t1…t89) + 22 statik denetim betiği |

En büyük dosyalar: `src/App.jsx` (9.653), `src/CekimEditTakibi.jsx` (2.734),
`api/data.js` (2.008), `src/musteriPaneli.jsx` (1.383), `src/tema.jsx` (1.039).

---

## 2. Uçlar — `api/`

11 fonksiyon kullanılıyor, sınır 12. **Yeni yetenek yeni dosya açmaz**; mevcut bir uca
yeni bir `action` eklenir. `api/data.js` içindeki `driveAction`, `authAction`,
`onizlemeAction`, `musteriAction` bu yüzden var.

### `api/data.js` (2.008 satır) — ana uç

Uygulamanın kalbi. Tek dosyada beş ayrı sorumluluk taşıyor, çünkü her biri ayrı dosya
olsa fonksiyon sınırı aşılırdı.

**GET** — veriyi okur. Rol'e göre süzer:
- `owner` → belgenin tamamı
- `staff` → izinlerine ve marka kilidine göre süzülmüş (`markayaGoreSuz`), `_alanSurumleri` dahil
- `musteri` → yalnızca `musteriGorunumuUret` projeksiyonu
- `?video=` → video akışı jetonuyla Drive'dan video akıtır

**POST (gövde)** — belgeyi yazar. `guvenliGuncelle` üzerinden, alan bazlı sürüm
kontrolü ve kimlik onarımıyla.

**POST `authAction`** — `girisBasla` · `kodDogrula` · `cikis` · `tumCihazlardanCikis` ·
`kilidiAc`. İki adımlı doğrulama, oturum jetonu, hız sınırı (yalnızca giriş
denemelerinde).

**POST `driveAction`** — `yuklemeBasla` · `yuklemeBitti` · `yuklemeIptal` · `medyaSil` ·
`kucukResim` · `klasorDurumu` · `duzeneAl`. Dosya yükleme oturumu, önizleme, silme.

**POST `onizlemeAction`** — `gorsel` · `videoJetonu`. Müşteri ve personelin kendi
markasının önizlemesini alması.

**POST `sistemAction`** — `saglik`. **Yalnızca yönetici.** Belge ölçümü (toplam boyut,
en çok yer kaplayan alanlar, kayıt sayıları), fonksiyon sayısı, ortam değişkenlerinin
**var/yok** durumu ve isteğe bağlı **salt okunur** Drive sağlık kontrolü. Hiçbir şey
yazmaz; sır değeri asla döndürmez; üretim Drive'ında deneme yapmaz.

**POST `ortakAction`** — `asamaIlerlet`. Çözüm ortağının kartı ilerletmesi; şu an
yalnızca `Kontrol Bekliyor` hedefine izin veriliyor ve marka kontrolü yapılıyor.

**POST `musteriAction`** — `onayla` · `revizeIste` · `talepOlustur`. Müşteri panelinin
yazabildiği **tek** üç işlem.

### `api/paylasim.js` (~1000 satır) — paylaşım, stok, şube, üyelik

| Action | Ne yapar |
|---|---|
| `stokDegistir` · `subeStokDegistir` | Stok yazan iç uçlar — **arayüzde elle +/− YOK**, stok kartların yansıması |
| `stokDuzelt` | Mutabakat düzeltmesi — hedef sayıyı **sunucu** hesaplar, tarayıcıdan gelene güvenilmez |
| `driveEslestir` | Drive'ın üç durum klasörü ↔ kartlar — tür kırılımı, stok farkı — **salt okuma**, kilit almaz |
| `driveStokUygula` | Genel stoğu Drive'a eşitler — sunucu YENİDEN tarar, istemciden sayı almaz |
| `kartsizdanKartAc` | Kartsız Drive dosyaları için taslak kart açar — kartsız listesini sunucu yeniden hesaplar |
| `gunlukToggle` | Günlük Kontrol işaretleme, stok düşümü, geçmiş kaydı |
| `haftalikEkle` | Haftalık plana kayıt (opsiyonel `subeId`) |
| `haftalikToggle` | Paylaşıldı işaretleme, stok düşümü, kart aşama geçişi |
| `haftalikSil` · `haftalikAltMetin` | Plan silme (**tam geri alma**: aşama, stok, Drive), alt metin |
| `subeEkle` · `subeSil` | Şube yönetimi (aynı ad 409, kayıtlı şube onay ister; silme kart kapsamını AÇMAZ) |
| `uyelikEkle` · `uyelikGuncelle` · `uyelikSil` | Abonelik/üyelik takibi |

**Marka kilidi tek yerde çözülür**: uç, `clientId` / `planId` / `subeId` / `uyelikId` /
`marka` alanlarından hedefin hangi markaya ait olduğunu bulur ve `markaErisimiVarMi`
ile kontrol eder. Action başına ayrı kontrol yazılmıyor — biri unutulurdu.

### `api/manage-staff.js` (240 satır) — personel hesapları
`ekle` · `guncelle` · `sil` · `silByClientId` · `sifreSifirla`.
Şifreler `scrypt` ile tuzlanarak saklanır. Güvenlik defterine yazar.

### `api/client-payment.js` (90 satır) — ödeme kayıtları
`addKaydi` · `deleteKaydi` · `setOdemeGunu`. **Marka kilitli hesap bu ucu hiç
kullanamaz** — veri finansal iç bilgi; izin ayarı yanlış yapılsa bile ikinci emniyet.

### `api/kasa.js` (125 satır) — şifre kasası
`dogrula` · `degistir`. Kasa şifresi ayrı; **değiştirmeyi yalnızca owner yapabilir.**

### `api/backup.js` — yedek listesi, özet ve geri yükleme
`GET` yedekleri listeler ya da tek bir yedeğin içeriğini/özetini verir; `?ozet=1`
ayrıca **ne kaybedileceğini** söyler (`yedekDegerlendir`). `POST` geri yükler.

Geri yükleme sistemdeki en tehlikeli yazma. Üç koruma: **yapı doğrulaması** (bozuk ya
da yabancı belge yazılmadan reddedilir), **kilit** (alınamazsa geri yükleme YAPILMAZ),
ve **geri-alma kopyası** (mevcut veri ayrı bir anahtara 30 gün saklanır). Sürüm sayacı
geriye gitmez — açık sekmeler bayatlıklarını anlayabilsin diye.

### `api/daily-backup.js` (112 satır) — gece yedeği
**Cron: her gün 03:00 UTC.** `BACKUP_EMAIL` adres(ler)ine yedek gönderir.
`CRON_SECRET` ile korunur.

### `api/daily-reminders.js` (286 satır) — günlük hatırlatma
**Cron: her gün 15:00 UTC.** Yaklaşan teslimler, geciken ödemeler, biten üyelikler.
`CRON_SECRET` ile korunur.

### `api/notify-job.js` (194 satır) — iş bildirimi
Kartta atanan kişiye "iş atandı" / "durum değişti" e-postası.

### `api/logo.js` (61 satır) — logo sunucusu
Ayarlar'a yüklenen logo veride base64 duruyor; tarayıcı sekmesi, telefon ana ekranı ve
link önizlemeleri gerçek bir görsel ADRESİ istiyor. Bu uç o boşluğu kapatır.

### `api/devir-teslim.js` (130 satır) — devir raporu
Sistem devir belgesini üretir.

**Güvenlik notu — hepsinde ortak:** eskiden "yapılandırma eksikse izin ver" davranışı
vardı. Ölçüldü: `SITE_PASSWORD` tanımsızken uçlar kimliksiz isteklere yanıt veriyordu.
Artık **tanımsızsa kimse giremez.**

---

## 3. Ortak mantık — `lib/`

`lib/` altındaki dosyalar Vercel fonksiyonu **sayılmaz**; istendiği kadar dosya konabilir.

| Modül | Sahiplendiği konu |
|---|---|
| `kv-yaz.js` | **Yazma çekirdeği.** Kilit, alan bazlı sürüm, işlem kimliği, stok otoritesi |
| `islem-kimligi.js` | Aynı işlemin iki kez uygulanmasını engelleyen kimlik kaydı (24 saat) |
| `mesgul-tekrar.js` | Tarayıcı tarafı: 503 `mesgul` ve ağ hatasında otomatik tekrar |
| `kimlik.js` | Kayıt numarası çakışmalarını onarır, türetilmiş alanları ayıklar, yeni kayıtları korur |
| `marka-kilidi.js` | Marka kilidi: okuma süzgeci, yazma birleştirme, `markaninIdsi`, izin daraltma |
| `is-yetkisi.js` | Operasyon kartını kim işleyebilir (yetkiye bakar, atamaya değil) |
| `asamalar.js` | **Aşama tablolarının tek sahibi.** Medya yuvaları, slayt sınırı, kart klasörü adı |
| `stok.js` | Stok motoru: onaya göre artış/düşüş, şube stoğu, toplu kayıp freni |
| `stok-mutabakat.js` | Kartlardan olması gereken stok + kayıtlıyla fark — **yalnızca okur** |
| `pano-suzgeci.js` | Operasyon panosu kategori + marka süzgeci |
| `sube-kullanimi.js` | Şube bazlı içerik kullanımı — durum, özet, listeler, müşteri satırları |
| `musteri-gorunumu.js` | **Müşteri ve çözüm ortağı görünümünün tek kaynağı** |
| `drive-tasima.js` | Klasör ağacı, dosya/klasör taşıma, kart klasörü, önizleme, çöpe atma |
| `drive-eslestirme.js` | Drive dosyaları ↔ kartlar — durum/tür kırılımı, kartsız dosya, yanlış klasördeki kart, Drive'a göre stok (**saf, ağ yok**) |
| `kategori.js` | **Kategoriler ve stok türlerinin TEK kaynağı** — Reels/Post/Carousel + eski adların eşlemesi (**saf**) |
| `drive-denetimi.js` | Kayıtlı stok ile Drive'ın söylediği stoğun farkı + uygulama frenleri (**saf, ağ yok**) |
| `drive-yukleme.js` | Yükleme oturumu açma, tamamlama, dosya çöpe atma |
| `onizleme-bellegi.js` | Önizleme önbelleği ve sunucu kaydını bekleme |
| `suren-isler.js` | Yükleme sürerken arka plan tazelemesini durdurur (10 dk zaman aşımı) |
| `oturum.js` | İki adımlı doğrulama, oturum jetonu, owner yetkisi |
| `eposta.js` | Resend üzerinden e-posta gönderimi ve şablonlar |
| `video-jeton.js` | Video akışı için kısa ömürlü imzalı jeton |
| `sistem-sagligi.js` | Belge ölçümü, büyüyen alanlar, ortam değişkeni var/yok — **yalnızca okur** |
| `yedek-dogrula.js` | Geri yüklemeden önce yedeğin yapısı ve kayıp özeti — saf, yan etkisiz |

`kv-yaz.js` ayrıca **bozuk belge korumasını** taşır (`belgeOkunabilirMi`): `kv.get`
nesne dışında bir şey döndürürse okuma da yazma da reddedilir. Boş/`null` belge bozuk
sayılmaz — ilk kurulumda belge henüz yoktur.

---

## 4. Veri belgesi — `marcus-os-data`

Tüm uygulama verisi **tek bir JSON belgesi**. Üst düzey alanlar:

### Üretim
`cekimIsleri` — Operasyon kartları · `haftalikPaylasimlar` — paylaşım planı (şube kaydı
dahil) · `gunlukKontrol` — günlük kontrol işaretleri · `stoklar` — marka ve şube stok
sayaçları · `paylasimGecmisi` — stok hareketleri defteri · `subeler` — marka şubeleri ·
`markalasmaSurecleri` — markalaşma görev listeleri

### Müşteri
`clients` — müşteri kayıtları · `musteriHesaplari` — müşteri paneli girişleri ·
`musteriIcerikleri` — müşteri onayına sunulan kayıtlar · `musteriTalepleri` — müşteriden
gelen içerik istekleri · `musteriGirisleri` — şifre kasası kayıtları ·
`bekleyenTahsilatlar` — ödeme kayıtları

### Para
`gelirKalemleri` · `giderKalemleri` · `ofisGiderleri` · `monthly` · `vergiTakvimi` ·
`hesaplar` · `hesapTransferleri` · `hesapDuzeltmeleri` · `hesapOlcumleri` · `birikimler`

### Personel
`personel` · `personelHesaplari` — giriş bilgileri (scrypt hash) · `personelOdemeleri` ·
`isUcretleri` · `isUcretDetaylari` · `avanslar` · `freelancerlar` · `staffPermissions` ·
`kisiselGorevler`

### Satış ve pazarlama
`teklifler` · `teklifSablonlari` · `sozlesmeSablonlari` · `tebligSablonu` · `reklamlar` ·
`uyelikler`

### Sistem
`firmaAdi` · `markaKimligiGorseli` · `acikZeminLogosu` · `paylasimGorseli` ·
`islemGecmisi` — kim ne zaman ne yaptı · `silinenler` — silinen kayıtların izi ·
`sonYedekTarihi` · `ownerKisiselSifreler` · `kasaSifresiHash` · `_v` ·
`_alanSurumleri` — alan bazlı sürüm sayaçları

### Türetilmiş — belgeye YAZILMAZ
`personelRosteri`, `musteriRosteri` yalnızca yanıtta üretilir (`TURETILMIS_ALANLAR`).
Belgeye yazılırlarsa iki kaynak oluşur ve ayrışırlar.

### Ajans geneli — marka kilidinden muaf
`gelirKalemleri`, `giderKalemleri`, `ofisGiderleri`, `monthly`, `vergiTakvimi`,
`personel`, `hesaplar`, `hesapTransferleri`, `hesapDuzeltmeleri`, `birikimler`,
`islemGecmisi`, `teklifSablonlari`, `sozlesmeSablonlari`, `kisiselGorevler`,
`isUcretleri`, `isUcretDetaylari`, `avanslar`, `freelancerlar`, `personelOdemeleri`,
`silinenler` (`AJANS_GENELI_ALANLAR`). Bunlar markaya ait değil, ajansa ait.

---

## 5. Roller ve ekranlar

Dört rol: **owner** (yönetici) · **staff** (personel) · **çözüm ortağı** (marka kilitli
personel) · **musteri** (müşteri paneli).

### Yönetici menüsü

| Sekme | İş |
|---|---|
| Dashboard | Genel durum, uyarılar |
| Planım | Kişisel görevler |
| **Müşteri** → Müşteriler | Müşteri kayıtları, **şube kurulumu**, maliyet, ödeme |
| Müşteri → Müşteri Hesapları | Müşteri paneli girişleri |
| Müşteri → Teklif & Sözleşme | Teklif ve sözleşme şablonları, gönderim |
| Müşteri → Reklamlar | Reklam kampanyası takibi |
| **Para** → Finans | Gelir/gider, aylık tablo, vergi takvimi |
| Para → Ödeme Takvimi | Tahsilat takibi, ödeme günü, hatırlatma |
| Para → Personel | Ücret, avans, iş başı ödeme, freelancer |
| Para → Birikim | Fon takibi |
| **Üretim** → Operasyon | İş kartları panosu (Video / Fotoğraf / Carousel / Grafik Tasarım) |
| Üretim → Çekim | Çekim gereken markalar (şube dökümüyle) |
| Üretim → Günlük Kontrol | Bugün paylaşılması gerekenler |
| Üretim → Paylaşımlar | Haftalık plan ızgarası, marka ve şube stokları |
| Üretim → Müşteri Paneli | Müşterinin gördüğü ekranın yönetici tarafı |
| Şifre Kasası | Müşteri hesap bilgileri (ayrı şifreyle korunur) |
| Üyelikler | Abonelik/lisans takibi |
| Ayarlar | Marka kimliği, güvenlik, yedek, bildirimler, personel hesapları |

### Personel izinleri

`dashboard` · `musteriler` · `finans` · `takvim` · `odemeTakvimi` · `teklif` ·
`reklamlar` · `cekimEdit` · `paylasimlar` · `personel` · `birikim` · `cekimListesi` ·
`sifreKasasi` · `markaYoneticisi` · `uyelikler`

Varsayılan açık olanlar: `reklamlar`, `paylasimlar`, `cekimEdit`.

### Çözüm ortağı (marka kilitli)

`KILITLI_IZINLER` dışındaki her izin **zorla kapatılır**: `paylasimlar`,
`cekimListesi`, `cekimEdit`, `reklamlar`, `uyelikler`, `sifreKasasi`, `takvim`,
`musteriAkisi`. Yalnızca kendisine atanan markaları görür ve yazabilir.

Paneli = müşteri paneli **eksi** "İçerik İste" sekmesi (`ORTAGA_KAPALI_SEKMELER`),
**artı** kendi markalarının paylaşım ve stok panelleri.

### Müşteri paneli

Sekmeleri: **Onay Bekleyenler · Revize İstediklerin · Paylaşım Takvimi · Reklamlar ·
Üretim Durumu · İçerik İste**. Paylaşım takvimi Instagram ızgarası ve tek tek gönderi
önizlemesi olarak gösterilir; çok şubeli markada aynı içerik tek satırda birleşir ve
şube etiketleri taşır.

Yazabildikleri **yalnızca üç şey**: `onayla`, `revizeIste`, `talepOlustur`. Yapısal
veriye (şube, stok, kart) hiç dokunamaz.

---

## 6. Kurallar — nerede duruyor

Her kuralın **tek** bir sahibi var. Aynı kuralı iki yere yazmak bu projede zaten bir kez
panel senkron hatasına yol açtı.

| Kural | Sahibi |
|---|---|
| Yazma sırası, kilit, sürüm | `lib/kv-yaz.js` |
| Aşama tabloları, medya yuvaları, slayt sınırı, kart klasörü adı | `lib/asamalar.js` |
| Stok artışı/düşüşü, şube stoğu | `lib/stok.js` |
| Şube bazlı kullanım | `lib/sube-kullanimi.js` |
| Müşteri ve ortak görünümü | `lib/musteri-gorunumu.js` |
| Marka adı → marka kimliği | `markaninIdsi` (`lib/marka-kilidi.js`) |
| Kartı kim işleyebilir | `lib/is-yetkisi.js` |
| Drive klasör ağacı ve taşıma | `lib/drive-tasima.js` |

Ayrıntılı davranış kuralları (kilidin fail-close olması, işlem kimliğinin iki kuralı,
şube stok modeli, Carousel klasörü, slayt sınırı) **`CLAUDE.md`'de** — burada
tekrarlanmıyor, çünkü iki yerde duran kural ayrışır.

---

## 7. Google Drive

**İki ayrı kimlik, ikisi de eksik yetkili:**

| Kimlik | Yapabildiği | Yapamadığı |
|---|---|---|
| Servis hesabı | Klasör açar, dosya/klasör taşır, kendi açtığı klasörü çöpe atar | **Yükleyemez** — depolama kotası yok |
| OAuth (`drive.file`) | Dosya yükler, kendi yüklediğini çöpe atar | Uygulamanın oluşturmadığı dosyayı göremez |

Bu yüzden dosya **doğrudan hedef klasöre yüklenir** — "önce yükle sonra taşı" mümkün
değil. Çöpe atmak **sahiplik** ister, düzenleme yetkisi yetmez.

**Klasör ağacı:**

```
MARKA KLASÖRÜ / 1 SOSYAL MEDYA / <AY> / <DURUM> / [<KART KLASÖRÜ>] / dosya
```

`<DURUM>`: `1 ONAY BEKLEYENLER` · `2 ONAYLANANLAR` · `3 PAYLAŞILDI`.
`<KART KLASÖRÜ>` yalnızca Carousel'de (`#124 Bowl Karosel`).

Aşama → klasör eşlemesi olmayan aşamalarda dosyaya **dokunulmaz** — erken aşamalarda
dosya hâlâ ekibin çalışma alanındadır.

---

## 8. Güvenlik

- **Giriş**: `SITE_PASSWORD` + iki adımlı doğrulama (e-posta kodu, `OWNER_EMAIL`).
  Değişken tanımsızsa **kimse giremez**.
- **Oturum**: imzalı jeton, "tüm cihazlardan çıkış" desteği.
- **Hız sınırı**: giriş denemelerinde ve kimliği çözülemeyen isteklerde (15 dakika).
  Geçerli oturumu olan kullanıcı bu noktaya hiç gelmez, dolayısıyla kilitlenemez.
- **Personel şifreleri**: `scrypt` + tuz.
- **Şifre kasası**: ayrı şifre, değiştirmeyi yalnızca owner yapabilir.
- **Marka kilidi**: okuma süzgeci + yazma birleştirme + uç bazlı hedef kontrolü.
- **Cron uçları**: `CRON_SECRET`.
- **Güvenlik defteri**: hesap işlemleri `islemGecmisi`'ne yazılır.
- **Ortam görünürlüğü**: Ayarlar → Güvenlik, hangi ortamda hangi değişkenin eksik
  olduğunu gösterir (Canlı / Önizleme / Geliştirme ayrı ayrı). Değerler tarayıcıya
  gitmez, yalnızca var/yok bilgisi.

---

## 9. Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `SITE_PASSWORD` | Yönetici girişi. **Tanımsızsa kimse giremez** |
| `STAFF_PASSWORD` | Eski ortak personel şifresi (opsiyonel) |
| `CRON_SECRET` | Gece yedeği ve günlük hatırlatma uçlarını korur |
| `OWNER_EMAIL` | İki adımlı doğrulama kodunun gittiği adres |
| `RESEND_API_KEY` | E-posta gönderimi |
| `RESEND_FROM` | Gönderen adresi |
| `BACKUP_EMAIL` | Gece yedeğinin gittiği adres(ler), virgülle ayrılır |
| `KILIT_DENEME` | Yazma kilidi deneme sayısı (varsayılan 12, en fazla 40) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Servis hesabı kimliği |
| `GOOGLE_PRIVATE_KEY` | Servis hesabı özel anahtarı |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth istemci kimliği |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth istemci sırrı |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth yenileme jetonu |
| `DRIVE_ONAY_KLASOR_ID` | Ortak üst klasör (markanın kendi klasörü yoksa) |
| `VERCEL_ENV` | Ortam adı (Canlı / Önizleme / Geliştirme) |

---

## 10. Zamanlanmış işler

| Ne zaman (UTC) | Uç | İş |
|---|---|---|
| 03:00 | `/api/daily-backup` | Belgenin tamamını `BACKUP_EMAIL`'e yollar |
| 15:00 | `/api/daily-reminders` | Yaklaşan teslim, geciken ödeme, biten üyelik |

---

## 11. Çalıştırma ve doğrulama

```bash
bash testler/hepsinidenetle.sh     # 22 statik denetim
./testler/sunucutestleri.sh        # t1…t89, ~1913 kontrol — SAHTE veritabanı
npm run build                      # üretim derlemesi
ls api/*.js | wc -l                # 12'yi GEÇMEMELİ
```

`sunucutestleri.sh`, `@vercel/kv` paketini geçici olarak `testler/taklit-kv` ile
değiştirir ve `trap` ile geri koyar. **Testler gerçek Redis'e asla dokunmaz.**

### Test disiplini — bu projede zorunlu

Bir düzeltme yapıldıktan sonra **koruma geri konup kaç kontrolün düştüğü ölçülür.**
"Test geçti" tek başına hiçbir şey söylemiyor: bu projede daha önce, iddia ettiği şeyi
hiç sınamayan testler yazıldı ve geçtiler.

Kaynak metnine bakan test yazılmaz, **davranış** sınanır. Kaçınılmaz olduğu yerlerde
(arayüz Node'da çalıştırılamıyor) iddia yazımı değil **niyeti** sabitlemelidir — yazımı
sabitleyen kontroller bu projede niyet değişmediği hâlde iki kez düştü.

Koruma kırıldığında test **çökmemelidir**: çöken test hiç sonuç yazmaz, ölçüm "0 düştü"
görünür ve koruma sınanmamış sayılır. Test dosyaları bunun için bölüm koruması taşır.

---

## 12. Belgeler

| Belge | İçerik |
|---|---|
| `CLAUDE.md` | Her oturumda okunur — "bilmeden dokunulursa kırılır" kuralları |
| `MARCUS-OS-SISTEM.md` | **Bu belge** — sistemin tam envanteri |
| `MARCUS-OS-DENETIM-RAPORU.md` | Güvenilirlik denetimi (Ağu 2026) — bulunan kusurlar, düzeltmeler, ölçümler |
| `README.md` | Sürüm sürüm tüm değişiklik geçmişi ve gerekçeleri |
| `MARCUS-OS-DEVIR-RAPORU.md` | Sistem devir raporu — mimari, kurulum, ortam |
| `MARCUS-OS-DEVIR-2.md` | İkinci devir notları |
| `MARCUS-OS-TANITIM.md` | Uygulamanın iş tarafından anlatımı |
