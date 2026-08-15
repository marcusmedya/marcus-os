/**
 * ORTAK E-POSTA GÖNDERİCİ.
 *
 * Aynı fonksiyon daily-reminders.js içinde gömülüydü; revize bildirimi de aynı işi yapacağı
 * için buraya taşındı. İki kopya olsaydı biri düzeltilip diğeri unutulurdu (gönderen adresi,
 * hata yönetimi gibi ayrıntılar ayrışırdı).
 *
 * ANAHTAR YOKSA sessizce false döner — bildirim gönderilememesi hiçbir zaman asıl işlemi
 * (revize kaydı) engellememelidir.
 */
export async function epostaGonder(to, subject, html, cc) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !to) return false;
  try {
    const body = { from: "Marcus Medya App <bildirim@marcusmedya.com>", to: [to], subject, html };
    if (cc && cc !== to) body.cc = [cc];
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch (e) {
    return false;   // ağ hatası da işlemi durdurmamalı
  }
}

/** Müşteri revize istediğinde atanan kişiye giden bildirim. */
export function revizeBildirimHtml({ marka, icerikTuru, not, revizeSayisi, firmaAdi }) {
  const tur = revizeSayisi > 1 ? `<p style="color:#b45309;font-weight:600;">Bu içeriğin ${revizeSayisi}. revize turu.</p>` : "";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1a1a1a;">Müşteri revize istedi</h2>
      <p style="color:#333;line-height:1.6;"><strong>${marka || ""}</strong> — ${icerikTuru || "İçerik"}</p>
      ${tur}
      <div style="background:#f4f4f5;border-left:3px solid #dc2626;padding:12px 14px;color:#333;line-height:1.7;">
        ${String(not || "").replace(/</g, "&lt;")}
      </div>
      <p style="color:#555;line-height:1.6;margin-top:16px;">İş Operasyon'da <strong>Revize İstendi</strong> aşamasına geçti.</p>
      <p style="font-size:12px;color:#999;margin-top:20px;">${firmaAdi || "Marcus Medya"} — otomatik bildirim</p>
    </div>`;
}
