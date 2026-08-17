"""
TANIMSIZ FONKSİYON ÇAĞRISI DENETLEYİCİSİ

En kapsamlı kontrol: kodda çağrılan HER adı (foo(...)) toplar ve o dosyada
tanımlı / import edilmiş / bilinen bir tarayıcı-JS globali olup olmadığını doğrular.

Yakaladığı hata: bir yardımcı fonksiyon başka dosyaya taşınır ama import edilmez.
Sözdizimi geçerlidir, parantezler dengelidir; ancak o satır çalıştığı anda
"x is not defined" verir ve sayfa siyah olur.
"""
import re, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod

GLOBALLER = {
    # JS yerleşikleri
    "Object","Array","String","Number","Boolean","Math","JSON","Date","Promise","Map","Set",
    "RegExp","Error","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent",
    "decodeURIComponent","btoa","atob","setTimeout","clearTimeout","setInterval","clearInterval",
    "require","import","typeof","Symbol","BigInt","Intl","TextEncoder","TextDecoder","structuredClone",
    # Tarayıcı
    "window","document","fetch","localStorage","sessionStorage","navigator","alert","confirm",
    "prompt","console","FileReader","Blob","File","URL","Image","Headers","Request","Response",
    "FormData","AbortController","IntersectionObserver","ResizeObserver","MutationObserver",
    "requestAnimationFrame","cancelAnimationFrame","matchMedia","CustomEvent","Event",
    # Node (api/ ve lib/ için)
    "Buffer","process","crypto","module","exports","__dirname","global",
    # React
    "React","createRoot",
}

# React SINIF BİLEŞENİ metotları — hataYakalayici.jsx projedeki ilk sınıf bileşen.
# Bunlar React tarafından çağrılır; kodda "tanımsız çağrı" gibi görünürler.
TARAYICI_NODE = {"XMLHttpRequest", "URLSearchParams", "FormData", "Blob", "FileReader", "AbortController"}

SINIF_METOTLARI = {"constructor", "render", "componentDidCatch", "componentDidMount",
                   "componentDidUpdate", "componentWillUnmount", "getDerivedStateFromError",
                   "getDerivedStateFromProps", "shouldComponentUpdate", "super", "setState"}


def yerel_adlar(kod):
    ad = set()
    ad |= set(re.findall(r"(?:function|class)\s+([A-Za-z_]\w*)", kod))
    ad |= set(re.findall(r"(?:const|let|var)\s+([A-Za-z_]\w*)", kod))
    # yıkım: const { a, b } = ... ve fonksiyon parametreleri
    for m in re.finditer(r"(?:const|let|var)\s*\{([^}]*)\}", kod):
        ad |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"(?:const|let|var)\s*\[([^\]]*)\]", kod):
        ad |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"function\s*\w*\s*\(([^)]*)\)", kod):
        ad |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"\(([^)]*)\)\s*=>", kod):
        ad |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"([A-Za-z_]\w*)\s*=>", kod):
        ad.add(m.group(1))
    # catch (e)
    ad |= set(re.findall(r"catch\s*\(\s*([A-Za-z_]\w*)", kod))
    return ad

def importlar(s):
    ad = set()
    for m in re.finditer(r"import\s+(.+?)\s+from\s+['\"]", s, re.S):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)):
            if x not in ("as","from","default"): ad.add(x)
    return ad

if __name__ == "__main__":
    hata = 0
    for yol in sys.argv[1:]:
        ham = open(yol, encoding="utf-8").read()
        kod = sadece_kod(ham)
        mevcut = yerel_adlar(kod) | importlar(ham) | GLOBALLER | SINIF_METOTLARI | TARAYICI_NODE
        # "ad(" biçimindeki çağrılar; nokta ile erişilenler (a.b()) hariç
        # JSX metnini ayıkla: > ile { arasındaki düz metin kod değildir.
        # "Onayını Bekleyenler ({sayi})" gibi ifadelerde 'Bekleyenler' çağrı sanılıyordu.
        kod_jsxsiz = re.sub(r">[^<>{}]*<", "><", kod)
        kod_jsxsiz = re.sub(r">[^<>{}]*\{", ">{", kod_jsxsiz)
        kod_jsxsiz = re.sub(r"\}[^<>{}]*<", "}<", kod_jsxsiz)
        cagrilar = set(re.findall(r"(?<![\w.$])([a-zA-Z_]\w*)\s*\(", kod_jsxsiz))
        # Türkçe karakter içeren adlar JS tanımlayıcısı olamaz (metin kalıntısı)
        cagrilar = {c for c in cagrilar if not re.search(r"[çğıöşüÇĞİÖŞÜ]", c)}
        # anahtar kelimeler
        cagrilar -= {"if","for","while","switch","catch","return","function","typeof","await",
                     "new","do","else","try","case","in","of","yield","delete","void","instanceof"}
        # get/set kısayolları çağrı değil, tanımdır:  get bg() { ... }
        cagrilar -= set(re.findall(r"(?:get|set)\s+([A-Za-z_]\w*)\s*\(", kod))
        eksik = sorted(a for a in cagrilar if a not in mevcut)
        if eksik:
            hata += 1
            print(f"✗ {os.path.basename(yol)} — tanımsız çağrı: {', '.join(eksik[:10])}")
        else:
            print(f"✓ {os.path.basename(yol)}")
    sys.exit(1 if hata else 0)
