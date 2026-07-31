import React, { useState, useMemo, useEffect } from "react";
import {
  Camera, Plus, X, Clock, AlertTriangle, CheckCircle2, User, Link2,
  MessageSquare, History, ChevronRight, Pencil, Trash2, LayoutGrid, BarChart3, ListTodo,
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

export const ASAMALAR = [
  "Çekim Planlandı", "Çekim Yapıldı", "Dosyalar Aktarıldı", "Edit Bekliyor",
  "Edit Yapılıyor", "Kontrol Bekliyor", "Revize İstendi", "Onaylandı", "Teslim Edildi",
];
const ONCELIKLER = ["Düşük", "Normal", "Yüksek"];
const ONCELIK_RENK = { "Düşük": C.textFaint, "Normal": C.accentText, "Yüksek": C.danger };

const nid = () => Math.random().toString(36).slice(2, 9);
const bugunISO = () => new Date().toISOString().slice(0, 10);
const gunFarki = (tarihISO) => {
  if (!tarihISO) return null;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const t = new Date(tarihISO);
  return Math.round((t - bugun) / 86400000);
};

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
  const n = staffName.trim().toLowerCase();
  return (job.kameraman || "").trim().toLowerCase() === n || (job.editor || "").trim().toLowerCase() === n;
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
  const yuzde = Math.round((ASAMALAR.indexOf(job.asama) / (ASAMALAR.length - 1)) * 100);
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
      <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 8 }}>{job.icerikTuru}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textFaint, marginBottom: 8 }}>
        <span>{job.kameraman || "—"} / {job.editor || "—"}</span>
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
function YeniIsFormu({ clients, onSubmit, onCancel }) {
  const [v, setV] = useState({
    marka: "", icerikTuru: "", cekimTarihi: bugunISO(), teslimTarihi: bugunISO(),
    kameraman: "", editor: "", oncelik: "Normal", istenenAdet: "", brief: "",
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Marka</label><input list="marka-listesi" style={inputStyle} value={v.marka} onChange={(e) => set("marka", e.target.value)} /></div>
        <div><label style={labelStyle}>İçerik Türü</label><input style={inputStyle} placeholder="örn. Reels, Ürün Fotoğrafı" value={v.icerikTuru} onChange={(e) => set("icerikTuru", e.target.value)} /></div>
        <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={v.cekimTarihi} onChange={(e) => set("cekimTarihi", e.target.value)} /></div>
        <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={v.teslimTarihi} onChange={(e) => set("teslimTarihi", e.target.value)} /></div>
        <div><label style={labelStyle}>Sorumlu Kameraman</label><input style={inputStyle} value={v.kameraman} onChange={(e) => set("kameraman", e.target.value)} /></div>
        <div><label style={labelStyle}>Sorumlu Editör</label><input style={inputStyle} value={v.editor} onChange={(e) => set("editor", e.target.value)} /></div>
        <div>
          <label style={labelStyle}>Öncelik</label>
          <select style={inputStyle} value={v.oncelik} onChange={(e) => set("oncelik", e.target.value)}>
            {ONCELIKLER.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>İstenen İçerik Adedi</label><input style={inputStyle} value={v.istenenAdet} onChange={(e) => set("istenenAdet", e.target.value)} placeholder="örn. 6 Reels + 10 Post" /></div>
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
function IsDetayModal({ job, role, staffName, onClose, onUpdate, onDelete }) {
  const [yorum, setYorum] = useState("");
  const [revizeMetni, setRevizeMetni] = useState("");
  const [revizeAciliyor, setRevizeAciliyor] = useState(false);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState({ ...job });

  const yetkili = duzenleyebilirMi(job, role, staffName);
  const aciliyet = aciliyetDurumu(job);
  const stil = ACILIYET_STIL[aciliyet];

  const logKaydet = (aciklama) => {
    const kayit = { id: nid(), tarih: new Date().toLocaleString("tr-TR"), yazan: role === "owner" ? "Yönetici" : (staffName || "Personel"), aciklama };
    return [...(job.gecmis || []), kayit];
  };

  const asamaGecir = (yeniAsama, ekAciklama) => {
    onUpdate(job.id, {
      asama: yeniAsama,
      gecmis: logKaydet(`Aşama değişti: ${job.asama} → ${yeniAsama}${ekAciklama ? " (" + ekAciklama + ")" : ""}`),
    });
  };

  const editiTamamla = () => asamaGecir("Kontrol Bekliyor", "Editi Tamamladım");
  const onayla = () => asamaGecir("Onaylandı");
  const teslimEt = () => asamaGecir("Teslim Edildi");
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

  const suankiIndex = ASAMALAR.indexOf(job.asama);
  const ileriAsama = suankiIndex < ASAMALAR.length - 1 ? ASAMALAR[suankiIndex + 1] : null;

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

        {!yetkili && (
          <div style={{ fontSize: 12, color: C.textFaint, background: C.panelAlt, borderRadius: 9, padding: "8px 11px", marginBottom: 14 }}>
            Bu iş sana atanmadığı için sadece görüntüleyebiliyorsun.
          </div>
        )}

        {duzenle ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Marka</label><input style={inputStyle} value={taslak.marka} onChange={(e) => setTaslak((s) => ({ ...s, marka: e.target.value }))} /></div>
              <div><label style={labelStyle}>İçerik Türü</label><input style={inputStyle} value={taslak.icerikTuru} onChange={(e) => setTaslak((s) => ({ ...s, icerikTuru: e.target.value }))} /></div>
              <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={taslak.cekimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, cekimTarihi: e.target.value }))} /></div>
              <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={taslak.teslimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, teslimTarihi: e.target.value }))} /></div>
              <div><label style={labelStyle}>Kameraman</label><input style={inputStyle} value={taslak.kameraman} onChange={(e) => setTaslak((s) => ({ ...s, kameraman: e.target.value }))} /></div>
              <div><label style={labelStyle}>Editör</label><input style={inputStyle} value={taslak.editor} onChange={(e) => setTaslak((s) => ({ ...s, editor: e.target.value }))} /></div>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, fontSize: 12.5 }}>
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

            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {job.hamDosyaLink && <a href={job.hamDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Ham Dosyalar</a>}
              {job.editliDosyaLink && <a href={job.editliDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Editlenmiş Dosyalar</a>}
            </div>

            {yetkili && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {job.asama === "Edit Yapılıyor" && <button style={btnPrimary} onClick={editiTamamla}><CheckCircle2 size={14} /> Editi Tamamladım</button>}
                {job.asama !== "Edit Yapılıyor" && ileriAsama && !["Onaylandı", "Teslim Edildi"].includes(ileriAsama) && (
                  <button style={btnGhost} onClick={() => asamaGecir(ileriAsama)}><ChevronRight size={14} /> Sonraki Aşamaya Geçir: {ileriAsama}</button>
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
    const n = staffName.trim().toLowerCase();
    return (j.kameraman || "").trim().toLowerCase() === n || (j.editor || "").trim().toLowerCase() === n;
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
        <Kutu label="EDİT BEKLEYEN İŞLER" value={jobs.filter((j) => j.asama === "Edit Bekliyor").length} renk={C.warning} />
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
export default function CekimEditTakibi({ role, clients, jobs, onAddJob, onUpdateJob, onDeleteJob, girisYapanAd }) {
  const [staffName, setStaffNameState] = useState(girisYapanAd || getStaffName());
  const [view, setView] = useState(role === "staff" ? "panom" : "pano");
  const [adding, setAdding] = useState(false);
  const [acikIs, setAcikIs] = useState(null);

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {role === "staff" && (
            <button onClick={() => setView("panom")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "panom" ? C.accentSoft : "transparent", color: view === "panom" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><ListTodo size={14} /> Panom</button>
          )}
          <button onClick={() => setView("pano")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "pano" ? C.accentSoft : "transparent", color: view === "pano" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><LayoutGrid size={14} /> Tüm İşler</button>
          {role === "owner" && (
            <button onClick={() => setView("istatistik")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: view === "istatistik" ? C.accentSoft : "transparent", color: view === "istatistik" ? C.accentText : C.textDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><BarChart3 size={14} /> İstatistikler</button>
          )}
        </div>
        <button style={btnPrimary} onClick={() => setAdding((v) => !v)}><Plus size={14} /> Yeni İş</button>
      </div>

      {adding && <YeniIsFormu clients={clients} onCancel={() => setAdding(false)} onSubmit={(v) => { onAddJob(v); setAdding(false); }} />}

      {view === "panom" && role === "staff" && <PersonelPaneli jobs={isler} staffName={staffName} onOpen={setAcikIs} />}

      {view === "istatistik" && role === "owner" && <YoneticiIstatistik jobs={isler} />}

      {view === "pano" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {ASAMALAR.map((asama) => {
            const buAsamadakiler = isler.filter((j) => j.asama === asama);
            return (
              <div key={asama} style={{ flex: "0 0 240px", minWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textDim }}>{asama}</span>
                  <span style={{ fontSize: 10.5, color: C.textFaint, background: C.panelAlt, padding: "1px 7px", borderRadius: 999 }}>{buAsamadakiler.length}</span>
                </div>
                <div style={{ minHeight: 40 }}>
                  {buAsamadakiler.map((j) => <IsKarti key={j.id} job={j} onClick={() => setAcikIs(j)} />)}
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
          onClose={() => setAcikIs(null)}
          onUpdate={onUpdateJob}
          onDelete={(id) => { onDeleteJob(id); setAcikIs(null); }}
        />
      )}
    </div>
  );
}
