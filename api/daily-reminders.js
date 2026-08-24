import { kv } from "@vercel/kv";
import { ownerYetkiliMi } from "../lib/oturum.js";
import { gonderenAdres } from "../lib/eposta.js";
import { markaninDriveDosyalari } from "../lib/drive-tasima.js";
import { driveDurumRaporu, driveyeGoreStok } from "../lib/drive-eslestirme.js";
import { stokFarklari, uygulanabilirMi, farklariUygula } from "../lib/drive-denetimi.js";
import { paylasimTuru, PAYLASIM_TURLERI as STOK_TURLERI, eskiTurAnahtarlari } from "../lib/stok.js";
import { markaEslestirici } from "../lib/marka-kilidi.js";
import { guvenliGuncelle } from "../lib/kv-yaz.js";

// Her gün (vercel.json'daki zamanlamaya göre) otomatik çalışır — CRON_SECRET ile korunur,
// ayrıca Ayarlar sayfasındaki "Şimdi Test Et" ile elle de tetiklenebilir — SITE_PASSWORD ile korunur.
// 1) Teslim tarihi geçmiş ve "Teslim Edildi" olmayan Operasyon işleri için, sorumlu kişiye
//    (kameraman/editör/tasarımcı) kayıtlı e-postası varsa hatırlatma gönderir.
// 2) Bugün için Günlük Kontrol'de hâlâ işaretlenmemiş (paylaşılmamış) marka/tür varsa,
//    bunların özetini owner'a (BACKUP_EMAIL) gönderir.

async function yetkiliMi(req) {
  const cronSecret = process.env.CRON_SECRET;
  const sitePw = process.env.SITE_PASSWORD;
  /* KAPALI DÜŞÜYOR — ESKİDEN AÇIK DÜŞÜYORDU (denetim bulgusu).
   *
   * Burada "yapılandırma eksikse izin ver" vardı. Ölçüldü: SITE_PASSWORD tanımsızken bu uç
   * kimliksiz isteklere yanıt veriyordu. Üretimde değişken tanımlı olduğu için gizli
   * kalmıştı; ama değişken silinirse, yeni bir ortam (önizleme dağıtımı) açılırsa ya da
   * yanlış girilirse sistem halka açılıyordu.
   *
   * Yapılandırma eksikse artık kimse giremiyor. Kilitlenme riski yok: çözüm tek bir ortam
   * değişkeni tanımlamak ve eksiklik ekranda ayrıca bildiriliyor. */
  if (!cronSecret && !sitePw) return false;
  if (cronSecret && req.headers["authorization"] === `Bearer ${cronSecret}`) return true;
  if (sitePw && (await ownerYetkiliMi(req))) return true;
  return false;
}

const PAYLASIM_TURLERI = ["Görsel", "Video", "Reels", "Story", "Carousel"];

/** Sunucu UTC saat diliminde çalışır — bu, gece yarısı ile saat 03:00 arası (Türkiye UTC+3)
 * Günlük Kontrol tarihinin yanlış eşleşmesine yol açıyordu. Diğer dosyalarla (App.jsx,
 * paylasim.js) aynı Türkiye-takvim-günü mantığını kullanır. */
const bugunISO = () => {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
};

async function epostaGonder(resendKey, to, subject, html, cc) {
  const body = { from: gonderenAdres(), to: [to], subject, html };
  if (cc && cc !== to) body.cc = [cc];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok;
}

/* Drive taraması Google çağrılarıyla ilerliyor — varsayılan 10 saniye on markaya yetmez. */
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });
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
          <p style="font-size:12px;color:#999;margin-top:20px;">Marcus Medya App — Operasyon</p>
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
          <p style="font-size:12px;color:#999;margin-top:20px;">Marcus Medya App — Operasyon &gt; Markalaşma</p>
        </div>`;
      const ok = await epostaGonder(resendKey, email, `Markalaşma Süreci Hatırlatması (${surecler.length} marka)`, html, backupEmail);
      sonuc.markalasmaHatirlatma.push({ yonetici, email, markaSayisi: surecler.length, gonderildi: ok });
    }

    // ---- 2) Günlük Kontrol: bugün tamamlanmamış marka/türler ----
    if (backupEmail) {
      /* HAFTALIK PLANDAN okunur — Günlük Kontrol ekranıyla AYNI kaynak.
       * Eskiden stok sayılarına bakıyordu: "stokta 3 reels var ama bugün paylaşılmadı".
       * Ekran plana geçince ikisi çelişmeye başlıyordu — e-posta "5 eksik" derken ekran
       * "bugün eksik yok" diyebilirdi. Artık ikisi de plandaki yapildi=false kayıtlara bakar.
       *
       * Bugünün kayıtlarına ek olarak GECİKMİŞLER de yazılır: tarihi geçmiş ama hâlâ
       * paylaşılmamış bir kayıt, hatırlatılmazsa tamamen unutuluyor. */
      const markaAdiBul = (id) => (clients.find((c) => String(c.id) === String(id)) || {}).ad || "—";
      const planKayitTarihi = (kayit) => {
        const m = String(kayit.haftaKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        d.setDate(d.getDate() + (Number(kayit.gun) || 0));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const buGun = bugunISO();
      const tamamlanmamis = [];
      (data.haftalikPaylasimlar || []).forEach((kayit) => {
        if (kayit.yapildi) return;
        const t = planKayitTarihi(kayit);
        if (!t || t > buGun) return;                    // gelecek günler hatırlatılmaz
        const gecikme = t < buGun ? ` — GECİKTİ (${t})` : "";
        tamamlanmamis.push(`${markaAdiBul(kayit.clientId)} — ${kayit.tur || "Paylaşım"}${gecikme}`);
      });
      if (tamamlanmamis.length > 0) {
        const satirlar = tamamlanmamis.map((t) => `<li>${t}</li>`).join("");
        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#1a1a1a;">Günlük Kontrol — Tamamlanmamışlar (${bugunTR})</h2>
            <p style="color:#333;line-height:1.6;">Haftalık plana göre bugün (ve daha önce) paylaşılması gerekip henüz işaretlenmemiş olanlar:</p>
            <ul style="color:#333;line-height:1.8;">${satirlar}</ul>
            <p style="font-size:12px;color:#999;margin-top:20px;">Marcus Medya App — Günlük Kontrol</p>
          </div>`;
        sonuc.gunlukKontrolOzeti = await epostaGonder(resendKey, backupEmail, `Günlük Kontrol — ${tamamlanmamis.length} eksik (${bugunTR})`, html);
      }
    }

    /* ---------------------------------------------------------------- *
     * AYLIK RAPOR HATIRLATMASI — her ayın 1'inde
     *
     * Rapor müşteriye OTOMATİK GÖNDERİLMEZ. Bilerek böyle: gözden geçirilmemiş bir rapor
     * müşteriye gitseydi, eksik ya da yanlış bir rakam fark edilmeden dışarı çıkabilirdi.
     * Bunun yerine hangi markanın raporunun hazır olduğu ve içinde ne olduğu sana e-postayla
     * bildirilir; sen açıp göz atıp gönderirsin.
     * ---------------------------------------------------------------- */
    const bugunGun = new Date().getDate();
    if (bugunGun === 1 && backupEmail && resendKey) {
      const oncekiAy = (() => {
        const d = new Date();
        d.setDate(0); // bir önceki ayın son günü
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();
      const ayAdi = (() => {
        const [y, a] = oncekiAy.split("-").map(Number);
        return new Date(y, a - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
      })();

      const aktifMarkalar = (data.clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu");
      const satirlar = aktifMarkalar.map((c) => {
        const isler = (data.cekimIsleri || []).filter((j) =>
          String(j.marka || "").trim().toLocaleLowerCase("tr") === String(c.ad || "").trim().toLocaleLowerCase("tr")
          && j.teslimEdilmeTarihi && String(j.teslimEdilmeTarihi).slice(0, 7) === oncekiAy);
        const paylasimlar = (data.haftalikPaylasimlar || []).filter((p) =>
          String(p.clientId) === String(c.id) && p.yapildi
          && String(p.yapildigiTarih || p.haftaKey || "").slice(0, 7) === oncekiAy);
        const kampanyalar = (data.reklamlar || []).filter((r) =>
          String(r.marka || "").trim().toLocaleLowerCase("tr") === String(c.ad || "").trim().toLocaleLowerCase("tr")
          && (r.baslangicTarihi || "") <= `${oncekiAy}-31` && (r.bitisTarihi || "9999-12-31") >= `${oncekiAy}-01`);
        const toplam = isler.length + paylasimlar.length + kampanyalar.length;
        if (toplam === 0) return "";
        return `<tr><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${c.ad}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${isler.length}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${paylasimlar.length}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${kampanyalar.length}</td></tr>`;
      }).filter(Boolean).join("");

      if (satirlar) {
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color:#16181d;margin:0 0 6px;font-size:19px;">${ayAdi} raporları hazır</h2>
            <p style="color:#4b5563;font-size:13.5px;line-height:1.7;margin:0 0 16px;">
              Aşağıdaki markalar için ${ayAdi} raporu oluşturulabilir durumda. Uygulamada
              <strong>Müşteri Paneli → markayı seç → Aylık Müşteri Raporu</strong> bölümünden açıp
              PDF olarak kaydedip gönderebilirsin.
            </p>
            <table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
              <tr style="background:#f7f8fa;">
                <th style="padding:8px 10px;text-align:left;">Marka</th>
                <th style="padding:8px 10px;">Teslim</th>
                <th style="padding:8px 10px;">Paylaşım</th>
                <th style="padding:8px 10px;">Kampanya</th>
              </tr>
              ${satirlar}
            </table>
            <p style="font-size:12px;color:#9ca3af;margin-top:18px;line-height:1.6;">
              Rapor otomatik gönderilmez — göz atman için hazırlanır.<br/>Marcus Medya App
            </p>
          </div>`;
        sonuc.aylikRaporHatirlatmasi = await epostaGonder(resendKey, backupEmail, `${ayAdi} müşteri raporları hazır`, html);
      }
    }

    /* VERİ BOYUTU UYARISI
     * Tüm veri tek bir blok hâlinde yazılıyor ve Vercel tek istekte ~4.5 MB kabul ediyor.
     * Bu sınır aşılırsa KAYITLAR TAMAMEN DURUR — üstelik sessizce, hata mesajı olmadan.
     * Ayarlar'da bir gösterge var ama oraya bakmak gerekiyor; bu uyarı ayağına gelir. */
    if (backupEmail && resendKey) {
      const boyut = Buffer.byteLength(JSON.stringify(data || {}), "utf-8");
      const SINIR = 4.5 * 1024 * 1024;
      const oran = boyut / SINIR;
      if (oran > 0.6) {
        const mb = (boyut / (1024 * 1024)).toFixed(2);
        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:${oran > 0.85 ? "#b91c1c" : "#b45309"};">Veri boyutu uyarısı — %${Math.round(oran * 100)}</h2>
            <p style="color:#333;line-height:1.7;">
              Marcus Medya App verisi <strong>${mb} MB</strong> boyutuna ulaştı. Sunucu tek istekte
              en fazla ~4.5 MB kabul ediyor; bu sınır aşılırsa <strong>kayıtlar tamamen durur.</strong>
            </p>
            <p style="color:#333;line-height:1.7;">
              Yer açmak için: müşteri detaylarındaki eski içerik görsellerini sil, artık kullanılmayan
              markaların eski kayıtlarını temizle. Ayarlar → <strong>Veri Boyutu</strong> kartından
              güncel durumu görebilirsin.
            </p>
            <p style="font-size:12px;color:#999;margin-top:20px;">Marcus Medya App</p>
          </div>`;
        sonuc.veriBoyutuUyarisi = await epostaGonder(resendKey, backupEmail,
          `${oran > 0.85 ? "ACİL" : "Uyarı"}: Veri boyutu %${Math.round(oran * 100)} (${mb} MB)`, html);
      }
    }

    /* ================================================================
     * GECE DRIVE DENETİMİ — stok Drive'a göre kendini düzeltir.
     *
     * Kullanıcının kararı: stokta son söz Drive'ın. Elle mutabakat düğmesine basılmasını
     * beklemek, sapmanın günlerce ayakta kalması demekti. Gece her aktif markanın
     * ONAYLANANLAR klasörü taranıp genel stok oraya eşitleniyor.
     *
     * ÜÇ FREN VAR, üçü de veri kaybına karşı:
     *   1. Tarama eksikse (bütçe doldu, klasör okunamadı) HİÇ YAZILMAZ — eksik liste
     *      "içerik azalmış" gibi görünür ve gerçek içeriği stoktan siler.
     *   2. Toplu kayıp freni: bir markada 20+ düşüş olacaksa dokunulmaz, rapora yazılır.
     *   3. Yalnızca GENEL stok. Şube satırları Drive'dan türetilemez — bir dosyanın hangi
     *      şubede paylaşıldığı Drive'da yazmıyor.
     *
     * Çağrı bütçesi TOPLAM tutuluyor: on markalı bir hesapta sınırsız gezmek fonksiyon
     * süresini aşardı. Yetişilemeyen markalar rapora "taranmadı" diye yazılır — sessizce
     * atlanan bir marka "temiz" sanılır.
     * ================================================================ */
    const denetim = { tarih: new Date().toISOString(), markalar: [], taranmayan: [] };
    let kalanCagri = 240;
    for (const c of clients.filter((x) => x && x.durum !== "pasif")) {
      if (kalanCagri <= 10) { denetim.taranmayan.push(c.ad); continue; }
      const butce = Math.min(40, kalanCagri);
      kalanCagri -= butce;
      const liste = await markaninDriveDosyalari({
        markaKlasoru: c.driveOnayKlasoru || "", markaAdi: c.ad,
        durumlar: ["onaylanan"], cagriButcesi: butce,
      });
      if (!liste.ok) { denetim.markalar.push({ clientId: c.id, ad: c.ad, okunamadi: liste.sebep }); continue; }

      const esit = markaEslestirici(clients, c.ad);
      const kartlar = (data.cekimIsleri || []).filter((j) => j && esit(j.marka));
      const driveStok = driveyeGoreStok(liste.dosyalar, kartlar, paylasimTuru);
      const rapor = driveDurumRaporu(liste.dosyalar, kartlar, paylasimTuru);
      const farklar = stokFarklari(data.stoklar, driveStok, c.id, STOK_TURLERI);
      const karar = uygulanabilirMi(liste, farklar);

      const satir = {
        clientId: c.id, ad: c.ad, farklar, kartsizSayisi: rapor.kartsizSayisi,
        yanlisYerdeSayisi: rapor.yanlisYerdekiler.length,
        dosyasizKartSayisi: rapor.dosyasizKartlar.length,
        uygulandi: false, sebep: karar.uygula ? undefined : karar.sebep,
      };

      if (karar.uygula) {
        const yazma = await guvenliGuncelle((guncel) => {
          const taze = stokFarklari(guncel.stoklar, driveStok, c.id, STOK_TURLERI);
          return {
            degisenAlanlar: ["stoklar", "paylasimGecmisi"],
            veri: {
              ...guncel,
              stoklar: farklariUygula(guncel.stoklar, taze, c.id, eskiTurAnahtarlari(guncel.stoklar, c.id)),
              paylasimGecmisi: [...(guncel.paylasimGecmisi || []), ...taze.map((f, i) => ({
                id: `gecedrive_${Date.now().toString(36)}_${c.id}_${i}`,
                tarih: new Date().toISOString(),
                clientId: c.id, marka: c.ad, tur: f.tur,
                islem: "Gece Drive denetimi", eski: f.kayitli, yeni: f.driveGore,
              }))],
            },
          };
        });
        satir.uygulandi = Boolean(yazma && yazma.ok);
        if (!satir.uygulandi) satir.sebep = "Yazma kilidi alınamadı";
      }
      denetim.markalar.push(satir);
    }

    /* Rapor belgeye yazılıyor — ekranda "gece ne buldu" diye bakılabilsin. */
    await guvenliGuncelle((guncel) => ({
      degisenAlanlar: ["driveDenetimi"],
      veri: { ...guncel, driveDenetimi: denetim },
    }));
    sonuc.driveDenetimi = {
      marka: denetim.markalar.length,
      duzeltilen: denetim.markalar.filter((x) => x.uygulandi).length,
      taranmayan: denetim.taranmayan.length,
    };

    return res.status(200).json({ ok: true, ...sonuc });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
