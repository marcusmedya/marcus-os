/* GERÇEK SÖZDİZİMİ DENETİMİ — dosyaları GERÇEKTEN ayrıştırır.
 *
 * NEDEN GEREKTİ: 1 numaralı denetim (jsxdenetle.py) kendi sezgisel ayrıştırıcısını
 * kullanıyor. Bir import satırına yanlışlıkla ÇİFT VİRGÜL girdiğinde "✓ sözdizimi" dedi
 * ama esbuild dosyayı hiç ayrıştıramadı ve derleme patladı. Yani denetim geçerken
 * uygulama derlenmiyordu — en kötü türden yanlış güven.
 *
 * Bu betik derleyicinin kendisini kullanıyor: geçtiyse dosya gerçekten ayrıştırılabilir.
 * Sezgisel denetimlerin yerine geçmiyor (onlar anlam hatalarını yakalıyor), yanına
 * ekleniyor.
 */
import { transform } from "esbuild";
import { readFileSync } from "fs";
import path from "path";

const desenler = ["src", "api", "lib"];
const dosyalar = [];
for (const klasor of desenler) {
  const { readdirSync } = await import("fs");
  for (const ad of readdirSync(klasor)) {
    if (/\.(jsx?|mjs)$/.test(ad)) dosyalar.push(path.join(klasor, ad));
  }
}

let hata = 0;
for (const yol of dosyalar) {
  const kaynak = readFileSync(yol, "utf8");
  try {
    await transform(kaynak, {
      loader: yol.endsWith(".jsx") ? "jsx" : "js",
      format: "esm",
    });
  } catch (e) {
    hata += 1;
    const ilk = (e.errors && e.errors[0]) || {};
    const yer = ilk.location ? `${ilk.location.line}:${ilk.location.column}` : "?";
    console.log(`✗ ${yol}:${yer} — ${ilk.text || e.message}`);
  }
}

if (hata > 0) {
  console.log(`\n${hata} dosya ayrıştırılamadı.`);
  process.exit(1);
}
console.log(`${dosyalar.length} dosya ayrıştırıldı, sorun yok.`);
