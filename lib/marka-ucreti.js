/* ------------------------------------------------------------------ */
/* ŞUBE BAZLI AYLIK ÜCRET                                              */
/* ------------------------------------------------------------------ */
/**
 * Çok şubeli markalarda ücret şubelere göre alınıyor: Smell Coffee'nin üç şubesi
 * ayrı ayrı faturalanıyor ve toplam 60.000 ₺ ediyordu. Bir şube ayrılınca toplamın
 * kendiliğinden 45.000'e düşmesi gerekiyor — elle düzeltilirse hem unutuluyor hem de
 * "bu rakam neyin toplamı" sorusu cevapsız kalıyor.
 *
 * MODEL: **toplam = marka temel ücreti + o markanın şube ücretleri.**
 * Şube ücreti şubenin kendi kaydında (`sube.aylikUcret`), temel ücret müşteri
 * kaydında (`client.temelUcret`) duruyor. İkisi de yoksa marka eskisi gibi çalışır:
 * `client.aylikUcret` elle girilir ve buradaki hiçbir kural devreye girmez.
 *
 * `client.aylikUcret` KALDIRILMADI. Ciro, kâr marjı, ödeme takvimi, tebligat mektubu
 * ve dışa aktarımlar dahil 19 yerde okunuyor; toplam orada TUTULMAYA devam ediyor,
 * yalnızca şube ücreti kullanılan markalarda sunucu onu yeniden hesaplıyor. Böylece
 * hesaplama tek yerde olurken okuyan hiçbir ekran değişmek zorunda kalmıyor.
 *
 * ---------------------------------------------------------------------------
 * GEÇMİŞ AYIN TUTARI DONDURULUR — bu modülün asıl varlık sebebi.
 *
 * Ödeme durumu (`monthRemaining`, `isMonthPaid`) geçmiş ayları saklamıyor, HER AY İÇİN
 * BUGÜNKÜ `aylikUcret`'ten hesaplıyordu. Yani ücret 60.000'den 45.000'e düşürülünce
 * Temmuz ayı da geriye dönük 45.000'e düşüyor: tahsil edilmiş 60.000 "15.000 fazla
 * ödeme" gibi görünüyor, eksik kalan bir ay ise borçtan siliniyordu. Fatura geçmişi
 * sessizce değişiyordu.
 *
 * Bu yüzden ücret her değiştiğinde bir DÖNEM kaydı düşülüyor:
 *   ucretGecmisi: [{ baslangicAy: "0000-00", tutar: 60000, dagilim: {...} },
 *                  { baslangicAy: "2026-09", tutar: 45000, dagilim: {...} }]
 * Bir ayın ücreti, o aydan önce başlayan SON dönemin tutarıdır. Ay ay kayıt değil
 * DÖNEM kaydı tutuluyor: liste yalnızca ücret değiştikçe uzuyor.
 *
 * `0000-00` açık başlangıç: "bu dönem, kayıtlı ilk aydan itibaren geçerli". Dize
 * karşılaştırması ("2026-08" <= "2026-09") YYYY-MM biçiminde doğru sıralar.
 * ---------------------------------------------------------------------------
 */

/** Açık uçlu başlangıç — bu dönem, geçmişin tamamını kapsar. */
export const ACIK_BASLANGIC = "0000-00";

const sayi = (x) => Number(x) || 0;

/** İçinde bulunulan ay, "YYYY-MM". Ödeme durumu bu biçimi kullanıyor; sunucu tarafında
 * `src/tema.jsx` içindeki `monthKey`'e erişilemediği için burada duruyor. */
export function ayAnahtari(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bir markanın şubeleri, ücretleriyle birlikte. */
export function subeUcretleri(subeler, clientId) {
  return (subeler || [])
    .filter((s) => s && String(s.clientId) === String(clientId))
    .map((s) => ({ subeId: s.id, ad: s.ad || "", tutar: sayi(s.aylikUcret) }));
}

/** Bu markada şube bazlı ücretlendirme kullanılıyor mu?
 *
 * Ölçüt "bir yerde SAYI GİRİLMİŞ olması" — sıfır da bir karardır ("bu şubeden ücret
 * alınmıyor"), tanımsızlıktan farklıdır. Alan hiç girilmemişse marka eskisi gibi tek
 * kalemden ücretlendirilir ve `aylikUcret`'e dokunulmaz. */
export function subeliUcretVarMi(client, subeler) {
  if (!client) return false;
  if (client.temelUcret !== undefined && client.temelUcret !== null && client.temelUcret !== "") return true;
  return (subeler || []).some((s) => s && String(s.clientId) === String(client.id)
    && s.aylikUcret !== undefined && s.aylikUcret !== null && s.aylikUcret !== "");
}

/** Ücretin dökümü: temel + şube şube. Şube ücretlendirmesi kullanılmıyorsa `null`. */
export function ucretDagilimi(client, subeler) {
  if (!subeliUcretVarMi(client, subeler)) return null;
  const temel = sayi(client.temelUcret);
  const satirlar = subeUcretleri(subeler, client.id);
  return { temel, subeler: satirlar, toplam: temel + satirlar.reduce((s, x) => s + x.tutar, 0) };
}

/** Bugün geçerli aylık ücret: şube dökümü varsa onun toplamı, yoksa kayıtlı tutar. */
export function aylikUcretiCoz(client, subeler) {
  const d = ucretDagilimi(client, subeler);
  return d ? d.toplam : sayi(client && client.aylikUcret);
}

/** Verilen ayı kapsayan ücret dönemi. Kayıt yoksa `null`. */
export function ayinDonemi(client, ay) {
  const gecmis = (client && Array.isArray(client.ucretGecmisi)) ? client.ucretGecmisi : [];
  let bulunan = null;
  gecmis.forEach((d) => {
    if (!d || !d.baslangicAy) return;
    if (String(d.baslangicAy) > String(ay)) return;
    if (!bulunan || String(d.baslangicAy) >= String(bulunan.baslangicAy)) bulunan = d;
  });
  return bulunan;
}

/** O ayda geçerli olan aylık ücret.
 *
 * Dönem kaydı yoksa bugünkü tutara düşülür — özelliğin açılmasından önceki
 * markalarda davranış eskisiyle BİREBİR aynı kalsın diye. */
export function ayinUcreti(client, ay) {
  const donem = ayinDonemi(client, ay);
  return donem ? sayi(donem.tutar) : sayi(client && client.aylikUcret);
}

/** O ayın tutarının şube dökümü (faturalama için). Kayıt yoksa `null`. */
export function ayinDagilimi(client, ay) {
  const donem = ayinDonemi(client, ay);
  return donem && donem.dagilim ? donem.dagilim : null;
}

function dagilimlarAyniMi(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (sayi(a.temel) !== sayi(b.temel)) return false;
  const x = a.subeler || [], y = b.subeler || [];
  if (x.length !== y.length) return false;
  return x.every((s, i) => String(s.subeId) === String(y[i].subeId) && sayi(s.tutar) === sayi(y[i].tutar));
}

/** Bir markanın ücret geçmişini, yeni tutar/dağılıma göre günceller.
 *
 * İki ayrı hal var ve ikisi de gerekli:
 *
 * 1. TUTAR DEĞİŞTİ (şube ayrıldı, ücret güncellendi). Yeni tutar İÇİNDE BULUNULAN AYDAN
 *    itibaren geçerli; ondan öncesi eski tutarla dondurulur. Geçmiş hiç yazılmamışsa
 *    önce eski tutar açık başlangıçla kayda geçer — yoksa "öncesi" diye bir şey kalmaz
 *    ve bütün geçmiş yeni tutara kayar, tam da engellemeye çalıştığımız şey olurdu.
 *
 * 2. TUTAR AYNI, DAĞILIM DEĞİŞTİ. Kullanıcı 60.000'i "15.000 temel + 3×15.000 şube"
 *    diye ilk kez tanımladığında olan budur. Tutar değişmediği için yeni dönem AÇILMAZ;
 *    döküm yürürlükteki döneme yazılır ve geçmiş aylar aynı tutarla ama artık şube şube
 *    okunabilir olur. Kullanıcının istediği "eski veriyi silmeden bölmek" tam olarak bu.
 */
export function ucretGecmisiniTazele(gecmis, oncekiTutar, hedefTutar, dagilim, ay) {
  const liste = Array.isArray(gecmis) ? gecmis : [];
  const son = liste.length ? liste[liste.length - 1] : null;

  if (sayi(oncekiTutar) !== sayi(hedefTutar)) {
    const taban = liste.length
      ? liste
      : [{ baslangicAy: ACIK_BASLANGIC, tutar: sayi(oncekiTutar), dagilim: null }];
    const kayit = { baslangicAy: ay, tutar: sayi(hedefTutar), dagilim: dagilim || null };
    const sonTaban = taban[taban.length - 1];
    /* Aynı ay içinde ikinci kez değişirse yeni dönem açılmaz, o ayın kaydı güncellenir —
     * yoksa aynı aya iki dönem düşer ve hangisinin geçerli olduğu okunmaz hale gelir. */
    return String(sonTaban.baslangicAy) === String(ay)
      ? [...taban.slice(0, -1), kayit]
      : [...taban, kayit];
  }

  if (!dagilimlarAyniMi(son ? son.dagilim : null, dagilim)) {
    return liste.length
      ? [...liste.slice(0, -1), { ...son, dagilim: dagilim || null }]
      : [{ baslangicAy: ACIK_BASLANGIC, tutar: sayi(hedefTutar), dagilim: dagilim || null }];
  }

  return liste;
}

/** Müşteri listesinin ücretlerini tazeler — bu özelliğin TEK yazma noktası.
 *
 * Hem müşteri kartı kaydında (`api/data.js`) hem şube işlemlerinde (`api/paylasim.js`)
 * çağrılır; ücretin nereden değiştiği fark etmeksizin toplam ve geçmiş aynı kuralla
 * üretilsin diye. Değişiklik yoksa `null` döner: dokunulmayan alanın sürüm sayacı
 * artmasın, aynı anda çalışan başka kimse boş yere 409 almasın.
 *
 * Şube ücretlendirmesi kullanılmayan markada `dagilim` null, hedef = kayıtlı tutar ve
 * geçmiş de aynı kalır — yani özellik kullanılmadıkça bu işlev hiçbir şey yapmaz. */
export function ucretleriTazele(eskiClients, yeniClients, subeler, ay) {
  if (!Array.isArray(yeniClients)) return null;
  let degisti = false;

  const sonuc = yeniClients.map((c) => {
    if (!c) return c;
    const dagilim = ucretDagilimi(c, subeler);
    const hedef = dagilim ? dagilim.toplam : sayi(c.aylikUcret);
    const eskiC = (eskiClients || []).find((x) => x && String(x.id) === String(c.id));
    /* Önceki tutar, KAYITLI olan tutardır. Yeni müşteride "önceki" yoktur; hedefin
     * kendisi sayılır ki kaydın ilk anında sahte bir ücret değişimi kaydedilmesin. */
    const onceki = eskiC ? sayi(eskiC.aylikUcret) : hedef;

    const yeniGecmis = ucretGecmisiniTazele(c.ucretGecmisi, onceki, hedef, dagilim, ay);
    const gecmisDegisti = yeniGecmis !== (Array.isArray(c.ucretGecmisi) ? c.ucretGecmisi : undefined)
      && !(yeniGecmis.length === 0 && !c.ucretGecmisi);
    const tutarDegisti = hedef !== sayi(c.aylikUcret);
    if (!gecmisDegisti && !tutarDegisti) return c;

    degisti = true;
    return { ...c, aylikUcret: hedef, ucretGecmisi: yeniGecmis };
  });

  return degisti ? sonuc : null;
}
