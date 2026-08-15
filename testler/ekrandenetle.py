"""
EKRAN ENVANTERİ DENETLEYİCİSİ

v113'te 29 açıklama paragrafı silindi. Silme işlemleri konum bazlıydı; yanlışlıkla işlevsel
bir öğenin gitmesi mümkündü ve hiçbir denetleyici bunu göremezdi (kod yine geçerli olurdu).

Bu denetleyici, her ekranın OLMAZSA OLMAZ öğelerinin kodda hâlâ var olduğunu doğrular.
Tarayıcıda tıklama testinin yerini tutmaz — ama "sildiğim şey gerçekten sadece açıklama
mıydı?" sorusunu cevaplar ve ileride benzer bir temizlikte güvenlik ağı olur.
"""
import sys, os
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EKRANLAR = {
  "Ayarlar · Veri & Yedek": ["Tam Yedek", "Geri Yükle", "Otomatik Yedekler", "silinenler", "Veri"],
  "Ayarlar · Güvenlik":     ["Şifre Koruması", "Personel Erişimi", "SITE_PASSWORD", "OWNER_EMAIL", "Güvenlik"],
  "Ayarlar · Görünüm":      ["Marka Kimliği", "Gizlilik Modu"],
  "Ayarlar · Bildirimler":  ["Sabah E-postasıyla AI Özeti", "Operasyon & Günlük Kontrol Hatırlatmaları"],
  "Ödeme Takvimi":          ["tam ödendi", "kısmi ödendi", "ödenmedi"],
  "Paylaşımlar":            ["planlandı (henüz paylaşılmadı)", "Haftalık Paylaşım Planı"],
  "Günlük Kontrol":         ["GECİKENLER", "SIRADAKİ GÜNLER", "Paylaşıldı işaretle", "tarihi okunamıyor"],
  "Müşteri Paneli (yönetici)": ["Yeni Çekim Planı", "İçerik Ekle", "Operasyon Kartı Oluştur", "İçerik Fikirleri"],
  "Planım · Onay Kutusu":   ["Onayını Bekleyenler", "Operasyona Aktar", "Planı Düzenle", "İçeriği gör"],
  "Personel":               ["Hesaplar & Yetkiler", "Yeni Personel Hesabı", "Kadrolu", "Freelancer"],
  "Operasyon":              ["Yeni İş", "Marka", "Fotoğraf", "Grafik Tasarım"],
  # NOT: metnin ortasında değişken var ("çok daha az {alan} içeriyor"), o yüzden parça aranır.
  "Veri kaybı freni":       ["Evet, devam et", "çok daha az", "Kayıt güvenlik nedeniyle durduruldu", "veri kaybı olabilir"],
  "Teklif & Sözleşme":      ["Teklif", "Sözleşme"],
}
DOSYA_MUSTERI = {
  "Müşteri Paneli (müşteri)": ["Onay Bekleyenler", "Revize İstediklerin", "Onayladıkların",
                                "Üretim Durumu", "Değişiklik iste", "Onayla", "Dosyayı aç"],
}

kaynak = ""
for d in ["src/App.jsx", "src/CekimEditTakibi.jsx", "src/personel.jsx", "src/TeklifSozlesme.jsx"]:
    kaynak += open(os.path.join(KOK, d), encoding="utf-8").read()
musteri = open(os.path.join(KOK, "src/musteriPaneli.jsx"), encoding="utf-8").read()

hata = 0
for ekran, ogeler in EKRANLAR.items():
    eksik = [o for o in ogeler if o not in kaynak]
    if eksik:
        hata += 1
        print(f"✗ {ekran} — EKSİK: {', '.join(eksik)}")
    else:
        print(f"✓ {ekran} ({len(ogeler)} öğe)")
for ekran, ogeler in DOSYA_MUSTERI.items():
    eksik = [o for o in ogeler if o not in musteri]
    if eksik:
        hata += 1
        print(f"✗ {ekran} — EKSİK: {', '.join(eksik)}")
    else:
        print(f"✓ {ekran} ({len(ogeler)} öğe)")
sys.exit(1 if hata else 0)
