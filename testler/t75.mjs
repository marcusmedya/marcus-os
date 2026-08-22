/* CAROUSEL SLAYTLARI KENDİ KLASÖRÜNE YÜKLENİYOR
 *
 * Kart klasörü önce yalnızca TAŞIMA yoluna bağlanmıştı. Yükleme ise ayrı bir yol:
 * dosya doğrudan hedefe yükleniyor, sonradan taşınmıyor — servis hesabı yükleme
 * yapamadığı için "önce yükle sonra taşı" mümkün değil. Sonuç: karosel slaytları
 * aşama değişene kadar ONAY BEKLEYENLER'de tek tek duruyordu. Kullanıcı ekranda gördü.
 *
 * BU TEST KAYNAK METNİNE BAKMIYOR. Google'a giden istekler yakalanıp dosyanın hangi
 * klasöre yazıldığı ÖLÇÜLÜYOR — "klasör açıldı" demek yetmez, dosyanın ebeveyni o
 * klasör olmalı.
 */
import crypto from "node:crypto";

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.GOOGLE_OAUTH_CLIENT_ID = "x";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "y";
process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "z";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = privateKey;

const { yuklemeOturumuAc } = await import("../lib/drive-yukleme.js");
const { kartKlasorAdi } = await import("../lib/asamalar.js");
const { onaylananiTasi, kartKlasorunuTasi, bosaldiysaKartKlasorunuCopeAt } = await import("../lib/drive-tasima.js");

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

/* Taklit Drive: klasör ağacını gerçekten kuruyor ki "hangi klasörün altında" sorusu
 * ölçülebilsin. Var olmayan klasör aranınca boş dönüyor, oluşturulunca ağaca giriyor. */
function taklitDrive() {
  const klasorler = new Map();          // id -> { ad, ust }
  let sayac = 0;
  const kayit = { yuklenenEbeveyn: null, yuklenenAd: null, acilanKlasorler: [] };

  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);

    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }

    /* Dosya yükleme oturumu — ASIL ÖLÇÜM BURADA. */
    if (u.includes("/upload/drive/")) {
      const govde = JSON.parse(opt.body || "{}");
      kayit.yuklenenEbeveyn = (govde.parents || [])[0] || null;
      kayit.yuklenenAd = govde.name || null;
      return { ok: true, status: 200, headers: new Map([["location", "https://ornek/yukle"]]), json: async () => ({}) };
    }

    /* KLASÖR LİSTELEME — gerçek sorgu ADA GÖRE ARAMIYOR.
     *
     * `altKlasorler` üst klasörün altındaki TÜM klasörleri listeliyor ve ad
     * karşılaştırmasını kod tarafında yapıyor (Drive'ın ada göre sorgusu Türkçe
     * büyük/küçük harfte güvenilmez). Taklit bunu birebir yansıtmalı: ada göre
     * eşleştiren bir taklit, "aynı klasör ikinci kez açılıyor mu" sorusunu
     * hiç sınamamış olurdu. */
    if (u.includes("drive/v3/files?q=")) {
      const sorgu = decodeURIComponent(u.split("files?q=")[1] || "");
      const ustEsl = sorgu.match(/'([^']*)'\s+in\s+parents/);
      if (!ustEsl) return { ok: true, status: 200, json: async () => ({ files: [] }) };
      const cocuklar = [...klasorler.entries()]
        .filter(([, x]) => String(x.ust) === String(ustEsl[1]))
        .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-08-22T00:00:00Z" }));
      return { ok: true, status: 200, json: async () => ({ files: cocuklar }) };
    }

    /* Klasör oluşturma. */
    if (u.includes("drive/v3/files") && opt.method === "POST") {
      const govde = JSON.parse(opt.body || "{}");
      if (govde.mimeType === "application/vnd.google-apps.folder") {
        const id = `kls${++sayac}`;
        klasorler.set(id, { ad: govde.name, ust: (govde.parents || [])[0] });
        kayit.acilanKlasorler.push({ id, ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, status: 200, json: async () => ({ id, name: govde.name }) };
      }
    }

    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };

  kayit.klasorler = klasorler;
  kayit.geriAl = () => { globalThis.fetch = gercek; };
  kayit.klasorAdi = (id) => (klasorler.get(id) || {}).ad || null;
  kayit.ustAdi = (id) => {
    const x = klasorler.get(id);
    return x ? kayit.klasorAdi(x.ust) : null;
  };
  return kayit;
}

const MARKA_KLASORU = "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs";
const yukle = (kartKlasoru, slot) => yuklemeOturumuAc({
  markaKlasoru: MARKA_KLASORU, markaAdi: "Smell Coffee", icerikAdi: "karosel",
  versiyon: 1, orijinalAd: "a.jpg", mimeTur: "image/jpeg", boyut: 10,
  origin: "https://marcus-os-iota.vercel.app", slot, kartKlasoru,
});

/* ---------------------------------------------------------------- */
await bolum("1) CAROUSEL — dosya kart klasörünün İÇİNE yükleniyor", 5, async () => {
  const d = taklitDrive();
  try {
    const sonuc = await yukle("#124 karosel", "1");
    t("oturum açıldı", sonuc.ok === true, sonuc.sebep || "");

    t("dosyanın ebeveyni KART klasörü", d.klasorAdi(d.yuklenenEbeveyn) === "#124 karosel",
      "gelen: " + d.klasorAdi(d.yuklenenEbeveyn) + " (asıl hata buydu: dosya doğrudan durum klasörüne iniyordu)");

    t("kart klasörü ONAY BEKLEYENLER'in ALTINDA",
      d.ustAdi(d.yuklenenEbeveyn) === "1 ONAY BEKLEYENLER",
      "gelen üst: " + d.ustAdi(d.yuklenenEbeveyn));

    t("dönen yol kart klasörünü içeriyor", /#124 karosel$/.test(sonuc.klasorYolu || ""),
      "gelen: " + sonuc.klasorYolu);

    /* İkinci slayt AYNI klasöre gitmeli — her slayt için yeni klasör açılmamalı. */
    const oncekiSayi = d.acilanKlasorler.length;
    const ikinci = await yukle("#124 karosel", "2");
    t("ikinci slayt AYNI klasöre, yeni klasör açılmıyor",
      d.klasorAdi(d.yuklenenEbeveyn) === "#124 karosel"
      && d.acilanKlasorler.length === oncekiSayi && ikinci.ok,
      `açılan klasör: ${d.acilanKlasorler.length - oncekiSayi}`);
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("2) DİĞER KATEGORİLER — davranış değişmedi", 3, async () => {
  const d = taklitDrive();
  try {
    const sonuc = await yukle(null, "1");
    t("oturum açıldı", sonuc.ok === true, sonuc.sebep || "");
    t("dosya DOĞRUDAN durum klasörüne iniyor",
      d.klasorAdi(d.yuklenenEbeveyn) === "1 ONAY BEKLEYENLER",
      "gelen: " + d.klasorAdi(d.yuklenenEbeveyn));
    t("yolda fazladan basamak yok", /1 ONAY BEKLEYENLER$/.test(sonuc.klasorYolu || ""),
      "gelen: " + sonuc.klasorYolu);
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("3) KLASÖR ADI KARTTAN GELİYOR", 3, () => {
  t("Carousel kartı ad üretiyor",
    kartKlasorAdi({ id: 124, kategori: "Carousel", icerikTuru: "karosel" }) === "#124 karosel");
  t("Fotoğraf kartı üretmiyor",
    kartKlasorAdi({ id: 124, kategori: "Fotoğraf", icerikTuru: "Ürün" }) === null);
  t("Video kartı üretmiyor",
    kartKlasorAdi({ id: 124, kategori: "Video", icerikTuru: "Reels" }) === null);
});

/* ---------------------------------------------------------------- */
await bolum("4) TAŞIMA — kart klasöründeki dosya AYINI kaybetmiyor", 4, async () => {
  /* Dosya artık bir basamak daha derinde: <AY>/<DURUM>/<KART>/dosya. Ay araması sabit
   * iki basamak yürüyordu; üçüncü basamak görülmeyince "ay yok" sanılıp İÇİNDE
   * BULUNULAN ay hazırlanıyordu. Temmuzda çekilmiş bir karosel onaylanınca ağustosa
   * sıçrardı — hata vermeden. */
  /* Kimlikler gerçekçi uzunlukta: `driveKlasorIdCikar` 10 karakterden kısa kimliği
   * bağlantı saymıyor, kısa kimlikli bir taklit hiçbir şeyi sınamadan düşer. */
  const KOK = "KOKKLASOR0001";
  const klasorler = new Map([
    [KOK, { ad: "SOSYAL MEDYA", ust: "MARKAKLASOR01" }],
    ["TEMMUZKLASOR", { ad: "07 TEMMUZ", ust: KOK }],
    ["BEKLEYENKLS1", { ad: "1 ONAY BEKLEYENLER", ust: "TEMMUZKLASOR" }],
    ["KARTKLASOR01", { ad: "#124 karosel", ust: "BEKLEYENKLS1" }],
  ]);
  let sayac = 0;
  let tasimaHedefi = null;
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    /* Taşınacak dosyanın bilgisi — ebeveyni KART klasörü. */
    if (u.includes("drive/v3/files/DOSYAKIMLIGI01?")) {
      return { ok: true, status: 200, json: async () => ({ parents: ["KARTKLASOR01"], name: "slayt.jpg" }) };
    }
    /* Klasör bilgisi. */
    const bilgi = u.match(/drive\/v3\/files\/([A-Za-z0-9_-]+)\?fields=id,name,parents/);
    if (bilgi && klasorler.has(bilgi[1])) {
      const x = klasorler.get(bilgi[1]);
      return { ok: true, status: 200, json: async () => ({ id: bilgi[1], name: x.ad, parents: [x.ust] }) };
    }
    if (u.includes("drive/v3/files?q=")) {
      const ustEsl = decodeURIComponent(u.split("files?q=")[1] || "").match(/'([^']*)'\s+in\s+parents/);
      const cocuklar = ustEsl ? [...klasorler.entries()]
        .filter(([, x]) => String(x.ust) === String(ustEsl[1]))
        .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-07-01T00:00:00Z" })) : [];
      return { ok: true, status: 200, json: async () => ({ files: cocuklar }) };
    }
    if (u.includes("drive/v3/files") && opt.method === "POST") {
      const govde = JSON.parse(opt.body || "{}");
      if (govde.mimeType === "application/vnd.google-apps.folder") {
        const id = `yeni${++sayac}`;
        klasorler.set(id, { ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, status: 200, json: async () => ({ id, name: govde.name }) };
      }
    }
    if (opt.method === "PATCH" && u.includes("addParents=")) {
      tasimaHedefi = u.match(/addParents=([^&]+)/)[1];
      return { ok: true, status: 200, json: async () => ({ id: "DOSYAKIMLIGI01", parents: [tasimaHedefi] }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };

  try {
    const sonuc = await onaylananiTasi({
      dosyaLinki: "https://drive.google.com/file/d/DOSYAKIMLIGI01/view",
      markaAdi: "Smell Coffee",
      markaKlasoru: `https://drive.google.com/drive/folders/${KOK}`,
      hedefAd: "2 ONAYLANANLAR",
      kartKlasoru: "#124 karosel",
    });

    t("taşıma başarılı", sonuc.tasindi === true, sonuc.sebep || "");
    t("dosya TEMMUZ'da kalıyor", /07 TEMMUZ/.test(sonuc.klasor || ""),
      "gelen: " + sonuc.klasor + " (ay bulunamazsa içinde bulunulan aya sıçrar)");
    t("yeni durum klasörüne geçti", /2 ONAYLANANLAR/.test(sonuc.klasor || ""));
    t("kart klasörü korunuyor", /#124 karosel$/.test(sonuc.klasor || ""),
      "gelen: " + sonuc.klasor);
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("5) KLASÖRÜN KENDİSİ TAŞINIYOR — dosyalar tek tek değil", 6, async () => {
  /* Dosyaları tek tek taşımak on tur çağrı, hedefte YENİ klasör ve kaynakta BOŞ klasör
   * demekti. Klasörü taşımak tek çağrı; klasörün kimliği de korunuyor. */
  const KOK = "KOKKLASOR0001";
  const klasorler = new Map([
    [KOK, { ad: "SOSYAL MEDYA", ust: "MARKAKLASOR01" }],
    ["TEMMUZKLASOR", { ad: "07 TEMMUZ", ust: KOK }],
    ["BEKLEYENKLS1", { ad: "1 ONAY BEKLEYENLER", ust: "TEMMUZKLASOR" }],
    ["KARTKLASOR01", { ad: "#124 karosel", ust: "BEKLEYENKLS1" }],
  ]);
  const KLASOR_ICERIGI = [
    { id: "SLAYT0000001", name: "s1.jpg", mimeType: "image/jpeg" },
    { id: "SLAYT0000002", name: "s2.jpg", mimeType: "image/jpeg" },
  ];
  let sayac = 0;
  const patchler = [];
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    if (u.includes("drive/v3/files/SLAYT0000001?fields=parents")) {
      return { ok: true, status: 200, json: async () => ({ parents: ["KARTKLASOR01"] }) };
    }
    const bilgi = u.match(/drive\/v3\/files\/([A-Za-z0-9_-]+)\?fields=id,name,parents/);
    if (bilgi && klasorler.has(bilgi[1])) {
      const x = klasorler.get(bilgi[1]);
      return { ok: true, status: 200, json: async () => ({ id: bilgi[1], name: x.ad, parents: [x.ust] }) };
    }
    if (u.includes("drive/v3/files?q=")) {
      const sorgu = decodeURIComponent(u.split("files?q=")[1] || "");
      const ustEsl = sorgu.match(/'([^']*)'\s+in\s+parents/);
      if (!ustEsl) return { ok: true, status: 200, json: async () => ({ files: [] }) };
      /* Klasör listeleme mi, dosya listeleme mi — sorgu mimeType süzüyorsa klasör. */
      if (sorgu.includes("mimeType=")) {
        const cocuklar = [...klasorler.entries()]
          .filter(([, x]) => String(x.ust) === String(ustEsl[1]))
          .map(([id, x]) => ({ id, name: x.ad, createdTime: "2026-07-01T00:00:00Z" }));
        return { ok: true, status: 200, json: async () => ({ files: cocuklar }) };
      }
      return { ok: true, status: 200,
        json: async () => ({ files: ustEsl[1] === "KARTKLASOR01" ? KLASOR_ICERIGI : [] }) };
    }
    if (u.includes("drive/v3/files") && opt.method === "POST") {
      const govde = JSON.parse(opt.body || "{}");
      if (govde.mimeType === "application/vnd.google-apps.folder") {
        const id = `YENIKLASOR${++sayac}`;
        klasorler.set(id, { ad: govde.name, ust: (govde.parents || [])[0] });
        return { ok: true, status: 200, json: async () => ({ id, name: govde.name }) };
      }
    }
    if (opt.method === "PATCH" && u.includes("addParents=")) {
      const id = u.match(/files\/([A-Za-z0-9_-]+)\?/)[1];
      patchler.push({ id, hedef: u.match(/addParents=([^&]+)/)[1] });
      return { ok: true, status: 200, json: async () => ({ id }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };

  try {
    const sonuc = await kartKlasorunuTasi({
      kartKlasoru: "#124 karosel", markaAdi: "Smell Coffee",
      markaKlasoru: `https://drive.google.com/drive/folders/${KOK}`,
      hedefAd: "2 ONAYLANANLAR",
      ipucuDosyaLinki: "https://drive.google.com/file/d/SLAYT0000001/view",
    });

    t("klasör taşındı", sonuc.tasindi === true, sonuc.sebep || "");
    t("TAŞINAN ŞEY klasörün kendisi, dosya değil",
      patchler.length === 1 && patchler[0].id === "KARTKLASOR01",
      "gelen: " + JSON.stringify(patchler));
    t("iki slayt için İKİ ayrı taşıma yapılmadı", patchler.length === 1,
      "on slaytlık kartta on tur çağrı demekti");
    t("klasörün KİMLİĞİ korunuyor", sonuc.klasorId === "KARTKLASOR01",
      "yeni klasör açılsaydı verilen bağlantılar kırılırdı");
    t("ay korunuyor", /07 TEMMUZ/.test(sonuc.klasor || ""), "gelen: " + sonuc.klasor);
    t("içindeki dosyalar bildiriliyor",
      (sonuc.icerdekiDosyalar || []).join(",") === "SLAYT0000001,SLAYT0000002",
      "çağıran bunları tekrar taşımaya kalkmasın");
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
await bolum("6) ESKİ KARTLAR — klasörü yoksa dosya-dosya yola düşülüyor", 2, async () => {
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    /* Dosyanın ebeveyni doğrudan DURUM klasörü — kart klasörü yok (eski yükleme). */
    if (u.includes("?fields=parents")) {
      return { ok: true, status: 200, json: async () => ({ parents: ["BEKLEYENKLS1"] }) };
    }
    if (u.includes("?fields=id,name,parents")) {
      return { ok: true, status: 200, json: async () => ({ id: "BEKLEYENKLS1", name: "1 ONAY BEKLEYENLER", parents: ["TEMMUZKLASOR"] }) };
    }
    return { ok: true, status: 200, json: async () => ({ files: [], id: "x" }) };
  };
  try {
    const sonuc = await kartKlasorunuTasi({
      kartKlasoru: "#124 karosel", markaAdi: "Smell Coffee",
      markaKlasoru: "https://drive.google.com/drive/folders/KOKKLASOR0001",
      hedefAd: "2 ONAYLANANLAR",
      ipucuDosyaLinki: "https://drive.google.com/file/d/SLAYT0000001/view",
    });
    t("klasör taşıma başarısız bildiriliyor", sonuc.tasindi === false);
    t("sebep 'klasör yok' olarak işaretleniyor", sonuc.klasorYok === true,
      "çağıran bunu görüp dosya-dosya yola düşüyor");
  } finally { globalThis.fetch = gercek; }
});

/* ---------------------------------------------------------------- */
/* Klasör temizliği için ortak taklit: klasörün içinde kaç öğe kaldığı ve listelemenin
 * başarılı olup olmadığı dışarıdan verilebiliyor. */
function temizlikTaklidi({ kalanOge = 0, listelemeCalisiyor = true, klasorAdi = "#124 karosel" } = {}) {
  const kayit = { patchler: [], silmeIstekleri: [] };
  const gercek = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "jeton" }) };
    }
    if (opt.method === "DELETE") { kayit.silmeIstekleri.push(u); return { ok: true, status: 204, json: async () => ({}) }; }
    if (u.includes("?fields=parents")) {
      return { ok: true, status: 200, json: async () => ({ parents: ["KARTKLASOR01"] }) };
    }
    if (u.includes("?fields=id,name,parents")) {
      return { ok: true, status: 200, json: async () => ({ id: "KARTKLASOR01", name: klasorAdi, parents: ["BEKLEYENKLS1"] }) };
    }
    if (u.includes("drive/v3/files?q=")) {
      if (!listelemeCalisiyor) return { ok: false, status: 500, json: async () => ({ error: { message: "Drive erişilemedi" } }) };
      const files = Array.from({ length: kalanOge }, (_, i) => ({ id: `KALAN${i}` }));
      return { ok: true, status: 200, json: async () => ({ files }) };
    }
    if (opt.method === "PATCH") {
      kayit.patchler.push({ url: u, govde: JSON.parse(opt.body || "{}") });
      return { ok: true, status: 200, json: async () => ({ id: "KARTKLASOR01", trashed: true }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };
  kayit.geriAl = () => { globalThis.fetch = gercek; };
  return kayit;
}

const temizle = () => bosaldiysaKartKlasorunuCopeAt({
  kartKlasoru: "#124 karosel", ipucuDosyaId: "SILINENDOSYA1",
});

await bolum("7) BOŞALAN KART KLASÖRÜ ÇÖPE ATILIYOR", 4, async () => {
  const d = temizlikTaklidi({ kalanOge: 0 });
  try {
    const sonuc = await temizle();
    t("klasör çöpe atıldı", sonuc.silindi === true, sonuc.sebep || "");
    t("hangi klasör olduğu bildiriliyor", sonuc.klasorAdi === "#124 karosel");
    t("işlem ÇÖPE ATMA — trashed işaretleniyor",
      d.patchler.length === 1 && d.patchler[0].govde.trashed === true,
      JSON.stringify(d.patchler));
    t("KALICI SİLME yapılmıyor", d.silmeIstekleri.length === 0,
      "çöp kutusunda 30 gün durmalı, geri alınabilmeli");
  } finally { d.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("8) DOLU KLASÖRE DOKUNULMUYOR", 5, async () => {
  const d = temizlikTaklidi({ kalanOge: 1 });
  try {
    const sonuc = await temizle();
    t("tek dosya kalmışsa silinmiyor", sonuc.silindi === false);
    t("sebep bildiriliyor", sonuc.doluKaldi === true && sonuc.kalanSayisi === 1);
    t("hiçbir yazma yapılmadı", d.patchler.length === 0 && d.silmeIstekleri.length === 0,
      "boş sanıp doluyu atmak bu temizliğin yapabileceği en kötü şey");
  } finally { d.geriAl(); }

  /* Listeleme başarısız olursa "boş" sayılmamalı. */
  const h = temizlikTaklidi({ kalanOge: 0, listelemeCalisiyor: false });
  try {
    const sonuc = await temizle();
    t("listeleme HATA verirse klasör silinmiyor", sonuc.silindi === false,
      "hata anında boş sayılsaydı dolu klasör çöpe giderdi");
    t("hata anında da yazma yok", h.patchler.length === 0);
  } finally { h.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("9) BAŞKA KLASÖRE DOKUNULMUYOR", 2, async () => {
  /* Dosyanın ebeveyni kart klasörü DEĞİL (eski yükleme) — durum klasörü asla silinmemeli. */
  const d = temizlikTaklidi({ kalanOge: 0, klasorAdi: "1 ONAY BEKLEYENLER" });
  try {
    const sonuc = await temizle();
    t("adı tutmayan klasör silinmiyor", sonuc.silindi === false && sonuc.klasorYok === true,
      "durum klasörünün çöpe gitmesi bütün markayı bozardı");
    t("hiçbir yazma yapılmadı", d.patchler.length === 0 && d.silmeIstekleri.length === 0);
  } finally { d.geriAl(); }
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
