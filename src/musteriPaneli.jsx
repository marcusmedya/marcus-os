/**
 * MÜŞTERİ PANELİ VE DRIVE MEDYA
 *
 * Müşterinin gördüğü panel (onay bekleyenler, paylaşım takvimi, reklamlar, üretim durumu) ve
 * Google Drive bağlantılarını görsel/video olarak gösteren parçalar.
 *
 * Drive tarafı ayrı durmayı hak ediyor çünkü Google'ın adres davranışı zamanla değişiyor;
 * hangi adreslerin denendiği ve hatanın nasıl gösterildiği tek yerde toplu olmalı.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  tarihGoster, cancelBtnStyle, haftaBaslangici, reklamDurumu, musteriHatirlaniyorMu, FONTS, basligiTemizle, istatistikVarMi, authHeaders,
  turEtiketi, TurRozet, inputStyle, saveBtnStyle,
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
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: MT.soluk,
};

/** Ortak logo bandı: Marcus Medya × Marka.
 * Logolar Drive bağlantısı olabildiği için aynı adres zincirinden geçirilir; logo yoksa
 * markanın baş harfiyle bir monogram karesi gösterilir — boş bir alan bırakmaktansa. */
/**
 * LOGONUN PARLAKLIĞINI ÖLÇER — açık renkli bir logo açık zeminde kaybolur.
 *
 * Görseli bir tuvale çizip SAYDAM OLMAYAN piksellerin ortalama parlaklığına bakar. Saydam
 * pikselleri saymak şart: çoğu logo saydam zeminli PNG'dir ve onları da sayarsak her logo
 * "açık" çıkardı.
 *
 * Drive bağlantılarında tarayıcı güvenlik kuralları piksel okumayı engeller — o durumda null
 * döner ve arayüz zemin eklemez (mevcut davranış korunur).
 */
function useLogoParlakligi(kaynak) {
  const [parlaklik, setParlaklik] = useState(null);
  useEffect(() => {
    if (!kaynak || !String(kaynak).startsWith("data:")) { setParlaklik(null); return undefined; }
    let iptal = false;
    const img = new Image();
    img.onload = () => {
      try {
        const boy = 32;                       // küçük örnek yeterli, hızlı
        const c = document.createElement("canvas");
        c.width = boy; c.height = boy;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, boy, boy);
        const d = ctx.getImageData(0, 0, boy, boy).data;
        let toplam = 0, sayi = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 40) continue;        // saydam piksel sayılmaz
          toplam += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          sayi += 1;
        }
        if (!iptal && sayi > 0) setParlaklik(toplam / sayi);
      } catch (e) { /* piksel okunamadı — zemin eklenmez */ }
    };
    img.src = kaynak;
    return () => { iptal = true; };
  }, [kaynak]);
  return parlaklik;
}

function LogoKilidi({ ajansLogo, markaLogo, marka, firmaAdi }) {
  // Logolar 34px'ti ve marka bandında kaybolup gidiyordu.
  const kutu = { height: 52, maxWidth: 200, objectFit: "contain", display: "block" };
  const ajansParlaklik = useLogoParlakligi(ajansLogo);
  const markaParlaklik = useLogoParlakligi(markaLogo);

  /* Açık renkli logo (parlaklık > 170) bu açık zeminli panelde kaybolur; arkasına koyu bir
   * zemin konur. Koyu logolar olduğu gibi bırakılır — zaten görünüyorlar. */
  const zemin = (p) => (p != null && p > 170
    ? { background: MT.murekkep, borderRadius: 10, padding: "6px 10px" }
    : null);
  const monogram = (metin, dolu) => (
    <div style={{
      width: 52, height: 52, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
      background: dolu ? MT.mor : "transparent", border: dolu ? "none" : `1.5px solid ${MT.cizgiKoyu}`,
      color: dolu ? "#fff" : MT.murekkep, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28,
    }}>
      {(metin || "M").charAt(0).toLocaleUpperCase("tr")}
    </div>
  );
  const gorsel = (kaynak, yedekMetin, dolu, parlaklik) => {
    if (!kaynak) return monogram(yedekMetin, dolu);
    const sar = (ic) => {
      const z = zemin(parlaklik);
      return z ? <span style={{ display: "inline-flex", ...z }}>{ic}</span> : ic;
    };
    if (String(kaynak).startsWith("data:")) return sar(<img src={kaynak} alt="" style={kutu} />);
    const adaylar = driveGorselAdaylari(kaynak);
    if (!adaylar.length) return monogram(yedekMetin, dolu);
    return sar(<img src={adaylar[0]} alt="" style={kutu} referrerPolicy="no-referrer" />);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      {gorsel(ajansLogo, firmaAdi || "Marcus", true, ajansParlaklik)}
      <span style={{ color: MT.cizgiKoyu, fontSize: 20, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>×</span>
      {gorsel(markaLogo, marka, false, markaParlaklik)}
    </div>
  );
}

/* Durum etiketleri MODÜL SEVİYESİNDE tutulur: hem MusteriPaneli hem DurumListesi kullanıyor.
 * Bir bileşenin içinde tanımlıyken diğeri onu göremiyordu ve o sekmeye tıklandığında sayfa
 * çöküyordu — bileşen ekrana gelmeden hata ortaya çıkmadığı için gözden kaçmıştı. */
const DURUM_STIL = {
  bekliyor: { label: "İncelemeni Bekliyor", color: MT.bekleyen, bg: MT.bekleyenZemin },
  onaylandi: { label: "Onayladın ✓", color: MT.onay, bg: MT.onayZemin },
  revize: { label: "Revize İstedin", color: MT.revize, bg: MT.revizeZemin },
};

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
      display: "inline-block", padding: "6px 10px", borderRadius: 4,
      border: `1.5px solid ${tanim.renk}`, background: tanim.zemin, color: tanim.renk,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
      transform: `rotate(${tanim.egim}deg)`, whiteSpace: "nowrap",
    }}>
      {tanim.metin}
    </span>
  );
}

/**
 * İÇERİK TALEBİ FORMU — müşteri ne istediğini buradan söyler.
 *
 * Talep doğrudan Operasyon'a düşmez: önce yöneticinin onay kutusuna gider, onaylanınca
 * "Talep Alındı" aşamasında bir iş kartına dönüşür. Böylece her istek bir işe dönüşmeden
 * önce süzülür.
 *
 * Alanlar bilinçli olarak az: fiyat sorulmaz (o ilişkinin konusu), kişi seçtirilmez
 * (yöneticinin kararı), aşama seçtirilmez (hep Talep Alındı'dan başlar).
 *
 * REFERANS alanı en değerlisi — "şuna benzer olsun" demek üç paragraf açıklamadan iyidir
 * ve revize turlarını azaltır.
 */
function TalepFormu({ talepler, gonderiliyor, onGonder }) {
  const [tur, setTur] = useState("Reels");
  const [aciklama, setAciklama] = useState("");
  const [neZaman, setNeZaman] = useState("");
  const [referans, setReferans] = useState("");
  const [acil, setAcil] = useState(false);
  const [dosyaBaglantisi, setDosyaBaglantisi] = useState("");

  const acikSayi = (talepler || []).filter((t) => t.durum === "bekliyor").length;
  const sinirDoldu = acikSayi >= 3;

  const gonder = () => {
    if (!aciklama.trim()) return;
    /* Bağlantı, dosya listesine tek kayıt olarak konur. Böylece onay akışı, brief'e
     * yazılması ve karta hamDosyaLink olarak geçmesi aynen çalışır — yükleme yerine
     * bağlantı kullanmak bu zinciri değiştirmiyor. */
    const dosyalar = dosyaBaglantisi.trim()
      ? [{ ad: "Müşterinin gönderdiği dosya", baglanti: dosyaBaglantisi.trim() }]
      : [];
    onGonder({ tur, aciklama, neZaman, referans, acil, dosyalar });
    setAciklama(""); setNeZaman(""); setReferans(""); setAcil(false); setDosyaBaglantisi("");
  };

  const DURUM = {
    bekliyor: { etiket: "Değerlendiriliyor", renk: MT.bekleyen, zemin: MT.bekleyenZemin },
    onaylandi: { etiket: "Kabul edildi — üretime alındı", renk: MT.onay, zemin: MT.onayZemin },
    reddedildi: { etiket: "Şimdilik alınmadı", renk: MT.soluk, zemin: MT.kagit },
  };

  return (
    <div>
      <div style={{ background: "#fff", border: `1px solid ${MT.cizgi}`, borderRadius: 14, padding: "18px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: MT.murekkep, marginBottom: 14 }}>
          Yeni içerik isteği
        </div>

        {sinirDoldu ? (
          <div style={{ background: MT.bekleyenZemin, borderRadius: 10, padding: "12px 15px", fontSize: 13, color: MT.murekkep, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
            Şu an 3 açık isteğin var. Bunlar sonuçlanınca yenisini gönderebilirsin.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6 }}>Ne istiyorsun?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {["Reels", "Görsel", "Tasarım"].map((x) => (
                <button
                  key={x}
                  onClick={() => setTur(x)}
                  style={{ padding: "12px 15px", borderRadius: 999, border: `1px solid ${tur === x ? MT.mor : MT.cizgi}`, background: tur === x ? MT.mor : "transparent", color: tur === x ? "#fff" : MT.murekkep, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                >
                  {x}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6 }}>Nasıl olsun?</div>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Örn. Yeni menü için 3 görsel — kahve odaklı, sıcak tonlar"
              rows={3}
              style={{ width: "100%", background: MT.kagit, border: `1px solid ${MT.cizgi}`, borderRadius: 10, padding: "12px 15px", fontSize: 13, fontFamily: "Inter, sans-serif", color: MT.murekkep, resize: "vertical", marginBottom: 14, boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ flex: "1 1 180px" }}>
                <span style={{ display: "block", fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6 }}>Ne zaman lazım? (opsiyonel)</span>
                <input
                  type="date"
                  value={neZaman}
                  onChange={(e) => setNeZaman(e.target.value)}
                  style={{ width: "100%", background: MT.kagit, border: `1px solid ${MT.cizgi}`, borderRadius: 10, padding: "12px 15px", fontSize: 13, fontFamily: "Inter, sans-serif", color: MT.murekkep, boxSizing: "border-box" }}
                />
              </span>
              <span style={{ flex: "2 1 260px" }}>
                <span style={{ display: "block", fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6 }}>Referans (opsiyonel)</span>
                <input
                  value={referans}
                  onChange={(e) => setReferans(e.target.value)}
                  placeholder="Beğendiğin bir örneğin bağlantısı"
                  style={{ width: "100%", background: MT.kagit, border: `1px solid ${MT.cizgi}`, borderRadius: 10, padding: "12px 15px", fontSize: 13, fontFamily: "Inter, sans-serif", color: MT.murekkep, boxSizing: "border-box" }}
                />
              </span>
            </div>

            {/* DOSYA BAĞLANTISI — dosya yüklemek yerine bağlantı isteniyor.
              * Gerçek yükleme Google Drive servis hesabı gerektiriyordu; servis hesaplarının
              * depolama kotası olmadığı için kişisel Google hesabında çalışmıyor. Bağlantı
              * yöntemi ücretsiz, kurulumsuz ve boyut sınırı yok. */}
            <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6 }}>
              Görsel / video bağlantısı (opsiyonel)
            </div>
            <input
              value={dosyaBaglantisi}
              onChange={(e) => setDosyaBaglantisi(e.target.value)}
              placeholder="WeTransfer, Drive ya da benzeri bir bağlantı yapıştır"
              style={{ width: "100%", background: MT.kagit, border: `1px solid ${MT.cizgi}`, borderRadius: 10, padding: "12px 15px", fontSize: 13, fontFamily: "Inter, sans-serif", color: MT.murekkep, marginBottom: 6, boxSizing: "border-box" }}
            />
            <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", marginBottom: 14, lineHeight: 1.6 }}>
              Dosyanı wetransfer.com'a yükleyip oluşan bağlantıyı buraya yapıştırabilirsin.
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={acil} onChange={(e) => setAcil(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ fontSize: 13, color: MT.murekkep, fontFamily: "Inter, sans-serif" }}>Acil</span>
            </label>

            <button
              onClick={gonder}
              disabled={gonderiliyor || !aciklama.trim()}
              style={{ padding: "12px 15px", borderRadius: 10, border: "none", background: aciklama.trim() ? MT.mor : MT.cizgi, color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: aciklama.trim() ? "pointer" : "default" }}
            >
              {gonderiliyor ? "Gönderiliyor…" : "İsteği Gönder"}
            </button>
          </>
        )}
      </div>

      {(talepler || []).length > 0 && (
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, color: MT.soluk, marginBottom: 10 }}>
            İSTEKLERİN · {talepler.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...talepler].reverse().map((t) => {
              const d = DURUM[t.durum] || DURUM.bekliyor;
              return (
                <div key={t.id} style={{ background: "#fff", border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: "12px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: MT.murekkep, fontFamily: "Inter, sans-serif" }}>
                      {t.tur}{t.acil ? " · acil" : ""}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.renk, background: d.zemin, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{d.etiket}</span>
                  </div>
                  <div style={{ fontSize: 13, color: MT.murekkep, fontFamily: "Inter, sans-serif", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t.aciklama}</div>
                  {(t.dosyalar || []).length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      {t.dosyalar.map((d) => (
                        <a key={d.baglanti} href={d.baglanti} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: MT.mor, fontFamily: "Inter, sans-serif" }}>{d.ad} ↗</a>
                      ))}
                    </div>
                  )}
                  {(t.neZaman || t.referans) && (
                    <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
                      {t.neZaman ? `İstenen tarih: ${t.neZaman}` : ""}{t.neZaman && t.referans ? " · " : ""}
                      {t.referans ? <a href={t.referans} target="_blank" rel="noreferrer" style={{ color: MT.mor }}>referans ↗</a> : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Müşteri Paneli.
 *
 * ortakModu=true olduğunda çözüm ortağı, atandığı markanın panelini MÜŞTERİNİN GÖRDÜĞÜ
 * hâliyle görür. Veri zaten sunucuda aynı fonksiyondan üretiliyor; burada değişen tek şey
 * YAPILABİLECEK İŞLEMLER:
 *   • Müşteriye ait onay/revize düğmeleri GİZLENİR — ortak müşteri adına karar veremez.
 *   • Yerine iş yürütme düğmeleri çıkar (aşama ilerletme), onOrtakIslem ile.
 * Çıkış düğmesi de gizlenir; ortak kendi panelinde, sekme içinde geziyor.
 */
export function MusteriPaneli({ musteriData, onCikis, onIslemSonrasi, ortakModu = false, onOrtakIslem }) {
  const [icerikler, setIcerikler] = useState(musteriData.icerikler || []);
  // Ortak kendi panelinin içindeki bir sekmede geziyor — buradan çıkış yapmamalı.
  const cikisGoster = !ortakModu && onCikis;
  // Sunucudan yeni veri geldiğinde listeyi tazele. useState başlangıç değeri SADECE ilk
  // render'da okunur — bu senkron olmadan, yönetici bir içerik ekleyip düzenlese ya da
  // onay sonrası veri yenilense bile müşterinin ekranı ilk açılıştaki hâlinde donuyordu.
  useEffect(() => { setIcerikler(musteriData.icerikler || []); }, [musteriData]);
  const [revizeAcikId, setRevizeAcikId] = useState(null);
  const [talepGonderiliyor, setTalepGonderiliyor] = useState(false);
  const [acikIcerikId, setAcikIcerikId] = useState(null); // açık olan içerik kartı
  // Ortak "Üretim Durumu" ile açılır: ilk sorusu "işler nerede?" — müşterininki ise
  // "onayımı bekleyen ne var?".
  const [sekme, setSekme] = useState(ortakModu ? "uretim" : "onay");
  /* TÜR SÜZGECİ — "sadece Reels'leri göster" gibi. Uzun listelerde müşteri aradığını
   * bulamıyordu. "hepsi" seçiliyken hiçbir şey gizlenmez. */
  const [turSuzgec, setTurSuzgec] = useState("hepsi");
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
    /* Ortak modunda otomatik çıkış YOK: ortak kendi oturumunda, bir sekmenin içinde
     * geziniyor. Buradaki zamanlayıcı çalışsaydı ortağı 20 dakikada uygulamadan atardı. */
    if (ortakModu) return undefined;
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

  /** Hazır İçerik (Operasyon kartı) üzerinde onay/revize. İçerik kayıtlarından ayrı bir yol,
   * çünkü burada değişen şey işin AŞAMASI — panelde tutulan bir kopya değil. İşlem sonrası
   * veri yenileniyor; kart Kontrol Bekliyor'dan çıktığı için listeden kendiliğinden düşüyor. */
  const isIstegi = (isId, musteriAction, revizeNotu) => {
    setGonderiliyor(isId);
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ musteriAction, isId, revizeNotu }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { if (onIslemSonrasi) onIslemSonrasi(); }
        else window.alert(res.error || "Bir sorun oluştu.");
      })
      .catch(() => window.alert("Bağlantı hatası — tekrar dene."))
      .finally(() => setGonderiliyor(null));
  };

  /* Talep gönderimi: sunucu kaydettikten sonra veri tazelenir ki liste ve 3'lük sınır
   * anında güncellensin. Tarayıcıda ayrıca liste tutulmaz — tek kaynak sunucu. */
  const talepGonder = (talep) => {
    setTalepGonderiliyor(true);
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ musteriAction: "talepOlustur", talep }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { if (onIslemSonrasi) onIslemSonrasi(); }
        else window.alert(res.error || "İstek gönderilemedi.");
      })
      .catch(() => window.alert("Bağlantı hatası — tekrar dene."))
      .finally(() => setTalepGonderiliyor(false));
  };

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

  /* Yöneticinin belirlediği sırayı müşteri de AYNEN görür. İki taraf farklı sıralarsa
   * "hangisi doğru?" sorusu doğar; sıra numarası kayıtta saklandığı için ikisi de aynı
   * veriyi okur. Sıra numarası olmayan eski kayıtlar sona düşer. */
  const sirala = (liste) => liste.slice().sort((a, b) => {
    const as = Number.isFinite(Number(a.sira)) ? Number(a.sira) : Infinity;
    const bs = Number.isFinite(Number(b.sira)) ? Number(b.sira) : Infinity;
    return as - bs;
  });
  const bekleyenler = sirala(icerikler.filter((i) => i.durum === "bekliyor"));

  /* ÜÇ DURUM, ÜÇ SEKME
   * Operasyon'dan yansıyan kartlar (hazirlar) ve elle gönderilen içerikler (icerikler)
   * aynı üç kovaya düşer: onayını bekleyen / revize istediğin / onayladığın.
   * Müşteri için ayrım "nereden geldiği" değil, "ne yaptığım" — bu yüzden ikisi
   * durumlarına göre birleştiriliyor. */
  const tumHazirlar = musteriData.hazirIcerikler || [];
  const hazirlarHam = tumHazirlar.filter((h) => h.durum === "bekliyor");

  /* Listede fiilen bulunan türler — süzgeç yalnızca bunları gösterir, olmayan bir tür için
   * boş düğme çıkmaz. Operasyon kartlarında tür "kategori", elle eklenenlerde "tur" alanında
   * durduğu için ikisi birlikte toplanıyor. */
  const mevcutTurler = [...new Set([
    ...hazirlarHam.map((h) => h.kategori || "Video"),
    ...bekleyenler.map((i) => i.tur),
  ].filter(Boolean))];

  const turUyar = (anahtar) => turSuzgec === "hepsi" || turEtiketi(anahtar).ad === turEtiketi(turSuzgec).ad;
  const hazirlar = hazirlarHam.filter((h) => turUyar(h.kategori || "Video"));
  const hazirRevize = tumHazirlar.filter((h) => h.durum === "revize");
  const hazirOnayli = tumHazirlar.filter((h) => h.durum === "onaylandi");

  const bekleyenlerSuzulu = bekleyenler.filter((i) => turUyar(i.tur));
  const revizeliler = sirala(icerikler.filter((i) => i.durum === "revize"));
  const onaylilar = sirala(icerikler.filter((i) => i.durum !== "bekliyor" && i.durum !== "revize"));

  const tumSekmeler = [
    // Rozet SÜZGEÇTEN ETKİLENMEZ: süzgeç bir görünüm tercihi, sekmedeki sayı ise gerçek
    // bekleyen adedi. Süzgeçle birlikte düşseydi "3 içerik vardı, 1 oldu" gibi görünürdü.
    { key: "onay", label: "Onay Bekleyenler", rozet: bekleyenler.length + hazirlarHam.length },
    { key: "revize", label: "Revize İstediklerin", rozet: revizeliler.length + hazirRevize.length },
    { key: "onayli", label: ortakModu ? "Onaylananlar (paylaşıma hazır)" : "Onayladıkların", rozet: onaylilar.length + hazirOnayli.length },
    { key: "takvim", label: "Paylaşım Takvimi", rozet: 0 },
    { key: "reklam", label: "Reklamlar", rozet: 0 },
    { key: "uretim", label: "Üretim Durumu", rozet: 0 },
    { key: "talep", label: "İçerik İste", rozet: 0 },
  ];

  /* ORTAK MODU — yalnızca İLERLEYİŞ ve ONAYLANANLAR.
   *
   * Ortağın işi üretimi takip edip onaylanan içeriği paylaşmak; müşterinin karar sürecini
   * (neyi onaylamadı, neye revize istedi) görmesi gerekmiyor. Reklam ve paylaşım takvimi de
   * ajans-müşteri ilişkisine ait, ortağın işi değil.
   *
   * Not: "Onaylananlar" sekmesinde teslim edilmiş işler de var — paylaşılacak dosya orada. */
  const ORTAK_SEKMELERI = ["uretim", "onayli"];
  const sekmeler = ortakModu
    ? ORTAK_SEKMELERI.map((k) => tumSekmeler.find((x) => x.key === k)).filter(Boolean)
    : tumSekmeler;

  const bugunYazi = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ background: MT.kagit, minHeight: "100vh", color: MT.murekkep }}>
      <style>{FONTS}</style>

      {/* ÜST BANT — ortak logo kilidi. Panelin müşteriye ait bir teslimat olduğunu ilk
        * bakışta anlatan yer burası; bu yüzden beyaz zemin üzerinde, ince mor bir çizgiyle
        * ayrılmış kendi bandını hak ediyor. */}
      <div style={{ background: MT.kart, borderBottom: `1px solid ${MT.cizgi}`, boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}>
        <div style={{ height: 3, background: MT.mor }} />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <LogoKilidi
            ajansLogo={musteriData.ajansLogo}
            markaLogo={musteriData.markaLogo}
            marka={musteriData.marka}
            firmaAdi={musteriData.firmaAdi}
          />
          {cikisGoster && <button
            onClick={() => { if (window.confirm("Çıkış yapılsın mı? Tekrar girmek için kullanıcı adı ve şifren gerekecek.")) onCikis(); }}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "12px 15px", borderRadius: 8,
              background: "transparent", border: `1px solid ${MT.cizgi}`, color: MT.soluk,
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            <LogOut size={14} /> Çıkış
          </button>}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 70px" }}>
        {/* BAŞLIK — mono etiket + marka adı. "Onay Paneli" ifadesi ne yapılacağını söyler. */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ ...ETIKET, marginBottom: 6 }}>Onay Paneli · {bugunYazi}</div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.15 }}>
            {musteriData.marka}
          </h1>
          <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 13, color: MT.soluk, lineHeight: 1.6, maxWidth: 560 }}>
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
                    borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>{sk.rozet}</span>
                )}
              </button>
            );
          })}
        </div>

        {sekme === "onay" && <>
        {/* Tür süzgeci: yalnızca birden fazla tür varsa gösterilir — tek türlü bir listede
          * süzgeç gereksiz gürültü olurdu. */}
        {mevcutTurler.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["hepsi", ...mevcutTurler].map((tr) => {
              const aktif = turSuzgec === tr;
              const e = tr === "hepsi" ? { ad: "Hepsi", renk: MT.murekkep, zemin: MT.kart } : turEtiketi(tr);
              return (
                <button
                  key={tr}
                  onClick={() => setTurSuzgec(tr)}
                  style={{
                    padding: "12px 15px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${aktif ? e.renk : MT.cizgi}`,
                    background: aktif ? e.zemin : MT.kart, color: aktif ? e.renk : MT.soluk,
                    fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: aktif ? 700 : 500,
                  }}
                >
                  {e.ad}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ ...ETIKET, marginBottom: 12 }}>
          Onayınızı bekleyenler{(bekleyenlerSuzulu.length + hazirlar.length) > 0 ? ` · ${bekleyenlerSuzulu.length + hazirlar.length} içerik` : ""}
        </div>

        {/* HAZIR İÇERİKLER — Operasyon'da "Kontrol Bekliyor" aşamasındaki işlerin canlı
          * aynası. Onaylandığında ya da revize istendiğinde iş o aşamadan çıkar ve buradan
          * kendiliğinden kaybolur. Elle gönderilen içeriklerin ÜSTÜNDE duruyor çünkü bunlar
          * üretimi bitmiş, teslime en yakın işler. */}
        {hazirlar.length > 0 && (
          <div style={{ marginBottom: bekleyenlerSuzulu.length > 0 ? 22 : 30 }}>
            <HazirIcerikler
              liste={hazirlar}
              gonderiliyor={gonderiliyor}
              onIslem={(isId, islem, not) => isIstegi(isId, islem, not)}
              ortakModu={ortakModu}
              onOrtakIslem={onOrtakIslem}
              basliksiz
            />
          </div>
        )}

        {/* "Bekleyen bir şey yok" mesajı yalnızca İKİSİ DE boşken çıkar. Aksi halde hazır
          * içerik dururken altında "bekleyen yok" yazar ve müşteri hangisine inanacağını
          * bilemezdi. */}
        {bekleyenlerSuzulu.length === 0 && hazirlar.length === 0 ? (
          <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: "18px 22px", textAlign: "center", marginBottom: 30 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Şu an bekleyen bir şey yok</div>
            <div style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>Yeni bir içerik hazırlandığında burada görünecek ve e-posta alacaksınız.</div>
          </div>
        ) : bekleyenlerSuzulu.length === 0 ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
            {bekleyenlerSuzulu.map((icerik, sira) => {
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
                    style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "none", border: "none", padding: "12px 15px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  >
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600,
                      color: MT.soluk, background: MT.kagit, border: `1px solid ${MT.cizgi}`,
                      borderRadius: 6, padding: "6px 10px", flexShrink: 0, minWidth: 30, textAlign: "center",
                    }}>
                      {String(hazirlar.length + sira + 1).padStart(2, "0")}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>
                        {basligiTemizle(icerik.aciklama) || (icerik.tur === "cekim" ? "Çekim Planı" : icerik.tur)}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 13, color: MT.soluk, fontFamily: "Inter" }}>
                        <TurRozet anahtar={icerik.tur} />
                        <span>{icerik.tarih}</span>
                        {icerik.tur === "cekim" && icerik.planlananTarih ? <span>Çekim: {tarihGoster(icerik.planlananTarih)}</span> : null}
                      </span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <Damga durum={icerik.durum} />
                      <span style={{ color: MT.soluk, fontSize: 13, fontFamily: "Inter" }}>{kartAcik ? "▲" : "▼"}</span>
                    </span>
                  </button>

                  {kartAcik && <div style={{ marginTop: 14 }}>

                  {/* ÇEKİM PLANI: referans video + konuşma metni + çekim notu */}
                  {icerik.tur === "cekim" && (
                    <div style={{ marginBottom: 12 }}>
                      {icerik.konusmali && (
                        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: MT.mor, background: MT.morSoluk, padding: "6px 10px", borderRadius: 999, fontFamily: "Inter", marginBottom: 10 }}>
                          {icerik.konusmali === "konusmali" ? "KONUŞMALI" : icerik.konusmali === "seslendirme" ? "DIŞ SES" : "KONUŞMASIZ"}
                        </div>
                      )}

                      {cekimEmbed && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>REFERANS VİDEO</div>
                          <DriveVideo link={icerik.referansLink} yon={icerik.videoYonu} baslik="Referans video" icerikId={icerik.id} alan="referansLink" />
                        </div>
                      )}
                      {!cekimEmbed && icerik.referansLink && (
                        <a href={icerik.referansLink} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 10, color: MT.mor, fontSize: 13, fontFamily: "Inter" }}>
                          ▶ Referans videoyu izle ↗
                        </a>
                      )}

                      {icerik.konusmaMetni && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>
                            {icerik.konusmali === "seslendirme" ? "DIŞ SES METNİ" : "KONUŞMA METNİ"}
                          </div>
                          <div style={{ background: MT.kagit, borderRadius: 10, padding: "12px 15px", fontSize: 13, color: MT.murekkep, fontFamily: "Inter", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            {icerik.konusmaMetni}
                          </div>
                        </div>
                      )}

                      {icerik.cekimNotu && (
                        <div>
                          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>ÇEKİM NOTU</div>
                          <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{icerik.cekimNotu}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Eski kayıtlar base64 görsel taşıyor, yeniler Drive bağlantısı — ikisi de desteklenir. */}
                  {icerik.gorselUrl && (
                    <img src={icerik.gorselUrl} alt={icerik.aciklama || ""} style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }} />
                  )}
                  {!icerik.gorselUrl && icerik.tur === "gorsel" && icerik.driveLinki && (
                    <div style={{ marginBottom: 12 }}><DriveGorsel link={icerik.driveLinki} yukseklik={460} icerikId={icerik.id} /></div>
                  )}
                  {!icerik.gorselUrl && icerik.tur !== "gorsel" && embed && (
                    <div style={{ marginBottom: 12 }}><DriveVideo link={icerik.driveLinki} yon={icerik.videoYonu} baslik={icerik.aciklama || "içerik"} icerikId={icerik.id} /></div>
                  )}
                  {!icerik.gorselUrl && icerik.tur !== "gorsel" && !embed && icerik.driveLinki && (
                    <a href={icerik.driveLinki} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 12, color: MT.mor, fontSize: 13, fontFamily: "Inter" }}>İçeriği Görüntüle ↗</a>
                  )}

                  {ortakModu ? (
                    <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter" }}>
                      {icerik.durum === "bekliyor" ? "Müşterinin onayı bekleniyor." : icerik.durum === "revize" ? "Müşteri revize istedi." : "Müşteri onayladı."}
                    </div>
                  ) : revizeAcikId === icerik.id ? (
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
                          padding: "12px 15px", borderRadius: 9, border: "none", cursor: "pointer",
                          background: MT.onay, color: "#fff",
                          fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600,
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
                          padding: "12px 15px", borderRadius: 9, cursor: "pointer",
                          background: MT.kart, border: `1px solid ${MT.cizgiKoyu}`, color: MT.murekkep,
                          fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 500,
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

                </>}

        {/* REVİZE İSTEDİKLERİN */}
        {sekme === "revize" && (
          <>
            {hazirRevize.length > 0 && (
              <div style={{ marginBottom: revizeliler.length > 0 ? 22 : 0 }}>
                <HazirIcerikler liste={hazirRevize} gonderiliyor={gonderiliyor} onIslem={isIstegi} saltOkunur />
              </div>
            )}
            <DurumListesi
              liste={revizeliler}
              hazirListe={hazirRevize}
              acikId={acikIcerikId}
              setAcikId={setAcikIcerikId}
              baslik="Revize istediklerin"
              bosMetin="Henüz revize istediğin bir içerik yok"
            />
          </>
        )}

        {/* ONAYLADIKLARIN */}
        {sekme === "onayli" && (
          <>
            {hazirOnayli.length > 0 && (
              <div style={{ marginBottom: onaylilar.length > 0 ? 22 : 0 }}>
                <HazirIcerikler liste={hazirOnayli} gonderiliyor={gonderiliyor} onIslem={isIstegi} saltOkunur />
              </div>
            )}
            <DurumListesi
              liste={onaylilar}
              hazirListe={hazirOnayli}
              acikId={acikIcerikId}
              setAcikId={setAcikIcerikId}
              baslik="Onayladıkların"
              bosMetin="Henüz onayladığın bir içerik yok"
            />
          </>
        )}

        {/* PAYLAŞIM TAKVİMİ — Instagram önizlemeleriyle */}
        {sekme === "takvim" && <MusteriPaylasimPlani plan={musteriData.paylasimPlani || []} marka={musteriData.marka} />}

        {/* REKLAMLAR — markanın aktif/biten kampanyaları. Bütçe bilgisi bilerek gönderilmez. */}
        {sekme === "reklam" && <MusteriReklamlar reklamlar={musteriData.reklamlar || []} />}

        {/* ÜRETİM — hangi iş hangi aşamada. */}
        {sekme === "uretim" && <MusteriOperasyon isler={musteriData.operasyonIsleri || []} />}
        {sekme === "talep" && (
          <TalepFormu talepler={musteriData.talepler || []} gonderiliyor={talepGonderiliyor} onGonder={talepGonder} />
        )}

        {/* Alt çıkış — uzun listelerde en yukarı dönmek zorunda kalmamak için. */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${MT.cizgi}`, textAlign: "center" }}>
          {cikisGoster && <button
            onClick={() => { if (window.confirm("Çıkış yapılsın mı? Tekrar girmek için kullanıcı adı ve şifren gerekecek.")) onCikis(); }}
            style={{ ...cancelBtnStyle, fontSize: 13, padding: "6px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <LogOut size={14} /> Çıkış Yap
          </button>}
        </div>
      </div>
    </div>
  );
}

/** Müşteri panelinde haftalık paylaşım planı. Gelecek haftalar önce gösterilir; geçmiş
 * haftalar "yapıldı" bilgisiyle altta kalır. */
/**
 * DURUM LİSTESİ — "Revize İstediklerin" ve "Onayladıkların" sekmelerinin gövdesi.
 * Tek bir bileşen; iki sekme aynı kodu kullandığı için görünüşleri hiçbir zaman ayrışamaz.
 * Her satır küçük bir önizleme taşır ve tıklanınca içeriğin tamamı açılır — "hangi görsele
 * ne demiştim?" sorusunun cevabı burada.
 */
function DurumListesi({ liste, hazirListe, acikId, setAcikId, baslik, bosMetin }) {
  const toplam = (liste || []).length + (hazirListe || []).length;
  if (toplam === 0) {
    return (
      <div style={{ background: MT.kart, border: `1px solid ${MT.cizgi}`, borderRadius: 12, padding: "18px 22px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{bosMetin}</div>
      </div>
    );
  }
  return (
    <>
      <div style={{ ...ETIKET, marginBottom: 12 }}>{baslik} · {toplam} içerik</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liste.map((icerik) => {
                const stil = DURUM_STIL[icerik.durum] || DURUM_STIL.bekliyor;
                const acik = acikId === icerik.id;
                const gecmisEmbed = driveEmbedUrl(icerik.driveLinki);
                return (
                  <div key={icerik.id} style={{ background: MT.kart, border: `1px solid ${acik ? MT.cizgiKoyu : MT.cizgi}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Geçmişteki kayıtlar da AÇILABİLİR ve küçük bir önizleme taşır.
                      * Eskiden yalnızca başlık, tarih ve revize notu görünüyordu; "hangi görsele
                      * ne demiştim?" sorusunun cevabı kayboluyordu. Küçük kare hızlı tanımayı,
                      * açılan görünüm tam incelemeyi sağlar. */}
                    <button
                      onClick={() => setAcikId(acik ? null : icerik.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "12px 15px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <span style={{ width: 46, height: 46, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: MT.kagit, border: `1px solid ${MT.cizgi}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {icerik.tur === "gorsel" && icerik.driveLinki
                          ? <DriveKucukGorsel link={icerik.driveLinki} icerikId={icerik.id} />
                          : icerik.gorselUrl && String(icerik.gorselUrl).startsWith("data:")
                            ? <img src={icerik.gorselUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 15 }}>{icerik.tur === "cekim" ? "🎬" : icerik.tur === "video" ? "▶" : "🖼"}</span>}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13, color: MT.murekkep, fontWeight: 600, fontFamily: "Inter" }}>{basligiTemizle(icerik.aciklama) || icerik.tur}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, color: MT.soluk, fontFamily: "Inter" }}>
                          <TurRozet anahtar={icerik.tur} />
                          <span>{icerik.tarih}</span>
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: stil.color, background: stil.bg, padding: "6px 10px", borderRadius: 999, fontFamily: "Inter" }}>{stil.label}</span>
                        <span style={{ color: MT.soluk, fontSize: 11 }}>{acik ? "▲" : "▼"}</span>
                      </span>
                    </button>

                    {icerik.revizeNotu && (
                      <div style={{ padding: "0 16px 12px", fontSize: 13, color: MT.revize, fontFamily: "Inter", fontStyle: "italic", lineHeight: 1.6 }}>
                        "{icerik.revizeNotu}"
                      </div>
                    )}

                    {acik && (
                      <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${MT.cizgi}`, paddingTop: 14 }}>
                        {icerik.gorselUrl && String(icerik.gorselUrl).startsWith("data:") && (
                          <img src={icerik.gorselUrl} alt="" style={{ width: "100%", borderRadius: 9, display: "block", marginBottom: 10 }} />
                        )}
                        {!icerik.gorselUrl && icerik.tur === "gorsel" && icerik.driveLinki && (
                          <div style={{ marginBottom: 10 }}><DriveGorsel link={icerik.driveLinki} yukseklik={420} icerikId={icerik.id} /></div>
                        )}
                        {icerik.tur === "video" && icerik.driveLinki && (
                          <div style={{ marginBottom: 10 }}><DriveVideo link={icerik.driveLinki} yon={icerik.videoYonu} icerikId={icerik.id} /></div>
                        )}
                        {icerik.tur === "cekim" && (
                          <>
                            {icerik.referansLink && <div style={{ marginBottom: 10 }}><DriveVideo link={icerik.referansLink} yon={icerik.videoYonu} baslik="Referans video" icerikId={icerik.id} alan="referansLink" /></div>}
                            {icerik.konusmaMetni && (
                              <div style={{ background: MT.kagit, borderRadius: 9, padding: "12px 15px", fontSize: 13, color: MT.murekkep, fontFamily: "Inter", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {icerik.konusmaMetni}
                              </div>
                            )}
                          </>
                        )}
                        {!icerik.driveLinki && !icerik.gorselUrl && !icerik.referansLink && !icerik.konusmaMetni && (
                          <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter" }}>Bu kayda ait bir görsel ya da video bulunmuyor.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
      </div>
    </>
  );
}

/**
 * HAZIR İÇERİKLER — Operasyon'da "Kontrol Bekliyor" aşamasındaki işlerin canlı listesi.
 *
 * Bunlar müşteri paneline kopyalanmaz; doğrudan yansıtılır. Müşteri onayladığında iş
 * "Onaylandı"ya, revize istediğinde "Revize İstendi"ye geçer ve her iki durumda da Kontrol
 * Bekliyor'dan çıktığı için bu listeden kendiliğinden düşer.
 *
 * Dosya linki olmayan kartlar da gösterilir (kullanıcının tercihi): ekip bir işi kontrole
 * göndermişse müşteri onu görmeli, dosya henüz eklenmemişse bu da açıkça yazılır.
 */
function HazirIcerikler({ liste, gonderiliyor, onIslem, basliksiz = false, saltOkunur = false, baslangic = 0, ortakModu = false, onOrtakIslem }) {
  const [acikId, setAcikId] = useState(null);
  const [revizeAcik, setRevizeAcik] = useState(null);
  const [not, setNot] = useState("");

  // Onay Bekleyenler içinde gösterildiğinde boş durum ve başlık çizilmez — o sekmenin
  // kendi boş durumu ve başlığı zaten var.
  if (!liste || liste.length === 0) return null;

  return (
    <>
      {!basliksiz && <div style={{ ...ETIKET, marginBottom: 12 }}>Hazır içerikler · {liste.length} adet</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liste.map((h, sira) => {
          const acik = acikId === h.isId;
          // Yalnızca Video kategorisinin çıktısı videodur; Fotoğraf ve Tasarım görseldir.
          const video = (h.kategori || "Video") === "Video";
          return (
            <div key={h.isId} style={{ background: MT.kart, border: `1px solid ${acik ? MT.cizgiKoyu : MT.cizgi}`, borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => setAcikId(acik ? null : h.isId)}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "none", border: "none", padding: "12px 15px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
              >
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: MT.soluk,
                  background: MT.kagit, border: `1px solid ${MT.cizgi}`, borderRadius: 6, padding: "6px 10px",
                  flexShrink: 0, minWidth: 30, textAlign: "center",
                }}>
                  {String(baslangic + sira + 1).padStart(2, "0")}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>
                    {h.baslik}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 13, color: MT.soluk, fontFamily: "Inter" }}>
                    <TurRozet anahtar={h.kategori} />
                    {h.uretilenAdet ? <span>{h.uretilenAdet} parça</span> : null}
                    {h.teslimTarihi ? <span>Teslim: {tarihGoster(h.teslimTarihi)}</span> : null}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <Damga durum="bekliyor" />
                  <span style={{ color: MT.soluk, fontSize: 13 }}>{acik ? "▲" : "▼"}</span>
                </span>
              </button>

              {acik && (
                <div style={{ padding: "0 16px 16px" }}>
                  {h.dosyaLinki ? (
                    <div style={{ marginBottom: 14 }}>
                      {video
                        ? <DriveVideo link={h.dosyaLinki} yon={h.videoYonu} baslik={h.baslik} isId={h.id} />
                        : <DriveGorsel link={h.dosyaLinki} yukseklik={460} isId={h.id} />}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14, background: MT.kagit, border: `1px dashed ${MT.cizgiKoyu}`, borderRadius: 9, padding: "12px 15px", fontSize: 13, color: MT.soluk, fontFamily: "Inter", lineHeight: 1.6 }}>
                      Bu içeriğin dosyası henüz eklenmedi. Ekip dosyayı yükleyince burada görünecek.
                    </div>
                  )}

                  {/* ORTAK MODU: müşteri adına onay/revize verilemez. Ortağın işi onaylanan
                    * içeriği PAYLAŞMAK, o yüzden dosyaya doğrudan bağlantı verilir —
                    * önizleme yeterli değil, indirip yüklemesi gerekiyor. */}
                  {ortakModu ? (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: h.durum === "onaylandi" ? MT.onay : MT.soluk, fontFamily: "Inter", fontWeight: h.durum === "onaylandi" ? 600 : 400 }}>
                        {h.durum === "onaylandi" ? "✓ Onaylandı — paylaşılabilir" : h.durum === "revize" ? "Müşteri revize istedi." : "Müşterinin onayı bekleniyor."}
                      </span>
                      {h.dosyaLinki && (
                        <a
                          href={h.dosyaLinki}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: "6px 15px", borderRadius: 9, background: MT.onay, color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          Dosyayı aç ↗
                        </a>
                      )}
                    </div>
                  ) : saltOkunur ? null : revizeAcik === h.isId ? (
                    <div>
                      <textarea
                        autoFocus
                        rows={3}
                        value={not}
                        onChange={(e) => setNot(e.target.value)}
                        placeholder="Neyin değişmesini istiyorsunuz?"
                        style={{ width: "100%", background: MT.kart, border: `1px solid ${MT.cizgiKoyu}`, borderRadius: 9, padding: "12px 15px", color: MT.murekkep, fontSize: 15, fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical", marginBottom: 10 }}
                      />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          style={{ flex: "1 1 150px", justifyContent: "center", display: "flex", padding: "12px 15px", borderRadius: 9, border: "none", cursor: "pointer", background: MT.revize, color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600, opacity: not.trim() ? 1 : 0.5 }}
                          disabled={!not.trim() || gonderiliyor === h.isId}
                          onClick={() => { onIslem(h.isId, "revizeIste", not.trim()); setRevizeAcik(null); setNot(""); }}
                        >
                          Gönder
                        </button>
                        <button
                          style={{ flex: "1 1 120px", justifyContent: "center", display: "flex", padding: "12px 15px", borderRadius: 9, cursor: "pointer", background: MT.kart, border: `1px solid ${MT.cizgiKoyu}`, color: MT.murekkep, fontFamily: "Inter, sans-serif", fontSize: 15 }}
                          onClick={() => { setRevizeAcik(null); setNot(""); }}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        style={{ flex: "1 1 160px", justifyContent: "center", display: "flex", alignItems: "center", padding: "12px 15px", borderRadius: 9, border: "none", cursor: "pointer", background: MT.onay, color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600, opacity: gonderiliyor === h.isId ? 0.6 : 1 }}
                        disabled={gonderiliyor === h.isId}
                        onClick={() => onIslem(h.isId, "onayla")}
                      >
                        {gonderiliyor === h.isId ? "Gönderiliyor…" : "Onayla"}
                      </button>
                      <button
                        style={{ flex: "1 1 160px", justifyContent: "center", display: "flex", alignItems: "center", padding: "12px 15px", borderRadius: 9, cursor: "pointer", background: MT.kart, border: `1px solid ${MT.cizgiKoyu}`, color: MT.murekkep, fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 500 }}
                        onClick={() => { setRevizeAcik(h.isId); setNot(""); }}
                      >
                        Değişiklik iste
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

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
            style={{ padding: "12px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter", fontSize: 13, fontWeight: 600,
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
          <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter", fontWeight: 700, marginBottom: 12, letterSpacing: 0.3 }}>
            {haftaBasligi(hk).toLocaleUpperCase("tr")}
          </div>
          <Izgara liste={gruplar[hk]} />
        </div>
      ))}
      {gecmis.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setGecmisAcik((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: MT.soluk, fontFamily: "Inter", fontWeight: 600 }}>
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
            <div key={r.id} style={{ background: MT.kagit, borderRadius: 10, padding: "12px 15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: MT.murekkep, fontFamily: "Inter", fontWeight: 600 }}>{r.reklamAdi}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: "6px 10px", borderRadius: 999, fontFamily: "Inter" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", marginTop: 3 }}>
                {tarihGoster(r.baslangicTarihi)} — {tarihGoster(r.bitisTarihi)}
              </div>
              {r.not && <div style={{ fontSize: 13, color: MT.soluk, fontFamily: "Inter", marginTop: 5, lineHeight: 1.6 }}>{r.not}</div>}
              {istatistikVarMi(r) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {[
                    { l: "Erişim", v: r.erisim },
                    { l: "Gösterim", v: r.gosterim },
                    { l: "Tıklama", v: r.tiklama },
                    { l: "Etkileşim", v: r.etkilesim },
                    { l: "Sonuç", v: r.sonuc },
                  ].filter((x) => Number(x.v) > 0).map((x) => (
                    <div key={x.l} style={{ background: MT.kart, borderRadius: 9, padding: "6px 10px", minWidth: 78 }}>
                      <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, letterSpacing: 0.3 }}>{x.l.toLocaleUpperCase("tr")}</div>
                      <div style={{ fontSize: 15, color: MT.murekkep, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{Number(x.v).toLocaleString("tr-TR")}</div>
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
    <div style={{ background: MT.kagit, borderRadius: 10, padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, color: MT.murekkep, fontFamily: "Inter", fontWeight: 600 }}>
          {j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}{j.uretilenAdet ? ` · ${j.uretilenAdet} parça` : ""}
        </div>
        <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", marginTop: 2 }}>
          {j.asama === "Teslim Edildi" && j.teslimEdilmeTarihi
            ? `Teslim: ${tarihGoster(j.teslimEdilmeTarihi)}`
            : j.teslimTarihi ? `Planlanan teslim: ${tarihGoster(j.teslimTarihi)}` : ""}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "Inter", padding: "6px 10px", borderRadius: 999,
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
          <div style={{ fontSize: 11, color: MT.soluk, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>Tamamlananlar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gosterilen.map((j) => <Satir key={j.id} j={j} />)}
          </div>
          {bitenler.length > 5 && (
            <button onClick={() => setHepsiAcik((v) => !v)} style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontSize: 13, color: MT.soluk, fontFamily: "Inter", fontWeight: 600 }}>
              {hepsiAcik ? "Daha az göster" : `+ ${bitenler.length - 5} tane daha göster`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

