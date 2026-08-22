/* SİSTEM SAĞLIĞI — ÖLÇÜM UCU
 *
 * Bu uç veriye dokunmuyor ama İKİ ŞEYİ yanlış yaparsa zarar verir:
 *
 * 1. SIR SIZDIRMA. Ortam değişkenlerinin DEĞERİ asla tarayıcıya gitmemeli; yalnızca
 *    var/yok. Bir kez `process.env` olduğu gibi döndürülürse şifreler, Google özel
 *    anahtarı ve API anahtarları tarayıcıya iner.
 *
 * 2. ÜRETİM DRIVE'INDA YAZMA. Sağlık kontrolü "çalışıyor mu" diye deneme klasörü
 *    açarsa kullanıcının canlı Drive'ı çöplenir. Kontrol SALT OKUNUR olmalı;
 *    doğrulanamayan yetenek "doğrulanamadı" diye bildirilmeli.
 *
 * Ayrıca yetki: ölçüm iç bilgi (veri boyutu, kayıt sayıları, yapılandırma) — yalnızca
 * yönetici görebilir.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { belgeOlcumu, ozetSayilar, boyutDurumu, degiskenDurumu, yaklasikBoyut,
         kayitSayisi, BOYUT_ESIKLERI } from "../lib/sistem-sagligi.js";
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

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
const b64 = (x) => Buffer.from(x, "utf8").toString("base64");

const BELGE = () => ({
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }, { id: 2, ad: "Başka", durum: "aktif" }],
  cekimIsleri: [{ id: 1, marka: "Smell Coffee", icerikTuru: "ü".repeat(200) }],
  subeler: [{ id: "lara", ad: "Lara", clientId: 1 }],
  haftalikPaylasimlar: [{ id: "p1" }, { id: "p2" }],
  islemGecmisi: [{ id: 1 }, { id: 2 }, { id: 3 }],
  silinenler: [{ id: 9 }],
  sonYedekTarihi: "22.08.2026",
  personelHesaplari: [{ id: "p1", kullaniciAdi: "ortak", sifreHash: hash("1234", "s1"), sifreSalt: "s1", izinler: { paylasimlar: true } }],
  musteriHesaplari: [],
  _v: 7, _alanSurumleri: { clients: 3 },
});
const sifirla = () => kv.set(KEY, BELGE());
const iste = (govde, basliklar) => cagir(veriUcu, { method: "POST", headers: basliklar || OWNER, body: govde });

/* ---------------------------------------------------------------- */
await bolum("1) YETKİ — ölçüm iç bilgi", 4, async () => {
  await sifirla();
  const owner = await iste({ sistemAction: "saglik" });
  t("yönetici ölçüm alabiliyor", owner.kod === 200, JSON.stringify(owner.govde && owner.govde.error));

  const ORTAK = { "x-staff-username-b64": b64("ortak"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };
  const personel = await iste({ sistemAction: "saglik" }, ORTAK);
  t("personel/çözüm ortağı ALAMIYOR", personel.kod === 403, "gelen: " + personel.kod);

  const kimliksiz = await iste({ sistemAction: "saglik" }, { "content-type": "application/json" });
  t("kimliksiz istek ALAMIYOR", kimliksiz.kod === 403 || kimliksiz.kod === 401,
    "gelen: " + kimliksiz.kod);

  const yanlisIslem = await iste({ sistemAction: "birseyler" });
  t("tanınmayan sistem işlemi reddediliyor", yanlisIslem.kod === 400);
});

/* ---------------------------------------------------------------- */
await bolum("2) SIR SIZINTISI — değerler ASLA gitmiyor", 5, async () => {
  await sifirla();
  process.env.GOOGLE_PRIVATE_KEY = "GIZLI-OZEL-ANAHTAR-DEGERI";
  process.env.RESEND_API_KEY = "GIZLI-RESEND-ANAHTARI";
  const r = await iste({ sistemAction: "saglik" });
  const metin = JSON.stringify(r.govde);

  t("özel anahtar DEĞERİ yanıtta yok", !metin.includes("GIZLI-OZEL-ANAHTAR-DEGERI"));
  t("Resend anahtarı DEĞERİ yanıtta yok", !metin.includes("GIZLI-RESEND-ANAHTARI"));
  t("yönetici şifresi yanıtta yok", !metin.includes("ownerpw"));
  t("değişkenler yalnızca var/yok taşıyor",
    r.govde.degiskenler.liste.every((d) => typeof d.var === "boolean" && !("deger" in d)));
  t("kritik eksikler ayrıca bildiriliyor", Array.isArray(r.govde.degiskenler.eksikKritik));
  delete process.env.GOOGLE_PRIVATE_KEY; delete process.env.RESEND_API_KEY;
});

/* ---------------------------------------------------------------- */
await bolum("3) ÖLÇÜM DOĞRU — ve veriye DOKUNMUYOR", 6, async () => {
  await sifirla();
  const oncekiBelge = JSON.stringify(await kv.get(KEY));
  const r = await iste({ sistemAction: "saglik" });

  t("kayıt sayıları doğru",
    r.govde.ozet.operasyonKarti === 1 && r.govde.ozet.musteri === 2
    && r.govde.ozet.sube === 1 && r.govde.ozet.haftalikPaylasim === 2
    && r.govde.ozet.islemGecmisi === 3 && r.govde.ozet.silinen === 1,
    JSON.stringify(r.govde.ozet));
  t("son yedek tarihi geliyor", r.govde.ozet.sonYedek === "22.08.2026");
  t("toplam boyut ölçülüyor", r.govde.olcum.toplamBayt > 200);
  t("en büyük alan başta", r.govde.olcum.enBuyukler[0].alan === "cekimIsleri",
    r.govde.olcum.enBuyukler.map((x) => x.alan).join(","));
  t("iç muhasebe alanları listelenmiyor",
    !r.govde.olcum.enBuyukler.some((x) => x.alan.startsWith("_")));

  /* ASIL GÜVENCE: ölçüm bir OKUMA işlemi. */
  t("BELGE HİÇ DEĞİŞMEDİ", JSON.stringify(await kv.get(KEY)) === oncekiBelge,
    "ölçüm yazma yaparsa her bakış veriyi kirletir");
});

/* ---------------------------------------------------------------- */
await bolum("4) DRIVE KONTROLÜ — üretim Drive'ında YAZMA YOK", 5, async () => {
  await sifirla();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.GOOGLE_PRIVATE_KEY = privateKey;
  process.env.DRIVE_ONAY_KLASOR_ID = "KOKKLASOR0001";
  process.env.GOOGLE_OAUTH_CLIENT_ID = "id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "refresh";

  const yazmaIstekleri = [];
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    const yontem = (opt.method || "GET").toUpperCase();
    if (yontem !== "GET" && !u.includes("oauth2.googleapis.com/token")) {
      yazmaIstekleri.push({ yontem, url: u });
    }
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    if (u.includes("drive/v3/about")) {
      return { ok: true, status: 200, json: async () => ({ user: { emailAddress: "a@b.c" }, storageQuota: { limit: "100", usage: "10" } }) };
    }
    if (/drive\/v3\/files\/KOKKLASOR0001\?/.test(u)) {
      return { ok: true, status: 200, json: async () => ({ id: "KOKKLASOR0001", name: "SOSYAL MEDYA", trashed: false, capabilities: { canAddChildren: true, canListChildren: true } }) };
    }
    if (u.includes("drive/v3/files?q=")) {
      return { ok: true, status: 200, json: async () => ({ files: [{ id: "a", name: "08 AĞUSTOS" }] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  try {
    const r = await iste({ sistemAction: "saglik", driveDahil: true });
    const d = r.govde.drive;
    const adim = (ad) => (d.adimlar.find((x) => x.ad === ad) || {}).durum;

    t("Drive raporu geliyor", Boolean(d) && Array.isArray(d.adimlar), JSON.stringify(d));
    t("ana klasöre erişim raporlanıyor", adim("Ana klasöre erişim") === "tamam");
    t("klasör açma yeteneği DENENMEDEN okundu",
      adim("Servis hesabı klasör açabiliyor") === "tamam",
      "Drive'ın capabilities alanından — deneme klasörü açılmadı");
    t("OAuth yükleme tarafı raporlanıyor", adim("OAuth yükleme kimliği") === "tamam");

    /* ASIL GÜVENCE. */
    t("ÜRETİM DRIVE'INA HİÇ YAZMA GİTMEDİ", yazmaIstekleri.length === 0,
      JSON.stringify(yazmaIstekleri));
  } finally {
    globalThis.fetch = gercek;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL; delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.DRIVE_ONAY_KLASOR_ID; delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET; delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }
});

/* ---------------------------------------------------------------- */
await bolum("5) DRIVE BOZUKKEN — rapor eksik kalmıyor", 4, async () => {
  await sifirla();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.GOOGLE_PRIVATE_KEY = privateKey;
  process.env.DRIVE_ONAY_KLASOR_ID = "KOKKLASOR0001";

  const gercek = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    /* Kullanıcı klasörü ELLE ÇÖPE ATMIŞ — sessizce "tamam" denmemeli. */
    if (/drive\/v3\/files\/KOKKLASOR0001\?/.test(u)) {
      return { ok: true, status: 200, json: async () => ({ id: "KOKKLASOR0001", name: "SOSYAL MEDYA", trashed: true }) };
    }
    return { ok: true, status: 200, json: async () => ({ files: [] }) };
  };
  try {
    const r = await iste({ sistemAction: "saglik", driveDahil: true });
    const d = r.govde.drive;
    const erisim = d.adimlar.find((x) => x.ad === "Ana klasöre erişim") || {};
    t("çöpe atılmış klasör HATA olarak bildiriliyor", erisim.durum === "hata",
      JSON.stringify(erisim));
    t("sebep kullanıcıya anlatılıyor", /ÇÖP KUTUSUNDA/.test(erisim.not || ""));
    t("OAuth tanımsızsa eksik olarak bildiriliyor",
      d.adimlar.some((x) => x.ad === "OAuth kimliği" && x.durum === "eksik"));
    t("hata sayısı raporlanıyor", d.hataSayisi >= 2, "gelen: " + d.hataSayisi);
  } finally {
    globalThis.fetch = gercek;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL; delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.DRIVE_ONAY_KLASOR_ID;
  }
});

/* ---------------------------------------------------------------- */
await bolum("6) SAF HESAPLAR — sınır durumları", 6, () => {
  t("boş belge çökmüyor", belgeOlcumu(null).toplamBayt >= 0 && ozetSayilar(undefined).musteri === 0);
  t("Türkçe karakter BAYT olarak sayılıyor", yaklasikBoyut("üğşç") > 4,
    "uzunluk sayılsaydı Türkçe belge olduğundan küçük görünürdü");
  t("nesne alanların anahtar sayısı", kayitSayisi({ a: 1, b: 2 }) === 2 && kayitSayisi([1]) === 1);
  t("sayı olmayan alan null", kayitSayisi("metin") === null);
  t("boyut eşikleri", boyutDurumu(0) === "normal"
    && boyutDurumu(BOYUT_ESIKLERI.dikkat) === "dikkat"
    && boyutDurumu(BOYUT_ESIKLERI.yuksek) === "yuksek");
  t("boş metinli değişken TANIMLI sayılmıyor",
    degiskenDurumu({ SITE_PASSWORD: "   " }).eksikKritik.includes("SITE_PASSWORD"),
    "boş değer tanımsızla aynı sonucu verir ama yeşil görünürdü");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
