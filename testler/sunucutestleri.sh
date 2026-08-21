#!/usr/bin/env bash
# SUNUCU TESTLERİ — t1…tN (dosyalardan sayılır)
#
# Testler gerçek Redis'e bağlanmamalı. Bu betik @vercel/kv paketini geçici olarak
# testler/taklit-kv ile değiştirir, testleri çalıştırır ve SONUNDA GERÇEĞİNİ GERİ KOYAR
# (test yarıda kesilse bile — trap sayesinde).
set -uo pipefail
KOK="$(cd "$(dirname "$0")/.." && pwd)"
KV="$KOK/node_modules/@vercel/kv"
YEDEK="$KOK/node_modules/@vercel/kv.gercek"

if [ ! -d "$KOK/node_modules" ]; then
  echo "node_modules yok — önce: npm install"; exit 1
fi

geri_koy() {
  if [ -d "$YEDEK" ]; then rm -rf "$KV"; mv "$YEDEK" "$KV"; fi
}
trap geri_koy EXIT INT TERM

[ -d "$KV" ] && mv "$KV" "$YEDEK"
mkdir -p "$KV" && cp "$KOK/testler/taklit-kv/"* "$KV/"

GECEN=0; KALAN=0; SORUNLU=""
# Sabit üst sınır yerine dosyalardan sayılıyor: yeni bir test eklendiğinde koşucuyu
# güncellemeyi unutmak, testin sessizce hiç çalışmaması demekti — bu yaşandı (t61).
SON=$(ls "$KOK"/testler/t*.mjs 2>/dev/null | sed 's/.*\/t//; s/\.mjs//' | sort -n | tail -1)
SON=${SON:-0}
for i in $(seq 1 "$SON"); do
  DOSYA="$KOK/testler/t$i.mjs"
  [ -f "$DOSYA" ] || continue
  CIKTI="$(cd "$KOK" && node "$DOSYA" 2>&1)"
  CIKIS=$?
  G=$(printf '%s' "$CIKTI" | grep -c '✓')
  K=$(printf '%s' "$CIKTI" | grep -c '✗')
  SIZ=$(printf '%s' "$CIKTI" | grep -c 'SIZIYOR')
  # Test ÇÖKERSE geriye ✗ satırı kalmaz; sayım yalnızca ✓'lara bakarsa çöküş "başarı" görünür.
  # Bu gerçekten yaşandı: yarısı çalışmayan bir dosya "31 kontrol geçti" diye raporlandı.
  if [ "$CIKIS" -ne 0 ] && [ "$K" -eq 0 ]; then
    K=1
    CIKTI="$CIKTI
  ✗ test çöktü (çıkış kodu $CIKIS) — yukarıdaki hataya bak"
  fi
  GECEN=$((GECEN+G)); KALAN=$((KALAN+K+SIZ))
  if [ "$K" -gt 0 ] || [ "$SIZ" -gt 0 ]; then
    printf "  ✗ t%-3s ✓%-4s ✗%s\n" "$i" "$G" "$((K+SIZ))"
    printf '%s\n' "$CIKTI" | grep -E '✗|SIZIYOR' | sed 's/^/       /'
    SORUNLU="$SORUNLU t$i"
  else
    printf "  ✓ t%-3s (%s kontrol)\n" "$i" "$G"
  fi
done

echo "────────────────────────────────"
if [ "$KALAN" -gt 0 ]; then
  echo "SONUÇ: ✓$GECEN  ✗$KALAN   —  BAKILACAK:$SORUNLU"; exit 1
fi
echo "SONUÇ: $GECEN kontrol geçti, hata yok."
