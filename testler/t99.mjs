/* TOPLU KART AÇMA — "elimde 20 fotoğraf var, hepsi ayrı kart olacak"
 *
 * BU TESTİN ASIL İŞİ:
 *   1. NUMARA KALDIĞI YERDEN DEVAM EDİYOR. Her toplu açılış 1'den başlasaydı aynı markada
 *      iki "Post 3" olurdu; kart adı Drive'da dosya adına ve müşteri paneline gidiyor,
 *      yani iki içerik ayırt edilemez hâle gelirdi.
 *   2. NUMARA MARKAYA ÖZEL. Başka markanın "Post 40"ı bu markanın numarasını ileri
 *      atmamalı — kartlar markayı adıyla saklıyor, liste ortak.
 *   3. DOSYA DOĞRU KARTA GİDİYOR. Kart açılışında numarayı tarayıcı öneriyor ama SON SÖZ
 *      SUNUCUDA: çakışma varsa sunucu yeni numara veriyor. O aralıkta numaraya göre
 *      yüklemek dosyayı BAŞKASININ kartının içine koyardı — sessizce. Bu yüzden kart
 *      toplu etiketiyle bulunuyor; test bunu uçtan ölçüyor.
 *   4. ETİKETLE BULMAK YETKİYİ ATLAMIYOR. Yeni bir bulma yolu açmak, marka kilidini
 *      atlayan bir arka kapı açmak olmamalı.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import {
  topluAdlar, sonrakiNumara, topluIsleriUret, topludanKartBul, adetiCoz,
  tabanTemizle, baslangiciCoz, cakisanAdlar, EN_FAZLA_TOPLU,
} from "../lib/toplu-kart.js";
import { kv } from "@vercel/kv";
import { cagir, TEMIZ_VERI, KIMLIK } from "./denetim.mjs";
const { default: veriUcu } = await import("../api/data.js");

const KEY = "marcus-os-data";
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

/* ---------------------------------------------------------------- */
await bolum("1) NUMARA KALDIĞI YERDEN DEVAM EDİYOR", 9, () => {
  t("hiç kart yokken 1'den başlıyor",
    topluAdlar("Post", 3, []).join("|") === "Post 1|Post 2|Post 3");
  t("mevcut seriden devam ediyor",
    topluAdlar("Post", 2, ["Post 1", "Post 2"]).join("|") === "Post 3|Post 4",
    "1'den başlasa aynı markada iki 'Post 1' olurdu");
  t("aradaki boşluk atlanıyor, en büyüğe bakılıyor",
    topluAdlar("Post", 1, ["Post 1", "Post 7"])[0] === "Post 8",
    "boşluğu doldurmak, silinmiş bir kartın adını diriltirdi");
  t("büyük/küçük harf aynı seri sayılıyor",
    sonrakiNumara(["POST 12"], "post") === 13);
  t("sayı olmayan ek seriye girmiyor",
    sonrakiNumara(["Post tanıtım", "Post 2"], "Post") === 3,
    "'Post tanıtım' bir numara değil");
  t("başka taban etkilemiyor",
    sonrakiNumara(["Reels 40"], "Post") === 1);
  t("numaradan sonra ek varsa seriye girmiyor",
    sonrakiNumara(["Post 5 revize"], "Post") === 1,
    "'Post 5 revize' ayrı bir kart adı, serinin 5. üyesi değil");
  t("taban boşsa ad üretilmiyor", topluAdlar("   ", 5, []).length === 0,
    "adsız yirmi kart, hangisinin ne olduğu anlaşılmayan yirmi kayıt demek");
  t("taban boşlukları toparlanıyor", tabanTemizle("  Post   Reels ") === "Post Reels");
});

/* ---------------------------------------------------------------- */
/* Otomatik devam doğru VARSAYIM ama her zaman doğru DEĞİL: kullanıcı ayrı bir aralık
 * açmak (101'den başlatmak) ya da silinmiş kartların yerini doldurmak isteyebilir.
 * Değer önerilir, dayatılmaz. */
await bolum("2) BAŞLANGIÇ ELLE SEÇİLEBİLİYOR", 7, () => {
  t("elle verilen başlangıç geçerli",
    topluAdlar("Post", 3, ["Post 1", "Post 2"], 101).join("|") === "Post 101|Post 102|Post 103",
    "otomatik devam dayatılsaydı ayrı bir aralık açmak imkânsız olurdu");
  t("boş bırakılınca otomatiğe düşüyor",
    topluAdlar("Post", 2, ["Post 5"], "").join("|") === "Post 6|Post 7");
  t("0 ve eksi otomatiğe düşüyor",
    baslangiciCoz(["Post 5"], "Post", 0) === 6 && baslangiciCoz(["Post 5"], "Post", -4) === 6,
    "yazarken silinen bir hane yüzünden 'Post 0' açılmamalı");
  t("metin otomatiğe düşüyor", baslangiciCoz(["Post 5"], "Post", "abc") === 6);
  t("metin sayı geçiyor", baslangiciCoz([], "Post", "12") === 12);
  t("çakışan ad bildiriliyor",
    cakisanAdlar(["Post 1", "Post 2"], ["POST 1"]).join() === "Post 1",
    "aynı ad Drive'da dosya adına ve müşteri paneline gidiyor — bilinmeden açılmamalı");
  t("çakışma yoksa liste boş", cakisanAdlar(["Post 9"], ["Post 1"]).length === 0);
});

/* ---------------------------------------------------------------- */
await bolum("3) ADET SINIRI", 4, () => {
  t("0 ve altı reddediliyor", adetiCoz(0) === 0 && adetiCoz(-3) === 0);
  t("metin reddediliyor", adetiCoz("abc") === 0);
  t("üst sınır uygulanıyor", adetiCoz(500) === EN_FAZLA_TOPLU,
    "tek JSON belge var; sınırsız çoğaltma belgeyi bir tıklamayla şişirir");
  t("normal sayı geçiyor", adetiCoz("20") === 20);
});

/* ---------------------------------------------------------------- */
await bolum("4) KARTLAR ORTAK ALANLARI ALIYOR, ETİKET TAŞIYOR", 7, () => {
  const ortak = { marka: "Şişçi İbo", kategori: "Post", teslimTarihi: "2026-09-30", sadeceSubeler: ["s1"] };
  const isler = topluIsleriUret({ taban: "Post", adet: 3, mevcutAdlar: [], ortak, topluId: "tk1" });
  t("adet kadar kart", isler.length === 3);
  t("adlar sırayla", isler.map((x) => x.icerikTuru).join("|") === "Post 1|Post 2|Post 3");
  t("ortak alanlar kopyalandı", isler.every((x) => x.marka === "Şişçi İbo" && x.teslimTarihi === "2026-09-30"));
  t("sıra numarası 1'den başlıyor", isler.map((x) => x.topluSira).join() === "1,2,3");
  isler[0].sadeceSubeler.push("s2");
  t("şube kapsamı KOPYALANDI, paylaşılmadı", isler[1].sadeceSubeler.length === 1,
    "aynı dizi paylaşılsaydı bir kartın kapsamını düzenlemek diğerlerini de değiştirirdi");
  t("elle başlangıç kart üretimine de geçiyor",
    topluIsleriUret({ taban: "Post", adet: 2, mevcutAdlar: ["Post 9"], ortak, topluId: "tk1", baslangic: 50 })
      .map((x) => x.icerikTuru).join("|") === "Post 50|Post 51",
    "form ile üretim ayrışırsa ekranda gösterilen ad ile açılan kart farklı olur");
  t("etiket yoksa alan da yok",
    topluIsleriUret({ taban: "Post", adet: 1, mevcutAdlar: [], ortak, topluId: null })[0].topluId === undefined,
    "gereksiz alan belgeye yazılmasın");
});

/* ---------------------------------------------------------------- */
await bolum("5) KART ETİKETLE BULUNUYOR", 4, () => {
  const isler = [
    { id: 90, topluId: "tk1", topluSira: 1 },
    { id: 91, topluId: "tk1", topluSira: 2 },
    { id: 92, topluId: "tk2", topluSira: 1 },
  ];
  t("doğru kart bulunuyor", topludanKartBul(isler, "tk1", 2).id === 91);
  t("başka toplu açılışa karışmıyor", topludanKartBul(isler, "tk2", 1).id === 92);
  t("olmayan sıra null", topludanKartBul(isler, "tk1", 9) === null);
  t("etiketsiz sorgu null", topludanKartBul(isler, "", 1) === null,
    "boş etiket her kartla eşleşseydi dosya rastgele bir karta giderdi");
});

/* ---------------------------------------------------------------- */
/* UÇ: yükleme başlarken kart ETİKETLE bulunuyor.
 *
 * Drive kurulu olmadığı için istek "Drive yükleme kurulu değil" (400) ile bitiyor — ama
 * oraya ULAŞMASI kartın bulunduğunu kanıtlıyor. Kart bulunamasaydı 404 dönerdi. Ayrım
 * bilerek bu iki koda dayandırıldı: sahte bir Drive kurmak, ölçtüğümüz şeyi değiştirirdi. */
const yuklemeIstegi = (govde, kimlik) => cagir(veriUcu, {
  method: "POST", query: {},
  headers: kimlik || { "x-site-password": "ownerpw" },
  body: { driveAction: "yuklemeBasla", slot: "1", dosyaAdi: "a.jpg", mimeTur: "image/jpeg", boyut: 10, ...govde },
});

await bolum("6) UÇ: NUMARA DEĞİŞSE BİLE DOSYA DOĞRU KARTA GİDİYOR", 5, async () => {
  const veri = TEMIZ_VERI();
  /* Tarayıcı bu kartı 50 numarayla açtı; sunucu çakışma yüzünden 77 verdi. */
  veri.cekimIsleri = [
    { id: 50, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Başkasının kartı" },
    { id: 77, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Post 1", topluId: "tk9", topluSira: 1 },
  ];
  await kv.set(KEY, veri);

  const etiketle = await yuklemeIstegi({ topluId: "tk9", topluSira: 1 });
  t("etiketle kart bulunuyor", etiketle.kod !== 404,
    "404 = kart bulunamadı; gelen: " + etiketle.kod + " " + JSON.stringify(etiketle.govde));
  t("kart bulunduktan sonra Drive kurulumunda duruyor", etiketle.kod === 400,
    "gelen: " + etiketle.kod + " " + JSON.stringify(etiketle.govde));

  const yanlisSira = await yuklemeIstegi({ topluId: "tk9", topluSira: 2 });
  t("olmayan sıra 404", yanlisSira.kod === 404,
    "olmayan sıra bir karta düşerse dosya yanlış yere gider");

  const bilinmeyenEtiket = await yuklemeIstegi({ topluId: "yok", topluSira: 1 });
  t("bilinmeyen etiket 404", bilinmeyenEtiket.kod === 404);

  /* Etiket verilmediğinde eski yol duruyor — var olan yükleme akışı bozulmamalı. */
  const numarayla = await yuklemeIstegi({ isId: 77 });
  t("numarayla eski yol çalışmaya devam ediyor", numarayla.kod === 400,
    "gelen: " + numarayla.kod);
});

await bolum("7) ETİKET MARKA KİLİDİNİ ATLAMIYOR", 2, async () => {
  const veri = TEMIZ_VERI();
  veri.cekimIsleri = [{ id: 5, marka: "GİZLİ Marka", kategori: "Post", icerikTuru: "Post 1", topluId: "tk8", topluSira: 1 }];
  await kv.set(KEY, veri);
  /* Personel yalnızca "Şişçi İbo" markasına yetkili (bkz. denetim.mjs). */
  const r = await yuklemeIstegi({ topluId: "tk8", topluSira: 1 }, KIMLIK);
  t("başka markanın kartına etiketle yüklenemiyor", r.kod === 403,
    "gelen: " + r.kod + " " + JSON.stringify(r.govde));
  const r2 = await yuklemeIstegi({ isId: 5 }, KIMLIK);
  t("numarayla da yüklenemiyor (aynı sınır)", r2.kod === 403, "gelen: " + r2.kod);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
