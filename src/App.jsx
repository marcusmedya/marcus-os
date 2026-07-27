import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, Wallet, Clapperboard, Settings, Sparkles,
  ArrowUpRight, ArrowDownRight, X, Send, Plus, Pencil, Trash2, Check,
  Film, Scissors, CheckCircle2, Share2, Megaphone, ChevronRight,
  CircleDollarSign, Receipt, Landmark, CalendarClock, Search, Bell
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { DEFAULT_DATA } from "./data.js";

/* ------------------------------------------------------------------ */
/* DESIGN TOKENS                                                       */
/* ------------------------------------------------------------------ */
const T = {
  bg: "#0C0E13",
  surface: "#151822",
  surfaceRaised: "#1C202C",
  border: "#262B38",
  borderSoft: "#1D212C",
  text: "#EEF0F4",
  textDim: "#8B93A7",
  textFaint: "#565D70",
  accent: "#5B6EF5",
  accentSoft: "rgba(91,110,245,0.14)",
  accentText: "#B7C0FF",
  success: "#34D399",
  successSoft: "rgba(52,211,153,0.14)",
  warning: "#F5A623",
  warningSoft: "rgba(245,166,35,0.14)",
  danger: "#F2555A",
  dangerSoft: "rgba(242,85,90,0.14)",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const durumMap = {
  yesil: { label: "Tamamlandı", color: T.success, soft: T.successSoft },
  turuncu: { label: "Bekliyor", color: T.warning, soft: T.warningSoft },
  kirmizi: { label: "Gecikti", color: T.danger, soft: T.dangerSoft },
};
const opIcon = { Çekim: Film, Edit: Scissors, Onay: CheckCircle2, Paylaşım: Share2, Reklam: Megaphone };

const fmt = (n) => "₺" + (Number(n) || 0).toLocaleString("tr-TR");
const fmtShort = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + "b" : n);
const nextId = (arr) => (arr.length ? Math.max(...arr.map((i) => i.id || 0)) + 1 : 1);

/* ------------------------------------------------------------------ */
/* SMALL UI PRIMITIVES                                                 */
/* ------------------------------------------------------------------ */
function Card({ children, style, ...rest }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, ...style }} {...rest}>
      {children}
    </div>
  );
}

function Pill({ color, soft, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color, background: soft, padding: "4px 10px", borderRadius: 999, fontFamily: "Inter, sans-serif" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {children}
    </span>
  );
}

function KpiCard({ label, value, mono = true, delta, deltaYoy, accent }) {
  const up = delta >= 0;
  return (
    <Card style={{ padding: "18px 20px", flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: 0.2, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent || T.text, fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif", marginBottom: 10, letterSpacing: -0.5 }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: up ? T.success : T.danger, fontFamily: "Inter, sans-serif" }}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta)}% geçen aya göre
          </span>
          {deltaYoy !== undefined && (
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter, sans-serif" }}>yıllık {deltaYoy >= 0 ? "+" : ""}{deltaYoy}%</span>
          )}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text, margin: 0, letterSpacing: 0.1 }}>{children}</h2>
      {action}
    </div>
  );
}

const inputStyle = { width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" };
const saveBtnStyle = { background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const cancelBtnStyle = { background: "transparent", color: T.textDim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" };
const iconBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: 5, display: "flex", alignItems: "center" };
const addBtnStyle = { display: "flex", alignItems: "center", gap: 6, background: T.accentSoft, color: T.accentText, border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" };

/** Generic small form for add/edit, driven by a field-definition list. */
function FieldForm({ fields, initial, onSubmit, onCancel, submitLabel = "Kaydet" }) {
  const [values, setValues] = useState(() => {
    const v = {};
    fields.forEach((f) => { v[f.key] = initial && initial[f.key] !== undefined ? initial[f.key] : f.type === "number" ? 0 : ""; });
    return v;
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: fields.length > 3 ? "1fr 1fr" : "1fr", gap: 10, padding: 14, background: T.surfaceRaised, borderRadius: 12, border: `1px solid ${T.border}` }}>
      {fields.map((f) => (
        <div key={f.key}>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter, sans-serif", display: "block", marginBottom: 4 }}>{f.label}</label>
          {f.type === "select" ? (
            <select value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={inputStyle}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              style={inputStyle}
            />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", marginTop: 2 }}>
        <button onClick={() => onSubmit(values)} style={saveBtnStyle}><Check size={13} /> {submitLabel}</button>
        <button onClick={onCancel} style={cancelBtnStyle}>İptal</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KARAR ŞERİDİ                                                          */
/* ------------------------------------------------------------------ */
function KararSeridi({ data, onAsk }) {
  const insight = useMemo(() => {
    const active = data.clients.filter((c) => c.durum !== "ayrildi");
    if (!active.length || !data.monthly.length) return null;
    const enKarli = [...active].sort((a, b) => b.karMarji - a.karMarji)[0];
    const enDusuk = [...active].sort((a, b) => a.karMarji - b.karMarji)[0];
    const lastCiro = data.monthly[data.monthly.length - 1].ciro || 1;
    const bagimlilik = Math.round((enKarli.aylikUcret / lastCiro) * 100);
    return { enKarli, enDusuk, bagimlilik };
  }, [data]);

  if (!insight) return null;

  return (
    <div style={{ background: `linear-gradient(90deg, ${T.accentSoft}, transparent 70%)`, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.accentText, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        <Sparkles size={14} /> BUGÜNÜN KARARI
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.text, flex: 1, minWidth: 260 }}>
        <b>{insight.enDusuk.ad}</b> kâr marjın en düşük müşterin (%{insight.enDusuk.karMarji}) — fiyat güncellemesi ya da kapsam gözden geçirmesi gerekebilir.
        Ciron'un %{insight.bagimlilik}'i tek müşteriye ({insight.enKarli.ad}) bağlı.
      </div>
      <button onClick={onAsk} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
        AI CEO'ya sor <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DASHBOARD                                                            */
/* ------------------------------------------------------------------ */
function Dashboard({ data, onAsk }) {
  const { monthly, clients, operasyonlar, bekleyenTahsilatlar } = data;
  if (!monthly.length) {
    return <KararSeridi data={data} onAsk={onAsk} />;
  }
  const last = monthly[monthly.length - 1];
  const prev = monthly.length > 1 ? monthly[monthly.length - 2] : last;
  const ciroDelta = prev.ciro ? (((last.ciro - prev.ciro) / prev.ciro) * 100).toFixed(1) : "0.0";
  const netDelta = prev.net ? (((last.net - prev.net) / prev.net) * 100).toFixed(1) : "0.0";
  const giderDelta = prev.gider ? (((last.gider - prev.gider) / prev.gider) * 100).toFixed(1) : "0.0";
  const karMarji = last.ciro ? ((last.net / last.ciro) * 100).toFixed(0) : "0";
  const bekleyenToplam = bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0);
  const tahsilEdilen = last.ciro - bekleyenToplam;

  const opCounts = ["yesil", "turuncu", "kirmizi"].map((k) => ({ key: k, count: operasyonlar.filter((o) => o.durum === k).length }));

  return (
    <div>
      <KararSeridi data={data} onAsk={onAsk} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM CİRO" value={fmt(last.ciro)} delta={Number(ciroDelta)} deltaYoy={18} />
        <KpiCard label="NET KAZANÇ" value={fmt(last.net)} delta={Number(netDelta)} deltaYoy={22} accent={T.success} />
        <KpiCard label="TOPLAM GİDER" value={fmt(last.gider)} delta={Number(giderDelta)} deltaYoy={9} />
        <KpiCard label="KÂR MARJI" value={`%${karMarji}`} mono delta={2.1} deltaYoy={4} />
        <KpiCard label="TAHSİL EDİLEN" value={fmt(tahsilEdilen)} delta={5.2} />
        <KpiCard label="BEKLEYEN TAHSİLAT" value={fmt(bekleyenToplam)} mono delta={-3} accent={T.warning} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 22 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Ciro & Net Kazanç — Son Aylar</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ left: -18, right: 8 }}>
              <defs>
                <linearGradient id="ciroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.success} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} labelStyle={{ color: T.text }} />
              <Area type="monotone" dataKey="ciro" stroke={T.accent} fill="url(#ciroGrad)" strokeWidth={2} name="Ciro" />
              <Area type="monotone" dataKey="net" stroke={T.success} fill="url(#netGrad)" strokeWidth={2} name="Net" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Operasyon Durumu</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {opCounts.map(({ key, count }) => {
              const d = durumMap[key];
              const pct = operasyonlar.length ? Math.round((count / operasyonlar.length) * 100) : 0;
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontFamily: "Inter, sans-serif", marginBottom: 5 }}>
                    <span style={{ color: T.textDim }}>{d.label}</span>
                    <span style={{ color: T.text, fontWeight: 600 }}>{count} iş</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: T.borderSoft, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: d.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card style={{ padding: "20px 22px" }}>
        <SectionTitle action={<Pill color={T.accentText} soft={T.accentSoft}><Sparkles size={11} /> AI</Pill>}>AI CEO Özeti</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Sorularını yanıtlaması için sağ alttaki "AI CEO'ya Sor" butonunu kullanabilirsin — güncel müşteri, finans ve operasyon verilerine bakarak cevap verir.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MÜŞTERİLER                                                           */
/* ------------------------------------------------------------------ */
const CLIENT_FIELDS = [
  { key: "ad", label: "Müşteri Adı", type: "text" },
  { key: "kategori", label: "Kategori", type: "text" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "aktif", label: "Aktif" }, { value: "yeni", label: "Yeni" }, { value: "ayrildi", label: "Ayrıldı" }] },
  { key: "aylikUcret", label: "Aylık Ücret (₺)", type: "number" },
  { key: "karMarji", label: "Kâr Marjı (%)", type: "number" },
  { key: "baslangic", label: "Başlangıç (YYYY-AA)", type: "text", placeholder: "2026-07" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

function Musteriler({ clients, onAdd, onUpdate, onDelete }) {
  const [filter, setFilter] = useState("hepsi");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const active = clients.filter((c) => c.durum !== "ayrildi");
  const enKarli = active.length ? [...active].sort((a, b) => b.karMarji - a.karMarji)[0] : null;
  const enDusuk = active.length ? [...active].sort((a, b) => a.karMarji - b.karMarji)[0] : null;
  const ortalamaGelir = active.length ? Math.round(active.reduce((s, c) => s + c.aylikUcret, 0) / active.length) : 0;
  const filtered = clients.filter((c) => (filter === "hepsi" ? true : c.durum === filter));

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="AKTİF MÜŞTERİ" value={clients.filter((c) => c.durum === "aktif").length} mono={false} />
        <KpiCard label="YENİ MÜŞTERİ" value={clients.filter((c) => c.durum === "yeni").length} mono={false} accent={T.success} />
        <KpiCard label="MÜŞTERİ BAŞI ORT. GELİR" value={fmt(ortalamaGelir)} />
        <KpiCard label="EN KÂRLI" value={enKarli ? enKarli.ad : "—"} mono={false} accent={T.success} />
        <KpiCard label="EN DÜŞÜK KÂRLI" value={enDusuk ? enDusuk.ad : "—"} mono={false} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["hepsi", "Hepsi"], ["aktif", "Aktif"], ["yeni", "Yeni"], ["ayrildi", "Ayrılan"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? T.accentSoft : "transparent", color: filter === k ? T.accentText : T.textDim, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Yeni müşteri ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={CLIENT_FIELDS} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Müşteriyi Ekle" />
        </div>
      )}

      <Card style={{ padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr>
              {["Müşteri", "Kategori", "Durum", "Aylık Ücret", "Kâr Marjı", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 3 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td colSpan={6} style={{ padding: "12px 16px" }}>
                    <FieldForm fields={CLIENT_FIELDS} initial={c} onSubmit={(v) => { onUpdate(c.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600 }}>{c.ad}</div>
                    {c.not && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{c.not}</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{c.kategori}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <Pill color={c.durum === "aktif" ? T.success : c.durum === "yeni" ? T.accentText : T.textFaint} soft={c.durum === "aktif" ? T.successSoft : c.durum === "yeni" ? T.accentSoft : T.borderSoft}>
                      {c.durum === "aktif" ? "Aktif" : c.durum === "yeni" ? "Yeni" : "Ayrıldı"}
                    </Pill>
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{c.aylikUcret ? fmt(c.aylikUcret) : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: c.karMarji >= 55 ? T.success : c.karMarji >= 35 ? T.warning : T.danger }}>{c.karMarji ? `%${c.karMarji}` : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={iconBtnStyle} onClick={() => { setEditingId(c.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${c.ad} silinsin mi?`)) onDelete(c.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Bu filtrede müşteri yok.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FİNANS                                                                */
/* ------------------------------------------------------------------ */
const KALEM_FIELDS = [{ key: "kalem", label: "Kalem Adı", type: "text" }, { key: "tutar", label: "Tutar (₺)", type: "number" }];
const BEKLEYEN_FIELDS = [{ key: "musteri", label: "Müşteri", type: "text" }, { key: "tutar", label: "Tutar (₺)", type: "number" }, { key: "vade", label: "Vade Durumu", type: "text", placeholder: "örn. bugün / 3 gün gecikti" }];
const VERGI_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text" },
  { key: "tarih", label: "Tarih", type: "text", placeholder: "örn. 26 Ağu" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "yaklaşıyor", label: "Yaklaşıyor" }, { value: "planlandı", label: "Planlandı" }] },
];
const MONTH_FIELDS = [{ key: "ay", label: "Ay", type: "text", placeholder: "örn. Ağu" }, { key: "ciro", label: "Ciro (₺)", type: "number" }, { key: "gider", label: "Gider (₺)", type: "number" }];

function MiniList({ title, icon, items, fields, renderRow, onAdd, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card style={{ padding: "20px 22px" }}>
      <SectionTitle action={icon}>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < items.length - 1 ? `1px solid ${T.borderSoft}` : "none", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item)}</div>
            <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu kayıt silinsin mi?")) onDelete(item.id); }}><Trash2 size={13} color={T.danger} /></button>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: T.textFaint, fontSize: 12.5, fontFamily: "Inter", padding: "8px 0" }}>Henüz kayıt yok.</div>}
      </div>
      {adding ? (
        <FieldForm fields={fields} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Ekle" />
      ) : (
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={13} /> {addLabel}</button>
      )}
    </Card>
  );
}

function Finans({ data, onAddGelir, onDeleteGelir, onAddGider, onDeleteGider, onAddBekleyen, onDeleteBekleyen, onAddVergi, onDeleteVergi, onAddMonth, onDeleteMonth }) {
  const { monthly, gelirKalemleri, giderKalemleri, bekleyenTahsilatlar, vergiTakvimi } = data;
  const [addingMonth, setAddingMonth] = useState(false);
  const last = monthly.length ? monthly[monthly.length - 1] : { ciro: 0, gider: 0, net: 0 };
  const bekleyenToplam = bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0);
  const tahsilatOrani = last.ciro ? Math.round(((last.ciro - bekleyenToplam) / last.ciro) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="NAKİT AKIŞI (SON AY)" value={fmt(last.net)} accent={T.success} delta={12} />
        <KpiCard label="TAHSİLAT ORANI" value={`%${tahsilatOrani}`} mono />
        <KpiCard label="BEKLEYEN ÖDEME" value={fmt(bekleyenToplam)} accent={T.warning} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Gelir & Gider — Aylar</SectionTitle>
          {monthly.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} margin={{ left: -18, right: 8 }} barGap={4}>
                <CartesianGrid stroke={T.borderSoft} vertical={false} />
                <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} />
                <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
                <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "12px 0" }}>
            {monthly.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < monthly.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.ay}</span>
                <span style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>Ciro {fmt(m.ciro)} · Gider {fmt(m.gider)} · Net {fmt(m.net)}</span>
                <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu ay silinsin mi?")) onDeleteMonth(m.id); }}><Trash2 size={12} color={T.danger} /></button>
              </div>
            ))}
          </div>
          {addingMonth ? (
            <FieldForm fields={MONTH_FIELDS} onSubmit={(v) => { onAddMonth(v); setAddingMonth(false); }} onCancel={() => setAddingMonth(false)} submitLabel="Ayı Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingMonth(true)}><Plus size={13} /> Yeni ay ekle</button>
          )}
        </Card>

        <MiniList
          title="Vergi Takibi"
          icon={<CalendarClock size={16} color={T.textFaint} />}
          items={vergiTakvimi}
          fields={VERGI_FIELDS}
          addLabel="Vergi kalemi ekle"
          onAdd={onAddVergi}
          onDelete={onDeleteVergi}
          renderRow={(v) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{v.kalem}</div>
                <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>{v.tarih}</div>
              </div>
              {v.durum === "yaklaşıyor" && <Pill color={T.warning} soft={T.warningSoft}>Yaklaşıyor</Pill>}
            </div>
          )}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <MiniList
          title="Gelirler"
          icon={<CircleDollarSign size={16} color={T.textFaint} />}
          items={gelirKalemleri}
          fields={KALEM_FIELDS}
          addLabel="Gelir kalemi ekle"
          onAdd={onAddGelir}
          onDelete={onDeleteGelir}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>{g.kalem}</span>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
        <MiniList
          title="Giderler"
          icon={<Receipt size={16} color={T.textFaint} />}
          items={giderKalemleri}
          fields={KALEM_FIELDS}
          addLabel="Gider kalemi ekle"
          onAdd={onAddGider}
          onDelete={onDeleteGider}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>{g.kalem}</span>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
      </div>

      <MiniList
        title="Bekleyen Tahsilatlar"
        icon={<Landmark size={16} color={T.textFaint} />}
        items={bekleyenTahsilatlar}
        fields={BEKLEYEN_FIELDS}
        addLabel="Bekleyen tahsilat ekle"
        onAdd={onAddBekleyen}
        onDelete={onDeleteBekleyen}
        renderRow={(b) => (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{b.musteri}</div>
              <div style={{ fontSize: 11.5, color: b.vade.includes("gecikti") ? T.danger : T.textFaint, fontFamily: "Inter" }}>{b.vade}</div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: T.text }}>{fmt(b.tutar)}</div>
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OPERASYON — Kanban                                                   */
/* ------------------------------------------------------------------ */
const stages = ["Çekim", "Edit", "Onay", "Paylaşım", "Reklam"];
const OP_FIELDS = (stage) => [
  { key: "musteri", label: "Müşteri", type: "text" },
  { key: "baslik", label: "İş Başlığı", type: "text" },
  { key: "tarih", label: "Tarih", type: "text", placeholder: "örn. 30 Tem" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "yesil", label: "Tamamlandı" }, { value: "turuncu", label: "Bekliyor" }, { value: "kirmizi", label: "Gecikti" }] },
];

function Operasyon({ operasyonlar, onAdd, onUpdate, onDelete }) {
  const [addingStage, setAddingStage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const cycleDurum = (d) => (d === "yesil" ? "turuncu" : d === "turuncu" ? "kirmizi" : "yesil");

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {Object.entries(durumMap).map(([k, d]) => (
          <Pill key={k} color={d.color} soft={d.soft}>{d.label} · {operasyonlar.filter((o) => o.durum === k).length}</Pill>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 12 }}>
        {stages.map((stage) => {
          const items = operasyonlar.filter((o) => o.tur === stage);
          const Icon = opIcon[stage];
          return (
            <div key={stage}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "0 4px" }}>
                <Icon size={14} color={T.textDim} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, fontFamily: "Inter" }}>{stage}</span>
                <span style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((o) =>
                  editingId === o.id ? (
                    <div key={o.id}>
                      <FieldForm fields={OP_FIELDS(stage)} initial={o} onSubmit={(v) => { onUpdate(o.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <Card key={o.id} style={{ padding: "12px 13px" }}>
                      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 6, lineHeight: 1.4 }}>{o.baslik}</div>
                      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>{o.musteri}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button onClick={() => onUpdate(o.id, { durum: cycleDurum(o.durum) })} style={{ border: "none", cursor: "pointer", background: "transparent", padding: 0 }} title="Durumu değiştirmek için tıkla">
                          <Pill color={durumMap[o.durum].color} soft={durumMap[o.durum].soft}>{durumMap[o.durum].label}</Pill>
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{o.tarih}</span>
                          <button style={iconBtnStyle} onClick={() => setEditingId(o.id)}><Pencil size={12} color={T.textFaint} /></button>
                          <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu iş silinsin mi?")) onDelete(o.id); }}><Trash2 size={12} color={T.danger} /></button>
                        </div>
                      </div>
                    </Card>
                  )
                )}
                {addingStage === stage ? (
                  <FieldForm fields={OP_FIELDS(stage)} initial={{ tur: stage, durum: "turuncu" }} onSubmit={(v) => { onAdd({ ...v, tur: stage }); setAddingStage(null); }} onCancel={() => setAddingStage(null)} submitLabel="Ekle" />
                ) : (
                  <button style={{ ...addBtnStyle, justifyContent: "center" }} onClick={() => setAddingStage(stage)}><Plus size={13} /> Ekle</button>
                )}
                {items.length === 0 && addingStage !== stage && (
                  <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", padding: "16px 8px", textAlign: "center", border: `1px dashed ${T.borderSoft}`, borderRadius: 10 }}>İş yok</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AYARLAR                                                               */
/* ------------------------------------------------------------------ */
function Ayarlar() {
  const rows = [
    { label: "İşletme Adı", value: "Marcus Medya" },
    { label: "Sektör", value: "Medya & Reklam Ajansı" },
    { label: "Ekip Büyüklüğü", value: "5+ kişi" },
    { label: "Para Birimi", value: "₺ TRY" },
    { label: "Mali Yıl Başlangıcı", value: "Ocak" },
  ];
  return (
    <div style={{ maxWidth: 560 }}>
      <Card style={{ padding: "8px 22px", marginBottom: 16 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: i < rows.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
            <span style={{ fontSize: 13.5, color: T.textDim, fontFamily: "Inter" }}>{r.label}</span>
            <span style={{ fontSize: 13.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </Card>
      <Card style={{ padding: "18px 22px" }}>
        <SectionTitle>Veri</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7 }}>
          Müşteriler, Finans ve Operasyon bölümlerindeki tüm değişiklikler otomatik olarak kaydedilir. Sayfayı kapatıp
          tekrar açtığında en son haliyle karşına çıkar.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI CEO CHAT PANEL                                                    */
/* ------------------------------------------------------------------ */
const PRESET_QUESTIONS = ["Bu ay neden kâr düştü?", "En kârlı müşteriler hangileri?", "Gelecek ay tahmini nedir?", "Hangi müşteriye bağımlıyım?"];

function AiPanel({ open, onClose, initialQuestion, data }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Merhaba, ben Marcus OS'un AI CEO asistanıyım. İşletmenin güncel verilerine bakarak sorularını cevaplayabilirim." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const firedInitial = useRef(false);

  useEffect(() => {
    if (open && initialQuestion && !firedInitial.current) { firedInitial.current = true; send(initialQuestion); }
    if (!open) firedInitial.current = false;
    // eslint-disable-next-line
  }, [open, initialQuestion]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: data }),
      });
      const resData = await res.json();
      const textBlock = (resData.content || []).find((c) => c.type === "text");
      setMessages((m) => [...m, { role: "assistant", text: textBlock ? textBlock.text : (resData.error || "Bir cevap alınamadı, tekrar dener misin?") }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Bağlantı hatası oluştu. Lütfen tekrar dene." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 400, maxWidth: "92vw", background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 50, display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(.4,0,.2,1)", boxShadow: open ? "-24px 0 48px rgba(0,0,0,0.35)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={14} color={T.accentText} /></div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: T.text }}>AI CEO</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={17} color={T.textFaint} /></button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? T.accent : T.surfaceRaised, color: m.role === "user" ? "#fff" : T.text, padding: "10px 13px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", fontSize: 13.5, fontFamily: "Inter, sans-serif", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {m.text}
          </div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", color: T.textFaint, fontSize: 12.5, fontFamily: "Inter", padding: "4px 4px" }}>AI CEO yazıyor…</div>}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {PRESET_QUESTIONS.map((q) => (
            <button key={q} onClick={() => send(q)} style={{ textAlign: "left", background: T.surfaceRaised, border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{q}</button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Bir soru sor…" style={{ flex: 1, background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
        <button onClick={() => send()} disabled={loading} style={{ background: T.accent, border: "none", borderRadius: 10, width: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: loading ? 0.6 : 1 }}><Send size={15} color="#fff" /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* APP SHELL                                                            */
/* ------------------------------------------------------------------ */
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "musteriler", label: "Müşteriler", icon: Users },
  { key: "finans", label: "Finans", icon: Wallet },
  { key: "operasyon", label: "Operasyon", icon: Clapperboard },
  { key: "ayarlar", label: "Ayarlar", icon: Settings },
];

export default function MarcusOS() {
  const [tab, setTab] = useState("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((res) => setData(res.data || DEFAULT_DATA))
      .catch(() => setData(DEFAULT_DATA))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return;
    if (skipNextSave.current) { skipNextSave.current = false; }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) })
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line
  }, [data]);

  const openAi = (q) => { setAiQuestion(q || null); setAiOpen(true); };

  // ---- CRUD handlers ----
  const addClient = (c) => setData((d) => ({ ...d, clients: [...d.clients, { ...c, id: nextId(d.clients) }] }));
  const updateClient = (id, patch) => setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const deleteClient = (id) => setData((d) => ({ ...d, clients: d.clients.filter((c) => c.id !== id) }));

  const addOp = (o) => setData((d) => ({ ...d, operasyonlar: [...d.operasyonlar, { ...o, id: nextId(d.operasyonlar) }] }));
  const updateOp = (id, patch) => setData((d) => ({ ...d, operasyonlar: d.operasyonlar.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const deleteOp = (id) => setData((d) => ({ ...d, operasyonlar: d.operasyonlar.filter((o) => o.id !== id) }));

  const addGelir = (g) => setData((d) => ({ ...d, gelirKalemleri: [...d.gelirKalemleri, { ...g, id: nextId(d.gelirKalemleri) }] }));
  const deleteGelir = (id) => setData((d) => ({ ...d, gelirKalemleri: d.gelirKalemleri.filter((g) => g.id !== id) }));

  const addGider = (g) => setData((d) => ({ ...d, giderKalemleri: [...d.giderKalemleri, { ...g, id: nextId(d.giderKalemleri) }] }));
  const deleteGider = (id) => setData((d) => ({ ...d, giderKalemleri: d.giderKalemleri.filter((g) => g.id !== id) }));

  const addBekleyen = (b) => setData((d) => ({ ...d, bekleyenTahsilatlar: [...d.bekleyenTahsilatlar, { ...b, id: nextId(d.bekleyenTahsilatlar) }] }));
  const deleteBekleyen = (id) => setData((d) => ({ ...d, bekleyenTahsilatlar: d.bekleyenTahsilatlar.filter((b) => b.id !== id) }));

  const addVergi = (v) => setData((d) => ({ ...d, vergiTakvimi: [...d.vergiTakvimi, { ...v, id: nextId(d.vergiTakvimi) }] }));
  const deleteVergi = (id) => setData((d) => ({ ...d, vergiTakvimi: d.vergiTakvimi.filter((v) => v.id !== id) }));

  const addMonth = (m) => setData((d) => ({ ...d, monthly: [...d.monthly, { ...m, net: (Number(m.ciro) || 0) - (Number(m.gider) || 0), id: nextId(d.monthly) }] }));
  const deleteMonth = (id) => setData((d) => ({ ...d, monthly: d.monthly.filter((m) => m.id !== id) }));

  const titles = { dashboard: "Dashboard", musteriler: "Müşteriler", finans: "Finans", operasyon: "Operasyon", ayarlar: "Ayarlar" };
  const todayLabel = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  if (loading || !data) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13.5 }}>Marcus OS yükleniyor…</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
        input:focus, select:focus { border-color: ${T.accent} !important; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
        @media (max-width: 900px) {
          .marcus-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ width: 220, borderRight: `1px solid ${T.borderSoft}`, padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>M</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14.5, color: T.text, letterSpacing: 0.2 }}>Marcus OS</div>
            <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>Marcus Medya</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: tab === key ? T.accentSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <Icon size={16} color={tab === key ? T.accentText : T.textDim} />
              <span style={{ fontSize: 13.5, fontWeight: tab === key ? 600 : 500, color: tab === key ? T.text : T.textDim, fontFamily: "Inter, sans-serif" }}>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", textAlign: "center" }}>
            {saveStatus === "saving" ? "Kaydediliyor…" : saveStatus === "saved" ? "✓ Kaydedildi" : saveStatus === "error" ? "Kaydetme hatası" : ""}
          </div>
          <button onClick={() => openAi()} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #7C6BFA)`, border: "none", cursor: "pointer", width: "100%", color: "#fff" }}>
            <Sparkles size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>AI CEO'ya Sor</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 30px 0" }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 600, color: T.text, margin: 0 }}>{titles[tab]}</h1>
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>{todayLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px" }}>
              <Search size={14} color={T.textFaint} />
              <span style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Ara…</span>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Bell size={15} color={T.textDim} />
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 30px 40px" }}>
          {tab === "dashboard" && <Dashboard data={data} onAsk={() => openAi()} />}
          {tab === "musteriler" && <Musteriler clients={data.clients} onAdd={addClient} onUpdate={updateClient} onDelete={deleteClient} />}
          {tab === "finans" && (
            <Finans
              data={data}
              onAddGelir={addGelir} onDeleteGelir={deleteGelir}
              onAddGider={addGider} onDeleteGider={deleteGider}
              onAddBekleyen={addBekleyen} onDeleteBekleyen={deleteBekleyen}
              onAddVergi={addVergi} onDeleteVergi={deleteVergi}
              onAddMonth={addMonth} onDeleteMonth={deleteMonth}
            />
          )}
          {tab === "operasyon" && <Operasyon operasyonlar={data.operasyonlar} onAdd={addOp} onUpdate={updateOp} onDelete={deleteOp} />}
          {tab === "ayarlar" && <Ayarlar />}
        </div>
      </div>

      {aiOpen && <div onClick={() => setAiOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }} />}
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} initialQuestion={aiQuestion} data={data} />
    </div>
  );
}
