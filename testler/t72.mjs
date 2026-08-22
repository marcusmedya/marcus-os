/* ŞUBE KURULUMU MÜŞTERİ KARTINDA
 *
 * Şube, markanın bir özelliği — kategorisi ve ödeme günüyle aynı yerde tanımlanmalı.
 * Kurulum müşteri kartına taşındı. Bu taşıma üç şeyi sınanır hale getirdi:
 *
 * 1. ONAY YOLU AÇIK MI. Sunucu, planı ya da kilitli kartı olan şubeyi silerken 409 +
 *    `onayGerekli` döndürüyor ve `onayliSil` bekliyor. İSTEMCİDE BU DALIN KARŞILIĞI
 *    YOKTU: uyarı gösteriliyor, onay gönderilemiyordu — yani kaydı olan şube hiç
 *    silinemiyordu. Sessiz bir çıkmaz; hata da vermiyordu.
 *
 * 2. AYNI ADLA İKİNCİ ŞUBE. Şube adı her paylaşım kaydına kopyalanıyor. İki "Smell Lara"
 *    varsa geçmişte hangisinin kastedildiği bir daha ayırt edilemez. İstemci kontrolü tek
 *    başına yetmez: iki kişi aynı anda ekleyince ikisi de "yok" görür.
 *
 * 3. MARKA KİLİDİ. Kurulum yeni bir ekrandan yapılıyor; kilitli hesabın başka markaya
 *    şube açamadığı bu yoldan da doğrulanmalı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { readFileSync } from "node:fs";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import crypto from "node:crypto";
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
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
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const gonder = (govde, basliklar) => cagir(paylasimUcu, {
  method: "POST", headers: basliklar || OWNER,
  body: { ...govde, islemId: `t72_${Math.random().toString(36).slice(2, 12)}` },
});
const oku = () => kv.get(KEY);
const sifirla = () => kv.set(KEY, {
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }, { id: 2, ad: "Başka Marka", durum: "aktif" }],
  subeler: [], cekimIsleri: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
  personelHesaplari: [], _alanSurumleri: {},
});

/* ---------------------------------------------------------------- */
await bolum("1) ŞUBE EKLEME — müşteri kartından gelen istek", 4, async () => {
  await sifirla();
  const r = await gonder({ action: "subeEkle", clientId: 1, ad: "  Smell Lara  " });
  t("şube ekleniyor", r.kod === 200, "gelen: " + r.kod);

  const veri = await oku();
  t("baştaki/sondaki boşluk temizleniyor", veri.subeler[0].ad === "Smell Lara",
    JSON.stringify(veri.subeler[0].ad));
  t("markaya bağlanıyor", String(veri.subeler[0].clientId) === "1");
  t("boş ad reddediliyor", (await gonder({ action: "subeEkle", clientId: 1, ad: "   " })).kod === 400);
});

/* ---------------------------------------------------------------- */
await bolum("2) AYNI ADLA İKİNCİ ŞUBE — sunucu son sözü söylüyor", 4, async () => {
  await sifirla();
  await gonder({ action: "subeEkle", clientId: 1, ad: "Smell Lara" });

  const ayni = await gonder({ action: "subeEkle", clientId: 1, ad: "Smell Lara" });
  t("birebir aynı ad reddediliyor", ayni.kod === 409, "gelen: " + ayni.kod);

  const farkliYazim = await gonder({ action: "subeEkle", clientId: 1, ad: "  smell LARA " });
  t("büyük/küçük ve boşluk farkı da aynı sayılıyor", farkliYazim.kod === 409,
    "geçmişte iki kayıt ayırt edilemez olurdu");

  t("tek şube kaldı", (await oku()).subeler.length === 1);

  const baskaMarka = await gonder({ action: "subeEkle", clientId: 2, ad: "Smell Lara" });
  t("BAŞKA markada aynı ad serbest", baskaMarka.kod === 200,
    "çakışma kuralı marka içinde — iki markanın şubesi aynı adı taşıyabilir");
});

/* ---------------------------------------------------------------- */
await bolum("3) ONAY YOLU — kaydı olan şube onayla siliniyor", 5, async () => {
  await sifirla();
  await gonder({ action: "subeEkle", clientId: 1, ad: "Smell Lara" });
  const subeId = (await oku()).subeler[0].id;

  const veri = await oku();
  veri.haftalikPaylasimlar = [{ id: "p1", clientId: 1, isId: 5, subeId, subeAdi: "Smell Lara", gun: "Pzt", tur: "Video", yapildi: true }];
  await kv.set(KEY, veri);

  const ilk = await gonder({ action: "subeSil", subeId });
  t("onaysız silme reddediliyor", ilk.kod === 409);
  t("sunucu onay istediğini SÖYLÜYOR", ilk.govde.onayGerekli === true,
    "istemci bu bayrağa bakıp onay soruyor");
  t("şube duruyor", (await oku()).subeler.length === 1);

  const onayli = await gonder({ action: "subeSil", subeId, onayliSil: true });
  t("onayla siliniyor", onayli.kod === 200 && (await oku()).subeler.length === 0);
  t("geçmiş korunuyor", (await oku()).haftalikPaylasimlar.length === 1);
});

/* ---------------------------------------------------------------- */
await bolum("4) MARKA KİLİDİ — kilitli hesap başka markaya şube açamıyor", 3, async () => {
  await sifirla();
  const veri = await oku();
  veri.personelHesaplari = [{
    id: "ortak1", kullaniciAdi: "ortak", sifreHash: hash("1234", "s1"), sifreSalt: "s1", ad: "Çözüm Ortağı",
    markalar: ["Smell Coffee"], izinler: { paylasimlar: true },
  }];
  await kv.set(KEY, veri);

  const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
  const ORTAK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

  const kendi = await gonder({ action: "subeEkle", clientId: 1, ad: "Kendi Şubesi" }, ORTAK);
  t("kendi markasına ekleyebiliyor", kendi.kod === 200, "gelen: " + kendi.kod);

  const baskasi = await gonder({ action: "subeEkle", clientId: 2, ad: "İzinsiz Şube" }, ORTAK);
  t("BAŞKA markaya ekleyemiyor", baskasi.kod === 403, "gelen: " + baskasi.kod);
  t("izinsiz şube gerçekten yazılmadı",
    (await oku()).subeler.every((s) => String(s.clientId) !== "2"));
});

/* ---------------------------------------------------------------- */
await bolum("5) ARAYÜZ BAĞLANTISI — onay dalı istemcide gerçekten var", 4, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  t("paylasimIstek onayGerekli dalını işliyor",
    /res\.onayGerekli\s*&&\s*secenekler/.test(app),
    "bu dal yoksa 409 yalnızca uyarı olarak kalır, şube hiç silinemez");
  t("deleteSube onay sonrası onayliSil gönderiyor",
    /onayliSil:\s*true/.test(app));

  const cagrilar = app.match(/<Musteriler[^>]*/g) || [];
  t("Müşteriler ekranı iki yerde de şubeleri alıyor",
    cagrilar.length === 2 && cagrilar.every((c) => /subeler=\{data\.subeler/.test(c)),
    "gelen: " + cagrilar.length);
  t("ekleme ve silme bağlı",
    cagrilar.every((c) => /onAddSube=\{addSube\}/.test(c) && /onDeleteSube=\{deleteSube\}/.test(c)));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
