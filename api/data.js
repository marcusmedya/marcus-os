import { kv } from "@vercel/kv";

const KEY = "marcus-os-data";
const STAFF_FIELDS = ["reklamlar", "paylasimlar"];

/** Şifreyi kontrol edip rolü döndürür: "owner" (tam yetki), "staff" (sadece reklam/paylaşım), ya da null (yetkisiz). */
function resolveRole(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPw = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];
  if (!ownerPw && !staffPw) return "owner"; // hiç şifre ayarlanmadıysa koruma devre dışı, tam yetki
  if (ownerPw && provided === ownerPw) return "owner";
  if (staffPw && provided === staffPw) return "staff";
  return null;
}

export default async function handler(req, res) {
  const role = resolveRole(req);
  if (!role) return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });

  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);
      if (role === "staff") {
        // Personel sadece kendi alanlarını görsün; diğer iş verileri tarayıcıya hiç gönderilmesin.
        const restricted = { reklamlar: (data && data.reklamlar) || [], paylasimlar: (data && data.paylasimlar) || [] };
        return res.status(200).json({ data: restricted, role });
      }
      return res.status(200).json({ data: data || null, role });
    }

    if (req.method === "POST") {
      const { data, force } = req.body || {};
      if (!data) return res.status(400).json({ error: "data eksik" });

      // PERSONEL: sadece reklamlar/paylasimlar alanlarını değiştirebilir, geri kalan veri
      // sunucuda korunur ve gönderilen içerik ne olursa olsun yok sayılır.
      if (role === "staff") {
        const existing = (await kv.get(KEY)) || {};
        const merged = { ...existing };
        STAFF_FIELDS.forEach((f) => { merged[f] = data[f]; });
        await kv.set(KEY, merged);
        return res.status(200).json({ ok: true });
      }

      // GÜVENLİK FRENİ: müşteri sayısı mevcut veriye göre çarpıcı biçimde azalıyorsa
      // (örn. bir hata sonucu boş/demo veri yazılmaya çalışılıyorsa) kaydı reddet.
      // Bilinçli bir toplu silme durumunda ön yüz "force: true" ile tekrar dener.
      if (!force) {
        const existing = await kv.get(KEY);
        const existingCount = existing && Array.isArray(existing.clients) ? existing.clients.length : 0;
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

      await kv.set(KEY, data);

      // Her kayıtta o günün otomatik yedeğini de al (aynı gün içindeki kayıtlar üzerine yazar,
      // yani her günün son hali yedeklenmiş olur).
      const today = new Date().toISOString().slice(0, 10);
      await kv.set(`marcus-os-snapshot-${today}`, data);

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
