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

/**
 * Jeton üretir. `kimlik` = kartın/içeriğin kimliği, `tur` = "is" | "icerik".
 *
 * DOSYA KİMLİĞİ DE JETONUN İÇİNDE (v2). Eskiden yalnızca kayıt kimliği vardı; video ucu
 * dosyanın Drive kimliğini bulmak için TÜM uygulama belgesini Redis'ten okumak zorundaydı.
 * O belge tek bir JSON ve içinde gömülü görseller var — megabaytlarca. Kullanıcı videoda
 * her ileri-geri sarışında tarayıcı YENİ bir istek atıyor, yani bu okuma her sarmada
 * yeniden yapılıyordu. Kimlik jetona konunca belge okuması tamamen kalkıyor.
 *
 * UYDURULAMAZ: gövdenin tamamı imzalanıyor, dosya kimliği de dahil. Jetonu alan kişi
 * zaten o kaydı görme yetkisi kontrol edilmiş kişidir.
 *
 * SÜRÜM ÖNEKİ (`2|`) geriye dönük uyumluluk için: ortalıkta hâlâ eski biçimde, iki saat
 * ömürlü jetonlar olabilir. Önek olmadan iki biçim birbirine karışırdı — eski jetonun
 * kayıt kimliği, yeni biçimde dosya kimliği sanılırdı.
 */
export function jetonUret(tur, kimlik, simdi = Date.now(), dosyaId = null) {
  const gizli = anahtar();
  if (!gizli) return null;
  const biter = Math.floor(simdi / 1000) + OMUR_SN;
  const govde = dosyaId ? `2|${tur}:${kimlik}:${dosyaId}:${biter}` : `${tur}:${kimlik}:${biter}`;
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

  /* İKİ BİÇİM: v2 dosya kimliğini de taşıyor, eski biçim taşımıyor. Eski jetonlar iki
   * saat daha geçerli olduğu için desteklenmeye devam ediyor — dağıtım anında video
   * izleyen birinin oynatıcısı yarıda kesilmesin. */
  const ikinciSurum = govde.startsWith("2|");
  const [tur, ...kalan] = (ikinciSurum ? govde.slice(2) : govde).split(":");
  const biter = Number(kalan.pop());
  const dosyaId = ikinciSurum ? kalan.pop() : null;
  const kimlik = kalan.join(":");
  if (!tur || !kimlik || !Number.isFinite(biter)) return null;
  if (ikinciSurum && !dosyaId) return null;
  if (Math.floor(simdi / 1000) > biter) return null;    // süresi dolmuş
  return { tur, kimlik, dosyaId };
}
