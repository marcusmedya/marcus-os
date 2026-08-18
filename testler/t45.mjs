/* SİSTEM TARAMASINDA BULUNAN İKİ HATA
 *
 * 1. VERİ KAYBI — YARDIMCI UÇLAR SÜRÜM SAYACINI BİLDİRMİYORDU.
 *    /api/manage-staff ve /api/kasa KV'ye yazıp sayacı artırıyor ama yanıtları sayacı
 *    taşımıyordu. Tarayıcı bir tur geride kalıyor; bir sonraki kayıt sahte "başka cihazdan
 *    değişmiş" uyarısı alıyor ve ön yüz kullanıcının O ANKİ düzenlemesini siliyor.
 *    Yani: personel hesabı ekle, sonra bir müşteriyi düzenle -> düzenleme kayboluyordu.
 *
 * 2. MANTIK HATASI — MÜŞTERİ ONAYI STOĞA YANSIMIYORDU.
 *    Stok "elde hazır bekleyen içerik" sayısı ve içerik müşteri onayladığında hazır hale
 *    geliyor. Ama asıl onay yolu (müşteri paneli) stoğu hiç artırmıyordu; üstelik sonraki
 *    normal kayıt kartı "zaten sayılmış" kabul edip işaretliyor ve artış KALICI olarak
 *    kayboluyordu.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const MUSTERI = { "x-musteri-username-b64": b64("m"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const { default: veriUcu } = await import("../api/data.js");
const { default: hesapUcu } = await import("../api/manage-staff.js");
const { default: kasaUcu } = await import("../api/kasa.js");
const oku = () => kv.get("marcus-os-data");

const VERI = () => ({
  _v: 5,
  clients: [{ id: 1, ad: "VIZZ" }],
  stoklar: {},
  cekimIsleri: [{ id: 7, marka: "VIZZ", kategori: "Video", icerikTuru: "Kokteyl Reels",
    asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "a" }], gecmis: [] }],
  personelHesaplari: [],
  musteriHesaplari: [{ id: "m1", ad: "M", kullaniciAdi: "m", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
});

console.log("SİSTEM TARAMASI BULGULARI\n");

/* ---- 1. YARDIMCI UÇLAR SÜRÜMÜ BİLDİRİYOR ---- */
console.log(" Sürüm sayacı yardımcı uçlarda");
await kv.set("marcus-os-data", VERI());
let r = await cagir(hesapUcu, {
  method: "POST", headers: OWNER, query: {},
  body: { action: "ekle", ad: "Yeni", kullaniciAdi: "yeni", sifre: "12345678" },
});
let d = await oku();
t("personel hesabı eklendi", r.kod === 200, `HTTP ${r.kod} ${r.govde.error || ""}`);
t("yanıt _v taşıyor", typeof r.govde._v === "number", String(r.govde._v));
t("yanıttaki _v sunucudakiyle AYNI", r.govde._v === d._v, `yanıt ${r.govde._v} / kv ${d._v}`);

/* Asıl senaryo: hesap ekledikten SONRA yapılan kayıt reddedilmemeli */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, clients: [{ id: 1, ad: "VIZZ", not: "düzenleme" }], _v: undefined }, _v: d._v } });
t("hesap eklendikten sonraki kayıt REDDEDİLMİYOR", r.kod === 200,
  `HTTP ${r.kod} — sahte çakışma olsaydı 409 gelir ve düzenleme silinirdi`);
d = await oku();
t("düzenleme gerçekten kaydedildi", (d.clients[0] || {}).not === "düzenleme", JSON.stringify(d.clients));

await kv.set("marcus-os-data", VERI());
r = await cagir(kasaUcu, { method: "POST", headers: OWNER, query: {}, body: { action: "degistir", yeniSifre: "kasa1234" } });
d = await oku();
t("kasa şifresi kaydedildi", r.kod === 200, `HTTP ${r.kod} ${r.govde.error || ""}`);
t("kasa yanıtı da _v taşıyor", r.govde._v === d._v, `yanıt ${r.govde._v} / kv ${d._v}`);

/* ---- 2. MÜŞTERİ ONAYI STOĞA YANSIYOR ---- */
console.log("\n Müşteri onayı stoğa yansıyor");
await kv.set("marcus-os-data", VERI());
r = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "onayla", isId: 7 } });
d = await oku();
t("onay işlendi", r.kod === 200 && d.cekimIsleri[0].asama === "Onaylandı", d.cekimIsleri[0].asama);
t("STOK ARTTI", d.stoklar["1_Reels"] === 1, JSON.stringify(d.stoklar));
t("kartın türü doğru okundu (Reels, Video değil)", d.stoklar["1_Video"] === undefined, JSON.stringify(d.stoklar));
t("kart sayıldı olarak işaretlendi", d.cekimIsleri[0].stokSayildi === true);

/* Sonraki normal kayıt sayıyı bozmamalı */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d, _v: undefined }, _v: d._v } });
d = await oku();
t("sonraki kayıt stoğu ikiye katlamıyor", d.stoklar["1_Reels"] === 1, JSON.stringify(d.stoklar));

/* Kontrol bekleyen kartta revize: onaya hiç girmediği için stok da oynamamalı. */
await kv.set("marcus-os-data", VERI());
r = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "revizeIste", isId: 7, revizeNotu: "müzik" } });
d = await oku();
t("revize işlendi", d.cekimIsleri[0].asama === "Revize İstendi", d.cekimIsleri[0].asama);
t("onaya girmemiş kartta stok oynamıyor", !d.stoklar["1_Reels"], JSON.stringify(d.stoklar));

/* ONAYLANMIŞ bir kartta müşteri revize isteyemez — sunucu reddetmeli. Reddetmeseydi
 * onaylanmış içerik müşteri tarafından geri çekilebilir ve stok sayımı da kayardı. */
await kv.set("marcus-os-data", { ...VERI(), stoklar: { "1_Reels": 1 },
  cekimIsleri: [{ ...VERI().cekimIsleri[0], asama: "Onaylandı", stokSayildi: true }] });
r = await cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {}, body: { musteriAction: "revizeIste", isId: 7, revizeNotu: "müzik" } });
d = await oku();
t("onaylanmış kartta müşteri revize isteyemiyor", r.kod === 409, `HTTP ${r.kod}`);
t("aşama ve stok dokunulmadan kaldı",
  d.cekimIsleri[0].asama === "Onaylandı" && d.stoklar["1_Reels"] === 1,
  `${d.cekimIsleri[0].asama} / ${JSON.stringify(d.stoklar)}`);

/* Onaydan çıkış (yönetici kartı geri alırsa) stoğu düşürüyor — asıl yol bu. */
r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Revize İstendi" }], _v: undefined }, _v: d._v } });
d = await oku();
t("onaydan çıkınca stok geri düşüyor", d.stoklar["1_Reels"] === 0, JSON.stringify(d.stoklar));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
