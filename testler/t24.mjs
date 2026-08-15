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
const H = { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };
const VERI = (izinler, markalar) => ({
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger", aylikUcret: 45000, gizliNot: "İÇ NOT" }, { id: 2, ad: "GİZLİ Marka" }],
  musteriIcerikleri: [{ id: 1, clientId: 1, tur: "gorsel", durum: "onaylandi", onaylayan: "Yönetici", kaynakIsId: null, icMaliyet: 777 }],
  cekimIsleri: [{ id: 10, marka: "İbo Burger", asama: "Onaylandı", icerikTuru: "R", brief: "İÇ BRIEF", kameraman: "KİŞİ", yorumlar: [{ x: "İÇ YORUM" }], isUcreti: 1500 }],
  gelirKalemleri: [{ id: 1, x: "GİZLİ GELİR" }],
  personel: [{ id: 1, ad: "GİZLİ PERSONEL", maas: 60000 }],
  musteriGirisleri: { 1: { instagram: { sifre: "GİZLİ ŞİFRE" } } },
  personelHesaplari: [
    { id: "p1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1", "s"), sifreSalt: "s", izinler, markalar },
    { id: "p2", ad: "Diğer", kullaniciAdi: "d", sifreHash: hash("1", "s"), sifreSalt: "s", izinler: { ...KAPALI }, markalar: [] },
  ],
});

console.log("ORTAK PANELİ — SALDIRI TARAMASI\n");
await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, ["İbo Burger"]));

// 1) Sizinti taramasi
let r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
const metin = JSON.stringify(r.govde);
const tuzaklar = ["İÇ NOT", "İÇ BRIEF", "KİŞİ", "İÇ YORUM", "GİZLİ GELİR", "GİZLİ PERSONEL", "GİZLİ ŞİFRE", "45000", "60000", "1500", "777", "Yönetici", "sifreHash", "GİZLİ Marka"];
const sizan = tuzaklar.filter((x) => metin.includes(x));
if (sizan.length) not("🚨", "Ortak paneline sızıntı", sizan.join(", "));
else ok(`14 tuzak alanının hiçbiri sızmıyor`);

// 2) markaPaneli parametresi ile oynama
for (const [ad, deger] of [["boş", ""], ["yıldız", "*"], ["dizi", ["1","2"]], ["nesne", { id: 1 }], ["negatif", "-1"], ["çok büyük", "99999999"], ["SQL benzeri", "1 OR 1=1"]]) {
  r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: deger }, body: {} });
  const gecti = r.kod === 200 && r.govde.markaPaneli;
  if (gecti) not("🚨", `markaPaneli="${ad}" KABUL EDİLDİ`, JSON.stringify(r.govde).slice(0, 120));
}
ok("bozuk markaPaneli değerleri reddediliyor");

// 3) Marka kilidi olmayan hesap
await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, []));
r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
if (r.kod === 200) not("🚨", "Kilitsiz hesap marka paneline girdi", `HTTP ${r.kod}`);
else ok(`kilitsiz hesap reddediliyor (${r.kod})`);

// 4) Yetkisiz hesapla ortak islemi
await kv.set("marcus-os-data", VERI({ ...KAPALI, musteriAkisi: true }, ["İbo Burger"]));
const D = { "x-staff-username-b64": b64("d"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };
r = await cagir(h, { method: "POST", headers: D, query: {}, body: { ortakAction: "asamaIlerlet", isId: 10, hedefAsama: "Kontrol Bekliyor" } });
let d = await kv.get("marcus-os-data");
if ((d.cekimIsleri[0] || {}).asama !== "Onaylandı") not("🚨", "Yetkisiz hesap iş ilerletti", `HTTP ${r.kod}`);
else ok(`yetkisiz hesabın iş ilerletmesi engellendi (${r.kod})`);

// 5) Musteri hesabiyla ortak ucuna erisim
const M = { "x-musteri-username-b64": b64("x"), "x-musteri-password-b64": b64("1") };
r = await cagir(h, { method: "GET", headers: M, query: { markaPaneli: "1" }, body: {} });
if (r.kod === 200 && r.govde.markaPaneli) not("🚨", "Müşteri hesabı ortak ucuna erişti", `HTTP ${r.kod}`);
else ok(`müşteri hesabı ortak ucuna erişemiyor (${r.kod})`);

// 6) Silinmis marka
await kv.set("marcus-os-data", { ...VERI({ ...KAPALI, musteriAkisi: true }, ["İbo Burger"]), clients: [] });
r = await cagir(h, { method: "GET", headers: H, query: { markaPaneli: "1" }, body: {} });
if (r.kod === 200) not("⚠", "Silinmiş markanın paneli açıldı", `HTTP ${r.kod}`);
else ok(`silinmiş marka reddediliyor (${r.kod})`);

console.log(`\nBULGU: ${n}`);
