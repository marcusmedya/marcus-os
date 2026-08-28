/* PAYLAŞIM İPTALİ — KART KLASÖRÜ GERİ DÖNÜYOR + PLANLANAN İÇERİK GÖRÜNÜYOR
 *
 * 1. DRIVE. Paylaşım iptal edilince kartın dosyaları "2 ONAYLANANLAR"a geri döner.
 *    Bu uç dosyaları TEK TEK taşıyordu ve `kartKlasoru` hiç geçirmiyordu. Sonuç,
 *    Carousel kartında ortaya çıkıyordu: slaytlar "3 PAYLAŞILDI/#9 Karosel" içinden
 *    çıkarılıp doğrudan "2 ONAYLANANLAR"a bırakılıyor, kart klasörü BOŞ olarak
 *    PAYLAŞILDI'da kalıyordu. Kullanıcı ONAYLANANLAR'da klasörü arıyor ve bulamıyordu
 *    — ölçüldü. İleri yön (`api/data.js`) klasör taşımaya geçirilmişti; bu uç geride
 *    kalmıştı.
 *
 * 2. PLANLANAN İÇERİK. Izgara hücresi 32 piksel; kart adı yalnızca fare üstüne
 *    gelince (title) görünüyordu. "Hangi içeriği planlamıştık" sorusu ekranda
 *    cevapsızdı. Izgara olduğu gibi duruyor, altına liste eklendi — bu ekranı gören
 *    herkes (yönetici, personel, çözüm ortağı) aynı listeyi görüyor. Müşteri ve
 *    çözüm ortağı panelinde de içerik adı gönderi önizlemesinde yazıyor.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = privateKey;

const { default: paylasimUcu } = await import("../api/paylasim.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const S1 = "SLAYTBIR00001", S2 = "SLAYTIKI00001";

/* Drive ağacını gerçekten kuran taklit: "klasör mü taşındı, dosya mı" ölçülebilsin. */
function driveTaklidi({ kartKlasorluMu = true } = {}) {
  const klasorler = new Map([
    ["KOKKLASOR001", { ad: "1 SOSYAL MEDYA", ust: "MARKA0000001" }],
    ["AYKLASOR0001", { ad: "08 AĞUSTOS", ust: "KOKKLASOR001" }],
    ["ONAYLANAN001", { ad: "2 ONAYLANANLAR", ust: "AYKLASOR0001" }],
    ["PAYLASILD001", { ad: "3 PAYLAŞILDI", ust: "AYKLASOR0001" }],
  ]);
  if (kartKlasorluMu) klasorler.set("KARTKLASOR1", { ad: "#9 Karosel", ust: "PAYLASILD001" });
  const ebeveyn = kartKlasorluMu
    ? { [S1]: "KARTKLASOR1", [S2]: "KARTKLASOR1" }
    : { [S1]: "PAYLASILD001", [S2]: "PAYLASILD001" };
  const kayit = { patchler: [], klasorler, ebeveyn };

  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes("oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "j" }) };
    const d = s.match(new RegExp(`drive/v3/files/(${S1}|${S2})\\?fields=parents`));
    if (d) return { ok: true, status: 200, json: async () => ({ parents: [ebeveyn[d[1]]], name: d[1] + ".jpg" }) };
    const b = s.match(/drive\/v3\/files\/([A-Za-z0-9_-]+)\?fields=id,name,parents/);
    if (b && klasorler.has(b[1])) {
      const x = klasorler.get(b[1]);
      return { ok: true, status: 200, json: async () => ({ id: b[1], name: x.ad, parents: [x.ust] }) };
    }
    if (s.includes("drive/v3/files?q=")) {
      const q = decodeURIComponent(s.split("files?q=")[1] || "");
      const m = q.match(/'([^']*)'\s+in\s+parents/);
      if (!m) return { ok: true, status: 200, json: async () => ({ files: [] }) };
      /* Klasör listeleme mi dosya listeleme mi — gerçek kodda ayrımı mimeType süzgeci yapıyor. */
      if (q.includes("mimeType=")) {
        const c = [...klasorler.entries()].filter(([, x]) => String(x.ust) === String(m[1]))
          .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-08-01T00:00:00Z" }));
        return { ok: true, status: 200, json: async () => ({ files: c }) };
      }
      const dosyalar = Object.entries(ebeveyn).filter(([, p]) => p === m[1])
        .map(([id]) => ({ id, name: id, mimeType: "image/jpeg" }));
      return { ok: true, status: 200, json: async () => ({ files: dosyalar }) };
    }
    if (o.method === "PATCH" && s.includes("addParents=")) {
      const h = s.match(/addParents=([^&]+)/)[1];
      const f = s.match(/files\/([A-Za-z0-9_-]+)\?/)[1];
      kayit.patchler.push({ tasinan: f, hedefAd: (klasorler.get(h) || {}).ad || h });
      if (klasorler.has(f)) klasorler.set(f, { ...klasorler.get(f), ust: h });
      if (ebeveyn[f] !== undefined) ebeveyn[f] = h;
      return { ok: true, status: 200, json: async () => ({ id: f }) };
    }
    if (s.includes("drive/v3/files") && o.method === "POST") {
      const gv = JSON.parse(o.body || "{}");
      if (gv.mimeType === "application/vnd.google-apps.folder") {
        const id = "YENI" + Math.random().toString(36).slice(2, 9);
        klasorler.set(id, { ad: gv.name, ust: (gv.parents || [])[0] });
        return { ok: true, status: 200, json: async () => ({ id, name: gv.name }) };
      }
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };
  kayit.geriAl = () => { globalThis.fetch = gercek; };
  kayit.klasorAdi = (id) => (klasorler.get(id) || {}).ad || null;
  return kayit;
}

const belge = (kategori) => ({
  clients: [{ id: 1, ad: "Smell", durum: "aktif", driveOnayKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR001" }],
  cekimIsleri: [{
    id: 9, marka: "Smell", kategori, icerikTuru: kategori === "Carousel" ? "Karosel" : "Reels",
    asama: "Teslim Edildi", stokSayildi: false,
    medya: [{ slot: "1", versiyon: 1, dosyaId: S1, url: `https://drive.google.com/file/d/${S1}/view` },
            { slot: "2", versiyon: 1, dosyaId: S2, url: `https://drive.google.com/file/d/${S2}/view` }],
  }],
  haftalikPaylasimlar: [{ id: "p1", clientId: 1, isId: 9, isAdi: kategori === "Carousel" ? "Karosel" : "Reels",
                          gun: "Pzt", haftaKey: "2026-08-17", tur: kategori === "Carousel" ? "Carousel" : "Reels", yapildi: true }],
  subeler: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [],
  musteriIcerikleri: [], musteriHesaplari: [], _alanSurumleri: {},
});
const iptalEt = () => cagir(paylasimUcu, {
  method: "POST", headers: OWNER,
  body: { action: "haftalikToggle", planId: "p1", islemId: `t81_${Math.random().toString(36).slice(2, 12)}` },
});

/* ---------------------------------------------------------------- */
await bolum("1) CAROUSEL İPTALİ — kart KLASÖRÜ geri dönüyor", 5, async () => {
  await kv.set("marcus-os-data", belge("Carousel"));
  const d = driveTaklidi({ kartKlasorluMu: true });
  try {
    const r = await iptalEt();
    t("iptal başarılı", r.kod === 200, JSON.stringify(r.govde && r.govde.error));
    t("kart aşaması geri alındı", (await kv.get("marcus-os-data")).cekimIsleri[0].asama === "Onaylandı");

    t("TAŞINAN ŞEY kart klasörünün KENDİSİ",
      d.patchler.length === 1 && d.patchler[0].tasinan === "KARTKLASOR1",
      JSON.stringify(d.patchler) + " — dosya dosya taşınırsa klasör PAYLAŞILDI'da boş kalır");

    t("klasör 2 ONAYLANANLAR altında",
      d.klasorAdi(d.klasorler.get("KARTKLASOR1").ust) === "2 ONAYLANANLAR",
      "gelen: " + d.klasorAdi(d.klasorler.get("KARTKLASOR1").ust));

    t("slaytlar klasörün İÇİNDE kaldı",
      d.ebeveyn[S1] === "KARTKLASOR1" && d.ebeveyn[S2] === "KARTKLASOR1",
      "klasörden çıkarılırlarsa ONAYLANANLAR'a dağınık düşerler");
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("2) KART KLASÖRÜ OLMAYAN KART — eski yol bozulmadı", 3, async () => {
  await kv.set("marcus-os-data", belge("Video"));
  const d = driveTaklidi({ kartKlasorluMu: false });
  try {
    const r = await iptalEt();
    t("iptal başarılı", r.kod === 200);
    t("dosyalar tek tek taşındı", d.patchler.length === 2, JSON.stringify(d.patchler));
    t("ikisi de 2 ONAYLANANLAR'da",
      d.klasorAdi(d.ebeveyn[S1]) === "2 ONAYLANANLAR" && d.klasorAdi(d.ebeveyn[S2]) === "2 ONAYLANANLAR");
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("2b) KARIŞIK KART — klasör dışında kalmış dosya da klasöre alınıyor", 4, async () => {
  /* Gerçek hayatta oluyor: bir slayt kart klasöründe (normal yükleme), bir başkası
   * klasör dışında (elle yapıştırılmış bağlantı ya da özellik öncesi yükleme).
   * Klasör taşındıktan sonra kalan dosya TEK TEK taşınıyor — ve o yol da kart
   * klasörünü hedeflemeli, yoksa dosya ONAYLANANLAR'a dağınık düşer. */
  await kv.set("marcus-os-data", belge("Carousel"));
  const d = driveTaklidi({ kartKlasorluMu: true });
  d.ebeveyn[S2] = "PAYLASILD001";          // ikinci slayt klasörün DIŞINDA
  try {
    const r = await iptalEt();
    t("iptal başarılı", r.kod === 200);
    t("klasör taşındı", d.patchler.some((x) => x.tasinan === "KARTKLASOR1"));
    t("klasör dışındaki dosya da taşındı", d.patchler.some((x) => x.tasinan === S2),
      JSON.stringify(d.patchler) + " — sessizce atlanmamalı");
    t("o dosya KART KLASÖRÜNE alındı", d.klasorAdi(d.ebeveyn[S2]) === "#9 Karosel",
      "gelen: " + d.klasorAdi(d.ebeveyn[S2]) + " — kart klasörü hedeflenmezse dağınık düşer");
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("3) PLANLANAN İÇERİK ADI — plan kaydında ve müşteri görünümünde", 4, () => {
  const veri = {
    clients: [{ id: 1, ad: "Smell", durum: "aktif" }],
    haftalikPaylasimlar: [{ id: "p1", clientId: 1, isId: 9, isAdi: "Bowl Reels", gun: "Pzt",
                            haftaKey: "2026-08-17", tur: "Reels", yapildi: false }],
    cekimIsleri: [], musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], subeler: [],
  };
  const gorunum = musteriGorunumuUret(veri, veri.clients[0], markaEslestirici);
  const plan = gorunum.paylasimPlani[0];

  t("içerik adı projeksiyonda taşınıyor", plan.isAdi === "Bowl Reels", JSON.stringify(plan.isAdi));
  t("kart kimliği de taşınıyor", plan.isId === 9);
  t("kart bağlı değilse ad null",
    musteriGorunumuUret({ ...veri, haftalikPaylasimlar: [{ id: "p2", clientId: 1, gun: "Sal", haftaKey: "2026-08-17", tur: "Görsel" }] },
      veri.clients[0], markaEslestirici).paylasimPlani[0].isAdi === null,
    "bağsız planda 'kart bağlı değil' gösterilecek");

  const instagram = readFileSync(new URL("../src/instagram.jsx", import.meta.url), "utf8");
  t("gönderi önizlemesi içerik adını çiziyor",
    /\{isAdi && \(/.test(instagram) && /isAdi,/.test(instagram),
    "müşteri ve çözüm ortağı 'bu kare hangi içerik' sorusunu Operasyon'a girmeden cevaplayabilmeli");
});

/* ---------------------------------------------------------------- */
await bolum("4) IZGARA ALTI LİSTE — herkes aynı listeyi görüyor", 4, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  t("liste ızgaranın altına eklendi", /BU HAFTA PLANLANAN İÇERİKLER/.test(app),
    "32 piksellik hücreye kart adı sığmıyor; ad yalnızca title'daydı");
  t("kart adı gösteriliyor", /\{p\.isAdi \|\| "kart bağlı değil"\}/.test(app),
    "bağlı kart yoksa açıkça söylenmeli, boş bırakılmamalı");
  t("gün sırasına göre diziliyor", /GUN_ADLARI\.indexOf\(a\.p\.gun\)/.test(app));
  t("şube adı da yazıyor", /subeAd \? ` · \$\{subeAd\}` : ""/.test(app),
    "çok şubeli markada hangi şubenin planı olduğu belli olmalı");

  /* Liste, ızgarayı çizen bileşenin İÇİNDE — bu bileşeni yönetici, personel ve çözüm
   * ortağı aynı şekilde görüyor, ayrı bir rol koşulu yok. */
  t("role göre gizleyen bir koşul EKLENMEDİ",
    !/rol.*BU HAFTA PLANLANAN|BU HAFTA PLANLANAN[\s\S]{0,200}role ===/.test(app),
    "çözüm ortağı dahil herkes görebilmeli");
});

/* ---------------------------------------------------------------- */
await bolum("5) HÜCRE KUTUSU — kart görünüyor, işaretleme onay istiyor", 9, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  /* ESKİ DAVRANIŞ: tek tık doğrudan toggle'dı ve uçuşta koruması yoktu — çift tık
   * işareti SESSİZCE geri alıyordu (ölçüldü). Kullanıcı işaretledim sanıp paylaşımı
   * atlıyordu. Ayrıca hangi kartın planlandığı yalnızca title'da yazıyordu. */
  t("hücre artık doğrudan toggle ETMİYOR",
    !/onClick=\{\(\) => tikla\(p\)\}/.test(app),
    "tek tıkla işaretleme geri gelmiş");
  t("üstüne gelince kutu açılıyor", /onMouseEnter=\{\(e\) => hucreAc\(p, e\.currentTarget\)\}/.test(app));
  t("dokunmatik için tıklama da açıyor", /acikPlan && acikPlan\.plan\.id === p\.id \? setAcikPlan\(null\)/.test(app),
    "fare üstüne gelme dokunmatik ekranda çalışmıyor");

  t("kutu planlanan KARTI gösteriyor", /\{p\.isAdi \|\| "Kart bağlı değil"\}/.test(app));
  t("paylaş düğmesi kutuda", /paylasimiOnayla\(p\)/.test(app));

  /* SON ONAY: işlemin görünmeyen üç sonucu var — stok, kart aşaması, Drive.
   *
   * KURAL DEĞİŞİKLİĞİ — v162: onay artık düz bir `confirm` kutusu DEĞİL, alt yazı
   * ekranı. Personel içeriği Instagram'a koyarken alt yazıyı elle taşıyor; metin
   * uygulamada duruyordu ama yalnızca müşteri panelinde görünüyordu. Akış tek yerde
   * toplandı: kopyala → yapıştır → işaretle.
   *
   * Kontroller ONAY KUTUSUNUN SÖZÜNÜ değil, NİYETİ sınıyor: sonuçlar gösteriliyor mu,
   * ayrı ve bilinçli bir onay adımı var mı. Eski hâli "Paylaşıldığını onaylıyor musun?"
   * metnini arıyordu — metin değişince kontrol düşüyor ama davranış bozulmuş olmuyordu. */
  t("paylaş, doğrudan işaretlemiyor — önce ekran açılıyor",
    /setPaylasimEkrani\(\{ plan: p, sonuclar: satirlar \}\)/.test(app),
    "tek tıkla işaretleme geri gelmiş");
  t("ayrı ve bilinçli bir onay adımı var", /onClick=\{paylasimiTamamla\}/.test(app));
  t("ekran sonuçları listeliyor", /paylasimEkrani\.sonuclar\.filter/.test(app),
    "kullanıcı neye evet dediğini bilmeli");
  t("sonuç metni Drive taşımasını söylüyor",
    /Drive'da dosya '3 PAYLAŞILDI' klasörüne taşınacak/.test(app));


  /* KUTU EKRANIN DIŞINA TAŞMAMALI — SAHADAN GELEN HATA.
   *
   * Kutu her zaman hücrenin ALTINA açılıyordu ve yüksekliği sınırsızdı. İçine önizleme
   * görseli ve alt yazı eklenince boyu iki katına çıktı; alt satırlardaki bir hücrede
   * işlem düğmeleri EKRANIN ALTINDA kalıyor ve tıklanamıyordu. Kullanıcı "paylaştık ama
   * tıklayınca yeşile dönmedi" diye bildirdi — işlem hiç çalışmamıştı.
   *
   * Üç koruma birden gerekiyor; biri eksik olsa düğme yine kaçabilir. */
  t("altta yer yoksa kutu YUKARI açılıyor",
    /const yukari = altBosluk < 260 && ustBosluk > altBosluk/.test(app),
    "her zaman aşağı açılırsa alt satırlarda düğmeler ekran dışında kalır");
  t("kutunun boyu kalan alana göre sınırlanıyor",
    /maxHeight: acikPlan\.enFazlaYukseklik, overflowY: "auto"/.test(app),
    "sınırsız yükseklikte içerik ekranı taşar ve kaydırılamaz");
  t("işlem düğmeleri kutunun dibine SABİT",
    /position: "sticky", bottom: -12/.test(app),
    "kaydırma alanının dibinde bırakılsalardı kullanıcı onları hiç görmezdi");

  /* ALT YAZI — bu ekranın var oluş sebebi. */
  t("alt yazı kutusu ekranda", /<AltYaziKutusu deger=\{altYaziTaslak\}/.test(app));
  t("alt yazı kopyalanabiliyor", /navigator\.clipboard\.writeText\(metin\)/.test(app));
  /* SIRA: kaydetme sözü ÖNCE, işaretleme onun `.then`inde. "İkisi de kodda geçiyor mu"
   * demek yetmiyor — ölçüldü: işaretlemeyi başa alıp kontrolü geçirmek mümkündü. */
  t("alt yazı işaretlemeden ÖNCE kaydediliyor",
    /const once = \(degisti && typeof onAltMetin === "function"\)/.test(app)
    && /once\s*\n\s*\.then\(\(\) => onToggleYapildi\(p\.id\)\)/.test(app),
    "sonra kaydedilseydi kart ve Drive hareket ettikten sonra metin arkada kalırdı");

  /* UÇUŞTA KORUMASI: çift tık iki ayrı işlem demek, toggle olduğu için ikincisi
   * birincisini geri alır ve sonuç "hiçbir şey olmadı" olur — görünmeyen bir hata. */
  /* KORUMA, PAYLAŞ YOLUNDA olmalı — "metin bir yerde geçiyor mu" demek yetmiyor:
   * geri-alma yolunda da aynı satırlar var ve biri kalkınca kontrol yine geçiyordu
   * (ölçüldü, 0 düştü). Paylaş fonksiyonunun GÖVDESİ ve paylaş DÜĞMESİ ayrı ayrı
   * sınanıyor. */
  const onaylaGovde = (app.match(/const paylasimiOnayla = \(p\) => \{[\s\S]*?\n  \};/) || [""])[0];
  t("paylaş fonksiyonu uçuşta kontrolü yapıyor",
    /if \(gonderiliyor\) return;/.test(onaylaGovde),
    "kilitlenmezse çift tık işareti sessizce geri alır");
  const paylasDugmesi = (app.match(/<button\s+onClick=\{\(\) => paylasimiOnayla\(p\)\}[\s\S]{0,400}?<\/button>/) || [""])[0];
  t("paylaş düğmesi istek uçarken kilitleniyor",
    /disabled=\{gonderiliyor\}/.test(paylasDugmesi),
    "gelen: " + (paylasDugmesi ? "düğme bulundu ama disabled yok" : "düğme bulunamadı"));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
