# MyDietitian — Tez Konumunu Güçlendirme Rehberi

## Amaç
Bu belge, projenin mevcut durumunu **tez odağıyla yeniden çerçevelemek**, ürün geliştirme ile akademik katkıyı ayırmak ve bundan sonraki çalışmaları **ölçülebilir, savunulabilir, tutarlı** hale getirmek için hazırlanmıştır.

Bu belge Claude'un şu şekilde düşünmesini ister:
- Projeyi sadece bir mobil uygulama veya SaaS paneli olarak ele alma.
- Tezin merkezini her zaman **çok katmanlı malzeme standardizasyonu + ingredient taxonomy + kural tabanlı tarif öneri motoru + benchmark/log değerlendirmesi** olarak koru.
- Mobil uygulama ve web paneli, bu teknik çözümün **kanıt ve sistem entegrasyonu katmanları** olarak konumlandır.
- Her yeni işi önce şu üç sınıftan birine yerleştir:
  1. **Tez-Core**
  2. **Sistem Entegrasyonu / Kanıt Katmanı**
  3. **Ürün Polishi / UX**

---

## 1) Tezin gerçek konusu nedir?

Bu projenin tez konusu **"diyet uygulaması geliştirmek"** değildir.

Asıl tez konusu:

> **Diyetisyen destekli mobil beslenme uygulamaları için, kullanıcıların serbest metinle girdiği dağınık ve hatalı malzeme girdilerini çok katmanlı biçimde standart malzeme kimliklerine dönüştüren; bu standartlaştırılmış veri ve malzeme taksonomisi üzerinden açıklanabilir, deterministik ve ölçülebilir bir kural tabanlı tarif öneri sistemi geliştirmek.**

Bu tezde ana teknik sütunlar şunlardır:
- **Çok katmanlı normalizasyon**
  - Exact canonical match
  - Alias match
  - Fuzzy match
  - LLM fallback
- **Ingredient taxonomy**
  - aile
  - üye
  - varyant
  - substitute / compatibility kuralları
- **Kural tabanlı öneri motoru**
  - mandatory
  - optional
  - forbidden
  - alternative
- **Ölçüm ve benchmark**
  - log bazlı analiz
  - benchmark veri kümeleri
  - başarı oranları
- **Sistem entegrasyonu**
  - mobil uygulama
  - web panel
  - premium/free ve diyetisyen–danışan akışı

---

## 2) Şu an proje hangi konumda?

## 2.1 Güçlü taraflar
Proje artık sadece fikir aşamasında değil. Elimizde:
- çalışan backend
- çalışan mobil uygulama
- çalışan web panel
- premium/free ayrımı
- access key aktivasyonu
- dietitian/client bağ modeli
- recipe / ingredient / plan / compliance domain yapıları
- smoke test ve unit test temeli
- geliştirme ortamı için stabilize edilmiş çalışma akışı

Bu çok önemli çünkü tezde yalnızca yöntem değil, yöntemin **ürün içinde çalışan hali** de bekleniyor.

## 2.2 Mevcut durumun doğru etiketi
Bu proje şu anda:
- **ürün açısından:** güçlü MVP / vertical slice
- **mimari açıdan:** iyi ilerlemiş
- **tez metodolojisi açısından:** doğru yönde
- **tez savunma güvenliği açısından:** henüz tamamlanmamış

Yani ürün tarafı fena değil; ama akademik olarak seni asıl koruyacak bölüm olan **ölçümleme, benchmark, log analizi ve açıklanabilirlik** tarafı daha sertleştirilmeli.

## 2.3 En büyük risk
Şu anki en büyük risk şu:

> Ürün geliştirme hızı, tez metodolojisi kanıt paketinin önüne geçmiş durumda.

Bu, savunmada şu soruya karşı kırılganlık oluşturur:

> "Bilgisayar mühendisliği katkınız tam olarak nerede, bunu nasıl ölçtünüz, nasıl doğruladınız?"

Bu sorunun cevabı UI, premium ekran, plan ekranı veya notlar ekranı değildir.
Bu sorunun cevabı:
- normalization pipeline
- taxonomy modeli
- rule engine
- benchmark datası
- log tabanlı ölçüm
- sistemsel doğrulama testleri
olmalıdır.

---

## 3) Core vs Secondary ayrımı

## 3.1 Tez-Core (birinci öncelik)
Bunlar tez savunmasının omurgasıdır:

### A. Çok katmanlı malzeme standardizasyonu
Sistemin şu zinciri açık ve ölçülebilir olmalı:
1. Exact canonical match
2. Alias match
3. Fuzzy match
4. LLM fallback
5. unresolved / ambiguous

Her çağrıda şu loglanmalı:
- raw input
- normalized output
- chosen layer
- confidence / similarity
- candidate list
- elapsed time
- ambiguous mı değil mi

### B. Ingredient taxonomy
Taxonomy düz liste olmamalı. Şu yapılar açık olmalı:
- IngredientFamily
- IngredientFamilyMember
- Variant ilişkisi
- CompatibilityRule
- Substitute ilişkisi
- Uygun / uygunsuz varyant örnekleri

Örnekler net hazırlanmalı:
- yoğurt / süzme yoğurt / meyveli yoğurt
- ton balığı / light ton
- domates / çeri domates / salça
- kefir / yoğurt substitute

### C. Rule-based recommendation engine
Tarif motoru sadece metin araması olmamalı.
Her tarif için şu yapı görünür ve savunulabilir olmalı:
- mandatory ingredients
- optional ingredients
- prohibited ingredients
- substitutes
- score / ranking logic
- why accepted / why rejected açıklaması

### D. Benchmark ve değerlendirme
Tez-core için olmazsa olmaz:
- benchmark veri kümesi
- normalization başarı metrikleri
- recommendation doğruluk metrikleri
- sistemsel güvenlik ve izolasyon metrikleri

## 3.2 Sistem Entegrasyonu / Kanıt Katmanı (ikinci öncelik)
Bunlar ürünün teknik çözümü gerçek dünyada nasıl taşıdığını kanıtlar:
- mobile app
- web panel
- premium activation
- access key
- dietitian → client veri akışı
- client → dietitian telemetri akışı
- next meal / plan / compliance zinciri

## 3.3 Ürün Polishi / UX (üçüncü öncelik)
Bunlar önemlidir ama tez-core'un önüne geçmemelidir:
- premium his
- dark mode polish
- result card tasarımı
- profile profesyonelleştirme
- animasyonlar
- onboarding polish

---

## 4) Şu an gerçekten neler tamam görünüyor?

Aşağıdaki alanlar projede belirli bir olgunluğa ulaşmış kabul edilebilir:
- backend controller seti geniş ve büyük ölçüde implement edilmiş
- meal plan / compliance / client activity / branding / notes gibi domainler tanımlı
- ingredient normalization service ve recommendation engine temeli mevcut
- tests klasöründe smoke + unit test omurgası mevcut
- premium gating ve access control akışı düşünülmüş
- mobile + web + backend üçlüsü aynı ürün içinde birleşmiş durumda

Bu iyi bir nokta. Sıfırda değiliz.
Ancak tez açısından "bir şeyler var" yetmez; bunların **ölçülmüş, raporlanmış ve açıklanmış** olması gerekir.

---

## 5) En kritik eksikler

## 5.1 Tez açısından kritik eksikler

### 1. Benchmark veri kümesi eksik / zayıf olabilir
Aşağıdaki veri setleri somut olarak hazırlanmalı:
- typo inputs
- alias inputs
- Turkish character variation inputs
- ambiguous inputs
- noisy inputs
- family/variant confusion inputs
- substitute senaryoları
- forbidden ingredient senaryoları

### 2. Katman bazlı başarı raporu eksik
Her katman için ölçüm tablosu çıkmalı:
- exact match oranı
- alias match oranı
- fuzzy başarı oranı
- LLM fallback kullanım oranı
- unmatched oranı
- ambiguous oranı

### 3. Recommendation evaluation eksik
Şunlar ayrı ayrı ölçülmeli:
- tam uyumla eşleşen tarif oranı
- substitute ile kabul edilen tarif oranı
- yanlış öneri oranı
- yasaklı malzeme tespiti başarısı
- tarif sıralama doğruluğu

### 4. Açıklanabilirlik eksik olabilir
Her öneri için sistem şunu diyebilmeli:
- neden kabul edildi
- hangi mandatory ingredient sağlandı
- hangi ingredient substitute ile çözüldü
- neden bazı tarifler elendi

### 5. Tez için net evidence pack eksik
Savunmada doğrudan kullanılacak materyaller hazırlanmalı:
- benchmark tabloları
- örnek input/output akışları
- sistem mimarisi şeması
- database taxonomy diagram
- log ekran görüntüleri
- test raporları

## 5.2 Ürün / entegrasyon açısından kritik eksikler

### 1. Meal-plan zinciri tam oturmamış olabilir
İstenen hedef:
- diyetisyen panelde öğün bazlı plan oluşturur
- mobilde next meal görünür
- bildirim gider
- kullanıcı done / skipped / alternative işaretler
- veri panele compliance olarak döner

Bu zincir kapanmadan premium değeri tam oluşmaz.

### 2. Mobile premium stack vizyonu tam oturmamış olabilir
İstenen hedef:
- branded premium home
- next meal hero
- compliance card
- dietitian notes / badges
- kitchen merkezde

### 3. Web panelin digital cockpit hissi artırılmalı
İstenen hedef:
- KPI cards
- client analytics
- access key yönetimi
- structured recipe editor
- meal planner
- branding preview

### 4. Placeholder ve unfinished noktalar temizlenmeli
Tez için kritik değil ama güven algısını düşürür:
- yakında / coming soon aksiyonlar
- dummy data başlıkları
- geçici metinler
- zayıf empty states

---

## 6) Bundan sonra nasıl ilerlemeliyiz?

## 6.1 İlk ilke
Her yeni işi önce şu formatta sınıflandır:

- **[TEZ-CORE]**
- **[INTEGRATION-PROOF]**
- **[PRODUCT-POLISH]**

Claude hiçbir işi bu sınıflama olmadan ele almasın.

## 6.2 Öncelik sırası

### Faz 1 — Tez-Core'u kilitle
Önce şu alanlar tamamlanmalı:
- normalization logs
- benchmark dataset
- taxonomy completeness
- rule engine evaluation
- recommendation logs
- sistemsel başarı testleri

### Faz 2 — Meal-plan ve compliance zinciri
Sonra şu uçtan uca akış tamamlanmalı:
- dietitian meal planner
- mobile next meal
- completion actions
- compliance aggregation
- reporting
- push notification altyapısı (en azından taslak veya prototip seviyesi)

### Faz 3 — UX polish ve savunma materyalleri
En son:
- premium polish
- sonuç ekranı kalite artışı
- dashboard görsel hiyerarşi
- demo/sunum senaryoları
- savunma ekran görüntüleri

---

## 7) Tez-Core için zorunlu backlog

## 7.1 Backend
Claude önce backend tarafında bunları doğrulasın veya tamamlasın:
- IngredientNormalizationLog yapısı yeterli mi?
- Recommendation log tablosu yeterli mi?
- ambiguous / unmatched durumları ayrı loglanıyor mu?
- normalization katman seçimi saklanıyor mu?
- candidate list ve chosen candidate tutuluyor mu?
- benchmark runner gerçekten rapor üretiyor mu?
- forbidden ingredient tespiti test ediliyor mu?
- private/public recipe isolation testleri çalışıyor mu?

## 7.2 Web panel
Claude web paneli şu gözle ele alsın:
- sadece CRUD ekranı değil, ölçüm paneli var mı?
- dietitian gerçekten veriyi yönetiyor mu?
- plan ekranı meal-level mi?
- recipe editor structured mı?
- branding ayarları premium deneyime yansıyor mu?
- analytics ekranları tezde kullanılabilecek kadar anlamlı mı?

## 7.3 Mobile
Claude mobili şu hedeflerle değerlendirsin:
- kitchen gerçekten merkez mi?
- premium kullanıcı dietitian bağlantısını hissediyor mu?
- next meal / compliance net mi?
- plan aksiyonları veri geri topluyor mu?
- quick add + ingredient dictionary tez çözümünü görünür kılıyor mu?

---

## 8) Analiz ve test planı

## 8.1 Benchmark veri setleri
En az şu veri kümeleri hazırlanmalı:

### A. Normalizasyon veri seti
Örnek kolonlar:
- raw_input
- expected_ingredient_id
- category
- expected_layer
- notes

Kategori örnekleri:
- exact
- alias
- typo
- Turkish-char
- family-member confusion
- variant ambiguity
- impossible input

### B. Recommendation veri seti
Örnek kolonlar:
- pantry_items
- recipe_id
- expected_result
- expected_reason
- expected_missing_items
- expected_substitute_usage

Kategori örnekleri:
- full match
- one-missing
- forbidden-block
- substitute-accepted
- reject

### C. Sistemsel başarı veri seti
Örnek kolonlar:
- scenario_name
- actor
- expected_policy
- expected_visibility
- expected_result

Kategori örnekleri:
- wrong dietitian access
- premium expired access
- private recipe isolation
- activate premium success
- client-dietitian binding integrity

## 8.2 Raporlanacak metrikler

### Normalizasyon metrikleri
- exact canonical match rate
- alias match rate
- fuzzy match success rate
- LLM fallback usage rate
- unmatched rate
- ambiguous rate
- ortalama işlem süresi

### Recommendation metrikleri
- full match rate
- substitute acceptance rate
- false positive rate
- forbidden ingredient detection rate
- ranking accuracy

### Sistemsel metrikler
- premium isolation accuracy
- access control correctness
- activation workflow success rate
- meal completion logging correctness
- workflow integrity

---

## 9) Savunma için hazırlanacak kanıt paketi

Claude bundan sonra savunma odaklı da düşünsün.
Hazırlanması gerekenler:

### 1. Mimari görseller
- sistem mimarisi
- veri akışı diyagramı
- taxonomy ilişkisi diyagramı
- recommendation pipeline diyagramı

### 2. Ölçüm tabloları
- normalizasyon başarı tablosu
- öneri motoru başarı tablosu
- sistemsel başarı tablosu

### 3. Kanıt ekran görüntüleri
- ingredient search + normalization örneği
- tam uyum / alternatif / red örnekleri
- premium activation akışı
- web panel plan ekranı
- next meal / compliance ekranı
- test / benchmark çıktıları

### 4. Açıklanabilir örnek akışlar
En az 3 tam örnek senaryo hazırlanmalı:
- senaryo 1: typo input → fuzzy → full match
- senaryo 2: family/substitute → applicable result
- senaryo 3: forbidden ingredient → reject / alternative

---

## 10) Claude için çalışma kuralları

Claude bundan sonra şu kurallarla çalışmalı:

1. Önce tez-core kontrolü yap.
2. Her öneriyi bu üç eksende değerlendir:
   - akademik katkı
   - sistem entegrasyonu
   - ürün kalitesi
3. UI değişiklikleri yaparken tez-core'dan kopma.
4. Her feature için şu soruyu sor:
   - bu tezde neyi kanıtlıyor?
5. Sadece ekran eklemekle yetinme; log, metric, test ve evaluation karşılığını da düşün.
6. "çalışıyor" seviyesini yeterli kabul etme; "ölçülebilir" ve "savunulabilir" seviyeye taşı.
7. Tezde merkez her zaman şu kalsın:
   - multi-layer normalization
   - taxonomy
   - rule-based recommendation
   - benchmark/log evaluation

---

## 11) Son karar: proje şu an nasıl konumlandırılmalı?

En doğru ifade şu:

> Proje artık basit bir fikir veya sadece arayüz prototipi değil. Backend, mobil ve web katmanlarında çalışan bir sistem iskeleti oluşmuş durumda. Ancak tez açısından en kritik eksik, yöntemin akademik olarak ölçülebilir ve savunulabilir kanıt paketinin henüz yeterince sertleşmemiş olmasıdır. Bu yüzden bundan sonraki geliştirme odağı, ürün özelliklerini rastgele büyütmek değil; tez-core'u benchmark, log, test ve açıklanabilirlik ile güçlendirmek olmalıdır.

Kısaca:
- ürün var
- mimari var
- entegrasyon var
- ama tez güvenliği için **ölçüm, benchmark, evaluation ve evidence pack** öncelik olmalı

---

## 12) Claude'dan bundan sonra beklenen çıktı formatı

Claude her büyük cevapta şu başlıkları kullansın:

1. **Tez-Core Etkisi**
2. **Sistem Entegrasyonu Etkisi**
3. **Ürün / UX Etkisi**
4. **Riskler**
5. **Önerilen Sonraki Adım**

Ve her feature/görev için şunu net söylesin:
- Bu iş tez için neden önemli?
- Bu iş ürün için neden önemli?
- Bu iş şimdi mi yapılmalı, sonra mı?

---

## 13) Hemen uygulanacak ilk görev listesi

### Sprint A — Tez güvenliğini artır
- normalization benchmark dataset oluştur
- recommendation benchmark dataset oluştur
- sistemsel başarı checklist ve test matrisini çıkar
- log tablolarını doğrula / genişlet
- benchmark rapor çıktısını standartlaştır

### Sprint B — Entegrasyon kanıtını güçlendir
- meal planner akışını netleştir
- next meal + compliance döngüsünü bağla
- dietitian → client → dietitian veri zincirini tam göster
- premium/private isolation testlerini raporla

### Sprint C — Savunma ve demo hazırlığı
- 3-5 güçlü demo senaryosu oluştur
- ekran görüntülerini standardize et
- metrik tablolarını sunuma hazır hale getir
- tez metninde kullanılacak şekil ve grafik listesini çıkar

---

## Son not
Bu belgedeki temel strateji şudur:

> Projeyi daha "güzel" hale getirmekten önce, daha "kanıtlanabilir" hale getir.

Güçlü tez; yalnız çalışan ürün değil, **neden çalıştığını, nasıl karar verdiğini ve ne kadar doğru çalıştığını gösterebilen ürün** demektir.
