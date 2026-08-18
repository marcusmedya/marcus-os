/* E-POSTA AYARI TESTİ
 *
 * NEDEN BU TEST VAR:
 *   Güvenlik kartı yalnızca "RESEND_API_KEY tanımlı mı" diye bakıyordu. Değişkene yanlış bir
 *   değer yapıştırıldığında kart yeşil kalıyor, e-postaların hepsi (giriş kodu, gece yedeği,
 *   iş bildirimi) sessizce kesiliyor ve sebep hiçbir ekranda yazmıyordu. Bu gerçekten yaşandı.
 *
 *   Test ucu Resend'in cevabını geri veriyor. İki şey kritik:
 *     1. ANAHTAR ASLA yanıta sızmamalı.
 *     2. Hata TÜRÜ ayırt edilmeli — "anahtar geçersiz" ile "alan adı doğrulanmamış"ın
 *        çözümleri bambaşka; ikisini "gönderilemedi" diye tek torbaya atmak işe yaramaz.
 */
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";

const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const PERSONEL = { "x-staff-username-b64": b64("p"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const crypto = await import("crypto");
const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
await kv.set("marcus-os-data", { _v: 1, clients: [], cekimIsleri: [],
  personelHesaplari: [{ id: "p1", ad: "P", kullaniciAdi: "p", sifreHash: hash("1234", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true } }] });

const { default: h } = await import("../api/data.js");
const { epostaGonderAyrintili } = await import("../lib/eposta.js");
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });

const GIZLI = "re_gercek_anahtar_SIZMAMALI";
const gercekFetch = globalThis.fetch;
const resendKur = (yanit) => {
  globalThis.fetch = async (url, opt = {}) => {
    if (String(url).includes("api.resend.com")) {
      // Anahtar gerçekten gönderiliyor mu (yalnızca istekte, yanıtta değil)
      globalThis.__sonIstek = { auth: (opt.headers || {}).Authorization, govde: JSON.parse(opt.body || "{}") };
      return { ok: yanit.ok, status: yanit.status || (yanit.ok ? 200 : 400), json: async () => yanit.govde || {} };
    }
    return gercekFetch(url, opt);
  };
};

console.log("E-POSTA AYARI TESTİ\n");

/* ---- 1. YETKİ ---- */
console.log(" Yetki");
process.env.RESEND_API_KEY = GIZLI;
process.env.OWNER_EMAIL = "sahip@ornek.com";
resendKur({ ok: true, govde: { id: "x" } });
let r = await cagri(PERSONEL, { epostaTest: true });
t("personel test yapamıyor", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 2. BAŞARILI ---- */
console.log("\n Başarılı gönderim");
r = await cagri(OWNER, { epostaTest: true });
t("yönetici test yapabiliyor", r.kod === 200 && r.govde.ok === true, `HTTP ${r.kod} / ${r.govde.sebep || ""}`);
t("OWNER_EMAIL adresine gidiyor", r.govde.hedef === "sahip@ornek.com", r.govde.hedef);
t("gönderen adresi bildiriliyor", /marcusmedya|resend/i.test(r.govde.gonderen || ""), r.govde.gonderen);
t("ANAHTAR yanıta sızmıyor", !JSON.stringify(r.govde).includes(GIZLI), "anahtar yanıtta olmamalı");
t("anahtar isteğe gerçekten konuyor", (globalThis.__sonIstek.auth || "").includes(GIZLI));

r = await cagri(OWNER, { epostaTest: true, hedef: "baska@ornek.com" });
t("verilen adrese gönderilebiliyor", r.govde.hedef === "baska@ornek.com", r.govde.hedef);

/* ---- 3. HATA TÜRLERİ AYIRT EDİLİYOR ---- */
console.log("\n Hata türleri");
resendKur({ ok: false, status: 401, govde: { message: "API key is invalid" } });
r = await cagri(OWNER, { epostaTest: true });
t("geçersiz anahtar ayırt ediliyor", r.govde.kod === "anahtar-gecersiz", r.govde.kod);
t("Resend'in kendi metni geri veriliyor", /API key is invalid/.test(r.govde.sebep || ""), r.govde.sebep);
t("hata yanıtında da anahtar sızmıyor", !JSON.stringify(r.govde).includes(GIZLI));

resendKur({ ok: false, status: 403, govde: { message: "The marcusmedya.com domain is not verified" } });
r = await cagri(OWNER, { epostaTest: true });
t("doğrulanmamış alan adı ayırt ediliyor", r.govde.kod === "alan-adi-dogrulanmamis", r.govde.kod);

resendKur({ ok: false, status: 500, govde: {} });
r = await cagri(OWNER, { epostaTest: true });
t("bilinmeyen hata da bildiriliyor", r.govde.ok === false && Boolean(r.govde.sebep), r.govde.sebep);

/* ---- 4. ANAHTAR HİÇ YOKKEN ---- */
console.log("\n Anahtar tanımlı değilken");
delete process.env.RESEND_API_KEY;
r = await cagri(OWNER, { epostaTest: true });
t("çökmüyor, sebebi söylüyor", r.kod === 200 && r.govde.kod === "anahtar-yok", `HTTP ${r.kod} / ${r.govde.kod}`);

delete process.env.OWNER_EMAIL;
process.env.RESEND_API_KEY = GIZLI;
r = await cagri(OWNER, { epostaTest: true });
t("adres yoksa ne yapılacağını söylüyor", r.kod === 400 && /OWNER_EMAIL/.test(r.govde.error || ""), r.govde.error);

/* ---- 5. RESEND_FROM ---- */
console.log("\n Gönderen adresi");
process.env.RESEND_FROM = "Marcus Medya App <onboarding@resend.dev>";
resendKur({ ok: true, govde: { id: "x" } });
r = await cagri(OWNER, { epostaTest: true, hedef: "a@b.com" });
t("RESEND_FROM gönderen adresini değiştiriyor", /onboarding@resend.dev/.test(r.govde.gonderen || ""), r.govde.gonderen);
t("Resend'e giden istekte de o adres var", /onboarding@resend.dev/.test(globalThis.__sonIstek.govde.from || ""),
  globalThis.__sonIstek.govde.from);
delete process.env.RESEND_FROM;

/* ---- 6. ESKİ DAVRANIŞ BOZULMADI ---- */
console.log("\n Eski gönderim yolu");
const { epostaGonder } = await import("../lib/eposta.js");
resendKur({ ok: true, govde: {} });
t("epostaGonder hâlâ true/false döndürüyor", (await epostaGonder("a@b.com", "x", "y")) === true);
resendKur({ ok: false, status: 401, govde: { message: "bad" } });
t("başarısızlıkta false", (await epostaGonder("a@b.com", "x", "y")) === false);
t("alıcı yoksa false, çökme yok", (await epostaGonder("", "x", "y")) === false);
const ayrintili = await epostaGonderAyrintili("", "x", "y");
t("ayrıntılı sürüm sebebi söylüyor", ayrintili.kod === "alici-yok", ayrintili.kod);

globalThis.fetch = gercekFetch;
console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
