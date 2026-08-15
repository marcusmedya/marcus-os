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
import { T } from "./tema.jsx";

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
export function DriveGorsel({ link, yukseklik = 420, kapak = false, radius = 10 }) {
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  const kutu = {
    width: "100%", borderRadius: radius, background: T.surfaceRaised,
    border: `1px dashed ${T.border}`, padding: "14px 16px",
    fontSize: 12, color: T.textFaint, lineHeight: 1.6, fontFamily: "Inter",
  };

  if (driveKlasorMu(link)) return <div style={kutu}>Bu bir Drive <strong>klasör</strong> bağlantısı — klasörler önizlenemez. Tek bir dosyanın bağlantısını yapıştır.</div>;
  if (adaylar.length === 0) return <div style={kutu}>Bu bağlantıdan bir Drive dosyası tanınamadı. Bağlantının drive.google.com/file/d/... biçiminde olduğundan emin ol.</div>;
  if (sira >= adaylar.length) return <div style={kutu}>Görsel yüklenemedi. En yaygın sebep: dosyanın paylaşım ayarı kapalı. Drive'da dosyaya sağ tık → Paylaş → "Bağlantıya sahip olan herkes" → Görüntüleyen.</div>;

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

export function DriveVideo({ link, yon, baslik }) {
  const embed = driveEmbedUrl(link);
  const y = videoYonuBul(yon);
  if (!embed) return null;
  return (
    <div style={{ maxWidth: y.maxGenislik, margin: "0 auto", width: "100%" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: y.oran, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        <iframe
          src={embed}
          title={baslik || "Video önizleme"}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="autoplay"
        />
      </div>
    </div>
  );
}


/**
 * Küçük kare önizleme (liste satırlarında). Aday adresleri sırayla dener; hiçbiri açılmazsa
 * bir simge gösterir — küçük bir karede hata metni okunamayacağı için burada sessiz kalmak
 * doğru: kullanıcı satırı açtığında büyük görünümde gerçek sebep zaten yazıyor.
 */
export function DriveKucukGorsel({ link }) {
  const adaylar = driveGorselAdaylari(link);
  const [sira, setSira] = useState(0);
  useEffect(() => { setSira(0); }, [link]);

  if (adaylar.length === 0 || sira >= adaylar.length) {
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
