import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";

// Her izin, personel görürse hangi veri alanlarına ihtiyaç duyacağını belirler.
// CEO Paneli'nden bu izinlerden hangileri açıksa, personelin GET yanıtına o alanlar dahil edilir
// ve POST ile o alanlara yazması kabul edilir. Ayarlar bilerek bu listede YOK — personel hesap
// yönetimi, şifre koruması gibi güvenlik ayarlarına personelin asla erişimi olmaz.
const PERMISSION_DATA_FIELDS = {
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "clients"],
  cekimEdit: ["cekimIsleri", "clients"],
  personel: ["personel"],
  birikim: ["birikimler"],
};
const FULL_CLIENT_PERMS = ["dashboard", "musteriler", "finans", "takvim", "odemeTakvimi"];
const DEFAULT_FIELD_VALUES = {
  clients: [], monthly: [], gelirKalemleri: [], giderKalemleri: [], ofisGiderleri: [], bekleyenTahsilatlar: [],
  personel: [], vergiTakvimi: [], hesaplar: [{ id: "ana", ad: "Marcus Medya", anaHesap: true }], hesapTransferleri: [],
  teklifler: [], teklifSablonlari: [], sozlesmeSablonlari: [], markaKimligiGorseli: null,
  reklamlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: null, cekimIsleri: [], birikimler: [],
};
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimEdit: true, personel: false, birikim: false,
};

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Şifreyi/kimlik bilgilerini kontrol edip rolü döndürür.
 * "owner" (tam yetki), "staff" (izinli alanlar, opsiyonel kişisel kimlikle), ya da null (yetkisiz). */
async function resolveRole(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];

  if (!ownerPw && !staffPwLegacy) {
    const username = req.headers["x-staff-username"];
    if (!username) return { role: "owner" };
  }
  if (ownerPw && provided === ownerPw) return { role: "owner" };
  if (staffPwLegacy && provided === staffPwLegacy) return { role: "staff", staffId: null, staffName: null };

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "staff", staffId: hesap.id, staffName: hesap.ad };
    }
  }
  return null;
}

export default async function handler(req, res) {
  const auth = await resolveRole(req);
  if (!auth) return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  const { role, staffId, staffName } = auth;

  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);
      if (role === "staff") {
        const perms = { ...DEFAULT_PERMS, ...((data && data.staffPermissions) || {}) };
        const restricted = { staffPermissions: perms, firmaAdi: (data && data.firmaAdi) || "Marcus Medya" };

        // Hangi izinler açıksa, o izne bağlı alanları gerçek veriyle dolduruyoruz.
        Object.entries(PERMISSION_DATA_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => { restricted[f] = (data && data[f] !== undefined) ? data[f] : DEFAULT_FIELD_VALUES[f]; });
        });

        // clients alanı: geniş kapsamlı bir izin varsa TAM veri, sadece paylasimlar/cekimEdit gibi
        // dar izinler varsa sadece marka kartları için isim/durum ile sınırlı veri gönderilir.
        const genisIzinVarMi = FULL_CLIENT_PERMS.some((p) => perms[p] === true);
        if (!genisIzinVarMi && restricted.clients) {
          restricted.clients = ((data && data.clients) || []).map((c) => ({ id: c.id, ad: c.ad, durum: c.durum }));
        }

        return res.status(200).json({ data: restricted, role, staffId, staffName });
      }
      // Sahibe (owner) bile şifre hash'lerini asla gönderme — ayrı, korumalı bir uçtan yönetiliyor.
      const { personelHesaplari, ...safeData } = data || {};
      return res.status(200).json({ data: data ? safeData : null, role });
    }

    if (req.method === "POST") {
      const { data, force } = req.body || {};
      if (!data) return res.status(400).json({ error: "data eksik" });

      // PERSONEL: sadece izin verilen alanları değiştirebilir, geri kalan veri sunucuda
      // korunur ve gönderilen içerik ne olursa olsun yok sayılır.
      if (role === "staff") {
        const existing = (await kv.get(KEY)) || {};
        const perms = { ...DEFAULT_PERMS, ...(existing.staffPermissions || {}) };
        const merged = { ...existing };
        Object.entries(PERMISSION_DATA_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => { if (data[f] !== undefined) merged[f] = data[f]; });
        });
        await kv.set(KEY, merged);
        return res.status(200).json({ ok: true });
      }

      // Owner'ın yerel kopyasında personelHesaplari hiç yok (GET'te hiç gönderilmiyor) —
      // bu yüzden her kayıtta mevcut hesapları sunucudan alıp geri ekliyoruz, yoksa
      // ilk kayıtta tüm personel hesapları sessizce silinmiş olurdu.
      const existingFull = await kv.get(KEY);

      // GÜVENLİK FRENİ: müşteri sayısı mevcut veriye göre çarpıcı biçimde azalıyorsa
      // (örn. bir hata sonucu boş/demo veri yazılmaya çalışılıyorsa) kaydı reddet.
      // Bilinçli bir toplu silme durumunda ön yüz "force: true" ile tekrar dener.
      if (!force) {
        const existingCount = existingFull && Array.isArray(existingFull.clients) ? existingFull.clients.length : 0;
        const newCount = Array.isArray(data.clients) ? data.clients.length : 0;
        if (existingCount >= 2 && newCount < existingCount * 0.6) {
          return res.status(409).json({
            blocked: true,
            error: `Güvenlik freni: mevcut ${existingCount} müşteriden ${newCount}'a düşen bir kayıt engellendi. Bu istenmeyen bir veri kaybı olabilir.`,
            existingCount,
            newCount,
          });
        }
      }

      const finalData = { ...data, personelHesaplari: (existingFull && existingFull.personelHesaplari) || [] };
      await kv.set(KEY, finalData);

      const today = new Date().toISOString().slice(0, 10);
      await kv.set(`marcus-os-snapshot-${today}`, finalData);

      if (Math.random() < 0.08) {
        try {
          const keys = await kv.keys("marcus-os-snapshot-*");
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          for (const k of keys) {
            const d = k.replace("marcus-os-snapshot-", "");
            if (new Date(d) < cutoff) await kv.del(k);
          }
        } catch (e) {
          // temizlik hatası kritik değil
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({
      error:
        "Veritabanına bağlanılamadı. Vercel projende bir KV (Storage) veritabanı bağlı olduğundan emin ol. Detay: " +
        e.message,
    });
  }
}
