# Marcus OS

Marcus Medya'nın (sosyal medya ajansı) iç operasyon uygulaması. Tek kişilik bir
ekip tarafından değil, **ajansın kendi personeli, çözüm ortakları ve müşterileri**
tarafından aynı anda kullanılıyor. Kod ve arayüz **tamamen Türkçe** — değişken ve
fonksiyon adları dahil. Yeni kod da Türkçe yazılır.

Bu dosya her oturumun başında otomatik okunur. Uzun anlatım burada değil, aşağıdaki
belgelerde — bu dosya yalnızca "bilmeden dokunulursa bir şey kırılır" bilgisini taşır.

---

## BU DOSYANIN BAKIMI — Claude için talimat

Bu dosya kendiliğinden güncellenmez. **Bayat bir CLAUDE.md, olmayan bir CLAUDE.md'den
daha tehlikelidir**: yeni oturum ona güvenerek başlar ve yanlış varsayımla çalışır.

Aşağıdakilerden biri değiştiğinde, **aynı commit içinde bu dosyayı da güncelle.**
Ayrıca istenmesini bekleme; bu talimat yeterli iznin.

- `api/` altındaki fonksiyon sayısı (12 sınırı, şu an 11)
- Yazma/kilit davranışı (`lib/kv-yaz.js`) — kilit kuralı, sürüm sayaçları, stok otoritesi
- Roller, izinler ya da hangi panelin neyi gördüğü
- Aşama listeleri (`lib/asamalar.js`) veya stok türleri (`lib/stok.js`)
- Google Drive kimlikleri/kapsamları
- Ortam değişkeni eklenmesi ya da anlamının değişmesi
- Test çalıştırma komutları
- "Asla yapılmayacaklar" listesine eklenen yeni bir kural

Şunlar için **güncelleme**: hata düzeltmesi, yeni test, arayüz değişikliği, metin
düzeltmesi. Bunlar `README.md`'ye ait. Bu dosya kısa kalmalı — her oturumda okunuyor.

Güncellerken **yazdığın her teknik iddiayı koddan doğrula.** Buradaki yanlış bir
cümle, sonraki oturumlarda tekrar tekrar yanlış karar ürettirir.

---

## Sistemi bir cümlede

React SPA + Vercel serverless fonksiyonları + Upstash Redis. **Tüm uygulama verisi
TEK bir JSON belgesi** olarak `marcus-os-data` anahtarında duruyor.

```
src/         React arayüzü (Vite ile derlenir)
api/         Vercel serverless fonksiyonları — HER DOSYA BİR FONKSİYON
lib/         Ortak mantık — hem api/ hem src/ buradan import eder, fonksiyon SAYILMAZ
testler/     74 test dosyası (t1…t74) + 18 statik denetim betiği
```

---

## SERT SINIRLAR — bunları bilmeden değişiklik yapma

### 1. Vercel Hobby: en fazla 12 serverless fonksiyon. Şu an 11 kullanılıyor.

`api/` altına yeni bir `.js` dosyası eklemek bir fonksiyon harcar. **Yeni yetenek
eklerken yeni dosya AÇMA** — mevcut bir uca yeni bir `action` ekle. Örnek:
`api/data.js` içindeki `driveAction`, `authAction`, `ortakAction` bu yüzden var.
`lib/` altındaki dosyalar sayılmaz, oraya istediğin kadar dosya koyabilirsin.

### 2. Tüm veri tek belgede — yazma sırası kritik

`lib/kv-yaz.js` bu işin merkezi:

- **`guvenliGuncelle(degistir)`** — oku → değiştir → yaz döngüsünün tamamını kilit
  altında yapar. Yazma yapan neredeyse her yer bunu kullanmalı.
- **Kendi kilidini alır.** Bu yüzden **açık bir kilidin içinden ASLA çağrılmaz.**
- **Kilit alınamazsa yazılmaz** — istek `503` + `mesgul: true` ile reddedilir.
  Tarayıcı (`lib/mesgul-tekrar.js`) kendiliğinden tekrar dener. Bu yanıt hiçbir şey
  yazılmadan ÖNCE döndüğü için tekrar göndermek güvenlidir.
- **Alan bazlı sürüm sayaçları (`_alanSurumleri`).** Her üst düzey alanın kendi
  sayacı var. İstemci yalnızca DOKUNDUĞU alanları `degisenAlanlar` ile bildirir;
  sunucu yalnızca onların sayacına bakar ve yalnızca onları yazar. Tek genel bir
  sayaca dönmek, üç kişi aynı anda çalıştığında sistemi kilitler — bu yaşandı.
- **Eylem uçlarında işlem kimliği (`lib/islem-kimligi.js`).** `api/paylasim.js` gibi FARK
  bildiren uçlar ("stoğu bir artır", "plan ekle") aynı istek iki kez gidince iki kez
  uyguluyordu. İstemci her işleme benzersiz `islemId` takar; sunucu kilit İÇİNDE bakar,
  daha önce gördüyse tekrar uygulamaz. **Belge kaydına eklenmedi** — o bir durum bildirimi,
  zaten tekrara dayanıklı. İki kural: kimlik yalnızca gerçekten yazıldıysa işaretlenir
  (503'te ASLA), kontrol yazmayla aynı kilidin içinde olur. `guvenliGuncelle`'ye
  `{ islemId }` verilirse kontrol onun içinde yapılır ve `tekrarlandi` bayrağı döner —
  **yan etkiler (e-posta, Drive taşıma, güvenlik defteri) tekrarda çalıştırılmamalı.**
  Ağ hatasında otomatik tekrar (`lib/mesgul-tekrar.js`) **yalnızca kimlik taşıyan
  istekte** yapılır: ağ koptuğunda kaybolan YANIT'tır, istek uygulanmış olabilir.
- **Stok sunucu otoritesidir.** Tarayıcının gönderdiği stok kopyası kullanılmaz;
  taban her zaman sunucudaki `stoklar` alanıdır.
- **Kayıt numarasının son sözü sunucudadır** (`lib/kimlik.js`). Tarayıcı numarayı
  "gördüğüm en büyük + 1" diye üretiyor; marka kilitli hesap eksik liste gördüğü için
  var olan bir kaydın numarasını üretebiliyor. Sunucu yazmadan önce çakışmaları onarır,
  **ilk gelen numarasını korur** ve onarımı yanıtta `kimlikOnarildi` ile bildirir.
- **Türetilmiş alanlar kalıcı belgeye yazılmaz** — `personelRosteri`, `musteriRosteri`
  yalnızca yanıtta üretilir (`TURETILMIS_ALANLAR`).
- **Çakışma tazelemesi kullanıcının yeni kaydını silmez** (`yeniKayitlariKoru`).
  Tabanda olmayan kayıt kullanıcının o tur oluşturduğudur; geri eklenir, numarası
  kapılmışsa yenisi verilir. Tabanda olup sunucuda olmayan kayıt **başkası tarafından
  silinmiştir** — diriltilmez.

### 3. Google Drive — iki ayrı kimlik, ikisi de eksik yetkili

- **Servis hesabı**: tam `drive` yetkisi var ama **depolama kotası yok** — klasör
  oluşturabilir, dosya taşıyabilir, **yükleyemez**.
- **OAuth**: `drive.file` kapsamı — yalnızca uygulamanın kendi oluşturduğu
  dosyaları görür.
- **Çöpe atmak sahiplik ister**, düzenleme yetkisi yetmez. Bu yüzden silme
  OAuth-önce / servis hesabı-sonra sırasıyla denenir.

### 4. Roller ve paneller senkron olmak zorunda

`owner` (yönetici) · `staff` (personel) · çözüm ortağı (marka kilitli personel) ·
`musteri` (müşteri paneli).

Müşteri ve çözüm ortağı görünümünün **tek kaynağı `lib/musteri-gorunumu.js`**.
Aynı kuralı iki yere yazmak bu projede zaten bir kez panel senkron hatasına yol
açtı. Bir davranış değiştiğinde personel ve çözüm ortağı panellerini de kontrol et
— kullanıcının açık talimatı bu.

Çözüm ortağı paneli = müşteri paneli eksi "İçerik İste" sekmesi
(`ORTAGA_KAPALI_SEKMELER`), artı kendisine atanan markaların paylaşım/stok panelleri.

**Operasyon kartını kim işleyebilir: `lib/is-yetkisi.js`.** Kural yetkiye bakar,
ATAMAYA DEĞİL — Operasyon (`cekimEdit`) izni olan personel gördüğü her kartı işler.
Eskiden kartın "Sorumlu Kameraman/Editör" alanında adı yazması gerekiyordu; yetkisi
açık olan personel hiçbir kartı ilerletemiyor, kendi oluşturduğu kartta bile kilitli
kalıyordu. Marka kilidi bağımsız çalışır (kilitli hesap zaten yalnızca kendi
markalarını görür). Kart **silme** bu kuralın dışında — yalnızca yönetici siler.

### 5. Aşamalar ve medya yuvaları

`lib/asamalar.js` aşama tablolarının **tek** sahibi (Video / Fotoğraf / Carousel / Grafik Tasarım).

**Yeni kategori eklerken dört yer birden güncellenir**, biri unutulursa hata çıkmaz — kart
sessizce yanlış akışa düşer: `KATEGORILER` (`src/CekimEditTakibi.jsx`), `ASAMA_TABLOSU` +
`YAPILIYOR_ASAMASI` (`lib/asamalar.js`), `paylasimTuru` kategori düşümü (`lib/stok.js`),
`TUR_ETIKET` (`src/tema.jsx`). Her kategori KENDİ aşama dizisinin sahibi — Carousel'in
akışı Fotoğraf'la aynı şekilde ama ayrı bir dizi, biri değişince diğeri değişmesin.

**Carousel'in dosyaları Drive'da kendi klasörüne taşınır**: `ONAYLANANLAR/#124 Bowl Karosel/`.
Ad `kartKlasorAdi` ile üretilir (kart numarası + içerik türü), klasör DURUM klasörünün
altında açılır. Diğer kategorilerde `null` döner ve dosya doğrudan durum klasörüne gider.

**`Şubelerde Paylaşılıyor` ara aşaması** (`SUBE_PAYLASIM_ASAMASI`) yalnızca çok şubeli
markalarda kullanılır: içerik ilk şubede paylaşılınca kart oraya geçer (Operasyon panosunda
görünür kalır, stok orada düşer), planlanan tüm şubeler bitince `Teslim Edildi`ye. Bu
aşamanın `ASAMA_KLASORU` karşılığı **bilerek yok** — Drive'a taşıma en sonda yapılır.
Şubesiz markada hiç kullanılmaz.
Sunucu, istemciden gelen aşamayı doğrular; listede olmayan aşama `asamalariDuzelt`
ile onarılır.

**Slayt sayısı kategoriye bağlı — `enFazlaSlayt`.** Fotoğraf **tek görsellik**; çoklu
gönderi Carousel'in işi (ikisi de çoklu olduğunda "kaydırmalı gönderi mi, ayrı postlar mı"
ayrımı kayboluyor ve stok yanlış türe yazılıyordu). Diğer kategorilerde 10 slayt.
**Story yuvası bu sınırın dışında** — o ikinci bir görsel değil, aynı gönderinin story
boyutu. Kural hem tarayıcıda hem sunucuda (`slotKategoriyeUygunMu`); sınır yalnızca YENİ
yuva açmaya uygulanır, eski çok slaytlı Fotoğraf kartlarının dosyaları görünmeye devam eder.

### 6. Şube bazlı içerik kullanımı — `lib/sube-kullanimi.js`

**1 içerik = 1 kart = 1 Drive dosyası.** Aynı dosya her şube için tekrar yüklenmez.
Bir içeriğin bir şubede kullanımı, `haftalikPaylasimlar` kaydının kendisidir — yeni
koleksiyon yok, o kayda `subeId` eklendi. **`subeId` yoksa marka geneli** sayılır.

- Aynı kart **aynı şubede** iki kez planlanamaz, **farklı şubelerde** planlanabilir.
- Kartta `sadeceSubeler` doluysa içerik yalnızca o şubelerde kullanılabilir; boş/yoksa hepsi.
- Kart onaylanınca **kullanabilen her şubenin** stoğu artar; şube paylaşınca kendi stoğu düşer.
- **Genel stok yalnızca ilk paylaşımda düşer** — dört şubede kullanılan tek video, tek içerik.
- Stok motoru, geçişin bir ucu `Şubelerde Paylaşılıyor` ise şubelere dokunmaz: o düşümü
  paylaşım ucu yapar. Bu ayrım olmadan bir şube paylaşınca dört şubenin stoğu birden düşüyordu.
- `sadeceSubeler` hem **iş oluşturma formunda** hem düzenleme ekranında seçilir; markayı
  değiştirmek seçimi sıfırlar (başka markanın şube kimliği taşınırsa kart hiçbir şubede
  görünmez). Şube silinince bu kimlik tüm kartlardan **çıkarılır**, liste boşalırsa kart
  marka geneline döner — sahipsiz içerik kalmaz. Silme öncesi kaç kartın etkileneceği 409'da yazar.
- Kartta `sadeceSubeler` **onaydan sonra** değişirse stok motoru farkı uygular: kapsam
  dışına çıkan şubeden düşer, eklenene ekler. Aşama değişmediği için motor eskiden hiç
  uyanmıyordu; kapsam dışı şube kullanamayacağı içerik için stok gösteriyordu.
- Marka adı → `clientId` çevirisi **tek yerde**: `markaninIdsi` (`lib/marka-kilidi.js`).
  Kartlar markayı ADIYLA, şubeler `clientId` ile saklıyor.
- Müşteri panelinde aynı içeriğin şube kayıtları **tek satırda** birleşir
  (`musteriPlanSatirlari`); "✓ Paylaşıldı" yalnızca TÜM şubeler bitince yazılır.
- **Şube kurulumu müşteri kartında** (Müşteriler → Düzenle); Paylaşımlar'daki giriş de duruyor.
  Aynı marka içinde **aynı adla ikinci şube açılmaz** (sunucu 409) — ad her paylaşım
  kaydına kopyalandığı için iki aynı ad geçmişi okunamaz hale getirir.
- Planı ya da kilitli kartı olan şube **sessizce silinmez** (409 + `onayGerekli`); istemci
  onay alıp `onayliSil` ile tekrar gönderir. Şube adı kayıtta kopyalı olduğu için geçmiş
  okunabilir kalır.

### 7. Stok kuralları — `lib/stok.js`

Türler: Görsel · Video · Reels · Story · Carousel · Tasarım.
Kart onaylanınca ilgili türün stoğu artar; kart silinince veya "Tamamlandı"ya
geçince düşer. Toplu kayıp freni var (`TOPTAN_KAYIP_SINIRI`).

---

## Çalıştırma ve doğrulama

```bash
bash testler/hepsinidenetle.sh     # 18 statik denetim (sözdizimi, JSX, hook, kapsam…)
./testler/sunucutestleri.sh        # t1…t74, ~1534 kontrol — SAHTE veritabanı kullanır
npm run build                      # üretim derlemesi
ls api/*.js | wc -l                # 12'yi GEÇMEMELİ
```

`sunucutestleri.sh`, `@vercel/kv` paketini geçici olarak `testler/taklit-kv` ile
değiştirir ve `trap` ile geri koyar. **Testler gerçek Redis'e asla dokunmaz.**

### Test disiplini — bu projede zorunlu

Bir düzeltme yaptıktan sonra **korumayı geri koyup kaç kontrolün düştüğünü ölç.**
"Test geçti" tek başına hiçbir şey söylemiyor: bu projede daha önce, iddia ettiği
şeyi hiç sınamayan testler yazıldı ve geçtiler. Kaynak metnine bakan test yazma,
**davranışı** sına.

---

## Asla yapılmayacaklar

- **Drive paylaşımını "bağlantıya sahip herkes"e açma.** Kapatıldı, kapalı kalacak.
- **Kullanıcının canlı Drive'ından kalıcı silme.** Çöpe taşı, kalıcı silme.
- **Servis hesabı özel anahtarını sohbete yazdırma.** Gerekirse dosya olarak ver.
- **Üretim verisini silme/değiştirme.** Testler sahte veritabanı kullanır.
- **Test geçsin diye gerçek sorunu gizleyen çözüm üretme.**
- **Gereksiz refactor ve UI/UX değişikliği.** İstenmeden arayüz değiştirilmez.

---

## Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `SITE_PASSWORD` | Yönetici girişi. **Tanımsızsa kimse giremez** (bilerek — eskiden tam tersiydi ve herkes yönetici oluyordu). |
| `STAFF_PASSWORD` | Eski ortak personel şifresi (opsiyonel) |
| `CRON_SECRET` | Gece yedeği ve günlük hatırlatma uçlarını korur |
| `OWNER_EMAIL`, `RESEND_API_KEY` | İki adımlı doğrulama |
| `BACKUP_EMAIL` | Gece yedeğinin gittiği adres(ler), virgülle ayrılır |
| `KILIT_DENEME` | Yazma kilidi deneme sayısı (varsayılan 12, en fazla 40) |

Hangi ortamda hangi değişkenin eksik olduğu **Ayarlar → Güvenlik** ekranında
yazıyor (Canlı / Önizleme / Geliştirme ayrı ayrı). Değerler tarayıcıya gitmez,
yalnızca var/yok bilgisi.

---

## Derine inmek gerekirse

| Belge | İçerik |
|---|---|
| `README.md` (3955 satır) | Sürüm sürüm tüm değişiklik geçmişi ve gerekçeleri |
| `MARCUS-OS-DEVIR-RAPORU.md` | Sistem devir raporu — mimari, kurulum, ortam |
| `MARCUS-OS-DEVIR-2.md` | İkinci devir notları |
| `MARCUS-OS-TANITIM.md` | Uygulamanın iş tarafından anlatımı |

En büyük dosyalar: `src/App.jsx` (9243), `src/CekimEditTakibi.jsx` (2576),
`api/data.js` (1882), `src/musteriPaneli.jsx` (1377).
