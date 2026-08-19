import { kv } from "@vercel/kv";
import crypto from "crypto";
import { KEY, guvenliGuncelle, mesgulYanit } from "../lib/kv-yaz.js";
import { ownerYetkiliMi, baslikOku, esitMi } from "../lib/oturum.js";

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Owner her zaman yetkili. Personel ise "sifreKasasi" iznine sahipse doğrulama yapabilir
 * (ama şifreyi SADECE owner değiştirebilir — aşağıda ayrıca kontrol edilir). */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  if (await ownerYetkiliMi(req)) return { owner: true };
  /* KAPALI DÜŞÜYOR — denetim bulgusu. "Yapılandırma eksikse izin ver" satırı buradaydı;
   * SITE_PASSWORD tanımsızken bu uç kimliksiz isteklere yanıt veriyordu. */
  if (!ownerPw && !staffPwLegacy) return null;
  if (staffPwLegacy && provided && esitMi(provided, staffPwLegacy)) return { owner: false };

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (esitMi(hash, hesap.sifreHash)) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        if (perms.sifreKasasi === true) return { owner: false };
      }
    }
  }
  return null;
}

const RATE_LIMIT_ESIK = 20;
const RATE_LIMIT_PENCERE_SN = 900;
function istekIP(req) {
  return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "bilinmeyen").split(",")[0].trim();
}
async function rateLimitAsildiMi(req) {
  try {
    const sayac = (await kv.get(`login-fail-${istekIP(req)}`)) || 0;
    return sayac >= RATE_LIMIT_ESIK;
  } catch (e) {
    return false;
  }
}
async function basarisizGirisiKaydet(req) {
  try {
    const key = `login-fail-${istekIP(req)}`;
    const sayac = (await kv.get(key)) || 0;
    await kv.set(key, sayac + 1, { ex: RATE_LIMIT_PENCERE_SN });
  } catch (e) {
    // sessizce geç
  }
}

export default async function handler(req, res) {
  if (await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }
  const auth = await yetkiliMi(req);
  if (!auth) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz." });
  }

  if (req.method === "GET") {
    // Sadece "özel bir kasa şifresi ayarlanmış mı" bilgisini döner — hash/salt asla gönderilmez.
    const data = (await kv.get(KEY)) || {};
    return res.status(200).json({ ayarlandiMi: !!data.kasaSifresiHash });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });

  try {
    const { action, sifre, yeniSifre } = req.body || {};
    const data = (await kv.get(KEY)) || {};

    if (action === "dogrula") {
      if (!sifre) return res.status(400).json({ ok: false, error: "Şifre gerekli." });
      if (!data.kasaSifresiHash) {
        // Henüz kasa şifresi hiç belirlenmemiş — owner şifresiyle (ya da başka hiçbir şeyle)
        // GİRİLEMEZ. Önce Ayarlar'dan bir kasa şifresi belirlenmesi gerekir.
        return res.status(200).json({ ok: false, kasaSifresiYok: true, error: "Henüz kasa şifresi belirlenmemiş. Önce Ayarlar > Şifre Kasası Şifresi'nden bir şifre belirle." });
      }
      const hash = hashSifre(sifre, data.kasaSifresiSalt);
      if (hash === data.kasaSifresiHash) return res.status(200).json({ ok: true });
      return res.status(200).json({ ok: false, error: "Şifre yanlış." });
    }

    if (action === "degistir") {
      if (!auth.owner) return res.status(401).json({ error: "Sadece yönetici kasa şifresini değiştirebilir." });
      if (!yeniSifre || yeniSifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = hashSifre(yeniSifre, salt);
      // Kilit altında ve en güncel veri üzerinde yazılır — yukarıda okunan kopya bu noktada
      // bayatlamış olabilir ve o kopyayı yazmak arada yapılan işleri silerdi.
      const sonuc = await guvenliGuncelle(async (guncel) => ({
        /* Yalnızca kasa şifresi değişiyor; başka bölümde çalışanlar etkilenmesin.
         *
         * SAYAÇ ADI NÖTR: `_alanSurumleri` haritası yönetici GET'inde gönderiliyor ve
         * gizli alan ADLARININ oraya girmesi gereksiz. Değer zaten bir sayı, sızıntı yok
         * ama alan adını da taşımaya gerek yok. Tarayıcı bu alanları hiç göndermediği
         * için adın tutması da gerekmiyor. */
        degisenAlanlar: ["kasa"],
        veri: { ...guncel, kasaSifresiHash: hash, kasaSifresiSalt: salt },
      }));
      if (!sonuc.ok) {
        if (sonuc.mesgul) return mesgulYanit(res);
        return res.status(500).json({ error: "Kasa şifresi kaydedilemedi, tekrar dene." });
      }
      /* Yazılan sürüm geri dönüyor: bildirilmezse yönetici sekmesi bir tur geride kalır ve
       * sonraki kayıt sahte çakışmayla kullanıcının düzenlemesini siler. */
      return res.status(200).json({ ok: true, ...(sonuc.veri && typeof sonuc.veri._v === "number" ? { _v: sonuc.veri._v } : {}) });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
