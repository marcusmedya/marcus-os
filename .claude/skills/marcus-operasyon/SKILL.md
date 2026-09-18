---
name: marcus-operasyon
description: Marcus OS'un iş alanı — kategoriler, aşamalar, medya yuvaları, şube bazlı içerik kullanımı ve stok kuralları. Üç kategori tek kaynak, dört yer kuralı, aşama onarımı, Drive'ın stok otoritesi ve üç freni, şube kapsamı, toplu kart açma ve taşıma. Kart, aşama, kategori, stok, şube, pano, plan ya da paylaşım işine dokunulduğunda yüklenir. Ücret tarafı için references/para.md okunur.
---

# Marcus Operasyon — içerik, aşama, stok, şube

Marcus OS'un kalbi burası: bir içerik kart olarak açılır, aşamalardan geçer, onaylanınca
**stok** olur, planlanıp paylaşılınca stoktan düşer. Aşağıdaki kuralların her biri sahada
yaşanmış bir kayıptan geliyor.

**Para tarafı ayrı dosyada:** şube bazlı ücret, ücret dönemleri, tahakkuk/tahsilat ve şirket
kârı `references/para.md`'de. Şubeye dokunuyorsan ikisi de gerekebilir.

**Kapsam dışı:** yazma/kilit disiplini `CLAUDE.md` §2'de, yetki `marcus-yetki` skill'inde.

---

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

