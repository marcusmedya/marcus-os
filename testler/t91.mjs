/* ALT YAZI — KARTIN ÖZELLİĞİ, PLAN DEVRALIR
 *
 * Alt yazı içerik üretilirken düşünülüyor, paylaşan kişi yalnızca taşıyor. Bu yüzden
 * metin KARTTA yazılıyor (onaydan önce de) ve plan onu devralıyor. Aynı kart dört
 * şubede paylaşılabildiği için plan üzerinde DEĞİŞTİRİLEBİLİYOR; o değişiklik yalnızca
 * o planı etkiliyor.
 *
 * BU TESTİN ASIL İŞİ ÜÇ ŞEY:
 *   1. Kartta yazılan metin MÜŞTERİYE ULAŞIYOR — çözülmezse özellik müşteri tarafında
 *      hiç çalışmaz, kullanıcı "yazdım ama görünmüyor" der.
 *   2. Plana kartla AYNI metin yazılmıyor — yazılsaydı kart metni güncellendiğinde o
 *      plan eski metinde takılı kalırdı.
 *   3. Şubeye özel metin diğer planları etkilemiyor.
 */
import { etkinAltMetin, altMetinKaynagi, planaYazilacak } from "../lib/alt-yazi.js";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";

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

/* ---------------------------------------------------------------- */
bolum("1) DEVRALMA KURALI", 6, () => {
  const kart = { id: 5, altMetin: "Kartın metni" };
  t("plan boşsa kartınki geçerli", etkinAltMetin({ isId: 5 }, kart) === "Kartın metni");
  t("plan kendi metnini yazmışsa o geçerli",
    etkinAltMetin({ isId: 5, altMetin: "Şubeye özel" }, kart) === "Şubeye özel");
  t("planın boşluktan ibaret metni devralmayı bozmuyor",
    etkinAltMetin({ isId: 5, altMetin: "   " }, kart) === "Kartın metni",
    "boşluk 'yazılmış' sayılsaydı kart metni gizlenirdi");
  t("ikisi de yoksa boş", etkinAltMetin({}, {}) === "");
  t("kaynak bildiriliyor",
    altMetinKaynagi({ isId: 5 }, kart) === "kart"
    && altMetinKaynagi({ altMetin: "X" }, kart) === "plan"
    && altMetinKaynagi({}, {}) === "yok");
  t("kartsız plan kendi metnini kullanabiliyor",
    etkinAltMetin({ altMetin: "Serbest metin" }, undefined) === "Serbest metin");
});

/* ---------------------------------------------------------------- */
bolum("2) PLANA NE YAZILIR", 4, () => {
  const kart = { altMetin: "Kartın metni" };
  t("KARTLA AYNI METİN PLANA YAZILMIYOR", planaYazilacak("Kartın metni", kart) === null,
    "yazılsaydı kart metni güncellenince bu plan eski metinde takılı kalırdı");
  t("kenar boşlukları önemsiz", planaYazilacak("  Kartın metni  ", kart) === null);
  t("farklı metin plana yazılıyor", planaYazilacak("Şubeye özel", kart) === "Şubeye özel");
  t("boşaltma null döndürüyor", planaYazilacak("   ", kart) === null,
    "kullanıcı metni sildiyse plan yine kartı izlemeli");
});

/* ---------------------------------------------------------------- */
bolum("3) MÜŞTERİYE ULAŞIYOR", 4, () => {
  /* ASIL RİSK: müşteri paneli veriyi sunucudan alıyor ve kartları görmüyor. Devralma
   * orada çözülmezse kartta yazılan metin müşteriye HİÇ ulaşmaz. */
  const data = {
    clients: [{ id: 1, ad: "Violla", durum: "aktif" }],
    cekimIsleri: [
      { id: 5, marka: "Violla", icerikTuru: "Reels", asama: "Onaylandı", altMetin: "Kartın metni" },
      { id: 6, marka: "Violla", icerikTuru: "Post", asama: "Onaylandı", altMetin: "İkinci kart" },
    ],
    haftalikPaylasimlar: [
      { id: "p1", clientId: 1, gun: "Pzt", tur: "Reels", isId: 5, isAdi: "Reels" },
      { id: "p2", clientId: 1, gun: "Sal", tur: "Reels", isId: 5, isAdi: "Reels", altMetin: "Lara şubesine özel" },
      { id: "p3", clientId: 1, gun: "Çar", tur: "Post", isId: 6, isAdi: "Post" },
    ],
    subeler: [], musteriIcerikleri: [], stoklar: {}, paylasimGecmisi: [],
  };
  /* Üçüncü parametre eşleştirici FABRİKASI (sonucu değil) — üretimde de böyle
   * çağrılıyor (api/data.js). */
  const gorunum = musteriGorunumuUret(data, { id: 1, ad: "Violla" }, markaEslestirici);
  const plan = (id) => (gorunum.paylasimPlani || []).find((x) => x.id === id) || {};

  t("KARTTA YAZILAN METİN MÜŞTERİYE GİDİYOR", plan("p1").altMetin === "Kartın metni",
    JSON.stringify(plan("p1").altMetin) + " — çözülmezse 'yazdım ama görünmüyor' olur");
  t("şubeye özel metin kendi planında", plan("p2").altMetin === "Lara şubesine özel");
  t("ŞUBEYE ÖZEL METİN DİĞER PLANI ETKİLEMİYOR", plan("p1").altMetin === "Kartın metni");
  t("başka kartın metni karışmıyor", plan("p3").altMetin === "İkinci kart", JSON.stringify(plan("p3").altMetin));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
