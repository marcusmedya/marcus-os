/* ------------------------------------------------------------------ */
/* BİRLEŞİK FİNANS HAREKETLERİ — tek normalleştirilmiş kayıt biçimi     */
/* ------------------------------------------------------------------ */
/**
 * Belgedeki para kayıtları bugün ON BEŞ ayrı listede ve HER BİRİ FARKLI ŞEKİLLİ duruyor:
 * kimi `ay` taşıyor, kimi `tarih`, kimi hiçbiri; kimi `kalem` diyor, kimi `kisiAd`.
 * Her ekran kendi listesini kendi kuralıyla topluyor. Bu modül o listelerin ÜSTÜNE tek
 * bir kayıt biçimi koyar — aşağıya değil: mevcut hesapların hiçbiri değişmedi ve burada
 * HİÇBİR RAKAM YENİDEN HESAPLANMADI.
 *
 * NEDEN "YENİDEN HESAPLAMA" YASAK (para.md): "aynı dönemi iki ekran farklı toplarsa
 * hangisinin doğru olduğu sorusu cevapsız kalır." Bu yüzden:
 *   · ayı çözen kural `lib/para-hareketleri.js` → `kaydinAyi` (kopyalanmadı, İMPORT edildi)
 *   · freelancer hak edişi `lib/is-ucreti.js` → `isUcretiHesapla` (aynı şekilde)
 *   · KDV oranı KODA GÖMÜLMEDİ; kayıtta hesaplanmış bir KDV varsa taşınır, yoksa `null`.
 *
 * SAF: `Date`, `Math.random`, `process.env`, `window`, ağ YOK. Girdi DEĞİŞTİRİLMEZ, her
 * çağrı yeni nesneler döndürür. Dönüş değeri atılırsa hiçbir şey olmaz (denetim 24).
 *
 * ----------------------------------------------------------------------------
 * BU KATMANIN BEŞ AYRIMI — karıştırılırsa aynı para iki kez sayılır
 *
 *   tahsilat ≠ gelir ≠ fatura   `odemeKayitlari` tahsilattır (kasaya giren para),
 *                               `gelirKalemleri` gelirdir (hak edilen), `faturalar`
 *                               ise o bedelin BELGELENEN kısmı. Üçü ayrı kavram.
 *   gider ≠ ödeme               `giderKalemleri`/`ofisGiderleri`/`maliyetler` giderdir
 *                               (kaydedilen bedel), `personelOdemeleri`/`avanslar` ise
 *                               ödemedir (kasadan çıkan para). Avans `kategori: "avans"`
 *                               taşır ve İKİNCİ KEZ gider sayılmaz — maaş zaten gider.
 *   hak ediş ≠ ödeme            Freelancer'ın hak ettiği (`hakedis`) ile ona ödenen
 *                               (`odeme`) ayrı hareketlerdir; toplamda birleştirilmez.
 *   transfer ne gelir ne gider  Hesaplar arası aktarım şirketin parasını değiştirmez;
 *                               `tur: "transfer"` ve hiçbir gelir/gider toplamına girmez.
 *   `monthly` HAREKET DEĞİLDİR  "Ayı kapat" ile yazılmış ESKİ DÖNEM FOTOĞRAFI. Buradan
 *                               hareket üretmek, aynı ayı bir kez kayıtlardan bir kez
 *                               fotoğraftan saymak olurdu. Hiç dokunulmuyor.
 *
 * ----------------------------------------------------------------------------
 * TARİH — ÜÇ FARKLI HÂL VAR VE ÜÇÜ DE GİZLENMİYOR
 *
 *  1. Çözülebilir tarih: `tarih`in ayı, yoksa `ay` alanı (`kaydinAyi`). `donem` dolar.
 *  2. Hiç tarihi olmayan kayıt: `gelirKalemleri`, `giderKalemleri`, `ofisGiderleri`,
 *     `clients[].maliyetler`, `personel`, `uyelikler`, `bekleyenTahsilatlar`. Bunlar
 *     TEKRAR EDEN TANIMLAR; belgede ay ay geçmişleri YOK (`lib/aylik-ozet.js` aynı şeyi
 *     söylüyor). Hareket yine üretilir, `donem: null` olur, `tarihsiz` sayacına girer.
 *  3. Çözülemeyen tarih: `hesapTransferleri` tarihi EKRAN biçiminde tutuyor
 *     ("20.09.2026"), `vergiTakvimi` ise serbest metin ("26 Ağu"). İkisi de döneme
 *     yazılamaz. Kayıt SİLİNMEZ; `donem: null`, `eksikBilgi: ["tarih"]` ve `uyarilar`da
 *     kaynağıyla birlikte bildirilir.
 *
 * `tarih` alanı NORMALLEŞTİRİLMİŞ biçimdedir ("YYYY-AA-GG" ya da "YYYY-AA"). Çözülemeyen
 * ham metin burada TAŞINMAZ: tek alanda iki biçim tutmak, bir sonraki katmanda yine
 * tahmin ettirir. "Eksik dökümü tam gibi göstermek hiç göstermemekten kötüdür."
 *
 * ----------------------------------------------------------------------------
 * KİMLİK KARARLIDIR — migrasyonun kopya üretmemesinin temeli
 *
 * `id` rastgele DEĞİL, `kaynakAlan` + `kaynakId`den türetilir: aynı belge iki kez
 * verilince aynı kimlikler çıkar. İç içe kayıtlarda (`clients[].odemeKayitlari` gibi)
 * `kaynakId` ÜST KAYDIN kimliğini de taşır (`"3/7"` = 3 numaralı markanın 7 numaralı
 * kaydı) — yoksa iki markanın 7 numaralı kaydı aynı kimliği alırdı. Kaydın kendi `id`si
 * hiç yoksa sıradaki yeri kullanılır (`"3/s0"`) ve `eksikBilgi`ye `"kaynakId"` yazılır:
 * o kimlik kaydın kendisine değil, SIRASINA bağlıdır ve liste değişirse kayar.
 */
import { kaydinAyi, kaydinTarihi } from "./para-hareketleri.js";
import { isTeslimTarihi, isUcretiHesapla } from "./is-ucreti.js";

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();
const sayi = (x) => Number(x) || 0;
const doluMetin = (x) => metin(x) || null;
const dizi = (x) => (Array.isArray(x) ? x : []);

/** Üst kayıt ile alt kaydı ayıran işaret — `kaynakId` içinde "3/7" biçimini üretir. */
export const ALT_AYRAC = "/";

/** Hareket kimliği: kaynak alan + kaynak kimlik. Rastgelelik YOK, tahmin YOK. */
export function hareketKimligi(kaynakAlan, kaynakId) {
  return `${kaynakAlan}#${kaynakId}`;
}

/** Dönüştürülen kaynakların TAM listesi. Yeni bir kaynak eklendiğinde buraya da yazılır;
 * test bu listeyi dolaşıp her birinden hareket çıktığını sınıyor. */
export const KAYNAKLAR = [
  "clients.odemeKayitlari",
  "clients.faturalar",
  "clients.maliyetler",
  "gelirKalemleri",
  "giderKalemleri",
  "ofisGiderleri",
  "bekleyenTahsilatlar",
  "personelOdemeleri",
  "avanslar",
  "hesapTransferleri",
  "hesapDuzeltmeleri",
  "vergiTakvimi",
  "uyelikler",
  "personel",
  "cekimIsleri",
];

/** Üretilen hareket türleri. */
export const TURLER = [
  "tahsilat", "fatura", "gelir", "gider", "odeme", "hakedis",
  "transfer", "duzeltme", "bekleyen", "vergi",
];

/** Gelir/gider toplamlarına HİÇ girmeyen türler — aynı parayı ikinci kez saydırırlar. */
export const TOPLAMA_GIRMEYEN = ["transfer", "duzeltme", "bekleyen", "vergi", "fatura"];

/* KDV/stopaj yalnızca VERGİYE KONU hareketlerde aranır. Bir hesap transferinin ya da
 * bakiye düzeltmesinin KDV'si yoktur; "eksik" demek orada gürültüden başka bir şey
 * üretmez ve gerçekten eksik olanları görünmez kılar. */
const VERGILI_TURLER = new Set(["tahsilat", "fatura", "gelir", "gider", "odeme", "hakedis"]);

/* Para hareketinin hangi hesaptan geçtiği bilgisi YALNIZCA bu türlerde beklenir. */
const HESAPLI_TURLER = new Set(["tahsilat", "odeme", "transfer", "duzeltme"]);

/** Kayıtta hesaplanmış bir KDV varsa onu taşır. YOKSA null — oran koda gömülmez. */
function kayitliKdv(kayit) {
  if (!kayit) return null;
  const ham = kayit.kdv !== undefined ? kayit.kdv : kayit.kdvTutari;
  return (ham === undefined || ham === null || ham === "") ? null : sayi(ham);
}

/** Kayıtta stopaj varsa taşır, yoksa null. */
function kayitliStopaj(kayit) {
  if (!kayit) return null;
  const ham = kayit.stopaj !== undefined ? kayit.stopaj : kayit.stopajTutari;
  return (ham === undefined || ham === null || ham === "") ? null : sayi(ham);
}

/** Normalleştirilmiş tarih ("YYYY-AA-GG" ya da "YYYY-AA") — çözülemezse null. */
function cozulmusTarih(kayit) {
  return doluMetin(kaydinTarihi(kayit || {}));
}

/**
 * TEK HAREKET ÜRETİCİ — bütün kaynaklar buradan geçer.
 * Alan listesi tek yerde durur; bir kaynak eksik alan yazarsa fark edilir.
 */
function hareketYap(p) {
  const eksikBilgi = [...(p.eksikBilgi || [])];

  const donem = p.donem === undefined ? null : p.donem;
  const tarih = p.tarih === undefined ? null : p.tarih;
  if (!donem && !eksikBilgi.includes("tarih")) eksikBilgi.push("tarih");

  const tutar = p.tutar === undefined ? null : p.tutar;
  if (tutar === null && !eksikBilgi.includes("tutar")) eksikBilgi.push("tutar");

  const kdv = p.kdv === undefined ? null : p.kdv;
  const stopaj = p.stopaj === undefined ? null : p.stopaj;
  if (VERGILI_TURLER.has(p.tur)) {
    if (kdv === null) eksikBilgi.push("kdv");
    if (stopaj === null) eksikBilgi.push("stopaj");
  }

  const hesapId = p.hesapId === undefined || p.hesapId === null || p.hesapId === ""
    ? null : p.hesapId;
  if (hesapId === null && HESAPLI_TURLER.has(p.tur)) eksikBilgi.push("hesapId");

  const kisi = p.kisi === undefined ? null : p.kisi;
  if (kisi === null && (p.tur === "odeme" || p.tur === "hakedis")) eksikBilgi.push("kisi");

  return {
    id: hareketKimligi(p.kaynakAlan, p.kaynakId),
    tur: p.tur,
    kaynakAlan: p.kaynakAlan,
    kaynakId: p.kaynakId,
    tarih,
    donem,
    tutar,
    kdv,
    stopaj,
    kisi,
    kategori: p.kategori === undefined ? null : p.kategori,
    hesapId,
    durum: p.durum === undefined ? null : p.durum,
    aciklama: p.aciklama === undefined ? null : p.aciklama,
    eksikBilgi,
    donusturuldu: p.donusturuldu,
  };
}

/** Bir kaydın kararlı anahtarı: kendi `id`si, yoksa listedeki SIRASI (`"s3"`).
 * Sıraya düşmek kimliği listeye bağlar; bu yüzden çağıran onu `eksikBilgi`ye yazar. */
export function kayitAnahtari(kayit, sira) {
  const ham = kayit && kayit.id !== undefined && kayit.id !== null && kayit.id !== ""
    ? metin(kayit.id) : null;
  return { anahtar: ham === null ? `s${sira}` : ham, kendiKimligiVar: ham !== null };
}

/** İç içe bir hareketin ÜST kaydının anahtarı ("3/7" → "3"). Mutabakat bunu kullanarak
 * bir hareketi hangi markanın ürettiğini, kimlik metnini kendi kurallarıyla yeniden
 * üretmeden bulur. */
export function ustKaynak(hareket) {
  return String((hareket && hareket.kaynakId) || "").split(ALT_AYRAC)[0];
}

/** Bir listeden kaynak kimliği üretir: kaydın kendi `id`si, yoksa sırası. */
function kaynakKimligi(kayit, sira, on) {
  const { anahtar, kendiKimligiVar } = kayitAnahtari(kayit, sira);
  return {
    kaynakId: on === null ? anahtar : `${on}${ALT_AYRAC}${anahtar}`,
    eksik: kendiKimligiVar ? [] : ["kaynakId"],
  };
}

/**
 * BELGEDEKİ BÜTÜN PARA KAYITLARINI TEK BİÇİME ÇEVİRİR.
 *
 * @param data                  Uygulama belgesi (DEĞİŞTİRİLMEZ)
 * @param donusturulmeTarihi    "YYYY-AA-GG" — dışarıdan verilir. Modül `new Date()`
 *                              ÇAĞIRMAZ: saflık şartı, denetim 24 ve t107 yöntemi bunu
 *                              ölçüyor. Verilmezse `donusturuldu: null` olur ve uyarı yazılır.
 * @returns { hareketler, tarihsiz, uyarilar }
 */
export function finansHareketleri(data, { donusturulmeTarihi } = {}) {
  const belge = data && typeof data === "object" ? data : {};
  const donusturuldu = doluMetin(donusturulmeTarihi);
  const hareketler = [];
  const uyarilar = [];
  /* Kaynak bazlı "tarihi ÇÖZÜLEMEDİ" sayacı — hiç tarihi olmayan tanımlardan ayrı
   * tutuluyor, çünkü ikisi farklı sorun: biri veride yok, öteki okunamıyor. */
  const cozulemeyen = new Map();
  const cozulemeyenEkle = (alan) => cozulemeyen.set(alan, (cozulemeyen.get(alan) || 0) + 1);

  if (!donusturuldu) {
    uyarilar.push("Dönüştürülme tarihi verilmedi — hareketlerin `donusturuldu` alanı boş kaldı.");
  }

  const ekle = (p) => { hareketler.push(hareketYap({ ...p, donusturuldu })); };

  /* ── 1 · MARKA ALTINDAKİ ÜÇ LİSTE ──────────────────────────────────────────
   * MARKA DURUMU SÜZGECİ YOK. Ayrılmış ya da dondurulmuş markanın geçmiş kayıtları
   * KORUNUR: "alınan para alınmıştır" (para.md, `tahsilatDokumu` da aynı kuralda). */
  dizi(belge.clients).forEach((c, ci) => {
    if (!c) return;
    const markaKimligi = kayitAnahtari(c, ci).anahtar;
    const markaAdi = doluMetin(c.ad);

    dizi(c.odemeKayitlari).forEach((k, i) => {
      if (!k) return;
      const { kaynakId, eksik } = kaynakKimligi(k, i, markaKimligi);
      const donem = kaydinAyi(k);
      if (!donem) cozulemeyenEkle("clients.odemeKayitlari");
      ekle({
        tur: "tahsilat", kaynakAlan: "clients.odemeKayitlari", kaynakId,
        tarih: cozulmusTarih(k), donem, tutar: sayi(k.tutar),
        kdv: kayitliKdv(k), stopaj: kayitliStopaj(k),
        kisi: markaAdi, kategori: null, hesapId: k.hesapId,
        durum: null, aciklama: doluMetin(k.not), eksikBilgi: eksik,
      });
    });

    dizi(c.faturalar).forEach((f, i) => {
      if (!f) return;
      const { kaynakId, eksik } = kaynakKimligi(f, i, markaKimligi);
      const donem = kaydinAyi(f);
      if (!donem) cozulemeyenEkle("clients.faturalar");
      ekle({
        tur: "fatura", kaynakAlan: "clients.faturalar", kaynakId,
        tarih: cozulmusTarih(f), donem, tutar: sayi(f.tutar),
        kdv: kayitliKdv(f), stopaj: kayitliStopaj(f),
        kisi: markaAdi, kategori: null, hesapId: null,
        durum: null, aciklama: doluMetin(f.no), eksikBilgi: eksik,
      });
    });

    /* Maliyet kaydının TARİHİ YOK (`COST_FIELDS` = kalem + tutar): aylık, tekrar eden
     * bir tanım. Döneme yazmak yalan üretir — yazılmıyor, sayılıyor. */
    dizi(c.maliyetler).forEach((m, i) => {
      if (!m) return;
      const { kaynakId, eksik } = kaynakKimligi(m, i, markaKimligi);
      ekle({
        tur: "gider", kaynakAlan: "clients.maliyetler", kaynakId,
        tarih: null, donem: null, tutar: sayi(m.tutar),
        kdv: kayitliKdv(m), stopaj: kayitliStopaj(m),
        kisi: markaAdi, kategori: doluMetin(m.kalem), hesapId: null,
        durum: null, aciklama: null, eksikBilgi: eksik,
      });
    });
  });

  /* ── 2 · TARİHSİZ TANIM LİSTELERİ ───────────────────────────────────────── */
  const kalemListesi = (liste, kaynakAlan, tur) => dizi(liste).forEach((g, i) => {
    if (!g) return;
    const { kaynakId, eksik } = kaynakKimligi(g, i, null);
    ekle({
      tur, kaynakAlan, kaynakId,
      tarih: null, donem: null, tutar: sayi(g.tutar),
      kdv: kayitliKdv(g), stopaj: kayitliStopaj(g),
      kisi: null, kategori: doluMetin(g.kalem), hesapId: null,
      durum: null, aciklama: doluMetin(g.tekrar), eksikBilgi: eksik,
    });
  });
  kalemListesi(belge.gelirKalemleri, "gelirKalemleri", "gelir");
  kalemListesi(belge.giderKalemleri, "giderKalemleri", "gider");
  kalemListesi(belge.ofisGiderleri, "ofisGiderleri", "gider");

  /* Bekleyen tahsilat henüz GİRMEMİŞ paradır: ne gelir ne tahsilat. `vade` kaydın kendi
   * durum metni ("3 gün gecikti"), olduğu gibi taşınıyor — yorumlanmıyor. */
  dizi(belge.bekleyenTahsilatlar).forEach((b, i) => {
    if (!b) return;
    const { kaynakId, eksik } = kaynakKimligi(b, i, null);
    ekle({
      tur: "bekleyen", kaynakAlan: "bekleyenTahsilatlar", kaynakId,
      tarih: null, donem: null, tutar: sayi(b.tutar),
      kisi: doluMetin(b.musteri), kategori: null, hesapId: null,
      durum: doluMetin(b.vade), aciklama: null, eksikBilgi: eksik,
    });
  });

  /* ── 3 · KASADAN ÇIKAN PARA — ÖDEME ve AVANS ─────────────────────────────
   * İkisi de `tur: "odeme"`. Avans ayrıca `kategori: "avans"` taşır: bir ÖN ÖDEMEDİR,
   * maaş zaten gider olarak sayıldığı için ikinci kez gidere yazılmaz. */
  const odemeListesi = (liste, kaynakAlan, kategoriSabit) => dizi(liste).forEach((o, i) => {
    if (!o) return;
    const { kaynakId, eksik } = kaynakKimligi(o, i, null);
    const donem = kaydinAyi(o);
    if (!donem) cozulemeyenEkle(kaynakAlan);
    ekle({
      tur: "odeme", kaynakAlan, kaynakId,
      tarih: cozulmusTarih(o), donem, tutar: sayi(o.tutar),
      kdv: kayitliKdv(o), stopaj: kayitliStopaj(o),
      kisi: doluMetin(o.kisiAd),
      kategori: kategoriSabit || doluMetin(o.tur),
      hesapId: o.hesapId, durum: null, aciklama: doluMetin(o.not), eksikBilgi: eksik,
    });
  });
  odemeListesi(belge.personelOdemeleri, "personelOdemeleri", null);
  odemeListesi(belge.avanslar, "avanslar", "avans");

  /* ── 4 · HESAP HAREKETLERİ — GELİR/GİDER DEĞİL ──────────────────────────
   * Transfer şirketin parasını DEĞİŞTİRMEZ, yalnızca yerini. Bu yüzden İKİ hareket
   * üretiyor: bir hesaptan `cikis`, öbürüne `giris`. Tek hareket üretilseydi hedef
   * hesabın kimliği kayıt biçiminde duracak yer bulamaz, bakiye ondan türetilemezdi
   * (`hesapBakiyesi` giriş ve çıkışı ayrı ayrı sayıyor).
   *
   * İKİ BACAKTA DA TUTAR POZİTİFTİR; yön `kategori` ile taşınır. Eksi tutar yazmak,
   * yönü bazı türlerde işaretten bazılarında türden okunur hâle getirirdi. */
  dizi(belge.hesapTransferleri).forEach((tr, i) => {
    if (!tr) return;
    const { kaynakId, eksik } = kaynakKimligi(tr, i, null);
    const donem = kaydinAyi(tr);
    if (!donem) { cozulemeyenEkle("hesapTransferleri"); }
    const ortak = {
      tur: "transfer", kaynakAlan: "hesapTransferleri",
      tarih: cozulmusTarih(tr), donem, tutar: sayi(tr.tutar),
      kisi: null, durum: null,
      aciklama: `${metin(tr.kaynakHesapId) || "?"} → ${metin(tr.hedefHesapId) || "?"}`,
      eksikBilgi: eksik,
    };
    ekle({ ...ortak, kaynakId: `${kaynakId}${ALT_AYRAC}cikis`, kategori: "cikis", hesapId: tr.kaynakHesapId });
    ekle({ ...ortak, kaynakId: `${kaynakId}${ALT_AYRAC}giris`, kategori: "giris", hesapId: tr.hedefHesapId });
  });

  dizi(belge.hesapDuzeltmeleri).forEach((d, i) => {
    if (!d) return;
    const { kaynakId, eksik } = kaynakKimligi(d, i, null);
    const donem = kaydinAyi(d);
    if (!donem) cozulemeyenEkle("hesapDuzeltmeleri");
    ekle({
      tur: "duzeltme", kaynakAlan: "hesapDuzeltmeleri", kaynakId,
      tarih: cozulmusTarih(d), donem, tutar: sayi(d.tutar),
      kisi: null, kategori: null, hesapId: d.hesapId, durum: null,
      aciklama: doluMetin(d.not), eksikBilgi: eksik,
    });
  });

  /* ── 5 · VERGİ TAKVİMİ — TUTAR TAŞIMIYOR ────────────────────────────────
   * Kayıt `{ kalem, tarih, durum }`: tarihi serbest metin ("26 Ağu"), tutarı HİÇ YOK.
   * Sıfır yazmak gideri olduğundan düşük gösterirdi; `tutar: null` + `eksikBilgi`. */
  dizi(belge.vergiTakvimi).forEach((v, i) => {
    if (!v) return;
    const { kaynakId, eksik } = kaynakKimligi(v, i, null);
    const donem = kaydinAyi(v);
    if (!donem) cozulemeyenEkle("vergiTakvimi");
    const tutarVar = v.tutar !== undefined && v.tutar !== null && v.tutar !== "";
    ekle({
      tur: "vergi", kaynakAlan: "vergiTakvimi", kaynakId,
      tarih: cozulmusTarih(v), donem, tutar: tutarVar ? sayi(v.tutar) : null,
      kisi: null, kategori: doluMetin(v.kalem), hesapId: null,
      durum: doluMetin(v.durum), aciklama: null, eksikBilgi: eksik,
    });
  });

  /* ── 6 · ÜYELİKLER — TEKRAR EDEN GİDER TANIMI ───────────────────────────
   * `tutar` KAYITTAKİ tutardır. Yıllık üyeliğin "aylık karşılığı" (`tutar / 12`) burada
   * ÜRETİLMEZ: o kural arayüz katmanında (`computeLive`, üyelik ekranı) yaşıyor ve
   * üçüncü bir kopyasını yazmak para.md'nin yasakladığı ikinci kaynağı üretirdi.
   * Aynı sebeple EFEKTİF AKTİFLİK (`uyelikEfektifAktifMi`, bitiş tarihine bakar)
   * burada hesaplanmaz; yalnızca kaydın KENDİ `aktif` alanı taşınır. */
  let uyelikDurumsuz = 0;
  dizi(belge.uyelikler).forEach((u, i) => {
    if (!u) return;
    const { kaynakId, eksik } = kaynakKimligi(u, i, null);
    const durum = u.aktif === true ? "aktif" : u.aktif === false ? "pasif" : null;
    if (durum === null) uyelikDurumsuz += 1;
    ekle({
      tur: "gider", kaynakAlan: "uyelikler", kaynakId,
      tarih: null, donem: null, tutar: sayi(u.tutar),
      kdv: kayitliKdv(u), stopaj: kayitliStopaj(u),
      kisi: null, kategori: "uyelik", hesapId: null,
      durum, aciklama: doluMetin(u.ad),
      eksikBilgi: durum === null ? [...eksik, "durum"] : eksik,
    });
  });

  /* ── 7 · PERSONEL — AYLIK İŞVEREN MALİYETİ ──────────────────────────────
   * `computeLive` personel giderini DÖRT parçanın toplamı olarak sayıyor (maaş, sigorta,
   * yemek, tazminat birikimi). Burada da aynı dört parça toplanıyor; başka bir bileşim
   * seçmek iki ekranı ayrıştırırdı. Tarihi yok: aylık tanım. */
  dizi(belge.personel).forEach((p, i) => {
    if (!p) return;
    const { kaynakId, eksik } = kaynakKimligi(p, i, null);
    ekle({
      tur: "gider", kaynakAlan: "personel", kaynakId,
      tarih: null, donem: null,
      tutar: sayi(p.maas) + sayi(p.sigorta) + sayi(p.yemek) + sayi(p.tazminatBirikimi),
      kisi: doluMetin(p.ad), kategori: "personel", hesapId: null,
      durum: null, aciklama: doluMetin(p.pozisyon), eksikBilgi: eksik,
    });
  });

  /* ── 8 · FREELANCER HAK EDİŞİ ───────────────────────────────────────────
   * DÖNEM = İŞİN TESLİM EDİLDİĞİ AY (`lib/is-ucreti.js`). Teslim edilmemiş iş hak ediş
   * DOĞURMAZ — bu bir gizleme değil: o kayıt henüz para değil, devam eden bir iştir.
   * Sayısı `uyarilar`da bildiriliyor ki "neden bu iş listede yok" sorusu cevapsız kalmasın.
   *
   * Bir işte hem kameraman hem editör olabilir ve İKİSİ DE ayrı ücret alır; sıra
   * `listeninMaliyeti` ile birebir aynı (kameraman, editör) tutuluyor ki toplam
   * `sirketAylikIsMaliyeti` ile tutsun. */
  const ucretler = (belge.isUcretleri && typeof belge.isUcretleri === "object") ? belge.isUcretleri : {};
  const detaylar = (belge.isUcretDetaylari && typeof belge.isUcretDetaylari === "object") ? belge.isUcretDetaylari : {};
  let teslimsizIs = 0;
  dizi(belge.cekimIsleri).forEach((job, ji) => {
    if (!job) return;
    const teslim = isTeslimTarihi(job);
    if (!teslim) { teslimsizIs += 1; return; }
    const donem = kaydinAyi({ tarih: teslim });
    const { anahtar: isKimligi, kendiKimligiVar } = kayitAnahtari(job, ji);
    ["kameraman", "editor"].forEach((rol) => {
      const kisi = metin(job[rol]);
      if (!kisi) return;
      const varsayilan = sayi(ucretler[kisi]);
      const detay = detaylar[job.id] || null;
      /* Ne kişinin ücreti girilmiş ne de işe özel bir mod seçilmiş: tutar 0 yazılır ama
       * SESSİZ KALINMAZ — `sirketAylikIsMaliyeti` de bunu `eksikUcret` diye sayıyor. */
      const bilinmiyor = !varsayilan && !detay;
      if (!donem) cozulemeyenEkle("cekimIsleri");
      ekle({
        tur: "hakedis", kaynakAlan: "cekimIsleri",
        kaynakId: `${isKimligi}${ALT_AYRAC}${rol}`,
        tarih: teslim, donem,
        tutar: isUcretiHesapla(job, kisi, detay, varsayilan),
        kisi, kategori: rol, hesapId: null, durum: null,
        aciklama: doluMetin(job.marka),
        eksikBilgi: [
          ...(kendiKimligiVar ? [] : ["kaynakId"]),
          ...(bilinmiyor ? ["tutar"] : []),
        ],
      });
    });
  });

  /* ── UYARILAR — eksiklik SAYILIR ve SÖYLENİR ──────────────────────────── */
  cozulemeyen.forEach((adet, alan) => {
    uyarilar.push(`${alan}: ${adet} kaydın tarihi çözülemedi — döneme yazılamadı, kayıt korundu.`);
  });
  if (teslimsizIs > 0) {
    uyarilar.push(`cekimIsleri: ${teslimsizIs} iş henüz teslim edilmemiş — hak ediş doğmadı, hareket üretilmedi.`);
  }
  if (uyelikDurumsuz > 0) {
    uyarilar.push(`uyelikler: ${uyelikDurumsuz} kaydın aktiflik bilgisi elle girilmemiş — efektif durum bitiş tarihine bağlı ve bu katmanda hesaplanmıyor.`);
  }

  const tarihsiz = hareketler.reduce((s, h) => s + (h.donem ? 0 : 1), 0);

  /* SIRALAMA KARARLI: aynı belge iki kez verilince aynı sıra çıkar. Tarihsiz kayıtlar
   * sona düşer ama LİSTEDEN DÜŞMEZ. */
  hareketler.sort((a, b) => {
    const at = a.tarih || "9999-99-99";
    const bt = b.tarih || "9999-99-99";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { hareketler, tarihsiz, uyarilar };
}
