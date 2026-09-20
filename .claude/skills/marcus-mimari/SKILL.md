---
name: marcus-mimari
description: Marcus OS'ta yeni bir uç, action, modül ya da yetenek eklerken izlenecek yapı. 12 serverless fonksiyon sınırı ve hangi uca ekleneceği, action anatomisi, lib/ ile src/ ve api/ arasındaki sınır, kuralın neden saf modüle yazılması gerektiği, hangi belgelerin güncelleneceği. Yeni uç, yeni action, yeni modül, yeni yetenek ya da mimari bir karar gerektiğinde yüklenir.
---

# Marcus Mimari — yeni yetenek nereye eklenir

Bu skill **prosedür** taşır: sıra, karar noktaları ve tuzaklar. Kuralların kendisi
`CLAUDE.md`'de ve alan skill'lerinde; burada tekrarlanmıyor, işaret ediliyor.

---

## 1 · Katmanlar ve aralarındaki sınır

```
src/     React arayüzü — Vite ile derlenir. Node'dan İMPORT EDİLEMEZ (.jsx)
api/     Vercel serverless — HER DOSYA BİR FONKSİYON, 12 sınırı burada
lib/     Saf ortak mantık — hem api/ hem src/ buradan import eder, FONKSİYON SAYILMAZ
testler/ Testler ve statik denetimler
```

Şu an **11 uç / 51 lib modülü** var. Oran tesadüf değil: yeni yetenek `lib/`'e yazılır,
uç yalnızca onu çağırır.

## 2 · Yeni dosya AÇMADAN önce — 12 sınırı

`api/` altına yeni bir `.js` koymak bir Vercel Hobby fonksiyonu harcar ve **11/12 dolu.**
Kural `CLAUDE.md` §1'de; burada yalnızca **ne yapılacağı**:

**Yeni uç açma. Mevcut bir uca `action` ekle.** Yerleşmiş üç dağıtıcı:

| Uç | Ne taşır | Dağıtıcı |
|---|---|---|
| `api/data.js` (2370 satır) | Belgenin okunması/yazılması, giriş, Drive yükleme, video akışı | `driveAction`, `authAction`, `ortakAction` |
| `api/paylasim.js` (1124 satır) | Fark bildiren işlemler — plan, stok, şube, ücret | `action` (19 tane) |
| `api/daily-reminders.js` | Gece koşan her şey | cron ucu, yeni zamanlanmış iş buraya |

Hangisine ekleneceğinin ölçüsü **veriye ne yaptığı**: belgenin tamamını yazıyorsa `data.js`,
bir FARK bildiriyorsa (`stoğu bir artır`, `plan ekle`) `paylasim.js`.

`lib/` altına istediğin kadar dosya koyabilirsin — sayılmıyor.

## 3 · `api/paylasim.js`'e action eklerken — dört soru

Bu ucun mevcut 19 action'ı: `cekimSirasiKaydet` · `driveEslestir` · `driveStokUygula` ·
`gunlukToggle` · `haftalikAltMetin` · `haftalikEkle` · `haftalikSil` · `haftalikToggle` ·
`kartsizdanKartAc` · `markaTemelUcret` · `stokDegistir` · `stokDuzelt` · `subeEkle` ·
`subeSil` · `subeStokDegistir` · `subeUcret` · `uyelikEkle` · `uyelikGuncelle` · `uyelikSil`

Yeni bir tane eklerken sırayla:

1. **Marka hangi alandan çözülecek?** Uç, isteğin `clientId` / `planId` / `subeId` /
   `uyelikId` / `uyelik.clientId` alanlarından hedefin markasını buluyor ve kural
   **fail-close**. Yeni action'ın alanı bu listeye eklenmezse **marka kilitli hesap o işlemi
   kendi markasında bile yapamaz.** Ayrıntı → `marcus-yetki`.
2. **Tekrar gönderilirse iki kez uygulanır mı?** Fark bildiren her action `islemId`
   istiyor. Kural `CLAUDE.md` §2'de. Yan etkiler (e-posta, Drive taşıma, güvenlik defteri)
   `tekrarlandi` dalında **çalıştırılmamalı**.
3. **Hangi alanlara yazıyor?** `degisenAlanlar` yalnızca gerçekten dokunulanları saymalı;
   fazladan alan bildirmek aynı anda çalışan herkesi 409'a düşürür.
4. **Yalnızca yönetici mi yapabilmeli?** Fiyat/ödeme yazan her action 403 ile korunuyor
   (`subeUcret`, `markaTemelUcret` örneği). "Stok işaretlemeye yeten izin fiyat belirlemeye
   yetmez."
5. **Yanıtta YENİ bir alan mı dönüyor?** Dönüyorsa `src/App.jsx`'teki `BELGE_DISI_ALANLAR`
   listesine eklenmeli. Yanıt gövdesi `setData` içine olduğu gibi yayılıyor; listede olmayan
   alan **belgeye sızar** ve sonraki kayıtta Redis'e yazılır (`eslestirme` ve `duzeltildi`
   bunu yaşadı). Ayrıca uç yanıtı **döndürmek zorunda** — çıplak `return` yüzünden tarama
   başarılı olsa bile ekranda "taranamadı" yazıyordu. **Denetim 21** ikisini de zorluyor.

## 4 · Kuralı JSX'e GÖMME — bu projede dört kez maliyet oldu

Bir görünürlük ya da hesap kuralı JSX içine yazılırsa **Node'dan çağrılamaz**, yani hiçbir
test onu sınayamaz. Bu sınıftan dört hata çıktı ve hepsi ancak sahada görüldü:

- `job.editliDosyaLink &&` — pano önizlemesi; `panoOnizlemesiVarMi` saf modüle taşındı
- `kartTuru` — `paylasimTuru`'nun ikinci, ayrışmış kopyası; silindi
- Ödeme hesabı `src/tema.jsx`'teydi, **hiçbir testte çağrılamıyordu** → `lib/odeme-hesabi.js`
- `onAltMetin` prop bağlantısı — hâlâ ölçülemiyor, bilinen boşluk

**Kural:** yeni bir görünürlük/hesap kuralı yazarken onu `lib/` altında saf bir fonksiyona
koy, JSX yalnızca çağırsın. `.jsx` içindeki hesap ancak esbuild hilesiyle teste açılabiliyor
(`testler/t107.mjs` yöntemi) — bu bir çözüm değil, telafi.

## 5 · Saf modül yazarken

Saf fonksiyon verilen veriyi **değiştirmez**, yenisini döndürür. Dönüş değerini atmak
(`siraliGruplar(gruplar, sira);`) hiçbir şey yapmaz ama bir şey yapıyormuş gibi durur —
**denetim 24** bunu yakalıyor. Saflık listesi `MARCUS-OS-SISTEM.md`'deki `(**saf**)`
işaretinden okunur ve yeni saf modül oraya eklenir.

## 6 · Bitirmeden önce — belge zorunlulukları

| Ne eklediysen | Nereyi güncelle |
|---|---|
| Yeni uç, modül, ortam değişkeni, zamanlanmış iş | `MARCUS-OS-SISTEM.md` — **denetim 18 zorluyor** |
| `api/` dosya sayısı değiştiyse | `CLAUDE.md` + **denetim 19** sabiti |
| Yazma/kilit, rol/izin, aşama/stok davranışı | `CLAUDE.md` (ya da ilgili skill) |
| Hata düzeltmesi, yeni test, arayüz değişikliği | `README.md` |

Sonra `/dogrula`, sonra `/olc`, sonra `/yayinla`.
