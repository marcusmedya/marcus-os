"""
ERİŞİM DENETLEYİCİSİ — bir bileşen kullandığı ada gerçekten ULAŞABİLİYOR MU

v137'de Finans yeni bir dosyaya taşınırken dört ad geride kaldı:
  iconBtnStyle, fmtShort  → finans.jsx'te kullanılıyor, import edilmemiş
  bekleyenFields          → App.jsx'te kullanılıyor, tanımı finans.jsx'te kaldı
  hesapBakiyesi           → App.jsx'te kullanılıyor, export edilmemişti
Dördü de siyah ekran demekti ve ON ALTI denetleyicinin hiçbiri göremedi:
  - 5 yalnızca <Bileşen> biçimini kapsıyor
  - 10 ve 12 tek dosya içinde bakıyor
  - 16 yalnızca BÜYÜK_HARFLİ sabitlere bakıyor
  - 9 yalnızca "import edilen ad kaynağında var mı" diye soruyor,
    "kullanılan ad import edilmiş mi" diye SORMUYOR

Bu denetleyici tersini sorar: JSX içinde {ad} olarak kullanılan her küçük harfli ad, o
dosyada tanımlı mı ya da import edilmiş mi? Değilse çalışma anında çöker.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod
from cagridenetle import importlar, GLOBALLER

ANAHTAR = {"true", "false", "null", "undefined", "new", "typeof", "await", "this", "return",
           "const", "let", "var", "function", "class", "if", "else", "for", "while", "case",
           "default", "delete", "void", "in", "of", "yield", "async", "super", "import", "export"}

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    disaridan = importlar(ham) | GLOBALLER | ANAHTAR

    # Dosyada TANIMLI her ad (modül + tüm yerel tanımlar, parametreler dahil)
    tanimli = set(re.findall(r"(?:const|let|var|function|class)\s+([A-Za-z_]\w*)", kod))
    for m in re.finditer(r"(?:const|let|var)\s*[\{\[]([^\}\]]*)[\}\]]", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"function\s*\w*\s*\(([^)]*)\)", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    # Ok fonksiyonu parametreleri — parantez içi TEK SATIR ve JSX içermemeli.
    # Geniş kalıp, JSX gövdesinin tamamını "parametre listesi" sanıp içindeki her adı
    # tanımlı kabul ediyordu; bekleyenFields hatası tam bu yüzden kaçmıştı. 
    for m in re.finditer(r"\(([^()\n<>{}]*)\)\s*=>", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    tanimli |= set(re.findall(r"([A-Za-z_]\w*)\s*=>", kod))
    # nesne anahtarları (ad: değer) kullanım sayılmaz
    anahtarlar = set(re.findall(r"([A-Za-z_]\w*)\s*:", kod))

    # KULLANIM: JSX niteliği olarak {ad} — prop={ad} biçimi kesin sonuç verir,
    # Türkçe metinle karışmaz.
    kullanim = set(re.findall(r"=\{([a-z][A-Za-z0-9_]{2,})\}", kod))
    kullanim |= set(re.findall(r"=\{([a-z][A-Za-z0-9_]{2,})\.", kod))

    eksik = sorted(a for a in kullanim
                   if a not in tanimli and a not in disaridan and a not in anahtarlar)
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — erişilemeyen ad: {', '.join(eksik[:10])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
