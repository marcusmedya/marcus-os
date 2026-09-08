/* DENETİM 24 — SAF FONKSİYONUN DÖNÜŞ DEĞERİ ATILMASIN
 *
 * Saf bir fonksiyon yalnızca DÖNDÜRDÜĞÜ değerle iş görür: kendisine verileni
 * değiştirmez. Çağrılıp sonucu bir yere yazılmazsa o satır HİÇBİR ŞEY YAPMAZ —
 * ama kod okunurken bir şey yapıyormuş gibi durur, hata da vermez.
 *
 * BU GERÇEKTEN YAŞANDI: çekim listesinin elle sıralaması `siraliGruplar(gruplar,
 * cekimSirasi);` diye çağrıldı. Modül diziyi KOPYALAYIP sıralıyor ve kopyayı
 * döndürüyor; kaynak dizi olduğu gibi kaldı. Sonuç: kullanıcı okla markayı taşıyor,
 * sıra sunucuya yazılıyor, "Elle sıralama açık" yazısı çıkıyor — ama liste hiç yer
 * değiştirmiyordu. Derleme, 2184 sunucu kontrolü ve 23 statik denetim geçti; hiçbiri
 * yakalamadı çünkü hepsi modülü DOĞRUDAN çağırıyor, arayüzün onu nasıl kullandığına
 * bakmıyor.
 *
 * Saflık listesi `MARCUS-OS-SISTEM.md`'deki "(**saf**)" işaretinden okunuyor — ayrı
 * bir liste tutulsaydı bayatlardı; o belge zaten denetim 18 ile güncel tutuluyor.
 */
import fs from "node:fs";
import path from "node:path";

const kok = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
/* Yorumlar ayıklanırken SATIR SAYISI KORUNUYOR: blok yorum tek boşluğa indirilince
 * bildirilen satır numarası kayıyor ve rapor yanlış yeri gösteriyor (ölçüldü: 3700
 * yerine 3404 yazdı). Yanlış satır, denetimi okuyan kişiyi yanlış yere gönderir. */
const yorumlariAyikla = (metin) =>
  metin
    .replace(/\/\*[\s\S]*?\*\//g, (p) => p.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, " ");

/* 1) Belgede saf işaretli modüller. */
const belge = fs.readFileSync(path.join(kok, "MARCUS-OS-SISTEM.md"), "utf8");
const safModuller = [...belge.matchAll(/\|\s*`([a-zA-Z0-9_-]+\.js)`\s*\|[^|\n]*\(\*\*saf\*\*\)/g)]
  .map((m) => m[1])
  .filter((ad) => fs.existsSync(path.join(kok, "lib", ad)));

/* 2) O modüllerin dışa verdiği fonksiyon adları. */
const safAdlar = new Map();   // ad -> modül
for (const modul of safModuller) {
  const kod = yorumlariAyikla(fs.readFileSync(path.join(kok, "lib", modul), "utf8"));
  for (const m of kod.matchAll(/export\s+function\s+(\w+)/g)) safAdlar.set(m[1], modul);
}

/* 3) Çağrı yerleri. Yalnızca DEYİM konumundaki çıplak çağrı aranıyor: satır `ad(` ile
 * başlıyor ve `);` ile bitiyor. Zincirlenen (`ad(x).forEach(…)`) ya da bir ifadenin
 * içindeki çağrı sonucu KULLANIYOR demektir, onlar sorun değil. */
let bakilanCagri = 0, hata = 0;
for (const klasor of ["src", "lib", "api"]) {
  const dizin = path.join(kok, klasor);
  for (const ad of fs.readdirSync(dizin)) {
    if (!/\.(js|jsx)$/.test(ad)) continue;
    const satirlar = yorumlariAyikla(fs.readFileSync(path.join(dizin, ad), "utf8")).split("\n");
    satirlar.forEach((satir, i) => {
      /* Her çağrı sayılıyor (ifadenin içindekiler dahil) — sayaç denetimin gerçekten
       * bir şeye baktığını kanıtlıyor. Hata yalnızca DEYİM konumundakiler için. */
      for (const ad of safAdlar.keys()) {
        if (new RegExp(`\\b${ad}\\s*\\(`).test(satir)) bakilanCagri++;
      }
      const m = satir.match(/^\s*(\w+)\s*\(/);
      if (!m || !safAdlar.has(m[1])) return;
      if (!/\)\s*;\s*$/.test(satir)) return;   // zincir ya da devam eden ifade
      hata++;
      console.log(`  ✗ ${klasor}/${ad}:${i + 1} — \`${m[1]}\` saf (lib/${safAdlar.get(m[1])}), dönüş değeri atılıyor`);
      console.log(`      ${satir.trim().slice(0, 100)}`);
      console.log("      bu satır hiçbir şey yapmıyor: sonucu bir değişkene ata ya da çağrıyı sil");
    });
  }
}

/* Denetimin bir şeye baktığını doğrula — hiç saf modül ya da hiç çağrı bulamazsa
 * sessizce "temiz" demesi, olmayan bir güvence devretmek olurdu. */
if (safModuller.length === 0 || safAdlar.size === 0) {
  console.log("  ✗ belgede saf işaretli modül bulunamadı — denetim bir şey sınamıyor");
  process.exit(1);
}
if (bakilanCagri === 0) {
  console.log("  ✗ saf fonksiyonların hiçbirine çağrı bulunamadı — denetim bir şey sınamıyor");
  process.exit(1);
}
if (hata > 0) { console.log("\n  Saf dönüş değeri denetimi düştü."); process.exit(1); }
console.log(`  ✓ ${safModuller.length} saf modülün ${safAdlar.size} fonksiyonuna yapılan ${bakilanCagri} çağrının hepsi sonucu kullanıyor`);
