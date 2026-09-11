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
testler/     102 test dosyası (t1…t102) + 24 statik denetim betiği
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

### 3. Google Drive — iki ayrı kimlik, ikisi de eksik yetkili

**Dosyanın kendisi de önemli: `moov` başta mı sonda mı** (`lib/mp4-faststart.js`).
Oynatma bilgisi dosyanın SONUNDAysa tarayıcı videoyu başlatmadan önce sonu indirmek
zorunda; proxy üzerinden bu onlarca saniye sürebiliyor ve bekleme dosyadan dosyaya
değişiyor. Uygulama dosyayı DEĞİŞTİRMEZ — teşhis eder ve oynatıcının altında söyler;
çözüm dışa aktarımda "fast start" açmak.

**Kart açılınca video İNDİRİLMEZ, yalnızca başlığı okunur** (`preload="metadata"`,
`src/CekimEditTakibi.jsx`). Bir süre `preload="auto"` yazıyordu: gerekçe "kullanıcı
oynata basmadan hazır olsun"du, ölçülmemişti. Sonucu, kart açılır açılmaz tarayıcının
dosyanın TAMAMINI çekmeye başlaması; 60 sn'lik fonksiyon sınırına dayanan akış ortadan
kesiliyor ve video takılıyordu. Kullanıcı bunu "Mac/Safari'de kasıyor, Windows'ta akıcı"
diye bildirdi — fark tarayıcının önden ne kadar çektiğiydi. Video ilk eklendiğinde
(19 Ağu) `metadata` idi ve sorun yoktu; akış mantığının kalanı bugün o günkü hâliyle
aynı, tek davranışsal gerileme buydu.

**Oynatıcının altında ÖLÇÜM yazar** (`lib/video-bilgi.js` → `videoBilgiSatiri`):
çözünürlük · dosya boyutu · bit hızı · fast start durumu. Bu satır süs değil — "video
neden kasıyor" sorusu bu projede üç kez tahminle cevaplandı ve üçünde de yanlış yere
dokunuldu. Boyut sunucudan (`content-range`, ek Drive çağrısı YOK), çözünürlük ve süre
tarayıcının `loadedmetadata` olayından gelir. **Bilinmeyen değer için sayı UYDURULMAZ** —
eksik ya da anlamsız (negatif, `NaN`, `Infinity`) girdide o parça hiç yazılmaz; ekranda
"-5 B · -0 kbps" görmek, hiçbir şey görmemekten kötüdür çünkü kullanıcı o rakama bakıp
karar veriyor. `hizliBaslangic === null` (henüz bilinmiyor) ile `false` (kapalı) ayrı
hâllerdir.

**Video akışı istek BAŞINA ucuz olmalı** (`api/data.js` video dalı). Tarayıcı videoda her
ileri-geri sarmada YENİ bir aralık isteği atıyor; bir isteğin maliyeti doğrudan sarma
deneyimidir. Üç kural:
- **Jetonun bitiş zamanı BİR SAATLİK ızgaraya oturur** (`lib/video-jeton.js`), böylece
  adres o süre boyunca aynı kalır ve indirilen parçalar yeniden kullanılır. Saniye saniye
  değişirken aynı videoyu ikinci kez açmak ilk kezle aynı maliyetteydi. Izgara TABANA
  oturtulur — yukarı yuvarlansa jeton ömrü iki saatten üçe çıkardı.
- **Dosya kimliği jetonun içinde** (`lib/video-jeton.js`, `2|` önekli v2 biçim). Eskiden
  video ucu kimliği bulmak için TÜM belgeyi okuyordu — gömülü görsellerle megabaytlarca,
  her sarmada. Eski jetonlar dosya kimliği taşımıyor; onlar için eski yol duruyor.
- **Servis hesabı jetonu modül düzeyinde önbellekli** (`lib/drive-tasima.js`). Bir saat
  geçerli olduğu hâlde her çağrıda RSA imza + ayrı HTTP turu yapılıyordu. 401 gelirse
  jeton unutulup TEK kez yeniden deneniyor — yoksa erken geçersiz kılınan bir jeton süre
  dolana kadar takılırdı. OAuth jetonu AYRI modülde (`lib/drive-yukleme.js`), önbellek
  onu kapsamıyor: iki kimlik karışmamalı.
- **Aralık AYNEN iletilir, parçalanmaz.** Bir süre 12 MB'lık parçalara daraltıldı;
  gerekçe 60 sn'lik fonksiyon sınırıydı ve o gerekçe KODDAN ÇIKARILMIŞTI, ölçülmemişti.
  Ölçüm tersini söyledi: her parça sınırı yeni bir istek (yeni fonksiyon + yeni Google
  turu) demek ve video birkaç saniyede bir takılıyor. Daraltma yokken dosya tek
  bağlantıda akıyor. 60 sn sınırı hâlâ var ama akış oynatmanın önünde ilerlediği için
  zararı çok daha az.
- **Adres tarayıcıda önbellekli** (`lib/onizleme-bellegi.js` → `videoAdresOku/Yaz`).
  Her kart açılışında jeton isteniyordu: bir tur ağ gecikmesi + sunucuda belge okuması,
  hepsi video başlamadan. Anahtar `is:<id>:` önekiyle duruyor ki yükleme/silme sonrası
  `onizlemeyiTazele` onu da düşürsün — düşmezse yeni versiyon yüklendikten sonra ESKİ
  dosya oynatılır. Ömrü 30 dk: jetonun en kısa ömrünün (1 saat) altında.
- **Oynatıcı kutusunun oranı ilk kareden itibaren doğru** (`lib/video-yon.js` →
  `oynaticiOrani`). Oran verilmezse kutunun boyunu POSTER belirliyor; Drive küçük resmi
  yatay olduğu için dikey Reels önce yatay açılıp metadata gelince atlıyordu.
- **İstemci vazgeçince üst akış iptal ediliyor** — sinyal **YANIT** (`res.on("close")`)
  üzerinden, İSTEK üzerinden DEĞİL. Bir süre `req.on("close")` kullanıldı ve video HİÇ
  OYNAMADI: GET isteğinin gövdesi olmadığı için Node o olayı hemen yayıyor, akış daha
  başlamadan iptal ediliyordu. `bitti` bayrağı normal bitişi iptalden ayırır.



- **Servis hesabı**: tam `drive` yetkisi var ama **depolama kotası yok** — klasör
  oluşturabilir, dosya taşıyabilir, **yükleyemez**.
- **OAuth**: `drive.file` kapsamı — yalnızca uygulamanın kendi oluşturduğu
  dosyaları görür.
- **Çöpe atmak sahiplik ister**, düzenleme yetkisi yetmez. Bu yüzden silme
  OAuth-önce / servis hesabı-sonra sırasıyla denenir.

**Drive ↔ kart eşleştirmesi TEŞHİSTİR, onarım değil** (`lib/drive-eslestirme.js`,
`api/paylasim.js` → `driveEslestir`). "Stok kartlardan fazla, eksik kart mı var?"
sorusuna Drive'daki ONAYLANANLAR dosyalarını kartların dosya kimlikleriyle karşılaştırarak
cevap verir. **Tarama üretim Drive'ında HİÇBİR ŞEY YAZMAZ** — klasör açmaz, taşımaz,
silmez; t85 bunu istek yöntemlerini sayarak ölçüyor. Kartın dosyası yalnızca
`medya[].dosyaId` değil, **elle yapıştırılmış bağlantılarda da** olabiliyor
(`editliDosyaLink` vb.) — okunmazsa elle bağlanmış içerik "kartsız" sanılır ve araç
olmayan bir sorun gösterir. Marka çok aylıysa çağrı bütçesi (varsayılan 60) dolabilir;
o zaman **`tamamlanmadi` bildirilir** — sessizce kesilirse eksik liste "temiz" sanılır.
Aylar en yeniden eskiye taranır, bütçe dolarsa güncel dönem elde kalır. Marka klasörü
tanımsızsa **aranır, AÇILMAZ** — bir süre `klasorBulVeyaOlustur` çağrılıyordu ve tarama
ortak klasörün altında marka adıyla yeni klasör açıp sonra "her dosyanın kartı var" diye
sahte temiz rapor veriyordu.

**Uçtan dönen yanıt alanları `BELGE_DISI_ALANLAR`'a yazılır** (`src/App.jsx`). Yanıt gövdesi
`setData` içine olduğu gibi yayılıyor; listeye girmeyen alan BELGEYE SIZAR ve sonraki kayıtta
Redis'e yazılır — `eslestirme` ve `duzeltildi` bunu yaşadı. Ayrıca `paylasimIstek` yanıtı
**döndürmek zorunda**: çıplak `return` yüzünden Drive eşleştirmesi hep `undefined` alıyor,
tarama başarılı olsa bile ekranda "Drive taranamadı." yazıyordu. İkisini de denetim 21 zorluyor.

### 4. Roller ve paneller senkron olmak zorunda

`owner` (yönetici) · `staff` (personel) · çözüm ortağı (marka kilitli personel) ·
`musteri` (müşteri paneli).

**Marka kilidi tek yerde çözülür** (`api/paylasim.js`): uç, isteğin `clientId` /
`planId` / `subeId` / `uyelikId` / `uyelik.clientId` alanlarından hedefin markasını
bulur. Kural **fail-close** — hedef belirsizse kilitli hesap reddedilir. Yeni bir action
eklerken markanın hangi alandan çözüleceğini bu listeye eklemeyi unutma; unutulursa
kilitli hesap o işlemi kendi markasında bile yapamaz.

**`clientId` ile `subeId` birlikte geliyorsa şube o markaya ait mi diye bakılır**
(`markaninSubeleri`). Bakılmazsa kilitli hesap kendi markasının kimliğiyle BAŞKA
markanın şubesini gönderip çöp stok anahtarı üretebiliyor ve şube adını öğrenebiliyordu.

Müşteri ve çözüm ortağı görünümünün **tek kaynağı `lib/musteri-gorunumu.js`**.
Aynı kuralı iki yere yazmak bu projede zaten bir kez panel senkron hatasına yol
açtı. Bir davranış değiştiğinde personel ve çözüm ortağı panellerini de kontrol et
— kullanıcının açık talimatı bu.

Çözüm ortağı paneli = müşteri paneli eksi "İçerik İste" sekmesi
(`ORTAGA_KAPALI_SEKMELER`), artı kendisine atanan markaların paylaşım/stok panelleri.

**Operasyon alt yetkileri — `lib/kart-yetkisi.js`.** `cekimEdit` tek parçaydı; onaylama,
silme ve düzenleme ekranda yalnızca yöneticiye gösteriliyordu **ama sunucu hiç
denetlemiyordu** — `PERMISSION_WRITE_FIELDS` yalnızca "cekimIsleri alanına yazabilir mi"
diye bakıyor. Gizli düğme güvenlik sınırı değildir; sınır artık burada.
`kartAcma` (varsayılan **AÇIK** — önceki davranış buydu) · `kartOnaylama` · `kartDuzenleme` ·
`kartSilme` (üçü varsayılan kapalı). Sunucu gelen listeyi eskisiyle karşılaştırıp **izinsiz
değişikliği geri alır, kaydın tamamını REDDETMEZ** — reddetmek aynı kayıttaki ilgisiz
düzenlemeleri de çöpe atardı. **Stok motorundan ÖNCE** çalışır: izinsiz onay sonradan geri
alınsaydı stok üretilmiş ve Drive'da dosya taşınmış olurdu.

**Yetki kutucukları İKİ ayrı listeden çiziliyor** (`src/App.jsx`): `STAFF_IZIN_LISTESI`
(ortak şifre kartı) ve `IZIN_LISTESI` (kişiye özel panel). Bir kez ayrıştı: alt yetkiler
yalnızca birine eklendi ve kişiye özel panelde HİÇ GÖRÜNMEDİ, yani sunucuda var olan yetki
verilemez kaldı. Ayrıca panelin varsayılanı `DEFAULT_PERMS` ile aynı olmalı — `reklamlar`,
`paylasimlar`, `cekimEdit` sunucuda açıkken panelde kapalı gösteriliyordu, yani panel yalan
söylüyordu. **Denetim 23** üçünü birden karşılaştırır.

**Numara onarımı yetki denetiminden ÖNCE gelir.** Sonra geldiğinde ölçüldü: çözüm ortağının
açtığı kartın numarası GÖREMEDİĞİ bir kartla çakışınca yetki denetimi onu "yeni kart" değil
"var olan kartın düzenlenmesi" sanıyor, alanları geri alıyor ve kart hata vermeden
**kayboluyordu**. Alt yetkiler `KILITLI_IZINLER`'de olmak zorunda — olmasalardı `izinleriDaralt`
onları sıfırlar ve marka kilitli hesap `cekimEdit` açık olduğu hâlde kart açamazdı.

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

**Giriş defteri, tek şifreyle açılan oturumu da kaydeder** (`api/data.js` → `authAction`).
İki adımlı doğrulama yapılandırılmamışsa ya da kod e-postası gönderilemiyorsa sistem
**bilerek fail-open** davranıyor (kilitlenmeyi önlemek için) — ama eskiden bu girişlerin
defterde hiç izi yoktu, yani defter tam da riskli girişleri kaçırıyordu. Artık
`giris-basarili` kaydı `ikiAdimli: false` ile düşüyor, ikinci adım atlandığında
`giris-ikinci-adim-atlandi` yazılıyor ve **ekranda uyarı gösteriliyor**. Giriş davranışı
DEĞİŞMEDİ; eklenen şey kayıt ve görünürlük (t101 ölçüyor).

**Silme güvenlik defterine yazılır — `lib/silme-defteri.js`.** Silme ayrı bir uçtan
GEÇMİYOR: tarayıcı kaydı listeden çıkarıp belgeyi kaydediyor. Bu yüzden silmeyi görmenin
tek yolu, yazmanın öncesiyle sonrasını karşılaştırmak. Defterde on üç kayıt noktası vardı
ve hepsi giriş/hesap/yedek işlemiydi — kart, müşteri, reklam silmenin izi yoktu; oysa silme
bu sistemde geri alması en zor işlem. **Gönderilmeyen alan silme SAYILMAZ**: personel
yalnızca dokunduğu alanları gönderiyor, bu ayrım olmadan her personel kaydı dokunmadığı her
listeyi silinmiş gösterirdi. **İKİ kayıt yolu da bağlı** (personel + yönetici). Ayrıntı
20 kayıtla kırpılır ama TOPLAM tam yazılır. Ücret değişiklikleri de deftere yazılıyor
(`api/paylasim.js` → `subeUcret`, `markaTemelUcret`), eski ve yeni değerle birlikte.

**"Bugün" paneli — `lib/bugun.js`.** Dashboard'ın en üstünde, SALT OKUNUR: geciken işler,
bugün teslim, revize bizde, müşteride bekleyen, bugün paylaşılacak, geciken paylaşım.
Yeni veri yok, hepsi mevcut alanlardan türetiliyor. **Plan kaydı mutlak tarih TUTMUYOR** —
`haftaKey` (haftanın pazartesisi) + `gun` (0-6 kayma). Tarihi bu ikisinden üretmek zorunlu;
`kayit.tarih` diye bakan kod sessizce hiçbir şey bulmaz. Karşılaştırma metin (`YYYY-AA-GG`)
üzerinden: sunucu UTC'de çalıştığı için `new Date` ile karşılaştırma "bugün"ü bir gün
geriye kaydırıyordu.

**Pano önizlemesi GÖRÜNMEDEN istenmiyor** (`src/drive.jsx` → `useGorunurMu`). Otuz kartlık
sütunda otuz istek kuyruğa giriyordu; kart görünür alana girene kadar istek başlamıyor,
girdikten sonra `true` kalıyor (kaydırdıkça tekrar istemek aynı sorunu üretirdi).
IntersectionObserver yoksa doğrudan `true` — fail-open BURADA doğru: en kötü ihtimalde
fazladan istek olur, eksik içerik değil.

**Uyarılar YIĞIN hâlinde gösterilir** (`src/App.jsx` → `uyarilar`). Tek metin state'iyken
çakışma uyarısı, kaydedilmeyen kayıt uyarısı ve onayı geri alınan kart uyarısı aynı yere
yazıyor, sonuncusu öncekini siliyordu — iki sorun aynı anda olduğunda kullanıcı birini hiç
görmüyordu. Aynı metin ikinci kez gelirse tekrarlanmaz.

**Operasyon kartını kim işleyebilir: `lib/is-yetkisi.js`.** Kural yetkiye bakar,
ATAMAYA DEĞİL — Operasyon (`cekimEdit`) izni olan personel gördüğü her kartı işler.
Eskiden kartın "Sorumlu Kameraman/Editör" alanında adı yazması gerekiyordu; yetkisi
açık olan personel hiçbir kartı ilerletemiyor, kendi oluşturduğu kartta bile kilitli
kalıyordu. Marka kilidi bağımsız çalışır (kilitli hesap zaten yalnızca kendi
markalarını görür). Kart **silme** bu kuralın dışında — yalnızca yönetici siler.

### 5. Aşamalar ve medya yuvaları

`lib/asamalar.js` aşama tablolarının **tek** sahibi (Reels / Post / Carousel).

**ÜÇ KATEGORİ — `lib/kategori.js` tek kaynak.** Kategoriler ve stok türleri AYNI liste:
`Reels · Post · Carousel`. Eskiden dört kategori + altı stok türü vardı ve ikisi ayrı
listelerdi. **Eski kayıtlara dokunulmuyor**: belgede hâlâ "Video", "Fotoğraf", "Grafik
Tasarım" kategorili kartlar ve `1_Görsel` / `1_Story` / `1_Tasarım` anahtarları var;
eşleme OKUMA ANINDA yapılıyor (`kategoriEsle`, `turEsle`, `stoklariBirlestir`).

Eşlemenin dokunması gereken YERLER — biri unutulursa kayıt sessizce KAYBOLUR:
`panoSuzgeci` (unutuldu → eski kartlar hiçbir sekmede görünmedi, ölçüldü) ·
`asamaListesi` · `yapiliyorAsamasi` · `enFazlaSlayt` · `paylasimTuru` · `TUR_ETIKET`.

**Kategorisiz kart REELS sayılır**, Post değil. Belgede kategorisi hiç olmayan kartlar
var (her şeyin video olduğu dönemden); Post sayılsalardı aşamaları ("Edit Bekliyor")
Post listesinde bulunmadığı için onarım onları akışın BAŞINA çekerdi.

**Eski tasarım aşamalarından yalnızca `Tasarım Yapılıyor` eşlenir** (→ `Düzenleniyor`).
Bir süre `Talep Alındı` ve `Tasarım Bekliyor` da `Çekim Yapıldı`ya eşleniyordu — ölçüldü:
o zaman `Talep Alındı` taşıyan bir REELS kartı da oraya düşüyor, yani YAPILMAMIŞ bir
çekim yapılmış sayılıyordu.

**Eski stok anahtarları okuma anında toplanır ama bu KALICI ÇÖZÜM DEĞİL** — eski anahtar
hiç düşmez. Bu yüzden stok düzeltmesi (Drive denetimi / mutabakat) yazarken o markanın
eski anahtarlarını SİLİYOR (`eskiTurAnahtarlari`). Bir düzeltme turundan sonra toplama
işlevsiz kalır.

**Yeni kategori eklerken dört yer birden güncellenir**, biri unutulursa hata çıkmaz — kart
sessizce yanlış akışa düşer: `KATEGORILER` (`lib/kategori.js`), `ASAMA_TABLOSU` +
`YAPILIYOR_TABLOSU` (`lib/asamalar.js`), `paylasimTuru` kategori düşümü (`lib/stok.js`),
`TUR_ETIKET` (`src/tema.jsx`). Her kategori KENDİ aşama dizisinin sahibi — Carousel'in
akışı Fotoğraf'la aynı şekilde ama ayrı bir dizi, biri değişince diğeri değişmesin.

**Carousel'in dosyaları Drive'da kendi klasörüne gider**: `ONAY BEKLEYENLER/#124 Bowl Karosel/`.
Ad `kartKlasorAdi` ile üretilir (kart numarası + içerik türü), klasör DURUM klasörünün
altında açılır. Diğer kategorilerde `null` döner ve dosya doğrudan durum klasörüne gider.

**İki ayrı yol var, ikisi de bağlanmalı:** dosya doğrudan hedefe YÜKLENİR
(`hedefKlasoruHazirla`) — servis hesabı yükleyemediği için "önce yükle sonra taşı"
mümkün değil — ve aşama değişince TAŞINIR (`onaylananiTasi`). Yalnızca taşımaya
bağlanınca slaytlar aşama değişene kadar tek tek duruyordu.

Kartın dosyaları silinip klasör **boşalınca çöpe atılır** (`bosaldiysaKartKlasorunuCopeAt`)
— yalnızca gerçekten boşsa, yalnızca adı tutuyorsa ve **yalnızca çöpe**. Listeleme hata
verirse boş sayılmaz. Klasörün sahibi servis hesabıdır (o açtı), dosyalarınki OAuth
hesabıdır — silme yolları bu yüzden ayrı.

Aşama değişince **klasörün kendisi taşınır** (`kartKlasorunuTasi`), dosyalar tek tek
değil: tek çağrı, kaynakta boş klasör kalmıyor ve klasörün kimliği korunuyor. Klasör
bulunamazsa (özellik öncesi kartlar) dosya-dosya yola düşülür.

**Bu taşıma İKİ uçta birden yapılır**: `api/data.js` (aşama kaydı) ve `api/paylasim.js`
(paylaşım işaretleme/İPTAL). İkisi de `kartKlasorunuTasi` kullanmalı — paylaşım ucu bir
süre yalnızca dosya-dosya taşıyordu ve iptal edilince Carousel slaytları kart
klasöründen çıkıp ONAYLANANLAR'a dağınık düşüyor, boş klasör PAYLAŞILDI'da kalıyordu.

`dosyaninAyKlasoru` yukarı doğru 4 basamak yürür. Sabit iki basamakken kart klasörü
üçüncü basamağı görünmez yapıyordu: eski aydaki bir karoselin slaytları taşınırken
içinde bulunulan aya sıçrardı.

**`Şubelerde Paylaşılıyor` ara aşaması** (`SUBE_PAYLASIM_ASAMASI`) yalnızca çok şubeli
markalarda kullanılır: içerik ilk şubede paylaşılınca kart oraya geçer (Operasyon panosunda
görünür kalır, stok orada düşer), planlanan tüm şubeler bitince `Teslim Edildi`ye. Bu
aşamanın `ASAMA_KLASORU` karşılığı **bilerek yok** — Drive'a taşıma en sonda yapılır.
Şubesiz markada hiç kullanılmaz.
Sunucu, istemciden gelen aşamayı doğrular; listede olmayan aşama `asamalariDuzelt`
ile onarılır.

**Pano kartındaki önizleme koşulu `lib/asamalar.js` → `panoOnizlemesiVarMi`.** JSX içinde
`job.editliDosyaLink &&` diye yazılıydı: yalnızca ELLE YAPIŞTIRILMIŞ bağlantısı olan kartta
önizleme çıkıyordu, uygulamadan yüklenen dosya `medya[]` içinde durduğu için o kartlar
panoda BOŞ görünüyordu. Görüntüyü zaten sunucu veriyor ve dosyayı `medya`dan da çözüyor
(t52 ölçüyor) — eksik olan tek şey koşuldu. Kural saf modüle taşındı çünkü **JSX içindeki
bir koşul Node'da çağrılamıyor**; bu projede aynı sınıftan dört hata çıktı, hepsi ancak
sahada görüldü. Yeni bir görünürlük kuralı yazarken onu JSX'e gömme, saf bir fonksiyona koy.

**Slayt sayısı kategoriye bağlı — `enFazlaSlayt`.** Fotoğraf **tek görsellik**; çoklu
gönderi Carousel'in işi (ikisi de çoklu olduğunda "kaydırmalı gönderi mi, ayrı postlar mı"
ayrımı kayboluyor ve stok yanlış türe yazılıyordu). Diğer kategorilerde 30 slayt.
**Story yuvası bu sınırın dışında** — o ikinci bir görsel değil, aynı gönderinin story
boyutu. Kural hem tarayıcıda hem sunucuda (`slotKategoriyeUygunMu`); sınır yalnızca YENİ
yuva açmaya uygulanır, eski çok slaytlı Fotoğraf kartlarının dosyaları görünmeye devam eder.

**Toplu kart açma — `lib/toplu-kart.js`.** "Elimde 20 fotoğraf var, hepsi ayrı kart
olacak": ortak alanlar bir kez giriliyor, ad numaralandırılarak çoğaltılıyor ("Post 13",
"Post 14"…). **Numara markanın MEVCUT kartlarından devam eder** — her açılış 1'den
başlasaydı aynı markada iki "Post 3" olurdu ve kart adı Drive'da dosya adına, planda satır
etiketine, müşteri paneline gittiği için iki içerik ayırt edilemez hâle gelirdi. Numara
markaya özeldir (kartlar markayı ADIYLA saklıyor, liste ortak). **Başlangıç numarası
ÖNERİLİR, DAYATILMAZ** (`baslangiciCoz`): kutu boşken serinin devamı yazıyor, kullanıcı
başka bir sayı yazarsa o geçerli — ayrı bir aralık açmak (101'den başlatmak) ya da silinmiş
kartların yerini doldurmak isteyebiliyor. Geçersiz giriş (0, eksi, metin) otomatiğe düşer;
yazarken silinen bir hane "Post 0" açmasın. Elle seçilen başlangıç var olan bir ada denk
gelirse **engellenmez, SÖYLENİR** (`cakisanAdlar`) — kullanıcı bilerek ikinci bir kart
açabilir ama bunu bilmeden yapmamalı.

**Başlangıç AŞAMASI da seçilir** — iş her zaman akışın başından başlamıyor; inisiyatif
ajansta olan markada içerik hazır geliyor ve kart doğrudan `Onaylandı` açılmalı. Liste
kategorinin KENDİ aşama dizisinden gelir (`asamaListesi`); uydurma aşama stok motorunu
yanlış yöne çalıştırır. **Onay aşaması seçildiyse ve dosya varsa kartlar önce akışın
başında açılır, dosyalar yüklenir, EN SON onaya alınır** — sunucudaki onay kilidi dosyası
olmayan kartın onayını geri alıp isteği 409 ile reddediyor ("kartta dosya bağlantısı yok"),
yani doğrudan onaylı açmak yirmi kartın yirmisinde duvara çarpardı; üstelik stok, dosyalar
yüklenene kadar arkasında içerik olmayan bir sayı gösterirdi. Yükleme yarıda kalırsa aşama
UYGULANMAZ ve bu kullanıcıya yazılır.

**Yeni kart onay aşamasında AÇILAMAZ — `kartOnaylama` yoksa** (`lib/kart-yetkisi.js`).
Denetim yalnızca aşama GEÇİŞİNE bakıyordu: var olan kartı onaya almak yetki istiyordu ama
kartı en baştan `Onaylandı` AÇMAK hiç sorulmuyordu; onay yetkisi olmayan personel tek
adımda stok üretebiliyordu. Kart açılmaya devam ediyor, yalnızca aşaması akışın başına
çekiliyor — kullanıcının emeği çöpe atılmıyor, sınır korunuyor (t97 ölçüyor).

**Kartlar panoda TOPLU TAŞINABİLİR — `lib/toplu-tasima.js`.** Panodaki "Kart seç" modu
kartları seçtiriyor, seçilenler tek kayıtta hedef aşamaya geçiyor. Üç eleme var, üçü de
veri bozulmasına karşı: **hedef aşama kartın KATEGORİSİNDE yoksa taşınmaz** (yazılsaydı
`asamalariDuzelt` tanımadığı aşamayı akışın başına çeker, kullanıcı "taşıdım" sanırken kart
geri düşerdi) · **zaten hedefte olan kart listeye alınmaz** · **hiç taşıma yoksa GELEN DİZİ
aynen döner** — son ikisi sürüm sayacının boşuna artmasını, yani kart üzerinde çalışan
herkesin 409 almasını engelliyor. Hedef aşama listesi seçilen kartların kategorilerinin
KESİŞİMİ; Reels ile Post birlikte seçilirse yalnızca ikisinde de olan aşamalar sunulur.

**Onayı geri alınan kart EKRANDA söyleniyor VE EKRAN SUNUCUDAN TAZELENİYOR**
(`src/App.jsx`, `res.onaylanamadi`). Sunucu geri almayı hep bildiriyordu ama yanıtta kart
listesini GÖNDERMİYOR; istemci yalnızca mesajı yazsaydı kartlar ekranda onayda kalırdı —
sahada tam olarak bu yaşandı ("10 kartın onayı geri alındı" yazdı, kartlar onayda kaldı).
Dahası yanıt yeni sürüm sayaçlarını taşıdığı için **bir sonraki kayıt o eski hâli sunucuya
geri yazar**, yani geri alma sessizce iptal olurdu. Bu yüzden `kimlikOnarildi` dalındaki
gibi belge yeniden çekiliyor. t100 bu sözleşmeyi uçtan ölçüyor.

**Toplu taşıma PARÇA PARÇA gönderilir** (`src/App.jsx` → `topluKartlariTasi`, dörder kart).
Hepsi tek kayıtta gitmişti ve patladı: on kart onaya alınınca sunucunun Drive taşıma
bütçesi (20 sn) doldu ve taşınamayanların onayı geri alındı. Ölçüm: on kart 20 sn'yi aştı,
yani kart başına ~2 sn; dört kart ~8 sn. Her tur **öncekinin kaydı sunucuya inene kadar
bekler** — beklemezse kayıt 500 ms gecikmeli olduğu için hepsi yine tek istekte birleşirdi.
Bir turda onay geri alınırsa **döngü DURUR**: devam etmek yarısı taşınmış, yarısı geri
alınmış karışık bir hâl üretirdi.

**Dosya karta NUMARAYLA DEĞİL TOPLU ETİKETİYLE bağlanır** (`topluId` + `topluSira`;
`api/data.js` yükleme dalı ve `src/App.jsx` → `topluKartaMedyaYaz`). Kartları tarayıcı
açıyor ve numarayı öneriyor ama son söz sunucuda: çakışma varsa sunucu yeni numara veriyor
ve tarayıcıdaki kopya bir süre ESKİ numarayı taşıyor. O aralıkta numaraya göre yüklemek
dosyayı BAŞKASININ kartının içine koyardı — sessizce. Etiket kartla birlikte kaydedildiği
için onarımdan etkilenmiyor. Etiketle bulmak **yetkiyi atlamaz**: marka kilidi kontrolü
kart bulunduktan sonra aynen çalışıyor (t99 ölçüyor). Kayıt sunucuya ulaşmadan yükleme
başlarsa uç `404` diyor; istemci bunu hata saymayıp bekleyip tekrar deniyor — sabit
gecikme tahmini yavaş bağlantıda tutmazdı.

**Yükleme çekirdeği tek yerde**: `driveyeDosyaYukle` (`src/CekimEditTakibi.jsx`, modül
düzeyinde). İki çağıranı var — kartın kendi yükleyicisi ve toplu akış. İkinci bir kopya
tutulsaydı XHR düşünce fetch'e geçme, oturum düşmesi mesajı gibi sahada öğrenilmiş
ayrıntılar orada olmazdı. Fonksiyon medya kaydını ve kartın numarasını AYRI döndürüyor;
numara belgeye yazılmıyor, yalnızca önizleme tazelemesi için kullanılıyor.

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
  görünmez).
- **Şube silinince kapsam AÇILMAZ.** Silinen kimlik karttan çıkarılır; ama liste
  **boşalacaksa kimlik BIRAKILIR**. `sadeceSubeler: []` "marka geneli" demek olduğu için
  boşaltmak, "yalnızca Lara için hazırlanmış içeriği" bütün şubelere açıyordu — ölçüldü.
  Kart artık hiçbir şubede kullanılamaz kalır; bu **kasıtlı** ve `kapsamiKayipMi` ile adı
  olan bir haldir, Operasyon kartında uyarı olarak görünür. Kullanıcı kapsamı yeniden
  seçince ölü kimlik temizlenir ve kart normale döner. Silme öncesi kaç kartın
  etkileneceği 409'da yazar.
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
- **Plan silmek TAM GERİ ALMADIR**: paylaşıldı işaretli bir plan silinince kart
  aşaması geri alınır, stok geri gelir ve Drive dosyası ONAYLANANLAR'a döner.
  Eskiden karta hiç dokunulmuyordu; kart "Teslim Edildi"de kaldığı için seçicide de
  çıkmıyor, aynı içerik bir daha planlanamıyordu. Kart seçicide **"Daha önce
  paylaşılmış"** ayrı bölümü var — aynı içerik başka güne/şubeye tekrar planlanabilir.
- **Seçici TÜRE göre ayırır — `lib/kart-secici.js`.** Plan hücresinde önce tür seçiliyor
  (Reels · Post · Carousel) ama seçici bir süre türü hiç okumuyordu: "Post" seçilince
  Reels kartları da listeleniyordu. Tür `paylasimTuru` ile çözülür. **Tür tutmayan kart
  GİZLENMEZ, "BAŞKA TÜR" başlığı altında ayrılır** — tür çoğu kartta ADDAN tahmin
  ediliyor, yanlış tahmin edilen kart gizlenseydi hiçbir plana bağlanamazdı. Sunucu
  uyumsuzluğa zaten dayanıklı (kart bağlıysa stok KARTIN türünden düşer), yani bu bir
  arayüz ayrımı.
- **Türün TEK sahibi `lib/stok.js` → `paylasimTuru`.** `src/App.jsx` içinde `kartTuru`
  diye ikinci bir kopya duruyordu ve "stok tarafıyla aynı kural" diye yazıyordu; değildi:
  türler üçe indikten sonra da "Görsel"/"Video"/"Story" döndürüyor, kartta AÇIKÇA
  seçilmiş türü (`paylasimTuru` alanı) hiç okumuyordu. Silindi.
- Planı ya da kilitli kartı olan şube **sessizce silinmez** (409 + `onayGerekli`); istemci
  onay alıp `onayliSil` ile tekrar gönderir. Şube adı kayıtta kopyalı olduğu için geçmiş
  okunabilir kalır.

**Alt yazı ekranı `onAltMetin`'i PROP OLARAK ALMAK ZORUNDA** (`HaftalikPaylasimPlani`).
Bileşen onu çağırıyordu ama parametre listesinde yoktu ve `Paylasimlar` da geçirmiyordu —
tanımsız bir isme çağrı. İki belirti üretti: "Paylaşıldı olarak işaretle" yolundaki
`typeof onAltMetin === "function"` koruması kaydetmeyi SESSİZCE atlıyor (yazılan metin
kayboluyor, işaretleme yine oluyor), "Alt yazıyı kaydet" yolu ise ReferenceError fırlatıp
`.finally`'ye hiç ulaşmıyor — düğme "Kaydediliyor…"de kilitleniyordu. İlk günden beri
böyleydi. **O `typeof` koruması kaldırıldı**: işlevi eksik prop'u yutmaktı, sonucu hatayı
aylarca gizlemekti. Artık metin kaydedilemezse İŞARETLEME DE yapılmıyor ve sebep
söyleniyor. Kaydetme çağrısı `Promise.resolve().then(...)` içinde: senkron bir hata da
reddetmeye dönüşsün ve `.finally` her hâlükârda çalışsın, düğme kilitlenmesin.
**Bu hatayı hiçbir test katmanı göremiyor** — ölçüldü: prop'u tekrar kaldırınca 0 kontrol
düştü. Prop bağlantısı Node'dan çağrılamıyor.

**Alt yazı KART EKRANINDA da görünür** (`src/CekimEditTakibi.jsx`, okuma modu). Alan
yalnızca "Düzenle" modunun içindeydi: kartı açan metnin var olup olmadığını göremiyor,
olduğunu bilmeyen yazmıyordu. Alan vardı, GÖRÜNMÜYORDU.

**Alt yazı KARTIN özelliği, plan devralır** (`lib/alt-yazi.js`). Metin Operasyon kartında
yazılıyor (onaydan önce de); plan kendi metnini yazmamışsa kartınki geçerli. Aynı kart
dört şubede paylaşılabildiği için plan üzerinde değiştirilebiliyor ve o değişiklik
yalnızca o planı etkiliyor. **Kartla AYNI metin plana yazılmaz** — yazılsaydı kart metni
güncellendiğinde o plan eski metinde takılı kalırdı. Devralma **müşteri yükünde de
çözülür** (`lib/musteri-gorunumu.js`); çözülmezse kartta yazılan metin müşteriye hiç
ulaşmaz.

### 7. Şube bazlı ücret — `lib/marka-ucreti.js`

Şubelerine ayrı ücret kesilen markada **toplam = `client.temelUcret` + o markanın
`subeler[].aylikUcret` toplamı**. Toplam yine `client.aylikUcret`'te duruyor (ciro, kâr
marjı, ödeme takvimi, tebligat dahil 19 yerde okunuyor) ama artık elle değil sunucu
tarafından yazılıyor — şube ayrılınca toplam kendiliğinden düşsün diye. **İkisi de
girilmemiş markada bu mekanizma HİÇ çalışmaz**; `ucretleriTazele` `null` döner ve
`clients` alanına dokunulmaz (dokunsaydı sayaç boşuna artar, aynı anda çalışan 409 alırdı).

**Geçmiş ayın tutarı DONDURULUR — bu modülün asıl sebebi.** Ödeme durumu geçmiş ayları
saklamıyor, her ay için BUGÜNKÜ ücretten hesaplıyordu. Ücret 60.000'den 45.000'e düşünce
Temmuz da 45.000 oluyor: tahsil edilmiş 60.000 "fazla ödeme", kısmi ödenmiş bir ay ise
"kapanmış" görünüyordu. Artık ücret her değiştiğinde `client.ucretGecmisi`'ne bir DÖNEM
düşülüyor (`{ baslangicAy, tutar, dagilim }`) ve `ayinUcreti(client, ay)` o ayı kapsayan
dönemi buluyor. Ay ay değil dönem kaydı: liste yalnızca ücret değiştikçe uzar. `0000-00`
"geçmişin tamamı" demek. **Ödeme hesabı `lib/odeme-hesabi.js`'te** — `src/tema.jsx`'ten
oraya taşındı, çünkü `.jsx` Node'da çalışmadığı için para hesabı hiçbir testte
ÇAĞRILAMIYORDU, yalnızca kaynak metnine bakılabiliyordu.

**Tutar aynıyken dağılım değişirse yeni dönem AÇILMAZ**, yürürlükteki döneme yazılır.
60.000'i ilk kez "15.000 temel + 3×15.000" diye tanımlamak tam olarak budur: tutar
korunur, geçmiş aylar aynı rakamla ama artık şube şube okunabilir olur.

Ücret kurulumu **tek blokta**: müşteri kartındaki ŞUBELER bölümünde temel ücret, şube
ücretleri ve toplamın dökümü yan yana. `temelUcret` bilerek `CLIENT_FIELDS`'e KONMADI —
o liste iki sütunlu ızgaraya sırayla diziliyor, araya tek alan eklemek altındaki bütün
alanların eşleşmesini kaydırıyor. Bu yüzden temel ücretin kendi ucu var (`markaTemelUcret`).

Şube ücretini **yalnızca yönetici** değiştirebilir (`subeUcret`, `markaTemelUcret` → 403). Bu uca `paylasimlar`
izni olan herkes girebiliyor; stok işaretlemeye yeten izin fiyat belirlemeye yetmez.
Aynı sebeple yanıtta `clients` yalnızca yöneticiye gönderilir — içinde `aylikUcret`,
`maliyetler`, `odemeKayitlari` var.

Gecikmiş borç toplamı **`clientOverdueBalance`** ile hesaplanır, `aylikUcret × ay sayısı`
ile DEĞİL: çarpım bütün geçmişi bugünkü ücretle sayar ve ücret değişmiş markada tebligata
yanlış tutar yazar.

**Müşteri hesap özeti (ekstre) — `lib/ekstre.js`.** Müşteriye verilen dökümde üç kavram
karışmamalı: **tahakkuk** o ayın hizmet bedeli (`ayinUcreti`, bugünkü ücret DEĞİL),
**fatura** o bedelin BELGELENEN kısmı, **tahsilat** ödemeler. `bakiye = tahakkuk −
tahsilat`; **fatura bakiyeye EKLENMEZ** — eklenirse faturalı ay müşteriye iki kez
borçlandırılır. Ücret dönemlerinin ilki `0000-00` olduğu için geriye doğru sorulan ekstre
markanın **hiç çalışmadığı aylara da bedel yazıyordu** (ölçüldü); `client.baslangic`
öncesi aylarda tahakkuk sıfırdır ama o aylardaki ödeme/fatura kayıtları yine gösterilir.
Belge müşteriye gittiği için `lib/ekstre-belgesi.js` **iç bilgi taşımaz** (maliyet, kâr
marjı, diğer markalar) ve marka adı HTML'e kaçırılarak girer.

### 8. Stok kuralları — `lib/stok.js`

Türler: **Reels · Post · Carousel** — kategorilerle aynı liste (`lib/kategori.js`).

**Tür kartta SEÇİLİR, seçilmemişse tahmin edilir** (`paylasimTuru`). Sıra: kartın
`paylasimTuru` alanı → içerik adında geçen tür adı → kategori. Ad hiçbir şey
söylemiyorsa kategoriye düşülür ve kategori zaten üç türden biridir. Eskiden ad tahmini
tek yoldu: aynı işteki iki karttan adında "Reels" geçen Reels'e, geçmeyen Video'ya
yazılıyordu — aradaki tek fark o kelimeydi, sahada görüldü.

**Stokta son söz DRIVE'INDIR** (`lib/drive-eslestirme.js` → `driveyeGoreStok`,
`lib/drive-denetimi.js`). Kural: *stok = ONAYLANANLAR klasöründe dosyası FİİLEN duran
kartlar.* Kartın aşamasının `Onaylandı` olması YETMEZ — dosya gerçekten orada olacak.
Sapmanın kaynağı buydu: taşıma sessizce başarısız olduğunda stok, arkasında içerik
olmayan bir sayı gösteriyordu. **Tür yine karttan gelir** (Drive bir dosyanın Reels mi
Görsel mi olduğunu bilmez); **kartsız dosya stoğa sayılmaz** — türü uydurulamaz, yolu
kart açmaktır (`kartsizdanKartAc`).

**Drive otoritesinin ÜÇ FRENİ var, üçü de veri kaybına karşı** — biri kalkarsa bir
Google kesintisi bütün stoğu sıfırlar:
- Tarama **tamamlanmadıysa** yazılmaz (bütçe doldu → liste eksik → "içerik azalmış" sanılır).
- **Ay klasörü hiç bulunamadıysa** yazılmaz. "Hiç dosya görmedim" ile "hiç klasör
  bulamadım" aynı şey değil; ikincisi yapı sorunudur. Bu ayrım olmadan tarama
  "0 dosya, tamamlandı" deyip bütün sayıları sıfırlıyordu — ölçüldü.
- **Toplu kayıp freni** (20+ düşüş) — o marka atlanır ve rapora yazılır.

**Yalnızca GENEL stok Drive'dan türer.** Şube satırları (`clientId_subeId_tur`)
türetilemez: bir dosyanın hangi şubede paylaşıldığı Drive'da yazmaz, o plan verisidir.

**Onay kilidi — dosya doğru klasöre geçmeden onay ayakta kalmaz** (`api/data.js`
→ `tasimalariIsleVeNotDus`). Yeni onaylanmış kartın dosyası taşınamadıysa **onay geri
alınır**: aşama eski hâline döner, stok düşer, sebep kartın geçmişine yazılır ve istek
409 ile reddedilir. Drive'ı kurulu OLMAYAN marka bu kilidin dışında — o kartlar için
taşıma sonucu hiç üretilmez, yoksa Drive kullanmayan markanın işi dururdu.

**Gece denetimi** (`api/daily-reminders.js`) her aktif markayı tarar, genel stoğu Drive'a
eşitler ve raporu `driveDenetimi` alanına yazar. Yeni fonksiyon açılmadı; mevcut cron
ucuna eklendi.

**Stok kartların yansımasıdır — elle +/− YOKTUR.** Sayıyı elle oynatmak stoğun
kartlarla bağını koparıyordu: içerik onaylanmadan stok artıyor, paylaşılmadan düşüyor
ve "bu sayı neden böyle" sorusu cevapsız kalıyordu. Tek düzeltme yolu **mutabakat**
(`lib/stok-mutabakat.js`): kartlardan olması gereken hesaplanır, farklı olan satırlar
Paylaşımlar'da gösterilir, düzeltmede hedef sayıyı **sunucu** hesaplar — tarayıcıdan
gelen sayıya güvenilmez. Düzeltme `paylasimGecmisi`'ne eski/yeni değerle yazılır.

Türetme kuralları motorun davranışından çıkarıldı: **genel stok** = o türden
`Onaylandı` aşamasındaki kart sayısı; **şube stoğu** = o şubenin kullanabildiği,
`Onaylandı` ya da `Şubelerde Paylaşılıyor` kartlar eksi o şubenin zaten paylaştıkları.
t83 bu türetmenin motorla birebir aynı sonucu verdiğini ölçüyor — ayrışırsa mutabakat
olmayan sapmaları "düzeltmeye" başlar ve doğru sayıları bozar.

Stok, kartın **`Onaylandı` aşamasına girmesiyle artar ve oradan ÇIKMASIYLA düşer** —
nereye gittiğinin önemi yok (`Şubelerde Paylaşılıyor`, `Teslim Edildi`, geri `Revize
İstendi`, hepsi aynı). Kart silinince de düşer. Kartta `stokSayildi` işareti sayımın
iki kez yapılmasını engeller. Toplu kayıp freni var (`TOPTAN_KAYIP_SINIRI = 20`).

> `"Tamamlandı"` diye bir aşama YOKTUR. Bu satır bir süre öyle yazıyordu; aşama
> listelerinin hiçbirinde böyle bir ad geçmiyor.

---

## Çalıştırma ve doğrulama

```bash
bash testler/hepsinidenetle.sh     # 24 statik denetim (sözdizimi, JSX, hook, kapsam…)
./testler/sunucutestleri.sh        # t1…t102, ~2297 kontrol — SAHTE veritabanı kullanır
npm run build                      # üretim derlemesi
ls api/*.js | wc -l                # 12'yi GEÇMEMELİ
```

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

En büyük dosyalar: `src/App.jsx` (11.070), `src/CekimEditTakibi.jsx` (3.376),
`api/data.js` (2.360), `src/musteriPaneli.jsx` (1.384). Bu sayılar Eylül 2026'da ölçüldü;
kaynak büyüdükçe bayatlar, güncellerken `wc -l` ile doğrula.
