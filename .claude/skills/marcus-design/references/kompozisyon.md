# Marcus ekran kompozisyonu, responsive ve hareket

`marcus-design` skill'inin kompozisyon katmanı. Bir ekranı **sıfırdan tasarlarken** ya da
var olanı yeniden düzenlerken izlenen yöntem.

---

## 1 · Yöntem — dört soru, sonra çizim

Şablon seçerek başlama. **Sırayla şunları yaz**, sonra kompozisyonu bunlardan türet:

1. **Kullanıcı bu ekrana neden geldi?** Tek cümle. ("Bu markanın bu hafta ne paylaşacağını
   görmek ve eksikleri tamamlamak.")
2. **Hangi rolde?** Yönetici, personel, çözüm ortağı ve müşteri aynı ekranı farklı görüyor.
   Rolü belirlemeden kompozisyon kurulamaz.
3. **İlk üç saniyede ne görmeli?** Genellikle **bir durum ya da bir eksik**, bir toplam değil.
4. **Buradan çıkmadan ne yapmalı?** O eylem birincil düğme olur — ekranda bir tane.

Ancak bundan sonra yerleşim: **karar → eylem → destekleyici veri → arşiv/geçmiş.**

## 2 · Yasa: varsayılan kalıp yok

`sidebar → başlık → 4 istatistik kartı → tablo` **bir kalıp değil, bir kaçış.** Ekranın
şekli işine göre değişir:

| Ekranın işi | Uygun şekil |
|---|---|
| Bugün ne yapılacak | Üstte durum listesi, altında iş akışı — toplam en altta ya da hiç |
| Bir varlığı incelemek (müşteri, kart) | Solda kimlik + durum, sağda sekmeli ayrıntı |
| Karşılaştırmak (ay ay, marka marka) | Tablo birincil; kart yok, rakamlar hizalı |
| İş yürütmek (pano) | Sütunlu akış; kart yalnızca taşınabilir birim olduğu için kart |
| Kurmak/ayarlamak | Tek sütun form, mantıksal bloklar, 24 boşluk |

**Dört KPI kartı** yalnızca gerçekten dört eşit ağırlıklı ölçüt varsa. Ölçütlerden ikisi
daha önemliyse ikisi `buyuk`, diğerleri küçük — Dashboard bunu zaten böyle yapıyor
("biri sonuç, diğeri uyarı").

## 3 · Bilgi hiyerarşisi

- **Bir ekranda tek bir birincil eylem.** İkincisi varsa biri ikincildir.
- **Sayı her zaman etiketinin altında**, etiket 11px üstte. Yan yana yazma.
- **Ham veriyi yorumlamadan bırakma.** "42" değil, "42 içerik stokta · 3 hafta yeter".
- **Eksik veriyi gizleme, SÖYLE.** Bu proje boyunca tekrarlanan kural: eksik bir dökümü tam
  gibi göstermek, hiç göstermemekten kötüdür. Tarihsiz kayıt sayılır ve "bu dökümde yok"
  diye yazılır; sabit giderlerin geçmişi olmadığı ekranda açıkça yazar.
- **Uydurma sayı yok.** Bilinmeyen değer için parça hiç yazılmaz — "-5 B · -0 kbps" görmek,
  hiçbir şey görmemekten kötü (`lib/video-bilgi.js`).

## 4 · Izgara ve ölçü

- İçerik genişliği **en fazla 1280**; okuma metni **65 karakter** civarı.
- Sütun arası 24, blok arası 32, kart içi 16–24.
- **Hizalama sapmasız:** aynı gruptaki kartlar aynı yüksekliğe, sayılar aynı sağ kenara
  oturur. Premium his büyük ölçüde buradan geliyor.

## 5 · Responsive

Kırılma noktası **860** (`useIsMobile` zaten bunu kullanıyor).

| Genişlik | Davranış |
|---|---|
| ≥ 1280 | Tam yerleşim, yan panel açık |
| 860–1280 | Yan panel daralır/ikonlaşır, sütun sayısı düşer |
| < 860 | Tek sütun, navigasyon alt çubuğa iner, **tablo karta dönüşür** |

Tablodan karta geçerken: her satır bir kart, **en önemli üç alan** görünür, gerisi
"Ayrıntı"da. Yatay kaydırmalı tablo son çare — ve o zaman ilk sütun sabitlenir.

**Sayfa gövdesi asla yatay kaymaz.** Geniş içerik (tablo, kod) kendi kabında kayar.

## 6 · Hareket

**120 ms, `ease-out`, yalnızca kullanıcı eylemine yanıt.**

| İzin verilen | Yasak |
|---|---|
| Hover/focus/press ton geçişi | Açılışta giriş animasyonu |
| Açılır menü ve modalin belirmesi | Kaydırmayla tetiklenen efekt |
| Satırın yerine oturması (toplu taşımadan sonra) | Parlayan shimmer iskelet |
| İlerleme göstergesi (gerçek ilerleme varsa) | Dekoratif döngü |

`prefers-reduced-motion: reduce` saygı görür — o hâlde geçişler anında olur.

**Sebebi:** bu araç günde onlarca kez açılıyor ve aynı ekranlar defalarca geziliyor. İlk
seferde hoş görünen animasyon ellinci seferde gecikmedir.

## 7 · Metin

Arayüz **tamamen Türkçe** — değişken ve fonksiyon adları dahil (`CLAUDE.md`).

- Etkin çatı, kullanıcının dili: "Paylaşıldı olarak işaretle", "Ödemeyi kaydet".
- Sistem terimi değil kullanıcı terimi: *içerik*, *kart*, *stok*, *şube* — "kayıt", "entity" değil.
- Muhasebe dilinden kaçınılan yerler var: sade anlatımda "tahakkuk" yok; *hak edilen*,
  *tahsil edilen*, *bekleyen* (`lib/sade-ozet.js`). Aynı disiplin yeni metinlerde de geçerli.
- Aynı eylem her yerde **aynı adla** anılır.

## 8 · Bitirmeden önce

- [ ] Dört soru yazıldı mı, kompozisyon şablondan değil onlardan mı çıktı?
- [ ] Ekranda tek birincil eylem var mı?
- [ ] Rakamlar mono ve `tabular-nums` mu, sağa hizalı mı?
- [ ] Boş ve hata durumları **sebep + eylem** söylüyor mu?
- [ ] Focus görünür mü, klavyeyle gezilebiliyor mu?
- [ ] 860 altında yatay kayma var mı?
- [ ] Koyu **ve** açık temada okunuyor mu? (`T`'den okundu mu, sabit renk var mı?)
- [ ] Hassas rakam gizlilik modundan geçiyor mu?
- [ ] Rolün göremeyeceği bir şey çizilmiyor mu, sunucu da denetliyor mu?
