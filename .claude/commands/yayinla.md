---
description: Yayın ritüeli — belgeleri güncelle, doğrula, işle, PR aç, sırayı koru
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Bir değişikliği yayına hazırlama sırası. **Adımları atlama**; her biri bu projede
gerçekten yaşanmış bir kayıptan geliyor.

## 1 · Önce belgeler, sonra commit

Değişiklik şunlardan birine dokunduysa **aynı commit içinde** belge de güncellenir:

| Değişen | Güncellenecek |
|---|---|
| Yeni `api/` ucu · `lib/` modülü · ortam değişkeni · zamanlanmış iş | `MARCUS-OS-SISTEM.md` |
| Yetki/rol · aşama · stok kuralı · kilit davranışı · test komutu | `CLAUDE.md` |
| Hata düzeltmesi · yeni test · arayüz · metin | `README.md` |

**Ayrıca: düzeltmenin YANLIŞ HÂLE GETİRDİĞİ cümleleri ara.** Bu somut olarak yaşandı —
denetim 7 sayaca bağlandıktan sonra `CLAUDE.md` ve `/dogrula` hâlâ "çıkış kodunu
etkilemez" diyordu. Bir davranışı değiştirdiysen o davranışı anlatan metinleri `grep`'le.

## 2 · Doğrula — COMMIT'TEN ÖNCE

```
/dogrula
```

Beş adımın da çıkışı 0 olmalı. **Sonra değil, önce çalıştır**: bu oturumda iki kez
düzenleme kazası derlemeyi kırdı (import çok satırlı import'un ortasına girdi, blok
başka fonksiyonun gövdesine düştü) ve ikisi de ancak derlemede görüldü.

## 3 · Ölçümü commit mesajına yaz

Bir koruma eklediysen `/olc` ile ölç ve sonucu mesaja koy:

```
ÖLÇÜM: koruma geri konuldu → 2522 kontrol 2519'a düştü (3 kontrol)
```

**Düşen sayı 0 ise koruma yoktur** — bunu gizleme, yaz.

## 4 · Commit

Mesaj **neyi** değil **niçin**i anlatır: hangi hata yaşandı, neden bu çözüm.
Sonuna proje imzasını ekle.

## 5 · Gönder

```
git push -u origin <dal>
```
Ağ hatasında 2s → 4s → 8s → 16s ile dört kez dene. Rebase yaptıysan
`--force-with-lease` kullan, çıplak `--force` ASLA.

## 6 · PR

Gövde şunları taşımalı: değişen dosyalar tablosu · **ölçüm** · test sonuçları ·
**kalan riskler**. Riskleri yazmak seçenek değil — okuyan neyin kapsanmadığını bilmeli.

---

## 7 · Birleştirme — sıra ve squash tuzağı

**Kullanıcının açık onayı olmadan BİRLEŞTİRME.**

Birden fazla PR varsa sırayı yaz ve ona uy. **Yığılı PR'larda squash tuzağı var** ve
bu oturumda gerçekten ısırdı:

> Alt PR squash ile birleşince üst PR'ın dalı, artık `main`'de TEK commit olarak duran
> o commitleri hâlâ taşır. Öylece birleştirilirse değişiklikler iki kez uygulanır.

Çözüm — üst PR'ı yalnızca **kendi** commitleriyle yeni main'e taşı:

```
git fetch origin
git rebase --onto origin/main <alt-PR'ın-son-sha>
git log --oneline origin/main..HEAD      # yalnızca KENDİ commitleri kalmalı
git diff --stat origin/main...HEAD       # yalnızca KENDİ değişikliği
```
Sonra PR'ın hedefini `main`'e çevir.

## 8 · Birleşimden SONRA tekrar doğrula

**Bu adım isteğe bağlı değil.** İki dal birbirinden habersizce aynı sayıyı
değiştirebiliyor: #122 envanteri 109'a çekti, #124 `t110.mjs` ekledi — ikisi de kendi
içinde doğruydu, **yalnızca ikisi birden inince** denetim 18 düştü.

Her birleştirmeden sonra `main`'de `/dogrula` çalıştır. Düşen varsa bu yeni bir kırılma
değil, iki değişikliğin kesişimidir — düzelt ve ayrıca söyle.

---

## Raporlama

```
Belgeler    : CLAUDE.md, MARCUS-OS-SISTEM.md güncellendi
Doğrulama   : <koşudan> denetim · <koşudan> kontrol · derleme 0 · tarayıcı <koşudan> · api <koşudan>/12
Ölçüm       : koruma kırılınca 3 kontrol düştü
Commit      : <sha>
PR          : <bağlantı>
Birleştirme : YAPILMADI — onay bekleniyor
```

Çalıştırmadığın bir adımı çalıştırmış gibi yazma. Bu projede tam olarak bu yüzden
dört sürüm boyunca "denetimler temiz" diye rapor edildi.
