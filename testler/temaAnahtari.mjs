/* TEMA ANAHTARI GERÇEKTEN VAR MI — T.xxx
 *
 * Tema tek bir nesne (`T`) ve arayüz renkleri oradan okuyor. Olmayan bir anahtar
 * yazmak HATA VERMEZ: `T.panel` sessizce `undefined` döner, CSS o özelliği yok sayar
 * ve öğe zeminsiz/renksiz çizilir. Ekranda "bir şey eksik gibi" görünür ama hiçbir
 * yerde hata yoktur.
 *
 * Bu gerçekten yaşandı: bir açılır kutuya `T.panel` yazıldı — o anahtar `T`'de değil,
 * başka bir dosyadaki `C` nesnesinde vardı. Kutu saydam çıkacaktı.
 *
 * Mevcut sözdizimi/sabit denetimleri bunu yakalamıyor; onlar TANIMSIZ AD arıyor,
 * burada ad (`T`) tanımlı, eksik olan özelliği.
 */
import { readFileSync, readdirSync } from "node:fs";

const kok = new URL("../", import.meta.url);
const tema = readFileSync(new URL("src/tema.jsx", kok), "utf8");

/* Tema paletinin anahtarları — KOYU nesnesinden okunuyor; ACIK aynı anahtarları
 * taşımak zorunda (temaUygula hepsini kopyalıyor). */
const koyu = (tema.match(/const KOYU = \{[\s\S]*?\n\};/) || [""])[0];
const anahtarlar = new Set([...koyu.matchAll(/^\s{2}([a-zA-Z][\w]*)\s*:/gm)].map((m) => m[1]));

/* T üzerine sonradan eklenen alanlar da geçerli (örn. temaUygula içinde). */
[...tema.matchAll(/\bT\.([a-zA-Z][\w]*)\s*=/g)].forEach((m) => anahtarlar.add(m[1]));

let hata = 0;
const t = (ad, ok, not) => { if (ok) console.log(`  ✓ ${ad}`); else { hata++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); } };

t("tema paleti okunabildi", anahtarlar.size > 5, `bulunan anahtar: ${anahtarlar.size}`);

const dosyalar = readdirSync(new URL("src/", kok)).filter((f) => f.endsWith(".jsx") || f.endsWith(".js"));
const eksikler = [];
for (const f of dosyalar) {
  const kaynak = readFileSync(new URL(`src/${f}`, kok), "utf8");
  for (const m of kaynak.matchAll(/\bT\.([a-zA-Z][\w]*)\b/g)) {
    /* Atama ve fonksiyon çağrısı hariç: yalnızca RENK OKUMA sınanıyor. */
    if (anahtarlar.has(m[1])) continue;
    eksikler.push(`${f}: T.${m[1]}`);
  }
}
t("her T.xxx tema paletinde var", eksikler.length === 0,
  [...new Set(eksikler)].join(", ") + " — sessizce undefined döner, öğe renksiz çizilir");

if (hata > 0) process.exitCode = 1;
