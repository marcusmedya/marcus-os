import { hedefKlasoruHazirla, servisHesabinaYetkiVer, DURUM_KLASORLERI, onizlemeGetir,
         servisleCopeAt } from "./drive-tasima.js";

/**
 * GOOGLE DRIVE — KART İÇİNDEN DOSYA YÜKLEME
 *
 * AMAÇ: personel Drive'a hiç girmeden, kartın içinden video/görsel yükleyebilsin. Dosya
 * kendiliğinden doğru firmanın, doğru ayının klasörüne düşsün.
 *
 * NEDEN İKİ AYRI KİMLİK KULLANILIYOR — bu kurgu deneyerek bulundu, keyfi değil:
 *
 *   Servis hesabı  → klasör AÇABİLİR, dosya TAŞIYABİLİR, ama YÜKLEYEMEZ.
 *                    Google: "Service Accounts do not have storage quota". Dosyayı kim
 *                    oluşturursa sahibi o olur ve kendi alanından yer kaplar; servis
 *                    hesaplarının alanı sıfırdır. Klasörler yer kaplamadığı için açılabiliyor.
 *
 *   OAuth (sahip)  → dosya YÜKLEYEBİLİR. Dosyanın sahibi kullanıcı olur, onun Drive alanından
 *                    yer kaplar. Dar `drive.file` izniyle çalışır: uygulama yalnızca kendi
 *                    oluşturduğu dosyalara erişir, kullanıcının Drive'ının geri kalanına değil.
 *
 * SIRA ÖNEMLİ: dosya önce kullanıcının köküne yüklenip sonra taşınamaz — servis hesabı
 * kullanıcının Drive kökünü göremediği için "eski klasörü kaldır" bilgisi boş kalır ve Google
 * "Increasing the number of parents is not allowed" hatası verir. Bu yüzden dosya DOĞRUDAN
 * hedef klasöre yüklenir. Denenerek doğrulandı.
 *
 * DOSYA VERCEL'E UĞRAMAZ: sunucu yalnızca Google'dan bir "yükleme oturumu" adresi alıp
 * tarayıcıya verir; baytlar tarayıcıdan doğrudan Google'a gider. Vercel'in ~4.5 MB istek
 * sınırı böylece devre dışı kalır — 80 MB'lık bir Reels videosu sorunsuz yüklenir.
 *
 * GEREKEN ORTAM DEĞİŞKENLERİ:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN   (bir kez alınır, süresizdir)
 */

/** Yükleme için gereken üç değişken de tanımlı mı. */
export function yuklemeHazirMi() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

const CAGRI_SINIRI_MS = 8000;

async function getir(url, secenekler = {}) {
  const iptal = new AbortController();
  const sayac = setTimeout(() => iptal.abort(), CAGRI_SINIRI_MS);
  try {
    return await fetch(url, { ...secenekler, signal: iptal.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Google yanıt vermedi (zaman aşımı).");
    throw e;
  } finally {
    clearTimeout(sayac);
  }
}

/**
 * Yenileme jetonundan kısa ömürlü erişim jetonu üretir.
 *
 * Yenileme jetonu süresizdir (uygulama "In production" yayınlandığı için); erişim jetonu
 * bir saat yaşar. Her istekte yenisi alınır — saklamaya değmez.
 */
async function oauthErisimJetonu() {
  const r = await getir("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const veri = await r.json();
  if (!r.ok || !veri.access_token) {
    throw new Error(veri.error_description || veri.error || "Google yükleme jetonu alınamadı.");
  }
  return veri.access_token;
}

/* Türkçe karakterler dosya adında sorun çıkarabiliyor (indirme, arama, bazı programlar).
 * Sadeleştirme kayıpsız değil ama okunabilirliği koruyor: "ÇORBACI ŞEMSİ" -> "CORBACI_SEMSI". */
const HARF = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

function sadelestir(metin) {
  return String(metin || "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (h) => HARF[h] || h)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Dosyanın uzantısını korur; yoksa MIME türünden tahmin eder. */
function uzanti(orijinalAd, mimeTur) {
  const m = String(orijinalAd || "").match(/\.([A-Za-z0-9]{1,5})$/);
  if (m) return m[1].toLowerCase();
  const t = String(mimeTur || "");
  if (t.startsWith("video/")) return t.split("/")[1] === "quicktime" ? "mov" : (t.split("/")[1] || "mp4");
  if (t.startsWith("image/")) return t.split("/")[1] === "jpeg" ? "jpg" : (t.split("/")[1] || "jpg");
  return "dat";
}

/**
 * Sistem tarafından üretilen dosya adı: MARKA_ICERIK_V<n>.uzanti
 *
 * Örn. VIZZ_SIVRISINEK_KAMPANYA_V2.mp4
 * Personelin dosya adlandırmayla uğraşmaması için — kullanıcının açık isteği buydu.
 */
export function dosyaAdiUret({ marka, icerikAdi, versiyon, orijinalAd, mimeTur, slot }) {
  const parcalar = [sadelestir(marka), sadelestir(icerikAdi)].filter(Boolean);
  const govde = parcalar.join("_") || "ICERIK";
  /* SLOT ADA YAZILIYOR — karosel gönderide 8 dosya AYNI klasöre düşüyor. Slot adı olmasaydı
   * hepsi "MARKA_ICERIK_V1" olurdu; Drive'da sıra karışır, hangisinin kaçıncı slayt olduğu
   * dosya adından okunamazdı. Tek dosyalı kartlarda ad eskisi gibi kalıyor (slot "1"). */
  const s = String(slot || "1");
  const slotEki = s === "story" ? "_STORY" : (s === "1" ? "" : `_${s}`);
  return `${govde}${slotEki}_V${Number(versiyon) || 1}.${uzanti(orijinalAd, mimeTur)}`;
}

/* Tarayıcıdan gelen Origin doğrudan Google'a iletiliyor; biçimini doğruluyoruz ki
 * beklenmedik bir değer başlığa girmesin. */
function gecerliOrigin(deger) {
  if (!deger) return false;
  try {
    const u = new URL(String(deger));
    return (u.protocol === "https:" || u.protocol === "http:") && `${u.origin}` === String(deger);
  } catch (e) {
    return false;
  }
}

/**
 * YÜKLEME OTURUMU AÇAR.
 *
 * Hedef klasörü (servis hesabıyla) hazırlar, sonra Google'dan bir "resumable upload" adresi
 * alır. Tarayıcı baytları doğrudan o adrese gönderir.
 *
 * Dönen `yuklemeUrl` kısa ömürlüdür ve tek bir dosya içindir; tarayıcıya vermek jetonu
 * vermekten güvenlidir — o adresle başka bir şey yapılamaz.
 */
export async function yuklemeOturumuAc({ markaKlasoru, markaAdi, icerikAdi, versiyon, orijinalAd, mimeTur, boyut, origin, slot, kartKlasoru = null }) {
  if (!yuklemeHazirMi()) return { ok: false, sebep: "Drive yükleme kurulu değil." };

  const klasor = await hedefKlasoruHazirla({
    markaKlasoru, markaAdi, durumAdi: DURUM_KLASORLERI.onayBekleyen, kartKlasoru,
  });
  if (!klasor.ok) return { ok: false, sebep: klasor.sebep };

  const ad = dosyaAdiUret({ marka: markaAdi, icerikAdi, versiyon, orijinalAd, mimeTur, slot });

  try {
    const jeton = await oauthErisimJetonu();
    const r = await getir("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jeton}`,
        "Content-Type": "application/json; charset=UTF-8",
        ...(boyut ? { "X-Upload-Content-Length": String(boyut) } : {}),
        ...(mimeTur ? { "X-Upload-Content-Type": mimeTur } : {}),
        /* ORIGIN BAŞLIĞI ŞART — bu satır olmadan yükleme tarayıcıda ÇALIŞMAZ.
         *
         * Google, oturum açılırken Origin gönderilmezse ASIL yükleme yanıtına
         * Access-Control-Allow-Origin koymuyor. Ön kontrol (OPTIONS) yine de izin verdiği
         * için sorun geç fark ediliyor: dosya Google'a başarıyla yükleniyor (HTTP 200) ama
         * tarayıcı yanıtı okuyamayıp isteği başarısız sayıyor. Safari buna sadece
         * "Load failed" diyor, sebebini söylemiyor.
         *
         * Ölçülerek doğrulandı:
         *   Origin olmadan → PUT 200, ACAO YOK    → tarayıcı reddeder
         *   Origin ile     → PUT 200, ACAO var    → tarayıcı okur */
        ...(gecerliOrigin(origin) ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ name: ad, parents: [klasor.klasorId] }),
    });
    if (!r.ok) {
      const h = await r.json().catch(() => ({}));
      return { ok: false, sebep: h.error?.message || "Yükleme oturumu açılamadı." };
    }
    const yuklemeUrl = r.headers.get("location");
    if (!yuklemeUrl) return { ok: false, sebep: "Google yükleme adresi vermedi." };
    return { ok: true, yuklemeUrl, dosyaAdi: ad, klasorId: klasor.klasorId, klasorYolu: klasor.yol, ayAdi: klasor.ayAdi };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/**
 * YÜKLEME BİTTİKTEN SONRA.
 *
 * Servis hesabına dosya üzerinde yazma yetkisi verir — sonraki aşama taşımalarını o yapacak.
 * Yetki verilmezse dosya yüklenmiş olur ama aşama değiştiğinde taşınamaz.
 */
export async function yuklemeyiTamamla({ dosyaId }) {
  if (!yuklemeHazirMi()) return { ok: false, sebep: "Drive yükleme kurulu değil." };
  try {
    const jeton = await oauthErisimJetonu();
    await servisHesabinaYetkiVer(jeton, dosyaId);

    const r = await getir(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=id,name,mimeType,size,webViewLink,thumbnailLink`,
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    const bilgi = await r.json();
    if (!r.ok) return { ok: false, sebep: bilgi.error?.message || "Dosya bilgisi alınamadı." };
    return {
      ok: true,
      dosyaId: bilgi.id,
      ad: bilgi.name,
      mimeTur: bilgi.mimeType,
      boyut: Number(bilgi.size) || 0,
      /* Bağlantı KLASÖR YOLUNDAN DEĞİL dosya kimliğinden üretiliyor. Dosya sonradan başka
       * klasöre taşınsa bile bu bağlantı çalışmaya devam eder — kullanıcının açık isteği. */
      url: bilgi.webViewLink || `https://drive.google.com/file/d/${bilgi.id}/view`,
    };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/**
 * KARTIN KÜÇÜK RESMİ — SUNUCUDAN GEÇEREK.
 *
 * NEDEN DOĞRUDAN TARAYICIDAN ALINMIYOR: dosyalar Drive'da KISITLI (bilerek — daha önce
 * "bağlantısı olan herkes" ayarındaydı ve 17 müşterinin içeriği açıktaydı). Kısıtlı bir
 * dosyanın küçük resmini tarayıcı `drive.google.com/thumbnail` adresinden okuyamıyor:
 * istek 403 dönüyor ve önizleme sessizce boş kalıyor. Tam olarak bu yaşandı.
 *
 * Dosyayı herkese açmak çözüm değil — o gizlilik sorununu geri getirirdi. Bunun yerine
 * küçük resim SUNUCUDA, uygulamanın kendi yetkisiyle alınıp tarayıcıya veri olarak
 * veriliyor. Dosya Drive'da kısıtlı kalmaya devam ediyor.
 *
 * Küçük resim SAKLANMIYOR, istendiğinde alınıyor: tüm uygulama verisi tek bir JSON bloğu
 * içinde tutuluyor ve her kayıtta baştan yazılıyor — yüzlerce karta gömülü görsel o bloğu
 * şişirir ve kayıtları çalışmaz hale getirirdi.
 */
export async function kucukResimGetir(dosyaId, boyut = 220) {
  /* ÖNCE SERVİS HESABI. OAuth izni `drive.file` olduğu için yalnızca uygulamanın kendi
   * yüklediği dosyaları görüyor; Drive'a elle konmuş eski dosyalar ona görünmez ve önizleme
   * boş kalırdı. Servis hesabı marka klasörlerine üye olduğu için eskileri de okuyabiliyor.
   * OAuth yedekte duruyor: henüz klasöre taşınmamış, yeni yüklenmiş bir dosya için. */
  const servis = await onizlemeGetir(dosyaId, boyut);
  if (servis.ok) return servis;

  if (!yuklemeHazirMi()) return { ok: false, sebep: servis.sebep || "Drive kurulu değil." };
  try {
    const jeton = await oauthErisimJetonu();
    const r = await getir(
      `https://www.googleapis.com/drive/v3/files/${dosyaId}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    const bilgi = await r.json();
    if (!r.ok) return { ok: false, sebep: bilgi.error?.message || "Dosya bilgisi alınamadı." };
    if (!bilgi.thumbnailLink) return { ok: false, sebep: "Bu dosyanın küçük resmi yok." };

    /* thumbnailLink varsayılan olarak çok küçük geliyor; sondaki boyut ekini büyütüyoruz. */
    const olcu = Math.max(80, Math.min(1600, Number(boyut) || 220));
    const adres = String(bilgi.thumbnailLink).replace(/=s\d+$/, `=s${olcu}`);
    const g = await getir(adres, { headers: { Authorization: `Bearer ${jeton}` } });
    if (!g.ok) return { ok: false, sebep: "Küçük resim indirilemedi." };
    const bayt = Buffer.from(await g.arrayBuffer());
    const tur = g.headers.get("content-type") || "image/jpeg";
    return { ok: true, veri: `data:${tur};base64,${bayt.toString("base64")}`, mimeTur: bilgi.mimeType || "" };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e) };
  }
}

/** Yüklenen dosyayı siler — yarım kalan ya da iptal edilen yüklemeleri temizlemek için. */
export async function yuklenenDosyayiSil(dosyaId) {
  try {
    const jeton = await oauthErisimJetonu();
    await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${jeton}` },
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * DOSYAYI ÇÖPE AT — KALICI SİLME DEĞİL.
 *
 * Karttan bir slayt silindiğinde Drive'daki karşılığı da gitmeli, yoksa marka klasörü kimsenin
 * kullanmadığı dosyalarla dolar. Ama KALICI silme yanlış olurdu: yanlış slaydı silmek bir
 * tıklık iş, geri getirmek imkânsız. Çöpe atılan dosya Drive'da 30 gün duruyor.
 *
 * ÖNCE OAUTH — ÖLÇEREK ÖĞRENİLDİ. İlk denemede servis hesabı kullanıldı ve Google reddetti:
 *
 *     "The user does not have sufficient permissions for this file."
 *
 * Sebep: Drive'da çöpe atmak DÜZENLEME yetkisi değil SAHİPLİK istiyor. Uygulamanın yüklediği
 * dosyaların sahibi kullanıcı — servis hesaplarının depolama kotası olmadığı için yükleyen
 * hep OAuth. Servis hesabı klasörde "Düzenleyen" olsa bile o dosyaları çöpe atamıyor.
 *
 * Servis hesabı yedek yol olarak duruyor: onun kendi oluşturduğu kayıtlar için çalışan tek yol o.
 */
export async function dosyayiCopeAt(dosyaId) {
  if (!dosyaId) return { ok: false, sebep: "Dosya kimliği yok." };

  if (yuklemeHazirMi()) {
    try {
      const jeton = await oauthErisimJetonu();
      const y = await getir(`https://www.googleapis.com/drive/v3/files/${dosyaId}?supportsAllDrives=true`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      if (y.ok) return { ok: true, nasil: "oauth" };
      /* Başarısızsa servis hesabını denemeye devam: dosya uygulama tarafından yüklenmemiş
       * olabilir (elle yapıştırılmış eski bağlantı) — o zaman dar `drive.file` kapsamı onu
       * hiç görmez ve tek şans servis hesabıdır. */
    } catch (e) {
      // yedek yola düş
    }
  }

  const yedek = await servisleCopeAt(dosyaId);
  if (yedek.ok) return { ok: true, nasil: yedek.nasil || "servis" };
  return { ok: false, sebep: yedek.sebep };
}
