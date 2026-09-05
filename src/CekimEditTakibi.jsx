import React, { useState, useMemo, useEffect } from "react";
import { medyaVarMi, asamalariDuzelt, guncelMedyalar, slotGecmisi, slotEtiketi,
         bosSlot, medyaSlotu, STORY_SLOT, EN_FAZLA_SLAYT, enFazlaSlayt, kapakBaglantisi} from "../lib/asamalar.js";
import { videoHataMesaji } from "../lib/video-yon.js";
import { faststartUyarisi } from "../lib/mp4-faststart.js";
import { useSunucuOnizleme, useVideoAdresi, videoEni, oynaticiOrani, gomuluEngelliMi, GOMULU_ACIKLAMA, onizlemeyiTazele } from "./drive.jsx";
import { sunucuyuBekle } from "../lib/onizleme-bellegi.js";
import { isBasladi, isBitti } from "../lib/suren-isler.js";
import { kartiIsleyebilirMi } from "../lib/is-yetkisi.js";
import { yetkiVar } from "../lib/kart-yetkisi.js";
import { markaninIdsi, trKucult } from "../lib/marka-kilidi.js";
import { panoSuzgeci } from "../lib/pano-suzgeci.js";
import { paylasimTuru, PAYLASIM_TURLERI } from "../lib/stok.js";
import { KATEGORILER, kategoriEsle } from "../lib/kategori.js";
import { markaninSubeleri, kullanabilenSubeler, icerikSubeOzeti,
         kapsamiKayipMi, gecersizSubeKimlikleri } from "../lib/sube-kullanimi.js";
// Para gösterimleri Gizlilik Modu'na uymalı — aksi halde ücretler gizliyken de görünür kalırdı.
import { fmt, T, authHeaders, tarihIso } from "./tema.jsx";
import {
  Camera, Plus, X, Clock, AlertTriangle, CheckCircle2, User, Link2,
  MessageSquare, History, ChevronRight, ChevronLeft, Pencil, Trash2, LayoutGrid, BarChart3, ListTodo, Rocket,
  Download, Wallet, UploadCloud, Film, Image as ImageIcon, ExternalLink, Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Bu modül de kendi (App.jsx'ten bağımsız) sade tasarım dilini kullanır. */
/* ------------------------------------------------------------------ */
/* Operasyon'un kendi paleti vardı ve sabit koyu renkler içeriyordu; tema değiştiğinde bu
 * sekme koyu kalıyordu. Artık ortak temadan (T) türetiliyor — get ile okunuyor ki tema
 * değiştiğinde güncel değeri versin. Operasyon'un ayırt edici mavi vurgusu korundu. */
const C = {
  get bg() { return T.bg; },
  get panel() { return T.surface; },
  get panelAlt() { return T.surfaceRaised; },
  get border() { return T.border; },
  get borderSoft() { return T.borderSoft; },
  get text() { return T.text; },
  get textDim() { return T.textDim; },
  get textFaint() { return T.textFaint; },
  get accent() { return T.accent; },
  get accentSoft() { return T.accentSoft; },
  get accentText() { return T.accentText; },
  get success() { return T.success; },
  get successSoft() { return T.successSoft; },
  get danger() { return T.danger; },
  get dangerSoft() { return T.dangerSoft; },
  get warning() { return T.warning; },
  get warningSoft() { return T.warningSoft; },
};

/* Kategoriler artık `lib/kategori.js`'de — sekmeler, stok satırları ve aşama tablosu
 * aynı listeden besleniyor. Ayrı listeler tutulduğunda biri güncellenip diğeri
 * unutuluyordu.
 *
 * DİKKAT: `export { X } from "..."` YEREL BİR BAĞ OLUŞTURMAZ. Bir süre öyle yazıldı ve
 * bu dosyanın kendi içindeki `KATEGORILER` kullanımları tanımsız kaldı — Operasyon
 * bölümü "Can't find variable: KATEGORILER" ile hiç açılmadı. Derleme bunu yakalamıyor.
 * Bu yüzden yukarıda içe aktarılıp buradan yeniden dışa veriliyor. */
export { KATEGORILER };

/** Google Drive paylaşım linkini, sayfa içinde doğrudan oynatılabilir (gömülü) önizleme
 * formatına çevirir. Dönüştürülemezse null döner, o zaman normal link olarak gösterilir. */
function driveEmbedUrl(link) {
  const id = driveDosyaId(link);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}
/** Bir Drive bağlantısından dosya kimliğini (ID) çıkarır. Klasör bağlantılarında null döner —
 * klasörün bir "dosya kimliği" yoktur, önizlenemez. */
function driveDosyaId(link) {
  if (!link) return null;
  if (driveKlasorMu(link)) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
    || link.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
    || link.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}

/** Bağlantı bir Drive KLASÖRÜ mü? Klasörler tek bir görsel olarak gösterilemez. */
function driveKlasorMu(link) {
  return !!link && /\/drive\/(u\/\d+\/)?folders\//.test(link);
}

/**
 * Bir görselin gösterilebileceği ADAY adresler, en güvenilirden en az güvenilire.
 *
 * Neden birden fazla: Google, eski `uc?export=view` adresini artık çoğu durumda doğrudan
 * görsel olarak servis etmiyor — bunun yerine bir yönlendirme/onay sayfası dönüyor ve
 * <img> etiketi sessizce boş kalıyor. `thumbnail` uç noktası bu iş için tasarlandığı
 * için çok daha güvenilir. Hangisinin çalışacağı dosyaya göre değişebildiği için
 * sırayla deniyoruz.
 */
function driveGorselAdaylari(link) {
  const id = driveDosyaId(link);
  if (!id) return [];
  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${id}=w1600`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

/** Eski isim — kodun geri kalanıyla uyum için ilk adayı döndürür. */
function driveGorselUrl(link) {
  const adaylar = driveGorselAdaylari(link);
  return adaylar.length ? adaylar[0] : null;
}

/**
 * Drive görselini gösteren bileşen. Aday adresleri sırayla dener; hepsi başarısız olursa
 * SESSİZCE KAYBOLMAK YERİNE nedenini açıkça yazar.
 *
 * Eskiden `onError` ile görsel gizleniyordu — bu yüzden bir sorun olduğunda ekranda hiçbir
 * iz kalmıyor, "neden görünmüyor?" sorusunun cevabı hiçbir yerde yazmıyordu.
 */
function DriveGorsel({ link, C, yukseklik, kapak, kucuk, isId, icerikId, boyut = 800 }) {
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  /* Önizleme sunucudan geliyor — sebebi ve tek kaynağı için bkz. src/drive.jsx.
   * Kayıt kimliği verilmeyen yerlerde (forma yeni yapıştırılan bağlantı) eski doğrudan
   * yöntem sürüyor; orada sunucunun çözebileceği bir kayıt yok. */
  const { durum: sunucuDurum, veri: sunucu } = useSunucuOnizleme({ isId, icerikId, boyut });

  const kutuStili = {
    width: "100%", borderRadius: kucuk ? 8 : 10, background: C.panelAlt,
    border: `1px dashed ${C.border}`, padding: kucuk ? "10px 12px" : "14px 16px",
    marginBottom: kucuk ? 8 : 0, fontSize: kucuk ? 10.5 : 12, color: C.textFaint, lineHeight: 1.6,
  };

  if (sunucuDurum === "hazir" && sunucu) {
    return (
      <img
        src={sunucu}
        alt="Önizleme"
        style={{
          width: "100%", height: kapak ? yukseklik : undefined, maxHeight: kapak ? undefined : yukseklik,
          objectFit: kapak ? "cover" : "contain", borderRadius: kucuk ? 8 : 10,
          background: C.panelAlt, display: "block", marginBottom: kucuk ? 8 : 0,
        }}
      />
    );
  }
  if (sunucuDurum === "yukleniyor") {
    return (
      <div style={{ width: "100%", height: kapak ? yukseklik : Math.min(yukseklik || 120, 120),
                    borderRadius: kucuk ? 8 : 10, background: C.panelAlt, marginBottom: kucuk ? 8 : 0,
                    display: "grid", placeItems: "center", fontSize: kucuk ? 10.5 : 12, color: C.textFaint }}>
        Önizleme getiriliyor…
      </div>
    );
  }

  if (driveKlasorMu(link)) {
    return (
      <div style={kutuStili}>
        Bu bir Drive <strong>klasör</strong> bağlantısı — klasörler önizlenemez.
        {!kucuk && " Önizleme için tek bir dosyanın bağlantısını yapıştır (dosyaya sağ tık → Bağlantıyı al)."}
      </div>
    );
  }
  if (adaylar.length === 0) {
    return (
      <div style={kutuStili}>
        Bu bağlantıdan bir Drive dosyası tanınamadı — önizleme yapılamıyor.
        {!kucuk && " Bağlantının drive.google.com/file/d/... biçiminde olduğundan emin ol."}
      </div>
    );
  }
  if (sira >= adaylar.length) {
    return (
      <div style={kutuStili}>
        {/* ESKİ METİN KALDIRILDI: "paylaşım ayarını aç" diyordu; bugün bu yanlış bir
            tavsiye — uygulanırsa müşteri dosyaları herkese açılır. */}
        Önizleme getirilemedi. Dosya Drive'da duruyor ve orada açılabiliyor — bu ekranda
        gösterilememesi dosyayla ilgili bir sorun değil.
      </div>
    );
  }

  return (
    <img
      src={adaylar[sira]}
      alt="Editlenmiş görsel önizleme"
      style={{
        width: "100%", height: kapak ? yukseklik : undefined, maxHeight: kapak ? undefined : yukseklik,
        objectFit: kapak ? "cover" : "contain", borderRadius: kucuk ? 8 : 10,
        background: C.panelAlt, display: "block", marginBottom: kucuk ? 8 : 0,
      }}
      referrerPolicy="no-referrer"
      onError={() => setSira((n) => n + 1)}
    />
  );
}

/* DOSYA KONTROLE ÇIKMADAN ÖNCE YÜKLENİR.
 *
 * Kart, dosyası olmadan "Kontrol Bekliyor"a geçebiliyordu; müşterinin önüne bakacak bir şeyi
 * olmayan içerik düşüyordu. Kural artık doğrudan kontrole geçişte uygulanıyor.
 *
 * Bir ara "… Yapıldı" diye ayrı bir sütun denendi ve kaldırıldı: dosya zaten ilk aşamadan
 * itibaren yüklenebiliyor, bir sütun uğruna herkesin fazladan tıklaması anlamsızdı. */
/* AŞAMA LİSTELERİ ARTIK lib/asamalar.js'TE — sunucu da okuyabilsin diye. Buradan yeniden
 * dışa veriliyor ki mevcut çağrı yerleri değişmesin. */
import { ASAMALAR_REELS, ASAMALAR_POST, ASAMALAR, asamaListesi, ILK_ASAMA, yapiliyorAsamasi } from "../lib/asamalar.js";
export { ASAMALAR_REELS, ASAMALAR_POST, ASAMALAR, asamaListesi, ILK_ASAMA };


/** Çıktısı video mu? Fotoğraf ve tasarımın çıktısı GÖRSELDİR; oynatıcı yerine görsel
 * önizleme gösterilmeli. Eskiden "Grafik Tasarım değilse video" varsayılıyordu. */
export const ciktiVideoMu = (kategori) => kategoriEsle(kategori || "Reels") === "Reels";

/** Çekim içeren kategoriler — kameraman alanı yalnızca bunlarda anlamlı. */
export const cekimVarMi = (kategori) => (kategori || "Video") !== "Grafik Tasarım";
/** O kategoride "işin bizzat yapıldığı" aşama — "Tamamladım" butonunun tetiklendiği yer. */
/* KENDİ KOPYASI KALDIRILDI. Buradaki liste bayatlamıştı: eski kategori adlarını
 * taşıyor ve CAROUSEL'i hiç içermiyordu — karosel kartında "üzerinde çalışılıyor"
 * dalı hiç eşleşmiyordu. Tek kaynak lib/asamalar.js. */
const TAMAMLADIM_ETIKETI = { "Video": "Editi Tamamladım", "Fotoğraf": "Düzenlemeyi Tamamladım", "Carousel": "Düzenlemeyi Tamamladım", "Grafik Tasarım": "Tasarımı Tamamladım" };

/* Aşama kuralları lib/asamalar.js'te — sunucu da aynı dosyadan okuyor. İki kopya yazılsaydı
 * biri güncellenip diğeri unutulur, kural sessizce delinirdi. */

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

/* NOT: burada eskiden authHeadersLokal adında yerel bir kopya vardı ve şifreyi
 * localStorage'dan okumaya çalışıyordu. Yönetici şifresi v62'de tarayıcıdan kaldırılıp
 * yerine OTURUM ANAHTARI getirilince bu kopya boş başlık üretmeye başladı — durum
 * bildirimi e-postaları sessizce "Yetkisiz" hatası alıyordu.
 * Artık tema.jsx'teki ortak authHeaders kullanılıyor; tek kopya, tek doğru. */


/** Bir kayıt (iş) düzenleme ekranı açıkken, başka biri de aynı kaydı açtıysa erken uyarı verir. */
function useDuzenlemeKilidi(tur, id, aktifMi, benKimim) {
  const [kilitleyen, setKilitleyen] = useState(null);
  useEffect(() => {
    if (!aktifMi || !id || !benKimim) { setKilitleyen(null); return; }
    let iptal = false;
    const kilitAl = () => {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
    <div style={{ background: "#3a2e12", color: "#e8b84b", padding: "12px 15px", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5, marginBottom: 12 }}>
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

/* Kural lib/is-yetkisi.js'de — tek kaynak, ayrıca Node testinden çağrılabiliyor.
 * Buradaki sarmalayıcı yalnızca çağrı biçimini koruyor. */
function duzenleyebilirMi(job, role, islemYetkisi) {
  return kartiIsleyebilirMi(role, islemYetkisi);
}

const inputStyle = { width: "100%", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 10px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" };
const labelStyle = { fontSize: 11, color: C.textFaint, fontWeight: 600, display: "block", marginBottom: 4 };
const btnPrimary = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnGhost = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" };
/* Koşul sağlanmadığı için kapalı duran düğme — gizlemek yerine kapatıyoruz ki
 * kullanıcı düğmenin var olduğunu görsün, sebebini de üstündeki uyarıdan okusun. */
const kapaliBtn = { ...btnPrimary, background: C.border, color: C.textFaint, cursor: "not-allowed" };

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
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${stil.color}`, borderRadius: 12, padding: "12px 15px", marginBottom: 10, cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{job.marka}</div>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: ONCELIK_RENK[job.oncelik], flexShrink: 0, marginTop: 4 }} title={`Öncelik: ${job.oncelik}`} />
      </div>
      {!ciktiVideoMu(job.kategori) && job.editliDosyaLink && (
        <DriveGorsel link={job.editliDosyaLink} C={C} yukseklik={110} kapak kucuk isId={job.id} boyut={400} />
      )}
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span>{job.icerikTuru}{job.kategori ? ` · ${job.kategori}` : ""}</span>
        {/* Kaç kez revize edildiği panodan görünsün — kartı açmadan fark edilsin.
          * İkinci turdan itibaren çıkar; ilk revize normal sayılır. */}
        {Number(job.revizeSayisi) > 1 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: C.dangerSoft, borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap" }} title={`${job.revizeSayisi} kez revize istendi`}>
            ↻ {job.revizeSayisi}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textFaint, marginBottom: 8 }}>
        <span>{job.kameraman || job.editor || "—"}{cekimVarMi(job.kategori) && job.editor ? ` / ${job.editor}` : ""}</span>
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
          <button type="button" onClick={() => { setElleYaz(false); onChange(""); }} style={{ background: "none", border: "none", color: C.accentText, fontSize: 11, cursor: "pointer", padding: "4px 0 0", fontFamily: "inherit" }}>
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

/**
 * MARKA SEÇİCİ
 *
 * Marka eskiden serbest metindi. İşler markayı METİN olarak tuttuğu ve müşteri paneline
 * düşme kararı bu metnin müşteri kaydıyla eşleşmesine bağlı olduğu için, tek bir yazım farkı
 * ("KANATÇI DIREN", çift boşluk, Türkçe karakter yazılmaması) kartın müşteriye hiç
 * gitmemesine yol açıyordu — sessizce.
 *
 * Artık listeden seçiliyor: yazım farkı doğması mümkün değil. Müşteri olmayan işler için
 * "Diğer" seçeneği duruyor, o zaman serbest metin alanı açılıyor.
 */
function MarkaSeciciAlan({ clients, deger, onDegis }) {
  const adlar = (clients || []).map((c) => c.ad);
  const listedeVar = adlar.some((a) => a === deger);
  const [serbest, setSerbest] = useState(!!deger && !listedeVar);

  return (
    <div>
      <label style={labelStyle}>Marka</label>
      <select
        style={inputStyle}
        value={serbest ? "__diger__" : (deger || "")}
        onChange={(e) => {
          if (e.target.value === "__diger__") { setSerbest(true); onDegis(""); }
          else { setSerbest(false); onDegis(e.target.value); }
        }}
      >
        <option value="">— Marka seç —</option>
        {adlar.map((a) => <option key={a} value={a}>{a}</option>)}
        <option value="__diger__">Diğer (elle yaz)</option>
      </select>
      {serbest && (
        <input
          style={{ ...inputStyle, marginTop: 6 }}
          value={deger || ""}
          placeholder="Marka adını yaz"
          onChange={(e) => onDegis(e.target.value)}
        />
      )}
      {serbest && (
        <div style={{ fontSize: 11, color: C.warning, marginTop: 4, fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
          Bu marka müşteri listende yok — bu kart müşteri paneline düşmez.
        </div>
      )}
    </div>
  );
}

function YeniIsFormu({ clients, subeler, personelRosteri, varsayilanKategori, onSubmit, onCancel }) {
  const [v, setV] = useState({
    kategori: varsayilanKategori || "Video",
    marka: "", icerikTuru: "", cekimTarihi: bugunISO(), teslimTarihi: bugunISO(),
    kameraman: "", editor: "", oncelik: "Normal", istenenAdet: "", uretilenAdet: "", brief: "",
    sadeceSubeler: [],
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const video = cekimVarMi(v.kategori); // çekim alanları (kameraman, çekim tarihi) gösterilsin mi

  /* ŞUBE KAPSAMI OLUŞTURMA ANINDA.
   *
   * Kapsam yalnızca düzenleme ekranında seçilebiliyordu; şubeye özel bir içerik için
   * önce kartı açıp sonra Düzenle'ye girmek gerekiyordu. Oysa "bu iş Lara için" bilgisi
   * işin en başında biliniyor — burada seçilirse kart daha ilk onayında doğru şubenin
   * stoğunu artırır, sonradan düzeltme gerekmez.
   *
   * Marka değişince seçim sıfırlanıyor: başka markanın şube kimlikleri taşınırsa kart
   * hiçbir şubenin kullanamadığı bir içeriğe dönüşür. */
  const markaId = markaninIdsi(clients, v.marka);
  const markaSubeleri = markaninSubeleri(subeler, markaId);
  const markaSec = (x) => setV((s) => ({ ...s, marka: x, sadeceSubeler: [] }));
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
        <MarkaSeciciAlan clients={clients} deger={v.marka} onDegis={markaSec} />
        <div><label style={labelStyle}>İçerik / Talep Türü</label><input style={inputStyle} placeholder={video ? "örn. Reels, Ürün Fotoğrafı" : "örn. Post Tasarımı, Banner"} value={v.icerikTuru} onChange={(e) => set("icerikTuru", e.target.value)} /></div>
        {video && <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={v.cekimTarihi} onChange={(e) => set("cekimTarihi", e.target.value)} /></div>}
        <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={v.teslimTarihi} onChange={(e) => set("teslimTarihi", e.target.value)} /></div>
        {video && <div><label style={labelStyle}>Sorumlu Kameraman</label><PersonelSecici value={v.kameraman} onChange={(val) => set("kameraman", val)} personelRosteri={personelRosteri} /></div>}
        <div><label style={labelStyle}>{v.kategori === "Grafik Tasarım" ? "Sorumlu Tasarımcı" : (v.kategori === "Fotoğraf" || v.kategori === "Carousel") ? "Sorumlu Düzenleyen" : "Sorumlu Editör"}</label><PersonelSecici value={v.editor} onChange={(val) => set("editor", val)} personelRosteri={personelRosteri} /></div>
        <div>
          <label style={labelStyle}>Öncelik</label>
          <select style={inputStyle} value={v.oncelik} onChange={(e) => set("oncelik", e.target.value)}>
            {ONCELIKLER.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>İstenen Adet</label><input style={inputStyle} value={v.istenenAdet} onChange={(e) => set("istenenAdet", e.target.value)} placeholder={video ? "örn. 6 Reels + 10 Post" : "örn. 4 Post + 2 Banner"} /></div>
        <div><label style={labelStyle}>Kaç Parça? (rapor için)</label><input type="number" min="0" style={inputStyle} value={v.uretilenAdet} onChange={(e) => set("uretilenAdet", e.target.value)} placeholder="örn. 10" /></div>
      </div>
      {markaSubeleri.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Hangi şubeler kullanabilir?</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ id: null, ad: "Tüm şubeler" }, ...markaSubeleri].map((sb) => {
              const hepsi = sb.id === null;
              const aktif = hepsi ? v.sadeceSubeler.length === 0 : v.sadeceSubeler.includes(String(sb.id));
              return (
                <button
                  key={hepsi ? "hepsi" : sb.id}
                  onClick={() => setV((st) => {
                    if (hepsi) return { ...st, sadeceSubeler: [] };
                    const id = String(sb.id);
                    const su = st.sadeceSubeler;
                    return { ...st, sadeceSubeler: su.includes(id) ? su.filter((x) => x !== id) : [...su, id] };
                  })}
                  style={{ padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1.5px solid ${aktif ? C.accent : C.border}`, background: aktif ? C.accentSoft : "transparent", color: aktif ? C.accentText : C.textDim }}
                >{sb.ad}</button>
              );
            })}
          </div>
        </div>
      )}
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
/**
 * KART İÇİ MEDYA: yükleme, önizleme, versiyon geçmişi.
 *
 * AMAÇ: personel Drive'a hiç girmesin. Dosyayı buradan yükler, buradan izler, revize gelirse
 * buradan yeni versiyon atar. Drive arka planda arşiv olarak kalır.
 *
 * DOSYA SUNUCUDAN GEÇMEZ: sunucudan yalnızca bir yükleme adresi alınır, baytlar tarayıcıdan
 * doğrudan Google'a gider. Vercel'in ~4.5 MB istek sınırı bu yüzden devrede değil — 80 MB'lık
 * bir Reels videosu sorunsuz yüklenir.
 */
/**
 * ÖNİZLEME — DRIVE'IN GÖMÜLÜ OYNATICISI YERİNE SUNUCUDAN GELEN GÖRSEL.
 *
 * NEDEN DEĞİŞTİ: dosyalar Drive'da bilerek KISITLI (daha önce "bağlantısı olan herkes"
 * ayarındaydı, 17 müşterinin içeriği açıktaydı). Kısıtlı bir dosyayı gömülü çerçevede
 * göstermek, tarayıcının Google oturumuna erişebilmesini gerektiriyor. Safari üçüncü taraf
 * çerezleri varsayılan olarak engellediği için bu çalışmıyor: çerçevede siyah bir kutu ve
 * Google logosu çıkıyor, içerik hiç görünmüyor. Gerçek kartta böyle yaşandı.
 *
 * Bu yüzden GÖRÜNTÜ sunucudan, uygulamanın kendi yetkisiyle alınıp buraya veri olarak
 * geliyor — tarayıcının Google oturumuna hiç ihtiyaç kalmıyor, her tarayıcıda çalışıyor.
 *
 * VİDEO ayrı bir durum: 80 MB'lık bir dosyayı sunucudan geçirmek ne hızlı ne de ucuz.
 * Videoda ilk kare gösteriliyor ve izlemek için Drive'a yönlendiriliyor — yeni sekmede
 * Google kendi oturumunu kullanabildiği için orada sorun çıkmıyor. Gömülü oynatıcı isteyen
 * için ayrıca bir düğme var; Chrome'da çalışıyor.
 */
function SunucuOnizleme({ isId, slot, versiyon, video, drivedeAc, gomuluUrl, yon }) {
  const { durum, veri } = useSunucuOnizleme({ isId, slot, boyut: 1200 });
  const akis = useVideoAdresi(video ? { isId, slot } : {});
  const [gomulu, setGomulu] = useState(false);
  const [oran, setOran] = useState(null);
  /* OYNATMA HATASI GÖRÜNÜR OLMALI. Hata yakalanmadığında ekran sessizce siyah kalıyordu;
   * ne kullanıcı ne de geliştirici ne olduğunu görebiliyordu — "neden oynamıyor" sorusu
   * üç tur boyunca tahminle cevaplandı. `deneme` sayacı adrese eklenip önbelleği atlıyor:
   * bozuk bir yanıt önbelleğe girmişse tekrar denemek onu aşabilsin. */
  const [videoHatasi, setVideoHatasi] = useState(null);
  const [deneme, setDeneme] = useState(0);
  useEffect(() => { setVideoHatasi(null); }, [akis.adres]);
  /* Slot değişince gömülü oynatıcı tercihi sıfırlanır — 3. slayttan story boyutuna
   * geçildiğinde önceki karenin durumu taşınmasın. */
  useEffect(() => { setGomulu(false); }, [isId, slot, versiyon]);

  /* VİDEO: gerçek <video> etiketi. Gömülü Drive oynatıcısı üçüncü taraf çerezi istiyor ve
   * Safari'de siyah kalıyordu; kendi sunucumuzdan akıtınca o sorun yok. Ayrıca oynatıcı
   * videonun KENDİ en-boy oranını alıyor — dikey Reels dikey görünüyor. */
  /* HATA VARSA OYNATICI YERİNE SEBEP GÖSTERİLİYOR — siyah kutu hiçbir şey söylemiyordu. */
  if (video && videoHatasi !== null && akis.adres) {
    return (
      <div style={{ maxWidth: videoEni(oran), margin: "0 auto", width: "100%",
        padding: "14px 16px", borderRadius: 8, background: C.panel, border: `1px solid ${C.border}` }}>
        <div style={{ color: C.warning || "#F59E0B", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Video oynatılamadı
        </div>
        <div style={{ color: C.textDim, fontSize: 12.5, lineHeight: 1.6, marginBottom: 10 }}>
          {videoHataMesaji(videoHatasi)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setVideoHatasi(null); setDeneme((n) => n + 1); }}
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "6px 10px", color: C.text, fontSize: 12, cursor: "pointer", fontFamily: "Inter" }}
          >Tekrar dene</button>
          {drivedeAc && (
            <a href={drivedeAc} target="_blank" rel="noreferrer"
              style={{ padding: "6px 10px", fontSize: 12, color: C.accent || "#6366F1", textDecoration: "none" }}
            >Drive'da Aç ↗</a>
          )}
        </div>
      </div>
    );
  }

  if (video && akis.durum === "hazir" && akis.adres && !gomulu) {
    /* GENİŞLİK VİDEONUN KENDİ ORANINDAN GELİYOR, elle girilen bir "yön" ayarından değil.
     * Dikey bir Reels geniş çerçevede ya devasa çıkıyor ya iki yanı siyah bantla doluyordu.
     * Oran metadata ile geldiği an kutu ona göre daralıyor. */
    return (
      <div style={{ maxWidth: videoEni(oran), margin: "0 auto", width: "100%" }}>
        <video
          key={deneme}
          src={deneme > 0 ? `${akis.adres}&deneme=${deneme}` : akis.adres}
          onError={(e) => {
            const h = e.currentTarget.error;
            setVideoHatasi(h ? h.code : 0);
          }}
          poster={durum === "hazir" ? veri : undefined}
          controls
          playsInline
          /* ARABELLEK KART AÇILIR AÇILMAZ BAŞLIYOR.
            *
            * `metadata` yalnızca başlık bilgisini indiriyordu; kullanıcı oynata basınca
            * ilk parça O AN isteniyor ve bekleme orada yaşanıyordu. Kart detayında tek
            * video açık oluyor, önden arabelleğe almanın maliyeti düşük — listelerde
            * BÖYLE YAPILMIYOR, orada onlarca video aynı anda indirmeye başlardı. */
          preload="auto"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setOran(v.videoWidth / v.videoHeight);
          }}
          /* Oran ilk karede veriliyor — yoksa kutu poster görselinin oranını alıp sonra
            * metadata gelince atlıyor ("önce yatay, sonra dikey"). */
          style={{ width: "100%", maxHeight: "70vh", borderRadius: 8, background: "#000",
            display: "block", aspectRatio: oynaticiOrani(oran, yon), objectFit: "contain" }}
        />
        {/* "VİDEO NEDEN GEÇ AÇILIYOR" — cevabı burada.
          * Oynatma bilgisi dosyanın sonundaysa tarayıcı önce sonu indirmek zorunda ve
          * bekleme onlarca saniyeye çıkabiliyor. Teşhis yapılamadıysa hiçbir şey
          * yazılmıyor — yanlış uyarı, uyarı olmamasından kötü. */}
        {faststartUyarisi(akis.hizliBaslangic) && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.textFaint, lineHeight: 1.5 }}>
            {faststartUyarisi(akis.hizliBaslangic)}
          </div>
        )}
      </div>
    );
  }

  const kutu = {
    width: "100%", borderRadius: 8, background: C.panel,
    border: `1px solid ${C.border}`, overflow: "hidden",
  };

  if (gomulu) {
    return (
      <div>
        <iframe
          title={`medya-${isId}-${versiyon}`}
          src={gomuluUrl}
          allow="autoplay; fullscreen"
          style={{ width: "100%", height: video ? 380 : 300, border: "none", borderRadius: 8, background: "#000" }}
        />
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 6, lineHeight: 1.5 }}>
          {GOMULU_ACIKLAMA}
          <button onClick={() => setGomulu(false)}
                  style={{ ...btnGhost, padding: "4px 8px", fontSize: 11, marginLeft: 8, display: "inline-flex" }}>
            Görsel önizlemeye dön
          </button>
        </div>
      </div>
    );
  }

  if (durum === "hazir") {
    return (
      <div>
        <div style={{ ...kutu, position: "relative", display: "grid", placeItems: "center", background: "#000" }}>
          <img src={veri} alt="" style={{ width: "100%", maxHeight: video ? 380 : 420, objectFit: "contain", display: "block" }} />
          {video && (
            <a href={drivedeAc} target="_blank" rel="noreferrer"
               style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textDecoration: "none" }}>
              <span style={{ background: "rgba(0,0,0,.62)", color: "#fff", borderRadius: 999, padding: "12px 18px",
                             fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <Film size={15} /> Drive'da Aç ve İzle
              </span>
            </a>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C.textFaint }}>
            {!video ? "Görsel Drive'dan getirildi."
              : akis.durum === "yukleniyor" ? "Oynatıcı hazırlanıyor…"
              : "Oynatıcı kurulamadı — ilk kare gösteriliyor, izlemek için Drive'da aç."}
          </span>
          {/* Düğme gizlenmiyor ama NE OLACAĞI önceden söyleniyor — Safari'de bu yol ölü.
              Sessiz bırakmak, kullanıcıyı aynı siyah kutuyu tekrar tekrar açmaya iter. */}
          <button onClick={() => setGomulu(true)}
                  title={gomuluEngelliMi() ? GOMULU_ACIKLAMA : ""}
                  style={{ ...btnGhost, padding: "4px 8px", fontSize: 11 }}>
            {gomuluEngelliMi() ? "Gömülü oynatıcıyı dene (bu tarayıcıda çalışmaz)" : "Gömülü oynatıcıyı dene"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...kutu, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
        {durum === "yukleniyor"
          ? "Önizleme getiriliyor…"
          : <>Önizleme getirilemedi. Dosya Drive'da duruyor — <a href={drivedeAc} target="_blank" rel="noreferrer" style={{ color: C.accentText }}>Drive'da Aç</a> ile bakabilirsin.</>}
      </div>
      {durum !== "yukleniyor" && (
        <button onClick={() => setGomulu(true)} title={gomuluEngelliMi() ? GOMULU_ACIKLAMA : ""}
                style={{ ...btnGhost, marginTop: 10, display: "inline-flex", fontSize: 12 }}>
          {gomuluEngelliMi() ? "Gömülü oynatıcıyı dene (bu tarayıcıda çalışmaz)" : "Gömülü oynatıcıyı dene"}
        </button>
      )}
    </div>
  );
}

/**
 * KART İÇİ MEDYA — ÇOK SLOTLU.
 *
 * Bir kart artık birden çok dosya taşıyabiliyor. İki eksen ayrı:
 *   slot     -> aynı gönderinin parçaları ("1".."10" karosel slaytları, "story" boyutu)
 *   versiyon -> aynı parçanın revizyon geçmişi
 *
 * Eskiden ikinci dosya yüklendiğinde birincisi "eski versiyon" oluyordu; karosel gönderide
 * 8 slayt birbirini eziyordu. Artık her slaydın kendi versiyon geçmişi var.
 */
function MedyaYukleyici({ job, onYuklendi, onMedyaDegis, duzenlenebilir }) {
  /* Kategorinin slayt sınırı. Fotoğraf tek görsellik — çoklu gönderi Carousel'in işi. */
  const slaytSiniri = enFazlaSlayt(job && job.kategori);
  const slotlar = useMemo(() => guncelMedyalar(job), [job]);
  const [acikSlot, setAcikSlot] = useState(null);      // büyük önizlemesi açık olan slot
  const [gecmisSlot, setGecmisSlot] = useState(null);  // versiyon geçmişi açık olan slot

  const [durum, setDurum] = useState("bos");      // bos | hazirlaniyor | yukleniyor | bitiyor | hata
  const [yuzde, setYuzde] = useState(0);
  const [hata, setHata] = useState("");
  const [sira, setSira] = useState(null);         // çoklu yüklemede "3/8" göstergesi
  const girdiRef = React.useRef(null);
  const hedefSlotRef = React.useRef(null);        // null = boş slotlara sırayla dağıt

  const meshgul = durum === "hazirlaniyor" || durum === "yukleniyor" || durum === "bitiyor" || durum === "siliniyor";

  /** Tek bir dosyayı verilen slota yükler. Yeni medya kaydını döndürür. */
  async function dosyayiYukle(dosya, slot) {
    // 1) Sunucudan yükleme adresi al (hedef klasörü ve versiyon numarasını o belirliyor)
    const istekGovdesi = {
      driveAction: "yuklemeBasla", isId: job.id, slot,
      dosyaAdi: dosya.name, mimeTur: dosya.type, boyut: dosya.size,
    };
    const yanit = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(istekGovdesi),
    });
    /* Oturum düşmüşse sunucu "Yetkisiz. Şifre gerekli." diyor. Bu cümle geliştirici
     * diliyle yazılmış; dosya yüklemeye çalışan personele bir şey anlatmıyor. */
    if (yanit.status === 401 || yanit.status === 403) {
      throw new Error("Oturumun düşmüş görünüyor. Çıkıp tekrar giriş yap, sonra dosyayı yeniden seç.");
    }
    const basla = await yanit.json();
    if (!basla.ok) throw new Error(basla.error || "Yükleme başlatılamadı.");

    // 2) Baytları DOĞRUDAN Google'a gönder.
    //
    //    İKİ YÖNTEM DENENİYOR. XMLHttpRequest tercih ediliyor çünkü ilerlemeyi bildiren tek
    //    yol o — fetch ile 80 MB'lık bir videoda kullanıcı donmuş sanıyor. Ama XHR bazı
    //    tarayıcı/eklenti kurulumlarında sebep söylemeden düşebiliyor; o durumda fetch ile
    //    bir kez daha deneniyor.
    setDurum("yukleniyor");

    const xhrIleGonder = (url) => new Promise((coz, red) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url, true);
      x.setRequestHeader("Content-Type", dosya.type || "application/octet-stream");
      x.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setYuzde(Math.round((ev.loaded / ev.total) * 100));
      };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) {
          try { coz(JSON.parse(x.responseText).id); }
          catch (err) { red(new Error(`Google beklenmedik yanıt verdi: ${String(x.responseText).slice(0, 120)}`)); }
        } else {
          red(new Error(`Google reddetti (HTTP ${x.status}): ${String(x.responseText).slice(0, 160)}`));
        }
      };
      x.onerror = () => red(new Error("XHR-AGHATASI"));
      x.onabort = () => red(new Error("Yükleme iptal edildi."));
      x.send(dosya);
    });

    /* Ok işlevi yerine `async function`: denetleyici `= async (` kalıbını çağrı sanıp
     * yanlış alarm veriyor. Davranış aynı. */
    async function fetchIleGonder(url) {
      const y = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": dosya.type || "application/octet-stream" },
        body: dosya,
      });
      const metin = await y.text();
      if (!y.ok) throw new Error(`Google reddetti (HTTP ${y.status}): ${metin.slice(0, 160)}`);
      try { return JSON.parse(metin).id; }
      catch (err) { throw new Error(`Google beklenmedik yanıt verdi: ${metin.slice(0, 120)}`); }
    }

    let dosyaId;
    try {
      dosyaId = await xhrIleGonder(basla.yuklemeUrl);
    } catch (e1) {
      if (String(e1.message) !== "XHR-AGHATASI") throw e1;
      /* XHR sebep söylemeden düştü. Yükleme oturumu tek kullanımlık olduğu için YENİSİNİ
       * alıp fetch ile deniyoruz; fetch'in hata metni neyin engellediğini söyler. */
      setYuzde(0);
      const tekrar = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(istekGovdesi),
      }).then((r) => r.json());
      if (!tekrar.ok) throw new Error(tekrar.error || "Yükleme başlatılamadı.");
      try {
        dosyaId = await fetchIleGonder(tekrar.yuklemeUrl);
      } catch (e2) {
        throw new Error(`Tarayıcı Google'a ulaşamadı. ${e2.message || e2}`);
      }
    }

    // 3) Sunucuya bildir: servis hesabına yetki verilir
    setDurum("bitiyor"); setYuzde(100);
    const bitti = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ driveAction: "yuklemeBitti", isId: job.id, dosyaId }),
    }).then((r) => r.json());
    if (!bitti.ok) throw new Error(bitti.error || "Kayıt tamamlanamadı.");

    /* Kayıt uygulamanın NORMAL akışından geçiyor (onYuklendi -> onUpdate), sunucu kendi
     * başına yazmıyor. Sebebi: sunucu ikinci bir yazma yaparsa sürüm sayacı artar, tarayıcı
     * geride kalır ve sonraki kayıt sahte çakışmayla kullanıcının düzenlemesini siler. */
    return {
      slot: basla.slot || slot,
      versiyon: basla.versiyon,
      dosyaId: bitti.dosya.dosyaId,
      ad: bitti.dosya.ad,
      mimeTur: bitti.dosya.mimeTur,
      boyut: bitti.dosya.boyut,
      url: bitti.dosya.url,
      tarih: new Date().toISOString(),
    };
  }

  async function dosyaSecildi(e) {
    const dosyalar = Array.from((e.target && e.target.files) || []);
    e.target.value = "";                            // aynı dosya tekrar seçilebilsin
    const hedef = hedefSlotRef.current;
    hedefSlotRef.current = null;
    if (dosyalar.length === 0) return;
    setHata(""); setYuzde(0); setDurum("hazirlaniyor");

    /* SLOT DAĞITIMI TARAYICIDA YAPILIYOR ama sunucu da doğruluyor. Belirli bir slota
     * yükleniyorsa (yeni versiyon / story) hepsi oraya gider; değilse boş slotlara sırayla.
     *
     * `dolu` yerel olarak ilerletiliyor: kayıt tek seferde sonda yapıldığı için `job` bu
     * döngü boyunca güncellenmiyor; bosSlot(job) her turda AYNI slotu döndürürdü ve
     * dosyalar birbirinin üstüne yazılırdı. */
    const dolu = new Set(slotlar.map((m) => m.slot));
    const yeniler = [];
    /* YÜKLEME SÜRERKEN ARKA PLAN TAZELEMESİ DURSUN.
     * Uygulama 25 saniyede bir sunucudaki veriyi çekip yerel duruma yazıyor ve bunu
     * yalnızca "bekleyen bir kayıt var mı" diye kontrol ediyordu. Dosya yüklemek bir
     * kayıt değil — baytlar doğrudan Google'a gidiyor ve dakikalarca sürebiliyor.
     * O sırada gelen tazeleme, kartların tamamını sunucudaki hâliyle değiştiriyordu. */
    const isKimligi = `medya-yukleme-${job.id}`;
    isBasladi(isKimligi);
    try {
      for (let i = 0; i < dosyalar.length; i += 1) {
        let slot = hedef;
        if (!slot) {
          slot = null;
          for (let n = 1; n <= slaytSiniri; n += 1) {
            if (!dolu.has(String(n))) { slot = String(n); break; }
          }
          if (!slot) {
            throw new Error(slaytSiniri === 1
              ? "Fotoğraf kartına tek görsel yüklenir. Çoklu gönderi için Carousel kategorisini kullan."
              : `En fazla ${slaytSiniri} görsel eklenebilir.`);
          }
          dolu.add(slot);
        }
        setSira(dosyalar.length > 1 ? `${i + 1}/${dosyalar.length}` : null);
        setYuzde(0); setDurum("hazirlaniyor");
        yeniler.push(await dosyayiYukle(dosyalar[i], slot));
      }
      setDurum("bos"); setYuzde(0); setSira(null);
      if (onYuklendi) onYuklendi(yeniler);
      /* Kartın önizlemeleri geçersiz: kart açılırken dosya henüz yoktu ve o "dosya yok"
       * sonucu tekrar sorulmadığı için yüklenen dosya hiç görünmüyordu.
       *
       * BİR KEZ DAHA, KAYIT SUNUCUYA ULAŞINCA: sunucu önizlemeyi veritabanından okuyor ve
       * medya kaydı henüz oraya gitmedi (kayıt gecikmeli). Buradaki tazeleme "dosya yok"
       * cevabı alır. `sunucuyuBekle` kartı işaretliyor, kayıt ulaştığında App tazelemeyi
       * yeniden tetikliyor — sabit bir gecikme tahmini yerine gerçek olaya bağlı. */
      onizlemeyiTazele(job.id);
      sunucuyuBekle(job.id);
    } catch (err) {
      setDurum("hata"); setSira(null);
      /* YARIM KALAN YÜKLEMELER KAYBOLMASIN: 8 dosyanın 5'i yüklendikten sonra hata olursa,
       * o beşi karta işlenir ve kullanıcı yalnızca kalanları tekrar dener. Hepsini çöpe
       * atmak, dosyaları Drive'da öksüz bırakırdı. */
      if (yeniler.length > 0 && onYuklendi) onYuklendi(yeniler);
      if (yeniler.length > 0) onizlemeyiTazele(job.id);
      setHata(String(err.message || err));
    } finally {
      isBitti(isKimligi);
    }
  }

  const videoMu = (m) => String((m && m.mimeTur) || "").startsWith("video/");

  /* BİR VERSİYONU AYRI PARÇAYA TAŞI.
   *
   * Slot düzeni gelmeden önce karosel slaytları "yeni versiyon" diye yükleniyordu; o kartlarda
   * 8 slayt tek slotta V1..V8 olarak yığılı duruyor. Hangisinin gerçek revizyon, hangisinin
   * ayrı slayt olduğunu sistem BİLEMEZ — bu yüzden otomatik dönüştürme yapılmıyor, karar
   * kullanıcıya bırakılıyor. Dosya Drive'da yerinde kalıyor; değişen yalnızca kartın içindeki
   * etiket. */
  const bosSlotVar = Boolean(bosSlot(job));
  /* Tek slaytlık kategoride "ayrı parçaya taşı" anlamsız — gidecek ikinci yuva yok. */
  const parcaYapilabilir = bosSlotVar && slaytSiniri > 1 && typeof onMedyaDegis === "function";
  const parcaYap = (kayit) => {
    const hedefSlot = bosSlot(job);
    if (!hedefSlot) { window.alert(`En fazla ${EN_FAZLA_SLAYT} parça olabilir.`); return; }
    const yeniMedya = (job.medya || []).map((m) =>
      (m === kayit || (m.dosyaId && m.dosyaId === kayit.dosyaId && medyaSlotu(m) === medyaSlotu(kayit)))
        ? { ...m, slot: hedefSlot, versiyon: 1 }
        : m);
    onMedyaDegis(yeniMedya, `${kayit.ad || "Dosya"} ayrı parçaya taşındı: ${slotEtiketi(hedefSlot)}`);
    /* Dosya başka slota geçti: hem eski hem yeni slotun önizlemesi artık yanlış. */
    onizlemeyiTazele(job.id);
    setGecmisSlot(null);
  };

  /* BİR PARÇAYI KARTTAN VE DRIVE'DAN KALDIR.
   *
   * Drive'dan da silinmesi kullanıcının açık isteği: karttan çıkardığı dosya klasörde
   * kalınca marka klasörü kimsenin kullanmadığı dosyalarla doluyor ve hangisinin geçerli
   * olduğu anlaşılmıyordu.
   *
   * ÇÖPE ATILIYOR, KALICI SİLİNMİYOR — Drive'ın çöp kutusunda 30 gün duruyor. Yanlış
   * slaydı silmek bir tıklık iş; geri getirmenin bir yolu olmalı.
   *
   * SIRA ÖNEMLİ: önce Drive, sonra kart. Ters olsaydı Drive silinemediğinde kart temizlenmiş
   * olur, dosya klasörde kalır ve kimse fark etmezdi. */
  /* Ok işlevi yerine `async function`: denetleyici `= async (` kalıbını çağrı sanıp
   * yanlış alarm veriyor. Davranış aynı. */
  /** Bir slotun dosyalarını Drive'da çöpe atar. Hata olursa fırlatır — çağıran karar verir. */
  async function slotuDriveDanKaldir(slot) {
    const yanit = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ driveAction: "medyaSil", isId: job.id, slot }),
    }).then((r) => r.json());
    if (!yanit.ok) throw new Error(yanit.error || "Silinemedi.");
    return yanit;
  }

  /* KALAN SLAYTLAR YENİDEN NUMARALANIYOR: 5 slayttan 2'si silinince "1, 3, 4, 5" diye
   * boşluklu kalması hem okunmaz hem de kaydırmalı gönderinin sırasıyla uyuşmaz.
   * Story kendi adını koruyor — o bir sıra değil, ayrı bir boyut. */
  const kalaniYenidenNumarala = (kalan) => {
    const sayisalSira = guncelMedyalar({ medya: kalan })
      .map((x) => x.slot)
      .filter((x) => x !== STORY_SLOT);
    const yeniAd = new Map(sayisalSira.map((eskiSlot, i) => [eskiSlot, String(i + 1)]));
    return kalan.map((x) => {
      const eskiSlot = medyaSlotu(x);
      const ad = yeniAd.get(eskiSlot);
      return ad && ad !== eskiSlot ? { ...x, slot: ad } : x;
    });
  };

  async function parcaSil(m) {
    const gecmisAdet = slotGecmisi(job, m.slot).length;
    const soru = gecmisAdet > 1
      ? `${slotEtiketi(m.slot)} karttan kaldırılacak ve Drive'daki ${gecmisAdet} dosyası (eski versiyonlar dahil) çöp kutusuna taşınacak. Devam edilsin mi?`
      : `${slotEtiketi(m.slot)} karttan kaldırılacak ve Drive'daki dosyası çöp kutusuna taşınacak. Devam edilsin mi?`;
    if (!window.confirm(soru)) return;

    setHata(""); setDurum("siliniyor");
    /* Silme de uzun bir iş: arka plan tazelemesi araya girip kartı eski hâline
     * döndürmesin (yükleme ile aynı gerekçe). */
    const isKimligi = `medya-silme-${job.id}`;
    isBasladi(isKimligi);
    try {
      const yanit = await slotuDriveDanKaldir(m.slot);
      const kalan = (job.medya || []).filter((x) => medyaSlotu(x) !== m.slot);
      setDurum("bos");
      setAcikSlot(null);
      setGecmisSlot(null);
      if (onMedyaDegis) {
        onMedyaDegis(kalaniYenidenNumarala(kalan),
          `${slotEtiketi(m.slot)} silindi — Drive'da çöp kutusuna taşındı (${yanit.silinen.length} dosya).`);
      }
    } catch (e) {
      setDurum("hata");
      setHata(String((e && e.message) || e));
    } finally {
      isBitti(isKimligi);
      /* Silinen parçanın önizlemesi önbellekte kalırsa kartta duruyormuş gibi görünür. */
      onizlemeyiTazele(job.id);
    }
  }

  /* TÜM DOSYALARI BİRDEN SİL.
   *
   * Kart silinmeden önce dosyalarının kaldırılması gerekiyor; 8 slaytlık bir karosel için
   * bunu tek tek yapmak 8 ayrı onay demekti. Tek onayla hepsi kaldırılıyor.
   *
   * YARIDA KALIRSA KALDIĞI YER KAYDEDİLİYOR: 8 dosyanın 5'i silindikten sonra hata olursa,
   * o beşi karttan düşülüyor ve hata yazılıyor. Aksi halde Drive'da silinmiş ama kartta
   * duran dosyalar kalırdı — kart ile Drive ayrışırdı. */
  async function tumDosyalariSil() {
    const hepsi = guncelMedyalar(job);
    if (hepsi.length === 0) return;
    const toplamDosya = hepsi.reduce((t, m) => t + slotGecmisi(job, m.slot).length, 0);
    if (!window.confirm(
      `Bu karttaki ${hepsi.length} parça (toplam ${toplamDosya} dosya, eski versiyonlar dahil) ` +
      `karttan kaldırılacak ve Drive'da çöp kutusuna taşınacak. Devam edilsin mi?`,
    )) return;

    setHata(""); setDurum("siliniyor");
    const isKimligi = `medya-toplu-silme-${job.id}`;
    isBasladi(isKimligi);
    const silinenSlotlar = [];
    let sonHata = null;
    for (const m of hepsi) {
      try {
        await slotuDriveDanKaldir(m.slot);
        silinenSlotlar.push(m.slot);
      } catch (e) {
        sonHata = String((e && e.message) || e);
        break;
      }
    }

    setAcikSlot(null);
    setGecmisSlot(null);
    if (silinenSlotlar.length > 0 && onMedyaDegis) {
      const kalan = (job.medya || []).filter((x) => !silinenSlotlar.includes(medyaSlotu(x)));
      onMedyaDegis(kalaniYenidenNumarala(kalan),
        `${silinenSlotlar.length} parça silindi — Drive'da çöp kutusuna taşındı.`);
    }
    if (sonHata) { setDurum("hata"); setHata(sonHata); } else { setDurum("bos"); }
    isBitti(isKimligi);
    onizlemeyiTazele(job.id);
  }

  const dosyaSec = (slot) => {
    hedefSlotRef.current = slot || null;
    if (girdiRef.current) {
      /* Tek slaytlık kategoride çoklu seçim kapalı: kullanıcı sekiz dosya seçip
       * "neden biri yüklendi" diye sormasın, seçim anında belli olsun. */
      girdiRef.current.multiple = !slot && slaytSiniri > 1;
      girdiRef.current.click();
    }
  };

  const etiket = {
    hazirlaniyor: "Hazırlanıyor…",
    yukleniyor: `Yükleniyor… %${yuzde}`,
    bitiyor: "Tamamlanıyor…",
    siliniyor: "Siliniyor…",
  }[durum];

  const slaytSayisi = slotlar.filter((m) => m.slot !== STORY_SLOT).length;
  const storyVar = slotlar.some((m) => m.slot === STORY_SLOT);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ---- SLOT IZGARASI ---- */}
      {slotlar.length > 0 ? (
        <div style={{ background: C.panelAlt, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.textDim }}>
              {slaytSayisi > 0 ? `${slaytSayisi} görsel/video` : ""}
              {slaytSayisi > 0 && storyVar ? " · " : ""}
              {storyVar ? "story boyutu var" : ""}
              {slaytSayisi > 1 ? " · kaydırmalı gönderi" : ""}
            </span>
            {duzenlenebilir && !meshgul && typeof onMedyaDegis === "function" && slotlar.length > 1 && (
              <button style={{ ...btnGhost, fontSize: 11, padding: "4px 8px", color: C.danger, borderColor: C.danger, marginLeft: "auto" }}
                      onClick={tumDosyalariSil}>
                Tüm dosyaları sil
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {slotlar.map((m) => {
              const acik = acikSlot === m.slot;
              return (
                <button
                  key={m.slot}
                  onClick={() => setAcikSlot(acik ? null : m.slot)}
                  title={`${slotEtiketi(m.slot)} — ${m.ad || ""}`}
                  style={{
                    position: "relative", width: 74, height: 74, borderRadius: 8, overflow: "hidden",
                    padding: 0, cursor: "pointer", background: "#000",
                    border: `2px solid ${acik ? C.accentText : C.border}`,
                  }}
                >
                  <SlotKucukOnizleme isId={job.id} slot={m.slot} video={videoMu(m)} />
                  <span style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,.7)", color: "#fff",
                                 fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>
                    {m.slot === STORY_SLOT ? "STORY" : m.slot}
                  </span>
                  {/* SİLME KARENİN ÜSTÜNDE.
                    * Düğme yalnızca büyük önizlemenin altında dururken bulunamıyordu: önizleme
                    * uzun olduğu için ekranın altında kalıyor, "5 görselden birini nasıl
                    * sileceğim?" sorusu cevapsız kalıyordu. Kaldırma işareti, kaldırılacak
                    * şeyin üstünde olmalı. */}
                  {duzenlenebilir && typeof onMedyaDegis === "function" && !meshgul && (
                    <span
                      role="button"
                      tabIndex={0}
                      title={`${slotEtiketi(m.slot)} — sil`}
                      onClick={(e) => { e.stopPropagation(); parcaSil(m); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); parcaSil(m); } }}
                      style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 999,
                               background: "rgba(0,0,0,.75)", color: "#fff", fontSize: 12, lineHeight: "17px",
                               textAlign: "center", cursor: "pointer", fontWeight: 700 }}
                    >
                      ×
                    </span>
                  )}
                  {Number(m.versiyon) > 1 && (
                    <span style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,.7)", color: "#fff",
                                   fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>
                      V{m.versiyon}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ---- SEÇİLİ SLOTUN BÜYÜK GÖRÜNÜMÜ ---- */}
          {acikSlot && (() => {
            const m = slotlar.find((x) => x.slot === acikSlot);
            if (!m) return null;
            const gecmis = slotGecmisi(job, acikSlot).slice(1);
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  {videoMu(m) ? <Film size={14} color={C.accentText} /> : <ImageIcon size={14} color={C.accentText} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{slotEtiketi(m.slot)} · V{m.versiyon}</span>
                  <span style={{ fontSize: 12, color: C.textDim }}>{m.ad}</span>
                  <a href={m.url} target="_blank" rel="noreferrer"
                     style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textDim, textDecoration: "none" }}>
                    <ExternalLink size={12} /> Drive'da Aç
                  </a>
                </div>
                {/* İŞLEMLER ÖNİZLEMENİN ÜSTÜNDE. Altında dururken önizlemenin boyu yüzünden
                  * ekranın dışında kalıyor ve bulunamıyorlardı. */}
                {duzenlenebilir && !meshgul && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => dosyaSec(m.slot)}>
                      Bu parçanın yeni versiyonunu yükle
                    </button>
                    {gecmis.length > 0 && (
                      <button style={{ ...btnGhost, fontSize: 12 }}
                              onClick={() => setGecmisSlot(gecmisSlot === m.slot ? null : m.slot)}>
                        Versiyon geçmişi ({gecmis.length})
                      </button>
                    )}
                    {typeof onMedyaDegis === "function" && (
                      <button style={{ ...btnGhost, fontSize: 12, color: C.danger, borderColor: C.danger }}
                              onClick={() => parcaSil(m)}>
                        Bu parçayı sil
                      </button>
                    )}
                  </div>
                )}
                <SunucuOnizleme
                  isId={job.id}
                  slot={m.slot}
                  versiyon={m.versiyon}
                  video={videoMu(m)}
                  drivedeAc={m.url}
                  yon={job.videoYonu}
                  gomuluUrl={`https://drive.google.com/file/d/${m.dosyaId}/preview`}
                />
                {gecmisSlot === m.slot && gecmis.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {gecmis.map((eski) => (
                      <div key={eski.dosyaId}
                           style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel,
                                    borderRadius: 8, padding: "8px 10px", fontSize: 12, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: C.text }}>V{eski.versiyon}</span>
                        <span style={{ color: C.textDim }}>{eski.ad}</span>
                        <span style={{ color: C.textDim }}>
                          {eski.tarih ? new Date(eski.tarih).toLocaleDateString("tr-TR") : ""}
                          {eski.yukleyen ? ` · ${eski.yukleyen}` : ""}
                        </span>
                        <a href={eski.url} target="_blank" rel="noreferrer"
                           style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: C.accentText, textDecoration: "none" }}>
                          <ExternalLink size={12} /> Aç
                        </a>
                        {/* ESKİ KARTLARI KURTARAN DÜĞME.
                          * Slot düzeni gelmeden önce karosel slaytları "yeni versiyon" olarak
                          * yükleniyordu — 8 slayt tek slotta V1..V8 diye üst üste yığılmış
                          * durumda. Hangisinin revizyon hangisinin ayrı slayt olduğunu sistem
                          * bilemez; kararı veren sensin. */}
                        {duzenlenebilir && parcaYapilabilir && (
                          <button
                            style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }}
                            onClick={() => parcaYap(eski)}
                            title="Bu dosya aslında ayrı bir slayt ise, kendi parçasına taşı"
                          >
                            Ayrı parça yap
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={{ background: C.panelAlt, borderRadius: 10, padding: 16, marginBottom: 10, textAlign: "center" }}>
          <span style={{ fontSize: 13, color: C.textDim }}>Henüz medya yüklenmedi.</span>
        </div>
      )}

      {/* ---- YÜKLEME ---- */}
      {duzenlenebilir && (
        <div>
          <input ref={girdiRef} type="file" accept="video/*,image/*" multiple onChange={dosyaSecildi} style={{ display: "none" }} />
          {meshgul ? (
            <div style={{ background: C.panelAlt, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Loader2 size={14} color={C.accentText} />
                <span style={{ fontSize: 13, color: C.text }}>{etiket}{sira ? ` (${sira})` : ""}</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${yuzde}%`, background: C.accentText, transition: "width .2s" }} />
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
                Sekmeyi kapatma — yükleme tamamlanmadan çıkarsan dosya kaydedilmez.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => dosyaSec(null)}>
                <UploadCloud size={14} /> {slotlar.length ? "Görsel / Video Ekle" : "Video / Görsel Yükle"}
              </button>
              {!storyVar && (
                <button style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => dosyaSec(STORY_SLOT)}>
                  + Story boyutu
                </button>
              )}
            </div>
          )}
          {!meshgul && slotlar.length > 0 && (
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>
              Kaydırmalı (karosel) gönderi için birden çok dosya seçebilirsin — sırayla eklenir.
              Bir parçayı silmek için karesinin sağ üstündeki ×'e bas; değiştirmek için karesine
              tıklayıp "yeni versiyonunu yükle" de. Silinen dosya Drive'da çöp kutusuna gider.
            </div>
          )}
          {durum === "hata" && (
            <div style={{ marginTop: 8, background: C.dangerSoft, border: `1px solid ${C.danger}`, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, color: C.danger, fontWeight: 600, marginBottom: 4 }}>Yükleme tamamlanamadı</div>
              <div style={{ fontSize: 12, color: C.text }}>{hata}</div>
              <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => { setDurum("bos"); setHata(""); }}>Tekrar dene</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Slot ızgarasındaki küçük kare — sunucudan kapak görseli çeker. */
function SlotKucukOnizleme({ isId, slot, video }) {
  const sunucu = useSunucuOnizleme({ isId, slot, boyut: 200 });
  if (sunucu.durum === "hazir" && sunucu.veri) {
    return <img src={sunucu.veri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#888", fontSize: 16 }}>
      {video ? "▶" : "🖼"}
    </div>
  );
}

function IsDetayModal({ job, clients, subeler, planlar, role, staffName, islemYetkisi, kartYetkileri, personelRosteri, onClose, onUpdate, onDelete, kilitleyen, markaYoneticisiMi, firmaAdi, ucretDetayi, onSaveUcretDetayi }) {
  const [yorum, setYorum] = useState("");
  const [revizeMetni, setRevizeMetni] = useState("");
  const [revizeAciliyor, setRevizeAciliyor] = useState(false);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState({ ...job });
  const [dosyaDuzenle, setDosyaDuzenle] = useState(false);
  const [dosyaTaslak, setDosyaTaslak] = useState({ hamDosyaLink: job.hamDosyaLink || "", editliDosyaLink: job.editliDosyaLink || "" });

  const yetkili = duzenleyebilirMi(job, role, islemYetkisi);
  /* Alt yetkiler tek yerde çözülüyor; üç ayrı yerde `role === "owner" || ...` yazmak
   * birini güncelleyip diğerini unutmaya davetiye. */
  const onaylayabilir = yetkiVar(kartYetkileri, "kartOnaylama");
  const duzenleyebilir = yetkiVar(kartYetkileri, "kartDuzenleme");
  const silebilir = yetkiVar(kartYetkileri, "kartSilme");

  /* ŞUBE BAĞLAMI. Kart markayı ADIYLA saklıyor, şube `clientId` ile bağlı —
   * çeviri tek yerde (lib/marka-kilidi.js). Marka tek şubeliyse aşağıdaki
   * bölümlerin hiçbiri çizilmiyor; o markalar için ekran birebir eskisi gibi. */
  const markaId = useMemo(() => markaninIdsi(clients, duzenle ? taslak.marka : job.marka),
    [clients, duzenle, taslak.marka, job.marka]);
  const markaSubeleri = useMemo(() => markaninSubeleri(subeler, markaId), [subeler, markaId]);
  const cokSubeli = markaSubeleri.length > 0;
  const subeOzeti = useMemo(
    () => (cokSubeli ? icerikSubeOzeti(job, subeler, planlar, markaId) : []),
    [cokSubeli, job, subeler, planlar, markaId]);

  /* KAPSAM KAYIP: kart bir şubeye kilitli ama o şube artık yok (silinmiş). Kart hiçbir
   * şubede kullanılamaz — kasıtlı, çünkü kapsamı açmak içeriği yanlış şubede
   * paylaştırırdı. Sessiz kalmasın diye burada uyarı olarak görünüyor. */
  const kapsamKayip = useMemo(
    () => cokSubeli && kapsamiKayipMi(job, subeler, markaId),
    [cokSubeli, job, subeler, markaId]);

  const aciliyet = aciliyetDurumu(job);
  const stil = ACILIYET_STIL[aciliyet];

  const logKaydet = (aciklama) => {
    const kayit = { id: nid(), tarih: new Date().toLocaleString("tr-TR"), yazan: role === "owner" ? "Yönetici" : (staffName || "Personel"), aciklama };
    return [...(job.gecmis || []), kayit];
  };

  /* KART SİLİNMEDEN ÖNCE DOSYALARI TEMİZLENMELİ.
   *
   * Kart silindiğinde Drive'daki dosyaları öksüz kalıyordu: hiçbir kart onlara işaret etmiyor,
   * kimse hangi işe ait olduklarını bilmiyor, marka klasörü zamanla kimsenin dokunmadığı
   * dosyalarla doluyordu. Kartı silmek dosyayı da silmiş SAYILIYOR ama gerçekte silmiyordu.
   *
   * ENGELLEME, OTOMATİK SİLME DEĞİL: kartın dosyalarını sessizce çöpe atmak, "kartı yanlışlıkla
   * sildim" durumunu geri dönülmez hale getirirdi. Kullanıcı önce dosyaları eliyle kaldırıyor —
   * o sırada her birinin önizlemesini görüyor ve gerçekten gitmesini istediğine karar veriyor. */
  const kartiSil = () => {
    const dosyalar = guncelMedyalar(job);
    if (dosyalar.length > 0) {
      window.alert(
        `Bu kartta ${dosyalar.length} dosya var. Kart silinirse bu dosyalar Drive'da sahipsiz kalır.\n\n` +
        `Önce dosyaları kaldır: her karenin sağ üstündeki × ile sil (ya da "Tüm dosyaları sil"), ` +
        `sonra kartı silebilirsin.`,
      );
      return;
    }
    if (window.confirm("Bu iş silinsin mi?")) onDelete(job.id);
  };

  const dosyaLinkleriniKaydet = () => {
    onUpdate(job.id, { ...dosyaTaslak, gecmis: logKaydet("Dosya bağlantıları güncellendi") });
    setDosyaDuzenle(false);
  };

  const asamaGecir = (yeniAsama, ekAciklama) => {
    /* KAPI BURADA. Butonların her birine ayrı ayrı koşul yazmak yerine tek yerde duruyor;
     * yarın yeni bir düğme eklenirse kural kendiliğinden onun için de geçerli olur. */
    if (yeniAsama === "Kontrol Bekliyor" && !medyaVarMi(job)) {
      window.alert("Bu karta henüz dosya yüklenmemiş. Kontrole göndermek için önce video ya da görseli yükle.");
      return;
    }
    const patch = {
      asama: yeniAsama,
      gecmis: logKaydet(`Aşama değişti: ${job.asama} → ${yeniAsama}${ekAciklama ? " (" + ekAciklama + ")" : ""}`),
    };
    // AYLIK RAPOR İÇİN: bir iş teslim edildiğinde gerçek tarih AYRI BİR ALANA yazılır.
    // Eskiden bu bilgi sadece işlem geçmişindeki metnin içinde duruyordu ve oradan
    // ayrıştırmak gerekiyordu — kırılgan bir yöntemdi. Geri alınırsa tarih temizlenir ki
    // rapor yanlış saymasın.
    /* TESLİM TARİHİ TÜRKİYE SAATİYLE — denetim bulgusu.
     * `toISOString()` UTC veriyor. Türkiye UTC+3 olduğu için gece 00:00–03:00 arasında
     * teslim edilen bir iş BİR ÖNCEKİ GÜNE yazılıyordu. Ayın 1'inde bu, işi bir ÖNCEKİ AYA
     * atıyor — Aylık İş Raporu ve kişi hak edişi bu tarihe göre sayıyor (isTeslimTarihi).
     * tarihIso zaten Europe/Istanbul kullanıyor; aynı kural burada da geçerli olmalıydı. */
    if (yeniAsama === "Teslim Edildi") patch.teslimEdilmeTarihi = tarihIso(new Date());
    else if (job.asama === "Teslim Edildi") patch.teslimEdilmeTarihi = null;
    onUpdate(job.id, patch);
  };
  const geriAl = (hedefAsama) => {
    if (!window.confirm(`"${hedefAsama}" aşamasına geri alınsın mı?`)) return;
    asamaGecir(hedefAsama, "geri alındı");
  };

  const kategori = kategoriEsle(job.kategori);
  const asamalar = asamaListesi(kategori);
  const dosyaVar = medyaVarMi(job);
  /* Karta YÜKLENMİŞ medya var mı? medyaVarMi elle yapıştırılmış bağlantıyı da sayıyor;
   * burada ayrımı yapmak gerekiyor: oynatıcı yalnızca yüklenmiş medya için çıkıyor. */
  const medyaKartta = Array.isArray(job.medya) && job.medya.length > 0;
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
          headers: { "Content-Type": "application/json", ...authHeaders() },
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
  /* Kontrole çıkmadan ÖNCEKİ her aşamada dosya bekleniyor — çekim planlandığı andan itibaren.
   * Revize de dahil: revizenin çıktısı da yüklenmesi gereken yeni bir versiyondur. */
  const kontrolIndex = asamalar.indexOf("Kontrol Bekliyor");
  const yuklemeBekleniyor = job.asama === "Revize İstendi"
    || (suankiIndex >= 0 && kontrolIndex >= 0 && suankiIndex < kontrolIndex);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, width: 620, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{job.marka} — {job.icerikTuru}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, padding: "6px 10px", borderRadius: 999, background: C.accentSoft, color: C.accentText, fontWeight: 600 }}>{job.asama}</span>
              <span style={{ fontSize: 11, padding: "6px 10px", borderRadius: 999, background: stil.soft, color: stil.color, fontWeight: 600 }}>{stil.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textFaint} /></button>
        </div>

        <KilitUyarisi kisi={kilitleyen} />

        {markaYoneticisiMi && (
          <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 15px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: C.textDim }}>Atanan kişiye şu anki durumu ("{job.asama}") e-postayla bildir.</span>
              <button onClick={durumBildirimiGonder} disabled={durumGonderiliyor} style={{ ...btnGhost, fontSize: 13, padding: "6px 10px" }}>
                {durumGonderiliyor ? "Gönderiliyor…" : "📧 Durum Bildirimi Gönder"}
              </button>
            </div>
            {durumSonuc && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>{durumSonuc}</div>}
          </div>
        )}

        {!yetkili && (
          <div style={{ fontSize: 13, color: C.textFaint, background: C.panelAlt, borderRadius: 9, padding: "6px 10px", marginBottom: 14 }}>
            Operasyon yetkin olmadığı için bu kartı sadece görüntüleyebiliyorsun.
          </div>
        )}

        {duzenle ? (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Kategori</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {KATEGORILER.map((k) => (
                <button key={k} onClick={() => setTaslak((s) => ({ ...s, kategori: k }))} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1.5px solid ${taslak.kategori === k ? C.accent : C.border}`, background: taslak.kategori === k ? C.accentSoft : "transparent", color: taslak.kategori === k ? C.accentText : C.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{k}</button>
              ))}
            </div>
            <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <MarkaSeciciAlan clients={clients} deger={taslak.marka} onDegis={(x) => setTaslak((s) => ({ ...s, marka: x }))} />
              <div><label style={labelStyle}>İçerik Türü</label><input style={inputStyle} value={taslak.icerikTuru} onChange={(e) => setTaslak((s) => ({ ...s, icerikTuru: e.target.value }))} /></div>
              {cekimVarMi(taslak.kategori) && <div><label style={labelStyle}>Çekim Tarihi</label><input type="date" style={inputStyle} value={taslak.cekimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, cekimTarihi: e.target.value }))} /></div>}
              <div><label style={labelStyle}>Teslim Tarihi</label><input type="date" style={inputStyle} value={taslak.teslimTarihi} onChange={(e) => setTaslak((s) => ({ ...s, teslimTarihi: e.target.value }))} /></div>
              {cekimVarMi(taslak.kategori) && <div><label style={labelStyle}>Kameraman</label><PersonelSecici value={taslak.kameraman} onChange={(val) => setTaslak((s) => ({ ...s, kameraman: val }))} personelRosteri={personelRosteri} /></div>}
              <div><label style={labelStyle}>{taslak.kategori === "Grafik Tasarım" ? "Tasarımcı" : (taslak.kategori === "Fotoğraf" || taslak.kategori === "Carousel") ? "Düzenleyen" : "Editör"}</label><PersonelSecici value={taslak.editor} onChange={(val) => setTaslak((s) => ({ ...s, editor: val }))} personelRosteri={personelRosteri} /></div>
              <div>
                <label style={labelStyle}>Öncelik</label>
                <select style={inputStyle} value={taslak.oncelik} onChange={(e) => setTaslak((s) => ({ ...s, oncelik: e.target.value }))}>
                  {ONCELIKLER.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* PAYLAŞIM TÜRÜ — kart hangi stok satırına yazılacak.
                *
                * Boş bırakılırsa tür TAHMİN ediliyor: önce içerik adında tür adı aranıyor,
                * bulunamazsa kategoriye düşülüyor. Sahada şu görüldü: aynı işteki iki
                * karttan adında "Reels" geçen Reels stoğuna, geçmeyen başka bir satıra
                * yazılıyordu — aradaki tek fark o kelimeydi. Buradan seçilince tahmin
                * devre dışı kalır ve tür bir daha kaymaz. */}
              <div>
                <label style={labelStyle}>Paylaşım Türü (stok)</label>
                <select
                  style={inputStyle}
                  value={taslak.paylasimTuru || ""}
                  onChange={(e) => setTaslak((s) => ({ ...s, paylasimTuru: e.target.value || undefined }))}
                >
                  <option value="">Otomatik ({paylasimTuru(taslak)})</option>
                  {PAYLASIM_TURLERI.map((t2) => <option key={t2} value={t2}>{t2}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>İstenen Adet</label><input style={inputStyle} value={taslak.istenenAdet || ""} onChange={(e) => setTaslak((s) => ({ ...s, istenenAdet: e.target.value }))} /></div>
              <div><label style={labelStyle}>Kaç Parça? (rapor için)</label><input type="number" min="0" style={inputStyle} value={taslak.uretilenAdet || ""} onChange={(e) => setTaslak((s) => ({ ...s, uretilenAdet: e.target.value }))} placeholder="örn. 10" /></div>
            </div>
            {/* HANGİ ŞUBELER KULLANABİLİR.
              * Varsayılan "tüm şubeler" — çoğu içerik marka geneli. Şube seçilirse
              * içerik yalnızca orada planlanabilir; diğer şubelerin kart seçicisinde
              * hiç görünmez ve onaylandığında onların stoğunu artırmaz. */}
            {cokSubeli && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Hangi şubeler kullanabilir?</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    /* ÖLÜ KİMLİK TEMİZLENİR. Silinmiş şubenin kimliği listede kalırsa,
                     * kullanıcı yeni bir şube seçse bile kart o ölü kimliği taşımaya
                     * devam eder ve kapsam kayıp görünmeye devam ederdi. Seçim anında
                     * bu markada karşılığı olmayan kimlikler atılıyor. */
                    const olulerdenArindir = (liste) => {
                      const gecerli = new Set(markaSubeleri.map((x) => String(x.id)));
                      return (liste || []).map(String).filter((x) => gecerli.has(x));
                    };
                    const secili = olulerdenArindir(taslak.sadeceSubeler);
                    const olu = gecersizSubeKimlikleri(taslak, subeler, markaId);
                    const dugme = (etiket, aktif, tikla) => (
                      <button key={etiket} onClick={tikla} style={{ padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1.5px solid ${aktif ? C.accent : C.border}`, background: aktif ? C.accentSoft : "transparent", color: aktif ? C.accentText : C.textDim }}>{etiket}</button>
                    );
                    return [
                      /* Kapsam kayıpken "Tüm şubeler" aktif GÖRÜNMEZ: seçili liste dolu
                       * ama karşılığı yok. Kullanıcı bilerek tıklayıp açabilir. */
                      dugme("Tüm şubeler", secili.length === 0 && olu.length === 0, () => setTaslak((st) => ({ ...st, sadeceSubeler: [] }))),
                      ...markaSubeleri.map((sb) => dugme(sb.ad, secili.includes(String(sb.id)), () => setTaslak((st) => {
                        const su = olulerdenArindir(st.sadeceSubeler);
                        const id = String(sb.id);
                        return { ...st, sadeceSubeler: su.includes(id) ? su.filter((x) => x !== id) : [...su, id] };
                      }))),
                    ];
                  })()}
                  {gecersizSubeKimlikleri(taslak, subeler, markaId).length > 0 && (
                    <div style={{ width: "100%", fontSize: 11.5, color: C.warning, fontFamily: "Inter", marginTop: 6 }}>
                      Bu kart silinmiş bir şubeye kilitli. Bir seçim yapınca kapsam yenilenir.
                    </div>
                  )}
                </div>
              </div>
            )}
            <label style={labelStyle}>Brief / Çekim Notları</label>
            <textarea style={{ ...inputStyle, marginBottom: 10 }} rows={3} value={taslak.brief || ""} onChange={(e) => setTaslak((s) => ({ ...s, brief: e.target.value }))} />

            {/* ALT YAZI — İÇERİĞİN KENDİ METNİ.
              *
              * Paylaşım anında yazmak geç kalıyordu: metin içerik üretilirken düşünülüyor,
              * paylaşan kişi ise sadece taşıyor. Burada yazıldığında kart planlandığı her
              * güne ve her şubeye kendiliğinden gidiyor.
              *
              * Onaydan ÖNCE de yazılabiliyor — kart hangi aşamada olursa olsun bu alan
              * açık; müşteri onayını beklemeye gerek yok. */}
            <label style={labelStyle}>Alt Yazı (paylaşım metni)</label>
            <textarea
              style={{ ...inputStyle, marginBottom: 4 }}
              rows={4}
              value={taslak.altMetin || ""}
              onChange={(e) => setTaslak((s) => ({ ...s, altMetin: e.target.value }))}
              placeholder="Bu içerik paylaşılırken kullanılacak metin. Planladığın her güne ve şubeye gider."
            />
            <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
              Paylaşımlar ekranında bu metin hazır gelir; o güne özel değiştirmek gerekirse
              orada düzenlenir ve yalnızca o planı etkiler.
            </div>
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
            <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, fontSize: 13 }}>
              <div><span style={{ color: C.textFaint }}>Çekim Tarihi:</span> <span style={{ color: C.text }}>{job.cekimTarihi}</span></div>
              <div><span style={{ color: C.textFaint }}>Teslim Tarihi:</span> <span style={{ color: C.text }}>{job.teslimTarihi}</span></div>
              <div><span style={{ color: C.textFaint }}>Kameraman:</span> <span style={{ color: C.text }}>{job.kameraman || "—"}</span></div>
              <div><span style={{ color: C.textFaint }}>Editör:</span> <span style={{ color: C.text }}>{job.editor || "—"}</span></div>
              <div><span style={{ color: C.textFaint }}>Öncelik:</span> <span style={{ color: ONCELIK_RENK[job.oncelik] }}>{job.oncelik}</span></div>
              <div><span style={{ color: C.textFaint }}>İstenen Adet:</span> <span style={{ color: C.text }}>{job.istenenAdet || "—"}</span></div>
              {job.uretilenAdet ? <div><span style={{ color: C.textFaint }}>Parça Sayısı:</span> <span style={{ color: C.text }}>{job.uretilenAdet}</span></div> : null}
            </div>

            {kapsamKayip && (
              <div style={{ marginBottom: 16, padding: "11px 14px", background: C.warningSoft, border: `1px solid ${C.warning}`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.warning, fontWeight: 700, letterSpacing: 0.3, marginBottom: 6 }}>ŞUBE KAPSAMI KAYIP</div>
                <div style={{ fontSize: 12.5, color: C.text, fontFamily: "Inter", lineHeight: 1.6 }}>
                  Bu içerik yalnızca silinmiş bir şube için hazırlanmıştı. Yanlış şubede paylaşılmasın diye
                  kapsamı açılmadı — şu an hiçbir şubede kullanılamaz.
                  {yetkili ? " Düzenle'ye girip hangi şubelerin kullanabileceğini seç." : " Yönetici kapsamı yeniden seçmeli."}
                </div>
              </div>
            )}

            {/* ŞUBE DURUMU — salt okunur.
              * "Bu içeriği hangi şubede paylaştık, hangisi bekliyor" sorusu kartı
              * işleyen kişinin de sorusu. Planlama Paylaşımlar ekranında yapılıyor;
              * burada yalnızca durum gösteriliyor, tıklanacak bir şey yok. */}
            {cokSubeli && subeOzeti.length > 0 && (
              <div style={{ marginBottom: 16, padding: "11px 14px", background: C.panel, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 700, letterSpacing: 0.3, marginBottom: 8 }}>
                  ŞUBE DURUMU
                  {Array.isArray(job.sadeceSubeler) && job.sadeceSubeler.length > 0 && (
                    <span style={{ fontWeight: 600, letterSpacing: 0, marginLeft: 6 }}>· yalnızca seçili şubelerde kullanılır</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {subeOzeti.map((x) => {
                    const renk = x.durum === "paylasildi" ? C.success : x.durum === "planlandi" ? C.warning : C.textFaint;
                    const zemin = x.durum === "paylasildi" ? C.successSoft : x.durum === "planlandi" ? C.warningSoft : "transparent";
                    const not = x.durum === "paylasildi" ? (x.tarih || "paylaşıldı") : x.durum === "planlandi" ? "planlı" : "bekliyor";
                    return (
                      <span key={x.subeId} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: zemin, border: `1px solid ${x.durum === "kullanilmadi" ? C.border : renk}`, fontSize: 12.5 }}>
                        <span style={{ color: C.text, fontWeight: 600 }}>{x.subeAdi}</span>
                        <span style={{ color: renk, fontWeight: 700 }}>{not}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {role === "owner" && onSaveUcretDetayi && (
              <IsUcretPaneli job={job} detay={ucretDetayi} onKaydet={onSaveUcretDetayi} />
            )}

            {/* MÜŞTERİ REVİZE NOTU — kartın en üstünde, brief'ten önce.
              * Not zaten kaydediliyordu ama hiçbir yerde GÖSTERİLMİYORDU; editör ne
              * isteneceğini ancak işlem geçmişini okuyarak bulabiliyordu. En çok ihtiyaç
              * duyulan bilgi en görünür yerde olmalı. */}
            {job.musteriRevizeNotu && (
              <div style={{ marginBottom: 14, background: C.dangerSoft, border: `1px solid ${C.danger}`, borderRadius: 10, padding: "12px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.danger, fontWeight: 700, letterSpacing: 0.3 }}>MÜŞTERİ NE İSTEDİ</span>
                  {Number(job.revizeSayisi) > 1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: C.panel, borderRadius: 999, padding: "6px 10px" }}>
                      {job.revizeSayisi}. revize turu
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{job.musteriRevizeNotu}</div>
              </div>
            )}

            {job.brief && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 4 }}>BRIEF / NOTLAR</div>
                <div style={{ fontSize: 13, color: C.textDim, background: C.panelAlt, borderRadius: 9, padding: "6px 10px", lineHeight: 1.6 }}>{job.brief}</div>
              </div>
            )}

            {job.revizeAciklamasi && job.asama === "Revize İstendi" && (
              <div style={{ marginBottom: 14, background: C.dangerSoft, borderRadius: 9, padding: "6px 10px" }}>
                <div style={{ fontSize: 11, color: C.danger, fontWeight: 700, marginBottom: 3 }}>REVİZE AÇIKLAMASI</div>
                <div style={{ fontSize: 13, color: C.text }}>{job.revizeAciklamasi}</div>
              </div>
            )}

            {/* KART İÇİ MEDYA — asıl çalışma alanı burası.
                Personel dosyayı buradan yükler, buradan izler, revize gelirse buradan yeni
                versiyon atar. Aşağıdaki bağlantı alanları ikincil kaldı: Drive dışındaki
                kaynaklar (WeTransfer) ve eski kartlar için duruyor. */}
            {/* Uyarı İLK AŞAMADAN İTİBAREN duruyor: dosya bir sütuna özel değil, işin herhangi
                bir anında yüklenebilir. Beklemek yerine hazır olduğunda yükle. */}
            {yuklemeBekleniyor && yetkili && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10,
                            background: dosyaVar ? C.successSoft : C.warningSoft, borderRadius: 10, padding: "12px 15px" }}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>{dosyaVar ? "✓" : "⬆"}</span>
                <div style={{ fontSize: 13, color: dosyaVar ? C.success : C.warning, lineHeight: 1.6 }}>
                  {dosyaVar
                    ? <><strong>Dosya yüklendi.</strong> Kartı kontrole gönderebilirsin.</>
                    : <><strong>Video ya da görsel yükle.</strong> Bunu şimdi de yapabilirsin —
                        ama dosya yüklenmeden kart kontrole gönderilemez.</>}
                </div>
              </div>
            )}

            <MedyaYukleyici
              job={job}
              /* KİLİT BİR UYARI, DUVAR DEĞİL — ve yalnızca burada duvar gibi davranıyordu.
               *
               * Karttaki her şey (Onayla, Revize İste, Düzenle, Sil, aşama değiştir) kilit
               * varken de çalışıyor; üstteki bant "aynı anda kaydederseniz biriniz diğerinin
               * işini ezebilir" diye uyarıyor, o kadar. Yalnızca medya düzenleme kapanıyordu.
               *
               * Bu tutarsızlık bir çıkmaz üretti: kilit varken dosya silinemiyor, dosya
               * varken de kart silinemiyor (bkz. kartiSil). Kullanıcı iki kapının arasında
               * kalıyordu.
               *
               * Eşzamanlı kayıt riski zaten _v sayacıyla karşılanıyor: araya başka bir kayıt
               * girerse istek 409 alıyor ve üzerine yazılmıyor. */
              duzenlenebilir={duzenleyebilirMi(job, role, islemYetkisi)}
              onMedyaDegis={(yeniMedya, aciklama) => {
                /* KAPAK DA YENİDEN HESAPLANIYOR.
                 * Eskiden yalnızca `medya` gönderiliyordu; `editliDosyaLink` (kartın küçük
                 * kapağı) yüklemede atanıp SİLMEDE hiç güncellenmiyordu. Sonuç: silinen
                 * görsel kapakta kalmaya devam ediyordu. Elle yazılmış bağlantı korunur. */
                onUpdate(job.id, {
                  medya: yeniMedya,
                  editliDosyaLink: kapakBaglantisi(job.medya, yeniMedya, job.editliDosyaLink),
                  gecmis: logKaydet(aciklama),
                });
                sunucuyuBekle(job.id);
              }}
              onYuklendi={(yeniler) => {
                /* Çoklu yükleme: tek seferde birden çok kayıt gelebiliyor (karosel).
                 * Tek nesne de kabul ediliyor — eski çağrı biçimi bozulmasın. */
                const liste = Array.isArray(yeniler) ? yeniler : [yeniler];
                if (liste.length === 0) return;
                /* `editliDosyaLink` BİRİNCİ SLAYTA bağlanıyor, son yüklenene değil.
                 * Bu alan kartın "kapağı" gibi davranıyor (eski önizlemeler ve Drive'ı
                 * kullanmayan yollar hâlâ buna bakıyor); story boyutunu yükleyince kapağın
                 * story'ye dönmesi yanlış olurdu. */
                const hepsi = [...(job.medya || []), ...liste];
                const kapak = guncelMedyalar({ medya: hepsi })[0];
                const ozet = liste.length > 1
                  ? `${liste.length} dosya yüklendi: ${liste.map((x) => slotEtiketi(x.slot)).join(", ")}`
                  : `${slotEtiketi(liste[0].slot)} V${liste[0].versiyon} yüklendi: ${liste[0].ad}`;
                onUpdate(job.id, {
                  medya: hepsi,
                  editliDosyaLink: (kapak && kapak.url) || liste[0].url,
                  gecmis: logKaydet(ozet),
                });
              }}
            />

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
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: job.editliDosyaLink ? 10 : 0 }}>
                    {job.hamDosyaLink && <a href={job.hamDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Ham Dosyalar</a>}
                    {job.editliDosyaLink && <a href={job.editliDosyaLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.accentText, textDecoration: "none" }}><Link2 size={13} /> Editlenmiş Dosyalar</a>}
                    {yetkili && (
                      <button style={{ background: "none", border: "none", color: C.textFaint, fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }} onClick={() => setDosyaDuzenle(true)}>
                        {job.hamDosyaLink || job.editliDosyaLink ? "Dosya bağlantılarını düzenle" : "+ Dosya bağlantısı ekle"}
                      </button>
                    )}
                  </div>
                  {/* Grafik Tasarım'da (görsel) doğrudan <img> ile hiç tıklamaya gerek kalmadan
                   * anında gösterilir. Video'da ise Drive'ın /preview'ı kullanılır — tarayıcıların
                   * otomatik oynatma kısıtlaması yüzünden oynatmak için bir tık gerekiyor, bu
                   * platform kısıtı, tamamen kaldırılamıyor. */}
                  {/* KART İÇİ OYNATICI VARSA BURADA TEKRAR GÖSTERİLMEZ.
                    * Kartın üstünde zaten güncel versiyon oynatılıyor; aynı dosyayı bir de
                    * burada göstermek ekranı ikiye bölüyor ve alttaki (eski gömülü Drive
                    * çerçevesi) siyah kalıyordu. Bağlantı satırları duruyor — dosyaya
                    * Drive'dan ulaşmak isteyen için. */}
                  {job.editliDosyaLink && !medyaKartta && !ciktiVideoMu(kategori) && (
                    <DriveGorsel link={job.editliDosyaLink} C={C} yukseklik={420} isId={job.id} boyut={1200} />
                  )}
                  {job.editliDosyaLink && !medyaKartta && ciktiVideoMu(kategori) && !driveEmbedUrl(job.editliDosyaLink) && (
                    <div style={{ width: "100%", borderRadius: 10, background: C.panelAlt, border: `1px dashed ${C.border}`, padding: "12px 15px", fontSize: 13, color: C.textFaint, lineHeight: 1.6 }}>
                      {driveKlasorMu(job.editliDosyaLink)
                        ? "Bu bir Drive klasör bağlantısı — klasörler oynatıcı olarak gösterilemez. Tek bir video dosyasının bağlantısını yapıştır."
                        : "Bu bağlantıdan bir Drive dosyası tanınamadı — oynatıcı gösterilemiyor. Bağlantının drive.google.com/file/d/... biçiminde olduğundan emin ol."}
                    </div>
                  )}
                  {job.editliDosyaLink && !medyaKartta && ciktiVideoMu(kategori) && driveEmbedUrl(job.editliDosyaLink) && (
                    <>
                      {/* Oynatıcı çerçevesi videonun yönüne göre şekillenir. Sabit 16:9 çerçevede
                        * dikey (Reels) videolar ortada küçük kalıp iki yanı siyah bantla doluyordu.
                        * Yön işte kayıtlı değilse dikey kabul edilir — içeriklerin çoğu 9:16. */}
                      <div style={{ maxWidth: job.videoYonu === "yatay" ? 640 : job.videoYonu === "kare" ? 440 : 340, margin: "0 auto", width: "100%" }}>
                        <div style={{ position: "relative", width: "100%", aspectRatio: job.videoYonu === "yatay" ? "16 / 9" : job.videoYonu === "kare" ? "1 / 1" : "9 / 16", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                          <iframe
                            src={driveEmbedUrl(job.editliDosyaLink)}
                            title="Editlenmiş dosya önizleme"
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                            allow="autoplay"
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
                        {[{ k: "dikey", l: "Dikey" }, { k: "kare", l: "Kare" }, { k: "yatay", l: "Yatay" }].map((y) => (
                          <button
                            key={y.k}
                            onClick={() => onUpdate(job.id, { videoYonu: y.k })}
                            style={{ padding: "12px 15px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                              background: (job.videoYonu || "dikey") === y.k ? C.accentSoft : C.panelAlt,
                              color: (job.videoYonu || "dikey") === y.k ? C.accentText : C.textFaint }}
                          >
                            {y.l}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6, textAlign: "center" }}>Tarayıcılar videoyu otomatik başlatmaya izin vermiyor — oynatmak için oynatıcının üzerine bir kez tıklaman gerekiyor.</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {yetkili && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {job.asama === yapiliyorAsamasi(kategori) && (
                  <button style={dosyaVar ? btnPrimary : kapaliBtn} onClick={editiTamamla} disabled={!dosyaVar}
                          title={dosyaVar ? "" : "Önce video ya da görsel yükle"}>
                    <CheckCircle2 size={14} /> {TAMAMLADIM_ETIKETI[kategori]}
                  </button>
                )}
                {job.asama === "Revize İstendi" && (
                  <button style={dosyaVar ? btnPrimary : kapaliBtn} onClick={revizeyiTamamla} disabled={!dosyaVar}
                          title={dosyaVar ? "" : "Önce yeni versiyonu yükle"}>
                    <CheckCircle2 size={14} /> Revizeyi Tamamladım
                  </button>
                )}
                {job.asama !== yapiliyorAsamasi(kategori) && job.asama !== "Revize İstendi" && ileriAsama && !["Onaylandı", "Teslim Edildi"].includes(ileriAsama) && (
                  <button style={btnGhost} onClick={() => asamaGecir(ileriAsama)}><ChevronRight size={14} /> Sonraki Aşamaya Geçir: {ileriAsama}</button>
                )}
                {suankiIndex > 0 && (
                  <button style={{ ...btnGhost, color: C.textDim }} onClick={() => geriAl(asamalar[suankiIndex - 1])}>← Geri Al: {asamalar[suankiIndex - 1]}</button>
                )}
                {job.asama === "Kontrol Bekliyor" && !revizeAciliyor && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={() => setRevizeAciliyor(true)}>Revize İste</button>}
                {/* Düğmeler artık role DEĞİL yetkiye bakıyor. Yönetici hepsine sahip
                  * (`kartYetkileri` owner için hepsi açık geliyor). Sunucu aynı kuralı
                  * bağımsız uyguluyor: bu gizleme kolaylık, sınır değil. */}
                {onaylayabilir && job.asama === "Kontrol Bekliyor" && <button style={{ ...btnPrimary, background: C.success }} onClick={onayla}>Onayla</button>}
                {onaylayabilir && job.asama === "Onaylandı" && <button style={{ ...btnPrimary, background: C.success }} onClick={teslimEt}>Teslim Edildi Olarak İşaretle</button>}
                {duzenleyebilir && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={() => setDuzenle(true)}><Pencil size={13} /> Düzenle</button>}
                {silebilir && <button style={{ ...btnGhost, color: C.danger, borderColor: C.danger }} onClick={kartiSil}><Trash2 size={13} /> Sil</button>}
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textFaint, fontWeight: 700, marginBottom: 8 }}><MessageSquare size={13} /> YORUMLAR</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                {(job.yorumlar || []).map((y) => (
                  <div key={y.id} style={{ background: C.panelAlt, borderRadius: 9, padding: "6px 10px" }}>
                    <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 2 }}>{y.yazan} · {y.tarih}</div>
                    <div style={{ fontSize: 13, color: C.text }}>{y.metin}</div>
                  </div>
                ))}
                {(!job.yorumlar || job.yorumlar.length === 0) && <div style={{ fontSize: 13, color: C.textFaint }}>Henüz yorum yok.</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inputStyle} placeholder="Yorum yaz…" value={yorum} onChange={(e) => setYorum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && yorumEkle()} />
                <button style={btnGhost} onClick={yorumEkle}>Ekle</button>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textFaint, fontWeight: 700, marginBottom: 8 }}><History size={13} /> İŞLEM GEÇMİŞİ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 140, overflowY: "auto" }}>
                {[...(job.gecmis || [])].reverse().map((g) => (
                  <div key={g.id} style={{ fontSize: 11, color: C.textDim }}><span style={{ color: C.textFaint }}>{g.tarih}</span> — {g.yazan}: {g.aciklama}</div>
                ))}
                {(!job.gecmis || job.gecmis.length === 0) && <div style={{ fontSize: 13, color: C.textFaint }}>Henüz kayıt yok.</div>}
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
      <div style={{ fontSize: 13, fontWeight: 700, color: renk, marginBottom: 8 }}>{baslik} ({liste.length})</div>
      {liste.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textFaint }}>Yok.</div>
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
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>{label}</div>
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

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Personel Bazında</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kisiler.length === 0 && <div style={{ fontSize: 13, color: C.textFaint }}>Henüz kameraman/editör ataması yok.</div>}
          {kisiler.map((k) => {
            const kisininIsleri = jobs.filter((j) => j.kameraman === k || j.editor === k);
            const aktif = kisininIsleri.filter((j) => j.asama !== "Teslim Edildi").length;
            const geciken = kisininIsleri.filter((j) => aciliyetDurumu(j) === "gecikti").length;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 13 }}>
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
/* İŞ ÜCRETİ MODELİ (sadece yönetici)                                    */
/* ------------------------------------------------------------------ */
/**
 * Her işin ücreti üç moddan biriyle belirlenir:
 *   "varsayilan" → kişinin iş başı ücreti × 1 (Aylık İş Raporu'nda kişiye girilen tutar)
 *   "sabit"      → bu işe özel TEK tutar (örn. "10 tasarım yapacak ama tek ücret alınacak")
 *   "ucretsiz"   → 0 ₺ (örn. "öne çıkan ikonları yapacak ama ücret almayacak" — pakete dahil)
 *
 * "sabit" ve "ucretsiz" modda, işte iki kişi varsa tutarın kime yazılacağı `kime` alanıyla
 * belirlenir ("editor" | "kameraman" | "ikisi") — böylece tek bir ücret yanlışlıkla iki kez
 * sayılmaz. Bu bilgi işin kendi üzerinde DEĞİL, ayrı ve yöneticiye özel bir haritada tutulur;
 * çünkü iş kayıtları personelin tarayıcısına olduğu gibi gönderiliyor ve ücretlerin oraya
 * sızmaması gerekiyor.
 */
export const UCRET_MODLARI = [
  { key: "varsayilan", label: "Varsayılan (kişinin iş başı ücreti)" },
  { key: "sabit", label: "Bu işe tek sabit ücret" },
  { key: "ucretsiz", label: "Ücretsiz (pakete dahil)" },
];

function varsayilanKime(job) {
  if (job && job.editor) return "editor";
  if (job && job.kameraman) return "kameraman";
  return "editor";
}

/** Bir işin, belirli bir kişiye yazılacak ücretini hesaplar. */
function isUcretiHesapla(job, kisiAdi, detay, kisiVarsayilanUcret) {
  const mod = (detay && detay.mod) || "varsayilan";
  if (mod === "ucretsiz") return 0;
  if (mod === "sabit") {
    const tutar = Number(detay && detay.tutar) || 0;
    const kime = (detay && detay.kime) || varsayilanKime(job);
    if (kime === "ikisi") return tutar;
    if (kime === "kameraman") return job.kameraman === kisiAdi ? tutar : 0;
    return job.editor === kisiAdi ? tutar : 0;
  }
  return Number(kisiVarsayilanUcret) || 0;
}

/** Ücret modunu kısa, okunur bir etikete çevirir. */
function ucretEtiketi(job, detay, kisiVarsayilanUcret) {
  const mod = (detay && detay.mod) || "varsayilan";
  const para = (n) => fmt(n); // Gizlilik Modu açıkken "₺ •••" gösterir
  if (mod === "ucretsiz") return "Ücretsiz";
  if (mod === "sabit") {
    const kime = (detay && detay.kime) || varsayilanKime(job);
    const kimeYazi = kime === "ikisi" ? " (ikisine ayrı)" : "";
    return `${para(Number(detay.tutar) || 0)} sabit${kimeYazi}`;
  }
  if (!kisiVarsayilanUcret) return "ücret girilmemiş";
  return para(kisiVarsayilanUcret);
}

/**
 * Bir kişinin belirli bir aydaki OPERASYON hak edişi (teslim edilen işlerden).
 * Personel > Freelancer sekmesi bu fonksiyonu kullanır — böylece hak ediş matematiği
 * tek bir yerde tanımlı kalır ve iki ekran farklı rakam göstermez.
 */
export function operasyonAylikHakEdis(jobs, kisiAd, ay, ucretler, ucretDetaylari) {
  if (!kisiAd) return { isSayisi: 0, tutar: 0, parca: 0 };
  const varsayilan = Number((ucretler || {})[kisiAd]) || 0;
  const oAyinIsleri = (jobs || []).filter((j) => {
    const t = isTeslimTarihi(j);
    if (!t || t.slice(0, 7) !== ay) return false;
    return j.kameraman === kisiAd || j.editor === kisiAd;
  });
  const tutar = oAyinIsleri.reduce(
    (s, j) => s + isUcretiHesapla(j, kisiAd, (ucretDetaylari || {})[j.id] || null, varsayilan),
    0
  );
  const parca = oAyinIsleri.reduce((s, j) => s + (Number(j.uretilenAdet) || 0), 0);
  return { isSayisi: oAyinIsleri.length, tutar, parca };
}

/**
 * MARKA BAZLI FREELANCER MALİYETİ — bir markaya o ay harcanan iş başı ücretlerin toplamı.
 *
 * Kâr hesabı eskiden yalnızca elle girilen maliyetlere bakıyordu; Operasyon'da o marka için
 * ödenen freelancer ücretleri hiç girmiyordu. Bu yüzden çok iş üretilen bir marka olduğundan
 * kârlı görünüyordu.
 *
 * operasyonAylikHakEdis ile AYNI ücret fonksiyonunu (isUcretiHesapla) kullanır — iki hesap
 * ayrı yazılsaydı personel raporundaki tutarla müşteri kârındaki tutar birbirini tutmazdı.
 *
 * eksikUcret: ücreti tanımlanmamış kişi sayısı. Sıfırdan büyükse maliyet OLDUĞUNDAN DÜŞÜK
 * demektir; çağıran taraf bunu "veri eksik" olarak işaretlemeli.
 */
export function markaAylikIsMaliyeti(jobs, marka, ay, ucretler, ucretDetaylari) {
  const anahtar = String(marka || "").trim().toLocaleLowerCase("tr");
  if (!anahtar) return { tutar: 0, isSayisi: 0, eksikUcret: 0 };
  const oAyinIsleri = (jobs || []).filter((j) => {
    const t = isTeslimTarihi(j);
    if (!t || t.slice(0, 7) !== ay) return false;
    return String(j.marka || "").trim().toLocaleLowerCase("tr") === anahtar;
  });
  let tutar = 0;
  let eksikUcret = 0;
  oAyinIsleri.forEach((j) => {
    // Bir işte hem kameraman hem editör olabilir; ikisi de ayrı ücret alır.
    [j.kameraman, j.editor].filter(Boolean).forEach((kisi) => {
      const varsayilan = Number((ucretler || {})[kisi]) || 0;
      const detay = (ucretDetaylari || {})[j.id] || null;
      const k = isUcretiHesapla(j, kisi, detay, varsayilan);
      if (!varsayilan && !detay) eksikUcret += 1;
      tutar += k;
    });
  });
  return { tutar, isSayisi: oAyinIsleri.length, eksikUcret };
}

/** Operasyon'da atanmış ama kayıtlı olmayan kişileri bulur — Freelancer sekmesi bunları
 * "eklemek ister misin?" diye önerir, böylece isimler elle kopyalanmaz. */
export function operasyonKisiIsimleri(jobs) {
  const set = new Set();
  (jobs || []).forEach((j) => {
    if (j.kameraman && String(j.kameraman).trim()) set.add(String(j.kameraman).trim());
    if (j.editor && String(j.editor).trim()) set.add(String(j.editor).trim());
  });
  return Array.from(set);
}

/** İş detayında yöneticinin ücret modunu ayarladığı küçük panel. */
function IsUcretPaneli({ job, detay, onKaydet }) {
  const mevcutMod = (detay && detay.mod) || "varsayilan";
  const [mod, setMod] = useState(mevcutMod);
  const [tutar, setTutar] = useState(String((detay && detay.tutar) || ""));
  const [kime, setKime] = useState((detay && detay.kime) || varsayilanKime(job));
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    setMod((detay && detay.mod) || "varsayilan");
    setTutar(String((detay && detay.tutar) || ""));
    setKime((detay && detay.kime) || varsayilanKime(job));
  }, [job.id]);

  const ikiKisiVar = !!job.kameraman && !!job.editor && job.kameraman !== job.editor;

  const kaydet = (yeniMod, yeniTutar, yeniKime) => {
    const m = yeniMod !== undefined ? yeniMod : mod;
    const t = yeniTutar !== undefined ? yeniTutar : tutar;
    const k = yeniKime !== undefined ? yeniKime : kime;
    if (m === "varsayilan") onKaydet(job.id, null);
    else onKaydet(job.id, { mod: m, tutar: m === "sabit" ? (Number(t) || 0) : 0, kime: k });
    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 1500);
  };

  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 15px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Wallet size={13} color={C.textFaint} />
        <span style={{ fontSize: 11, color: C.textFaint, fontWeight: 700 }}>ÜCRETLENDİRME (sadece sen görüyorsun)</span>
        {kaydedildi && <span style={{ fontSize: 11, color: C.success }}>✓ kaydedildi</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          style={{ ...inputStyle, marginBottom: 0, width: "auto", minWidth: 210 }}
          value={mod}
          onChange={(e) => { setMod(e.target.value); kaydet(e.target.value); }}
        >
          {UCRET_MODLARI.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        {mod === "sabit" && (
          <input
            type="number"
            min="0"
            style={{ ...inputStyle, marginBottom: 0, width: 130 }}
            value={tutar}
            placeholder="Tutar (₺)"
            onChange={(e) => setTutar(e.target.value)}
            onBlur={() => kaydet()}
            onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }}
          />
        )}
        {mod === "sabit" && ikiKisiVar && (
          <select
            style={{ ...inputStyle, marginBottom: 0, width: "auto" }}
            value={kime}
            onChange={(e) => { setKime(e.target.value); kaydet(undefined, undefined, e.target.value); }}
          >
            <option value="editor">{job.editor} alsın</option>
            <option value="kameraman">{job.kameraman} alsın</option>
            <option value="ikisi">İkisi de ayrı ayrı alsın</option>
          </select>
        )}
      </div>
      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 7, lineHeight: 1.6 }}>
        {mod === "sabit" && "Bu iş kaç parça içerirse içersin, ay sonu raporunda tek bu tutar sayılır."}
        {mod === "ucretsiz" && "Bu iş raporda görünür ve iş sayısına dahil olur, ama ödemeye 0 ₺ yazılır."}
        {mod === "varsayilan" && "Aylık İş Raporu'nda o kişi için girdiğin iş başı ücret kullanılır."}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AYLIK İŞ RAPORU (SADECE YÖNETİCİ)                                     */
/* ------------------------------------------------------------------ */

/** Bir işin GERÇEKTEN teslim edildiği tarihi (YYYY-AA-GG) döndürür.
 *
 * Yeni işlerde bu bilgi doğrudan `teslimEdilmeTarihi` alanında duruyor. Bu alan eklenmeden
 * ÖNCE teslim edilmiş işler için, bilgi işlem geçmişindeki "→ Teslim Edildi" satırının
 * tarihinden geri kazanılır — böylece rapor eski işleri de sayabiliyor. */
export function isTeslimTarihi(job) {
  if (!job) return null;
  if (job.teslimEdilmeTarihi) return job.teslimEdilmeTarihi;
  const kayit = [...(job.gecmis || [])].reverse().find((g) => (g.aciklama || "").includes("→ Teslim Edildi"));
  if (!kayit || !kayit.tarih) return null;
  const gun = String(kayit.tarih).split(" ")[0]; // "11.08.2026" ya da "2.08.2026"
  const p = gun.split(".");
  if (p.length !== 3) return null;
  const [g, a, y] = p;
  if (!y || y.length !== 4) return null;
  return `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}

function ayKeyi(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ayEkle(key, adet) {
  const [y, a] = key.split("-").map(Number);
  const d = new Date(y, a - 1 + adet, 1);
  return ayKeyi(d);
}
function ayAdi(key) {
  const [y, a] = key.split("-").map(Number);
  return new Date(y, a - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

/**
 * Kim, hangi ay, kaç iş tamamladı — ve isteğe bağlı olarak ne kadar ödeme hak etti.
 *
 * Sayım kuralı: iş "Teslim Edildi" aşamasına GEÇTİĞİ tarihe göre ilgili aya yazılır
 * (planlanan teslim tarihine göre değil — gerçekte ne zaman bittiği önemli).
 * Bir işte hem kameraman hem editör varsa, iş İKİSİNİN de hanesine yazılır; bu yüzden
 * kişi toplamlarının toplamı, üstteki benzersiz iş sayısından fazla olabilir.
 */
/** Freelancer'a avans veren küçük form. Avans, o ayın hak edişinden düşülür ve seçilen
 * hesabın bakiyesinden çıkar — Toplam Gider'e AYRICA eklenmez (hak ediş zaten ödenecek para). */
function AvansMiniForm({ kisiAd, hesaplar, ay, onKaydet, onKapat }) {
  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState("");
  const [hesapId, setHesapId] = useState((liste.find((h) => h.anaHesap) || liste[0]).id);
  const [tarih, setTarih] = useState(bugunISO());
  const [not, setNot] = useState("");

  const kaydet = () => {
    const miktar = Number(String(tutar).replace(",", "."));
    if (!miktar || Number.isNaN(miktar) || miktar <= 0) { window.alert("Geçerli bir avans tutarı gir."); return; }
    onKaydet({ tutar: miktar, ay, hesapId, not: not.trim(), tarih });
  };

  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 15px" }}>
      <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 700, marginBottom: 8 }}>{kisiAd} — AVANS VER</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input autoFocus type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }} placeholder="Tutar (₺)" style={{ ...inputStyle, marginBottom: 0, width: 130 }} />
        <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: "auto", minWidth: 150 }}>
          {liste.map((h) => <option key={h.id} value={h.id}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</option>)}
        </select>
        <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 150 }} />
        <input value={not} onChange={(e) => setNot(e.target.value)} placeholder="Not (opsiyonel)" style={{ ...inputStyle, marginBottom: 0, width: 160 }} />
        <button style={btnPrimary} onClick={kaydet}>Kaydet</button>
        <button style={btnGhost} onClick={onKapat}>İptal</button>
      </div>
      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 7, lineHeight: 1.6 }}>
        Seçili ayın ({ay}) hak edişinden düşülür ve seçtiğin hesabın bakiyesinden çıkar.
      </div>
    </div>
  );
}

export function AylikIsRaporu({ jobs, ucretler, onSaveUcret, ucretDetaylari, onSaveUcretDetayi, avanslar, hesaplar, onAddAvans, onDeleteAvans }) {
  const [ay, setAy] = useState(ayKeyi());
  const [acikKisi, setAcikKisi] = useState(null);
  const [ucretDuzenle, setUcretDuzenle] = useState(null);
  const [ucretTaslak, setUcretTaslak] = useState("");
  const [avansFormAcik, setAvansFormAcik] = useState(null);

  const oAyinIsleri = useMemo(
    () => (jobs || []).filter((j) => {
      const t = isTeslimTarihi(j);
      return t && t.slice(0, 7) === ay;
    }),
    [jobs, ay]
  );

  // Teslim edilmeyi bekleyen (onaylanmış ama henüz teslim edilmemiş) işler — ayrı gösterilir
  // ki "bu kişi çalıştı ama sayılmadı" izlenimi oluşmasın.
  const bekleyenler = (jobs || []).filter((j) => j.asama === "Onaylandı");

  const kisiler = useMemo(() => {
    const harita = {};
    const ekle = (ad, job, rol) => {
      if (!ad || !String(ad).trim()) return;
      const anahtar = String(ad).trim();
      if (!harita[anahtar]) harita[anahtar] = { ad: anahtar, isler: [], video: 0, grafik: 0, kameraman: 0, editor: 0 };
      const k = harita[anahtar];
      if (!k.isler.some((x) => x.id === job.id)) {
        k.isler.push(job);
        if (job.kategori === "Grafik Tasarım") k.grafik += 1; else k.video += 1;
      }
      if (rol === "kameraman") k.kameraman += 1; else k.editor += 1;
    };
    oAyinIsleri.forEach((j) => { ekle(j.kameraman, j, "kameraman"); ekle(j.editor, j, "editor"); });
    return Object.values(harita).sort((a, b) => b.isler.length - a.isler.length);
  }, [oAyinIsleri]);

  const ucretAl = (ad) => Number((ucretler || {})[ad]) || 0;
  const detayAl = (jobId) => (ucretDetaylari || {})[jobId] || null;
  /** Kişinin o aydaki toplam hak edişi: her iş kendi moduna göre hesaplanır
   * (sabit ücretli işler kaç parça olursa olsun tek sayılır, ücretsizler 0 yazar). */
  const kisiToplami = (k) => k.isler.reduce((t, j) => t + isUcretiHesapla(j, k.ad, detayAl(j.id), ucretAl(k.ad)), 0);
  const kisiUcretsizSayisi = (k) => k.isler.filter((j) => (detayAl(j.id) || {}).mod === "ucretsiz").length;
  const kisiParcaSayisi = (k) => k.isler.reduce((t, j) => t + (Number(j.uretilenAdet) || 0), 0);
  // Freelancer avansları: kişi adına göre eşleşir ve o ayın hak edişinden düşülür.
  const kisiAvansKayitlari = (ad) => (avanslar || []).filter((a) => a.tur === "freelancer" && a.kisiAd === ad);
  const kisiAvansi = (ad) => kisiAvansKayitlari(ad).filter((a) => a.ay === ay).reduce((t, a) => t + (Number(a.tutar) || 0), 0);
  const kisiOdenecek = (k) => kisiToplami(k) - kisiAvansi(k.ad);
  const genelAvans = kisiler.reduce((s, k) => s + kisiAvansi(k.ad), 0);
  const genelToplam = kisiler.reduce((s, k) => s + kisiToplami(k), 0);
  const genelParca = oAyinIsleri.reduce((t, j) => t + (Number(j.uretilenAdet) || 0), 0);
  const paraYaz = (n) => fmt(n); // Gizlilik Modu açıkken "₺ •••" gösterir

  const bekleyenSayisi = (ad) => bekleyenler.filter((j) => j.kameraman === ad || j.editor === ad).length;

  const csvIndir = () => {
    const satirlar = [["Kişi", "Tamamlanan İş", "Üretilen Parça", "Video", "Grafik Tasarım", "Kameraman Olarak", "Editör Olarak", "Ücretsiz İş", "İş Başı Ücret", "Toplam Hak Ediş", "Avans", "Ödenecek Kalan"]];
    kisiler.forEach((k) => {
      satirlar.push([k.ad, k.isler.length, kisiParcaSayisi(k) || "", k.video, k.grafik, k.kameraman, k.editor, kisiUcretsizSayisi(k) || "", ucretAl(k.ad) || "", kisiToplami(k) || "", kisiAvansi(k.ad) || "", kisiOdenecek(k) || ""]);
    });
    satirlar.push([]);
    satirlar.push(["İş bazlı döküm", "", "", "", "", "", "", "", "", ""]);
    // Revize turu sütunu: kaç kez geri döndüğü rapora da yansısın — çok revize alan içerik
    // brief'in ya da beklentinin sorunlu olduğunu gösterir.
    satirlar.push(["Kişi", "Marka", "İçerik", "Kategori", "Parça", "Teslim Tarihi", "Ücretlendirme", "Revize Turu", "", ""]);
    kisiler.forEach((k) => {
      k.isler.forEach((j) => {
        satirlar.push([k.ad, j.marka, j.icerikTuru || "", j.kategori || "", j.uretilenAdet || "", isTeslimTarihi(j) || "", ucretEtiketi(j, detayAl(j.id), ucretAl(k.ad)), Number(j.revizeSayisi) || 0, "", ""]);
      });
    });
    const csv = "\uFEFF" + satirlar.map((r) => r.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `is-raporu-${ay}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ucretKaydet = (ad) => {
    const deger = ucretTaslak.trim() === "" ? 0 : Number(ucretTaslak);
    if (Number.isNaN(deger) || deger < 0) { window.alert("Geçerli bir tutar gir."); return; }
    onSaveUcret(ad, deger);
    setUcretDuzenle(null);
    setUcretTaslak("");
  };

  return (
    <div>
      {/* Ay seçici */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={btnGhost} onClick={() => setAy(ayEkle(ay, -1))}><ChevronLeft size={14} /></button>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, minWidth: 130, textAlign: "center", textTransform: "capitalize" }}>{ayAdi(ay)}</div>
          <button style={btnGhost} onClick={() => setAy(ayEkle(ay, 1))}><ChevronRight size={14} /></button>
          {ay !== ayKeyi() && <button style={btnGhost} onClick={() => setAy(ayKeyi())}>Bu aya dön</button>}
        </div>
        {kisiler.length > 0 && <button style={btnGhost} onClick={csvIndir}><Download size={13} /> CSV indir</button>}
      </div>

      {/* Ay özeti */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
          <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>TAMAMLANAN İŞ</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.success, fontFamily: "monospace" }}>{oAyinIsleri.length}</div>
        </div>
        {genelParca > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
            <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>ÜRETİLEN PARÇA</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{genelParca}</div>
          </div>
        )}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
          <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>ÇALIŞAN KİŞİ</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{kisiler.length}</div>
        </div>
        {genelToplam > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
            <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>TOPLAM HAK EDİŞ</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accentText, fontFamily: "monospace" }}>{paraYaz(genelToplam)}</div>
          </div>
        )}
        {genelAvans > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
            <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>VERİLEN AVANS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.warning, fontFamily: "monospace" }}>{paraYaz(genelAvans)}</div>
          </div>
        )}
        {genelAvans > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px", flex: "1 1 150px" }}>
            <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>ÖDENECEK KALAN</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.success, fontFamily: "monospace" }}>{paraYaz(genelToplam - genelAvans)}</div>
          </div>
        )}
      </div>

      {/* Kişi listesi */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 15px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Kim Ne Kadar İş Yaptı</div>
        <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 12, lineHeight: 1.6 }}>
          Bir iş, "Teslim Edildi"ye geçtiği tarihe göre sayılır. Hem kameraman hem editör varsa iş ikisinin de hanesine yazılır,
          bu yüzden kişi toplamları üstteki iş sayısından fazla olabilir. Bir kişinin adına tıklayınca yaptığı işleri görürsün.
          Bir işin ücretini değiştirmek için (tek sabit ücret ya da ücretsiz) o işi Operasyon panosundan açıp
          "Ücretlendirme" bölümünü kullan.
        </div>

        {kisiler.length === 0 && (
          <div style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.7 }}>
            Bu ay teslim edilmiş iş yok. (Bir işin sayılabilmesi için "Teslim Edildi" aşamasına geçmiş olması gerekiyor —
            "Onaylandı"da bekleyen {bekleyenler.length} iş var.)
          </div>
        )}

        {kisiler.map((k) => {
          const acik = acikKisi === k.ad;
          const bekleyen = bekleyenSayisi(k.ad);
          return (
            <div key={k.ad} style={{ borderBottom: `1px solid ${C.borderSoft}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => setAcikKisi(acik ? null : k.ad)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", textAlign: "left" }}
                >
                  <ChevronRight size={13} color={C.textFaint} style={{ transform: acik ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{k.ad}</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ color: C.success, fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>{k.isler.length} iş</span>
                  <span style={{ color: C.textDim }}>
                    {k.video > 0 && `${k.video} video`}{k.video > 0 && k.grafik > 0 && " · "}{k.grafik > 0 && `${k.grafik} grafik`}
                    {kisiParcaSayisi(k) > 0 && ` · ${kisiParcaSayisi(k)} parça`}
                  </span>
                  {kisiUcretsizSayisi(k) > 0 && <span style={{ color: C.textFaint, fontSize: 11 }}>{kisiUcretsizSayisi(k)} ücretsiz</span>}
                  {bekleyen > 0 && <span style={{ color: C.warning, fontSize: 11 }}>+{bekleyen} teslim bekliyor</span>}
                  {kisiToplami(k) > 0 && (
                    kisiAvansi(k.ad) > 0 ? (
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                        <span style={{ color: C.textFaint, textDecoration: "line-through", fontWeight: 400, fontSize: 11 }}>{paraYaz(kisiToplami(k))}</span>
                        {" "}
                        <span style={{ color: C.warning, fontSize: 11, fontWeight: 400 }}>−{paraYaz(kisiAvansi(k.ad))}</span>
                        {" = "}
                        <span style={{ color: C.success }}>{paraYaz(kisiOdenecek(k))}</span>
                      </span>
                    ) : (
                      <span style={{ color: C.accentText, fontWeight: 700, fontFamily: "monospace" }}>{paraYaz(kisiToplami(k))}</span>
                    )
                  )}
                </div>
              </div>

              {acik && (
                <div style={{ paddingLeft: 19, marginTop: 8 }}>
                  {/* İş başı ücret (isteğe bağlı) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <Wallet size={13} color={C.textFaint} />
                    {ucretDuzenle === k.ad ? (
                      <>
                        <input
                          autoFocus
                          type="number"
                          value={ucretTaslak}
                          onChange={(e) => setUcretTaslak(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") ucretKaydet(k.ad); if (e.key === "Escape") setUcretDuzenle(null); }}
                          placeholder="İş başı ücret (₺)"
                          style={{ ...inputStyle, width: 150, marginBottom: 0 }}
                        />
                        <button style={btnGhost} onClick={() => ucretKaydet(k.ad)}>Kaydet</button>
                        <button style={btnGhost} onClick={() => setUcretDuzenle(null)}>Vazgeç</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setUcretDuzenle(k.ad); setUcretTaslak(String(ucretAl(k.ad) || "")); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.textFaint, textDecoration: "underline", fontFamily: "inherit" }}
                      >
                        {ucretAl(k.ad) > 0
                          ? `Varsayılan iş başı ${paraYaz(ucretAl(k.ad))} · ay toplamı ${paraYaz(kisiToplami(k))} · değiştir`
                          : "Varsayılan iş başı ücret gir (isteğe bağlı — freelancer ödemesi için)"}
                      </button>
                    )}
                  </div>

                  {/* Avans (freelancer) */}
                  {onAddAvans && (
                    <div style={{ marginBottom: 10 }}>
                      {avansFormAcik === k.ad ? (
                        <AvansMiniForm
                          kisiAd={k.ad}
                          hesaplar={hesaplar}
                          ay={ay}
                          onKaydet={(kayit) => { onAddAvans({ ...kayit, tur: "freelancer", kisiId: null, kisiAd: k.ad }); setAvansFormAcik(null); }}
                          onKapat={() => setAvansFormAcik(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAvansFormAcik(k.ad)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.textFaint, textDecoration: "underline", fontFamily: "inherit" }}
                        >
                          + Avans ver
                        </button>
                      )}
                      {kisiAvansKayitlari(k.ad).filter((a) => a.ay === ay).map((a) => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: C.panelAlt, borderRadius: 8, padding: "6px 10px", fontSize: 11, marginTop: 5 }}>
                          <span style={{ color: C.textDim }}>Avans · {a.tarih}{a.not ? ` · ${a.not}` : ""}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ color: C.warning, fontFamily: "monospace" }}>{paraYaz(a.tutar)}</strong>
                            {onDeleteAvans && (
                              <button onClick={() => { if (window.confirm("Bu avans silinsin mi?")) onDeleteAvans(a.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                <Trash2 size={12} color={C.danger} />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Yaptığı işler */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {k.isler.map((j) => (
                      <div key={j.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: C.textDim, background: C.panelAlt, borderRadius: 8, padding: "6px 10px", flexWrap: "wrap" }}>
                        <span>
                          <strong style={{ color: C.text }}>{j.marka}</strong> · {j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}
                          {Number(j.uretilenAdet) > 0 && <span style={{ color: C.textFaint }}> · {j.uretilenAdet} parça</span>}
                        </span>
                        <span style={{ color: C.textFaint }}>
                          {j.kameraman === k.ad && j.editor === k.ad ? "kameraman + editör" : j.kameraman === k.ad ? "kameraman" : "editör"}
                          {" · "}{isTeslimTarihi(j)}
                          {" · "}
                          <strong style={{ color: (detayAl(j.id) || {}).mod === "ucretsiz" ? C.textFaint : C.accentText }}>
                            {ucretEtiketi(j, detayAl(j.id), ucretAl(k.ad))}
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ANA BİLEŞEN                                                           */
/* ------------------------------------------------------------------ */
export default function CekimEditTakibi({ acilacakIsId, onKartAcildi, role, clients, subeler, planlar, jobs, personelRosteri, onRefreshRoster, onAddJob, onUpdateJob, onDeleteJob, girisYapanAd, islemYetkisi = true, kartYetkileri, isUcretleri, onSaveIsUcreti, isUcretDetaylari, onSaveIsUcretDetayi, avanslar, hesaplar, onAddAvans, onDeleteAvans, markalasmaSurecleri, onToggleMarkalasmaGorev, onSetMarkalasmaYonetici, onAddMarkalasmaGorev, onCompleteMarkalasmaSureci, onDeleteMarkalasmaSureci, markaYoneticisiMi, firmaAdi }) {
  const [staffName, setStaffNameState] = useState(girisYapanAd || getStaffName());
  const [view, setView] = useState(role === "staff" ? "panom" : "pano");
  /* Varsayılan sekme LİSTEDEN geliyor. Bir süre "Video" yazılıydı: kategori adı
   * değişince o ad listede kalmadı ve açılışta HİÇBİR sekme seçili görünmüyordu
   * (süzgeç eşleme sayesinde kartları doğru gösterse bile). */
  const [panoKategori, setPanoKategori] = useState(KATEGORILER[0]);
  /* MARKA SÜZGECİ — pano tek markaya daraltılabilsin.
   * "" = tüm markalar. Kategori değişince seçim KORUNUYOR: bir markanın işini
   * takip eden kişi kategoriler arasında gezerken süzgeci tekrar kurmak zorunda
   * kalmasın. Marka kilitli hesapta `clients` zaten yalnızca kendi markalarını
   * içerdiği için liste kendiliğinden doğru. */
  const [panoMarka, setPanoMarka] = useState("");
  const [genisletilmisSutunlar, setGenisletilmisSutunlar] = useState({});
  const [adding, setAdding] = useState(false);
  const [acikIs, setAcikIs] = useState(null);
  const duzenleyenAdi = role === "owner" ? "Yönetici (CEO)" : (staffName || "Personel");
  /* YÖNETİCİ HEPSİNE SAHİP. Alt yetkiler yalnızca personeli sınırlamak için var;
   * yöneticiye izin kutucuğu tanımlanmadığı için burada açılıyor. Sunucu da aynı
   * ayrımı yapıyor: denetim yalnızca personel yazma yolunda çalışıyor. */
  const yetkiler = role === "owner"
    ? { kartAcma: true, kartOnaylama: true, kartDuzenleme: true, kartSilme: true }
    : (kartYetkileri || {});

  /* DIŞARIDAN "BU KARTA GİT". Paylaşımlar'daki Drive raporu bir kartı adıyla söylüyor
   * ama kullanıcı onu Operasyon'da elle aramak zorundaydı: doğru sekmeyi seç, doğru
   * markayı süz, sütunlarda gözle bul. Rapor kartı biliyorsa oraya götürebilmeli.
   *
   * SEKME VE MARKA SÜZGECİ DE AYARLANIYOR: kart açılır ama arkasındaki pano başka bir
   * kategoriyi gösterirse, detay kapandığında kullanıcı kartı yine kaybediyor.
   *
   * `onKartAcildi` isteği TEK SEFERLİK yapıyor — temizlenmezse kullanıcı kartı
   * kapattığı anda aynı kart yeniden açılır ve panodan çıkamaz. */
  useEffect(() => {
    if (!acilacakIsId) return;
    const hedef = (jobs || []).find((j) => String(j.id) === String(acilacakIsId));
    if (hedef) {
      setPanoKategori(kategoriEsle(hedef.kategori));
      setPanoMarka(hedef.marka || "");
      setAcikIs(hedef);
    }
    if (typeof onKartAcildi === "function") onKartAcildi();
  }, [acilacakIsId]);      // eslint-disable-line react-hooks/exhaustive-deps

  const isKilitleyen = useDuzenlemeKilidi("operasyon-is", acikIs && acikIs.id, !!acikIs, duzenleyenAdi);

  useEffect(() => { setStaffNameState(girisYapanAd || getStaffName()); }, [girisYapanAd]);

  /* Kaldırılan "… Yapıldı" aşamasında kalmış kartlar burada karşılığına çevriliyor.
   * Çevrilmezse aşama adı hiçbir sütuna denk gelmez ve kart PANODA HİÇ GÖRÜNMEZ —
   * kullanıcı için "iş kayboldu" demektir. Kayıt sırasında sunucu da aynı düzeltmeyi
   * yapıyor, böylece veri zamanla kendiliğinden temizleniyor. */
  const isler = asamalariDuzelt(jobs || []);

  if (role === "staff" && !staffName) {
    return (
      <div style={{ maxWidth: 360, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 10 }}>Önce adını gir</div>
        <div style={{ fontSize: 13, color: C.textFaint, marginBottom: 14 }}>Kendi işlerini görebilmen ve işlem geçmişinde görünmen için adını bir kere girmen yeterli.</div>
        <input
          style={inputStyle}
          placeholder="Adın Soyadın"
          onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { setStaffName(e.target.value.trim()); setStaffNameState(e.target.value.trim()); } }}
        />
      </div>
    );
  }

  /* Süzme mantığı `lib/pano-suzgeci.js`'de — arayüzün içinde kalsaydı test onun
   * bir KOPYASINI sınardı ve kopya gerçek koddan ayrıştığında fark edilmezdi. */
  const { panoIsleri, panoMarkalari, kategoriSayisi } = panoSuzgeci(isler, panoKategori, panoMarka, KATEGORILER);

  const panoAsamalari = asamaListesi(panoKategori);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {role === "staff" && (
            <button onClick={() => setView("panom")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: "none", background: view === "panom" ? C.accentSoft : "transparent", color: view === "panom" ? C.accentText : C.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><ListTodo size={14} /> Panom</button>
          )}
          <button onClick={() => setView("pano")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: "none", background: view === "pano" ? C.accentSoft : "transparent", color: view === "pano" ? C.accentText : C.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><LayoutGrid size={14} /> Tüm İşler</button>
          <button onClick={() => setView("markalasma")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: "none", background: view === "markalasma" ? C.accentSoft : "transparent", color: view === "markalasma" ? C.accentText : C.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Rocket size={14} /> Markalaşma</button>
          {role === "owner" && (
            <button onClick={() => setView("istatistik")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 15px", borderRadius: 9, border: "none", background: view === "istatistik" ? C.accentSoft : "transparent", color: view === "istatistik" ? C.accentText : C.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><BarChart3 size={14} /> İstatistikler</button>
          )}
        </div>
        {view !== "markalasma" && yetkiVar(yetkiler, "kartAcma") && <button style={btnPrimary} onClick={() => { setAdding((v) => !v); if (onRefreshRoster) onRefreshRoster(); }}><Plus size={14} /> Yeni İş</button>}
      </div>

      {view === "pano" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: C.panelAlt, borderRadius: 10, padding: 3, width: "fit-content" }}>
            {KATEGORILER.map((k) => (
              <button key={k} onClick={() => setPanoKategori(k)} style={{ padding: "12px 16px", borderRadius: 8, border: "none", background: panoKategori === k ? C.accent : "transparent", color: panoKategori === k ? "#fff" : C.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{k}</button>
            ))}
          </div>

          <select
            value={panoMarka}
            onChange={(e) => setPanoMarka(e.target.value)}
            title="Yalnızca seçtiğin markanın kartlarını göster"
            style={{ ...inputStyle, width: "auto", minWidth: 190, padding: "10px 12px", fontSize: 13,
              borderColor: panoMarka ? C.accent : C.border, color: panoMarka ? C.text : C.textDim }}
          >
            <option value="">Tüm markalar ({kategoriSayisi})</option>
            {panoMarkalari.map((m) => (
              <option key={m.ad} value={m.ad}>
                {m.ad} ({m.adet}){m.adet === 0 ? " — bu kategoride kart yok" : ""}
              </option>
            ))}
          </select>

          {panoMarka && (
            <button
              onClick={() => setPanoMarka("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textFaint, fontSize: 12.5, fontFamily: "Inter" }}
            >× süzgeci kaldır</button>
          )}
        </div>
      )}

      {adding && <YeniIsFormu clients={clients} subeler={subeler} personelRosteri={personelRosteri} varsayilanKategori={view === "pano" ? panoKategori : "Video"} onCancel={() => setAdding(false)} onSubmit={(v) => { onAddJob(v); setAdding(false); }} />}

      {view === "panom" && role === "staff" && <PersonelPaneli jobs={isler} staffName={staffName} onOpen={setAcikIs} />}

      {view === "istatistik" && role === "owner" && <YoneticiIstatistik jobs={isler} />}
      {/* Aylık İş Raporu buradan KALDIRILDI — Personel > Freelancer sekmesine taşındı.
        * Sebep: aynı bilgiyi (kimin ne kadar hak ettiği) iki ayrı yerde göstermek
        * "hangisine bakacağım?" sorusunu doğuruyordu. Ödemeyle ilgili her şey artık
        * Personel sekmesinde toplu duruyor; Operasyon yalnızca üretim takibine odaklı. */}

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
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>{asama}</span>
                  <span style={{ fontSize: 11, color: C.textFaint, background: C.panelAlt, padding: "6px 10px", borderRadius: 999 }}>{asamaIsleri.length}</span>
                </div>
                <div style={{ minHeight: 40 }}>
                  {buAsamadakiler.map((j) => <IsKarti key={j.id} job={j} onClick={() => setAcikIs(j)} />)}
                  {sinirliMi && (
                    <button
                      onClick={() => setGenisletilmisSutunlar((s) => ({ ...s, [asama]: true }))}
                      style={{ width: "100%", background: "none", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "8px 0", color: C.textFaint, fontSize: 11, cursor: "pointer", marginTop: 4 }}
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
          clients={clients}
          subeler={subeler}
          planlar={planlar}
          role={role}
          staffName={staffName}
          islemYetkisi={islemYetkisi}
          kartYetkileri={yetkiler}
          personelRosteri={personelRosteri}
          onClose={() => setAcikIs(null)}
          onUpdate={onUpdateJob}
          kilitleyen={isKilitleyen}
          markaYoneticisiMi={markaYoneticisiMi}
          firmaAdi={firmaAdi}
          ucretDetayi={(isUcretDetaylari || {})[acikIs.id] || null}
          onSaveUcretDetayi={role === "owner" ? onSaveIsUcretDetayi : null}
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
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.marka}</div>
          <div style={{ fontSize: 11, color: C.textFaint }}>Açıldı: {s.olusturmaTarihi}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: hepsiBitti ? C.success : C.accentText, fontFamily: "monospace" }}>%{oran}</span>
          {role === "owner" ? (
            <div style={{ width: 180 }}>
              <PersonelSecici value={s.yonetici} onChange={yoneticiDegisti} personelRosteri={personelRosteri} />
            </div>
          ) : (
            <span style={{ fontSize: 11, color: C.textDim }}>{s.yonetici ? `Yönetici: ${s.yonetici}` : "Yönetici atanmadı"}</span>
          )}
        </div>
      </div>

      {mailDurumu && (
        <div style={{ fontSize: 11, color: mailDurumu.mailGitti ? C.success : C.warning, background: mailDurumu.mailGitti ? C.successSoft : C.warningSoft, borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
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
            <span style={{ fontSize: 13, color: g.tamamlandi ? C.textFaint : C.text, textDecoration: g.tamamlandi ? "line-through" : "none" }}>{g.ad}</span>
            {g.tamamlandi && g.tamamlanmaTarihi && <span style={{ fontSize: 11, color: C.textFaint, marginLeft: "auto" }}>{g.tamamlanmaTarihi}</span>}
          </button>
        ))}
      </div>

      {yeniGorevAcik ? (
        <div style={{ display: "flex", gap: 6, marginBottom: hepsiBitti ? 10 : 0 }}>
          <input autoFocus value={yeniGorevAdi} onChange={(e) => setYeniGorevAdi(e.target.value)} onKeyDown={(e) => e.key === "Enter" && gorevEkle()} placeholder="örn. TikTok hesabı açıldı" style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "6px 10px" }} />
          <button style={{ ...btnPrimary, padding: "6px 10px", fontSize: 13 }} onClick={gorevEkle}>Ekle</button>
          <button style={{ ...btnGhost, padding: "6px 10px", fontSize: 13 }} onClick={() => setYeniGorevAcik(false)}>İptal</button>
        </div>
      ) : (
        <button onClick={() => setYeniGorevAcik(true)} style={{ background: "none", border: "none", color: C.accentText, fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: hepsiBitti ? 10 : 0 }}>+ Manuel Görev Ekle</button>
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
        <div style={{ textAlign: "center", padding: "18px 22px", color: C.textFaint, fontSize: 13 }}>
          Henüz markalaşma süreci yok. Müşteriler'e yeni bir marka eklediğinde burada otomatik açılır.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: tamamlananlar.length > 0 ? 24 : 0 }}>
            {devamEdenler.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: C.textFaint, fontSize: 13 }}>Devam eden markalaşma süreci yok.</div>
            ) : devamEdenler.map((s) => (
              <MarkalasmaKart key={s.id} s={s} personelRosteri={personelRosteri} role={role} onToggleGorev={onToggleGorev} onSetYonetici={onSetYonetici} onAddGorev={onAddGorev} onComplete={onComplete} />
            ))}
          </div>

          {tamamlananlar.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: C.textFaint, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>Tamamlanan Markalaşma</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tamamlananlar.map((s) => (
                  <div key={s.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color={C.success} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.marka}</div>
                        <div style={{ fontSize: 11, color: C.textFaint }}>Tamamlandı: {s.tamamlanmaTarihi}{s.yonetici ? ` · Yönetici: ${s.yonetici}` : ""}</div>
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
