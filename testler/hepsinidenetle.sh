#!/bin/bash
# TÜM KOD DENETİMLERİ — her paket öncesi çalıştırılır.
# Hiçbiri veriye dokunmaz; sadece kaynak dosyaları okur.
cd "$(dirname "$0")/.."
echo "── KOD DENETİMLERİ ──"
python3 testler/jsxdenetle.py  src/*.jsx src/*.js api/*.js lib/*.js > /dev/null && echo "✓ 1 sözdizimi"
python3 testler/bozulma.py     src/*.jsx                            > /dev/null && echo "✓ 2 şablon bozulması"
python3 testler/ciftdenetle.py src/*.jsx api/*.js lib/*.js          > /dev/null && echo "✓ 3 çift tanım"
python3 testler/jsxyapi.py     src/*.jsx                            > /dev/null && echo "✓ 4 JSX yapısı"
python3 testler/ikondenetle.py src/*.jsx                            > /dev/null && echo "✓ 5 eksik bileşen/ikon"
python3 testler/hookdenetle.py src/*.jsx src/*.js                   > /dev/null && echo "✓ 6 React hook'ları"
python3 testler/cagridenetle.py src/*.jsx src/*.js api/*.js lib/*.js | grep "^✗" | grep -v "Ciro\|Tamamlananlar" || echo "✓ 7 tanımsız çağrı yok"
python3 testler/butondenetle.py src/*.jsx                           > /dev/null && echo "✓ 8 buton bağlantıları"
python3 testler/exportdenetle.py src/*.jsx src/*.js api/*.js lib/*.js > /dev/null && echo "✓ 9 eksik export yok"
python3 testler/degiskendenetle.py src/*.jsx                        > /dev/null && echo "✓ 10 JSX'te tanımsız değişken yok"
python3 testler/musteriAlanDenetle.py                               > /dev/null && echo "✓ 11 müşteri paneli alanları düşmüyor"
echo ""
echo "── SUNUCU DENETİMLERİ ──"
echo "(testler/ klasöründe: node t5.mjs … t11.mjs — sahte veritabanı kullanır, gerçek veriye dokunmaz)"
