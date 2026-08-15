"""
KAPSAM DIŞI KULLANIM DENETLEYİCİSİ

Bir bileşenin İÇİNDE tanımlanmış bir sabit/fonksiyon, BAŞKA bir bileşenden kullanılamaz.
Kod sözdizimi olarak geçerlidir; hata ancak o bileşen ekrana geldiğinde ortaya çıkar —
kullanıcı o sekmeye tıkladığında sayfa siyah olur.

Gerçek olay: DURUM_STIL, MusteriPaneli'nin içinde tanımlıydı; DurumListesi bileşeni onu
kullanıyordu. "Revize İstediklerin" sekmesine her tıklandığında uygulama çöküyordu.
On bir denetleyicinin hiçbiri göremedi.

Yöntem: dosyayı üst seviye fonksiyonlara böler; her bloğun İÇİNDE tanımlanan adları bulur;
bu adların BAŞKA bir blokta kullanılıp kullanılmadığına bakar.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod

def bloklar(kod):
    yerler = [m.start() for m in re.finditer(r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)", kod, re.M)]
    adlar = re.findall(r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)", kod, re.M)
    out = []
    for i, b in enumerate(yerler):
        son = yerler[i + 1] if i + 1 < len(yerler) else len(kod)
        out.append((adlar[i], kod[b:son]))
    return out

hata = 0
for yol in sys.argv[1:]:
    kod = sadece_kod(open(yol, encoding="utf-8").read())
    bl = bloklar(kod)
    ustSeviye = set(re.findall(r"^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_]\w*)", kod, re.M))

    sorunlar = []
    for ad, govde in bl:
        # Bu bloğun İÇİNDE (girintili) tanımlanan adlar — üst seviye olanlar hariç
        icerdeki = set(re.findall(r"^\s+(?:const|let|var|function)\s+([A-Z_][A-Z0-9_]{2,})\b", govde, re.M))
        icerdeki -= ustSeviye
        for sabit in icerdeki:
            for ad2, govde2 in bl:
                if ad2 == ad: continue
                if re.search(r"(?<![\w.])" + re.escape(sabit) + r"\b", govde2):
                    sorunlar.append(f"{sabit}: {ad} içinde tanımlı, {ad2} kullanıyor")
    if sorunlar:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — kapsam dışı kullanım: {'; '.join(sorted(set(sorunlar))[:6])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
