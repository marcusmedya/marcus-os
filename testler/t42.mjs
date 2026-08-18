/* VİDEO AKIŞI VE ERİŞİM JETONU
 *
 * NEDEN BU TEST VAR:
 *   <video src="..."> özel başlık gönderemiyor; bu yüzden yetki adresin içindeki imzalı
 *   jetondan geliyor. Yani jeton BİR GÜVENLİK SINIRI. Yanlış kurulursa, kimliğini bilen
 *   herkesin her müşterinin videosunu izleyebildiği bir kapı olur — üstelik sessizce.
 *
 *   Sınananlar: imza doğrulaması, süre, jetonun BAŞKA kayda geçmemesi, ve yetki kapısının
 *   jeton verirken de işlemesi (müşteri başkasının videosu için jeton alamamalı).
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const MUSTERI_A = { "x-musteri-username-b64": b64("ma"), "x-musteri-password-b64": b64("1"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const { jetonUret, jetonCoz } = await import("../lib/video-jeton.js");
const { default: h } = await import("../api/data.js");
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });
const getIstek = (query) => cagir(h, { method: "GET", headers: {}, query, body: undefined });
const LINK = (id) => `https://drive.google.com/file/d/${id}/view`;

await kv.set("marcus-os-data", {
  _v: 1,
  clients: [{ id: 1, ad: "VIZZ" }, { id: 2, ad: "GİZLİ Marka" }],
  cekimIsleri: [
    { id: 10, marka: "VIZZ", icerikTuru: "A", asama: "Kontrol Bekliyor",
      medya: [{ versiyon: 1, dosyaId: "VIZZ_DOSYA_aaaaaaaaaaaaaa" }], gecmis: [] },
    { id: 11, marka: "GİZLİ Marka", icerikTuru: "B", asama: "Kontrol Bekliyor",
      editliDosyaLink: LINK("GIZLI_DOSYA_bbbbbbbbbbbbb"), gecmis: [] },
  ],
  musteriIcerikleri: [
    { id: "i1", clientId: 1, tur: "video", driveLinki: LINK("VIZZ_ICERIK_cccccccccccc") },
    { id: "i2", clientId: 2, tur: "video", driveLinki: LINK("GIZLI_ICERIK_dddddddddddd") },
  ],
  musteriHesaplari: [
    { id: "ma1", ad: "A", kullaniciAdi: "ma", clientId: 1, sifreHash: hash("1", "s"), sifreSalt: "s" },
  ],
});

console.log("VİDEO AKIŞI VE JETON\n");

/* ---- 1. JETONUN KENDİSİ ---- */
console.log(" Jeton");
const j = jetonUret("is", "10");
t("jeton üretiliyor", typeof j === "string" && j.includes("."));
t("çözülüyor", JSON.stringify(jetonCoz(j)) === JSON.stringify({ tur: "is", kimlik: "10" }));
t("imzası bozulmuş jeton REDDEDİLİYOR", jetonCoz(j.slice(0, -4) + "AAAA") === null);
t("gövdesi değiştirilmiş jeton reddediliyor", (() => {
  const sahte = Buffer.from("is:11:99999999999", "utf8").toString("base64url") + "." + j.split(".")[1];
  return jetonCoz(sahte) === null;
})(), "başka kartın kimliğiyle imza yeniden kullanılamamalı");
t("süresi dolmuş jeton reddediliyor", jetonCoz(j, Date.now() + 3 * 60 * 60 * 1000) === null);
t("boş/çöp girdi çökmüyor", jetonCoz(null) === null && jetonCoz("") === null && jetonCoz("a.b.c") === null);

/* Sır değişirse eski jetonlar geçersiz olmalı */
process.env.SITE_PASSWORD = "baskasifre";
t("sunucu sırrı değişince eski jeton geçersiz", jetonCoz(j) === null);
process.env.SITE_PASSWORD = "ownerpw";

/* ---- 2. JETON ALMA YETKİSİ ---- */
console.log("\n Jeton alma yetkisi");
let r = await cagri(OWNER, { onizlemeAction: "videoJetonu", isId: 10 });
t("yönetici jeton alabiliyor", r.kod === 200 && r.govde.ok === true && Boolean(r.govde.adres), JSON.stringify(r.govde).slice(0, 80));

r = await cagri(MUSTERI_A, { onizlemeAction: "videoJetonu", icerikId: "i1" });
t("müşteri KENDİ içeriği için alabiliyor", r.kod === 200 && r.govde.ok === true, `HTTP ${r.kod}`);
const musteriAdres = r.govde.adres;

r = await cagri(MUSTERI_A, { onizlemeAction: "videoJetonu", icerikId: "i2" });
t("müşteri BAŞKASININ içeriği için ALAMIYOR", r.kod === 403, `HTTP ${r.kod}`);
r = await cagri(MUSTERI_A, { onizlemeAction: "videoJetonu", isId: 11 });
t("müşteri başka markanın kartı için de alamıyor", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 3. AKIŞ UCU ---- */
console.log("\n Akış ucu");
r = await getIstek({ video: "10" });
t("jetonsuz erişim reddediliyor", r.kod === 403, `HTTP ${r.kod}`);
r = await getIstek({ video: "10", j: "uydurma" });
t("uydurma jeton reddediliyor", r.kod === 403, `HTTP ${r.kod}`);

const gecerli = jetonUret("is", "10");
r = await getIstek({ video: "11", j: gecerli });
t("jeton BAŞKA kayıt için kullanılamıyor", r.kod === 403,
  `HTTP ${r.kod} — kart 10'un jetonuyla kart 11 istenemez`);

r = await getIstek({ video: "999", j: jetonUret("is", "999") });
t("olmayan kayıt 404", r.kod === 404, `HTTP ${r.kod}`);

r = await getIstek({ video: "10", j: gecerli });
t("Drive kurulu değilken 502 ve açıklama", r.kod === 502 && Boolean(r.govde.error), `HTTP ${r.kod} ${r.govde.error || ""}`);

/* Müşteriye verilen adres gerçekten kendi kaydına bağlı */
const q = Object.fromEntries(new URLSearchParams(String(musteriAdres).split("?")[1]));
t("müşteriye verilen adres kendi kaydını gösteriyor", q.video === "i1", q.video);
r = await getIstek({ video: "i2", j: q.j });
t("o adresle başka müşterinin videosu istenemiyor", r.kod === 403, `HTTP ${r.kod}`);

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
