/**
 * GÜNLÜK İŞ TAKİBİ — kim, ne zaman, hangi işi ilerletti.
 *
 * SORU: "Bugün kim ne yaptı, kimin elinde kaç iş bekliyor, bu hafta kaç edit bitti."
 * Bu bilginin neredeyse tamamı ZATEN kaydediliyordu — her kartın `gecmis` dizisi her
 * aşama değişimini yazan kişiyle birlikte tutuyor. Eksik olan tek şey onu toplayıp
 * gösteren bir katmandı. Bu modül YENİ VERİ ÜRETMEZ; mevcut alanları okur.
 *
 * SAF: ağ yok, yan etki yok, gelen diziyi değiştirmez.
 *
 * ---------------------------------------------------------------------------
 * ZAMAN — BU MODÜLÜN EN KIRILGAN YERİ, DİKKATLİ OKU
 *
 * Eski geçmiş kayıtlarında zaman bir EKRAN METNİ olarak duruyor:
 * `new Date().toLocaleString("tr-TR")` → "16.09.2026 14:32:05". Bu bir veri değil:
 * sıralanamaz, saat dilimi taşımaz ve gün hanesi bazen tek basamaklı ("2.08.2026").
 * Mevcut istatistik ekranı bunu `split(" ")[0].split(".").reverse()` diye parçalıyordu —
 * saat tamamen çöpe gidiyor, yani "bugün saat kaçta ne oldu" sorusu hiç cevaplanamıyordu.
 *
 * Bu yüzden yeni kayıtlara `zaman` (ISO) EKLENDİ. Eski kayıtlara DOKUNULMADI ve
 * dokunulmayacak: belgede binlerce satır var, geriye dönük yazmak tek JSON belgesini
 * baştan sona yeniden yazmak demek. Onlar metinden ayrıştırılıyor.
 *
 * AYRIŞTIRMA VARSAYIMI AÇIKÇA YAZILIYOR: eski metin hangi saat diliminde yazıldıysa o
 * dilimin duvar saatidir. Tarayıcıda yazılanlar kullanıcının saatiyle, SUNUCUDA yazılanlar
 * ("Sistem", "Müşteri" kayıtları) UTC ile. Bu sapma eski kayıtlarda KAPATILAMAZ — bilgi
 * kaydın içinde hiç yok. Yeni `zaman` alanı bunu ileriye dönük bitiriyor.
 *
 * Ayrıştırılamayan kayıt için zaman UYDURULMAZ, `null` döner ve o olay gün bazlı
 * listelerde görünmez. Yanlış güne yazmak, hiç yazmamaktan kötüdür.
 */

import { BITMIS_ASAMALAR } from "./bugun.js";

/** Kişi SAYILMAYAN yazarlar — bunlar rol etiketi, personel değil. */
export const KISI_OLMAYAN_YAZARLAR = ["Sistem", "Müşteri", "Müşteri talebi"];

const metin = (x) => String(x === null || x === undefined ? "" : x).trim();
const iki = (n) => String(n).padStart(2, "0");

/** Yerel duvar saatine göre "YYYY-AA-GG". `toISOString` UTC'ye kaydırdığı için kullanılmaz. */
export function gunAnahtari(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

/**
 * Bir geçmiş/medya kaydının gerçek anı.
 * Önce `zaman` (ISO, yeni kayıtlar), sonra `tarih` (eski tr-TR metni ya da ISO).
 * Çözülemezse `null` — tahmin edilmez.
 */
export function kayitAni(kayit) {
  if (!kayit) return null;

  const iso = metin(kayit.zaman);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const ham = metin(kayit.tarih);
  if (!ham) return null;

  /* Medya kayıtları zaten ISO tutuyor (`new Date().toISOString()`), geçmiş kayıtları
   * tr-TR metni. İkisi de `tarih` alanında olduğu için önce ISO denenir. */
  if (/^\d{4}-\d{2}-\d{2}/.test(ham)) {
    const d = new Date(ham);
    if (!Number.isNaN(d.getTime())) return d;
  }

  /* "16.09.2026 14:32:05" · "2.08.2026 09:05" · "16.09.2026" */
  const [gunKismi, saatKismi] = ham.split(/[\s ]+/);
  const p = String(gunKismi || "").split(".");
  if (p.length !== 3) return null;
  const g = Number(p[0]), a = Number(p[1]), y = Number(p[2]);
  if (!(y >= 1970 && a >= 1 && a <= 12 && g >= 1 && g <= 31)) return null;
  const [sa = 0, dk = 0, sn = 0] = String(saatKismi || "").split(":").map(Number);
  if ([sa, dk, sn].some((x) => Number.isNaN(x))) return null;
  const d = new Date(y, a - 1, g, sa, dk, sn);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Kaydın düştüğü gün, "YYYY-AA-GG". Çözülemezse `null`. */
export function kayitGunu(kayit) {
  return gunAnahtari(kayitAni(kayit));
}

/** Ekranda gösterilecek "SS:DD". Saat bilinmiyorsa boş metin. */
export function kayitSaati(kayit) {
  const d = kayitAni(kayit);
  if (!d) return "";
  /* Eski kayıtta saat yoksa gece yarısı olarak çözülür; "00:00" göstermek "bilmiyorum"u
   * bir saat gibi sunar. Saatin metinde gerçekten yazıp yazmadığına bakılıyor. */
  if (!metin(kayit.zaman) && !/\d{1,2}:\d{2}/.test(metin(kayit.tarih))) return "";
  return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** `yazan` gerçek bir kişi mi, yoksa rol etiketi mi? */
export function kisiMi(yazan) {
  const ad = metin(yazan);
  if (!ad) return false;
  return !KISI_OLMAYAN_YAZARLAR.includes(ad);
}

/**
 * Açıklamadan aşama geçişini çıkarır. İki biçim var:
 *   "Aşama değişti: Edit Bekliyor → Düzenleniyor (not)"
 *   'Toplu taşıma: "Edit Bekliyor" → "Düzenleniyor".'
 * Geçiş yoksa `null` (dosya güncelleme, yorum, revize notu…).
 */
export function asamaGecisi(aciklama) {
  const t = metin(aciklama);
  if (!t.includes("→")) return null;
  const [solHam, sagHam] = t.split("→");
  const temizle = (x) => metin(x)
    .replace(/^.*?:\s*/, "")          // "Aşama değişti: " / "Toplu taşıma: " öneki
    .replace(/\s*\([^)]*\)\s*$/, "")  // sondaki parantezli ek açıklama
    .replace(/^["“]|["”]\.?$/g, "")   // tırnaklar ve sondaki nokta
    .replace(/\.$/, "")
    .trim();
  const onceki = temizle(solHam);
  const sonraki = temizle(sagHam);
  if (!sonraki) return null;
  return { onceki, sonraki };
}

/**
 * İŞ KİMİN ELİNDE: kartı EN SON İLERLETEN kişi.
 *
 * Kullanıcının seçtiği tanım bu. Sebebi sistemin kendi kuralı: Operasyon izni olan
 * personel gördüğü HER kartı işleyebiliyor (`lib/is-yetkisi.js`), atama zorunlu değil.
 * `kameraman`/`editor` alanlarına bakan bir sayım, o alanlar boş olduğunda sessizce
 * BOŞ liste üretiyordu — ekran "kimse çalışmıyor" diyordu.
 *
 * "Sistem" ve "Müşteri" kayıtları atlanır: onlar emek değil, olay.
 * Hiç kişi dokunmamışsa `null` döner — bu "sahipsiz" demek ve bilinmesi gereken bir hal.
 */
export function isinSahibi(is) {
  const gecmis = Array.isArray(is && is.gecmis) ? is.gecmis : [];
  for (let i = gecmis.length - 1; i >= 0; i--) {
    if (kisiMi(gecmis[i] && gecmis[i].yazan)) return metin(gecmis[i].yazan);
  }
  return null;
}

/** Kartın özeti — her olayın yanında görünen bağlam. */
const kartBilgisi = (is) => ({
  isId: is.id,
  isAdi: metin(is.icerikTuru) || "İsimsiz içerik",
  marka: metin(is.marka),
  kategori: metin(is.kategori),
  asama: metin(is.asama),
});

/**
 * TÜM OLAYLAR — geçmiş kayıtları VE dosya yüklemeleri tek akışta.
 *
 * Dosya yüklemesi ayrı bir kaynaktan geliyor (`medya[]`) çünkü yükleme kartın geçmişine
 * yazılmıyor. "Bu videoyu kim editledi" sorusunun en doğrudan cevabı bu satır — bu yüzden
 * akışa dahil. Eski yüklemelerde `yukleyen` yok; o kayıtlar "kişi bilinmiyor" olarak
 * görünür, uydurulmaz.
 */
export function tumOlaylar(isler) {
  const liste = Array.isArray(isler) ? isler : [];
  const olaylar = [];

  liste.forEach((is) => {
    if (!is) return;
    const bilgi = kartBilgisi(is);

    (Array.isArray(is.gecmis) ? is.gecmis : []).forEach((k, sira) => {
      if (!k) return;
      const an = kayitAni(k);
      olaylar.push({
        ...bilgi,
        anahtar: `g:${is.id}:${k.id !== undefined ? k.id : sira}`,
        tur: "gecmis",
        an,
        gun: gunAnahtari(an),
        saat: kayitSaati(k),
        yazan: metin(k.yazan),
        kisi: kisiMi(k.yazan) ? metin(k.yazan) : null,
        aciklama: metin(k.aciklama),
        gecis: asamaGecisi(k.aciklama),
      });
    });

    (Array.isArray(is.medya) ? is.medya : []).forEach((m, sira) => {
      if (!m) return;
      const an = kayitAni(m);
      const ad = metin(m.ad) || "dosya";
      olaylar.push({
        ...bilgi,
        anahtar: `m:${is.id}:${m.dosyaId || sira}`,
        tur: "yukleme",
        an,
        gun: gunAnahtari(an),
        saat: kayitSaati(m),
        yazan: metin(m.yukleyen),
        kisi: kisiMi(m.yukleyen) ? metin(m.yukleyen) : null,
        aciklama: `Dosya yüklendi: ${ad}${m.versiyon > 1 ? ` (V${m.versiyon})` : ""}`,
        gecis: null,
        dosyaId: m.dosyaId || null,
      });
    });
  });

  /* En yeni üstte. Zamanı çözülemeyen olay en sona düşer — listenin başını kirletmesin. */
  return olaylar.sort((a, b) => {
    if (!a.an && !b.an) return 0;
    if (!a.an) return 1;
    if (!b.an) return -1;
    return b.an - a.an;
  });
}

/**
 * GÜNLÜK AKIŞ — seçilen günün (ya da tüm zamanların) olayları, süzgeçlenmiş.
 * `gun` verilmezse gün süzgeci uygulanmaz.
 */
export function gunlukAkis({ isler, gun, kisi, marka, tur } = {}) {
  const kucult = (x) => metin(x).toLocaleLowerCase("tr");
  const kisiF = kucult(kisi);
  const markaF = kucult(marka);
  return tumOlaylar(isler).filter((o) => {
    if (gun && o.gun !== gun) return false;
    if (kisiF && kucult(o.kisi) !== kisiF) return false;
    if (markaF && kucult(o.marka) !== markaF) return false;
    if (tur && o.tur !== tur) return false;
    return true;
  });
}

/** Olaylardan geçen benzersiz kişi adları, alfabetik. */
export function kisiListesi(isler) {
  const kume = new Set();
  tumOlaylar(isler).forEach((o) => { if (o.kisi) kume.add(o.kisi); });
  return [...kume].sort((a, b) => a.localeCompare(b, "tr"));
}

const gunEkle = (gun, adet) => {
  const [y, a, g] = String(gun).split("-").map(Number);
  const d = new Date(y, a - 1, g + adet);
  return gunAnahtari(d);
};

/**
 * KİŞİ PANOSU — "şu an kimin elinde kaç iş, bu hafta ne yaptı".
 *
 * `elinde`  : son dokunan o kişi VE kart bitmemiş (BITMIS_ASAMALAR dışında)
 * `geciken` : elindeki kartlardan teslim tarihi geçmiş olanlar (lib/bugun.js ile aynı kural —
 *             tarihi olmayan kart gecikmiş SAYILMAZ, tarih girilmemiş olması gecikme değildir)
 * `bugun` / `buHafta` : o kişinin yaptığı işlem sayısı (son 7 gün, bugün dahil)
 * `sonIslem`: son dokunduğu an
 *
 * SAHİPSİZ KARTLAR ayrı satırda: hiç kişi dokunmamış, bitmemiş kartlar. Gizlenseydi
 * toplam tutmazdı ve gözden kaçan iş görünmez kalırdı.
 */
export function kisiPanosu({ isler, bugun } = {}) {
  const liste = (Array.isArray(isler) ? isler : []).filter(Boolean);
  const gun = metin(bugun) || gunAnahtari(new Date());
  const haftaBasi = gunEkle(gun, -6);

  const kisiler = new Map();
  const al = (ad) => {
    if (!kisiler.has(ad)) {
      kisiler.set(ad, { kisi: ad, elinde: 0, geciken: 0, bugun: 0, buHafta: 0, sonIslem: null, kartlar: [] });
    }
    return kisiler.get(ad);
  };

  tumOlaylar(liste).forEach((o) => {
    if (!o.kisi) return;
    const k = al(o.kisi);
    if (o.gun) {
      if (o.gun === gun) k.bugun++;
      if (o.gun >= haftaBasi && o.gun <= gun) k.buHafta++;
    }
    if (o.an && (!k.sonIslem || o.an > k.sonIslem)) k.sonIslem = o.an;
  });

  let sahipsiz = 0;
  liste.forEach((is) => {
    if (BITMIS_ASAMALAR.includes(metin(is.asama))) return;
    const sahip = isinSahibi(is);
    if (!sahip) { sahipsiz++; return; }
    const k = al(sahip);
    k.elinde++;
    const gecikti = Boolean(metin(is.teslimTarihi)) && metin(is.teslimTarihi) < gun;
    if (gecikti) k.geciken++;
    k.kartlar.push({ ...kartBilgisi(is), teslimTarihi: metin(is.teslimTarihi) || null, gecikti });
  });

  const satirlar = [...kisiler.values()].sort((a, b) =>
    (b.elinde - a.elinde) || (b.buHafta - a.buHafta) || a.kisi.localeCompare(b.kisi, "tr"));

  return { gun, satirlar, sahipsiz };
}

/** Üretim raporunda ayrı ayrı sayılan aşamalar — "iş bitti" anlamına gelen geçişler. */
export const SAYILAN_ASAMALAR = ["Çekim Yapıldı", "Kontrol Bekliyor", "Onaylandı", "Teslim Edildi"];

/**
 * ÜRETİM RAPORU — bir tarih aralığında kişi × aşama dökümü.
 *
 * Sayılan şey GEÇİŞİN HEDEFİ: "Kontrol Bekliyor"a çekilen kart = bitmiş bir edit.
 * Kartın bugünkü aşamasına bakılmaz — kart sonradan revizeye düşmüş olabilir ama o edit
 * yapılmıştır. Aynı kart aynı aşamaya iki kez girerse iki kez sayılır; bu KASITLI,
 * revize sonrası ikinci edit de yapılmış bir iştir.
 *
 * `baslangic` / `bitis`: "YYYY-AA-GG", ikisi de dahil. Verilmezse sınır uygulanmaz.
 */
export function uretimRaporu({ isler, baslangic, bitis } = {}) {
  const bas = metin(baslangic);
  const bit = metin(bitis);
  const kisiler = new Map();
  let yuklemeToplam = 0;

  tumOlaylar(isler).forEach((o) => {
    if (!o.kisi) return;
    if (!o.gun) return;                       // zamanı çözülemeyen olay sayıma girmez
    if (bas && o.gun < bas) return;
    if (bit && o.gun > bit) return;

    if (!kisiler.has(o.kisi)) {
      kisiler.set(o.kisi, {
        kisi: o.kisi,
        toplamIslem: 0,
        yukleme: 0,
        asamalar: Object.fromEntries(SAYILAN_ASAMALAR.map((a) => [a, 0])),
      });
    }
    const k = kisiler.get(o.kisi);
    k.toplamIslem++;
    if (o.tur === "yukleme") { k.yukleme++; yuklemeToplam++; }
    if (o.gecis && SAYILAN_ASAMALAR.includes(o.gecis.sonraki)) k.asamalar[o.gecis.sonraki]++;
  });

  const satirlar = [...kisiler.values()].sort((a, b) =>
    (b.toplamIslem - a.toplamIslem) || a.kisi.localeCompare(b.kisi, "tr"));

  const toplam = Object.fromEntries(SAYILAN_ASAMALAR.map((a) =>
    [a, satirlar.reduce((s, k) => s + k.asamalar[a], 0)]));

  return { baslangic: bas || null, bitis: bit || null, satirlar, toplam, yuklemeToplam };
}
