# Local Thesis and Product Rules — MyDietitianMobileApp

## En üst öncelik
Bu projede her yeni görev aşağıdaki üç sınıftan birine zorunlu olarak yerleştirilmelidir:

1. **TEZ-CORE**
2. **INTEGRATION-PROOF**
3. **PRODUCT-POLISH**

Eğer bir görev sınıflandırılamıyorsa, önce sınıflandır.

---

## 1. TEZ-CORE
Tez savunmasını doğrudan güçlendiren işler.

### Örnekler
- normalization accuracy
- taxonomy wiring
- benchmark dataset
- recommendation explainability
- log fields
- premium tenant isolation correctness
- forbidden / mandatory / substitute logic

### Kural
TEZ-CORE eksikken PRODUCT-POLISH büyütme.

---

## 2. INTEGRATION-PROOF
Sistemin uçtan uca gerçekten çalıştığını kanıtlayan işler.

### Örnekler
- premium activation -> linked dietitian -> recipe visibility
- meal plan -> completion -> compliance chain
- smoke tests with seeded DB
- mobile/web/backend contract verification
- import flow confirm persistence

---

## 3. PRODUCT-POLISH
Ürün hissi, görsel kalite ve kullanıcı deneyimi işleri.

### Örnekler
- card redesign
- motion refinement
- loading state polish
- profile screen cleanup
- copy improvements

### Kural
Bu kategori değerlidir ama tez omurgasının önüne geçmemelidir.

---

## Non-negotiable ürün kuralları

### A. Recommendation engine generic search engine gibi davranamaz
Recipe önerisi:
- text similarity ile değil
- recipe ingredient roles ile
- deterministic kurallarla
üretilmelidir.

### B. Premium tenant isolation sert korunmalı
Premium kullanıcı için:
- linked dietitian tarifleri öncelikli olmalı
- başka dietitian private recipe asla sızmamalı
- clinic priority mantığı recommendation validity'yi ezmemeli

### C. Full match etiketi kozmetik olamaz
Bir recipe ancak şu durumda Full Match sayılır:
- hard mandatory'ler karşılandıysa
- forbidden conflict yoksa
- substitute kullanıldıysa açıklanabiliyorsa

### D. Partial result ayrı ve net gösterilmeli
Eksik zorunlu ingredient varsa:
- recipe valid main recommendation gibi gösterilmemeli
- partial bucket'ta net açıklama ile yer almalı

### E. Explainability zorunlu
Her anlamlı recommendation mümkünse şu alanları taşımalı:
- matchedMandatory
- matchedOptional
- missingMandatory
- usedSubstitutes
- forbiddenConflicts
- isDietitianRecipe
- score
- rankingReason / reasonLabel

### F. AI anlatıcı olabilir, karar verici değil
Özellikle tez dilinde:
- karar algoritma verir
- AI gerekirse açıklama / motivasyon / narration üretir

---

## Hard implementation priorities

### Priority 1 — Correctness
- tenant isolation
- mandatory enforcement
- substitute logic
- false positive removal

### Priority 2 — Measurability
- normalization logs
- recommendation logs
- benchmark cases
- explainability data

### Priority 3 — Integration
- real DB verification
- smoke/E2E flows
- route/DTO consistency

### Priority 4 — UX
- stable combine CTA
- result hierarchy
- premium visual quality

---

## Kabul edilmeyecek davranışlar
- nohut + yağ seçilmişken omleti valid top recommendation yapmak
- başka dietitian private recipe sızdırmak
- demo/test veriyi production recommendation pool'a sokmak
- UI ile backend mantık hatasını gizlemek
- benchmark/log olmadan "tez-ready" demek

---

## Kitchen için özel kurallar

### Kitchen engine target state
1. input normalize edilir
2. tenant context çözülür
3. candidate pool filtrelenir
4. recipe rules evaluate edilir
5. invalid results elenir
6. valid results deterministic rank edilir
7. UI gerekçeyi gösterir
8. execution loglanır

### Result hierarchy
1. featured best recommendation
2. valid linked-dietitian recipes
3. valid public recipes
4. partial/missing suggestions

### Featured selection kuralı
Featured recipe:
- hem yüksek puanlı
- hem mantıksal olarak savunulabilir
olmalıdır.

---

## Recipe import için özel kurallar
Recipe import özelliği PRODUCT-POLISH / B2B value üretir ama TEZ-CORE'u geciktirmemelidir.

Yine de şu kurallar zorunlu:
- upload direkt real Recipes'e yazmamalı
- staging/review/confirm akışı olmalı
- ingredient match dictionary üzerinden gitmeli
- import edilen recipe'ler dietitian-scoped ownership ile kaydolmalı

---

## Delivery rule
Her iş sonunda şu formatta rapor ver:

```md
**Classification:** TEZ-CORE / INTEGRATION-PROOF / PRODUCT-POLISH
**Thesis Impact:** ...
**Files Modified:** ...
**Verification:** ...
**Remaining Risk:** ...
```
