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

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    disaridan = importlar(ham) | GLOBALLER

    # JSX ifadesi içinde kullanılan küçük harfli adlar
    kullanim = set(re.findall(r"\{\s*([a-z_]\w*)\s*(?:\.|\?|\)|\}|&&|\|\||===|!==|>|<|\+|,|\s)", kod))
    kullanim -= ANAHTAR

    def bildirim_konumunda(ad):
        # const/let/var/function/class ADI
        if re.search(r"(?:const|let|var|function|class)\s+" + re.escape(ad) + r"\b", kod):
            return True
        # parametre ya da yıkım listesi: ardından , } ) = : gelir
        if re.search(r"[,{(\[\s]" + re.escape(ad) + r"\s*[,}\)\]=:]", kod):
            return True
        return False

    eksik = sorted(a for a in kullanim
                   if a not in disaridan and not bildirim_konumunda(a)
                   and not re.search(r"[çğıöşüÇĞİÖŞÜ]", a))
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — JSX'te kullanılan tanımsız ad: {', '.join(eksik[:10])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
