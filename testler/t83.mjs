/* STOK KARTLARIN YANSIMASIDIR — MUTABAKAT
 *
 * Stok bugün SAKLANAN bir sayaç ve kartlarla arasında sapabiliyor. Bu oturumda üç
 * ayrı sapma yolu bulunup kapatıldı; ama sapmanın KENDİSİNİ görmenin bir yolu yoktu
 * ve elle +/− düğmeleri sapmayı hem gizliyor hem üretiyordu (bir içerik onaylanmadan
 * stok artıyor, paylaşılmadan düşüyordu).
 *
 * ELLE +/− KALDIRILDI. Geriye tek düzeltme yolu kaldı ve o da rastgele bir sayı
 * yazmıyor: hedef değeri SUNUCU kartlardan hesaplıyor. Tarayıcıdan gelen sayıya
 * güvenilseydi, düzeltme sapmayı gidermek yerine yeni sapma üretebilirdi.
 *
 * BU TESTİN ASIL İŞİ: türetmenin stok MOTORUYLA aynı sonucu verdiğini kanıtlamak.
 * Türetme motordan ayrışırsa mutabakat, olmayan sapmaları "düzeltmeye" başlar ve
 * doğru sayıları bozar — sessiz ve geri dönüşü zor bir hasar.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import { readFileSync } from "node:fs";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { kartlaraGoreStok, stokMutabakati } from "../lib/stok-mutabakat.js";
import { onaylananlaraGoreStok } from "../lib/stok.js";
const { default: paylasimUcu } = await import("../api/paylasim.js");

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
const rid = () => `t83_${Math.random().toString(36).slice(2, 12)}`;
const gonder = (govde) => cagir(paylasimUcu, { method: "POST", headers: OWNER, body: { ...govde, islemId: rid() } });

/** Motoru bir geçişten geçirir ve sonucu döndürür. */
const motoruCalistir = (veri, yeniIsler) => {
  const once = veri.cekimIsleri;
  const v = { ...veri, cekimIsleri: yeniIsler };
  const r = onaylananlaraGoreStok(once, v.cekimIsleri, v.stoklar, v.clients, undefined, v.subeler);
  if (r) { v.stoklar = r.stoklar; v.cekimIsleri = r.cekimIsleri; }
  return v;
};
const uyusuyorMu = (veri) => {
  const ger = kartlaraGoreStok(veri);
  const kay = veri.stoklar || {};
  return [...new Set([...Object.keys(kay), ...Object.keys(ger)])]
    .every((a) => (Number(kay[a]) || 0) === (Number(ger[a]) || 0));
};

/* ---------------------------------------------------------------- */
await bolum("1) TÜRETME MOTORLA AYNI — tek şubeli marka", 4, () => {
  let v = {
    clients: [{ id: 1, ad: "M", durum: "aktif" }],
    cekimIsleri: [{ id: 1, marka: "M", kategori: "Video", icerikTuru: "A", asama: "Kontrol Bekliyor" },
                  { id: 2, marka: "M", kategori: "Video", icerikTuru: "B", asama: "Kontrol Bekliyor" }],
    haftalikPaylasimlar: [], subeler: [], stoklar: {},
  };
  t("hiç onaylı kart yokken ikisi de boş", uyusuyorMu(v));

  v = motoruCalistir(v, v.cekimIsleri.map((j) => ({ ...j, asama: "Onaylandı" })));
  t("iki kart onaya girdi", uyusuyorMu(v) && v.stoklar["1_Reels"] === 2, JSON.stringify(v.stoklar));

  v = motoruCalistir(v, v.cekimIsleri.map((j) => (j.id === 1 ? { ...j, asama: "Teslim Edildi" } : j)));
  t("biri teslim edildi", uyusuyorMu(v) && v.stoklar["1_Reels"] === 1, JSON.stringify(v.stoklar));

  v = motoruCalistir(v, v.cekimIsleri.map((j) => (j.id === 2 ? { ...j, asama: "Revize İstendi" } : j)));
  t("diğeri revizeye döndü", uyusuyorMu(v) && (v.stoklar["1_Reels"] || 0) === 0, JSON.stringify(v.stoklar));
});

/* ---------------------------------------------------------------- */
await bolum("2) TÜRETME MOTORLA AYNI — çok şubeli marka, gerçek uçtan", 4, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "S", durum: "aktif" }],
    subeler: [{ id: "a", ad: "A", clientId: 1 }, { id: "b", ad: "B", clientId: 1 }, { id: "c", ad: "C", clientId: 1 }],
    cekimIsleri: [{ id: 9, marka: "S", kategori: "Video", icerikTuru: "Tek", asama: "Kontrol Bekliyor" }],
    haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });
  {
    const v = await kv.get(KEY);
    const y = motoruCalistir(v, v.cekimIsleri.map((j) => ({ ...j, asama: "Onaylandı" })));
    await kv.set(KEY, y);
    t("kart onayda — üç şube de kullanabiliyor",
      uyusuyorMu(y) && y.stoklar["1_a_Reels"] === 1 && y.stoklar["1_c_Reels"] === 1, JSON.stringify(y.stoklar));
  }

  /* ÜÇ ŞUBE DE PLANLANIYOR. Yalnızca biri planlanıp paylaşılsaydı "planlanan tüm
   * şubeler bitti" sayılır ve kart doğrudan "Teslim Edildi"ye geçerdi — o zaman
   * içerik hiçbir şubede kalmaz ve şube stokları haklı olarak sıfırlanır. Şube
   * davranışını sınamak için diğer şubelerin de beklemesi gerekiyor. */
  for (const [gun, sube] of [["Pzt", "a"], ["Sal", "b"], ["Çar", "c"]]) {
    await gonder({ action: "haftalikEkle", clientId: 1, gun, haftaKey: "2026-08-17", tur: "Video", isId: 9, subeId: sube });
  }
  const planA = (await kv.get(KEY)).haftalikPaylasimlar.find((p) => p.subeId === "a");
  await gonder({ action: "haftalikToggle", planId: planA.id });
  {
    const v = await kv.get(KEY);
    t("kart 'Şubelerde Paylaşılıyor'a geçti", v.cekimIsleri[0].asama === "Şubelerde Paylaşılıyor",
      "gelen: " + v.cekimIsleri[0].asama);
    t("A paylaştı — türetme motorla hâlâ aynı", uyusuyorMu(v), JSON.stringify(v.stoklar));
    t("A'nın stoğu düştü, B ve C duruyor",
      (v.stoklar["1_a_Reels"] || 0) === 0 && v.stoklar["1_b_Reels"] === 1 && v.stoklar["1_c_Reels"] === 1,
      JSON.stringify(v.stoklar));
  }
});

/* ---------------------------------------------------------------- */
await bolum("3) SAPMA GÖRÜNÜYOR", 5, () => {
  const v = {
    clients: [{ id: 1, ad: "M", durum: "aktif" }],
    cekimIsleri: [{ id: 1, marka: "M", kategori: "Video", icerikTuru: "A", asama: "Onaylandı", stokSayildi: true }],
    haftalikPaylasimlar: [], subeler: [],
    stoklar: { "1_Reels": 5 },                       // kartlara göre 1 olmalı
  };
  const m = stokMutabakati(v);
  t("fark tespit ediliyor", m.satirlar.length === 1, JSON.stringify(m.satirlar));
  t("kayıtlı ve gereken doğru okunuyor",
    m.satirlar[0].kayitli === 5 && m.satirlar[0].gereken === 1);
  t("fazla olduğu bildiriliyor", m.fazlaSayisi === 1 && m.eksikSayisi === 0);
  t("marka adı çözülüyor", m.satirlar[0].marka === "M");

  const mutabik = stokMutabakati({ ...v, stoklar: { "1_Reels": 1 } });
  t("uyuşuyorsa satır ÜRETİLMİYOR", mutabik.satirlar.length === 0,
    "her farkta satır çıkarsa panel gürültüye döner");
});

/* ---------------------------------------------------------------- */
await bolum("4) DÜZELTME — hedefi SUNUCU hesaplıyor", 6, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "M", durum: "aktif" }],
    cekimIsleri: [{ id: 1, marka: "M", kategori: "Video", icerikTuru: "A", asama: "Onaylandı", stokSayildi: true }],
    haftalikPaylasimlar: [], subeler: [], stoklar: { "1_Reels": 7 },
    paylasimGecmisi: [], gunlukKontrol: {}, musteriTalepleri: [], _alanSurumleri: {},
  });

  /* Tarayıcı yanlış bir hedef göndermeye çalışsa bile dikkate alınmamalı. */
  const r = await gonder({ action: "stokDuzelt", clientId: 1, tur: "Reels", gereken: 999 });
  const s = await kv.get(KEY);
  t("düzeltme başarılı", r.kod === 200, JSON.stringify(r.govde && r.govde.error));
  t("sayı KARTLARA göre ayarlandı", s.stoklar["1_Reels"] === 1, "gelen: " + s.stoklar["1_Reels"]);
  t("tarayıcının gönderdiği sayı dikkate ALINMADI", s.stoklar["1_Reels"] !== 999);
  t("düzeltme geçmişe yazıldı",
    (s.paylasimGecmisi || []).some((x) => x.tip === "duzeltme" && x.eski === 7 && x.yeni === 1),
    JSON.stringify(s.paylasimGecmisi));

  /* Zaten mutabıksa ikinci çağrı bir şey yazmamalı — gereksiz sürüm artışı ve
   * gereksiz geçmiş kaydı üretmesin. */
  const gecmisSayisi = (s.paylasimGecmisi || []).length;
  const r2 = await gonder({ action: "stokDuzelt", clientId: 1, tur: "Video" });
  const s2 = await kv.get(KEY);
  t("mutabıkken tekrar yazmıyor", r2.govde.degismedi === true);
  t("geçmişe ikinci kayıt düşmedi", (s2.paylasimGecmisi || []).length === gecmisSayisi);
});

/* ---------------------------------------------------------------- */
await bolum("5) DÜZELTMEDE MARKA KİLİDİ VE ŞUBE TUTARLILIĞI", 2, async () => {
  await kv.set(KEY, {
    clients: [{ id: 1, ad: "A", durum: "aktif" }, { id: 2, ad: "B", durum: "aktif" }],
    subeler: [{ id: "s2", ad: "B'nin Şubesi", clientId: 2 }],
    cekimIsleri: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: {},
    musteriTalepleri: [], _alanSurumleri: {},
  });
  const capraz = await gonder({ action: "stokDuzelt", clientId: 1, tur: "Video", subeId: "s2" });
  t("başka markanın şubesi reddediliyor", capraz.kod === 400, "gelen: " + capraz.kod);
  const eksik = await gonder({ action: "stokDuzelt", clientId: 1 });
  t("tür verilmezse reddediliyor", eksik.kod === 400);
});

/* ---------------------------------------------------------------- */
await bolum("6) ELLE +/− KALDIRILDI", 3, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  t("genel stokta elle değiştirme düğmesi yok",
    !/onStokDegis\(client\.id, client\.ad, tur, -?1\)/.test(app),
    "elle oynatma stoğun kartlarla bağını koparıyordu");
  t("şube stoğunda elle değiştirme düğmesi yok",
    !/onSubeStokDegis\(client\.id, sube\.id, tur, -?1\)/.test(app));
  t("düzeltme isteği HEDEF SAYI göndermiyor",
    /action: "stokDuzelt", clientId[^}]*tur: r\.tur/.test(app) && !/stokDuzelt[^}]*gereken:/.test(app),
    "sayı gönderilseydi düzeltme yeni sapma üretebilirdi");
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
