import { kv } from "@vercel/kv";

/**
 * LOGO SUNUCUSU — /api/logo
 *
 * Ayarlar > Marka Kimliği'ne yüklenen logo veride base64 olarak duruyor. Ama tarayıcı sekmesi,
 * telefon ana ekranı ve WhatsApp/Slack link önizlemesi gerçek bir GÖRSEL ADRESİ ister; base64
 * veriyi oradan okuyamazlar. Bu uç nokta o boşluğu kapatır: kayıtlı logoyu normal bir resim
 * gibi sunar.
 *
 * Sonuç: logoyu Ayarlar'dan değiştirdiğinde her yer birden güncellenir — yeniden yayına almak
 * ya da dosya değiştirmek gerekmez.
 *
 * HERKESE AÇIK olması gerekir (şifre istenmez): link önizlemesini oluşturan WhatsApp/Slack
 * sunucuları giriş yapamaz. Bu güvenlik açığı değil — burada YALNIZCA logo döner, veri
 * bloğunun başka hiçbir alanına dokunulmaz.
 *
 * Logo yüklenmemişse varsayılan simgeye yönlendirir, yani önizleme hiçbir zaman boş kalmaz.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Yalnızca GET." });
  }

  try {
    const data = await kv.get("marcus-os-data");
    const gorsel = data && data.markaKimligiGorseli;

    // "data:image/png;base64,AAA..." biçimini parçala.
    const m = typeof gorsel === "string" && gorsel.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) {
      // Henüz logo yüklenmemiş — varsayılan simge.
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.redirect(302, "/icon.svg");
    }

    const buf = Buffer.from(m[2], "base64");
    res.setHeader("Content-Type", m[1]);
    res.setHeader("Content-Length", String(buf.length));
    /* Kısa önbellek: logo değiştirildiğinde beş dakika içinde her yerde yenilenir.
     * Uzun tutulsaydı link önizlemeleri günlerce eski logoyu gösterirdi. */
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.status(200).send(buf);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, "/icon.svg");
  }
}
