"""
ÇİFT TANIM DENETLEYİCİSİ
Aynı isimde iki 'const/let' tanımı, JavaScript'te derleme hatasıdır ("already declared")
ama parantez dengesi bozulmadığı için diğer kontrollerden geçer. Bir düzenleme yanlışlıkla
iki kez uygulandığında tam olarak bu oluşur — bir kez başıma geldi ve deploy'u kırdı.

Sadece AYNI GİRİNTİ SEVİYESİNDEKİ ve BİRBİRİNE YAKIN tekrarları arar; farklı fonksiyonlarda
aynı isimli yerel değişken olması normaldir.
"""
import re, sys, os

hata = False
for yol in sys.argv[1:]:
    satirlar = open(yol, encoding="utf-8").read().split("\n")
    gorulen = {}
    for i, l in enumerate(satirlar, 1):
        m = re.match(r"^(\s*)(?:const|let)\s+\[?([A-Za-z_]\w*)", l)
        if not m: continue
        girinti, ad = len(m.group(1)), m.group(2)
        anahtar = (girinti, ad)
        if anahtar in gorulen and i - gorulen[anahtar] <= 3:
            print(f"✗ {os.path.basename(yol)} satır {i}: '{ad}' satır {gorulen[anahtar]}'de zaten tanımlı (çift tanım)")
            hata = True
        gorulen[anahtar] = i
    if not hata:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
