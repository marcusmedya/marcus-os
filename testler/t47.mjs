/* MÜŞTERİ PANELİ İLE YÖNETİCİ EKRANI ARASINDAKİ SENKRON + PLANA BAĞLI KART + STOK
 *
 * 1. SENKRON. Müşteri panelinde "Onay Bekleyenler 12" yazarken yönetici tarafındaki
 *    Müşteri Paneli ekranında aynı marka için "Onay bekleyen içerik yok" yazıyordu.
 *    Sebep basit ve sinsiydi: iki taraf AYRI kural yazıyordu.
 *      müşteri paneli -> musteriIcerikleri + Operasyon kartlarının canlı yansıması
 *      yönetici ekranı -> yalnızca musteriIcerikleri
 *    Kural artık lib/musteri-gorunumu.js'te tek yerde. Bu test kuralın gerçekten
 *    ÇALIŞTIRILARAK aynı sayıyı verdiğini ölçüyor, iki dosyada aynı kelimenin geçtiğini
 *    değil.
 *
 * 2. PLANA BAĞLI KART. Müşterinin paylaşım takvimindeki kareler "Reels" yazan boş
 *    kutulardı: plan bir Operasyon kartına bağlı olsa bile kartın kimliği müşteriye hiç
 *    gönderilmiyordu, dolayısıyla görsel istenemiyordu.
 *
 * 3. STOK. Onaylanan kart stoğu türüne göre artırmalı — Reels, Reels stoğunu; görsel,
 *    post stoğunu. Soru soruldu, cevabı ölçülerek veriliyor.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { musteriGorunumuUret, hazirIcerikleriUret, musteriKayitlariniSuz } from "../lib/musteri-gorunumu.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";
process.env.SITE_PASSWORD = "ownerpw";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

/* ---------------------------------------------------------------- */
console.log("\n1) SENKRON — iki ekran aynı sayıyı veriyor mu");

const MARKA = { id: 1, ad: "İbo Burger" };
const VERI = {
  clients: [MARKA, { id: 2, ad: "Skylon Mimarlık" }],
  cekimIsleri: [
    { id: 10, marka: "İbo Burger", kategori: "Video", icerikTuru: "Ürün Seçme Trend Reels", asama: "Kontrol Bekliyor" },
    { id: 11, marka: "İbo Burger", kategori: "Fotoğraf", icerikTuru: "Görsel 3", asama: "Kontrol Bekliyor" },
    { id: 12, marka: "İbo Burger", kategori: "Video", icerikTuru: "Reels 2", asama: "Revize İstendi" },
    // Henüz üretim aşamasında — müşteriye HİÇ gösterilmemeli.
    { id: 13, marka: "İbo Burger", kategori: "Video", icerikTuru: "Reels 9", asama: "Edit Yapılıyor" },
    // Başka marka — karışmamalı.
    { id: 14, marka: "Skylon Mimarlık", kategori: "Fotoğraf", icerikTuru: "Görsel 1", asama: "Kontrol Bekliyor" },
  ],
  musteriIcerikleri: [
    { id: "i1", clientId: 1, tur: "cekim", durum: "bekliyor", aciklama: "çekim planı" },
    // Canlı bir işe bağlı KOPYA — müşteriye gitmiyor, o yüzden yönetici de saymamalı.
    { id: "i2", clientId: 1, tur: "video", durum: "bekliyor", kaynakIsId: 10 },
    // Bağlı olduğu iş silinmiş — kayıt geri gelmeli, iki tarafta da sayılmalı.
    { id: "i3", clientId: 1, tur: "gorsel", durum: "bekliyor", kaynakIsId: 999 },
  ],
  reklamlar: [], haftalikPaylasimlar: [], musteriTalepleri: [],
};

const gorunum = musteriGorunumuUret(VERI, MARKA, markaEslestirici);
const musteriBekleyen =
  gorunum.icerikler.filter((i) => i.durum === "bekliyor").length +
  gorunum.hazirIcerikler.filter((h) => h.durum === "bekliyor").length;

/* Yönetici ekranındaki formülün AYNISI — App.jsx'te de bu iki fonksiyon çağrılıyor. */
const yoneticiBekleyen =
  musteriKayitlariniSuz(VERI.musteriIcerikleri, VERI.cekimIsleri, MARKA.id).filter((i) => i.durum === "bekliyor").length +
  hazirIcerikleriUret(VERI.cekimIsleri, markaEslestirici(VERI.clients, MARKA.ad)).filter((h) => h.durum === "bekliyor").length;

t("müşteri 4 onay bekleyen görüyor", musteriBekleyen === 4, String(musteriBekleyen));
t("yönetici de aynı sayıyı görüyor", yoneticiBekleyen === musteriBekleyen, `${yoneticiBekleyen} / ${musteriBekleyen}`);
t("üretimdeki kart (Edit Yapılıyor) hiçbir tarafta yok",
  !gorunum.hazirIcerikler.some((h) => String(h.isId) === "13"),
  gorunum.hazirIcerikler.map((h) => h.isId).join(","));
t("başka markanın kartı sızmıyor",
  !gorunum.hazirIcerikler.some((h) => String(h.isId) === "14"));
t("canlı işe bağlı kopya sayılmıyor (çift sayım yok)",
  !gorunum.icerikler.some((i) => i.id === "i2"),
  gorunum.icerikler.map((i) => i.id).join(","));
t("işi silinmiş kayıt geri geliyor", gorunum.icerikler.some((i) => i.id === "i3"));
t("revize istenen ayrı sayılıyor",
  gorunum.hazirIcerikler.filter((h) => h.durum === "revize").length === 1);

/* Yönetici ekranı kuralı KENDİ yazmıyor mu — asıl hata buydu. */
const app = fs.readFileSync(path.join(kok, "src", "App.jsx"), "utf8");
t("App.jsx ortak kuralı içeri alıyor",
  /import \{[^}]*hazirIcerikleriUret[^}]*\} from "\.\.\/lib\/musteri-gorunumu\.js"/.test(app));
t("App.jsx ortak süzgeci içeri alıyor", app.includes("musteriKayitlariniSuz"));
t("yönetici sayacı yansıyanları da topluyor",
  /yansiyan\(id\)\.filter\(\(h\) => h\.durum === durum\)\.length/.test(app));
t("marka rozetleri de aynı sayacı kullanıyor", /const bekleyen = sayac\(c\.id, "bekliyor"\)/.test(app));
t("yansıyan kartlar ekranda listeleniyor", app.includes("<YansiyanKartlar liste={yansiyan(seciliMarka.id)} />"));

/* ---------------------------------------------------------------- */
console.log("\n2) PAYLAŞIM TAKVİMİ — plana bağlı kartın görseli");

const VERI2 = {
  ...VERI,
  cekimIsleri: [...VERI.cekimIsleri, { id: 20, marka: "İbo Burger", kategori: "Video", icerikTuru: "Reels 5", asama: "Onaylandı" }],
  haftalikPaylasimlar: [
    { id: "p1", clientId: 1, gun: "Pazartesi", haftaKey: "2026-08-17", tur: "Reels", yapildi: true, isId: 20, isAdi: "Reels 5" },
    { id: "p2", clientId: 1, gun: "Salı", haftaKey: "2026-08-17", tur: "Görsel", yapildi: false },
  ],
};
const g2 = musteriGorunumuUret(VERI2, MARKA, markaEslestirici);
const bagli = g2.paylasimPlani.find((p) => p.id === "p1");
const bagsiz = g2.paylasimPlani.find((p) => p.id === "p2");

t("bağlı kartın kimliği müşteriye gidiyor", bagli && String(bagli.isId) === "20", JSON.stringify(bagli));
t("kartın adı da gidiyor", bagli && bagli.isAdi === "Reels 5");
t("bağlı olmayan planda kimlik boş", bagsiz && bagsiz.isId === null);
t("paylaşıldı bilgisi taşınıyor", bagli.yapildi === true && bagsiz.yapildi === false);

const insta = fs.readFileSync(path.join(kok, "src", "instagram.jsx"), "utf8");
t("ızgara karesi bağlı kartın kapağını çiziyor", /p\.isId \? \(\s*<BagliKartKapagi isId=\{p\.isId\}/.test(insta));
t("gönderi kartı da çiziyor", /isId \? \(\s*<BagliKartKapagi isId=\{isId\}/.test(insta));
t("kapak sunucudan isteniyor (bağlantıdan değil)", /useSunucuOnizleme\(\{ isId, boyut/.test(insta));
t("paylaşıldı rozeti okunur bir etiket", insta.includes("✓ Paylaşıldı") && insta.includes("rgba(22,163,74,.92)"));

const mp = fs.readFileSync(path.join(kok, "src", "musteriPaneli.jsx"), "utf8");
t("müşteri paneli kimliği geçiriyor", mp.includes("isId={p.isId}") && mp.includes("isId={secili.isId}"));
t("yönetici önizlemesi de geçiriyor", app.includes("isId={p.isId}"));

/* ---------------------------------------------------------------- */
console.log("\n3) STOK — onaylanan kart türüne göre artıyor mu");

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t2) => Buffer.from(String(t2), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const MUSTERI = { "x-musteri-username-b64": b64("ibo"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };
const { default: veriUcu } = await import("../api/data.js");
const oku = () => kv.get("marcus-os-data");

await kv.set("marcus-os-data", {
  _v: 3,
  clients: [MARKA],
  stoklar: {},
  cekimIsleri: [
    { id: 30, marka: "İbo Burger", kategori: "Video", icerikTuru: "Ürün Seçme Trend Reels",
      asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "aaaaaaaaaaaa" }], gecmis: [] },
    { id: 31, marka: "İbo Burger", kategori: "Fotoğraf", icerikTuru: "Görsel 3",
      asama: "Kontrol Bekliyor", medya: [{ versiyon: 1, dosyaId: "bbbbbbbbbbbb" }], gecmis: [] },
  ],
  musteriIcerikleri: [], personelHesaplari: [],
  musteriHesaplari: [{ id: "m1", ad: "İbo", kullaniciAdi: "ibo", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" }],
});

const onayla = (isId) => cagir(veriUcu, { method: "POST", headers: MUSTERI, query: {},
  body: { musteriAction: "onayla", isId } });

let r = await onayla(30);
t("müşteri Reels kartını onayladı", r.kod === 200, JSON.stringify(r.govde).slice(0, 120));
let d = await oku();
t("Reels stoğu 1 oldu", d.stoklar["1_Reels"] === 1, JSON.stringify(d.stoklar));
t("post stoğu artmadı", !d.stoklar["1_Post"], JSON.stringify(d.stoklar));

r = await onayla(31);
t("müşteri görsel kartını onayladı", r.kod === 200, JSON.stringify(r.govde).slice(0, 120));
d = await oku();
t("post stoğu 1 oldu", d.stoklar["1_Post"] === 1, JSON.stringify(d.stoklar));
t("Reels stoğu 1'de kaldı (ikinci kez sayılmadı)", d.stoklar["1_Reels"] === 1, JSON.stringify(d.stoklar));
t("kartlar sayıldı olarak işaretlendi",
  d.cekimIsleri.every((j) => j.stokSayildi === true),
  d.cekimIsleri.map((j) => `${j.id}:${j.stokSayildi}`).join(" "));

/* Bir Reels'in KATEGORİSİ de "Video"dur. Kategoriye bakılsaydı Reels, Video stoğuna
 * yazılırdı — paylaşım paneli Reels stoğunu hep sıfır görürdü. */
t("Reels, Video stoğuna yazılmadı", !d.stoklar["1_Video"], JSON.stringify(d.stoklar));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
