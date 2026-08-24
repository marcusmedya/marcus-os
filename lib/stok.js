import { kategoriEsle, turEsle } from "./kategori.js";
import { kullanabilenSubeler, subeStokAnahtari } from "./sube-kullanimi.js";
import { SUBE_PAYLASIM_ASAMASI } from "./asamalar.js";
/**
 * STOK — ONAYLANAN İŞTEN PAYLAŞIMA.
 *
 * Stok "elde hazır bekleyen içerik" sayısıdır. İki uç arasında yaşar:
 *   müşteri onaylar  -> stok ARTAR   (paylaşılmaya hazır bir içerik daha var)
 *   paylaşılır       -> stok AZALIR  (o içerik kullanıldı)
 *
 * Önceden yalnızca ikinci yarısı otomatikti; artış elle "+" düğmesiyle giriliyordu. İki
 * panel ayrı ayrı sayı tuttuğu için stok gerçeği yansıtmıyordu.
 *
 * ÇİFT SAYMAYA KARŞI: kartın üstünde `stokSayildi` işareti tutuluyor. Kart onaya girdiğinde
 * bir kez artırılır; onaydan çıktığında (ister geri alınsın ister teslim edilsin) bir kez
 * azaltılır. İşaret olmadan aynı kart her kayıtta yeniden sayılırdı.
 */

const trKucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/**
 * Paylaşım panelindeki tür adları — stok anahtarları bunlarla üretiliyor.
 *
 * TEK KAYNAK: bu liste eskiden src/App.jsx'te de ayrıca yazılıydı. İki kopya, birine tür
 * eklendiğinde diğerinin sessizce geride kalmasına açıktı — stok sayılır ama panelde satırı
 * hiç görünmezdi. Arayüz artık bunu içeri alıyor.
 */
/* ÜÇ TÜR. Eskiden altıydı (Görsel/Video/Reels/Story/Carousel/Tasarım) ve tür seçimi
 * pratikte tahmine kalıyordu; aynı işteki iki kart farklı satırlara yazılabiliyordu.
 * Eski adlar `lib/kategori.js` üzerinden okuma anında bunlara eşleniyor — belgedeki
 * kayıtlara dokunulmuyor. */
export const PAYLASIM_TURLERI = ["Reels", "Post", "Carousel"];

export const stokAnahtari = (clientId, tur) => `${clientId}_${tur}`;

/** Kartın onaylanmış sayıldığı aşama. */
export const ONAY_ASAMASI = "Onaylandı";

/**
 * KARTIN PAYLAŞIM TÜRÜ.
 *
 * Kartta iki ayrı bilgi var ve ikisi de tek başına yetmiyor:
 *   kategori    -> Video / Fotoğraf / Grafik Tasarım  (işin nasıl üretildiği)
 *   icerikTuru  -> serbest metin: "Reels 3", "Kokteyl Reels", "Görsel 4"…
 *
 * Paylaşım stoğu ise Reels / Story / Carousel / Video / Görsel / Tasarım ekseninde
 * tutuluyor. Bir
 * Reels'in kategorisi de "Video"dur — kategoriye bakmak Reels'i Video stoğuna yazardı.
 * Bu yüzden önce içerik adında tür aranıyor, bulunamazsa kategoriye düşülüyor.
 *
 * Kartta açıkça `paylasimTuru` yazılıysa o kullanılır — tahmin son çare.
 */
export function paylasimTuru(is) {
  if (!is) return "Post";
  /* Kartta AÇIKÇA seçilmişse tahmin hiç çalışmaz. Eski bir tür adı yazılıysa
   * (belgede "Görsel" duran kartlar var) karşılığına eşlenir. */
  if (is.paylasimTuru) {
    const secili = turEsle(is.paylasimTuru);
    if (PAYLASIM_TURLERI.includes(secili)) return secili;
  }

  const ad = trKucult(is.icerikTuru);
  if (/\breels?\b|\breel\b/.test(ad)) return "Reels";
  if (/carousel|karusel|carrousel/.test(ad)) return "Carousel";
  /* VİDEO REELS'E SAYILIR: ajansın çektiği video içerik pratikte Reels olarak
   * paylaşılıyor. Ayrı bir "Video" stoğu yok. */
  if (/\bvideo\b/.test(ad)) return "Reels";
  /* Story ayrı bir stok satırı DEĞİL — o ikinci bir içerik değil, aynı gönderinin
   * story boyutu; kartta zaten kendi yuvası var. */
  if (/\bstory\b|\bstori\b|hikaye/.test(ad)) return "Post";
  if (/tasarım|tasarim|dizayn|design/.test(ad)) return "Post";
  if (/görsel|gorsel|post/.test(ad)) return "Post";

  /* Ad bir şey söylemiyorsa kategoriye düşülüyor — kategori zaten üç türden biri. */
  return kategoriEsle(is.kategori);
}


/**
 * ŞUBE STOĞU — çok şubeli markalarda kart onayı her şubenin sayısını besler.
 *
 * Kullanıcının seçtiği model: bir içerik onaylanınca onu KULLANABİLEN her şubenin stoğu
 * +1 olur. Genel içerik dört şubeyi birden besler; şubeye özel içerik yalnızca kendi
 * şubesini. Şube o içeriği paylaşınca kendi sayısı düşer (bkz. api/paylasim.js).
 *
 * BUGÜNKÜ DAVRANIŞ KORUNUYOR: `subeler` verilmezse ya da markanın şubesi yoksa hiçbir şey
 * yapılmaz. Şube stoğu bugüne kadar yalnızca elle yönetiliyordu; elle girilmiş sayılar
 * olduğu yerde kalıyor, üzerine ekleniyor.
 */
function subeStogunuIsle(stoklar, is, clientId, tur, yon, subeler, oncekiAsama) {
  if (!Array.isArray(subeler) || subeler.length === 0) return;

  /* ŞUBE PAYLAŞIMI YÜZÜNDEN OLAN GEÇİŞLERDE ŞUBELERE DOKUNULMAZ.
   *
   * Kart "Onaylandı"dan çıkarken bu fonksiyon normalde TÜM şubeleri düşürür — içerik artık
   * hiçbir yerde kullanılamaz demektir (onay geri alındı ya da kart silindi).
   *
   * Ama çıkışın sebebi BİR ŞUBENİN PAYLAŞIMIYSA bu yanlış olur: yalnızca o şube kullandı,
   * diğerleri hâlâ bekliyor. O şubenin düşümünü paylaşım ucu kendisi yapıyor
   * (api/paylasim.js). Ölçüldü: bu ayrım olmadan Lara paylaşınca dört şubenin de stoğu
   * düşüyordu; geri almada ise Lara iki kez artıyordu.
   *
   * Ayrım geçişin diğer ucuna bakarak yapılıyor: "Şubelerde Paylaşılıyor" varsa bu bir
   * şube hareketidir, onay değişimi değil. */
  const asamalar = [is && is.asama, oncekiAsama];
  if (asamalar.includes(SUBE_PAYLASIM_ASAMASI)) return;
  const hedefler = kullanabilenSubeler(is, subeler, clientId);
  hedefler.forEach((sube) => {
    const anahtar = subeStokAnahtari(clientId, sube.id, tur);
    stoklar[anahtar] = Math.max(0, (stoklar[anahtar] || 0) + yon);
  });
}

/**
 * ONAYA GİREN / ONAYDAN ÇIKAN KARTLARA GÖRE STOĞU GÜNCELLER.
 *
 * Değişiklik yoksa null döner — gereksiz yazma olmasın.
 *
 * `atla(is)` verilirse o kartlar hesaba katılmaz. Paylaşım paneli bunu kullanıyor: orada
 * stok düşümünü planın kendisi yapıyor, kart geçişi de düşürseydi aynı içerik iki kez
 * düşerdi.
 */
export function onaylananlaraGoreStok(oncekiIsler, sonrakiIsler, mevcutStoklar, clients, atla, subeler) {
  const onceki = new Map((oncekiIsler || []).map((j) => [String(j.id), j]));
  const markaId = (marka) => {
    const c = (clients || []).find((x) => trKucult(x.ad) === trKucult(marka));
    return c ? c.id : null;
  };

  const stoklar = { ...(mevcutStoklar || {}) };
  let degisti = false;
  const isaretli = [];

  const isler = (sonrakiIsler || []).map((j) => {
    if (!j) return j;
    if (typeof atla === "function" && atla(j)) return j;

    const onaydaMi = j.asama === ONAY_ASAMASI;

    /* BU ÖZELLİK GELMEDEN ÖNCE ONAYLANMIŞ KARTLAR.
     *
     * Onların üstünde `stokSayildi` yok. İşaretsiz sayılırlarsa, paylaşıldıklarında stok
     * düşmez ve sayı gerçeğin üstünde kalır — kimse fark etmeden. Oysa o içerikler zaten
     * elle girilen stoğun içinde temsil ediliyor. Bu yüzden "işaret yoksa ÖNCEKİ aşamaya
     * bak" diyoruz: kart daha önce de onaydaysa sayılmış kabul edilir. */
    const oncekiIs = onceki.get(String(j.id));
    const sayildiMi = j.stokSayildi === undefined
      ? Boolean(oncekiIs && oncekiIs.asama === ONAY_ASAMASI)
      : j.stokSayildi === true;

    if (onaydaMi === sayildiMi) {
      /* ŞUBE KAPSAMI ONAYDAN SONRA DEĞİŞTİYSE.
       *
       * Kart onayda kalırken "hangi şubeler kullanabilir" seçimi değişebiliyor.
       * Aşama değişmediği için aşağıdaki geçiş yolu hiç çalışmıyor; kapsam dışına
       * çıkarılan şubelerde onay anında eklenmiş +1 olduğu yerde kalıyordu. Sonuç:
       * hiçbir zaman kullanamayacağı bir içerik için stok gösteren şube — kimse fark
       * etmeden. Fark neyse o uygulanır: çıkarılan şubeden düşer, eklenen şubeye eklenir.
       *
       * O şube içeriği ÇOKTAN paylaştıysa payı zaten düşmüştü; ikinci düşüş `max(0, …)`
       * ile sınırlı kalır. Paylaşılmış bir içeriği o şubeye kapatmak zaten çelişkili
       * bir girdi — sayıyı eksiye taşımaması yeterli. */
      if (onaydaMi && oncekiIs && Array.isArray(subeler) && subeler.length > 0) {
        const kapsamCid = markaId(j.marka);
        if (kapsamCid !== null) {
          const eskiKapsam = new Set(kullanabilenSubeler(oncekiIs, subeler, kapsamCid).map((x) => String(x.id)));
          const yeniKapsam = new Set(kullanabilenSubeler(j, subeler, kapsamCid).map((x) => String(x.id)));
          const kapsamTuru = paylasimTuru(j);
          const uygula = (subeId, yon) => {
            const a = subeStokAnahtari(kapsamCid, subeId, kapsamTuru);
            stoklar[a] = Math.max(0, (stoklar[a] || 0) + yon);
            degisti = true;
          };
          eskiKapsam.forEach((id) => { if (!yeniKapsam.has(id)) uygula(id, -1); });
          yeniKapsam.forEach((id) => { if (!eskiKapsam.has(id)) uygula(id, 1); });
        }
      }

      // Durum değişmedi ama işaret eksikse yazılsın — bir daha tahmin etmeye gerek kalmasın.
      if (j.stokSayildi === undefined && onaydaMi) { degisti = true; return { ...j, stokSayildi: true }; }
      return j;
    }

    const cid = markaId(j.marka);
    if (cid === null) return j;                    // markası tanınmıyorsa dokunma

    const tur = paylasimTuru(j);
    const anahtar = stokAnahtari(cid, tur);
    const yeni = Math.max(0, (stoklar[anahtar] || 0) + (onaydaMi ? 1 : -1));
    stoklar[anahtar] = yeni;
    degisti = true;
    isaretli.push({ isId: j.id, tur, yon: onaydaMi ? 1 : -1, yeniStok: yeni });
    subeStogunuIsle(stoklar, j, cid, tur, onaydaMi ? 1 : -1, subeler, oncekiIs && oncekiIs.asama);
    return { ...j, stokSayildi: onaydaMi };
  });

  /* SİLİNEN KARTLAR — DİZİYİ GEZMEK YETMİYOR.
   *
   * Yukarıdaki döngü `sonrakiIsler` üzerinde dönüyor; silinen kart orada YOK, bu yüzden hiç
   * ziyaret edilmiyordu. Sonuç: onaydaki bir kartı silmek stoğu olduğu yerde bırakıyordu.
   * Ölçüldü — stok 2'de kalıyordu, 1'e düşmesi gerekirken. Hiçbir uyarı çıkmıyordu.
   *
   * Yalnızca SAYILMIŞ kartlar düşülür: "Teslim Edildi"deki bir kart zaten o aşamaya geçerken
   * düşülmüştü, silinince ikinci kez düşerse stok eksiye doğru kayardı.
   *
   * GÜVENLİK FRENİ — ORANLA DEĞİL, SAYIYLA.
   *
   * İlk hâlinde uygulamanın başka yerlerindeki %60 eşiği kullanılmıştı; ölçünce iki karttan
   * birini silmenin bile freni tetiklediği görüldü — yani düzeltme günlük kullanımda hiç
   * çalışmıyordu. Oran, kart silme için yanlış ölçü.
   *
   * Doğru soru "yüzde kaçı gitti" değil, "bir kayıtta kaç kart birden yok oldu". Tek tek
   * silmek olağan; bir kayıtta düzinelerce onaylı kartın kaybolması ise silme değil, bayat
   * ya da eksik bir gönderi işaretidir. Öyle bir durumda asıl alarm zaten kartların
   * kendisidir; stoğu da sessizce boşaltmayalım. */
  const TOPTAN_KAYIP_SINIRI = 20;
  const sonrakiKimlikler = new Set((sonrakiIsler || []).filter(Boolean).map((j) => String(j.id)));
  const kaybolanlar = (oncekiIsler || []).filter((j) => j && !sonrakiKimlikler.has(String(j.id)));
  const toptanKayipSupheli = kaybolanlar.length > TOPTAN_KAYIP_SINIRI;

  if (!toptanKayipSupheli) {
    for (const eski of kaybolanlar) {
      if (typeof atla === "function" && atla(eski)) continue;

      /* Kart sayılmış mıydı? İşaret yoksa aşamasına bakılır — işaret bu özellikten önce
       * açılmış kartlarda yok. */
      const sayilmisti = eski.stokSayildi === undefined
        ? eski.asama === ONAY_ASAMASI
        : eski.stokSayildi === true;
      if (!sayilmisti) continue;

      const cid = markaId(eski.marka);
      if (cid === null) continue;

      const tur = paylasimTuru(eski);
      const anahtar = stokAnahtari(cid, tur);
      const yeni = Math.max(0, (stoklar[anahtar] || 0) - 1);
      stoklar[anahtar] = yeni;
      degisti = true;
      isaretli.push({ isId: eski.id, tur, yon: -1, yeniStok: yeni, silindi: true });
      /* Kart silinince şube stokları da düşmeli — yoksa silinen içerik her şubede
       * "hazır" görünmeye devam ederdi. */
      subeStogunuIsle(stoklar, eski, cid, tur, -1, subeler, eski.asama);
    }
  }

  return degisti ? { stoklar, cekimIsleri: isler, degisenler: isaretli } : null;
}

/**
 * SUNUCUNUN HESAPLADIĞI STOĞU TARAYICIYA İŞLER.
 *
 * Stok artışını sunucu hesaplıyor (kartın türü, çift sayma koruması, marka eşleşmesi —
 * hiçbiri tarayıcıya bırakılamaz). Ama yanıt yalnızca `_v` taşıyordu: kart onaylanınca
 * stok gerçekten artıyor, Paylaşımlar panelindeki sayı ise sayfa yenilenene kadar ESKİ
 * hâlinde kalıyordu. "Onayladım, stok artmadı" görüntüsünün sebebi buydu.
 *
 * `stokSayildi` işaretleri de buradan geliyor: tarayıcının kopyası sunucununkiyle aynı
 * kalsın, bir sonraki kayıtta aynı kart yeniden sayılmaya çalışılmasın.
 */
export function stokYanitiniUygula(veri, yanit) {
  if (!veri || !yanit) return veri;
  const yeni = { ...veri };
  if (typeof yanit._v === "number") yeni._v = yanit._v;

  const stok = yanit.stok;
  if (!stok) return yeni;

  if (stok.stoklar && typeof stok.stoklar === "object") yeni.stoklar = stok.stoklar;

  const isaret = new Map((stok.isaretlenen || []).map((x) => [String(x.isId), x.yon > 0]));
  if (isaret.size > 0) {
    yeni.cekimIsleri = (veri.cekimIsleri || []).map((j) =>
      (j && isaret.has(String(j.id))) ? { ...j, stokSayildi: isaret.get(String(j.id)) } : j);
  }
  return yeni;
}


/* ================================================================
 * ESKİ STOK ANAHTARLARINI YENİ TÜRLERE TOPLA — OKUMA ANINDA.
 *
 * Belgede `1_Görsel`, `1_Story`, `1_Tasarım`, `1_Video` gibi anahtarlar var (43 markanın
 * geçmişi). Türler üçe indi ama kayıtlara dokunulmuyor; bu yüzden okuyan her yer eski
 * anahtarları karşılıklarına toplayarak görür. Toplanmasaydı bütün markaların stoğu
 * sıfır görünürdü.
 *
 * ŞUBE ANAHTARLARI DA (`clientId_subeId_tur`) toplanıyor — orada da eski tür adları var.
 *
 * DİKKAT — BU TOPLAMA KALICI ÇÖZÜM DEĞİL: eski anahtar hiç DÜŞMEZ. Paylaşım yeni
 * anahtarı azaltır, eskisi olduğu yerde kalır ve sayı zamanla gerçeğin üstünde kalırdı.
 * Bu yüzden stok düzeltmesi (Drive denetimi / mutabakat) yazarken o markanın eski
 * anahtarlarını SİLİYOR. Bir düzeltme turundan sonra toplama işlevsiz kalır.
 * ================================================================ */

/** Bir stok anahtarını çözer: { clientId, subeId, tur } — tanınmazsa null. */
export function stokAnahtariniCoz(anahtar) {
  const parcalar = String(anahtar || "").split("_");
  if (parcalar.length < 2) return null;
  const tur = parcalar[parcalar.length - 1];
  const clientId = parcalar[0];
  const subeId = parcalar.length >= 3 ? parcalar.slice(1, -1).join("_") : null;
  return { clientId, subeId, tur };
}

/** Eski tür adlarını yeni türlere toplar; eski anahtarları çıkarır. */
export function stoklariBirlestir(stoklar) {
  const kaynak = stoklar || {};
  const sonuc = {};
  Object.keys(kaynak).forEach((anahtar) => {
    const c = stokAnahtariniCoz(anahtar);
    if (!c) { sonuc[anahtar] = kaynak[anahtar]; return; }
    const yeniTur = turEsle(c.tur);
    if (!PAYLASIM_TURLERI.includes(yeniTur)) { sonuc[anahtar] = kaynak[anahtar]; return; }
    const yeniAnahtar = c.subeId ? `${c.clientId}_${c.subeId}_${yeniTur}` : `${c.clientId}_${yeniTur}`;
    sonuc[yeniAnahtar] = (Number(sonuc[yeniAnahtar]) || 0) + (Number(kaynak[anahtar]) || 0);
  });
  return sonuc;
}

/** Bir markanın ESKİ tür anahtarları — düzeltme yazarken silinsinler diye. */
export function eskiTurAnahtarlari(stoklar, clientId) {
  return Object.keys(stoklar || {}).filter((anahtar) => {
    const c = stokAnahtariniCoz(anahtar);
    if (!c || String(c.clientId) !== String(clientId)) return false;
    return !PAYLASIM_TURLERI.includes(c.tur) && Boolean(turEsle(c.tur));
  });
}
