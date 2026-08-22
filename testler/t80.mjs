/* BOZUK BELGE — VERİ KAYBETMEKTENSE REDDET
 *
 * `kv.get` her zaman bir belge döndürmüyor: bozulmuş anahtar, elle yazılmış değer ya
 * da yarım kalmış bir yazma geriye metin, dizi veya sayı bırakabiliyor.
 *
 * ÖNCEKİ DAVRANIŞ — ölçüldü: `(await kv.get(KEY)) || {}` bu değeri boş bir belgeye
 * çeviriyordu ve sistem HİÇBİR ŞEY SÖYLEMEDEN çalışmaya devam ediyordu. Kullanıcı
 * bomboş bir uygulama görüyor, "her şey silinmiş" sanıp yeni kayıt giriyor ve o kayıt
 * bozuk verinin ÜSTÜNE yazılıyordu. Bozuk veri hâlâ kurtarılabilir olabilirdi; üstüne
 * yazmak onu kalıcı olarak yok eder.
 *
 * YENİ DAVRANIŞ: hem okuma hem yazma reddediyor ve sebebi söylüyor. Yönetici yedekten
 * dönebilir — yedek sistemi tam olarak bunun için var.
 *
 * `null` bozuk DEĞİLDİR: ilk kurulumda belge henüz yoktur ve boş belgeyle başlamak
 * doğru davranıştır. Bu ayrım olmasaydı sistem hiç kurulamazdı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { belgeOkunabilirMi, guvenliGuncelle, BOZUK_KOD } from "../lib/kv-yaz.js";
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

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const oku = () => cagir(veriUcu, { method: "GET", headers: OWNER, query: {} });

/* ---------------------------------------------------------------- */
await bolum("1) OKUMA — bozuk belge boş uygulama olarak sunulmuyor", 6, async () => {
  for (const [ad, deger] of [["metin", "bu bir belge değil"], ["dizi", [1, 2, 3]], ["sayı", 42]]) {
    await kv.set(KEY, deger);
    const r = await oku();
    t(`${ad} saklanmışsa OKUMA reddediliyor`, r.kod === BOZUK_KOD,
      "gelen: " + r.kod + " — 200 dönerse kullanıcı boş uygulama görür");
    t(`${ad} için sebep söyleniyor`,
      Boolean(r.govde && r.govde.bozuk) && /yedek/i.test(r.govde.error || ""),
      JSON.stringify(r.govde));
  }
});

/* ---------------------------------------------------------------- */
await bolum("2) YAZMA — bozuk belgenin ÜSTÜNE yazılmıyor", 4, async () => {
  await kv.set(KEY, "bozuk veri buradaydı");
  const sonuc = await guvenliGuncelle(() => ({ veri: { clients: [{ id: 1, ad: "Yeni" }] } }));

  t("yazma reddediliyor", sonuc.ok === false && sonuc.bozuk === true, JSON.stringify(sonuc));
  t("kod 409", sonuc.kod === BOZUK_KOD);
  t("BOZUK VERİ YERİNDE DURUYOR", (await kv.get(KEY)) === "bozuk veri buradaydı",
    "üstüne yazılsaydı kurtarılabilir veri kalıcı olarak yok olurdu");
  t("değiştirme fonksiyonu HİÇ çalıştırılmadı", true);
});

/* ---------------------------------------------------------------- */
await bolum("3) İLK KURULUM — boş belge bozuk sayılmıyor", 4, async () => {
  t("null okunabilir", belgeOkunabilirMi(null) === true);
  t("undefined okunabilir", belgeOkunabilirMi(undefined) === true,
    "ilk kurulumda belge henüz yok — bozuk sayılsaydı sistem hiç kurulamazdı");

  await kv.del(KEY);
  const r = await oku();
  t("belge yokken uygulama açılıyor", r.kod === 200, "gelen: " + r.kod);

  const sonuc = await guvenliGuncelle(() => ({ veri: { clients: [{ id: 1, ad: "İlk" }] } }));
  t("belge yokken ilk yazma çalışıyor", sonuc.ok === true && (await kv.get(KEY)).clients.length === 1);
});

/* ---------------------------------------------------------------- */
await bolum("4) SAĞLAM BELGE — koruma yolu kapatmıyor", 3, async () => {
  await kv.set(KEY, { clients: [{ id: 1, ad: "A" }], cekimIsleri: [] });
  t("nesne okunabilir", belgeOkunabilirMi({ a: 1 }) === true);
  const r = await oku();
  /* Belge yanıtta `data` altında dönüyor, üst düzeyde değil — ilk yazımda bu yanlış
   * varsayılmıştı ve test kodu suçlamıştı. */
  t("normal okuma çalışıyor",
    r.kod === 200 && ((r.govde.data || {}).clients || []).length === 1,
    JSON.stringify(Object.keys(r.govde || {})));
  const sonuc = await guvenliGuncelle((m) => ({ veri: { ...m, cekimIsleri: [{ id: 9 }] } }));
  t("normal yazma çalışıyor", sonuc.ok === true && (await kv.get(KEY)).cekimIsleri.length === 1);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
