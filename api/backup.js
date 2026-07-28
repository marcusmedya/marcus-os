import { kv } from "@vercel/kv";

const PREFIX = "marcus-os-snapshot-";
const MAIN_KEY = "marcus-os-data";

function checkAuth(req, res) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true;
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
      const keys = await kv.keys(`${PREFIX}*`);
      const dates = keys.map((k) => k.replace(PREFIX, "")).sort().reverse();
      return res.status(200).json({ dates });
    }

    if (req.method === "POST") {
      const { date } = req.body || {};
      if (!date) return res.status(400).json({ error: "date eksik" });
      const snapshot = await kv.get(`${PREFIX}${date}`);
      if (!snapshot) return res.status(404).json({ error: "Bu tarihe ait yedek bulunamadı." });
      await kv.set(MAIN_KEY, snapshot);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
