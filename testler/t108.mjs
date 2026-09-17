/* AY AY GELİR–GİDER ÖZETİ — lib/aylik-ozet.js
 *
 * BU TESTİN ASIL İŞİ:
 *   1. GEÇMİŞ, "AYI KAPAT" FOTOĞRAFINDAN DEĞİL KAYITLARDAN TÜRETİLİYOR. Eski yol
 *      düğmeye basıldığı andaki fotoğraftı: ayın 10'unda basılırsa eksik, hiç basılmazsa
 *      o ay geçmişte hiç yoktu.
 *   2. TAHAKKUK O AYIN ÜCRETİYLE HESAPLANIYOR, BUGÜNKÜYLE DEĞİL. Ücret sonradan
 *      düşerse geçmiş aylar da düşerdi — tahsil edilmiş para "fazla ödeme" görünürdü.
 *   3. AYRILAN/DONDURULAN MARKAYA GEÇMİŞ AY TAHAKKUKU UYDURULMUYOR. Bitiş ayı kayıtlı
 *      DEĞİL; ne zaman ayrıldığını bilmeden fatura yazmak olurdu. Ama o ay ÖDEMESİ
 *      kayıtlıysa o kesin kanıttır ve sayılır.
 *   4. TAHSİLAT DURUM SÜZGECİNDEN GEÇMEZ — alınan para alınmıştır.
 *   5. BOŞ AYLARLA SAYFA DOLDURULMUYOR: veri daha eskiye gitmiyorsa liste kısalır.
 */
import {
  ayNormalle, ayKaydir, markaAktifMiydi, ayinTahakkuku, ayinTahsilati,
  enEskiAy, aylikOzet,
} from "../lib/aylik-ozet.js";

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

const BUGUN = "2026-09";
const MUSTERILER = [
  /* Aktif, ücreti Temmuz'da 60.000'den 45.000'e DÜŞTÜ */
  { id: 1, ad: "Animed", durum: "aktif", baslangic: "2026-05", aylikUcret: 45000,
    ucretGecmisi: [
      { baslangicAy: "0000-00", tutar: 60000 },
      { baslangicAy: "2026-07", tutar: 45000 },
    ],
    odemeKayitlari: [
      { id: 1, ay: "2026-08", tutar: 45000 },
      { id: 2, ay: "2026-09", tutar: 20000 },   // kısmi
    ] },
  /* DONDURULAN marka — Haziran'da ödeme yapmış, sonrası kayıtsız */
  { id: 2, ad: "Donan", durum: "donduruldu", baslangic: "2026-04", aylikUcret: 30000,
    odemeKayitlari: [{ id: 1, ay: "2026-06", tutar: 30000 }] },
  /* Başlangıcı SONRA olan marka */
  { id: 3, ad: "Yeni", durum: "aktif", baslangic: "2026-09", aylikUcret: 10000,
    odemeKayitlari: [] },
];
const ISLER = [
  { id: 1, marka: "Animed", editor: "Atalay", teslimEdilmeTarihi: "2026-09-04" },
  { id: 2, marka: "Animed", editor: "Atalay", teslimEdilmeTarihi: "2026-08-20" },
  { id: 3, marka: "", kameraman: "Önder", teslimEdilmeTarihi: "2026-09-11" },
];
const UCRETLER = { "Atalay": 1500, "Önder": 1000 };

/* ---------------------------------------------------------------- */
await bolum("1) AY ARACI", 5, () => {
  t("normalleştirme", ayNormalle("2026-09-17") === "2026-09" && ayNormalle("2026-09") === "2026-09");
  t("bozuk ay null", ayNormalle("eylül") === null && ayNormalle("") === null);
  t("bir ay geri", ayKaydir("2026-09", -1) === "2026-08");
  t("YIL SINIRINI geçiyor", ayKaydir("2026-01", -1) === "2025-12",
    "ocaktan geriye gitmek yılı düşürmeli");
  t("ileri de gidiyor", ayKaydir("2026-12", 1) === "2027-01");
});

/* ---------------------------------------------------------------- */
await bolum("2) TAHAKKUK O AYIN ÜCRETİYLE", 4, () => {
  t("ücret düşmeden ÖNCEKİ ay eski tutarla",
    ayinTahakkuku([MUSTERILER[0]], "2026-06") === 60000,
    `gelen: ${ayinTahakkuku([MUSTERILER[0]], "2026-06")} — bugünküyle sayılsaydı 45000 çıkardı`);
  t("düşüşten SONRAKİ ay yeni tutarla",
    ayinTahakkuku([MUSTERILER[0]], "2026-08") === 45000);
  t("BAŞLANGIÇTAN önceki ay sıfır",
    ayinTahakkuku([MUSTERILER[0]], "2026-04") === 0,
    "markanın hiç çalışmadığı aya bedel yazmak ekstrede de hataydı");
  t("başlangıç ayı dahil",
    ayinTahakkuku([MUSTERILER[2]], "2026-09") === 10000);
});

/* ---------------------------------------------------------------- */
await bolum("3) AYRILAN/DONDURULAN MARKAYA TAHAKKUK UYDURULMUYOR", 5, () => {
  const donan = MUSTERILER[1];
  t("ödemesi KAYITLI ay sayılıyor (kesin kanıt)",
    markaAktifMiydi(donan, "2026-06") && ayinTahakkuku([donan], "2026-06") === 30000);
  t("ödemesi olmayan sonraki ay SAYILMIYOR",
    !markaAktifMiydi(donan, "2026-07") && ayinTahakkuku([donan], "2026-07") === 0,
    "bitiş ayı kayıtlı değil; ne zaman ayrıldığını bilmeden tahakkuk yazmak uydurma olurdu");
  t("başlangıçtan önce zaten hayır", !markaAktifMiydi(donan, "2026-03"));
  t("AKTİF marka ödeme kaydı olmasa da sayılıyor",
    markaAktifMiydi(MUSTERILER[0], "2026-07") && ayinTahakkuku([MUSTERILER[0]], "2026-07") === 45000,
    "bugüne kadar sürdüğü varsayımı — aktif markada makul");
  t("ayrılmış marka da dondurulmuş gibi",
    !markaAktifMiydi({ durum: "ayrildi", baslangic: "2026-01", aylikUcret: 5000 }, "2026-05"));
});

/* ---------------------------------------------------------------- */
await bolum("4) TAHSİLAT DURUM SÜZGECİNDEN GEÇMEZ", 3, () => {
  t("dondurulmuş markanın ödemesi de sayılıyor",
    ayinTahsilati(MUSTERILER, "2026-06") === 30000,
    "alınan para alınmıştır; durumu bugün ne olursa olsun");
  t("kısmi ödeme aynen yansıyor", ayinTahsilati(MUSTERILER, "2026-09") === 20000);
  t("ödeme olmayan ay sıfır", ayinTahsilati(MUSTERILER, "2026-07") === 0);
});

/* ---------------------------------------------------------------- */
await bolum("5) AYLIK ÖZET", 7, () => {
  const o = aylikOzet({ clients: MUSTERILER, cekimIsleri: ISLER,
    isUcretleri: UCRETLER, isUcretDetaylari: {}, bugunAy: BUGUN, enFazlaAy: 12 });
  const bul = (ay) => o.satirlar.find((r) => r.ay === ay);

  t("en yeni ay üstte", o.satirlar[0].ay === BUGUN, o.satirlar[0].ay);
  t("eylül tahakkuku doğru", bul("2026-09").tahakkuk === 55000,
    `gelen: ${bul("2026-09").tahakkuk} — Animed 45000 + Yeni 10000, Donan sayılmıyor`);
  t("eylül tahsilatı doğru", bul("2026-09").tahsilat === 20000);
  t("FARK = tahakkuk − tahsilat", bul("2026-09").fark === 35000,
    "o aydan ne kadarı hâlâ tahsil edilmedi");
  t("freelancer gideri o ayın TESLİM edilen işlerinden",
    bul("2026-09").freelancerGideri === 2500,
    `gelen: ${bul("2026-09").freelancerGideri} — Atalay 1500 + Önder 1000 (markasız iş dahil)`);
  t("ağustos ayrı hesaplanıyor",
    bul("2026-08").tahsilat === 45000 && bul("2026-08").freelancerGideri === 1500);
  t("toplamlar satırların toplamı",
    o.toplam.tahsilat === o.satirlar.reduce((s, r) => s + r.tahsilat, 0)
    && o.toplam.fark === o.satirlar.reduce((s, r) => s + r.fark, 0));
});

/* ---------------------------------------------------------------- */
await bolum("6) BOŞ AYLARLA SAYFA DOLDURULMUYOR", 4, () => {
  const o = aylikOzet({ clients: MUSTERILER, cekimIsleri: ISLER,
    isUcretleri: UCRETLER, isUcretDetaylari: {}, bugunAy: BUGUN, enFazlaAy: 36 });
  t("liste en eski VERİDEN başlıyor", o.enEski === "2026-04",
    `gelen: ${o.enEski} — 36 ay istense de veri 2026-04'ten eski değil`);
  t("satır sayısı aralıkla uyumlu", o.satirlar.length === 6,
    `gelen: ${o.satirlar.length} (2026-04 … 2026-09)`);
  t("en eski ay bulundu", enEskiAy({ clients: MUSTERILER, cekimIsleri: ISLER }) === "2026-04");
  const kisa = aylikOzet({ clients: MUSTERILER, cekimIsleri: ISLER,
    isUcretleri: UCRETLER, isUcretDetaylari: {}, bugunAy: BUGUN, enFazlaAy: 3 });
  t("istenen aralık kısaysa ona uyuluyor", kisa.satirlar.length === 3);
});

/* ---------------------------------------------------------------- */
await bolum("7) BOŞ / BOZUK GİRDİ ÇÖKMÜYOR", 4, () => {
  t("veri yoksa çökmüyor", aylikOzet({}).satirlar.length >= 1);
  t("null müşteri atlanıyor", ayinTahakkuku([null, undefined], BUGUN) === 0);
  t("bozuk ay sıfır", ayinTahsilati(MUSTERILER, "bozuk") === 0);
  t("en eski ay yoksa null", enEskiAy({ clients: [], cekimIsleri: [] }) === null);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
