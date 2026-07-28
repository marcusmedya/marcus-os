import { kv } from "@vercel/kv";

// Her gün sabah (vercel.json'daki zamanlamaya göre) otomatik çalışır,
// ayrıca Ayarlar sayfasındaki "Şimdi Test Et" ile elle de tetiklenebilir.

function clientPaymentStatus(client) {
  if (!client.odemeGunu) return null;
  const today = new Date();
  const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const paidThisMonth = (client.odemeler || []).includes(curKey);
  if (paidThisMonth) return { status: "odendi", label: "Bu ay ödendi" };
  const dueDay = Number(client.odemeGunu);
  const todayDay = today.getDate();
  if (todayDay < dueDay) return { status: "yaklasiyor", label: `Ödeme günü: ayın ${dueDay}'i` };
  const gecikenGun = todayDay - dueDay;
  if (gecikenGun >= 7) return { status: "gecikti", label: `${gecikenGun} gün gecikti` };
  return { status: "bekliyor", label: `Ödeme günü geçti (ayın ${dueDay}'i)` };
}

function computeLive(data) {
  const clients = data.clients || [];
  const activeClients = clients.filter((c) => c.durum !== "ayrildi");
  const recurring = activeClients.reduce((s, c) => s + (Number(c.aylikUcret) || 0), 0);
  const extra = (data.gelirKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ciro = recurring + extra;
  const giderKalemToplam = (data.giderKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ofisGiderToplam = (data.ofisGiderleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const clientCosts = clients.reduce((s, c) => s + (c.maliyetler || []).reduce((s2, m) => s2 + (Number(m.tutar) || 0), 0), 0);
  const personelGideri = (data.personel || []).reduce((s, p) => s + (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0), 0);
  const gider = giderKalemToplam + ofisGiderToplam + clientCosts + personelGideri;
  const net = ciro - gider;
  const manuelBekleyen = (data.bekleyenTahsilatlar || []).reduce((s, b) => s + (Number(b.tutar) || 0), 0);
  const otomatikBekleyen = activeClients.reduce((s, c) => {
    const st = clientPaymentStatus(c);
    if (st && (st.status === "bekliyor" || st.status === "gecikti")) return s + (Number(c.aylikUcret) || 0);
    return s;
  }, 0);
  const bekleyenToplam = manuelBekleyen + otomatikBekleyen;
  const karMarji = ciro ? Math.round((net / ciro) * 100) : 0;
  return { ciro, gider, net, bekleyenToplam, karMarji };
}

export default async function handler(req, res) {
  try {
    const data = await kv.get("marcus-os-data");
    if (!data) return res.status(200).json({ skipped: true, reason: "Henüz kayıtlı veri yok." });

    const resendKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.BACKUP_EMAIL;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!resendKey || !toEmail) {
      return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY veya BACKUP_EMAIL tanımlı değil." });
    }
    if (!anthropicKey) {
      return res.status(200).json({ skipped: true, reason: "ANTHROPIC_API_KEY tanımlı değil — AI özeti için gerekli." });
    }

    const live = computeLive(data);
    const bekleyenMusteriler = (data.clients || [])
      .filter((c) => c.durum !== "ayrildi")
      .map((c) => ({ ad: c.ad, tutar: c.aylikUcret, odemeDurumu: clientPaymentStatus(c) }))
      .filter((c) => c.odemeDurumu && (c.odemeDurumu.status === "bekliyor" || c.odemeDurumu.status === "gecikti"));

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system:
          "Sen Marcus OS adlı bir işletme yönetim panelinin AI CEO asistanısın. Sabah e-postası için kısa bir günlük özet hazırlıyorsun. " +
          "Bu ayki ciro/net/kâr marjı durumuna değin. EĞER bekleyen ya da gecikmiş ödeme varsa isim isim ve tutarlarıyla MUTLAKA belirt — en önemli kısım burası. " +
          "3-5 cümle, doğrudan CEO'ya konuşur gibi Türkçe, gereksiz giriş cümlesi kurma.",
        messages: [{ role: "user", content: "Bugünün özetini hazırla.\n\nVERİ:\n" + JSON.stringify({ ...live, bekleyenMusteriler, manuelBekleyenTahsilatlar: data.bekleyenTahsilatlar }) }],
      }),
    });
    const aiData = await aiRes.json();
    const ozet = (aiData.content || []).find((c) => c.type === "text")?.text || "Özet oluşturulamadı.";

    const today = new Date().toLocaleDateString("tr-TR");
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a1a;">Marcus OS — Günlük Özet (${today})</h2>
        <p style="white-space: pre-wrap; color:#333; line-height:1.6;">${ozet}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:12px;color:#999;">Bu e-posta her sabah otomatik gönderilir. Ayarlar sekmesinden kapatabilirsin.</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Marcus OS <onboarding@resend.dev>",
        to: [toEmail],
        subject: `Marcus OS — Günlük Özet (${today})`,
        html,
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
