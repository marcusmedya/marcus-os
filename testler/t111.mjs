/* MÜŞTERİ DETAYI — KARAR ŞERİDİ, ROZETLER, KİMLİK SATIRI  (lib/musteri-karar.js)
 *
 * NEDEN BU TEST VAR
 * -----------------
 * Müşteri detay panelinin üst bloğu üç ayrı `&&` dalıydı ve hepsi JSX'in içindeydi:
 * gecikmiş bir markada ödeme kutusu DA, gecikme kutusu DA çiziliyor, iki birincil düğme
 * yan yana duruyordu. Kural JSX'te olduğu için Node'dan çağrılamıyordu — yani bu davranış
 * hiçbir zaman sınanamamıştı (`marcus-mimari` §4).
 *
 * Kural `lib/musteri-karar.js`'e taşındı. Bu dosya onun DAVRANIŞINI sınar: kaynak
 * metnine hiç bakmaz, fonksiyonları çağırır ve döndürdüklerine bakar.
 *
 * ASIL SINANAN ÜÇ ŞEY:
 *   1. Aynı anda TEK şerit — en ağır olan kazanıyor mu, diğerleri susuyor mu.
 *   2. Sağlıklı markada birincil eylem ÜRETİLMİYOR mu (`eylem: null`).
 *   3. Uydurma sayı/rozet yok — okunamayan başlangıç, ücretsiz marka, tamamen faturalı
 *      marka: hiçbirinde olmayan bilgi yazılmıyor.
 *
 * Gerçek veritabanına, ağa ve tarihe bağımlılığı YOK: `bugun` parametresi dışarıdan
 * veriliyor, böylece test ayın kaçı olduğuna göre sonuç değiştirmiyor.
 */
import {
  musteriKararSeridi, musteriRozetleri, faturaSapmasi, calismaAyi, kimlikParcalari,
  SERIT, EYLEM, TON, ODEME_SOZCUGU,
} from "../lib/musteri-karar.js";

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
await bolum("1) TEK ŞERİT — en ağır olan kazanır", 9, () => {
  /* GİRDİ BİLEREK ÇAKIŞIK: hem gecikme var, hem ödeme durumu "gecikti", hem de
   * ödeme günü tanımlı. Üç dal da doğruysa üçü birden çizilirdi — eski hata buydu. */
  const cakisik = {
    gecikenAy: 3, gecikenBakiye: 120000, aylikUcret: 45000,
    odemeDurumu: { status: "gecikti", label: "12 gün gecikti" }, odemeGunu: 5,
  };
  const s = musteriKararSeridi(cakisik);
  t("çakışık girdide GECİKME kazanıyor", s.serit === SERIT.GECIKME, s.serit);
  t("gecikmede ton tehlike", s.ton === TON.TEHLIKE, s.ton);
  t("başlık ay sayısını söylüyor", s.baslik === "3 aydır ödenmedi", s.baslik);
  t("28px'e basılacak tutar clientOverdueBalance'tan geliyor",
    s.vurguTutar === 120000, `gelen ${s.vurguTutar} — 45000×3=135000 çarpımı DEĞİL, kısmi ödemeler düşülmüş bakiye olmalı`);
  t("yeni ay ücreti ayrı bir değer olarak taşınıyor", s.yanTutar === 45000, String(s.yanTutar));
  t("gecikmede birincil eylem tebliğ", s.eylem && s.eylem.anahtar === EYLEM.TEBLIG, JSON.stringify(s.eylem));

  /* Gecikme yokken sıra ödeme uyarısına geçmeli — ama yalnızca ona. */
  const uyari = musteriKararSeridi({
    gecikenAy: 0, aylikUcret: 45000,
    odemeDurumu: { status: "bekliyor", label: "Ödeme günü geçti (ayın 5'i) — kalan ₺12.000" }, odemeGunu: 5,
  });
  t("gecikme yoksa ödeme uyarısı şeridi", uyari.serit === SERIT.ODEME_UYARISI, uyari.serit);
  t("uyarıda 28px'lik tutar YOK", uyari.vurguTutar === null, String(uyari.vurguTutar));
  t("uyarı metni clientPaymentStatus'tan AYNEN alınıyor (kısmi ödeme notu korunuyor)",
    uyari.baslik === "Ödeme günü geçti (ayın 5'i) — kalan ₺12.000", uyari.baslik);
});

/* ---------------------------------------------------------------- */
await bolum("2) SAĞLIKLI MARKADA BİRİNCİL EYLEM ÜRETİLMİYOR", 6, () => {
  for (const durum of ["odendi", "yaklasiyor"]) {
    const s = musteriKararSeridi({
      gecikenAy: 0, aylikUcret: 45000,
      odemeDurumu: { status: durum, label: "Bu ay ödendi" }, odemeGunu: 5,
    });
    t(`${durum}: şerit sakin`, s.serit === SERIT.SAKIN, s.serit);
    t(`${durum}: düğme ÇİZİLMİYOR`, s.eylem === null, JSON.stringify(s.eylem));
    t(`${durum}: ton nötr`, s.ton === TON.NOTR, s.ton);
  }
});

/* ---------------------------------------------------------------- */
await bolum("3) ÖDEME GÜNÜ TANIMSIZ — sessiz kalmıyor", 4, () => {
  /* clientPaymentStatus ödeme günü yokken null döner; o hâlde panel eskiden yalnızca
   * gri bir cümle yazıyordu ve tek eylem "düzenle butonuna git" demekti. */
  const s = musteriKararSeridi({ gecikenAy: 0, aylikUcret: 45000, odemeDurumu: null, odemeGunu: null });
  t("şerit ödeme günü yok", s.serit === SERIT.ODEME_GUNU_YOK, s.serit);
  t("sebebi söyleniyor", /otomatik takip başlamıyor/.test(s.baslik), s.baslik);
  t("eylem ödeme günü ekle", s.eylem && s.eylem.anahtar === EYLEM.ODEME_GUNU_EKLE, JSON.stringify(s.eylem));
  t("tonu nötr — bu bir hata değil, eksik", s.ton === TON.NOTR, s.ton);

  /* Ödeme günü 0 yazılmış olabilir (kullanıcı sıfır girdi): yine tanımsız sayılmalı,
   * çünkü clientPaymentStatus da `!client.odemeGunu` ile null dönüyor. */
});

await bolum("3b) ÖDEME GÜNÜ 0 — clientPaymentStatus ile aynı yorum", 1, () => {
  const s = musteriKararSeridi({ gecikenAy: 0, odemeDurumu: null, odemeGunu: 0 });
  t("0 da tanımsız sayılıyor", s.serit === SERIT.ODEME_GUNU_YOK, s.serit);
});

/* ---------------------------------------------------------------- */
await bolum("4) ROZETLER — en fazla üç, rakam yok", 8, () => {
  const hepsi = musteriRozetleri({
    durum: "donduruldu", durumEtiketi: "❄️ Donduruldu",
    odemeDurumu: { status: "gecikti", label: "12 gün gecikti" },
    aylikUcret: 45000, faturaliTutar: 20000,
  });
  t("üç rozet: durum · ödeme · faturalama", hepsi.length === 3, JSON.stringify(hepsi.map((r) => r.metin)));
  t("sıra korunuyor", hepsi.map((r) => r.anahtar).join(",") === "durum,odeme,fatura", hepsi.map((r) => r.anahtar).join(","));
  t("ödeme rozeti Müşteriler tablosundaki sözcüğün AYNISI",
    hepsi[1].metin === ODEME_SOZCUGU.gecikti && hepsi[1].metin === "Gecikti", hepsi[1].metin);
  t("hiçbir rozet içinde rakam YOK",
    hepsi.every((r) => !/[0-9]/.test(r.metin)), JSON.stringify(hepsi.map((r) => r.metin)));

  const tamFatura = musteriRozetleri({
    durum: "aktif", durumEtiketi: "Aktif",
    odemeDurumu: { status: "odendi", label: "Bu ay ödendi" },
    aylikUcret: 45000, faturaliTutar: 45000,
  });
  t("tamamen faturalı marka SAPMA değil — üçüncü rozet çizilmiyor",
    tamFatura.length === 2 && !tamFatura.some((r) => r.anahtar === "fatura"),
    JSON.stringify(tamFatura.map((r) => r.metin)));

  const takipsiz = musteriRozetleri({ durum: "aktif", durumEtiketi: "Aktif", odemeDurumu: null, aylikUcret: 0, faturaliTutar: 0 });
  t("ödeme takibi ve ücreti olmayan markada tek rozet kalıyor", takipsiz.length === 1, JSON.stringify(takipsiz));
  t("durum rozetinin tonu durumdan geliyor", takipsiz[0].ton === TON.BASARI, takipsiz[0].ton);
  t("dondurulmuş markanın tonu uyarı", hepsi[0].ton === TON.UYARI, hepsi[0].ton);
});

/* ---------------------------------------------------------------- */
await bolum("5) FATURA SAPMASI", 5, () => {
  t("ücret girilmemişse rozet uydurulmuyor",
    faturaSapmasi({ aylikUcret: 0, faturaliTutar: 0 }) === null);
  t("tamamen faturalı → sapma yok", faturaSapmasi({ aylikUcret: 45000, faturaliTutar: 45000 }) === null);
  t("faturalı tutar ücreti aşsa da sapma yok", faturaSapmasi({ aylikUcret: 45000, faturaliTutar: 60000 }) === null);
  const kismi = faturaSapmasi({ aylikUcret: 45000, faturaliTutar: 1 });
  t("kısmi faturalı uyarı tonunda", kismi && kismi.metin === "Kısmi faturalı" && kismi.ton === TON.UYARI, JSON.stringify(kismi));
  const yok = faturaSapmasi({ aylikUcret: 45000, faturaliTutar: 0 });
  t("faturasız nötr tonda", yok && yok.metin === "Faturasız" && yok.ton === TON.NOTR, JSON.stringify(yok));
});

/* ---------------------------------------------------------------- */
await bolum("6) KAÇINCI AY — uydurma sayı yok", 7, () => {
  const bugun = new Date(2026, 8, 18); // Eylül 2026 (ay indeksi 8)
  t("başlangıç ayının kendisi 1. ay", calismaAyi("2026-09", bugun) === 1, String(calismaAyi("2026-09", bugun)));
  t("bir önceki ay 2. ay", calismaAyi("2026-08", bugun) === 2, String(calismaAyi("2026-08", bugun)));
  t("yıl sınırı doğru geçiliyor", calismaAyi("2025-09", bugun) === 13, String(calismaAyi("2025-09", bugun)));
  t("tek haneli ay yazımı da okunuyor", calismaAyi("2026-9", bugun) === 1, String(calismaAyi("2026-9", bugun)));
  t("gün eklenmiş eski kayıt da okunuyor", calismaAyi("2026-08-01", bugun) === 2, String(calismaAyi("2026-08-01", bugun)));
  t("okunamayan başlangıçta sayı UYDURULMUYOR", calismaAyi("bilinmiyor", bugun) === null);
  t("gelecekte başlayan markada sayı yazılmıyor", calismaAyi("2027-01", bugun) === null, String(calismaAyi("2027-01", bugun)));
});

/* ---------------------------------------------------------------- */
await bolum("7) KİMLİK SATIRI — olmayan parça hiç yazılmaz", 5, () => {
  const bugun = new Date(2026, 8, 18);
  const tam = kimlikParcalari({ kategori: "Kafe & Restoran", baslangic: "2026-07" }, bugun);
  t("üç parça", tam.length === 3, JSON.stringify(tam));
  t("sıra: kategori · başlangıç · N. ay",
    tam.map((p) => p.metin).join(" · ") === "Kafe & Restoran · 2026-07 · 3. ay", tam.map((p) => p.metin).join(" · "));
  t("rakam taşıyan parçalar mono işaretli",
    tam[1].tur === "sayi" && tam[2].tur === "sayi" && tam[0].tur === "metin",
    tam.map((p) => p.tur).join(","));

  const eksik = kimlikParcalari({ kategori: "", baslangic: "" }, bugun);
  t("hiçbir bilgi yoksa satır boş kalıyor (boş ayıraç yok)", eksik.length === 0, JSON.stringify(eksik));

  const yalnizKategori = kimlikParcalari({ kategori: "Kafe", baslangic: "hatalı" }, bugun);
  t("okunamayan başlangıç yine de metin olarak yazılıyor ama ay sayısı yazılmıyor",
    yalnizKategori.length === 2 && !yalnizKategori.some((p) => /\. ay$/.test(p.metin)),
    JSON.stringify(yalnizKategori.map((p) => p.metin)));
});

/* ---------------------------------------------------------------- */
await bolum("8) SAFLIK — girdi DEĞİŞTİRİLMİYOR", 3, () => {
  const girdi = {
    gecikenAy: 2, gecikenBakiye: 90000, aylikUcret: 45000,
    odemeDurumu: { status: "gecikti", label: "9 gün gecikti" }, odemeGunu: 5,
  };
  const kopya = JSON.parse(JSON.stringify(girdi));
  musteriKararSeridi(girdi);
  t("karar şeridi girdiyi değiştirmiyor", JSON.stringify(girdi) === JSON.stringify(kopya));

  const rozetGirdi = { durum: "aktif", durumEtiketi: "Aktif", odemeDurumu: { status: "odendi" }, aylikUcret: 100, faturaliTutar: 10 };
  const rozetKopya = JSON.parse(JSON.stringify(rozetGirdi));
  musteriRozetleri(rozetGirdi);
  t("rozet üretimi girdiyi değiştirmiyor", JSON.stringify(rozetGirdi) === JSON.stringify(rozetKopya));

  /* Boş çağrı çökmemeli: ilk render'da `client` alanları tanımsız olabiliyor. */
  const bos = musteriKararSeridi();
  t("argümansız çağrı çökmüyor, ödeme günü yok şeridi dönüyor", bos.serit === SERIT.ODEME_GUNU_YOK, bos.serit);
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR — t95'teki bekçinin aynısı.
 *
 * Bir `bolum()` çağrısı silinirse ya da `await` unutulursa test hiçbir şey ölçmeden
 * "0 kaldı" deyip BAŞARIYLA çıkar; koşucu da yakalamaz (çıkış kodu 0, ✗ yok). Kontrol
 * eklerken bu sabiti de artır — asıl engellenmek istenen sayının kendiliğinden DÜŞMESİ. */
const BEKLENEN = 48;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
