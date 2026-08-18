/* DRIVE TAŞIMA — YÖNETİCİ (OWNER) KAYIT YOLU
 *
 * NEDEN BU TEST VAR: v155'te taşıma tetikleyicisi yalnızca PERSONEL kayıt yolunda
 * çağrılıyordu. Yönetici — yani sistemi asıl kullanan kişi — bir işi "Teslim Edildi"ye
 * aldığında taşıma hiç tetiklenmiyor, üstelik geçmişe hiçbir not da düşmüyordu. Sessiz
 * olduğu için canlıda ancak Drive'a elle bakılarak fark edildi.
 *
 * Bu test iki şeyi birden korur:
 *   1. Tetikleyici HER İKİ kayıt yolunda da çalışıyor mu
 *   2. Taşıma yapılamadığında geçmişe MUTLAKA bir sebep yazılıyor mu (sessizlik yasak)
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.DRIVE_ONAY_KLASOR_ID;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const PERSONEL = { "x-staff-username-b64": b64("p"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

const TEMEL = (asama, link) => ({
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" }],
  cekimIsleri: [{ id: 7, marka: "VIZZ", kategori: "Video", asama, editliDosyaLink: link, gecmis: [] }],
  personelHesaplari: [{ id: "p1", ad: "P", kullaniciAdi: "p", sifreHash: hash("1234", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true, musteriler: true } }],
  musteriHesaplari: [],
});
const DRIVE_LINK = "https://drive.google.com/file/d/1AbC_def-123456/view";
const notlar = (d) => JSON.stringify((d.cekimIsleri[0] || {}).gecmis || []);

console.log("DRIVE TAŞIMA — KAYIT YOLLARI\n");

/* ---- 1. YÖNETİCİ YOLU: asıl kaçan hata ---- */
console.log(" Yönetici (owner) kaydı");
await kv.set("marcus-os-data", TEMEL("Onaylandı", DRIVE_LINK));
let d0 = await kv.get("marcus-os-data");
let r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Teslim Edildi" }] }, _v: d0._v } });
let d = await kv.get("marcus-os-data");
t("kayıt başarılı", r.kod === 200, `HTTP ${r.kod}`);
t("aşama Teslim Edildi olarak kaydedildi", d.cekimIsleri[0].asama === "Teslim Edildi");
t("GEÇMİŞE DRIVE NOTU DÜŞTÜ (sessiz kalmadı)", notlar(d).includes("Drive"), notlar(d).slice(0, 90));

/* SÜRÜM SAYACI — BU BİR KEZ VERİ KAYBI ÜRETTİ.
 * Not düşmek ikinci bir yazmadır ve _v'yi bir daha artırır. Yanıt eski _v'yi döndürürse
 * tarayıcı bir tur geride kalır, sonraki kayıt sahte staleConflict alır ve ön yüz
 * kullanıcının o anki düzenlemesini sunucu verisiyle EZER. */
t("yanıttaki _v, KV'deki _v ile AYNI", r.govde._v === d._v, `yanıt ${r.govde._v} / KV ${d._v}`);

const duzenleme = { ...d, clients: [{ ...d.clients[0], aylikUcret: 42000 }] };
const r2 = await cagir(h, { method: "POST", headers: OWNER, query: {}, body: { data: duzenleme, _v: r.govde._v } });
const d2 = await kv.get("marcus-os-data");
t("sonraki kayıt sahte çakışma ALMADI", r2.kod === 200, `HTTP ${r2.kod}${r2.govde.staleConflict ? " staleConflict" : ""}`);
t("kullanıcının düzenlemesi KAYBOLMADI", d2.clients[0].aylikUcret === 42000);
t("kilit serbest kaldı (sonraki kayıt geçiyor)",
  (await cagir(h, { method: "POST", headers: OWNER, query: {}, body: { data: { ...d2 }, _v: d2._v } })).kod === 200);

/* ---- 2. PERSONEL YOLU: eskiden çalışan taraf bozulmadı mı ---- */
console.log("\n Personel kaydı");
await kv.set("marcus-os-data", TEMEL("Onaylandı", DRIVE_LINK));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: PERSONEL, query: {},
  body: { data: { cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Teslim Edildi" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("kayıt başarılı", r.kod === 200, `HTTP ${r.kod}`);
t("geçmişe Drive notu düştü", notlar(d).includes("Drive"), notlar(d).slice(0, 90));

/* ---- 3. BAĞLANTI YOKKEN SESSİZ KALMA ---- */
console.log("\n Kartta dosya bağlantısı yokken");
await kv.set("marcus-os-data", TEMEL("Onaylandı", ""));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Teslim Edildi" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("kayıt yine başarılı", r.kod === 200, `HTTP ${r.kod}`);
t("sebep geçmişe yazıldı, sessiz kalmadı", notlar(d).includes("dosya bağlantısı yok"), notlar(d).slice(0, 90));

/* ---- 4. AYNI AŞAMA TEKRAR KAYDEDİLİRSE İKİNCİ KEZ TAŞINMAZ ---- */
console.log("\n Zaten Teslim Edildi olan iş tekrar kaydedilince");
await kv.set("marcus-os-data", TEMEL("Teslim Edildi", DRIVE_LINK));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, cekimIsleri: [{ ...d0.cekimIsleri[0], brief: "değişti" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("kayıt başarılı", r.kod === 200, `HTTP ${r.kod}`);
t("yeni Drive notu EKLENMEDİ (tekrar taşıma yok)", !notlar(d).includes("Drive"), notlar(d).slice(0, 60));

/* ---- 5. TAŞIMA ÇÖKSE BİLE KAYIT GEÇERLİ ---- */
console.log("\n Drive tamamen kurulu değilken kayıt bozulmuyor");
await kv.set("marcus-os-data", TEMEL("Onaylandı", DRIVE_LINK));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, clients: [{ ...d0.clients[0], aylikUcret: 15000 }],
    cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Teslim Edildi" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("diğer alan da kaydedildi", d.clients[0].aylikUcret === 15000, `HTTP ${r.kod}`);
t("müşteri kaydı kaybolmadı", d.clients.length === 1);

/* ---- 6. İKİ YÖNLÜ TAKİP: aşama geri alınınca dosya da geri gelmeli ---- */
console.log("\n Aşama geri alındığında");
await kv.set("marcus-os-data", TEMEL("Teslim Edildi", DRIVE_LINK));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Onaylandı" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("geri alma da taşımayı tetikliyor", notlar(d).includes("Drive"), notlar(d).slice(0, 80));
t("yanıt _v'si KV ile aynı", r.govde._v === d._v, `yanıt ${r.govde._v} / KV ${d._v}`);

/* ---- 7. ERKEN AŞAMALARDA DOSYAYA DOKUNULMAZ ---- */
console.log("\n Erken aşamalarda (ekibin çalışma alanı)");
await kv.set("marcus-os-data", TEMEL("Çekim Yapıldı", DRIVE_LINK));
d0 = await kv.get("marcus-os-data");
r = await cagir(h, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d0, cekimIsleri: [{ ...d0.cekimIsleri[0], asama: "Edit Yapılıyor" }] }, _v: d0._v } });
d = await kv.get("marcus-os-data");
t("Edit Yapılıyor'a geçişte taşıma YOK", !notlar(d).includes("Drive"), notlar(d).slice(0, 60));
t("yanıt _v'si KV ile aynı", r.govde._v === d._v, `yanıt ${r.govde._v} / KV ${d._v}`);

/* ---- 8. AŞAMA -> KLASÖR EŞLEMESİ ---- */
console.log("\n Aşama-klasör eşlemesi");
for (const [asama, beklenen] of [["Kontrol Bekliyor", "ONAY BEKLEYENLER"], ["Revize İstendi", "ONAY BEKLEYENLER"],
                                  ["Onaylandı", "ONAYLANANLAR"], ["Teslim Edildi", "PAYLAŞILDI"]]) {
  await kv.set("marcus-os-data", TEMEL("Edit Yapılıyor", DRIVE_LINK));
  const dd = await kv.get("marcus-os-data");
  await cagir(h, { method: "POST", headers: OWNER, query: {},
    body: { data: { ...dd, cekimIsleri: [{ ...dd.cekimIsleri[0], asama }] }, _v: dd._v } });
  const son = await kv.get("marcus-os-data");
  t(`${asama} -> taşıma denendi`, notlar(son).includes("Drive"), beklenen);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
