import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: dat } = await import("../api/data.js");
const { default: yedek } = await import("../api/backup.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

// TAM veri seti — her alan dolu
const TAM = () => ({
  _v: 7,
  clients: [{ id: 1, ad: "A", aylikUcret: 30000, maliyetler: [{ tutar: 5000 }] }, { id: 2, ad: "B", aylikUcret: 20000 }],
  personel: [{ id: 1, ad: "K", maas: 40000 }],
  freelancerlar: [{ id: 1, ad: "F" }],
  cekimIsleri: [{ id: 1, marka: "A", asama: "Onaylandı", editor: "F", uretilenAdet: 3 }],
  musteriIcerikleri: [{ id: 1, clientId: 1, tur: "gorsel", durum: "onaylandi" }],
  haftalikPaylasimlar: [{ id: 1, clientId: 1, haftaKey: "2026-08-10", gun: 2 }],
  gelirKalemleri: [{ id: 1, tutar: 5000 }], giderKalemleri: [{ id: 1, tutar: 1000 }],
  ofisGiderleri: [{ id: 1, tutar: 500 }], bekleyenTahsilatlar: [{ id: 1, tutar: 9000 }],
  hesaplar: [{ id: "ana", ad: "Ana", anaHesap: true }], avanslar: [{ id: 1, tutar: 2000 }],
  personelOdemeleri: [{ id: 1, tutar: 3000 }], birikimler: [{ id: 1, tutar: 10000 }],
  uyelikler: [{ id: 1, marka: "A" }], teklifler: [{ id: 1, marka: "A" }],
  reklamlar: [{ id: 1, marka: "A", butce: 4000 }], silinenler: [{ silmeId: 1 }],
  musteriGirisleri: { 1: { instagram: { kullanici: "x" } } }, stoklar: { "1_Reels": 3 },
  isUcretleri: { F: 1500 }, isUcretDetaylari: {}, kisiselGorevler: [{ id: 1 }],
  monthly: [{ ay: "2026-07", ciro: 50000 }], vergiTakvimi: [{ id: 1 }],
  hesapOlcumleri: [{ id: 1 }], paylasimGecmisi: [{ id: 1 }], markalasmaSurecleri: [{ id: 1 }],
  islemGecmisi: [{ id: 1 }], firmaAdi: "Marcus Medya",
});
const ALANLAR = Object.keys(TAM());

console.log("VERİ BÜTÜNLÜĞÜ KONTROLÜ\n");
await kv.set("marcus-os-data", TAM());

// 1) Okuma — tum alanlar geliyor mu
let r = await cagir(dat, { method: "GET", headers: OWNER, query: {}, body: {} });
const gelen = Object.keys(r.govde.data || {});
const eksik = ALANLAR.filter((a) => !gelen.includes(a));
t(`${ALANLAR.length} alanın hepsi okunuyor`, eksik.length === 0, eksik.length ? "EKSİK: " + eksik.join(", ") : "");

// 2) Yazma — hicbir alan kaybolmuyor mu
const d = r.govde.data;
r = await cagir(dat, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, firmaAdi: "Yeni Ad" }, _v: d._v } });
let son = await kv.get("marcus-os-data");
const kayipYazma = ALANLAR.filter((a) => !(a in son));
t("kayıt sonrası alan kaybı yok", kayipYazma.length === 0, kayipYazma.join(", "));
t("değişiklik kaydedildi", son.firmaAdi === "Yeni Ad");

// 3) Veri kaybi freni
r = await cagir(dat, { method: "POST", headers: OWNER, query: {}, body: { data: { _v: son._v, clients: [], firmaAdi: "x" }, _v: son._v } });
son = await kv.get("marcus-os-data");
t("BOŞ veri yazımı ENGELLENDİ", (son.clients || []).length === 2, `HTTP ${r.kod}, ${(son.clients||[]).length} müşteri`);
t("personel kaydı duruyor", (son.personel || []).length === 1);

// 4) GERÇEK YEDEK AKIŞI: anlık görüntü al → listele → geri yükle
// (backup.js GET yalnızca LİSTE döndürür; veriyi daily-backup üretir. İlk yazdığım test
//  bunu bilmediği için yanlış alarm vermişti.)
const { default: gunlukYedek } = await import("../api/daily-backup.js");
process.env.CRON_SECRET = "gizli";
let ry = await cagir(gunlukYedek, { method: "GET", headers: { authorization: "Bearer gizli" }, query: {}, body: {} });
t("günlük yedek alınabiliyor", ry.kod === 200, `HTTP ${ry.kod}`);
const anahtarlar = await kv.keys("*");
const yedekAnahtar = anahtarlar.filter((x) => x !== "marcus-os-data" && !x.includes("kilit"));
t("anlık görüntü oluştu", yedekAnahtar.length > 0, yedekAnahtar.slice(0,3).join(", "));
if (yedekAnahtar.length) {
  const icerik = await kv.get(yedekAnahtar[0]);
  const yedekteEksik = ALANLAR.filter((a) => !(a in (icerik || {})));
  t("yedek TÜM alanları içeriyor", yedekteEksik.length === 0, yedekteEksik.join(", "));
}

// 5) Silinenler kutusu duruyor mu
t("geri dönüşüm kutusu duruyor", Array.isArray(son.silinenler) && son.silinenler.length === 1);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
