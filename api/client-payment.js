import { kv } from "@vercel/kv";
import { KEY, guvenliGuncelle } from "../lib/kv-yaz.js";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";

const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Owner her zaman yetkili. Personel ise "odemeTakvimi" iznine (ya da onunla örtüşen finans/müşteri
 * izinlerinden birine) sahipse yetkilidir — bu izinler aynı veriyi paylaştığı için. */
async function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  const staffPwLegacy = process.env.STAFF_PASSWORD;
  const provided = baslikOku(req, "x-site-password");
  if (await ownerYetkiliMi(req)) return true;
  if (!ownerPw && !staffPwLegacy && !baslikOku(req, "x-staff-username")) return true;
  if (staffPwLegacy && provided === staffPwLegacy) return true;

  const username = baslikOku(req, "x-staff-username");
  const password = baslikOku(req, "x-staff-password");
  if (username && password) {
    const crypto = await import("crypto");
    const data = await kv.get(KEY);
    const hesap = ((data && data.personelHesaplari) || []).find((h) => h.kullaniciAdi === username);
    if (hesap) {
      const hash = crypto.scryptSync(password, hesap.sifreSalt, 64).toString("hex");
      if (hash === hesap.sifreHash) {
        /* MARKA KİLİDİ: kilitli hesaplar (dışarıdan çalışan iş ortağı gibi) bu uç noktayı
         * HİÇ kullanamaz. Buradaki veri ödeme kayıtları — finansal iç bilgi. Kilitli hesabın
         * zaten odemeTakvimi/musteriler/finans izinleri de kapatılıyor; bu, izin ayarı yanlış
         * yapılsa bile ikinci bir emniyet. (Test sırasında kilitli hesabın başka markanın
         * ödeme kaydını değiştirebildiği doğrulandı.) */
        if (Array.isArray(hesap.markalar) && hesap.markalar.length > 0) return false;
        const perms = hesap.izinler || (data && data.staffPermissions) || {};
        return perms.odemeTakvimi === true || perms.musteriler === true || perms.finans === true || perms.dashboard === true;
      }
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!(await yetkiliMi(req))) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { action, clientId, kayit, kayitId, odemeGunu, fatura, faturaId, islemId } = req.body || {};
    if (!clientId) return res.status(400).json({ error: "clientId gerekli." });
    if (action === "addKaydi" && (!kayit || !kayit.tutar)) return res.status(400).json({ error: "Geçerli bir ödeme kaydı gerekli." });
    if (action === "deleteKaydi" && !kayitId) return res.status(400).json({ error: "kayitId gerekli." });
    /* FATURA KAYDI. Ay zorunlu: ekstre ay bazlı, aysız bir fatura hiçbir satıra
     * düşmez ve sessizce kaybolur. Tutar zorunlu değil (0 ₺ fatura yok ama
     * kullanıcı önce numarayı girip tutarı sonra düzeltebilsin diye esnek değil —
     * tutarsız fatura ekstrede yanlış belgeleme oranı gösterirdi). */
    if (action === "addFatura" && (!fatura || !fatura.ay || !fatura.tutar)) {
      return res.status(400).json({ error: "Fatura için ay ve tutar gerekli." });
    }
    if (action === "deleteFatura" && !faturaId) return res.status(400).json({ error: "faturaId gerekli." });

    /* Kilit altında, en güncel veri okunarak yapılır ve versiyon sayacını artırır —
     * böylece bu ödeme kaydı, açık duran başka bir sekme tarafından ezilemez.
     *
     * İŞLEM KİMLİĞİ: bu uçtaki işlemler FARK bildirimi ("kayıt ekle", "kayıt sil").
     * Ölçüldü: aynı istek iki kez gidince ödeme kaydı İKİ KEZ ekleniyordu — internet
     * kesilip istek tekrarlandığında ya da iki kez tıklandığında. Para söz konusu
     * olduğu için sessiz tekrarın en pahalı olduğu yerlerden biri.
     *
     * Kontrol guvenliGuncelle'nin İÇİNDE, yazmayla aynı kilitte yapılıyor. */
    const sonuc = await guvenliGuncelle(async (data) => {
      const clients = data.clients || [];
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx === -1) return { iptal: true, kod: 404, hata: "Müşteri bulunamadı — sayfayı yenileyip tekrar dene." };

      const client = { ...clients[idx] };
      if (action === "addKaydi") {
        client.odemeKayitlari = [...(client.odemeKayitlari || []), { ...kayit, id: nid() }];
      } else if (action === "deleteKaydi") {
        client.odemeKayitlari = (client.odemeKayitlari || []).filter((k) => k.id !== kayitId);
      } else if (action === "addFatura") {
        client.faturalar = [...(client.faturalar || []), {
          id: nid(),
          ay: String(fatura.ay).trim(),
          no: String(fatura.no || "").trim(),
          tarih: String(fatura.tarih || "").trim(),
          tutar: Number(fatura.tutar) || 0,
          not: String(fatura.not || "").trim(),
        }];
      } else if (action === "deleteFatura") {
        client.faturalar = (client.faturalar || []).filter((f) => f.id !== faturaId);
      } else if (action === "setOdemeGunu") {
        client.odemeGunu = odemeGunu || null;
      } else {
        return { iptal: true, kod: 400, hata: "Geçersiz işlem." };
      }

      const yeniClients = [...clients];
      yeniClients[idx] = client;
      return { veri: { ...data, clients: yeniClients }, ek: { client } };
    }, { islemId });

    if (!sonuc.ok) return res.status(sonuc.kod || 400).json({ error: sonuc.hata || "İşlem yapılamadı." });
    /* Tekrar edilen istekte `ek` ilk seferki hâliyle geliyor; müşteri kaydı da güncel
     * veriden okunuyor. İkinci kez uygulanan bir şey yok. */
    return res.status(200).json({
      ok: true, client: sonuc.ek && sonuc.ek.client, _v: sonuc.veri._v,
      ...(sonuc.tekrarlandi ? { tekrarlandi: true } : {}),
    });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
