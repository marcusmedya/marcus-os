"""
JSX YAPI DENETLEYİCİSİ
"{koşul && (" satırından hemen sonra bir JSX yorumu ya da başka bir "{...} &&" gelirse,
bir blok başka bir bloğun ORTASINA girmiş demektir — derleme hatası verir ama parantez
dengesi bozulmadığı için diğer kontrollerden geçer. Bir düzenleme yanlış konuma
uygulandığında tam olarak bu olur; bir kez deploy'u kırdı.
"""
import re, sys, os

hata = False
for yol in sys.argv[1:]:
    satirlar = open(yol, encoding="utf-8").read().split("\n")
    for i in range(len(satirlar) - 1):
        su = satirlar[i].strip()
        sonraki = satirlar[i + 1].strip()
        # "{x && (" gibi bir blok açılışından hemen sonra JSX yorumu ya da yeni bir blok
        if re.match(r"^\{[^}]*&&\s*\($", su) and (sonraki.startswith("{/*") or re.match(r"^\{[^}]*&&\s*\($", sonraki)):
            print(f"✗ {os.path.basename(yol)} satır {i+2}: bir JSX bloğu, açılmış başka bir bloğun ortasına girmiş")
            hata = True
    if not hata:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
