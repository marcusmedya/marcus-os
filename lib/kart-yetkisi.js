/* ------------------------------------------------------------------ */
/* OPERASYON KARTINDA ALT YETKİLER                                     */
/* ------------------------------------------------------------------ */
/**
 * `cekimEdit` izni tek parçaydı: açık olan personel kart açabiliyor, aşama ilerletebiliyor,
 * medya yükleyebiliyordu. Onaylama, silme ve düzenleme ekranda yalnızca yöneticiye
 * gösteriliyordu — **ama sunucu bunu hiç denetlemiyordu.** `PERMISSION_WRITE_FIELDS` yalnızca
 * "cekimIsleri alanına yazabilir mi" diye bakıyor; hangi kartın silindiğine ya da
 * onaylandığına bakmıyordu. Yani "yalnızca yönetici onaylar" gerçek bir sınır değil, gizli
 * bir düğmeydi. Bu modül o sınırı gerçekten kuruyor.
 *
 * TÜM KAYIT REDDEDİLMEZ, YALNIZCA İZİNSİZ DEĞİŞİKLİK GERİ ALINIR. Reddetmek aynı kayıttaki
 * ilgisiz düzenlemeleri de çöpe atardı — personel bir kaydında hem kendi kartının aşamasını
 * ilerletip hem yetkisi olmayan bir kartı silmeye çalışırsa, ilerletme de kaybolurdu. Bu
 * projede `dosyasizKontroleGirenleriGeriAl` aynı yöntemi kullanıyor.
 *
 * SIRA ÖNEMLİ: bu geri alma stok motorundan ÖNCE çalışmalı. Sonra çalışsaydı izinsiz bir
 * onay önce stok üretir ve Drive'da dosyayı ONAYLANANLAR'a taşırdı; geri alma o yan
 * etkileri temizleyemez.
 *
 * Yönetici bu denetimin dışındadır — çağıran taraf onu hiç çağırmaz.
 */

/** Onay sayılan aşamalar. Stok bu iki aşamada üretiliyor/korunuyor, Drive taşıması da
 * burada tetikleniyor; ikisi de "onaylama" yetkisine bağlı. */
export const ONAY_ASAMALARI = ["Onaylandı", "Teslim Edildi"];

/** "Düzenle" formunun dokunduğu alanlar — kartın KİMLİĞİ.
 *
 * Aşama, medya, yorum, geçmiş bilerek DIŞARIDA: onlar günlük iş, düzenleme değil.
 * Bu ayrım olmadan medya yükleyen personel "kartı düzenledi" sayılır ve yüklediği dosya
 * geri alınırdı. */
export const DUZENLEME_ALANLARI = [
  "marka", "kategori", "icerikTuru", "cekimTarihi", "teslimTarihi",
  "kameraman", "editor", "oncelik", "paylasimTuru",
];

const kimlik = (x) => String((x && x.id) !== undefined ? x.id : "");

/** İzinler nesnesinden tek bir alt yetkiyi okur.
 *
 * Tanımsız = varsayılana düş. `kartAcma` varsayılan AÇIK: bu yetki eklenmeden önce
 * `cekimEdit` izni olan herkes kart açabiliyordu ve var olan hesapların davranışı
 * değişmemeli. Diğer üçü varsayılan KAPALI — onlar zaten yalnızca yöneticideydi. */
export function yetkiVar(izinler, anahtar) {
  const deger = izinler ? izinler[anahtar] : undefined;
  if (deger === undefined || deger === null) return anahtar === "kartAcma";
  return deger === true;
}

/**
 * Gelen kart listesindeki izinsiz değişiklikleri geri alır.
 *
 * @returns { isler, geriAlinanlar } — `isler` yeni referans YALNIZCA bir şey geri
 * alındıysa; değişiklik yoksa gelen dizi olduğu gibi döner. Bu önemli: `api/data.js`
 * sürüm sayacını referans karşılaştırmasıyla artırıyor, her seferinde yeni dizi üretmek
 * dokunulmamış kartlarda çalışan herkesi boş yere 409'a düşürürdü.
 */
export function izinsizKartDegisiklikleriniGeriAl(eskiIsler, yeniIsler, izinler) {
  if (!Array.isArray(yeniIsler)) return { isler: yeniIsler, geriAlinanlar: [] };
  const eskiler = Array.isArray(eskiIsler) ? eskiIsler : [];
  const eskiHarita = new Map(eskiler.map((j) => [kimlik(j), j]));
  const geriAlinanlar = [];

  const acabilir = yetkiVar(izinler, "kartAcma");
  const silebilir = yetkiVar(izinler, "kartSilme");
  const onaylayabilir = yetkiVar(izinler, "kartOnaylama");
  const duzenleyebilir = yetkiVar(izinler, "kartDuzenleme");

  const sonuc = [];
  yeniIsler.forEach((yeni) => {
    if (!yeni) return;
    const eski = eskiHarita.get(kimlik(yeni));

    if (!eski) {
      /* YENİ KART. Yetkisi yoksa listeye hiç alınmaz — kart oluşmamış olur. */
      if (!acabilir) {
        geriAlinanlar.push({ id: yeni.id, marka: yeni.marka, sebep: "kartAcma" });
        return;
      }
      sonuc.push(yeni);
      return;
    }

    let kart = yeni;

    /* ONAY. Aşama onay aşamalarından birine YENİ giriyorsa yetki aranır. Zaten onaylı bir
     * kartın başka bir alanı değiştiğinde tetiklenmemeli: ölçüt "eskisi onay değildi,
     * yenisi onay" — yoksa onaylı kartta yorum yazmak bile engellenirdi. */
    const eskiOnay = ONAY_ASAMALARI.includes(eski.asama);
    const yeniOnay = ONAY_ASAMALARI.includes(kart.asama);
    if (yeniOnay && !eskiOnay && !onaylayabilir) {
      kart = { ...kart, asama: eski.asama };
      geriAlinanlar.push({ id: eski.id, marka: eski.marka, sebep: "kartOnaylama" });
    }

    /* DÜZENLEME. Yalnızca kartın kimlik alanları; aşama/medya/yorum günlük iştir. */
    if (!duzenleyebilir) {
      const degisenler = DUZENLEME_ALANLARI.filter((alan) => {
        const a = eski[alan], b = kart[alan];
        /* Boş dize ile tanımsız AYNI sayılır: form dokunulmamış bir alanı "" olarak geri
         * gönderebiliyor ve bu, düzenleme olmadığı hâlde geri alma tetikliyordu. */
        const bos = (x) => x === undefined || x === null || x === "";
        if (bos(a) && bos(b)) return false;
        return String(a) !== String(b);
      });
      if (degisenler.length > 0) {
        const geri = { ...kart };
        degisenler.forEach((alan) => { geri[alan] = eski[alan]; });
        kart = geri;
        geriAlinanlar.push({ id: eski.id, marka: eski.marka, sebep: "kartDuzenleme", alanlar: degisenler });
      }
    }

    sonuc.push(kart);
  });

  /* SİLME. Gelen listede olmayan eski kart silinmiş demektir; yetki yoksa geri konur.
   * Sıra korunuyor: geri konan kart eski listedeki yerine değil sona eklenirse pano
   * dizilimi her yetkisiz denemede oynardı. */
  if (!silebilir) {
    const yeniKimlikler = new Set(sonuc.map(kimlik));
    const eksikler = eskiler.filter((j) => j && !yeniKimlikler.has(kimlik(j)));
    if (eksikler.length > 0) {
      eksikler.forEach((j) => geriAlinanlar.push({ id: j.id, marka: j.marka, sebep: "kartSilme" }));
      const geriYerlesmis = [];
      const sonucHarita = new Map(sonuc.map((j) => [kimlik(j), j]));
      eskiler.forEach((j) => {
        const guncel = sonucHarita.get(kimlik(j));
        geriYerlesmis.push(guncel || j);
        if (guncel) sonucHarita.delete(kimlik(j));
      });
      /* Eskide hiç olmayan (bu turda açılan) kartlar sona eklenir. */
      sonuc.forEach((j) => { if (sonucHarita.has(kimlik(j))) geriYerlesmis.push(j); });
      return { isler: geriYerlesmis, geriAlinanlar };
    }
  }

  return { isler: geriAlinanlar.length > 0 ? sonuc : yeniIsler, geriAlinanlar };
}

/** Geri alınanları kullanıcıya gösterilecek tek cümleye çevirir. */
export function geriAlmaMesaji(geriAlinanlar) {
  if (!geriAlinanlar || geriAlinanlar.length === 0) return "";
  const metin = {
    kartAcma: "kart açma", kartSilme: "kart silme",
    kartOnaylama: "kart onaylama", kartDuzenleme: "kart düzenleme",
  };
  const turler = [...new Set(geriAlinanlar.map((x) => metin[x.sebep] || x.sebep))];
  return `Yetkin olmadığı için geri alındı: ${turler.join(", ")}. Yöneticine sor.`;
}
