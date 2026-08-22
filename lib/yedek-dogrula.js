/**
 * YEDEK DOĞRULAMA — GERİ YÜKLEMEDEN ÖNCE
 *
 * Geri yükleme sistemdeki en tehlikeli yazma: tüm veriyi değiştirir. Mevcut akış iki
 * şeyi zaten doğru yapıyor — kilit alıyor ve geri yüklemeden önce mevcut verinin 30
 * günlük kopyasını ayrı bir anahtara yazıyor.
 *
 * EKSİK OLAN: yedeğin İÇERİĞİ hiç kontrol edilmiyordu. `kv.get` bir nesne döndürdüyse
 * doğrudan yazılıyordu. Oysa bir yedek şu hallerde de "nesne" olur:
 *
 *   - yarım yazılmış / bozulmuş kayıt: `clients` bir dizi değil metin
 *   - yanlış anahtardan gelen bambaşka bir belge
 *   - eski bir sürümden kalmış, üst düzey alanları eksik belge
 *
 * Bunların hepsi sessizce üretime yazılır ve uygulamayı bozar. Kilit ve kopya bu
 * durumda işe yaramaz: kopya da alınır, kilit de düzgün bırakılır — ama veri bozuktur.
 *
 * BU MODÜL SAF: ağ yok, ortam yok, yan etki yok. Karar vermez, RAPOR eder.
 *
 * İKİ SEVİYE:
 *   hatalar  → geri yükleme YAPILMAMALI. Yapı bozuk; yazılırsa uygulama çalışmaz.
 *   uyarılar → geri yükleme yapılabilir ama kullanıcı bilerek karar vermeli.
 *              Eski bir yedeğe dönmek doğal olarak kayıt kaybettirir; bu bir hata
 *              değil, kullanıcının bilmesi gereken bir sonuçtur.
 */

/** Dizi olması ZORUNLU üst düzey alanlar — biri dizi değilse uygulama çalışmaz. */
export const DIZI_ALANLAR = [
  "clients", "cekimIsleri", "haftalikPaylasimlar", "paylasimGecmisi",
  "subeler", "personelHesaplari", "musteriHesaplari", "uyelikler",
  "reklamlar", "teklifler", "islemGecmisi", "silinenler",
];

/** Nesne olması ZORUNLU alanlar. */
export const NESNE_ALANLAR = ["stoklar", "staffPermissions", "_alanSurumleri"];

/**
 * Kayıp oranı bu eşiğe ULAŞIRSA uyarılır (sınır dahil) — kullanıcı ne kaybedeceğini
 * bilerek karar versin. Her farkta uyarmak uyarıyı değersizleştirirdi.
 */
export const KAYIP_UYARI_ORANI = 0.25;

const sayi = (deger) => {
  if (Array.isArray(deger)) return deger.length;
  if (deger && typeof deger === "object") return Object.keys(deger).length;
  return 0;
};

/**
 * YAPI DOĞRULAMASI — yedek yazılabilir mi?
 *
 * Alanın YOKLUĞU hata değil: eski bir belgede `subeler` hiç bulunmayabilir ve bu
 * normal. Hata, alanın VAR olup YANLIŞ TÜRDE olmasıdır — o zaman kod onu dizi sanıp
 * `.filter` çağırır ve uygulama çöker.
 */
export function yapiDogrula(yedek) {
  const hatalar = [];

  if (yedek === null || yedek === undefined) {
    return { gecerli: false, hatalar: ["Yedek boş — içinde hiçbir veri yok."] };
  }
  if (typeof yedek !== "object" || Array.isArray(yedek)) {
    return { gecerli: false, hatalar: ["Yedek bir belge değil (nesne bekleniyordu)."] };
  }

  DIZI_ALANLAR.forEach((alan) => {
    if (alan in yedek && !Array.isArray(yedek[alan])) {
      hatalar.push(`\`${alan}\` bir liste değil (${typeof yedek[alan]}) — bu yedek bozuk.`);
    }
  });
  NESNE_ALANLAR.forEach((alan) => {
    if (alan in yedek && (typeof yedek[alan] !== "object" || yedek[alan] === null || Array.isArray(yedek[alan]))) {
      hatalar.push(`\`${alan}\` bir nesne değil — bu yedek bozuk.`);
    }
  });

  /* HİÇ TANIDIK ALAN YOKSA bu belge büyük olasılıkla başka bir şey. Yanlış anahtardan
   * gelen bir kaydı üretime yazmak, veriyi tamamen silmekle aynı sonucu verir. */
  const tanidik = [...DIZI_ALANLAR, ...NESNE_ALANLAR].filter((a) => a in yedek);
  if (tanidik.length === 0) {
    hatalar.push("Bu belge Marcus OS verisine benzemiyor — tanınan hiçbir alan yok.");
  }

  return { gecerli: hatalar.length === 0, hatalar };
}

/**
 * KAYIP ÖZETİ — bu yedeğe dönersem ne kaybederim?
 *
 * Yanlış tarihe dönmenin en yaygın sebebi, yedeğin içinde ne olduğunu görmeden karar
 * vermekti. Alan alan fark çıkarılıyor; azalanlar listenin başında.
 */
export function kayipOzeti(yedek, mevcut) {
  const y = yedek && typeof yedek === "object" ? yedek : {};
  const m = mevcut && typeof mevcut === "object" ? mevcut : {};
  const alanlar = [...new Set([...Object.keys(m), ...Object.keys(y)])].filter((a) => !a.startsWith("_"));

  const satirlar = alanlar.map((alan) => {
    const simdi = sayi(m[alan]);
    const yedekte = sayi(y[alan]);
    return { alan, simdi, yedekte, fark: yedekte - simdi };
  }).filter((x) => x.fark !== 0).sort((a, b) => a.fark - b.fark);

  const kaybolan = satirlar.filter((x) => x.fark < 0);
  return {
    satirlar,
    kaybolanAlanSayisi: kaybolan.length,
    toplamKaybolanKayit: kaybolan.reduce((t, x) => t + Math.abs(x.fark), 0),
  };
}

/**
 * TAM DEĞERLENDİRME — arayüzün ve ucun kullandığı tek giriş.
 *
 * `mevcut` verilmezse yalnızca yapı doğrulanır (kayıp hesaplanamaz, uyarı üretilmez).
 */
export function yedekDegerlendir(yedek, mevcut) {
  const yapi = yapiDogrula(yedek);
  if (!yapi.gecerli) {
    return { gecerli: false, hatalar: yapi.hatalar, uyarilar: [], kayip: null };
  }

  const uyarilar = [];
  let kayip = null;

  if (mevcut && typeof mevcut === "object") {
    kayip = kayipOzeti(yedek, mevcut);
    kayip.satirlar.filter((x) => x.fark < 0).forEach((x) => {
      /* Oran, mevcut sayıya göre: 100 kayıttan 30'unu kaybetmek ile 3 kayıttan
       * 1'ini kaybetmek aynı şey değil. */
      const oran = x.simdi > 0 ? Math.abs(x.fark) / x.simdi : 0;
      if (oran >= KAYIP_UYARI_ORANI) {
        uyarilar.push(`\`${x.alan}\`: ${x.simdi} → ${x.yedekte} (${Math.abs(x.fark)} kayıt kaybolacak)`);
      }
    });

    /* MEVCUTTA OLUP YEDEKTE HİÇ OLMAYAN ALAN. Alan tamamen kaybolur; kod onu
     * `|| []` ile karşılasa bile içindeki veri gider. */
    Object.keys(mevcut).filter((a) => !a.startsWith("_") && !(a in yedek) && sayi(mevcut[a]) > 0)
      .forEach((a) => uyarilar.push(`\`${a}\` bu yedekte HİÇ YOK — ${sayi(mevcut[a])} kayıt gidecek.`));
  }

  return { gecerli: true, hatalar: [], uyarilar, kayip };
}
