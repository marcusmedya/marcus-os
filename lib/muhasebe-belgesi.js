/**
 * ÖN MUHASEBE BELGELERİ — yazdırılabilir (PDF) raporlar.
 *
 * Üç belge: tahsilat dökümü, ödeme/gider dökümü ve aylık tek sayfa özet. Üçü de yeni
 * pencerede açılıp tarayıcının yazdırma kutusuyla PDF'e kaydediliyor — müşteri ekstresiyle
 * aynı yol, yeni bir PDF paketi YOK.
 *
 * `lib/` altında çünkü `.jsx` Node'da çalışmıyor ve para rakamı basan bir işlev testten
 * çağrılamıyor olurdu; ekstre belgesi de tam bu sebeple buraya taşınmıştı.
 *
 * BU BELGELER İÇERİDE KALIR — müşteriye verilmez. Ekstre müşteriye gidiyordu ve orada iç
 * bilgi yasağı vardı; burada tersi: rapor zaten yöneticinin kendi dökümü. Yine de
 * **her metin HTML'e kaçırılarak** giriyor: marka ve kişi adları kullanıcı girdisidir.
 */
import { ayEtiketi, para, tarihEtiketi } from "./ekstre-belgesi.js";

const kacis = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const STIL = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
       color:#111;margin:32px;font-size:13px;line-height:1.5}
  h1{font-size:19px;margin:0 0 4px}
  .ust{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;
       border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:18px;flex-wrap:wrap}
  .firma{font-size:12px;color:#555}
  .donem{font-size:12px;color:#555;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  th{text-align:left;font-size:10.5px;letter-spacing:.3px;color:#666;
     border-bottom:1px solid #bbb;padding:0 8px 6px}
  td{padding:7px 8px;border-bottom:1px solid #eee;vertical-align:top}
  .sag{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .toplam td{border-top:2px solid #111;border-bottom:none;font-weight:700;padding-top:10px}
  .not{font-size:11px;color:#666;line-height:1.6;border-top:1px solid #ddd;
       padding-top:10px;margin-top:4px}
  .bos{color:#666;font-style:italic;padding:16px 0}
  .ozet{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px}
  .kutu{border:1px solid #ccc;border-radius:8px;padding:10px 14px;min-width:150px}
  .kutu b{display:block;font-size:10.5px;color:#666;font-weight:600;margin-bottom:4px}
  .kutu span{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
  @media print{body{margin:16px}tr{break-inside:avoid}.kutu{break-inside:avoid}}
`;

/** Dönem başlığı: "Temmuz 2026 – Eylül 2026" ya da tek ay. Sınırsızsa "tüm kayıtlar". */
export function donemEtiketi(bas, bit) {
  const b = String(bas || "").trim();
  const s = String(bit || "").trim();
  if (!b && !s) return "tüm kayıtlar";
  if (b && s) return b === s ? ayEtiketi(b) : `${ayEtiketi(b)} – ${ayEtiketi(s)}`;
  return b ? `${ayEtiketi(b)} ve sonrası` : `${ayEtiketi(s)} ve öncesi`;
}

const iskelet = ({ baslik, firmaAdi, donem, bugun, govde }) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${kacis(baslik)}</title>
<style>${STIL}</style></head><body>
<div class="ust">
  <div>
    <h1>${kacis(baslik)}</h1>
    <div class="donem">Dönem: ${kacis(donem)}</div>
  </div>
  <div class="firma">${kacis(firmaAdi || "")}${bugun ? `<br>Döküm tarihi: ${kacis(tarihEtiketi(bugun) || bugun)}` : ""}</div>
</div>
${govde}
</body></html>`;

/* TARİHSİZ KAYIT UYARISI — rapora giremeyen kayıt varsa söylenir. Sessiz kalmak,
 * eksik bir dökümü tam gibi göstermek olurdu. */
const tarihsizNotu = (adet) => (adet > 0
  ? `<div class="not"><strong>${adet} kayıt bu dökümde yok:</strong> tarih ya da ay bilgisi
     girilmemiş, hangi döneme ait olduğu bilinmiyor. Toplamlara dahil edilmediler.</div>`
  : "");

/**
 * TAHSİLAT DÖKÜMÜ — "kimden ne kadar aldım".
 * @param dokum `tahsilatDokumu` çıktısı
 */
export function tahsilatRaporuHtml({ dokum, firmaAdi, bas, bit, bugun } = {}) {
  const d = dokum || { satirlar: [], toplam: 0, tarihsiz: 0 };
  const govde = d.satirlar.length === 0
    ? `<div class="bos">Bu dönemde kayıtlı tahsilat yok.</div>${tarihsizNotu(d.tarihsiz)}`
    : `<table>
        <thead><tr>
          <th>TARİH</th><th>MARKA</th><th>HESAP</th><th>AÇIKLAMA</th><th class="sag">TUTAR</th>
        </tr></thead>
        <tbody>
          ${d.satirlar.map((r) => `<tr>
            <td>${kacis(tarihEtiketi(r.tarih) || ayEtiketi(r.ay))}</td>
            <td>${kacis(r.kim)}</td>
            <td>${kacis(r.hesap)}</td>
            <td>${kacis(r.not)}</td>
            <td class="sag">${kacis(para(r.tutar))}</td>
          </tr>`).join("")}
          <tr class="toplam">
            <td colspan="4">TOPLAM TAHSİLAT (${d.satirlar.length} kayıt)</td>
            <td class="sag">${kacis(para(d.toplam))}</td>
          </tr>
        </tbody>
      </table>${tarihsizNotu(d.tarihsiz)}`;
  return iskelet({ baslik: "Tahsilat Dökümü", firmaAdi, donem: donemEtiketi(bas, bit), bugun, govde });
}

/**
 * ÖDEME DÖKÜMÜ — "kime ne kadar verdim".
 * @param dokum `odemeDokumu` çıktısı
 */
export function odemeRaporuHtml({ dokum, firmaAdi, bas, bit, bugun } = {}) {
  const d = dokum || { satirlar: [], toplam: 0, tarihsiz: 0 };
  /* SABİT GİDERLER BU DÖKÜMDE YOK ve sebebi yazılıyor — okuyan "giderimin tamamı bu"
   * sanmamalı. Ofis/üyelik/gider kalemleri tarihsiz kayıtlar. */
  const sabitNotu = `<div class="not"><strong>Bu döküm yalnızca hesaptan ÇIKAN parayı gösterir.</strong>
    Ofis gideri, üyelikler ve elle girilen gider kalemleri burada yoktur: onların tarihli
    kaydı tutulmuyor, yalnızca aylık tutarları biliniyor. Aylık toplam gider için Finans
    ekranındaki gider dökümüne bak.</div>`;
  const govde = d.satirlar.length === 0
    ? `<div class="bos">Bu dönemde kayıtlı ödeme ya da avans yok.</div>${sabitNotu}${tarihsizNotu(d.tarihsiz)}`
    : `<table>
        <thead><tr>
          <th>TARİH</th><th>KİME</th><th>TÜR</th><th>HESAP</th><th>AÇIKLAMA</th><th class="sag">TUTAR</th>
        </tr></thead>
        <tbody>
          ${d.satirlar.map((r) => `<tr>
            <td>${kacis(tarihEtiketi(r.tarih) || ayEtiketi(r.ay))}</td>
            <td>${kacis(r.kim)}</td>
            <td>${kacis(r.tur)}</td>
            <td>${kacis(r.hesap)}</td>
            <td>${kacis(r.not)}</td>
            <td class="sag">${kacis(para(r.tutar))}</td>
          </tr>`).join("")}
          <tr class="toplam">
            <td colspan="5">TOPLAM ÖDEME (${d.satirlar.length} kayıt)</td>
            <td class="sag">${kacis(para(d.toplam))}</td>
          </tr>
        </tbody>
      </table>${sabitNotu}${tarihsizNotu(d.tarihsiz)}`;
  return iskelet({ baslik: "Ödeme Dökümü", firmaAdi, donem: donemEtiketi(bas, bit), bugun, govde });
}

/**
 * AYLIK TEK SAYFA ÖZET — muhasebeciye ya da ortağa verilebilecek tek belge.
 * @param ozet    `aylikOzet` çıktısı
 * @param cumleler `buAyinCumleleri` çıktısı (sade anlatım)
 */
export function aylikOzetRaporuHtml({ ozet, cumleler, firmaAdi, bugun } = {}) {
  const o = ozet || { satirlar: [], toplam: {} };
  const t = o.toplam || {};
  const anlatim = (cumleler || []).length
    ? `<div class="not" style="border-top:none;margin-bottom:14px;padding-top:0;font-size:12.5px;color:#111">
         ${(cumleler || []).map((c) => kacis(c.metin)).join(" ")}
       </div>`
    : "";

  const govde = `
    ${anlatim}
    <div class="ozet">
      <div class="kutu"><b>HAK EDİLEN</b><span>${kacis(para(t.tahakkuk))}</span></div>
      <div class="kutu"><b>TAHSİL EDİLEN</b><span>${kacis(para(t.tahsilat))}</span></div>
      <div class="kutu"><b>BEKLEYEN</b><span>${kacis(para(t.fark))}</span></div>
      <div class="kutu"><b>FREELANCER GİDERİ</b><span>${kacis(para(t.freelancerGideri))}</span></div>
    </div>
    ${o.satirlar.length === 0 ? '<div class="bos">Kayıt yok.</div>' : `<table>
      <thead><tr>
        <th>AY</th><th class="sag">HAK EDİLEN</th><th class="sag">TAHSİL EDİLEN</th>
        <th class="sag">BEKLEYEN</th><th class="sag">FREELANCER GİDERİ</th>
      </tr></thead>
      <tbody>
        ${o.satirlar.map((r) => `<tr>
          <td>${kacis(ayEtiketi(r.ay))}</td>
          <td class="sag">${kacis(para(r.tahakkuk))}</td>
          <td class="sag">${kacis(para(r.tahsilat))}</td>
          <td class="sag">${kacis(para(r.fark))}</td>
          <td class="sag">${kacis(para(r.freelancerGideri))}</td>
        </tr>`).join("")}
        <tr class="toplam">
          <td>TOPLAM</td>
          <td class="sag">${kacis(para(t.tahakkuk))}</td>
          <td class="sag">${kacis(para(t.tahsilat))}</td>
          <td class="sag">${kacis(para(t.fark))}</td>
          <td class="sag">${kacis(para(t.freelancerGideri))}</td>
        </tr>
      </tbody>
    </table>`}
    <div class="not">
      <strong>"Hak edilen"</strong> o ayın hizmet bedelidir — o ayki ücretle hesaplanır,
      bugünküyle değil. <strong>"Tahsil edilen"</strong> gerçekten alınan paradır.
      <strong>"Bekleyen"</strong> o aydan hâlâ tahsil edilmemiş olandır.<br>
      <strong>Sabit giderler bu tabloda yoktur</strong> (ofis, maaş, üyelikler): ay ay
      geçmişleri tutulmuyor, yalnızca bugünkü tutarları biliniyor.
      ${Number(t.isUcretiEksik) > 0
        ? `<br><strong>Freelancer gideri eksik:</strong> ${Number(t.isUcretiEksik)} iş–kişi
           eşleşmesinde iş başı ücret tanımlı değil ve sıfır sayıldı.`
        : ""}
    </div>`;

  const donem = o.satirlar.length
    ? donemEtiketi(o.satirlar[o.satirlar.length - 1].ay, o.satirlar[0].ay)
    : "tüm kayıtlar";
  return iskelet({ baslik: "Aylık Gelir–Gider Özeti", firmaAdi, donem, bugun, govde });
}
