/* KARTA YÜKLENEN DOSYA GÖRÜNMÜYOR — İKİ AYRI SEBEP
 *
 * ŞİKÂYET: "kart açtığımızda ve görsel ya da video yüklediğimizde kartta önizleme
 * gözükmüyor ama Drive'a yükleme yapılıyor."
 *
 * SEBEP 1 — ÖNİZLEME ÖNBELLEĞİ HİÇ GEÇERSİZ KILINMIYORDU.
 * Anahtar `is:<kartId>:<slot>:<boyut>` idi; içerikle ilgili hiçbir şey taşımıyordu.
 *   a) Kart açılınca henüz dosya yokken önizleme isteniyor, sunucu "yok" diyor. Kullanıcı
 *      dosyayı yüklüyor. Anahtar değişmediği için istek BİR DAHA HİÇ yapılmıyor — dosya
 *      Drive'da duruyor, kartta sayfa yenilenene kadar hiç görünmüyor.
 *   b) Aynı slota yeni versiyon yüklenince önbellekteki ESKİ görsel dönüyor.
 *
 * SEBEP 2 — ARKA PLAN TAZELEMESİ YÜKLEMENİN ÜSTÜNE YAZIYORDU.
 * Uygulama 25 saniyede bir sunucudaki veriyi çekip yerel duruma yazıyor. Tek koruması
 * "bekleyen bir KAYIT var mı" idi. Dosya yüklemek bir kayıt değil: baytlar doğrudan
 * Google'a gidiyor ve dakikalarca sürebiliyor. Üstelik dosya seçme penceresi kapanınca
 * `focus` olayı da aynı tazelemeyi tetikliyor — yani HER yüklemenin başında bir tane.
 */
import {
  onizlemeAnahtari, onizlemeOku, onizlemeYaz, onizlemeyiTazele,
  tazelemeyiDinle, bellegiBosalt, bellekBoyutu, dinleyiciSayisi,
} from "../lib/onizleme-bellegi.js";
import {
  isBasladi, isBitti, surenIsVarMi, surenIsSayisi, surenleriSifirla,
} from "../lib/suren-isler.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* ---------------------------------------------------------------- */
console.log("\n1) ÖNBELLEK ANAHTARI");

bellegiBosalt();
t("kart + slot + boyut ayrı anahtar üretiyor",
  onizlemeAnahtari({ isId: 10, slot: "1", boyut: 200 }) !== onizlemeAnahtari({ isId: 10, slot: "2", boyut: 200 }));
t("aynı kartın farklı boyutları ayrışıyor",
  onizlemeAnahtari({ isId: 10, slot: "1", boyut: 200 }) !== onizlemeAnahtari({ isId: 10, slot: "1", boyut: 800 }));
t("müşteri içeriği kart anahtarıyla karışmıyor",
  onizlemeAnahtari({ icerikId: 10 }) !== onizlemeAnahtari({ isId: 10 }));
t("kimliksiz çağrı anahtar üretmiyor", onizlemeAnahtari({}) === null);

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — kart açıkken yüklenen dosya görünüyor mu");

bellegiBosalt();
{
  /* Kart açıldı, dosya henüz yok: sunucu "yok" dedi, önbelleğe bir şey yazılmadı.
   * Bileşen isteği yalnızca anahtarı değişince ya da tazeleme gelince tekrarlar. */
  const anahtar = onizlemeAnahtari({ isId: 42, slot: "1", boyut: 800 });
  t("dosya yokken önbellekte bir şey yok", onizlemeOku(anahtar) === null);

  let yenidenIstendi = 0;
  const birak = tazelemeyiDinle((isId) => { if (String(isId) === "42") yenidenIstendi += 1; });

  /* Kullanıcı dosyayı yükledi. */
  onizlemeyiTazele(42);
  t("yükleme sonrası önizleme YENİDEN isteniyor", yenidenIstendi === 1,
    "eski kodda bu hiç olmuyordu — dosya sayfa yenilenene kadar görünmüyordu");

  /* Şimdi sunucu görseli döndürdü. */
  onizlemeYaz(anahtar, "data:image/jpeg;base64,AAA");
  t("görsel önbelleğe girdi", onizlemeOku(anahtar) === "data:image/jpeg;base64,AAA");

  /* Aynı slota YENİ VERSİYON yüklendi — eski görsel kalmamalı. */
  onizlemeyiTazele(42);
  t("yeni versiyon eski görseli düşürüyor", onizlemeOku(anahtar) === null,
    "düşmezse kullanıcı oturum boyunca eski dosyayı görürdü");
  t("yeni versiyonda da yeniden isteniyor", yenidenIstendi === 2);
  birak();
  t("dinleyici bırakılıyor", dinleyiciSayisi() === 0, "sökülen bileşen sızmasın");
}

/* ---------------------------------------------------------------- */
console.log("\n3) TAZELEME YALNIZCA KENDİ KARTINI ETKİLİYOR");

bellegiBosalt();
{
  onizlemeYaz(onizlemeAnahtari({ isId: 1, slot: "1", boyut: 200 }), "bir");
  onizlemeYaz(onizlemeAnahtari({ isId: 1, slot: "2", boyut: 200 }), "iki");
  onizlemeYaz(onizlemeAnahtari({ isId: 2, slot: "1", boyut: 200 }), "uc");
  onizlemeYaz(onizlemeAnahtari({ icerikId: 9 }), "musteri");
  t("dört kayıt var", bellekBoyutu() === 4);

  const silinen = onizlemeyiTazele(1);
  t("1 nolu kartın İKİ slotu da düştü", silinen === 2, "silinen: " + silinen);
  t("2 nolu kart etkilenmedi", onizlemeOku(onizlemeAnahtari({ isId: 2, slot: "1", boyut: 200 })) === "uc");
  t("müşteri içeriği etkilenmedi", onizlemeOku(onizlemeAnahtari({ icerikId: 9 })) === "musteri");

  let baskaKartUyandiMi = false;
  const birak = tazelemeyiDinle((isId) => { if (String(isId) === "2") baskaKartUyandiMi = true; });
  onizlemeyiTazele(1);
  birak();
  t("başka kartlar boşuna istek atmıyor", baskaKartUyandiMi === false,
    "panoda 30 kart var; hepsi birden isterse kaba kuvvet koruması kullanıcıyı kilitliyor");
}
{
  /* Bir dinleyici patlarsa diğerleri çalışmalı — biri yüzünden kart güncellenmeden kalmasın. */
  bellegiBosalt();
  let ikinciCalisti = false;
  const b1 = tazelemeyiDinle(() => { throw new Error("patladı"); });
  const b2 = tazelemeyiDinle(() => { ikinciCalisti = true; });
  onizlemeyiTazele(7);
  b1(); b2();
  t("bir dinleyicinin hatası diğerlerini durdurmuyor", ikinciCalisti === true);
}
t("kimliksiz tazeleme sessizce geçiyor", onizlemeyiTazele(null) === 0 && onizlemeyiTazele(undefined) === 0);

/* ---------------------------------------------------------------- */
console.log("\n4) SÜREN YÜKLEME — arka plan tazelemesi üstüne yazmıyor");

surenleriSifirla();
t("boştayken tazeleme serbest", surenIsVarMi() === false);

isBasladi("medya-yukleme-42");
t("yükleme sürerken tazeleme DURUYOR", surenIsVarMi() === true,
  "durmazsa 25 sn'de bir kartlar sunucudaki hâliyle değişiyordu");

isBasladi("medya-silme-13");
t("iki iş birden sayılıyor", surenIsSayisi() === 2);

isBitti("medya-yukleme-42");
t("biri bitince diğeri hâlâ koruyor", surenIsVarMi() === true, "yarım kalan işi açıkta bırakma");

isBitti("medya-silme-13");
t("hepsi bitince tazeleme geri açılıyor", surenIsVarMi() === false,
  "açılmazsa bu sefer ters hata: veri hiç tazelenmez");

/* Aynı iş iki kez başlatılırsa sayaç şişmemeli — yoksa bir "bitti" yetmez. */
isBasladi("ayni-is");
isBasladi("ayni-is");
isBitti("ayni-is");
t("aynı iş iki kez başlarsa tek sayılıyor", surenIsVarMi() === false, "kimlik bazlı, sayaç bazlı değil");

/* ---------------------------------------------------------------- */
console.log("\n5) ASILI KALMA FRENİ — bileşen sökülürse tazeleme sonsuza kadar kapanmasın");

surenleriSifirla();
isBasladi("unutulan-is");
t("iş yeni başladıysa koruma sürüyor", surenIsVarMi(Date.now() + 60 * 1000) === true);
t("10 dakika sonra kendiliğinden düşüyor", surenIsVarMi(Date.now() + 11 * 60 * 1000) === false,
  "düşmezse 'bitti' hiç gelmeyen bir iş tazelemeyi oturum boyunca kilitlerdi");
t("zaman aşımına uğrayan kayıt temizlendi", surenIsSayisi() === 0);

/* ---------------------------------------------------------------- */
console.log("\n6) BAĞLANTI YERİNDE Mİ — modüller doğru yerlerden çağrılıyor mu");

/* Yukarıdaki testler modüllerin DAVRANIŞINI sınıyor. Ama modül doğru çalışsa da
 * çağrılmazsa hata sürer. React'i burada çizemediğimiz için bağlantı kaynaktan
 * doğrulanıyor — davranış testinin yerine değil, YANINA. */
const { readFileSync } = await import("fs");
const oku = (yol) => readFileSync(new URL(yol, import.meta.url), "utf8");

const app = oku("../src/App.jsx");
const yenilemeGovdesi = app.slice(app.indexOf("const veriyiYenile ="), app.indexOf("const veriyiYenile =") + 900);
t("veriyiYenile süren işi kontrol ediyor", yenilemeGovdesi.includes("surenIsVarMi()"),
  "kontrol etmezse 25 sn'lik tazeleme yüklemenin üstüne yazar");
t("kontrol fetch'ten ÖNCE yapılıyor",
  yenilemeGovdesi.indexOf("surenIsVarMi()") < yenilemeGovdesi.indexOf("fetch("),
  "sonra olsaydı istek yine de gider ve sonuç yine yazılırdı");

const takip = oku("../src/CekimEditTakibi.jsx");
t("yükleme başlangıcı işaretleniyor", takip.includes("isBasladi(isKimligi)"));
t("bitiş finally içinde", /finally \{\s*\n\s*isBitti\(isKimligi\);/.test(takip),
  "hata olursa da bırakılmalı, yoksa tazeleme kilitli kalır");
t("yükleme sonrası önizleme tazeleniyor", takip.includes("onizlemeyiTazele(job.id)"));

const surucu = oku("../src/drive.jsx");
t("kanca ortak önbelleği kullanıyor", surucu.includes("onizlemeOku(anahtar)") && !surucu.includes("onizlemeBellegi"),
  "kendi Map'ini tutarsa tazeleme ona ulaşmaz");
t("tazeleme sayacı istek bağımlılıklarında", /tazeleme\]\)/.test(surucu),
  "bağımlılıkta değilse önbellek silinse bile istek tekrarlanmaz");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
