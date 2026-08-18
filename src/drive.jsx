/**
 * GOOGLE DRIVE MEDYA
 *
 * Drive bağlantılarını görsel ve video olarak gösteren parçalar.
 *
 * Ayrı bir dosyada olmasının sebebi: Google'ın adres davranışı zaman içinde değişiyor
 * (eski uc?export=view adresi artık çoğu dosyada çalışmıyor). Hangi adreslerin sırayla
 * denendiği ve hata durumunda kullanıcıya ne yazıldığı tek yerde toplu durmalı.
 */
import React, { useState, useEffect } from "react";
import { T, authHeaders } from "./tema.jsx";

/**
 * ÖNİZLEME SUNUCUDAN — TEK KAYNAK.
 *
 * Dosyalar Drive'da bilerek KISITLI (daha önce "bağlantısı olan herkes" ayarındaydı ve
 * 17 müşterinin içeriği açıktaydı). Kısıtlı bir dosyanın görselini tarayıcı doğrudan
 * drive.google.com'dan çekemiyor: istek 403 dönüyor ve ekranda "paylaşım ayarı kapalı"
 * yazısı kalıyor. Panoda, kart detayında ve MÜŞTERİ PANELİNDE bu yaşandı.
 *
 * Müşteri paneli en kritiği — müşteri göremediği bir içeriği onaylayamaz.
 *
 * Görsel sunucuda, uygulamanın kendi Drive yetkisiyle alınıp veri olarak geliyor. Dosya
 * Drive'da kısıtlı kalmaya devam ediyor; gizlilik geri alınmıyor.
 *
 * Bu kanca hem burada hem Operasyon ekranında kullanılıyor. İki kopya yazılsaydı biri
 * düzeltilip diğeri unutulurdu.
 */
const onizlemeBellegi = new Map();

/**
 * GÖMÜLÜ DRIVE OYNATICISI BU TARAYICIDA ENGELLİ Mİ?
 *
 * Drive'ın gömülü oynatıcısı, çerçevenin içinden Google'ın kendi çerezlerine erişip
 * kullanıcıyı tanımak zorunda. WebKit tabanlı tarayıcılar "siteler arası izlemeyi engelle"
 * ayarını VARSAYILAN olarak açık tutuyor ve o çerezleri kesiyor; Google da içerik yerine
 * siyah bir kutu ile kendi logosunu gösteriyor.
 *
 * ADI "safariMi" DEĞİL, çünkü ölçtüğü şey tarayıcının markası değil DAVRANIŞI. iOS'ta
 * Chrome ve Firefox da WebKit kullanmak zorunda ve aynı çerez politikasını devralıyor —
 * yani orada da engelli. "Safari mi" diye sorsaydık iPhone'daki Chrome kullanıcısına
 * "çalışır" der, o da siyah kutuyla karşılaşırdı.
 *
 * Bunu düzeltmenin yolu yok — dosyayı herkese açmak dışında, ki o da kapatılan gizlilik
 * açığını geri getirirdi. Yapabileceğimiz tek dürüst şey: düğmeyi gizlememek ama NE
 * OLACAĞINI önceden söylemek, kullanıcı aynı ölü yolu tekrar tekrar denemesin.
 */
export function gomuluEngelliMi() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iosTarayici = /iPhone|iPad|iPod/.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua);
  const masaustuSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  return iosTarayici || masaustuSafari;
}

/** Gömülü oynatıcı siyah kaldığında ne yapılacağı — tek yerde, iki ekranda kullanılıyor. */
export const GOMULU_ACIKLAMA = gomuluEngelliMi()
  ? "Bu tarayıcı Google'ın çerezlerini engellediği için gömülü oynatıcı siyah kalır. İzlemek için Drive'da Aç kullan — ya da Safari → Ayarlar → Gizlilik → “Siteler arası izlemeyi engelle” seçeneğini kapat. (iPhone'da Chrome da aynı kısıtlamaya tabi.)"
  : "Gömülü oynatıcı siyah kalıyorsa tarayıcın Google'ın çerezlerini engelliyordur. O zaman Drive'da Aç ile izle.";

export function useSunucuOnizleme({ isId, icerikId, boyut = 800 }) {
  const anahtar = isId !== undefined && isId !== null ? `is:${isId}:${boyut}`
                : icerikId !== undefined && icerikId !== null ? `icerik:${icerikId}:${boyut}` : null;
  const [veri, setVeri] = useState(() => (anahtar ? onizlemeBellegi.get(anahtar) || null : null));
  const [durum, setDurum] = useState(() => {
    if (!anahtar) return "yok";
    return onizlemeBellegi.get(anahtar) ? "hazir" : "yukleniyor";
  });

  useEffect(() => {
    if (!anahtar) { setDurum("yok"); setVeri(null); return undefined; }
    const bellekte = onizlemeBellegi.get(anahtar);
    if (bellekte) { setVeri(bellekte); setDurum("hazir"); return undefined; }
    let iptal = false;
    setDurum("yukleniyor");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ onizlemeAction: "gorsel", isId, icerikId, boyut }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (iptal) return;
        if (r.ok && r.veri) { onizlemeBellegi.set(anahtar, r.veri); setVeri(r.veri); setDurum("hazir"); }
        else setDurum("olmadi");
      })
      .catch(() => { if (!iptal) setDurum("olmadi"); });
    return () => { iptal = true; };
  }, [anahtar, isId, icerikId, boyut]);

  return { durum, veri };
}

export function driveKlasorMu(link) {
  return !!link && /\/drive\/(u\/\d+\/)?folders\//.test(link);
}

/** Drive bağlantısından dosya kimliğini çıkarır. Klasörlerde null döner. */
export function driveDosyaId(link) {
  if (!link) return null;
  if (driveKlasorMu(link)) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
    || link.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
    || link.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}

/**
 * Bir Drive görselinin gösterilebileceği ADAY adresler, en güvenilirden en aza.
 * Google eski `uc?export=view` adresini artık çoğu dosya için doğrudan görsel olarak
 * servis etmiyor (yönlendirme/onay sayfası dönüyor), bu yüzden önce `thumbnail`
 * deneniyor. Hangisinin çalışacağı dosyaya göre değişebildiği için sırayla denenir.
 */
export function driveGorselAdaylari(link) {
  const id = driveDosyaId(link);
  if (!id) return [];
  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${id}=w1600`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

/**
 * Drive görselini gösterir. Aday adresleri sırayla dener; hiçbiri açılmazsa SESSİZCE
 * KAYBOLMAK YERİNE nedenini yazar (klasör mü, tanınmayan bağlantı mı, paylaşım kapalı mı).
 */
export function DriveGorsel({ link, yukseklik = 420, kapak = false, radius = 10, isId, icerikId, boyut = 1200 }) {
  const sunucu = useSunucuOnizleme({ isId, icerikId, boyut });
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  const kutu = {
    width: "100%", borderRadius: radius, background: T.surfaceRaised,
    border: `1px dashed ${T.border}`, padding: "12px 15px",
    fontSize: 13, color: T.textFaint, lineHeight: 1.6, fontFamily: "Inter",
  };

  const gorselStili = {
    width: "100%",
    height: kapak ? yukseklik : undefined,
    maxHeight: kapak ? undefined : yukseklik,
    objectFit: kapak ? "cover" : "contain",
    borderRadius: radius, background: T.surfaceRaised, display: "block",
  };
  if (sunucu.durum === "hazir" && sunucu.veri) return <img src={sunucu.veri} alt="Görsel" style={gorselStili} />;
  if (sunucu.durum === "yukleniyor") {
    return (
      <div style={{ ...kutu, textAlign: "center", border: "none", background: T.surfaceRaised,
                    minHeight: kapak ? yukseklik : 120, display: "grid", placeItems: "center" }}>
        Önizleme getiriliyor…
      </div>
    );
  }

  if (driveKlasorMu(link)) return <div style={kutu}>Bu bir Drive <strong>klasör</strong> bağlantısı — klasörler önizlenemez. Tek bir dosyanın bağlantısını yapıştır.</div>;
  if (adaylar.length === 0) return <div style={kutu}>Bu bağlantıdan bir Drive dosyası tanınamadı. Bağlantının drive.google.com/file/d/... biçiminde olduğundan emin ol.</div>;
  /* ESKİ METİN KALDIRILDI: "paylaşım ayarını 'bağlantısı olan herkes' yap" diyordu.
   * Bugün bu YANLIŞ bir tavsiye — uygulanırsa müşteri dosyalarını herkese açar. Dosyalar
   * bilerek kısıtlı; önizleme sunucudan geliyor. */
  if (sira >= adaylar.length) return <div style={kutu}>Önizleme getirilemedi. Dosya Drive'da duruyor ve orada açılabiliyor — bu ekranda gösterilememesi dosyayla ilgili bir sorun değil.</div>;

  return (
    <img
      src={adaylar[sira]}
      alt="Görsel"
      style={{
        width: "100%",
        height: kapak ? yukseklik : undefined,
        maxHeight: kapak ? undefined : yukseklik,
        objectFit: kapak ? "cover" : "contain",
        borderRadius: radius, background: T.surfaceRaised, display: "block",
      }}
      referrerPolicy="no-referrer"
      onError={() => setSira((n) => n + 1)}
    />
  );
}

/** Google Drive paylaşım linkini, sayfa içinde doğrudan oynatılabilir (gömülü) önizleme
 * formatına çevirir. Dönüştürülemezse null döner, o zaman normal link olarak gösterilir. */
export function driveEmbedUrl(link) {
  const id = driveDosyaId(link);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/**
 * Drive video oynatıcısı — DİKEY/KARE/YATAY yön desteğiyle.
 *
 * SORUN: Drive'ın gömülü oynatıcısı, kendisine verilen çerçevenin şeklini alır. Çerçeve
 * 16:9 (yatay) olduğunda dikey bir Reels videosu ortada küçük kalır ve iki yanı siyah bantla
 * dolar. Çözüm videoyu değiştirmek değil, ÇERÇEVEYİ videonun şekline uydurmaktır.
 *
 * Varsayılan "dikey" — sosyal medya içeriklerinin neredeyse tamamı 9:16 olduğu için.
 * Yön kayıtta belirtilmemişse de dikey kabul edilir.
 */
export const VIDEO_YONLERI = [
  { key: "dikey", label: "Dikey (Reels/Story)", oran: "9 / 16", maxGenislik: 340 },
  { key: "kare", label: "Kare (1:1)", oran: "1 / 1", maxGenislik: 440 },
  { key: "yatay", label: "Yatay (16:9)", oran: "16 / 9", maxGenislik: 640 },
];
export const videoYonuBul = (yon) => VIDEO_YONLERI.find((y) => y.key === yon) || VIDEO_YONLERI[0];

export function DriveVideo({ link, yon, baslik, isId, icerikId }) {
  const embed = driveEmbedUrl(link);
  const y = videoYonuBul(yon);
  const sunucu = useSunucuOnizleme({ isId, icerikId, boyut: 800 });
  const [gomulu, setGomulu] = useState(false);
  if (!embed) return null;

  /* GÖMÜLÜ OYNATICI VARSAYILAN DEĞİL. Dosyalar Drive'da kısıtlı olduğu için gömülü çerçeve
   * tarayıcının Google oturumuna ihtiyaç duyuyor; Safari üçüncü taraf çerezleri engellediği
   * için siyah bir kutu çıkıyor. Bunun yerine ilk kare gösterilip Drive'a yönlendiriliyor —
   * yeni sekmede Google kendi oturumunu kullanabiliyor. Videoyu sunucudan geçirmek (80 MB)
   * ne hızlı ne ucuz olurdu. */
  return (
    <div style={{ maxWidth: y.maxGenislik, margin: "0 auto", width: "100%" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: y.oran, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        {gomulu ? (
          <iframe
            src={embed}
            title={baslik || "Video önizleme"}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay"
          />
        ) : (
          <>
            {sunucu.durum === "hazir" && sunucu.veri && (
              <img src={sunucu.veri} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <a href={link} target="_blank" rel="noreferrer"
               style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textDecoration: "none" }}>
              <span style={{ background: "rgba(0,0,0,.62)", color: "#fff", borderRadius: 999, padding: "12px 18px",
                             fontSize: 13, fontWeight: 700, fontFamily: "Inter" }}>
                ▶ Drive'da Aç ve İzle
              </span>
            </a>
          </>
        )}
      </div>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
        <button
          onClick={() => setGomulu((v) => !v)}
          style={{ background: "none", border: "none", color: T.textFaint, textAlign: "left",
                   fontSize: 11, fontFamily: "Inter", cursor: "pointer", padding: 0 }}
        >
          {gomulu ? "Kapak görüntüsüne dön"
                  : gomuluEngelliMi() ? "Gömülü oynatıcıyı dene (bu tarayıcıda çalışmaz)" : "Gömülü oynatıcıyı dene"}
        </button>
        {gomulu && (
          <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.5 }}>
            {GOMULU_ACIKLAMA}
          </span>
        )}
      </div>
    </div>
  );
}


/**
 * Küçük kare önizleme (liste satırlarında). Aday adresleri sırayla dener; hiçbiri açılmazsa
 * bir simge gösterir — küçük bir karede hata metni okunamayacağı için burada sessiz kalmak
 * doğru: kullanıcı satırı açtığında büyük görünümde gerçek sebep zaten yazıyor.
 */
export function DriveKucukGorsel({ link, isId, icerikId }) {
  const sunucu = useSunucuOnizleme({ isId, icerikId, boyut: 200 });
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  if (sunucu.durum === "hazir" && sunucu.veri) {
    return <img src={sunucu.veri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  if (adaylar.length === 0 || sira >= adaylar.length || sunucu.durum === "yukleniyor") {
    return <span style={{ fontSize: 15 }}>🖼</span>;
  }
  return (
    <img
      src={adaylar[sira]}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      referrerPolicy="no-referrer"
      onError={() => setSira((n) => n + 1)}
    />
  );
}
