"""
EKSİK EXPORT DENETLEYİCİSİ

Bir dosyadan import edilen her adın, kaynak dosyada gerçekten export edildiğini doğrular.
Ayrıca öksüz kalmış "export" satırlarını yakalar.

Bu tam olarak bir deploy'u kıran hatadır: bir bileşenin başına kod eklenirken "export"
kelimesi yukarıda öksüz kaldı ve fonksiyon export edilmemiş oldu. Rollup şunu der:
  "MusteriPaneli" is not exported by "src/musteriPaneli.jsx"
Sözdizimi geçerli olduğu için diğer denetleyicilerin hiçbiri göremez.
"""
import re, sys, os

def import_ifadeleri(s):
    for m in re.finditer(r"^import\b", s, re.M):
        bas = m.start()
        adaylar = [x for x in (s.find('";', bas), s.find("';", bas)) if x != -1]
        if not adaylar: continue
        yield s[bas:min(adaylar) + 2]

dosyalar = sys.argv[1:]
# TAM YOL ile anahtarlanır: src/data.js ve api/data.js aynı dosya adını taşıyor ve
# yalnızca dosya adıyla anahtarlarsak biri diğerinin üzerine yazıp yanlış alarm verir.
exportlar = {}
for f in dosyalar:
    s = open(f, encoding="utf-8").read()
    adlar = set(re.findall(r"^export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z_]\w*)", s, re.M))
    # Yeniden dışa açma:  export { a, b } from "./x.js";  ve  export { a, b };
    for m in re.finditer(r"^export\s*\{([^}]*)\}", s, re.M):
        for x in m.group(1).split(","):
            ad = x.strip().split(" as ")[-1].strip()
            if ad: adlar.add(ad)
    exportlar[os.path.abspath(f)] = adlar

hata = 0
for f in dosyalar:
    s = open(f, encoding="utf-8").read()

    # Öksüz export: "export" tek başına, ardında tanım yok
    for m in re.finditer(r"^export\s*$", s, re.M):
        satir = s[:m.start()].count("\n") + 1
        print(f"✗ {os.path.basename(f)} satır {satir}: yalnız başına 'export' — ardında tanım yok")
        hata += 1

    for ifade in import_ifadeleri(s):
        km = re.search(r'from\s+["\']([^"\']+\.(?:jsx|js))["\']', ifade)
        if not km: continue
        # İçe aktarma yolu, İMPORT EDEN dosyanın klasörüne göre çözülür.
        kaynak = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(f)), km.group(1)))
        if kaynak not in exportlar: continue
        sus = re.search(r"\{([^}]*)\}", ifade, re.S)
        if not sus: continue
        for ad in [x.strip().split(" as ")[0].strip() for x in sus.group(1).split(",")]:
            if ad and ad not in exportlar[kaynak]:
                print(f"✗ {os.path.basename(f)} → {os.path.basename(kaynak)}: '{ad}' export EDİLMEMİŞ")
                hata += 1

if hata == 0:
    print("✓ tüm import edilen adlar kaynağında export edilmiş")
sys.exit(1 if hata else 0)
