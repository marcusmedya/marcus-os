/* KİLİT ALINAMAYINCA NE OLUYOR — H-2 BULGUSU
 *
 * BULGU: `kilitAl()` 12 denemede kilidi kapamazsa `false` dönüyordu; AMA çağıran dört
 * yerin DÖRDÜ DE bu sonucu yok sayıp yazmaya devam ediyordu. Yani sistem, korumaya en çok
 * ihtiyaç duyulan anda korumayı bırakıyordu: kilidin kapılamadığı an, zaten çok sayıda
 * isteğin aynı anda yazmaya çalıştığı andır.
 *
 * SONUÇ: iki kişi aynı saniyede kaydettiğinde birinin işi sessizce siliniyordu. Hata
 * mesajı yoktu — bu yüzden "sistem beni geriye attı" değil, "yaptığım iş kaybolmuş"
 * şeklinde yaşanıyordu, yani fark edilmesi en zor kayıp türü.
 *
 * DÜZELTME: kilit alınamazsa YAZILMAZ; istek 503 ile reddedilir ve tarayıcı kendiliğinden
 * birkaç saniye sonra aynı isteği tekrar gönderir (lib/mesgul-tekrar.js).
 *
 * BU TEST NEYİ ÖLÇÜYOR: kilidi elle tutup her yazma ucunu tek tek deniyor ve SUNUCUDAKİ
 * VERİNİN DEĞİŞMEDİĞİNİ doğruluyor. "503 döndü" demek yetmez — asıl mesele hiçbir şeyin
 * yazılmamış olması.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";          // test saniyelerce beklemesin

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir, R } from "./denetim.mjs";
import { kilitAl, kilitBirak, guvenliGuncelle, mesgulYanit, MESGUL_KOD } from "../lib/kv-yaz.js";
import { tekrarDenemeyiKur, MESGUL_BEKLEMELERI } from "../lib/mesgul-tekrar.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KILIT_KEY = "marcus-os-yazma-kilidi";
const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");

const { default: veriUcu } = await import("../api/data.js");
const { default: paylasimUcu } = await import("../api/paylasim.js");
const { default: kasaUcu } = await import("../api/kasa.js");
const { default: personelUcu } = await import("../api/manage-staff.js");
const { default: odemeUcu } = await import("../api/client-payment.js");
const { default: yedekUcu } = await import("../api/backup.js");

const TEMEL = () => ({
  _v: 5,
  _alanSurumleri: { cekimIsleri: 2, stoklar: 1, clients: 1, personelHesaplari: 1, kasa: 1 },
  clients: [{ id: 1, ad: "VIZZ", odemeKayitlari: [] }],
  cekimIsleri: [{ id: 10, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels 1", asama: "Edit Bekliyor" }],
  stoklar: { "1_Reels": 4 },
  ownerKisiselSifreler: [], reklamlar: [], paylasimGecmisi: [], haftalikPaylasimlar: [],
  subeler: [], personelHesaplari: [], musteriHesaplari: [], musteriIcerikleri: [],
  kasaSifresiHash: null, kasaSifresiSalt: null,
});

async function sifirla() {
  await kv.flushall();
  await kv.set(KEY, TEMEL());
}
/* Kilidi BAŞKASI tutuyormuş gibi davran: nx yüzünden kilitAl artık asla kapamaz. */
const kilidiBaskasinaVer = () => kv.set(KILIT_KEY, Date.now());
const kilidiSerbestBirak = () => kv.del(KILIT_KEY);

/* ---------------------------------------------------------------- */
console.log("\n1) KİLİT MEKANİZMASININ KENDİSİ");

await sifirla();
t("kilit boşken alınıyor", (await kilitAl()) === true);
await kilitBirak(true);

await kilidiBaskasinaVer();
t("kilit başkasındayken alınamıyor", (await kilitAl()) === false);
await kilidiSerbestBirak();

/* Geçici Redis aksaklığı artık tüm denemeleri iptal etmiyor: eski kodda tek bir hata
 * `return false` yapıyor, sonrasında yazma yine de kilitsiz sürüyordu. */
{
  await sifirla();
  const asilSet = kv.set.bind(kv);
  let cagri = 0;
  kv.set = async (...a) => { cagri++; if (cagri === 1) throw new Error("gecici redis hatasi"); return asilSet(...a); };
  const sonuc = await kilitAl(3);
  kv.set = asilSet;
  t("geçici Redis hatası tüm denemeleri iptal etmiyor", sonuc === true, "1. deneme patladı, 2. deneme kapadı");
  await kilitBirak(true);
}

/* ---------------------------------------------------------------- */
console.log("\n2) guvenliGuncelle — kilit yoksa YAZMIYOR");

await sifirla();
await kilidiBaskasinaVer();
let cagrildiMi = false;
const gg = await guvenliGuncelle(() => { cagrildiMi = true; return { veri: { bozuk: true } }; });
await kilidiSerbestBirak();

t("kilit yokken ok:false dönüyor", gg.ok === false);
t("meşgul bayrağı var", gg.mesgul === true);
t("kod 503", gg.kod === 503 && MESGUL_KOD === 503);
t("değiştirme fonksiyonu HİÇ çalıştırılmıyor", cagrildiMi === false, "yarım kalmış iş olmasın");
t("veri hiç dokunulmadan duruyor", (await kv.get(KEY)).bozuk === undefined);

/* ---------------------------------------------------------------- */
console.log("\n3) mesgulYanit — tek biçim");

{
  const r = R();
  mesgulYanit(r);
  t("503 dönüyor", r.kod === 503);
  t("Retry-After başlığı var", r.basliklar["retry-after"] === "2");
  t("gövdede meşgul bayrağı var", r.govde && r.govde.mesgul === true);
  t("kullanıcıya KAYDEDİLMEDİĞİ açıkça söyleniyor",
    /KAYDEDİLMEDİ/.test((r.govde && r.govde.error) || ""),
    "belirsiz mesaj, kullanıcının işi kaybolduğunu gizler");
}

/* ---------------------------------------------------------------- */
console.log("\n4) ASIL MESELE — her yazma ucu kilit yokken veriyi DEĞİŞTİRMİYOR");

/* --- 4a) Yönetici kart kaydı (api/data.js) --- */
await sifirla();
await kilidiBaskasinaVer();
{
  const veri = TEMEL();
  veri.cekimIsleri = [{ ...veri.cekimIsleri[0], icerikTuru: "EZILEN KAYIT" }];
  const r = await cagir(veriUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { data: { ...veri, _v: undefined }, _v: 5,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: veri._alanSurumleri },
  });
  const sonHal = await kv.get(KEY);
  t("data.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("data.js: kart YAZILMAMIŞ", sonHal.cekimIsleri[0].icerikTuru === "Reels 1",
    "gerçek kayıp buradaydı: " + sonHal.cekimIsleri[0].icerikTuru);
  t("data.js: sürüm sayacı artmamış", sonHal._v === 5);
}

/* --- 4b) Paylaşım / stok (api/paylasim.js) --- */
{
  const r = await cagir(paylasimUcu, {
    method: "POST", headers: OWNER,
    body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 5 },
  });
  const sonHal = await kv.get(KEY);
  t("paylasim.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("paylasim.js: stok DEĞİŞMEMİŞ", sonHal.stoklar["1_Reels"] === 4, "gelen: " + sonHal.stoklar["1_Reels"]);
}

/* --- 4c) Personel hesabı (api/manage-staff.js) --- */
{
  const r = await cagir(personelUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { action: "ekle", ad: "Yeni", kullaniciAdi: "yeni", sifre: "1234" },
  });
  const sonHal = await kv.get(KEY);
  t("manage-staff.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("manage-staff.js: 500 DEĞİL (sebep doğru bildiriliyor)", r.kod !== 500);
  t("manage-staff.js: hesap eklenmemiş", (sonHal.personelHesaplari || []).length === 0);
}

/* --- 4d) Şifre kasası (api/kasa.js) --- */
{
  const r = await cagir(kasaUcu, {
    method: "POST", headers: OWNER,
    body: { action: "degistir", yeniSifre: "yenikasa" },
  });
  const sonHal = await kv.get(KEY);
  t("kasa.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("kasa.js: kasa şifresi değişmemiş", sonHal.kasaSifresiHash === null);
}

/* --- 4e) Müşteri ödeme kaydı (api/client-payment.js) --- */
{
  const r = await cagir(odemeUcu, {
    method: "POST", headers: OWNER,
    body: { action: "addKaydi", clientId: 1, kayit: { id: 1, tutar: 5000 } },
  });
  const sonHal = await kv.get(KEY);
  t("client-payment.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("client-payment.js: ödeme kaydı eklenmemiş",
    (sonHal.clients[0].odemeKayitlari || []).length === 0);
}

/* --- 4f) YEDEKTEN GERİ YÜKLEME — en tehlikelisi (api/backup.js) --- */
{
  await kv.set("marcus-os-snapshot-2020-01-01", { _v: 1, clients: [], cekimIsleri: [], ESKI: true });
  const r = await cagir(yedekUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { key: "marcus-os-snapshot-2020-01-01" },
  });
  const sonHal = await kv.get(KEY);
  t("backup.js: kilit yokken 503", r.kod === 503, "gelen: " + r.kod);
  t("backup.js: TÜM VERİ geri yüklenmemiş", sonHal.ESKI === undefined && sonHal.cekimIsleri.length === 1,
    "kilitsiz geri yükleme, o an kaydeden herkesin işini silerdi");
}
await kilidiSerbestBirak();

/* ---------------------------------------------------------------- */
console.log("\n5) KALICI BOZULMA YOK — kilit serbest kalınca aynı istek geçiyor");

await sifirla();
{
  const veri = TEMEL();
  veri.cekimIsleri = [{ ...veri.cekimIsleri[0], icerikTuru: "Reels GÜNCEL" }];
  const r = await cagir(veriUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { data: { ...veri, _v: undefined }, _v: 5,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: veri._alanSurumleri },
  });
  const sonHal = await kv.get(KEY);
  t("kilit boşken kayıt geçiyor", r.kod === 200, "gelen: " + r.kod);
  t("kart gerçekten yazıldı", sonHal.cekimIsleri[0].icerikTuru === "Reels GÜNCEL");
  t("kilit istekten sonra serbest bırakıldı", (await kv.get(KILIT_KEY)) === null,
    "bırakılmazsa sistem 10 saniye kilitli kalırdı");
}

/* ---------------------------------------------------------------- */
console.log("\n6) TARAYICI TARAFI — 503 alınca kendiliğinden tekrar deniyor");

{
  /* Sunucu iki kez meşgul, üçüncüde kabul ediyor. Kullanıcı hiçbir şey görmemeli. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async (url) => { sayac++; return { status: sayac <= 2 ? 503 : 200, url }; };
  t("kurulum bir kez yapılıyor", tekrarDenemeyiKur(kap) === true);
  t("ikinci kurulum reddediliyor", tekrarDenemeyiKur(kap) === false, "fetch iki kez sarmalanmasın");

  const yanit = await kap.fetch("/api/data", { method: "POST", body: "{}" });
  t("iki 503'ten sonra başarıya ulaşıyor", yanit.status === 200, "gelen: " + yanit.status);
  t("tam 3 istek gönderildi", sayac === 3, "gönderilen: " + sayac);
  t("deneme sayısı sınırlı", MESGUL_BEKLEMELERI.length === 2, "sonsuz döngü olmasın");
}
{
  /* Tüm denemeler meşgulse hata kullanıcıya ULAŞMALI — sessizce yutulmamalı. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac++; return { status: 503 }; };
  tekrarDenemeyiKur(kap);
  const yanit = await kap.fetch("/api/data", { method: "POST" });
  t("hep meşgulse 503 kullanıcıya dönüyor", yanit.status === 503);
  t("deneme sayısı üstte kalıyor", sayac === 1 + MESGUL_BEKLEMELERI.length, "gönderilen: " + sayac);
}
{
  /* Bizim API'miz olmayan adresler ve gövdesi tükenen Request nesneleri tekrar edilmez. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac++; return { status: 503 }; };
  tekrarDenemeyiKur(kap);
  await kap.fetch("https://www.googleapis.com/upload");
  t("dış adresler tekrar denenmiyor", sayac === 1, "gönderilen: " + sayac);
  sayac = 0;
  await kap.fetch({ url: "/api/data" });
  t("Request nesnesi tekrar denenmiyor", sayac === 1, "gövdesi tükenmiş olur");
}

/* ---------------------------------------------------------------- */
console.log("\n7) İKİ KİŞİ AYNI ANDA — kimsenin işi sessizce silinmiyor");

await sifirla();
{
  /* A kilidi tutarken B yazmaya çalışıyor. Eski davranış: B kilitsiz yazar, A'nın işini
   * siler ve B'ye 200 döner — kimsenin haberi olmaz. Yeni davranış: B reddedilir. */
  await kilidiBaskasinaVer();                                   // A'nın kilidi
  const bVerisi = TEMEL();
  bVerisi.cekimIsleri = [{ ...bVerisi.cekimIsleri[0], icerikTuru: "B'NİN YAZDIĞI" }];
  const bYanit = await cagir(veriUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { data: { ...bVerisi, _v: undefined }, _v: 5,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: bVerisi._alanSurumleri },
  });
  t("B'ye SESSİZ BAŞARI dönmüyor", bYanit.kod !== 200, "gelen: " + bYanit.kod);
  t("B açıkça uyarılıyor", bYanit.kod === 503 && bYanit.govde.mesgul === true);

  /* Şimdi A işini bitirip kilidi bırakıyor. */
  await kilidiSerbestBirak();
  const aVerisi = TEMEL();
  aVerisi.cekimIsleri = [{ ...aVerisi.cekimIsleri[0], icerikTuru: "A'NIN YAZDIĞI" }];
  const aYanit = await cagir(veriUcu, {
    method: "POST", headers: OWNER, query: {},
    body: { data: { ...aVerisi, _v: undefined }, _v: 5,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: aVerisi._alanSurumleri },
  });
  const sonHal = await kv.get(KEY);
  t("A'nın işi duruyor", aYanit.kod === 200 && sonHal.cekimIsleri[0].icerikTuru === "A'NIN YAZDIĞI",
    "gelen: " + sonHal.cekimIsleri[0].icerikTuru);
}

/* ---------------------------------------------------------------- */
console.log("\n8) ORTAM YAPILANDIRMASI EKRANDA GÖRÜNÜYOR");

/* Denetimdeki en ciddi açık kodda değil YAPILANDIRMADAYDI: değişken bir ortamda tanımsız
 * kalırsa fark edilmiyordu. Kod artık kapalı düşüyor; burada eksikliğin GÖRÜLEBİLİR
 * olduğunu doğruluyoruz — görünmeyen bir eksiklik düzeltilmez. */
await sifirla();
{
  const r = await cagir(veriUcu, { method: "GET", headers: OWNER, query: {} });
  const gv = r.govde && r.govde.guvenlik;
  t("güvenlik durumu GET'te dönüyor", !!gv);
  t("SITE_PASSWORD durumu bildiriliyor", gv.sitePasswordVar === true);
  t("CRON_SECRET durumu bildiriliyor", "cronSecretVar" in gv && gv.cronSecretVar === false,
    "tanımsız — ekranda eksik olarak görünmeli");
  t("hangi ortam olduğu bildiriliyor", typeof gv.ortam === "string" && gv.ortam.length > 0,
    "gelen: " + gv.ortam);

  /* Değerin kendisi ASLA tarayıcıya gitmemeli — yalnızca var/yok bilgisi. */
  const metin = JSON.stringify(r.govde);
  t("şifre DEĞERİ tarayıcıya sızmıyor", !metin.includes("ownerpw"), "yalnızca var/yok bilgisi gider");
}
{
  process.env.CRON_SECRET = "gizli-cron-degeri";
  const r = await cagir(veriUcu, { method: "GET", headers: OWNER, query: {} });
  const gv = r.govde && r.govde.guvenlik;
  t("CRON_SECRET tanımlıyken true dönüyor", gv.cronSecretVar === true);
  t("cron sırrının DEĞERİ sızmıyor", !JSON.stringify(r.govde).includes("gizli-cron-degeri"));
  delete process.env.CRON_SECRET;
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
