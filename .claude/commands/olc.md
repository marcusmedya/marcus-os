---
description: Kırarak ölçme ritüeli — korumayı geri koy, kaç kontrolün düştüğünü say, dosyayı eksiksiz geri al
argument-hint: [hangi koruma ölçülecek — dosya ve kural]
allowed-tools: Bash, Read, Edit, Grep
---

Ölçülecek koruma: **$ARGUMENTS**

## Kural

Bu projede "test geçti" tek başına HİÇBİR ŞEY söylemez. Daha önce, iddia ettiği şeyi
hiç sınamayan testler yazıldı ve hepsi geçti. Bir düzeltmenin gerçekten ölçüldüğünün
tek kanıtı şudur: **hatayı geri koy, kaç kontrolün düştüğünü say.**

**Sıfır kontrol düşüyorsa koruma yoktur** — testin geçmesi bunu değiştirmez.
Bu oturumda tam olarak böyle bir durum ölçüldü: alt yazı prop'u tekrar kaldırıldığında
0 kontrol düştü, yani hiçbir katman o hatayı göremiyordu.

## Adımlar — sırayı bozma

**1 · Taban ölçüm**
```
./testler/sunucutestleri.sh 2>&1 | tail -3
bash testler/hepsinidenetle.sh > /dev/null 2>&1; echo "denetim çıkışı: $?"
```
Geçen kontrol sayısını ve denetim çıkış kodunu not et. Taban **temiz olmalı**;
zaten düşük bir tabanın üzerine ölçüm yapılmaz.

**2 · Yedekle — git'e GÜVENME**
```
YEDEK=$(mktemp -d); echo "yedek: $YEDEK"
cp <dosya> "$YEDEK"/
md5sum <dosya>
```
`git checkout` ile geri almayı planlama: **henüz commit edilmemiş ya da hiç takip
edilmeyen bir dosyada bu sessizce çalışmaz** ve kırılmış hâl yerinde kalır.
Bu bir kez yaşandı. Karma değerini (`md5sum`) mutlaka not et — 5. adımda gerekecek.

**3 · Korumayı kır — GERÇEK hata şeklinde**
Düzeltmeden ÖNCEKİ hatayı olduğu gibi geri koy. Uydurma bir bozma (rastgele bir satırı
silmek, bir `return`'ü kaldırmak) yanlış güven verir: ölçtüğün şey senin bozman olur,
korumanın kapsadığı gerçek hata değil.

**4 · Yeniden ölç**
```
./testler/sunucutestleri.sh 2>&1 | tail -3
bash testler/hepsinidenetle.sh 2>&1 | grep '^✗'; echo "denetim çıkışı: $?"
```
Düşen kontrol sayısı = taban − yeni. Düşen denetimlerin numaralarını yaz.

**5 · GERİ AL ve geri aldığını DOĞRULA**
```
cp "$YEDEK"/<dosya> <dosya>
md5sum <dosya>     # 2. adımdaki değerle AYNI olmalı
git status --porcelain
```
Karma tutmuyorsa dur ve düzelt. Bu adım isteğe bağlı değil.

**6 · Tabanın geri geldiğini doğrula**
```
./testler/sunucutestleri.sh 2>&1 | tail -1
```
Sayı 1. adımdakiyle birebir aynı olmalı.

## Raporlama

```
Koruma      : <bir cümleyle ne>
Kırılan yer : <dosya:satır> — <gerçek hata şekli>
Taban       : 2503 kontrol · 25 denetim
Kırıkken    : 2497 kontrol · 24 denetim (denetim 25 düştü)
DÜŞEN       : 6 kontrol + 1 denetim
Geri alındı : md5 aynı, git status temiz
```

**Düşen sayı 0 ise bunu açıkça yaz ve korumanın gerçekte olmadığını söyle.**
Sayıyı yukarı yuvarlama, "muhtemelen yakalar" deme, ölçmeden rapor etme.
Ölçemediğin bir şeyi ölçülmüş gibi yazmak bu projede en pahalı hata türü.
