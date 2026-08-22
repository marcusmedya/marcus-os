/**
 * ŞUBE BAZLI İÇERİK KULLANIMI — TEK KAYNAK
 *
 * NEDEN GEREKTİ: çok şubeli markalarda (örn. dört şubeli bir kafe zinciri) aynı içerik
 * bazı şubelerde aynı gün, bazılarında farklı günlerde paylaşılıyor; bazı içerikler ise
 * yalnızca tek bir şubeye özel. "Bu içeriği bu şubede paylaşmış mıydık?" sorusunun cevabı
 * Drive'a bakılarak aranıyordu ve şubeler atlanıyordu.
 *
 * TEMEL KURAL: 1 içerik = 1 Operasyon kartı = 1 Drive dosyası. Aynı dosya her şube için
 * TEKRAR YÜKLENMEZ. Şube bilgisi tamamen Marcus OS'ta durur; Drive dosya deposu olarak
 * kalır.
 *
 * MODEL: bir içeriğin bir şubede kullanımı, zaten var olan `haftalikPaylasimlar` kaydıdır.
 * O kayıt "şu içerik, şu gün, şu şekilde paylaşılacak" demek ve karta bağlanabiliyor
 * (`isId`). Eksik olan tek şey `subeId` idi — yeni bir koleksiyon açılmadı.
 *
 * GERİYE UYUMLULUK: `subeId` taşımayan kayıt MARKA GENELİ sayılır, "bilinmeyen şube"
 * DEĞİL. Bugünkü tüm kayıtlar böyledir; veri göçü gerekmiyor. Aynı yöntem medya
 * slotlarında da kullanıldı (`slot` yoksa "1").
 *
 * BU DOSYA SAF: veritabanına, ağa, tarihe dokunmaz. Böylece Node testinden çağrılabiliyor
 * ve kural tek yerde duruyor — bu projede aynı kuralı iki yere yazmak zaten bir kez panel
 * senkron hatasına yol açtı.
 */

/** Bir kaydın şubesi. Yoksa null = marka geneli. */
export function planSubesi(plan) {
  const s = plan && plan.subeId;
  return s === undefined || s === null || s === "" ? null : String(s);
}

/** Şube bazlı stok anahtarı. Genel stok `marka_tür`, şube stoğu `marka_şube_tür`. */
export function subeStokAnahtari(clientId, subeId, tur) {
  return `${clientId}_${subeId}_${tur}`;
}

/**
 * Bir markanın şubeleri.
 * Şubesi olmayan marka boş dizi döner — o markada hiçbir ekran değişmez.
 */
export function markaninSubeleri(subeler, clientId) {
  return (subeler || []).filter((s) => s && String(s.clientId) === String(clientId));
}

/**
 * BİR İÇERİĞİ HANGİ ŞUBELER KULLANABİLİR.
 *
 * Kartta `sadeceSubeler` doluysa yalnızca o şubeler; boş ya da yoksa markanın TÜM şubeleri.
 * Varsayılanın "tümü" olması bilinçli: bugünkü kartlarda bu alan yok ve hepsi genel içerik.
 *
 * MARKA EŞLEŞTİRMESİ ÇAĞIRANIN İŞİ. Operasyon kartı markayı ADLA tutuyor
 * (`is.marka = "Smell Coffee"`), şube ise KİMLİKLE (`sube.clientId = 3`). Türkçe büyük/küçük
 * harf kuralları ve aynı adlı iki marka ihtimali yüzünden bu eşleştirmenin tek bir doğru
 * yeri var: `lib/marka-kilidi.js` içindeki `markaEslestirici`. Burada ikinci bir kopyasını
 * yazmak, zamanla ayrışıp iki ekranın farklı sonuç vermesi demekti. Bu yüzden çağıran taraf
 * çözülmüş `clientId`'yi veriyor.
 */
export function kullanabilenSubeler(is, subeler, clientId) {
  const markaSubeleri = markaninSubeleri(subeler, clientId);
  const secili = Array.isArray(is && is.sadeceSubeler) ? is.sadeceSubeler.map(String) : [];
  if (secili.length === 0) return markaSubeleri;
  return markaSubeleri.filter((s) => secili.includes(String(s.id)));
}

/**
 * Bir içeriğin BİR ŞUBEDEKİ durumu.
 * @returns "paylasildi" | "planlandi" | "kullanilmadi"
 */
export function icerikSubeDurumu(isId, subeId, planlar) {
  const kayitlar = (planlar || []).filter((p) =>
    p && String(p.isId) === String(isId) && planSubesi(p) === (subeId === null ? null : String(subeId)));
  if (kayitlar.length === 0) return "kullanilmadi";
  return kayitlar.some((p) => p.yapildi === true) ? "paylasildi" : "planlandi";
}

/** O şubede paylaşıldıysa tarihi, değilse null. */
export function icerikSubeTarihi(isId, subeId, planlar) {
  const kayit = (planlar || [])
    .filter((p) => p && String(p.isId) === String(isId)
                && planSubesi(p) === (subeId === null ? null : String(subeId))
                && p.yapildi === true)
    .sort((a, b) => String(a.yapildigiTarih || "").localeCompare(String(b.yapildigiTarih || "")))[0];
  return (kayit && kayit.yapildigiTarih) || null;
}

/**
 * BİR İÇERİĞİN ŞUBE ÖZETİ — personel planlama yaparken gördüğü liste.
 *
 * "Bu içeriği bu şubede daha önce paylaşmış mıydık?" sorusunun cevabı burada; Drive'a
 * bakmaya gerek kalmıyor.
 */
export function icerikSubeOzeti(is, subeler, planlar, clientId) {
  return kullanabilenSubeler(is, subeler, clientId).map((sube) => ({
    subeId: String(sube.id),
    subeAdi: sube.ad || "",
    durum: icerikSubeDurumu(is && is.id, sube.id, planlar),
    tarih: icerikSubeTarihi(is && is.id, sube.id, planlar),
  }));
}

/**
 * PLANLANAN TÜM ŞUBELER PAYLAŞILDI MI?
 *
 * Kartın "Teslim Edildi"ye geçme anını belirler. Henüz hiç plan yoksa `false` döner —
 * plansız bir kart "tamamlandı" sayılmamalı.
 */
export function planlananlarTamamlandiMi(isId, planlar) {
  const kayitlar = (planlar || []).filter((p) => p && String(p.isId) === String(isId));
  if (kayitlar.length === 0) return false;
  return kayitlar.every((p) => p.yapildi === true);
}

/** İçerik en az bir şubede paylaşıldı mı? Kartın "Paylaşılıyor" aşamasına geçme anı. */
export function enAzBirSubedePaylasildi(isId, planlar) {
  return (planlar || []).some((p) => p && String(p.isId) === String(isId) && p.yapildi === true);
}

/**
 * BİR ŞUBENİN ÜÇ LİSTESİ.
 *
 * Hesaplanıyor, SAKLANMIYOR: üçüncü bir koleksiyon tutmak onu güncel tutma sorumluluğu
 * yaratırdı ve bu projede türetilmiş alanların kalıcı belgeye yazılması zaten bir kez
 * soruna yol açtı.
 *
 * `kullanilmamis` yalnızca o şubede KULLANILABİLEN içerikleri sayar — şubeye özel bir
 * içerik başka şubede "kullanılabilir" görünmez.
 */
export function subeListeleri(subeId, isler, planlar, subeler, clientId, hazirMi) {
  const uygun = (isler || []).filter((is) => {
    if (!is) return false;
    if (typeof hazirMi === "function" && !hazirMi(is)) return false;
    return kullanabilenSubeler(is, subeler, clientId).some((s) => String(s.id) === String(subeId));
  });

  const paylasilan = [];
  const planlanan = [];
  const kullanilmamis = [];
  uygun.forEach((is) => {
    const durum = icerikSubeDurumu(is.id, subeId, planlar);
    if (durum === "paylasildi") paylasilan.push({ is, tarih: icerikSubeTarihi(is.id, subeId, planlar) });
    else if (durum === "planlandi") planlanan.push({ is });
    else kullanilmamis.push({ is });
  });
  return { paylasilan, planlanan, kullanilmamis };
}

/**
 * ÇEKİM LİSTESİ SAYISI — "kaç FARKLI içerik hazır".
 *
 * Kullanıcının seçimi: 4 şubede kullanılacak tek bir video, yine tek bir çekim demek.
 * Şubelerin toplamı sayılsaydı ekran 12 gösterir, bol stok sanılıp çekim yapılmazdı.
 * İçerik ilk şubede paylaşıldığı anda bu sayıdan düşer.
 */
export function hazirIcerikSayisi(isler, planlar, hazirMi) {
  return (isler || []).filter((is) => {
    if (!is) return false;
    if (typeof hazirMi === "function" && !hazirMi(is)) return false;
    return !enAzBirSubedePaylasildi(is.id, planlar);
  }).length;
}

/**
 * MÜŞTERİ PANELİ SATIRLARI — aynı içerik dört kez görünmesin.
 *
 * Dört şubede paylaşılan tek içerik, planda dört ayrı kayıt tutuyor. Müşteri paneli
 * bunları olduğu gibi çizerse akış önizlemesinde aynı kare dört kez tekrar eder ve
 * marka "her gün aynı gönderiyi paylaşıyoruz" gibi görünür. Kullanıcının seçimi:
 * TEK SATIR + ŞUBE ETİKETLERİ.
 *
 * Yalnızca ŞUBEYE bağlı ve BİR KARTA bağlı kayıtlar birleştirilir. Şubesiz plan
 * (tek şubeli marka, eski kayıtlar) ve karta bağlanmamış plan tek tek kalır —
 * o markaların ekranı birebir eskisi gibi çizilir.
 *
 * `yapildi` yalnızca TÜM şubeler paylaştıysa true: tek şube paylaştı diye
 * "✓ Paylaşıldı" yazmak müşteriye yanlış bilgi verir.
 */
export function musteriPlanSatirlari(plan) {
  const satirlar = [];
  const grupYeri = new Map();

  (plan || []).forEach((p) => {
    if (!p) return;
    const subeAdi = p.subeAdi || null;
    const anahtar = subeAdi && p.isId ? String(p.isId) : null;

    if (anahtar === null) { satirlar.push({ ...p, subeler: subeAdi ? [subeKaydi(p)] : [] }); return; }

    if (!grupYeri.has(anahtar)) {
      grupYeri.set(anahtar, satirlar.length);
      satirlar.push({ ...p, subeler: [subeKaydi(p)] });
      return;
    }
    const satir = satirlar[grupYeri.get(anahtar)];
    satir.subeler.push(subeKaydi(p));
    /* En erken hafta/gün temsilci olsun ki takvimde doğru yerde dursun. */
    if (p.haftaKey && satir.haftaKey && p.haftaKey < satir.haftaKey) {
      satir.haftaKey = p.haftaKey;
      satir.gun = p.gun;
    }
    if (!satir.gorselUrl && p.gorselUrl) satir.gorselUrl = p.gorselUrl;
    if (!satir.altMetin && p.altMetin) satir.altMetin = p.altMetin;
  });

  satirlar.forEach((s) => {
    if (s.subeler.length > 0) s.yapildi = s.subeler.every((x) => x.yapildi === true);
  });
  return satirlar;
}

function subeKaydi(p) {
  return { subeId: p.subeId != null ? String(p.subeId) : null, subeAdi: p.subeAdi || "", gun: p.gun || "", yapildi: p.yapildi === true, tarih: p.yapildigiTarih || null };
}
