/* API FONKSİYON SAYISI SABİTİ BAYAT MI
 *
 * Sağlık ekranı kaç serverless fonksiyon kullanıldığını gösteriyor. Sayı çalışma
 * anında sayılamıyor (fonksiyon paketlenmiş halde çalışıyor, dosya sistemi kaynak
 * ağacını yansıtmıyor), bu yüzden lib/sistem-sagligi.js'de sabit tutuluyor.
 *
 * Sabit bayatlarsa ekran YANLIŞ bilgi gösterir — üstelik tam da "sınıra ne kadar
 * kaldı" sorusunda, yani yanlış olmasının en pahalı olduğu yerde. Bu denetim sabiti
 * gerçek dosya sayısıyla karşılaştırır.
 */
import { readdirSync } from "node:fs";
import { API_FONKSIYON_SAYISI, FONKSIYON_SINIRI } from "../lib/sistem-sagligi.js";

const gercek = readdirSync(new URL("../api/", import.meta.url)).filter((f) => f.endsWith(".js")).length;
let hata = 0;
const t = (ad, ok, not) => { if (ok) console.log(`  ✓ ${ad}`); else { hata++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); } };

t("sabit gerçek dosya sayısıyla aynı", API_FONKSIYON_SAYISI === gercek,
  `gerçek: ${gercek}, sabit: ${API_FONKSIYON_SAYISI}`);
t("Vercel Hobby sınırı aşılmadı", gercek <= FONKSIYON_SINIRI,
  `${gercek} > ${FONKSIYON_SINIRI} — dağıtım tamamen başarısız olur`);

if (hata > 0) process.exitCode = 1;
