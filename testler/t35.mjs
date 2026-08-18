/* DOSYA YÜKLEMEDEN KONTROLE ÇIKILAMAZ
 *
 * NEDEN BU TEST VAR:
 *   Kart, dosyası olmadan "Kontrol Bekliyor"a geçebiliyordu; müşterinin önüne bakacak bir
 *   şeyi olmayan içerik düşüyordu. Kural artık sunucuda uygulanıyor.
 *
 *   Uygulama biçimi de sınanıyor: kaydın TAMAMI reddedilmemeli. Reddetmek aynı kayıttaki
 *   ilgisiz düzenlemeleri de çöpe atardı — bu projede tam olarak o yoldan veri kaybı
 *   yaşandı. Yalnızca kuralı delen kartın aşaması geri alınmalı.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const PERSONEL = { "x-staff-username-b64": b64("e"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");
const { medyaVarMi, yuklemeAsamasi, dosyasizKontroleGirenleriGeriAl } = await import("../lib/asamalar.js");

const IS = (ek = {}) => ({ id: 7, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels",
  asama: "Edit Yapıldı", editor: "Editör", gecmis: [], ...ek });

const VERI = (isler) => ({
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: isler,
  personel: [{ id: 1, ad: "Editör" }],
  personelHesaplari: [{ id: "e1", ad: "Editör", kullaniciAdi: "e", sifreHash: hash("1234", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true } }],
});
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

console.log("DOSYASIZ KONTROLE ÇIKMA ENGELİ\n");

/* ---- 1. KURALIN KENDİSİ ---- */
console.log(" Kural");
t("dosyası olmayan kart geçersiz", medyaVarMi(IS()) === false);
t("yüklenmiş medya sayılıyor", medyaVarMi(IS({ medya: [{ versiyon: 1, dosyaId: "a" }] })) === true);
t("elle yapıştırılan bağlantı da sayılıyor", medyaVarMi(IS({ editliDosyaLink: "https://x/y" })) === true,
  "WeTransfer ve eski kartlar bu alanı kullanıyor");
t("boş medya dizisi yetmiyor", medyaVarMi(IS({ medya: [] })) === false);
t("video yükleme aşaması", yuklemeAsamasi("Video") === "Edit Yapıldı", yuklemeAsamasi("Video"));
t("fotoğraf yükleme aşaması", yuklemeAsamasi("Fotoğraf") === "Düzenleme Yapıldı", yuklemeAsamasi("Fotoğraf"));
t("tasarım yükleme aşaması", yuklemeAsamasi("Grafik Tasarım") === "Tasarım Yapıldı", yuklemeAsamasi("Grafik Tasarım"));
t("kategorisiz eski kayıt video akışını kullanıyor", yuklemeAsamasi(undefined) === "Edit Yapıldı");

/* ---- 2. YÖNETİCİ KAYDI ---- */
console.log("\n Yönetici kaydı");
await kv.set("marcus-os-data", VERI([IS()]));
let r = await cagri(OWNER, { data: { ...VERI([IS({ asama: "Kontrol Bekliyor" })]), _v: undefined }, _v: 1 });
let d = await kv.get("marcus-os-data");
t("kayıt REDDEDİLMİYOR", r.kod === 200, `HTTP ${r.kod}`);
t("dosyasız kart kontrole geçemiyor", d.cekimIsleri[0].asama === "Edit Yapıldı", d.cekimIsleri[0].asama);
t("sebebi kartın geçmişine yazılıyor",
  (d.cekimIsleri[0].gecmis || []).some((x) => /yüklenmediği için/i.test(x.aciklama || "")),
  JSON.stringify(d.cekimIsleri[0].gecmis));

// Dosyası olan kart geçebilmeli
await kv.set("marcus-os-data", VERI([IS()]));
r = await cagri(OWNER, { data: VERI([IS({ asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "a" }] })]), _v: 1 });
d = await kv.get("marcus-os-data");
t("dosyası olan kart kontrole geçiyor", d.cekimIsleri[0].asama === "Kontrol Bekliyor", d.cekimIsleri[0].asama);

// Zaten Kontrol Bekliyor'da duran ESKİ kart geri alınmamalı
await kv.set("marcus-os-data", VERI([IS({ asama: "Kontrol Bekliyor" })]));
r = await cagri(OWNER, { data: VERI([IS({ asama: "Kontrol Bekliyor", oncelik: "Yüksek" })]), _v: 1 });
d = await kv.get("marcus-os-data");
t("kural öncesinden kalan kartlar geri alınmıyor", d.cekimIsleri[0].asama === "Kontrol Bekliyor", d.cekimIsleri[0].asama);

/* ---- 3. AYNI KAYITTAKİ DİĞER DEĞİŞİKLİKLER KORUNUYOR ----
 * Kaydı tümden reddetmek en kolay yol olurdu ve en pahalı hatayı üretirdi. */
console.log("\n Aynı kayıttaki diğer düzenlemeler");
await kv.set("marcus-os-data", VERI([IS(), IS({ id: 8, icerikTuru: "Story" })]));
r = await cagri(OWNER, { data: VERI([
  IS({ asama: "Kontrol Bekliyor" }),                       // kuralı deliyor
  IS({ id: 8, icerikTuru: "Story", oncelik: "Yüksek" }),   // ilgisiz düzenleme
]), _v: 1 });
d = await kv.get("marcus-os-data");
t("kuralı delen kart geri alındı", d.cekimIsleri[0].asama === "Edit Yapıldı", d.cekimIsleri[0].asama);
t("aynı kayıttaki ilgisiz düzenleme KORUNDU", d.cekimIsleri[1].oncelik === "Yüksek", String(d.cekimIsleri[1].oncelik));

/* ---- 4. PERSONEL KAYDI ---- */
console.log("\n Personel kaydı");
await kv.set("marcus-os-data", VERI([IS()]));
r = await cagri(PERSONEL, { data: { cekimIsleri: [IS({ asama: "Kontrol Bekliyor" })] }, _v: 1 });
d = await kv.get("marcus-os-data");
t("personel de dosyasız kontrole çıkaramıyor", d.cekimIsleri[0].asama === "Edit Yapıldı", d.cekimIsleri[0].asama);

await kv.set("marcus-os-data", VERI([IS()]));
r = await cagri(PERSONEL, { data: { cekimIsleri: [IS({ asama: "Kontrol Bekliyor", editliDosyaLink: "https://x/y" })] }, _v: 1 });
d = await kv.get("marcus-os-data");
t("dosyası olan kartı personel kontrole çıkarabiliyor", d.cekimIsleri[0].asama === "Kontrol Bekliyor", d.cekimIsleri[0].asama);

/* ---- 5. YENİ KART DOĞRUDAN KONTROL BEKLİYOR OLARAK AÇILAMAZ ---- */
console.log("\n Yeni kart");
await kv.set("marcus-os-data", VERI([]));
r = await cagri(OWNER, { data: VERI([IS({ id: 99, asama: "Kontrol Bekliyor" })]), _v: 1 });
d = await kv.get("marcus-os-data");
t("dosyasız yeni kart kontrolde başlayamıyor", d.cekimIsleri[0].asama === "Edit Yapıldı", d.cekimIsleri[0].asama);

/* ---- 6. ÇÖZÜM ORTAĞI UCU ---- */
console.log("\n Çözüm ortağı 'revizeyi tamamla' ucu");
const ORTAK_VERI = (ek) => ({ ...VERI([IS({ asama: "Revize İstendi", ...ek })]),
  personelHesaplari: [{ id: "o1", ad: "Ortak", kullaniciAdi: "o", sifreHash: hash("1234", "s"), sifreSalt: "s",
    izinler: { musteriAkisi: true }, markalar: ["VIZZ"] }] });
const ORTAK = { "x-staff-username-b64": b64("o"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

await kv.set("marcus-os-data", ORTAK_VERI({}));
r = await cagri(ORTAK, { ortakAction: "asamaIlerlet", isId: 7, hedefAsama: "Kontrol Bekliyor" });
d = await kv.get("marcus-os-data");
t("dosyasız kart reddediliyor", r.kod === 400, `HTTP ${r.kod}`);
t("hata ne yapılacağını söylüyor", /yükle/i.test(r.govde.error || ""), r.govde.error);
t("aşama değişmedi", d.cekimIsleri[0].asama === "Revize İstendi", d.cekimIsleri[0].asama);

await kv.set("marcus-os-data", ORTAK_VERI({ medya: [{ versiyon: 2, dosyaId: "b" }] }));
r = await cagri(ORTAK, { ortakAction: "asamaIlerlet", isId: 7, hedefAsama: "Kontrol Bekliyor" });
d = await kv.get("marcus-os-data");
t("dosyası olan kart geçiyor", r.kod === 200 && d.cekimIsleri[0].asama === "Kontrol Bekliyor",
  `HTTP ${r.kod} / ${d.cekimIsleri[0].asama}`);

/* ---- 7. GERİ ALMA HEDEFİ ---- */
console.log("\n Geri alınan kart nereye düşüyor");
{
  const zaman = "01.01.2026 10:00";
  const sonuc = dosyasizKontroleGirenleriGeriAl(
    [{ id: 1, asama: "Edit Yapılıyor" }],
    [{ id: 1, asama: "Kontrol Bekliyor", kategori: "Video" }], zaman);
  t("kart geldiği aşamaya dönüyor", sonuc && sonuc[0].asama === "Edit Yapılıyor", sonuc && sonuc[0].asama);

  const yeni = dosyasizKontroleGirenleriGeriAl(
    [], [{ id: 2, asama: "Kontrol Bekliyor", kategori: "Grafik Tasarım" }], zaman);
  t("öncesi olmayan kart kategorisinin yükleme aşamasına düşüyor",
    yeni && yeni[0].asama === "Tasarım Yapıldı", yeni && yeni[0].asama);

  t("kural sağlanıyorsa hiç dokunulmuyor",
    dosyasizKontroleGirenleriGeriAl([], [{ id: 3, asama: "Kontrol Bekliyor", medya: [{ dosyaId: "a" }] }], zaman) === null);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
