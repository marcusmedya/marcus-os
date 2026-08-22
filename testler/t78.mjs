/* YEDEK DOĞRULAMA — GERİ YÜKLEMEDEN ÖNCE
 *
 * Geri yükleme sistemdeki en tehlikeli yazma: tüm veriyi değiştirir. Mevcut akış iki
 * şeyi zaten doğru yapıyordu — kilit alıyor ve geri yüklemeden önce mevcut verinin 30
 * günlük kopyasını ayrı bir anahtara yazıyor.
 *
 * EKSİK OLAN: yedeğin İÇERİĞİ hiç kontrol edilmiyordu. `kv.get` bir nesne döndürdüyse
 * doğrudan üretime yazılıyordu. Bozuk bir yedek (clients metin olmuş, yanlış
 * anahtardan gelmiş bambaşka bir belge) uygulamayı bozardı — ve kilit ile kopya bu
 * durumda işe yaramaz: kopya da alınır, kilit de bırakılır, ama veri bozulur.
 *
 * Bu test iki şeyi ölçer: bozuk yedek GERÇEKTEN yazılmıyor mu, ve sağlam yedek hâlâ
 * yüklenebiliyor mu (koruma çalışan özelliği kırmamalı).
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { yapiDogrula, yedekDegerlendir, kayipOzeti, KAYIP_UYARI_ORANI } from "../lib/yedek-dogrula.js";
const { default: yedekUcu } = await import("../api/backup.js");

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
const CANLI = () => ({
  clients: [{ id: 1, ad: "A" }, { id: 2, ad: "B" }, { id: 3, ad: "C" }, { id: 4, ad: "D" }],
  cekimIsleri: [{ id: 1 }, { id: 2 }],
  uyelikler: [{ id: 1 }, { id: 2 }],
  stoklar: { "1_Video": 3 },
  _v: 9,
});
const geriYukle = (anahtar) => cagir(yedekUcu, { method: "POST", headers: OWNER, body: { key: anahtar } });
const ozetAl = (anahtar) => cagir(yedekUcu, { method: "GET", headers: OWNER, query: { key: anahtar, ozet: "1" } });

/* ---------------------------------------------------------------- */
await bolum("1) BOZUK YEDEK ÜRETİME YAZILMIYOR", 6, async () => {
  await kv.set(KEY, CANLI());
  const oncekiCanli = JSON.stringify(await kv.get(KEY));

  /* `clients` dizi değil — kod onu dizi sanıp .filter çağırır ve uygulama çöker. */
  await kv.set("marcus-os-snapshot-bozuk", { clients: "metin oldu", cekimIsleri: [] });
  const r1 = await geriYukle("marcus-os-snapshot-bozuk");
  t("bozuk tür REDDEDİLİYOR", r1.kod === 400, "gelen: " + r1.kod);
  t("sebep söyleniyor", (r1.govde.hatalar || []).some((x) => /clients/.test(x)),
    JSON.stringify(r1.govde));
  t("CANLI VERİ HİÇ DEĞİŞMEDİ", JSON.stringify(await kv.get(KEY)) === oncekiCanli,
    "asıl güvence bu — reddetmek yetmez, yazmamış olmalı");

  /* Yanlış anahtardan gelmiş bambaşka bir belge. */
  await kv.set("marcus-os-snapshot-yabanci", { tamamenBaska: [1, 2, 3] });
  const r2 = await geriYukle("marcus-os-snapshot-yabanci");
  t("yabancı belge REDDEDİLİYOR", r2.kod === 400);
  t("canlı veri yine dokunulmadı", JSON.stringify(await kv.get(KEY)) === oncekiCanli);

  const r3 = await geriYukle("marcus-os-snapshot-yokboyle");
  t("olmayan yedek 404", r3.kod === 404);
});

/* ---------------------------------------------------------------- */
await bolum("2) SAĞLAM YEDEK HÂLÂ YÜKLENİYOR — koruma özelliği kırmadı", 4, async () => {
  await kv.set(KEY, CANLI());
  await kv.set("marcus-os-snapshot-saglam", { clients: [{ id: 1, ad: "A" }], cekimIsleri: [], stoklar: {}, _v: 3 });

  const r = await geriYukle("marcus-os-snapshot-saglam");
  t("geri yükleme başarılı", r.kod === 200, JSON.stringify(r.govde && r.govde.error));

  const yeni = await kv.get(KEY);
  t("veri gerçekten değişti", (yeni.clients || []).length === 1);
  t("geri alma kopyası alındı", Boolean(r.govde.geriAlmaEtiketi),
    "geri yüklemeden önceki hâl kaybolmamalı");
  t("sürüm sayacı GERİ GİTMEDİ", yeni._v > 9,
    `gelen: ${yeni._v} — geriye giderse açık sekmeler bayatlıklarını anlayamaz`);
});

/* ---------------------------------------------------------------- */
await bolum("3) KARARDAN ÖNCE UYARI — ne kaybedeceğim", 4, async () => {
  await kv.set(KEY, CANLI());
  await kv.set("marcus-os-snapshot-eski", { clients: [{ id: 1, ad: "A" }], cekimIsleri: [], stoklar: {} });

  const r = await ozetAl("marcus-os-snapshot-eski");
  t("özet isteği çalışıyor", r.kod === 200);
  t("değerlendirme geliyor", Boolean(r.govde.degerlendirme));
  /* clients 4→1 (3), cekimIsleri 2→0 (2), uyelikler 2→0 (2), stoklar 1→0 (1) = 8.
   * `stoklar` bir NESNE ve anahtar sayısı da kayıt sayılıyor — sayımın dizilerle
   * sınırlı olmadığı burada görünüyor. */
  t("kayıp kalemleri sayılıyor — nesne alanlar dahil",
    r.govde.degerlendirme.kayip.toplamKaybolanKayit === 8,
    "gelen: " + (r.govde.degerlendirme.kayip || {}).toplamKaybolanKayit);
  t("yedekte HİÇ OLMAYAN alan ayrıca uyarılıyor",
    r.govde.degerlendirme.uyarilar.some((x) => /uyelikler.*HİÇ YOK/.test(x)),
    JSON.stringify(r.govde.degerlendirme.uyarilar));
});

/* ---------------------------------------------------------------- */
await bolum("4) SAF DOĞRULAMA — sınır durumları", 9, () => {
  t("boş yedek geçersiz", yapiDogrula(null).gecerli === false && yapiDogrula(undefined).gecerli === false);
  t("dizi olan belge geçersiz", yapiDogrula([1, 2]).gecerli === false);
  t("nesne olması gereken alan dizi ise geçersiz",
    yapiDogrula({ clients: [], stoklar: [] }).gecerli === false);
  t("ALANIN YOKLUĞU hata değil", yapiDogrula({ clients: [] }).gecerli === true,
    "eski belgede subeler hiç bulunmayabilir — bu normal");
  t("boş ama tanıdık belge geçerli", yapiDogrula({ clients: [], cekimIsleri: [] }).gecerli === true,
    "gerçekten boş bir sisteme dönmek meşru bir istek");

  /* Eşik DAHİL: tam %25 kayıp uyarır. Sınırın hangi yanda olduğu ölçülüyor —
   * "yaklaşık doğru" bir eşik, uyarının ne zaman çıkacağını belirsiz bırakır. */
  const kucuk = yedekDegerlendir({ clients: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                                 { clients: Array.from({ length: 10 }, (_, i) => i) });
  t("eşiğin ALTINDA uyarı yok", kucuk.uyarilar.length === 0,
    `1/10 kayıp, eşik ${KAYIP_UYARI_ORANI} — her farkta uyarmak uyarıyı değersizleştirir`);
  const tamSinir = yedekDegerlendir({ clients: [1, 2, 3] }, { clients: [1, 2, 3, 4] });
  t("eşiğin TAM ÜSTÜNDE uyarı var", tamSinir.uyarilar.length > 0,
    "%25 kayıp uyarılmaya değer — sınır dahil");

  const b = yedekDegerlendir({ clients: [1] }, { clients: [1, 2, 3, 4] });
  t("büyük kayıp uyarı ÜRETİYOR", b.uyarilar.length > 0);

  t("mevcut verilmezse yalnızca yapı bakılıyor",
    yedekDegerlendir({ clients: [] }).gecerli === true && yedekDegerlendir({ clients: [] }).kayip === null);
});

/* ---------------------------------------------------------------- */
await bolum("5) KAYIP ÖZETİ — okunabilir sıra", 3, () => {
  const o = kayipOzeti({ clients: [1], cekimIsleri: [1, 2, 3] }, { clients: [1, 2, 3, 4, 5], cekimIsleri: [1] });
  t("en çok kaybettiren başta", o.satirlar[0].alan === "clients", JSON.stringify(o.satirlar));
  t("artan alan da listeleniyor", o.satirlar.some((x) => x.alan === "cekimIsleri" && x.fark === 2));
  t("iç muhasebe alanları elenmiş", !o.satirlar.some((x) => x.alan.startsWith("_")));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
