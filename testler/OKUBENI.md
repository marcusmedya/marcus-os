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

## Kod denetleyicileri (Python)

Dosya bölme sonrası eklendi. Her paket öncesi çalıştırılır:

```
python3 testler/jsxdenetle.py src/*.jsx src/*.js api/*.js lib/*.js
python3 testler/bozulma.py src/*.jsx
python3 testler/importdenetle.py src/*.jsx src/*.js
```

- **jsxdenetle.py** — JSX-farkında sözdizimi kontrolü. Dize, şablon, yorum, regex ve JSX
  etiketlerini doğru ayırt eder; Türkçe kesme işaretlerinde (`Drive'ın`) yanılmaz.
- **bozulma.py** — bir kod parçasının yanlışlıkla metin şablonunun ortasına girmesini yakalar.
  (Bir kez tam olarak bu yüzden uygulama hiç açılmadı.)
- **importdenetle.py** — bir dosyanın kullandığı ama tanımlamadığı/import etmediği adları
  bulur. Dosya bölerken en tehlikeli hata budur: sözdiziminden geçer, tarayıcıda patlar.

**Bilinen yanlış alarmlar (normal):** `App.jsx → C, labelStyle`, `CekimEditTakibi → Personel`,
`personel.jsx → Dashboard, Finans`. Bunlar JSX metninde geçen kelimeler. Bu üçünün dışında bir
ad çıkarsa gerçek hatadır.

## Sonradan eklenen iki denetleyici

```
python3 testler/ciftdenetle.py src/*.jsx src/*.js api/*.js lib/*.js
python3 testler/jsxyapi.py src/*.jsx
```

- **ciftdenetle.py** — aynı isimde iki `const/let` tanımı. Bir düzenleme yanlışlıkla iki kez
  uygulandığında oluşur; derlemeyi kırar ama parantez dengesi bozulmadığı için diğer
  kontrollerden geçer.
- **jsxyapi.py** — bir JSX bloğunun, açılmış başka bir bloğun ortasına girmesi. Aynı şekilde
  dengeli görünür ama derlenmez.

İkisi de gerçek bir deploy hatasından sonra yazıldı: `{saveBlocked && (` satırının ortasına
bir uyarı şeridi eklenmiş ve aynı state iki kez tanımlanmıştı.

## Altıncı denetleyici: eksik bileşen/ikon

```
python3 testler/ikondenetle.py src/*.jsx
```

Dosya bölerken en sinsi hata: bir bileşen taşınır ama kullandığı **dış kütüphane import'u**
(lucide-react ikonları) taşınmaz. Sözdizimi geçerli, parantezler dengeli, `importdenetle.py`
de göremez — çünkü eksik ad bizim dosyalarımızda hiç tanımlı değil.

Sonuç: o bileşen ekrana geldiği an sayfa tamamen siyah olur.

Gerçek olay: `tema.jsx`'e taşınan `FieldForm`'un `<Check>` ikonu import edilmemişti; müşteri
düzenleme formu her açıldığında uygulama çöküyordu.

## Tek komutla hepsi

```
./testler/hepsinidenetle.sh
```

Sekiz kod denetimini sırayla çalıştırır. Hiçbiri veriye dokunmaz — sadece kaynak dosyaları okur.

### Sonradan eklenen üç denetleyici

- **hookdenetle.py** — bir bileşen taşınır ama `useMemo`/`useRef` gibi hook'u import listesine
  eklenmezse yakalar.
- **cagridenetle.py** — en kapsamlısı. Kodda çağrılan HER adın o dosyada tanımlı/import edilmiş
  olduğunu doğrular. Bir yardımcı fonksiyon taşınıp import edilmediğinde bunu bulur.
- **butondenetle.py** — `onClick={birSey}` biçimindeki her olay bağlantısının tanımlı olduğunu
  kontrol eder. Tanımsız bir onClick ancak o butona basıldığında ortaya çıkar; gözden kaçması
  çok kolaydır.

### Bilinen yanlış alarmlar (normal)
`cagridenetle` → `Ciro`, `Tamamlananlar`: bunlar "Ciro (₺)" gibi JSX metinleri, kod değil.
`importdenetle` → `C`, `labelStyle`, `Personel`, `Dashboard`, `Finans`: aynı şekilde metin.
Bu adların dışında bir uyarı çıkarsa gerçek hatadır.
