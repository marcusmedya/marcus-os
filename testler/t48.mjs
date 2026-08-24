/* STOK: TÜR DÜŞÜMÜ, ANLIK YANSIMA VE MARKA KİLİDİ
 *
 * 1. TÜR DÜŞÜMÜ. Türler ÜÇE indi: Reels · Post · Carousel (v160). Tasarım ve görsel
 *    işleri POST'a, video işleri REELS'e sayılıyor. Sıra hâlâ önemli: "video tasarımı"
 *    hareketli bir iştir, Post'a değil Reels'e yazılmalı.
 *
 * 2. ANLIK YANSIMA. Stok artışını sunucu hesaplıyor ama yanıt yalnızca _v taşıyordu.
 *    Kart onaylanınca stok gerçekten artıyor, Paylaşımlar panelindeki sayı ise sayfa
 *    yenilenene kadar ESKİ hâlinde kalıyordu — "onayladım, stok artmadı" görüntüsünün
 *    sebebi buydu. Yanıt artık sunucunun hesapladığı stoğu geri veriyor.
 *
 * 3. MARKA KİLİDİ. (2) eklenirken açılan kapı: stokSonuc.stoklar TÜM markaların sayılarını
 *    taşıyor. Olduğu gibi gönderilseydi, yalnızca kendi markasına yetkili bir personel
 *    POST yanıtında bütün ajansın stok tablosunu görürdü — GET'te özenle süzülen bilgi
 *    arka kapıdan sızardı. Okumadaki süzgecin aynısı POST yanıtına da uygulanıyor.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { paylasimTuru, PAYLASIM_TURLERI, stokYanitiniUygula, stokAnahtari } from "../lib/stok.js";
process.env.SITE_PASSWORD = "ownerpw";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* ---------------------------------------------------------------- */
console.log("\n1) TASARIM TÜRÜ");

const tur = (icerikTuru, kategori) => paylasimTuru({ icerikTuru, kategori });
/* KURAL DEĞİŞİKLİĞİ — v160. Türler ÜÇE indi: Reels · Post · Carousel.
 * "Tasarım", "Görsel", "Story" ve "Video" ayrı stok satırı değil artık; tasarım ve
 * görsel işleri POST, video işleri REELS sayılıyor. Story ikinci bir içerik değil,
 * aynı gönderinin story boyutu. Bu satırları eski hâline döndürme. */
t("liste tam olarak üç tür", PAYLASIM_TURLERI.join(",") === "Reels,Post,Carousel", PAYLASIM_TURLERI.join(","));
t("adında tasarım geçen kart POST", tur("Logo Tasarımı", "Grafik Tasarım") === "Post");
t("adı boş, eski Grafik Tasarım kartı POST", tur("", "Grafik Tasarım") === "Post");
t("İngilizce 'design' de POST", tur("Menu Design", "Grafik Tasarım") === "Post");
t("video tasarımı REELS'e yazılıyor (sıra doğru)", tur("Video Tasarımı", "Video") === "Reels", tur("Video Tasarımı", "Video"));
t("Reels hâlâ Reels", tur("Kokteyl Reels", "Video") === "Reels");
t("eski Fotoğraf kartı POST", tur("", "Fotoğraf") === "Post");
t("adında görsel geçen kart POST", tur("Görsel 3", "Fotoğraf") === "Post");
t("Story POST'a sayılıyor, Carousel kendi türünde",
  tur("Story 1", "Video") === "Post" && tur("Carousel 2", "Fotoğraf") === "Carousel");

t("kartta açık paylasimTuru varsa o kazanıyor",
  paylasimTuru({ icerikTuru: "Logo Tasarımı", paylasimTuru: "Carousel" }) === "Carousel");

console.log("\n   Tür listesi tek kaynakta mı");
const app = fs.readFileSync(path.join(kok, "src", "App.jsx"), "utf8");
t("App.jsx kendi tür listesini yazmıyor",
  !/const PAYLASIM_TURLERI = \[/.test(app));
t("App.jsx kendi stok anahtarını yazmıyor",
  !/const stokAnahtari = \(clientId, tur\)/.test(app));
t("App.jsx lib/stok.js'ten alıyor",
  /import \{[^}]*PAYLASIM_TURLERI[^}]*\} from "\.\.\/lib\/stok\.js"/.test(app));

/* ---------------------------------------------------------------- */
console.log("\n2) TARAYICI BİRLEŞTİRİCİSİ");

const oncesi = {
  _v: 4, stoklar: { "1_Reels": 2 },
  cekimIsleri: [{ id: 7, asama: "Onaylandı" }, { id: 8, asama: "Edit Yapılıyor" }],
};
const sonrasi = stokYanitiniUygula(oncesi, {
  _v: 5, stok: { stoklar: { "1_Reels": 3 }, isaretlenen: [{ isId: 7, tur: "Reels", yon: 1, yeniStok: 3 }] },
});
t("stok tablosu değişti", sonrasi.stoklar["1_Reels"] === 3, JSON.stringify(sonrasi.stoklar));
t("sürüm işlendi", sonrasi._v === 5);
t("sayılan kart işaretlendi", sonrasi.cekimIsleri[0].stokSayildi === true);
t("dokunulmayan kart bozulmadı", sonrasi.cekimIsleri[1].stokSayildi === undefined);
t("özgün nesne değiştirilmedi", oncesi.stoklar["1_Reels"] === 2 && oncesi.cekimIsleri[0].stokSayildi === undefined);
const stoksuz = stokYanitiniUygula(oncesi, { _v: 9 });
t("stok bildirimi yoksa yalnızca sürüm işleniyor",
  stoksuz._v === 9 && stoksuz.stoklar["1_Reels"] === 2);
t("düşüş de işleniyor",
  stokYanitiniUygula(oncesi, { stok: { isaretlenen: [{ isId: 7, yon: -1 }] } }).cekimIsleri[0].stokSayildi === false);
t("arayüz birleştiriciyi çağırıyor", app.includes("stokYanitiniUygula(d, res)"));

/* ---------------------------------------------------------------- */
console.log("\n3) SUNUCU YANITI — yönetici, personel, marka kilidi");

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (x) => Buffer.from(String(x), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const oku = () => kv.get("marcus-os-data");

const IZIN = (ek) => ({ cekimEdit: true, ...ek });
const PERSONEL = (ad, izinler, markalar) => ({
  id: ad, ad, kullaniciAdi: ad, sifreHash: hash("1", "s"), sifreSalt: "s", izinler, markalar: markalar || [],
});
const KIMLIK = (ad) => ({ "x-staff-username-b64": b64(ad), "x-staff-password-b64": b64("1"), "content-type": "application/json" });

const TEMEL = () => ({
  _v: 1,
  clients: [{ id: 1, ad: "İbo Burger" }, { id: 2, ad: "Mirka Diamond" }],
  stoklar: { "2_Post": 9 },
  cekimIsleri: [
    { id: 40, marka: "İbo Burger", kategori: "Grafik Tasarım", icerikTuru: "Menü Tasarımı",
      asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "aaaaaaaaaaaa" }], gecmis: [] },
  ],
  personelHesaplari: [
    PERSONEL("tam", IZIN({ paylasimlar: true })),
    PERSONEL("dar", IZIN({ paylasimlar: false })),
    PERSONEL("kilitli", IZIN({ paylasimlar: true }), ["İbo Burger"]),
  ],
  musteriHesaplari: [], musteriIcerikleri: [],
});

/* --- Yönetici --- */
await kv.set("marcus-os-data", TEMEL());
let d = await oku();
let r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Onaylandı" }], _v: undefined }, _v: d._v } });
t("yönetici kaydı geçti", r.kod === 200, JSON.stringify(r.govde).slice(0, 140));
t("yanıt stok taşıyor", Boolean(r.govde.stok), JSON.stringify(r.govde.stok));
t("Post stoğu 1 oldu", r.govde.stok.stoklar["1_Post"] === 1, JSON.stringify(r.govde.stok.stoklar));
t("Görsel stoğuna yazılmadı", !r.govde.stok.stoklar["1_Görsel"]);
t("işaretlenen kart bildirildi",
  r.govde.stok.isaretlenen.length === 1 && String(r.govde.stok.isaretlenen[0].isId) === "40" && r.govde.stok.isaretlenen[0].yon === 1,
  JSON.stringify(r.govde.stok.isaretlenen));
t("veritabanı da aynı", (await oku()).stoklar["1_Post"] === 1);

/* --- Paylaşım izni OLAN personel --- */
await kv.set("marcus-os-data", TEMEL());
d = await oku();
r = await cagir(veriUcu, { method: "POST", headers: KIMLIK("tam"), query: {},
  body: { data: { cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Onaylandı" }] }, _v: d._v } });
t("yetkili personel kaydı geçti", r.kod === 200, JSON.stringify(r.govde).slice(0, 140));
t("stok sayısı gönderildi", r.govde.stok && r.govde.stok.stoklar && r.govde.stok.stoklar["1_Post"] === 1,
  JSON.stringify(r.govde.stok));

/* --- Paylaşım izni OLMAYAN personel --- */
await kv.set("marcus-os-data", TEMEL());
d = await oku();
r = await cagir(veriUcu, { method: "POST", headers: KIMLIK("dar"), query: {},
  body: { data: { cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Onaylandı" }] }, _v: d._v } });
t("yetkisiz personel kaydı da geçti (kart onun işi)", r.kod === 200, JSON.stringify(r.govde).slice(0, 140));
t("stok SAYISI gönderilmedi", !(r.govde.stok && r.govde.stok.stoklar), JSON.stringify(r.govde.stok));
t("işaret gönderildi ama adet yok",
  r.govde.stok && r.govde.stok.isaretlenen.length === 1 && r.govde.stok.isaretlenen[0].yeniStok === undefined,
  JSON.stringify(r.govde.stok));
t("stok yine de sunucuda arttı", (await oku()).stoklar["1_Post"] === 1);

/* --- Marka kilitli personel: başka markanın sayısını GÖRMEMELİ --- */
await kv.set("marcus-os-data", TEMEL());
d = await oku();
r = await cagir(veriUcu, { method: "POST", headers: KIMLIK("kilitli"), query: {},
  body: { data: { cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Onaylandı" }] }, _v: d._v } });
t("kilitli personel kaydı geçti", r.kod === 200, JSON.stringify(r.govde).slice(0, 140));
const kilitliStok = (r.govde.stok && r.govde.stok.stoklar) || {};
t("kendi markasının sayısını görüyor", kilitliStok["1_Post"] === 1, JSON.stringify(kilitliStok));
t("BAŞKA markanın sayısı sızmıyor",
  !Object.keys(kilitliStok).some((a) => a.split("_")[0] === "2"),
  JSON.stringify(kilitliStok));
t("başka markanın stoğu veride duruyor (silinmedi)", (await oku()).stoklar["2_Post"] === 9);

/* ---------------------------------------------------------------- */
console.log("\n4) ÇÖZÜM ORTAĞI PANELİ — aynı kaynaktan besleniyor mu");

/* Ortağın Marka Paneli müşteri görünümünü KOPYALAMIYOR, aynı fonksiyondan üretiyor.
 * Bu yüzden müşteri tarafına eklenen her şey ortağa da kendiliğinden geçmeli. */
await kv.set("marcus-os-data", {
  ...TEMEL(),
  cekimIsleri: [
    { id: 50, marka: "İbo Burger", kategori: "Grafik Tasarım", icerikTuru: "Menü Tasarımı", asama: "Kontrol Bekliyor" },
    { id: 51, marka: "İbo Burger", kategori: "Video", icerikTuru: "Reels 4", asama: "Onaylandı" },
    { id: 52, marka: "Mirka Diamond", kategori: "Video", icerikTuru: "Reels 7", asama: "Kontrol Bekliyor" },
  ],
  haftalikPaylasimlar: [{ id: "hp1", clientId: 1, gun: "Pazartesi", haftaKey: "2026-08-17", tur: "Reels", yapildi: true, isId: 51, isAdi: "Reels 4" }],
  personelHesaplari: [
    PERSONEL("ortak", { musteriAkisi: true }, ["İbo Burger"]),
    PERSONEL("ortaksiz", { cekimEdit: true }, ["İbo Burger"]),
  ],
});

let o = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortak"), query: { markaPaneli: "1" } });
t("ortak kendi markasının panelini görüyor", o.kod === 200, JSON.stringify(o.govde).slice(0, 120));
const mp = (o.govde && o.govde.markaPaneli) || {};
t("Operasyon kartları ortağa da yansıyor",
  (mp.hazirIcerikler || []).length === 2, JSON.stringify((mp.hazirIcerikler || []).map((h) => h.isId)));
t("onaylanan kart onaylandı görünüyor",
  (mp.hazirIcerikler || []).some((h) => String(h.isId) === "51" && h.durum === "onaylandi"));
t("plana bağlı kartın kimliği ortağa da gidiyor",
  (mp.paylasimPlani || []).some((x) => String(x.isId) === "51"), JSON.stringify(mp.paylasimPlani));
t("başka markanın kartı ortağa sızmıyor",
  !(mp.hazirIcerikler || []).some((h) => String(h.isId) === "52"));
t("ortak stok tablosunu görmüyor", mp.stoklar === undefined && o.govde.stoklar === undefined);

o = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortak"), query: { markaPaneli: "2" } });
t("atanmamış markanın paneli reddediliyor", o.kod === 403, String(o.kod));

o = await cagir(veriUcu, { method: "GET", headers: KIMLIK("ortaksiz"), query: { markaPaneli: "1" } });
t("musteriAkisi izni olmayan bu ekranı açamıyor", o.kod === 403, String(o.kod));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
