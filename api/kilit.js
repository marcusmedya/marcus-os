import { kv } from "@vercel/kv";

// Herhangi bir kayıt türü için (müşteri, personel, reklam, iş, marka vb.) kullanılabilecek
// genel amaçlı "düzenleme kilidi". Gerçek bir veri kaybı önleyicisi DEĞİL (o korumalar zaten
// var) — amaç sadece "şu an bu kaydı başka biri de açmış" diye ERKEN UYARI vermek, böylece iki
// kişi aynı anda aynı kaydı değiştirip birbirinin işini ezme riskini fark edip konuşabilsin.
// Kilitler KV'de kısa ömürlü (TTL'li) tutulur — tarayıcı kapansa/çöksе bile kısa sürede
// kendiliğinden düşer, kalıcı bir "kilitli kaldı" durumu oluşmaz.

const KILIT_TTL_SN = 90; // düzenleme ekranı açık olduğu sürece ön yüz bunu periyodik tazeler

function yetkiliMi(req) {
  const ownerPw = process.env.SITE_PASSWORD;
  if (!ownerPw) return true;
  if (req.headers["x-site-password"] === ownerPw) return true;
  // Personel de kullanabilmeli — bu uç nokta hassas veri döndürmüyor (sadece "kim düzenliyor"
  // bilgisi), o yüzden kullanıcı adı/şifre çiftinin varlığını (dolu olmasını) yeterli sayıyoruz;
  // asıl veri koruması zaten /api/data ve ilgili uç noktalarda.
  if (req.headers["x-staff-username"] && req.headers["x-staff-password"]) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST kabul edilir." });
  if (!yetkiliMi(req)) return res.status(401).json({ error: "Yetkisiz." });

  try {
    const { action, tur, id, kisi } = req.body || {};
    if (!tur || !id) return res.status(400).json({ error: "tur ve id gerekli." });
    const key = `marcus-os-kilit:${tur}:${id}`;

    if (action === "al") {
      const mevcut = await kv.get(key);
      if (mevcut && mevcut.kisi && mevcut.kisi !== kisi) {
        // Başka biri zaten düzenliyor — kilidi ELE GEÇİRME, sadece bildir.
        return res.status(200).json({ kilitli: true, kilitleyen: mevcut.kisi });
      }
      // Boşsa ya da zaten kendisi tutuyorsa, kilidi (yeniden) TTL ile ayarla.
      await kv.set(key, { kisi, zaman: Date.now() }, { ex: KILIT_TTL_SN });
      return res.status(200).json({ kilitli: false });
    }

    if (action === "birak") {
      const mevcut = await kv.get(key);
      // Sadece kendi kilidini bırakabilir — başkasının kilidini yanlışlıkla silmesin.
      if (mevcut && mevcut.kisi === kisi) await kv.del(key);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Geçersiz işlem." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
