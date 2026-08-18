import { kv } from "@vercel/kv";
import { ownerYetkiliMi } from "../lib/oturum.js";
import { gonderenAdres } from "../lib/eposta.js";
const bugunISO = () => {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
};

// Bu fonksiyon iki şekilde çalışır:
// 1) Vercel Cron tarafından her gün otomatik (vercel.json'daki zamanlamaya göre) — CRON_SECRET ile korunur
// 2) Ayarlar sayfasındaki "Şimdi Test Et" butonuyla elle — SITE_PASSWORD ile korunur

async function yetkiliMi(req) {
  const cronSecret = process.env.CRON_SECRET;
  const sitePw = process.env.SITE_PASSWORD;
  if (!cronSecret && !sitePw) return true; // hiçbiri ayarlanmadıysa (geriye dönük uyumluluk) izin ver
  if (cronSecret && req.headers["authorization"] === `Bearer ${cronSecret}`) return true;
  if (sitePw && (await ownerYetkiliMi(req))) return true;
  return false;
}

export default async function handler(req, res) {
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });
  try {
    const data = await kv.get("marcus-os-data");
    if (!data) {
      return res.status(200).json({ skipped: true, reason: "Henüz kayıtlı veri yok." });
    }

    const resendKey = process.env.RESEND_API_KEY;
    /* YEDEK ADRESLERİ — birden fazla olabilir.
     *
     * NEDEN ÖNEMLİ: günlük, saatlik ve geri-yükleme-öncesi kopyaların HEPSİ aynı veritabanının
     * (Upstash) içinde duruyor. O hesap silinir, askıya alınır ya da bir fatura sorunu çıkarsa
     * hepsi birden gider. Bu e-posta, verinin veritabanı DIŞINDAKİ tek kopyası — dolayısıyla
     * tek bir adrese bağlı kalmamalı.
     *
     * BACKUP_EMAIL virgülle ayrılmış birden fazla adres kabul eder:
     *   BACKUP_EMAIL = "ben@ornek.com, yedek@gmail.com, ortak@ornek.com"
     * Farklı sağlayıcılarda (biri Gmail, biri kurumsal) adres kullanmak, tek bir posta
     * hesabının kapanması hâlinde de bir kopyanın kalmasını sağlar. */
    const alicilar = String(process.env.BACKUP_EMAIL || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    const toEmail = alicilar[0];
    if (!resendKey || !toEmail) {
      return res.status(200).json({
        skipped: true,
        reason: "RESEND_API_KEY veya BACKUP_EMAIL ortam değişkeni tanımlı değil.",
      });
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const base64 = Buffer.from(jsonStr, "utf-8").toString("base64");
    const today = bugunISO();

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: gonderenAdres(),
        to: alicilar,
        subject: `Marcus Medya App Günlük Yedek — ${today}`,
        text: `Merhaba,\n\nEkte ${today} tarihli Marcus Medya App tam veri yedeğin bulunuyor. Bu e-postayı ve ekindeki dosyayı sakla — bir sorun olursa Ayarlar sayfasından bu dosyayı geri yükleyebilirsin.\n\nÖNEMLİ: Bu dosya, verinin veritabanı DIŞINDAKİ tek kopyasıdır. Ayda bir tanesini bilgisayarına ya da buluta indirip saklaman, veritabanı hesabında bir sorun çıkması ihtimaline karşı en güçlü korumadır.\n\nMarcus Medya App`,
        attachments: [{ filename: `marcus-os-yedek-${today}.json`, content: base64 }],
      }),
    });

    /* HAFTALIK ARŞİV — her pazar ayrı konuyla ikinci bir kopya gönderilir.
     * Günlük yedekler posta kutusunda kaybolup gidiyor; haftalık olan "sakla" etiketiyle
     * geldiği için arşivlenmesi kolay. */
    const pazarMi = new Date().getDay() === 0;
    if (pazarMi) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: gonderenAdres(),
            to: alicilar,
            subject: `📦 HAFTALIK ARŞİV — Marcus Medya App (${today}) — SAKLA`,
            text: `Bu haftalık arşiv kopyasıdır. Bu e-postayı SİLME — ayrı bir klasöre taşıyıp sakla.\n\nGünlük yedekler posta kutusunda birikip kayboluyor; bu kopya bilinçli olarak arşivlenmek için gönderiliyor. Veritabanı hesabında bir sorun çıkarsa geri dönebileceğin nokta budur.\n\nMarcus Medya App`,
            attachments: [{ filename: `marcus-os-HAFTALIK-ARSIV-${today}.json`, content: base64 }],
          }),
        });
      } catch (e) { /* arşiv gönderilemezse günlük yedek yine de geçerli */ }
    }

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: "E-posta gönderilemedi.", detail: err });
    }

    return res.status(200).json({ ok: true, to: toEmail });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
