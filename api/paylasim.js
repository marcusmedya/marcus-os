import { kv } from "@vercel/kv";
import { KEY, guvenliYaz, kilitAl, kilitBirak, bugunISO } from "../lib/kv-yaz.js";
import { ownerYetkiliMi } from "../lib/oturum.js";

const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stokAnahtari = (clientId, tur) => `${clientId}_${tur}`;
const bugunTR = () => new Date().toLocaleDateString("tr-TR");
/** Sunucu (Vercel) UTC saat diliminde çalışır — bu, gece yarısı ile saat 03:00 arası
 * (Türkiye UTC+3) "bugün"ün bir gün geriden hesaplanmasına yol açıyordu (Günlük Kontrol
 * geç sıfırlanıyordu). Artık her zaman Türkiye'nin takvim gününü baz alır. */
/** Owner her zaman yetkili. Personel ise "paylasimlar" iznine sahipse yetkilidir. */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = req.headers["x-site-password"];
  if (await ownerYetkiliMi(req)) return true;
  if (!ownerPw && !staffPwLegacy && !req.headers["x-staff-username"]) return true;
  if (staffPwLegacy && provided === staffPwLegacy) return true;

  const username = req.headers["x-staff-username"];
  const password = req.headers["x-staff-password"];
  if (username && password) {
    const crypto = await import("crypto");
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        return perms.paylasimlar === true || perms.uyelikler === true;
      }
    }
  }
  return false;
}

function stokDegistirDahili(data, clientId, tur, delta) {
  const key = stokAnahtari(clientId, tur);
  const mevcut = (data.stoklar || {})[key] || 0;
  const yeni = Math.max(0, mevcut + delta);
  data.stoklar = { ...(data.stoklar || {}), [key]: yeni };
  return yeni;
}

function gecmiseEkle(data, clientId, marka, tur, tip) {
  const liste = data.paylasimGecmisi || [];
  data.paylasimGecmisi = [...liste, { id: nid(), clientId, marka, tur, tip, tarih: bugunTR() }];
}

/** Her kayıtta ana veriyi VE o günün yedeğini birlikte yazar — bu uç nokta üzerinden yapılan
 * (stok/paylaşım/haftalık plan/şube/günlük kontrol) değişiklikler daha önce günlük yedeğe hiç
 * dahil edilmiyordu, bu da bu verinin bir "bu tarihe dön" işleminde kaybolabileceği anlamına geliyordu. */
async function kaydetVeYedekle(data) {
  // Ortak yazma katmanı: versiyon sayacını artırır, günlük + saatlik yedeği yazar.
  // Sayacın artması kritik — eskiden bu uç noktadan yapılan stok/plan değişiklikleri
  // sayacı artırmadığı için, açık duran bir yönetici sekmesi bunların üzerine yazabiliyordu.
  await guvenliYaz(data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });

  // Tüm işlem (oku → değiştir → yaz) kilit altında yapılır: iki personel aynı anda
  // stok işaretlediğinde birinin değişikliği diğerini silmesin.
  const kilitAlindi = await kilitAl();
  try {
    const body = req.body || {};
    const { action } = body;
    const data = (await kv.get(KEY)) || {};
    const clients = data.clients || [];
    const markaAdi = (clientId) => (clients.find((c) => c.id === clientId) || {}).ad || "";

    if (action === "stokDegistir") {
      const { clientId, tur, delta } = body;
      stokDegistirDahili(data, clientId, tur, delta);
      gecmiseEkle(data, clientId, markaAdi(clientId), tur, delta < 0 ? "paylasim" : "cekim");
      // Paylaşımlar'dan "Paylaşıldı" ile bir şey paylaşıldıysa, Günlük Kontrol paneli de
      // bunu bugün için otomatik "yapıldı" işaretlesin — iki panel birbirinden habersiz
      // ilerleyip birbiriyle çelişen bir görünüm vermesin.
      if (delta < 0) {
        const bugun = bugunISO();
        const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
        const itemKey = `${clientId}_${tur}`;
        if (!kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: [...kontrol.yapilanlar, itemKey] };
        }
      }
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, stoklar: data.stoklar, paylasimGecmisi: data.paylasimGecmisi, gunlukKontrol: data.gunlukKontrol });
    }

    if (action === "haftalikEkle") {
      const { clientId, gun, haftaKey, tur } = body;
      const liste = data.haftalikPaylasimlar || [];
      const yeni = { id: nid(), clientId, gun, haftaKey, tur, yapildi: false, yapildigiTarih: null };
      data.haftalikPaylasimlar = [...liste, yeni];
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, haftalikPaylasimlar: data.haftalikPaylasimlar });
    }

    /* Planlanan bir paylaşımın ALT METNİ (caption). Müşteri panelinde gösterilir, böylece
     * müşteri neyin ne zaman, hangi metinle paylaşılacağını önceden görebilir. */
    if (action === "haftalikAltMetin") {
      const { planId, altMetin } = body;
      const liste = data.haftalikPaylasimlar || [];
      if (!liste.some((p) => p.id === planId)) return res.status(404).json({ error: "Plan bulunamadı." });
      data.haftalikPaylasimlar = liste.map((p) => (p.id === planId ? { ...p, altMetin: (altMetin || "").trim() || null } : p));
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, haftalikPaylasimlar: data.haftalikPaylasimlar });
    }

    if (action === "haftalikSil") {
      const { planId } = body;
      const silinen = (data.haftalikPaylasimlar || []).find((p) => p.id === planId);
      data.haftalikPaylasimlar = (data.haftalikPaylasimlar || []).filter((p) => p.id !== planId);
      // Silinen plan "yapıldı" işaretliyse, o an Günlük Kontrol'de duran kaydı da temizlenir.
      // (Hangi güne planlandığına bakan bir kontrol denemiştik ama saat dilimi hesaplamasına
      // bağımlı olduğu için kırılgandı — silme her zaman geçerli bir "geri al" sinyalidir,
      // basit ve güvenilir olsun diye o kontrolü kaldırdık.) Aynı marka+tür için başka
      // işaretli bir plan daha varsa (gün fark etmeksizin), o hâlâ geçerli sayılır, kaldırmayız.
      if (silinen && silinen.yapildi) {
        const bugun = bugunISO();
        const itemKey = `${silinen.clientId}_${silinen.tur}`;
        const baskaIsaretliPlanVarMi = data.haftalikPaylasimlar.some(
          (p) => p.clientId === silinen.clientId && p.tur === silinen.tur && p.yapildi === true
        );
        if (!baskaIsaretliPlanVarMi && data.gunlukKontrol && data.gunlukKontrol.tarih === bugun && data.gunlukKontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: data.gunlukKontrol.yapilanlar.filter((k) => k !== itemKey) };
        }
      }
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, haftalikPaylasimlar: data.haftalikPaylasimlar, gunlukKontrol: data.gunlukKontrol });
    }

    if (action === "haftalikToggle") {
      const { planId } = body;
      const liste = data.haftalikPaylasimlar || [];
      const plan = liste.find((p) => p.id === planId);
      if (!plan) return res.status(404).json({ error: "Plan bulunamadı — sayfayı yenileyip tekrar dene." });
      const yeniYapildi = !plan.yapildi;
      data.haftalikPaylasimlar = liste.map((p) => (p.id === planId ? { ...p, yapildi: yeniYapildi, yapildigiTarih: yeniYapildi ? bugunTR() : null } : p));
      stokDegistirDahili(data, plan.clientId, plan.tur, yeniYapildi ? -1 : 1);
      gecmiseEkle(data, plan.clientId, markaAdi(plan.clientId), plan.tur, yeniYapildi ? "paylasim" : "cekim");
      // Haftalık Plan'dan bir paylaşım "yapıldı" işaretlenince/geri alınınca, Günlük Kontrol
      // paneli de bunu otomatik yansıtır. (Önceden "sadece bugüne aitse" diye ek bir kontrol
      // vardı ama saat dilimi hesaplamasına bağımlı olduğu için kırılgandı ve bazen hiç
      // yansımamasına yol açıyordu — kaldırıldı, basit ve güvenilir olsun istiyoruz.)
      const bugun = bugunISO();
      const itemKey = `${plan.clientId}_${plan.tur}`;
      const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
      if (yeniYapildi) {
        if (!kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: [...kontrol.yapilanlar, itemKey] };
        }
      } else {
        // Aynı marka+tür için başka işaretli bir plan daha varsa (gün fark etmeksizin),
        // o hâlâ geçerli sayılır, Günlük Kontrol'den kaldırmayız.
        const baskaIsaretliPlanVarMi = data.haftalikPaylasimlar.some(
          (p) => p.id !== planId && p.clientId === plan.clientId && p.tur === plan.tur && p.yapildi === true
        );
        if (!baskaIsaretliPlanVarMi && kontrol.yapilanlar.includes(itemKey)) {
          data.gunlukKontrol = { tarih: bugun, yapilanlar: kontrol.yapilanlar.filter((k) => k !== itemKey) };
        }
      }
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, haftalikPaylasimlar: data.haftalikPaylasimlar, stoklar: data.stoklar, paylasimGecmisi: data.paylasimGecmisi, gunlukKontrol: data.gunlukKontrol });
    }

    if (action === "gunlukToggle") {
      const { clientId, tur } = body;
      const bugun = bugunISO();
      const kontrol = data.gunlukKontrol && data.gunlukKontrol.tarih === bugun ? data.gunlukKontrol : { tarih: bugun, yapilanlar: [] };
      const itemKey = `${clientId}_${tur}`;
      const varMi = kontrol.yapilanlar.includes(itemKey);
      const yeniYapilanlar = varMi ? kontrol.yapilanlar.filter((k) => k !== itemKey) : [...kontrol.yapilanlar, itemKey];
      data.gunlukKontrol = { tarih: bugun, yapilanlar: yeniYapilanlar };
      stokDegistirDahili(data, clientId, tur, varMi ? 1 : -1);
      gecmiseEkle(data, clientId, markaAdi(clientId), tur, varMi ? "cekim" : "paylasim");
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, gunlukKontrol: data.gunlukKontrol, stoklar: data.stoklar, paylasimGecmisi: data.paylasimGecmisi });
    }

    // ŞUBELER: bir markanın birden fazla şubesi/lokasyonu varsa her biri kendi adıyla
    // eklenir. Şube stoğu değiştirildiğinde HEM o şubenin kendi stoğu HEM de markanın
    // genel (toplam) stoğu aynı anda güncellenir — böylece Günlük Kontrol, Haftalık Plan
    // ve bildirimler gibi diğer tüm bölümler hiçbir değişiklik gerekmeden doğru toplamı görür.
    if (action === "subeEkle") {
      const { clientId, ad } = body;
      if (!ad || !ad.trim()) return res.status(400).json({ error: "Şube adı gerekli." });
      const liste = data.subeler || [];
      const yeni = { id: nid(), clientId, ad: ad.trim() };
      data.subeler = [...liste, yeni];
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, subeler: data.subeler });
    }

    if (action === "subeSil") {
      const { subeId } = body;
      data.subeler = (data.subeler || []).filter((s) => s.id !== subeId);
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, subeler: data.subeler });
    }

    if (action === "subeStokDegistir") {
      const { clientId, subeId, tur, delta } = body;
      const sube = (data.subeler || []).find((s) => s.id === subeId);
      const subeAdi = sube ? sube.ad : "";
      const subeKey = `${clientId}_${subeId}_${tur}`;
      const mevcutSube = (data.stoklar || {})[subeKey] || 0;
      const yeniSube = Math.max(0, mevcutSube + delta);
      data.stoklar = { ...(data.stoklar || {}), [subeKey]: yeniSube };
      // Genel (toplam) stok da aynı miktarda değişir.
      stokDegistirDahili(data, clientId, tur, delta);
      gecmiseEkle(data, clientId, `${markaAdi(clientId)}${subeAdi ? " (" + subeAdi + ")" : ""}`, tur, delta < 0 ? "paylasim" : "cekim");
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, stoklar: data.stoklar, paylasimGecmisi: data.paylasimGecmisi });
    }

    if (action === "uyelikEkle") {
      const { uyelik } = body;
      const liste = data.uyelikler || [];
      const yeni = { ...uyelik, id: nid() };
      data.uyelikler = [...liste, yeni];
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, uyelikler: data.uyelikler });
    }

    if (action === "uyelikGuncelle") {
      const { uyelikId, patch } = body;
      data.uyelikler = (data.uyelikler || []).map((u) => (u.id === uyelikId ? { ...u, ...patch } : u));
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, uyelikler: data.uyelikler });
    }

    if (action === "uyelikSil") {
      const { uyelikId } = body;
      data.uyelikler = (data.uyelikler || []).filter((u) => u.id !== uyelikId);
      await kaydetVeYedekle(data);
      return res.status(200).json({ ok: true, uyelikler: data.uyelikler });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  } finally {
    await kilitBirak(kilitAlindi);
  }
}
