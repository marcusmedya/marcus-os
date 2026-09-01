/* ------------------------------------------------------------------ */
/* REKLAM LİSTESİNİN MARKAYA GÖRE GRUPLANMASI                          */
/* ------------------------------------------------------------------ */
/**
 * Liste düz bir dizi olarak basılıyordu ve her satır marka adını tekrar ediyordu
 * ("İbo Burger — Chedar", "İbo Burger — Plak", "İbo Burger — Burger Modu"…). 49 markalı
 * bir ajansta ekran okunmaz hale geliyor. Marka bir kez başlık olarak yazılıyor, reklamlar
 * altında sıralanıyor.
 *
 * GRUPLAMA ANAHTARI TÜRKÇE-DUYARLI KÜÇÜLTMEYLE ÜRETİLİYOR. Reklam kaydı markayı ADIYLA
 * saklıyor (kartlar gibi, `clientId` ile değil); "İbo Burger" ile "ibo burger" ayrı
 * gruplara düşseydi aynı marka ekranda iki kez görünürdü. Başlıkta İLK GÖRÜLEN yazım
 * kullanılıyor — kullanıcının girdiği hâl korunsun diye.
 *
 * SIRA KORUNUYOR. Ekran reklamları bitiş tarihine göre (yakın olan üstte) sıralıyordu;
 * gruplama bunu bozmamalı, yoksa "yakında bitecek" listesi aşağıya kayar ve ekranın işi
 * kaybolur. Grup içi sıra girdi sırasıdır (çağıran zaten sıralı veriyor), gruplar da
 * içindeki EN ERKEN bitecek reklama göre diziliyor.
 */

const trKucult = (x) => String(x || "").trim().toLocaleLowerCase("tr");

/** Markası girilmemiş reklamlar için grup başlığı — sessizce kaybolmasınlar. */
export const MARKASIZ_BASLIK = "Marka belirtilmemiş";

/**
 * @param reklamlar Sıralanmış reklam dizisi (sıra korunur).
 * @param siraDegeri Bir reklamın sıralama değeri; gruplar bunun en küçüğüne göre dizilir.
 * @returns [{ anahtar, marka, reklamlar }]
 */
export function markayaGoreGrupla(reklamlar, siraDegeri = (r) => String((r && r.bitisTarihi) || "")) {
  const gruplar = new Map();

  (reklamlar || []).forEach((r) => {
    if (!r) return;
    const anahtar = trKucult(r.marka);
    const mevcut = gruplar.get(anahtar);
    if (mevcut) {
      mevcut.reklamlar.push(r);
      return;
    }
    gruplar.set(anahtar, {
      anahtar,
      /* İlk görülen yazım başlık olur; boşsa adı olan bir başlık verilir ki
       * markasız kayıtlar listeden düşmesin. */
      marka: String((r.marka || "")).trim() || MARKASIZ_BASLIK,
      reklamlar: [r],
    });
  });

  /* Boş sıralama değeri (tarihi girilmemiş reklam) SONA atılıyor. Boş dize "" her şeyden
   * küçük olduğu için, atılmasaydı tarihi olmayan kayıtlar en acil grupmuş gibi listenin
   * başına çıkardı. */
  const enErken = (g) => {
    const degerler = g.reklamlar.map(siraDegeri).filter((x) => x !== "" && x != null);
    return degerler.length ? degerler.reduce((a, b) => (a < b ? a : b)) : "￿";
  };

  return [...gruplar.values()].sort((a, b) => {
    const fark = String(enErken(a)).localeCompare(String(enErken(b)));
    /* Eşitlikte marka adına düşülüyor: aksi halde sıra Map'in ekleme sırasına kalır ve
     * aynı veri iki farklı süzgeçte farklı sıralanır. */
    return fark !== 0 ? fark : a.marka.localeCompare(b.marka, "tr");
  });
}
