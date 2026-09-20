/* GİDER DAĞILIMI — `lib/gider-dagilimi.js`
 *
 * BU TESTİN ASIL İŞİ: SIFIR KALEMİN KAYBOLMAMASI.
 *
 * Eski ekran `.filter((x) => x.tutar > 0)` yapıyordu; tutarı sıfır olan kalem hiç
 * çizilmiyordu. "Freelancer iş ücretleri" satırının yokluğu iki ayrı şey demekti ve
 * ikisi ekrandan ayırt edilemiyordu: ya o ay hiç iş verilmemişti, ya da işler teslim
 * edilip ücretleri girilmemişti — ikincisinde gider EKSİK, kâr olduğundan yüksek.
 * Aşağıdaki kontroller sıfır kalemin listede DURDUĞUNU ve NEDEN sıfır olduğunu
 * söylediğini sınıyor.
 *
 * İkinci iş: oranların anlamlı olması (toplamları 1), sıranın büyükten küçüğe olması,
 * toplam sıfırken NaN üretilmemesi ve modülün SAF kalması (girdi değişmiyor).
 *
 * DAVRANIŞ sınanıyor, kaynak metni değil: hiçbir kontrol dosyanın içine `grep` atmıyor.
 */
import { giderDagilimi, yuzdeMetni } from "../lib/gider-dagilimi.js";

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

/* FIXTURE GERÇEK `computeLive` ÇIKTISININ BÜTÜN ALANLARINI TAŞIR.
 * Eksik bir fixture testi değersizleştirir: hiç oluşmayan bir hâli temsil eder ve test
 * olmayan sorunları kovalar. Alan listesi `src/tema.jsx` → `computeLive`'ın return'ü.
 *
 * DEĞERLER AYIRT EDİCİ: hiçbir iki gider kalemi eşit değil ve tanım sırasıyla büyüklük
 * sırası ÇAKIŞMIYOR — sıralama hiç çalışmasa da geçen bir kontrol istemiyoruz. */
const DOLU = {
  recurring: 210000, extra: 45000, ciro: 255000,
  faturaliCiro: 190000, faturasizCiro: 65000, kdvTutari: 38000,
  kdvDahilToplamCiro: 293000, faturaliKdvDahil: 228000,
  giderKalemToplam: 9600, ofisGiderToplam: 18000, clientCosts: 7500,
  personelGideri: 120000, personelMaas: 84000, personelSigorta: 21000,
  personelYemek: 9000, personelTazminat: 6000,
  uyelikGideri: 2400, freelancerGideri: 32000, isUcretiEksik: 0,
  gider: 189500, net: 65500,
  manuelBekleyen: 12000, otomatikBekleyen: 33000, bekleyenToplam: 45000,
  tahsilEdilen: 210000, karMarji: 26,
};
/* Üç kalemi sıfır olan gerçekçi bir ay: ofis gideri girilmemiş, freelancer ücretleri
 * girilmemiş, ek gider kalemi yok. Üyelik bilerek KÜÇÜK — %1'in altında kalıyor. */
const KISMI = {
  ...DOLU,
  giderKalemToplam: 0, ofisGiderToplam: 0, clientCosts: 12000,
  personelGideri: 50000, personelMaas: 40000, personelSigorta: 7000,
  personelYemek: 3000, personelTazminat: 0,
  uyelikGideri: 400, freelancerGideri: 0, isUcretiEksik: 3,
  gider: 62400, net: 192600,
};
const BOS = {
  ...DOLU,
  giderKalemToplam: 0, ofisGiderToplam: 0, clientCosts: 0,
  personelGideri: 0, personelMaas: 0, personelSigorta: 0,
  personelYemek: 0, personelTazminat: 0,
  uyelikGideri: 0, freelancerGideri: 0, isUcretiEksik: 0,
  gider: 0, net: 255000,
};

const bul = (r, anahtar) => r.kalemler.find((x) => x.anahtar === anahtar);

/* ---------------------------------------------------------------- */
await bolum("1) YAPI — hiçbir kalem düşmüyor", 5, () => {
  const r = giderDagilimi(DOLU);
  t("altı kalem dönüyor", r.kalemler.length === 6, `gelen: ${r.kalemler.length}`);
  t("anahtarların hepsi var",
    ["personel", "ofis", "musteri", "freelancer", "uyelik", "diger"].every((a) => !!bul(r, a)),
    r.kalemler.map((x) => x.anahtar).join(","));
  t("toplam altı kalemin toplamı", r.toplam === 189500, `gelen: ${r.toplam}`);
  t("tutarlar computeLive alanlarından birebir okunuyor",
    bul(r, "personel").tutar === 120000 && bul(r, "ofis").tutar === 18000
    && bul(r, "musteri").tutar === 7500 && bul(r, "freelancer").tutar === 32000
    && bul(r, "uyelik").tutar === 2400 && bul(r, "diger").tutar === 9600);
  t("kalemlerin adı var", r.kalemler.every((x) => typeof x.ad === "string" && x.ad.length > 0));
});

/* ---------------------------------------------------------------- */
await bolum("2) ORAN", 5, () => {
  const r = giderDagilimi(DOLU);
  const oranToplami = r.kalemler.reduce((s, x) => s + x.oran, 0);
  t("oranların toplamı 1", Math.abs(oranToplami - 1) < 1e-9, `gelen: ${oranToplami}`);
  t("oran sayı, yüzde metni değil", r.kalemler.every((x) => typeof x.oran === "number"));
  t("oran 0–1 arasında", r.kalemler.every((x) => x.oran >= 0 && x.oran <= 1));
  t("en büyük kalemin oranı tutar/toplam",
    Math.abs(bul(r, "personel").oran - 120000 / 189500) < 1e-12,
    String(bul(r, "personel").oran));
  t("küçük kalemin oranı da doğru",
    Math.abs(bul(r, "uyelik").oran - 2400 / 189500) < 1e-12);
});

/* ---------------------------------------------------------------- */
await bolum("3) SIRALAMA", 4, () => {
  const r = giderDagilimi(DOLU);
  t("en büyük kalem ilk sırada", r.kalemler[0].anahtar === "personel",
    r.kalemler.map((x) => x.anahtar).join(","));
  t("tutarı olanlar büyükten küçüğe",
    r.kalemler.map((x) => x.anahtar).join(",") === "personel,freelancer,ofis,diger,musteri,uyelik",
    r.kalemler.map((x) => x.anahtar).join(","));

  const rk = giderDagilimi(KISMI);
  const anahtarlar = rk.kalemler.map((x) => x.anahtar);
  t("sıfır kalemler EN SONDA", anahtarlar.slice(3).every((a) => bul(rk, a).tutar === 0)
    && anahtarlar.slice(0, 3).every((a) => bul(rk, a).tutar > 0), anahtarlar.join(","));
  /* Sıfırların kendi arasındaki sırası SABİT: her açılışta yer değiştirirlerse göz
   * onları okuyamaz. Tanım sırası — ofis, freelancer, diğer. */
  t("sıfırlar kendi aralarında sabit sırada",
    anahtarlar.slice(3).join(",") === "ofis,freelancer,diger", anahtarlar.slice(3).join(","));
});

/* ---------------------------------------------------------------- */
await bolum("4) SIFIR KALEM GÖRÜNÜR VE SEBEBİNİ SÖYLER", 8, () => {
  const r = giderDagilimi(KISMI);
  t("sıfır kalem listeden SİLİNMİYOR", r.kalemler.length === 6, `gelen: ${r.kalemler.length}`);
  t("freelancer sıfırken bile listede", !!bul(r, "freelancer") && bul(r, "freelancer").tutar === 0);
  t("freelancer sebebi ücretin girilmediğini söylüyor",
    bul(r, "freelancer").sebep === "Operasyon'da bu ay teslim edilen işlere ücret girilmemiş",
    String(bul(r, "freelancer").sebep));
  t("ofis sebebi doğru", bul(r, "ofis").sebep === "Ofis gideri eklenmemiş",
    String(bul(r, "ofis").sebep));
  t("diğer kalem sebebi nereye bakılacağını söylüyor",
    bul(r, "diger").sebep === "Gelir-Gider sekmesinde kalem yok", String(bul(r, "diger").sebep));
  t("sıfır kalemin oranı 0", r.kalemler.filter((x) => x.tutar === 0).every((x) => x.oran === 0));
  t("tutarı olan kalemde sebep YOK", r.kalemler.filter((x) => x.tutar > 0).every((x) => x.sebep === null),
    JSON.stringify(r.kalemler.filter((x) => x.tutar > 0).map((x) => x.sebep)));
  t("toplam sıfır kalemlerden etkilenmiyor", r.toplam === 62400, `gelen: ${r.toplam}`);
});

/* ---------------------------------------------------------------- */
await bolum("5) TOPLAM 0 — bölme yok, NaN yok", 6, () => {
  const r = giderDagilimi(BOS);
  t("toplam 0", r.toplam === 0, `gelen: ${r.toplam}`);
  t("altı kalem yine dönüyor", r.kalemler.length === 6);
  t("oranların hepsi 0 (NaN değil)",
    r.kalemler.every((x) => x.oran === 0 && !Number.isNaN(x.oran)),
    JSON.stringify(r.kalemler.map((x) => x.oran)));
  t("her kalem sebebini söylüyor",
    r.kalemler.every((x) => typeof x.sebep === "string" && x.sebep.length > 0),
    JSON.stringify(r.kalemler.map((x) => x.sebep)));
  t("personel sebebi doğru", bul(r, "personel").sebep === "Personel kaydı yok",
    String(bul(r, "personel").sebep));
  t("müşteri maliyeti sebebi doğru",
    bul(r, "musteri").sebep === "Müşteri kartlarında maliyet kalemi yok",
    String(bul(r, "musteri").sebep));
});

/* ---------------------------------------------------------------- */
await bolum("6) SAFLIK", 5, () => {
  const girdi = JSON.parse(JSON.stringify(DOLU));
  const once = JSON.stringify(girdi);
  const r1 = giderDagilimi(girdi);
  t("girdi DEĞİŞTİRİLMİYOR", JSON.stringify(girdi) === once);
  const r2 = giderDagilimi(girdi);
  t("her çağrı yeni nesne döndürüyor", r1 !== r2 && r1.kalemler !== r2.kalemler
    && r1.kalemler[0] !== r2.kalemler[0]);
  t("aynı girdi aynı sonucu veriyor", JSON.stringify(r1) === JSON.stringify(r2));
  /* Araya BAŞKA bir girdi giriyor: modül kendi sabit listesini sıralarken bozsaydı
   * (`sort` yerinde çalışır) bu çağrıdan sonraki sonuç kayardı. */
  const araya = giderDagilimi(KISMI);
  t("araya başka çağrı girince sonuç kaymıyor",
    araya.kalemler.length === 6 && JSON.stringify(giderDagilimi(girdi)) === JSON.stringify(r1));
  const bosCagri = giderDagilimi(null);
  t("live yokken çökmüyor, her kalem sıfır",
    bosCagri.toplam === 0 && bosCagri.kalemler.length === 6
    && bosCagri.kalemler.every((x) => x.tutar === 0));
});

/* ---------------------------------------------------------------- */
await bolum("7) YÜZDE METNİ", 5, () => {
  t("%1 üstü tam sayı yazılır", yuzdeMetni(120000 / 189500) === "%63",
    yuzdeMetni(120000 / 189500));
  /* KÜÇÜK PAY YUVARLANIP KAYBOLMAZ: tam sayıya yuvarlansa "%0" yazardı ve gerçekten
   * sıfır olan kalemden ayırt edilemezdi. */
  const uyelikOrani = bul(giderDagilimi(KISMI), "uyelik").oran;
  t("%1 altı bir ondalıkla yazılır", yuzdeMetni(uyelikOrani) === "%0,6", yuzdeMetni(uyelikOrani));
  t("ondalık ayırıcı virgül (tr-TR)", !yuzdeMetni(0.008).includes("."), yuzdeMetni(0.008));
  t("sıfır oran %0", yuzdeMetni(0) === "%0", yuzdeMetni(0));
  t("tam pay %100", yuzdeMetni(1) === "%100", yuzdeMetni(1));
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bir bölüm `await` edilmezse ya da `bolum()` çağrısı silinirse test hiçbir şey
 * ölçmeden 0 ile çıkar — koşucu da yakalayamaz (çıkış kodu 0, ✗ yok). Bu yaşandı (t95).
 * KONTROL EKLERKEN BU SAYIYI DA ARTIR. */
const BEKLENEN = 38;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
