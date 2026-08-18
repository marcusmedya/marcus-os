/* ESKİ DOSYALARI YENİ DÜZENE ALMA
 *
 * NEDEN BU TEST VAR:
 *   Bu işlem CANLI Drive'da toplu dosya taşıyor ve kart verisini değiştiriyor. Yanlış
 *   davranması pahalı ve geri alması zor. Dört şey kritik:
 *
 *   1. ZATEN yeni düzendeki kartlara DOKUNMAMALI — dokunursa dosyayı gereksiz yere oynatır
 *      ve versiyon geçmişini ezer.
 *   2. RAPOR hiçbir şey değiştirmemeli — "ne olacak" sorusu, olduktan sonra sorulamaz.
 *   3. Sürüm sayacı yanıtta dönmeli. Dönmezse tarayıcı geride kalır, sonraki kayıt sahte
 *      çakışma alır ve kullanıcının o anki düzenlemesi silinir.
 *   4. Yalnızca YÖNETİCİ çalıştırabilmeli.
 */
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.DRIVE_ONAY_KLASOR_ID;

const hash = (x, s) => crypto.scryptSync(x, s, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
const PERSONEL = { "x-staff-username-b64": b64("p"), "x-staff-password-b64": b64("1234"), "content-type": "application/json" };

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");
const cagri = (headers, body) => cagir(h, { method: "POST", headers, query: {}, body });
const oku = () => kv.get("marcus-os-data");
const LINK = (id) => `https://drive.google.com/file/d/${id}/view`;

const VERI = () => ({
  _v: 4,
  clients: [
    { id: 1, ad: "VIZZ", driveOnayKlasoru: "https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrs" },
    { id: 2, ad: "DRIVESIZ" },
  ],
  cekimIsleri: [
    // eski usul: bağlantı var, versiyon yok, aşamasının klasör karşılığı var
    { id: 1, marka: "VIZZ", icerikTuru: "Eski Reels", asama: "Onaylandı",
      editliDosyaLink: LINK("ESKI1_aaaaaaaaaaaaaaaaaaaa"), gecmis: [] },
    // ZATEN yeni düzende — dokunulmamalı
    { id: 2, marka: "VIZZ", icerikTuru: "Yeni", asama: "Onaylandı",
      medya: [{ versiyon: 2, dosyaId: "YENI", ad: "v2.mp4" }], editliDosyaLink: LINK("YENI_dddddddddddddddddddd"), gecmis: [] },
    // dosyası hiç yok
    { id: 3, marka: "VIZZ", icerikTuru: "Boş", asama: "Edit Yapılıyor", gecmis: [] },
    // markanın Drive klasörü yok
    { id: 4, marka: "DRIVESIZ", icerikTuru: "Eski", asama: "Onaylandı",
      editliDosyaLink: LINK("ESKI2_bbbbbbbbbbbbbbbbbbbb"), gecmis: [] },
    // aşamasının klasör karşılığı yok — taşınmaz ama versiyon kaydı yazılır
    { id: 5, marka: "VIZZ", icerikTuru: "Erken", asama: "Edit Yapılıyor",
      editliDosyaLink: LINK("ESKI3_cccccccccccccccccccc"), gecmis: [] },
  ],
  personelHesaplari: [{ id: "p1", ad: "P", kullaniciAdi: "p", sifreHash: hash("1234", "s"), sifreSalt: "s",
    izinler: { cekimEdit: true } }],
});

console.log("ESKİ DOSYALARI DÜZENE ALMA\n");

/* ---- 1. YETKİ ---- */
console.log(" Yetki");
await kv.set("marcus-os-data", VERI());
let r = await cagri(PERSONEL, { driveAction: "duzeneAl" });
t("personel çalıştıramıyor", r.kod === 403, `HTTP ${r.kod}`);
r = await cagri(PERSONEL, { driveAction: "duzeneAl", uygula: true });
t("personel uygulayamıyor da", r.kod === 403, `HTTP ${r.kod}`);

/* ---- 2. RAPOR ---- */
console.log("\n Rapor");
const oncekiVeri = JSON.stringify(await oku());
r = await cagri(OWNER, { driveAction: "duzeneAl" });
t("rapor dönüyor", r.kod === 200 && Array.isArray(r.govde.liste), `HTTP ${r.kod}`);
t("yalnızca eski usul kartlar sayılıyor", r.govde.toplam === 3, `${r.govde.toplam} (1, 4, 5 olmalı)`);
const idler = (r.govde.liste || []).map((x) => x.isId).sort();
t("zaten yeni düzendeki kart listede YOK", !idler.includes(2), JSON.stringify(idler));
t("dosyası olmayan kart listede yok", !idler.includes(3), JSON.stringify(idler));
t("Drive klasörü olmayan marka uyarısı var", (r.govde.driveSizMarkalar || []).includes("DRIVESIZ"),
  JSON.stringify(r.govde.driveSizMarkalar));
t("aşamasının hedefi olmayan kart 'yerinde kalır' diye işaretli",
  (r.govde.liste || []).some((x) => x.isId === 5 && !x.hedefKlasor));
t("RAPOR HİÇBİR ŞEYİ DEĞİŞTİRMİYOR", JSON.stringify(await oku()) === oncekiVeri);

/* ---- 3. UYGULAMA ---- */
console.log("\n Uygulama");
r = await cagri(OWNER, { driveAction: "duzeneAl", uygula: true });
let d = await oku();
const kart = (id) => (d.cekimIsleri || []).find((j) => j.id === id) || {};
t("işlem tamamlanıyor", r.kod === 200 && r.govde.ok === true, `HTTP ${r.kod}`);
t("eski karta V1 yazıldı", (kart(1).medya || []).length === 1 && ((kart(1).medya || [])[0] || {}).versiyon === 1,
  JSON.stringify(kart(1).medya));
t("dosya kimliği bağlantıdan çıkarıldı", (kart(1).medya || [])[0] && kart(1).medya[0].dosyaId === "ESKI1_aaaaaaaaaaaaaaaaaaaa", (kart(1).medya || [])[0] && kart(1).medya[0].dosyaId);
t("aktarıldığı işaretlendi", ((kart(1).medya || [])[0] || {}).aktarilan === true);
t("kartın geçmişine not düştü",
  (kart(1).gecmis || []).some((x) => /yeni düzene alındı/i.test(x.aciklama || "")));

t("ZATEN yeni düzendeki kartın versiyonu bozulmadı",
  (kart(2).medya || []).length === 1 && ((kart(2).medya || [])[0] || {}).versiyon === 2, JSON.stringify(kart(2).medya));
t("dosyası olmayan karta dokunulmadı", kart(3).medya === undefined);
t("Drive'ı olmayan markaya da versiyon yazıldı", (kart(4).medya || []).length === 1,
  "dosya kartta duruyor, V1 işaretlemek Drive'dan bağımsız kazanç");
t("aşama hedefi olmayan karta da versiyon yazıldı", (kart(5).medya || []).length === 1);
t("taşınamayanın sebebi bildiriliyor",
  (r.govde.sonuclar || []).every((x) => x.tasindi || x.zatenOrada || Boolean(x.sebep)),
  JSON.stringify((r.govde.sonuclar || []).map((x) => x.sebep)));

/* ---- 4. SÜRÜM SAYACI ---- */
console.log("\n Sürüm sayacı");
t("yanıt _v taşıyor", typeof r.govde._v === "number", String(r.govde._v));
t("yanıttaki _v sunucudakiyle AYNI", r.govde._v === d._v, `yanıt ${r.govde._v} / kv ${d._v}`);

/* ---- 5. İKİNCİ ÇALIŞTIRMA ---- */
console.log("\n Tekrar çalıştırılırsa");
const vOnce = d._v;
r = await cagri(OWNER, { driveAction: "duzeneAl" });
t("işlenecek kart kalmadı", r.govde.toplam === 0, String(r.govde.toplam));
r = await cagri(OWNER, { driveAction: "duzeneAl", uygula: true });
d = await oku();
t("ikinci uygulama kartları bozmuyor", (kart(1).medya || []).length === 1 && ((kart(1).medya || [])[0] || {}).versiyon === 1,
  JSON.stringify(kart(1).medya));
t("aynı not ikinci kez düşmüyor",
  (kart(1).gecmis || []).filter((x) => /yeni düzene alındı/i.test(x.aciklama || "")).length === 1,
  String((kart(1).gecmis || []).length));

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
