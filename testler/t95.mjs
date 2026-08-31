/* MÜŞTERİ HESAP ÖZETİ (EKSTRE) + FATURA KAYDI
 *
 * Kullanıcının isteği: "fatura kesildi, faturadan kalan ödeme, diğer ödemeler — hepsinin
 * detaylı dökümanını müşterime iletmek istiyorum."
 *
 * BU TESTİN ASIL İŞİ — en tehlikeliden başlayarak:
 *
 *   1. FATURA BAKİYEYE EKLENMİYOR. Fatura, hizmet bedelinin BELGELENEN kısmı; ayrı bir
 *      borç değil. Eklenseydi faturalı bir ay müşteriye İKİ KEZ borçlandırılırdı — belge
 *      müşteriye gittiği için bu en pahalı hata.
 *   2. GEÇMİŞ AY KENDİ ÜCRETİYLE. Ekstre `ayinUcreti`ye dayanmalı; bugünkü ücretle
 *      hesaplanırsa ücret düşmüş markanın geçmiş ayları da düşer ve tahsil edilmiş para
 *      "fazla ödeme" görünür.
 *   3. TOPLAM BAKİYE, SATIR BAKİYELERİNİN TOPLAMI DEĞİL. Bir aya fazla ödeme yapılmışsa
 *      satırları toplamak o fazlayı başka ayın borcundan düşer ve kapanmamış bir ay
 *      kapanmış görünür.
 *   4. BELGEDE İÇ BİLGİ YOK. Maliyet, kâr marjı, diğer markalar müşteriye gitmemeli.
 *   5. Fatura ucu gerçekten yazıyor ve yetkisiz erişim reddediliyor.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { ekstreUret, aylariListele, ayNormalle, varsayilanBaslangic } from "../lib/ekstre.js";
import { ekstreHtml, ayEtiketi, tarihEtiketi, para } from "../lib/ekstre-belgesi.js";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
const { default: odemeUcu } = await import("../api/client-payment.js");

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

/** Ücreti Ağustos 2026'da 60.000'den 45.000'e düşmüş, Temmuz'da kısmi ödenmiş marka. */
const musteri = () => ({
  id: 1, ad: "Smell Coffee", baslangic: "2026-6", aylikUcret: 45000,
  maliyetler: [{ id: "m1", kalem: "Freelance kurgu", tutar: 8000 }],
  karMarji: 62,
  ucretGecmisi: [
    { baslangicAy: "0000-00", tutar: 60000, dagilim: { temel: 15000, toplam: 60000,
      subeler: [{ subeId: "s1", ad: "Smell Lara", tutar: 15000 },
                { subeId: "s2", ad: "Smell Konyaaltı", tutar: 15000 },
                { subeId: "s3", ad: "Smell Old Town", tutar: 15000 }] } },
    { baslangicAy: "2026-08", tutar: 45000, dagilim: { temel: 15000, toplam: 45000,
      subeler: [{ subeId: "s1", ad: "Smell Lara", tutar: 15000 },
                { subeId: "s2", ad: "Smell Konyaaltı", tutar: 15000 }] } },
  ],
  odemeKayitlari: [
    { id: "o1", ay: "2026-06", tutar: 60000, tarih: "2026-06-05", banka: "Ziraat" },
    { id: "o2", ay: "2026-07", tutar: 50000, tarih: "2026-07-05", banka: "Ziraat", not: "kısmi" },
  ],
  faturalar: [{ id: "f1", ay: "2026-07", no: "2026-114", tarih: "2026-07-03", tutar: 30000 }],
});
const ara = { baslangicAy: "2026-06", bitisAy: "2026-08" };

/* ---------------------------------------------------------------- */
await bolum("1) FATURA BAKİYEYE EKLENMİYOR", 4, () => {
  const e = ekstreUret(musteri(), ara);
  const temmuz = e.satirlar.find((s) => s.ay === "2026-07");
  t("faturalı ayın tahakkuku yalnızca hizmet bedeli", temmuz.tahakkuk === 60000,
    `bulunan ${temmuz.tahakkuk} — 90.000 çıksaydı müşteri iki kez borçlandırılırdı`);
  t("faturalı ayın bakiyesi ödeme farkı kadar", temmuz.bakiye === 10000,
    `bulunan ${temmuz.bakiye} — kullanıcının "faturadan kalan ödeme" dediği rakam`);
  t("fatura ayrı sütunda görünüyor", temmuz.faturaliTutar === 30000);
  t("faturasız ay etkilenmiyor",
    e.satirlar.find((s) => s.ay === "2026-08").faturaliTutar === 0);
});

/* ---------------------------------------------------------------- */
await bolum("2) HER AY KENDİ ÜCRETİYLE", 4, () => {
  const e = ekstreUret(musteri(), ara);
  const al = (ay) => e.satirlar.find((s) => s.ay === ay);
  t("ücret düşmeden önceki ay eski tutarda", al("2026-06").tahakkuk === 60000,
    `bulunan ${al("2026-06").tahakkuk} — bugünkü ücretle 45.000 çıkardı`);
  t("düşüşten sonraki ay yeni tutarda", al("2026-08").tahakkuk === 45000);
  t("geçmiş ayın şube dökümü o ayki hâliyle", al("2026-06").dagilim.subeler.length === 3,
    "ayrılan şube geçmiş aydan da düşseydi belge her bakışta başka görünürdü");
  t("güncel ayın dökümünde ayrılan şube yok", al("2026-08").dagilim.subeler.length === 2);
});

/* ---------------------------------------------------------------- */
await bolum("3) TOPLAMLAR", 5, () => {
  const e = ekstreUret(musteri(), ara);
  t("toplam hizmet bedeli", e.toplam.tahakkuk === 165000, `bulunan ${e.toplam.tahakkuk}`);
  t("toplam tahsilat", e.toplam.tahsilat === 110000);
  t("toplam bakiye", e.toplam.bakiye === 55000);

  /* SATIR bakiyesi ayın KENDİ hesabı: bir aya fazla ödeme yapılmışsa o ay eksi görünür,
   * diğer ayın borcu olduğu gibi kalır. (Toplam bakiyede böyle bir ayrım YOK — Σ(a−b) ile
   * Σa−Σb aynı şeydir; ölçüldü, orada korunacak bir davranış yok.) */
  const c = musteri();
  c.odemeKayitlari = [{ id: "o1", ay: "2026-06", tutar: 100000, tarih: "2026-06-05" }];
  const f = ekstreUret(c, ara);
  t("fazla ödenen ay eksi bakiye gösteriyor",
    f.satirlar.find((s) => s.ay === "2026-06").bakiye === -40000,
    "fazla ödeme sıfırlanırsa müşteri alacağını göremez");
  t("fazla ödeme diğer ayın borcunu kapatmıyor",
    f.satirlar.find((s) => s.ay === "2026-07").bakiye === 60000);
});

/* ---------------------------------------------------------------- */
await bolum("4) ARALIK VE SINIR HALLERİ", 6, () => {
  t("ters aralık boş liste", aylariListele("2026-08", "2026-01").length === 0,
    "sonsuz döngü ya da devasa liste üretilmemeli");
  t("tek ay aralığı tek satır", aylariListele("2026-07", "2026-07").length === 1);
  t("yıl atlıyor", aylariListele("2025-11", "2026-02").join(",") === "2025-11,2025-12,2026-01,2026-02");
  t("tek haneli ay normalleniyor", ayNormalle("2025-1") === "2025-01",
    "form 'YYYY-M' üretebiliyor; normallenmezse o ayın kayıtları hiçbir satıra düşmez");
  t("geçersiz ay reddediliyor", ayNormalle("2025-13") === null && ayNormalle("abc") === null);
  t("varsayılan başlangıç müşterinin başlangıç ayı", varsayilanBaslangic(musteri()) === "2026-06");
});

/* ---------------------------------------------------------------- */
await bolum("5) HAREKETSİZ AY ATLANIYOR", 3, () => {
  const c = musteri();
  c.ucretGecmisi = [{ baslangicAy: "0000-00", tutar: 0, dagilim: null }];
  c.aylikUcret = 0; c.odemeKayitlari = []; c.faturalar = [];
  const e = ekstreUret(c, { baslangicAy: "2020-01", bitisAy: "2026-08" });
  t("boş aylar listeye girmiyor", e.satirlar.length === 0,
    "80 satırlık '0 ₺' dökümü belgeyi okunmaz yapar");
  const d = ekstreUret(musteri(), { baslangicAy: "2020-01", bitisAy: "2026-08" });
  t("hareketli aylar duruyor", d.satirlar.length === 3);
  const h = ekstreUret(c, { baslangicAy: "2020-01", bitisAy: "2026-08", hareketsizAylariAtla: false });
  t("istenirse boş aylar da veriliyor", h.satirlar.length === 80);
});

/* ---------------------------------------------------------------- */
await bolum("6) BELGE MÜŞTERİYE GİDİYOR — İÇ BİLGİ SIZMAMALI", 6, () => {
  const html = ekstreHtml(musteri(), { ...ara, firmaAdi: "Marcus Medya", bugun: new Date(2026, 7, 31) });
  t("maliyet kalemi belgede YOK", !html.includes("Freelance kurgu"),
    "müşteriye giden belgede iç maliyet görünmemeli");
  t("kâr marjı belgede YOK", !/K[âa]r Marj/i.test(html));
  t("fatura numarası belgede var", html.includes("2026-114"));
  t("şube dökümü belgede var", html.includes("Smell Old Town"));
  t("kalan bakiye belgede var", html.includes("55.000"));
  const kotu = { ...musteri(), ad: '<script>alert(1)</script>' };
  t("marka adı kaçırılıyor", !ekstreHtml(kotu, ara).includes("<script>alert(1)</script>"),
    "ad belgeye ham girseydi yazdırma penceresinde çalışırdı");
});

/* ---------------------------------------------------------------- */
await bolum("7) BİÇİMLENDİRME", 4, () => {
  t("ay etiketi Türkçe", ayEtiketi("2026-07") === "Temmuz 2026");
  t("tanınmayan ay olduğu gibi", ayEtiketi("bozuk") === "bozuk");
  t("tarih gün.ay.yıl", tarihEtiketi("2026-07-03") === "03.07.2026");
  t("eksi bakiye korunuyor", para(-5000).includes("-5"),
    "fazla ödeme gerçek bir durum, sıfırlanmamalı");
});

/* ---------------------------------------------------------------- */
await bolum("7b) BAŞLAMADIĞI AYA BEDEL YAZILMIYOR", 4, () => {
  /* Ücret dönemlerinin ilki `0000-00` ("geçmişin tamamı") olduğu için, geriye doğru
   * sorulan bir ekstre markanın HİÇ ÇALIŞMADIĞI aylara da bedel yazıyordu — ölçüldü,
   * Haziran 2026'da başlayan marka 2020'den beri borçlu çıkıyordu. Müşteriye giden
   * belgede olmayan bir alacağın iddia edilmesi olurdu. */
  const e = ekstreUret(musteri(), { baslangicAy: "2026-01", bitisAy: "2026-08" });
  t("başlangıçtan önceki ay listede yok", !e.satirlar.some((s) => s.ay < "2026-06"),
    "bulunan: " + e.satirlar.map((s) => s.ay).join(","));
  t("toplam yalnızca çalışılan ayları sayıyor", e.toplam.tahakkuk === 165000,
    `bulunan ${e.toplam.tahakkuk}`);

  /* Ama o aylarda gerçekten bir ödeme kaydı varsa gizlenmez — kayıt varsa olmuştur. */
  const c = musteri();
  c.odemeKayitlari = [...c.odemeKayitlari, { id: "eski", ay: "2026-03", tutar: 5000, tarih: "2026-03-01" }];
  const f = ekstreUret(c, { baslangicAy: "2026-01", bitisAy: "2026-08" });
  const mart = f.satirlar.find((s) => s.ay === "2026-03");
  t("başlangıç öncesi ödeme yine gösteriliyor", !!mart && mart.tahsilat === 5000);
  t("o ayın bedeli sıfır", mart.tahakkuk === 0,
    "sıfır değilse çalışılmamış aya bedel yazılmış olur");
});

/* ---------------------------------------------------------------- */
const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const gonder = (govde, basliklar) => cagir(odemeUcu, {
  method: "POST", headers: basliklar || OWNER,
  body: { ...govde, islemId: `t95_${Math.random().toString(36).slice(2, 12)}` },
});
const sifirla = () => kv.set(KEY, {
  clients: [musteri()], subeler: [], cekimIsleri: [], stoklar: {}, paylasimGecmisi: [],
  personelHesaplari: [], _alanSurumleri: {},
});

await bolum("8) UÇ: FATURA KAYDI", 6, async () => {
  await sifirla();
  const r = await gonder({ action: "addFatura", clientId: 1, fatura: { ay: "2026-08", no: "2026-131", tarih: "2026-08-04", tutar: 22500 } });
  t("fatura ekleniyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  let veri = await kv.get(KEY);
  const yeni = (veri.clients[0].faturalar || []).find((f) => f.no === "2026-131");
  t("kayıt yazıldı", !!yeni && yeni.tutar === 22500);
  t("kimlik verildi", !!(yeni && yeni.id), "id yoksa silinemez");
  t("ekstre yeni faturayı görüyor",
    ekstreUret(veri.clients[0], ara).satirlar.find((s) => s.ay === "2026-08").faturaliTutar === 22500);

  t("aysız fatura reddediliyor",
    (await gonder({ action: "addFatura", clientId: 1, fatura: { no: "x", tutar: 100 } })).kod === 400,
    "aysız fatura hiçbir satıra düşmez, sessizce kaybolurdu");

  await gonder({ action: "deleteFatura", clientId: 1, faturaId: yeni.id });
  veri = await kv.get(KEY);
  t("fatura silinebiliyor", !(veri.clients[0].faturalar || []).some((f) => f.id === yeni.id));
});

await bolum("9) UÇ: YETKİSİZ ERİŞİM", 2, async () => {
  await sifirla();
  const r = await gonder({ action: "addFatura", clientId: 1, fatura: { ay: "2026-08", tutar: 1 } },
    { "x-site-password": "yanlis", "content-type": "application/json" });
  t("yanlış şifreyle fatura eklenemiyor", r.kod === 401, `gelen ${r.kod}`);
  const veri = await kv.get(KEY);
  t("veri değişmedi", (veri.clients[0].faturalar || []).length === 1);
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bu dosya bir kez sessizce bozuldu: bölümler `await` edilmediği için hiç çalışmadı,
 * test "0 kaldı" deyip BAŞARIYLA çıktı ve koşucu da yakalayamadı (çıkış kodu 0, ✗ yok).
 * Hiçbir şey ölçmeyen bir testin geçmesi, testin olmamasından daha tehlikeli: koruma var
 * sanılır. Beklenen sayı tutmuyorsa dosya kırmızı yanar. */
const BEKLENEN = 44;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
