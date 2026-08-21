/* HIZLI KART İLERLETMEDE KART GERİYE ATILIYORDU
 *
 * ŞİKÂYET: "Operasyon kısmında hızlı kart ilerlettiğimde geriye atıyor yine."
 *
 * SEBEP — KULLANICI KENDİ KENDİSİYLE ÇAKIŞIYORDU:
 * Kaydetme döngüsünde "önceki kayıt hâlâ yolda mı" kontrolü yoktu. 500 ms'lik gecikme
 * yalnızca art arda gelen değişiklikleri birleştiriyor; bir kayıt gönderildikten sonra
 * gelen yeni bir değişiklik İKİNCİ bir isteği başlatıyordu. O ikinci istek, birincinin
 * cevabı henüz gelmediği için TABANI BAYAT gönderiyor, sunucu haklı olarak 409 diyor ve
 * tarayıcı çakışan alanı sunucudan tazeleyince kart geri alınmış görünüyordu.
 *
 * NEDEN ÖZELLİKLE AŞAMA DEĞİŞİMİNDE: o kayıt sırasında sunucu Drive'da dosya taşıyor —
 * uygulamanın EN YAVAŞ kaydı. Cevap ne kadar gecikirse ikinci tıklamanın araya girme
 * ihtimali o kadar artıyor. Şikâyetin "hızlı ilerletince" olmasının sebebi bu.
 *
 * ÇÖZÜM: kayıtlar sıraya alındı. Bir kayıt yoldayken ikincisi gönderilmiyor, kısa aralıkla
 * bekleyip taze tabanla gidiyor.
 *
 * NOT: React burada çizilemiyor. 1. ve 2. bölüm mekanizmayı sunucu üzerinden DAVRANIŞ
 * olarak ölçüyor (bayat taban 409 üretiyor, taze taban üretmiyor); 3. bölüm istemcinin
 * gerçekten sıraya aldığını kaynaktan doğruluyor — davranış testinin yerine değil, yanına.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "3";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");

const TEMEL = () => ({
  _v: 5, _alanSurumleri: { cekimIsleri: 2 },
  clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{ id: 1, marka: "VIZZ", kategori: "Video", icerikTuru: "Reels",
                  asama: "Çekim Planlandı", medya: [{ slot: "1", versiyon: 1, dosyaId: "x" }] }],
  stoklar: {}, musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], paylasimGecmisi: [],
  haftalikPaylasimlar: [], subeler: [], personelHesaplari: [], musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const GET = () => cagir(veriUcu, { method: "GET", headers: OWNER, query: {} }).then((r) => r.govde.data);
const KAYDET = (yerel, taban) => cagir(veriUcu, {
  method: "POST", headers: OWNER, query: {},
  body: { data: { ...yerel, _v: undefined }, _v: yerel._v,
          degisenAlanlar: ["cekimIsleri"], alanSurumleri: (taban && taban._alanSurumleri) || {} },
});
const asamaYap = (veri, asama) => ({ ...veri, cekimIsleri: veri.cekimIsleri.map((j) => ({ ...j, asama })) });

/* ---------------------------------------------------------------- */
console.log("\n1) ŞİKÂYETİN MEKANİZMASI — bayat tabanla gönderilen ikinci kayıt");

await sifirla();
{
  const taban0 = await GET();
  const k1 = await KAYDET(asamaYap(taban0, "Çekim Yapıldı"), taban0);
  t("ilk ilerletme kaydediliyor", k1.kod === 200 && (await kv.get(KEY)).cekimIsleri[0].asama === "Çekim Yapıldı");

  /* Kullanıcı cevabı beklemeden tekrar ilerletiyor: taban hâlâ taban0. */
  const k2 = await KAYDET(asamaYap(taban0, "Dosyalar Aktarıldı"), taban0);
  const sunucu = await kv.get(KEY);
  t("BAYAT tabanla gönderilen ikinci kayıt 409 alıyor", k2.kod === 409, "gelen: " + k2.kod);
  t("çakışan alan cekimIsleri", JSON.stringify(k2.govde.catisanAlanlar) === '["cekimIsleri"]');
  t("kart ikinci aşamaya GEÇMİYOR — şikâyetin kendisi",
    sunucu.cekimIsleri[0].asama === "Çekim Yapıldı",
    "kullanıcı 'Dosyalar Aktarıldı' bekliyordu, ekranda 'Çekim Yapıldı' görüyor");
}

/* ---------------------------------------------------------------- */
console.log("\n2) SIRAYA ALMAK YETİYOR — taze tabanla ikinci kayıt geçiyor");

await sifirla();
{
  const taban0 = await GET();
  const k1 = await KAYDET(asamaYap(taban0, "Çekim Yapıldı"), taban0);
  /* Cevap beklendi → taban tazelendi (uygulamanın yaptığı: sonSunucuVerisi = yanıt). */
  const taban1 = { ...asamaYap(taban0, "Çekim Yapıldı"), _alanSurumleri: k1.govde.alanSurumleri };
  const k2 = await KAYDET(asamaYap(taban1, "Dosyalar Aktarıldı"), taban1);
  const sunucu = await kv.get(KEY);
  t("ikinci kayıt 409 ALMIYOR", k2.kod === 200, "gelen: " + k2.kod);
  t("kart gerçekten ilerliyor", sunucu.cekimIsleri[0].asama === "Dosyalar Aktarıldı",
    "gelen: " + sunucu.cekimIsleri[0].asama);
  t("sunucu taze sayaç bildiriyor", typeof k2.govde.alanSurumleri.cekimIsleri === "number",
    "bildirmezse bir sonraki kayıt yine bayat gider");
}

/* ---------------------------------------------------------------- */
console.log("\n3) ÜÇ ARDIŞIK İLERLETME — sırayla giderse hepsi tutuyor");

await sifirla();
{
  let taban = await GET();
  let yerel = taban;
  const yol = ["Çekim Yapıldı", "Dosyalar Aktarıldı", "Edit Bekliyor"];
  let hepsiGecti = true;
  for (const asama of yol) {
    yerel = asamaYap(yerel, asama);
    const y = await KAYDET(yerel, taban);
    if (y.kod !== 200) hepsiGecti = false;
    taban = { ...yerel, _alanSurumleri: y.govde.alanSurumleri };   // cevap beklendi
  }
  const sunucu = await kv.get(KEY);
  t("üç ilerletmenin üçü de kabul edildi", hepsiGecti);
  t("son aşama doğru", sunucu.cekimIsleri[0].asama === "Edit Bekliyor",
    "gelen: " + sunucu.cekimIsleri[0].asama);
}

/* ---------------------------------------------------------------- */
console.log("\n4) İSTEMCİ GERÇEKTEN SIRAYA ALIYOR MU");

{
  const { readFileSync } = await import("fs");
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  t("uçuşta bayrağı tanımlı", app.includes("const kayitUcusta = useRef(false)"));
  t("kayıt gönderilmeden ÖNCE kontrol ediliyor",
    /if \(kayitUcusta\.current\) \{\s*\n\s*saveTimer\.current = setTimeout\(kaydiGonder, \d+\);/.test(app),
    "kontrol yoksa ikinci kayıt bayat tabanla gider");
  t("istek başlarken işaretleniyor", app.includes("kayitUcusta.current = true;"));

  /* Bayrağın NEREDE bırakıldığı kritik: zincirin başında bırakılsaydı cevap gövdesi
   * okunmadan ve taban tazelenmeden bir sonraki kayıt gidebilirdi. */
  const gonderim = app.slice(app.indexOf("kayitUcusta.current = true;"));
  const govdeSonu = gonderim.indexOf("saveTimer.current = setTimeout(kaydiGonder");
  const zincir = gonderim.slice(0, govdeSonu);
  t("bayrak zincirin SONUNDA bırakılıyor",
    zincir.lastIndexOf("kayitUcusta.current = false") > zincir.indexOf(".catch("),
    "erken bırakılırsa aynı yarışın küçük hâli açık kalır");
  t("bekleme sırasında yeni değişiklik kaybolmuyor",
    app.includes("return () => clearTimeout(saveTimer.current);"),
    "yeni veri gelirse etki zamanlayıcıyı taze veriyle değiştiriyor");
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
