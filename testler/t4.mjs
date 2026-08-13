import { kv } from "@vercel/kv";
import { KIMLIK, cagir } from "./denetim.mjs";
import crypto from "crypto";
process.env.SITE_PASSWORD = "ownerpw";
const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString("hex");

// TUM izinleri acik, marka kilitli hesap — hangi alanlar sizabiliyor?
const veri = {
  _v: 1,
  clients: [{ id: 1, ad: "Şişçi İbo" }, { id: 2, ad: "GIZLIMARKA" }],
  musteriGirisleri: { "1": { kullanici: "a" }, "2": { kullanici: "GIZLIKULLANICI" } },
  gunlukKontrol: { "2_2026-08-13": true, "1_2026-08-13": true },
  subeler: [{ id: 1, clientId: 1, ad: "Sube A" }, { id: 2, clientId: 2, ad: "GIZLISUBE" }],
  paylasimGecmisi: [{ id: 1, clientId: 2, not: "GIZLIGECMIS" }],
  markalasmaSurecleri: [{ id: 1, marka: "GIZLIMARKA", not: "GIZLISUREC" }],
  musteriIcerikleri: [{ id: 1, clientId: 2, aciklama: "GIZLIICERIK" }],
  teklifler: [{ id: 1, marka: "GIZLIMARKA", tutar: 12345 }],
  bekleyenTahsilatlar: [{ id: 1, musteri: "GIZLIMARKA", tutar: 77777 }],
  uyelikler: [{ id: 1, marka: "GIZLIMARKA", ad: "GIZLIUYELIK" }],
  personel: [{ id: 1, ad: "GIZLIPERSONEL", maas: 30000 }],
  gelirKalemleri: [{ id: 1, kalem: "GIZLIGELIR", tutar: 1 }],
  hesaplar: [{ id: "ana", ad: "Ana", anaHesap: true }],
  personelHesaplari: [{ id: "p1", ad: "Ortak", kullaniciAdi: "ortak", sifreHash: hash("1234", "s1"), sifreSalt: "s1",
    izinler: Object.fromEntries(["dashboard","musteriler","finans","takvim","odemeTakvimi","teklif","reklamlar","paylasimlar","cekimListesi","cekimEdit","personel","birikim","uyelikler","sifreKasasi"].map(k=>[k,true])),
    markalar: ["Şişçi İbo"] }],
};
await kv.set("marcus-os-data", veri);
const { default: h } = await import("../api/data.js");
const r = await cagir(h, { method: "GET", headers: KIMLIK, query: {}, body: {} });
const metin = JSON.stringify(r.govde.data || {});
const gizliler = ["GIZLIMARKA","GIZLIKULLANICI","GIZLISUBE","GIZLIGECMIS","GIZLISUREC","GIZLIICERIK","GIZLIUYELIK","GIZLIPERSONEL","GIZLIGELIR","77777","12345"];
console.log("TÜM İZİNLER AÇIK + MARKA KİLİTLİ hesabın gördükleri:\n");
gizliler.forEach(g => { if (metin.includes(g)) console.log("  !!! SIZIYOR:", g); });
console.log("\ngunlukKontrol:", JSON.stringify(r.govde.data.gunlukKontrol));
console.log("musteriGirisleri:", JSON.stringify(r.govde.data.musteriGirisleri));
