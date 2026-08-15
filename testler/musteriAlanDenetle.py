"""
MÜŞTERİ PANELİ ALAN DENETLEYİCİSİ

Sunucu (api/data.js) müşteri girişine bir yanıt nesnesi döndürür; arayüz (src/App.jsx) bunu
musteriData'ya alır ve müşteri paneli oradan okur.

İKİ KEZ AYNI HATA OLDU: sunucuya yeni bir alan eklendi (reklamlar/paylasimPlani, sonra
hazirIcerikler) ama arayüz yanıtı ALAN ALAN kopyaladığı için yeni alan sessizce düştü.
Hiçbir hata çıkmadı; özellik sadece "çalışmıyor" göründü.

Bu denetleyici, sunucunun müşteriye gönderdiği alanların müşteri panelinde gerçekten
okunabilir olduğunu doğrular.
"""
import re, sys, os

kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
api = open(os.path.join(kok, "api", "data.js"), encoding="utf-8").read()
app = open(os.path.join(kok, "src", "App.jsx"), encoding="utf-8").read()

# Sunucunun müşteri yanıtındaki alanlar
m = re.search(r'role:\s*"musteri",(.*?)\n\s*\}\);', api, re.S)
alanlar = set(re.findall(r"^\s+([a-zA-Z_]\w*):", m.group(1), re.M)) if m else set()
if not alanlar:
    print("✗ sunucudaki müşteri yanıtı bulunamadı — denetleyici güncellenmeli")
    sys.exit(1)

# Arayüz yanıtın tamamını mı alıyor?
tamamiAliniyor = bool(re.search(r"setMusteriData\(\{\s*\.\.\.", app))

hata = 0
if tamamiAliniyor:
    print("✓ arayüz sunucu yanıtının tamamını alıyor — yeni alanlar kendiliğinden geçer")
else:
    kopyalanan = set()
    m2 = re.search(r"setMusteriData\(\{(.*?)\}\);", app, re.S)
    if m2:
        kopyalanan = set(re.findall(r"([a-zA-Z_]\w*):", m2.group(1)))
    eksik = sorted(a for a in alanlar if a not in kopyalanan)
    if eksik:
        hata = 1
        print(f"✗ sunucu gönderiyor ama arayüz almıyor: {', '.join(eksik)}")
    else:
        print("✓ tüm alanlar kopyalanmış")

sys.exit(hata)
