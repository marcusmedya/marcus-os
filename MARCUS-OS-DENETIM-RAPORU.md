# Marcus OS — Güvenilirlik Denetimi Raporu

**Tarih:** 22 Ağustos 2026 · **Kapsam:** güvenilirlik, veri bütünlüğü, yetkilendirme
**Sonuç commit'i:** `7364ddb` (PR #69) · **Önceki durum:** `2646e94`

Bu tur **yeni özellik eklemek için değil**, mevcut Marcus OS'u daha güvenilir ve hataya
dayanıklı hale getirmek için yapıldı. Çalışan iş akışları, tasarım ve kullanıcı
alışkanlıkları değiştirilmedi.

**Yöntem — her bulguda aynı sıra:**

1. Mevcut davranışı **kanıtlayan** test yaz (test önce DÜŞER)
2. Kusuru düzelt
3. Testi çalıştır
4. Korumayı geçici olarak **geri boz** ve testin gerçekten düştüğünü ölç
5. Doğru kodu geri koy

Adım 4 olmadan "test geçti" hiçbir şey söylemiyor. Bu projede daha önce, iddia ettiği
şeyi hiç sınamayan testler yazıldı ve geçtiler.

---

## 1. Özet

| | Önce | Sonra |
|---|---|---|
| Sunucu testleri | 1569 kontrol | **1678 kontrol** |
| Test dosyası | 75 | **80** |
| Statik denetim | 17 | **19** |
| API fonksiyonu | 11/12 | **11/12** |
| Bilinen veri bozma yolu | 4 | **0** |

**Bulunan kusur:** 1 yüksek, 3 orta, 2 düşük — hepsi düzeltildi.
**Veri modeli değişmedi:** tek JSON belgesi, migration yok, Redis anahtar yapısı aynı.

---

## 2. Bulunan ve düzeltilen kusurlar

### 2.1 🔴 YÜKSEK — Şube silinince içerik kapsamı açılıyordu

**Nasıl bulundu.** Şube silme yolunun kod okumasında `sadeceSubeler` listesinin
boşaltıldığı görüldü. Boş listenin anlamı bu sistemde "marka geneli" olduğu için
davranış ölçüldü.

**Kanıtlanan davranış.** İki şubeli bir markada (Lara, Merkez) kart yalnızca Lara için
hazırlanmışken (`sadeceSubeler: ["lara"]`) Lara silindiğinde:

```
kartın sadeceSubeler'i : []
kartı kullanabilen şube: ["Smell Merkez"]
```

"Yalnızca Lara için hazırlanmış içerik" bir anda Merkez'de kullanılabilir hale
geliyordu. Dört şubeli bir markada kalan üç şubenin hepsine açılırdı.

**Neden tehlikeli.** İçerik yanlış şubede paylaşılabilir. Kampanya, fiyat ya da
konuma özel bir gönderi başka şubenin akışına düşer.

**Düzeltme.** Silinen kimlik yine çıkarılıyor — **ama liste boşalacaksa bırakılıyor.**

```
kartın sadeceSubeler'i : ["lara"]
kartı kullanabilen şube: []
```

Kart hiçbir şubede kullanılamaz kalıyor: kasıtlı ve güvenli durum. **Yeni bir veri
alanı eklenmedi**; `sadeceSubeler`'in anlamı değişmedi.

**Sessiz kalmıyor.** `kapsamiKayipMi` türetilmiş bir bayrak — "kapsam dolu ama
karşılığı olan hiç şube kalmamış" demek. Operasyon kartında **ŞUBE KAPSAMI KAYIP**
uyarısı olarak görünüyor. Düzenlemede şube seçilince ölü kimlik temizleniyor;
temizlenmeseydi kullanıcı şube seçse bile kart kullanılamaz kalırdı.

**Bozulmayan davranış.** Kart birden çok şubeye kilitliyse silinen kimlik çıkarılıyor
ve kart kalan şubelerde çalışmaya devam ediyor. Yeni kural yalnızca liste boşalacaksa
devreye giriyor.

**Uyarı metni de yanlıştı:** silme onayı "kartlar marka geneline döner" diyordu, yani
tam tersini. Artık "MARKA GENELİNE DÖNMEZ — kapsamları kayıp sayılır" diyor.

**Test:** `t76` — 20 kontrol. Kırma ölçümü: eski davranış geri konunca **4**,
kapsam-kayıp bayrağı **1**, arayüz uyarısı **1**, ölü kimlik temizliği **1**.

---

### 2.2 🟠 ORTA — Şube stoğunda marka kilidi kısmen aşılabiliyordu

**Kanıtlanan davranış.** Marka kilitli bir çözüm ortağı, kendi `clientId`'sini ve
**başka markanın** `subeId`'sini gönderdiğinde istek kabul ediliyordu:

```
istek : { clientId: 1 (kendi), subeId: "onun" (başka marka) }  → 200
sonuç : stok anahtarı "1_onun_Video" oluştu
        geçmişe yazıldı: "Kendi Marka (Onun Şubesi)"
```

**İki sonucu vardı.** Hiçbir şubeye karşılık gelmeyen çöp bir stok anahtarı oluşuyor
(stok sayılarını bozar), ve **başka markanın şube adı** geçmişe yazılıyor — kilitli
hesap görmemesi gereken bir bilgiyi öğreniyor.

**Kök sebep.** Marka kilidi `clientId`'yi ilk sırada çözüyor ve doğru davranıyor; ama
`subeStokDegistir` şubeyi **tüm şubeler** arasında arıyordu, markaya bağlı değil.
`haftalikEkle` bu doğrulamayı zaten yapıyordu — burada eksikti.

**Düzeltme.** Şube `markaninSubeleri(data.subeler, clientId)` içinde aranıyor;
tutarsız eşleşme 400 ile reddediliyor. Kural **yöneticide de geçerli**, çünkü bu bir
yetki değil **veri bütünlüğü** meselesi: çöp anahtar stok sayılarını bozar.

**Test:** `t79` — kırma ölçümü **4** kontrol.

---

### 2.3 🟠 ORTA — Bozuk veri sessizce boş uygulama olarak açılıyordu

**Kanıtlanan davranış.** `kv.get` metin, dizi ya da sayı döndürdüğünde
(`bozulmuş anahtar`, elle yazılmış değer, yarım kalmış yazma):

```
Redis'te: "bu bir belge değil"
GET      : 200 — uygulama BOMBOŞ açılıyor, hiçbir uyarı yok
```

**Neden tehlikeli.** Kullanıcı "her şey silinmiş" sanıyor, yeni kayıt giriyor, ve o
kayıt bozuk verinin **üstüne** yazılıyor. Bozuk veri hâlâ kurtarılabilir olabilirdi;
üstüne yazmak onu kalıcı olarak yok eder.

**Düzeltme.** `belgeOkunabilirMi` — hem okuma hem yazma `409` ile reddediliyor ve
sebebi söylüyor (yedekten dönme yönlendirmesiyle). Yazma kontrolü **kilidin içinde**:
dışarıda olsaydı arada başka bir yazma belgeyi düzeltmiş ya da bozmuş olabilirdi.

**`null` bozuk sayılmıyor** — ilk kurulumda belge henüz yoktur. Bu ayrım olmasaydı
sistem hiç kurulamazdı.

**Kabul edilen sonuç.** Belge okunamaz hale gelirse sistem **kendini kilitler**. Bu
bilerek: veri kaybetmektense işlemi reddetmek. Çözüm Ayarlar → Yedekler'den son
sağlam yedeğe dönmek.

**Test:** `t80` — 17 kontrol. Kırma ölçümü: okuma koruması **6**, yazma koruması
**3**, ilk-kurulum ayrımı **1**.

---

### 2.4 🟠 ORTA — Yedek geri yüklerken içerik hiç doğrulanmıyordu

**Mevcut akış iki şeyi zaten doğru yapıyordu:** kilit alıyor (alınamazsa geri yükleme
yapılmıyor) ve geri yüklemeden önce mevcut verinin 30 günlük kopyasını ayrı bir
anahtara yazıyor. Kilit içinde `guvenliYaz` çağrılıyor ama o kendi kilidini almıyor —
kilit-içinde-kilit kilitlenmesi **yok**, kontrol edildi.

**Eksik olan.** Yedeğin **içeriği** hiç kontrol edilmiyordu. `kv.get` bir nesne
döndürdüyse doğrudan üretime yazılıyordu. Yapısı bozuk bir yedek — `clients` metin
olmuş, yanlış anahtardan gelmiş bambaşka bir belge — uygulamayı bozardı.

Kilit ve kopya bu durumda işe yaramıyor: kopya da alınıyor, kilit de düzgün
bırakılıyor — **ama veri bozuluyor.**

**Düzeltme.** `yedekDogrula` — yapı doğrulaması **kilitten önce** çalışıyor
(reddedilecek bir istek için kilidi tutmak diğer herkesi boşuna bekletirdi). Bozuk
yedek 400 ile reddediliyor. Test, canlı verinin gerçekten hiç değişmediğini ölçüyor —
reddetmek yetmez, **yazmamış olmak** gerekir.

**Alanın yokluğu hata sayılmıyor:** eski bir belgede `subeler` hiç bulunmayabilir.
Hata, alanın **var olup yanlış türde** olmasıdır. Gerçekten boş bir sisteme dönmek de
meşru bir istek — engellenmiyor.

**Ek kazanç — karardan önce uyarı.** `?ozet=1` artık "bu yedekte kaç müşteri var"
demekle kalmıyor, **"bu yedeğe dönersem ne kaybederim"** sorusunu alan alan
cevaplıyor; en çok kaybettiren başta, ve yedekte hiç olmayan alanlar ayrıca. Uyarı
eşiği %25 (dahil) — her farkta uyarmak uyarıyı değersizleştirirdi. Kayıp sayısı
güvenlik defterine de yazılıyor.

**Canlı geri yükleme yeni eklenmedi** — zaten vardı ve çalışıyordu. Yeni buton
yapılmadı, mevcut özellik kaldırılmadı; yalnızca güvenliği artırıldı.

**Test:** `t78` — 26 kontrol. Kırma ölçümü: yapı doğrulaması **5**, karar öncesi
uyarı **3**, yabancı belge tespiti **2**, uyarı eşiği **1**.

---

### 2.5 🟡 DÜŞÜK — Çözüm ortağı kendi markasına üyelik ekleyemiyordu

`uyelikEkle` markayı `body.uyelik.clientId` **iç nesnesinde** taşıyor, üst düzeyde
değil. Marka kilidi çözümleyicisi onu göremediği için hedef "belirsiz" kalıyor ve
fail-close devreye giriyordu.

**Güvenlik tarafı doğruydu** — sızıntı yoktu, reddetmek güvenli taraf. Ama sonuç:
çözüm ortağı **kendi markasına bile** üyelik ekleyemiyordu; `uyelikler` izni onun için
tamamen işlevsizdi.

**Düzeltme.** Çözümleyici iç nesnedeki kimliği de görüyor. Başka markaya ekleme yine
403.

**Test:** `t79` — kırma ölçümü **2** kontrol.

---

### 2.6 🟡 DÜŞÜK — Belge hataları

Koddan doğrulanarak düzeltildi:

| Hata | Gerçek |
|---|---|
| CLAUDE.md: "kart *Tamamlandı*'ya geçince stok düşer" | **Böyle bir aşama yok.** Stok `Onaylandı`ya girince artar, oradan **çıkınca** düşer |
| Ortam değişkeni tablosunda 6 değişken hiç yazmıyordu | `RESEND_FROM` + 5 Google/Drive değişkeni eklendi |
| Dosya satır sayıları bayattı | App.jsx 9243→9653, data.js 1882→2008 vb. |
| MARCUS-OS-SISTEM.md'de `ortakAction` ucu eksikti | Eklendi |

---

## 3. Yeni: Ayarlar → Sistem Sağlığı

**Vercel fonksiyon sınırı korundu.** Yeni API dosyası açılmadı (11/12) — mevcut uca
`sistemAction: "saglik"` olarak eklendi. Yalnızca yönetici erişebiliyor.

**Hiçbir şey yazmıyor.** Test, belgenin ölçüm öncesi ve sonrası **birebir aynı**
olduğunu doğruluyor: ölçüm yazma yapsaydı her bakış veriyi kirletirdi.

### Gösterdikleri

- JSON belge boyutu ve eşik durumu (normal / dikkat / yüksek)
- **En çok yer kaplayan on alan** — kayıt sayısı + yaklaşık bayt, sürekli büyüyenler
  işaretli (`cekimIsleri`, `haftalikPaylasimlar`, `paylasimGecmisi`, `islemGecmisi`,
  `silinenler`, `gunlukKontrol`)
- Operasyon kartı / müşteri / şube / paylaşım planı / işlem geçmişi / silinen sayıları
- Son yedek tarihi
- Kullanılan serverless fonksiyon sayısı
- Kritik ortam değişkenlerinin **var/yok** durumu

**Sır değeri asla gitmiyor.** Yalnızca boolean. Test, Google özel anahtarı ve Resend
anahtarının yanıt gövdesinde geçmediğini ölçüyor. Boş metinli değişken "tanımlı"
sayılmıyor — `SITE_PASSWORD=""` tanımsızla aynı sonucu verir ama ekranda yeşil
görünürdü.

### Drive sağlık kontrolü — salt okunur

**Üretim Drive'ında hiçbir şey oluşturulmuyor.** Ne deneme klasörü, ne deneme dosyası,
ne silme. Test bunu, **GET olmayan tek bir istek bile gitmediğini** ölçerek doğruluyor.

Yazma yeteneği **denenmeden** raporlanıyor: Google'ın `capabilities` alanı okunuyor —
klasöre çocuk ekleyip ekleyemeyeceğimizi kendisi söylüyor. Okunamayan yetenek
**"doğrulanamadı"** olarak gösteriliyor; üretim Drive'ında deneme yapılmıyor.

**Yakaladığı sessiz bozulmalar:**

| Durum | Eskiden |
|---|---|
| Ana klasör elle **çöpe atılmış** | Hiçbir yerde görünmüyordu |
| Servis hesabının klasörde yazma yetkisi kaldırılmış | Dosya "taşınmadı" notu, sebebi yok |
| OAuth jetonu geçersiz | Yükleme sessizce başarısız |
| Drive alanı dolmuş | Aynı |

Her adım bağımsız — biri hata verse de rapor eksik kalmıyor.

**Test:** `t77` — 30 kontrol. Kırma ölçümü: sır koruması **4**, çöp klasör tespiti
**3**, yetki kontrolü **1**, boş-değer kuralı **1**.

---

## 4. Veri büyümesi — yalnızca ölçüm

`marcus-os-data` tek JSON belgesi olarak **kaldı**. Parçalanmadı, migration
yapılmadı, Redis anahtar yapısı değişmedi.

Ama ölçülebilir hale geldi: her yazma belgenin **tamamını** okuyup **tamamını** geri
yazıyor. Belge büyüdükçe her işlem yavaşlar ve kilit daha uzun tutulur — üç kişi aynı
anda çalışırken bu doğrudan hissedilir.

Sağlık paneli hangi alanın büyüdüğünü gösteriyor. Eşikler bir **öneri üretmiyor**;
karar kullanıcıya ait. Amaç sürprizi önlemek.

---

## 5. Eşzamanlılık denetimi — yeni kusur bulunmadı

Gözden geçirilen yollar: iki personelin aynı anda kart güncellemesi, kart
güncellenirken başka personelin paylaşım yapması, aynı isteğin iki kez gitmesi, 503
sonrası otomatik tekrar, ağ kopması sonrası tekrar, stok/şube stok/aşama değişimi,
kart silme, şube silme, müşteri onayı ve revize isteği, Drive yan etkisinin tekrar
çalışması.

**Sonuç:** fark bildiren tüm uçların `islemId` taşıdığı doğrulandı — `api/paylasim.js`
(12 action), `api/manage-staff.js`, `api/client-payment.js`, `api/data.js`
`musteriAction`. Blob kaydı bir **durum bildirimi** olduğu için zaten tekrara
dayanıklı; kimlik bilerek eklenmemiş.

Bu turda yeni bir eşzamanlılık kusuru bulunmadı.

---

## 6. Yeni statik denetimler

| # | Denetim | Neyi engelliyor |
|---|---|---|
| 18 | `sistemBelgesi.mjs` | Yeni uç/modül/değişken/cron belgeye yazılmazsa düşer. Envanterin bayatlaması onu **yanlış** yapar |
| 19 | `fonksiyonSayisi.mjs` | Sağlık ekranındaki fonksiyon sayısı sabiti gerçek dosya sayısıyla karşılaştırılır |

18. denetim bu çalışmada **işini yaptı**: yeni modül belgeye yazılmadığı için düştü ve
belge güncellendi.

---

## 7. Testlerin kendisinde bulunan kusurlar

Test disiplini gereği kırma ölçümü yapılınca üç testin hiçbir şey sınamadığı görüldü:

| Test | Kusur | Düzeltme |
|---|---|---|
| `t76` | "ölü kimlik temizleniyor" — fonksiyon **tanımına** bakıyordu, çağrısı kaldırılınca 0 düştü | Kullanıma bağlandı |
| `sistemBelgesi` | Ortam değişkeni kontrolü `includes` kullanıyordu; `KILIT_DENEME`, yanlış yazılmış `KILIT_DENEMESI`'nin içinde de bulunuyordu | Tam sözcük araması |
| `t80` | Bir kontrol **kodu suçluyordu** — belge yanıtta `data` altında dönüyormuş | Test düzeltildi |

`t78`'de iki kontrol yanlıştı ve **kod haklı çıktı**: kayıp sayımında `stoklar`
nesnesinin anahtarları da kayıt sayılıyor, ve %25 tam sınırda kod uyarıyor. İkisi de
koda göre düzeltildi.

`t71`'in iki kontrolü **eski kuralı** sabitliyordu (§2.1'de bilerek değiştirdik); yeni
kurala çevrildi ve kuralın **neden** değiştiği test başlığına yazıldı — gelecekte geri
"düzeltilmesin" diye.

---

## 8. Dokunulmayan riskler — kararı kullanıcının

**Canlı geri yükleme aktif.** `POST /api/backup` zaten çalışıyordu; yeni buton
yapılmadı ama mevcut olan da kaldırılmadı. Yapı doğrulaması eklendi. **Karar:** bu uç
ek bir onay adımı ya da kısıt istiyor mu?

**Tek JSON modeli.** Parçalanmadı. Sağlık paneli artık hangi alanın büyüdüğünü
gösteriyor — eşiğe yaklaşınca karar kullanıcının.

**Öksüz kayıtlar.** Silinmiş müşteriye bağlı şube, plan ve stok kayıtları sistemde
kalabiliyor; hata vermiyor, çökmüyor. Temizlemek **üretim verisini değiştirmek**
demek — dokunulmadı.

**Çekim listesi**, kapsamı kayıp kartı hâlâ "hazır içerik" sayıyor. Sapma eksik
yönde (çekim gerekmiyormuş gibi görünür). Kart yeniden kapsanınca düzeliyor.

**Rotasyon bekleyen anahtarlar** — Google servis hesabı ve Resend anahtarı. Kullanıcı
tarafında yapılacak işler.

---

## 9. Değişen dosyalar

| Dosya | Sebep |
|---|---|
| `api/paylasim.js` | Şube silme kapsam koruması · üyelik kimlik çözümü · şube–marka tutarlılığı |
| `api/data.js` | `sistemAction: "saglik"` ucu · bozuk belge okuma koruması |
| `api/backup.js` | Yedek yapı doğrulaması · karar öncesi kayıp özeti |
| `lib/kv-yaz.js` | `belgeOkunabilirMi` — bozuk belge üstüne yazma koruması |
| `lib/sube-kullanimi.js` | `kapsamiKayipMi` · `gecersizSubeKimlikleri` |
| `lib/drive-tasima.js` | `driveSagligi` — salt okunur Drive kontrolü |
| `lib/drive-yukleme.js` | OAuth jeton alıcı dışa açıldı (döngüsel import olmasın) |
| `lib/sistem-sagligi.js` | **yeni** — belge ölçümü, büyüyen alanlar, değişken var/yok |
| `lib/yedek-dogrula.js` | **yeni** — yedek yapı doğrulaması, kayıp özeti |
| `src/sistemSagligi.jsx` | **yeni** — sağlık paneli çizimi |
| `src/CekimEditTakibi.jsx` | Kapsam kayıp uyarısı · ölü kimlik temizliği |
| `src/App.jsx` | **yalnızca 5 satır** — panel bağlantısı |
| `testler/t76`…`t80` | **yeni** — 5 dosya, 109 kontrol |
| `testler/fonksiyonSayisi.mjs` | **yeni** — 19. denetim |
| `testler/t71.mjs` | Eski kuralı sabitleyen iki kontrol yeni kurala çevrildi |
| `CLAUDE.md` · `MARCUS-OS-SISTEM.md` · `README.md` | Düzeltmeler + Güncelleme 156 |

Toplam: **23 dosya, +1811 / −45 satır.**

---

## 10. Doğrulama

```bash
bash testler/hepsinidenetle.sh     # 19/19 temiz
./testler/sunucutestleri.sh        # 1678 kontrol geçti, hata yok
npm run build                      # temiz
ls api/*.js | wc -l                # 11
```

Yeni testlerin kontrol sayıları: `t76` 20 · `t77` 30 · `t78` 26 · `t79` 16 · `t80` 17.

---

## 11. Sonuç

**Sistem bu çalışma öncesine göre daha güvenli.**

Daha önce **sessizce veri bozabilecek dört yol** vardı:

1. Şube silince içeriğin yanlış şubede paylaşılabilir hale gelmesi
2. Bozuk belgenin üstüne yazılması
3. Bozuk yedeğin üretime yüklenmesi
4. Marka kilidinin şube kimliği üzerinden kısmen aşılması

**Dördü de kapalı.** Dördünün de kanıt testi ve kırma ölçümü var — yani bu hatalar bir
daha sessizce geri gelemez.

Ayrıca sistem artık kendi durumunu gösterebiliyor: Drive'ın sessizce bozulduğu dört
senaryo tek tıkla görünür hale geldi ve bunu üretim Drive'ında hiçbir şey oluşturmadan
yapıyor.

**Çalışan hiçbir iş akışı değişmedi.** Veri modeli, Redis yapısı, tasarım ve kullanıcı
alışkanlıkları aynı. `App.jsx`'e 5 satır dokunuldu, toplu refactor yapılmadı.

**Bir davranış değişikliği bilerek yapıldı:** belge okunamaz hale gelirse sistem
kendini kilitler (409) ve yedekten dönmeye yönlendirir. Veri kaybetmektense işlemi
reddetmek tercih edildi.
