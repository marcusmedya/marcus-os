"""
TANIMSIZ SABİT DENETLEYİCİSİ

BÜYÜK_HARFLİ bir sabit (CLIENT_FIELDS, DURUM_STIL gibi) kullanılıyor ama hiçbir yerde
tanımlı ya da import edilmiş değilse, o bileşen ekrana geldiği anda çöker.

Gerçek olay: v117'de App.jsx'i eski bir kopyadan geri yüklerken CLIENT_FIELDS ve
CLIENT_DURUM kesildi. Müşteriler sekmesi tıklandığında siyah ekran verdi.
On beş denetleyicinin hiçbiri göremedi:
  - 10 (degiskendenetle) yalnızca küçük harfli adlara bakıyor
  - 12 (kapsamdenetle) bir bileşenin içinde tanımlı olup başkasında kullanılanı arıyor;
    burada ad HİÇBİR YERDE tanımlı değildi
  - 5 (ikondenetle) yalnızca <Bileşen> biçimindekileri kapsıyor

Yöntem: her dosyada BÜYÜK_HARF_ALTÇİZGİ kalıbındaki adların kullanımını toplar, dosyada
tanımlı ya da import edilmiş olanları çıkarır. Kalan varsa gerçek eksiktir.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod
from cagridenetle import importlar, GLOBALLER

# JS/tarayıcı tarafından sağlanan büyük harfli adlar
# JSX METNİNDE geçip kod sanılanlar. Hepsi tek tek doğrulandı: "(CEO)", "KAPALI." ve
# "KDV %20" cümle içinde geçen Türkçe kelimeler, kod değil.
METIN = {"CEO", "KAPALI", "KDV", "PDF", "CSV", "API"}

HAZIR = {"JSON", "Math", "Number", "String", "Object", "Array", "Date", "Boolean", "Promise",
         "Buffer", "Map", "Set", "RegExp", "Error", "URL", "FileReader", "Image", "Intl",
         "NaN", "Infinity", "React"}

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    # Fonksiyon İÇİNDE tanımlananlar da sayılır (const MAKS_GENISLIK = 40, MAKS_YUKSEKLIK = 20)
    # ve tek satırda virgülle birden fazla tanım olabilir. 
    tanimli = set(re.findall(r"(?:const|let|var|function|class)\s+([A-Z_][A-Z0-9_]*)\b", kod))
    # KESİN kalıp: "const AD =" ya da virgülle devam eden "…, AD =". Daha geniş bir kalıp
    # (satırın tamamını taramak) adın KULLANIM yerini de tanım sanıyordu.
    tanimli |= set(re.findall(r"(?:const|let|var|,)\s*([A-Z_][A-Z0-9_]{2,})\s*=", kod))
    # yıkımla gelenler
    for m in re.finditer(r"(?:const|let|var)\s*\{([^}]*)\}", kod):
        tanimli |= set(re.findall(r"[A-Z_][A-Z0-9_]*", m.group(1)))
    disaridan = importlar(ham) | GLOBALLER | HAZIR | METIN

    # Yalnızca KOD KONUMUNDA geçenler: ardından [ . ( ) , ; } ya da karşılaştırma gelir.
    # JSX içindeki düz metin ("BRIEF / NOTLAR" gibi başlıklar) böyle bir bağlam taşımaz;
    # ilk sürüm onları da sabit sanıp yanlış alarm yağdırmıştı.
    kullanim = set(re.findall(r"(?<![\w.])([A-Z][A-Z0-9_]{2,})\s*(?=[\[.(),;}]|===|!==)", kod))
    eksik = sorted(a for a in kullanim if a not in tanimli and a not in disaridan)
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — tanımsız sabit: {', '.join(eksik[:10])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
