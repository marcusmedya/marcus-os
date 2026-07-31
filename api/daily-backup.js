import { kv } from "@vercel/kv";

// Bu fonksiyon iki şekilde çalışır:
// 1) Vercel Cron tarafından her gün otomatik (vercel.json'daki zamanlamaya göre) — CRON_SECRET ile korunur
// 2) Ayarlar sayfasındaki "Şimdi Test Et" butonuyla elle — SITE_PASSWORD ile korunur

function yetkiliMi(req) {
  const cronSecret = process.env.CRON_SECRET;
  const sitePw = process.env.SITE_PASSWORD;
  if (!cronSecret && !sitePw) return true; // hiçbiri ayarlanmadıysa (geriye dönük uyumluluk) izin ver
  if (cronSecret && req.headers["authorization"] === `Bearer ${cronSecret}`) return true;
  if (sitePw && req.headers["x-site-password"] === sitePw) return true;
  return false;
}

export default async function handler(req, res) {
  if (!yetkiliMi(req)) return res.status(401).json({ error: "Yetkisiz." });
  try {
    const data = await kv.get("marcus-os-data");
    if (!data) {
      return res.status(200).json({ skipped: true, reason: "Henüz kayıtlı veri yok." });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.BACKUP_EMAIL;
    if (!resendKey || !toEmail) {
      return res.status(200).json({
        skipped: true,
        reason: "RESEND_API_KEY veya BACKUP_EMAIL ortam değişkeni tanımlı değil.",
      });
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const base64 = Buffer.from(jsonStr, "utf-8").toString("base64");
    const today = new Date().toISOString().slice(0, 10);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Marcus OS <onboarding@resend.dev>",
        to: [toEmail],
        subject: `Marcus OS Günlük Yedek — ${today}`,
        text: `Merhaba,\n\nEkte ${today} tarihli Marcus OS tam veri yedeğin bulunuyor. Bu e-postayı ve ekindeki dosyayı sakla — bir sorun olursa Ayarlar sayfasından bu dosyayı geri yükleyebilirsin.\n\nMarcus OS`,
        attachments: [{ filename: `marcus-os-yedek-${today}.json`, content: base64 }],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: "E-posta gönderilemedi.", detail: err });
    }

    return res.status(200).json({ ok: true, to: toEmail });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
