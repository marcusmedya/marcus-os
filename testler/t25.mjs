import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
let n = 0;
const not = (s, b, d) => { n++; console.log(`  ${s} ${b}\n      ${d}`); };
const ok = (b) => console.log(`  ✓ ${b}`);
const KAPALI = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false, musteriAkisi: false };

console.log("MÜŞTERİ ↔ ORTAK AYNA DOĞRULAMASI\n");
await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", logoUrl: "LOGO" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
  personelHesaplari: [{ id: "p1", ad: "O", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s", izinler: { ...KAPALI, musteriAkisi: true }, markalar: ["İbo Burger"] }],
  musteriIcerikleri: [
    { id: 1, clientId: 1, tur: "gorsel", aciklama: "G1", durum: "bekliyor", driveLinki: "L1", sira: 1 },
    { id: 2, clientId: 1, tur: "cekim", aciklama: "Plan", durum: "onaylandi", referansLink: "R", konusmaMetni: "M" },
  ],
  cekimIsleri: [
    { id: 10, marka: "İbo Burger", asama: "Kontrol Bekliyor", icerikTuru: "R1", editliDosyaLink: "D1" },
    { id: 11, marka: "İbo Burger", asama: "Onaylandı", icerikTuru: "R2", editliDosyaLink: "D2" },
    { id: 12, marka: "İbo Burger", asama: "Revize İstendi", icerikTuru: "R3", musteriRevizeNotu: "Müzik" },
    { id: 13, marka: "İbo Burger", asama: "Edit Yapılıyor", icerikTuru: "GİZLİ" },
  ],
  haftalikPaylasimlar: [{ id: 1, clientId: 1, haftaKey: "2026-08-10", gun: 2, tur: "Reels", yapildi: false }],
  reklamlar: [{ id: 1, marka: "İbo Burger", reklamAdi: "K1", butce: 5000 }],
});

const mus = await cagir(h, { method: "GET", headers: { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1") }, query: {}, body: {} });
const ort = await cagir(h, { method: "GET", headers: { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1") }, query: { markaPaneli: "1" }, body: {} });

const m = mus.govde || {};
const o = ort.govde.markaPaneli || {};
const ALANLAR = ["marka", "markaLogo", "ajansLogo", "firmaAdi", "icerikler", "hazirIcerikler", "reklamlar", "paylasimPlani", "operasyonIsleri"];
const farkli = ALANLAR.filter((a) => JSON.stringify(m[a]) !== JSON.stringify(o[a]));
if (farkli.length) not("🚨", "Müşteri ve ortak FARKLI veri görüyor", `Ayrışan alanlar: ${farkli.join(", ")}`);
else ok(`9 alanın hepsi birebir aynı — ayna gerçekten tek kaynaktan`);

// Ortakta fazladan bir sey var mi
const fazla = Object.keys(o).filter((k) => !ALANLAR.includes(k));
if (fazla.length) not("⚠", "Ortak yanıtında fazladan alan", fazla.join(", "));
else ok("ortak yanıtında fazladan alan yok");

/* Üretimdeki iş operasyonIsleri (Üretim Durumu sekmesi) içinde GÖRÜNÜR — bu amaçlı:
 * müşteri işin hangi aşamada olduğunu görmeli. Kontrol edilmesi gereken, o kayıtta İÇ
 * ALANLARIN olmaması. (İlk yazdığım test bunu sızıntı sanmıştı — yanlış varsayımdı.) */
const uretim = (o.operasyonIsleri || [])[0] || {};
const izinliAlanlar = ["id", "icerikTuru", "kategori", "asama", "cekimTarihi", "teslimTarihi", "teslimEdilmeTarihi", "uretilenAdet"];
const fazlaAlan = Object.keys(uretim).filter((x) => !izinliAlanlar.includes(x));
if (fazlaAlan.length) not("🚨", "Üretim durumunda fazladan alan", fazlaAlan.join(", "));
else ok("üretim durumu yalnızca 8 güvenli alan taşıyor (brief/kameraman yok)");

console.log(`\nBULGU: ${n}`);
