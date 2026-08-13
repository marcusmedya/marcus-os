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
  T, Card, fmt, tarihGoster, inputStyle, saveBtnStyle, cancelBtnStyle, iconBtnStyle,
  haftaBaslangici, reklamDurumu, authHeaders, clearMusteriCreds, musteriHatirlaniyorMu,
  FONTS, basligiTemizle, istatistikVarMi,
} from "./tema.jsx";
import { LogOut, Trash2 } from "lucide-react";
import { driveEmbedUrl, DriveGorsel, DriveVideo } from "./drive.jsx";
import { InstagramOnizleme, InstagramIzgara } from "./instagram.jsx";

/** Müşteri Paneli — owner/personel arayüzünden tamamen izole, sade bir onay ekranı.
 * Sadece kendi markasının içeriklerini görür; her içeriği onaylayabilir ya da revize isteyebilir. */
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
    bekliyor: { label: "İncelemeni Bekliyor", color: T.warning, bg: T.warningSoft },
    onaylandi: { label: "Onayladın ✓", color: T.success, bg: T.successSoft },
    revize: { label: "Revize İstedin", color: T.danger, bg: T.dangerSoft },
  };

  const bekleyenler = icerikler.filter((i) => i.durum === "bekliyor");
  const gecmis = icerikler.filter((i) => i.durum !== "bekliyor");

  const sekmeler = [
    { key: "onay", label: "Onay Bekleyenler", rozet: bekleyenler.length },
    { key: "takvim", label: "Paylaşım Takvimi", rozet: 0 },
    { key: "reklam", label: "Reklamlar", rozet: 0 },
    { key: "uretim", label: "Üretim Durumu", rozet: 0 },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>{musteriData.firmaAdi}</div>
            <div style={{ fontSize: 19, color: T.text, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{musteriData.marka}</div>
          </div>
          <button
            onClick={() => { if (window.confirm("Çıkış yapılsın mı? Tekrar girmek için kullanıcı adı ve şifren gerekecek.")) onCikis(); }}
            style={{ ...cancelBtnStyle, fontSize: 12.5, padding: "9px 15px", display: "flex", alignItems: "center", gap: 6 }}
          >
            <LogOut size={14} /> Çıkış Yap
          </button>
        </div>

        {/* SEKMELER — her şey tek sayfada alt alta akmak yerine bölümlere ayrıldı. */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {sekmeler.map((sk) => (
            <button
              key={sk.key}
              onClick={() => setSekme(sk.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600,
                background: sekme === sk.key ? T.accent : T.surfaceRaised,
                color: sekme === sk.key ? "#fff" : T.textDim,
              }}
            >
              {sk.label}
              {sk.rozet > 0 && (
                <span style={{ background: sekme === sk.key ? "rgba(255,255,255,.25)" : T.warningSoft, color: sekme === sk.key ? "#fff" : T.warning, borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>{sk.rozet}</span>
              )}
            </button>
          ))}
        </div>

        {sekme === "onay" && <>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>
          İncelemeni Bekleyenler {bekleyenler.length > 0 && `(${bekleyenler.length})`}
        </div>

        {bekleyenler.length === 0 ? (
          <Card style={{ padding: "24px", textAlign: "center", marginBottom: 28 }}>
            <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Şu an incelemen gereken bir içerik yok.</div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {bekleyenler.map((icerik) => {
              const embed = driveEmbedUrl(icerik.driveLinki);
              const cekimEmbed = icerik.tur === "cekim" ? driveEmbedUrl(icerik.referansLink) : null;
              const kartAcik = acikIcerikId === icerik.id;
              return (
                <Card key={icerik.id} style={{ padding: 16, border: `1px solid ${T.warning}` }}>
                  {/* Başlığa tıklayınca açılır/kapanır. Uzun konuşma metinleri listeyi
                    * metrelerce uzatıyordu; artık hepsi kapalı başlar. */}
                  <button
                    onClick={() => setAcikIcerikId(kartAcik ? null : icerik.id)}
                    style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 4 }}>
                        {icerik.tur === "cekim" && <span style={{ color: T.accentText }}>🎬 </span>}
                        {basligiTemizle(icerik.aciklama) || (icerik.tur === "cekim" ? "Çekim Planı" : icerik.tur)}
                      </span>
                      <span style={{ display: "block", fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>
                        {icerik.tarih}
                        {icerik.tur === "cekim" && icerik.planlananTarih && ` · Planlanan çekim: ${tarihGoster(icerik.planlananTarih)}`}
                      </span>
                    </span>
                    <span style={{ color: T.accentText, fontSize: 11.5, flexShrink: 0, fontFamily: "Inter", fontWeight: 600 }}>
                      {kartAcik ? "Kapat ▲" : "Aç ▼"}
                    </span>
                  </button>

                  {kartAcik && <div style={{ marginTop: 14 }}>

                  {/* ÇEKİM PLANI: referans video + konuşma metni + çekim notu */}
                  {icerik.tur === "cekim" && (
                    <div style={{ marginBottom: 12 }}>
                      {icerik.konusmali && (
                        <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: T.accentText, background: T.accentSoft, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter", marginBottom: 10 }}>
                          {icerik.konusmali === "konusmali" ? "KONUŞMALI" : icerik.konusmali === "seslendirme" ? "DIŞ SES" : "KONUŞMASIZ"}
                        </div>
                      )}

                      {cekimEmbed && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>REFERANS VİDEO</div>
                          <DriveVideo link={icerik.referansLink} yon={icerik.videoYonu} baslik="Referans video" />
                        </div>
                      )}
                      {!cekimEmbed && icerik.referansLink && (
                        <a href={icerik.referansLink} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 10, color: T.accentText, fontSize: 12.5, fontFamily: "Inter" }}>
                          ▶ Referans videoyu izle ↗
                        </a>
                      )}

                      {icerik.konusmaMetni && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>
                            {icerik.konusmali === "seslendirme" ? "DIŞ SES METNİ" : "KONUŞMA METNİ"}
                          </div>
                          <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: T.text, fontFamily: "Inter", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            {icerik.konusmaMetni}
                          </div>
                        </div>
                      )}

                      {icerik.cekimNotu && (
                        <div>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>ÇEKİM NOTU</div>
                          <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{icerik.cekimNotu}</div>
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
                    <a href={icerik.driveLinki} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 12, color: T.accentText, fontSize: 12.5, fontFamily: "Inter" }}>İçeriği Görüntüle ↗</a>
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
                          style={{ ...saveBtnStyle, background: T.danger }}
                          disabled={gonderiliyor === icerik.id || !revizeMetni.trim()}
                          onClick={() => istekAt("revizeIste", icerik.id, revizeMetni)}
                        >
                          {gonderiliyor === icerik.id ? "Gönderiliyor…" : "Revize İsteğini Gönder"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...saveBtnStyle, flex: 1, justifyContent: "center" }}
                        disabled={gonderiliyor === icerik.id}
                        onClick={() => istekAt("onayla", icerik.id)}
                      >
                        {gonderiliyor === icerik.id ? "…" : (icerik.tur === "cekim" ? "✓ Planı Onayla" : "✓ Onayla")}
                      </button>
                      <button style={{ ...cancelBtnStyle, flex: 1, justifyContent: "center" }} onClick={() => { setRevizeAcikId(icerik.id); setRevizeMetni(""); }}>
                        Revize İste
                      </button>
                    </div>
                  )}
                  </div>}
                </Card>
              );
            })}
          </div>
        )}

        {gecmis.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Geçmiş</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gecmis.map((icerik) => {
                const stil = DURUM_STIL[icerik.durum] || DURUM_STIL.bekliyor;
                return (
                  <Card key={icerik.id} style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: icerik.revizeNotu ? 6 : 0 }}>
                      <div>
                        <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{basligiTemizle(icerik.aciklama) || icerik.tur}</div>
                        <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>{icerik.tarih}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: stil.color, background: stil.bg, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter" }}>{stil.label}</span>
                    </div>
                    {icerik.revizeNotu && <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", fontStyle: "italic" }}>"{icerik.revizeNotu}"</div>}
                  </Card>
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
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${T.borderSoft}`, textAlign: "center" }}>
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
      <Card style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz paylaşım planı oluşturulmadı.</div>
      </Card>
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
              background: gorunum === g.key ? T.accentSoft : T.surfaceRaised, color: gorunum === g.key ? T.accentText : T.textDim }}
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
        <Card style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz plan oluşturulmadı.</div>
        </Card>
      )}
      {siraliHaftalar.map((hk) => (
        <div key={hk} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 700, marginBottom: 12, letterSpacing: 0.3 }}>
            {haftaBasligi(hk).toLocaleUpperCase("tr")}
          </div>
          <Izgara liste={gruplar[hk]} />
        </div>
      ))}
      {gecmis.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setGecmisAcik((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}>
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
      <Card style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Şu an kayıtlı bir reklam kampanyası yok.</div>
      </Card>
    );
  }
  const durumStil = { aktif: { label: "Yayında", color: T.success, bg: T.successSoft }, yakinda: { label: "Yakında bitiyor", color: T.warning, bg: T.warningSoft }, bitti: { label: "Sona erdi", color: T.textFaint, bg: T.surfaceRaised } };
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {reklamlar.map((r) => {
          const st = durumStil[reklamDurumu(r)] || durumStil.aktif;
          return (
            <div key={r.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.reklamAdi}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 3 }}>
                {tarihGoster(r.baslangicTarihi)} — {tarihGoster(r.bitisTarihi)}
              </div>
              {r.not && <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", marginTop: 5, lineHeight: 1.6 }}>{r.not}</div>}
              {istatistikVarMi(r) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {[
                    { l: "Erişim", v: r.erisim },
                    { l: "Gösterim", v: r.gosterim },
                    { l: "Tıklama", v: r.tiklama },
                    { l: "Etkileşim", v: r.etkilesim },
                    { l: "Sonuç", v: r.sonuc },
                  ].filter((x) => Number(x.v) > 0).map((x) => (
                    <div key={x.l} style={{ background: T.surface, borderRadius: 9, padding: "7px 12px", minWidth: 78 }}>
                      <div style={{ fontSize: 9.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3 }}>{x.l.toLocaleUpperCase("tr")}</div>
                      <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{Number(x.v).toLocaleString("tr-TR")}</div>
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
      <Card style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Şu an devam eden bir üretim kaydı yok.</div>
      </Card>
    );
  }

  const devamEden = isler.filter((j) => j.asama !== "Teslim Edildi");
  const bitenler = isler.filter((j) => j.asama === "Teslim Edildi");
  const gosterilen = hepsiAcik ? bitenler : bitenler.slice(-5);

  const Satir = ({ j }) => (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>
          {j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}{j.uretilenAdet ? ` · ${j.uretilenAdet} parça` : ""}
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
          {j.asama === "Teslim Edildi" && j.teslimEdilmeTarihi
            ? `Teslim: ${tarihGoster(j.teslimEdilmeTarihi)}`
            : j.teslimTarihi ? `Planlanan teslim: ${tarihGoster(j.teslimTarihi)}` : ""}
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "Inter", padding: "3px 10px", borderRadius: 999,
        color: j.asama === "Teslim Edildi" ? T.success : T.warning,
        background: j.asama === "Teslim Edildi" ? T.successSoft : T.warningSoft }}>
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
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>Tamamlananlar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gosterilen.map((j) => <Satir key={j.id} j={j} />)}
          </div>
          {bitenler.length > 5 && (
            <button onClick={() => setHepsiAcik((v) => !v)} style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}>
              {hepsiAcik ? "Daha az göster" : `+ ${bitenler.length - 5} tane daha göster`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

