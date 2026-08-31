/* ŞUBE BAZLI AYLIK ÜCRET — TOPLAM ŞUBELERDEN TÜRER, GEÇMİŞ AY DONDURULUR
 *
 * Kullanıcının anlattığı durum: Smell Coffee'nin üç şubesi ayrı ayrı faturalanıyor,
 * toplam 60.000 ₺. Bir şube ayrılınca toplamın 45.000'e düşmesi gerekiyordu ama
 * `aylikUcret` tek bir sayı olduğu için düşmedi.
 *
 * BU TESTİN ASIL İŞİ — sırayla en tehlikeliden başlayarak:
 *
 *   1. GEÇMİŞ AYIN TUTARI DEĞİŞMİYOR. Asıl tehlike bu. Ödeme durumu geçmiş ayları
 *      saklamıyor, HER AY İÇİN bugünkü ücretten hesaplıyordu; ücret 60.000'den
 *      45.000'e düşünce Temmuz da 45.000'e düşüyor, tahsil edilmiş 60.000 "fazla
 *      ödeme" görünüyor ve ödenmemiş bir ay borçtan siliniyordu. Para verisi sessizce
 *      değişiyordu.
 *   2. TOPLAM ŞUBE AYRILINCA DÜŞÜYOR — kullanıcının istediği asıl davranış.
 *   3. DÖKÜM GERİYE DÖNÜK EKLENİYOR ama TUTARA DOKUNMUYOR ("eski veriyi silmeden
 *      bölelim"): 60.000 aynı kalıyor, artık hangi şubenin ne kadarı olduğu okunabiliyor.
 *   4. ÖZELLİK KULLANILMAYAN MARKADA HİÇBİR ŞEY DEĞİŞMİYOR. Ajansın müşterilerinin
 *      çoğu tek şubeli; bu işlev onlara dokunursa 19 okuma yerinin hepsi etkilenir.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import {
  ucretDagilimi, aylikUcretiCoz, ayinUcreti, ayinDagilimi,
  ucretleriTazele, subeliUcretVarMi, ACIK_BASLANGIC,
} from "../lib/marka-ucreti.js";
import { monthRemaining, isMonthPaid, monthPaidAmount } from "../lib/odeme-hesabi.js";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import crypto from "node:crypto";
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
  try { fn(); } catch (e) { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } }
};

const SUBELER = [
  { id: "s1", clientId: 7, ad: "Merkez", aylikUcret: 15000 },
  { id: "s2", clientId: 7, ad: "Lara", aylikUcret: 15000 },
  { id: "s3", clientId: 7, ad: "Konyaaltı", aylikUcret: 15000 },
  { id: "y1", clientId: 9, ad: "Başka markanın şubesi", aylikUcret: 99000 },
];
const smell = () => ({ id: 7, ad: "Smell Coffee", aylikUcret: 60000, temelUcret: 15000 });

/* ---------------------------------------------------------------- */
bolum("1) TOPLAM = TEMEL + ŞUBELER", 5, () => {
  const d = ucretDagilimi(smell(), SUBELER);
  t("toplam üç şube + temel", d.toplam === 60000, `toplam ${d && d.toplam}`);
  t("başka markanın şubesi toplama girmiyor", d.subeler.length === 3,
    "clientId süzgeci olmasa 99.000 Smell'in faturasına eklenirdi");
  t("döküm şube adlarını taşıyor", d.subeler.map((x) => x.ad).join(",") === "Merkez,Lara,Konyaaltı");
  t("aylikUcretiCoz dökümün toplamını veriyor", aylikUcretiCoz(smell(), SUBELER) === 60000);
  t("şube ücreti farklı olabiliyor",
    ucretDagilimi({ id: 7, temelUcret: 0 },
      [{ id: "a", clientId: 7, aylikUcret: 10000 }, { id: "b", clientId: 7, aylikUcret: 25000 }]).toplam === 35000);
});

/* ---------------------------------------------------------------- */
bolum("2) ŞUBE AYRILINCA TOPLAM DÜŞER", 3, () => {
  let clients = ucretleriTazele([smell()], [smell()], SUBELER, "2026-08") || [smell()];
  const kalan = SUBELER.filter((s) => s.id !== "s3");
  const sonra = ucretleriTazele(clients, clients, kalan, "2026-09");
  t("bir şube gidince 60.000 → 45.000", sonra && sonra[0].aylikUcret === 45000,
    `bulunan ${sonra && sonra[0].aylikUcret}`);
  const hepsiGitti = ucretleriTazele(clients, clients, [SUBELER[3]], "2026-09");
  t("tüm şubeler gidince temel ücret kalır", hepsiGitti[0].aylikUcret === 15000);
  t("şube eklenince toplam artar",
    ucretleriTazele(sonra, sonra, [...kalan, { id: "s4", clientId: 7, ad: "Yeni", aylikUcret: 20000 }], "2026-09")[0].aylikUcret === 65000);
});

/* ---------------------------------------------------------------- */
bolum("3) GEÇMİŞ AYIN TUTARI DONDURULUR", 7, () => {
  let clients = ucretleriTazele([smell()], [smell()], SUBELER, "2026-08") || [smell()];
  const kalan = SUBELER.filter((s) => s.id !== "s3");
  const c = ucretleriTazele(clients, clients, kalan, "2026-09")[0];

  t("değişimden önceki ay eski tutarda", ayinUcreti(c, "2026-07") === 60000,
    `bulunan ${ayinUcreti(c, "2026-07")} — geçmiş fatura sessizce değişiyor`);
  t("değişimin yapıldığı ay yeni tutarda", ayinUcreti(c, "2026-09") === 45000);
  t("sonraki aylar yeni tutarda", ayinUcreti(c, "2026-12") === 45000);

  /* Ödeme ekranlarının gerçekten bu tutarı kullandığı — modülün doğru olması yetmez,
   * bağlanmamışsa hiçbir şey değişmez. */
  const kismi = { ...c, odemeKayitlari: [{ ay: "2026-07", tutar: 50000 }] };
  t("geçmişte KISMİ ödenen ay hâlâ eksik", isMonthPaid(kismi, "2026-07") === false,
    "bugünkü ücretle bakılsaydı 50.000 ödeme 45.000'lik ayı KAPATIR ve eksik tahsilat kaybolurdu");
  t("geçmiş ayın kalan bakiyesi eski tutara göre", monthRemaining(kismi, "2026-07") === 10000,
    "bugünkü ücretle 0 çıkardı — 10.000'lik alacak sessizce silinirdi");
  const hicOdenmemis = { ...c, odemeKayitlari: [] };
  t("geçmişte ödenmemiş ay ESKİ tutarda borçlu", monthRemaining(hicOdenmemis, "2026-07") === 60000,
    "45.000 çıksaydı 15.000'lik alacak sessizce silinirdi");
  const eskiIsaret = { ...c, odemeler: ["2026-07"], odemeKayitlari: [] };
  t("eski usul işaretli ay o ayın tutarıyla sayılıyor",
    monthPaidAmount(eskiIsaret, "2026-07") === 60000);
});

/* ---------------------------------------------------------------- */
bolum("4) DÖKÜM GERİYE DÖNÜK EKLENİR, TUTAR KORUNUR", 4, () => {
  const once = { id: 7, ad: "Smell Coffee", aylikUcret: 60000 };   // döküm yok
  const sonra = ucretleriTazele([once], [{ ...once, temelUcret: 15000 }], SUBELER, "2026-08");
  t("döküm tanımlanınca toplam DEĞİŞMİYOR", sonra[0].aylikUcret === 60000,
    `bulunan ${sonra[0].aylikUcret}`);
  t("yeni dönem açılmıyor, tek dönem geçmişin tamamını kapsıyor",
    sonra[0].ucretGecmisi.length === 1 && sonra[0].ucretGecmisi[0].baslangicAy === ACIK_BASLANGIC);
  t("geçmiş bir ay artık şube şube okunabiliyor",
    ayinDagilimi(sonra[0], "2025-01").subeler.length === 3,
    "kullanıcının istediği 'eski veriyi silmeden bölmek' bu");
  t("o ayın tutarı yine 60.000", ayinUcreti(sonra[0], "2025-01") === 60000);
});

/* ---------------------------------------------------------------- */
bolum("5) ÖZELLİK KULLANILMAYAN MARKAYA DOKUNULMUYOR", 5, () => {
  const tek = [{ id: 3, ad: "Tek Şubeli", aylikUcret: 32000 }];
  t("şube ücreti yoksa döküm de yok", ucretDagilimi(tek[0], SUBELER) === null);
  t("kullanılmıyor olarak tanınıyor", subeliUcretVarMi(tek[0], SUBELER) === false);
  t("tazeleme hiçbir şey yapmıyor", ucretleriTazele(tek, tek, SUBELER, "2026-09") === null,
    "null dönmezse clients sürüm sayacı boş yere artar, aynı anda çalışan 409 alır");
  t("ücret geçmişi yoksa ay ücreti bugünkü tutar", ayinUcreti(tek[0], "2024-01") === 32000);
  t("ödeme durumu eskisi gibi", monthRemaining(tek[0], "2024-01") === 32000);
});

/* ---------------------------------------------------------------- */
bolum("6) TEKRAR ÇAĞIRMA VE SINIR HALLERİ", 6, () => {
  let clients = ucretleriTazele([smell()], [smell()], SUBELER, "2026-08");
  t("ikinci çağrı değişiklik üretmiyor", ucretleriTazele(clients, clients, SUBELER, "2026-08") === null,
    "her kayıtta yeni dönem düşseydi liste sınırsız büyürdü");
  const kalan = SUBELER.filter((s) => s.id !== "s3");
  const a = ucretleriTazele(clients, clients, kalan, "2026-09");
  const b = ucretleriTazele(a, a, kalan.filter((s) => s.id !== "s2"), "2026-09");
  t("aynı ay ikinci değişim yeni dönem AÇMIYOR", b[0].ucretGecmisi.length === 2,
    `dönem sayısı ${b[0].ucretGecmisi.length} — aynı aya iki dönem düşerse hangisi geçerli belirsizleşir`);
  t("aynı ay ikinci değişimde tutar güncelleniyor", b[0].aylikUcret === 30000);
  t("o ayın ücreti güncel", ayinUcreti(b[0], "2026-09") === 30000);
  t("önceki aylar hâlâ 60.000", ayinUcreti(b[0], "2026-08") === 60000);
  t("şube ücreti 0 girilmiş olabilir",
    ucretDagilimi({ id: 7, temelUcret: 15000 }, [{ id: "z", clientId: 7, ad: "Bedelsiz", aylikUcret: 0 }]).toplam === 15000);
});


/* ---------------------------------------------------------------- */
/* UCA GERÇEK İSTEK — modülün doğru olması yetmez, BAĞLANMIŞ olması gerekir.
 * Bu projede daha önce doğru yazılmış bir mantık uca hiç bağlanmadığı için ekranda
 * çalışmıyordu; saf testler bunu göremez. */
const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const gonder = (govde, basliklar) => cagir(paylasimUcu, {
  method: "POST", headers: basliklar || OWNER,
  body: { ...govde, islemId: `t94_${Math.random().toString(36).slice(2, 12)}` },
});
const hash = (x, tuz) => crypto.scryptSync(x, tuz, 64).toString("hex");
const sifirla = () => kv.set(KEY, {
  clients: [{ id: 1, ad: "Smell Coffee", durum: "aktif", aylikUcret: 60000, temelUcret: 15000 }],
  subeler: [
    { id: "s1", clientId: 1, ad: "Merkez", aylikUcret: 15000 },
    { id: "s2", clientId: 1, ad: "Lara", aylikUcret: 15000 },
    { id: "s3", clientId: 1, ad: "Konyaaltı", aylikUcret: 15000 },
  ],
  cekimIsleri: [], haftalikPaylasimlar: [], stoklar: {}, paylasimGecmisi: [],
  personelHesaplari: [{
    id: "ph1", ad: "Personel", kullaniciAdi: "personel", sifreSalt: "tuz", sifreHash: hash("pw", "tuz"),
    izinler: { paylasimlar: true, musteriler: true },
  }],
  _alanSurumleri: {},
});

const asyncBolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

await asyncBolum("7) UÇ: ŞUBE SİLİNİNCE MARKA TOPLAMI DÜŞER", 4, async () => {
  await sifirla();
  const r = await gonder({ action: "subeSil", subeId: "s3" });
  t("silme kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  const veri = await kv.get(KEY);
  t("toplam 60.000 → 45.000", veri.clients[0].aylikUcret === 45000,
    `bulunan ${veri.clients[0].aylikUcret} — kullanıcının bildirdiği sorunun ta kendisi`);
  t("geçmiş dönemi kaydedildi", (veri.clients[0].ucretGecmisi || []).length === 2);
  t("silme öncesi aylar hâlâ 60.000", ayinUcreti(veri.clients[0], "2026-01") === 60000,
    "kesilmiş faturaların tutarı değişmemeli");
});

await asyncBolum("8) UÇ: ŞUBE ÜCRETİ YALNIZCA YÖNETİCİDEN", 5, async () => {
  await sifirla();
  const r = await gonder({ action: "subeUcret", subeId: "s1", aylikUcret: 25000 });
  t("yönetici ücreti yazabiliyor", r.kod === 200, "gelen: " + r.kod);
  let veri = await kv.get(KEY);
  t("şube ücreti kaydedildi", veri.subeler[0].aylikUcret === 25000);
  t("marka toplamı tazelendi", veri.clients[0].aylikUcret === 70000,
    `bulunan ${veri.clients[0].aylikUcret}`);

  const personel = { "x-staff-username": "personel", "x-staff-password": "pw", "content-type": "application/json" };
  const p = await gonder({ action: "subeUcret", subeId: "s1", aylikUcret: 1 }, personel);
  t("paylaşım izinli personel FİYAT değiştiremiyor", p.kod === 403,
    `gelen ${p.kod} — stok işaretlemeye yeten izin fiyat belirlemeye yetmemeli`);
  veri = await kv.get(KEY);
  t("reddedilen istek veriyi değiştirmedi", veri.subeler[0].aylikUcret === 25000);
});

await asyncBolum("9) UÇ: BOŞ ÜCRET ALANI SİLER, MARKA ESKİ DÜZENİNE DÖNER", 3, async () => {
  await sifirla();
  await gonder({ action: "subeUcret", subeId: "s1", aylikUcret: "" });
  const veri = await kv.get(KEY);
  t("alan siliniyor", veri.subeler[0].aylikUcret === undefined,
    "0 yazılsaydı 'bedelsiz şube' ile 'ücretlendirmeye dahil değil' ayrımı kaybolurdu");
  t("kalan iki şube + temel toplanıyor", veri.clients[0].aylikUcret === 45000,
    `bulunan ${veri.clients[0].aylikUcret}`);
  t("değişim geçmişe dönem olarak düştü", (veri.clients[0].ucretGecmisi || []).length === 2);
});

await asyncBolum("10) UÇ: MÜŞTERİ KARTINDAN ÜCRET DÜZENLEME (api/data.js)", 6, async () => {
  /* Günlük kullanımda en sık geçilecek yol bu: yönetici müşteri kartında temel ücreti
   * ya da aylık ücreti değiştiriyor. Şube işlemleri `api/paylasim.js`ten geçiyor, bu
   * yol ise `api/data.js` birleştirmesinden — ikisi ayrı ayrı bağlanmak zorunda. */
  await sifirla();
  const d = await kv.get(KEY);
  const govde = { ...d, clients: [{ ...d.clients[0], temelUcret: 25000 }] };
  const r = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {}, body: { data: govde, _v: d._v } });
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const veri = await kv.get(KEY);
  t("temel ücret artınca toplam da artıyor", veri.clients[0].aylikUcret === 70000,
    `bulunan ${veri.clients[0].aylikUcret} — tarayıcının gönderdiği eski toplam yazılıyorsa 60.000 kalır`);
  t("değişim dönem olarak kaydedildi", (veri.clients[0].ucretGecmisi || []).length === 2);
  t("önceki aylar eski tutarda", ayinUcreti(veri.clients[0], "2026-01") === 60000);

  /* Elle girilen toplamla oynanamaz: şube ücretlendirmesi açıkken son söz sunucunun. */
  const d2 = await kv.get(KEY);
  const r2 = await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
    body: { data: { ...d2, clients: [{ ...d2.clients[0], aylikUcret: 999999 }] }, _v: d2._v } });
  t("elle gönderilen toplam kabul edilmiyor", r2.kod === 200);
  t("toplam yine dökümden hesaplanıyor", (await kv.get(KEY)).clients[0].aylikUcret === 70000,
    "tarayıcıdan gelen sayı yazılsaydı döküm ile toplam birbirini tutmazdı");
});

await asyncBolum("11) UÇ: PERSONEL DE MÜŞTERİ KARTINI DÜZENLEYEBİLİYOR (alan bazlı yol)", 3, async () => {
  /* `api/data.js`in İKİ ayrı kayıt yolu var — yönetici blob'u ve personelin alan bazlı
   * birleştirmesi. Müşteri düzenleme izni olan personel ikincisinden geçiyor; tazeleme
   * yalnızca birine bağlansa o yoldan yapılan ücret değişimi toplamı güncellemez. */
  await sifirla();
  const PERSONEL = { "x-staff-username": "personel", "x-staff-password": "pw", "content-type": "application/json" };
  const d = await kv.get(KEY);
  const r = await cagir(veriUcu, {
    method: "POST", headers: PERSONEL, query: {},
    body: { data: { clients: [{ ...d.clients[0], temelUcret: 5000 }] }, _v: d._v,
            degisenAlanlar: ["clients"], alanSurumleri: d._alanSurumleri || {} },
  });
  t("personel kaydı kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const veri = await kv.get(KEY);
  t("bu yoldan da toplam tazeleniyor", veri.clients[0].aylikUcret === 50000,
    `bulunan ${veri.clients[0].aylikUcret} — 5.000 temel + 3×15.000 şube`);
  t("geçmiş ay eski tutarda kalıyor", ayinUcreti(veri.clients[0], "2026-01") === 60000);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
