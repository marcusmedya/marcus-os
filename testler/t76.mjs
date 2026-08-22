/* ŞUBE SİLİNİNCE İÇERİK KAPSAMI AÇILMAZ
 *
 * ÖNCEKİ DAVRANIŞ — ölçüldü: kart `sadeceSubeler: ["lara"]` ile yalnızca Lara için
 * hazırlanmışken Lara silinince kimlik karttan çıkarılıyor, liste boşalıyordu.
 * `sadeceSubeler: []` bu sistemde "MARKA GENELİ" demek — yani "yalnızca Lara için
 * hazırlanmış içerik" bir anda markanın BÜTÜN şubelerinde kullanılabilir hale
 * geliyordu. İş mantığı açısından tehlikeli: içerik yanlış şubede paylaşılabilirdi.
 *
 * YENİ DAVRANIŞ: liste boşalacaksa kimlik BIRAKILIR. Kart hiçbir şubede kullanılamaz —
 * kasıtlı ve güvenli durum. Sessiz değil: `kapsamiKayipMi` bunu adı olan bir hale
 * çeviriyor ve Operasyon kartında uyarı olarak görünüyor. Kullanıcı kapsamı yeniden
 * seçince kart normale döner.
 *
 * KORUNAN DAVRANIŞ: kart birden çok şubeye kilitliyse silinen kimlik çıkarılır ve kart
 * kalan şubelerde çalışmaya devam eder. Yeni kural yalnızca liste BOŞALACAKSA devreye
 * girer — yoksa çok şubeli kartlar gereksiz yere kullanılamaz olurdu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kullanabilenSubeler, kapsamiKayipMi, gecersizSubeKimlikleri } from "../lib/sube-kullanimi.js";
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

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const gonder = (govde) => cagir(paylasimUcu, {
  method: "POST", headers: OWNER,
  body: { ...govde, islemId: `t76_${Math.random().toString(36).slice(2, 12)}` },
});
const oku = () => kv.get(KEY);

const SUBELER = () => ([
  { id: "lara", ad: "Smell Lara", clientId: 1 },
  { id: "mrkz", ad: "Smell Merkez", clientId: 1 },
  { id: "kepz", ad: "Smell Kepez", clientId: 1 },
]);
const sifirla = () => kv.set(KEY, {
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif" }],
  subeler: SUBELER(),
  cekimIsleri: [
    { id: 1, marka: "Smell Coffee", kategori: "Video", icerikTuru: "Yalnızca Lara", asama: "Onaylandı", sadeceSubeler: ["lara"] },
    { id: 2, marka: "Smell Coffee", kategori: "Video", icerikTuru: "Lara + Merkez", asama: "Onaylandı", sadeceSubeler: ["lara", "mrkz"] },
    { id: 3, marka: "Smell Coffee", kategori: "Video", icerikTuru: "Marka Geneli", asama: "Onaylandı" },
  ],
  haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], _alanSurumleri: {},
});

/* ---------------------------------------------------------------- */
await bolum("1) TEK ŞUBEYE KİLİTLİ KART — kapsam AÇILMIYOR", 5, async () => {
  await sifirla();
  const r = await gonder({ action: "subeSil", subeId: "lara", onayliSil: true });
  t("silme başarılı", r.kod === 200, JSON.stringify(r.govde && r.govde.error));

  const veri = await oku();
  const kart = veri.cekimIsleri.find((j) => j.id === 1);

  t("kimlik kartta BIRAKILDI", JSON.stringify(kart.sadeceSubeler) === '["lara"]',
    "gelen: " + JSON.stringify(kart.sadeceSubeler));
  t("liste BOŞALTILMADI", kart.sadeceSubeler.length !== 0,
    "boş liste 'marka geneli' demek — içerik tüm şubelere açılırdı");

  /* ASIL MESELE: kalan şubeler bu içeriği kullanabiliyor mu? */
  t("KALAN ŞUBELER kullanamıyor",
    kullanabilenSubeler(kart, veri.subeler, 1).length === 0,
    "gelen: " + JSON.stringify(kullanabilenSubeler(kart, veri.subeler, 1).map((s) => s.ad)));

  t("durum ADI OLAN bir hal — sessiz değil",
    kapsamiKayipMi(kart, veri.subeler, 1) === true,
    "arayüz bu bayrağa bakıp uyarı gösteriyor");
});

/* ---------------------------------------------------------------- */
await bolum("2) ÇOK ŞUBELİ KART — eski davranış korunuyor", 3, async () => {
  await sifirla();
  await gonder({ action: "subeSil", subeId: "lara", onayliSil: true });
  const veri = await oku();
  const kart = veri.cekimIsleri.find((j) => j.id === 2);

  t("silinen kimlik çıkarıldı", JSON.stringify(kart.sadeceSubeler) === '["mrkz"]',
    "gelen: " + JSON.stringify(kart.sadeceSubeler));
  t("kart Merkez'de çalışmaya devam ediyor",
    kullanabilenSubeler(kart, veri.subeler, 1).map((s) => s.id).join(",") === "mrkz");
  t("kapsam kayıp SAYILMIYOR", kapsamiKayipMi(kart, veri.subeler, 1) === false,
    "gereksiz uyarı çıkarsa kullanıcı gerçek uyarıya güvenmez");
});

/* ---------------------------------------------------------------- */
await bolum("3) MARKA GENELİ KART — hiç etkilenmiyor", 3, async () => {
  await sifirla();
  await gonder({ action: "subeSil", subeId: "lara", onayliSil: true });
  const veri = await oku();
  const kart = veri.cekimIsleri.find((j) => j.id === 3);

  t("alan hiç oluşturulmadı", kart.sadeceSubeler === undefined);
  t("kalan iki şubede kullanılabiliyor",
    kullanabilenSubeler(kart, veri.subeler, 1).length === 2);
  t("kapsam kayıp değil", kapsamiKayipMi(kart, veri.subeler, 1) === false);
});

/* ---------------------------------------------------------------- */
await bolum("4) SİLME UYARISI — kullanıcı ne olacağını biliyor", 3, async () => {
  await sifirla();
  const r = await gonder({ action: "subeSil", subeId: "lara" });
  t("onaysız silme reddediliyor", r.kod === 409);
  t("kaç kart etkilenecek söyleniyor", r.govde.kilitliKartSayisi === 2,
    "gelen: " + r.govde.kilitliKartSayisi);
  t("uyarı 'marka geneline DÖNMEZ' diyor",
    /MARKA GENELİNE DÖNMEZ/.test(r.govde.error || ""),
    "eski metin tam tersini söylüyordu: 'marka geneline döner'");
});

/* ---------------------------------------------------------------- */
await bolum("5) KAPSAM YENİDEN SEÇİLİNCE ÖLÜ KİMLİK TEMİZLENİR", 3, () => {
  const subeler = SUBELER().filter((s) => s.id !== "lara");
  const kart = { id: 1, sadeceSubeler: ["lara"] };

  t("ölü kimlik tespit ediliyor",
    gecersizSubeKimlikleri(kart, subeler, 1).join(",") === "lara");
  t("geçerli kimlik ölü sayılmıyor",
    gecersizSubeKimlikleri({ sadeceSubeler: ["mrkz"] }, subeler, 1).length === 0);
  t("marka geneli kartta ölü kimlik yok",
    gecersizSubeKimlikleri({ sadeceSubeler: [] }, subeler, 1).length === 0);
});

/* ---------------------------------------------------------------- */
await bolum("6) ARAYÜZ BAĞLANTISI — uyarı gerçekten çiziliyor", 3, async () => {
  const { readFileSync } = await import("node:fs");
  const cekim = readFileSync(new URL("../src/CekimEditTakibi.jsx", import.meta.url), "utf8");

  t("kart kapsam kaybını hesaplıyor", /kapsamiKayipMi\(job, subeler, markaId\)/.test(cekim));
  t("kapsam kayıpken uyarı bloğu çiziliyor",
    /\{kapsamKayip && \([\s\S]{0,400}ŞUBE KAPSAMI KAYIP/.test(cekim),
    "bayrak hesaplanıp gösterilmezse durum yine sessiz kalır");
  /* Yalnızca "fonksiyon kodda geçiyor mu" demek yetmiyor: tanım dururken çağrı
   * kaldırılabiliyor ve kontrol hiçbir şey sınamıyor — ölçüldü, 0 düştü. Şube
   * düğmesine basıldığında GERÇEKTEN çağrıldığı sınanıyor. */
  t("şube seçilince ölü kimlik temizleniyor",
    /const su = olulerdenArindir\(st\.sadeceSubeler\)/.test(cekim),
    "temizlenmezse kullanıcı şube seçse bile kart kullanılamaz kalır");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
