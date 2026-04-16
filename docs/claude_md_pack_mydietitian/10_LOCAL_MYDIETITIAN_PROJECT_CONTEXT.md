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
