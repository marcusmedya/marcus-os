export const DEFAULT_DATA = {
  monthly: [
    { id: 1, ay: "Şub", ciro: 168000, gider: 98000, net: 70000 },
    { id: 2, ay: "Mar", ciro: 182000, gider: 101000, net: 81000 },
    { id: 3, ay: "Nis", ciro: 176000, gider: 104000, net: 72000 },
    { id: 4, ay: "May", ciro: 195000, gider: 108000, net: 87000 },
    { id: 5, ay: "Haz", ciro: 210000, gider: 112000, net: 98000 },
    { id: 6, ay: "Tem", ciro: 231000, gider: 119000, net: 112000 },
  ],
  clients: [
    { id: 1, ad: "Nova Teknoloji", kategori: "Yazılım", durum: "aktif", aylikUcret: 58000, karMarji: 71, baslangic: "2024-11", not: "En kârlı müşteri", maliyetler: [], odemeGunu: 5, odemeler: [] },
    { id: 2, ad: "Lezzet Sofrası", kategori: "Restoran Zinciri", durum: "aktif", aylikUcret: 45000, karMarji: 62, baslangic: "2024-06", not: "", maliyetler: [], odemeGunu: 10, odemeler: [] },
    { id: 3, ad: "UrbanFit Spor Kulübü", kategori: "Spor & Wellness", durum: "aktif", aylikUcret: 32000, karMarji: 55, baslangic: "2025-01", not: "", maliyetler: [], odemeGunu: null, odemeler: [] },
    { id: 4, ad: "Mavi Deniz Otelcilik", kategori: "Turizm", durum: "yeni", aylikUcret: 40000, karMarji: 48, baslangic: "2026-06", not: "", maliyetler: [], odemeGunu: null, odemeler: [] },
    { id: 5, ad: "Yeşil Bahçe Peyzaj", kategori: "Peyzaj & Bahçe", durum: "aktif", aylikUcret: 18000, karMarji: 28, baslangic: "2025-03", not: "En düşük kârlı müşteri", maliyetler: [], odemeGunu: null, odemeler: [] },
    { id: 6, ad: "Altın Kuyumcu", kategori: "Perakende", durum: "ayrildi", aylikUcret: 0, karMarji: 0, baslangic: "2024-02", not: "", maliyetler: [], odemeGunu: null, odemeler: [] },
  ],
  operasyonlar: [
    { id: 1, musteri: "Nova Teknoloji", tur: "Çekim", baslik: "Ürün lansman filmi", durum: "yesil", tarih: "28 Tem" },
    { id: 2, musteri: "Lezzet Sofrası", tur: "Edit", baslik: "Temmuz reels paketi", durum: "turuncu", tarih: "29 Tem" },
    { id: 3, musteri: "UrbanFit Spor Kulübü", tur: "Onay", baslik: "Antrenman serisi v2", durum: "kirmizi", tarih: "26 Tem" },
    { id: 4, musteri: "Mavi Deniz Otelcilik", tur: "Çekim", baslik: "Otel tanıtım drone çekimi", durum: "turuncu", tarih: "30 Tem" },
    { id: 5, musteri: "Yeşil Bahçe Peyzaj", tur: "Paylaşım", baslik: "Instagram öncesi/sonrası", durum: "yesil", tarih: "27 Tem" },
    { id: 6, musteri: "Nova Teknoloji", tur: "Reklam", baslik: "Meta Ads - lansman kampanyası", durum: "turuncu", tarih: "31 Tem" },
    { id: 7, musteri: "Lezzet Sofrası", tur: "Onay", baslik: "Menü tanıtım videosu", durum: "kirmizi", tarih: "25 Tem" },
    { id: 8, musteri: "UrbanFit Spor Kulübü", tur: "Edit", baslik: "Üyelik kampanya videosu", durum: "yesil", tarih: "28 Tem" },
  ],
  gelirKalemleri: [
    { id: 1, kalem: "Aylık Yönetim Bedelleri", tutar: 193000, tekrar: "sabit" },
    { id: 2, kalem: "Proje Bazlı Çekimler", tutar: 28000, tekrar: "tek seferlik" },
    { id: 3, kalem: "Reklam Yönetim Komisyonu", tutar: 10000, tekrar: "sabit" },
  ],
  giderKalemleri: [
    { id: 2, kalem: "Ekipman & Kiralama", tutar: 14000, tekrar: "tek seferlik" },
    { id: 3, kalem: "Reklam Harcaması (Müşteri Adına)", tutar: 22000, tekrar: "tek seferlik" },
    { id: 4, kalem: "Ofis & Sabit Giderler", tutar: 9000, tekrar: "sabit" },
    { id: 5, kalem: "Yazılım & Araçlar", tutar: 6000, tekrar: "sabit" },
  ],
  bekleyenTahsilatlar: [
    { id: 1, musteri: "Mavi Deniz Otelcilik", tutar: 40000, vade: "3 gün gecikti" },
    { id: 2, musteri: "Yeşil Bahçe Peyzaj", tutar: 18000, vade: "bugün" },
  ],
  personel: [
    { id: 1, ad: "Ege Aydın", pozisyon: "Video Editörü", maas: 32000, sigorta: 9500, tazminatBirikimi: 1500, baslangic: "2024-09" },
    { id: 2, ad: "Deniz Kara", pozisyon: "Sosyal Medya Uzmanı", maas: 26000, sigorta: 8000, tazminatBirikimi: 1200, baslangic: "2025-02" },
  ],
  vergiTakvimi: [
    { id: 1, kalem: "KDV Beyannamesi", tarih: "26 Ağu", durum: "yaklaşıyor" },
    { id: 2, kalem: "Muhtasar Beyanname", tarih: "26 Ağu", durum: "yaklaşıyor" },
    { id: 3, kalem: "Geçici Vergi (3. Dönem)", tarih: "17 Kas", durum: "planlandı" },
  ],
};
