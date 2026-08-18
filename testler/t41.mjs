/* GÖMÜLÜ OYNATICI ENGELİ TESPİTİ
 *
 * NEDEN BU TEST VAR:
 *   Drive'ın gömülü oynatıcısı Safari'de ÇALIŞAMAZ — Safari, Google'ın çerçeve içindeki
 *   çerezlerini varsayılan olarak kesiyor ve içerik yerine siyah bir kutu çıkıyor. Bunu
 *   düzeltmenin yolu yok (dosyayı herkese açmak dışında, ki o kapatılan gizlilik açığını
 *   geri getirir).
 *
 *   Yapılabilecek tek dürüst şey ne olacağını ÖNCEDEN söylemek. Tespit yanlış çalışırsa
 *   ya Safari kullanıcısı uyarısız ölü bir yola gider, ya Chrome kullanıcısına çalışan bir
 *   özellik için "çalışmaz" denir. İkisi de sessiz hatalar.
 */
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* Tarayıcı kimlikleri gerçek örneklerden alındı — Chrome ve Edge kendilerini "Safari" diye
 * de tanıtır; naif bir kontrol onları da Safari sanar. */
const KIMLIKLER = {
  "Safari (macOS)": ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", true],
  "Safari (iPhone)": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", true],
  "Chrome (macOS)": ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", false],
  /* iOS'ta HER tarayıcı WebKit kullanmak zorunda ve aynı çerez politikasını devralıyor.
   * "Chrome mu" diye bakıp "çalışır" demek, iPhone kullanıcısını siyah kutuya yollardı. */
  "Chrome (iPhone)": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1", true],
  "Firefox (iPhone)": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15", true],
  /* ASIL AYIRT EDİCİ VAKA: iPhone'daki Edge kendini "EdgiOS" diye tanıtıyor ve "Edg"
   * içerdiği için masaüstü kontrolünden KAÇAR. iOS kontrolü olmasa "çalışır" derdik —
   * oysa iOS'ta o da WebKit ve aynı çerez politikasına tabi. Diğer iOS tarayıcıları
   * (CriOS, FxiOS) zaten masaüstü kontrolüne takılıyor; bu vaka olmadan iOS dalının
   * gerçekten bir işe yaradığı sınanmış olmuyor. */
  "Edge (iPhone)": ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/121.0 Mobile/15E148 Safari/604.1", true],
  "Chrome (iPad)": ["Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1", true],
  "Edge": ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0", false],
  "Opera": ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0", false],
  "Firefox": ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0", false],
};

console.log("GÖMÜLÜ OYNATICI ENGELİ\n");
console.log(" Tarayıcı ayrımı");

/* gomuluEngelliMi() modül YÜKLENİRKEN değil ÇAĞRILIRKEN navigator'a bakmalı; yoksa test edilemez
 * ve gerçek hayatta da yükleme sırasına bağımlı olur. */
const kaynak = await import("fs").then((fs) => fs.readFileSync("src/drive.jsx", "utf8"));
const govde = kaynak.slice(kaynak.indexOf("export function gomuluEngelliMi()"));
const kesit = govde.slice(0, govde.indexOf("\n}") + 2);
const gomuluEngelliMi = new Function("navigator", kesit.replace("export function gomuluEngelliMi()", "return (function gomuluEngelliMi()") + ")()");

for (const [ad, [ua, beklenen]] of Object.entries(KIMLIKLER)) {
  const sonuc = gomuluEngelliMi({ userAgent: ua });
  t(`${ad} -> ${beklenen ? "engelli" : "çalışır"}`, sonuc === beklenen, `sonuç: ${sonuc}`);
}

console.log("\n Sunucu ortamı");
t("navigator yokken çökmüyor", (() => {
  const f = new Function(kesit.replace("export function gomuluEngelliMi()", "return (function gomuluEngelliMi()") + ")()");
  try { return f() === false; } catch (e) { return false; }
})(), "sunucuda çalıştırılırsa false dönmeli");

console.log("\n Açıklama metni");
const drive = kaynak;
t("Safari'ye özel çözüm yolu yazıyor", /Siteler aras/i.test(drive) && /Drive'da A/i.test(drive),
  "kullanıcıya ne yapacağı söylenmeli");
t("düğme etiketinde uyarı var", /bu tarayıcıda çalışmaz/i.test(drive));
/* Yorum satırlarında geçmesi SORUN DEĞİL — orada neden kaldırıldığı anlatılıyor. Sorun,
 * kullanıcıya GÖSTERİLEN metinde geçmesi. Bu yüzden yorumlar ayıklanıp bakılıyor;
 * ilk yazdığım hâlde bunu ayırmadığım için test kendi yorumuma takılıyordu. */
const yorumsuz = drive
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
t("gizlilik açığını geri getiren tavsiye ekranda YOK",
  !/bağlantısı olan herkes/i.test(yorumsuz) && !/bağlantıya sahip olan herkes/i.test(yorumsuz),
  "eski yanlış tavsiye geri dönmemeli");
t("ama yorumda neden kaldırıldığı yazıyor", /bağlantısı olan herkes/i.test(drive),
  "sebebi kaybolmasın");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
