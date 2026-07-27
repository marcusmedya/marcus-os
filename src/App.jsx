import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, Wallet, Clapperboard, Settings, Sparkles,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, X, Send,
  Film, Scissors, CheckCircle2, Share2, Megaphone, ChevronRight,
  CircleDollarSign, Receipt, Landmark, CalendarClock, Plus, Search,
  Bell, ChevronDown
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

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

/* ------------------------------------------------------------------ */
/* DEMO DATA                                                           */
/* ------------------------------------------------------------------ */
const monthly = [
  { ay: "Şub", ciro: 168000, gider: 98000, net: 70000 },
  { ay: "Mar", ciro: 182000, gider: 101000, net: 81000 },
  { ay: "Nis", ciro: 176000, gider: 104000, net: 72000 },
  { ay: "May", ciro: 195000, gider: 108000, net: 87000 },
  { ay: "Haz", ciro: 210000, gider: 112000, net: 98000 },
  { ay: "Tem", ciro: 231000, gider: 119000, net: 112000 },
];

const clients = [
  { id: 1, ad: "Nova Teknoloji", kategori: "Yazılım", durum: "aktif", aylikUcret: 58000, karMarji: 71, baslangic: "2024-11", not: "En kârlı müşteri" },
  { id: 2, ad: "Lezzet Sofrası", kategori: "Restoran Zinciri", durum: "aktif", aylikUcret: 45000, karMarji: 62, baslangic: "2024-06" },
  { id: 3, ad: "UrbanFit Spor Kulübü", kategori: "Spor & Wellness", durum: "aktif", aylikUcret: 32000, karMarji: 55, baslangic: "2025-01" },
  { id: 4, ad: "Mavi Deniz Otelcilik", kategori: "Turizm", durum: "yeni", aylikUcret: 40000, karMarji: 48, baslangic: "2026-06" },
  { id: 5, ad: "Yeşil Bahçe Peyzaj", kategori: "Peyzaj & Bahçe", durum: "aktif", aylikUcret: 18000, karMarji: 28, baslangic: "2025-03", not: "En düşük kârlı müşteri" },
  { id: 6, ad: "Altın Kuyumcu", kategori: "Perakende", durum: "ayrildi", aylikUcret: 0, karMarji: 0, baslangic: "2024-02" },
];

const operasyonlar = [
  { id: 1, musteri: "Nova Teknoloji", tur: "Çekim", baslik: "Ürün lansman filmi", durum: "yesil", tarih: "28 Tem" },
  { id: 2, musteri: "Lezzet Sofrası", tur: "Edit", baslik: "Temmuz reels paketi", durum: "turuncu", tarih: "29 Tem" },
  { id: 3, musteri: "UrbanFit Spor Kulübü", tur: "Onay", baslik: "Antrenman serisi v2", durum: "kirmizi", tarih: "26 Tem" },
  { id: 4, musteri: "Mavi Deniz Otelcilik", tur: "Çekim", baslik: "Otel tanıtım drone çekimi", durum: "turuncu", tarih: "30 Tem" },
  { id: 5, musteri: "Yeşil Bahçe Peyzaj", tur: "Paylaşım", baslik: "Instagram öncesi/sonrası", durum: "yesil", tarih: "27 Tem" },
  { id: 6, musteri: "Nova Teknoloji", tur: "Reklam", baslik: "Meta Ads - lansman kampanyası", durum: "turuncu", tarih: "31 Tem" },
  { id: 7, musteri: "Lezzet Sofrası", tur: "Onay", baslik: "Menü tanıtım videosu", durum: "kirmizi", tarih: "25 Tem" },
  { id: 8, musteri: "UrbanFit Spor Kulübü", tur: "Edit", baslik: "Üyelik kampanya videosu", durum: "yesil", tarih: "28 Tem" },
];

const gelirKalemleri = [
  { kalem: "Aylık Yönetim Bedelleri", tutar: 193000 },
  { kalem: "Proje Bazlı Çekimler", tutar: 28000 },
  { kalem: "Reklam Yönetim Komisyonu", tutar: 10000 },
];
const giderKalemleri = [
  { kalem: "Personel Maaşları", tutar: 68000 },
  { kalem: "Ekipman & Kiralama", tutar: 14000 },
  { kalem: "Reklam Harcaması (Müşteri Adına)", tutar: 22000 },
  { kalem: "Ofis & Sabit Giderler", tutar: 9000 },
  { kalem: "Yazılım & Araçlar", tutar: 6000 },
];
const bekleyenTahsilatlar = [
  { musteri: "Mavi Deniz Otelcilik", tutar: 40000, vade: "3 gün gecikti" },
  { musteri: "Yeşil Bahçe Peyzaj", tutar: 18000, vade: "bugün" },
];
const vergiTakvimi = [
  { kalem: "KDV Beyannamesi", tarih: "26 Ağu", durum: "yaklaşıyor" },
  { kalem: "Muhtasar Beyanname", tarih: "26 Ağu", durum: "yaklaşıyor" },
  { kalem: "Geçici Vergi (3. Dönem)", tarih: "17 Kas", durum: "planlandı" },
];

const durumMap = {
  yesil: { label: "Tamamlandı", color: T.success, soft: T.successSoft },
  turuncu: { label: "Bekliyor", color: T.warning, soft: T.warningSoft },
  kirmizi: { label: "Gecikti", color: T.danger, soft: T.dangerSoft },
};
const opIcon = { Çekim: Film, Edit: Scissors, Onay: CheckCircle2, Paylaşım: Share2, Reklam: Megaphone };

const fmt = (n) => "₺" + n.toLocaleString("tr-TR");
const fmtShort = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + "b" : n);

/* ------------------------------------------------------------------ */
/* SMALL UI PRIMITIVES                                                 */
/* ------------------------------------------------------------------ */
function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Pill({ color, soft, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: soft,
        padding: "4px 10px",
        borderRadius: 999,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {children}
    </span>
  );
}

function KpiCard({ label, value, mono = true, delta, deltaYoy, accent }) {
  const up = delta >= 0;
  return (
    <Card style={{ padding: "18px 20px", flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: 0.2, marginBottom: 10 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: accent || T.text,
          fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif",
          marginBottom: 10,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: up ? T.success : T.danger, fontFamily: "Inter, sans-serif" }}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta)}% geçen aya göre
          </span>
          {deltaYoy !== undefined && (
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter, sans-serif" }}>
              yıllık {deltaYoy >= 0 ? "+" : ""}{deltaYoy}%
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text, margin: 0, letterSpacing: 0.1 }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KARAR ŞERİDİ  (signature element)                                   */
/* ------------------------------------------------------------------ */
function KararSeridi({ onAsk }) {
  const insight = useMemo(() => {
    const enKarli = clients.filter(c => c.durum !== "ayrildi").sort((a, b) => b.karMarji - a.karMarji)[0];
    const enDusuk = clients.filter(c => c.durum !== "ayrildi").sort((a, b) => a.karMarji - b.karMarji)[0];
    const bagimlilik = Math.round((enKarli.aylikUcret / monthly[monthly.length - 1].ciro) * 100);
    return { enKarli, enDusuk, bagimlilik };
  }, []);

  return (
    <div
      style={{
        background: `linear-gradient(90deg, ${T.accentSoft}, transparent 70%)`,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "13px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 22,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.accentText, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        <Sparkles size={14} /> BUGÜNÜN KARARI
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.text, flex: 1, minWidth: 260 }}>
        <b>{insight.enDusuk.ad}</b> kâr marjın en düşük müşterin (%{insight.enDusuk.karMarji}) — fiyat güncellemesi ya da kapsam gözden geçirmesi gerekebilir.
        Ciron'un %{insight.bagimlilik}'i tek müşteriye ({insight.enKarli.ad}) bağlı.
      </div>
      <button
        onClick={onAsk}
        style={{
          background: T.accent, color: "#fff", border: "none", borderRadius: 999,
          padding: "8px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        AI CEO'ya sor <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DASHBOARD                                                            */
/* ------------------------------------------------------------------ */
function Dashboard({ onAsk }) {
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const ciroDelta = (((last.ciro - prev.ciro) / prev.ciro) * 100).toFixed(1);
  const netDelta = (((last.net - prev.net) / prev.net) * 100).toFixed(1);
  const giderDelta = (((last.gider - prev.gider) / prev.gider) * 100).toFixed(1);
  const karMarji = ((last.net / last.ciro) * 100).toFixed(0);
  const tahsilEdilen = last.ciro - bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0);
  const bekleyenToplam = bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0);

  const opCounts = ["yesil", "turuncu", "kirmizi"].map(k => ({
    key: k, count: operasyonlar.filter(o => o.durum === k).length,
  }));

  return (
    <div>
      <KararSeridi onAsk={onAsk} />

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
          <SectionTitle>Ciro & Net Kazanç — Son 6 Ay</SectionTitle>
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
              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }}
                labelStyle={{ color: T.text }}
              />
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
              const pct = Math.round((count / operasyonlar.length) * 100);
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
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginBottom: 8, fontWeight: 600 }}>HIZLI İŞLEMLER</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Yeni işlem ekle", "Bekleyen tahsilat gönder", "Aylık rapor oluştur"].map((a) => (
                <button
                  key={a}
                  style={{
                    background: T.surfaceRaised, border: `1px solid ${T.border}`, color: T.text,
                    borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "Inter, sans-serif",
                    textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  {a} <ChevronRight size={14} color={T.textFaint} />
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ padding: "20px 22px" }}>
        <SectionTitle action={<Pill color={T.accentText} soft={T.accentSoft}><Sparkles size={11} /> AI</Pill>}>
          AI CEO Özeti
        </SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Temmuz ayında ciron geçen aya göre %{ciroDelta} arttı, esas itici güç Nova Teknoloji'nin genişletilmiş
          reklam yönetimi kapsamı oldu. Kâr marjın %{karMarji} ile son 6 ayın en yükseği. Tek risk noktası: Yeşil
          Bahçe Peyzaj kâr marjı %28'e geriledi — kapsam ile ücret uyumsuz. Ağustos'ta KDV ve muhtasar
          beyannameler 26'sında birleşiyor, nakit ayırmayı unutma.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MÜŞTERİLER                                                           */
/* ------------------------------------------------------------------ */
function Musteriler() {
  const [filter, setFilter] = useState("hepsi");
  const active = clients.filter(c => c.durum !== "ayrildi");
  const enKarli = [...active].sort((a, b) => b.karMarji - a.karMarji)[0];
  const enDusuk = [...active].sort((a, b) => a.karMarji - b.karMarji)[0];
  const ortalamaGelir = Math.round(active.reduce((s, c) => s + c.aylikUcret, 0) / active.length);

  const filtered = clients.filter(c => filter === "hepsi" ? true : c.durum === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="AKTİF MÜŞTERİ" value={clients.filter(c => c.durum === "aktif").length} mono={false} />
        <KpiCard label="YENİ MÜŞTERİ" value={clients.filter(c => c.durum === "yeni").length} mono={false} accent={T.success} />
        <KpiCard label="MÜŞTERİ BAŞI ORT. GELİR" value={fmt(ortalamaGelir)} />
        <KpiCard label="EN KÂRLI" value={enKarli.ad} mono={false} accent={T.success} />
        <KpiCard label="EN DÜŞÜK KÂRLI" value={enDusuk.ad} mono={false} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["hepsi", "Hepsi"], ["aktif", "Aktif"], ["yeni", "Yeni"], ["ayrildi", "Ayrılan"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                background: filter === k ? T.accentSoft : "transparent",
                color: filter === k ? T.accentText : T.textDim,
                border: "none", borderRadius: 8, padding: "7px 14px",
                fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr>
              {["Müşteri", "Kategori", "Durum", "Aylık Ücret", "Kâr Marjı", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 3 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const dMap = { aktif: { l: "Aktif", c: T.success, s: T.successSoft }, yeni: { l: "Yeni", c: T.accentText, s: T.accentSoft }, ayrildi: { l: "Ayrıldı", c: T.textFaint, s: T.borderSoft } };
              const d = dMap[c.durum];
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600 }}>{c.ad}</div>
                    {c.not && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{c.not}</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{c.kategori}</td>
                  <td style={{ padding: "13px 16px" }}><Pill color={d.c} soft={d.s}>{d.l}</Pill></td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {c.aylikUcret ? fmt(c.aylikUcret) : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: c.karMarji >= 55 ? T.success : c.karMarji >= 35 ? T.warning : T.danger }}>
                    {c.karMarji ? `%${c.karMarji}` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right" }}>
                    <ChevronRight size={15} color={T.textFaint} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FİNANS                                                                */
/* ------------------------------------------------------------------ */
function Finans() {
  const last = monthly[monthly.length - 1];
  const tahsilatOrani = Math.round(((last.ciro - bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0)) / last.ciro) * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="NAKİT AKIŞI (BU AY)" value={fmt(last.net)} accent={T.success} delta={12} />
        <KpiCard label="TAHSİLAT ORANI" value={`%${tahsilatOrani}`} mono />
        <KpiCard label="BEKLEYEN ÖDEME" value={fmt(bekleyenTahsilatlar.reduce((s, b) => s + b.tutar, 0))} accent={T.warning} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Gelir & Gider — Son 6 Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ left: -18, right: 8 }} barGap={4}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} />
              <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
              <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Vergi Takibi</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vergiTakvimi.map((v, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <CalendarClock size={16} color={v.durum === "yaklaşıyor" ? T.warning : T.textFaint} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{v.kalem}</div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>{v.tarih}</div>
                </div>
                {v.durum === "yaklaşıyor" && <Pill color={T.warning} soft={T.warningSoft}>Yaklaşıyor</Pill>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle action={<CircleDollarSign size={16} color={T.textFaint} />}>Gelirler</SectionTitle>
          {gelirKalemleri.map((g, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < gelirKalemleri.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
              <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>{g.kalem}</span>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          ))}
        </Card>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle action={<Receipt size={16} color={T.textFaint} />}>Giderler</SectionTitle>
          {giderKalemleri.map((g, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < giderKalemleri.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
              <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>{g.kalem}</span>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ padding: "20px 22px" }}>
        <SectionTitle action={<Landmark size={16} color={T.textFaint} />}>Bekleyen Tahsilatlar</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bekleyenTahsilatlar.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: T.surfaceRaised, borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{b.musteri}</div>
                <div style={{ fontSize: 11.5, color: b.vade.includes("gecikti") ? T.danger : T.textFaint, fontFamily: "Inter" }}>{b.vade}</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: T.text }}>{fmt(b.tutar)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OPERASYON — Kanban                                                   */
/* ------------------------------------------------------------------ */
function Operasyon() {
  const stages = ["Çekim", "Edit", "Onay", "Paylaşım", "Reklam"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {Object.entries(durumMap).map(([k, d]) => (
          <Pill key={k} color={d.color} soft={d.soft}>{d.label} · {operasyonlar.filter(o => o.durum === k).length}</Pill>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 12 }}>
        {stages.map((stage) => {
          const items = operasyonlar.filter(o => o.tur === stage);
          const Icon = opIcon[stage];
          return (
            <div key={stage}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "0 4px" }}>
                <Icon size={14} color={T.textDim} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, fontFamily: "Inter" }}>{stage}</span>
                <span style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((o) => {
                  const d = durumMap[o.durum];
                  return (
                    <Card key={o.id} style={{ padding: "12px 13px" }}>
                      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 6, lineHeight: 1.4 }}>{o.baslik}</div>
                      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>{o.musteri}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Pill color={d.color} soft={d.soft}>{d.label}</Pill>
                        <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{o.tarih}</span>
                      </div>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", padding: "16px 8px", textAlign: "center", border: `1px dashed ${T.borderSoft}`, borderRadius: 10 }}>
                    İş yok
                  </div>
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
        <SectionTitle>Bildirimler</SectionTitle>
        {["Gecikmiş tahsilat uyarıları", "Vergi takvimi hatırlatmaları", "Haftalık AI CEO özeti"].map((n, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>{n}</span>
            <div style={{ width: 36, height: 20, borderRadius: 999, background: T.accent, position: "relative" }}>
              <div style={{ width: 16, height: 16, borderRadius: 999, background: "#fff", position: "absolute", top: 2, right: 2 }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI CEO CHAT PANEL                                                    */
/* ------------------------------------------------------------------ */
const PRESET_QUESTIONS = [
  "Bu ay neden kâr düştü?",
  "En kârlı müşteriler hangileri?",
  "Gelecek ay tahmini nedir?",
  "Hangi müşteriye bağımlıyım?",
];

const CONTEXT_SUMMARY = JSON.stringify({
  aylikVeri: monthly,
  musteriler: clients,
  operasyonlar: operasyonlar.map(o => ({ musteri: o.musteri, tur: o.tur, durum: o.durum })),
  gelirKalemleri, giderKalemleri, bekleyenTahsilatlar, vergiTakvimi,
});

function AiPanel({ open, onClose, initialQuestion }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Merhaba, ben Marcus OS'un AI CEO asistanıyım. İşletmenin güncel verilerine bakarak sorularını cevaplayabilirim." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const firedInitial = useRef(false);

  useEffect(() => {
    if (open && initialQuestion && !firedInitial.current) {
      firedInitial.current = true;
      send(initialQuestion);
    }
    if (!open) firedInitial.current = false;
    // eslint-disable-next-line
  }, [open, initialQuestion]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      // Not: API anahtarı burada YOK. İstek /api/chat sunucu fonksiyonuna gidiyor,
      // anahtar orada (Vercel ortam değişkeni) tutuluyor. Bkz. README.md.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: CONTEXT_SUMMARY }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((c) => c.type === "text");
      setMessages((m) => [...m, { role: "assistant", text: textBlock ? textBlock.text : (data.error || "Bir cevap alınamadı, tekrar dener misin?") }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Bağlantı hatası oluştu. Lütfen tekrar dene." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", top: 0, right: 0, height: "100%", width: 400, maxWidth: "92vw",
        background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 50,
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
        boxShadow: open ? "-24px 0 48px rgba(0,0,0,0.35)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={14} color={T.accentText} />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: T.text }}>AI CEO</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
          <X size={17} color={T.textFaint} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              background: m.role === "user" ? T.accent : T.surfaceRaised,
              color: m.role === "user" ? "#fff" : T.text,
              padding: "10px 13px",
              borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
              fontSize: 13.5,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: T.textFaint, fontSize: 12.5, fontFamily: "Inter", padding: "4px 4px" }}>
            AI CEO yazıyor…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              style={{
                textAlign: "left", background: T.surfaceRaised, border: `1px solid ${T.border}`,
                color: T.textDim, borderRadius: 10, padding: "9px 12px", fontSize: 12.5,
                fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Bir soru sor…"
          style={{
            flex: 1, background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "10px 12px", color: T.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none",
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          style={{
            background: T.accent, border: "none", borderRadius: 10, width: 40, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: loading ? 0.6 : 1,
          }}
        >
          <Send size={15} color="#fff" />
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
  { key: "ayarlar", label: "Ayarlar", icon: Settings },
];

export default function MarcusOS() {
  const [tab, setTab] = useState("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState(null);

  const openAi = (q) => {
    setAiQuestion(q || null);
    setAiOpen(true);
  };

  const titles = { dashboard: "Dashboard", musteriler: "Müşteriler", finans: "Finans", operasyon: "Operasyon", ayarlar: "Ayarlar" };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
        input:focus { border-color: ${T.accent} !important; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
        @media (max-width: 900px) {
          .marcus-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width: 220, borderRight: `1px solid ${T.borderSoft}`, padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>
            M
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14.5, color: T.text, letterSpacing: 0.2 }}>Marcus OS</div>
            <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>Marcus Medya</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9,
                background: tab === key ? T.accentSoft : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <Icon size={16} color={tab === key ? T.accentText : T.textDim} />
              <span style={{ fontSize: 13.5, fontWeight: tab === key ? 600 : 500, color: tab === key ? T.text : T.textDim, fontFamily: "Inter, sans-serif" }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={() => openAi()}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderRadius: 10,
              background: `linear-gradient(135deg, ${T.accent}, #7C6BFA)`, border: "none", cursor: "pointer",
              width: "100%", color: "#fff",
            }}
          >
            <Sparkles size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>AI CEO'ya Sor</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 30px 0" }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 600, color: T.text, margin: 0 }}>
              {titles[tab]}
            </h1>
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
              27 Temmuz 2026 · Temmuz dönemi
            </div>
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
          {tab === "dashboard" && <Dashboard onAsk={() => openAi()} />}
          {tab === "musteriler" && <Musteriler />}
          {tab === "finans" && <Finans />}
          {tab === "operasyon" && <Operasyon />}
          {tab === "ayarlar" && <Ayarlar />}
        </div>
      </div>

      {aiOpen && (
        <div onClick={() => setAiOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }} />
      )}
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} initialQuestion={aiQuestion} />
    </div>
  );
}
