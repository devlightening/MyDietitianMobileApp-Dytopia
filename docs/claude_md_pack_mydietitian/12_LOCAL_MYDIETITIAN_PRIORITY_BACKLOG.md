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
