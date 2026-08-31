/* ÇEKİM LİSTESİ — ELLE SIRA
 *
 * Liste "stoğu en az olan üstte" diye sıralanıyordu. Ama aciliyet her zaman stokla
 * ölçülmüyor: çekim mekâna, havaya, müşterinin uygunluğuna bağlı olabiliyor. Sıra artık
 * elle düzenlenip KAYDEDİLİYOR — ekip aynı önceliğe bakıyor.
 *
 * BU TESTİN ASIL İŞİ ÜÇ ŞEY:
 *   1. LİSTE DİNAMİK. Marka yalnızca stoğu eşiğin altındayken görünüyor; çekim yapılınca
 *      çıkıyor, stok azalınca geri geliyor. Sırası kaybolursa kullanıcı her turda yeniden
 *      dizmek zorunda kalır.
 *   2. Sıra verilmemiş marka kuralı bozmamalı — otomatik sıra devam etmeli.
 *   3. MARKA KİLİTLİ HESAP KAYDEDEMEZ: bu liste ajans geneli; kendi markalarını gören bir
 *      çözüm ortağı, göremediği markaların sırasını da değiştirmiş olurdu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import { kv } from "@vercel/kv";
import { cagir, TEMIZ_VERI, KIMLIK } from "./denetim.mjs";
import { siraliGruplar, sirayiTasi, elleSiraVarMi } from "../lib/cekim-sirasi.js";

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
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const adlar = (liste) => liste.map((x) => x.marka).join(",");

/* ---------------------------------------------------------------- */
bolum("1) SIRALAMA KURALI", 5, () => {
  /* GİRDİ BİLEREK YANLIŞ SIRADA: doğru sırayla verilseydi sıralama hiç çalışmasa bile
   * kontrol geçerdi — ölçüldü, otomatik kural kaldırıldığında hiçbir şey düşmedi. */
  const gruplar = () => ([
    { clientId: 4, marka: "İbo", toplam: 4 },
    { clientId: 3, marka: "Violla", toplam: 2 },
    { clientId: 1, marka: "Animed", toplam: 0 },
    { clientId: 2, marka: "Berrysan", toplam: 2 },
  ]);
  t("sıra yoksa otomatik kural sürüyor (stoğu az üstte)",
    adlar(siraliGruplar(gruplar(), [])) === "Animed,Berrysan,Violla,İbo",
    adlar(siraliGruplar(gruplar(), [])));
  t("eşit stokta marka adına göre",
    siraliGruplar(gruplar(), []).map((x) => x.marka).indexOf("Berrysan") <
    siraliGruplar(gruplar(), []).map((x) => x.marka).indexOf("Violla"));
  t("ELLE SIRA otomatiği geçersiz kılıyor",
    adlar(siraliGruplar(gruplar(), [4, 3])) === "İbo,Violla,Animed,Berrysan",
    adlar(siraliGruplar(gruplar(), [4, 3])));
  t("sırası olmayan marka KAYBOLMUYOR",
    siraliGruplar(gruplar(), [4]).length === 4,
    "listeden düşseydi marka sessizce görünmez olurdu");
  t("elle sıra var mı bildiriliyor", elleSiraVarMi([1]) === true && elleSiraVarMi([]) === false);
});

/* ---------------------------------------------------------------- */
bolum("2) TAŞIMA — dinamik listeye dayanıyor", 5, () => {
  t("yukarı taşıma görünen sırayı yazıyor",
    sirayiTasi([], ["1", "2", "3"], "2", -1).join(",") === "2,1,3",
    "kayıtlı sıra boşken de çalışmalı — ekranda görülen sıra taban");
  t("aşağı taşıma", sirayiTasi([], ["1", "2", "3"], "2", 1).join(",") === "1,3,2");
  t("uçlarda hareket yok",
    sirayiTasi([], ["1", "2", "3"], "1", -1).join(",") === "1,2,3"
    && sirayiTasi([], ["1", "2", "3"], "3", 1).join(",") === "1,2,3");

  /* ASIL RİSK: çekimi yapılan marka listeden çıkıyor. Kaydından da düşseydi geri
   * geldiğinde yerini kaybederdi ve kullanıcı her turda yeniden dizerdi. */
  t("GÖRÜNMEYEN MARKANIN SIRASI KORUNUYOR",
    sirayiTasi(["9", "1", "2", "3"], ["1", "2", "3"], "2", -1).join(",") === "2,1,3,9",
    "listeden çıkan marka geri geldiğinde yerini bulmalı");
  t("listede olmayan marka taşınamıyor",
    sirayiTasi(["1", "2"], ["1", "2"], "77", -1).join(",") === "1,2");
});

/* ---------------------------------------------------------------- */
await bolum("3) KAYIT — yalnızca tüm markaları gören hesap", 5, async () => {
  await kv.set("marcus-os-data", TEMIZ_VERI());
  const r = await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "cekimSirasiKaydet", sira: [3, 1, 2] } });
  let d = await kv.get("marcus-os-data");
  t("yönetici kaydedebiliyor", r.kod === 200 && d.cekimSirasi.join(",") === "3,1,2",
    JSON.stringify(d.cekimSirasi));

  /* MARKA KİLİTLİ HESAP: kendi markalarını görüyor ama liste AJANS GENELİ. Reddi ucun
   * MERKEZÎ kuralı yapıyor (hedef marka çözülemeyen işlemde fail-close). Bu kontrol o
   * kuralın bu işlem için de geçerli kaldığını sınıyor — biri işlemi kilit çözümüne
   * eklerse kilitli hesap herkesin listesini değiştirebilir hale gelir. */
  const rOrtak = await cagir(pay, { method: "POST", headers: { ...KIMLIK, "content-type": "application/json" },
    query: {}, body: { action: "cekimSirasiKaydet", sira: [1] } });
  d = await kv.get("marcus-os-data");
  t("MARKA KİLİTLİ HESAP REDDEDİLİYOR", rOrtak.kod === 403, `HTTP ${rOrtak.kod}`);
  t("reddedilen istek sırayı değiştirmedi", d.cekimSirasi.join(",") === "3,1,2", JSON.stringify(d.cekimSirasi));

  /* Aynı kimlik iki kez gelirse sıralama belirsizleşir. */
  const rTekrar = await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "cekimSirasiKaydet", sira: [1, 1, 2, "2", 3] } });
  d = await kv.get("marcus-os-data");
  t("tekrar eden kimlik tekilleştiriliyor", rTekrar.kod === 200 && d.cekimSirasi.join(",") === "1,2,3",
    JSON.stringify(d.cekimSirasi));

  const rBos = await cagir(pay, { method: "POST", headers: OWNER, query: {},
    body: { action: "cekimSirasiKaydet", sira: [] } });
  d = await kv.get("marcus-os-data");
  t("boş sıra otomatiğe döndürüyor", rBos.kod === 200 && d.cekimSirasi.length === 0);
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
