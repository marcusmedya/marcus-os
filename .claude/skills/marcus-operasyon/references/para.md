# Şube bazlı ücret, ödeme ve şirket kârı

`marcus-operasyon` skill'inin para katmanı. Şube ücretleri içerik kullanımıyla aynı eksende
(`subeler[]`) durduğu için buraya bağlı, ama ayrı dosyada: stok işine bakan birinin ödeme
takvimini okumasına gerek yok.

---

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

**Şirket kârı freelancer ücretlerini DE düşer — `lib/is-ucreti.js` → `sirketAylikIsMaliyeti`,
`computeLive` (`src/tema.jsx`).** Bu satır bir süre yoktu: hesap yalnızca MARKA bazında
kullanılıyor, şirket toplamına hiç bağlanmıyordu. Sonucu, freelancer'a yapılan her ödemenin
kasadan düşüp (`hesapBakiyesi` → `odemeler`) kârdan düşmemesiydi — iki rakam arasındaki
uçurum her ay büyüyordu. **Marka marka toplamak YETMEZ**: markası girilmemiş iş hiçbir
markanın altına düşmez ve sessizce kaybolur; `sirketAylikIsMaliyeti` o ay teslim edilen HER
işi sayar. **Ücreti tanımsız kişi-iş SAYILIR ve ekranda söylenir** (`isUcretiEksik`) —
sessizce sıfır yazmak gideri düşük, kârı yüksek gösterir. Dönem = işin TESLİM EDİLDİĞİ ay.

**Gelir ve gider AYNI müşteri kümesinden hesaplanır** (`computeLive`). `clientCosts` bir
süre `clients` (HEPSİ) diyordu, gelir ise `activeClients`: markayı dondurunca geliri
düşüyor ama AYLIK MALİYETİ kârdan düşmeye devam ediyordu — bıraktığın müşteri her ay zarar
yazıyordu. Yeni bir toplam eklerken hangi kümeyi kullandığına bak (t107 ölçüyor).

**Ay ay gelir–gider — `lib/aylik-ozet.js`** (Finans → Ay Ay Karşılaştırma). Geçmiş,
"Ayı kapat" düğmesiyle yazılan `monthly` FOTOĞRAFINDAN değil KAYITLARIN kendisinden
türetiliyor; o düğmeye hiç basılmamış aylar da görünüyor. Üç kural:
- **Tahakkuk O AYIN ücretiyle** (`ayinUcreti`), bugünküyle değil — yoksa ücret düşünce
  geçmiş aylar da düşer ve tahsil edilmiş para "fazla ödeme" görünür.
- **Ayrılan/dondurulan markanın BİTİŞ AYI KAYITLI DEĞİL.** Geçmiş aylarda ancak KANIT
  varsa sayılır: o ay ödeme kaydı varsa evet, yoksa hayır. Ne zaman ayrıldığını bilmeden
  tahakkuk yazmak fatura uydurmaktır. **Tahsilat bu süzgeçten geçmez** — alınan para
  alınmıştır.
- **SABİT GİDERLERİN AY AY GEÇMİŞİ YOK** (ofis, maaş, üyelik, gider kalemleri): belgede
  yalnızca bugünkü değerleri var. Geçmiş aya bugünkü kirayı yazmak yalan üretir, bu yüzden
  hiç yazılmıyor ve ekran sebebini söylüyor. İstenirse yol, sabit giderleri TARİHLİ
  kaydetmektir — ayrı ve daha büyük bir iş.
Ay döngüsünde **sonsuz döngü üst sınırı** var (`lib/ekstre.js` gibi): ölçüldü, koruma
yokken bozuk bir ay aritmetiği testi sonsuza soktu — tarayıcıda bu kilitlenme demek.

**Para TEK EKRANDA: Finans.** "Ödeme Takvimi" ayrı bir menüydü ve `HesapBakiyeleri` İKİ
ekranda birden çiziliyordu. Ekran artık Finans'ın içinde bir sekme (`odemeTakvimiIcerigi`
prop'u); gömülü hâlde `hesaplariGizle` ile hesap tablosu TEKRARLANMIYOR.
**YETKİ KORUNDU — dikkat:** `odemeTakvimi` AYRI bir izin. Finans'ı görebilen herkes ödeme
kayıtlarını görmemeli, bu yüzden sekmenin içeriğini ÇAĞIRAN taraf veriyor: personel
görünümünde `izinler.odemeTakvimi` kapısından geçiyor. Ayrı menü maddesi yalnızca
"Ödeme Takvimi izni VAR, Finans izni YOK" personeli için duruyor — kaldırılsaydı o kişi
ekrana hiç ulaşamazdı.

**Ön muhasebe üç saf modülde**: `lib/para-hareketleri.js` (dönem dökümü),
`lib/sade-ozet.js` (düz Türkçe anlatım), `lib/muhasebe-belgesi.js` (yazdırılabilir rapor).
- **Kayıtların tarihi İKİ ALANDA**: eski kayıtlarda yalnızca `ay`, yenilerde `tarih`.
  İkisi de okunmalı; biri atlanırsa rapor sessizce eksik çıkar.
- **Tarihsiz kayıt GİZLENMEZ, SAYILIR** ve belgede "bu dökümde yok" diye yazılır. Eksik
  bir dökümü tam gibi göstermek, hiç göstermemekten kötüdür.
- **PDF için paket YOK**: belge yeni pencerede açılıp `print()` çağrılıyor — müşteri
  ekstresiyle aynı yol. Kullanıcı yazdırma kutusundan "PDF olarak kaydet" seçiyor.
- **Sade anlatımda muhasebe terimi KULLANILMAZ** ("tahakkuk" yok; *hak edilen*,
  *tahsil edilen*, *bekleyen*). Eksik veri varsa cümle bunu açıkça söyler.

**`src/tema.jsx` artık TESTTEN ÇAĞRILABİLİYOR** (t107). `.jsx` Node'dan import edilemediği
için şirket kâr hesabı bu projede hiç ölçülememişti. Test dosyayı **esbuild ile** (projede
zaten var, denetim 1b onu kullanıyor) çevirip geçici bir `.mjs` olarak `testler/` altına
yazıyor ve çağırıyor — yeni bağımlılık YOK. Geçici dosya `process.on("exit")` ile her
hâlükârda siliniyor. **Ölçüldü: freelancer gideri toplamdan çıkarılınca 3 kontrol düşüyor**,
yani bu sefer ARAYÜZ BAĞLANTISI da ölçülü. Aynı yöntem diğer `.jsx` hesapları için de
kullanılabilir.

**Müşteri hesap özeti (ekstre) — `lib/ekstre.js`.** Müşteriye verilen dökümde üç kavram
karışmamalı: **tahakkuk** o ayın hizmet bedeli (`ayinUcreti`, bugünkü ücret DEĞİL),
**fatura** o bedelin BELGELENEN kısmı, **tahsilat** ödemeler. `bakiye = tahakkuk −
tahsilat`; **fatura bakiyeye EKLENMEZ** — eklenirse faturalı ay müşteriye iki kez
borçlandırılır. Ücret dönemlerinin ilki `0000-00` olduğu için geriye doğru sorulan ekstre
markanın **hiç çalışmadığı aylara da bedel yazıyordu** (ölçüldü); `client.baslangic`
öncesi aylarda tahakkuk sıfırdır ama o aylardaki ödeme/fatura kayıtları yine gösterilir.
Belge müşteriye gittiği için `lib/ekstre-belgesi.js` **iç bilgi taşımaz** (maliyet, kâr
marjı, diğer markalar) ve marka adı HTML'e kaçırılarak girer.

