# Marcus OS

Marcus Medya'nın (sosyal medya ajansı) iç operasyon uygulaması. Tek kişilik bir
ekip tarafından değil, **ajansın kendi personeli, çözüm ortakları ve müşterileri**
tarafından aynı anda kullanılıyor. Kod ve arayüz **tamamen Türkçe** — değişken ve
fonksiyon adları dahil. Yeni kod da Türkçe yazılır.

Bu dosya her oturumun başında otomatik okunur. Uzun anlatım burada değil, aşağıdaki
belgelerde — bu dosya yalnızca "bilmeden dokunulursa bir şey kırılır" bilgisini taşır.

---

## Sistemi bir cümlede

React SPA + Vercel serverless fonksiyonları + Upstash Redis. **Tüm uygulama verisi
TEK bir JSON belgesi** olarak `marcus-os-data` anahtarında duruyor.

```
src/         React arayüzü (Vite ile derlenir)
api/         Vercel serverless fonksiyonları — HER DOSYA BİR FONKSİYON
lib/         Ortak mantık — hem api/ hem src/ buradan import eder, fonksiyon SAYILMAZ
testler/     56 test dosyası (t1…t56) + 18 statik denetim betiği
```

---

## SERT SINIRLAR — bunları bilmeden değişiklik yapma

### 1. Vercel Hobby: en fazla 12 serverless fonksiyon. Şu an 11 kullanılıyor.

`api/` altına yeni bir `.js` dosyası eklemek bir fonksiyon harcar. **Yeni yetenek
eklerken yeni dosya AÇMA** — mevcut bir uca yeni bir `action` ekle. Örnek:
`api/data.js` içindeki `driveAction`, `authAction`, `ortakAction` bu yüzden var.
`lib/` altındaki dosyalar sayılmaz, oraya istediğin kadar dosya koyabilirsin.

### 2. Tüm veri tek belgede — yazma sırası kritik

`lib/kv-yaz.js` bu işin merkezi:

- **`guvenliGuncelle(degistir)`** — oku → değiştir → yaz döngüsünün tamamını kilit
  altında yapar. Yazma yapan neredeyse her yer bunu kullanmalı.
- **Kendi kilidini alır.** Bu yüzden **açık bir kilidin içinden ASLA çağrılmaz.**
- **Kilit alınamazsa yazılmaz** — istek `503` + `mesgul: true` ile reddedilir.
  Tarayıcı (`lib/mesgul-tekrar.js`) kendiliğinden tekrar dener. Bu yanıt hiçbir şey
  yazılmadan ÖNCE döndüğü için tekrar göndermek güvenlidir.
- **Alan bazlı sürüm sayaçları (`_alanSurumleri`).** Her üst düzey alanın kendi
  sayacı var. İstemci yalnızca DOKUNDUĞU alanları `degisenAlanlar` ile bildirir;
  sunucu yalnızca onların sayacına bakar ve yalnızca onları yazar. Tek genel bir
  sayaca dönmek, üç kişi aynı anda çalıştığında sistemi kilitler — bu yaşandı.
- **Stok sunucu otoritesidir.** Tarayıcının gönderdiği stok kopyası kullanılmaz;
  taban her zaman sunucudaki `stoklar` alanıdır.

### 3. Google Drive — iki ayrı kimlik, ikisi de eksik yetkili

- **Servis hesabı**: tam `drive` yetkisi var ama **depolama kotası yok** — klasör
  oluşturabilir, dosya taşıyabilir, **yükleyemez**.
- **OAuth**: `drive.file` kapsamı — yalnızca uygulamanın kendi oluşturduğu
  dosyaları görür.
- **Çöpe atmak sahiplik ister**, düzenleme yetkisi yetmez. Bu yüzden silme
  OAuth-önce / servis hesabı-sonra sırasıyla denenir.

### 4. Roller ve paneller senkron olmak zorunda

`owner` (yönetici) · `staff` (personel) · çözüm ortağı (marka kilitli personel) ·
`musteri` (müşteri paneli).

Müşteri ve çözüm ortağı görünümünün **tek kaynağı `lib/musteri-gorunumu.js`**.
Aynı kuralı iki yere yazmak bu projede zaten bir kez panel senkron hatasına yol
açtı. Bir davranış değiştiğinde personel ve çözüm ortağı panellerini de kontrol et
— kullanıcının açık talimatı bu.

Çözüm ortağı paneli = müşteri paneli eksi "İçerik İste" sekmesi
(`ORTAGA_KAPALI_SEKMELER`), artı kendisine atanan markaların paylaşım/stok panelleri.

### 5. Aşamalar ve medya yuvaları

`lib/asamalar.js` aşama tablolarının **tek** sahibi (Video / Fotoğraf / Tasarım).
Sunucu, istemciden gelen aşamayı doğrular; listede olmayan aşama `asamalariDuzelt`
ile onarılır. Bir kartta en fazla 10 slayt + 1 story yuvası olabilir.

### 6. Stok kuralları — `lib/stok.js`

Türler: Görsel · Video · Reels · Story · Carousel · Tasarım.
Kart onaylanınca ilgili türün stoğu artar; kart silinince veya "Tamamlandı"ya
geçince düşer. Toplu kayıp freni var (`TOPTAN_KAYIP_SINIRI`).

---

## Çalıştırma ve doğrulama

```bash
bash testler/hepsinidenetle.sh     # 17 statik denetim (sözdizimi, JSX, hook, kapsam…)
./testler/sunucutestleri.sh        # t1…t56, ~1029 kontrol — SAHTE veritabanı kullanır
npm run build                      # üretim derlemesi
ls api/*.js | wc -l                # 12'yi GEÇMEMELİ
```

`sunucutestleri.sh`, `@vercel/kv` paketini geçici olarak `testler/taklit-kv` ile
değiştirir ve `trap` ile geri koyar. **Testler gerçek Redis'e asla dokunmaz.**

### Test disiplini — bu projede zorunlu

Bir düzeltme yaptıktan sonra **korumayı geri koyup kaç kontrolün düştüğünü ölç.**
"Test geçti" tek başına hiçbir şey söylemiyor: bu projede daha önce, iddia ettiği
şeyi hiç sınamayan testler yazıldı ve geçtiler. Kaynak metnine bakan test yazma,
**davranışı** sına.

---

## Asla yapılmayacaklar

- **Drive paylaşımını "bağlantıya sahip herkes"e açma.** Kapatıldı, kapalı kalacak.
- **Kullanıcının canlı Drive'ından kalıcı silme.** Çöpe taşı, kalıcı silme.
- **Servis hesabı özel anahtarını sohbete yazdırma.** Gerekirse dosya olarak ver.
- **Üretim verisini silme/değiştirme.** Testler sahte veritabanı kullanır.
- **Test geçsin diye gerçek sorunu gizleyen çözüm üretme.**
- **Gereksiz refactor ve UI/UX değişikliği.** İstenmeden arayüz değiştirilmez.

---

## Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `SITE_PASSWORD` | Yönetici girişi. **Tanımsızsa kimse giremez** (bilerek — eskiden tam tersiydi ve herkes yönetici oluyordu). |
| `STAFF_PASSWORD` | Eski ortak personel şifresi (opsiyonel) |
| `CRON_SECRET` | Gece yedeği ve günlük hatırlatma uçlarını korur |
| `OWNER_EMAIL`, `RESEND_API_KEY` | İki adımlı doğrulama |
| `BACKUP_EMAIL` | Gece yedeğinin gittiği adres(ler), virgülle ayrılır |
| `KILIT_DENEME` | Yazma kilidi deneme sayısı (varsayılan 12, en fazla 40) |

Hangi ortamda hangi değişkenin eksik olduğu **Ayarlar → Güvenlik** ekranında
yazıyor (Canlı / Önizleme / Geliştirme ayrı ayrı). Değerler tarayıcıya gitmez,
yalnızca var/yok bilgisi.

---

## Derine inmek gerekirse

| Belge | İçerik |
|---|---|
| `README.md` (3955 satır) | Sürüm sürüm tüm değişiklik geçmişi ve gerekçeleri |
| `MARCUS-OS-DEVIR-RAPORU.md` | Sistem devir raporu — mimari, kurulum, ortam |
| `MARCUS-OS-DEVIR-2.md` | İkinci devir notları |
| `MARCUS-OS-TANITIM.md` | Uygulamanın iş tarafından anlatımı |

En büyük dosyalar: `src/App.jsx` (9243), `src/CekimEditTakibi.jsx` (2576),
`api/data.js` (1882), `src/musteriPaneli.jsx` (1377).
