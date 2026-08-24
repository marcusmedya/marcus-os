/* DRIVE ↔ KART EŞLEŞTİRMESİ — "eksik kart mı var?"
 *
 * Stok sayısı kartlardan fazla göründüğünde iki ihtimal var: sayaç sapmış olabilir
 * (mutabakat bunu gösteriyor), ya da Drive'da içerik var ama sistemde kartı yok.
 * İkincisini ancak Drive'daki dosyalarla kartların dosya kimliklerini karşılaştırarak
 * anlayabiliyoruz.
 *
 * İKİ ŞEY BU TESTİN ASIL İŞİ:
 *
 * 1. ÜRETİM DRIVE'INDA HİÇBİR ŞEY YAZILMAZ. Tarama "bakıyorum" derken klasör açar ya
 *    da dosya taşırsa, teşhis aracı kendisi hasar üretir.
 *
 * 2. ELLE BAĞLANMIŞ İÇERİK "KARTSIZ" SANILMAZ. Kartın dosyası her zaman `medya`
 *    içinde olmuyor; elle yapıştırılmış bağlantı da bir bağdır. Sayılmazsa araç
 *    olmayan bir sorunu var gösterir ve güveni yok eder.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { driveKartEslestir, kartinDosyaKimlikleri } from "../lib/drive-eslestirme.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = privateKey;

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

const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const KART_DOSYA = "KARTLIDOSYA01", KARTSIZ = "KARTSIZDOSYA1", ELLE = "ELLEBAGLIDSY1";

/* ---------------------------------------------------------------- */
await bolum("1) SAF EŞLEŞTİRME", 6, () => {
  const dosyalar = [
    { id: KART_DOSYA, ad: "gorsel1.jpg", klasor: "08 AĞUSTOS/2 ONAYLANANLAR" },
    { id: KARTSIZ, ad: "kimsenin.jpg", klasor: "08 AĞUSTOS/2 ONAYLANANLAR" },
    { id: ELLE, ad: "elle.jpg", klasor: "08 AĞUSTOS/2 ONAYLANANLAR" },
  ];
  const kartlar = [
    { id: 1, icerikTuru: "Görsel 1", asama: "Onaylandı", medya: [{ dosyaId: KART_DOSYA }] },
    { id: 2, icerikTuru: "Elle bağlı", asama: "Onaylandı", editliDosyaLink: `https://drive.google.com/file/d/${ELLE}/view` },
    { id: 3, icerikTuru: "Dosyasız", asama: "Onaylandı" },
    { id: 4, icerikTuru: "Henüz onaysız", asama: "Düzenleniyor", medya: [{ dosyaId: "BASKADOSYA001" }] },
  ];
  const r = driveKartEslestir(dosyalar, kartlar);

  t("kartı olan dosya doğru eşleşti",
    r.kartli.some((x) => x.id === KART_DOSYA && x.isId === 1));
  t("ELLE BAĞLANMIŞ dosya kartsız sayılmıyor",
    r.kartli.some((x) => x.id === ELLE && x.isId === 2),
    "sayılmazsa araç olmayan bir sorunu var gösterir");
  t("gerçekten kartsız dosya bulunuyor",
    r.kartsiz.length === 1 && r.kartsiz[0].id === KARTSIZ, JSON.stringify(r.kartsiz));
  t("dosyası hiç olmayan onaylı kart bildiriliyor",
    r.dosyasizKartlar.length === 1 && r.dosyasizKartlar[0].isId === 3,
    "stoğa sayılıyor ama arkasında içerik yok");
  t("onaylı OLMAYAN kartın dosyası kayıp sayılmıyor",
    !r.kayipDosyalar.some((x) => x.isId === 4),
    "başka aşamadaki kartın dosyası zaten ONAYLANANLAR'da olmaz");
  t("kartın tüm bağlantı biçimleri okunuyor",
    kartinDosyaKimlikleri({ medya: [{ url: `https://drive.google.com/file/d/${KART_DOSYA}/view` }] }).has(KART_DOSYA));
});

/* ---------------------------------------------------------------- */
await bolum("2) UÇ — üretim Drive'ında YAZMA YOK", 5, async () => {
  await kv.set("marcus-os-data", {
    clients: [{ id: 1, ad: "İbo Burger", durum: "aktif",
      driveOnayKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR001" }],
    cekimIsleri: [
      { id: 1, marka: "İbo Burger", kategori: "Fotoğraf", icerikTuru: "GÖRSEL 2", asama: "Onaylandı", medya: [{ dosyaId: KART_DOSYA }] },
    ],
    subeler: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: {},
    musteriTalepleri: [], _alanSurumleri: {},
  });

  const klasorler = new Map([
    ["KOKKLASOR001", { ad: "1 SOSYAL MEDYA", ust: "MARKA0000001" }],
    ["AYKLASOR0001", { ad: "08 AĞUSTOS", ust: "KOKKLASOR001" }],
    ["ONAYLANAN001", { ad: "2 ONAYLANANLAR", ust: "AYKLASOR0001" }],
  ]);
  const klasorDosyalari = { ONAYLANAN001: [{ id: KART_DOSYA, name: "gorsel2.jpg", mimeType: "image/jpeg" },
                                           { id: KARTSIZ, name: "kimsenin.jpg", mimeType: "image/jpeg" }] };
  const yazmaIstekleri = [];
  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    const yontem = (o.method || "GET").toUpperCase();
    if (yontem !== "GET" && !s.includes("oauth2.googleapis.com/token")) yazmaIstekleri.push({ yontem, url: s });
    if (s.includes("oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "j" }) };
    const b = s.match(/drive\/v3\/files\/([A-Za-z0-9_-]+)\?fields=id,name,parents/);
    if (b && klasorler.has(b[1])) {
      const x = klasorler.get(b[1]);
      return { ok: true, status: 200, json: async () => ({ id: b[1], name: x.ad, parents: [x.ust] }) };
    }
    if (s.includes("drive/v3/files?q=")) {
      const q = decodeURIComponent(s.split("files?q=")[1] || "");
      const m = q.match(/'([^']*)'\s+in\s+parents/);
      if (!m) return { ok: true, status: 200, json: async () => ({ files: [] }) };
      if (q.includes("mimeType=")) {
        const c = [...klasorler.entries()].filter(([, x]) => String(x.ust) === String(m[1]))
          .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-08-01T00:00:00Z" }));
        return { ok: true, status: 200, json: async () => ({ files: c }) };
      }
      return { ok: true, status: 200, json: async () => ({ files: klasorDosyalari[m[1]] || [] }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };

  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveEslestir", clientId: 1, islemId: `t85_${Math.random().toString(36).slice(2, 12)}` } });
    const e = r.govde.eslestirme;
    t("eşleştirme geliyor", r.kod === 200 && Boolean(e), JSON.stringify(r.govde));
    t("Drive dosya sayısı okundu", e.driveDosyaSayisi === 2, "gelen: " + e.driveDosyaSayisi);
    t("kartsız dosya bulundu", e.kartsizSayisi === 1 && e.kartsiz[0].ad === "kimsenin.jpg");
    t("hangi ayların tarandığı bildiriliyor", (e.bakilanAylar || []).includes("08 AĞUSTOS"));

    /* ASIL GÜVENCE. */
    t("ÜRETİM DRIVE'INA HİÇ YAZMA GİTMEDİ", yazmaIstekleri.length === 0,
      JSON.stringify(yazmaIstekleri) + " — teşhis aracı hasar üretmemeli");
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("3) DRIVE KURULU DEĞİLSE — sessiz kalmıyor", 2, async () => {
  await kv.set("marcus-os-data", {
    clients: [{ id: 1, ad: "Drivesız", durum: "aktif" }],
    cekimIsleri: [], subeler: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
    gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  const eski = process.env.DRIVE_ONAY_KLASOR_ID;
  delete process.env.DRIVE_ONAY_KLASOR_ID;
  const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
    body: { action: "driveEslestir", clientId: 1, islemId: `t85_${Math.random().toString(36).slice(2, 12)}` } });
  t("istek hata vermiyor", r.kod === 200);
  t("sebep söyleniyor", r.govde.eslestirme === null && Boolean(r.govde.sebep), JSON.stringify(r.govde));
  if (eski) process.env.DRIVE_ONAY_KLASOR_ID = eski;
});

/* ---------------------------------------------------------------- */
await bolum("4) BÜTÇE DOLARSA — sessizce kesilmiyor", 3, async () => {
  /* Marka çok aylıysa tarama sonsuza kadar süremez; bir çağrı bütçesi var.
   * Bütçe dolduğunda liste EKSİK olur — bu söylenmezse araç "kartsız dosya yok"
   * der ve olmayan bir temizliği doğrulamış gibi görünür. */
  const { markaninOnaylananDosyalari } = await import("../lib/drive-tasima.js");

  const aylar = ["01 OCAK", "02 ŞUBAT", "03 MART", "04 NİSAN", "05 MAYIS", "06 HAZİRAN"];
  const klasorler = new Map([["KOKKLASOR001", { ad: "1 SOSYAL MEDYA", ust: "MARKA0000001" }]]);
  aylar.forEach((a, i) => {
    klasorler.set(`AY${i}0000000001`, { ad: a, ust: "KOKKLASOR001" });
    klasorler.set(`ON${i}0000000001`, { ad: "2 ONAYLANANLAR", ust: `AY${i}0000000001` });
  });
  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes("oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "j" }) };
    const b = s.match(/drive\/v3\/files\/([A-Za-z0-9_-]+)\?fields=id,name,parents/);
    if (b && klasorler.has(b[1])) {
      const x = klasorler.get(b[1]);
      return { ok: true, status: 200, json: async () => ({ id: b[1], name: x.ad, parents: [x.ust] }) };
    }
    if (s.includes("drive/v3/files?q=")) {
      const q = decodeURIComponent(s.split("files?q=")[1] || "");
      const m = q.match(/'([^']*)'\s+in\s+parents/);
      if (!m) return { ok: true, status: 200, json: async () => ({ files: [] }) };
      if (q.includes("mimeType=")) {
        const c = [...klasorler.entries()].filter(([, x]) => String(x.ust) === String(m[1]))
          .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-01-01T00:00:00Z" }));
        return { ok: true, status: 200, json: async () => ({ files: c }) };
      }
      return { ok: true, status: 200, json: async () => ({ files: [{ id: `D${m[1]}`, name: "a.jpg", mimeType: "image/jpeg" }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ files: [] }) };
  };
  try {
    const dar = await markaninOnaylananDosyalari({
      markaKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR001", cagriButcesi: 4 });
    t("BÜTÇE DOLUNCA EKSİKLİK BİLDİRİLİYOR", dar.tamamlanmadi === true,
      JSON.stringify({ tamamlanmadi: dar.tamamlanmadi, ay: dar.bakilanAylar }) + " — sessiz kesme, olmayan temizliği doğrulanmış gösterir");
    t("eksik tarama da EN YENİ aydan başlıyor", (dar.bakilanAylar || [])[0] === "06 HAZİRAN",
      JSON.stringify(dar.bakilanAylar));
    const genis = await markaninOnaylananDosyalari({
      markaKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR001", cagriButcesi: 500 });
    t("bütçe yeterken tamam işaretleniyor", genis.tamamlanmadi === false && genis.bakilanAylar.length === 6,
      JSON.stringify({ t: genis.tamamlanmadi, n: genis.bakilanAylar.length }));
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("5) MARKA KLASÖRÜ TANIMSIZ — klasör AÇMAZ", 3, async () => {
  /* Markanın kendi Drive klasörü tanımlı değilken tarama, ortak klasörün altında
   * marka adıyla YENİ bir klasör açıyordu — "bakıyorum" derken üretim Drive'ına
   * yazmak. Aranır, bulunamazsa sebep söylenir. */
  await kv.set("marcus-os-data", {
    clients: [{ id: 7, ad: "Skylon Mimarlık", durum: "aktif" }],   // driveOnayKlasoru YOK
    cekimIsleri: [], subeler: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
    gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  const eskiKok = process.env.DRIVE_ONAY_KLASOR_ID;
  process.env.DRIVE_ONAY_KLASOR_ID = "ORTAKKOK0001";

  const yazmaIstekleri = [];
  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s2 = String(u);
    const yontem = (o.method || "GET").toUpperCase();
    if (yontem !== "GET" && !s2.includes("oauth2.googleapis.com/token")) yazmaIstekleri.push({ yontem, url: s2 });
    if (s2.includes("oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "j" }) };
    /* Ortak kökün altında bu markanın klasörü YOK. */
    if (s2.includes("drive/v3/files?q=")) return { ok: true, status: 200, json: async () => ({ files: [] }) };
    return { ok: true, status: 200, json: async () => ({ id: "YENIKLASOR01" }) };
  };
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveEslestir", clientId: 7, islemId: `t85_${Math.random().toString(36).slice(2, 12)}` } });
    t("istek hata vermiyor", r.kod === 200, JSON.stringify(r.govde));
    t("sebep söyleniyor", r.govde.eslestirme === null && /bulunamadı|tanımlı değil/.test(String(r.govde.sebep || "")),
      JSON.stringify(r.govde));
    t("KLASÖR TANIMSIZKEN DE HİÇ YAZMA YOK", yazmaIstekleri.length === 0,
      JSON.stringify(yazmaIstekleri) + " — tarama marka klasörü açmamalı");
  } finally {
    globalThis.fetch = gercek;
    if (eskiKok) process.env.DRIVE_ONAY_KLASOR_ID = eskiKok; else delete process.env.DRIVE_ONAY_KLASOR_ID;
  }
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
