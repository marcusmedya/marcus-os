/**
 * AŞAMA KURALLARI — hem tarayıcı hem sunucu buradan okur.
 *
 * NEDEN ORTAK DOSYA: "dosya yüklenmeden kontrole çıkılamaz" kuralı iki yerde uygulanıyor.
 * Tarayıcı kullanıcıya anında söylüyor, sunucu ise kuralı gerçekten uyguluyor. İki kopya
 * yazılsaydı biri güncellenip diğeri unutulacaktı ve kural sessizce delinecekti.
 */

/* AŞAMA LİSTELERİ — TEK KAYNAK.
 *
 * Eskiden yalnızca src/CekimEditTakibi.jsx'te tanımlıydı; sunucu bunları göremediği için
 * "bu aşama bu kategoride var mı?" sorusunu hiç soramıyordu. Sonucu aşağıda: müşteri
 * isteğinden doğan kartlar hiçbir sütuna denk gelmeyen bir aşamaya yazılıyor ve panoda
 * kayboluyordu. Arayüz bu dosyadan okuyor. */
/**
 * ÇOK ŞUBELİ MARKALAR İÇİN ARA AŞAMA.
 *
 * Bir içerik dört şubede kullanılabiliyor ve şubeler farklı günlerde paylaşıyor. İlk şube
 * paylaştığında kart "Teslim Edildi"ye geçseydi Operasyon panosundan kaybolur, bekleyen
 * şubeler unutulurdu. "Onaylandı"da kalsaydı da stok düşmezdi — stok motoru kartın
 * aşamasına bağlı ("Onaylandı"dan çıkınca düşer).
 *
 * Bu aşama ikisini birden çözüyor: kart panoda GÖRÜNÜR kalıyor, stok ilk paylaşımda
 * düşüyor. Drive'a taşıma en sonda, tüm planlanan şubeler bitince yapılıyor — bu aşamanın
 * `ASAMA_KLASORU` eşlemesinde karşılığı BİLEREK yok, listede olmayan aşamada dosyaya
 * dokunulmuyor.
 *
 * ŞUBESİZ MARKALARDA HİÇ KULLANILMAZ: kart doğrudan "Onaylandı" → "Teslim Edildi" gider,
 * bugünkü davranış birebir aynı kalır.
 */
export const SUBE_PAYLASIM_ASAMASI = "Şubelerde Paylaşılıyor";

export const ASAMALAR_VIDEO = [
  "Çekim Planlandı", "Çekim Yapıldı", "Dosyalar Aktarıldı", "Edit Bekliyor",
  "Edit Yapılıyor", "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", SUBE_PAYLASIM_ASAMASI, "Teslim Edildi",
];
/* FOTOĞRAF akışı bilerek kısa: çekim yapılır, düzenlenir, kontrole çıkar. Video'daki
 * "Dosyalar Aktarıldı / Edit Bekliyor" ayrımı fotoğrafta bir işe yaramıyor. */
export const ASAMALAR_FOTOGRAF = [
  "Çekim Yapıldı", "Düzenleniyor", "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", SUBE_PAYLASIM_ASAMASI, "Teslim Edildi",
];
/* CAROUSEL — çoklu fotoğraf gönderisi. Akış Fotoğraf'la aynı şekle sahip ama AYRI bir
 * tablo: ileride Fotoğraf akışı değişirse Carousel sessizce onunla birlikte değişmesin.
 * Her kategori kendi tablosunun sahibi. */
export const ASAMALAR_CAROUSEL = [
  "Çekim Yapıldı", "Düzenleniyor", "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", SUBE_PAYLASIM_ASAMASI, "Teslim Edildi",
];
export const ASAMALAR_TASARIM = [
  "Talep Alındı", "Tasarım Bekliyor", "Tasarım Yapılıyor",
  "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", SUBE_PAYLASIM_ASAMASI, "Teslim Edildi",
];
/** Geriye dönük uyumluluk: kategorisiz eski kayıtlar Video akışını kullanır. */
export const ASAMALAR = ASAMALAR_VIDEO;

const ASAMA_TABLOSU = {
  "Video": ASAMALAR_VIDEO,
  "Fotoğraf": ASAMALAR_FOTOGRAF,
  "Carousel": ASAMALAR_CAROUSEL,
  "Grafik Tasarım": ASAMALAR_TASARIM,
};

export const asamaListesi = (kategori) => ASAMA_TABLOSU[kategori] || ASAMALAR_VIDEO;

/** Bir kategorinin ilk aşaması — yeni iş oluşturulurken kullanılır. */
export const ILK_ASAMA = (kategori) => asamaListesi(kategori)[0];

/** İşin bizzat yapıldığı aşama — dosya kontrole çıkmadan ÖNCE buraya yüklenir. */
export const YAPILIYOR_ASAMASI = {
  "Video": "Edit Yapılıyor",
  "Fotoğraf": "Düzenleniyor",
  "Carousel": "Düzenleniyor",
  "Grafik Tasarım": "Tasarım Yapılıyor",
};

/** Kategorisiz eski kayıtlar Video akışını kullanır. */
export const yapiliyorAsamasi = (kategori) => YAPILIYOR_ASAMASI[kategori] || YAPILIYOR_ASAMASI.Video;

/* KALDIRILAN ARA AŞAMALAR.
 *
 * Bir süre "… Yapıldı" diye ayrı bir sütun vardı: iş biter, kart oraya geçer, dosya orada
 * yüklenirdi. Fazlalık çıktı — dosya zaten "… Yapılıyor" aşamasında yüklenebiliyor ve kural
 * doğrudan kontrole geçişte uygulanıyor. Bir sütun uğruna herkesin fazladan tıklaması
 * anlamsızdı.
 *
 * O aşamada kalmış kartlar KAYBOLMAMALI: aşama adı artık hiçbir sütuna denk gelmediği için
 * kart panoda hiç görünmezdi. Bu yüzden okurken karşılığına çevriliyor. */
const KALDIRILAN_ASAMALAR = {
  "Edit Yapıldı": "Edit Yapılıyor",
  "Düzenleme Yapıldı": "Düzenleniyor",
  "Tasarım Yapıldı": "Tasarım Yapılıyor",
};

/** Kaldırılmış bir aşama adını güncel karşılığına çevirir; diğerlerine dokunmaz. */
export const asamaKarsiligi = (asama) => KALDIRILAN_ASAMALAR[asama] || asama;

/**
 * Bir iş listesindeki bozuk aşamaları düzeltir. Değişiklik yoksa aynı diziyi döndürür.
 *
 * İKİ AYRI ONARIM, İKİSİ DE AYNI SEBEPLE: pano sütunları kategorinin aşama listesinden
 * geliyor; listede olmayan bir aşamadaki kart HİÇBİR sütuna düşmüyor ve ekranda hiç
 * görünmüyor. Kayıt duruyor ama kimse göremiyor — en sinsi kayıp türü.
 *
 *  1. Kaldırılmış ara aşamalar ("Edit Yapıldı" gibi) karşılığına çevriliyor.
 *  2. Kategorisinde HİÇ BULUNMAYAN bir aşamadaki kart, o kategorinin ilk aşamasına
 *     alınıyor. Bunu gerektiren gerçek durum: müşteri isteğinden doğan kartlar kategori ne
 *     olursa olsun "Talep Alındı" aşamasına yazılıyordu — oysa o aşama yalnızca Grafik
 *     Tasarım akışında var. Reels ve Görsel istekleri bu yüzden panoda hiç görünmüyordu.
 */
export function asamalariDuzelt(isler) {
  if (!Array.isArray(isler)) return isler;
  let degisti = false;
  const yeni = isler.map((j) => {
    if (!j) return j;
    let d = asamaKarsiligi(j.asama);
    if (d && !asamaListesi(j.kategori).includes(d)) d = ILK_ASAMA(j.kategori);
    if (d === j.asama) return j;
    degisti = true;
    return { ...j, asama: d };
  });
  return degisti ? yeni : isler;
}

/**
 * KART KAPAĞI — medya değiştiğinde yeniden hesaplanır.
 *
 * SORUN: `editliDosyaLink` kartın "kapak" görseli gibi davranıyor (pano kartındaki küçük
 * resim, eski önizleme yolları ve Drive kullanmayan ekranlar hâlâ buna bakıyor). Yükleme
 * sırasında birinci slayta bağlanıyordu — ama SİLME sırasında hiç güncellenmiyordu.
 *
 * Sonuç: kullanıcı eski görseli silip yenisini yüklediğinde kartın küçük kapağında SİLİNEN
 * görsel kalmaya devam ediyordu. Drive'ın küçük resim adresi çöpe atılmış dosyayı bir süre
 * daha servis ettiği için kimse silinmiş olduğunu anlamıyordu.
 *
 * ELLE GİRİLEN BAĞLANTI KORUNUR. Kartta "Dosya bağlantılarını düzenle" alanı var; oraya
 * elle bir adres yazılmış olabilir. Kapağı körü körüne ezmek o adresi silerdi. Bu yüzden
 * yalnızca ESKİ KAPAK UYGULAMANIN KENDİ DOSYALARINDAN BİRİYSE değiştiriliyor.
 */
export function kapakBaglantisi(oncekiMedya, yeniMedya, mevcutLink) {
  const yeniKapak = guncelMedyalar({ medya: yeniMedya })[0];
  const yeniLink = (yeniKapak && yeniKapak.url) || "";

  /* Kapak yoksa yenisi neyse o. */
  if (!mevcutLink) return yeniLink;

  /* Mevcut kapak uygulamanın yüklediği dosyalardan birine mi ait? */
  const eskiler = Array.isArray(oncekiMedya) ? oncekiMedya : [];
  const uygulamanınMi = eskiler.some((m) => {
    if (!m) return false;
    if (m.url && m.url === mevcutLink) return true;
    return Boolean(m.dosyaId) && String(mevcutLink).includes(m.dosyaId);
  });

  /* Elle yazılmış bir adres — dokunma. */
  if (!uygulamanınMi) return mevcutLink;

  return yeniLink;
}

/* ------------------------------------------------------------------ */
/* KARTTA BİRDEN ÇOK DOSYA — SLOTLAR                                    */
/* ------------------------------------------------------------------ */
/**
 * NEDEN GEREKTİ: bir kart tek bir dosya taşıyabiliyordu. Oysa karosel (kaydırmalı) gönderide
 * 8 görsel birden paylaşılıyor ve aynı gönderinin bir de story boyutu hazırlanıyor. İkinci
 * dosya yüklendiğinde birincisi "eski versiyon" oluyordu — yani slaytlar birbirini eziyordu.
 *
 * ÇÖZÜM: medya kaydına `slot` eklendi. İki ayrı eksen artık karışmıyor:
 *
 *   slot     -> AYNI gönderinin farklı parçaları   ("1".."8", "story")
 *   versiyon -> AYNI parçanın revizyon geçmişi     (V1, V2, V3…)
 *
 * Yani 3. slaydın 2. versiyonu = { slot: "3", versiyon: 2 }.
 *
 * GERİYE DÖNÜK UYUMLULUK: eski kayıtlarda `slot` yok. Onlar "1" sayılır — tek dosyalı
 * kartlar hiçbir şey fark etmeden çalışmaya devam eder, veri göçü gerekmez.
 */

/** Aynı gönderinin story boyutu için ayrılmış slot adı. */
export const STORY_SLOT = "story";

/** En fazla kaç karosel slaydı — Instagram'ın sınırı 10, biz de onu esas alıyoruz. */
export const EN_FAZLA_SLAYT = 10;

/** Bir medya kaydının slotu. Eski kayıtlarda alan yok; onlar birinci slayt sayılır. */
export function medyaSlotu(m) {
  const s = String((m && m.slot) || "").trim();
  return s || "1";
}

/** Slotları sıralar: önce sayısal slaytlar (1,2,3…), en sonda story. */
function slotSirasi(slot) {
  if (slot === STORY_SLOT) return 10000;
  const n = Number(slot);
  return Number.isFinite(n) ? n : 9999;
}

/**
 * Kartın GÜNCEL dosyaları — her slot için o slotun en yüksek versiyonu, slot sırasına göre.
 *
 * Eski davranışta "güncel" tek bir dosyaydı (en yüksek versiyon). Artık her slaydın kendi
 * güncel hâli var; biri revize edilince diğerleri etkilenmiyor.
 */
export function guncelMedyalar(is) {
  const liste = Array.isArray(is && is.medya) ? is.medya.filter(Boolean) : [];
  const enIyi = new Map();
  for (const m of liste) {
    const slot = medyaSlotu(m);
    const mevcut = enIyi.get(slot);
    if (!mevcut || (Number(m.versiyon) || 0) > (Number(mevcut.versiyon) || 0)) enIyi.set(slot, m);
  }
  return [...enIyi.entries()]
    .sort((a, b) => slotSirasi(a[0]) - slotSirasi(b[0]))
    .map(([slot, m]) => ({ ...m, slot }));
}

/** Bir slotun eski versiyonları, yeniden eskiye. */
export function slotGecmisi(is, slot) {
  const hedef = String(slot || "1");
  return (Array.isArray(is && is.medya) ? is.medya.filter(Boolean) : [])
    .filter((m) => medyaSlotu(m) === hedef)
    .sort((a, b) => (Number(b.versiyon) || 0) - (Number(a.versiyon) || 0));
}

/** Bir slota yüklenecek sıradaki versiyon numarası. */
export function slotSonrakiVersiyon(is, slot) {
  return slotGecmisi(is, slot).reduce((e, m) => Math.max(e, Number(m.versiyon) || 0), 0) + 1;
}

/**
 * BİR KATEGORİDE EN FAZLA KAÇ SLAYT OLABİLİR.
 *
 * Fotoğraf TEK görsellik bir gönderi. Çoklu gönderi Carousel kategorisinin işi; ikisi
 * birden çoklu olduğunda "bu kaydırmalı gönderi mi, ayrı ayrı postlar mı" ayrımı kartta
 * kayboluyor ve stok da yanlış türe yazılıyordu (Fotoğraf → Görsel, oysa kaydırmalı
 * gönderi → Carousel).
 *
 * Story yuvası bu sınırın DIŞINDA: o ikinci bir görsel değil, aynı gönderinin story
 * boyutu. Fotoğraf kartına story eklenebilmeye devam ediyor.
 *
 * Tek yer: tarayıcı da sunucu da bunu kullanıyor. Kural yalnızca arayüzde olsaydı,
 * eski bir sekme ya da yeniden gönderilen bir istek sınırı aşabilirdi.
 */
export function enFazlaSlayt(kategori) {
  return kategori === "Fotoğraf" ? 1 : EN_FAZLA_SLAYT;
}

/** Kartın kategorisine göre slot geçerli mi — story her kategoride serbest. */
export function slotKategoriyeUygunMu(slot, kategori) {
  const s = String(slot || "").trim();
  if (s === STORY_SLOT) return true;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= enFazlaSlayt(kategori);
}

/** Boştaki ilk sayısal slot — yeni bir slayt eklenirken kullanılır. */
export function bosSlot(is) {
  const dolu = new Set(guncelMedyalar(is).map((m) => m.slot));
  const sinir = enFazlaSlayt(is && is.kategori);
  for (let i = 1; i <= sinir; i += 1) {
    if (!dolu.has(String(i))) return String(i);
  }
  return null;                                     // slaytlar dolu
}

/** Slot adı geçerli mi — sunucu tarayıcıdan geleni doğrulamak için kullanır. */
export function slotGecerliMi(slot) {
  const s = String(slot || "").trim();
  if (s === STORY_SLOT) return true;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= EN_FAZLA_SLAYT;
}

/** Slotun ekranda görünen adı. */
export function slotEtiketi(slot) {
  return slot === STORY_SLOT ? "Story boyutu" : `${slot}. görsel`;
}

/**
 * KARTIN TAŞINACAK DOSYALARI — aşama değişince Drive'da yeri değişecek olanlar.
 *
 * Karosel gönderide 8 slayt + story boyutu AYNI kartta duruyor; kart "Onaylandı"ya geçince
 * hepsinin birden taşınması gerekiyor. Eskiden yalnızca tek bir bağlantı taşınıyordu —
 * çok dosyalı kartlarda kalanlar eski klasörde unutulurdu.
 *
 * Yüklenmiş medya varsa her slotun GÜNCEL dosyası taşınır (eski versiyonlar yerinde kalır —
 * geçmiş, arşiv klasörünü kirletmesin). Hiç yüklenmiş medya yoksa elle yapıştırılmış
 * bağlantıya düşülür; yükleme sisteminden önce açılmış kartlar böyle çalışıyor.
 */
export function tasinacakDosyalar(is) {
  const guncel = guncelMedyalar(is);
  if (guncel.length > 0) {
    return guncel
      .filter((m) => m.dosyaId)
      .map((m) => ({ slot: m.slot, link: `https://drive.google.com/file/d/${m.dosyaId}/view` }));
  }
  const link = (is && (is.editliDosyaLink || is.dosyaLinki || is.hamDosyaLink)) || "";
  return link ? [{ slot: "1", link }] : [];
}

/** Dosya yüklenmeden GİRİLEMEYEN aşama. */
export const KAPILI_ASAMA = "Kontrol Bekliyor";

/**
 * Kartta müşteriye gösterilecek bir dosya var mı?
 *
 * Karta yüklenen dosya (medya dizisi) ya da elle yapıştırılmış bir bağlantı sayılır.
 * Bağlantının da sayılması bilinçli: Drive dışından gelen işler (WeTransfer) ve yükleme
 * sisteminden önce açılmış kartlar hâlâ bu alanı kullanıyor. Kuralın amacı "uygulamadan
 * yüklensin" değil, "müşterinin önüne bakacak bir şey olmadan kart çıkmasın".
 */
export function medyaVarMi(is) {
  if (!is) return false;
  if (Array.isArray(is.medya) && is.medya.length > 0) return true;
  return Boolean(is.editliDosyaLink);
}

/**
 * DOSYASIZ KONTROLE ÇIKMIŞ KARTLARI GERİ ALIR.
 *
 * Sunucu tarafındaki uygulama noktası. Kaydın TAMAMINI reddetmiyor — reddetmek, aynı
 * kayıttaki ilgisiz düzenlemeleri de çöpe atardı; bu projede tam olarak o yoldan veri
 * kaybı yaşandı. Onun yerine yalnızca kuralı delen kartın aşaması geri alınıyor ve karta
 * sebebi yazılıyor: kullanıcı ne olduğunu kartın geçmişinde görüyor.
 *
 * Yalnızca YENİ giren kartlara bakar; zaten "Kontrol Bekliyor"da duran eski kartlara
 * dokunmaz — geçmişte bu kural yokken oraya gelmiş olabilirler.
 */
export function dosyasizKontroleGirenleriGeriAl(oncekiIsler, sonrakiIsler, zaman) {
  const onceki = new Map((oncekiIsler || []).map((j) => [String(j.id), j]));
  let degisti = false;
  const duzeltilmis = (sonrakiIsler || []).map((j) => {
    if (j.asama !== KAPILI_ASAMA) return j;
    const eski = onceki.get(String(j.id));
    if (eski && eski.asama === KAPILI_ASAMA) return j;     // zaten oradaydı
    if (medyaVarMi(j)) return j;                            // dosyası var, kural sağlanıyor
    degisti = true;
    const geriAsama = asamaKarsiligi((eski && eski.asama) || yapiliyorAsamasi(j.kategori));
    return {
      ...j,
      asama: geriAsama,
      gecmis: [...(j.gecmis || []), {
        id: (j.gecmis || []).length + 1,
        tarih: zaman,
        yazan: "Sistem",
        aciklama: `Dosya yüklenmediği için kontrole gönderilemedi; kart "${geriAsama}" aşamasında kaldı.`,
      }],
    };
  });
  return degisti ? duzeltilmis : null;
}

/* ------------------------------------------------------------------ */
/* KART KLASÖRÜ — çok dosyalı gönderiler Drive'da dağılmasın              */
/* ------------------------------------------------------------------ */
/**
 * Carousel bir gönderide sekiz on slayt olabiliyor. Bunlar durum klasörüne tek tek
 * düştüğünde ONAYLANANLAR birkaç haftada yüzlerce dosyayla doluyor ve hangi karenin
 * hangi gönderiye ait olduğu ayırt edilemiyor. Bu yüzden Carousel kartının dosyaları
 * kendi klasörüne taşınıyor: ONAYLANANLAR/#124 Bowl Karosel/…
 *
 * Ad KART NUMARASIYLA başlıyor — aynı adla ikinci bir kart açılırsa klasörler
 * karışmasın diye. Numara Marcus OS'taki kart numarasının aynısı, iki taraf birebir
 * eşleşiyor.
 *
 * Diğer kategoriler için `null` döner ve dosyalar bugünkü gibi doğrudan durum
 * klasörüne gider — mevcut davranış değişmiyor.
 */
export const KLASORLU_KATEGORI = "Carousel";

export function kartKlasorAdi(is) {
  if (!is || is.kategori !== KLASORLU_KATEGORI) return null;
  if (is.id === undefined || is.id === null || is.id === "") return null;
  /* Eğik çizgi Drive'da klasör adında görsel olarak yol sanılıyor — temizleniyor. */
  const ad = String(is.icerikTuru || "").replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim();
  return ad ? `#${is.id} ${ad}` : `#${is.id}`;
}

/**
 * İKİ MEDYA LİSTESİNİ BİRLEŞTİRİR — yüklenen dosya kartta kaybolmasın.
 *
 * SORUN — ölçüldü: iki kişi aynı karta aynı anda slayt yüklüyor. İlk kaydeden yazıyor,
 * ikincisi 409 alıyor. İstemcinin çakışma kurtarması (`yeniKayitlariKoru`) yalnızca YENİ
 * KAYITLARI koruyor — yani yeni bir KART'ı. Var olan bir kartın içindeki yeni medya
 * girdisi bir "düzenleme" sayıldığı için sunucudaki hâlle değiştiriliyor ve ikinci
 * kişinin yüklediği dosya karttan kayboluyor. Dosya Drive'da duruyor ama hiçbir ekranda
 * görünmüyor — "yükleme tamamlandı dedi ama slayt yok" şikâyetinin sebebi bu.
 *
 * Aynı şey tek kullanıcıda da oluyor: yükleme sürerken gelen bir tazeleme kartı
 * sunucudaki hâliyle değiştiriyorsa yeni girdi gidiyor.
 *
 * ÇÖZÜM: dosya kimliği (`dosyaId`) Drive'da benzersiz. Yerel listede olup sunucuda
 * OLMAYAN bir dosya, kullanıcının az önce yüklediğidir; geri ekleniyor.
 *
 * SLOT ÇAKIŞMASI: iki tarayıcı da kendi kopyasına bakarak slot seçtiği için ikisi de
 * aynı slotu seçebiliyor. Geri eklenen dosyanın slotu doluysa boş bir slota alınıyor —
 * yoksa `guncelMedyalar` ikisinden birini gösterip diğerini gizlerdi.
 *
 * SİLİNEN DOSYA DİRİLTİLMEZ: taban listede VAR olup sunucuda YOK olan dosya başkası
 * tarafından silinmiştir. `yeniKayitlariKoru` ile aynı gerekçe.
 */
export function medyalariBirlestir(sunucuMedya, yerelMedya, tabanMedya, kategori) {
  const sunucu = Array.isArray(sunucuMedya) ? sunucuMedya.filter(Boolean) : [];
  const yerel = Array.isArray(yerelMedya) ? yerelMedya.filter(Boolean) : [];
  if (yerel.length === 0) return sunucu;

  const kimlik = (m) => String((m && m.dosyaId) || (m && m.url) || "");
  const sunucudakiler = new Set(sunucu.map(kimlik).filter(Boolean));
  const tabandakiler = new Set((Array.isArray(tabanMedya) ? tabanMedya : []).map(kimlik).filter(Boolean));

  const sonuc = [...sunucu];
  const dolu = new Set(sonuc.map((m) => `${medyaSlotu(m)}|${Number(m.versiyon) || 1}`));
  const sinir = enFazlaSlayt(kategori);

  for (const m of yerel) {
    const k = kimlik(m);
    if (!k) continue;
    if (sunucudakiler.has(k)) continue;          // zaten sunucuda
    if (tabandakiler.has(k)) continue;           // başkası SİLDİ — diriltme

    let slot = medyaSlotu(m);
    const versiyon = Number(m.versiyon) || 1;
    if (dolu.has(`${slot}|${versiyon}`)) {
      /* Story yuvası tek: çakışırsa yeni bir versiyon numarası alır, slot değişmez. */
      if (slot === STORY_SLOT) {
        let v = versiyon;
        while (dolu.has(`${slot}|${v}`)) v += 1;
        sonuc.push({ ...m, versiyon: v });
        dolu.add(`${slot}|${v}`);
        continue;
      }
      let bos = null;
      for (let i = 1; i <= sinir; i += 1) {
        if (![...dolu].some((x) => x.startsWith(`${i}|`))) { bos = String(i); break; }
      }
      /* Boş slot yoksa dosya yine de eklenir — kaybetmektense aynı slotta
       * yeni bir versiyon olarak durması iyidir. */
      if (bos) slot = bos;
      else {
        let v = versiyon;
        while (dolu.has(`${slot}|${v}`)) v += 1;
        sonuc.push({ ...m, versiyon: v });
        dolu.add(`${slot}|${v}`);
        continue;
      }
    }
    sonuc.push({ ...m, slot });
    dolu.add(`${slot}|${versiyon}`);
  }
  return sonuc;
}
