/* İŞ BAŞI ÜCRET MATEMATİĞİ — lib/is-ucreti.js
 *
 * BU TESTİN ASIL İŞİ:
 *   1. ŞİRKET TOPLAMI, MARKALARIN TOPLAMI DEĞİLDİR. Markası girilmemiş bir iş hiçbir
 *      markanın altına düşmez; marka marka toplanınca sessizce KAYBOLUR ve şirket gideri
 *      eksik çıkar. Bu, kârı olduğundan yüksek gösteren sessiz bir hatadır.
 *   2. SABİT ÜCRET İKİ KEZ SAYILMAZ. Bir işte hem kameraman hem editör varsa "tek ücret"
 *      seçimi tutarı ikiye katlamamalı; `kime` alanı bunu belirler.
 *   3. ÜCRETSİZ İŞ SIFIRDIR ama ÜCRETİ TANIMSIZ İŞ "eksik" olarak SAYILIR. İkisi aynı
 *      değil: biri karar, diğeri veri boşluğu. Karıştırılırsa gider sessizce düşük çıkar.
 *   4. DÖNEM = İŞİN TESLİM EDİLDİĞİ AY. Kartın bugünkü aşaması değil; hak ediş işin
 *      bittiği ayda doğar. Eski kayıtlarda tarih geçmişten geri kazanılıyor.
 *   5. HAK EDİŞ VE MALİYET AYNI KURALDAN ÇIKAR. Kişiye ödenen toplam ile şirkete yazılan
 *      maliyet ayrışırsa biri "kazandım" derken diğeri "ödemedim" der.
 */
import {
  isTeslimTarihi, isUcretiHesapla, varsayilanKime,
  operasyonAylikHakEdis, markaAylikIsMaliyeti, sirketAylikIsMaliyeti,
  operasyonKisiIsimleri, UCRET_MODLARI,
} from "../lib/is-ucreti.js";

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

const AY = "2026-09";
const ISLER = [
  // 1 · Animed · kameraman Önder + editör Atalay, ikisi de varsayılan ücret
  { id: 1, marka: "Animed", kameraman: "Önder", editor: "Atalay",
    teslimEdilmeTarihi: "2026-09-03", uretilenAdet: 2 },
  // 2 · Animed · yalnızca editör, işe özel SABİT ücret
  { id: 2, marka: "Animed", editor: "Atalay", teslimEdilmeTarihi: "2026-09-10" },
  // 3 · Köfteci · iki kişi, ÜCRETSİZ
  { id: 3, marka: "Köfteci", kameraman: "Önder", editor: "Atalay", teslimEdilmeTarihi: "2026-09-12" },
  // 4 · MARKASIZ iş — marka marka toplandığında kaybolan kayıt
  { id: 4, marka: "", kameraman: "Önder", teslimEdilmeTarihi: "2026-09-15" },
  // 5 · BAŞKA AY — bu ayın rakamına girmemeli
  { id: 5, marka: "Animed", editor: "Atalay", teslimEdilmeTarihi: "2026-08-28" },
  // 6 · TESLİM EDİLMEMİŞ — hak ediş doğmamış
  { id: 6, marka: "Animed", editor: "Atalay", asama: "Kontrol Bekliyor" },
  // 7 · ESKİ KAYIT: teslim tarihi yalnızca geçmişte, tek haneli günle
  { id: 7, marka: "Köfteci", editor: "Hakan",
    gecmis: [{ id: 1, tarih: "8.09.2026 10:00:00", yazan: "Önder",
      aciklama: "Aşama değişti: Onaylandı → Teslim Edildi" }] },
  // 8 · ÜCRETİ HİÇ TANIMLANMAMIŞ kişi
  { id: 8, marka: "Köfteci", editor: "Yeni Kişi", teslimEdilmeTarihi: "2026-09-16" },
];
const UCRETLER = { "Önder": 1000, "Atalay": 1500, "Hakan": 800 };   // "Yeni Kişi" YOK
const DETAYLAR = {
  2: { mod: "sabit", tutar: 5000 },                 // kime verilmedi → varsayılan: editör
  3: { mod: "ucretsiz" },
};

/* ---------------------------------------------------------------- */
await bolum("1) ŞİRKET TOPLAMI ≠ MARKALARIN TOPLAMI", 4, () => {
  const sirket = sirketAylikIsMaliyeti(ISLER, AY, UCRETLER, DETAYLAR);
  const animed = markaAylikIsMaliyeti(ISLER, "Animed", AY, UCRETLER, DETAYLAR);
  const kofteci = markaAylikIsMaliyeti(ISLER, "Köfteci", AY, UCRETLER, DETAYLAR);

  /* Animed: iş1 (1000+1500) + iş2 (5000, editöre) = 7500
     Köfteci: iş3 ücretsiz (0) + iş7 Hakan 800 + iş8 tanımsız 0 = 800
     Markasız: iş4 Önder 1000  → şirket = 9300 */
  t("marka bazı doğru — Animed", animed.tutar === 7500, `gelen: ${animed.tutar}`);
  t("marka bazı doğru — Köfteci", kofteci.tutar === 800, `gelen: ${kofteci.tutar}`);
  t("ŞİRKET TOPLAMI markasız işi de sayıyor",
    sirket.tutar === 9300, `gelen: ${sirket.tutar} — markaların toplamı ${animed.tutar + kofteci.tutar}`);
  t("markasız iş marka toplamında GERÇEKTEN yok",
    animed.tutar + kofteci.tutar !== sirket.tutar,
    "bu fark olmasaydı test hiçbir şey ölçmüyor olurdu");
});

/* ---------------------------------------------------------------- */
await bolum("2) SABİT ÜCRET İKİ KEZ SAYILMAZ", 5, () => {
  const is = { id: 99, kameraman: "Önder", editor: "Atalay" };
  const sabit = { mod: "sabit", tutar: 4000 };
  t("varsayılan olarak EDİTÖRE yazılır", varsayilanKime(is) === "editor");
  t("editör tutarı alır", isUcretiHesapla(is, "Atalay", sabit, 1500) === 4000);
  t("kameraman SIFIR alır", isUcretiHesapla(is, "Önder", sabit, 1000) === 0,
    "ikisine de yazılsaydı tek ücret iki kez sayılırdı");
  t("kime: 'kameraman' seçilirse tersi olur",
    isUcretiHesapla(is, "Önder", { ...sabit, kime: "kameraman" }, 1000) === 4000
    && isUcretiHesapla(is, "Atalay", { ...sabit, kime: "kameraman" }, 1500) === 0);
  t("kime: 'ikisi' seçilirse ikisi de alır",
    isUcretiHesapla(is, "Önder", { ...sabit, kime: "ikisi" }, 1000) === 4000
    && isUcretiHesapla(is, "Atalay", { ...sabit, kime: "ikisi" }, 1500) === 4000,
    "bu BİLEREK seçilen bir durum");
});

/* ---------------------------------------------------------------- */
await bolum("3) ÜCRETSİZ İLE TANIMSIZ AYNI ŞEY DEĞİL", 4, () => {
  const sirket = sirketAylikIsMaliyeti(ISLER, AY, UCRETLER, DETAYLAR);
  t("ücretsiz iş 0 ₺ yazıyor",
    isUcretiHesapla({ id: 3, editor: "Atalay" }, "Atalay", { mod: "ucretsiz" }, 1500) === 0);
  t("ücretsiz iş 'eksik' SAYILMIYOR",
    markaAylikIsMaliyeti([ISLER[2]], "Köfteci", AY, UCRETLER, DETAYLAR).eksikUcret === 0,
    "ücretsiz bir KARARDIR, veri boşluğu değil");
  t("ücreti tanımsız kişi 'eksik' olarak sayılıyor", sirket.eksikUcret === 1,
    `gelen: ${sirket.eksikUcret} — 'Yeni Kişi' ücretsiz değil, ücreti GİRİLMEMİŞ`);
  t("tanımsız ücret toplama 0 yazıyor ama sessiz kalmıyor",
    sirketAylikIsMaliyeti([ISLER[7]], AY, UCRETLER, DETAYLAR).tutar === 0
    && sirketAylikIsMaliyeti([ISLER[7]], AY, UCRETLER, DETAYLAR).eksikUcret === 1,
    "sessiz kalsaydı gider düşük, kâr yüksek görünürdü");
});

/* ---------------------------------------------------------------- */
await bolum("4) DÖNEM = TESLİM EDİLDİĞİ AY", 5, () => {
  t("yeni alan doğrudan okunuyor",
    isTeslimTarihi({ teslimEdilmeTarihi: "2026-09-03" }) === "2026-09-03");
  t("ESKİ kayıt geçmişten geri kazanılıyor (tek haneli gün)",
    isTeslimTarihi(ISLER[6]) === "2026-09-08", `gelen: ${isTeslimTarihi(ISLER[6])}`);
  t("teslim edilmemiş iş null", isTeslimTarihi(ISLER[5]) === null);
  t("BAŞKA AYIN işi bu aya girmiyor",
    !sirketAylikIsMaliyeti([ISLER[4]], AY, UCRETLER, DETAYLAR).isSayisi,
    "girseydi ağustosta ödenen para eylülün kârından düşerdi");
  t("teslim edilmemiş iş hiçbir aya girmiyor",
    sirketAylikIsMaliyeti([ISLER[5]], AY, UCRETLER, DETAYLAR).tutar === 0,
    "hak ediş işin bittiği ayda doğar");
});

/* ---------------------------------------------------------------- */
await bolum("5) HAK EDİŞ VE MALİYET AYNI KURALDAN ÇIKIYOR", 3, () => {
  const kisiler = ["Önder", "Atalay", "Hakan", "Yeni Kişi"];
  const hakEdisToplami = kisiler.reduce(
    (s, ad) => s + operasyonAylikHakEdis(ISLER, ad, AY, UCRETLER, DETAYLAR).tutar, 0);
  const sirket = sirketAylikIsMaliyeti(ISLER, AY, UCRETLER, DETAYLAR);
  t("kişilere ödenecek toplam = şirkete yazılan maliyet",
    hakEdisToplami === sirket.tutar,
    `hak ediş ${hakEdisToplami} · maliyet ${sirket.tutar} — ayrışırsa biri "kazandım" derken diğeri "ödemedim" der`);
  t("Atalay'ın hak edişi doğru",
    operasyonAylikHakEdis(ISLER, "Atalay", AY, UCRETLER, DETAYLAR).tutar === 6500,
    "iş1 1500 + iş2 sabit 5000 + iş3 ücretsiz 0");
  t("üretilen parça sayısı da toplanıyor",
    operasyonAylikHakEdis(ISLER, "Önder", AY, UCRETLER, DETAYLAR).parca === 2);
});

/* ---------------------------------------------------------------- */
await bolum("6) BOŞ / BOZUK GİRDİ", 5, () => {
  t("iş listesi yoksa sıfır", sirketAylikIsMaliyeti(undefined, AY, {}, {}).tutar === 0);
  t("ay verilmezse sıfır", sirketAylikIsMaliyeti(ISLER, "", UCRETLER, DETAYLAR).tutar === 0);
  t("marka verilmezse sıfır", markaAylikIsMaliyeti(ISLER, "", AY, UCRETLER, DETAYLAR).tutar === 0);
  t("kişi listesi atanmışları buluyor",
    operasyonKisiIsimleri(ISLER).sort().join(",") === "Atalay,Hakan,Yeni Kişi,Önder",
    operasyonKisiIsimleri(ISLER).sort().join(","));
  t("üç ücret modu tanımlı",
    UCRET_MODLARI.map((m) => m.key).join(",") === "varsayilan,sabit,ucretsiz");
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
