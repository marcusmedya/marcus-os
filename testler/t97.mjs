/* OPERASYON ALT YETKİLERİ — KART AÇMA / ONAYLAMA / DÜZENLEME / SİLME
 *
 * `cekimEdit` tek parçaydı. Onaylama, silme ve düzenleme ekranda yalnızca yöneticiye
 * gösteriliyordu **ama sunucu hiç denetlemiyordu**: `PERMISSION_WRITE_FIELDS` yalnızca
 * "cekimIsleri alanına yazabilir mi" diye bakıyor, hangi kartın silindiğine bakmıyordu.
 * Yani "yalnızca yönetici onaylar" gizli bir düğmeydi, güvenlik sınırı değil.
 *
 * BU TESTİN ASIL İŞİ:
 *   1. SUNUCU GERÇEKTEN DENETLİYOR. Ekranı atlayıp doğrudan istek atan bir personel
 *      onaylayamamalı/silememeli. Sınırın tek gerçek yeri burası.
 *   2. İZİNSİZ ONAY STOK ÜRETMİYOR. Onay stok yazıyor ve Drive'da dosya taşıyor; geri
 *      alma stok motorundan SONRA çalışsaydı yan etkiler kalırdı.
 *   3. KAYDIN TAMAMI REDDEDİLMİYOR. Aynı kayıttaki yetkili düzenlemeler korunmalı —
 *      reddetmek kullanıcının ilgisiz emeğini çöpe atardı.
 *   4. VAR OLAN HESAPLAR BOZULMUYOR. `kartAcma` varsayılan açık; bu yetki eklenmeden
 *      önce Operasyon izni olan herkes kart açabiliyordu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import {
  izinsizKartDegisiklikleriniGeriAl, yetkiVar, geriAlmaMesaji,
  ONAY_ASAMALARI, DUZENLEME_ALANLARI,
} from "../lib/kart-yetkisi.js";
import { izinleriDaralt, KILITLI_IZINLER } from "../lib/marka-kilidi.js";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import crypto from "node:crypto";
const { default: veriUcu } = await import("../api/data.js");

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

const KART = (ek = {}) => ({
  id: 1, marka: "Smell Coffee", kategori: "Reels", icerikTuru: "Reels 1",
  asama: "Kontrol Bekliyor", kameraman: "onder", editor: "onder",
  medya: [{ slot: "1", versiyon: 1, dosyaId: "D1" }], ...ek,
});

/* ---------------------------------------------------------------- */
await bolum("1) YETKİSİZ PERSONEL — geri alınıyor", 6, () => {
  const eski = [KART(), KART({ id: 2, asama: "Edit Yapılıyor" })];
  const yeni = [KART({ asama: "Onaylandı" })];   // 1 onaylandı, 2 silindi
  const r = izinsizKartDegisiklikleriniGeriAl(eski, yeni, {});
  t("onay geri alındı", r.isler.find((j) => j.id === 1).asama === "Kontrol Bekliyor",
    "izinsiz onay stok üretir ve Drive'da dosya taşır");
  t("silinen kart geri kondu", r.isler.some((j) => j.id === 2),
    "kart geri gelmezse veri sessizce kaybolur");
  t("kart sayısı korundu", r.isler.length === 2);
  t("iki sebep de bildirildi",
    new Set(r.geriAlinanlar.map((x) => x.sebep)).size === 2);
  t("mesaj üretiliyor", geriAlmaMesaji(r.geriAlinanlar).includes("onaylama"));
  t("boş listede mesaj yok", geriAlmaMesaji([]) === "");
});

/* ---------------------------------------------------------------- */
await bolum("2) YETKİLİ PERSONEL — dokunulmuyor", 4, () => {
  const eski = [KART(), KART({ id: 2 })];
  const yeni = [KART({ asama: "Onaylandı" })];
  const izin = { kartOnaylama: true, kartSilme: true, kartAcma: true, kartDuzenleme: true };
  const r = izinsizKartDegisiklikleriniGeriAl(eski, yeni, izin);
  t("onay duruyor", r.isler.find((j) => j.id === 1).asama === "Onaylandı");
  t("silme uygulandı", !r.isler.some((j) => j.id === 2));
  t("geri alınan yok", r.geriAlinanlar.length === 0);
  t("Teslim Edildi de onay sayılıyor", ONAY_ASAMALARI.includes("Teslim Edildi"),
    "sayılmazsa personel Onaylandı'yı atlayıp doğrudan teslime geçebilir");
});

/* ---------------------------------------------------------------- */
await bolum("3) GÜNLÜK İŞ ENGELLENMİYOR", 5, () => {
  const eski = [KART()];
  /* Aşama ilerletme, medya yükleme, yorum — bunlar `cekimEdit`in kendisi. Alt yetkiler
   * bunları engelleseydi Operasyon izni işlevsiz kalırdı. */
  const r = izinsizKartDegisiklikleriniGeriAl(eski,
    [KART({ asama: "Edit Yapılıyor", medya: [{ slot: "1", versiyon: 2, dosyaId: "D2" }], yorumlar: [{ id: "y1" }] })], {});
  const kart = r.isler[0];
  t("onay OLMAYAN aşama değişimi serbest", kart.asama === "Edit Yapılıyor",
    "engellenseydi personel hiçbir kartı ilerletemezdi");
  t("medya yüklemesi duruyor", kart.medya[0].dosyaId === "D2",
    "medya düzenleme sayılsaydı yüklenen dosya geri alınırdı");
  t("yorum duruyor", Array.isArray(kart.yorumlar) && kart.yorumlar.length === 1);
  t("geri alma yok", r.geriAlinanlar.length === 0);
  t("aşama/medya düzenleme alanı DEĞİL",
    !DUZENLEME_ALANLARI.includes("asama") && !DUZENLEME_ALANLARI.includes("medya"));
});

/* ---------------------------------------------------------------- */
await bolum("4) DÜZENLEME — yalnızca kimlik alanları", 5, () => {
  const eski = [KART()];
  const r = izinsizKartDegisiklikleriniGeriAl(eski,
    [KART({ marka: "Başka Marka", icerikTuru: "Reels 9", kameraman: "başkası" })], {});
  const kart = r.isler[0];
  t("marka geri alındı", kart.marka === "Smell Coffee");
  t("içerik türü geri alındı", kart.icerikTuru === "Reels 1");
  t("sorumlu geri alındı", kart.kameraman === "onder");
  t("hangi alanlar bildirildi", (r.geriAlinanlar[0].alanlar || []).length === 3);

  /* Boş dize ile tanımsız aynı sayılmalı: form dokunulmamış alanı "" olarak geri
   * gönderebiliyor ve bu düzenleme olmadığı hâlde geri alma tetikliyordu. */
  const bos = izinsizKartDegisiklikleriniGeriAl(
    [KART({ cekimTarihi: undefined })], [KART({ cekimTarihi: "" })], {});
  t("boş dize sahte düzenleme saymıyor", bos.geriAlinanlar.length === 0,
    "sayarsa personel hiçbir kaydı yapamaz, her kayıt 'düzenleme' olur");
});

/* ---------------------------------------------------------------- */
await bolum("5) KART AÇMA — varsayılan AÇIK", 4, () => {
  t("tanımsızsa açık", yetkiVar({}, "kartAcma") === true,
    "bu yetkiden önce Operasyon izni olan herkes kart açabiliyordu");
  t("diğerleri tanımsızsa kapalı",
    yetkiVar({}, "kartOnaylama") === false && yetkiVar({}, "kartSilme") === false);
  const r = izinsizKartDegisiklikleriniGeriAl([KART()], [KART(), KART({ id: 9 })], {});
  t("yeni kart açılabiliyor", r.isler.length === 2);
  const kapali = izinsizKartDegisiklikleriniGeriAl([KART()], [KART(), KART({ id: 9 })], { kartAcma: false });
  t("kapatılınca yeni kart eklenmiyor", kapali.isler.length === 1);
});

/* ---------------------------------------------------------------- */
await bolum("6) MARKA KİLİTLİ HESAP KART AÇABİLİYOR", 3, () => {
  /* `izinleriDaralt` listede olmayan HER izni sıfırlıyor. Alt yetkiler listeye
   * eklenmeseydi marka kilitli hesap `cekimEdit` açık olduğu hâlde kart açamaz hâle
   * gelirdi — bugün açabiliyor, davranış bozulmamalı. */
  ["kartAcma", "kartOnaylama", "kartDuzenleme", "kartSilme"].forEach((a) => {
    if (!KILITLI_IZINLER.includes(a)) { k++; console.log(`  ✗ ${a} KILITLI_IZINLER'de yok`); }
  });
  const daraltilmis = izinleriDaralt({ cekimEdit: true, kartAcma: true, kartOnaylama: true, finans: true }, true);
  t("kart açma korunuyor", daraltilmis.kartAcma === true,
    "sıfırlansaydı çözüm ortağı kart açamazdı");
  t("verilen onay yetkisi korunuyor", daraltilmis.kartOnaylama === true);
  t("ajans geneli izin yine sıfırlanıyor", daraltilmis.finans === false,
    "listeye eklerken daraltmayı gevşetmemiş olmalıyız");
});

/* ---------------------------------------------------------------- */
await bolum("7) SÜRÜM SAYACI BOŞUNA ARTMIYOR", 2, () => {
  const eski = [KART()];
  const ayni = izinsizKartDegisiklikleriniGeriAl(eski, eski, {});
  t("değişiklik yoksa AYNI referans", ayni.isler === eski,
    "yeni dizi üretmek dokunulmamış kartlarda çalışan herkesi 409'a düşürür");
  const degisti = izinsizKartDegisiklikleriniGeriAl(eski, [KART({ asama: "Onaylandı" })], {});
  t("geri alınınca yeni referans", degisti.isler !== eski);
});

/* ---------------------------------------------------------------- */
/* UCA GERÇEK İSTEK — saf modülün doğru olması yetmez, BAĞLANMIŞ olması gerekir.
 * Bu projede daha önce doğru yazılmış bir mantık uca hiç bağlanmadığı için çalışmıyordu. */
const KEY = "marcus-os-data";
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
const PERSONEL = { "x-staff-username": "personel", "x-staff-password": "pw", "content-type": "application/json" };

const sifirla = (izinler) => kv.set(KEY, {
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }],
  cekimIsleri: [KART(), KART({ id: 2, asama: "Edit Yapılıyor", icerikTuru: "Reels 2" })],
  subeler: [], stoklar: {}, paylasimGecmisi: [], haftalikPaylasimlar: [],
  personelHesaplari: [{
    id: "p1", ad: "Personel", kullaniciAdi: "personel",
    sifreSalt: "tuz", sifreHash: hash("pw", "tuz"),
    izinler: { cekimEdit: true, ...izinler },
  }],
  _alanSurumleri: {},
});

const kaydet = async (isler) => {
  const d = await kv.get(KEY);
  return cagir(veriUcu, {
    method: "POST", headers: PERSONEL, query: {},
    body: { data: { cekimIsleri: isler }, _v: d._v,
            degisenAlanlar: ["cekimIsleri"], alanSurumleri: d._alanSurumleri || {} },
  });
};

await bolum("8) UÇ: EKRANI ATLAYAN PERSONEL ONAYLAYAMIYOR", 5, async () => {
  await sifirla({});
  const r = await kaydet([KART({ asama: "Onaylandı" }), KART({ id: 2, asama: "Edit Yapılıyor", icerikTuru: "Reels 2" })]);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const veri = await kv.get(KEY);
  t("aşama geri alındı", veri.cekimIsleri.find((j) => j.id === 1).asama === "Kontrol Bekliyor",
    `bulunan ${veri.cekimIsleri.find((j) => j.id === 1).asama} — sunucu denetlemiyorsa gizli düğmenin anlamı yok`);
  t("STOK ÜRETİLMEDİ", Object.keys(veri.stoklar || {}).length === 0,
    "geri alma stok motorundan sonra çalışsaydı stok yazılırdı");
  t("kart onaylı sayılmadı", veri.cekimIsleri.find((j) => j.id === 1).stokSayildi !== true);
  t("kullanıcı uyarıldı", !!(r.govde && r.govde.yetkiUyarisi),
    "sessiz geri alma kullanıcıya 'kaydettim' dedirtir");
});

await bolum("9) UÇ: YETKİ VERİLİNCE ÇALIŞIYOR", 3, async () => {
  await sifirla({ kartOnaylama: true });
  const r = await kaydet([KART({ asama: "Onaylandı" }), KART({ id: 2, asama: "Edit Yapılıyor", icerikTuru: "Reels 2" })]);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  const veri = await kv.get(KEY);
  t("onay uygulandı", veri.cekimIsleri.find((j) => j.id === 1).asama === "Onaylandı");
  t("stok üretildi", Object.keys(veri.stoklar || {}).length > 0,
    "yetkili onay stoğu yazmalı — yoksa yetki verilmiş ama iş yapılmamış olur");
});

await bolum("10) UÇ: İLGİSİZ DÜZENLEME KORUNUYOR", 3, async () => {
  /* Aynı kayıtta hem yetkisiz bir onay hem yetkili bir aşama ilerletmesi var.
   * Kaydın tamamı reddedilseydi personelin ilerletmesi de kaybolurdu. */
  await sifirla({});
  const r = await kaydet([
    KART({ asama: "Onaylandı" }),                                            // yetkisiz
    KART({ id: 2, asama: "Kontrol Bekliyor", icerikTuru: "Reels 2" }),       // yetkili
  ]);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  const veri = await kv.get(KEY);
  t("yetkisiz onay geri alındı", veri.cekimIsleri.find((j) => j.id === 1).asama === "Kontrol Bekliyor");
  t("yetkili ilerletme KORUNDU", veri.cekimIsleri.find((j) => j.id === 2).asama === "Kontrol Bekliyor",
    "tüm kayıt reddedilseydi bu da kaybolurdu");
});

await bolum("11) UÇ: YETKİSİZ SİLME", 2, async () => {
  await sifirla({});
  const r = await kaydet([KART()]);   // 2 numaralı kart yok
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  const veri = await kv.get(KEY);
  t("silinen kart geri kondu", veri.cekimIsleri.some((j) => j.id === 2),
    "sunucu denetlemiyorsa personel her kartı silebilir");
});

/* Çalışan kontrol sayısı sabitle karşılaştırılıyor: t95 bir kez bölümler `await`
 * edilmediği için hiç çalışmadı ve "0 kaldı" deyip BAŞARIYLA çıktı. */
const BEKLENEN = 42;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
