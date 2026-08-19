/* MÜŞTERİ PANELİ — KART ÖNİZLEMESİ AÇILMIYORDU
 *
 * BULUNAN HATA: "Hazır içerikler" listesindeki kartlar önizleme bileşenine kaydın kimliğini
 * `h.id` diye veriyordu. Ama o listeyi üreten projeksiyon (lib/musteri-gorunumu.js →
 * kendiHazirIcerikleri) `id` adında bir alan HİÇ üretmiyor; kimlik alanının adı `isId`.
 *
 * Sonuç: kimlik `undefined` gidiyor, sunucudan önizleme/video hiç istenmiyor ve kart siyah
 * kutu olarak kalıyordu. Hiçbir hata mesajı çıkmıyordu — istek zaten atılmıyordu, bu yüzden
 * "Gömülü oynatıcıyı dene" bağlantısı bile görünmüyor, sorunun sebebi ekranda hiç yazmıyordu.
 *
 * NEDEN BU TEST BÖYLE YAZILDI: alan adını kaynak koddan REGEX'le okuyup başka bir regex'le
 * karşılaştırmak, iki tarafı da yanlış okuyup "geçti" demeye açık. Bunun yerine projeksiyon
 * GERÇEKTEN çalıştırılıyor ve panelin okuduğu alan adları üretilen kaydın üzerinde aranıyor.
 * Yani sınanan şey kodun görüntüsü değil, çıktısı.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { musteriGorunumuUret } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const VERI = {
  clients: [{ id: 1, ad: "VIZZ" }],
  cekimIsleri: [{
    id: 7, marka: "VIZZ", kategori: "Video", icerikTuru: "Kokteyl Reels",
    asama: "Kontrol Bekliyor", editliDosyaLink: "https://drive.google.com/file/d/AAAAAAAAAAAA/view",
    videoYonu: "dikey", teslimTarihi: "2026-08-19", uretilenAdet: 3, gecmis: [],
  }],
  musteriIcerikleri: [{ id: "i1", clientId: 1, tur: "video", durum: "bekliyor", aciklama: "x",
    driveLinki: "https://drive.google.com/file/d/BBBBBBBBBBBB/view", sira: 1 }],
  reklamlar: [{ id: "r1", marka: "VIZZ", reklamAdi: "Yaz", baslangicTarihi: "2026-08-01" }],
  haftalikPaylasimlar: [{ id: "p1", clientId: 1, gun: "Pazartesi", haftaKey: "2026-08-17", tur: "Reels" }],
  musteriTalepleri: [],
};

const gorunum = musteriGorunumuUret(VERI, VERI.clients[0], markaEslestirici);
const panel = fs.readFileSync(path.join(kok, "src", "musteriPaneli.jsx"), "utf8");

/* Bir bileşenin gövdesini adından keser: adından başlar, bir SONRAKİ satır başı
 * fonksiyon tanımına kadar. */
function govde(ad) {
  const bas = panel.search(new RegExp(`^(export )?function ${ad}\\b`, "m"));
  if (bas < 0) return null;
  const kalan = panel.slice(bas + 1);
  const son = kalan.search(/^(export )?function \w/m);
  return son < 0 ? kalan : kalan.slice(0, son);
}

console.log("\nProjeksiyon gerçekten çalışıyor mu");
t("hazır içerik üretildi", gorunum.hazirIcerikler.length === 1, JSON.stringify(gorunum.hazirIcerikler));
t("operasyon işi üretildi", gorunum.operasyonIsleri.length === 1);
t("reklam üretildi", gorunum.reklamlar.length === 1);
t("paylaşım planı üretildi", gorunum.paylasimPlani.length === 1);
t("müşteri içeriği üretildi", gorunum.icerikler.length === 1);

/* Her bileşen, hangi listeyi hangi döngü değişkeniyle geziyorsa o eşleşme burada.
 * Bileşene yeni bir alan okutulduğunda projeksiyonda karşılığı yoksa test düşer. */
const ESLESMELER = [
  { bilesen: "HazirIcerikler",       degisken: "h", kayit: gorunum.hazirIcerikler[0] },
  { bilesen: "MusteriOperasyon",     degisken: "j", kayit: gorunum.operasyonIsleri[0] },
  { bilesen: "MusteriReklamlar",     degisken: "r", kayit: gorunum.reklamlar[0] },
  { bilesen: "MusteriPaylasimPlani", degisken: "p", kayit: gorunum.paylasimPlani[0] },
];

console.log("\nPanelin okuduğu her alan projeksiyonda var mı");
for (const { bilesen, degisken, kayit } of ESLESMELER) {
  const g0 = govde(bilesen);
  t(`${bilesen} gövdesi bulundu`, Boolean(g0));
  if (!g0) continue;

  const okunanlar = [...new Set(
    [...g0.matchAll(new RegExp(`\\b${degisken}\\.([a-zA-Z_]\\w*)`, "g"))].map((m) => m[1]),
  )];
  t(`${bilesen} en az bir alan okuyor`, okunanlar.length > 0, okunanlar.join(","));

  const eksik = okunanlar.filter((a) => !Object.prototype.hasOwnProperty.call(kayit, a));
  t(`${bilesen}: projeksiyonda olmayan alan okunmuyor`, eksik.length === 0,
    eksik.length ? `eksik: ${eksik.join(", ")} | üretilen: ${Object.keys(kayit).join(", ")}` : "");
}

/* ASIL HATA — nokta atışı. Yukarıdaki genel kural bu satırı zaten yakalar; burada ayrıca
 * doğrudan sınanıyor ki gelecekte genel kural gevşetilirse bu yine de düşsün. */
console.log("\nÖnizleme bileşenlerine giden kimlik");
const hazir = govde("HazirIcerikler") || "";
const kimlikler = [...hazir.matchAll(/isId=\{h\.(\w+)\}/g)].map((m) => m[1]);
t("önizleme bileşenlerine kimlik veriliyor", kimlikler.length === 2, kimlikler.join(","));
t("verilen kimlik projeksiyonda var",
  kimlikler.length > 0 && kimlikler.every((a) => Object.prototype.hasOwnProperty.call(gorunum.hazirIcerikler[0], a)),
  kimlikler.join(","));
t("kimlik boş değil",
  kimlikler.every((a) => gorunum.hazirIcerikler[0][a] !== undefined && gorunum.hazirIcerikler[0][a] !== null),
  kimlikler.map((a) => `${a}=${gorunum.hazirIcerikler[0][a]}`).join(" "));
t("hazır içerik kaydında 'id' alanı YOK — kimlik 'isId'",
  !Object.prototype.hasOwnProperty.call(gorunum.hazirIcerikler[0], "id"),
  Object.keys(gorunum.hazirIcerikler[0]).join(","));

/* Dosya linki taşıyan bir kart mutlaka bir önizleme bileşeni çiziyor olmalı; aksi halde
 * kart sessizce boş kalır. */
t("dosya linki projeksiyonda taşınıyor",
  Boolean(gorunum.hazirIcerikler[0].dosyaLinki), String(gorunum.hazirIcerikler[0].dosyaLinki));
t("video yönü projeksiyonda taşınıyor",
  Object.prototype.hasOwnProperty.call(gorunum.hazirIcerikler[0], "videoYonu"));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
