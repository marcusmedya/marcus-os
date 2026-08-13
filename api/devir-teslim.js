import { kv } from "@vercel/kv";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { trKucult } from "../lib/marka-kilidi.js";

const KEY = "marcus-os-data";

async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  if (await ownerYetkiliMi(req)) return true;
  if (!ownerPw && !staffPwLegacy && !baslikOku(req, "x-staff-username")) return true;
  if (staffPwLegacy && provided === staffPwLegacy) return true;

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const crypto = await import("crypto");
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        if (perms.sifreKasasi !== true) return false;
        return { markalar: Array.isArray(hesap.markalar) ? hesap.markalar : [] };
      }
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  const yetki = await yetkiliMi(req);
  if (!yetki) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { email, marka, driveLinki, girisler, firmaAdi, mod, logo } = req.body || {};
    const resendKey = process.env.RESEND_API_KEY;
    /* Marka kilitli hesap yalnızca kendi markaları için devir teslim gönderebilir. */
    if (yetki && Array.isArray(yetki.markalar) && yetki.markalar.length > 0) {
      const izinliAdlar = new Set(yetki.markalar.map(trKucult));
      if (!marka || !izinliAdlar.has(trKucult(marka))) {
        return res.status(403).json({ error: "Bu markaya erişim yetkin yok." });
      }
    }
    if (!email) return res.status(400).json({ error: "Müşteri e-posta adresi gerekli." });
    if (!resendKey) return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY tanımlı değil." });

    const girisSatirlari = (girisler || [])
      .filter((g) => g.kullanici || g.sifre)
      .map((g) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${g.platform}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">${g.kullanici || "—"}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-weight:600;">${g.sifre || "—"}</td></tr>`)
      .join("");

    const hizli = mod === "hizli";
    const baslik = hizli ? "Hesap Bilgileri" : "Hesap Devir Teslim Bildirimi";
    const girisTablosu = girisSatirlari ? `
        <p style="line-height:1.6;">Talep ettiğiniz hesap giriş bilgileri aşağıda, platform platform paylaşılmıştır:</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr style="background:#f5f5f7;"><th style="padding:8px 12px;text-align:left;">Platform</th><th style="padding:8px 12px;text-align:left;">Kullanıcı Adı</th><th style="padding:8px 12px;text-align:left;">Şifre</th></tr>
          ${girisSatirlari}
        </table>` : "";

    const logoHtml = logo ? `<div style="text-align:center;margin-bottom:20px;"><img src="${logo}" alt="${firmaAdi || "Marcus Medya"}" style="max-height:56px;max-width:220px;object-fit:contain;" /></div>` : "";
    const guvenlikUyarisi = `
      <div style="margin-top:22px;padding:14px 16px;background:#fff8e1;border:1px solid #f0d878;border-radius:10px;">
        <p style="line-height:1.6;margin:0;font-size:13px;color:#6b5a00;">
          🔒 <strong>Güvenliğiniz için önemli:</strong> Bu e-posta gizli hesap bilgileri içermektedir.
          Bilgilerinizi aldıktan sonra bu e-postayı <strong>siliniz</strong> ve şifrelerinizi
          <strong>hiçbir 3. şahısla paylaşmayınız</strong>.
        </p>
      </div>`;

    const html = hizli ? `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color:#1d1d1f; padding: 8px;">
        ${logoHtml}
        <h2 style="color:#1a1a1a; text-align:center;">${baslik}</h2>
        <p style="line-height:1.6;">Sayın <strong>${marka || ""}</strong> yetkilisi,</p>
        <p style="line-height:1.6;">Talebiniz üzerine hesap bilgileriniz aşağıda paylaşılmıştır.</p>
        ${driveLinki ? `<p><a href="${driveLinki}" style="color:#0071E3;">${driveLinki}</a></p>` : ""}
        ${girisTablosu}
        ${guvenlikUyarisi}
        <p style="line-height:1.6;margin-top:20px;">İyi çalışmalar dileriz.</p>
        <p style="font-size:12px;color:#999;margin-top:8px;text-align:center;border-top:1px solid #eee;padding-top:14px;">${firmaAdi || "Marcus Medya"}</p>
      </div>
    ` : `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color:#1d1d1f; padding: 8px;">
        ${logoHtml}
        <h2 style="color:#1a1a1a; text-align:center;">${baslik}</h2>
        <p style="line-height:1.6;">Sayın <strong>${marka || ""}</strong> yetkilisi,</p>
        <p style="line-height:1.6;">${firmaAdi || "Marcus Medya"} ile aranızdaki hizmet sürecini sonlandırmış bulunmaktayız. Sizinle ilgili tüm belge ve dosyalarınıza aşağıdaki bağlantıdan ulaşabilirsiniz:</p>
        ${driveLinki ? `<p><a href="${driveLinki}" style="color:#0071E3;">${driveLinki}</a></p>` : ""}
        ${girisSatirlari ? `
        <p style="line-height:1.6;">Ayrıca güvenliğiniz için hesaplarınıza ait giriş bilgileri, platform platform aşağıda paylaşılmıştır:</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr style="background:#f5f5f7;"><th style="padding:8px 12px;text-align:left;">Platform</th><th style="padding:8px 12px;text-align:left;">Kullanıcı Adı</th><th style="padding:8px 12px;text-align:left;">Şifre</th></tr>
          ${girisSatirlari}
        </table>` : ""}
        <p style="line-height:1.6;background:#fff4e5;padding:12px 14px;border-radius:8px;"><strong>Önemli:</strong> Lütfen bu bilgilerle giriş yapıp <strong>24 saat (1 gün) içinde</strong> tüm şifrelerinizi değiştiriniz.</p>
        <p style="line-height:1.6;background:#ffecec;padding:12px 14px;border-radius:8px;">Bu belgeler ve veriler sistemimizden <strong>15 gün içinde kalıcı olarak silinecektir.</strong> Belirtilen süre içinde şifrelerinizi değiştirmemeniz durumunda oluşabilecek herhangi bir yetkisiz erişim veya güvenlik sorunundan tarafımız sorumluluk kabul etmemektedir.</p>
        ${guvenlikUyarisi}
        <p style="line-height:1.6;margin-top:20px;">İyi çalışmalar dileriz.</p>
        <p style="font-size:12px;color:#999;margin-top:8px;text-align:center;border-top:1px solid #eee;padding-top:14px;">${firmaAdi || "Marcus Medya"}</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Marcus Medya App <bildirim@marcusmedya.com>",
        to: [email],
        subject: `${baslik} — ${marka || ""}`,
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
