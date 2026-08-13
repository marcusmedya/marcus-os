import { kv } from "@vercel/kv";
import crypto from "crypto";
import { KEY, guvenliGuncelle, kilitAl, kilitBirak, guvenliYaz, deftereYaz, defteriOku } from "../lib/kv-yaz.js";
import { girisKoduGonder, koduDogrula, oturumAc, oturumKapat, oturumGecerliMi, tumOturumlariIptalEt, ikiAdimliAktifMi, esitMi, baslikOku } from "../lib/oturum.js";
import { markayaGoreSuz, icBilgiyiTemizle, izinleriDaralt, yazmayiBirlestir, trKucult } from "../lib/marka-kilidi.js";

/** Bir kayıt (eski veri, yeni veri) arasındaki ÖNEMLİ değişiklikleri (müşteri/personel/üyelik
 * ekleme-silme, müşteri durum değişikliği) otomatik tespit edip okunabilir işlem geçmişi
 * kayıtları üretir. Amaç: her tek tek işlemi elle loglamak yerine, kayıt anında ne değiştiğini
 * karşılaştırarak "kim ne zaman ne yaptı" defterini kendiliğinden doldurmak. */
function degisiklikleriTespitEt(eski, yeni, kisi) {
  const aciklamalar = [];
  const listeKarsilastir = (alan, etiket, adAlani) => {
    const eskiListe = Array.isArray(eski && eski[alan]) ? eski[alan] : [];
    const yeniListe = Array.isArray(yeni && yeni[alan]) ? yeni[alan] : [];
    const eskiIds = new Set(eskiListe.map((x) => x.id));
    const yeniIds = new Set(yeniListe.map((x) => x.id));
    yeniListe.forEach((x) => { if (!eskiIds.has(x.id)) aciklamalar.push(`${etiket} eklendi: "${x[adAlani] || x.id}"`); });
    eskiListe.forEach((x) => {
      if (!yeniIds.has(x.id)) { aciklamalar.push(`${etiket} silindi: "${x[adAlani] || x.id}"`); return; }
      // Müşteri durum değişikliği (aktif/donduruldu/ayrıldı) ayrıca not edilir.
      if (alan === "clients") {
        const yenisi = yeniListe.find((y) => y.id === x.id);
        if (yenisi && yenisi.durum !== x.durum) aciklamalar.push(`"${x.ad}" durumu değişti: ${x.durum} → ${yenisi.durum}`);
      }
    });
  };
  listeKarsilastir("clients", "Müşteri", "ad");
  listeKarsilastir("personel", "Personel", "ad");
  listeKarsilastir("uyelikler", "Üyelik", "ad");
  listeKarsilastir("teklifler", "Teklif", "musteri");
  return aciklamalar.map((aciklama) => ({ id: nid(), tarih: new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }), kisi, aciklama }));
}
function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
/** Başarılı girişte sayaç sıfırlanır. Bu olmadan, gün içinde biriken hatalı denemeler
 * (çoğu zaman kendi test denemelerin) 15 dakika boyunca PERSONEL ve MÜŞTERİ girişlerini de
 * kilitliyordu — sayaç IP başına tutulduğu için doğru şifreyi bilen kişi de giremiyordu. */
async function basariliGirisiSifirla(req) {
  try { await kv.del(`login-fail-${istekIP(req)}`); } catch (e) { /* kritik değil */ }
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
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar", "musteriIcerikleri"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar", "clients", "hesapOlcumleri"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "clients", "haftalikPaylasimlar", "subeler"],
  cekimListesi: ["stoklar", "paylasimGecmisi", "clients", "subeler"],
  cekimEdit: ["cekimIsleri", "clients", "markalasmaSurecleri", "musteriIcerikleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  uyelikler: ["uyelikler"],
  sifreKasasi: ["musteriGirisleri", "clients"],
};
// YAZMA izinleri OKUMA izinlerinden bilerek farklı: paylasimlar/cekimEdit gibi dar izinler
// "clients"i sadece marka adı GÖRMEK için (sadeleştirilmiş) alır — asıl (zengin) müşteri
// verisinin bu sadeleştirilmiş haliyle EZİLMEMESİ için o izinlerden clients YAZILAMAZ.
const PERMISSION_WRITE_FIELDS = {
  dashboard: ["clients", "monthly", "gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "personel", "vergiTakvimi", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  musteriler: ["clients", "bekleyenTahsilatlar", "hesaplar", "musteriIcerikleri"],
  finans: ["gelirKalemleri", "giderKalemleri", "ofisGiderleri", "bekleyenTahsilatlar", "monthly", "vergiTakvimi", "clients", "personel", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  takvim: ["clients", "vergiTakvimi"],
  odemeTakvimi: ["clients", "hesaplar", "hesapTransferleri", "hesapDuzeltmeleri"],
  teklif: ["teklifler", "teklifSablonlari", "sozlesmeSablonlari", "markaKimligiGorseli"],
  reklamlar: ["reklamlar", "hesapOlcumleri"],
  paylasimlar: ["stoklar", "paylasimGecmisi", "gunlukKontrol", "haftalikPaylasimlar", "subeler"],
  cekimListesi: [],
  cekimEdit: ["cekimIsleri", "markalasmaSurecleri", "musteriIcerikleri"],
  personel: ["personel"],
  birikim: ["birikimler"],
  uyelikler: ["uyelikler"],
  sifreKasasi: ["musteriGirisleri"],
};
const FULL_CLIENT_PERMS = ["dashboard", "musteriler", "finans", "takvim", "odemeTakvimi"];
const DEFAULT_FIELD_VALUES = {
  clients: [], monthly: [], gelirKalemleri: [], giderKalemleri: [], ofisGiderleri: [], bekleyenTahsilatlar: [],
  personel: [], vergiTakvimi: [], hesaplar: [{ id: "ana", ad: "Marcus Medya", anaHesap: true }], hesapTransferleri: [],
  teklifler: [], teklifSablonlari: [], sozlesmeSablonlari: [], markaKimligiGorseli: null,
  reklamlar: [], stoklar: {}, paylasimGecmisi: [], gunlukKontrol: null, cekimIsleri: [], birikimler: [], haftalikPaylasimlar: [], subeler: [], markalasmaSurecleri: [], musteriIcerikleri: [], uyelikler: [],
};
const DEFAULT_PERMS = {
  dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false,
  teklif: false, reklamlar: true, paylasimlar: true, cekimListesi: false, cekimEdit: true, markaYoneticisi: false, personel: false, birikim: false, uyelikler: false, sifreKasasi: false,
};

function hashSifre(sifre, salt) {
  return crypto.scryptSync(sifre, salt, 64).toString("hex");
}

/** Şifreyi/kimlik bilgilerini kontrol edip rolü döndürür.
 * "owner" (tam yetki), "staff" (izinli alanlar, opsiyonel kişisel kimlikle), ya da null (yetkisiz). */
async function resolveRole(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");

  // Yeni yol: tarayıcı artık şifre yerine süreli bir oturum anahtarı gönderiyor.
  if (req.headers["x-oturum"] && (await oturumGecerliMi(req.headers["x-oturum"]))) return { role: "owner" };

  if (!ownerPw && !staffPwLegacy) {
    const username = baslikOku(req, "x-staff-username");
    if (!username) return { role: "owner" };
  }
  if (ownerPw && provided === ownerPw) return { role: "owner" };
  if (staffPwLegacy && provided === staffPwLegacy) return { role: "staff", staffId: null, staffName: null };

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = hashSifre(password, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "staff", staffId: hesap.id, staffName: hesap.ad, staffPerms: hesap.izinler || null, staffEmail: hesap.email || "", staffMarkalar: hesap.markalar || [] };
    }
  }

  // Müşteri Paneli girişi — tamamen ayrı bir kullanıcı adı/şifre çifti kullanır,
  // personel/owner girişleriyle hiç karışmaz. Sadece KENDİ marka bilgisine erişebilir.
  const musteriUsername = baslikOku(req, "x-musteri-username");
  const musteriPassword = baslikOku(req, "x-musteri-password");
  if (musteriUsername && musteriPassword) {
    const data = await kv.get(KEY);
    const hesap = ((data && data.musteriHesaplari) || []).find((h) => h.kullaniciAdi === musteriUsername);
    if (hesap) {
      const hash = hashSifre(musteriPassword, hesap.sifreSalt);
      if (hash === hesap.sifreHash) return { role: "musteri", musteriId: hesap.id, musteriClientId: hesap.clientId, musteriAd: hesap.ad };
    }
  }
  return null;
}

export default async function handler(req, res) {
  /* KİLİT AÇMA, hız sınırının ÖNÜNDE çalışır — aksi halde kısır döngü olurdu: kilitliyken
   * kilidi açma isteği de engellenirdi. Erişim vermez, sadece sayacı sıfırlar ve yönetici
   * şifresi ister.
   *
   * Bunun sınırsız bir şifre deneme kapısına dönüşmemesi için AYRI ve çok daha dar bir
   * sayaç kullanılır: saatte 5 hatalı deneme. */
  if (req.method === "POST" && req.body && req.body.authAction === "kilidiAc") {
    const ownerPw = process.env.SITE_PASSWORD;
    const acmaKey = `unlock-fail-${istekIP(req)}`;
    let acmaSayac = 0;
    try { acmaSayac = (await kv.get(acmaKey)) || 0; } catch (e) { acmaSayac = 0; }
    if (acmaSayac >= 5) {
      return res.status(429).json({ error: "Kilit açma da geçici olarak durduruldu. 1 saat sonra tekrar dene." });
    }
    if (ownerPw && (!req.body.sifre || !esitMi(req.body.sifre, ownerPw))) {
      try { await kv.set(acmaKey, acmaSayac + 1, { ex: 3600 }); } catch (e) { /* kritik değil */ }
      return res.status(401).json({ error: "Şifre hatalı." });
    }
    await basariliGirisiSifirla(req);
    try { await kv.del(acmaKey); } catch (e) { /* kritik değil */ }
    return res.status(200).json({ ok: true });
  }

  if (await rateLimitAsildiMi(req)) {
    return res.status(429).json({ error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar dene." });
  }

  /* ---------------------------------------------------------------- *
   * GİRİŞ AKIŞI (oturum + iki adımlı doğrulama)
   * Yeni bir api dosyası açmamak için buraya "authAction" olarak eklendi.
   * Bu blok resolveRole'den ÖNCE çalışır, çünkü giriş yapan kişinin henüz oturumu yoktur.
   * ---------------------------------------------------------------- */
  if (req.method === "POST" && req.body && req.body.authAction) {
    const { authAction, sifre, kod, hatirla } = req.body;
    const ownerPw = process.env.SITE_PASSWORD;

    // Adım 1: şifre kontrolü. Doğruysa ya kod gönderilir ya da doğrudan oturum açılır.
    if (authAction === "girisBasla") {
      if (!ownerPw) {
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false });
      }
      if (!sifre || !esitMi(sifre, ownerPw)) {
        await basarisizGirisiKaydet(req);
        await deftereYaz("giris-basarisiz", { ip: istekIP(req) });
        return res.status(401).json({ error: "Şifre hatalı." });
      }
      if (!ikiAdimliAktifMi()) {
        // E-posta doğrulaması yapılandırılmamış — kilitlenmeyi önlemek için doğrudan giriş.
        await basariliGirisiSifirla(req);
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false });
      }
      await deftereYaz("giris-basarili", { rol: "owner", ip: istekIP(req) });
      const sonuc = await girisKoduGonder(req.headers["x-forwarded-for"] || null);
      if (!sonuc.gonderildi) {
        // E-posta gönderilemedi — sistemden tamamen kilitlenme, şifreyle devam et.
        const { token, sure } = await oturumAc(!!hatirla);
        return res.status(200).json({ ok: true, token, sure, kodGerekli: false, uyari: `Kod e-postası gönderilemedi (${sonuc.sebep || "sebep bilinmiyor"}), bu yüzden kod adımı atlandı.` });
      }
      return res.status(200).json({ ok: true, kodGerekli: true });
    }

    // Adım 2: e-postaya gelen kodun doğrulanması.
    if (authAction === "kodDogrula") {
      if (ownerPw && (!sifre || !esitMi(sifre, ownerPw))) {
        await basarisizGirisiKaydet(req);
        return res.status(401).json({ error: "Şifre hatalı." });
      }
      if (!(await koduDogrula(kod))) {
        await basarisizGirisiKaydet(req);
        return res.status(401).json({ error: "Kod hatalı ya da süresi dolmuş." });
      }
      const { token, sure } = await oturumAc(!!hatirla);
      return res.status(200).json({ ok: true, token, sure });
    }

    // Bu cihazdan çıkış.
    if (authAction === "cikis") {
      await oturumKapat(req.headers["x-oturum"]);
      return res.status(200).json({ ok: true });
    }

    // Tüm cihazlardan çıkış — sadece yetkili yapabilir.
    if (authAction === "tumCihazlardanCikis") {
      await deftereYaz("tum-oturumlar-iptal", { ip: istekIP(req) });
      const yetkili = (req.headers["x-oturum"] && (await oturumGecerliMi(req.headers["x-oturum"])))
        || (ownerPw && esitMi(baslikOku(req, "x-site-password"), ownerPw));
      if (!yetkili) return res.status(401).json({ error: "Yetkisiz." });
      await tumOturumlariIptalEt();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Geçersiz giriş işlemi." });
  }

  const auth = await resolveRole(req);
  // Kimlik doğrulandıysa hatalı deneme sayacını temizle — yoksa eski denemeler geçerli
  // girişleri de engellemeye devam ederdi.
  if (auth) await basariliGirisiSifirla(req);
  if (!auth) {
    await basarisizGirisiKaydet(req);
    return res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  }
  const { role, staffId, staffName, staffPerms, staffEmail, staffMarkalar, musteriId, musteriClientId, musteriAd } = auth;

  // Müşteri Paneli — tamamen izole bir akış. Owner/personel akışının hiçbir parçasına
  // dokunmaz; müşteri SADECE kendi marka bilgisine ve SADECE kendi içerik onaylarına erişebilir.
  if (role === "musteri") {
    try {
      const data = (await kv.get(KEY)) || {};
      const kendiMarka = (data.clients || []).find((c) => String(c.id) === String(musteriClientId));

      // Marka silinmiş ya da dondurulmuşsa, panele hiç giriş yapılamaz — hesap var olsa bile
      // "kullanım dışı" sayılır. Silme durumunda ayrıca deleteClient tarafında hesabın
      // kendisi de otomatik siliniyor; bu kontrol dondurma durumunu ve olası gecikmeleri kapsar.
      if (!kendiMarka || kendiMarka.durum === "donduruldu") {
        return res.status(403).json({ error: "Bu hesap şu anda kullanım dışı. Sorularınız için ajansınızla iletişime geçin." });
      }

      const kendiIcerikleri = (data.musteriIcerikleri || []).filter((i) => String(i.clientId) === String(musteriClientId));

      /* ---------------------------------------------------------------- *
       * MÜŞTERİYE GÖNDERİLEN EK VERİ (reklamlar, paylaşım planı, operasyon)
       *
       * KRİTİK: burada ne göndermediğimiz, ne gönderdiğimiz kadar önemli. Her kayıt
       * alan alan SEÇİLEREK kopyalanıyor — kaydın tamamı asla olduğu gibi gönderilmiyor.
       * Böylece ileride bu kayıtlara eklenecek yeni bir iç alan (maliyet, personel notu vb.)
       * müşteri paneline kendiliğinden sızamaz.
       *
       * Bilerek DIŞARIDA bırakılanlar:
       *  - Reklam bütçesi (iç bilgi)
       *  - Operasyon işlerinde kameraman/editör adı, iç yorumlar, işlem geçmişi, brief
       *  - Her türlü maliyet, ücret ve personel bilgisi
       * ---------------------------------------------------------------- */
      const markaAdi = kendiMarka ? kendiMarka.ad : "";
      /** Reklam ve Operasyon kayıtlarında marka, ID ile değil ADIYLA tutuluyor ve "Diğer
       * (elle yaz)" seçeneğiyle serbest metin de girilebiliyor. Bu yüzden eşleştirme baştaki/
       * sondaki boşluğa ve büyük-küçük harfe takılmadan yapılır — yoksa "Kanatçı Diren " gibi
       * tek bir boşluk farkı, o markanın hiçbir reklamının görünmemesine yol açardı. */
      const markaEsit = (deger) => String(deger || "").trim().toLocaleLowerCase("tr") === String(markaAdi).trim().toLocaleLowerCase("tr");

      const kendiReklamlari = (data.reklamlar || [])
        .filter((r) => markaEsit(r.marka))
        .map((r) => ({
          id: r.id,
          reklamAdi: r.reklamAdi,
          baslangicTarihi: r.baslangicTarihi || null,
          bitisTarihi: r.bitisTarihi || null,
          not: r.not || null,
          // Kampanya sonuçları — müşterinin görmesi gereken performans rakamları.
          // Bütçe hâlâ gönderilmiyor (iç bilgi).
          erisim: r.erisim || null,
          gosterim: r.gosterim || null,
          tiklama: r.tiklama || null,
          etkilesim: r.etkilesim || null,
          sonuc: r.sonuc || null,
        }));

      const kendiPaylasimPlani = (data.haftalikPaylasimlar || [])
        .filter((p) => String(p.clientId) === String(musteriClientId))
        .map((p) => ({
          id: p.id,
          gun: p.gun,
          haftaKey: p.haftaKey,
          tur: p.tur,
          yapildi: !!p.yapildi,
          yapildigiTarih: p.yapildigiTarih || null,
          altMetin: p.altMetin || null,
          gorselUrl: p.gorselUrl || null,
        }));

      const kendiIsleri = (data.cekimIsleri || [])
        .filter((j) => markaEsit(j.marka))
        .map((j) => ({
          id: j.id,
          icerikTuru: j.icerikTuru || "",
          kategori: j.kategori || null,
          asama: j.asama || "",
          cekimTarihi: j.cekimTarihi || null,
          teslimTarihi: j.teslimTarihi || null,
          teslimEdilmeTarihi: j.teslimEdilmeTarihi || null,
          uretilenAdet: j.uretilenAdet || null,
        }));

      if (req.method === "GET") {
        return res.status(200).json({
          role: "musteri",
          musteriAd,
          marka: kendiMarka ? kendiMarka.ad : "",
          firmaAdi: data.firmaAdi || "Marcus Medya",
          icerikler: kendiIcerikleri,
          reklamlar: kendiReklamlari,
          paylasimPlani: kendiPaylasimPlani,
          operasyonIsleri: kendiIsleri,
        });
      }

      if (req.method === "POST") {
        const { musteriAction, icerikId, revizeNotu } = req.body || {};
        if (musteriAction !== "onayla" && musteriAction !== "revizeIste") {
          return res.status(400).json({ error: "Geçersiz işlem." });
        }
        if (musteriAction === "revizeIste" && (!revizeNotu || !revizeNotu.trim())) {
          return res.status(400).json({ error: "Revize notu boş olamaz." });
        }

        // Kilit altında, EN GÜNCEL veri üzerinde çalışılır — eskiden yukarıda okunan
        // (bu noktada bayatlamış olabilecek) kopya yazıldığı için, arada ekibin yaptığı
        // değişiklikler silinebiliyordu.
        const sonuc = await guvenliGuncelle(async (guncel) => {
          const liste = guncel.musteriIcerikleri || [];
          const icerik = liste.find((i) => i.id === icerikId && String(i.clientId) === String(musteriClientId));
          if (!icerik) return { iptal: true, hata: "İçerik bulunamadı.", kod: 404 };

          const yeni = { ...guncel };
          if (musteriAction === "onayla") {
            // onaylayan: "Müşteri" — yönetici de müşteri adına onaylayabildiği için (müşteri
            // unuttuğunda iş takılı kalmasın diye), onayın kimden geldiği kaydediliyor.
            yeni.musteriIcerikleri = liste.map((i) => (i.id === icerikId ? { ...i, durum: "onaylandi", revizeNotu: null, onaylayan: "Müşteri", yanitTarihi: new Date().toLocaleDateString("tr-TR") } : i));

            /* NOT: Müşteri bir çekim planını onayladığında Operasyon'da iş OTOMATİK AÇILMAZ.
             * İş, yöneticinin Planım > Onay Kutusu'ndan onaylamasıyla ve orada yaptığı
             * atamalarla (kim yapacak, hangi aşamada başlayacak) açılır. Böylece panoya
             * kimsenin üstünde olmayan, aşaması yanlış işler düşmez. */

            // Bağlı bir Operasyon işi varsa (Kontrol Bekliyor'dan otomatik düşmüşse), müşteri
            // onaylayınca o iş de "Teslim Edildi" olarak işaretlenir — döngü kapanır.
            //
            // ÇEKİM PLANLARI HARİÇ: bir çekim planının onaylanması "iş bitti" demek değil,
            // "çekime başlayabiliriz" demektir. Bu ayrım olmasaydı, revize sonrası tekrar
            // onaylanan bir plan, çekim hiç yapılmadan "Teslim Edildi"ye atlardı.
            if (icerik.tur !== "cekim" && icerik.kaynakIsId && yeni.cekimIsleri) {
              yeni.cekimIsleri = yeni.cekimIsleri.map((j) => {
                if (j.id !== icerik.kaynakIsId) return j;
                const not = { id: (j.gecmis || []).length + 1, tarih: new Date().toLocaleString("tr-TR"), yazan: "Müşteri", aciklama: "Müşteri içeriği onayladı." };
                // Aylık İş Raporu bu tarihe göre sayıyor — müşteri onayıyla teslim edilen
                // işler de sayıma girsin diye burada da kaydediliyor.
                return { ...j, asama: "Teslim Edildi", teslimEdilmeTarihi: new Date().toISOString().slice(0, 10), gecmis: [...(j.gecmis || []), not] };
              });
            }
          } else {
            // operasyonaAktarildi sıfırlanır — bu YENİ bir revize isteği, yöneticinin onay
            // kutusunda tekrar görünmeli (önceki istek aktarılmış olsa bile).
            yeni.musteriIcerikleri = liste.map((i) => (i.id === icerikId ? { ...i, durum: "revize", revizeNotu: revizeNotu.trim(), operasyonaAktarildi: false, yanitTarihi: new Date().toLocaleDateString("tr-TR") } : i));
            // Bağlı bir Operasyon işi varsa, otomatik olarak "Revize İstendi" aşamasına döner ve
            // müşterinin notu işin geçmişine düşer — ekip ekstra bir yere bakmadan görsün.
            if (icerik.kaynakIsId && yeni.cekimIsleri) {
              yeni.cekimIsleri = yeni.cekimIsleri.map((j) => {
                if (j.id !== icerik.kaynakIsId) return j;
                const not = { id: (j.gecmis || []).length + 1, tarih: new Date().toLocaleString("tr-TR"), yazan: "Müşteri", aciklama: `Müşteri revize istedi: "${revizeNotu.trim()}"` };
                return { ...j, asama: "Revize İstendi", gecmis: [...(j.gecmis || []), not] };
              });
            }
          }
          return { veri: yeni };
        });

        if (!sonuc.ok) return res.status(sonuc.kod || 400).json({ error: sonuc.hata || "İşlem yapılamadı." });
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: "Desteklenmeyen istek." });
    } catch (e) {
      return res.status(500).json({ error: "Sunucu hatası: " + e.message });
    }
  }

  try {
    if (req.method === "GET") {
      const data = await kv.get(KEY);
      if (role === "staff") {
        // Kişiye özel hesapla girildiyse o hesabın kendi izinleri kullanılır; eski ortak
        // personel şifresiyle (STAFF_PASSWORD) girildiyse genel (herkes için ortak) izinler kullanılır.
        const hamPerms = staffPerms ? { ...DEFAULT_PERMS, ...staffPerms } : { ...DEFAULT_PERMS, ...((data && data.staffPermissions) || {}) };
        // Marka kilitli hesapta ajans geneli bölümler (Finans, Personel, Dashboard...) izin
        // verilmiş olsa bile kapatılır — o bölümlerin verisi markaya göre süzülemez.
        const perms = izinleriDaralt(hamPerms, Array.isArray(staffMarkalar) && staffMarkalar.length > 0);
        // _v (versiyon sayacı) personele de gönderilir — eskiden gönderilmediği için
        // personel kayıtlarında çakışma kontrolü hiç devreye giremiyordu ve bayat bir
        // personel sekmesi, arada yapılan değişikliklerin üzerine yazabiliyordu.
        const restricted = { staffPermissions: perms, firmaAdi: (data && data.firmaAdi) || "Marcus Medya", _v: (data && typeof data._v === "number") ? data._v : 0 };

        /* MARKA KİLİDİ: hesaba marka listesi tanımlıysa, veri daha izinlere dağıtılmadan
         * ÖNCE süzülür. Böylece hangi izin açık olursa olsun, o hesap başka markanın
         * verisini asla göremez. Kilitli hesaplardan reklam bütçesi ve müşteri finansalları
         * da temizlenir. */
        const izinliMarkalar = Array.isArray(staffMarkalar) ? staffMarkalar : [];
        const markaKilitliMi = izinliMarkalar.length > 0;
        restricted.markaKilidi = markaKilitliMi ? izinliMarkalar : null;
        const kaynak = icBilgiyiTemizle(markayaGoreSuz(data || {}, izinliMarkalar), markaKilitliMi);

        // Hangi izinler açıksa, o izne bağlı alanları gerçek veriyle dolduruyoruz.
        Object.entries(PERMISSION_DATA_FIELDS).forEach(([permKey, fields]) => {
          if (perms[permKey] !== true) return;
          fields.forEach((f) => { restricted[f] = (kaynak[f] !== undefined) ? kaynak[f] : DEFAULT_FIELD_VALUES[f]; });
        });

        // clients alanı: geniş kapsamlı bir izin varsa TAM veri, sadece paylasimlar/cekimEdit gibi
        // dar izinler varsa sadece marka kartları için isim/durum ile sınırlı veri gönderilir.
        const genisIzinVarMi = FULL_CLIENT_PERMS.some((p) => perms[p] === true);
        if (!genisIzinVarMi && restricted.clients) {
          restricted.clients = (kaynak.clients || []).map((c) => ({ id: c.id, ad: c.ad, durum: c.durum }));
        }

        // İş atarken/üyelik bilgisi gönderirken kime gönderdiğini seçebilmesi için
        // isim/e-posta listesi (giriş bilgisi YOK).
        if (perms.cekimEdit === true || perms.uyelikler === true) {
          restricted.personelRosteri = ((data && data.personelHesaplari) || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
        }

        return res.status(200).json({ data: restricted, role, staffId, staffName });
      }
      // Sahibe (owner) bile şifre hash'lerini asla gönderme — ayrı, korumalı bir uçtan yönetiliyor.
      /* Güvenlik defteri ayrı bir anahtarda tutuluyor ve yalnızca istendiğinde gönderilir —
       * her veri çekilişinde 500 kaydı taşımak gereksiz yük olurdu. */
      if (req.query && req.query.defter === "1") {
        return res.status(200).json({ defter: await defteriOku() });
      }
      const { personelHesaplari, kasaSifresiHash, kasaSifresiSalt, musteriHesaplari, ...safeData } = data || {};
      const personelRosteri = (personelHesaplari || []).map((h) => ({ ad: h.ad, email: h.email || "" }));
      const musteriRosteri = (musteriHesaplari || []).map((h) => ({ id: h.id, clientId: h.clientId, ad: h.ad, kullaniciAdi: h.kullaniciAdi }));
      /* Güvenlik durumu — arayüz, iki adımlı doğrulamanın gerçekten açık olup olmadığını
       * ancak sunucudan öğrenebilir (ortam değişkenleri tarayıcıya gönderilmez). Bu bayrak
       * olmadan kullanıcı "kurdum" sanıp kapalı bir sistemle devam edebilirdi. */
      return res.status(200).json({
        data: data ? { ...safeData, personelRosteri, musteriRosteri } : null,
        role,
        guvenlik: { ikiAdimliAktif: ikiAdimliAktifMi(), yedekEpostaSayisi: String(process.env.BACKUP_EMAIL || "").split(",").filter((x) => x.trim()).length },
      });
    }

    if (req.method === "POST") {
      const { data, force, kilitAction, _v: clientVersion } = req.body || {};

      // Düzenleme kilidi (eşzamanlı düzenleme uyarısı) — ayrı bir uç noktaydı, Vercel'in
      // Hobby planındaki 12 fonksiyon sınırına takılmamak için buraya taşındı. Owner ya da
      // HERHANGİ bir geçerli personel girişi kullanabilir (özel bir izin gerektirmez —
      // amaç sadece "bu kaydı başka biri de açtı" diye erken uyarı vermek).
      if (kilitAction) {
        const { tur, id, kisi } = req.body || {};
        if (!tur || !id) return res.status(400).json({ error: "tur ve id gerekli." });
        const kilitKey = `marcus-os-kilit:${tur}:${id}`;
        if (kilitAction === "al") {
          const mevcut = await kv.get(kilitKey);
          if (mevcut && mevcut.kisi && mevcut.kisi !== kisi) {
            return res.status(200).json({ kilitli: true, kilitleyen: mevcut.kisi });
          }
          await kv.set(kilitKey, { kisi, zaman: Date.now() }, { ex: 90 });
          return res.status(200).json({ kilitli: false });
        }
        if (kilitAction === "birak") {
          const mevcut = await kv.get(kilitKey);
          if (mevcut && mevcut.kisi === kisi) await kv.del(kilitKey);
          return res.status(200).json({ ok: true });
        }
        return res.status(400).json({ error: "Geçersiz kilit işlemi." });
      }

      if (!data) return res.status(400).json({ error: "data eksik" });

      // PERSONEL: sadece izin verilen alanları değiştirebilir, geri kalan veri sunucuda
      // korunur ve gönderilen içerik ne olursa olsun yok sayılır. "clients" alanı SADECE
      // geniş kapsamlı izinlerden (musteriler/finans/takvim/odemeTakvimi/dashboard) yazılabilir —
      // paylasimlar/cekimEdit gibi dar izinler clients'i sadece okuyabilir, asla yazamaz
      // (yoksa sadeleştirilmiş liste, zengin müşteri verisinin üzerine yazardı).
      if (role === "staff") {
        // Personel kaydı da artık kilit altında, EN GÜNCEL veri okunarak yapılıyor ve
        // versiyon sayacını artırıyor. Ayrıca çakışma kontrolü personel için de geçerli:
        // iki editör aynı anda çalışırken biri diğerinin işini geri alamıyor.
        const sonuc = await guvenliGuncelle(async (existing) => {
          if (!force && typeof existing._v === "number" && typeof clientVersion === "number" && existing._v !== clientVersion) {
            return { iptal: true, kod: 409, hata: "stale", ek: { serverVersion: existing._v } };
          }
          const guncelHesap = staffId ? ((existing.personelHesaplari || []).find((h) => h.id === staffId)) : null;
          // İzinli markalar HER ZAMAN sunucudaki güncel hesap kaydından okunur — tarayıcının
          // gönderdiğine asla güvenilmez, yoksa kilit kolayca aşılırdı.
          const yaziMarkalari = (guncelHesap && Array.isArray(guncelHesap.markalar)) ? guncelHesap.markalar : [];
          const yaziKilitli = yaziMarkalari.length > 0;
          // Okumada olduğu gibi YAZMADA da izinler daraltılır: kilitli hesap, izni açık olsa
          // bile Finans/Personel gibi ajans geneli alanlara yazamaz.
          const hamYaziPerms = guncelHesap ? { ...DEFAULT_PERMS, ...(guncelHesap.izinler || {}) } : { ...DEFAULT_PERMS, ...(existing.staffPermissions || {}) };
          const perms = izinleriDaralt(hamYaziPerms, yaziKilitli);
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

              /* MARKA KİLİDİNDE VERİ KAYBI + YETKİSİZ YAZMA KORUMASI (kritik)
               * Kilitli hesap yalnızca kendi markalarının kayıtlarını gördüğü için, listeyi
               * olduğu gibi geri yazarsa diğer markaların kayıtları SİLİNİRDİ. Ortak katman
               * alan alan birleştirir: başkasının kayıtları sunucudaki hâliyle korunur,
               * sadece bu hesabın markalarına ait olanlar güncellenir. Dizi ve nesne
               * (stoklar, gunlukKontrol, musteriGirisleri) alanları ayrı ayrı ele alınır. */
              if (yaziKilitli) {
                merged[f] = yazmayiBirlestir(existing, data, f, yaziMarkalari);
                return;
              }

              merged[f] = data[f];
            });
          });
          // Bu kayıtta ne değişti (müşteri/personel/üyelik eklendi-silindi, durum değişti) —
          // İşlem Geçmişi defterine otomatik not düşülür. Son 200 kayıtla sınırlı tutulur.
          const yeniKayitlar = degisiklikleriTespitEt(existing, merged, staffName || "Personel");
          if (yeniKayitlar.length > 0) {
            merged.islemGecmisi = [...(existing.islemGecmisi || []), ...yeniKayitlar].slice(-200);
          }
          return { veri: merged };
        });

        if (!sonuc.ok) {
          if (sonuc.kod === 409) {
            return res.status(409).json({
              staleConflict: true,
              error: "Bu veri, sen düzenlerken başka bir cihazdan/sekmeden değişmiş. Kaybını önlemek için önce en güncel veriyi çekip senin değişikliğini tekrar uygulaman gerekiyor.",
              serverVersion: sonuc.mevcut && sonuc.mevcut._v,
            });
          }
          return res.status(sonuc.kod || 400).json({ error: sonuc.hata || "Kayıt yapılamadı." });
        }
        return res.status(200).json({ ok: true, _v: sonuc.veri._v });
      }

      // Owner kaydı da artık kilit altında: okuma, çakışma kontrolü, güvenlik freni ve
      // yazma tek bir bölünmez blok halinde yapılıyor. Eskiden bu adımlar arasında başka
      // bir isteğin araya girip yazdığı değişiklik fark edilmeden siliniyordu.
      const ownerKilidi = await kilitAl();
      try {
      // Owner'ın yerel kopyasında personelHesaplari hiç yok (GET'te hiç gönderilmiyor) —
      // bu yüzden her kayıtta mevcut hesapları sunucudan alıp geri ekliyoruz, yoksa
      // ilk kayıtta tüm personel hesapları sessizce silinmiş olurdu.
      const existingFull = await kv.get(KEY);

      // ÇAKIŞMA KONTROLÜ: her kayıt bir versiyon sayacını (_v) bir artırır. İstek, en son
      // GÖRDÜĞÜ versiyonu (clientVersion) da gönderir. Sunucudaki versiyon bundan farklıysa,
      // bu araya BAŞKA bir kayıt girmiş demektir (örn. az önce başka bir cihaz/sekme kaydetti,
      // ya da bu istek uzun süre arka planda/uykuda bekleyip GEÇ gönderildi) — böyle bir
      // durumda üzerine kör kör yazmak yerine reddedip ön yüzün önce en güncel veriyi
      // çekmesini istiyoruz. "force: true" ile (kullanıcı bilerek üzerine yazmak isterse) bu
      // kontrol atlanabilir.
      if (!force && existingFull && typeof existingFull._v === "number" && typeof clientVersion === "number" && existingFull._v !== clientVersion) {
        return res.status(409).json({
          staleConflict: true,
          error: "Bu veri, sen düzenlerken başka bir cihazdan/sekmeden değişmiş. Kaybını önlemek için önce en güncel veriyi çekip senin değişikliğini tekrar uygulaman gerekiyor.",
          serverVersion: existingFull._v,
        });
      }

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
        musteriHesaplari: (existingFull && existingFull.musteriHesaplari) || [],
        kasaSifresiHash: existingFull ? existingFull.kasaSifresiHash : undefined,
        kasaSifresiSalt: existingFull ? existingFull.kasaSifresiSalt : undefined,
        // Sayacı SUNUCUDAKİ değerden alıyoruz (tarayıcının gönderdiğinden değil);
        // bir artırma işini guvenliYaz yapıyor, böylece tüm uç noktalarda tek bir kural var.
        _v: (existingFull && typeof existingFull._v === "number" ? existingFull._v : 0),
      };
      // Bu kayıtta ne değişti (müşteri/personel/üyelik eklendi-silindi, durum değişti) —
      // İşlem Geçmişi defterine otomatik not düşülür. Son 200 kayıtla sınırlı tutulur.
      const yeniKayitlar = degisiklikleriTespitEt(existingFull, finalData, "Yönetici (CEO)");
      if (yeniKayitlar.length > 0) {
        finalData.islemGecmisi = [...((existingFull && existingFull.islemGecmisi) || []), ...yeniKayitlar].slice(-200);
      } else if (existingFull && existingFull.islemGecmisi) {
        finalData.islemGecmisi = existingFull.islemGecmisi;
      }
      // Versiyonu artırır, günlük + saatlik yedeği yazar, yetim müşteri hesaplarını temizler.
      const yazilan = await guvenliYaz(finalData);

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

      return res.status(200).json({ ok: true, _v: yazilan._v });
      } finally {
        await kilitBirak(ownerKilidi);
      }
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
