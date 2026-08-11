import { kv } from "@vercel/kv";
const bugunISO = () => {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
};

const KEY = "marcus-os-data";
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Owner her zaman yetkili. Personel ise "odemeTakvimi" iznine (ya da onunla örtüşen finans/müşteri
 * izinlerinden birine) sahipse yetkilidir — bu izinler aynı veriyi paylaştığı için. */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];
  if (ownerPw && provided === ownerPw) return true;
  if (!ownerPw && !staffPwLegacy && !req.headers["x-staff-username"]) return true;
  if (staffPwLegacy && provided === staffPwLegacy) return true;

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const crypto = await import("crypto");
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        return perms.odemeTakvimi === true || perms.musteriler === true || perms.finans === true || perms.dashboard === true;
      }
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { action, clientId, kayit, kayitId, odemeGunu } = req.body || {};
    if (!clientId) return res.status(400).json({ error: "clientId gerekli." });

    const data = (await kv.get(KEY)) || {};
    const clients = data.clients || [];
    const idx = clients.findIndex((c) => c.id === clientId);
    if (idx === -1) return res.status(404).json({ error: "Müşteri bulunamadı — sayfayı yenileyip tekrar dene." });

    const client = { ...clients[idx] };

    if (action === "addKaydi") {
      if (!kayit || !kayit.tutar) return res.status(400).json({ error: "Geçerli bir ödeme kaydı gerekli." });
      const yeniKayit = { ...kayit, id: nid() };
      client.odemeKayitlari = [...(client.odemeKayitlari || []), yeniKayit];
    } else if (action === "deleteKaydi") {
      if (!kayitId) return res.status(400).json({ error: "kayitId gerekli." });
      client.odemeKayitlari = (client.odemeKayitlari || []).filter((k) => k.id !== kayitId);
    } else if (action === "setOdemeGunu") {
      client.odemeGunu = odemeGunu || null;
    } else {
      return res.status(400).json({ error: "Geçersiz işlem." });
    }

    const yeniClients = [...clients];
    yeniClients[idx] = client;
    const yeniData = { ...data, clients: yeniClients };
    await kv.set(KEY, yeniData);

    // Günlük yedeği de güncel tut ki bu değişiklik de yedeklensin.
    const today = bugunISO();
    await kv.set(`marcus-os-snapshot-${today}`, yeniData);

    return res.status(200).json({ ok: true, client });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
