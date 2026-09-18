#!/bin/bash
# TÜM KOD DENETİMLERİ — her paket öncesi çalıştırılır.
# Hiçbiri veriye dokunmaz; sadece kaynak dosyaları okur.
cd "$(dirname "$0")/.."

# DÜŞEN DENETİM ARTIK GÖRÜNÜR VE ÇIKIŞ KODUNU BOZAR.
#
# Eski hâlde her satır `komut > /dev/null && echo "✓ …"` biçimindeydi: denetim düşerse
# çıktısı /dev/null'a gidiyor, `&& echo` çalışmıyor ve betik HİÇBİR ŞEY yazmadan devam
# ediyordu. Çıkış kodu da son satırınki oluyordu. Sonuç: bir denetim DÖRT SÜRÜM boyunca
# düştü ve "24 denetim temiz" diye rapor edildi — kimse fark etmedi.
#
# `denetle` düşen komutun ÇIKTISINI BASAR, sayacı artırır ve betik sonunda 1 ile çıkar.
DUSEN=0
denetle() {
  local etiket="$1"; shift
  local cikti
  if cikti=$("$@" 2>&1); then
    echo "✓ $etiket"
  else
    echo "✗ $etiket"
    echo "$cikti" | sed 's/^/    /'
    DUSEN=$((DUSEN + 1))
  fi
}

# 7 numaralı denetim bir BORU HATTI olduğu için `denetle`ye doğrudan verilemezdi ve
# uzun süre sarmalayıcının DIŞINDA kaldı: bulgularını ekrana basıyor ama DUSEN sayacını
# artırmıyordu, yani düşse bile betik 0 ile çıkıyordu. Boru hattı bir fonksiyona alındı;
# `denetle` fonksiyonları da çalıştırabildiği için artık diğerleriyle aynı yoldan geçiyor.
#
# Betiğin KENDİ çıkış kodu kullanılamaz: `cagridenetle.py` iki bilinen YANLIŞ ALARM
# yüzünden zaten 1 ile çıkıyor — "Tamamlananlar" bir JSX başlığı (`} Tamamlananlar (`),
# "Ciro" ise bir dize sabitinin içi (`"Ciro (KDV Dahil Toplam)"`). İkisi de çağrı değil.
# Bu yüzden süzgeç korunuyor ve karar GERİYE KALAN satırlara göre veriliyor.
cagriDenetimi() {
  local kalan
  kalan=$(python3 testler/cagridenetle.py src/*.jsx src/*.js api/*.js lib/*.js \
    | grep "^✗" | grep -v "Ciro\|Tamamlananlar")
  if [ -n "$kalan" ]; then
    printf '%s\n' "$kalan"
    return 1
  fi
  return 0
}

echo "── KOD DENETİMLERİ ──"
denetle "1 sözdizimi" python3 testler/jsxdenetle.py  src/*.jsx src/*.js api/*.js lib/*.js
# 1b: GERÇEK ayrıştırma. Yukarıdaki sezgisel denetim bir import satırındaki çift virgülü
#     kaçırdı ve "✓" dedi; derleme ise patladı. Derleyicinin kendisi son sözü söylesin.
denetle "1b gerçek ayrıştırma (esbuild)" node testler/gercekSozdizimi.mjs
denetle "2 şablon bozulması" python3 testler/bozulma.py     src/*.jsx
denetle "3 çift tanım" python3 testler/ciftdenetle.py src/*.jsx api/*.js lib/*.js
denetle "4 JSX yapısı" python3 testler/jsxyapi.py     src/*.jsx
denetle "5 eksik bileşen/ikon" python3 testler/ikondenetle.py src/*.jsx
denetle "6 React hook'ları" python3 testler/hookdenetle.py src/*.jsx src/*.js
denetle "7 tanımsız çağrı yok" cagriDenetimi
denetle "8 buton bağlantıları" python3 testler/butondenetle.py src/*.jsx
denetle "9 eksik export yok" python3 testler/exportdenetle.py src/*.jsx src/*.js api/*.js lib/*.js
denetle "10 JSX'te tanımsız değişken yok" python3 testler/degiskendenetle.py src/*.jsx
denetle "11 müşteri paneli alanları düşmüyor" python3 testler/musteriAlanDenetle.py
denetle "12 kapsam dışı kullanım yok" python3 testler/kapsamdenetle.py src/*.jsx
denetle "13 değiştirilemeyen durum yok" python3 testler/olusetter.py src/*.jsx
denetle "14 yayılımda gelmeyen ad yok" python3 testler/kullanimdenetle.py src/*.jsx api/*.js lib/*.js
denetle "15 ekran öğeleri yerinde" python3 testler/ekrandenetle.py
denetle "16 tanımsız sabit yok" python3 testler/sabitdenetle.py src/*.jsx api/*.js lib/*.js
denetle "17 erişilemeyen ad yok" python3 testler/erisimdenetle.py src/*.jsx
denetle "18 sistem belgesi envanteri güncel" node testler/sistemBelgesi.mjs
denetle "19 api fonksiyon sayısı sabiti güncel" node testler/fonksiyonSayisi.mjs
denetle "20 tema anahtarları gerçek" node testler/temaAnahtari.mjs
denetle "21 yanıt alanı belgeye sızmıyor" node testler/yanitAlanlari.mjs
denetle "22 yeniden dışa verilen ad yerel kullanılmıyor" node testler/yenidenDisaVerme.mjs
denetle "23 izin listeleri ve sunucu varsayılanları aynı" node testler/izinListeleri.mjs
denetle "24 saf fonksiyonun dönüş değeri atılmıyor" node testler/safDonusDegeri.mjs
denetle "25 tanımlanmamış isme çağrı yok" node testler/tanimsizIsim.mjs
denetle "26 .claude katmanı güncel" node testler/claudeKatmani.mjs
echo ""
if [ "$DUSEN" -gt 0 ]; then
  echo "── $DUSEN DENETİM DÜŞTÜ ──"
  exit 1
fi
echo "── SUNUCU DENETİMLERİ ──"
echo "(testler/ klasöründe: node t5.mjs … t11.mjs — sahte veritabanı kullanır, gerçek veriye dokunmaz)"
