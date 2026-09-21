/* ELLE YEDEK ALMA — `api/backup.js` → `action: "yedekAl"`
 *
 * NEDEN VAR: yedekler yalnızca yazma anında (`guvenliYaz`) ve gece cron'undan oluşuyordu.
 * Riskli bir işten hemen önce bilerek bir durak koymanın yolu yoktu — kullanıcı yedek
 * almak için veriyi DEĞİŞTİRMEK zorundaydı.
 *
 * BU TESTİN ASIL İŞİ dört şey:
 *
 *  1. YEDEK GERÇEKTEN OLUŞUYOR ve gece yedeğiyle AYNI anahtar şemasında. Ayrı bir şema,
 *     Ayarlar'daki listenin görmediği ve geri yüklenemeyen bir kopya üretirdi.
 *  2. AYNI İSTEK İKİ KEZ GELİNCE İKİNCİ YEDEK OLUŞMUYOR (`islemId`). Sınanan şey "aynı
 *     anahtara iki kez yazıldı mı" değil — gün bazlı anahtarda o zaten görünmez. Sınanan
 *     şey, ARADA DEĞİŞEN belgenin ilk yedeğin ÜSTÜNE yazılmaması ve güvenlik defterine
 *     ikinci satırın düşmemesi. Yan etki tekrarda çalışmamalı (`CLAUDE.md` §2).
 *  3. KİLİT ALINAMAZSA YEDEK ALINMIYOR ve KİMLİK İŞARETLENMİYOR. İşaretlenseydi
 *     tarayıcının otomatik tekrarı "bunu zaten yaptım" sanılır, yedek hiç alınmazdı.
 *  4. BOZUK BELGE YEDEKLENMİYOR. Böyle bir "yedek" listede sağlam görünür; kullanıcı
 *     gerçekten sağlam olan kopyayı aramak yerine ona güvenir.
 *
 * DAVRANIŞ sınanıyor, kaynak metni değil: hiçbir kontrol dosyanın içine `grep` atmıyor.
 */
process.env.SITE_PASSWORD = "ownerpw";
process.env.KILIT_DENEME = "1";

import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
import { bugunISO, defteriOku, guvenliYaz } from "../lib/kv-yaz.js";
const { default: yedekUcu } = await import("../api/backup.js");

let g = 0, k = 0;
const t = (ad, kosul, not) => {
  if (kosul) { g++; console.log(`  ✓ ${ad}`); }
  else { k++; console.log(`  ✗ ${ad}${not ? " — " + not : ""}`); }
};
const bolum = (baslik, adet, fn) => {
  console.log(`\n${baslik}`);
  const once = g + k;
  return Promise.resolve().then(fn)
    .catch((e) => { for (let i = g + k - once; i < adet; i++) { k++; console.log(`  ✗ [bölüm çöktü] ${e.message}`); } });
};

const KEY = "marcus-os-data";
const KILIT = "marcus-os-yazma-kilidi";
const DEFTER = "marcus-os-guvenlik-defteri";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const YABANCI = { "content-type": "application/json" };

/* Adlar bilerek gerçek dışı; buraya asla üretim verisi kopyalanmaz. */
const BELGE = (etiket) => ({
  _v: 4,
  clients: [{ id: 1, ad: `Deneme Marka ${etiket} (TEST)` }, { id: 2, ad: "İkinci Marka (TEST)" }],
  personel: [{ id: 1, ad: "Deneme Personel (TEST)" }],
  cekimIsleri: [{ id: 1 }, { id: 2 }, { id: 3 }],
  uyelikler: [{ id: 1 }],
  teklifler: [],
  stoklar: {},
});

const yedekAl = (islemId, basliklar = OWNER) =>
  cagir(yedekUcu, { method: "POST", headers: basliklar, body: { action: "yedekAl", ...(islemId ? { islemId } : {}) } });

const temizle = async () => {
  await kv.flushall();
};
const defterSay = async (olay) => (await defteriOku()).filter((x) => x.olay === olay).length;
/* "Yedek yazılmadı" iddiası TEK BİR ANAHTARA bakarak sınanamaz: elle yedek artık damgalı
 * bir ada yazıyor ve sabit bir anahtara bakan kontrol her zaman `null` görüp BOŞ YERE
 * geçerdi. Bu yüzden AİLENİN TAMAMI sayılıyor. */
const yedekSayisi = async () => (await kv.keys(`${"marcus-os-snapshot-"}*`)).length;

/* ---------------------------------------------------------------- */
await bolum("1) YEDEK GERÇEKTEN OLUŞUYOR — gece yedeğiyle AYNI şema", 6, async () => {
  await temizle();
  await kv.set(KEY, BELGE("A"));

  const r = await yedekAl("elle-yedek-1");
  t("istek kabul edildi", r.kod === 200 && r.govde.ok === true, JSON.stringify(r.govde));

  /* ANAHTAR AYNI AİLEDE AMA AYNI AD DEĞİL. Aynı aile (`marcus-os-snapshot-`) olmak zorunda:
   * listeleme, anahtar doğrulaması ve geri yükleme o önekе bakıyor. Günün otomatik adının
   * AYNISI olmamak da zorunda: `guvenliYaz` her kayıtta oraya yazıyor, yani o ad bir
   * güvenlik noktası tutamaz (bölüm 7 bunu davranışla ölçüyor). */
  const gunlukAnahtar = `marcus-os-snapshot-${bugunISO()}`;
  const anahtar = r.govde.yedekAnahtari;
  t("anahtar günlük yedek ailesinde ve bugünün tarihini taşıyor",
    typeof anahtar === "string" && anahtar.startsWith(gunlukAnahtar) && anahtar !== gunlukAnahtar,
    `gelen: ${anahtar}`);

  const yazilan = await kv.get(anahtar);
  t("yedek BELGENİN O ANKİ HÂLİNİN birebir kopyası",
    JSON.stringify(yazilan) === JSON.stringify(BELGE("A")),
    JSON.stringify(yazilan));

  t("özet kaç kayıt olduğunu söylüyor",
    r.govde.yedekOzeti && r.govde.yedekOzeti.musteri === 2
      && r.govde.yedekOzeti.cekimIsleri === 3 && r.govde.yedekOzeti.personel === 1,
    JSON.stringify(r.govde.yedekOzeti));

  /* ANA BELGEYE DOKUNULMUYOR: `_v` artarsa o anda açık olan her sekme kendini bayat sanar
   * ve yedek almak herkesin işini böler. */
  const anaBelge = await kv.get(KEY);
  t("ana belge HİÇ DEĞİŞMEDİ (_v artmadı)",
    JSON.stringify(anaBelge) === JSON.stringify(BELGE("A")), JSON.stringify(anaBelge));

  t("güvenlik defterine gece yedeğinden AYIRT EDİLEBİLİR bir satır düştü",
    (await defterSay("yedek-elle-alindi")) === 1,
    JSON.stringify(await defteriOku()));
});

/* ---------------------------------------------------------------- */
await bolum("2) AYNI İSTEK İKİ KEZ — ikinci yedek OLUŞMUYOR", 4, async () => {
  await temizle();
  await kv.set(KEY, BELGE("A"));
  const r1 = await yedekAl("elle-yedek-tekrar");
  const anahtar = r1.govde.yedekAnahtari;

  /* Belge ARADA DEĞİŞİYOR. Kimlik kontrolü olmasaydı ikinci istek bu YENİ hâli ilk
   * yedeğin üstüne yazardı — yedek "az önceki güvenli nokta" olmaktan çıkardı. */
  await kv.set(KEY, BELGE("DEGISMIS"));
  const r2 = await yedekAl("elle-yedek-tekrar");

  t("tekrar bildiriliyor", r2.kod === 200 && r2.govde.tekrarlandi === true, JSON.stringify(r2.govde));

  const yedek = await kv.get(anahtar);
  t("yedek İLK hâlde kaldı — değişen belge üstüne YAZILMADI",
    JSON.stringify(yedek) === JSON.stringify(BELGE("A")),
    JSON.stringify(yedek).slice(0, 120));

  t("YAN ETKİ TEKRARLANMADI — deftere ikinci satır düşmedi",
    (await defterSay("yedek-elle-alindi")) === 1,
    `defter: ${await defterSay("yedek-elle-alindi")}`);

  /* Kimlik BAŞKA olduğunda işlem yeniden uygulanmalı: koruma, yedek almayı engellemiyor.
   * (Aynı DAKİKA içinde olduğumuz için anahtar da aynı — damga dakika çözünürlüklü ve bu
   * bilinçli; saniyeler arayla alınmış iki nokta pratikte aynı noktadır.) */
  const r3 = await yedekAl("elle-yedek-baska");
  t("BAŞKA kimlikle yeni yedek alınıyor (koruma işi kilitlemiyor)",
    r3.govde.ok === true && !r3.govde.tekrarlandi
      && JSON.stringify(await kv.get(r3.govde.yedekAnahtari)) === JSON.stringify(BELGE("DEGISMIS")),
    JSON.stringify(r3.govde));
});

/* ---------------------------------------------------------------- */
await bolum("3) KİLİT ALINAMAZSA YEDEK YOK — ve kimlik İŞARETLENMİYOR", 4, async () => {
  await temizle();
  await kv.set(KEY, BELGE("A"));
  await kv.set(KILIT, Date.now());   // kilit başkasının elinde

  const r = await yedekAl("kilitli-deneme");
  t("meşgul yanıtı dönüyor", r.kod === 503 && r.govde.mesgul === true, JSON.stringify(r.govde));
  t("hiçbir yedek yazılmadı", (await yedekSayisi()) === 0, `yedek sayısı: ${await yedekSayisi()}`);
  t("deftere satır düşmedi", (await defterSay("yedek-elle-alindi")) === 0);

  /* ASIL KONTROL: kilit bırakıldıktan sonra AYNI kimlikle tekrar denemek ÇALIŞMALI.
   * 503'te kimlik işaretlenseydi bu istek "zaten yaptım" sanılır ve yedek hiç alınmazdı —
   * yani koruma, korumak istediği şeyi kaybettirirdi. */
  await kv.del(KILIT);
  const r2 = await yedekAl("kilitli-deneme");
  t("kilit açılınca AYNI kimlikle yedek alınabiliyor (503'te kimlik yazılmadı)",
    r2.kod === 200 && r2.govde.ok === true && !r2.govde.tekrarlandi
      && (await kv.get(r2.govde.yedekAnahtari)) !== null,
    JSON.stringify(r2.govde));
});

/* ---------------------------------------------------------------- */
await bolum("4) BOZUK ya da BOŞ BELGE YEDEKLENMİYOR", 4, async () => {
  await temizle();
  /* `kv.get` metin döndürebiliyor: bozulmuş anahtar, yarım yazma. Böyle bir "yedek"
   * listede sağlam görünür ve geri yüklenmek istendiğinde reddedilir. */
  await kv.set(KEY, "belge metin olmuş");
  const r = await yedekAl("bozuk-belge");
  t("bozuk belge REDDEDİLİYOR (409)", r.kod === 409, `gelen: ${r.kod}`);
  t("bozuk belgeden yedek YAZILMADI", (await yedekSayisi()) === 0, `yedek sayısı: ${await yedekSayisi()}`);

  await temizle();
  const r2 = await yedekAl("bos-belge");
  t("belge hiç yokken sebep söyleniyor",
    r2.kod === 400 && /Yedeklenecek veri yok/.test(r2.govde.error || ""), JSON.stringify(r2.govde));
  t("boş veritabanından yedek YAZILMADI", (await yedekSayisi()) === 0, `yedek sayısı: ${await yedekSayisi()}`);
});

/* ---------------------------------------------------------------- */
await bolum("5) YETKİSİZ İSTEK YEDEK ALAMIYOR", 3, async () => {
  await temizle();
  await kv.set(KEY, BELGE("A"));

  const r = await yedekAl("yetkisiz-deneme", YABANCI);
  t("kimliksiz istek reddediliyor", r.kod === 401 || r.kod === 403, `gelen: ${r.kod}`);
  t("yetkisiz istekten yedek OLUŞMADI", (await yedekSayisi()) === 0, `yedek sayısı: ${await yedekSayisi()}`);
  t("yetkisiz istek deftere yazılmadı", (await defterSay("yedek-elle-alindi")) === 0);
});

/* ---------------------------------------------------------------- */
await bolum("6) KİMLİKSİZ İSTEK DE ÇALIŞIR — kimlik ZORUNLU değil", 2, async () => {
  await temizle();
  await kv.set(KEY, BELGE("A"));
  const r = await yedekAl(null);
  t("islemId olmadan da yedek alınıyor", r.kod === 200 && r.govde.ok === true, JSON.stringify(r.govde));
  t("yedek yazıldı", (await kv.get(r.govde.yedekAnahtari)) !== null, r.govde.yedekAnahtari);
});

/* ---------------------------------------------------------------- */
await bolum("7) ELLE YEDEK SONRAKİ YAZMALARLA EZİLMİYOR — düğmenin ASIL İŞİ", 6, async () => {
  /* BU BÖLÜM BİR KUSURDAN DOĞDU. İlk sürüm elle yedeği GÜNÜN OTOMATİK anahtarına
   * (`marcus-os-snapshot-<bugun>`) yazıyordu. Ama `guvenliYaz` HER güvenli yazmada zaten
   * oraya yazıyor: düğmeye basmak, son kaydın oraya koyduğu içeriği aynı anahtara tekrar
   * yazmaktan ibaretti ve YENİ BİR GERİ DÖNÜŞ NOKTASI OLUŞMUYORDU. Kullanıcı "riskli
   * işlemden önce güvenlik noktası aldım" sanıyor, oysa elinde zaten var olandan başka
   * bir şey yok — etiketinin vaat ettiğini yapmayan bir özellik.
   *
   * Eski testler bunu GÖREMEZDİ çünkü "anahtar yazıldı mı, deftere düştü mü" diye
   * bakıyorlardı. Bu bölüm DAVRANIŞA bakıyor: yedeği aldıktan sonra biri normal bir kayıt
   * yapıyor ve elle alınan noktanın hâlâ yerinde durup durmadığı ölçülüyor. */
  await temizle();
  await kv.set(KEY, BELGE("A"));

  const r = await yedekAl("ezilme-testi");
  const anahtar = r.govde.yedekAnahtari;
  t("yedek alındı ve anahtarı bildirildi",
    r.kod === 200 && typeof anahtar === "string" && anahtar.length > 0, JSON.stringify(r.govde));

  t("elle yedek, günün OTOMATİK anahtarından farklı bir ada yazılıyor",
    anahtar !== `marcus-os-snapshot-${bugunISO()}`,
    `gelen: ${anahtar} — aynı ad kullanılırsa sonraki her kayıt bu noktayı ezer`);

  const yedekIcerigi = JSON.stringify(await kv.get(anahtar));

  /* ASIL KONTROL: yedeği aldıktan SONRA biri normal bir kayıt yapıyor. Gerçek yol
   * kullanılıyor (`guvenliYaz`), taklit edilmiyor — ezen şey tam olarak o. */
  await guvenliYaz(BELGE("SONRAKI-KAYIT"));

  t("sonraki kayıttan SONRA elle yedeğin içeriği DEĞİŞMEDİ",
    JSON.stringify(await kv.get(anahtar)) === yedekIcerigi,
    "elle alınan güvenlik noktası ezilmiş — düğme hiçbir şey yapmıyor demektir");
  const geriDonus = await kv.get(anahtar);
  t("elle yedek hâlâ YEDEK ANINDAKİ belgeyi taşıyor",
    geriDonus && Array.isArray(geriDonus.clients)
      && String(geriDonus.clients[0].ad).includes("Deneme Marka A (TEST)"),
    JSON.stringify(geriDonus && geriDonus.clients && geriDonus.clients[0]));

  /* Yeni ad LİSTELEMEYİ ve GERİ YÜKLEMEYİ bozmamalı — `PREFIX` ile başlamasının sebebi bu. */
  const liste = await cagir(yedekUcu, { method: "GET", headers: OWNER, query: {} });
  t("elle yedek Ayarlar'daki günlük listede görünüyor",
    (liste.govde.dates || []).some((d) => `marcus-os-snapshot-${d}` === anahtar),
    JSON.stringify(liste.govde.dates));

  const geri = await cagir(yedekUcu, { method: "POST", headers: OWNER, body: { key: anahtar } });
  t("elle yedekten GERİ YÜKLENEBİLİYOR (anahtar doğrulaması bozulmadı)",
    geri.kod === 200 && geri.govde.ok === true, JSON.stringify(geri.govde).slice(0, 160));
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR.
 *
 * Bir bölüm `await` edilmezse ya da `bolum()` çağrısı silinirse test hiçbir şey ölçmeden
 * 0 ile çıkar — koşucu da yakalayamaz (çıkış kodu 0, ✗ yok). Bu yaşandı (t95).
 * KONTROL EKLERKEN BU SAYIYI DA ARTIR. */
const BEKLENEN = 29;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
