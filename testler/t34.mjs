/* KART İÇİNDEN MEDYA YÜKLEME — yetki, versiyon ve veri güvenliği
 *
 * NEDEN BU TEST VAR:
 *   1. Yükleme uçları marka kilidini deliyor mu — personel başka markanın kartına
 *      dosya yükleyebilmemeli.
 *   2. Sunucu yükleme sonrası KV'ye YAZMAMALI. Yazarsa _v sayacı artar, tarayıcı geride
 *      kalır, sonraki kayıt sahte staleConflict alır ve kullanıcının düzenlemesi silinir.
 *      Bu hata bu projede bir kez yaşandı; testi olmadan tekrar eder.
 *   3. Versiyon numarası SUNUCUDA hesaplanmalı — tarayıcıdan gelene güvenilirse iki kişi
 *      aynı anda yüklediğinde aynı numarayı alır.
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
const KILITLI = { "x-staff-username-b64": b64("k"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const IZINSIZ = { "x-staff-username-b64": b64("i"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
const MUSTERI = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const VERI = () => ({
  _v: 1,
  clients: [
    { id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" },
    { id: 2, ad: "GİZLİ Marka", driveOnayKlasoru: "https://drive.google.com/drive/folders/1ZzZdefGHIjklMNOpqrs" },
  ],
  cekimIsleri: [
    { id: 7, marka: "VIZZ", kategori: "Video", icerikTuru: "Sivrisinek Kampanya", asama: "Edit Yapılıyor",
      medya: [{ versiyon: 1, dosyaId: "aaa", ad: "VIZZ_SIVRISINEK_KAMPANYA_V1.mp4" },
              { versiyon: 2, dosyaId: "bbb", ad: "VIZZ_SIVRISINEK_KAMPANYA_V2.mp4" }], gecmis: [] },
    { id: 9, marka: "GİZLİ Marka", kategori: "Video", icerikTuru: "X", asama: "Edit Yapılıyor", gecmis: [] },
  ],
  personelHesaplari: [
    { id: "k1", ad: "Kilitli", kullaniciAdi: "k", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { cekimEdit: true }, markalar: ["VIZZ"] },
    /* cekimEdit AÇIKÇA false. DEFAULT_PERMS.cekimEdit varsayılanı true olduğu için,
     * anahtarı hiç yazmamak yetki VERİR — bu uygulamanın kuralı. Yetkisizliği sınamak
     * için açıkça kapatmak gerekiyor. */
    { id: "i1", ad: "İzinsiz", kullaniciAdi: "i", sifreHash: hash("1234", "s"), sifreSalt: "s",
      izinler: { paylasimlar: true, cekimEdit: false } },
  ],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
});

const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

console.log("MEDYA YÜKLEME\n");

/* ---- 1. YETKİ SINIRLARI ---- */
console.log(" Kimler yükleyebilir");
await kv.set("marcus-os-data", VERI());
let r = await cagri(MUSTERI, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("müşteri hesabı yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(IZINSIZ, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("cekimEdit izni olmayan personel yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);

r = await cagri(KILITLI, { driveAction: "yuklemeBasla", isId: 9, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("marka kilitli personel BAŞKA markaya yükleyemiyor", r.kod === 403, `HTTP ${r.kod}`);
t("yanıtta başka markanın adı sızmıyor", !JSON.stringify(r.govde).includes("GİZLİ"));

r = await cagri(OWNER, { driveAction: "yuklemeBasla", isId: 999, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("olmayan kart 404", r.kod === 404, `HTTP ${r.kod}`);

/* ---- 2. KURULU DEĞİLKEN ---- */
console.log("\n Drive yükleme kurulu değilken");
r = await cagri(OWNER, { driveAction: "yuklemeBasla", isId: 7, dosyaAdi: "a.mp4", mimeTur: "video/mp4" });
t("anlaşılır hata dönüyor, çökmüyor", r.kod === 400 && /kurulu değil/i.test(r.govde.error || ""), r.govde.error);
let d = await kv.get("marcus-os-data");
t("veri bozulmadı", (d.cekimIsleri || []).length === 2 && d._v === 1);

/* ---- 3. SUNUCU KV'YE YAZMAMALI (veri kaybı koruması) ---- */
console.log("\n Sunucu kendi başına yazmıyor mu");
const oncekiV = (await kv.get("marcus-os-data"))._v;
r = await cagri(OWNER, { driveAction: "yuklemeBitti", isId: 7, dosyaId: "zzz" });
d = await kv.get("marcus-os-data");
t("_v ARTMADI (tarayıcı geride kalmaz)", d._v === oncekiV, `önce ${oncekiV} / sonra ${d._v}`);
t("medya listesi sunucudan değişmedi", (d.cekimIsleri[0].medya || []).length === 2);

/* ---- 4. GEÇERSİZ İŞLEM ---- */
console.log("\n Geçersiz istekler");
r = await cagri(OWNER, { driveAction: "olmayanIslem", isId: 7 });
t("bilinmeyen işlem reddediliyor", r.kod === 400, `HTTP ${r.kod}`);
r = await cagri(OWNER, { driveAction: "yuklemeBitti", isId: 7 });
t("dosyaId eksikse reddediliyor", r.kod === 400, `HTTP ${r.kod}`);

/* ---- 5. DOSYA ADI ÜRETİMİ ---- */
console.log("\n Otomatik dosya adlandırma");
const { dosyaAdiUret } = await import("../lib/drive-yukleme.js");
t("Türkçe karakterler sadeleşiyor",
  dosyaAdiUret({ marka: "ÇORBACI ŞEMSİ", icerikAdi: "Güncel İçerik", versiyon: 3, orijinalAd: "x.mp4" })
    === "CORBACI_SEMSI_GUNCEL_ICERIK_V3.mp4",
  dosyaAdiUret({ marka: "ÇORBACI ŞEMSİ", icerikAdi: "Güncel İçerik", versiyon: 3, orijinalAd: "x.mp4" }));
t("uzantı MIME türünden çıkarılıyor",
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "R", versiyon: 1, orijinalAd: "", mimeTur: "image/jpeg" }) === "VIZZ_R_V1.jpg");
t("uzantı orijinal addan korunuyor",
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "R", versiyon: 2, orijinalAd: "kamera.MOV" }) === "VIZZ_R_V2.mov");
t("boş içerik adında da geçerli ad üretiliyor",
  /^VIZZ_V1\./.test(dosyaAdiUret({ marka: "VIZZ", icerikAdi: "", versiyon: 1, orijinalAd: "a.mp4" })),
  dosyaAdiUret({ marka: "VIZZ", icerikAdi: "", versiyon: 1, orijinalAd: "a.mp4" }));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
