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
export const PAYLASIM_TURLERI = ["Görsel", "Video", "Reels", "Story", "Carousel", "Tasarım"];

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
  if (!is) return "Görsel";
  if (PAYLASIM_TURLERI.includes(is.paylasimTuru)) return is.paylasimTuru;

  const ad = trKucult(is.icerikTuru);
  if (/\breels?\b|\breel\b/.test(ad)) return "Reels";
  if (/\bstory\b|\bstori\b|hikaye/.test(ad)) return "Story";
  if (/carousel|karusel|carrousel/.test(ad)) return "Carousel";
  /* VİDEO, TASARIM'DAN ÖNCE: "video tasarımı" hareketli bir iştir, paylaşımda video olarak
   * kullanılır. Sıra ters olsaydı Tasarım stoğuna yazılırdı. */
  if (/\bvideo\b/.test(ad)) return "Video";
  if (/tasarım|tasarim|dizayn|design/.test(ad)) return "Tasarım";
  if (/görsel|gorsel|post/.test(ad)) return "Görsel";

  /* İçerik adı bir şey söylemiyorsa kategoriye düşülür. Fotoğraf'ın çıktısı görsel,
   * Video'nunki video, Grafik Tasarım'ınki tasarımdır. */
  const kategori = trKucult(is.kategori);
  if (kategori === "video") return "Video";
  if (/tasarım|tasarim/.test(kategori)) return "Tasarım";
  return "Görsel";
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
export function onaylananlaraGoreStok(oncekiIsler, sonrakiIsler, mevcutStoklar, clients, atla) {
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
    return { ...j, stokSayildi: onaydaMi };
  });

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
