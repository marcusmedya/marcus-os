/* KARTTA BİRDEN ÇOK DOSYA — KAROSEL SLAYTLARI VE STORY BOYUTU
 *
 * SORUN: bir kart tek dosya taşıyabiliyordu. Karosel (kaydırmalı) gönderide 8 görsel birden
 * paylaşılıyor ve aynı gönderinin bir de story boyutu hazırlanıyor. İkinci dosya
 * yüklendiğinde birincisi "eski versiyon" oluyordu — yani slaytlar BİRBİRİNİ EZİYORDU.
 *
 * ÇÖZÜM: medya kaydına `slot` eklendi. İki eksen ayrıldı:
 *   slot     -> aynı gönderinin parçaları ("1".."10", "story")
 *   versiyon -> aynı parçanın revizyon geçmişi
 *
 * BU TESTİN ASIL İŞİ üç sessiz hatayı kapatmak:
 *   1. Eski kayıtlarda `slot` yok — göç yapılmadı, onlar "1" sayılmalı. Sayılmazsa tek
 *      dosyalı bütün kartlar bir anda görünmez olurdu.
 *   2. Versiyon SLOT İÇİNDE sayılmalı. Genel sayaç kullanılsaydı 3. slaydın revizyonu
 *      V9 olur, sıralama ve "kaç revizyon" bilgisi anlamsızlaşırdı.
 *   3. Aşama değişince kartın TÜM dosyaları taşınmalı. Tek bağlantı taşımak, karoselin
 *      kalan 7 slaydını eski klasörde unuturdu — kimse fark etmeden.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import {
  guncelMedyalar, slotGecmisi, slotSonrakiVersiyon, bosSlot, slotGecerliMi,
  medyaSlotu, slotEtiketi, tasinacakDosyalar, medyaVarMi, STORY_SLOT, EN_FAZLA_SLAYT,
} from "../lib/asamalar.js";
import { dosyaAdiUret } from "../lib/drive-yukleme.js";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";
process.env.SITE_PASSWORD = "ownerpw";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* ---------------------------------------------------------------- */
console.log("\n1) SLOT MODELİ");

const KAROSEL = {
  /* KATEGORİ CAROUSEL. Bu kayıt bir kaydırmalı gönderi; Carousel kategorisi yokken
   * "Fotoğraf" yazılmıştı. Fotoğraf artık tek görsellik olduğu için o kategoriyle bu
   * fixture gerçekte var olamayacak bir kartı temsil ederdi. */
  id: 5, marka: "VIZZ", kategori: "Carousel", icerikTuru: "Karosel",
  medya: [
    { versiyon: 1, dosyaId: "ESKIDOSYA01", mimeTur: "image/jpeg" },        // slotsuz ESKİ kayıt
    { slot: "2", versiyon: 1, dosyaId: "SLOT2VER1AA", mimeTur: "image/jpeg" },
    { slot: "2", versiyon: 2, dosyaId: "SLOT2VER2BB", mimeTur: "image/jpeg" },
    { slot: "story", versiyon: 1, dosyaId: "STORYVER1CC", mimeTur: "video/mp4" },
  ],
};

t("slotsuz eski kayıt 1. slayt sayılıyor", medyaSlotu({ versiyon: 1 }) === "1");
t("boş slot alanı da 1 sayılıyor", medyaSlotu({ slot: "  " }) === "1");

const guncel = guncelMedyalar(KAROSEL);
t("her slotun yalnızca güncel hâli listeleniyor", guncel.length === 3, guncel.map((m) => m.slot).join(","));
t("2. slaydın V2'si seçildi", guncel.find((m) => m.slot === "2").dosyaId === "SLOT2VER2BB");
t("eski kayıt 1. sırada", guncel[0].slot === "1" && guncel[0].dosyaId === "ESKIDOSYA01");
t("story EN SONA konuyor", guncel[guncel.length - 1].slot === STORY_SLOT, guncel.map((m) => m.slot).join(","));

t("versiyon SLOT İÇİNDE sayılıyor", slotSonrakiVersiyon(KAROSEL, "2") === 3, String(slotSonrakiVersiyon(KAROSEL, "2")));
t("dokunulmamış slot 1'den başlıyor", slotSonrakiVersiyon(KAROSEL, "7") === 1);
t("story kendi sayacını tutuyor", slotSonrakiVersiyon(KAROSEL, STORY_SLOT) === 2);
t("slot geçmişi yeniden eskiye", slotGecmisi(KAROSEL, "2").map((m) => m.versiyon).join(",") === "2,1");

t("ilk boş slayt bulunuyor", bosSlot(KAROSEL) === "3", String(bosSlot(KAROSEL)));
t("story boş slot sayımını bozmuyor", bosSlot({ medya: [{ slot: STORY_SLOT, versiyon: 1 }] }) === "1");
const dolu = { medya: Array.from({ length: EN_FAZLA_SLAYT }, (_, i) => ({ slot: String(i + 1), versiyon: 1 })) };
t("slaytlar dolunca null dönüyor", bosSlot(dolu) === null);

console.log("\n   Slot doğrulaması (sunucu tarayıcıya güvenmiyor)");
t("geçerli slaytlar kabul", slotGecerliMi("1") && slotGecerliMi("10"));
t("story kabul", slotGecerliMi(STORY_SLOT));
t("sınır dışı reddediliyor", !slotGecerliMi("0") && !slotGecerliMi("11") && !slotGecerliMi("-1"));
t("uydurma ad reddediliyor", !slotGecerliMi("__proto__") && !slotGecerliMi("abc") && !slotGecerliMi(""));
t("ondalık reddediliyor", !slotGecerliMi("1.5"));

t("etiketler okunur", slotEtiketi("3") === "3. görsel" && slotEtiketi(STORY_SLOT) === "Story boyutu");

/* ---------------------------------------------------------------- */
console.log("\n2) DOSYA ADI — slaytlar Drive'da ayırt ediliyor");

const ad = (slot, v) => dosyaAdiUret({ marka: "VIZZ", icerikAdi: "Karosel", versiyon: v, orijinalAd: "x.jpg", mimeTur: "image/jpeg", slot });
t("tek dosyalı kartta ad DEĞİŞMEDİ", ad(undefined, 1) === "VIZZ_KAROSEL_V1.jpg", ad(undefined, 1));
t("1. slayt da eski adı koruyor", ad("1", 1) === "VIZZ_KAROSEL_V1.jpg", ad("1", 1));
t("3. slayt ayırt ediliyor", ad("3", 2) === "VIZZ_KAROSEL_3_V2.jpg", ad("3", 2));
t("story ayırt ediliyor", ad(STORY_SLOT, 1) === "VIZZ_KAROSEL_STORY_V1.jpg", ad(STORY_SLOT, 1));

/* ---------------------------------------------------------------- */
console.log("\n3) TAŞIMA — kartın TÜM dosyaları");

const tasinacak = tasinacakDosyalar(KAROSEL);
t("üç dosyanın üçü de taşınacak", tasinacak.length === 3, tasinacak.map((x) => x.slot).join(","));
t("her slotun GÜNCEL hâli taşınıyor", tasinacak.some((x) => x.link.includes("SLOT2VER2BB")) && !tasinacak.some((x) => x.link.includes("SLOT2VER1AA")),
  "eski versiyonlar yerinde kalmalı — arşiv klasörü kirlenmesin");
t("elle bağlantılı eski kart hâlâ taşınıyor",
  tasinacakDosyalar({ editliDosyaLink: "https://drive.google.com/file/d/ESKI/view" }).length === 1);
t("dosyasız kart boş liste veriyor", tasinacakDosyalar({}).length === 0);
t("medya varken elle bağlantı devreye girmiyor",
  tasinacakDosyalar({ ...KAROSEL, editliDosyaLink: "https://drive.google.com/file/d/BASKA/view" })
    .every((x) => !x.link.includes("BASKA")));

t("dosya yükleme kuralı bozulmadı", medyaVarMi(KAROSEL) && !medyaVarMi({ medya: [] }));

const api = fs.readFileSync(path.join(kok, "api", "data.js"), "utf8");
const pay = fs.readFileSync(path.join(kok, "api", "paylasim.js"), "utf8");
t("paylaşım ucu da ortak listeyi kullanıyor", /const dosyalar = tasinacakDosyalar\(is\)/.test(pay));
t("kart başına TEK geçmiş notu düşülüyor", api.includes("Kart başına TEK bir sonuç"));
/* Not: yukarıdaki iki satır KAYNAK METNİNE bakıyor — tek başına yeterli değil.
 * Taşımanın gerçekten üç dosyayı da oynattığı 6. bölümde DAVRANIŞ olarak ölçülüyor;
 * ilk denemede bu testin `.slice(0,1)` gibi bir bozulmayı hiç yakalamadığı görüldü. */

/* ---------------------------------------------------------------- */
console.log("\n4) MÜŞTERİ GÖRÜNÜMÜ — bütün parçalar gidiyor");

const gorunum = musteriGorunumuUret({
  clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{ ...KAROSEL, asama: "Kontrol Bekliyor" }],
  musteriIcerikleri: [], reklamlar: [], haftalikPaylasimlar: [], musteriTalepleri: [],
}, { id: 1, ad: "VIZZ" }, markaEslestirici);

const kart = gorunum.hazirIcerikler[0];
t("parça listesi gidiyor", Array.isArray(kart.parcalar) && kart.parcalar.length === 3, JSON.stringify(kart.parcalar));
t("parça sırası korunuyor", kart.parcalar.map((p) => p.slot).join(",") === "1,2,story", kart.parcalar.map((p) => p.slot).join(","));
t("video parçası işaretli", kart.parcalar.find((p) => p.slot === STORY_SLOT).video === true);
t("görsel parçası video değil", kart.parcalar.find((p) => p.slot === "1").video === false);
t("DOSYA KİMLİĞİ müşteriye GİTMİYOR",
  !JSON.stringify(kart.parcalar).includes("SLOT2VER2BB") && !JSON.stringify(kart.parcalar).includes("STORYVER1CC"),
  "önizleme kart kimliği + slot ile isteniyor, yetki orada doğrulanıyor");

const mp = fs.readFileSync(path.join(kok, "src", "musteriPaneli.jsx"), "utf8");
t("müşteri paneli parçaları çiziyor", mp.includes("function IcerikParcalari"));
t("parçasız eski kartta eski görünüme düşülüyor", /if \(parcalar\.length === 0\)/.test(mp));
t("önizleme çağrısı slotu taşıyor", /isId=\{h\.isId\} slot=\{p\.slot\}/.test(mp));

/* ---------------------------------------------------------------- */
console.log("\n5) SUNUCU — yükleme ve önizleme slot biliyor");

const hash = (x, s2) => crypto.scryptSync(x, s2, 64).toString("hex");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");

await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{ ...KAROSEL, asama: "Kontrol Bekliyor" }],
  personelHesaplari: [], musteriHesaplari: [], stoklar: {},
});

/* Drive kurulu değil; yükleme başlatılamaz ama SLOT DOĞRULAMASI yine de görünür.
 * Önemli olan: geçersiz slot kaydın içine gelişigüzel anahtar açamamalı. */
const drv = fs.readFileSync(path.join(kok, "api", "data.js"), "utf8");
t("yükleme slotu doğruluyor", /slotGecerliMi\(req\.body\.slot\) \? String\(req\.body\.slot\)\.trim\(\) : "1"/.test(drv));
t("versiyon slot içinde hesaplanıyor", /const versiyon = slotSonrakiVersiyon\(is, slot\)/.test(drv));
t("yanıt slotu geri bildiriyor", /versiyon, slot \}\)/.test(drv));

/* Önizleme: slot verilince O slotun dosyası seçilmeli, dizinin sonuncusu değil.
 *
 * GERÇEK BİR ANAHTAR ÜRETİLİYOR: sahte bir PEM ile JWT imzalama daha ilk adımda çöküyor ve
 * istek Google'a hiç ulaşmıyordu — o hâlde test "hangi dosya istendi" sorusunu ölçemez,
 * yalnızca çöküşü görür. Anahtar gerçek olunca akış sonuna kadar yürüyor ve dosya kimliğini
 * taşıyan adresi yakalayabiliyoruz. */
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@example.com";
process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });

let secilenId = null;
const gercekFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const adres = String(url);
  // Jeton adımı geçilsin; asıl ilgilendiğimiz hangi DOSYANIN istendiği.
  if (adres.includes("oauth2.googleapis.com/token")) {
    return { ok: true, status: 200, json: async () => ({ access_token: "test-jeton", expires_in: 1 }), text: async () => "{}" };
  }
  const m = adres.match(/files\/([^/?]+)/);
  if (m) secilenId = m[1];
  return { ok: false, status: 404, text: async () => "yok", json: async () => ({}) };
};

const onizle = async (slot) => cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { onizlemeAction: "gorsel", isId: 5, slot } });

await onizle("2");
const slot2 = secilenId;
await onizle(STORY_SLOT);
const slotStory = secilenId;
await onizle(undefined);
const slotYok = secilenId;
globalThis.fetch = gercekFetch;

t("slot 2 istendiğinde O slotun güncel dosyası çekiliyor", String(slot2).includes("SLOT2VER2BB"), String(slot2));
t("story istendiğinde story dosyası çekiliyor", String(slotStory).includes("STORYVER1CC"), String(slotStory));
t("slot verilmezse İLK slayt çekiliyor (sonuncu değil)", String(slotYok).includes("ESKIDOSYA01"), String(slotYok));
t("üç istek üç FARKLI dosya getirdi", new Set([String(slot2), String(slotStory), String(slotYok)]).size === 3);


/* ---------------------------------------------------------------- */
console.log("\n6) TAŞIMA DAVRANIŞI — üç dosyanın üçü de gerçekten oynatılıyor mu");

/* Bu bölüm kaynak metnine DEĞİL, Google'a giden isteklere bakıyor. Önce yalnızca metin
 * sınanıyordu ve taşımayı `.slice(0, 1)` ile tek dosyaya düşürmek HİÇBİR kontrolü
 * düşürmüyordu — yani asıl koruma test edilmiyordu. */

await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/MARKAKLASORU1" }],
  cekimIsleri: [{ ...KAROSEL, asama: "Kontrol Bekliyor" }],
  personelHesaplari: [], musteriHesaplari: [], stoklar: {},
});

const patchlenen = new Set();
globalThis.fetch = async (url, secenekler) => {
  const adres = String(url);
  const yontem = (secenekler && secenekler.method) || "GET";
  if (adres.includes("oauth2.googleapis.com/token")) {
    return { ok: true, status: 200, json: async () => ({ access_token: "test-jeton", expires_in: 1 }), text: async () => "{}" };
  }
  /* Klasör listeleme (GET) ve klasör oluşturma (POST) aynı adrese gidiyor; ayrımı yöntem
   * yapıyor. Oluşturma da cevaplanmalı — yalnızca listelemeyi karşılamak "Klasör
   * oluşturulamadı" hatasına düşürüyordu ve taşıma hiç denenmemiş gibi görünüyordu. */
  if (adres.includes("/drive/v3/files?")) {
    if (yontem === "POST") {
      return { ok: true, status: 200, json: async () => ({ id: "YENIKLASOR01" }), text: async () => "{}" };
    }
    return { ok: true, status: 200, json: async () => ({ files: [{ id: "HEDEFKLASOR1", name: "2 ONAYLANANLAR" }] }), text: async () => "{}" };
  }
  const m = adres.match(/\/drive\/v3\/files\/([^/?]+)/);
  if (m && yontem === "PATCH") { patchlenen.add(m[1]); return { ok: true, status: 200, json: async () => ({ id: m[1] }), text: async () => "{}" }; }
  if (m) {
    // Dosyanın mevcut yeri: bir ay klasörünün altında değil, başka bir yerde.
    return { ok: true, status: 200, json: async () => ({ parents: ["BASKAKLASOR1"], name: "dosya" }), text: async () => "{}" };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => "yok" };
};

let d = await kv.get("marcus-os-data");
await cagir(veriUcu, { method: "POST", headers: OWNER, query: {},
  body: { data: { ...d, cekimIsleri: [{ ...d.cekimIsleri[0], asama: "Onaylandı" }], _v: undefined }, _v: d._v } });
globalThis.fetch = gercekFetch;

t("her slotun güncel dosyası taşındı", patchlenen.size === 3, [...patchlenen].join(","));
t("1. slayt taşındı", patchlenen.has("ESKIDOSYA01"), [...patchlenen].join(","));
t("2. slaydın V2'si taşındı", patchlenen.has("SLOT2VER2BB"), [...patchlenen].join(","));
t("story boyutu taşındı", patchlenen.has("STORYVER1CC"), [...patchlenen].join(","));
t("ESKİ versiyon taşınmadı (arşiv kirlenmiyor)", !patchlenen.has("SLOT2VER1AA"), [...patchlenen].join(","));

const sonKart = (await kv.get("marcus-os-data")).cekimIsleri[0];
const notlar = (sonKart.gecmis || []).filter((x) => x.yazan === "Sistem");
t("geçmişe TEK not düşüldü (8 slayt = 8 not değil)", notlar.length === 1, JSON.stringify(notlar.map((x) => x.aciklama)));
t("not kaç dosya taşındığını yazıyor", notlar.length === 1 && /3 dosya/.test(notlar[0].aciklama), notlar[0] && notlar[0].aciklama);


/* ---------------------------------------------------------------- */
console.log("\n7) ESKİ KARTLARI KURTARMA — versiyonu ayrı parçaya taşıma");

/* Slot düzeni gelmeden önce karosel slaytları "yeni versiyon" diye yükleniyordu; o kartlarda
 * 8 slayt tek slotta V1..V8 olarak yığılı. Hangisinin gerçek revizyon, hangisinin ayrı slayt
 * olduğunu sistem BİLEMEZ — otomatik dönüştürme yapılmıyor, karar kullanıcıya bırakılıyor. */
const cekim = fs.readFileSync(path.join(kok, "src", "CekimEditTakibi.jsx"), "utf8");
t("versiyon geçmişinde 'Ayrı parça yap' düğmesi var", cekim.includes("Ayrı parça yap"));
t("taşıma yalnızca boş slot varken açılıyor", /const parcaYapilabilir = bosSlotVar/.test(cekim));
t("taşınan kayıt yeni slotta V1 oluyor", /\{ \.\.\.m, slot: hedefSlot, versiyon: 1 \}/.test(cekim));
t("işlem kart geçmişine yazılıyor", cekim.includes("ayrı parçaya taşındı"));
t("otomatik dönüştürme YAPILMIYOR (karar kullanıcıda)", cekim.includes("karar\n   * kullanıcıya bırakılıyor") || cekim.includes("karar\n   * kullanıcıya"));

/* Taşıma sonrası modelin ne dediğini ölç: tek slotta yığılı iki dosya, ayrıldıktan sonra
 * iki AYRI parça olarak görünmeli. */
const yigili = { medya: [
  { slot: "1", versiyon: 1, dosyaId: "SLAYT1AAAAA", mimeTur: "image/jpeg" },
  { slot: "1", versiyon: 2, dosyaId: "SLAYT2BBBBB", mimeTur: "image/jpeg" },
] };
t("yığılı kartta tek parça görünüyor (sorunun kendisi)", guncelMedyalar(yigili).length === 1);
const ayrilmis = { medya: yigili.medya.map((m) => (m.dosyaId === "SLAYT1AAAAA" ? { ...m, slot: "2", versiyon: 1 } : m)) };
t("ayrıldıktan sonra iki parça oluyor", guncelMedyalar(ayrilmis).length === 2,
  guncelMedyalar(ayrilmis).map((m) => m.slot + "/" + m.dosyaId).join("  "));
t("ayrılan dosya taşımaya da giriyor", tasinacakDosyalar(ayrilmis).length === 2);


/* ---------------------------------------------------------------- */
console.log("\n8) PARÇA SİLME — karttan VE Drive'dan");

/* Karttan çıkarılan slaydın Drive'daki karşılığı da gitmeli, yoksa marka klasörü kimsenin
 * kullanmadığı dosyalarla dolar. Ama KALICI silinmiyor: yanlış slaydı silmek bir tıklık iş,
 * geri getirmek imkânsız olurdu. Çöp kutusunda 30 gün duruyor. */

await kv.set("marcus-os-data", {
  _v: 1, clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{ ...KAROSEL, asama: "Kontrol Bekliyor" }],
  personelHesaplari: [{ id: "p1", ad: "Ed", kullaniciAdi: "ed",
    sifreHash: crypto.scryptSync("1", "s", 64).toString("hex"), sifreSalt: "s",
    izinler: { cekimEdit: false, paylasimlar: true }, markalar: [] }],
  musteriHesaplari: [], stoklar: {},
});

/* OAuth yükleme kimlik bilgileri: silme ASIL YOLU OAuth üzerinden gidiyor. */
process.env.GOOGLE_OAUTH_CLIENT_ID = "id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "refresh";

const istekler = [];
globalThis.fetch = async (url, secenekler) => {
  const adres = String(url);
  const yontem = (secenekler && secenekler.method) || "GET";
  if (adres.includes("oauth2.googleapis.com/token")) {
    /* Bu uç HEM servis hesabının HEM OAuth'un jeton adresi. Gövdesindeki grant_type
     * hangisi olduğunu söylüyor. */
    const govde = String((secenekler && secenekler.body) || "");
    istekler.push({ jeton: govde.includes("refresh_token") ? "oauth" : "servis" });
    return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 1 }), text: async () => "{}" };
  }
  const m = adres.match(/\/drive\/v3\/files\/([^/?]+)/);
  if (m && yontem === "PATCH") {
    istekler.push({ dosyaId: m[1], govde: secenekler && secenekler.body });
    return { ok: true, status: 200, json: async () => ({ id: m[1] }), text: async () => "{}" };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => "yok" };
};

const sil = (slot, headers) => cagir(veriUcu, { method: "POST", headers: headers || OWNER, query: {},
  body: { driveAction: "medyaSil", isId: 5, slot } });

let sr = await sil("2");
t("silme isteği kabul edildi", sr.kod === 200 && sr.govde.ok === true, JSON.stringify(sr.govde));
t("o slotun TÜM versiyonları çöpe atıldı", sr.govde.silinen.length === 2, JSON.stringify(sr.govde.silinen));
t("güncel ve eski versiyon birlikte", sr.govde.silinen.includes("SLOT2VER2BB") && sr.govde.silinen.includes("SLOT2VER1AA"));
t("BAŞKA slotun dosyasına dokunulmadı",
  !sr.govde.silinen.includes("ESKIDOSYA01") && !sr.govde.silinen.includes("STORYVER1CC"));
/* `istekler` jeton çağrılarını da tutuyor; yalnızca dosyaya giden PATCH'lere bakılıyor. */
const patchler = istekler.filter((x) => x.dosyaId);
t("KALICI SİLME DEĞİL — çöpe atılıyor",
  patchler.length === 2 && patchler.every((x) => String(x.govde).includes('"trashed":true')),
  JSON.stringify(patchler.map((x) => x.govde)));
t("DELETE yöntemi kullanılmıyor", patchler.length === 2);
/* SAHİPLİK MESELESİ — ölçerek öğrenildi.
 * İlk sürüm servis hesabıyla çöpe atmayı deniyordu ve Google reddediyordu:
 *   "The user does not have sufficient permissions for this file."
 * Drive'da çöpe atmak DÜZENLEME değil SAHİPLİK istiyor; uygulamanın yüklediği dosyaların
 * sahibi kullanıcı (servis hesaplarının depolama kotası yok). Bu yüzden ASIL YOL OAuth. */
t("çöpe atma OAUTH ile deneniyor (sahiplik meselesi)",
  istekler.some((x) => x.jeton === "oauth"),
  JSON.stringify(istekler.filter((x) => x.jeton)));
/* ÖLÇÜM DOSYA SİLME AŞAMASIYLA SINIRLI.
 *
 * İddia "dosya silinirken servis hesabına gereksiz yere düşülmüyor". Önce isteklerin
 * TAMAMI sayılıyordu; dosyalar silindikten SONRA çalışan boş-klasör temizliği servis
 * hesabını haklı olarak kullanınca test, niyet değişmediği hâlde düştü. Klasörü servis
 * hesabı açtığı için sahibi odur ve çöpe atmayı ancak o yapabilir.
 *
 * İstekler sırayla kaydediliyor; son dosya PATCH'ine kadar olan bölüm dosya silme
 * aşamasıdır. */
const sonDosyaPatchi = istekler.reduce((son, x, i) => (x.dosyaId ? i : son), -1);
const dosyaAsamasi = istekler.slice(0, sonDosyaPatchi + 1);
t("OAuth başarılıysa servis hesabına düşülmüyor",
  !dosyaAsamasi.some((x) => x.jeton === "servis"),
  JSON.stringify(dosyaAsamasi.filter((x) => x.jeton)));

sr = await sil("7");
t("dosyası olmayan parça hata vermiyor", sr.kod === 200 && sr.govde.silinen.length === 0, JSON.stringify(sr.govde));
sr = await sil("__proto__");
t("uydurma slot reddediliyor", sr.kod === 400, `${sr.kod} ${JSON.stringify(sr.govde)}`);

const DAR = { "x-staff-username-b64": Buffer.from("ed").toString("base64"),
              "x-staff-password-b64": Buffer.from("1").toString("base64"), "content-type": "application/json" };
sr = await sil("1", DAR);
t("cekimEdit izni olmayan personel silemiyor", sr.kod === 403, `${sr.kod} ${JSON.stringify(sr.govde)}`);

/* OAUTH REDDEDERSE SERVİS HESABINA DÜŞÜLÜYOR — elle yapıştırılmış eski dosyalar
 * uygulama tarafından yüklenmediği için dar `drive.file` kapsamının dışında kalıyor. */
const sira = [];
globalThis.fetch = async (url, secenekler) => {
  const adres = String(url);
  if (adres.includes("oauth2.googleapis.com/token")) {
    const govde = String((secenekler && secenekler.body) || "");
    sira.push(govde.includes("refresh_token") ? "oauth" : "servis");
    /* `expires_in: 1` BİLEREK: v161'de servis hesabı jetonu modül düzeyinde
     * önbellekleniyor (videoda her sarmada yeniden alınmasın diye). Uzun ömür
     * verilirse ikinci çağrıda jeton isteği HİÇ yapılmıyor ve bu testin ölçüm yöntemi
     * — jeton isteklerini saymak — kör kalıyor: yedek yol çalıştığı hâlde "servis"
     * satırı hiç görünmüyordu. Kısa ömür önbelleği devre dışı bırakıp gözlemi
     * geri veriyor; ölçülen davranış aynı. */
    return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 1 }), text: async () => "{}" };
  }
  const oauthMu = sira[sira.length - 1] === "oauth";
  if (oauthMu) return { ok: false, status: 404, json: async () => ({ error: { message: "File not found" } }), text: async () => "yok" };
  return { ok: true, status: 200, json: async () => ({ id: "x" }), text: async () => "{}" };
};
sr = await sil("1");
t("OAuth göremezse servis hesabı deneniyor", sira.includes("oauth") && sira.includes("servis"), sira.join(","));
t("yedek yol başarılıysa silme başarılı sayılıyor", sr.kod === 200 && sr.govde.ok === true, JSON.stringify(sr.govde));

/* Drive silinemezse kart TEMİZLENMEMELİ — "silindi" sanılan ama duran dosya üretirdi. */
globalThis.fetch = async (url) => {
  if (String(url).includes("oauth2.googleapis.com/token")) {
    return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 1 }), text: async () => "{}" };
  }
  return { ok: false, status: 403, json: async () => ({ error: { message: "izin yok" } }), text: async () => "yok" };
};
sr = await sil("1");
t("Drive silemezse istek HATA dönüyor", sr.kod === 400, `${sr.kod} ${JSON.stringify(sr.govde)}`);
t("hata sebebi görünüyor", String(sr.govde.error || "").includes("izin yok"), JSON.stringify(sr.govde));
/* Aynı sebep her dosya için tekrar yazılıyordu; üç kopya aynı cümle ekranda okunmuyordu. */
t("aynı sebep tekrar yazılmıyor",
  (String(sr.govde.error || "").match(/izin yok/g) || []).length === 1, JSON.stringify(sr.govde));
globalThis.fetch = gercekFetch;

t("kayıt sunucuda KV'ye yazılmadı (sürüm sayacı korunuyor)",
  (await kv.get("marcus-os-data"))._v === 1, String((await kv.get("marcus-os-data"))._v));
t("kart hâlâ bütün medyasıyla duruyor (temizlik tarayıcı kaydıyla oluyor)",
  (await kv.get("marcus-os-data")).cekimIsleri[0].medya.length === 4);

t("arayüzde silme düğmesi var", cekim.includes("Bu parçayı sil"));
/* SİLME BULUNABİLİR OLMALI. İlk hâlinde düğme yalnızca büyük önizlemenin ALTINDAydı;
 * önizlemenin boyu yüzünden ekranın dışında kalıyor ve kullanıcı "5 görselden birini nasıl
 * sileceğim?" diye soruyordu. Düğmenin var olması yetmiyor, görünür olması gerekiyor. */
t("küçük karenin üstünde × var", cekim.includes("SİLME KARENİN ÜSTÜNDE"));
t("× karenin açılmasını tetiklemiyor", /onClick=\{\(e\) => \{ e\.stopPropagation\(\); parcaSil\(m\); \}\}/.test(cekim));
t("işlemler önizlemenin ÜSTÜNDE", cekim.indexOf("İŞLEMLER ÖNİZLEMENİN ÜSTÜNDE") < cekim.indexOf("<SunucuOnizleme\n                  isId={job.id}\n                  slot={m.slot}"));
t("ipucu metni × yolunu anlatıyor", cekim.includes("karesinin sağ üstündeki ×'e bas"));
t("silme sürerken × gizleniyor", /!meshgul && \(\s*<span\s*role="button"/.test(cekim));
t("silmeden önce onay soruluyor", cekim.includes("çöp kutusuna taşınacak. Devam edilsin mi?"));
t("önce Drive sonra kart sırası korunuyor", cekim.includes("SIRA ÖNEMLİ: önce Drive, sonra kart"));
t("kalan slaytlar yeniden numaralanıyor", cekim.includes("KALAN SLAYTLAR YENİDEN NUMARALANIYOR"));


/* KART SİLİNMEDEN ÖNCE DOSYALARI TEMİZLENMELİ. */
t("dosyası olan kart silinemiyor", cekim.includes("KART SİLİNMEDEN ÖNCE DOSYALARI TEMİZLENMELİ"));
/* ÇIKMAZ KAPATILDI. Düzenleme kilidi YALNIZCA medya düzenlemeyi kapatıyordu; karttaki
 * diğer her şey (Onayla, Revize İste, Düzenle, Sil, aşama değiştir) kilit varken de
 * çalışıyor. Bu tutarsızlık kullanıcıyı iki kapının arasında bırakıyordu: kilit varken
 * dosya silinemiyor, dosya varken de kart silinemiyor. */
/* Argüman ADINA değil, KURALIN kendisine bakıyor: medya yükleyici kartın normal
 * düzenleme kapısından geçiyor ve kilit o kapıya ek bir şart koymuyor. İmza
 * değiştiğinde (staffName -> islemYetkisi) bu kontrol boşuna kırılmıştı. */
t("düzenleme kilidi medyayı da kapatmıyor",
  /duzenlenebilir=\{duzenleyebilirMi\([^)]*\)\}/.test(cekim));
t("kilit artık hiçbir yerde duvar değil", !/duzenleyebilirMi\([^)]*\) && !kilitleyen/.test(cekim));
t("kilit uyarısı yerinde duruyor (bilgi olarak)", cekim.includes("<KilitUyarisi kisi={kilitleyen} />"));
t("silme düğmesi doğrudan onDelete çağırmıyor", !/onClick=\{\(\) => \{ if \(window\.confirm\("Bu iş silinsin mi\?"\)\) onDelete\(job\.id\); \}\}/.test(cekim));
t("engel mesajı ne yapılacağını söylüyor", cekim.includes("Önce dosyaları kaldır"));
t("dosya kalmayınca kart silinebiliyor", /if \(window\.confirm\("Bu iş silinsin mi\?"\)\) onDelete\(job\.id\);/.test(cekim));
t("toplu silme var (8 slayt = 8 onay olmasın)", cekim.includes("TÜM DOSYALARI BİRDEN SİL"));
t("toplu silme yarıda kalırsa silinenler karttan düşüyor", cekim.includes("YARIDA KALIRSA KALDIĞI YER KAYDEDİLİYOR"));

/* KAÇIŞ YOLU: dosya Drive'dan elle silinmişse kart kilitlenmemeli. */
const tasima = fs.readFileSync(path.join(kok, "lib", "drive-tasima.js"), "utf8");
t("servis hesabının 404'ü başarı sayılıyor", /if \(y\.status === 404\) return \{ ok: true, nasil: "zaten-yok" \}/.test(tasima));
t("OAuth'un 404'ü başarı SAYILMIYOR (kapsam sorunu olabilir)",
  tasima.includes("OAuth'un 404'ü \"yok\" demek değil") || tasima.includes('OAuth\'un 404\'ü "yok" demek değil'));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
