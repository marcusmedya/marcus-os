/* MARKA BİTİŞ AYI VE İLERİYE DÖNÜK MALİ TAHMİN
 * `lib/marka-donemi.js` + `lib/mali-tahmin.js`
 *
 * NEDEN VAR: `CLIENT_FIELDS`'te `baslangic` vardı, BİTİŞ AYI yoktu. `durum`
 * ("aktif"/"yeni"/"donduruldu"/"ayrildi") tarihsizdir ve işaretlendiği ANDA geçerli
 * olur — yani "Eylül'de çalışan, Ekim'de çalışmayacak" markayı bugün işaretlemenin
 * doğru yolu yoktu: "aktif" bırakmak Ekim tahminini şişiriyor, "ayrildi" yapmak Eylül
 * gelirini de düşürüyordu.
 *
 * BU DEĞİŞİKLİĞİN TEK KABUL ÖLÇÜTÜ: `bitisAyi` BOŞ olan bir belgede hiçbir şey
 * değişmeyecek. 1. bölüm tam olarak bunu ölçüyor ve bu dosyanın en önemli bölümü.
 *
 * DAVRANIŞ sınanıyor, kaynak metni DEĞİL: hiçbir kontrol dosyanın içine `grep` atmıyor,
 * hepsi modülü ÇAĞIRIP dönen değere bakıyor. `new Date()` de hiç kullanılmıyor — iki
 * modül de ayı parametre olarak alıyor, yoksa test aylar sonra kimse dokunmadan kırılırdı.
 */
import {
  markaAydaAktifMi, markaninBitisAyi, markaninBaslangicAyi,
  aydaAktifMarkalar, bitisAyiGirilmemisler,
} from "../lib/marka-donemi.js";
import {
  maliTahmin, dusenMarkaSatirlari, ayAdediniSinirla, ENFAZLA_AY, VARSAYILAN_AY_ADEDI,
} from "../lib/mali-tahmin.js";

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

/* Sabit aylar — takvime bağlı DEĞİL. Testin aylar sonra kendiliğinden kırmızıya
 * dönmemesi için iki modülde de `new Date` yok ve buradaki aylar elle veriliyor. */
const EYL = "2026-09", EKI = "2026-10", KAS = "2026-11", ARA = "2026-12";

const marka = (ek = {}) => ({
  id: ek.id || "m1", ad: ek.ad || "Marka (TEST)", durum: "aktif",
  aylikUcret: 30000, baslangic: "2026-01", ucretGecmisi: [], odemeKayitlari: [], ...ek,
});

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · BİTİŞ AYI BOŞ → BUGÜNKÜ DAVRANIŞ BİREBİR AYNI
 *
 * Bu bölüm bağımsız bir ORAKEL kullanıyor: alan eklenmeden önceki kural elle yazılıp
 * modülün çıktısıyla karşılaştırılıyor. Modülün kendi koduna bakılmıyor.
 * ──────────────────────────────────────────────────────────────────────────── */
const bugunkuKural = (c, ay) => {
  const bas = c.baslangic;
  if (bas && String(ay) < String(bas)) return false;
  return c.durum !== "donduruldu" && c.durum !== "ayrildi";
};

await bolum("1 · bitisAyi BOŞ → bugünkü davranış birebir aynı (EN ÖNEMLİ)", 8, () => {
  const bitissizler = [
    marka({ id: "a", durum: "aktif" }),
    marka({ id: "b", durum: "yeni" }),
    marka({ id: "c", durum: "donduruldu" }),
    marka({ id: "d", durum: "ayrildi" }),
    marka({ id: "e", durum: "aktif", baslangic: KAS }),
    marka({ id: "f", durum: "aktif", baslangic: "" }),
    marka({ id: "g", durum: "aktif", bitisAyi: "" }),        // boş dize de BOŞ sayılır
    marka({ id: "h", durum: "aktif", bitisAyi: null }),       // null da BOŞ sayılır
  ];
  const aylar = ["2026-08", EYL, EKI, KAS, ARA, "2027-06"];
  let sapan = null, karsilastirilan = 0;
  bitissizler.forEach((c) => aylar.forEach((ay) => {
    karsilastirilan++;
    if (markaAydaAktifMi(c, ay) !== bugunkuKural(c, ay)) sapan = `${c.id} @ ${ay}`;
  }));
  t(`bitisAyi olmayan ${bitissizler.length} markada ${karsilastirilan} ay–marka kontrolünün hepsi eski kuralla AYNI`,
    sapan === null && karsilastirilan === 48, sapan || `karşılaştırılan: ${karsilastirilan}`);

  t("aktif marka, bitiş yok → her ileri ayda aktif",
    markaAydaAktifMi(marka({ durum: "aktif" }), "2030-01") === true);
  t('"yeni" durumu aktif sayılıyor',
    markaAydaAktifMi(marka({ durum: "yeni" }), EKI) === true);
  t("donduruldu + bitiş yok → aktif DEĞİL",
    markaAydaAktifMi(marka({ durum: "donduruldu" }), EKI) === false);
  t("ayrildi + bitiş yok → aktif DEĞİL",
    markaAydaAktifMi(marka({ durum: "ayrildi" }), EKI) === false);
  t("bitisAyi boşken markaninBitisAyi null",
    markaninBitisAyi(marka({ bitisAyi: "" })) === null
      && markaninBitisAyi(marka()) === null);
  /* BOZUK bitiş ayı sessizce "sonsuza kadar aktif" yapmamalı, bugünkü davranışa düşmeli. */
  t("bozuk bitisAyi ('abc', '2026-13-99') → bugünkü davranış, tarih kuralı DEVREYE GİRMEZ",
    markaninBitisAyi(marka({ bitisAyi: "abc" })) === null
      && markaAydaAktifMi(marka({ durum: "ayrildi", bitisAyi: "abc" }), EKI) === false
      && markaAydaAktifMi(marka({ durum: "aktif", bitisAyi: "abc" }), "2030-01") === true);
  t("client ya da ay çözülemezse fail-close (false)",
    markaAydaAktifMi(null, EKI) === false
      && markaAydaAktifMi(marka(), "") === false
      && markaAydaAktifMi(marka(), "bozuk") === false);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · BİTİŞ AYI DAHİL AKTİF, SONRAKİ AY DEĞİL
 * ──────────────────────────────────────────────────────────────────────────── */
await bolum("2 · bitiş ayı DAHİL aktif, sonrası değil", 6, () => {
  const c = marka({ bitisAyi: EKI });
  t("bitiş ayından ÖNCEKİ ay aktif", markaAydaAktifMi(c, EYL) === true);
  t("bitiş ayının KENDİSİ aktif (dahil)", markaAydaAktifMi(c, EKI) === true);
  t("bitiş ayından SONRAKİ ay aktif DEĞİL", markaAydaAktifMi(c, KAS) === false);
  t("çok sonraki ay da aktif değil", markaAydaAktifMi(c, "2030-01") === false);
  /* TARİH DURUMU YENER: kullanıcı markayı bugün "ayrildi" işaretlemiş olabilir ama
   * bitiş ayı Ekim'se Eylül ve Ekim çalışılan aylardır — geçmiş/yakın gelecek silinmez. */
  t('durum "ayrildi" olsa bile bitiş ayına kadar aktif (tarih kazanır)',
    markaAydaAktifMi(marka({ durum: "ayrildi", bitisAyi: EKI }), EKI) === true
      && markaAydaAktifMi(marka({ durum: "ayrildi", bitisAyi: EKI }), KAS) === false);
  t('durum "donduruldu" + bitiş ayı dolu → yine tarih kazanır',
    markaAydaAktifMi(marka({ durum: "donduruldu", bitisAyi: KAS }), EKI) === true
      && markaAydaAktifMi(marka({ durum: "donduruldu", bitisAyi: KAS }), ARA) === false);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · BAŞLANGIÇ ÖNCESİ AY AKTİF DEĞİL
 * ──────────────────────────────────────────────────────────────────────────── */
await bolum("3 · başlangıç öncesi ay aktif değil", 5, () => {
  const c = marka({ baslangic: EKI });
  t("başlangıçtan önceki ay aktif değil", markaAydaAktifMi(c, EYL) === false);
  t("başlangıç ayının KENDİSİ aktif (dahil)", markaAydaAktifMi(c, EKI) === true);
  t("başlangıç ayı normalleşiyor (gün eklenmiş eski kayıt)",
    markaninBaslangicAyi(marka({ baslangic: "2026-10-01" })) === EKI);
  /* Başlangıç bitişten SONRAYSA hiçbir ay aktif olmamalı — çelişkili giriş sessizce
   * "hep aktif"e dönüşmemeli. */
  t("baslangic > bitisAyi → hiçbir ay aktif değil",
    [EYL, EKI, KAS, ARA].every((ay) =>
      markaAydaAktifMi(marka({ baslangic: ARA, bitisAyi: EYL }), ay) === false));
  t("aydaAktifMarkalar yalnızca o ayın markalarını döndürüyor",
    aydaAktifMarkalar([marka({ id: "x", bitisAyi: EYL }), marka({ id: "y" })], EKI)
      .map((c2) => c2.id).join("|") === "y");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · TAHMİN O AYIN ÜCRETİNİ KULLANIYOR (`ayinUcreti`), `aylikUcret` DEĞİL
 *
 * Fixture bilerek AYIRT EDİCİ: bugünkü `aylikUcret` 45.000 ama Ekim'de yürürlükteki
 * dönem 60.000. `client.aylikUcret` kullanılırsa Ekim 45.000 çıkar ve bu bölüm düşer.
 * ──────────────────────────────────────────────────────────────────────────── */
const UCRETI_DEGISEN = marka({
  id: "ucret", ad: "Ucreti Degisen (TEST)", aylikUcret: 45000,
  ucretGecmisi: [
    { baslangicAy: "0000-00", tutar: 60000, dagilim: null },
    { baslangicAy: KAS, tutar: 45000, dagilim: null },
  ],
});

await bolum("4 · tahmin O AYIN ücretini kullanıyor (ücret geçmişi)", 5, () => {
  const tahmin = maliTahmin({ clients: [UCRETI_DEGISEN] },
    { baslangicAy: EKI, ayAdedi: 3, sabitGider: 0 });
  const ayni = (ay) => tahmin.aylar.find((r) => r.ay === ay);
  t("3 ay üretildi (Eki · Kas · Ara)",
    tahmin.aylar.map((r) => r.ay).join("|") === [EKI, KAS, ARA].join("|"),
    JSON.stringify(tahmin.aylar.map((r) => r.ay)));
  t("Ekim geliri 60.000 — o ay yürürlükteki dönem",
    ayni(EKI) && ayni(EKI).gelir === 60000, ayni(EKI) && String(ayni(EKI).gelir));
  t("Ekim geliri bugünkü aylikUcret (45.000) DEĞİL",
    ayni(EKI) && ayni(EKI).gelir !== UCRETI_DEGISEN.aylikUcret);
  t("Kasım geliri 45.000 — yeni dönem devreye girdi",
    ayni(KAS) && ayni(KAS).gelir === 45000, ayni(KAS) && String(ayni(KAS).gelir));
  t("Aralık da 45.000", ayni(ARA) && ayni(ARA).gelir === 45000);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · DÜŞENLER — doğru marka, doğru ay, doğru tutar
 * ──────────────────────────────────────────────────────────────────────────── */
const BITEN = marka({ id: "biten", ad: "Biten Marka (TEST)", aylikUcret: 30000, bitisAyi: EKI });
const SUREN = marka({ id: "suren", ad: "Suren Marka (TEST)", aylikUcret: 20000 });

await bolum("5 · düşen markalar adıyla, ayıyla ve tutarıyla listeleniyor", 6, () => {
  const tahmin = maliTahmin({ clients: [BITEN, SUREN] },
    { baslangicAy: EYL, ayAdedi: 4, sabitGider: 0 });
  const ayni = (ay) => tahmin.aylar.find((r) => r.ay === ay);
  t("Eylül ve Ekim geliri 50.000 (iki marka birlikte)",
    ayni(EYL).gelir === 50000 && ayni(EKI).gelir === 50000,
    `${ayni(EYL).gelir} / ${ayni(EKI).gelir}`);
  t("Kasım geliri 20.000 — biten marka düştü",
    ayni(KAS).gelir === 20000, String(ayni(KAS).gelir));
  t("düşüş KASIM'da bildiriliyor, Ekim'de değil",
    ayni(EKI).dusenler.length === 0 && ayni(KAS).dusenler.length === 1,
    `Eki: ${ayni(EKI).dusenler.length} · Kas: ${ayni(KAS).dusenler.length}`);
  /* GÜVENLİ ERİŞİM: liste boş kalırsa bu kontrol DÜŞMELİ, bölümü ÇÖKERTMEMELİ —
   * çöken bölüm kalan kontrolleri de ✗ yazar ve kırarak ölçmede kaç kontrolün gerçekten
   * bu iddiaya bağlı olduğu okunamaz hale gelir. */
  const kasimDusen = (ayni(KAS).dusenler || [])[0] || {};
  t("düşen markanın ADI ve TUTARI doğru",
    kasimDusen.ad === "Biten Marka (TEST)" && kasimDusen.tutar === 30000,
    JSON.stringify(ayni(KAS).dusenler));
  t("aynı marka ikinci kez düşen olarak sayılmıyor (Aralık boş)",
    ayni(ARA).dusenler.length === 0, JSON.stringify(ayni(ARA).dusenler));
  const satirlar = dusenMarkaSatirlari(tahmin);
  const ilkSatir = satirlar[0] || {};
  t("dusenMarkaSatirlari ayı koruyor",
    satirlar.length === 1 && ilkSatir.ay === KAS && ilkSatir.ad === "Biten Marka (TEST)",
    JSON.stringify(satirlar));
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · GİDER VERİLMEZSE `null` + VARSAYIM METNİ — SESSİZ SIFIR YOK
 * ──────────────────────────────────────────────────────────────────────────── */
await bolum("6 · sabitGider verilmezse gider null, sessiz sıfır YOK", 7, () => {
  const yok = maliTahmin({ clients: [SUREN] }, { baslangicAy: EKI, ayAdedi: 3 });
  t("gider verilmeyince HER ayda gider null",
    yok.aylar.length === 3 && yok.aylar.every((r) => r.gider === null),
    JSON.stringify(yok.aylar.map((r) => r.gider)));
  t("gider verilmeyince net de null (sıfır DEĞİL)",
    yok.aylar.every((r) => r.net === null),
    JSON.stringify(yok.aylar.map((r) => r.net)));
  t("hiçbir ay sessizce 0 gider yazmıyor",
    yok.aylar.every((r) => r.gider !== 0));
  t("varsayımlarda sebebi yazıyor (boş bırakıldı · sıfır yazılmadı)",
    yok.varsayimlar.some((x) => x.includes("boş bırakıldı"))
      && yok.varsayimlar.some((x) => x.includes("Sıfır yazılmadı")),
    JSON.stringify(yok.varsayimlar));
  t("gelir yine hesaplanıyor — gider eksik diye ekran boşalmıyor",
    yok.aylar.every((r) => r.gelir === 20000));

  /* SIFIR BİR KARARDIR: "gider yok" ile "gider bilinmiyor" ayrı şeyler. */
  const sifir = maliTahmin({ clients: [SUREN] }, { baslangicAy: EKI, ayAdedi: 1, sabitGider: 0 });
  t("sabitGider 0 verilirse gider 0 (bilinmiyor DEĞİL)",
    sifir.aylar[0].gider === 0 && sifir.aylar[0].net === 20000,
    JSON.stringify(sifir.aylar[0]));

  const dolu = maliTahmin({ clients: [SUREN] }, { baslangicAy: EKI, ayAdedi: 2, sabitGider: 12000 });
  t("gider verilince net = gelir − gider",
    dolu.aylar.every((r) => r.net === r.gelir - 12000) && dolu.aylar[0].net === 8000,
    JSON.stringify(dolu.aylar.map((r) => r.net)));
});

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · AY DÖNGÜSÜ SONSUZA GİTMİYOR
 *
 * `lib/ekstre.js` ve `lib/aylik-ozet.js` aynı korumayı taşıyor: ölçüldü, koruma yokken
 * bozuk ay aritmetiği testi SONSUZA soktu — tarayıcıda bu kilitlenme demek.
 * ──────────────────────────────────────────────────────────────────────────── */
await bolum("7 · sonsuz döngü üst sınırı ve ay adedi normalleştirmesi", 6, () => {
  const baslangic = Date.now();
  const cok = maliTahmin({ clients: [SUREN] }, { baslangicAy: EKI, ayAdedi: 100000, sabitGider: 0 });
  const sure = Date.now() - baslangic;
  t(`ayAdedi 100000 verilince üst sınırda duruyor (${cok.aylar.length} ay)`,
    cok.aylar.length === ENFAZLA_AY, String(cok.aylar.length));
  t(`makul sürede bitiyor (${sure} ms) — sonsuz döngü yok`, sure < 10000, `${sure} ms`);
  t("ayAdedi 0 / eksi / metin verilince varsayılana düşüyor",
    ayAdediniSinirla(0) === VARSAYILAN_AY_ADEDI
      && ayAdediniSinirla(-5) === VARSAYILAN_AY_ADEDI
      && ayAdediniSinirla("abc") === VARSAYILAN_AY_ADEDI
      && ayAdediniSinirla(undefined) === VARSAYILAN_AY_ADEDI);
  t("ayAdedi verilmezse 6 ay üretiliyor",
    maliTahmin({ clients: [SUREN] }, { baslangicAy: EKI }).aylar.length === 6);
  t("başlangıç ayı bozuksa tahmin üretilmiyor ve sebebi yazıyor",
    maliTahmin({ clients: [SUREN] }, { baslangicAy: "bozuk" }).aylar.length === 0
      && maliTahmin({ clients: [SUREN] }, { baslangicAy: "bozuk" })
        .varsayimlar.some((x) => x.includes("okunamadı")));
  t("data hiç verilmezse çökmüyor, sebebi varsayımlarda",
    maliTahmin(null, { baslangicAy: EKI, ayAdedi: 2 }).aylar.length === 2
      && maliTahmin(null, { baslangicAy: EKI, ayAdedi: 2 })
        .varsayimlar.some((x) => x.includes("Hiç müşteri kaydı okunamadı")));
});

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · SAFLIK — girdi değişmiyor, eksik veri gizlenmiyor
 * ──────────────────────────────────────────────────────────────────────────── */
await bolum("8 · saflık ve eksik verinin bildirilmesi", 5, () => {
  const belge = { clients: [marka({ id: "p1", bitisAyi: EKI }), marka({ id: "p2" })] };
  const kopya = JSON.stringify(belge);
  const tahmin = maliTahmin(belge, { baslangicAy: EYL, ayAdedi: 4, sabitGider: 1000 });
  t("maliTahmin girdiyi DEĞİŞTİRMİYOR", JSON.stringify(belge) === kopya);
  /* Dönen dizi dışarıdan bozulsa bile belgedeki kayıtlar bozulmamalı. */
  tahmin.aylar.forEach((r) => { r.dusenler.push({ ad: "BOZULDU", tutar: 1 }); });
  t("dönen nesneyi bozmak girdiyi etkilemiyor", JSON.stringify(belge) === kopya);

  t("markaAydaAktifMi girdiyi DEĞİŞTİRMİYOR", (() => {
    const c = marka({ bitisAyi: EKI });
    const once = JSON.stringify(c);
    markaAydaAktifMi(c, KAS);
    markaninBitisAyi(c);
    return JSON.stringify(c) === once;
  })());

  t("bitiş ayı girilmemiş marka sayılıyor ve varsayımda yazıyor",
    bitisAyiGirilmemisler(belge.clients, EYL).map((c) => c.id).join("|") === "p2"
      && maliTahmin(belge, { baslangicAy: EYL, ayAdedi: 4, sabitGider: 1000 })
        .varsayimlar.some((x) => x.includes("Bitiş ayı girilmemiş")));

  /* Ücreti tanımsız marka SESSİZCE SIFIR sayılmaz — ekranda söylenir. */
  const ucretsiz = maliTahmin({ clients: [marka({ id: "u", aylikUcret: 0 })] },
    { baslangicAy: EKI, ayAdedi: 1, sabitGider: 0 });
  t("ücreti tanımsız marka varsayımlarda bildiriliyor",
    ucretsiz.varsayimlar.some((x) => x.includes("aylık ücret tanımlı değil")),
    JSON.stringify(ucretsiz.varsayimlar));
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bir bölüm `await` edilmezse ya da `bolum()` çağrısı silinirse test hiçbir şey ölçmeden
 * 0 ile çıkar — koşucu da yakalayamaz (çıkış kodu 0, ✗ yok). Bu yaşandı (t95).
 * KONTROL EKLERKEN BU SAYIYI DA ARTIR. */
const BEKLENEN = 48;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
