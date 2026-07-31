import React, { useState, useMemo, useRef } from "react";
import {
  FileText, Check, Plus, Minus, Printer, MessageCircle, Mail, Save, X,
  Sun, Moon, ChevronDown, Trash2, Building2, ImagePlus, BookmarkPlus,
} from "lucide-react";
import { HIZMET_KATALOGU, KATEGORI_SIRASI, SOZLESME_SURELERI, hizmetBul } from "./teklifKatalog.js";

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
/** Kullanıcı verisini yazdırılabilir HTML'e basmadan önce güvenli hale getirir (kod enjeksiyonunu engeller). */
const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const nid = () => Math.random().toString(36).slice(2, 9);

const KATEGORI_IKON = {
  "İçerik": "🎬", "Sosyal Medya": "📱", "Reklam": "📣", "SEO / GEO": "🔍",
  "Tasarım": "🎨", "Video": "🎞️",
};

/* ------------------------------------------------------------------ */
/* Metin üreticiler                                                      */
/* ------------------------------------------------------------------ */
function sozlesmeMetniOlustur(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi) {
  const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const maddeler = secilenListe
    .map((h) => (h.adetli ? h.madde.replace("{adet}", h.adet) : h.madde))
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n\n");
  const ucretIfadesi = kdvEkle ? `${fmt(toplamFiyat)} + KDV` : `${fmt(toplamFiyat)} (KDV dahil)`;

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
Yukarıda belirtilen hizmetler karşılığında aylık toplam bedel ${ucretIfadesi} olarak belirlenmiştir. Ödemeler her ayın başında, karşılıklı mutabık kalınan yöntemle tahsil edilir.

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

function teklifOzetMetni(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi) {
  const satirlar = secilenListe.map((h) => `✓ ${h.adetli && h.adet > 1 ? h.adet + " " : ""}${h.ad}`).join("\n");
  const ucretIfadesi = kdvEkle ? `${fmt(toplamFiyat)} + KDV` : fmt(toplamFiyat);
  return `${firmaAdi}\n${musteri.firma || ""}\n\n${satirlar}\n\nToplam: ${ucretIfadesi}`;
}

/* ------------------------------------------------------------------ */
/* Yazdırma / PDF — logolar üstte, metin altta                          */
/* ------------------------------------------------------------------ */
function yazdirMetin(baslik, govdeMetni, logoKendi, logoMusteri, kimlikGorseli) {
  const bodyHtml = escapeHtml(govdeMetni)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const logoHtml = (logoKendi || logoMusteri)
    ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;">
         <div>${logoKendi ? `<img src="${logoKendi}" style="max-height:60px;max-width:200px;" />` : ""}</div>
         <div>${logoMusteri ? `<img src="${logoMusteri}" style="max-height:60px;max-width:200px;" />` : ""}</div>
       </div>`
    : "";
  const kimlikHtml = kimlikGorseli ? `<div style="margin-top:60px;text-align:center;"><img src="${kimlikGorseli}" style="max-width:100%;max-height:160px;object-fit:contain;" /></div>` : "";
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>${escapeHtml(baslik)}</title>
  <style>
    body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 720px; margin: 50px auto; color:#1d1d1f; line-height:1.7; font-size:14.5px; }
    p { margin: 0 0 14px; }
    @media print { body { margin: 24px; } }
  </style></head>
  <body>${logoHtml}${bodyHtml}${kimlikHtml}</body></html>`;
  const win = window.open("", "_blank");
  if (!win) { window.alert("Yeni pencere açılamadı — pop-up engelleyiciyi kontrol et."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/** Teklifi görsel olarak zengin (numaralı, sol çizgili, açıklamalı) bir HTML sayfası olarak yazdırır. */
function yazdirTeklifGorsel(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi, logoKendi, logoMusteri, kimlikGorseli) {
  const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const kdvTutari = kdvEkle ? Math.round(toplamFiyat * 0.2) : 0;
  const genelToplam = toplamFiyat + kdvTutari;

  const maddelerHtml = secilenListe.map((h, i) => `
    <div style="display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #eee;">
      <div style="flex-shrink:0;width:30px;height:30px;border-radius:9px;background:#0071E3;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${i + 1}</div>
      <div style="border-left:2px solid #0071E3;padding-left:14px;flex:1;">
        <div style="font-weight:700;font-size:14.5px;color:#1d1d1f;">${escapeHtml(h.ad)}${h.adetli && h.adet > 1 ? ` <span style="color:#6e6e73;font-weight:500;">· Aylık ${Number(h.adet) || 0} adet</span>` : ""}</div>
        <div style="font-size:12.5px;color:#6e6e73;margin-top:3px;">${escapeHtml((h.madde || "").replace("{adet}", h.adet || ""))}</div>
      </div>
    </div>`).join("");

  const logoHtml = (logoKendi || logoMusteri)
    ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
         <div>${logoKendi ? `<img src="${logoKendi}" style="max-height:56px;max-width:190px;" />` : ""}</div>
         <div>${logoMusteri ? `<img src="${logoMusteri}" style="max-height:56px;max-width:190px;" />` : ""}</div>
       </div>` : "";
  const kimlikHtml = kimlikGorseli ? `<div style="margin-top:56px;text-align:center;border-top:1px solid #eee;padding-top:24px;"><img src="${kimlikGorseli}" style="max-width:100%;max-height:150px;object-fit:contain;" /></div>` : "";

  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>Teklif - ${escapeHtml(musteri.firma)}</title>
  <style>
    body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 720px; margin: 50px auto; color:#1d1d1f; }
    @media print { body { margin: 24px; } }
  </style></head>
  <body>
    ${logoHtml}
    <div style="text-align:center;margin-bottom:8px;font-size:11px;letter-spacing:1.5px;color:#6e6e73;font-weight:700;">TEKLİF</div>
    <div style="text-align:center;font-size:22px;font-weight:700;margin-bottom:4px;">${escapeHtml(musteri.firma || "")}</div>
    <div style="text-align:center;font-size:12.5px;color:#6e6e73;margin-bottom:36px;">${escapeHtml(firmaAdi)} · ${bugun}</div>
    <div style="margin-bottom:24px;">${maddelerHtml || '<div style="color:#aeaeb4;text-align:center;padding:20px 0;">Seçilen hizmet yok</div>'}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:24px;">
      <div style="text-align:right;">
        ${kdvEkle ? `<div style="font-size:12.5px;color:#6e6e73;">Ara Toplam: ${fmt(toplamFiyat)}</div><div style="font-size:12.5px;color:#6e6e73;margin-bottom:6px;">KDV (%20): ${fmt(kdvTutari)}</div>` : ""}
        <div style="font-size:26px;font-weight:700;">${fmt(kdvEkle ? genelToplam : toplamFiyat)}</div>
      </div>
    </div>
    ${kimlikHtml}
  </body></html>`;
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
        {secili && h.adetli && <Stepper C={C} value={secim.adet} onChange={(v) => onUpdate({ adet: v })} />}
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

function LogoYukleyici({ C, label, value, onChange }) {
  const inputRef = useRef(null);
  const dosyaSec = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ flex: 1 }}>
      <AlanEtiket C={C}>{label}</AlanEtiket>
      <div
        onClick={() => inputRef.current && inputRef.current.click()}
        style={{
          height: 64, borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.panelAlt, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative",
        }}
      >
        {value ? (
          <>
            <img src={value} alt={label} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 999, border: "none", background: C.danger, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            ><X size={11} /></button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: C.textFaint }}>
            <ImagePlus size={16} />
            <span style={{ fontSize: 10.5 }}>Logo Yükle</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={dosyaSec} style={{ display: "none" }} />
    </div>
  );
}

function SonHaliDuzenleModal({ C, baslik, initialText, logoKendi, logoMusteri, kimlikGorseli, isSozlesme, sablonlar = [], onSaveSablon, onDeleteSablon, onClose }) {
  const [text, setText] = useState(initialText);
  const [sablonAdi, setSablonAdi] = useState("");
  const [sablonKaydetAcik, setSablonKaydetAcik] = useState(false);
  const [sablonMenuAcik, setSablonMenuAcik] = useState(false);

  const kaydetSablon = () => {
    if (!sablonAdi.trim()) return;
    onSaveSablon && onSaveSablon(sablonAdi.trim(), text);
    setSablonAdi("");
    setSablonKaydetAcik(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, width: 600, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16.5, fontWeight: 700, color: C.text, margin: 0 }}>{baslik} — Son Hali</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} color={C.textFaint} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.6, marginBottom: 12 }}>
          Yazdırmadan önce metni istediğin gibi değiştirebilirsin. Logolar (varsa) çıktının üstünde, marka kimliği görseli (varsa) en altında otomatik yer alır.
        </p>

        {isSozlesme && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, position: "relative" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <button onClick={() => setSablonMenuAcik((v) => !v)} style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                Kayıtlı Sözleşme Şablonların ({sablonlar.length})
              </button>
              {sablonMenuAcik && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 10, maxHeight: 200, overflowY: "auto" }}>
                  {sablonlar.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.textFaint }}>Henüz kayıtlı sözleşme şablonu yok.</div>}
                  {sablonlar.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.borderSoft}` }}>
                      <button onClick={() => { setText(s.metin); setSablonMenuAcik(false); }} style={{ flex: 1, textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", color: C.text, fontSize: 12.5, cursor: "pointer" }}>{s.ad}</button>
                      <button onClick={() => onDeleteSablon && onDeleteSablon(s.id)} style={{ padding: "8px 10px", background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={12} color={C.danger} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sablonKaydetAcik ? (
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                <input autoFocus value={sablonAdi} onChange={(e) => setSablonAdi(e.target.value)} placeholder="Şablon adı" style={{ flex: 1, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", fontSize: 12.5, color: C.text, outline: "none" }} />
                <button onClick={kaydetSablon} style={{ padding: "8px 12px", borderRadius: 9, border: "none", background: C.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Kaydet</button>
              </div>
            ) : (
              <button onClick={() => setSablonKaydetAcik(true)} style={{ padding: "8px 12px", borderRadius: 9, border: `1px dashed ${C.border}`, background: "transparent", color: C.accentText, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Bu Metni Şablon Kaydet</button>
            )}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          style={{ width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>İptal</button>
          <button
            onClick={() => { yazdirMetin(baslik, text, logoKendi, logoMusteri, kimlikGorseli); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Printer size={14} /> Yazdır / PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ANA BİLEŞEN                                                           */
/* ------------------------------------------------------------------ */
export default function TeklifSozlesme({ firmaAdi = "Marcus Medya", onSaveTeklif, sablonlar = [], onSaveSablon, onDeleteSablon, kimlikGorseli, sozlesmeSablonlari = [], onSaveSozlesmeSablonu, onDeleteSozlesmeSablonu }) {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;

  const [musteri, setMusteri] = useState({ firma: "", yetkili: "", telefon: "", mail: "", adres: "", vergiDairesi: "", vergiNo: "", sure: 1, baslangic: new Date().toISOString().slice(0, 10) });
  const [secimler, setSecimler] = useState({});
  const [logoKendi, setLogoKendi] = useState(null);
  const [logoMusteri, setLogoMusteri] = useState(null);
  const [toplamFiyat, setToplamFiyat] = useState(0);
  const [kdvEkle, setKdvEkle] = useState(true);
  const [sablonMenuOpen, setSablonMenuOpen] = useState(false);
  const [sablonAdi, setSablonAdi] = useState("");
  const [sablonKaydetAcik, setSablonKaydetAcik] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [sonHali, setSonHali] = useState(null); // { baslik, text }

  const musteriSet = (k, v) => setMusteri((m) => ({ ...m, [k]: v }));

  const toggleHizmet = (h) => {
    setSecimler((prev) => {
      const next = { ...prev };
      if (next[h.id]) delete next[h.id];
      else next[h.id] = { adet: h.adetli ? h.varsayilanAdet : 1 };
      return next;
    });
  };
  const updateSecim = (id, patch) => setSecimler((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const uygulaSablon = (sablon) => {
    setSecimler(sablon.secimler || {});
    setSablonMenuOpen(false);
  };

  const kaydetSablonOlarak = () => {
    if (!sablonAdi.trim()) return;
    onSaveSablon && onSaveSablon(sablonAdi.trim(), secimler);
    setSablonAdi("");
    setSablonKaydetAcik(false);
  };

  const temizle = () => { setSecimler({}); };

  const secilenListe = useMemo(
    () => Object.entries(secimler).map(([id, v]) => ({ ...hizmetBul(id), ...v })).filter((x) => x.id),
    [secimler]
  );

  const kdvTutari = kdvEkle ? Math.round(toplamFiyat * 0.2) : 0;
  const genelToplam = toplamFiyat + kdvTutari;

  const teklifMetni = () => teklifOzetMetni(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi);
  const sozlesmeMetni = () => sozlesmeMetniOlustur(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi);

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
      onSaveTeklif({ id: nid(), tarih: new Date().toISOString(), musteri, secilenListe, toplamFiyat, kdvEkle });
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
            <div style={{ fontSize: 12, color: C.textFaint }}>Hizmet seç, fiyatı sen belirle</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSablonMenuOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <BookmarkPlus size={14} /> Şablonlarım <ChevronDown size={13} />
            </button>
            {sablonMenuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 260, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, zIndex: 20, overflow: "hidden" }}>
                {sablonlar.length === 0 && <div style={{ padding: "14px", fontSize: 12.5, color: C.textFaint }}>Henüz kayıtlı şablon yok.</div>}
                {sablonlar.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.borderSoft}` }}>
                    <button onClick={() => uygulaSablon(s)} style={{ flex: 1, textAlign: "left", padding: "11px 14px", background: "transparent", border: "none", color: C.text, fontSize: 13, cursor: "pointer" }}>{s.ad}</button>
                    <button onClick={() => onDeleteSablon && onDeleteSablon(s.id)} style={{ padding: "8px 10px", background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={13} color={C.danger} /></button>
                  </div>
                ))}
                <div style={{ padding: 10 }}>
                  {sablonKaydetAcik ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input autoFocus value={sablonAdi} onChange={(e) => setSablonAdi(e.target.value)} placeholder="Şablon adı" style={{ flex: 1, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 9px", fontSize: 12.5, color: C.text, outline: "none" }} />
                      <button onClick={kaydetSablonOlarak} style={{ padding: "7px 10px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Kaydet</button>
                    </div>
                  ) : (
                    <button onClick={() => setSablonKaydetAcik(true)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1px dashed ${C.border}`, background: "transparent", color: C.accentText, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Mevcut seçimi şablon olarak kaydet</button>
                  )}
                </div>
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
          <input type="date" className="teklif-input" value={musteri.baslangic} onChange={(e) => musteriSet("baslangic", e.target.value)} style={{ width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13.5, fontFamily: "inherit", outline: "none", marginBottom: 16 }} />

          <div style={{ display: "flex", gap: 10 }}>
            <LogoYukleyici C={C} label="Kendi Logon" value={logoKendi} onChange={setLogoKendi} />
            <LogoYukleyici C={C} label="Müşteri Logosu" value={logoMusteri} onChange={setLogoMusteri} />
          </div>
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
          {(logoKendi || logoMusteri) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              {logoKendi ? <img src={logoKendi} alt="logo" style={{ maxHeight: 34, maxWidth: 100, objectFit: "contain" }} /> : <div />}
              {logoMusteri ? <img src={logoMusteri} alt="müşteri logo" style={{ maxHeight: 34, maxWidth: 100, objectFit: "contain" }} /> : <div />}
            </div>
          )}
          <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>{firmaAdi.toUpperCase()}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 14 }}>{musteri.firma || "Müşteri Adı"}</div>

          <div style={{ borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, padding: "14px 0", marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
            {secilenListe.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.textFaint, textAlign: "center", padding: "20px 0" }}>Henüz hizmet seçilmedi</div>
            ) : (
              secilenListe.map((h) => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                  <Check size={13} color={C.success} strokeWidth={3} style={{ flexShrink: 0 }} />
                  <span style={{ color: C.text, flex: 1 }}>{h.adetli && h.adet > 1 ? `${h.adet} ` : ""}{h.ad}</span>
                </div>
              ))
            )}
          </div>

          <AlanEtiket C={C}>Toplam Fiyat (₺, sen belirle)</AlanEtiket>
          <input
            type="number" value={toplamFiyat}
            onChange={(e) => setToplamFiyat(Number(e.target.value))}
            style={{ width: "100%", background: C.panelAlt, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: "11px 12px", color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "inherit", outline: "none", marginBottom: 10 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={kdvEkle} onChange={(e) => setKdvEkle(e.target.checked)} style={{ width: 15, height: 15, cursor: "pointer" }} />
            <span style={{ fontSize: 12.5, color: C.textDim }}>KDV ekle (%20)</span>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{kdvEkle ? "Genel Toplam" : "Toplam"}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>
              {kdvEkle ? fmt(genelToplam) : fmt(toplamFiyat)} {kdvEkle && <span style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>({fmt(toplamFiyat)} + {fmt(kdvTutari)} KDV)</span>}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => yazdirTeklifGorsel(musteri, secilenListe, toplamFiyat, kdvEkle, firmaAdi, logoKendi, logoMusteri, kimlikGorseli)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px", borderRadius: 11, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Printer size={14} /> Teklifi Yazdır / PDF
            </button>
            <button onClick={() => setSonHali({ baslik: `Teklif - ${musteri.firma}`, text: teklifMetni(), isSozlesme: false })} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Metni Düzenleyip Ayrıca Yazdır
            </button>
            <button onClick={() => setSonHali({ baslik: `Sözleşme - ${musteri.firma}`, text: sozlesmeMetni(), isSozlesme: true })} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <FileText size={14} /> Sözleşmenin Son Halini Gör
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

      {sonHali && (
        <SonHaliDuzenleModal
          C={C}
          baslik={sonHali.baslik}
          initialText={sonHali.text}
          logoKendi={logoKendi}
          logoMusteri={logoMusteri}
          kimlikGorseli={kimlikGorseli}
          isSozlesme={sonHali.isSozlesme}
          sablonlar={sozlesmeSablonlari}
          onSaveSablon={onSaveSozlesmeSablonu}
          onDeleteSablon={onDeleteSozlesmeSablonu}
          onClose={() => setSonHali(null)}
        />
      )}
    </div>
  );
}
