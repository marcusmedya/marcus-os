import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";
function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Owner her zaman yetkili. Personel ise "sifreKasasi" iznine sahipse doğrulama yapabilir
 * (ama şifreyi SADECE owner değiştirebilir — aşağıda ayrıca kontrol edilir). */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];
  if (ownerPw && provided === ownerPw) return { owner: true };
  if (!ownerPw && !staffPwLegacy && !req.headers["x-staff-username"]) return { owner: true };
  if (staffPwLegacy && provided === staffPwLegacy) return { owner: false };

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        if (perms.sifreKasasi === true) return { owner: false };
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  const auth = await yetkiliMi(req);
  if (!auth) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { action, sifre, yeniSifre } = req.body || {};
    const data = (await kv.get(KEY)) || {};

    if (action === "dogrula") {
      if (!sifre) return res.status(400).json({ ok: false, error: "Şifre gerekli." });
      if (!data.kasaSifresiHash) {
        // Henüz kasa şifresi belirlenmemiş — bootstrap için owner'ın site şifresi geçici olarak kabul edilir.
        const ownerPw = process.env.SITE_PASSWORD;
        if (ownerPw && sifre === ownerPw) return res.status(200).json({ ok: true, kasaSifresiYok: true });
        return res.status(200).json({ ok: false, error: "Şifre yanlış." });
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
      const yeniVeri = { ...data, kasaSifresiHash: hash, kasaSifresiSalt: salt };
      await kv.set(KEY, yeniVeri);
      const bugun = new Date().toISOString().slice(0, 10);
      await kv.set(`marcus-os-snapshot-${bugun}`, yeniVeri);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
