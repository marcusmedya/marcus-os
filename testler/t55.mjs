/* GÜVENLİK DENETİMİ — KİMLİK, YETKİ, YAPILANDIRMA
 *
 * BULUNAN KRİTİK AÇIK: uygulama "AÇIK DÜŞÜYORDU". SITE_PASSWORD / STAFF_PASSWORD / CRON_SECRET
 * tanımlı değilse yetki kapıları "yapılandırma eksik, izin ver" diyordu. Ölçüldü:
 *
 *   kimliksiz GET  -> 200, TÜM veri (müşteri şifreleri dahil) dönüyordu
 *   kimliksiz POST -> 200, veri değiştirilebiliyordu
 *   şifresiz giriş -> geçerli bir owner oturum anahtarı veriliyordu
 *   /api/manage-staff -> personel listesi (kullanıcı adları, izinler, markalar) dönüyordu
 *   cron uçları -> herkes tetikleyebiliyordu
 *
 * Üretimde SITE_PASSWORD tanımlı olduğu için gizli kalmıştı. Ama tetiklenmesi zor değil:
 * değişken silinirse, yeni bir ortam (önizleme dağıtımı) açılırsa ya da yanlış girilirse
 * sistem tamamen halka açılıyordu. Blast radius: her şey.
 *
 * Artık HEPSİ KAPALI DÜŞÜYOR. Kilitlenme riski yok — çözüm tek bir ortam değişkeni.
 *
 * BU TEST HER İKİ DURUMU DA ÖLÇER: yapılandırma eksikken kimse giremiyor, yapılandırma
 * doğruyken meşru kullanıcı girebiliyor. İkincisi olmadan birincisi "her şeyi kapat" ile de
 * geçerdi — yani test kendini kandırırdı.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cagir, TEMIZ_VERI } from "./denetim.mjs";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const UCLAR = ["data", "backup", "kasa", "manage-staff", "paylasim",
               "client-payment", "devir-teslim", "notify-job", "daily-backup", "daily-reminders"];
const yukle = async (ad) => (await import(`../api/${ad}.js`)).default;
const iste = async (ad, yontem, { headers = {}, body = {}, query = {} } = {}) => {
  const h = await yukle(ad);
  return cagir(h, { method: yontem, headers: { "content-type": "application/json", ...headers }, query, body });
};

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");

/* ---------------------------------------------------------------- */
console.log("\n1) YAPILANDIRMA EKSİKKEN HİÇBİR KAPI AÇILMIYOR");

delete process.env.SITE_PASSWORD;
delete process.env.STAFF_PASSWORD;
delete process.env.CRON_SECRET;
await kv.set("marcus-os-data", TEMIZ_VERI());

const acikKapilar = [];
for (const ad of UCLAR) {
  for (const yontem of ["GET", "POST"]) {
    const r = await iste(ad, yontem);
    if (r.kod === 200) acikKapilar.push(`${ad} ${yontem}`);
  }
}
t("kimliksiz erişime açık kapı YOK", acikKapilar.length === 0, acikKapilar.join(", "));

let r = await iste("data", "GET");
t("veri okunamıyor", r.kod === 401 && !(r.govde && r.govde.data), String(r.kod));
r = await iste("data", "POST", { body: { data: { ...TEMIZ_VERI(), firmaAdi: "SALDIRGAN" }, _v: 1 } });
t("veri yazılamıyor", r.kod === 401);
t("veri gerçekten değişmedi", (await kv.get("marcus-os-data")).firmaAdi !== "SALDIRGAN");

r = await iste("data", "POST", { body: { authAction: "girisBasla", sifre: "" } });
t("şifresiz oturum anahtarı VERİLMİYOR", !(r.govde && r.govde.token), JSON.stringify(r.govde).slice(0, 80));
t("eksiklik açıkça söyleniyor", r.kod === 503 && String(r.govde.error || "").includes("SITE_PASSWORD"));

r = await iste("manage-staff", "GET");
t("personel listesi sızmıyor", !(r.govde && r.govde.hesaplar), String(r.kod));

r = await iste("daily-backup", "GET");
t("cron ucu tetiklenemiyor", r.kod === 401, String(r.kod));
r = await iste("daily-reminders", "GET");
t("hatırlatma ucu tetiklenemiyor", r.kod === 401, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n2) YAPILANDIRMA DOĞRUYKEN MEŞRU GİRİŞ ÇALIŞIYOR");
/* Bu bölüm olmadan yukarıdakiler "her şeyi kapat" ile de geçerdi. */

process.env.SITE_PASSWORD = "dogru-sifre";
process.env.CRON_SECRET = "cron-sirri";
const OWNER = { "x-site-password": "dogru-sifre" };

r = await iste("data", "GET", { headers: OWNER });
t("yönetici veriyi okuyabiliyor", r.kod === 200 && Boolean(r.govde.data), String(r.kod));
r = await iste("manage-staff", "GET", { headers: OWNER });
t("yönetici personel listesini alabiliyor", r.kod === 200 && Array.isArray(r.govde.hesaplar));
r = await iste("kasa", "GET", { headers: OWNER });
t("yönetici kasa durumunu okuyabiliyor", r.kod === 200);
r = await iste("daily-backup", "GET", { headers: { authorization: "Bearer cron-sirri" } });
t("doğru cron sırrıyla tetiklenebiliyor", r.kod === 200, String(r.kod));
r = await iste("daily-backup", "GET", { headers: { authorization: "Bearer yanlis" } });
t("yanlış cron sırrı reddediliyor", r.kod === 401, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n3) YETKİ YÜKSELTME VE KİMLİK SAHTECİLİĞİ");

await kv.set("marcus-os-data", {
  ...TEMIZ_VERI(),
  personelHesaplari: [{ id: "p9", ad: "Dar", kullaniciAdi: "dar", sifreHash: hash("1", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true, musteriler: false, finans: false, personel: false }, markalar: ["Şişçi İbo"] }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
});
const DAR = { "x-staff-username-b64": b64("dar"), "x-staff-password-b64": b64("1") };
const MUSTERI = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1") };

r = await iste("data", "GET", { headers: DAR });
const darVeri = (r.govde && r.govde.data) || {};
t("personel rol=owner olarak dönmüyor", r.govde.role === "staff", String(r.govde.role));
t("personele finans verisi gitmiyor", !darVeri.gelirKalemleri || darVeri.gelirKalemleri.length === 0);
t("personele personel hesapları gitmiyor", darVeri.personelHesaplari === undefined);
t("marka kilidi uygulanıyor", (darVeri.clients || []).every((c) => c.ad === "Şişçi İbo"),
  JSON.stringify((darVeri.clients || []).map((c) => c.ad)));

/* Personel, kendine owner rolü uydurmaya çalışıyor */
r = await iste("data", "GET", { headers: { ...DAR, "x-site-password": "yanlis" } });
t("sahte owner şifresiyle yükselemiyor", r.govde.role !== "owner", String(r.govde.role));

/* Personel, izni olmayan alana yazmaya çalışıyor */
const oncekiGelir = (await kv.get("marcus-os-data")).gelirKalemleri;
r = await iste("data", "POST", { headers: DAR, body: { data: { gelirKalemleri: [{ id: 1, tutar: 999999 }] }, _v: (await kv.get("marcus-os-data"))._v } });
t("izinsiz alana yazma reddediliyor (veri değişmedi)",
  JSON.stringify((await kv.get("marcus-os-data")).gelirKalemleri) === JSON.stringify(oncekiGelir));

/* Personel, kendi izinlerini yükseltmeye çalışıyor */
r = await iste("data", "POST", { headers: DAR,
  body: { data: { personelHesaplari: [{ id: "p9", kullaniciAdi: "dar", izinler: { finans: true, personel: true } }] },
          _v: (await kv.get("marcus-os-data"))._v } });
const p9 = (await kv.get("marcus-os-data")).personelHesaplari.find((h) => h.id === "p9");
t("personel kendi izinlerini yükseltemiyor", p9.izinler.finans !== true && p9.izinler.personel !== true,
  JSON.stringify(p9.izinler));
t("personel şifre hash'i bozulmadı", Boolean(p9.sifreHash));

/* Müşteri, personel/owner uçlarına giremiyor */
r = await iste("manage-staff", "GET", { headers: MUSTERI });
t("müşteri personel yönetimine giremiyor", r.kod === 401, String(r.kod));
r = await iste("backup", "GET", { headers: MUSTERI });
t("müşteri yedeklere giremiyor", r.kod === 401, String(r.kod));
r = await iste("kasa", "GET", { headers: MUSTERI });
t("müşteri şifre kasasına giremiyor", r.kod === 401, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n4) IDOR — başka markanın verisine erişim");

await kv.set("marcus-os-data", {
  ...TEMIZ_VERI(),
  clients: [{ id: 1, ad: "Şişçi İbo" }, { id: 2, ad: "GİZLİ Marka" }],
  musteriIcerikleri: [{ id: "a", clientId: 1, aciklama: "kendi" }, { id: "b", clientId: 2, aciklama: "BAŞKASININ" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
  personelHesaplari: [],
});
r = await iste("data", "GET", { headers: MUSTERI });
const mv = JSON.stringify(r.govde);
t("müşteri yalnızca kendi markasını görüyor", !mv.includes("BAŞKASININ"), "IDOR");
t("müşteriye diğer markaların listesi gitmiyor", !mv.includes("GİZLİ Marka"));

/* Müşteri, başka markanın içeriğini onaylamaya çalışıyor */
r = await iste("data", "POST", { headers: MUSTERI, body: { musteriAction: "onayla", icerikId: "b" } });
t("başka markanın içeriği onaylanamıyor", r.kod !== 200, `${r.kod} ${JSON.stringify(r.govde).slice(0,80)}`);
t("o içerik değişmedi", (await kv.get("marcus-os-data")).musteriIcerikleri.find((i) => i.id === "b").durum === undefined);


/* ---------------------------------------------------------------- */
console.log("\n5) GİRDİ SINIRLARI — veri şişirme");

/* Tüm uygulama TEK bir JSON belgesi ve her istekte baştan sona okunuyor. Sınırsız bir metin
 * alanı, birkaç MB çöple her şeyi yavaşlatır ve zamanla KV sınırına dayanır. */
await kv.set("marcus-os-data", {
  ...TEMIZ_VERI(),
  clients: [{ id: 1, ad: "Şişçi İbo" }],
  cekimIsleri: [{ id: 1, marka: "Şişçi İbo", asama: "Kontrol Bekliyor" }],
  musteriIcerikleri: [],
  musteriTalepleri: [],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
  personelHesaplari: [],
});
const DEV = "A".repeat(200000);

r = await iste("data", "POST", { headers: MUSTERI,
  body: { musteriAction: "talepOlustur", talep: { tur: DEV, aciklama: DEV, neZaman: DEV, referans: DEV } } });
const talep = ((await kv.get("marcus-os-data")).musteriTalepleri || [])[0];
t("talep alanları kırpılıyor",
  talep && String(talep.tur).length === 40 && String(talep.aciklama).length === 2000 && String(talep.referans).length === 500,
  talep ? `${talep.tur.length}/${talep.aciklama.length}/${talep.referans.length}` : "kayıt yok");

r = await iste("data", "POST", { headers: MUSTERI, body: { musteriAction: "revizeIste", isId: 1, revizeNotu: DEV } });
const is1 = (await kv.get("marcus-os-data")).cekimIsleri.find((j) => j.id === 1);
t("REVİZE NOTU DA KIRPILIYOR", String((is1 && is1.musteriRevizeNotu) || "").length === 2000,
  `${String((is1 && is1.musteriRevizeNotu) || "").length} karakter — sınırsızken 200.000 kaydediliyordu`);
t("kart geçmişine de kırpılmış hâli yazıldı",
  JSON.stringify(is1.gecmis || []).length < 10000, `${JSON.stringify(is1.gecmis || []).length} bayt`);

/* Açık talep sayısı sınırı — kötüye kullanıma karşı. */
await kv.set("marcus-os-data", { ...(await kv.get("marcus-os-data")), musteriTalepleri: [] });
let kabul = 0;
for (let i = 0; i < 6; i += 1) {
  const rr = await iste("data", "POST", { headers: MUSTERI, body: { musteriAction: "talepOlustur", talep: { tur: "Reels", aciklama: `x${i}` } } });
  if (rr.kod === 200) kabul += 1;
}
t("açık talep sayısı sınırlı", kabul === 3, `${kabul} kabul edildi`);

/* ---------------------------------------------------------------- */
console.log("\n6) TESLİM TARİHİ SAAT DİLİMİ");

/* Aylık İş Raporu ve kişi hak edişi `teslimEdilmeTarihi` alanına göre sayıyor.
 * `toISOString()` UTC verir; Türkiye UTC+3 olduğu için gece 00:00–03:00 arasında teslim
 * edilen iş BİR ÖNCEKİ GÜNE — ayın 1'inde bir önceki AYA — yazılıyordu. */
const cekim = fs.readFileSync(path.join(kok, "src", "CekimEditTakibi.jsx"), "utf8");
const apiMetin = fs.readFileSync(path.join(kok, "api", "data.js"), "utf8");
t("istemci teslim tarihini Türkiye saatiyle yazıyor",
  /teslimEdilmeTarihi = tarihIso\(new Date\(\)\)/.test(cekim));
t("sunucu teslim tarihini Türkiye saatiyle yazıyor",
  /teslimEdilmeTarihi: bugunISO\(\)/.test(apiMetin));
t("teslim tarihinde UTC kalmadı",
  !/teslimEdilmeTarihi[:= ]*new Date\(\)\.toISOString/.test(cekim + apiMetin));
t("Türkiye saati üreteci Europe/Istanbul kullanıyor",
  fs.readFileSync(path.join(kok, "lib", "kv-yaz.js"), "utf8").includes('timeZone: "Europe/Istanbul"'));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
