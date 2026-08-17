/**
 * MÜŞTERİ GÖRÜNÜMÜ — tek kaynak.
 *
 * Hem müşterinin kendi paneli hem de çözüm ortağının "Marka Paneli" ekranı BU fonksiyonu
 * çağırır. Görünümü kopyalamak yerine veriyi tek yerden üretmenin sebebi: kopyalasaydık
 * ikisi zamanla ayrışırdı — müşteri bir şey görürken ortak başka bir şey görürdü ve
 * "müşteri ne görüyorsa ortak da görsün" kuralı sessizce bozulurdu.
 *
 * Buraya eklenen her alan iki tarafa da AYNI ANDA gider.
 */
export function musteriGorunumuUret(data, kendiMarka, markaEslestirici) {
  const musteriClientId = kendiMarka.id;
      /* MÜŞTERİ PANELİ = OPERASYON'UN AYNASI
   *
   * Eski sistem, bir iş "Kontrol Bekliyor"a geçtiğinde müşteri paneline bir KOPYA kayıt
   * yaratıyordu. Artık işler canlı yansıtıldığı için (aşağıdaki hazirIcerikler) o kopyalar
   * AYNI İŞİN İKİNCİ KEZ görünmesine yol açıyordu — üstelik kopya, iş Operasyon'da
   * ilerlese bile yerinde kalıyordu. Bu yüzden bir Operasyon işine bağlı olan
   * (kaynakIsId taşıyan) kayıtlar müşteriye artık gönderilmiyor.
   *
   * Çekim planları (tur === "cekim") istisna: bunlar henüz Operasyon'da bir iş DEĞİL,
   * çekim öncesi müşteriye sunulan fikirler. Onlar gönderilmeye devam ediyor.
   *
   * Not: kayıtlar silinmiyor, yalnızca müşteriye gönderilmiyor — geçmişleri yönetici
   * tarafında duruyor. */
  const isVarMi = (isId) => (data.cekimIsleri || []).some((j) => String(j.id) === String(isId));
  const kendiIcerikleri = (data.musteriIcerikleri || []).filter((i) => {
    if (String(i.clientId) !== String(musteriClientId)) return false;
    if (i.tur === "cekim") return true;              // çekim planı — Operasyon'da karşılığı yok
    if (!i.kaynakIsId) return true;                  // bağımsız kayıt
    /* Bağlı olduğu Operasyon işi HÂLÂ VARSA gönderme — kart zaten canlı yansıyor,
     * ikinci kez görünmesin. Ama iş SİLİNMİŞSE kayıt geri gelir: aksi halde müşterinin
     * revize istediği içerik hiçbir yerde görünmez, izi tamamen kaybolurdu. */
    return !isVarMi(i.kaynakIsId);
  }).map((i) => ({
    /* ALAN ALAN SEÇİLİR — kaydın tamamı asla gönderilmez.
     *
     * Denetimde çıktı: bu kayıtlar eskiden olduğu gibi gidiyordu ve iç alanlar
     * (kaynakIsId, operasyonaAktarildi, olusturulanIsId, cekildi ve özellikle
     * ONAYLAYAN — senin müşteri adına onayladığını gösterir) müşteriye ulaşıyordu.
     * Asıl risk gelecekteydi: bu kayda eklenecek her yeni iç alan (maliyet, personel
     * notu) kendiliğinden müşteriye giderdi. Reklamlar ve paylaşımlar için bu kural
     * zaten uygulanıyordu; burada eksik kalmış.
     *
     * YENİ ALAN EKLERKEN: müşterinin görmesi gerekiyorsa buraya da eklenmeli. */
    id: i.id,
    tur: i.tur,
    aciklama: i.aciklama || "",
    durum: i.durum,
    tarih: i.tarih || null,
    guncellemeTarihi: i.guncellemeTarihi || null,
    revizeNotu: i.revizeNotu || null,
    driveLinki: i.driveLinki || null,
    gorselUrl: i.gorselUrl || null,
    videoYonu: i.videoYonu || null,
    sira: i.sira,                       // müşteri panelindeki sıralama senin sıranla aynı olsun
    // Çekim planına özel alanlar
    referansLink: i.referansLink || null,
    konusmali: i.konusmali || null,
    konusmaMetni: i.konusmaMetni || null,
    cekimNotu: i.cekimNotu || null,
    planlananTarih: i.planlananTarih || null,
  }));

  /* ---------------------------------------------------------------- *
   * MÜŞTERİYE GÖNDERİLEN EK VERİ (reklamlar, paylaşım planı, operasyon)
   *
   * KRİTİK: burada ne göndermediğimiz, ne gönderdiğimiz kadar önemli. Her kayıt
   * alan alan SEÇİLEREK kopyalanıyor — kaydın tamamı asla olduğu gibi gönderilmiyor.
   * Böylece ileride bu kayıtlara eklenecek yeni bir iç alan (maliyet, personel notu vb.)
   * müşteri paneline kendiliğinden sızamaz.
   *
   * Bilerek DIŞARIDA bırakılanlar:
   *  - Reklam bütçesi (iç bilgi)
   *  - Operasyon işlerinde kameraman/editör adı, iç yorumlar, işlem geçmişi, brief
   *  - Her türlü maliyet, ücret ve personel bilgisi
   * ---------------------------------------------------------------- */
  const markaAdi = kendiMarka ? kendiMarka.ad : "";
  /** Reklam ve Operasyon kayıtlarında marka, ID ile değil ADIYLA tutuluyor ve "Diğer
   * (elle yaz)" seçeneğiyle serbest metin de girilebiliyor. Bu yüzden eşleştirme baştaki/
   * sondaki boşluğa ve büyük-küçük harfe takılmadan yapılır — yoksa "Kanatçı Diren " gibi
   * tek bir boşluk farkı, o markanın hiçbir reklamının görünmemesine yol açardı. */
  /* Marka adı yazım farklarına dayanıklı eşleştirme (büyük I/İ, çift boşluk, Türkçe
   * karakter kullanılmaması). İki müşteri aynı anahtara düşerse tam eşleşmeye döner —
   * bkz. lib/marka-kilidi.js → markaEslestirici. */
  const markaEsit = markaEslestirici(data.clients || [], markaAdi);

  const kendiReklamlari = (data.reklamlar || [])
    .filter((r) => markaEsit(r.marka))
    .map((r) => ({
      id: r.id,
      reklamAdi: r.reklamAdi,
      baslangicTarihi: r.baslangicTarihi || null,
      bitisTarihi: r.bitisTarihi || null,
      not: r.not || null,
      // Kampanya sonuçları — müşterinin görmesi gereken performans rakamları.
      // Bütçe hâlâ gönderilmiyor (iç bilgi).
      erisim: r.erisim || null,
      gosterim: r.gosterim || null,
      tiklama: r.tiklama || null,
      etkilesim: r.etkilesim || null,
      sonuc: r.sonuc || null,
    }));

  const kendiPaylasimPlani = (data.haftalikPaylasimlar || [])
    .filter((p) => String(p.clientId) === String(musteriClientId))
    .map((p) => ({
      id: p.id,
      gun: p.gun,
      haftaKey: p.haftaKey,
      tur: p.tur,
      yapildi: !!p.yapildi,
      yapildigiTarih: p.yapildigiTarih || null,
      altMetin: p.altMetin || null,
      gorselUrl: p.gorselUrl || null,
    }));

  /* HAZIR İÇERİKLER — Operasyon'da "Kontrol Bekliyor" aşamasındaki işlerin CANLI AYNASI.
   *
   * Kopya değil, ayna: iş o aşamadan çıktığı anda müşteri panelinden de kaybolur.
   * Kopyalasaydık, Operasyon'da geri alınan bir iş müşteri panelinde onay bekliyor gibi
   * asılı kalırdı — "orada olmayan bir şey müşteri panelinde gözükmesin" kuralı bozulurdu.
   *
   * Alanlar tek tek seçiliyor: brief, kameraman/editör adları, iç yorumlar ve işlem
   * geçmişi bilerek DIŞARIDA. */
  /* Ayna yalnızca "Kontrol Bekliyor"u değil, müşterinin İŞLEM YAPTIĞI aşamaları da
   * kapsar. Aksi halde müşteri bir kartı revize ettiğinde kart panelden tamamen
   * kayboluyordu — "neye revize istemiştim?" sorusunun cevabı yok oluyordu.
   *   Kontrol Bekliyor          → onayını bekliyor (işlem yapılabilir)
   *   Revize İstendi            → revize istediği (işlem yapılamaz, kayıt olarak durur)
   *   Onaylandı / Teslim Edildi → onayladığı */
  const ASAMA_DURUM = {
    "Kontrol Bekliyor": "bekliyor",
    "Revize İstendi": "revize",
    "Onaylandı": "onaylandi",
    "Teslim Edildi": "onaylandi",
  };
  const kendiHazirIcerikleri = (data.cekimIsleri || [])
    .filter((j) => markaEsit(j.marka) && ASAMA_DURUM[j.asama])
    .map((j) => ({
      isId: j.id,
      durum: ASAMA_DURUM[j.asama],
      revizeNotu: j.musteriRevizeNotu || null,
      baslik: j.icerikTuru || j.kategori || "Video",
      kategori: j.kategori || "Video",
      dosyaLinki: j.editliDosyaLink || j.hamDosyaLink || null,
      videoYonu: j.videoYonu || null,
      teslimTarihi: j.teslimTarihi || null,
      uretilenAdet: j.uretilenAdet || null,
    }));

  const kendiIsleri = (data.cekimIsleri || [])
    .filter((j) => markaEsit(j.marka))
    .map((j) => ({
      id: j.id,
      icerikTuru: j.icerikTuru || "",
      kategori: j.kategori || null,
      asama: j.asama || "",
      cekimTarihi: j.cekimTarihi || null,
      teslimTarihi: j.teslimTarihi || null,
      teslimEdilmeTarihi: j.teslimEdilmeTarihi || null,
      uretilenAdet: j.uretilenAdet || null,
    }));


  return {
    marka: kendiMarka.ad || "",
    markaLogo: kendiMarka.logoUrl || null,
    /* Müşteri paneli AÇIK zeminli; koyu zemin için yapılmış bir logo orada kaybolabilir.
     * Ayrı bir açık zemin logosu yüklenmişse o kullanılır, yoksa kare logoya düşülür. */
    ajansLogo: data.acikZeminLogosu || data.markaKimligiGorseli || null,
    firmaAdi: data.firmaAdi || "Marcus Medya",
    icerikler: kendiIcerikleri,
    hazirIcerikler: kendiHazirIcerikleri,
    reklamlar: kendiReklamlari,
    paylasimPlani: kendiPaylasimPlani,
    operasyonIsleri: kendiIsleri,
  };
}
