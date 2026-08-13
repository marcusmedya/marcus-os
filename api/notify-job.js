import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { trKucult } from "../lib/marka-kilidi.js";
async function yetkiKontrol(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  if (!ownerPw) return { yetkili: true, owner: true, markaYoneticisi: true };
  if (await ownerYetkiliMi(req)) return { yetkili: true, owner: true, markaYoneticisi: true };

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const { kv } = await import("@vercel/kv");
    const crypto = await import("crypto");
    const data = await kv.get("marcus-os-data");
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        // Marka kilidi hesabın sunucudaki kaydından okunur; aşağıda gönderilen markaya karşı doğrulanır.
        const markalar = Array.isArray(hesap.markalar) ? hesap.markalar : [];
        if (perms.cekimEdit === true || perms.uyelikler === true) return { yetkili: true, owner: false, markaYoneticisi: perms.markaYoneticisi === true, markalar };
        if (perms.musteriler === true || perms.finans === true || perms.odemeTakvimi === true) return { yetkili: true, owner: false, markaYoneticisi: false, odemeYetkisi: true, markalar };
      }
    }
  }
  return { yetkili: false, owner: false, markaYoneticisi: false };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  const yetki = await yetkiKontrol(req);
  if (!yetki.yetkili) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { email, ad, marka, icerikTuru, teslimTarihi, firmaAdi, mod, asama, kategori, kullaniciAdi, sifre, tutar, odemeGunu, ayAdi } = req.body || {};
    const resendKey = process.env.RESEND_API_KEY;
    /* Marka kilitli hesap, kendi markası dışında bir marka adıyla bildirim gönderemez —
     * aksi halde başka bir markanın adına dışarıya e-posta çıkarılabilirdi. */
    if (Array.isArray(yetki.markalar) && yetki.markalar.length > 0) {
      const izinliAdlar = new Set(yetki.markalar.map(trKucult));
      if (!marka || !izinliAdlar.has(trKucult(marka))) {
        return res.status(403).json({ error: "Bu markaya erişim yetkin yok." });
      }
    }
    if (!email) return res.status(200).json({ skipped: true, reason: "Bu kişinin kayıtlı bir e-posta adresi yok." });
    if (!resendKey) return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY tanımlı değil." });

    if (mod === "odemeHatirlatma") {
      if (!yetki.owner && !yetki.odemeYetkisi) {
        return res.status(403).json({ error: "Bu hatırlatmayı göndermek için Müşteriler, Finans ya da Ödeme Takvimi yetkisi gerekiyor." });
      }
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1a1a1a;">Ödeme Hatırlatması</h2>
          <p style="color:#333; line-height:1.6;">Sayın <strong>${marka || ""}</strong> yetkilisi,</p>
          <p style="color:#333; line-height:1.6;">${ayAdi ? `${ayAdi} dönemine ait` : "Güncel"} ödemenizle ilgili nazik bir hatırlatma yapmak isteriz.</p>
          <div style="margin:16px 0;padding:14px 16px;background:#f5f5f7;border-radius:10px;">
            ${tutar ? `<p style="margin:0 0 6px;font-size:15px;font-weight:600;">Tutar: ₺${tutar}</p>` : ""}
            ${odemeGunu ? `<p style="margin:0;font-size:13px;color:#555;">Ödeme günü: Ayın ${odemeGunu}'i</p>` : ""}
          </div>
          <p style="color:#333; line-height:1.6;">Ödemenizi zaten gerçekleştirdiyseniz bu e-postayı dikkate almamanızı rica ederiz. Herhangi bir sorunuz olursa bize ulaşabilirsiniz.</p>
          <p style="color:#333; line-height:1.6; margin-top:16px;">İyi çalışmalar dileriz.</p>
          <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus Medya App"}</p>
        </div>
      `;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Marcus Medya App <bildirim@marcusmedya.com>", to: [email], subject: `Ödeme Hatırlatması — ${marka || ""}`, html }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(200).json({ skipped: true, reason: `E-posta gönderilemedi: ${err.message || err.error || JSON.stringify(err)}` });
      }
      return res.status(200).json({ ok: true });
    }

    // "durum" modu (bir iş kartından elle gönderilen durum bildirimi) sadece owner ya da
    // "Marka Yöneticisi" iznine sahip personel tarafından tetiklenebilir.
    if (mod === "durum" && !yetki.owner && !yetki.markaYoneticisi) {
      return res.status(403).json({ error: "Bu bildirimi göndermek için Marka Yöneticisi yetkisi gerekiyor." });
    }

    if (mod === "uyelik") {
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1a1a1a;">Üyelik Giriş Bilgileri</h2>
          <p style="color:#333; line-height:1.6;">Merhaba ${ad || ""},</p>
          <p style="color:#333; line-height:1.6;"><strong>${marka || ""}</strong> hesabının giriş bilgileri:</p>
          <table style="border-collapse:collapse;width:100%;margin:12px 0;">
            <tr><td style="padding:8px 12px;background:#f5f5f7;font-weight:600;">Kullanıcı Adı</td><td style="padding:8px 12px;">${kullaniciAdi || "—"}</td></tr>
            <tr><td style="padding:8px 12px;background:#f5f5f7;font-weight:600;">Şifre</td><td style="padding:8px 12px;">${sifre || "—"}</td></tr>
          </table>
          <div style="margin-top:16px;padding:12px 14px;background:#fff8e1;border-radius:8px;">
            <p style="line-height:1.6;margin:0;font-size:13px;color:#6b5a00;">🔒 Bu e-posta gizli giriş bilgileri içermektedir. Bilgileri aldıktan sonra bu e-postayı silmen ve şifreyi 3. şahıslarla paylaşmaman önerilir.</p>
          </div>
          <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus Medya App"} — Üyelikler panelinden gönderildi.</p>
        </div>
      `;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Marcus Medya App <bildirim@marcusmedya.com>", to: [email], subject: `Üyelik Giriş Bilgileri — ${marka || ""}`, html }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(200).json({ skipped: true, reason: `E-posta gönderilemedi: ${err.message || err.error || JSON.stringify(err)}` });
      }
      return res.status(200).json({ ok: true });
    }

    const durumBildirimi = mod === "durum";
    const baslik = durumBildirimi ? "İş Durumu Bildirimi" : "Yeni İş Ataması";
    const html = durumBildirimi ? `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a1a;">${baslik}</h2>
        <p style="color:#333; line-height:1.6;">Merhaba ${ad || ""},</p>
        <p style="color:#333; line-height:1.6;"><strong>${marka || ""}</strong> — <strong>${icerikTuru || ""}</strong>${kategori ? ` (${kategori})` : ""} işinin şu anki durumu:</p>
        <p style="color:#333; font-size:16px; font-weight:600; background:#f5f5f7; padding:10px 14px; border-radius:8px;">${asama || ""}</p>
        ${asama === "Talep Alındı" ? `<p style="color:#b45309; line-height:1.6; background:#fff8e1; padding:10px 14px; border-radius:8px;">Lütfen işi görüp gördüğünü/başladığını onaylamak için sistemde <strong>"Talep Alındı"</strong>ya tıkla.</p>` : ""}
        ${teslimTarihi ? `<p style="color:#333;">Teslim tarihi: <strong>${teslimTarihi}</strong></p>` : ""}
        <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus Medya App"} — Operasyon panelinden gönderildi.</p>
      </div>
    ` : `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a1a;">${baslik}</h2>
        <p style="color:#333; line-height:1.6;">Merhaba ${ad || ""},</p>
        <p style="color:#333; line-height:1.6;"><strong>${marka || ""}</strong> için <strong>${icerikTuru || "bir iş"}</strong> sana atandı.</p>
        ${teslimTarihi ? `<p style="color:#333;">Teslim tarihi: <strong>${teslimTarihi}</strong></p>` : ""}
        <p style="font-size:12px;color:#999;margin-top:24px;">${firmaAdi || "Marcus Medya App"} — Operasyon panelinden gönderildi.</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Marcus Medya App <bildirim@marcusmedya.com>",
        to: [email],
        subject: durumBildirimi ? `İş Durumu: ${marka || ""} — ${asama || ""}` : `Yeni İş: ${marka || ""} — ${icerikTuru || ""}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const gercekMesaj = err.message || err.error || JSON.stringify(err);
      return res.status(200).json({ skipped: true, reason: `E-posta gönderilemedi: ${gercekMesaj}`, detail: err });
    }

    return res.status(200).json({ ok: true, to: email });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
