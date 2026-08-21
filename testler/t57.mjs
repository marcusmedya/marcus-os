/* MODÜL DÜZEYİNDE İSTEK VERİSİ — EŞ ZAMANLI İSTEKLER BİRBİRİNİN CEVABINI BOZUYOR
 *
 * BULGU: api/manage-staff.js, yazılan sürüm numarasını modül düzeyinde bir değişkende
 * (`sonYazilanSurum`) tutuyordu. Serverless fonksiyon örneği eş zamanlı istekleri aynı
 * süreçte karşılayabilir (Vercel'in güncel çalışma modeli böyle) — yani modül kapsamı
 * istek başına DEĞİL, süreç genelinde paylaşılan bir hafızadır.
 *
 * KAYIP NASIL OLUYOR: A hesabı kaydediyor, sürümü modül değişkenine yazıyor, sonra
 * güvenlik defterine not düşmek için AWAIT ediyor. Tam o boşlukta B'nin isteği baştan
 * sona çalışıp aynı değişkeni eziyor. A uyandığında B'nin sürüm numarasını kendi
 * cevabına koyuyor.
 *
 * SONUCU: A'nın tarayıcısı yanlış sürümle kalıyor. Dosyanın kendi yorumunda yazdığı gibi,
 * yanlış sürüm bir sonraki kayıtta SAHTE çakışma üretiyor ve ön yüz kullanıcının o anki
 * düzenlemesini sunucu verisiyle EZİYOR. Yani bu, doğrudan veri kaybı üreten bir yol.
 *
 * BU TEST ARAYI DETERMİNİSTİK AÇIYOR: A'nın defter yazması bir söz (promise) ile
 * bekletiliyor, o sırada B baştan sona çalıştırılıyor.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "4";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: personelUcu } = await import("../api/manage-staff.js");

await kv.flushall();
await kv.set(KEY, { _v: 7, clients: [], cekimIsleri: [], personelHesaplari: [], musteriHesaplari: [] });

/* A'yı güvenlik defterine yazarken durdurabilmek için kv.set araya alınıyor. */
let defterBekletici = null;
const asilSet = kv.set.bind(kv);
kv.set = async (anahtar, ...kalan) => {
  if (String(anahtar).includes("guvenlik-defteri") && defterBekletici) {
    const bekle = defterBekletici;
    defterBekletici = null;              // yalnızca İLK deftere yazan (A) bekletilir
    await bekle;
  }
  return asilSet(anahtar, ...kalan);
};

const hesapEkle = (kullaniciAdi) => cagir(personelUcu, {
  method: "POST", headers: OWNER, query: {},
  body: { action: "ekle", ad: kullaniciAdi, kullaniciAdi, sifre: "1234" },
});

console.log("\n1) A yazarken B araya giriyor");

let cozumle;
defterBekletici = new Promise((coz) => { cozumle = coz; });

const aSozu = hesapEkle("a-kullanici");      // A başlıyor, deftere yazarken duracak
await new Promise((coz) => setTimeout(coz, 60));   // A'nın oraya gelmesini bekle

const bYanit = await hesapEkle("b-kullanici");     // B baştan sona çalışıyor
cozumle();                                          // A serbest
const aYanit = await aSozu;

kv.set = asilSet;

const aV = aYanit.govde && aYanit.govde._v;
const bV = bYanit.govde && bYanit.govde._v;
const sonHal = await kv.get(KEY);

t("iki istek de başarılı", aYanit.kod === 200 && bYanit.kod === 200);
t("iki hesap da yazıldı", (sonHal.personelHesaplari || []).length === 2,
  "gelen: " + (sonHal.personelHesaplari || []).length);

t("A ile B AYNI sürümü almıyor", aV !== bV, `A=${aV} B=${bV}`);
t("A kendi yazdığı sürümü alıyor", aV === 8, "A ilk yazan — beklenen 8, gelen: " + aV);
t("B kendi yazdığı sürümü alıyor", bV === 9, "B ikinci yazan — beklenen 9, gelen: " + bV);
t("sunucudaki son sürüm doğru", sonHal._v === 9, "gelen: " + sonHal._v);

console.log("\n2) Modül kapsamında istek verisi tutulmuyor");

/* Yapısal kontrol: bu dosyanın bir daha modül düzeyinde istek verisi tutmaması için.
 * Kaynak metnine bakan tek kontrol bu — yukarıdaki davranış testinin yanında,
 * aynı hatanın sessizce geri gelmesini engelleyen bir çit. */
const { readFileSync } = await import("fs");
const kaynak = readFileSync(new URL("../api/manage-staff.js", import.meta.url), "utf8");
const modulDurumu = kaynak.split("\n").filter((s) => /^(let|var)\s/.test(s));
t("modül düzeyinde değiştirilebilir durum yok", modulDurumu.length === 0,
  modulDurumu.join(" | ") || "temiz");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
