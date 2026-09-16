/* GÜNLÜK İŞ TAKİBİ — lib/is-takibi.js
 *
 * BU TESTİN ASIL İŞİ:
 *   1. ESKİ VE YENİ ZAMAN BİÇİMİ BİRLİKTE ÇALIŞIYOR. Belgede binlerce eski kayıt var ve
 *      zamanları bir EKRAN METNİ ("16.09.2026 14:32:05"). Yeni kayıtlara ISO `zaman`
 *      eklendi. İkisi aynı akışta doğru sıralanmazsa "bugün ne oldu" listesi yalan söyler.
 *   2. ÇÖZÜLEMEYEN ZAMAN UYDURULMUYOR. Bozuk kayıt gün listesine girmemeli; yanlış güne
 *      yazmak hiç yazmamaktan kötüdür.
 *   3. "İŞ KİMİN ELİNDE" = SON DOKUNAN KİŞİ. Kullanıcının seçtiği tanım bu. "Sistem" ve
 *      "Müşteri" kayıtları emek değil, atlanmalı.
 *   4. SAHİPSİZ KART GİZLENMİYOR. Hiç kimsenin dokunmadığı bitmemiş kart sayılmazsa
 *      toplam tutmaz ve gözden kaçan iş görünmez kalır.
 *   5. AŞAMA GEÇİŞİ İKİ AYRI BİÇİMDEN OKUNUYOR (tekil kart ve toplu taşıma farklı yazıyor).
 *   6. ÜRETİM RAPORU GEÇİŞİN HEDEFİNİ SAYIYOR, kartın BUGÜNKÜ aşamasını değil — kart
 *      sonradan revizeye düşse bile o edit yapılmıştır.
 */
import {
  kayitAni, kayitGunu, kayitSaati, gunAnahtari, kisiMi, asamaGecisi,
  isinSahibi, tumOlaylar, gunlukAkis, kisiListesi, kisiPanosu, uretimRaporu,
} from "../lib/is-takibi.js";

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

/** Yerel duvar saatiyle ISO üretir — testin sabit bir güne çakılması için. */
const yerelISO = (y, a, gn, sa = 12, dk = 0) => new Date(y, a - 1, gn, sa, dk, 0).toISOString();

const ISLER = [
  {
    id: 1, marka: "Animed", icerikTuru: "Reels 1", kategori: "Reels",
    asama: "Kontrol Bekliyor", teslimTarihi: "2026-09-20",
    gecmis: [
      { id: 1, tarih: "14.09.2026 09:00:00", yazan: "Yönetici", aciklama: "İş oluşturuldu" },
      { id: 2, tarih: "15.09.2026 11:30:00", zaman: yerelISO(2026, 9, 15, 11, 30),
        yazan: "Önder", aciklama: "Aşama değişti: Çekim Yapıldı → Düzenleniyor" },
      { id: 3, tarih: "16.09.2026 16:45:00", zaman: yerelISO(2026, 9, 16, 16, 45),
        yazan: "Önder", aciklama: "Aşama değişti: Düzenleniyor → Kontrol Bekliyor" },
    ],
    medya: [{ slot: "1", versiyon: 2, dosyaId: "d1", ad: "reels1.mp4",
      tarih: yerelISO(2026, 9, 16, 16, 40), yukleyen: "Önder" }],
  },
  {
    id: 2, marka: "Animed", icerikTuru: "Post 1", kategori: "Post",
    asama: "Onaylandı", teslimTarihi: "2026-09-10",          // GECİKMİŞ
    gecmis: [
      { id: 1, tarih: "16.09.2026 10:00:00", zaman: yerelISO(2026, 9, 16, 10, 0),
        yazan: "Atalay", aciklama: "Aşama değişti: Kontrol Bekliyor → Onaylandı" },
      { id: 2, tarih: "16.09.2026 10:05:00", zaman: yerelISO(2026, 9, 16, 10, 5),
        yazan: "Sistem", aciklama: "Dosya Drive'da taşındı." },
    ],
    medya: [{ slot: "1", versiyon: 1, dosyaId: "d2", ad: "post1.jpg",
      tarih: yerelISO(2026, 9, 16, 9, 55) }],                // ESKİ KAYIT: yukleyen YOK
  },
  {
    id: 3, marka: "Köfteci", icerikTuru: "Post 2", kategori: "Post",
    asama: "Teslim Edildi", teslimTarihi: "2026-09-14",      // BİTMİŞ
    gecmis: [
      { id: 1, tarih: "16.09.2026 12:00:00", zaman: yerelISO(2026, 9, 16, 12, 0),
        yazan: "Atalay", aciklama: 'Toplu taşıma: "Onaylandı" → "Teslim Edildi".' },
    ],
  },
  {
    id: 4, marka: "Köfteci", icerikTuru: "Post 3", kategori: "Post",
    asama: "Edit Bekliyor", teslimTarihi: "2026-09-08",      // SAHİPSİZ + gecikmiş
    gecmis: [{ id: 1, tarih: "13.09.2026 08:00:00", yazan: "Sistem", aciklama: "İş oluşturuldu" }],
  },
];
const BUGUN = "2026-09-16";

/* ---------------------------------------------------------------- */
await bolum("1) ESKİ VE YENİ ZAMAN BİÇİMİ BİRLİKTE", 7, () => {
  t("ISO `zaman` okunuyor",
    kayitGunu({ zaman: yerelISO(2026, 9, 16, 8, 0) }) === "2026-09-16");
  t("eski tr-TR metni ayrıştırılıyor",
    kayitGunu({ tarih: "16.09.2026 14:32:05" }) === "2026-09-16",
    `gelen: ${kayitGunu({ tarih: "16.09.2026 14:32:05" })}`);
  t("tek basamaklı gün de okunuyor",
    kayitGunu({ tarih: "2.08.2026 09:05" }) === "2026-08-02");
  t("saatsiz eski kayıt gün olarak çözülüyor",
    kayitGunu({ tarih: "16.09.2026" }) === "2026-09-16");
  t("saat okunuyor", kayitSaati({ tarih: "16.09.2026 14:32:05" }) === "14:32");
  t("SAATİ OLMAYAN kayıt '00:00' UYDURMUYOR",
    kayitSaati({ tarih: "16.09.2026" }) === "",
    "bilinmeyeni bir saat gibi göstermek, hiç göstermemekten kötüdür");
  t("`zaman` varken eski metin dikkate alınmıyor",
    kayitGunu({ zaman: yerelISO(2026, 9, 16), tarih: "01.01.2000 00:00:00" }) === "2026-09-16");
});

/* ---------------------------------------------------------------- */
await bolum("2) ÇÖZÜLEMEYEN ZAMAN UYDURULMUYOR", 4, () => {
  t("bozuk metin null", kayitAni({ tarih: "dün akşam" }) === null);
  t("eksik alan null", kayitAni({}) === null);
  t("geçersiz ay null", kayitAni({ tarih: "16.13.2026 10:00" }) === null);
  const akis = gunlukAkis({
    isler: [{ id: 9, marka: "X", gecmis: [{ id: 1, tarih: "bozuk", yazan: "Önder", aciklama: "x" }] }],
    gun: BUGUN,
  });
  t("zamanı çözülemeyen olay GÜN listesine girmiyor", akis.length === 0,
    "yanlış güne yazmak hiç yazmamaktan kötüdür");
});

/* ---------------------------------------------------------------- */
await bolum("3) İŞ KİMİN ELİNDE = SON DOKUNAN KİŞİ", 5, () => {
  t("son kişi bulundu", isinSahibi(ISLER[0]) === "Önder");
  t("SİSTEM kaydı atlanıp altındaki kişi bulunuyor", isinSahibi(ISLER[1]) === "Atalay",
    "'Sistem' emek değil, olay");
  t("hiç kişi dokunmamışsa null", isinSahibi(ISLER[3]) === null);
  t("Sistem kişi sayılmıyor", !kisiMi("Sistem") && !kisiMi("Müşteri"));
  t("Yönetici kişi SAYILIYOR", kisiMi("Yönetici") && kisiMi("Önder"),
    "yönetici de iş yapıyor; sayılmazsa emeği görünmez");
});

/* ---------------------------------------------------------------- */
await bolum("4) KİŞİ PANOSU", 7, () => {
  const p = kisiPanosu({ isler: ISLER, bugun: BUGUN });
  const bul = (ad) => p.satirlar.find((x) => x.kisi === ad);
  t("Önder'in elinde 1 iş", bul("Önder") && bul("Önder").elinde === 1,
    JSON.stringify(bul("Önder")));
  t("Atalay'ın elinde 1 iş (bitmiş kart sayılmıyor)",
    bul("Atalay") && bul("Atalay").elinde === 1,
    "id:3 'Teslim Edildi' — elde bekleyen iş değil");
  t("Atalay'ın 1 gecikmiş işi var", bul("Atalay").geciken === 1);
  t("Önder'in gecikmiş işi yok", bul("Önder").geciken === 0,
    "teslim tarihi ilerideyse gecikme yok");
  t("SAHİPSİZ kart ayrıca sayılıyor", p.sahipsiz === 1,
    "gizlenseydi toplam tutmaz, gözden kaçan iş görünmezdi");
  t("bugünkü işlem sayısı doğru", bul("Atalay").bugun === 2,
    `gelen: ${bul("Atalay").bugun} (aşama + toplu taşıma)`);
  t("bu hafta Önder'in 3 işlemi var (2 aşama + 1 yükleme)",
    bul("Önder").buHafta === 3, `gelen: ${bul("Önder").buHafta}`);
});

/* ---------------------------------------------------------------- */
await bolum("5) AŞAMA GEÇİŞİ İKİ BİÇİMDEN DE OKUNUYOR", 5, () => {
  t("tekil kart biçimi",
    JSON.stringify(asamaGecisi("Aşama değişti: Çekim Yapıldı → Düzenleniyor"))
      === JSON.stringify({ onceki: "Çekim Yapıldı", sonraki: "Düzenleniyor" }));
  t("toplu taşıma biçimi (tırnaklı, noktalı)",
    JSON.stringify(asamaGecisi('Toplu taşıma: "Onaylandı" → "Teslim Edildi".'))
      === JSON.stringify({ onceki: "Onaylandı", sonraki: "Teslim Edildi" }),
    JSON.stringify(asamaGecisi('Toplu taşıma: "Onaylandı" → "Teslim Edildi".')));
  t("parantezli ek açıklama ayıklanıyor",
    (asamaGecisi("Aşama değişti: Onaylandı → Revize İstendi (müşteri istedi)") || {}).sonraki
      === "Revize İstendi");
  t("geçiş olmayan kayıt null", asamaGecisi("Dosya bağlantıları güncellendi") === null);
  t("boş girdi null", asamaGecisi("") === null && asamaGecisi(null) === null);
});

/* ---------------------------------------------------------------- */
await bolum("6) GÜNLÜK AKIŞ", 6, () => {
  const bugun = gunlukAkis({ isler: ISLER, gun: BUGUN });
  t("yalnızca o günün olayları", bugun.every((o) => o.gun === BUGUN));
  t("en yeni üstte",
    bugun[0].an >= bugun[bugun.length - 1].an,
    bugun.map((o) => o.saat).join(" "));
  t("YÜKLEME de akışta", bugun.some((o) => o.tur === "yukleme" && o.kisi === "Önder"),
    "'bu videoyu kim editledi' sorusunun en doğrudan cevabı bu satır");
  t("kişiye göre süzülüyor",
    gunlukAkis({ isler: ISLER, gun: BUGUN, kisi: "Atalay" }).every((o) => o.kisi === "Atalay"));
  t("markaya göre süzülüyor",
    gunlukAkis({ isler: ISLER, marka: "Köfteci" }).every((o) => o.marka === "Köfteci"));
  t("kişi listesi alfabetik ve yalnızca gerçek kişiler",
    JSON.stringify(kisiListesi(ISLER)) === JSON.stringify(["Atalay", "Önder", "Yönetici"]),
    JSON.stringify(kisiListesi(ISLER)));
});

/* ---------------------------------------------------------------- */
await bolum("7) YÜKLEYENİ BİLİNMEYEN DOSYA", 2, () => {
  const hepsi = tumOlaylar(ISLER);
  const eskiYukleme = hepsi.find((o) => o.tur === "yukleme" && o.dosyaId === "d2");
  t("eski yükleme akışta duruyor", Boolean(eskiYukleme));
  t("yükleyeni UYDURULMUYOR", eskiYukleme.kisi === null,
    "geçmişe ad yazmak, o işi yapmayan birine emek atfetmek olurdu");
});

/* ---------------------------------------------------------------- */
await bolum("8) ÜRETİM RAPORU", 7, () => {
  const r = uretimRaporu({ isler: ISLER, baslangic: "2026-09-16", bitis: "2026-09-16" });
  const bul = (ad) => r.satirlar.find((x) => x.kisi === ad);
  t("Önder 1 edit bitirdi (→ Kontrol Bekliyor)",
    bul("Önder").asamalar["Kontrol Bekliyor"] === 1);
  t("Atalay 1 onay verdi", bul("Atalay").asamalar["Onaylandı"] === 1);
  t("TOPLU TAŞIMA da sayılıyor", bul("Atalay").asamalar["Teslim Edildi"] === 1,
    "toplu taşıma farklı biçimde yazıyor; okunmazsa emek görünmez");
  t("yükleme ayrıca sayılıyor", bul("Önder").yukleme === 1 && r.yuklemeToplam === 1);
  t("aralık dışı gün sayılmıyor",
    !uretimRaporu({ isler: ISLER, baslangic: "2026-09-17", bitis: "2026-09-18" }).satirlar.length);
  t("toplam satırların toplamına eşit",
    r.toplam["Teslim Edildi"] === r.satirlar.reduce((s, x) => s + x.asamalar["Teslim Edildi"], 0));
  /* ZAMANI ÇÖZÜLEMEYEN OLAY RAPORA GİRMEZ. Girerse aralığa ait olmayan bir emek o
   * aralığın rakamını şişirir ve hak ediş/performans yanlış okunur. */
  const bozuk = [{ id: 50, marka: "X", icerikTuru: "Y", asama: "Onaylandı", gecmis: [
    { id: 1, tarih: "dün", yazan: "Hayalet", aciklama: "Aşama değişti: A → Onaylandı" }] }];
  t("zamanı çözülemeyen olay RAPORA girmiyor",
    uretimRaporu({ isler: bozuk, baslangic: "2026-09-16", bitis: "2026-09-16" }).satirlar.length === 0,
    "aralığa ait olmayan emek o aralığın rakamını şişirirdi");
});

/* ---------------------------------------------------------------- */
await bolum("9) BOŞ / BOZUK GİRDİ ÇÖKMÜYOR", 4, () => {
  t("boş liste", kisiPanosu({ isler: [] }).satirlar.length === 0);
  t("undefined liste", tumOlaylar(undefined).length === 0);
  t("null kayıtlar atlanıyor",
    tumOlaylar([null, { id: 1, gecmis: [null], medya: [null] }]).length === 0);
  t("gün anahtarı geçersiz tarihte null", gunAnahtari(new Date("x")) === null);
});

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
