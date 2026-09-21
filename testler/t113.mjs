/* BİRLEŞİK FİNANS HAREKETLERİ + MUTABAKAT
 * `lib/finans-hareketleri.js` · `lib/finans-mutabakat.js`
 *
 * BU TESTİN ASIL İŞİ — üç şey:
 *
 *  1. AYNI PARA İKİ KEZ SAYILMASIN. Yeni katman on beş ayrı listeyi tek biçime çeviriyor;
 *     bu tam olarak "aynı dönemi iki ekran farklı topluyor" hatasının doğduğu yer
 *     (para.md). Tahsilat/gelir/fatura, gider/ödeme, hak ediş/ödeme ayrımlarının her biri
 *     ayrı ayrı sınanıyor; transfer hiçbir toplama girmiyor, avans ikinci kez gider olmuyor.
 *
 *  2. EKSİK VERİ GİZLENMESİN. Tarihi olmayan ya da çözülemeyen kayıt listeden DÜŞMÜYOR;
 *     `donem: null` + `tarihsiz` sayacı + `uyarilar`. KDV ve stopaj uydurulmuyor.
 *     "Eksik dökümü tam gibi göstermek hiç göstermemekten kötüdür."
 *
 *  3. KİMLİK KARARLI OLSUN. Aynı belge iki kez verilince AYNI kimlikler çıkıyor —
 *     gerçek migrasyonun kopya kayıt üretmemesinin tek temeli bu.
 *
 * ESKİ MOTOR GERÇEKTEN ÇAĞRILIYOR. Mutabakatın "eski" tarafı `computeLive`
 * (`src/tema.jsx`) ve `hesapBakiyesi` (`src/finans.jsx`) — ikisi de `.jsx` ve Node'dan
 * import edilemiyor. t107'nin yöntemi kullanılıyor: dosyalar PROJENİN ZATEN KULLANDIĞI
 * esbuild ile çevrilip geçici `.mjs` olarak `testler/` altına yazılıyor. Yeni bağımlılık
 * YOK; geçici dosyalar `process.on("exit")` ile her hâlükârda siliniyor.
 *
 * DAVRANIŞ sınanıyor, kaynak metni değil: hiçbir kontrol dosyanın içine `grep` atmıyor.
 */
import { build, transform } from "esbuild";
import { readFileSync, writeFileSync, rmSync } from "fs";
import path from "node:path";
import { finansHareketleri, eksikBilgiOzeti, KAYNAKLAR } from "../lib/finans-hareketleri.js";
import { finansMutabakati } from "../lib/finans-mutabakat.js";

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

/* ── ESKİ MOTORU TESTE AÇ ──────────────────────────────────────────────────── */
const kok = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const temaYolu = path.join(kok, "testler", ".gecici-t113-tema.mjs");
const finansYolu = path.join(kok, "testler", ".gecici-t113-finans.mjs");
const temizle = () => {
  for (const y of [temaYolu, finansYolu]) { try { rmSync(y, { force: true }); } catch { /* yoksa sorun değil */ } }
};
process.on("exit", temizle);
process.on("SIGINT", () => { temizle(); process.exit(130); });

const { code } = await transform(readFileSync(path.join(kok, "src/tema.jsx"), "utf8"),
  { loader: "jsx", format: "esm", target: "node18" });
writeFileSync(temaYolu, code);
const { computeLive } = await import(temaYolu);

/* `src/finans.jsx` React ve kardeş modüllerini import ettiği için tek başına çevrilemez;
 * paketlenerek (bundle) alınıyor. Ölçülen şey yine GERÇEK `hesapBakiyesi` kodu. */
const paket = await build({
  entryPoints: [path.join(kok, "src/finans.jsx")],
  bundle: true, write: false, format: "esm", platform: "node", target: "node18",
  logLevel: "silent",
});
writeFileSync(finansYolu, paket.outputFiles[0].text);
const { hesapBakiyesi } = await import(finansYolu);

/* ── FIXTURE ───────────────────────────────────────────────────────────────── */
/* GERÇEK BELGENİN BÜTÜN ÜST DÜZEY ALANLARINI TAŞIR (`src/data.js` + `api/data.js`
 * DEFAULT_FIELD_VALUES). Eksik fixture hiç oluşmayan bir hâli temsil eder ve test
 * olmayan sorunları kovalar — bu projede yaşandı.
 *
 * DEĞERLER AYIRT EDİCİ: hiçbir iki tutar eşit değil. İki tutar eşit olsaydı bir kaynağın
 * yanlış toplandığı, öbürünün rakamıyla örtüşüp gizlenebilirdi. */
const buAy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const bugun = `${buAy}-12`;

const belge = () => ({
  _v: 7,
  firmaAdi: "Marcus Medya",
  tebligSablonu: null,
  markaKimligiGorseli: null,
  teklifler: [], teklifSablonlari: [], sozlesmeSablonlari: [],
  reklamlar: [], stoklar: {}, paylasimGecmisi: [],
  gunlukKontrol: null, haftalikPaylasimlar: [], subeler: [],
  musteriGirisleri: {}, markalasmaSurecleri: [], musteriIcerikleri: [],
  ownerKisiselSifreler: [], kisiselGorevler: [], hesapOlcumleri: [],
  silinenler: [], freelancerlar: [], islemGecmisi: [], birikimler: [], cekimSirasi: [],
  staffPermissions: { dashboard: false, musteriler: false, finans: false },

  /* `monthly` — "Ayı kapat" fotoğrafı. HAREKET DEĞİL, hiç dönüştürülmemeli. */
  monthly: [{ id: 1, ay: "Tem", yil: 2026, ciro: 111111, gider: 22222, net: 88889 }],

  clients: [
    {
      id: 1, ad: "Animed", durum: "aktif", aylikUcret: 30000, baslangic: "2026-01",
      odemeGunu: null, odemeler: [], faturaliTutar: 30000,
      /* İkinci tahsilatın NE tarihi NE ayı var — kaybolmamalı. */
      odemeKayitlari: [
        { id: 1, ay: "2026-07", tarih: "2026-07-05", tutar: 12000, hesapId: "ana", not: "Temmuz" },
        { id: 2, tutar: 7100, hesapId: "ana", not: "ay girilmemiş" },
        /* ESKİ KAYIT: `tarih` alanı eklenmeden önce yazılmış, yalnızca `ay` taşıyor.
         * `kaydinAyi` bu ikinci alana bakmasaydı kayıt döneme hiç düşmezdi. */
        { id: 3, ay: "2026-05", tutar: 6300, hesapId: "ana", not: "eski kayıt" },
      ],
      faturalar: [{ id: 1, ay: "2026-07", tarih: "2026-07-06", no: "A-1", tutar: 9400 }],
      /* Maliyet kaydının tarihi YOK — `COST_FIELDS` yalnızca kalem + tutar. */
      maliyetler: [{ id: 1, kalem: "Videographer Payı", tutar: 3300 }],
    },
    {
      /* DONDURULMUŞ MARKA: geçmiş tahsilatı KORUNUR (para.md), maliyeti ise
       * `computeLive`'da aktif küme dışında kaldığı için gider toplamına girmez. */
      id: 2, ad: "Bomonti", durum: "donduruldu", aylikUcret: 18000,
      odemeGunu: null, odemeler: [], faturaliTutar: 0,
      odemeKayitlari: [{ id: 1, ay: "2026-03", tarih: "2026-03-11", tutar: 5600, hesapId: "kasa" }],
      faturalar: [],
      maliyetler: [{ id: 1, kalem: "Drone Kiralama", tutar: 2100 }],
    },
  ],

  gelirKalemleri: [{ id: 1, kalem: "Proje Bazlı Çekim", tutar: 4500, tekrar: "tek seferlik", faturali: "evet" }],
  giderKalemleri: [{ id: 1, kalem: "Ekipman", tutar: 1700, tekrar: "tek seferlik" }],
  ofisGiderleri: [{ id: 1, kalem: "Kira", tutar: 8900, tekrar: "sabit" }],
  bekleyenTahsilatlar: [{ id: 1, musteri: "Bomonti", tutar: 2600, vade: "3 gün gecikti" }],

  personelOdemeleri: [{ id: 1, tur: "personel", kisiId: 1, kisiAd: "Ege", tutar: 4300, ay: "2026-07", tarih: "2026-07-09", hesapId: "ana", not: "" }],
  /* Avansın da ESKİ biçimi: yalnızca "hangi aydan kesilecek" bilgisi var. */
  avanslar: [{ id: 1, tur: "freelancer", kisiId: null, kisiAd: "Selin", tutar: 1900, ay: "2026-07", hesapId: "kasa", not: "acil ihtiyaç" }],

  hesaplar: [{ id: "ana", ad: "Ana Hesap", anaHesap: true }, { id: "kasa", ad: "Nakit Kasa" }],
  /* Transferin tarihi EKRAN biçiminde tutuluyor (`toLocaleDateString("tr-TR")`) —
   * döneme yazılamaz, ama kayıt silinmez. */
  hesapTransferleri: [{ id: 1, kaynakHesapId: "ana", hedefHesapId: "kasa", tutar: 2500, tarih: "20.09.2026" }],
  hesapDuzeltmeleri: [{ id: 1, hesapId: "kasa", tutar: -450, tarih: "2026-08-02", not: "Elle düzeltme" }],
  /* Vergi kaydının tarihi serbest metin, TUTARI HİÇ YOK. */
  vergiTakvimi: [{ id: 1, kalem: "KDV Beyannamesi", tarih: "26 Ağu", durum: "yaklaşıyor" }],

  uyelikler: [
    { id: 1, ad: "Canva Pro", tutar: 600, periyot: "aylik", aktif: true },
    { id: 2, ad: "Adobe CC", tutar: 9600, periyot: "yillik" },   // `aktif` elle girilmemiş
  ],
  personel: [{ id: 1, ad: "Ege", pozisyon: "Video Editörü", maas: 32000, sigorta: 9500, yemek: 3500, tazminatBirikimi: 1500 }],

  cekimIsleri: [
    { id: 101, marka: "Animed", kameraman: "Selin", editor: "Ege", teslimEdilmeTarihi: bugun },
    { id: 102, marka: "Bomonti", editor: "Selin", teslimEdilmeTarihi: "2026-03-20" },
    { id: 103, marka: "Animed", editor: "Kerem" },   // teslim edilmemiş → hak ediş doğmadı
  ],
  isUcretleri: { Selin: 2200, Ege: 1400 },
  isUcretDetaylari: {},
});

const uret = (d = belge()) => finansHareketleri(d, { donusturulmeTarihi: bugun });
const bul = (liste, kaynakAlan) => liste.filter((h) => h.kaynakAlan === kaynakAlan);
const topla = (liste, suz) => liste.filter(suz).reduce((s, h) => s + (Number(h.tutar) || 0), 0);

/* ---------------------------------------------------------------- */
await bolum("1) ON BEŞ KAYNAĞIN HEPSİ DÖNÜŞÜYOR", 4, () => {
  const { hareketler } = uret();
  t("KAYNAKLAR listesi on beş kaynak sayıyor", KAYNAKLAR.length === 15, `gelen: ${KAYNAKLAR.length}`);
  const eksik = KAYNAKLAR.filter((a) => bul(hareketler, a).length === 0);
  t("her kaynaktan en az bir hareket çıkıyor", eksik.length === 0, "üretmeyen: " + eksik.join(", "));
  const bilinmeyen = [...new Set(hareketler.map((h) => h.kaynakAlan))].filter((a) => !KAYNAKLAR.includes(a));
  t("listede olmayan kaynaktan hareket üretilmiyor", bilinmeyen.length === 0, bilinmeyen.join(", "));
  t("toplam 23 hareket üretiliyor", hareketler.length === 23, `gelen: ${hareketler.length}`);
});

/* ---------------------------------------------------------------- */
await bolum("2) KİMLİK KARARLI — migrasyon kopya üretmesin", 4, () => {
  const bir = uret().hareketler.map((h) => h.id);
  const iki = uret().hareketler.map((h) => h.id);
  t("aynı belge iki kez verilince aynı kimlikler çıkıyor", bir.join("|") === iki.join("|"));
  t("kimlikler benzersiz", new Set(bir).size === bir.length, `${bir.length} hareket, ${new Set(bir).size} kimlik`);
  t("hiçbir kimlik rastgele değil (iki koşuda da aynı sırada)",
    bir.every((x, i) => x === iki[i]));
  /* İKİ MARKANIN DA 1 NUMARALI MALİYETİ VAR — üst kayıt kimliği taşınmasaydı ikisi
   * aynı kimliği alır, biri migrasyonda sessizce kaybolurdu. */
  const maliyetler = bul(uret().hareketler, "clients.maliyetler");
  t("iç içe kayıt ÜST kaydın kimliğini de taşıyor",
    maliyetler.length === 2 && new Set(maliyetler.map((h) => h.id)).size === 2,
    maliyetler.map((h) => h.id).join(" / "));
});

/* ---------------------------------------------------------------- */
await bolum("3) TARİHSİZ KAYIT GİZLENMİYOR", 6, () => {
  const { hareketler, tarihsiz, uyarilar } = uret();
  const tarihsizHareketler = hareketler.filter((h) => !h.donem);
  t("tarihsiz sayacı hareket sayısıyla tutuyor",
    tarihsiz === tarihsizHareketler.length && tarihsiz === 13, `sayaç ${tarihsiz}, hareket ${tarihsizHareketler.length}`);
  const ayszTahsilat = bul(hareketler, "clients.odemeKayitlari").find((h) => h.kaynakId === "1/2");
  t("ayı girilmemiş tahsilat LİSTEDEN DÜŞMÜYOR", Boolean(ayszTahsilat));
  t("düşmeyen kaydın dönemi null, tutarı duruyor",
    ayszTahsilat && ayszTahsilat.donem === null && ayszTahsilat.tutar === 7100);
  t("tarihi çözülemeyen kayıt eksikBilgi'de 'tarih' taşıyor",
    ayszTahsilat && ayszTahsilat.eksikBilgi.includes("tarih"));
  t("ekran biçimli transfer tarihi uyarı olarak bildiriliyor",
    uyarilar.some((u) => u.includes("hesapTransferleri") && u.includes("tarihi çözülemedi")),
    uyarilar.join(" | "));
  t("teslim edilmemiş iş uyarıda sayılıyor",
    uyarilar.some((u) => u.includes("cekimIsleri") && u.includes("teslim edilmemiş")),
    uyarilar.join(" | "));
});

/* ---------------------------------------------------------------- */
await bolum("4) KDV VE STOPAJ UYDURULMUYOR", 4, () => {
  const { hareketler } = uret();
  /* Hareket SIRAYA göre değil KİMLİĞE göre aranıyor: liste tarihe göre sıralı ve
   * "ilk eleman" başka bir markanın kaydı olabilir — sıraya güvenen bir kontrol
   * sınadığını sandığı kaydı sınamaz. */
  const tahsilat = bul(hareketler, "clients.odemeKayitlari").find((h) => h.kaynakId === "1/1");
  t("kayıtta KDV yoksa null", tahsilat.kdv === null, String(tahsilat.kdv));
  t("kayıtta stopaj yoksa null", tahsilat.stopaj === null, String(tahsilat.stopaj));
  t("bilinmeyen KDV/stopaj eksikBilgi'ye yazılıyor",
    tahsilat.eksikBilgi.includes("kdv") && tahsilat.eksikBilgi.includes("stopaj"),
    tahsilat.eksikBilgi.join(","));
  /* Hesaplanmış bir KDV varsa TAŞINIR — oran koda gömülmediği için tek yol bu. */
  const d = belge();
  d.clients[0].odemeKayitlari[0].kdv = 2400;
  const kdvli = bul(finansHareketleri(d, { donusturulmeTarihi: bugun }).hareketler, "clients.odemeKayitlari")
    .find((h) => h.kaynakId === "1/1");
  t("kayıtta hesaplanmış KDV varsa olduğu gibi taşınıyor",
    kdvli.kdv === 2400 && !kdvli.eksikBilgi.includes("kdv"), String(kdvli.kdv));
});

/* ---------------------------------------------------------------- */
await bolum("5) AYNI PARA İKİ KEZ SAYILMIYOR", 9, () => {
  const { hareketler } = uret();

  t("tahsilat, gelir ve fatura AYRI türler",
    topla(hareketler, (h) => h.tur === "tahsilat") === 31000
    && topla(hareketler, (h) => h.tur === "gelir") === 4500
    && topla(hareketler, (h) => h.tur === "fatura") === 9400);
  t("fatura tahsilat toplamına girmiyor",
    bul(hareketler, "clients.faturalar").every((h) => h.tur === "fatura"));

  t("gider ile ödeme ayrı türler",
    topla(hareketler, (h) => h.tur === "odeme") === 6200
    && bul(hareketler, "giderKalemleri")[0].tur === "gider");
  const avans = bul(hareketler, "avanslar")[0];
  t("avans ödeme türünde, kategorisi 'avans'", avans.tur === "odeme" && avans.kategori === "avans");
  t("avans İKİNCİ KEZ gider sayılmıyor",
    topla(hareketler, (h) => h.tur === "gider" && h.kategori === "avans") === 0);

  const hakedisler = hareketler.filter((h) => h.tur === "hakedis");
  t("teslim edilen iki işten üç hak ediş doğuyor", hakedisler.length === 3, `gelen: ${hakedisler.length}`);
  t("hak ediş ile ödeme AYRI hareketler",
    hakedisler.every((h) => h.tur !== "odeme")
    && hakedisler.some((h) => h.kisi === "Selin")
    && bul(hareketler, "avanslar")[0].kisi === "Selin");

  const transferler = hareketler.filter((h) => h.tur === "transfer");
  t("transfer iki bacak üretiyor, ikisi de gelir/gider değil",
    transferler.length === 2
    && transferler.some((h) => h.kategori === "cikis" && h.hesapId === "ana")
    && transferler.some((h) => h.kategori === "giris" && h.hesapId === "kasa")
    && !transferler.some((h) => h.tur === "gelir" || h.tur === "gider"));
  t("`monthly` HİÇ dönüştürülmüyor",
    !hareketler.some((h) => String(h.kaynakAlan).includes("monthly")
      || Number(h.tutar) === 111111 || Number(h.tutar) === 88889));
});

/* ---------------------------------------------------------------- */
await bolum("6) AYRILAN/DONDURULAN MARKANIN GEÇMİŞİ KORUNUYOR", 2, () => {
  const { hareketler } = uret();
  const bomonti = hareketler.filter((h) => h.kisi === "Bomonti" && h.tur === "tahsilat");
  t("dondurulmuş markanın tahsilatı listede duruyor",
    bomonti.length === 1 && bomonti[0].tutar === 5600, `gelen: ${bomonti.length}`);
  t("dondurulmuş markanın maliyeti de kaybolmuyor",
    bul(hareketler, "clients.maliyetler").some((h) => h.kisi === "Bomonti" && h.tutar === 2100));
});

/* ---------------------------------------------------------------- */
await bolum("7) SAFLIK — girdi değişmiyor, tarih dışarıdan geliyor", 4, () => {
  const d = belge();
  const once = JSON.stringify(d);
  const r = uret(d);
  t("girdi belgesi hiç değişmedi", JSON.stringify(d) === once);
  t("dönüş değeri yeni nesne (her çağrı ayrı dizi)",
    finansHareketleri(d, { donusturulmeTarihi: bugun }).hareketler !== r.hareketler);

  /* Modül `new Date()` çağırsaydı, verilen tarih sonucu DEĞİŞTİREMEZDİ. */
  const baska = finansHareketleri(d, { donusturulmeTarihi: "2001-02-03" });
  t("`donusturuldu` verilen tarihten geliyor, sistem saatinden değil",
    r.hareketler[0].donusturuldu === bugun && baska.hareketler[0].donusturuldu === "2001-02-03");
  const tarihsizCagri = finansHareketleri(d, {});
  t("tarih verilmezse uydurulmuyor, uyarı yazılıyor",
    tarihsizCagri.hareketler[0].donusturuldu === null
    && tarihsizCagri.uyarilar.some((u) => u.includes("Dönüştürülme tarihi verilmedi")));
});

/* ---------------------------------------------------------------- */
await bolum("8) MUTABAKAT — eski motorla yan yana", 6, () => {
  const d = belge();
  const { hareketler } = uret(d);
  const r = finansMutabakati(d, hareketler,
    { live: computeLive(d), hesapBakiyesi, donusturulmeTarihi: bugun });

  const tutmayan = r.satirlar.filter((s) => s.fark !== 0);
  t("bütün satırlar tutuyor", tutmayan.length === 0,
    tutmayan.map((s) => `${s.ad}: ${s.eski}→${s.yeni}`).join(" | "));
  t("tutuyorsa bloke YOK", r.esitMi === true && r.bloke === false, r.sebepler.join(" | "));
  t("en az on iki satır karşılaştırılıyor", r.satirlar.length >= 12, `gelen: ${r.satirlar.length}`);
  t("hesap bakiyeleri satır satır karşılaştırılıyor",
    r.satirlar.some((s) => s.ad.includes("Ana Hesap")) && r.satirlar.some((s) => s.ad.includes("Nakit Kasa")),
    r.satirlar.map((s) => s.ad).join(" | "));
  t("tahsilat, gider, ödeme, fatura ve bekleyen alacak satırları var",
    ["Tahsilat toplamı", "Aylık gider", "Ödeme toplamı", "Fatura toplamı", "Bekleyen alacak"]
      .every((a) => r.satirlar.some((s) => s.ad.includes(a))),
    r.satirlar.map((s) => s.ad).join(" | "));
  t("tarihsiz kayıt sayısı da mutabakata giriyor",
    r.satirlar.some((s) => s.ad.includes("Tarihsiz tahsilat") && s.eski === 1 && s.yeni === 1));
});

/* ---------------------------------------------------------------- */
await bolum("9) MUTABAKAT KAPISI — fark varsa GEÇİŞ YOK", 6, () => {
  const d = belge();
  const { hareketler } = uret(d);
  const live = computeLive(d);

  /* (a) Bir hareketin tutarı elle bozuluyor. */
  const bozuk = hareketler.map((h) => (h.kaynakAlan === "ofisGiderleri" ? { ...h, tutar: 8901 } : h));
  const rb = finansMutabakati(d, bozuk, { live, hesapBakiyesi, donusturulmeTarihi: bugun });
  t("tek kuruşluk fark bile bloke ediyor", rb.bloke === true && rb.esitMi === false);
  t("hangi satırın tutmadığı insan diliyle yazılıyor",
    rb.sebepler.some((s) => s.includes("Ofis giderleri") && s.includes("fark")),
    rb.sebepler.join(" | "));

  /* (b) Bir hareket tamamen kayboluyor — migrasyonun en sessiz hatası. */
  const eksik = hareketler.filter((h) => h.kaynakAlan !== "personel");
  const re = finansMutabakati(d, eksik, { live, hesapBakiyesi, donusturulmeTarihi: bugun });
  t("kaybolan hareket bloke ediyor", re.bloke === true);
  t("kaybolan hareketin satırı sebeplerde adıyla geçiyor",
    re.sebepler.some((s) => s.includes("Personel gideri")), re.sebepler.join(" | "));

  /* (c) FAIL-CLOSE: eski taraf hiç verilmezse "tutuyor" DENMEZ. */
  const ry = finansMutabakati(d, hareketler, { donusturulmeTarihi: bugun });
  t("eski motor verilmezse bloke ediliyor", ry.bloke === true);
  t("karşılaştırılamayan rakam sebep olarak yazılıyor",
    ry.sebepler.some((s) => s.includes("computeLive"))
    && ry.sebepler.some((s) => s.includes("hesapBakiyesi")), ry.sebepler.join(" | "));
});

/* ---------------------------------------------------------------- */
await bolum("10) MUTABAKAT DA SAF", 2, () => {
  const d = belge();
  const { hareketler } = uret(d);
  const once = JSON.stringify(d);
  const oncekiHareket = JSON.stringify(hareketler);
  finansMutabakati(d, hareketler, { live: computeLive(d), hesapBakiyesi, donusturulmeTarihi: bugun });
  t("belge değişmedi", JSON.stringify(d) === once);
  t("hareket listesi değişmedi", JSON.stringify(hareketler) === oncekiHareket);
});

/* ---------------------------------------------------------------- */
await bolum("11) EKSİK BİLGİ ÖZETİ — sayım ekranda değil, MODÜLDE", 6, () => {
  const d = belge();
  const { hareketler, tarihsiz } = uret(d);
  const ozet = eksikBilgiOzeti(hareketler);

  /* İKİ SAYAÇ AYRIŞAMAZ: `finansHareketleri`'nin `tarihsiz` sayacı ile özetinki aynı
   * kaynaktan (`donem`) geliyor. Ayrışırlarsa ekran ile motor farklı şey söyler —
   * bu projedeki en pahalı hata sınıfının ta kendisi. */
  t("tarihsiz sayacı üreticiyle birebir aynı", ozet.tarihsiz === tarihsiz,
    `özet ${ozet.tarihsiz}, üretici ${tarihsiz}`);
  t("toplam hareket sayısı doğru", ozet.toplam === hareketler.length,
    `${ozet.toplam} / ${hareketler.length}`);

  /* Sayım UYDURULMUYOR: her rakam `eksikBilgi` etiketlerinin kendisinden sayılıyor. */
  const elle = (etiket) => hareketler.filter((h) => h.eksikBilgi.includes(etiket)).length;
  t("KDV sayımı etiketlerle tutuyor", ozet.kdvBilinmeyen === elle("kdv") && ozet.kdvBilinmeyen > 0,
    `${ozet.kdvBilinmeyen} / ${elle("kdv")}`);
  t("stopaj sayımı etiketlerle tutuyor",
    ozet.stopajBilinmeyen === elle("stopaj") && ozet.stopajBilinmeyen > 0,
    `${ozet.stopajBilinmeyen} / ${elle("stopaj")}`);
  t("tutarı bilinmeyen kayıt sayılıyor (vergi takvimi tutar taşımıyor)",
    ozet.tutarBilinmeyen === elle("tutar") && ozet.tutarBilinmeyen > 0,
    `${ozet.tutarBilinmeyen} / ${elle("tutar")}`);

  /* SAF: girdi değişmiyor. */
  const once = JSON.stringify(hareketler);
  eksikBilgiOzeti(hareketler);
  t("hareket listesi değişmedi", JSON.stringify(hareketler) === once);
});

/* ---------------------------------------------------------------- */
await bolum("12) MUTABAKAT SATIRI BİRİMİNİ KENDİSİ TAŞIYOR", 3, () => {
  const d = belge();
  const { hareketler } = uret(d);
  const r = finansMutabakati(d, hareketler, { live: computeLive(d), hesapBakiyesi, donusturulmeTarihi: bugun });

  /* Ekran birimi satırın ADINDAN tahmin etmemeli: başlık metni değişince sessizce
   * kopan bir kural olurdu ve adet satırına "₺3" yazılırdı. */
  t("her satırın birimi yazılı", r.satirlar.every((x) => x.birim === "tl" || x.birim === "adet"),
    r.satirlar.map((x) => `${x.ad}=${x.birim}`).join(" | "));
  t("adet satırları 'adet' işaretli",
    r.satirlar.filter((x) => x.birim === "adet").length === 3
    && r.satirlar.filter((x) => x.birim === "adet").every((x) => x.ad.includes("(adet)")),
    r.satirlar.filter((x) => x.birim === "adet").map((x) => x.ad).join(" | "));
  t("para satırları 'tl' işaretli ve çoğunlukta",
    r.satirlar.filter((x) => x.birim === "tl").length >= 9
    && r.satirlar.filter((x) => x.birim === "tl").every((x) => !x.ad.includes("(adet)")),
    String(r.satirlar.filter((x) => x.birim === "tl").length));
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bir bölüm `await` edilmezse ya da `bolum()` çağrısı silinirse test hiçbir şey ölçmeden
 * 0 ile çıkar — koşucu da yakalayamaz (çıkış kodu 0, ✗ yok). Bu yaşandı (t95).
 * KONTROL EKLERKEN BU SAYIYI DA ARTIR. */
const BEKLENEN = 56;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
