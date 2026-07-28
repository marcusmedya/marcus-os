import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, Wallet, Clapperboard, Settings, Sparkles,
  ArrowUpRight, ArrowDownRight, X, Send, Plus, Pencil, Trash2, Check,
  Film, Scissors, CheckCircle2, Share2, Megaphone, ChevronRight,
  CircleDollarSign, Receipt, Landmark, CalendarClock, Search, Bell, Briefcase, PiggyBank, TrendingUp
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

/**
 * Tüm sekmelerin ortak "gerçek" hesaplaması: Toplam Ciro = aktif/yeni müşterilerin
 * aylık ücretleri (Müşteriler) + ek gelir kalemleri (Finans > Gelirler). Toplam Gider =
 * Finans > Giderler toplamı + müşteri bazlı maliyetler (örn. freelance ödemeleri).
 * Dashboard, Finans ve AI CEO hepsi bu fonksiyonu kullanır, böylece bir sekmede
 * yapılan değişiklik anında diğerlerine yansır.
 */
function computeLive(data) {
  const clients = data.clients || [];
  const activeClients = clients.filter((c) => c.durum !== "ayrildi");
  const recurring = activeClients.reduce((s, c) => s + (Number(c.aylikUcret) || 0), 0);
  const extra = (data.gelirKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ciro = recurring + extra;
  const faturaliRecurring = activeClients.reduce((s, c) => s + clientFaturaliTutar(c), 0);
  const faturaliExtra = (data.gelirKalemleri || []).filter((g) => g.faturali !== "hayir").reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const faturaliCiro = faturaliRecurring + faturaliExtra;
  const faturasizCiro = ciro - faturaliCiro;
  const kdvTutari = Math.round(faturaliCiro * 0.2);
  const kdvDahilToplamCiro = ciro + kdvTutari;
  const faturaliKdvDahil = faturaliCiro + kdvTutari;
  const giderKalemToplam = (data.giderKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ofisGiderToplam = (data.ofisGiderleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const clientCosts = clients.reduce((s, c) => s + (c.maliyetler || []).reduce((s2, m) => s2 + (Number(m.tutar) || 0), 0), 0);
  const personelGideri = (data.personel || []).reduce((s, p) => s + (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0), 0);
  const gider = giderKalemToplam + ofisGiderToplam + clientCosts + personelGideri;
  const net = ciro - gider;
  const manuelBekleyen = (data.bekleyenTahsilatlar || []).reduce((s, b) => s + (Number(b.tutar) || 0), 0);
  const otomatikBekleyen = activeClients.reduce((s, c) => {
    const st = clientPaymentStatus(c);
    if (st && (st.status === "bekliyor" || st.status === "gecikti")) return s + (Number(c.aylikUcret) || 0);
    return s;
  }, 0);
  const bekleyenToplam = manuelBekleyen + otomatikBekleyen;
  const tahsilEdilen = ciro - bekleyenToplam;
  const karMarji = ciro ? Math.round((net / ciro) * 100) : 0;
  return { recurring, extra, ciro, faturaliCiro, faturasizCiro, kdvTutari, kdvDahilToplamCiro, faturaliKdvDahil, giderKalemToplam, ofisGiderToplam, clientCosts, personelGideri, gider, net, manuelBekleyen, otomatikBekleyen, bekleyenToplam, tahsilEdilen, karMarji };
}

/** Bir müşterinin bu ayki ödeme durumunu, kayıtlı "ödeme günü"ne göre otomatik hesaplar. */
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
function clientPaymentStatus(client) {
  if (!client.odemeGunu) return null;
  const today = new Date();
  const curKey = monthKey(today);
  const paidThisMonth = (client.odemeler || []).includes(curKey);
  if (paidThisMonth) return { status: "odendi", label: "Bu ay ödendi" };
  const dueDay = Number(client.odemeGunu);
  const todayDay = today.getDate();
  if (todayDay < dueDay) return { status: "yaklasiyor", label: `Ödeme günü: ayın ${dueDay}'i` };
  const gecikenGun = todayDay - dueDay;
  if (gecikenGun >= 7) return { status: "gecikti", label: `${gecikenGun} gün gecikti` };
  return { status: "bekliyor", label: `Ödeme günü geçti (ayın ${dueDay}'i)` };
}

/** Bir müşterinin aylık ücretinin ne kadarının faturalı olduğunu döndürür (kısmi olabilir).
 * Yeni "faturaliTutar" alanı varsa onu kullanır (aylıkÜcret'i geçemez); yoksa eski evet/hayır
 * alanına bakar (geriye dönük uyumluluk). */
function clientFaturaliTutar(c) {
  const aylik = Number(c.aylikUcret) || 0;
  if (c.faturaliTutar !== undefined && c.faturaliTutar !== null && c.faturaliTutar !== "") {
    return Math.min(Math.max(Number(c.faturaliTutar) || 0, 0), aylik);
  }
  return c.faturali === "hayir" ? 0 : aylik;
}

/** Bir müşterinin kâr marjı: eğer o müşteriye maliyet eklenmişse (aylikUcret - maliyet)/aylikUcret
 * üzerinden otomatik hesaplanır; hiç maliyet eklenmemişse elle girilmiş karMarji alanı kullanılır. */
function clientKarMarji(c) {
  const maliyetToplam = (c.maliyetler || []).reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  if ((c.maliyetler || []).length > 0) {
    return c.aylikUcret ? Math.round(((c.aylikUcret - maliyetToplam) / c.aylikUcret) * 100) : 0;
  }
  return Number(c.karMarji) || 0;
}

/** Şifre koruması: tarayıcıda saklanan şifreyi her API isteğine ekler. Sunucuda SITE_PASSWORD
 * ortam değişkeni tanımlı değilse koruma devre dışıdır (geriye dönük uyumluluk). */
const PW_KEY = "marcus-os-pw";
const getPw = () => (typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "");
const setPw = (v) => { if (typeof window !== "undefined") localStorage.setItem(PW_KEY, v); };
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
    fields.forEach((f) => {
      if (initial && initial[f.key] !== undefined) { v[f.key] = initial[f.key]; return; }
      if (f.type === "number") { v[f.key] = 0; return; }
      if (f.type === "select") { v[f.key] = f.options[0].value; return; }
      v[f.key] = "";
    });
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
    if (!active.length) return null;
    const live = computeLive(data);
    const enKarli = [...active].sort((a, b) => clientKarMarji(b) - clientKarMarji(a))[0];
    const enDusuk = [...active].sort((a, b) => clientKarMarji(a) - clientKarMarji(b))[0];
    const bagimlilik = live.ciro ? Math.round((enKarli.aylikUcret / live.ciro) * 100) : 0;
    return { enKarli, enDusuk, bagimlilik, enDusukMarji: clientKarMarji(enDusuk) };
  }, [data]);

  if (!insight) return null;

  return (
    <div style={{ background: `linear-gradient(90deg, ${T.accentSoft}, transparent 70%)`, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.accentText, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        <Sparkles size={14} /> BUGÜNÜN KARARI
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.text, flex: 1, minWidth: 260 }}>
        <b>{insight.enDusuk.ad}</b> kâr marjın en düşük müşterin (%{insight.enDusukMarji}) — fiyat güncellemesi ya da kapsam gözden geçirmesi gerekebilir.
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
  const { monthly, operasyonlar } = data;
  const live = computeLive(data);
  const prev = monthly.length ? monthly[monthly.length - 1] : null;
  const ciroDelta = prev && prev.ciro ? Number((((live.ciro - prev.ciro) / prev.ciro) * 100).toFixed(1)) : undefined;
  const netDelta = prev && prev.net ? Number((((live.net - prev.net) / prev.net) * 100).toFixed(1)) : undefined;
  const giderDelta = prev && prev.gider ? Number((((live.gider - prev.gider) / prev.gider) * 100).toFixed(1)) : undefined;

  const chartData = [...monthly, { id: "live", ay: "Bu Ay", ciro: live.ciro, gider: live.gider, net: live.net }];
  const opCounts = ["yesil", "turuncu", "kirmizi"].map((k) => ({ key: k, count: operasyonlar.filter((o) => o.durum === k).length }));

  return (
    <div>
      <KararSeridi data={data} onAsk={onAsk} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM CİRO (BU AY)" value={fmt(live.ciro)} delta={ciroDelta} />
        <KpiCard label="NET KAZANÇ" value={fmt(live.net)} delta={netDelta} accent={T.success} />
        <KpiCard label="TOPLAM GİDER" value={fmt(live.gider)} delta={giderDelta} />
        <KpiCard label="KÂR MARJI" value={`%${live.karMarji}`} mono />
        <KpiCard label="TAHSİL EDİLEN" value={fmt(live.tahsilEdilen)} />
        <KpiCard label="BEKLEYEN TAHSİLAT" value={fmt(live.bekleyenToplam)} mono accent={T.warning} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 22 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Ciro & Net Kazanç — Son Aylar + Bu Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ left: -18, right: 8 }}>
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
            {operasyonlar.length === 0 && <div style={{ color: T.textFaint, fontSize: 12.5, fontFamily: "Inter" }}>Henüz operasyon işi eklenmedi.</div>}
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
  { key: "karMarji", label: "Kâr Marjı (%) — müşteri detayında maliyet eklersen otomatik hesaplanır", type: "number" },
  { key: "odemeGunu", label: "Ödeme Günü (ayın kaçı — opsiyonel, örn. 5)", type: "number" },
  { key: "faturaliTutar", label: "Faturalı Tutar (₺/ay) — aylık ücretin ne kadarı faturalı? Kalanı otomatik faturasız sayılır", type: "number" },
  { key: "baslangic", label: "Başlangıç (YYYY-AA)", type: "text", placeholder: "2026-07" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

const CLIENT_DURUM = {
  aktif: { label: "Aktif", color: T.success, soft: T.successSoft },
  yeni: { label: "Yeni", color: T.accentText, soft: T.accentSoft },
  ayrildi: { label: "Ayrıldı", color: T.textFaint, soft: T.borderSoft },
};

function Musteriler({ clients, operasyonlar, bekleyenTahsilatlar, onAdd, onUpdate, onDelete, onAddCost, onDeleteCost, onMarkPaid, onMarkUnpaid, openClient, onOpenClientHandled }) {
  const [filter, setFilter] = useState("hepsi");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailClientId, setDetailClientId] = useState(null);

  useEffect(() => {
    if (openClient) { setDetailClientId(openClient.id); onOpenClientHandled && onOpenClientHandled(); }
    // eslint-disable-next-line
  }, [openClient]);

  const active = clients.filter((c) => c.durum !== "ayrildi");
  const enKarli = active.length ? [...active].sort((a, b) => clientKarMarji(b) - clientKarMarji(a))[0] : null;
  const enDusuk = active.length ? [...active].sort((a, b) => clientKarMarji(a) - clientKarMarji(b))[0] : null;
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
              {["Müşteri", "Kategori", "Durum", "Ödeme", "Aylık Ücret", "Kâr Marjı", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 4 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td colSpan={7} style={{ padding: "12px 16px" }}>
                    <FieldForm fields={CLIENT_FIELDS} initial={{ ...c, faturaliTutar: clientFaturaliTutar(c) }} onSubmit={(v) => { onUpdate(c.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetailClientId(c.id)}>{c.ad}</div>
                    {c.not && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{c.not}</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{c.kategori}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {(() => {
                      const cd = CLIENT_DURUM[c.durum] || CLIENT_DURUM.aktif;
                      return <Pill color={cd.color} soft={cd.soft}>{cd.label}</Pill>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {(() => {
                      const st = clientPaymentStatus(c);
                      if (!st) return <span style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>—</span>;
                      const map = { odendi: { c: T.success, s: T.successSoft, l: "Ödendi" }, yaklasiyor: { c: T.textFaint, s: T.borderSoft, l: "Yaklaşıyor" }, bekliyor: { c: T.warning, s: T.warningSoft, l: "Bekliyor" }, gecikti: { c: T.danger, s: T.dangerSoft, l: "Gecikti" } };
                      const m = map[st.status];
                      return <Pill color={m.c} soft={m.s}>{m.l}</Pill>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {c.aylikUcret ? fmt(c.aylikUcret) : "—"}
                    {c.aylikUcret > 0 && (() => {
                      const ft = clientFaturaliTutar(c);
                      const full = ft >= c.aylikUcret;
                      const none = ft <= 0;
                      const symbol = full ? "●" : none ? "○" : "◐";
                      const title = full ? "Tamamen faturalı (KDV %20)" : none ? "Faturasız" : `Kısmi faturalı: ${fmt(ft)} faturalı, ${fmt(c.aylikUcret - ft)} faturasız`;
                      return <span title={title} style={{ marginLeft: 6, fontSize: 10, color: full ? T.success : none ? T.textFaint : T.warning }}>{symbol}</span>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {(() => {
                      const km = clientKarMarji(c);
                      const color = km >= 55 ? T.success : km >= 35 ? T.warning : T.danger;
                      const hasCosts = (c.maliyetler || []).length > 0;
                      return (
                        <span style={{ color }} title={hasCosts ? "Maliyetlerden otomatik hesaplandı" : undefined}>
                          {c.aylikUcret ? `%${km}` : "—"}{hasCosts && <span style={{ color: T.textFaint, fontSize: 10 }}> •</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={iconBtnStyle} onClick={() => { setEditingId(c.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${c.ad} silinsin mi?`)) onDelete(c.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Bu filtrede müşteri yok.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
        Aylık Ücret yanındaki <span style={{ color: T.success }}>●</span> tamamen faturalı, <span style={{ color: T.warning }}>◐</span> kısmi faturalı, <span>○</span> faturasız demektir.
      </div>

      {detailClientId && (
        <ClientDetail
          client={clients.find((c) => c.id === detailClientId)}
          operasyonlar={operasyonlar.filter((o) => o.musteri === (clients.find((c) => c.id === detailClientId) || {}).ad)}
          bekleyenTahsilatlar={bekleyenTahsilatlar.filter((b) => b.musteri === (clients.find((c) => c.id === detailClientId) || {}).ad)}
          onAddCost={(cost) => onAddCost(detailClientId, cost)}
          onDeleteCost={(costId) => onDeleteCost(detailClientId, costId)}
          onMarkPaid={() => onMarkPaid(detailClientId)}
          onMarkUnpaid={() => onMarkUnpaid(detailClientId)}
          onClose={() => setDetailClientId(null)}
        />
      )}
    </div>
  );
}

const COST_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text", placeholder: "örn. Videographer Payı" },
  { key: "tutar", label: "Tutar (₺/ay)", type: "number" },
];

function ClientDetail({ client, operasyonlar, bekleyenTahsilatlar, onAddCost, onDeleteCost, onMarkPaid, onMarkUnpaid, onClose }) {
  const [addingCost, setAddingCost] = useState(false);
  if (!client) return null;
  const cd = CLIENT_DURUM[client.durum] || CLIENT_DURUM.aktif;
  const bekleyenToplam = bekleyenTahsilatlar.reduce((s, b) => s + (Number(b.tutar) || 0), 0);
  const maliyetler = client.maliyetler || [];
  const maliyetToplam = maliyetler.reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  const km = clientKarMarji(client);
  const paymentStatus = clientPaymentStatus(client);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 560, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 600, color: T.text, margin: 0 }}>{client.ad}</h2>
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginTop: 4 }}>{client.kategori} · {client.baslangic}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} color={T.textFaint} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <Pill color={cd.color} soft={cd.soft}>{cd.label}</Pill>
          <Pill color={T.text} soft={T.borderSoft}>Aylık {fmt(client.aylikUcret)}</Pill>
          <Pill color={km >= 55 ? T.success : km >= 35 ? T.warning : T.danger} soft={T.borderSoft}>Kâr Marjı %{km}{maliyetler.length > 0 && " (otomatik)"}</Pill>
          {(() => {
            const ft = clientFaturaliTutar(client);
            const full = client.aylikUcret > 0 && ft >= client.aylikUcret;
            const none = ft <= 0;
            if (full) return <Pill color={T.success} soft={T.successSoft}>Tamamen Faturalı · KDV %20</Pill>;
            if (none) return <Pill color={T.textFaint} soft={T.borderSoft}>Faturasız</Pill>;
            return <Pill color={T.warning} soft={T.warningSoft}>Kısmi: {fmt(ft)} faturalı / {fmt(client.aylikUcret - ft)} faturasız</Pill>;
          })()}
          {bekleyenToplam > 0 && <Pill color={T.warning} soft={T.warningSoft}>Bekleyen {fmt(bekleyenToplam)}</Pill>}
        </div>

        {client.not && (
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", marginBottom: 20, padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10 }}>{client.not}</div>
        )}

        {paymentStatus && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20, padding: "12px 14px", background: T.surfaceRaised, borderRadius: 12, border: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 3 }}>BU AYIN ÖDEMESİ</div>
              <div style={{ fontSize: 13.5, fontFamily: "Inter", fontWeight: 600, color: paymentStatus.status === "odendi" ? T.success : paymentStatus.status === "gecikti" ? T.danger : paymentStatus.status === "bekliyor" ? T.warning : T.textDim }}>
                {paymentStatus.label}
              </div>
            </div>
            {paymentStatus.status === "odendi" ? (
              <button style={cancelBtnStyle} onClick={onMarkUnpaid}>Geri al</button>
            ) : (
              <button style={saveBtnStyle} onClick={onMarkPaid}><Check size={13} /> Ödendi işaretle</button>
            )}
          </div>
        )}
        {!paymentStatus && (
          <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 20 }}>
            Bu müşteri için ödeme günü tanımlı değil — düzenle butonundan "Ödeme Günü" alanını doldurursan otomatik takip başlar.
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>OPERASYON İŞLERİ ({operasyonlar.length})</div>
          {operasyonlar.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Bu müşteriye ait iş yok.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {operasyonlar.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{o.baslik}</div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{o.tur} · {o.tarih}</div>
                </div>
                <Pill color={durumMap[o.durum].color} soft={durumMap[o.durum].soft}>{durumMap[o.durum].label}</Pill>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>
            MALİYETLER ({maliyetler.length}) <span style={{ opacity: 0.7, fontWeight: 400 }}>— freelance ödemeleri, dış hizmetler vb. Toplam Gider'e otomatik yansır</span>
          </div>
          {maliyetler.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>Bu müşteriye bağlı maliyet yok.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
            {maliyetler.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.kalem}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.text }}>{fmt(m.tutar)}</span>
                  <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu maliyet silinsin mi?")) onDeleteCost(m.id); }}><Trash2 size={13} color={T.danger} /></button>
                </div>
              </div>
            ))}
            {maliyetler.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>
                <span>Toplam</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(maliyetToplam)}</span>
              </div>
            )}
          </div>
          {addingCost ? (
            <FieldForm fields={COST_FIELDS} onSubmit={(v) => { onAddCost(v); setAddingCost(false); }} onCancel={() => setAddingCost(false)} submitLabel="Maliyeti Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingCost(true)}><Plus size={13} /> Maliyet ekle</button>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>BEKLEYEN TAHSİLATLAR ({bekleyenTahsilatlar.length})</div>
          {bekleyenTahsilatlar.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Bekleyen ödeme yok.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {bekleyenTahsilatlar.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div style={{ fontSize: 12.5, color: b.vade.includes("gecikti") ? T.danger : T.textDim, fontFamily: "Inter" }}>{b.vade}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.text }}>{fmt(b.tutar)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FİNANS                                                                */
/* ------------------------------------------------------------------ */
const KALEM_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text" },
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "tekrar", label: "Tekrar", type: "select", options: [{ value: "sabit", label: "Sabit (her ay tekrar eder)" }, { value: "tek seferlik", label: "Tek seferlik (bu ayla sınırlı)" }] },
];
const GELIR_FIELDS = [
  ...KALEM_FIELDS,
  { key: "faturali", label: "Faturalı mı? (KDV %20 otomatik hesaplanır)", type: "select", options: [{ value: "evet", label: "Evet - Faturalı (KDV'li)" }, { value: "hayir", label: "Hayır - Faturasız" }] },
];
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

function Finans({ data, clients, onAddGelir, onDeleteGelir, onAddGider, onDeleteGider, onAddOfisGider, onDeleteOfisGider, onAddBekleyen, onDeleteBekleyen, onAddVergi, onDeleteVergi, onAddMonth, onDeleteMonth, onCloseMonth, onExport }) {
  const { monthly, gelirKalemleri, giderKalemleri, ofisGiderleri, bekleyenTahsilatlar, vergiTakvimi } = data;
  const [addingMonth, setAddingMonth] = useState(false);
  const live = computeLive(data);
  const tahsilatOrani = live.ciro ? Math.round((live.tahsilEdilen / live.ciro) * 100) : 0;
  const chartData = [...monthly, { id: "live", ay: "Bu Ay", ciro: live.ciro, gider: live.gider, net: live.net }];

  const clientNames = (clients || []).filter((c) => c.durum !== "ayrildi").map((c) => c.ad);
  const bekleyenFields = clientNames.length
    ? [
        { key: "musteri", label: "Müşteri", type: "select", options: clientNames.map((n) => ({ value: n, label: n })) },
        { key: "tutar", label: "Tutar (₺)", type: "number" },
        { key: "vade", label: "Vade Durumu", type: "text", placeholder: "örn. bugün / 3 gün gecikti" },
      ]
    : BEKLEYEN_FIELDS;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="NAKİT AKIŞI (BU AY)" value={fmt(live.net)} accent={T.success} />
        <KpiCard label="TAHSİLAT ORANI" value={`%${tahsilatOrani}`} mono />
        <KpiCard label="BEKLEYEN ÖDEME" value={fmt(live.bekleyenToplam)} accent={T.warning} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <KpiCard label="CİRO (KDV HARİÇ)" value={fmt(live.ciro)} accent={T.accentText} />
        <KpiCard label="KDV TUTARI (%20)" value={fmt(live.kdvTutari)} mono accent={T.warning} />
        <KpiCard label="KDV DAHİL TOPLAM" value={fmt(live.kdvDahilToplamCiro)} mono />
      </div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 22 }}>
        Faturalı Ciro (KDV Hariç) {fmt(live.faturaliCiro)} + Faturasız Ciro {fmt(live.faturasizCiro)} = Ciro (KDV Hariç) {fmt(live.ciro)}. KDV sadece faturalı kısım üzerinden hesaplanır ve resmi beyanname yerine geçmez, muhasebecinle teyit et.
      </div>

      <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
        <SectionTitle>Faturalı İşler <span style={{ fontWeight: 400, opacity: 0.7 }}>— bu ciroyu oluşturanlar</span></SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {clients.filter((c) => c.durum !== "ayrildi" && clientFaturaliTutar(c) > 0).map((c) => {
            const ft = clientFaturaliTutar(c);
            const kismi = ft < c.aylikUcret;
            return (
              <div key={"c" + c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{c.ad}</span>
                  <Pill color={T.accentText} soft={T.accentSoft}>Müşteri</Pill>
                  {kismi && <Pill color={T.warning} soft={T.warningSoft}>Kısmi</Pill>}
                </div>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(ft)}</span>
              </div>
            );
          })}
          {gelirKalemleri.filter((g) => g.faturali !== "hayir").map((g) => (
            <div key={"g" + g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{g.kalem}</span>
                <Pill color={T.textFaint} soft={T.borderSoft}>Ek Gelir</Pill>
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          ))}
          {clients.filter((c) => c.durum !== "ayrildi" && clientFaturaliTutar(c) > 0).length === 0 && gelirKalemleri.filter((g) => g.faturali !== "hayir").length === 0 && (
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", padding: "6px 0" }}>Faturalı işaretlenmiş müşteri/gelir yok.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>Faturalı Ciro (KDV Hariç)</span>
              <span style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliCiro)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>+ KDV (%20)</span>
              <span style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.kdvTutari)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontFamily: "Inter", fontWeight: 600, paddingTop: 4, borderTop: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.text }}>= Faturalı Ciro (KDV Dahil)</span>
              <span style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliKdvDahil)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
        <SectionTitle
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button style={cancelBtnStyle} onClick={onExport}>CSV indir</button>
              <button
                style={saveBtnStyle}
                onClick={() => {
                  if (window.confirm("Bu ayı kapatıp arşive eklemek istiyor musun? Tek seferlik gelir/gider kalemleri silinecek, sabit olanlar bir sonraki aya taşınacak.")) onCloseMonth();
                }}
              >
                Ayı Kapat
              </button>
            </div>
          }
        >
          Bu Ayın Ciro & Gider Dağılımı
        </SectionTitle>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Müşteri Aylık Ücretleri <span style={{ opacity: 0.7 }}>(Müşteriler sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.recurring)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Ek Gelirler <span style={{ opacity: 0.7 }}>(aşağıdaki Gelirler listesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.extra)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>= Toplam Ciro</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.accentText, fontWeight: 600, marginTop: 3 }}>{fmt(live.ciro)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Gider Kalemleri</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.giderKalemToplam)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Ofis Giderleri</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.ofisGiderToplam)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Personel Gideri <span style={{ opacity: 0.7 }}>(Personel sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.personelGideri)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Müşteri Maliyetleri <span style={{ opacity: 0.7 }}>(Müşteriler sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.clientCosts)}</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Gelir & Gider — Son Aylar + Bu Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -18, right: 8 }} barGap={4}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} />
              <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
              <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", margin: "10px 0 4px" }}>Geçmiş Ay Arşivi <span style={{ opacity: 0.7 }}>— sadece grafikte görünür, güncel hesaplamayı etkilemez</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {monthly.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < monthly.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.ay}</span>
                <span style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>Ciro {fmt(m.ciro)} · Gider {fmt(m.gider)} · Net {fmt(m.net)}</span>
                <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu ay silinsin mi?")) onDeleteMonth(m.id); }}><Trash2 size={12} color={T.danger} /></button>
              </div>
            ))}
            {monthly.length === 0 && <div style={{ color: T.textFaint, fontSize: 12, fontFamily: "Inter" }}>Henüz geçmiş ay eklenmedi.</div>}
          </div>
          {addingMonth ? (
            <FieldForm fields={MONTH_FIELDS} onSubmit={(v) => { onAddMonth(v); setAddingMonth(false); }} onCancel={() => setAddingMonth(false)} submitLabel="Ayı Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingMonth(true)}><Plus size={13} /> Geçmiş ay ekle (arşiv)</button>
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

      <div style={{ marginBottom: 16 }}>
        <MiniList
          title="Ofis Giderleri"
          icon={<Receipt size={16} color={T.textFaint} />}
          items={ofisGiderleri || []}
          fields={KALEM_FIELDS}
          addLabel="Ofis gideri ekle"
          onAdd={onAddOfisGider}
          onDelete={onDeleteOfisGider}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <MiniList
          title="Gelirler"
          icon={<CircleDollarSign size={16} color={T.textFaint} />}
          items={gelirKalemleri}
          fields={GELIR_FIELDS}
          addLabel="Gelir kalemi ekle"
          onAdd={onAddGelir}
          onDelete={onDeleteGelir}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
                {g.faturali === "hayir" ? <Pill color={T.textFaint} soft={T.borderSoft}>Faturasız</Pill> : <Pill color={T.success} soft={T.successSoft}>Faturalı</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
      </div>

      <MiniList
        title="Bekleyen Tahsilatlar (elle eklenen)"
        icon={<Landmark size={16} color={T.textFaint} />}
        items={bekleyenTahsilatlar}
        fields={bekleyenFields}
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
      {live.otomatikBekleyen > 0 && (
        <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
          + {fmt(live.otomatikBekleyen)} — Müşteriler sekmesinde ödeme günü geçtiği halde "ödendi" işaretlenmemiş müşterilerden otomatik hesaplanan tutar. "Bekleyen Ödeme" KPI'sı bu ikisinin toplamıdır.
        </div>
      )}
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

function Operasyon({ operasyonlar, clients, onAdd, onUpdate, onDelete }) {
  const [addingStage, setAddingStage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const cycleDurum = (d) => (d === "yesil" ? "turuncu" : d === "turuncu" ? "kirmizi" : "yesil");

  const clientNames = (clients || []).filter((c) => c.durum !== "ayrildi").map((c) => c.ad);
  const opFields = (stage) =>
    clientNames.length
      ? [
          { key: "musteri", label: "Müşteri", type: "select", options: clientNames.map((n) => ({ value: n, label: n })) },
          { key: "baslik", label: "İş Başlığı", type: "text" },
          { key: "tarih", label: "Tarih", type: "text", placeholder: "örn. 30 Tem" },
          { key: "durum", label: "Durum", type: "select", options: [{ value: "yesil", label: "Tamamlandı" }, { value: "turuncu", label: "Bekliyor" }, { value: "kirmizi", label: "Gecikti" }] },
        ]
      : OP_FIELDS(stage);

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
                      <FieldForm fields={opFields(stage)} initial={o} onSubmit={(v) => { onUpdate(o.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
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
                  <FieldForm fields={opFields(stage)} initial={{ tur: stage, durum: "turuncu" }} onSubmit={(v) => { onAdd({ ...v, tur: stage }); setAddingStage(null); }} onCancel={() => setAddingStage(null)} submitLabel="Ekle" />
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
/* PERSONEL                                                              */
/* ------------------------------------------------------------------ */
const PERSONEL_FIELDS = [
  { key: "ad", label: "Ad Soyad", type: "text" },
  { key: "pozisyon", label: "Pozisyon", type: "text", placeholder: "örn. Video Editörü" },
  { key: "maas", label: "Net Maaş (₺/ay)", type: "number" },
  { key: "sigorta", label: "SGK / Sigorta (₺/ay)", type: "number" },
  { key: "yemek", label: "Yemek Gideri (₺/ay)", type: "number" },
  { key: "tazminatBirikimi", label: "Kıdem Tazminatı Birikimi (₺/ay, opsiyonel)", type: "number" },
  { key: "baslangic", label: "İşe Başlama (YYYY-AA)", type: "text", placeholder: "2026-01" },
];

function Personel({ personel, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const kisiMaliyet = (p) => (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0);
  const toplam = personel.reduce((s, p) => s + kisiMaliyet(p), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="EKİP BÜYÜKLÜĞÜ" value={personel.length} mono={false} />
        <KpiCard label="TOPLAM PERSONEL GİDERİ (₺/AY)" value={fmt(toplam)} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Personel ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={PERSONEL_FIELDS} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Personeli Ekle" />
        </div>
      )}

      <Card style={{ padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr>
              {["Ad Soyad", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 2 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personel.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={8} style={{ padding: "12px 16px" }}>
                    <FieldForm fields={PERSONEL_FIELDS} initial={p} onSubmit={(v) => { onUpdate(p.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600 }}>{p.ad}</div>
                    {p.baslangic && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{p.baslangic}'den beri</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{p.pozisyon}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.maas)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.sigorta)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{p.yemek ? fmt(p.yemek) : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{p.tazminatBirikimi ? fmt(p.tazminatBirikimi) : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.warning, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{fmt(kisiMaliyet(p))}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={iconBtnStyle} onClick={() => { setEditingId(p.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${p.ad} silinsin mi?`)) onDelete(p.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {personel.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Henüz personel eklenmedi.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
        Buradaki toplam, Dashboard ve Finans'taki Toplam Gider'e otomatik olarak eklenir.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BİRİKİM (Fonlar)                                                      */
/* ------------------------------------------------------------------ */
const FON_FIELDS = [
  { key: "ad", label: "Fon Adı", type: "text", placeholder: "örn. Kıdem Tazminatı Fonu" },
  { key: "hedefTutar", label: "Hedef Tutar (₺, opsiyonel)", type: "number" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];
const HAREKET_FIELDS = [
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "not", label: "Not (opsiyonel)", type: "text", placeholder: "örn. Temmuz ayı payı" },
];

function FonCard({ fon, onDelete, onAddHareket, onDeleteHareket }) {
  const [addingTip, setAddingTip] = useState(null); // "ekleme" | "kullanim" | null
  const bakiye = fon.bakiye || 0;
  const hedef = Number(fon.hedefTutar) || 0;
  const pct = hedef > 0 ? Math.min(100, Math.round((bakiye / hedef) * 100)) : null;
  const hareketler = [...(fon.hareketler || [])].reverse();

  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text }}>{fon.ad}</div>
          {fon.not && <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>{fon.not}</div>}
        </div>
        <button style={iconBtnStyle} onClick={() => { if (window.confirm(`"${fon.ad}" fonu tüm hareketleriyle silinsin mi?`)) onDelete(); }}><Trash2 size={14} color={T.danger} /></button>
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 600, color: bakiye < 0 ? T.danger : T.text, margin: "12px 0 6px" }}>{fmt(bakiye)}</div>

      {hedef > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 6, borderRadius: 999, background: T.borderSoft, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: T.accent, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>%{pct} · Hedef {fmt(hedef)}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button style={{ ...addBtnStyle, flex: 1, justifyContent: "center" }} onClick={() => setAddingTip(addingTip === "ekleme" ? null : "ekleme")}><Plus size={13} /> Para Ekle</button>
        <button style={{ ...cancelBtnStyle, flex: 1 }} onClick={() => setAddingTip(addingTip === "kullanim" ? null : "kullanim")}>− Para Kullan</button>
      </div>

      {addingTip && (
        <div style={{ marginBottom: 14 }}>
          <FieldForm
            fields={HAREKET_FIELDS}
            onSubmit={(v) => { onAddHareket(addingTip, v.tutar, v.not); setAddingTip(null); }}
            onCancel={() => setAddingTip(null)}
            submitLabel={addingTip === "ekleme" ? "Ekle" : "Kullan"}
          />
        </div>
      )}

      {hareketler.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>HAREKETLER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {hareketler.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: T.surfaceRaised, borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 12, fontFamily: "Inter", color: h.tip === "ekleme" ? T.success : T.danger, fontWeight: 600 }}>{h.tip === "ekleme" ? "+" : "−"}{fmt(h.tutar)}</span>
                  <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginLeft: 6 }}>{h.tarih}{h.not ? " · " + h.not : ""}</span>
                </div>
                <button style={iconBtnStyle} onClick={() => onDeleteHareket(h.id)}><Trash2 size={11} color={T.textFaint} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Birikim({ birikimler, onAddFon, onDeleteFon, onAddHareket, onDeleteHareket }) {
  const [adding, setAdding] = useState(false);
  const toplam = birikimler.reduce((s, f) => s + (f.bakiye || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM BİRİKİM (TÜM FONLAR)" value={fmt(toplam)} accent={T.success} />
        <KpiCard label="FON SAYISI" value={birikimler.length} mono={false} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={14} /> Yeni fon ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={FON_FIELDS} onSubmit={(v) => { onAddFon(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Fonu Ekle" />
        </div>
      )}

      {birikimler.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz fon eklenmedi. Kıdem tazminatı, acil müdahale fonu gibi biriktirmek istediğin her şey için ayrı bir fon açabilirsin.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {birikimler.map((f) => (
            <FonCard
              key={f.id}
              fon={f}
              onDelete={() => onDeleteFon(f.id)}
              onAddHareket={(tip, tutar, not) => onAddHareket(f.id, tip, tutar, not)}
              onDeleteHareket={(hareketId) => onDeleteHareket(f.id, hareketId)}
            />
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 16 }}>
        İpucu: Personel sekmesinde bir çalışanın "Kıdem Tazminatı Birikimi" alanı her ay Toplam Gider'e otomatik ekleniyor —
        o parayı fiilen kenara koyduğunda buradaki ilgili fona "Para Ekle" ile işleyerek gerçek bakiyeni takip edebilirsin.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AYARLAR                                                               */
/* ------------------------------------------------------------------ */
function EmailYedekTest() {
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [message, setMessage] = useState("");

  const test = () => {
    setStatus("loading");
    fetch("/api/daily-backup")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setStatus("ok"); setMessage(`Gönderildi: ${res.to}`); }
        else if (res.skipped) { setStatus("error"); setMessage(res.reason); }
        else { setStatus("error"); setMessage(res.error || "Bilinmeyen hata"); }
      })
      .catch(() => { setStatus("error"); setMessage("Bağlantı hatası."); });
  };

  return (
    <div>
      <button style={addBtnStyle} onClick={test} disabled={status === "loading"}>
        {status === "loading" ? "Gönderiliyor…" : "Şimdi Test Et"}
      </button>
      {message && (
        <div style={{ fontSize: 12, fontFamily: "Inter", color: status === "ok" ? T.success : T.warning, marginTop: 8 }}>{message}</div>
      )}
    </div>
  );
}

function YedekGecmisi() {
  const [dates, setDates] = useState(null);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    fetch("/api/backup", { headers: { "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => setDates(res.dates || []))
      .catch(() => setDates([]));
  }, []);

  const restore = (date) => {
    if (!window.confirm(`${date} tarihindeki hale geri dönülsün mü? O tarihten sonra yaptığın değişiklikler kaybolur.`)) return;
    setRestoring(date);
    fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json", "X-Site-Password": getPw() }, body: JSON.stringify({ date }) })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { window.alert("Geri yüklendi. Sayfa yenileniyor…"); window.location.reload(); }
        else { window.alert(res.error || "Geri yükleme başarısız."); setRestoring(null); }
      })
      .catch(() => { window.alert("Bağlantı hatası."); setRestoring(null); });
  };

  if (dates === null) return <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Yükleniyor…</div>;
  if (dates.length === 0) return <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Henüz otomatik yedek oluşmadı — ilk kayıttan itibaren her gün otomatik birikmeye başlayacak.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
      {dates.slice(0, 30).map((d) => (
        <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: T.surfaceRaised, borderRadius: 9 }}>
          <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{d}</span>
          <button style={cancelBtnStyle} disabled={restoring === d} onClick={() => restore(d)}>{restoring === d ? "Geri yükleniyor…" : "Bu tarihe dön"}</button>
        </div>
      ))}
    </div>
  );
}

function Ayarlar({ onExport, onExportJson, onImportJson }) {
  const fileInputRef = useRef(null);
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

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Veri</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Müşteriler, Finans ve Operasyon bölümlerindeki tüm değişiklikler otomatik olarak kaydedilir. Sayfayı kapatıp
          tekrar açtığında en son haliyle karşına çıkar.
        </p>
        <button style={addBtnStyle} onClick={onExport}><Plus size={13} style={{ transform: "rotate(45deg)" }} /> Finans verilerini CSV indir</button>
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Otomatik Günlük Yedekler</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Her kayıt işleminde o günün son hali otomatik olarak sunucuda saklanır (son 30 gün). Bir şey ters giderse
          buradan istediğin tarihe geri dönebilirsin — elle hiçbir şey yapmana gerek yok.
        </p>
        <YedekGecmisi />
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Tam Yedek</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          CSV sadece rapor amaçlıdır ve bazı detayları (müşteri maliyetleri, birikim fonu hareketleri gibi) içermez.
          Her şeyin tam bir kopyasını almak için JSON yedek indir — istediğin an bu dosyadan geri yükleyebilirsin.
          Ayda bir yedek almanı öneririz.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={addBtnStyle} onClick={onExportJson}><Plus size={13} style={{ transform: "rotate(45deg)" }} /> Tam Yedek İndir (JSON)</button>
          <button style={cancelBtnStyle} onClick={() => fileInputRef.current && fileInputRef.current.click()}>Yedekten Geri Yükle</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onImportJson(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>E-posta ile Otomatik Günlük Yedek</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Kurulunca her gün gece 03:00'te tam veri yedeğin otomatik olarak e-postana gönderilir — Upstash'ten tamamen
          bağımsız bir yerde (senin e-posta kutunda) durur. Kurmak için:
        </p>
        <ol style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.9, paddingLeft: 18, marginBottom: 14 }}>
          <li><a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: T.accentText }}>resend.com</a>'da ücretsiz hesap aç</li>
          <li>API Keys'ten bir anahtar oluştur</li>
          <li>Vercel projende Environment Variables'a şunları ekle: <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>RESEND_API_KEY</code> (anahtarın) ve <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>BACKUP_EMAIL</code> (yedeği alacağın e-posta)</li>
          <li>Redeploy et</li>
        </ol>
        <EmailYedekTest />
      </Card>

      <Card style={{ padding: "18px 22px" }}>
        <SectionTitle>Şifre Koruması</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Bu paneli sadece senin açabilmen için Vercel projenin ortam değişkenlerine <code style={{ background: T.surfaceRaised, padding: "2px 6px", borderRadius: 5 }}>SITE_PASSWORD</code> ekleyip
          istediğin şifreyi tanımlayabilirsin. Eklendiğinde site açılışta şifre soracak; eklenmediği sürece koruma
          devre dışıdır.
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
        headers: { "Content-Type": "application/json", "X-Site-Password": getPw() },
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
/* ŞİFRE EKRANI                                                          */
/* ------------------------------------------------------------------ */
function LockScreen({ onSubmit, error, checking }) {
  const [value, setValue] = useState("");
  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{FONTS}</style>
      <div style={{ width: 320, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 18, margin: "0 auto 18px" }}>M</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.text, margin: "0 0 6px" }}>Marcus OS</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, margin: "0 0 20px" }}>Devam etmek için şifreni gir.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit(value)}
          placeholder="Şifre"
          style={{ ...inputStyle, textAlign: "center", marginBottom: 12, padding: "11px 12px" }}
        />
        <button onClick={() => onSubmit(value)} disabled={checking} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", opacity: checking ? 0.6 : 1 }}>
          {checking ? "Kontrol ediliyor…" : "Giriş Yap"}
        </button>
        {error && <div style={{ color: T.danger, fontSize: 12.5, fontFamily: "Inter", marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

function BackupReminder({ onBackupNow, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 380, maxWidth: "100%", padding: "26px 28px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.warningSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <PiggyBank size={20} color={T.warning} />
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16.5, fontWeight: 600, color: T.text, margin: "0 0 8px" }}>Yedek alma zamanı</h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.6, margin: "0 0 20px" }}>
          Verilerini düzenli yedeklemen için hatırlatıyoruz. Tek tıkla tam bir yedek indirebilirsin — bu, bilgisayarına iner ve verinin ekstra bir güvenli kopyası olur.
        </p>
        <button onClick={onBackupNow} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", marginBottom: 10 }}>
          <Plus size={13} style={{ transform: "rotate(45deg)" }} /> Şimdi Yedek Al
        </button>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: T.textFaint, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer", padding: "6px" }}>
          1 saat sonra tekrar sor
        </button>
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
  { key: "personel", label: "Personel", icon: Briefcase },
  { key: "birikim", label: "Birikim", icon: PiggyBank },
  { key: "ayarlar", label: "Ayarlar", icon: Settings },
];

export default function MarcusOS() {
  const [tab, setTab] = useState("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailClientFromSearch, setDetailClientFromSearch] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  const loadData = (isRetry) => {
    if (isRetry) setAuthChecking(true);
    else setLoading(true);
    setLoadError(false);
    fetch("/api/data", { headers: { "X-Site-Password": getPw() } })
      .then(async (r) => {
        if (r.status === 401) {
          setNeedsAuth(true);
          if (isRetry) setAuthError("Yanlış şifre, tekrar dener misin?");
          return;
        }
        if (!r.ok) {
          // Sunucu/veritabanı hatası: ASLA demo veriyle üzerine yazma, sadece hata göster.
          setLoadError(true);
          return;
        }
        const res = await r.json();
        // res.data === null burada gerçekten "daha önce hiç kayıt yapılmamış" anlamına gelir,
        // bu yüzden sadece bu durumda demo veriyle başlamak güvenlidir.
        setData(res.data || DEFAULT_DATA);
        setNeedsAuth(false);
        setAuthError("");
      })
      .catch(() => setLoadError(true)) // ağ hatası — data state'ine ASLA dokunma
      .finally(() => { setLoading(false); setAuthChecking(false); });
  };

  useEffect(() => { loadData(false); }, []);

  const handleAuthSubmit = (pw) => {
    setPw(pw);
    loadData(true);
  };

  useEffect(() => {
    if (!data) return;
    if (skipNextSave.current) { skipNextSave.current = false; }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json", "X-Site-Password": getPw() }, body: JSON.stringify({ data }) })
        .then(() => { setSaveStatus("saved"); setLastSavedAt(new Date()); })
        .catch(() => setSaveStatus("error"));
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line
  }, [data]);

  const openAi = (q) => { setAiQuestion(q || null); setAiOpen(true); };

  // ---- CRUD handlers ----
  const addClient = (c) => setData((d) => ({ ...d, clients: [...d.clients, { ...c, maliyetler: [], odemeler: [], id: nextId(d.clients) }] }));
  const updateClient = (id, patch) => setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const deleteClient = (id) => setData((d) => ({ ...d, clients: d.clients.filter((c) => c.id !== id) }));

  const addClientCost = (clientId, cost) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, maliyetler: [...(c.maliyetler || []), { ...cost, id: nextId(c.maliyetler || []) }] } : c)),
  }));
  const deleteClientCost = (clientId, costId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, maliyetler: (c.maliyetler || []).filter((m) => m.id !== costId) } : c)),
  }));

  const markClientPaid = (clientId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, odemeler: [...(c.odemeler || []).filter((m) => m !== monthKey()), monthKey()] } : c)),
  }));
  const markClientUnpaid = (clientId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, odemeler: (c.odemeler || []).filter((m) => m !== monthKey()) } : c)),
  }));

  const addOp = (o) => setData((d) => ({ ...d, operasyonlar: [...d.operasyonlar, { ...o, id: nextId(d.operasyonlar) }] }));
  const updateOp = (id, patch) => setData((d) => ({ ...d, operasyonlar: d.operasyonlar.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const deleteOp = (id) => setData((d) => ({ ...d, operasyonlar: d.operasyonlar.filter((o) => o.id !== id) }));

  const addGelir = (g) => setData((d) => ({ ...d, gelirKalemleri: [...d.gelirKalemleri, { ...g, id: nextId(d.gelirKalemleri) }] }));
  const deleteGelir = (id) => setData((d) => ({ ...d, gelirKalemleri: d.gelirKalemleri.filter((g) => g.id !== id) }));

  const addGider = (g) => setData((d) => ({ ...d, giderKalemleri: [...d.giderKalemleri, { ...g, id: nextId(d.giderKalemleri) }] }));
  const deleteGider = (id) => setData((d) => ({ ...d, giderKalemleri: d.giderKalemleri.filter((g) => g.id !== id) }));

  const addOfisGider = (g) => setData((d) => ({ ...d, ofisGiderleri: [...(d.ofisGiderleri || []), { ...g, id: nextId(d.ofisGiderleri || []) }] }));
  const deleteOfisGider = (id) => setData((d) => ({ ...d, ofisGiderleri: (d.ofisGiderleri || []).filter((g) => g.id !== id) }));

  const addBekleyen = (b) => setData((d) => ({ ...d, bekleyenTahsilatlar: [...d.bekleyenTahsilatlar, { ...b, id: nextId(d.bekleyenTahsilatlar) }] }));
  const deleteBekleyen = (id) => setData((d) => ({ ...d, bekleyenTahsilatlar: d.bekleyenTahsilatlar.filter((b) => b.id !== id) }));

  const addVergi = (v) => setData((d) => ({ ...d, vergiTakvimi: [...d.vergiTakvimi, { ...v, id: nextId(d.vergiTakvimi) }] }));
  const deleteVergi = (id) => setData((d) => ({ ...d, vergiTakvimi: d.vergiTakvimi.filter((v) => v.id !== id) }));

  const addMonth = (m) => setData((d) => ({ ...d, monthly: [...d.monthly, { ...m, net: (Number(m.ciro) || 0) - (Number(m.gider) || 0), id: nextId(d.monthly) }] }));
  const deleteMonth = (id) => setData((d) => ({ ...d, monthly: d.monthly.filter((m) => m.id !== id) }));

  const addPersonel = (p) => setData((d) => ({ ...d, personel: [...(d.personel || []), { ...p, id: nextId(d.personel || []) }] }));
  const updatePersonel = (id, patch) => setData((d) => ({ ...d, personel: (d.personel || []).map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const deletePersonel = (id) => setData((d) => ({ ...d, personel: (d.personel || []).filter((p) => p.id !== id) }));

  const addFon = (f) => setData((d) => ({ ...d, birikimler: [...(d.birikimler || []), { ...f, bakiye: 0, hareketler: [], id: nextId(d.birikimler || []) }] }));
  const deleteFon = (id) => setData((d) => ({ ...d, birikimler: (d.birikimler || []).filter((f) => f.id !== id) }));
  const addFonHareket = (fonId, tip, tutar, not) => setData((d) => ({
    ...d,
    birikimler: (d.birikimler || []).map((f) => {
      if (f.id !== fonId) return f;
      const miktar = Number(tutar) || 0;
      const delta = tip === "ekleme" ? miktar : -miktar;
      const hareket = { id: nextId(f.hareketler || []), tip, tutar: miktar, tarih: new Date().toLocaleDateString("tr-TR"), not: not || "" };
      return { ...f, bakiye: (f.bakiye || 0) + delta, hareketler: [...(f.hareketler || []), hareket] };
    }),
  }));
  const deleteFonHareket = (fonId, hareketId) => setData((d) => ({
    ...d,
    birikimler: (d.birikimler || []).map((f) => {
      if (f.id !== fonId) return f;
      const h = (f.hareketler || []).find((x) => x.id === hareketId);
      if (!h) return f;
      const delta = h.tip === "ekleme" ? -h.tutar : h.tutar;
      return { ...f, bakiye: (f.bakiye || 0) + delta, hareketler: (f.hareketler || []).filter((x) => x.id !== hareketId) };
    }),
  }));

  const closeMonth = () => setData((d) => {
    const live = computeLive(d);
    const ayAdi = new Date().toLocaleDateString("tr-TR", { month: "short" });
    const newMonthly = [...d.monthly, { id: nextId(d.monthly), ay: ayAdi, ciro: live.ciro, gider: live.gider, net: live.net }];
    return {
      ...d,
      monthly: newMonthly,
      gelirKalemleri: d.gelirKalemleri.filter((g) => g.tekrar !== "tek seferlik"),
      giderKalemleri: d.giderKalemleri.filter((g) => g.tekrar !== "tek seferlik"),
    };
  });

  const exportCsv = () => {
    const live = computeLive(data);
    const rows = [
      ["MARCUS OS - FİNANS RAPORU", new Date().toLocaleDateString("tr-TR")],
      [],
      ["Bu Ayın Özeti"],
      ["Toplam Ciro", live.ciro], ["Toplam Gider", live.gider], ["Net Kazanç", live.net], ["Kâr Marjı %", live.karMarji],
      ["Faturalı Ciro (KDV Hariç)", live.faturaliCiro], ["Faturasız Ciro", live.faturasizCiro],
      ["KDV Tutarı (%20)", live.kdvTutari], ["Faturalı Ciro (KDV Dahil)", live.faturaliKdvDahil], ["Ciro (KDV Dahil Toplam)", live.kdvDahilToplamCiro],
      [],
      ["Personel", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam"],
      ...(data.personel || []).map((p) => [p.ad, p.pozisyon, p.maas, p.sigorta, p.yemek || 0, p.tazminatBirikimi || 0, (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0)]),
      [],
      ["Birikim Fonları", "Hedef", "Mevcut Bakiye"],
      ...(data.birikimler || []).map((f) => [f.ad, f.hedefTutar || 0, f.bakiye || 0]),
      [],
      ["Müşteriler", "Kategori", "Durum", "Aylık Ücret", "Kâr Marjı %", "Ödeme Durumu", "Faturalı Tutar"],
      ...data.clients.map((c) => { const st = clientPaymentStatus(c); return [c.ad, c.kategori, c.durum, c.aylikUcret, clientKarMarji(c), st ? st.label : "Takip edilmiyor", clientFaturaliTutar(c)]; }),
      [],
      ["Müşteri Maliyetleri", "Kalem", "Tutar"],
      ...data.clients.flatMap((c) => (c.maliyetler || []).map((m) => [c.ad, m.kalem, m.tutar])),
      [],
      ["Gelir Kalemleri", "Tutar", "Tekrar"],
      ...data.gelirKalemleri.map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Gider Kalemleri", "Tutar", "Tekrar"],
      ...data.giderKalemleri.map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Ofis Giderleri", "Tutar", "Tekrar"],
      ...(data.ofisGiderleri || []).map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Bekleyen Tahsilatlar", "Tutar", "Vade"],
      ...data.bekleyenTahsilatlar.map((b) => [b.musteri, b.tutar, b.vade]),
      [],
      ["Geçmiş Aylar", "Ciro", "Gider", "Net"],
      ...data.monthly.map((m) => [m.ay, m.ciro, m.gider, m.net]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcus-os-finans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const now = new Date().toISOString();
    const payload = { ...data, sonYedekTarihi: now };
    setData(payload);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcus-os-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.clients)) throw new Error("Geçersiz dosya");
        if (!window.confirm("Bu, mevcut tüm verilerinin üzerine yazacak. Devam etmek istiyor musun?")) return;
        setData(parsed);
      } catch (err) {
        window.alert("Dosya okunamadı. Geçerli bir Marcus OS yedek dosyası (.json) seçtiğinden emin ol.");
      }
    };
    reader.readAsText(file);
  };

  // Saatlik yedekleme hatırlatıcısı: uygulama açık kaldığı sürece her saat başı,
  // ayrıca sayfa yeni açıldığında son yedek 1 saatten eskiyse birkaç dakika içinde de gösterir.
  useEffect(() => {
    if (!data) return;
    const HOUR = 60 * 60 * 1000;
    const sonYedek = data.sonYedekTarihi ? new Date(data.sonYedekTarihi).getTime() : 0;
    const gecenSure = Date.now() - sonYedek;
    const ilkGosterim = setTimeout(() => setShowBackupReminder(true), gecenSure >= HOUR ? 3 * 60 * 1000 : Math.max(HOUR - gecenSure, 5 * 60 * 1000));
    const interval = setInterval(() => setShowBackupReminder(true), HOUR);
    return () => { clearTimeout(ilkGosterim); clearInterval(interval); };
    // eslint-disable-next-line
  }, [!!data]);

  const notifications = useMemo(() => {
    if (!data) return [];
    const items = [];
    data.clients.filter((c) => c.durum !== "ayrildi").forEach((c) => {
      const st = clientPaymentStatus(c);
      if (st && st.status === "gecikti") items.push({ text: `${c.ad}: ödeme ${st.label}`, level: "danger" });
      else if (st && st.status === "bekliyor") items.push({ text: `${c.ad}: ${st.label}`, level: "warning" });
    });
    data.operasyonlar.filter((o) => o.durum === "kirmizi").forEach((o) => items.push({ text: `${o.baslik} (${o.musteri}) gecikti`, level: "danger" }));
    data.vergiTakvimi.filter((v) => v.durum === "yaklaşıyor").forEach((v) => items.push({ text: `${v.kalem} — ${v.tarih}`, level: "warning" }));
    data.bekleyenTahsilatlar.filter((b) => b.vade.includes("gecikti")).forEach((b) => items.push({ text: `${b.musteri}: bekleyen tahsilat ${b.vade}`, level: "danger" }));
    return items;
  }, [data]);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!data || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    const results = [];
    data.clients.forEach((c) => { if (c.ad.toLowerCase().includes(q)) results.push({ type: "musteri", label: c.ad, sub: c.kategori, ref: c }); });
    data.operasyonlar.forEach((o) => { if (o.baslik.toLowerCase().includes(q) || o.musteri.toLowerCase().includes(q)) results.push({ type: "operasyon", label: o.baslik, sub: o.musteri, ref: o }); });
    data.gelirKalemleri.forEach((g) => { if (g.kalem.toLowerCase().includes(q)) results.push({ type: "finans", label: g.kalem, sub: "Gelir · " + fmt(g.tutar), ref: g }); });
    data.giderKalemleri.forEach((g) => { if (g.kalem.toLowerCase().includes(q)) results.push({ type: "finans", label: g.kalem, sub: "Gider · " + fmt(g.tutar), ref: g }); });
    (data.personel || []).forEach((p) => { if (p.ad.toLowerCase().includes(q) || (p.pozisyon || "").toLowerCase().includes(q)) results.push({ type: "personel", label: p.ad, sub: p.pozisyon, ref: p }); });
    return results.slice(0, 8);
  }, [data, search]);

  const goToSearchResult = (r) => {
    setSearch(""); setSearchOpen(false);
    if (r.type === "musteri") { setTab("musteriler"); setDetailClientFromSearch(r.ref); }
    else if (r.type === "operasyon") setTab("operasyon");
    else if (r.type === "personel") setTab("personel");
    else setTab("finans");
  };

  const titles = { dashboard: "Dashboard", musteriler: "Müşteriler", finans: "Finans", operasyon: "Operasyon", personel: "Personel", birikim: "Birikim", ayarlar: "Ayarlar" };
  const todayLabel = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  if (needsAuth) {
    return <LockScreen onSubmit={handleAuthSubmit} error={authError} checking={authChecking} />;
  }

  if (loadError) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ color: T.danger, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Verilerine ulaşılamadı</div>
          <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
            Sunucuya bağlanırken bir sorun oluştu. Endişelenme — mevcut verilerinin üzerine hiçbir şey yazılmadı. İnternet bağlantını kontrol edip tekrar dene.
          </div>
          <button style={saveBtnStyle} onClick={() => loadData(false)}>Tekrar Dene</button>
        </div>
      </div>
    );
  }

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
          <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", textAlign: "center", lineHeight: 1.6, padding: "8px 6px", background: T.surface, borderRadius: 9, border: `1px solid ${T.borderSoft}` }}>
            <div>
              {saveStatus === "saving" ? "Kaydediliyor…" : saveStatus === "saved" ? "✓ Kaydedildi" : saveStatus === "error" ? "⚠ Kaydetme hatası" : "…"}
              {lastSavedAt && saveStatus === "saved" && ` · ${lastSavedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
            <div style={{ marginTop: 2 }}>
              {(() => {
                if (!data.sonYedekTarihi) return <span style={{ color: T.warning }}>Hiç tam yedek alınmadı</span>;
                const gun = Math.floor((Date.now() - new Date(data.sonYedekTarihi).getTime()) / 86400000);
                const metin = gun <= 0 ? "Bugün yedeklendi" : gun === 1 ? "1 gün önce yedeklendi" : `${gun} gün önce yedeklendi`;
                return <span style={{ color: gun > 14 ? T.warning : T.textFaint }}>Son yedek: {metin}</span>;
              })()}
            </div>
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
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", width: 220 }}>
                <Search size={14} color={T.textFaint} />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Müşteri, iş, kalem ara…"
                  style={{ border: "none", outline: "none", background: "transparent", color: T.text, fontSize: 12.5, fontFamily: "Inter, sans-serif", width: "100%" }}
                />
              </div>
              {searchOpen && search.trim() && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 280, background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 30, overflow: "hidden" }}>
                  {searchResults.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Sonuç yok.</div>}
                  {searchResults.map((r, i) => (
                    <div key={i} onMouseDown={() => goToSearchResult(r)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < searchResults.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{r.sub}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setNotifOpen((v) => !v)}
                style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
              >
                <Bell size={15} color={T.textDim} />
                {notifications.length > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: T.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: "0 3px" }}>
                    {notifications.length}
                  </span>
                )}
              </div>
              {notifOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 300, background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 30, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
                  <div style={{ padding: "10px 14px", fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>BİLDİRİMLER</div>
                  {notifications.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Her şey yolunda, bekleyen bir şey yok.</div>}
                  {notifications.map((n, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderBottom: i < notifications.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: n.level === "danger" ? T.danger : T.warning, marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", lineHeight: 1.5 }}>{n.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 30px 40px" }}>
          {tab === "dashboard" && <Dashboard data={data} onAsk={() => openAi()} />}
          {tab === "musteriler" && (
            <Musteriler
              clients={data.clients}
              operasyonlar={data.operasyonlar}
              bekleyenTahsilatlar={data.bekleyenTahsilatlar}
              onAdd={addClient} onUpdate={updateClient} onDelete={deleteClient}
              onAddCost={addClientCost} onDeleteCost={deleteClientCost}
              onMarkPaid={markClientPaid} onMarkUnpaid={markClientUnpaid}
              openClient={detailClientFromSearch}
              onOpenClientHandled={() => setDetailClientFromSearch(null)}
            />
          )}
          {tab === "finans" && (
            <Finans
              data={data}
              clients={data.clients}
              onAddGelir={addGelir} onDeleteGelir={deleteGelir}
              onAddGider={addGider} onDeleteGider={deleteGider}
              onAddOfisGider={addOfisGider} onDeleteOfisGider={deleteOfisGider}
              onAddBekleyen={addBekleyen} onDeleteBekleyen={deleteBekleyen}
              onAddVergi={addVergi} onDeleteVergi={deleteVergi}
              onAddMonth={addMonth} onDeleteMonth={deleteMonth}
              onCloseMonth={closeMonth}
              onExport={exportCsv}
            />
          )}
          {tab === "operasyon" && <Operasyon operasyonlar={data.operasyonlar} clients={data.clients} onAdd={addOp} onUpdate={updateOp} onDelete={deleteOp} />}
          {tab === "personel" && <Personel personel={data.personel || []} onAdd={addPersonel} onUpdate={updatePersonel} onDelete={deletePersonel} />}
          {tab === "birikim" && (
            <Birikim
              birikimler={data.birikimler || []}
              onAddFon={addFon}
              onDeleteFon={deleteFon}
              onAddHareket={addFonHareket}
              onDeleteHareket={deleteFonHareket}
            />
          )}
          {tab === "ayarlar" && <Ayarlar onExport={exportCsv} onExportJson={exportJson} onImportJson={importJson} />}
        </div>
      </div>

      {aiOpen && <div onClick={() => setAiOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }} />}
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} initialQuestion={aiQuestion} data={{ ...data, buAyinGercekDurumu: computeLive(data) }} />
      {showBackupReminder && (
        <BackupReminder
          onBackupNow={() => { exportJson(); setShowBackupReminder(false); }}
          onDismiss={() => setShowBackupReminder(false)}
        />
      )}
    </div>
  );
}
