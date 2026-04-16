# Local Delivery Template — MyDietitianMobileApp

Claude/Cursor her görev sonunda aşağıdaki formatı kullanmalıdır.

---

## Zorunlu çıktı formatı

```md
## Task
Kısa görev özeti

## Classification
TEZ-CORE / INTEGRATION-PROOF / PRODUCT-POLISH

## Thesis Impact
Bu iş tezde hangi iddiayı güçlendiriyor?

## Current Truth
Göreve başlamadan önce gerçekten görülen durum neydi?

## Plan
1. ...
2. ...
3. ...

## Affected Files
- exact/path/one
- exact/path/two

## Changes Made
- ...
- ...

## Verification
### Build / Type Check
- ...

### Tests
- ...

### API / DB
- ...

### UI
- ...

## Acceptance Criteria Status
- [x] ...
- [ ] ...

## Remaining Risk / Unverified Areas
- ...

## Next Smallest Step
- ...
```

---

## Görev öncesi mikro-şablon
Uygulamaya başlamadan önce şu kısa formatı kullan:

```md
**Classification:** ...
**Task Type:** bugfix / feature / refactor / audit
**Risk Level:** low / medium / high
**Behavior Change:** yes / no
**Main Affected Layer:** backend / web / mobile / db / cross-cutting
```

---

## Kitchen görevleri için ek zorunlu bölüm
Eğer görev Kitchen / recommendation ile ilgiliyse şunu ayrıca ver:

```md
## Recommendation Truth Check
- selected ingredients:
- tenant context:
- candidate pool source:
- full match rule:
- partial rule:
- forbidden handling:
- explanation fields returned:
```

---

## Import görevleri için ek zorunlu bölüm
Eğer görev recipe import ile ilgiliyse şunu ayrıca ver:

```md
## Import Safety Check
- direct write to Recipes prevented?: yes/no
- staging area exists?: yes/no
- review before confirm?: yes/no
- ingredient match strategy:
- unresolved issue handling:
- ownership validation:
```

---

## Asla atlanmaması gereken dürüstlük satırı
Görev sonunda assistant mutlaka şunu belirtmeli:

- tam doğrulanmış olanlar
- yalnızca kod okumasına dayananlar
- dışarıdan / UI'dan henüz test edilmemiş olanlar

Bu repo için overclaim yasaktır.
