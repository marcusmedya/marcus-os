# Marcus bileşen standartları

`marcus-design` skill'inin bileşen katmanı. Jetonlar ve ilkeler `SKILL.md`'de; burada
**her bileşenin nasıl davrandığı** var. Ortak bileşenlerin tamamı `src/tema.jsx`'te.

> **Yeni bir varyant gerekiyorsa satır içi stil yazma — `src/tema.jsx`'e ekle.**
> Satır içi kopya, tema değişince güncellenmeyen bir ada dönüşüyor: `temaUygula()` yalnızca
> bilinen hazır stilleri tazeliyor, kaçırılan biri açık temada koyu kalıyor.

---

## Etkileşim durumları — hepsinde zorunlu

| Durum | Kural |
|---|---|
| **hover** | Bir ton yukarı (`surface` → `surfaceRaised`) ya da metin `textDim` → `text`. Renk değiştirme. |
| **focus** | **Görünür olmak ZORUNDA.** Satır içi stil `:focus` ifade edemez, bu yüzden görünürlüğü **global CSS** taşıyor: `button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid accent }` (`src/App.jsx`, iki kabukta birden). `inputStyle`'daki `outline: "none"` bu yüzden ihlal değil — global kural onu geri veriyor. Yasak olan, **`:focus-visible` karşılığı olmadan** outline'ı kapatmak. Bir `<div onClick>` bu kuralın DIŞINDA kalır: tıklanabilir öğe `<button>` olmalı ya da `tabIndex` + kendi focus stilini taşımalı. |
| **active/press** | 120 ms içinde bir ton aşağı. Ölçek/kayma efekti yok. |
| **disabled** | `textFaint` + `cursor: not-allowed`. Opaklık düşürme — zeminle karışıyor. |
| **loading** | Düğme metni yerini eyleme çevirir ("Kaydet" → "Kaydediliyor…") ve düğme kilitlenir. |

**Dokunma hedefi en az 40×40** (`minHeight: 40` hazır stillerde var). İkon düğmesi 36×36 alt sınır.

---

## Düğme

Üç düzey, dördüncüsü yok:

| Düzey | Stil | Nerede |
|---|---|---|
| **Birincil** | `saveBtnStyle` — `accent` zemin, beyaz metin | Ekranda **en fazla bir tane** |
| **İkincil** | `addBtnStyle` — `accentSoft` zemin, `accentText` | Ekleme, ikincil eylem |
| **Sessiz** | `cancelBtnStyle` — saydam, 1px `border`, `textDim` | Vazgeç, kapat |
| İkon | `iconBtnStyle` | Yalnızca anlamı ikondan okunuyorsa; yoksa metin |

**Yıkıcı eylem** `danger` rengiyle ve **onay isteyerek**. Silme bu sistemde geri alması en zor
işlem — güvenlik defterine de yazılıyor (→ `marcus-yetki`).

Metin **eylemi söyler**: "Kaydet", "Paylaşıldı olarak işaretle" — "Gönder", "Tamam" değil.
Sonuç bildirimi aynı fiili kullanır ("Kaydedildi").

## Girdi · seçim

`inputStyle` — `surface` zemin, 1px `border`, radius 10, 15px Inter, 12/15 padding.
Etiket **üstte**, 11px `600` `textDim`. Placeholder açıklama değildir; gerekiyorsa
alan altına 11px yardım metni.

**Hata** alanın ALTINDA, 11px `danger`, ve **ne yapılacağını söyler** — "Geçersiz" değil,
"Tutar 0'dan büyük olmalı". Alan çerçevesi `danger`'a döner.

**Rakam alanları mono** ve sağa hizalı.

Tarih için hazır takvim seçici var (`AySeciciAlan` ve tarih alanları) — serbest metin yazdırma.

## Açılır menü (dropdown) · seçim listesi

`surfaceRaised` zemin, 1px `border`, radius 10, gölge yok. Tetikleyiciyle **aynı genişlikte
ya da daha geniş**, asla dar. Seçili satır `accentSoft`. Klavye: ok tuşları + Enter + Esc.
Sekiz maddeyi geçiyorsa **arama alanı** ekle — bu uygulamada marka listeleri uzuyor.

## Modal

`surfaceRaised`, radius 10, zemine düşük opaklıkta koyu örtü, **kutuya gölge yok**.
Başlık 15px Space Grotesk. Esc kapatır, odak içeride tuzaklanır, açılınca ilk anlamlı
alana odaklanır. Kapatma düğmesi sağ üstte.

**Modal iş yapmak içindir, bilgi göstermek için değil.** Salt okunur içerik ekrana ait.

## Tablo · liste

Bu uygulamanın asıl veri yüzeyi.

- Başlık satırı 11px `600` `textDim`, üst hizalı, **yapışkan** (uzun listede kaybolmasın).
- Satır 13px; satır yüksekliği **en az 40**.
- **Sayı sütunları sağa hizalı ve mono** (`tabular-nums`). Metin sola.
- Zebra deseni **yok** — ayrım 1px `borderSoft` ile. Zebra, durum renkleriyle çakışıyor.
- Hover'da satır `surfaceRaised`.
- Satır tıklanabilirse **tamamı** tıklanabilir olmalı, yalnızca bir hücre değil.
- Sıralanabilir sütun başlığı ok gösterir; **elle sıralama açıksa bunu ekranda yaz**
  (bu proje bir kez "Elle sıralama açık" yazıp sıralamayı uygulamadı — `denetim 24`).
- Dar ekranda tablo karta dönüşür (→ `references/kompozisyon.md`).

## Kart

`Card` — `surface`, 1px `border`, radius 10 (bugün 16; aşağıdaki nota bak).
**Kart bir gruplama aracıdır, varsayılan kap değil.** Tek bir liste için kart açma.

> **`KpiCard` ile gerilim — hangisi kazanıyor.** `KpiCard` tek bir rakamı `Card` içine
> sarıyor, yani her KPI otomatik olarak bir kart oluyor; beş KpiCard'lık bir şerit tam da
> "her şeyi karta çevirme" satırının tarif ettiği şey. **Kural kazanır, bileşen değil:**
> `KpiCard` bir ekranın **ana ölçütleri** için, en fazla dört tane. Bir varlığın
> özelliklerini (ücret, marj, bakiye) göstermek KpiCard işi değil — etiket+değer bloğu
> kart olmadan da yazılır.

> **`Card`'ın radius'u kademeli geçişin DIŞINDA.** `Card` tek bir bileşen; "dokunduğun
> ekranda 10 yap" onda uygulanamaz, ya hepsi birden değişir ya hiçbiri. Bu yüzden 16
> bilerek duruyor ve **tek seferlik ayrı bir iş** olarak adlandırılıyor: `Card` 16 → 10,
> tek commit, davranış değişikliğiyle aynı kutuda değil. O iş yapılana kadar yeni
> yüzeylerde 10, `Card`'da 16 yan yana durur — bilinen ve kabul edilmiş bir ödün.

`KpiCard` — etiket 11px üstte, rakam 28 (ya da `buyuk` ile 40) mono, altında değişim.
`buyuk` yalnızca ekranın **iki** ana rakamı için; hepsi büyükse hiçbiri büyük değildir.

## Rozet (badge) · durum

`Pill` — 6px nokta + 13px `600` metin, `…Soft` zemin, radius 999.
Renk **anlam taşır**: `success` tamamlandı · `warning` bekliyor/gecikiyor · `danger` sorun ·
`accent` etkin/seçili · `textDim` nötr.

İçerik türü etiketleri (`Reels` · `Post` · `Carousel`) `TUR_ETIKET`'ten okunur, elle renk
verilmez — **denetim 20** uydurma anahtarı yakalar.

## Yükleniyor

- **Satır içi:** metnin yerine "Yükleniyor…", düzen kaymaz.
- **Tablo/pano:** yer tutucu iskelet, aynı satır yüksekliğinde, **animasyonsuz** (parlayan
  shimmer yok — bu uygulama günde 50 kez açılıyor).
- **Dönen çark yok.** Süresi bilinen bir iş yoksa ne beklendiğini **yaz**.
- Uzun iş (Drive taraması, toplu taşıma) **ilerleme yazar**: "4/20 kart taşındı".

## Boş durum

Üç parça: **ne olduğu** · **neden boş olduğu** · **tek bir eylem.**
"Kayıt yok" yetmez — "Bu markada henüz onaylanmış içerik yok. Operasyon panosundan kart
onaylandığında burada görünür." + varsa düğme. İllüstrasyon yok.

## Hata durumu

**Sebebi söyler ve ne yapılacağını yazar.** Bu proje bunu bir kez zor yoldan öğrendi:
e-posta hatasının gerçek sebebi yutuluyordu ve sorun günlerce teşhis edilemedi
(`lib/eposta-hata.js` → `neYapmali`). Aynı disiplin her hata yüzeyi için geçerli.

**Sunucudan dönen hatanın metnini ELDEN YAZMA — `lib/istek-hatasi.js` üretir.**
`istekHatasi(durum, govde)` → `{ tur, baslik, mesaj, oturumDustu }`; 401 · 403 · 409 ·
503(`mesgul`) · ağ · 500/bilinmeyen dallarının hepsi sebep + ne yapılacak taşıyor ve
sunucunun kendi mesajı **yutulmuyor**. İkinci kez yazılan bir metin, dallardan biri
değişince sessizce bayatlar. `oturumDustu: true` (yalnızca 401) kullanıcıyı giriş
ekranına alır; 401 ile 403'ün neden ayrı kaldığı → `marcus-yetki`.

**`window.alert` kullanılmaz** — engelleyici, yığılmıyor ve tasarım sisteminde yeri yok;
hata uyarı yığınına yazılır. `src/` altında hâlâ **57 tane** var (doğrulama uyarıları,
pop-up engelleyici bildirimleri, müşteri paneli); dokunulan ekranda temizlenir.
**`window.confirm` yıkıcı eylem için geçerli bir onay yoludur** — kaldırılması gereken
yalnızca bilgi amaçlı `alert`.

Uyarılar **yığın hâlinde** gösterilir, tek metin state'iyle değil — ikinci uyarı
birincisini siliyordu ve kullanıcı birini hiç görmüyordu (`src/App.jsx` → `uyarilar`).
Yığını çizen `UyariYigini` bileşeni **TEK yerde** duruyor ve İKİ kabuk (yönetici +
personel) onu çağırıyor: bir süre yalnızca yönetici kabuğunda yazılıydı ve personelin
aldığı sunucu hatası ekranda hiç görünmüyordu.

## Navigasyon · sidebar

- Aktif madde `accentSoft` zemin + `accentText`; sol kenarda ince çubuk **yok** (gereksiz süs).
- Gruplar arası 24 boşluk, grup başlığı 11px `600` `textFaint`.
- **Rol neyi görüyorsa o çizilir** — gizli düğme güvenlik sınırı değildir, sunucu da
  denetler (→ `marcus-yetki`).
- Dar ekranda alt çubuğa iner; **en fazla beş** ana madde, gerisi "Daha fazla".
- Sayaç rozeti yalnızca **eylem gerektiren** sayı için (geciken iş), toplam için değil.


---

## Taşıyıcısı olmayan kurallar — bilinen boşluk

Bu belge bazı davranışları şart koşuyor ama `src/tema.jsx`'te onları taşıyan bir bileşen
**yok**; sonuç olarak her ekran kuralı elden yeniden yazıyor ve §5'teki ölçülmüş sapma
(radius 7/8/9/12/14, fontSize 12/14) tam olarak buradan doğuyor. Eksikler:

| Eksik | Hangi kuralı taşıyacaktı |
|---|---|
| `Sekmeler` | Sekmeli ayrıntı — bugün en az iki yerde elden çiziliyor |
| `DegerBlogu` | "Etiket 11 üstte, sayı mono altta" — tek ekranda altı kez tekrarlanıyor |
| `BosDurum` | Üç parçalı boş durum (ne · neden · tek eylem) |
| `Tablo` | Yapışkan başlık, zebra yok, satır ≥40, sayı sağa + mono |
| `fmtYuzde` | Kâr marjının gizlilik modundan geçmesi — bugün çıplak basılıyor |

**Bunlar kod işi ve ayrı ele alınır.** Biri eklendiğinde bu tablodan düşer. `fmtYuzde`
bir **davranış değişikliğidir** (bugün görünen bir rakam gizlenir) — kullanıcıya söylenir
ve sapma temizliğiyle aynı commit'e konmaz.