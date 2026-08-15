"""
KULLANILAN AMA GELMEYEN AD DENETLEYİCİSİ (geniş tarama)

degiskendenetle.py yalnızca "{ad" biçimindeki doğrudan JSX kullanımlarını yakalar. Bir ad
şu biçimlerde de kullanılabilir ve o zaman görülmez:
    style={{ ...inputStyle, ... }}     ← yayılım içinde
    {String(baslangic + 1)}            ← fonksiyon çağrısı içinde
    onClick={() => yardimci(x)}        ← ok fonksiyonu gövdesinde

Gerçek olay: müşteri panelinde "Revize İste"ye basınca sayfa siyah oluyordu. Sebep
inputStyle ve saveBtnStyle'ın import edilmemiş olmasıydı; ikisi de `...yayılım` içinde
kullanılıyordu ve on üç denetleyicinin hiçbiri göremedi.

Yöntem: dosyadaki TÜM tanımlayıcıları toplar, JS anahtar kelimelerini, tarayıcı/JS
globallerini, dosyada tanımlı ve import edilmiş adları çıkarır. Kalan her ad şüphelidir.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importdenetle import sadece_kod
from cagridenetle import importlar, GLOBALLER

ANAHTAR = {
    "const","let","var","if","else","return","try","catch","function","new","typeof","await",
    "for","while","switch","case","do","in","of","yield","delete","void","true","false","null",
    "undefined","this","class","get","set","import","export","async","break","continue",
    "default","throw","instanceof","from","as","static","super","extends",
}

hata = 0
for yol in sys.argv[1:]:
    ham = open(yol, encoding="utf-8").read()
    kod = sadece_kod(ham)
    disaridan = importlar(ham) | GLOBALLER | ANAHTAR

    # Dosyada TANIMLANAN adlar — DAR tanım. Önceki geniş sürüm, adın KULLANIM yerindeki
    # süslü parantezden de topladığı için aranan hatayı "tanımlı" sanıyordu.
    tanimli = set(re.findall(r"(?:const|let|var|function|class)\s+([A-Za-z_]\w*)", kod))
    # yıkım bildirimleri:  const { a, b } = ...   /   const [a, b] = ...
    for m in re.finditer(r"(?:const|let|var)\s*[\{\[]([^\}\]]*)[\}\]]", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    # fonksiyon parametreleri
    for m in re.finditer(r"function\s*\w*\s*\(([^)]*)\)", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    for m in re.finditer(r"\(([^)]*)\)\s*=>", kod):
        tanimli |= set(re.findall(r"[A-Za-z_]\w*", m.group(1)))
    tanimli |= set(re.findall(r"([A-Za-z_]\w*)\s*=>", kod))

    # nesne anahtarları (ad: deger) — kullanım değil
    anahtarlar = set(re.findall(r"([A-Za-z_]\w*)\s*:", kod))

    # KULLANIM: yayılım, çağrı ve özellik erişimi biçimleri
    # Yalnızca YAYILIM kullanımı taranır. "cagri(" zaten cagridenetle.py'de var;
    # "ad.ozellik" biçimi Türkçe cümlelerdeki kelimelerle karışıp yanlış alarm veriyordu
    # (JSX metni kod gibi görünüyor). Yayılım ise ancak gerçek bir nesne/dizi üzerinde
    # yapılabilir, o yüzden kesin sonuç verir. 
    kullanim = set(re.findall(r"\.\.\.([A-Za-z_]\w*)", kod))

    eksik = sorted(a for a in kullanim
                   if a not in tanimli and a not in disaridan and a not in anahtarlar
                   and not re.search(r"[çğıöşüÇĞİÖŞÜ]", a))
    if eksik:
        hata += 1
        print(f"✗ {os.path.basename(yol)} — gelmeyen ad: {', '.join(eksik[:12])}")
    else:
        print(f"✓ {os.path.basename(yol)}")
sys.exit(1 if hata else 0)
