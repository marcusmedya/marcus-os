"""
REACT HOOK DENETLEYİCİSİ
Dosya bölerken bir bileşen taşınır ama kullandığı hook (useMemo, useRef, useCallback)
import listesine eklenmezse, o bileşen ekrana geldiği anda "useMemo is not defined" verir
ve sayfa siyah olur. Sözdizimi geçerlidir, hiçbir yapısal kontrol yakalamaz.
"""
import re, sys, os
HOOKS = ["useState","useEffect","useMemo","useRef","useCallback","useLayoutEffect","useReducer","useContext"]
hata = 0
for yol in sys.argv[1:]:
    s = open(yol, encoding="utf-8").read()
    m = re.search(r'import\s+React?\s*,?\s*\{([^}]*)\}\s*from\s*["\']react["\']', s)
    m2 = re.search(r'import\s*\{([^}]*)\}\s*from\s*["\']react["\']', s)
    edilen = set()
    for mm in (m, m2):
        if mm: edilen |= set(x.strip() for x in mm.group(1).split(","))
    kullanilan = set(h for h in HOOKS if re.search(r"(?<![\w.])" + h + r"\s*\(", s))
    # React.useX biçimi de geçerlidir
    kullanilan -= set(h for h in HOOKS if re.search(r"React\." + h, s))
    eksik = sorted(kullanilan - edilen)
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — import edilmemiş hook: {', '.join(eksik)}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
