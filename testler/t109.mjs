/* ÖN MUHASEBE — para hareketleri, sade anlatım, yazdırılabilir raporlar
 *
 * BU TESTİN ASIL İŞİ:
 *   1. KAYITLARIN TARİHİ İKİ FARKLI ALANDA. Eski kayıtlarda yalnızca `ay`, yenilerde
 *      `tarih` var. Biri okunmazsa rapor sessizce eksik çıkar.
 *   2. TARİHSİZ KAYIT GİZLENMEZ, SAYILIR. Rapora giremeyen kayıt varsa söylenmeli —
 *      eksik bir dökümü tam gibi göstermek, hiç göstermemekten kötüdür.
 *   3. TAHSİLAT MARKA DURUMUNDAN BAĞIMSIZ. Dondurulmuş markadan alınan para da alınmıştır.
 *   4. BELGELERE KULLANICI METNİ KAÇIRILARAK GİRER. Marka ve kişi adları kullanıcı
 *      girdisidir; kaçırılmazsa belge bozulur ve HTML enjeksiyonu mümkün olur.
 *   5. SADE ANLATIMDA MUHASEBE TERİMİ GEÇMEZ ve EKSİK VERİ SÖYLENİR.
 */
import {
  kaydinAyi, kaydinTarihi, hesabinAdi, tahsilatDokumu, odemeDokumu, donemOzeti,
} from "../lib/para-hareketleri.js";
import { buAyinCumleleri, kasaKarFarki, ayCumlesi } from "../lib/sade-ozet.js";
import {
  donemEtiketi, tahsilatRaporuHtml, odemeRaporuHtml, aylikOzetRaporuHtml,
} from "../lib/muhasebe-belgesi.js";

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

const HESAPLAR = [{ id: "ana", ad: "Marcus Medya", anaHesap: true }, { id: "h2", ad: "Ziraat" }];
const MUSTERILER = [
  { id: 1, ad: "Animed", durum: "aktif", odemeKayitlari: [
    { id: 1, ay: "2026-08", tutar: 45000, hesapId: "ana", not: "havale" },          // ESKİ: yalnızca ay
    { id: 2, ay: "2026-09", tarih: "2026-09-05", tutar: 20000, hesapId: "h2" },     // YENİ: gün var
    { id: 3, tutar: 5000, hesapId: "ana" },                                          // TARİHSİZ
  ] },
  { id: 2, ad: "Donan <b>", durum: "donduruldu", odemeKayitlari: [
    { id: 1, ay: "2026-09", tutar: 30000, hesapId: "ana" },
  ] },
];
const ODEMELER = [
  { id: 1, tur: "freelancer", kisiAd: "Atalay", ay: "2026-09", tarih: "2026-09-10",
    tutar: 6000, hesapId: "ana", not: "eylül hak ediş" },
  { id: 2, tur: "personel", kisiAd: "Önder", ay: "2026-08", tutar: 25000, hesapId: "ana" },
];
const AVANSLAR = [
  { id: 1, tur: "freelancer", kisiAd: "Atalay", ay: "2026-09", tutar: 2000, hesapId: "h2", not: "avans" },
];

/* ---------------------------------------------------------------- */
await bolum("1) TARİH İKİ FARKLI ALANDAN OKUNUYOR", 5, () => {
  t("gün varsa onun ayı", kaydinAyi({ tarih: "2026-09-05", ay: "2026-01" }) === "2026-09",
    "gün alanı daha kesin bilgidir");
  t("gün yoksa ay alanı", kaydinAyi({ ay: "2026-08" }) === "2026-08");
  t("ikisi de yoksa null", kaydinAyi({ tutar: 5 }) === null);
  t("ekranda gün varsa gün gösteriliyor", kaydinTarihi({ tarih: "2026-09-05" }) === "2026-09-05");
  t("gün yoksa ay gösteriliyor", kaydinTarihi({ ay: "2026-08" }) === "2026-08");
});

/* ---------------------------------------------------------------- */
await bolum("2) TAHSİLAT DÖKÜMÜ", 6, () => {
  const d = tahsilatDokumu({ clients: MUSTERILER, hesaplar: HESAPLAR, bas: "2026-09", bit: "2026-09" });
  t("yalnızca dönemin kayıtları", d.satirlar.length === 2, `gelen: ${d.satirlar.length}`);
  t("toplam doğru", d.toplam === 50000, `gelen: ${d.toplam}`);
  t("DONDURULMUŞ markanın tahsilatı da sayılıyor",
    d.satirlar.some((r) => r.kim.startsWith("Donan")),
    "alınan para alınmıştır; marka durumu tahsilatı silmez");
  t("TARİHSİZ kayıt gizlenmiyor, sayılıyor", d.tarihsiz === 1,
    `gelen: ${d.tarihsiz} — sessiz atlamak eksik dökümü tam gibi gösterirdi`);
  t("hesap adı çözülüyor", d.satirlar.some((r) => r.hesap === "Ziraat"));
  t("tanımsız hesapta ad UYDURULMUYOR", hesabinAdi(HESAPLAR, "yok") === "");
});

/* ---------------------------------------------------------------- */
await bolum("3) ÖDEME DÖKÜMÜ", 5, () => {
  const d = odemeDokumu({ odemeler: ODEMELER, avanslar: AVANSLAR, hesaplar: HESAPLAR,
    bas: "2026-09", bit: "2026-09" });
  t("ödeme ve avans birlikte", d.satirlar.length === 2, `gelen: ${d.satirlar.length}`);
  t("toplam doğru", d.toplam === 8000, `gelen: ${d.toplam}`);
  t("TÜRÜ ayrı yazılıyor",
    d.satirlar.some((r) => r.tur === "Ödeme") && d.satirlar.some((r) => r.tur === "Avans"),
    "avans bir ön ödemedir; ayrımı kaybolursa hak ediş iki kez ödenmiş sanılır");
  t("kime ödendiği yazılıyor", d.satirlar.every((r) => r.kim === "Atalay"));
  t("başka ayın ödemesi girmiyor",
    !d.satirlar.some((r) => r.kim === "Önder"), "ağustos ödemesi eylül raporunda olmamalı");
});

/* ---------------------------------------------------------------- */
await bolum("4) DÖNEM ÖZETİ", 3, () => {
  const o = donemOzeti({ clients: MUSTERILER, odemeler: ODEMELER, avanslar: AVANSLAR,
    hesaplar: HESAPLAR, bas: "2026-09", bit: "2026-09" });
  t("net = giren − çıkan", o.net === 42000, `gelen: ${o.net}`);
  t("tarihsizler toplanıyor", o.tarihsiz === 1);
  t("sınırsız dönemde hepsi geliyor",
    donemOzeti({ clients: MUSTERILER, odemeler: ODEMELER, avanslar: AVANSLAR,
      hesaplar: HESAPLAR }).giren.satirlar.length === 3);
});

/* ---------------------------------------------------------------- */
await bolum("5) SADE ANLATIM", 6, () => {
  const bicim = (n) => `${n} TL`;
  const c = buAyinCumleleri({
    live: { ciro: 155000, tahsilEdilen: 120000, bekleyenToplam: 35000, gider: 48000, net: 107000 },
    markaSayisi: 5, bicim,
  });
  const hepsi = c.map((x) => x.metin).join(" ");
  t("marka sayısı cümlede", hepsi.includes("5 markadan"));
  t("hak edilen ve tahsil edilen AYRI cümlelerde",
    c.some((x) => x.tur === "gelir") && c.some((x) => x.tur === "tahsilat"),
    "bu ayrımın anlaşılmaması kafa karışıklığının ana kaynağıydı");
  t("bekleyen söyleniyor", c.some((x) => x.tur === "bekleyen" && x.metin.includes("35000")));
  t("MUHASEBE TERİMİ GEÇMİYOR",
    !/tahakkuk|cari|mutabakat|bakiye/i.test(hepsi),
    `metin: ${hepsi.slice(0, 120)}`);

  const eksikli = buAyinCumleleri({
    live: { ciro: 100, tahsilEdilen: 100, bekleyenToplam: 0, gider: 10, net: 90, isUcretiEksik: 3 },
    markaSayisi: 1, bicim,
  });
  t("EKSİK VERİ uyarı olarak söyleniyor",
    eksikli.some((x) => x.tur === "uyari" && x.metin.includes("3")),
    "sessiz kalmak gideri düşük, kârı yüksek gösterirdi");

  const zarar = buAyinCumleleri({ live: { ciro: 10, tahsilEdilen: 10, gider: 40, net: -30 }, bicim });
  t("zarar açıkça söyleniyor", zarar.some((x) => x.metin.includes("zarardasın")));
});

/* ---------------------------------------------------------------- */
await bolum("6) KASA–KÂR FARKI VE AY CÜMLESİ", 3, () => {
  const f = kasaKarFarki({ kasa: 200000, net: 70000, bicim: (n) => `${n} TL` });
  t("fark hesaplanıyor", f.fark === 130000);
  t("neden tutmadıkları açıklanıyor",
    f.metin.includes("NAKİT") && f.metin.includes("BU AYIN"),
    "iki rakam yan yana duruyor ve sürekli karşılaştırılıyor");
  t("ay cümlesi bekleyeni söylüyor",
    ayCumlesi({ tahakkuk: 100, tahsilat: 60, fark: 40 }, (n) => `${n} TL`).includes("40 TL bekliyor"));
});

/* ---------------------------------------------------------------- */
await bolum("7) BELGELER", 8, () => {
  const d = tahsilatDokumu({ clients: MUSTERILER, hesaplar: HESAPLAR, bas: "2026-09", bit: "2026-09" });
  const html = tahsilatRaporuHtml({ dokum: d, firmaAdi: "Marcus Medya", bas: "2026-09", bit: "2026-09", bugun: "2026-09-17" });
  t("belge HTML üretiyor", html.startsWith("<!doctype html>") && html.includes("</html>"));
  t("MARKA ADI KAÇIRILARAK giriyor",
    html.includes("Donan &lt;b&gt;") && !html.includes("Donan <b>"),
    "kaçırılmazsa belge bozulur ve HTML enjeksiyonu mümkün olur");
  t("toplam belgede", html.includes("50.000"));
  t("tarihsiz kayıt belgede SÖYLENİYOR", html.includes("bu dökümde yok"));

  const od = odemeDokumu({ odemeler: ODEMELER, avanslar: AVANSLAR, hesaplar: HESAPLAR });
  const oHtml = odemeRaporuHtml({ dokum: od, firmaAdi: "Marcus Medya" });
  t("ödeme raporu sabit giderlerin YOKLUĞUNU söylüyor",
    oHtml.includes("Ofis gideri, üyelikler"),
    "okuyan 'giderimin tamamı bu' sanmamalı");

  const aylik = aylikOzetRaporuHtml({
    ozet: { satirlar: [{ ay: "2026-09", tahakkuk: 100, tahsilat: 60, fark: 40, freelancerGideri: 10 }],
      toplam: { tahakkuk: 100, tahsilat: 60, fark: 40, freelancerGideri: 10, isUcretiEksik: 2 } },
    cumleler: [{ tur: "gelir", metin: "Bu ay 100 TL hak ettin." }],
    firmaAdi: "Marcus Medya",
  });
  t("aylık özet ay adını Türkçe yazıyor", aylik.includes("Eylül 2026"));
  t("aylık özet eksik ücreti söylüyor", aylik.includes("Freelancer gideri eksik"));
  t("boş dönemde çökmüyor",
    tahsilatRaporuHtml({}).includes("kayıtlı tahsilat yok")
    && odemeRaporuHtml({}).includes("kayıtlı ödeme ya da avans yok"));
});

/* ---------------------------------------------------------------- */
await bolum("8) DÖNEM ETİKETİ", 4, () => {
  t("aralık", donemEtiketi("2026-07", "2026-09") === "Temmuz 2026 – Eylül 2026");
  t("tek ay", donemEtiketi("2026-09", "2026-09") === "Eylül 2026");
  t("sınırsız", donemEtiketi() === "tüm kayıtlar");
  t("tek uçlu", donemEtiketi("2026-09", "") === "Eylül 2026 ve sonrası");
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
