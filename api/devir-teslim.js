import { kv } from "@vercel/kv";

const KEY = "marcus-os-data";

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
        return perms.sifreKasasi === true;
      }
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { email, marka, driveLinki, girisler, firmaAdi } = req.body || {};
    const resendKey = process.env.RESEND_API_KEY;
    if (!email) return res.status(400).json({ error: "Müşteri e-posta adresi gerekli." });
    if (!resendKey) return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY tanımlı değil." });

    const girisSatirlari = (girisler || [])
      .filter((g) => g.kullanici || g.sifre)
      .map((g) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${g.platform}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${g.kullanici || "—"}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${g.sifre || "—"}</td></tr>`)
      .join("");

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color:#1d1d1f;">
        <h2 style="color:#1a1a1a;">Hesap Devir Teslim Bildirimi</h2>
        <p style="line-height:1.6;">Sayın <strong>${marka || ""}</strong> yetkilisi,</p>
        <p style="line-height:1.6;">${firmaAdi || "Marcus Medya"} ile aranızdaki hizmet sürecini sonlandırmış bulunmaktayız. Sizinle ilgili tüm belge ve dosyalarınıza aşağıdaki bağlantıdan ulaşabilirsiniz:</p>
        ${driveLinki ? `<p><a href="${driveLinki}" style="color:#0071E3;">${driveLinki}</a></p>` : ""}
        ${girisSatirlari ? `
        <p style="line-height:1.6;">Ayrıca güvenliğiniz için hesaplarınıza ait giriş bilgileri aşağıda paylaşılmıştır:</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <tr style="background:#f5f5f7;"><th style="padding:6px 12px;text-align:left;">Platform</th><th style="padding:6px 12px;text-align:left;">Kullanıcı Adı</th><th style="padding:6px 12px;text-align:left;">Şifre</th></tr>
          ${girisSatirlari}
        </table>` : ""}
        <p style="line-height:1.6;background:#fff4e5;padding:12px 14px;border-radius:8px;"><strong>Önemli:</strong> Lütfen bu bilgilerle giriş yapıp <strong>24 saat (1 gün) içinde</strong> tüm şifrelerinizi değiştiriniz.</p>
        <p style="line-height:1.6;background:#ffecec;padding:12px 14px;border-radius:8px;">Bu belgeler ve veriler sistemimizden <strong>15 gün içinde kalıcı olarak silinecektir.</strong> Belirtilen süre içinde şifrelerinizi değiştirmemeniz durumunda oluşabilecek herhangi bir yetkisiz erişim veya güvenlik sorunundan tarafımız sorumluluk kabul etmemektedir.</p>
        <p style="line-height:1.6;">İyi çalışmalar dileriz.</p>
        <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus Medya"}</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Marcus OS <bildirim@marcusmedya.com>",
        to: [email],
        subject: `Hesap Devir Teslim Bildirimi — ${marka || ""}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const gercekMesaj = err.message || err.error || JSON.stringify(err);
      return res.status(200).json({ skipped: true, reason: `E-posta gönderilemedi: ${gercekMesaj}` });
    }

    return res.status(200).json({ ok: true, to: email });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
