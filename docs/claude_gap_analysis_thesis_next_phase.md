# Diyet Uyum Asistanı — Tez Odaklı Gap Analysis ve Sonraki Uygulama Brifi

Bu doküman, mevcut proje durumunun; 
- tez görsel/PDF anlatısı,
- yüklenen kapsamlı ürün/dokümantasyon metni,
- mevcut mobil ekranlar ve kod parçaları,
- son Claude tesliminin ekran görüntüsü
üzerinden yeniden analiz edilmesiyle hazırlanmıştır.

Amaç: Claude'un bir sonraki turda **tez omurgasına en yakın, çalışan, tutarlı ve demo/sunum için güçlü** sürümü üretmesini sağlamak.

---

## 1) Referansların anlattığı çekirdek ürün gerçeği

Tez PDF'i ürünün merkezine şu fikri koyuyor: danışanın evindeki malzemeler, diyetisyenin kural seti ve özel tarif havuzu ile **tek tuşta** eşleştirilmeli; Free mod keşif, Premium mod ise klinik bağlılık ve uyum üretmeli. Özellikle Premium tarafta diyetisyenin imzalı tarifleri, klinik kuralları, access key ile bağlılık, karşılaştırma motoru, ingredient dictionary ve oyunlaştırılmış “kutu açılışı” deneyimi ana omurga olarak sunuluyor. PDF'in akışı özellikle Free/Premium ayrımı, mutfak merkezli navigasyon, çok katmanlı karşılaştırma motoru, akıllı malzeme sözlüğü, AI'nın karar vermeyen ama hikâye anlatan rolü ve access key ile iki yönlü veri akışını vurguluyor. fileciteturn13file0

Yüklenen kapsamlı doküman da aynı omurgayı yazılı hale getiriyor: 
- Mutfak alt menünün merkezi ve en büyük aksiyon alanı olmalı.
- Birleştir butonu altta sabit olmalı.
- Premium kullanıcıda tarif kaynağı diyetisyenin özel havuzu olmalı.
- Ingredient dictionary; alias, parent-child ve substitute mantığıyla çalışmalı.
- Sonuçlar `Tam Uyum / 1 Eksikle Olur / Uygun Değil` mantığıyla sınıflandırılmalı.
- Danışanın yaptığı aksiyonlar panel tarafına uyum verisi olarak dönmeli.
- Free ve Premium arayüzler hem içerik hem his olarak belirgin biçimde ayrışmalı. fileciteturn15file0 fileciteturn15file1

---

## 2) Son Claude turunda zaten tamamlanmış görünen işler

Ekran görüntüsündeki özetten anlaşıldığı kadarıyla son turda önemli mantık düzeltmeleri yapılmış:
- `matchCategory` ayrımı eklenmiş.
- `FULL_MATCH / SUBSTITUTE_MATCH / PARTIAL_MISSING` mantığı netleştirilmiş.
- Skor yüzdesi normalize edilmiş.
- Sıralama; geçerli clinic tarifleri > geçerli public tarifler > partial şeklinde düzeltilmiş.
- Kitchen result featured seçimi, artık geçersiz clinic partial önerileri yanlış şekilde öne çekmeyecek biçimde düzenlenmiş.
- Meta alanları genişletilmiş.

Bunlar doğru yönde ve tez mantığıyla uyumlu ilerlemeler.

Ama bu teslim, **çekirdek ranking bug'ını azaltmış olsa da tezde tarif edilen tam ürün davranışını ve premium klinik deneyimini henüz tamamlamıyor.**

---

## 3) Şu anda eksik kalan ana boşluklar

Aşağıdaki eksikler, artık “nice to have” değil; tez sunumu ve ürün tutarlılığı için zorunlu boşluklardır.

### A. Karşılaştırma motoru hâlâ tez seviyesinde açıklanabilir ve deterministik değil

Tez ve doküman, kararın algoritma tarafından verilmesini; AI'nın ise sadece anlatıcı olmasını istiyor. Ayrıca motorun şu sırayla çalışması bekleniyor:
1. tenant/public havuz seçimi,
2. yasaklar filtresi,
3. mandatory kontrol,
4. substitute kontrol,
5. optional skor,
6. sonuç sınıflandırma,
7. açıklanabilir neden üretimi. fileciteturn15file0

**Eksik görünenler:**
- Her tarif için kullanıcıya ve log'a dönen **explainability object** yok veya yeterince detaylı değil.
- `why this recipe ranked here` açıklaması UI'da görünür değil.
- `forbidden hit`, `missing mandatory`, `matched optional`, `used substitute`, `tenant scoped` gibi alanlar muhtemelen tam olarak UI'ya ve log'a taşınmıyor.
- Aynı sepet için tekrar çalıştırıldığında sonuç sırası tamamen deterministik olmalı; rastgele veya veri sırasına bağlı davranış bırakılmamalı.

**Zorunlu çıktı alanları:**
- `matchCategory`
- `isTenantRecipe`
- `isPublicRecipe`
- `mandatoryCount`
- `matchedMandatoryCount`
- `optionalCount`
- `matchedOptionalCount`
- `usedSubstitutes[]`
- `missingMandatory[]`
- `matchedIngredientIds[]`
- `blockedByRules[]`
- `rankingReason`
- `narrationInput`

---

### B. Premium kullanıcı için “yalnızca bağlı diyetisyenin aklı” tam korunmuyor olabilir

Doküman ve PDF Premium tarafı açıkça “diyetisyenin dijital kliniği” olarak tarif ediyor. Premium kullanıcıda tarif kaynağının omurgası diyetisyenin private/signature havuzu olmalı; public sonuçlar ancak yeterli clinic sonuç yoksa veya ayrı bölümde, daha düşük önemde gösterilmeli. fileciteturn15file0 fileciteturn13file0

**Eksik görünenler:**
- Premium result ekranında clinic ve public içerik arasındaki ayrım hâlâ yeterince sert değil.
- “Geçerli clinic tarif yoksa fallback public göster” kuralı ile “clinic partial'ı public full üstüne koyma” kuralı birlikte çok net acceptance testlerle sabitlenmeli.
- Başka diyetisyenin private tariflerinin hiçbir koşulda sızmaması için backend integration tests eksik olabilir.
- `activeDietitianId`, link expiration, downgrade to free davranışı için recipe-match tarafında da sert guard testleri lazım.

**Kesin kural:**
- Premium kullanıcı için sorgu varsayılanı `tenant-first` olmalı.
- Başka tenant recipe asla dönmemeli.
- Public recipe ancak `valid tenant result count == 0` veya ayrı `fallbackPublic` bölümünde gösterilmeli.
- Invalid/partial clinic result, valid public full result'ı featured olarak geçmemeli.

---

### C. Ingredient Dictionary mimarisi dokümandaki derinlikte görünmüyor

Doküman ingredient dictionary'nin yalnızca search suggestion değil; normalization, parent-child inheritance ve cross-reference substitute motoru olduğunu söylüyor. Yoğurt → süzme yoğurt / laktozsuz yoğurt / ev yoğurdu ve yoğurt ↔ kefir örnekleri özellikle verilmiş. fileciteturn15file0

**Eksik görünenler:**
- Search tarafında alias mapping varmış gibi görünse de match motorunda bunun her durumda kullanıldığı garanti değil.
- Parent-child kabul kuralları ile substitute kuralları ayrı loglanmalı.
- “Domates / çeri domates / salkım domates” gibi senaryolar için test matrisi zorunlu.
- Bulk import ile girilen tariflerin malzemeleri sözlükte normalize edilmeden tarif motoruna düşüyorsa, sonuçlar yine alakasız olur.

**Zorunlu veri modeli:**
- `Ingredient { Id, CanonicalName, ParentIngredientId?, IsActive }`
- `IngredientAlias { IngredientId, Alias }`
- `IngredientSubstitute { IngredientId, AlternativeIngredientId, Strength, Note }`
- `RecipeIngredientRule { RecipeId, IngredientId, Role, SubstituteGroupId? }`

---

### D. Kitchen UX hâlâ tezdeki “tek tuşla çözüm + kutu açılışı” etkisini tam vermiyor

Dokümana göre mutfak:
- alt navigasyonun ortasında kahraman aksiyon olmalı,
- hızlı ekle ile sepeti hızla kurdurmalı,
- altta sabit dev bir Birleştir butonuna sahip olmalı,
- Premium tarafta kutu açılışı / hediye hissi ile sonuç üretmeli. fileciteturn15file0

Mevcut `KitchenScreen.tsx` hâlâ kendi içinde çok özel motion denemeleri barındırıyor ama yapıda aşağıdaki riskleri taşıyor:
- butonun safe-area/bottom-nav ilişkisi bug üretmişti; bu artık **tam yapısal** çözülmeli,
- overlay motion kısmı hâlâ ekran seviyesinde el yapımı state ve interval/pulse mantığıyla dağınık olabilir,
- hızlı ekle bölümünün premium/free ayrımı yeterince net olmayabilir,
- workspace shell ile command dock görsel hiyerarşisi daha da sertleştirilmeli. fileciteturn14file12

**Eksik UX davranışları:**
- Free kullanıcıda standart preset pack'ler, premium kullanıcıda dietitian-specific preset pack'ler.
- Birleştir CTA'nın ilk render'dan itibaren nav üstünde sabit ve güvenli görünmesi.
- Empty, loading, result, no-result, upsell ve premium-result durumlarının her biri için ayrı state tasarımı.
- Sonuç ekranında `featured` + `diğer geçerli tarifler` + `eksiklerle olur` + `uygun değil` hiyerarşisi.
- Free sonuç ekranı altında native upsell kartı.

---

### E. Ana ekran ve premium/free ayrımı tezde tarif edilen kadar keskin değil

Doküman Free ve Premium home'un aynı ekranın varyasyonu değil, hissiyatı bile farklı iki deneyim olmasını istiyor. Free: keşif ve upsell. Premium: klinik bağlılık, markalama, uyum, sıradaki öğün. fileciteturn15file0 fileciteturn13file0

**Şu anda eksik / zayıf görünen noktalar:**
- Dashboard tarafında premium aksiyonlarda hâlâ belirsiz label'lar vardı (`Insight` gibi). Bu tezdeki net menü mantığıyla uyumlu değil. fileciteturn14file3
- Free/Premium home ayrımı görsel olarak keskinleşmiş olsa da premium tarafta klinik branding ve “dijital şube” etkisi daha da güçlenmeli.
- Free tarafta public recipe discoverability ve native upsell akışı daha sistematik olmalı.
- White-label brand color override akışı home ve kitchen hero'larında eksiksiz uygulanmalı. Doküman bunu açıkça istiyor. fileciteturn14file1

---

### F. Profile ekranı tam bir account / activation / compliance hub değil

Profile ekranında premium modül ve bazı parçalar var, ancak gamification alanındaki bazı veriler placeholder durumda (`—`). Bu da tezde anlatılan başarı, streak, bağlılık ve hesap verebilirlik hissini eksik bırakıyor. fileciteturn14file8

**Eksik görünenler:**
- Free kullanıcı için “Premium'u Aktifleştir / Klinik Hesabını Bağla” alanı en üst seviyede daha belirgin olmalı.
- Premium kullanıcıda access key end-date, bağlı diyetisyen, clinic brand, active plan summary ve son activity daha görünür olmalı.
- Rozet/streak alanı gerçek veri ile beslenmiyorsa placeholder yerine hiç görünmemeli veya düzgün fallback state göstermeli.
- Profil, sadece settings listesi değil; membership hub olmalı.

---

### G. Telemetri / compliance / panel geri bildirimi tez seviyesinde kapatılmamış olabilir

Doküman çok net: danışanın `Yaptım / Yedim` aksiyonları, tarif kullanımı, uyum skoru ve ölçümler panel tarafına dönmeli. Bu ürünün B2B2C değer önerisinin merkezinde bu çift yönlü akış var. fileciteturn15file0

**Eksik görünenler:**
- Kitchen result'tan yapılan tarif seçimi veya “Yaptım” aksiyonları her zaman structured event olarak loglanıyor mu belli değil.
- `recipe suggested`, `recipe opened`, `recipe completed`, `recipe skipped`, `result had substitute`, `result had missing mandatory` gibi event türleri netleşmeli.
- Diyetisyen panelinde “hangi tarifler gerçekten yapılıyor?” ve “hangi noktada kullanıcı kopuyor?” metrikleri için event contract sabitlenmeli.

**Zorunlu event önerileri:**
- `KitchenCombineRequested`
- `KitchenResultShown`
- `RecipeOpened`
- `RecipeCompleted`
- `RecipeSkipped`
- `PlanMealCompleted`
- `PlanMealSkipped`
- `PremiumActivated`
- `PremiumExpired`

---

### H. Tez çıktısı için benchmark ve deneysel değerlendirme paketi eksik

Tez sadece “uygulama çalışıyor” ile bitmemeli. PDF ve dokümanlar motorun neden anlamlı olduğunu anlatıyor; bunu raporlayan benchmark seti de olmalı. fileciteturn13file0 fileciteturn15file0

**Eksik görünen tez deliverable'ları:**
- Golden dataset / scenario matrix
- Precision of exact match
- Precision of parent-child match
- Precision of substitute match
- Forbidden filter rejection rate
- Tenant isolation test report
- Premium vs free suggestion quality comparison
- “alakasız öneri” örnekleri ve düzeltilmiş halleri

**Tez için minimum tablo seti:**
1. 20 senaryoluk kitchen basket benchmark
2. Her senaryoda expected featured recipe
3. Motor çıktısı vs expected comparison
4. Failure cases and fix notes

---

## 4) Kod ve ekran durumuna göre spesifik eksik listesi

### 4.1 Dashboard / Home
- `DashboardScreen` premium/free aksiyon nomenclature ve bilgi mimarisi tez dokümanına birebir hizalanmalı. `Insight` gibi belirsiz aksiyonlar kaldırılmalı. fileciteturn14file3
- Premium home'da klinik markalama ve uyum-sıradaki öğün bağı daha güçlü kurulmalı. `nextMeal` kartı var ama bu akışın gerçekten plan verisi ile beslenmesi kabul kriterine bağlanmalı. fileciteturn14file7
- Free home'da public recipes ve activation banner daha güçlü bir retention+upsell kurgusuyla çalışmalı. Mevcut `FreeHomeScreen` içinde premium özellik listesi var ama tezde istenen “native teaser content” yapısı daha güçlü kurulmalı. fileciteturn14file6 fileciteturn14file18

### 4.2 Kitchen
- `KitchenScreen` command dock safe-area + bottom-nav + keyboard durumlarında sabitlenmeli.
- `QuickAddCarousel` free/premium veri kaynağına göre ayrılmalı.
- Birleştir tetikleyicisi, sadece `selectedIngredientIds` değil `normalizedIngredientIds` ile çalışmalı.
- Merge overlay ve result transition reusable motion grammar ile sadeleştirilmeli. fileciteturn14file12

### 4.3 Result / Alternative
- `KitchenResultScreen` featured logic kısmen düzelmiş olsa da artık explainability ve premium/public ayrımı UI'da da görünmeli.
- `AlternativeResultScreen` hâlâ insanileştirme tarafında metin tabanlı regex yaklaşımı taşıyor; bu, merkezi decision payload modeline taşınmalı. Açıklama, structured field'dan gelmeli; regex'le türetilmemeli. fileciteturn14file10
- `CheckIngredientsScreen` ayrı alternatif akışı için güzel ama ingredient search, selected chips ve check action tarafı kitchen ana motoruyla ortak normalization katmanını kullanmalı. fileciteturn14file15 fileciteturn14file19

### 4.4 Profile / Messages / Progress
- `ProfileScreen` streak-compliance-badge shelf placeholder değerlerini gerçek veri ile beslemeli veya fallback state vermeli. fileciteturn14file8
- `MessagesScreen` premium gate iyi, ama diyetisyen sesi / koç tonu ve home-progress-plan bağlamı ile daha entegre olabilir. fileciteturn14file9 fileciteturn14file13
- Progress/Dietitian sekmesi tezde anlatıldığı gibi hem accountability hem badge/trend hem ölçüm tarafını bağlayan tek bir katmana dönüşmeli.

### 4.5 Welcome / Login / Visual identity
- `WelcomeScreen` ve bazı free ekranlarda emoji ağırlıklı kimlik hâlâ tezdeki klinik+premium dil ile çelişiyor. Daha profesyonel, white-label'e uyumlu ve erişim anahtarı mantığını doğal anlatan bir onboarding dili gerek. fileciteturn14file5

---

## 5) Sonraki tur için non-negotiable hedefler

Claude bir sonraki turda aşağıdaki hedefleri **tamamlamadan işi bitmiş saymamalı**:

1. **Premium kitchen ranking'in deterministik ve explainable hale getirilmesi**
2. **Ingredient dictionary'nin parent-child + alias + substitute + import entegrasyonu ile tamamlanması**
3. **Kitchen command dock'un yapısal olarak sabitlenmesi**
4. **Kitchen result ekranının tezdeki premium/clinic mantığına göre yeniden kurulması**
5. **Free vs Premium home / recipes / profile akışlarının tezdeki role-play mantığıyla hizalanması**
6. **Telemetry ve compliance event zincirinin tamamlanması**
7. **Benchmark/test matrisi + acceptance criteria + seed senaryoların eklenmesi**

---

## 6) Claude için görev kapsamı (tek turda yapması gerekenler)

### Backend
1. `RecipeMatchController` ve ilgili service/repository zincirini tez mantığına göre yeniden doğrula.
2. Structured `RecipeMatchExplanation` DTO üret.
3. Tenant isolation tests ekle.
4. Forbidden / mandatory / substitute / optional test matrisi ekle.
5. Expired premium / wrong tenant / free fallback senaryolarını test et.
6. `KitchenCombineRequested` ve `RecipeCompleted` gibi event contract'ları netleştir.

### Mobile
1. KitchenScreen command dock overlap bug'ını kalıcı çöz.
2. QuickAddCarousel'ı free vs premium veri kaynağına göre ayır.
3. KitchenResultScreen'i:
   - premium clinic featured
   - valid public fallback
   - partial bucket
   - explainability chips
   - free upsell teaser
   düzeniyle yeniden kur.
4. Alternative akışlarını merkezi match payload'a bağla.
5. Profile'da activation / membership / streak alanlarını gerçek veri ile hizala.
6. Dashboard / Home aksiyon isimlerini tez dokümanına göre netleştir.

### Web / Dietitian Panel
1. Recipe editor'da mandatory / optional / substitute / forbidden veri modeli tam olsun.
2. Dietitian-specific quick basket/preset pack tanımlama alanı ekle.
3. Plan + kitchen usage + compliance panel event tüketimini bağla.
4. Dietitian branding color/logo ayarlarının mobile'a yansımasını doğrula.

---

## 7) Claude için kesin kabul kriterleri

### Matching
- `nohut + yağ` sepeti, mandatory uyumsuz bir omleti featured çıkaramaz.
- Mandatory eksik clinic tarif, valid public full tarifin üstüne featured olarak çıkamaz.
- Forbidden rule hit alan tarif hiçbir “valid” bucket'a düşemez.
- Parent-child varyasyonu (örn. yoğurt ↔ süzme yoğurt) doğru çalışır.
- Substitute varyasyonu (örn. yoğurt ↔ kefir) doğru loglanır.

### UX
- Birleştir butonu ilk render'dan itibaren tab bar üstünde, sabit ve dokunulabilir görünür.
- Keyboard açılıp kapanınca CTA zıplamaz.
- Premium result ekranında ilk görülen kart diyetisyen bağlamını hissettirir.
- Free result ekranında doğal ama baskın olmayan upsell bulunur.

### Premium isolation
- Premium kullanıcı sadece kendi active dietitian havuzunu ve izinli fallback public tarifleri görür.
- Başka tenant private recipe hiçbir response'da görünmez.
- Expired premium kullanıcı otomatik free davranışına düşer.

### Thesis evidence
- En az 20 scenario'luk benchmark tablosu üretilmiş olur.
- Her senaryonun expected result ve actual result karşılaştırması çıkarılmış olur.
- Fail olan senaryolar notlanır ve düzeltilir.

---

## 8) Claude için uygulanacak test senaryoları

### Sözlük / Normalizasyon
- domates -> çeri domates tarifini bulmalı
- salkım domates -> domates köküne normalize olmalı
- süzme yoğurt -> yoğurt mandatory tarifte kabul edilmeli
- kefir -> yoğurt substitute tarifte substitute match üretmeli

### Mantık / Ranking
- `nohut + yağ` -> nohut bazlı bowl/salata/çorba varsa önce onlar
- `yumurta + peynir + zeytin` -> kahvaltı tarifleri öne çıkmalı
- `ton balığı yok` ama tarif mandatory ton balığı istiyorsa `FULL_MATCH` olmamalı
- laktoz hassasiyetinde yoğurtlu tarif `blockedByRules` ile elenmeli

### Tenant / Premium
- premium kullanıcı + clinic tarifleri var -> clinic featured
- premium kullanıcı + clinic valid yok + public valid var -> public fallback featured
- premium kullanıcı + başka tenant tarifleri -> görünmemeli
- premium expired -> premium content görünmemeli

### Telemetry
- combine request event kaydolmalı
- result shown event kaydolmalı
- recipe completed event kaydolmalı
- panel summary'de haftalık completion sayısına yansımalı

---

## 9) Claude'a verilecek çalışma talimatı

Aşağıdaki ilkeleri uygula:

- Bu tur bir polish turu değildir.
- Bu tur tez mantığını ürün davranışına kilitleme turudur.
- Önce mantığı deterministik, açıklanabilir ve testli hale getir.
- Sonra kitchen result UX'i ve premium clinical ayrımı UI'da görünür kıl.
- Free/Premium ayrımı yalnız renk farkı değil; **veri kaynağı + ranking mantığı + ton + upsell stratejisi** farkı olarak uygulanmalı.
- Kod tamamlanmadan önce acceptance test matrisi ve benchmark senaryoları eklenmeli.
- Placeholder veri ve regex temelli açıklama üretimi bırakılmalı; structured payload ve gerçek UI state'leri kullanılmalı.

---

## 10) Claude için kısa özet

> Şu an temel ranking bug'ları iyileşmiş olsa da proje hâlâ tezde anlatılan “diyetisyenin aklını danışanın cebine taşıyan premium mutfak motoru” seviyesine tam ulaşmış değil. Bir sonraki turda odak; tenant-first premium mantık, explainable deterministic matching, ingredient dictionary derinliği, sabit kitchen CTA, premium result UX, free/premium role split, telemetry/compliance loop ve tez benchmark paketini eksiksiz kapatmak olmalı.

