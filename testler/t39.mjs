/* ÖNİZLEME GÖRSELİ — YETKİ SINIRLARI
 *
 * NEDEN BU TEST VAR:
 *   Dosyalar Drive'da kısıtlı olduğu için önizleme sunucudan geçiyor. Bu uç, uygulamanın
 *   KENDİ Drive yetkisiyle dosya okuyor — yani sınırları yanlış çizilirse, kimliğini bilen
 *   herkesin her dosyayı okuyabildiği bir kapı olur.
 *
 *   İki şey kritik:
 *     1. MÜŞTERİ yalnızca kendi markasının içeriğini görebilmeli. Bir müşterinin başka bir
 *        müşterinin içeriğini görmesi, bu uygulamada olabilecek en ağır hatalardan biri.
 *     2. Kaynak bağlantı KAYITTAN çözülmeli; tarayıcının verdiği serbest bağlantı
 *        kullanılırsa kayıt doğrulaması hiçbir işe yaramaz.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_OAUTH_CLIENT_ID;
delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const MUSTERI_A = { "x-musteri-username-b64": b64("ma"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const MUSTERI_B = { "x-musteri-username-b64": b64("mb"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const KILITLI = { "x-staff-username-b64": b64("k"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

const LINK = (id) => `https://drive.google.com/file/d/${id}/view`;

await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "GİZLİ Marka" }],
  cekimIsleri: [
    { id: 10, marka: "VIZZ", icerikTuru: "A", asama: "Kontrol Bekliyor",
      medya: [{ versiyon: 1, dosyaId: "VIZZ_DOSYA" }], gecmis: [] },
    { id: 11, marka: "GİZLİ Marka", icerikTuru: "B", asama: "Kontrol Bekliyor",
      editliDosyaLink: LINK("GIZLI_DOSYA"), gecmis: [] },
    { id: 12, marka: "VIZZ", icerikTuru: "Dosyasız", asama: "Çekim Planlandı", gecmis: [] },
  ],
  musteriIcerikleri: [
    { id: "i1", clientId: 1, tur: "gorsel", driveLinki: LINK("VIZZ_ICERIK") },
    { id: "i2", clientId: 2, tur: "gorsel", driveLinki: LINK("GIZLI_ICERIK") },
  ],
  personelHesaplari: [
    { id: "k1", ad: "Kilitli", kullaniciAdi: "k", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { cekimEdit: true }, markalar: ["VIZZ"] },
  ],
  musteriHesaplari: [
    { id: "ma1", ad: "A", kullaniciAdi: "ma", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" },
    { id: "mb1", ad: "B", kullaniciAdi: "mb", clientId: 2, sifreHash: hash("1", "s"), sifreSalt: "s" },
  ],
});

console.log("ÖNİZLEME YETKİ SINIRLARI\n");

/* ---- 1. MÜŞTERİ KENDİ İÇERİĞİ ---- */
console.log(" Müşteri");
let r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1" });
t("kendi içeriğini isteyebiliyor", r.kod === 200, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i2" });
t("BAŞKA müşterinin içeriğini göremiyor", r.kod === 403, `HTTP ${r.kod}`);
t("yanıtta başka markanın izi yok", !JSON.stringify(r.govde).includes("GIZLI"), JSON.stringify(r.govde));

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", isId: 10 });
t("kendi markasının kartını isteyebiliyor", r.kod === 200, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", isId: 11 });
t("BAŞKA markanın kartını göremiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(MUSTERI_B, { onizlemeAction: "gorsel", icerikId: "i1" });
t("ters yönde de kapalı", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 2. MARKA KİLİTLİ PERSONEL ---- */
console.log("\n Marka kilitli personel");
r = await cagri(KILITLI, { onizlemeAction: "gorsel", isId: 10 });
t("kendi markasını görebiliyor", r.kod === 200, `HTTP ${r.kod}`);
r = await cagri(KILITLI, { onizlemeAction: "gorsel", isId: 11 });
t("başka markayı göremiyor", r.kod === 403, `HTTP ${r.kod}`);
r = await cagri(KILITLI, { onizlemeAction: "gorsel", icerikId: "i2" });
t("başka markanın içeriğini de göremiyor", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 3. KAYNAK KAYITTAN ÇÖZÜLÜYOR ----
 * Tarayıcının verdiği serbest bağlantı kullanılsaydı kayıt doğrulaması işe yaramazdı. */
console.log("\n Kaynak kayıttan çözülüyor");
r = await cagri(MUSTERI_A, { onizlemeAction: "gorsel", icerikId: "i1", link: LINK("BASKASININ_DOSYASI"), driveLinki: LINK("BASKASININ_DOSYASI") });
t("gövdeye konan serbest bağlantı yok sayılıyor", r.kod === 200 && !JSON.stringify(r.govde).includes("BASKASININ"),
  "kaydın kendi bağlantısı kullanılmalı");

r = await cagri(OWNER, { onizlemeAction: "gorsel" });
t("kayıt belirtilmezse 400", r.kod === 400, `HTTP ${r.kod}`);
r = await cagri(OWNER, { onizlemeAction: "gorsel", icerikId: "yok" });
t("olmayan içerik 404", r.kod === 404, `HTTP ${r.kod}`);
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 999 });
t("olmayan kart 404", r.kod === 404, `HTTP ${r.kod}`);

/* ---- 4. DOSYASI OLMAYAN KAYIT ---- */
console.log("\n Dosyasız kayıt ve kurulmamış Drive");
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 12 });
t("dosyası olmayan kart ayırt ediliyor", r.kod === 200 && r.govde.kod === "dosya-yok", r.govde.kod);
r = await cagri(OWNER, { onizlemeAction: "gorsel", isId: 10 });
t("Drive kurulu değilken çökmüyor", r.kod === 200 && r.govde.ok === false, `HTTP ${r.kod}`);
t("sebep bildiriliyor", Boolean(r.govde.sebep), r.govde.sebep);

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
