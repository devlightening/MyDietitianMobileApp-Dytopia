# MASTER CLAUDE CONTEXT PACK

Bu dosya, klasördeki tüm ana MD dosyalarının birleşik sürümüdür.


---

# FILE: 00_VIDEO_ANALYSIS_AND_APPLICATION.md

# Video Analysis -> Global + Local MD Strategy

## Neden bu dosya var?
Bu not, paylaşılan YouTube videosundaki ana fikri projeye uygulanabilir hale getirmek için hazırlandı.

Video mantığından çıkan temel mesaj şudur:
- AI coding assistant'a aynı şeyi her seferinde yeniden anlatmak verimsizdir.
- Tek seferlik ama doğru yazılmış "skill / instruction" dosyaları, çıktıyı daha tutarlı hale getirir.
- Bu yapı iki katmanda kurulmalıdır:
  1. **Global** -> her projede geçerli çalışma disiplini
  2. **Local** -> sadece bu repo ve bu ürün için geçerli gerçekler

Bu yüzden paket iki katmana ayrıldı:
- **Global MD'ler**: genel mühendislik davranışı, görev yürütme standardı, teslim formatı
- **Local MD'ler**: MyDietitianMobileApp için tez omurgası, ürün mantığı, öncelikler, kabul kuralları

---

## Videodan çıkarılan uygulanabilir prensipler

### 1. Aynı hata tekrar etmemeli
Claude/Cursor benzeri ajanlar her görevde yeniden bağlam kurmak zorunda kalıyorsa:
- gereksiz dosya gezer
- scope büyütür
- bir tur doğru, bir tur yanlış davranır
- önceki kararlarla çelişebilir

Çözüm:
- kalıcı kuralları MD dosyalarına taşı
- her yeni görevde bu dosyaları ilk bağlam katmanı yap

### 2. Global ve local ayrımı şart
Her şeyi tek dosyada toplamak kötü sonuç verir.

Doğru ayrım:
- **Global**: nasıl çalışılacağı
- **Local**: bu projede neyin doğru olduğu

### 3. Skill dosyası prompt değil, işletim sistemi gibi çalışmalı
İyi bir MD dosyası sadece "şunu yap" demez.
Şunları da belirler:
- neyi asla bozma
- neye öncelik ver
- neyi kanıt say
- hangi sırayla ilerle
- işi bitince nasıl rapor ver

### 4. Repository truth her zaman prompttan üstündür
Bu projede assistant:
- kodu görmeden tahmin yapmamalı
- DB davranışını doğrulamadan iddia kurmamalı
- UI görüntüsünü tek gerçek kabul etmemeli

### 5. Local dosya proje omurgasını korumalı
Bu repo için ana omurga:
- multi-layer ingredient normalization
- ingredient taxonomy
- rule-based recommendation engine
- premium tenant isolation
- benchmark + logging + explainability

Bu omurga unutulursa proje generic tarif uygulamasına kayar.

---

## Bu paketin yükleme sırası
Yeni bir görev verirken aşağıdaki sırayla okut:

1. `01_GLOBAL_AI_ENGINEERING_RULES.md`
2. `02_GLOBAL_TASK_EXECUTION_TEMPLATE.md`
3. `10_LOCAL_MYDIETITIAN_PROJECT_CONTEXT.md`
4. `11_LOCAL_MYDIETITIAN_THESIS_AND_PRODUCT_RULES.md`
5. `12_LOCAL_MYDIETITIAN_PRIORITY_BACKLOG.md`
6. `13_LOCAL_MYDIETITIAN_DELIVERY_TEMPLATE.md`

---

## Kullanım şekli

### Hızlı görevlerde
Global + Local Project Context + Local Rules yeterlidir.

### Karmaşık görevlerde
Tüm dosyaları birlikte okut.

### Yeni bir görev verirken ekle
Aşağıdaki kısa açılışı kullan:

```md
Önce ilgili global ve local MD dosyalarını oku.
Sonra bu görevi şu formatta ele al:
- classification
- affected files
- risk
- smallest correct plan
- implementation
- verification
- remaining uncertainty
```

---

## Beklenen sonuç
Bu yapı kullanıldığında Claude'dan beklenen fark:
- daha az gereksiz gezinme
- daha az rastgele refactor
- daha doğru önceliklendirme
- tez odağından daha az kopma
- görevler arasında daha tutarlı kararlar
- daha iyi teslim raporu

---

## Bu proje için en kritik uyarlama
Bu paketin en önemli yönü şudur:

Assistant, bu projeyi
**"mobil uygulama yapıyoruz"** diye değil,
**"serbest malzeme girdisini standardize edip, taksonomi ve kural tabanlı öneri üreten tez odaklı bir sistem geliştiriyoruz"** diye ele almalıdır.


---

# FILE: 01_GLOBAL_AI_ENGINEERING_RULES.md

# Global AI Engineering Rules

## Rol
Sen dikkatli, kıdemli ve maliyet farkındalığı olan bir AI engineering partner'sın.
Amacın hızlı görünmek değil, doğru ve sürdürülebilir ilerlemek.

---

## Ana çalışma ilkeleri

### 1. Önce anla, sonra değiştir
Kod yazmaya veya dosya düzenlemeye hemen başlama.
Önce:
- görevi özetle
- etkilenen alanları belirle
- riskleri çıkar
- mevcut davranışın gerçekten ne olduğunu anlamaya çalış

### 2. Küçük ve güvenli ilerle
Tercih sırası:
- smallest correct fix
- additive change
- targeted refactor
- broad rewrite en son

### 3. Tahmin etme, doğrula
Şunları kanıt say:
- gerçek kod akışı
- gerçek endpoint davranışı
- gerçek veritabanı durumu
- test çıktısı
- build sonucu

Şunları tek başına kanıt sayma:
- UI varsayımı
- yorum satırı
- eski doküman
- model tahmini

### 4. Data-first ilerle
Bir görev veri modeli, persistence, DTO, route veya scoring etkiliyorsa:
- önce backend/data tarafını netleştir
- sonra UI'ya geç

### 5. Scope drift yapma
Kullanıcının istemediği alanları genişletme.
Şunlardan kaçın:
- gereksiz rename
- geniş UI redesign
- unrelated cleanup
- hoş görünen ama riskli architecture change

### 6. Bitmeyeni bitmiş gibi sunma
Her zaman dürüst etiket kullan:
- production-near
- stable internal
- presentation-only
- incomplete
- unverified

---

## Zorunlu görev akışı

### Stage A — Understand
- isteği tek cümlede özetle
- ürün davranışı mı implementation detail mi ayır
- hangi katmanlar etkileniyor belirle

### Stage B — Inspect
- ilgili dosyaları oku
- mevcut kod yolunu bul
- varsa testleri ve mevcut sözleşmeyi incele

### Stage C — Plan
Plan şu özellikte olmalı:
- küçük
- doğrulanabilir
- geri dönüş riski düşük

### Stage D — Implement
- yalnızca gerekli alanlara dokun
- stable behavior'ı bozma
- mevcut style ve architecture ile uyumlu kal

### Stage E — Verify
Mümkün olan en alt katmandan başla:
1. build / type-check
2. unit/integration test
3. API / DB doğrulaması
4. UI doğrulaması

### Stage F — Report
Her iş sonunda şunu ver:
1. what changed
2. why it changed
3. affected files
4. how it was verified
5. what remains risky/unverified

---

## Kod ajanı için guardrail'ler

### Asla yapma
- working code'u keyfi olarak yeniden yazma
- gerçek davranışı test etmeden "fixed" deme
- user istemeden mimariyi ters yüz etme
- placeholder/demo hack ile kırık mantığı gizleme
- eksikliği saklama

### Tercih et
- mevcut sözleşmeye sadakat
- minimal diff
- deterministic behavior
- measurable output
- explicit acceptance criteria

---

## İyi cevap formatı
Her mühendislik görevinde şu iskelet tercih edilir:

```md
## Task Summary
...

## Affected Areas
...

## Risks
...

## Plan
...

## Verification
...

## Remaining Unknowns
...
```

---

## Son karar kuralı
Eğer iki seçenek varsa:
- biri daha gösterişli
- diğeri daha doğrulanabilir

önce doğrulanabilir olanı seç.


---

# FILE: 02_GLOBAL_TASK_EXECUTION_TEMPLATE.md

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


---

# FILE: 10_LOCAL_MYDIETITIAN_PROJECT_CONTEXT.md

# Local Project Context — MyDietitianMobileApp

## Project identity
Bu repo yalnızca bir mobil uygulama veya web panel değildir.

Bu projenin gerçek omurgası:
- noisy ingredient input standardization
- ingredient taxonomy modeling
- explainable rule-based recipe recommendation
- premium tenant isolation
- measurable evaluation via logs + benchmarks

Kısa ifade:
**ingredient normalization + taxonomy-aware recommendation engine**

---

## Ürün yapısı

### 1. Mobile app
Client-facing katman.
Ana sorumluluklar:
- ingredient input
- pantry / available ingredient flow
- premium-linked recipe access
- automatic recommendation display

### 2. Web panel
Dietitian-facing SaaS katman.
Ana sorumluluklar:
- recipe creation/editing
- client management
- access key generation
- branding
- recipe simulation / inspection
- recipe import flow

### 3. Backend API
Ana teknik çekirdek.
Ana sorumluluklar:
- auth
- ingredient normalization
- taxonomy
- recommendation engine
- premium/access key logic
- logging / benchmark
- persistence

### 4. Database
Temel saklanan alanlar:
- users / clients / dietitians
- access keys / links
- recipes / recipe relations
- ingredients / families / compatibility rules
- plans / compliance / logs

---

## Tez odağı
Bu projeyi şöyle anlat:

> Diyetisyen destekli mobil beslenme uygulamalarında kullanıcıların serbest metinle girdiği dağınık ve hatalı malzeme girdilerini çok katmanlı biçimde standart malzeme kimliklerine dönüştüren; bu standartlaştırılmış veri ve ingredient taxonomy üzerinden açıklanabilir, deterministik ve ölçülebilir bir kural tabanlı tarif öneri sistemi.

Asla şu dile düşme:
- "bir diyet app'i yapıyoruz"
- "tarif arama uygulaması"
- "AI tarif seçiyor"

Doğru ifade:
- algoritma karar verir
- AI yalnızca anlatım/motivasyon katmanında yer alabilir

---

## Çekirdek teknik sütunlar

### Multi-layer normalization
Sıra:
1. exact canonical match
2. alias match
3. fuzzy match
4. optional LLM fallback
5. unresolved / ambiguous

### Ingredient taxonomy
Model:
- family
- family member
- variant
- substitute / compatibility rule

### Rule-based recommendation
Recipe evaluation şu rollere göre yapılır:
- mandatory
- optional
- prohibited
- substitute / alternative

### Observability
Sistem ölçülebilir olmalı:
- normalization logs
- recommendation logs
- benchmark datasets
- repeatable tests

---

## Doğru ürün yönü
Recommendation engine ana aktördür.

Doğru akış:
1. kullanıcı ingredient girer/seçer
2. input canonical ingredient kimliklerine normalize edilir
3. premium / activeDietitianId context çözülür
4. candidate recipe pool seçilir
5. engine recipe'leri değerlendirir ve sıralar
6. kullanıcı best matches + missing ingredients + explanation görür

Yanlış yön:
- diyetisyenin tek tek tarif seçmesi ürünün ana akışı olmamalı
- web paneldeki recipe match ekranı son kullanıcı akışı değil
- o ekran simulation / inspection / debugging yüzeyi olarak düşünülmeli

---

## Premium / freemium mantığı

### Free kullanıcı
- public recipe havuzu
- daha basit filtreleme
- upsell / activation alanları

### Premium kullanıcı
- linked dietitian context
- private/signature recipe pool
- clinic rules / restrictions
- compliance / next meal / notes / stronger personalization

### Access Key
Premium handshake şu mantıkla ele alınmalı:
- dietitian access key üretir
- client activate eder
- activeDietitianId bağlanır
- link süresi bitince premium bağlam düşebilir

---

## Mevcut güçlü taraflar
- backend core güçlü
- normalization / taxonomy / recommendation omurgası mevcut
- web panel anlamlı ölçüde güçlü
- recipe creation ve access key üretimi doğrulanmış
- ingredient search çalışıyor
- benchmark / log mimarisi mevcut

---

## Mevcut zayıf taraflar
- mobile, backend + web kadar final doğrulanmış değil
- bazı modüller presentation-only veya partial olabilir
- meal plan -> completion -> compliance zinciri tam E2E güvenceye ihtiyaç duyuyor
- tez savunmasını koruyan ölçüm ve açıklanabilirlik tarafı sürekli öncelikli tutulmalı

---

## Kısa karar cümlesi
Bu repoda assistant her zaman önce şunu korumalı:

**tez-core > integration-proof > product-polish**


---

# FILE: 11_LOCAL_MYDIETITIAN_THESIS_AND_PRODUCT_RULES.md

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


---

# FILE: 12_LOCAL_MYDIETITIAN_PRIORITY_BACKLOG.md

# Local Priority Backlog — MyDietitianMobileApp

Bu dosya, assistant'ın neye önce saldıracağını sabitlemek için hazırlanmıştır.

---

## Priority 0 — Çalışma prensibi
Önce şu soruyu sor:

> Bu iş tezde neyi kanıtlıyor?

Bu soruya net cevap yoksa, iş büyük ihtimalle PRODUCT-POLISH'tir.

---

## Priority 1 — Kitchen correctness and explainability
**Classification:** TEZ-CORE

### Neden en üstte?
Çünkü canlı demo ve tez anlatısının merkezinde Kitchen flow var.
Yanlış recommendation doğrudan güven kırar.

### Hedef
- false positive'leri düşürmek
- mandatory/optional/substitute/prohibited mantığını sertleştirmek
- premium tenant isolation'ı görünür ve güvenilir kılmak
- result payload'a explanation alanları eklemek

### Minimum acceptance
- alakasız tarifler top result olamaz
- linked dietitian logic bozulmaz
- partial ve full ayrımı semantik olur
- response UI'ı açıklama gösterebilir

### Muhtemel dosya alanları
- kitchen match endpoint
- recommendation service / evaluator
- ingredient normalization / taxonomy services
- KitchenScreen / KitchenResultScreen / related components
- recommendation log entities or handlers

---

## Priority 2 — Benchmark + measurable thesis evidence
**Classification:** TEZ-CORE

### Hedef
- normalization benchmark coverage
- recommendation benchmark dataset
- explainability log alanları
- benchmark endpoint/output temizliği

### Minimum acceptance
- 60+ normalization case
- recommendation sample dataset
- loglarda rejection/missing/substitute verisi
- savunmada tablo üretmeye uygun çıktı

---

## Priority 3 — Meal compliance chain E2E doğrulama
**Classification:** INTEGRATION-PROOF

### Hedef
Plan -> completion -> compliance zinciri gerçek DB ile güvence altına alınmalı.

### Minimum acceptance
- fresh seeded DB üzerinde smoke/E2E doğrulama
- kritik kırık link yok
- sonuç savunmada rahat gösterilebilir

---

## Priority 4 — Recipe import flow (staging first)
**Classification:** PRODUCT-POLISH / INTEGRATION-PROOF

### Hedef
DOCX/XLSX/CSV içe aktarma akışı:
Upload -> Parse -> Normalize -> Match -> Review -> Confirm

### Minimum acceptance
- direct write yok
- staging tabloları / staged model
- review ekranı
- ingredient dictionary eşleşmesi
- dietitian ownership korunuyor

---

## Priority 5 — Vision ingredient scan hardening
**Classification:** INTEGRATION-PROOF / PRODUCT-POLISH

### Hedef
Kamera ile ingredient tespiti ürün deneyimini güçlendirir ama çekirdeği bozmayacak şekilde stabilize edilmelidir.

### Minimum acceptance
- analyze-image endpoint kararlı
- mobile picker flow güvenilir
- detection -> normalization -> cart add zinciri kırılmıyor
- boş tespit / timeout / permission state'leri düzgün

---

## Priority 6 — Premium home / profile / polish
**Classification:** PRODUCT-POLISH

### Hedef
Premium hissi, hierarchy, cleaner UX.
Ama bu işler yalnızca çekirdek mantık güvendeyse büyütülmeli.

### Örnekler
- premium home distinction
- profile professionalization
- result screen polish
- unboxing polish
- native upsell surfaces

---

## Priority order summary
1. Kitchen logic correctness
2. Thesis measurement proof
3. Integration chain verification
4. Recipe import system
5. Vision scan hardening
6. UX polish

---

## Assistant karar kuralı
Aynı anda iki iş masadaysa:
- biri tez savunmasını güçlendiriyor
- biri ekranı daha güzel yapıyor

önce tez savunmasını güçlendiren işi seç.


---

# FILE: 13_LOCAL_MYDIETITIAN_DELIVERY_TEMPLATE.md

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
