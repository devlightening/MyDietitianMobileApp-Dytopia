# Global Task Execution Template

Bu dosya, her yeni görevde assistant'ın aynı kalite standardıyla çalışması için kısa görev şablonudur.

---

## Göreve başlarken zorunlu format

```md
**Task Type:** bugfix / feature / refactor / audit / integration / polish
**Scope:** backend / web / mobile / database / cross-cutting
**Behavior Change?:** yes / no
**Risk Level:** low / medium / high
```

---

## 1. İlk cevapta verilmesi gerekenler

### A. Durum özeti
- görev ne
- muhtemel etki alanı ne
- neye dokunmak gerekiyor

### B. Risk özeti
- kırılabilecek yerler
- doğrulanması gereken kritik alanlar

### C. En küçük doğru plan
Plan 3-7 maddeyi geçmesin.
Her madde doğrulanabilir olsun.

---

## 2. Implementasyon sırasında zorunlu kontrol listesi

### Eğer backend etkileniyorsa
- entity / DTO / route / service zincirini doğrula
- test veya gerçek local API ile kontrol et
- persistence değişiyorsa migration etkisini değerlendir

### Eğer web etkileniyorsa
- type/build temiz mi kontrol et
- server/client boundary'leri koru
- fake UI state ile gerçek behavior'ı karıştırma

### Eğer mobile etkileniyorsa
- API sözleşmesini doğrula
- safe area / keyboard / loading / error state düşün
- backend sorunu UI ile gizleme

### Eğer database etkileniyorsa
- schema <-> code uyumunu doğrula
- seed / fixture etkisini kontrol et
- query behavior'ı gerçek veriyle düşün

---

## 3. Tamamlandığında zorunlu teslim formatı

```md
## What Changed
- ...

## Why
- ...

## Affected Files
- ...

## Verification
- build:
- tests:
- api/db:
- ui:

## Remaining Risk / Unknown
- ...
```

---

## 4. Acceptance criteria yazım şablonu

```md
### Acceptance Criteria
- [ ] behavior X works
- [ ] behavior Y no longer fails
- [ ] regression Z did not break
- [ ] output is explainable / testable
```

---

## 5. Scope koruma cümlesi
Görev büyümeye başlarsa assistant şu mantıkla hareket etsin:

```md
Bu görevde yalnızca istenen davranışı kapatacak en küçük doğru değişikliği yap.
Aynı turda unrelated redesign, cleanup veya architecture migration başlatma.
```

---

## 6. Kanıt önceliği
Her zaman şu sırayla düşün:
1. real DB / real API
2. tests
3. code inspection
4. UI look

UI tek başına kanıt değildir.
