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
- İlk render (`data === null`) ya da `operasyonOrtakProps` davranışı
- Ortam değişkeni eklenmesi ya da anlamının değişmesi
- Test çalıştırma komutları, denetim sayısı
- "Asla yapılmayacaklar" listesine eklenen yeni bir kural
- Alan adı / DNS / barındırma topolojisi

**Alan bilgisi artık buraya YAZILMAZ — ilgili skill'e yazılır.** Roller ve izinler
`marcus-yetki`'ye, aşama/stok `marcus-operasyon`'a, Drive `marcus-veri`'ye, tasarım
kararı `marcus-design`'a. Kuralı hem buraya hem skill'e yazmak, tam da önlenmek istenen
çift kaynağı üretir. Hangi kuralın nereye ait olduğu aşağıdaki **tel satırları**
tablosundan okunur.

Yeni bir **uç, modül, ortam değişkeni ya da zamanlanmış iş** eklendiğinde
`MARCUS-OS-SISTEM.md` de güncellenir — `testler/sistemBelgesi.mjs` denetimi bunu zorlar.

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
testler/     111 test dosyası (t1…t111) + 27 statik denetim betiği
.claude/     Komutlar, ajanlar ve UZMANLIK SKILL'LERİ — aşağıdaki tablo
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
  **`cekimIsleri` koşulsuz eklenmez**: aşama onarımı ve stok motoru kartlara
  dokunabiliyor ama her zaman dokunmuyor. Koşulsuz eklendiğinde yalnızca reklam
  kaydeden biri kart üzerinde çalışan herkesi 409'a düşürüyordu — ölçüldü. Sayaç
  yalnızca `merged.cekimIsleri !== existing.cekimIsleri` ise artar.
- **Çakışma birleştirmesi kartın İÇİNDEKİ medyayı da korur** (`medyalariBirlestir`).
  `yeniKayitlariKoru` yalnızca yeni KAYDI koruyor; var olan bir karta az önce
  yüklenen dosya "düzenleme" sayılıp siliniyordu — dosya Drive'da duruyor ama
  kartta görünmüyordu. Slot çakışırsa yeni dosya boş bir slota alınır; başkasının
  SİLDİĞİ dosya diriltilmez.
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
- **Bozuk belge üzerine YAZILMAZ** (`belgeOkunabilirMi`). `kv.get` metin, dizi ya da
  sayı döndürebiliyor (bozulmuş anahtar, yarım yazma). Eskiden bu boş bir belgeye
  çevriliyor ve uygulama sessizce BOMBOŞ açılıyordu — kullanıcı "her şey silinmiş"
  sanıp kayıt giriyor, o kayıt kurtarılabilir verinin üstüne yazılıyordu. Artık okuma
  da yazma da `409` ile reddedilir. `null` bozuk DEĞİLDİR: ilk kurulumda belge yoktur.
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

### 3. Arayüzün iki kırmızı çizgisi

**Bileşen gövdesindeki her satır İLK RENDER'DA da çalışır — `data` o an `null`.**
`operasyonOrtakProps` nesnesi JSX'ten gövdeye taşınınca `data.clients` null üzerinden
okundu ve uygulama SİYAH EKRANLA açılmadı; üretime böyle çıktı. Derleme ve 2297 kontrolün
hiçbiri yakalamadı çünkü hiçbiri uygulamayı gerçekten ÇİZMİYOR. Gövdede `data`ya
dokunuyorsan `const veriKaynagi = data || {}` gibi bir korumadan geç.

**Operasyon paneli İKİ yerde çiziliyor** (personel ve yönetici) ve ortak prop'lar
`operasyonOrtakProps` nesnesinde TEK yerde toplanıyor (`src/App.jsx`). Yirmi iki prop iki kez
yazılıydı ve bu oturumda üç kez yalnızca birine eklendi: yeni yetenek diğer rolde hiç
görünmedi. Role özel olanlar (yetki alanları, ücret/avans) çağrı yerinde kalır. **Nesne,
kullandığı fonksiyonlardan SONRA tanımlanmalı** — önce tanımlanırsa çalışma anında
"before initialization" hatası verir ve derleme bunu yakalamaz.

**Bir davranış değiştiğinde personel ve çözüm ortağı panellerini de kontrol et** —
kullanıcının açık talimatı bu. Müşteri ve çözüm ortağı görünümünün tek kaynağı
`lib/musteri-gorunumu.js`; ayrıntı `marcus-yetki` skill'inde.

---

## UZMANLIK BİLGİSİ NEREDE — tel satırları

Bu dosya **her oturumda** okunuyor, bu yüzden yalnızca her işi ilgilendiren kırmızı çizgileri
taşıyor. Alana özel ayrıntı `.claude/skills/` altında ve **gerektiğinde** yükleniyor.
Kural iki yerde yazmıyor: taşınan bölüm buradan ÇIKARILDI.

| Dokunduğun yer | Yükle |
|---|---|
| Yeni uç, action, modül, mimari karar, 12 sınırı ayrıntısı | **`marcus-mimari`** |
| Google Drive, video akışı, dosya yükleme, önizleme, klasör | **`marcus-veri`** |
| Rol, izin, marka kilidi, müşteri/ortak paneli, giriş ve silme defteri | **`marcus-yetki`** |
| Kategori, aşama, medya yuvası, stok, şube, plan, pano | **`marcus-operasyon`** |
| Ücret, ödeme, tahakkuk, kâr, muhasebe | `marcus-operasyon` → `references/para.md` |
| Arayüz, ekran, bileşen, stil, yerleşim, UX | **`marcus-design`** |
| Test, statik denetim ya da ölçüm YAZMA | **`marcus-dogrulama`** |

**Emin değilsen yükle.** Okumamanın maliyeti okumanınkinden çok yüksek.

Ajanlar: **`gelistirici`** (uygular) · **`tasarimci`** (ekran kararı verir, kod yazmaz) ·
**`denetci`** (yayın öncesi inceler) · **`dogrulayici`** (zinciri koşturup ölçer).
Komutlar: **`/dogrula`** · **`/olc`** · **`/yayinla`**.

## Çalıştırma ve doğrulama

```bash
bash testler/hepsinidenetle.sh     # 27 statik denetim (sözdizimi, JSX, hook, kapsam…)
./testler/sunucutestleri.sh        # t1…t111, 2570 kontrol — SAHTE veritabanı kullanır
npm run build                      # üretim derlemesi
npm run test:acilis                # TARAYICI açılış testi — uygulamayı gerçekten çizer
ls api/*.js | wc -l                # 12'yi GEÇMEMELİ
```

Claude Code'da bu **beş adımın tamamı `/dogrula`**, kırarak ölçme ritüeli ise **`/olc`**,
yayın sırası (belge → doğrula → ölç → commit → PR → birleştirme sırası) **`/yayinla`**
komutunda duruyor. Yayın öncesi gözden geçirme için **`denetci`** ajanı var — salt okunur,
farkı bu projenin gerçekten yaşadığı hata sınıflarına karşı denetler (`.claude/agents/`).
Hepsi prosedür taşır, kural DEĞİL — kurallar burada kalır, iki yere yazılmaz.

**Düşen denetim artık görünür.** `hepsinidenetle.sh` bir süre `komut > /dev/null && echo
"✓ …"` biçimindeydi: denetim düşünce çıktı çöpe gidiyor, `✓` basılmıyor ve betik sessizce
devam ediyordu — çıkış kodu da son satırınki oluyordu. Denetim 24 bu yüzden DÖRT sürüm
boyunca düşük kaldı ve "hepsi temiz" diye raporlandı; `… | grep ✗` ile doğrulamak hiçbir
zaman bir şey bulamazdı. Artık düşen denetimin çıktısı basılıyor ve betik **1 ile çıkıyor**.
Doğrularken `✓` saymayı bırak, **çıkış koduna bak.** 7. denetim bir boru hattı olduğu için
bir süre sarmalayıcının dışında kaldı ve tek başına çıkış kodunu etkilemiyordu; artık o da
bir fonksiyona alınıp `denetle`den geçiyor. **İstisna kalmadı, 27 denetimin hepsi sayaçta.**
`cagridenetle.py`'nin KENDİ çıkış kodu kullanılamaz — iki bilinen yanlış alarm
("Tamamlananlar" bir JSX başlığı, "Ciro" bir dize sabitinin içi) yüzünden zaten 1 dönüyor;
karar süzgeçten GERİYE KALAN satırlara göre veriliyor.

**Tarayıcı açılış testi — `testler/tarayiciAcilis.mjs`.** Yukarıdaki diğer üç adımın
hiçbiri uygulamayı ÇİZMİYOR; siyah ekran hatası tam olarak bu boşluktan üretime çıktı.
Test derlenmiş uygulamayı `127.0.0.1`'de açar, `#root` içine gerçekten içerik çizildiğini
ve açılışta yakalanmamış JS hatası olmadığını doğrular. **Üç senaryo, 37 kontrol**:
boş veritabanı · dolu veritabanı · **müşteri detay paneli**. **Ölçüldü**: hata bileşen
gövdesine geri konulduğunda derleme 0, denetimler 0, 2570 kontrol geçiyor — yalnızca
bu test düşüyor (34 kontrol).

**Açılış yetmiyor, DERİN EKRAN da çiziliyor.** İlk iki senaryo Dashboard'da duruyordu:
`ClientDetail` hiç mount edilmiyordu ve panelin 441 satırlık çizimi hiçbir katman
tarafından ölçülmüyordu. Ölçüldü: panele garanti çöken bir satır konulduğunda doğrulama
zincirinin BEŞ adımı da yeşil kalıyordu. Üçüncü senaryo markaya tıklayıp paneli açıyor,
kimlik satırını, karar şeridinin hangi dalı çizdiğini, bakiyeyi, birincil düğmeyi ve
**sekme geçişini** ölçüyor. Kırarak ölçüldü: kimlik şeridine çöken erişim → 15 kontrol,
karar şeridine yanlış girdi → 5 kontrol, ölü sekme geçişi → 3 kontrol düşer.

**Tarih bağımlı ekran, fixture'da BUGÜNE GÖRELİ kurulur.** Karar şeridi
`clientOverdueMonths` / `clientPaymentStatus` üzerinden geliyor ve ikisi de `new Date()`e
bakıyor; sabit tarih yazmak, testin aylar sonra kimse dokunmadan kırmızıya dönmesi
demektir. Fixture'daki marka `odemeGunu: 1` (ayın kaçı olduğu sonucu değiştiremez),
başlangıç 8 ay önce, 6 ay önceki ay tam ödenmiş — dal her koşuda aynı. Altı farklı sahte
tarihle (ay sonu, yıl sonu, 29 Şubat dahil) koşturularak doğrulandı.

Beş kural:
- **Testin KENDİSİ sessizce anlamsızlaşamaz.** Bu testin bütün gücü iki parametrede duruyor
  ve ikisi de tek karakterle etkisiz hâle getirilebiliyordu: `enAzMetin` 0 olursa
  `(metin || 0) >= 0` her girdide doğrudur, `beklenenMetin` boşalırsa `[].every(...)` her
  girdide doğrudur. İkisi de ekrana YANLIŞ bir `✓` basıyor ve doğrulama zincirinin BEŞ adımı
  da yeşil kalıyordu — ölçüldü. Üçüncüsü daha beteri: bir `senaryo()` çağrısı silinince test
  "7 kontrol geçti, uygulama açılıyor" deyip 0 ile çıkıyordu. Artık eşik pozitif, liste dolu
  olmak zorunda ve sonda t95'teki gibi bir **`BEKLENEN` sayacı** var. **Kontrol eklerken o
  sabiti de artır** — artırmazsan test düşer; asıl engellenmek istenen, sayının kendiliğinden
  DÜŞMESİ ve kimsenin görmemesi.
- **Gerçek veri ve üretim ortamı YOK.** `/api/*` yanıtları testin içindeki uydurma
  belgeden gelir; Redis'e, Drive'a, Vercel'e hiç dokunulmaz.
- **Ağdan yalıtık.** `127.0.0.1` dışına giden her istek boş yanıtla karşılanır (uygulama
  `index.html`'de Google Fonts'a başvuruyor). Test ağ olmadan da aynı sonucu verir.
- **Uydurma belge GERÇEK belgenin bütün üst düzey alanlarını taşır.** Eksik bırakmak testi
  değersizleştirir: fixture hiç oluşmayan bir hâli temsil eder ve test olmayan sorunları
  kovalar. Bu yaşandı — eksik fixture önce yanlış yere baktırdı.
- **Hazır olma beklenir, iddia edilmez.** Bekleme koşulu bir süre yalnızca "`#root`un
  çocuğu var mı" diye bakıyordu; oysa `data` gelene kadar çizilen "… yükleniyor…" ara
  ekranı DA bir çocuk düğüm. Yüklü makinede ölçüldü: senaryo 2'de iki kontrol ara ekranı
  görüp düştü, uygulamada hiçbir sorun yokken. Artık ara ekran gidene kadar bekleniyor —
  bu bir bekleme, bir iddia değil: ara ekran hiç gitmezse zaman aşımı olur ve test
  gürültülü kırılır. Kararsız bir test, olmayan testten kötüdür.

Derleme gerekiyor: `dist/` yoksa test kendisi `npm run build` çalıştırır.
**Tarayıcının yeri makineden makineye değişir**, bu yüzden sabit yol YAZILMAZ — sırayla
`MARCUS_CHROMIUM` → `PLAYWRIGHT_BROWSERS_PATH` → `playwright-core`'un kendi indirdiği
tarayıcı → sistem kanalları denenir, ilk açılan kullanılır. Hiçbiri açılmazsa test
**sessizce geçmez**: ne denendiğini yazıp 1 ile çıkar. "Tarayıcı bulunamadı" ile
"uygulama açılmıyor" ayrı şeylerdir ve ekranda ayrı yazarlar.

`sunucutestleri.sh`, `@vercel/kv` paketini geçici olarak `testler/taklit-kv` ile
değiştirir ve `trap` ile geri koyar. **Testler gerçek Redis'e asla dokunmaz.**

### Test disiplini — bu projede zorunlu

**Bölümleri `await` etmeyi unutma.** t95 bir kez sessizce bozuldu: bölümler `await`
edilmediği için hiç çalışmadı, test "0 kaldı" deyip BAŞARIYLA çıktı — koşucu da yakalamadı
(çıkış kodu 0, ✗ yok). Bu yüzden t95 sonunda çalışan kontrol sayısını sabitle karşılaştıran
bir bekçi var.

**Saf bir modülün dönüş değeri atılmaz** (denetim 24). Saf fonksiyon verilen veriyi
DEĞİŞTİRMEZ, yalnızca yenisini döndürür; `siraliGruplar(gruplar, sira);` diye çağrılan
satır hiçbir şey yapmaz ama bir şey yapıyormuş gibi durur. Çekim listesinin elle sırası
tam olarak böyle çalışmadı: sıra sunucuya yazılıyor, "Elle sıralama açık" yazısı çıkıyor,
liste yerinde duruyordu. Modülün kendi testi (t93) geçiyordu — arayüzün onu nasıl
çağırdığına bakan hiçbir katman yoktu. Saflık listesi `MARCUS-OS-SISTEM.md`'deki
"(**saf**)" işaretinden okunur.

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
| `RESEND_FROM` | E-postaların gönderen adresi |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Servis hesabı — klasör açar, taşır, **yükleyemez** |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth — dosyayı O yükler |
| `DRIVE_ONAY_KLASOR_ID` | Ortak üst klasör; markanın kendi klasörü yoksa içinde marka adıyla alt klasör açılır |

Tam liste ve her birinin nerede okunduğu `MARCUS-OS-SISTEM.md` §9'da.

Hangi ortamda hangi değişkenin eksik olduğu **Ayarlar → Güvenlik** ekranında
yazıyor (Canlı / Önizleme / Geliştirme ayrı ayrı). Değerler tarayıcıya gitmez,
yalnızca var/yok bilgisi.

### Alan adı ve barındırma — kim nerede

Bu üçü ayrı şirketlerde ve **hangisinin neyi yönettiği karıştırılırsa siteyi ya da
e-postayı düşürürsün.** Eylül 2026'da panellerden tek tek doğrulandı:

| Ne | Nerede |
|---|---|
| **Alan adı kaydı** (`marcusmedya.com`) | **isimtescil.com** |
| **DNS** | **Natro** — nameserver'lar `NS1.NATROHOST.COM`, `NS2.NATROHOST.COM` |
| **Web sitesi + e-posta kutusu** | **Natro** — "WP Max Profesyonel" paketi, WordPress |
| **Uygulama (Marcus OS)** | **Vercel** — bu depo |
| **İşlemsel e-posta** | **Resend** |

- **DNS kaydı Natro'ya girilir, isimtescil'e DEĞİL.** Kayıt isimtescil'de ama nameserver'lar
  Natro'yu gösteriyor; kayıtlar her zaman nameserver'ın gösterdiği yere yazılır.
- **isimtescil'deki "Domainler için kullanılacak DNS'i Seçiniz" ekranına DOKUNMA.**
  "İsimtescil Default DNS'ler"i işaretleyip Güncelle'ye basmak nameserver'ları Natro'dan
  alır — web sitesi VE `info@marcusmedya.com` aynı anda düşer.
- **Natro'nun WP Max panelinde DNS düzenleyici YOK.** Dört yere bakıldı (Alan Adı Yönetimi,
  Hosting Yönetimi, Web Sitesi menüsü, kontrol panelindeki Gelişmiş Ayarlar) — hiçbirinde
  yok. Kayıt eklemek için **Destek İşlemleri'nden talep açmak gerekiyor.**
- **`info@marcusmedya.com` Natro'da barınıyor.** Bu yüzden ana alan adının **MX ve SPF
  kayıtlarına dokunulmaz**; bir alan adında tek SPF olabilir, ikincisini eklemek ikisini
  birden bozar ve normal yazışma da durur.
- **Resend ANA alan adına değil, `send.marcusmedya.com` ALT alan adına doğrulanır.**
  Sebebi yukarıdaki madde: alt alan adının kendi kayıtları ana alan adınınkilere hiç
  dokunmuyor. Resend'deki eski `marcusmedya.com` kaydı `Failed` durumda — alan adı Natro'ya
  taşınınca eski DNS'teki doğrulama kayıtları geride kaldı ve **bütün e-postalar kesildi**
  (giriş kodu, gece yedeği, iş bildirimleri). Sorunun teşhisi günler aldı.
- **`onboarding@resend.dev` yalnızca Resend hesabının SAHİBİNE gönderir.** Alan adı
  doğrulanana kadar `RESEND_FROM` bu adresteyse, `BACKUP_EMAIL` de hesabın adresiyle
  (`marcusmedya@gmail.com`) **aynı olmak zorunda** — başka adres Resend tarafından
  reddedilir. Doğrulama bitince bu kısıt kalkar.

---

## Derine inmek gerekirse

| Belge | İçerik |
|---|---|
| `MARCUS-OS-SISTEM.md` | **Sistemin tam envanteri** — her uç, her modül, her alan, her ekran |
| `MARCUS-OS-DENETIM-RAPORU.md` | Güvenilirlik denetimi (Ağu 2026) — bulunan kusurlar, düzeltmeler, ölçümler |
| `README.md` | Sürüm sürüm tüm değişiklik geçmişi ve gerekçeleri |
| `MARCUS-OS-DEVIR-RAPORU.md` | Sistem devir raporu — mimari, kurulum, ortam |
| `MARCUS-OS-DEVIR-2.md` | İkinci devir notları |
| `MARCUS-OS-TANITIM.md` | Uygulamanın iş tarafından anlatımı |

En büyük dosyalar: `src/App.jsx` (11.622), `src/CekimEditTakibi.jsx` (3.558),
`api/data.js` (2.370), `src/musteriPaneli.jsx` (1.384). Bu sayılar Eylül 2026'da ölçüldü;
kaynak büyüdükçe bayatlar, güncellerken `wc -l` ile doğrula.
