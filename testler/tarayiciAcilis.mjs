/**
 * TARAYICI AÇILIŞ TESTİ — uygulamayı GERÇEKTEN çizer.
 *
 * Neden var: bu projedeki denetimlerin ve sunucu kontrollerinin hiçbiri uygulamayı çizmiyordu.
 * `operasyonOrtakProps` nesnesi JSX'ten bileşen gövdesine taşınınca `data.clients` null
 * üzerinden okundu, React ilk render'da patladı ve uygulama SİYAH EKRANLA açıldı —
 * üretime böyle çıktı. Derleme temizdi, bütün denetimler yeşildi, hiçbiri görmedi:
 * `#root` boş kalıyor, `<body>` zaten koyu (#0C0E13), yani ekran simsiyah.
 *
 * Bu test tam olarak o boşluğu kapatır:
 *   1. Derlenmiş uygulamayı yerel bir sunucudan açar
 *   2. `#root` içine GERÇEKTEN içerik çizildiğini doğrular
 *   3. Açılış sırasındaki yakalanmamış JS hatalarını (`pageerror`) yakalar
 *
 * GÜVENLİK: üretim ortamına ve gerçek veriye HİÇ dokunmaz.
 *   - Sunucu 127.0.0.1'de, rastgele portta; yalnızca `dist/` klasörünü servis eder.
 *   - `/api/*` yanıtları bu dosyadaki UYDURMA verilerden gelir (Redis yok, Drive yok).
 *   - 127.0.0.1 dışına giden HER istek boş yanıtla karşılanır — Google Fonts dahil.
 *     Böylece test ağa bağımlı değil ve dış dünyaya tek bir istek bile gitmez.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(KOK, "dist");

let gecen = 0;
let kalan = 0;
function kontrol(ad, sonucDogruMu, ayrinti = "") {
  if (sonucDogruMu) {
    gecen++;
    console.log(`  ✓ ${ad}`);
  } else {
    kalan++;
    console.log(`  ✗ ${ad}${ayrinti ? " — " + ayrinti : ""}`);
  }
}

/* ── UYDURMA VERİ ────────────────────────────────────────────────────────────────
 * Adlar bilerek gerçek dışı. Buraya asla üretim verisi kopyalanmaz. */
const SAHTE_YANIT = () => ({ role: "owner", data: SAHTE_BELGE });

const SAHTE_BELGE = {
  // Gerçek bir belgenin taşıdığı ÜST DÜZEY ALANLARIN HEPSİ burada. Eksik bırakmak testi
  // değersizleştirirdi: fixture gerçekte hiç oluşmayan bir hâli temsil eder, test de
  // olmayan sorunları kovalar. Diziler boş, iki kayıt uydurma.
  clients: [
    { id: "sahte-marka-1", ad: "Deneme Kafe (TEST)", name: "Deneme Kafe (TEST)",
      aylikUcret: 1000, baslangic: "2026-01-01", durum: "aktif",
      maliyetler: [], odemeKayitlari: [], faturalar: [], ucretGecmisi: [] },
  ],
  cekimIsleri: [
    { id: "sahte-kart-1", no: 1, icerikAdi: "Deneme Reels 1 (TEST)",
      marka: "Deneme Kafe (TEST)", kategori: "Reels", asama: "Çekim Bekliyor",
      medya: [], gecmis: [] },
  ],
  firmaAdi: "Deneme Ajans (TEST)",
  tebligSablonu: "",
  markaKimligiGorseli: "",
  sonYedekTarihi: "",
  // Listeler
  haftalikPaylasimlar: [], hesaplar: [], subeler: [], bekleyenTahsilatlar: [],
  reklamlar: [], musteriIcerikleri: [], avanslar: [], personel: [],
  paylasimGecmisi: [], personelOdemeleri: [], markalasmaSurecleri: [],
  freelancerlar: [], birikimler: [], hesapTransferleri: [], hesapOlcumleri: [],
  hesapDuzeltmeleri: [], giderKalemleri: [], gelirKalemleri: [], vergiTakvimi: [],
  uyelikler: [], teklifSablonlari: [], sozlesmeSablonlari: [], ofisGiderleri: [],
  musteriGirisleri: [], kisiselGorevler: [], monthly: [], silinenler: [],
  islemGecmisi: [], odemeler: [],
  // Haritalar
  stoklar: {}, isUcretleri: {}, isUcretDetaylari: {}, staffPermissions: {},
  cekimSirasi: {}, _alanSurumleri: {},
};

/* ── MÜŞTERİ DETAY PANELİ İÇİN FİXTURE — TARİHTEN BAĞIMSIZ ───────────────────────
 *
 * Panelin karar şeridi `clientOverdueMonths` / `clientOverdueBalance` /
 * `clientPaymentStatus` üzerinden geliyor ve ÜÇÜ DE `new Date()`e bakıyor. Sabit tarih
 * yazılsaydı test bir süre sonra başka bir dala düşer ve kimse dokunmadan kırmızıya
 * dönerdi — kırılgan bir test, olmayan testten kötüdür. Bu yüzden her şey bugüne GÖRELİ:
 *
 *   · `odemeGunu: 1` → `clientOverdueMonths` içindeki "bu ayın vadesi henüz gelmedi"
 *     atlaması (`now.getDate() < odemeGunu`) HİÇBİR GÜN doğru olamaz. Ayın kaçı olduğu
 *     sonucu değiştirmez.
 *   · `baslangic` = 8 ay önce → kimlik satırında her zaman "9. ay".
 *   · 6 ay önceki ay TAM ödenmiş → geriye sayım orada durur: her zaman "6 aydır ödenmedi".
 *     (Başlangıç sınırına hiç ulaşılmaz, yani sayıyı belirleyen tek şey bu ödeme kaydı.)
 *   · Bakiye = 6 × 12.000 = 72.000 ₺, her koşuda aynı.
 *
 * Adlar bilerek gerçek dışı; buraya asla üretim verisi kopyalanmaz. */
const ayGeriye = (k) => {
  const d = new Date();
  const g = new Date(d.getFullYear(), d.getMonth() - k, 1);
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}`;
};

const GECIKMELI_MARKA = "Gecikmis Marka (TEST)";
const GECIKMELI_KATEGORI = "Kafe";
const GECIKMELI_UCRET = 12000;
const GECIKMELI_AY = 6;           // kaç aydır ödenmemiş görünecek
const GECIKMELI_CALISMA_AYI = 9;  // kimlik satırındaki "N. ay"
const GECIKMELI_BASLANGIC = ayGeriye(GECIKMELI_CALISMA_AYI - 1);
const GECIKMELI_NOT = "Sozlesme yenileme gorusmesi bekliyor (TEST)";
const GECIKMELI_BAKIYE = GECIKMELI_UCRET * GECIKMELI_AY;

/* İçerik sekmesi BOŞ LİSTEYLE de çizilir, ama boş bir liste "motor çalıştı mı" sorusuna
 * zayıf cevap verir: dört alt sekme başlığı zaten sabit metin. Bu yüzden markanın BİR
 * içerik kaydı var — sekme açıldığında listede bu açıklamanın görünmesi, motorun kendi
 * `clientId` süzgecinden geçip kaydı gerçekten ÇİZDİĞİNİN kanıtı. */
const GECIKMELI_ICERIK = "Deneme icerik kaydi (TEST)";

/* ── İKİNCİ MARKA: ÖDEMESİ TAM — "SAKİN" DALI, TARİHTEN BAĞIMSIZ ─────────────────
 *
 * Tasarımın en ayırt edici iddiası burada sınanıyor: `lib/musteri-karar.js` sağlıklı
 * markada `eylem: null` döndürür, yani panelde BİRİNCİL DÜĞME ÇİZİLMEZ ("yapılacak bir
 * şey yoksa düğme de yok"). Gecikme dalı tarayıcıda çiziliyordu, sakin dal hiç.
 *
 * Yine her şey bugüne GÖRELİ — sabit tarih, testin aylar sonra kimse dokunmadan başka
 * bir dala düşmesi demek olurdu:
 *   · `odemeGunu: 1` + `odemeSekli: "pesin"` → değerlendirilen ay HER ZAMAN bu ay.
 *   · Bu ay TAM ödenmiş → `clientPaymentStatus` "odendi" ("Bu ay ödendi"),
 *     `clientOverdueMonths` daha ilk turda (i=0) ödenmiş ayı bulup durur → 0.
 *     İkisi birlikte `musteriKararSeridi`'ni SAKIN dalına, `eylem`i null'a götürür.
 *   · Başlangıç 2 ay önce ve aradaki her ay ödenmiş → kimlik satırı her koşuda "3. ay".
 *   · Ayın kaçı olduğu hiçbir dalı değiştiremez: `now.getDate() < 1` hiçbir gün doğru
 *     olamaz, zaten ödenmiş ay her koşulda sayımı durduruyor. */
const SAGLIKLI_MARKA = "Odemesi Tam Marka (TEST)";
const SAGLIKLI_KATEGORI = "Kuafor";
const SAGLIKLI_UCRET = 8000;
const SAGLIKLI_CALISMA_AYI = 3;   // kimlik satırındaki "N. ay"
const SAGLIKLI_BASLANGIC = ayGeriye(SAGLIKLI_CALISMA_AYI - 1);
const SAGLIKLI_BASLIK = "Bu ay ödendi";   // SAKIN dalının başlığı (clientPaymentStatus)

/* Üç senaryo da (gecikmeli panel · sağlıklı panel · dar ekran) AYNI belgeden besleniyor:
 * iki marka yan yana durunca "hangi dalın çizildiği" markanın kendi verisinden geliyor,
 * fixture'dan değil. */
const SAHTE_YANIT_PANEL = () => ({
  role: "owner",
  data: {
    ...SAHTE_BELGE,
    clients: [{
      id: "sahte-marka-gecikmeli",
      ad: GECIKMELI_MARKA, name: GECIKMELI_MARKA,
      kategori: GECIKMELI_KATEGORI,
      durum: "aktif",
      aylikUcret: GECIKMELI_UCRET,
      odemeGunu: 1,
      odemeSekli: "pesin",
      baslangic: GECIKMELI_BASLANGIC,
      email: "deneme@ornek-test.local",
      telefon: "900000000000",
      not: GECIKMELI_NOT,
      maliyetler: [], faturalar: [], ucretGecmisi: [],
      // Sayımı durduran TEK kayıt: 6 ay önceki ay tam ödenmiş.
      odemeKayitlari: [{
        id: 1, ay: ayGeriye(GECIKMELI_AY), tutar: GECIKMELI_UCRET,
        tarih: `${ayGeriye(GECIKMELI_AY)}-05`,
      }],
    }, {
      id: "sahte-marka-saglikli",
      ad: SAGLIKLI_MARKA, name: SAGLIKLI_MARKA,
      kategori: SAGLIKLI_KATEGORI,
      durum: "aktif",
      aylikUcret: SAGLIKLI_UCRET,
      odemeGunu: 1,
      odemeSekli: "pesin",
      baslangic: SAGLIKLI_BASLANGIC,
      email: "saglikli@ornek-test.local",
      telefon: "900000000001",
      not: "Odemeler duzenli (TEST)",
      maliyetler: [], faturalar: [], ucretGecmisi: [],
      // Başlangıçtan bugüne HER ay tam ödenmiş — sayım ilk turda durur.
      odemeKayitlari: [0, 1, 2].map((k) => ({
        id: k + 1, ay: ayGeriye(k), tutar: SAGLIKLI_UCRET, tarih: `${ayGeriye(k)}-02`,
      })),
    }],
    musteriIcerikleri: [{
      id: "sahte-icerik-1",
      clientId: "sahte-marka-gecikmeli",
      tur: "gorsel",
      aciklama: GECIKMELI_ICERIK,
      durum: "bekliyor",
      gorselUrl: "", driveLinki: "",
    }],
    cekimIsleri: [],
  },
});

/* ── FİNANS → DOĞRULAMA SEKMESİ İÇİN FİXTURE ────────────────────────────────────
 *
 * Neden ayrı bir belge: doğrulama ekranı belgedeki BÜTÜN para kayıtlarını yeni hesaplama
 * katmanına çevirip bugünkü motorun rakamlarıyla yan yana koyuyor. `SAHTE_BELGE`'nin para
 * listeleri boş olduğu için orada her satır sıfır çıkar — ekran çizilir ama hiçbir şey
 * ölçülmez: yirmi satırın hepsi 0 = 0 olurdu ve tablonun gerçekten DOLU olduğunu kimse
 * göremezdi.
 *
 * TARİHLER BUGÜNE GÖRELİ. Mutabakatın iki satırı (`Freelancer hak edişi (bu ay)`,
 * `Aylık gider`) AY bazlı ve `computeLive` de `new Date()`e bakıyor; sabit tarih yazmak,
 * testin aylar sonra kimse dokunmadan kırmızıya dönmesi demekti.
 *
 * MUTABAKAT BİLEREK TUTUYOR. Kayıtlar, eski motorla yeni katmanın aynı rakamı vermesini
 * sağlayacak şekilde kuruldu (ölçüldü: 20 satır, hepsinin farkı 0). Böylece senaryo hem
 * "sağlıklı dal çizildi" hem de "sağlıklı dalda birincil düğme YOK" iddiasını sınayabiliyor.
 * Tutmayan dal ekranda daha kolay göze çarpar; asıl boş yere geçmeye açık olan SAĞLIKLI
 * dal — bu yüzden aynı senaryoda tablonun dolu olduğu ayrıca aranıyor.
 *
 * Adlar bilerek gerçek dışı; buraya asla üretim verisi kopyalanmaz. */
const DOGRULAMA_TAHSILAT = 17600;      // 12.000 + 5.600 (dönemi çözülen iki tahsilat)
const DOGRULAMA_SATIR = 20;            // mutabakat tablosunun satır sayısı
const DOGRULAMA_TARIHSIZ = 13;         // dönemi olmayan hareket
const DOGRULAMA_KDVSIZ = 17;           // KDV'si kayıtta olmayan hareket
const DOGRULAMA_HESAP = "Ana Hesap (TEST)";

const SAHTE_YANIT_DOGRULAMA = () => ({
  role: "owner",
  data: {
    ...SAHTE_BELGE,
    clients: [
      {
        id: "sahte-marka-para-1", ad: "Denge Kafe (TEST)", name: "Denge Kafe (TEST)",
        durum: "aktif", aylikUcret: 30000, baslangic: ayGeriye(4), odemeGunu: 1,
        odemeler: [], faturaliTutar: 30000, ucretGecmisi: [],
        odemeKayitlari: [
          { id: 1, ay: ayGeriye(2), tarih: `${ayGeriye(2)}-05`, tutar: 12000, hesapId: "ana", not: "Kapanis" },
          /* Ne tarihi ne ayı var: kaybolmamalı, "tarihsiz" sayacına girmeli. */
          { id: 2, tutar: 7100, hesapId: "ana", not: "ayi girilmemis" },
        ],
        faturalar: [{ id: 1, ay: ayGeriye(2), tarih: `${ayGeriye(2)}-06`, no: "A-1", tutar: 9400 }],
        maliyetler: [{ id: 1, kalem: "Videographer Payi", tutar: 3300 }],
      },
      {
        /* Dondurulmuş marka: geçmiş tahsilatı KORUNUR, maliyeti aktif küme dışında kalır. */
        id: "sahte-marka-para-2", ad: "Donuk Marka (TEST)", name: "Donuk Marka (TEST)",
        durum: "donduruldu", aylikUcret: 18000, odemeGunu: 1,
        odemeler: [], faturaliTutar: 0, ucretGecmisi: [], faturalar: [],
        odemeKayitlari: [{ id: 1, ay: ayGeriye(5), tarih: `${ayGeriye(5)}-11`, tutar: 5600, hesapId: "kasa" }],
        maliyetler: [{ id: 1, kalem: "Drone Kiralama", tutar: 2100 }],
      },
    ],
    gelirKalemleri: [{ id: 1, kalem: "Proje Bazli Cekim", tutar: 4500, tekrar: "tek seferlik", faturali: "evet" }],
    giderKalemleri: [{ id: 1, kalem: "Ekipman", tutar: 1700, tekrar: "tek seferlik" }],
    ofisGiderleri: [{ id: 1, kalem: "Kira", tutar: 8900, tekrar: "sabit" }],
    bekleyenTahsilatlar: [{ id: 1, musteri: "Donuk Marka (TEST)", tutar: 2600, vade: "3 gun gecikti" }],
    personelOdemeleri: [{ id: 1, tur: "personel", kisiId: 1, kisiAd: "Ege (TEST)", tutar: 4300, ay: ayGeriye(1), tarih: `${ayGeriye(1)}-09`, hesapId: "ana", not: "" }],
    avanslar: [{ id: 1, tur: "freelancer", kisiId: null, kisiAd: "Selin (TEST)", tutar: 1900, ay: ayGeriye(1), hesapId: "kasa", not: "acil" }],
    hesaplar: [{ id: "ana", ad: DOGRULAMA_HESAP, anaHesap: true }, { id: "kasa", ad: "Nakit Kasa (TEST)" }],
    /* Transferin tarihi EKRAN biçiminde: döneme yazılamaz, kayıt silinmez, uyarı üretir. */
    hesapTransferleri: [{ id: 1, kaynakHesapId: "ana", hedefHesapId: "kasa", tutar: 2500, tarih: "20.09.2026" }],
    hesapDuzeltmeleri: [{ id: 1, hesapId: "kasa", tutar: -450, tarih: `${ayGeriye(1)}-02`, not: "Elle duzeltme" }],
    /* Vergi kaydının tarihi serbest metin, TUTARI HİÇ YOK → "tutarı bilinmiyor". */
    vergiTakvimi: [{ id: 1, kalem: "KDV Beyannamesi", tarih: "26 Agu", durum: "yaklaşıyor" }],
    uyelikler: [
      { id: 1, ad: "Canva Pro", tutar: 600, periyot: "aylik", aktif: true },
      { id: 2, ad: "Adobe CC", tutar: 9600, periyot: "yillik" },   // `aktif` elle girilmemiş
    ],
    personel: [{ id: 1, ad: "Ege (TEST)", pozisyon: "Video Editoru", maas: 32000, sigorta: 9500, yemek: 3500, tazminatBirikimi: 1500 }],
    cekimIsleri: [
      { id: 101, marka: "Denge Kafe (TEST)", kameraman: "Selin (TEST)", editor: "Ege (TEST)", teslimEdilmeTarihi: `${ayGeriye(0)}-12`, medya: [], gecmis: [] },
      { id: 102, marka: "Donuk Marka (TEST)", editor: "Selin (TEST)", teslimEdilmeTarihi: `${ayGeriye(3)}-20`, medya: [], gecmis: [] },
      { id: 103, marka: "Denge Kafe (TEST)", editor: "Kerem (TEST)", medya: [], gecmis: [] },  // teslim edilmemiş
    ],
    isUcretleri: { "Selin (TEST)": 2200, "Ege (TEST)": 1400 },
    isUcretDetaylari: {},
    monthly: [],
  },
});

/* ── PERSONEL KABUĞU: FİNANS MENÜSÜ VE SEKMELERİ ────────────────────────────────
 *
 * Neden var: para ekranları menüde İKİ maddeydi ("Finans" · "Ödeme Takvimi") ve tek
 * maddeye indirildi; içindeki sekmeler artık kişinin iznine göre çiziliyor
 * (`lib/finans-sekmeleri.js`). Kuralın SAF tarafını t115 ölçüyor — ama "menü maddesi
 * gerçekten çizildi mi", "sekme çubuğu dar ekranda sayfayı kaydırıyor mu", "tıklayınca
 * içerik değişiyor mu" sorularını hiçbir Node testi göremez. Çizilmeyen ekran yok sayılır.
 *
 * UYDURMA BELGE SUNUCUNUN GÖNDERECEĞİ KADARINI TAŞIYOR. Personel yanıtı izne göre
 * SÜZÜLÜYOR (`api/data.js` → `PERMISSION_DATA_FIELDS`); fixture'a belgenin tamamını
 * koymak, gerçekte hiç oluşmayan bir hâli sınamak olurdu. Asıl risk de tam burada:
 * yalnızca `odemeTakvimi` izni olan kişiye `monthly` / `gelirKalemleri` / `vergiTakvimi`
 * HİÇ gitmiyor ve Finans bileşeninin gövdesi o alanlara dokunuyor — sekme çizilmese bile
 * gövdedeki her satır çalışır (`CLAUDE.md` §3).
 *
 * Adlar bilerek gerçek dışı; buraya asla üretim verisi kopyalanmaz. */
const PERSONEL_MARKA = "Personel Test Marka (TEST)";
const PERSONEL_UCRET = 24000;

/* Bütün izinler kapalı bir taban: fixture yalnızca AÇTIĞI izni yazsın, gerisi sessizce
 * varsayılana düşmesin. (App.jsx'te `reklamlar`/`paylasimlar`/`cekimEdit` varsayılan
 * AÇIK — yazılmazlarsa menüye fazladan madde girer ve senaryo ölçtüğü şeyi kaybeder.) */
const IZIN_KAPALI = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: false, paylasimlar: false, cekimListesi: false, cekimEdit: false,
  markaYoneticisi: false, personel: false, birikim: false, uyelikler: false,
  sifreKasasi: false, musteriAkisi: false,
};

const PERSONEL_MUSTERI = {
  id: "sahte-marka-personel", ad: PERSONEL_MARKA, name: PERSONEL_MARKA,
  kategori: "Kafe", durum: "aktif", aylikUcret: PERSONEL_UCRET,
  odemeGunu: 1, odemeSekli: "pesin", baslangic: ayGeriye(2),
  maliyetler: [], faturalar: [], ucretGecmisi: [],
  odemeKayitlari: [{ id: 1, ay: ayGeriye(1), tutar: PERSONEL_UCRET, tarih: `${ayGeriye(1)}-03`, hesapId: "ana" }],
};
const PERSONEL_HESAPLAR = [{ id: "ana", ad: "Ana Hesap (TEST)", anaHesap: true }];

/* İKİ İZİN BİRDEN — personel hem Finans sekmelerini hem Ödemeler sekmesini görür,
 * Doğrulama'yı GÖRMEZ (o yalnızca yönetici kabuğunda). `dashboard` da açık: personel
 * menü çubuğu ancak İKİ maddeden itibaren çiziliyor, yani "Finans menüde bir madde"
 * iddiası ancak böyle ölçülebiliyor. */
const SAHTE_YANIT_PERSONEL_FINANS = () => ({
  role: "staff",
  staffName: "Deneme Personel (TEST)",
  data: {
    staffPermissions: { ...IZIN_KAPALI, dashboard: true, finans: true, odemeTakvimi: true },
    firmaAdi: "Deneme Ajans (TEST)", _v: 0, _alanSurumleri: {},
    // PERMISSION_DATA_FIELDS.finans ∪ .odemeTakvimi — fazlası YOK.
    clients: [PERSONEL_MUSTERI],
    monthly: [], gelirKalemleri: [{ id: 1, kalem: "Proje Bazli Cekim (TEST)", tutar: 4500, tekrar: "tek seferlik", faturali: "evet" }],
    giderKalemleri: [{ id: 1, kalem: "Ekipman (TEST)", tutar: 1700, tekrar: "tek seferlik" }],
    ofisGiderleri: [], bekleyenTahsilatlar: [], vergiTakvimi: [], personel: [],
    hesaplar: PERSONEL_HESAPLAR, hesapTransferleri: [], hesapDuzeltmeleri: [],
  },
});

/* YALNIZCA ÖDEME TAKVİMİ İZNİ — bu işin ASIL RİSKİ.
 *
 * Eski menüdeki ayrı "Ödeme Takvimi" maddesi tam olarak bu kişi için duruyordu. Finans
 * maddesi ona da çizilmezse ekrana HİÇ ULAŞAMAZ ve personel kabuğu "Henüz erişimin olan
 * bir bölüm yok" yazar — bu senaryonun ölçtüğü şey tam olarak o cümlenin ÇIKMAMASI.
 *
 * Belge bilerek EKSİK: sunucu bu kişiye yalnızca `clients` · `hesaplar` ·
 * `hesapTransferleri` · `hesapDuzeltmeleri` gönderiyor. `monthly` ve arkadaşları
 * undefined geliyor; Finans gövdesi onlara korumasız dokunsaydı ekran patlardı. */
const SAHTE_YANIT_ODEME_IZNI = () => ({
  role: "staff",
  staffName: "Odeme Personeli (TEST)",
  data: {
    staffPermissions: { ...IZIN_KAPALI, odemeTakvimi: true },
    firmaAdi: "Deneme Ajans (TEST)", _v: 0, _alanSurumleri: {},
    clients: [PERSONEL_MUSTERI],
    hesaplar: PERSONEL_HESAPLAR, hesapTransferleri: [], hesapDuzeltmeleri: [],
  },
});

/* Finans sekmelerinin ADLARI tek yerde: üç senaryo da aynı listeyi kullanıyor ve sekme
 * eklenince tek satır değişir. "Doğrulama" bilerek YOK — personel onu görmemeli. */
const PERSONEL_SEKMELERI = ["Özet", "Gelir-Gider", "Ay Ay Karşılaştırma", "Ödemeler",
  "Raporlar (PDF)", "Hesaplar", "Vergi & Arşiv"];
const ODEMELER_SEKMESI = "Ödemeler";
/* Ödemeler sekmesinin İÇERİĞİNİN çizildiğinin kanıtı (`OdemeTakvimi`): iki KPI kartı
 * ve bekleyen tahsilat listesi. Sekme başlığı sabit metin, içerik değil. */
const ODEME_ICERIGI = ["TAKİP EDİLEN MÜŞTERİ", "BİRİKMİŞ TOPLAM BORÇ"];
/* Özet sekmesinin imzası — "içerik değişti" iddiasının öteki yarısı. */
const OZET_IMZASI = "Para Nereye Gidiyor?";

/* ── SUNUCU ──────────────────────────────────────────────────────────────────── */
const TIP = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
};

function sunucuKur(apiYaniti) {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(apiYaniti));
    }
    let p = path.join(DIST, u.pathname === "/" ? "index.html" : u.pathname);
    // Dizin dışına çıkma denemesi: her zaman DIST içinde kal.
    if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      p = path.join(DIST, "index.html");
    }
    res.writeHead(200, { "Content-Type": TIP[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return s;
}

/* ── TEK SENARYO ───────────────────────────────────────────────────────────────
 * `secenekler.yerelDepo`  : sayfa açılmadan ÖNCE yazılacak localStorage anahtarları.
 * `secenekler.etkilesim`  : açılış kontrolleri bittikten sonra çalışan, kendi
 *                           `kontrol()` çağrılarını yapan işlev (ör. bir panel açmak).
 *                           Verildiğinde sonda etkileşim SONRASI hata kontrolleri de
 *                           çalışır — açılışta temiz olup tıklayınca patlayan ekran,
 *                           bu testin kapatmaya çalıştığı boşluğun tam ortasında.
 * `secenekler.pencere`    : pencere ölçüsü. Verilmezse 1280×900. Dar ekran dalını
 *                           çizmek için verilir. */
async function senaryo(tarayici, ad, apiYaniti, enAzMetin, beklenenMetin, secenekler = {}) {
  console.log(`\n── ${ad} ──`);

  /* EŞİK POZİTİF OLMAK ZORUNDA — sessizce anlamsızlaşmasın.
   *
   * Aşağıdaki kontrol `(metinUzunlugu || 0) >= enAzMetin` diye ölçüyor. Eşik 0 (ya da eksi)
   * olursa bu ifade HER GİRDİDE doğru olur: ekran bomboşken bile ✓ basar. Yani tek karakterlik
   * bir düzenleme, siyah ekran korumasını kaldırır ve doğrulama zincirinin BEŞ adımı da yeşil
   * kalır — ölçüldü: eşik 50 iken bozuk uygulamada 12 kontrol düşüyor, eşik 0 iken 10.
   * İki kontrol sessizce kayboluyor ve üstelik "okunur içerik var" diye YANLIŞ ✓ yazıyorlar.
   *
   * Bu yüzden eşik burada doğrulanıyor: geçersizse test GÜRÜLTÜLÜ düşer. Korumayı kaldırmak
   * serbest olabilir ama SESSİZCE olmamalı. */
  if (!Number.isFinite(enAzMetin) || enAzMetin < 1) {
    kontrol(`${ad}: metin eşiği geçerli (≥1)`, false,
      `eşik "${enAzMetin}" — 0 ya da eksi eşikte "okunur içerik var" kontrolü ` +
      "her zaman geçer, yani koruma yoktur");
    return;
  }
  /* BEKLENEN METİN LİSTESİ DE BOŞ OLAMAZ — aynı boşluk, daha sinsi hâli.
   *
   * Aşağıdaki kontrol `beklenenMetin.every(...)` diye ölçüyor ve `[].every(...)` HER ZAMAN
   * doğrudur. Liste boşaltılırsa test 14/14 geçer, çıkış 0 verir ve ekrana
   * `✓ beklenen ekran çizildi ()` diye YANLIŞ bir onay basar — ölçüldü. Üstelik kaybedilen,
   * ikisinden GÜÇLÜ olan kontroldür: eşik "bir şey çizildi" der, bu liste "DOĞRU dal
   * çizildi" der; hata ekranı da metin üretir. Boş dize de sayılmaz, `"".includes` hep doğru. */
  if (!Array.isArray(beklenenMetin) || beklenenMetin.length === 0
      || beklenenMetin.some((m) => typeof m !== "string" || m.length === 0)) {
    kontrol(`${ad}: beklenen metin listesi geçerli (boş değil)`, false,
      `liste ${JSON.stringify(beklenenMetin)} — boş liste ya da boş dize ile ` +
      '"beklenen ekran çizildi" kontrolü her zaman geçer, yani koruma yoktur');
    return;
  }
  const sunucu = sunucuKur(apiYaniti);
  await new Promise((r) => sunucu.listen(0, "127.0.0.1", r));
  const port = sunucu.address().port;

  /* Pencere ölçüsü SABİT: uygulama 900/860/640 kırılmalarında farklı çiziyor (yan menü
   * gizleniyor, tablo sarmalanıyor). Varsayılana bırakmak testi makineye bağlar.
   * `secenekler.pencere` ile başka bir ölçü İSTENEREK verilebilir — dar ekran dalı
   * (`useIsMobile(640)`) ancak böyle çiziliyor; varsayılan yine sabit. */
  const baglam = await tarayici.newContext({
    viewport: secenekler.pencere || { width: 1280, height: 900 },
  });
  if (secenekler.yerelDepo) {
    await baglam.addInitScript((kayitlar) => {
      try {
        Object.keys(kayitlar).forEach((k) => localStorage.setItem(k, kayitlar[k]));
      } catch (e) { /* localStorage kapalıysa sessizce geç */ }
    }, secenekler.yerelDepo);
  }
  const sayfa = await baglam.newPage();

  const jsHatalari = [];   // yakalanmamış istisnalar — siyah ekranın sebebi
  const konsolHatalari = [];
  const disIstekler = [];

  sayfa.on("pageerror", (e) => jsHatalari.push(e.message));
  sayfa.on("console", (m) => { if (m.type() === "error") konsolHatalari.push(m.text()); });

  // 127.0.0.1 dışına giden her istek BOŞ yanıtla karşılanır: test ağa bağımlı olmasın
  // ve dış dünyaya tek istek bile gitmesin.
  await sayfa.route("**/*", (yol) => {
    const adres = yol.request().url();
    if (adres.startsWith(`http://127.0.0.1:${port}`)) return yol.continue();
    disIstekler.push(adres);
    return yol.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });

  // ZAMAN AŞIMLARI BİLEREK CÖMERT. Bu test doğrulama zincirinin sonunda, bütün kontrollerin
  // ve bir derlemenin hemen ardından çalışıyor; makine yüklüyken dar bir sınır sonucu
  // ÇEVİREBİLİR. Bir kez gözlendi: aynı kod tek başına geçti, zincirin içinde düştü.
  // Sınırlar yalnızca gerçekten bir şey bozulduğunda devreye girer, o yüzden geniş
  // tutmanın maliyeti yok — kararsız bir test ise olmayan testten kötüdür.
  let acilisHatasi = null;
  let zamanAsimi = false;
  try {
    await sayfa.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 60000 });
    /* React'in çizmesi ve İLK VERİ TURUNUN BİTMESİ için bekle.
     *
     * Eskiden yalnızca "`#root`un çocuğu var mı" diye bakılıyordu. Ama `data` gelene kadar
     * çizilen "Marcus Medya App yükleniyor…" ara ekranı DA `#root`un içinde bir çocuk
     * düğüm — yani koşul, uygulama daha hiçbir şey çizmeden sağlanıyordu. Yüklü makinede
     * ölçüldü: senaryo 2'de iki kontrol ("okunur içerik", "beklenen ekran çizildi") ara
     * ekranı görüp düştü, oysa uygulamada hiçbir sorun yoktu. Kararsız bir test, olmayan
     * testten kötüdür — ara ekran gidene kadar beklenir.
     *
     * Bu bir BEKLEME, bir iddia değil: ara ekran hiç gitmezse zaman aşımına düşer ve
     * "sayfa açıldı" kontrolü gürültülü biçimde kırılır. */
    await sayfa.waitForFunction(
      () => {
        const r = document.getElementById("root");
        if (!r || r.children.length === 0) return false;
        return !(r.innerText || "").includes("yükleniyor");
      },
      { timeout: 30000 },
    );
  } catch (e) {
    acilisHatasi = e.message.split("\n")[0];
    zamanAsimi = /Timeout|timeout/.test(acilisHatasi);
  }

  const durum = await sayfa.evaluate(() => {
    const r = document.getElementById("root");
    if (!r) return { kokVar: false };
    const metin = (r.innerText || "").trim();
    return {
      kokVar: true,
      cocukSayisi: r.children.length,
      metinUzunlugu: metin.length,
      ornek: metin.slice(0, 120).replace(/\s+/g, " "),
      ornekTam: metin,
      govdeRengi: getComputedStyle(document.body).backgroundColor,
    };
  });

  kontrol(`${ad}: sayfa açıldı`, acilisHatasi === null, acilisHatasi || "");
  kontrol(`${ad}: #root elemanı var`, durum.kokVar === true);
  kontrol(`${ad}: React arayüzü çizildi (çocuk düğüm)`, (durum.cocukSayisi || 0) > 0,
    `çocuk sayısı: ${durum.cocukSayisi}`);
  kontrol(`${ad}: ekranda okunur içerik var (≥${enAzMetin} karakter)`,
    (durum.metinUzunlugu || 0) >= enAzMetin, `metin uzunluğu: ${durum.metinUzunlugu}`);
  kontrol(`${ad}: açılışta yakalanmamış JS hatası yok`, jsHatalari.length === 0,
    jsHatalari.slice(0, 3).join(" | "));
  kontrol(`${ad}: açılışta konsol hatası yok`, konsolHatalari.length === 0,
    konsolHatalari.slice(0, 3).join(" | "));
  // Yalnızca "bir şey çizildi" demek yetmez: hata ekranı da bir şey çizer. Bu yüzden o
  // senaryoda görünmesi GEREKEN metin aranıyor — böylece doğru dalın çizildiği belli olur.
  const metinVar = beklenenMetin.every((m) => (durum.ornekTam || "").includes(m));
  kontrol(`${ad}: beklenen ekran çizildi (${beklenenMetin.join(", ")})`, metinVar,
    `ekranda: "${durum.ornek}…"`);

  // Bilgi amaçlı: dış adresler taklit edildi, ağa çıkmadı. Uygulama index.html'de
  // Google Fonts'a başvuruyor; bu bir kusur değil, testin ağdan yalıtılmış olması gerek.
  if (disIstekler.length) {
    console.log(`     · ${disIstekler.length} dış istek taklit edildi (ağa çıkmadı)`);
  }

  if (durum.metinUzunlugu > 0) {
    console.log(`     ekrandan: "${durum.ornek}…"`);
  }
  // Zaman aşımı ile GERÇEK çizim hatası aynı ✗ satırlarını üretir. JS hatası hiç
  // yakalanmadıysa ayrım yapılamaz; bunu söylemek, sessizce "uygulama bozuk" demekten
  // dürüsttür — okuyan kişi yanlış yeri kazmasın.
  if (zamanAsimi && jsHatalari.length === 0) {
    console.log("     ! zaman aşımı, JS hatası YAKALANMADI — bu bir çizim hatası olabilir");
    console.log("       ama yüklü makinede yavaşlık da olabilir. Testi tek başına tekrar çalıştır.");
  }

  if (secenekler.etkilesim) {
    await secenekler.etkilesim({ sayfa, ad });
    // Açılışta temiz olan ekran, bir panel açılınca patlayabilir: o yüzden hata
    // listeleri etkileşimden SONRA bir kez daha okunuyor (liste birikimli).
    kontrol(`${ad}: etkileşimden sonra yakalanmamış JS hatası yok`, jsHatalari.length === 0,
      jsHatalari.slice(0, 3).join(" | "));
    kontrol(`${ad}: etkileşimden sonra konsol hatası yok`, konsolHatalari.length === 0,
      konsolHatalari.slice(0, 3).join(" | "));
  }

  await baglam.close();
  await new Promise((r) => sunucu.close(r));
}

/* ── MÜŞTERİ DETAY PANELİ ETKİLEŞİMİ ─────────────────────────────────────────────
 *
 * Neden var: bu testin iki senaryosu da Dashboard'da duruyordu. `ClientDetail` hiç MOUNT
 * EDİLMİYORDU, yani panelin 441 satırlık çizimi hiçbir katman tarafından ölçülmüyordu.
 * Ölçüldü: panele garanti çöken bir satır konulduğunda doğrulama zincirinin BEŞ ADIMI da
 * yeşil kalıyordu (27 denetim ✓, derleme 0, 2570 kontrol ✓, tarayıcı 14/14).
 *
 * "Panel açıldı" demek yetmez — hata ekranı da bir şey çizer. Bu yüzden panelin İÇİNDEN
 * okunuyor: marka kimliği, hangi karar dalının çizildiği, bakiye, birincil düğme, üç
 * sekme ve SEKME GEÇİŞİNİN gerçekten içeriği değiştirmesi.
 *
 * Bütün metin, panelin kendi DOM alt ağacından alınıyor — sayfanın tamamından DEĞİL.
 * ÖLÇÜLDÜ: çıpa `document.body`'ye gevşetilip panel bozulduğunda düşen kontrol sayısı
 * 14'ten 12'ye iniyor — "durum rozeti" ve "Para içeriği gitti" kontrolleri arkadaki
 * Müşteriler ekranından boş yere geçiyor. Yani çıpa iki kontrolü taşıyor.
 *
 * (Bir süre burada "Ödenmeyen Ödemeler kartı da aynı cümleyi yazıyor" gerekçesi yazılıydı;
 *  YANLIŞTI — o kart `odemeAcik` ile koşullu ve varsayılan KAPALI, metni DOM'a hiç girmiyor.
 *  Karar doğruydu, sebebi değil. Yanlış gerekçe çıpayı ileride "gereksiz" diye
 *  sadeleştirmeye davet eder.) */
/* Paneli DOM'da bulmanın çıpası: marka adını TAM olarak taşıyan <h2>. Oradan yukarı
 * çıkıp `position: fixed` olan örtüye varılıyor (panelin dış kabı). Satır içi stil
 * METNİNE bakılmıyor — stil düzenlenince sessizce kopan bir çıpa olmasın.
 *
 * Okunan her şey PANELİN KENDİ ALT AĞACINDAN geliyor, sayfanın tamamından değil; üç
 * etkileşim de aynı çıpayı kullanıyor. */
const panelOkuyucu = (sayfa, marka) => () => sayfa.evaluate((m) => {
  let el = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").trim() === m) || null;
  if (!el) return null;
  while (el && getComputedStyle(el).position !== "fixed") el = el.parentElement;
  if (!el) return null;
  /* BİRİNCİL DÜĞMENİN İMZASI: opak zemin + beyaz yazı (`saveBtnStyle`). Vurgu rengi
   * SABİT YAZILMIYOR — tema değişince sessizce kopmasın.
   *
   * İMZAYI ASIL TUTAN ŞART YAZI RENGİ, zemin değil. `addBtnStyle` koyu temada yarı
   * saydam (`rgba(91,110,245,0.14)`) ama AÇIK temada opak (`#EAECFD`, src/tema.jsx) —
   * yani zemin şartını GEÇER ve onu eleyen tek şey `accentText` yazı rengi. Zemin şartı
   * yine de duruyor çünkü saydam zeminli düğmeleri (cancel/ikon/sekme) ucuza eliyor;
   * ama taşıyıcı olan o değil. (Bir süre burada "addBtnStyle yarı saydam" yazıyordu —
   * yalnızca koyu temada doğru; yanlış gerekçe, şartı ileride gereksiz sanıp silmeye
   * davet ederdi.)
   *
   * KÖR NOKTA — bilinerek bırakıldı: imza yalnızca `saveBtnStyle`i görür. `karar.eylem`in
   * `ODEME_GUNU_EKLE` dalı SESSİZ düğmeye (`cancelBtnStyle`) iniyor ve bu imzayı
   * taşımıyor; ölçüldü — sakin markaya o düğme sızarsa bu kontrol 0 düşürür. Kontrolün
   * ADI bu yüzden dar: "birincil (saveBtnStyle) düğme YOK". O dalı tutan şey, aynı
   * senaryodaki "SAKİN dalını çizdi" başlık kontrolü.
   *
   * Ölçüldü (Eylül 2026): gecikme panelinde imzayı TEK düğme taşıyor ("Tebliğ oluştur");
   * sakin panelde 7 düğmenin hiçbiri taşımıyor. */
  const birincilDugmeler = [...el.querySelectorAll("button")].filter((b) => {
    const s = getComputedStyle(b);
    return /^rgb\(/.test(s.backgroundColor) && s.color === "rgb(255, 255, 255)";
  }).map((b) => (b.textContent || "").trim());
  /* PARA SATIRI: panel içindeki, hem "AYLIK ÜCRET" hem "KÂR MARJI" taşıyan grid.
   * Sütun sayısı `gridTemplateColumns`ten okunuyor — dar ekranda 1, geniş ekranda 3. */
  const gridler = [...el.querySelectorAll("div")].filter(
    (d) => getComputedStyle(d).display === "grid"
      && (d.innerText || "").includes("AYLIK ÜCRET") && (d.innerText || "").includes("KÂR MARJI"),
  );
  const paraGrid = gridler[gridler.length - 1] || null;
  /* PANELİN KENDİ YATAY TAŞMASI. Sayfanın `scrollWidth`i YETMİYOR: panel `position:
   * fixed` bir örtünün içinde ve tarayıcı, fixed bir kutudan taşan içeriği belgenin
   * kaydırma alanına EKLEMİYOR — ölçüldü (Eylül 2026): para satırına `minWidth: 900`
   * konulduğunda 390px pencerede belge taşması 0 kalıyor, yani yalnızca belgeye bakan
   * bir kontrol bu bozulmayı GÖRMÜYOR (0 kontrol düştü). Panelin kendi kaydırma
   * bölgesi (`overflowY: auto`) ölçülünce görülüyor: içerik kutudan genişse dar ekranda
   * ya kırpılır ya yatay kaydırma ister; ikisi de kusur.
   * Bölge bulunamazsa `null` döner ve kontrol DÜŞER — sessizce geçmesindense gürültülü
   * kırılsın (panelin yapısı değiştiyse çıpa yeniden kurulmalı). */
  const kaydirmaAlani = [...el.querySelectorAll("div")]
    .find((d) => getComputedStyle(d).overflowY === "auto") || null;
  return {
    metin: el.innerText || "",
    yatayTasma: kaydirmaAlani ? kaydirmaAlani.scrollWidth - kaydirmaAlani.clientWidth : null,
    sekmeler: [...el.querySelectorAll('[role="tab"]')].map((b) => ({
      ad: (b.textContent || "").trim(),
      secili: b.getAttribute("aria-selected") === "true",
    })),
    birincilDugmeler,
    paraSutunlari: paraGrid
      ? getComputedStyle(paraGrid).gridTemplateColumns.trim().split(/\s+/).length : 0,
  };
}, marka);

/** Tutar karşılaştırması TARAYICININ kendi tr-TR biçimlendirmesiyle yapılıyor: `fmt` de
 * `toLocaleString("tr-TR")` çağırıyor, yani beklenen ile gerçek aynı yerden geliyor.
 * Sınanan şey ayıraç biçimi değil, TUTARIN KENDİSİ — Node ile Chromium'un ICU'su
 * ayrışırsa test yanlış alarm vermesin. */
const paraOkuyucu = (sayfa) => (n) => sayfa.evaluate((x) => "₺" + Number(x).toLocaleString("tr-TR"), n);

/** Marka satırına tıklayıp panelin açılmasını bekler; hata metnini döndürür (yoksa null).
 * Marka adı bir <button> DEĞİL, `onClick` taşıyan bir <div>. Olduğu gibi tıklanıyor —
 * uygulamayı teste uydurmak yasak, test uygulamaya uyar. */
async function markayiAc(sayfa, marka) {
  try {
    await sayfa.locator("tbody td div").filter({ hasText: marka }).first()
      .click({ timeout: 20000 });
    await sayfa.waitForFunction(
      (m) => [...document.querySelectorAll("h2")].some((h) => (h.textContent || "").trim() === m),
      marka,
      { timeout: 20000 },
    );
    return null;
  } catch (e) {
    return e.message.split("\n")[0];
  }
}

async function musteriDetayiEtkilesimi({ sayfa, ad }) {
  const panelOku = panelOkuyucu(sayfa, GECIKMELI_MARKA);
  const para = paraOkuyucu(sayfa);

  const acmaHatasi = await markayiAc(sayfa, GECIKMELI_MARKA);

  const panel = await panelOku();
  // Panel açılmasa bile AŞAĞIDAKİ KONTROLLERİN HEPSİ ÇALIŞIR ve tek tek düşer: erken
  // dönseydi "kaç kontrol düştü" ölçümü sessizce küçülürdü.
  const metin = panel ? panel.metin : "";
  const sekmeler = panel ? panel.sekmeler : [];
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");
  const seciliSekme = (liste) => (liste.find((s) => s.secili) || {}).ad || "(yok)";

  kontrol(`${ad}: marka satırına tıklayınca detay paneli açıldı`,
    acmaHatasi === null && panel !== null, acmaHatasi || "panel DOM'da bulunamadı");

  /* 1 · MARKA KİMLİĞİ — "kategori · başlangıç · N. ay". */
  kontrol(`${ad}: kimlik satırı çizildi (${GECIKMELI_KATEGORI} · ${GECIKMELI_BASLANGIC} · ${GECIKMELI_CALISMA_AYI}. ay)`,
    metin.includes(GECIKMELI_KATEGORI) && metin.includes(GECIKMELI_BASLANGIC)
      && metin.includes(`${GECIKMELI_CALISMA_AYI}. ay`),
    `panelde: "${ornek}…"`);
  kontrol(`${ad}: durum rozeti çizildi (Aktif)`, metin.includes("Aktif"), `panelde: "${ornek}…"`);

  /* 2 · KARAR ŞERİDİ — gecikme dalı. Fixture bugüne göreli kurulduğu için bu dal
   * hangi gün koşulursa koşulsun aynı. */
  kontrol(`${ad}: karar şeridi GECİKME dalını çizdi (${GECIKMELI_AY} aydır ödenmedi)`,
    metin.includes(`${GECIKMELI_AY} aydır ödenmedi`), `panelde: "${ornek}…"`);
  const bakiyeMetni = await para(GECIKMELI_BAKIYE);
  kontrol(`${ad}: gecikme bakiyesi doğru (Kalan bakiye ${bakiyeMetni})`,
    metin.includes("Kalan bakiye") && metin.includes(bakiyeMetni),
    `panelde: "${ornek}…"`);
  const ucretMetni = await para(GECIKMELI_UCRET);
  kontrol(`${ad}: yeni ay ücreti yazıldı (${ucretMetni})`,
    metin.includes("Yeni ay ücreti") && metin.includes(ucretMetni), `panelde: "${ornek}…"`);
  kontrol(`${ad}: birincil düğme "Tebliğ oluştur"`, metin.includes("Tebliğ oluştur"),
    `panelde: "${ornek}…"`);

  /* 3 · ÜÇ SEKME ve varsayılan. */
  kontrol(`${ad}: üç sekme çizildi (Para · İlişki · İçerik)`,
    sekmeler.map((s) => s.ad).join("|") === "Para|İlişki|İçerik",
    `bulunan: ${JSON.stringify(sekmeler.map((s) => s.ad))}`);
  kontrol(`${ad}: varsayılan sekme Para`, seciliSekme(sekmeler) === "Para",
    `seçili: ${seciliSekme(sekmeler)}`);
  kontrol(`${ad}: Para sekmesinin içeriği çizili (FATURALAMA · MALİYETLER · Hesap özeti)`,
    metin.includes("FATURALAMA") && metin.includes("MALİYETLER") && metin.includes("Hesap özeti")
      && !metin.includes("İLETİŞİM VE ÇALIŞMA KOŞULLARI"),
    `panelde: "${ornek}…"`);

  /* 4 · SEKME GEÇİŞİ GERÇEKTEN ÖLÇÜLÜYOR: yalnızca "İlişki geldi" değil, "Para GİTTİ" de
   * aranıyor. İki sekmenin içeriği aynı anda duruyorsa geçiş çalışmıyor demektir. */
  let gecisHatasi = null;
  try {
    await sayfa.locator('[role="tab"]').filter({ hasText: "İlişki" }).first().click({ timeout: 20000 });
    await sayfa.waitForFunction(
      () => document.body.innerText.includes("İLETİŞİM VE ÇALIŞMA KOŞULLARI"),
      null, { timeout: 20000 },
    );
  } catch (e) {
    gecisHatasi = e.message.split("\n")[0];
  }

  const panel2 = await panelOku();
  const metin2 = panel2 ? panel2.metin : "";
  const sekmeler2 = panel2 ? panel2.sekmeler : [];
  const ornek2 = metin2.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: İlişki sekmesine tıklanınca seçili sekme değişti`,
    gecisHatasi === null && seciliSekme(sekmeler2) === "İlişki",
    gecisHatasi || `seçili: ${seciliSekme(sekmeler2)}`);
  kontrol(`${ad}: İlişki sekmesinin içeriği geldi (iletişim alanları + not)`,
    metin2.includes("İLETİŞİM VE ÇALIŞMA KOŞULLARI") && metin2.includes(GECIKMELI_NOT)
      && metin2.includes("Ayın 1'i"),
    `panelde: "${ornek2}…"`);
  kontrol(`${ad}: Para sekmesinin içeriği gitti (MALİYETLER · FATURALAMA yok)`,
    metin2 !== "" && !metin2.includes("MALİYETLER") && !metin2.includes("FATURALAMA"),
    `panelde: "${ornek2}…"`);

  // Karar şeridi sekmelerin DIŞINDA — sekme değişse de yerinde kalmalı.
  kontrol(`${ad}: karar şeridi sekme değişince yerinde kaldı`,
    metin2.includes(`${GECIKMELI_AY} aydır ödenmedi`) && metin2.includes("Tebliğ oluştur"),
    `panelde: "${ornek2}…"`);

  /* 5 · ÜÇÜNCÜ SEKME — İÇERİK. Sekme geçişi bir süre yalnızca Para → İlişki yönünde
   * ölçülüyordu; üçüncü sekme hiç AÇILMIYORDU, yani `IcerikYonetimMotoru`'nun bu panel
   * içinden çizilip çizilmediğini hiçbir katman görmüyordu. İki yön birden aranıyor:
   * İçerik GELDİ mi (motorun kendi alt sekmeleri + markanın içerik kaydı) ve İlişki
   * GİTTİ mi — ikisi aynı anda duruyorsa geçiş çalışmıyor demektir. */
  let icerikHatasi = null;
  try {
    await sayfa.locator('[role="tab"]').filter({ hasText: "İçerik" }).first().click({ timeout: 20000 });
    await sayfa.waitForFunction(
      () => document.body.innerText.includes("Onay Bekleyenler"),
      null, { timeout: 20000 },
    );
  } catch (e) {
    icerikHatasi = e.message.split("\n")[0];
  }

  const panel3 = await panelOku();
  const metin3 = panel3 ? panel3.metin : "";
  const sekmeler3 = panel3 ? panel3.sekmeler : [];
  const ornek3 = metin3.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: İçerik sekmesine tıklanınca seçili sekme değişti`,
    icerikHatasi === null && seciliSekme(sekmeler3) === "İçerik",
    icerikHatasi || `seçili: ${seciliSekme(sekmeler3)}`);
  /* "Dört alt sekme başlığı" tek başına sabit metin; asıl kanıt markanın İÇERİK KAYDININ
   * listede çizilmesi — motor `clientId` süzgecinden geçip gerçekten liste üretmiş. */
  kontrol(`${ad}: İçerik sekmesinin içeriği geldi (IcerikYonetimMotoru: alt sekmeler + kayıt)`,
    metin3.includes("Onay Bekleyenler") && metin3.includes("İçerik Fikirleri")
      && metin3.includes(GECIKMELI_ICERIK),
    `panelde: "${ornek3}…"`);
  kontrol(`${ad}: İlişki sekmesinin içeriği gitti (İLETİŞİM… · not yok)`,
    metin3 !== "" && !metin3.includes("İLETİŞİM VE ÇALIŞMA KOŞULLARI")
      && !metin3.includes(GECIKMELI_NOT),
    `panelde: "${ornek3}…"`);

  if (metin3) console.log(`     panelden: "${ornek3}…"`);
}

/* ── SAĞLIKLI MARKA: "SAKİN" DALI VE OLMAYAN BİRİNCİL DÜĞME ──────────────────────
 *
 * `lib/musteri-karar.js`'in en ayırt edici kuralı: yapılacak bir şey yoksa BİRİNCİL
 * DÜĞME ÇİZİLMEZ (`eylem: null`). Bu dal tarayıcıda hiç çizilmiyordu — yalnızca gecikme
 * dalı sınanıyordu, yani "düğme gerektiğinde var" ölçülüyor, "gerekmediğinde yok"
 * ölçülmüyordu.
 *
 * "Düğme yok" kontrolü BOŞ YERE GEÇEBİLİR: panel hiç açılmazsa da düğme yoktur. Bu
 * yüzden aynı senaryoda panelin GERÇEKTEN açıldığını kanıtlayan kontroller var (kimlik
 * satırı ve para satırı), ve düğme sayımı panelin KENDİ DOM alt ağacında yapılıyor. */
async function saglikliMarkaEtkilesimi({ sayfa, ad }) {
  const panelOku = panelOkuyucu(sayfa, SAGLIKLI_MARKA);
  const para = paraOkuyucu(sayfa);

  const acmaHatasi = await markayiAc(sayfa, SAGLIKLI_MARKA);

  const panel = await panelOku();
  // Panel açılmasa bile aşağıdaki kontroller çalışır ve tek tek düşer.
  const metin = panel ? panel.metin : "";
  const dugmeler = panel ? panel.birincilDugmeler : [];
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: marka satırına tıklayınca detay paneli açıldı`,
    acmaHatasi === null && panel !== null, acmaHatasi || "panel DOM'da bulunamadı");

  /* PANEL GERÇEKTEN AÇILDI MI — "düğme yok" kontrolünün boş yere geçmemesinin şartı. */
  kontrol(`${ad}: kimlik satırı çizildi (${SAGLIKLI_KATEGORI} · ${SAGLIKLI_BASLANGIC} · ${SAGLIKLI_CALISMA_AYI}. ay)`,
    metin.includes(SAGLIKLI_KATEGORI) && metin.includes(SAGLIKLI_BASLANGIC)
      && metin.includes(`${SAGLIKLI_CALISMA_AYI}. ay`),
    `panelde: "${ornek}…"`);

  /* SAKİN DAL: başlık `clientPaymentStatus`tan geliyor ve gecikme cümlesi HİÇ olmamalı. */
  kontrol(`${ad}: karar şeridi SAKİN dalını çizdi (${SAGLIKLI_BASLIK}, gecikme yok)`,
    metin.includes(SAGLIKLI_BASLIK) && !metin.includes("aydır ödenmedi"),
    `panelde: "${ornek}…"`);

  /* ASIL İDDİA: panelde birincil düğme YOK. */
  kontrol(`${ad}: panelde birincil (saveBtnStyle) düğme YOK`,
    panel !== null && dugmeler.length === 0,
    panel === null ? "panel açılmadı" : `bulunan: ${JSON.stringify(dugmeler)}`);

  const ucretMetni = await para(SAGLIKLI_UCRET);
  kontrol(`${ad}: para satırı yine çizildi (AYLIK ÜCRET ${ucretMetni} · KÂR MARJI)`,
    metin.includes("AYLIK ÜCRET") && metin.includes(ucretMetni) && metin.includes("KÂR MARJI"),
    `panelde: "${ornek}…"`);

  if (metin) console.log(`     panelden: "${ornek}…"`);
}

/* ── DAR EKRAN DALI ──────────────────────────────────────────────────────────────
 *
 * Panel `useIsMobile(640)` ile kendi dar ekran dalını çiziyor: para satırı tek sütuna
 * düşüyor, yatay boşluk 24 → 16'ya iniyor. Test tek pencere ölçüsünde (1280×900)
 * koştuğu için bu dal hiç çizilmiyordu — telefonda açılan panel hiçbir katman
 * tarafından ölçülmemiş oluyordu.
 *
 * Ölçülen üç şey: panel dar ekranda da AÇILIYOR · sayfa gövdesi yatay KAYMIYOR
 * (dar ekranda taşan bir blok, kullanıcıyı sağa sola kaydırmaya zorlar) · para satırı
 * TEK SÜTUN (yani dar ekran dalı gerçekten seçilmiş). */
async function darEkranEtkilesimi({ sayfa, ad }) {
  const panelOku = panelOkuyucu(sayfa, GECIKMELI_MARKA);

  const acmaHatasi = await markayiAc(sayfa, GECIKMELI_MARKA);

  const panel = await panelOku();
  const metin = panel ? panel.metin : "";
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: dar ekranda marka satırına tıklayınca panel açıldı`,
    acmaHatasi === null && panel !== null, acmaHatasi || "panel DOM'da bulunamadı");

  /* Yatay kayma İKİ YERDE birden ölçülüyor — biri tek başına yetmiyor:
   *   · belge/gövde: sayfanın tamamı sağa sola kayıyor mu,
   *   · panelin kendi kaydırma bölgesi: fixed örtünün içindeki taşma belgeye HİÇ
   *     yansımıyor (ölçüldü — `panelOkuyucu` içindeki nota bak). */
  const kayma = await sayfa.evaluate(() => ({
    belge: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    govde: document.body.scrollWidth - document.body.clientWidth,
  }));
  const panelTasmasi = panel ? panel.yatayTasma : null;
  kontrol(`${ad}: panel açıkken yatay KAYMA yok (sayfa gövdesi + panel içeriği)`,
    kayma.belge <= 0 && kayma.govde <= 0 && panelTasmasi !== null && panelTasmasi <= 0,
    `belge: ${kayma.belge}px, gövde: ${kayma.govde}px, panel: ${panelTasmasi === null ? "kaydırma bölgesi bulunamadı" : panelTasmasi + "px"}`);

  kontrol(`${ad}: para satırı tek sütuna düştü (useIsMobile(640) dalı)`,
    panel !== null && panel.paraSutunlari === 1,
    panel === null ? "panel açılmadı" : `sütun sayısı: ${panel.paraSutunlari}`);

  if (metin) console.log(`     panelden: "${ornek}…"`);
}

/* ── FİNANS → DOĞRULAMA SEKMESİ ─────────────────────────────────────────────────
 *
 * Neden var: bu ekran uygulamanın en yeni derin yüzeyi ve hiçbir katman onu ÇİZEREK
 * ölçmüyordu. Bu projenin en pahalı dersi tam burada: "derleme temiz, 2655 kontrol
 * geçiyor" ve uygulama yine de siyah ekranla açılabiliyor. Çizilmeyen ekran yok sayılır.
 *
 * Ölçülen altı şey: sekmeye tıklanınca içerik GELİYOR · karar şeridi hangi dalı çizdi ·
 * mutabakat tablosunun satırları GERÇEKTEN var ve dolu · eksik bilgi özeti sayıyı
 * YORUMLUYOR · sağlıklı dalda birincil düğme YOK · yatay kayma yok (İKİ yerde).
 *
 * Okunan her şey doğrulama ekranının KENDİ DOM alt ağacından geliyor, sayfanın
 * tamamından değil: arkadaki Finans sekmeleri ve özet kartları da metin üretiyor ve
 * gevşek bir çıpa, ekran hiç çizilmese bile bazı kontrolleri boş yere geçirirdi. */
const dogrulamaOkuyucu = (sayfa) => () => sayfa.evaluate(() => {
  /* ÇIPA: başlıkları tam olarak "Satır|Eski|Yeni|Fark" olan tablo. Sınıf adına ya da
   * satır içi stil metnine bakılmıyor — stil düzenlenince sessizce kopan bir çıpa olmasın. */
  const tablo = [...document.querySelectorAll("table")].find((x) => (
    [...x.querySelectorAll("thead th")].map((h) => (h.textContent || "").trim()).join("|")
      === "Satır|Eski|Yeni|Fark"
  ));
  if (!tablo) return null;
  /* Tablodan yukarı çıkıp doğrulama ekranının kökünü bul: karar şeridini DE, eksik bilgi
   * özetini DE kapsayan ilk ata. */
  let kok = tablo;
  while (kok && !((kok.innerText || "").includes("Mutabakat")
    && (kok.innerText || "").includes("Eksik bilgi"))) kok = kok.parentElement;
  if (!kok) return null;
  /* Tablonun KENDİ kaydırma bölgesi. Belgenin `scrollWidth`i tek başına yetmiyor: geniş
   * bir tablo kendi kabında kayar ve belgeye hiç yansımaz — yani yalnızca belgeye bakan
   * bir kontrol o bozulmayı görmez. Bölge bulunamazsa `null` döner ve kontrol DÜŞER;
   * sessizce geçmesindense gürültülü kırılsın. */
  const kaydirma = tablo.closest(".marcus-table-wrap");
  /* BİRİNCİL DÜĞMENİN İMZASI: opak zemin + beyaz yazı (`saveBtnStyle`). Vurgu rengi
   * SABİT YAZILMIYOR — tema değişince sessizce kopmasın. */
  const birincilDugmeler = [...kok.querySelectorAll("button")].filter((b) => {
    const st = getComputedStyle(b);
    return /^rgb\(/.test(st.backgroundColor) && st.color === "rgb(255, 255, 255)";
  }).map((b) => (b.textContent || "").trim());
  return {
    metin: kok.innerText || "",
    birincilDugmeler,
    satirSayisi: tablo.querySelectorAll("tbody tr").length,
    ilkSutun: [...tablo.querySelectorAll("tbody tr td:first-child")].map((x) => (x.textContent || "").trim()),
    yatayTasma: kaydirma ? kaydirma.scrollWidth - kaydirma.clientWidth : null,
  };
});

async function dogrulamaEtkilesimi({ sayfa, ad }) {
  const ekraniOku = dogrulamaOkuyucu(sayfa);
  const para = paraOkuyucu(sayfa);

  let acmaHatasi = null;
  try {
    await sayfa.locator("button").filter({ hasText: "Doğrulama" }).first().click({ timeout: 20000 });
    await sayfa.waitForFunction(
      () => document.body.innerText.includes("Mutabakat"), null, { timeout: 20000 },
    );
  } catch (e) {
    acmaHatasi = e.message.split("\n")[0];
  }

  const ekran = await ekraniOku();
  // Sekme hiç açılmasa bile AŞAĞIDAKİ KONTROLLERİN HEPSİ ÇALIŞIR ve tek tek düşer:
  // erken dönseydi "kaç kontrol düştü" ölçümü sessizce küçülürdü.
  const metin = ekran ? ekran.metin : "";
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: Doğrulama sekmesine tıklayınca içerik çizildi`,
    acmaHatasi === null && ekran !== null, acmaHatasi || "doğrulama ekranı DOM'da bulunamadı");

  /* 1 · KARAR ŞERİDİ — hangi dal? Fixture bilerek TUTAN tarafta kuruldu. */
  kontrol(`${ad}: karar şeridi TUTUYOR dalını çizdi (engelleme yok)`,
    metin.includes("Eski ve yeni motor birebir tutuyor")
      && !metin.includes("geçiş ENGELLENDİ"),
    `ekranda: "${ornek}…"`);

  /* 2 · MUTABAKAT TABLOSU gerçekten DOLU. "Tablo var" demek yetmez: boş bir <tbody> de
   * bir tablodur. Satır sayısı ve bir satırın ADI birlikte aranıyor. */
  kontrol(`${ad}: mutabakat tablosunda ${DOGRULAMA_SATIR} satır var`,
    ekran !== null && ekran.satirSayisi === DOGRULAMA_SATIR,
    ekran === null ? "ekran yok" : `satır: ${ekran.satirSayisi}`);
  kontrol(`${ad}: satır adları çizildi (tahsilat · personel gideri · hesap bakiyesi)`,
    ekran !== null
      && ekran.ilkSutun.some((x) => x.includes("Tahsilat toplamı"))
      && ekran.ilkSutun.some((x) => x.includes("Personel gideri"))
      && ekran.ilkSutun.some((x) => x.includes(DOGRULAMA_HESAP)),
    ekran === null ? "ekran yok" : JSON.stringify(ekran.ilkSutun.slice(0, 4)));

  /* 3 · RAKAM GERÇEKTEN TABLOYA GİRDİ. Tutar tarayıcının kendi tr-TR biçimlendirmesiyle
   * karşılaştırılıyor (`fmt` de onu çağırıyor): sınanan şey ayıraç biçimi değil TUTAR. */
  const tahsilatMetni = await para(DOGRULAMA_TAHSILAT);
  kontrol(`${ad}: tahsilat satırının tutarı doğru (${tahsilatMetni})`,
    metin.includes(tahsilatMetni), `ekranda: "${ornek}…"`);

  /* 4 · EKSİK BİLGİ ÖZETİ — sayı YORUMLANIYOR, çıplak bırakılmıyor. */
  kontrol(`${ad}: eksik bilgi özeti çizildi (${DOGRULAMA_TARIHSIZ} tarihsiz · ${DOGRULAMA_KDVSIZ} KDV'siz)`,
    metin.includes(`${DOGRULAMA_TARIHSIZ} hareket tarihsiz`)
      && metin.includes("dönem raporlarında görünmüyor")
      && metin.includes(`${DOGRULAMA_KDVSIZ} kayıtta KDV`),
    `ekranda: "${ornek}…"`);
  kontrol(`${ad}: uyarı üreten kaynaklar adıyla yazıldı (vergiTakvimi · cekimIsleri)`,
    metin.includes("UYARI ÜRETEN KAYNAKLAR") && metin.includes("vergiTakvimi")
      && metin.includes("cekimIsleri"),
    `ekranda: "${ornek}…"`);

  /* 5 · SAĞLIKLI DURUMDA BİRİNCİL DÜĞME YOK — müşteri panelindeki kuralın aynısı.
   * NEGATİF bir iddia olduğu için boş yere geçmeye açık: ekran hiç çizilmezse de düğme
   * yoktur. Bu yüzden `ekran !== null` şartı taşıyor ve aynı senaryoda tablonun DOLU
   * olduğu ayrıca aranıyor. */
  kontrol(`${ad}: tutan mutabakatta birincil (saveBtnStyle) düğme YOK`,
    ekran !== null && ekran.birincilDugmeler.length === 0,
    ekran === null ? "ekran çizilmedi" : `bulunan: ${JSON.stringify(ekran.birincilDugmeler)}`);

  /* 6 · YATAY KAYMA İKİ YERDE: belge/gövde ve tablonun KENDİ kaydırma bölgesi. */
  const kayma = await sayfa.evaluate(() => ({
    belge: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    govde: document.body.scrollWidth - document.body.clientWidth,
  }));
  const tabloTasmasi = ekran ? ekran.yatayTasma : null;
  kontrol(`${ad}: yatay KAYMA yok (sayfa gövdesi + tablonun kendi kabı)`,
    kayma.belge <= 0 && kayma.govde <= 0 && tabloTasmasi !== null && tabloTasmasi <= 0,
    `belge: ${kayma.belge}px, gövde: ${kayma.govde}px, tablo: ${tabloTasmasi === null ? "kaydırma bölgesi bulunamadı" : tabloTasmasi + "px"}`);

  if (metin) console.log(`     doğrulamadan: "${ornek}…"`);
}

/* ── FİNANS SEKME ÇUBUĞU — OKUYUCU ──────────────────────────────────────────────
 *
 * ÇIPA: `role="tablist"` + `aria-label="Finans bölümleri"`. Satır içi stil METNİNE ya da
 * sınıf adına bakılmıyor — stil düzenlenince sessizce kopan bir çıpa olmasın. Çubuk
 * bulunamazsa `null` döner ve kontroller DÜŞER; sessizce geçmesindense gürültülü kırılsın.
 *
 * Okunan her şey Finans ekranının KENDİ alt ağacından (çubuğun ebeveyni) geliyor,
 * sayfanın tamamından değil: personel kabuğunun üst çubuğu ve menüsü de metin üretiyor
 * ve gevşek bir çıpa, ekran hiç çizilmese bile bazı kontrolleri boş yere geçirirdi. */
const finansOkuyucu = (sayfa) => () => sayfa.evaluate(() => {
  const serit = document.querySelector('[role="tablist"][aria-label="Finans bölümleri"]');
  if (!serit) return null;
  const kap = serit.parentElement;   // Finans ekranının kökü
  return {
    sekmeler: [...serit.querySelectorAll('[role="tab"]')].map((b) => ({
      ad: (b.textContent || "").trim(),
      secili: b.getAttribute("aria-selected") === "true",
    })),
    /* İKİ YERDE ÖLÇÜLEN YATAY TAŞMA — biri tek başına yetmiyor:
     *   · `seritTasmasi`: çubuğun KENDİ kaydırma bölgesi. Dar ekranda bunun POZİTİF
     *     olması bir kusur DEĞİL, tasarımın kendisi — sekmeler sığmadığında çubuk kendi
     *     içinde kayar. Ölçülmesinin sebebi, aşağıdaki kontrolün boş yere geçmemesi:
     *     taşma hiç yoksa "kap taşmıyor" iddiası hiçbir şey sınamaz.
     *   · `kapTasmasi`: çubuğun EBEVEYNİ. Taşma çubuğun içinde kalmayıp dışarı çıkarsa
     *     burada görünür ve sayfa gövdesine kadar yürür ("sayfa gövdesi asla yatay
     *     kaymaz" — `marcus-design`). */
    seritTasmasi: serit.scrollWidth - serit.clientWidth,
    kapTasmasi: kap ? kap.scrollWidth - kap.clientWidth : null,
    metin: kap ? (kap.innerText || "") : "",
  };
});

/** Personel kabuğunun üst menüsündeki madde adları. İki maddeden azsa menü HİÇ
 *  çizilmiyor (`staffNavAll.length > 1`) — o zaman boş dizi döner. */
const personelMenusu = (sayfa) => () => sayfa.evaluate(() => {
  const kok = document.getElementById("root");
  const serit = kok ? [...kok.querySelectorAll("div")].find((d) => {
    const cocuklar = [...d.children];
    return cocuklar.length > 1 && cocuklar.every((c) => c.tagName === "BUTTON")
      && cocuklar.some((c) => (c.textContent || "").trim() === "Finans");
  }) : null;
  return serit ? [...serit.children].map((b) => (b.textContent || "").trim()) : [];
});

/* ── PERSONEL · İKİ İZİN BİRDEN ───────────────────────────────────────────────── */
async function personelFinansEtkilesimi({ sayfa, ad }) {
  const finansOku = finansOkuyucu(sayfa);
  const menuyuOku = personelMenusu(sayfa);

  const menu = await menuyuOku();
  const ekran = await finansOku();
  // Ekran hiç çizilmese bile AŞAĞIDAKİ KONTROLLERİN HEPSİ ÇALIŞIR ve tek tek düşer:
  // erken dönseydi "kaç kontrol düştü" ölçümü sessizce küçülürdü.
  const sekmeAdlari = ekran ? ekran.sekmeler.map((x) => x.ad) : [];
  const seciliSekme = ekran ? ((ekran.sekmeler.find((x) => x.secili) || {}).ad || "(yok)") : "(ekran yok)";
  const metin = ekran ? ekran.metin : "";
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: menüde TEK "Finans" maddesi var (ayrı "Ödeme Takvimi" yok)`,
    menu.filter((x) => x === "Finans").length === 1 && !menu.includes("Ödeme Takvimi"),
    `menü: ${JSON.stringify(menu)}`);
  kontrol(`${ad}: sekme çubuğu çizildi (${PERSONEL_SEKMELERI.join(" · ")})`,
    sekmeAdlari.join("|") === PERSONEL_SEKMELERI.join("|"),
    `bulunan: ${JSON.stringify(sekmeAdlari)}`);
  /* NEGATİF İDDİA — boş yere geçmeye açık: ekran hiç çizilmezse de Doğrulama yoktur.
   * Bu yüzden `ekran !== null` şartı taşıyor ve yukarıda çubuğun DOLU olduğu aranıyor. */
  kontrol(`${ad}: personelde Doğrulama sekmesi YOK`,
    ekran !== null && !sekmeAdlari.includes("Doğrulama"),
    ekran === null ? "ekran çizilmedi" : `bulunan: ${JSON.stringify(sekmeAdlari)}`);
  kontrol(`${ad}: varsayılan sekme Özet ve içeriği çizili (${OZET_IMZASI})`,
    seciliSekme === "Özet" && metin.includes(OZET_IMZASI) && metin.includes("KASADA"),
    `seçili: ${seciliSekme} · ekranda: "${ornek}…"`);

  /* SEKME GEÇİŞİ GERÇEKTEN ÖLÇÜLÜYOR: yalnızca "Ödemeler geldi" değil, "Özet GİTTİ" de
   * aranıyor. İki sekmenin içeriği aynı anda duruyorsa geçiş çalışmıyor demektir. */
  let gecisHatasi = null;
  try {
    await sayfa.locator('[role="tab"]').filter({ hasText: ODEMELER_SEKMESI }).first()
      .click({ timeout: 20000 });
    await sayfa.waitForFunction(
      (m) => document.body.innerText.includes(m), ODEME_ICERIGI[0], { timeout: 20000 },
    );
  } catch (e) {
    gecisHatasi = e.message.split("\n")[0];
  }

  const ekran2 = await finansOku();
  const metin2 = ekran2 ? ekran2.metin : "";
  const secili2 = ekran2 ? ((ekran2.sekmeler.find((x) => x.secili) || {}).ad || "(yok)") : "(ekran yok)";
  const ornek2 = metin2.slice(0, 140).replace(/\s+/g, " ");

  kontrol(`${ad}: "${ODEMELER_SEKMESI}" sekmesine tıklanınca seçili sekme değişti`,
    gecisHatasi === null && secili2 === ODEMELER_SEKMESI,
    gecisHatasi || `seçili: ${secili2}`);
  kontrol(`${ad}: Ödemeler sekmesinin içeriği geldi (${ODEME_ICERIGI.join(" · ")})`,
    ODEME_ICERIGI.every((m) => metin2.includes(m)), `ekranda: "${ornek2}…"`);
  kontrol(`${ad}: Özet sekmesinin içeriği gitti (${OZET_IMZASI} · KASADA yok)`,
    metin2 !== "" && !metin2.includes(OZET_IMZASI) && !metin2.includes("KASADA"),
    `ekranda: "${ornek2}…"`);

  if (metin2) console.log(`     finanstan: "${ornek2}…"`);
}

/* ── PERSONEL · YALNIZCA ÖDEME TAKVİMİ İZNİ ───────────────────────────────────── */
async function odemeIzniEtkilesimi({ sayfa, ad }) {
  const finansOku = finansOkuyucu(sayfa);

  const ekran = await finansOku();
  const govde = await sayfa.evaluate(() => (document.getElementById("root") || {}).innerText || "");
  const sekmeAdlari = ekran ? ekran.sekmeler.map((x) => x.ad) : [];
  const metin = ekran ? ekran.metin : "";
  const ornek = metin.slice(0, 140).replace(/\s+/g, " ");

  /* ASIL İDDİA — ERİŞİM KAYBI YOK. Finans maddesi bu kişiye çizilmezse personel kabuğu
   * hiçbir bölüm bulamaz ve tam olarak bu cümleyi yazar. */
  kontrol(`${ad}: erişim kaybı YOK ("Henüz erişimin olan bir bölüm yok" çıkmadı)`,
    !govde.includes("Henüz erişimin olan bir bölüm yok"),
    `ekranda: "${govde.slice(0, 140).replace(/\s+/g, " ")}…"`);
  kontrol(`${ad}: Finans ekranı çizildi ve YALNIZCA "${ODEMELER_SEKMESI}" sekmesi var`,
    ekran !== null && sekmeAdlari.join("|") === ODEMELER_SEKMESI,
    ekran === null ? "sekme çubuğu çizilmedi" : `bulunan: ${JSON.stringify(sekmeAdlari)}`);
  kontrol(`${ad}: Finans'ın kendi sekmeleri YOK (Özet · Hesaplar · Doğrulama)`,
    ekran !== null && !sekmeAdlari.includes("Özet") && !sekmeAdlari.includes("Hesaplar")
      && !sekmeAdlari.includes("Doğrulama"),
    ekran === null ? "ekran çizilmedi" : `bulunan: ${JSON.stringify(sekmeAdlari)}`);
  /* Sekme BAŞLIĞI sabit metin; asıl kanıt ekranın içeriğinin çizilmesi — üstelik belge
   * bilerek eksik (`monthly` ve arkadaşları hiç gelmiyor), yani bu kontrol aynı zamanda
   * "Finans gövdesi eksik alanlarda patlamıyor" demek. */
  kontrol(`${ad}: Ödemeler içeriği doğrudan çizildi (${ODEME_ICERIGI.join(" · ")})`,
    ODEME_ICERIGI.every((m) => metin.includes(m)) && metin.includes(PERSONEL_MARKA),
    `ekranda: "${ornek}…"`);

  if (metin) console.log(`     finanstan: "${ornek}…"`);
}

/* ── DAR EKRAN · SEKME ÇUBUĞU TAŞMASI ─────────────────────────────────────────── */
async function darFinansEtkilesimi({ sayfa, ad }) {
  const finansOku = finansOkuyucu(sayfa);

  const ekran = await finansOku();
  const sekmeAdlari = ekran ? ekran.sekmeler.map((x) => x.ad) : [];

  kontrol(`${ad}: dar ekranda da bütün sekmeler çizildi (${PERSONEL_SEKMELERI.length} sekme)`,
    sekmeAdlari.join("|") === PERSONEL_SEKMELERI.join("|"),
    `bulunan: ${JSON.stringify(sekmeAdlari)}`);

  /* KONTROL BOŞ YERE GEÇMESİN: sekmeler 390px'e sığıyorsa "kap taşmıyor" iddiası hiçbir
   * şey sınamaz. Önce taşmanın GERÇEKTEN olduğu, sonra çubuğun içinde KALDIĞI ölçülüyor. */
  kontrol(`${ad}: sekmeler 390px'e sığmıyor, yani taşma kontrolü gerçekten bir şey ölçüyor`,
    ekran !== null && ekran.seritTasmasi > 0,
    ekran === null ? "ekran çizilmedi" : `şerit taşması: ${ekran.seritTasmasi}px`);

  const kayma = await sayfa.evaluate(() => ({
    belge: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    govde: document.body.scrollWidth - document.body.clientWidth,
  }));
  const kapTasmasi = ekran ? ekran.kapTasmasi : null;
  kontrol(`${ad}: yatay KAYMA yok (sayfa gövdesi + sekme çubuğunun ebeveyni)`,
    kayma.belge <= 0 && kayma.govde <= 0 && kapTasmasi !== null && kapTasmasi <= 0,
    `belge: ${kayma.belge}px, gövde: ${kayma.govde}px, kap: ${kapTasmasi === null ? "bulunamadı" : kapTasmasi + "px"}`);
}

/* ── TARAYICIYI BUL ──────────────────────────────────────────────────────────── */
/**
 * Chromium'un yeri MAKİNEDEN MAKİNEYE DEĞİŞİR. Yol sabit yazılıydı
 * ("/opt/pw-browsers/chromium") ve o yol yoksa test çöküyordu — yani başka bir
 * geliştirme ortamında ya da CI'da "uygulama bozuk" gibi görünüyordu, oysa yalnızca
 * tarayıcı başka yerdeydi. Sırayla denenir, ilk açılan kullanılır:
 *
 *   1. MARCUS_CHROMIUM       — elle verilen yol (her şeyi ezer)
 *   2. PLAYWRIGHT_BROWSERS_PATH altındaki chromium
 *   3. playwright-core'un KENDİ indirdiği tarayıcı (executablePath verilmez)
 *   4. Sistemde kurulu Chrome/Chromium kanalları
 *
 * Hiçbiri açılmazsa test SESSİZCE GEÇMEZ — ne denendiğini ve ne yapılması gerektiğini
 * yazıp 1 ile çıkar. "Tarayıcı bulunamadı" ile "uygulama açılmıyor" karışmamalı.
 */
async function tarayiciAc() {
  const ARGS = ["--no-sandbox", "--disable-dev-shm-usage"];
  const adaylar = [];

  if (process.env.MARCUS_CHROMIUM) {
    adaylar.push({ ad: `MARCUS_CHROMIUM=${process.env.MARCUS_CHROMIUM}`,
                   ayar: { executablePath: process.env.MARCUS_CHROMIUM, args: ARGS } });
  }
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const yol = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium");
    if (fs.existsSync(yol)) {
      adaylar.push({ ad: `PLAYWRIGHT_BROWSERS_PATH → ${yol}`,
                     ayar: { executablePath: yol, args: ARGS } });
    }
  }
  adaylar.push({ ad: "playwright-core'un kendi tarayıcısı", ayar: { args: ARGS } });
  for (const kanal of ["chromium", "chrome"]) {
    adaylar.push({ ad: `sistem kanalı: ${kanal}`, ayar: { channel: kanal, args: ARGS } });
  }

  const denenenler = [];
  for (const aday of adaylar) {
    try {
      const t = await chromium.launch(aday.ayar);
      if (denenenler.length) console.log(`  · tarayıcı: ${aday.ad}`);
      return t;
    } catch (e) {
      denenenler.push(`${aday.ad} → ${e.message.split("\n")[0]}`);
    }
  }

  console.log("  ✗ TARAYICI BULUNAMADI — bu bir uygulama hatası DEĞİL, ortam eksikliği.");
  denenenler.forEach((d) => console.log(`      denendi: ${d}`));
  console.log("    Çözüm: MARCUS_CHROMIUM=<chrome yolu> ile çalıştır,");
  console.log("    ya da `npx playwright install chromium` ile tarayıcıyı kur.");
  process.exit(1);
}

/* ── ÇALIŞTIR ────────────────────────────────────────────────────────────────── */
async function calistir() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.log("  · dist/ yok, derleniyor…");
    execSync("npm run build", { cwd: KOK, stdio: "ignore" });
  }

  const tarayici = await tarayiciAc();
  try {
    // 1) Belge BOŞ: uygulamanın ilk kurulum ekranı. `data` bir süre null kalır —
    //    siyah ekran hatası tam olarak bu anda ortaya çıkmıştı.
    await senaryo(tarayici, "boş veritabanı", { role: "owner" }, 50,
      ["Veritabanında hiçbir kayıt bulunamadı"]);
    // 2) Belge DOLU: marka ve kart olduğunda çizilen asıl arayüz.
    // "Dashboard" + "ÜRETİM" yalnızca belge YÜKLENDİĞİNDE çizilen ana kabukta var;
    // ilk kurulum ve hata ekranlarında yoktur. Yani bu iki kelime, asıl arayüzün
    // gerçekten çizildiğinin kanıtı.
    await senaryo(tarayici, "sahte veriyle", SAHTE_YANIT(), 50,
      ["Dashboard", "ÜRETİM"]);
    /* 3) MÜŞTERİ DETAY PANELİ — uygulamanın Dashboard'dan SONRAKİ ilk derin ekranı.
     *    İki localStorage anahtarı açılıştan önce yazılıyor:
     *      · `marcus-os-son-sekme` → uygulama doğrudan Müşteriler'de açılır (yan menüdeki
     *        "MÜŞTERİ" grubu kapalı geliyor; iki ayrı tıklamayı beklemek testi menü
     *        düzenine bağlardı, oysa ölçülmek istenen panel).
     *      · `marcus-os-gizlilik` → gizlilik modu VARSAYILAN OLARAK AÇIK ve o zaman `fmt`
     *        bütün tutarları "₺ •••" yazıyor. Kapatılmazsa bakiye kontrolü tutarı değil
     *        yıldızları doğrular, yani hiçbir şeyi ölçmez. */
    const PANEL_DEPOSU = { "marcus-os-son-sekme": "musteriler", "marcus-os-gizlilik": "0" };
    await senaryo(tarayici, "müşteri detay paneli", SAHTE_YANIT_PANEL(), 50,
      ["Müşteriler", GECIKMELI_MARKA],
      { yerelDepo: PANEL_DEPOSU, etkilesim: musteriDetayiEtkilesimi });
    /* 4) SAĞLIKLI MARKA — aynı panelin ÖTEKİ dalı. Gecikme dalı çizildiğinde birincil
     *    düğmenin VAR olduğu ölçülüyordu; bu senaryo gerekmediğinde YOK olduğunu ölçer. */
    await senaryo(tarayici, "sağlıklı marka paneli", SAHTE_YANIT_PANEL(), 50,
      ["Müşteriler", SAGLIKLI_MARKA],
      { yerelDepo: PANEL_DEPOSU, etkilesim: saglikliMarkaEtkilesimi });
    /* 5) DAR EKRAN — aynı panel, `useIsMobile(640)` dalı. 390×800 yaygın bir telefon
     *    ölçüsü; 640'ın altında olması yeterli, tam değeri kritik değil. */
    await senaryo(tarayici, "dar ekranda müşteri paneli", SAHTE_YANIT_PANEL(), 50,
      ["Müşteriler", GECIKMELI_MARKA],
      {
        yerelDepo: PANEL_DEPOSU,
        etkilesim: darEkranEtkilesimi,
        pencere: { width: 390, height: 800 },
      });
    /* 6) FİNANS → DOĞRULAMA — yeni hesaplama katmanının önündeki KAPI, ekranda.
     *    Yalnızca YÖNETİCİ görüyor; fixture `role: "owner"` olduğu için sekme çiziliyor.
     *    `marcus-os-son-sekme` ile uygulama doğrudan Finans'ta açılıyor (yan menüdeki
     *    grup kapalı geliyor ve iki ayrı tıklamayı beklemek testi menü düzenine bağlardı),
     *    `marcus-os-gizlilik` ile gizlilik modu kapatılıyor — açık kalsaydı `fmt` bütün
     *    tutarları "₺ •••" yazar ve tutar kontrolü hiçbir şey ölçmezdi. */
    await senaryo(tarayici, "finans doğrulama sekmesi", SAHTE_YANIT_DOGRULAMA(), 50,
      ["Finans", "Doğrulama"],
      {
        yerelDepo: { "marcus-os-son-sekme": "finans", "marcus-os-gizlilik": "0" },
        etkilesim: dogrulamaEtkilesimi,
      });
    /* 7) PERSONEL · FİNANS SEKMELERİ — para ekranları tek menüde toplandı.
     *    Yönetici kabuğu senaryo 6'da zaten çiziliyor; bu senaryo PERSONEL kabuğunu
     *    ölçüyor. Bu projede aynı yetenek bir kez yalnızca bir role eklenip diğerinde
     *    hiç görünmedi (`operasyonOrtakProps`) — iki kabuk ayrı ayrı sınanır.
     *    `marcus-os-son-sekme` ile uygulama doğrudan Finans'ta açılıyor,
     *    `marcus-os-gizlilik` ile gizlilik modu kapatılıyor. */
    const FINANS_DEPOSU = { "marcus-os-son-sekme": "finans", "marcus-os-gizlilik": "0" };
    await senaryo(tarayici, "personel finans sekmeleri", SAHTE_YANIT_PERSONEL_FINANS(), 50,
      ["Finans", ODEMELER_SEKMESI],
      { yerelDepo: FINANS_DEPOSU, etkilesim: personelFinansEtkilesimi });
    /* 8) YALNIZCA ÖDEME TAKVİMİ İZNİ — bu işin ASIL RİSKİ ve kırarak ölçmenin hedefi.
     *    Eski ayrı menü maddesi tam bu kişi içindi; Finans maddesi ona da çizilmezse
     *    ekrana HİÇ ulaşamaz. Belge bilerek eksik (sunucunun bu izne göndereceği kadarı). */
    await senaryo(tarayici, "yalnızca ödeme takvimi izni", SAHTE_YANIT_ODEME_IZNI(), 50,
      [ODEMELER_SEKMESI, ODEME_ICERIGI[0]],
      { yerelDepo: FINANS_DEPOSU, etkilesim: odemeIzniEtkilesimi });
    /* 9) DAR EKRAN — sekme sayısı izne göre 8'e kadar çıkıyor ve 390px'lik bir telefonda
     *    hepsi sığmıyor. Taşmanın sayfa gövdesine SIZMAMASI burada ölçülüyor. */
    await senaryo(tarayici, "dar ekranda finans sekmeleri", SAHTE_YANIT_PERSONEL_FINANS(), 50,
      ["Finans", ODEMELER_SEKMESI],
      {
        yerelDepo: FINANS_DEPOSU,
        etkilesim: darFinansEtkilesimi,
        pencere: { width: 390, height: 800 },
      });
  } finally {
    await tarayici.close();
  }

  console.log("");
  if (kalan > 0) {
    console.log(`SONUÇ: ✓${gecen}  ✗${kalan} — AÇILIŞ BOZUK`);
    process.exit(1);
  }
  /* KAÇ KONTROL ÇALIŞTI — t95'teki bekçinin aynısı, aynı sebeple.
   *
   * Yukarıdaki iki koruma tek tek kaçakları kapatıyor; bu satır SINIFIN TAMAMINI kapatıyor.
   * Ölçüldü: bir `senaryo()` çağrısının tamamı silinince test "SONUÇ: 7 kontrol geçti,
   * uygulama açılıyor." deyip ÇIKIŞ 0 veriyordu — kapsamın yarısı sessizce gitmişti ve
   * doğrulama zincirinin beş adımı da yeşil kalıyordu. Bir kontrol silmek, bir senaryo
   * silmek, bir `await` unutmak: hepsi buraya düşer.
   *
   * Sayıyı BİLEREK değiştirmek serbest — yeni kontrol eklerken bu sabit de artar. Yasak
   * olan, sayının KENDİLİĞİNDEN düşmesi ve kimsenin görmemesi. */
  const BEKLENEN = 125;
  if (gecen !== BEKLENEN) {
    console.log(`SONUÇ: ✗ ${gecen} kontrol çalıştı, ${BEKLENEN} bekleniyordu — kapsam DEĞİŞMİŞ.`);
    console.log("       Kontrol eklediysen bu sabiti de artır; artırmadıysan bir kontrol");
    console.log("       ya da senaryo sessizce düşmüş demektir.");
    process.exit(1);
  }
  console.log(`SONUÇ: ${gecen} kontrol geçti, uygulama açılıyor.`);
}

calistir().catch((e) => {
  console.log(`  ✗ test çöktü: ${e.message}`);
  process.exit(1);
});
