import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const KAPALI = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false, musteriAkisi: false };
const H = { "x-staff-username-b64": b64("t"), "x-staff-password-b64": b64("1"), "content-type": "application/json" };
const VERI = (izinler) => ({ _v: 1, clients: [{ id: 1, ad: "A" }, { id: 2, ad: "B" }], personel: [{ id: 1, ad: "K", maas: 5 }], vergiTakvimi: [], hesaplar: [{ id: "ana", ad: "Ana", anaHesap: true }], gelirKalemleri: [],
  personelHesaplari: [{ id: "p1", ad: "T", kullaniciAdi: "t", sifreHash: hash("1", "s"), sifreSalt: "s", izinler }] });

const dene = async (izinler, degistir) => {
  await kv.set("marcus-os-data", VERI(izinler));
  const r0 = await cagir(h, { method: "GET", headers: H, query: {}, body: {} });
  const d = r0.govde.data;
  await cagir(h, { method: "POST", headers: H, query: {}, body: { data: degistir(d), _v: d._v } });
  return await kv.get("marcus-os-data");
};

console.log("BULGU 2-3 DOĞRULAMA — meşru kullanım hâlâ çalışıyor mu\n");
let s = await dene({ ...KAPALI, takvim: true }, (d) => ({ ...d, vergiTakvimi: [{ id: 1, ad: "KDV" }] }));
t("Takvim izni VERGİ TAKVİMİNİ yazabiliyor", (s.vergiTakvimi || []).length === 1);

s = await dene({ ...KAPALI, finans: true }, (d) => ({ ...d, personel: [{ id: 1, ad: "K", maas: 99 }] }));
t("Finans izni maaş yazabiliyor (meşru)", (s.personel[0] || {}).maas === 99);

s = await dene({ ...KAPALI, musteriler: true }, (d) => ({ ...d, clients: [{ id: 1, ad: "YENİ AD" }, { id: 2, ad: "B" }] }));
t("Müşteriler izni müşteri adını yazabiliyor (meşru)", (s.clients.find(c => c.id === 1) || {}).ad === "YENİ AD");

s = await dene({ ...KAPALI, dashboard: true }, (d) => ({ ...d, gelirKalemleri: [{ id: 9 }] }));
t("Dashboard izni artık HİÇBİR ŞEY yazamıyor", (s.gelirKalemleri || []).length === 0);

// Dashboard hala OKUYABILIYOR mu (ekran bos kalmasin)
await kv.set("marcus-os-data", VERI({ ...KAPALI, dashboard: true }));
const r = await cagir(h, { method: "GET", headers: H, query: {}, body: {} });
const dd = r.govde.data || {};
t("Dashboard izni verileri OKUYABİLİYOR (ekran boş değil)", Array.isArray(dd.clients) && Array.isArray(dd.personel), `clients:${(dd.clients||[]).length} personel:${(dd.personel||[]).length}`);
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
