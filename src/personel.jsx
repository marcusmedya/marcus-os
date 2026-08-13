/**
 * PERSONEL VE FREELANCER
 *
 * Kadrolu personel (maaş, ödeme günü, avans, ödeme kaydı) ve freelancer'lar (müşteri
 * kalemleri + Operasyon işlerinden gelen hak ediş, avans, ödeme) tek dosyada.
 *
 * MUHASEBE KURALI — değiştirmeden önce oku: Avans ve ödeme kayıtları Toplam Gider'i
 * DEĞİŞTİRMEZ. Maaş zaten personelGideri içinde, freelancer'ın müşteri kalemi de clientCosts
 * içinde sayılıyor; bunları bir kez daha eklemek aynı parayı iki kez saymak olurdu. Bu
 * kayıtların işi "ödendi mi, ne kadar kaldı" takibi ve paranın çıktığı hesabın bakiyesini
 * azaltmaktır.
 */
import React, { useState } from "react";
import {
  T, Card, KpiCard, SectionTitle, fmt, monthKey, nextId,
  inputStyle, saveBtnStyle, cancelBtnStyle, iconBtnStyle, addBtnStyle,
  AySeciciAlan, tarihGoster, bugunISOTarih, FieldForm, KilitUyarisi, useDuzenlemeKilidi,
} from "./tema.jsx";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { operasyonAylikHakEdis, operasyonKisiIsimleri } from "./CekimEditTakibi.jsx";

/* ------------------------------------------------------------------ */
/* PERSONEL                                                              */
/* ------------------------------------------------------------------ */
export const PERSONEL_FIELDS = [
  { key: "ad", label: "Ad Soyad", type: "text" },
  { key: "pozisyon", label: "Pozisyon", type: "text", placeholder: "örn. Video Editörü" },
  { key: "maas", label: "Net Maaş (₺/ay)", type: "number" },
  { key: "sigorta", label: "SGK / Sigorta (₺/ay)", type: "number" },
  { key: "yemek", label: "Yemek Gideri (₺/ay)", type: "number" },
  { key: "odemeGunu", label: "Maaş Ödeme Günü (ayın kaçı — örn. 5)", type: "number" },
  { key: "tazminatBirikimi", label: "Kıdem Tazminatı Birikimi (₺/ay, opsiyonel)", type: "number" },
  { key: "baslangic", label: "İşe Başlama (YYYY-AA)", type: "text", placeholder: "2026-01" },
];

/* ------------------------------------------------------------------ */
/* AVANS SİSTEMİ                                                         */
/* ------------------------------------------------------------------ */
/**
 * ÖNEMLİ MUHASEBE NOTU
 * Avans YENİ BİR GİDER DEĞİLDİR — maaşın (ya da hak edişin) erken ödenmiş kısmıdır.
 * Bu yüzden Toplam Gider'e ayrıca EKLENMEZ; eklenseydi aynı para iki kez sayılır ve
 * kâr olduğundan düşük görünürdü. Avansın iki gerçek etkisi vardır:
 *   1. Ay sonunda o kişiye ödenecek tutar, avans kadar AZALIR.
 *   2. Avansın çıktığı hesabın bakiyesi, avans kadar AZALIR (gerçekten çıkan para).
 */

/** Bir avans kaydının hangi kişiye ait olduğunu eşleştirir. Kadrolu personel id ile,
 * freelancer isim ile eşleşir — ikisi ayrı sistemler olarak tutulur. */
export function avansKisiyeAitMi(a, { personelId, kisiAd }) {
  if (personelId != null) return a.tur === "personel" && String(a.kisiId) === String(personelId);
  return a.tur === "freelancer" && a.kisiAd === kisiAd;
}

/** Belirli bir ayda, belirli bir kişiye verilen toplam avans. */
export function avansToplami(avanslar, hedef, ay) {
  return (avanslar || [])
    .filter((a) => avansKisiyeAitMi(a, hedef) && (!ay || a.ay === ay))
    .reduce((s, a) => s + (Number(a.tutar) || 0), 0);
}

/** "Avans Ver" formu — tutar, kesileceği ay, çıkacağı hesap ve not. */
export function AvansVerFormu({ kisiAd, hesaplar, varsayilanAy, onKaydet, onKapat }) {
  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState("");
  const [ay, setAy] = useState(varsayilanAy || monthKey());
  const [hesapId, setHesapId] = useState((liste.find((h) => h.anaHesap) || liste[0]).id);
  const [tarih, setTarih] = useState(bugunISOTarih());
  const [not, setNot] = useState("");

  const kaydet = () => {
    const miktar = Number(String(tutar).replace(",", "."));
    if (!miktar || Number.isNaN(miktar) || miktar <= 0) { window.alert("Geçerli bir avans tutarı gir."); return; }
    onKaydet({ tutar: miktar, ay, hesapId, not: not.trim(), tarih });
    onKapat();
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 10 }}>{kisiAd} — Avans Ver</div>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tutar (₺)</label>
          <input autoFocus type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi aydan kesilecek</label>
          <AySeciciAlan value={ay} onChange={setAy} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Avans Tarihi</label>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi hesaptan çıktı</label>
          <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            {liste.map((h) => <option key={h.id} value={h.id}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Not (opsiyonel)</label>
          <input value={not} onChange={(e) => setNot(e.target.value)} placeholder="örn. acil ihtiyaç" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.6, marginBottom: 10 }}>
        Bu tutar Toplam Gider'e ayrıca eklenmez (maaş zaten sayılıyor) — seçtiğin ayın ödemesinden düşülür
        ve seçtiğin hesabın bakiyesinden çıkar.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={saveBtnStyle} onClick={kaydet}>Avansı Kaydet</button>
        <button style={cancelBtnStyle} onClick={onKapat}>İptal</button>
      </div>
    </div>
  );
}

/** Bir kişiye verilmiş avansların listesi — her biri tek tıkla silinebilir (geri alınabilir). */
export function AvansListesi({ kayitlar, hesaplar, onDelete }) {
  if (!kayitlar || kayitlar.length === 0) return null;
  const hesapAdi = (id) => ((hesaplar || []).find((h) => h.id === id) || {}).ad || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {kayitlar.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "Inter", flexWrap: "wrap" }}>
          <span style={{ color: T.textDim }}>
            <span style={{ color: T.textFaint }}>{tarihGoster(a.tarih)}</span>{" · "}
            {hesapAdi(a.hesapId)} hesabından{a.not ? ` · ${a.not}` : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(a.tutar)}</strong>
            {onDelete && (
              <button style={iconBtnStyle} title="Bu avansı sil" onClick={() => { if (window.confirm(`${fmt(a.tutar)} tutarındaki avans silinsin mi? Hesap bakiyesi ve ödenecek tutar eski haline döner.`)) onDelete(a.id); }}>
                <Trash2 size={13} color={T.danger} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAAŞ / HAK EDİŞ ÖDEMELERİ                                             */
/* ------------------------------------------------------------------ */
/**
 * Ödeme kayıtları da avans gibi Toplam Gider'i DEĞİŞTİRMEZ. Sebep:
 *   - Kadrolu personelin maaşı zaten her ay gider sayılıyor (personelGideri)
 *   - Freelancer'ın müşteri maliyeti zaten gider sayılıyor (clientCosts)
 * Ödeme kaydının işi "ödendi mi, ne kadarı kaldı" takibi yapmak ve ödemenin çıktığı
 * hesabın bakiyesini azaltmaktır.
 */
export function odemeKisiyeAitMi(o, { personelId, freelancerId }) {
  if (personelId != null) return o.tur === "personel" && String(o.kisiId) === String(personelId);
  return o.tur === "freelancer" && String(o.kisiId) === String(freelancerId);
}
export function odemeToplami(odemeler, hedef, ay) {
  return (odemeler || [])
    .filter((o) => odemeKisiyeAitMi(o, hedef) && (!ay || o.ay === ay))
    .reduce((s, o) => s + (Number(o.tutar) || 0), 0);
}

/** Maaş ödeme gününe göre durum: henüz vadesi gelmedi / bekliyor / gecikti / ödendi. */
export function maasOdemeDurumu(odemeGunu, kalan, ay) {
  if (kalan <= 0) return { etiket: "Ödendi", renk: T.success };
  const gun = Number(odemeGunu) || 0;
  if (!gun) return { etiket: "Ödeme günü yok", renk: T.textFaint };
  const bugun = new Date();
  const buAy = monthKey(bugun);
  if (ay > buAy) return { etiket: "Gelecek ay", renk: T.textFaint };
  if (ay < buAy) return { etiket: "Gecikti", renk: T.danger };
  const fark = gun - bugun.getDate();
  if (fark > 0) return { etiket: `${fark} gün sonra`, renk: T.textFaint };
  if (fark === 0) return { etiket: "Bugün", renk: T.warning };
  if (fark >= -7) return { etiket: "Bekliyor", renk: T.warning };
  return { etiket: "Gecikti", renk: T.danger };
}

/** Ödeme kaydetme formu — tutar, tarih, hangi hesaptan. */
export function OdemeKaydetFormu({ kisiAd, kalan, hesaplar, ay, onKaydet, onKapat }) {
  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState(String(kalan > 0 ? kalan : ""));
  const [hesapId, setHesapId] = useState((liste.find((h) => h.anaHesap) || liste[0]).id);
  const [tarih, setTarih] = useState(bugunISOTarih());
  const [not, setNot] = useState("");

  const kaydet = () => {
    const miktar = Number(String(tutar).replace(",", "."));
    if (!miktar || Number.isNaN(miktar) || miktar <= 0) { window.alert("Geçerli bir tutar gir."); return; }
    onKaydet({ tutar: miktar, ay, hesapId, tarih, not: not.trim() });
    onKapat();
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 10 }}>{kisiAd} — Ödeme Kaydet</div>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tutar (₺)</label>
          <input autoFocus type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Ödeme Tarihi</label>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi hesaptan</label>
          <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            {liste.map((h) => <option key={h.id} value={h.id}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Not (opsiyonel)</label>
          <input value={not} onChange={(e) => setNot(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={saveBtnStyle} onClick={kaydet}>Ödemeyi Kaydet</button>
        <button style={cancelBtnStyle} onClick={onKapat}>İptal</button>
      </div>
    </div>
  );
}

/** Bir kişiye yapılmış ödemelerin listesi — her biri geri alınabilir. */
export function OdemeListesi({ kayitlar, hesaplar, onDelete }) {
  if (!kayitlar || kayitlar.length === 0) return null;
  const hesapAdi = (id) => ((hesaplar || []).find((h) => h.id === id) || {}).ad || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {kayitlar.map((o) => (
        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "Inter", flexWrap: "wrap" }}>
          <span style={{ color: T.textDim }}>
            <span style={{ color: T.textFaint }}>{tarihGoster(o.tarih)}</span>{" · "}{o.ay}{" · "}{hesapAdi(o.hesapId)} hesabından{o.not ? ` · ${o.not}` : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ color: T.success, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(o.tutar)}</strong>
            {onDelete && (
              <button style={iconBtnStyle} title="Bu ödemeyi geri al" onClick={() => { if (window.confirm(`${fmt(o.tutar)} tutarındaki ödeme silinsin mi? Hesap bakiyesi ve kalan tutar eski haline döner.`)) onDelete(o.id); }}>
                <Trash2 size={13} color={T.danger} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FREELANCER SEKMESİ                                                    */
/* ------------------------------------------------------------------ */
export const FREELANCER_FIELDS = [
  { key: "ad", label: "Ad Soyad", type: "text" },
  { key: "rol", label: "Rol / Uzmanlık", type: "text", placeholder: "örn. Videographer, Grafik Tasarımcı" },
  { key: "telefon", label: "Telefon (opsiyonel)", type: "text" },
  { key: "email", label: "E-posta (opsiyonel)", type: "text" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

/**
 * Freelancer listesi — üç kaynaktan beslenir ve hepsi tek yerde toplanır:
 *   1. Müşteri detayındaki Maliyetler (o kişiye bağlanmış kalemler)
 *   2. Operasyon'da kameraman/editör olarak yaptığı işler (Aylık İş Raporu ile aynı hesap)
 *   3. Elle eklenen kayıtlar
 * Aylık tablo: hak ediş − avans − yapılan ödemeler = kalan.
 */
export function FreelancerBolumu({ freelancerlar, clients, jobs, isUcretleri, isUcretDetaylari, avanslar, odemeler, hesaplar, ay, onAy, onAdd, onUpdate, onDelete, onAddAvans, onDeleteAvans, onAddOdeme, onDeleteOdeme, onAylikRapor }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [acikId, setAcikId] = useState(null);
  const [avansAcikId, setAvansAcikId] = useState(null);
  const [odemeAcikId, setOdemeAcikId] = useState(null);

  const liste = freelancerlar || [];

  /** Bu kişiye bağlanmış müşteri maliyetleri (marka adıyla birlikte). */
  const musteriKalemleri = (f) => (clients || []).flatMap((c) =>
    (c.maliyetler || [])
      .filter((m) => String(m.freelancerId || "") === String(f.id))
      .map((m) => ({ ...m, marka: c.ad }))
  );
  const musteriHakEdis = (f) => musteriKalemleri(f).reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  const operasyon = (f) => operasyonAylikHakEdis(jobs, f.ad, ay, isUcretleri, isUcretDetaylari);
  const hakEdis = (f) => musteriHakEdis(f) + operasyon(f).tutar;
  const avans = (f) => avansToplami(avanslar, { kisiAd: f.ad }, ay);
  const odenen = (f) => odemeToplami(odemeler, { freelancerId: f.id }, ay);
  const kalan = (f) => hakEdis(f) - avans(f) - odenen(f);

  const avansKayitlari = (f) => (avanslar || []).filter((a) => avansKisiyeAitMi(a, { kisiAd: f.ad })).slice().reverse();
  const odemeKayitlari = (f) => (odemeler || []).filter((o) => odemeKisiyeAitMi(o, { freelancerId: f.id })).slice().reverse();

  // Operasyon'da geçen ama kayıtlı olmayan isimler — tek tıkla eklenebilir.
  const kayitliAdlar = new Set(liste.map((f) => (f.ad || "").trim().toLocaleLowerCase("tr")));
  const onerilenler = operasyonKisiIsimleri(jobs).filter((ad) => !kayitliAdlar.has(ad.trim().toLocaleLowerCase("tr")));

  const toplamKalan = liste.reduce((s, f) => s + Math.max(0, kalan(f)), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="FREELANCER SAYISI" value={liste.length} mono={false} />
        <KpiCard label="BU AY ÖDENECEK KALAN" value={fmt(toplamKalan)} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Ay:</span>
          <div style={{ minWidth: 150 }}><AySeciciAlan value={ay} onChange={onAy} /></div>
        </div>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Freelancer ekle</button>
      </Card>

      {onerilenler.length > 0 && (
        <Card style={{ padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", marginBottom: 8, lineHeight: 1.6 }}>
            Operasyon'da bu isimlere iş atanmış ama henüz freelancer olarak kayıtlı değiller. Ekleyince işleri ve hak edişleri
            otomatik buraya bağlanır:
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {onerilenler.map((ad) => (
              <button key={ad} style={addBtnStyle} onClick={() => onAdd({ ad, rol: "", telefon: "", email: "", not: "" })}>
                <Plus size={12} /> {ad}
              </button>
            ))}
          </div>
        </Card>
      )}

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={FREELANCER_FIELDS} onSubmit={(v) => { if (v.ad && v.ad.trim()) { onAdd(v); setAdding(false); } else window.alert("Ad Soyad gerekli."); }} onCancel={() => setAdding(false)} submitLabel="Freelancer'ı Ekle" />
        </div>
      )}

      {liste.length === 0 && !adding && (
        <Card style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.7 }}>
            Henüz freelancer eklenmedi. Ekledikten sonra müşteri detayındaki <strong>Maliyetler</strong> kalemlerini o kişiye
            bağlayabilir, Operasyon'daki işlerini ve ödemelerini tek yerden takip edebilirsin.
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((f) => {
          const acik = acikId === f.id;
          const op = operasyon(f);
          const kalanTutar = kalan(f);
          if (editingId === f.id) {
            return (
              <Card key={f.id} style={{ padding: 14 }}>
                <FieldForm fields={FREELANCER_FIELDS} initial={f} onSubmit={(v) => { onUpdate(f.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              </Card>
            );
          }
          return (
            <Card key={f.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setAcikId(acik ? null : f.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>{f.ad}</div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
                    {f.rol || "Rol belirtilmemiş"}
                    {op.isSayisi > 0 && ` · ${op.isSayisi} iş`}
                    {musteriKalemleri(f).length > 0 && ` · ${musteriKalemleri(f).length} müşteri kalemi`}
                  </div>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>KALAN ÖDENECEK</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: kalanTutar > 0 ? T.warning : T.success }}>{fmt(kalanTutar)}</div>
                  </div>
                  <button style={iconBtnStyle} title="Avans ver" onClick={() => { setAvansAcikId(avansAcikId === f.id ? null : f.id); setOdemeAcikId(null); setAcikId(f.id); }}><Wallet size={14} color={T.textFaint} /></button>
                  <button style={saveBtnStyle} onClick={() => { setOdemeAcikId(odemeAcikId === f.id ? null : f.id); setAvansAcikId(null); setAcikId(f.id); }}>Ödeme Kaydet</button>
                  <button style={iconBtnStyle} onClick={() => setEditingId(f.id)}><Pencil size={14} color={T.textFaint} /></button>
                  <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${f.ad} freelancer kaydı silinsin mi? (Avans ve ödeme kayıtları kalır)`)) onDelete(f.id); }}><Trash2 size={14} color={T.danger} /></button>
                </div>
              </div>

              {(acik || avansAcikId === f.id || odemeAcikId === f.id) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
                  {/* Hak ediş dökümü */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, fontFamily: "Inter", marginBottom: 10 }}>
                    <span style={{ color: T.textDim }}>Müşteri kalemleri: <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(musteriHakEdis(f))}</strong></span>
                    <span style={{ color: T.textDim }}>Operasyon işleri: <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(op.tutar)}</strong></span>
                    <span style={{ color: T.textDim }}>Toplam hak ediş: <strong style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(hakEdis(f))}</strong></span>
                    {avans(f) > 0 && <span style={{ color: T.textDim }}>Avans: <strong style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>−{fmt(avans(f))}</strong></span>}
                    {odenen(f) > 0 && <span style={{ color: T.textDim }}>Ödenen: <strong style={{ color: T.success, fontFamily: "'IBM Plex Mono', monospace" }}>−{fmt(odenen(f))}</strong></span>}
                  </div>

                  {musteriKalemleri(f).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                      {musteriKalemleri(f).map((m) => (
                        <div key={`${m.marka}-${m.id}`} style={{ display: "flex", justifyContent: "space-between", background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontFamily: "Inter" }}>
                          <span style={{ color: T.textDim }}><strong style={{ color: T.text }}>{m.marka}</strong> · {m.kalem}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.text }}>{fmt(m.tutar)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {avansAcikId === f.id && (
                    <AvansVerFormu
                      kisiAd={f.ad}
                      hesaplar={hesaplar}
                      varsayilanAy={ay}
                      onKaydet={(kayit) => onAddAvans({ ...kayit, tur: "freelancer", kisiId: null, kisiAd: f.ad })}
                      onKapat={() => setAvansAcikId(null)}
                    />
                  )}
                  {odemeAcikId === f.id && (
                    <OdemeKaydetFormu
                      kisiAd={f.ad}
                      kalan={kalanTutar}
                      hesaplar={hesaplar}
                      ay={ay}
                      onKaydet={(kayit) => onAddOdeme({ ...kayit, tur: "freelancer", kisiId: f.id, kisiAd: f.ad })}
                      onKapat={() => setOdemeAcikId(null)}
                    />
                  )}

                  <AvansListesi kayitlar={avansKayitlari(f)} hesaplar={hesaplar} onDelete={onDeleteAvans} />
                  <OdemeListesi kayitlar={odemeKayitlari(f)} hesaplar={hesaplar} onDelete={onDeleteOdeme} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Aylık İş Raporu — Operasyon'dan buraya taşındı. Aynı bilgiyi iki ayrı sekmede
        * göstermek "hangisine bakacağım?" sorusunu doğuruyordu; ödemeyle ilgili her şey
        * artık tek yerde. */}
      {onAylikRapor && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 4 }}>Aylık İş Raporu</div>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 12, lineHeight: 1.6 }}>
            Operasyon işlerinden gelen ay bazlı döküm: kim kaç iş yaptı, kaç parça üretti, ne kadar hak etti.
          </div>
          {onAylikRapor}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 12, lineHeight: 1.7 }}>
        Müşteri kalemleri ve Operasyon işleri zaten Toplam Gider'e dahil — buradaki ödeme kayıtları gideri tekrar artırmaz,
        sadece "ödendi mi, ne kadar kaldı" takibi yapar ve ödemenin çıktığı hesabın bakiyesini azaltır.
      </div>
    </div>
  );
}

export function KadroluBolumu({ personel, onAdd, onUpdate, onDelete, duzenleyenAdi, avanslar, hesaplar, onAddAvans, onDeleteAvans, odemeler, onAddOdeme, onDeleteOdeme, avansAy, setAvansAy }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [avansAcikId, setAvansAcikId] = useState(null);   // avans formu açık olan kişi
  const [avansListeId, setAvansListeId] = useState(null); // avans geçmişi açık olan kişi
  const [odemeAcikId, setOdemeAcikId] = useState(null);   // ödeme formu açık olan kişi
  const kilitleyen = useDuzenlemeKilidi("personel", editingId, !!editingId, duzenleyenAdi);
  const kisiMaliyet = (p) => (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0);
  const toplam = personel.reduce((s, p) => s + kisiMaliyet(p), 0);

  // Avans yalnızca yöneticide aktif (onAddAvans sadece owner ekranından geçiriliyor).
  const avansAktif = !!onAddAvans;
  const kisiAvansi = (p) => avansToplami(avanslar, { personelId: p.id }, avansAy);
  const kisiAvansKayitlari = (p) => (avanslar || []).filter((a) => avansKisiyeAitMi(a, { personelId: p.id })).slice().reverse();
  const kisiOdenen = (p) => odemeToplami(odemeler, { personelId: p.id }, avansAy);
  const kisiOdemeKayitlari = (p) => (odemeler || []).filter((o) => odemeKisiyeAitMi(o, { personelId: p.id })).slice().reverse();
  /** Ay sonunda o kişiye HÂLÂ ödenmesi gereken tutar: maaş − avans − yapılan ödemeler. */
  const odenecek = (p) => (Number(p.maas) || 0) - kisiAvansi(p) - kisiOdenen(p);
  const toplamAvans = personel.reduce((s, p) => s + kisiAvansi(p), 0);
  const toplamOdenecek = personel.reduce((s, p) => s + Math.max(0, odenecek(p)), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="EKİP BÜYÜKLÜĞÜ" value={personel.length} mono={false} />
        <KpiCard label="TOPLAM PERSONEL GİDERİ (₺/AY)" value={fmt(toplam)} accent={T.warning} />
        {avansAktif && toplamAvans > 0 && <KpiCard label="VERİLEN AVANS (SEÇİLİ AY)" value={fmt(toplamAvans)} accent={T.warning} />}
        {avansAktif && <KpiCard label="ÖDENECEK KALAN (SEÇİLİ AY)" value={fmt(toplamOdenecek)} accent={T.warning} />}
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {avansAktif ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Avans ayı:</span>
            <div style={{ minWidth: 150 }}><AySeciciAlan value={avansAy} onChange={setAvansAy} /></div>
          </div>
        ) : <span />}
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Personel ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={PERSONEL_FIELDS} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Personeli Ekle" />
        </div>
      )}

      <Card style={{ padding: 4 }}>
        <div className="marcus-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 700 }}>
          <thead>
            <tr>
              {(avansAktif
                ? ["Ad Soyad", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam", "Ödeme Günü", "Avans", "Ödenen", "Kalan", "Durum", ""]
                : ["Ad Soyad", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam", ""]
              ).map((h, i) => (
                <th key={i} style={{ textAlign: i >= 2 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personel.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={8} style={{ padding: "12px 16px" }}>
                    <KilitUyarisi kisi={kilitleyen} />
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
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: p.odemeGunu ? T.textDim : T.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {p.odemeGunu ? `Ayın ${p.odemeGunu}'i` : "—"}
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      <button
                        onClick={() => setAvansListeId(avansListeId === p.id ? null : p.id)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: kisiAvansi(p) > 0 ? T.warning : T.textFaint, fontWeight: kisiAvansi(p) > 0 ? 600 : 400 }}
                        title="Avans geçmişini göster"
                      >
                        {kisiAvansi(p) > 0 ? fmt(kisiAvansi(p)) : "—"}
                      </button>
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: kisiOdenen(p) > 0 ? T.success : T.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {kisiOdenen(p) > 0 ? fmt(kisiOdenen(p)) : "—"}
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: odenecek(p) > 0 ? T.warning : T.success, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                      {fmt(odenecek(p))}
                    </td>
                  )}
                  {avansAktif && (() => {
                    const durum = maasOdemeDurumu(p.odemeGunu, odenecek(p), avansAy);
                    return (
                      <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 11.5, fontFamily: "Inter", color: durum.renk, fontWeight: 600 }}>{durum.etiket}</td>
                    );
                  })()}
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {avansAktif && (
                      <>
                        <button style={iconBtnStyle} title="Avans ver" onClick={() => { setAvansAcikId(avansAcikId === p.id ? null : p.id); setAvansListeId(null); setOdemeAcikId(null); }}><Wallet size={14} color={T.textFaint} /></button>
                        <button style={{ ...saveBtnStyle, marginRight: 6 }} title="Maaş ödemesi kaydet" onClick={() => { setOdemeAcikId(odemeAcikId === p.id ? null : p.id); setAvansAcikId(null); setAvansListeId(null); }}>Öde</button>
                      </>
                    )}
                    <button style={iconBtnStyle} onClick={() => { setEditingId(p.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${p.ad} silinsin mi?`)) onDelete(p.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {avansAktif && personel.map((p) => {
              const formAcik = avansAcikId === p.id;
              const listeAcik = avansListeId === p.id;
              const odemeAcik = odemeAcikId === p.id;
              if (!formAcik && !listeAcik && !odemeAcik) return null;
              return (
                <tr key={`avans-${p.id}`}>
                  <td colSpan={13} style={{ padding: "0 16px 14px" }}>
                    {formAcik && (
                      <AvansVerFormu
                        kisiAd={p.ad}
                        hesaplar={hesaplar}
                        varsayilanAy={avansAy}
                        onKaydet={(kayit) => onAddAvans({ ...kayit, tur: "personel", kisiId: p.id, kisiAd: p.ad })}
                        onKapat={() => setAvansAcikId(null)}
                      />
                    )}
                    {odemeAcik && (
                      <OdemeKaydetFormu
                        kisiAd={p.ad}
                        kalan={odenecek(p)}
                        hesaplar={hesaplar}
                        ay={avansAy}
                        onKaydet={(kayit) => onAddOdeme({ ...kayit, tur: "personel", kisiId: p.id, kisiAd: p.ad })}
                        onKapat={() => setOdemeAcikId(null)}
                      />
                    )}
                    {listeAcik && (
                      <>
                        {kisiAvansKayitlari(p).length === 0 && kisiOdemeKayitlari(p).length === 0 && (
                          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 8 }}>{p.ad} için henüz avans veya ödeme kaydı yok.</div>
                        )}
                        <AvansListesi kayitlar={kisiAvansKayitlari(p)} hesaplar={hesaplar} onDelete={onDeleteAvans} />
                        <OdemeListesi kayitlar={kisiOdemeKayitlari(p)} hesaplar={hesaplar} onDelete={onDeleteOdeme} />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {personel.length === 0 && (
              <tr><td colSpan={avansAktif ? 13 : 8} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Henüz personel eklenmedi.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 10, lineHeight: 1.7 }}>
        Buradaki toplam, Dashboard ve Finans'taki Toplam Gider'e otomatik olarak eklenir.
        {avansAktif && " Avanslar ve ödeme kayıtları Toplam Gider'i DEĞİŞTİRMEZ — maaş zaten sayıldığı için eklenseydi aynı para iki kez sayılırdı. Etkileri iki yerde: \"Kalan\" sütununda ve paranın çıktığı hesabın bakiyesinde."}
      </div>
    </div>
  );
}

/**
 * Personel sekmesi: "Kadrolu" ve "Freelancer" olmak üzere iki bölüm.
 * Ay seçici iki bölüm arasında PAYLAŞILIR — böylece bir aya bakarken sekme değiştirince
 * ay sıfırlanmaz ve iki liste hep aynı dönemi gösterir.
 */
export function Personel(props) {
  const [altSekme, setAltSekme] = useState("kadrolu");
  const [ay, setAy] = useState(monthKey());
  const freelancerAktif = !!props.onAddFreelancer; // yalnızca yönetici ekranında geçiriliyor

  if (!freelancerAktif) return <KadroluBolumu {...props} avansAy={ay} setAvansAy={setAy} />;

  const sekmeler = [
    { key: "kadrolu", label: `Kadrolu (${(props.personel || []).length})` },
    { key: "freelancer", label: `Freelancer (${(props.freelancerlar || []).length})` },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {sekmeler.map((sk) => (
          <button
            key={sk.key}
            onClick={() => setAltSekme(sk.key)}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif",
              fontSize: 13.5, fontWeight: 600,
              background: altSekme === sk.key ? T.accentSoft : "transparent",
              color: altSekme === sk.key ? T.accentText : T.textDim,
            }}
          >
            {sk.label}
          </button>
        ))}
      </div>

      {altSekme === "kadrolu" && <KadroluBolumu {...props} avansAy={ay} setAvansAy={setAy} />}
      {altSekme === "freelancer" && (
        <FreelancerBolumu
          freelancerlar={props.freelancerlar || []}
          clients={props.clients || []}
          jobs={props.jobs || []}
          isUcretleri={props.isUcretleri || {}}
          isUcretDetaylari={props.isUcretDetaylari || {}}
          avanslar={props.avanslar || []}
          odemeler={props.odemeler || []}
          hesaplar={props.hesaplar}
          ay={ay}
          onAy={setAy}
          onAdd={props.onAddFreelancer}
          onUpdate={props.onUpdateFreelancer}
          onDelete={props.onDeleteFreelancer}
          onAddAvans={props.onAddAvans}
          onDeleteAvans={props.onDeleteAvans}
          onAddOdeme={props.onAddOdeme}
          onDeleteOdeme={props.onDeleteOdeme}
          onAylikRapor={props.aylikRapor}
        />
      )}
    </div>
  );
}

