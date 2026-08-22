/* YETKİ MATRİSİ — MARKA KİLİDİ ATLANABİLİYOR MU
 *
 * Marka kilidi tek yerde çözülüyor: uç, isteğin `clientId` / `planId` / `subeId` /
 * `uyelikId` alanlarından hedefin hangi markaya ait olduğunu buluyor ve
 * `markaErisimiVarMi` ile kontrol ediyor. Kural fail-close: hedef belirsizse
 * kilitli hesap REDDEDİLİR.
 *
 * Bu testin işi, o çözümlemenin gerçekten her yola kapalı olduğunu ölçmek. İki gerçek
 * kusur bu denetimde bulundu:
 *
 * 1. `uyelikEkle`'de marka kimliği İÇ NESNEDE (`uyelik.clientId`), üst düzeyde değil.
 *    Çözümleyici onu göremediği için hedef "belirsiz" kalıyor ve fail-close devreye
 *    giriyordu: çözüm ortağı KENDİ markasına bile üyelik ekleyemiyordu. Güvenlik
 *    açısından güvenli taraf, ama `uyelikler` izni çözüm ortağı için işlevsizdi.
 *
 * 2. `subeStokDegistir` şubeyi TÜM şubeler arasında arıyordu, markaya bağlı değil.
 *    Kilitli hesap kendi `clientId`'sini ve BAŞKA markanın `subeId`'sini gönderince
 *    istek geçiyordu: `1_onun_Video` gibi çöp bir stok anahtarı oluşuyor ve BAŞKA
 *    MARKANIN ŞUBE ADI geçmişe yazılıyordu ("Kendi Marka (Onun Şubesi)").
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
const { default: paylasimUcu } = await import("../api/paylasim.js");

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

const KEY = "marcus-os-data";
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const ORTAK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

const sifirla = () => kv.set(KEY, {
  clients: [{ id: 1, ad: "Kendi Marka" }, { id: 2, ad: "Başka Marka" }],
  subeler: [{ id: "benim", ad: "Benim Şubem", clientId: 1 }, { id: "onun", ad: "Onun Şubesi", clientId: 2 }],
  uyelikler: [{ id: "u2", clientId: 2, ad: "Başkasının Aboneliği" }],
  cekimIsleri: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
  personelHesaplari: [{
    id: "o1", kullaniciAdi: "ortak", sifreHash: hash("1234", "s1"), sifreSalt: "s1",
    markalar: ["Kendi Marka"], izinler: { paylasimlar: true, uyelikler: true },
  }],
  _alanSurumleri: {},
});
const gonder = (govde, basliklar) => cagir(paylasimUcu, {
  method: "POST", headers: basliklar || ORTAK,
  body: { ...govde, islemId: `t79_${Math.random().toString(36).slice(2, 12)}` },
});
const oku = () => kv.get(KEY);

/* ---------------------------------------------------------------- */
await bolum("1) ÜYELİK — kimlik iç nesnede olsa da çözülüyor", 5, async () => {
  await sifirla();

  const kendi = await gonder({ action: "uyelikEkle", uyelik: { clientId: 1, ad: "Canva" } });
  t("çözüm ortağı KENDİ markasına üyelik ekleyebiliyor", kendi.kod === 200,
    "gelen: " + kendi.kod + " — iç nesnedeki clientId görülmezse kendi markasında bile reddedilir");

  const baskasi = await gonder({ action: "uyelikEkle", uyelik: { clientId: 2, ad: "Sızıntı" } });
  t("BAŞKA markaya üyelik ekleyemiyor", baskasi.kod === 403, "gelen: " + baskasi.kod);

  const veri = await oku();
  t("izinsiz üyelik gerçekten yazılmadı",
    !(veri.uyelikler || []).some((u) => u.ad === "Sızıntı"));
  t("kendi üyeliği yazıldı", (veri.uyelikler || []).some((u) => u.ad === "Canva"));

  /* Başkasının üyeliğini kimliğiyle düzenlemek de kapalı olmalı. */
  const duzenle = await gonder({ action: "uyelikGuncelle", uyelikId: "u2", patch: { ad: "Ele geçirildi" } });
  t("BAŞKA markanın üyeliği düzenlenemiyor", duzenle.kod === 403, "gelen: " + duzenle.kod);
});

/* ---------------------------------------------------------------- */
await bolum("2) ŞUBE STOĞU — başka markanın şubesi kabul edilmiyor", 5, async () => {
  await sifirla();

  const kendi = await gonder({ action: "subeStokDegistir", clientId: 1, subeId: "benim", tur: "Video", delta: 1 });
  t("kendi şubesinin stoğunu değiştirebiliyor", kendi.kod === 200, "gelen: " + kendi.kod);

  const capraz = await gonder({ action: "subeStokDegistir", clientId: 1, subeId: "onun", tur: "Video", delta: 1 });
  t("BAŞKA markanın şubesi REDDEDİLİYOR", capraz.kod === 400 || capraz.kod === 403,
    "gelen: " + capraz.kod);

  const veri = await oku();
  t("çöp stok anahtarı OLUŞMADI", !Object.keys(veri.stoklar || {}).includes("1_onun_Video"),
    JSON.stringify(Object.keys(veri.stoklar || {})));
  t("BAŞKA MARKANIN ŞUBE ADI sızmadı",
    !JSON.stringify(veri.paylasimGecmisi || []).includes("Onun Şubesi"),
    "ad geçmişe yazılırsa kilitli hesap başka markanın şube adını öğrenir");
  t("kendi şubesinin stoğu yine de işlendi", (veri.stoklar || {})["1_benim_Video"] === 1);
});

/* ---------------------------------------------------------------- */
await bolum("3) YÖNETİCİ — kilitsiz hesap kısıtlanmıyor", 3, async () => {
  await sifirla();
  const r1 = await gonder({ action: "uyelikEkle", uyelik: { clientId: 2, ad: "Yönetici ekledi" } }, OWNER);
  t("yönetici her markaya üyelik ekleyebiliyor", r1.kod === 200, "gelen: " + r1.kod);

  const r2 = await gonder({ action: "subeStokDegistir", clientId: 2, subeId: "onun", tur: "Video", delta: 1 }, OWNER);
  t("yönetici her şubenin stoğunu değiştirebiliyor", r2.kod === 200, "gelen: " + r2.kod);

  /* Yönetici için de tutarsız eşleşme reddedilmeli: bu bir yetki değil, VERİ BÜTÜNLÜĞÜ
   * kuralı. Yanlış eşleşme çöp anahtar üretir ve stok sayıları bozulur. */
  const tutarsiz = await gonder({ action: "subeStokDegistir", clientId: 1, subeId: "onun", tur: "Video", delta: 1 }, OWNER);
  t("yöneticide bile şube–marka tutarsızlığı reddediliyor", tutarsiz.kod === 400,
    "gelen: " + tutarsiz.kod + " — çöp anahtar stok sayılarını bozar");
});

/* ---------------------------------------------------------------- */
await bolum("4) KİMLİK ÜZERİNDEN ERİŞİM — plan ve şube", 3, async () => {
  await sifirla();
  const veri = await oku();
  veri.haftalikPaylasimlar = [{ id: "p9", clientId: 2, gun: "Pzt", tur: "Video" }];
  await kv.set(KEY, veri);

  const planSil = await gonder({ action: "haftalikSil", planId: "p9" });
  t("BAŞKA markanın planı silinemiyor", planSil.kod === 403, "gelen: " + planSil.kod);
  t("plan gerçekten duruyor", ((await oku()).haftalikPaylasimlar || []).length === 1);

  const subeSil = await gonder({ action: "subeSil", subeId: "onun", onayliSil: true });
  t("BAŞKA markanın şubesi silinemiyor", subeSil.kod === 403, "gelen: " + subeSil.kod);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
