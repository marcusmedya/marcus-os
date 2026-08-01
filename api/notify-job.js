async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const provided = req.headers["x-site-password"];
  if (!ownerPw) return true;
  if (provided === ownerPw) return true;

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const { kv } = await import("@vercel/kv");
    const crypto = await import("crypto");
    const data = await kv.get("marcus-os-data");
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        return perms.cekimEdit === true;
      }
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { email, ad, marka, icerikTuru, teslimTarihi, firmaAdi } = req.body || {};
    const resendKey = process.env.RESEND_API_KEY;
    if (!email) return res.status(200).json({ skipped: true, reason: "Bu kişinin kayıtlı bir e-posta adresi yok." });
    if (!resendKey) return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY tanımlı değil." });

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a1a;">Yeni İş Ataması</h2>
        <p style="color:#333; line-height:1.6;">Merhaba ${ad || ""},</p>
        <p style="color:#333; line-height:1.6;"><strong>${marka || ""}</strong> için <strong>${icerikTuru || "bir iş"}</strong> sana atandı.</p>
        ${teslimTarihi ? `<p style="color:#333;">Teslim tarihi: <strong>${teslimTarihi}</strong></p>` : ""}
        <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus OS"} — Operasyon panelinden gönderildi.</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Marcus OS <onboarding@resend.dev>",
        to: [email],
        subject: `Yeni İş: ${marka || ""} — ${icerikTuru || ""}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ skipped: true, reason: "E-posta gönderilemedi.", detail: err });
    }

    return res.status(200).json({ ok: true, to: email });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
