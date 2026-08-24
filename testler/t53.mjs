/* SİLİNEN KART STOKTAN DÜŞMÜYORDU
 *
 * BULUNAN HATA. Onaydaki bir kartı Operasyon'dan silmek stoğu olduğu yerde bırakıyordu.
 * Sebep: stok hesabı `sonrakiIsler` dizisini geziyor, silinen kart orada YOK — hiç ziyaret
 * edilmiyor, dolayısıyla düşüm de olmuyordu. Hiçbir uyarı çıkmıyordu; sayı sessizce
 * gerçeğin üstünde kalıyordu.
 *
 * Ölçüldü: 2 kart onayda, biri silindi -> stok 2'de kaldı, 1 olması gerekirken.
 *
 * "TESLİM EDİLDİ" DÜŞÜMÜ ZATEN ÇALIŞIYORDU — ölçülerek doğrulandı, burada da sınanıyor ki
 * silme düzeltmesi onu bozmasın.
 *
 * FRENİN ÖLÇÜSÜ ÖNEMLİ. İlk denemede uygulamanın başka yerlerindeki %60 oranı kullanıldı;
 * iki karttan birini silmek bile freni tetikliyordu, yani düzeltme günlük kullanımda hiç
 * çalışmıyordu. Oran kart silme için yanlış ölçü — "bir kayıtta kaç kart birden yok oldu"
 * sorusu doğru olanı.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { onaylananlaraGoreStok } from "../lib/stok.js";
process.env.SITE_PASSWORD = "ownerpw";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const MARKALAR = [{ id: 1, ad: "VIZZ" }];
const KART = (id, ek = {}) => ({ id, marka: "VIZZ", kategori: "Video", icerikTuru: `Reels ${id}`, asama: "Onaylandı", stokSayildi: true, ...ek });

/* ---------------------------------------------------------------- */
console.log("\n1) HESAP KATMANI");

let r = onaylananlaraGoreStok([KART(1), KART(2)], [KART(2)], { "1_Reels": 2 }, MARKALAR);
t("onaydaki kart silinince stok düşüyor", r && r.stoklar["1_Reels"] === 1, JSON.stringify(r && r.stoklar));
t("silme, değişiklik olarak bildiriliyor",
  r && r.degisenler.some((x) => String(x.isId) === "1" && x.yon === -1 && x.silindi === true),
  JSON.stringify(r && r.degisenler));

r = onaylananlaraGoreStok([KART(1, { asama: "Teslim Edildi", stokSayildi: false })], [], { "1_Reels": 1 }, MARKALAR);
t("teslim edilmiş kartın silinmesi İKİNCİ kez düşmüyor", r === null, JSON.stringify(r));

r = onaylananlaraGoreStok([KART(1, { asama: "Kontrol Bekliyor", stokSayildi: false })], [], { "1_Reels": 1 }, MARKALAR);
t("hiç sayılmamış kartın silinmesi stoğa dokunmuyor", r === null, JSON.stringify(r));

/* İşareti olmayan eski kart: aşamasına bakılır. */
r = onaylananlaraGoreStok([{ id: 9, marka: "VIZZ", icerikTuru: "Reels", asama: "Onaylandı" }], [], { "1_Reels": 4 }, MARKALAR);
t("işaretsiz eski kart aşamasına göre düşülüyor", r && r.stoklar["1_Reels"] === 3, JSON.stringify(r && r.stoklar));

r = onaylananlaraGoreStok([KART(1)], [], {}, MARKALAR);
t("stok eksiye inmiyor", r && r.stoklar["1_Reels"] === 0, JSON.stringify(r && r.stoklar));

r = onaylananlaraGoreStok([{ id: 1, marka: "TANIMSIZ", icerikTuru: "Reels", asama: "Onaylandı", stokSayildi: true }], [], { "1_Reels": 2 }, MARKALAR);
t("markası tanınmayan silinen kart stoğa dokunmuyor", r === null, JSON.stringify(r));

/* Tür ayrımı silmede de geçerli. */
r = onaylananlaraGoreStok(
  [KART(1, { icerikTuru: "Menü Tasarımı", kategori: "Grafik Tasarım" })], [],
  { "1_Post": 3, "1_Reels": 5 }, MARKALAR);
t("silinen kart KENDİ türünden düşüyor",
  r && r.stoklar["1_Post"] === 2 && r.stoklar["1_Reels"] === 5, JSON.stringify(r && r.stoklar));

console.log("\n   Toptan kayıp freni — ölçüsü doğru mu");
const cok = (n) => Array.from({ length: n }, (_, i) => KART(i + 1));
t("2 karttan 1'ini silmek freni TETİKLEMİYOR",
  onaylananlaraGoreStok(cok(2), [KART(2)], { "1_Reels": 2 }, MARKALAR) !== null,
  "oran tabanlı fren burada yanlış çalışıyordu");
t("15 kart silmek hâlâ sayılıyor",
  onaylananlaraGoreStok(cok(15), [], { "1_Reels": 15 }, MARKALAR).stoklar["1_Reels"] === 0);
t("21 kart birden kaybolursa fren devreye giriyor",
  onaylananlaraGoreStok(cok(21), [], { "1_Reels": 21 }, MARKALAR) === null,
  "bu bir silme değil, bayat/eksik gönderi işareti");
t("fren yalnızca KAYBOLAN sayısına bakıyor, listenin boyuna değil",
  onaylananlaraGoreStok(cok(100), cok(100).slice(0, 99), { "1_Reels": 100 }, MARKALAR).stoklar["1_Reels"] === 99);

/* ---------------------------------------------------------------- */
console.log("\n2) UÇTAN UCA — gerçek kayıt akışı");

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const KIMLIK = { "x-staff-username-b64": b64("ed"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const oku = () => kv.get("marcus-os-data");

const KUR = async (stok) => {
  await kv.set("marcus-os-data", {
    _v: 1, clients: MARKALAR, stoklar: stok,
    cekimIsleri: [KART(1), KART(2)],
    personelHesaplari: [{ id: "p1", ad: "Editör", kullaniciAdi: "ed", sifreHash: hash("1", "s"), sifreSalt: "s",
      izinler: { cekimEdit: true, paylasimlar: true }, markalar: [] }],
    musteriHesaplari: [], paylasimGecmisi: [], haftalikPaylasimlar: [], subeler: [],
  });
  return await oku();
};

let d = await KUR({ "1_Reels": 2 });
let y = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: d.cekimIsleri.filter((j) => j.id !== 1), _v: undefined }, _v: d._v } });
t("yönetici kaydı geçti", y.kod === 200, JSON.stringify(y.govde).slice(0, 120));
t("SİLİNEN KART STOKTAN DÜŞTÜ", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));
t("yanıt stoğu geri bildiriyor (panel anında güncellensin)",
  y.govde.stok && y.govde.stok.stoklar["1_Reels"] === 1, JSON.stringify(y.govde.stok));
t("kalan kart yerinde", (await oku()).cekimIsleri.length === 1);

/* Aynı kayıt bir daha gönderilirse tekrar düşmemeli. */
d = await oku();
await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, _v: undefined }, _v: d._v } });
t("ikinci kayıtta tekrar düşmüyor", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

/* "Teslim Edildi" düşümü bozulmadı mı — bu zaten çalışıyordu. */
d = await KUR({ "1_Reels": 2 });
await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: d.cekimIsleri.map((j) => (j.id === 1 ? { ...j, asama: "Teslim Edildi" } : j)), _v: undefined }, _v: d._v } });
t("Teslim Edildi düşümü hâlâ çalışıyor", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

/* Teslim Edildi'ye geçen kart SONRA silinirse ikinci kez düşmemeli. */
d = await oku();
await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: d.cekimIsleri.filter((j) => j.id !== 1), _v: undefined }, _v: d._v } });
t("teslim edilip sonra silinen kart İKİ kez düşmüyor", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

/* Personel yolunda da geçerli. */
d = await KUR({ "1_Reels": 2 });
y = await cagir(veriUcu, { method: "POST", headers: KIMLIK, query: {},
  body: { data: { cekimIsleri: d.cekimIsleri.filter((j) => j.id !== 2) }, _v: d._v } });
t("personel kaydı geçti", y.kod === 200, JSON.stringify(y.govde).slice(0, 120));
t("personel sildiğinde de düşüyor", (await oku()).stoklar["1_Reels"] === 1, JSON.stringify((await oku()).stoklar));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
