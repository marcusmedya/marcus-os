/* ŞUBE BAZLI PAYLAŞIM — SUNUCU (Adım 2/4)
 *
 * Adım 1 hesap katmanıydı, hiçbir uç değişmemişti. Bu adımda sunucu gerçekten şube
 * biliyor. Senaryo: Smell Coffee, dört şube, tek video.
 *
 * ÜÇ KURAL BU TESTİN ASIL İŞİ:
 *
 * 1. AYNI KART FARKLI ŞUBELERDE PLANLANABİLİR. Eski kural "bu kart zaten bir plana bağlı"
 *    diyerek her ikinci planı reddediyordu; çok şubeliliği tam olarak bu kesiyordu. Kural
 *    kaldırılmadı, ŞUBE BAZINA daraltıldı — aynı şubede iki kez hâlâ yasak.
 *
 * 2. KART İLK PAYLAŞIMDA "Şubelerde Paylaşılıyor"A GEÇER. Operasyon panosunda GÖRÜNÜR
 *    kalır ki bekleyen şubeler unutulmasın; stok da orada düşer (stok motoru "Onaylandı"dan
 *    çıkışa bakıyor). Planlanan tüm şubeler bitince "Teslim Edildi". Drive'a taşıma o an.
 *
 * 3. GENEL STOK BİR KEZ, ŞUBE STOĞU AYRI. Dört şubede kullanılan tek video yine tek
 *    içerik: genel stok bir düşer. Her şubenin sayacı ise kendi payını takip eder.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "2";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { SUBE_PAYLASIM_ASAMASI, asamaListesi } from "../lib/asamalar.js";
import { MUSTERI_ASAMA_DURUM } from "../lib/musteri-gorunumu.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const KEY = "marcus-os-data";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: paylasimUcu } = await import("../api/paylasim.js");
const gonder = (govde) => cagir(paylasimUcu, { method: "POST", headers: OWNER, body: govde });
const oku = () => kv.get(KEY);

const SUBELER = [
  { id: "lara", clientId: 1, ad: "Smell Lara" },
  { id: "kony", clientId: 1, ad: "Smell Konyaaltı" },
  { id: "old",  clientId: 1, ad: "Smell Old Town" },
  { id: "dord", clientId: 1, ad: "Smell Dördüncü" },
];
const TEMEL = () => ({
  _v: 5, _alanSurumleri: { stoklar: 1, haftalikPaylasimlar: 1, cekimIsleri: 1 },
  clients: [{ id: 1, ad: "Smell Coffee" }],
  cekimIsleri: [{ id: 24, marka: "Smell Coffee", kategori: "Video", icerikTuru: "SMELL-VID-024",
                 asama: "Onaylandı", stokSayildi: true,
                 medya: [{ slot: "1", versiyon: 1, dosyaId: "x" }] }],
  subeler: SUBELER,
  stoklar: { "1_Reels": 1, "1_lara_Reels": 1, "1_kony_Reels": 1, "1_old_Reels": 1, "1_dord_Reels": 1 },
  haftalikPaylasimlar: [], paylasimGecmisi: [], gunlukKontrol: null,
  musteriIcerikleri: [], musteriTalepleri: [], reklamlar: [], uyelikler: [],
  personelHesaplari: [], musteriHesaplari: [],
});
const sifirla = async () => { await kv.flushall(); await kv.set(KEY, TEMEL()); };
const plan = (subeId, gun) => gonder({ action: "haftalikEkle", clientId: 1, gun, tur: "Video", isId: 24, subeId });
const isaretle = async (subeId) => {
  const p = (await oku()).haftalikPaylasimlar.find((x) => String(x.subeId) === String(subeId));
  return gonder({ action: "haftalikToggle", planId: p.id });
};
const kart = async () => (await oku()).cekimIsleri[0];
const stok = async (a) => ((await oku()).stoklar || {})[a] || 0;

/* ---------------------------------------------------------------- */
console.log("\n1) AŞAMA TABLOSU");

t("yeni aşama üç kategoride de var",
  ["Video", "Fotoğraf", "Grafik Tasarım"].every((kt) => asamaListesi(kt).includes(SUBE_PAYLASIM_ASAMASI)));
t("Onaylandı ile Teslim Edildi ARASINDA",
  asamaListesi("Video").indexOf("Onaylandı") < asamaListesi("Video").indexOf(SUBE_PAYLASIM_ASAMASI)
  && asamaListesi("Video").indexOf(SUBE_PAYLASIM_ASAMASI) < asamaListesi("Video").indexOf("Teslim Edildi"));
t("müşteri panelinde 'onaylandı' görünüyor",
  MUSTERI_ASAMA_DURUM[SUBE_PAYLASIM_ASAMASI] === "onaylandi",
  "eşleme olmasaydı kart müşteri panelinden sessizce kaybolurdu");

/* ---------------------------------------------------------------- */
console.log("\n2) ŞİKÂYETİN KENDİSİ — aynı kart dört şubede planlanabiliyor");

await sifirla();
{
  const a = await plan("lara", "Pzt");
  const b = await plan("kony", "Pzt");
  const c = await plan("old", "Cum");
  t("aynı kart ÜÇ ayrı şubede planlanabildi", a.kod === 200 && b.kod === 200 && c.kod === 200,
    `${a.kod}/${b.kod}/${c.kod} — eski kural ikinciyi reddediyordu`);
  t("üç plan kaydı oluştu", (await oku()).haftalikPaylasimlar.length === 3);
  t("şube adı kayda kopyalandı",
    (await oku()).haftalikPaylasimlar.every((p) => p.subeAdi && p.subeId),
    "şube silinse bile geçmişte adı okunabilsin");

  const tekrar = await plan("lara", "Sal");
  t("AYNI şubede ikinci plan hâlâ REDDEDİLİYOR", tekrar.kod === 400,
    "kural kaldırılmadı, şube bazına daraltıldı");
  t("hata mesajı şubeyi söylüyor", /Lara/.test(tekrar.govde.error || ""), tekrar.govde.error);

  const yokSube = await gonder({ action: "haftalikEkle", clientId: 1, gun: "Prş", tur: "Video", isId: 24, subeId: "olmayan" });
  t("olmayan şube reddediliyor", yokSube.kod === 400);
}

/* ---------------------------------------------------------------- */
console.log("\n3) KART AŞAMASI — ilk paylaşımda görünür kalıyor");

await sifirla();
{
  await plan("lara", "Pzt"); await plan("kony", "Pzt"); await plan("old", "Cum");
  t("başlangıçta Onaylandı", (await kart()).asama === "Onaylandı");

  await isaretle("lara");
  t("ilk şube paylaşınca 'Şubelerde Paylaşılıyor'", (await kart()).asama === SUBE_PAYLASIM_ASAMASI,
    "gelen: " + (await kart()).asama);
  t("kart Operasyon panosunda GÖRÜNÜR kalıyor", (await kart()).asama !== "Teslim Edildi",
    "bekleyen şubeler unutulmasın diye");
  t("teslim tarihi HENÜZ yazılmadı", !(await kart()).teslimEdilmeTarihi,
    "iş bitmedi — iki şube bekliyor");
  t("kart geçmişine bekleyen şube notu düştü",
    ((await kart()).gecmis || []).some((x) => /diğer planlanan şubeler bekliyor/i.test(x.aciklama || "")));

  await isaretle("kony");
  t("ikinci şubeden sonra hâlâ bekliyor", (await kart()).asama === SUBE_PAYLASIM_ASAMASI);

  await isaretle("old");
  t("PLANLANAN tüm şubeler bitince 'Teslim Edildi'", (await kart()).asama === "Teslim Edildi",
    "dördüncü şube hiç planlanmadı — planlanmamış şube kartı bekletmemeli");
  t("teslim tarihi şimdi yazıldı", Boolean((await kart()).teslimEdilmeTarihi));
}

/* ---------------------------------------------------------------- */
console.log("\n4) STOK — genel bir kez, şube ayrı");

await sifirla();
{
  await plan("lara", "Pzt"); await plan("kony", "Pzt"); await plan("old", "Cum");
  t("başlangıç: genel 1, her şube 1",
    (await stok("1_Reels")) === 1 && (await stok("1_lara_Reels")) === 1 && (await stok("1_old_Reels")) === 1);

  await isaretle("lara");
  t("GENEL stok ilk paylaşımda düştü", (await stok("1_Reels")) === 0,
    "dört şubede kullanılan tek video, yine tek içerik");
  t("Lara'nın stoğu düştü", (await stok("1_lara_Reels")) === 0);
  t("Konyaaltı'nın stoğu DOKUNULMADI", (await stok("1_kony_Reels")) === 1,
    "her şube kendi payını takip ediyor");

  await isaretle("kony");
  t("genel stok İKİNCİ kez düşmedi", (await stok("1_Reels")) === 0, "eksiye kaymamalı");
  t("Konyaaltı düştü", (await stok("1_kony_Reels")) === 0);
  t("Old Town hâlâ bekliyor", (await stok("1_old_Reels")) === 1);
  t("hiç planlanmayan şube etkilenmedi", (await stok("1_dord_Reels")) === 1);
}

/* ---------------------------------------------------------------- */
console.log("\n5) GERİ ALMA — işaret kaldırılınca eski hâle dönüyor");

await sifirla();
{
  await plan("lara", "Pzt"); await plan("kony", "Pzt");
  await isaretle("lara"); await isaretle("kony");
  t("iki şube bitince teslim edildi", (await kart()).asama === "Teslim Edildi");

  await isaretle("kony");   // geri al
  t("geri alınca 'Şubelerde Paylaşılıyor'a döndü", (await kart()).asama === SUBE_PAYLASIM_ASAMASI,
    "gelen: " + (await kart()).asama);
  t("Konyaaltı stoğu geri geldi", (await stok("1_kony_Reels")) === 1);

  await isaretle("lara");   // onu da geri al
  t("hepsi geri alınınca 'Onaylandı'", (await kart()).asama === "Onaylandı");
  t("genel stok geri geldi", (await stok("1_Reels")) === 1);
  t("Lara stoğu geri geldi", (await stok("1_lara_Reels")) === 1);
}

/* ---------------------------------------------------------------- */
console.log("\n6) GEÇMİŞ — hangi içerik hangi şubede");

await sifirla();
{
  await plan("lara", "Pzt");
  await isaretle("lara");
  const kayit = (await oku()).paylasimGecmisi.slice(-1)[0];
  t("geçmişte şube kimliği var", kayit.subeId === "lara", JSON.stringify(kayit));
  t("geçmişte kart kimliği var", String(kayit.isId) === "24",
    "'bu içerik bu şubede paylaşıldı mı' sorusunun asıl kaynağı");
  t("marka metni şube adını da gösteriyor", /Lara/.test(kayit.marka || ""));
}

/* ---------------------------------------------------------------- */
console.log("\n7) ŞUBESİZ MARKA — bugünkü davranış birebir aynı");

await sifirla();
{
  await kv.set(KEY, { ...TEMEL(), subeler: [] });
  const p = await gonder({ action: "haftalikEkle", clientId: 1, gun: "Pzt", tur: "Video", isId: 24 });
  t("şubesiz plan eklenebiliyor", p.kod === 200);
  t("subeId null olarak kaydedildi", (await oku()).haftalikPaylasimlar[0].subeId === null);

  const planId = (await oku()).haftalikPaylasimlar[0].id;
  await gonder({ action: "haftalikToggle", planId });
  t("kart DOĞRUDAN 'Teslim Edildi'ye geçiyor", (await kart()).asama === "Teslim Edildi",
    "ara aşama şubesiz markada hiç kullanılmıyor — gelen: " + (await kart()).asama);
  t("genel stok düştü", (await stok("1_Reels")) === 0);
  t("ikinci kez plan REDDEDİLİYOR",
    (await gonder({ action: "haftalikEkle", clientId: 1, gun: "Sal", tur: "Video", isId: 24 })).kod === 400,
    "marka geneli kart için eski kural aynen geçerli");
}

/* ---------------------------------------------------------------- */
console.log("\n8) ŞUBE SİLME — planı olan şube sessizce silinmiyor");

await sifirla();
{
  await plan("lara", "Pzt");
  await isaretle("lara");
  const sil = await gonder({ action: "subeSil", subeId: "lara" });
  t("planı olan şube uyarı veriyor", sil.kod === 409, "gelen: " + sil.kod);
  t("onay gerektiği bildiriliyor", sil.govde.onayGerekli === true);
  t("kaç kayıt olduğu söyleniyor", sil.govde.planSayisi === 1 && sil.govde.paylasilanSayisi === 1);
  t("şube HENÜZ silinmedi", (await oku()).subeler.length === 4);

  const onayli = await gonder({ action: "subeSil", subeId: "lara", onayliSil: true });
  t("onaylanınca siliniyor", onayli.kod === 200 && (await oku()).subeler.length === 3);
  t("GEÇMİŞ silinmiyor", (await oku()).haftalikPaylasimlar.length === 1,
    "şube adı kayıtta kopyalı — neyin nerede paylaşıldığı okunabilir");
  t("şube adı hâlâ okunuyor", (await oku()).haftalikPaylasimlar[0].subeAdi === "Smell Lara");

  const bosSube = await gonder({ action: "subeSil", subeId: "dord" });
  t("planı olmayan şube doğrudan siliniyor", bosSube.kod === 200);
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
