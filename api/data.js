import { kv } from "@vercel/kv";

const KEY = "marcus-os-data";

function checkAuth(req, res) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true; // şifre ayarlanmadıysa koruma devre dışı
  const provided = req.headers["x-site-password"];
  if (provided !== required) {
    res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);
      return res.status(200).json({ data: data || null });
    }

    if (req.method === "POST") {
      const { data } = req.body || {};
      if (!data) return res.status(400).json({ error: "data eksik" });
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
