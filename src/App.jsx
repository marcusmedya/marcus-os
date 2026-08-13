import React, { useState, useMemo, useRef, useEffect } from "react";
import TeklifSozlesme from "./TeklifSozlesme.jsx";
import CekimEditTakibi, { operasyonAylikHakEdis, operasyonKisiIsimleri } from "./CekimEditTakibi.jsx";
import {
  LayoutDashboard, Users, Wallet, Settings, Sparkles,
  ArrowUpRight, ArrowDownRight, X, Send, Plus, Pencil, Trash2, Check,
  ChevronRight,
  CircleDollarSign, Receipt, Landmark, CalendarClock, Search, Bell, Briefcase, PiggyBank, TrendingUp, Menu, Calendar, ChevronLeft, ListChecks, FileText, Megaphone, Share2, Lock, Camera, Shield, ClipboardCheck, Video, Copy, KeyRound, Eye, EyeOff, RefreshCw, CreditCard, NotebookPen, MonitorSmartphone
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { DEFAULT_DATA, BOS_DATA } from "./data.js";
import { gorseliKucult, base64Bayt, boyutYazisi } from "./gorselKucult.js";

/* ------------------------------------------------------------------ */
/* DESIGN TOKENS                                                       */
/* ------------------------------------------------------------------ */
const T = {
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

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

/** Gizlilik Modu: Ayarlar'dan açılıp kapanan, tüm ₺ tutarlarını "***" olarak gösteren bir
 * bayrak. fmt() her yerde kullanıldığı için, bunu tek bir global değişkende tutup fmt()'nin
 * içinde kontrol etmek, uygulamanın her köşesine tek tek dokunmaktan çok daha güvenli/hızlı. */
let GIZLILIK_MODU = (() => {
  try { return localStorage.getItem("marcus-os-gizlilik") === "1"; } catch (e) { return false; }
})();
const fmt = (n) => {
  if (GIZLILIK_MODU) return "₺ •••";
  return "₺" + (Number(n) || 0).toLocaleString("tr-TR");
};
const fmtShort = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + "b" : n);
const nextId = (arr) => (arr.length ? Math.max(...arr.map((i) => i.id || 0)) + 1 : 1);

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
function uyelikEfektifAktifMi(u) {
  if (u.aktif === true) return true; // elle aktif edilmiş, tarih geçmiş olsa bile sayılır
  if (u.aktif === false) return false; // elle pasif edilmiş
  if (u.bitisTarihi) {
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    if (new Date(u.bitisTarihi) < bugun) return false; // süresi dolmuş, otomatik pasif
  }
  return true; // varsayılan: aktif
}

function computeLive(data) {
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
  const personelGideri = (data.personel || []).reduce((s, p) => s + (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0), 0);
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
  return { recurring, extra, ciro, faturaliCiro, faturasizCiro, kdvTutari, kdvDahilToplamCiro, faturaliKdvDahil, giderKalemToplam, ofisGiderToplam, clientCosts, personelGideri, uyelikGideri, gider, net, manuelBekleyen, otomatikBekleyen, bekleyenToplam, tahsilEdilen, karMarji };
}

/** Bir müşterinin bu ayki ödeme durumunu, kayıtlı "ödeme günü"ne göre otomatik hesaplar. */
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Belirli bir ay için o müşteriden gerçekten tahsil edilen toplam tutar (kısmi ödemeler dahil).
 * Eski sistemde (odemeler dizisinde işaretli ama hiç ödeme kaydı yoksa) geriye dönük uyumluluk için
 * tam ödenmiş sayılır. */
function monthPaidAmount(client, key) {
  const kayitlar = (client.odemeKayitlari || []).filter((k) => k.ay === key);
  const sum = kayitlar.reduce((s, k) => s + (Number(k.tutar) || 0), 0);
  if (sum > 0) return sum;
  if ((client.odemeler || []).includes(key)) return Number(client.aylikUcret) || 0;
  return 0;
}
/** O ay için kalan (henüz ödenmemiş) bakiye. */
function monthRemaining(client, key) {
  return Math.max(0, (Number(client.aylikUcret) || 0) - monthPaidAmount(client, key));
}
/** O ay tam olarak ödenmiş mi? */
function isMonthPaid(client, key) {
  const tutar = Number(client.aylikUcret) || 0;
  if (tutar <= 0) return true;
  return monthPaidAmount(client, key) >= tutar;
}

function clientPaymentStatus(client) {
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
function clientOverdueMonths(client) {
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
function clientOverdueBalance(client) {
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

const DEFAULT_TEBLIG_SABLONU = `Sayın {musteri} Yetkilisi,

Firmanız ile aramızda devam etmekte olan hizmet ilişkisi kapsamında, aylık {aylikUcret} tutarındaki hizmet bedelinin {ay} aydır tarafımıza ödenmediği tespit edilmiştir.

Toplam Bakiye: {toplamBakiye}

İş bu bildirim tarihinden itibaren 7 (yedi) gün içerisinde yukarıda belirtilen toplam bakiyenin tarafımıza ödenmesini, aksi halde hizmetin askıya alınması ve/veya yasal yollara başvurulması hakkımızın saklı olduğunu bilgilerinize sunarız.

Herhangi bir ödeme yapıldıysa veya bir yanlışlık olduğunu düşünüyorsanız, en kısa sürede tarafımızla iletişime geçmenizi rica ederiz.

Saygılarımızla,
{firma}`;

/** Şablondaki {musteri}, {aylikUcret}, {ay}, {toplamBakiye}, {firma}, {tarih} yer tutucularını gerçek değerlerle değiştirir. */
function renderTeblig(sablon, vars) {
  let text = sablon || DEFAULT_TEBLIG_SABLONU;
  Object.entries(vars).forEach(([k, v]) => { text = text.split(`{${k}}`).join(String(v)); });
  return text;
}

/** Kullanıcı verisini yazdırılabilir HTML'e basmadan önce güvenli hale getirir (kod enjeksiyonunu engeller). */
const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Serbestçe düzenlenmiş tebliğ metnini yazdırılabilir HTML'e sarar. */
function tebligHtmlFromText(text, client, firmaAdi) {
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

function yazdirTebligMetni(text, client, firmaAdi) {
  const html = tebligHtmlFromText(text, client, firmaAdi);
  const win = window.open("", "_blank");
  if (!win) { window.alert("Yeni pencere açılamadı — tarayıcının pop-up engelleyicisini kontrol et."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function kopyalaMetin(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => window.alert("Metin kopyalandı — WhatsApp veya e-postaya yapıştırabilirsin.")).catch(() => window.alert("Kopyalanamadı."));
  } else {
    window.alert("Bu tarayıcıda otomatik kopyalama desteklenmiyor.");
  }
}


/** Bir müşterinin aylık ücretinin ne kadarının faturalı olduğunu döndürür (kısmi olabilir).
 * Yeni "faturaliTutar" alanı varsa onu kullanır (aylıkÜcret'i geçemez); yoksa eski evet/hayır
 * alanına bakar (geriye dönük uyumluluk). */
function clientFaturaliTutar(c) {
  const aylik = Number(c.aylikUcret) || 0;
  if (c.faturaliTutar !== undefined && c.faturaliTutar !== null && c.faturaliTutar !== "") {
    return Math.min(Math.max(Number(c.faturaliTutar) || 0, 0), aylik);
  }
  return c.faturali === "hayir" ? 0 : aylik;
}

/** Bir müşterinin kâr marjı: eğer o müşteriye maliyet eklenmişse (aylikUcret - maliyet)/aylikUcret
 * üzerinden otomatik hesaplanır; hiç maliyet eklenmemişse elle girilmiş karMarji alanı kullanılır. */
function clientKarMarji(c) {
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
const PW_KEY = "marcus-os-pw";
const OTURUM_KEY = "marcus-os-oturum";
const OTURUM_BITIS_KEY = "marcus-os-oturum-bitis";

const getOturum = () => {
  if (typeof window === "undefined") return "";
  try {
    const bitis = Number(localStorage.getItem(OTURUM_BITIS_KEY) || 0);
    if (bitis && Date.now() > bitis) { clearOturum(); return ""; }
    return localStorage.getItem(OTURUM_KEY) || "";
  } catch (e) { return ""; }
};
const setOturum = (token, sureSaniye) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OTURUM_KEY, token);
    localStorage.setItem(OTURUM_BITIS_KEY, String(Date.now() + (Number(sureSaniye) || 43200) * 1000));
    // Eski sürümlerden kalmış olabilecek düz şifreyi temizle — artık asla saklanmıyor.
    localStorage.removeItem(PW_KEY);
  } catch (e) { /* localStorage kapalıysa sessizce geç */ }
};
const clearOturum = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OTURUM_KEY);
    localStorage.removeItem(OTURUM_BITIS_KEY);
    localStorage.removeItem(PW_KEY);
  } catch (e) { /* sessizce geç */ }
};
/** Geriye dönük: eski sürümde saklanmış şifre varsa okunur ama artık hiç yazılmaz. */
const getPw = () => (typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "");
const setPw = (v) => { if (typeof window !== "undefined" && !v) localStorage.removeItem(PW_KEY); };

/** Kişiye özel personel girişi: kullanıcı adı + şifre, ayrı bir localStorage anahtarında. */
const STAFF_USER_KEY = "marcus-os-staff-user";
const STAFF_PW_KEY = "marcus-os-staff-pw";
const getStaffCreds = () => (typeof window !== "undefined" ? { kullaniciAdi: localStorage.getItem(STAFF_USER_KEY) || "", sifre: localStorage.getItem(STAFF_PW_KEY) || "" } : { kullaniciAdi: "", sifre: "" });
const setStaffCreds = (kullaniciAdi, sifre) => { if (typeof window !== "undefined") { localStorage.setItem(STAFF_USER_KEY, kullaniciAdi); localStorage.setItem(STAFF_PW_KEY, sifre); } };
const clearStaffCreds = () => { if (typeof window !== "undefined") { localStorage.removeItem(STAFF_USER_KEY); localStorage.removeItem(STAFF_PW_KEY); } };

/** Müşteri Paneli girişi — personelden tamamen ayrı bir kimlik. */
const MUSTERI_USER_KEY = "marcus-os-musteri-user";
const MUSTERI_PW_KEY = "marcus-os-musteri-pw";
const getMusteriCreds = () => (typeof window !== "undefined" ? { kullaniciAdi: localStorage.getItem(MUSTERI_USER_KEY) || "", sifre: localStorage.getItem(MUSTERI_PW_KEY) || "" } : { kullaniciAdi: "", sifre: "" });
const setMusteriCreds = (kullaniciAdi, sifre) => { if (typeof window !== "undefined") { localStorage.setItem(MUSTERI_USER_KEY, kullaniciAdi); localStorage.setItem(MUSTERI_PW_KEY, sifre); } };
const clearMusteriCreds = () => { if (typeof window !== "undefined") { localStorage.removeItem(MUSTERI_USER_KEY); localStorage.removeItem(MUSTERI_PW_KEY); } };

/** /api/data isteklerine hem olası tek-şifre hem de kişisel personel kimliğini ekler. */
const authHeaders = () => {
  const staff = getStaffCreds();
  const musteri = getMusteriCreds();
  return { "X-Oturum": getOturum(), "X-Site-Password": getPw(), "X-Staff-Username": staff.kullaniciAdi, "X-Staff-Password": staff.sifre, "X-Musteri-Username": musteri.kullaniciAdi, "X-Musteri-Password": musteri.sifre };
};

/** Ekran genişliğine göre mobil/masaüstü ayrımı yapar; pencere yeniden boyutlandırıldığında güncellenir. */
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

function Card({ children, style, className, ...rest }) {
  return (
    <div className={["marcus-card", className].filter(Boolean).join(" ")} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, ...style }} {...rest}>
      {children}
    </div>
  );
}

function Pill({ color, soft, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color, background: soft, padding: "4px 10px", borderRadius: 999, fontFamily: "Inter, sans-serif" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {children}
    </span>
  );
}

function KpiCard({ label, value, mono = true, delta, deltaYoy, accent }) {
  const up = delta >= 0;
  return (
    <Card style={{ padding: "18px 20px", flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: 0.2, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent || T.text, fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif", marginBottom: 10, letterSpacing: -0.5 }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: up ? T.success : T.danger, fontFamily: "Inter, sans-serif" }}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta)}% geçen aya göre
          </span>
          {deltaYoy !== undefined && (
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter, sans-serif" }}>yıllık {deltaYoy >= 0 ? "+" : ""}{deltaYoy}%</span>
          )}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text, margin: 0, letterSpacing: 0.1 }}>{children}</h2>
      {action}
    </div>
  );
}

const inputStyle = { width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 10px", color: T.text, fontSize: 16, fontFamily: "Inter, sans-serif", outline: "none" };
const saveBtnStyle = { background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minHeight: 40 };
const cancelBtnStyle = { background: "transparent", color: T.textDim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", minHeight: 40 };
const iconBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: 9, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 36 };
const addBtnStyle = { display: "flex", alignItems: "center", gap: 6, background: T.accentSoft, color: T.accentText, border: "none", borderRadius: 9, padding: "10px 15px", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", minHeight: 40 };

/** Generic small form for add/edit, driven by a field-definition list. */
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** Native <input type="month"> Safari masaüstünde desteklenmediği için (düz metin kutusuna
 * dönüşüyor ve yanlış/gün eklenmiş değerler kabul edilebiliyor), bunun yerine iki ayrı <select>
 * (Ay + Yıl) ile tüm tarayıcılarda garanti aynı şekilde çalışan bir seçici kullanılıyor. */
function AySeciciAlan({ value, onChange }) {
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
function useDuzenlemeKilidi(tur, id, aktifMi, benKimim) {
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

function KilitUyarisi({ kisi }) {
  if (!kisi) return null;
  return (
    <div style={{ background: T.warningSoft, color: T.warning, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontFamily: "Inter", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
      <span>⚠️</span>
      <span><strong>{kisi}</strong> şu anda bu kaydı düzenliyor olabilir. Aynı anda ikiniz kaydederseniz, son kaydeden diğerinizin değişikliğini fark ettirmeden silebilir — önce onunla konuşman daha güvenli olur.</span>
    </div>
  );
}

/** Reklam eklerken/düzenlerken marka adını elle yazmak yerine Müşteriler listesinden seçebilmek
 * için — ama listede olmayan bir isim gerekiyorsa (henüz müşteri olarak eklenmemiş bir marka
 * için reklam girecekse) "Diğer (elle yaz)" ile serbest metne de geçilebiliyor. */
function MarkaSecici({ value, onChange, clientList }) {
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

function FieldForm({ fields, initial, onSubmit, onCancel, submitLabel = "Kaydet", clientList }) {
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
      <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", marginTop: 2 }}>
        <button onClick={() => onSubmit(values)} style={saveBtnStyle}><Check size={13} /> {submitLabel}</button>
        <button onClick={onCancel} style={cancelBtnStyle}>İptal</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KARAR ŞERİDİ                                                          */
/* ------------------------------------------------------------------ */
function KararSeridi({ data, onAsk }) {
  const insight = useMemo(() => {
    const active = data.clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu");
    if (!active.length) return null;
    const live = computeLive(data);
    const enKarli = [...active].sort((a, b) => clientKarMarji(b) - clientKarMarji(a))[0];
    const enDusuk = [...active].sort((a, b) => clientKarMarji(a) - clientKarMarji(b))[0];
    const bagimlilik = live.ciro ? Math.round((enKarli.aylikUcret / live.ciro) * 100) : 0;
    return { enKarli, enDusuk, bagimlilik, enDusukMarji: clientKarMarji(enDusuk) };
  }, [data]);

  if (!insight) return null;

  return (
    <div style={{ background: `linear-gradient(90deg, ${T.accentSoft}, transparent 70%)`, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.accentText, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        <Sparkles size={14} /> BUGÜNÜN KARARI
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: T.text, flex: 1, minWidth: 260 }}>
        <b>{insight.enDusuk.ad}</b> kâr marjın en düşük müşterin (%{insight.enDusukMarji}) — fiyat güncellemesi ya da kapsam gözden geçirmesi gerekebilir.
        Ciron'un %{insight.bagimlilik}'i tek müşteriye ({insight.enKarli.ad}) bağlı.
      </div>
      <button onClick={onAsk} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
        AI CEO'ya sor <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DASHBOARD                                                            */
/* ------------------------------------------------------------------ */
function Dashboard({ data, onAsk }) {
  const { monthly } = data;
  const live = computeLive(data);
  const prev = monthly.length ? monthly[monthly.length - 1] : null;
  const ciroDelta = prev && prev.ciro ? Number((((live.ciro - prev.ciro) / prev.ciro) * 100).toFixed(1)) : undefined;
  const netDelta = prev && prev.net ? Number((((live.net - prev.net) / prev.net) * 100).toFixed(1)) : undefined;
  const giderDelta = prev && prev.gider ? Number((((live.gider - prev.gider) / prev.gider) * 100).toFixed(1)) : undefined;

  const chartData = [...monthly, { id: "live", ay: "Bu Ay", yil: new Date().getFullYear(), ciro: live.ciro, gider: live.gider, net: live.net }];

  return (
    <div>
      <KararSeridi data={data} onAsk={onAsk} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM CİRO (BU AY)" value={fmt(live.ciro)} delta={ciroDelta} />
        <KpiCard label="NET KAZANÇ" value={fmt(live.net)} delta={netDelta} accent={T.success} />
        <KpiCard label="TOPLAM GİDER" value={fmt(live.gider)} delta={giderDelta} />
        <KpiCard label="KÂR MARJI" value={`%${live.karMarji}`} mono />
        <KpiCard label="TAHSİL EDİLEN" value={fmt(live.tahsilEdilen)} />
        <KpiCard label="BEKLEYEN TAHSİLAT" value={fmt(live.bekleyenToplam)} mono accent={T.warning} />
      </div>

      <Card style={{ padding: "20px 22px", marginBottom: 22 }}>
        <SectionTitle>Ciro & Net Kazanç — Son Aylar + Bu Ay</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ left: -18, right: 8 }}>
            <defs>
              <linearGradient id="ciroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.success} stopOpacity={0.3} />
                <stop offset="100%" stopColor={T.success} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={T.borderSoft} vertical={false} />
            <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
            <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} labelStyle={{ color: T.text }} />
            <Area type="monotone" dataKey="ciro" stroke={T.accent} fill="url(#ciroGrad)" strokeWidth={2} name="Ciro" />
            <Area type="monotone" dataKey="net" stroke={T.success} fill="url(#netGrad)" strokeWidth={2} name="Net" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <AiOzet data={data} />
    </div>
  );
}

function AiOzet({ data }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setNotConfigured(false);
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({
        question:
          "Bugün için kısa bir CEO özeti hazırla. Bu ayki ciro/net/kâr marjı durumuna, en dikkat çeken 1-2 noktaya (örn. kâr marjı düşük müşteri, tek müşteriye bağımlılık) değin. " +
          "EĞER bekleyen ya da gecikmiş ödeme varsa (otomatikBekleyenMusteriler ya da manuelBekleyenTahsilatlar içinde), bunları isim isim ve tutarlarıyla MUTLAKA belirt — bu en önemli kısım. " +
          "3-4 cümle, doğrudan CEO'ya konuşur gibi, gereksiz giriş cümlesi kurmadan.",
        context: {
          ...data,
          buAyinGercekDurumu: computeLive(data),
          otomatikBekleyenMusteriler: data.clients
            .filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu")
            .map((c) => ({ ad: c.ad, tutar: c.aylikUcret, odemeDurumu: clientPaymentStatus(c) }))
            .filter((c) => c.odemeDurumu && (c.odemeDurumu.status === "bekliyor" || c.odemeDurumu.status === "gecikti")),
          manuelBekleyenTahsilatlar: data.bekleyenTahsilatlar,
        },
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const block = (res.content || []).find((c) => c.type === "text");
        if (block) { setText(block.text); return; }
        if (res.error && res.error.includes("ANTHROPIC_API_KEY")) { setNotConfigured(true); return; }
        if (res.error && res.error.includes("Yetkisiz")) { setNotConfigured(true); return; }
        setFailed(true);
        setText(res.error || "Özet oluşturulamadı.");
      })
      .catch(() => { if (!cancelled) { setFailed(true); setText("Bağlantı hatası — özet alınamadı."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  return (
    <Card style={{ padding: "20px 22px" }}>
      <SectionTitle action={<Pill color={T.accentText} soft={T.accentSoft}><Sparkles size={11} /> AI</Pill>}>AI CEO Özeti</SectionTitle>
      {loading ? (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textFaint }}>Özet hazırlanıyor…</div>
      ) : notConfigured ? (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textFaint, lineHeight: 1.7, margin: 0 }}>
          AI özeti şu an kapalı. Açmak istediğinde Ayarlar sekmesindeki adımları takip edebilirsin.
        </p>
      ) : (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: failed ? T.warning : T.textDim, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* MÜŞTERİLER                                                           */
/* ------------------------------------------------------------------ */
const CLIENT_FIELDS = [
  { key: "ad", label: "Müşteri Adı", type: "text" },
  { key: "kategori", label: "Kategori", type: "text" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "aktif", label: "Aktif" }, { value: "yeni", label: "Yeni" }, { value: "donduruldu", label: "Donduruldu" }, { value: "ayrildi", label: "Ayrıldı" }] },
  { key: "email", label: "Yetkili E-postası (opsiyonel — ödeme hatırlatması için)", type: "text", placeholder: "yetkili@marka.com" },
  { key: "telefon", label: "Yetkili Telefonu (opsiyonel — WhatsApp için, ülke koduyla)", type: "text", placeholder: "905XXXXXXXXX" },
  { key: "aylikUcret", label: "Aylık Ücret (₺)", type: "number" },
  { key: "karMarji", label: "Kâr Marjı (%) — müşteri detayında maliyet eklersen otomatik hesaplanır", type: "number" },
  { key: "odemeGunu", label: "Ödeme Günü (ayın kaçı — opsiyonel, örn. 5)", type: "number" },
  { key: "faturaliTutar", label: "Faturalı Tutar (₺/ay) — aylık ücretin ne kadarı faturalı? Kalanı otomatik faturasız sayılır", type: "number" },
  { key: "baslangic", label: "Başlangıç Ayı (ne zaman çalışmaya başladınız)", type: "month" },
  { key: "odemeSekli", label: "Ödeme Şekli", type: "select", options: [{ value: "pesin", label: "Peşin (ay başında/önceden)" }, { value: "sonra", label: "Sonra (ay sonunda/hizmet sonrası)" }] },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

const CLIENT_DURUM = {
  aktif: { label: "Aktif", color: T.success, soft: T.successSoft },
  yeni: { label: "Yeni", color: T.accentText, soft: T.accentSoft },
  donduruldu: { label: "❄️ Donduruldu", color: T.warning, soft: T.warningSoft },
  ayrildi: { label: "Ayrıldı", color: T.textFaint, soft: T.borderSoft },
};

function Musteriler({ clients, bekleyenTahsilatlar, hesaplar, freelancerlar, onAdd, onUpdate, onDelete, onAddCost, onDeleteCost, onMarkPaid, onMarkUnpaid, onOpenTeblig, onAddOdemeKaydi, onDeleteOdemeKaydi, openClient, onOpenClientHandled, duzenleyenAdi, musteriIcerikleri, onAddIcerik, onUpdateIcerik, onDeleteIcerik, firmaAdi }) {
  const [filter, setFilter] = useState("hepsi");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailClientId, setDetailClientId] = useState(null);

  useEffect(() => {
    if (openClient) { setDetailClientId(openClient.id); onOpenClientHandled && onOpenClientHandled(); }
    // eslint-disable-next-line
  }, [openClient]);

  const active = clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu");
  const enKarli = active.length ? [...active].sort((a, b) => clientKarMarji(b) - clientKarMarji(a))[0] : null;
  const enDusuk = active.length ? [...active].sort((a, b) => clientKarMarji(a) - clientKarMarji(b))[0] : null;
  const ortalamaGelir = active.length ? Math.round(active.reduce((s, c) => s + c.aylikUcret, 0) / active.length) : 0;
  const filtered = clients.filter((c) => (filter === "hepsi" ? true : c.durum === filter));

  const odenmeyenler = active
    .map((c) => ({ client: c, ay: clientOverdueMonths(c) }))
    .filter((x) => x.ay > 0)
    .sort((a, b) => b.ay - a.ay);

  return (
    <div>
      {odenmeyenler.length > 0 && (
        <Card style={{ padding: "16px 18px", marginBottom: 16, border: `1px solid ${T.danger}` }}>
          <SectionTitle>⚠️ Ödenmeyen Ödemeler ({odenmeyenler.length})</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {odenmeyenler.map(({ client: c, ay }) => {
              const toplam = (Number(c.aylikUcret) || 0) * ay;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{c.ad}</div>
                    <div style={{ fontSize: 11.5, color: T.danger, fontFamily: "Inter" }}>{ay} aydır ödenmedi · Toplam {fmt(toplam)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={saveBtnStyle} onClick={() => onOpenTeblig(c, ay, toplam)}>Tebliğ Oluştur / Düzenle</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
            "Tebliğ Oluştur" yeni bir pencerede resmi bir yazı açar ve yazdırma penceresini getirir — oradan "PDF olarak kaydet" seçeneğiyle dosya indirebilirsin.
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="AKTİF MÜŞTERİ" value={clients.filter((c) => c.durum === "aktif").length} mono={false} />
        <KpiCard label="YENİ MÜŞTERİ" value={clients.filter((c) => c.durum === "yeni").length} mono={false} accent={T.success} />
        <KpiCard label="MÜŞTERİ BAŞI ORT. GELİR" value={fmt(ortalamaGelir)} />
        <KpiCard label="EN KÂRLI" value={enKarli ? enKarli.ad : "—"} mono={false} accent={T.success} />
        <KpiCard label="EN DÜŞÜK KÂRLI" value={enDusuk ? enDusuk.ad : "—"} mono={false} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["hepsi", "Hepsi"], ["aktif", "Aktif"], ["yeni", "Yeni"], ["donduruldu", "Donduruldu"], ["ayrildi", "Ayrılan"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? T.accentSoft : "transparent", color: filter === k ? T.accentText : T.textDim, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Yeni müşteri ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm
            fields={CLIENT_FIELDS}
            onSubmit={(v) => {
              onAdd(v);
              setAdding(false);
              window.alert(`"${v.ad}" eklendi.\n\nMarkalaşma süreci otomatik oluşturuldu — Operasyon sekmesine git, üstteki "Markalaşma" butonuna tıkla, orada "${v.ad}" markasını göreceksin. Oradan bir yönetici atayabilirsin (atadığın an ona bildirim e-postası gider).`);
            }}
            onCancel={() => setAdding(false)}
            submitLabel="Müşteriyi Ekle"
          />
        </div>
      )}

      <Card style={{ padding: 4 }}>
        <div className="marcus-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 640 }}>
          <thead>
            <tr>
              {["Müşteri", "Kategori", "Durum", "Ödeme", "Aylık Ücret", "Kâr Marjı", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 4 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td colSpan={7} style={{ padding: "12px 16px" }}>
                    <FieldForm fields={CLIENT_FIELDS} initial={{ ...c, faturaliTutar: clientFaturaliTutar(c) }} onSubmit={(v) => { onUpdate(c.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetailClientId(c.id)}>{c.ad}</div>
                    {c.not && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{c.not}</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{c.kategori}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {(() => {
                      const cd = CLIENT_DURUM[c.durum] || CLIENT_DURUM.aktif;
                      return <Pill color={cd.color} soft={cd.soft}>{cd.label}</Pill>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {(() => {
                      const st = clientPaymentStatus(c);
                      if (!st) return <span style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>—</span>;
                      const map = { odendi: { c: T.success, s: T.successSoft, l: "Ödendi" }, yaklasiyor: { c: T.textFaint, s: T.borderSoft, l: "Yaklaşıyor" }, bekliyor: { c: T.warning, s: T.warningSoft, l: "Bekliyor" }, gecikti: { c: T.danger, s: T.dangerSoft, l: "Gecikti" } };
                      const m = map[st.status];
                      return <Pill color={m.c} soft={m.s}>{m.l}</Pill>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {c.aylikUcret ? fmt(c.aylikUcret) : "—"}
                    {c.aylikUcret > 0 && (() => {
                      const ft = clientFaturaliTutar(c);
                      const full = ft >= c.aylikUcret;
                      const none = ft <= 0;
                      const symbol = full ? "●" : none ? "○" : "◐";
                      const title = full ? "Tamamen faturalı (KDV %20)" : none ? "Faturasız" : `Kısmi faturalı: ${fmt(ft)} faturalı, ${fmt(c.aylikUcret - ft)} faturasız`;
                      return <span title={title} style={{ marginLeft: 6, fontSize: 10, color: full ? T.success : none ? T.textFaint : T.warning }}>{symbol}</span>;
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {(() => {
                      const km = clientKarMarji(c);
                      const color = km >= 55 ? T.success : km >= 35 ? T.warning : T.danger;
                      const hasCosts = (c.maliyetler || []).length > 0;
                      return (
                        <span style={{ color }} title={hasCosts ? "Maliyetlerden otomatik hesaplandı" : undefined}>
                          {c.aylikUcret ? `%${km}` : "—"}{hasCosts && <span style={{ color: T.textFaint, fontSize: 10 }}> •</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={iconBtnStyle} onClick={() => { setEditingId(c.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${c.ad} silinsin mi?`)) onDelete(c.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Bu filtrede müşteri yok.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
        Aylık Ücret yanındaki <span style={{ color: T.success }}>●</span> tamamen faturalı, <span style={{ color: T.warning }}>◐</span> kısmi faturalı, <span>○</span> faturasız demektir.
      </div>

      {detailClientId && (
        <ClientDetailKilitli
          client={clients.find((c) => c.id === detailClientId)}
          bekleyenTahsilatlar={bekleyenTahsilatlar.filter((b) => b.musteri === (clients.find((c) => c.id === detailClientId) || {}).ad)}
          hesaplar={hesaplar}
          freelancerlar={freelancerlar}
          onAddCost={(cost) => onAddCost(detailClientId, cost)}
          onDeleteCost={(costId) => onDeleteCost(detailClientId, costId)}
          onMarkPaid={() => onMarkPaid(detailClientId)}
          onMarkUnpaid={() => onMarkUnpaid(detailClientId)}
          onOpenTeblig={onOpenTeblig}
          onAddOdemeKaydi={onAddOdemeKaydi}
          onDeleteOdemeKaydi={onDeleteOdemeKaydi}
          onClose={() => setDetailClientId(null)}
          duzenleyenAdi={duzenleyenAdi}
          detailClientId={detailClientId}
          musteriIcerikleri={musteriIcerikleri}
          onUpdateIcerik={onUpdateIcerik}
          onAddIcerik={onAddIcerik}
          firmaAdi={firmaAdi}
          onDeleteIcerik={onDeleteIcerik}
        />
      )}
    </div>
  );
}

/** ClientDetail'i açarken/kapatırken düzenleme kilidini de yönetir. */
/** Ödemesi geciken/bekleyen bir müşteriye e-posta ve/veya WhatsApp ile nazik bir hatırlatma
 * göndermek için — DevirTeslimFormu ile aynı /api/notify-job uç noktasını (mod: "odemeHatirlatma") kullanır. */
function OdemeHatirlatmasiGonder({ client, tutar, ayAdi, firmaAdi, baslangictaAcik }) {
  const [acik, setAcik] = useState(!!baslangictaAcik);
  const [email, setEmail] = useState(client.email || "");
  const [telefon, setTelefon] = useState(client.telefon || "");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState("");

  const mesajMetni = () => {
    let m = `Sayın ${client.ad} yetkilisi,\n\n${ayAdi ? `${ayAdi} dönemine ait` : "Güncel"} ödemenizle ilgili nazik bir hatırlatma yapmak isteriz.`;
    if (tutar) m += `\n\nTutar: ₺${tutar}`;
    if (client.odemeGunu) m += `\nÖdeme günü: Ayın ${client.odemeGunu}'i`;
    m += `\n\nÖdemenizi zaten gerçekleştirdiyseniz bu mesajı dikkate almayınız.\n\nİyi çalışmalar dileriz.\n${firmaAdi || "Marcus Medya App"}`;
    return m;
  };

  const epostaGonder = () => {
    if (!email.trim()) { setSonuc("E-posta adresi gerekli."); return; }
    setGonderiliyor(true);
    setSonuc("");
    fetch("/api/notify-job", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: email.trim(), marka: client.ad, tutar, ayAdi, odemeGunu: client.odemeGunu, firmaAdi, mod: "odemeHatirlatma" }),
    })
      .then((r) => r.json())
      .then((res) => setSonuc(res.ok ? "✅ E-posta gönderildi." : "❌ " + (res.reason || res.error || "Gönderilemedi.")))
      .catch(() => setSonuc("❌ Bağlantı hatası."))
      .finally(() => setGonderiliyor(false));
  };

  const whatsappAc = () => {
    if (!telefon.trim()) { setSonuc("WhatsApp için telefon numarası gerekli (ülke koduyla, örn. 90532...)."); return; }
    const numara = telefon.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesajMetni())}`, "_blank");
  };

  if (!acik) {
    return <button onClick={() => setAcik(true)} style={{ ...cancelBtnStyle, fontSize: 12 }}>✉️ Ödeme Hatırlatması Gönder</button>;
  }

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 12, marginTop: 10 }}>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input type="text" placeholder="Müşteri e-postası" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }} />
        <input type="text" placeholder="WhatsApp telefonu (905XXXXXXXXX)" value={telefon} onChange={(e) => setTelefon(e.target.value)} style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={saveBtnStyle} onClick={epostaGonder} disabled={gonderiliyor}>{gonderiliyor ? "Gönderiliyor…" : "E-posta Gönder"}</button>
        <button style={{ ...saveBtnStyle, background: "#25D366" }} onClick={whatsappAc}>WhatsApp'ta Aç</button>
        <button style={cancelBtnStyle} onClick={() => setAcik(false)}>Kapat</button>
      </div>
      {sonuc && <div style={{ fontSize: 12, color: sonuc.startsWith("✅") ? T.success : T.danger, marginTop: 8 }}>{sonuc}</div>}
    </div>
  );
}

function ClientDetailKilitli({ detailClientId, duzenleyenAdi, ...props }) {
  const kilitleyen = useDuzenlemeKilidi("client", detailClientId, true, duzenleyenAdi);
  return <ClientDetail {...props} kilitleyen={kilitleyen} />;
}

const COST_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text", placeholder: "örn. Videographer Payı" },
  { key: "tutar", label: "Tutar (₺/ay)", type: "number" },
];

/** Maliyet formu, kayıtlı freelancer'lardan birine bağlanabilsin diye alanları dinamik üretir.
 * Bağlanan maliyet, o kişinin Personel > Freelancer sekmesindeki aylık hak edişine sayılır —
 * böylece müşteri detayında girilen "Videographer Payı" gibi kalemler elle kopyalanmadan
 * doğrudan freelancer ödemesine dönüşür. */
function costFieldsWithFreelancers(freelancerlar) {
  const liste = freelancerlar || [];
  if (liste.length === 0) return COST_FIELDS;
  return [
    ...COST_FIELDS,
    {
      key: "freelancerId",
      label: "Kime ödenecek? (opsiyonel — freelancer)",
      type: "select",
      options: [{ value: "", label: "— kimseye bağlama —" }, ...liste.map((f) => ({ value: String(f.id), label: f.ad }))],
    },
  ];
}

/** Base64'e çevrilebilecek makul boyutta bir görsel — çok büyük dosyalarda tarayıcıyı ve
 * veritabanını zorlamamak için basit bir boyut uyarısı (2MB üstü) veriliyor. */
function gorseliBase64eCevir(file, onDone, onHata) {
  // Artık boyut sınırı yok — görsel tarayıcıda otomatik küçültülüp sıkıştırılıyor.
  // Telefondan çekilmiş 5 MB'lık bir fotoğraf da sorunsuz yükleniyor, veritabanına
  // birkaç yüz KB olarak gidiyor.
  gorseliKucult(file).then(onDone).catch((e) => onHata(e.message || "Görsel işlenemedi."));
}

/** Başlığın başına elle yazılmış 🎬 gibi işaretleri temizler — arayüz zaten kendi
 * ikonunu koyduğu için, yoksa "🎬 🎬 🎬 Konu Başlığı" gibi üst üste binmiş görünüyordu. */
function basligiTemizle(metin) {
  if (!metin) return "";
  return String(metin).replace(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\s]+)/u, "").trim() || String(metin).trim();
}

const MUSTERI_DURUM_ETIKET = {
  bekliyor: { label: "Bekliyor", color: T.warning, bg: T.warningSoft },
  onaylandi: { label: "Onaylandı ✓", color: T.success, bg: T.successSoft },
  revize: { label: "Revize İstendi", color: T.danger, bg: T.dangerSoft },
};

/** Bir markanın Müşteri Paneli'nde göreceği içerikleri (görsel/video) ekleyip listeleyen,
 * ClientDetail içine gömülü, kendi başına açılıp kapanan bir bölüm. */
/**
 * Müşteri Paneli içerik motoru — hem eski katlanır kart olarak (kompakt) hem de
 * Müşteri Paneli sekmesinde tam sayfa olarak (kompakt=false) kullanılır.
 * Tek bir yerde tanımlı olduğu için iki görünüm asla birbirinden ayrışmaz.
 */
function IcerikYonetimMotoru({ clientId, icerikler, onAdd, onUpdate, onDelete, kompakt = true, baslangicAcik = false }) {
  const [acik, setAcik] = useState(baslangicAcik);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null); // düzenlenen kaydın id'si (yoksa yeni ekleme)
  const [tur, setTur] = useState("gorsel");
  const [aciklama, setAciklama] = useState("");
  const [driveLinki, setDriveLinki] = useState("");
  const [gorselUrl, setGorselUrl] = useState(null);
  const [gorselHata, setGorselHata] = useState("");
  const [acikDetayId, setAcikDetayId] = useState(null); // detayı açık olan çekim planı
  // Çekim planı alanları
  const [konusmali, setKonusmali] = useState("konusmali");
  const [konusmaMetni, setKonusmaMetni] = useState("");
  const [cekimNotu, setCekimNotu] = useState("");
  const [planlananTarih, setPlanlananTarih] = useState("");

  const kendiListesi = (icerikler || []).filter((i) => String(i.clientId) === String(clientId)).sort((a, b) => (a.durum === "bekliyor" ? -1 : 1));

  const formuTemizle = () => {
    setAciklama(""); setDriveLinki(""); setGorselUrl(null); setGorselHata("");
    setKonusmaMetni(""); setCekimNotu(""); setPlanlananTarih(""); setKonusmali("konusmali");
    setEkleAcik(false); setDuzenlenenId(null);
  };

  /** Bir kaydı düzenlemek için formu onun bilgileriyle doldurur. */
  const duzenlemeyeAl = (i) => {
    setDuzenlenenId(i.id);
    setTur(i.tur || "gorsel");
    setAciklama(i.aciklama || "");
    setDriveLinki(i.tur === "cekim" ? (i.referansLink || "") : (i.driveLinki || ""));
    setGorselUrl(i.gorselUrl || null);
    setKonusmali(i.konusmali || "konusmali");
    setKonusmaMetni(i.konusmaMetni || "");
    setCekimNotu(i.cekimNotu || "");
    setPlanlananTarih(i.planlananTarih || "");
    setGorselHata("");
    setEkleAcik(true);
    setAcikDetayId(null);
  };

  const ekle = () => {
    if (tur === "gorsel" && !gorselUrl) { setGorselHata("Bir görsel seç."); return; }
    if (tur === "video" && !driveLinki.trim()) { setGorselHata("Video için bir Drive linki gir."); return; }
    if (tur === "cekim" && !aciklama.trim()) { setGorselHata("Çekim planına bir başlık yaz (örn. \"Reels 1 — Ürün tanıtımı\")."); return; }
    const govdeVerisi = {
      tur,
      aciklama: aciklama.trim(),
      gorselUrl: tur === "gorsel" ? gorselUrl : null,
      driveLinki: tur === "video" ? driveLinki.trim() : null,
      // Çekim planına özel alanlar — diğer türlerde boş kalır
      referansLink: tur === "cekim" ? driveLinki.trim() : null,
      konusmali: tur === "cekim" ? konusmali : null,
      konusmaMetni: tur === "cekim" ? konusmaMetni.trim() : null,
      cekimNotu: tur === "cekim" ? cekimNotu.trim() : null,
      planlananTarih: tur === "cekim" ? (planlananTarih || null) : null,
    };

    if (duzenlenenId != null) {
      // Düzenlenen içerik müşteriye tekrar sunulur: durum "bekliyor"a döner ve varsa eski
      // revize notu temizlenir — yoksa müşteri değiştirdiğin metni onaylayamaz, ekranında
      // eski "revize istendi" durumu asılı kalırdı.
      onUpdate(duzenlenenId, { ...govdeVerisi, durum: "bekliyor", revizeNotu: null, guncellemeTarihi: new Date().toLocaleDateString("tr-TR") });
    } else {
      onAdd(clientId, { ...govdeVerisi, tarih: new Date().toLocaleDateString("tr-TR") });
    }
    formuTemizle();
  };

  const govde = (
    <>
          {kendiListesi.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginBottom: 12 }}>Bu markaya henüz müşteri panelinde gösterilecek bir içerik eklenmedi.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {kendiListesi.map((i) => {
                const etiket = MUSTERI_DURUM_ETIKET[i.durum] || MUSTERI_DURUM_ETIKET.bekliyor;
                return (
                  <div key={i.id} style={{ background: T.surfaceRaised, borderRadius: 9, padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <button
                        onClick={() => { if (i.tur === "cekim") setAcikDetayId(acikDetayId === i.id ? null : i.id); }}
                        style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: i.tur === "cekim" ? "pointer" : "default", fontFamily: "inherit", flex: 1, minWidth: 0 }}
                        title={i.tur === "cekim" ? "Çekim planının detayını göster" : undefined}
                      >
                        <div style={{ fontSize: 12, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>
                          {i.tur === "cekim" && <span style={{ color: T.accentText, fontWeight: 700 }}>🎬 </span>}
                          {basligiTemizle(i.aciklama) || (i.tur === "gorsel" ? "Görsel" : i.tur === "cekim" ? "Çekim Planı" : "Video")} <span style={{ color: T.textFaint, fontWeight: 400 }}>· {i.tarih}</span>
                          {i.guncellemeTarihi && <span style={{ color: T.textFaint, fontWeight: 400 }}> · düzenlendi {i.guncellemeTarihi}</span>}
                        </div>
                        {i.revizeNotu && <div style={{ fontSize: 11, color: T.danger, fontFamily: "Inter", fontStyle: "italic" }}>"{i.revizeNotu}"</div>}
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: etiket.color, background: etiket.bg, padding: "2px 8px", borderRadius: 999, fontFamily: "Inter" }}>{etiket.label}</span>
                        {onUpdate && (
                          <button title="Düzenle" onClick={() => duzenlemeyeAl(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Pencil size={12} color={T.textFaint} /></button>
                        )}
                        <button title="Sil" onClick={() => { if (window.confirm("Bu içerik silinsin mi?")) onDelete(i.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={12} color={T.textFaint} /></button>
                      </div>
                    </div>

                    {i.tur === "cekim" && acikDetayId === i.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          {i.konusmali && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: T.accentText, background: T.accentSoft, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>
                              {i.konusmali === "konusmali" ? "KONUŞMALI" : i.konusmali === "seslendirme" ? "DIŞ SES" : "KONUŞMASIZ"}
                            </span>
                          )}
                          {i.planlananTarih && <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>Planlanan çekim: {tarihGoster(i.planlananTarih)}</span>}
                        </div>
                        {i.referansLink && (
                          <a href={i.referansLink} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11.5, color: T.accentText, fontFamily: "Inter", marginBottom: 8 }}>▶ Referans videoyu aç ↗</a>
                        )}
                        {i.konusmaMetni && (
                          <>
                            <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 700, marginBottom: 4 }}>
                              {i.konusmali === "seslendirme" ? "DIŞ SES METNİ" : "KONUŞMA METNİ"}
                            </div>
                            <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", lineHeight: 1.7, whiteSpace: "pre-wrap", background: T.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{i.konusmaMetni}</div>
                          </>
                        )}
                        {i.cekimNotu && (
                          <>
                            <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 700, marginBottom: 4 }}>ÇEKİM NOTU</div>
                            <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{i.cekimNotu}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ekleAcik ? (
            <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 12 }}>
              {duzenlenenId != null && (
                <div style={{ fontSize: 11.5, color: T.warning, fontFamily: "Inter", marginBottom: 8, lineHeight: 1.6 }}>
                  Düzenleme modundasın. Kaydedince bu içerik müşteriye <strong>yeniden onaya</strong> gider ve durumu "Bekliyor"a döner.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => { setTur("gorsel"); setGorselHata(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: tur === "gorsel" ? T.accent : T.surface, color: tur === "gorsel" ? "#fff" : T.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter" }}>Görsel</button>
                <button onClick={() => { setTur("video"); setGorselHata(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: tur === "video" ? T.accent : T.surface, color: tur === "video" ? "#fff" : T.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter" }}>Video</button>
                <button onClick={() => { setTur("cekim"); setGorselHata(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: tur === "cekim" ? T.accent : T.surface, color: tur === "cekim" ? "#fff" : T.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter" }}>Çekim Planı</button>
              </div>
              <input
                type="text"
                placeholder={tur === "cekim" ? "Başlık — örn. Reels 1: Ürün tanıtımı" : "Açıklama (opsiyonel — örn. Ağustos Reels 1)"}
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }}
              />
              {tur === "gorsel" && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    setGorselHata("");
                    gorseliBase64eCevir(file, setGorselUrl, setGorselHata);
                  }}
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 12, padding: "7px 10px" }}
                />
              )}
              {tur === "video" && (
                <input type="text" placeholder="https://drive.google.com/..." value={driveLinki} onChange={(e) => setDriveLinki(e.target.value)} style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }} />
              )}
              {tur === "cekim" && (
                <>
                  <input
                    type="text"
                    placeholder="Referans video linki (Drive, Instagram, TikTok — opsiyonel)"
                    value={driveLinki}
                    onChange={(e) => setDriveLinki(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {[
                      { key: "konusmali", label: "Konuşmalı" },
                      { key: "konusmasiz", label: "Konuşmasız" },
                      { key: "seslendirme", label: "Dış ses" },
                    ].map((x) => (
                      <button
                        key={x.key}
                        onClick={() => setKonusmali(x.key)}
                        style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: konusmali === x.key ? T.accentSoft : T.surface, color: konusmali === x.key ? T.accentText : T.textDim, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter" }}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                  {konusmali !== "konusmasiz" && (
                    <textarea
                      placeholder={konusmali === "seslendirme" ? "Dış ses metni — videoda okunacak metin" : "Konuşma metni — kamera karşısında söylenecekler"}
                      value={konusmaMetni}
                      onChange={(e) => setKonusmaMetni(e.target.value)}
                      rows={5}
                      style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "8px 10px", width: "100%", resize: "vertical", fontFamily: "Inter", lineHeight: 1.6 }}
                    />
                  )}
                  <textarea
                    placeholder="Çekim notu (opsiyonel) — mekan, kıyafet, aksesuar, plan detayı"
                    value={cekimNotu}
                    onChange={(e) => setCekimNotu(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "8px 10px", width: "100%", resize: "vertical", fontFamily: "Inter" }}
                  />
                  <input
                    type="date"
                    value={planlananTarih}
                    onChange={(e) => setPlanlananTarih(e.target.value)}
                    title="Planlanan çekim tarihi (opsiyonel)"
                    style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }}
                  />
                </>
              )}
              {gorselHata && <div style={{ color: T.danger, fontSize: 11.5, fontFamily: "Inter", marginBottom: 8 }}>{gorselHata}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={cancelBtnStyle} onClick={formuTemizle}>İptal</button>
                <button style={saveBtnStyle} onClick={ekle}>{duzenlenenId != null ? "Değişiklikleri Kaydet" : (tur === "cekim" ? "Çekim Planını Gönder" : "Müşteri Paneline Ekle")}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={saveBtnStyle} onClick={() => { setTur("cekim"); setEkleAcik(true); }}>🎬 Yeni Çekim Planı</button>
              <button style={addBtnStyle} onClick={() => { setTur("gorsel"); setEkleAcik(true); }}><Plus size={13} /> İçerik Ekle</button>
            </div>
          )}
    </>
  );

  if (!kompakt) return <div>{govde}</div>;

  return (
    <Card style={{ padding: "14px 18px", marginBottom: 16 }}>
      <button onClick={() => setAcik((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <span style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>Müşteri Paneli İçerikleri <span style={{ fontWeight: 400, color: T.textFaint, fontSize: 11 }}>· asıl yönetim: Müşteri Paneli sekmesi</span></span>
        <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{kendiListesi.length > 0 ? `${kendiListesi.length} kayıt` : "Kayıt yok"} {acik ? "▲" : "▼"}</span>
      </button>
      {acik && <div style={{ marginTop: 14 }}>{govde}</div>}
    </Card>
  );
}

function ClientDetail({ client, bekleyenTahsilatlar, hesaplar, freelancerlar, onAddCost, onDeleteCost, onMarkPaid, onMarkUnpaid, onOpenTeblig, onAddOdemeKaydi, onDeleteOdemeKaydi, onClose, kilitleyen, musteriIcerikleri, onAddIcerik, onUpdateIcerik, onDeleteIcerik, firmaAdi }) {
  const [addingCost, setAddingCost] = useState(false);
  const [odemeModalOpen, setOdemeModalOpen] = useState(false);
  if (!client) return null;
  const cd = CLIENT_DURUM[client.durum] || CLIENT_DURUM.aktif;
  const bekleyenToplam = bekleyenTahsilatlar.reduce((s, b) => s + (Number(b.tutar) || 0), 0);
  const maliyetler = client.maliyetler || [];
  const maliyetToplam = maliyetler.reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  const km = clientKarMarji(client);
  const paymentStatus = clientPaymentStatus(client);
  const overdueMonths = clientOverdueMonths(client);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="marcus-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 560, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 600, color: T.text, margin: 0 }}>{client.ad}</h2>
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginTop: 4 }}>{client.kategori} · {client.baslangic}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} color={T.textFaint} /></button>
        </div>

        <KilitUyarisi kisi={kilitleyen} />

        <IcerikYonetimMotoru clientId={client.id} icerikler={musteriIcerikleri} onAdd={onAddIcerik} onUpdate={onUpdateIcerik} onDelete={onDeleteIcerik} />

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <Pill color={cd.color} soft={cd.soft}>{cd.label}</Pill>
          <Pill color={T.text} soft={T.borderSoft}>Aylık {fmt(client.aylikUcret)}</Pill>
          <Pill color={km >= 55 ? T.success : km >= 35 ? T.warning : T.danger} soft={T.borderSoft}>Kâr Marjı %{km}{maliyetler.length > 0 && " (otomatik)"}</Pill>
          {(() => {
            const ft = clientFaturaliTutar(client);
            const full = client.aylikUcret > 0 && ft >= client.aylikUcret;
            const none = ft <= 0;
            if (full) return <Pill color={T.success} soft={T.successSoft}>Tamamen Faturalı · KDV %20</Pill>;
            if (none) return <Pill color={T.textFaint} soft={T.borderSoft}>Faturasız</Pill>;
            return <Pill color={T.warning} soft={T.warningSoft}>Kısmi: {fmt(ft)} faturalı / {fmt(client.aylikUcret - ft)} faturasız</Pill>;
          })()}
          {bekleyenToplam > 0 && <Pill color={T.warning} soft={T.warningSoft}>Bekleyen {fmt(bekleyenToplam)}</Pill>}
        </div>

        {client.not && (
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", marginBottom: 20, padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10 }}>{client.not}</div>
        )}

        {paymentStatus && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20, padding: "12px 14px", background: T.surfaceRaised, borderRadius: 12, border: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 3 }}>BU AYIN ÖDEMESİ</div>
              <div style={{ fontSize: 13.5, fontFamily: "Inter", fontWeight: 600, color: paymentStatus.status === "odendi" ? T.success : paymentStatus.status === "gecikti" ? T.danger : paymentStatus.status === "bekliyor" ? T.warning : T.textDim }}>
                {paymentStatus.label}
              </div>
            </div>
            <button style={saveBtnStyle} onClick={() => setOdemeModalOpen(true)}>Ödemeleri Yönet</button>
          </div>
        )}
        {!paymentStatus && (
          <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 20 }}>
            Bu müşteri için ödeme günü tanımlı değil — düzenle butonundan "Ödeme Günü" alanını doldurursan otomatik takip başlar.
          </div>
        )}
        {odemeModalOpen && (
          <AyOdemeModal
            client={client}
            ayObj={{ key: monthKey(), label: new Date().toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }) }}
            hesaplar={hesaplar}
            onAddKaydi={(kayit) => onAddOdemeKaydi(client.id, kayit)}
            onDeleteKaydi={(kayitId) => onDeleteOdemeKaydi(client.id, kayitId)}
            onClose={() => setOdemeModalOpen(false)}
          />
        )}
        {overdueMonths > 0 && (
          <div style={{ marginBottom: 20, padding: "12px 14px", background: T.dangerSoft, borderRadius: 12, border: `1px solid ${T.danger}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12.5, color: T.danger, fontFamily: "Inter", fontWeight: 600 }}>{overdueMonths} aydır ödenmedi</div>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>YENİ AY ÖDEMESİ</div>
                    <div style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{fmt(client.aylikUcret)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>KALAN BAKİYE (kısmi ödemeler düşülmüş)</div>
                    <div style={{ fontSize: 13, color: T.danger, fontFamily: "Inter", fontWeight: 700 }}>{fmt(clientOverdueBalance(client))}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={saveBtnStyle} onClick={() => onOpenTeblig(client, overdueMonths, clientOverdueBalance(client))}>Tebliğ Oluştur / Düzenle</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginTop: 8 }}>Ödeme hatırlatması göndermek için <strong>Ödeme Takvimi</strong> sekmesini kullan.</div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>
            MALİYETLER ({maliyetler.length}) <span style={{ opacity: 0.7, fontWeight: 400 }}>— freelance ödemeleri, dış hizmetler vb. Toplam Gider'e otomatik yansır</span>
          </div>
          {maliyetler.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>Bu müşteriye bağlı maliyet yok.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
            {maliyetler.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.kalem}</div>
                  {m.freelancerId && (
                    <div style={{ fontSize: 11, color: T.accentText, fontFamily: "Inter", marginTop: 2 }}>
                      → {((freelancerlar || []).find((f) => String(f.id) === String(m.freelancerId)) || {}).ad || "silinmiş freelancer"}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.text }}>{fmt(m.tutar)}</span>
                  <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu maliyet silinsin mi?")) onDeleteCost(m.id); }}><Trash2 size={13} color={T.danger} /></button>
                </div>
              </div>
            ))}
            {maliyetler.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>
                <span>Toplam</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(maliyetToplam)}</span>
              </div>
            )}
          </div>
          {addingCost ? (
            <FieldForm fields={costFieldsWithFreelancers(freelancerlar)} onSubmit={(v) => { onAddCost(v); setAddingCost(false); }} onCancel={() => setAddingCost(false)} submitLabel="Maliyeti Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingCost(true)}><Plus size={13} /> Maliyet ekle</button>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>BEKLEYEN TAHSİLATLAR ({bekleyenTahsilatlar.length})</div>
          {bekleyenTahsilatlar.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Bekleyen ödeme yok.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {bekleyenTahsilatlar.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div style={{ fontSize: 12.5, color: b.vade.includes("gecikti") ? T.danger : T.textDim, fontFamily: "Inter" }}>{b.vade}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.text }}>{fmt(b.tutar)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FİNANS                                                                */
/* ------------------------------------------------------------------ */
const KALEM_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text" },
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "tekrar", label: "Tekrar", type: "select", options: [{ value: "sabit", label: "Sabit (her ay tekrar eder)" }, { value: "tek seferlik", label: "Tek seferlik (bu ayla sınırlı)" }] },
];
const GELIR_FIELDS = [
  ...KALEM_FIELDS,
  { key: "faturali", label: "Faturalı mı? (KDV %20 otomatik hesaplanır)", type: "select", options: [{ value: "evet", label: "Evet - Faturalı (KDV'li)" }, { value: "hayir", label: "Hayır - Faturasız" }] },
];
const BEKLEYEN_FIELDS = [{ key: "musteri", label: "Müşteri", type: "text" }, { key: "tutar", label: "Tutar (₺)", type: "number" }, { key: "vade", label: "Vade Durumu", type: "text", placeholder: "örn. bugün / 3 gün gecikti" }];
const VERGI_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text" },
  { key: "tarih", label: "Tarih", type: "date" },
  { key: "durum", label: "Durum", type: "select", options: [{ value: "yaklaşıyor", label: "Yaklaşıyor" }, { value: "planlandı", label: "Planlandı" }] },
];
const MONTH_FIELDS = [
  { key: "ay", label: "Ay", type: "text", placeholder: "örn. Ağu" },
  { key: "yil", label: "Yıl", type: "number", placeholder: "örn. 2026" },
  { key: "ciro", label: "Ciro (₺)", type: "number" },
  { key: "gider", label: "Gider (₺)", type: "number" },
];

function MiniList({ title, icon, items, fields, renderRow, onAdd, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card style={{ padding: "20px 22px" }}>
      <SectionTitle action={icon}>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < items.length - 1 ? `1px solid ${T.borderSoft}` : "none", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item)}</div>
            <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu kayıt silinsin mi?")) onDelete(item.id); }}><Trash2 size={13} color={T.danger} /></button>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: T.textFaint, fontSize: 12.5, fontFamily: "Inter", padding: "8px 0" }}>Henüz kayıt yok.</div>}
      </div>
      {adding ? (
        <FieldForm fields={fields} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Ekle" />
      ) : (
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={13} /> {addLabel}</button>
      )}
    </Card>
  );
}

function Finans({ data, clients, onAddGelir, onDeleteGelir, onAddGider, onDeleteGider, onAddOfisGider, onDeleteOfisGider, onAddBekleyen, onDeleteBekleyen, onAddVergi, onDeleteVergi, onAddMonth, onDeleteMonth, onCloseMonth, onExport, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
  const { monthly, gelirKalemleri, giderKalemleri, ofisGiderleri, bekleyenTahsilatlar, vergiTakvimi } = data;
  const [addingMonth, setAddingMonth] = useState(false);
  const live = computeLive(data);
  const tahsilatOrani = live.ciro ? Math.round((live.tahsilEdilen / live.ciro) * 100) : 0;
  const chartData = [...monthly, { id: "live", ay: "Bu Ay", yil: new Date().getFullYear(), ciro: live.ciro, gider: live.gider, net: live.net }];

  const clientNames = (clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").map((c) => c.ad);
  const bekleyenFields = clientNames.length
    ? [
        { key: "musteri", label: "Müşteri", type: "select", options: clientNames.map((n) => ({ value: n, label: n })) },
        { key: "tutar", label: "Tutar (₺)", type: "number" },
        { key: "vade", label: "Vade Durumu", type: "text", placeholder: "örn. bugün / 3 gün gecikti" },
      ]
    : BEKLEYEN_FIELDS;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="NAKİT AKIŞI (BU AY)" value={fmt(live.net)} accent={T.success} />
        <KpiCard label="TAHSİLAT ORANI" value={`%${tahsilatOrani}`} mono />
        <KpiCard label="BEKLEYEN ÖDEME" value={fmt(live.bekleyenToplam)} accent={T.warning} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <KpiCard label="CİRO (KDV HARİÇ)" value={fmt(live.ciro)} accent={T.accentText} />
        <KpiCard label="KDV TUTARI (%20)" value={fmt(live.kdvTutari)} mono accent={T.warning} />
        <KpiCard label="KDV DAHİL TOPLAM" value={fmt(live.kdvDahilToplamCiro)} mono />
      </div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 22 }}>
        Faturalı Ciro (KDV Hariç) {fmt(live.faturaliCiro)} + Faturasız Ciro {fmt(live.faturasizCiro)} = Ciro (KDV Hariç) {fmt(live.ciro)}. KDV sadece faturalı kısım üzerinden hesaplanır ve resmi beyanname yerine geçmez, muhasebecinle teyit et.
      </div>

      <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
        <SectionTitle>Faturalı İşler <span style={{ fontWeight: 400, opacity: 0.7 }}>— bu ciroyu oluşturanlar</span></SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu" && clientFaturaliTutar(c) > 0).map((c) => {
            const ft = clientFaturaliTutar(c);
            const kismi = ft < c.aylikUcret;
            return (
              <div key={"c" + c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{c.ad}</span>
                  <Pill color={T.accentText} soft={T.accentSoft}>Müşteri</Pill>
                  {kismi && <Pill color={T.warning} soft={T.warningSoft}>Kısmi</Pill>}
                </div>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(ft)}</span>
              </div>
            );
          })}
          {gelirKalemleri.filter((g) => g.faturali !== "hayir").map((g) => (
            <div key={"g" + g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{g.kalem}</span>
                <Pill color={T.textFaint} soft={T.borderSoft}>Ek Gelir</Pill>
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(g.tutar)}</span>
            </div>
          ))}
          {clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu" && clientFaturaliTutar(c) > 0).length === 0 && gelirKalemleri.filter((g) => g.faturali !== "hayir").length === 0 && (
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", padding: "6px 0" }}>Faturalı işaretlenmiş müşteri/gelir yok.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>Faturalı Ciro (KDV Hariç)</span>
              <span style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliCiro)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter" }}>
              <span style={{ color: T.textDim }}>+ KDV (%20)</span>
              <span style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.kdvTutari)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontFamily: "Inter", fontWeight: 600, paddingTop: 4, borderTop: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.text }}>= Faturalı Ciro (KDV Dahil)</span>
              <span style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliKdvDahil)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
        <SectionTitle
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button style={cancelBtnStyle} onClick={onExport}>CSV indir</button>
              <button
                style={saveBtnStyle}
                onClick={() => {
                  if (window.confirm("Bu ayı kapatıp arşive eklemek istiyor musun? Tek seferlik gelir/gider kalemleri silinecek, sabit olanlar bir sonraki aya taşınacak.")) onCloseMonth();
                }}
              >
                Ayı Kapat
              </button>
            </div>
          }
        >
          Bu Ayın Ciro & Gider Dağılımı
        </SectionTitle>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Müşteri Aylık Ücretleri <span style={{ opacity: 0.7 }}>(Müşteriler sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.recurring)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Ek Gelirler <span style={{ opacity: 0.7 }}>(aşağıdaki Gelirler listesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.extra)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>= Toplam Ciro</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.accentText, fontWeight: 600, marginTop: 3 }}>{fmt(live.ciro)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Gider Kalemleri</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.giderKalemToplam)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Ofis Giderleri</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.ofisGiderToplam)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Personel Gideri <span style={{ opacity: 0.7 }}>(Personel sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.personelGideri)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Müşteri Maliyetleri <span style={{ opacity: 0.7 }}>(Müşteriler sekmesi)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.clientCosts)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Üyelikler <span style={{ opacity: 0.7 }}>(Üyelikler sekmesi, aylık karşılık)</span></div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: T.text, marginTop: 3 }}>{fmt(live.uyelikGideri)}</div>
          </div>
        </div>
      </Card>

      <div className="marcus-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <SectionTitle>Gelir & Gider — Son Aylar + Bu Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -18, right: 8 }} barGap={4}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 12.5 }} />
              <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
              <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", margin: "10px 0 4px" }}>Geçmiş Ay Arşivi <span style={{ opacity: 0.7 }}>— sadece grafikte görünür, güncel hesaplamayı etkilemez</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {monthly.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < monthly.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.ay} {m.yil || ""}</span>
                <span style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>Ciro {fmt(m.ciro)} · Gider {fmt(m.gider)} · Net {fmt(m.net)}</span>
                <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu ay silinsin mi?")) onDeleteMonth(m.id); }}><Trash2 size={12} color={T.danger} /></button>
              </div>
            ))}
            {monthly.length === 0 && <div style={{ color: T.textFaint, fontSize: 12, fontFamily: "Inter" }}>Henüz geçmiş ay eklenmedi.</div>}
          </div>
          {addingMonth ? (
            <FieldForm fields={MONTH_FIELDS} initial={{ yil: new Date().getFullYear() }} onSubmit={(v) => { onAddMonth(v); setAddingMonth(false); }} onCancel={() => setAddingMonth(false)} submitLabel="Ayı Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingMonth(true)}><Plus size={13} /> Geçmiş ay ekle (arşiv)</button>
          )}
        </Card>

        <MiniList
          title="Vergi Takibi"
          icon={<CalendarClock size={16} color={T.textFaint} />}
          items={vergiTakvimi}
          fields={VERGI_FIELDS}
          addLabel="Vergi kalemi ekle"
          onAdd={onAddVergi}
          onDelete={onDeleteVergi}
          renderRow={(v) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{v.kalem}</div>
                <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>{tarihGoster(v.tarih)}</div>
              </div>
              {v.durum === "yaklaşıyor" && <Pill color={T.warning} soft={T.warningSoft}>Yaklaşıyor</Pill>}
            </div>
          )}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <MiniList
          title="Ofis Giderleri"
          icon={<Receipt size={16} color={T.textFaint} />}
          items={ofisGiderleri || []}
          fields={KALEM_FIELDS}
          addLabel="Ofis gideri ekle"
          onAdd={onAddOfisGider}
          onDelete={onDeleteOfisGider}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
      </div>

      <Karsilastirma chartData={chartData} />

      <div className="marcus-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <MiniList
          title="Gelirler"
          icon={<CircleDollarSign size={16} color={T.textFaint} />}
          items={gelirKalemleri}
          fields={GELIR_FIELDS}
          addLabel="Gelir kalemi ekle"
          onAdd={onAddGelir}
          onDelete={onDeleteGelir}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
                {g.faturali === "hayir" ? <Pill color={T.textFaint} soft={T.borderSoft}>Faturasız</Pill> : <Pill color={T.success} soft={T.successSoft}>Faturalı</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
        <MiniList
          title="Giderler"
          icon={<Receipt size={16} color={T.textFaint} />}
          items={giderKalemleri}
          fields={KALEM_FIELDS}
          addLabel="Gider kalemi ekle"
          onAdd={onAddGider}
          onDelete={onDeleteGider}
          renderRow={(g) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.kalem}</span>
                {g.tekrar === "sabit" && <Pill color={T.accentText} soft={T.accentSoft}>Sabit</Pill>}
              </div>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmt(g.tutar)}</span>
            </div>
          )}
        />
      </div>

      <MiniList
        title="Bekleyen Tahsilatlar (elle eklenen)"
        icon={<Landmark size={16} color={T.textFaint} />}
        items={bekleyenTahsilatlar}
        fields={bekleyenFields}
        addLabel="Bekleyen tahsilat ekle"
        onAdd={onAddBekleyen}
        onDelete={onDeleteBekleyen}
        renderRow={(b) => (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{b.musteri}</div>
              <div style={{ fontSize: 11.5, color: b.vade.includes("gecikti") ? T.danger : T.textFaint, fontFamily: "Inter" }}>{b.vade}</div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: T.text }}>{fmt(b.tutar)}</div>
          </div>
        )}
      />
      {live.otomatikBekleyen > 0 && (
        <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
          + {fmt(live.otomatikBekleyen)} — Müşteriler sekmesinde ödeme günü geçtiği halde "ödendi" işaretlenmemiş müşterilerden otomatik hesaplanan tutar. "Bekleyen Ödeme" KPI'sı bu ikisinin toplamıdır.
        </div>
      )}

      <HesapBakiyeleri hesaplar={data.hesaplar} clients={clients} transferler={data.hesapTransferleri} avanslar={data.avanslar} odemeler={data.personelOdemeleri} duzeltmeler={data.hesapDuzeltmeleri} onTransfer={onTransfer} onDeleteTransfer={onDeleteTransfer} onAddHesap={onAddHesap} onDeleteHesap={onDeleteHesap} onUpdateHesap={onUpdateHesap} onAddDuzeltme={onAddDuzeltme} onDeleteDuzeltme={onDeleteDuzeltme} />

      <Card style={{ padding: "16px 20px", marginTop: 16 }}>
        <SectionTitle>Banka Hareketleri <span style={{ fontWeight: 400, opacity: 0.7 }}>— Ödeme Takvimi'nde kaydedilen tüm tahsilatlar</span></SectionTitle>
        {(() => {
          const hareketler = (clients || [])
            .flatMap((c) => (c.odemeKayitlari || []).map((k) => ({ ...k, musteri: c.ad })))
            .reverse();
          if (hareketler.length === 0) {
            return <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Henüz bir ödeme kaydı yok. Ödeme Takvimi sekmesinden tutar ve banka bilgisiyle kayıt ekleyebilirsin.</div>;
          }
          return (
            <div className="marcus-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
                <thead>
                  <tr>
                    {["Müşteri", "Banka", "Tarih", "Not", "Tutar"].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "8px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hareketler.slice(0, 40).map((h, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.text, fontWeight: 600 }}>{h.musteri}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.textDim }}>{h.banka || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.textDim }}>{h.tarih}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.textFaint }}>{h.not || ""}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.success, fontWeight: 600 }}>{fmt(h.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

function Karsilastirma({ chartData }) {
  const rows = chartData.filter((m) => m.ay !== undefined);
  const withDelta = rows.map((m, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const ciroDelta = prev && prev.ciro ? Math.round(((m.ciro - prev.ciro) / prev.ciro) * 100) : null;
    return { ...m, ciroDelta };
  });

  const yillikMap = {};
  rows.forEach((m) => {
    const y = m.yil || new Date().getFullYear();
    if (!yillikMap[y]) yillikMap[y] = { yil: y, ciro: 0, gider: 0, net: 0, ayCount: 0 };
    yillikMap[y].ciro += Number(m.ciro) || 0;
    yillikMap[y].gider += Number(m.gider) || 0;
    yillikMap[y].net += Number(m.net) || 0;
    yillikMap[y].ayCount += 1;
  });
  const yillar = Object.values(yillikMap).sort((a, b) => a.yil - b.yil);

  return (
    <Card style={{ padding: "20px 22px", marginBottom: 16 }}>
      <SectionTitle>Aylık & Yıllık Karşılaştırma</SectionTitle>

      <div className="marcus-table-wrap" style={{ marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
          <thead>
            <tr>
              {["Ay", "Ciro", "Gider", "Net", "Değişim"].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withDelta.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.text, fontWeight: m.id === "live" ? 600 : 400, fontFamily: "Inter" }}>{m.ay} {m.yil}{m.id === "live" && " (şimdi)"}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", color: T.text }}>{fmt(m.ciro)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", color: T.textDim }}>{fmt(m.gider)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", color: T.success }}>{fmt(m.net)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, fontFamily: "Inter" }}>
                  {m.ciroDelta === null ? <span style={{ color: T.textFaint }}>—</span> : <span style={{ color: m.ciroDelta >= 0 ? T.success : T.danger }}>{m.ciroDelta >= 0 ? "+" : ""}{m.ciroDelta}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 10 }}>YILLIK TOPLAMLAR</div>
      {yillar.length < 2 && (
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 8 }}>
          Karşılaştırma için en az 2 yıllık veri gerekiyor — şu an sadece {yillar[0]?.yil} verisi var. Aylar birikince burada geçen yılla otomatik karşılaştırma göreceksin.
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {yillar.map((y, i) => {
          const prevYear = yillar[i - 1];
          const delta = prevYear && prevYear.ciro ? Math.round(((y.ciro - prevYear.ciro) / prevYear.ciro) * 100) : null;
          return (
            <div key={y.yil} style={{ flex: "1 1 160px", minWidth: 160, padding: "14px 16px", background: T.surfaceRaised, borderRadius: 12 }}>
              <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 6 }}>{y.yil} ({y.ayCount} ay)</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, color: T.text, fontWeight: 600 }}>{fmt(y.ciro)}</div>
              {delta !== null && (
                <div style={{ fontSize: 12, fontFamily: "Inter", color: delta >= 0 ? T.success : T.danger, marginTop: 4 }}>{delta >= 0 ? "+" : ""}{delta}% önceki yıla göre</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* TAKVİM                                                                */
/* ------------------------------------------------------------------ */
const TR_AYLAR_KISA = ["oca", "şub", "mar", "nis", "may", "haz", "tem", "ağu", "eyl", "eki", "kas", "ara"];
const TR_AYLAR_TAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** "26 Ağu" gibi serbest metin tarihleri gün/ay olarak ayrıştırır (yıl bilgisi yoktur, varsayılan olarak yok sayılır). */
/** Bugünün tarihi, tarih seçicilerin (input type="date") beklediği YYYY-AA-GG biçiminde. */
const bugunISOTarih = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Tarihleri ekranda okunur gösterir. Tarih seçicilerden gelen YYYY-AA-GG değerini
 * "26 Ağustos 2026" biçimine çevirir; eski kayıtlardaki serbest metin tarihleri
 * ("26 Ağu", "11.08.2026") olduğu gibi geçirir — geçmiş veri bozulmasın diye.
 */
function tarihGoster(str) {
  if (!str) return "—";
  const m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(str);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(str);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function parseTrTarih(str) {
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

function Takvim({ data }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const activeClients = data.clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu" && c.odemeGunu);

  const eventsForDay = (day) => {
    // Tarih seçiciden gelen kayıtlarda yıl da var — o zaman yılı da eşleştiriyoruz.
    // Eski serbest metin kayıtlarında ("26 Ağu") yıl yok, onlar her yıl görünmeye devam eder.
    const vergiler = data.vergiTakvimi.filter((v) => {
      const p = parseTrTarih(v.tarih);
      if (!p || p.day !== day || p.month !== month) return false;
      return p.year === undefined || p.year === year;
    });
    const odemeler = activeClients.filter((c) => Number(c.odemeGunu) === day);
    return { vergiler, odemeler };
  };

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Pazartesi başlangıçlı
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selected = selectedDay ? eventsForDay(selectedDay) : null;

  return (
    <div>
      <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={() => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); }} style={{ ...iconBtnStyle, background: T.surfaceRaised, borderRadius: 8 }}><ChevronLeft size={16} color={T.text} /></button>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5, fontWeight: 600, color: T.text }}>{TR_AYLAR_TAM[month]} {year}</div>
          <button onClick={() => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); }} style={{ ...iconBtnStyle, background: T.surfaceRaised, borderRadius: 8 }}><ChevronRight size={16} color={T.text} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {TR_GUNLER.map((g) => (
            <div key={g} style={{ textAlign: "center", fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, padding: "4px 0" }}>{g}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const { vergiler, odemeler } = eventsForDay(d);
            const hasEvents = vergiler.length + odemeler.length > 0;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(d)}
                style={{
                  aspectRatio: "1", minHeight: 44, borderRadius: 9, border: `1px solid ${isToday(d) ? T.accent : T.borderSoft}`,
                  background: selectedDay === d ? T.accentSoft : T.surfaceRaised, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 4,
                }}
              >
                <span style={{ fontSize: 12.5, color: isToday(d) ? T.accentText : T.text, fontFamily: "Inter", fontWeight: isToday(d) ? 700 : 500 }}>{d}</span>
                {hasEvents && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {odemeler.length > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: T.warning }} />}
                    {vergiler.length > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: T.danger }} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: T.warning }} /> Müşteri ödeme günü</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: T.danger }} /> Vergi tarihi</span>
        </div>
      </Card>

      {selected && (
        <Card style={{ padding: "18px 20px" }}>
          <SectionTitle>{selectedDay} {TR_AYLAR_TAM[month]}</SectionTitle>
          {selected.vergiler.length === 0 && selected.odemeler.length === 0 && (
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Bu günde bir şey yok.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected.odemeler.map((c) => (
              <div key={"c" + c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{c.ad} — ödeme günü</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.warning }}>{fmt(c.aylikUcret)}</span>
              </div>
            ))}
            {selected.vergiler.map((v) => (
              <div key={"v" + v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{v.kalem}</div>
                <Pill color={T.danger} soft={T.dangerSoft}>Vergi</Pill>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ÖDEME TAKVİMİ                                                         */
/* ------------------------------------------------------------------ */
/** Son N ayın anahtarlarını (en eskiden en yeniye) ve kısa etiketlerini üretir. */
function sonAylar(n) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: monthKey(d), label: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }) });
  }
  return arr;
}

function OdemeGunuHucre({ client, onUpdateClient }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(client.odemeGunu || "");

  useEffect(() => { setVal(client.odemeGunu || ""); }, [client.odemeGunu]);

  const save = () => {
    if (val === "" || val === null) { onUpdateClient(client.id, { odemeGunu: null }); setEditing(false); return; }
    const n = Number(val);
    if (n >= 1 && n <= 31) onUpdateClient(client.id, { odemeGunu: n });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number" min={1} max={31} autoFocus value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        style={{ width: 70, background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 7, padding: "6px 8px", color: T.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }}
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      style={{ background: "transparent", border: `1px dashed ${client.odemeGunu ? T.border : T.warning}`, borderRadius: 7, padding: "6px 10px", color: client.odemeGunu ? T.text : T.warning, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {client.odemeGunu ? `Ayın ${client.odemeGunu}'i` : "+ Gün gir"}
    </button>
  );
}

function AyOdemeModal({ client, ayObj, hesaplar, onAddKaydi, onDeleteKaydi, onClose }) {
  const listeHesap = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState(monthRemaining(client, ayObj.key) || client.aylikUcret || 0);
  const [hesapId, setHesapId] = useState(listeHesap[0].id);
  const [tarih, setTarih] = useState(bugunISOTarih());
  const [not, setNot] = useState("");
  const kayitlar = (client.odemeKayitlari || []).filter((k) => k.ay === ayObj.key);
  const odenen = monthPaidAmount(client, ayObj.key);
  const kalan = monthRemaining(client, ayObj.key);

  const submit = () => {
    const n = Number(tutar);
    if (!n || n <= 0) { window.alert("Geçerli bir tutar gir."); return; }
    const secilenHesap = listeHesap.find((h) => h.id === hesapId) || listeHesap[0];
    onAddKaydi({ ay: ayObj.key, tutar: n, hesapId: secilenHesap.id, banka: secilenHesap.ad, tarih: tarih.trim(), not: not.trim() });
    setTutar(0); setNot("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="marcus-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 440, maxWidth: "100%", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5, fontWeight: 600, color: T.text, margin: 0 }}>{client.ad} — {ayObj.label}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={17} color={T.textFaint} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 16 }}>
          Aylık ücret {fmt(client.aylikUcret)} · Ödenen {fmt(odenen)} · <span style={{ color: kalan > 0 ? T.danger : T.success, fontWeight: 600 }}>Kalan {fmt(kalan)}</span>
        </div>

        {kayitlar.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>ÖDEME KAYITLARI</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {kayitlar.map((k) => (
                <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: T.surfaceRaised, borderRadius: 9 }}>
                  <div>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{fmt(k.tutar)}{k.banka ? ` · ${k.banka}` : ""}</div>
                    <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{tarihGoster(k.tarih)}{k.not ? ` · ${k.not}` : ""}</div>
                  </div>
                  <button style={iconBtnStyle} onClick={() => onDeleteKaydi(k.id)}><Trash2 size={13} color={T.danger} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>{kalan > 0 ? "ÖDEME EKLE" : "EK ÖDEME EKLE (opsiyonel)"}</div>
        <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tutar (₺)</label>
            <input type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi Hesaba</label>
            <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={inputStyle}>
              {listeHesap.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Not (opsiyonel)</label>
            <input type="text" value={not} onChange={(e) => setNot(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={cancelBtnStyle} onClick={onClose}>Kapat</button>
          <button style={saveBtnStyle} onClick={submit}><Check size={13} /> Ödemeyi Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function OdemeTakvimi({ clients, hesaplar, transferler, avanslar, odemeler, duzeltmeler, onUpdateClient, onAddOdemeKaydi, onDeleteOdemeKaydi, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme, firmaAdi }) {
  const [ayCount, setAyCount] = useState(6);
  const [activeCell, setActiveCell] = useState(null); // { client, ayObj }
  const [hatirlatmaClient, setHatirlatmaClient] = useState(null);
  const izlenenler = clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu");
  const aylar = sonAylar(ayCount);
  const bugunKey = monthKey();
  const bugunGun = new Date().getDate();

  const hucreDurumu = (client, ayObj) => {
    if (!client.odemeGunu) return "gunYok";
    const odenen = monthPaidAmount(client, ayObj.key);
    const tamOdendi = isMonthPaid(client, ayObj.key);
    if (tamOdendi) return "odendi";
    if (odenen > 0) return "kismi";
    if (ayObj.key > bugunKey) return "gelecek";
    const pesin = client.odemeSekli !== "sonra";
    if (pesin) {
      if (ayObj.key === bugunKey && bugunGun < Number(client.odemeGunu)) return "gelecek";
    } else {
      if (ayObj.key === bugunKey) return "gelecek"; // sonra: bu ayın hizmeti bitmeden vadesi hiç gelmez
      const oncekiAy = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      const oncekiKey = monthKey(oncekiAy);
      if (ayObj.key === oncekiKey && bugunGun < Number(client.odemeGunu)) return "gelecek";
    }
    if (client.baslangic && /^\d{4}-\d{1,2}$/.test(client.baslangic.trim())) {
      const [by, bm] = client.baslangic.trim().split("-").map(Number);
      const baslangicKey = `${by}-${String(bm).padStart(2, "0")}`;
      if (ayObj.key < baslangicKey) return "yok";
    }
    return "odenmedi";
  };

  const toplamBirikmisBorc = izlenenler.reduce((sum, c) => {
    const ayBorcu = aylar.reduce((s, a) => {
      const durum = hucreDurumu(c, a);
      if (durum === "odenmedi" || durum === "kismi") return s + monthRemaining(c, a.key);
      return s;
    }, 0);
    return sum + ayBorcu;
  }, 0);

  const borcHesapla = (c) => aylar.reduce((s, a) => {
    const durum = hucreDurumu(c, a);
    if (durum === "odenmedi" || durum === "kismi") return s + monthRemaining(c, a.key);
    return s;
  }, 0);

  const gunTanimliSayisi = izlenenler.filter((c) => c.odemeGunu).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TAKİP EDİLEN MÜŞTERİ" value={gunTanimliSayisi} mono={false} />
        <KpiCard label="BİRİKMİŞ TOPLAM BORÇ" value={fmt(toplamBirikmisBorc)} accent={T.danger} />
      </div>

      <HesapBakiyeleri hesaplar={hesaplar} clients={clients} transferler={transferler} avanslar={avanslar} odemeler={odemeler} duzeltmeler={duzeltmeler} onTransfer={onTransfer} onDeleteTransfer={onDeleteTransfer} onAddHesap={onAddHesap} onDeleteHesap={onDeleteHesap} onUpdateHesap={onUpdateHesap} onAddDuzeltme={onAddDuzeltme} onDeleteDuzeltme={onDeleteDuzeltme} />

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {[6, 12].map((n) => (
          <button
            key={n}
            onClick={() => setAyCount(n)}
            style={{ background: ayCount === n ? T.accentSoft : "transparent", color: ayCount === n ? T.accentText : T.textDim, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Son {n} ay
          </button>
        ))}
      </Card>

      {izlenenler.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz aktif/yeni müşteri yok.</div>
        </Card>
      ) : (
        <Card style={{ padding: 4 }}>
          <div className="marcus-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 620 + aylar.length * 64 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}`, position: "sticky", left: 0, background: T.surface }}>Müşteri</th>
                  <th style={{ textAlign: "left", padding: "12px 12px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>Ödeme Günü</th>
                  {aylar.map((a) => (
                    <th key={a.key} style={{ textAlign: "center", padding: "12px 8px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}`, minWidth: 64 }}>{a.label}</th>
                  ))}
                  <th style={{ textAlign: "right", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>Birikmiş Borç</th>
                </tr>
              </thead>
              <tbody>
                {izlenenler.map((c) => {
                  const borc = borcHesapla(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: T.text, fontWeight: 600, position: "sticky", left: 0, background: T.surface }}>{c.ad}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <OdemeGunuHucre client={c} onUpdateClient={onUpdateClient} />
                      </td>
                      {aylar.map((a) => {
                        const durum = hucreDurumu(c, a);
                        const stil = {
                          odendi: { bg: T.successSoft, color: T.success, sym: "✓" },
                          kismi: { bg: T.warningSoft, color: T.warning, sym: "½" },
                          odenmedi: { bg: T.dangerSoft, color: T.danger, sym: "✕" },
                          gelecek: { bg: T.borderSoft, color: T.textFaint, sym: "·" },
                          yok: { bg: "transparent", color: T.textFaint, sym: "" },
                          gunYok: { bg: "transparent", color: T.textFaint, sym: "—" },
                        }[durum];
                        const tiklanabilir = durum === "odendi" || durum === "odenmedi" || durum === "kismi";
                        const baslik = durum === "kismi" ? `Kısmi ödendi — kalan ${fmt(monthRemaining(c, a.key))}` : tiklanabilir ? "Ödeme kayıtlarını görüntüle/ekle" : durum === "gunYok" ? "Önce ödeme günü gir" : undefined;
                        return (
                          <td key={a.key} style={{ padding: "8px", textAlign: "center" }}>
                            <button
                              disabled={!tiklanabilir}
                              onClick={() => tiklanabilir && setActiveCell({ client: c, ayObj: a })}
                              title={baslik}
                              style={{
                                width: 34, height: 28, borderRadius: 7, border: "none", background: stil.bg, color: stil.color,
                                fontSize: 13, fontWeight: 700, cursor: tiklanabilir ? "pointer" : "default", fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {stil.sym}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: borc > 0 ? T.danger : T.textFaint, fontWeight: 600 }}>{fmt(borc)}</span>
                          {borc > 0 && (
                            <button onClick={() => setHatirlatmaClient(c)} title="Ödeme Hatırlatması Gönder" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                              <Send size={13} color={T.textFaint} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
        <span style={{ color: T.success }}>✓</span> tam ödendi · <span style={{ color: T.warning }}>½</span> kısmi ödendi · <span style={{ color: T.danger }}>✕</span> ödenmedi (tıkla, tutar + banka gir) · <span style={{ color: T.textFaint }}>·</span> henüz vadesi gelmedi · <span style={{ color: T.textFaint }}>—</span> ödeme günü tanımlı değil. "Ödeme Günü" sütununa tıklayıp buradan doğrudan girebilir/değiştirebilirsin — Müşteriler sekmesiyle aynı veriyi paylaşır.
      </div>

      {activeCell && (
        <AyOdemeModal
          client={activeCell.client}
          ayObj={activeCell.ayObj}
          hesaplar={hesaplar}
          onAddKaydi={(kayit) => onAddOdemeKaydi(activeCell.client.id, kayit)}
          onDeleteKaydi={(kayitId) => onDeleteOdemeKaydi(activeCell.client.id, kayitId)}
          onClose={() => setActiveCell(null)}
        />
      )}

      {hatirlatmaClient && (
        <div onClick={() => setHatirlatmaClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 22, width: 380, maxWidth: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 15, color: T.text, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{hatirlatmaClient.ad}</div>
              <button onClick={() => setHatirlatmaClient(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={17} color={T.textFaint} /></button>
            </div>
            <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginBottom: 14 }}>Kalan bakiye: <strong style={{ color: T.danger }}>{fmt(borcHesapla(hatirlatmaClient))}</strong></div>
            <OdemeHatirlatmasiGonder client={hatirlatmaClient} tutar={borcHesapla(hatirlatmaClient)} ayAdi={new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} firmaAdi={firmaAdi} baslangictaAcik />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* REKLAMLAR                                                             */
/* ------------------------------------------------------------------ */
const REKLAM_FIELDS = [
  { key: "marka", label: "Marka / Müşteri", type: "client-select" },
  { key: "reklamAdi", label: "Reklam / Kampanya Adı", type: "text" },
  { key: "baslangicTarihi", label: "Başlangıç Tarihi", type: "date" },
  { key: "bitisTarihi", label: "Bitiş Tarihi", type: "date" },
  { key: "butce", label: "Bütçe (₺, opsiyonel)", type: "number" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

function reklamDurumu(r) {
  if (!r.bitisTarihi) return "aktif";
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const bitis = new Date(r.bitisTarihi);
  const farkGun = Math.round((bitis - bugun) / 86400000);
  if (farkGun < 0) return "bitti";
  if (farkGun <= 3) return "yakinda";
  return "aktif";
}

function Reklamlar({ reklamlar, clients, onAdd, onUpdate, onDelete, duzenleyenAdi }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("hepsi");
  const kilitleyen = useDuzenlemeKilidi("reklam", editingId, !!editingId, duzenleyenAdi);
  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");

  const siraliListe = [...reklamlar].sort((a, b) => (a.bitisTarihi || "").localeCompare(b.bitisTarihi || ""));
  const filtered = siraliListe.filter((r) => (filter === "hepsi" ? true : reklamDurumu(r) === filter));
  const aktifSayisi = reklamlar.filter((r) => reklamDurumu(r) !== "bitti").length;
  const yakindaSayisi = reklamlar.filter((r) => reklamDurumu(r) === "yakinda").length;

  const durumBilgi = { aktif: { label: "Aktif", color: T.success, soft: T.successSoft }, yakinda: { label: "Yakında Bitiyor", color: T.warning, soft: T.warningSoft }, bitti: { label: "Bitti", color: T.textFaint, soft: T.borderSoft } };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="AKTİF REKLAM" value={aktifSayisi} mono={false} accent={T.success} />
        <KpiCard label="3 GÜN İÇİNDE BİTECEK" value={yakindaSayisi} mono={false} accent={T.warning} />
        <KpiCard label="TOPLAM KAYIT" value={reklamlar.length} mono={false} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["hepsi", "Hepsi"], ["aktif", "Aktif"], ["yakinda", "Yakında Bitiyor"], ["bitti", "Bitti"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? T.accentSoft : "transparent", color: filter === k ? T.accentText : T.textDim, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Reklam Ekle</button>
      </Card>

      {adding && <div style={{ marginBottom: 16 }}><FieldForm fields={REKLAM_FIELDS} clientList={aktifMarkalar} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Reklamı Ekle" /></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((r) =>
          editingId === r.id ? (
            <Card key={r.id} style={{ padding: "12px 14px" }}>
              <KilitUyarisi kisi={kilitleyen} />
              <FieldForm fields={REKLAM_FIELDS} clientList={aktifMarkalar} initial={r} onSubmit={(v) => { onUpdate(r.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
            </Card>
          ) : (
            <Card key={r.id} style={{ padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{r.marka} — {r.reklamAdi}</div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
                    {r.baslangicTarihi} → {r.bitisTarihi}{r.butce ? ` · ${fmt(r.butce)}` : ""}{r.not ? ` · ${r.not}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Pill color={durumBilgi[reklamDurumu(r)].color} soft={durumBilgi[reklamDurumu(r)].soft}>{durumBilgi[reklamDurumu(r)].label}</Pill>
                  <button style={iconBtnStyle} onClick={() => { setEditingId(r.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                  <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu reklam kaydı silinsin mi?")) onDelete(r.id); }}><Trash2 size={14} color={T.danger} /></button>
                </div>
              </div>
            </Card>
          )
        )}
        {filtered.length === 0 && (
          <Card style={{ padding: "24px", textAlign: "center" }}><div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Bu filtrede kayıt yok.</div></Card>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAYLAŞIMLAR                                                           */
/* ------------------------------------------------------------------ */
const PAYLASIM_TURLERI = ["Görsel", "Video", "Reels", "Story", "Carousel"];
const TUR_HARFI = { "Görsel": "G", "Video": "V", "Reels": "R", "Story": "S", "Carousel": "C" };
const stokAnahtari = (clientId, tur) => `${clientId}_${tur}`;

function MarkaStokKarti({ client, stoklar, gecmis, subeler, onStokDegis, onAddSube, onDeleteSube, onSubeStokDegis }) {
  const [subeEkleAcik, setSubeEkleAcik] = useState(false);
  const [subeAdi, setSubeAdi] = useState("");
  const dusukMu = (tur, adet) => {
    if (adet <= 0) return false;
    if (adet <= 2) return true;
    const otuzGunOnce = new Date(); otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
    const parseTrTarihGunu = (s) => { const [g, a, y] = (s || "").split("."); return g && a && y ? new Date(`${y}-${a}-${g}`) : null; };
    const kullanim = (gecmis || []).filter((h) => h.clientId === client.id && h.tur === tur && h.tip === "paylasim" && parseTrTarihGunu(h.tarih) && parseTrTarihGunu(h.tarih) >= otuzGunOnce).length;
    if (kullanim === 0) return false;
    const kalanGun = adet / (kullanim / 30);
    return kalanGun <= 7;
  };
  const toplamStok = PAYLASIM_TURLERI.reduce((s, t) => s + (stoklar[stokAnahtari(client.id, t)] || 0), 0);
  const buMarkaSubeleri = (subeler || []).filter((s) => s.clientId === client.id);
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Inter" }}>{client.ad}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: toplamStok > 0 ? T.accentText : T.textFaint, fontFamily: "'IBM Plex Mono', monospace", background: T.accentSoft, padding: "2px 9px", borderRadius: 999 }}>{toplamStok}</span>
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 14 }}>Stoktaki içerikler {buMarkaSubeleri.length > 0 ? "(tüm şubeler dahil toplam)" : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: buMarkaSubeleri.length > 0 || onAddSube ? 14 : 0 }}>
        {PAYLASIM_TURLERI.map((tur) => {
          const adet = stoklar[stokAnahtari(client.id, tur)] || 0;
          const dusuk = dusukMu(tur, adet);
          return (
            <div key={tur} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", display: "flex", alignItems: "center", gap: 5 }}>
                {tur}
                {dusuk && <span title="Yakında tükenebilir" style={{ width: 6, height: 6, borderRadius: 999, background: T.warning, display: "inline-block" }} />}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  disabled={adet <= 0}
                  onClick={() => onStokDegis(client.id, client.ad, tur, -1)}
                  title="Paylaşıldı — stoktan bir tane düş"
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: adet > 0 ? T.text : T.textFaint, fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: adet > 0 ? "pointer" : "default" }}
                >
                  Paylaşıldı
                </button>
                <span style={{ minWidth: 22, textAlign: "center", fontSize: 14, fontWeight: 700, color: dusuk ? T.warning : adet > 0 ? T.text : T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{adet}</span>
                <button
                  onClick={() => onStokDegis(client.id, client.ad, tur, 1)}
                  title="Çekim yapıldı — stoğa bir tane ekle"
                  style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: T.accentSoft, color: T.accentText, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {onAddSube && (
        <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>ŞUBELER</div>
          {buMarkaSubeleri.map((sube) => (
            <div key={sube.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{sube.ad}</span>
                <button
                  onClick={() => {
                    const subeToplami = PAYLASIM_TURLERI.reduce((s, t) => s + (stoklar[`${client.id}_${sube.id}_${t}`] || 0), 0);
                    const mesaj = subeToplami > 0
                      ? `${sube.ad} şubesinde hâlâ ${subeToplami} adet stok var. Şubeyi silmek bu stoğu genel toplamdan DÜŞMEZ — önce stoğu sıfırlaman önerilir. Yine de silinsin mi?`
                      : `${sube.ad} şubesi silinsin mi?`;
                    if (window.confirm(mesaj)) onDeleteSube(sube.id);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                ><Trash2 size={12} color={T.textFaint} /></button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PAYLASIM_TURLERI.map((tur) => {
                  const key = `${client.id}_${sube.id}_${tur}`;
                  const adet = stoklar[key] || 0;
                  return (
                    <div key={tur} style={{ display: "flex", alignItems: "center", gap: 4, background: T.surface, borderRadius: 999, padding: "2px 4px 2px 8px" }}>
                      <span style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>{tur.slice(0, 3)}</span>
                      <button onClick={() => onSubeStokDegis(client.id, sube.id, tur, -1)} disabled={adet <= 0} style={{ width: 16, height: 16, borderRadius: 999, border: "none", background: "transparent", color: adet > 0 ? T.text : T.textFaint, cursor: adet > 0 ? "pointer" : "default", fontSize: 12, lineHeight: 1 }}>–</button>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace", minWidth: 12, textAlign: "center" }}>{adet}</span>
                      <button onClick={() => onSubeStokDegis(client.id, sube.id, tur, 1)} style={{ width: 16, height: 16, borderRadius: 999, border: "none", background: "transparent", color: T.accentText, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>+</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {subeEkleAcik ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input autoFocus value={subeAdi} onChange={(e) => setSubeAdi(e.target.value)} placeholder="örn. Antalya Şubesi" style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "7px 10px" }} />
              <button style={{ ...saveBtnStyle, padding: "7px 12px", fontSize: 12 }} onClick={() => { if (subeAdi.trim()) { onAddSube(client.id, subeAdi.trim()); setSubeAdi(""); setSubeEkleAcik(false); } }}>Ekle</button>
              <button style={{ ...cancelBtnStyle, padding: "7px 12px", fontSize: 12 }} onClick={() => setSubeEkleAcik(false)}>İptal</button>
            </div>
          ) : (
            <button onClick={() => setSubeEkleAcik(true)} style={{ background: "none", border: "none", color: T.accentText, fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "Inter" }}>+ Şube Ekle</button>
          )}
        </div>
      )}
    </Card>
  );
}

const GUN_ADLARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
/** Verilen tarihin (varsayılan bugün) içinde bulunduğu haftanın Pazartesi gününü YYYY-MM-DD olarak döner. */
function haftaBaslangici(d = new Date()) {
  const gun = (d.getDay() + 6) % 7; // Pazartesi=0
  const pazartesi = new Date(d);
  pazartesi.setDate(d.getDate() - gun);
  return tarihIso(pazartesi);
}
function haftaEkle(haftaKeyStr, adet) {
  const d = new Date(haftaKeyStr);
  d.setDate(d.getDate() + adet * 7);
  return haftaBaslangici(d);
}

function HaftalikPaylasimPlani({ clients, plan, stoklar, onAddPlan, onToggleYapildi, onDeletePlan }) {
  const [haftaKey, setHaftaKey] = useState(haftaBaslangici());
  const [secim, setSecim] = useState(null); // { clientId, gun }
  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");
  const buHaftaPlan = (plan || []).filter((p) => p.haftaKey === haftaKey);

  const gunTarihi = (gunIndex) => {
    const d = new Date(haftaKey);
    d.setDate(d.getDate() + gunIndex);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  const planBul = (clientId, gun) => buHaftaPlan.find((p) => p.clientId === clientId && p.gun === gun);

  const tikla = (p) => {
    if (!p.yapildi) {
      const mevcutStok = (stoklar || {})[stokAnahtari(p.clientId, p.tur)] || 0;
      if (mevcutStok <= 0) {
        if (!window.confirm(`${p.tur} stoğu şu an 0 görünüyor. Yine de "paylaşıldı" olarak işaretlemek istiyor musun?`)) return;
      }
    }
    onToggleYapildi(p.id);
  };

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <SectionTitle>Haftalık Paylaşım Planı</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setHaftaKey((h) => haftaEkle(h, -1))} style={{ ...iconBtnStyle, background: T.surfaceRaised, borderRadius: 8 }}><ChevronLeft size={15} color={T.text} /></button>
          <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600, minWidth: 100, textAlign: "center" }}>{new Date(haftaKey).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} haftası</span>
          <button onClick={() => setHaftaKey((h) => haftaEkle(h, 1))} style={{ ...iconBtnStyle, background: T.surfaceRaised, borderRadius: 8 }}><ChevronRight size={15} color={T.text} /></button>
        </div>
      </div>

      {aktifMarkalar.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Aktif marka yok.</div>
      ) : (
        <div className="marcus-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}`, position: "sticky", left: 0, background: T.surface }}>Marka</th>
                {GUN_ADLARI.map((g, i) => (
                  <th key={g} style={{ textAlign: "center", padding: "8px 6px", fontSize: 10.5, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}`, minWidth: 62 }}>{g}<br /><span style={{ fontWeight: 400 }}>{gunTarihi(i)}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aktifMarkalar.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "8px 10px", fontSize: 12.5, color: T.text, fontWeight: 600, position: "sticky", left: 0, background: T.surface }}>{c.ad}</td>
                  {GUN_ADLARI.map((_, gunIndex) => {
                    const p = planBul(c.id, gunIndex);
                    return (
                      <td key={gunIndex} style={{ padding: 5, textAlign: "center" }}>
                        {!p ? (
                          <button
                            onClick={() => setSecim({ clientId: c.id, gun: gunIndex })}
                            style={{ width: 32, height: 28, borderRadius: 7, border: `1px dashed ${T.border}`, background: "transparent", color: T.textFaint, cursor: "pointer", fontSize: 15 }}
                          >+</button>
                        ) : (
                          <button
                            onClick={() => tikla(p)}
                            onDoubleClick={() => { if (window.confirm("Bu plan silinsin mi?")) onDeletePlan(p.id); }}
                            title={`${p.tur} — tıkla: yapıldı işaretle (stoktan düşer), çift tıkla: sil`}
                            style={{
                              width: 32, height: 28, borderRadius: 7, border: "none",
                              background: p.yapildi ? T.successSoft : T.warningSoft,
                              color: p.yapildi ? T.success : T.warning,
                              cursor: "pointer", fontSize: 13, fontWeight: 700,
                            }}
                          >
                            {TUR_HARFI[p.tur] || p.tur.slice(0, 1)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 10 }}>
        <span style={{ color: T.warning }}>■</span> planlandı (henüz paylaşılmadı) · <span style={{ color: T.success }}>■</span> paylaşıldı (G=Görsel, V=Video, R=Reels, S=Story, C=Carousel). Bir güne tıklayıp tür seçerek plan ekle; planlı güne tıklayınca "paylaşıldı" işaretlenir (o markanın kartından o birim düşer), çift tıklayınca silinir.
      </div>

      {secim && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSecim(null)}>
          <div onClick={(e) => e.stopPropagation()} className="marcus-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", width: 280 }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 12 }}>Hangi tür paylaşılacak?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PAYLASIM_TURLERI.map((t) => (
                <button
                  key={t}
                  onClick={() => { onAddPlan(secim.clientId, secim.gun, haftaKey, t); setSecim(null); }}
                  style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceRaised, color: T.text, fontSize: 13, fontFamily: "Inter", cursor: "pointer", textAlign: "left" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Paylasimlar({ clients, stoklar, onStokDegis, gecmis, haftalikPlan, onAddHaftalikPlan, onToggleHaftalikYapildi, onDeleteHaftalikPlan, subeler, onAddSube, onDeleteSube, onSubeStokDegis }) {
  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");
  const stoklarObj = stoklar || {};

  const toplamStok = PAYLASIM_TURLERI.map((t) => ({
    tur: t,
    adet: aktifMarkalar.reduce((s, c) => s + (stoklarObj[stokAnahtari(c.id, t)] || 0), 0),
  })).filter((x) => x.adet > 0);
  const toplamStokAdedi = toplamStok.reduce((s, x) => s + x.adet, 0);

  const sonHareketler = [...(gecmis || [])].reverse().slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM STOK" value={toplamStokAdedi} mono={false} accent={T.success} />
        <KpiCard label="AKTİF MARKA" value={aktifMarkalar.length} mono={false} />
      </div>

      <HaftalikPaylasimPlani
        clients={clients}
        plan={haftalikPlan}
        stoklar={stoklarObj}
        onAddPlan={onAddHaftalikPlan}
        onToggleYapildi={onToggleHaftalikYapildi}
        onDeletePlan={onDeleteHaftalikPlan}
      />

      {toplamStok.length > 0 && (
        <Card style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 18, flexWrap: "wrap" }}>
          {toplamStok.map((x) => (
            <div key={x.tur}>
              <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{x.tur}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{x.adet}</div>
            </div>
          ))}
        </Card>
      )}

      {aktifMarkalar.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Aktif ya da yeni müşteri yok. Müşteriler sekmesinden ekleyince buradan otomatik kart açılır.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
          {aktifMarkalar.map((c) => (
            <MarkaStokKarti key={c.id} client={c} stoklar={stoklarObj} gecmis={gecmis} onStokDegis={onStokDegis} subeler={subeler} onAddSube={onAddSube} onDeleteSube={onDeleteSube} onSubeStokDegis={onSubeStokDegis} />
          ))}
        </div>
      )}

      {sonHareketler.length > 0 && (
        <Card style={{ padding: "14px 18px" }}>
          <SectionTitle>Son Hareketler</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sonHareketler.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontFamily: "Inter", padding: "6px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                <span style={{ color: T.text }}>{h.marka} — {h.tur}</span>
                <span style={{ color: h.tip === "cekim" ? T.success : T.textDim }}>{h.tip === "cekim" ? "+ stok eklendi" : "paylaşıldı"} · {h.tarih}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GÜNLÜK MARKA KONTROL                                                  */
/* ------------------------------------------------------------------ */
/** "Bugün" hesaplamalarını Türkiye saat dilimine (Europe/Istanbul) göre, sunucunun/tarayıcının
 * kendi saat dilimi ne olursa olsun DOĞRU şekilde yapar. Önceki `toISOString().slice(0,10)`
 * yöntemi UTC'ye çeviriyordu — Türkiye UTC+3 olduğu için gece yarısı ile saat 03:00 arasında
 * sistem hâlâ "dün" sanıyordu (Günlük Kontrol geç sıfırlanıyordu, Haftalık Plan'ın "bugün"
 * hücresi bazen yanlış haftaya denk geliyordu). Bu fonksiyon o sorunu çözer.
 */
function tarihIso(d) {
  const parcalar = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parcalar.find((p) => p.type === "year").value;
  const m = parcalar.find((p) => p.type === "month").value;
  const g = parcalar.find((p) => p.type === "day").value;
  return `${y}-${m}-${g}`;
}
const bugunISO = () => tarihIso(new Date());

/** Bir hesabın güncel bakiyesi: o hesaba kaydedilen tüm ödemeler + gelen transferler - giden transferler. */
/**
 * Hesap bakiyesi. Tek tek parametre yerine bir nesne alır — alan sayısı arttıkça
 * sıra karıştırma riski olmasın diye.
 *
 * İKİ MOD:
 *  - Otomatik (varsayılan): müşteri ödemeleri bu hesaba otomatik akar.
 *  - Elle takip (hesap.elleTakip = true): müşteri ödemeleri bu hesaba HİÇ akmaz; bakiye
 *    tamamen senin girdiğin rakamdan ve bu hesap üzerinden yaptığın hareketlerden oluşur.
 *    "Altın Olarak Alındı" gibi banka hesabı olmayan kalemler için uygundur.
 *
 * Her iki modda da: transferler, avanslar ve personel/freelancer ödemeleri bakiyeyi etkiler
 * (bunlar zaten bu kartta bilerek yaptığın hareketler), ve ELLE DÜZELTMELER eklenir.
 *
 * Bakiye hâlâ hiçbir yerde saklanmıyor — elle girdiğin rakam bile bir "düzeltme kaydı"
 * olarak tutuluyor. Bu sayede her işlem geri alınabilir ve neyin nereden geldiği izlenebilir.
 */
function hesapBakiyesi(hesapId, veri = {}) {
  const { clients, transferler, avanslar, odemeler, hesaplar, duzeltmeler } = veri;
  const hesap = (hesaplar || []).find((h) => h.id === hesapId);
  const elleTakip = !!(hesap && hesap.elleTakip);

  const girisler = elleTakip
    ? 0
    : (clients || []).flatMap((c) => c.odemeKayitlari || []).filter((k) => k.hesapId === hesapId).reduce((s, k) => s + (Number(k.tutar) || 0), 0);
  const transferGiris = (transferler || []).filter((t) => t.hedefHesapId === hesapId).reduce((s, t) => s + (Number(t.tutar) || 0), 0);
  const transferCikis = (transferler || []).filter((t) => t.kaynakHesapId === hesapId).reduce((s, t) => s + (Number(t.tutar) || 0), 0);
  // Verilen avanslar o hesaptan ÇIKAN gerçek paradır — bakiyeden düşülür.
  const avansCikis = (avanslar || []).filter((a) => a.hesapId === hesapId).reduce((s, a) => s + (Number(a.tutar) || 0), 0);
  // Personel maaşı / freelancer hak edişi ödemeleri de o hesaptan çıkan gerçek paradır.
  const odemeCikis = (odemeler || []).filter((o) => o.hesapId === hesapId).reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  // Elle yapılan bakiye düzeltmeleri (artı ya da eksi olabilir).
  const duzeltme = (duzeltmeler || []).filter((d) => d.hesapId === hesapId).reduce((s, d) => s + (Number(d.tutar) || 0), 0);

  return girisler + transferGiris - transferCikis - avansCikis - odemeCikis + duzeltme;
}

function HesapBakiyeleri({ hesaplar, clients, transferler, avanslar, odemeler, duzeltmeler, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
  const [yeniHesapAcik, setYeniHesapAcik] = useState(false);
  const [yeniHesapAdi, setYeniHesapAdi] = useState("");
  const [aktarAcik, setAktarAcik] = useState(null); // aktarılacak hesabın id'si
  const [hedefId, setHedefId] = useState("");
  const [tutarMetni, setTutarMetni] = useState("");
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState(null);   // bakiyesi elle düzenlenen hesap
  const [duzenleTutar, setDuzenleTutar] = useState("");

  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const anaHesap = liste.find((h) => h.anaHesap) || liste[0];
  const hesapAdi = (id) => (liste.find((h) => h.id === id) || {}).ad || "—";
  const kayitlar = transferler || [];

  const aktarimiAc = (h, bakiye) => {
    setAktarAcik(h.id);
    // Varsayılan hedef: ana hesaptan aktarıyorsak ilk alt hesap, değilse ana hesap.
    const varsayilanHedef = h.anaHesap ? (liste.find((x) => !x.anaHesap) || {}).id || "" : anaHesap.id;
    setHedefId(varsayilanHedef);
    setTutarMetni(String(bakiye));
  };

  /** Elle girilen bakiye, mevcut bakiyeyle arasındaki FARK bir "düzeltme kaydı" olarak
   * saklanır. Böylece ekranda tam olarak yazdığın rakam görünür, ama hiçbir hareket
   * kaybolmaz ve düzeltme istediğin an geri alınabilir. */
  const bakiyeyiKaydet = (h, mevcutBakiye) => {
    const hedef = Number(String(duzenleTutar).replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(hedef)) { window.alert("Geçerli bir tutar gir."); return; }
    const fark = hedef - mevcutBakiye;
    if (fark === 0) { setDuzenleId(null); return; }
    onAddDuzeltme({ hesapId: h.id, tutar: fark, tarih: bugunISOTarih(), not: "Elle düzeltme" });
    setDuzenleId(null);
    setDuzenleTutar("");
  };

  const aktarimiOnayla = (kaynak, bakiye) => {
    const tutar = Number(String(tutarMetni).replace(",", "."));
    if (!hedefId) { window.alert("Nereye aktarılacağını seç."); return; }
    if (hedefId === kaynak.id) { window.alert("Kaynak ve hedef hesap aynı olamaz."); return; }
    if (!tutar || Number.isNaN(tutar) || tutar <= 0) { window.alert("Geçerli bir tutar gir."); return; }
    if (tutar > bakiye) { window.alert(`${kaynak.ad} hesabında ${fmt(bakiye)} var — bundan fazlasını aktaramazsın.`); return; }
    onTransfer(kaynak.id, hedefId, tutar);
    setAktarAcik(null);
    setTutarMetni("");
  };

  return (
    <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
      <SectionTitle>Hesap Bakiyeleri</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {liste.map((h) => {
          const bakiye = hesapBakiyesi(h.id, { clients, transferler, avanslar, odemeler, hesaplar: liste, duzeltmeler });
          const acik = aktarAcik === h.id;
          return (
            <div key={h.id} style={{ background: h.anaHesap ? T.accentSoft : T.surfaceRaised, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</span>
                    {onUpdateHesap && (
                      <button
                        onClick={() => onUpdateHesap(h.id, { elleTakip: !h.elleTakip })}
                        title={h.elleTakip
                          ? "Şu an elle takip: müşteri ödemeleri bu hesaba otomatik eklenmiyor. Otomatiğe çevirmek için tıkla."
                          : "Şu an otomatik: müşteri ödemeleri bu hesaba akıyor. Elle takibe çevirmek için tıkla."}
                        style={{ background: h.elleTakip ? T.warningSoft : T.surfaceRaised, border: "none", borderRadius: 999, padding: "2px 9px", cursor: "pointer", fontSize: 10, fontFamily: "Inter", color: h.elleTakip ? T.warning : T.textFaint, fontWeight: 600 }}
                      >
                        {h.elleTakip ? "elle takip" : "otomatik"}
                      </button>
                    )}
                  </div>
                  {duzenleId === h.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <input
                        autoFocus
                        type="number"
                        value={duzenleTutar}
                        onChange={(e) => setDuzenleTutar(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") bakiyeyiKaydet(h, bakiye); if (e.key === "Escape") setDuzenleId(null); }}
                        style={{ ...inputStyle, width: 140, marginBottom: 0 }}
                      />
                      <button style={saveBtnStyle} onClick={() => bakiyeyiKaydet(h, bakiye)}>Kaydet</button>
                      <button style={cancelBtnStyle} onClick={() => setDuzenleId(null)}>İptal</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (!onAddDuzeltme) return; setDuzenleId(h.id); setDuzenleTutar(String(bakiye)); setAktarAcik(null); }}
                      title={onAddDuzeltme ? "Bakiyeyi elle düzenlemek için tıkla" : undefined}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 2, cursor: onAddDuzeltme ? "pointer" : "default", fontSize: 15, color: h.anaHesap ? T.accentText : T.text, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {fmt(bakiye)}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Aktarma artık HER hesaptan HER hesaba yapılabiliyor (ana hesap dahil) ve
                    * tutar serbestçe girilebiliyor. Eskiden sadece alt hesaptan ana hesaba,
                    * sadece bakiyenin TAMAMI aktarılabiliyordu — geri almanın hiçbir yolu yoktu. */}
                  {bakiye > 0 && liste.length > 1 && !acik && (
                    <button style={saveBtnStyle} onClick={() => aktarimiAc(h, bakiye)}>Aktar</button>
                  )}
                  {!h.anaHesap && bakiye === 0 && onDeleteHesap && (
                    <button style={iconBtnStyle} title="Hesabı sil" onClick={() => { if (window.confirm(`${h.ad} hesabı silinsin mi?`)) onDeleteHesap(h.id); }}><Trash2 size={14} color={T.danger} /></button>
                  )}
                </div>
              </div>

              {acik && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter" }}>Nereye:</span>
                  <select value={hedefId} onChange={(e) => setHedefId(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 160, marginBottom: 0 }}>
                    <option value="">Hesap seç…</option>
                    {liste.filter((x) => x.id !== h.id).map((x) => (
                      <option key={x.id} value={x.id}>{x.ad}{x.anaHesap ? " (Ana Hesap)" : ""}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={tutarMetni}
                    onChange={(e) => setTutarMetni(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") aktarimiOnayla(h, bakiye); }}
                    placeholder="Tutar"
                    style={{ ...inputStyle, width: 130, marginBottom: 0 }}
                  />
                  <button style={cancelBtnStyle} onClick={() => setTutarMetni(String(bakiye))}>Tamamı</button>
                  <button style={saveBtnStyle} onClick={() => aktarimiOnayla(h, bakiye)}>Aktar</button>
                  <button style={cancelBtnStyle} onClick={() => setAktarAcik(null)}>İptal</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onAddDuzeltme && (
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 10, lineHeight: 1.6 }}>
          Bir bakiyeye tıklayarak istediğin rakamı elle yazabilirsin. Yanındaki
          <strong> otomatik / elle takip</strong> düğmesi, müşteri ödemelerinin o hesaba otomatik akıp
          akmayacağını belirler — "Altın Olarak Alındı" gibi banka hesabı olmayan kalemleri
          <strong> elle takip</strong>'e alman mantıklı.
        </div>
      )}

      {yeniHesapAcik ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input autoFocus value={yeniHesapAdi} onChange={(e) => setYeniHesapAdi(e.target.value)} placeholder="örn. Aynur Akyalçın" style={{ ...inputStyle, flex: 1 }} />
          <button style={saveBtnStyle} onClick={() => { if (yeniHesapAdi.trim()) { onAddHesap(yeniHesapAdi.trim()); setYeniHesapAdi(""); setYeniHesapAcik(false); } }}>Ekle</button>
          <button style={cancelBtnStyle} onClick={() => setYeniHesapAcik(false)}>İptal</button>
        </div>
      ) : (
        <button style={addBtnStyle} onClick={() => setYeniHesapAcik(true)}><Plus size={13} /> Yeni Hesap Ekle</button>
      )}

      {/* ELLE DÜZELTME GEÇMİŞİ — elle girdiğin her bakiye burada bir kayıt olarak durur
        * ve geri alınabilir. Bakiye hiçbir yerde "sabit sayı" olarak saklanmadığı için
        * bir düzeltmeyi silmek her şeyi kendiliğinden eski haline döndürür. */}
      {(duzeltmeler || []).length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>Elle Bakiye Düzeltmeleri ({(duzeltmeler || []).length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
            {[...(duzeltmeler || [])].reverse().map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "Inter", flexWrap: "wrap" }}>
                <span style={{ color: T.textDim }}>
                  <span style={{ color: T.textFaint }}>{tarihGoster(d.tarih)}</span>{" · "}{hesapAdi(d.hesapId)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: Number(d.tutar) < 0 ? T.danger : T.success, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {Number(d.tutar) > 0 ? "+" : ""}{fmt(d.tutar)}
                  </strong>
                  {onDeleteDuzeltme && (
                    <button style={iconBtnStyle} title="Bu düzeltmeyi geri al" onClick={() => { if (window.confirm("Bu elle düzeltme geri alınsın mı? Bakiye düzeltme öncesindeki haline döner.")) onDeleteDuzeltme(d.id); }}>
                      <Trash2 size={13} color={T.danger} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSFER GEÇMİŞİ: her aktarım burada kayıtlı ve TEK TIKLA GERİ ALINABİLİR.
        * Eskiden yanlış yapılan bir aktarımı düzeltmenin hiçbir yolu yoktu. */}
      {kayitlar.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
          <button
            onClick={() => setGecmisAcik((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}
          >
            {gecmisAcik ? "▾" : "▸"} Transfer Geçmişi ({kayitlar.length})
          </button>
          {gecmisAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
              {[...kayitlar].reverse().map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "Inter", flexWrap: "wrap" }}>
                  <span style={{ color: T.textDim }}>
                    <span style={{ color: T.textFaint }}>{t.tarih}</span>{" · "}
                    {hesapAdi(t.kaynakHesapId)} <span style={{ color: T.textFaint }}>→</span> {hesapAdi(t.hedefHesapId)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(t.tutar)}</strong>
                    {onDeleteTransfer && (
                      <button
                        style={iconBtnStyle}
                        title="Bu aktarımı geri al"
                        onClick={() => { if (window.confirm(`${fmt(t.tutar)} tutarındaki bu aktarım geri alınsın mı? Tutar ${hesapAdi(t.kaynakHesapId)} hesabına döner.`)) onDeleteTransfer(t.id); }}
                      >
                        <Trash2 size={13} color={T.danger} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}


function CekimListesi({ clients, stoklar, subeler, gecmis }) {
  const ESIK = 4;
  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");
  const stoklarObj = stoklar || {};

  const sonCekimTarihi = (clientId, tur) => {
    const kayitlar = (gecmis || []).filter((h) => h.clientId === clientId && h.tur === tur && h.tip === "cekim");
    return kayitlar.length ? kayitlar[kayitlar.length - 1].tarih : null;
  };

  // Her marka için TÜM türlerin TOPLAMI (genel stok) hesaplanır — tek tek tür değil,
  // toplam stok eşiğin altına/eşit düşünce marka listeye girer.
  const gruplar = [];
  aktifMarkalar.forEach((c) => {
    const turler = PAYLASIM_TURLERI.map((tur) => ({ tur, adet: stoklarObj[stokAnahtari(c.id, tur)] || 0, sonCekim: sonCekimTarihi(c.id, tur) }));
    const toplam = turler.reduce((s, x) => s + x.adet, 0);
    if (toplam <= ESIK) {
      gruplar.push({ anahtar: `${c.ad}__`, marka: c.ad, sube: null, toplam, turler: turler.filter((x) => x.adet > 0) });
    }
  });

  // Şubeler kendi toplam stoklarıyla ayrı ayrı değerlendirilir (varsa).
  (subeler || []).forEach((s) => {
    const c = aktifMarkalar.find((x) => x.id === s.clientId);
    if (!c) return;
    const turler = PAYLASIM_TURLERI.map((tur) => ({ tur, adet: stoklarObj[`${s.clientId}_${s.id}_${tur}`] || 0, sonCekim: null }));
    const toplam = turler.reduce((sum, x) => sum + x.adet, 0);
    if (toplam <= ESIK) {
      gruplar.push({ anahtar: `${c.ad}__${s.ad}`, marka: c.ad, sube: s.ad, toplam, turler: turler.filter((x) => x.adet > 0) });
    }
  });

  // En acil (toplam stoğu en düşük) markalar en üstte.
  gruplar.forEach((g) => g.turler.sort((a, b) => a.adet - b.adet));
  gruplar.sort((a, b) => a.toplam - b.toplam);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="ÇEKİM GEREKEN MARKA" value={gruplar.length} mono={false} accent={gruplar.length > 0 ? T.danger : T.success} />
      </div>

      {gruplar.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.success, fontSize: 13, fontFamily: "Inter", fontWeight: 600 }}>🎉 Şu an stoğu {ESIK} ve altına düşen marka yok — çekim gereken bir şey görünmüyor.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {gruplar.map((g) => {
            const kenarRenk = g.toplam <= 1 ? T.danger : g.toplam <= 2 ? T.warning : T.border;
            return (
              <Card key={g.anahtar} style={{ padding: "14px 16px", border: `1px solid ${kenarRenk}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: g.turler.length > 0 ? 8 : 0 }}>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>{g.marka}{g.sube ? ` — ${g.sube}` : ""}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: kenarRenk, fontFamily: "'IBM Plex Mono', monospace", background: T.surfaceRaised, padding: "2px 9px", borderRadius: 999 }}>Toplam: {g.toplam}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.turler.map((x) => {
                    const renk = x.adet <= 1 ? T.danger : x.adet <= 2 ? T.warning : T.textDim;
                    const soft = x.adet <= 1 ? T.dangerSoft : x.adet <= 2 ? T.warningSoft : T.surfaceRaised;
                    return (
                      <span key={x.tur} title={x.sonCekim ? `Son çekim: ${x.sonCekim}` : undefined} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: soft, fontSize: 12, fontFamily: "Inter" }}>
                        <span style={{ color: T.textDim }}>{x.tur}</span>
                        <span style={{ color: renk, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{x.adet}</span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 12 }}>
        Bir markanın (ya da şubesinin) TÜM türlerinin toplamı {ESIK} ve altına düşünce burada listelenir — en düşük toplamdan yükseğe sıralanır. Çekim yapıp Paylaşımlar sekmesinden stoğa ekleyince buradan otomatik kalkar.
      </div>
    </div>
  );
}

function GunlukKontrol({ clients, stoklar, gecmis, kontrol, onToggle, onYenile, role }) {
  const [yenileniyor, setYenileniyor] = useState(false);
  const tikla = () => {
    setYenileniyor(true);
    Promise.resolve(onYenile ? onYenile() : null).finally(() => setTimeout(() => setYenileniyor(false), 400));
  };
  const bugun = bugunISO();
  const yapilanlar = kontrol && kontrol.tarih === bugun ? kontrol.yapilanlar : [];
  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");
  const stoklarObj = stoklar || {};

  const sonPaylasimTarihi = (clientId) => {
    const kayitlar = (gecmis || []).filter((h) => h.clientId === clientId && h.tip === "paylasim");
    return kayitlar.length ? kayitlar[kayitlar.length - 1].tarih : null;
  };

  // Her marka için: stoğu olan türler + o türün bugün işaretlenip işaretlenmediği.
  const markaDurumu = aktifMarkalar.map((c) => {
    const turler = PAYLASIM_TURLERI
      .map((t) => ({ tur: t, adet: stoklarObj[stokAnahtari(c.id, t)] || 0, yapildi: yapilanlar.includes(`${c.id}_${t}`) }))
      .filter((x) => x.adet > 0 || x.yapildi);
    const tamamlanan = turler.filter((t) => t.yapildi).length;
    const tamamlandiMi = tamamlanan > 0;
    return { client: c, turler, tamamlanan, tamamlandiMi, sonTarih: sonPaylasimTarihi(c.id) };
  });

  // CEO'nun dikkatini önce ihtiyaç olan yerlere çekmek için: hiç yapılmayanlar en üstte,
  // tamamlananlar en altta sıralanır.
  const siraliMarkalar = [...markaDurumu].sort((a, b) => {
    if (a.tamamlandiMi !== b.tamamlandiMi) return a.tamamlandiMi ? 1 : -1;
    return b.turler.length - a.turler.length;
  });

  const tamamlananMarkaSayisi = markaDurumu.filter((m) => m.tamamlandiMi).length;
  const paylasilacakBirSeyOlanlar = markaDurumu.filter((m) => m.turler.length > 0).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, alignItems: "center", justifyContent: "space-between" }}>
        <KpiCard label="BUGÜN TAMAMLANAN MARKA" value={`${tamamlananMarkaSayisi} / ${paylasilacakBirSeyOlanlar}`} mono={false} accent={paylasilacakBirSeyOlanlar > 0 && tamamlananMarkaSayisi === paylasilacakBirSeyOlanlar ? T.success : T.warning} />
        <button onClick={tikla} disabled={yenileniyor} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceRaised, color: T.text, fontSize: 12.5, fontWeight: 600, fontFamily: "Inter", cursor: yenileniyor ? "default" : "pointer", opacity: yenileniyor ? 0.6 : 1 }}>
          <RefreshCw size={13} style={yenileniyor ? { animation: "marcus-spin 0.8s linear infinite" } : undefined} />
          {yenileniyor ? "Yenileniyor…" : "Yenile"}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>
        Bu sayfa personel için sadece bir gösterge — işaretlemek için <strong>Paylaşımlar &gt; Haftalık Paylaşım Planı</strong>'nı kullanmalısınız. "Yenile" ile Haftalık Plan'daki en güncel listeye göre anlık senkronlar.
        {role === "owner" && " Owner olarak, Haftalık Plan'da karşılığı olmayan (eski/hatalı) bir işaretlemeyi düzeltmek için buradaki rozetlere de tıklayabilirsin."}
      </div>

      {paylasilacakBirSeyOlanlar > 0 && tamamlananMarkaSayisi === paylasilacakBirSeyOlanlar && (
        <Card style={{ padding: "14px 18px", marginBottom: 16, background: T.successSoft, border: `1px solid ${T.success}` }}>
          <div style={{ fontSize: 13, color: T.success, fontFamily: "Inter", fontWeight: 600 }}>🎉 Bugün stoğu olan tüm markaların paylaşımı tamamlandı — harika gidiyor.</div>
        </Card>
      )}

      {aktifMarkalar.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Aktif ya da yeni müşteri yok.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {siraliMarkalar.map(({ client: c, turler, tamamlandiMi, sonTarih }) => (
            <Card key={c.id} style={{ padding: "14px 16px", border: `1px solid ${tamamlandiMi ? T.success : turler.length > 0 ? T.warning : T.border}`, opacity: tamamlandiMi ? 0.7 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: turler.length > 0 ? 10 : 0 }}>
                <div>
                  <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter", display: "flex", alignItems: "center", gap: 8 }}>
                    {c.ad}
                    {tamamlandiMi && <Pill color={T.success} soft={T.successSoft}>Bugün tamam ✓</Pill>}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{sonTarih ? `Son paylaşım: ${sonTarih}` : "Henüz paylaşım kaydı yok"}</div>
                </div>
              </div>
              {turler.length === 0 ? (
                <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>Stokta hiçbir tür yok — paylaşacak içerik bekleniyor.</div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {turler.map((t) => (
                    <span
                      key={t.tur}
                      onClick={role === "owner" ? () => onToggle(c.id, t.tur) : undefined}
                      title={role === "owner" ? "Owner düzeltmesi: tıklayınca bu işareti geri alır (stoğu da düzeltir)" : "İşaretlemek için Paylaşımlar > Haftalık Paylaşım Planı'nı kullan"}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "none",
                        background: t.yapildi ? T.successSoft : T.surfaceRaised, color: t.yapildi ? T.success : T.text, fontSize: 12, fontFamily: "Inter", fontWeight: 600,
                        cursor: role === "owner" ? "pointer" : "default",
                      }}
                    >
                      {t.yapildi ? <Check size={13} strokeWidth={3} /> : null}
                      {t.tur} ({t.adet})
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 12 }}>
        Bir türe tıklamak "bugün paylaşıldı" demektir — o türün stoğundan 1 tane düşer ve Paylaşımlar sekmesindeki geçmişe işlenir. Bu liste her gün gece yarısı otomatik sıfırlanır. Henüz tamamlanmayan markalar en üstte gösterilir.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PERSONEL                                                              */
/* ------------------------------------------------------------------ */
const PERSONEL_FIELDS = [
  { key: "ad", label: "Ad Soyad", type: "text" },
  { key: "pozisyon", label: "Pozisyon", type: "text", placeholder: "örn. Video Editörü" },
  { key: "maas", label: "Net Maaş (₺/ay)", type: "number" },
  { key: "sigorta", label: "SGK / Sigorta (₺/ay)", type: "number" },
  { key: "yemek", label: "Yemek Gideri (₺/ay)", type: "number" },
  { key: "odemeGunu", label: "Maaş Ödeme Günü (ayın kaçı — örn. 5)", type: "number" },
  { key: "tazminatBirikimi", label: "Kıdem Tazminatı Birikimi (₺/ay, opsiyonel)", type: "number" },
  { key: "baslangic", label: "İşe Başlama (YYYY-AA)", type: "text", placeholder: "2026-01" },
];

/* ------------------------------------------------------------------ */
/* AVANS SİSTEMİ                                                         */
/* ------------------------------------------------------------------ */
/**
 * ÖNEMLİ MUHASEBE NOTU
 * Avans YENİ BİR GİDER DEĞİLDİR — maaşın (ya da hak edişin) erken ödenmiş kısmıdır.
 * Bu yüzden Toplam Gider'e ayrıca EKLENMEZ; eklenseydi aynı para iki kez sayılır ve
 * kâr olduğundan düşük görünürdü. Avansın iki gerçek etkisi vardır:
 *   1. Ay sonunda o kişiye ödenecek tutar, avans kadar AZALIR.
 *   2. Avansın çıktığı hesabın bakiyesi, avans kadar AZALIR (gerçekten çıkan para).
 */

/** Bir avans kaydının hangi kişiye ait olduğunu eşleştirir. Kadrolu personel id ile,
 * freelancer isim ile eşleşir — ikisi ayrı sistemler olarak tutulur. */
function avansKisiyeAitMi(a, { personelId, kisiAd }) {
  if (personelId != null) return a.tur === "personel" && String(a.kisiId) === String(personelId);
  return a.tur === "freelancer" && a.kisiAd === kisiAd;
}

/** Belirli bir ayda, belirli bir kişiye verilen toplam avans. */
function avansToplami(avanslar, hedef, ay) {
  return (avanslar || [])
    .filter((a) => avansKisiyeAitMi(a, hedef) && (!ay || a.ay === ay))
    .reduce((s, a) => s + (Number(a.tutar) || 0), 0);
}

/** "Avans Ver" formu — tutar, kesileceği ay, çıkacağı hesap ve not. */
function AvansVerFormu({ kisiAd, hesaplar, varsayilanAy, onKaydet, onKapat }) {
  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState("");
  const [ay, setAy] = useState(varsayilanAy || monthKey());
  const [hesapId, setHesapId] = useState((liste.find((h) => h.anaHesap) || liste[0]).id);
  const [tarih, setTarih] = useState(bugunISOTarih());
  const [not, setNot] = useState("");

  const kaydet = () => {
    const miktar = Number(String(tutar).replace(",", "."));
    if (!miktar || Number.isNaN(miktar) || miktar <= 0) { window.alert("Geçerli bir avans tutarı gir."); return; }
    onKaydet({ tutar: miktar, ay, hesapId, not: not.trim(), tarih });
    onKapat();
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 10 }}>{kisiAd} — Avans Ver</div>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tutar (₺)</label>
          <input autoFocus type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi aydan kesilecek</label>
          <AySeciciAlan value={ay} onChange={setAy} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Avans Tarihi</label>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi hesaptan çıktı</label>
          <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            {liste.map((h) => <option key={h.id} value={h.id}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Not (opsiyonel)</label>
          <input value={not} onChange={(e) => setNot(e.target.value)} placeholder="örn. acil ihtiyaç" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.6, marginBottom: 10 }}>
        Bu tutar Toplam Gider'e ayrıca eklenmez (maaş zaten sayılıyor) — seçtiğin ayın ödemesinden düşülür
        ve seçtiğin hesabın bakiyesinden çıkar.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={saveBtnStyle} onClick={kaydet}>Avansı Kaydet</button>
        <button style={cancelBtnStyle} onClick={onKapat}>İptal</button>
      </div>
    </div>
  );
}

/** Bir kişiye verilmiş avansların listesi — her biri tek tıkla silinebilir (geri alınabilir). */
function AvansListesi({ kayitlar, hesaplar, onDelete }) {
  if (!kayitlar || kayitlar.length === 0) return null;
  const hesapAdi = (id) => ((hesaplar || []).find((h) => h.id === id) || {}).ad || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {kayitlar.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "Inter", flexWrap: "wrap" }}>
          <span style={{ color: T.textDim }}>
            <span style={{ color: T.textFaint }}>{tarihGoster(a.tarih)}</span>{" · "}
            {hesapAdi(a.hesapId)} hesabından{a.not ? ` · ${a.not}` : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(a.tutar)}</strong>
            {onDelete && (
              <button style={iconBtnStyle} title="Bu avansı sil" onClick={() => { if (window.confirm(`${fmt(a.tutar)} tutarındaki avans silinsin mi? Hesap bakiyesi ve ödenecek tutar eski haline döner.`)) onDelete(a.id); }}>
                <Trash2 size={13} color={T.danger} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAAŞ / HAK EDİŞ ÖDEMELERİ                                             */
/* ------------------------------------------------------------------ */
/**
 * Ödeme kayıtları da avans gibi Toplam Gider'i DEĞİŞTİRMEZ. Sebep:
 *   - Kadrolu personelin maaşı zaten her ay gider sayılıyor (personelGideri)
 *   - Freelancer'ın müşteri maliyeti zaten gider sayılıyor (clientCosts)
 * Ödeme kaydının işi "ödendi mi, ne kadarı kaldı" takibi yapmak ve ödemenin çıktığı
 * hesabın bakiyesini azaltmaktır.
 */
function odemeKisiyeAitMi(o, { personelId, freelancerId }) {
  if (personelId != null) return o.tur === "personel" && String(o.kisiId) === String(personelId);
  return o.tur === "freelancer" && String(o.kisiId) === String(freelancerId);
}
function odemeToplami(odemeler, hedef, ay) {
  return (odemeler || [])
    .filter((o) => odemeKisiyeAitMi(o, hedef) && (!ay || o.ay === ay))
    .reduce((s, o) => s + (Number(o.tutar) || 0), 0);
}

/** Maaş ödeme gününe göre durum: henüz vadesi gelmedi / bekliyor / gecikti / ödendi. */
function maasOdemeDurumu(odemeGunu, kalan, ay) {
  if (kalan <= 0) return { etiket: "Ödendi", renk: T.success };
  const gun = Number(odemeGunu) || 0;
  if (!gun) return { etiket: "Ödeme günü yok", renk: T.textFaint };
  const bugun = new Date();
  const buAy = monthKey(bugun);
  if (ay > buAy) return { etiket: "Gelecek ay", renk: T.textFaint };
  if (ay < buAy) return { etiket: "Gecikti", renk: T.danger };
  const fark = gun - bugun.getDate();
  if (fark > 0) return { etiket: `${fark} gün sonra`, renk: T.textFaint };
  if (fark === 0) return { etiket: "Bugün", renk: T.warning };
  if (fark >= -7) return { etiket: "Bekliyor", renk: T.warning };
  return { etiket: "Gecikti", renk: T.danger };
}

/** Ödeme kaydetme formu — tutar, tarih, hangi hesaptan. */
function OdemeKaydetFormu({ kisiAd, kalan, hesaplar, ay, onKaydet, onKapat }) {
  const liste = hesaplar && hesaplar.length ? hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
  const [tutar, setTutar] = useState(String(kalan > 0 ? kalan : ""));
  const [hesapId, setHesapId] = useState((liste.find((h) => h.anaHesap) || liste[0]).id);
  const [tarih, setTarih] = useState(bugunISOTarih());
  const [not, setNot] = useState("");

  const kaydet = () => {
    const miktar = Number(String(tutar).replace(",", "."));
    if (!miktar || Number.isNaN(miktar) || miktar <= 0) { window.alert("Geçerli bir tutar gir."); return; }
    onKaydet({ tutar: miktar, ay, hesapId, tarih, not: not.trim() });
    onKapat();
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 10 }}>{kisiAd} — Ödeme Kaydet</div>
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Tutar (₺)</label>
          <input autoFocus type="number" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") kaydet(); }} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Ödeme Tarihi</label>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Hangi hesaptan</label>
          <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            {liste.map((h) => <option key={h.id} value={h.id}>{h.ad}{h.anaHesap ? " (Ana Hesap)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Not (opsiyonel)</label>
          <input value={not} onChange={(e) => setNot(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={saveBtnStyle} onClick={kaydet}>Ödemeyi Kaydet</button>
        <button style={cancelBtnStyle} onClick={onKapat}>İptal</button>
      </div>
    </div>
  );
}

/** Bir kişiye yapılmış ödemelerin listesi — her biri geri alınabilir. */
function OdemeListesi({ kayitlar, hesaplar, onDelete }) {
  if (!kayitlar || kayitlar.length === 0) return null;
  const hesapAdi = (id) => ((hesaplar || []).find((h) => h.id === id) || {}).ad || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {kayitlar.map((o) => (
        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "Inter", flexWrap: "wrap" }}>
          <span style={{ color: T.textDim }}>
            <span style={{ color: T.textFaint }}>{tarihGoster(o.tarih)}</span>{" · "}{o.ay}{" · "}{hesapAdi(o.hesapId)} hesabından{o.not ? ` · ${o.not}` : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ color: T.success, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(o.tutar)}</strong>
            {onDelete && (
              <button style={iconBtnStyle} title="Bu ödemeyi geri al" onClick={() => { if (window.confirm(`${fmt(o.tutar)} tutarındaki ödeme silinsin mi? Hesap bakiyesi ve kalan tutar eski haline döner.`)) onDelete(o.id); }}>
                <Trash2 size={13} color={T.danger} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FREELANCER SEKMESİ                                                    */
/* ------------------------------------------------------------------ */
const FREELANCER_FIELDS = [
  { key: "ad", label: "Ad Soyad", type: "text" },
  { key: "rol", label: "Rol / Uzmanlık", type: "text", placeholder: "örn. Videographer, Grafik Tasarımcı" },
  { key: "telefon", label: "Telefon (opsiyonel)", type: "text" },
  { key: "email", label: "E-posta (opsiyonel)", type: "text" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

/**
 * Freelancer listesi — üç kaynaktan beslenir ve hepsi tek yerde toplanır:
 *   1. Müşteri detayındaki Maliyetler (o kişiye bağlanmış kalemler)
 *   2. Operasyon'da kameraman/editör olarak yaptığı işler (Aylık İş Raporu ile aynı hesap)
 *   3. Elle eklenen kayıtlar
 * Aylık tablo: hak ediş − avans − yapılan ödemeler = kalan.
 */
function FreelancerBolumu({ freelancerlar, clients, jobs, isUcretleri, isUcretDetaylari, avanslar, odemeler, hesaplar, ay, onAy, onAdd, onUpdate, onDelete, onAddAvans, onDeleteAvans, onAddOdeme, onDeleteOdeme }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [acikId, setAcikId] = useState(null);
  const [avansAcikId, setAvansAcikId] = useState(null);
  const [odemeAcikId, setOdemeAcikId] = useState(null);

  const liste = freelancerlar || [];

  /** Bu kişiye bağlanmış müşteri maliyetleri (marka adıyla birlikte). */
  const musteriKalemleri = (f) => (clients || []).flatMap((c) =>
    (c.maliyetler || [])
      .filter((m) => String(m.freelancerId || "") === String(f.id))
      .map((m) => ({ ...m, marka: c.ad }))
  );
  const musteriHakEdis = (f) => musteriKalemleri(f).reduce((s, m) => s + (Number(m.tutar) || 0), 0);
  const operasyon = (f) => operasyonAylikHakEdis(jobs, f.ad, ay, isUcretleri, isUcretDetaylari);
  const hakEdis = (f) => musteriHakEdis(f) + operasyon(f).tutar;
  const avans = (f) => avansToplami(avanslar, { kisiAd: f.ad }, ay);
  const odenen = (f) => odemeToplami(odemeler, { freelancerId: f.id }, ay);
  const kalan = (f) => hakEdis(f) - avans(f) - odenen(f);

  const avansKayitlari = (f) => (avanslar || []).filter((a) => avansKisiyeAitMi(a, { kisiAd: f.ad })).slice().reverse();
  const odemeKayitlari = (f) => (odemeler || []).filter((o) => odemeKisiyeAitMi(o, { freelancerId: f.id })).slice().reverse();

  // Operasyon'da geçen ama kayıtlı olmayan isimler — tek tıkla eklenebilir.
  const kayitliAdlar = new Set(liste.map((f) => (f.ad || "").trim().toLocaleLowerCase("tr")));
  const onerilenler = operasyonKisiIsimleri(jobs).filter((ad) => !kayitliAdlar.has(ad.trim().toLocaleLowerCase("tr")));

  const toplamKalan = liste.reduce((s, f) => s + Math.max(0, kalan(f)), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="FREELANCER SAYISI" value={liste.length} mono={false} />
        <KpiCard label="BU AY ÖDENECEK KALAN" value={fmt(toplamKalan)} accent={T.warning} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Ay:</span>
          <div style={{ minWidth: 150 }}><AySeciciAlan value={ay} onChange={onAy} /></div>
        </div>
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Freelancer ekle</button>
      </Card>

      {onerilenler.length > 0 && (
        <Card style={{ padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", marginBottom: 8, lineHeight: 1.6 }}>
            Operasyon'da bu isimlere iş atanmış ama henüz freelancer olarak kayıtlı değiller. Ekleyince işleri ve hak edişleri
            otomatik buraya bağlanır:
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {onerilenler.map((ad) => (
              <button key={ad} style={addBtnStyle} onClick={() => onAdd({ ad, rol: "", telefon: "", email: "", not: "" })}>
                <Plus size={12} /> {ad}
              </button>
            ))}
          </div>
        </Card>
      )}

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={FREELANCER_FIELDS} onSubmit={(v) => { if (v.ad && v.ad.trim()) { onAdd(v); setAdding(false); } else window.alert("Ad Soyad gerekli."); }} onCancel={() => setAdding(false)} submitLabel="Freelancer'ı Ekle" />
        </div>
      )}

      {liste.length === 0 && !adding && (
        <Card style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.7 }}>
            Henüz freelancer eklenmedi. Ekledikten sonra müşteri detayındaki <strong>Maliyetler</strong> kalemlerini o kişiye
            bağlayabilir, Operasyon'daki işlerini ve ödemelerini tek yerden takip edebilirsin.
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((f) => {
          const acik = acikId === f.id;
          const op = operasyon(f);
          const kalanTutar = kalan(f);
          if (editingId === f.id) {
            return (
              <Card key={f.id} style={{ padding: 14 }}>
                <FieldForm fields={FREELANCER_FIELDS} initial={f} onSubmit={(v) => { onUpdate(f.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              </Card>
            );
          }
          return (
            <Card key={f.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setAcikId(acik ? null : f.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>{f.ad}</div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
                    {f.rol || "Rol belirtilmemiş"}
                    {op.isSayisi > 0 && ` · ${op.isSayisi} iş`}
                    {musteriKalemleri(f).length > 0 && ` · ${musteriKalemleri(f).length} müşteri kalemi`}
                  </div>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>KALAN ÖDENECEK</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: kalanTutar > 0 ? T.warning : T.success }}>{fmt(kalanTutar)}</div>
                  </div>
                  <button style={iconBtnStyle} title="Avans ver" onClick={() => { setAvansAcikId(avansAcikId === f.id ? null : f.id); setOdemeAcikId(null); setAcikId(f.id); }}><Wallet size={14} color={T.textFaint} /></button>
                  <button style={saveBtnStyle} onClick={() => { setOdemeAcikId(odemeAcikId === f.id ? null : f.id); setAvansAcikId(null); setAcikId(f.id); }}>Ödeme Kaydet</button>
                  <button style={iconBtnStyle} onClick={() => setEditingId(f.id)}><Pencil size={14} color={T.textFaint} /></button>
                  <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${f.ad} freelancer kaydı silinsin mi? (Avans ve ödeme kayıtları kalır)`)) onDelete(f.id); }}><Trash2 size={14} color={T.danger} /></button>
                </div>
              </div>

              {(acik || avansAcikId === f.id || odemeAcikId === f.id) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
                  {/* Hak ediş dökümü */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, fontFamily: "Inter", marginBottom: 10 }}>
                    <span style={{ color: T.textDim }}>Müşteri kalemleri: <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(musteriHakEdis(f))}</strong></span>
                    <span style={{ color: T.textDim }}>Operasyon işleri: <strong style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(op.tutar)}</strong></span>
                    <span style={{ color: T.textDim }}>Toplam hak ediş: <strong style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(hakEdis(f))}</strong></span>
                    {avans(f) > 0 && <span style={{ color: T.textDim }}>Avans: <strong style={{ color: T.warning, fontFamily: "'IBM Plex Mono', monospace" }}>−{fmt(avans(f))}</strong></span>}
                    {odenen(f) > 0 && <span style={{ color: T.textDim }}>Ödenen: <strong style={{ color: T.success, fontFamily: "'IBM Plex Mono', monospace" }}>−{fmt(odenen(f))}</strong></span>}
                  </div>

                  {musteriKalemleri(f).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                      {musteriKalemleri(f).map((m) => (
                        <div key={`${m.marka}-${m.id}`} style={{ display: "flex", justifyContent: "space-between", background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontFamily: "Inter" }}>
                          <span style={{ color: T.textDim }}><strong style={{ color: T.text }}>{m.marka}</strong> · {m.kalem}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.text }}>{fmt(m.tutar)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {avansAcikId === f.id && (
                    <AvansVerFormu
                      kisiAd={f.ad}
                      hesaplar={hesaplar}
                      varsayilanAy={ay}
                      onKaydet={(kayit) => onAddAvans({ ...kayit, tur: "freelancer", kisiId: null, kisiAd: f.ad })}
                      onKapat={() => setAvansAcikId(null)}
                    />
                  )}
                  {odemeAcikId === f.id && (
                    <OdemeKaydetFormu
                      kisiAd={f.ad}
                      kalan={kalanTutar}
                      hesaplar={hesaplar}
                      ay={ay}
                      onKaydet={(kayit) => onAddOdeme({ ...kayit, tur: "freelancer", kisiId: f.id, kisiAd: f.ad })}
                      onKapat={() => setOdemeAcikId(null)}
                    />
                  )}

                  <AvansListesi kayitlar={avansKayitlari(f)} hesaplar={hesaplar} onDelete={onDeleteAvans} />
                  <OdemeListesi kayitlar={odemeKayitlari(f)} hesaplar={hesaplar} onDelete={onDeleteOdeme} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 12, lineHeight: 1.7 }}>
        Müşteri kalemleri ve Operasyon işleri zaten Toplam Gider'e dahil — buradaki ödeme kayıtları gideri tekrar artırmaz,
        sadece "ödendi mi, ne kadar kaldı" takibi yapar ve ödemenin çıktığı hesabın bakiyesini azaltır.
      </div>
    </div>
  );
}

function KadroluBolumu({ personel, onAdd, onUpdate, onDelete, duzenleyenAdi, avanslar, hesaplar, onAddAvans, onDeleteAvans, odemeler, onAddOdeme, onDeleteOdeme, avansAy, setAvansAy }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [avansAcikId, setAvansAcikId] = useState(null);   // avans formu açık olan kişi
  const [avansListeId, setAvansListeId] = useState(null); // avans geçmişi açık olan kişi
  const [odemeAcikId, setOdemeAcikId] = useState(null);   // ödeme formu açık olan kişi
  const kilitleyen = useDuzenlemeKilidi("personel", editingId, !!editingId, duzenleyenAdi);
  const kisiMaliyet = (p) => (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0);
  const toplam = personel.reduce((s, p) => s + kisiMaliyet(p), 0);

  // Avans yalnızca yöneticide aktif (onAddAvans sadece owner ekranından geçiriliyor).
  const avansAktif = !!onAddAvans;
  const kisiAvansi = (p) => avansToplami(avanslar, { personelId: p.id }, avansAy);
  const kisiAvansKayitlari = (p) => (avanslar || []).filter((a) => avansKisiyeAitMi(a, { personelId: p.id })).slice().reverse();
  const kisiOdenen = (p) => odemeToplami(odemeler, { personelId: p.id }, avansAy);
  const kisiOdemeKayitlari = (p) => (odemeler || []).filter((o) => odemeKisiyeAitMi(o, { personelId: p.id })).slice().reverse();
  /** Ay sonunda o kişiye HÂLÂ ödenmesi gereken tutar: maaş − avans − yapılan ödemeler. */
  const odenecek = (p) => (Number(p.maas) || 0) - kisiAvansi(p) - kisiOdenen(p);
  const toplamAvans = personel.reduce((s, p) => s + kisiAvansi(p), 0);
  const toplamOdenecek = personel.reduce((s, p) => s + Math.max(0, odenecek(p)), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="EKİP BÜYÜKLÜĞÜ" value={personel.length} mono={false} />
        <KpiCard label="TOPLAM PERSONEL GİDERİ (₺/AY)" value={fmt(toplam)} accent={T.warning} />
        {avansAktif && toplamAvans > 0 && <KpiCard label="VERİLEN AVANS (SEÇİLİ AY)" value={fmt(toplamAvans)} accent={T.warning} />}
        {avansAktif && <KpiCard label="ÖDENECEK KALAN (SEÇİLİ AY)" value={fmt(toplamOdenecek)} accent={T.warning} />}
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {avansAktif ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Avans ayı:</span>
            <div style={{ minWidth: 150 }}><AySeciciAlan value={avansAy} onChange={setAvansAy} /></div>
          </div>
        ) : <span />}
        <button style={addBtnStyle} onClick={() => { setAdding(true); setEditingId(null); }}><Plus size={14} /> Personel ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={PERSONEL_FIELDS} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Personeli Ekle" />
        </div>
      )}

      <Card style={{ padding: 4 }}>
        <div className="marcus-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 700 }}>
          <thead>
            <tr>
              {(avansAktif
                ? ["Ad Soyad", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam", "Ödeme Günü", "Avans", "Ödenen", "Kalan", "Durum", ""]
                : ["Ad Soyad", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam", ""]
              ).map((h, i) => (
                <th key={i} style={{ textAlign: i >= 2 ? "right" : "left", padding: "12px 16px", fontSize: 11.5, color: T.textFaint, fontWeight: 600, letterSpacing: 0.3, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personel.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={8} style={{ padding: "12px 16px" }}>
                    <KilitUyarisi kisi={kilitleyen} />
                    <FieldForm fields={PERSONEL_FIELDS} initial={p} onSubmit={(v) => { onUpdate(p.id, v); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600 }}>{p.ad}</div>
                    {p.baslangic && <div style={{ color: T.textFaint, fontSize: 11.5, marginTop: 2 }}>{p.baslangic}'den beri</div>}
                  </td>
                  <td style={{ padding: "13px 16px", color: T.textDim, fontSize: 13 }}>{p.pozisyon}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.maas)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.sigorta)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{p.yemek ? fmt(p.yemek) : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{p.tazminatBirikimi ? fmt(p.tazminatBirikimi) : "—"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", color: T.warning, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{fmt(kisiMaliyet(p))}</td>
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: p.odemeGunu ? T.textDim : T.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {p.odemeGunu ? `Ayın ${p.odemeGunu}'i` : "—"}
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      <button
                        onClick={() => setAvansListeId(avansListeId === p.id ? null : p.id)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: kisiAvansi(p) > 0 ? T.warning : T.textFaint, fontWeight: kisiAvansi(p) > 0 ? 600 : 400 }}
                        title="Avans geçmişini göster"
                      >
                        {kisiAvansi(p) > 0 ? fmt(kisiAvansi(p)) : "—"}
                      </button>
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: kisiOdenen(p) > 0 ? T.success : T.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                      {kisiOdenen(p) > 0 ? fmt(kisiOdenen(p)) : "—"}
                    </td>
                  )}
                  {avansAktif && (
                    <td style={{ padding: "13px 16px", textAlign: "right", color: odenecek(p) > 0 ? T.warning : T.success, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                      {fmt(odenecek(p))}
                    </td>
                  )}
                  {avansAktif && (() => {
                    const durum = maasOdemeDurumu(p.odemeGunu, odenecek(p), avansAy);
                    return (
                      <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 11.5, fontFamily: "Inter", color: durum.renk, fontWeight: 600 }}>{durum.etiket}</td>
                    );
                  })()}
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {avansAktif && (
                      <>
                        <button style={iconBtnStyle} title="Avans ver" onClick={() => { setAvansAcikId(avansAcikId === p.id ? null : p.id); setAvansListeId(null); setOdemeAcikId(null); }}><Wallet size={14} color={T.textFaint} /></button>
                        <button style={{ ...saveBtnStyle, marginRight: 6 }} title="Maaş ödemesi kaydet" onClick={() => { setOdemeAcikId(odemeAcikId === p.id ? null : p.id); setAvansAcikId(null); setAvansListeId(null); }}>Öde</button>
                      </>
                    )}
                    <button style={iconBtnStyle} onClick={() => { setEditingId(p.id); setAdding(false); }}><Pencil size={14} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`${p.ad} silinsin mi?`)) onDelete(p.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </td>
                </tr>
              )
            )}
            {avansAktif && personel.map((p) => {
              const formAcik = avansAcikId === p.id;
              const listeAcik = avansListeId === p.id;
              const odemeAcik = odemeAcikId === p.id;
              if (!formAcik && !listeAcik && !odemeAcik) return null;
              return (
                <tr key={`avans-${p.id}`}>
                  <td colSpan={13} style={{ padding: "0 16px 14px" }}>
                    {formAcik && (
                      <AvansVerFormu
                        kisiAd={p.ad}
                        hesaplar={hesaplar}
                        varsayilanAy={avansAy}
                        onKaydet={(kayit) => onAddAvans({ ...kayit, tur: "personel", kisiId: p.id, kisiAd: p.ad })}
                        onKapat={() => setAvansAcikId(null)}
                      />
                    )}
                    {odemeAcik && (
                      <OdemeKaydetFormu
                        kisiAd={p.ad}
                        kalan={odenecek(p)}
                        hesaplar={hesaplar}
                        ay={avansAy}
                        onKaydet={(kayit) => onAddOdeme({ ...kayit, tur: "personel", kisiId: p.id, kisiAd: p.ad })}
                        onKapat={() => setOdemeAcikId(null)}
                      />
                    )}
                    {listeAcik && (
                      <>
                        {kisiAvansKayitlari(p).length === 0 && kisiOdemeKayitlari(p).length === 0 && (
                          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 8 }}>{p.ad} için henüz avans veya ödeme kaydı yok.</div>
                        )}
                        <AvansListesi kayitlar={kisiAvansKayitlari(p)} hesaplar={hesaplar} onDelete={onDeleteAvans} />
                        <OdemeListesi kayitlar={kisiOdemeKayitlari(p)} hesaplar={hesaplar} onDelete={onDeleteOdeme} />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {personel.length === 0 && (
              <tr><td colSpan={avansAktif ? 13 : 8} style={{ padding: "24px 16px", textAlign: "center", color: T.textFaint, fontSize: 13 }}>Henüz personel eklenmedi.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 10, lineHeight: 1.7 }}>
        Buradaki toplam, Dashboard ve Finans'taki Toplam Gider'e otomatik olarak eklenir.
        {avansAktif && " Avanslar ve ödeme kayıtları Toplam Gider'i DEĞİŞTİRMEZ — maaş zaten sayıldığı için eklenseydi aynı para iki kez sayılırdı. Etkileri iki yerde: \"Kalan\" sütununda ve paranın çıktığı hesabın bakiyesinde."}
      </div>
    </div>
  );
}

/**
 * Personel sekmesi: "Kadrolu" ve "Freelancer" olmak üzere iki bölüm.
 * Ay seçici iki bölüm arasında PAYLAŞILIR — böylece bir aya bakarken sekme değiştirince
 * ay sıfırlanmaz ve iki liste hep aynı dönemi gösterir.
 */
function Personel(props) {
  const [altSekme, setAltSekme] = useState("kadrolu");
  const [ay, setAy] = useState(monthKey());
  const freelancerAktif = !!props.onAddFreelancer; // yalnızca yönetici ekranında geçiriliyor

  if (!freelancerAktif) return <KadroluBolumu {...props} avansAy={ay} setAvansAy={setAy} />;

  const sekmeler = [
    { key: "kadrolu", label: `Kadrolu (${(props.personel || []).length})` },
    { key: "freelancer", label: `Freelancer (${(props.freelancerlar || []).length})` },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {sekmeler.map((sk) => (
          <button
            key={sk.key}
            onClick={() => setAltSekme(sk.key)}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif",
              fontSize: 13.5, fontWeight: 600,
              background: altSekme === sk.key ? T.accentSoft : "transparent",
              color: altSekme === sk.key ? T.accentText : T.textDim,
            }}
          >
            {sk.label}
          </button>
        ))}
      </div>

      {altSekme === "kadrolu" && <KadroluBolumu {...props} avansAy={ay} setAvansAy={setAy} />}
      {altSekme === "freelancer" && (
        <FreelancerBolumu
          freelancerlar={props.freelancerlar || []}
          clients={props.clients || []}
          jobs={props.jobs || []}
          isUcretleri={props.isUcretleri || {}}
          isUcretDetaylari={props.isUcretDetaylari || {}}
          avanslar={props.avanslar || []}
          odemeler={props.odemeler || []}
          hesaplar={props.hesaplar}
          ay={ay}
          onAy={setAy}
          onAdd={props.onAddFreelancer}
          onUpdate={props.onUpdateFreelancer}
          onDelete={props.onDeleteFreelancer}
          onAddAvans={props.onAddAvans}
          onDeleteAvans={props.onDeleteAvans}
          onAddOdeme={props.onAddOdeme}
          onDeleteOdeme={props.onDeleteOdeme}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BİRİKİM (Fonlar)                                                      */
/* ------------------------------------------------------------------ */
const FON_FIELDS = [
  { key: "ad", label: "Fon Adı", type: "text", placeholder: "örn. Kıdem Tazminatı Fonu" },
  { key: "hedefTutar", label: "Hedef Tutar (₺, opsiyonel)", type: "number" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];
const HAREKET_FIELDS = [
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "tarih", label: "Tarih", type: "date" },
  { key: "not", label: "Not (opsiyonel)", type: "text", placeholder: "örn. Temmuz ayı payı" },
];

function FonCard({ fon, onDelete, onAddHareket, onDeleteHareket }) {
  const [addingTip, setAddingTip] = useState(null); // "ekleme" | "kullanim" | null
  const bakiye = fon.bakiye || 0;
  const hedef = Number(fon.hedefTutar) || 0;
  const pct = hedef > 0 ? Math.min(100, Math.round((bakiye / hedef) * 100)) : null;
  const hareketler = [...(fon.hareketler || [])].reverse();

  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.text }}>{fon.ad}</div>
          {fon.not && <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>{fon.not}</div>}
        </div>
        <button style={iconBtnStyle} onClick={() => { if (window.confirm(`"${fon.ad}" fonu tüm hareketleriyle silinsin mi?`)) onDelete(); }}><Trash2 size={14} color={T.danger} /></button>
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 600, color: bakiye < 0 ? T.danger : T.text, margin: "12px 0 6px" }}>{fmt(bakiye)}</div>

      {hedef > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 6, borderRadius: 999, background: T.borderSoft, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: T.accent, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>%{pct} · Hedef {fmt(hedef)}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button style={{ ...addBtnStyle, flex: 1, justifyContent: "center" }} onClick={() => setAddingTip(addingTip === "ekleme" ? null : "ekleme")}><Plus size={13} /> Para Ekle</button>
        <button style={{ ...cancelBtnStyle, flex: 1 }} onClick={() => setAddingTip(addingTip === "kullanim" ? null : "kullanim")}>− Para Kullan</button>
      </div>

      {addingTip && (
        <div style={{ marginBottom: 14 }}>
          <FieldForm
            fields={HAREKET_FIELDS}
            onSubmit={(v) => { onAddHareket(addingTip, v.tutar, v.not, v.tarih); setAddingTip(null); }}
            onCancel={() => setAddingTip(null)}
            submitLabel={addingTip === "ekleme" ? "Ekle" : "Kullan"}
          />
        </div>
      )}

      {hareketler.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>HAREKETLER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {hareketler.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: T.surfaceRaised, borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 12, fontFamily: "Inter", color: h.tip === "ekleme" ? T.success : T.danger, fontWeight: 600 }}>{h.tip === "ekleme" ? "+" : "−"}{fmt(h.tutar)}</span>
                  <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginLeft: 6 }}>{tarihGoster(h.tarih)}{h.not ? " · " + h.not : ""}</span>
                </div>
                <button style={iconBtnStyle} onClick={() => onDeleteHareket(h.id)}><Trash2 size={11} color={T.textFaint} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const UYELIK_FIELDS = [
  { key: "ad", label: "Hizmet Adı", type: "text", placeholder: "örn. Canva Pro, Adobe CC, ChatGPT" },
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "periyot", label: "Periyot", type: "select", options: [{ value: "aylik", label: "Aylık" }, { value: "yillik", label: "Yıllık" }] },
  { key: "kullaniciAdi", label: "Kullanıcı Adı (opsiyonel)", type: "text" },
  { key: "sifre", label: "Şifre (opsiyonel)", type: "text" },
  { key: "baslangicTarihi", label: "Başlangıç Tarihi (opsiyonel)", type: "date" },
  { key: "bitisTarihi", label: "Bitiş Tarihi (opsiyonel)", type: "date" },
  { key: "not", label: "Not (opsiyonel)", type: "text" },
];

/** Bir üyeliğin kullanıcı adı/şifresini kayıtlı bir personele e-posta ile göndermek için —
 * DevirTeslimFormu ile aynı /api/notify-job uç noktasını (mod: "uyelik") kullanır. */
function UyelikBilgisiGonder({ uyelik, personelRosteri, firmaAdi, onClose }) {
  const [secilenAd, setSecilenAd] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState("");
  const roster = personelRosteri || [];

  const gonder = () => {
    const kisi = roster.find((p) => p.ad === secilenAd);
    if (!kisi) { setSonuc("Bir kişi seç."); return; }
    if (!kisi.email) { setSonuc(`${kisi.ad} için kayıtlı bir e-posta yok.`); return; }
    setGonderiliyor(true);
    setSonuc("");
    fetch("/api/notify-job", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: kisi.email, ad: kisi.ad, marka: uyelik.ad, kullaniciAdi: uyelik.kullaniciAdi, sifre: uyelik.sifre, firmaAdi, mod: "uyelik" }),
    })
      .then((r) => r.json())
      .then((res) => setSonuc(res.ok ? "✅ Gönderildi." : "❌ " + (res.reason || res.error || "Gönderilemedi.")))
      .catch(() => setSonuc("❌ Bağlantı hatası."))
      .finally(() => setGonderiliyor(false));
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 12, marginTop: 10 }}>
      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 8 }}>Kimin e-postasına gönderilsin?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={secilenAd} onChange={(e) => setSecilenAd(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
          <option value="">Kişi seç…</option>
          {roster.map((p, i) => <option key={i} value={p.ad}>{p.ad}</option>)}
        </select>
        <button style={saveBtnStyle} onClick={gonder} disabled={gonderiliyor}>{gonderiliyor ? "Gönderiliyor…" : "Gönder"}</button>
        <button style={cancelBtnStyle} onClick={onClose}>Kapat</button>
      </div>
      {sonuc && <div style={{ fontSize: 12, color: sonuc.startsWith("✅") ? T.success : T.danger, marginTop: 8 }}>{sonuc}</div>}
    </div>
  );
}

function Uyelikler({ uyelikler, onAdd, onUpdate, onDelete, personelRosteri, firmaAdi }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gonderAcikId, setGonderAcikId] = useState(null);
  const [gosterilenSifreId, setGosterilenSifreId] = useState(null);
  const liste = uyelikler || [];
  const aktifListe = liste.filter(uyelikEfektifAktifMi);
  const aylikToplam = aktifListe.reduce((s, u) => s + (u.periyot === "yillik" ? (Number(u.tutar) || 0) / 12 : (Number(u.tutar) || 0)), 0);
  const yillikToplam = aylikToplam * 12;

  const yakindaBitecek = (tarih) => {
    if (!tarih) return false;
    const fark = Math.round((new Date(tarih) - new Date()) / 86400000);
    return fark >= 0 && fark <= 7;
  };

  const kopyala = (deger) => { if (deger) navigator.clipboard.writeText(deger).catch(() => {}); };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="AYLIK TOPLAM (SADECE AKTİF)" value={fmt(aylikToplam)} accent={T.warning} />
        <KpiCard label="YILLIK TOPLAM (SADECE AKTİF)" value={fmt(yillikToplam)} mono={false} />
        <KpiCard label="ÜYELİK SAYISI" value={`${aktifListe.length} aktif / ${liste.length} toplam`} mono={false} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={14} /> Yeni Üyelik Ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={UYELIK_FIELDS} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Üyeliği Ekle" />
        </div>
      )}

      {liste.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz üyelik eklenmedi. Canva, Adobe, ChatGPT gibi Marcus Medya adına ödenen tüm abonelikleri buraya ekleyebilirsin.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {liste.map((u) => {
            const yakinda = yakindaBitecek(u.bitisTarihi);
            const aktifMi = uyelikEfektifAktifMi(u);
            const suresiDolduMu = !aktifMi && u.aktif !== false; // otomatik pasif (tarih geçmiş), elle kapatılmamış
            const sifreGoster = gosterilenSifreId === u.id;
            return (
              <Card key={u.id} style={{ padding: "14px 18px", border: !aktifMi ? `1px solid ${T.border}` : yakinda ? `1px solid ${T.warning}` : undefined, opacity: aktifMi ? 1 : 0.7 }}>
                {editingId === u.id ? (
                  <FieldForm
                    fields={UYELIK_FIELDS}
                    initial={u}
                    onSubmit={(v) => { onUpdate(u.id, v); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Kaydet"
                  />
                ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {u.ad}
                      {aktifMi ? (
                        <span style={{ fontSize: 10.5, color: T.success, background: T.successSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>Aktif</span>
                      ) : (
                        <span style={{ fontSize: 10.5, color: T.textFaint, background: T.borderSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>{suresiDolduMu ? "Pasif (süresi doldu)" : "Pasif"}</span>
                      )}
                      {aktifMi && yakinda && <span style={{ fontSize: 10.5, color: T.warning, background: T.warningSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>7 gün içinde bitecek</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
                      {fmt(u.tutar)} / {u.periyot === "yillik" ? "yıl" : "ay"}
                      {u.baslangicTarihi && ` · Başlangıç: ${new Date(u.baslangicTarihi).toLocaleDateString("tr-TR")}`}
                      {u.bitisTarihi && ` · Bitiş: ${new Date(u.bitisTarihi).toLocaleDateString("tr-TR")}`}
                      {u.not && ` · ${u.not}`}
                    </div>
                    {(u.kullaniciAdi || u.sifre) && (
                      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                        {u.kullaniciAdi && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim, fontFamily: "Inter" }}>
                            <span style={{ color: T.textFaint }}>Kullanıcı:</span> {u.kullaniciAdi}
                            <button onClick={() => kopyala(u.kullaniciAdi)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Copy size={11} color={T.textFaint} /></button>
                          </div>
                        )}
                        {u.sifre && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim, fontFamily: "Inter" }}>
                            <span style={{ color: T.textFaint }}>Şifre:</span> {sifreGoster ? u.sifre : "••••••"}
                            <button onClick={() => setGosterilenSifreId(sifreGoster ? null : u.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>{sifreGoster ? <EyeOff size={11} color={T.textFaint} /> : <Eye size={11} color={T.textFaint} />}</button>
                            <button onClick={() => kopyala(u.sifre)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Copy size={11} color={T.textFaint} /></button>
                          </div>
                        )}
                      </div>
                    )}
                    {(u.kullaniciAdi || u.sifre) && (
                      gonderAcikId === u.id ? (
                        <UyelikBilgisiGonder uyelik={u} personelRosteri={personelRosteri} firmaAdi={firmaAdi} onClose={() => setGonderAcikId(null)} />
                      ) : (
                        <button onClick={() => setGonderAcikId(u.id)} style={{ background: "none", border: "none", color: T.accentText, fontSize: 11.5, cursor: "pointer", padding: 0, marginTop: 8, fontFamily: "Inter" }}>✉️ Bilgileri Mail Gönder</button>
                      )
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...iconBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11 }} onClick={() => onUpdate(u.id, { aktif: !aktifMi })}>{aktifMi ? "Pasif Et" : "Aktif Et"}</button>
                    <button style={iconBtnStyle} onClick={() => setEditingId(u.id)}><Pencil size={13} color={T.textFaint} /></button>
                    <button style={iconBtnStyle} onClick={() => { if (window.confirm(`"${u.ad}" üyeliği silinsin mi?`)) onDelete(u.id); }}><Trash2 size={14} color={T.danger} /></button>
                  </div>
                </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 14 }}>
        Bitiş tarihi geçen bir üyelik otomatik olarak "Pasif" sayılır ve Dashboard'daki Toplam Gider'den düşer. "Aktif Et"e basarsan (yenilediğinde), bitiş tarihi geçmiş olsa bile tekrar gidere dahil edilir — o zaman tarihi de güncellemen iyi olur.
      </div>
    </div>
  );
}

function Birikim({ birikimler, onAddFon, onDeleteFon, onAddHareket, onDeleteHareket }) {
  const [adding, setAdding] = useState(false);
  const toplam = birikimler.reduce((s, f) => s + (f.bakiye || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="TOPLAM BİRİKİM (TÜM FONLAR)" value={fmt(toplam)} accent={T.success} />
        <KpiCard label="FON SAYISI" value={birikimler.length} mono={false} />
      </div>

      <Card style={{ padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={14} /> Yeni fon ekle</button>
      </Card>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <FieldForm fields={FON_FIELDS} onSubmit={(v) => { onAddFon(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Fonu Ekle" />
        </div>
      )}

      {birikimler.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz fon eklenmedi. Kıdem tazminatı, acil müdahale fonu gibi biriktirmek istediğin her şey için ayrı bir fon açabilirsin.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {birikimler.map((f) => (
            <FonCard
              key={f.id}
              fon={f}
              onDelete={() => onDeleteFon(f.id)}
              onAddHareket={(tip, tutar, not) => onAddHareket(f.id, tip, tutar, not)}
              onDeleteHareket={(hareketId) => onDeleteHareket(f.id, hareketId)}
            />
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", marginTop: 16 }}>
        İpucu: Personel sekmesinde bir çalışanın "Kıdem Tazminatı Birikimi" alanı her ay Toplam Gider'e otomatik ekleniyor —
        o parayı fiilen kenara koyduğunda buradaki ilgili fona "Para Ekle" ile işleyerek gerçek bakiyeni takip edebilirsin.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AYARLAR                                                               */
/* ------------------------------------------------------------------ */
function EmailYedekTest({ endpoint = "/api/daily-backup" }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [message, setMessage] = useState("");

  const test = () => {
    setStatus("loading");
    fetch(endpoint, { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          if (res.to) setMessage(`Gönderildi: ${res.to}`);
          else if (res.operasyonHatirlatma !== undefined) {
            const opSayisi = res.operasyonHatirlatma.filter((x) => x.gonderildi).length;
            const markaSayisi = (res.markalasmaHatirlatma || []).filter((x) => x.gonderildi).length;
            setMessage(`${opSayisi} kişiye Operasyon, ${markaSayisi} yöneticiye Markalaşma hatırlatması gitti. Günlük Kontrol özeti: ${res.gunlukKontrolOzeti ? "gönderildi" : "eksik yok / gönderilmedi"}.`);
          } else setMessage("Tamamlandı.");
          setStatus("ok");
        }
        else if (res.skipped) { setStatus("error"); setMessage(res.reason); }
        else { setStatus("error"); setMessage(res.error || "Bilinmeyen hata"); }
      })
      .catch(() => { setStatus("error"); setMessage("Bağlantı hatası."); });
  };

  return (
    <div>
      <button style={addBtnStyle} onClick={test} disabled={status === "loading"}>
        {status === "loading" ? "Gönderiliyor…" : "Şimdi Test Et"}
      </button>
      {message && (
        <div style={{ fontSize: 12, fontFamily: "Inter", color: status === "ok" ? T.success : T.warning, marginTop: 8 }}>{message}</div>
      )}
    </div>
  );
}

function YedekGecmisi() {
  const [liste, setListe] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [indiriliyor, setIndiriliyor] = useState(null);
  const [gorunum, setGorunum] = useState("gunluk"); // "gunluk" | "saatlik" | "geriAlma"

  const listeyiCek = () => {
    fetch("/api/backup", { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => setListe({ dates: res.dates || [], saatlikler: res.saatlikler || [], geriAlmalar: res.geriAlmalar || [] }))
      .catch(() => setListe({ dates: [], saatlikler: [], geriAlmalar: [] }));
  };
  useEffect(listeyiCek, []);

  /** Geri yüklemeden ÖNCE o yedeğin içinde ne olduğunu gösterir. Yanlış tarihe dönmenin
   * en yaygın sebebi, içeriğini görmeden karar vermekti. */
  const restore = (anahtar, etiket) => {
    fetch(`/api/backup?key=${encodeURIComponent(anahtar)}&ozet=1`, { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => {
        const o = res.ozet;
        const ozetMetni = o
          ? `Bu yedeğin içinde:\n  • ${o.musteri} müşteri\n  • ${o.personel} personel\n  • ${o.cekimIsleri} operasyon işi\n  • ${o.uyelikler} üyelik\n\n`
          : "";
        if (!window.confirm(`${etiket} yedeğine dönülecek.\n\n${ozetMetni}Şu anki verinin tam bir kopyası otomatik olarak saklanacak — yanlış olursa "Geri Yükleme Öncesi" sekmesinden geri dönebilirsin.\n\nDevam edilsin mi?`)) return;
        setRestoring(anahtar);
        return fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() }, body: JSON.stringify({ key: anahtar }) })
          .then((r) => r.json())
          .then((res2) => {
            if (res2.ok) { window.alert("Geri yüklendi. Sayfa yenileniyor…"); window.location.reload(); }
            else { window.alert(res2.error || "Geri yükleme başarısız."); setRestoring(null); }
          });
      })
      .catch(() => { window.alert("Bağlantı hatası."); setRestoring(null); });
  };

  const indir = (anahtar, etiket) => {
    setIndiriliyor(anahtar);
    fetch(`/api/backup?key=${encodeURIComponent(anahtar)}`, { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => {
        if (!res.data) { window.alert(res.error || "Bu yedek bulunamadı."); return; }
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `marcus-os-yedek-${etiket.replace(/[^0-9A-Za-z-]/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => window.alert("Bağlantı hatası — indirilemedi."))
      .finally(() => setIndiriliyor(null));
  };

  const okunakliTarih = (d) => {
    const parcalar = d.split("-");
    if (parcalar.length < 3) return d;
    const [y, m, day] = parcalar;
    const tarih = new Date(Number(y), Number(m) - 1, Number(day));
    if (Number.isNaN(tarih.getTime())) return d;
    return tarih.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };
  const okunakliSaat = (s2) => {
    const p2 = s2.split("-");
    if (p2.length < 4) return s2;
    return `${okunakliTarih(p2.slice(0, 3).join("-"))} — saat ${p2[3]}:00`;
  };
  const okunakliGeriAlma = (s2) => {
    // 2026-08-11T14-32-05 biçimindeki etiketi okunur hale getirir.
    const duz = s2.replace("T", " ").replace(/-(\d{2})-(\d{2})$/, ":$1:$2");
    return duz;
  };

  if (liste === null) return <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Yükleniyor…</div>;

  const sekmeler = [
    { key: "gunluk", label: `Günlük (${liste.dates.length})` },
    { key: "saatlik", label: `Saatlik (${liste.saatlikler.length})` },
    { key: "geriAlma", label: `Geri Yükleme Öncesi (${liste.geriAlmalar.length})` },
  ];

  let kayitlar = [];
  if (gorunum === "gunluk") kayitlar = liste.dates.slice(0, 30).map((d) => ({ anahtar: `marcus-os-snapshot-${d}`, etiket: okunakliTarih(d) }));
  else if (gorunum === "saatlik") kayitlar = liste.saatlikler.map((h) => ({ anahtar: `marcus-os-saatlik-${h}`, etiket: okunakliSaat(h) }));
  else kayitlar = liste.geriAlmalar.map((g) => ({ anahtar: `marcus-os-geri-alma-${g}`, etiket: okunakliGeriAlma(g) }));

  const aciklama = {
    gunluk: "Her günün SON hâli. 30 gün saklanır.",
    saatlik: "Son 48 saatin her saati. Gün içinde bir şey ters giderse buradan saat saat geri dönebilirsin.",
    geriAlma: "Bir geri yükleme yapmadan HEMEN ÖNCEKİ hâller. Yanlış tarihe döndüysen buradan eski durumuna dönebilirsin. 30 gün saklanır.",
  }[gorunum];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {sekmeler.map((sk) => (
          <button
            key={sk.key}
            onClick={() => setGorunum(sk.key)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "Inter", fontSize: 12,
              background: gorunum === sk.key ? T.accentSoft : T.surfaceRaised, color: gorunum === sk.key ? T.accentText : T.textDim, fontWeight: 600 }}
          >
            {sk.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 10, lineHeight: 1.6 }}>{aciklama}</div>
      {kayitlar.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>
          {gorunum === "geriAlma" ? "Henüz hiç geri yükleme yapılmadı — bu iyi bir şey." : "Henüz yedek oluşmadı; ilk kayıttan itibaren otomatik birikmeye başlar."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {kayitlar.map((k) => (
            <div key={k.anahtar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: T.surfaceRaised, borderRadius: 9, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter" }}>{k.etiket}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={cancelBtnStyle} disabled={indiriliyor === k.anahtar} onClick={() => indir(k.anahtar, k.etiket)}>{indiriliyor === k.anahtar ? "İndiriliyor…" : "İndir (JSON)"}</button>
                <button style={cancelBtnStyle} disabled={restoring === k.anahtar} onClick={() => restore(k.anahtar, k.etiket)}>{restoring === k.anahtar ? "Geri yükleniyor…" : "Bu hâle dön"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TebligSablonuKart({ firmaAdi, tebligSablonu, onSave }) {
  const [ad, setAd] = useState(firmaAdi || "Marcus Medya");
  const [sablon, setSablon] = useState(tebligSablonu || DEFAULT_TEBLIG_SABLONU);
  const [kaydedildi, setKaydedildi] = useState(false);

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Tebliğ Şablonu</SectionTitle>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
        Müşteriler'deki "Tebliğ Oluştur" her tıklandığında bu şablon kullanılır (istersen o an ayrıca da düzenleyebilirsin).
        Kullanabileceğin yer tutucular: <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{musteri}"}</code>{" "}
        <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{aylikUcret}"}</code>{" "}
        <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{ay}"}</code>{" "}
        <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{toplamBakiye}"}</code>{" "}
        <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{firma}"}</code>{" "}
        <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>{"{tarih}"}</code>
      </p>
      <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Firma Adı (yazının imzasında ve başlığında görünür)</label>
      <input value={ad} onChange={(e) => setAd(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Şablon Metni</label>
      <textarea
        value={sablon}
        onChange={(e) => setSablon(e.target.value)}
        rows={12}
        style={{ width: "100%", background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", color: T.text, fontSize: 13.5, fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical", lineHeight: 1.6, marginBottom: 12 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={saveBtnStyle} onClick={() => { onSave(ad, sablon); setKaydedildi(true); setTimeout(() => setKaydedildi(false), 2000); }}>Şablonu Kaydet</button>
        {kaydedildi && <span style={{ fontSize: 12.5, color: T.success, fontFamily: "Inter" }}>✓ Kaydedildi</span>}
      </div>
    </Card>
  );
}

/** Bu sayfaya girmek için sahibin şifresini TEKRAR ister — sayfadan her çıkıp girişte
 * (sekme değişince bileşen yeniden monte olduğu için) yeniden sorulur. Sadece owner
 * şifresi kabul edilir; girilen şifre sunucuya doğrulatılır, hiçbir yerde saklanmaz. */
function SifreGateli({ children }) {
  const [dogrulandi, setDogrulandi] = useState(false);
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);
  const [ayarlandiMi, setAyarlandiMi] = useState(null); // null = henüz bilinmiyor, kontrol ediliyor

  useEffect(() => {
    fetch("/api/kasa", { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((res) => setAyarlandiMi(!!res.ayarlandiMi))
      .catch(() => setAyarlandiMi(false));
  }, []);

  const dogrula = () => {
    if (!sifre) return;
    setKontrolEdiliyor(true);
    setHata("");
    fetch("/api/kasa", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "dogrula", sifre }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setDogrulandi(true);
        else if (res.kasaSifresiYok) setAyarlandiMi(false);
        else setHata(res.error || "Şifre yanlış.");
      })
      .catch(() => setHata("Bağlantı hatası — tekrar dene."))
      .finally(() => setKontrolEdiliyor(false));
  };

  if (dogrulandi) return children;

  if (ayarlandiMi === null) {
    return <div style={{ maxWidth: 340, margin: "60px auto", textAlign: "center", color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Yükleniyor…</div>;
  }

  if (ayarlandiMi === false) {
    return (
      <div style={{ maxWidth: 380, margin: "60px auto", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.warningSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <KeyRound size={20} color={T.warning} />
        </div>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 6 }}>Henüz kasa şifresi belirlenmedi</div>
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.6 }}>
          Bu sayfa, owner (site) şifrenden <strong>tamamen bağımsız</strong> ayrı bir şifre gerektiriyor.
          Devam edebilmek için önce <strong>Ayarlar → Şifre Kasası Şifresi</strong> bölümünden bir şifre belirlemen gerekiyor.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 340, margin: "60px auto", textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Lock size={20} color={T.textFaint} />
      </div>
      <div style={{ fontSize: 14, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 6 }}>Bu sayfa ekstra korumalı</div>
      <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 18 }}>Devam etmek için Ayarlar'dan belirlediğin kasa şifresini gir.</div>
      <input
        type="text"
        autoFocus
        name={`kasa-giris-${Math.random().toString(36).slice(2)}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        data-lpignore="true"
        data-1p-ignore="true"
        value={sifre}
        onChange={(e) => setSifre(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dogrula()}
        placeholder="Kasa Şifresi"
        style={{ ...inputStyle, textAlign: "center", marginBottom: 12, WebkitTextSecurity: "disc" }}
      />
      <button onClick={dogrula} disabled={kontrolEdiliyor} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", opacity: kontrolEdiliyor ? 0.6 : 1 }}>
        {kontrolEdiliyor ? "Kontrol ediliyor…" : "Devam Et"}
      </button>
      {hata && <div style={{ color: T.danger, fontSize: 12.5, fontFamily: "Inter", marginTop: 10 }}>{hata}</div>}
    </div>
  );
}

const SOSYAL_PLATFORMLAR = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "google", label: "Google" },
  { key: "linkedin", label: "LinkedIn" },
];

function KopyalanabilirAlan({ label, value, onChange, gizli }) {
  const [gosterildi, setGosterildi] = useState(false);
  // Tarayıcı, "type=password" olan her alanı (bu alan Göster/Gizle ile type değiştiriyordu)
  // bu sitede daha önce kaydedilmiş bir şifreyle (örn. senin owner şifrenle) otomatik
  // doldurmaya çalışıyordu — "şifrenin kendiliğinden CEO şifresine dönüşmesi" bundan kaynaklanıyordu.
  // Çözüm: alan hiçbir zaman gerçek type="password" olmuyor, gizleme sadece görsel olarak
  // (-webkit-text-security ile) yapılıyor — tarayıcı bunu bir "şifre alanı" olarak tanımıyor.
  const rastgeleAd = useRef(`alan-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).current;
  const kopyala = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 3 }}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          name={rastgeleAd}
          data-lpignore="true"
          data-1p-ignore="true"
          style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 12.5, WebkitTextSecurity: gizli && !gosterildi ? "disc" : "none" }}
        />
        {gizli && (
          <button type="button" onClick={() => setGosterildi((v) => !v)} title={gosterildi ? "Gizle" : "Göster"} style={{ ...iconBtnStyle, width: 30, height: 30 }}>
            {gosterildi ? <EyeOff size={13} color={T.textFaint} /> : <Eye size={13} color={T.textFaint} />}
          </button>
        )}
        <button type="button" onClick={kopyala} title="Kopyala" style={{ ...iconBtnStyle, width: 30, height: 30 }}>
          <Copy size={13} color={T.textFaint} />
        </button>
      </div>
    </div>
  );
}

/** Marka ile çalışma bittiğinde: Drive linki + varsa kayıtlı şifreleri e-posta ile iade eder,
 * ve aynı bildirimi WhatsApp'ta göndermeye hazır halde açar (gerçek otomatik WhatsApp gönderimi
 * Meta'nın iş onayı gerektirdiği için burada "wa.me" bağlantısıyla tek tıkla gönderime hazırlanır). */
/** Şifre gönderme gibi geri alınamaz işlemlerden hemen önce, Şifre Kasası'na giriş için kullanılan
 * kasa şifresinden BAĞIMSIZ olarak, gerçek owner (SITE_PASSWORD) şifresini tekrar ister. */
function OwnerSifreOnay({ onConfirmed, onCancel }) {
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);

  const dogrula = () => {
    if (!sifre) return;
    setKontrolEdiliyor(true);
    setHata("");
    fetch("/api/data", { headers: { "X-Site-Password": sifre } })
      .then((r) => r.json())
      .then((res) => {
        if (res.role === "owner") onConfirmed(sifre);
        else setHata("Şifre yanlış — sadece yönetici (owner) şifresiyle gönderilebilir.");
      })
      .catch(() => setHata("Bağlantı hatası."))
      .finally(() => setKontrolEdiliyor(false));
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.danger}`, borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 8 }}>🔒 Göndermeden önce owner şifreni onayla</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="password" autoFocus autoComplete="off" value={sifre} onChange={(e) => setSifre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dogrula()} placeholder="Owner Şifresi" style={{ ...inputStyle, flex: 1 }} />
        <button style={saveBtnStyle} onClick={dogrula} disabled={kontrolEdiliyor}>{kontrolEdiliyor ? "…" : "Onayla ve Gönder"}</button>
        <button style={cancelBtnStyle} onClick={onCancel}>İptal</button>
      </div>
      {hata && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 6 }}>{hata}</div>}
    </div>
  );
}

/** jsPDF'i sayfaya bir kere yükler (npm bağımlılığı eklemeden, CDN üzerinden). */
function yukleJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf);
    script.onerror = () => reject(new Error("PDF kütüphanesi yüklenemedi — internet bağlantını kontrol et."));
    document.head.appendChild(script);
  });
}

/** Bir data-URL görselin doğal (piksel) genişlik/yükseklik oranını öğrenir — PDF'e eklerken
 * oranı bozmadan (sıkıştırıp/uzatmadan) yerleştirebilmek için. */
function gorselOraniniAl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function hesapBilgileriPdfOlustur(marka, firmaAdi, girisListesi, driveLinki, logo) {
  return yukleJsPDF().then(async ({ jsPDF }) => {
    const doc = new jsPDF();
    let baslikY = 20;
    if (logo) {
      try {
        const oran = await gorselOraniniAl(logo);
        const MAKS_GENISLIK = 40, MAKS_YUKSEKLIK = 20;
        let w = MAKS_GENISLIK, h = MAKS_YUKSEKLIK;
        if (oran && oran.w && oran.h) {
          const olcek = Math.min(MAKS_GENISLIK / oran.w, MAKS_YUKSEKLIK / oran.h);
          w = oran.w * olcek;
          h = oran.h * olcek;
        }
        const format = logo.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(logo, format, 14, 10, w, h);
        baslikY = 42;
      } catch (e) {
        // logo eklenemezse (bozuk/desteklenmeyen format) PDF'in geri kalanı yine de oluşsun
      }
    }
    doc.setFontSize(16);
    doc.text(`${marka} - Hesap Bilgileri`, 14, baslikY);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`${firmaAdi || "Marcus Medya"} - ${new Date().toLocaleDateString("tr-TR")}`, 14, baslikY + 7);
    doc.setTextColor(0);
    let y = baslikY + 20;
    if (girisListesi.length === 0) {
      doc.setFontSize(11);
      doc.text("Kayitli hesap bilgisi bulunmuyor.", 14, y);
      y += 10;
    }
    girisListesi.forEach((g) => {
      doc.setFontSize(11);
      doc.text(String(g.platform || ""), 14, y);
      doc.setFontSize(9);
      doc.text(`Kullanici Adi: ${g.kullanici || "-"}`, 18, y + 6);
      doc.text(`Sifre: ${g.sifre || "-"}`, 18, y + 12);
      y += 20;
      if (y > 250) { doc.addPage(); y = 20; }
    });
    if (driveLinki) {
      doc.setFontSize(10);
      doc.text(`Drive: ${driveLinki}`, 14, y + 6);
      y += 14;
    }
    // Güvenlik uyarısı — her zaman en altta, kırmızımsı bir kutu içinde.
    if (y > 240) { doc.addPage(); y = 20; }
    y += 10;
    doc.setDrawColor(220, 53, 69);
    doc.setFillColor(255, 236, 236);
    doc.roundedRect(14, y, 182, 22, 2, 2, "FD");
    doc.setTextColor(150, 20, 30);
    doc.setFontSize(9);
    doc.text("ONEMLI: Bu belge gizli hesap bilgileri icermektedir. Bilgilerinizi aldiktan sonra bu", 18, y + 8);
    doc.text("dosyayi siliniz ve sifrelerinizi ucuncu sahislarla KESINLIKLE paylasmayiniz.", 18, y + 15);
    doc.setTextColor(0);
    doc.save(`${marka.replace(/[^\w]+/g, "-")}-hesap-bilgileri.pdf`);
  });
}

function DevirTeslimFormu({ client, girisler, firmaAdi, logo, onClose }) {
  const [driveLinki, setDriveLinki] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState("");
  const [onayBekleyenIslem, setOnayBekleyenIslem] = useState(null); // "eposta" | "whatsapp" | null

  const girisListesi = SOSYAL_PLATFORMLAR
    .map((p) => ({ platform: p.label, ...(girisler[p.key] || {}) }))
    .filter((g) => g.kullanici || g.sifre);

  const mesajMetni = () => {
    let m = `Sayın ${client.ad} yetkilisi,\n\n${firmaAdi || "Marcus Medya"} ile aranızdaki hizmet sürecini sonlandırmış bulunmaktayız.`;
    if (driveLinki) m += ` Belgelerinize şu bağlantıdan ulaşabilirsiniz: ${driveLinki}`;
    m += `\n\nLütfen hesaplarınızın şifrelerini 24 saat (1 gün) içinde değiştiriniz. Verileriniz sistemimizden 15 gün içinde kalıcı olarak silinecektir. Belirtilen süre içinde şifre değişikliği yapılmaması durumunda oluşabilecek güvenlik sorunlarından tarafımız sorumluluk kabul etmemektedir.\n\nİyi çalışmalar dileriz.\n${firmaAdi || "Marcus Medya"}`;
    return m;
  };

  const epostaGonderGercek = () => {
    setGonderiliyor(true);
    setSonuc("");
    fetch("/api/devir-teslim", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: email.trim(), marka: client.ad, driveLinki: driveLinki.trim(), girisler: girisListesi, firmaAdi, logo }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setSonuc("✅ E-posta gönderildi.");
        else setSonuc("❌ " + (res.reason || res.error || "Gönderilemedi."));
      })
      .catch(() => setSonuc("❌ Bağlantı hatası."))
      .finally(() => setGonderiliyor(false));
  };

  const epostaGonder = () => {
    if (!email.trim()) { setSonuc("Müşteri e-posta adresi gerekli."); return; }
    setOnayBekleyenIslem("eposta");
  };

  const whatsappAcGercek = () => {
    const numara = telefon.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${numara}?text=${encodeURIComponent(mesajMetni())}`;
    window.open(url, "_blank");
    setOnayBekleyenIslem(null);
  };

  const whatsappAc = () => {
    if (!telefon.trim()) { setSonuc("WhatsApp için telefon numarası gerekli (ülke koduyla, örn. 90532...)."); return; }
    setOnayBekleyenIslem("whatsapp");
  };

  const pdfIndir = () => {
    hesapBilgileriPdfOlustur(client.ad, firmaAdi, girisListesi, driveLinki.trim(), logo).catch(() => setSonuc("❌ PDF oluşturulamadı."));
  };

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, marginBottom: 10 }}>Devir Teslim Bildirimi — {client.ad}</div>
      <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Belgelerin Bulunduğu Drive Linki</label>
      <input value={driveLinki} onChange={(e) => setDriveLinki(e.target.value)} placeholder="https://drive.google.com/..." style={{ ...inputStyle, marginBottom: 10 }} />
      <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Müşteri E-postası</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="musteri@ornek.com" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>WhatsApp Telefon (ülke koduyla)</label>
          <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="905XXXXXXXXX" style={inputStyle} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>
        {girisListesi.length > 0 ? `${girisListesi.length} kayıtlı hesap bilgisi e-postaya eklenecek.` : "Bu markaya kayıtlı hesap bilgisi yok — sadece Drive linki ve bildirim metni gidecek."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={saveBtnStyle} onClick={epostaGonder} disabled={gonderiliyor}>{gonderiliyor ? "Gönderiliyor…" : "E-posta Gönder"}</button>
        <button style={{ ...saveBtnStyle, background: "#25D366" }} onClick={whatsappAc}>WhatsApp'ta Aç</button>
        <button style={cancelBtnStyle} onClick={pdfIndir}>PDF İndir</button>
        <button style={cancelBtnStyle} onClick={onClose}>Kapat</button>
      </div>
      {onayBekleyenIslem && (
        <OwnerSifreOnay
          onCancel={() => setOnayBekleyenIslem(null)}
          onConfirmed={() => {
            if (onayBekleyenIslem === "eposta") epostaGonderGercek();
            else whatsappAcGercek();
            setOnayBekleyenIslem(null);
          }}
        />
      )}
      {sonuc && <div style={{ fontSize: 12, color: sonuc.startsWith("✅") ? T.success : T.danger, marginTop: 10 }}>{sonuc}</div>}
    </div>
  );
}

/** Devir teslimden bağımsız, "müşteri şifresini istedi" durumunda hızlıca kullanılan sade gönderim —
 * 15 gün/1 gün uyarıları yok, sadece bilgiler paylaşılır. Bu da göndermeden önce owner şifresi ister. */
function HizliSifreGonderFormu({ client, girisler, firmaAdi, logo, onClose }) {
  const [email, setEmail] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState("");
  const [onayAcik, setOnayAcik] = useState(false);

  const girisListesi = SOSYAL_PLATFORMLAR
    .map((p) => ({ platform: p.label, ...(girisler[p.key] || {}) }))
    .filter((g) => g.kullanici || g.sifre);

  const gonderGercek = () => {
    setGonderiliyor(true);
    setSonuc("");
    fetch("/api/devir-teslim", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: email.trim(), marka: client.ad, girisler: girisListesi, firmaAdi, mod: "hizli", logo }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setSonuc("✅ E-posta gönderildi.");
        else setSonuc("❌ " + (res.reason || res.error || "Gönderilemedi."));
      })
      .catch(() => setSonuc("❌ Bağlantı hatası."))
      .finally(() => setGonderiliyor(false));
  };

  const gonder = () => {
    if (!email.trim()) { setSonuc("Müşteri e-posta adresi gerekli."); return; }
    setOnayAcik(true);
  };

  const pdfIndir = () => hesapBilgileriPdfOlustur(client.ad, firmaAdi, girisListesi, "", logo).catch(() => setSonuc("❌ PDF oluşturulamadı."));

  return (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, marginBottom: 10 }}>Şifreleri Gönder — {client.ad}</div>
      <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>Müşteri E-postası</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="musteri@ornek.com" style={{ ...inputStyle, marginBottom: 10 }} />
      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 10 }}>
        {girisListesi.length > 0 ? `${girisListesi.length} kayıtlı hesap bilgisi gönderilecek.` : "Bu markaya kayıtlı hesap bilgisi yok."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={saveBtnStyle} onClick={gonder} disabled={gonderiliyor}>{gonderiliyor ? "Gönderiliyor…" : "E-posta Gönder"}</button>
        <button style={cancelBtnStyle} onClick={pdfIndir}>PDF İndir</button>
        <button style={cancelBtnStyle} onClick={onClose}>Kapat</button>
      </div>
      {onayAcik && (
        <OwnerSifreOnay onCancel={() => setOnayAcik(false)} onConfirmed={() => { gonderGercek(); setOnayAcik(false); }} />
      )}
      {sonuc && <div style={{ fontSize: 12, color: sonuc.startsWith("✅") ? T.success : T.danger, marginTop: 10 }}>{sonuc}</div>}
    </div>
  );
}

/** Owner'a özel, kişisel şifreler — marka/müşteri hesaplarından tamamen ayrı, kendi verisinde
 * tutulur ve hiçbir izinle personele hiç gönderilmez (server tarafında hiçbir PERMISSION
 * listesine dahil edilmediği için). */
function KisiselSifrelerim({ sifreler, onAdd, onUpdate, onDelete }) {
  const [acik, setAcik] = useState(true);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [editId, setEditId] = useState(null);
  const [ad, setAd] = useState("");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [not, setNot] = useState("");
  const [gosterilenId, setGosterilenId] = useState(null);
  const liste = sifreler || [];

  const formuSifirla = () => { setAd(""); setKullaniciAdi(""); setSifre(""); setNot(""); setEkleAcik(false); setEditId(null); };
  const kaydet = () => {
    if (!ad.trim()) return;
    if (editId) onUpdate(editId, { ad: ad.trim(), kullaniciAdi: kullaniciAdi.trim(), sifre, not: not.trim() });
    else onAdd({ ad: ad.trim(), kullaniciAdi: kullaniciAdi.trim(), sifre, not: not.trim() });
    formuSifirla();
  };
  const duzenlemeyeBasla = (s) => { setEditId(s.id); setAd(s.ad || ""); setKullaniciAdi(s.kullaniciAdi || ""); setSifre(s.sifre || ""); setNot(s.not || ""); setEkleAcik(true); };
  const kopyala = (deger) => { if (deger) navigator.clipboard.writeText(deger).catch(() => {}); };

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16, border: `1px solid ${T.accent}` }}>
      <button onClick={() => setAcik((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <span style={{ fontSize: 13.5, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>🔒 Kişisel Şifrelerim <span style={{ color: T.textFaint, fontWeight: 400 }}>(sadece bana özel)</span></span>
        <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{liste.length > 0 ? `${liste.length} kayıt` : "Kayıt yok"} {acik ? "▲" : "▼"}</span>
      </button>

      {acik && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 12 }}>
            Bu bölüm marka/müşteri hesaplarından tamamen ayrı — kendi kişisel şifrelerini (e-posta, banka, kişisel hesaplar vb.) saklamak için. Personel bu kısmı hiçbir şekilde göremez.
          </div>

          {liste.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {liste.map((s) => {
                const sifreGoster = gosterilenId === s.id;
                return (
                  <div key={s.id} style={{ background: T.surfaceRaised, borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{s.ad}</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => duzenlemeyeBasla(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}><Pencil size={12} color={T.textFaint} /></button>
                        <button onClick={() => { if (window.confirm(`"${s.ad}" silinsin mi?`)) onDelete(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}><Trash2 size={12} color={T.danger} /></button>
                      </div>
                    </div>
                    {(s.kullaniciAdi || s.sifre) && (
                      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                        {s.kullaniciAdi && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim, fontFamily: "Inter" }}>
                            <span style={{ color: T.textFaint }}>Kullanıcı:</span> {s.kullaniciAdi}
                            <button onClick={() => kopyala(s.kullaniciAdi)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Copy size={11} color={T.textFaint} /></button>
                          </div>
                        )}
                        {s.sifre && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim, fontFamily: "Inter" }}>
                            <span style={{ color: T.textFaint }}>Şifre:</span> {sifreGoster ? s.sifre : "••••••"}
                            <button onClick={() => setGosterilenId(sifreGoster ? null : s.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>{sifreGoster ? <EyeOff size={11} color={T.textFaint} /> : <Eye size={11} color={T.textFaint} />}</button>
                            <button onClick={() => kopyala(s.sifre)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Copy size={11} color={T.textFaint} /></button>
                          </div>
                        )}
                      </div>
                    )}
                    {s.not && <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginTop: 4, fontStyle: "italic" }}>{s.not}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {ekleAcik ? (
            <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 12 }}>
              <input type="text" placeholder="Hizmet/Hesap Adı (örn. Kişisel Gmail)" value={ad} onChange={(e) => setAd(e.target.value)} style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }} />
              <input type="text" autoComplete="off" placeholder="Kullanıcı Adı (opsiyonel)" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }} />
              <input type="text" autoComplete="off" placeholder="Şifre (opsiyonel)" value={sifre} onChange={(e) => setSifre(e.target.value)} style={{ ...inputStyle, marginBottom: 8, fontSize: 12.5, padding: "7px 10px" }} />
              <input type="text" placeholder="Not (opsiyonel)" value={not} onChange={(e) => setNot(e.target.value)} style={{ ...inputStyle, marginBottom: 10, fontSize: 12.5, padding: "7px 10px" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={cancelBtnStyle} onClick={formuSifirla}>İptal</button>
                <button style={saveBtnStyle} onClick={kaydet}>{editId ? "Kaydet" : "Ekle"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEkleAcik(true)} style={{ background: "none", border: "none", color: T.accentText, fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "Inter" }}>+ Şifre Ekle</button>
          )}
        </div>
      )}
    </Card>
  );
}

function MusteriGirisleriIcerik({ clients, girisler, onUpdate, firmaAdi, logo, role, kisiselSifreler, onAddKisiselSifre, onUpdateKisiselSifre, onDeleteKisiselSifre }) {
  const [acikId, setAcikId] = useState(null);
  const [devirTeslimId, setDevirTeslimId] = useState(null);
  const [hizliGonderId, setHizliGonderId] = useState(null);
  const tumMarkalar = clients || [];
  const veri = girisler || {};

  return (
    <div>
      <Card style={{ padding: "14px 18px", marginBottom: 16, background: T.warningSoft }}>
        <div style={{ fontSize: 12.5, color: T.warning, fontFamily: "Inter", lineHeight: 1.6 }}>
          <strong>Bu bilgiler sadece sana (CEO) görünür</strong> — personelin izinlerinden bağımsız olarak, kişisel hesabıyla giren hiçbir personel bu sayfayı hiç göremez.
        </div>
      </Card>

      {role === "owner" && (
        <KisiselSifrelerim sifreler={kisiselSifreler} onAdd={onAddKisiselSifre} onUpdate={onUpdateKisiselSifre} onDelete={onDeleteKisiselSifre} />
      )}

      <div style={{ fontSize: 12, color: T.text, fontWeight: 700, fontFamily: "Inter", margin: "22px 0 10px", textTransform: "uppercase", letterSpacing: 0.3 }}>Marka Hesapları</div>

      {tumMarkalar.length === 0 ? (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz müşteri yok.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tumMarkalar.map((c) => {
            const g = veri[c.id] || {};
            const acik = acikId === c.id;
            const doluSayisi = SOSYAL_PLATFORMLAR.filter((p) => g[p.key] && (g[p.key].kullanici || g[p.key].sifre)).length;
            return (
              <Card key={c.id} style={{ padding: "14px 16px" }}>
                <button onClick={() => setAcikId(acik ? null : c.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ fontSize: 13.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{c.ad}</span>
                  <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{doluSayisi > 0 ? `${doluSayisi} hesap kayıtlı` : "Kayıt yok"} {acik ? "▲" : "▼"}</span>
                </button>
                {acik && (
                  <>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="marcus-field-grid">
                      {SOSYAL_PLATFORMLAR.map((p) => {
                        const pv = g[p.key] || { kullanici: "", sifre: "" };
                        return (
                          <div key={p.key}>
                            <div style={{ fontSize: 12, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 8 }}>{p.label}</div>
                            <KopyalanabilirAlan label="Kullanıcı Adı" value={pv.kullanici} onChange={(val) => onUpdate(c.id, p.key, "kullanici", val)} />
                            <KopyalanabilirAlan label="Şifre" value={pv.sifre} onChange={(val) => onUpdate(c.id, p.key, "sifre", val)} gizli />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
                      {devirTeslimId === c.id ? (
                        <DevirTeslimFormu client={c} girisler={g} firmaAdi={firmaAdi} logo={logo} onClose={() => setDevirTeslimId(null)} />
                      ) : hizliGonderId === c.id ? (
                        <HizliSifreGonderFormu client={c} girisler={g} firmaAdi={firmaAdi} logo={logo} onClose={() => setHizliGonderId(null)} />
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => setHizliGonderId(c.id)} style={addBtnStyle}>✉️ Şifreleri Gönder</button>
                          <button onClick={() => setDevirTeslimId(c.id)} style={{ ...addBtnStyle, background: T.dangerSoft, color: T.danger }}>📤 Devir Teslim Bildirimi Gönder</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Web teknolojisiyle ekran görüntüsü almayı GERÇEKTEN engellemek mümkün değil (hiçbir site/uygulama
 * bunu tam garanti edemez — işletim sistemi seviyesinde bir kısıtlama gerekir). Bunun yerine daha
 * gerçekçi bir caydırıcı kullanılıyor: sayfanın üzerine, ekran görüntüsüne de dahil olacak şekilde,
 * tarih/saat içeren hafif bir filigran basılıyor — böylece bir görüntü paylaşılırsa ne zaman alındığı bellidir. */
function FiligranKatmani() {
  const damga = new Date().toLocaleString("tr-TR");
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden", opacity: 0.06 }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)",
        fontSize: 13, fontFamily: "Inter, sans-serif", color: T.text, whiteSpace: "pre", lineHeight: 3.2, textAlign: "center", width: "200%",
      }}>
        {Array(14).fill(`GİZLİ — Şifre Kasası — ${damga}`).join("\n")}
      </div>
    </div>
  );
}

function MusteriGirisleri(props) {
  return (
    <SifreGateli>
      <div style={{ position: "relative" }}>
        <FiligranKatmani />
        <Card style={{ padding: "12px 16px", marginBottom: 14, background: T.dangerSoft }}>
          <div style={{ fontSize: 12, color: T.danger, fontFamily: "Inter", lineHeight: 1.6 }}>
            Not: Web teknolojisiyle ekran görüntüsü almak teknik olarak engellenemez (hiçbir web sitesi bunu tam olarak garanti edemez).
            Bunun yerine sayfaya tarih/saat içeren görünmez bir filigran basılıyor — bir görüntü paylaşılırsa nereden ve ne zaman alındığı iz sürülebilir.
          </div>
        </Card>
        <MusteriGirisleriIcerik {...props} />
      </div>
    </SifreGateli>
  );
}

function KasaSifresiKarti() {
  const [acik, setAcik] = useState(false);
  const [yeniSifre, setYeniSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState("");
  const [basari, setBasari] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [ayarlandiMi, setAyarlandiMi] = useState(null);
  const rastgeleAd1 = useRef(`kasa-alan-${Math.random().toString(36).slice(2)}`).current;
  const rastgeleAd2 = useRef(`kasa-alan-${Math.random().toString(36).slice(2)}`).current;

  const durumuYukle = () => {
    fetch("/api/kasa", { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => setAyarlandiMi(!!res.ayarlandiMi))
      .catch(() => setAyarlandiMi(null));
  };
  useEffect(() => { durumuYukle(); }, []);

  const kaydet = () => {
    setHata(""); setBasari(false);
    if (yeniSifre.length < 4) { setHata("Şifre en az 4 karakter olmalı."); return; }
    if (yeniSifre !== tekrar) { setHata("Şifreler eşleşmiyor."); return; }
    setKaydediliyor(true);
    fetch("/api/kasa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ action: "degistir", yeniSifre }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { setBasari(true); setYeniSifre(""); setTekrar(""); setAcik(false); durumuYukle(); }
        else setHata(res.error || "Bir sorun oluştu.");
      })
      .catch(() => setHata("Bağlantı hatası."))
      .finally(() => setKaydediliyor(false));
  };

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Şifre Kasası Şifresi</SectionTitle>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 10 }}>
        Şifre Kasası'na (müşteri sosyal medya girişleri) girerken artık kendi şifrenle değil, buradan belirlediğin
        <strong> ayrı bir kasa şifresiyle</strong> doğrulama yapılıyor. Owner (site) şifren burada <strong>hiçbir zaman</strong> geçerli olmaz — aşağıdan bir kasa şifresi belirlemen gerekiyor.
      </p>
      {ayarlandiMi !== null && (
        <div style={{ fontSize: 12, fontFamily: "Inter", fontWeight: 600, color: ayarlandiMi ? T.success : T.warning, marginBottom: 14 }}>
          {ayarlandiMi ? "✅ Şu an özel bir kasa şifresi ayarlı — owner şifren artık kasa şifresi olarak kabul edilmiyor." : "⚠️ Şu an henüz özel bir kasa şifresi ayarlanmadı — kasa hâlâ owner şifrenle açılıyor."}
        </div>
      )}
      {basari && <div style={{ color: T.success, fontSize: 12.5, fontFamily: "Inter", marginBottom: 10 }}>Kasa şifresi güncellendi.</div>}
      {acik ? (
        <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px" }}>
          <input
            type="text"
            name={rastgeleAd1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-lpignore="true"
            data-1p-ignore="true"
            placeholder="Yeni kasa şifresi"
            value={yeniSifre}
            onChange={(e) => setYeniSifre(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10, WebkitTextSecurity: "disc" }}
          />
          <input
            type="text"
            name={rastgeleAd2}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-lpignore="true"
            data-1p-ignore="true"
            placeholder="Yeni kasa şifresi (tekrar)"
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10, WebkitTextSecurity: "disc" }}
          />
          {hata && <div style={{ color: T.danger, fontSize: 12, fontFamily: "Inter", marginBottom: 8 }}>{hata}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={cancelBtnStyle} onClick={() => { setAcik(false); setYeniSifre(""); setTekrar(""); setHata(""); }}>İptal</button>
            <button style={saveBtnStyle} onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </div>
      ) : (
        <button style={addBtnStyle} onClick={() => setAcik(true)}><KeyRound size={13} /> Kasa Şifresini Değiştir</button>
      )}
    </Card>
  );
}

/** Müşteri/personel/üyelik ekleme-silme, durum değişikliği gibi önemli işlemlerin otomatik
 * tutulan "kim ne zaman ne yaptı" defteri. Sunucu tarafında her kayıt anında değişiklikleri
 * karşılaştırarak kendiliğinden dolar — elle bir şey işaretlemene gerek yok. */
function IslemGecmisiKarti({ kayitlar }) {
  const [acik, setAcik] = useState(false);
  const [aramaMetni, setAramaMetni] = useState("");
  const liste = (kayitlar || []).slice().reverse();
  const filtreli = aramaMetni.trim()
    ? liste.filter((k) => (k.aciklama || "").toLocaleLowerCase("tr").includes(aramaMetni.trim().toLocaleLowerCase("tr")) || (k.kisi || "").toLocaleLowerCase("tr").includes(aramaMetni.trim().toLocaleLowerCase("tr")))
    : liste;

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <button onClick={() => setAcik((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: acik ? 14 : 0 }}>
        <SectionTitle>İşlem Geçmişi</SectionTitle>
        <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{liste.length > 0 ? `${liste.length} kayıt` : "Kayıt yok"} {acik ? "▲" : "▼"}</span>
      </button>

      {acik && (
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: T.textDim, lineHeight: 1.7, marginBottom: 12 }}>
            Müşteri/personel/üyelik ekleme, silme ve durum değişiklikleri burada otomatik olarak listelenir — kim, ne zaman, neyi değiştirdi.
          </p>
          {liste.length > 0 && (
            <input type="text" placeholder="Kişi ya da işlem ara…" value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)} style={{ ...inputStyle, marginBottom: 12, fontSize: 12.5 }} />
          )}
          {filtreli.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>{liste.length === 0 ? "Henüz kayıtlı bir işlem yok." : "Eşleşen kayıt bulunamadı."}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
              {filtreli.map((k) => (
                <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "8px 12px", background: T.surfaceRaised, borderRadius: 9 }}>
                  <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter" }}>
                    <strong>{k.kisi}</strong> — {k.aciklama}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", whiteSpace: "nowrap", flexShrink: 0 }}>{k.tarih}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Verinin toplam boyutunu gösterir. Görseller base64 olarak tek bir blok içinde
 * saklandığı için, boyut Vercel'in ~4.5 MB istek sınırına yaklaşırsa KAYITLAR TAMAMEN
 * DURUR. Bu kart o sınırı görünür kılar — sessiz bir çökmeye dönüşmeden önce uyarır. */
function VeriBoyutuKarti() {
  const [bilgi, setBilgi] = useState(null);
  useEffect(() => {
    fetch("/api/data", { headers: authHeaders() })
      .then((r) => r.json())
      .then((res) => {
        if (!res.data) return;
        const metin = JSON.stringify(res.data);
        const toplam = metin.length;
        let gorselToplam = 0;
        const gorselAra = (o) => {
          if (typeof o === "string") { if (o.startsWith("data:image")) gorselToplam += base64Bayt(o); return; }
          if (Array.isArray(o)) { o.forEach(gorselAra); return; }
          if (o && typeof o === "object") { Object.values(o).forEach(gorselAra); }
        };
        gorselAra(res.data);
        setBilgi({ toplam, gorselToplam });
      })
      .catch(() => {});
  }, []);
  if (!bilgi) return null;
  const SINIR = 4.5 * 1024 * 1024;
  const oran = Math.min(100, (bilgi.toplam / SINIR) * 100);
  const uyari = oran > 60;
  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Veri Boyutu</SectionTitle>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter", color: T.textDim, marginBottom: 8 }}>
        <span>Toplam: <strong style={{ color: uyari ? T.warning : T.text }}>{boyutYazisi(bilgi.toplam)}</strong></span>
        <span>Bunun {boyutYazisi(bilgi.gorselToplam)} kadarı görsel</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: T.surfaceRaised, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${oran}%`, height: "100%", background: uyari ? T.warning : T.success, borderRadius: 999 }} />
      </div>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: T.textFaint, lineHeight: 1.7, margin: 0 }}>
        {uyari
          ? "⚠ Veri boyutu sınıra yaklaşıyor. Sunucu tek bir istekte en fazla ~4.5 MB kabul eder; bu aşılırsa kayıtlar tamamen durur. Müşteri detaylarındaki eski içerik görsellerini silerek yer açabilirsin."
          : "Yüklediğin görseller otomatik olarak küçültülüp sıkıştırılıyor. Sınır ~4.5 MB — şu an rahat bir seviyedesin."}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* PLANIM — kişisel not defteri (sadece yönetici)                        */
/* ------------------------------------------------------------------ */
/**
 * Yapılacak işlerini not aldığın kişisel alan. Bilerek sade tutuldu: hızlıca yaz, Enter'a bas.
 * Tarih ve öncelik isteğe bağlı — çoğu not için hiç dokunmana gerek yok.
 *
 * Müşteri işlerinden (Operasyon) tamamen ayrıdır ve personele hiç gönderilmez.
 */
/**
 * Müşterinin panelinde içeriklerin YANI SIRA gördükleri: paylaşım planı, reklamlar ve
 * üretim durumu. Bu veriler başka sekmelerde yönetiliyor (Paylaşımlar, Reklamlar,
 * Operasyon) — burada müşterinin göreceği hâliyle gösteriliyor ki "müşteri ne görüyor?"
 * sorusunu tek yerden cevaplayabilesin. Tek düzenlenebilir alan ALT METİNLER.
 */
function MusteriPanelEkleri({ marka, plan, reklamlar, isler, onAltMetin }) {
  const [acik, setAcik] = useState(null); // "plan" | "reklam" | "operasyon"
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [taslak, setTaslak] = useState("");

  // Sunucudaki eşleştirmenin AYNISI: boşluk ve büyük-küçük harf farkını yok sayar.
  // İki taraf aynı kuralı kullanmazsa, burada görünen bir kayıt müşteride görünmeyebilir.
  const markaEsit = (deger) => String(deger || "").trim().toLocaleLowerCase("tr") === String(marka.ad || "").trim().toLocaleLowerCase("tr");
  const markaPlani = (plan || []).filter((p) => String(p.clientId) === String(marka.id));
  const markaReklamlari = (reklamlar || []).filter((r) => markaEsit(r.marka));
  const markaIsleri = (isler || []).filter((j) => markaEsit(j.marka));

  const buHafta = haftaBaslangici();
  const yaklasanPlan = markaPlani.filter((p) => p.haftaKey >= buHafta).sort((a, b) => (a.haftaKey > b.haftaKey ? 1 : -1));

  const kaydet = (planId) => { onAltMetin(planId, taslak); setDuzenlenen(null); setTaslak(""); };

  const Bolum = ({ anahtar, baslik, adet, children }) => (
    <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 12, marginTop: 12 }}>
      <button
        onClick={() => setAcik(acik === anahtar ? null : anahtar)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{baslik}</span>
        <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{adet} kayıt {acik === anahtar ? "▲" : "▼"}</span>
      </button>
      {acik === anahtar && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter" }}>Müşteri Panelinde Ayrıca Görünenler</div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 4, lineHeight: 1.6 }}>
        Bunlar Paylaşımlar, Reklamlar ve Operasyon sekmelerinden otomatik gelir — burada müşterinin gördüğü hâliyle listelenir.
        Reklam bütçesi, personel adları ve iç notlar müşteriye <strong>gönderilmez</strong>.
      </div>

      <Bolum anahtar="plan" baslik="Paylaşım Planı (alt metinler buradan yazılır)" adet={yaklasanPlan.length}>
        {yaklasanPlan.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Bu marka için bu hafta ve sonrasına plan yok. Plan eklemek için Paylaşımlar sekmesini kullan.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {yaklasanPlan.map((p) => (
              <div key={p.id} style={{ background: T.surfaceRaised, borderRadius: 9, padding: "9px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accentText, background: T.accentSoft, padding: "2px 8px", borderRadius: 999, fontFamily: "Inter" }}>{p.gun}</span>
                  <span style={{ fontSize: 12, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{p.tur}</span>
                  {p.yapildi && <span style={{ fontSize: 10, color: T.success, fontFamily: "Inter" }}>✓ paylaşıldı</span>}
                  {duzenlenen !== p.id && (
                    <button onClick={() => { setDuzenlenen(p.id); setTaslak(p.altMetin || ""); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.accentText, fontFamily: "Inter", textDecoration: "underline", padding: 0 }}>
                      {p.altMetin ? "Alt metni düzenle" : "+ Alt metin ekle"}
                    </button>
                  )}
                </div>
                {duzenlenen === p.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      autoFocus
                      value={taslak}
                      onChange={(e) => setTaslak(e.target.value)}
                      rows={4}
                      placeholder="Paylaşımın alt metni (caption) — müşteri panelinde bu metni görecek"
                      style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 8, fontFamily: "Inter", lineHeight: 1.6 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={saveBtnStyle} onClick={() => kaydet(p.id)}>Kaydet</button>
                      <button style={cancelBtnStyle} onClick={() => setDuzenlenen(null)}>İptal</button>
                    </div>
                  </div>
                ) : p.altMetin ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: T.textDim, fontFamily: "Inter", lineHeight: 1.6, whiteSpace: "pre-wrap", borderLeft: `2px solid ${T.border}`, paddingLeft: 9 }}>{p.altMetin}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Bolum>

      <Bolum anahtar="reklam" baslik="Reklam Kampanyaları" adet={markaReklamlari.length}>
        {markaReklamlari.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Bu markaya ait reklam kaydı yok.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {markaReklamlari.map((r) => (
              <div key={r.id} style={{ background: T.surfaceRaised, borderRadius: 9, padding: "8px 12px", fontSize: 12, fontFamily: "Inter", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: T.text, fontWeight: 600 }}>{r.reklamAdi}</span>
                <span style={{ color: T.textFaint }}>{tarihGoster(r.baslangicTarihi)} — {tarihGoster(r.bitisTarihi)}</span>
              </div>
            ))}
          </div>
        )}
      </Bolum>

      <Bolum anahtar="operasyon" baslik="Üretim Durumu (Operasyon)" adet={markaIsleri.length}>
        {markaIsleri.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>Bu markaya ait operasyon işi yok.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 260, overflowY: "auto" }}>
            {markaIsleri.map((j) => (
              <div key={j.id} style={{ background: T.surfaceRaised, borderRadius: 9, padding: "8px 12px", fontSize: 12, fontFamily: "Inter", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: T.text }}>{j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}</span>
                <span style={{ color: j.asama === "Teslim Edildi" ? T.success : T.warning, fontWeight: 600 }}>{j.asama}</span>
              </div>
            ))}
          </div>
        )}
      </Bolum>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* MÜŞTERİ PANELİ YÖNETİMİ (kendi sekmesi)                               */
/* ------------------------------------------------------------------ */
/**
 * Müşteri paneliyle ilgili HER ŞEY burada: hangi markaya ne gönderildi, müşteri ne yanıt
 * verdi, çekim planları, ve panel giriş hesapları.
 *
 * Daha önce bunlar iki ayrı yere dağılmıştı (içerikler müşteri detayında, hesaplar
 * Ayarlar'da) ve müşteri detayı zaten kalabalık olduğu için içerik bölümü kayboluyordu.
 */
function MusteriPaneliYonetimi({ clients, icerikler, onAdd, onUpdate, onDelete, plan, reklamlar, isler, onAltMetin }) {
  const [secili, setSecili] = useState(null);

  const aktifler = (clients || []).filter((c) => c.durum !== "ayrildi");
  const listesi = (id) => (icerikler || []).filter((i) => String(i.clientId) === String(id));
  const sayac = (id, durum) => listesi(id).filter((i) => i.durum === durum).length;

  const toplamBekleyen = (icerikler || []).filter((i) => i.durum === "bekliyor").length;
  const toplamRevize = (icerikler || []).filter((i) => i.durum === "revize").length;
  const toplamPlan = (icerikler || []).filter((i) => i.tur === "cekim").length;

  const seciliMarka = aktifler.find((c) => String(c.id) === String(secili));

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="MÜŞTERİ ONAYI BEKLEYEN" value={toplamBekleyen} mono={false} accent={toplamBekleyen > 0 ? T.warning : T.success} />
        {toplamRevize > 0 && <KpiCard label="REVİZE İSTENEN" value={toplamRevize} mono={false} accent={T.danger} />}
        <KpiCard label="ÇEKİM PLANI" value={toplamPlan} mono={false} />
      </div>

      <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 16, lineHeight: 1.6 }}>
        Markaya tıkla, ona çekim planı ya da içerik gönder. Müşteri kendi panelinden görüp onaylar veya revize ister.
      </div>

      {/* Marka seçimi — yanlarında bekleyen/revize rozetleri */}
      <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 10 }}>MARKA SEÇ</div>
        {aktifler.length === 0 ? (
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter" }}>Henüz aktif marka yok.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {aktifler.map((c) => {
              const bekleyen = sayac(c.id, "bekliyor");
              const revize = sayac(c.id, "revize");
              const aktif = String(secili) === String(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSecili(aktif ? null : c.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: aktif ? T.accent : T.surfaceRaised, color: aktif ? "#fff" : T.textDim,
                    fontSize: 13, fontWeight: 600, fontFamily: "Inter",
                  }}
                >
                  {c.ad}
                  {revize > 0 && <span style={{ background: T.danger, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>{revize}</span>}
                  {bekleyen > 0 && <span style={{ background: aktif ? "rgba(255,255,255,.25)" : T.warningSoft, color: aktif ? "#fff" : T.warning, borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>{bekleyen}</span>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {seciliMarka ? (
        <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 14 }}>{seciliMarka.ad}</div>
          <IcerikYonetimMotoru
            clientId={seciliMarka.id}
            icerikler={icerikler}
            onAdd={onAdd}
            onUpdate={onUpdate}
            onDelete={onDelete}
            kompakt={false}
          />
        </Card>
      ) : (
        <Card style={{ padding: "28px 16px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.7 }}>
            Yukarıdan bir marka seç — o markaya gönderdiğin çekim planlarını ve içerikleri burada yönetirsin.
          </div>
        </Card>
      )}

      {/* Müşterinin panelinde ayrıca gördükleri: paylaşım planı (alt metinleriyle),
        * reklamlar ve üretim durumu. Alt metinler buradan yazılır. */}
      {seciliMarka && (
        <MusteriPanelEkleri
          marka={seciliMarka}
          plan={plan || []}
          reklamlar={reklamlar || []}
          isler={isler || []}
          onAltMetin={onAltMetin}
        />
      )}

      {/* Panel giriş hesapları — artık müşteri paneliyle aynı yerde */}
      <MusteriHesaplariKart clients={clients} />
    </div>
  );
}

function Planim({ gorevler, onAdd, onUpdate, onDelete }) {
  const [metin, setMetin] = useState("");
  const [tarih, setTarih] = useState("");
  const [onemli, setOnemli] = useState(false);
  const [tamamlananlarAcik, setTamamlananlarAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState(null);
  const [duzenleMetin, setDuzenleMetin] = useState("");

  const liste = gorevler || [];
  const acikGorevler = liste.filter((g) => !g.tamamlandi);
  const bitenler = liste.filter((g) => g.tamamlandi).slice().reverse();

  const ekle = () => {
    if (!metin.trim()) return;
    onAdd({ baslik: metin.trim(), tarih: tarih || null, onemli, tamamlandi: false, olusturma: bugunISOTarih() });
    setMetin("");
    setTarih("");
    setOnemli(false);
  };

  // Gruplama: tarihi geçmişler, bugün, bu hafta, sonrası, tarihsiz.
  const bugun = bugunISOTarih();
  const haftaSonu = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

  const gruplar = [
    { key: "gecikmis", baslik: "Tarihi Geçti", renk: T.danger, filtre: (g) => g.tarih && g.tarih < bugun },
    { key: "bugun", baslik: "Bugün", renk: T.warning, filtre: (g) => g.tarih === bugun },
    { key: "hafta", baslik: "Bu Hafta", renk: T.text, filtre: (g) => g.tarih && g.tarih > bugun && g.tarih <= haftaSonu },
    { key: "sonra", baslik: "Sonra", renk: T.textDim, filtre: (g) => g.tarih && g.tarih > haftaSonu },
    { key: "tarihsiz", baslik: "Tarihsiz", renk: T.textFaint, filtre: (g) => !g.tarih },
  ];

  const gecikmisSayisi = acikGorevler.filter((g) => g.tarih && g.tarih < bugun).length;
  const bugunSayisi = acikGorevler.filter((g) => g.tarih === bugun).length;

  // Önemliler her grubun başında.
  const sirala = (a, b) => (a.onemli === b.onemli ? 0 : a.onemli ? -1 : 1);

  const duzenlemeyiKaydet = (g) => {
    if (!duzenleMetin.trim()) { setDuzenleId(null); return; }
    onUpdate(g.id, { baslik: duzenleMetin.trim() });
    setDuzenleId(null);
  };

  const GorevSatiri = ({ g }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10 }}>
      <button
        onClick={() => onUpdate(g.id, { tamamlandi: !g.tamamlandi, tamamlanmaTarihi: g.tamamlandi ? null : bugunISOTarih() })}
        title={g.tamamlandi ? "Geri al" : "Tamamlandı olarak işaretle"}
        style={{
          width: 19, height: 19, minWidth: 19, marginTop: 1, borderRadius: 6, cursor: "pointer",
          border: `1.5px solid ${g.tamamlandi ? T.success : T.border}`,
          background: g.tamamlandi ? T.success : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}
      >
        {g.tamamlandi && <Check size={12} color="#fff" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {duzenleId === g.id ? (
          <input
            autoFocus
            value={duzenleMetin}
            onChange={(e) => setDuzenleMetin(e.target.value)}
            onBlur={() => duzenlemeyiKaydet(g)}
            onKeyDown={(e) => { if (e.key === "Enter") duzenlemeyiKaydet(g); if (e.key === "Escape") setDuzenleId(null); }}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        ) : (
          <button
            onClick={() => { setDuzenleId(g.id); setDuzenleMetin(g.baslik); }}
            title="Düzenlemek için tıkla"
            style={{
              background: "none", border: "none", padding: 0, cursor: "text", textAlign: "left", width: "100%",
              fontSize: 13.5, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
              color: g.tamamlandi ? T.textFaint : T.text,
              textDecoration: g.tamamlandi ? "line-through" : "none",
              fontWeight: g.onemli && !g.tamamlandi ? 600 : 400,
            }}
          >
            {g.onemli && !g.tamamlandi && <span style={{ color: T.warning, marginRight: 5 }}>●</span>}
            {g.baslik}
          </button>
        )}
        {g.tarih && (
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginTop: 3 }}>{tarihGoster(g.tarih)}</div>
        )}
      </div>

      {!g.tamamlandi && (
        <button style={iconBtnStyle} title={g.onemli ? "Önemli işaretini kaldır" : "Önemli olarak işaretle"} onClick={() => onUpdate(g.id, { onemli: !g.onemli })}>
          <span style={{ color: g.onemli ? T.warning : T.textFaint, fontSize: 13 }}>●</span>
        </button>
      )}
      <button style={iconBtnStyle} title="Sil" onClick={() => { if (window.confirm("Bu not silinsin mi?")) onDelete(g.id); }}>
        <Trash2 size={13} color={T.textFaint} />
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="AÇIK NOT" value={acikGorevler.length} mono={false} />
        {gecikmisSayisi > 0 && <KpiCard label="TARİHİ GEÇTİ" value={gecikmisSayisi} accent={T.danger} mono={false} />}
        {bugunSayisi > 0 && <KpiCard label="BUGÜN" value={bugunSayisi} accent={T.warning} mono={false} />}
      </div>
      <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 16, lineHeight: 1.6 }}>
        Yapman gerekenleri buraya not al. Sadece sen görürsün — personel paneline hiç gönderilmez.
      </div>

      {/* Hızlı ekleme */}
      <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ekle(); }}
            placeholder="Ne yapman gerekiyor? Yaz ve Enter'a bas…"
            style={{ ...inputStyle, flex: "1 1 260px", marginBottom: 0 }}
          />
          <input
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            title="Tarih (isteğe bağlı)"
            style={{ ...inputStyle, width: 150, marginBottom: 0 }}
          />
          <button
            onClick={() => setOnemli((v) => !v)}
            title="Önemli olarak işaretle"
            style={{ padding: "9px 13px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, background: onemli ? T.warningSoft : T.surfaceRaised, color: onemli ? T.warning : T.textFaint }}
          >
            ● Önemli
          </button>
          <button style={saveBtnStyle} onClick={ekle}>Ekle</button>
        </div>
      </Card>

      {acikGorevler.length === 0 && (
        <Card style={{ padding: "28px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.7 }}>
            Şu an açık bir notun yok.{bitenler.length > 0 ? " Tamamladıklarını aşağıdan görebilirsin." : " Yukarıdan ilk notunu ekleyebilirsin."}
          </div>
        </Card>
      )}

      {gruplar.map((grup) => {
        const items = acikGorevler.filter(grup.filtre).sort(sirala);
        if (items.length === 0) return null;
        return (
          <div key={grup.key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, color: grup.renk, fontFamily: "Inter", fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
              {grup.baslik.toLocaleUpperCase("tr")} ({items.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((g) => <GorevSatiri key={g.id} g={g} />)}
            </div>
          </div>
        );
      })}

      {bitenler.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setTamamlananlarAcik((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}
          >
            {tamamlananlarAcik ? "▾" : "▸"} Tamamlananlar ({bitenler.length})
          </button>
          {tamamlananlarAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {bitenler.slice(0, 50).map((g) => <GorevSatiri key={g.id} g={g} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ayarlar({ onExport, onExportJson, onImportJson, firmaAdi, tebligSablonu, onSaveTeblig, staffPermissions, onUpdatePermissions, markaKimligiGorseli, onSaveMarkaKimligi, onRosterChange, clients, gizlilikModu, onToggleGizlilik, islemGecmisi }) {
  const fileInputRef = useRef(null);
  const rows = [
    { label: "İşletme Adı", value: "Marcus Medya" },
    { label: "Sektör", value: "Medya & Reklam Ajansı" },
    { label: "Ekip Büyüklüğü", value: "5+ kişi" },
    { label: "Para Birimi", value: "₺ TRY" },
    { label: "Mali Yıl Başlangıcı", value: "Ocak" },
  ];
  return (
    <div style={{ maxWidth: 560 }}>
      <Card style={{ padding: "8px 22px", marginBottom: 16 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: i < rows.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
            <span style={{ fontSize: 13.5, color: T.textDim, fontFamily: "Inter" }}>{r.label}</span>
            <span style={{ fontSize: 13.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Gizlilik Modu</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Açtığında, uygulamadaki <strong>tüm ₺ tutarları</strong> "₺ •••" olarak gizlenir — yanında biri varken ekranını
          gösterirken rakamların görünmesini istemiyorsan kullanabilirsin. Sadece bu cihazda geçerlidir, kapatana kadar açık kalır.
        </p>
        <button
          onClick={() => onToggleGizlilik(!gizlilikModu)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
            background: gizlilikModu ? T.danger : T.accentSoft, color: gizlilikModu ? "#fff" : T.accentText, fontSize: 13, fontWeight: 600, fontFamily: "Inter",
          }}
        >
          <EyeOff size={14} />
          {gizlilikModu ? "Gizlilik Modu Açık — Kapat" : "Gizlilik Modunu Aç"}
        </button>
      </Card>

      <IslemGecmisiKarti kayitlar={islemGecmisi} />

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Veri</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Müşteriler ve Finans bölümlerindeki tüm değişiklikler otomatik olarak kaydedilir. Sayfayı kapatıp
          tekrar açtığında en son haliyle karşına çıkar.
        </p>
        <button style={addBtnStyle} onClick={onExport}><Plus size={13} style={{ transform: "rotate(45deg)" }} /> Finans verilerini CSV indir</button>
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Otomatik Yedekler</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Her kayıt işleminde (senin ya da personelin yaptığı — hepsi dahil) veri otomatik olarak yedeklenir:
          <strong> günlük</strong> (son 30 gün) ve <strong>saatlik</strong> (son 48 saat). Saatlik yedekler sayesinde gün içinde
          bir şey ters giderse günün başına dönmek zorunda kalmazsın. Bir geri yükleme yaptığında, o andaki verinin tam bir kopyası
          otomatik olarak <strong>"Geri Yükleme Öncesi"</strong> sekmesine kaydedilir — yanlış yedeğe dönsen bile geri alabilirsin.
        </p>
        <YedekGecmisi />
      </Card>

      <VeriBoyutuKarti />

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Tam Yedek</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          CSV sadece rapor amaçlıdır ve bazı detayları (müşteri maliyetleri, birikim fonu hareketleri gibi) içermez.
          Her şeyin tam bir kopyasını almak için JSON yedek indir — istediğin an bu dosyadan geri yükleyebilirsin.
          Ayda bir yedek almanı öneririz.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={addBtnStyle} onClick={onExportJson}><Plus size={13} style={{ transform: "rotate(45deg)" }} /> Tam Yedek İndir (JSON)</button>
          <button style={cancelBtnStyle} onClick={() => fileInputRef.current && fileInputRef.current.click()}>Yedekten Geri Yükle</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onImportJson(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>E-posta ile Otomatik Günlük Yedek</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Kurulunca her gün gece 03:00'te tam veri yedeğin otomatik olarak e-postana gönderilir — Upstash'ten tamamen
          bağımsız bir yerde (senin e-posta kutunda) durur. Kurmak için:
        </p>
        <ol style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.9, paddingLeft: 18, marginBottom: 14 }}>
          <li><a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: T.accentText }}>resend.com</a>'da ücretsiz hesap aç</li>
          <li>API Keys'ten bir anahtar oluştur</li>
          <li>Vercel projende Environment Variables'a şunları ekle: <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>RESEND_API_KEY</code> (anahtarın) ve <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>BACKUP_EMAIL</code> (yedeği alacağın e-posta)</li>
          <li>Redeploy et</li>
        </ol>
        <EmailYedekTest endpoint="/api/daily-backup" />
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Sabah E-postasıyla AI Özeti</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Kurulunca her sabah 06:00'da, o günkü ciro/kâr durumunu ve — varsa — bekleyen ya da gecikmiş ödemeleri isim isim
          özetleyen bir AI mesajı e-postana gelir. Yukarıdaki RESEND_API_KEY ve BACKUP_EMAIL zaten yeterli;
          ek olarak Environment Variables'a <code style={{ background: T.surfaceRaised, padding: "1px 5px", borderRadius: 4 }}>ANTHROPIC_API_KEY</code> eklenmiş olması gerekiyor
          (AI CEO sohbeti için daha önce aldığın anahtar).
        </p>
        <EmailYedekTest endpoint="/api/daily-summary" />
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Operasyon & Günlük Kontrol Hatırlatmaları</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Her gün akşam 18:00'de otomatik çalışır: teslim tarihi geçmiş ve "Teslim Edildi" olmayan Operasyon işleri için,
          o işe atanan kişiye (kayıtlı e-postası varsa) hatırlatma gider — <strong>Video</strong> ve <strong>Grafik Tasarım</strong> işleri
          e-postada ayrı ayrı başlıklar altında listelenir. Markalaşma süreçlerinde de, henüz tamamlanmamış görevi olan
          markanın atanmış yöneticisine ayrı bir hatırlatma gider. Ayrıca o gün stokta içerik olduğu halde
          henüz Günlük Kontrol'den paylaşılmamış görünen markalar varsa, bunların özeti sana (BACKUP_EMAIL) gider.
          <strong> Ayrıca kime giderse gitsin, her hatırlatmanın bir kopyası (CC) otomatik olarak sana da gelir</strong> —
          kimin ne aldığını her zaman görebilirsin. Ek bir kurulum gerekmiyor — yukarıdaki RESEND_API_KEY zaten yeterli.
        </p>
        <EmailYedekTest endpoint="/api/daily-reminders" />
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Şifre Koruması</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Bu paneli sadece senin açabilmen için Vercel projenin ortam değişkenlerine <code style={{ background: T.surfaceRaised, padding: "2px 6px", borderRadius: 5 }}>SITE_PASSWORD</code> ekleyip
          istediğin şifreyi tanımlayabilirsin. Eklendiğinde site açılışta şifre soracak; eklenmediği sürece koruma
          devre dışıdır.
        </p>
      </Card>

      <Card style={{ padding: "18px 22px" }}>
        <SectionTitle>Personel Erişimi</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 10 }}>
          Ekibine, sadece <strong>Reklamlar</strong> ve <strong>Paylaşımlar</strong> sekmelerini görebilecekleri ayrı bir giriş verebilirsin —
          müşteri, finans, personel gibi diğer hiçbir veriye erişemezler (sunucu seviyesinde engellenir).
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Kurmak için Vercel'de ortam değişkenlerine <code style={{ background: T.surfaceRaised, padding: "2px 6px", borderRadius: 5 }}>STAFF_PASSWORD</code> ekleyip
          farklı bir şifre tanımla, sonra Redeploy et. Bu şifreyi ekibinle paylaş — kendi şifren (SITE_PASSWORD) ile girdiğinde her zaman tam panel açılır.
        </p>
      </Card>

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Güvenlik</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 12 }}>
          Şifren artık tarayıcıda hiç saklanmıyor — girişten sonra sadece süreli bir oturum anahtarı tutuluyor
          (normal giriş 12 saat, "bu cihazı hatırla" seçilirse 30 gün). Tarayıcının şifreyi kaydedip otomatik
          doldurması da kapatıldı.
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 12 }}>
          <strong>İki adımlı doğrulama:</strong> Vercel'de <code style={{ background: T.surfaceRaised, padding: "2px 6px", borderRadius: 5 }}>OWNER_EMAIL</code> ortam
          değişkenine e-posta adresini yazarsan, her girişte o adrese 6 haneli kod gönderilir. Şifreni bilen biri
          bile e-postana erişemeden giremez.
        </p>
        <TumCihazlardanCikisButonu />
      </Card>

      {/* Müşteri Paneli hesapları artık "Müşteri Paneli" sekmesinde — panel içerikleriyle
        * aynı yerde durması, iki farklı sekmeye bakmak zorunda kalmandan daha anlaşılır. */}
      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Müşteri Paneli Hesapları</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, margin: 0 }}>
          Müşteri giriş hesapları ve panele gönderdiğin içerikler artık sol menüdeki
          <strong> Müşteri Paneli</strong> sekmesinde, tek bir yerde toplandı.
        </p>
      </Card>
      <PersonelHesaplariKart onRosterChange={onRosterChange} />
      <KasaSifresiKarti />

      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>CEO Paneli — Personel Yetkileri</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
          Personel şifresiyle (ya da kişisel hesabıyla) girenlerin hangi bölümleri görebileceğini buradan tek tek aç/kapat yapabilirsin.
          <strong> Kapalı olan hiçbir sekme gözükmez</strong> — hem arayüzden gizlenir hem de sunucu seviyesinde engellenir, yani izin vermediğin veriyi tarayıcılarına hiç göndermeyiz.
          Bu, ekibindeki herkes için ortak bir ayardır (tek tek kişi bazında değil). <strong>Ayarlar sekmesi hiçbir zaman personele açılmaz</strong> — güvenlik ayarlarını (şifreler, personel hesapları vb.) sadece sen görebilirsin.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "dashboard", label: "Dashboard", varsayilan: false },
            { key: "musteriler", label: "Müşteriler", varsayilan: false },
            { key: "finans", label: "Finans", varsayilan: false },
            { key: "takvim", label: "Takvim", varsayilan: false },
            { key: "odemeTakvimi", label: "Ödeme Takvimi", varsayilan: false },
            { key: "teklif", label: "Teklif & Sözleşme", varsayilan: false },
            { key: "reklamlar", label: "Reklamlar", varsayilan: true },
            { key: "paylasimlar", label: "Paylaşımlar (+ Günlük Kontrol)", varsayilan: true },
            { key: "cekimListesi", label: "Çekim (düşük stok listesi)", varsayilan: false },
            { key: "cekimEdit", label: "Operasyon (Video/Grafik Tasarım)", varsayilan: true },
            { key: "markaYoneticisi", label: "Marka Yöneticisi (Operasyon'da durum bildirimi e-postası gönderebilir)", varsayilan: false },
            { key: "personel", label: "Personel", varsayilan: false },
            { key: "birikim", label: "Birikim", varsayilan: false },
            { key: "uyelikler", label: "Üyelikler (abonelikler)", varsayilan: false },
            { key: "sifreKasasi", label: "Şifre Kasası (yine de her girişte owner şifresi ister)", varsayilan: false },
          ].map((m) => (
            <label key={m.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: T.surfaceRaised, borderRadius: 10, cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.label}</span>
              <input
                type="checkbox"
                checked={staffPermissions[m.key] !== undefined ? staffPermissions[m.key] === true : m.varsayilan}
                onChange={(e) => onUpdatePermissions({ ...staffPermissions, [m.key]: e.target.checked })}
                style={{ width: 17, height: 17, cursor: "pointer" }}
              />
            </label>
          ))}
        </div>
      </Card>

      <Card style={{ padding: "18px 22px" }}>
        <SectionTitle>Marka Kimliği</SectionTitle>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 12 }}>
          Buraya yüklediğin görsel, oluşturduğun her teklifin ve sözleşmenin <strong>en altında</strong> otomatik olarak görünür — tekrar tekrar yüklemene gerek kalmaz.
        </p>
        <MarkaKimligiYukleyici value={markaKimligiGorseli} onChange={onSaveMarkaKimligi} />
      </Card>
    </div>
  );
}

/** Müşteri Paneli giriş hesapları — PersonelHesaplariKart ile aynı sunucu uç noktasını
 * (hesapTuru: "musteri" ile) kullanır, izin sistemi yok, sadece hangi markaya bağlı olduğu var. */
/** Tüm cihazlardaki oturumları geçersiz kılar — "şifremi biri biliyor olabilir" ya da
 * "telefonumu kaybettim" durumunda tek tıkla her yerden çıkış. */
function TumCihazlardanCikisButonu() {
  const [durum, setDurum] = useState("");
  const cikis = () => {
    if (!window.confirm("Tüm cihazlardaki oturumlar kapatılsın mı? Sen dahil herkes yeniden giriş yapmak zorunda kalır.")) return;
    setDurum("gonderiliyor");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ authAction: "tumCihazlardanCikis" }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) { clearOturum(); clearStaffCreds(); clearMusteriCreds(); window.alert("Tüm oturumlar kapatıldı. Yeniden giriş yapman gerekiyor."); window.location.reload(); }
        else { setDurum(""); window.alert(res.error || "İşlem başarısız."); }
      })
      .catch(() => { setDurum(""); window.alert("Bağlantı hatası."); });
  };
  return (
    <button style={{ ...cancelBtnStyle, color: T.danger }} disabled={durum === "gonderiliyor"} onClick={cikis}>
      {durum === "gonderiliyor" ? "Kapatılıyor…" : "Tüm Cihazlardan Çıkış Yap"}
    </button>
  );
}

function MusteriHesaplariKart({ clients }) {
  const [hesaplar, setHesaplar] = useState(null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniClientId, setYeniClientId] = useState("");
  const [yeniKullanici, setYeniKullanici] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [hata, setHata] = useState("");
  const [sifirlanan, setSifirlanan] = useState(null);
  const [yeniSifreDeger, setYeniSifreDeger] = useState("");

  const aktifMarkalar = (clients || []).filter((c) => c.durum === "aktif" || c.durum === "yeni");

  const yukle = () => {
    fetch("/api/manage-staff?hesapTuru=musteri", { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => setHesaplar(res.hesaplar || []))
      .catch(() => setHesaplar([]));
  };
  useEffect(() => { yukle(); }, []);

  const ekle = () => {
    setHata("");
    if (!yeniAd.trim() || !yeniKullanici.trim() || !yeniSifre.trim() || !yeniClientId) { setHata("Marka, ad, kullanıcı adı ve şifre gerekli."); return; }
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ hesapTuru: "musteri", action: "ekle", ad: yeniAd.trim(), kullaniciAdi: yeniKullanici.trim(), sifre: yeniSifre, clientId: yeniClientId }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) { setHata(res.error); return; }
        setHesaplar(res.hesaplar);
        setYeniAd(""); setYeniKullanici(""); setYeniSifre(""); setYeniClientId(""); setEkleAcik(false);
      })
      .catch(() => setHata("Bağlantı hatası."));
  };

  const sifreSifirla = (id) => {
    if (!yeniSifreDeger.trim() || yeniSifreDeger.length < 4) { setHata("Yeni şifre en az 4 karakter olmalı."); return; }
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ hesapTuru: "musteri", action: "sifreSifirla", id, sifre: yeniSifreDeger }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.hesaplar) { setHesaplar(res.hesaplar); setSifirlanan(null); setYeniSifreDeger(""); setHata(""); } })
      .catch(() => setHata("Bağlantı hatası."));
  };

  const sil = (id, ad) => {
    if (!window.confirm(`"${ad}" müşteri hesabı silinsin mi? Bu kişi artık panele giriş yapamaz.`)) return;
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ hesapTuru: "musteri", action: "sil", id }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.hesaplar) setHesaplar(res.hesaplar); })
      .catch(() => {});
  };

  const markaAdi = (clientId) => (aktifMarkalar.find((c) => String(c.id) === String(clientId)) || {}).ad || "(marka silinmiş)";

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Müşteri Hesapları</SectionTitle>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
        Her markaya, sadece o markanın içeriklerini görüp onaylayabileceği/revize isteyebileceği ayrı bir kullanıcı adı/şifre verebilirsin.
        Bu, personel ya da senin girişinle hiç karışmaz, tamamen izole bir panele açılır.
      </p>

      {hesaplar === null ? (
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Yükleniyor…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {hesaplar.length === 0 && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Henüz müşteri hesabı yok.</div>}
          {hesaplar.map((h) => (
            <div key={h.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{h.ad} <span style={{ color: T.textFaint, fontWeight: 400 }}>· {markaAdi(h.clientId)}</span></div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>Kullanıcı adı: {h.kullaniciAdi}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...iconBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11.5 }} onClick={() => { setSifirlanan(sifirlanan === h.id ? null : h.id); setYeniSifreDeger(""); setHata(""); }}>Şifre Sıfırla</button>
                  <button style={iconBtnStyle} onClick={() => sil(h.id, h.ad)}><Trash2 size={13} color={T.danger} /></button>
                </div>
              </div>
              {sifirlanan === h.id && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input type="text" autoComplete="off" placeholder="Yeni şifre" value={yeniSifreDeger} onChange={(e) => setYeniSifreDeger(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 12.5 }} />
                  <button style={{ ...saveBtnStyle, padding: "7px 12px", fontSize: 12 }} onClick={() => sifreSifirla(h.id)}>Kaydet</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ekleAcik ? (
        <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: 14 }}>
          <select value={yeniClientId} onChange={(e) => setYeniClientId(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
            <option value="">Marka seç…</option>
            {aktifMarkalar.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
          </select>
          <input type="text" placeholder="Yetkili kişinin adı (örn. Ahmet Bey)" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="text" autoComplete="off" placeholder="Kullanıcı Adı" value={yeniKullanici} onChange={(e) => setYeniKullanici(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="text" autoComplete="off" placeholder="Şifre" value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          {hata && <div style={{ color: T.danger, fontSize: 12, fontFamily: "Inter", marginBottom: 8 }}>{hata}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={cancelBtnStyle} onClick={() => { setEkleAcik(false); setHata(""); }}>İptal</button>
            <button style={saveBtnStyle} onClick={ekle}>Hesap Oluştur</button>
          </div>
        </div>
      ) : (
        <button style={addBtnStyle} onClick={() => setEkleAcik(true)}><Plus size={13} /> Müşteri Hesabı Oluştur</button>
      )}
    </Card>
  );
}

function PersonelHesaplariKart({ onRosterChange }) {
  const [hesaplar, setHesaplar] = useState(null); // null = yüklenmedi
  const [ekleAcik, setEkleAcik] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniKullanici, setYeniKullanici] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [hata, setHata] = useState("");
  const [sifirlanan, setSifirlanan] = useState(null); // id
  const [yeniSifreDeger, setYeniSifreDeger] = useState("");
  const [acikId, setAcikId] = useState(null); // yetki/e-posta düzenleme paneli açık olan hesap
  const [taslakEmail, setTaslakEmail] = useState("");
  const [taslakIzin, setTaslakIzin] = useState({});

  // hesaplar değiştikçe (ekleme/güncelleme/silme sonrası), ana uygulamadaki isim/e-posta
  // listesini de anında güncel tut — sayfa yenilenmeden Operasyon'daki bildirim çalışsın diye.
  useEffect(() => {
    if (hesaplar && onRosterChange) onRosterChange(hesaplar.map((h) => ({ ad: h.ad, email: h.email || "" })));
    // eslint-disable-next-line
  }, [hesaplar]);

  const IZIN_LISTESI = [
    { key: "dashboard", label: "Dashboard" },
    { key: "musteriler", label: "Müşteriler" },
    { key: "finans", label: "Finans" },
    { key: "takvim", label: "Takvim" },
    { key: "odemeTakvimi", label: "Ödeme Takvimi" },
    { key: "teklif", label: "Teklif & Sözleşme" },
    { key: "reklamlar", label: "Reklamlar" },
    { key: "paylasimlar", label: "Paylaşımlar (+ Günlük Kontrol)" },
    { key: "cekimListesi", label: "Çekim (düşük stok listesi)" },
    { key: "cekimEdit", label: "Operasyon" },
    { key: "markaYoneticisi", label: "Marka Yöneticisi (durum bildirimi e-postası gönderebilir)" },
    { key: "personel", label: "Personel" },
    { key: "birikim", label: "Birikim" },
    { key: "uyelikler", label: "Üyelikler (abonelikler)" },
    { key: "sifreKasasi", label: "Şifre Kasası (yine de owner şifresi ister)" },
  ];

  const yukle = () => {
    fetch("/api/manage-staff", { headers: { "X-Oturum": getOturum(), "X-Site-Password": getPw() } })
      .then((r) => r.json())
      .then((res) => setHesaplar(res.hesaplar || []))
      .catch(() => setHesaplar([]));
  };
  useEffect(() => { yukle(); }, []);

  const ekle = () => {
    setHata("");
    if (!yeniAd.trim() || !yeniKullanici.trim() || !yeniSifre.trim()) { setHata("Ad, kullanıcı adı ve şifre gerekli."); return; }
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ action: "ekle", ad: yeniAd.trim(), kullaniciAdi: yeniKullanici.trim(), sifre: yeniSifre }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) { setHata(res.error); return; }
        setHesaplar(res.hesaplar);
        setYeniAd(""); setYeniKullanici(""); setYeniSifre(""); setEkleAcik(false);
      })
      .catch(() => setHata("Bağlantı hatası."));
  };

  const sifreSifirla = (id) => {
    if (!yeniSifreDeger.trim()) return;
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ action: "sifreSifirla", id, sifre: yeniSifreDeger }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.hesaplar) setHesaplar(res.hesaplar); setSifirlanan(null); setYeniSifreDeger(""); });
  };

  const sil = (id) => {
    if (!window.confirm("Bu personel hesabı silinsin mi?")) return;
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ action: "sil", id }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.hesaplar) setHesaplar(res.hesaplar); });
  };

  const acPaneli = (h) => {
    if (acikId === h.id) { setAcikId(null); return; }
    setAcikId(h.id);
    setTaslakEmail(h.email || "");
    setTaslakIzin({ ...h.izinler });
  };

  const kaydetGuncelle = (id) => {
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
      body: JSON.stringify({ action: "guncelle", id, email: taslakEmail.trim(), izinler: taslakIzin }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.hesaplar) { setHesaplar(res.hesaplar); setAcikId(null); } });
  };

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Personel Hesapları</SectionTitle>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 14 }}>
        Her ekip üyesine kendi kullanıcı adı, şifresi, e-postası ve <strong>kendine özel yetkileri</strong> olan ayrı bir hesap verebilirsin.
        Bir isme "Yetkiler" panelinden verdiğin izinler, CEO Paneli'ndeki genel ayarların yerine geçer — yani her kişiyi istediğin gibi farklılaştırabilirsin.
        E-posta girersen, Operasyon'da o kişiye bir iş atandığında otomatik bildirim e-postası gider.
      </p>

      {hesaplar === null && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Yükleniyor…</div>}

      {hesaplar && hesaplar.length === 0 && !ekleAcik && (
        <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginBottom: 12 }}>Henüz kişisel personel hesabı yok.</div>
      )}

      {hesaplar && hesaplar.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {hesaplar.map((h) => (
            <div key={h.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{h.ad}</div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter" }}>@{h.kullaniciAdi}{h.email ? ` · ${h.email}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={cancelBtnStyle} onClick={() => acPaneli(h)}>{acikId === h.id ? "Kapat" : "Yetkiler / E-posta"}</button>
                  <button style={cancelBtnStyle} onClick={() => { setSifirlanan(sifirlanan === h.id ? null : h.id); setYeniSifreDeger(""); }}>Şifre Sıfırla</button>
                  <button style={iconBtnStyle} onClick={() => sil(h.id)}><Trash2 size={14} color={T.danger} /></button>
                </div>
              </div>
              {sifirlanan === h.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input type="password" placeholder="Yeni şifre" name="reset-staff-password" autoComplete="new-password" value={yeniSifreDeger} onChange={(e) => setYeniSifreDeger(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <button style={saveBtnStyle} onClick={() => sifreSifirla(h.id)}>Kaydet</button>
                </div>
              )}
              {acikId === h.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <label style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", display: "block", marginBottom: 4 }}>E-posta (opsiyonel — iş bildirimleri için)</label>
                  <input type="email" value={taslakEmail} onChange={(e) => setTaslakEmail(e.target.value)} placeholder="ornek@marcusmedya.com" style={{ ...inputStyle, marginBottom: 12 }} />
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>BU KİŞİYE ÖZEL YETKİLER</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {IZIN_LISTESI.map((m) => (
                      <label key={m.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: T.surface, borderRadius: 8, cursor: "pointer" }}>
                        <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter" }}>{m.label}</span>
                        <input type="checkbox" checked={taslakIzin[m.key] === true} onChange={(e) => setTaslakIzin((s) => ({ ...s, [m.key]: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      </label>
                    ))}
                  </div>
                  <button style={saveBtnStyle} onClick={() => kaydetGuncelle(h.id)}>Kaydet</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ekleAcik ? (
        <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px" }}>
          <div className="marcus-field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="Ad Soyad" name="new-staff-name" autoComplete="off" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} style={inputStyle} />
            <input placeholder="Kullanıcı Adı" name="new-staff-username" autoComplete="off" value={yeniKullanici} onChange={(e) => setYeniKullanici(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Şifre" name="new-staff-password" autoComplete="new-password" value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} style={inputStyle} />
          </div>
          {hata && <div style={{ color: T.danger, fontSize: 12, fontFamily: "Inter", marginBottom: 8 }}>{hata}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={cancelBtnStyle} onClick={() => setEkleAcik(false)}>İptal</button>
            <button style={saveBtnStyle} onClick={ekle}>Hesabı Oluştur</button>
          </div>
        </div>
      ) : (
        <button style={addBtnStyle} onClick={() => setEkleAcik(true)}><Plus size={13} /> Yeni Personel Hesabı</button>
      )}
    </Card>
  );
}

function MarkaKimligiYukleyici({ value, onChange }) {
  const inputRef = useRef(null);
  const dosyaSec = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // Logo olduğu için şeffaflık korunur; yine de küçültülüp sıkıştırılır ki
    // veri bloğunu şişirmesin.
    gorseliKucult(file, { maxKenar: 800, seffafKoru: true, hedefBayt: 250 * 1024 })
      .then(onChange)
      .catch((err) => window.alert(err.message || "Görsel yüklenemedi."));
  };
  return (
    <div>
      <div
        onClick={() => inputRef.current && inputRef.current.click()}
        style={{ height: 90, borderRadius: 12, border: `1.5px dashed ${T.border}`, background: T.surfaceRaised, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}
      >
        {value ? (
          <>
            <img src={value} alt="Marka kimliği" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
            <button onClick={(e) => { e.stopPropagation(); onChange(null); }} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999, border: "none", background: T.danger, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={13} /></button>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Görsel yüklemek için tıkla</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={dosyaSec} style={{ display: "none" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI CEO CHAT PANEL                                                    */
/* ------------------------------------------------------------------ */
const PRESET_QUESTIONS = ["Bu ay neden kâr düştü?", "En kârlı müşteriler hangileri?", "Gelecek ay tahmini nedir?", "Hangi müşteriye bağımlıyım?"];

function AiPanel({ open, onClose, initialQuestion, data }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Merhaba, ben Marcus Medya App'ın AI CEO asistanıyım. İşletmenin güncel verilerine bakarak sorularını cevaplayabilirim." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const firedInitial = useRef(false);

  useEffect(() => {
    if (open && initialQuestion && !firedInitial.current) { firedInitial.current = true; send(initialQuestion); }
    if (!open) firedInitial.current = false;
    // eslint-disable-next-line
  }, [open, initialQuestion]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Oturum": getOturum(), "X-Site-Password": getPw() },
        body: JSON.stringify({ question: q, context: data }),
      });
      const resData = await res.json();
      const textBlock = (resData.content || []).find((c) => c.type === "text");
      setMessages((m) => [...m, { role: "assistant", text: textBlock ? textBlock.text : (resData.error || "Bir cevap alınamadı, tekrar dener misin?") }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Bağlantı hatası oluştu. Lütfen tekrar dene." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 400, maxWidth: "92vw", background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 50, display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(.4,0,.2,1)", boxShadow: open ? "-24px 0 48px rgba(0,0,0,0.35)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={14} color={T.accentText} /></div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: T.text }}>AI CEO</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={17} color={T.textFaint} /></button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? T.accent : T.surfaceRaised, color: m.role === "user" ? "#fff" : T.text, padding: "10px 13px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", fontSize: 13.5, fontFamily: "Inter, sans-serif", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {m.text}
          </div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", color: T.textFaint, fontSize: 12.5, fontFamily: "Inter", padding: "4px 4px" }}>AI CEO yazıyor…</div>}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {PRESET_QUESTIONS.map((q) => (
            <button key={q} onClick={() => send(q)} style={{ textAlign: "left", background: T.surfaceRaised, border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{q}</button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Bir soru sor…" style={{ flex: 1, background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
        <button onClick={() => send()} disabled={loading} style={{ background: T.accent, border: "none", borderRadius: 10, width: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: loading ? 0.6 : 1 }}><Send size={15} color="#fff" /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ŞİFRE EKRANI                                                          */
/* ------------------------------------------------------------------ */
function LockScreen({ onSubmit, onKodSubmit, onKodIptal, kodAdimi, onStaffSubmit, onMusteriSubmit, error, checking }) {
  const [mode, setMode] = useState("sifre"); // "sifre" | "personel" | "musteri"
  const [value, setValue] = useState("");
  const [kodDeger, setKodDeger] = useState("");
  const [hatirla, setHatirla] = useState(false);
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [personelSifre, setPersonelSifre] = useState("");
  const [musteriKullaniciAdi, setMusteriKullaniciAdi] = useState("");
  const [musteriSifre, setMusteriSifre] = useState("");

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{FONTS}</style>
      <div style={{ width: 320, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 18, margin: "0 auto 18px" }}>M</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.text, margin: "0 0 6px" }}>Marcus Medya App</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, margin: "0 0 18px" }}>{mode === "sifre" ? "Devam etmek için şifreni gir." : mode === "personel" ? "Kullanıcı adın ve şifrenle giriş yap." : "Marka giriş bilgilerinle içeriklerini görüntüle."}</p>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: T.surfaceRaised, borderRadius: 10, padding: 3 }}>
          <button onClick={() => setMode("sifre")} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: mode === "sifre" ? T.accent : "transparent", color: mode === "sifre" ? "#fff" : T.textDim, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Şifreyle Gir</button>
          <button onClick={() => setMode("personel")} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: mode === "personel" ? T.accent : "transparent", color: mode === "personel" ? "#fff" : T.textDim, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Personel</button>
          <button onClick={() => setMode("musteri")} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: mode === "musteri" ? T.accent : "transparent", color: mode === "musteri" ? "#fff" : T.textDim, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Müşteri</button>
        </div>

        {mode === "sifre" ? (
          kodAdimi ? (
            <>
              {/* İKİ ADIMLI DOĞRULAMA — şifre doğru, şimdi e-postaya gelen kod isteniyor. */}
              <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter", marginBottom: 12, lineHeight: 1.6 }}>
                E-postana 6 haneli bir kod gönderdik. Kod 10 dakika geçerli.
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={kodDeger}
                onChange={(e) => setKodDeger(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && onKodSubmit(value, kodDeger, hatirla)}
                placeholder="______"
                style={{ ...inputStyle, textAlign: "center", marginBottom: 12, padding: "11px 12px", fontSize: 22, letterSpacing: 8, fontFamily: "'IBM Plex Mono', monospace" }}
              />
              <button onClick={() => onKodSubmit(value, kodDeger, hatirla)} disabled={checking || kodDeger.length !== 6} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", opacity: checking || kodDeger.length !== 6 ? 0.6 : 1 }}>
                {checking ? "Kontrol ediliyor…" : "Doğrula ve Gir"}
              </button>
              <button onClick={onKodIptal} style={{ background: "none", border: "none", color: T.textFaint, fontSize: 12, cursor: "pointer", marginTop: 12, fontFamily: "Inter" }}>← Geri dön</button>
            </>
          ) : (
            <>
              {/* Tarayıcının şifreyi kaydedip otomatik doldurmasını engelliyoruz: alan adı
                * tahmin edilebilir değil ve autoComplete kapalı. Eskiden bu alan
                * autoComplete="current-password" idi, bu yüzden cihaza oturan herkese
                * şifre otomatik doluyordu — güvenlik açığının asıl kaynağı buydu. */}
              <input
                type="password"
                name="mos-erisim-anahtari"
                id="mos-erisim-anahtari"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSubmit(value, hatirla)}
                placeholder="Şifre"
                style={{ ...inputStyle, textAlign: "center", marginBottom: 12, padding: "11px 12px" }}
              />
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 12, cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter" }}>
                <input type="checkbox" checked={hatirla} onChange={(e) => setHatirla(e.target.checked)} style={{ cursor: "pointer" }} />
                Bu cihazı 30 gün hatırla
              </label>
              <button onClick={() => onSubmit(value, hatirla)} disabled={checking} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", opacity: checking ? 0.6 : 1 }}>
                {checking ? "Kontrol ediliyor…" : "Giriş Yap"}
              </button>
            </>
          )
        ) : mode === "personel" ? (
          <>
            <input
              type="text"
              name="staff-username"
              autoComplete="username"
              autoFocus
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              placeholder="Kullanıcı Adı"
              style={{ ...inputStyle, textAlign: "center", marginBottom: 10, padding: "11px 12px" }}
            />
            <input
              type="password"
              name="staff-password"
              autoComplete="off"
              data-lpignore="true"
              value={personelSifre}
              onChange={(e) => setPersonelSifre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onStaffSubmit(kullaniciAdi, personelSifre)}
              placeholder="Şifre"
              style={{ ...inputStyle, textAlign: "center", marginBottom: 12, padding: "11px 12px" }}
            />
            <button onClick={() => onStaffSubmit(kullaniciAdi, personelSifre)} disabled={checking} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", opacity: checking ? 0.6 : 1 }}>
              {checking ? "Kontrol ediliyor…" : "Giriş Yap"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              name="musteri-username"
              autoComplete="username"
              autoFocus
              value={musteriKullaniciAdi}
              onChange={(e) => setMusteriKullaniciAdi(e.target.value)}
              placeholder="Kullanıcı Adı"
              style={{ ...inputStyle, textAlign: "center", marginBottom: 10, padding: "11px 12px" }}
            />
            <input
              type="password"
              name="musteri-password"
              autoComplete="off"
              data-lpignore="true"
              value={musteriSifre}
              onChange={(e) => setMusteriSifre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onMusteriSubmit(musteriKullaniciAdi, musteriSifre)}
              placeholder="Şifre"
              style={{ ...inputStyle, textAlign: "center", marginBottom: 12, padding: "11px 12px" }}
            />
            <button onClick={() => onMusteriSubmit(musteriKullaniciAdi, musteriSifre)} disabled={checking} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", opacity: checking ? 0.6 : 1 }}>
              {checking ? "Kontrol ediliyor…" : "Giriş Yap"}
            </button>
          </>
        )}
        {error && <div style={{ color: T.danger, fontSize: 12.5, fontFamily: "Inter", marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

/** Google Drive paylaşım linkini, sayfa içinde doğrudan oynatılabilir (gömülü) önizleme
 * formatına çevirir. Dönüştürülemezse null döner, o zaman normal link olarak gösterilir. */
function driveEmbedUrl(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  return `https://drive.google.com/file/d/${m[1]}/preview`;
}

/** Müşteri Paneli — owner/personel arayüzünden tamamen izole, sade bir onay ekranı.
 * Sadece kendi markasının içeriklerini görür; her içeriği onaylayabilir ya da revize isteyebilir. */
function MusteriPaneli({ musteriData, onCikis, onIslemSonrasi }) {
  const [icerikler, setIcerikler] = useState(musteriData.icerikler || []);
  // Sunucudan yeni veri geldiğinde listeyi tazele. useState başlangıç değeri SADECE ilk
  // render'da okunur — bu senkron olmadan, yönetici bir içerik ekleyip düzenlese ya da
  // onay sonrası veri yenilense bile müşterinin ekranı ilk açılıştaki hâlinde donuyordu.
  useEffect(() => { setIcerikler(musteriData.icerikler || []); }, [musteriData]);
  const [revizeAcikId, setRevizeAcikId] = useState(null);
  const [revizeMetni, setRevizeMetni] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(null);

  // Hareketsizlik koruması: müşteri panelini açık unutup giderse (özellikle ortak/paylaşılan
  // bir bilgisayarda), 1 dakika hiç dokunulmazsa otomatik olarak çıkış yapılır — hem gizlilik
  // hem güvenlik için (yazılmış ama gönderilmemiş bir revize notu ortada kalmasın diye).
  useEffect(() => {
    let zamanlayici = null;
    const sifirla = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => onCikis(), 60000);
    };
    const olaylar = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    olaylar.forEach((olay) => window.addEventListener(olay, sifirla, { passive: true }));
    sifirla();
    return () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      olaylar.forEach((olay) => window.removeEventListener(olay, sifirla));
    };
    // eslint-disable-next-line
  }, []);

  const istekAt = (musteriAction, icerikId, revizeNotu) => {
    setGonderiliyor(icerikId);
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ musteriAction, icerikId, revizeNotu }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setIcerikler((liste) => liste.map((i) => (i.id === icerikId
            ? { ...i, durum: musteriAction === "onayla" ? "onaylandi" : "revize", revizeNotu: musteriAction === "onayla" ? null : revizeNotu }
            : i)));
          setRevizeAcikId(null);
          setRevizeMetni("");
          if (onIslemSonrasi) onIslemSonrasi();
        } else {
          window.alert(res.error || "Bir sorun oluştu.");
        }
      })
      .catch(() => window.alert("Bağlantı hatası — tekrar dene."))
      .finally(() => setGonderiliyor(null));
  };

  const DURUM_STIL = {
    bekliyor: { label: "İncelemeni Bekliyor", color: T.warning, bg: T.warningSoft },
    onaylandi: { label: "Onayladın ✓", color: T.success, bg: T.successSoft },
    revize: { label: "Revize İstedin", color: T.danger, bg: T.dangerSoft },
  };

  const bekleyenler = icerikler.filter((i) => i.durum === "bekliyor");
  const gecmis = icerikler.filter((i) => i.durum !== "bekliyor");

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint, fontFamily: "Inter" }}>{musteriData.firmaAdi}</div>
            <div style={{ fontSize: 19, color: T.text, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{musteriData.marka}</div>
          </div>
          <button onClick={onCikis} style={{ ...cancelBtnStyle, fontSize: 12 }}>Çıkış Yap</button>
        </div>

        <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>
          İncelemeni Bekleyenler {bekleyenler.length > 0 && `(${bekleyenler.length})`}
        </div>

        {bekleyenler.length === 0 ? (
          <Card style={{ padding: "24px", textAlign: "center", marginBottom: 28 }}>
            <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Şu an incelemen gereken bir içerik yok.</div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {bekleyenler.map((icerik) => {
              const embed = driveEmbedUrl(icerik.driveLinki);
              const cekimEmbed = icerik.tur === "cekim" ? driveEmbedUrl(icerik.referansLink) : null;
              return (
                <Card key={icerik.id} style={{ padding: 16, border: `1px solid ${T.warning}` }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: "Inter", marginBottom: 4 }}>
                    {icerik.tur === "cekim" && <span style={{ color: T.accentText }}>🎬 </span>}
                    {basligiTemizle(icerik.aciklama) || (icerik.tur === "cekim" ? "Çekim Planı" : icerik.tur)}
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 12 }}>
                    {icerik.tarih}
                    {icerik.tur === "cekim" && icerik.planlananTarih && ` · Planlanan çekim: ${tarihGoster(icerik.planlananTarih)}`}
                  </div>

                  {/* ÇEKİM PLANI: referans video + konuşma metni + çekim notu */}
                  {icerik.tur === "cekim" && (
                    <div style={{ marginBottom: 12 }}>
                      {icerik.konusmali && (
                        <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: T.accentText, background: T.accentSoft, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter", marginBottom: 10 }}>
                          {icerik.konusmali === "konusmali" ? "KONUŞMALI" : icerik.konusmali === "seslendirme" ? "DIŞ SES" : "KONUŞMASIZ"}
                        </div>
                      )}

                      {cekimEmbed && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>REFERANS VİDEO</div>
                          <iframe src={cekimEmbed} title="Referans video" style={{ width: "100%", height: 280, border: "none", borderRadius: 10 }} allow="autoplay" />
                        </div>
                      )}
                      {!cekimEmbed && icerik.referansLink && (
                        <a href={icerik.referansLink} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 10, color: T.accentText, fontSize: 12.5, fontFamily: "Inter" }}>
                          ▶ Referans videoyu izle ↗
                        </a>
                      )}

                      {icerik.konusmaMetni && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>
                            {icerik.konusmali === "seslendirme" ? "DIŞ SES METNİ" : "KONUŞMA METNİ"}
                          </div>
                          <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: T.text, fontFamily: "Inter", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            {icerik.konusmaMetni}
                          </div>
                        </div>
                      )}

                      {icerik.cekimNotu && (
                        <div>
                          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 5 }}>ÇEKİM NOTU</div>
                          <div style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{icerik.cekimNotu}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {icerik.gorselUrl && (
                    <img src={icerik.gorselUrl} alt={icerik.aciklama || ""} style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }} />
                  )}
                  {!icerik.gorselUrl && embed && (
                    <iframe src={embed} title={icerik.aciklama || "içerik"} style={{ width: "100%", height: 280, border: "none", borderRadius: 10, marginBottom: 12 }} allow="autoplay" />
                  )}
                  {!icerik.gorselUrl && !embed && icerik.driveLinki && (
                    <a href={icerik.driveLinki} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 12, color: T.accentText, fontSize: 12.5, fontFamily: "Inter" }}>İçeriği Görüntüle ↗</a>
                  )}

                  {revizeAcikId === icerik.id ? (
                    <div>
                      <textarea
                        autoFocus
                        value={revizeMetni}
                        onChange={(e) => setRevizeMetni(e.target.value)}
                        placeholder="Neyin değişmesini istiyorsun?"
                        rows={3}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 10, fontFamily: "Inter" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={cancelBtnStyle} onClick={() => { setRevizeAcikId(null); setRevizeMetni(""); }}>İptal</button>
                        <button
                          style={{ ...saveBtnStyle, background: T.danger }}
                          disabled={gonderiliyor === icerik.id || !revizeMetni.trim()}
                          onClick={() => istekAt("revizeIste", icerik.id, revizeMetni)}
                        >
                          {gonderiliyor === icerik.id ? "Gönderiliyor…" : "Revize İsteğini Gönder"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...saveBtnStyle, flex: 1, justifyContent: "center" }}
                        disabled={gonderiliyor === icerik.id}
                        onClick={() => istekAt("onayla", icerik.id)}
                      >
                        {gonderiliyor === icerik.id ? "…" : (icerik.tur === "cekim" ? "✓ Planı Onayla" : "✓ Onayla")}
                      </button>
                      <button style={{ ...cancelBtnStyle, flex: 1, justifyContent: "center" }} onClick={() => { setRevizeAcikId(icerik.id); setRevizeMetni(""); }}>
                        Revize İste
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {gecmis.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Geçmiş</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gecmis.map((icerik) => {
                const stil = DURUM_STIL[icerik.durum] || DURUM_STIL.bekliyor;
                return (
                  <Card key={icerik.id} style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: icerik.revizeNotu ? 6 : 0 }}>
                      <div>
                        <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontFamily: "Inter" }}>{basligiTemizle(icerik.aciklama) || icerik.tur}</div>
                        <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>{icerik.tarih}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: stil.color, background: stil.bg, padding: "3px 10px", borderRadius: 999, fontFamily: "Inter" }}>{stil.label}</span>
                    </div>
                    {icerik.revizeNotu && <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", fontStyle: "italic" }}>"{icerik.revizeNotu}"</div>}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* PAYLAŞIM PLANI — hangi gün ne paylaşılacak, alt metniyle birlikte. */}
        <MusteriPaylasimPlani plan={musteriData.paylasimPlani || []} />

        {/* REKLAMLAR — markanın aktif/biten kampanyaları. Bütçe bilgisi bilerek gönderilmez. */}
        <MusteriReklamlar reklamlar={musteriData.reklamlar || []} />

        {/* OPERASYON — üretim süreci: hangi iş hangi aşamada. */}
        <MusteriOperasyon isler={musteriData.operasyonIsleri || []} />
      </div>
    </div>
  );
}

/** Müşteri panelinde haftalık paylaşım planı. Gelecek haftalar önce gösterilir; geçmiş
 * haftalar "yapıldı" bilgisiyle altta kalır. */
function MusteriPaylasimPlani({ plan }) {
  const [gecmisAcik, setGecmisAcik] = useState(false);
  if (!plan || plan.length === 0) return null;

  const buHafta = haftaBaslangici();
  const gelecek = plan.filter((p) => p.haftaKey >= buHafta);
  const gecmis = plan.filter((p) => p.haftaKey < buHafta).sort((a, b) => (a.haftaKey < b.haftaKey ? 1 : -1));

  const haftaBasligi = (key) => {
    const d = new Date(key);
    if (Number.isNaN(d.getTime())) return key;
    return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} haftası`;
  };
  const gruplar = {};
  gelecek.forEach((p) => { (gruplar[p.haftaKey] = gruplar[p.haftaKey] || []).push(p); });
  const siraliHaftalar = Object.keys(gruplar).sort();

  const Satir = ({ p }) => (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 13px", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accentText, background: T.accentSoft, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>{p.gun}</span>
        <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{p.tur}</span>
        {p.yapildi && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.success, background: T.successSoft, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>Paylaşıldı</span>}
      </div>
      {p.altMetin && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: T.textDim, fontFamily: "Inter", lineHeight: 1.65, whiteSpace: "pre-wrap", borderLeft: `2px solid ${T.border}`, paddingLeft: 10 }}>
          {p.altMetin}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Paylaşım Planı</div>
      {siraliHaftalar.length === 0 && gecmis.length === 0 && (
        <Card style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz plan oluşturulmadı.</div>
        </Card>
      )}
      {siraliHaftalar.map((hk) => (
        <div key={hk} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>{haftaBasligi(hk)}</div>
          {gruplar[hk].map((p) => <Satir key={p.id} p={p} />)}
        </div>
      ))}
      {gecmis.length > 0 && (
        <>
          <button onClick={() => setGecmisAcik((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}>
            {gecmisAcik ? "▾" : "▸"} Geçmiş paylaşımlar ({gecmis.length})
          </button>
          {gecmisAcik && <div style={{ marginTop: 8 }}>{gecmis.map((p) => <Satir key={p.id} p={p} />)}</div>}
        </>
      )}
    </div>
  );
}

/** Müşteri panelinde markanın reklam kampanyaları. */
function MusteriReklamlar({ reklamlar }) {
  if (!reklamlar || reklamlar.length === 0) return null;
  const durumStil = { aktif: { label: "Yayında", color: T.success, bg: T.successSoft }, yakinda: { label: "Yakında bitiyor", color: T.warning, bg: T.warningSoft }, bitti: { label: "Sona erdi", color: T.textFaint, bg: T.surfaceRaised } };
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Reklam Kampanyaları</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {reklamlar.map((r) => {
          const st = durumStil[reklamDurumu(r)] || durumStil.aktif;
          return (
            <div key={r.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.reklamAdi}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 9px", borderRadius: 999, fontFamily: "Inter" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", marginTop: 3 }}>
                {tarihGoster(r.baslangicTarihi)} — {tarihGoster(r.bitisTarihi)}
              </div>
              {r.not && <div style={{ fontSize: 12, color: T.textDim, fontFamily: "Inter", marginTop: 5, lineHeight: 1.6 }}>{r.not}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Müşteri panelinde üretim süreci — hangi iş hangi aşamada. */
function MusteriOperasyon({ isler }) {
  const [hepsiAcik, setHepsiAcik] = useState(false);
  if (!isler || isler.length === 0) return null;

  const devamEden = isler.filter((j) => j.asama !== "Teslim Edildi");
  const bitenler = isler.filter((j) => j.asama === "Teslim Edildi");
  const gosterilen = hepsiAcik ? bitenler : bitenler.slice(-5);

  const Satir = ({ j }) => (
    <div style={{ background: T.surfaceRaised, borderRadius: 10, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>
          {j.icerikTuru}{j.kategori ? ` · ${j.kategori}` : ""}{j.uretilenAdet ? ` · ${j.uretilenAdet} parça` : ""}
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>
          {j.asama === "Teslim Edildi" && j.teslimEdilmeTarihi
            ? `Teslim: ${tarihGoster(j.teslimEdilmeTarihi)}`
            : j.teslimTarihi ? `Planlanan teslim: ${tarihGoster(j.teslimTarihi)}` : ""}
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "Inter", padding: "3px 10px", borderRadius: 999,
        color: j.asama === "Teslim Edildi" ? T.success : T.warning,
        background: j.asama === "Teslim Edildi" ? T.successSoft : T.warningSoft }}>
        {j.asama}
      </span>
    </div>
  );

  return (
    <div style={{ marginTop: 28, marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, fontFamily: "Inter", marginBottom: 10 }}>Üretim Durumu</div>
      {devamEden.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: bitenler.length > 0 ? 12 : 0 }}>
          {devamEden.map((j) => <Satir key={j.id} j={j} />)}
        </div>
      )}
      {bitenler.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 6 }}>Tamamlananlar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gosterilen.map((j) => <Satir key={j.id} j={j} />)}
          </div>
          {bitenler.length > 5 && (
            <button onClick={() => setHepsiAcik((v) => !v)} style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontSize: 12, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}>
              {hepsiAcik ? "Daha az göster" : `+ ${bitenler.length - 5} tane daha göster`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BackupReminder({ onBackupNow, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="marcus-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 380, maxWidth: "100%", padding: "26px 28px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.warningSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <PiggyBank size={20} color={T.warning} />
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16.5, fontWeight: 600, color: T.text, margin: "0 0 8px" }}>Yedek alma zamanı</h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.6, margin: "0 0 20px" }}>
          Verilerini düzenli yedeklemen için hatırlatıyoruz. Tek tıkla tam bir yedek indirebilirsin — bu, bilgisayarına iner ve verinin ekstra bir güvenli kopyası olur.
        </p>
        <button onClick={onBackupNow} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center", padding: "11px 12px", marginBottom: 10 }}>
          <Plus size={13} style={{ transform: "rotate(45deg)" }} /> Şimdi Yedek Al
        </button>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: T.textFaint, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer", padding: "6px" }}>
          1 saat sonra tekrar sor
        </button>
      </div>
    </div>
  );
}

function TebligDuzenleModal({ initialText, client, firmaAdi, onClose }) {
  const [text, setText] = useState(initialText);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="marcus-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16.5, fontWeight: 600, color: T.text, margin: 0 }}>Tebliğ Metnini Düzenle</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} color={T.textFaint} /></button>
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: T.textFaint, lineHeight: 1.6, marginBottom: 12 }}>
          {client.ad} için oluşturulan metni burada serbestçe değiştirebilirsin. Genel şablonu (bundan sonraki tüm tebliğlerin başlangıcını) değiştirmek istersen Ayarlar &gt; Tebliğ Şablonu'na bak.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          style={{ width: "100%", background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", color: T.text, fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical", lineHeight: 1.6 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button style={cancelBtnStyle} onClick={onClose}>İptal</button>
          <button style={cancelBtnStyle} onClick={() => kopyalaMetin(text)}>Metni Kopyala</button>
          <button style={saveBtnStyle} onClick={() => { yazdirTebligMetni(text, client, firmaAdi); onClose(); }}>Yazdır / PDF</button>
        </div>
      </div>
    </div>
  );
}

function SaveBlockedModal({ info, onCancel, onForce }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="marcus-card" style={{ background: T.surface, border: `2px solid ${T.danger}`, borderRadius: 18, width: 420, maxWidth: "100%", padding: "26px 28px" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Bell size={20} color={T.danger} />
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16.5, fontWeight: 600, color: T.text, margin: "0 0 8px", textAlign: "center" }}>Kayıt güvenlik nedeniyle durduruldu</h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.7, textAlign: "center", margin: "0 0 18px" }}>
          Kaydetmeye çalıştığın veri, mevcut kayıtlı veriden çok daha az {info.alan === "personel" ? "personel kaydı" : "müşteri"} içeriyor
          (<strong style={{ color: T.text }}>{info.existingCount}</strong> → <strong style={{ color: T.text }}>{info.newCount}</strong>).
          Bu, istenmeyen bir veri kaybı olabilir diye otomatik olarak durduruldu.
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: T.textFaint, lineHeight: 1.6, textAlign: "center", margin: "0 0 20px" }}>
          Eğer bilerek birden fazla {info.alan === "personel" ? "personel kaydı" : "müşteri"} sildiysen "Evet, devam et" diyebilirsin. Emin değilsen "İptal" de ve Ayarlar'daki günlük yedeklerden verinin son sağlam halini kontrol et.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onCancel} style={{ ...saveBtnStyle, width: "100%", justifyContent: "center" }}>İptal — verimi koru</button>
          <button onClick={onForce} style={{ ...cancelBtnStyle, width: "100%", color: T.danger, borderColor: T.danger }}>Evet, bu doğru — devam et ve kaydet</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* APP SHELL                                                            */
/* ------------------------------------------------------------------ */
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "planim", label: "Planım", icon: NotebookPen },
  { key: "musteriler", label: "Müşteriler", icon: Users },
  { key: "finans", label: "Finans", icon: Wallet },
  { key: "takvim", label: "Takvim", icon: Calendar },
  { key: "odeme-takvimi", label: "Ödeme Takvimi", icon: ListChecks },
  { key: "teklif", label: "Teklif & Sözleşme", icon: FileText },
  { key: "reklamlar", label: "Reklamlar", icon: Megaphone },
  { key: "paylasimlar", label: "Paylaşımlar", icon: Share2 },
  { key: "gunluk-kontrol", label: "Günlük Kontrol", icon: ClipboardCheck },
  { key: "cekim-listesi", label: "Çekim", icon: Video },
  { key: "cekim-edit", label: "Operasyon", icon: Camera },
  { key: "personel", label: "Personel", icon: Briefcase },
  { key: "birikim", label: "Birikim", icon: PiggyBank },
  { key: "uyelikler", label: "Üyelikler", icon: CreditCard },
  { key: "musteri-paneli", label: "Müşteri Paneli", icon: MonitorSmartphone },
  { key: "musteri-girisleri", label: "Şifre Kasası", icon: KeyRound },
  { key: "ayarlar", label: "Ayarlar", icon: Settings },
];

export default function MarcusOS() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("marcus-os-son-sekme") || "dashboard"; } catch (e) { return "dashboard"; }
  });
  useEffect(() => {
    try { localStorage.setItem("marcus-os-son-sekme", tab); } catch (e) { /* localStorage erişilemezse sessizce geç */ }
  }, [tab]);

  // Hareketsizlik koruması: bir sayfa (özellikle bir düzenleme formu açık) 1 dakika boyunca
  // hiç dokunulmadan açık kalırsa, otomatik olarak Dashboard'a (hiçbir düzenleme/kayıt
  // riski taşımayan bir sayfa) yönlendirir. Amaç: biri sayfayı açık unutup gidince, geri
  // dönüldüğünde yanlışlıkla eski/yarım bir formun kaydedilmesi riskini azaltmak.
  useEffect(() => {
    let zamanlayici = null;
    // Doldurulmuş ama henüz kaydedilmemiş bir form açıksa yönlendirme yapılmaz —
    // eskiden 60 saniyede yarım kalan bir form uyarısız siliniyordu. Arama kutusu
    // bu kontrolün dışında tutulur (o bir form değil).
    const yarimFormVarMi = () => {
      try {
        const alanlar = document.querySelectorAll("input:not([data-marcus-arama]), textarea");
        for (const alan of alanlar) {
          if (alan.type === "file" || alan.type === "checkbox" || alan.type === "radio") continue;
          if (alan.value && String(alan.value).trim() !== "") return true;
        }
      } catch (e) { return true; } // emin olamıyorsak yönlendirme YAPMA (güvenli taraf)
      return false;
    };
    const sifirla = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => {
        if (yarimFormVarMi()) { sifirla(); return; }
        if (saveTimer.current || saveStatusRef.current === "saving") { sifirla(); return; }
        setTab("dashboard");
      }, 180000);
    };
    const olaylar = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    olaylar.forEach((olay) => window.addEventListener(olay, sifirla, { passive: true }));
    sifirla();
    return () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      olaylar.forEach((olay) => window.removeEventListener(olay, sifirla));
    };
  }, []);
  const [gizlilikModu, setGizlilikModuState] = useState(GIZLILIK_MODU);
  const setGizlilikModu = (deger) => {
    GIZLILIK_MODU = deger;
    try { localStorage.setItem("marcus-os-gizlilik", deger ? "1" : "0"); } catch (e) { /* sessizce geç */ }
    setGizlilikModuState(deger);
  };
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [kodAdimi, setKodAdimi] = useState(false); // iki adımlı doğrulamada kod ekranı
  const [role, setRole] = useState(null); // "owner" | "staff" | "musteri"
  const [loggedStaffName, setLoggedStaffName] = useState("");
  const [musteriData, setMusteriData] = useState(null);
  const [musteriBlockedMsg, setMusteriBlockedMsg] = useState("");
  const [authError, setAuthError] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailClientFromSearch, setDetailClientFromSearch] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const [loadError, setLoadError] = useState(false);
  const [needsSeedConfirm, setNeedsSeedConfirm] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(null);
  const [staleConflictMsg, setStaleConflictMsg] = useState("");
  const [tebligOpen, setTebligOpen] = useState(null);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  const loadData = (isRetry) => {
    if (isRetry) setAuthChecking(true);
    else setLoading(true);
    setLoadError(false);
    fetch("/api/data", { headers: authHeaders() })
      .then(async (r) => {
        if (r.status === 401) {
          // Oturum süresi dolmuş ya da iptal edilmiş olabilir — geçersiz anahtarı temizle ki
          // giriş ekranında eski anahtarla tekrar tekrar denenmesin.
          clearOturum();
          setNeedsAuth(true);
          setKodAdimi(false);
          if (isRetry) setAuthError("Yanlış şifre, tekrar dener misin?");
          return;
        }
        if (r.status === 403) {
          // Müşteri Paneli'nde marka dondurulmuş/silinmiş — genel sunucu hatasından ayrı,
          // net bir mesaj göster.
          const res = await r.json().catch(() => ({}));
          setMusteriBlockedMsg(res.error || "Bu hesap şu anda kullanım dışı.");
          return;
        }
        if (!r.ok) {
          // Sunucu/veritabanı hatası: ASLA demo veriyle üzerine yazma, sadece hata göster.
          setLoadError(true);
          return;
        }
        const res = await r.json();
        // Müşteri Paneli girişi tamamen ayrı bir veri şekli döner — normal data/needsSeedConfirm
        // akışına hiç girmez, kendi state'inde tutulur.
        if (res.role === "musteri") {
          setRole("musteri");
          // Sunucudan gelen TÜM müşteri alanları alınır. Eskiden burada sadece dört alan
          // tek tek kopyalanıyordu, bu yüzden sunucu reklamları/planı/operasyon işlerini
          // gönderse bile tarayıcı onları sessizce atıyordu.
          setMusteriData({
            musteriAd: res.musteriAd,
            marka: res.marka,
            firmaAdi: res.firmaAdi,
            icerikler: res.icerikler || [],
            reklamlar: res.reklamlar || [],
            paylasimPlani: res.paylasimPlani || [],
            operasyonIsleri: res.operasyonIsleri || [],
          });
          setNeedsAuth(false);
          setAuthError("");
          return;
        }
        if (res.role) setRole(res.role);
        if (res.staffName) setLoggedStaffName(res.staffName);
        if (res.data) {
          setData(res.data);
          setNeedsSeedConfirm(false);
        } else {
          // Veritabanı boş döndü — bu gerçekten ilk kurulum olabilir AMA aynı zamanda şüpheli bir
          // durum da olabilir (bkz. geçmişteki veri kaybı). Onay almadan ASLA demo veriyle doldurup kaydetmiyoruz.
          // Personel rolü zaten veri oluşturamaz, bu ekranı görmemesi için sahiplik owner'a bırakılır.
          setNeedsSeedConfirm(res.role !== "staff");
        }
        setNeedsAuth(false);
        setAuthError("");
      })
      .catch(() => setLoadError(true)) // ağ hatası — data state'ine ASLA dokunma
      .finally(() => { setLoading(false); setAuthChecking(false); });
  };

  useEffect(() => { loadData(false); }, []);

  // Arka planda sessiz yenileme: başka bir cihaz/kişi değişiklik yaptığında, sayfayı elle
  // yenilemeden bu ekranın da güncellenmesi için düzenli aralıklarla (ve sekmeye geri
  // dönüldüğünde) veriyi tekrar çeker. Kendi kaydedilmemiş (henüz sunucuya gitmemiş) bir
  // değişikliğin ÜZERİNE yazmamak için, bekleyen bir kayıt varsa bu turu atlar.
  // ref'lerle takip edilir ki interval her düzenlemede sıfırlanıp gerçek periyodikliğini
  // kaybetmesin — kullanıcı sürekli düzenlese bile 25 saniyede bir tetiklenmeye devam eder.
  const dataVarMi = useRef(false);
  const saveStatusRef = useRef(saveStatus);
  useEffect(() => { dataVarMi.current = !!data; }, [data]);
  useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);

  // Hem arka plan (sessiz, periyodik) yenilemede hem de kullanıcının elle bastığı "Yenile"
  // butonlarında kullanılan ortak fonksiyon — sunucudaki en güncel veriyi çekip local state'e
  // uygular. Bekleyen/aktif bir kayıt varsa üzerine yazmaz (kendi değişikliğini kaybetmesin).
  const veriyiYenile = () => {
    if (saveTimer.current || saveStatusRef.current === "saving") return Promise.resolve(false);
    return fetch("/api/data", { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) return false;
        const res = await r.json();
        if (res.data) {
          skipNextSave.current = true;
          setData(res.data);
          return true;
        }
        return false;
      })
      .catch(() => false);
  };

  useEffect(() => {
    let gizlenmeZamani = null;
    const sessizYenile = () => {
      if (!dataVarMi.current) return; // ilk yükleme henüz tamamlanmadıysa karışma
      veriyiYenile();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        gizlenmeZamani = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;
      const gizliKalinanSure = gizlenmeZamani ? Date.now() - gizlenmeZamani : 0;
      gizlenmeZamani = null;
      // Sekme/cihaz UZUN SÜRE (1 dakikadan fazla — laptop uykuya daldı, telefon arka plana
      // atıldı vb.) arka planda kaldıysa, o sırada bellekte kalmış ve henüz gönderilmemiş
      // BEKLEYEN bir kayıt varsa bunu artık güvenilir saymıyoruz: geri dönüldüğünde başka bir
      // cihazın yaptığı değişiklikleri geçersiz kılıp üzerine yazabilirdi (gece verinin "eski
      // haline dönmesi" sorununun kök nedeni buydu). Bu durumda bekleyen eski kaydı iptal edip
      // önce sunucudaki en güncel veriyi çekiyoruz.
      if (gizliKalinanSure > 60000 && saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        skipNextSave.current = true;
        setSaveStatus("saved");
        veriyiYenile();
        return;
      }
      sessizYenile();
    };

    const interval = setInterval(sessizYenile, 25000); // 25 saniyede bir
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
    // eslint-disable-next-line
  }, [])

  /** Adım 1: şifre sunucuya gönderilir. Sunucu ya kod ister (iki adımlı doğrulama açıksa)
   * ya da doğrudan oturum anahtarı verir. Şifre HİÇBİR ZAMAN tarayıcıda saklanmaz. */
  const handleAuthSubmit = (pw, hatirla) => {
    setAuthChecking(true);
    setAuthError("");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authAction: "girisBasla", sifre: pw, hatirla: !!hatirla }),
    })
      .then((r) => r.json().then((res) => ({ ok: r.ok, res })))
      .then(({ ok, res }) => {
        setAuthChecking(false);
        if (!ok) { setAuthError(res.error || "Giriş yapılamadı."); return; }
        if (res.kodGerekli) { setKodAdimi(true); return; }
        setOturum(res.token, res.sure);
        clearStaffCreds();
        clearMusteriCreds();
        setKodAdimi(false);
        loadData(true);
      })
      .catch(() => { setAuthChecking(false); setAuthError("Bağlantı hatası. Tekrar dene."); });
  };

  /** Adım 2: e-postaya gelen kod doğrulanır ve oturum açılır. */
  const handleKodSubmit = (pw, kod, hatirla) => {
    setAuthChecking(true);
    setAuthError("");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authAction: "kodDogrula", sifre: pw, kod, hatirla: !!hatirla }),
    })
      .then((r) => r.json().then((res) => ({ ok: r.ok, res })))
      .then(({ ok, res }) => {
        setAuthChecking(false);
        if (!ok) { setAuthError(res.error || "Kod doğrulanamadı."); return; }
        setOturum(res.token, res.sure);
        clearStaffCreds();
        clearMusteriCreds();
        setKodAdimi(false);
        loadData(true);
      })
      .catch(() => { setAuthChecking(false); setAuthError("Bağlantı hatası. Tekrar dene."); });
  };
  const handleStaffAuthSubmit = (kullaniciAdi, sifre) => {
    clearOturum();
    setStaffCreds(kullaniciAdi, sifre);
    loadData(true);
  };
  const handleMusteriAuthSubmit = (kullaniciAdi, sifre) => {
    clearOturum();
    clearStaffCreds();
    setMusteriBlockedMsg("");
    setMusteriCreds(kullaniciAdi, sifre);
    loadData(true);
  };

  useEffect(() => {
    if (!data) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ data, _v: data._v }) })
        .then(async (r) => {
          if (r.status === 409) {
            const res = await r.json();
            if (res.staleConflict) {
              // Başka bir cihaz/sekme araya girmiş — bu değişikliği ZORLA üzerine yazmak yerine
              // (bu tam da önlemeye çalıştığımız veri kaybı senaryosu), önce sunucudaki en
              // güncel veriyi çekip kullanıcıyı bilgilendiriyoruz. Az önceki değişikliği
              // kaybetmiş olabilir, tekrar uygulaması gerekebilir — ama en azından ARADA
              // BAŞKASININ yaptığı değişiklikler kaybolmuyor.
              setSaveStatus("error");
              setStaleConflictMsg("Az önce başka bir cihazdan/sekmeden değişiklik yapılmış. En güncel veri çekildi — az önceki değişikliğini kontrol edip gerekirse tekrar uygula.");
              skipNextSave.current = true;
              fetch("/api/data", { headers: authHeaders() })
                .then((r2) => r2.json())
                .then((res2) => { if (res2.data) setData(res2.data); })
                .catch(() => {});
              return;
            }
            setSaveStatus("error");
            setSaveBlocked({ ...res, dataToForce: data });
            return;
          }
          if (!r.ok) { setSaveStatus("error"); return; }
          const res = await r.json();
          if (typeof res._v === "number") { skipNextSave.current = true; setData((d) => ({ ...d, _v: res._v })); }
          setSaveStatus("saved");
          setLastSavedAt(new Date());
        })
        .catch(() => setSaveStatus("error"));
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line
  }, [data]);

  // KAYDEDİLMEMİŞ DEĞİŞİKLİK KORUMASI: kayıt 500ms gecikmeli gönderiliyor ve gönderim
  // birkaç yüz milisaniye sürüyor. Tam o aralıkta sekme kapatılırsa değişiklik sessizce
  // kayboluyordu. Artık tarayıcı "bu sayfadan ayrılmak istediğine emin misin?" diye sorar.
  useEffect(() => {
    const uyar = (e) => {
      if (!saveTimer.current && saveStatusRef.current !== "saving") return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, []);

  const openAi = (q) => { setAiQuestion(q || null); setAiOpen(true); };

  const openTeblig = (client, months, toplam) => {
    const bugun = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const text = renderTeblig(data.tebligSablonu, {
      musteri: client.ad,
      aylikUcret: fmt(client.aylikUcret),
      ay: months,
      toplamBakiye: fmt(toplam),
      firma: data.firmaAdi || "Marcus Medya",
      tarih: bugun,
    });
    setTebligOpen({ client, text });
  };

  const forceSave = () => {
    if (!saveBlocked) return;
    const payload = saveBlocked.dataToForce;
    fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ data: payload, force: true }) })
      .then(async (r) => {
        if (r.ok) {
          const res = await r.json();
          if (typeof res._v === "number") { skipNextSave.current = true; setData((d) => ({ ...d, _v: res._v })); }
          setSaveStatus("saved"); setLastSavedAt(new Date());
        } else { setSaveStatus("error"); }
      })
      .catch(() => setSaveStatus("error"))
      .finally(() => setSaveBlocked(null));
  };

  // ---- CRUD handlers ----
  /** Yeni bir marka eklendiğinde otomatik olarak açılan markalaşma görev şablonu. */
  const MARKALASMA_SABLON = [
    "Instagram sayfası açıldı",
    "Instagram profil fotoğrafı kondu",
    "Instagram öne çıkanlar (highlights) hazırlandı",
    "Instagram profil biyografisi tamamlandı",
    "Facebook sayfası açıldı",
    "Meta Business Suite bağlantısı yapıldı",
    "Google İşletme Profili (konum) açıldı",
  ];

  const addClient = (c) => setData((d) => {
    const yeniClient = { ...c, maliyetler: [], odemeler: [], id: nextId(d.clients) };
    const yeniSurec = {
      id: nextId(d.markalasmaSurecleri || []),
      clientId: yeniClient.id,
      marka: yeniClient.ad,
      yonetici: "",
      olusturmaTarihi: new Date().toLocaleDateString("tr-TR"),
      gorevler: MARKALASMA_SABLON.map((ad, i) => ({ id: i + 1, ad, tamamlandi: false, tamamlanmaTarihi: null })),
    };
    return { ...d, clients: [...d.clients, yeniClient], markalasmaSurecleri: [...(d.markalasmaSurecleri || []), yeniSurec] };
  });
  const updateClient = (id, patch) => setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const deleteClient = (id) => {
    setData((d) => ({ ...d, clients: d.clients.filter((c) => c.id !== id) }));
    // Silinen markaya bağlı Müşteri Paneli giriş hesabı varsa, o da otomatik kapatılır —
    // aksi halde silinen bir müşterinin giriş bilgisi hâlâ geçerli kalırdı.
    // Not: bu uç nokta sadece yöneticide çalışır. Personel bir müşteri silerse burada
    // bir şey olmaz — ama sunucudaki ortak yazma katmanı her kayıtta yetim müşteri
    // hesaplarını zaten otomatik temizliyor, yani hesap yine de kapanır.
    fetch("/api/manage-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ hesapTuru: "musteri", action: "silByClientId", clientId: id }),
    }).catch(() => {}); // sessizce geç — asıl müşteri silme işlemi zaten tamamlandı
  };

  const addClientCost = (clientId, cost) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, maliyetler: [...(c.maliyetler || []), { ...cost, id: nextId(c.maliyetler || []) }] } : c)),
  }));
  const deleteClientCost = (clientId, costId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, maliyetler: (c.maliyetler || []).filter((m) => m.id !== costId) } : c)),
  }));

  const markClientPaid = (clientId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, odemeler: [...(c.odemeler || []).filter((m) => m !== monthKey()), monthKey()] } : c)),
  }));
  const markClientUnpaid = (clientId) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, odemeler: (c.odemeler || []).filter((m) => m !== monthKey()) } : c)),
  }));

  /** Sunucu tarafında zaten kaydedilmiş bir müşteri güncellemesini, tüm veriyi yeniden yazıp
   * olası eski/bayat verilerin üzerine yazma riski oluşturmadan yerel duruma yansıtır. */
  const mergeClientLocally = (guncelClient) => {
    skipNextSave.current = true;
    setData((d) => ({ ...d, clients: (d.clients || []).map((c) => (c.id === guncelClient.id ? guncelClient : c)) }));
  };

  const addOdemeKaydi = (clientId, kayit) => {
    fetch("/api/client-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "addKaydi", clientId, kayit }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.ok && res.client) mergeClientLocally(res.client); else if (res.error) window.alert(res.error); })
      .catch(() => window.alert("Bağlantı hatası — ödeme kaydedilemedi, tekrar dene."));
  };
  const deleteOdemeKaydi = (clientId, kayitId) => {
    fetch("/api/client-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "deleteKaydi", clientId, kayitId }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.ok && res.client) mergeClientLocally(res.client); else if (res.error) window.alert(res.error); })
      .catch(() => window.alert("Bağlantı hatası — silinemedi, tekrar dene."));
  };
  const setOdemeGunuSafe = (clientId, odemeGunu) => {
    fetch("/api/client-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "setOdemeGunu", clientId, odemeGunu }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.ok && res.client) mergeClientLocally(res.client); else if (res.error) window.alert(res.error); })
      .catch(() => window.alert("Bağlantı hatası — kaydedilemedi, tekrar dene."));
  };

  /** Operasyon > Aylık İş Raporu'ndaki iş başı ücretler. SADECE yöneticiye ait bir veri:
   * sunucudaki personel izin listesinde (PERMISSION_DATA_FIELDS) yer almadığı için
   * personelin tarayıcısına hiç gönderilmiyor ve personel tarafından yazılamıyor. */
  const setIsUcreti = (ad, tutar) => setData((d) => {
    const mevcut = { ...(d.isUcretleri || {}) };
    if (!tutar) delete mevcut[ad]; else mevcut[ad] = tutar;
    return { ...d, isUcretleri: mevcut };
  });

  /** AVANS: maaşın/hak edişin erken ödenmiş kısmı. Toplam Gider'e AYRICA eklenmez
   * (maaş zaten sayılıyor, eklenseydi çift sayma olurdu); etkisi (1) o ayın ödemesinden
   * düşülmesi, (2) çıktığı hesabın bakiyesinden azaltılmasıdır. */
  const addAvans = (kayit) => setData((d) => ({
    ...d,
    avanslar: [...(d.avanslar || []), { ...kayit, id: nextId(d.avanslar || []) }],
  }));
  const deleteAvans = (id) => setData((d) => ({ ...d, avanslar: (d.avanslar || []).filter((a) => a.id !== id) }));

  /** MAAŞ / HAK EDİŞ ÖDEMESİ. Avans gibi, Toplam Gider'i DEĞİŞTİRMEZ (maaş ve müşteri
   * maliyetleri zaten gider olarak sayılıyor); işi "ödendi mi, ne kadar kaldı" takibi ve
   * ödemenin çıktığı hesabın bakiyesini azaltmaktır. */
  const addPersonelOdeme = (kayit) => setData((d) => ({
    ...d,
    personelOdemeleri: [...(d.personelOdemeleri || []), { ...kayit, id: nextId(d.personelOdemeleri || []) }],
  }));
  const deletePersonelOdeme = (id) => setData((d) => ({ ...d, personelOdemeleri: (d.personelOdemeleri || []).filter((o) => o.id !== id) }));

  const addFreelancer = (f) => setData((d) => ({ ...d, freelancerlar: [...(d.freelancerlar || []), { ...f, id: nextId(d.freelancerlar || []) }] }));
  const updateFreelancer = (id, patch) => setData((d) => ({ ...d, freelancerlar: (d.freelancerlar || []).map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const deleteFreelancer = (id) => setData((d) => ({ ...d, freelancerlar: (d.freelancerlar || []).filter((f) => f.id !== id) }));

  /** İş bazlı ücretlendirme (sabit tutar / ücretsiz). İş kayıtları personelin tarayıcısına
   * olduğu gibi gönderildiği için, bu bilgi işin ÜZERİNDE değil ayrı bir haritada tutulur —
   * böylece ücretler personele hiç ulaşmıyor. detay null verilirse varsayılana döner. */
  const setIsUcretDetayi = (jobId, detay) => setData((d) => {
    const mevcut = { ...(d.isUcretDetaylari || {}) };
    if (!detay) delete mevcut[jobId]; else mevcut[jobId] = detay;
    return { ...d, isUcretDetaylari: mevcut };
  });

  const saveTeklif = (teklif) => setData((d) => ({ ...d, teklifler: [...(d.teklifler || []), teklif] }));
  const saveSablon = (ad, secimler) => setData((d) => ({ ...d, teklifSablonlari: [...(d.teklifSablonlari || []), { id: nextId(d.teklifSablonlari || []), ad, secimler }] }));
  const deleteSozlesmeSablonu = (id) => setData((d) => ({ ...d, sozlesmeSablonlari: (d.sozlesmeSablonlari || []).filter((s) => s.id !== id) }));
  const saveSozlesmeSablonu = (ad, metin) => setData((d) => ({ ...d, sozlesmeSablonlari: [...(d.sozlesmeSablonlari || []), { id: nextId(d.sozlesmeSablonlari || []), ad, metin }] }));
  const saveMarkaKimligi = (gorsel) => setData((d) => ({ ...d, markaKimligiGorseli: gorsel }));
  const updateStaffPermissions = (perms) => setData((d) => ({ ...d, staffPermissions: perms }));

  const updateMusteriGiris = (clientId, platform, field, value) => setData((d) => {
    const mevcut = d.musteriGirisleri || {};
    const clientData = mevcut[clientId] || {};
    const platformData = clientData[platform] || {};
    return { ...d, musteriGirisleri: { ...mevcut, [clientId]: { ...clientData, [platform]: { ...platformData, [field]: value } } } };
  });

  const addCekimIsi = (job) => {
    setData((d) => ({ ...d, cekimIsleri: [...(d.cekimIsleri || []), { ...job, id: nextId(d.cekimIsleri || []), asama: job.kategori === "Grafik Tasarım" ? "Talep Alındı" : "Çekim Planlandı", yorumlar: [], gecmis: [{ id: nextId([]), tarih: new Date().toLocaleString("tr-TR"), yazan: "Yönetici", aciklama: "İş oluşturuldu" }] }] }));

    // Atanan kişi kayıtlı bir personelse ve e-postası varsa, iş atandığını bildiren bir e-posta gönder.
    // Türkçe İ/I/ı/i karakterleri normal .toLowerCase() ile yanlış eşleşebildiği için "tr" yerel ayarı kullanılıyor.
    const trKucult = (s) => (s || "").trim().toLocaleLowerCase("tr");
    const atananlar = [job.kameraman, job.editor].filter(Boolean);
    const roster = data.personelRosteri || [];
    atananlar.forEach((ad) => {
      const kisi = roster.find((p) => trKucult(p.ad) === trKucult(ad));
      if (!kisi) return; // kayıtlı personel değil (serbest metin yazılmış olabilir) — sessizce geç
      if (!kisi.email) { window.alert(`${kisi.ad} için kayıtlı bir e-posta yok — Ayarlar > Personel Hesapları'ndan ekleyebilirsin.`); return; }
      fetch("/api/notify-job", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: kisi.email, ad: kisi.ad, marka: job.marka, icerikTuru: job.icerikTuru, teslimTarihi: job.teslimTarihi, firmaAdi: data.firmaAdi }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.skipped) window.alert(`${kisi.ad} için bildirim e-postası gönderilemedi: ${res.reason}`);
          else if (res.error) window.alert(`${kisi.ad} için bildirim e-postası gönderilemedi: ${res.error}`);
        })
        .catch(() => window.alert(`${kisi.ad} için bildirim e-postası gönderilirken bağlantı hatası oluştu.`));
    });
  };
  const updateCekimIsi = (id, patch) => setData((d) => {
    const eskiIs = (d.cekimIsleri || []).find((j) => j.id === id);
    const yeniIsler = (d.cekimIsleri || []).map((j) => (j.id === id ? { ...j, ...patch } : j));
    let musteriIcerikleri = d.musteriIcerikleri || [];
    // "Kontrol Bekliyor" aşamasına YENİ geçildiyse (önceden başka bir aşamadaysa), otomatik
    // olarak müşteri panelinde onay bekleyen bir kayıt oluşturulur — CEO ekstra bir şey
    // yapmadan, iş bu aşamaya gelince müşteri direkt görebilsin diye.
    if (patch.asama === "Kontrol Bekliyor" && eskiIs && eskiIs.asama !== "Kontrol Bekliyor") {
      const musteri = (d.clients || []).find((c) => c.ad === eskiIs.marka);
      const dosyaLinki = eskiIs.editliDosyaLink || patch.editliDosyaLink || eskiIs.hamDosyaLink || patch.hamDosyaLink || "";
      if (musteri && dosyaLinki) {
        const zatenVarMi = musteriIcerikleri.some((i) => i.kaynakIsId === id && i.durum === "bekliyor");
        if (!zatenVarMi) {
          musteriIcerikleri = [...musteriIcerikleri, {
            id: nextId(musteriIcerikleri),
            clientId: musteri.id,
            tur: (eskiIs.kategori === "Grafik Tasarım" ? "gorsel" : "video"),
            driveLinki: dosyaLinki,
            gorselUrl: null,
            aciklama: eskiIs.icerikTuru || "",
            tarih: new Date().toLocaleDateString("tr-TR"),
            durum: "bekliyor",
            revizeNotu: null,
            kaynakIsId: id,
            olusturmaTarihi: new Date().toLocaleDateString("tr-TR"),
          }];
        }
      }
    }
    return { ...d, cekimIsleri: yeniIsler, musteriIcerikleri };
  });
  const deleteCekimIsi = (id) => setData((d) => ({ ...d, cekimIsleri: (d.cekimIsleri || []).filter((j) => j.id !== id) }));
  const deleteSablon = (id) => setData((d) => ({ ...d, teklifSablonlari: (d.teklifSablonlari || []).filter((s) => s.id !== id) }));

  const toggleMarkalasmaGorev = (surecId, gorevId) => setData((d) => ({
    ...d,
    markalasmaSurecleri: (d.markalasmaSurecleri || []).map((s) => (s.id !== surecId ? s : {
      ...s,
      gorevler: s.gorevler.map((g) => (g.id === gorevId ? { ...g, tamamlandi: !g.tamamlandi, tamamlanmaTarihi: !g.tamamlandi ? new Date().toLocaleDateString("tr-TR") : null } : g)),
    })),
  }));

  const setMarkalasmaYonetici = (surecId, yonetici) => new Promise((resolve) => {
    setData((d) => ({ ...d, markalasmaSurecleri: (d.markalasmaSurecleri || []).map((s) => (s.id === surecId ? { ...s, yonetici } : s)) }));
    if (!yonetici) { resolve({ mailGitti: false, mesaj: null }); return; }
    const surec = (data.markalasmaSurecleri || []).find((s) => s.id === surecId);
    const roster = data.personelRosteri || [];
    const kisi = roster.find((p) => p.ad.trim().toLocaleLowerCase("tr") === yonetici.trim().toLocaleLowerCase("tr"));
    if (!kisi) { resolve({ mailGitti: false, mesaj: "Kayıtlı personel bulunamadı, bildirim e-postası gönderilmedi." }); return; }
    if (!kisi.email) { resolve({ mailGitti: false, mesaj: `${kisi.ad} için kayıtlı bir e-posta yok — bildirim gönderilmedi.` }); return; }
    fetch("/api/notify-job", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: kisi.email, ad: kisi.ad, marka: surec ? surec.marka : "", icerikTuru: "Markalaşma Süreci Yönetimi", teslimTarihi: "", firmaAdi: data.firmaAdi }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) resolve({ mailGitti: true, mesaj: `${kisi.ad} adresine bildirim e-postası gönderildi.` });
        else resolve({ mailGitti: false, mesaj: res.reason || res.error || "Bildirim e-postası gönderilemedi." });
      })
      .catch(() => resolve({ mailGitti: false, mesaj: "Bağlantı hatası — bildirim e-postası gönderilemedi." }));
  });

  const addMarkalasmaGorev = (surecId, ad) => setData((d) => ({
    ...d,
    markalasmaSurecleri: (d.markalasmaSurecleri || []).map((s) => (s.id !== surecId ? s : {
      ...s,
      gorevler: [...s.gorevler, { id: nextId(s.gorevler), ad, tamamlandi: false, tamamlanmaTarihi: null }],
    })),
  }));

  const tamamlaMarkalasmaSureci = (surecId) => setData((d) => ({
    ...d,
    markalasmaSurecleri: (d.markalasmaSurecleri || []).map((s) => (s.id === surecId ? { ...s, tamTamamlandi: true, tamamlanmaTarihi: new Date().toLocaleDateString("tr-TR") } : s)),
  }));

  const deleteMarkalasmaSureci = (surecId) => setData((d) => ({ ...d, markalasmaSurecleri: (d.markalasmaSurecleri || []).filter((s) => s.id !== surecId) }));

  const addMusteriIcerik = (clientId, icerik) => setData((d) => ({
    ...d,
    musteriIcerikleri: [...(d.musteriIcerikleri || []), { ...icerik, id: nextId(d.musteriIcerikleri || []), clientId, durum: "bekliyor", revizeNotu: null, kaynakIsId: null, olusturmaTarihi: new Date().toLocaleDateString("tr-TR") }],
  }));
  /** İçerik / çekim planı düzenleme. clientId, id ve kaynakIsId bilerek KORUNUR — düzenleme
   * kaydı başka bir markaya taşımamalı ya da Operasyon bağlantısını koparmamalı. */
  const updateMusteriIcerik = (icerikId, patch) => setData((d) => ({
    ...d,
    musteriIcerikleri: (d.musteriIcerikleri || []).map((i) => (
      i.id === icerikId ? { ...i, ...patch, id: i.id, clientId: i.clientId, kaynakIsId: i.kaynakIsId } : i
    )),
  }));
  const deleteMusteriIcerik = (icerikId) => setData((d) => ({ ...d, musteriIcerikleri: (d.musteriIcerikleri || []).filter((i) => i.id !== icerikId) }));

  const addUyelik = (u) => paylasimIstek({ action: "uyelikEkle", uyelik: u }, "Bağlantı hatası — üyelik eklenemedi, tekrar dene.");
  const deleteUyelik = (id) => paylasimIstek({ action: "uyelikSil", uyelikId: id }, "Bağlantı hatası — üyelik silinemedi, tekrar dene.");

  const addKisiselSifre = (s) => setData((d) => ({ ...d, ownerKisiselSifreler: [...(d.ownerKisiselSifreler || []), { ...s, id: nextId(d.ownerKisiselSifreler || []) }] }));
  const updateKisiselSifre = (id, patch) => setData((d) => ({ ...d, ownerKisiselSifreler: (d.ownerKisiselSifreler || []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const deleteKisiselSifre = (id) => setData((d) => ({ ...d, ownerKisiselSifreler: (d.ownerKisiselSifreler || []).filter((s) => s.id !== id) }));
  const updateUyelik = (id, patch) => paylasimIstek({ action: "uyelikGuncelle", uyelikId: id, patch }, "Bağlantı hatası — üyelik güncellenemedi, tekrar dene.");

  const addReklam = (r) => setData((d) => ({ ...d, reklamlar: [...(d.reklamlar || []), { ...r, id: nextId(d.reklamlar || []) }] }));
  const updateReklam = (id, patch) => setData((d) => ({ ...d, reklamlar: (d.reklamlar || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const deleteReklam = (id) => setData((d) => ({ ...d, reklamlar: (d.reklamlar || []).filter((r) => r.id !== id) }));

  /** Sunucu tarafında zaten kaydedilmiş bir paylaşım/stok güncellemesini, tüm veriyi yeniden
   * yazıp olası eski/bayat verilerin üzerine yazma riski oluşturmadan yerel duruma yansıtır. */
  /** Personel Hesapları listesini (isim/e-posta) sunucudan tazeler — "Yeni İş" formu her
   * açıldığında çağrılır, böylece Ayarlar'da az önce eklenen biri hemen listede görünür. */
  const refreshPersonelRosteri = () => {
    fetch("/api/data", { headers: authHeaders() })
      .then((r) => r.json())
      .then((res) => {
        // Boş/geçersiz bir yanıt mevcut (iyi çalışan) listeyi asla silmesin.
        if (res.data && Array.isArray(res.data.personelRosteri) && res.data.personelRosteri.length > 0) {
          skipNextSave.current = true;
          setData((d) => ({ ...d, personelRosteri: res.data.personelRosteri }));
        }
      })
      .catch(() => {});
  };

  const mergePaylasimLocally = (patch) => {
    skipNextSave.current = true;
    setData((d) => ({ ...d, ...patch }));
  };
  const paylasimIstek = (body, hataMesaji) => {
    fetch("/api/paylasim", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((res) => { if (res.ok) mergePaylasimLocally(res); else if (res.error) window.alert(res.error); })
      .catch(() => window.alert(hataMesaji));
  };

  const degistirStok = (clientId, marka, tur, delta) => paylasimIstek({ action: "stokDegistir", clientId, tur, delta }, "Bağlantı hatası — stok güncellenemedi, tekrar dene.");

  const toggleGunlukKontrol = (clientId, tur) => paylasimIstek({ action: "gunlukToggle", clientId, tur }, "Bağlantı hatası — işaretlenemedi, tekrar dene.");

  const addHaftalikPlan = (clientId, gun, haftaKey, tur) => paylasimIstek({ action: "haftalikEkle", clientId, gun, haftaKey, tur }, "Bağlantı hatası — plan eklenemedi, tekrar dene.");
  /** Planlanan paylaşımın alt metni (caption) — müşteri panelinde gösterilir. */
  const setPlanAltMetin = (planId, altMetin) => paylasimIstek({ action: "haftalikAltMetin", planId, altMetin }, "Bağlantı hatası — alt metin kaydedilemedi, tekrar dene.");
  const toggleHaftalikYapildi = (planId) => paylasimIstek({ action: "haftalikToggle", planId }, "Bağlantı hatası — işaretlenemedi, tekrar dene.");
  const deleteHaftalikPlan = (planId) => paylasimIstek({ action: "haftalikSil", planId }, "Bağlantı hatası — silinemedi, tekrar dene.");

  const addSube = (clientId, ad) => paylasimIstek({ action: "subeEkle", clientId, ad }, "Bağlantı hatası — şube eklenemedi, tekrar dene.");
  const deleteSube = (subeId) => paylasimIstek({ action: "subeSil", subeId }, "Bağlantı hatası — şube silinemedi, tekrar dene.");
  const subeStokDegistir = (clientId, subeId, tur, delta) => paylasimIstek({ action: "subeStokDegistir", clientId, subeId, tur, delta }, "Bağlantı hatası — stok güncellenemedi, tekrar dene.");

  const addHesap = (ad) => setData((d) => ({ ...d, hesaplar: [...(d.hesaplar && d.hesaplar.length ? d.hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }]), { id: `hesap_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ad }] }));
  const deleteHesap = (hesapId) => setData((d) => ({ ...d, hesaplar: (d.hesaplar || []).filter((h) => h.id !== hesapId) }));
  const updateHesap = (hesapId, patch) => setData((d) => {
    const liste = d.hesaplar && d.hesaplar.length ? d.hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
    return { ...d, hesaplar: liste.map((h) => (h.id === hesapId ? { ...h, ...patch } : h)) };
  });
  /** Elle bakiye düzeltmesi. Bakiye sabit bir sayı olarak saklanmaz; elle girilen rakam
   * mevcut bakiyeyle arasındaki FARK olarak buraya yazılır. Böylece ekranda tam yazdığın
   * rakam görünür ama hiçbir hareket kaybolmaz ve düzeltme geri alınabilir. */
  const addHesapDuzeltme = (kayit) => setData((d) => ({
    ...d,
    hesapDuzeltmeleri: [...(d.hesapDuzeltmeleri || []), { ...kayit, id: nextId(d.hesapDuzeltmeleri || []) }],
  }));
  const deleteHesapDuzeltme = (id) => setData((d) => ({ ...d, hesapDuzeltmeleri: (d.hesapDuzeltmeleri || []).filter((x) => x.id !== id) }));
  /** Hesaplar arası para aktarımı. Hedef hesap artık serbest — eskiden hedef her zaman
   * ana hesaba sabitlenmişti, bu yüzden ana hesaptan geri aktarmanın ya da iki alt hesap
   * arasında aktarmanın hiçbir yolu yoktu. Tutar da artık kısmi olabiliyor. */
  const transferEt = (kaynakHesapId, hedefHesapId, tutar) => setData((d) => {
    const liste = d.hesaplar && d.hesaplar.length ? d.hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
    const anaHesap = liste.find((h) => h.anaHesap) || liste[0];
    const transferler = d.hesapTransferleri || [];
    // Geriye dönük uyum: eski çağrı biçimiyle (kaynak, tutar) gelirse hedef ana hesaptır.
    const hedef = (typeof tutar === "undefined") ? anaHesap.id : hedefHesapId;
    const miktar = (typeof tutar === "undefined") ? hedefHesapId : tutar;
    const yeniTransfer = { id: nextId(transferler), kaynakHesapId, hedefHesapId: hedef, tutar: Number(miktar) || 0, tarih: new Date().toLocaleDateString("tr-TR") };
    return { ...d, hesaplar: liste, hesapTransferleri: [...transferler, yeniTransfer] };
  });

  /** Yanlış yapılan bir aktarımı geri alır — kayıt silinince bakiyeler kendiliğinden
   * eski haline döner (bakiye her zaman transfer kayıtlarından hesaplanıyor). */
  const deleteTransfer = (transferId) => setData((d) => ({
    ...d,
    hesapTransferleri: (d.hesapTransferleri || []).filter((t) => t.id !== transferId),
  }));

  const toggleMonthPaid = (clientId, monthKeyStr, action) => setData((d) => ({
    ...d,
    clients: d.clients.map((c) => {
      if (c.id !== clientId) return c;
      const mevcut = c.odemeler || [];
      const yeni = action === "ekle" ? [...mevcut.filter((m) => m !== monthKeyStr), monthKeyStr] : mevcut.filter((m) => m !== monthKeyStr);
      return { ...c, odemeler: yeni };
    }),
  }));

  const addGelir = (g) => setData((d) => ({ ...d, gelirKalemleri: [...d.gelirKalemleri, { ...g, id: nextId(d.gelirKalemleri) }] }));
  const deleteGelir = (id) => setData((d) => ({ ...d, gelirKalemleri: d.gelirKalemleri.filter((g) => g.id !== id) }));

  const addGider = (g) => setData((d) => ({ ...d, giderKalemleri: [...d.giderKalemleri, { ...g, id: nextId(d.giderKalemleri) }] }));
  const deleteGider = (id) => setData((d) => ({ ...d, giderKalemleri: d.giderKalemleri.filter((g) => g.id !== id) }));

  const addOfisGider = (g) => setData((d) => ({ ...d, ofisGiderleri: [...(d.ofisGiderleri || []), { ...g, id: nextId(d.ofisGiderleri || []) }] }));
  const deleteOfisGider = (id) => setData((d) => ({ ...d, ofisGiderleri: (d.ofisGiderleri || []).filter((g) => g.id !== id) }));

  const addBekleyen = (b) => setData((d) => ({ ...d, bekleyenTahsilatlar: [...d.bekleyenTahsilatlar, { ...b, id: nextId(d.bekleyenTahsilatlar) }] }));
  const deleteBekleyen = (id) => setData((d) => ({ ...d, bekleyenTahsilatlar: d.bekleyenTahsilatlar.filter((b) => b.id !== id) }));

  const addVergi = (v) => setData((d) => ({ ...d, vergiTakvimi: [...d.vergiTakvimi, { ...v, id: nextId(d.vergiTakvimi) }] }));
  const deleteVergi = (id) => setData((d) => ({ ...d, vergiTakvimi: d.vergiTakvimi.filter((v) => v.id !== id) }));

  const addMonth = (m) => setData((d) => ({ ...d, monthly: [...d.monthly, { ...m, net: (Number(m.ciro) || 0) - (Number(m.gider) || 0), id: nextId(d.monthly) }] }));
  const deleteMonth = (id) => setData((d) => ({ ...d, monthly: d.monthly.filter((m) => m.id !== id) }));

  const addPersonel = (p) => setData((d) => ({ ...d, personel: [...(d.personel || []), { ...p, id: nextId(d.personel || []) }] }));
  const updatePersonel = (id, patch) => setData((d) => ({ ...d, personel: (d.personel || []).map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const deletePersonel = (id) => setData((d) => ({ ...d, personel: (d.personel || []).filter((p) => p.id !== id) }));

  const addFon = (f) => setData((d) => ({ ...d, birikimler: [...(d.birikimler || []), { ...f, bakiye: 0, hareketler: [], id: nextId(d.birikimler || []) }] }));
  const deleteFon = (id) => setData((d) => ({ ...d, birikimler: (d.birikimler || []).filter((f) => f.id !== id) }));
  /** Planım — kişisel notlar. Sadece yöneticiye ait; sunucudaki personel izin listesinde
   * yer almadığı için personelin tarayıcısına hiç gönderilmez. */
  const addGorev = (g) => setData((d) => ({ ...d, kisiselGorevler: [...(d.kisiselGorevler || []), { ...g, id: nextId(d.kisiselGorevler || []) }] }));
  const updateGorev = (id, patch) => setData((d) => ({ ...d, kisiselGorevler: (d.kisiselGorevler || []).map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const deleteGorev = (id) => setData((d) => ({ ...d, kisiselGorevler: (d.kisiselGorevler || []).filter((g) => g.id !== id) }));

  const addFonHareket = (fonId, tip, tutar, not, tarih) => setData((d) => ({
    ...d,
    birikimler: (d.birikimler || []).map((f) => {
      if (f.id !== fonId) return f;
      const miktar = Number(tutar) || 0;
      const delta = tip === "ekleme" ? miktar : -miktar;
      const hareket = { id: nextId(f.hareketler || []), tip, tutar: miktar, tarih: tarih || bugunISOTarih(), not: not || "" };
      return { ...f, bakiye: (f.bakiye || 0) + delta, hareketler: [...(f.hareketler || []), hareket] };
    }),
  }));
  const deleteFonHareket = (fonId, hareketId) => setData((d) => ({
    ...d,
    birikimler: (d.birikimler || []).map((f) => {
      if (f.id !== fonId) return f;
      const h = (f.hareketler || []).find((x) => x.id === hareketId);
      if (!h) return f;
      const delta = h.tip === "ekleme" ? -h.tutar : h.tutar;
      return { ...f, bakiye: (f.bakiye || 0) + delta, hareketler: (f.hareketler || []).filter((x) => x.id !== hareketId) };
    }),
  }));

  const closeMonth = () => setData((d) => {
    const live = computeLive(d);
    const ayAdi = new Date().toLocaleDateString("tr-TR", { month: "short" });
    const newMonthly = [...d.monthly, { id: nextId(d.monthly), ay: ayAdi, yil: new Date().getFullYear(), ciro: live.ciro, gider: live.gider, net: live.net }];
    return {
      ...d,
      monthly: newMonthly,
      gelirKalemleri: d.gelirKalemleri.filter((g) => g.tekrar !== "tek seferlik"),
      giderKalemleri: d.giderKalemleri.filter((g) => g.tekrar !== "tek seferlik"),
    };
  });

  const exportCsv = () => {
    const live = computeLive(data);
    const hesapListesi = data.hesaplar && data.hesaplar.length ? data.hesaplar : [{ id: "ana", ad: "Marcus Medya", anaHesap: true }];
    const rows = [
      ["MARCUS OS - FİNANS RAPORU", new Date().toLocaleDateString("tr-TR")],
      [],
      ["Bu Ayın Özeti"],
      ["Toplam Ciro", live.ciro], ["Toplam Gider", live.gider], ["Net Kazanç", live.net], ["Kâr Marjı %", live.karMarji],
      ["Faturalı Ciro (KDV Hariç)", live.faturaliCiro], ["Faturasız Ciro", live.faturasizCiro],
      ["KDV Tutarı (%20)", live.kdvTutari], ["Faturalı Ciro (KDV Dahil)", live.faturaliKdvDahil], ["Ciro (KDV Dahil Toplam)", live.kdvDahilToplamCiro],
      [],
      ["Hesap Bakiyeleri", "Bakiye"],
      ...hesapListesi.map((h) => [h.ad + (h.anaHesap ? " (Ana Hesap)" : ""), hesapBakiyesi(h.id, { clients: data.clients, transferler: data.hesapTransferleri, avanslar: data.avanslar, odemeler: data.personelOdemeleri, hesaplar: hesapListesi, duzeltmeler: data.hesapDuzeltmeleri })]),
      [],
      ["Şubeler", "Marka"],
      ...(data.subeler || []).map((s) => { const c = data.clients.find((x) => x.id === s.clientId); return [s.ad, c ? c.ad : ""]; }),
      [],
      ["Personel", "Pozisyon", "Maaş", "SGK/Sigorta", "Yemek", "Tazminat Birikimi", "Aylık Toplam"],
      ...(data.personel || []).map((p) => [p.ad, p.pozisyon, p.maas, p.sigorta, p.yemek || 0, p.tazminatBirikimi || 0, (Number(p.maas) || 0) + (Number(p.sigorta) || 0) + (Number(p.yemek) || 0) + (Number(p.tazminatBirikimi) || 0)]),
      [],
      ["Personel Hesapları (Giriş)", "Kullanıcı Adı", "E-posta"],
      ...(data.personelRosteri || []).map((p) => [p.ad, "", p.email || ""]),
      [],
      ["Birikim Fonları", "Hedef", "Mevcut Bakiye"],
      ...(data.birikimler || []).map((f) => [f.ad, f.hedefTutar || 0, f.bakiye || 0]),
      [],
      ["Müşteriler", "Kategori", "Durum", "Aylık Ücret", "Kâr Marjı %", "Ödeme Durumu", "Faturalı Tutar"],
      ...data.clients.map((c) => { const st = clientPaymentStatus(c); return [c.ad, c.kategori, c.durum, c.aylikUcret, clientKarMarji(c), st ? st.label : "Takip edilmiyor", clientFaturaliTutar(c)]; }),
      [],
      ["Müşteri Maliyetleri", "Kalem", "Tutar"],
      ...data.clients.flatMap((c) => (c.maliyetler || []).map((m) => [c.ad, m.kalem, m.tutar])),
      [],
      ["Gelir Kalemleri", "Tutar", "Tekrar"],
      ...data.gelirKalemleri.map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Gider Kalemleri", "Tutar", "Tekrar"],
      ...data.giderKalemleri.map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Ofis Giderleri", "Tutar", "Tekrar"],
      ...(data.ofisGiderleri || []).map((g) => [g.kalem, g.tutar, g.tekrar || ""]),
      [],
      ["Bekleyen Tahsilatlar", "Tutar", "Vade"],
      ...data.bekleyenTahsilatlar.map((b) => [b.musteri, b.tutar, b.vade]),
      [],
      ["Geçmiş Aylar", "Yıl", "Ciro", "Gider", "Net"],
      ...data.monthly.map((m) => [m.ay, m.yil || "", m.ciro, m.gider, m.net]),
      [],
      ["Ödeme Kayıtları (Banka Hareketleri)", "Ay", "Tutar", "Hesap", "Tarih", "Not"],
      ...data.clients.flatMap((c) => (c.odemeKayitlari || []).map((k) => [c.ad, k.ay, k.tutar, k.banka || "", k.tarih || "", k.not || ""])),
      [],
      ["Reklamlar", "Marka", "Başlangıç", "Bitiş", "Bütçe", "Not"],
      ...(data.reklamlar || []).map((r) => [r.reklamAdi || "", r.marka || "", r.baslangicTarihi || "", r.bitisTarihi || "", r.butce || 0, r.not || ""]),
      [],
      ["Operasyon İşleri", "Kategori", "İçerik Türü", "Aşama", "Kameraman/Tasarımcı", "Editör", "Teslim Tarihi"],
      ...(data.cekimIsleri || []).map((j) => [j.marka || "", j.kategori || "Video", j.icerikTuru || "", j.asama || "", j.kameraman || "", j.editor || "", j.teslimTarihi || ""]),
      [],
      ["Haftalık Paylaşım Planı", "Hafta", "Gün (0=Pzt)", "Tür", "Yapıldı Mı", "Yapıldığı Tarih"],
      ...(data.haftalikPaylasimlar || []).map((p) => { const c = data.clients.find((x) => x.id === p.clientId); return [c ? c.ad : "", p.haftaKey || "", p.gun, p.tur || "", p.yapildi ? "Evet" : "Hayır", p.yapildigiTarih || ""]; }),
      [],
      ["Kaydedilen Teklifler", "Marka", "Toplam Tutar", "Tarih"],
      ...(data.teklifler || []).map((t) => [(t.musteri && t.musteri.firma) || "", t.toplamFiyat || 0, t.tarih ? new Date(t.tarih).toLocaleDateString("tr-TR") : ""]),
      [],
      ["Markalaşma Süreçleri", "Yönetici", "Tamamlanma", "Durum", "Açıldı", "Tamamlandı"],
      ...(data.markalasmaSurecleri || []).map((s) => {
        const oran = s.gorevler && s.gorevler.length ? Math.round((s.gorevler.filter((g) => g.tamamlandi).length / s.gorevler.length) * 100) : 0;
        return [s.marka || "", s.yonetici || "", `%${oran}`, s.tamTamamlandi ? "Tamamlandı" : "Devam Ediyor", s.olusturmaTarihi || "", s.tamamlanmaTarihi || ""];
      }),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcus-os-finans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const now = new Date().toISOString();
    const payload = { ...data, sonYedekTarihi: now };
    setData(payload);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcus-os-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.clients)) throw new Error("Geçersiz dosya");
        if (!window.confirm("Bu, mevcut tüm verilerinin üzerine yazacak. Devam etmek istiyor musun?")) return;
        setData(parsed);
      } catch (err) {
        window.alert("Dosya okunamadı. Geçerli bir Marcus Medya App yedek dosyası (.json) seçtiğinden emin ol.");
      }
    };
    reader.readAsText(file);
  };

  // Saatlik yedekleme hatırlatıcısı: uygulama açık kaldığı sürece her saat başı,
  // ayrıca sayfa yeni açıldığında son yedek 1 saatten eskiyse birkaç dakika içinde de gösterir.
  useEffect(() => {
    if (!data) return;
    const HOUR = 60 * 60 * 1000;
    const sonYedek = data.sonYedekTarihi ? new Date(data.sonYedekTarihi).getTime() : 0;
    const gecenSure = Date.now() - sonYedek;
    const ilkGosterim = setTimeout(() => setShowBackupReminder(true), gecenSure >= HOUR ? 3 * 60 * 1000 : Math.max(HOUR - gecenSure, 5 * 60 * 1000));
    const interval = setInterval(() => setShowBackupReminder(true), HOUR);
    return () => { clearTimeout(ilkGosterim); clearInterval(interval); };
    // eslint-disable-next-line
  }, [!!data]);

  const notifications = useMemo(() => {
    if (!data || role === "staff" || !data.clients) return [];
    const items = [];
    // Planım'daki kişisel notlar — tarihi geçmiş ve bugüne ait olanlar bildirime düşer,
    // böylece not aldıktan sonra unutulup gitmez.
    const buGun = bugunISOTarih();
    (data.kisiselGorevler || []).filter((g) => !g.tamamlandi && g.tarih).forEach((g) => {
      if (g.tarih < buGun) items.push({ text: `Planım: ${g.baslik} — tarihi geçti (${tarihGoster(g.tarih)})`, level: "danger" });
      else if (g.tarih === buGun) items.push({ text: `Planım: ${g.baslik} — bugün`, level: "warning" });
    });
    // Müşteri Paneli yanıtları — müşteri revize istediyse ya da çekim planı onay bekliyorsa
    // haberin olsun. Eskiden bunun için Müşteri Paneli İçerikleri bölümünü elle açman
    // gerekiyordu, yani revize isteği fark edilmeden bekleyebiliyordu.
    (data.musteriIcerikleri || []).forEach((i) => {
      const marka = ((data.clients || []).find((c) => String(c.id) === String(i.clientId)) || {}).ad || "Müşteri";
      const ad = i.aciklama || (i.tur === "cekim" ? "Çekim planı" : "İçerik");
      if (i.durum === "revize") items.push({ text: `${marka}: "${ad}" için revize istedi${i.revizeNotu ? ` — "${i.revizeNotu}"` : ""}`, level: "danger" });
      else if (i.durum === "bekliyor" && i.tur === "cekim") items.push({ text: `${marka}: "${ad}" çekim planı müşteri onayı bekliyor`, level: "warning" });
    });
    data.clients.filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").forEach((c) => {
      const st = clientPaymentStatus(c);
      if (st && st.status === "gecikti") items.push({ text: `${c.ad}: ödeme ${st.label} — ${fmt(c.aylikUcret)}`, level: "danger" });
      else if (st && st.status === "bekliyor") items.push({ text: `${c.ad}: ${st.label} — ${fmt(c.aylikUcret)}`, level: "warning" });
    });
    data.vergiTakvimi.filter((v) => v.durum === "yaklaşıyor").forEach((v) => items.push({ text: `${v.kalem} — ${tarihGoster(v.tarih)}`, level: "warning" }));
    data.bekleyenTahsilatlar.filter((b) => b.vade.includes("gecikti")).forEach((b) => items.push({ text: `${b.musteri}: bekleyen tahsilat ${b.vade} — ${fmt(b.tutar)}`, level: "danger" }));
    data.bekleyenTahsilatlar.filter((b) => !b.vade.includes("gecikti")).forEach((b) => items.push({ text: `${b.musteri}: bekleyen tahsilat — ${fmt(b.tutar)} (${b.vade})`, level: "warning" }));
    (data.reklamlar || []).forEach((r) => {
      const d = reklamDurumu(r);
      if (d === "bitti") items.push({ text: `${r.marka} — "${r.reklamAdi}" reklamı sona erdi (${r.bitisTarihi})`, level: "danger" });
      else if (d === "yakinda") items.push({ text: `${r.marka} — "${r.reklamAdi}" reklamı yakında bitiyor (${r.bitisTarihi})`, level: "warning" });
    });
    // Marka bazlı stok tükenme tahmini: son 30 gündeki "paylaşıldı" hızına bakıp
    // mevcut stokla kaç gün gideceğini hesaplar, 7 günün altındaysa uyarır.
    const parseTrTarihGunu = (s) => { const [g, a, y] = (s || "").split("."); return g && a && y ? new Date(`${y}-${a}-${g}`) : null; };
    const otuzGunOnce = new Date(); otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
    (data.clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").forEach((c) => {
      ["Görsel", "Video", "Reels", "Story", "Carousel"].forEach((tur) => {
        const stok = (data.stoklar || {})[stokAnahtari(c.id, tur)] || 0;
        if (stok <= 0) return;
        const kullanim = (data.paylasimGecmisi || []).filter((h) => h.clientId === c.id && h.tur === tur && h.tip === "paylasim" && parseTrTarihGunu(h.tarih) && parseTrTarihGunu(h.tarih) >= otuzGunOnce).length;
        if (kullanim === 0) return;
        const gunlukHiz = kullanim / 30;
        const kalanGun = Math.round(stok / gunlukHiz);
        if (kalanGun <= 7) items.push({ text: `${c.ad}: ${tur} stoğu ~${kalanGun} gün içinde bitecek (${stok} adet kaldı)`, level: kalanGun <= 3 ? "danger" : "warning" });
      });
    });
    // Operasyon: teslim tarihi geçmiş ve henüz "Teslim Edildi" aşamasına gelmemiş işler.
    const bugunGeceYarisi = new Date(); bugunGeceYarisi.setHours(0, 0, 0, 0);
    (data.cekimIsleri || []).forEach((j) => {
      if (j.asama === "Teslim Edildi" || !j.teslimTarihi) return;
      const fark = Math.round((new Date(j.teslimTarihi) - bugunGeceYarisi) / 86400000);
      if (fark < 0) items.push({ text: `Operasyon: ${j.marka || ""} — "${j.icerikTuru || j.kategori || "iş"}" teslim tarihi ${Math.abs(fark)} gün geçti (${j.asama || ""})`, level: "danger" });
      else if (fark <= 1) items.push({ text: `Operasyon: ${j.marka || ""} — "${j.icerikTuru || j.kategori || "iş"}" teslimi yaklaşıyor (${j.teslimTarihi})`, level: "warning" });
    });
    return items;
  }, [data, role]);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!data || role === "staff" || !search.trim() || !data.clients) return [];
    const q = search.trim().toLowerCase();
    const results = [];
    data.clients.forEach((c) => { if (c.ad.toLowerCase().includes(q)) results.push({ type: "musteri", label: c.ad, sub: c.kategori, ref: c }); });
    data.gelirKalemleri.forEach((g) => { if (g.kalem.toLowerCase().includes(q)) results.push({ type: "finans", label: g.kalem, sub: "Gelir · " + fmt(g.tutar), ref: g }); });
    data.giderKalemleri.forEach((g) => { if (g.kalem.toLowerCase().includes(q)) results.push({ type: "finans", label: g.kalem, sub: "Gider · " + fmt(g.tutar), ref: g }); });
    (data.personel || []).forEach((p) => { if (p.ad.toLowerCase().includes(q) || (p.pozisyon || "").toLowerCase().includes(q)) results.push({ type: "personel", label: p.ad, sub: p.pozisyon, ref: p }); });
    (data.cekimIsleri || []).forEach((j) => {
      if ((j.marka || "").toLowerCase().includes(q) || (j.icerikTuru || "").toLowerCase().includes(q) || (j.kameraman || "").toLowerCase().includes(q) || (j.editor || "").toLowerCase().includes(q)) {
        results.push({ type: "operasyon", label: `${j.marka || ""} — ${j.icerikTuru || "iş"}`, sub: `${j.kategori || ""} · ${j.asama || ""}`, ref: j });
      }
    });
    (data.markalasmaSurecleri || []).forEach((s) => {
      if ((s.marka || "").toLowerCase().includes(q) || (s.yonetici || "").toLowerCase().includes(q)) {
        results.push({ type: "markalasma", label: s.marka, sub: s.yonetici ? `Yönetici: ${s.yonetici}` : "Yönetici atanmadı", ref: s });
      }
    });
    (data.hesaplar || []).forEach((h) => {
      if ((h.ad || "").toLowerCase().includes(q)) results.push({ type: "hesap", label: h.ad, sub: "Hesap Bakiyesi", ref: h });
    });
    return results.slice(0, 8);
  }, [data, search, role]);

  const goToSearchResult = (r) => {
    setSearch(""); setSearchOpen(false);
    if (r.type === "musteri") { setTab("musteriler"); setDetailClientFromSearch(r.ref); }
    else if (r.type === "personel") setTab("personel");
    else if (r.type === "operasyon") setTab("cekim-edit");
    else if (r.type === "markalasma") setTab("cekim-edit");
    else if (r.type === "hesap") setTab("odeme-takvimi");
    else setTab("finans");
  };

  const titles = { dashboard: "Dashboard", musteriler: "Müşteriler", finans: "Finans", takvim: "Takvim", "odeme-takvimi": "Ödeme Takvimi", teklif: "Teklif & Sözleşme", reklamlar: "Reklamlar", paylasimlar: "Paylaşımlar", "gunluk-kontrol": "Günlük Kontrol", "cekim-listesi": "Çekim", "cekim-edit": "Operasyon", personel: "Personel", birikim: "Birikim", uyelikler: "Üyelikler", "musteri-girisleri": "Şifre Kasası", ayarlar: "Ayarlar" };
  const todayLabel = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  if (needsAuth) {
    return <LockScreen onSubmit={handleAuthSubmit} onKodSubmit={handleKodSubmit} onKodIptal={() => { setKodAdimi(false); setAuthError(""); }} kodAdimi={kodAdimi} onStaffSubmit={handleStaffAuthSubmit} onMusteriSubmit={handleMusteriAuthSubmit} error={authError} checking={authChecking} />;
  }

  if (role === "musteri" && musteriData) {
    return (
      <MusteriPaneli
        musteriData={musteriData}
        onCikis={() => { clearMusteriCreds(); setMusteriData(null); setRole(null); setNeedsAuth(true); }}
        onIslemSonrasi={() => loadData(true)}
      />
    );
  }

  if (musteriBlockedMsg) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ color: T.warning, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Hesap Kullanım Dışı</div>
          <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>{musteriBlockedMsg}</div>
          <button style={saveBtnStyle} onClick={() => { clearMusteriCreds(); setMusteriBlockedMsg(""); setNeedsAuth(true); }}>Giriş Ekranına Dön</button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ color: T.danger, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Verilerine ulaşılamadı</div>
          <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
            Sunucuya bağlanırken bir sorun oluştu. Endişelenme — mevcut verilerinin üzerine hiçbir şey yazılmadı. İnternet bağlantını kontrol edip tekrar dene.
          </div>
          <button style={saveBtnStyle} onClick={() => loadData(false)}>Tekrar Dene</button>
        </div>
      </div>
    );
  }

  if (needsSeedConfirm) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ color: T.warning, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Veritabanında hiçbir kayıt bulunamadı</div>
          <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
            Bunun iki sebebi olabilir: (1) bu gerçekten ilk kurulumun, ya da (2) beklenmedik bir sorun. Emin olana kadar hiçbir şey otomatik yazılmadı.
            <strong style={{ color: T.warning }}> Daha önce veri girdiysen aşağıdaki başlatma butonlarına BASMA</strong> — önce "Tekrar Dene"yi,
            sonra Ayarlar'daki günlük/saatlik yedekleri kontrol et.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button style={cancelBtnStyle} onClick={() => loadData(false)}>Tekrar Dene (bir şey değiştirmeden)</button>
            <button
              style={saveBtnStyle}
              onClick={() => {
                if (!window.confirm("Boş bir sistemle başlanacak. Daha önce veri girdiysen bu işlem yanlış olur — emin misin?")) return;
                skipNextSave.current = false;
                setData(BOS_DATA);
                setNeedsSeedConfirm(false);
              }}
            >
              Evet, ilk kurulum — Boş Başlat
            </button>
            <button
              style={{ ...cancelBtnStyle, fontSize: 12, opacity: 0.75 }}
              onClick={() => {
                if (!window.confirm("Bu, SAHTE örnek müşteriler ve sahte finans rakamları oluşturur. Sadece uygulamayı denemek için kullan. Devam edilsin mi?")) return;
                skipNextSave.current = false;
                setData(DEFAULT_DATA);
                setNeedsSeedConfirm(false);
              }}
            >
              Sadece denemek için: örnek (sahte) verilerle başlat
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <div style={{ color: T.textDim, fontFamily: "Inter, sans-serif", fontSize: 13.5 }}>Marcus Medya App yükleniyor…</div>
      </div>
    );
  }

  if (role === "staff") {
    const izinler = { dashboard: false, musteriler: false, finans: false, takvim: false, odemeTakvimi: false, teklif: false, reklamlar: true, paylasimlar: true, cekimEdit: true, personel: false, birikim: false, cekimListesi: false, sifreKasasi: false, markaYoneticisi: false, uyelikler: false, ...(data.staffPermissions || {}) };
    const staffNavAll = [
      { key: "dashboard", label: "Dashboard", izin: izinler.dashboard },
      { key: "musteriler", label: "Müşteriler", izin: izinler.musteriler },
      { key: "finans", label: "Finans", izin: izinler.finans },
      { key: "takvim", label: "Takvim", izin: izinler.takvim },
      { key: "odeme-takvimi", label: "Ödeme Takvimi", izin: izinler.odemeTakvimi },
      { key: "teklif", label: "Teklif & Sözleşme", izin: izinler.teklif },
      { key: "reklamlar", label: "Reklamlar", izin: izinler.reklamlar },
      { key: "paylasimlar", label: "Paylaşımlar", izin: izinler.paylasimlar },
      { key: "gunluk-kontrol", label: "Günlük Kontrol", izin: izinler.paylasimlar },
      { key: "cekim-listesi", label: "Çekim", izin: izinler.cekimListesi },
      { key: "cekim-edit", label: "Operasyon", izin: izinler.cekimEdit },
      { key: "personel", label: "Personel", izin: izinler.personel },
      { key: "birikim", label: "Birikim", izin: izinler.birikim },
      { key: "uyelikler", label: "Üyelikler", izin: izinler.uyelikler },
      { key: "musteri-girisleri", label: "Şifre Kasası", izin: izinler.sifreKasasi },
    ].filter((x) => x.izin === true);
    const staffTab = staffNavAll.some((x) => x.key === tab) ? tab : (staffNavAll[0] ? staffNavAll[0].key : null);
    return (
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
        <style>{FONTS}{`
          * { box-sizing: border-box; }
          @keyframes marcus-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
          input:focus, select:focus { border-color: ${T.accent} !important; }
          button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
          @media (max-width: 900px) {
            .marcus-grid-2 { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px) {
            .marcus-field-grid { grid-template-columns: 1fr !important; }
            .marcus-card { padding: 14px 16px !important; }
            h1 { font-size: 18px !important; }
          }
          button { touch-action: manipulation; }
          .marcus-table-wrap table { font-size: 13px; }
          .marcus-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .marcus-kanban { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
          .marcus-kanban > div { flex: 0 0 220px; }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${T.borderSoft}`, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>M</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14.5, color: T.text }}>Marcus Medya App</div>
              <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>Personel Paneli</div>
            </div>
          </div>
          <button
            onClick={() => {
              // Sunucudaki oturumu da kapat — sadece tarayıcıdan silmek yetmez.
              const token = getOturum();
              if (token) {
                fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json", "X-Oturum": token }, body: JSON.stringify({ authAction: "cikis" }) }).catch(() => {});
              }
              clearOturum(); clearStaffCreds(); clearMusteriCreds();
              window.location.reload();
            }}
            style={cancelBtnStyle}
          >
            Çıkış Yap
          </button>
        </div>
        {staffNavAll.length > 1 && (
          <div style={{ display: "flex", gap: 8, padding: "16px 20px 0", flexWrap: "wrap" }}>
            {staffNavAll.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: staffTab === key ? T.accentSoft : "transparent", color: staffTab === key ? T.accentText : T.textDim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>{label}</button>
            ))}
          </div>
        )}
        <div style={{ padding: "20px 20px 40px" }}>
          {!staffTab && <div style={{ color: T.textFaint, fontFamily: "Inter", fontSize: 13 }}>Henüz erişimin olan bir bölüm yok. Yöneticine sor.</div>}
          {staffTab === "dashboard" && <Dashboard data={data} onAsk={() => openAi()} />}
          {staffTab === "musteriler" && (
            <Musteriler
              clients={data.clients || []}
              bekleyenTahsilatlar={data.bekleyenTahsilatlar || []}
              hesaplar={data.hesaplar}
              freelancerlar={data.freelancerlar || []}
              onAdd={addClient} onUpdate={updateClient} onDelete={deleteClient}
              onAddCost={addClientCost} onDeleteCost={deleteClientCost}
              onMarkPaid={markClientPaid} onMarkUnpaid={markClientUnpaid}
              onOpenTeblig={openTeblig}
              onAddOdemeKaydi={addOdemeKaydi}
              onDeleteOdemeKaydi={deleteOdemeKaydi}
              openClient={detailClientFromSearch}
              onOpenClientHandled={() => setDetailClientFromSearch(null)}
              duzenleyenAdi={loggedStaffName || "Personel"}
              musteriIcerikleri={data.musteriIcerikleri || []}
              onAddIcerik={addMusteriIcerik}
              onUpdateIcerik={updateMusteriIcerik}
              onDeleteIcerik={deleteMusteriIcerik}
              firmaAdi={data.firmaAdi}
            />
          )}
          {staffTab === "finans" && (
            <Finans
              data={data}
              clients={data.clients || []}
              onAddGelir={addGelir} onDeleteGelir={deleteGelir}
              onAddGider={addGider} onDeleteGider={deleteGider}
              onAddOfisGider={addOfisGider} onDeleteOfisGider={deleteOfisGider}
              onAddBekleyen={addBekleyen} onDeleteBekleyen={deleteBekleyen}
              onAddVergi={addVergi} onDeleteVergi={deleteVergi}
              onAddMonth={addMonth} onDeleteMonth={deleteMonth}
              onCloseMonth={closeMonth}
              onExport={exportCsv}
              onTransfer={transferEt}
              onDeleteTransfer={deleteTransfer}
              onUpdateHesap={updateHesap}
              onAddDuzeltme={addHesapDuzeltme}
              onDeleteDuzeltme={deleteHesapDuzeltme}
              onAddHesap={addHesap}
              onDeleteHesap={deleteHesap}
              firmaAdi={data.firmaAdi}
            />
          )}
          {staffTab === "takvim" && <Takvim data={data} />}
          {staffTab === "odeme-takvimi" && (
            <OdemeTakvimi
              clients={data.clients || []}
              hesaplar={data.hesaplar}
              transferler={data.hesapTransferleri}
              avanslar={data.avanslar || []}
              odemeler={data.personelOdemeleri || []}
              duzeltmeler={data.hesapDuzeltmeleri || []}
              onUpdateClient={(id, patch) => setOdemeGunuSafe(id, patch.odemeGunu)}
              onAddOdemeKaydi={addOdemeKaydi}
              onDeleteOdemeKaydi={deleteOdemeKaydi}
              onTransfer={transferEt}
              onDeleteTransfer={deleteTransfer}
              onUpdateHesap={updateHesap}
              onAddDuzeltme={addHesapDuzeltme}
              onDeleteDuzeltme={deleteHesapDuzeltme}
              onAddHesap={addHesap}
              onDeleteHesap={deleteHesap}
              firmaAdi={data.firmaAdi}
            />
          )}
          {staffTab === "teklif" && (
            <TeklifSozlesme
              firmaAdi={data.firmaAdi || "Marcus Medya"}
              onSaveTeklif={saveTeklif}
              sablonlar={data.teklifSablonlari || []}
              onSaveSablon={saveSablon}
              onDeleteSablon={deleteSablon}
              kimlikGorseli={data.markaKimligiGorseli}
              sozlesmeSablonlari={data.sozlesmeSablonlari || []}
              onSaveSozlesmeSablonu={saveSozlesmeSablonu}
              onDeleteSozlesmeSablonu={deleteSozlesmeSablonu}
            />
          )}
          {staffTab === "reklamlar" && <Reklamlar reklamlar={data.reklamlar || []} clients={data.clients || []} onAdd={addReklam} onUpdate={updateReklam} onDelete={deleteReklam} duzenleyenAdi={loggedStaffName || "Personel"} />}
          {staffTab === "paylasimlar" && <Paylasimlar clients={data.clients || []} stoklar={data.stoklar || {}} gecmis={data.paylasimGecmisi || []} onStokDegis={degistirStok} haftalikPlan={data.haftalikPaylasimlar || []} onAddHaftalikPlan={addHaftalikPlan} onToggleHaftalikYapildi={toggleHaftalikYapildi} onDeleteHaftalikPlan={deleteHaftalikPlan} subeler={data.subeler || []} onAddSube={addSube} onDeleteSube={deleteSube} onSubeStokDegis={subeStokDegistir} />}
          {staffTab === "gunluk-kontrol" && <GunlukKontrol clients={data.clients || []} stoklar={data.stoklar || {}} gecmis={data.paylasimGecmisi || []} kontrol={data.gunlukKontrol} onToggle={toggleGunlukKontrol} onYenile={veriyiYenile} role="staff" />}
          {staffTab === "cekim-listesi" && <CekimListesi clients={data.clients || []} stoklar={data.stoklar || {}} subeler={data.subeler || []} gecmis={data.paylasimGecmisi || []} />}
          {staffTab === "cekim-edit" && <CekimEditTakibi role="staff" clients={data.clients || []} jobs={data.cekimIsleri || []} personelRosteri={data.personelRosteri || []} onRefreshRoster={refreshPersonelRosteri} onAddJob={addCekimIsi} onUpdateJob={updateCekimIsi} onDeleteJob={deleteCekimIsi} girisYapanAd={loggedStaffName} markalasmaSurecleri={data.markalasmaSurecleri || []} onToggleMarkalasmaGorev={toggleMarkalasmaGorev} onSetMarkalasmaYonetici={setMarkalasmaYonetici} onAddMarkalasmaGorev={addMarkalasmaGorev} onCompleteMarkalasmaSureci={tamamlaMarkalasmaSureci} onDeleteMarkalasmaSureci={deleteMarkalasmaSureci} markaYoneticisiMi={izinler.markaYoneticisi} firmaAdi={data.firmaAdi} />}
          {staffTab === "personel" && <Personel personel={data.personel || []} onAdd={addPersonel} onUpdate={updatePersonel} onDelete={deletePersonel} duzenleyenAdi={loggedStaffName || "Personel"} />}
          {staffTab === "birikim" && (
            <Birikim
              birikimler={data.birikimler || []}
              onAddFon={addFon}
              onDeleteFon={deleteFon}
              onAddHareket={addFonHareket}
              onDeleteHareket={deleteFonHareket}
            />
          )}
          {staffTab === "uyelikler" && (
            <Uyelikler uyelikler={data.uyelikler || []} onAdd={addUyelik} onUpdate={updateUyelik} onDelete={deleteUyelik} personelRosteri={data.personelRosteri || []} firmaAdi={data.firmaAdi} />
          )}
          {staffTab === "musteri-girisleri" && (
            <MusteriGirisleri clients={data.clients || []} girisler={data.musteriGirisleri || {}} onUpdate={updateMusteriGiris} firmaAdi={data.firmaAdi} logo={data.markaKimligiGorseli} role="staff" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", fontFamily: "Inter, sans-serif", overflowX: "hidden" }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        @keyframes marcus-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
        input:focus, select:focus { border-color: ${T.accent} !important; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
        @media (max-width: 900px) {
          .marcus-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .marcus-field-grid { grid-template-columns: 1fr !important; }
          .marcus-card { padding: 14px 16px !important; }
          h1 { font-size: 18px !important; }
        }
        button { touch-action: manipulation; }
        .marcus-table-wrap table { font-size: 13px; }
        .marcus-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .marcus-kanban { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
        .marcus-kanban > div { flex: 0 0 220px; }
      `}</style>

      {isMobile && mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} />
      )}

      <div
        style={{
          width: 220,
          borderRight: `1px solid ${T.borderSoft}`,
          padding: "22px 14px",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile
            ? { position: "fixed", top: 0, left: 0, height: "100%", width: 260, zIndex: 80, background: T.bg, transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", overflowY: "auto" }
            : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>M</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14.5, color: T.text, letterSpacing: 0.2 }}>Marcus Medya App</div>
            <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter" }}>Marcus Medya</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: tab === key ? T.accentSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <Icon size={16} color={tab === key ? T.accentText : T.textDim} />
              <span style={{ fontSize: 13.5, fontWeight: tab === key ? 600 : 500, color: tab === key ? T.text : T.textDim, fontFamily: "Inter, sans-serif" }}>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10.5, color: T.textFaint, fontFamily: "Inter", textAlign: "center", lineHeight: 1.6, padding: "8px 6px", background: T.surface, borderRadius: 9, border: `1px solid ${T.borderSoft}` }}>
            <div>
              {saveStatus === "saving" ? "Kaydediliyor…" : saveStatus === "saved" ? "✓ Kaydedildi" : saveStatus === "error" ? "⚠ Kaydetme hatası" : "…"}
              {lastSavedAt && saveStatus === "saved" && ` · ${lastSavedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
            <div style={{ marginTop: 2 }}>
              {(() => {
                if (!data.sonYedekTarihi) return <span style={{ color: T.warning }}>Hiç tam yedek alınmadı</span>;
                const gun = Math.floor((Date.now() - new Date(data.sonYedekTarihi).getTime()) / 86400000);
                const metin = gun <= 0 ? "Bugün yedeklendi" : gun === 1 ? "1 gün önce yedeklendi" : `${gun} gün önce yedeklendi`;
                return <span style={{ color: gun > 14 ? T.warning : T.textFaint }}>Son yedek: {metin}</span>;
              })()}
            </div>
          </div>
          <button onClick={() => openAi()} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #7C6BFA)`, border: "none", cursor: "pointer", width: "100%", color: "#fff" }}>
            <Sparkles size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>AI CEO'ya Sor</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px 16px 0" : "20px 30px 0", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Menu size={17} color={T.text} />
              </button>
            )}
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: isMobile ? 18 : 21, fontWeight: 600, color: T.text, margin: 0 }}>{titles[tab]}</h1>
              {!isMobile && <div style={{ fontSize: 12.5, color: T.textFaint, fontFamily: "Inter", marginTop: 2 }}>{todayLabel}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", width: isMobile ? 150 : 220 }}>
                <Search size={14} color={T.textFaint} />
                <input
                  value={search}
                  data-marcus-arama="1"
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Müşteri, iş, personel, marka ara…"
                  style={{ border: "none", outline: "none", background: "transparent", color: T.text, fontSize: 12.5, fontFamily: "Inter, sans-serif", width: "100%" }}
                />
              </div>
              {searchOpen && search.trim() && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 280, maxWidth: "85vw", background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 30, overflow: "hidden" }}>
                  {searchResults.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Sonuç yok.</div>}
                  {searchResults.map((r, i) => (
                    <div key={i} onMouseDown={() => goToSearchResult(r)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < searchResults.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{r.sub}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setNotifOpen((v) => !v)}
                style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
              >
                <Bell size={15} color={T.textDim} />
                {notifications.length > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: T.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: "0 3px" }}>
                    {notifications.length}
                  </span>
                )}
              </div>
              {notifOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 300, maxWidth: "85vw", background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 30, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
                  <div style={{ padding: "10px 14px", fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>BİLDİRİMLER</div>
                  {notifications.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12.5, color: T.textFaint, fontFamily: "Inter" }}>Her şey yolunda, bekleyen bir şey yok.</div>}
                  {notifications.map((n, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderBottom: i < notifications.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: n.level === "danger" ? T.danger : T.warning, marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: T.text, fontFamily: "Inter", lineHeight: 1.5 }}>{n.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: isMobile ? "16px 16px 32px" : "20px 30px 40px" }}>
          {tab === "dashboard" && <Dashboard data={data} onAsk={() => openAi()} />}
          {tab === "planim" && <Planim gorevler={data.kisiselGorevler || []} onAdd={addGorev} onUpdate={updateGorev} onDelete={deleteGorev} />}
          {tab === "musteri-paneli" && (
            <MusteriPaneliYonetimi
              clients={data.clients || []}
              icerikler={data.musteriIcerikleri || []}
              onAdd={addMusteriIcerik}
              onUpdate={updateMusteriIcerik}
              onDelete={deleteMusteriIcerik}
              plan={data.haftalikPaylasimlar || []}
              reklamlar={data.reklamlar || []}
              isler={data.cekimIsleri || []}
              onAltMetin={setPlanAltMetin}
            />
          )}
          {tab === "musteriler" && (
            <Musteriler
              clients={data.clients}
              bekleyenTahsilatlar={data.bekleyenTahsilatlar}
              hesaplar={data.hesaplar}
              onAdd={addClient} onUpdate={updateClient} onDelete={deleteClient}
              onAddCost={addClientCost} onDeleteCost={deleteClientCost}
              onMarkPaid={markClientPaid} onMarkUnpaid={markClientUnpaid}
              onOpenTeblig={openTeblig}
              onAddOdemeKaydi={addOdemeKaydi}
              onDeleteOdemeKaydi={deleteOdemeKaydi}
              openClient={detailClientFromSearch}
              onOpenClientHandled={() => setDetailClientFromSearch(null)}
              duzenleyenAdi="Yönetici (CEO)"
              musteriIcerikleri={data.musteriIcerikleri || []}
              onAddIcerik={addMusteriIcerik}
              onUpdateIcerik={updateMusteriIcerik}
              onDeleteIcerik={deleteMusteriIcerik}
              firmaAdi={data.firmaAdi}
            />
          )}
          {tab === "finans" && (
            <Finans
              data={data}
              clients={data.clients}
              onAddGelir={addGelir} onDeleteGelir={deleteGelir}
              onAddGider={addGider} onDeleteGider={deleteGider}
              onAddOfisGider={addOfisGider} onDeleteOfisGider={deleteOfisGider}
              onAddBekleyen={addBekleyen} onDeleteBekleyen={deleteBekleyen}
              onAddVergi={addVergi} onDeleteVergi={deleteVergi}
              onAddMonth={addMonth} onDeleteMonth={deleteMonth}
              onCloseMonth={closeMonth}
              onExport={exportCsv}
              onTransfer={transferEt}
              onDeleteTransfer={deleteTransfer}
              onUpdateHesap={updateHesap}
              onAddDuzeltme={addHesapDuzeltme}
              onDeleteDuzeltme={deleteHesapDuzeltme}
              onAddHesap={addHesap}
              onDeleteHesap={deleteHesap}
              firmaAdi={data.firmaAdi}
            />
          )}
          {tab === "takvim" && <Takvim data={data} />}
          {tab === "odeme-takvimi" && (
            <OdemeTakvimi
              clients={data.clients}
              hesaplar={data.hesaplar}
              transferler={data.hesapTransferleri}
              avanslar={data.avanslar || []}
              odemeler={data.personelOdemeleri || []}
              duzeltmeler={data.hesapDuzeltmeleri || []}
              onUpdateClient={(id, patch) => setOdemeGunuSafe(id, patch.odemeGunu)}
              onAddOdemeKaydi={addOdemeKaydi}
              onDeleteOdemeKaydi={deleteOdemeKaydi}
              onTransfer={transferEt}
              onDeleteTransfer={deleteTransfer}
              onUpdateHesap={updateHesap}
              onAddDuzeltme={addHesapDuzeltme}
              onDeleteDuzeltme={deleteHesapDuzeltme}
              onAddHesap={addHesap}
              onDeleteHesap={deleteHesap}
              firmaAdi={data.firmaAdi}
            />
          )}
          {tab === "teklif" && (
            <TeklifSozlesme
              firmaAdi={data.firmaAdi || "Marcus Medya"}
              onSaveTeklif={saveTeklif}
              sablonlar={data.teklifSablonlari || []}
              onSaveSablon={saveSablon}
              onDeleteSablon={deleteSablon}
              kimlikGorseli={data.markaKimligiGorseli}
              sozlesmeSablonlari={data.sozlesmeSablonlari || []}
              onSaveSozlesmeSablonu={saveSozlesmeSablonu}
              onDeleteSozlesmeSablonu={deleteSozlesmeSablonu}
            />
          )}
          {tab === "reklamlar" && <Reklamlar reklamlar={data.reklamlar || []} clients={data.clients || []} onAdd={addReklam} onUpdate={updateReklam} onDelete={deleteReklam} duzenleyenAdi="Yönetici (CEO)" />}
          {tab === "paylasimlar" && <Paylasimlar clients={data.clients || []} stoklar={data.stoklar || {}} gecmis={data.paylasimGecmisi || []} onStokDegis={degistirStok} haftalikPlan={data.haftalikPaylasimlar || []} onAddHaftalikPlan={addHaftalikPlan} onToggleHaftalikYapildi={toggleHaftalikYapildi} onDeleteHaftalikPlan={deleteHaftalikPlan} subeler={data.subeler || []} onAddSube={addSube} onDeleteSube={deleteSube} onSubeStokDegis={subeStokDegistir} />}
          {tab === "gunluk-kontrol" && <GunlukKontrol clients={data.clients || []} stoklar={data.stoklar || {}} gecmis={data.paylasimGecmisi || []} kontrol={data.gunlukKontrol} onToggle={toggleGunlukKontrol} onYenile={veriyiYenile} role="owner" />}
          {tab === "cekim-listesi" && <CekimListesi clients={data.clients || []} stoklar={data.stoklar || {}} subeler={data.subeler || []} gecmis={data.paylasimGecmisi || []} />}
          {tab === "cekim-edit" && <CekimEditTakibi role="owner" clients={data.clients || []} jobs={data.cekimIsleri || []} personelRosteri={data.personelRosteri || []} onRefreshRoster={refreshPersonelRosteri} onAddJob={addCekimIsi} onUpdateJob={updateCekimIsi} onDeleteJob={deleteCekimIsi} isUcretleri={data.isUcretleri || {}} onSaveIsUcreti={setIsUcreti} isUcretDetaylari={data.isUcretDetaylari || {}} onSaveIsUcretDetayi={setIsUcretDetayi} avanslar={data.avanslar || []} hesaplar={data.hesaplar || []} onAddAvans={addAvans} onDeleteAvans={deleteAvans} markalasmaSurecleri={data.markalasmaSurecleri || []} onToggleMarkalasmaGorev={toggleMarkalasmaGorev} onSetMarkalasmaYonetici={setMarkalasmaYonetici} onAddMarkalasmaGorev={addMarkalasmaGorev} onCompleteMarkalasmaSureci={tamamlaMarkalasmaSureci} onDeleteMarkalasmaSureci={deleteMarkalasmaSureci} markaYoneticisiMi={true} firmaAdi={data.firmaAdi} />}
          {tab === "personel" && (
            <Personel
              personel={data.personel || []}
              onAdd={addPersonel} onUpdate={updatePersonel} onDelete={deletePersonel}
              duzenleyenAdi="Yönetici (CEO)"
              avanslar={data.avanslar || []}
              hesaplar={data.hesaplar}
              onAddAvans={addAvans} onDeleteAvans={deleteAvans}
              odemeler={data.personelOdemeleri || []}
              onAddOdeme={addPersonelOdeme} onDeleteOdeme={deletePersonelOdeme}
              freelancerlar={data.freelancerlar || []}
              clients={data.clients || []}
              jobs={data.cekimIsleri || []}
              isUcretleri={data.isUcretleri || {}}
              isUcretDetaylari={data.isUcretDetaylari || {}}
              onAddFreelancer={addFreelancer} onUpdateFreelancer={updateFreelancer} onDeleteFreelancer={deleteFreelancer}
            />
          )}
          {tab === "birikim" && (
            <Birikim
              birikimler={data.birikimler || []}
              onAddFon={addFon}
              onDeleteFon={deleteFon}
              onAddHareket={addFonHareket}
              onDeleteHareket={deleteFonHareket}
            />
          )}
          {tab === "uyelikler" && (
            <Uyelikler uyelikler={data.uyelikler || []} onAdd={addUyelik} onUpdate={updateUyelik} onDelete={deleteUyelik} personelRosteri={data.personelRosteri || []} firmaAdi={data.firmaAdi} />
          )}
          {tab === "musteri-girisleri" && (
            <MusteriGirisleri
              clients={data.clients || []}
              girisler={data.musteriGirisleri || {}}
              onUpdate={updateMusteriGiris}
              firmaAdi={data.firmaAdi}
              logo={data.markaKimligiGorseli}
              role="owner"
              kisiselSifreler={data.ownerKisiselSifreler || []}
              onAddKisiselSifre={addKisiselSifre}
              onUpdateKisiselSifre={updateKisiselSifre}
              onDeleteKisiselSifre={deleteKisiselSifre}
            />
          )}
          {tab === "ayarlar" && (
            <Ayarlar
              onExport={exportCsv} onExportJson={exportJson} onImportJson={importJson}
              firmaAdi={data.firmaAdi} tebligSablonu={data.tebligSablonu}
              onSaveTeblig={(ad, sablon) => setData((d) => ({ ...d, firmaAdi: ad, tebligSablonu: sablon }))}
              staffPermissions={data.staffPermissions || { reklamlar: true, paylasimlar: true, cekimEdit: true }}
              onUpdatePermissions={updateStaffPermissions}
              markaKimligiGorseli={data.markaKimligiGorseli}
              onSaveMarkaKimligi={saveMarkaKimligi}
              onRosterChange={(roster) => setData((d) => ({ ...d, personelRosteri: roster }))}
              clients={data.clients || []}
              gizlilikModu={gizlilikModu}
              onToggleGizlilik={setGizlilikModu}
              islemGecmisi={data.islemGecmisi || []}
            />
          )}
        </div>
      </div>

      {aiOpen && <div onClick={() => setAiOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }} />}
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} initialQuestion={aiQuestion} data={{ ...data, buAyinGercekDurumu: computeLive(data) }} />
      {showBackupReminder && (
        <BackupReminder
          onBackupNow={() => { exportJson(); setShowBackupReminder(false); }}
          onDismiss={() => setShowBackupReminder(false)}
        />
      )}
      {saveBlocked && (
        <SaveBlockedModal
          info={saveBlocked}
          onCancel={() => setSaveBlocked(null)}
          onForce={forceSave}
        />
      )}
      {staleConflictMsg && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, maxWidth: 480, width: "90%" }}>
          <div style={{ background: T.warningSoft, border: `1px solid ${T.warning}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ flex: 1, fontSize: 12.5, color: T.warning, fontFamily: "Inter", lineHeight: 1.6 }}>{staleConflictMsg}</div>
            <button onClick={() => setStaleConflictMsg("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}><X size={15} color={T.warning} /></button>
          </div>
        </div>
      )}
      {tebligOpen && (
        <TebligDuzenleModal
          initialText={tebligOpen.text}
          client={tebligOpen.client}
          firmaAdi={data.firmaAdi || "Marcus Medya"}
          onClose={() => setTebligOpen(null)}
        />
      )}
    </div>
  );
}
