# Denetim Testleri

Bu klasör, sistemin veri güvenliği ve veri kaybı korumalarını **gerçekten çalıştırarak**
sınayan testleri içerir. Vercel'e yüklenmesi zararsızdır (api/ klasöründe olmadığı için
fonksiyon sayısını etkilemez), sadece kaynak dosya olarak durur.

## Nasıl çalıştırılır
Yerel bir bilgisayarda, proje klasöründe:

```
mkdir -p node_modules/@vercel/kv
# (Claude bu klasöre bir taklit veritabanı yazar — internet gerekmez)
node testler/t5.mjs
```

Normalde bunları çalıştırmana gerek yok; her güncellemede Claude çalıştırıyor.

## Dosyalar
- `denetim.mjs` — ortak test verisi ve yardımcılar
- `t1–t4` — marka kilidi sızıntı taramaları (hangi alan hangi hesaba gidiyor)
- `t5` — uç nokta bazlı yetki denetimi (başka markaya yazma/silme denemeleri)
- `t6` — veri kaybı ve senkron denetimi (birleştirme, çakışma tespiti)
- `t7` — genel koruma denetimi (güvenlik freni, yedekler, şifre sızıntısı)
- `t8` — duman testi: 12 uç noktanın hepsi çağrılıp çökmüyor mu kontrol edilir

`t8` özellikle değerlidir: `api/backup.js` dosyasında eksik bir import yüzünden **yedekten
geri yükleme özelliğinin tamamen çöktüğü** bu testle yakalandı.
