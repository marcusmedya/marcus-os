---
name: marcus-yetki
description: Marcus OS'ta roller, izinler, marka kilidi ve panel senkronu. owner/staff/çözüm ortağı/müşteri ayrımı, fail-close marka çözümü, operasyon alt yetkileri, izin kutucuklarının üç ayrı listesi, giriş ve silme güvenlik defterleri, panel davranışları. Yetki, izin, rol, marka kilidi, müşteri paneli, çözüm ortağı ya da giriş işine dokunulduğunda yüklenir.
---

# Marcus Yetki — roller, izinler ve paneller

## Hangi rol HANGİ ALANLARI görüyor — `PERMISSION_DATA_FIELDS`

"Bu ekranı kim, hangi verisiyle görüyor" sorusunun tek gerçek cevabı `api/data.js`
içindeki **`PERMISSION_DATA_FIELDS`** (ve yazma tarafı için `PERMISSION_WRITE_FIELDS`).
İzin adı → o iznin açtığı belge alanları eşlemesi orada duruyor.

Bir ekran tasarlarken ya da bir alanı yeni bir yüzeye taşırken **önce oraya bak**: listede
olmayan bir alan o role hiç gitmiyor demektir, yani var olmayan bir veriyi tasarlamış
olursun. Tersi daha tehlikeli: alanı listeye eklemek o rolün göreceği veriyi genişletir.

## Bu skill neyi KAPSAMAZ

İki kural bilerek `CLAUDE.md`'de bırakıldı, çünkü **her arayüz işinde** geçerliler ve bu skill
yalnızca yetki işinde yüklenir:

- **Bileşen gövdesindeki her satır ilk render'da da çalışır (`data` o an `null`)** — siyah ekran
- **Operasyon paneli iki yerde çiziliyor, ortak prop'lar `operasyonOrtakProps`'ta**

Arayüze dokunuyorsan o ikisini `CLAUDE.md` §4'ten oku. Burada tekrarlanmıyorlar.

---

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
Aynı kuralı iki yere yazmak bu projede zaten bir kez panel senkron hatasına yol açtı.

> "Bir davranış değiştiğinde personel ve çözüm ortağı panellerini de kontrol et"
> talimatı HER davranış değişikliğini ilgilendirdiği için `CLAUDE.md` §3'te duruyor —
> burada tekrarlanmıyor. Bu skill yalnızca yetki işinde yükleniyor; stok ya da aşama
> işi yapan bir oturum onu burada görmezdi.

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

**Günlük iş takibi — `lib/is-takibi.js`** (Operasyon → İş Takibi, yalnızca yönetici).
"Kim ne yaptı, kimin elinde kaç iş var" sorusunun cevabı ilk günden beri KAYDEDİLİYORDU
(her kartın `gecmis` dizisi yazanıyla birlikte); eksik olan onu toplayan katmandı. Yeni veri
üretilmiyor. Üç kural:
- **"İş kimin elinde" = kartı EN SON İLERLETEN KİŞİ**, atama DEĞİL. Sebebi sistemin kendi
  kuralı: yetkisi olan personel gördüğü her kartı işliyor, `kameraman`/`editor` alanları
  zorunlu değil. Eski `YoneticiIstatistik` ekranı atamaya bakıyordu ve o alanlar boşken
  sessizce BOŞ liste üretiyordu. **Sahipsiz kart gizlenmez** — ayrı sayılır.
- **Zaman: eski kayıtlar bir EKRAN METNİ taşıyor** (`toLocaleString("tr-TR")` →
  "16.09.2026 14:32:05"): sıralanamaz, saat dilimi yok. Yeni kayıtlara **`zaman` (ISO)**
  eklendi, eskilere DOKUNULMADI (tek belgeyi baştan yazmak gerekirdi) — `kayitAni` ikisini
  de okur. Çözülemeyen zaman UYDURULMAZ, o olay gün listelerine ve rapora hiç girmez.
- **Dosyayı kim yükledi: `medya[].yukleyen`.** Kart geçmişine yazılmıyor, kaydın kendisinde
  duruyor. Arayüz bu alanı ZATEN gösteriyordu (sürüm geçmişinde) ama hiç kimse yazmıyordu —
  alan vardı, değer yoktu. Eski yüklemelerde boş kalır; geçmişe ad uydurulmaz.

**Operasyon kartını kim işleyebilir: `lib/is-yetkisi.js`.** Kural yetkiye bakar,
ATAMAYA DEĞİL — Operasyon (`cekimEdit`) izni olan personel gördüğü her kartı işler.
Eskiden kartın "Sorumlu Kameraman/Editör" alanında adı yazması gerekiyordu; yetkisi
açık olan personel hiçbir kartı ilerletemiyor, kendi oluşturduğu kartta bile kilitli
kalıyordu. Marka kilidi bağımsız çalışır (kilitli hesap zaten yalnızca kendi
markalarını görür). Kart **silme** bu kuralın dışında — yalnızca yönetici siler.

