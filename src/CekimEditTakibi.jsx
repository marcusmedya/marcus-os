import React, { useState, useMemo, useEffect } from "react";
import {
  Camera, Plus, X, Clock, AlertTriangle, CheckCircle2, User, Link2,
  MessageSquare, History, ChevronRight, Pencil, Trash2, LayoutGrid, BarChart3, ListTodo, Rocket,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Bu modül de kendi (App.jsx'ten bağımsız) sade tasarım dilini kullanır. */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#111114", panel: "#1B1B1F", panelAlt: "#17171A", border: "#2A2A30", borderSoft: "#232327",
  text: "#F5F5F7", textDim: "#9A9AA2", textFaint: "#5F5F66",
  accent: "#3B9EFF", accentSoft: "rgba(59,158,255,0.14)", accentText: "#8FC7FF",
  success: "#33D874", successSoft: "rgba(51,216,116,0.12)",
  danger: "#FF5A52", dangerSoft: "rgba(255,90,82,0.12)",
  warning: "#F5A623", warningSoft: "rgba(245,166,35,0.12)",
};

export const KATEGORILER = ["Video", "Grafik Tasarım"];

/** Google Drive paylaşım linkini, sayfa içinde doğrudan oynatılabilir (gömülü) önizleme
 * formatına çevirir. Dönüştürülemezse null döner, o zaman normal link olarak gösterilir. */
function driveEmbedUrl(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  return `https://drive.google.com/file/d/${m[1]}/preview`;
}
/** Grafik Tasarım (görsel) içerikler için — Drive'ın /preview'ı (video amaçlı) tıklama
 * gerektiriyor; görsel için bunun yerine dosyanın DOĞRUDAN görsel URL'sini üretip normal bir
 * <img> olarak gösteriyoruz — hiç tıklamaya gerek kalmadan anında görünür. */
function driveGorselUrl(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  return `https://drive.google.com/uc?export=view&id=${m[1]}`;
}

export const ASAMALAR_VIDEO = [
  "Çekim Planlandı", "Çekim Yapıldı", "Dosyalar Aktarıldı", "Edit Bekliyor",
  "Edit Yapılıyor", "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", "Teslim Edildi",
];
export const ASAMALAR_TASARIM = [
  "Talep Alındı", "Tasarım Bekliyor", "Tasarım Yapılıyor",
  "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", "Teslim Edildi",
];
/** Geriye dönük uyumluluk: kategorisiz eski kayıtlar Video akışını kullanır. */
export const ASAMALAR = ASAMALAR_VIDEO;
export const asamaListesi = (kategori) => (kategori === "Grafik Tasarım" ? ASAMALAR_TASARIM : ASAMALAR_VIDEO);
/** O kategoride "işin bizzat yapıldığı" aşama — "Tamamladım" butonunun tetiklendiği yer. */
const YAPILIYOR_ASAMASI = { "Video": "Edit Yapılıyor", "Grafik Tasarım": "Tasarım Yapılıyor" };
const TAMAMLADIM_ETIKETI = { "Video": "Editi Tamamladım", "Grafik Tasarım": "Tasarımı Tamamladım" };

const ONCELIKLER = ["Düşük", "Normal", "Yüksek"];
const ONCELIK_RENK = { "Düşük": C.textFaint, "Normal": C.accentText, "Yüksek": C.danger };

const nid = () => Math.random().toString(36).slice(2, 9);
const bugunISO = () => {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
};
const gunFarki = (tarihISO) => {
  if (!tarihISO) return null;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const t = new Date(tarihISO);
  return Math.round((t - bugun) / 86400000);
};

// App.jsx'teki ile aynı localStorage anahtarları — bu dosya App.jsx'ten bağımsız çalıştığı
// için kimlik bilgilerini kendi başına aynı yerden okuyor.
const authHeadersLokal = () => {
  try {
    const pw = localStorage.getItem("marcus-os-pw");
    if (pw) return { "X-Site-Password": pw };
    const kullaniciAdi = localStorage.getItem("marcus-os-staff-user");
    const sifre = localStorage.getItem("marcus-os-staff-pw");
    if (kullaniciAdi && sifre) return { "X-Staff-Username": kullaniciAdi, "X-Staff-Password": sifre };
  } catch (e) { /* localStorage erişilemezse sessizce geç */ }
  return {};
};

/** Bir kayıt (iş) düzenleme ekranı açıkken, başka biri de aynı kaydı açtıysa erken uyarı verir. */
function useDuzenlemeKilidi(tur, id, aktifMi, benKimim) {
  const [kilitleyen, setKilitleyen] = useState(null);
  useEffect(() => {
    if (!aktifMi || !id || !benKimim) { setKilitleyen(null); return; }
    let iptal = false;
    const kilitAl = () => {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeadersLokal() },
        body: JSON.stringify({ kilitAction: "al", tur, id, kisi: benKimim }),
      })
        .then((r) => r.json())
        .then((res) => { if (!iptal) setKilitleyen(res.kilitli ? res.kilitleyen : null); })
        .catch(() => {});
    };
    kilitAl();
    const interval = setInterval(kilitAl, 45000);
    return () => {
      iptal = true;
      clearInterval(interval);
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeadersLokal() },
        body: JSON.stringify({ kilitAction: "birak", tur, id, kisi: benKimim }),
      }).catch(() => {});
    };
    // eslint-disable-next-line
  }, [tur, id, aktifMi]);
  return kilitleyen;
}

function KilitUyarisi({ kisi }) {
  if (!kisi) return null;
  return (
    <div style={{ background: "#3a2e12", color: "#e8b84b", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5, marginBottom: 12 }}>
      <span>⚠️</span>
      <span><strong>{kisi}</strong> şu anda bu işi düzenliyor olabilir. Aynı anda ikiniz kaydederseniz, son kaydeden diğerinizin değişikliğini fark ettirmeden silebilir.</span>
    </div>
  );
}

function aciliyetDurumu(job) {
  if (job.asama === "Teslim Edildi") return "tamam";
  const fark = gunFarki(job.teslimTarihi);
  if (fark === null) return "normal";
  if (fark < 0) return "gecikti";
  if (fark <= 2) return "yaklasiyor";
  return "normal";
}
const ACILIYET_STIL = {
  gecikti: { color: C.danger, soft: C.dangerSoft, label: "Gecikti" },
  yaklasiyor: { color: C.warning, soft: C.warningSoft, label: "Yaklaşıyor" },
  normal: { color: C.success, soft: C.successSoft, label: "Zamanında" },
  tamam: { color: C.textFaint, soft: C.borderSoft, label: "Teslim Edildi" },
};

const STAFF_NAME_KEY = "marcusStaffName";
export const getStaffName = () => { try { return localStorage.getItem(STAFF_NAME_KEY) || ""; } catch { return ""; } };
export const setStaffName = (n) => { try { localStorage.setItem(STAFF_NAME_KEY, n); } catch {} };

/** Bir kullanıcının bu işi değiştirme yetkisi var mı (kendi işi mi, yoksa yönetici mi). */
function duzenleyebilirMi(job, role, staffName) {
  if (role === "owner") return true;
  if (!staffName) return false;
  const n = staffName.trim().toLocaleLowerCase("tr");
  return (job.kameraman || "").trim().toLocaleLowerCase("tr") === n || (job.editor || "").trim().toLocaleLowerCase("tr") === n;
}

const inputStyle = { width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" };
const labelStyle = { fontSize: 11, color: C.textFaint, fontWeight: 600, display: "block", marginBottom: 4 };
const btnPrimary = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: C.accent, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const btnGhost = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

/* ------------------------------------------------------------------ */
/* İş Kartı                                                              */
/* ------------------------------------------------------------------ */
function IsKarti({ job, onClick, draggable, onDragStart }) {
  const aciliyet = aciliyetDurumu(job);
  const stil = ACILIYET_STIL[aciliyet];
  const asamalar = asamaListesi(job.kategori);
  const yuzde = Math.round((asamalar.indexOf(job.asama) / (asamalar.length - 1)) * 100);
  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => onDragStart && onDragStart(e, job)}
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${stil.color}`, borderRadius: 12, padding: "12px 13px", marginBottom: 10, cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{job.marka}</div>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: ONCELIK_RENK[job.oncelik], flexShrink: 0, marginTop: 4 }} title={`Öncelik: ${job.oncelik}`} />
      </div>
      {job.kategori === "Grafik Tasarım" && job.editliDosyaLink && driveGorselUrl(job.editliDosyaLink) && (
        <img
          src={driveGorselUrl(job.editliDosyaLink)}
          alt=""
          style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 8, background: C.panelAlt, display: "block" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}
      <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 8 }}>{job.icerikTuru}{job.kategori ? ` · ${job.kategori}` : ""}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textFaint, marginBottom: 8 }}>
        <span>{job.kameraman || job.editor || "—"}{job.kategori !== "Grafik Tasarım" && job.editor ? ` / ${job.editor}` : ""}</span>
        <span style={{ color: stil.color, fontWeight: 600 }}>{job.teslimTarihi}</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: C.borderSoft, overflow: "hidden" }}>
        <div style={{ width: `${yuzde}%`, height: "100%", background: stil.color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Yeni İş Formu                                                         */
/* ------------------------------------------------------------------ */
/** Kayıtlı personelden gerçek bir <select> ile seçim yaptırır (datalist bazı tarayıcılarda,
 * özellikle Safari'de, güvenilir açılmadığı için kullanılmıyor). Listede olmayan biri için
 * "Diğer (elle yaz)" seçeneği açılır bir metin kutusuna dönüşür. */
function PersonelSecici({ value, onChange, personelRosteri }) {
  const roster = personelRosteri || [];
  const kayitliMi = roster.some((p) => p.ad === value);
  const [elleYaz, setElleYaz] = useState(value !== "" && !kayitliMi);

  if (elleYaz || roster.length === 0) {
    return (
      <div>
        <input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Adı yaz" autoFocus={elleYaz} />
        {roster.length > 0 && (
          <button type="button" onClick={() => { setElleYaz(false); onChange(""); }} style={{ background: "none", border: "none", color: C.accentText, fontSize: 11.5, cursor: "pointer", padding: "4px 0 0", fontFamily: "inherit" }}>
            ← Kayıtlı listeden seç
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      style={inputStyle}
      value={value}
      onChange={(e) => { if (e.target.value === "__ELLE__") { setElleYaz(true); onChange(""); } else onChange(e.target.value); }}
    >
      <option value="">— Seç —</option>
      {roster.map((p) => <option key={p.ad} value={p.ad}>{p.ad}</option>)}
      <option value="__ELLE__">Diğer (elle yaz)…</option>
    </select>
  );
}

function YeniIsFormu({ clients, personelRosteri, varsayilanKategori, onSubmit, onCancel }) {
  const [v, setV] = useState({
    kategori: varsayilanKategori || "Video",
    marka: "", icerikTuru: "", cekimTarihi: bugunISO(), teslimTarihi: bugunISO(),
    kameraman: "", editor: "", oncelik: "Normal", istenenAdet: "", brief: "",
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const video = v.kategori !== "Grafik Tasarım";
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <label style={labelStyle}>Kategori</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {KATEGORILER.map((k) => (
          <button
            key={k}
            onClick={() => set("kategori", k)}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${v.kategori === k ? C.accent : C.border}`, background: v.kategori === k ? C.accentSoft : "transparent", color: v.kategori === k ? C.accentText : C.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Marka</label><input list="marka-listesi" style={inputStyle} value={v.marka} onChange={(e) => set("marka", e.target.value)} /></div>
        <div><label style={labelStyle}>İçerik / Talep Türü</label><input style={inputStyle} placeholder={video ? "örn. Reels, Ürün Fotoğrafı" : "örn. Post Tasarımı, Banner"} value={v.icerikTuru} onChange={(e) => set("icerikTuru", e.target.value)} /></div>
        {video && <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={v.cekimTarihi} onChange={(e) => set("cekimTarihi", e.target.value)} /></div>}
        <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={v.teslimTarihi} onChange={(e) => set("teslimTarihi", e.target.value)} /></div>
        {video && <div><label style={labelStyle}>Sorumlu Kameraman</label><PersonelSecici value={v.kameraman} onChange={(val) => set("kameraman", val)} personelRosteri={personelRosteri} /></div>}
        <div><label style={labelStyle}>{video ? "Sorumlu Editör" : "Sorumlu Tasarımcı"}</label><PersonelSecici value={v.editor} onChange={(val) => set("editor", val)} personelRosteri={personelRosteri} /></div>
        <div>
          <label style={labelStyle}>Öncelik</label>
          <select style={inputStyle} value={v.oncelik} onChange={(e) => set("oncelik", e.target.value)}>
            {ONCELIKLER.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>İstenen Adet</label><input style={inputStyle} value={v.istenenAdet} onChange={(e) => set("istenenAdet", e.target.value)} placeholder={video ? "örn. 6 Reels + 10 Post" : "örn. 4 Post + 2 Banner"} /></div>
      </div>
      <label style={labelStyle}>Brief / Notlar</label>
      <textarea style={{ ...inputStyle, marginBottom: 12 }} rows={3} value={v.brief} onChange={(e) => set("brief", e.target.value)} />
      <datalist id="marka-listesi">{(clients || []).map((c) => <option key={c.id} value={c.ad} />)}</datalist>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnGhost} onClick={onCancel}>İptal</button>
        <button style={btnPrimary} onClick={() => v.marka && onSubmit(v)}>İşi Oluştur</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* İş Detay Modalı                                                       */
/* ------------------------------------------------------------------ */
function IsDetayModal({ job, role, staffName, personelRosteri, onClose, onUpdate, onDelete, kilitleyen, markaYoneticisiMi, firmaAdi }) {
  const [yorum, setYorum] = useState("");
  const [revizeMetni, setRevizeMetni] = useState("");
  const [revizeAciliyor, setRevizeAciliyor] = useState(false);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState({ ...job });
  const [dosyaDuzenle, setDosyaDuzenle] = useState(false);
  const [dosyaTaslak, setDosyaTaslak] = useState({ hamDosyaLink: job.hamDosyaLink || "", editliDosyaLink: job.editliDosyaLink || "" });

  const yetkili = duzenleyebilirMi(job, role, staffName);
  const aciliyet = aciliyetDurumu(job);
  const stil = ACILIYET_STIL[aciliyet];

  const logKaydet = (aciklama) => {
    const kayit = { id: nid(), tarih: new Date().toLocaleString("tr-TR"), yazan: role === "owner" ? "Yönetici" : (staffName || "Personel"), aciklama };
    return [...(job.gecmis || []), kayit];
  };

  const dosyaLinkleriniKaydet = () => {
    onUpdate(job.id, { ...dosyaTaslak, gecmis: logKaydet("Dosya bağlantıları güncellendi") });
    setDosyaDuzenle(false);
  };

  const asamaGecir = (yeniAsama, ekAciklama) => {
    onUpdate(job.id, {
      asama: yeniAsama,
      gecmis: logKaydet(`Aşama değişti: ${job.asama} → ${yeniAsama}${ekAciklama ? " (" + ekAciklama + ")" : ""}`),
    });
  };
  const geriAl = (hedefAsama) => {
    if (!window.confirm(`"${hedefAsama}" aşamasına geri alınsın mı?`)) return;
    asamaGecir(hedefAsama, "geri alındı");
  };

  const kategori = job.kategori === "Grafik Tasarım" ? "Grafik Tasarım" : "Video";
  const asamalar = asamaListesi(kategori);
  const editiTamamla = () => asamaGecir("Kontrol Bekliyor", TAMAMLADIM_ETIKETI[kategori]);
  const revizeyiTamamla = () => asamaGecir("Kontrol Bekliyor", "Revize Tamamlandı");
  const onayla = () => asamaGecir("Onaylandı");
  const teslimEt = () => { if (window.confirm("Bu iş \"Teslim Edildi\" olarak işaretlenecek. Emin misin?")) asamaGecir("Teslim Edildi"); };
  const revizeGonder = () => {
    if (!revizeMetni.trim()) { window.alert("Revize açıklaması zorunludur."); return; }
    onUpdate(job.id, { asama: "Revize İstendi", revizeAciklamasi: revizeMetni.trim(), gecmis: logKaydet(`Revize istendi: ${revizeMetni.trim()}`) });
    setRevizeMetni(""); setRevizeAciliyor(false);
  };
  const yorumEkle = () => {
    if (!yorum.trim()) return;
    const kayit = { id: nid(), yazan: role === "owner" ? "Yönetici" : (staffName || "Personel"), tarih: new Date().toLocaleString("tr-TR"), metin: yorum.trim() };
    onUpdate(job.id, { yorumlar: [...(job.yorumlar || []), kayit] });
    setYorum("");
  };
  const kaydetDuzenle = () => {
    onUpdate(job.id, { ...taslak, gecmis: logKaydet("Detaylar güncellendi") });
    setDuzenle(false);
  };

  const [durumGonderiliyor, setDurumGonderiliyor] = useState(false);
  const [durumSonuc, setDurumSonuc] = useState("");

  const durumBildirimiGonder = () => {
    const trKucult = (s) => (s || "").trim().toLocaleLowerCase("tr");
    const atananlar = [job.kameraman, job.editor].filter(Boolean);
    const roster = personelRosteri || [];
    const kisiler = atananlar
      .map((ad) => roster.find((p) => trKucult(p.ad) === trKucult(ad)))
      .filter((k) => k && k.email);
    if (kisiler.length === 0) {
      setDurumSonuc("Atanan kişi(ler) için kayıtlı e-posta bulunamadı.");
      return;
    }
    setDurumGonderiliyor(true);
    setDurumSonuc("");
    Promise.all(
      kisiler.map((kisi) =>
        fetch("/api/notify-job", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeadersLokal() },
          body: JSON.stringify({ email: kisi.email, ad: kisi.ad, marka: job.marka, icerikTuru: job.icerikTuru, kategori: job.kategori, asama: job.asama, teslimTarihi: job.teslimTarihi, firmaAdi, mod: "durum" }),
        }).then((r) => r.json()).then((res) => ({ kisi: kisi.ad, ...res }))
      )
    )
      .then((sonuclar) => {
        const basarili = sonuclar.filter((s) => s.ok).map((s) => s.kisi);
        const basarisiz = sonuclar.filter((s) => !s.ok);
        let mesaj = basarili.length ? `Gönderildi: ${basarili.join(", ")}.` : "";
        if (basarisiz.length) mesaj += ` Gönderilemedi: ${basarisiz.map((s) => `${s.kisi} (${s.error || s.reason || "bilinmeyen hata"})`).join(", ")}.`;
        setDurumSonuc(mesaj.trim());
      })
      .catch(() => setDurumSonuc("Bağlantı hatası — gönderilemedi."))
      .finally(() => setDurumGonderiliyor(false));
  };

  const suankiIndex = asamalar.indexOf(job.asama);
  const ileriAsama = suankiIndex >= 0 && suankiIndex < asamalar.length - 1 ? asamalar[suankiIndex + 1] : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, width: 620, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "22px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{job.marka} — {job.icerikTuru}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: C.accentSoft, color: C.accentText, fontWeight: 600 }}>{job.asama}</span>
              <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: stil.soft, color: stil.color, fontWeight: 600 }}>{stil.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textFaint} /></button>
        </div>

        <KilitUyarisi kisi={kilitleyen} />

        {markaYoneticisiMi && (
          <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.textDim }}>Atanan kişiye şu anki durumu ("{job.asama}") e-postayla bildir.</span>
              <button onClick={durumBildirimiGonder} disabled={durumGonderiliyor} style={{ ...btnGhost, fontSize: 12, padding: "6px 12px" }}>
                {durumGonderiliyor ? "Gönderiliyor…" : "📧 Durum Bildirimi Gönder"}
              </button>
            </div>
            {durumSonuc && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 6 }}>{durumSonuc}</div>}
          </div>
        )}

        {!yetkili && (
          <div style={{ fontSize: 12, color: C.textFaint, background: C.panelAlt, borderRadius: 9, padding: "8px 11px", marginBottom: 14 }}>
            Bu iş sana atanmadığı için sadece görüntüleyebiliyorsun.
          </div>
        )}

        {duzenle ? (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Kategori</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {KATEGORILER.map((k) => (
                <button key={k} onClick={() => setTaslak((s) => ({ ...s, kategori: k }))} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1.5px solid ${taslak.kategori === k ? C.accent : C.border}`, background: taslak.kategori === k ? C.accentSoft : "transparent", color: taslak.kategori === k ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{k}</button>
              ))}
            </div>
            <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Marka</label><input style={inputStyle} value={taslak.marka} onChange={(e) => setTaslak((s) => ({ ...s, marka: e.target.value }))} /></div>
              <div><label style={labelStyle}>İçerik Türü</label><input style={inputStyle} value={taslak.icerikTuru} onChange={(e) => setTaslak((s) => ({ ...s, icerikTuru: e.target.value }))} /></div>
              {taslak.kategori !== "Grafik Tasarım" && <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={taslak.cekimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, cekimTarihi: e.target.value }))} /></div>}
              <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={taslak.teslimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, teslimTarihi: e.target.value }))} /></div>
              {taslak.kategori !== "Grafik Tasarım" && <div><label style={labelStyle}>Kameraman</label><PersonelSecici value={taslak.kameraman} onChange={(val) => setTaslak((s) => ({ ...s, kameraman: val }))} personelRosteri={personelRosteri} /></div>}
              <div><label style={labelStyle}>{taslak.kategori !== "Grafik Tasarım" ? "Editör" : "Tasarımcı"}</label><PersonelSecici value={taslak.editor} onChange={(val) => setTaslak((s) => ({ ...s, editor: val }))} personelRosteri={personelRosteri} /></div>
              <div>
                <label style={labelStyle}>Öncelik</label>
                <select style={inputStyle} value={taslak.oncelik} onChange={(e) => setTaslak((s) => ({ ...s, oncelik: e.target.value }))}>
                  {ONCELIKLER.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>İstenen Adet</label><input style={inputStyle} value={taslak.istenenAdet || ""} onChange={(e) => setTaslak((s) => ({ ...s, istenenAdet: e.target.value }))} /></div>
            </div>
            <label style={labelStyle}>Brief / Çekim Notları</label>
            <textarea style={{ ...inputStyle, marginBottom: 10 }} rows={3} value={taslak.brief || ""} onChange={(e) => setTaslak((s) => ({ ...s, brief: e.target.value }))} />
            <label style={labelStyle}>Ham Dosya Klasör Bağlantısı</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={taslak.hamDosyaLink || ""} onChange={(e) => setTaslak((s) => ({ ...s, hamDosyaLink: e.target.value }))} placeholder="Google Drive / WeTransfer linki" />
            <label style={labelStyle}>Editlenmiş Dosya Bağlantısı</label>
            <input style={{ ...inputStyle, marginBottom: 12 }} value={taslak.editliDosyaLink || ""} onChange={(e) => setTaslak((s) => ({ ...s, editliDosyaLink: e.target.value }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnGhost} onClick={() => { setDuzenle(false); setTaslak({ ...job }); }}>İptal</button>
              <button style={btnPrimary} onClick={kaydetDuzenle}>Kaydet</button>
            </div>
          </div>
        ) : (
          <>
            <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, fontSize: 12.5 }}>
              <div><span style={{ color: C.textFaint }}>Çekim Tarihi:</span> <span style={{ color: C.text }}>{job.cekimTarihi}</span></div>
              <div><span style={{ color: C.textFaint }}>Teslim Tarihi:</span> <span style={{ color: C.text }}>{job.teslimTarihi}</span></div>
              <div><span style={{ color: C.textFaint }}>Kameraman:</span> <span style={{ color: C.text }}>{job.kameraman || "—"}</span></div>
              <div><span style={{ color: C.textFaint }}>Editör:</span> <span style={{ color: C.text }}>{job.editor || "—"}</span></div>
              <div><span style={{ color: C.textFaint }}>Öncelik:</span> <span style={{ color: ONCELIK_RENK[job.oncelik] }}>{job.oncelik}</span></div>
              <div><span style={{ color: C.textFaint }}>İstenen Adet:</span> <span style={{ color: C.text }}>{job.istenenAdet || "—"}</span></div>
            </div>

            {job.brief && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 4 }}>BRIEF / NOTLAR</div>
                <div style={{ fontSize: 12.5, color: C.textDim, background: C.panelAlt, borderRadius: 9, padding: "9px 11px", lineHeight: 1.6 }}>{job.brief}</div>
              </div>
            )}

            {job.revizeAciklamasi && job.asama === "Revize İstendi" && (
              <div style={{ marginBottom: 14, background: C.dangerSoft, borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ fontSize: 11, color: C.danger, fontWeight: 700, marginBottom: 3 }}>REVİZE AÇIKLAMASI</div>
                <div style={{ fontSize: 12.5, color: C.text }}>{job.revizeAciklamasi}</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              {dosyaDuzenle ? (
                <div style={{ background: C.panelAlt, borderRadius: 10, padding: 12 }}>
                  <label style={labelStyle}>Ham Dosya Klasör Bağlantısı</label>
                  <input style={{ ...inputStyle, marginBottom: 10 }} value={dosyaTaslak.hamDosyaLink} onChange={(e) => setDosyaTaslak((s) => ({ ...s, hamDosyaLink: e.target.value }))} placeholder="Google Drive / WeTransfer linki" />
                  <label style={labelStyle}>Editlenmiş Dosya Bağlantısı</label>
                  <input style={{ ...inputStyle, marginBottom: 12 }} value={dosyaTaslak.editliDosyaLink} onChange={(e) => setDosyaTaslak((s) => ({ ...s, editliDosyaLink: e.target.value }))} placeholder="Google Drive / WeTransfer linki" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnGhost} onClick={() => { setDosyaDuzenle(false); setDosyaTaslak({ hamDosyaLink: job.hamDosyaLink || "", editliDosyaLink: job.editliDosyaLink || "" }); }}>İptal</button>
                    <button style={btnPrimary} onClick={dosyaLinkleriniKaydet}>Kaydet</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: (job.editliDosyaLink && (driveGorselUrl(job.editliDosyaLink) || driveEmbedUrl(job.editliDosyaLink))) ? 10 : 0 }}>
                    {job.hamDosyaLink && <a href={job.hamDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Ham Dosyalar</a>}
                    {job.editliDosyaLink && <a href={job.editliDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Editlenmiş Dosyalar</a>}
                    {yetkili && (
                      <button style={{ background: "none", border: "none", color: C.textFaint, fontSize: 11.5, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }} onClick={() => setDosyaDuzenle(true)}>
                        {job.hamDosyaLink || job.editliDosyaLink ? "Dosya bağlantılarını düzenle" : "+ Dosya bağlantısı ekle"}
                      </button>
                    )}
                  </div>
                  {/* Grafik Tasarım'da (görsel) doğrudan <img> ile hiç tıklamaya gerek kalmadan
                   * anında gösterilir. Video'da ise Drive'ın /preview'ı kullanılır — tarayıcıların
                   * otomatik oynatma kısıtlaması yüzünden oynatmak için bir tık gerekiyor, bu
                   * platform kısıtı, tamamen kaldırılamıyor. */}
                  {job.editliDosyaLink && kategori === "Grafik Tasarım" && driveGorselUrl(job.editliDosyaLink) && (
                    <img
                      src={driveGorselUrl(job.editliDosyaLink)}
                      alt="Editlenmiş görsel önizleme"
                      style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 10, background: C.panelAlt, display: "block" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                  {job.editliDosyaLink && kategori !== "Grafik Tasarım" && driveEmbedUrl(job.editliDosyaLink) && (
                    <>
                      <iframe
                        src={driveEmbedUrl(job.editliDosyaLink)}
                        title="Editlenmiş dosya önizleme"
                        style={{ width: "100%", height: 280, border: "none", borderRadius: 10 }}
                        allow="autoplay"
                      />
                      <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 4 }}>Tarayıcılar videoyu otomatik başlatmaya izin vermiyor — oynatmak için oynatıcının üzerine bir kez tıklaman gerekiyor.</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {yetkili && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {job.asama === YAPILIYOR_ASAMASI[kategori] && <button style={btnPrimary} onClick={editiTamamla}><CheckCircle2 size={14} /> {TAMAMLADIM_ETIKETI[kategori]}</button>}
                {job.asama === "Revize İstendi" && <button style={btnPrimary} onClick={revizeyiTamamla}><CheckCircle2 size={14} /> Revizeyi Tamamladım</button>}
                {job.asama !== YAPILIYOR_ASAMASI[kategori] && job.asama !== "Revize İstendi" && ileriAsama && !["Onaylandı", "Teslim Edildi"].includes(ileriAsama) && (
                  <button style={btnGhost} onClick={() => asamaGecir(ileriAsama)}><ChevronRight size={14} /> Sonraki Aşamaya Geçir: {ileriAsama}</button>
                )}
                {suankiIndex > 0 && (
                  <button style={{ ...btnGhost, color: C.textDim }} onClick={() => geriAl(asamalar[suankiIndex - 1])}>← Geri Al: {asamalar[suankiIndex - 1]}</button>
                )}
                {job.asama === "Kontrol Bekliyor" && !revizeAciliyor && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={() => setRevizeAciliyor(true)}>Revize İste</button>}
                {role === "owner" && job.asama === "Kontrol Bekliyor" && <button style={{ ...btnPrimary, background: C.success }} onClick={onayla}>Onayla</button>}
                {role === "owner" && job.asama === "Onaylandı" && <button style={{ ...btnPrimary, background: C.success }} onClick={teslimEt}>Teslim Edildi Olarak İşaretle</button>}
                {role === "owner" && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={() => setDuzenle(true)}><Pencil size={13} /> Düzenle</button>}
                {role === "owner" && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={() => { if (window.confirm("Bu iş silinsin mi?")) onDelete(job.id); }}><Trash2 size={13} /> Sil</button>}
              </div>
            )}

            {revizeAciliyor && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Revize Açıklaması (zorunlu)</label>
                <textarea style={{ ...inputStyle, marginBottom: 8 }} rows={3} value={revizeMetni} onChange={(e) => setRevizeMetni(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btnGhost} onClick={() => setRevizeAciliyor(false)}>Vazgeç</button>
                  <button style={{ ...btnPrimary, background: C.danger }} onClick={revizeGonder}>Revize Gönder</button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textFaint, fontWeight: 700, marginBottom: 8 }}><MessageSquare size={13} /> YORUMLAR</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                {(job.yorumlar || []).map((y) => (
                  <div key={y.id} style={{ background: C.panelAlt, borderRadius: 9, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 2 }}>{y.yazan} · {y.tarih}</div>
                    <div style={{ fontSize: 12.5, color: C.text }}>{y.metin}</div>
                  </div>
                ))}
                {(!job.yorumlar || job.yorumlar.length === 0) && <div style={{ fontSize: 12, color: C.textFaint }}>Henüz yorum yok.</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inputStyle} placeholder="Yorum yaz…" value={yorum} onChange={(e) => setYorum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && yorumEkle()} />
                <button style={btnGhost} onClick={yorumEkle}>Ekle</button>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textFaint, fontWeight: 700, marginBottom: 8 }}><History size={13} /> İŞLEM GEÇMİŞİ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 140, overflowY: "auto" }}>
                {[...(job.gecmis || [])].reverse().map((g) => (
                  <div key={g.id} style={{ fontSize: 11.5, color: C.textDim }}><span style={{ color: C.textFaint }}>{g.tarih}</span> — {g.yazan}: {g.aciklama}</div>
                ))}
                {(!job.gecmis || job.gecmis.length === 0) && <div style={{ fontSize: 12, color: C.textFaint }}>Henüz kayıt yok.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Personel Paneli (Bugün Yapılacaklar vb.)                              */
/* ------------------------------------------------------------------ */
function PersonelPaneli({ jobs, staffName, onOpen }) {
  const benim = jobs.filter((j) => {
    const n = staffName.trim().toLocaleLowerCase("tr");
    return (j.kameraman || "").trim().toLocaleLowerCase("tr") === n || (j.editor || "").trim().toLocaleLowerCase("tr") === n;
  });
  const bugun = bugunISO();
  const bugunYapilacaklar = benim.filter((j) => j.cekimTarihi === bugun && j.asama !== "Teslim Edildi");
  const gecikenler = benim.filter((j) => aciliyetDurumu(j) === "gecikti");
  const yaklasanlar = benim.filter((j) => aciliyetDurumu(j) === "yaklasiyor" && j.asama !== "Teslim Edildi");
  const revizeBekleyen = benim.filter((j) => j.asama === "Revize İstendi");
  const tamamlanan = benim.filter((j) => j.asama === "Teslim Edildi" || j.asama === "Onaylandı");

  const Grup = ({ baslik, liste, renk }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: renk, marginBottom: 8 }}>{baslik} ({liste.length})</div>
      {liste.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textFaint }}>Yok.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {liste.map((j) => <IsKarti key={j.id} job={j} onClick={() => onOpen(j)} />)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Grup baslik="Bugün Yapılacaklar" liste={bugunYapilacaklar} renk={C.accentText} />
      <Grup baslik="Geciken İşler" liste={gecikenler} renk={C.danger} />
      <Grup baslik="Yaklaşan Teslimler" liste={yaklasanlar} renk={C.warning} />
      <Grup baslik="Revize Bekleyenler" liste={revizeBekleyen} renk={C.danger} />
      <Grup baslik="Tamamlanan İşler" liste={tamamlanan} renk={C.success} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Yönetici İstatistikleri                                              */
/* ------------------------------------------------------------------ */
function YoneticiIstatistik({ jobs }) {
  const kisiler = Array.from(new Set(jobs.flatMap((j) => [j.kameraman, j.editor]).filter(Boolean)));
  const yediGunOnce = new Date(); yediGunOnce.setDate(yediGunOnce.getDate() - 7);

  const haftalikCekim = jobs.reduce((s, j) => s + (j.gecmis || []).filter((g) => g.aciklama.includes("→ Çekim Yapıldı") && new Date(g.tarih.split(" ")[0].split(".").reverse().join("-")) >= yediGunOnce).length, 0);
  const haftalikEdit = jobs.reduce((s, j) => s + (j.gecmis || []).filter((g) => g.aciklama.includes("→ Kontrol Bekliyor") && new Date(g.tarih.split(" ")[0].split(".").reverse().join("-")) >= yediGunOnce).length, 0);

  const tamamlananlar = jobs.filter((j) => j.asama === "Teslim Edildi" && j.cekimTarihi);
  const ortSure = tamamlananlar.length
    ? Math.round(tamamlananlar.reduce((s, j) => {
        const teslimKaydi = [...(j.gecmis || [])].reverse().find((g) => g.aciklama.includes("→ Teslim Edildi"));
        if (!teslimKaydi) return s;
        const baslangic = new Date(j.cekimTarihi);
        const bitisTarihStr = teslimKaydi.tarih.split(" ")[0].split(".").reverse().join("-");
        const bitis = new Date(bitisTarihStr);
        return s + Math.max(0, Math.round((bitis - baslangic) / 86400000));
      }, 0) / tamamlananlar.length)
    : null;

  const Kutu = ({ label, value, renk }) => (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", flex: "1 1 140px" }}>
      <div style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: renk || C.text, fontFamily: "monospace" }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Kutu label="İŞ BEKLEYEN İŞLER" value={jobs.filter((j) => j.asama === "Edit Bekliyor" || j.asama === "Tasarım Bekliyor").length} renk={C.warning} />
        <Kutu label="KONTROL BEKLEYEN İŞLER" value={jobs.filter((j) => j.asama === "Kontrol Bekliyor").length} renk={C.accentText} />
        <Kutu label="GECİKEN İŞLER" value={jobs.filter((j) => aciliyetDurumu(j) === "gecikti").length} renk={C.danger} />
        <Kutu label="HAFTALIK TAMAMLANAN ÇEKİM" value={haftalikCekim} renk={C.success} />
        <Kutu label="HAFTALIK TAMAMLANAN EDİT" value={haftalikEdit} renk={C.success} />
        <Kutu label="ORT. TAMAMLANMA SÜRESİ" value={ortSure !== null ? `${ortSure} gün` : "—"} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Personel Bazında</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kisiler.length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint }}>Henüz kameraman/editör ataması yok.</div>}
          {kisiler.map((k) => {
            const kisininIsleri = jobs.filter((j) => j.kameraman === k || j.editor === k);
            const aktif = kisininIsleri.filter((j) => j.asama !== "Teslim Edildi").length;
            const geciken = kisininIsleri.filter((j) => aciliyetDurumu(j) === "gecikti").length;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12.5 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{k}</span>
                <span style={{ color: C.textDim }}>{aktif} aktif iş {geciken > 0 && <span style={{ color: C.danger }}>· {geciken} gecikmiş</span>}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ANA BİLEŞEN                                                           */
/* ------------------------------------------------------------------ */
export default function CekimEditTakibi({ role, clients, jobs, personelRosteri, onRefreshRoster, onAddJob, onUpdateJob, onDeleteJob, girisYapanAd, markalasmaSurecleri, onToggleMarkalasmaGorev, onSetMarkalasmaYonetici, onAddMarkalasmaGorev, onCompleteMarkalasmaSureci, onDeleteMarkalasmaSureci, markaYoneticisiMi, firmaAdi }) {
  const [staffName, setStaffNameState] = useState(girisYapanAd || getStaffName());
  const [view, setView] = useState(role === "staff" ? "panom" : "pano");
  const [panoKategori, setPanoKategori] = useState("Video");
  const [genisletilmisSutunlar, setGenisletilmisSutunlar] = useState({});
  const [adding, setAdding] = useState(false);
  const [acikIs, setAcikIs] = useState(null);
  const duzenleyenAdi = role === "owner" ? "Yönetici (CEO)" : (staffName || "Personel");
  const isKilitleyen = useDuzenlemeKilidi("operasyon-is", acikIs && acikIs.id, !!acikIs, duzenleyenAdi);

  useEffect(() => { setStaffNameState(girisYapanAd || getStaffName()); }, [girisYapanAd]);

  const isler = jobs || [];

  if (role === "staff" && !staffName) {
    return (
      <div style={{ maxWidth: 360, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 10 }}>Önce adını gir</div>
        <div style={{ fontSize: 12.5, color: C.textFaint, marginBottom: 14 }}>Kendi işlerini görebilmen ve işlem geçmişinde görünmen için adını bir kere girmen yeterli.</div>
        <input
          style={inputStyle}
          placeholder="Adın Soyadın"
          onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { setStaffName(e.target.value.trim()); setStaffNameState(e.target.value.trim()); } }}
        />
      </div>
    );
  }

  const panoIsleri = isler.filter((j) => (j.kategori === "Grafik Tasarım" ? "Grafik Tasarım" : "Video") === panoKategori);
  const panoAsamalari = asamaListesi(panoKategori);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {role === "staff" && (
            <button onClick={() => setView("panom")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "panom" ? C.accentSoft : "transparent", color: view === "panom" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><ListTodo size={14} /> Panom</button>
          )}
          <button onClick={() => setView("pano")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "pano" ? C.accentSoft : "transparent", color: view === "pano" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><LayoutGrid size={14} /> Tüm İşler</button>
          <button onClick={() => setView("markalasma")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "markalasma" ? C.accentSoft : "transparent", color: view === "markalasma" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Rocket size={14} /> Markalaşma</button>
          {role === "owner" && (
            <button onClick={() => setView("istatistik")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "istatistik" ? C.accentSoft : "transparent", color: view === "istatistik" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><BarChart3 size={14} /> İstatistikler</button>
          )}
        </div>
        {view !== "markalasma" && <button style={btnPrimary} onClick={() => { setAdding((v) => !v); if (onRefreshRoster) onRefreshRoster(); }}><Plus size={14} /> Yeni İş</button>}
      </div>

      {view === "pano" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.panelAlt, borderRadius: 10, padding: 3, width: "fit-content" }}>
          {KATEGORILER.map((k) => (
            <button key={k} onClick={() => setPanoKategori(k)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: panoKategori === k ? C.accent : "transparent", color: panoKategori === k ? "#fff" : C.textDim, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{k}</button>
          ))}
        </div>
      )}

      {adding && <YeniIsFormu clients={clients} personelRosteri={personelRosteri} varsayilanKategori={view === "pano" ? panoKategori : "Video"} onCancel={() => setAdding(false)} onSubmit={(v) => { onAddJob(v); setAdding(false); }} />}

      {view === "panom" && role === "staff" && <PersonelPaneli jobs={isler} staffName={staffName} onOpen={setAcikIs} />}

      {view === "istatistik" && role === "owner" && <YoneticiIstatistik jobs={isler} />}

      {view === "markalasma" && (
        <MarkalasmaGorunumu
          surecler={markalasmaSurecleri}
          clients={clients}
          personelRosteri={personelRosteri}
          role={role}
          onToggleGorev={onToggleMarkalasmaGorev}
          onSetYonetici={onSetMarkalasmaYonetici}
          onAddGorev={onAddMarkalasmaGorev}
          onComplete={onCompleteMarkalasmaSureci}
          onDelete={onDeleteMarkalasmaSureci}
        />
      )}

      {view === "pano" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {panoAsamalari.map((asama) => {
            const asamaIsleri = panoIsleri.filter((j) => j.asama === asama);
            // "Teslim Edildi" sütunu zamanla birikip pano'yu kalabalıklaştırıyordu — bu sütun
            // için varsayılan olarak sadece en son 10 iş gösterilir, geri kalanı "Tümünü Göster"
            // ile açılabilir. Diğer (hâlâ devam eden) sütunlarda hiçbir sınır yok.
            const sinirliMi = asama === "Teslim Edildi" && !genisletilmisSutunlar[asama] && asamaIsleri.length > 10;
            const buAsamadakiler = sinirliMi ? asamaIsleri.slice(-10) : asamaIsleri;
            return (
              <div key={asama} style={{ flex: "0 0 240px", minWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textDim }}>{asama}</span>
                  <span style={{ fontSize: 10.5, color: C.textFaint, background: C.panelAlt, padding: "1px 7px", borderRadius: 999 }}>{asamaIsleri.length}</span>
                </div>
                <div style={{ minHeight: 40 }}>
                  {buAsamadakiler.map((j) => <IsKarti key={j.id} job={j} onClick={() => setAcikIs(j)} />)}
                  {sinirliMi && (
                    <button
                      onClick={() => setGenisletilmisSutunlar((s) => ({ ...s, [asama]: true }))}
                      style={{ width: "100%", background: "none", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "8px 0", color: C.textFaint, fontSize: 11.5, cursor: "pointer", marginTop: 4 }}
                    >
                      + {asamaIsleri.length - 10} tane daha göster
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {acikIs && (
        <IsDetayModal
          job={isler.find((j) => j.id === acikIs.id) || acikIs}
          role={role}
          staffName={staffName}
          personelRosteri={personelRosteri}
          onClose={() => setAcikIs(null)}
          onUpdate={onUpdateJob}
          kilitleyen={isKilitleyen}
          markaYoneticisiMi={markaYoneticisiMi}
          firmaAdi={firmaAdi}
          onDelete={(id) => { onDeleteJob(id); setAcikIs(null); }}
        />
      )}
    </div>
  );
}

/** Yeni marka eklendiğinde otomatik açılan markalaşma sürecini (Instagram/Facebook/Meta/Google
 * kurulum görevleri) gösterir. Her sürece bir yönetici atanabilir — atandığında o kişiye
 * (kayıtlıysa ve e-postası varsa) otomatik bildirim gider. */
function MarkalasmaKart({ s, personelRosteri, role, onToggleGorev, onSetYonetici, onAddGorev, onComplete }) {
  const [yeniGorevAcik, setYeniGorevAcik] = useState(false);
  const [yeniGorevAdi, setYeniGorevAdi] = useState("");
  const [mailDurumu, setMailDurumu] = useState(null);

  const oran = s.gorevler && s.gorevler.length ? Math.round((s.gorevler.filter((g) => g.tamamlandi).length / s.gorevler.length) * 100) : 0;
  const hepsiBitti = oran === 100;

  const yoneticiDegisti = (val) => {
    setMailDurumu(null);
    Promise.resolve(onSetYonetici(s.id, val)).then((sonuc) => {
      if (sonuc && sonuc.mesaj) setMailDurumu(sonuc);
    });
  };

  const gorevEkle = () => {
    if (!yeniGorevAdi.trim()) return;
    onAddGorev(s.id, yeniGorevAdi.trim());
    setYeniGorevAdi("");
    setYeniGorevAcik(false);
  };

  const tamamla = () => {
    if (window.confirm(`"${s.marka}" markalaşma sürecini tamamlandı olarak işaretlemek istediğine emin misin? Bu, süreci "Tamamlanan Markalaşma" listesine taşır.`)) {
      onComplete(s.id);
    }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${hepsiBitti ? C.success : C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.marka}</div>
          <div style={{ fontSize: 11, color: C.textFaint }}>Açıldı: {s.olusturmaTarihi}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: hepsiBitti ? C.success : C.accentText, fontFamily: "monospace" }}>%{oran}</span>
          {role === "owner" ? (
            <div style={{ width: 180 }}>
              <PersonelSecici value={s.yonetici} onChange={yoneticiDegisti} personelRosteri={personelRosteri} />
            </div>
          ) : (
            <span style={{ fontSize: 11.5, color: C.textDim }}>{s.yonetici ? `Yönetici: ${s.yonetici}` : "Yönetici atanmadı"}</span>
          )}
        </div>
      </div>

      {mailDurumu && (
        <div style={{ fontSize: 11.5, color: mailDurumu.mailGitti ? C.success : C.warning, background: mailDurumu.mailGitti ? C.successSoft : C.warningSoft, borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
          {mailDurumu.mailGitti ? "✅ " : "⚠️ "}{mailDurumu.mesaj}
        </div>
      )}

      <div style={{ height: 5, borderRadius: 999, background: C.panelAlt, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${oran}%`, height: "100%", background: hepsiBitti ? C.success : C.accent, borderRadius: 999 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {s.gorevler.map((g) => (
          <button
            key={g.id}
            onClick={() => onToggleGorev(s.id, g.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textAlign: "left" }}
          >
            <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${g.tamamlandi ? C.success : C.border}`, background: g.tamamlandi ? C.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {g.tamamlandi && <CheckCircle2 size={12} color="#fff" />}
            </span>
            <span style={{ fontSize: 12.5, color: g.tamamlandi ? C.textFaint : C.text, textDecoration: g.tamamlandi ? "line-through" : "none" }}>{g.ad}</span>
            {g.tamamlandi && g.tamamlanmaTarihi && <span style={{ fontSize: 10.5, color: C.textFaint, marginLeft: "auto" }}>{g.tamamlanmaTarihi}</span>}
          </button>
        ))}
      </div>

      {yeniGorevAcik ? (
        <div style={{ display: "flex", gap: 6, marginBottom: hepsiBitti ? 10 : 0 }}>
          <input autoFocus value={yeniGorevAdi} onChange={(e) => setYeniGorevAdi(e.target.value)} onKeyDown={(e) => e.key === "Enter" && gorevEkle()} placeholder="örn. TikTok hesabı açıldı" style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "7px 10px" }} />
          <button style={{ ...btnPrimary, padding: "7px 12px", fontSize: 12 }} onClick={gorevEkle}>Ekle</button>
          <button style={{ ...btnGhost, padding: "7px 12px", fontSize: 12 }} onClick={() => setYeniGorevAcik(false)}>İptal</button>
        </div>
      ) : (
        <button onClick={() => setYeniGorevAcik(true)} style={{ background: "none", border: "none", color: C.accentText, fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: hepsiBitti ? 10 : 0 }}>+ Manuel Görev Ekle</button>
      )}

      {hepsiBitti && (
        <button onClick={tamamla} style={{ ...btnPrimary, width: "100%", justifyContent: "center", background: C.success }}>
          <CheckCircle2 size={14} /> Süreci Tamamla
        </button>
      )}
    </div>
  );
}

function MarkalasmaGorunumu({ surecler, clients, personelRosteri, role, onToggleGorev, onSetYonetici, onAddGorev, onComplete, onDelete }) {
  const liste = surecler || [];
  const tamamlanmaOrani = (s) => {
    if (!s.gorevler || s.gorevler.length === 0) return 0;
    return Math.round((s.gorevler.filter((g) => g.tamamlandi).length / s.gorevler.length) * 100);
  };

  const devamEdenler = liste.filter((s) => !s.tamTamamlandi).sort((a, b) => tamamlanmaOrani(a) - tamamlanmaOrani(b));
  const tamamlananlar = liste.filter((s) => s.tamTamamlandi);

  return (
    <div>
      {liste.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.textFaint, fontSize: 13 }}>
          Henüz markalaşma süreci yok. Müşteriler'e yeni bir marka eklediğinde burada otomatik açılır.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: tamamlananlar.length > 0 ? 24 : 0 }}>
            {devamEdenler.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: C.textFaint, fontSize: 12.5 }}>Devam eden markalaşma süreci yok.</div>
            ) : devamEdenler.map((s) => (
              <MarkalasmaKart key={s.id} s={s} personelRosteri={personelRosteri} role={role} onToggleGorev={onToggleGorev} onSetYonetici={onSetYonetici} onAddGorev={onAddGorev} onComplete={onComplete} />
            ))}
          </div>

          {tamamlananlar.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: C.textFaint, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>Tamamlanan Markalaşma</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tamamlananlar.map((s) => (
                  <div key={s.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color={C.success} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.marka}</div>
                        <div style={{ fontSize: 10.5, color: C.textFaint }}>Tamamlandı: {s.tamamlanmaTarihi}{s.yonetici ? ` · Yönetici: ${s.yonetici}` : ""}</div>
                      </div>
                    </div>
                    {role === "owner" && onDelete && (
                      <button onClick={() => { if (window.confirm(`"${s.marka}" markalaşma sürecini kalıcı olarak silmek istediğine emin misin?`)) onDelete(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={14} color={C.danger} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
