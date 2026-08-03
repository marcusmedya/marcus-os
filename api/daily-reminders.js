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

async function epostaGonder(resendKey, to, subject, html, cc) {
  const body = { from: "Marcus OS <bildirim@marcusmedya.com>", to: [to], subject, html };
  if (cc && cc !== to) body.cc = [cc];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

    const sonuc = { operasyonHatirlatma: [], markalasmaHatirlatma: [], gunlukKontrolOzeti: false };
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const bugunTR = bugun.toLocaleDateString("tr-TR");
    const clients = data.clients || [];
    const personelHesaplari = data.personelHesaplari || [];
    const emailBul = (ad) => {
      if (!ad) return null;
      const kisi = personelHesaplari.find((h) => (h.ad || "").trim().toLocaleLowerCase("tr") === ad.trim().toLocaleLowerCase("tr"));
      return kisi && kisi.email ? kisi.email : null;
    };

    // ---- 1) Operasyon: gecikmiş işler VE "Talep Alındı" aşamasında bekleyen (henüz başlanmadığı
    // anlaşılan) işler. "Talep Alındı" özellikle her zaman bu hatırlatmaya dahil edilir — CEO'nun
    // kişinin işi görüp göremediğini/başlayıp başlamadığını anlayabilmesi için.
    const gecikmisIsler = (data.cekimIsleri || []).filter((j) => {
      if (j.asama === "Teslim Edildi" || !j.teslimTarihi) return false;
      return new Date(j.teslimTarihi) < bugun;
    });
    const talepAlindiIsleri = (data.cekimIsleri || []).filter((j) => j.asama === "Talep Alındı");
    // Kişi başına grupla (aynı kişiye tek e-posta, iş iş listelenir) — iki liste de dahil, tekrar etmesin.
    const kisiBazliListe = {};
    const kisiyeEkle = (j, tip) => {
      [j.kameraman, j.editor].filter(Boolean).forEach((kisi) => {
        if (!kisiBazliListe[kisi]) kisiBazliListe[kisi] = { gecikmis: [], talepAlindi: [] };
        kisiBazliListe[kisi][tip].push(j);
      });
    };
    gecikmisIsler.forEach((j) => kisiyeEkle(j, "gecikmis"));
    talepAlindiIsleri.forEach((j) => kisiyeEkle(j, "talepAlindi"));
    for (const [kisi, gruplar] of Object.entries(kisiBazliListe)) {
      const email = emailBul(kisi);
      if (!email) continue;
      const { gecikmis, talepAlindi } = gruplar;
      const satirYap = (j) => `<li>${j.marka || ""} — ${j.icerikTuru || "iş"} (teslim: ${j.teslimTarihi || "—"}, aşama: ${j.asama || ""})</li>`;
      const kategoriBolumu = (liste) => {
        const video = liste.filter((j) => j.kategori !== "Grafik Tasarım");
        const grafik = liste.filter((j) => j.kategori === "Grafik Tasarım");
        return [
          video.length ? `<h4 style="color:#1a1a1a;font-size:13.5px;margin:10px 0 4px;">🎬 Video</h4><ul style="color:#333;line-height:1.8;margin:0;">${video.map(satirYap).join("")}</ul>` : "",
          grafik.length ? `<h4 style="color:#1a1a1a;font-size:13.5px;margin:10px 0 4px;">🎨 Grafik Tasarım</h4><ul style="color:#333;line-height:1.8;margin:0;">${grafik.map(satirYap).join("")}</ul>` : "",
        ].join("");
      };
      const bolumler = [
        gecikmis.length ? `<h3 style="color:#c0392b;font-size:15px;margin:16px 0 6px;">⏰ Teslim Tarihi Geçmiş</h3>${kategoriBolumu(gecikmis)}` : "",
        talepAlindi.length ? `<h3 style="color:#b45309;font-size:15px;margin:16px 0 6px;">📥 Talep Alındı — Henüz Başlanmadı</h3><p style="color:#666;font-size:12.5px;margin:0 0 6px;">Lütfen işi gördüğünde/başladığında sistemde <strong>"Talep Alındı"</strong>ya tıklayarak onaylamayı unutma.</p>${kategoriBolumu(talepAlindi)}` : "",
      ].join("");
      const toplamSayi = gecikmis.length + talepAlindi.length;
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1a1a1a;">İş Hatırlatması</h2>
          <p style="color:#333;line-height:1.6;">Merhaba ${kisi},</p>
          ${bolumler}
          <p style="font-size:12px;color:#999;margin-top:20px;">Marcus OS — Operasyon</p>
        </div>`;
      const ok = await epostaGonder(resendKey, email, `İş Hatırlatması (${toplamSayi} iş)`, html, backupEmail);
      sonuc.operasyonHatirlatma.push({ kisi, email, gecikmis: gecikmis.length, talepAlindi: talepAlindi.length, gonderildi: ok });
    }

    // ---- 1b) Markalaşma: yöneticisine atanmış, henüz tamamlanmamış süreçler ----
    const markalasmaYoneticiListe = {};
    (data.markalasmaSurecleri || []).forEach((s) => {
      if (s.tamTamamlandi || !s.yonetici) return;
      const eksikGorevler = (s.gorevler || []).filter((g) => !g.tamamlandi);
      if (eksikGorevler.length === 0) return;
      if (!markalasmaYoneticiListe[s.yonetici]) markalasmaYoneticiListe[s.yonetici] = [];
      markalasmaYoneticiListe[s.yonetici].push({ marka: s.marka, eksikGorevler });
    });
    for (const [yonetici, surecler] of Object.entries(markalasmaYoneticiListe)) {
      const email = emailBul(yonetici);
      if (!email) continue;
      const bolumler = surecler.map((s) => `
        <h3 style="color:#1a1a1a;font-size:15px;margin:16px 0 6px;">${s.marka}</h3>
        <ul style="color:#333;line-height:1.8;margin:0;">${s.eksikGorevler.map((g) => `<li>${g.ad}</li>`).join("")}</ul>
      `).join("");
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1a1a1a;">Markalaşma Süreci Hatırlatması</h2>
          <p style="color:#333;line-height:1.6;">Merhaba ${yonetici}, senin yönettiğin markalaşma sürecinde henüz tamamlanmamış görevler var:</p>
          ${bolumler}
          <p style="font-size:12px;color:#999;margin-top:20px;">Marcus OS — Operasyon &gt; Markalaşma</p>
        </div>`;
      const ok = await epostaGonder(resendKey, email, `Markalaşma Süreci Hatırlatması (${surecler.length} marka)`, html, backupEmail);
      sonuc.markalasmaHatirlatma.push({ yonetici, email, markaSayisi: surecler.length, gonderildi: ok });
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
