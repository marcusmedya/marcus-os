/* VİDEO AKIŞI — İSTEK BAŞINA MALİYET
 *
 * Sahadan: "video geç başlıyor, ileri geri yaparken sorun çıkıyor." Tarayıcı videoda her
 * sarmada YENİ bir aralık isteği atıyor; dolayısıyla bir isteğin maliyeti doğrudan sarma
 * deneyimidir. Üç şey ölçülüyor:
 *
 *   1. BELGE OKUNMUYOR. Dosya kimliği jetonun içinde. Eskiden her istekte tüm uygulama
 *      belgesi (gömülü görsellerle megabaytlarca) Redis'ten çekiliyordu.
 *   2. GOOGLE JETONU YENİDEN KULLANILIYOR. Eskiden her istekte RSA imza + ayrı bir HTTP
 *      turu vardı; jeton bir saat geçerli olduğu hâlde saklanmıyordu.
 *   3. İSTEMCİ VAZGEÇİNCE İNDİRME DURUYOR. Bağ olmadan, tarayıcı isteği kesse bile
 *      Google'dan indirme sürüyor ve fonksiyon ayakta kalıyordu; hızlı sarmada ölü
 *      indirmeler birikiyordu.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "40";

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { kv } from "@vercel/kv";
import { jetonUret } from "../lib/video-jeton.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@x.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = privateKey;

const { default: dataUcu } = await import("../api/data.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const DOSYA = "VIDEODOSYASI1";
const BELGE = () => ({
  clients: [{ id: 1, ad: "M", durum: "aktif" }],
  cekimIsleri: [{ id: 7, marka: "M", kategori: "Video", icerikTuru: "Reels",
    asama: "Onaylandı", medya: [{ slot: "1", dosyaId: DOSYA }] }],
  musteriIcerikleri: [], subeler: [], haftalikPaylasimlar: [], stoklar: {},
  paylasimGecmisi: [], gunlukKontrol: {}, _alanSurumleri: {},
});

/* Gerçekçi istek/yanıt: video dalı `req.on("close")` ve akışa `pipe` kullanıyor. */
function istekYanit(sorgu) {
  const req = new EventEmitter();
  req.method = "GET"; req.query = sorgu; req.headers = { range: "bytes=0-1023" };
  const res = new EventEmitter();
  res.basliklar = {}; res.parcalar = [];
  res.status = (kod) => { res.kod = kod; return res; };
  res.json = (govde) => { res.govde = govde; return res; };
  res.setHeader = (ad, d) => { res.basliklar[String(ad).toLowerCase()] = d; return res; };
  res.write = (parca) => { res.parcalar.push(parca); return true; };
  res.end = () => { res.bittiMi = true; res.emit("finish"); return res; };
  res.on("pipe", () => {});
  return { req, res };
}

/** Google taklidi. Jeton çağrılarını ve iptal sinyalini sayar. */
function googleTaklidi({ govdeSonsuz = false } = {}) {
  const durum = { jetonCagrisi: 0, medyaCagrisi: 0, sinyaller: [] };
  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes("oauth2.googleapis.com/token")) {
      durum.jetonCagrisi++;
      return { ok: true, status: 200, json: async () => ({ access_token: `j${durum.jetonCagrisi}`, expires_in: 3600 }) };
    }
    if (s.includes("alt=media")) {
      durum.medyaCagrisi++;
      if (o.signal) durum.sinyaller.push(o.signal);
      const govde = new ReadableStream({
        start(kontrol) {
          kontrol.enqueue(new Uint8Array([1, 2, 3]));
          if (!govdeSonsuz) kontrol.close();
        },
      });
      return {
        ok: true, status: 206, body: govde,
        headers: new Map([["content-type", "video/mp4"], ["content-range", "bytes 0-1023/999999"],
          ["content-length", "1024"], ["accept-ranges", "bytes"]]),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  durum.geriAl = () => { globalThis.fetch = gercek; };
  return durum;
}
/* fetch yanıtındaki headers Map — kod `.get(ad)` çağırıyor, Map bunu karşılıyor. */

/** Belge okuma sayacı: uç ile test aynı kv nesnesini paylaşıyor. */
function belgeSayaci() {
  const asil = kv.get.bind(kv);
  const durum = { okuma: 0 };
  kv.get = async (anahtar) => { if (anahtar === "marcus-os-data") durum.okuma++; return asil(anahtar); };
  durum.geriAl = () => { kv.get = asil; };
  return durum;
}

/* ---------------------------------------------------------------- */
await bolum("1) GOOGLE JETONU YENİDEN KULLANILIYOR — soğuk başlangıç", 2, async () => {
  await kv.set("marcus-os-data", BELGE());
  const google = googleTaklidi();
  try {
    const jeton = jetonUret("is", 7, Date.now(), DOSYA);
    for (let i = 0; i < 3; i++) {
      const { req, res } = istekYanit({ video: "7", j: jeton });
      await dataUcu(req, res);
      await new Promise((r) => setTimeout(r, 10));
    }
    /* BU BÖLÜM İLK SIRADA OLMAK ZORUNDA: önbellek modül düzeyinde, bir kez doldu mu
     * sonraki bölümlerde çağrı sayısı sıfır çıkar ve ölçüm hiçbir şey söylemez —
     * ölçüldü, sonda dururken "0 çağrı" veriyordu. */
    t("ÜÇ İSTEK, TEK JETON ÇAĞRISI", google.jetonCagrisi === 1,
      `${google.jetonCagrisi} çağrı — her sarmada RSA imza + ayrı HTTP turu demekti`);
    t("üç dosya isteği de yapıldı", google.medyaCagrisi === 3, String(google.medyaCagrisi));
  } finally { google.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("2) BELGE OKUNMUYOR — dosya kimliği jetonda", 4, async () => {
  await kv.set("marcus-os-data", BELGE());
  const google = googleTaklidi();
  const sayac = belgeSayaci();
  try {
    const jeton = jetonUret("is", 7, Date.now(), DOSYA);
    const { req, res } = istekYanit({ video: "7", j: jeton });
    sayac.okuma = 0;
    await dataUcu(req, res);
    await new Promise((r) => setTimeout(r, 20));

    t("VİDEO İSTEĞİ BELGEYİ HİÇ OKUMUYOR", sayac.okuma === 0,
      `${sayac.okuma} okuma — her sarmada megabaytlarca JSON çekiliyordu`);
    t("dosya doğru kimlikle isteniyor", google.medyaCagrisi === 1);
    t("aralık yanıtı 206 dönüyor", res.kod === 206, String(res.kod));
    t("aralık başlıkları geçiyor",
      res.basliklar["content-range"] === "bytes 0-1023/999999" && res.basliklar["accept-ranges"] === "bytes",
      JSON.stringify(res.basliklar));
  } finally { google.geriAl(); sayac.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("3) ESKİ JETON — hâlâ çalışıyor", 2, async () => {
  /* Dağıtım anında ortalıkta iki saat ömürlü eski jetonlar var; oynatıcıları
   * yarıda kesilmemeli. Onlarda dosya kimliği yok, belge okunarak bulunuyor. */
  await kv.set("marcus-os-data", BELGE());
  const google = googleTaklidi();
  const sayac = belgeSayaci();
  try {
    const eskiJeton = jetonUret("is", 7);            // dosyaId YOK
    const { req, res } = istekYanit({ video: "7", j: eskiJeton });
    sayac.okuma = 0;
    await dataUcu(req, res);
    await new Promise((r) => setTimeout(r, 20));
    t("eski jetonla video yine akıyor", res.kod === 206 && google.medyaCagrisi === 1, String(res.kod));
    t("eski yol için belge okunuyor (beklenen)", sayac.okuma === 1, `${sayac.okuma} okuma`);
  } finally { google.geriAl(); sayac.geriAl(); }
});

/* ---------------------------------------------------------------- */
/* ---------------------------------------------------------------- */
await bolum("4) İSTEMCİ VAZGEÇİNCE İNDİRME DURUYOR", 2, async () => {
  /* İleri sarmada tarayıcı önceki isteği keser. Bağ yoksa Google'dan indirme sürer ve
   * fonksiyon ayakta kalır; hızlı sarmada ölü indirmeler birikip yeni istekleri
   * eşzamanlılık sınırına düşürüyordu. */
  await kv.set("marcus-os-data", BELGE());
  const google = googleTaklidi({ govdeSonsuz: true });
  try {
    const jeton = jetonUret("is", 7, Date.now(), DOSYA);
    const { req, res } = istekYanit({ video: "7", j: jeton });
    await dataUcu(req, res);
    const sinyal = google.sinyaller[0];
    t("Drive isteğine iptal bağı takılıyor", Boolean(sinyal),
      "sinyal yoksa istemci gitse bile indirme sürer");
    req.emit("close");                                // tarayıcı vazgeçti
    await new Promise((r) => setTimeout(r, 10));
    t("İSTEMCİ KAPANINCA ÜST AKIŞ İPTAL EDİLİYOR", Boolean(sinyal && sinyal.aborted),
      "iptal edilmezse ölü indirme fonksiyon süresi boyunca sürer");
  } finally { google.geriAl(); }
});

/* ---------------------------------------------------------------- */
await bolum("5) ÖNBELLEKTEKİ JETON GEÇERSİZSE — kendini onarıyor", 3, async () => {
  /* Önbellek bu sürümde geldi ve YENİ bir takılma riski getirdi: jeton süresi dolmadan
   * geçersiz kılınabiliyor (anahtar döndürüldü, saat kayması). Körü körüne tutulsa
   * istekler süre dolana kadar 401 alırdı — önbellekten ÖNCE olmayan bir hâl. */
  await kv.set("marcus-os-data", BELGE());
  let jetonCagrisi = 0, medyaCagrisi = 0;
  const kullanilanJetonlar = [];
  const gercek = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const s3 = String(u);
    if (s3.includes("oauth2.googleapis.com/token")) {
      jetonCagrisi++;
      /* Ayırt edilebilir bir ad: önceki bölümlerin taklidi de "j1" üretiyordu ve iki
       * jeton aynı metin çıktığı için "değişti mi" kontrolü hiçbir şey söylemiyordu. */
      return { ok: true, status: 200, json: async () => ({ access_token: `taze-${jetonCagrisi}`, expires_in: 3600 }) };
    }
    medyaCagrisi++;
    kullanilanJetonlar.push(String((o.headers && o.headers.Authorization) || ""));
    if (medyaCagrisi === 1) return { ok: false, status: 401, json: async () => ({}) };   // jeton geçersiz
    const govde = new ReadableStream({ start(kt) { kt.enqueue(new Uint8Array([9])); kt.close(); } });
    return { ok: true, status: 206, body: govde,
      headers: new Map([["content-type", "video/mp4"], ["content-range", "bytes 0-1/2"]]) };
  };
  try {
    const jeton = jetonUret("is", 7, Date.now(), DOSYA);
    const { req, res } = istekYanit({ video: "7", j: jeton });
    await dataUcu(req, res);
    await new Promise((r) => setTimeout(r, 20));
    t("401 sonrası TEKRAR DENENİYOR", medyaCagrisi === 2, `${medyaCagrisi} dosya isteği`);
    /* Önbellek bu bölüme SICAK giriyor (önceki bölümler doldurdu), bu yüzden "iki jeton
     * çağrısı" beklemek yanlış olurdu — ölçüldü, 1 çıkıyor. Asıl kanıt, tekrar denemede
     * FARKLI bir jetonun kullanılması: eskisi unutulmuş demektir. */
    t("tekrar denemede FARKLI jeton kullanılıyor",
      kullanilanJetonlar.length === 2 && kullanilanJetonlar[0] !== kullanilanJetonlar[1] && jetonCagrisi >= 1,
      JSON.stringify(kullanilanJetonlar));
    t("video sonunda akıyor", res.kod === 206, String(res.kod));
  } finally { globalThis.fetch = gercek; }
});

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
