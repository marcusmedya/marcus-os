import crypto from "crypto";

/**
 * VİDEO ERİŞİM JETONU — KISA ÖMÜRLÜ, TEK DOSYALIK.
 *
 * NEDEN GEREKLİ: <video src="..."> etiketi özel başlık gönderemez. Uygulamanın kimlik
 * doğrulaması ise başlıklarla çalışıyor (x-site-password, x-staff-username-b64…). Yani
 * tarayıcı videoyu doğrudan bizim ucumuzdan çekemez — kimliğini kanıtlayamaz.
 *
 * Çözüm: kullanıcı önce NORMAL yolla (başlıklarla, yetkisi kontrol edilerek) bir jeton
 * alıyor; jeton adresin içine konuyor. Sunucu jetonu doğrulayıp videoyu akıtıyor.
 *
 * NEDEN DOSYAYI HERKESE AÇMIYORUZ: eskiden Drive klasörü "bağlantısı olan herkes
 * düzenleyebilir" ayarındaydı ve 17 müşterinin içeriği açıktaydı; bugün kısıtlandı. Videoyu
 * oynatmak için o ayarı geri açmak, kapatılan açığı geri getirirdi. Bu jeton onun yerine
 * geçiyor: TEK dosya için, KISA ömürlü, imzalı.
 *
 * İMZA ANAHTARI mevcut sırlardan türetiliyor — yeni bir ortam değişkeni istemek, kurulumda
 * atlanacak bir adım daha demek olurdu (bu projede tam olarak öyle bir adım atlandı ve
 * önizlemeler sessizce çalışmadı).
 */

const OMUR_SN = 2 * 60 * 60;   // 2 saat: bir içeriği izlemeye fazlasıyla yeter, kalıcı bağlantı olmaz

function anahtar() {
  const kaynak = process.env.SITE_PASSWORD || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!kaynak) return null;
  return crypto.createHash("sha256").update(`marcus-video-jeton:${kaynak}`).digest();
}

const b64u = (b) => Buffer.from(b).toString("base64url");

/** Jeton üretir. `kimlik` = kartın/içeriğin kimliği, `tur` = "is" | "icerik". */
export function jetonUret(tur, kimlik, simdi = Date.now()) {
  const gizli = anahtar();
  if (!gizli) return null;
  const biter = Math.floor(simdi / 1000) + OMUR_SN;
  const govde = `${tur}:${kimlik}:${biter}`;
  const imza = crypto.createHmac("sha256", gizli).update(govde).digest();
  return `${b64u(govde)}.${b64u(imza)}`;
}

/**
 * Jetonu doğrular. Geçerliyse { tur, kimlik } döner, değilse null.
 *
 * İMZA KARŞILAŞTIRMASI SABİT ZAMANLI: normal karşılaştırma, ilk farklı bayta kadar geçen
 * süreyi sızdırır ve imza bayt bayt tahmin edilebilir hale gelir.
 */
export function jetonCoz(jeton, simdi = Date.now()) {
  const gizli = anahtar();
  if (!gizli || typeof jeton !== "string") return null;
  const parcalar = jeton.split(".");
  if (parcalar.length !== 2) return null;
  let govde;
  let imza;
  try {
    govde = Buffer.from(parcalar[0], "base64url").toString("utf8");
    imza = Buffer.from(parcalar[1], "base64url");
  } catch (e) {
    return null;
  }
  const beklenen = crypto.createHmac("sha256", gizli).update(govde).digest();
  if (imza.length !== beklenen.length || !crypto.timingSafeEqual(imza, beklenen)) return null;

  const [tur, ...kalan] = govde.split(":");
  const biter = Number(kalan.pop());
  const kimlik = kalan.join(":");
  if (!tur || !kimlik || !Number.isFinite(biter)) return null;
  if (Math.floor(simdi / 1000) > biter) return null;    // süresi dolmuş
  return { tur, kimlik };
}
