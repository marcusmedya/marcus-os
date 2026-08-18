/**
 * ORTAK E-POSTA GÖNDERİCİ.
 *
 * Aynı fonksiyon daily-reminders.js içinde gömülüydü; revize bildirimi de aynı işi yapacağı
 * için buraya taşındı. İki kopya olsaydı biri düzeltilip diğeri unutulurdu (gönderen adresi,
 * hata yönetimi gibi ayrıntılar ayrışırdı).
 *
 * ANAHTAR YOKSA sessizce false döner — bildirim gönderilememesi hiçbir zaman asıl işlemi
 * (revize kaydı) engellememelidir.
 */
/**
 * GÖNDEREN ADRESİ — TEK KAYNAK.
 *
 * Bu adres eskiden 6 dosyada 10 ayrı yerde sabit yazılıydı. Resend, gönderim yapabilmek için
 * alan adının kendi panelinde DOĞRULANMIŞ olmasını şart koşuyor; doğrulanmamışsa her gönderim
 * reddediliyor — giriş kodu, gece yedeği, revize bildirimi, hepsi birden susuyor. Sorun da tam
 * olarak böyle ortaya çıktı: kimse e-posta almıyordu ama hiçbir yerde sebep görünmüyordu.
 *
 * RESEND_FROM tanımlanarak kod değiştirmeden başka bir adrese geçilebilir. Doğrulama sorununu
 * hızlıca elemek için Resend'in test adresi kullanılabilir:
 *   RESEND_FROM = "Marcus Medya App <onboarding@resend.dev>"
 * (o adres doğrulama istemez ama yalnızca Resend hesabının sahibine gönderim yapar.)
 *
 * Çalışma anında okunuyor — sunucusuz ortamda değişken sonradan eklenirse yeniden dağıtım
 * dışında bir şey gerekmesin.
 */
export function gonderenAdres() {
  return process.env.RESEND_FROM || "Marcus Medya App <bildirim@marcusmedya.com>";
}

/**
 * GÖNDERİM — SEBEBİYLE BİRLİKTE.
 *
 * epostaGonder yalnızca true/false döndürüyor; çağıranların hiçbiri sebebi bilmiyor ve
 * bilmesi de gerekmiyor (bildirim gönderilememesi asıl işlemi durdurmamalı). Ama TEŞHİS
 * için sebep şart: "e-posta gitmiyor" ile "anahtar geçersiz" ya da "alan adı doğrulanmamış"
 * arasındaki farkı ancak Resend'in kendi hata metni söyleyebiliyor.
 *
 * Bu gerçekten pahalıya mal oldu: ortam değişkenine yanlış bir değer yapıştırıldı, arayüz
 * "tanımlı" diye yeşil gösterdi (yalnızca varlığına bakıyordu) ve e-postalar sessizce
 * kesildi. Sebep hiçbir ekranda yazmıyordu.
 */
export async function epostaGonderAyrintili(to, subject, html, cc) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, sebep: "RESEND_API_KEY tanımlı değil.", kod: "anahtar-yok" };
  if (!to) return { ok: false, sebep: "Alıcı adresi yok.", kod: "alici-yok" };
  const gonderen = gonderenAdres();
  try {
    const body = { from: gonderen, to: [to], subject, html };
    if (cc && cc !== to) body.cc = [cc];
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true, gonderen, alici: to };
    const hata = await r.json().catch(() => ({}));
    const metin = hata.message || hata.error || `HTTP ${r.status}`;
    /* İki hata Resend'de sürekli karışıyor ve çözümleri BAMBAŞKA. Ayırt edip ne yapılacağını
     * söylüyoruz — ham metin çoğu kullanıcıya bir şey anlatmıyor. */
    /* SIRA ÖNEMLİ: Resend, doğrulanmamış alan adına da 403 döndürüyor. Önce duruma bakarsak
     * o hatayı "anahtar geçersiz" sanıp kullanıcıyı yepyeni bir anahtar üretmeye yollarız —
     * anahtarında hiçbir sorun yokken. Bu yüzden önce MESAJIN kendisine bakılıyor. */
    let kod = "bilinmiyor";
    if (/domain|verify|not verified|\bfrom\b/i.test(metin)) kod = "alan-adi-dogrulanmamis";
    else if (/api key/i.test(metin) || r.status === 401 || r.status === 403) kod = "anahtar-gecersiz";
    return { ok: false, sebep: metin, kod, gonderen, durum: r.status };
  } catch (e) {
    return { ok: false, sebep: String(e.message || e), kod: "ag-hatasi", gonderen };
  }
}

export async function epostaGonder(to, subject, html, cc) {
  const sonuc = await epostaGonderAyrintili(to, subject, html, cc);
  return sonuc.ok;   // eski davranış: sebep önemsiz, gönderim asıl işlemi durdurmamalı
}

/** Müşteri revize istediğinde atanan kişiye giden bildirim. */
export function revizeBildirimHtml({ marka, icerikTuru, not, revizeSayisi, firmaAdi }) {
  const tur = revizeSayisi > 1 ? `<p style="color:#b45309;font-weight:600;">Bu içeriğin ${revizeSayisi}. revize turu.</p>` : "";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1a1a1a;">Müşteri revize istedi</h2>
      <p style="color:#333;line-height:1.6;"><strong>${marka || ""}</strong> — ${icerikTuru || "İçerik"}</p>
      ${tur}
      <div style="background:#f4f4f5;border-left:3px solid #dc2626;padding:12px 14px;color:#333;line-height:1.7;">
        ${String(not || "").replace(/</g, "&lt;")}
      </div>
      <p style="color:#555;line-height:1.6;margin-top:16px;">İş Operasyon'da <strong>Revize İstendi</strong> aşamasına geçti.</p>
      <p style="font-size:12px;color:#999;margin-top:20px;">${firmaAdi || "Marcus Medya"} — otomatik bildirim</p>
    </div>`;
}
