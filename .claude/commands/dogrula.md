---
description: Marcus OS doğrulama zinciri — 26 denetim + testler + derleme + tarayıcı açılışı, her adım ayrı raporlanır
allowed-tools: Bash(bash testler/hepsinidenetle.sh), Bash(./testler/sunucutestleri.sh), Bash(npm run build), Bash(ls api/*.js | wc -l), Bash(git status --porcelain), Read, Grep
---

Marcus OS'ta bir değişikliği yayınlamadan önce çalıştırılan tam doğrulama zinciri.

## Neden bu komut var

`testler/hepsinidenetle.sh` bir süre düşen denetimi GİZLİYORDU: her satır
`komut > /dev/null && echo "✓ …"` biçimindeydi, denetim düşünce çıktı çöpe gidiyor,
`✓` basılmıyor ve betik sessizce devam ediyordu. Sonuç: denetim 24 **dört sürüm**
boyunca düşük kaldı (#118–#121) ve her birinde "24 denetim temiz" diye raporlandı.
Kullanılan kontrol yöntemi (`… | grep ✗`) hiçbir zaman bir şey bulamazdı.

Bu yüzden buradaki kural şu: **her adımın ÇIKIŞ KODUNU ayrı ayrı yakala ve yaz.**
Çıktıdaki `✓` işaretlerine bakma — onlar bir şey kanıtlamaz.

## Adımlar — dördünü de çalıştır, biri düşse bile diğerlerine devam et

Her adımı ayrı bir Bash çağrısında çalıştır ve çıkış kodunu kaydet.

**1 · Statik denetimler**
```
bash testler/hepsinidenetle.sh; echo "ÇIKIŞ: $?"
```
Beklenen: `✓` ile başlayan **26** satır ve `ÇIKIŞ: 0`.
(1 ve 1b ayrı sayılır, sonra 2…25 → toplam 26.)
Düşen denetim çıktısını basar ve betik 1 ile çıkar.

> **26'sının hepsi sayaçta.** Denetim 7 bir boru hattı olduğu için bir süre `denetle`
> sarmalayıcısının dışında kaldı: bulgularını basıyor ama `DUSEN`'i artırmıyordu, yani
> tek başına düştüğünde betik yine 0 ile çıkıyordu. Boru hattı `cagriDenetimi`
> fonksiyonuna alındı ve bağlandı — ölçüldü: aynı hatada eski betik çıkış 0, yeni betik
> çıkış 1 veriyor. Artık gözle doğrulanması gereken bir istisna YOK.

**2 · Sunucu testleri**
```
./testler/sunucutestleri.sh; echo "ÇIKIŞ: $?"
```
Beklenen son satır: `SONUÇ: <N> kontrol geçti, hata yok.` ve `ÇIKIŞ: 0`.
**Kontrol sayısını yaz.** Sayı DÜŞTÜYSE bu, testler geçse bile bir korumanın
kaybolduğu anlamına gelir — araştır. Bu koşucu sahte `@vercel/kv` kullanır,
gerçek Redis'e dokunmaz.

**3 · Üretim derlemesi**
```
npm run build; echo "ÇIKIŞ: $?"
```

**4 · Tarayıcı açılış testi**
```
npm run test:acilis; echo "ÇIKIŞ: $?"
```
Beklenen: `SONUÇ: 14 kontrol geçti, uygulama açılıyor.` ve `ÇIKIŞ: 0`.
**Bu adım tek başına siyah ekranı yakalar** — diğerlerinin hiçbiri uygulamayı çizmiyor.
`dist/` yoksa test kendisi derler. Çıktıda `TARAYICI BULUNAMADI` yazıyorsa bu bir
UYGULAMA hatası değil, ortamda Chromium yok demektir; `MARCUS_CHROMIUM=<yol>` ver.

**5 · Fonksiyon sınırı**
```
ls api/*.js | wc -l
```
**12'yi GEÇMEMELİ.** Şu an 11. Geçtiyse yayın Vercel'de patlar.

## Kapsamadığı şey — bunu raporda SÖYLE

**Açılış artık ölçülüyor (4. adım), ama yalnızca açılış.** Test iki ekran çiziyor:
ilk kurulum ve dashboard. Hiçbir sekmeye tıklanmıyor, form doldurulmuyor, kart açılmıyor,
dosya yüklenmiyor. "Uygulama açılıyor" ile "uygulama çalışıyor" arasındaki fark duruyor —
bir düğmeyi ya da akışı değiştirdiysen bu zincir onu GÖRMEZ, raporda söyle.

**Fixture elle bakımlı.** Uydurma belge gerçek belgenin bütün üst düzey alanlarını
taşıyor. Uygulamaya yeni bir zorunlu alan eklersen fixture'ı da güncelle; yoksa test
gerçekte olmayan bir hatayı gösterir ve seni yanlış yere baktırır. Bu yaşandı.

**Hata sınırı bazı çöküşleri yutuyor.** Bir bölüm düşerse uygulama "Bölüm çizilemedi"
yazıp ayakta kalır; test bunu `pageerror` değil KONSOL HATASI olarak görür. Kontrol var
ama sinyal daha zayıf — çıktıdaki konsol hatası satırlarını okumadan geçme.

## Raporlama

Şu biçimde yaz, uydurma:

> Sayılar **yer tutucu** — bilerek. Bu belgeye sabit bir sayı yazmak, her yeni testte
> bayatlar ve daha kötüsü: yukarıdaki "sayı DÜŞTÜYSE bir koruma kayboldu" kuralını
> yanlış bir tabana bağlar. Sayıyı **koşudan** al, karşılaştırmayı **bir önceki koşuya**
> karşı yap. (Bu bir kez yaşandı: belgede 2503 yazıyordu, gerçek 2522'ydi.)

```
1 statik denetim    → çıkış 0 · <geçen>/<toplam>
2 sunucu testleri   → çıkış 0 · <koşunun yazdığı sayı>
3 derleme           → çıkış 0
4 tarayıcı açılışı  → çıkış 0 · <geçen>/<toplam>
5 api fonksiyonu    → <koşudan>/12        (12 SABİT sınır, sol taraf değişir)
```

Bir adım düştüyse **hangi denetim/test** olduğunu ve çıktısını yaz. "Temiz" kelimesini
yalnızca BEŞ adımın da çıkış kodu 0 ise kullan. Çalışmayan bir adımı çalışmış gibi
yazmak, bu projede zaten dört sürüm boyunca yaşandı.
