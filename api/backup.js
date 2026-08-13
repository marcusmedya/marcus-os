import { kv } from "@vercel/kv";
import { KEY as MAIN_KEY, guvenliYaz, kilitAl, kilitBirak } from "../lib/kv-yaz.js";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { deftereYaz } from "../lib/kv-yaz.js";

const PREFIX = "marcus-os-snapshot-";
const SAATLIK_PREFIX = "marcus-os-saatlik-";
const GERI_ALMA_PREFIX = "marcus-os-geri-alma-";

async function checkAuth(req, res) {
  const required = process.env.SITE_PASSWORD;
  if (!required) return true;
  // Oturum anahtarı ya da şifre — ikisi de kabul edilir (bkz. lib/oturum.js).
  if (await ownerYetkiliMi(req)) return true;
  res.status(401).json({ error: "Yetkisiz. Şifre gerekli." });
  return false;
}

/** Bir yedeğin içeriğine bakmadan, kaç kayıt içerdiğini özetler — geri yüklemeden ÖNCE
 * "bu yedekte kaç müşteri var?" sorusunu cevaplayabilmek için. Yanlış tarihe dönmenin
 * en yaygın sebebi, yedeğin içinde ne olduğunu görmeden karar vermekti. */
function ozetle(veri) {
  if (!veri) return null;
  const say = (alan) => (Array.isArray(veri[alan]) ? veri[alan].length : 0);
  return {
    musteri: say("clients"),
    personel: say("personel"),
    cekimIsleri: say("cekimIsleri"),
    uyelikler: say("uyelikler"),
    teklifler: say("teklifler"),
    _v: typeof veri._v === "number" ? veri._v : null,
  };
}

/** Verilen anahtarın gerçekten bir yedek anahtarı olduğunu doğrular — dışarıdan
 * rastgele bir anahtarın okunmasını/yazılmasını engeller. */
function gecerliYedekAnahtari(anahtar) {
  if (typeof anahtar !== "string") return false;
  return anahtar.startsWith(PREFIX) || anahtar.startsWith(SAATLIK_PREFIX) || anahtar.startsWith(GERI_ALMA_PREFIX);
}

export default async function handler(req, res) {
  if (!(await checkAuth(req, res))) return;
  try {
    if (req.method === "GET") {
      const { date, key, ozet } = req.query || {};

      // Tek bir yedeğin İÇERİĞİNİ ya da ÖZETİNİ döner.
      if (date || key) {
        const anahtar = key || `${PREFIX}${date}`;
        if (!gecerliYedekAnahtari(anahtar)) return res.status(400).json({ error: "Geçersiz yedek anahtarı." });
        const snapshot = await kv.get(anahtar);
        if (!snapshot) return res.status(404).json({ error: "Bu yedek bulunamadı." });
        if (ozet) return res.status(200).json({ ozet: ozetle(snapshot) });
        return res.status(200).json({ data: snapshot });
      }

      // Tüm yedek listeleri: günlük, saatlik (son 48 saat) ve geri yükleme öncesi kopyalar.
      const [gunlukKeys, saatlikKeys, geriAlmaKeys] = await Promise.all([
        kv.keys(`${PREFIX}*`),
        kv.keys(`${SAATLIK_PREFIX}*`),
        kv.keys(`${GERI_ALMA_PREFIX}*`),
      ]);
      const dates = gunlukKeys.map((k) => k.replace(PREFIX, "")).sort().reverse();
      const saatlikler = saatlikKeys.map((k) => k.replace(SAATLIK_PREFIX, "")).sort().reverse();
      const geriAlmalar = geriAlmaKeys.map((k) => k.replace(GERI_ALMA_PREFIX, "")).sort().reverse();
      return res.status(200).json({ dates, saatlikler, geriAlmalar });
    }

    if (req.method === "POST") {
      const { date, key } = req.body || {};
      const anahtar = key || (date ? `${PREFIX}${date}` : null);
      if (!anahtar) return res.status(400).json({ error: "Hangi yedeğe dönüleceği belirtilmedi." });
      if (!gecerliYedekAnahtari(anahtar)) return res.status(400).json({ error: "Geçersiz yedek anahtarı." });

      const snapshot = await kv.get(anahtar);
      if (!snapshot) return res.status(404).json({ error: "Bu yedek bulunamadı." });

      const kilitAlindi = await kilitAl();
      try {
        // EN ÖNEMLİ KISIM: geri yüklemeden ÖNCE mevcut verinin tam bir kopyasını ayrı bir
        // anahtara alıyoruz. Eskiden bu yapılmıyordu — yanlış tarihe dönüp sonra biri bir
        // şey kaydettiğinde, o günün yedeği de eski veriyle eziliyor ve geri yükleme
        // öncesindeki hâl KALICI olarak kayboluyordu. Bu kopya 30 gün saklanır ve
        // Ayarlar'daki listeden tek tıkla geri dönülebilir.
        const mevcut = await kv.get(MAIN_KEY);
        let geriAlmaEtiketi = null;
        if (mevcut) {
          geriAlmaEtiketi = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          await kv.set(`${GERI_ALMA_PREFIX}${geriAlmaEtiketi}`, mevcut, { ex: 60 * 60 * 24 * 30 });
        }

        // Geri yüklenen veri, mevcut versiyon sayacının ÜSTÜNDEN devam eder. Böylece açık
        // duran sekmeler bayat kaldıklarını anlayıp çakışma uyarısı verir; sayaç geriye
        // giderse bu tespit karışabilirdi.
        const mevcutV = mevcut && typeof mevcut._v === "number" ? mevcut._v : 0;
        const snapshotV = typeof snapshot._v === "number" ? snapshot._v : 0;
        const yazilan = await guvenliYaz({ ...snapshot, _v: Math.max(mevcutV, snapshotV) });

        // Geri yükleme en kritik işlemlerden biri — veriyi tamamen değiştirir.
        await deftereYaz("yedek-geri-yuklendi", { kaynak: anahtar, geriAlmaEtiketi, ozet: ozetle(yazilan) });
        return res.status(200).json({ ok: true, _v: yazilan._v, geriAlmaEtiketi, ozet: ozetle(yazilan) });
      } finally {
        await kilitBirak(kilitAlindi);
      }
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
