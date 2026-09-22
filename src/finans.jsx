import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Receipt, Landmark, CircleDollarSign, CalendarClock, Wallet, ArrowRightLeft, Percent } from "lucide-react";
import {
  T, Card, SectionTitle, KpiCard, Pill, FieldForm, fmt, computeLive, tarihGoster,
  TR_AYLAR_KISA, TR_AYLAR, clientFaturaliTutar, clientPaymentStatus, monthKey, bugunISOTarih, addBtnStyle,
  inputStyle, saveBtnStyle, cancelBtnStyle, iconBtnStyle, fmtShort,
} from "./tema.jsx";
import { aylikOzet } from "../lib/aylik-ozet.js";
import { tahsilatDokumu, odemeDokumu } from "../lib/para-hareketleri.js";
import { buAyinCumleleri, kasaKarFarki } from "../lib/sade-ozet.js";
import { tahsilatRaporuHtml, odemeRaporuHtml, aylikOzetRaporuHtml } from "../lib/muhasebe-belgesi.js";
import { giderDagilimi, yuzdeMetni } from "../lib/gider-dagilimi.js";
import { finansHareketleri, eksikBilgiOzeti } from "../lib/finans-hareketleri.js";
import { finansMutabakati } from "../lib/finans-mutabakat.js";
import { finansSekmeleri, aktifFinansSekmesi } from "../lib/finans-sekmeleri.js";
import { maliTahmin, dusenMarkaSatirlari, VARSAYILAN_AY_ADEDI } from "../lib/mali-tahmin.js";

/**
 * FİNANS — para ekranlarının TEK menüsü.
 *
 * Sekmeler kişinin iznine göre çiziliyor ve liste `lib/finans-sekmeleri.js`'te:
 * `finans` izni Finans sekmelerini, `odemeTakvimi` izni yalnızca Ödemeler sekmesini
 * açar, Doğrulama yalnızca yöneticide. "Ödeme Takvimi" ayrı bir menü maddesiydi;
 * kaldırıldı, ekran aynen burada bir sekme (→ `README.md` Güncelleme 190).
 *
 * Tek uzun sayfaydı ve bir muhasebe programı gibi görünüyordu. Bir işletme sahibinin ilk
 * bakışta görmesi gereken dört şey vardı: kasada ne var, bu ay ne kazandım, ne kadar
 * giderim oldu, daha ne tahsil edeceğim. Onlar artık ÖZET'te; geri kalan her şey kendi
 * sekmesinde ve hiçbir işlev kaybolmadı.
 *
 * HESAPLAMA MOTORUNA DOKUNULMADI: bütün rakamlar tema.jsx'teki computeLive()'dan geliyor,
 * bu dosya yalnızca gösteriyor.
 */

/* GİDER DAĞILIMI RAMPASI — "Para Nereye Gidiyor?" şeridi ve satır kutucukları.
 *
 * TEK indigo rampası, büyükten küçüğe. İkinci bir vurgu rengi YOK; durum renkleri
 * (success/warning/danger) burada KULLANILMAZ — bir gider kalemi "iyi" ya da "kötü"
 * değil, yalnızca büyük ya da küçük. Renk kimlik de taşımıyor: kimliği satır etiketi
 * taşıyor, renk yalnızca şeritle satırı eşleştiriyor.
 *
 * `T`'ye alınmadı çünkü bu bir tema jetonu değil, sıralı bir veri rampası: altı tonun
 * arasındaki FARK anlam taşıyor ve iki temada da aynı kalması gerekiyor. */
const GIDER_RAMPASI = ["#C3CBFF", "#8D99FB", "#6472F6", "#4F61DE", "#7C8CFA", "#5B6EF5"];

const KALEM_FIELDS = [
  { key: "kalem", label: "Kalem Adı", type: "text" },
  { key: "tutar", label: "Tutar (₺)", type: "number" },
  { key: "tekrar", label: "Tekrar", type: "select", options: [{ value: "sabit", label: "Sabit (her ay tekrar eder)" }, { value: "tek seferlik", label: "Tek seferlik (bu ayla sınırlı)" }] },
];
const GELIR_FIELDS = [
  ...KALEM_FIELDS,
  { key: "faturali", label: "Faturalı mı? (KDV %20 otomatik hesaplanır)", type: "select", options: [{ value: "evet", label: "Evet - Faturalı (KDV'li)" }, { value: "hayir", label: "Hayır - Faturasız" }] },
];
const BEKLEYEN_FIELDS = [{ key: "musteri", label: "Müşteri", type: "text" }, { key: "tutar", label: "Tutar (₺)", type: "number" }, { key: "vade", label: "Vade Tarihi", type: "date" }];
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

/* SEKME LİSTESİ ARTIK `lib/finans-sekmeleri.js`'TE — burada elle kopyalanmıyor.
 *
 * Sebebi: menüde tek "Finans" maddesi var ve içindeki sekmeler kişinin iznine göre
 * çiziliyor. Aynı kuralı hem menüyü çizen App.jsx'in İKİ kabuğunun hem de bu bileşenin
 * bilmesi gerekiyor; JSX'e gömülen kural Node'dan çağrılamıyor ve hiçbir test onu
 * sınayamıyor (`marcus-mimari` §4). Kural saf modülde, burası yalnızca çiziyor. */

export function MiniList({ title, icon, items, fields, renderRow, onAdd, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card style={{ padding: "18px 22px" }}>
      <SectionTitle action={icon}>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < items.length - 1 ? `1px solid ${T.borderSoft}` : "none", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item)}</div>
            <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu kayıt silinsin mi?")) onDelete(item.id); }}><Trash2 size={13} color={T.danger} /></button>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter", padding: "8px 0" }}>Henüz kayıt yok.</div>}
      </div>
      {adding ? (
        <FieldForm fields={fields} onSubmit={(v) => { onAdd(v); setAdding(false); }} onCancel={() => setAdding(false)} submitLabel="Ekle" />
      ) : (
        <button style={addBtnStyle} onClick={() => setAdding(true)}><Plus size={13} /> {addLabel}</button>
      )}
    </Card>
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
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Aylık & Yıllık Karşılaştırma</SectionTitle>

      <div className="marcus-table-wrap" style={{ marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
          <thead>
            <tr>
              {["Ay", "Ciro", "Gider", "Net", "Değişim"].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withDelta.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <td style={{ padding: "6px 10px", fontSize: 13, color: T.text, fontWeight: m.id === "live" ? 600 : 400, fontFamily: "Inter" }}>{m.ay} {m.yil}{m.id === "live" && " (şimdi)"}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.text }}>{fmt(m.ciro)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.textDim }}>{fmt(m.gider)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: T.success }}>{fmt(m.net)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, fontFamily: "Inter" }}>
                  {m.ciroDelta === null ? <span style={{ color: T.textFaint }}>—</span> : <span style={{ color: m.ciroDelta >= 0 ? T.success : T.danger }}>{m.ciroDelta >= 0 ? "+" : ""}{m.ciroDelta}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", fontWeight: 600, marginBottom: 10 }}>YILLIK TOPLAMLAR</div>
      {yillar.length < 2 && (
        <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", marginBottom: 8 }}>
          Karşılaştırma için en az 2 yıllık veri gerekiyor — şu an sadece {yillar[0]?.yil} verisi var. Aylar birikince burada geçen yılla otomatik karşılaştırma göreceksin.
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {yillar.map((y, i) => {
          const prevYear = yillar[i - 1];
          const delta = prevYear && prevYear.ciro ? Math.round(((y.ciro - prevYear.ciro) / prevYear.ciro) * 100) : null;
          return (
            <div key={y.yil} style={{ flex: "1 1 160px", minWidth: 160, padding: "12px 15px", background: T.surfaceRaised, borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", marginBottom: 6 }}>{y.yil} ({y.ayCount} ay)</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, color: T.text, fontWeight: 600 }}>{fmt(y.ciro)}</div>
              {delta !== null && (
                <div style={{ fontSize: 13, fontFamily: "Inter", color: delta >= 0 ? T.success : T.danger, marginTop: 4 }}>{delta >= 0 ? "+" : ""}{delta}% önceki yıla göre</div>
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
const TR_AYLAR_TAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** "26 Ağu" gibi serbest metin tarihleri gün/ay olarak ayrıştırır (yıl bilgisi yoktur, varsayılan olarak yok sayılır). */
/** Bugünün tarihi, tarih seçicilerin (input type="date") beklediği YYYY-AA-GG biçiminde. */
/**
 * Tarihleri ekranda okunur gösterir. Tarih seçicilerden gelen YYYY-AA-GG değerini
 * "26 Ağustos 2026" biçimine çevirir; eski kayıtlardaki serbest metin tarihleri
 * ("26 Ağu", "11.08.2026") olduğu gibi geçirir — geçmiş veri bozulmasın diye.
 */

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

/* ------------------------------------------------------------------ */
/* AY AY GELİR–GİDER                                                    */
/* ------------------------------------------------------------------ */
/**
 * Geçmiş, "Ayı kapat" fotoğraflarından DEĞİL kayıtların kendisinden türetiliyor
 * (`lib/aylik-ozet.js`). Düğmeye hiç basılmamış aylar da görünüyor.
 *
 * NE GÖSTERİLMİYOR, BİLEREK: sabit giderlerin (ofis, maaş, üyelik, gider kalemleri)
 * ay ay geçmişi belgede TUTULMUYOR — yalnızca bugünkü değerleri var. Geçmiş bir aya
 * bugünkü kirayı yazmak, o ay farklıysa yalan üretir. Bu yüzden hiç yazılmıyor ve
 * tablonun altında sebebi söyleniyor.
 */
function AyAyKarsilastirma({ data, chartData }) {
  const ozet = useMemo(() => aylikOzet({
    clients: data.clients,
    cekimIsleri: data.cekimIsleri,
    isUcretleri: data.isUcretleri,
    isUcretDetaylari: data.isUcretDetaylari,
    enFazlaAy: 12,
  }), [data.clients, data.cekimIsleri, data.isUcretleri, data.isUcretDetaylari]);

  const AY_ADI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const ayEtiketi = (ay) => {
    const [y, a] = String(ay).split("-").map(Number);
    return `${AY_ADI[a - 1] || ay} ${y}`;
  };

  const bs = { padding: "0 10px 8px", fontSize: 10.5, color: T.textFaint, fontWeight: 700,
    letterSpacing: 0.3, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" };
  const hc = { padding: "10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13, whiteSpace: "nowrap" };

  return (
    <>
      <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
        <SectionTitle>Ay Ay Gelir–Gider</SectionTitle>
        <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter, sans-serif",
          lineHeight: 1.6, marginBottom: 14 }}>
          <strong>Hak edilen</strong> o ayın hizmet bedeli — o ayki ücretle hesaplanır, bugünküyle
          değil. <strong>Tahsil edilen</strong> gerçekten alınan para. <strong>Fark</strong> o aydan
          hâlâ tahsil edilmemiş olan.
        </div>

        {ozet.satirlar.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.textFaint }}>Henüz kayıt yok.</div>
        ) : (
          <div className="marcus-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
              <thead>
                <tr>
                  <th style={{ ...bs, textAlign: "left" }}>AY</th>
                  <th style={{ ...bs, textAlign: "right" }}>HAK EDİLEN</th>
                  <th style={{ ...bs, textAlign: "right" }}>TAHSİL EDİLEN</th>
                  <th style={{ ...bs, textAlign: "right" }}>FARK</th>
                  <th style={{ ...bs, textAlign: "right" }}>FREELANCER GİDERİ</th>
                </tr>
              </thead>
              <tbody>
                {ozet.satirlar.map((r) => (
                  <tr key={r.ay} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px", fontSize: 13, color: T.text,
                      fontFamily: "Inter, sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {ayEtiketi(r.ay)}
                    </td>
                    <td style={{ ...hc, color: T.text }}>{fmt(r.tahakkuk)}</td>
                    <td style={{ ...hc, color: r.tahsilat > 0 ? T.success : T.textFaint }}>{fmt(r.tahsilat)}</td>
                    <td style={{ ...hc, color: r.fark > 0 ? T.warning : T.textFaint }}>{fmt(r.fark)}</td>
                    <td style={{ ...hc, color: r.freelancerGideri > 0 ? T.danger : T.textFaint }}>
                      {fmt(r.freelancerGideri)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${T.border}` }}>
                  <td style={{ padding: "10px", fontSize: 12, color: T.textFaint,
                    fontFamily: "Inter, sans-serif", fontWeight: 700 }}>TOPLAM</td>
                  <td style={{ ...hc, color: T.text, fontWeight: 700 }}>{fmt(ozet.toplam.tahakkuk)}</td>
                  <td style={{ ...hc, color: T.success, fontWeight: 700 }}>{fmt(ozet.toplam.tahsilat)}</td>
                  <td style={{ ...hc, color: T.warning, fontWeight: 700 }}>{fmt(ozet.toplam.fark)}</td>
                  <td style={{ ...hc, color: T.danger, fontWeight: 700 }}>{fmt(ozet.toplam.freelancerGideri)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* NE GÖSTERİLMEDİĞİ AÇIKÇA YAZILIYOR — eksik bir tabloyu tam sanmak,
          * hiç tablo olmamasından kötüdür. */}
        <div style={{ marginTop: 14, fontSize: 11.5, color: T.textFaint,
          fontFamily: "Inter, sans-serif", lineHeight: 1.7, borderTop: `1px solid ${T.border}`,
          paddingTop: 12 }}>
          <strong>Bu tabloda sabit giderler yok.</strong> Ofis gideri, maaşlar, üyelikler ve
          gider kalemlerinin ay ay geçmişi sistemde tutulmuyor — yalnızca bugünkü tutarları
          var. Geçmiş bir aya bugünkü kirayı yazmak o ay farklıysa yanlış olurdu. Aşağıdaki
          "Ay kapanışları" tablosu, "Ayı kapat" dediğin aylarda o günkü toplam gideri saklıyor.
          <br />
          <strong>Ayrılan ya da dondurulan markalar:</strong> hangi ay ayrıldıkları kayıtlı
          olmadığı için geçmiş aylarda yalnızca <em>ödeme kaydı bulunan</em> aylarda sayılıyorlar.
          {ozet.toplam.isUcretiEksik > 0 && (
            <>
              <br />
              <span style={{ color: T.warning }}>
                Freelancer gideri <strong>eksik</strong>: {ozet.toplam.isUcretiEksik} iş–kişi
                eşleşmesinde iş başı ücret tanımlı değil ve sıfır sayıldı.
              </span>
            </>
          )}
        </div>
      </Card>

      {/* AY KAPANIŞLARI — bu tablo YAZILMIŞ ama hiçbir yere bağlanmamıştı, yani
        * hiç görünmüyordu. Türetilen tablonun tamamlayıcısı: sabit giderler yalnızca
        * burada, o gün kaydedilmiş hâliyle duruyor. */}
      <Karsilastirma chartData={chartData} />
    </>
  );
}


/* ------------------------------------------------------------------ */
/* RAPORLAR — yazdırılabilir (PDF) dökümler                             */
/* ------------------------------------------------------------------ */
/**
 * Belgelerin HTML'i `lib/muhasebe-belgesi.js`'te (saf, testten çağrılabiliyor); burada
 * yalnızca dönem seçimi ve pencere açma var — pencere açmak zaten sınanamaz.
 *
 * PDF için yeni paket YOK: müşteri ekstresiyle aynı yol — yeni pencere, sonra tarayıcının
 * yazdırma kutusu ("PDF olarak kaydet").
 */
function Raporlar({ data }) {
  const buAy = monthKey();
  const [bas, setBas] = useState(buAy);
  const [bit, setBit] = useState(buAy);
  const [tumZamanlar, setTumZamanlar] = useState(false);

  const sinir = tumZamanlar ? {} : { bas, bit };
  const firmaAdi = data.firmaAdi || "";
  const bugun = bugunISOTarih();

  const yazdir = (html) => {
    const win = window.open("", "_blank");
    if (!win) { window.alert("Yeni pencere açılamadı — tarayıcının pop-up engelleyicisini kontrol et."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    /* Küçük gecikme: içerik yerleşmeden yazdırma kutusu açılırsa belge boş basılıyor.
     * Ekstre yazdırma da aynı gecikmeyi kullanıyor. */
    setTimeout(() => win.print(), 300);
  };

  const tahsilat = () => yazdir(tahsilatRaporuHtml({
    dokum: tahsilatDokumu({ clients: data.clients, hesaplar: data.hesaplar, ...sinir }),
    firmaAdi, bugun, ...sinir,
  }));

  const odeme = () => yazdir(odemeRaporuHtml({
    dokum: odemeDokumu({
      odemeler: data.personelOdemeleri, avanslar: data.avanslar,
      hesaplar: data.hesaplar, ...sinir,
    }),
    firmaAdi, bugun, ...sinir,
  }));

  const aylik = () => {
    const live = computeLive(data);
    const aktifSayi = (data.clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").length;
    yazdir(aylikOzetRaporuHtml({
      ozet: aylikOzet({
        clients: data.clients, cekimIsleri: data.cekimIsleri,
        isUcretleri: data.isUcretleri, isUcretDetaylari: data.isUcretDetaylari, enFazlaAy: 12,
      }),
      cumleler: buAyinCumleleri({ live, markaSayisi: aktifSayi }),
      firmaAdi, bugun,
    }));
  };

  const dugme = { ...addBtnStyle, padding: "12px 16px", fontSize: 13 };
  const kutu = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surfaceRaised, color: T.text, fontSize: 12.5, fontFamily: "Inter, sans-serif" };

  const RaporSatiri = ({ ad, aciklama, onTikla }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
      padding: "14px 0", borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: "Inter, sans-serif" }}>{ad}</div>
        <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginTop: 3 }}>
          {aciklama}
        </div>
      </div>
      <button style={dugme} onClick={onTikla}>Yazdır / PDF</button>
    </div>
  );

  return (
    <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
      <SectionTitle>Raporlar</SectionTitle>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter, sans-serif",
        lineHeight: 1.6, marginBottom: 14 }}>
        Rapor yeni bir pencerede açılır ve yazdırma kutusu gelir. Oradan
        <strong> "Hedef: PDF olarak kaydet"</strong> seçersen dosya olarak indirirsin.
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5,
          color: T.textDim, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          <input type="checkbox" checked={tumZamanlar} onChange={(e) => setTumZamanlar(e.target.checked)} />
          Tüm kayıtlar
        </label>
        {!tumZamanlar && (
          <>
            <input type="month" value={bas} max={bit} onChange={(e) => setBas(e.target.value)} style={kutu} />
            <span style={{ color: T.textFaint, fontSize: 12 }}>—</span>
            <input type="month" value={bit} min={bas} onChange={(e) => setBit(e.target.value)} style={kutu} />
          </>
        )}
      </div>

      <RaporSatiri
        ad="Tahsilat Dökümü"
        aciklama="Kimden ne kadar aldın: tarih, marka, hesap, tutar ve toplam."
        onTikla={tahsilat}
      />
      <RaporSatiri
        ad="Ödeme Dökümü"
        aciklama="Kime ne kadar verdin: freelancer ödemeleri, avanslar, personel ödemeleri. Ofis gideri ve üyelikler bu dökümde YOK — onların tarihli kaydı tutulmuyor."
        onTikla={odeme}
      />
      <RaporSatiri
        ad="Aylık Gelir–Gider Özeti"
        aciklama="Tek sayfa: ay ay hak edilen, tahsil edilen, bekleyen ve freelancer gideri. Muhasebeciye ya da ortağına verilebilecek belge."
        onTikla={aylik}
      />
    </Card>
  );
}

export function hesapBakiyesi(hesapId, veri = {}) {
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

export function HesapBakiyeleri({ hesaplar, clients, transferler, avanslar, odemeler, duzeltmeler, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
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
    <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
      <SectionTitle>Hesap Bakiyeleri</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {liste.map((h) => {
          const bakiye = hesapBakiyesi(h.id, { clients, transferler, avanslar, odemeler, hesaplar: liste, duzeltmeler });
          const acik = aktarAcik === h.id;
          return (
            <div key={h.id} style={{ background: h.anaHesap ? T.accentSoft : T.surfaceRaised, borderRadius: 10, padding: "12px 15px" }}>
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
                        style={{ background: h.elleTakip ? T.warningSoft : T.surfaceRaised, border: "none", borderRadius: 999, padding: "12px 15px", cursor: "pointer", fontSize: 11, fontFamily: "Inter", color: h.elleTakip ? T.warning : T.textFaint, fontWeight: 600 }}
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
                  <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter" }}>Nereye:</span>
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
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter", fontWeight: 600, marginBottom: 8 }}>Elle Bakiye Düzeltmeleri ({(duzeltmeler || []).length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
            {[...(duzeltmeler || [])].reverse().map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "Inter", flexWrap: "wrap" }}>
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
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: T.textDim, fontFamily: "Inter", fontWeight: 600 }}
          >
            {gecmisAcik ? "▾" : "▸"} Transfer Geçmişi ({kayitlar.length})
          </button>
          {gecmisAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
              {[...kayitlar].reverse().map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: T.surfaceRaised, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "Inter", flexWrap: "wrap" }}>
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

/* ────────────────────────────────────────────────────────────────────────────────
 * DOĞRULAMA SEKMESİ — yeni finans motorunun önündeki kapı, EKRANDA
 *
 * KULLANICI BURAYA NEDEN GELDİ: "yeni hesaplama katmanı bugünkü rakamların aynısını mı
 * veriyor?" sorusunun cevabını görmek için. Bu bir KARŞILAŞTIRMA ekranı; `kompozisyon.md`
 * §2'ye göre tablo birincil, kart yok — rakamlar alt alta ve aynı sağ kenara hizalı
 * olmazsa göz onları karşılaştıramaz, oysa bu ekranın TEK işi karşılaştırma.
 *
 * İLK ÜÇ SANİYEDE GÖRÜLECEK ŞEY bir toplam değil, bir KARAR: tutuyor mu, tutmuyor mu.
 * Bu yüzden en üstte tek bir karar satırı var (kart değil — kart bir gruplama aracı,
 * tek cümlelik bir sonucu kutuya koymak onu başka bir bilgi bloğu gibi gösterirdi).
 *
 * BURADAN ÇIKMADAN YAPILACAK BİR EYLEM YOK: bu ekran rapor eder, karar vermez. Sağlıklı
 * durumda birincil düğme ÇİZİLMEZ — müşteri panelinde kurduğumuz kuralın aynısı
 * ("yapılacak bir şey yoksa düğme de yok").
 *
 * HİÇBİR RAKAM BURADA HESAPLANMIYOR. Eski taraf `computeLive` ve `hesapBakiyesi`'nden,
 * yeni taraf `lib/finans-hareketleri.js`'ten geliyor; karşılaştırmayı `lib/finans-mutabakat.js`
 * yapıyor. `finansMutabakati` eski tarafı DIŞARIDAN istiyor ve verilmezse fail-close
 * davranıp `bloke: true` döndürüyor — bu yüzden ikisi de çağrı yerinde veriliyor.
 * ──────────────────────────────────────────────────────────────────────────────── */
function DogrulamaSatiri({ satir, bicim }) {
  const farkVar = satir.fark !== 0;
  const hucre = {
    padding: "10px 8px", fontSize: 13, textAlign: "right",
    fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums",
    borderBottom: `1px solid ${T.borderSoft}`,
  };
  return (
    <tr>
      <td style={{ padding: "10px 8px", fontSize: 13, fontFamily: "Inter, sans-serif", color: farkVar ? T.danger : T.textDim, borderBottom: `1px solid ${T.borderSoft}` }}>
        {satir.ad}
      </td>
      <td style={{ ...hucre, color: T.textDim }}>{bicim(satir, satir.eski)}</td>
      <td style={{ ...hucre, color: T.textDim }}>{bicim(satir, satir.yeni)}</td>
      <td style={{ ...hucre, color: farkVar ? T.danger : T.textFaint, fontWeight: farkVar ? 700 : 400 }}>
        {bicim(satir, satir.fark)}
      </td>
    </tr>
  );
}

function Dogrulama({ data, live }) {
  /* Dönüştürülme tarihi DIŞARIDAN veriliyor: iki saf modül de `new Date()` çağırmıyor
   * (saflık şartı). Tarih burada, arayüz katmanında üretiliyor. */
  const bugun = bugunISOTarih();
  const uretim = useMemo(
    () => finansHareketleri(data, { donusturulmeTarihi: bugun }),
    [data, bugun],
  );
  const hareketler = uretim.hareketler;
  const rapor = useMemo(
    () => finansMutabakati(data, hareketler, { live, hesapBakiyesi, donusturulmeTarihi: bugun }),
    [data, hareketler, live, bugun],
  );
  const eksik = useMemo(() => eksikBilgiOzeti(hareketler), [hareketler]);

  /* Birim satırın kendisinde taşınıyor (`lib/finans-mutabakat.js`): adet satırına ₺
   * yazmak "₺3 üyelik" gibi anlamsız bir rakam üretirdi. */
  const bicim = (satir, deger) => (satir.birim === "adet" ? String(deger) : fmt(deger));

  /* BOŞ DURUM — üç parça: ne · neden · tek eylem (`bilesenler.md`). */
  if (hareketler.length === 0) {
    return (
      <Card style={{ padding: "18px 22px" }}>
        <SectionTitle>Doğrulama</SectionTitle>
        <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
          Karşılaştırılacak hiçbir para kaydı yok. Bu ekran belgedeki tahsilat, fatura, gider,
          ödeme ve hak ediş kayıtlarını yeni hesaplama katmanına çevirip bugünkü rakamlarla
          yan yana koyuyor; henüz hiç kayıt girilmediği için karşılaştıracak bir şey bulamadı.
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: T.text }}>Gelir-Gider</strong> sekmesinden ilk kalemi ekle;
            kayıt girildiği anda bu ekran kendiliğinden dolar.
          </div>
        </div>
      </Card>
    );
  }

  const tutmayan = rapor.satirlar.filter((s) => s.fark !== 0);
  /* "Karşılaştırılamadı" da bir mutabakatsızlıktır: fark satırı üretmeyen sebepler
   * (eski motor verilmedi, tarih okunamadı) `bloke`yi tek başına doğru yapabiliyor.
   * Ekranda bunu saklamak, ölçülmemiş bir rakamı "tutuyor" saymak olurdu. */
  const olculemeyen = rapor.sebepler.filter((s) => !/fark /.test(s));

  return (
    <div>
      {/* 1 · TEK KARAR SATIRI — kart değil. */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, borderRadius: 10,
        padding: "16px 16px", marginBottom: 16,
        background: rapor.bloke ? T.dangerSoft : T.successSoft,
      }}>
        <Percent size={16} color={rapor.bloke ? T.danger : T.success} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.7, color: rapor.bloke ? T.danger : T.success }}>
          {rapor.bloke ? (
            <>
              <strong>
                {tutmayan.length > 0
                  ? `${tutmayan.length} satırda fark var — geçiş ENGELLENDİ.`
                  : "Karşılaştırma tamamlanamadı — geçiş ENGELLENDİ."}
              </strong>
              <div style={{ marginTop: 6 }}>
                Yeni motor eski rakamların aynısını vermiyor. Fark sıfırlanana kadar hiçbir
                ekran yeni katmana bağlanmaz; iki ekranın aynı dönemi farklı toplaması bu
                sistemdeki en pahalı hata sınıfı.
              </div>
            </>
          ) : (
            <>
              <strong>Eski ve yeni motor birebir tutuyor.</strong>
              <div style={{ marginTop: 6 }}>
                {rapor.satirlar.length} karşılaştırma satırının hepsinde fark sıfır
                ({hareketler.length} hareket üzerinden). Yapılacak bir şey yok.
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2 · MUTABAKAT TABLOSU — bu ekranın birincil yüzeyi. */}
      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Mutabakat</SectionTitle>
        <div className="marcus-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr>
                {["Satır", "Eski", "Yeni", "Fark"].map((baslik, i) => (
                  <th key={baslik} style={{
                    padding: "8px", fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
                    color: T.textDim, fontFamily: "Inter, sans-serif",
                    textAlign: i === 0 ? "left" : "right",
                    borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
                  }}>{baslik}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rapor.satirlar.map((s) => (
                <DogrulamaSatiri key={s.ad} satir={s} bicim={bicim} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3 · EKSİK BİLGİ ÖZETİ — sayı çıplak bırakılmıyor, YORUMLANIYOR. */}
      <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle>Eksik bilgi</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.7, color: T.textDim }}>
          <div>
            {eksik.tarihsiz > 0
              ? <><strong style={{ color: T.warning }}>{eksik.tarihsiz} hareket tarihsiz</strong> — dönem raporlarında görünmüyor. Çoğu tekrar eden bir tanım (ofis gideri, maaş, üyelik): belgede ay ay geçmişleri yok, bu yüzden bir döneme yazmak yalan üretirdi. Kayıtların hiçbiri silinmedi.</>
              : <>Hareketlerin hepsinin dönemi çözüldü — dönem raporlarının dışında kalan kayıt yok.</>}
          </div>
          <div>
            {eksik.kdvBilinmeyen > 0 || eksik.stopajBilinmeyen > 0
              ? <><strong style={{ color: T.warning }}>{eksik.kdvBilinmeyen} kayıtta KDV, {eksik.stopajBilinmeyen} kayıtta stopaj bilinmiyor</strong> — kayıtta hesaplanmış bir vergi tutarı yok. Oran koda gömülmediği için uydurulmuyor; bu kayıtlar vergi dökümünde eksik çıkar.</>
              : <>Vergiye konu her kayıtta KDV ve stopaj bilgisi var.</>}
          </div>
          {eksik.tutarBilinmeyen > 0 && (
            <div><strong style={{ color: T.warning }}>{eksik.tutarBilinmeyen} kaydın tutarı bilinmiyor</strong> — toplamlara sıfır olarak giriyor, yani gider olduğundan düşük görünüyor. Vergi takvimi kalemleri ve ücreti tanımsız freelancer işleri buraya düşer.</div>
          )}
          {eksik.sirayaBagliKimlik > 0 && (
            <div><strong style={{ color: T.warning }}>{eksik.sirayaBagliKimlik} kaydın kendi kimliği yok</strong> — kimliği listedeki SIRASINA bağlı ve liste değişirse kayar. Gerçek geçiş öncesinde bu kayıtlara kimlik verilmeli.</div>
          )}
          <div style={{ color: T.textFaint, fontSize: 11 }}>
            {eksik.eksigiOlan} / {eksik.toplam} hareket en az bir eksik alan taşıyor.
          </div>
        </div>

        {(uretim.uyarilar.length > 0 || olculemeyen.length > 0) && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: T.textDim, fontFamily: "Inter, sans-serif", marginBottom: 8 }}>
              UYARI ÜRETEN KAYNAKLAR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...uretim.uyarilar, ...olculemeyen].map((u) => (
                <div key={u} style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>· {u}</div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ÖNÜMÜZDEKİ AYLAR — İLERİYE DÖNÜK MALİ TAHMİN                        */
/* ------------------------------------------------------------------ */
/**
 * NEDEN BU ŞEKİL: bu bir KARŞILAŞTIRMA ekranı (`marcus-design` → kompozisyon §2),
 * yani **tablo birincil, kart yok**. Kullanıcı buraya "önümüzdeki aylarda gelirim ne
 * olacak, hangi marka düşüyor" diye geliyor; ilk görmesi gereken şey bir toplam değil,
 * ayların yan yana dizilmiş hâli ve altında DÜŞEN markaların adı.
 *
 * HİÇBİR RAKAM BURADA HESAPLANMIYOR: tahminin tamamı `lib/mali-tahmin.js`'te ve o saf
 * modül Node'dan çağrılabiliyor (`marcus-mimari` §4 — JSX'e gömülen kural test edilemez).
 * Bu bileşenin işi yalnızca çizmek.
 *
 * GİDER DIŞARIDAN: `computeLive` `src/tema.jsx`'te ve `lib/` onu import edemez. Gider
 * verilemezse satır BOŞ kalır ve sebebi yazılır — sessizce sıfır yazmak kârı olduğundan
 * yüksek gösterirdi.
 */
function OnumuzdekiAylar({ data, buAy, sabitGider, ayAdedi = VARSAYILAN_AY_ADEDI }) {
  const tahmin = useMemo(
    () => maliTahmin(data, { baslangicAy: buAy, ayAdedi, sabitGider }),
    [data, buAy, ayAdedi, sabitGider],
  );
  const dusenler = useMemo(() => dusenMarkaSatirlari(tahmin), [tahmin]);

  const TAHMIN_AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const ayEtiketi = (ay) => {
    const [y, a] = String(ay).split("-").map(Number);
    return `${TAHMIN_AY_KISA[a - 1] || ay} ${y}`;
  };

  /* Başlık hücresi ve rakam hücresi — sayılar mono, tabular ve SAĞA hizalı: bu ekranın
   * asıl işi karşılaştırma ve hizalanmayan rakam karşılaştırılamaz. */
  const bs = { padding: "0 12px 8px", fontSize: 11, color: T.textFaint, fontWeight: 600,
    letterSpacing: 0.4, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" };
  const hc = { padding: "12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const etiketHucresi = { padding: "12px", fontSize: 13, color: T.text,
    fontFamily: "Inter, sans-serif", fontWeight: 600, whiteSpace: "nowrap" };

  const giderVar = tahmin.aylar.length > 0 && tahmin.aylar[0].gider !== null;

  return (
    <>
      <Card style={{ padding: "16px 24px", marginBottom: 16 }}>
        <SectionTitle>Önümüzdeki Aylar</SectionTitle>
        {/* ÜSTTE TEK SATIR: kaç ay ileriye bakıldığı + varsayım cümleleri. Eksik veri
          * gizlenmiyor, sayılıyor ve yazılıyor. */}
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter, sans-serif",
          lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ color: T.textDim }}>
            {tahmin.aylar.length > 0
              ? `${ayEtiketi(tahmin.aylar[0].ay)} – ${ayEtiketi(tahmin.aylar[tahmin.aylar.length - 1].ay)} arası ${tahmin.aylar.length} ay.`
              : "Gösterilecek ay yok."}
          </strong>{" "}
          {tahmin.varsayimlar.join(" ")}
        </div>

        {tahmin.aylar.length === 0 ? (
          <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter, sans-serif" }}>
            Tahmin üretilemedi.
          </div>
        ) : (
          <div className="marcus-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
              <thead>
                <tr>
                  <th style={{ ...bs, textAlign: "left" }}>AY</th>
                  {tahmin.aylar.map((r) => (
                    <th key={r.ay} style={{ ...bs, textAlign: "right" }}>{ayEtiketi(r.ay)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={etiketHucresi}>Gelir</td>
                  {tahmin.aylar.map((r) => (
                    <td key={r.ay} style={{ ...hc, color: T.text }}>{fmt(r.gelir)}</td>
                  ))}
                </tr>
                <tr style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                  <td style={etiketHucresi}>Gider</td>
                  {tahmin.aylar.map((r) => (
                    <td key={r.ay} style={{ ...hc, color: r.gider === null ? T.textFaint : T.text }}>
                      {r.gider === null ? "—" : fmt(r.gider)}
                    </td>
                  ))}
                </tr>
                <tr style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={etiketHucresi}>Net</td>
                  {tahmin.aylar.map((r) => (
                    <td key={r.ay} style={{ ...hc, fontWeight: 700,
                      color: r.net === null ? T.textFaint : (r.net < 0 ? T.danger : T.text) }}>
                      {r.net === null ? "—" : fmt(r.net)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* GİDER VERİLEMEDİYSE SEBEBİ YAZILIR — boş bir satır tek başına "veri yok" mu
          * "sıfır" mı belli etmez. */}
        {!giderVar && tahmin.aylar.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`,
            fontSize: 11, color: T.warning, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
            <strong>Gider satırı boş.</strong> Şirketin aylık gider toplamı bu ekrana
            geçirilemedi, bu yüzden gider ve net hesaplanmadı. Sıfır yazılmadı — sıfır
            gider, kârı olduğundan yüksek gösterirdi.
          </div>
        )}
      </Card>

      <Card style={{ padding: "16px 24px" }}>
        <SectionTitle>Düşen markalar</SectionTitle>
        {dusenler.length === 0 ? (
          /* ÜÇ PARÇALI BOŞ DURUM: ne · neden · tek eylem. */
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif",
            lineHeight: 1.7 }}>
            Önümüzdeki aylarda düşen marka yok. Bir markanın biteceğini biliyorsan
            müşteri kartına Bitiş Ayı yaz.
          </div>
        ) : (
          <div className="marcus-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...bs, textAlign: "left" }}>AY</th>
                  <th style={{ ...bs, textAlign: "left" }}>MARKA</th>
                  <th style={{ ...bs, textAlign: "right" }}>AYLIK TUTAR</th>
                </tr>
              </thead>
              <tbody>
                {dusenler.map((d, i) => (
                  <tr key={`${d.ay}-${d.ad}-${i}`} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                    <td style={{ ...hc, textAlign: "left", color: T.textDim }}>{ayEtiketi(d.ay)}</td>
                    <td style={etiketHucresi}>{d.ad}</td>
                    <td style={{ ...hc, color: T.danger }}>−{fmt(d.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function Finans({ data, clients, yonetici = false, izinler, odemeTakvimiIcerigi, onAddGelir, onDeleteGelir, onAddGider, onDeleteGider, onAddOfisGider, onDeleteOfisGider, onAddBekleyen, onDeleteBekleyen, onAddVergi, onDeleteVergi, onAddMonth, onDeleteMonth, onCloseMonth, onExport, onTransfer, onDeleteTransfer, onAddHesap, onDeleteHesap, onUpdateHesap, onAddDuzeltme, onDeleteDuzeltme }) {
  const [sekme, setSekme] = useState("ozet");
  const [acikGider, setAcikGider] = useState(null); // Para Nereye Gidiyor: açık kalem
  /* ALANLAR `|| []` İLE OKUNUYOR — bu ekran artık `finans` izni OLMAYAN birine de
   * çiziliyor (yalnızca `odemeTakvimi` izniyle, tek sekmeyle). Sunucu o kişiye
   * `monthly`, `gelirKalemleri`, `vergiTakvimi` gibi alanları HİÇ göndermiyor
   * (`PERMISSION_DATA_FIELDS.odemeTakvimi`), yani çıplak `data.monthly` undefined
   * geliyor ve aşağıdaki `[...monthly]` yayılımı bileşeni patlatıyordu. Sekme
   * çizilmese bile GÖVDEDEKİ HER SATIR ÇALIŞIR. */
  const monthly = data.monthly || [];
  const gelirKalemleri = data.gelirKalemleri || [];
  const giderKalemleri = data.giderKalemleri || [];
  const ofisGiderleri = data.ofisGiderleri || [];
  const bekleyenTahsilatlar = data.bekleyenTahsilatlar || [];
  const vergiTakvimi = data.vergiTakvimi || [];
  const [addingMonth, setAddingMonth] = useState(false);
  const live = computeLive(data);
  /* Rolün göremeyeceği sekme ÇİZİLMEZ ve kural saf modülde (`lib/finans-sekmeleri.js`).
   * Sekme gizlemek tek başına bir güvenlik sınırı DEĞİL — verinin kime gittiği
   * `PERMISSION_DATA_FIELDS` ile belirleniyor (→ `marcus-yetki`); burada yapılan,
   * kişiye ait olmayan bir yüzeyi ona hiç göstermemek.
   *
   * VARSAYILAN FAIL-CLOSE DEĞİL, GERİYE UYUMLU: `izinler` verilmeyen bir çağrı yeri
   * bugünkü Finans sekmelerini görür ama Ödemeler sekmesini GÖRMEZ — ödeme kayıtları
   * ayrı bir izin ve onu açık saymak yetki kazandırırdı. */
  const yetkiler = { finans: true, odemeTakvimi: false, ...(izinler || {}), yonetici };
  const gorunurSekmeler = finansSekmeleri(yetkiler);
  /* Seçili sekme artık görünmüyorsa ilk görünür sekmeye DÜŞÜLÜR (state sıfırlanmaz,
   * türetilir): yalnızca `odemeTakvimi` izni olan kişide başlangıç değeri "ozet" ve
   * o sekme ona hiç çizilmiyor — düzeltilmezse ekran BOMBOŞ açılırdı. */
  const aktifSekme = aktifFinansSekmesi(sekme, gorunurSekmeler);
  /* PARA NEREYE GİDİYOR — sıra, oran ve sıfır kalemin sebebi saf modülden geliyor
   * (`lib/gider-dagilimi.js`). Tutarların hiçbiri burada yeniden hesaplanmıyor. */
  const giderDagilim = giderDagilimi(live);
  const giderDolu = giderDagilim.kalemler.filter((x) => x.tutar > 0);
  const giderSifir = giderDagilim.kalemler.filter((x) => x.tutar === 0);
  const giderSeridiEtiketi = giderDolu.length
    ? `Gider dağılımı: ${giderDolu.map((x) => `${x.ad} ${yuzdeMetni(x.oran)}`).join(", ")}`
    : "Bu ay hiç gider kaydı yok";
  /* Alt kalemler yalnızca personelde var; kutu değil, satır altında açılıyor. */
  const giderAltKalemleri = {
    personel: [
      { ad: "Maaş", tutar: live.personelMaas },
      { ad: "SGK / sigorta", tutar: live.personelSigorta },
      { ad: "Yemek", tutar: live.personelYemek },
      { ad: "Kıdem tazminatı", tutar: live.personelTazminat },
    ],
  };
  const tahsilatOrani = live.ciro ? Math.round((live.tahsilEdilen / live.ciro) * 100) : 0;
  const chartData = [...monthly, { id: "live", ay: "Bu Ay", yil: new Date().getFullYear(), ciro: live.ciro, gider: live.gider, net: live.net }];

  const clientNames = (clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").map((c) => c.ad);
  const bekleyenFields = clientNames.length
    ? [
        { key: "musteri", label: "Müşteri", type: "select", options: clientNames.map((n) => ({ value: n, label: n })) },
        { key: "tutar", label: "Tutar (₺)", type: "number" },
        { key: "vade", label: "Vade Tarihi", type: "date" },
      ]
    : BEKLEYEN_FIELDS;

  /* Kasada: her hesabın türetilmiş bakiyesinin toplamı. Hesaplama değiştirilmedi. */
  const kasaToplami = (data.hesaplar || []).reduce((t, h) => t + hesapBakiyesi(h.id, data), 0);
  const ayAdi = `${TR_AYLAR[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const tahsilToplam = live.tahsilEdilen + live.bekleyenToplam;
  const tahsilOran = tahsilToplam > 0 ? Math.round((live.tahsilEdilen / tahsilToplam) * 100) : 0;

  return (
    <div>
      {/* SEKME ŞERİDİ — dar ekranda SAYFA kaymaz, şerit KENDİ kabında kayar.
        *
        * Sekme sayısı kişinin iznine göre değişiyor ve en fazla 8'e çıkıyor; 390px'lik
        * bir telefonda hepsi sığmaz. `overflowX: auto` + `minWidth: 0` ikilisi taşmayı
        * şeridin kendi kaydırma bölgesinde tutar: `minWidth: 0` olmadan bir flex çocuk
        * kendi içeriğinden daha dar olamaz ve taşma DIŞARI, sayfa gövdesine çıkar
        * ("sayfa gövdesi asla yatay kaymaz" — `marcus-design`).
        * `flexShrink: 0` düğmeleri ezilmekten korur; ezilselerdi metin kırpılırdı. */}
      <div role="tablist" aria-label="Finans bölümleri"
        style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4, minWidth: 0 }}>
        {gorunurSekmeler.map((s) => (
          <button key={s.key} role="tab" aria-selected={aktifSekme === s.key} onClick={() => setSekme(s.key)}
            style={{ padding: "12px 15px", borderRadius: 10, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, minHeight: 40, background: aktifSekme === s.key ? T.accentSoft : "transparent", color: aktifSekme === s.key ? T.accentText : T.textDim, fontSize: 13, fontWeight: aktifSekme === s.key ? 700 : 500, fontFamily: "Inter, sans-serif" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* HİÇ SEKME YOKSA — ne olduğu · neden · ne yapılacağı. Bu ekrana yetkisiz biri
        * normalde HİÇ ulaşamaz (menüde Finans maddesi de çizilmez, `finansMenudeMi`),
        * ama bileşen doğrudan çağrılırsa bomboş bir sayfa yerine sebep yazılır. */}
      {aktifSekme === null && (
        <Card style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
            Bu ekranda sana açık bir bölüm yok. Finans için "Finans", ödeme kayıtları
            için "Ödeme Takvimi" yetkisi gerekiyor — yöneticinden isteyebilirsin.
          </div>
        </Card>
      )}

      {aktifSekme === "ozet" && (
        <>
          {/* SADE ANLATIM — rakamlardan ÖNCE, cümlelerle.
            *
            * Ekran doğru rakamları gösteriyordu ama hangisinin ne demek olduğunu hiçbir
            * yerde yazmıyordu; "Kasada" ile "Bu ay kazanç" yan yana duruyor, tutmuyorlar
            * ve sebebi yazmıyordu. Cümleler `lib/sade-ozet.js`'te — muhasebe terimi
            * kullanmıyor ve eksik veri varsa bunu açıkça söylüyor. */}
          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <div style={{ fontSize: 15, lineHeight: 1.85, color: T.text, fontFamily: "Inter, sans-serif" }}>
              {buAyinCumleleri({
                live,
                markaSayisi: (clients || []).filter((c) => c.durum !== "ayrildi" && c.durum !== "donduruldu").length,
                bicim: fmt,
              }).map((c) => (
                <span key={c.metin} style={{
                  color: c.tur === "uyari" ? T.warning : c.tur === "sonuc" ? T.text : T.textDim,
                  fontWeight: c.tur === "sonuc" ? 700 : 400,
                }}>{c.metin}{" "}</span>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`,
              fontSize: 11.5, color: T.textFaint, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
              {kasaKarFarki({ kasa: kasaToplami, net: live.net, bicim: fmt }).metin}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            <KpiCard label="KASADA" value={fmt(kasaToplami)} accent={T.accentText} buyuk />
            <KpiCard label="BU AY KAZANÇ" value={fmt(live.net)} accent={live.net >= 0 ? T.success : T.danger} buyuk />
            <KpiCard label="TAHSİL EDİLECEK" value={fmt(live.bekleyenToplam)} accent={T.warning} buyuk />
            <KpiCard label="BU AY GİDER" value={fmt(live.gider)} accent={T.danger} buyuk />
          </div>

          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>{ayAdi}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px" }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>Gelir</span>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.ciro)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 10px" }}>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>Gider</span>
                <span style={{ fontSize: 13, color: T.danger, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.gider)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 10px", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>Net</span>
                <span style={{ fontSize: 20, color: live.net >= 0 ? T.success : T.danger, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmt(live.net)}</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
              Bu ay {fmt(live.ciro)} gelir ürettin, {fmt(live.gider)} giderin var. Net sonucun {fmt(live.net)}.
            </div>
          </Card>

          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>Tahsilat</SectionTitle>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>%{tahsilOran}</div>
            <div style={{ height: 8, borderRadius: 999, background: T.surfaceRaised, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${tahsilOran}%`, height: "100%", background: T.success, borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <span style={{ color: T.textDim }}>{fmt(live.tahsilEdilen)} tahsil edildi</span>
              <span style={{ color: T.warning }}>{fmt(live.bekleyenToplam)} bekliyor</span>
            </div>
          </Card>

<Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>Para Nereye Gidiyor? <span style={{ fontWeight: 400, opacity: 0.7 }}>— aylık</span></SectionTitle>
            {/* ÖNCE TOPLAM, SONRA ORAN ŞERİDİ, SONRA SATIR SATIR DÖKÜM.
              *
              * Eskiden altı kutucuk yan yana diziliyordu: her kutuda ayrı bir rakam,
              * hepsi aynı boyda. Hangi kalemin büyük olduğu ancak altı rakam tek tek
              * okunarak anlaşılıyordu — oysa bu ekrana gelmenin sebebi tam olarak o soru.
              * Ekranın tek büyük rakamı artık TOPLAM; kalemler arası oran tek bir
              * şeritten bakışta okunuyor, döküm altta satır satır duruyor.
              *
              * HESAP DEĞİŞMEDİ: rakamların hepsi yine `computeLive`'dan geliyor. Sıra,
              * oran ve sıfır kalemin sebebi `lib/gider-dagilimi.js`'te — JSX'e gömülen
              * kural Node'dan çağrılamıyor, yani sınanamıyor (→ marcus-mimari §4). */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: T.textDim, fontFamily: "Inter, sans-serif" }}>BU AY TOPLAM GİDER</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{fmt(giderDagilim.toplam)}</div>

            {/* ORAN ŞERİDİ — tek yatay çizgi. Ekran okuyucuya dağılımın tamamı yazıyla
              * veriliyor; renk tek başına hiçbir bilgi taşımıyor. */}
            {giderDolu.length > 0 && (
              <div role="img" aria-label={giderSeridiEtiketi}
                style={{ display: "flex", gap: 2, height: 12, marginTop: 16 }}>
                {giderDolu.map((x, i) => {
                  const sol = i === 0 ? 6 : 2;
                  const sag = i === giderDolu.length - 1 ? 6 : 2;
                  return (
                    <div key={x.anahtar} title={`${x.ad} · ${yuzdeMetni(x.oran)}`}
                      style={{ flex: x.tutar, background: GIDER_RAMPASI[i % GIDER_RAMPASI.length], borderRadius: `${sol}px ${sag}px ${sag}px ${sol}px` }} />
                  );
                })}
              </div>
            )}

            {/* DÖKÜM. Personel gibi alt kalemi olanlar tıklanınca açılır; ilk açılışta
              * kapalıdır — üst seviye rakam yeter, detay istendiğinde gelir. Tıklanabilir
              * satır gerçek bir <button>: odak çerçevesini global CSS ondan veriyor. */}
            <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
              {giderDolu.map((x, i) => {
                const alt = (giderAltKalemleri[x.anahtar] || []).filter((a) => a.tutar > 0);
                const acik = acikGider === x.anahtar;
                const satirStili = { display: "flex", alignItems: "center", gap: 12, minHeight: 40, width: "100%", padding: 0, background: "none", border: "none", textAlign: "left" };
                const satirIcerigi = (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: GIDER_RAMPASI[i % GIDER_RAMPASI.length] }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {x.ad}
                      {alt.length > 0 && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 8 }}>{acik ? "▲" : "▼"}</span>}
                    </span>
                    <span style={{ fontSize: 13, color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right" }}>
                      {fmt(x.tutar)} <span style={{ color: T.textDim }}>· {yuzdeMetni(x.oran)}</span>
                    </span>
                  </>
                );
                return (
                  <div key={x.anahtar}>
                    {alt.length > 0 ? (
                      <button type="button" onClick={() => setAcikGider(acik ? null : x.anahtar)}
                        style={{ ...satirStili, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", color: T.text }}>
                        {satirIcerigi}
                      </button>
                    ) : (
                      <div style={satirStili}>{satirIcerigi}</div>
                    )}
                    {acik && alt.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 12px 24px" }}>
                        {alt.map((a) => (
                          <div key={a.ad} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>{a.ad}</span>
                            <span style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(a.tutar)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* SIFIR KALEMLER GİZLENMİYOR — eskiden `.filter((x) => x.tutar > 0)` ile
              * ekrandan tamamen siliniyorlardı. Satırın yokluğu iki ayrı şey demekti ve
              * ikisi ayırt edilemiyordu: o ay hiç harcama olmaması ya da rakamın
              * GİRİLMEMİŞ olması. İkincisi gideri düşük, kârı yüksek gösteriyor. */}
            {giderSifir.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                {giderSifir.map((x) => (
                  <div key={x.anahtar} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, marginTop: 4, border: `1px dashed ${T.border}` }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>{x.ad}</span>
                      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginTop: 4 }}>{x.sebep}</div>
                    </span>
                    <span style={{ fontSize: 13, color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>₺0</span>
                  </div>
                ))}
              </div>
            )}
            {/* RAKAM EKSİKSE SÖYLENİR. Ücreti tanımlanmamış kişi-iş, maliyete SIFIR yazıyor —
              * sessiz kalmak gideri olduğundan düşük, kârı olduğundan yüksek gösterir. */}
            {live.isUcretiEksik > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: T.warning, fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
                Bu toplam <strong>eksik</strong>: {live.isUcretiEksik} iş–kişi eşleşmesinde iş başı
                ücret tanımlı değil ve sıfır sayıldı. Gerçek gider daha yüksek, kâr daha düşük.
                Ücretleri Personel → Freelancer'dan girebilir ya da işe özel ücret seçebilirsin.
              </div>
            )}
          </Card>
          {/* İkincil rakamlar — küçük rozet yerine üsttekiyle aynı kart biçiminde.
            * Rozet hâlinde "kalem gibi" duruyor ve okunmuyordu. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <KpiCard label="TAHSİL EDİLEN" value={fmt(live.tahsilEdilen)} accent={T.success} />
            <KpiCard label="FATURALI CİRO" value={fmt(live.faturaliCiro)} />
            <KpiCard label="KDV" value={fmt(live.kdvTutari)} accent={T.warning} />
          </div>

          {/* PARALARIM — özette yalnızca toplam; hesap dökümü Hesaplar sekmesinde */}
          {/* PARALARIM — toplam üstte, altında hangi hesapta ne kadar olduğu.
            * Yalnızca toplam gösterilince "banka hesaplarım nerede?" sorusu doğuyordu. */}
          <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
            <SectionTitle>Paralarım</SectionTitle>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(kasaToplami)}</span>
              <button onClick={() => setSekme("hesaplar")} style={{ background: "none", border: "none", color: T.accentText, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 600, padding: 0 }}>Hesapları yönet →</button>
            </div>
            {(data.hesaplar || []).length === 0 ? (
              <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif" }}>
                Henüz hesap tanımlı değil. Hesaplar sekmesinden ekleyebilirsin.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {(data.hesaplar || []).map((h) => {
                  const bakiye = hesapBakiyesi(h.id, data);
                  return (
                    <div key={h.id} style={{ background: T.surfaceRaised, borderRadius: 10, padding: "12px 15px" }}>
                      <div style={{ fontSize: 11, color: T.textDim, fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.ad}{h.anaHesap ? " · ana" : ""}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: bakiye < 0 ? T.danger : T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bakiye)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {aktifSekme === "karsilastirma" && <AyAyKarsilastirma data={data} chartData={chartData} />}

      {/* ÖNÜMÜZDEKİ AYLAR — `sabitGider` buradan veriliyor çünkü `computeLive`
        * `src/tema.jsx`'te ve `lib/mali-tahmin.js` bir `.jsx` dosyasını import edemez.
        * `buAy` da burada çözülüyor: saf modül `new Date()` çağırmıyor, çağırsaydı
        * testi takvime bağlardı. */}
      {aktifSekme === "tahmin" && (
        <OnumuzdekiAylar data={data} buAy={monthKey()} sabitGider={live.gider} />
      )}

      {aktifSekme === "raporlar" && <Raporlar data={data} />}

      {/* ÖDEMELER — eski "Ödeme Takvimi" ekranı. İçerik ÇAĞIRANDAN geliyor
        * (`odemeTakvimiIcerigi`): ekranın yirmi prop'u App.jsx'te ve orada zaten TEK
        * bir nesnede toplanıyor (`odemeTakvimiProps`). Sekmenin kendisi `odemeTakvimi`
        * izniyle çiziliyor (`lib/finans-sekmeleri.js`); aşağıdaki metin yalnızca çağıran
        * içeriği vermeyi unutursa görünür — sessiz boş ekran yerine sebebi yazan bir
        * kutu (fail-close). */}
      {aktifSekme === "tahsilat" && (odemeTakvimiIcerigi || (
        <Card style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
            Ödeme ekranı yüklenemedi. Bu bölümü görmek için "Ödeme Takvimi" yetkisi
            gerekiyor — yöneticinden isteyebilirsin.
          </div>
        </Card>
      ))}

      {aktifSekme === "gelir-gider" && (
        <>
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
<Card style={{ padding: "18px 22px", marginBottom: 16 }}>
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
            <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter", padding: "6px 0" }}>Faturalı işaretlenmiş müşteri/gelir yok.</div>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "Inter", fontWeight: 600, paddingTop: 4, borderTop: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.text }}>= Faturalı Ciro (KDV Dahil)</span>
              <span style={{ color: T.accentText, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(live.faturaliKdvDahil)}</span>
            </div>
          </div>
        </div>
      </Card>
        </>
      )}

      {aktifSekme === "hesaplar" && (
        <>
          {/* HESAP BAKİYELERİ — sekme yalnızca "Banka Hareketleri" gösteriyordu, hesapların
            * kendisi ve bakiyeleri hiç görünmüyordu. Transfer, bakiye düzeltme ve hesap
            * ekleme de buradan yapılıyor. */}
          <HesapBakiyeleri
            hesaplar={data.hesaplar || []}
            clients={clients}
            transferler={data.hesapTransferleri || []}
            avanslar={data.avanslar || []}
            odemeler={data.personelOdemeleri || []}
            duzeltmeler={data.hesapDuzeltmeleri || []}
            onTransfer={onTransfer}
            onDeleteTransfer={onDeleteTransfer}
            onAddHesap={onAddHesap}
            onDeleteHesap={onDeleteHesap}
            onUpdateHesap={onUpdateHesap}
            onAddDuzeltme={onAddDuzeltme}
            onDeleteDuzeltme={onDeleteDuzeltme}
          />

<Card style={{ padding: "18px 22px", marginTop: 16 }}>
        <SectionTitle>Banka Hareketleri <span style={{ fontWeight: 400, opacity: 0.7 }}>— Ödeme Takvimi'nde kaydedilen tüm tahsilatlar</span></SectionTitle>
        {(() => {
          const hareketler = (clients || [])
            .flatMap((c) => (c.odemeKayitlari || []).map((k) => ({ ...k, musteri: c.ad })))
            .reverse();
          if (hareketler.length === 0) {
            return <div style={{ fontSize: 13, color: T.textFaint, fontFamily: "Inter" }}>Henüz bir ödeme kaydı yok. Ödeme Takvimi sekmesinden tutar ve banka bilgisiyle kayıt ekleyebilirsin.</div>;
          }
          return (
            <div className="marcus-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 480 }}>
                <thead>
                  <tr>
                    {["Müşteri", "Banka", "Tarih", "Not", "Tutar"].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "6px 10px", fontSize: 11, color: T.textFaint, fontWeight: 600, borderBottom: `1px solid ${T.borderSoft}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hareketler.slice(0, 40).map((h, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.text, fontWeight: 600 }}>{h.musteri}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textDim }}>{h.banka || "—"}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textDim }}>{h.tarih}</td>
                      <td style={{ padding: "6px 10px", fontSize: 13, color: T.textFaint }}>{h.not || ""}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.success, fontWeight: 600 }}>{fmt(h.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
        </>
      )}

      {aktifSekme === "vergi" && (
        <>
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
                <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter" }}>{tarihGoster(v.tarih)}</div>
              </div>
              {v.durum === "yaklaşıyor" && <Pill color={T.warning} soft={T.warningSoft}>Yaklaşıyor</Pill>}
            </div>
          )}
        />
<Card style={{ padding: "18px 22px" }}>
          <SectionTitle>Gelir & Gider — Son Aylar + Bu Ay</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -18, right: 8 }} barGap={4}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="ay" tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "Inter", fontSize: 13 }} />
              <Bar dataKey="ciro" fill={T.accent} radius={[4, 4, 0, 0]} name="Gelir" />
              <Bar dataKey="gider" fill={T.textFaint} radius={[4, 4, 0, 0]} name="Gider" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: "Inter", margin: "10px 0 4px" }}>Geçmiş Ay Arşivi <span style={{ opacity: 0.7 }}>— sadece grafikte görünür, güncel hesaplamayı etkilemez</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {monthly.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < monthly.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{m.ay} {m.yil || ""}</span>
                <span style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>Ciro {fmt(m.ciro)} · Gider {fmt(m.gider)} · Net {fmt(m.net)}</span>
                <button style={iconBtnStyle} onClick={() => { if (window.confirm("Bu ay silinsin mi?")) onDeleteMonth(m.id); }}><Trash2 size={12} color={T.danger} /></button>
              </div>
            ))}
            {monthly.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, fontFamily: "Inter" }}>Henüz geçmiş ay eklenmedi.</div>}
          </div>
          {addingMonth ? (
            <FieldForm fields={MONTH_FIELDS} initial={{ yil: new Date().getFullYear() }} onSubmit={(v) => { onAddMonth(v); setAddingMonth(false); }} onCancel={() => setAddingMonth(false)} submitLabel="Ayı Ekle" />
          ) : (
            <button style={addBtnStyle} onClick={() => setAddingMonth(true)}><Plus size={13} /> Geçmiş ay ekle (arşiv)</button>
          )}
        </Card>

          {/* CSV ve AY KAPATMA — v136'da bu iki işlev Finans'a prop olarak geçiyor ama
            * hiçbir düğmeye bağlı değildi, yani erişilemiyordu. Artık burada. */}
          <Card style={{ padding: "18px 22px", marginBottom: 16 }}>
            <SectionTitle>Arşiv İşlemleri</SectionTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {onExport && (
                <button onClick={onExport} style={addBtnStyle}>CSV olarak dışa aktar</button>
              )}
              {onCloseMonth && (
                <button
                  onClick={() => { if (window.confirm("Bu ay kapatılıp arşive alınacak. Devam edilsin mi?")) onCloseMonth(); }}
                  style={{ ...addBtnStyle, background: T.warningSoft, color: T.warning }}
                >
                  Bu ayı kapat ve arşivle
                </button>
              )}
            </div>
          </Card>
        </>
      )}

      {/* DOĞRULAMA — yalnızca yönetici. `yonetici` şartı burada TEKRAR aranıyor: sekme
        * listesini süzmek düğmeyi gizler ama `sekme` durumunu garanti etmez. */}
      {aktifSekme === "dogrulama" && yonetici && (
        <Dogrulama data={data} live={live} />
      )}
    </div>
  );
}
