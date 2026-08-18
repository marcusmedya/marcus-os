/* OYNATICI BOYUTU VE TEKRAR EDEN ÖNİZLEME
 *
 * NEDEN BU TEST VAR:
 *   1. Kart içinde AYNI dosya iki kez gösteriliyordu: üstte çalışan oynatıcı, altta eski
 *      gömülü Drive çerçevesi (siyah kalan). Ekran ikiye bölünüyor ve alttaki bozuk
 *      görünüyordu. Tekrar, elle bir koşula bağlı — koşul kayarsa sessizce geri gelir.
 *   2. Oynatıcı genişliği artık ELLE girilen "yön" ayarından değil, videonun KENDİ
 *      oranından geliyor. Eşikler kayarsa dikey Reels yine geniş çerçevede devasa çıkar.
 */
import fs from "fs";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const drive = fs.readFileSync("src/drive.jsx", "utf8");
const cekim = fs.readFileSync("src/CekimEditTakibi.jsx", "utf8");

/* videoEni'yi kaynaktan alıp gerçek oranlarla sınıyoruz. */
const kesit = (() => {
  const b = drive.indexOf("export function videoEni(oran)");
  return drive.slice(b, drive.indexOf("\n}", b) + 2);
})();
/* Fonksiyonu TANIMLAYIP döndürüyoruz. İlk yazdığım hâlde hemen çağırıyordum; dışarıdaki
 * sarmalayıcı argümanı içeri geçirmediği için her oran 420 dönüyor ve test hiçbir şey
 * ölçmüyordu — üstelik "geçti" diyordu. */
const videoEni = new Function(kesit.replace("export ", "") + "\nreturn videoEni;")();

console.log("OYNATICI BOYUTU\n");

console.log(" Videonun kendi oranına göre genişlik");
const ORANLAR = {
  "Reels / Story (9:16)": [1080 / 1920, "dar"],
  "dikey 4:5": [1080 / 1350, "dar"],
  "kare 1:1": [1080 / 1080, "orta"],
  "yatay 16:9": [1920 / 1080, "genis"],
  "ultra geniş 21:9": [2560 / 1080, "genis"],
};
const olculer = {};
for (const [ad, [oran, sinif]] of Object.entries(ORANLAR)) {
  olculer[sinif] = olculer[sinif] || [];
  olculer[sinif].push(videoEni(oran));
  t(`${ad} ölçüldü`, Number.isFinite(videoEni(oran)) && videoEni(oran) > 0, `${videoEni(oran)}px`);
}
t("dikey video YATAYDAN dar", Math.max(...olculer.dar) < Math.min(...olculer.genis),
  `dikey ${olculer.dar} < yatay ${olculer.genis}`);
t("kare ikisinin arasında", Math.max(...olculer.dar) <= olculer.orta[0] && olculer.orta[0] <= Math.min(...olculer.genis),
  `${olculer.dar} <= ${olculer.orta} <= ${olculer.genis}`);
t("9:16 ile 4:5 aynı sınıfta", olculer.dar[0] === olculer.dar[1], olculer.dar.join(" / "));
t("oran bilinmiyorken de makul bir değer dönüyor",
  videoEni(null) > 0 && videoEni(null) < 800, `${videoEni(null)}px`);

console.log("\n Oran videodan okunuyor");
t("metadata olayına bağlanmış", /onLoadedMetadata/.test(drive) && /onLoadedMetadata/.test(cekim));
t("videoWidth/videoHeight kullanılıyor",
  /videoWidth \/ v\.videoHeight|videoWidth\s*\/\s*v\.videoHeight/.test(drive));
t("genişlik videoEni'den geliyor", /videoEni\(oran\)/.test(drive) && /videoEni\(oran\)/.test(cekim));

console.log("\n Tekrar eden önizleme");
const tekrarlar = (cekim.match(/job\.editliDosyaLink && !medyaKartta/g) || []).length;
t("alttaki önizlemelerin HEPSİ medya koşuluna bağlı", tekrarlar === 3, `${tekrarlar} yerde`);
t("koşul yüklenmiş medyaya bakıyor, bağlantıya değil",
  /const medyaKartta = Array\.isArray\(job\.medya\) && job\.medya\.length > 0/.test(cekim),
  "medyaVarMi elle yapıştırılan bağlantıyı da sayıyor — burada ayrım şart");
t("bağlantı satırları koşula bağlanmadı",
  /job\.editliDosyaLink && <a href=\{job\.editliDosyaLink\}/.test(cekim),
  "dosyaya Drive'dan ulaşmak isteyen için kalmalı");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
