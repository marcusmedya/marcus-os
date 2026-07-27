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
