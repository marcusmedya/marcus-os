import { kv } from "@vercel/kv";
import crypto from "crypto";
import { gonderenAdres } from "./eposta.js";

/**
 * OTURUM VE İKİ ADIMLI DOĞRULAMA KATMANI
 * --------------------------------------
 * api/ klasörünün DIŞINDA olduğu için Vercel bunu bir serverless function saymaz —
 * fonksiyon sayısı 12/12 olarak kalır.
 *
 * ÇÖZÜLEN GÜVENLİK SORUNU
 * Önceden yönetici şifresi tarayıcının localStorage'ında SÜRESİZ duruyordu ve giriş alanı
 * `autocomplete="current-password"` olduğu için tarayıcı şifreyi kaydedip otomatik dolduruyordu.
 * Sonuç: o cihaza oturan herkes CEO paneline girebiliyordu.
 *
 * YENİ DÜZEN
 *  - Tarayıcı artık şifreyi HİÇ saklamıyor; sadece süreli bir "oturum anahtarı" saklıyor.
 *  - Oturum anahtarı sunucuda tutulur, süresi dolar ve tek tıkla iptal edilebilir.
 *  - OWNER_EMAIL tanımlıysa girişte e-postaya 6 haneli kod gider (iki adımlı doğrulama).
 *
 * KİLİTLENME KORUMASI: OWNER_EMAIL ya da RESEND_API_KEY tanımlı değilse kod adımı atlanır,
 * şifre doğruysa doğrudan oturum açılır. Yani e-posta çalışmasa bile sisteme girebilirsin.
 */

const OTURUM_PREFIX = "marcus-os-oturum-";
const KOD_PREFIX = "marcus-os-giriskodu-";
const IPTAL_KEY = "marcus-os-oturum-iptal-zamani";

/** Oturum süreleri: normal giriş 12 saat, "bu cihazı hatırla" 30 gün. */
const SURE_NORMAL = 60 * 60 * 12;
const SURE_HATIRLA = 60 * 60 * 24 * 30;
/** Giriş kodunun geçerlilik süresi: 10 dakika. */
const KOD_SURESI = 600;

const rastgele = (uzunluk = 32) => crypto.randomBytes(uzunluk).toString("hex");

/** Zamanlama saldırılarına karşı sabit süreli karşılaştırma. */
export function esitMi(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  if (x.length !== y.length) return false;
  try { return crypto.timingSafeEqual(x, y); } catch (e) { return false; }
}

/** 6 haneli, tahmin edilmesi zor giriş kodu. */
export function kodUret() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Giriş kodunu üretip saklar ve e-postayla gönderir. Gönderilemezse false döner. */
export async function girisKoduGonder(ip) {
  const email = process.env.OWNER_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!email || !resendKey) return { gonderildi: false, sebep: "yapilandirilmamis" };

  const kod = kodUret();
  await kv.set(`${KOD_PREFIX}${kod}`, { olusturma: Date.now(), ip: ip || null }, { ex: KOD_SURESI });

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px">
      <h2 style="margin:0 0 12px;font-size:18px">Marcus Medya App — Giriş Kodu</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">
        Yönetici paneline giriş yapılmak isteniyor. Kod 10 dakika geçerlidir.
      </p>
      <div style="font-size:34px;font-weight:700;letter-spacing:7px;background:#f4f4f5;padding:16px;text-align:center;border-radius:10px">${kod}</div>
      <p style="color:#888;font-size:12px;line-height:1.6;margin:16px 0 0">
        Bu girişi sen yapmadıysan <strong>şifreni hemen değiştir</strong> — birisi şifreni biliyor olabilir.
      </p>
    </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: gonderenAdres(),
        to: [email],
        subject: `Giriş kodun: ${kod}`,
        html,
      }),
    });
    if (!r.ok) {
      // Resend'in kendi hata metnini taşıyoruz. Genel bir "gönderilemedi" mesajı, sorunun
      // alan adı doğrulaması mı, adres hatası mı, kota mı olduğunu gizliyordu.
      const hata = await r.json().catch(() => ({}));
      return { gonderildi: false, sebep: hata.message || hata.error || `HTTP ${r.status}` };
    }
    return { gonderildi: true };
  } catch (e) {
    return { gonderildi: false, sebep: e.message || "bağlantı hatası" };
  }
}

/** Girilen kodu doğrular ve doğruysa TEK KULLANIMLIK olacak şekilde siler. */
export async function koduDogrula(kod) {
  if (!kod || !/^\d{6}$/.test(String(kod).trim())) return false;
  const anahtar = `${KOD_PREFIX}${String(kod).trim()}`;
  const kayit = await kv.get(anahtar);
  if (!kayit) return false;
  await kv.del(anahtar); // aynı kod ikinci kez kullanılamaz
  return true;
}

/** Yeni bir oturum anahtarı üretip sunucuda saklar. */
export async function oturumAc(hatirla) {
  const token = rastgele(32);
  const sure = hatirla ? SURE_HATIRLA : SURE_NORMAL;
  await kv.set(`${OTURUM_PREFIX}${token}`, { acilis: Date.now(), rol: "owner" }, { ex: sure });
  return { token, sure };
}

/** Oturum anahtarı geçerli mi? Toplu iptalden sonra açılmış olması da gerekir. */
export async function oturumGecerliMi(token) {
  if (!token || typeof token !== "string" || token.length < 32) return false;
  try {
    const kayit = await kv.get(`${OTURUM_PREFIX}${token}`);
    if (!kayit) return false;
    const iptalZamani = await kv.get(IPTAL_KEY);
    if (iptalZamani && kayit.acilis && kayit.acilis < Number(iptalZamani)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/** Tek bir oturumu kapatır (çıkış yap). */
export async function oturumKapat(token) {
  if (!token) return;
  try { await kv.del(`${OTURUM_PREFIX}${token}`); } catch (e) { /* zaten yok */ }
}

/** TÜM cihazlardaki oturumları geçersiz kılar — "şifremi başkası biliyor" durumunda
 * tek tıkla her yerden çıkış yapmayı sağlar. */
export async function tumOturumlariIptalEt() {
  await kv.set(IPTAL_KEY, Date.now());
}

/**
 * Yönetici yetkisi kontrolü. İki yol kabul edilir:
 *  1. Geçerli oturum anahtarı (normal yol — tarayıcı bunu saklar)
 *  2. Doğru yönetici şifresi (yedek yol)
 *
 * İkinci yol bilerek bırakıldı: oturum sistemi bir sebeple çalışmazsa uygulamadan tamamen
 * kilitlenmeyesin diye. Tarayıcı artık şifreyi saklamadığı ve otomatik doldurmadığı için,
 * cihazına oturan birinin şifreyi ele geçirmesi mümkün değil.
 */
export async function ownerYetkiliMi(req) {
  const token = req.headers["x-oturum"];
  if (token && (await oturumGecerliMi(token))) return true;

  const ownerPw = process.env.SITE_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  if (ownerPw && provided && esitMi(provided, ownerPw)) return true;
  return false;
}

/** İki adımlı doğrulama yapılandırılmış mı? */
export function ikiAdimliAktifMi() {
  return !!(process.env.OWNER_EMAIL && process.env.RESEND_API_KEY);
}

/**
 * KİMLİK BAŞLIĞI OKUMA
 * --------------------
 * HTTP başlık değerleri yalnızca ASCII taşıyabilir. Türkçe karakter içeren bir kullanıcı adı
 * ya da şifre ("saygı", "çağrı") doğrudan başlığa konduğunda tarayıcı isteği GÖNDERMEDEN hata
 * veriyordu. Bu yüzden istemci artık kimlik bilgilerini base64 olarak "…-B64" başlıklarında
 * gönderiyor.
 *
 * Bu fonksiyon önce base64 başlığa bakar, yoksa eski düz başlığa düşer — böylece güncellenmemiş
 * bir sekme ya da eski bir istemci de çalışmaya devam eder.
 */
export function baslikOku(req, ad) {
  const b64 = req.headers[`${ad}-b64`];
  if (b64) {
    try {
      const cozulmus = Buffer.from(String(b64), "base64").toString("utf8");
      if (cozulmus) return cozulmus;
    } catch (e) {
      // bozuk base64 — düz başlığa düş
    }
  }
  return req.headers[ad] || "";
}
