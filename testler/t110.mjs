/* E-POSTA HATASININ SEBEBİ EKRANA ULAŞMALI
 *
 * BULUNAN BOŞLUK: `api/daily-backup.js` gönderim başarısız olduğunda
 *   { error: "E-posta gönderilemedi.", detail: err }
 * döndürüyordu. Resend'in söylediği asıl sebep `detail` içindeydi ama arayüz
 * (`EmailYedekTest`) yalnızca `error`'ı okuyordu — yani sebep ÜRETİLİYOR ama
 * HİÇBİR EKRANA ULAŞMIYORDU.
 *
 * Sahada tam olarak bu yaşandı: alan adı taşındı, Resend doğrulaması düştü,
 * e-postalar kesildi ve kullanıcı "olmadı" dışında hiçbir şey göremedi. Sorun
 * günlerce teşhis edilemedi çünkü sistem bildiği şeyi söylemiyordu.
 *
 * Bu test iki şeyi ölçer:
 *   A) Sebep/kod kuralının kendisi (saf modül)
 *   B) Ucun o sebebi YANITA KOYDUĞU (sözleşme) — asıl düzeltme bu
 */
process.env.CRON_SECRET = "test-cron-sirri";
process.env.RESEND_API_KEY = "re_test";
process.env.BACKUP_EMAIL = "yedek@ornek.test";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { resendHatasiniCoz, yanittanSebep, neYapmali, NE_YAPMALI } from "../lib/eposta-hata.js";

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};

/* ── A) KURALIN KENDİSİ ────────────────────────────────────────────────────── */
{
  const a = resendHatasiniCoz("The marcusmedya.com domain is not verified", 403);
  t("doğrulanmamış alan adı tanınıyor", a.kod === "alan-adi-dogrulanmamis", a.kod);
  t("ham sebep korunuyor", a.sebep.includes("not verified"), a.sebep);

  /* SIRA TUZAĞI: Resend doğrulanmamış alan adına da 403 döndürüyor. Önce duruma
   * bakılsaydı bu "anahtar geçersiz" sanılır ve kullanıcı, anahtarında hiçbir sorun
   * yokken yeni anahtar üretmeye yollanırdı. */
  t("403 + alan adı metni ANAHTAR hatası sanılmıyor",
    resendHatasiniCoz("domain is not verified", 403).kod === "alan-adi-dogrulanmamis");

  t("geçersiz anahtar tanınıyor", resendHatasiniCoz("Invalid api key", 401).kod === "anahtar-gecersiz");
  t("401 tek başına anahtar hatası sayılıyor", resendHatasiniCoz("Unauthorized", 401).kod === "anahtar-gecersiz");

  const bilinmeyen = resendHatasiniCoz("something else entirely", 500);
  t("tanınmayan hata UYDURULMUYOR", bilinmeyen.kod === "bilinmiyor", bilinmeyen.kod);
  t("tanınmayan koda yönerge yazılmıyor", neYapmali(bilinmeyen.kod) === "", neYapmali(bilinmeyen.kod));

  t("boş metinde bile sebep üretiliyor", resendHatasiniCoz("", 502).sebep === "HTTP 502");

  /* Resend hatayı bazen `message`, bazen `error` alanında veriyor — ikisi de okunmalı. */
  t("yanıttaki `message` okunuyor", yanittanSebep({ message: "Invalid api key" }, 401).kod === "anahtar-gecersiz");
  t("yanıttaki `error` okunuyor", yanittanSebep({ error: "domain not verified" }, 403).kod === "alan-adi-dogrulanmamis");
  t("gövde boşsa duruma düşülüyor", yanittanSebep({}, 500).sebep === "HTTP 500");

  t("bilinen her kodun bir yönergesi var",
    ["anahtar-yok", "anahtar-gecersiz", "alan-adi-dogrulanmamis", "ag-hatasi", "alici-yok", "adres-yok"]
      .every((kod) => (NE_YAPMALI[kod] || "").length > 20));
}

/* ── B) UCUN SÖZLEŞMESİ — asıl ölçüm ───────────────────────────────────────── */
{
  await kv.set("marcus-os-data", { clients: [], cekimIsleri: [] });

  const gercekFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: "The marcusmedya.com domain is not verified." }),
  });

  const res = await cagir((await import("../api/daily-backup.js")).default, {
    method: "GET",
    headers: { authorization: "Bearer test-cron-sirri" },
  });
  global.fetch = gercekFetch;

  /* Taklit yanıt Türkçe alan adları kullanıyor: `res.kod` HTTP durumu, `res.govde` gövde.
   * Gövdenin İÇİNDEKİ `kod` ise sebep kodu — ikisi karışmasın. */
  const govde = res.govde || {};
  t("gönderim başarısızsa 500 dönüyor", res.kod === 500, String(res.kod));
  t("YANIT SEBEBİ TAŞIYOR", typeof govde.sebep === "string" && govde.sebep.includes("not verified"),
    JSON.stringify(govde.sebep));
  t("YANIT KODU TAŞIYOR", govde.kod === "alan-adi-dogrulanmamis", String(govde.kod));
  t("koda karşılık bir yönerge var", neYapmali(govde.kod).length > 20);
  t("eski `error` alanı korunuyor (arayüz kırılmasın)", govde.error === "E-posta gönderilemedi.");
}

/* ── C) YAPILANDIRMA EKSİKSE DE KOD DÖNÜYOR ────────────────────────────────── */
{
  const anahtar = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  await kv.set("marcus-os-data", { clients: [] });
  const res = await cagir((await import("../api/daily-backup.js")).default, {
    method: "GET",
    headers: { authorization: "Bearer test-cron-sirri" },
  });
  process.env.RESEND_API_KEY = anahtar;
  t("anahtar yokken kod bildiriliyor", (res.govde || {}).kod === "anahtar-yok", String((res.govde || {}).kod));
  t("anahtar yokken yönerge var", neYapmali("anahtar-yok").length > 20);
}

console.log(`\n  ${g} geçti, ${k} kaldı`);
if (k > 0) process.exit(1);
