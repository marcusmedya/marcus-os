import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: dataH } = await import("../api/data.js");
const { default: pay } = await import("../api/paylasim.js");
const { default: cp } = await import("../api/client-payment.js");

console.log("VERİ KAYBI RİSK DENETİMİ\n");

// 1) EŞZAMANLI YAZMA: iki farklı uç nokta ayni anda yazarsa biri digerini siler mi?
await kv.set("marcus-os-data", TEMIZ_VERI());
await Promise.all([
  cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 6 } }),
  cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "haftalikAltMetin", planId: 1, altMetin: "A" } }),
  cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "subeEkle", clientId: 1, ad: "Şube X" } }),
]);
let son = await kv.get("marcus-os-data");
kontrol("eşzamanlı 3 yazma: stok korundu", son.stoklar["1_Reels"] === 11, JSON.stringify(son.stoklar));
kontrol("eşzamanlı 3 yazma: alt metin korundu", (son.haftalikPaylasimlar.find(p=>p.id===1)||{}).altMetin === "A");
kontrol("eşzamanlı 3 yazma: şube korundu", (son.subeler||[]).some(s=>s.ad==="Şube X"), `${(son.subeler||[]).length} şube`);

// 2) FARKLI UÇ NOKTALAR ayni anda
await kv.set("marcus-os-data", TEMIZ_VERI());
await Promise.all([
  cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "stokDegistir", clientId: 1, tur: "Reels", delta: 50 } }),
  cagir(cp, { method: "POST", headers: OWNER, query: {}, body: { action: "setOdemeGunu", clientId: 1, odemeGunu: 7 } }),
]);
son = await kv.get("marcus-os-data");
const c1 = (son.clients||[]).find(c=>c.id===1) || {};
kontrol("iki farklı uç nokta: stok korundu", son.stoklar["1_Reels"] === 55, String(son.stoklar["1_Reels"]));
kontrol("iki farklı uç nokta: ödeme günü korundu", c1.odemeGunu === 7, String(c1.odemeGunu));

// 3) VERSIYON SAYACI her yazmada artiyor mu (bayat sekme korumasi)
await kv.set("marcus-os-data", TEMIZ_VERI());
const v0 = (await kv.get("marcus-os-data"))._v || 0;
await cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "stokDegistir", clientId: 1, tur: "Post", delta: 2 } });
const v1 = (await kv.get("marcus-os-data"))._v || 0;
kontrol("paylasim yazması sayacı artırıyor", v1 > v0, `${v0} → ${v1}`);

// 4) BAYAT SEKME: eski _v ile yazma reddediliyor mu
let gr = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
const eski = gr.govde.data;
await cagir(pay, { method: "POST", headers: OWNER, query: {}, body: { action: "stokDegistir", clientId: 1, tur: "Post", delta: 99 } });
const w = await cagir(dataH, { method: "POST", headers: OWNER, query: {}, body: { data: { ...eski, firmaAdi: "BAYAT" }, _v: eski._v } });
son = await kv.get("marcus-os-data");
kontrol("bayat sekme reddedildi (409)", w.kod === 409, `HTTP ${w.kod}`);
kontrol("araya giren değişiklik korundu", son.stoklar["1_Post"] === 101, String(son.stoklar["1_Post"]));

/* ---------------------------------------------------------------- */
/* ALT YAZI TEK BAŞINA KAYDEDİLİNCE GÖRSEL SİLİNMEMELİ.
 *
 * Paylaşım ekranı (v162) alt yazıyı "paylaşıldı" işaretlemeden hemen ÖNCE tek başına
 * kaydediyor. Uç yalnızca GÖNDERİLEN alanı değiştiriyor; bu korunma bozulursa her
 * paylaşımda planın müşteri panelindeki görseli sessizce silinirdi — kimse fark etmeden.
 * Korunma vardı ama hiçbir kontrol onu sınamıyordu. */
console.log("\n ALT YAZI / GÖRSEL — biri diğerini silmiyor");
{
  const veri = TEMIZ_VERI();
  veri.haftalikPaylasimlar = [{ id: 1, clientId: 1, gun: "Pzt", tur: "Reels",
    altMetin: "eski metin", gorselUrl: "https://ornek/gorsel.jpg" }];
  await kv.set("marcus-os-data", veri);

  await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "haftalikAltMetin", planId: 1, altMetin: "yeni metin" } });
  let d = await kv.get("marcus-os-data");
  let plan = d.haftalikPaylasimlar[0];
  kontrol("alt yazı güncellendi", plan.altMetin === "yeni metin", plan.altMetin);
  kontrol("GÖRSEL SİLİNMEDİ", plan.gorselUrl === "https://ornek/gorsel.jpg",
    String(plan.gorselUrl) + " — her paylaşımda müşteri panelindeki görsel uçardı");

  await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "haftalikAltMetin", planId: 1, gorselUrl: "https://ornek/yeni.jpg" } });
  d = await kv.get("marcus-os-data");
  plan = d.haftalikPaylasimlar[0];
  kontrol("görsel güncellendi", plan.gorselUrl === "https://ornek/yeni.jpg", String(plan.gorselUrl));
  kontrol("ALT YAZI SİLİNMEDİ", plan.altMetin === "yeni metin", String(plan.altMetin));

  await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "haftalikAltMetin", planId: 1, altMetin: "   " } });
  d = await kv.get("marcus-os-data");
  kontrol("boş alt yazı temizleniyor", d.haftalikPaylasimlar[0].altMetin === null,
    String(d.haftalikPaylasimlar[0].altMetin));
  kontrol("boşaltmada da görsel duruyor", d.haftalikPaylasimlar[0].gorselUrl === "https://ornek/yeni.jpg");
}

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
