"""
TANIMSIZ DEĞİŞKEN DENETLEYİCİSİ (JSX içinde)

cagridenetle.py yalnızca ÇAĞRILAN adları (foo(...)) kontrol eder. Ama JSX içinde bir değişken
çağrılmadan da kullanılır:  {bagsizKartlar.length}
Ad tanımlı değilse bileşen ekrana geldiği anda çöker — sayfa siyah olur.

Gerçek olay: bir düzenleme yarıda kaldı; uyarı kartı eklendi ama beslediği değişken hiç
tanımlanmadı. Dokuz denetleyicinin hiçbiri göremedi, çünkü kullanım bir çağrı değildi.

YÖNTEM (kesinliği yüksek tutmak için):
Bir ad ya BİLDİRİM konumunda geçer (const/let/var/function/class'tan sonra; ya da bir
parametre/yıkım listesinde, yani ardından , } ) = : gelecek şekilde), ya da yalnızca KULLANIM
konumunda geçer (ardından . [ && gibi). Yalnızca kullanım konumunda geçen bir ad tanımsızdır.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod
from cagridenetle import importlar, GLOBALLER

ANAHTAR = {
    "const","let","var","if","else","return","try","catch","function","new","typeof","await",
    "for","while","switch","case","do","in","of","yield","delete","void","true","false","null",
    "undefined","this","class","get","set","import","export","async","break","continue",
    "default","throw","instanceof",
}

def fonksiyon_bloklari(kod):
    """Dosyayı üst seviye fonksiyonlara böler. Bir ad BAŞKA bir fonksiyonun parametresi
    olduğu için 'tanımlı' sayılmamalı — dosya genelinde bakmak bu hatayı kaçırıyordu
    (gerçek olay: `baslangic` bir bileşenin parametresiydi, başka bir bileşende kullanıldı)."""
    yerler = [m.start() for m in re.finditer(r"^(?:export\s+)?(?:async\s+)?function\s+\w+", kod, re.M)]
    if not yerler: return [kod]
    parcalar = []
    for i, b in enumerate(yerler):
        son = yerler[i + 1] if i + 1 < len(yerler) else len(kod)
        parcalar.append(kod[b:son])
    return parcalar

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    disaridan = importlar(ham) | GLOBALLER

    # Her fonksiyon KENDİ kapsamında incelenir; ayrıca dosya geneli (üst seviye sabitler)
    # her zaman erişilebilir sayılır.
    ustSeviye = set(re.findall(r"^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_]\w*)", kod, re.M))

    kullanim = set()
    kapsamlar = []
    for parca in fonksiyon_bloklari(kod):
        p_kullanim = set(re.findall(r"\{\s*([a-z_]\w*)\s*(?:\.|\?|\)|\}|&&|\|\||===|!==|>|<|\+|,|\s)", parca))
        p_kullanim -= ANAHTAR
        kapsamlar.append((parca, p_kullanim))
    kullanim = set()
    kapsamKod = kod

    def bildirim_konumunda(ad, kod=None):
        kod = kod if kod is not None else kapsamKod
        # const/let/var/function/class ADI
        if re.search(r"(?:const|let|var|function|class)\s+" + re.escape(ad) + r"\b", kod):
            return True
        # parametre ya da yıkım listesi: ardından , } ) = : gelir
        if re.search(r"[,{(\[\s]" + re.escape(ad) + r"\s*[,}\)\]=:]", kod):
            return True
        return False

    eksik = set()
    for parca, p_kullanim in kapsamlar:
        for a in p_kullanim:
            if a in disaridan or a in ustSeviye: continue
            if re.search(r"[çğıöşüÇĞİÖŞÜ]", a): continue
            if not bildirim_konumunda(a, parca):
                eksik.add(a)
    eksik = sorted(eksik)
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — JSX'te kullanılan tanımsız ad: {', '.join(eksik[:10])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
