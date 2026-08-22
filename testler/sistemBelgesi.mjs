/* SİSTEM BELGESİ BAYAT MI — MARCUS-OS-SISTEM.md
 *
 * Belge envanter: hangi uç var, hangi modül var, hangi izin var. Envanterin bayatlaması
 * onu YANLIŞ yapar — okuyan kişi olmayan bir uca ya da kaldırılmış bir modüle güvenir.
 * Yeni bir uç ya da modül eklenip belgeye yazılmazsa bu denetim düşer.
 *
 * İçerik doğruluğunu değil VARLIK eksiğini yakalar; anlatımın kendisi elle güncellenir.
 */
import { readFileSync, readdirSync } from "node:fs";

const belge = readFileSync(new URL("../MARCUS-OS-SISTEM.md", import.meta.url), "utf8");
const kok = new URL("../", import.meta.url);

let hata = 0;
const t = (ad, ok, not) => {
  if (ok) console.log(`  ✓ ${ad}`);
  else { hata++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};

const uclar = readdirSync(new URL("api/", kok)).filter((f) => f.endsWith(".js"));
const eksikUc = uclar.filter((f) => !belge.includes(f));
t(`${uclar.length} ucun hepsi belgede`, eksikUc.length === 0, "eksik: " + eksikUc.join(", "));

const moduller = readdirSync(new URL("lib/", kok)).filter((f) => f.endsWith(".js"));
const eksikModul = moduller.filter((f) => !belge.includes(f));
t(`${moduller.length} modülün hepsi belgede`, eksikModul.length === 0, "eksik: " + eksikModul.join(", "));

/* Fonksiyon sınırı belgede yazan sayıyla tutuyor mu. */
const yazan = (belge.match(/(\d+) fonksiyon kullanılıyor/) || [])[1];
t("fonksiyon sayısı doğru", String(uclar.length) === yazan,
  `gerçek: ${uclar.length}, belgede: ${yazan}`);

/* Test dosyası sayısı. */
const testler = readdirSync(new URL("testler/", kok)).filter((f) => /^t\d+\.mjs$/.test(f));
t(`${testler.length} test dosyası belgede doğru yazıyor`,
  belge.includes(`${testler.length} test dosyası`), "belgede yazan sayı tutmuyor");

/* Ortam değişkenleri — kodda kullanılan her değişken belgede olmalı. */
const kaynak = [...uclar.map((f) => `api/${f}`), ...moduller.map((f) => `lib/${f}`)]
  .map((yol) => readFileSync(new URL(yol, kok), "utf8")).join("\n");
const degiskenler = [...new Set((kaynak.match(/process\.env\.[A-Z_]+/g) || [])
  .map((x) => x.replace("process.env.", "")))];
/* TAM SÖZCÜK araması: `includes` ile `KILIT_DENEME`, yanlış yazılmış
 * `KILIT_DENEMESI`'nin içinde de bulunuyordu ve kontrol hiçbir şey sınamıyordu — ölçüldü. */
const tamSozcuk = (ad) => new RegExp(`\\b${ad}\\b(?![A-Z_])`).test(belge);
const eksikDegisken = degiskenler.filter((d) => !tamSozcuk(d));
t(`${degiskenler.length} ortam değişkeninin hepsi belgede`,
  eksikDegisken.length === 0, "eksik: " + eksikDegisken.join(", "));

/* Cron işleri vercel.json ile tutuyor mu. */
const vercel = JSON.parse(readFileSync(new URL("vercel.json", kok), "utf8"));
const cronlar = vercel.crons || [];
const eksikCron = cronlar.filter((c) => !belge.includes(c.path));
t(`${cronlar.length} zamanlanmış işin hepsi belgede`,
  eksikCron.length === 0, "eksik: " + eksikCron.map((c) => c.path).join(", "));

/* Drive durum klasörlerinin adları. */
const driveKaynak = readFileSync(new URL("lib/drive-tasima.js", kok), "utf8");
const durumlar = [...(driveKaynak.match(/"([0-9] [A-ZÇĞİÖŞÜ ]+)"/g) || [])].map((x) => x.slice(1, -1));
const eksikDurum = durumlar.filter((d) => !belge.includes(d));
t("Drive durum klasörlerinin adları belgede doğru",
  eksikDurum.length === 0, "eksik: " + eksikDurum.join(", "));

if (hata > 0) {
  console.log("\n  MARCUS-OS-SISTEM.md bayatladı — envanter kodla uyuşmuyor.");
  process.exitCode = 1;
}
