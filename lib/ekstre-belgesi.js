/* ------------------------------------------------------------------ */
/* EKSTRE BELGESİ — yazdırılabilir HTML                                 */
/* ------------------------------------------------------------------ */
/**
 * Müşteriye verilecek hesap özetinin basılabilir hâli. Tebliğ mektubuyla aynı yolu
 * kullanıyor (yeni pencere → yazdır → PDF), ama metin değil TABLO olduğu için kendi
 * üreticisi var.
 *
 * `src/tema.jsx` yerine `lib/` altında: para rakamları basan bir işlev ve `.jsx` dosyası
 * Node'da çalışmadığı için testten ÇAĞRILAMIYOR olurdu — bu projede ödeme hesabı tam da
 * bu sebeple buraya taşındı.
 *
 * BELGE MÜŞTERİYE GİDİYOR. İç bilgi (maliyet, kâr marjı, personel ücreti, diğer markalar)
 * buraya ASLA girmez; yalnızca o markanın kendi tahakkuk/fatura/tahsilat satırları.
 */
import { ekstreUret } from "./ekstre.js";

const kacis = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "2026-07" → "Temmuz 2026". Tanınmayan değer olduğu gibi geri döner. */
export function ayEtiketi(ay) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ay || ""));
  if (!m) return String(ay || "");
  return `${AY_ADLARI[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

/** Para: "60.000 ₺". Eksi değerler korunur (fazla ödeme gerçek bir durum). */
export function para(n) {
  const sayi = Number(n) || 0;
  return `${sayi.toLocaleString("tr-TR")} ₺`;
}

/** "2026-07-05" → "05.07.2026". Boşsa boş döner. */
export function tarihEtiketi(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || "").trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(t || "").trim();
}

function satirHtml(s) {
  const detaylar = [];
  /* Şube dökümü VARSA yazılır. Şubelerine ayrı ücret kesilen markada müşterinin ilk
   * sorusu "bu rakam neyin toplamı" oluyordu; belgenin varlık sebeplerinden biri bu. */
  if (s.dagilim && Array.isArray(s.dagilim.subeler) && s.dagilim.subeler.length > 0) {
    const parcalar = [`temel ${para(s.dagilim.temel)}`,
                      ...s.dagilim.subeler.map((x) => `${kacis(x.ad)} ${para(x.tutar)}`)];
    detaylar.push(`<div class="alt">Hizmet bedeli: ${parcalar.join(" + ")}</div>`);
  }
  s.faturalar.forEach((f) => {
    const parca = [f.no ? `Fatura No ${kacis(f.no)}` : "Fatura",
                   f.tarih ? tarihEtiketi(f.tarih) : "", para(f.tutar), kacis(f.not || "")]
      .filter(Boolean).join(" · ");
    detaylar.push(`<div class="alt">${parca}</div>`);
  });
  s.odemeler.forEach((o) => {
    const parca = ["Tahsilat", o.tarih ? tarihEtiketi(o.tarih) : "", para(o.tutar),
                   kacis(o.banka || ""), kacis(o.not || "")].filter(Boolean).join(" · ");
    detaylar.push(`<div class="alt">${parca}</div>`);
  });

  const bakiyeSinif = s.bakiye > 0 ? "borc" : s.bakiye < 0 ? "fazla" : "kapali";
  return `<tr>
  <td class="ay">${kacis(ayEtiketi(s.ay))}${detaylar.join("")}</td>
  <td class="sag">${para(s.tahakkuk)}</td>
  <td class="sag">${s.faturaliTutar ? para(s.faturaliTutar) : "—"}</td>
  <td class="sag">${s.tahsilat ? para(s.tahsilat) : "—"}</td>
  <td class="sag ${bakiyeSinif}">${para(s.bakiye)}</td>
</tr>`;
}

/**
 * Ekstre belgesinin tamamı.
 *
 * `ekstre` verilmezse `client` ve aralıktan üretilir; verilirse olduğu gibi kullanılır
 * (ekranda gösterilen ile basılan belgenin AYNI olması için — iki kez hesaplansaydı
 * arada bir kayıt eklenince ekran ile kâğıt farklı çıkabilirdi).
 */
export function ekstreHtml(client, { baslangicAy, bitisAy, firmaAdi, ekstre, bugun } = {}) {
  const veri = ekstre || ekstreUret(client, { baslangicAy, bitisAy });
  const tarih = (bugun || new Date()).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const donem = veri.satirlar.length
    ? `${ayEtiketi(veri.satirlar[0].ay)} – ${ayEtiketi(veri.satirlar[veri.satirlar.length - 1].ay)}`
    : `${ayEtiketi(baslangicAy)} – ${ayEtiketi(bitisAy)}`;

  const govde = veri.satirlar.length
    ? veri.satirlar.map(satirHtml).join("\n")
    : `<tr><td colspan="5" class="bos">Bu dönemde hareket yok.</td></tr>`;

  const t = veri.toplam;
  const bakiyeSinif = t.bakiye > 0 ? "borc" : t.bakiye < 0 ? "fazla" : "kapali";
  const bakiyeMetni = t.bakiye > 0 ? "Ödenmesi gereken bakiye"
    : t.bakiye < 0 ? "Fazla ödeme (alacaklısınız)" : "Bakiye yok — hesap kapalı";

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8" />
<title>Hesap Özeti - ${kacis(client && client.ad)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 820px; margin: 48px auto; color:#111; line-height:1.55; font-size:14px; }
  .ust { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
  .baslik { font-size:19px; font-weight:bold; text-align:center; margin:26px 0 6px; text-transform:uppercase; letter-spacing:1px; }
  .donem { text-align:center; color:#555; margin-bottom:24px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:#555; border-bottom:2px solid #111; padding:8px 6px; }
  th.sag, td.sag { text-align:right; white-space:nowrap; }
  td { border-bottom:1px solid #ddd; padding:10px 6px; vertical-align:top; }
  td.ay { font-weight:bold; }
  .alt { font-weight:normal; font-size:12px; color:#555; margin-top:3px; }
  .borc { color:#a11; font-weight:bold; }
  .fazla { color:#161; font-weight:bold; }
  .kapali { color:#555; }
  .bos { text-align:center; color:#777; padding:22px; }
  tfoot td { border-top:2px solid #111; border-bottom:none; font-weight:bold; padding-top:10px; }
  .ozet { margin-top:26px; padding:14px 16px; border:1px solid #111; }
  .ozet .buyuk { font-size:17px; font-weight:bold; }
  .not { margin-top:22px; font-size:11.5px; color:#666; line-height:1.5; }
  @media print { body { margin:16px; } .ozet { break-inside:avoid; } }
</style></head>
<body>
  <div class="ust">
    <div><strong>${kacis(firmaAdi || "")}</strong></div>
    <div>${kacis(tarih)}</div>
  </div>
  <div class="baslik">Hesap Özeti</div>
  <div class="donem">${kacis(client && client.ad)} · ${kacis(donem)}</div>

  <table>
    <thead><tr>
      <th>Dönem</th><th class="sag">Hizmet Bedeli</th><th class="sag">Faturalanan</th>
      <th class="sag">Tahsilat</th><th class="sag">Bakiye</th>
    </tr></thead>
    <tbody>
${govde}
    </tbody>
    <tfoot><tr>
      <td>TOPLAM</td>
      <td class="sag">${para(t.tahakkuk)}</td>
      <td class="sag">${t.faturaliTutar ? para(t.faturaliTutar) : "—"}</td>
      <td class="sag">${para(t.tahsilat)}</td>
      <td class="sag ${bakiyeSinif}">${para(t.bakiye)}</td>
    </tr></tfoot>
  </table>

  <div class="ozet">
    <div>${kacis(bakiyeMetni)}</div>
    <div class="buyuk ${bakiyeSinif}">${para(Math.abs(t.bakiye))}</div>
  </div>

  <div class="not">
    Hizmet bedeli, her dönem için o dönemde yürürlükte olan tutardır. &quot;Faturalanan&quot;
    sütunu hizmet bedelinin belgelenen kısmını gösterir; bedele EKLENMEZ, onun içindedir.
    Bakiye = hizmet bedeli − tahsilat.
  </div>
</body></html>`;
}
