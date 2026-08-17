"""
ÇİFT TANIM DENETLEYİCİSİ

Aynı isimde iki 'const/let' tanımı JavaScript'te DERLEME hatasıdır
("The symbol X has already been declared") ama parantez dengesi bozulmadığı için
diğer denetimlerden geçer.

v137'de kasaToplami'yi 4 satır arayla iki kez tanımladım; eski sürüm yalnızca "3 satır
içindeki" tekrarlara baktığı için göremedi ve Vercel derlemesi kırıldı.

DOĞRU KURAL: JavaScript'te tekrar tanım yalnızca AYNI BLOK içinde hatadır. Farklı if/for
bloklarında ya da farklı fonksiyonlarda aynı ad kullanmak tamamen geçerlidir — ilk düzeltme
denemem bunu göz ardı edip 90'dan fazla yanlış alarm verdi.

Yöntem: süslü parantez derinliğini takip eden bir kapsam yığını. '{' görünce yeni kapsam
açılır, '}' görünce kapanır. Bir ad YALNIZCA içinde bulunduğu kapsamda tekrar tanımlanmışsa
hata verilir.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod

hata = False
for yol in sys.argv[1:]:
    kod = sadece_kod(open(yol, encoding="utf-8").read())
    satirlar = kod.split("\n")
    yigin = [{}]                    # kapsam yığını: her eleman {ad: satır}
    dosya_hatasi = False
    for no, satir in enumerate(satirlar, 1):
        # Önce bu satırdaki tanımı kaydet (tanım, satırdaki '{' açılmadan önce geçerlidir)
        m = re.match(r"^\s*(?:const|let)\s+([A-Za-z_]\w*)\s*=", satir)
        if m:
            ad = m.group(1)
            if ad in yigin[-1]:
                print(f"✗ {os.path.basename(yol)} satır {no}: '{ad}' "
                      f"satır {yigin[-1][ad]}'de zaten tanımlı (aynı blokta çift tanım)")
                hata = dosya_hatasi = True
            yigin[-1][ad] = no
        # Sonra bu satırdaki parantezlerle kapsamı güncelle
        for c in satir:
            if c == "{":
                yigin.append({})
            elif c == "}" and len(yigin) > 1:
                yigin.pop()
    if not dosya_hatasi:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
