/* ------------------------------------------------------------------ */
/* MÜŞTERİ HESAP ÖZETİ (EKSTRE)                                        */
/* ------------------------------------------------------------------ */
/**
 * Müşteriye verilecek "ne tahakkuk etti, ne fatura edildi, ne ödendi, ne kaldı"
 * dökümünü ay ay üretir. Yazdırılabilir belge bunun üzerine kuruluyor.
 *
 * ÜÇ KAVRAM BİRBİRİNE KARIŞMAMALI — karışırsa müşteriye YANLIŞ BORÇ gösterilir:
 *
 *   TAHAKKUK  o ayın hizmet bedeli. Kaynağı `ayinUcreti` — yani o ayda YÜRÜRLÜKTE olan
 *             ücret, bugünkü değil. Ücret sonradan düşmüş bir markada bugünküyle
 *             hesaplamak geçmiş ayları da düşürür ve tahsil edilmiş para "fazla ödeme"
 *             görünür.
 *   FATURA    tahakkukun BELGELENEN kısmı. Tahakkuka EKLENMEZ, onun içindedir.
 *             Eklenseydi faturalı bir ay iki kez borçlandırılırdı.
 *   TAHSİLAT  o aya işlenmiş ödeme kayıtları.
 *
 * BAKİYE = TAHAKKUK − TAHSİLAT. Fatura bakiyeye girmez; yalnızca "bu ayın şu kadarı şu
 * faturayla belgelendi" bilgisini taşır.
 *
 * Ödeme kayıtları zaten AY taşıyor (`odemeKayitlari[].ay`), bu yüzden ekstrenin birimi de
 * ay. Ödemeler tek tek faturalara BAĞLANMIYOR — böyle bir bağ veride yok; olmayan bir
 * eşleştirmeyi uydurmak, müşterinin belgesinde doğrulanamayan bir iddia olurdu.
 */
import { ayinUcreti, ayinDagilimi } from "./marka-ucreti.js";

const sayi = (x) => Number(x) || 0;

/** "2025-1" gibi tek haneli ayları "2025-01"e çevirir; geçersizse null. */
export function ayNormalle(deger) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(deger || "").trim());
  if (!m) return null;
  const ay = Number(m[2]);
  if (ay < 1 || ay > 12) return null;
  return `${m[1]}-${String(ay).padStart(2, "0")}`;
}

/** İki ay arasındaki (ikisi dahil) ay anahtarları. Ters aralık BOŞ döner. */
export function aylariListele(baslangicAy, bitisAy) {
  const bas = ayNormalle(baslangicAy);
  const bit = ayNormalle(bitisAy);
  if (!bas || !bit || bas > bit) return [];
  const liste = [];
  let [y, a] = bas.split("-").map(Number);
  const [sy, sa] = bit.split("-").map(Number);
  /* Sonsuz döngüye karşı üst sınır: 50 yıl. Bozuk bir tarih girildiğinde tarayıcının
   * kilitlenmesi, ekranda hata görmekten çok daha kötü. */
  for (let i = 0; i < 600; i++) {
    liste.push(`${y}-${String(a).padStart(2, "0")}`);
    if (y === sy && a === sa) break;
    a++; if (a > 12) { a = 1; y++; }
  }
  return liste;
}

/** Müşterinin ekstresinin varsayılan başlangıcı: kayıtlı başlangıç ayı, yoksa en eski
 * hareket (ödeme ya da fatura). Hiçbiri yoksa null — çağıran karar verir. */
export function varsayilanBaslangic(client) {
  const bas = ayNormalle(client && client.baslangic);
  if (bas) return bas;
  const aylar = [
    ...((client && client.odemeKayitlari) || []).map((k) => ayNormalle(k && k.ay)),
    ...((client && client.faturalar) || []).map((f) => ayNormalle(f && f.ay)),
  ].filter(Boolean).sort();
  return aylar.length ? aylar[0] : null;
}

/**
 * Ay ay ekstre.
 *
 * `hareketsizAylariAtla` (varsayılan açık): tahakkuku, faturası ve ödemesi olmayan ay
 * listeye girmez. Donmuş ya da yeni başlamış markada sayfalarca "0 ₺" satırı basmak
 * belgeyi okunmaz yapıyor.
 */
export function ekstreUret(client, { baslangicAy, bitisAy, hareketsizAylariAtla = true } = {}) {
  const aylar = aylariListele(baslangicAy, bitisAy);
  const odemeler = (client && client.odemeKayitlari) || [];
  const faturalar = (client && client.faturalar) || [];

  /* MÜŞTERİNİN BAŞLAMADIĞI AYA BEDEL YAZILMAZ.
   *
   * Ücret dönemlerinin ilki `0000-00` ile başlıyor ("geçmişin tamamı") — o olmadan ücret
   * değişince geçmiş aylar yeni tutara kayardı. Ama bu, tarihi geriye doğru sorulduğunda
   * markanın HİÇ ÇALIŞMADIĞI aylara da bedel yazılması demek: ölçüldü, Haziran 2026'da
   * başlayan marka 2020'den beri borçlu çıkıyordu. Müşteriye giden bir belgede bu, olmayan
   * bir alacağın iddia edilmesi olurdu.
   *
   * O aylardaki ödeme/fatura kayıtları YİNE gösterilir — kayıt varsa gerçekten olmuştur;
   * gizlenmesi başka bir yanlış olurdu. */
  const baslangic = ayNormalle(client && client.baslangic);

  const satirlar = aylar.map((ay) => {
    const ayOdemeleri = odemeler.filter((k) => ayNormalle(k && k.ay) === ay);
    const ayFaturalari = faturalar.filter((f) => ayNormalle(f && f.ay) === ay);
    const tahakkuk = (baslangic && ay < baslangic) ? 0 : ayinUcreti(client, ay);
    const tahsilat = ayOdemeleri.reduce((s, k) => s + sayi(k.tutar), 0);
    const faturaliTutar = ayFaturalari.reduce((s, f) => s + sayi(f.tutar), 0);
    return {
      ay,
      tahakkuk,
      /* Şube dökümü yalnızca o ay için KAYITLI olan döküm — sonradan değişen şube
       * dağılımı geçmiş aya yansıtılmaz, yoksa belge her bakışta başka görünür. */
      dagilim: ayinDagilimi(client, ay),
      faturalar: ayFaturalari,
      faturaliTutar,
      odemeler: ayOdemeleri,
      tahsilat,
      bakiye: tahakkuk - tahsilat,
    };
  }).filter((s) => !hareketsizAylariAtla
    || s.tahakkuk !== 0 || s.tahsilat !== 0 || s.faturalar.length > 0);

  const topla = (alan) => satirlar.reduce((s, x) => s + x[alan], 0);
  const tahakkuk = topla("tahakkuk");
  const tahsilat = topla("tahsilat");

  return {
    satirlar,
    toplam: {
      tahakkuk,
      tahsilat,
      bakiye: tahakkuk - tahsilat,
      faturaliTutar: topla("faturaliTutar"),
      faturaSayisi: satirlar.reduce((s, x) => s + x.faturalar.length, 0),
      odemeSayisi: satirlar.reduce((s, x) => s + x.odemeler.length, 0),
      aySayisi: satirlar.length,
    },
  };
}
