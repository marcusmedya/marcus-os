/**
 * TEMEL KATMAN — tema, stiller, küçük arayüz parçaları ve genel yardımcılar.
 *
 * NEDEN AYRI BİR DOSYA: App.jsx 10.000 satırı geçmişti ve bu, kendi başına bir risk hâline
 * gelmişti — bir düzenlemenin yanlış yere düşmesi kolaylaşıyor (bir kez tam olarak bu yüzden
 * uygulama açılmadı). Burası hemen her ekranın kullandığı ortak zemin; ayrı durması hem
 * App.jsx'i küçültür hem de bu parçaların nerede olduğunu belirginleştirir.
 *
 * Buraya SADECE her yerden kullanılan, kendi başına anlamlı şeyler konur. Bir ekrana özel
 * bir bileşen buraya değil, kendi dosyasına aittir.
 */
import React, { useState, useEffect, useRef } from "react";
// Marka adı eşleştirme anahtarı sunucuyla ORTAK olmalı — iki taraf farklı kural kullanırsa
// arayüzde "bağlandı" görünen bir kart sunucuda bağlanmamış olabilir.
export { markaAnahtari } from "../lib/marka-kilidi.js";
// Bu dosyadaki parçalar (KpiCard, FieldForm) bu ikonları kullanıyor. Dosya bölünürken
// lucide import'u taşınmamıştı; sonuç: FieldForm her açıldığında uygulama çöküyordu.
import { ArrowUpRight, ArrowDownRight, Check } from "lucide-react";

/* ==================================================================
 * TEMA — Koyu / Açık
 *
 * T bir SABİT DEĞİL, içeriği çalışma anında değiştirilen bir nesnedir. Uygulamanın her yeri
 * `T.bg`, `T.text` diye okuduğu için, temayı değiştirmek T'nin içindeki değerleri
 * güncellemek + bir kez yeniden çizdirmek demek. Alternatif (her bileşene tema geçirmek)
 * yüzlerce dosya değişikliği ve buna karşılık hiçbir kazanç anlamına gelirdi.
 *
 * ÖNEMLİ: inputStyle / saveBtnStyle gibi hazır stiller de bir kez hesaplanıyor; tema
 * değişince onların da içi güncellenmeli. temaUygula() bunu yapıyor — atlanırsa açık temada
 * form alanları koyu kalır.
 * ================================================================== */
export const KOYU = {
  bg: "#0C0E13",
  surface: "#151822",
  surfaceRaised: "#1C202C",
  border: "#262B38",
  borderSoft: "#1D212C",
  text: "#EEF0F4",
  textDim: "#8B93A7",
  textFaint: "#565D70",
  accent: "#5B6EF5",
  accentSoft: "rgba(91,110,245,0.14)",
  accentText: "#B7C0FF",
  success: "#34D399",
  successSoft: "rgba(52,211,153,0.14)",
  warning: "#F5A623",
  warningSoft: "rgba(245,166,35,0.14)",
  danger: "#F2555A",
  dangerSoft: "rgba(242,85,90,0.14)",
};

/* Açık tema, koyunun basit bir tersi değil: aynı ekranda saatlerce rakam okunuyor, bu yüzden
 * zemin saf beyaz değil hafif soğuk gri (göz yormaması için) ve vurgu renkleri beyaz üstünde
 * okunacak biçimde koyulaştırıldı. Yumuşak zeminler koyu temadaki saydam katmanlar yerine
 * düz açık tonlar — saydamlık beyaz üstünde soluk ve okunaksız kalıyordu. */
export const ACIK = {
  bg: "#F4F5F7",
  surface: "#FFFFFF",
  surfaceRaised: "#F0F2F5",
  border: "#DDE1E7",
  borderSoft: "#E8EBEF",
  text: "#14171C",
  textDim: "#5A6272",
  textFaint: "#8A93A3",
  accent: "#4A5AE8",
  accentSoft: "#EAECFD",
  accentText: "#3A47C4",
  success: "#12855A",
  successSoft: "#E6F5EE",
  warning: "#9A6100",
  warningSoft: "#FCF3E3",
  danger: "#C22B30",
  dangerSoft: "#FBEBEC",
};

export const T = { ...KOYU };

/** Kayıtlı tercih; yoksa koyu (uygulamanın alışılmış görünümü). */
export function temaOku() {
  try {
    const k = localStorage.getItem("marcus-os-tema");
    return k === "acik" ? "acik" : "koyu";
  } catch (e) { return "koyu"; }
}

/** Temayı uygular: T'nin ve hazır stillerin içini günceller, tercihi kaydeder. */
export function temaUygula(mod) {
  const p = mod === "acik" ? ACIK : KOYU;
  Object.keys(p).forEach((k) => { T[k] = p[k]; });
  try { localStorage.setItem("marcus-os-tema", mod === "acik" ? "acik" : "koyu"); } catch (e) { /* sessizce geç */ }

  // Bir kez hesaplanmış stiller de tazelenir (aşağıda tanımlılar; ilk çağrıda henüz yoksa atlanır).
  if (typeof inputStyle === "object") {
    inputStyle.background = T.surface;
    inputStyle.border = `1px solid ${T.border}`;
    inputStyle.color = T.text;
    saveBtnStyle.background = T.accent;
    cancelBtnStyle.color = T.textDim;
    cancelBtnStyle.border = `1px solid ${T.border}`;
    addBtnStyle.background = T.accentSoft;
    addBtnStyle.color = T.accentText;
  }
  // Sayfa zemini ve tarayıcı arayüz rengi
  try {
    document.body.style.background = T.bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", T.bg);
  } catch (e) { /* sunucu tarafında document yok */ }
}

export const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

/** Gizlilik Modu: Ayarlar'dan açılıp kapanan, tüm ₺ tutarlarını "***" olarak gösteren bir
 * bayrak. fmt() her yerde kullanıldığı için, bunu tek bir global değişkende tutup fmt()'nin
 * içinde kontrol etmek, uygulamanın her köşesine tek tek dokunmaktan çok daha güvenli/hızlı. */
/* VARSAYILAN: GİZLİ.
 * Rakamlar (ciro, kâr, maaşlar, bakiyeler) uygulama açıldığında gizli gelir; görmek için
 * üst çubuktaki göz simgesine basılır. Sebep: panel çoğu zaman başkalarının da görebileceği
 * ortamlarda açılıyor — kafede, çekimde, birinin yanında. Varsayılan açık olsaydı, gizlemeyi
 * hatırlamak gerekirdi; varsayılan gizli olunca göstermek bilinçli bir hareket oluyor.
 *
 * Daha önce bir tercih kaydedilmişse ona uyulur ("0" = kullanıcı bilerek açık bırakmış). */
let GIZLILIK_MODU = (() => {
  try {
    const kayit = localStorage.getItem("marcus-os-gizlilik");
    if (kayit === null) return true; // hiç seçim yapılmamış → gizli başla
    return kayit === "1";
  } catch (e) { return true; }
})();

/* Bu bayrak bu dosyada yaşar ve dışarıdan fonksiyonla okunup yazılır. Doğrudan dışa
 * açılamaz: ES modüllerinde import edilmiş bir değişkene atama yapılamaz — App.jsx eskiden
 * bu değişkene doğrudan yazıyordu, dosya bölününce bu artık geçersiz hâle geldi. */
export const gizlilikModuOku = () => GIZLILIK_MODU;
export const gizlilikModuYaz = (deger) => {
  GIZLILIK_MODU = !!deger;
  try { localStorage.setItem("marcus-os-gizlilik", deger ? "1" : "0"); } catch (e) { /* sessizce geç */ }
};
export const fmt = (n) => {
  if (GIZLILIK_MODU) return "₺ •••";
  return "₺" + (Number(n) || 0).toLocaleString("tr-TR");
};
export const fmtShort = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + "b" : n);
export const nextId = (arr) => (arr.length ? Math.max(...arr.map((i) => i.id || 0)) + 1 : 1);

/**
 * Tüm sekmelerin ortak "gerçek" hesaplaması: Toplam Ciro = aktif/yeni müşterilerin
 * aylık ücretleri (Müşteriler) + ek gelir kalemleri (Finans > Gelirler). Toplam Gider =
 * Finans > Giderler toplamı + müşteri bazlı maliyetler (örn. freelance ödemeleri).
 * Dashboard, Finans ve AI CEO hepsi bu fonksiyonu kullanır, böylece bir sekmede
 * yapılan değişiklik anında diğerlerine yansır.
 */
/** Bir üyeliğin gider hesabına dahil edilip edilmeyeceğini belirler: elle "Pasif Et" ile
 * kapatılmışsa YA DA bitiş tarihi geçmişse pasif sayılır (gider pusulasından düşer).
 * Elle "Aktif Et" ile geri açılırsa (bitiş tarihi geçmiş olsa bile) tekrar dahil edilir —
 * yani `aktif` alanı, tarih kontrolünün ÜZERİNE yazan kesin bir kullanıcı tercihidir. */
export function uyelikEfektifAktifMi(u) {
  if (u.aktif === true) return true; // elle aktif edilmiş, tarih geçmiş olsa bile sayılır
  if (u.aktif === false) return false; // elle pasif edilmiş
  if (u.bitisTarihi) {
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    if (new Date(u.bitisTarihi) < bugun) return false; // süresi dolmuş, otomatik pasif
  }
  return true; // varsayılan: aktif
}

export function computeLive(data) {
  const clients = data.clients || [];
  const activeClients = clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu");
  const recurring = activeClients.reduce((s, c) => s + (Number(c.aylikUcret) || 0), 0);
  const extra = (data.gelirKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ciro = recurring + extra;
  const faturaliRecurring = activeClients.reduce((s, c) => s + clientFaturaliTutar(c), 0);
  const faturaliExtra = (data.gelirKalemleri || []).filter((g) => g.faturali !== "hayir").reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const faturaliCiro = faturaliRecurring + faturaliExtra;
  const faturasizCiro = ciro - faturaliCiro;
  const kdvTutari = Math.round(faturaliCiro * 0.2);
  const kdvDahilToplamCiro = ciro + kdvTutari;
  const faturaliKdvDahil = faturaliCiro + kdvTutari;
  const giderKalemToplam = (data.giderKalemleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const ofisGiderToplam = (data.ofisGiderleri || []).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const clientCosts = clients.reduce((s, c) => s + (c.maliyetler || []).reduce((s2, m) => s2 + (Number(m.tutar) || 0), 0), 0);
  /* PERSONEL GİDERİ KALEM KALEM — toplam zaten hesaplanıyordu ama ekranda tek rakam olarak
   * görünüyordu, "bu ₺X neyin toplamı?" sorusu cevapsız kalıyordu. Parçalar ayrı ayrı
   * döndürülüyor; toplam aynı kalıyor, muhasebe değişmiyor. */
  const personelMaas = (data.personel || []).reduce((s, p) => s + (Number(p.maas) || 0), 0);
  const personelSigorta = (data.personel || []).reduce((s, p) => s + (Number(p.sigorta) || 0), 0);
  const personelYemek = (data.personel || []).reduce((s, p) => s + (Number(p.yemek) || 0), 0);
  const personelTazminat = (data.personel || []).reduce((s, p) => s + (Number(p.tazminatBirikimi) || 0), 0);
  const personelGideri = personelMaas + personelSigorta + personelYemek + personelTazminat;
  // Üyelikler (Canva, Adobe, ChatGPT vb.) de aylık gidere dahil edilir — yıllık ödenenler
  // 12'ye bölünerek aylık karşılığı hesaplanır, böylece "Toplam Gider" gerçek aylık maliyeti yansıtır.
  const uyelikGideri = (data.uyelikler || []).filter(uyelikEfektifAktifMi).reduce((s, u) => s + (u.periyot === "yillik" ? (Number(u.tutar) || 0) / 12 : (Number(u.tutar) || 0)), 0);
  const gider = giderKalemToplam + ofisGiderToplam + clientCosts + personelGideri + uyelikGideri;
  const net = ciro - gider;
  const manuelBekleyen = (data.bekleyenTahsilatlar || []).reduce((s, b) => s + (Number(b.tutar) || 0), 0);
  const otomatikBekleyen = activeClients.reduce((s, c) => {
    const st = clientPaymentStatus(c);
    if (st && (st.status === "bekliyor" || st.status === "gecikti")) return s + monthRemaining(c, monthKey());
    return s;
  }, 0);
  const bekleyenToplam = manuelBekleyen + otomatikBekleyen;
  // "Tahsil Edilen" artık ciro'dan bekleyeni çıkararak TAHMİN edilmiyor (bu, ödeme günü henüz
  // gelmemiş müşterileri de "tahsil edildi" sayan bir hataya yol açıyordu — örn. ayın 1'inde
  // hiç ödeme alınmamışken bile öyle görünüyordu). Bunun yerine gerçek ödeme kayıtlarından toplanıyor.
  const tahsilEdilen = extra + activeClients.reduce((s, c) => s + monthPaidAmount(c, monthKey()), 0);
  const karMarji = ciro ? Math.round((net / ciro) * 100) : 0;
  return { recurring, extra, ciro, faturaliCiro, faturasizCiro, kdvTutari, kdvDahilToplamCiro, faturaliKdvDahil, giderKalemToplam, ofisGiderToplam, clientCosts, personelGideri, personelMaas, personelSigorta, personelYemek, personelTazminat, uyelikGideri, gider, net, manuelBekleyen, otomatikBekleyen, bekleyenToplam, tahsilEdilen, karMarji };
}

/** Bir müşterinin bu ayki ödeme durumunu, kayıtlı "ödeme günü"ne göre otomatik hesaplar. */
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Belirli bir ay için o müşteriden gerçekten tahsil edilen toplam tutar (kısmi ödemeler dahil).
 * Eski sistemde (odemeler dizisinde işaretli ama hiç ödeme kaydı yoksa) geriye dönük uyumluluk için
 * tam ödenmiş sayılır. */
export function monthPaidAmount(client, key) {
  const kayitlar = (client.odemeKayitlari || []).filter((k) => k.ay === key);
  const sum = kayitlar.reduce((s, k) => s + (Number(k.tutar) || 0), 0);
  if (sum > 0) return sum;
  if ((client.odemeler || []).includes(key)) return Number(client.aylikUcret) || 0;
  return 0;
}
/** O ay için kalan (henüz ödenmemiş) bakiye. */
export function monthRemaining(client, key) {
  return Math.max(0, (Number(client.aylikUcret) || 0) - monthPaidAmount(client, key));
}
/** O ay tam olarak ödenmiş mi? */
export function isMonthPaid(client, key) {
  const tutar = Number(client.aylikUcret) || 0;
  if (tutar <= 0) return true;
  return monthPaidAmount(client, key) >= tutar;
}

export function clientPaymentStatus(client) {
  if (!client.odemeGunu) return null;
  const today = new Date();
  const dueDay = Number(client.odemeGunu);
  const todayDay = today.getDate();
  const pesin = client.odemeSekli !== "sonra";

  // Peşin: bu ayın ödemesi bu ayın ödeme gününde beklenir.
  // Sonra: bu ayın hizmeti henüz devam ediyor sayılır, değerlendirilen borç ayı BİR ÖNCEKİ takvim ayıdır,
  // vadesi ise yine bu ayın ödeme günündedir (yani geçen ayın hizmeti, bu ay içinde ödenir).
  const degerlendirilenAy = pesin ? today : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const key = monthKey(degerlendirilenAy);

  if (isMonthPaid(client, key)) return { status: "odendi", label: pesin ? "Bu ay ödendi" : "Geçen ay ödendi" };
  if (todayDay < dueDay) return { status: "yaklasiyor", label: `Ödeme günü: ayın ${dueDay}'i` };
  const gecikenGun = todayDay - dueDay;
  const kalan = monthRemaining(client, key);
  const kismiNot = monthPaidAmount(client, key) > 0 ? ` — kalan ${fmt(kalan)}` : "";
  if (gecikenGun >= 7) return { status: "gecikti", label: `${gecikenGun} gün gecikti${kismiNot}` };
  return { status: "bekliyor", label: `Ödeme günü geçti (ayın ${dueDay}'i)${kismiNot}` };
}

/** Bir müşterinin kaç aydır (bu ay dahil, geriye doğru art arda) ödeme yapmadığını hesaplar.
 * Tam ödenmiş bir ay bulununca sayımı durdurur (kısmi ödemeler yine "ödenmemiş" sayılır). */
export function clientOverdueMonths(client) {
  if (!client.odemeGunu) return 0;
  const now = new Date();
  const pesin = client.odemeSekli !== "sonra";
  let baslangicKey = null;
  if (client.baslangic && /^\d{4}-\d{1,2}$/.test(client.baslangic.trim())) {
    const [by, bm] = client.baslangic.trim().split("-").map(Number);
    baslangicKey = `${by}-${String(bm).padStart(2, "0")}`;
  }
  let count = 0;
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    if (baslangicKey && key < baslangicKey) break; // müşterinin başlangıcından öncesini sayma
    if (pesin && i === 0 && now.getDate() < Number(client.odemeGunu)) continue; // peşin: bu ayın vadesi henüz gelmedi
    if (!pesin && i === 0) continue; // sonra: bu ayın hizmeti henüz bitmedi, hiç vadesi gelmedi
    if (!pesin && i === 1 && now.getDate() < Number(client.odemeGunu)) continue; // sonra: geçen ayın vadesi bu ayın ödeme gününe kadar gelmez
    if (isMonthPaid(client, key)) break;
    count++;
  }
  return count;
}

/** clientOverdueMonths ile AYNI ayları tarar ama sayı yerine, her ayın kısmi ödemesi düşülmüş
 * GERÇEK kalan bakiyesini toplar — "3 aydır ödenmedi" derken biri o aylardan birine kısmi ödeme
 * yapmışsa, bu fonksiyon o kısmi ödemeyi düşerek doğru toplamı verir. */
export function clientOverdueBalance(client) {
  if (!client.odemeGunu) return 0;
  const now = new Date();
  const pesin = client.odemeSekli !== "sonra";
  let baslangicKey = null;
  if (client.baslangic && /^\d{4}-\d{1,2}$/.test(client.baslangic.trim())) {
    const [by, bm] = client.baslangic.trim().split("-").map(Number);
    baslangicKey = `${by}-${String(bm).padStart(2, "0")}`;
  }
  let toplam = 0;
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    if (baslangicKey && key < baslangicKey) break;
    if (pesin && i === 0 && now.getDate() < Number(client.odemeGunu)) continue;
    if (!pesin && i === 0) continue;
    if (!pesin && i === 1 && now.getDate() < Number(client.odemeGunu)) continue;
    if (isMonthPaid(client, key)) break;
    toplam += monthRemaining(client, key);
  }
  return toplam;
}

export const DEFAULT_TEBLIG_SABLONU = `Sayın {musteri} Yetkilisi,

Firmanız ile aramızda devam etmekte olan hizmet ilişkisi kapsamında, aylık {aylikUcret} tutarındaki hizmet bedelinin {ay} aydır tarafımıza ödenmediği tespit edilmiştir.

Toplam Bakiye: {toplamBakiye}

İş bu bildirim tarihinden itibaren 7 (yedi) gün içerisinde yukarıda belirtilen toplam bakiyenin tarafımıza ödenmesini, aksi halde hizmetin askıya alınması ve/veya yasal yollara başvurulması hakkımızın saklı olduğunu bilgilerinize sunarız.

Herhangi bir ödeme yapıldıysa veya bir yanlışlık olduğunu düşünüyorsanız, en kısa sürede tarafımızla iletişime geçmenizi rica ederiz.

Saygılarımızla,
{firma}`;

/** Şablondaki {musteri}, {aylikUcret}, {ay}, {toplamBakiye}, {firma}, {tarih} yer tutucularını gerçek değerlerle değiştirir. */
export function renderTeblig(sablon, vars) {
  let text = sablon || DEFAULT_TEBLIG_SABLONU;
  Object.entries(vars).forEach(([k, v]) => { text = text.split(`{${k}}`).join(String(v)); });
  return text;
}

/** Kullanıcı verisini yazdırılabilir HTML'e basmadan önce güvenli hale getirir (kod enjeksiyonunu engeller). */
export const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Serbestçe düzenlenmiş tebliğ metnini yazdırılabilir HTML'e sarar. */
export function tebligHtmlFromText(text, client, firmaAdi) {
  const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const bodyHtml = escapeHtml(text)
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8" /><title>Ödeme Hatırlatma - ${escapeHtml(client.ad)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 60px auto; color:#111; line-height:1.7; font-size:15px; }
  .header { display:flex; justify-content:space-between; margin-bottom:40px; }
  .baslik { font-size:20px; font-weight:bold; text-align:center; margin: 30px 0; text-transform:uppercase; letter-spacing:1px; }
  p { margin: 0 0 16px; }
  @media print { body { margin: 20px; } }
</style></head>
<body>
  <div class="header">
    <div><strong>${escapeHtml(firmaAdi)}</strong></div>
    <div>${bugun}</div>
  </div>
  <div class="baslik">Ödeme Hatırlatma Bildirimi</div>
  ${bodyHtml}
</body></html>`;
}

export function yazdirTebligMetni(text, client, firmaAdi) {
  const html = tebligHtmlFromText(text, client, firmaAdi);
  const win = window.open("", "_blank");
  if (!win) { window.alert("Yeni pencere açılamadı — tarayıcının pop-up engelleyicisini kontrol et."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function kopyalaMetin(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => window.alert("Metin kopyalandı — WhatsApp veya e-postaya yapıştırabilirsin.")).catch(() => window.alert("Kopyalanamadı."));
  } else {
    window.alert("Bu tarayıcıda otomatik kopyalama desteklenmiyor.");
  }
}


/** Bir müşterinin aylık ücretinin ne kadarının faturalı olduğunu döndürür (kısmi olabilir).
 * Yeni "faturaliTutar" alanı varsa onu kullanır (aylıkÜcret'i geçemez); yoksa eski evet/hayır
 * alanına bakar (geriye dönük uyumluluk). */
export function clientFaturaliTutar(c) {
  const aylik = Number(c.aylikUcret) || 0;
  if (c.faturaliTutar !== undefined && c.faturaliTutar !== null && c.faturaliTutar !== "") {
    return Math.min(Math.max(Number(c.faturaliTutar) || 0, 0), aylik);
  }
  return c.faturali === "hayir" ? 0 : aylik;
}

/** Bir müşterinin kâr marjı: eğer o müşteriye maliyet eklenmişse (aylikUcret - maliyet)/aylikUcret
 * üzerinden otomatik hesaplanır; hiç maliyet eklenmemişse elle girilmiş karMarji alanı kullanılır. */
/**
 * MÜŞTERİ KÂRLILIĞI — gerçek veriden, denetimli.
 *
 * ESKİ HESAP İKİ YERDE YANILIYORDU:
 *  1) Maliyeti hiç girilmemiş müşteride ELLE YAZILMIŞ karMarji alanına düşüyordu. Bir kez
 *     "%90" yazılmış bir marka, hiçbir doğrulama olmadan "En Kârlı" çıkıyordu.
 *  2) YÜZDEYE göre sıralıyordu. ₺5.000 alıp ₺500 harcanan müşteri (%90), ₺50.000 alıp
 *     ₺15.000 harcanandan (%70) önce geliyordu — oysa ikincisi ₺35.000 kazandırıyor,
 *     birincisi ₺4.500.
 *
 * Yeni hesap TUTAR üretir ve verinin yeterli olup olmadığını da söyler. Yetersizse
 * `hesaplanabilir: false` döner; çağıran taraf uydurma bir sayı göstermek yerine
 * "veri eksik" demelidir.
 *
 * reklamButcesi: VARSAYILAN 0 VE ÖYLE KALMALI. Reklam bütçesi müşterinin harcamasıdır,
 * ajansın gideri değil — gider sayılınca kâr haksız yere sıfırlanıyordu. Ajans reklam
 * parasını kendi ödüyorsa doğru yer Müşteri > Maliyetler kalemi.
 *
 * isMaliyeti: markaAylikIsMaliyeti'nden gelen o ayki freelancer ücretleri (çağıran verir,
 * bu dosya CekimEditTakibi'ye bağımlı olmasın diye).
 */
export function musteriKarlilik(c, { isMaliyeti = 0, eksikUcret = 0, reklamButcesi = 0 } = {}) {
  const gelir = Number(c.aylikUcret) || 0;
  const elleMaliyet = (c.maliyetler || []).reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  const maliyetGirilmis = (c.maliyetler || []).length > 0;
  const toplamMaliyet = elleMaliyet + isMaliyeti + reklamButcesi;
  const net = gelir - toplamMaliyet;

  /* HESAPLANABİLİRLİK — yalnızca GELİR şartı.
   *
   * Buradaki maliyetler DOĞRUDAN maliyetlerdir: elle girilen kalemler, o markaya ait
   * freelancer iş ücretleri, reklam bütçesi. Maaşlı ekibin zamanı hiçbir müşteriye
   * dağıtılmıyor — hiçbiri için. Dolayısıyla doğrudan maliyeti olmayan bir müşterinin
   * marjı gerçekten %100'dür; iş maaşlı ekiple yapılmış demektir.
   *
   * DİKKAT: bu, kendi ekibinle çalıştığın markaları freelancer'la çalıştıklarından kârlı
   * gösterir. Bu bir hata değil, maaşın müşterilere dağıtılmamasının sonucu — ama karar
   * verirken bilinmesi gerekir. Bu yüzden `maliyetDogrulanmis` bayrağı taşınır ve arayüz
   * bunu işaretler. */
  const hesaplanabilir = gelir > 0;
  const maliyetDogrulanmis = maliyetGirilmis || isMaliyeti > 0;

  const eksikler = [];
  if (gelir <= 0) eksikler.push("aylık ücret girilmemiş");
  if (eksikUcret > 0) eksikler.push(`${eksikUcret} işte kişi ücreti tanımsız`);

  return {
    gelir, elleMaliyet, isMaliyeti, reklamButcesi, toplamMaliyet, net,
    marj: gelir > 0 ? Math.round((net / gelir) * 100) : 0,
    hesaplanabilir, maliyetDogrulanmis, eksikler,
  };
}

export function clientKarMarji(c) {
  const maliyetToplam = (c.maliyetler || []).reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  if ((c.maliyetler || []).length > 0) {
    return c.aylikUcret ? Math.round(((c.aylikUcret - maliyetToplam) / c.aylikUcret) * 100) : 0;
  }
  return Number(c.karMarji) || 0;
}

/**
 * YÖNETİCİ OTURUMU
 * ----------------
 * ÖNEMLİ GÜVENLİK DEĞİŞİKLİĞİ: yönetici şifresi artık tarayıcıda HİÇ saklanmıyor.
 * Eskiden şifre localStorage'da süresiz duruyordu ve giriş alanı tarayıcıya kaydedilip
 * otomatik dolduruluyordu — o cihaza oturan herkes CEO paneline girebiliyordu.
 *
 * Artık girişten sonra sadece süreli bir "oturum anahtarı" saklanıyor. Bu anahtar:
 *  - kendiliğinden sona erer (normal giriş 12 saat, "bu cihazı hatırla" 30 gün)
 *  - Ayarlar'dan tek tıkla tüm cihazlarda iptal edilebilir
 *  - ele geçse bile şifreyi ifşa etmez
 */
export const PW_KEY = "marcus-os-pw";
/**
 * İŞLEM KİMLİĞİ ÜRETİCİ.
 *
 * Eylem uçları ("stoğu bir artır", "plan ekle") bir FARK bildirimi; aynı istek iki kez
 * giderse iki kez uygulanıyordu. Her işleme benzersiz bir kimlik takılıyor, sunucu aynı
 * kimliği ikinci kez görürse işlemi TEKRAR UYGULAMIYOR.
 *
 * KİMLİK İŞLEM BAŞINA ÜRETİLİR, oturum ya da sayfa başına değil. Daha geniş üretilseydi
 * farklı işlemler aynı sanılır ve ikincisi sessizce kaybolurdu.
 *
 * Otomatik tekrar denemeler (lib/mesgul-tekrar.js) AYNI gövdeyi yeniden gönderdiği için
 * kimlik kendiliğinden aynı kalıyor — korunan durum tam olarak bu. Kullanıcı elle tekrar
 * tıklarsa yeni kimlik üretilir ve işlem gerçekten tekrar uygulanır; istenen de bu.
 *
 * Biçim sunucudaki `kimlikGecerliMi` ile uyumlu olmalı (harf/rakam/tire/alt çizgi, 8-64).
 * Testte (t62) üretilen kimliğin o kuraldan geçtiği ayrıca doğrulanıyor.
 */
export const islemKimligiUret = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch (e) { /* eski tarayıcı — aşağıdaki yedeğe düşülür */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

export const OTURUM_KEY = "marcus-os-oturum";
export const OTURUM_BITIS_KEY = "marcus-os-oturum-bitis";

export const getOturum = () => {
  if (typeof window === "undefined") return "";
  try {
    const bitis = Number(localStorage.getItem(OTURUM_BITIS_KEY) || 0);
    if (bitis && Date.now() > bitis) { clearOturum(); return ""; }
    return localStorage.getItem(OTURUM_KEY) || "";
  } catch (e) { return ""; }
};
export const setOturum = (token, sureSaniye) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OTURUM_KEY, token);
    localStorage.setItem(OTURUM_BITIS_KEY, String(Date.now() + (Number(sureSaniye) || 43200) * 1000));
    // Eski sürümlerden kalmış olabilecek düz şifreyi temizle — artık asla saklanmıyor.
    localStorage.removeItem(PW_KEY);
  } catch (e) { /* localStorage kapalıysa sessizce geç */ }
};
export const clearOturum = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OTURUM_KEY);
    localStorage.removeItem(OTURUM_BITIS_KEY);
    localStorage.removeItem(PW_KEY);
  } catch (e) { /* sessizce geç */ }
};
/** Geriye dönük: eski sürümde saklanmış şifre varsa okunur ama artık hiç yazılmaz. */
export const getPw = () => (typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "");
export const setPw = (v) => { if (typeof window !== "undefined" && !v) localStorage.removeItem(PW_KEY); };

/** Kişiye özel personel girişi: kullanıcı adı + şifre, ayrı bir localStorage anahtarında. */
export const STAFF_USER_KEY = "marcus-os-staff-user";
export const STAFF_PW_KEY = "marcus-os-staff-pw";
export const getStaffCreds = () => (typeof window !== "undefined" ? { kullaniciAdi: localStorage.getItem(STAFF_USER_KEY) || "", sifre: localStorage.getItem(STAFF_PW_KEY) || "" } : { kullaniciAdi: "", sifre: "" });
export const setStaffCreds = (kullaniciAdi, sifre) => { if (typeof window !== "undefined") { localStorage.setItem(STAFF_USER_KEY, kullaniciAdi); localStorage.setItem(STAFF_PW_KEY, sifre); } };
export const clearStaffCreds = () => { if (typeof window !== "undefined") { localStorage.removeItem(STAFF_USER_KEY); localStorage.removeItem(STAFF_PW_KEY); } };

/** Müşteri Paneli girişi — personelden tamamen ayrı bir kimlik. */
export const MUSTERI_USER_KEY = "marcus-os-musteri-user";
export const MUSTERI_PW_KEY = "marcus-os-musteri-pw";
/**
 * Müşteri giriş bilgileri. "Beni hatırla" işaretliyse localStorage'a yazılır (tarayıcı
 * kapansa da kalır); işaretli değilse sessionStorage'a yazılır ve sekme kapanınca silinir.
 * Okuma her ikisine de bakar — hangisinde varsa oradan alır.
 */
export const getMusteriCreds = () => {
  if (typeof window === "undefined") return { kullaniciAdi: "", sifre: "" };
  try {
    const ku = localStorage.getItem(MUSTERI_USER_KEY) || sessionStorage.getItem(MUSTERI_USER_KEY) || "";
    const sf = localStorage.getItem(MUSTERI_PW_KEY) || sessionStorage.getItem(MUSTERI_PW_KEY) || "";
    return { kullaniciAdi: ku, sifre: sf };
  } catch (e) { return { kullaniciAdi: "", sifre: "" }; }
};
export const setMusteriCreds = (kullaniciAdi, sifre, hatirla = true) => {
  if (typeof window === "undefined") return;
  try {
    clearMusteriCreds();
    const depo = hatirla ? localStorage : sessionStorage;
    depo.setItem(MUSTERI_USER_KEY, kullaniciAdi);
    depo.setItem(MUSTERI_PW_KEY, sifre);
  } catch (e) { /* depolama kapalıysa oturum yine de açılır, sadece hatırlanmaz */ }
};
/** "Beni hatırla" seçilmiş mi? Kalıcı depoda kayıt varsa evet. Hareketsizlik çıkışı bu
 * bilgiye göre davranır — hatırlanan bir cihazda müşteriyi dışarı atmak anlamsız. */
export const musteriHatirlaniyorMu = () => {
  if (typeof window === "undefined") return false;
  try { return !!localStorage.getItem(MUSTERI_USER_KEY); } catch (e) { return false; }
};
export const clearMusteriCreds = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MUSTERI_USER_KEY); localStorage.removeItem(MUSTERI_PW_KEY);
    sessionStorage.removeItem(MUSTERI_USER_KEY); sessionStorage.removeItem(MUSTERI_PW_KEY);
  } catch (e) { /* sessizce geç */ }
};

/**
 * Metni HTTP başlığında güvenle taşınabilir hale getirir (UTF-8 → base64).
 *
 * NEDEN GEREKLİ: HTTP başlık değerleri yalnızca ASCII karakter taşıyabilir. Türkçe karakter
 * içeren bir kullanıcı adı ya da şifre ("saygı", "çağrı", "gülşen"...) doğrudan başlığa
 * konduğunda tarayıcı isteği GÖNDERMEDEN hata veriyordu — ekranda "Sunucuya ulaşılamadı"
 * yazıyor, oysa sunucuyla hiç konuşulmamış oluyordu. Bu, personel ve müşteri girişlerinin
 * sessizce çalışmamasının sebebiydi (yönetici girişi etkilenmiyordu, çünkü onun şifresi
 * başlıkta değil istek gövdesinde gidiyor).
 */
export const basligaCevir = (metin) => {
  const s = String(metin || "");
  if (!s) return "";
  try {
    // TextEncoder + btoa: UTF-8 baytlarını ASCII base64'e çevirir.
    const baytlar = new TextEncoder().encode(s);
    let ikili = "";
    baytlar.forEach((b) => { ikili += String.fromCharCode(b); });
    return btoa(ikili);
  } catch (e) {
    return "";
  }
};

/** /api/data isteklerine hem olası tek-şifre hem de kişisel personel kimliğini ekler.
 * Kimlik bilgileri base64 olarak (…-B64 başlıklarıyla) gönderilir; sunucu bunları çözer.
 * Düz başlıklar da GÖNDERİLMEYE devam eder ama sadece ASCII ise — Türkçe karakter içeren
 * bir değer başlığa konulamadığı için orada boş bırakılır. */
export const sadeceAscii = (metin) => (/^[\x00-\x7F]*$/.test(String(metin || "")) ? String(metin || "") : "");

export const authHeaders = () => {
  const staff = getStaffCreds();
  const musteri = getMusteriCreds();
  return {
    "X-Oturum": getOturum(),
    "X-Site-Password": sadeceAscii(getPw()),
    "X-Site-Password-B64": basligaCevir(getPw()),
    "X-Staff-Username": sadeceAscii(staff.kullaniciAdi),
    "X-Staff-Password": sadeceAscii(staff.sifre),
    "X-Staff-Username-B64": basligaCevir(staff.kullaniciAdi),
    "X-Staff-Password-B64": basligaCevir(staff.sifre),
    "X-Musteri-Username": sadeceAscii(musteri.kullaniciAdi),
    "X-Musteri-Password": sadeceAscii(musteri.sifre),
    "X-Musteri-Username-B64": basligaCevir(musteri.kullaniciAdi),
    "X-Musteri-Password-B64": basligaCevir(musteri.sifre),
  };
};

/** Ekran genişliğine göre mobil/masaüstü ayrımı yapar; pencere yeniden boyutlandırıldığında güncellenir. */
export function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export function Card({ children, style, className, ...rest }) {
  return (
    <div className={["marcus-card", className].filter(Boolean).join(" ")} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Pill({ color, soft, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color, background: soft, padding: "6px 10px", borderRadius: 999, fontFamily: "Inter, sans-serif" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {children}
    </span>
  );
}

/* buyuk=true: Dashboard'ın iki ana rakamı. Altı kart eşit ağırlıktayken ciro ile bekleyen
 * tahsilat aynı önemde görünüyordu — biri sonuç, diğeri uyarı. */
export function KpiCard({ label, value, mono = true, delta, deltaYoy, accent, buyuk = false }) {
  const up = delta >= 0;
  return (
    <Card style={{ padding: buyuk ? "22px 26px" : "18px 22px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.textDim, fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: 0.4, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: buyuk ? 40 : 28, fontWeight: 600, color: accent || T.text, fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif", marginBottom: 10, letterSpacing: -0.5, lineHeight: 1.1 }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 600, color: up ? T.success : T.danger, fontFamily: "Inter, sans-serif" }}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta)}% geçen aya göre
          </span>
          {deltaYoy !== undefined && (
            <span style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter, sans-serif" }}>yıllık {deltaYoy >= 0 ? "+" : ""}{deltaYoy}%</span>
          )}
        </div>
      )}
    </Card>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text, margin: 0, letterSpacing: 0.1 }}>{children}</h2>
      {action}
    </div>
  );
}

export const inputStyle = { width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 15px", color: T.text, fontSize: 15, fontFamily: "Inter, sans-serif", outline: "none" };
export const saveBtnStyle = { background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px 15px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minHeight: 40 };
export const cancelBtnStyle = { background: "transparent", color: T.textDim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 15px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", minHeight: 40 };
export const iconBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: 9, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 36 };
export const addBtnStyle = { display: "flex", alignItems: "center", gap: 6, background: T.accentSoft, color: T.accentText, border: "none", borderRadius: 9, padding: "12px 15px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", minHeight: 40 };

/** Generic small form for add/edit, driven by a field-definition list. */
export const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** Native <input type="month"> Safari masaüstünde desteklenmediği için (düz metin kutusuna
 * dönüşüyor ve yanlış/gün eklenmiş değerler kabul edilebiliyor), bunun yerine iki ayrı <select>
 * (Ay + Yıl) ile tüm tarayıcılarda garanti aynı şekilde çalışan bir seçici kullanılıyor. */
export function AySeciciAlan({ value, onChange }) {
  const gecerli = value && /^\d{4}-\d{1,2}$/.test(value);
  const [yil, ay] = gecerli ? value.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const buYil = new Date().getFullYear();
  const yilListesi = [];
  for (let y = buYil - 6; y <= buYil + 1; y++) yilListesi.push(y);

  const guncelle = (yeniYil, yeniAy) => onChange(`${yeniYil}-${String(yeniAy).padStart(2, "0")}`);

  // Gelen değer boş/hatalı formattaysa (örn. eski kayıtlardan kalma "" ya da "2026-08-01" gibi
  // gün içeren bozuk bir değer), sadece EKRANDA doğru ayı göstermekle kalma — asıl form
  // durumunu da hemen düzelt. Yoksa kullanıcı hiç dokunmadan "Kaydet"e basınca bozuk/boş
  // değer sessizce kaydedilmeye devam ediyordu ("yeniden kaydetsem de işlemiyor" sorunu buydu).
  useEffect(() => {
    if (!gecerli) guncelle(yil, ay);
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={ay} onChange={(e) => guncelle(yil, Number(e.target.value))} style={{ ...inputStyle, flex: 1.4 }}>
        {AY_ADLARI.map((ad, i) => <option key={i} value={i + 1}>{ad}</option>)}
      </select>
      <select value={yil} onChange={(e) => guncelle(Number(e.target.value), ay)} style={{ ...inputStyle, flex: 1 }}>
        {yilListesi.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

/** Bir kayıt (müşteri, personel, reklam, iş vb.) düzenleme ekranı açıkken, başka biri de aynı
 * kaydı açtıysa erken uyarı verir. Kilit sunucuda kısa ömürlü (TTL'li) tutulur, ekran açık
 * olduğu sürece periyodik "tazelenir"; ekran kapanınca kilit bırakılır. Vercel'in Hobby
 * planındaki 12 fonksiyon sınırına takılmamak için ayrı bir uç nokta yerine /api/data
 * üzerinden (kilitAction alanıyla) çalışır. */


/* --- Tarih, reklam ve ölçüm yardımcıları — birden çok ekran kullanıyor --- */

export function reklamDurumu(r) {
  if (!r.bitisTarihi) return "aktif";
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const bitis = new Date(r.bitisTarihi);
  const farkGun = Math.round((bitis - bugun) / 86400000);
  if (farkGun < 0) return "bitti";
  if (farkGun <= 3) return "yakinda";
  return "aktif";
}


export function reklamMetrikleri(r) {
  const erisim = Number(r.erisim) || 0;
  const gosterim = Number(r.gosterim) || 0;
  const tiklama = Number(r.tiklama) || 0;
  const butce = Number(r.butce) || 0;
  const sonuc = Number(r.sonuc) || 0;
  return {
    erisim, gosterim, tiklama, butce, sonuc,
    etkilesim: Number(r.etkilesim) || 0,
    // Tıklama oranı (CTR): gösterim başına tıklama
    ctr: gosterim > 0 ? (tiklama / gosterim) * 100 : null,
    // Tıklama başına maliyet
    tbm: tiklama > 0 && butce > 0 ? butce / tiklama : null,
    // Sonuç başına maliyet — müşteriye en anlamlı gelen rakam
    sonucMaliyeti: sonuc > 0 && butce > 0 ? butce / sonuc : null,
    // Bin gösterim başına maliyet
    bgm: gosterim > 0 && butce > 0 ? (butce / gosterim) * 1000 : null,
  };
}

export const istatistikVarMi = (r) => ["erisim", "gosterim", "tiklama", "etkilesim", "sonuc"].some((k) => Number(r[k]) > 0);


export const OLCUM_ALANLARI = [
  { key: "takipci", label: "Takipçi" },
  { key: "erisim", label: "Erişim" },
  { key: "profilZiyareti", label: "Profil Ziyareti" },
  { key: "siteTiklama", label: "Web Sitesi Tıklaması" },
];


export function olcumKarsilastir(olcumler, clientId, ay) {
  const kendi = (olcumler || []).filter((o) => String(o.clientId) === String(clientId));
  const buAy = kendi.find((o) => o.ay === ay) || null;
  // Bir önceki AY değil, bu aydan ÖNCEKİ EN YAKIN kayıt — arada boş ay varsa da çalışsın diye.
  const oncekiler = kendi.filter((o) => o.ay < ay).sort((a, b) => (a.ay > b.ay ? -1 : 1));
  const onceki = oncekiler[0] || null;
  const fark = {};
  OLCUM_ALANLARI.forEach(({ key }) => {
    const simdi = Number(buAy && buAy[key]) || 0;
    const eski = Number(onceki && onceki[key]) || 0;
    fark[key] = {
      simdi,
      eski,
      degisim: onceki ? simdi - eski : null,
      yuzde: onceki && eski > 0 ? ((simdi - eski) / eski) * 100 : null,
    };
  });
  return { buAy, onceki, fark };
}


export function basligiTemizle(metin) {
  if (!metin) return "";
  return String(metin).replace(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\s]+)/u, "").trim() || String(metin).trim();
}


export function tarihIso(d) {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
}
export function haftaBaslangici(d = new Date()) {
  const gun = (d.getDay() + 6) % 7; // Pazartesi=0
  const pazartesi = new Date(d);
  pazartesi.setDate(d.getDate() - gun);
  return tarihIso(pazartesi);
}

export function tarihGoster(str) {
  if (!str) return "—";
  const m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(str);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(str);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}


export const bugunISOTarih = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};


export function parseTrTarih(str) {
  if (!str) return null;
  // Tarih seçiciden gelen YYYY-AA-GG biçimi
  const iso = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const day = parseInt(iso[3], 10);
    const month = parseInt(iso[2], 10) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) return { day, month, year: Number(iso[1]) };
    return null;
  }
  const m = String(str).trim().match(/(\d{1,2})\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]+)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const token = m[2].toLowerCase().slice(0, 3);
  const monthIdx = TR_AYLAR_KISA.findIndex((a) => a === token);
  if (monthIdx === -1 || day < 1 || day > 31) return null;
  return { day, month: monthIdx };
}


export const TR_AYLAR_KISA = ["oca", "şub", "mar", "nis", "may", "haz", "tem", "ağu", "eyl", "eki", "kas", "ara"];
/* Tam ay adları — kısaltmalar grafik eksenlerinde iyi duruyor ama başlıkta "ağu 2026"
 * yazması hem eksik hem küçük harfle çirkin duruyordu. */
export const TR_AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/* DURUM GRUPLARI — yönetici listesindeki ayrım, müşteri panelindeki üç sekmeyle AYNI mantık
 * ve aynı adlar. Ortak yerde durur ki iki taraf aynı içeriği farklı adlandıramasın. */
export const DURUM_GRUBU = (durum) => (durum === "revize" ? "revize" : durum === "bekliyor" ? "bekliyor" : "onaylandi");
export const GRUP_BASLIK = {
  bekliyor: "Onay bekleyenler",
  revize: "Revize istedikleri",
  onaylandi: "Onayladıkları",
};

export const MUSTERI_DURUM_ETIKET = {
  bekliyor: { label: "Bekliyor", color: T.warning, bg: T.warningSoft },
  onaylandi: { label: "Onaylandı ✓", color: T.success, bg: T.successSoft },
  revize: { label: "Revize İstendi", color: T.danger, bg: T.dangerSoft },
};



/* --- Form ve düzenleme kilidi parçaları — birden çok ekran kullanıyor --- */

export function useDuzenlemeKilidi(tur, id, aktifMi, benKimim) {
  const [kilitleyen, setKilitleyen] = useState(null);
  useEffect(() => {
    if (!aktifMi || !id || !benKimim) { setKilitleyen(null); return; }
    let iptal = false;
    const kilitAl = () => {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ kilitAction: "al", tur, id, kisi: benKimim }),
      })
        .then((r) => r.json())
        .then((res) => { if (!iptal) setKilitleyen(res.kilitli ? res.kilitleyen : null); })
        .catch(() => {});
    };
    kilitAl();
    const interval = setInterval(kilitAl, 45000);
    return () => {
      iptal = true;
      clearInterval(interval);
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ kilitAction: "birak", tur, id, kisi: benKimim }),
      }).catch(() => {});
    };
    // eslint-disable-next-line
  }, [tur, id, aktifMi]);
  return kilitleyen;
}


export function KilitUyarisi({ kisi }) {
  if (!kisi) return null;
  return (
    <div style={{ background: T.warningSoft, color: T.warning, padding: "12px 15px", borderRadius: 10, fontSize: 13, fontFamily: "Inter", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
      <span>⚠️</span>
      <span><strong>{kisi}</strong> şu anda bu kaydı düzenliyor olabilir. Aynı anda ikiniz kaydederseniz, son kaydeden diğerinizin değişikliğini fark ettirmeden silebilir — önce onunla konuşman daha güvenli olur.</span>
    </div>
  );
}


/** Reklam eklerken/düzenlerken marka adını elle yazmak yerine Müşteriler listesinden seçebilmek
 * için — ama listede olmayan bir isim gerekiyorsa (henüz müşteri olarak eklenmemiş bir marka
 * için reklam girecekse) "Diğer (elle yaz)" ile serbest metne de geçilebiliyor. */
export function MarkaSecici({ value, onChange, clientList }) {
  const liste = clientList || [];
  const listedeVarMi = liste.some((c) => c.ad === value);
  const [serbest, setSerbest] = useState(!!value && !listedeVarMi);
  return (
    <div>
      <select
        value={serbest ? "__diger__" : (value || "")}
        onChange={(e) => {
          if (e.target.value === "__diger__") { setSerbest(true); onChange(""); }
          else { setSerbest(false); onChange(e.target.value); }
        }}
        style={inputStyle}
      >
        <option value="">Seç…</option>
        {liste.map((c) => <option key={c.id} value={c.ad}>{c.ad}</option>)}
        <option value="__diger__">Diğer (elle yaz)</option>
      </select>
      {serbest && (
        <input
          autoFocus
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Marka adını yaz"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      )}
    </div>
  );
}


/**
 * `ekBolum`: alan listesiyle anlatılamayan bir bölüm (örn. şube listesi) formun İÇİNDE,
 * Kaydet düğmesinin hemen üstünde çizilsin diye. Kartın dışına kardeş olarak
 * konulduğunda panelin altında sahipsiz duruyor ve forma ait olmadığı izlenimi veriyor.
 */
export function FieldForm({ fields, initial, onSubmit, onCancel, submitLabel = "Kaydet", clientList, ekBolum }) {
  const [values, setValues] = useState(() => {
    const v = {};
    fields.forEach((f) => {
      if (initial && initial[f.key] !== undefined) { v[f.key] = initial[f.key]; return; }
      if (f.type === "number") { v[f.key] = 0; return; }
      if (f.type === "select") { v[f.key] = f.options[0].value; return; }
      if (f.type === "month") { v[f.key] = new Date().toISOString().slice(0, 7); return; }
      if (f.type === "date") { v[f.key] = bugunISOTarih(); return; }
      v[f.key] = "";
    });
    return v;
  });
  return (
    <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: fields.length > 3 ? "1fr 1fr" : "1fr", gap: 10, padding: 14, background: T.surfaceRaised, borderRadius: 12, border: `1px solid ${T.border}` }}>
      {fields.map((f) => (
        <div key={f.key}>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter, sans-serif", display: "block", marginBottom: 4 }}>{f.label}</label>
          {f.type === "select" ? (
            <select value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={inputStyle}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "month" ? (
            <AySeciciAlan value={values[f.key]} onChange={(val) => setValues((v) => ({ ...v, [f.key]: val }))} />
          ) : f.type === "client-select" ? (
            <MarkaSecici value={values[f.key]} onChange={(val) => setValues((v) => ({ ...v, [f.key]: val }))} clientList={clientList} />
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              style={inputStyle}
            />
          )}
        </div>
      ))}
      {ekBolum ? <div style={{ gridColumn: "1 / -1" }}>{ekBolum}</div> : null}
      <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", marginTop: 2 }}>
        <button onClick={() => onSubmit(values)} style={saveBtnStyle}><Check size={13} /> {submitLabel}</button>
        <button onClick={onCancel} style={cancelBtnStyle}>İptal</button>
      </div>
    </div>
  );
}



/* İÇERİK TÜRÜ ETİKETLERİ — ORTAK
 * Yönetici paneli ve müşteri paneli AYNI etiketleri kullanır. Ayrı tanımlansaydı biri
 * "Reels" derken diğeri "Video" diyebilir, aynı içerik iki farklı adla görünürdü.
 * Renkler sabit seçildi: hem koyu hem açık temada okunur.
 *
 * (özgün açıklama)
 * Müşteri "Video / Fotoğraf / Grafik Tasarım" gibi üretim kategorilerini değil, kendi
 * dilindeki karşılıklarını görmeli: Reels, Görsel, Tasarım. Etiket hem renkli bir rozet
 * olarak hem de listeyi bölümlere ayırmak için kullanılıyor. */
export const TUR_ETIKET = {
  "Video": { ad: "Reels", renk: "#7C3AED", zemin: "#F1ECFD" },
  "Fotoğraf": { ad: "Görsel", renk: "#0E7490", zemin: "#E5F4F7" },
  /* Carousel müşterinin de kullandığı bir kelime — çeviriye gerek yok, yalnızca kendi
   * rengi olsun ki listede Görsel'le karışmasın. */
  "Carousel": { ad: "Karosel", renk: "#0F766E", zemin: "#E3F2F0" },
  "Grafik Tasarım": { ad: "Tasarım", renk: "#B45309", zemin: "#FDF3E7" },
  "cekim": { ad: "Çekim Planı", renk: "#5B5BD6", zemin: "#EEEEFB" },
  "video": { ad: "Reels", renk: "#7C3AED", zemin: "#F1ECFD" },
  "gorsel": { ad: "Görsel", renk: "#0E7490", zemin: "#E5F4F7" },
};
export const turEtiketi = (anahtar) => TUR_ETIKET[anahtar] || { ad: String(anahtar || "İçerik"), renk: "#6B7280", zemin: "rgba(107,114,128,0.14)" };

/** Küçük tür rozeti. */
export function TurRozet({ anahtar }) {
  const e = turEtiketi(anahtar);
  return (
    <span style={{
      display: "inline-block", padding: "6px 10px", borderRadius: 999,
      background: e.zemin, color: e.renk,
      fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {e.ad}
    </span>
  );
}

