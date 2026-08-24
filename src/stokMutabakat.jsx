import React, { useMemo, useState } from "react";
import { Card, SectionTitle, T, saveBtnStyle } from "./tema.jsx";
import { stokMutabakati } from "../lib/stok-mutabakat.js";

/**
 * STOK MUTABAKATI — "kayıtlı sayı kartlarla uyuşuyor mu?"
 *
 * Stok kartların yansıması olmalı. Elle +/− kaldırıldı; geriye tek düzeltme yolu
 * kaldı ve o da rastgele bir sayı girmiyor: hedef değeri SUNUCU kartlardan
 * hesaplıyor. Bu panel farkı gösterir ve düzeltmeyi tetikler.
 *
 * Fark yoksa panel kendini küçük bir onay satırına indiriyor — her gün bakılacak
 * bir yer değil, bir şey ters gittiğinde bakılacak bir yer.
 */
export default function StokMutabakat({ veri, onDuzelt }) {
  const [acik, setAcik] = useState(false);
  const [calisan, setCalisan] = useState(null);
  const mutabakat = useMemo(() => stokMutabakati(veri), [veri]);
  const { satirlar, toplamFark, fazlaSayisi, eksikSayisi } = mutabakat;

  const duzelt = (r) => {
    if (calisan) return;
    const yon = r.fark > 0 ? "artırılacak" : "azaltılacak";
    if (!window.confirm(
      `${r.marka}${r.sube ? ` · ${r.sube}` : ""} — ${r.tur}\n\n`
      + `Kayıtlı: ${r.kayitli}\nKartlara göre: ${r.gereken}\n\n`
      + `Sayı kartlara göre ${yon} (${r.kayitli} → ${r.gereken}). Devam edilsin mi?`,
    )) return;
    setCalisan(r.anahtar);
    Promise.resolve(onDuzelt(r)).finally(() => setCalisan(null));
  };

  if (satirlar.length === 0) {
    return (
      <Card style={{ padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ color: T.success, fontSize: 14, lineHeight: 1 }}>✓</span>
        <span style={{ fontSize: 12.5, color: T.textDim, fontFamily: "Inter" }}>
          <strong style={{ color: T.text }}>Stok mutabık.</strong> Kayıtlı sayılar Operasyon kartlarıyla birebir uyuşuyor.
        </span>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "16px 20px", marginBottom: 16, border: `1px solid ${T.warning}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <SectionTitle>Stok Mutabakatı</SectionTitle>
        <button
          onClick={() => setAcik((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.accentText, fontSize: 12.5, fontFamily: "Inter" }}
        >{acik ? "gizle" : "ayrıntı"}</button>
      </div>

      <div style={{ fontSize: 12.5, color: T.warning, fontFamily: "Inter", lineHeight: 1.6, marginTop: 4 }}>
        <strong>{satirlar.length} satırda</strong> kayıtlı sayı kartlarla uyuşmuyor
        {fazlaSayisi > 0 && <> · {fazlaSayisi} yerde fazla</>}
        {eksikSayisi > 0 && <> · {eksikSayisi} yerde eksik</>}
        {" "}(toplam {toplamFark} adet).
      </div>
      <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: "Inter", lineHeight: 1.6, marginTop: 4 }}>
        Stok, Operasyon kartlarının yansımasıdır: kart onaya girince artar, oradan çıkınca düşer.
        Düzeltme rastgele bir sayı yazmaz — hedef değeri sunucu kartlardan hesaplar.
      </div>

      {acik && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          {satirlar.map((r) => (
            <div key={r.anahtar} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "7px 11px", background: T.surface, borderRadius: 8, fontSize: 12.5, fontFamily: "Inter" }}>
              <span style={{ color: T.text, fontWeight: 600 }}>
                {r.marka}{r.sube ? ` · ${r.sube}` : ""}
                {r.oksuz && <span style={{ color: T.danger, fontWeight: 400 }}> · şube silinmiş</span>}
                <span style={{ color: T.textFaint, fontWeight: 400 }}> · {r.tur}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                <span style={{ color: T.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {r.kayitli} → <strong style={{ color: r.fark > 0 ? T.success : T.warning }}>{r.gereken}</strong>
                </span>
                <button
                  onClick={() => duzelt(r)}
                  disabled={Boolean(calisan)}
                  style={{ ...saveBtnStyle, padding: "5px 10px", fontSize: 11.5,
                    opacity: calisan ? 0.6 : 1, cursor: calisan ? "default" : "pointer" }}
                >{calisan === r.anahtar ? "…" : "Düzelt"}</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
