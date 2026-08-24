/* DRIVE OTORİTELİ STOK — UÇ DAVRANIŞI
 *
 * Stokta son söz Drive'ın. Bu, güçlü ama tehlikeli bir karar: Drive EKSİK okunduğunda
 * "içerik azalmış" gibi görünür ve gerçekte duran içerik stoktan silinir. Bu testin
 * asıl işi o fren:
 *
 *   EKSİK TARAMA ASLA STOK YAZMAZ.
 *
 * İkinci iş: şube stoğuna dokunulmaması. Bir dosyanın hangi şubede paylaşıldığı
 * Drive'da yazmıyor; Drive'a bakıp şube satırı yazmak uydurma olurdu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";

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
const kimlik = () => `t87_${Math.random().toString(36).slice(2, 12)}`;

const R1 = "REELSBIR00001", R2 = "REELSIKI00001", G1 = "GORSELBIR0001";

/** Drive'ı taklit eder. `ayAdedi` kadar ay üretir; her ayın ONAYLANANLAR'ı verilen dosyaları taşır. */
function driveTaklidi({ aylikDosyalar, hataVer = false }) {
  const klasorler = new Map([["KOKKLASOR001", { ad: "1 SOSYAL MEDYA", ust: "MARKA0000001" }]]);
  Object.keys(aylikDosyalar).forEach((ay, i) => {
    klasorler.set(`AY${i}0000000001`, { ad: ay, ust: "KOKKLASOR001" });
    klasorler.set(`ON${i}0000000001`, { ad: "2 ONAYLANANLAR", ust: `AY${i}0000000001` });
  });
  const dosyaHaritasi = {};
  Object.keys(aylikDosyalar).forEach((ay, i) => { dosyaHaritasi[`ON${i}0000000001`] = aylikDosyalar[ay]; });

  return async (u, o = {}) => {
    const s = String(u);
    if (s.includes("oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "j" }) };
    if (hataVer) return { ok: false, status: 500, json: async () => ({ error: "patladı" }) };
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
      return { ok: true, status: 200, json: async () => ({ files: dosyaHaritasi[m[1]] || [] }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };
}

const belge = (stoklar) => ({
  clients: [{ id: 1, ad: "Skylon Mimarlık", durum: "aktif",
    driveOnayKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR001" }],
  cekimIsleri: [
    { id: 1, marka: "Skylon Mimarlık", icerikTuru: "Reels tanıtım", asama: "Onaylandı", medya: [{ dosyaId: R1 }] },
    { id: 2, marka: "Skylon Mimarlık", icerikTuru: "Reels menü", asama: "Onaylandı", medya: [{ dosyaId: R2 }] },
    { id: 3, marka: "Skylon Mimarlık", icerikTuru: "Görsel kampanya", asama: "Onaylandı", medya: [{ dosyaId: G1 }] },
  ],
  subeler: [{ id: 9, clientId: 1, ad: "Lara" }],
  haftalikPaylasimlar: [], paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [],
  stoklar, _alanSurumleri: {},
});

/* ---------------------------------------------------------------- */
await bolum("1) RAPOR — durum ve tür kırılımı, kart adlarıyla", 4, async () => {
  await kv.set("marcus-os-data", belge({ "1_Reels": 3, "1_Post": 1 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [
    { id: R1, name: "reels1.mp4", mimeType: "video/mp4" },
    { id: R2, name: "reels2.mp4", mimeType: "video/mp4" },
  ] } });
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveEslestir", clientId: 1, islemId: kimlik() } });
    const e = r.govde.eslestirme;
    t("ONAYLANANLAR tür kırılımı geliyor",
      e && JSON.stringify(e.durumlar.onaylanan.turler) === JSON.stringify({ Reels: 2 }),
      JSON.stringify(e && e.durumlar));
    t("kart ADLARI raporda",
      e.durumlar.onaylanan.kartlar.some((x) => x.isAdi === "Reels tanıtım"));
    t("STOK FARKI hesaplanıyor",
      e.stokFarklari.some((f) => f.tur === "Reels" && f.kayitli === 3 && f.driveGore === 2)
      && e.stokFarklari.some((f) => f.tur === "Post" && f.driveGore === 0),
      JSON.stringify(e.stokFarklari));
    t("DOSYASI DRIVE'DA HİÇ OLMAYAN onaylı kart bildiriliyor",
      e.kayipDosyalar.length === 1 && e.kayipDosyalar[0].isId === 3 && e.kayipDosyalar[0].tumuKayip === true,
      JSON.stringify(e.kayipDosyalar) + " — stok onu sayıyor ama arkasında içerik yok");
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("2) UYGULA — Drive sayısı yazılıyor, şube stoğu korunuyor", 5, async () => {
  await kv.set("marcus-os-data", belge({ "1_Reels": 3, "1_Post": 1, "1_9_Reels": 5 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [
    { id: R1, name: "reels1.mp4", mimeType: "video/mp4" },
    { id: R2, name: "reels2.mp4", mimeType: "video/mp4" },
  ] } });
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveStokUygula", clientId: 1, islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    t("istek başarılı", r.kod === 200 && !r.govde.uygulanmadi, JSON.stringify(r.govde));
    t("genel Reels stoğu Drive'a eşitlendi", d.stoklar["1_Reels"] === 2, JSON.stringify(d.stoklar));
    t("dosyası olmayan kartın türü sıfırlandı", d.stoklar["1_Post"] === 0, JSON.stringify(d.stoklar));
    t("ŞUBE STOĞUNA DOKUNULMADI", d.stoklar["1_9_Reels"] === 5,
      JSON.stringify(d.stoklar) + " — hangi şubede paylaşıldığı Drive'da yazmıyor");
    t("değişiklik geçmişe eski/yeni değerle yazıldı",
      (d.paylasimGecmisi || []).some((x) => x.islem === "Drive denetimi" && x.eski === 3 && x.yeni === 2),
      JSON.stringify(d.paylasimGecmisi));
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("3) EKSİK TARAMA — STOK YAZILMAZ (asıl fren)", 3, async () => {
  /* Bütçe dolduğunda ya da Drive okunamadığında liste eksik gelir. O sayıyı yazmak,
   * gerçekte duran içeriği stoktan silmek demek. */
  await kv.set("marcus-os-data", belge({ "1_Reels": 3, "1_Post": 1 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: {}, hataVer: true });
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveStokUygula", clientId: 1, islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    t("uygulanmadığı SÖYLENİYOR", r.govde.uygulanmadi === true && Boolean(r.govde.sebep),
      JSON.stringify(r.govde));
    t("STOK OLDUĞU GİBİ DURUYOR", d.stoklar["1_Reels"] === 3 && d.stoklar["1_Post"] === 1,
      JSON.stringify(d.stoklar) + " — eksik okuma yüzünden içerik silinmemeli");
    t("geçmişe sahte düzeltme yazılmadı",
      !(d.paylasimGecmisi || []).some((x) => x.islem === "Drive denetimi"));
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("4) TOPLU KAYIP FRENİ", 2, async () => {
  const cokStok = { "1_Reels": 25, "1_Post": 1 };
  await kv.set("marcus-os-data", belge(cokStok));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [] } });
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveStokUygula", clientId: 1, islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    t("toplu düşüş engellendi", r.govde.uygulanmadi === true && /fren/i.test(String(r.govde.sebep)),
      JSON.stringify(r.govde));
    t("stok korundu", d.stoklar["1_Reels"] === 25, JSON.stringify(d.stoklar));
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("5) YARIDA KESİLEN TARAMA — en tehlikeli hâl", 3, async () => {
  /* Drive OKUNUYOR, hata da yok — ama marka çok aylı olduğu için çağrı bütçesi
   * dolmuş ve liste yarıda kesilmiş. Sayılar "gerçek" görünür; yazılırsa taranmamış
   * aylardaki içerik stoktan SİLİNİR. Fren tam burada çalışmalı.
   *
   * Not: 3. bölümdeki "Drive patladı" hâli bu freni sınamıyor — orada liste hiç
   * gelmediği için fark da hesaplanmıyor. Ölçüldü: fren kaldırıldığında 3. bölüm
   * hiçbir şey söylemedi. */
  const cokAy = {};
  /* Gerçek ay adları kullanılıyor: tarama yalnızca ay biçimindeki klasörleri geziyor,
   * uydurma adlar hiç ay bulunamadı hâline düşer ve bölüm başka bir şeyi sınardı. */
  const AYLAR = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
    "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
  /* Ad AY ADIYLA BAŞLAMALI ("AĞUSTOS 2026"); "2026 08 AĞUSTOS" ay sayılmıyor ve
   * bölüm "ay bulunamadı" hâline düşerdi — ölçüldü. */
  for (let y = 2023; y <= 2026; y++) AYLAR.forEach((ay) => { cokAy[`${ay} ${y}`] = []; });
  cokAy["AĞUSTOS 2026"] = [{ id: R1, name: "reels1.mp4", mimeType: "video/mp4" }];

  await kv.set("marcus-os-data", belge({ "1_Reels": 3, "1_Post": 1 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: cokAy });
  try {
    const rapor = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveEslestir", clientId: 1, islemId: kimlik() } });
    t("tarama gerçekten yarıda kesildi", rapor.govde.eslestirme.tamamlanmadi === true,
      "bu doğru değilse bölüm bir şey sınamıyor: " + JSON.stringify(rapor.govde.eslestirme.bakilanAylar || []).slice(0, 120));

    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveStokUygula", clientId: 1, islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    t("EKSİK LİSTEYLE STOK YAZILMADI", r.govde.uygulanmadi === true && /tamamlanmadı/i.test(String(r.govde.sebep)),
      JSON.stringify(r.govde));
    t("stok olduğu gibi duruyor", d.stoklar["1_Reels"] === 3 && d.stoklar["1_Post"] === 1,
      JSON.stringify(d.stoklar) + " — taranmamış aylardaki içerik silinmemeli");
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("6) AY KLASÖRÜ YOK — 'içerik yok' sanılmıyor", 3, async () => {
  /* BULGU. Markanın Drive klasörü var ama içinde ay klasörü yok (yapı farklı, bağlantı
   * başka klasörü gösteriyor, ya da erişim kısıtlı). Tarama "0 dosya, tamamlandı"
   * diyordu ve Drive otoriteli stok BÜTÜN SAYILARI SIFIRLIYORDU. "Hiç dosya görmedim"
   * ile "hiç klasör bulamadım" aynı şey değil. */
  await kv.set("marcus-os-data", belge({ "1_Reels": 3, "1_Post": 1 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: {} });     // hiç ay klasörü yok
  try {
    const rapor = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveEslestir", clientId: 1, islemId: kimlik() } });
    t("ay bulunamadığı bildiriliyor", rapor.govde.eslestirme.ayBulunamadi === true,
      JSON.stringify(rapor.govde.eslestirme && rapor.govde.eslestirme.toplamAy));

    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "driveStokUygula", clientId: 1, islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    t("STOK SIFIRLANMADI", d.stoklar["1_Reels"] === 3 && d.stoklar["1_Post"] === 1,
      JSON.stringify(d.stoklar) + " — klasör yapısı okunamadı diye içerik silinemez");
    t("sebep söyleniyor", r.govde.uygulanmadi === true && /klasör/i.test(String(r.govde.sebep)),
      JSON.stringify(r.govde));
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("7) KARTSIZ DOSYADAN KART AÇ", 7, async () => {
  const KARTSIZ = "KARTSIZDOSYA1", KARTSIZ2 = "KARTSIZVIDEO1";
  await kv.set("marcus-os-data", belge({ "1_Reels": 2 }));
  const gercek = globalThis.fetch;
  globalThis.fetch = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [
    { id: R1, name: "reels1.mp4", mimeType: "video/mp4" },
    { id: KARTSIZ, name: "kimsesiz.jpg", mimeType: "image/jpeg" },
    { id: KARTSIZ2, name: "tanitim reels.mp4", mimeType: "video/mp4" },
  ] } });
  try {
    const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "kartsizdanKartAc", clientId: 1, dosyaIdleri: [KARTSIZ, KARTSIZ2], islemId: kimlik() } });
    const d = await kv.get("marcus-os-data");
    const yeniler = (d.cekimIsleri || []).filter((j) => j.driveDenetimindenAcildi);

    t("iki kart açıldı", yeniler.length === 2, JSON.stringify(r.govde).slice(0, 200));
    t("kart DOSYAYA BAĞLI", yeniler.some((j) => (j.medya || []).some((m) => m.dosyaId === KARTSIZ)),
      "bağlanmazsa bir sonraki taramada yine kartsız görünür");
    t("aşama DOSYANIN KLASÖRÜNDEN geliyor", yeniler.every((j) => j.asama === "Onaylandı"),
      yeniler.map((j) => j.asama).join(",") + " — dosya ONAYLANANLAR'da");
    t("kategori dosya adından tahmin ediliyor",
      yeniler.find((j) => j.icerikTuru.includes("tanitim")).kategori === "Video"
      && yeniler.find((j) => j.icerikTuru.includes("kimsesiz")).kategori === "Fotoğraf",
      JSON.stringify(yeniler.map((j) => [j.icerikTuru, j.kategori])));
    t("nereden geldiği kartın geçmişine yazıldı",
      yeniler.every((j) => JSON.stringify(j.gecmis).includes("Drive denetiminde")));

    /* YARIŞ: TARAMA SÜRERKEN BAŞKASI KARTI AÇARSA.
     *
     * Tarama kilit DIŞINDA yapılıyor (Google çağrıları saniyeler sürüyor). O aralıkta
     * biri aynı dosya için kart açabilir. İkinci kart açılırsa aynı içerik stoğa İKİ
     * KEZ sayılır — düzeltmeye çalıştığımız sapmanın ta kendisi. */
    const KARTSIZ3 = "YARISDOSYASI1";
    await kv.set("marcus-os-data", belge({ "1_Reels": 2 }));
    let yarisKuruldu = false;
    const taklit = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [
      { id: KARTSIZ3, name: "yaris.jpg", mimeType: "image/jpeg" },
    ] } });
    globalThis.fetch = async (u, o) => {
      const yanit = await taklit(u, o);
      if (!yarisKuruldu && String(u).includes("files?q=")) {
        yarisKuruldu = true;
        const ara = await kv.get("marcus-os-data");
        ara.cekimIsleri = [...(ara.cekimIsleri || []), { id: 900, marka: "Skylon Mimarlık",
          icerikTuru: "Başkası açtı", asama: "Onaylandı", medya: [{ dosyaId: KARTSIZ3 }] }];
        await kv.set("marcus-os-data", ara);
      }
      return yanit;
    };
    const rY = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "kartsizdanKartAc", clientId: 1, dosyaIdleri: [KARTSIZ3], islemId: kimlik() } });
    const dY = await kv.get("marcus-os-data");
    t("YARIŞTA İKİNCİ KART AÇILMIYOR",
      (dY.cekimIsleri || []).filter((j) => (j.medya || []).some((m) => m.dosyaId === KARTSIZ3)).length === 1,
      JSON.stringify(rY.govde).slice(0, 160) + " — aynı dosya iki kart = stok iki kez sayar");
    globalThis.fetch = driveTaklidi({ aylikDosyalar: { "08 AĞUSTOS": [
      { id: R1, name: "reels1.mp4", mimeType: "video/mp4" },
      { id: KARTSIZ, name: "kimsesiz.jpg", mimeType: "image/jpeg" },
      { id: KARTSIZ2, name: "tanitim reels.mp4", mimeType: "video/mp4" },
    ] } });
    await kv.set("marcus-os-data", { ...(await kv.get("marcus-os-data")), cekimIsleri: d.cekimIsleri });

    /* AYNI İSTEK İKİNCİ KEZ: dosyaların artık kartı var, ikinci kart AÇILMAMALI. */
    const r2 = await cagir(paylasimUcu, { method: "POST", headers: OWNER,
      body: { action: "kartsizdanKartAc", clientId: 1, dosyaIdleri: [KARTSIZ, KARTSIZ2], islemId: kimlik() } });
    const d2 = await kv.get("marcus-os-data");
    t("İKİNCİ KART AÇILMIYOR",
      (d2.cekimIsleri || []).filter((j) => j.driveDenetimindenAcildi).length === 2 && r2.govde.acilmadi === true,
      JSON.stringify(r2.govde) + " — aynı dosya için iki kart, stoğu iki sayardı");
  } finally { globalThis.fetch = gercek; }
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
