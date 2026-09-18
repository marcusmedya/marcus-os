/**
 * TARAYICI AÇILIŞ TESTİ — uygulamayı GERÇEKTEN çizer.
 *
 * Neden var: bu projedeki denetimlerin ve sunucu kontrollerinin hiçbiri uygulamayı çizmiyordu.
 * `operasyonOrtakProps` nesnesi JSX'ten bileşen gövdesine taşınınca `data.clients` null
 * üzerinden okundu, React ilk render'da patladı ve uygulama SİYAH EKRANLA açıldı —
 * üretime böyle çıktı. Derleme temizdi, bütün denetimler yeşildi, hiçbiri görmedi:
 * `#root` boş kalıyor, `<body>` zaten koyu (#0C0E13), yani ekran simsiyah.
 *
 * Bu test tam olarak o boşluğu kapatır:
 *   1. Derlenmiş uygulamayı yerel bir sunucudan açar
 *   2. `#root` içine GERÇEKTEN içerik çizildiğini doğrular
 *   3. Açılış sırasındaki yakalanmamış JS hatalarını (`pageerror`) yakalar
 *
 * GÜVENLİK: üretim ortamına ve gerçek veriye HİÇ dokunmaz.
 *   - Sunucu 127.0.0.1'de, rastgele portta; yalnızca `dist/` klasörünü servis eder.
 *   - `/api/*` yanıtları bu dosyadaki UYDURMA verilerden gelir (Redis yok, Drive yok).
 *   - 127.0.0.1 dışına giden HER istek boş yanıtla karşılanır — Google Fonts dahil.
 *     Böylece test ağa bağımlı değil ve dış dünyaya tek bir istek bile gitmez.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(KOK, "dist");

let gecen = 0;
let kalan = 0;
function kontrol(ad, sonucDogruMu, ayrinti = "") {
  if (sonucDogruMu) {
    gecen++;
    console.log(`  ✓ ${ad}`);
  } else {
    kalan++;
    console.log(`  ✗ ${ad}${ayrinti ? " — " + ayrinti : ""}`);
  }
}

/* ── UYDURMA VERİ ────────────────────────────────────────────────────────────────
 * Adlar bilerek gerçek dışı. Buraya asla üretim verisi kopyalanmaz. */
const SAHTE_YANIT = () => ({ role: "owner", data: SAHTE_BELGE });

const SAHTE_BELGE = {
  // Gerçek bir belgenin taşıdığı ÜST DÜZEY ALANLARIN HEPSİ burada. Eksik bırakmak testi
  // değersizleştirirdi: fixture gerçekte hiç oluşmayan bir hâli temsil eder, test de
  // olmayan sorunları kovalar. Diziler boş, iki kayıt uydurma.
  clients: [
    { id: "sahte-marka-1", ad: "Deneme Kafe (TEST)", name: "Deneme Kafe (TEST)",
      aylikUcret: 1000, baslangic: "2026-01-01", durum: "aktif",
      maliyetler: [], odemeKayitlari: [], faturalar: [], ucretGecmisi: [] },
  ],
  cekimIsleri: [
    { id: "sahte-kart-1", no: 1, icerikAdi: "Deneme Reels 1 (TEST)",
      marka: "Deneme Kafe (TEST)", kategori: "Reels", asama: "Çekim Bekliyor",
      medya: [], gecmis: [] },
  ],
  firmaAdi: "Deneme Ajans (TEST)",
  tebligSablonu: "",
  markaKimligiGorseli: "",
  sonYedekTarihi: "",
  // Listeler
  haftalikPaylasimlar: [], hesaplar: [], subeler: [], bekleyenTahsilatlar: [],
  reklamlar: [], musteriIcerikleri: [], avanslar: [], personel: [],
  paylasimGecmisi: [], personelOdemeleri: [], markalasmaSurecleri: [],
  freelancerlar: [], birikimler: [], hesapTransferleri: [], hesapOlcumleri: [],
  hesapDuzeltmeleri: [], giderKalemleri: [], gelirKalemleri: [], vergiTakvimi: [],
  uyelikler: [], teklifSablonlari: [], sozlesmeSablonlari: [], ofisGiderleri: [],
  musteriGirisleri: [], kisiselGorevler: [], monthly: [], silinenler: [],
  islemGecmisi: [], odemeler: [],
  // Haritalar
  stoklar: {}, isUcretleri: {}, isUcretDetaylari: {}, staffPermissions: {},
  cekimSirasi: {}, _alanSurumleri: {},
};

/* ── SUNUCU ──────────────────────────────────────────────────────────────────── */
const TIP = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
};

function sunucuKur(apiYaniti) {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(apiYaniti));
    }
    let p = path.join(DIST, u.pathname === "/" ? "index.html" : u.pathname);
    // Dizin dışına çıkma denemesi: her zaman DIST içinde kal.
    if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      p = path.join(DIST, "index.html");
    }
    res.writeHead(200, { "Content-Type": TIP[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return s;
}

/* ── TEK SENARYO ─────────────────────────────────────────────────────────────── */
async function senaryo(tarayici, ad, apiYaniti, enAzMetin, beklenenMetin) {
  console.log(`\n── ${ad} ──`);

  /* EŞİK POZİTİF OLMAK ZORUNDA — sessizce anlamsızlaşmasın.
   *
   * Aşağıdaki kontrol `(metinUzunlugu || 0) >= enAzMetin` diye ölçüyor. Eşik 0 (ya da eksi)
   * olursa bu ifade HER GİRDİDE doğru olur: ekran bomboşken bile ✓ basar. Yani tek karakterlik
   * bir düzenleme, siyah ekran korumasını kaldırır ve doğrulama zincirinin BEŞ adımı da yeşil
   * kalır — ölçüldü: eşik 50 iken bozuk uygulamada 10 kontrol düşüyor, eşik 0 iken 8.
   * İki kontrol sessizce kayboluyor ve üstelik "okunur içerik var" diye YANLIŞ ✓ yazıyorlar.
   *
   * Bu yüzden eşik burada doğrulanıyor: geçersizse test GÜRÜLTÜLÜ düşer. Korumayı kaldırmak
   * serbest olabilir ama SESSİZCE olmamalı. */
  if (!Number.isFinite(enAzMetin) || enAzMetin < 1) {
    kontrol(`${ad}: metin eşiği geçerli (≥1)`, false,
      `eşik "${enAzMetin}" — 0 ya da eksi eşikte "okunur içerik var" kontrolü ` +
      "her zaman geçer, yani koruma yoktur");
    return;
  }
  const sunucu = sunucuKur(apiYaniti);
  await new Promise((r) => sunucu.listen(0, "127.0.0.1", r));
  const port = sunucu.address().port;

  const baglam = await tarayici.newContext();
  const sayfa = await baglam.newPage();

  const jsHatalari = [];   // yakalanmamış istisnalar — siyah ekranın sebebi
  const konsolHatalari = [];
  const disIstekler = [];

  sayfa.on("pageerror", (e) => jsHatalari.push(e.message));
  sayfa.on("console", (m) => { if (m.type() === "error") konsolHatalari.push(m.text()); });

  // 127.0.0.1 dışına giden her istek BOŞ yanıtla karşılanır: test ağa bağımlı olmasın
  // ve dış dünyaya tek istek bile gitmesin.
  await sayfa.route("**/*", (yol) => {
    const adres = yol.request().url();
    if (adres.startsWith(`http://127.0.0.1:${port}`)) return yol.continue();
    disIstekler.push(adres);
    return yol.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });

  // ZAMAN AŞIMLARI BİLEREK CÖMERT. Bu test doğrulama zincirinin sonunda, bütün kontrollerin
  // ve bir derlemenin hemen ardından çalışıyor; makine yüklüyken dar bir sınır sonucu
  // ÇEVİREBİLİR. Bir kez gözlendi: aynı kod tek başına geçti, zincirin içinde düştü.
  // Sınırlar yalnızca gerçekten bir şey bozulduğunda devreye girer, o yüzden geniş
  // tutmanın maliyeti yok — kararsız bir test ise olmayan testten kötüdür.
  let acilisHatasi = null;
  let zamanAsimi = false;
  try {
    await sayfa.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 60000 });
    // React'in çizmesi ve ilk veri turunun bitmesi için bekle.
    await sayfa.waitForFunction(
      () => { const r = document.getElementById("root"); return r && r.children.length > 0; },
      { timeout: 30000 },
    );
  } catch (e) {
    acilisHatasi = e.message.split("\n")[0];
    zamanAsimi = /Timeout|timeout/.test(acilisHatasi);
  }

  const durum = await sayfa.evaluate(() => {
    const r = document.getElementById("root");
    if (!r) return { kokVar: false };
    const metin = (r.innerText || "").trim();
    return {
      kokVar: true,
      cocukSayisi: r.children.length,
      metinUzunlugu: metin.length,
      ornek: metin.slice(0, 120).replace(/\s+/g, " "),
      ornekTam: metin,
      govdeRengi: getComputedStyle(document.body).backgroundColor,
    };
  });

  kontrol(`${ad}: sayfa açıldı`, acilisHatasi === null, acilisHatasi || "");
  kontrol(`${ad}: #root elemanı var`, durum.kokVar === true);
  kontrol(`${ad}: React arayüzü çizildi (çocuk düğüm)`, (durum.cocukSayisi || 0) > 0,
    `çocuk sayısı: ${durum.cocukSayisi}`);
  kontrol(`${ad}: ekranda okunur içerik var (≥${enAzMetin} karakter)`,
    (durum.metinUzunlugu || 0) >= enAzMetin, `metin uzunluğu: ${durum.metinUzunlugu}`);
  kontrol(`${ad}: açılışta yakalanmamış JS hatası yok`, jsHatalari.length === 0,
    jsHatalari.slice(0, 3).join(" | "));
  kontrol(`${ad}: açılışta konsol hatası yok`, konsolHatalari.length === 0,
    konsolHatalari.slice(0, 3).join(" | "));
  // Yalnızca "bir şey çizildi" demek yetmez: hata ekranı da bir şey çizer. Bu yüzden o
  // senaryoda görünmesi GEREKEN metin aranıyor — böylece doğru dalın çizildiği belli olur.
  const metinVar = beklenenMetin.every((m) => (durum.ornekTam || "").includes(m));
  kontrol(`${ad}: beklenen ekran çizildi (${beklenenMetin.join(", ")})`, metinVar,
    `ekranda: "${durum.ornek}…"`);

  // Bilgi amaçlı: dış adresler taklit edildi, ağa çıkmadı. Uygulama index.html'de
  // Google Fonts'a başvuruyor; bu bir kusur değil, testin ağdan yalıtılmış olması gerek.
  if (disIstekler.length) {
    console.log(`     · ${disIstekler.length} dış istek taklit edildi (ağa çıkmadı)`);
  }

  if (durum.metinUzunlugu > 0) {
    console.log(`     ekrandan: "${durum.ornek}…"`);
  }
  // Zaman aşımı ile GERÇEK çizim hatası aynı ✗ satırlarını üretir. JS hatası hiç
  // yakalanmadıysa ayrım yapılamaz; bunu söylemek, sessizce "uygulama bozuk" demekten
  // dürüsttür — okuyan kişi yanlış yeri kazmasın.
  if (zamanAsimi && jsHatalari.length === 0) {
    console.log("     ! zaman aşımı, JS hatası YAKALANMADI — bu bir çizim hatası olabilir");
    console.log("       ama yüklü makinede yavaşlık da olabilir. Testi tek başına tekrar çalıştır.");
  }

  await baglam.close();
  await new Promise((r) => sunucu.close(r));
}

/* ── TARAYICIYI BUL ──────────────────────────────────────────────────────────── */
/**
 * Chromium'un yeri MAKİNEDEN MAKİNEYE DEĞİŞİR. Yol sabit yazılıydı
 * ("/opt/pw-browsers/chromium") ve o yol yoksa test çöküyordu — yani başka bir
 * geliştirme ortamında ya da CI'da "uygulama bozuk" gibi görünüyordu, oysa yalnızca
 * tarayıcı başka yerdeydi. Sırayla denenir, ilk açılan kullanılır:
 *
 *   1. MARCUS_CHROMIUM       — elle verilen yol (her şeyi ezer)
 *   2. PLAYWRIGHT_BROWSERS_PATH altındaki chromium
 *   3. playwright-core'un KENDİ indirdiği tarayıcı (executablePath verilmez)
 *   4. Sistemde kurulu Chrome/Chromium kanalları
 *
 * Hiçbiri açılmazsa test SESSİZCE GEÇMEZ — ne denendiğini ve ne yapılması gerektiğini
 * yazıp 1 ile çıkar. "Tarayıcı bulunamadı" ile "uygulama açılmıyor" karışmamalı.
 */
async function tarayiciAc() {
  const ARGS = ["--no-sandbox", "--disable-dev-shm-usage"];
  const adaylar = [];

  if (process.env.MARCUS_CHROMIUM) {
    adaylar.push({ ad: `MARCUS_CHROMIUM=${process.env.MARCUS_CHROMIUM}`,
                   ayar: { executablePath: process.env.MARCUS_CHROMIUM, args: ARGS } });
  }
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const yol = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium");
    if (fs.existsSync(yol)) {
      adaylar.push({ ad: `PLAYWRIGHT_BROWSERS_PATH → ${yol}`,
                     ayar: { executablePath: yol, args: ARGS } });
    }
  }
  adaylar.push({ ad: "playwright-core'un kendi tarayıcısı", ayar: { args: ARGS } });
  for (const kanal of ["chromium", "chrome"]) {
    adaylar.push({ ad: `sistem kanalı: ${kanal}`, ayar: { channel: kanal, args: ARGS } });
  }

  const denenenler = [];
  for (const aday of adaylar) {
    try {
      const t = await chromium.launch(aday.ayar);
      if (denenenler.length) console.log(`  · tarayıcı: ${aday.ad}`);
      return t;
    } catch (e) {
      denenenler.push(`${aday.ad} → ${e.message.split("\n")[0]}`);
    }
  }

  console.log("  ✗ TARAYICI BULUNAMADI — bu bir uygulama hatası DEĞİL, ortam eksikliği.");
  denenenler.forEach((d) => console.log(`      denendi: ${d}`));
  console.log("    Çözüm: MARCUS_CHROMIUM=<chrome yolu> ile çalıştır,");
  console.log("    ya da `npx playwright install chromium` ile tarayıcıyı kur.");
  process.exit(1);
}

/* ── ÇALIŞTIR ────────────────────────────────────────────────────────────────── */
async function calistir() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.log("  · dist/ yok, derleniyor…");
    execSync("npm run build", { cwd: KOK, stdio: "ignore" });
  }

  const tarayici = await tarayiciAc();
  try {
    // 1) Belge BOŞ: uygulamanın ilk kurulum ekranı. `data` bir süre null kalır —
    //    siyah ekran hatası tam olarak bu anda ortaya çıkmıştı.
    await senaryo(tarayici, "boş veritabanı", { role: "owner" }, 50,
      ["Veritabanında hiçbir kayıt bulunamadı"]);
    // 2) Belge DOLU: marka ve kart olduğunda çizilen asıl arayüz.
    // "Dashboard" + "ÜRETİM" yalnızca belge YÜKLENDİĞİNDE çizilen ana kabukta var;
    // ilk kurulum ve hata ekranlarında yoktur. Yani bu iki kelime, asıl arayüzün
    // gerçekten çizildiğinin kanıtı.
    await senaryo(tarayici, "sahte veriyle", SAHTE_YANIT(), 50,
      ["Dashboard", "ÜRETİM"]);
  } finally {
    await tarayici.close();
  }

  console.log("");
  if (kalan > 0) {
    console.log(`SONUÇ: ✓${gecen}  ✗${kalan} — AÇILIŞ BOZUK`);
    process.exit(1);
  }
  console.log(`SONUÇ: ${gecen} kontrol geçti, uygulama açılıyor.`);
}

calistir().catch((e) => {
  console.log(`  ✗ test çöktü: ${e.message}`);
  process.exit(1);
});
