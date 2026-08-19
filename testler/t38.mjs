/* ONAYLANAN İŞ STOĞA GİRER
 *
 * NEDEN BU TEST VAR:
 *   Stok "elde hazır bekleyen içerik" sayısı. Paylaşınca düşüyordu ama artışı elle
 *   giriliyordu; iki panel ayrı sayı tuttuğu için stok gerçeği yansıtmıyordu.
 *
 *   ASIL RİSK ÇİFT SAYMA. Kart her kayıtta yeniden sayılırsa stok şişer; paylaşım paneli
 *   hem kendi düşümünü hem kartın düşümünü uygularsa iki kat düşer. İkisi de sessizdir —
 *   sayı yanlış olur ama hiçbir yerde hata görünmez.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.DRIVE_ONAY_KLASOR_ID;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const { paylasimTuru, onaylananlaraGoreStok } = await import("../lib/stok.js");
const { default: veriUcu } = await import("../api/data.js");
const { default: paylasimUcu } = await import("../api/paylasim.js");

const IS = (ek = {}) => ({ id: 10, marka: "VIZZ", kategori: "Video", icerikTuru: "Kokteyl Reels",
  asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "a" }],
  editliDosyaLink: "https://drive.google.com/file/d/DOSYA1/view", gecmis: [], ...ek });

const VERI = (isler, stoklar = {}) => ({
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ", durum: "aktif" }],
  stoklar, paylasimGecmisi: [], haftalikPaylasimlar: [],
  cekimIsleri: isler,
  personelHesaplari: [],
});
const veriCagri = (body) => cagir(veriUcu, { method: "POST", headers: OWNER, query: {}, body });
const paylasimCagri = (body) => cagir(paylasimUcu, { method: "POST", headers: OWNER, query: {}, body });
const oku = () => kv.get("marcus-os-data");

console.log("ONAYLANAN İŞ → STOK\n");

/* ---- 1. TÜR TESPİTİ ---- */
console.log(" Kartın paylaşım türü");
t("Reels, kategorisi Video olsa da Reels sayılıyor",
  paylasimTuru({ icerikTuru: "Reels 3", kategori: "Video" }) === "Reels",
  "kategoriye bakmak Reels'i Video stoğuna yazardı");
t("adın içinde geçen Reels yakalanıyor", paylasimTuru({ icerikTuru: "Kokteyl Reels", kategori: "Video" }) === "Reels");
t("Story ayırt ediliyor", paylasimTuru({ icerikTuru: "Kampanya Story", kategori: "Video" }) === "Story");
t("Carousel ayırt ediliyor", paylasimTuru({ icerikTuru: "Ürün Carousel", kategori: "Fotoğraf" }) === "Carousel");
t("ad bir şey söylemiyorsa kategoriye düşülüyor (video)",
  paylasimTuru({ icerikTuru: "Sivrisinek Kampanya", kategori: "Video" }) === "Video");
t("ad bir şey söylemiyorsa kategoriye düşülüyor (görsel)",
  paylasimTuru({ icerikTuru: "Yeni Ürünler", kategori: "Fotoğraf" }) === "Görsel");
/* KURAL DEĞİŞTİ: Grafik Tasarım'ın artık kendi stok satırı var. Önceden Görsel'e
 * yazılıyordu; tasarım ile fotoğraf aynı kovada birikince "kaç tasarım hazır?" sorusu
 * cevapsız kalıyordu. Ayrıntısı t48'de. */
t("Grafik Tasarım kendi stoğuna gidiyor",
  paylasimTuru({ icerikTuru: "Yeni Ürünler", kategori: "Grafik Tasarım" }) === "Tasarım");
t("kartta açıkça yazılıysa tahmin edilmiyor",
  paylasimTuru({ icerikTuru: "Reels 3", kategori: "Video", paylasimTuru: "Carousel" }) === "Carousel");

/* ---- 2. ONAYA GİRİŞ ---- */
console.log("\n Kart onaylanınca");
await kv.set("marcus-os-data", VERI([IS()]));
let r = await veriCagri({ data: VERI([IS({ asama: "Onaylandı" })]), _v: 1 });
let d = await oku();
t("doğru türün stoğu arttı", d.stoklar["1_Reels"] === 1, JSON.stringify(d.stoklar));
t("başka tür etkilenmedi", d.stoklar["1_Video"] === undefined, JSON.stringify(d.stoklar));
t("kart sayıldı olarak işaretlendi", d.cekimIsleri[0].stokSayildi === true);

/* ---- 3. ÇİFT SAYMA ---- */
console.log("\n Çift sayma");
r = await veriCagri({ data: { ...d, _v: undefined }, _v: d._v });
let d2 = await oku();
t("aynı kart ikinci kayıtta TEKRAR sayılmıyor", d2.stoklar["1_Reels"] === 1, JSON.stringify(d2.stoklar));

r = await veriCagri({ data: { ...d2, _v: undefined }, _v: d2._v });
d2 = await oku();
t("üçüncü kayıtta da sayılmıyor", d2.stoklar["1_Reels"] === 1, JSON.stringify(d2.stoklar));

/* ---- 4. ONAYDAN ÇIKIŞ ---- */
console.log("\n Onaydan çıkınca");
await kv.set("marcus-os-data", VERI([IS({ asama: "Onaylandı", stokSayildi: true })], { "1_Reels": 1 }));
r = await veriCagri({ data: VERI([IS({ asama: "Revize İstendi", stokSayildi: true })], { "1_Reels": 1 }), _v: 1 });
d = await oku();
t("revizeye dönünce stok düşüyor", d.stoklar["1_Reels"] === 0, JSON.stringify(d.stoklar));
t("işaret temizlendi", d.cekimIsleri[0].stokSayildi === false);
t("stok eksiye inmiyor", d.stoklar["1_Reels"] >= 0);

/* ---- 5. PAYLAŞIM PANELİ — TEK DÜŞÜM ----
 * En sinsi hata burada: hem plan hem kart düşerse aynı içerik iki kez düşer. */
console.log("\n Paylaşım panelinden işaretleme");
await kv.set("marcus-os-data", VERI([IS({ asama: "Onaylandı", stokSayildi: true })], { "1_Reels": 3 }));
r = await paylasimCagri({ action: "haftalikEkle", clientId: 1, gun: 0, haftaKey: "2026-08-17", tur: "Görsel", isId: 10 });
d = await oku();
const planId = d.haftalikPaylasimlar[0].id;
t("plan eklendi", Boolean(planId));

r = await paylasimCagri({ action: "haftalikToggle", planId });
d = await oku();
t("stok BİR kez düştü", d.stoklar["1_Reels"] === 2, JSON.stringify(d.stoklar));
t("planın türünden DEĞİL kartın türünden düşüldü", d.stoklar["1_Görsel"] === undefined,
  "plan Görsel diyordu ama kart Reels — kartın türü geçerli");
t("kart Teslim Edildi'ye geçti", d.cekimIsleri[0].asama === "Teslim Edildi", d.cekimIsleri[0].asama);
t("kartın sayım işareti temizlendi", d.cekimIsleri[0].stokSayildi === false);

/* Geri alınca da tek seferde dönmeli */
r = await paylasimCagri({ action: "haftalikToggle", planId });
d = await oku();
t("geri alınca stok BİR kez arttı", d.stoklar["1_Reels"] === 3, JSON.stringify(d.stoklar));
t("kart Onaylandı'ya döndü", d.cekimIsleri[0].asama === "Onaylandı", d.cekimIsleri[0].asama);
t("işaret geri kondu", d.cekimIsleri[0].stokSayildi === true);

/* Ardından normal kayıt gelirse yine oynamamalı */
r = await veriCagri({ data: { ...d, _v: undefined }, _v: d._v });
d = await oku();
t("sonraki normal kayıt stoğu bozmuyor", d.stoklar["1_Reels"] === 3, JSON.stringify(d.stoklar));

/* ---- 6. KART BAĞSIZ PLAN — eski davranış korunuyor ---- */
console.log("\n Kart bağlanmamış plan");
await kv.set("marcus-os-data", VERI([], { "1_Görsel": 5 }));
r = await paylasimCagri({ action: "haftalikEkle", clientId: 1, gun: 1, haftaKey: "2026-08-17", tur: "Görsel" });
d = await oku();
r = await paylasimCagri({ action: "haftalikToggle", planId: d.haftalikPaylasimlar[0].id });
d = await oku();
t("bağsız planda stoğu plan yönetiyor", d.stoklar["1_Görsel"] === 4, JSON.stringify(d.stoklar));

/* ---- 7. SINIR DURUMLARI ---- */
console.log("\n Sınır durumları");
t("değişiklik yoksa null dönüyor",
  onaylananlaraGoreStok([{ id: 1, asama: "Onaylandı", stokSayildi: true }],
                        [{ id: 1, asama: "Onaylandı", stokSayildi: true }], {}, [{ id: 1, ad: "VIZZ" }]) === null);
t("markası tanınmayan kart stoğa dokunmuyor",
  onaylananlaraGoreStok([], [{ id: 1, marka: "YOK", asama: "Onaylandı" }], {}, [{ id: 1, ad: "VIZZ" }]) === null);
{
  const sonuc = onaylananlaraGoreStok([], [{ id: 1, marka: "vızz", asama: "Onaylandı", icerikTuru: "Reels" }],
    {}, [{ id: 1, ad: "VIZZ" }]);
  t("marka adı büyük/küçük harf farkıyla da eşleşiyor", sonuc && sonuc.stoklar["1_Reels"] === 1,
    JSON.stringify(sonuc && sonuc.stoklar));
}

/* ---- 8. AYNI TÜRDE ÇİFT DÜŞÜM ----
 * 5. bölümde plan "Görsel", kart "Reels" olduğu için çift düşüm tür farkından yakalanıyordu.
 * İkisi AYNI türdeyse fark tek sayıda görünür — asıl tehlikeli hâl bu. */
console.log("\n Plan ve kart aynı türdeyken");
await kv.set("marcus-os-data", VERI([IS({ asama: "Onaylandı", stokSayildi: true })], { "1_Reels": 5 }));
r = await paylasimCagri({ action: "haftalikEkle", clientId: 1, gun: 2, haftaKey: "2026-08-17", tur: "Reels", isId: 10 });
d = await oku();
r = await paylasimCagri({ action: "haftalikToggle", planId: d.haftalikPaylasimlar[0].id });
d = await oku();
t("stok yalnızca 1 düştü, 2 değil", d.stoklar["1_Reels"] === 4, JSON.stringify(d.stoklar));

/* ---- 9. ÖZELLİK ÖNCESİ ONAYLANMIŞ KARTLAR ----
 * Üstlerinde stokSayildi yok. Sayılmamış kabul edilirlerse paylaşıldıklarında stok düşmez
 * ve sayı gerçeğin üstünde kalır — sessizce. */
console.log("\n Özellik öncesinden kalan onaylı kartlar");
await kv.set("marcus-os-data", VERI([IS({ asama: "Onaylandı" })], { "1_Reels": 4 }));   // işaret YOK
r = await veriCagri({ data: VERI([IS({ asama: "Onaylandı" })], { "1_Reels": 4 }), _v: 1 });
d = await oku();
t("eski onaylı kart YENİDEN sayılmıyor", d.stoklar["1_Reels"] === 4, JSON.stringify(d.stoklar));
t("ama işaret geriye dönük konuyor", d.cekimIsleri[0].stokSayildi === true);

await kv.set("marcus-os-data", VERI([IS({ asama: "Onaylandı" })], { "1_Reels": 4 }));   // işaret YOK
r = await veriCagri({ data: VERI([IS({ asama: "Teslim Edildi" })], { "1_Reels": 4 }), _v: 1 });
d = await oku();
t("eski onaylı kart teslim edilince stok DÜŞÜYOR", d.stoklar["1_Reels"] === 3, JSON.stringify(d.stoklar));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
