---
name: marcus-veri
description: Marcus OS'ta dosya, medya ve Drive katmanı. Google Drive'ın iki kimliği, yükleme ve taşımanın neden ayrı olduğu, video akışının istek başına maliyeti, klasör yapısı ve silme yolları. Drive, video, görsel, dosya yükleme, önizleme, klasör ya da medya işine dokunulduğunda yüklenir.
---

# Marcus Veri — dosya ve medya katmanı

## Bu skill neyi KAPSAMAZ

**Belgenin kendisi burada değil.** Tek JSON belgesi, `guvenliGuncelle`, kilit kuralı, alan
bazlı sürüm sayaçları ve çakışma birleştirmesi `CLAUDE.md` §2'de duruyor ve **orada kalmalı**:
o kurallar yazma yapan HER işi ilgilendiriyor, bu skill ise yalnızca dosyaya dokunulduğunda
yükleniyor. Yazma disiplinini bu dosyadan öğrenme — `CLAUDE.md` §2'yi oku.

Burada yalnızca **dosyaların fiilen nerede durduğu ve nasıl taşındığı** var.

---

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

