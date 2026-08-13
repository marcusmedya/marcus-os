"""
JSX-farkında sözdizimi denetleyicisi.

Önceki denemenin sorunu: Türkçe metindeki kesme işaretini (Drive'ın) dize başlangıcı
sanıyordu. Çözüm bağlama bakmak: bir tırnak ancak İFADE BAŞLAYABİLECEĞİ bir konumda
gelirse dize açar (=, (, [, {, ,, :, ?, &&, ||, return, satır başı gibi). Bir harften
hemen sonra gelen ' apostrofudur, dize değil.
"""
import sys

# '<' ve '>' bilerek DIŞARIDA: JSX'te bir etiketin ardından gelen apostrof
# (</strong>'e alman) dize başlangıcı değil, Türkçe metnin parçasıdır.
IFADE_ONCESI = set("=([{,:;?&|!+-*/%~^") | {""}
ANAHTAR = ("return", "typeof", "case", "in", "of", "do", "else", "await", "yield")

def onceki_anlamli(s, i):
    j = i - 1
    while j >= 0 and s[j] in " \t":
        j -= 1
    return (s[j], j) if j >= 0 else ("", -1)

def dize_baslar_mi(s, i):
    c, j = onceki_anlamli(s, i)
    if c == "" or c == "\n":
        return True
    if c in IFADE_ONCESI:
        return True
    # `return 'x'` gibi anahtar kelimelerden sonra
    if c.isalpha():
        k = j
        while k >= 0 and (s[k].isalnum() or s[k] == "_"):
            k -= 1
        kelime = s[k + 1:j + 1]
        return kelime in ANAHTAR
    return False

def denetle(yol):
    s = open(yol, encoding="utf-8").read()
    i, n, satir = 0, len(s), 1
    yigin, hatalar = [], []
    while i < n:
        c = s[i]
        if c == "\n":
            satir += 1; i += 1; continue
        if c == "/" and i + 1 < n and s[i+1] == "/":
            while i < n and s[i] != "\n": i += 1
            continue
        if c == "/" and i + 1 < n and s[i+1] == "*":
            i += 2
            while i + 1 < n and not (s[i] == "*" and s[i+1] == "/"):
                if s[i] == "\n": satir += 1
                i += 1
            i += 2; continue
        # Regex literali: ifade başlayabilecek bir konumdaki '/' regex açar.
        # Bu olmadan /'/g gibi bir regex, apostrofu dize sanılarak yanlış alarm veriyordu.
        # '<' sonrasi '/' JSX kapanis etiketidir (</div>), regex degil.
        # JSX etiketleri regex degil: '</div>' ve kendini kapatan '/>'.
        # '</div>' her zaman JSX. '/>' ise SADECE satır başındaysa JSX kapanışıdır —
        # ".replace(/>/g, ...)" içindeki gibi bir ifade konumunda geliyorsa o bir regex.
        onc = onceki_anlamli(s, i)[0]
        jsx_etiket = onc == "<" or (i + 1 < n and s[i+1] == ">" and onc in ("", "\n"))
        if c == "/" and dize_baslar_mi(s, i) and not jsx_etiket:
            bas_satir = satir; i += 1; sinif = False
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "[": sinif = True
                elif s[i] == "]": sinif = False
                elif s[i] == "/" and not sinif: break
                elif s[i] == "\n":
                    hatalar.append(f"satır {bas_satir}: kapanmamış regex"); break
                i += 1
            i += 1
            while i < n and s[i] in "gimsuyd": i += 1
            continue
        if c in "\"'" and dize_baslar_mi(s, i):
            q, bas_satir = c, satir
            i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == q: break
                if s[i] == "\n":
                    hatalar.append(f"satır {bas_satir}: kapanmamış dize"); break
                i += 1
            i += 1; continue
        if c == "`":
            bas_satir = satir; i += 1; d = 0
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == "$" and i+1 < n and s[i+1] == "{": d += 1; i += 2; continue
                if s[i] == "}" and d > 0: d -= 1; i += 1; continue
                if s[i] == "`" and d == 0: break
                if s[i] == "\n": satir += 1
                i += 1
            if i >= n: hatalar.append(f"satır {bas_satir}: kapanmamış şablon literali")
            i += 1; continue
        if c in "([{":
            yigin.append((c, satir)); i += 1; continue
        if c in ")]}":
            es = {")": "(", "]": "[", "}": "{"}[c]
            if not yigin:
                hatalar.append(f"satır {satir}: fazladan '{c}'")
            elif yigin[-1][0] != es:
                hatalar.append(f"satır {satir}: '{c}' kapatıyor ama açık olan '{yigin[-1][0]}' (satır {yigin[-1][1]})")
                yigin.pop()
            else:
                yigin.pop()
            i += 1; continue
        i += 1
    for ac, sat in yigin[:5]:
        hatalar.append(f"satır {sat}: kapanmamış '{ac}'")
    return hatalar

ok = True
for yol in sys.argv[1:]:
    h = denetle(yol)
    if h:
        ok = False
        print(f"✗ {yol}")
        for x in h[:6]: print("   ", x)
    else:
        print(f"✓ {yol}")
sys.exit(0 if ok else 1)
