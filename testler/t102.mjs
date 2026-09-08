/* SİLME DEFTERİ + "BUGÜN" ÖZETİ
 *
 * BU TESTİN ASIL İŞİ:
 *   1. SİLME DEFTERE YAZILIYOR. Denetimde ölçüldü: defterdeki on üç kayıt noktasının hepsi
 *      giriş/hesap/yedek işlemleriydi; kart, müşteri, reklam silmenin hiçbir izi yoktu.
 *      Silme bu sistemde geri alması en zor işlem.
 *   2. GÖNDERİLMEYEN ALAN SİLME SAYILMIYOR. Personel yalnızca dokunduğu alanları gönderiyor;
 *      bu ayrım yapılmazsa her personel kaydı, dokunmadığı her listeyi "silinmiş" gösterir
 *      ve defter yalanla dolar.
 *   3. İKİ KAYIT YOLU DA BAĞLI. Bu projede "yalnızca bir yola bağlandı" hatası yaşandı.
 *   4. "BUGÜN" ÖZETİ plan tarihini haftaKey + gün kaymasından üretiyor. Kayıtta hazır
 *      tarih YOK; `k.tarih` diye bakan bir kod sessizce hiçbir şey bulmaz.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { silinenleriBul, silmeKaydi, EN_FAZLA_AYRINTI } from "../lib/silme-defteri.js";
import { bugunOzeti, bugunBasligi, planTarihi } from "../lib/bugun.js";
import { kv } from "@vercel/kv";
import { defteriOku } from "../lib/kv-yaz.js";
import { cagir, TEMIZ_VERI } from "./denetim.mjs";
import crypto from "node:crypto";
const { default: veriUcu } = await import("../api/data.js");

const KEY = "marcus-os-data";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const PERSONEL = { "x-staff-username-b64": b64("personel"), "x-staff-password-b64": b64("pw") };

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
await bolum("1) SİLİNEN KAYIT BULUNUYOR", 6, () => {
  const onceki = {
    cekimIsleri: [{ id: 1, icerikTuru: "Post 1" }, { id: 2, icerikTuru: "Post 2" }],
    clients: [{ id: 5, ad: "İbo Burger" }],
  };
  const sonraki = { cekimIsleri: [{ id: 2, icerikTuru: "Post 2" }], clients: [{ id: 5, ad: "İbo Burger" }] };
  const bulunan = silinenleriBul(onceki, sonraki);
  t("silinen kart bulundu", bulunan.length === 1 && bulunan[0].id === 1, JSON.stringify(bulunan));
  t("adı da kaydediliyor", bulunan[0].ad === "Post 1", "sadece numara, sonradan kimseye bir şey söylemez");
  t("etiket okunabilir", bulunan[0].etiket === "operasyon kartı");
  t("silinmeyen kayıt listeye girmiyor", !bulunan.some((x) => x.id === 2));

  /* GÖNDERİLMEYEN ALAN — silme DEĞİL. */
  const eksikYuk = { cekimIsleri: [{ id: 1, icerikTuru: "Post 1" }, { id: 2, icerikTuru: "Post 2" }] };
  t("gönderilmeyen alan silme sayılmıyor", silinenleriBul(onceki, eksikYuk).length === 0,
    "personel dokunmadığı listeyi göndermiyor; sayılsaydı defter yalanla dolardı");
  t("hiç değişiklik yoksa boş", silinenleriBul(onceki, onceki).length === 0);
});

await bolum("2) DEFTER KAYDI KIRPILIYOR AMA SAYI TAM", 4, () => {
  const cok = Array.from({ length: EN_FAZLA_AYRINTI + 7 }, (_, i) => ({ id: i, etiket: "operasyon kartı", ad: `K${i}` }));
  const kayit = silmeKaydi(cok, "Yönetici");
  t("ayrıntı kırpıldı", kayit.kayitlar.length === EN_FAZLA_AYRINTI);
  t("TOPLAM tam", kayit.toplam === EN_FAZLA_AYRINTI + 7,
    "yüz kayıt silinirse defter dolmasın ama sayı gizlenmesin");
  t("kaç tanesinin kırpıldığı yazılı", kayit.kirpildi === 7);
  t("boş listede kayıt üretilmiyor", silmeKaydi([], "Yönetici") === null,
    "her kayıtta boş bir defter satırı yazmak defteri işe yaramaz hâle getirir");
});

/* ---------------------------------------------------------------- */
const sifirla = (izinler) => kv.set(KEY, {
  ...TEMIZ_VERI(),
  cekimIsleri: [
    { id: 1, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Post 1", asama: "Düzenleniyor" },
    { id: 2, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Post 2", asama: "Düzenleniyor" },
  ],
  personelHesaplari: [{
    id: "p1", ad: "Personel", kullaniciAdi: "personel",
    sifreSalt: "tuz", sifreHash: hash("pw", "tuz"),
    izinler: { cekimEdit: true, kartSilme: true, ...izinler },
    markalar: [],
  }],
  _alanSurumleri: {},
});

/* YÖNETİCİ YOLU BELGENİN TAMAMINI BEKLİYOR, personel yolu yalnızca dokunduğu alanı.
 * İlk yazımda yönetici için de tek alan gönderildi ve güvenlik freni haklı olarak
 * "2 müşteriden 0'a düşüyor" deyip 409 verdi — testin kendi kurgusu hatalıydı. */
const kaydet = async (isler, kimlik) => {
  const d = await kv.get(KEY);
  const govde = kimlik
    ? { data: { cekimIsleri: isler }, _v: d._v, degisenAlanlar: ["cekimIsleri"], alanSurumleri: d._alanSurumleri || {} }
    : { data: { ...d, cekimIsleri: isler }, _v: d._v };
  return cagir(veriUcu, {
    method: "POST", query: {},
    headers: kimlik || { "x-site-password": "ownerpw" },
    body: govde,
  });
};

await bolum("3) UÇ: YÖNETİCİ SİLİNCE DEFTERE YAZILIYOR", 4, async () => {
  await sifirla({});
  await kv.set("marcus-os-guvenlik-defteri", []);
  const r = await kaydet([{ id: 2, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Post 2", asama: "Düzenleniyor" }]);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const defter = await defteriOku();
  const kayit = defter.find((x) => x.olay === "kayit-silindi");
  t("defterde silme kaydı var", Boolean(kayit), JSON.stringify(defter));
  t("silinen kartın adı yazılı", kayit && kayit.kayitlar.some((x) => x.ad === "Post 1"), JSON.stringify(kayit));
  t("kim sildiği yazılı", kayit && kayit.kim === "Yönetici", JSON.stringify(kayit && kayit.kim));
});

await bolum("4) UÇ: PERSONEL YOLU DA BAĞLI", 3, async () => {
  await sifirla({});
  await kv.set("marcus-os-guvenlik-defteri", []);
  const r = await kaydet([{ id: 1, marka: "Şişçi İbo", kategori: "Post", icerikTuru: "Post 1", asama: "Düzenleniyor" }], PERSONEL);
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod + " " + JSON.stringify(r.govde && r.govde.error));
  const kayit = (await defteriOku()).find((x) => x.olay === "kayit-silindi");
  t("personelin silmesi de deftere yazıldı", Boolean(kayit),
    "iki kayıt yolundan biri unutulursa boşluk aylarca fark edilmez");
  t("personelin adı yazılı", kayit && kayit.kim === "Personel", JSON.stringify(kayit && kayit.kim));
});

await bolum("5) UÇ: SİLME YOKSA DEFTERE YAZILMIYOR", 2, async () => {
  await sifirla({});
  await kv.set("marcus-os-guvenlik-defteri", []);
  const d = await kv.get(KEY);
  const r = await kaydet(d.cekimIsleri.map((j) => ({ ...j, asama: "Kontrol Bekliyor", medya: [{ slot: "1", dosyaId: "D" }] })));
  t("kayıt kabul ediliyor", r.kod === 200, "gelen: " + r.kod);
  t("defter boş kaldı", (await defteriOku()).every((x) => x.olay !== "kayit-silindi"),
    "her kayıtta satır yazılsaydı defter gürültüden okunamazdı");
});

/* ---------------------------------------------------------------- */
await bolum("6) BUGÜN ÖZETİ", 8, () => {
  const isler = [
    { id: 1, marka: "İbo", icerikTuru: "Post 1", kategori: "Post", asama: "Düzenleniyor", teslimTarihi: "2026-09-01" },
    { id: 2, marka: "İbo", icerikTuru: "Post 2", kategori: "Post", asama: "Kontrol Bekliyor", teslimTarihi: "2026-09-08" },
    { id: 3, marka: "İbo", icerikTuru: "Post 3", kategori: "Post", asama: "Teslim Edildi", teslimTarihi: "2026-08-01" },
    { id: 4, marka: "İbo", icerikTuru: "Post 4", kategori: "Post", asama: "Revize İstendi", teslimTarihi: "" },
  ];
  const planlar = [
    { id: 11, marka: "İbo", tur: "Post", haftaKey: "2026-09-07", gun: 1 },              // bugün
    { id: 12, marka: "İbo", tur: "Reels", haftaKey: "2026-08-31", gun: 2 },             // geçmiş
    { id: 13, marka: "İbo", tur: "Post", haftaKey: "2026-09-07", gun: 1, yapildi: true },
  ];
  const o = bugunOzeti({ isler, planlar, bugun: "2026-09-08" });
  t("plan tarihi haftaKey + gün kaymasından üretiliyor",
    planTarihi({ haftaKey: "2026-09-07", gun: 1 }) === "2026-09-08",
    "kayıtta hazır tarih YOK; `k.tarih` diye bakan kod sessizce hiçbir şey bulmaz");
  t("geciken iş bulundu", o.geciken.length === 1 && o.geciken[0].id === 1);
  t("BİTMİŞ iş 'geciken' sayılmıyor", !o.geciken.some((x) => x.id === 3),
    "teslim edilmiş iş gecikmiş görünürse liste güvenilmez olur");
  t("tarihsiz kart gecikmiş sayılmıyor", !o.geciken.some((x) => x.id === 4),
    "tarih girilmemiş olması gecikme değildir");
  t("bugün teslim doğru", o.bugunTeslim.length === 1 && o.bugunTeslim[0].id === 2);
  t("müşteride bekleyen ayrı", o.musteride.length === 1 && o.musteride[0].id === 2);
  t("yapılmış plan listede yok", !o.bugunPaylasim.some((x) => x.id === 13));
  t("boş günde açıkça söyleniyor",
    bugunBasligi(bugunOzeti({ isler: [], planlar: [], bugun: "2026-09-08" })).includes("acil bir şey görünmüyor"));
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
