import React, { useState, useMemo } from "react";
import {
  FileText, Check, Plus, Minus, Printer, MessageCircle, Mail, Save, X,
  Sparkles, Sun, Moon, Package, ChevronDown, Trash2, Building2,
} from "lucide-react";
import { HIZMET_KATALOGU, PAKETLER, KATEGORI_SIRASI, SOZLESME_SURELERI, hizmetBul } from "./teklifKatalog.js";

/* ------------------------------------------------------------------ */
/* Bu modül, geri kalan uygulamadan bağımsız kendi (açık/koyu) tasarım  */
/* dilini kullanır — "Apple seviyesinde minimal, beyaz ağırlıklı" istek  */
/* özellikle bu ekran için ayrı bir görsel kimlik gerektiriyordu.       */
/* ------------------------------------------------------------------ */
const LIGHT = {
  bg: "#F5F5F7", panel: "#FFFFFF", panelAlt: "#FBFBFD", border: "#E5E5EA", borderSoft: "#EFEFF1",
  text: "#1D1D1F", textDim: "#6E6E73", textFaint: "#AEAEB4",
  accent: "#0071E3", accentSoft: "#E8F1FD", accentText: "#0071E3",
  success: "#1FA24B", successSoft: "#E7F8ED", danger: "#E0342A", dangerSoft: "#FCEBEA",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.04)",
};
const DARK = {
  bg: "#111114", panel: "#1B1B1F", panelAlt: "#17171A", border: "#2A2A30", borderSoft: "#232327",
  text: "#F5F5F7", textDim: "#9A9AA2", textFaint: "#5F5F66",
  accent: "#3B9EFF", accentSoft: "rgba(59,158,255,0.14)", accentText: "#8FC7FF",
  success: "#33D874", successSoft: "rgba(51,216,116,0.12)", danger: "#FF5A52", dangerSoft: "rgba(255,90,82,0.12)",
  shadow: "0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35)",
};

const fmt = (n) => "₺" + (Number(n) || 0).toLocaleString("tr-TR");
const nid = () => Math.random().toString(36).slice(2, 9);

const KATEGORI_IKON = {
  "İçerik": "🎬", "Sosyal Medya": "📱", "Reklam": "📣", "SEO / GEO": "🔍",
  "Tasarım": "🎨", "Video": "🎞️", "Ek Hizmetler": "✨",
};

/* ------------------------------------------------------------------ */
/* Sözleşme metni oluşturucu — seçilen her hizmetten kendi maddesini,   */
/* sabit hukuki iskeletin arasına otomatik olarak yerleştirir.         */
/* ------------------------------------------------------------------ */
function sozlesmeMetniOlustur(musteri, secilenListe, toplam, firmaAdi) {
  const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const maddeler = secilenListe
    .map((h) => h.madde.replace("{adet}", h.adet))
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n\n");

  return `HİZMET SÖZLEŞMESİ

Bu sözleşme ${bugun} tarihinde aşağıdaki taraflar arasında akdedilmiştir:

HİZMET SAĞLAYICI: ${firmaAdi}
HİZMET ALAN: ${musteri.firma || "[Firma Adı]"}${musteri.yetkili ? ` (Yetkili: ${musteri.yetkili})` : ""}
${musteri.vergiDairesi ? `Vergi Dairesi: ${musteri.vergiDairesi}` : ""}${musteri.vergiNo ? ` / Vergi No: ${musteri.vergiNo}` : ""}
${musteri.adres ? `Adres: ${musteri.adres}` : ""}

MADDE 1 — KONU
İşbu sözleşmenin konusu, HİZMET SAĞLAYICI'nın HİZMET ALAN'a aşağıda madde madde belirtilen dijital pazarlama ve medya hizmetlerini sunmasıdır.

MADDE 2 — SÜRE
Sözleşme, ${musteri.baslangic || "[başlangıç tarihi]"} tarihinde başlar ve ${musteri.sure || 1} ay süreyle geçerlidir. Taraflardan biri sözleşme bitiminden en az 15 gün önce yazılı fesih bildiriminde bulunmadığı takdirde sözleşme aynı süre için kendiliğinden yenilenir.

MADDE 3 — HİZMET KAPSAMI
${maddeler || "Seçilen hizmet bulunmamaktadır."}

MADDE 4 — ÜCRET VE ÖDEME
Yukarıda belirtilen hizmetler karşılığında aylık toplam bedel ${fmt(toplam)} + KDV olarak belirlenmiştir. Ödemeler her ayın başında, karşılıklı mutabık kalınan yöntemle tahsil edilir.

MADDE 5 — GİZLİLİK
Taraflar, işbu sözleşme kapsamında öğrendikleri ticari ve kişisel bilgileri gizli tutmayı, üçüncü kişilerle paylaşmamayı kabul eder.

MADDE 6 — FESİH
Taraflardan biri, diğerine yazılı olarak bildirmek kaydıyla, cari ay sonunda sözleşmeyi feshedebilir. Fesih tarihine kadar sunulan hizmetlerin bedeli HİZMET ALAN tarafından ödenir.

MADDE 7 — YÜRÜRLÜK
İşbu sözleşme, taraflarca okunup onaylandıktan sonra ${bugun} tarihinde yürürlüğe girer.


HİZMET SAĞLAYICI                                                    HİZMET ALAN
${firmaAdi}                                                    ${musteri.firma || ""}
`;
}

function teklifOzetMetni(musteri, secilenListe, toplam, firmaAdi) {
  const satirlar = secilenListe.map((h) => `✓ ${h.adet > 1 ? h.adet + " " : ""}${h.ad}`).join("\n");
  return `${firmaAdi}\n${musteri.firma || ""}\n\n${satirlar}\n\nToplam: ${fmt(toplam)} + KDV`;
}

/* ------------------------------------------------------------------ */
/* Yazdırma / PDF                                                       */
/* ------------------------------------------------------------------ */
function yazdirMetin(baslik, govdeMetni) {
  const bodyHtml = String(govdeMetni)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>${baslik}</title>
  <style>
    body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 720px; margin: 50px auto; color:#1d1d1f; line-height:1.7; font-size:14.5px; }
    p { margin: 0 0 14px; }
    h1 { font-size: 20px; text-align:center; letter-spacing: 0.3px; }
    @media print { body { margin: 24px; } }
  </style></head>
  <body>${bodyHtml}</body></html>`;
  const win = window.open("", "_blank");
  if (!win) { window.alert("Yeni pencere açılamadı — pop-up engelleyiciyi kontrol et."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/* ------------------------------------------------------------------ */
/* Küçük UI parçaları                                                    */
/* ------------------------------------------------------------------ */
function Panel({ C, children, style }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, boxShadow: C.shadow, ...style }}>{children}</div>;
}

function Stepper({ C, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "2px 4px" }}>
      <button onClick={() => onChange(Math.max(1, Number(value) - 1))} style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: "transparent", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={13} /></button>
      <input
        type="number" value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        style={{ width: 38, textAlign: "center", border: "none", background: "transparent", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
      />
      <button onClick={() => onChange(Number(value) + 1)} style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: "transparent", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={13} /></button>
    </div>
  );
}

function HizmetSatiri({ C, h, secim, onToggle, onUpdate }) {
  const secili = !!secim;
  return (
    <div style={{ borderBottom: `1px solid ${C.borderSoft}`, padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onToggle}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
            border: `1.5px solid ${secili ? C.accent : C.border}`, background: secili ? C.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {secili && <Check size={13} color="#fff" strokeWidth={3} />}
        </button>
        <span onClick={onToggle} style={{ flex: 1, fontSize: 13.5, color: secili ? C.text : C.textDim, fontFamily: "inherit", cursor: "pointer", fontWeight: secili ? 600 : 400 }}>{h.ad}</span>
        {secili && (
          <>
            <Stepper C={C} value={secim.adet} onChange={(v) => onUpdate({ adet: v })} />
            <input
              type="number" value={secim.birimFiyat}
              onChange={(e) => onUpdate({ birimFiyat: Number(e.target.value) })}
              style={{ width: 76, textAlign: "right", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12.5, color: C.text, fontFamily: "inherit", outline: "none" }}
            />
            <span style={{ width: 84, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: C.text, fontFamily: "inherit" }}>{fmt(secim.adet * secim.birimFiyat)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function AlanEtiket({ C, children }) {
  return <label style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, letterSpacing: 0.2, display: "block", marginBottom: 5 }}>{children}</label>;
}
function AlanInput({ C, ...props }) {
  return <input {...props} style={{ width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13.5, fontFamily: "inherit", outline: "none", marginBottom: 14 }} />;
}

/* ------------------------------------------------------------------ */
/* ANA BİLEŞEN                                                           */
/* ------------------------------------------------------------------ */
export default function TeklifSozlesme({ firmaAdi = "Marcus Medya", onSaveTeklif }) {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;

  const [musteri, setMusteri] = useState({ firma: "", yetkili: "", telefon: "", mail: "", adres: "", vergiDairesi: "", vergiNo: "", sure: 1, baslangic: new Date().toISOString().slice(0, 10) });
  const [secimler, setSecimler] = useState({});
  const [aktifPaket, setAktifPaket] = useState(null);
  const [paketMenuOpen, setPaketMenuOpen] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);

  const musteriSet = (k, v) => setMusteri((m) => ({ ...m, [k]: v }));

  const toggleHizmet = (h) => {
    setSecimler((prev) => {
      const next = { ...prev };
      if (next[h.id]) delete next[h.id];
      else next[h.id] = { adet: h.varsayilanAdet, birimFiyat: h.varsayilanFiyat };
      return next;
    });
    setAktifPaket(null);
  };
  const updateSecim = (id, patch) => { setSecimler((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })); setAktifPaket(null); };

  const applyPaket = (paketAdi) => {
    const harita = PAKETLER[paketAdi];
    const yeni = {};
    Object.entries(harita).forEach(([id, adet]) => {
      const h = hizmetBul(id);
      if (h) yeni[id] = { adet, birimFiyat: h.varsayilanFiyat };
    });
    setSecimler(yeni);
    setAktifPaket(paketAdi);
    setPaketMenuOpen(false);
  };

  const temizle = () => { setSecimler({}); setAktifPaket(null); };

  const secilenListe = useMemo(
    () => Object.entries(secimler).map(([id, v]) => ({ ...hizmetBul(id), ...v })).filter((x) => x.id),
    [secimler]
  );
  const toplam = secilenListe.reduce((s, x) => s + (Number(x.adet) || 0) * (Number(x.birimFiyat) || 0), 0);
  const kdv = Math.round(toplam * 0.2);

  const teklifMetni = () => teklifOzetMetni(musteri, secilenListe, toplam, firmaAdi);
  const sozlesmeMetni = () => sozlesmeMetniOlustur(musteri, secilenListe, toplam, firmaAdi);

  const whatsappPaylas = () => {
    const text = teklifMetni();
    const telefon = (musteri.telefon || "").replace(/\D/g, "");
    const numara = telefon ? (telefon.startsWith("90") ? telefon : telefon.startsWith("0") ? "90" + telefon.slice(1) : "90" + telefon) : "";
    const url = numara ? `https://wa.me/${numara}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const mailGonder = () => {
    const subject = `${musteri.firma || "Teklif"} - Teklif`;
    const body = teklifMetni();
    window.location.href = `mailto:${musteri.mail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const kaydet = () => {
    if (onSaveTeklif) {
      onSaveTeklif({
        id: nid(), tarih: new Date().toISOString(), musteri, secilenListe, toplam,
        paket: aktifPaket,
      });
    }
    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 2000);
  };

  return (
    <div style={{ background: C.bg, borderRadius: 22, padding: 22, fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <style>{`
        .teklif-grid { display: grid; grid-template-columns: 300px 1fr 340px; gap: 18px; align-items: start; }
        @media (max-width: 1100px) { .teklif-grid { grid-template-columns: 1fr; } }
        .teklif-input:focus { border-color: ${C.accent} !important; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>Teklif & Sözleşme</div>
            <div style={{ fontSize: 12, color: C.textFaint }}>Hizmet seç, teklif ve sözleşme otomatik oluşsun</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setPaketMenuOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <Package size={14} /> {aktifPaket || "Hazır Paketler"} <ChevronDown size={13} />
            </button>
            {paketMenuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 220, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, zIndex: 20, overflow: "hidden" }}>
                {Object.keys(PAKETLER).map((p) => (
                  <button key={p} onClick={() => applyPaket(p)} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${C.borderSoft}`, color: C.text, fontSize: 13, cursor: "pointer" }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setIsDark((v) => !v)} style={{ width: 38, height: 38, borderRadius: 10, background: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {isDark ? <Sun size={16} color={C.text} /> : <Moon size={16} color={C.text} />}
          </button>
        </div>
      </div>

      <div className="teklif-grid">
        {/* SOL PANEL — Müşteri Bilgileri */}
        <Panel C={C} style={{ padding: "20px 20px", position: "sticky", top: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Building2 size={16} color={C.accent} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Müşteri Bilgileri</div>
          </div>
          <AlanEtiket C={C}>Firma Adı</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.firma} onChange={(e) => musteriSet("firma", e.target.value)} placeholder="örn. Şişçi İbo" />
          <AlanEtiket C={C}>Yetkili</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.yetkili} onChange={(e) => musteriSet("yetkili", e.target.value)} />
          <AlanEtiket C={C}>Telefon</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.telefon} onChange={(e) => musteriSet("telefon", e.target.value)} placeholder="05xx xxx xx xx" />
          <AlanEtiket C={C}>Mail</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.mail} onChange={(e) => musteriSet("mail", e.target.value)} />
          <AlanEtiket C={C}>Adres</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.adres} onChange={(e) => musteriSet("adres", e.target.value)} />
          <AlanEtiket C={C}>Vergi Dairesi</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.vergiDairesi} onChange={(e) => musteriSet("vergiDairesi", e.target.value)} />
          <AlanEtiket C={C}>Vergi No</AlanEtiket>
          <AlanInput C={C} className="teklif-input" value={musteri.vergiNo} onChange={(e) => musteriSet("vergiNo", e.target.value)} />

          <AlanEtiket C={C}>Sözleşme Süresi</AlanEtiket>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {SOZLESME_SURELERI.map((s) => (
              <button
                key={s}
                onClick={() => musteriSet("sure", s)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${musteri.sure === s ? C.accent : C.border}`, background: musteri.sure === s ? C.accentSoft : "transparent", color: musteri.sure === s ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                {s} Ay
              </button>
            ))}
          </div>
          <AlanEtiket C={C}>Başlangıç Tarihi</AlanEtiket>
          <input type="date" className="teklif-input" value={musteri.baslangic} onChange={(e) => musteriSet("baslangic", e.target.value)} style={{ width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
        </Panel>

        {/* ORTA PANEL — Hizmet Seçimi */}
        <div>
          {KATEGORI_SIRASI.map((kategori) => {
            const kategoriSecili = HIZMET_KATALOGU[kategori].filter((h) => secimler[h.id]).length;
            return (
              <Panel C={C} key={kategori} style={{ padding: "16px 18px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: C.text }}>
                    <span>{KATEGORI_IKON[kategori]}</span> {kategori}
                  </div>
                  {kategoriSecili > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.accentText, background: C.accentSoft, padding: "3px 9px", borderRadius: 999 }}>{kategoriSecili} seçili</span>}
                </div>
                <div>
                  {HIZMET_KATALOGU[kategori].map((h) => (
                    <HizmetSatiri key={h.id} C={C} h={h} secim={secimler[h.id]} onToggle={() => toggleHizmet(h)} onUpdate={(patch) => updateSecim(h.id, patch)} />
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>

        {/* SAĞ PANEL — Canlı Önizleme */}
        <Panel C={C} style={{ padding: "22px 22px", position: "sticky", top: 16 }}>
          <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>{firmaAdi.toUpperCase()}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>{musteri.firma || "Müşteri Adı"}</div>
          {aktifPaket && <div style={{ fontSize: 12, color: C.accentText, fontWeight: 600, marginBottom: 10 }}>{aktifPaket}</div>}
          {!aktifPaket && <div style={{ marginBottom: 10 }} />}

          <div style={{ borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, padding: "14px 0", marginBottom: 16, maxHeight: 320, overflowY: "auto" }}>
            {secilenListe.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.textFaint, textAlign: "center", padding: "20px 0" }}>Henüz hizmet seçilmedi</div>
            ) : (
              secilenListe.map((h) => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                  <Check size={13} color={C.success} strokeWidth={3} style={{ flexShrink: 0 }} />
                  <span style={{ color: C.text, flex: 1 }}>{h.adet > 1 ? `${h.adet} ` : ""}{h.ad}</span>
                  <span style={{ color: C.textFaint, fontFamily: "monospace" }}>{fmt(h.adet * h.birimFiyat)}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.textDim, marginBottom: 4 }}>
            <span>Ara Toplam</span><span>{fmt(toplam)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.textDim, marginBottom: 10 }}>
            <span>KDV (%20)</span><span>{fmt(kdv)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Toplam</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>{fmt(toplam)} <span style={{ fontSize: 13, fontWeight: 500, color: C.textFaint }}>+KDV</span></span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => yazdirMetin(`Teklif - ${musteri.firma}`, teklifMetni())} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px", borderRadius: 11, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Printer size={14} /> Teklifi Yazdır / PDF
            </button>
            <button onClick={() => yazdirMetin(`Sözleşme - ${musteri.firma}`, sozlesmeMetni())} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <FileText size={14} /> Sözleşmeyi Yazdır / PDF
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={whatsappPaylas} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button onClick={mailGonder} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                <Mail size={14} /> Mail
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={temizle} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 11, border: "none", background: "transparent", color: C.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={13} /> Temizle
              </button>
              <button onClick={kaydet} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 11, border: "none", background: "transparent", color: C.success, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Save size={13} /> {kaydedildi ? "Kaydedildi ✓" : "Kaydet"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
