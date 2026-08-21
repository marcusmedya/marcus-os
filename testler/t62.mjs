/* İŞLEM KİMLİĞİ — AYNI İŞLEM İKİ KEZ UYGULANMASIN (Faz 0 + Faz 1)
 *
 * SORUN: Marcus OS'ta iki ayrı yazma yolu var. BELGE KAYDI bir durum bildirimi ("şu alan
 * şu hâle gelsin") ve tekrar gönderilmesi zararsız — ölçüldü, kopya üretmiyor. Ama EYLEM
 * UÇLARI fark bildirimi ("bir artır", "ekle") ve tekrar gönderilince İKİ KEZ uygulanıyordu.
 *
 * Ölçülen hâl (düzeltmeden önce):
 *   stokDegistir   10 → 11 → 12     ‼
 *   haftalikEkle    0 →  1 →  2     ‼
 *   subeEkle        0 →  1 →  2     ‼
 *   uyelikEkle      0 →  1 →  2     ‼
 *   haftalikToggle  false → true → false   ‼ sessizce GERİ ALINIYOR
 *
 * Bu, internet kesilip istek tekrar gönderildiğinde ya da kullanıcı iki kez tıkladığında
 * gerçekleşiyordu ve hiçbir hata görünmüyordu.
 *
 * İKİ KURAL BU TESTİN ASIL İŞİ:
 *   1. Kilit alınamadıysa (503) kimlik İŞARETLENMEMELİ — işaretlenirse gerçek tekrar
 *      denemesi "zaten yaptım" sanılır ve işlem SESSİZCE KAYBOLUR. Düzeltmek
 *      istediğimizin tam tersi.
 *   2. Kontrol yazmayla AYNI KİLİDİN İÇİNDE olmalı — dışarıda olsaydı iki hızlı tıklama
 *      aynı anda "görmedim" cevabı alır ve ikisi de uygulanırdı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kimlikGecerliMi, islemAnahtari, kayitliYanit, yanitiSakla,
         kimligiUnut, ISLEM_OMRU_SN } from "../lib/islem-kimligi.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const KILIT = "marcus-os-yazma-kilidi";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: paylasimUcu } = await import("../api/paylasim.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { stoklar: 1, haftalikPaylasimlar: 1 },
  clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [], stoklar: { "1_Reels": 10 },
  haftalikPaylasimlar: [{ id: 1, clientId: 1, gun: "Pzt", tur: "Reels", yapildi: false }],
  subeler: [], uyelikler: [], paylasimGecmisi: [], gunlukKontrol: null,
  musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [],
  personelHesaplari: [], musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const oku = () => kv.get(KEY);
const gonder = (govde) => cagir(paylasimUcu, { method: "POST", headers: OWNER, body: govde });

/* ---------------------------------------------------------------- */
console.log("\n1) KİMLİK BİÇİMİ — bu bir güvenlik kontrolü");

t("normal kimlik kabul", kimlikGecerliMi("a1b2c3d4e5f6") === true);
t("çok kısa reddediliyor", kimlikGecerliMi("abc") === false);
t("çok uzun reddediliyor", kimlikGecerliMi("a".repeat(65)) === false);
t("ANAHTAR ENJEKSİYONU reddediliyor",
  kimlikGecerliMi("../marcus-os-data") === false && kimlikGecerliMi("marcus-os-data") === true,
  "kimlik doğrudan Redis anahtarına giriyor — yol karakteri geçmemeli");
t("boşluk ve joker reddediliyor",
  kimlikGecerliMi("a b c d e f") === false && kimlikGecerliMi("abc*defg") === false);
t("string olmayan reddediliyor",
  kimlikGecerliMi(null) === false && kimlikGecerliMi(12345678) === false && kimlikGecerliMi({}) === false);
t("geçersiz kimlik anahtar üretmiyor", islemAnahtari("kisa") === null);
t("süre 24 saat", ISLEM_OMRU_SN === 86400);

/* ---------------------------------------------------------------- */
console.log("\n2) SAKLAMA — yalnızca başarılı yanıtlar");

await sifirla();
t("2xx saklanıyor", (await yanitiSakla("kimlik-basarili-1", 200, { ok: true })) === true);
t("saklanan geri okunuyor",
  (await kayitliYanit("kimlik-basarili-1")).yanit.ok === true);
t("503 SAKLANMIYOR", (await yanitiSakla("kimlik-mesgul-1", 503, { error: "yoğun" })) === false,
  "saklanırsa gerçek tekrar denemesi 'zaten yaptım' sanılır ve işlem kaybolur");
t("409 saklanmıyor", (await yanitiSakla("kimlik-catisma-1", 409, {})) === false,
  "bir sonraki turda çözülebilir olmalı");
t("401 saklanmıyor", (await yanitiSakla("kimlik-yetki-1", 401, {})) === false,
  "oturum tazelenince geçebilmeli");
t("400 saklanmıyor", (await yanitiSakla("kimlik-hatali-1", 400, {})) === false);
t("geçersiz kimlik saklanmıyor", (await yanitiSakla("kisa", 200, {})) === false);
t("görülmemiş kimlik null dönüyor", (await kayitliYanit("hic-gorulmedi-123")) === null);
await kimligiUnut("kimlik-basarili-1");
t("unutulan kimlik yeniden uygulanabilir", (await kayitliYanit("kimlik-basarili-1")) === null);

/* ---------------------------------------------------------------- */
console.log("\n3) ŞİKÂYETİN KENDİSİ — aynı isteği iki kez göndermek");

const senaryolar = [
  { ad: "stokDegistir", govde: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1 },
    olc: (d) => d.stoklar["1_Reels"], beklenen: 11 },
  { ad: "haftalikEkle", govde: { action: "haftalikEkle", clientId: 1, gun: "Sal", tur: "Post" },
    olc: (d) => (d.haftalikPaylasimlar || []).length, beklenen: 2 },
  { ad: "subeEkle", govde: { action: "subeEkle", clientId: 1, ad: "Merkez" },
    olc: (d) => (d.subeler || []).length, beklenen: 1 },
  { ad: "uyelikEkle", govde: { action: "uyelikEkle", ad: "Canva", tutar: 100, periyot: "Aylık" },
    olc: (d) => (d.uyelikler || []).length, beklenen: 1 },
  { ad: "haftalikToggle", govde: { action: "haftalikToggle", planId: 1 },
    olc: (d) => d.haftalikPaylasimlar[0].yapildi, beklenen: true },
];

for (const s of senaryolar) {
  await sifirla();
  const kimlik = `islem-${s.ad}-0001`;
  const r1 = await gonder({ ...s.govde, islemId: kimlik });
  const arada = s.olc(await oku());
  const r2 = await gonder({ ...s.govde, islemId: kimlik });      // AYNI kimlik
  const sonra = s.olc(await oku());
  t(`${s.ad}: tek kez uygulandı`, arada === s.beklenen && sonra === s.beklenen,
    `${JSON.stringify(arada)} → ${JSON.stringify(sonra)} (beklenen ${JSON.stringify(s.beklenen)})`);
  t(`${s.ad}: ikinci yanıt da başarılı`, r2.kod === r1.kod && r2.kod === 200,
    "kullanıcıya hata gösterilmemeli — işlem zaten yapıldı");
  t(`${s.ad}: tekrar olduğu bildiriliyor`, r2.govde.tekrarlandi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n4) FARKLI KİMLİK = FARKLI İŞLEM");

await sifirla();
{
  await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1, islemId: "farkli-aaaa-1111" });
  await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1, islemId: "farkli-bbbb-2222" });
  t("iki AYRI işlem iki kez uygulanıyor", (await oku()).stoklar["1_Reels"] === 12,
    "gelen: " + (await oku()).stoklar["1_Reels"] + " — kimlik yanlış yere yapışmasın");
}

/* ---------------------------------------------------------------- */
console.log("\n5) GERİYE UYUMLULUK — kimliksiz istek eski davranışta");

await sifirla();
{
  await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1 });
  await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1 });
  t("kimlik gönderilmezse bugünkü davranış sürüyor", (await oku()).stoklar["1_Reels"] === 12,
    "açık kalmış eski bir sekme kırılmamalı");
}

/* ---------------------------------------------------------------- */
console.log("\n6) EN KRİTİK KURAL — 503 sonrası işlem KAYBOLMUYOR");

await sifirla();
{
  const kimlik = "mesgul-sonrasi-9999";
  await kv.set(KILIT, Date.now());                    // kilit başkasında
  const mesgul = await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1, islemId: kimlik });
  t("yoğunken 503 dönüyor", mesgul.kod === 503, "gelen: " + mesgul.kod);
  t("stok değişmedi", (await oku()).stoklar["1_Reels"] === 10);
  t("KİMLİK İŞARETLENMEDİ", (await kayitliYanit(kimlik)) === null,
    "işaretlenseydi tekrar denemede 'zaten yaptım' sanılır, işlem SESSİZCE KAYBOLURDU");

  await kv.del(KILIT);                                 // kilit serbest
  const tekrar = await gonder({ action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1, islemId: kimlik });
  t("tekrar denemede işlem UYGULANIYOR", tekrar.kod === 200 && (await oku()).stoklar["1_Reels"] === 11,
    "gelen: " + (await oku()).stoklar["1_Reels"]);
  t("bu sefer kimlik işaretlendi", (await kayitliYanit(kimlik)) !== null);
}

/* ---------------------------------------------------------------- */
console.log("\n7) EŞ ZAMANLI AYNI KİMLİK — iki hızlı tıklama");

await sifirla();
{
  const kimlik = "cift-tiklama-7777";
  const govde = { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 1, islemId: kimlik };
  const [a, b] = await Promise.all([gonder({ ...govde }), gonder({ ...govde })]);
  const sonuc = (await oku()).stoklar["1_Reels"];
  t("iki istek birden gitse de tek kez uygulanıyor", sonuc === 11,
    `stok: ${sonuc} (beklenen 11) · yanıtlar: ${a.kod}/${b.kod}`);
  t("ikisi de kullanıcıya başarı dönüyor", a.kod === 200 && b.kod === 200,
    "biri hata görseydi kullanıcı tekrar denerdi");
}

/* ---------------------------------------------------------------- */
console.log("\n8) HATA YANITI SAKLANMIYOR — düzelen durum kalıcı hataya dönmesin");

await sifirla();
{
  const kimlik = "hatali-sonra-duzelen-55";
  const yok = await gonder({ action: "haftalikToggle", planId: 999, islemId: kimlik });
  t("olmayan plan hata dönüyor", yok.kod >= 400, "gelen: " + yok.kod);
  t("hata kimliğe kaydedilmedi", (await kayitliYanit(kimlik)) === null);
  const iyi = await gonder({ action: "haftalikToggle", planId: 1, islemId: kimlik });
  t("aynı kimlikle geçerli istek çalışıyor", iyi.kod === 200 && (await oku()).haftalikPaylasimlar[0].yapildi === true);
}

/* ---------------------------------------------------------------- */
console.log("\n9) ÜRETİCİ ile DOĞRULAYICI aynı dili konuşuyor mu");

/* Üretici tarayıcı tarafında (src/tema.jsx), doğrulayıcı sunucuda. İkisi ayrışırsa
 * üretilen her kimlik reddedilir ve koruma SESSİZCE hiç çalışmaz — hata da vermez.
 * Bu yüzden üreticinin çıktısı doğrulayıcıdan geçiriliyor. */
{
  const { readFileSync } = await import("fs");
  const tema = readFileSync(new URL("../src/tema.jsx", import.meta.url), "utf8");
  const govde = tema.slice(tema.indexOf("export const islemKimligiUret"));
  const kod = govde.slice(0, govde.indexOf("\n};") + 3).replace("export const", "const");
  // eslint-disable-next-line no-new-func
  const uret = new Function(`${kod}\nreturn islemKimligiUret;`)();

  const ornekler = Array.from({ length: 200 }, () => uret());
  t("üretilen kimlikler doğrulamadan geçiyor", ornekler.every(kimlikGecerliMi),
    "geçmeseydi koruma sessizce hiç çalışmazdı: " + ornekler.find((x) => !kimlikGecerliMi(x)));
  t("kimlikler benzersiz", new Set(ornekler).size === ornekler.length,
    "çakışsaydı farklı işlemler aynı sanılır ve biri kaybolurdu");
  t("crypto yokken de çalışıyor",
    (() => {
      const yedek = new Function("const crypto = undefined;" + kod + "\nreturn islemKimligiUret;")();
      const c = Array.from({ length: 50 }, () => yedek());
      return c.every(kimlikGecerliMi) && new Set(c).size === c.length;
    })(), "eski tarayıcıda yedek yol");
}

t("istemci on iki işlemin hepsine kimlik takıyor",
  (await import("fs")).readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8")
    .includes("{ ...body, islemId: islemKimligiUret() }"),
  "paylasimIstek tek geçiş noktası — orada takılmazsa hiçbiri korunmaz");

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
