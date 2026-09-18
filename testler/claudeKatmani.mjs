/* .CLAUDE/ KATMANI BAYAT MI — denetim 27
 *
 * `.claude/` altında komutlar, ajanlar ve uzmanlık skill'leri duruyor ve bunlar kod
 * hakkında İDDİA taşıyor: "kural `lib/stok.js`'te", "emsal `testler/t95.mjs`",
 * "`marcus-yetki` skill'ini yükle". Bu iddiaların hiçbiri bugüne kadar DENETLENMİYORDU.
 *
 * Bayat bir skill, olmayan bir skill'den daha tehlikelidir: yeni oturum ona güvenerek
 * başlar ve yanlış varsayımla çalışır. Bir dosya yeniden adlandırıldığında ya da bir skill
 * silindiğinde hiçbir kapı bunu görmüyordu — `.claude/` hiçbir denetimin, hiçbir testin
 * ve derlemenin kapsamında değil.
 *
 * Üç şey sınanıyor:
 *   1. Her skill/ajan dosyasının önbilgisi geçerli mi (name + description) ve `name`
 *      bulunduğu klasörün/dosyanın adıyla aynı mı — tutmazsa Claude Code onu YÜKLEYEMEZ.
 *   2. Ters tırnak içinde adı geçen her dosya yolu gerçekten var mı.
 *   3. "Şu skill'i yükle" diye işaret edilen her skill gerçekten var mı.
 *
 * Yanlış alarm üretmemek için: joker içeren yollar (`api/*.js`), uzantısız sözcükler ve
 * url'ler atlanır. `references/...` skill KÖKÜNE göre çözülür (aşağıda gerekçesi).
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;
const hatalar = [];

/* ── dosyaları topla ─────────────────────────────────────────────────────────── */
function mdDosyalari(dizin) {
  const cikti = [];
  if (!existsSync(dizin)) return cikti;
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) cikti.push(...mdDosyalari(yol));
    else if (ad.endsWith(".md")) cikti.push(yol);
  }
  return cikti;
}

const claudeDizini = join(KOK, ".claude");
const dosyalar = mdDosyalari(claudeDizini);

if (dosyalar.length === 0) {
  console.log("✗ .claude/ altında hiç .md bulunamadı — denetim yanlış yere bakıyor olabilir");
  process.exit(1);
}

/* ── 1 · önbilgi geçerli mi, ad klasörle tutuyor mu ──────────────────────────── */
const skillAdlari = new Set();

for (const yol of dosyalar) {
  const goreli = yol.slice(KOK.length);
  const metin = readFileSync(yol, "utf8");
  const skillMi = goreli.includes("/skills/") && basename(yol) === "SKILL.md";
  const ajanMi = goreli.includes("/agents/");
  if (!skillMi && !ajanMi) continue;          // komutlar ve references/ serbest

  if (!metin.startsWith("---\n")) {
    hatalar.push(`${goreli}: önbilgi (frontmatter) yok — Claude Code bunu yükleyemez`);
    continue;
  }
  const son = metin.indexOf("\n---", 4);
  const onbilgi = metin.slice(4, son === -1 ? 0 : son);
  const ad = (onbilgi.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const aciklama = (onbilgi.match(/^description:\s*(.+)$/m) || [])[1]?.trim();

  if (!ad) hatalar.push(`${goreli}: önbilgide 'name' yok`);
  if (!aciklama) hatalar.push(`${goreli}: önbilgide 'description' yok — skill hiç tetiklenmez`);

  const beklenen = skillMi ? basename(dirname(yol)) : basename(yol, ".md");
  if (ad && ad !== beklenen) {
    hatalar.push(`${goreli}: 'name: ${ad}' ile dosya/klasör adı '${beklenen}' tutmuyor`);
  }
  if (skillMi && ad) skillAdlari.add(ad);
}

/* ── 2 · ters tırnaklı dosya yolları gerçek mi ───────────────────────────────── */
const UZANTILAR = /\.(js|jsx|mjs|py|sh|md|json|html|css)$/;

for (const yol of dosyalar) {
  const goreli = yol.slice(KOK.length);
  const metin = readFileSync(yol, "utf8");
  for (const eslesme of metin.matchAll(/`([^`\n]+)`/g)) {
    const aday = eslesme[1].trim();
    if (!aday.includes("/") || !UZANTILAR.test(aday)) continue;
    if (aday.includes("*") || aday.includes(" ") || aday.includes("://")) continue;
    if (aday.startsWith("@")) continue;                       // paket adı (@vercel/kv)

    /* Yol üç yere göre çözülebilir; biri tutuyorsa geçerli:
     *   · depo kökü — en yaygın hâl (`lib/stok.js`)
     *   · SKILL KÖKÜ — skill belgeleri `references/…` derken kendi köklerini kasteder,
     *     dosyanın bulunduğu klasörü değil (references/ içinden yazılan bir satır da
     *     aynı anlama gelir, yoksa references/references/ aranırdı)
     *   · .claude/ — bu klasörün içindeki belgeler zaman zaman ona göre yol yazıyor */
    const skillKoku = (yol.match(/^(.*\/\.claude\/skills\/[^/]+)\//) || [])[1];
    const adaylar = [join(KOK, aday), join(claudeDizini, aday)];
    if (skillKoku) adaylar.push(join(skillKoku, aday));
    if (!adaylar.some((p) => existsSync(p))) {
      hatalar.push(`${goreli}: \`${aday}\` diye bir dosya YOK (yeniden adlandırılmış ya da silinmiş olabilir)`);
    }
  }
}

/* ── 3 · işaret edilen skill'ler var mı ──────────────────────────────────────── */
const isaretEdilen = new Set();
const taranacak = [...dosyalar, join(KOK, "CLAUDE.md")];
for (const yol of taranacak) {
  if (!existsSync(yol)) continue;
  const metin = readFileSync(yol, "utf8");
  for (const eslesme of metin.matchAll(/`(marcus-[a-z]+)`/g)) isaretEdilen.add(eslesme[1]);
}
for (const ad of isaretEdilen) {
  if (!skillAdlari.has(ad)) {
    hatalar.push(`\`${ad}\` skill'ine işaret ediliyor ama .claude/skills/${ad}/SKILL.md yok`);
  }
}

/* ── sonuç ───────────────────────────────────────────────────────────────────── */
if (hatalar.length) {
  hatalar.forEach((h) => console.log(`✗ ${h}`));
  console.log(`\n${hatalar.length} sorun — .claude/ katmanı koda göre bayatlamış.`);
  process.exit(1);
}
console.log(`✓ .claude/ katmanı güncel — ${dosyalar.length} belge, ${skillAdlari.size} skill, yol ve işaretler doğrulandı`);
