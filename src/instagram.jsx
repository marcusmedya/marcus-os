/**
 * INSTAGRAM ÖNİZLEME VE AYLIK RAPOR
 *
 * Paylaşım planlarının Instagram gönderisi gibi gösterimi (akış ve profil ızgarası) ile
 * müşteriye gönderilen aylık raporun HTML üretimi burada. Bu iki iş de kendi başına anlamlı
 * ve App.jsx'in geri kalanından bağımsız.
 */
import React, { useState, useEffect } from "react";
import { T, escapeHtml, inputStyle, saveBtnStyle, cancelBtnStyle, OLCUM_ALANLARI, istatistikVarMi, reklamMetrikleri } from "./tema.jsx";
import { driveGorselAdaylari, useSunucuOnizleme } from "./drive.jsx";

export function DriveKareGorsel({ link }) {
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  if (adaylar.length === 0 || sira >= adaylar.length) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#777", fontSize: 11, fontFamily: "Inter", textAlign: "center", padding: 12, lineHeight: 1.5 }}>
        Görsel açılamadı —<br />Drive paylaşımı kapalı olabilir
      </div>
    );
  }
  return (
    <img
      src={adaylar[sira]}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      referrerPolicy="no-referrer"
      onError={() => setSira((n) => n + 1)}
    />
  );
}

/**
 * PLANA BAĞLI OPERASYON KARTININ KAPAK GÖRSELİ.
 *
 * Paylaşım planındaki bir kutu bir Operasyon kartına bağlanabiliyor. Bağlıysa o kartın
 * gerçek görselini göstermek gerekiyor: "Reels" yazan boş bir kare, akışın nasıl duracağı
 * hakkında hiçbir şey söylemiyor — ızgaranın varlık sebebi de tam olarak bu.
 *
 * Görsel sunucudan kimlikle isteniyor (bağlantıyla değil): müşteri panelinde bu istek,
 * kartın gerçekten o markaya ait olduğu doğrulandıktan sonra karşılanıyor.
 *
 * Görsel gelmezse tür adına düşülüyor — eski davranış. Kutu asla boş kalmıyor.
 */
export function BagliKartKapagi({ isId, yazi }) {
  const sunucu = useSunucuOnizleme({ isId, boyut: 600 });

  if (sunucu.durum === "hazir" && sunucu.veri) {
    return <img src={sunucu.veri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#555", fontSize: 11, fontFamily: "Inter", textAlign: "center", padding: 6, lineHeight: 1.4 }}>
      {sunucu.durum === "yukleniyor" ? "…" : yazi}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* INSTAGRAM ÖNİZLEME                                                    */
/* ------------------------------------------------------------------ */
/**
 * Planlanan bir paylaşımı Instagram gönderisi gibi gösterir. Hem yöneticinin
 * (Müşteri Paneli sekmesi) hem müşterinin ekranında AYNI bileşen kullanılır — iki taraf
 * asla farklı bir şey görmez.
 */
export function InstagramOnizleme({ marka, tur, gun, gorselUrl, altMetin, yapildi, isId, subeler, kompakt = false }) {
  const [metinAcik, setMetinAcik] = useState(false);
  const uzunMetin = (altMetin || "").length > 125;
  const gosterilenMetin = !uzunMetin || metinAcik ? altMetin : (altMetin || "").slice(0, 125) + "…";

  return (
    <div style={{ background: "#000", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", maxWidth: kompakt ? 320 : 400, width: "100%" }}>
      {/* Üst şerit — profil satırı */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 15px" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "Inter" }}>
            {(marka || "M").charAt(0).toLocaleUpperCase("tr")}
          </div>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{marka || "Marka"}</div>
          <div style={{ fontSize: 11, color: "#a8a8a8", fontFamily: "Inter" }}>{tur}{gun ? ` · ${gun}` : ""}</div>
        </div>
        {yapildi && <span style={{ fontSize: 11, color: "#4ade80", fontFamily: "Inter", fontWeight: 600 }}>✓ Paylaşıldı</span>}
      </div>

      {/* ŞUBE ETİKETLERİ — aynı içerik şubelere ayrı ayrı planlandığında.
        * Dört ayrı kare yerine tek kare, altında hangi şubede ne zaman. */}
      {Array.isArray(subeler) && subeler.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "0 15px 10px" }}>
          {subeler.map((sb, i) => (
            <span key={sb.subeId || i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: sb.yapildi ? "rgba(74,222,128,.14)" : "#1c1c1c", fontSize: 11, fontFamily: "Inter" }}>
              <span style={{ color: "#e8e8e8", fontWeight: 600 }}>{sb.subeAdi}</span>
              <span style={{ color: sb.yapildi ? "#4ade80" : "#8a8a8a" }}>{sb.yapildi ? (sb.tarih || "✓") : (sb.gun || "planlı")}</span>
            </span>
          ))}
        </div>
      )}

      {/* Görsel alanı — kare, Instagram gibi */}
      <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* gorselUrl ya eski base64 görsel ya da Drive bağlantısıdır — ikisi de desteklenir. */}
        {gorselUrl && String(gorselUrl).startsWith("data:") ? (
          <img src={gorselUrl} alt={altMetin || "Paylaşım görseli"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : gorselUrl ? (
          <DriveKareGorsel link={gorselUrl} />
        ) : isId ? (
          <BagliKartKapagi isId={isId} yazi="Görsel henüz eklenmedi" />
        ) : (
          <div style={{ color: "#555", fontSize: 13, fontFamily: "Inter", textAlign: "center", padding: 20, lineHeight: 1.6 }}>
            Görsel henüz eklenmedi
          </div>
        )}
      </div>

      {/* Alt ikon şeridi — sadece görsel amaçlı */}
      <div style={{ display: "flex", gap: 13, padding: "9px 12px 4px", color: "#fff", fontSize: 15 }}>
        <span>♡</span><span>💬</span><span>➤</span>
      </div>

      {/* Alt metin */}
      <div style={{ padding: "2px 12px 12px" }}>
        {altMetin ? (
          <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            <strong style={{ fontWeight: 600 }}>{marka} </strong>
            {gosterilenMetin}
            {uzunMetin && (
              <button onClick={() => setMetinAcik((v) => !v)} style={{ background: "none", border: "none", color: "#a8a8a8", cursor: "pointer", fontSize: 13, fontFamily: "Inter", padding: "0 0 0 4px" }}>
                {metinAcik ? "daha az" : "devamı"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#555", fontFamily: "Inter", fontStyle: "italic" }}>Açıklama metni henüz yazılmadı</div>
        )}
      </div>
    </div>
  );
}

/**
 * Instagram PROFİL IZGARASI — gönderiler 3'lü kare ızgarada, tıklayınca büyüyor.
 * Feed görünümü tek tek incelemek için iyi, ızgara ise "hesabın genel görünümü nasıl
 * duruyor?" sorusuna cevap verir; marka estetiğini değerlendirmek için asıl bakılan yer burasıdır.
 */
export function InstagramIzgara({ marka, gonderiler, onSec }) {
  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      {/* Profil başlığı */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "4px 4px 18px" }}>
        <div style={{ width: 66, height: 66, borderRadius: "50%", background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.text, fontSize: 20, fontWeight: 700, fontFamily: "Inter" }}>
            {(marka || "M").charAt(0).toLocaleUpperCase("tr")}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{marka}</div>
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", marginTop: 3 }}>
            <strong style={{ color: T.text }}>{gonderiler.length}</strong> planlanan gönderi
          </div>
        </div>
      </div>

      {/* 3'lü kare ızgara */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
        {gonderiler.map((p) => (
          <button
            key={p.id}
            onClick={() => onSec && onSec(p)}
            style={{ position: "relative", aspectRatio: "1 / 1", background: "#111", border: "none", padding: 0, cursor: onSec ? "pointer" : "default", overflow: "hidden" }}
          >
            {p.gorselUrl && String(p.gorselUrl).startsWith("data:") ? (
              <img src={p.gorselUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : p.gorselUrl ? (
              <DriveKareGorsel link={p.gorselUrl} />
            ) : p.isId ? (
              <BagliKartKapagi isId={p.isId} yazi={p.tur} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 11, fontFamily: "Inter", textAlign: "center", padding: 6, lineHeight: 1.4 }}>
                {p.tur}
              </div>
            )}
            {/* Sol üstte gün etiketi, sağ altta paylaşıldı işareti */}
            <span style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,.62)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 5, fontFamily: "Inter" }}>{p.gun}</span>
            {/* Paylaşıldı işareti: çıplak bir ✓ görselin üstünde kayboluyordu. Zeminli
              * rozet hem koyu hem açık görselde okunuyor. */}
            {p.yapildi && (
              <span style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(22,163,74,.92)", color: "#fff",
                             fontSize: 10, fontWeight: 700, fontFamily: "Inter", padding: "3px 6px", borderRadius: 5 }}>
                ✓ Paylaşıldı
              </span>
            )}
          </button>
        ))}
      </div>
      {gonderiler.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Bu dönemde planlanmış gönderi yok.</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AYLIK MÜŞTERİ RAPORU                                                  */
/* ------------------------------------------------------------------ */
/**
 * Müşteriye gönderilecek aylık rapor. Yeni bir pencerede açılır; oradan yazdırılabilir
 * ya da "PDF olarak kaydet" ile PDF'e çevrilip WhatsApp/e-posta ile gönderilebilir.
 *
 * Rapor sistemdeki mevcut verilerden ÜRETİLİR — ayrıca veri girmen gerekmez:
 *   Neler yaptık      → o ay "Teslim Edildi"ye geçen Operasyon işleri
 *   Neler paylaştık   → o ay yapıldı işaretlenen gönderiler (görsel + alt metin)
 *   Neler paylaşacağız→ sonraki dönemin planı (tarih + alt metin)
 *   Reklamlar         → o ayla kesişen kampanyalar ve istatistikleri
 */
/** Rapor HTML'i için görsel adresi. base64 kayıtlar olduğu gibi gömülür; Drive
 * bağlantıları ise doğrudan gösterilebilir thumbnail adresine çevrilir (ham paylaşım
 * linki bir <img> içinde açılmaz — yönlendirme sayfası döner). */
export function raporGorselAdresi(deger) {
  if (!deger) return "";
  if (String(deger).startsWith("data:")) return deger;
  const adaylar = driveGorselAdaylari(deger);
  return adaylar.length ? adaylar[0] : "";
}

export function aylikRaporHtml({ marka, firmaAdi, ay, isler, paylasilanlar, planlananlar, reklamlar, logo, olcum }) {
  const ayAdiYazi = (() => {
    const [y, a] = ay.split("-").map(Number);
    return new Date(y, a - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  })();
  const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const sayi = (n) => (Number(n) || 0).toLocaleString("tr-TR");

  const kutu = (etiket, deger) => `<div class="kpi"><div class="kpi-l">${escapeHtml(etiket)}</div><div class="kpi-v">${escapeHtml(String(deger))}</div></div>`;

  const isSatirlari = isler.length
    ? isler.map((j) => `<tr><td>${escapeHtml(j.icerikTuru || "")}</td><td>${escapeHtml(j.kategori || "—")}</td><td>${escapeHtml(j.uretilenAdet ? String(j.uretilenAdet) : "—")}</td><td>${escapeHtml(j.teslimEdilmeTarihi || "")}</td></tr>`).join("")
    : `<tr><td colspan="4" class="bos">Bu ay teslim edilen iş kaydı yok.</td></tr>`;

  const gonderiKarti = (p, tarihEtiketi) => `
    <div class="post">
      ${p.gorselUrl ? `<img src="${raporGorselAdresi(p.gorselUrl)}" alt="" />` : `<div class="post-bos">Görsel yok</div>`}
      <div class="post-govde">
        <div class="post-ust">${escapeHtml(p.tur || "")} · ${escapeHtml(tarihEtiketi)}</div>
        ${p.altMetin ? `<div class="post-metin">${escapeHtml(p.altMetin).replace(/\n/g, "<br/>")}</div>` : `<div class="post-metin bos">Açıklama metni girilmedi</div>`}
      </div>
    </div>`;

  const paylasilanHtml = paylasilanlar.length
    ? `<div class="posts">${paylasilanlar.map((p) => gonderiKarti(p, p.yapildigiTarih || p.gun)).join("")}</div>`
    : `<p class="bos">Bu ay paylaşıldı olarak işaretlenen gönderi yok.</p>`;

  const planlananHtml = planlananlar.length
    ? `<div class="posts">${planlananlar.map((p) => gonderiKarti(p, `${p.gun} · ${p.haftaKey} haftası`)).join("")}</div>`
    : `<p class="bos">Önümüzdeki dönem için henüz plan girilmedi.</p>`;

  const reklamHtml = reklamlar.length
    ? reklamlar.map((r) => {
        const m = reklamMetrikleri(r);
        const varMi = istatistikVarMi(r);
        return `
        <div class="ad">
          <div class="ad-ust">
            <strong>${escapeHtml(r.reklamAdi || "Kampanya")}</strong>
            <span>${escapeHtml(r.baslangicTarihi || "")} — ${escapeHtml(r.bitisTarihi || "")}</span>
          </div>
          ${r.not ? `<div class="ad-not">${escapeHtml(r.not)}</div>` : ""}
          ${varMi ? `<div class="kpis">
            ${m.erisim ? kutu("Erişim", sayi(m.erisim)) : ""}
            ${m.gosterim ? kutu("Gösterim", sayi(m.gosterim)) : ""}
            ${m.tiklama ? kutu("Tıklama", sayi(m.tiklama)) : ""}
            ${m.etkilesim ? kutu("Etkileşim", sayi(m.etkilesim)) : ""}
            ${m.sonuc ? kutu("Sonuç", sayi(m.sonuc)) : ""}
            ${m.ctr != null ? kutu("Tıklama Oranı", m.ctr.toFixed(2) + "%") : ""}
          </div>` : `<div class="bos">Bu kampanya için istatistik girilmedi.</div>`}
        </div>`;
      }).join("")
    : `<p class="bos">Bu ayla kesişen reklam kampanyası yok.</p>`;

  /* HESAP GELİŞİMİ — takipçi ve görünürlük. Sadece o ay için ölçüm girilmişse basılır;
   * boş bir tablo müşteriye "ölçmüyorlar" izlenimi verirdi. */
  const olcumHtml = (() => {
    if (!olcum || !olcum.buAy) return "";
    const satir = ({ key, label }) => {
      const f = olcum.fark[key];
      if (!f || !f.simdi) return "";
      const yon = f.degisim == null ? "" : f.degisim > 0 ? "▲" : f.degisim < 0 ? "▼" : "";
      const renk = f.degisim > 0 ? "#15803d" : f.degisim < 0 ? "#b91c1c" : "#6b7280";
      const degisimYazi = f.degisim == null || f.degisim === 0
        ? "—"
        : `<span style="color:${renk}">${yon} ${Math.abs(f.degisim).toLocaleString("tr-TR")}${f.yuzde != null ? ` (%${Math.abs(f.yuzde).toFixed(1)})` : ""}</span>`;
      return `<tr><td>${escapeHtml(label)}</td><td>${f.simdi.toLocaleString("tr-TR")}</td><td>${degisimYazi}</td></tr>`;
    };
    const satirlar = OLCUM_ALANLARI.map(satir).filter(Boolean).join("");
    if (!satirlar) return "";
    return `<h2>Hesap Gelişimi</h2>
      <table>
        <thead><tr><th>Ölçüm</th><th>Bu ay</th><th>Önceki döneme göre</th></tr></thead>
        <tbody>${satirlar}</tbody>
      </table>`;
  })();

  const toplamErisim = reklamlar.reduce((t, r) => t + (Number(r.erisim) || 0), 0);
  const toplamSonuc = reklamlar.reduce((t, r) => t + (Number(r.sonuc) || 0), 0);

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8" /><title>${escapeHtml(marka)} — ${escapeHtml(ayAdiYazi)} Raporu</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; max-width: 820px; margin: 0 auto; padding: 40px 28px 60px; color: #16181d; line-height: 1.6; }
  .ust { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #16181d; padding-bottom: 18px; margin-bottom: 26px; }
  .ust img { max-height: 46px; }
  h1 { font-size: 25px; margin: 0 0 4px; letter-spacing: -0.4px; }
  .alt { color: #6b7280; font-size: 13px; }
  h2 { font-size: 16px; margin: 34px 0 12px; padding-bottom: 7px; border-bottom: 1px solid #e5e7eb; letter-spacing: -0.2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 9px 8px; border-bottom: 1px solid #f3f4f6; }
  .bos { color: #9ca3af; font-style: italic; font-size: 13px; }
  .ozet { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .kpi { background: #f7f8fa; border-radius: 9px; padding: 11px 15px; min-width: 108px; }
  .kpi-l { font-size: 10px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .kpi-v { font-size: 19px; font-weight: 700; margin-top: 3px; }
  .kpis { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .posts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .post { border: 1px solid #e5e7eb; border-radius: 11px; overflow: hidden; break-inside: avoid; }
  .post img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
  .post-bos { width: 100%; aspect-ratio: 1/1; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
  .post-govde { padding: 10px 12px; }
  .post-ust { font-size: 11px; color: #6b7280; font-weight: 600; margin-bottom: 5px; }
  .post-metin { font-size: 12px; white-space: pre-wrap; }
  .ad { border: 1px solid #e5e7eb; border-radius: 11px; padding: 14px 16px; margin-bottom: 12px; break-inside: avoid; }
  .ad-ust { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; flex-wrap: wrap; }
  .ad-ust span { color: #6b7280; font-size: 12px; }
  .ad-not { font-size: 12.5px; color: #4b5563; margin-top: 5px; }
  .kapanis { margin-top: 40px; padding-top: 18px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } }
</style></head>
<body>
  <div class="ust">
    <div>
      <h1>${escapeHtml(marka)}</h1>
      <div class="alt">${escapeHtml(ayAdiYazi)} · Aylık Çalışma Raporu</div>
    </div>
    <div style="text-align:right">
      ${logo ? `<img src="${logo}" alt="" />` : `<strong>${escapeHtml(firmaAdi)}</strong>`}
      <div class="alt" style="margin-top:4px">${escapeHtml(bugun)}</div>
    </div>
  </div>

  <div class="ozet">
    ${kutu("Teslim Edilen İş", isler.length)}
    ${kutu("Paylaşılan Gönderi", paylasilanlar.length)}
    ${kutu("Planlanan Gönderi", planlananlar.length)}
    ${reklamlar.length ? kutu("Kampanya", reklamlar.length) : ""}
    ${toplamErisim ? kutu("Toplam Erişim", sayi(toplamErisim)) : ""}
    ${toplamSonuc ? kutu("Toplam Sonuç", sayi(toplamSonuc)) : ""}
  </div>

  <h2>Bu Ay Neler Yaptık</h2>
  <table>
    <thead><tr><th>İçerik</th><th>Kategori</th><th>Adet</th><th>Teslim</th></tr></thead>
    <tbody>${isSatirlari}</tbody>
  </table>

  <h2>Bu Ay Neler Paylaştık</h2>
  ${paylasilanHtml}

  <h2>Önümüzdeki Dönem Ne Paylaşacağız</h2>
  ${planlananHtml}

  ${olcumHtml}

  <h2>Reklam Kampanyaları</h2>
  ${reklamHtml}

  <div class="kapanis">${escapeHtml(firmaAdi)} · ${escapeHtml(ayAdiYazi)} raporu</div>
</body></html>`;
}

export function aylikRaporAc(veri) {
  const html = aylikRaporHtml(veri);
  const win = window.open("", "_blank");
  if (!win) { window.alert("Yeni pencere açılamadı — tarayıcının pop-up engelleyicisini kontrol et."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

