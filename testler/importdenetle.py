"""
EKSİK IMPORT DENETLEYİCİSİ
Dosya bölerken en büyük risk: bir bileşen taşınır ama kullandığı yardımcı taşınmaz ya da
import edilmez. Tarayıcıda "X is not defined" diye patlar; sözdizimi kontrolünden geçer.

Kodu karakter karakter tarar (dize / şablon / yorum / regex ayrımı yaparak), böylece
"https://..." içindeki // yorum sanılmaz.
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

def ust_seviye(s):
    ad = set()
    for m in re.finditer(r"^(?:export\s+)?(?:default\s+)?(?:function|class)\s+([A-Za-z_]\w*)", s, re.M):
        ad.add(m.group(1))
    for m in re.finditer(r"^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)", s, re.M):
        ad.add(m.group(1))
    return ad

def tum_tanimlar(s):
    ad = set()
    for m in re.finditer(r"(?:function|class)\s+([A-Za-z_]\w*)", s): ad.add(m.group(1))
    for m in re.finditer(r"(?:const|let|var)\s+([A-Za-z_]\w*)", s): ad.add(m.group(1))
    for m in re.finditer(r"(?:const|let|var)\s*\{([^}]*)\}", s):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)): ad.add(x)
    for m in re.finditer(r"function\s*\w*\s*\(([^)]*)\)", s):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)): ad.add(x)
    for m in re.finditer(r"\(\s*\{([^}]*)\}\s*\)\s*=>", s):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)): ad.add(x)
    return ad

def importlar(s):
    ad = set()
    for m in re.finditer(r"import\s+(.+?)\s+from\s+['\"]", s, re.S):
        for x in re.findall(r"[A-Za-z_]\w*", m.group(1)):
            if x not in ("as", "from", "default"): ad.add(x)
    return ad

if __name__ == "__main__":
    dosyalar = sys.argv[1:]
    kod = {f: sadece_kod(open(f, encoding="utf-8").read()) for f in dosyalar}
    evren = set()
    for f in dosyalar: evren |= ust_seviye(kod[f])

    hata = False
    for f in dosyalar:
        k = kod[f]
        yerel = tum_tanimlar(k) | importlar(open(f, encoding="utf-8").read())
        eksik = sorted(a for a in evren
                       if a not in yerel and re.search(r"(?<![\w.$])" + re.escape(a) + r"(?![\w$])", k))
        if eksik:
            hata = True
            print(f"✗ {os.path.basename(f)} — tanımsız/import edilmemiş: {', '.join(eksik[:12])}")
        else:
            print(f"✓ {os.path.basename(f)}")
    sys.exit(1 if hata else 0)
