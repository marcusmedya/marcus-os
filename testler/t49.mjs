/* ÇÖZÜM ORTAĞI PANELİ = MÜŞTERİ PANELİ (İÇERİK İSTE HARİÇ)
 *
 * Ortağa önceden yalnızca "Üretim Durumu" ve "Onaylananlar" açıktı. Gerekçe ortağın
 * müşterinin karar sürecini görmesine gerek olmadığıydı — ama pratikte ters düştü:
 * içeriği paylaşacak kişi neyin neden beklediğini, takvimde ne olduğunu ve reklamların
 * durumunu göremiyordu.
 *
 * TEK İSTİSNA "İçerik İste": orası müşterinin ajanstan talepte bulunduğu yer; ortak
 * müşteri adına talep açamaz.
 *
 * İKİ AYRI ŞEY, KARIŞTIRILMAMALI:
 *   sekmenin AÇIK olması        -> ortak o ekranı görür
 *   sekmede İŞLEM yapılabilmesi -> Onayla / Değişiklik iste ortağa KAPALI kalır,
 *                                  çünkü ortak müşteri adına karar veremez.
 *
 * Sekmeyi gizlemek tek başına yetmez: veri yanıtta kalırsa gizleme yalnızca görsel olur
 * ve talep metinleri okunabilir kalırdı. Sunucu talepleri hiç göndermiyor.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const KIMLIK = (ad) => ({ "x-staff-username-b64": b64(ad), "x-staff-password-b64": b64("1"), "content-type": "application/json" });
const PERSONEL = (ad, izinler, markalar) => ({
  id: ad, ad, kullaniciAdi: ad, sifreHash: hash("1", "s"), sifreSalt: "s", izinler, markalar: markalar || [],
});
const { default: veriUcu } = await import("../api/data.js");

/* ---------------------------------------------------------------- */
console.log("\n1) SEKMELER — müşteriyle aynı, İçerik İste hariç");

const panel = fs.readFileSync(path.join(kok, "src", "musteriPaneli.jsx"), "utf8");
const govde = panel.slice(panel.indexOf("export function MusteriPaneli"));

/* Yalnızca `tumSekmeler` dizisinden okunuyor. Dosyada başka `key:` alanları da var
 * (paylaşım takvimindeki ızgara/akış görünüm seçici gibi) — hepsini toplamak testi
 * yanıltırdı. */
const dizi = govde.slice(govde.indexOf("const tumSekmeler = ["));
const tumSekmeler = [...dizi.slice(0, dizi.indexOf("];")).matchAll(/\{ key: "(\w+)", label:/g)].map((m) => m[1]);
t("müşteri panelinde yedi sekme var", tumSekmeler.length === 7, tumSekmeler.join(","));
for (const s of ["onay", "revize", "onayli", "takvim", "reklam", "uretim", "talep"]) {
  t(`  ${s} sekmesi tanımlı`, tumSekmeler.includes(s));
}

const kapali = govde.match(/const ORTAGA_KAPALI_SEKMELER = \[([^\]]*)\]/);
t("ortağa kapalı sekme listesi var", Boolean(kapali), kapali && kapali[1]);
t("kapalı olan yalnızca talep", kapali && kapali[1].replace(/["'\s]/g, "") === "talep", kapali && kapali[1]);
t("süzgeç dışlayarak çalışıyor (yeni sekme kendiliğinden ortağa da açılır)",
  /tumSekmeler\.filter\(\(x\) => !ORTAGA_KAPALI_SEKMELER\.includes\(x\.key\)\)/.test(govde));
t("eski beyaz liste kaldırıldı", !govde.includes("ORTAK_SEKMELERI"));
t("ortak da müşteriyle aynı sekmeyle açılıyor",
  /useState\("onay"\)/.test(govde) && !/useState\(ortakModu \? "uretim"/.test(govde));

console.log("\n   Karar düğmeleri ortağa hâlâ kapalı");
t("içerik kartında ortak modu karar yerine durum yazıyor",
  /ortakModu \? \(\s*<div[^>]*>\s*\{icerik\.durum === "bekliyor"/.test(govde));
t("hazır içerik kartında da öyle", /ortakModu \? \(/.test(panel.slice(panel.indexOf("function HazirIcerikler"))));
t("çıkış düğmesi ortakta gizli", govde.includes("const cikisGoster = !ortakModu && onCikis"));

/* ---------------------------------------------------------------- */
console.log("\n2) SUNUCU — ortağa ne gidiyor, ne gitmiyor");

await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger" }, { id: 2, ad: "Mirka Diamond" }],
  stoklar: { "1_Reels": 4, "2_Reels": 9 },
  cekimIsleri: [
    { id: 60, marka: "İbo Burger", kategori: "Video", icerikTuru: "Plak Reels", asama: "Kontrol Bekliyor",
      editliDosyaLink: "https://drive.google.com/file/d/AAAAAAAAAAAA/view" },
    { id: 61, marka: "İbo Burger", kategori: "Grafik Tasarım", icerikTuru: "Tasarım 1", asama: "Onaylandı" },
    { id: 62, marka: "Mirka Diamond", kategori: "Video", icerikTuru: "Reels 7", asama: "Kontrol Bekliyor" },
  ],
  musteriIcerikleri: [
    { id: "ic1", clientId: 1, tur: "gorsel", durum: "bekliyor", aciklama: "afiş",
      driveLinki: "https://drive.google.com/file/d/BBBBBBBBBBBB/view" },
  ],
  reklamlar: [{ id: "r1", marka: "İbo Burger", reklamAdi: "Yaz Kampanyası" }],
  haftalikPaylasimlar: [{ id: "hp1", clientId: 1, gun: "Pazartesi", haftaKey: "2026-08-17", tur: "Reels", yapildi: true, isId: 61, isAdi: "Tasarım 1" }],
  musteriTalepleri: [{ id: "tl1", clientId: 1, tur: "icerik", aciklama: "GİZLİ TALEP METNİ", durum: "bekliyor" }],
  personelHesaplari: [
    PERSONEL("ortak", { musteriAkisi: true, paylasimlar: true }, ["İbo Burger"]),
    /* paylasimlar VARSAYILAN OLARAK AÇIK (DEFAULT_PERMS) — kapalı olduğunu sınamak için
   * açıkça false yazmak gerekiyor. Fixture bunu atlarsa test kendi kendini kandırır. */
    PERSONEL("ortakDar", { musteriAkisi: true, paylasimlar: false, cekimListesi: false }, ["İbo Burger"]),
  ],
  musteriHesaplari: [],
});

let r = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortak"), query: { markaPaneli: "1" } });
t("ortak paneli açabiliyor", r.kod === 200, JSON.stringify(r.govde).slice(0, 100));
const mp = (r.govde && r.govde.markaPaneli) || {};

console.log("\n   Müşterinin gördüğü her bölüm ortağa da gidiyor");
for (const alan of ["icerikler", "hazirIcerikler", "reklamlar", "paylasimPlani", "operasyonIsleri", "marka", "firmaAdi"]) {
  t(`  ${alan} geliyor`, mp[alan] !== undefined, JSON.stringify(mp[alan] || "").slice(0, 60));
}
t("onay bekleyen kart var (sekme boş kalmıyor)",
  (mp.hazirIcerikler || []).some((h) => h.durum === "bekliyor"));
t("paylaşım takvimi dolu", (mp.paylasimPlani || []).length === 1);
t("reklam listesi dolu", (mp.reklamlar || []).length === 1);

console.log("\n   İçerik İste ortağa hiç gitmiyor");
t("talepler alanı yok", mp.talepler === undefined, JSON.stringify(mp.talepler));
t("talep metni yanıtın hiçbir yerinde geçmiyor",
  !JSON.stringify(r.govde).includes("GİZLİ TALEP METNİ"));

console.log("\n   Marka sınırı");
t("başka markanın kartı yok", !(mp.hazirIcerikler || []).some((h) => String(h.isId) === "62"));
r = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortak"), query: { markaPaneli: "2" } });
t("atanmamış marka reddediliyor", r.kod === 403, String(r.kod));

/* ---------------------------------------------------------------- */
console.log("\n3) GÖRSEL VE VİDEO AÇILABİLİYOR MU");

const onizleme = (kim, govdeIstek) => cagir(veriUcu, { method: "POST", headers: KIMLIK(kim), query: {}, body: govdeIstek });

r = await onizleme("ortakDar", { onizlemeAction: "videoJetonu", isId: 60 });
t("ortak kendi markasının kartı için video jetonu alabiliyor",
  r.kod === 200 && r.govde.ok === true && typeof r.govde.adres === "string",
  JSON.stringify(r.govde).slice(0, 120));
t("jeton adresi kartın kimliğini taşıyor", r.govde.adres.includes("video=60"), r.govde.adres);

r = await onizleme("ortakDar", { onizlemeAction: "videoJetonu", icerikId: "ic1" });
t("müşteri içeriği için de jeton alabiliyor", r.kod === 200 && r.govde.ok === true, JSON.stringify(r.govde).slice(0, 120));

r = await onizleme("ortakDar", { onizlemeAction: "videoJetonu", isId: 62 });
t("BAŞKA markanın kartı için jeton alamıyor", r.kod === 403, `${r.kod} ${JSON.stringify(r.govde)}`);

r = await onizleme("ortakDar", { onizlemeAction: "gorsel", isId: 62 });
t("başka markanın görselini de isteyemiyor", r.kod === 403, String(r.kod));

r = await onizleme("ortakDar", { onizlemeAction: "gorsel", isId: 60 });
t("kendi markasının görselini isteyebiliyor (Drive kapalıyken de 403 değil)",
  r.kod === 200, `${r.kod} ${JSON.stringify(r.govde).slice(0, 90)}`);

/* ---------------------------------------------------------------- */
console.log("\n4) ATANMIŞ PANELLER — paylaşım/stok, izin ve marka sınırıyla");

r = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortak"), query: {} });
t("paylaşım izinli ortak stok tablosunu alıyor", Boolean(r.govde.data && r.govde.data.stoklar), JSON.stringify(r.govde.data && r.govde.data.stoklar));
t("yalnızca kendi markasının stoğu", r.govde.data.stoklar["1_Reels"] === 4 && r.govde.data.stoklar["2_Reels"] === undefined,
  JSON.stringify(r.govde.data.stoklar));

r = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortakDar"), query: {} });
const darStok = r.govde.data && r.govde.data.stoklar;
t("paylaşım izni olmayan ortak stok tablosu almıyor",
  !darStok || Object.keys(darStok).length === 0, JSON.stringify(darStok));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
