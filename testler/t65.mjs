/* İŞLEM KİMLİĞİ — FAZ 2: ÖDEME KAYITLARI VE MÜŞTERİ İŞLEMLERİ
 *
 * Faz 1 (paylasim.js) handler'ın kendi kilidini kullanıyordu. Bu uçlar ise
 * `guvenliGuncelle` üzerinden yazıyor; kontrol onun İÇİNDE, yazmayla aynı kilitte.
 *
 * ÖLÇÜLEN SORUN (düzeltmeden önce):
 *   client-payment/addKaydi   0 → 1 → 2    ödeme kaydı iki kez ekleniyor
 *   data/talepOlustur         0 → 1 → 2    müşterinin talebi iki kez düşüyor
 *
 * Para ve müşteri kararları — sessiz tekrarın en pahalı olduğu iki yer.
 *
 * BU TESTİN ASIL İŞİ YAN ETKİLER: tekrar edilen istekte kayıt yeniden uygulanmadığı gibi,
 * ona bağlı yan etkiler de tetiklenmemeli. Revize isteğinde atanan kişiye e-posta gidiyor;
 * tekrarda İKİNCİ BİR E-POSTA gitmesi kullanıcı için kafa karıştırıcı olurdu. Drive
 * taşıması da aynı sebeple tekrarlanmamalı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";
/* E-posta yolunun GERÇEKTEN calismasi icin anahtar gerekiyor; yoksa gonderim daha
 * baslamadan donuyor ve "ikinci e-posta gitmiyor" kontrolu bosa geciyor - ilk denemede
 * tam bunu yakaladim. Istek asagida yakalaniyor, disari cikmiyor. */
process.env.RESEND_API_KEY = "test-anahtari";
process.env.OWNER_EMAIL = "sahip@x.com";

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kayitliYanit } from "../lib/islem-kimligi.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const KILIT = "marcus-os-yazma-kilidi";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const salt = "s1";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const MUSTERI = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1234"), "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const { default: odemeUcu } = await import("../api/client-payment.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { clients: 1, cekimIsleri: 1, musteriTalepleri: 1 },
  clients: [{ id: 1, ad: "VIZZ", odemeKayitlari: [] }],
  cekimIsleri: [{ id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels",
                  asama: "Kontrol Bekliyor", editor: "Ali",
                  medya: [{ slot: "1", versiyon: 1, dosyaId: "x" }] }],
  stoklar: {}, musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [],
  personelHesaplari: [{ id: "p1", ad: "Ali", kullaniciAdi: "ali", email: "ali@x.com",
                        sifreHash: hash("1234", salt), sifreSalt: salt, izinler: {}, markalar: [] }],
  musteriHesaplari: [{ id: "m1", clientId: 1, ad: "M", kullaniciAdi: "m",
                       sifreHash: hash("1234", salt), sifreSalt: salt }],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const oku = () => kv.get(KEY);

/* E-postayı gerçekten göndermeden say. */
let epostaSayisi = 0;
const asilFetch = globalThis.fetch;
globalThis.fetch = async (url, ayar) => {
  if (String(url).includes("api.resend.com")) { epostaSayisi += 1; return { ok: true, json: async () => ({ id: "x" }) }; }
  return asilFetch ? asilFetch(url, ayar) : { ok: false, json: async () => ({}) };
};

/* ---------------------------------------------------------------- */
console.log("\n1) ÖDEME KAYDI — para, tekrarın en pahalı olduğu yer");

await sifirla();
{
  const kimlik = "odeme-ekle-000001";
  const govde = { action: "addKaydi", clientId: 1, kayit: { tutar: 5000, tarih: "2026-08-01" }, islemId: kimlik };
  const r1 = await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  const arada = ((await oku()).clients[0].odemeKayitlari || []).length;
  const r2 = await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  const sonra = ((await oku()).clients[0].odemeKayitlari || []).length;

  t("ödeme kaydı TEK kez ekleniyor", arada === 1 && sonra === 1, `${arada} → ${sonra}`);
  t("ikinci yanıt da başarılı", r1.kod === 200 && r2.kod === 200, "kullanıcıya hata gösterilmemeli");
  t("tekrar olduğu bildiriliyor", r2.govde.tekrarlandi === true);
  t("müşteri kaydı yanıtta yine dönüyor", Boolean(r2.govde.client),
    "ön yüz bu kayıtla yerel durumunu güncelliyor");
}

await sifirla();
{
  /* Farklı kimlik = gerçekten iki ayrı ödeme. */
  const yap = (kimlik) => cagir(odemeUcu, { method: "POST", headers: OWNER, query: {},
    body: { action: "addKaydi", clientId: 1, kayit: { tutar: 100 }, islemId: kimlik } });
  await yap("odeme-a-11111111"); await yap("odeme-b-22222222");
  t("farklı kimlik iki kayıt üretiyor", ((await oku()).clients[0].odemeKayitlari || []).length === 2);
}

await sifirla();
{
  /* Kimliksiz istek eski davranışta kalmalı. */
  const govde = { action: "addKaydi", clientId: 1, kayit: { tutar: 100 } };
  await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  t("kimliksiz istek eski davranışta", ((await oku()).clients[0].odemeKayitlari || []).length === 2,
    "açık kalmış eski bir sekme kırılmamalı");
}

/* ---------------------------------------------------------------- */
console.log("\n2) MÜŞTERİ TALEBİ");

await sifirla();
{
  const kimlik = "talep-000000001";
  const govde = { musteriAction: "talepOlustur", talep: { tur: "Reels", aciklama: "Acil bir reels lazım" }, islemId: kimlik };
  await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const arada = ((await oku()).musteriTalepleri || []).length;
  const r2 = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const sonra = ((await oku()).musteriTalepleri || []).length;
  t("talep TEK kez oluşuyor", arada === 1 && sonra === 1, `${arada} → ${sonra}`);
  t("tekrar bildiriliyor", r2.govde.tekrarlandi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n3) MÜŞTERİ ONAYI — stok bir kez artıyor");

await sifirla();
{
  const kimlik = "onay-0000000001";
  const govde = { musteriAction: "onayla", isId: 1, islemId: kimlik };
  const r1 = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const stok1 = JSON.stringify((await oku()).stoklar);
  const r2 = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const stok2 = JSON.stringify((await oku()).stoklar);
  const kart = (await oku()).cekimIsleri[0];

  t("onay uygulanıyor", r1.kod === 200 && kart.asama === "Onaylandı");
  t("stok bir kez arttı", stok1 === stok2 && stok1 !== "{}", `${stok1} → ${stok2}`);
  t("ikinci istek HATA DEĞİL başarı dönüyor", r2.kod === 200,
    "kimliksiz hâlde 409 'artık onayını beklemiyor' geliyordu — tekrar denemede yanıltıcı");
  t("tekrar bildiriliyor", r2.govde.tekrarlandi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n4) ASIL MESELE — YAN ETKİLER TEKRARDA ÇALIŞMIYOR");

await sifirla();
{
  epostaSayisi = 0;
  const kimlik = "revize-000000001";
  const govde = { musteriAction: "revizeIste", isId: 1, revizeNotu: "Logo küçük olmuş", islemId: kimlik };
  const r1 = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const ilkSayi = epostaSayisi;
  const r2 = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: govde });
  const sonSayi = epostaSayisi;
  const kart = (await oku()).cekimIsleri[0];

  t("revize uygulanıyor", r1.kod === 200 && kart.asama === "Revize İstendi");
  t("bildirim e-postası gönderildi", ilkSayi >= 1, "gönderilen: " + ilkSayi);
  t("TEKRARDA İKİNCİ E-POSTA GİTMİYOR", sonSayi === ilkSayi,
    `${ilkSayi} → ${sonSayi} — aynı revize için iki e-posta kafa karıştırıcı olurdu`);
  t("revize sayısı iki kez artmıyor", Number(kart.revizeSayisi) === 1,
    "gelen: " + kart.revizeSayisi);
  t("not iki kez yazılmıyor",
    (kart.gecmis || []).filter((x) => String(x.aciklama || "").includes("Logo küçük olmuş")).length <= 1);
}

/* ---------------------------------------------------------------- */
console.log("\n5) EN KRİTİK KURAL — 503 sonrası işlem kaybolmuyor");

await sifirla();
{
  const kimlik = "mesgul-odeme-0001";
  const govde = { action: "addKaydi", clientId: 1, kayit: { tutar: 999 }, islemId: kimlik };
  await kv.set(KILIT, Date.now());                       // kilit başkasında
  const mesgul = await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  t("yoğunken 503 dönüyor", mesgul.kod === 503, "gelen: " + mesgul.kod);
  t("ödeme eklenmedi", ((await oku()).clients[0].odemeKayitlari || []).length === 0);
  t("KİMLİK İŞARETLENMEDİ", (await kayitliYanit(kimlik)) === null,
    "işaretlenseydi tekrar denemede 'zaten yaptım' sanılır ve ödeme SESSİZCE KAYBOLURDU");

  await kv.del(KILIT);
  const tekrar = await cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: govde });
  t("tekrar denemede ödeme UYGULANIYOR",
    tekrar.kod === 200 && ((await oku()).clients[0].odemeKayitlari || []).length === 1);
}

/* ---------------------------------------------------------------- */
console.log("\n6) EŞ ZAMANLI AYNI KİMLİK — iki hızlı tıklama");

await sifirla();
{
  const govde = { action: "addKaydi", clientId: 1, kayit: { tutar: 250 }, islemId: "cift-odeme-00001" };
  const [a, b] = await Promise.all([
    cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: { ...govde } }),
    cagir(odemeUcu, { method: "POST", headers: OWNER, query: {}, body: { ...govde } }),
  ]);
  t("iki istek birden gitse de tek ödeme",
    ((await oku()).clients[0].odemeKayitlari || []).length === 1,
    `yanıtlar: ${a.kod}/${b.kod}`);
  t("ikisi de başarı dönüyor", a.kod === 200 && b.kod === 200);
}

globalThis.fetch = asilFetch;
console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
