import { kv } from "@vercel/kv";
import {
  KEY as MAIN_KEY, guvenliYaz, kilitAl, kilitBirak, mesgulYanit,
  bugunISO, belgeOkunabilirMi, BOZUK_KOD, BOZUK_MESAJI,
} from "../lib/kv-yaz.js";
import { yedekDegerlendir } from "../lib/yedek-dogrula.js";
import { ownerYetkiliMi, baslikOku } from "../lib/oturum.js";
import { kayitliYanit, yanitiSakla } from "../lib/islem-kimligi.js";
import { deftereYaz } from "../lib/kv-yaz.js";

const PREFIX = "marcus-os-snapshot-";
const SAATLIK_PREFIX = "marcus-os-saatlik-";
const GERI_ALMA_PREFIX = "marcus-os-geri-alma-";

async function checkAuth(req, res) {
  const required = process.env.SITE_PASSWORD;
  /* KAPALI DÜŞÜYOR — ESKİDEN AÇIK DÜŞÜYORDU (denetim bulgusu).
   *
   * Burada "yapılandırma eksikse izin ver" vardı. Ölçüldü: SITE_PASSWORD tanımsızken bu uç
   * kimliksiz isteklere yanıt veriyordu. Üretimde değişken tanımlı olduğu için gizli
   * kalmıştı; ama değişken silinirse, yeni bir ortam (önizleme dağıtımı) açılırsa ya da
   * yanlış girilirse sistem halka açılıyordu.
   *
   * Yapılandırma eksikse artık kimse giremiyor. Kilitlenme riski yok: çözüm tek bir ortam
   * değişkeni tanımlamak ve eksiklik ekranda ayrıca bildiriliyor. */
  if (!required) return false;
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

/** Elle yedeğin anahtarına eklenen saat-dakika damgası (Europe/Istanbul — `bugunISO`
 * ile aynı saat dilimi, yoksa tarih ile saat farklı günleri gösterebilirdi).
 *
 * DAKİKA ÇÖZÜNÜRLÜĞÜ BİLİNÇLİ: aynı dakika içinde ikinci kez basılırsa iki kayıt aynı
 * anahtara düşer ve tek bir noktaya iner. Saniyeler arayla alınmış iki "güvenlik noktası"
 * pratikte aynı noktadır; anahtarı uzatmanın karşılığı yok. */
function elleDamgasi() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const al = (t) => String(p.find((x) => x.type === t).value).padStart(2, "0");
  return `${al("hour")}${al("minute")}`;
}

/** Elle alınan yedeklerin anahtarındaki işaret. `PREFIX` ile aynı ailede kalır ki
 * `gecerliYedekAnahtari`, `kv.keys(PREFIX*)` listelemesi ve geri yükleme DEĞİŞMEDEN
 * çalışsın; arayüz bu işaretten "elle alındı" etiketini üretir. */
const ELLE_ISARETI = "-elle-";

/** Elle yedeğin saklama süresi: 30 gün — günlük yedeklerin belgelenmiş ömrüyle aynı.
 *
 * NEDEN AÇIK TTL: günlük anahtarları `api/data.js` içindeki 30 günlük süpürücü siliyor ve
 * o süpürücü adın tarih kısmını `new Date(d)` ile ayrıştırıyor. Elle anahtarı
 * ("2026-09-21-elle-1432") `Invalid Date` veriyor, karşılaştırma `false` dönüyor ve kayıt
 * ASLA silinmiyordu — ölçüldü. Süpürücüye güvenmek yerine ömrü burada açıkça yazılıyor. */
const ELLE_OMRU_SN = 60 * 60 * 24 * 30;

/**
 * ELLE YEDEK AL — belgenin o anki hâlini AYRI, EZİLMEYEN bir anahtara yazar.
 *
 * BU FONKSİYON BİR KUSURDAN GEÇTİ, sebebi burada yazıyor. İlk sürüm yedeği günün otomatik
 * anahtarına (`marcus-os-snapshot-<bugun>`) yazıyordu. Ama `guvenliYaz` HER güvenli
 * yazmada zaten oraya yazıyor (`lib/kv-yaz.js`): düğmeye basmak, son kaydın oraya koyduğu
 * içeriği aynı anahtara tekrar yazmaktan ibaretti ve **yeni bir geri dönüş noktası
 * oluşmuyordu.** Kullanıcı "riskli işlemden önce güvenlik noktası aldım" sanıyor, oysa
 * elinde zaten var olandan başka bir şey yok — bundan sonraki İLK kayıt o noktayı eziyor.
 * Etiketinin vaat ettiğini yapmayan bir özellikti.
 *
 * Anahtar artık `marcus-os-snapshot-<YYYY-AA-GG>-elle-<SSDD>`. `PREFIX` ile başladığı için
 * listeleme, anahtar doğrulaması ve geri yükleme yolları DEĞİŞMEDEN çalışıyor (t114 bunu
 * ayrıca sınıyor) — ama artık hiçbir otomatik yazma onun üstüne gelmiyor.
 *
 * DÖRT KURAL, hepsi bu projenin ölçtüğü hatalardan geliyor:
 *
 *  1. KİLİT İÇİNDE OKU. Kilitsiz okuma, "oku → değiştir → yaz" döngüsünün ortasındaki bir
 *     ara hâli yakalayabilir; o hâli yedek diye dondurmak, geri yüklendiğinde yarım bir
 *     belge üretirdi. Kilit alınamazsa yedek ALINMAZ (503 + `mesgul`), tarayıcı tekrar
 *     dener (`lib/mesgul-tekrar.js`).
 *  2. İŞLEM KİMLİĞİ KİLİDİN İÇİNDE KONTROL EDİLİR ve YALNIZCA gerçekten yazıldıysa
 *     işaretlenir (`lib/islem-kimligi.js`). Dışarıda kontrol edilseydi iki hızlı tık
 *     aynı anda "görmedim" cevabı alırdı. 503'te kimlik YAZILMAZ — yazılsaydı otomatik
 *     tekrar "bunu zaten yaptım" sanılır ve yedek hiç alınmazdı.
 *  3. YAN ETKİ TEKRARDA ÇALIŞMAZ. Tekrarlanan istek ne ikinci bir anlık görüntü yazar ne
 *     de güvenlik defterine ikinci bir satır düşer; ilk seferki yanıt `tekrarlandi: true`
 *     ile döner.
 *  4. ANA BELGEYE YAZILMAZ. `guvenliYaz`/`guvenliGuncelle` çağrılmıyor: `_v` artsaydı o
 *     anda açık olan her sekme kendini bayat sanardı. Yedek almak kimsenin işini bölmemeli.
 *
 * BOZUK BELGE YEDEKLENMEZ: `kv.get` metin/dizi/sayı döndürebiliyor (`belgeOkunabilirMi`).
 * Böyle bir "yedek" listede sağlam görünür, geri yüklenmek istendiğinde reddedilir ve
 * kullanıcı gerçekten sağlam olan kopyayı aramak yerine ona güvenir.
 */
async function yedekAl(req, res, govde) {
  /* YALNIZCA YÖNETİCİ — kapı bu fonksiyonda DEĞİL, ucun girişinde: `handler` ilk satırda
   * `checkAuth`tan geçiyor ve o da `ownerYetkiliMi` dışında kimseyi içeri almayıp 401
   * döndürüyor (bu dosyanın en üstü). Burada ikinci bir 403 dalı vardı; `checkAuth`
   * yüzünden ASLA çalışmıyordu, yani hiçbir test onu düşüremiyordu. Ölçülemeyen savunma
   * kodu bu projede yük olduğu için kaldırıldı — kapı gevşetilecekse orada gevşetilir ve
   * denetimi orada yapılır. t114 yetkisiz isteğin reddedildiğini ve hiçbir şey
   * yazılmadığını ayrıca ölçüyor. */
  const islemId = govde.islemId || null;

  const kilitAlindi = await kilitAl();
  if (!kilitAlindi) return mesgulYanit(res);
  try {
    if (islemId) {
      const kayitli = await kayitliYanit(islemId);
      /* Aynı işlem: hiçbir şey yazılmıyor, defter satırı düşmüyor, ilk yanıt dönüyor. */
      if (kayitli) return res.status(kayitli.kod).json({ ...kayitli.yanit, tekrarlandi: true });
    }

    const mevcut = await kv.get(MAIN_KEY);
    if (!belgeOkunabilirMi(mevcut)) {
      return res.status(BOZUK_KOD).json({ error: BOZUK_MESAJI });
    }
    if (!mevcut) {
      return res.status(400).json({
        error: "Yedeklenecek veri yok — veritabanında henüz bir belge oluşmamış. "
          + "Bir kayıt girdikten sonra tekrar dene.",
      });
    }

    const anahtar = `${PREFIX}${bugunISO()}${ELLE_ISARETI}${elleDamgasi()}`;
    await kv.set(anahtar, mevcut, { ex: ELLE_OMRU_SN });

    const yanit = { ok: true, yedekAnahtari: anahtar, yedekOzeti: ozetle(mevcut) };
    /* Defter satırı gece yedeğinden AYIRT EDİLEBİLİR bir türle düşüyor: "bu kopya kimin
     * kararıyla, ne zaman alındı" sorusunun cevabı yoksa yedek listesi yalnızca tarih
     * gösterir. Defter yazımı `deftereYaz` içinde sessizce yutuluyor (kayıt tutmak asıl
     * işi engellememeli) — yedek yine de alınmış olur. */
    await deftereYaz("yedek-elle-alindi", { anahtar, ozet: yanit.yedekOzeti });
    if (islemId) await yanitiSakla(islemId, 200, yanit);
    return res.status(200).json(yanit);
  } finally {
    await kilitBirak(kilitAlindi);
  }
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
        if (ozet) {
          /* KARARDAN ÖNCE UYARI. Özet "bu yedekte kaç müşteri var" diyordu ama "bu
           * yedeğe dönersem NE KAYBEDERİM" sorusunu cevaplamıyordu. Değerlendirme
           * mevcut veriyle karşılaştırıp yapı hatalarını ve kayıp kalemlerini de
           * döndürüyor — hiçbir şey yazmadan. */
          const mevcutVeri = await kv.get(MAIN_KEY);
          return res.status(200).json({
            ozet: ozetle(snapshot),
            degerlendirme: yedekDegerlendir(snapshot, mevcutVeri),
          });
        }
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
      const govde = req.body || {};

      /* ── ELLE YEDEK ALMA ────────────────────────────────────────────────────────
       *
       * NEDEN GEREKTİ: yedekler yalnızca yazma anında (`guvenliYaz` → günlük + saatlik)
       * ve gece cron'undan (`api/daily-backup.js` → e-posta) oluşuyordu. Riskli bir işten
       * HEMEN ÖNCE bilerek bir durak koymanın yolu yoktu; kullanıcı ancak bir kayıt
       * yaparak yedek üretebiliyordu — yani yedek almak için veriyi değiştirmek gerekiyordu.
       *
       * ANAHTAR ŞEMASI UYDURULMADI: gece yedeğiyle aynı — `marcus-os-snapshot-<YYYY-AA-GG>`
       * (`lib/kv-yaz.js` → `guvenliYaz`, `bugunISO`). Ayrı bir şema, Ayarlar'daki listenin
       * (`YedekGecmisi`) görmediği ve geri yüklenemeyen bir kopya üretirdi.
       *
       * YENİ UÇ AÇILMADI — 11/12 dolu (`CLAUDE.md` §1). Mevcut yedek ucuna bir action.
       *
       * ANA BELGEYE YAZMIYOR: `guvenliYaz`/`guvenliGuncelle` çağrılmıyor. Çağrılsaydı `_v`
       * boşuna artar ve o anda açık olan her sekme kendini bayat sanardı — yedek almak
       * kimsenin işini bölmemeli. Yine de KİLİT alınıyor: kilitsiz okunan belge, yarım
       * kalmış bir yazmanın ortasından gelebilir ve yedek o hâli dondururdu. */
      if (govde.action === "yedekAl") return yedekAl(req, res, govde);

      const { date, key } = govde;
      const anahtar = key || (date ? `${PREFIX}${date}` : null);
      if (!anahtar) return res.status(400).json({ error: "Hangi yedeğe dönüleceği belirtilmedi." });
      if (!gecerliYedekAnahtari(anahtar)) return res.status(400).json({ error: "Geçersiz yedek anahtarı." });

      const snapshot = await kv.get(anahtar);
      if (!snapshot) return res.status(404).json({ error: "Bu yedek bulunamadı." });

      /* YAPI DOĞRULAMASI — YAZMADAN VE KİLİT ALMADAN ÖNCE.
       *
       * Buraya kadar yalnızca "yedek var mı" bakılıyordu. Yapısı bozuk bir yedek
       * (`clients` metin olmuş, yanlış anahtardan gelmiş bambaşka bir belge) doğrudan
       * üretime yazılıyordu. Kilit ve geri-alma kopyası bu durumda işe yaramıyor:
       * kopya da alınıyor, kilit de düzgün bırakılıyor — ama veri bozuluyor.
       *
       * Kilitten ÖNCE, çünkü reddedilecek bir istek için kilidi tutmak diğer
       * herkesi boşuna bekletir. */
      const on = yedekDegerlendir(snapshot, null);
      if (!on.gecerli) {
        return res.status(400).json({
          error: "Bu yedek geri yüklenemez — yapısı bozuk.",
          hatalar: on.hatalar,
        });
      }

      const kilitAlindi = await kilitAl();
      /* Geri yükleme, sistemdeki en tehlikeli yazma işlemi: tüm veriyi değiştirir.
       * Kilit alınamadıysa KESİNLİKLE yapılmaz — kilitsiz bir geri yükleme, o sırada
       * kaydeden herkesin işini sessizce silerdi. */
      if (!kilitAlindi) return mesgulYanit(res);
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
        /* Ne kaybedildiği DEFTERE de yazılıyor: "geri yüklendi" satırı tek başına
         * neyin gittiğini söylemiyordu. */
        const degerlendirme = yedekDegerlendir(snapshot, mevcut);
        await deftereYaz("yedek-geri-yuklendi", {
          kaynak: anahtar, geriAlmaEtiketi, ozet: ozetle(yazilan),
          kaybolanKayit: degerlendirme.kayip ? degerlendirme.kayip.toplamKaybolanKayit : null,
        });
        return res.status(200).json({
          ok: true, _v: yazilan._v, geriAlmaEtiketi, ozet: ozetle(yazilan),
          degerlendirme,
        });
      } finally {
        await kilitBirak(kilitAlindi);
      }
    }

    return res.status(405).json({ error: "Sadece GET/POST kabul edilir." });
  } catch (e) {
    return res.status(500).json({ error: "Sunucu hatası: " + e.message });
  }
}
