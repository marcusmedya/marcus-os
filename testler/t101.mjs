/* GİRİŞ DEFTERİ — TEK ŞİFREYLE AÇILAN OTURUMUN İZİ OLMALI
 *
 * BULUNAN BOŞLUK: "giris-basarili" kaydı YALNIZCA iki adımlı doğrulamanın açık olduğu
 * yolda düşülüyordu. Yani defter tam da riskli girişleri kaçırıyordu:
 *
 *   OWNER_EMAIL / RESEND_API_KEY tanımsız  -> kod adımı atlanır, oturum açılır, DEFTERDE İZ YOK
 *   kod e-postası gönderilemez             -> kod adımı atlanır, oturum açılır, iz yalnızca
 *                                             "şifre doğruydu" der, atlandığını söylemez
 *
 * Bu proje bugün tam olarak ikinci hâlde (Resend alan adı doğrulanmamış). Yani ikinci
 * faktör fiilen kapalı ve bunun hiçbir kaydı yoktu.
 *
 * GİRİŞ DAVRANIŞI DEĞİŞMEDİ — kilitlenme riski üretmemek için fail-open korundu; eklenen
 * şey yalnızca KAYIT ve ekrandaki uyarı. Bu testin işi, kaydın gerçekten düştüğünü ölçmek.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";
delete process.env.OWNER_EMAIL;
delete process.env.RESEND_API_KEY;

import { kv } from "@vercel/kv";
import { cagir, TEMIZ_VERI } from "./denetim.mjs";
import { defteriOku } from "../lib/kv-yaz.js";
const { default: veriUcu } = await import("../api/data.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const giris = (sifre) => cagir(veriUcu, {
  method: "POST", query: {}, headers: { "content-type": "application/json" },
  body: { authAction: "girisBasla", sifre },
});

await bolum("1) İKİ ADIMLI KAPALIYKEN GİRİŞ DEFTERE YAZILIYOR", 5, async () => {
  await kv.set("marcus-os-data", TEMIZ_VERI());
  await kv.set("marcus-os-guvenlik-defteri", []);
  const r = await giris("ownerpw");
  t("giriş yine çalışıyor", r.kod === 200 && r.govde.ok === true,
    "fail-open bilerek korundu; kilitlenme riski üretilmemeli. gelen: " + r.kod);
  t("kod adımı atlandı", r.govde.kodGerekli === false);
  t("EKRANDA uyarı var", typeof r.govde.uyari === "string" && r.govde.uyari.length > 0,
    "ikinci adımın kapalı olduğu sessiz kalmamalı");
  const defter = await defteriOku();
  const kayit = defter.find((x) => x.olay === "giris-basarili");
  t("DEFTERE yazıldı", Boolean(kayit), "tek şifreyle açılan oturumun izi olmalı: " + JSON.stringify(defter));
  t("kaydın kendisi 'iki adım kapalıydı' diyor", kayit && kayit.ikiAdimli === false,
    JSON.stringify(kayit));
});

await bolum("2) HATALI ŞİFRE HÂLÂ REDDEDİLİYOR VE KAYDEDİLİYOR", 3, async () => {
  await kv.set("marcus-os-guvenlik-defteri", []);
  const r = await giris("yanlis");
  t("reddedildi", r.kod === 401, "gelen: " + r.kod);
  t("oturum anahtarı verilmedi", !r.govde.token);
  const defter = await defteriOku();
  t("başarısız giriş deftere yazıldı", defter.some((x) => x.olay === "giris-basarisiz"));
});

/* Eski ortak personel şifresi üç uçta düz `===` ile karşılaştırılıyordu; `esitMi`
 * (sabit süreli) ile değiştirildi.
 *
 * BU BÖLÜM ZAMANLAMA GÜVENLİĞİNİ ÖLÇMEZ — ölçüldü: düz `===`'e geri dönüldüğünde hiçbir
 * kontrol düşmüyor, çünkü iki yöntem DAVRANIŞ olarak aynı; fark yalnızca geçen sürede ve
 * bunu bir birim testinde güvenilir ölçmek mümkün değil. Bu bölümün işi başka: karşılaştırma
 * yöntemi değişirken KURALIN değişmediğini sabitlemek — doğru şifre geçmeye devam ediyor,
 * yanlış/boş/farklı uzunluktaki şifre reddediliyor. Sessiz bir kilitlenme ya da sessiz bir
 * açılma olsaydı buradan düşerdi. */
await bolum("3) ESKİ PERSONEL ŞİFRESİ: KURAL DEĞİŞMEDİ", 4, async () => {
  process.env.STAFF_PASSWORD = "staffpw";
  await kv.set("marcus-os-data", TEMIZ_VERI());
  const { default: paylasimUcu } = await import("../api/paylasim.js");
  const istek = (sifre) => cagir(paylasimUcu, {
    method: "POST", query: {}, headers: { "x-site-password": sifre },
    body: { action: "gunlukKontrol", clientId: 1, gun: "Pzt" },
  });
  const dogru = await istek("staffpw");
  t("doğru şifre yetkisiz DEĞİL", dogru.kod !== 401, "gelen: " + dogru.kod);
  const yanlis = await istek("staffpx");
  t("yanlış şifre reddediliyor", yanlis.kod === 401, "gelen: " + yanlis.kod);
  const bosSifre = await istek("");
  t("boş şifre reddediliyor", bosSifre.kod === 401, "gelen: " + bosSifre.kod);
  const uzunluk = await istek("staffpwstaffpw");
  t("farklı uzunlukta şifre reddediliyor", uzunluk.kod === 401, "gelen: " + uzunluk.kod);
  delete process.env.STAFF_PASSWORD;
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
