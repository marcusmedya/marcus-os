/* İŞLEM KİMLİĞİ — FAZ 3 (personel hesapları) + FAZ 4 (ağ hatasında tekrar)
 *
 * FAZ 3: manage-staff.js'teki beş işlem. `ekle` kullanıcı adı tekliği sayesinde tesadüfen
 * korunuyordu ama `sil` ve `sifreSifirla` korunmuyordu — tekrar gönderilen bir silme,
 * aradaki sürede yeniden açılmış bir hesabı silebilirdi.
 *
 * Ayrıca GÜVENLİK DEFTERİ bir yan etki: "kim ne zaman ne yaptı" kaydı. Tekrar edilen bir
 * istek için ikinci bir satır, olmayan bir işlemi varmış gibi gösterirdi.
 *
 * FAZ 4: ağ hatasında otomatik tekrar. BU FAZIN SIRALAMADA SONDA OLMASININ SEBEBİ:
 * ağ koptuğunda kaybolan şey YANIT'tır, İSTEK DEĞİL. İstek sunucuya ulaşmış ve
 * uygulanmış olabilir; körü körüne tekrar göndermek aynı işlemi İKİNCİ KEZ uygular.
 * Bu yüzden yalnızca işlem kimliği taşıyan istekler tekrar deneniyor — kimlik olmadan
 * bu özellik güvenli değildi.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { tekrarDenemeyiKur, istekKimlikTasiyorMu, MESGUL_BEKLEMELERI } from "../lib/mesgul-tekrar.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const salt = "s1";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: personelUcu } = await import("../api/manage-staff.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { personelHesaplari: 1 },
  clients: [{ id: 1, ad: "VIZZ" }], cekimIsleri: [], stoklar: {},
  musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [],
  personelHesaplari: [{ id: "p1", ad: "Ali", kullaniciAdi: "ali",
                        sifreHash: hash("1234", salt), sifreSalt: salt, izinler: {}, markalar: [] }],
  musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const oku = () => kv.get(KEY);
const defter = async () => (await kv.get("marcus-os-guvenlik-defteri")) || [];
const gonder = (govde) => cagir(personelUcu, { method: "POST", headers: OWNER, query: {}, body: govde });

/* ---------------------------------------------------------------- */
console.log("\n1) PERSONEL SİLME — tekrar gönderilse de tek kez");

await sifirla();
{
  const kimlik = "personel-sil-0001";
  const govde = { action: "sil", id: "p1", islemId: kimlik };
  const r1 = await gonder(govde);
  const arada = ((await oku()).personelHesaplari || []).length;

  /* Silme uygulandıktan SONRA aynı isimde yeni bir hesap açıldığını varsayalım —
   * tekrar gönderilen silme onu silmemeli. */
  await kv.set(KEY, { ...(await oku()), personelHesaplari: [
    { id: "p2", ad: "Yeni Ali", kullaniciAdi: "ali2", sifreHash: hash("1", salt), sifreSalt: salt, izinler: {}, markalar: [] },
  ] });

  const r2 = await gonder(govde);
  const sonra = ((await oku()).personelHesaplari || []).length;
  t("silme uygulandı", r1.kod === 200 && arada === 0);
  t("tekrar YENİ hesabı silmiyor", sonra === 1,
    "eski liste yeniden yazılsaydı aradaki hesap yok olurdu — gelen: " + sonra);
  t("tekrar bildiriliyor", r2.govde.tekrarlandi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİFRE SIFIRLAMA");

await sifirla();
{
  const kimlik = "sifre-sifirla-001";
  const govde = { action: "sifreSifirla", id: "p1", sifre: "yenisifre", islemId: kimlik };
  await gonder(govde);
  const hash1 = (await oku()).personelHesaplari[0].sifreHash;
  const r2 = await gonder(govde);
  const hash2 = (await oku()).personelHesaplari[0].sifreHash;
  t("şifre bir kez sıfırlanıyor", hash1 === hash2,
    "her istek yeni salt üretiyor; ikinci kez uygulansaydı hash değişirdi");
  t("tekrar bildiriliyor", r2.govde.tekrarlandi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n3) GÜVENLİK DEFTERİ — tekrarda ikinci satır yazılmıyor");

await sifirla();
{
  /* `ekle` KULLANILMIYOR: onun kullanıcı adı tekliği kontrolü var ve tekrar istek
   * `hesaplariYaz`a hiç ulaşmadan 409 alıyor. Onunla ölçmek defter korumasını değil,
   * var olan eski korumayı sınamak olurdu — ilk denemede tam bunu yapmışım ve kırma
   * testi 0 düşünce fark ettim. `sifreSifirla`nın doğal koruması yok. */
  const govde = { action: "sifreSifirla", id: "p1", sifre: "yenisifre123", islemId: "defter-testi-001" };
  const r1 = await gonder(govde);
  const ilk = (await defter()).length;
  const r2 = await gonder(govde);
  const son = (await defter()).length;
  t("işlem gerçekten uygulandı", r1.kod === 200 && ilk >= 1, `yanıt ${r1.kod}, defter ${ilk}`);
  t("ikinci istek TEKRAR olarak tanındı", r2.govde.tekrarlandi === true,
    "tanınmazsa aşağıdaki kontrol bir şey ispatlamaz");
  t("TEKRAR DEFTERE YAZILMIYOR", son === ilk,
    `${ilk} → ${son} — defter "kim ne yaptı" kaydı; ikinci satır olmayan bir işlemi gösterirdi`);
}

/* ---------------------------------------------------------------- */
console.log("\n4) KİMLİKSİZ İSTEK ESKİ DAVRANIŞTA");

await sifirla();
{
  /* Şifre en az 4 karakter olmalı — ilk denemede "abc" yazmıştım ve istek daha
   * doğrulamaya takılıyordu, yani kontrol hiçbir şey ölçmüyordu. */
  const govde = { action: "sifreSifirla", id: "p1", sifre: "gecerlisifre" };
  const r1 = await gonder(govde);
  const h1 = (await oku()).personelHesaplari[0].sifreHash;
  const r2 = await gonder(govde);
  const h2 = (await oku()).personelHesaplari[0].sifreHash;
  t("istekler gerçekten kabul edildi", r1.kod === 200 && r2.kod === 200,
    "reddedilseydi aşağıdaki kontrol bir şey ispatlamazdı");
  t("kimliksiz istek iki kez uygulanıyor", h1 !== h2,
    "her istek yeni salt üretir; açık kalmış eski bir sekme kırılmamalı");
}

/* ---------------------------------------------------------------- */
console.log("\n5) FAZ 4 — kimlik taşıyan istek tanınıyor mu");

t("kimlikli gövde tanınıyor",
  istekKimlikTasiyorMu({ body: JSON.stringify({ action: "x", islemId: "abcdefgh1234" }) }) === true);
t("kimliksiz gövde tanınmıyor",
  istekKimlikTasiyorMu({ body: JSON.stringify({ action: "x" }) }) === false);
t("çok kısa kimlik sayılmıyor",
  istekKimlikTasiyorMu({ body: JSON.stringify({ islemId: "abc" }) }) === false);
t("metin olmayan gövde kimliksiz sayılıyor",
  istekKimlikTasiyorMu({ body: new Uint8Array([1, 2, 3]) }) === false,
  "dosya yüklemesi gibi — belirsizlikte tekrar etmemek doğru taraf");
t("bozuk JSON kimliksiz sayılıyor", istekKimlikTasiyorMu({ body: "{bozuk" }) === false);
t("gövdesiz istek kimliksiz sayılıyor",
  istekKimlikTasiyorMu({}) === false && istekKimlikTasiyorMu(undefined) === false);

/* ---------------------------------------------------------------- */
console.log("\n6) FAZ 4 — AĞ HATASINDA TEKRAR");

const yanitYap = (durum, govde) => ({ status: durum, clone: () => ({ json: async () => govde }) });

{
  /* Kimlikli istek: ağ iki kez koptu, üçüncüde geçti. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac += 1; if (sayac <= 2) throw new TypeError("Failed to fetch"); return yanitYap(200, { ok: true }); };
  tekrarDenemeyiKur(kap);
  /* try/catch ŞART: tekrar deneme kaldırılırsa bu çağrı fırlatır ve test ÇÖKER.
   * Çöken test ✗ satırı üretmez; kaç kontrolün düştüğünü ölçen kırma testi de "0 düştü"
   * der. Bu projede o tuzağa daha önce düşüldü — hata, kontrol olarak yakalanmalı. */
  let yanit = null;
  try {
    yanit = await kap.fetch("/api/paylasim", { method: "POST", body: JSON.stringify({ action: "stokDegistir", islemId: "aabbccdd1122" }) });
  } catch (e) { yanit = { status: 0, hata: String(e && e.message) }; }
  t("kimlikli istek ağ hatasında tekrar deneniyor", yanit.status === 200 && sayac === 3,
    `durum ${yanit.status}, gönderilen ${sayac}`);
}
{
  /* KİMLİKSİZ istek: tekrar DENENMEMELİ — istek sunucuya ulaşmış olabilir. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac += 1; throw new TypeError("Failed to fetch"); };
  tekrarDenemeyiKur(kap);
  let hataAlindi = false;
  try { await kap.fetch("/api/data", { method: "POST", body: JSON.stringify({ data: {} }) }); }
  catch (e) { hataAlindi = true; }
  t("KİMLİKSİZ istek ağ hatasında TEKRAR EDİLMİYOR", sayac === 1,
    "istek uygulanmış olabilir; körü körüne tekrar aynı işlemi ikinci kez uygular — gönderilen: " + sayac);
  t("hata çağırana ulaşıyor", hataAlindi === true, "sessizce yutulmamalı");
}
{
  /* Ağ hep kopuksa hata en sonunda çağırana ulaşmalı. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac += 1; throw new TypeError("Failed to fetch"); };
  tekrarDenemeyiKur(kap);
  let hataAlindi = false;
  try { await kap.fetch("/api/paylasim", { method: "POST", body: JSON.stringify({ islemId: "sureklikopuk1" }) }); }
  catch (e) { hataAlindi = true; }
  t("sürekli kopukta hata kullanıcıya dönüyor", hataAlindi === true);
  t("deneme sayısı sınırlı", sayac === 1 + MESGUL_BEKLEMELERI.length, "gönderilen: " + sayac);
}
{
  /* 503 tekrarı bozulmamış olmalı. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac += 1; return sayac <= 2 ? yanitYap(503, { mesgul: true }) : yanitYap(200, { ok: true }); };
  tekrarDenemeyiKur(kap);
  const yanit = await kap.fetch("/api/paylasim", { method: "POST", body: JSON.stringify({ islemId: "mesgulyolu123" }) });
  t("503 tekrarı hâlâ çalışıyor", yanit.status === 200 && sayac === 3, "gönderilen: " + sayac);
}
{
  /* Dış adresler hiç dokunulmadan geçmeli — Drive yüklemesi buradan geçiyor. */
  const kap = {};
  let sayac = 0;
  kap.fetch = async () => { sayac += 1; throw new TypeError("Failed to fetch"); };
  tekrarDenemeyiKur(kap);
  let hata = false;
  try { await kap.fetch("https://www.googleapis.com/upload", { method: "PUT", body: "x" }); } catch (e) { hata = true; }
  t("dış adreslere dokunulmuyor", sayac === 1 && hata === true,
    "Drive yüklemesi kendi tekrar mantığını kullanıyor");
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
