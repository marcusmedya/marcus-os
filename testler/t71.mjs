/* ŞUBEYE ÖZEL İÇERİK — OLUŞTURMA VE ŞUBE SİLME
 *
 * Kapsam seçimi (`sadeceSubeler`) yalnızca düzenleme ekranındaydı: şubeye özel bir iş
 * açmak için önce kartı oluşturup sonra açıp Düzenle'ye girmek gerekiyordu. Artık
 * oluşturma formunda. Seçim baştan yapılabilir olunca iki tuzak doğuyor:
 *
 * 1. BAŞKA MARKANIN ŞUBESİ TAŞINMASIN. Formda önce şube seçilip sonra marka
 *    değiştirilirse, kart artık o markada karşılığı olmayan kimlikler taşır. Sonuç:
 *    HİÇBİR şubenin kullanamadığı içerik — her seçiciden kaybolur, hata da vermez.
 *
 * 2. ŞUBE SİLİNİRSE KİMLİK ÇIKARILIR — AMA KAPSAM AÇILMAZ. Kart birden çok şubeye
 *    kilitliyse silinen kimlik çıkarılır ve kart kalan şubelerde çalışmaya devam eder.
 *    Liste BOŞALACAKSA kimlik bırakılır.
 *
 *    KURAL DEĞİŞTİ — eskiden liste boşaltılıyor ve kart MARKA GENELİ oluyordu. Ölçüldü:
 *    "yalnızca Lara için hazırlanmış içerik" Lara silinince Merkez'de kullanılabilir
 *    hale geliyordu; içerik yanlış şubede paylaşılabilirdi. Artık kart kullanılamaz
 *    kalıyor ve `kapsamiKayipMi` bunu adı olan bir hale çevirip arayüzde gösteriyor.
 *    Ayrıntılı davranış testi: t76.
 *
 * Silmeden ÖNCE de uyarılıyor: kaç kartın yalnızca o şubeye açık olduğu söyleniyor.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
const { default: paylasimUcu } = await import("../api/paylasim.js");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
import { kullanabilenSubeler } from "../lib/sube-kullanimi.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve()
    .then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const SUBELER = [
  { id: "lara", ad: "Smell Lara", clientId: 1 },
  { id: "mrkz", ad: "Smell Merkez", clientId: 1 },
  { id: "baska", ad: "Başka Şube", clientId: 2 },
];

const taban = () => ({
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }, { id: 2, ad: "Başka Marka", durum: "aktif" }],
  subeler: JSON.parse(JSON.stringify(SUBELER)),
  cekimIsleri: [
    { id: 1, marka: "Smell Coffee", kategori: "Video", icerikTuru: "Yalnızca Lara", asama: "Onaylandı", sadeceSubeler: ["lara"] },
    { id: 2, marka: "Smell Coffee", kategori: "Video", icerikTuru: "İki Şube", asama: "Onaylandı", sadeceSubeler: ["lara", "mrkz"] },
    { id: 3, marka: "Smell Coffee", kategori: "Video", icerikTuru: "Marka Geneli", asama: "Onaylandı" },
  ],
  haftalikPaylasimlar: [],
  stoklar: {}, paylasimGecmisi: [],
});

const oku = async () => (await kv.get("marcus-os-data")) || {};
const sifirla = async () => { await kv.set("marcus-os-data", taban()); };
const gonder = (govde) => cagir(paylasimUcu, { method: "POST", headers: OWNER, body: { ...govde, islemId: `t71_${Math.random().toString(36).slice(2, 12)}` } });

/* ---------------------------------------------------------------- */
await bolum("1) SİLME UYARISI — kaç kart etkilenecek söyleniyor", 4, async () => {
  await sifirla();
  const r = await gonder({ action: "subeSil", subeId: "lara" });
  t("planı olmayan ama kart kilitleyen şube uyarı veriyor", r.kod === 409, "gelen: " + r.kod);
  t("kaç kart kilitli söyleniyor", r.govde.kilitliKartSayisi === 2, "gelen: " + r.govde.kilitliKartSayisi);
  t("onay gerektiği bildiriliyor", r.govde.onayGerekli === true);
  t("şube HENÜZ silinmedi", (await oku()).subeler.length === 3);
});

/* ---------------------------------------------------------------- */
await bolum("2) ONAYLI SİLME — kilitli kartlar sahipsiz kalmıyor", 6, async () => {
  await sifirla();
  const r = await gonder({ action: "subeSil", subeId: "lara", onayliSil: true });
  t("silme başarılı", r.kod === 200);

  const veri = await oku();
  const kart = (id) => veri.cekimIsleri.find((j) => j.id === id);

  t("yalnızca o şubeye açık kartın kimliği BIRAKILDI",
    JSON.stringify(kart(1).sadeceSubeler) === '["lara"]',
    JSON.stringify(kart(1).sadeceSubeler) + " — boşaltılsaydı kart marka geneline açılırdı");
  t("iki şubeli kartta yalnızca silinen çıkarıldı",
    JSON.stringify(kart(2).sadeceSubeler) === JSON.stringify(["mrkz"]),
    JSON.stringify(kart(2).sadeceSubeler));
  t("marka geneli karta dokunulmadı", kart(3).sadeceSubeler === undefined);

  /* ASIL MESELE: kart hâlâ bir şubede kullanılabiliyor mu? */
  const kalanSubeler = veri.subeler;
  t("eski kilitli kart HİÇBİR şubede kullanılamıyor",
    kullanabilenSubeler(kart(1), kalanSubeler, 1).length === 0,
    "kapsam açılırsa içerik yanlış şubede paylaşılabilir — kasıtlı olarak kapalı");
  t("iki şubeli kart hâlâ Merkez'de kullanılabiliyor",
    kullanabilenSubeler(kart(2), kalanSubeler, 1).map((s) => s.id).join(",") === "mrkz");
});

/* ---------------------------------------------------------------- */
await bolum("3) BAŞKA MARKANIN ŞUBESİ — kart hiçbir yerde kaybolmuyor", 3, async () => {
  const veri = taban();
  /* Formda marka değişince seçim sıfırlanıyor; yine de sunucudaki kural sınanmalı:
   * başka markanın şube kimliğini taşıyan kart o markada hiçbir şubeye düşmez. */
  const yanlisKart = { id: 9, marka: "Smell Coffee", kategori: "Video", sadeceSubeler: ["baska"] };
  t("başka markanın şubesi bu markada eşleşmiyor",
    kullanabilenSubeler(yanlisKart, veri.subeler, 1).length === 0);
  t("marka geneli kart tüm şubeleri görüyor",
    kullanabilenSubeler({ id: 8, marka: "Smell Coffee" }, veri.subeler, 1).length === 2);
  t("boş sadeceSubeler = marka geneli",
    kullanabilenSubeler({ id: 7, sadeceSubeler: [] }, veri.subeler, 1).length === 2,
    "silme sonrası kartlar bu durumda kalıyor — hepsi görmeli");
});

/* ---------------------------------------------------------------- */
await bolum("4) PLANI OLAN ŞUBE — eski uyarı korunuyor", 3, async () => {
  await sifirla();
  const veri = await oku();
  veri.haftalikPaylasimlar = [{ id: "p1", clientId: 1, isId: 3, subeId: "mrkz", subeAdi: "Smell Merkez", gun: "Pzt", tur: "Video", yapildi: true }];
  await kv.set("marcus-os-data", veri);

  const r = await gonder({ action: "subeSil", subeId: "mrkz" });
  t("plan varsa yine uyarı", r.kod === 409);
  t("plan sayısı bildiriliyor", r.govde.planSayisi === 1 && r.govde.paylasilanSayisi === 1);

  const onayli = await gonder({ action: "subeSil", subeId: "mrkz", onayliSil: true });
  t("onaylanınca geçmiş korunuyor",
    onayli.kod === 200 && (await oku()).haftalikPaylasimlar.length === 1);
});

/* ---------------------------------------------------------------- */
await bolum("5) HİÇ ETKİSİ OLMAYAN ŞUBE — gereksiz onay istenmiyor", 2, async () => {
  await sifirla();
  const veri = await oku();
  veri.subeler.push({ id: "bos", ad: "Boş Şube", clientId: 1 });
  await kv.set("marcus-os-data", veri);

  const r = await gonder({ action: "subeSil", subeId: "bos" });
  t("kartı ve planı olmayan şube doğrudan siliniyor", r.kod === 200, "gelen: " + r.kod);
  t("diğer kartlar bozulmadı",
    (await oku()).cekimIsleri.filter((j) => Array.isArray(j.sadeceSubeler)).length === 2);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
