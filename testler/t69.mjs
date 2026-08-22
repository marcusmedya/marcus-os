/* ŞUBE BAZLI PAYLAŞIM — ARAYÜZ KURALLARI (Adım 3/4)
 *
 * Adım 3 arayüzü bağladı: şube görünümü (paylaşılanlar / planlananlar / hiç
 * kullanılmamışlar), marka kartında şube stokları ve çekim listesinin yeni sayımı.
 * Arayüzün kendisi Node'da çalıştırılamıyor; ama arayüzün DAYANDIĞI kurallar
 * lib/sube-kullanimi.js içinde saf fonksiyon olarak duruyor — asıl sınanan onlar.
 *
 * ÜÇ KURAL:
 *
 * 1. ÜÇ LİSTE DOĞRU AYRILIYOR. Bir şubede duran içerik ya paylaşıldı, ya planlandı,
 *    ya da hiç kullanılmadı. Yanlış ayrım "bu şubede zaten paylaştık" sanıp aynı
 *    içeriği ikinci kez planlatır — çok şubeliliğin tam olarak çözmesi gereken hata.
 *
 * 2. ŞUBEYE KAPALI İÇERİK O ŞUBEDE HİÇ GÖRÜNMEZ. sadeceSubeler dolu olan kart
 *    başka şubenin listesine düşerse, kullanıcı yanlış şubede paylaşır.
 *
 * 3. ÇEKİM LİSTESİ STOĞU DEĞİL İÇERİĞİ SAYAR. Dört şubede kullanılacak tek video
 *    dört stok üretir ama bir çekimdir. Stok toplamına bakan liste "stok bol"
 *    diyerek çekimi geciktirir. En az bir şubede paylaşılan içerik artık hazır sayılmaz.
 *
 * AYRICA BAĞLANTI ÇİTİ: arayüz bileşenlerine belgede GERÇEKTEN var olan alan
 * geçiliyor mu. Kartlar belgede `cekimIsleri` adıyla duruyor; `data.isler` diye
 * bir alan yok. Yanlış ad hata vermez, sessizce boş dizi geçer ve çekim listesi
 * her markayı "hazır içerik: 0" sanar. Bu hata bu adımda bir kez yapıldı.
 */
import { readFileSync } from "node:fs";
import {
  subeListeleri, hazirIcerikSayisi, icerikSubeOzeti,
  markaninSubeleri, kullanabilenSubeler,
} from "../lib/sube-kullanimi.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};

/* Koruma kırıldığında test ÇÖKMEMELİ — çöken test hiç sonuç yazmaz ve kırma
 * ölçümü "0 düştü" görünür, yani koruma sınanmamış sayılır. */
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  try { fn(); }
  catch (e) { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } }
};

/* Smell Coffee: dört şube, tek marka. */
const CLIENT = 1;
const SUBELER = [
  { id: "lara", ad: "Smell Lara", clientId: 1 },
  { id: "mrkz", ad: "Smell Merkez", clientId: 1 },
  { id: "kepz", ad: "Smell Kepez", clientId: 1 },
  { id: "dord", ad: "Smell Dördüncü", clientId: 1 },
  { id: "baska", ad: "Başka Marka Şubesi", clientId: 2 },
];
const HAZIR = (j) => j.asama === "Onaylandı" || j.asama === "Şubelerde Paylaşılıyor";

const ISLER = [
  { id: 10, marka: "Smell Coffee", icerikTuru: "Genel Video", asama: "Onaylandı" },
  { id: 11, marka: "Smell Coffee", icerikTuru: "Lara'ya Özel", asama: "Onaylandı", sadeceSubeler: ["lara"] },
  { id: 12, marka: "Smell Coffee", icerikTuru: "Paylaşılan Genel", asama: "Şubelerde Paylaşılıyor" },
  { id: 13, marka: "Smell Coffee", icerikTuru: "Taslak", asama: "Çekim Bekliyor" },
];

const PLANLAR = [
  { isId: 12, clientId: 1, subeId: "lara", subeAdi: "Smell Lara", gun: "Pzt", yapildi: true, yapildigiTarih: "2026-08-10" },
  { isId: 12, clientId: 1, subeId: "mrkz", subeAdi: "Smell Merkez", gun: "Sal", yapildi: false },
  { isId: 10, clientId: 1, subeId: "kepz", subeAdi: "Smell Kepez", gun: "Çar", yapildi: false },
];

/* ---------------------------------------------------------------- */
console.log("\n1) ŞUBE GÖRÜNÜMÜ — üç liste");

{
  const lara = subeListeleri("lara", ISLER, PLANLAR, SUBELER, CLIENT, HAZIR);
  t("Lara'da paylaşılan: 12", lara.paylasilan.length === 1 && lara.paylasilan[0].is.id === 12);
  t("paylaşım TARİHİ okunuyor", lara.paylasilan[0].tarih === "2026-08-10",
    "gelen: " + lara.paylasilan[0].tarih);
  t("Lara'da planlanan yok", lara.planlanan.length === 0);
  t("Lara'da hiç kullanılmamış: 10 ve 11",
    lara.kullanilmamis.map((x) => x.is.id).sort().join(",") === "10,11");

  const merkez = subeListeleri("mrkz", ISLER, PLANLAR, SUBELER, CLIENT, HAZIR);
  t("Merkez'de 12 PLANLANAN listesinde", merkez.planlanan.length === 1 && merkez.planlanan[0].is.id === 12,
    "aynı içerik Lara'da paylaşıldı, Merkez'de henüz bekliyor");
  t("Merkez'de paylaşılan yok", merkez.paylasilan.length === 0);

  const kepez = subeListeleri("kepz", ISLER, PLANLAR, SUBELER, CLIENT, HAZIR);
  t("Kepez'de 10 planlanan", kepez.planlanan.length === 1 && kepez.planlanan[0].is.id === 10);
  t("Kepez'de 12 hiç kullanılmamış",
    kepez.kullanilmamis.some((x) => x.is.id === 12));
}

/* ---------------------------------------------------------------- */
console.log("\n2) ŞUBEYE KAPALI İÇERİK — başka şubede hiç görünmüyor");

{
  const lara = subeListeleri("lara", ISLER, PLANLAR, SUBELER, CLIENT, HAZIR);
  const merkez = subeListeleri("mrkz", ISLER, PLANLAR, SUBELER, CLIENT, HAZIR);
  const merkezHepsi = [...merkez.paylasilan, ...merkez.planlanan, ...merkez.kullanilmamis].map((x) => x.is.id);

  t("Lara'ya özel içerik Lara'da GÖRÜNÜYOR", lara.kullanilmamis.some((x) => x.is.id === 11));
  t("Lara'ya özel içerik Merkez'de GÖRÜNMÜYOR", !merkezHepsi.includes(11),
    "gelen: " + merkezHepsi.join(","));

  t("başka markanın şubesi bu markanın listesine karışmıyor",
    markaninSubeleri(SUBELER, CLIENT).every((s) => s.clientId === 1) &&
    markaninSubeleri(SUBELER, CLIENT).length === 4);

  t("sadeceSubeler boşsa tüm şubeler kullanabilir",
    kullanabilenSubeler(ISLER[0], SUBELER, CLIENT).length === 4);
}

/* ---------------------------------------------------------------- */
console.log("\n3) ÇEKİM LİSTESİ — stok değil, farklı içerik sayılıyor");

{
  const hazirMi = HAZIR;
  const sayi = hazirIcerikSayisi(ISLER, PLANLAR, hazirMi);
  t("hazır içerik 2 (10 ve 11)", sayi === 2, "gelen: " + sayi);
  t("hiçbir şubede paylaşılmamış 10 hazır sayılıyor",
    hazirIcerikSayisi([ISLER[0]], PLANLAR, hazirMi) === 1,
    "Kepez'de PLANLI ama daha paylaşılmadı — hâlâ elde");
  t("bir şubede paylaşılan 12 artık hazır DEĞİL",
    hazirIcerikSayisi([ISLER[2]], PLANLAR, hazirMi) === 0);
  t("onaylanmamış taslak sayılmıyor",
    hazirIcerikSayisi([ISLER[3]], PLANLAR, hazirMi) === 0);

  /* Asıl mesele: dört şubelik tek içerik dört stok üretir ama bir çekimdir. */
  const dortSubelikTek = [{ id: 20, marka: "Smell Coffee", asama: "Onaylandı" }];
  t("dört şubede kullanılabilen tek içerik = 1 çekim",
    hazirIcerikSayisi(dortSubelikTek, [], hazirMi) === 1 &&
    kullanabilenSubeler(dortSubelikTek[0], SUBELER, CLIENT).length === 4);
}

/* ---------------------------------------------------------------- */
console.log("\n4) KART SEÇİCİ ÖZETİ — hangi şubede ne oldu");

{
  const ozet = icerikSubeOzeti(ISLER[2], SUBELER, PLANLAR, CLIENT);
  const bul = (id) => ozet.find((x) => x.subeId === id);
  t("özet dört şube için üretiliyor", ozet.length === 4, "gelen: " + ozet.length);
  t("Lara paylaşıldı + tarihli", bul("lara").durum === "paylasildi" && bul("lara").tarih === "2026-08-10");
  t("Merkez planlandı", bul("mrkz").durum === "planlandi");
  t("Kepez hiç kullanılmadı", bul("kepz").durum === "kullanilmadi");

  const ozelOzet = icerikSubeOzeti(ISLER[1], SUBELER, PLANLAR, CLIENT);
  t("şubeye kapalı içeriğin özeti yalnızca o şubeyi içeriyor",
    ozelOzet.length === 1 && ozelOzet[0].subeId === "lara");
}

/* ---------------------------------------------------------------- */
console.log("\n5) BAĞLANTI ÇİTİ — arayüze var olan alan geçiliyor mu");

{
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  /* Belgede `isler` diye bir alan yok; kartlar `cekimIsleri`. Yanlış ad sessizce
   * boş dizi geçirir: çekim listesi her markayı "hazır içerik: 0" sanar ve
   * hiç çekim gerekmeyen markayı listeye sokar. */
  t("belgede olmayan data.isler alanı okunmuyor",
    !/\bdata\.isler\b/.test(app),
    "kartların belge adı cekimIsleri");

  const cagrilar = app.match(/<CekimListesi[^>]*>/g) || [];
  t("CekimListesi çağrıları bulundu", cagrilar.length === 2, "gelen: " + cagrilar.length);
  t("her CekimListesi kartları alıyor",
    cagrilar.every((c) => /isler=\{data\.cekimIsleri/.test(c)));
  t("her CekimListesi planları alıyor",
    cagrilar.every((c) => /plan=\{data\.haftalikPaylasimlar/.test(c)));

  const stokKarti = app.match(/<MarkaStokKarti[^>]*>/g) || [];
  t("MarkaStokKarti şube listesi için kart ve plan alıyor",
    stokKarti.length === 1 && /isler=\{isler\}/.test(stokKarti[0]) && /plan=\{haftalikPlan\}/.test(stokKarti[0]));
}

/* ---------------------------------------------------------------- */
bolum("6) ÇEKİM LİSTESİ SATIRLARI — şube ayrı kart değil, markanın altında", 8, () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const govde = app.slice(app.indexOf("function CekimListesi"), app.indexOf("function CekimListesi") + 6000);

  /* ÖNCE HER ŞUBE KENDİ KARTIYDI: dört şubeli marka listeyi beş satırla dolduruyor,
   * "hangi markaya çekim gerekiyor" sorusu okunamaz hale geliyordu. */
  t("şubeler için AYRI üst düzey satır üretilmiyor",
    !/\(subeler \|\| \[\]\)\.forEach/.test(govde),
    "şube başına gruplar.push eden döngü geri gelmiş");
  t("satır başlığında şube adı yapıştırılmıyor",
    !/g\.sube \? ` — \$\{g\.sube\}`/.test(govde),
    "başlık yalnızca marka adı olmalı");
  t("marka satırı şube dökümü taşıyor", /subeOzetleri/.test(govde));
  t("tıklama dökümü açıp kapatıyor", /setAcikMarka\(acik \? null : g\.anahtar\)/.test(govde));
  /* Yalnızca "setAcikMarka geçiyor mu" demek yetmiyor: tıklama dursa da döküm hiç
   * çizilmeyebilir. Açık durumun ŞUBELERİ GEZDİĞİ sınanıyor. */
  t("açık durumda şubeler gerçekten çiziliyor",
    /\{acik && \([\s\S]{0,300}?g\.subeOzetleri\.map/.test(govde),
    "açık bayrağı şube listesini çizmiyor");
  t("her şubenin kendi stok anahtarı okunuyor", /subeStokAnahtari\(c\.id, sb\.id, tur\)/.test(govde));

  /* Markanın hazır içeriği yeterli olsa bile bir şubenin stoğu dibe vurmuş olabilir;
   * marka listede kalmazsa o şube sessizce boşalır. */
  t("şubesi dibe vuran marka listede kalıyor", /acilSubeVar/.test(govde));
  t("eşik hem markaya hem şubeye uygulanıyor",
    /toplam <= ESIK \|\| acilSubeVar/.test(govde));
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
