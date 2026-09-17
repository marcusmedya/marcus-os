---
description: Marcus OS doğrulama zinciri — 25 denetim + sunucu testleri + derleme, her adım ayrı raporlanır
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
(25 numaralı denetim + aşağıda anlatılan, numaralandırmanın dışında kalan 7. satır.)
Düşen denetim artık çıktısını basar ve betik 1 ile çıkar.

> **Bilinen boşluk — denetim 7.** `cagridenetle.py` satırı `denetle` sarmalayıcısını
> KULLANMIYOR; kendi `grep`'inden geçiyor. Düşen bulgularını EKRANA BASAR ama `DUSEN`
> sayacını artırmaz, yani çıkış kodunu etkilemez. Çıktıda 7 numaralı satırın
> `✓ 7 tanımsız çağrı yok` dediğini GÖZLE doğrula; başka bir şey yazıyorsa düşmüştür.

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

**4 · Fonksiyon sınırı**
```
ls api/*.js | wc -l
```
**12'yi GEÇMEMELİ.** Şu an 11. Geçtiyse yayın Vercel'de patlar.

## Kapsamadığı şey — bunu raporda SÖYLE

Bu zincirin hiçbir adımı **uygulamayı gerçekten ÇİZMİYOR**. Üretime çıkan siyah ekran
hatası tam olarak buradan geçti: derleme temizdi, 2503 kontrol geçiyordu, o günkü
denetimlerin hepsi yeşildi ve uygulama açılmıyordu. Şu an en yakın vekil **denetim 25**
(`tanimsizIsim.mjs`) — aynı sınıftan iki hatayı yakaladı — ama gerçek bir çizim kontrolü
DEĞİL. Bileşen gövdesinde `data`ya dokunan bir değişiklik yaptıysan bunu raporda
ayrıca belirt: `data` ilk render'da `null`'dur.

## Raporlama

Şu biçimde yaz, uydurma:

```
1 statik denetim    → çıkış 0 · 25/25
2 sunucu testleri   → çıkış 0 · 2503 kontrol
3 derleme           → çıkış 0
4 api fonksiyonu    → 11/12
```

Bir adım düştüyse **hangi denetim/test** olduğunu ve çıktısını yaz. "Temiz" kelimesini
yalnızca dört adımın da çıkış kodu 0 ise kullan. Çalışmayan bir adımı çalışmış gibi
yazmak, bu projede zaten dört sürüm boyunca yaşandı.
