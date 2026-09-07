/* DENETİM 23 — İKİ İZİN LİSTESİ AYRIŞAMAZ
 *
 * `src/App.jsx` içinde yetki kutucukları İKİ ayrı listeden çiziliyor:
 *   STAFF_IZIN_LISTESI  → "Genel Yetkiler" kartı (ortak personel şifresiyle girenler)
 *   IZIN_LISTESI        → "Bu kişiye özel yetkiler" paneli (kişisel hesaplar)
 *
 * Bu ikisi bir kez ayrıştı ve sonucu şuydu: Operasyon alt yetkileri (kartAcma,
 * kartOnaylama, kartDuzenleme, kartSilme) yalnızca birinciye eklendi, kişiye özel
 * panelde HİÇ GÖRÜNMEDİ — yani yetki sunucuda vardı ama yöneticinin onu verebileceği
 * bir kutucuk yoktu. Derleme de testler de bunu göremez.
 *
 * VARSAYILANLAR DA AYNI OLMALI. Kişiye özel panelde `kartAcma` kapalı gösterilseydi,
 * yönetici paneli açıp kaydettiği anda personelin kart açma yetkisini farkında olmadan
 * elinden alırdı — kutucuk kapalı görünüyor diye `false` yazılır.
 *
 * Etiketler bilerek farklı (kişiye özel panelde yer dar, kısaltılmış); denetlenen
 * ANAHTARLAR ve VARSAYILANLAR.
 */
import { readFileSync } from "node:fs";

const kaynak = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const apiKaynak = readFileSync(new URL("../api/data.js", import.meta.url), "utf8");

/** Sunucudaki `DEFAULT_PERMS` — asıl otorite. Kişisel hesapta da uygulanıyor
 * (`{ ...DEFAULT_PERMS, ...hesap.izinler }`), bu yüzden panelin gösterdiği varsayılan
 * bununla aynı olmak zorunda. Ayrışırsa panel yalan söyler: kutucuk kapalı görünür ama
 * yetki açıktır — yönetici "kapalı" sanıp güvenir. Bu gerçekten yaşandı (reklamlar,
 * paylasimlar, cekimEdit). */
function sunucuVarsayilanlari() {
  const bas = apiKaynak.indexOf("const DEFAULT_PERMS");
  if (bas === -1) throw new Error("DEFAULT_PERMS bulunamadı — bu denetim körleşir");
  const govde = apiKaynak.slice(bas, apiKaynak.indexOf("};", bas));
  const cift = [...govde.matchAll(/(\w+):\s*(true|false)/g)];
  if (cift.length === 0) throw new Error("DEFAULT_PERMS içinden hiç değer okunamadı");
  return Object.fromEntries(cift.map((m) => [m[1], m[2] === "true"]));
}

/** Bir liste değişmezinden `{ key, varsayilan }` çiftlerini çıkarır. */
function listeyiOku(ad) {
  const bas = kaynak.indexOf(`${ad} = [`);
  if (bas === -1) throw new Error(`${ad} bulunamadı — yeniden adlandırıldıysa bu denetim körleşir`);
  const son = kaynak.indexOf("\n  ];", bas) !== -1 && kaynak.indexOf("\n  ];", bas) < kaynak.indexOf("\n];", bas)
    ? kaynak.indexOf("\n  ];", bas) : kaynak.indexOf("\n];", bas);
  if (son === -1) throw new Error(`${ad} listesinin sonu bulunamadı`);
  const govde = kaynak.slice(bas, son);
  const kayitlar = [...govde.matchAll(/\{\s*key:\s*"([^"]+)"[^}]*?\}/g)].map((m) => {
    const varsayilan = /varsayilan:\s*true/.test(m[0]);
    return { key: m[1], varsayilan };
  });
  if (kayitlar.length === 0) throw new Error(`${ad} içinden hiç kayıt okunamadı — biçim değişmiş olabilir`);
  return kayitlar;
}

const ortak = listeyiOku("const STAFF_IZIN_LISTESI");
const kisisel = listeyiOku("  const IZIN_LISTESI");

const hatalar = [];

const ortakAnahtarlar = ortak.map((x) => x.key);
const kisiselAnahtarlar = kisisel.map((x) => x.key);

const eksikKisisel = ortakAnahtarlar.filter((k) => !kisiselAnahtarlar.includes(k));
const eksikOrtak = kisiselAnahtarlar.filter((k) => !ortakAnahtarlar.includes(k));

if (eksikKisisel.length > 0) {
  hatalar.push(`kişiye özel panelde YOK (yetki verilemez): ${eksikKisisel.join(", ")}`);
}
if (eksikOrtak.length > 0) {
  hatalar.push(`ortak şifre kartında YOK: ${eksikOrtak.join(", ")}`);
}

ortak.forEach((o) => {
  const k = kisisel.find((x) => x.key === o.key);
  if (k && k.varsayilan !== o.varsayilan) {
    hatalar.push(`"${o.key}" varsayılanı iki panelde ayrışmış — ortak: ${o.varsayilan}, kişisel: ${k.varsayilan}`);
  }
});

/* ÜÇÜNCÜ TARAF: SUNUCU. İki panel birbiriyle tutup ikisi de sunucudan farklı olabilir. */
const sunucu = sunucuVarsayilanlari();
[...ortak, ...kisisel].forEach((x) => {
  if (sunucu[x.key] === undefined) return;   // sunucuda varsayılanı olmayan izin
  if (sunucu[x.key] !== x.varsayilan) {
    hatalar.push(`"${x.key}" panelde ${x.varsayilan}, sunucuda ${sunucu[x.key]} — panel yalan söyler`);
  }
});

const sunucuFazlasi = Object.keys(sunucu).filter((k) => !ortakAnahtarlar.includes(k) && k !== "takvim");
if (sunucuFazlasi.length > 0) {
  hatalar.push(`sunucuda tanımlı ama hiçbir panelde YOK (verilemez): ${sunucuFazlasi.join(", ")}`);
}

if (hatalar.length > 0) {
  console.error("İZİN LİSTELERİ AYRIŞMIŞ:");
  hatalar.forEach((h) => console.error("  · " + h));
  process.exit(1);
}

console.log(`${ortakAnahtarlar.length} izin anahtarı iki panelde ve sunucuda aynı`);
