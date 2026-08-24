/**
 * STOK MUTABAKATI — "kayıtlı sayı, kartlarla uyuşuyor mu?"
 *
 * Stok bugün SAKLANAN bir sayaç: kart onaya girince artıyor, çıkınca azalıyor.
 * Sayaç ile kartlar arasında sapma oluşabiliyor — bu oturumda üç ayrı sapma yolu
 * bulunup kapatıldı (silinen kartın öksüz planı, plan silmenin geri almaması,
 * şube–marka tutarsızlığı). Sapmanın kendisini GÖRMENİN bir yolu yoktu.
 *
 * Bu modül kartlardan OLMASI GEREKENİ hesaplar ve kayıtlı sayıyla karşılaştırır.
 * Hiçbir şey yazmaz, hiçbir şey düzeltmez — yalnızca farkı söyler.
 *
 * KURALLAR — stok motorunun davranışından çıkarıldı, varsayımdan değil:
 *
 *   Genel stok  = o türden "Onaylandı" aşamasındaki kart sayısı.
 *                 Motor onaya girişte +1, çıkışta −1 yapıyor; "Şubelerde
 *                 Paylaşılıyor" da bir çıkış olduğu için oradaki kart genel
 *                 stokta SAYILMAZ (ilk paylaşımda düşmüştü).
 *
 *   Şube stoğu  = o şubenin kullanabildiği, "Onaylandı" ya da "Şubelerde
 *                 Paylaşılıyor" aşamasındaki kartlar, EKSİ o şubenin zaten
 *                 paylaştıkları. Çok şubelilikte içerik bir şubede paylaşılsa
 *                 bile diğerlerinde kullanılabilir kalıyor.
 */
import { paylasimTuru, PAYLASIM_TURLERI, stokAnahtari } from "./stok.js";
import { SUBE_PAYLASIM_ASAMASI } from "./asamalar.js";
import { markaninSubeleri, kullanabilenSubeler, subeStokAnahtari, icerikSubeDurumu } from "./sube-kullanimi.js";
import { markaEslestirici } from "./marka-kilidi.js";

const ONAY = "Onaylandı";

/** Bir markanın kartları — kartlar markayı ADIYLA saklıyor. */
function markaninKartlari(isler, clients, marka) {
  const esit = markaEslestirici(clients, marka.ad);
  return (isler || []).filter((j) => j && esit(j.marka));
}

/**
 * Kartlardan olması gereken stok tablosu.
 * @returns { [anahtar]: sayi } — `stoklar` ile aynı anahtar düzeni
 */
export function kartlaraGoreStok(veri) {
  const d = veri && typeof veri === "object" ? veri : {};
  const clients = d.clients || [];
  const isler = d.cekimIsleri || [];
  const planlar = d.haftalikPaylasimlar || [];
  const subeler = d.subeler || [];
  const sonuc = {};

  clients.forEach((c) => {
    if (!c) return;
    const kartlar = markaninKartlari(isler, clients, c);
    const kendiSubeleri = markaninSubeleri(subeler, c.id);

    PAYLASIM_TURLERI.forEach((tur) => {
      const oTur = kartlar.filter((j) => paylasimTuru(j) === tur);

      /* GENEL: yalnızca onayda duranlar. */
      const genel = oTur.filter((j) => j.asama === ONAY).length;
      if (genel > 0) sonuc[stokAnahtari(c.id, tur)] = genel;

      /* ŞUBE: kullanabildiği ve o şubede henüz paylaşılmamış olanlar. */
      kendiSubeleri.forEach((sb) => {
        const sayi = oTur.filter((j) =>
          (j.asama === ONAY || j.asama === SUBE_PAYLASIM_ASAMASI)
          && kullanabilenSubeler(j, subeler, c.id).some((x) => String(x.id) === String(sb.id))
          && icerikSubeDurumu(j.id, sb.id, planlar) !== "paylasildi").length;
        if (sayi > 0) sonuc[subeStokAnahtari(c.id, sb.id, tur)] = sayi;
      });
    });
  });
  return sonuc;
}

/**
 * MUTABAKAT SATIRLARI — yalnızca FARK olanlar.
 *
 * Her satır insan tarafından okunabilir olmalı: hangi marka, hangi tür, hangi şube,
 * kayıtlı kaç, kartlara göre kaç. "Düzelt" düğmesi bu farkı kullanır.
 */
export function stokMutabakati(veri) {
  const d = veri && typeof veri === "object" ? veri : {};
  const kayitli = d.stoklar && typeof d.stoklar === "object" ? d.stoklar : {};
  const gereken = kartlaraGoreStok(d);
  const clients = d.clients || [];
  const subeler = d.subeler || [];

  const markaAdi = (id) => (clients.find((c) => String(c.id) === String(id)) || {}).ad || `#${id}`;
  const subeAdi = (id) => (subeler.find((s) => String(s.id) === String(id)) || {}).ad || null;

  const anahtarlar = [...new Set([...Object.keys(kayitli), ...Object.keys(gereken)])];
  const satirlar = [];

  anahtarlar.forEach((anahtar) => {
    const k = Number(kayitli[anahtar]) || 0;
    const g = Number(gereken[anahtar]) || 0;
    if (k === g) return;

    /* Anahtar iki biçimde: `clientId_tur` ya da `clientId_subeId_tur`.
     * Tür adı sondadır ve tür listesinden tanınır — şube kimliği alt çizgi
     * içerebileceği için baştan bölmek güvenilmez. */
    const tur = PAYLASIM_TURLERI.find((t) => anahtar.endsWith(`_${t}`));
    if (!tur) return;                                   // tanınmayan anahtar — dokunma
    const govde = anahtar.slice(0, anahtar.length - tur.length - 1);
    const alt = govde.indexOf("_");
    const clientId = alt === -1 ? govde : govde.slice(0, alt);
    const subeId = alt === -1 ? null : govde.slice(alt + 1);

    satirlar.push({
      anahtar, clientId, subeId, tur,
      marka: markaAdi(clientId),
      sube: subeId ? subeAdi(subeId) : null,
      /* Şube kaydı silinmişse adı bulunamaz — anahtar öksüz kalmıştır. */
      oksuz: Boolean(subeId && !subeAdi(subeId)),
      kayitli: k, gereken: g, fark: g - k,
    });
  });

  satirlar.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark));
  return {
    satirlar,
    toplamFark: satirlar.reduce((t, x) => t + Math.abs(x.fark), 0),
    fazlaSayisi: satirlar.filter((x) => x.fark < 0).length,
    eksikSayisi: satirlar.filter((x) => x.fark > 0).length,
  };
}
