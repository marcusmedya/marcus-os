import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const { default: h } = await import("../api/data.js");
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const M = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const KUR = async (talepler = []) => kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "A" }, { id: 2, ad: "B" }],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1","s"), sifreSalt: "s" }],
  musteriIcerikleri: [], cekimIsleri: [], musteriTalepleri: talepler,
});
const talepAt = (t2) => cagir(h, { method: "POST", headers: M, query: {}, body: { musteriAction: "talepOlustur", talep: t2 } });

console.log("İÇERİK TALEBİ\n");
await KUR();
let r = await talepAt({ tur: "Reels", aciklama: "Yeni menü tanıtımı", neZaman: "2026-09-01", referans: "https://x.com/1", acil: true });
let d = await kv.get("marcus-os-data");
t("talep kaydedildi", (d.musteriTalepleri || []).length === 1, `HTTP ${r.kod}`);
const kayit = d.musteriTalepleri[0];
t("kendi markasına bağlandı", String(kayit.clientId) === "1");
t("durum bekliyor", kayit.durum === "bekliyor");
t("alanlar korundu", kayit.tur === "Reels" && kayit.acil === true && kayit.referans === "https://x.com/1");

// Zorunlu alanlar
r = await talepAt({ tur: "", aciklama: "x" });
t("tür boşsa reddedilir", r.kod === 400, `HTTP ${r.kod}`);
r = await talepAt({ tur: "Reels", aciklama: "   " });
t("açıklama boşsa reddedilir", r.kod === 400, `HTTP ${r.kod}`);

// SINIR: 3 acik talep
await KUR([
  { id: 1, clientId: 1, durum: "bekliyor" }, { id: 2, clientId: 1, durum: "bekliyor" }, { id: 3, clientId: 1, durum: "bekliyor" },
]);
r = await talepAt({ tur: "Görsel", aciklama: "dördüncü" });
d = await kv.get("marcus-os-data");
t("4. talep ENGELLENDİ", (d.musteriTalepleri || []).length === 3, `HTTP ${r.kod}`);
t("sebep açıklanıyor", String(r.govde.error || "").includes("3 açık"));

// Sonuclanmislar sayilmaz
await KUR([
  { id: 1, clientId: 1, durum: "onaylandi" }, { id: 2, clientId: 1, durum: "reddedildi" }, { id: 3, clientId: 1, durum: "bekliyor" },
]);
r = await talepAt({ tur: "Görsel", aciklama: "yeni" });
d = await kv.get("marcus-os-data");
t("sonuçlanmış talepler sınıra sayılmaz", (d.musteriTalepleri || []).length === 4, `HTTP ${r.kod}`);

// BASKA markanin talebi sayilmaz ve gorunmez
await KUR([{ id: 1, clientId: 2, durum: "bekliyor", aciklama: "BAŞKA MARKA TALEBİ" }]);
r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
t("başka markanın talebi GÖRÜNMÜYOR", !JSON.stringify(r.govde).includes("BAŞKA MARKA TALEBİ"));
r = await talepAt({ tur: "Reels", aciklama: "benim" });
d = await kv.get("marcus-os-data");
t("başka markanın açık talebi sınırı etkilemiyor", (d.musteriTalepleri || []).length === 2, `HTTP ${r.kod}`);
const benim = d.musteriTalepleri.find((x) => x.aciklama === "benim");
t("clientId tarayıcıdan alınmıyor", String(benim.clientId) === "1");

// Musteri kendi taleplerini goruyor
r = await cagir(h, { method: "GET", headers: M, query: {}, body: {} });
t("müşteri kendi talebini görüyor", (r.govde.talepler || []).length === 1 && r.govde.talepler[0].aciklama === "benim");
console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
