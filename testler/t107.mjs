/* ŞİRKET KÂR HESABI — computeLive (src/tema.jsx)
 *
 * BU TESTİN NEDEN VAR OLDUĞU:
 *   Şirketin aylık gelir/gider/kâr hesabı `src/tema.jsx` içinde ve `.jsx` Node'dan
 *   doğrudan import edilemiyor. Bu yüzden para hesabının EN ÜST satırı — "bu ay ne
 *   kazandım" — bu projede hiçbir zaman ÇAĞRILARAK sınanmamıştı; yalnızca kaynak metnine
 *   bakılabiliyordu. Aynı sebeple `lib/odeme-hesabi.js` bir zamanlar tema.jsx'ten
 *   taşınmıştı.
 *
 *   Burada başka bir yol kullanılıyor: dosya, PROJENİN ZATEN KULLANDIĞI esbuild ile
 *   (denetim 1b de onu kullanıyor) çevrilip geçici bir `.mjs` olarak yazılıyor ve
 *   çağrılıyor. Yeni bağımlılık YOK. Geçici dosya `testler/` altına yazılıyor: oradaki
 *   `../lib/...` yolları kaynaktakiyle birebir aynı çözülüyor.
 *
 * BU TESTİN ASIL İŞİ:
 *   1. FREELANCER ÜCRETLERİ GİDERE GİRİYOR. Girmediği sürece şirket kârı olduğundan
 *      YÜKSEK görünüyordu: para kasadan çıkıyor (`odemeler`), kârdan düşmüyordu.
 *   2. CİRO TAHAKKUK, TAHSİLAT NAKİT — ikisi ayrı rakam ve karışmamalı.
 *   3. EKSİK ÜCRET BİLDİRİLİYOR. Ücreti tanımsız iş maliyete 0 yazar; sessiz kalınırsa
 *      gider düşük, kâr yüksek çıkar.
 *   4. AYRILMIŞ/DONDURULMUŞ MÜŞTERİ CİROYA GİRMEZ.
 */
import { transform } from "esbuild";
import { readFileSync, writeFileSync, rmSync } from "fs";
import path from "node:path";

const kok = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const gecici = path.join(kok, "testler", ".gecici-tema.mjs");

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

/* GEÇİCİ DOSYA HER HÂLÜKÂRDA SİLİNİR — testin yarıda kesilmesi kaynağa çöp bırakmamalı. */
const temizle = () => { try { rmSync(gecici, { force: true }); } catch { /* yoksa sorun değil */ } };
process.on("exit", temizle);
process.on("SIGINT", () => { temizle(); process.exit(130); });

const { code } = await transform(readFileSync(path.join(kok, "src/tema.jsx"), "utf8"),
  { loader: "jsx", format: "esm", target: "node18" });
writeFileSync(gecici, code);
const { computeLive } = await import(gecici);

const buAy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const buGun = `${buAy}-15`;

const dunya = (ek = {}) => ({
  clients: [{ id: 1, ad: "Animed", durum: "aktif", aylikUcret: 30000 }],
  cekimIsleri: [],
  isUcretleri: {}, isUcretDetaylari: {},
  gelirKalemleri: [], giderKalemleri: [], ofisGiderleri: [],
  personel: [], uyelikler: [], bekleyenTahsilatlar: [],
  ...ek,
});

/* ---------------------------------------------------------------- */
await bolum("1) FREELANCER ÜCRETLERİ GİDERE GİRİYOR", 5, () => {
  const bos = computeLive(dunya());
  t("freelancer işi yokken gider sıfır", bos.freelancerGideri === 0 && bos.gider === 0);
  t("kâr = ciro", bos.net === 30000);

  const isli = computeLive(dunya({
    cekimIsleri: [{ id: 1, marka: "Animed", kameraman: "Önder", editor: "Atalay",
      teslimEdilmeTarihi: buGun }],
    isUcretleri: { "Önder": 1000, "Atalay": 1500 },
  }));
  t("freelancer gideri hesaplanıyor", isli.freelancerGideri === 2500,
    `gelen: ${isli.freelancerGideri}`);
  t("TOPLAM GİDERE giriyor", isli.gider === 2500,
    `gelen: ${isli.gider} — girmezse kâr olduğundan yüksek görünür`);
  t("kâr gerçekten düşüyor", isli.net === 27500, `gelen: ${isli.net}`);
});

/* ---------------------------------------------------------------- */
await bolum("2) MARKASIZ İŞ DE GİDERE GİRİYOR", 2, () => {
  const v = computeLive(dunya({
    cekimIsleri: [{ id: 1, marka: "", editor: "Atalay", teslimEdilmeTarihi: buGun }],
    isUcretleri: { "Atalay": 1500 },
  }));
  t("markası girilmemiş işin ücreti sayılıyor", v.freelancerGideri === 1500,
    `gelen: ${v.freelancerGideri} — marka marka toplansaydı bu iş sessizce kaybolurdu`);
  t("kâra yansıyor", v.net === 28500);
});

/* ---------------------------------------------------------------- */
await bolum("3) CİRO TAHAKKUK, TAHSİLAT NAKİT", 3, () => {
  const v = computeLive(dunya());
  t("ciro hak edilen (tahsil edilmese de)", v.ciro === 30000);
  t("tahsilat AYRI ve hiç ödeme yokken sıfır", v.tahsilEdilen === 0,
    `gelen: ${v.tahsilEdilen} — ciro ile karışırsa ödenmemiş para alınmış sanılır`);
  t("ikisi farklı alan", v.ciro !== v.tahsilEdilen);
});

/* ---------------------------------------------------------------- */
await bolum("4) EKSİK ÜCRET BİLDİRİLİYOR", 3, () => {
  const v = computeLive(dunya({
    cekimIsleri: [{ id: 1, marka: "Animed", editor: "Tanımsız Kişi", teslimEdilmeTarihi: buGun }],
    isUcretleri: {},
  }));
  t("tanımsız ücret 0 ₺ yazıyor", v.freelancerGideri === 0);
  t("ama SESSİZ KALINMIYOR", v.isUcretiEksik === 1,
    "sessiz kalsaydı gider düşük, kâr yüksek görünürdü ve sebebi hiçbir yerde yazmazdı");
  t("ücret girilince rakam doğruluyor",
    computeLive(dunya({
      cekimIsleri: [{ id: 1, marka: "Animed", editor: "Tanımsız Kişi", teslimEdilmeTarihi: buGun }],
      isUcretleri: { "Tanımsız Kişi": 900 },
    })).isUcretiEksik === 0);
});

/* ---------------------------------------------------------------- */
await bolum("5) AYRILMIŞ MÜŞTERİ CİROYA GİRMEZ", 6, () => {
  const v = computeLive(dunya({
    clients: [
      { id: 1, ad: "Animed", durum: "aktif", aylikUcret: 30000 },
      { id: 2, ad: "Giden", durum: "ayrildi", aylikUcret: 50000 },
      { id: 3, ad: "Donan", durum: "donduruldu", aylikUcret: 40000 },
    ],
  }));
  t("yalnızca aktif marka sayılıyor", v.ciro === 30000, `gelen: ${v.ciro}`);
  t("ayrılan markanın ücreti ciroyu şişirmiyor", v.recurring === 30000);
  t("kâr da doğru", v.net === 30000);

  /* GELİR–GİDER SİMETRİSİ: bir markayı dondurduğunda geliri düşüyordu ama AYLIK
   * MALİYETİ kârdan düşmeye devam ediyordu. Yani bıraktığın müşteri her ay zarar
   * yazmayı sürdürüyordu. Sahadan bildirildi. */
  const maliyetli = computeLive(dunya({
    clients: [
      { id: 1, ad: "Animed", durum: "aktif", aylikUcret: 30000,
        maliyetler: [{ id: 1, kalem: "Prodüksiyon", tutar: 4000 }] },
      { id: 2, ad: "Donan", durum: "donduruldu", aylikUcret: 50000,
        maliyetler: [{ id: 1, kalem: "Prodüksiyon", tutar: 9000 }] },
    ],
  }));
  t("aktif markanın maliyeti sayılıyor", maliyetli.clientCosts === 4000,
    `gelen: ${maliyetli.clientCosts}`);
  t("DONDURULAN markanın maliyeti ARTIK sayılmıyor",
    maliyetli.clientCosts === 4000 && maliyetli.gider === 4000,
    `gider: ${maliyetli.gider} — 13000 çıkıyorsa donmuş müşteri hâlâ zarar yazıyor`);
  t("kâr simetrik", maliyetli.net === 26000,
    `gelen: ${maliyetli.net} — geliri düşen markanın gideri de düşmeli`);
});

/* ---------------------------------------------------------------- */
await bolum("6) BAŞKA AYIN İŞİ BU AYIN KÂRINDAN DÜŞMÜYOR", 2, () => {
  const v = computeLive(dunya({
    cekimIsleri: [{ id: 1, marka: "Animed", editor: "Atalay", teslimEdilmeTarihi: "2020-01-15" }],
    isUcretleri: { "Atalay": 1500 },
  }));
  t("eski iş bu ayın giderine girmiyor", v.freelancerGideri === 0,
    `gelen: ${v.freelancerGideri}`);
  t("kâr etkilenmiyor", v.net === 30000);
});

console.log(`\n${g} geçti, ${k} kaldı`);
temizle();
process.exit(k > 0 ? 1 : 0);
