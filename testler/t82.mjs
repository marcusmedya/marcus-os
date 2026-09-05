/* PLAN SİLME TAM GERİ ALMA · KART SEÇİCİ · SÜRÜM SAYACI · MEDYA BİRLEŞTİRME
 *
 * Dört ayrı kusur, hepsi sahadan ya da eşzamanlılık ölçümünden geldi:
 *
 * 1. PLAN SİLME KARTA DOKUNMUYORDU. Paylaşıldı işaretli bir plan silinince kart
 *    "Teslim Edildi"de kalıyor, stok geri gelmiyor, Drive dosyası PAYLAŞILDI'da
 *    kalıyordu. Kart artık "Onaylandı" olmadığı için seçicide de çıkmıyor —
 *    kullanıcı aynı içeriği başka güne planlamak isteyince bulamıyordu.
 *    Sahadan bildirildi: "iptal etsem de tekrar göstermiyor, sadece kalan görünüyor".
 *
 * 2. KART SEÇİCİ yalnızca hazır kartları gösteriyordu; paylaşılmış bir içeriği
 *    tekrar planlamanın yolu yoktu.
 *
 * 3. SÜRÜM SAYACI her kayıtta koşulsuz artıyordu. Yalnızca reklam kaydeden biri
 *    kart üzerinde çalışan herkesi 409'a düşürüyor, onların DÜZENLEMESİ geri
 *    alınıyordu (yeni kayıtlar korunuyor, düzenlemeler korunmuyor).
 *
 * 4. ÇAKIŞMA BİRLEŞTİRMESİ kartın İÇİNDEKİ yeni medyayı koruyamıyordu: iki kişi
 *    aynı karta yüklerken ikincinin dosyası Drive'a yüklenip karttan kayboluyordu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { medyalariBirlestir, guncelMedyalar } from "../lib/asamalar.js";

const { default: paylasimUcu } = await import("../api/paylasim.js");
const { default: veriUcu } = await import("../api/data.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
const P = (u) => ({ "x-staff-username-b64": b64(u), "x-staff-password-b64": b64("1234"), "content-type": "application/json" });
const rid = () => `t82_${Math.random().toString(36).slice(2, 12)}`;
const oku = (h) => cagir(veriUcu, { method: "GET", headers: h, query: {} });
const kaydet = (h, v, al, su, ver) => cagir(veriUcu, { method: "POST", headers: h, body: { data: v, degisenAlanlar: al, alanSurumleri: su, _v: ver } });

/* ---------------------------------------------------------------- */
await bolum("1) PAYLAŞILMIŞ PLAN SİLİNİNCE — kart tamamen geri alınıyor", 6, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "Smell", durum: "aktif" }],
    cekimIsleri: [{ id: 9, marka: "Smell", kategori: "Video", icerikTuru: "Reels", asama: "Teslim Edildi", stokSayildi: false }],
    haftalikPaylasimlar: [{ id: "p1", clientId: 1, isId: 9, isAdi: "Reels", gun: "Pzt", haftaKey: "2026-08-17", tur: "Video", yapildi: true }],
    /* Stok anahtarı KATEGORİDEN değil İÇERİK ADINDAN çıkıyor: "Reels" adı Reels
     * stok türüne düşüyor (`paylasimTuru`). İlk yazımda `1_Video` beklenmişti ve
     * test kodu haksız yere suçluyordu. */
    subeler: [], stoklar: { "1_Reels": 0 }, paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER, body: { action: "haftalikSil", planId: "p1", islemId: rid() } });
  const s = await kv.get(KEY);

  t("silme başarılı", r.kod === 200, JSON.stringify(r.govde && r.govde.error));
  t("plan gitti", (s.haftalikPaylasimlar || []).length === 0);
  t("KART 'Onaylandı'ya döndü", s.cekimIsleri[0].asama === "Onaylandı",
    "gelen: " + s.cekimIsleri[0].asama + " — dönmezse seçicide hiç çıkmaz");
  t("STOK geri geldi", s.stoklar["1_Reels"] === 1, "gelen: " + JSON.stringify(s.stoklar));
  t("Drive taşıma sonucu bildiriliyor",
    Object.prototype.hasOwnProperty.call(r.govde, "driveSonuc"),
    "istemci bunu kullanıcıya gösteriyor");
  t("kart yanıtta dönüyor", Array.isArray(r.govde.cekimIsleri),
    "dönmezse tarayıcı eski aşamayı göstermeye devam eder");
});

/* ---------------------------------------------------------------- */
await bolum("2) İŞARETSİZ PLAN SİLİNİNCE — gereksiz stok hareketi yok", 3, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "Smell", durum: "aktif" }],
    cekimIsleri: [{ id: 9, marka: "Smell", kategori: "Video", icerikTuru: "Reels", asama: "Onaylandı", stokSayildi: true }],
    haftalikPaylasimlar: [{ id: "p1", clientId: 1, isId: 9, isAdi: "Reels", gun: "Pzt", haftaKey: "2026-08-17", tur: "Video", yapildi: false }],
    subeler: [], stoklar: { "1_Video": 3 }, paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER, body: { action: "haftalikSil", planId: "p1", islemId: rid() } });
  const s = await kv.get(KEY);
  t("silme başarılı", r.kod === 200);
  t("kart aşaması değişmedi", s.cekimIsleri[0].asama === "Onaylandı");
  t("stok değişmedi", s.stoklar["1_Video"] === 3, "gelen: " + s.stoklar["1_Video"]);
});

/* ---------------------------------------------------------------- */
await bolum("3) KARTA BAĞLI OLMAYAN işaretli plan — stok plandan geri veriliyor", 2, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "Smell", durum: "aktif" }],
    cekimIsleri: [],
    haftalikPaylasimlar: [{ id: "p1", clientId: 1, gun: "Pzt", haftaKey: "2026-08-17", tur: "Görsel", yapildi: true }],
    subeler: [], stoklar: { "1_Görsel": 2 }, paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  const r = await cagir(paylasimUcu, { method: "POST", headers: OWNER, body: { action: "haftalikSil", planId: "p1", islemId: rid() } });
  const s = await kv.get(KEY);
  t("silme başarılı", r.kod === 200);
  t("stok geri geldi", s.stoklar["1_Görsel"] === 3, "gelen: " + s.stoklar["1_Görsel"]);
});

/* ---------------------------------------------------------------- */
await bolum("4) SÜRÜM SAYACI — yalnızca kartlar gerçekten değişince artıyor", 5, async () => {
  const TABAN = () => ({
    clients: [{ id: 1, ad: "M", durum: "aktif" }],
    cekimIsleri: [{ id: 1, marka: "M", kategori: "Video", icerikTuru: "K1", asama: "Edit Yapılıyor", stokSayildi: false }],
    reklamlar: [], subeler: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], musteriTalepleri: [],
    personelHesaplari: [
      { id: "a", kullaniciAdi: "ali", sifreHash: hash("1234", "s"), sifreSalt: "s", ad: "Ali", izinler: { cekimEdit: true, reklamlar: true, kartOnaylama: true, kartDuzenleme: true, kartSilme: true } },
      { id: "b", kullaniciAdi: "ayse", sifreHash: hash("1234", "s"), sifreSalt: "s", ad: "Ayşe", izinler: { cekimEdit: true, reklamlar: true, kartOnaylama: true, kartDuzenleme: true, kartSilme: true } }],
    staffPermissions: {}, _v: 1, _alanSurumleri: { cekimIsleri: 1, reklamlar: 1 },
  });

  await kv.set(KEY, TABAN());
  {
    const a = (await oku(P("ali"))).govde.data;
    await kaydet(P("ali"), { ...a, reklamlar: [{ id: 1, ad: "R" }] }, ["reklamlar"], a._alanSurumleri, a._v);
    const s = await kv.get(KEY);
    t("ilgisiz kayıt kart sayacını ARTIRMIYOR", s._alanSurumleri.cekimIsleri === 1,
      "gelen: " + s._alanSurumleri.cekimIsleri + " — artarsa kart üzerinde çalışan herkes 409 alır");
  }

  /* ASIL SONUÇ: iki kişi farklı işler yaparken ikisi de yazabiliyor mu? */
  await kv.set(KEY, TABAN());
  {
    const a = (await oku(P("ali"))).govde.data, b = (await oku(P("ayse"))).govde.data;
    const [ra, rb] = await Promise.all([
      kaydet(P("ali"), { ...a, reklamlar: [{ id: 1, ad: "R" }] }, ["reklamlar"], a._alanSurumleri, a._v),
      kaydet(P("ayse"), { ...b, cekimIsleri: b.cekimIsleri.map((j) => ({ ...j, icerikTuru: "AYŞE DÜZELTTİ" })) }, ["cekimIsleri"], b._alanSurumleri, b._v)]);
    const s = await kv.get(KEY);
    t("reklam kaydı geçti", ra.kod === 200);
    t("kart düzenlemesi de geçti — 409 YOK", rb.kod === 200, "gelen: " + rb.kod);
    t("düzenleme gerçekten yazıldı", s.cekimIsleri[0].icerikTuru === "AYŞE DÜZELTTİ");
  }

  /* Koruma gevşememeli: gerçek kart değişikliği sayacı ARTIRMALI, yoksa çakışma
   * tespiti tamamen kör kalır. */
  await kv.set(KEY, TABAN());
  {
    const a = (await oku(P("ali"))).govde.data;
    await kaydet(P("ali"), { ...a, cekimIsleri: a.cekimIsleri.map((j) => ({ ...j, asama: "Onaylandı" })) }, ["cekimIsleri"], a._alanSurumleri, a._v);
    const s = await kv.get(KEY);
    t("gerçek kart değişikliği sayacı artırıyor ve stok işaretini yazıyor",
      s._alanSurumleri.cekimIsleri > 1 && s.cekimIsleri[0].stokSayildi === true,
      `sürüm: ${s._alanSurumleri.cekimIsleri}, stokSayildi: ${s.cekimIsleri[0].stokSayildi}`);
  }
});

/* ---------------------------------------------------------------- */
await bolum("5) MEDYA BİRLEŞTİRME — yüklenen dosya karttan kaybolmuyor", 7, () => {
  const sunucu = [{ dosyaId: "ALI", slot: "1", versiyon: 1 }];
  const yerel = [{ dosyaId: "AYSE", slot: "1", versiyon: 1 }];

  const r = medyalariBirlestir(sunucu, yerel, [], "Carousel");
  t("iki dosya da duruyor", r.length === 2, JSON.stringify(r.map((x) => x.dosyaId)));
  t("çakışan slot yeniden numaralandı",
    r.find((x) => x.dosyaId === "AYSE").slot === "2",
    "aynı slotta kalsaydı biri ekranda görünmezdi");
  t("ikisi de EKRANDA görünüyor", guncelMedyalar({ medya: r }).length === 2,
    "asıl ölçüm bu — kayıt duruyor ama görünmüyorsa yine kayıp");

  t("zaten sunucuda olan tekrar eklenmiyor",
    medyalariBirlestir(sunucu, [{ dosyaId: "ALI", slot: "1", versiyon: 1 }], [], "Carousel").length === 1);

  /* BAŞKASININ SİLDİĞİ DOSYA DİRİLTİLMEZ — tabanda vardı, sunucuda yok. */
  t("silinen dosya diriltilmiyor",
    medyalariBirlestir([], [{ dosyaId: "X", slot: "1", versiyon: 1 }], [{ dosyaId: "X", slot: "1", versiyon: 1 }], "Carousel").length === 0,
    "diriltilirse kullanıcının sildiği slayt geri gelir");

  t("story çakışması versiyon alıyor, slot değişmiyor",
    (() => {
      const s = medyalariBirlestir([{ dosyaId: "A", slot: "story", versiyon: 1 }],
        [{ dosyaId: "B", slot: "story", versiyon: 1 }], [], "Video");
      const b = s.find((x) => x.dosyaId === "B");
      return b && b.slot === "story" && b.versiyon === 2;
    })(),
    "story tek yuva — sayısal slota kaydırılmamalı");

  /* Sözleşme KİMLİK değil İÇERİK: fonksiyon her zaman yeni bir dizi üretiyor.
   * İlk yazımda `=== sunucu` sınanmıştı ve kodu haksız yere suçluyordu. */
  t("yerel liste boşsa sunucu listesi aynen dönüyor",
    JSON.stringify(medyalariBirlestir(sunucu, [], [], "Carousel")) === JSON.stringify(sunucu));
});

/* ---------------------------------------------------------------- */
await bolum("6) ARAYÜZ BAĞLANTILARI", 5, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  /* Yalnızca "fonksiyon adı kodda geçiyor mu" demek yetmez; ÇAKIŞMA KURTARMA
   * yolunda çağrıldığı sınanıyor. Aradaki gerekçe yorumu uzun olduğu için
   * mesafe sınırı yerine iki koşul birlikte aranıyor. */
  const i = app.indexOf("for (const alan of catisanlar)");
  const catismaBloku = i >= 0 ? app.slice(i, i + 2000) : "";
  t("çakışma kurtarması medyayı birleştiriyor",
    /medyalariBirlestir\(/.test(catismaBloku) && /alan === "cekimIsleri"/.test(catismaBloku),
    "bağlanmazsa yüklenen dosya karttan kaybolmaya devam eder");
  t("kart seçicide 'daha önce paylaşılmış' bölümü var",
    /DAHA ÖNCE PAYLAŞILMIŞ/.test(app) && /j\.asama === "Teslim Edildi"/.test(app));
  t("silme onayı geri almayı anlatıyor",
    /silmek geri alma anlamına gelir/.test(app));
  t("Drive sonucu kullanıcıya gösteriliyor",
    /setDriveSonuc\(/.test(app) && /dosya taşınmadı/.test(app),
    "sunucu sebebi hep döndürüyordu ama istemci okumuyordu");
  t("belge dışı alanlar veriye sızmıyor",
    /BELGE_DISI_ALANLAR/.test(app),
    "driveSonuc doğrudan yayılırsa belgeye yazılırdı");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
