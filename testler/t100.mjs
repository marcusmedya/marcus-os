/* KARTLARI TOPLU TAŞIMA
 *
 * BU TESTİN ASIL İŞİ:
 *   1. HEDEF AŞAMA KARTIN KATEGORİSİNDE YOKSA TAŞINMAZ. Reels'in "Edit Yapılıyor"ı Post
 *      listesinde yok; yazılsaydı sunucudaki `asamalariDuzelt` tanımadığı aşamayı akışın
 *      BAŞINA çeker, kullanıcı "taşıdım" sanırken kart geri düşerdi.
 *   2. DEĞİŞİKLİK YOKSA AYNI REFERANS. Sürüm sayacı referansa bakıyor; her seferinde yeni
 *      dizi üretmek kart üzerinde çalışan herkesi boşuna 409'a düşürürdü — bu yaşandı.
 *   3. TOPLU GEÇİŞ STOK MOTORUNU HER KART İÇİN ÇALIŞTIRIYOR. Tek kayıtta on kart onaya
 *      girerse stok ondur; motor yalnızca ilkini görseydi sayı sessizce eksik kalırdı.
 *   4. YETKİSİZ TOPLU ONAY GERİ ALINIYOR. Toplu taşıma, tek tek onaylamanın kestirmesi
 *      olmamalı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { tasimaAdaylari, tasimayiUygula, tasimaOzeti, tasinabilirMi } from "../lib/toplu-tasima.js";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import crypto from "node:crypto";
const { default: veriUcu } = await import("../api/data.js");

const KEY = "marcus-os-data";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const PERSONEL = { "x-staff-username-b64": b64("personel"), "x-staff-password-b64": b64("pw") };

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

const ISLER = () => [
  { id: 1, marka: "Smell Coffee", kategori: "Reels", icerikTuru: "Reels 1", asama: "Çekim Yapıldı" },
  { id: 2, marka: "Smell Coffee", kategori: "Post", icerikTuru: "Post 1", asama: "Düzenleniyor" },
  { id: 3, marka: "Smell Coffee", kategori: "Post", icerikTuru: "Post 2", asama: "Onaylandı" },
];

/* ---------------------------------------------------------------- */
await bolum("1) KATEGORİSİNDE OLMAYAN AŞAMAYA TAŞINMIYOR", 5, () => {
  const isler = ISLER();
  t("Reels aşaması Post kartına uygulanmıyor",
    tasinabilirMi(isler[1], "Edit Yapılıyor") === false,
    "sunucudaki aşama onarımı kartı akışın BAŞINA çeker — kullanıcı taşıdım sanır");
  t("kendi kategorisindeki aşama geçerli", tasinabilirMi(isler[0], "Edit Yapılıyor") === true);
  const a = tasimaAdaylari(isler, [1, 2], "Edit Yapılıyor");
  t("uygunsuz kart ayrı gruplanıyor", a.uygunsuz.length === 1 && a.uygunsuz[0].id === 2);
  t("uygun kart taşınacaklarda", a.tasinacak.length === 1 && a.tasinacak[0].id === 1);
  t("özet kullanıcıya sayıyı söylüyor",
    tasimaOzeti(a, "Edit Yapılıyor").includes("taşınamaz"),
    "sessizce atlansaydı '20 seçtim 14 taşındı' sürprizi yaşanırdı");
});

await bolum("2) ZATEN HEDEFTE OLAN KART VE AYNI REFERANS", 4, () => {
  const isler = ISLER();
  const a = tasimaAdaylari(isler, [3], "Onaylandı");
  t("zaten orada olan ayrı gruplanıyor", a.zatenOrada.length === 1 && a.tasinacak.length === 0);
  const r = tasimayiUygula(isler, [3], "Onaylandı");
  t("taşınan yok", r.tasinan === 0);
  t("AYNI REFERANS dönüyor", r.isler === isler,
    "yeni dizi üretmek sürüm sayacını boşuna artırır ve herkesi 409'a düşürür");
  const r2 = tasimayiUygula(isler, [1], "Edit Yapılıyor");
  t("gerçek taşımada yeni referans", r2.isler !== isler && r2.isler[0].asama === "Edit Yapılıyor");
});

await bolum("3) TAŞIMA GEÇMİŞE YAZILIYOR", 3, () => {
  const isler = ISLER();
  const r = tasimayiUygula(isler, [1, 2], "Onaylandı", "Yönetici (CEO)");
  t("iki kart taşındı", r.tasinan === 2);
  const not = r.isler[0].gecmis[r.isler[0].gecmis.length - 1];
  t("eski ve yeni aşama notta", not.aciklama.includes("Çekim Yapıldı") && not.aciklama.includes("Onaylandı"),
    "not: " + not.aciklama);
  t("kimin yaptığı yazıyor", not.yazan === "Yönetici (CEO)");
});

/* ---------------------------------------------------------------- */
/* UÇ: tek kayıtta birden çok kart onaya girerse stok HER KART için işlenmeli. */
const sifirla = (izinler) => kv.set(KEY, {
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }],
  cekimIsleri: ISLER().slice(0, 2),
  subeler: [], stoklar: {}, paylasimGecmisi: [], haftalikPaylasimlar: [],
  personelHesaplari: [{
    id: "p1", ad: "Personel", kullaniciAdi: "personel",
    sifreSalt: "tuz", sifreHash: hash("pw", "tuz"),
    izinler: { cekimEdit: true, ...izinler },
  }],
  _alanSurumleri: {},
});

const kaydet = async (isler, kimlik) => {
  const d = await kv.get(KEY);
  return cagir(veriUcu, {
    method: "POST", query: {},
    headers: kimlik || { "x-site-password": "ownerpw" },
    body: { data: { cekimIsleri: isler }, _v: d._v,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: d._alanSurumleri || {} },
  });
};

await bolum("4) UÇ: TOPLU ONAY HER KART İÇİN STOK ÜRETİYOR", 4, async () => {
  await sifirla({});
  const d = await kv.get(KEY);
  const r = await kaydet(tasimayiUygula(d.cekimIsleri, [1, 2], "Onaylandı", "Yönetici").isler);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const veri = await kv.get(KEY);
  t("iki kart da onayda", (veri.cekimIsleri || []).every((j) => j.asama === "Onaylandı"),
    JSON.stringify((veri.cekimIsleri || []).map((j) => j.asama)));
  const toplam = Object.values(veri.stoklar || {}).reduce((a, b) => a + b, 0);
  t("stok İKİ arttı", toplam === 2, "stok: " + JSON.stringify(veri.stoklar));
  t("her kart ayrı türde sayıldı", Object.keys(veri.stoklar || {}).length === 2,
    "Reels ve Post ayrı anahtar: " + JSON.stringify(veri.stoklar));
});

await bolum("5) UÇ: YETKİSİZ TOPLU ONAY GERİ ALINIYOR", 3, async () => {
  await sifirla({});                                   // kartOnaylama yok
  const d = await kv.get(KEY);
  const r = await kaydet(tasimayiUygula(d.cekimIsleri, [1, 2], "Onaylandı", "Personel").isler, PERSONEL);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  const veri = await kv.get(KEY);
  t("hiçbiri onayda kalmadı", (veri.cekimIsleri || []).every((j) => j.asama !== "Onaylandı"),
    "toplu taşıma, tek tek onaylamanın kestirmesi olmamalı");
  t("STOK ÜRETİLMEDİ", Object.values(veri.stoklar || {}).every((x) => !x),
    "stok: " + JSON.stringify(veri.stoklar));
});

/* ---------------------------------------------------------------- */
/* ONAY KİLİDİ: DOSYA TAŞINAMAZSA AŞAMA GERİ ALINIR **VE BİLDİRİLİR**.
 *
 * İstemci artık bu bildirime GÜVENİYOR: `onaylanamadi` gelince ekranı sunucudan
 * tazeliyor ve toplu taşımayı durduruyor. Bildirim sessizce kalkarsa tarayıcı kartları
 * onayda göstermeye devam eder ve BİR SONRAKİ kayıt o eski hâli sunucuya geri yazar —
 * yani geri alma iptal olur. Sahada tam olarak bu yaşandı: "10 kartın onayı geri alındı"
 * yazdı ama kartlar ekranda onayda kaldı.
 *
 * Drive kurulu ama HER TAŞIMA BAŞARISIZ: gerçek ağ kullanılmıyor, `fetch` taklit ediliyor. */
await bolum("6) UÇ: TAŞIMA BAŞARISIZSA ONAY GERİ ALINIYOR VE BİLDİRİLİYOR", 4, async () => {
  const eskiKok = process.env.DRIVE_ONAY_KLASOR_ID;
  const eskiEposta = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const eskiAnahtar = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.DRIVE_ONAY_KLASOR_ID = "KOK0001";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "servis@ornek.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey;

  await sifirla({});
  const d = await kv.get(KEY);
  /* Kartlarda dosya var — "dosya yok" sebebiyle değil, TAŞIMA başarısız olduğu için
   * geri alınmasını ölçüyoruz. */
  const dosyali = (d.cekimIsleri || []).map((j) => ({ ...j, medya: [{ slot: "1", versiyon: 1, dosyaId: `DOSYA${j.id}` }] }));
  await kv.set(KEY, { ...d, cekimIsleri: dosyali });

  const gercekFetch = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const x = String(u);
    if (x.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    /* Her Drive çağrısı reddediliyor: klasör bulunamıyor, taşıma yapılamıyor. */
    return { ok: false, status: 500, text: async () => "taklit hata", json: async () => ({ error: { message: "taklit hata" } }) };
  };
  try {
    const r = await kaydet(tasimayiUygula(dosyali, [1, 2], "Onaylandı", "Yönetici").isler);
    t("kayıt yanıtı dönüyor", r.kod === 200, "gelen: " + r.kod);
    t("onaylanamayanlar BİLDİRİLİYOR", Array.isArray(r.govde.onaylanamadi) && r.govde.onaylanamadi.length === 2,
      "istemci ekranı buna bakarak tazeliyor; gelen: " + JSON.stringify(r.govde.onaylanamadi));
    const veri = await kv.get(KEY);
    t("aşama BELGEDE de geri alındı", (veri.cekimIsleri || []).every((j) => j.asama !== "Onaylandı"),
      JSON.stringify((veri.cekimIsleri || []).map((j) => j.asama)));
    t("stok üretilmedi", Object.values(veri.stoklar || {}).every((x) => !x),
      "arkasında dosyası olmayan onay stoğa yazılmamalı: " + JSON.stringify(veri.stoklar));
  } finally {
    globalThis.fetch = gercekFetch;
    process.env.DRIVE_ONAY_KLASOR_ID = eskiKok || "";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = eskiEposta || "";
    process.env.GOOGLE_PRIVATE_KEY = eskiAnahtar || "";
  }
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
