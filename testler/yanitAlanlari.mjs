/* DENETİM 21 — YANIT ALANI BELGEYE SIZMASIN, OKUNAN YANIT ELE ULAŞSIN
 *
 * `api/paylasim.js` yanıtı istemcide `setData` içine olduğu gibi yayılıyor. Sunucunun
 * yalnızca o istek için ürettiği bir alan (`eslestirme`, `sebep`, …) BELGE_DISI_ALANLAR
 * listesinde yoksa uygulama verisinin içine karışır ve bir sonraki kayıtta Redis'e
 * yazılır. Bu yaşandı: Drive tarama sonucu belgeye sızıyordu.
 *
 * İkinci kural aynı hatanın diğer ucu: yanıtı OKUYAN bir çağrı varsa, gönderen
 * fonksiyon yanıtı döndürmek zorunda. `paylasimIstek` çıplak `return` yapıyordu;
 * Drive eşleştirmesi hep `undefined` alıyor ve tarama başarılı olsa bile ekranda
 * "Drive taranamadı." yazıyordu.
 *
 * Bu denetim METNE bakıyor — React bileşeni sunucu testlerinden çağrılamıyor. Bu
 * yüzden dar tutuldu: iki somut yapıyı sınıyor, üslup denetlemiyor.
 */
import fs from "node:fs";

const paylasim = fs.readFileSync("api/paylasim.js", "utf8");
const app = fs.readFileSync("src/App.jsx", "utf8");
const dataUc = fs.readFileSync("api/data.js", "utf8");

let hata = 0;
const bildir = (m) => { hata++; console.log(`  ✗ ${m}`); };

/** `{` ile başlayan dengeli bloğu döndürür. */
function blok(metin, acilisIndeksi) {
  let derinlik = 0;
  for (let i = acilisIndeksi; i < metin.length; i++) {
    if (metin[i] === "{") derinlik++;
    else if (metin[i] === "}") { derinlik--; if (derinlik === 0) return metin.slice(acilisIndeksi, i + 1); }
  }
  return "";
}

/** Bir nesne bloğunun ÜST DÜZEY anahtarları. */
function ustDuzeyAnahtarlar(nesne) {
  const anahtarlar = [];
  let derinlik = 0, parantez = 0, koseli = 0;
  let parca = "";
  for (let i = 1; i < nesne.length - 1; i++) {
    const c = nesne[i];
    if (c === "{") derinlik++; else if (c === "}") derinlik--;
    else if (c === "(") parantez++; else if (c === ")") parantez--;
    else if (c === "[") koseli++; else if (c === "]") koseli--;
    if (derinlik === 0 && parantez === 0 && koseli === 0 && c === ",") { anahtarlar.push(parca); parca = ""; continue; }
    parca += c;
  }
  anahtarlar.push(parca);
  return anahtarlar
    .map((p) => { const m = p.match(/^\s*(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)\s*(:|,|$)/); return m && m[2] === ":" ? m[1] : null; })
    .filter(Boolean);
}

/* 1) Belge alanları — uçtaki varsayılan belge biçiminden. */
const varsayilanBaslangic = dataUc.indexOf("const DEFAULT_FIELD_VALUES = {");
const belgeAlanlari = new Set(ustDuzeyAnahtarlar(blok(dataUc, dataUc.indexOf("{", varsayilanBaslangic))));
/* Varsayılanı olmayan ama belgeye ait olanlar. */
["_v", "_alanSurumleri", "musteriTalepleri", "silinenler", "guvenlikDefteri", "personelRosteri", "musteriRosteri",
 "ayarlar", "sifreKasasi", "islemKimlikleri"].forEach((a) => belgeAlanlari.add(a));
if (belgeAlanlari.size < 15) bildir(`belge alanları okunamadı (${belgeAlanlari.size} bulundu)`);

/* 2) Uçta üretilen yanıt anahtarları. */
const yanitAnahtarlari = new Set();
let ara = 0;
for (;;) {
  const i = paylasim.indexOf(".json({", ara);
  if (i === -1) break;
  ara = i + 6;
  const nesne = blok(paylasim, paylasim.indexOf("{", i));
  /* YALNIZCA BAŞARILI yanıtlar. Hata yanıtları (409, 404) istemcide `setData` içine
   * yayılmıyor — onları da saymak, olmayan bir sızıntıyı bildirmek olurdu. */
  if (!/\bok:\s*true/.test(nesne)) continue;
  ustDuzeyAnahtarlar(nesne).forEach((a) => yanitAnahtarlari.add(a));
}
if (yanitAnahtarlari.size < 5) bildir(`yanıt anahtarları okunamadı (${yanitAnahtarlari.size} bulundu)`);

/* 3) BELGE_DISI_ALANLAR listesi. */
const listeSatiri = app.match(/const BELGE_DISI_ALANLAR = \[([\s\S]*?)\];/);
if (!listeSatiri) bildir("BELGE_DISI_ALANLAR listesi bulunamadı");
const belgeDisi = new Set((listeSatiri ? listeSatiri[1] : "").match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || []);

const sizanlar = [...yanitAnahtarlari].filter((a) => !belgeAlanlari.has(a) && !belgeDisi.has(a));
if (sizanlar.length > 0) {
  bildir(`yanıt alanı BELGEYE SIZIYOR: ${sizanlar.join(", ")} — BELGE_DISI_ALANLAR'a ekle`);
} else {
  console.log(`  ✓ ${yanitAnahtarlari.size} yanıt alanının hiçbiri belgeye sızmıyor`);
}

/* 4) Yanıtı okuyan çağrı var mı — varsa gönderen yanıtı döndürüyor mu? */
const govdeBaslangic = app.indexOf("const paylasimIstek = (body, hataMesaji, secenekler) => {");
if (govdeBaslangic === -1) bildir("paylasimIstek bulunamadı");
const govde = blok(app, app.indexOf("{", govdeBaslangic));
const okuyanVar = /onDriveEslestir\(client\.id\)\)\s*\n?\s*\.then\(\(r\) =>/.test(app) || /\.then\(\(r\) => setDrive\(/.test(app);
/* BAŞARI DALINA bakılıyor. Fonksiyonun başka bir dalındaki `return res;` yetseydi
 * kontrol boşa çıkardı — ölçüldü: çıplak `return`'e geri dönüldüğünde denetim
 * hiçbir şey söylemedi çünkü hata dalındaki dönüş eşleşiyordu. */
const birlestirme = govde.indexOf("mergePaylasimLocally(res);");
const kalan = birlestirme === -1 ? "" : govde.slice(birlestirme);
const basariDali = kalan.slice(0, kalan.indexOf("\n        }") + 1);
if (birlestirme === -1) bildir("paylasimIstek başarı dalı bulunamadı");
if (okuyanVar && !/return res;/.test(basariDali)) {
  bildir("paylasimIstek yanıtı DÖNDÜRMÜYOR — yanıtı okuyan çağrı `undefined` alır (Drive eşleştirmesi bunu yaşadı)");
} else if (okuyanVar) {
  console.log("  ✓ yanıtı okuyan çağrı var ve gönderen yanıtı döndürüyor");
} else {
  bildir("yanıtı okuyan çağrı kalmamış — denetim artık bir şey sınamıyor, gözden geçir");
}

if (hata > 0) { console.log("\n  Yanıt alanı denetimi düştü."); process.exit(1); }
