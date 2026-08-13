"""
KOD BOZULMA DEDEKTÖRÜ
Amaç: bir kod parçasının yanlışlıkla şablon literalinin (`...`) ya da dizenin ORTASINA
girmesini yakalamak. Bu tür bozulma karakter sayımıyla dengeli görünür ama derlenmez —
son hatada tam olarak bu oldu.

Yöntem: her şablon literalini bul, içeriğinde kod işareti ara (fonksiyon tanımı, JSDoc
bloğu, import satırı). Şablon içinde bunlar olmaz.
"""
import sys, re

SUPHELI = [
    (r"\n\s*/\*\*", "JSDoc yorum bloğu"),
    (r"\n\s*function\s+\w+\s*\(", "fonksiyon tanımı"),
    (r"\n\s*const\s+[A-Z_]{3,}\s*=", "sabit tanımı"),
    (r"\nimport\s+", "import satırı"),
    (r"\nexport\s+", "export satırı"),
]

def sablonlari_bul(s):
    """Şablon literallerini (backtick) konumlarıyla döndürür — ${} yuvalanmasını sayar."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == "\\": i += 2; continue
        if c in "\"'":
            q = c; i += 1
            while i < n and s[i] != q:
                if s[i] == "\\": i += 2; continue
                if s[i] == "\n": break
                i += 1
            i += 1; continue
        if c == "/" and i+1 < n and s[i+1] == "/":
            while i < n and s[i] != "\n": i += 1
            continue
        if c == "/" and i+1 < n and s[i+1] == "*":
            i += 2
            while i+1 < n and not (s[i] == "*" and s[i+1] == "/"): i += 1
            i += 2; continue
        if c == "`":
            bas = i; i += 1; d = 0
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "$" and i+1 < n and s[i+1] == "{": d += 1; i += 2; continue
                if s[i] == "}" and d > 0: d -= 1; i += 1; continue
                if s[i] == "`" and d == 0: break
                i += 1
            out.append((bas, i, s[bas:i+1]))
            i += 1; continue
        i += 1
    return out

hepsi_ok = True
for yol in sys.argv[1:]:
    s = open(yol, encoding="utf-8").read()
    bulgular = []
    for bas, son, icerik in sablonlari_bul(s):
        satir = s[:bas].count("\n") + 1
        # 400 karakterden uzun şablon + içinde kod işareti = güçlü bozulma sinyali
        for kalip, ad in SUPHELI:
            if re.search(kalip, icerik):
                bulgular.append(f"satır {satir}: şablon literali içinde {ad} — kod dizenin içine kaçmış olabilir")
                break
    if bulgular:
        hepsi_ok = False
        print(f"✗ {yol}")
        for b in bulgular[:5]: print("   ", b)
    else:
        print(f"✓ {yol} — şablon literalleri temiz")
sys.exit(0 if hepsi_ok else 1)
