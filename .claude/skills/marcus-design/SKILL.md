---
name: marcus-design
description: Marcus Design System — Marcus OS'un görsel imzası, tasarım ilkeleri, jeton sistemi (renk, tipografi, boşluk, yüzey, radius, hareket) ve ekran kompozisyonu yöntemi. Marcus'a özgü bütün tasarım kararlarının TEK kaynağı. Arayüz, ekran, bileşen, tasarım, görünüm, stil, yerleşim ya da UX işine dokunulduğunda yüklenir. Bileşen standartları için references/bilesenler.md, ekran kompozisyonu ve hareket için references/kompozisyon.md okunur.
---

# Marcus Design System

Marcus OS **bir ajansın günlük operasyon sistemi.** Personel, çözüm ortağı ve müşteri aynı
anda kullanıyor; aynı ekranda saatlerce rakam okunuyor; panel çoğu zaman başkalarının da
görebileceği bir ortamda açık duruyor. Tasarım kararlarının hepsi buradan türer.

> **Bu dosya Marcus'a özgü kararların tek sahibidir.** Genel tasarım zanaatını (tipografik
> ölçek, kontrast, jenerik AI görünümünden kaçınma) başka bir kaynak sağlayabilir; ama
> Marcus'un rengi, ölçeği, yüzeyi ve kompozisyon yasası **burada** yazar ve çelişki hâlinde
> **bu dosya kazanır.**

---

## 1 · İmza — ekran görüntüsünden tanınacak olan şey

Marcus'un imzası logo ya da renk değil. Üç karar:

### "Sessiz yüzey, konuşan sayı"

**Gölge yok. Gradient yok. Glow yok. Blur yok.** Derinlik yalnızca **üç yüzey tonuyla**
anlatılır (`bg` → `surface` → `surfaceRaised`). Bir öğeyi öne çıkarmanın yolu onu
parlatmak değil, bir ton yukarı almaktır.

> **Bugünkü sapma — ölçüldü (Eylül 2026).** Bu bir HEDEF, henüz tamamlanmış bir durum
> değil: `src/` altında **9 `boxShadow`** (App.jsx 5 · TeklifSozlesme.jsx 3 ·
> musteriPaneli.jsx 1, çoğu açılır menü ve modal) ve **2 `linear-gradient`**
> (`src/instagram.jsx`, Instagram'ın kendi marka halkası — o bilinçli bir alıntı ve
> kalabilir) var. Yeni kodda gölge **yazılmaz**; var olanlar §5'teki kademeli geçişle,
> yalnızca zaten dokunulan blokta temizlenir.

**Metin 15'i geçmez, sayı geçer.** Gövde metni 11–15 aralığında kalır; 20, 28 ve 40 yalnızca
**rakamlara** ayrılmıştır. Böylece göz kaçınılmaz olarak veriye düşer, başlığa ya da süse
değil. Premium his buradan gelir — büyük başlıktan değil.

### "Önce karar"

Her ekran **bugün ne yapılması gerektiğiyle** açılır; toplamla değil. Bu uydurma bir ilke
değil, ürünün kendi davranışı: Dashboard'ın en üstünde `lib/bugun.js` var — geciken işler,
bugün teslim, revize bizde, bugün paylaşılacak. Toplamlar bunun ALTINDA.

Yeni bir ekran tasarlarken sıra: **kullanıcı bu ekrana neden geldi → ilk görmesi gereken
şey → yapması gereken aksiyon → destekleyici veri.** Kompozisyon bundan sonra çizilir.

### "Hassas veri varsayılan olarak kapalı"

Bütün ₺ tutarları uygulama açıldığında `***` gelir; görmek üst çubuktaki göze basmayı
gerektirir (`src/tema.jsx` → Gizlilik Modu). Sebebi ürünün gerçek kullanım ortamı: panel
kafede, çekimde, birinin yanında açılıyor.

Bu bir ayar değil, **tasarım duruşu.** Yeni bir hassas alan (maaş, bakiye, kâr marjı, ödeme)
eklerken aynı kapıdan geçir. Rakamı savunmasız bırakma.

---

## 2 · Bunlar Marcus DEĞİL

| Yapma | Neden |
|---|---|
| Her ekranı `sidebar → başlık → 4 KPI kartı → tablo` kalıbına sokma | Ekranın amacı kompozisyonu belirler, şablon değil |
| Her şeyi karta çevirme | Kart bir gruplama aracı; liste satırı çoğu zaman daha okunur |
| Premium hissi gradient/glow/büyük radius ile arama | Oran, boşluk, hizalama ve tipografiden gelir |
| Dekoratif ikon serpme | İkon yalnızca eylemi ya da durumu **adlandırıyorsa** |
| İkinci bir vurgu rengi icat etme | Tek vurgu indigo; diğer renkler yalnızca DURUM |
| Açılışta animasyon | Bu araç günde 50 kez açılıyor; her açılışta beklemek işkence |
| Jenerik AI görünümü | Krem+terracotta, siyah üstü asit yeşili, mor-mavi gradient hero, her köşede `rounded-lg` |
| Özgünlük için okunabilirliği bozma | Hız ve bilgiye erişim her zaman önce gelir |

---

## 3 · Jetonlar — tek kaynak `src/tema.jsx`

**Renk `T` nesnesinden okunur, sabit yazılmaz.** `T` bir sabit değil; tema değişince içi
güncelleniyor. Yeni bir renk gerekiyorsa `KOYU` ve `ACIK`'a birlikte eklenir — **denetim 20**
olmayan anahtarı yakalar.

### Renk

Koyu tema varsayılan. Açık tema koyunun tersi değil: zemin saf beyaz değil hafif soğuk gri,
vurgular beyaz üstünde okunacak biçimde koyulaştırılmış, yumuşak zeminler saydam yerine düz.

| Rol | Jeton | Kullanım |
|---|---|---|
| Zemin | `bg` | Sayfa |
| Yüzey | `surface` | Kart, panel, girdi |
| Yükseltilmiş | `surfaceRaised` | Açılır menü, seçili satır, modal |
| Çizgi | `border` / `borderSoft` | 1px; **yalnızca aynı tondaki iki yüzey birleşiyorsa** |
| Metin | `text` / `textDim` / `textFaint` | Birincil / ikincil / üçüncül |
| Vurgu | `accent` / `accentSoft` / `accentText` | **Tek** vurgu — indigo |
| Durum | `success` / `warning` / `danger` + `…Soft` | Yalnızca durum, asla süs |

### Tipografi — üç aile, beş boy

| Aile | Nerede |
|---|---|
| **Space Grotesk** | Başlık, bölüm başlığı, marka — karakteri taşıyan yüz |
| **Inter** | Gövde, etiket, düğme, form — okunan her şey |
| **IBM Plex Mono** | **Her rakam** — tutar, sayaç, tarih, kimlik |

**Ölçek: 11 · 13 · 15 · 20 · 28** (+ 40 yalnızca Dashboard'ın iki ana rakamı için —
`KpiCard`'ın `buyuk` dalı, `src/tema.jsx`). Aradaki değerleri kullanma.

Ölçüm: bugün `src/` altında **Space Grotesk 31**, **IBM Plex Mono 92**, Inter geri kalan —
yani üç aile ayrımı gerçek, uydurma değil.

| Boy | Rol |
|---|---|
| 11 | Etiket — `600`, `letterSpacing 0.4`, `textDim` |
| 13 | Gövde ve arayüzün varsayılanı — en çok kullanılan boy |
| 15 | Bölüm başlığı, form girdisi |
| 20 / 28 / 40 | **Yalnızca rakam** |

**Rakamlarda `fontVariantNumeric: "tabular-nums"` zorunlu.** Alt alta gelen tutarlar
hizalanmazsa göz onları karşılaştıramaz; bu uygulamanın asıl işi karşılaştırma.

### Boşluk — 4'ün katları

**4 · 8 · 12 · 16 · 24 · 32.** Ölçüm: bugün `gap: 8` (178 kez) ve `gap: 10` (99 kez) baskın,
ama 5/6/7/14 de var. Yeni kodda **yalnızca yukarıdaki altı değer.**

### Radius

**10** — kart, panel, girdi, düğme, menü. **999** — yalnızca durum rozeti (Pill).
Başka değer yok. (Bugünkü sapma: `Card` bileşeni 16, satır içi kullanımlar çoğunlukla 10,
ayrıca 7/8/9/12/14 dolaşıyor. Geçiş §5'te.)

### Yükselti

Gölge **yok**. Sıra: `bg` → `surface` → `surfaceRaised`. Modal için `surfaceRaised` +
zemine düşük opaklıkta koyu bir örtü; kutunun kendisine gölge verilmez.

### Hareket

**120 ms**, `ease-out`. Yalnızca **kullanıcı eylemine** yanıt: hover, focus, press, açılma.
Açılışta, kaydırmada ve veri gelişinde animasyon yok. `prefers-reduced-motion` saygı görür.

---

## 4 · Sorumluluk sınırı

| Karar | Kaynak |
|---|---|
| Marcus'un rengi, ölçeği, yüzeyi, imzası, kompozisyon yasası | **Bu dosya** |
| Bileşen davranışı ve durumları | `references/bilesenler.md` |
| Ekran kompozisyonu yöntemi, hareket, responsive | `references/kompozisyon.md` |
| Genel tipografi zanaatı, jenerik AI görünümünden kaçınma | Resmi `frontend-design` skill'i (kuruluysa) |
| Grafik ve veri görselleştirme | `dataviz` skill'i (kuruluysa) — renkler yine buradan |

Dış kaynak **genel zanaat** verir. **"Marcus ne yapar"** sorusunun cevabı her zaman burada.
Çelişirlerse bu dosya kazanır.

**Resmi `frontend-design` hakkında — kaynak ve sınır.** Anthropic'in resmi eklentisi
`anthropics/claude-code` deposunda `plugins/frontend-design/` altında duruyor (lisansı
kendi `LICENSE.txt`'sinde). Jenerik AI görünümüne karşı yazılmış olması Marcus'un derdiyle
örtüşüyor ve genel tipografi/hiyerarşi zanaatı için **faydalı**.

Ama **bir yerde Marcus'la çelişir**: o skill her proje için "cesur bir estetik yön" (brutalist,
maksimalist, retro-fütürist…) seçtiriyor. Marcus'un **tek ve sabit** bir görsel imzası olmalı
ve bu yukarıda yazıyor. O adımı **uygulama** — geri kalanını kullan.

Depoya **kopyalanmadı**: lisansı ayrı, sürümü bizden bağımsız ilerliyor ve kopyası sessizce
bayatlar. Kurulumu kullanıcının kararı (`/plugin`).

---

## 5 · Kademeli geçiş — uygulamayı yeniden yazma

**`src/App.jsx` 11.000 satır ve çalışıyor. Sıfırdan yazma, toplu refactor yapma.**
İstenmeden arayüz değiştirilmez (`CLAUDE.md` → Asla yapılmayacaklar).

Geçiş kuralı: **dokunduğun ekranı bu sisteme getir, dokunmadığını bırak.**

1. Yeni kod bu jetonlarla yazılır — istisnasız.
2. Zaten düzenlediğin bir bloktaki sapmayı (radius 12 → 10, gap 7 → 8) düzelt.
3. Ortak bileşen (`Card`, `Pill`, `KpiCard`, `SectionTitle`, `inputStyle`, `saveBtnStyle`…)
   `src/tema.jsx`'te; yeni bir varyant gerekirse **satır içi stil yazma, oraya ekle.**
4. Sapma temizliği **ayrı bir iş**, davranış değişikliğiyle aynı commit'te değil.

**Ölçülmüş bugünkü sapma** (Eylül 2026): radius 10 (115) · 999 (71) · 8 (67) · 9 (59) ·
12 (29) · 14 (18) · 7 (14) — fontSize 13 (531) · 11 (362) · 12 (91) · 15 (60) · 20 (32).
Yani örtük sistem zaten 13/11 ve 10; yapılacak şey onu **adlandırmak ve sapmayı kapatmak.**
