import { kv } from "@vercel/kv";
import crypto from "crypto";

const KEY = "marcus-os-data";

/** Kaba kuvvet (brute-force) koruması: aynı IP'den 15 dakikada 20'den fazla başarısız
 * giriş denemesi olursa, şifre doğru olsa bile bir süre reddedilir. */
const RATE_LIMIT_ESIK = 20;
const RATE_LIMIT_PENCERE_SN = 900; // 15 dakika
function istekIP(req) {
  return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "bilinmeyen").split(",")[0].trim();
}
async function rateLimitAsildiMi(req) {
  try {
    const sayac = (await kv.get(`login-fail-${istekIP(req)}`)) || 0;
    return sayac >= RATE_LIMIT_ESIK;
  } catch (e) {
    return false; // KV'ye ulaşılamıyorsa girişi tamamen engelleme, sadece koruma devre dışı kalır
  }
}
async function basarisizGirisiKaydet(req) {
  try {
    const key = `login-fail-${istekIP(req)}`;
    const sayac = (await kv.get(key)) || 0;
    await kv.set(key, sayac + 1, { ex: RATE_LIMIT_PENCERE_SN });
  } catch (e) {
    // sayaç kaydedilemezse sessizce geç, bu kritik değil
  }
}

// Her izin, personel görürse hangi veri alanlarına ihtiyaç duyacağını belirler.
// CEO Paneli'nden bu izinlerden hangileri açıksa, personelin GET yanıtına o alanlar dahil edilir
// ve POST ile o alanlara yazması kabul edilir. Ayarlar bilerek bu listede YOK — personel hesap
// yönetimi, şifre koruması gibi güvenlik ayarlarına personelin asla erişimi olmaz.
const PERMISSION_DATA_FIELDS = {
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "clients", "haftalikPaylasimlar", "subeler"],
  cekimListesi: ["stoklar", "paylasimGecmisi", "clients", "subeler"],
  cekimEdit: ["cekimIsleri", "clients", "markalasmaSurecleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  sifreKasasi: ["musteriGirisleri", "clients"],
};
// YAZMA izinleri OKUMA izinlerinden bilerek farklı: paylasimlar/cekimEdit gibi dar izinler
// "clients"i sadece marka adı GÖRMEK için (sadeleştirilmiş) alır — asıl (zengin) müşteri
// verisinin bu sadeleştirilmiş haliyle EZİLMEMESİ için o izinlerden clients YAZILAMAZ.
const PERMISSION_WRITE_FIELDS = {
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "haftalikPaylasimlar", "subeler"],
  cekimListesi: [],
  cekimEdit: ["cekimIsleri", "markalasmaSurecleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  sifreKasasi: ["musteriGirisleri"],
};
const FULL_CLIENT_PERMS = ["dashboard", "musteriler", "finans", "takvim", "odemeTakvimi"];
const DEFAULT_FIELD_VALUES = {
  clients: [], monthly: [], gelirKalemleri: [], giderKalemleri: [], ofisGiderleri: [], bekleyenTahsilatlar: [],
  personel: [], vergiTakvimi: [], hesaplar: [{ id: "ana", ad: "Marcus Medya", anaHesap: true }], hesapTransferleri: [],
  teklifler: [], teklifSablonlari: [], sozlesmeSablonlari: [], markaKimligiGorseli: null,
  reklamlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: null, cekimIsleri: [], birikimler: [], haftalikPaylasimlar: [], subeler: [], markalasmaSurecleri: [],
};
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimListesi: false, cekimEdit: true, markaYoneticisi: false, personel: false, birikim: false, sifreKasasi: false,
};

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Şifreyi/kimlik bilgilerini kontrol edip rolü döndürür.
 * "owner" (tam yetki), "staff" (izinli alanlar, opsiyonel kişisel kimlikle), ya da null (yetkisiz). */
async function resolveRole(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];

  if (!ownerPw && !staffPwLegacy) {
    const username = req.headers["x-staff-username"];
    if (!username) return { role: "owner" };
  }
  if (ownerPw && provided === ownerPw) return { role: "owner" };
  if (staffPwLegacy && provided === staffPwLegacy) return { role: "staff", staffId: null, staffName: null };

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "staff", staffId: hesap.id, staffName: hesap.ad, staffPerms: hesap.izinler || null, staffEmail: hesap.email || "" };
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }
  const auth = await resolveRole(req);
  if (!auth) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  }
  const { role, staffId, staffName, staffPerms, staffEmail } = auth;

  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);
      if (role === "staff") {
        // Kişiye özel hesapla girildiyse o hesabın kendi izinleri kullanılır; eski ortak
        // personel şifresiyle (STAFF_PASSWORD) girildiyse genel (herkes için ortak) izinler kullanılır.
        const perms = staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...((data && data.staffPermissions) || {}) };
        const restricted = { staffPermissions: perms, firmaAdi: (data && data.firmaAdi) || "Marcus Medya" };

        // Hangi izinler açıksa, o izne bağlı alanları gerçek veriyle dolduruyoruz.
        Object.entries(PERMISSION_DATA_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => { restricted[f] = (data && data[f] !== undefined) ? data[f] : DEFAULT_FIELD_VALUES[f]; });
        });

        // clients alanı: geniş kapsamlı bir izin varsa TAM veri, sadece paylasimlar/cekimEdit gibi
        // dar izinler varsa sadece marka kartları için isim/durum ile sınırlı veri gönderilir.
        const genisIzinVarMi = FULL_CLIENT_PERMS.some((p) => perms[p] === true);
        if (!genisIzinVarMi && restricted.clients) {
          restricted.clients = ((data && data.clients) || []).map((c) => ({ id: c.id, ad: c.ad, durum: c.durum }));
        }

        // İş atarken kime atadığını seçebilmesi için isim/e-posta listesi (giriş bilgisi YOK).
        if (perms.cekimEdit === true) {
          restricted.personelRosteri = ((data && data.personelHesaplari) || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
        }

        return res.status(200).json({ data: restricted, role, staffId, staffName });
      }
      // Sahibe (owner) bile şifre hash'lerini asla gönderme — ayrı, korumalı bir uçtan yönetiliyor.
      const { personelHesaplari, kasaSifresiHash, kasaSifresiSalt, ...safeData } = data || {};
      const personelRosteri = (personelHesaplari || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
      return res.status(200).json({ data: data ? { ...safeData, personelRosteri } : null, role });
    }

    if (req.method === "POST") {
      const { data, force } = req.body || {};
      if (!data) return res.status(400).json({ error: "data eksik" });

      // PERSONEL: sadece izin verilen alanları değiştirebilir, geri kalan veri sunucuda
      // korunur ve gönderilen içerik ne olursa olsun yok sayılır. "clients" alanı SADECE
      // geniş kapsamlı izinlerden (musteriler/finans/takvim/odemeTakvimi/dashboard) yazılabilir —
      // paylasimlar/cekimEdit gibi dar izinler clients'i sadece okuyabilir, asla yazamaz
      // (yoksa sadeleştirilmiş liste, zengin müşteri verisinin üzerine yazardı).
      if (role === "staff") {
        const existing = (await kv.get(KEY)) || {};
        const guncelHesap = staffId ? ((existing.personelHesaplari || []).find((h) => h.id === staffId)) : null;
        const perms = guncelHesap ? { ...DEFAULT_PERMS, ...(guncelHesap.izinler || {}) } : { ...DEFAULT_PERMS, ...(existing.staffPermissions || {}) };
        const merged = { ...existing };
        Object.entries(PERMISSION_WRITE_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => {
            if (data[f] === undefined) return;
            if (f === "clients") {
              // Personel yazımlarında da aynı güvenlik freni: müşteri sayısı çarpıcı biçimde
              // azalıyorsa (bayat/eksik veri olabilir) bu alanı yazmayı reddet.
              const existingCount = Array.isArray(existing.clients) ? existing.clients.length : 0;
              const newCount = Array.isArray(data.clients) ? data.clients.length : 0;
              if (existingCount >= 2 && newCount < existingCount * 0.6) return;
            }
            merged[f] = data[f];
          });
        });
        await kv.set(KEY, merged);
        // Personel yazımları da günlük yedeğe dahil olsun — daha önce sadece owner kayıtları
        // yedekleniyordu, bu da personelin yaptığı işlerin yedeksiz kalması riskini taşıyordu.
        const bugun = new Date().toISOString().slice(0, 10);
        await kv.set(`marcus-os-snapshot-${bugun}`, merged);
        return res.status(200).json({ ok: true });
      }

      // Owner'ın yerel kopyasında personelHesaplari hiç yok (GET'te hiç gönderilmiyor) —
      // bu yüzden her kayıtta mevcut hesapları sunucudan alıp geri ekliyoruz, yoksa
      // ilk kayıtta tüm personel hesapları sessizce silinmiş olurdu.
      const existingFull = await kv.get(KEY);

      // GÜVENLİK FRENİ: müşteri sayısı mevcut veriye göre çarpıcı biçimde azalıyorsa
      // (örn. bir hata sonucu boş/demo veri yazılmaya çalışılıyorsa) kaydı reddet.
      // Bilinçli bir toplu silme durumunda ön yüz "force: true" ile tekrar dener.
      // Aynı fren, Personel (İK) kayıtları için de geçerli — sadece müşteri verisi değil,
      // ekip kayıtlarının da yanlışlıkla toplu silinmesine karşı korunuyor.
      if (!force) {
        const existingCount = existingFull && Array.isArray(existingFull.clients) ? existingFull.clients.length : 0;
        const newCount = Array.isArray(data.clients) ? data.clients.length : 0;
        if (existingCount >= 2 && newCount < existingCount * 0.6) {
          return res.status(409).json({
            blocked: true,
            error: `Güvenlik freni: mevcut ${existingCount} müşteriden ${newCount}'a düşen bir kayıt engellendi. Bu istenmeyen bir veri kaybı olabilir.`,
            existingCount,
            newCount,
          });
        }
        const existingPersonelCount = existingFull && Array.isArray(existingFull.personel) ? existingFull.personel.length : 0;
        const newPersonelCount = Array.isArray(data.personel) ? data.personel.length : 0;
        if (existingPersonelCount >= 2 && newPersonelCount < existingPersonelCount * 0.6) {
          return res.status(409).json({
            blocked: true,
            error: `Güvenlik freni: mevcut ${existingPersonelCount} personel kaydından ${newPersonelCount}'a düşen bir kayıt engellendi. Bu istenmeyen bir veri kaybı olabilir.`,
            existingCount: existingPersonelCount,
            newCount: newPersonelCount,
            alan: "personel",
          });
        }
      }

      // Owner'ın yerel kopyasında ASLA bulunmayan (GET'te hiç gönderilmeyen) alanlar burada
      // sunucudaki mevcut değerleriyle geri eklenir — yoksa her kayıtta sessizce silinirler.
      // personelHesaplari için bu zaten yapılıyordu; kasaSifresiHash/Salt de AYNI kategoride
      // olduğu halde unutulmuştu — bu da "kasa şifresi kendiliğinden sıfırlanıyor" hatasının sebebiydi.
      const finalData = {
        ...data,
        personelHesaplari: (existingFull && existingFull.personelHesaplari) || [],
        kasaSifresiHash: existingFull ? existingFull.kasaSifresiHash : undefined,
        kasaSifresiSalt: existingFull ? existingFull.kasaSifresiSalt : undefined,
      };
      await kv.set(KEY, finalData);

      const today = new Date().toISOString().slice(0, 10);
      await kv.set(`marcus-os-snapshot-${today}`, finalData);

      if (Math.random() < 0.08) {
        try {
          const keys = await kv.keys("marcus-os-snapshot-*");
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          for (const k of keys) {
            const d = k.replace("marcus-os-snapshot-", "");
            if (new Date(d) < cutoff) await kv.del(k);
          }
        } catch (e) {
          // temizlik hatası kritik değil
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({
      error:
        "Veritabanına bağlanılamadı. Vercel projende bir KV (Storage) veritabanı bağlı olduğundan emin ol. Detay: " +
        e.message,
    });
  }
}
