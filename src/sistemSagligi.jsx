import React, { useState } from "react";
import { Card, SectionTitle, T, authHeaders, saveBtnStyle } from "./tema.jsx";
import { BOYUT_ESIKLERI } from "../lib/sistem-sagligi.js";

/**
 * SİSTEM SAĞLIĞI PANELİ — Ayarlar > Güvenlik'in altında.
 *
 * Yalnızca ÖLÇÜM gösterir; hiçbir düğmesi veriye dokunmaz. Ölçüm pahalı olduğu için
 * (belgenin tamamı JSON'a çevriliyor, Drive'a ağ çağrısı gidiyor) kendiliğinden
 * çalışmaz — kullanıcı isteyince çalışır.
 *
 * Hesap mantığı `lib/sistem-sagligi.js` ve sunucuda; burası yalnızca çizim.
 */

const bayt = (n) => {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const DURUM_RENK = { tamam: T.success, hata: T.danger, eksik: T.danger, dogrulanamadi: T.warning };
const DURUM_ISARET = { tamam: "✓", hata: "✗", eksik: "✗", dogrulanamadi: "?" };

export default function SistemSagligi() {
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [driveDahil, setDriveDahil] = useState(false);

  const olc = (driveIle) => {
    setYukleniyor(true); setHata("");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ sistemAction: "saglik", driveDahil: Boolean(driveIle) }),
    })
      .then((r) => r.json())
      .then((r) => { if (r.ok) { setVeri(r); setDriveDahil(Boolean(driveIle)); } else setHata(r.error || "Ölçüm alınamadı."); })
      .catch(() => setHata("Bağlantı hatası — ölçüm alınamadı."))
      .finally(() => setYukleniyor(false));
  };

  const boyutRenk = veri && veri.boyutDurumu === "yuksek" ? T.danger
    : veri && veri.boyutDurumu === "dikkat" ? T.warning : T.success;

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Sistem Sağlığı</SectionTitle>

      <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter", lineHeight: 1.6, marginBottom: 12 }}>
        Tüm veri tek bir JSON belgesinde duruyor ve bazı alanlar hiç küçülmüyor. Bu ölçüm
        hiçbir şeyi değiştirmez — yalnızca neyin büyüdüğünü gösterir.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: veri ? 16 : 0 }}>
        <button style={{ ...saveBtnStyle, padding: "8px 14px", fontSize: 13 }} disabled={yukleniyor} onClick={() => olc(false)}>
          {yukleniyor ? "Ölçülüyor…" : "Ölçümü Yenile"}
        </button>
        <button
          style={{ ...saveBtnStyle, padding: "8px 14px", fontSize: 13, background: "transparent", color: T.accentText, border: `1px solid ${T.border}` }}
          disabled={yukleniyor}
          onClick={() => olc(true)}
          title="Drive'a yalnızca OKUMA yapılır; hiçbir dosya veya klasör oluşturulmaz"
        >Drive Kontrolüyle</button>
      </div>

      {hata && <div style={{ fontSize: 13, color: T.danger, fontFamily: "Inter", marginTop: 10 }}>{hata}</div>}

      {veri && (
        <>
          {/* ÖZET SAYILAR */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              ["Operasyon kartı", veri.ozet.operasyonKarti],
              ["Müşteri", veri.ozet.musteri],
              ["Şube", veri.ozet.sube],
              ["Paylaşım planı", veri.ozet.haftalikPaylasim],
              ["İşlem geçmişi", veri.ozet.islemGecmisi],
              ["Silinen kayıt", veri.ozet.silinen],
            ].map(([etiket, deger]) => (
              <span key={etiket} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: T.surfaceRaised, fontSize: 12.5, fontFamily: "Inter" }}>
                <span style={{ color: T.textDim }}>{etiket}</span>
                <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{deger}</strong>
              </span>
            ))}
          </div>

          {/* BOYUT VE FONKSİYON */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: T.surfaceRaised, fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>Veri boyutu</span>
              <strong style={{ color: boyutRenk, fontFamily: "'IBM Plex Mono', monospace" }}>{bayt(veri.olcum.toplamBayt)}</strong>
              {veri.boyutDurumu !== "normal" && (
                <span style={{ color: boyutRenk, fontSize: 11.5 }}>
                  · {veri.boyutDurumu === "yuksek" ? `${bayt(BOYUT_ESIKLERI.yuksek)} eşiği aşıldı` : "büyümeye başladı"}
                </span>
              )}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: T.surfaceRaised, fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>Serverless fonksiyon</span>
              <strong style={{ color: veri.fonksiyon.kullanilan >= veri.fonksiyon.sinir ? T.danger : T.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                {veri.fonksiyon.kullanilan}/{veri.fonksiyon.sinir}
              </strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: T.surfaceRaised, fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>Son yedek</span>
              <strong style={{ color: veri.ozet.sonYedek ? T.text : T.warning, fontFamily: "Inter" }}>{veri.ozet.sonYedek || "kayıt yok"}</strong>
            </span>
          </div>

          {/* EN ÇOK YER KAPLAYAN ALANLAR */}
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3, marginBottom: 7 }}>
            EN ÇOK YER KAPLAYAN ALANLAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {veri.olcum.enBuyukler.map((a) => (
              <div key={a.alan} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 10px", background: T.surface, borderRadius: 8, fontSize: 12.5, fontFamily: "Inter" }}>
                <span style={{ color: T.text }}>
                  {a.alan}
                  {a.buyuyen && <span style={{ color: T.textFaint, marginLeft: 6, fontSize: 11 }}>· sürekli büyüyor</span>}
                </span>
                <span style={{ display: "flex", gap: 12, whiteSpace: "nowrap" }}>
                  <span style={{ color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{a.kayit === null ? "—" : `${a.kayit} kayıt`}</span>
                  <strong style={{ color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{bayt(a.bayt)}</strong>
                </span>
              </div>
            ))}
          </div>

          {/* ORTAM DEĞİŞKENLERİ — yalnızca var/yok, değer ASLA gelmiyor */}
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3, marginBottom: 7 }}>
            ORTAM DEĞİŞKENLERİ <span style={{ fontWeight: 400, letterSpacing: 0 }}>· yalnızca var/yok bilgisi, değerler tarayıcıya gelmez</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: veri.drive ? 14 : 0 }}>
            {veri.degiskenler.liste.map((d) => (
              <span key={d.ad} title={d.ne}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace",
                  background: d.var ? T.successSoft : (d.kritik ? T.dangerSoft : T.surfaceRaised),
                  color: d.var ? T.success : (d.kritik ? T.danger : T.textFaint) }}>
                {d.var ? "✓" : (d.kritik ? "✗" : "—")} {d.ad}
              </span>
            ))}
          </div>

          {/* DRIVE SAĞLIĞI */}
          {veri.drive && (
            <>
              <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3, marginBottom: 7 }}>
                DRIVE <span style={{ fontWeight: 400, letterSpacing: 0 }}>· salt okunur kontrol; hiçbir dosya veya klasör oluşturulmadı</span>
              </div>
              {veri.drive.hata ? (
                <div style={{ fontSize: 12.5, color: T.danger, fontFamily: "Inter" }}>{veri.drive.hata}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {veri.drive.adimlar.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.surface, borderRadius: 8, fontSize: 12.5, fontFamily: "Inter" }}>
                      <span style={{ color: DURUM_RENK[a.durum] || T.textDim, fontWeight: 700, width: 12 }}>{DURUM_ISARET[a.durum] || "·"}</span>
                      <span style={{ color: T.text }}>{a.ad}</span>
                      {a.not && <span style={{ color: T.textFaint, fontSize: 11.5 }}>— {a.not}</span>}
                    </div>
                  ))}
                  {veri.drive.dogrulanamayan > 0 && (
                    <div style={{ fontSize: 11.5, color: T.warning, fontFamily: "Inter", marginTop: 4 }}>
                      {veri.drive.dogrulanamayan} yetenek doğrulanamadı — üretim Drive'ında deneme yapılmıyor.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
