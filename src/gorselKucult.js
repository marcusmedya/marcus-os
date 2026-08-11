/**
 * GÖRSEL KÜÇÜLTME
 * ---------------
 * Uygulamadaki tüm görseller (marka kimliği, teklif logoları, müşteri içerik görselleri)
 * base64 metin olarak TEK bir veri bloğunun içinde saklanıyor. Her kayıtta bu bloğun
 * tamamı baştan yazılıyor, üstüne bir kopyası da yedeğe gidiyor.
 *
 * Telefondan çekilmiş bir fotoğraf 3-5 MB olabilir; base64'e çevrilince ~%33 daha büyür.
 * Birkaç görsel biriktiğinde Vercel'in ~4.5 MB istek sınırına dayanılır ve KAYITLAR
 * TAMAMEN ÇALIŞMAZ HALE GELİR — sessiz ve tehlikeli bir sınır bu.
 *
 * Bu yüzden görseller tarayıcıda, sunucuya gitmeden önce küçültülüyor: en uzun kenar
 * 1400 piksele indiriliyor ve JPEG olarak sıkıştırılıyor. Sonuç genelde 10-40 kat daha
 * küçük ve ekranda gözle görülür bir fark yok.
 */

/** Bir dosyayı küçültülmüş base64 metnine çevirir. Promise döner. */
export function gorseliKucult(file, secenekler = {}) {
  const { maxKenar = 1400, kalite = 0.72, seffafKoru = false, hedefBayt = 600 * 1024 } = secenekler;

  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Dosya seçilmedi."));
    if (!/^image\//.test(file.type || "")) return reject(new Error("Bu bir görsel dosyası değil."));
    // 25 MB üstü dosyalar tarayıcıda bellek sorunu çıkarabilir — baştan reddedilir.
    if (file.size > 25 * 1024 * 1024) return reject(new Error("Görsel çok büyük (25 MB üstü). Daha küçük bir dosya seç."));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Görsel açılamadı — dosya bozuk ya da desteklenmeyen bir format olabilir."));
      img.onload = () => {
        try {
          let genislik = img.naturalWidth || img.width;
          let yukseklik = img.naturalHeight || img.height;
          if (!genislik || !yukseklik) return reject(new Error("Görsel boyutu okunamadı."));

          const oran = Math.min(1, maxKenar / Math.max(genislik, yukseklik));
          genislik = Math.max(1, Math.round(genislik * oran));
          yukseklik = Math.max(1, Math.round(yukseklik * oran));

          const canvas = document.createElement("canvas");
          canvas.width = genislik;
          canvas.height = yukseklik;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Görsel işlenemedi."));

          // Logolarda şeffaflık korunur (PNG). Diğerlerinde JPEG'e çevrildiği için
          // şeffaf alanlar siyah çıkmasın diye önce beyaz zemin basılır.
          if (!seffafKoru) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, genislik, yukseklik);
          }
          ctx.drawImage(img, 0, 0, genislik, yukseklik);

          let sonuc = seffafKoru ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", kalite);
          // PNG hâlâ çok büyükse (fotoğraf yüklenmiş olabilir) JPEG'e düşülür.
          if (sonuc.length > hedefBayt) sonuc = canvas.toDataURL("image/jpeg", 0.6);
          if (sonuc.length > hedefBayt * 2) sonuc = canvas.toDataURL("image/jpeg", 0.45);

          resolve(sonuc);
        } catch (e) {
          reject(new Error("Görsel işlenemedi."));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Bir base64 metninin yaklaşık kaç bayt olduğunu döner. */
export function base64Bayt(metin) {
  if (typeof metin !== "string") return 0;
  const virgul = metin.indexOf(",");
  const govde = virgul >= 0 ? metin.slice(virgul + 1) : metin;
  return Math.round((govde.length * 3) / 4);
}

/** İnsan okunur boyut: 1.4 MB, 320 KB gibi. */
export function boyutYazisi(bayt) {
  if (!bayt || bayt < 1024) return `${bayt || 0} B`;
  if (bayt < 1024 * 1024) return `${(bayt / 1024).toFixed(0)} KB`;
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
}
