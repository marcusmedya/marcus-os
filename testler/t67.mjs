/* ŞUBE BAZLI İÇERİK KULLANIMI — HESAP KATMANI (Adım 1)
 *
 * İHTİYAÇ: çok şubeli markalarda aynı içerik bazı şubelerde aynı gün, bazılarında farklı
 * günlerde paylaşılıyor; bazı içerikler tek bir şubeye özel. "Bu içeriği bu şubede
 * paylaşmış mıydık?" sorusu Drive'a bakılarak aranıyor ve şubeler atlanıyordu.
 *
 * TEMEL KURAL: 1 içerik = 1 kart = 1 Drive dosyası. Aynı dosya her şube için TEKRAR
 * YÜKLENMEZ; şube bilgisi Marcus OS'ta durur.
 *
 * MODEL: bir içeriğin bir şubede kullanımı, zaten var olan `haftalikPaylasimlar` kaydıdır.
 * Yeni koleksiyon açılmadı; o kayda `subeId` eklendi. `subeId` taşımayan kayıt MARKA GENELİ
 * sayılır — "bilinmeyen şube" değil. Bugünkü tüm kayıtlar böyledir.
 *
 * BU DOSYA yalnızca hesap katmanını sınar. Hiçbir uç henüz değişmedi; uygulamanın
 * davranışı bu adımda aynı.
 */
import {
  planSubesi, subeStokAnahtari, markaninSubeleri, kullanabilenSubeler,
  icerikSubeDurumu, icerikSubeTarihi, icerikSubeOzeti,
  planlananlarTamamlandiMi, enAzBirSubedePaylasildi, subeListeleri, hazirIcerikSayisi,
} from "../lib/sube-kullanimi.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* Senaryo: Smell Coffee (clientId 3), dört şube. */
const SUBELER = [
  { id: "lara", clientId: 3, ad: "Smell Lara" },
  { id: "kony", clientId: 3, ad: "Smell Konyaaltı" },
  { id: "old",  clientId: 3, ad: "Smell Old Town" },
  { id: "dord", clientId: 3, ad: "Smell Dördüncü" },
  { id: "bsk",  clientId: 9, ad: "BAŞKA MARKANIN ŞUBESİ" },
];
const VID024 = { id: 24, marka: "Smell Coffee", icerikTuru: "SMELL-VID-024", asama: "Onaylandı" };
const OZEL   = { id: 25, marka: "Smell Coffee", icerikTuru: "OLD-TOWN-ÖZEL", asama: "Onaylandı",
                 sadeceSubeler: ["old"] };
const HENUZ  = { id: 26, marka: "Smell Coffee", icerikTuru: "YENİ", asama: "Onaylandı" };

/* ---------------------------------------------------------------- */
console.log("\n1) GERİYE UYUMLULUK — şubesiz kayıt marka geneli sayılıyor");

t("subeId yoksa marka geneli", planSubesi({ id: 1 }) === null);
t("boş subeId de marka geneli", planSubesi({ subeId: "" }) === null && planSubesi({ subeId: null }) === null);
t("dolu subeId okunuyor", planSubesi({ subeId: "lara" }) === "lara");
t("sayısal subeId metne çevriliyor", planSubesi({ subeId: 7 }) === "7",
  "kimlikler bazen sayı bazen metin — karşılaştırma tek tip olmalı");

/* ---------------------------------------------------------------- */
console.log("\n2) BİR İÇERİĞİ HANGİ ŞUBELER KULLANABİLİR");

t("markanın şubeleri süzülüyor",
  markaninSubeleri(SUBELER, 3).length === 4, "başka markanın şubesi karışmamalı");
t("genel içerik TÜM şubelerde kullanılabilir",
  kullanabilenSubeler(VID024, SUBELER, 3).length === 4);
t("alan hiç yoksa da genel sayılıyor",
  kullanabilenSubeler({ id: 1 }, SUBELER, 3).length === 4,
  "bugünkü kartlarda bu alan yok — hepsi genel içerik");
t("boş dizi de genel sayılıyor",
  kullanabilenSubeler({ id: 1, sadeceSubeler: [] }, SUBELER, 3).length === 4);
t("ŞUBEYE ÖZEL içerik yalnızca o şubede",
  kullanabilenSubeler(OZEL, SUBELER, 3).map((s) => s.id).join() === "old",
  "diğer şubelerde 'kullanılabilir içerik' olarak görünmemeli");
t("başka markanın şubesi hiç girmiyor",
  kullanabilenSubeler(VID024, SUBELER, 3).every((s) => String(s.clientId) === "3"));

/* ---------------------------------------------------------------- */
console.log("\n3) ŞİKÂYETİN KENDİSİ — SMELL-VID-024'ün şube durumu");

/* Lara ve Konyaaltı 22 Ağustos'ta paylaştı, Old Town ve dördüncü şube henüz kullanmadı. */
let PLANLAR = [
  { id: "p1", isId: 24, subeId: "lara", tur: "Video", yapildi: true,  yapildigiTarih: "22.08.2026" },
  { id: "p2", isId: 24, subeId: "kony", tur: "Video", yapildi: true,  yapildigiTarih: "22.08.2026" },
];

t("Lara: paylaşıldı", icerikSubeDurumu(24, "lara", PLANLAR) === "paylasildi");
t("Lara tarihi doğru", icerikSubeTarihi(24, "lara", PLANLAR) === "22.08.2026");
t("Old Town: hiç kullanılmadı", icerikSubeDurumu(24, "old", PLANLAR) === "kullanilmadi");
t("Old Town'ın tarihi yok", icerikSubeTarihi(24, "old", PLANLAR) === null);

const ozet = icerikSubeOzeti(VID024, SUBELER, PLANLAR, 3);
t("özet dört şubeyi de listeliyor", ozet.length === 4);
t("özet Drive'a bakmadan cevap veriyor",
  ozet.filter((x) => x.durum === "paylasildi").length === 2
  && ozet.filter((x) => x.durum === "kullanilmadi").length === 2,
  ozet.map((x) => `${x.subeAdi}:${x.durum}`).join(" · "));

/* Bir hafta sonra Old Town için PLANLANIYOR — dosya tekrar yüklenmiyor. */
PLANLAR = [...PLANLAR,
  { id: "p3", isId: 24, subeId: "old", tur: "Video", yapildi: false, gun: "Cum" }];

t("Old Town artık PLANLANDI", icerikSubeDurumu(24, "old", PLANLAR) === "planlandi");
t("planlanan henüz paylaşılmış sayılmıyor", icerikSubeTarihi(24, "old", PLANLAR) === null);
t("Lara etkilenmedi", icerikSubeDurumu(24, "lara", PLANLAR) === "paylasildi");
t("dördüncü şube hâlâ kullanılmadı", icerikSubeDurumu(24, "dord", PLANLAR) === "kullanilmadi");

/* Old Town 29 Ağustos'ta paylaştı. */
PLANLAR = PLANLAR.map((p) => (p.id === "p3" ? { ...p, yapildi: true, yapildigiTarih: "29.08.2026" } : p));
t("Old Town paylaşıldı olarak geçmişe geçti",
  icerikSubeDurumu(24, "old", PLANLAR) === "paylasildi"
  && icerikSubeTarihi(24, "old", PLANLAR) === "29.08.2026");

/* ---------------------------------------------------------------- */
console.log("\n4) KART AŞAMASI — ne zaman 'Paylaşılıyor', ne zaman 'Teslim Edildi'");

t("hiç plan yokken tamamlanmış sayılmıyor", planlananlarTamamlandiMi(26, PLANLAR) === false,
  "plansız bir kart 'tamamlandı' olamaz");
t("hiç plan yokken paylaşılmış da sayılmıyor", enAzBirSubedePaylasildi(26, PLANLAR) === false);
t("en az bir şube paylaştıysa işaretli", enAzBirSubedePaylasildi(24, PLANLAR) === true,
  "kart 'Şubelerde Paylaşılıyor' aşamasına burada geçiyor");
t("PLANLANANLAR bitince tamamlandı", planlananlarTamamlandiMi(24, PLANLAR) === true,
  "dördüncü şube hiç PLANLANMADI — planlanmamış şube kartı bekletmemeli");

{
  const bekleyen = [...PLANLAR, { id: "p4", isId: 24, subeId: "dord", tur: "Video", yapildi: false }];
  t("bekleyen plan varsa tamamlanmadı", planlananlarTamamlandiMi(24, bekleyen) === false,
    "kart 'Teslim Edildi'ye geçmemeli");
}

/* ---------------------------------------------------------------- */
console.log("\n5) BİR ŞUBENİN ÜÇ LİSTESİ");

const ISLER = [VID024, OZEL, HENUZ];
const hazirMi = (is) => is.asama === "Onaylandı";
{
  const old = subeListeleri("old", ISLER, PLANLAR, SUBELER, 3, hazirMi);
  t("Old Town'da paylaşılan: VID-024", old.paylasilan.length === 1 && old.paylasilan[0].is.id === 24);
  t("paylaşılanın tarihi geliyor", old.paylasilan[0].tarih === "29.08.2026");
  t("Old Town'da kullanılmamış: özel + yeni", old.kullanilmamis.length === 2,
    old.kullanilmamis.map((x) => x.is.icerikTuru).join(", "));

  const lara = subeListeleri("lara", ISLER, PLANLAR, SUBELER, 3, hazirMi);
  t("Lara'da ŞUBEYE ÖZEL içerik GÖRÜNMÜYOR",
    !lara.kullanilmamis.some((x) => x.is.id === 25) && !lara.paylasilan.some((x) => x.is.id === 25),
    "yalnızca Old Town için çekilen içerik başka şubede önerilmemeli");
  t("Lara'da kullanılmamış: yalnızca yeni içerik",
    lara.kullanilmamis.length === 1 && lara.kullanilmamis[0].is.id === 26);

  const dord = subeListeleri("dord", ISLER, PLANLAR, SUBELER, 3, hazirMi);
  t("dördüncü şubede VID-024 hâlâ KULLANILABİLİR",
    dord.kullanilmamis.some((x) => x.is.id === 24),
    "başka şubelerde paylaşılmış olması burada kullanılmasını engellemez");
}
{
  const planli = [...PLANLAR, { id: "p9", isId: 26, subeId: "lara", tur: "Video", yapildi: false }];
  const lara = subeListeleri("lara", ISLER, planli, SUBELER, 3, hazirMi);
  t("planlanan liste ayrı duruyor", lara.planlanan.length === 1 && lara.planlanan[0].is.id === 26);
  t("planlanan artık kullanılmamış sayılmıyor", lara.kullanilmamis.length === 0);
}
{
  const hazirOlmayan = [...ISLER, { id: 99, marka: "Smell Coffee", asama: "Edit Bekliyor" }];
  const lara = subeListeleri("lara", hazirOlmayan, PLANLAR, SUBELER, 3, hazirMi);
  t("onaylanmamış kart listelerde yok",
    !lara.kullanilmamis.some((x) => x.is.id === 99), "henüz müşteri onayı yok");
}

/* ---------------------------------------------------------------- */
console.log("\n6) ÇEKİM LİSTESİ — kaç FARKLI içerik hazır");

t("hiç paylaşılmamış içerikler sayılıyor",
  hazirIcerikSayisi(ISLER, [], hazirMi) === 3, "üçü de hazır, hiçbiri kullanılmadı");
t("ilk şubede paylaşılan DÜŞÜYOR",
  hazirIcerikSayisi(ISLER, PLANLAR, hazirMi) === 2,
  "VID-024 kullanıldı; dört şubede kullanılacak tek video yine tek çekim demek");
t("şube sayısı kadar ÇARPILMIYOR",
  hazirIcerikSayisi(ISLER, PLANLAR, hazirMi) < 4,
  "şubelerin toplamı sayılsaydı ekran bol stok gösterir, çekim yapılmazdı");
t("onaylanmamış kart sayılmıyor",
  hazirIcerikSayisi([...ISLER, { id: 99, asama: "Edit Bekliyor" }], PLANLAR, hazirMi) === 2);

/* ---------------------------------------------------------------- */
console.log("\n7) ŞUBE STOK ANAHTARI");

t("şube anahtarı genel anahtardan ayrı",
  subeStokAnahtari(3, "lara", "Video") === "3_lara_Video");
t("bugünkü biçimle birebir aynı",
  subeStokAnahtari(3, "lara", "Video") === `${3}_${"lara"}_${"Video"}`,
  "mevcut şube stokları bozulmamalı");

/* ---------------------------------------------------------------- */
console.log("\n8) ESKİ KAYITLAR — marka geneli planlar karışmıyor");

{
  const eski = [{ id: "e1", isId: 24, tur: "Video", yapildi: true, yapildigiTarih: "01.08.2026" }];
  t("şubesiz plan hiçbir şubeye sayılmıyor",
    icerikSubeDurumu(24, "lara", eski) === "kullanilmadi",
    "marka geneli kayıt, 'Lara'da paylaşıldı' demek değil");
  t("marka geneli olarak okunabiliyor",
    icerikSubeDurumu(24, null, eski) === "paylasildi");
  t("eski kayıt da 'en az bir yerde paylaşıldı' sayılıyor",
    enAzBirSubedePaylasildi(24, eski) === true,
    "şubesiz markalarda bugünkü davranış aynen sürmeli");
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
