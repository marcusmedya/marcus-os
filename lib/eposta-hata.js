/**
 * RESEND HATASININ ANLAMI — TEK SAHİBİ BURASI.
 *
 * Bu kural `lib/eposta.js` içinde, `epostaGonderAyrintili`'nin fetch'ine gömülüydü.
 * `api/daily-backup.js` kendi fetch'ini yaptığı için ona erişemiyordu ve yalnızca
 * "E-posta gönderilemedi." diyordu — Resend'in söylediği sebep `detail` alanında
 * geliyor ama ekrana hiç yazılmıyordu. Kullanıcı üretimde tam olarak bunu yaşadı:
 * e-postalar kesilmişti, hiçbir ekranda sebep yoktu, ne yapacağı belli değildi.
 *
 * AYRI DOSYA — `lib/eposta.js`'e KONMADI: o modül `process.env` okuyor ve tarayıcıya
 * import edilirse ilk render'da patlayabilir. Buradaki her şey SAF: ne ortam değişkeni
 * okur, ne ağa çıkar. Bu yüzden hem sunucudan hem `src/App.jsx`'ten güvenle çağrılır.
 */

/**
 * Resend'in hata metnini ve HTTP durumunu bir KODA çevirir.
 *
 * SIRA ÖNEMLİ: Resend, doğrulanmamış alan adına da 403 döndürüyor. Önce duruma bakılsaydı
 * o hata "anahtar geçersiz" sanılır ve kullanıcı, anahtarında hiçbir sorun yokken yepyeni
 * bir anahtar üretmeye yollanırdı. Bu yüzden önce MESAJIN kendisine bakılıyor.
 */
export function resendHatasiniCoz(metin, durum) {
  const m = String(metin || "");
  let kod = "bilinmiyor";
  if (/domain|verify|not verified|\bfrom\b/i.test(m)) kod = "alan-adi-dogrulanmamis";
  else if (/api key/i.test(m) || durum === 401 || durum === 403) kod = "anahtar-gecersiz";
  return { sebep: m || `HTTP ${durum || "?"}`, kod };
}

/**
 * Bir hata metninden sebep+kod üretir — yanıt gövdesi Resend'den ne dönerse.
 * Resend hatayı bazen `message`, bazen `error` alanında veriyor.
 */
export function yanittanSebep(hataGovdesi, durum) {
  const h = hataGovdesi || {};
  const metin = h.message || h.error || `HTTP ${durum || "?"}`;
  return resendHatasiniCoz(metin, durum);
}

/**
 * KOD → NE YAPILACAK. Ekranda hata metninin altında gösterilir.
 * Ham Resend metni çoğu kullanıcıya bir şey anlatmıyor; asıl değerli olan bu satır.
 */
export const NE_YAPMALI = {
  "anahtar-yok": "Vercel → Settings → Environment Variables → RESEND_API_KEY ekle, sonra Redeploy et.",
  "anahtar-gecersiz": "Anahtar geçersiz. resend.com/api-keys adresinden YENİ bir anahtar oluştur (re_ ile başlar) ve Vercel'deki MEVCUT RESEND_API_KEY değişkeninin değerini onunla değiştir, sonra Redeploy et.",
  "alan-adi-dogrulanmamis": "Anahtar çalışıyor ama gönderen adresin alan adı Resend'de doğrulanmamış. Ya resend.com/domains adresinden alan adını doğrula, ya da geçici olarak RESEND_FROM değişkenini \"Marcus Medya App <onboarding@resend.dev>\" yap (o adres yalnızca Resend hesabının sahibine gönderir).",
  "ag-hatasi": "Resend'e ulaşılamadı. Birkaç dakika sonra tekrar dene.",
  "alici-yok": "Test için bir adres yaz ya da OWNER_EMAIL değişkenini tanımla.",
  "adres-yok": "BACKUP_EMAIL ortam değişkeni tanımlı değil — yedeğin gideceği adresi Vercel'e ekle.",
};

/** Kod bilinmiyorsa UYDURMA: boş dön, ekran yalnızca ham sebebi gösterir. */
export function neYapmali(kod) {
  return NE_YAPMALI[kod] || "";
}
