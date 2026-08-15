"""
DEĞİŞTİRİLEMEYEN DURUM DENETLEYİCİSİ

Bir useState değişkeni tanımlanır, listeyi süzmekte kullanılır — ama onu değiştirecek düğme
hiç eklenmezse, kullanıcı o süzgeçte kilitli kalır. Kod çalışır, hata vermez; sadece verinin
bir kısmına ERİŞİLEMEZ olur.

Gerçek olay: içerik sekmeleri eklenirken süzgeç mantığı yazıldı ama sekme çubuğu dosyaya
yazılmadı (çok adımlı bir düzenleme yarıda kesildi). Liste "Onay Bekleyenler"e sabitlendi,
diğer 10 kayda ulaşmanın yolu kalmadı. On iki denetleyicinin hiçbiri göremedi.

Yöntem: her useState için setter'ın tanım satırı DIŞINDA çağrılıp çağrılmadığına bakar.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod

hata = 0
for yol in sys.argv[1:]:
    kod = sadece_kod(open(yol, encoding="utf-8").read())
    sorunlu = []
    for m in re.finditer(r"const\s*\[\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*\]\s*=\s*useState", kod):
        deger, setter = m.group(1), m.group(2)
        # Setter ya doğrudan çağrılır, ya da bir bileşene PROP olarak geçirilir
        # (onChange={setAy} gibi). İkisi de "değiştirilebiliyor" demektir.
        cagri = len(re.findall(r"(?<![\w.])" + re.escape(setter) + r"\s*\(", kod))
        prop = len(re.findall(r"=\s*\{\s*" + re.escape(setter) + r"\s*\}", kod))
        prop += len(re.findall(r"(?<![\w.])" + re.escape(setter) + r"\s*[,}]", kod))
        if cagri == 0 and prop == 0:
            satir = kod[:m.start()].count("\n") + 1
            sorunlu.append(f"satır {satir}: {setter} hiç çağrılmıyor ({deger} değiştirilemez)")
    if sorunlu:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — {'; '.join(sorunlu[:6])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
