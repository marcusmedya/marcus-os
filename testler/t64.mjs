/* YÜKLENEN DOSYA GÖRÜNMÜYOR + SİLİNEN GÖRSEL KAPAKTA KALIYOR
 *
 * İKİ ŞİKÂYET, İKİ AYRI SEBEP.
 *
 * 1) "Yükleme tamamlandı dese de önizleme gözükmüyor, ama Drive'a dosya yüklenmiş oluyor."
 *
 *    Yükleme bitince önizleme HEMEN tazeleniyordu. Ama kayıt 500 ms gecikmeli gidiyor ve
 *    sunucu önizlemeyi VERİTABANINDAN okuyor. Yani tazeleme, medya kaydı sunucuya
 *    ULAŞMADAN soruyor; sunucu haklı olarak "bu kartta dosya yok" diyor. Anahtar
 *    değişmediği için istek bir daha yapılmıyor ve önizleme sayfa yenilenene kadar boş
 *    kalıyor.
 *
 *    Kayıtlar sıraya alındıktan sonra (t63) kayıt daha da geç ulaşabiliyor — yani bu
 *    yarış büyüdü, küçülmedi.
 *
 *    ÇÖZÜM: kart "sunucuyu bekliyor" diye işaretleniyor; kayıt ulaştığında tazeleme
 *    yeniden tetikleniyor. Sabit gecikme tahmini değil, gerçek olaya bağlı.
 *
 * 2) "Eski görseli silince kartın küçük kapağında eski ürün görseli kalıyor."
 *
 *    `editliDosyaLink` kartın kapağı gibi davranıyor ve YÜKLEMEDE atanıyordu ama
 *    SİLMEDE hiç güncellenmiyordu — `onMedyaDegis` yalnızca `medya` ve `gecmis`
 *    gönderiyordu. Drive'ın küçük resim adresi çöpe atılmış dosyayı bir süre daha servis
 *    ettiği için silinmiş olduğu anlaşılmıyordu.
 */
import {
  onizlemeAnahtari, onizlemeOku, onizlemeYaz, onizlemeyiTazele, tazelemeyiDinle,
  bellegiBosalt, sunucuyuBekle, bekleyenleriTazele, bekleyenSayisi,
} from "../lib/onizleme-bellegi.js";
import { kapakBaglantisi, guncelMedyalar, STORY_SLOT } from "../lib/asamalar.js";

let g = 0, k = 0;
const t = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };

const dosya = (slot, id) => ({ slot, versiyon: 1, dosyaId: id, mimeTur: "image/jpeg",
                               url: `https://drive.google.com/file/d/${id}/view` });

/* ---------------------------------------------------------------- */
console.log("\n1) ÖNİZLEME SUNUCUYU BEKLİYOR");

bellegiBosalt();
{
  const anahtar = onizlemeAnahtari({ isId: 42, slot: "1", boyut: 800 });
  let istekSayisi = 0;
  const birak = tazelemeyiDinle((isId) => { if (String(isId) === "42") istekSayisi += 1; });

  /* Yükleme bitti: hemen tazeleniyor (yerel durum için) ve kart işaretleniyor. */
  onizlemeyiTazele(42);
  sunucuyuBekle(42);
  t("yükleme biter bitmez bir kez isteniyor", istekSayisi === 1);
  t("kart sunucuyu bekliyor olarak işaretlendi", bekleyenSayisi() === 1);

  /* O anda sunucu henüz medyayı bilmiyor — istek 'dosya yok' dönüyor, önbelleğe
   * bir şey yazılmıyor. Eski davranışta hikâye burada bitiyordu. */
  t("başarısız istek önbelleğe yazılmıyor", onizlemeOku(anahtar) === null);

  /* Kayıt sunucuya ulaştı. */
  const tazelenen = bekleyenleriTazele();
  t("kayıt ulaşınca YENİDEN isteniyor", istekSayisi === 2,
    "eski davranışta ikinci istek hiç yapılmıyordu — dosya sayfa yenilenene kadar görünmüyordu");
  t("kaç kart tazelendiği bildiriliyor", tazelenen === 1);
  t("bekleyen listesi temizlendi", bekleyenSayisi() === 0);

  /* İkinci kez çağrılırsa boşuna istek atılmamalı. */
  t("tekrar çağrılınca boşuna istek yok", bekleyenleriTazele() === 0 && istekSayisi === 2,
    "panoda otuz kart var; gereksiz istek kaba kuvvet korumasını tetikliyor");
  birak();
}

bellegiBosalt();
{
  /* Yalnızca işaretlenen kart tazelenmeli. */
  let bir = 0, iki = 0;
  const b1 = tazelemeyiDinle((isId) => { if (String(isId) === "1") bir += 1; });
  const b2 = tazelemeyiDinle((isId) => { if (String(isId) === "2") iki += 1; });
  sunucuyuBekle(1);
  bekleyenleriTazele();
  t("yalnızca bekleyen kart tazeleniyor", bir === 1 && iki === 0);
  b1(); b2();
}
t("kimliksiz işaretleme sessizce geçiyor",
  (() => { sunucuyuBekle(null); sunucuyuBekle(undefined); return bekleyenSayisi() === 0; })());

/* ---------------------------------------------------------------- */
console.log("\n2) SİLİNEN GÖRSEL KAPAKTA KALMIYOR");

const A = dosya("1", "AAA");
const B = dosya("2", "BBB");

t("1. slayt silinince kapak İKİNCİYE geçiyor",
  kapakBaglantisi([A, B], [B], A.url) === B.url,
  "eskiden silinen dosya kapakta kalıyordu");
t("son dosya da silinince kapak boşalıyor",
  kapakBaglantisi([A], [], A.url) === "");
t("kapak zaten doğruysa değişmiyor",
  kapakBaglantisi([A, B], [A, B], A.url) === A.url);
t("kapağı olmayan karta yeni kapak veriliyor",
  kapakBaglantisi([], [A], "") === A.url);
t("STORY kapak olmuyor, slayt önce geliyor",
  kapakBaglantisi([], [dosya(STORY_SLOT, "SSS"), A], "") === A.url,
  "story bir sıra değil, ayrı bir boyut — kapak birinci slayt olmalı");

/* ---------------------------------------------------------------- */
console.log("\n3) ELLE YAZILAN BAĞLANTI KORUNUYOR");

t("elle girilen adres silmede EZİLMİYOR",
  kapakBaglantisi([A], [], "https://wetransfer.com/elle-yazilan") === "https://wetransfer.com/elle-yazilan",
  "kartta elle bağlantı alanı var; körü körüne ezmek kullanıcının adresini silerdi");
t("elle girilen adres yüklemede de korunuyor",
  kapakBaglantisi([], [A], "https://wetransfer.com/elle-yazilan") === "https://wetransfer.com/elle-yazilan");
t("dosya kimliği bağlantının içinde geçiyorsa uygulamanınki sayılıyor",
  kapakBaglantisi([{ slot: "1", versiyon: 1, dosyaId: "AAA" }], [B],
                  "https://drive.google.com/thumbnail?id=AAA&sz=w400") === B.url,
  "aynı dosyanın başka bir adres biçimi de tanınmalı");

/* ---------------------------------------------------------------- */
console.log("\n4) BAĞLANTI YERİNDE Mİ");

{
  const { readFileSync } = await import("fs");
  const oku = (yol) => readFileSync(new URL(yol, import.meta.url), "utf8");
  const takip = oku("../src/CekimEditTakibi.jsx");
  const app = oku("../src/App.jsx");

  t("medya değişince kapak yeniden hesaplanıyor",
    takip.includes("editliDosyaLink: kapakBaglantisi(job.medya, yeniMedya, job.editliDosyaLink)"),
    "hesaplanmazsa silinen görsel kapakta kalır");
  t("yükleme sonrası sunucu bekleniyor", /onizlemeyiTazele\(job\.id\);\s*\n\s*sunucuyuBekle\(job\.id\);/.test(takip));
  t("silme/taşıma sonrası da bekleniyor", (takip.match(/sunucuyuBekle\(job\.id\)/g) || []).length >= 2);
  t("App kayıt başarılı olunca bekleyenleri tazeliyor",
    app.includes("bekleyenleriTazele();"),
    "tazelemezse önizleme sayfa yenilenene kadar boş kalır");

  /* SIRALAMA KRİTİK: tazeleme yalnızca BAŞARILI kayıt yolunda olmalı. Hata ya da
   * çakışma yolunda tetiklenirse sunucuda hâlâ veri yokken sorar ve önizleme yine boş
   * kalır. `otomatikBirlestirmeSayisi.current = 0` yalnızca başarı yolunda geçiyor —
   * konumu ona göre ölçülüyor, keyfi bir karakter penceresine göre değil. */
  const basariIsareti = "otomatikBirlestirmeSayisi.current = 0;";
  t("başarı yolu tek yerde tanımlı", (app.match(/otomatikBirlestirmeSayisi\.current = 0;/g) || []).length === 1,
    "birden fazlaysa aşağıdaki ölçüm anlamını yitirir");
  t("tazeleme BAŞARI yolunda", app.indexOf("bekleyenleriTazele()") > app.indexOf(basariIsareti),
    "hata ya da çakışma yolunda tetiklenirse sunucuda hâlâ veri yoktur");
  t("tazeleme hata yakalayıcıdan ÖNCE",
    app.indexOf("bekleyenleriTazele()") < app.indexOf('.catch(() => setSaveStatus("error"))'),
    "yakalayıcıdan sonra olsaydı başarısız kayıtta da tetiklenirdi");
}

console.log(`\n${k === 0 ? "TAMAM" : "HATA VAR"} — ${g} geçti, ${k} kaldı`);
if (k > 0) process.exitCode = 1;
