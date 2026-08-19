/* MÜŞTERİ İÇERİK İSTEĞİ — NEREYE DÜŞÜYORDU
 *
 * "Müşterinin gönderdiği içerik isteği nereye düşüyor?" sorusunun cevabı üç ayrı yerde
 * bozuktu ve üçü de sessizdi:
 *
 * 1. KUTU HİÇ ÇİZİLMİYORDU. Planım'daki "Onayını Bekleyenler" kutusu, yapılacak başka bir
 *    şey yokken tamamen gizleniyordu; boş sayımına müşteri talepleri DAHİL EDİLMEMİŞTİ.
 *    Bekleyen tek şey bir istekse kutu hiç görünmüyor, istek hiçbir ekranda çıkmıyordu.
 *    Başlıktaki sayı talepleri zaten sayıyordu — yalnızca o satır unutulmuştu.
 *
 * 2. KART PANODA KAYBOLUYORDU. İstek onaylanınca kategori ne olursa olsun "Talep Alındı"
 *    aşamasında kart açılıyordu. O aşama YALNIZCA Grafik Tasarım akışında var. Pano
 *    sütunları kategorinin aşama listesinden geldiği için Reels ve Görsel istekleri
 *    hiçbir sütuna denk gelmiyor, panoda hiç görünmüyordu. Kayıt duruyor, kimse göremiyor.
 *
 * 3. ATAMA YAPILAMIYORDU. "Operasyon'a al" tek tıkta kartı açıyor, kimseye atamıyordu.
 *    Kim yapacak, hangi aşamada başlayacak, ne zaman teslim — hepsi sonradan Operasyon'a
 *    girip düzeltilmeyi bekliyordu.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { asamaListesi, ILK_ASAMA, asamalariDuzelt, ASAMALAR_VIDEO, ASAMALAR_FOTOGRAF, ASAMALAR_TASARIM } from "../lib/asamalar.js";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const app = fs.readFileSync(path.join(kok, "src", "App.jsx"), "utf8");
const cekim = fs.readFileSync(path.join(kok, "src", "CekimEditTakibi.jsx"), "utf8");

/* ---------------------------------------------------------------- */
console.log("\n1) AŞAMA LİSTELERİ TEK KAYNAKTA");

t("lib aşama listelerini veriyor",
  ASAMALAR_VIDEO.length > 0 && ASAMALAR_FOTOGRAF.length > 0 && ASAMALAR_TASARIM.length > 0);
t("arayüz kendi kopyasını tutmuyor", !/^export const ASAMALAR_VIDEO = \[/m.test(cekim), "CekimEditTakibi.jsx");
t("arayüz lib'den alıyor", /from "\.\.\/lib\/asamalar\.js"/.test(cekim));
t("Talep Alındı YALNIZCA tasarım akışında",
  ASAMALAR_TASARIM.includes("Talep Alındı")
  && !ASAMALAR_VIDEO.includes("Talep Alındı")
  && !ASAMALAR_FOTOGRAF.includes("Talep Alındı"),
  "bu asimetri hatanın kaynağıydı");

/* ---------------------------------------------------------------- */
console.log("\n2) PANODA KAYBOLAN KART ONARILIYOR");

/* Eski verideki bozuk kartlar: kategorisinde bulunmayan bir aşamada duruyorlar. */
const bozuk = [
  { id: 1, kategori: "Video", asama: "Talep Alındı" },
  { id: 2, kategori: "Fotoğraf", asama: "Talep Alındı" },
  { id: 3, kategori: "Grafik Tasarım", asama: "Talep Alındı" },   // burası GEÇERLİ, dokunulmamalı
  { id: 4, kategori: "Video", asama: "Edit Yapılıyor" },          // geçerli
  { id: 5, kategori: "Video", asama: "Edit Yapıldı" },            // kaldırılmış ara aşama
];
const duzelmis = asamalariDuzelt(bozuk);
const bul = (id) => duzelmis.find((x) => x.id === id);

t("Video isteği akışın başına alındı", bul(1).asama === ILK_ASAMA("Video"), bul(1).asama);
t("Fotoğraf isteği akışın başına alındı", bul(2).asama === ILK_ASAMA("Fotoğraf"), bul(2).asama);
t("Tasarımda Talep Alındı GEÇERLİ — dokunulmadı", bul(3).asama === "Talep Alındı", bul(3).asama);
t("geçerli aşama bozulmadı", bul(4).asama === "Edit Yapılıyor");
t("kaldırılmış ara aşama karşılığına çevrildi", bul(5).asama === "Edit Yapılıyor", bul(5).asama);

t("onarılan her kart artık bir sütuna denk geliyor",
  duzelmis.every((j) => asamaListesi(j.kategori).includes(j.asama)),
  duzelmis.map((j) => `${j.kategori}:${j.asama}`).join(" | "));

/* Değişiklik yoksa aynı dizi dönmeli — gereksiz yazma olmasın. */
const temiz = [{ id: 9, kategori: "Video", asama: "Çekim Planlandı" }];
t("değişiklik yoksa aynı dizi dönüyor", asamalariDuzelt(temiz) === temiz);
t("dizi olmayan girdi bozulmuyor", asamalariDuzelt(null) === null);
/* Aşaması hiç olmayan kart: ilk aşamaya alınır, kaybolmaz. */
t("aşamasız kart da bir sütuna yerleşiyor",
  asamalariDuzelt([{ id: 8, kategori: "Video", asama: "" }])[0].asama === "" ||
  asamaListesi("Video").includes(asamalariDuzelt([{ id: 8, kategori: "Video", asama: "" }])[0].asama));

/* ---------------------------------------------------------------- */
console.log("\n3) KUTU ARTIK GİZLENMİYOR");

t("boş kontrolüne müşteri talepleri dahil",
  /if \(bekleyenTalepler\.length === 0 && revizeler\.length === 0/.test(app));
t("başlık sayısı da talepleri sayıyor", app.includes("bekleyenTalepler.length}"));

/* ---------------------------------------------------------------- */
console.log("\n4) PLANIM'DAN ATAMA");

t("talep için aktarım formu açılıyor", app.includes("const talepFormuAc = (t) =>"));
t("form talebin türünden kategoriyi seçiyor", app.includes("const talebinKategorisi = (t) =>"));
t("varsayılan aşama akışın başı", /if \(talepMi\) return ILK_ASAMA\(kategori\)/.test(app));
t("form ekranda çiziliyor", /acikId === `talep-\$\{t\.id\}` && \(\s*<AktarimFormu/.test(app));
t("atamasız aktarımda uyarı çıkıyor",
  app.includes("Kimseye atamadan Operasyon'a alınsın mı?"));
t("karar fonksiyonu atamayı alıyor",
  app.includes("const musteriTalepKarari = (talepId, karar, atama) =>"));
t("kameraman ve editör karta yazılıyor",
  /kameraman: \(atama && atama\.kameraman\) \|\| ""/.test(app) && /editor: \(atama && atama\.editor\) \|\| ""/.test(app));
t("teslim tarihi formdan geliyor", /teslimTarihi: \(atama && atama\.teslimTarihi\) \|\| t\.neZaman/.test(app));
t("atanan kişiler kart geçmişine not düşülüyor", app.includes("Atanan: ${[atama.kameraman, atama.editor]"));

t("SEÇİLEN AŞAMA O KATEGORİDE VAR MI diye doğrulanıyor",
  /asamaListesi\(kategori\)\.includes\(istenenAsama\) \? istenenAsama : ILK_ASAMA\(kategori\)/.test(app),
  "sabit 'Talep Alındı' yazmak hatanın kendisiydi");
t("sabit 'Talep Alındı' ataması kaldırıldı", !/asama: "Talep Alındı"/.test(app));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
