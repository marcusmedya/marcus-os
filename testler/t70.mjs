/* ŞUBE BAZLI PAYLAŞIM — KART VE MÜŞTERİ PANELİ (Adım 4/4)
 *
 * Adım 3'e kadar "bu içerik yalnızca şu şubede kullanılsın" kuralı sunucuda vardı ama
 * işaretleyecek bir yer yoktu. Bu adımda kart ekranı o seçimi yapıyor. Seçim yapılabilir
 * olunca iki yeni soru doğuyor — ikisi de burada sınanıyor:
 *
 * 1. SEÇİM ONAYDAN SONRA DEĞİŞİRSE STOK NE OLUYOR? Kart onaylanınca kullanabilen her
 *    şubenin stoğu artmıştı. Sonradan kapsam daraltılırsa, dışarıda kalan şubede o +1
 *    olduğu yerde kalıyordu: hiçbir zaman kullanamayacağı bir içerik için stok gösteren
 *    şube. Stok motoru aşama değişimine bakıyor, aşama değişmediği için hiç uyanmıyordu.
 *
 * 2. MÜŞTERİ AYNI İÇERİĞİ DÖRT KEZ Mİ GÖRÜYOR? Dört şubede paylaşılan tek içerik planda
 *    dört kayıt tutuyor. Panel bunları olduğu gibi çizerse akış önizlemesinde aynı kare
 *    dört kez tekrar eder — marka "her gün aynı gönderiyi paylaşıyor" gibi görünür.
 *    Tek satır + şube etiketleri; "✓ Paylaşıldı" yalnızca TÜM şubeler bitince.
 *
 * 3. MARKA ADI → MARKA KİMLİĞİ. Kartlar markayı ADIYLA, şubeler `clientId` ile saklıyor.
 *    Çeviri yanlışsa şube bölümü hiç çizilmez ve kullanıcı özelliğin bozuk olduğunu sanır.
 */
import { onaylananlaraGoreStok } from "../lib/stok.js";
import { musteriPlanSatirlari, subeStokAnahtari } from "../lib/sube-kullanimi.js";
import { markaninIdsi } from "../lib/marka-kilidi.js";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};

/* BÖLÜM KORUMASI — koruma kırıldığında test ÇÖKMEMELİ.
 *
 * Bu proje bir korumayı bozup kaç kontrolün düştüğünü ölçmeyi şart koşuyor. Çöken
 * test hiç sonuç yazmaz; ölçüm "0 düştü" görünür ve koruma sınanmamış sayılır —
 * bu daha önce bir kez yaşandı. Bölüm patlarsa kalan kontroller düşmüş sayılır. */
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const oncekiToplam = g + k;
  try { fn(); }
  catch (e) {
    const yapilan = g + k - oncekiToplam;
    for (let i = yapilan; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); }
  }
};

const CLIENTS = [{ id: 1, ad: "Smell Coffee" }, { id: 2, ad: "Başka Marka" }];
const SUBELER = [
  { id: "lara", ad: "Smell Lara", clientId: 1 },
  { id: "mrkz", ad: "Smell Merkez", clientId: 1 },
  { id: "kepz", ad: "Smell Kepez", clientId: 1 },
];
const sa = (subeId) => subeStokAnahtari(1, subeId, "Reels");
let stok;
const oku = (r, anahtar) => (r && r.stoklar ? r.stoklar[anahtar] : undefined);

/* ---------------------------------------------------------------- */
bolum("1) ONAY ANINDA — kullanabilen her şubenin stoğu artıyor", 1, () => {
  const once = [{ id: 5, marka: "Smell Coffee", kategori: "Video", asama: "Kontrol Bekliyor" }];
  const sonra = [{ id: 5, marka: "Smell Coffee", kategori: "Video", asama: "Onaylandı" }];
  const r = onaylananlaraGoreStok(once, sonra, {}, CLIENTS, null, SUBELER);
  stok = r.stoklar;
  t("üç şubenin de stoğu 1", stok[sa("lara")] === 1 && stok[sa("mrkz")] === 1 && stok[sa("kepz")] === 1,
    JSON.stringify([stok[sa("lara")], stok[sa("mrkz")], stok[sa("kepz")]]));});

/* ---------------------------------------------------------------- */
bolum("2) KAPSAM SONRADAN DARALTILIYOR — dışarıda kalan şubeden düşüyor", 7, () => {
  const once = [{ id: 5, marka: "Smell Coffee", kategori: "Video", asama: "Onaylandı", stokSayildi: true }];
  const sonra = [{ id: 5, marka: "Smell Coffee", kategori: "Video", asama: "Onaylandı", stokSayildi: true, sadeceSubeler: ["lara"] }];
  const r = onaylananlaraGoreStok(once, sonra, stok, CLIENTS, null, SUBELER);

  t("Lara'nın stoğu duruyor", r.stoklar[sa("lara")] === 1);
  t("Merkez'in stoğu düştü", r.stoklar[sa("mrkz")] === 0, "gelen: " + r.stoklar[sa("mrkz")]);
  t("Kepez'in stoğu düştü", r.stoklar[sa("kepz")] === 0, "gelen: " + r.stoklar[sa("kepz")]);
  t("değişiklik bildiriliyor", r !== null, "motor null dönerse hiçbir şey yazılmaz");
  t("GENEL stok bu işten etkilenmiyor", (r.stoklar["1_Reels"] || 0) === 1,
    "kapsam değişti, içerik sayısı değişmedi");
  t("aşama korunuyor", r.cekimIsleri[0].asama === "Onaylandı");

  /* Ters yön: kapsam yeniden genişlerse geri gelmeli. */
  const geri = onaylananlaraGoreStok(sonra, once, r.stoklar, CLIENTS, null, SUBELER);
  t("kapsam genişleyince stok geri geliyor",
    geri.stoklar[sa("mrkz")] === 1 && geri.stoklar[sa("kepz")] === 1 && geri.stoklar[sa("lara")] === 1);});

/* ---------------------------------------------------------------- */
bolum("3) KAPSAM DEĞİŞMEYEN KART — hiçbir şeye dokunulmuyor", 1, () => {
  const ayni = [{ id: 5, marka: "Smell Coffee", kategori: "Video", asama: "Onaylandı", stokSayildi: true, sadeceSubeler: ["lara"] }];
  const r = onaylananlaraGoreStok(ayni, ayni, { [sa("lara")]: 1 }, CLIENTS, null, SUBELER);
  t("motor hiç yazma üretmiyor", r === null, "değişiklik yoksa null döner");});

/* ---------------------------------------------------------------- */
bolum("4) ONAYDA OLMAYAN KART — kapsam değişse de stok oluşmuyor", 1, () => {
  const once = [{ id: 6, marka: "Smell Coffee", kategori: "Video", asama: "Çekim Bekliyor" }];
  const sonra = [{ id: 6, marka: "Smell Coffee", kategori: "Video", asama: "Çekim Bekliyor", sadeceSubeler: ["lara"] }];
  const r = onaylananlaraGoreStok(once, sonra, {}, CLIENTS, null, SUBELER);
  t("hiçbir şube stoğu doğmuyor", r === null, JSON.stringify(r && r.stoklar));});

/* ---------------------------------------------------------------- */
bolum("5) MARKA ADI → MARKA KİMLİĞİ", 5, () => {
  t("büyük/küçük ve boşluk farkı sorun değil", markaninIdsi(CLIENTS, " smell coffee ") === 1);
  t("tanınmayan marka null", markaninIdsi(CLIENTS, "Yok Böyle") === null);
  t("boş ad null", markaninIdsi(CLIENTS, "") === null && markaninIdsi(CLIENTS, null) === null);
  /* "Cem" ve "Çem" toleranslı anahtarda AYNI yere düşüyor. Böyle bir çakışmada
   * eşleştirici birebir yazıma dönüyor — biri diğerinin şube stoğunu değiştirirse
   * bu bir gizlilik sorunu olurdu. */
  {
    const cakisan = [{ id: 1, ad: "Cem" }, { id: 2, ad: "Çem" }];
    t("çakışan markalar birbirine karışmıyor",
      markaninIdsi(cakisan, "Cem") === 1 && markaninIdsi(cakisan, "Çem") === 2,
      "gelen: " + markaninIdsi(cakisan, "Cem") + "/" + markaninIdsi(cakisan, "Çem"));
    t("çakışma yokken tolerans çalışıyor",
      markaninIdsi([{ id: 1, ad: "Çem" }], "cem") === 1);
  }});

/* ---------------------------------------------------------------- */
bolum("6) MÜŞTERİ PANELİ — tek satır, şube etiketleri", 11, () => {
  const plan = [
    { id: "p1", isId: 9, subeId: "lara", subeAdi: "Smell Lara", gun: "Pzt", haftaKey: "2026-08-17", yapildi: true, yapildigiTarih: "18.08.2026", gorselUrl: null },
    { id: "p2", isId: 9, subeId: "mrkz", subeAdi: "Smell Merkez", gun: "Çar", haftaKey: "2026-08-24", yapildi: false, altMetin: "metin" },
    { id: "p3", isId: 9, subeId: "kepz", subeAdi: "Smell Kepez", gun: "Cum", haftaKey: "2026-08-24", yapildi: false },
    { id: "p4", isId: 7, gun: "Sal", haftaKey: "2026-08-17", yapildi: true },
  ];
  const satirlar = musteriPlanSatirlari(plan);

  t("dört kayıt İKİ satıra iniyor", satirlar.length === 2, "gelen: " + satirlar.length);
  t("üç şube tek satırda etiketleniyor", satirlar[0].subeler.length === 3);
  t("etiketler şube adını taşıyor",
    satirlar[0].subeler.map((x) => x.subeAdi).join(",") === "Smell Lara,Smell Merkez,Smell Kepez");
  t("paylaşılan şubenin TARİHİ duruyor", satirlar[0].subeler[0].tarih === "18.08.2026");
  t("bekleyen şubenin GÜNÜ duruyor", satirlar[0].subeler[1].gun === "Çar");

  t("tek şube paylaştı diye ✓ Paylaşıldı YAZMIYOR", satirlar[0].yapildi === false,
    "müşteriye yanlış bilgi olurdu");
  t("en erken hafta temsilci", satirlar[0].haftaKey === "2026-08-17");
  t("boş alan diğer kayıttan tamamlanıyor", satirlar[0].altMetin === "metin");

  t("şubesiz plan tek tek kalıyor", satirlar[1].isId === 7 && satirlar[1].subeler.length === 0);
  t("şubesiz planın kendi durumu korunuyor", satirlar[1].yapildi === true);

  const hepsiBitti = musteriPlanSatirlari(plan.map((p) => ({ ...p, yapildi: true })));
  t("TÜM şubeler bitince ✓ Paylaşıldı", hepsiBitti[0].yapildi === true);});

/* ---------------------------------------------------------------- */
bolum("7) MÜŞTERİ GÖRÜNÜMÜ — şube adı panele gerçekten ulaşıyor", 4, () => {
  const data = {
    clients: CLIENTS,
    subeler: SUBELER,
    haftalikPaylasimlar: [
      { id: "p1", clientId: 1, isId: 9, subeId: "lara", subeAdi: "Smell Lara", gun: "Pzt", haftaKey: "2026-08-17", tur: "Video", yapildi: true },
      { id: "p9", clientId: 2, isId: 3, subeId: "x", subeAdi: "Başkasının Şubesi", gun: "Pzt", haftaKey: "2026-08-17", tur: "Video" },
    ],
    cekimIsleri: [], musteriTalepleri: [], reklamlar: [],
  };
  const gorunum = musteriGorunumuUret(data, CLIENTS[0], markaEslestirici);
  const kendi = gorunum.paylasimPlani;

  t("kendi planı geliyor", kendi.length === 1 && kendi[0].id === "p1");
  t("şube adı projeksiyonda var", kendi[0].subeAdi === "Smell Lara", "gelen: " + kendi[0].subeAdi);
  t("şube kimliği metne çevrilmiş", kendi[0].subeId === "lara");
  t("BAŞKA markanın şubesi sızmıyor",
    !JSON.stringify(kendi).includes("Başkasının Şubesi"));});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
