import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Receipt, Landmark, CircleDollarSign, CalendarClock, Wallet, ArrowRightLeft, Percent } from "lucide-react";
import {
  T, Card, SectionTitle, KpiCard, Pill, FieldForm, fmt, computeLive, tarihGoster,
  TR_AYLAR_KISA, clientFaturaliTutar, clientPaymentStatus, monthKey, bugunISOTarih, addBtnStyle,
  inputStyle, saveBtnStyle, cancelBtnStyle,
} from "./tema.jsx";

/**
 * FİNANS — beş sekme.
 *
 * Tek uzun sayfaydı ve bir muhasebe programı gibi görünüyordu. Bir işletme sahibinin ilk
 * bakışta görmesi gereken dört şey vardı: kasada ne var, bu ay ne kazandım, ne kadar
 * giderim oldu, daha ne tahsil edeceğim. Onlar artık ÖZET'te; geri kalan her şey kendi
 * sekmesinde ve hiçbir işlev kaybolmadı.
 *
 * HESAPLAMA MOTORUNA DOKUNULMADI: bütün rakamlar tema.jsx'teki computeLive()'dan geliyor,
 * bu dosya yalnızca gösteriyor.
 */

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
  { key: "tarih", label: "Tarih", type: "date" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "yaklaşıyor", label: "Yaklaşıyor" }, { value: "planlandı", label: "Planlandı" }] },
];
const MONTH_FIELDS = [
  { key: "ay", label: "Ay", type: "text", placeholder: "örn. Ağu" },
  { key: "yil", label: "Yıl", type: "number", placeholder: "örn. 2026" },
  { key: "ciro", label: "Ciro (₺)", type: "number" },
  { key: "gider", label: "Gider (₺)", type: "number" },
];

const FINANS_SEKMELERI = [
  { key: "ozet", label: "Özet" },
  { key: "gelir-gider", label: "Gelir-Gider" },
  { key: "hesaplar", label: "Hesaplar" },
  { key: "vergi", label: "Vergi & Arşiv" },
];

export function MiniList({ title, icon, items, fields, renderRow, onAdd, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card style={{ padding: "18px 22px" }}>
      <SectionTitle action={icon}>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < items.length - 1 ? `1px solid ${T.borderSoft}` : "none", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item)}</div>
            <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu kayıt silinsin mi?")) onDelete(item.id); }}><Trash2 size={13} color={T.danger} /></button>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter", padding: "8px 0" }}>Henüz kayıt yok.</div>}
      </div>
      {adding ? (
        <FieldForm fields={fields} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Ekle" />
      ) : (
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={13} /> {addLabel}</button>
      )}
    </Card>
  );
}

function Karsilastirma({ chartData }) {
  const rows = chartData.filter((m) => m.ay !== undefined);
  const withDelta = rows.map((m, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const ciroDelta = prev && prev.ciro ? Math.round(((m.ciro - prev.ciro) / prev.ciro) * 100) : null;
    return { ...m, ciroDelta };
  });

  const yillikMap = {};
  rows.forEach((m) => {
    const y = m.yil || new Date().getFullYear();
    if (!yillikMap[y]) yillikMap[y] = { yil: y, ciro: 0, gider: 0, net: 0, ayCount: 0 };
    yillikMap[y].ciro += Number(m.ciro) || 0;
    yillikMap[y].gider += Number(m.gider) || 0;
    yillikMap[y].net += Number(m.net) || 0;
    yillikMap[y].ayCount += 1;
  });
  const yillar = Object.values(yillikMap).sort((a, b) => a.yil - b.yil);

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Aylık & Yıllık Karşılaştırma</SectionTitle>

      <div className="marcus-table-wrap" style={{ marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
          <thead>
            <tr>
              {["Ay", "Ciro", "Gider", "Net", "Değişim"].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withDelta.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <td style={{ padding: "6px 10px", fontSize: 13, color: T.text, fontWeight: m.id === "live" ? 600 : 400, fontFamily: "Inter" }}>{m.ay} {m.yil}{m.id === "live" && " (şimdi)"}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.text }}>{fmt(m.ciro)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.textDim }}>{fmt(m.gider)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.success }}>{fmt(m.net)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "Inter" }}>
                  {m.ciroDelta === null ? <span style={{ color: T.textFaint }}>—</span> : <span style={{ color: m.ciroDelta >= 0 ? T.success : T.danger }}>{m.ciroDelta >= 0 ? "+" : ""}{m.ciroDelta}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 10 }}>YILLIK TOPLAMLAR</div>
      {yillar.length < 2 && (
        <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", marginBottom: 8 }}>
          Karşılaştırma için en az 2 yıllık veri gerekiyor — şu an sadece {yillar[0]?.yil} verisi var. Aylar birikince burada geçen yılla otomatik karşılaştırma göreceksin.
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {yillar.map((y, i) => {
          const prevYear = yillar[i - 1];
          const delta = prevYear && prevYear.ciro ? Math.round(((y.ciro - prevYear.ciro) / prevYear.ciro) * 100) : null;
          return (
            <div key={y.yil} style={{ flex: "1 1 160px", minWidth: 160, padding: "12px 15px", background: T.surfaceRaised, borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 6 }}>{y.yil} ({y.ayCount} ay)</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, color: T.text, fontWeight: 600 }}>{fmt(y.ciro)}</div>
              {delta !== null && (
                <div style={{ fontSize: 13, fontFamily: "Inter", color: delta >= 0 ? T.success : T.danger, marginTop: 4 }}>{delta >= 0 ? "+" : ""}{delta}% önceki yıla göre</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* TAKVİM                                                                */
/* ------------------------------------------------------------------ */
const TR_AYLAR_TAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** "26 Ağu" gibi serbest metin tarihleri gün/ay olarak ayrıştırır (yıl bilgisi yoktur, varsayılan olarak yok sayılır). */
/** Bugünün tarihi, tarih seçicilerin (input type="date") beklediği YYYY-AA-GG biçiminde. */
/**
 * Tarihleri ekranda okunur gösterir. Tarih seçicilerden gelen YYYY-AA-GG değerini
 * "26 Ağustos 2026" biçimine çevirir; eski kayıtlardaki serbest metin tarihleri
 * ("26 Ağu", "11.08.2026") olduğu gibi geçirir — geçmiş veri bozulmasın diye.
 */

/** Bir hesabın güncel bakiyesi: o hesaba kaydedilen tüm ödemeler + gelen transferler - giden transferler. */
/**
 * Hesap bakiyesi. Tek tek parametre yerine bir nesne alır — alan sayısı arttıkça
 * sıra karıştırma riski olmasın diye.
 *
 * İKİ MOD:
 *  - Otomatik (varsayılan): müşteri ödemeleri bu hesaba otomatik akar.
 *  - Elle takip (hesap.elleTakip = true): müşteri ödemeleri bu hesaba HİÇ akmaz; bakiye
 *    tamamen senin girdiğin rakamdan ve bu hesap üzerinden yaptığın hareketlerden oluşur.
 *    "Altın Olarak Alındı" gibi banka hesabı olmayan kalemler için uygundur.
 *
 * Her iki modda da: transferler, avanslar ve personel/freelancer ödemeleri bakiyeyi etkiler
 * (bunlar zaten bu kartta bilerek yaptığın hareketler), ve ELLE DÜZELTMELER eklenir.
 *
 * Bakiye hâlâ hiçbir yerde saklanmıyor — elle girdiğin rakam bile bir "düzeltme kaydı"
 * olarak tutuluyor. Bu sayede her işlem geri alınabilir ve neyin nereden geldiği izlenebilir.
 */
function hesapBakiyesi(hesapId, veri = {}) {
  const { clients, transferler, avanslar, odemeler, hesaplar, duzeltmeler } = veri;
  const hesap = (hesaplar || []).find((h) => h.id === hesapId);
  const elleTakip = !!(hesap && hesap.elleTakip);

  const girisler = elleTakip
    ? 0
    : (clients || []).flatMap((c) => c.odemeKayitlari || []).filter((k) => k.hesapId === hesapId).reduce((s, k) => s + (Number(k.tutar) || 0), 0);
  const transferGiris = (transferler || []).filter((t) => t.hedefHesapId === hesapId).reduce((s, t) => s + (Number(t.tutar) || 0), 0);
  const transferCikis = (transferler || []).filter((t) => t.kaynakHesapId === hesapId).reduce((s, t) => s + (Number(t.tutar) || 0), 0);
  // Verilen avanslar o hesaptan ÇIKAN gerçek paradır — bakiyeden düşülür.
  const avansCikis = (avanslar || []).filter((a) => a.hesapId === hesapId).reduce((s, a) => s + (Number(a.tutar) || 0), 0);
  // Personel maaşı / freelancer hak edişi ödemeleri de o hesaptan çıkan gerçek paradır.
  const odemeCikis = (odemeler || []).filter((o) => o.hesapId === hesapId).reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  // Elle yapılan bakiye düzeltmeleri (artı ya da eksi olabilir).
  const duzeltme = (duzeltmeler || []).filter((d) => d.hesapId === hesapId).reduce((s, d) => s + (Number(d.tutar) || 0), 0);

  return girisler + transferGiris - transferCikis - avansCikis - odemeCikis + duzeltme;
}

export function HesapBakiyeleri({ hesaplar, clients, transferler, avanslar, odemeler, duzeltmeler, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
  const [yeniHesapAcik, setYeniHesapAcik] = useState(false);
  const [yeniHesapAdi, setYeniHesapAdi] = useState("");
  const [aktarAcik, setAktarAcik] = useState(null); // aktarılacak hesabın id'si
  const [hedefId, setHedefId] = useState("");
  const [tutarMetni, setTutarMetni] = useState("");
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState(null);   // bakiyesi elle düzenlenen hesap
  const [duzenleTutar, setDuzenleTutar] = useState("");

  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const anaHesap = liste.find((h) => h.anaHesap) || liste[0];
  const hesapAdi = (id) => (liste.find((h) => h.id === id) || {}).ad || "—";
  const kayitlar = transferler || [];

  const aktarimiAc = (h, bakiye) => {
    setAktarAcik(h.id);
    // Varsayılan hedef: ana hesaptan aktarıyorsak ilk alt hesap, değilse ana hesap.
    const varsayilanHedef = h.anaHesap ? (liste.find((x) => !x.anaHesap) || {}).id || "" : anaHesap.id;
    setHedefId(varsayilanHedef);
    setTutarMetni(String(bakiye));
  };

  /** Elle girilen bakiye, mevcut bakiyeyle arasındaki FARK bir "düzeltme kaydı" olarak
   * saklanır. Böylece ekranda tam olarak yazdığın rakam görünür, ama hiçbir hareket
   * kaybolmaz ve düzeltme istediğin an geri alınabilir. */
  const bakiyeyiKaydet = (h, mevcutBakiye) => {
    const hedef = Number(String(duzenleTutar).replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(hedef)) { window.alert("Geçerli bir tutar gir."); return; }
    const fark = hedef - mevcutBakiye;
    if (fark === 0) { setDuzenleId(null); return; }
    onAddDuzeltme({ hesapId: h.id, tutar: fark, tarih: bugunISOTarih(), not: "Elle düzeltme" });
    setDuzenleId(null);
    setDuzenleTutar("");
  };

  const aktarimiOnayla = (kaynak, bakiye) => {
    const tutar = Number(String(tutarMetni).replace(",", "."));
    if (!hedefId) { window.alert("Nereye aktarılacağını seç."); return; }
    if (hedefId === kaynak.id) { window.alert("Kaynak ve hedef hesap aynı olamaz."); return; }
    if (!tutar || Number.isNaN(tutar) || tutar <= 0) { window.alert("Geçerli bir tutar gir."); return; }
    if (tutar > bakiye) { window.alert(`${kaynak.ad} hesabında ${fmt(bakiye)} var — bundan fazlasını aktaramazsın.`); return; }
    onTransfer(kaynak.id, hedefId, tutar);
    setAktarAcik(null);
    setTutarMetni("");
  };

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Hesap Bakiyeleri</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {liste.map((h) => {
          const bakiye = hesapBakiyesi(h.id, { clients, transferler, avanslar, odemeler, hesaplar: liste, duzeltmeler });
          const acik = aktarAcik === h.id;
          return (
            <div key={h.id} style={{ background: h.anaHesap ? T.accentSoft : T.surfaceRaised, borderRadius: 10, padding: "12px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</span>
                    {onUpdateHesap && (
                      <button
                        onClick={() => onUpdateHesap(h.id, { elleTakip: !h.elleTakip })}
                        title={h.elleTakip
                          ? "Şu an elle takip: müşteri ödemeleri bu hesaba otomatik eklenmiyor. Otomatiğe çevirmek için tıkla."
                          : "Şu an otomatik: müşteri ödemeleri bu hesaba akıyor. Elle takibe çevirmek için tıkla."}
                        style={{ background: h.elleTakip ? T.warningSoft : T.surfaceRaised, border: "none", borderRadius: 999, padding: "12px 15px", cursor: "pointer", fontSize: 11, fontFamily: "Inter", color: h.elleTakip ? T.warning : T.textFaint, fontWeight: 600 }}
                      >
                        {h.elleTakip ? "elle takip" : "otomatik"}
                      </button>
                    )}
                  </div>
                  {duzenleId === h.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <input
                        autoFocus
                        type="number"
                        value={duzenleTutar}
                        onChange={(e) => setDuzenleTutar(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") bakiyeyiKaydet(h, bakiye); if (e.key === "Escape") setDuzenleId(null); }}
                        style={{ ...inputStyle, width: 140, marginBottom: 0 }}
                      />
                      <button style={saveBtnStyle} onClick={() => bakiyeyiKaydet(h, bakiye)}>Kaydet</button>
                      <button style={cancelBtnStyle} onClick={() => setDuzenleId(null)}>İptal</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (!onAddDuzeltme) return; setDuzenleId(h.id); setDuzenleTutar(String(bakiye)); setAktarAcik(null); }}
                      title={onAddDuzeltme ? "Bakiyeyi elle düzenlemek için tıkla" : undefined}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 2, cursor: onAddDuzeltme ? "pointer" : "default", fontSize: 15, color: h.anaHesap ? T.accentText : T.text, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {fmt(bakiye)}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Aktarma artık HER hesaptan HER hesaba yapılabiliyor (ana hesap dahil) ve
                    * tutar serbestçe girilebiliyor. Eskiden sadece alt hesaptan ana hesaba,
                    * sadece bakiyenin TAMAMI aktarılabiliyordu — geri almanın hiçbir yolu yoktu. */}
                  {bakiye > 0 && liste.length > 1 && !acik && (
                    <button style={saveBtnStyle} onClick={() => aktarimiAc(h, bakiye)}>Aktar</button>
                  )}
                  {!h.anaHesap && bakiye === 0 && onDeleteHesap && (
                    <button style={iconBtnStyle} title="Hesabı sil" onClick={() => { if (window.confirm(`${h.ad} hesabı silinsin mi?`)) onDeleteHesap(h.id); }}><Trash2 size={14} color={T.danger} /></button>
                  )}
                </div>
              </div>

              {acik && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>Nereye:</span>
                  <select value={hedefId} onChange={(e) => setHedefId(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 160, marginBottom: 0 }}>
                    <option value="">Hesap seç…</option>
                    {liste.filter((x) => x.id !== h.id).map((x) => (
                      <option key={x.id} value={x.id}>{x.ad}{x.anaHesap ? " (Ana Hesap)" : ""}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={tutarMetni}
                    onChange={(e) => setTutarMetni(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") aktarimiOnayla(h, bakiye); }}
                    placeholder="Tutar"
                    style={{ ...inputStyle, width: 130, marginBottom: 0 }}
                  />
                  <button style={cancelBtnStyle} onClick={() => setTutarMetni(String(bakiye))}>Tamamı</button>
                  <button style={saveBtnStyle} onClick={() => aktarimiOnayla(h, bakiye)}>Aktar</button>
                  <button style={cancelBtnStyle} onClick={() => setAktarAcik(null)}>İptal</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onAddDuzeltme && (
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 10, lineHeight: 1.6 }}>
          Bir bakiyeye tıklayarak istediğin rakamı elle yazabilirsin. Yanındaki
          <strong> otomatik / elle takip</strong> düğmesi, müşteri ödemelerinin o hesaba otomatik akıp
          akmayacağını belirler — "Altın Olarak Alındı" gibi banka hesabı olmayan kalemleri
          <strong> elle takip</strong>'e alman mantıklı.
        </div>
      )}

      {yeniHesapAcik ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input autoFocus value={yeniHesapAdi} onChange={(e) => setYeniHesapAdi(e.target.value)} placeholder="örn. Aynur Akyalçın" style={{ ...inputStyle, flex: 1 }} />
          <button style={saveBtnStyle} onClick={() => { if (yeniHesapAdi.trim()) { onAddHesap(yeniHesapAdi.trim()); setYeniHesapAdi(""); setYeniHesapAcik(false); } }}>Ekle</button>
          <button style={cancelBtnStyle} onClick={() => setYeniHesapAcik(false)}>İptal</button>
        </div>
      ) : (
        <button style={addBtnStyle} onClick={() => setYeniHesapAcik(true)}><Plus size={13} /> Yeni Hesap Ekle</button>
      )}

      {/* ELLE DÜZELTME GEÇMİŞİ — elle girdiğin her bakiye burada bir kayıt olarak durur
        * ve geri alınabilir. Bakiye hiçbir yerde "sabit sayı" olarak saklanmadığı için
        * bir düzeltmeyi silmek her şeyi kendiliğinden eski haline döndürür. */}
      {(duzeltmeler || []).length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>Elle Bakiye Düzeltmeleri ({(duzeltmeler || []).length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
            {[...(duzeltmeler || [])].reverse().map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "Inter", flexWrap: "wrap" }}>
                <span style={{ color: T.textDim }}>
                  <span style={{ color: T.textFaint }}>{tarihGoster(d.tarih)}</span>{" · "}{hesapAdi(d.hesapId)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: Number(d.tutar) < 0 ? T.danger : T.success, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {Number(d.tutar) > 0 ? "+" : ""}{fmt(d.tutar)}
                  </strong>
                  {onDeleteDuzeltme && (
                    <button style={iconBtnStyle} title="Bu düzeltmeyi geri al" onClick={() => { if (window.confirm("Bu elle düzeltme geri alınsın mı? Bakiye düzeltme öncesindeki haline döner.")) onDeleteDuzeltme(d.id); }}>
                      <Trash2 size={13} color={T.danger} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSFER GEÇMİŞİ: her aktarım burada kayıtlı ve TEK TIKLA GERİ ALINABİLİR.
        * Eskiden yanlış yapılan bir aktarımı düzeltmenin hiçbir yolu yoktu. */}
      {kayitlar.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
          <button
            onClick={() => setGecmisAcik((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}
          >
            {gecmisAcik ? "▾" : "▸"} Transfer Geçmişi ({kayitlar.length})
          </button>
          {gecmisAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
              {[...kayitlar].reverse().map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "Inter", flexWrap: "wrap" }}>
                  <span style={{ color: T.textDim }}>
                    <span style={{ color: T.textFaint }}>{t.tarih}</span>{" · "}
                    {hesapAdi(t.kaynakHesapId)} <span style={{ color: T.textFaint }}>→</span> {hesapAdi(t.hedefHesapId)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(t.tutar)}</strong>
                    {onDeleteTransfer && (
                      <button
                        style={iconBtnStyle}
                        title="Bu aktarımı geri al"
                        onClick={() => { if (window.confirm(`${fmt(t.tutar)} tutarındaki bu aktarım geri alınsın mı? Tutar ${hesapAdi(t.kaynakHesapId)} hesabına döner.`)) onDeleteTransfer(t.id); }}
                      >
                        <Trash2 size={13} color={T.danger} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function Finans({ data, clients, onAddGelir, onDeleteGelir, onAddGider, onDeleteGider, onAddOfisGider, onDeleteOfisGider, onAddBekleyen, onDeleteBekleyen, onAddVergi, onDeleteVergi, onAddMonth, onDeleteMonth, onCloseMonth, onExport, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
  const [sekme, setSekme] = useState("ozet");
  const { monthly, gelirKalemleri, giderKalemleri, ofisGiderleri, bekleyenTahsilatlar, vergiTakvimi } = data;
  const [addingMonth, setAddingMonth] = useState(false);
  const live = computeLive(data);
  const tahsilatOrani = live.ciro ? Math.round((live.tahsilEdilen / live.ciro) * 100) : 0;
  const chartData = [...monthly, { id: "live", ay: "Bu Ay", yil: new Date().getFullYear(), ciro: live.ciro, gider: live.gider, net: live.net }];

  const clientNames = (clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").map((c) => c.ad);
  const bekleyenFields = clientNames.length
    ? [
        { key: "musteri", label: "Müşteri", type: "select", options: clientNames.map((n) => ({ value: n, label: n })) },
        { key: "tutar", label: "Tutar (₺)", type: "number" },
        { key: "vade", label: "Vade Durumu", type: "text", placeholder: "örn. bugün / 3 gün gecikti" },
      ]
    : BEKLEYEN_FIELDS;

  /* Kasada: her hesabın türetilmiş bakiyesinin toplamı. Hesaplama değiştirilmedi. */
  const kasaToplami = (data.hesaplar || []).reduce((t, h) => t + hesapBakiyesi(h.id, data), 0);
  const ayAdi = `${TR_AYLAR_KISA[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const tahsilToplam = live.tahsilEdilen + live.bekleyenToplam;
  const tahsilOran = tahsilToplam > 0 ? Math.round((live.tahsilEdilen / tahsilToplam) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {FINANS_SEKMELERI.map((s) => (
          <button key={s.key} onClick={() => setSekme(s.key)}
            style={{ padding: "12px 15px", borderRadius: 10, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: sekme === s.key ? T.accentSoft : "transparent", color: sekme === s.key ? T.text : T.textDim, fontSize: 13, fontWeight: sekme === s.key ? 700 : 500, fontFamily: "Inter, sans-serif" }}>
            {s.label}
          </button>
        ))}
      </div>

      {sekme === "ozet" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            <KpiCard label="KASADA" value={fmt(kasaToplami)} accent={T.accentText} buyuk />
            <KpiCard label="BU AY KAZANÇ" value={fmt(live.net)} accent={live.net >= 0 ? T.success : T.danger} buyuk />
            <KpiCard label="TAHSİL EDİLECEK" value={fmt(live.bekleyenToplam)} accent={T.warning} buyuk />
            <KpiCard label="BU AY GİDER" value={fmt(live.gider)} accent={T.danger} buyuk />
          </div>

          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>{ayAdi}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px" }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>Gelir</span>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.ciro)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px" }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>Gider</span>
                <span style={{ fontSize: 13, color: T.danger, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.gider)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 10px", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>Net</span>
                <span style={{ fontSize: 20, color: live.net >= 0 ? T.success : T.danger, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmt(live.net)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surfaceRaised, borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.tahsilEdilen)}</span>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>tahsil edilen</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surfaceRaised, borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliCiro)}</span>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>faturalı ciro</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surfaceRaised, borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.kdvTutari)}</span>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>KDV</span>
              </span>
            </div>
            <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
              Bu ay {fmt(live.ciro)} gelir ürettin, {fmt(live.gider)} giderin var. Net sonucun {fmt(live.net)}.
            </div>
          </Card>

          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>Tahsilat</SectionTitle>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>%{tahsilOran}</div>
            <div style={{ height: 8, borderRadius: 999, background: T.surfaceRaised, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${tahsilOran}%`, height: "100%", background: T.success, borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <span style={{ color: T.textDim }}>{fmt(live.tahsilEdilen)} tahsil edildi</span>
              <span style={{ color: T.warning }}>{fmt(live.bekleyenToplam)} bekliyor</span>
            </div>
          </Card>

<Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Para Nereye Gidiyor? <span style={{ fontWeight: 400, opacity: 0.7 }}>— aylık</span></SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { ad: "Personel", tutar: live.personelGideri, alt: [
              { ad: "Maaş", tutar: live.personelMaas },
              { ad: "SGK / sigorta", tutar: live.personelSigorta },
              { ad: "Yemek", tutar: live.personelYemek },
              { ad: "Kıdem tazminatı birikimi", tutar: live.personelTazminat },
            ] },
            { ad: "Ofis gideri", tutar: live.ofisGiderToplam },
            { ad: "Müşteri maliyetleri", tutar: live.clientCosts },
            { ad: "Üyelikler", tutar: live.uyelikGideri },
            { ad: "Diğer gider kalemleri", tutar: live.giderKalemToplam },
          ].filter((x) => x.tutar > 0).map((x) => (
            <div key={x.ad}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px", borderRadius: 8, background: T.surfaceRaised }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{x.ad}</span>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(x.tutar)}</span>
              </div>
              {(x.alt || []).filter((a) => a.tutar > 0).map((a) => (
                <div key={a.ad} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px", paddingLeft: 24 }}>
                  <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>{a.ad}</span>
                  <span style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(a.tutar)}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 10px", marginTop: 6, borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>Toplam gider</span>
            <span style={{ fontSize: 15, color: T.danger, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmt(live.gider)}</span>
          </div>
        </div>
      </Card>
          {/* PARALARIM — özette yalnızca toplam; hesap dökümü Hesaplar sekmesinde */}
          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>Paralarım</SectionTitle>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(kasaToplami)}</span>
              <button onClick={() => setSekme("hesaplar")} style={{ background: "none", border: "none", color: T.accentText, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 600, padding: 0 }}>Hesap dökümü →</button>
            </div>
          </Card>
        </>
      )}

      {sekme === "gelir-gider" && (
        <>
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
<Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Faturalı İşler <span style={{ fontWeight: 400, opacity: 0.7 }}>— bu ciroyu oluşturanlar</span></SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu" && clientFaturaliTutar(c) > 0).map((c) => {
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
          {clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu" && clientFaturaliTutar(c) > 0).length === 0 && gelirKalemleri.filter((g) => g.faturali !== "hayir").length === 0 && (
            <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", padding: "6px 0" }}>Faturalı işaretlenmiş müşteri/gelir yok.</div>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter", fontWeight: 600, paddingTop: 4, borderTop: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.text }}>= Faturalı Ciro (KDV Dahil)</span>
              <span style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliKdvDahil)}</span>
            </div>
          </div>
        </div>
      </Card>
        </>
      )}

      {sekme === "hesaplar" && (
        <>
<Card style={{ padding: "18px 22px", marginTop: 16 }}>
        <SectionTitle>Banka Hareketleri <span style={{ fontWeight: 400, opacity: 0.7 }}>— Ödeme Takvimi'nde kaydedilen tüm tahsilatlar</span></SectionTitle>
        {(() => {
          const hareketler = (clients || [])
            .flatMap((c) => (c.odemeKayitlari || []).map((k) => ({ ...k, musteri: c.ad })))
            .reverse();
          if (hareketler.length === 0) {
            return <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter" }}>Henüz bir ödeme kaydı yok. Ödeme Takvimi sekmesinden tutar ve banka bilgisiyle kayıt ekleyebilirsin.</div>;
          }
          return (
            <div className="marcus-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
                <thead>
                  <tr>
                    {["Müşteri", "Banka", "Tarih", "Not", "Tutar"].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "6px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hareketler.slice(0, 40).map((h, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.text, fontWeight: 600 }}>{h.musteri}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textDim }}>{h.banka || "—"}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textDim }}>{h.tarih}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textFaint }}>{h.not || ""}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.success, fontWeight: 600 }}>{fmt(h.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
        </>
      )}

      {sekme === "vergi" && (
        <>
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
                <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{tarihGoster(v.tarih)}</div>
              </div>
              {v.durum === "yaklaşıyor" && <Pill color={T.warning} soft={T.warningSoft}>Yaklaşıyor</Pill>}
            </div>
          )}
        />
<Card style={{ padding: "18px 22px" }}>
          <SectionTitle>Gelir & Gider — Son Aylar + Bu Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -18, right: 8 }} barGap={4}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 13 }} />
              <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
              <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", margin: "10px 0 4px" }}>Geçmiş Ay Arşivi <span style={{ opacity: 0.7 }}>— sadece grafikte görünür, güncel hesaplamayı etkilemez</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {monthly.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < monthly.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.ay} {m.yil || ""}</span>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>Ciro {fmt(m.ciro)} · Gider {fmt(m.gider)} · Net {fmt(m.net)}</span>
                <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu ay silinsin mi?")) onDeleteMonth(m.id); }}><Trash2 size={12} color={T.danger} /></button>
              </div>
            ))}
            {monthly.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz geçmiş ay eklenmedi.</div>}
          </div>
          {addingMonth ? (
            <FieldForm fields={MONTH_FIELDS} initial={{ yil: new Date().getFullYear() }} onSubmit={(v) => { onAddMonth(v); setAddingMonth(false); }} onCancel={() => setAddingMonth(false)} submitLabel="Ayı Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingMonth(true)}><Plus size={13} /> Geçmiş ay ekle (arşiv)</button>
          )}
        </Card>

          {/* CSV ve AY KAPATMA — v136'da bu iki işlev Finans'a prop olarak geçiyor ama
            * hiçbir düğmeye bağlı değildi, yani erişilemiyordu. Artık burada. */}
          <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
            <SectionTitle>Arşiv İşlemleri</SectionTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {onExport && (
                <button onClick={onExport} style={addBtnStyle}>CSV olarak dışa aktar</button>
              )}
              {onCloseMonth && (
                <button
                  onClick={() => { if (window.confirm("Bu ay kapatılıp arşive alınacak. Devam edilsin mi?")) onCloseMonth(); }}
                  style={{ ...addBtnStyle, background: T.warningSoft, color: T.warning }}
                >
                  Bu ayı kapat ve arşivle
                </button>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
