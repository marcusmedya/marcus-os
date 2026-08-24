/* DENETİM 22 — YENİDEN DIŞA VERİLEN AD, DOSYANIN KENDİ İÇİNDE KULLANILMASIN
 *
 * `export { X } from "./y.js"` bir KÖPRÜDÜR: adı dışarı taşır ama dosyanın kendi
 * kapsamında X diye bir değişken OLUŞTURMAZ. Aynı dosyada X kullanılıyorsa çalışma
 * anında "Can't find variable: X" ile patlar.
 *
 * BU GERÇEKTEN YAŞANDI: KATEGORILER böyle yazıldı; DERLEME GEÇTİ, 1877 sunucu kontrolü
 * geçti, 21 statik denetim geçti — ve Operasyon bölümü hiç açılmadı. Hiçbir katman
 * yakalamadı: sunucu testleri React bileşenini çalıştırmıyor, paketleyici bunu hata
 * saymıyor.
 *
 * Doğrusu: içe aktar, sonra `export { X };` ile yeniden dışa ver — o zaman yerel bağ olur.
 */
import fs from "node:fs";
import path from "node:path";

const kok = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const klasorler = ["src", "lib", "api"];

let hata = 0, bakilanDosya = 0, kopruSayisi = 0;

/* YALNIZCA YORUMLAR ayıklanıyor. İlk yazımda dize sabitleri de siliniyordu ve iki şey
 * birden bozuldu: `from "../lib/x.js"` → `from ""` olduğu için KÖPRÜ HİÇ EŞLEŞMEDİ, ve
 * kullanım sayısı 4 yerine 2 çıktı. Ölçüldü: bozma geri konduğunda denetim "temiz" dedi.
 * Bir adın dize içinde geçmesi yanlış alarm üretebilir — o ucuz bir bedel. */
const yorumlariAyikla = (metin) =>
  metin.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

for (const klasor of klasorler) {
  const dizin = path.join(kok, klasor);
  if (!fs.existsSync(dizin)) continue;
  for (const ad of fs.readdirSync(dizin)) {
    if (!/\.(js|jsx|mjs)$/.test(ad)) continue;
    const kod = yorumlariAyikla(fs.readFileSync(path.join(dizin, ad), "utf8"));
    bakilanDosya++;

    /* Yalnızca KÖPRÜ biçimi. Kaynağı olmayan `export { X };` yerel bağı dışa
     * veriyor, sorun değil. */
    const kopruler = [...kod.matchAll(/export\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?/g)];
    if (kopruler.length === 0) continue;

    /* Köprü satırlarının KENDİSİ kullanım sayılmasın diye metinden çıkarılıyor. */
    let kalanKod = kod;
    kopruler.forEach((m) => { kalanKod = kalanKod.split(m[0]).join(" "); });

    for (const kopru of kopruler) {
      kopruSayisi++;
      const adlar = kopru[1].split(",")
        .map((x) => (x.trim().split(/\s+as\s+/)[0] || "").trim())
        .filter(Boolean);

      for (const isim of adlar) {
        const iceAktarilmis = new RegExp(`import\\s*\\{[^}]*\\b${isim}\\b[^}]*\\}`).test(kod)
          || new RegExp(`import\\s+${isim}\\b`).test(kod);
        if (iceAktarilmis) continue;

        const kullanim = [...kalanKod.matchAll(new RegExp(`\\b${isim}\\b`, "g"))].length;
        if (kullanim > 0) {
          hata++;
          console.log(`  ✗ ${klasor}/${ad} — "${isim}" yeniden dışa veriliyor ama AYNI DOSYADA ${kullanim} kez kullanılıyor`);
          console.log(`      çalışma anında: "Can't find variable: ${isim}"`);
          console.log(`      doğrusu: önce içe aktar, sonra \`export { ${isim} };\``);
        }
      }
    }
  }
}

if (kopruSayisi === 0) {
  console.log("  ✗ hiç `export {…} from` köprüsü bulunamadı — denetim bir şey sınamıyor, gözden geçir");
  hata++;
} else if (hata === 0) {
  console.log(`  ✓ ${kopruSayisi} yeniden dışa verme köprüsünün hiçbiri kendi dosyasında kullanılmıyor (${bakilanDosya} dosya)`);
}

if (hata > 0) { console.log("\n  Yeniden dışa verme denetimi düştü."); process.exit(1); }
