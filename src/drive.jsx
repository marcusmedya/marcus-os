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

/* SIRAYA SOKMA — AYNI ANDA EN FAZLA ÜÇ ÖNİZLEME.
 *
 * Pano otuz kart gösterebiliyor. Hepsi aynı anda önizleme isteseydi (ve istedi) tek sayfa
 * açılışı otuz istek üretir; her biri sunucuda iki Google çağrısı yapar. Bu hem yavaş hem
 * de tehlikeli: uygulamanın kaba kuvvet koruması "kısa sürede çok istek" görüp KENDİ
 * kullanıcısını kilitledi. Sıra, yükü tabana yayıyor. */
const ONIZLEME_SIRASI = { calisan: 0, bekleyen: [] };
const SIRA_SINIRI = 3;

function siradaCalistir(is) {
  return new Promise((coz) => {
    const baslat = () => {
      ONIZLEME_SIRASI.calisan += 1;
      is().finally(() => {
        ONIZLEME_SIRASI.calisan -= 1;
        const sonraki = ONIZLEME_SIRASI.bekleyen.shift();
        if (sonraki) sonraki();
      }).then(coz, coz);
    };
    if (ONIZLEME_SIRASI.calisan < SIRA_SINIRI) baslat();
    else ONIZLEME_SIRASI.bekleyen.push(baslat);
  });
}

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

/**
 * VİDEO ADRESİ — KENDİ SUNUCUMUZDAN.
 *
 * Drive'ın gömülü oynatıcısı çerçeve içinden Google'ın çerezlerine erişmek zorunda; Safari
 * ve iOS'taki bütün tarayıcılar bunu varsayılan olarak engelliyor ve ekranda siyah kutu
 * kalıyor. Dosyayı "bağlantısı olan herkese" açmak sorunu çözerdi ama kapatılan gizlilik
 * açığını geri getirirdi.
 *
 * Video kendi sunucumuzdan gelince üçüncü taraf çerezi hiç devreye girmiyor ve GERÇEK bir
 * <video> etiketi kullanılabiliyor: kendi kontrolleri, tam ekranı ve — önemlisi — videonun
 * kendi en-boy oranı. Dikey bir Reels dikey görünüyor, çerçeveye yön ayarı girmek gerekmiyor.
 */
export function useVideoAdresi({ isId, icerikId, alan, slot }) {
  /* SLOT ANAHTARIN PARÇASI. Bir kartta karosel için 8 slayt olabiliyor; slot anahtara
   * girmezse ikinci slayt birincinin adresini kullanır ve hep aynı video oynar. */
  const anahtar = isId !== undefined && isId !== null ? `is:${isId}:${slot || ""}`
                : icerikId !== undefined && icerikId !== null ? `icerik:${icerikId}:${alan || ""}` : null;
  const [adres, setAdres] = useState(null);
  const [durum, setDurum] = useState(anahtar ? "yukleniyor" : "yok");

  useEffect(() => {
    if (!anahtar) { setDurum("yok"); setAdres(null); return undefined; }
    let iptal = false;
    setDurum("yukleniyor"); setAdres(null);
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ onizlemeAction: "videoJetonu", isId, icerikId, alan, slot }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (iptal) return;
        if (r.ok && r.adres) { setAdres(r.adres); setDurum("hazir"); } else setDurum("olmadi");
      })
      .catch(() => { if (!iptal) setDurum("olmadi"); });
    return () => { iptal = true; };
  }, [anahtar, isId, icerikId, alan, slot]);

  return { durum, adres };
}

export function useSunucuOnizleme({ isId, icerikId, alan, boyut = 800, slot }) {
  const anahtar = isId !== undefined && isId !== null ? `is:${isId}:${slot || ""}:${boyut}`
                : icerikId !== undefined && icerikId !== null ? `icerik:${icerikId}:${alan || ""}:${boyut}` : null;
  const [veri, setVeri] = useState(() => (anahtar ? onizlemeBellegi.get(anahtar) || null : null));
  const [sebep, setSebep] = useState("");
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
    siradaCalistir(() => fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ onizlemeAction: "gorsel", isId, icerikId, alan, boyut, slot }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (iptal) return;
        if (r.ok && r.veri) { onizlemeBellegi.set(anahtar, r.veri); setVeri(r.veri); setDurum("hazir"); }
        else { setSebep(r.sebep || ""); setDurum("olmadi"); }
      })
      .catch(() => { if (!iptal) setDurum("olmadi"); }));
    return () => { iptal = true; };
  }, [anahtar, isId, icerikId, alan, boyut, slot]);

  return { durum, veri, sebep };
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
export function DriveGorsel({ link, yukseklik = 420, kapak = false, radius = 10, isId, icerikId, alan, boyut = 1200, slot }) {
  const sunucu = useSunucuOnizleme({ isId, icerikId, alan, boyut, slot });
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
  if (sira >= adaylar.length) {
    return (
      <div style={kutu}>
        Önizleme getirilemedi. Dosya Drive'da duruyor ve orada açılabiliyor — bu ekranda
        gösterilememesi dosyayla ilgili bir sorun değil.
        {/* Google'ın kendi cevabı yalnızca ekibe gösteriliyor; müşteriye teknik metin gitmez
            (sunucu müşteri rolünde bu alanı boş bırakıyor). "File not found" gibi bir cevap,
            dosyanın uygulamanın erişebildiği klasör ağacı dışında olduğunu söyler. */}
        {sunucu.sebep ? <div style={{ marginTop: 6, opacity: 0.75 }}>Google: {sunucu.sebep}</div> : null}
      </div>
    );
  }

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

/**
 * Videonun KENDİ oranına göre azami genişlik.
 *
 * Elle girilen "yön" ayarının yerini alıyor: oran videonun metadata'sından okunuyor, kimse
 * bir şey seçmek zorunda kalmıyor ve yanlış seçilemiyor. Dikey bir Reels geniş çerçevede
 * ya devasa çıkıyor ya iki yanı siyah bantla doluyordu.
 */
export function videoEni(oran) {
  if (!oran) return 420;          // metadata gelmeden makul bir başlangıç
  if (oran < 0.9) return 340;     // dikey — Reels / Story
  if (oran < 1.25) return 440;    // kare
  return 680;                     // yatay
}

export function DriveVideo({ link, yon, baslik, isId, icerikId, alan, slot }) {
  const embed = driveEmbedUrl(link);
  const y = videoYonuBul(yon);
  const video = useVideoAdresi({ isId, icerikId, alan, slot });
  const kapak = useSunucuOnizleme({ isId, icerikId, alan, boyut: 800, slot });
  const [gomulu, setGomulu] = useState(false);
  const [oran, setOran] = useState(null);
  if (!embed && !video.adres) return null;

  /* GERÇEK <video> ETİKETİ. Gömülü Drive oynatıcısı yerine bu kullanılıyor: üçüncü taraf
   * çerezi gerektirmiyor, kendi kontrolleri var ve videonun KENDİ en-boy oranını alıyor —
   * dikey bir Reels dikey görünüyor, çerçeveye yön ayarı girmek gerekmiyor. */
  if (video.durum === "hazir" && video.adres && !gomulu) {
    return (
      <div style={{ maxWidth: oran ? videoEni(oran) : y.maxGenislik, margin: "0 auto", width: "100%" }}>
        <video
          src={video.adres}
          poster={kapak.durum === "hazir" ? kapak.veri : undefined}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setOran(v.videoWidth / v.videoHeight);
          }}
          style={{ width: "100%", maxHeight: "70vh", borderRadius: 10, background: "#000", display: "block" }}
        />
      </div>
    );
  }

  /* Akış kurulamadıysa eski yola dönülüyor: kapak + Drive'da aç. Sessiz siyah kutu yerine
   * en azından bir şey görünüyor. */
  return (
    <div style={{ maxWidth: y.maxGenislik, margin: "0 auto", width: "100%" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: y.oran, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        {gomulu && embed ? (
          <iframe
            src={embed}
            title={baslik || "Video önizleme"}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay"
          />
        ) : (
          <>
            {kapak.durum === "hazir" && kapak.veri && (
              <img src={kapak.veri} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <a href={link} target="_blank" rel="noreferrer"
               style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textDecoration: "none" }}>
              <span style={{ background: "rgba(0,0,0,.62)", color: "#fff", borderRadius: 999, padding: "12px 18px",
                             fontSize: 13, fontWeight: 700, fontFamily: "Inter" }}>
                {video.durum === "yukleniyor" ? "Oynatıcı hazırlanıyor…" : "▶ Drive'da Aç ve İzle"}
              </span>
            </a>
          </>
        )}
      </div>
      {video.durum === "olmadi" && (
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
      )}
    </div>
  );
}


/**
 * Küçük kare önizleme (liste satırlarında). Aday adresleri sırayla dener; hiçbiri açılmazsa
 * bir simge gösterir — küçük bir karede hata metni okunamayacağı için burada sessiz kalmak
 * doğru: kullanıcı satırı açtığında büyük görünümde gerçek sebep zaten yazıyor.
 */
export function DriveKucukGorsel({ link, isId, icerikId, alan, slot }) {
  const sunucu = useSunucuOnizleme({ isId, icerikId, alan, boyut: 200, slot });
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
