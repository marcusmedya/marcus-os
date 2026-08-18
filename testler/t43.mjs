/* KABA KUVVET SAYACI UYGULAMAYI KİLİTLEMEMELİ
 *
 * NEDEN BU TEST VAR — GERÇEK BİR OLAY:
 *   Panoya kart başına önizleme isteği eklendi. Tek sayfa açılışı 1-2 istekten ~30 isteğe
 *   çıktı. Oturum anahtarı bir an geçersiz olduğunda otuzu birden 401 aldı; kaba kuvvet
 *   eşiği (15 dakikada 20) anında aşıldı ve KULLANICI KENDİ UYGULAMASINDAN 15 DAKİKA
 *   DIŞARIDA KALDI. Dosya yükleyemedi.
 *
 *   Koruma doğruydu, SAYILAN ŞEY yanlıştı. İki kural sınanıyor:
 *     1. Kimlik SUNMAYAN istek deneme sayılmaz — şifre denemek için şifre göndermek gerekir.
 *     2. Önizleme/video istekleri hiç sayılmaz — bunlar giriş denemesi değil, sayfanın
 *        kendi kaynakları ve onlarca tanesi aynı anda gidiyor.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const IP = { "x-forwarded-for": "1.2.3.4" };
const sayac = () => kv.get("login-fail-1.2.3.4");
const sifirla = async () => { await kv.del("login-fail-1.2.3.4"); };

const istek = (secenekler) => cagir(h, {
  method: secenekler.method || "POST",
  headers: { ...IP, "content-type": "application/json", ...(secenekler.headers || {}) },
  query: secenekler.query || {},
  body: secenekler.body,
});

await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{ id: 10, marka: "VIZZ", icerikTuru: "A", asama: "Kontrol Bekliyor",
    medya: [{ versiyon: 1, dosyaId: "DOSYA_aaaaaaaaaaaaaaaa" }], gecmis: [] }],
  musteriIcerikleri: [], personelHesaplari: [], musteriHesaplari: [],
});

console.log("KABA KUVVET SAYACI\n");

/* ---- 1. GERÇEK ŞİFRE DENEMESİ SAYILIR ---- */
console.log(" Gerçek deneme");
await sifirla();
let r = await istek({ headers: { "x-site-password": "yanlis" }, body: { data: {} } });
t("yanlış şifre 401 alıyor", r.kod === 401, `HTTP ${r.kod}`);
t("sayaç arttı", (await sayac()) === 1, String(await sayac()));

/* ---- 2. KİMLİK SUNMAYAN İSTEK SAYILMAZ ---- */
console.log("\n Kimlik sunmayan istek");
await sifirla();
r = await istek({ body: { data: {} } });
t("kimliksiz istek 401 alıyor", r.kod === 401, `HTTP ${r.kod}`);
t("ama sayaç ARTMIYOR", !(await sayac()), `sayaç: ${await sayac()}`);

/* ---- 3. ÖNİZLEME İSTEKLERİ SAYILMAZ ----
 * Asıl olay buydu: pano açılışında otuz tanesi birden gidiyor. */
console.log("\n Önizleme istekleri (asıl olay)");
await sifirla();
for (let i = 0; i < 30; i++) {
  await istek({ headers: { "x-oturum": "gecersiz-oturum" }, body: { onizlemeAction: "gorsel", isId: 10 } });
}
t("30 önizleme isteği sayaca YAZILMADI", !(await sayac()), `sayaç: ${await sayac()}`);

await sifirla();
for (let i = 0; i < 25; i++) {
  await istek({ headers: { "x-oturum": "gecersiz" }, body: { driveAction: "kucukResim", isId: 10 } });
}
t("25 küçük resim isteği sayaca yazılmadı", !(await sayac()), `sayaç: ${await sayac()}`);

await sifirla();
for (let i = 0; i < 25; i++) {
  await istek({ method: "GET", headers: { "x-oturum": "gecersiz" }, query: { video: "10", j: "kotu" } });
}
t("25 video isteği sayaca yazılmadı", !(await sayac()), `sayaç: ${await sayac()}`);

/* ---- 4. KİLİT SONRASI YÜKLEME ----
 * Kilit tetiklenirse dosya yükleme de duruyor; kullanıcının gördüğü hata buydu. */
console.log("\n Kilit tetiklendiğinde");
await kv.set("login-fail-1.2.3.4", 25, { ex: 900 });
r = await istek({ headers: { "x-site-password": "ownerpw" }, body: { driveAction: "yuklemeBasla", isId: 10, dosyaAdi: "a.mp4", mimeTur: "video/mp4" } });
t("DOĞRU şifreyle giriş kilidi AŞIYOR", r.kod !== 429,
  `HTTP ${r.kod} — geçerli oturumu olan kullanıcı kilitlenmemeli`);
t("başarılı kimlik sayacı sıfırlıyor", !(await sayac()), `sayaç: ${await sayac()}`);

await kv.set("login-fail-1.2.3.4", 25, { ex: 900 });
r = await istek({ headers: { "x-site-password": "yanlis" }, body: { data: {} } });
t("yanlış şifre kilitte 429 alıyor", r.kod === 429, `HTTP ${r.kod}`);
t("mesaj ne yapılacağını söylüyor", /kilidi aç/i.test(r.govde.error || ""), r.govde.error);

/* ---- 5. KORUMA HÂLÂ ÇALIŞIYOR ---- */
console.log("\n Koruma hâlâ ayakta");
await sifirla();
for (let i = 0; i < 21; i++) {
  await istek({ headers: { "x-site-password": `dene${i}` }, body: { data: {} } });
}
r = await istek({ headers: { "x-site-password": "dene99" }, body: { data: {} } });
t("21 gerçek şifre denemesinden sonra kilitleniyor", r.kod === 429, `HTTP ${r.kod}`);

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
