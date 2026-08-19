import { kv } from "@vercel/kv";
import crypto from "crypto";
import { KEY, guvenliGuncelle, deftereYaz } from "../lib/kv-yaz.js";
import { ownerYetkiliMi } from "../lib/oturum.js";

const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimListesi: false, cekimEdit: true, markaYoneticisi: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false,
};

async function checkOwner(req) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true; // şifre ayarlanmadıysa (ilk kurulum) izin ver
  return await ownerYetkiliMi(req);
}

// data.js'teki ile AYNI IP bazlı sayaç kullanılır — owner şifresi bu uç noktadan da
// denenebildiği için, brute-force sayacının uç noktalar arasında PAYLAŞILMASI gerekir;
// yoksa biri /api/data'da engellenip buradan denemeye devam edebilirdi.
const RATE_LIMIT_ESIK = 20;
const RATE_LIMIT_PENCERE_SN = 900;
function istekIP(req) {
  return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "bilinmeyen").split(",")[0].trim();
}
async function rateLimitAsildiMi(req) {
  try {
    const sayac = (await kv.get(`login-fail-${istekIP(req)}`)) || 0;
    return sayac >= RATE_LIMIT_ESIK;
  } catch (e) {
    return false;
  }
}
async function basarisizGirisiKaydet(req) {
  try {
    const key = `login-fail-${istekIP(req)}`;
    const sayac = (await kv.get(key)) || 0;
    await kv.set(key, sayac + 1, { ex: RATE_LIMIT_PENCERE_SN });
  } catch (e) {
    // sessizce geç
  }
}

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Hesap listesini kilit altında, en güncel veri üzerine yazar ve versiyon sayacını
 * artırır. Eskiden burada yukarıda okunan (bayatlamış olabilecek) kopyanın tamamı geri
 * yazılıyordu — bir hesap eklerken arada yapılan başka değişiklikler silinebiliyordu. */
/* YAZILAN SÜRÜM DIŞARI VERİLİYOR.
 *
 * Bu uç KV'ye yazıyor ve sürüm sayacını artırıyor. Sayac tarayıcıya bildirilmezse yönetici
 * sekmesi bir tur geride kalır; bir sonraki kaydı sahte "başka cihazdan değişmiş" uyarısı
 * alır ve ön yüz kullanıcının O ANKİ düzenlemesini sunucu verisiyle ezer. Yani personel
 * hesabı eklemek, sonra bir müşteriyi düzenlemek düzenlemeyi kaybettiriyordu. */
let sonYazilanSurum;
async function hesaplariYaz(alanAdi, guncel) {
  /* Yalnızca hesap listesi değişiyor — sayaç yalnızca onun için artsın ki o sırada
   * kart düzenleyen ya da şifre kasasına yazan kimse bayat olmasın. */
  const sonuc = await guvenliGuncelle(async (veri) => ({
    degisenAlanlar: [alanAdi],
    veri: { ...veri, [alanAdi]: guncel },
  }));
  sonYazilanSurum = sonuc && sonuc.ok && sonuc.veri ? sonuc.veri._v : undefined;
  return sonuc.ok;
}
const surumEki = () => (typeof sonYazilanSurum === "number" ? { _v: sonYazilanSurum } : {});

function guvenliListe(hesaplar) {
  // markalar: hesabın kilitli olduğu marka listesi (boş = tüm markalar görünür)
  return (hesaplar || []).map((h) => ({ id: h.id, ad: h.ad, kullaniciAdi: h.kullaniciAdi, email: h.email || "", izinler: { ...DEFAULT_PERMS, ...(h.izinler || {}) }, markalar: Array.isArray(h.markalar) ? h.markalar : [] }));
}

/** Müşteri hesapları personel hesaplarından ayrı bir alanda (musteriHesaplari) tutulur —
 * izin sistemi yok, sadece hangi markaya (clientId) bağlı olduğu bilgisi var. */
function guvenliMusteriListesi(hesaplar) {
  return (hesaplar || []).map((h) => ({ id: h.id, clientId: h.clientId, ad: h.ad, kullaniciAdi: h.kullaniciAdi }));
}

export default async function handler(req, res) {
  if (await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }
  if (!(await checkOwner(req))) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz. Sadece yönetici bu sayfayı kullanabilir." });
  }

  try {
    const data = (await kv.get(KEY)) || {};
    const hesapTuru = (req.body && req.body.hesapTuru) || (req.query && req.query.hesapTuru) || "personel";
    const musteriMi = hesapTuru === "musteri";
    const alanAdi = musteriMi ? "musteriHesaplari" : "personelHesaplari";
    const hesaplar = data[alanAdi] || [];
    const listeGoster = musteriMi ? guvenliMusteriListesi : guvenliListe;

    if (req.method === "GET") {
      return res.status(200).json({ hesaplar: listeGoster(hesaplar) });
    }

    if (req.method === "POST") {
      const { action, id, ad, kullaniciAdi, sifre, email, izinler, markalar, clientId } = req.body || {};

      if (action === "ekle") {
        if (!ad || !kullaniciAdi || !sifre) return res.status(400).json({ error: "Ad, kullanıcı adı ve şifre gerekli." });
        if (sifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
        if (musteriMi && !clientId) return res.status(400).json({ error: "Bu hesabın bağlı olduğu marka (clientId) gerekli." });
        if (hesaplar.some((h) => h.kullaniciAdi.toLowerCase() === kullaniciAdi.toLowerCase())) {
          return res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor." });
        }
        const salt = crypto.randomBytes(16).toString("hex");
        const yeni = musteriMi
          ? { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad, kullaniciAdi, clientId, sifreHash: hashSifre(sifre, salt), sifreSalt: salt }
          : { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad, kullaniciAdi, email: email || "", izinler: { ...DEFAULT_PERMS }, sifreHash: hashSifre(sifre, salt), sifreSalt: salt };
        const guncel = [...hesaplar, yeni];
        if (!(await hesaplariYaz(alanAdi, guncel))) return res.status(500).json({ error: "Kaydedilemedi, tekrar dene." });
        // Hesap açma/silme ve yetki değişiklikleri güvenlik defterine yazılır.
        await deftereYaz("hesap-islemi", { hesapTuru: hesapTuru || "personel", action, id: id || null, ad: ad || null });
        return res.status(200).json({ ok: true, hesaplar: listeGoster(guncel), ...surumEki() });
      }

      if (action === "sifreSifirla") {
        if (!id || !sifre) return res.status(400).json({ error: "id ve yeni şifre gerekli." });
        if (sifre.length < 4) return res.status(400).json({ error: "Şifre en az 4 karakter olmalı." });
        const salt = crypto.randomBytes(16).toString("hex");
        const guncel = hesaplar.map((h) => (h.id === id ? { ...h, sifreHash: hashSifre(sifre, salt), sifreSalt: salt } : h));
        if (!(await hesaplariYaz(alanAdi, guncel))) return res.status(500).json({ error: "Kaydedilemedi, tekrar dene." });
        // Hesap açma/silme ve yetki değişiklikleri güvenlik defterine yazılır.
        await deftereYaz("hesap-islemi", { hesapTuru: hesapTuru || "personel", action, id: id || null, ad: ad || null });
        return res.status(200).json({ ok: true, hesaplar: listeGoster(guncel), ...surumEki() });
      }

      if (action === "guncelle") {
        if (!id) return res.status(400).json({ error: "id gerekli." });
        const guncel = hesaplar.map((h) => {
          if (h.id !== id) return h;
          const yeni = { ...h };
          if (musteriMi) {
            if (ad !== undefined) yeni.ad = ad;
            if (clientId !== undefined) yeni.clientId = clientId;
          } else {
            if (email !== undefined) yeni.email = email;
            if (izinler !== undefined) yeni.izinler = { ...DEFAULT_PERMS, ...izinler };
            // Marka kilidi: boş dizi = kilit yok (tüm markalar). Kilit sadece yönetici tarafından
            // değiştirilebilir (bu uç nokta zaten owner yetkisi istiyor).
            if (markalar !== undefined) yeni.markalar = Array.isArray(markalar) ? markalar.filter(Boolean) : [];
          }
          return yeni;
        });
        if (!(await hesaplariYaz(alanAdi, guncel))) return res.status(500).json({ error: "Kaydedilemedi, tekrar dene." });
        // Hesap açma/silme ve yetki değişiklikleri güvenlik defterine yazılır.
        await deftereYaz("hesap-islemi", { hesapTuru: hesapTuru || "personel", action, id: id || null, ad: ad || null });
        return res.status(200).json({ ok: true, hesaplar: listeGoster(guncel), ...surumEki() });
      }

      if (action === "sil") {
        if (!id) return res.status(400).json({ error: "id gerekli." });
        const guncel = hesaplar.filter((h) => h.id !== id);
        if (!(await hesaplariYaz(alanAdi, guncel))) return res.status(500).json({ error: "Kaydedilemedi, tekrar dene." });
        // Hesap açma/silme ve yetki değişiklikleri güvenlik defterine yazılır.
        await deftereYaz("hesap-islemi", { hesapTuru: hesapTuru || "personel", action, id: id || null, ad: ad || null });
        return res.status(200).json({ ok: true, hesaplar: listeGoster(guncel), ...surumEki() });
      }

      // Bir marka (client) silindiğinde, o markaya bağlı Müşteri Paneli giriş hesabını/hesaplarını
      // da otomatik temizler — aksi halde silinen bir müşterinin giriş bilgisi hâlâ geçerli kalırdı.
      // Sadece hesapTuru "musteri" için anlamlı; personel hesapları client'a bağlı değildir.
      if (action === "silByClientId" && musteriMi) {
        if (clientId === undefined || clientId === null) return res.status(400).json({ error: "clientId gerekli." });
        const guncel = hesaplar.filter((h) => String(h.clientId) !== String(clientId));
        if (!(await hesaplariYaz(alanAdi, guncel))) return res.status(500).json({ error: "Kaydedilemedi, tekrar dene." });
        // Hesap açma/silme ve yetki değişiklikleri güvenlik defterine yazılır.
        await deftereYaz("hesap-islemi", { hesapTuru: hesapTuru || "personel", action, id: id || null, ad: ad || null });
        return res.status(200).json({ ok: true, hesaplar: listeGoster(guncel), ...surumEki() });
      }

      return res.status(400).json({ error: "Geçersiz işlem." });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
