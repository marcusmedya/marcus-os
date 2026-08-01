import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimListesi: false, cekimEdit: true, personel: false, birikim: false, sifreKasasi: false,
};

function checkOwner(req) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true; // şifre ayarlanmadıysa (ilk kurulum) izin ver
  return req.headers["x-site-password"] === required;
}

// data.js'teki ile AYNI IP bazlı sayaç kullanılır — owner şifresi bu uç noktadan da
// denenebildiği için, brute-force sayacının uç noktalar arasında PAYLAŞILMASI gerekir;
// yoksa biri /api/data'da engellenip buradan denemeye devam edebilirdi.
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

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

async function yedekle(veri) {
  const bugun = new Date().toISOString().slice(0, 10);
  await kv.set(`marcus-os-snapshot-${bugun}`, veri);
}

function guvenliListe(hesaplar) {
  return (hesaplar || []).map((h) => ({ id: h.id, ad: h.ad, kullaniciAdi: h.kullaniciAdi, email: h.email || "", izinler: { ...DEFAULT_PERMS, ...(h.izinler || {}) } }));
}

export default async function handler(req, res) {
  if (await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }
  if (!checkOwner(req)) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz. Sadece yönetici bu sayfayı kullanabilir." });
  }

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
        const yeniVeri = { ...data, personelHesaplari: guncel }; await kv.set(KEY, yeniVeri); await yedekle(yeniVeri);
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      if (action === "sifreSifirla") {
        if (!id || !sifre) return res.status(400).json({ error: "id ve yeni şifre gerekli." });
        if (sifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
        const salt = crypto.randomBytes(16).toString("hex");
        const guncel = hesaplar.map((h) => (h.id === id ? { ...h, sifreHash: hashSifre(sifre, salt), sifreSalt: salt } : h));
        const yeniVeri = { ...data, personelHesaplari: guncel }; await kv.set(KEY, yeniVeri); await yedekle(yeniVeri);
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
        const yeniVeri = { ...data, personelHesaplari: guncel }; await kv.set(KEY, yeniVeri); await yedekle(yeniVeri);
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      if (action === "sil") {
        if (!id) return res.status(400).json({ error: "id gerekli." });
        const guncel = hesaplar.filter((h) => h.id !== id);
        const yeniVeri = { ...data, personelHesaplari: guncel }; await kv.set(KEY, yeniVeri); await yedekle(yeniVeri);
        return res.status(200).json({ ok: true, hesaplar: guvenliListe(guncel) });
      }

      return res.status(400).json({ error: "Geçersiz işlem." });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
