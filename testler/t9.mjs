import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
process.env.BACKUP_EMAIL = "a@x.com, b@y.com";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

console.log("GÜVENLİK VE VERİ GELİŞTİRMELERİ DENETİMİ\n");
const { default: dataH } = await import("../api/data.js");
const { default: backup } = await import("../api/backup.js");
const { default: staff } = await import("../api/manage-staff.js");

// 1) Guvenlik durumu owner'a gonderiliyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
let r = await cagir(dataH, { method: "GET", headers: OWNER, query: {}, body: {} });
kontrol("güvenlik durumu gönderiliyor", !!r.govde.guvenlik, JSON.stringify(r.govde.guvenlik));
kontrol("yedek adresi sayısı doğru", r.govde.guvenlik.yedekEpostaSayisi === 2);

// 2) silinenler personele gitmiyor mu
const KIMLIK = { "x-staff-username-b64": Buffer.from("ortak").toString("base64"), "x-staff-password-b64": Buffer.from("1234").toString("base64") };
const v = TEMIZ_VERI(); v.silinenler = [{ silmeId: "x", tur: "Müşteri", etiket: "GİZLİ SILINEN" }];
await kv.set("marcus-os-data", v);
r = await cagir(dataH, { method: "GET", headers: KIMLIK, query: {}, body: {} });
kontrol("silinenler kutusu personele sızmıyor", !JSON.stringify(r.govde.data || {}).includes("GİZLİ SILINEN"));

// 3) guvenlik defteri: basarisiz giris yaziliyor mu
await kv.set("marcus-os-data", TEMIZ_VERI());
await cagir(dataH, { method: "POST", headers: { "content-type": "application/json" }, query: {}, body: { authAction: "girisBasla", sifre: "yanlis" } });
r = await cagir(dataH, { method: "GET", headers: OWNER, query: { defter: "1" }, body: {} });
kontrol("başarısız giriş deftere yazıldı", (r.govde.defter || []).some(x => x.olay === "giris-basarisiz"), `${(r.govde.defter||[]).length} kayıt`);

// 4) geri yukleme deftere yaziliyor + defter geri yuklemeyle SILINMIYOR
const anahtarlar = await kv.keys("marcus-os-snapshot-*");
if (anahtarlar.length) {
  const oncekiDefter = (await kv.get("marcus-os-guvenlik-defteri")) || [];
  await cagir(backup, { method: "POST", headers: OWNER, query: {}, body: { key: anahtarlar[0] } });
  const sonraDefter = (await kv.get("marcus-os-guvenlik-defteri")) || [];
  kontrol("geri yükleme deftere yazıldı", sonraDefter.some(x => x.olay === "yedek-geri-yuklendi"));
  kontrol("defter geri yüklemeyle SİLİNMEDİ", sonraDefter.length >= oncekiDefter.length, `${oncekiDefter.length} → ${sonraDefter.length}`);
}

// 5) hesap islemi deftere yaziliyor mu
await cagir(staff, { method: "POST", headers: OWNER, query: {}, body: { action: "ekle", ad: "Test", kullaniciAdi: "test", sifre: "1234" } });
const d2 = (await kv.get("marcus-os-guvenlik-defteri")) || [];
kontrol("hesap işlemi deftere yazıldı", d2.some(x => x.olay === "hesap-islemi"));

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
