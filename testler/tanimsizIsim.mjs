/* DENETİM 25 — TANIMLANMAMIŞ İSME ÇAĞRI
 *
 * NEDEN GEREKTİ: bu projedeki en sık hata sınıfı "kod doğru, bağlanışı yanlış". Bir
 * bileşen bir prop'u KULLANIYOR ama parametre listesinde yok; ya da bir blok yanlışlıkla
 * başka bir fonksiyonun gövdesine düşüyor. İkisi de aynı sonucu veriyor: kaynakta duran
 * bir isim, çalışma anında YOK.
 *
 * BU HATALAR HİÇBİR KATMANDAN GEÇMİYORDU:
 *   · `npm run build` geçiyor — paketleyici tanımsız ismi hata saymıyor, global sanıyor.
 *   · Bütün sunucu kontrolleri geçiyor — hiçbiri React bileşenini ÇİZMİYOR.
 *   · 24 statik denetim geçiyor — hepsi kaynak METNİNE bakıyor, kapsama değil.
 *
 * SAHADA İKİ KEZ YAKALADI:
 *   1. `onAltMetin` — alt yazı ekranı fonksiyonu çağırıyordu ama `Paylasimlar` onu hiç
 *      geçirmiyordu. Ekran "Kaydediliyor…"de kilitleniyor, yazılan metin kayboluyordu.
 *      İLK GÜNDEN BERİ böyleydi ve hiçbir test görmedi.
 *   2. `odemeTakvimiProps` — prop nesnesi yanlışlıkla `deleteBekleyen`'in GÖVDESİNE
 *      düştü. Nesne dışarıdan görünmez, fonksiyon bozuk. Derleme, sunucu kontrolleri ve
 *      denetim geçti; yalnızca bu tarama gördü.
 *
 * NE YAKALAMAZ, AÇIKÇA: ismin TANIMLI olup DEĞERİNİN yanlış olduğu hataları. Siyah ekrana
 * yol açan `data.clients` okuması böyleydi — `data` tanımlıydı, değeri `null`'dı. Bu
 * denetim onu göremez ve görebildiğini iddia etmiyor.
 *
 * YANLIŞ ALARM MALİYETİ: standart global adları (window, Promise, Buffer…) listede.
 * Liste eksikse denetim yanlış yere "hata" der — o yüzden yeni bir global kullanıldığında
 * buraya eklenir. Ölçüldü: bugün 74 dosyada sıfır yanlış alarm.
 */
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/* @babel/traverse CommonJS olarak yayımlanıyor; ESM'den `default` sarmalı geliyor. */
const traverse = _traverse.default || _traverse;

const kok = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

/** Tarayıcı ve Node'un kendi global adları — tanımsız SAYILMAZLAR. */
const GLOBALLER = new Set([
  // tarayıcı
  "window", "document", "navigator", "console", "fetch", "alert", "confirm", "prompt",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "localStorage", "sessionStorage", "IntersectionObserver", "AbortController",
  "XMLHttpRequest", "FormData", "FileReader", "Blob", "File", "Image", "Event",
  "URL", "URLSearchParams", "btoa", "atob", "performance", "crypto", "structuredClone",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  // dil
  "Object", "Array", "String", "Number", "Boolean", "Math", "JSON", "Date", "RegExp",
  "Set", "Map", "WeakMap", "WeakSet", "Promise", "Symbol", "Proxy", "Reflect", "Intl",
  "Error", "TypeError", "RangeError", "SyntaxError", "BigInt",
  "isNaN", "isFinite", "parseInt", "parseFloat", "globalThis",
  "undefined", "NaN", "Infinity", "Uint8Array", "ArrayBuffer", "TextEncoder", "TextDecoder",
  // node
  "process", "Buffer", "__dirname", "__filename",
]);

const KLASORLER = ["src", "lib", "api"];

let hata = 0;
let bakilanDosya = 0;
let bakilanIsim = 0;

for (const klasor of KLASORLER) {
  const dizin = path.join(kok, klasor);
  for (const ad of readdirSync(dizin)) {
    if (!/\.(jsx?|mjs)$/.test(ad)) continue;
    const yol = path.join(klasor, ad);
    bakilanDosya++;

    let ast;
    try {
      ast = parse(readFileSync(path.join(kok, yol), "utf8"), {
        sourceType: "module",
        plugins: ["jsx"],
      });
    } catch (e) {
      /* Ayrıştırılamayan dosya SESSİZCE ATLANMAZ: denetim 1b zaten sözdizimine bakıyor
       * ama burada da patlarsa bu dosya hiç taranmamış olur ve "temiz" sanılır. */
      console.log(`  ✗ ${yol} ayrıştırılamadı: ${e.message}`);
      hata++;
      continue;
    }

    traverse(ast, {
      Program(yol0) {
        const bulunan = new Map();
        yol0.traverse({
          Identifier(ip) {
            if (!ip.isReferencedIdentifier()) return;
            const isim = ip.node.name;
            bakilanIsim++;
            if (GLOBALLER.has(isim)) return;
            /* `hasBinding(isim, true)` = üst kapsamlar dahil. Bulunamazsa bu isim
             * çalışma anında ReferenceError üretir (ya da `typeof` ile sessizce yutulur). */
            if (ip.scope.hasBinding(isim, true)) return;
            if (!bulunan.has(isim)) bulunan.set(isim, ip.node.loc.start.line);
          },
        });
        for (const [isim, satir] of bulunan) {
          console.log(`  ✗ ${yol}:${satir} — "${isim}" hiçbir kapsamda tanımlı değil`);
          hata++;
        }
      },
    });
  }
}

/* DENETİM BİR ŞEY SINAMIYORSA BUNU SÖYLESİN — bu projede bir denetim sessizce
 * çalışmaz hale geldi ve "geçti" diyerek yanlış güven üretti (bkz. t95). */
if (bakilanDosya === 0 || bakilanIsim === 0) {
  console.log("  ✗ hiç dosya/isim taranmadı — denetim bir şey sınamıyor, gözden geçir");
  hata++;
} else if (hata === 0) {
  console.log(`  ✓ ${bakilanDosya} dosyada tanımlanmamış isme çağrı yok (${bakilanIsim} isim tarandı)`);
}

if (hata > 0) { console.log("\n  Tanımsız isim denetimi düştü."); process.exit(1); }
