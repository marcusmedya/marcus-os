"""
EKSİK BİLEŞEN/İKON DENETLEYİCİSİ

Dosya bölerken en sinsi hata: bir bileşen taşınır ama kullandığı DIŞ KÜTÜPHANE import'u
(lucide-react ikonları gibi) taşınmaz. Sözdizimi geçerlidir, parantezler dengelidir, kendi
tanımlarımızı kontrol eden importdenetle.py de göremez — çünkü eksik olan ad bizim
dosyalarımızda hiç tanımlı değil.

Sonuç: o bileşen ekrana geldiği anda "X is not defined" ve sayfa tamamen siyah olur.
Gerçek bir olayda FieldForm'un <Check> ikonu böyle kayboldu; müşteri düzenleme formu
her açıldığında uygulama çöküyordu.

Yöntem: JSX'te <BuyukHarfli ... /> biçiminde kullanılan her bileşenin, o dosyada tanımlı
ya da import edilmiş olduğunu doğrular.
"""
import re, sys, os

IFADE_ONCESI = set("=([{,:;?&|!+-*/%~^") | {""}
ANAHTAR = ("return", "typeof", "case", "in", "of", "do", "else", "await", "yield")

def onceki(s, i):
    j = i - 1
    while j >= 0 and s[j] in " \t":
        j -= 1
    return (s[j], j) if j >= 0 else ("", -1)

def ifade_konumu(s, i):
    c, j = onceki(s, i)
    if c in ("", "\n") or c in IFADE_ONCESI:
        return True
    if c.isalpha():
        k = j
        while k >= 0 and (s[k].isalnum() or s[k] == "_"):
            k -= 1
        return s[k + 1:j + 1] in ANAHTAR
    return False

def sadece_kod(s):
    """Dize, şablon, yorum ve regex içeriklerini boşlukla değiştirir; kod iskeleti kalır."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == "/" and i + 1 < n and s[i+1] == "/" and ifade_konumu(s, i):
            while i < n and s[i] != "\n": i += 1
            continue
        if c == "/" and i + 1 < n and s[i+1] == "*":
            i += 2
            while i + 1 < n and not (s[i] == "*" and s[i+1] == "/"):
                if s[i] == "\n": out.append("\n")
                i += 1
            i += 2; continue
        if c in "\"'" and ifade_konumu(s, i):
            q = c; i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == q: break
                if s[i] == "\n": break
                i += 1
            i += 1; out.append(" "); continue
        if c == "`":
            i += 1; d = 0
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "$" and i+1 < n and s[i+1] == "{": d += 1; i += 2; continue
                if s[i] == "}" and d > 0: d -= 1; i += 1; continue
                if s[i] == "`" and d == 0: break
                if s[i] == "\n": out.append("\n")
                i += 1
            i += 1; out.append(" "); continue
        out.append(c); i += 1
    return "".join(out)


hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    s = sadece_kod(ham)

    ithal = set()
    for m in re.finditer(r"import\s+(.+?)\s+from\s+['\"]", s, re.S):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)):
            if x not in ("as", "from"): ithal.add(x)

    tanimli = set(re.findall(r"(?:function|class)\s+([A-Za-z_]\w*)", s))
    tanimli |= set(re.findall(r"(?:const|let|var)\s+([A-Za-z_]\w*)", s))
    # Yıkımla gelen bileşenler: { icon: Icon } gibi yeniden adlandırmalar da tanımlıdır
    tanimli |= set(re.findall(r":\s*([A-Z][A-Za-z0-9]*)\s*[,}]", s))
    # Fonksiyon parametrelerinden gelen bileşenler
    for m in re.finditer(r"\(\s*\{([^}]*)\}", s):
        tanimli |= set(re.findall(r"\b([A-Z][A-Za-z0-9]*)\b", m.group(1)))

    # JSX bileşen kullanımları: <Foo ...> ya da <Foo/>
    kullanilan = set(re.findall(r"<([A-Z][A-Za-z0-9]*)[\s/>]", s))
    # React.Fragment kısayolu ve bilinen HTML dışı istisnalar
    kullanilan -= {"React"}

    eksik = sorted(kullanilan - ithal - tanimli)
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — kullanılıyor ama tanımsız/import edilmemiş: {', '.join(eksik)}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
