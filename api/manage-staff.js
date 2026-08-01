import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimEdit: true, personel: false, birikim: false,
};

function checkOwner(req) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true; // şifre ayarlanmadıysa (ilk kurulum) izin ver
  return req.headers["x-site-password"] === required;
}

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

function guvenliListe(hesaplar) {
  return (hesaplar || []).map((h) => ({ id: h.id, ad: h.ad, kullaniciAdi: h.kullaniciAdi, email: h.email || "", izinler: { ...DEFAULT_PERMS, ...(h.izinler || {}) } }));
}

export default async function handler(req, res) {
  if (!checkOwner(req)) return res.status(401).json({ error: "Yetkisiz. Sadece yönetici bu sayfayı kullanabilir." });

  try {
    const data = (await kv.get(KEY)) || {};
    const hesaplar = data.personelHesaplari || [];

    if (req.method === "GET") {
      return res.status(200).json({ hesaplar: guvenliListe(hesaplar) });
    }

    if (req.method === "POST") {
      const { action, id, ad, kullaniciAdi, sifre, email, izinler } = req.body || {};

      if (action === "ekle") {
        if (!ad || !kullaniciAdi || !sifre) return res.status(400).json({ error: "Ad, kullanıcı adı ve şifre gerekli." });
        if (sifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
        if (hesaplar.some((h) => h.kullaniciAdi.toLowerCase() === kullaniciAdi.toLowerCase())) {
          return res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." });
        }
        const salt = crypto.randomBytes(16).toString("hex");
        const yeni = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad, kullaniciAdi, email: email || "", izinler: { ...DEFAULT_PERMS }, sifreHash: hashSifre(sifre, salt), sifreSalt: salt };
        const guncel = [...hesaplar, yeni];
        await kv.set(KEY, { ...data, personelHesaplari: guncel });
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      if (action === "sifreSifirla") {
        if (!id || !sifre) return res.status(400).json({ error: "id ve yeni şifre gerekli." });
        if (sifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
        const salt = crypto.randomBytes(16).toString("hex");
        const guncel = hesaplar.map((h) => (h.id === id ? { ...h, sifreHash: hashSifre(sifre, salt), sifreSalt: salt } : h));
        await kv.set(KEY, { ...data, personelHesaplari: guncel });
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      if (action === "guncelle") {
        if (!id) return res.status(400).json({ error: "id gerekli." });
        const guncel = hesaplar.map((h) => {
          if (h.id !== id) return h;
          const yeni = { ...h };
          if (email !== undefined) yeni.email = email;
          if (izinler !== undefined) yeni.izinler = { ...DEFAULT_PERMS, ...izinler };
          return yeni;
        });
        await kv.set(KEY, { ...data, personelHesaplari: guncel });
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      if (action === "sil") {
        if (!id) return res.status(400).json({ error: "id gerekli." });
        const guncel = hesaplar.filter((h) => h.id !== id);
        await kv.set(KEY, { ...data, personelHesaplari: guncel });
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      return res.status(400).json({ error: "Geçersiz işlem." });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
