import { kv } from "@vercel/kv";

// Her gün (vercel.json'daki zamanlamaya göre) otomatik çalışır — CRON_SECRET ile korunur,
// ayrıca Ayarlar sayfasındaki "Şimdi Test Et" ile elle de tetiklenebilir — SITE_PASSWORD ile korunur.
// 1) Teslim tarihi geçmiş ve "Teslim Edildi" olmayan Operasyon işleri için, sorumlu kişiye
//    (kameraman/editör/tasarımcı) kayıtlı e-postası varsa hatırlatma gönderir.
// 2) Bugün için Günlük Kontrol'de hâlâ işaretlenmemiş (paylaşılmamış) marka/tür varsa,
//    bunların özetini owner'a (BACKUP_EMAIL) gönderir.

function yetkiliMi(req) {
  const cronSecret = process.env.CRON_SECRET;
  const sitePw = process.env.SITE_PASSWORD;
  if (!cronSecret && !sitePw) return true;
  if (cronSecret && req.headers["authorization"] === `Bearer ${cronSecret}`) return true;
  if (sitePw && req.headers["x-site-password"] === sitePw) return true;
  return false;
}

const PAYLASIM_TURLERI = ["Görsel", "Video", "Reels", "Story", "Carousel"];

async function epostaGonder(resendKey, to, subject, html) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Marcus OS <bildirim@marcusmedya.com>", to: [to], subject, html }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (!yetkiliMi(req)) return res.status(401).json({ error: "Yetkisiz." });
  try {
    const data = await kv.get("marcus-os-data");
    if (!data) return res.status(200).json({ skipped: true, reason: "Henüz kayıtlı veri yok." });

    const resendKey = process.env.RESEND_API_KEY;
    const backupEmail = process.env.BACKUP_EMAIL;
    if (!resendKey) return res.status(200).json({ skipped: true, reason: "RESEND_API_KEY tanımlı değil." });

    const sonuc = { operasyonHatirlatma: [], gunlukKontrolOzeti: false };
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const bugunTR = bugun.toLocaleDateString("tr-TR");
    const clients = data.clients || [];
    const personelHesaplari = data.personelHesaplari || [];
    const emailBul = (ad) => {
      if (!ad) return null;
      const kisi = personelHesaplari.find((h) => (h.ad || "").trim().toLocaleLowerCase("tr") === ad.trim().toLocaleLowerCase("tr"));
      return kisi && kisi.email ? kisi.email : null;
    };

    // ---- 1) Operasyon: gecikmiş işler ----
    const gecikmisIsler = (data.cekimIsleri || []).filter((j) => {
      if (j.asama === "Teslim Edildi" || !j.teslimTarihi) return false;
      return new Date(j.teslimTarihi) < bugun;
    });
    // Kişi başına grupla (aynı kişiye tek e-posta, iş iş listelenir).
    const kisiBazliListe = {};
    gecikmisIsler.forEach((j) => {
      [j.kameraman, j.editor].filter(Boolean).forEach((kisi) => {
        if (!kisiBazliListe[kisi]) kisiBazliListe[kisi] = [];
        kisiBazliListe[kisi].push(j);
      });
    });
    for (const [kisi, isler] of Object.entries(kisiBazliListe)) {
      const email = emailBul(kisi);
      if (!email) continue;
      const satirlar = isler.map((j) => `<li>${j.marka || ""} — ${j.icerikTuru || j.kategori || "iş"} (teslim: ${j.teslimTarihi}, aşama: ${j.asama || ""})</li>`).join("");
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1a1a1a;">Gecikmiş İş Hatırlatması</h2>
          <p style="color:#333;line-height:1.6;">Merhaba ${kisi}, aşağıdaki işlerin teslim tarihi geçti:</p>
          <ul style="color:#333;line-height:1.8;">${satirlar}</ul>
          <p style="font-size:12px;color:#999;margin-top:20px;">Marcus OS — Operasyon</p>
        </div>`;
      const ok = await epostaGonder(resendKey, email, `Gecikmiş İş Hatırlatması (${isler.length} iş)`, html);
      sonuc.operasyonHatirlatma.push({ kisi, email, isSayisi: isler.length, gonderildi: ok });
    }

    // ---- 2) Günlük Kontrol: bugün tamamlanmamış marka/türler ----
    if (backupEmail) {
      const aktifMarkalar = clients.filter((c) => c.durum === "aktif" || c.durum === "yeni");
      const gunlukKontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun.toISOString().slice(0, 10) ? data.gunlukKontrol : { yapilanlar: [] };
      const stoklar = data.stoklar || {};
      const tamamlanmamis = [];
      aktifMarkalar.forEach((c) => {
        PAYLASIM_TURLERI.forEach((tur) => {
          const adet = stoklar[`${c.id}_${tur}`] || 0;
          const key = `${c.id}_${tur}`;
          if (adet > 0 && !gunlukKontrol.yapilanlar.includes(key)) {
            tamamlanmamis.push(`${c.ad} — ${tur} (stokta ${adet} adet var, bugün paylaşılmadı)`);
          }
        });
      });
      if (tamamlanmamis.length > 0) {
        const satirlar = tamamlanmamis.map((t) => `<li>${t}</li>`).join("");
        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#1a1a1a;">Günlük Kontrol — Tamamlanmamışlar (${bugunTR})</h2>
            <p style="color:#333;line-height:1.6;">Bugün için stokta içerik olduğu halde henüz paylaşılmamış görünen markalar:</p>
            <ul style="color:#333;line-height:1.8;">${satirlar}</ul>
            <p style="font-size:12px;color:#999;margin-top:20px;">Marcus OS — Günlük Kontrol</p>
          </div>`;
        sonuc.gunlukKontrolOzeti = await epostaGonder(resendKey, backupEmail, `Günlük Kontrol — ${tamamlanmamis.length} eksik (${bugunTR})`, html);
      }
    }

    return res.status(200).json({ ok: true, ...sonuc });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
