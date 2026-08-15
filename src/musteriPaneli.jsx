/**
 * MÜŞTERİ PANELİ VE DRIVE MEDYA
 *
 * Müşterinin gördüğü panel (onay bekleyenler, paylaşım takvimi, reklamlar, üretim durumu) ve
 * Google Drive bağlantılarını görsel/video olarak gösteren parçalar.
 *
 * Drive tarafı ayrı durmayı hak ediyor çünkü Google'ın adres davranışı zamanla değişiyor;
 * hangi adreslerin denendiği ve hatanın nasıl gösterildiği tek yerde toplu olmalı.
 */
import React, { useState, useEffect } from "react";
import {
  tarihGoster, cancelBtnStyle, haftaBaslangici, reklamDurumu, musteriHatirlaniyorMu, FONTS, basligiTemizle, istatistikVarMi, authHeaders,
} from "./tema.jsx";
import { LogOut, Trash2 } from "lucide-react";
import { driveEmbedUrl, DriveGorsel, DriveVideo, driveGorselAdaylari, DriveKucukGorsel } from "./drive.jsx";
import { InstagramOnizleme, InstagramIzgara } from "./instagram.jsx";

/** Müşteri Paneli — owner/personel arayüzünden tamamen izole, sade bir onay ekranı.
 * Sadece kendi markasının içeriklerini görür; her içeriği onaylayabilir ya da revize isteyebilir. */

/* ==================================================================
 * MÜŞTERİ PANELİ TASARIMI — "baskı provası"
 *
 * NEDEN AYRI BİR GÖRÜNÜM: Bu panel bir iç yönetim aracı değil, müşteriye TESLİM EDİLEN bir
 * yüzey. CEO paneliyle aynı koyu operasyon temasını kullanmak, müşteriye "sizin için
 * hazırlanmış bir sunum" değil "bizim yazılımımıza bakıyorsunuz" hissi veriyordu.
 *
 * Fikir: fotoğrafçının müşteriye gönderdiği baskı provası. Açık, kağıt hissi veren bir zemin;
 * numaralandırılmış provalar; onay/revize durumları PUL (damga) olarak. Numaralandırma
 * süslemek için değil — sıralama artık gerçek bilgi taşıyor (yayın sırası).
 *
 * Renkler bilerek ne kremayı-serif ne de siyah-neon yönüne gidiyor; ajansın kurumsal moru
 * sabit çerçeve rengi, markanın kendi logosu ise kimliğini taşıyor.
 * ================================================================== */
const MT = {
  kagit: "#EEF0EF",       // soğuk kağıt grisi — stüdyo duvarı
  kart: "#FFFFFF",
  murekkep: "#16181B",    // metin
  soluk: "#6B7280",       // ikincil metin
  cizgi: "#DFE3E1",
  cizgiKoyu: "#C6CDC9",
  mor: "#5B5BD6",         // Marcus Medya kurumsal
  morSoluk: "#EEEEFB",
  bekleyen: "#B45309",
  bekleyenZemin: "#FDF6EC",
  onay: "#15803D",
  onayZemin: "#EFF7F1",
  revize: "#B91C1C",
  revizeZemin: "#FDF0F0",
};

const ETIKET = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10.5,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: MT.soluk,
};

/** Ortak logo bandı: Marcus Medya × Marka.
 * Logolar Drive bağlantısı olabildiği için aynı adres zincirinden geçirilir; logo yoksa
 * markanın baş harfiyle bir monogram karesi gösterilir — boş bir alan bırakmaktansa. */
function LogoKilidi({ ajansLogo, markaLogo, marka, firmaAdi }) {
  const kutu = { height: 34, maxWidth: 132, objectFit: "contain", display: "block" };
  const monogram = (metin, dolu) => (
    <div style={{
      width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
      background: dolu ? MT.mor : "transparent", border: dolu ? "none" : `1.5px solid ${MT.cizgiKoyu}`,
      color: dolu ? "#fff" : MT.murekkep, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16,
    }}>
      {(metin || "M").charAt(0).toLocaleUpperCase("tr")}
    </div>
  );
  const gorsel = (kaynak, yedekMetin, dolu) => {
    if (!kaynak) return monogram(yedekMetin, dolu);
    if (String(kaynak).startsWith("data:")) return <img src={kaynak} alt="" style={kutu} />;
    const adaylar = driveGorselAdaylari(kaynak);
    if (!adaylar.length) return monogram(yedekMetin, dolu);
    return <img src={adaylar[0]} alt="" style={kutu} referrerPolicy="no-referrer" />;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      {gorsel(ajansLogo, firmaAdi || "Marcus", true)}
      <span style={{ color: MT.cizgiKoyu, fontSize: 17, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>×</span>
      {gorsel(markaLogo, marka, false)}
    </div>
  );
}

/** Durum damgası. Onay ve revize, bir provaya vurulan mühür gibi gösterilir — panelin
 * tamamı bir baskı provası mantığında kurulduğu için tek "cesur" öğe burası; gerisi sakin. */
function Damga({ durum }) {
  const tanim = {
    bekliyor: { metin: "İNCELEMENİZDE", renk: MT.bekleyen, zemin: MT.bekleyenZemin, egim: 0 },
    onaylandi: { metin: "ONAYLANDI", renk: MT.onay, zemin: MT.onayZemin, egim: -2.5 },
    revize: { metin: "REVİZE İSTENDİ", renk: MT.revize, zemin: MT.revizeZemin, egim: -2.5 },
  }[durum] || { metin: "İNCELEMENİZDE", renk: MT.bekleyen, zemin: MT.bekleyenZemin, egim: 0 };

  return (
    <span style={{
      display: "inline-block", padding: "4px 11px", borderRadius: 4,
      border: `1.5px solid ${tanim.renk}`, background: tanim.zemin, color: tanim.renk,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: 0.8,
      transform: `rotate(${tanim.egim}deg)`, whiteSpace: "nowrap",
    }}>
      {tanim.metin}
    </span>
  );
}

export function MusteriPaneli({ musteriData, onCikis, onIslemSonrasi }) {
  const [icerikler, setIcerikler] = useState(musteriData.icerikler || []);
  // Sunucudan yeni veri geldiğinde listeyi tazele. useState başlangıç değeri SADECE ilk
  // render'da okunur — bu senkron olmadan, yönetici bir içerik ekleyip düzenlese ya da
  // onay sonrası veri yenilense bile müşterinin ekranı ilk açılıştaki hâlinde donuyordu.
  useEffect(() => { setIcerikler(musteriData.icerikler || []); }, [musteriData]);
  const [revizeAcikId, setRevizeAcikId] = useState(null);
  const [acikIcerikId, setAcikIcerikId] = useState(null); // açık olan içerik kartı
  const [sekme, setSekme] = useState("onay");
  const [revizeMetni, setRevizeMetni] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(null);

  /**
   * Hareketsizlik çıkışı — SADECE "Beni hatırla" seçilmemişse.
   *
   * Eskiden burada koşulsuz 1 DAKİKALIK bir çıkış vardı: müşteri uzun bir konuşma metnini
   * okurken bile ekrandan atılıyor, üstelik çıkış kayıtlı giriş bilgilerini de sildiği için
   * "Beni hatırla" tamamen işlevsiz kalıyordu.
   *
   * Yeni davranış:
   *  - "Beni hatırla" seçiliyse: otomatik çıkış YOK. Müşteri istediği zaman çıkış butonuyla çıkar.
   *  - Seçili değilse (ortak/paylaşılan bilgisayar): 20 dakika hareketsizlikte çıkış.
   */
  useEffect(() => {
    if (musteriHatirlaniyorMu()) return undefined;
    let zamanlayici = null;
    const sifirla = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => onCikis(), 20 * 60 * 1000);
    };
    const olaylar = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    olaylar.forEach((olay) => window.addEventListener(olay, sifirla, { passive: true }));
    sifirla();
    return () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      olaylar.forEach((olay) => window.removeEventListener(olay, sifirla));
    };
    // eslint-disable-next-line
  }, []);

  const istekAt = (musteriAction, icerikId, revizeNotu) => {
    setGonderiliyor(icerikId);
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ musteriAction, icerikId, revizeNotu }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setIcerikler((liste) => liste.map((i) => (i.id === icerikId
            ? { ...i, durum: musteriAction === "onayla" ? "onaylandi" : "revize", revizeNotu: musteriAction === "onayla" ? null : revizeNotu }
            : i)));
          setRevizeAcikId(null);
          setRevizeMetni("");
          if (onIslemSonrasi) onIslemSonrasi();
        } else {
          window.alert(res.error || "Bir sorun oluştu.");
        }
      })
      .catch(() => window.alert("Bağlantı hatası — tekrar dene."))
      .finally(() => setGonderiliyor(null));
  };

  const DURUM_STIL = {
    bekliyor: { label: "İncelemeni Bekliyor", color: MT.bekleyen, bg: MT.bekleyenZemin },
    onaylandi: { label: "Onayladın ✓", color: MT.onay, bg: MT.onayZemin },
    revize: { label: "Revize İstedin", color: MT.revize, bg: MT.revizeZemin },
  };

  /* Yöneticinin belirlediği sırayı müşteri de AYNEN görür. İki taraf farklı sıralarsa
   * "hangisi doğru?" sorusu doğar; sıra numarası kayıtta saklandığı için ikisi de aynı
   * veriyi okur. Sıra numarası olmayan eski kayıtlar sona düşer. */
  const sirala = (liste) => liste.slice().sort((a, b) => {
    const as = Number.isFinite(Number(a.sira)) ? Number(a.sira) : Infinity;
    const bs = Number.isFinite(Number(b.sira)) ? Number(b.sira) : Infinity;
    return as - bs;
  });
  const bekleyenler = sirala(icerikler.filter((i) => i.durum === "bekliyor"));
  const gecmis = sirala(icerikler.filter((i) => i.durum !== "bekliyor"));

  const sekmeler = [
    { key: "onay", label: "Onay Bekleyenler", rozet: bekleyenler.length },
    { key: "takvim", label: "Paylaşım Takvimi", rozet: 0 },
    { key: "reklam", label: "Reklamlar", rozet: 0 },
    { key: "uretim", label: "Üretim Durumu", rozet: 0 },
  ];

  const bugunYazi = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ background: MT.kagit, minHeight: "100vh", color: MT.murekkep }}>
      <style>{FONTS}</style>

      {/* ÜST BANT — ortak logo kilidi. Panelin müşteriye ait bir teslimat olduğunu ilk
        * bakışta anlatan yer burası; bu yüzden beyaz zemin üzerinde, ince mor bir çizgiyle
        * ayrılmış kendi bandını hak ediyor. */}
      <div style={{ background: MT.kart, borderBottom: `1px solid ${MT.cizgi}`, boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}>
        <div style={{ height: 3, background: MT.mor }} />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <LogoKilidi
            ajansLogo={musteriData.ajansLogo}
            markaLogo={musteriData.markaLogo}
            marka={musteriData.marka}
            firmaAdi={musteriData.firmaAdi}
          />
          <button
            onClick={() => { if (window.confirm("Çıkış yapılsın mı? Tekrar girmek için kullanıcı adı ve şifren gerekecek.")) onCikis(); }}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8,
              background: "transparent", border: `1px solid ${MT.cizgi}`, color: MT.soluk,
              fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            }}
          >
            <LogOut size={14} /> Çıkış
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 70px" }}>
        {/* BAŞLIK — mono etiket + marka adı. "Onay Paneli" ifadesi ne yapılacağını söyler. */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ ...ETIKET, marginBottom: 6 }}>Onay Paneli · {bugunYazi}</div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.15 }}>
            {musteriData.marka}
          </h1>
          <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 13.5, color: MT.soluk, lineHeight: 1.6, maxWidth: 560 }}>
            {musteriData.firmaAdi} tarafından hazırlanan içerikler burada. İnceleyip onaylayabilir
            ya da değişiklik isteyebilirsiniz.
          </p>
        </div>

        {/* SEKMELER — bölümlü bir sayfa, tek uzun akış değil. */}
        <div style={{ display: "flex", gap: 4, marginBottom: 22, overflowX: "auto", borderBottom: `1px solid ${MT.cizgi}` }}>
          {sekmeler.map((sk) => {
            const aktif = sekme === sk.key;
            return (
              <button
                key={sk.key}
                onClick={() => setSekme(sk.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "10px 14px 11px",
                  background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: aktif ? 600 : 500,
                  color: aktif ? MT.murekkep : MT.soluk,
                  borderBottom: `2px solid ${aktif ? MT.mor : "transparent"}`, marginBottom: -1,
                }}
              >
                {sk.label}
                {sk.rozet > 0 && (
                  <span style={{
                    background: aktif ? MT.mor : MT.morSoluk, color: aktif ? "#fff" : MT.mor,
                    borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>{sk.rozet}</span>
                )}
              </button>
            );
          })}
        </div>

        {sekme === "onay" && <>
        <div style={{ ...ETIKET, marginBottom: 12 }}>
          Onayınızı bekleyenler{bekleyenler.length > 0 ? ` · ${bekleyenler.length} içerik` : ""}
        </div>

        {bekleyenler.length === 0 ? (
          <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", marginBottom: 30 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Şu an bekleyen bir şey yok</div>
            <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Yeni bir içerik hazırlandığında burada görünecek ve e-posta alacaksınız.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
            {bekleyenler.map((icerik, sira) => {
              const embed = driveEmbedUrl(icerik.driveLinki);
              const cekimEmbed = icerik.tur === "cekim" ? driveEmbedUrl(icerik.referansLink) : null;
              const kartAcik = acikIcerikId === icerik.id;
              return (
                <div key={icerik.id} style={{ background: MT.kart, border: `1px solid ${kartAcik ? MT.cizgiKoyu : MT.cizgi}`, borderRadius: 12, padding: 0, overflow: "hidden" }}>
                  {/* Başlığa tıklayınca açılır/kapanır. Uzun konuşma metinleri listeyi
                    * metrelerce uzatıyordu; hepsi kapalı başlar.
                    * Sol taraftaki numara SÜS DEĞİL: yayın sırasını gösteriyor. */}
                  <button
                    onClick={() => setAcikIcerikId(kartAcik ? null : icerik.id)}
                    style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "none", border: "none", padding: "14px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  >
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600,
                      color: MT.soluk, background: MT.kagit, border: `1px solid ${MT.cizgi}`,
                      borderRadius: 6, padding: "5px 8px", flexShrink: 0, minWidth: 30, textAlign: "center",
                    }}>
                      {String(sira + 1).padStart(2, "0")}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>
                        {basligiTemizle(icerik.aciklama) || (icerik.tur === "cekim" ? "Çekim Planı" : icerik.tur)}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: MT.soluk, fontFamily: "Inter" }}>
                        {icerik.tur === "cekim" ? "Çekim planı" : icerik.tur === "video" ? "Video" : "Görsel"} · {icerik.tarih}
                        {icerik.tur === "cekim" && icerik.planlananTarih && ` · Çekim: ${tarihGoster(icerik.planlananTarih)}`}
                      </span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <Damga durum={icerik.durum} />
                      <span style={{ color: MT.soluk, fontSize: 12, fontFamily: "Inter" }}>{kartAcik ? "▲" : "▼"}</span>
                    </span>
                  </button>

                  {kartAcik && <div style={{ marginTop: 14 }}>

                  {/* ÇEKİM PLANI: referans video + konuşma metni + çekim notu */}
                  {icerik.tur === "cekim" && (
                    <div style={{ marginBottom: 12 }}>
                      {icerik.konusmali && (
                        <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: MT.mor, background: MT.morSoluk, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter", marginBottom: 10 }}>
                          {icerik.konusmali === "konusmali" ? "KONUŞMALI" : icerik.konusmali === "seslendirme" ? "DIŞ SES" : "KONUŞMASIZ"}
                        </div>
                      )}

                      {cekimEmbed && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>REFERANS VİDEO</div>
                          <DriveVideo link={icerik.referansLink} yon={icerik.videoYonu} baslik="Referans video" />
                        </div>
                      )}
                      {!cekimEmbed && icerik.referansLink && (
                        <a href={icerik.referansLink} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 10, color: MT.mor, fontSize: 12.5, fontFamily: "Inter" }}>
                          ▶ Referans videoyu izle ↗
                        </a>
                      )}

                      {icerik.konusmaMetni && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>
                            {icerik.konusmali === "seslendirme" ? "DIŞ SES METNİ" : "KONUŞMA METNİ"}
                          </div>
                          <div style={{ background: MT.kagit, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: MT.murekkep, fontFamily: "Inter", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            {icerik.konusmaMetni}
                          </div>
                        </div>
                      )}

                      {icerik.cekimNotu && (
                        <div>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>ÇEKİM NOTU</div>
                          <div style={{ fontSize: 12.5, color: MT.soluk, fontFamily: "Inter", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{icerik.cekimNotu}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Eski kayıtlar base64 görsel taşıyor, yeniler Drive bağlantısı — ikisi de desteklenir. */}
                  {icerik.gorselUrl && (
                    <img src={icerik.gorselUrl} alt={icerik.aciklama || ""} style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }} />
                  )}
                  {!icerik.gorselUrl && icerik.tur === "gorsel" && icerik.driveLinki && (
                    <div style={{ marginBottom: 12 }}><DriveGorsel link={icerik.driveLinki} yukseklik={460} /></div>
                  )}
                  {!icerik.gorselUrl && icerik.tur !== "gorsel" && embed && (
                    <div style={{ marginBottom: 12 }}><DriveVideo link={icerik.driveLinki} yon={icerik.videoYonu} baslik={icerik.aciklama || "içerik"} /></div>
                  )}
                  {!icerik.gorselUrl && icerik.tur !== "gorsel" && !embed && icerik.driveLinki && (
                    <a href={icerik.driveLinki} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 12, color: MT.mor, fontSize: 12.5, fontFamily: "Inter" }}>İçeriği Görüntüle ↗</a>
                  )}

                  {revizeAcikId === icerik.id ? (
                    <div>
                      <textarea
                        autoFocus
                        value={revizeMetni}
                        onChange={(e) => setRevizeMetni(e.target.value)}
                        placeholder="Neyin değişmesini istiyorsun?"
                        rows={3}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 10, fontFamily: "Inter" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={cancelBtnStyle} onClick={() => { setRevizeAcikId(null); setRevizeMetni(""); }}>İptal</button>
                        <button
                          style={{ ...saveBtnStyle, background: MT.revize }}
                          disabled={gonderiliyor === icerik.id || !revizeMetni.trim()}
                          onClick={() => istekAt("revizeIste", icerik.id, revizeMetni)}
                        >
                          {gonderiliyor === icerik.id ? "Gönderiliyor…" : "Revize İsteğini Gönder"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        style={{
                          flex: "1 1 160px", justifyContent: "center", display: "flex", alignItems: "center",
                          padding: "12px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                          background: MT.onay, color: "#fff",
                          fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600,
                          opacity: gonderiliyor === icerik.id ? 0.6 : 1,
                        }}
                        disabled={gonderiliyor === icerik.id}
                        onClick={() => istekAt("onayla", icerik.id)}
                      >
                        {gonderiliyor === icerik.id ? "Gönderiliyor…" : (icerik.tur === "cekim" ? "Planı onayla" : "Onayla")}
                      </button>
                      <button
                        style={{
                          flex: "1 1 160px", justifyContent: "center", display: "flex", alignItems: "center",
                          padding: "12px 18px", borderRadius: 9, cursor: "pointer",
                          background: MT.kart, border: `1px solid ${MT.cizgiKoyu}`, color: MT.murekkep,
                          fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 500,
                        }}
                        onClick={() => { setRevizeAcikId(icerik.id); setRevizeMetni(""); }}
                      >
                        Değişiklik iste
                      </button>
                    </div>
                  )}
                  </div>}
                </div>
              );
            })}
          </div>
        )}

        {gecmis.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: MT.murekkep, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Geçmiş</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gecmis.map((icerik) => {
                const stil = DURUM_STIL[icerik.durum] || DURUM_STIL.bekliyor;
                const acik = acikIcerikId === icerik.id;
                const gecmisEmbed = driveEmbedUrl(icerik.driveLinki);
                return (
                  <div key={icerik.id} style={{ background: MT.kart, border: `1px solid ${acik ? MT.cizgiKoyu : MT.cizgi}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Geçmişteki kayıtlar da AÇILABİLİR ve küçük bir önizleme taşır.
                      * Eskiden yalnızca başlık, tarih ve revize notu görünüyordu; "hangi görsele
                      * ne demiştim?" sorusunun cevabı kayboluyordu. Küçük kare hızlı tanımayı,
                      * açılan görünüm tam incelemeyi sağlar. */}
                    <button
                      onClick={() => setAcikIcerikId(acik ? null : icerik.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "12px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <span style={{ width: 46, height: 46, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: MT.kagit, border: `1px solid ${MT.cizgi}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {icerik.tur === "gorsel" && icerik.driveLinki
                          ? <DriveKucukGorsel link={icerik.driveLinki} />
                          : icerik.gorselUrl && String(icerik.gorselUrl).startsWith("data:")
                            ? <img src={icerik.gorselUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 15 }}>{icerik.tur === "cekim" ? "🎬" : icerik.tur === "video" ? "▶" : "🖼"}</span>}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13, color: MT.murekkep, fontWeight: 600, fontFamily: "Inter" }}>{basligiTemizle(icerik.aciklama) || icerik.tur}</span>
                        <span style={{ display: "block", fontSize: 11, color: MT.soluk, fontFamily: "Inter", marginTop: 2 }}>{icerik.tarih}</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: stil.color, background: stil.bg, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter" }}>{stil.label}</span>
                        <span style={{ color: MT.soluk, fontSize: 11 }}>{acik ? "▲" : "▼"}</span>
                      </span>
                    </button>

                    {icerik.revizeNotu && (
                      <div style={{ padding: "0 16px 12px", fontSize: 12.5, color: MT.revize, fontFamily: "Inter", fontStyle: "italic", lineHeight: 1.6 }}>
                        "{icerik.revizeNotu}"
                      </div>
                    )}

                    {acik && (
                      <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${MT.cizgi}`, paddingTop: 14 }}>
                        {icerik.gorselUrl && String(icerik.gorselUrl).startsWith("data:") && (
                          <img src={icerik.gorselUrl} alt="" style={{ width: "100%", borderRadius: 9, display: "block", marginBottom: 10 }} />
                        )}
                        {!icerik.gorselUrl && icerik.tur === "gorsel" && icerik.driveLinki && (
                          <div style={{ marginBottom: 10 }}><DriveGorsel link={icerik.driveLinki} yukseklik={420} /></div>
                        )}
                        {icerik.tur === "video" && icerik.driveLinki && (
                          <div style={{ marginBottom: 10 }}><DriveVideo link={icerik.driveLinki} yon={icerik.videoYonu} /></div>
                        )}
                        {icerik.tur === "cekim" && (
                          <>
                            {icerik.referansLink && <div style={{ marginBottom: 10 }}><DriveVideo link={icerik.referansLink} yon={icerik.videoYonu} baslik="Referans video" /></div>}
                            {icerik.konusmaMetni && (
                              <div style={{ background: MT.kagit, borderRadius: 9, padding: "12px 14px", fontSize: 13, color: MT.murekkep, fontFamily: "Inter", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {icerik.konusmaMetni}
                              </div>
                            )}
                          </>
                        )}
                        {!icerik.driveLinki && !icerik.gorselUrl && !icerik.referansLink && !icerik.konusmaMetni && (
                          <div style={{ fontSize: 12.5, color: MT.soluk, fontFamily: "Inter" }}>Bu kayda ait bir görsel ya da video bulunmuyor.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        </>}

        {/* PAYLAŞIM TAKVİMİ — Instagram önizlemeleriyle */}
        {sekme === "takvim" && <MusteriPaylasimPlani plan={musteriData.paylasimPlani || []} marka={musteriData.marka} />}

        {/* REKLAMLAR — markanın aktif/biten kampanyaları. Bütçe bilgisi bilerek gönderilmez. */}
        {sekme === "reklam" && <MusteriReklamlar reklamlar={musteriData.reklamlar || []} />}

        {/* ÜRETİM — hangi iş hangi aşamada. */}
        {sekme === "uretim" && <MusteriOperasyon isler={musteriData.operasyonIsleri || []} />}

        {/* Alt çıkış — uzun listelerde en yukarı dönmek zorunda kalmamak için. */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${MT.cizgi}`, textAlign: "center" }}>
          <button
            onClick={() => { if (window.confirm("Çıkış yapılsın mı? Tekrar girmek için kullanıcı adı ve şifren gerekecek.")) onCikis(); }}
            style={{ ...cancelBtnStyle, fontSize: 12.5, padding: "9px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <LogOut size={14} /> Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}

/** Müşteri panelinde haftalık paylaşım planı. Gelecek haftalar önce gösterilir; geçmiş
 * haftalar "yapıldı" bilgisiyle altta kalır. */
export function MusteriPaylasimPlani({ plan, marka }) {
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [gorunum, setGorunum] = useState("izgara"); // "izgara" (genel görünüm) | "akis"
  const [secili, setSecili] = useState(null);
  if (!plan || plan.length === 0) {
    return (
      <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Henüz paylaşım planı oluşturulmadı.</div>
      </div>
    );
  }

  const buHafta = haftaBaslangici();
  const gelecek = plan.filter((p) => p.haftaKey >= buHafta);
  const gecmis = plan.filter((p) => p.haftaKey < buHafta).sort((a, b) => (a.haftaKey < b.haftaKey ? 1 : -1));

  const haftaBasligi = (key) => {
    const d = new Date(key);
    if (Number.isNaN(d.getTime())) return key;
    return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} haftası`;
  };
  const gruplar = {};
  gelecek.forEach((p) => { (gruplar[p.haftaKey] = gruplar[p.haftaKey] || []).push(p); });
  const siraliHaftalar = Object.keys(gruplar).sort();

  /** Gönderiler Instagram akışı gibi gösterilir — müşteri neyin nasıl görüneceğini
   * paylaşılmadan önce görsel olarak değerlendirebilsin diye. */
  const Izgara = ({ liste }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
      {liste.map((p) => (
        <InstagramOnizleme
          key={p.id}
          marka={marka}
          tur={p.tur}
          gun={p.gun}
          gorselUrl={p.gorselUrl}
          altMetin={p.altMetin}
          yapildi={p.yapildi}
        />
      ))}
    </div>
  );

  const tumGonderiler = [...gecmis].reverse().concat(gelecek);

  return (
    <div>
      {/* Görünüm seçici: ızgara = hesabın genel görünümü, akış = tek tek inceleme */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, justifyContent: "center" }}>
        {[{ key: "izgara", label: "Genel Görünüm" }, { key: "akis", label: "Tek Tek" }].map((g) => (
          <button
            key={g.key}
            onClick={() => { setGorunum(g.key); setSecili(null); }}
            style={{ padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter", fontSize: 12.5, fontWeight: 600,
              background: gorunum === g.key ? MT.morSoluk : MT.kagit, color: gorunum === g.key ? MT.mor : MT.soluk }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {gorunum === "izgara" && (
        <>
          <InstagramIzgara marka={marka} gonderiler={tumGonderiler} onSec={setSecili} />
          {secili && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <div>
                <InstagramOnizleme marka={marka} tur={secili.tur} gun={secili.gun} gorselUrl={secili.gorselUrl} altMetin={secili.altMetin} yapildi={secili.yapildi} />
                <button style={{ ...cancelBtnStyle, width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => setSecili(null)}>Kapat</button>
              </div>
            </div>
          )}
        </>
      )}

      {gorunum === "akis" && <>
      {siraliHaftalar.length === 0 && gecmis.length === 0 && (
        <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Henüz plan oluşturulmadı.</div>
        </div>
      )}
      {siraliHaftalar.map((hk) => (
        <div key={hk} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: MT.soluk, fontFamily: "Inter", fontWeight: 700, marginBottom: 12, letterSpacing: 0.3 }}>
            {haftaBasligi(hk).toLocaleUpperCase("tr")}
          </div>
          <Izgara liste={gruplar[hk]} />
        </div>
      ))}
      {gecmis.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setGecmisAcik((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: MT.soluk, fontFamily: "Inter", fontWeight: 600 }}>
            {gecmisAcik ? "▾" : "▸"} Geçmiş paylaşımlar ({gecmis.length})
          </button>
          {gecmisAcik && <div style={{ marginTop: 14 }}><Izgara liste={gecmis} /></div>}
        </div>
      )}
      </>}
    </div>
  );
}

/** Müşteri panelinde markanın reklam kampanyaları. */
export function MusteriReklamlar({ reklamlar }) {
  if (!reklamlar || reklamlar.length === 0) {
    return (
      <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Şu an kayıtlı bir reklam kampanyası yok.</div>
      </div>
    );
  }
  const durumStil = { aktif: { label: "Yayında", color: MT.onay, bg: MT.onayZemin }, yakinda: { label: "Yakında bitiyor", color: MT.bekleyen, bg: MT.bekleyenZemin }, bitti: { label: "Sona erdi", color: MT.soluk, bg: MT.kagit } };
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {reklamlar.map((r) => {
          const st = durumStil[reklamDurumu(r)] || durumStil.aktif;
          return (
            <div key={r.id} style={{ background: MT.kagit, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: MT.murekkep, fontFamily: "Inter", fontWeight: 600 }}>{r.reklamAdi}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: MT.soluk, fontFamily: "Inter", marginTop: 3 }}>
                {tarihGoster(r.baslangicTarihi)} — {tarihGoster(r.bitisTarihi)}
              </div>
              {r.not && <div style={{ fontSize: 12, color: MT.soluk, fontFamily: "Inter", marginTop: 5, lineHeight: 1.6 }}>{r.not}</div>}
              {istatistikVarMi(r) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {[
                    { l: "Erişim", v: r.erisim },
                    { l: "Gösterim", v: r.gosterim },
                    { l: "Tıklama", v: r.tiklama },
                    { l: "Etkileşim", v: r.etkilesim },
                    { l: "Sonuç", v: r.sonuc },
                  ].filter((x) => Number(x.v) > 0).map((x) => (
                    <div key={x.l} style={{ background: MT.kart, borderRadius: 9, padding: "7px 12px", minWidth: 78 }}>
                      <div style={{ fontSize: 9.5, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3 }}>{x.l.toLocaleUpperCase("tr")}</div>
                      <div style={{ fontSize: 14, color: MT.murekkep, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{Number(x.v).toLocaleString("tr-TR")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Müşteri panelinde üretim süreci — hangi iş hangi aşamada. */
export function MusteriOperasyon({ isler }) {
  const [hepsiAcik, setHepsiAcik] = useState(false);
  if (!isler || isler.length === 0) {
    return (
      <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Şu an devam eden bir üretim kaydı yok.</div>
      </div>
    );
  }

  const devamEden = isler.filter((j) => j.asama !== "Teslim Edildi");
  const bitenler = isler.filter((j) => j.asama === "Teslim Edildi");
  const gosterilen = hepsiAcik ? bitenler : bitenler.slice(-5);

  const Satir = ({ j }) => (
    <div style={{ background: MT.kagit, borderRadius: 10, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 12.5, color: MT.murekkep, fontFamily: "Inter", fontWeight: 600 }}>
          {j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}{j.uretilenAdet ? ` · ${j.uretilenAdet} parça` : ""}
        </div>
        <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", marginTop: 2 }}>
          {j.asama === "Teslim Edildi" && j.teslimEdilmeTarihi
            ? `Teslim: ${tarihGoster(j.teslimEdilmeTarihi)}`
            : j.teslimTarihi ? `Planlanan teslim: ${tarihGoster(j.teslimTarihi)}` : ""}
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "Inter", padding: "3px 10px", borderRadius: 999,
        color: j.asama === "Teslim Edildi" ? MT.onay : MT.bekleyen,
        background: j.asama === "Teslim Edildi" ? MT.onayZemin : MT.bekleyenZemin }}>
        {j.asama}
      </span>
    </div>
  );

  return (
    <div>
      {devamEden.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: bitenler.length > 0 ? 12 : 0 }}>
          {devamEden.map((j) => <Satir key={j.id} j={j} />)}
        </div>
      )}
      {bitenler.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>Tamamlananlar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gosterilen.map((j) => <Satir key={j.id} j={j} />)}
          </div>
          {bitenler.length > 5 && (
            <button onClick={() => setHepsiAcik((v) => !v)} style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontSize: 12, color: MT.soluk, fontFamily: "Inter", fontWeight: 600 }}>
              {hepsiAcik ? "Daha az göster" : `+ ${bitenler.length - 5} tane daha göster`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

