// Bu dosya tarayıcıda değil, Vercel'in sunucusunda çalışır.
// ANTHROPIC_API_KEY hiçbir zaman tarayıcıya gönderilmez.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Sadece POST istekleri kabul edilir." });
  }

  const required = process.env.SITE_PASSWORD;
  if (required && req.headers["x-site-password"] !== required) {
    return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  }

  const { question, context } = req.body || {};
  if (!question) {
    return res.status(400).json({ error: "Soru bulunamadı." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Sunucuda ANTHROPIC_API_KEY tanımlı değil. Vercel > Settings > Environment Variables kısmından ekle." });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system:
          "Sen Marcus Medya App adlı bir işletme yönetim panelinin AI CEO asistanısın. Marcus Medya adlı bir medya ajansının verilerine erişimin var (JSON olarak aşağıda). " +
          "Görevin veri göstermek değil, net kararlar önermektir. Kısa, doğrudan, CEO'ya konuşur gibi Türkçe cevap ver. " +
          "Gereksiz giriş cümleleri kurma, doğrudan analize ve öneriye geç. En fazla 4-5 cümle veya kısa maddeler kullan.\n\nVERİ:\n" +
          JSON.stringify(context || {}),
        messages: [{ role: "user", content: question }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({ error: data.error?.message || "Anthropic API hatası" });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
