import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";
// Her alanın hangi izin anahtarına bağlı olduğu (CEO Paneli'nden açılıp kapatılabilir).
const STAFF_FIELD_PERMISSIONS = {
  reklamlar: "reklamlar",
  stoklar: "paylasimlar",
  paylasimGecmisi: "paylasimlar",
  cekimIsleri: "cekimEdit",
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
    // Hiçbir koruma ayarlanmadıysa (ilk kurulum) tam yetki ver.
    const username = req.headers["x-staff-username"];
    if (!username) return { role: "owner" };
  }
  if (ownerPw && provided === ownerPw) return { role: "owner" };
  if (staffPwLegacy && provided === staffPwLegacy) return { role: "staff", staffId: null, staffName: null };

  // Kişiye özel personel hesabı (Ayarlar > Personel Hesapları'ndan oluşturulur).
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
        // Personel sadece kendi alanlarını görsün; müşteri listesi de sadece marka kartlarını
        // gösterebilmek için isim/durum ile sınırlı gider — finans/maliyet bilgisi hiç gönderilmez.
        // Şifre hash'leri (personelHesaplari) hiçbir zaman bu yanıta dahil edilmez.
        const perms = (data && data.staffPermissions) || { reklamlar: true, paylasimlar: true, cekimEdit: true };
        const restricted = {
          staffPermissions: perms,
          reklamlar: (data && data.reklamlar) || [],
          stoklar: (data && data.stoklar) || {},
          paylasimGecmisi: (data && data.paylasimGecmisi) || [],
          cekimIsleri: (data && data.cekimIsleri) || [],
          clients: ((data && data.clients) || []).map((c) => ({ id: c.id, ad: c.ad, durum: c.durum })),
        };
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
      // korunur ve gönderilen içerik ne olursa olsun yok sayılır. CEO Paneli'nden bir
      // yetki kapatılmışsa (örn. cekimEdit: false), o alana yazma da reddedilir.
      if (role === "staff") {
        const existing = (await kv.get(KEY)) || {};
        const perms = existing.staffPermissions || { reklamlar: true, paylasimlar: true, cekimEdit: true };
        const merged = { ...existing };
        Object.entries(STAFF_FIELD_PERMISSIONS).forEach(([field, permKey]) => {
          if (perms[permKey] !== false && data[field] !== undefined) merged[field] = data[field];
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

      // Her kayıtta o günün otomatik yedeğini de al (aynı gün içindeki kayıtlar üzerine yazar,
      // yani her günün son hali yedeklenmiş olur).
      const today = new Date().toISOString().slice(0, 10);
      await kv.set(`marcus-os-snapshot-${today}`, finalData);

      // Ara sıra (her kayıtta değil, maliyeti düşük tutmak için) 30 günden eski yedekleri temizle.
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
          // temizlik hatası kritik değil, kayıt işlemini engellemesin
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
