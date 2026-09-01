/* REKLAM LİSTESİ MARKAYA GÖRE GRUPLANIYOR
 *
 * Liste düz basılıyordu ve her satır marka adını tekrar ediyordu ("İbo Burger — Chedar",
 * "İbo Burger — Plak", "İbo Burger — Burger Modu"…). 49 markalı bir ajansta ekran
 * okunmaz hâle geliyordu.
 *
 * BU TESTİN ASIL İŞİ:
 *   1. AYNI MARKA TEK GRUPTA. Reklam kaydı markayı ADIYLA saklıyor (clientId ile değil);
 *      "İbo Burger" ile "ibo burger" ayrı düşseydi aynı marka ekranda İKİ KEZ görünür ve
 *      gruplama hiçbir işe yaramazdı.
 *   2. SIRA BOZULMUYOR. Ekran reklamları bitiş tarihine göre diziyor (yakın olan üstte);
 *      gruplama bunu bozarsa "yakında bitecek" listesi aşağı kayar ve ekranın işi kaybolur.
 *   3. HİÇBİR KAYIT DÜŞMÜYOR. Markası girilmemiş reklam da bir gruba girmeli — sessizce
 *      kaybolması, olmayan bir "temiz liste" gösterirdi.
 */
import { markayaGoreGrupla, MARKASIZ_BASLIK } from "../lib/reklam-gruplari.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  try { fn(); } catch (e) { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } }
};

const LISTE = [
  { id: 1, marka: "Bitte Chocolate", reklamAdi: "GENEL", bitisTarihi: "2026-09-17" },
  { id: 2, marka: "İbo Burger", reklamAdi: "Chedar", bitisTarihi: "2026-09-20" },
  { id: 3, marka: "İbo Burger", reklamAdi: "Plak", bitisTarihi: "2026-09-20" },
  { id: 4, marka: "ibo burger", reklamAdi: "Burger Modu", bitisTarihi: "2026-09-20" },
  { id: 5, marka: "  İbo Burger  ", reklamAdi: "İns online", bitisTarihi: "2026-09-30" },
  { id: 6, marka: "Skylon Mimarlık", reklamAdi: "Q PREMIUM", bitisTarihi: "2026-08-22" },
];

/* ---------------------------------------------------------------- */
bolum("1) AYNI MARKA TEK GRUPTA", 5, () => {
  const gr = markayaGoreGrupla(LISTE);
  t("üç marka, üç grup", gr.length === 3, `bulunan ${gr.length}: ${gr.map((x) => x.marka).join(" | ")}`);
  const ibo = gr.find((x) => x.marka.trim() === "İbo Burger");
  t("büyük/küçük harf farkı aynı gruba giriyor", !!ibo && ibo.reklamlar.length === 4,
    `bulunan ${ibo && ibo.reklamlar.length} — 'ibo burger' ayrı düşseydi marka iki kez görünürdü`);
  t("baştaki/sondaki boşluk grup açmıyor",
    gr.filter((x) => x.marka.toLocaleLowerCase("tr").includes("ibo")).length === 1);
  t("başlık ilk görülen yazımı kullanıyor", ibo.marka === "İbo Burger",
    "kullanıcının girdiği yazım korunmalı");
  t("her grubun anahtarı benzersiz", new Set(gr.map((x) => x.anahtar)).size === gr.length);
});

/* ---------------------------------------------------------------- */
bolum("2) SIRA KORUNUYOR", 4, () => {
  const gr = markayaGoreGrupla(LISTE);
  t("en erken biten marka en üstte", gr[0].marka === "Skylon Mimarlık",
    `bulunan ${gr[0].marka} — ekranın işi 'yakında bitecek'i öne almak`);
  t("sonraki Bitte Chocolate", gr[1].marka === "Bitte Chocolate");
  t("grup içi sıra girdi sırasıyla aynı",
    gr.find((x) => x.marka === "İbo Burger").reklamlar.map((r) => r.id).join(",") === "2,3,4,5");
  /* Tarihi girilmemiş kayıt boş dize taşıyor; boş dize her şeyden küçük olduğu için
   * atılmasaydı en acil grupmuş gibi listenin başına çıkardı. */
  const gr2 = markayaGoreGrupla([...LISTE, { id: 9, marka: "Tarihsiz", reklamAdi: "X", bitisTarihi: "" }]);
  t("tarihi olmayan marka sona gidiyor", gr2[gr2.length - 1].marka === "Tarihsiz",
    `bulunan ${gr2[gr2.length - 1].marka} — boş tarih en acil sayılmamalı`);
});

/* ---------------------------------------------------------------- */
bolum("3) HİÇBİR KAYIT DÜŞMÜYOR", 5, () => {
  const zor = [...LISTE, { id: 7, marka: "", reklamAdi: "Adsız" }, { id: 8, reklamAdi: "Markasız" }, null];
  const gr = markayaGoreGrupla(zor);
  const toplam = gr.reduce((s, x) => s + x.reklamlar.length, 0);
  t("bozuk kayıt hariç hepsi bir grupta", toplam === 8, `bulunan ${toplam}`);
  const markasiz = gr.find((x) => x.marka === MARKASIZ_BASLIK);
  t("markasızlar adı olan bir grupta", !!markasiz && markasiz.reklamlar.length === 2,
    "sessizce kaybolsalardı olmayan bir 'temiz liste' gösterilirdi");
  t("null kayıt çökertmiyor", gr.every((x) => x.reklamlar.every(Boolean)));
  t("boş liste boş grup", markayaGoreGrupla([]).length === 0);
  t("tanımsız liste çökertmiyor", markayaGoreGrupla(undefined).length === 0);
});

/* ---------------------------------------------------------------- */
bolum("4) SÜZGEÇLE BİRLİKTE", 3, () => {
  /* Ekran ÖNCE süzüyor sonra gruplandırıyor: "Aktif" seçilince gruplar da yalnızca aktif
   * reklamları gösterir ve boşalan marka başlığı hiç çıkmaz. */
  const suzulmus = LISTE.filter((r) => r.marka !== "Skylon Mimarlık");
  const gr = markayaGoreGrupla(suzulmus);
  t("süzülen marka başlığı hiç çıkmıyor", !gr.some((x) => x.marka === "Skylon Mimarlık"),
    "boş marka başlığı basmak listeyi yine okunmaz yapardı");
  t("kalan gruplar duruyor", gr.length === 2);
  t("tek reklamlı marka da grup oluyor",
    markayaGoreGrupla([LISTE[0]]).length === 1);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
