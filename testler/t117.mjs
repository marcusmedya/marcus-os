/* SUNUCU HATASININ KULLANICIYA ANLATILMASI — `lib/istek-hatasi.js`
 *
 * NEDEN VAR (sahadan bildirildi): yönetici Üyelikler ekranında bir işlem yaptı ve beyaz
 * bir `alert` kutusunda yalnızca "Yetkisiz." gördü. Oturum süresi dolmuştu; sayfa açık
 * kaldığı için veriler ekranda duruyordu ama yazma isteği 401 ile reddediliyordu. Ham
 * sunucu metni ekrana basıldığı için mesaj ne SEBEBİ ne de YAPILACAĞI söylüyordu.
 *
 * DAVRANIŞ SINANIYOR, METİN DEĞİL. Hiçbir kontrol "şu cümle aynen yazıyor mu" diye
 * bakmıyor; hepsi modülü ÇAĞIRIP dönen nesnenin taşıdığı BİLGİYİ ölçüyor:
 *   · 401 oturumu düşürüyor mu (dal ayrımı)
 *   · 403 oturumu düşürMÜYOR mu (karıştırılırsa yetkisi olmayan kişi boş yere çıkış yapar)
 *   · mesaj sebep + yapılacak taşıyor mu (iki ayrı bilgi, ikisi de zorunlu)
 *   · sunucunun kendi mesajı yutuluyor mu
 *   · girdi değişiyor mu (saflık)
 *
 * Cümlelerin kendisi yeniden yazılabilsin diye kontroller ANAHTAR KAVRAMLARI arıyor
 * (birden fazla eşanlamlıdan en az biri), tam cümleyi değil.
 */
import { istekHatasi, hataMetni, sunucuMesaji, OTURUM_SURESI_SAAT, OTURUM_HATIRLA_GUN } from "../lib/istek-hatasi.js";
import { SURE_NORMAL, SURE_HATIRLA } from "../lib/oturum.js";

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

/* Küçük harfe çevirirken Türkçe kuralı: "İ" → "i". Aksi hâlde "İZİN" aranan kelimeyi
 * kaçırırdı ve kontrol sessizce yanlış cevap verirdi. */
const kucuk = (s) => String(s || "").toLocaleLowerCase("tr");
/** Verilen eşanlamlılardan EN AZ BİRİ geçiyor mu? Cümle yeniden yazılsa da ayakta kalır. */
const iceriyorBiri = (metin, kelimeler) => kelimeler.some((x) => kucuk(metin).includes(kucuk(x)));

/* "NE YAPILACAK" İMZASI: kullanıcıyı bir EYLEME yollayan kelimeler. Bir hata mesajının
 * bu projede taşıması ZORUNLU olan yarısı bu (lib/eposta-hata.js → neYapmali dersi). */
const YAPILACAK_IMZALARI = ["yeniden gir", "tekrar", "yenile", "iste", "bildir", "bekle", "kontrol et"];

await bolum("1) 401 — KİMLİK: oturum düştü", 6, async () => {
  const h = istekHatasi(401, { error: "Yetkisiz." });
  t("401 oturumDustu: true döndürüyor", h.oturumDustu === true, `gelen ${h.oturumDustu}`);
  t('401 türü "oturum"', h.tur === "oturum", `gelen ${h.tur}`);
  t("401 başlığı boş değil", typeof h.baslik === "string" && h.baslik.length > 0);
  /* SEBEP: kullanıcı "yetkim alınmış" sanıyordu; mesaj KİMLİĞİN doğrulanamadığını
   * söylemek zorunda. */
  t("401 mesajı SEBEBİ söylüyor (oturum/süre/doğrulayamadı)",
    iceriyorBiri(h.mesaj, ["oturum", "süre", "doğrulayamadı"]), h.mesaj);
  t("401 mesajı NE YAPILACAĞINI söylüyor",
    iceriyorBiri(h.mesaj, YAPILACAK_IMZALARI), h.mesaj);
  /* Kullanıcının yazdığı ve kaydedilemeyen veri kaybolacak — mesaj bunu söylemeli. */
  t("401 mesajı kaydedilmediğini/verinin yeniden girileceğini söylüyor",
    iceriyorBiri(h.mesaj, ["kaydedilmedi", "yeniden girmen"]), h.mesaj);
});

await bolum("2) 403 — YETKİ: 401'den AYRI dal", 5, async () => {
  const h = istekHatasi(403, { error: "Bu işlem için yetkin yok." });
  /* BU KONTROL BU DOSYANIN EN ÖNEMLİSİ. İki dal birleştirilirse yetkisi olmayan kişi
   * boş yere çıkış yapıp yeniden girer ve aynı duvara toslar; üstelik oturumu geçerli
   * olan biri sebepsiz yere giriş ekranına atılır. */
  t("403 oturumDustu: false (kullanıcı giriş ekranına ATILMIYOR)",
    h.oturumDustu === false, `gelen ${h.oturumDustu}`);
  t('403 türü "yetki"', h.tur === "yetki", `gelen ${h.tur}`);
  t("403 türü 401'inkinden FARKLI", h.tur !== istekHatasi(401, {}).tur);
  t("403 mesajı SEBEBİ söylüyor (izin)", iceriyorBiri(h.mesaj, ["izin", "yetki"]), h.mesaj);
  t("403 mesajı NE YAPILACAĞINI söylüyor (kimden istenecek)",
    iceriyorBiri(h.mesaj, YAPILACAK_IMZALARI) && iceriyorBiri(h.mesaj, ["yönetici"]), h.mesaj);
});

await bolum("3) 409 — ÇAKIŞMA ya da İŞ KURALI ihlali", 6, async () => {
  /* Sunucu 409'u İKİ farklı şey için döndürüyor: sürüm çakışması / bozuk belge VE iş
   * kuralı ihlali ("bu adda bir şube zaten var"). İkincisinde sunucunun kendi cümlesi
   * asıl bilgidir; genel çakışma metninin arkasına gömülürse kullanıcı sayfa yenilemeye
   * yollanır — oysa yenilemek o sorunu çözmez. */
  const h = istekHatasi(409, {});
  t("409 oturumDustu: false", h.oturumDustu === false);
  t('409 türü "cakisma"', h.tur === "cakisma", `gelen ${h.tur}`);
  t("sunucu bir şey söylemediğinde SEBEP yazılıyor (başkası aynı anda değiştirmiş olabilir)",
    iceriyorBiri(h.mesaj, ["başka biri", "başkası", "aynı anda"]), h.mesaj);
  t("409 mesajı NE YAPILACAĞINI söylüyor (sayfayı yenile)",
    iceriyorBiri(h.mesaj, ["yenile"]), h.mesaj);

  const kuralIhlali = istekHatasi(409, { error: 'Bu adda bir şube zaten var (TEST-IZI-7).' });
  t("iş kuralı ihlalinde sunucunun kendi cümlesi BAŞTA geliyor",
    kuralIhlali.mesaj.startsWith("Bu adda bir şube zaten var (TEST-IZI-7)."), kuralIhlali.mesaj);
  t("sunucu cümlesi gelse de ne yapılacağı yine yazıyor",
    iceriyorBiri(kuralIhlali.mesaj, ["yenile", "tekrar"]), kuralIhlali.mesaj);
});

await bolum("4) 503 + mesgul — HATA DEĞİL, sıra bekleniyor", 5, async () => {
  const h = istekHatasi(503, { mesgul: true, error: "Sistem meşgul." });
  t('503+mesgul türü "mesgul"', h.tur === "mesgul", `gelen ${h.tur}`);
  t("503+mesgul oturumDustu: false", h.oturumDustu === false);
  /* `lib/mesgul-tekrar.js` isteği KENDİLİĞİNDEN tekrarlıyor; kullanıcı panik yapmasın. */
  t("503+mesgul tekrar denendiğini söylüyor",
    iceriyorBiri(h.mesaj, ["tekrar deniyor", "kendiliğinden"]), h.mesaj);
  /* "hata" kelimesi YOK: bir şey bozulmadı. Yanlış ad takmak kullanıcıyı gereksiz
   * telaşlandırır ve olmayan bir sorunu kovalatır. */
  t('503+mesgul kullanıcıya "hata" diye sunulmuyor',
    !iceriyorBiri(`${h.baslik} ${h.mesaj}`, ["hata"]), `${h.baslik} — ${h.mesaj}`);
  /* `mesgul` bayrağı YOKSA bu bizim meşgul yanıtımız değildir (barındırma katmanı da
   * 503 döndürebiliyor) — o zaman genel sunucu dalına düşmeli. */
  t("mesgul bayrağı OLMAYAN 503 meşgul dalına düşMÜYOR",
    istekHatasi(503, { error: "Gateway hatası" }).tur !== "mesgul");
});

await bolum("5) 500 ve bilinmeyen kod — sunucunun mesajı YUTULMUYOR", 6, async () => {
  const ozelMetin = "Belge okunamadi (TEST-IZI-42)";
  const h = istekHatasi(500, { error: ozelMetin });
  t("500'de sunucunun kendi mesajı mesaja giriyor", h.mesaj.includes(ozelMetin), h.mesaj);
  t("500 oturumDustu: false", h.oturumDustu === false);
  t("500'de NE YAPILACAĞI da yazıyor", iceriyorBiri(h.mesaj, YAPILACAK_IMZALARI), h.mesaj);

  const bos = istekHatasi(500, {});
  t("sunucu mesajı YOKSA genel metin dönüyor (boş değil)",
    typeof bos.mesaj === "string" && bos.mesaj.length > 20, bos.mesaj);

  /* BİLİNMEYEN KOD: çökme yok, anlamlı metin var. */
  const garip = istekHatasi(418, { message: "I am a teapot" });
  t("bilinmeyen durum kodunda çökmüyor, başlık+mesaj dönüyor",
    garip.baslik.length > 0 && garip.mesaj.length > 0 && garip.oturumDustu === false);
  t("bilinmeyen kodda sunucunun mesajı yine yutulmuyor",
    garip.mesaj.includes("I am a teapot"), garip.mesaj);
});

await bolum("6) AĞ: durum kodu HİÇ YOK", 4, async () => {
  const h = istekHatasi(0, { error: "Bağlantı hatası — plan eklenemedi, tekrar dene." });
  t('durum 0 → tür "ag"', h.tur === "ag", `gelen ${h.tur}`);
  t("durum 0 oturumDustu: false (oturum düşmüş SAYILMAZ)", h.oturumDustu === false);
  t("çağrı yerinin kendi cümlesi korunuyor",
    h.mesaj.includes("plan eklenemedi"), h.mesaj);
  const bos = istekHatasi(undefined, null);
  t("durum/gövde hiç verilmese de çökmüyor",
    bos.tur === "ag" && bos.mesaj.length > 20 && bos.oturumDustu === false);
});

await bolum("7) SAFLIK: girdi DEĞİŞMİYOR", 4, async () => {
  const govde = { error: "Yetkisiz.", mesgul: false, ic: { a: 1 } };
  const once = JSON.stringify(govde);
  istekHatasi(401, govde);
  istekHatasi(403, govde);
  istekHatasi(503, govde);
  t("gövde nesnesi değişmedi", JSON.stringify(govde) === once, JSON.stringify(govde));
  t("aynı girdi aynı çıktıyı veriyor",
    JSON.stringify(istekHatasi(409, govde)) === JSON.stringify(istekHatasi(409, govde)));
  /* Gövde METİN de olabilir (sunucu JSON döndürmediğinde). */
  t("metin gövde de okunabiliyor", sunucuMesaji("  düz metin  ") === "düz metin");
  t("gövde nesne değilse çökmüyor",
    istekHatasi(500, 42).mesaj.length > 0 && sunucuMesaji(undefined) === "");
});

await bolum("8) EKRAN METNİ: başlık + mesaj tek satırda, tekrarsız", 4, async () => {
  const h = istekHatasi(401, {});
  const metin = hataMetni(h);
  t("ekran metni başlığı taşıyor", metin.includes(h.baslik), metin);
  t("ekran metni mesajı taşıyor", metin.includes(h.mesaj), metin);
  /* Başlık mesajın içinde de geçseydi kullanıcı aynı cümleyi iki kez okurdu. */
  t("başlık metinde İKİ KEZ geçmiyor",
    metin.split(h.baslik).length - 1 === 1, metin);
  t("hataMetni bozuk girdide çökmüyor", hataMetni(null) === "" && hataMetni({}) === "");
});

await bolum("9) SÜRELER `lib/oturum.js` İLE AYNI — sessiz bayatlama yok", 3, async () => {
  /* Mesaj "30 gün" ve "12 saat" yazıyor. Bu sayılar `lib/oturum.js`'teki sabitlerden
   * TÜRETİLMİYOR (o modül tarayıcıya import edilemez, `@vercel/kv` çekiyor) — bu yüzden
   * ayrışma riski gerçek. Burada ölçülüyor: süre orada değişip burada değişmezse test
   * gürültülü kırılır ve kullanıcıya yanlış süre söylenmez. */
  t("normal oturum süresi mesajdaki saatle aynı",
    SURE_NORMAL === OTURUM_SURESI_SAAT * 60 * 60,
    `oturum.js ${SURE_NORMAL}sn, mesaj ${OTURUM_SURESI_SAAT} saat`);
  t('"beni hatırla" süresi mesajdaki günle aynı',
    SURE_HATIRLA === OTURUM_HATIRLA_GUN * 24 * 60 * 60,
    `oturum.js ${SURE_HATIRLA}sn, mesaj ${OTURUM_HATIRLA_GUN} gün`);
  const h = istekHatasi(401, {});
  t("401 mesajı iki süreyi de yazıyor",
    h.mesaj.includes(String(OTURUM_SURESI_SAAT)) && h.mesaj.includes(String(OTURUM_HATIRLA_GUN)),
    h.mesaj);
});

/* KAÇ KONTROLÜN ÇALIŞTIĞI DA SINANIYOR — t95'teki bekçinin aynısı, aynı sebeple.
 * Bölümlerden biri `await` edilmezse ya da bir kontrol sessizce silinirse dosya kırmızı
 * yanar. Kontrol eklerken bu sabit de artırılır; yasak olan sayının KENDİLİĞİNDEN
 * düşmesi ve kimsenin görmemesi. */
const BEKLENEN = 43;
if (g + k !== BEKLENEN) {
  k++;
  console.log(`  ✗ yalnızca ${g + k - 1} kontrol çalıştı, ${BEKLENEN} olmalıydı — bir bölüm hiç koşmamış`);
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k > 0 ? 1 : 0);
