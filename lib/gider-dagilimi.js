/**
 * GİDER DAĞILIMI — "Para Nereye Gidiyor?" panelinin çekirdeği.
 *
 * NEDEN AYRI MODÜL: kural bir süre `src/finans.jsx` içinde, JSX'in ortasında bir dizi
 * sabiti olarak duruyordu. Orada duran hiçbir kural Node'dan çağrılamıyor, yani hiçbir
 * test onu sınayamıyor (→ `marcus-mimari` §4). Dağılımın kendisi — hangi kalem var,
 * sırası ne, oranı kaç — artık burada ve sınanabiliyor; JSX yalnızca çiziyor.
 *
 * İKİNCİ SEBEP, ASIL SEBEP: eski ekran `.filter((x) => x.tutar > 0)` yapıyordu. Tutarı
 * sıfır olan kalem EKRANDAN TAMAMEN KAYBOLUYORDU. "Freelancer iş ücretleri" satırının
 * yokluğu iki farklı şey demek olabiliyordu ve ikisi ayırt edilemiyordu:
 *   a) bu ay freelancer'a hiç iş verilmedi,
 *   b) işler teslim edildi ama ücretleri girilmedi — yani GİDER EKSİK, kâr olduğundan
 *      yüksek görünüyor.
 * Sıfır artık saklanmıyor: kalem listede duruyor ve NEDEN sıfır olduğu yazıyor.
 * Eksikliği söylemek, sessizce sıfır yazmaktan her zaman iyidir.
 *
 * SAF: `Date`, `process.env`, `window`, tema ya da ağ yok. Girdi DEĞİŞTİRİLMEZ, her
 * çağrıda yeni nesne döner — dönüş değeri atılırsa satır hiçbir şey yapmaz (denetim 24).
 *
 * HESAP DEĞİŞMEZ: rakamların hepsi `computeLive` çıktısından OLDUĞU GİBİ okunur; burada
 * hiçbir tutar yeniden hesaplanmaz. `toplam` da altı kalemin toplamı, yani
 * `computeLive`'ın `gider` alanıyla aynı büyüklük — oranların toplamının 1 etmesi bu
 * özdeşliğe dayanıyor.
 */

/**
 * Kalem tanımları. SIRA ÖNEMLİ: tutarı sıfır olanlar ekranın altında bu sırayla
 * dizilir; her koşuda aynı yerde durmaları için sabit tutuluyor.
 *
 * `sebep` metni tutar sıfırken gösterilir ve kullanıcıya NEREYE BAKACAĞINI söyler —
 * "kayıt yok" demek yetmiyor (→ `marcus-design`, boş durum kuralı).
 */
const KALEMLER = [
  { anahtar: "personel", ad: "Personel", alan: "personelGideri", sebep: "Personel kaydı yok" },
  { anahtar: "ofis", ad: "Ofis gideri", alan: "ofisGiderToplam", sebep: "Ofis gideri eklenmemiş" },
  { anahtar: "musteri", ad: "Müşteri maliyetleri", alan: "clientCosts", sebep: "Müşteri kartlarında maliyet kalemi yok" },
  { anahtar: "freelancer", ad: "Freelancer iş ücretleri", alan: "freelancerGideri", sebep: "Operasyon'da bu ay teslim edilen işlere ücret girilmemiş" },
  { anahtar: "uyelik", ad: "Üyelikler", alan: "uyelikGideri", sebep: "Aktif üyelik yok" },
  { anahtar: "diger", ad: "Diğer gider kalemleri", alan: "giderKalemToplam", sebep: "Gelir-Gider sekmesinde kalem yok" },
];

const sayi = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * Bu ayın gider dağılımı.
 *
 * @param live `computeLive(data)` çıktısı (eksik/`null` olabilir — o zaman her kalem sıfır)
 * @returns {{ toplam: number, kalemler: Array<{anahtar: string, ad: string, tutar: number, oran: number, sebep: string|null}> }}
 *   `oran` 0–1 arası bir SAYI; yüzde metni değil. Biçim çağıranın işi: bu uygulamada
 *   tutarlar Gizlilik Modu'ndan geçiyor ve modül tema bilmiyor.
 *   `sebep` tutarı olan kalemde `null`, sıfır kalemde kısa bir açıklama.
 */
export function giderDagilimi(live) {
  const L = live || {};
  const ham = KALEMLER.map((k) => ({
    anahtar: k.anahtar,
    ad: k.ad,
    tutar: sayi(L[k.alan]),
    sebep: k.sebep,
  }));

  const toplam = ham.reduce((s, k) => s + (k.tutar > 0 ? k.tutar : 0), 0);

  /* SIRALAMA İKİ KATMAN: önce tutarı olanlar büyükten küçüğe, sonra sıfırlar TANIM
   * SIRASIYLA. `sort` dizinin kendisini değiştirdiği için üstte `map` ile yeni bir dizi
   * üretildi — `KALEMLER` sabitine ya da çağıranın nesnesine dokunulmuyor. */
  const sirali = ham
    .map((k, i) => ({ ...k, i }))
    .sort((a, b) => {
      const aVar = a.tutar > 0, bVar = b.tutar > 0;
      if (aVar !== bVar) return aVar ? -1 : 1;
      if (aVar && a.tutar !== b.tutar) return b.tutar - a.tutar;
      return a.i - b.i;
    });

  const kalemler = sirali.map((k) => ({
    anahtar: k.anahtar,
    ad: k.ad,
    tutar: k.tutar,
    oran: toplam > 0 && k.tutar > 0 ? k.tutar / toplam : 0,
    sebep: k.tutar > 0 ? null : k.sebep,
  }));

  return { toplam, kalemler };
}

/**
 * Oranın ekranda yazılışı. Ayrı bir fonksiyon, çünkü JSX'in içine gömülen her kural
 * sınanamaz hâle geliyor.
 *
 * KÜÇÜK PAY YUVARLANIP KAYBOLMAMALI: %1'in altındaki bir kalem tam sayıya yuvarlanınca
 * "%0" yazıyor ve gerçekten sıfır olan kalemden ayırt edilemiyor. Bu yüzden %1 altında
 * bir ondalık basamak yazılır ("%0,8"), üstünde tam sayı — altı satırın yan yana okunması
 * gereken bir ekranda gereksiz ondalık gürültüdür.
 */
export function yuzdeMetni(oran) {
  const y = sayi(oran) * 100;
  if (y > 0 && y < 1) return `%${y.toFixed(1).replace(".", ",")}`;
  return `%${Math.round(y)}`;
}
