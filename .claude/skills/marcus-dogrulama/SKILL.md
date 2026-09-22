---
name: marcus-dogrulama
description: Marcus OS'ta test, statik denetim ve ölçüm YAZMA bilgisi. Testlerin nasıl kurulduğu (sahte veritabanı, t-numaralandırma, bölüm await'i, BEKLENEN bekçileri), yeni statik denetim ekleme, .jsx hesabını esbuild ile teste açma, kırarak ölçmenin nasıl yapıldığı. Yeni test, yeni denetim ya da bir korumanın gerçekten ölçüldüğünü göstermek gerektiğinde yüklenir. Zinciri ÇALIŞTIRMAK için /dogrula komutu kullanılır.
---

# Marcus Doğrulama — test ve denetim YAZMAK

Bu skill zincir **çalıştırmaz**; onu `/dogrula` komutu yapar. Burada olan şey: bu projede
bir testin, bir denetimin ya da bir ölçümün **nasıl yazıldığı**.

---

## 0 · Neden bu kadar ciddiye alınıyor

Bu projede daha önce, **iddia ettiği şeyi hiç sınamayan testler yazıldı ve hepsi geçti.**
Ayrıca koşucu bir süre düşen denetimi gizledi ve denetim 24 **dört sürüm** boyunca düşük
kaldı — her birinde "temiz" diye raporlandı. Bu yüzden buradaki kurallar üslup değil.

> **"Test geçti" tek başına hiçbir şey söylemez.** Bir düzeltmenin ölçüldüğünün tek kanıtı:
> hatayı geri koy, kaç kontrolün düştüğünü say.

---

## 1 · Katmanlar — hangi hatayı hangisi yakalar

| Katman | Yakaladığı | Yakalayamadığı |
|---|---|---|
| 27 statik denetim | Sözdizimi, tanımsız ad, kapsam, belge bayatlığı, izin listesi ayrışması | Davranış |
| t1…t116 (2765 kontrol) | Sunucu ve saf modül davranışı, sahte veritabanıyla | `.jsx`, prop bağlantısı, çizim |
| `npm run build` | Derleme hatası | Çalışma anı hatası |
| `npm run test:acilis` | **Uygulamanın gerçekten açılması**, siyah ekran, açılışta JS hatası | Açılış sonrası akışlar |

**Bilinen boşluk:** prop bağlantısı ve JSX içi kural Node'dan çağrılamıyor. `onAltMetin`
hatası ölçüldü — prop tekrar kaldırıldığında **0 kontrol düştü.** Yeni kuralı JSX'e gömme
(→ `marcus-mimari` §4).

---

## 2 · Sunucu testi yazma (`testler/` altında `tNNN.mjs`)

- **Sahte veritabanı zorunlu.** `sunucutestleri.sh`, `@vercel/kv` paketini geçici olarak
  `testler/taklit-kv` ile değiştirir ve `trap` ile geri koyar. **Gerçek Redis'e asla
  dokunulmaz.** Üretim verisi kullanan test yazma.
- **Bölümleri `await` etmeyi unutma.** t95 bir kez sessizce bozuldu: bölümler `await`
  edilmediği için hiç çalışmadı, test "0 kaldı" deyip **başarıyla** çıktı ve koşucu da
  yakalamadı (çıkış kodu 0, `✗` yok).
- **Bu yüzden sonda `BEKLENEN` bekçisi var.** Çalışan kontrol sayısı bir sabitle
  karşılaştırılır; sayı kendiliğinden düşerse test gürültülü kırılır. Emsal:
  `testler/t95.mjs` ve `testler/tarayiciAcilis.mjs`. **Kontrol eklerken sabiti de artır.**
- **Kaynak metnine bakan test yazma, davranışı sına.** `grep`'le "şu satır var mı" diye
  bakan bir test, satır yeniden yazılınca yanlış alarm verir ve davranış bozulunca susar.

## 3 · Tarayıcı testi (`testler/tarayiciAcilis.mjs`)

Beş kuralı `CLAUDE.md`'de (beşincisi: hazır olma BEKLENİR, iddia edilmez). Yazarken önemli olan: **testin kendisi sessizce
anlamsızlaşamaz.** `enAzMetin` pozitif olmak zorunda, `beklenenMetin` boş olamaz, sonda
`BEKLENEN` sayacı var — üçü de ölçülerek konuldu, çünkü üçünde de test `0` ile çıkıyor ve
zincirin beş adımı yeşil kalıyordu.

Uydurma belge **gerçek belgenin bütün üst düzey alanlarını taşımalı**; eksik fixture bir
kez testi olmayan bir sorunu kovalattı.

**PERSONEL senaryosunda fixture EKSİK OLMALI.** Yukarıdaki kural `role: "owner"` içindir.
Personel yanıtı sunucuda izne göre SÜZÜLÜYOR (`PERMISSION_DATA_FIELDS`); fixture'a belgenin
tamamını koymak gerçekte hiç oluşmayan bir hâli sınamak olur ve asıl riski gizler — bileşen
gövdesinin, o role HİÇ GÖNDERİLMEYEN alanlara korumasız dokunup dokunmadığı. Fixture
yalnızca o iznin açtığı alanları taşır (emsal: `SAHTE_YANIT_ODEME_IZNI`).

**Kendi kabında kayması İSTENEN bir şeride taşma kontrolü yazarken dikkat.** Yatay kayma
"İKİ yerde ölçülür" kuralının burada yönü değişiyor: sekme şeridi 390px'te bilerek kendi
içinde kayar, yani `scrollWidth - clientWidth > 0` bir KUSUR DEĞİL. Ölçülecek olan
**EBEVEYNİN** taşması (taşma şeridin içinde kaldı mı) ve yanına şeridin gerçekten taştığı
konulur — taşma hiç yoksa "ebeveyn taşmıyor" iddiası boş yere geçer. `position: fixed`
tuzağının (panelde) tersi bir durum; ikisini karıştırma.

## 4 · Yeni statik denetim ekleme

1. Betiği `testler/` altına koy (`.py` ya da `.mjs`).
2. `testler/hepsinidenetle.sh` içine **`denetle "N ad" komut`** satırıyla bağla.
3. Komut **çıkış koduyla** konuşmalı. Boru hattı gerekiyorsa bir fonksiyona sar ve
   `${PIPESTATUS[0]}` kullan — `grep` bulamayınca 1 döner ve raporu **ters çevirir**
   (denetim 7 ve `/olc` adım 4 tam olarak bunu yaşadı).
4. **Yanlış alarm süzgecini betiğin İÇİNE koyma, `denetle`ye giden yerde süz.**
   `cagridenetle.py`'nin kendi çıkış kodu iki bilinen yanlış alarm yüzünden zaten 1
   dönüyor; karar süzgeçten **geriye kalan** satırlara göre veriliyor.
5. `CLAUDE.md`'deki denetim sayısını ve `/dogrula` belgesindeki örneği güncelle.

**Doğrularken `✓` sayma, çıkış koduna bak.**

## 5 · `.jsx` içindeki bir hesabı teste açma

`.jsx` Node'dan import edilemiyor. `testler/t107.mjs` yöntemi: dosyayı **esbuild ile**
(projede zaten var) çevirip geçici bir `.mjs` olarak `testler/` altına yaz, çağır, sonra
`process.on("exit")` ile **her hâlükârda** sil. Yeni bağımlılık yok.

Bu bir telafi, çözüm değil — kuralı baştan `lib/` altına koymak daha doğru.

## 6 · Kırarak ölçme

Ritüelin tamamı `/olc` komutunda. Özü:

1. Dosyayı `mktemp -d` ile yedekle — **`git checkout` kullanma**, izlenmeyen dosyada sessizce başarısız olur.
2. Korumayı kaldır / hatayı geri koy.
3. Zinciri koştur, **kaç kontrolün düştüğünü say ve hangileri olduğunu yaz.**
4. Yedekten geri al, **`md5sum` ile doğrula.**

Düşen kontrol sayısı **0 ise koruma ölçülmemiştir** — testi değil, teste bakışını düzelt.
