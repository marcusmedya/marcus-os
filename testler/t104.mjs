/* ALT YAZI ZİNCİRİ — KARTTAN PLANA, UÇTAN UCA
 *
 * BU TESTİN ASIL İŞİ:
 *   1. KARTA YAZILAN METİN PLANA GİDİYOR. Kullanıcının istediği söz bu: "karttan yazarsam
 *      paylaşım planlamasında da görünsün." Kural `lib/alt-yazi.js`'te ama asıl soru
 *      zincirin tamamının çalışıp çalışmadığı — kart kaydı, plan kaydı, müşteri yükü.
 *   2. PLANIN KENDİ METNİ KARTINKİNİ EZİYOR ve o değişiklik YALNIZCA o planı etkiliyor
 *      (aynı kart dört şubede paylaşılabiliyor).
 *   3. PLANIN METNİ SİLİNİNCE DEVRALMA GERİ GELİYOR — plan "" ile kaydedilince kartınki
 *      yeniden geçerli olmalı, plan boş metinde takılı kalmamalı.
 *   4. KARTLA AYNI METİN PLANA YAZILMIYOR (`planaYazilacak` → null). Yazılsaydı kart metni
 *      sonradan güncellendiğinde o plan eski metinde takılı kalırdı.
 *   5. MÜŞTERİ YÜKÜ DE DEVRALMAYI ÇÖZÜYOR. Çözmezse kartta yazılan metin müşteriye hiç
 *      ulaşmaz — panel ayrı bir kod yolundan besleniyor.
 *
 * NOT — ÖLÇÜLEMEYEN KISIM: bu testler kuralı ve sunucu ucunu ölçüyor, ARAYÜZÜN o ucu
 * çağırıp çağırmadığını ölçemiyor. Sahadaki hata tam da oradaydı: `onAltMetin` alt bileşene
 * hiç geçirilmemişti, yani kural da uç da doğruydu ama tarayıcı ucu hiç aramıyordu.
 * Node'dan JSX bağlantısı çağrılamıyor; bunu yakalayabilecek katman statik bir denetimdir.
 */
import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
import { etkinAltMetin, altMetinKaynagi, planaYazilacak } from "../lib/alt-yazi.js";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: pay } = await import("../api/paylasim.js");

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

/** Kartı olan, planı olan temiz bir dünya. */
const dunya = (kartMetni, planMetni) => {
  const v = TEMIZ_VERI();
  v.cekimIsleri = [{ id: 7, marka: "Şişçi İbo", icerikTuru: "Reels 1", kategori: "Reels",
    asama: "Onaylandı", altMetin: kartMetni }];
  v.haftalikPaylasimlar = [{ id: 1, clientId: 1, gun: "Pzt", haftaKey: "2026-09-07",
    tur: "Reels", isId: 7, altMetin: planMetni }];
  return v;
};
const oku = async () => kv.get("marcus-os-data");
const planiVeKarti = (d) => [d.haftalikPaylasimlar[0], d.cekimIsleri.find((j) => j.id === 7)];

/* ---------------------------------------------------------------- */
await bolum("1) KARTA YAZILAN METİN PLANA GİDİYOR", 4, async () => {
  await kv.set("marcus-os-data", dunya("Kartın metni", null));
  const [plan, kart] = planiVeKarti(await oku());
  t("plan kendi metnini yazmamışsa kartınki geçerli",
    etkinAltMetin(plan, kart) === "Kartın metni",
    `gelen: ${JSON.stringify(etkinAltMetin(plan, kart))}`);
  t("kaynak 'kart' diye bildiriliyor", altMetinKaynagi(plan, kart) === "kart",
    "kullanıcı neyi değiştirdiğini bilmeli");
  t("kart metni boşsa kaynak 'yok'", altMetinKaynagi({ }, { altMetin: "   " }) === "yok");
  t("iki taraf da boşsa metin boş", etkinAltMetin(null, null) === "");
});

/* ---------------------------------------------------------------- */
await bolum("2) PLANIN KENDİ METNİ KARTINKİNİ EZİYOR", 4, async () => {
  await kv.set("marcus-os-data", dunya("Kartın metni", null));
  const y = await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "haftalikAltMetin", planId: 1, altMetin: "Bu güne özel" } });
  t("uç kabul etti", y.kod === 200, JSON.stringify(y.govde).slice(0, 120));
  const d = await oku();
  const [plan, kart] = planiVeKarti(d);
  t("plana yazıldı", plan.altMetin === "Bu güne özel", String(plan.altMetin));
  t("artık planınki geçerli", etkinAltMetin(plan, kart) === "Bu güne özel");
  t("KARTIN metnine dokunulmadı", kart.altMetin === "Kartın metni",
    "plan üzerindeki düzenleme yalnızca o planı etkilemeli");
});

/* ---------------------------------------------------------------- */
await bolum("3) PLANIN METNİ SİLİNİNCE DEVRALMA GERİ GELİYOR", 3, async () => {
  await kv.set("marcus-os-data", dunya("Kartın metni", "Bu güne özel"));
  await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "haftalikAltMetin", planId: 1, altMetin: "" } });
  const [plan, kart] = planiVeKarti(await oku());
  t("plan metni temizlendi", plan.altMetin === null, String(plan.altMetin));
  t("kartınki yeniden geçerli", etkinAltMetin(plan, kart) === "Kartın metni",
    "plan boş metinde takılı kalırsa kart metni müşteriye hiç ulaşmaz");
  t("kaynak yine 'kart'", altMetinKaynagi(plan, kart) === "kart");
});

/* ---------------------------------------------------------------- */
await bolum("4) KARTLA AYNI METİN PLANA YAZILMIYOR", 3, () => {
  const kart = { altMetin: "Aynı metin" };
  t("birebir aynıysa plana yazılmaz (null)", planaYazilacak("Aynı metin", kart) === null,
    "yazılsaydı kart metni güncellendiğinde plan eskisinde takılı kalırdı");
  t("baştaki/sondaki boşluk farkı 'değişiklik' sayılmaz",
    planaYazilacak("  Aynı metin  ", kart) === null);
  t("gerçekten farklıysa yazılır", planaYazilacak("Başka metin", kart) === "Başka metin");
});

/* ---------------------------------------------------------------- */
await bolum("5) MÜŞTERİ YÜKÜ DE DEVRALMAYI ÇÖZÜYOR", 3, async () => {
  const veri = dunya("Kartın metni", null);
  const gorunum = musteriGorunumuUret(veri, veri.clients[0], markaEslestirici);
  const satir = (gorunum.paylasimPlani || []).find((p) => String(p.id) === "1");
  t("müşteri panelinde plan satırı var", Boolean(satir),
    JSON.stringify(Object.keys(gorunum)).slice(0, 160));
  t("müşteriye KARTIN metni gidiyor", satir && satir.altMetin === "Kartın metni",
    `gelen: ${satir && JSON.stringify(satir.altMetin)} — panel ayrı bir kod yolundan besleniyor`);

  const veri2 = dunya("Kartın metni", "Bu güne özel");
  const g2 = musteriGorunumuUret(veri2, veri2.clients[0], markaEslestirici);
  const s2 = (g2.paylasimPlani || []).find((p) => String(p.id) === "1");
  t("plan metni varsa müşteriye O gidiyor", s2 && s2.altMetin === "Bu güne özel",
    `gelen: ${s2 && JSON.stringify(s2.altMetin)}`);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
