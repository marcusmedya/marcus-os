"""
BUTON BAĞLANTI DENETLEYİCİSİ
onClick={birSey} biçimindeki her butonun, çağırdığı adın o dosyada tanımlı/import edilmiş
ya da bir prop olduğunu kontrol eder. Tanımsız bir onClick, tıklandığı anda sayfayı çökertir
ve bu ancak o butona basıldığında ortaya çıkar — yani gözden kaçması çok kolaydır.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod
from cagridenetle import yerel_adlar, importlar, GLOBALLER

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    mevcut = yerel_adlar(kod) | importlar(ham) | GLOBALLER
    sorunlu = []
    # onClick={ad} / onChange={ad} gibi doğrudan referanslar
    for m in re.finditer(r"on[A-Z]\w*\s*=\s*\{\s*([A-Za-z_]\w*)\s*\}", kod):
        ad = m.group(1)
        if ad not in mevcut:
            satir = kod[:m.start()].count("\n") + 1
            sorunlu.append(f"satır {satir}: {ad}")
    if sorunlu:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — tanımsız olay bağlantısı: {'; '.join(sorunlu[:8])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
