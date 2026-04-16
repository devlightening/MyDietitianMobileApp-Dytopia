# Tarif Dosyası İçe Aktarma Sistemi – Dayanıklı Mimari, Doğruluk Stratejisi ve Claude Uygulama Planı

## 1) Amaç
Bu doküman, diyetisyenin elindeki eski tarif dosyalarını (`csv`, `xlsx`, `docx`, `pdf`, taranmış PDF/görsel) web panele sürükle-bırak ile yüklediğinde:

- dosyanın güvenli şekilde kabul edilmesini,
- içeriğin mümkün olan en doğru biçimde çıkarılmasını,
- tariflerin sistemdeki hedef şemaya normalize edilmesini,
- malzemelerin mevcut `Ingredient Dictionary` yapısına bağlanmasını,
- düşük güvenli alanların otomatik olarak review ekranına düşmesini,
- onay sonrası verinin üretim tablolarına güvenli biçimde aktarılmasını

sağlayan **çok katmanlı bir içe aktarma mimarisi** tanımlar.

Bu sistemin amacı “yalnızca düzgün CSV” kabul etmek değil; kötü biçimlendirilmiş, başlığı karışık, farklı sütun isimleri kullanan, çoklu tablo içeren veya kısmen taranmış dosyalarda da kullanıcıya **başarısızlık yerine kontrollü kurtarma akışı** sunmaktır.

---

## 2) Mevcut Sorunun Teşhisi
Şu anki akışın temel kırılma noktaları şunlar:

1. **Format bağımlılığı çok yüksek**
   - CSV/XLSX için sabit kolon isimleri bekleniyor.
   - DOCX için “ilk tablo” okunuyor.
   - Başlık sırası, tablo yeri veya belge düzeni değişince import bozuluyor.

2. **Doğrudan üretim şemasına zorlama**
   - Belgedeki veri önce “aday veri” olarak tutulmadan doğrudan hedef tablo mantığına itiliyor.
   - Bu da yarım parse, eksik parse ve anlamsız hata üretimine yol açıyor.

3. **Belge anlamlandırma ile veri normalizasyonu aynı aşamada**
   - “Belgede ne var?” ile “bunu bizim veritabanına nasıl oturturuz?” soruları ayrılmamış.

4. **Malzeme eşleme katmanı import içinde yeterince güçlü değil**
   - Kullanıcının dosyasındaki serbest metin malzeme isimleri doğrudan `Ingredients` yapısına güvenilir bağlanamıyor.

5. **Hata yönetimi kullanıcı dostu değil**
   - `Session Failed` gibi genel mesajlar teknik detayı saklıyor.
   - Hangi satırın, hangi alanın, neden hata verdiği yeterince açık gösterilmiyor.

6. **İlk dosya başarısız olunca kullanıcı kaybediliyor**
   - “Tam otomatik” çalışmazsa süreç tamamen kırılıyor.
   - Oysa doğru yaklaşım: **otomatik çıkar + güven puanı + review ekranı + toplu düzelt + onayla**.

---

## 3) Dürüst Gerçeklik
Her bozuk tarif dosyasını %100 kusursuz şekilde tek seferde içe aktaran bir sistem gerçekçi değildir.

Özellikle şu durumlarda tam otomatiklik düşer:

- düşük kaliteli taranmış PDF,
- el yazısı,
- aynı belgede çok farklı tarif formatları,
- tablo yerine serbest paragraf anlatımı,
- ölçü birimi olmayan satırlar,
- malzeme ile tarif adımının birbirine karıştığı içerikler.

Ancak çok güçlü bir mimariyle şunu başarabiliriz:

- **iyi dosyalarda tam otomatik import**, 
- **orta kalite dosyalarda yarı otomatik review**,
- **çok kötü dosyalarda bile “elle yeniden girmek yerine sistemin düzeltilmesini bekleyen akıllı taslak” üretimi**.

Hedef “sıfır hata” değil, **kullanıcıyı import başarısızlığında asla boşta bırakmamak** olmalıdır.

---

## 4) Hedef Mimari – 6 Katmanlı Import Pipeline

## Katman A — Dosya Kabul ve Güvenlik
Dosya yüklenince hemen parse edip üretim tablolarına yazma. Önce güvenli kabul katmanı.

### Yapılacaklar
- MIME/type doğrulama (yalnızca uzantıya güvenme)
- Boyut limiti
- SHA-256 içerik hash
- duplicate upload tespiti
- import job kaydı oluşturma
- dosyayı kalıcı storage’a alma
- async/background queue’ya gönderme

### Yeni Tablolar
- `ImportJobs`
- `ImportJobFiles`
- `ImportAuditEvents`

### ImportJobs önerilen alanlar
- `Id`
- `DietitianId`
- `OriginalFileName`
- `StoredFilePath`
- `FileHash`
- `MimeType`
- `FileSizeBytes`
- `Status` (`Uploaded`, `Parsing`, `NeedsReview`, `Approved`, `Imported`, `Failed`, `PartiallyImported`)
- `ErrorCode`
- `ErrorMessage`
- `WarningsJson`
- `DetectedDocumentType`
- `ConfidenceScore`
- `CreatedAtUtc`
- `UpdatedAtUtc`
- `ApprovedAtUtc`

---

## Katman B — Belge Türü Sınıflandırma
Import pipeline ilk iş olarak dosyayı sınıflandırmalı.

### Hedef sınıflar
- `StructuredTableDocument`
- `SemiStructuredRecipeDocument`
- `ScannedDocument`
- `MixedDocument`
- `UnsupportedDocument`

### Neden gerekli?
Aynı parse mantığı her dosyada çalışmaz. CSV/XLSX için tablo parser gerekirken, taranmış PDF için OCR/document intelligence gerekir.

### Karar mantığı
- CSV/XLSX: doğrudan tablo ağırlıklı pipeline
- DOCX: tablolar + başlıklar + paragraflar birlikte okunur
- PDF: önce selectable text var mı kontrol et
- Scan ise OCR/document intelligence pipeline’a yönlendir
- Çok karışık belgeyse “candidate extraction + review-first” akışına düşür

---

## Katman C — Çoklu Parser / Ensemble Extraction
Tek parser yerine **çoklu çıkarım stratejisi** kullanılmalı.

### 1. Structured parser
Uygun dosyalar:
- CSV
- XLSX
- düzenli DOCX tabloları

Görev:
- satır/sütun çıkarmak
- header eşleştirmek
- satır gruplarını tarif bazında toplamak

### 2. Layout parser
Uygun dosyalar:
- PDF
- tablolu ama dağınık DOCX
- çoklu tablo içeren belgeler

Görev:
- sayfa düzeni
- tablo blokları
- başlıklar
- metin blokları
- tarif bölümleri

### 3. Semantic extraction / LLM fallback
Yalnızca şu alanlarda devreye girmeli:
- parser’ın çıkardığı aday veri eksikse
- başlık eşleme kararsızsa
- ingredient / instruction ayrımı belirsizse
- tablo yok ama tarif paragraf halinde yazılmışsa

### Kritik kural
LLM, tüm import pipeline’ı körlemesine yönetmemeli.
LLM şu rolde olmalı:
- aday alanları tamamlamak,
- belirsiz alanlar için sınıflandırma yapmak,
- JSON schema’ya oturtulmuş structured output üretmek,
- confidence düşükse review’e yönlendirmek.

---

## Katman D — Hedef Şemaya Aday Veri Üretimi (Staging)
Belgeden çıkan veri önce **staging tablolara** düşmeli. Üretim `Recipes` tablolarına doğrudan yazılmamalı.

### Yeni Tablolar
- `ImportRecipeCandidates`
- `ImportIngredientCandidates`
- `ImportFieldIssues`
- `ImportSourceSpans`

### ImportRecipeCandidates alanları
- `Id`
- `ImportJobId`
- `DetectedRecipeTitle`
- `DetectedDescription`
- `DetectedInstructionsJson`
- `DetectedVisibility`
- `DetectedMealType`
- `DetectedPrepTimeText`
- `DetectedServingsText`
- `ConfidenceScore`
- `NeedsReview`

### ImportIngredientCandidates alanları
- `Id`
- `ImportRecipeCandidateId`
- `RawIngredientText`
- `ParsedIngredientName`
- `ParsedAmountText`
- `ParsedNumericAmount`
- `ParsedUnit`
- `ParsedRole`
- `CanonicalIngredientId`
- `CanonicalMatchType` (`Exact`, `Alias`, `Family`, `Substitute`, `Fuzzy`, `Manual`, `Unknown`)
- `ConfidenceScore`
- `NeedsReview`
- `IssueCodesJson`

### Neden şart?
Bu staging yapı sayesinde:
- otomatik parse ile insan onayı ayrılır,
- import bozulsa bile aday veri korunur,
- UI’da satır bazında düzeltme yapılabilir,
- audit trail tutulur.

---

## Katman E — Normalizasyon ve Akıllı Eşleme
Bu katman sistemin doğruluğunu ciddi artırır.

### 1. Header normalization
Sabit header beklemeyin. Synonym dictionary kullanın.

### Örnek eşleme sözlüğü
- `recipe_title` ← `tarif_adi`, `tarif adı`, `tarif`, `meal title`, `başlık`
- `ingredient_name` ← `malzeme`, `malzeme_adi`, `ingredient`, `ürün`, `icerik`
- `amount` ← `miktar`, `adet`, `gram`, `ölçü`
- `unit` ← `birim`, `ölçü birimi`, `unit type`
- `role` ← `rol`, `mandatory`, `optional`, `zorunlu`, `opsiyonel`
- `description` ← `açıklama`, `not`, `desc`
- `visibility` ← `görünürlük`, `public`, `private`, `erişim`

### 2. Unit normalization
Tüm ölçüleri standardize edin.

Örnekler:
- `gr`, `g`, `gram` → `g`
- `adet`, `pcs`, `piece` → `piece`
- `yemek kaşığı`, `tbsp` → `tbsp`
- `tatlı kaşığı`, `tsp` → `tsp`
- `su bardağı`, `cup` → `cup`

### 3. Ingredient normalization
Bu kısım mevcut sisteminizin `Ingredient Dictionary` yapısına bağlanmalı.

Sıralı eşleme stratejisi:
1. exact match
2. alias match
3. normalized text match
4. family/parent match
5. substitute group match
6. fuzzy match
7. semantic/LLM assisted candidate suggestion
8. unresolved → review

### 4. Role inference
Dosyada rol yoksa sistem infer edebilir:
- başlıca ana malzemeler → `Mandatory`
- garnitür / süsleme / opsiyonel notlar → `Optional`
- “yerine kullanılabilir” ifadeleri → `Substitute`

Ama bu inference yüksek güvenli değilse mutlaka review’e düşmeli.

---

## Katman F — Review, Onay ve Üretime Aktarım
En kritik fark burada: **import = parse + review + approve + commit**.

### UI akışı
1. Dosya yükle
2. Sistem aday tarifleri çıkarır
3. “İncele” ekranı açılır
4. Kullanıcı eksik alanları düzeltir
5. Onaylar
6. Üretim tablolarına transaction ile yazılır
7. Import özeti gösterilir

### Review ekranında olması gerekenler
- Sol tarafta kaynak belge önizlemesi
- Sağ tarafta parse edilen alanlar
- Satır bazlı güven puanı
- Hangi alanın neden flag aldığı
- Toplu düzeltme araçları
- “Bu eşlemeyi şablon olarak kaydet” butonu
- “Bu malzemeyi sözlüğe alias olarak ekle” aksiyonu

### Commit sırasında
- transaction aç
- production tablo insert/update yap
- duplicate recipe tespiti yap
- ingredient relations oluştur
- import summary kaydet
- audit log yaz

---

## 5) “En Uymayan Dosya” İçin Başarı Stratejisi
Tam otomatik değil, **graceful degradation**.

## Seviye 1 — İyi yapılandırılmış dosya
- otomatik parse
- otomatik mapping
- otomatik import

## Seviye 2 — Orta kalite dosya
- otomatik parse
- bazı alanlar unresolved
- review screen
- toplu düzeltme
- onay sonrası import

## Seviye 3 — Çok bozuk dosya
- sistem yine aday recipe taslakları üretir
- tarif bloklarını ayırır
- ingredient text’leri listeler
- kullanıcı sadece eksik alanları tamamlar
- yeniden sıfırdan girmek zorunda kalmaz

Hedef: **“Import failed, tekrar baştan gir” dememek.**

---

## 6) Video’daki Sorunun Önüne Geçmek İçin UI/UX Düzeltmeleri
Mevcut ekranda kullanıcıya şu mesaj veriliyor:
- sabit kolon isimleri bekleniyor,
- DOCX için ilk tablo okunuyor,
- başlık satırı zorunlu.

Bu yaklaşım demo için yeterli olabilir ama gerçek dünyada kırılır.

### Yeni upload ekranı
Upload kartında kullanıcıya şu 3 mod verilmeli:
- **Akıllı Tanı (önerilen)**
- **Tablolu Dosya**
- **Serbest Metin / Karışık Belge**

### İnceleme ekranı
- “Sistem 8 tarif adayı buldu”
- “3 malzeme eşleşemedi”
- “2 tarifte visibility bulunamadı, varsayılan Private seçildi”
- “1 tabloda başlık yok, içerikten tahmin edildi”

### Hata mesajı standardı
Genel mesaj yerine:
- `HEADER_UNMAPPED`
- `NO_RECIPE_BOUNDARY_FOUND`
- `LOW_OCR_CONFIDENCE`
- `INGREDIENT_UNRESOLVED`
- `AMBIGUOUS_UNIT`
- `PARSER_FALLBACK_USED`

Her hata için çözüm önerisi gösterilmeli.

Örnek:
- “Bu belgede net sütun başlığı bulunamadı. Sistem alanları tahmin etti. İnceleme ekranında doğrulayın.”

---

## 7) Öğrenen Sistem Tasarımı (İnovasyon Noktası)
Bu kısmı eklerseniz ürün gerçekten fark yaratır.

## A) Import Template Learning
Aynı diyetisyen sürekli benzer Word/Excel formatı kullanıyorsa sistem bunu öğrenmeli.

### Yeni tablo
- `ImportTemplates`

### İçerik
- `DietitianId`
- `TemplateName`
- `DocumentFingerprint`
- `HeaderMappingsJson`
- `ColumnOrderJson`
- `RecipeBoundaryRulesJson`
- `DefaultVisibility`
- `DefaultRoleRules`

### Sonuç
Bir sonraki yüklemede sistem:
- “Bu dosya, daha önce kullandığınız ABC Klinik Tarif Şablonu ile eşleşti. Aynı mapping uygulanacak.”

diyebilir.

## B) Correction Feedback Loop
Kullanıcının review ekranında yaptığı düzeltmeler boşa gitmemeli.

Örnek öğrenimler:
- `lor peyniri` → alias olarak sakla
- `sb` → `cup`
- `not: süsleme` satırı → optional ingredient ya da description pattern’i olarak öğren

## C) Dietitian-specific vocabulary
Her kliniğin dili farklı olabilir.

Örnek:
- “yeşillik karışımı” belli bir ingredient family’ye bağlanabilir
- “ekmek grubu” gibi toplu ifadeler özel rule olarak saklanabilir

Bu katman, zamanla doğruluğu sistematik biçimde artırır.

---

## 8) Yönetilen Servis mi, Open Source mu?

## Düşük maliyet / self-host yaklaşım
Kullanım:
- iyi kalite CSV/XLSX/DOCX
- text tabanlı PDF
- kontrollü MVP

Bileşenler:
- mevcut structured parsers
- layout extraction fallback
- LLM-assisted normalization
- review UI

Avantaj:
- daha düşük maliyet
- daha fazla kontrol
- hızlı MVP

Dezavantaj:
- taranmış belge kalitesinde limit
- karmaşık belge çeşitliliğinde daha çok edge-case

## Yüksek doğruluk / managed document intelligence yaklaşımı
Kullanım:
- scan PDF
- farklı şablonlar
- elle hazırlanmış Word/PDF belgeler
- enterprise kalite hedefi

Avantaj:
- tablo, key-value, OCR, layout kalitesi daha yüksek
- belge tipini sınıflandırma ve extraction başarısı artar

Dezavantaj:
- sayfa başı maliyet
- vendor bağımlılığı
- entegrasyon karmaşıklığı

## Önerilen yaklaşım
**Hibrit model kurun.**

1. Önce local/open-source parse dene.
2. Güven düşükse managed document intelligence fallback çalıştır.
3. Hâlâ düşükse review ekranına düşür.

Bu hem maliyeti kontrol eder hem doğruluğu artırır.

---

## 9) Güven Puanı Sistemi
Her alan ve her tarif için confidence score üretin.

## Alan bazlı puan örneği
- Title exact header match: `0.98`
- Ingredient alias match: `0.91`
- Fuzzy ingredient match: `0.73`
- OCR ile okunan unit: `0.62`
- LLM inferred role: `0.58`

## Tarif bazlı karar
- `>= 0.92` → auto-approve adayı
- `0.75 - 0.92` → review required
- `< 0.75` → force manual confirmation

## Hard-stop kuralları
Aşağıdakiler varsa auto import yok:
- tarif adı yok
- ingredient yok
- ingredient’lerin çoğu unresolved
- belge parse’ında yüksek ambiguity

---

## 10) Üretim Şemasına Aktarım Stratejisi
Hedef veri modeli şu mantıkta olmalı:

### Recipe
- title
- description
- visibility
- mealType
- prepTime
- instructions
- dietitianId

### RecipeIngredient
- recipeId
- ingredientId
- rawText
- amount
- unit
- role
- sortOrder

### RecipeImportMetadata
- recipeId
- importJobId
- sourceFileName
- sourceType
- importConfidence
- approvedByUserId
- importedAtUtc

### Önemli not
`rawText` alanını saklayın. Çünkü ileride mapping’leri düzeltmek ve hataları analiz etmek için çok değerlidir.

---

## 11) Duplicate ve Merge Kuralları
Aynı tarifin tekrar yüklenmesi çok olası.

### Duplicate tespiti
- aynı dietitian
- normalize edilmiş aynı title
- benzer ingredient fingerprint

### Karar seçenekleri
- yeni tarif oluştur
- mevcut tarifi güncelle
- iki tarifi birleştir
- kullanıcıya sor

### UI
Import sonunda sistem şunu göstermeli:
- “2 tarif mevcut kayıtlarla çok benzer bulundu. Güncellemek ister misiniz?”

---

## 12) Arka Plan Job Yapısı
Bu işlem request-response içinde bitmemeli.

### Önerilen job adımları
1. `UploadAccepted`
2. `ClassifyDocument`
3. `ExtractCandidates`
4. `NormalizeCandidates`
5. `MatchIngredients`
6. `GenerateReviewModel`
7. `AwaitUserApproval`
8. `CommitImport`
9. `Completed`

### Neden?
- büyük dosyalarda timeout önlenir
- UI ilerleme gösterebilir
- kullanıcı sekmeyi kapatsa bile iş kaybolmaz
- yeniden denenebilir yapı kurulur

---

## 13) Önerilen API Taslağı

### Upload
`POST /api/recipe-import/jobs`
- file
- importMode
- optionalTemplateId

### Job status
`GET /api/recipe-import/jobs/{jobId}`

### Review model
`GET /api/recipe-import/jobs/{jobId}/review`

### Apply edits
`PATCH /api/recipe-import/jobs/{jobId}/review`

### Approve
`POST /api/recipe-import/jobs/{jobId}/approve`

### Retry failed stage
`POST /api/recipe-import/jobs/{jobId}/retry`

### Save template
`POST /api/recipe-import/jobs/{jobId}/save-template`

---

## 14) Review UI Bileşenleri

### Web panel bileşenleri
- `RecipeImportUploadCard`
- `RecipeImportProgressStepper`
- `RecipeImportReviewScreen`
- `ImportSourcePreviewPane`
- `ImportRecipeCandidateList`
- `ImportIngredientResolutionTable`
- `ImportIssuePanel`
- `ImportTemplateSuggestionBanner`
- `BulkFixToolbar`
- `ImportSummaryModal`

### Toplu aksiyon örnekleri
- tüm unresolved `visibility` → `Private`
- tüm boş `role` → `Mandatory`
- `gr` ve `gram` → `g`
- seçili malzemeleri aynı canonical ingredient’e bağla

---

## 15) Başarı Kriterleri

## Functional
- CSV/XLSX düzgün dosyada tek tık import
- çoklu tablo DOCX’te ilk tabloya bağımlı olmama
- taranmış PDF için fallback pipeline
- unresolved ingredient review akışı
- staging olmadan production write yapılmaması
- import özeti ve audit log

## Accuracy
- düzgün structured dosyalarda yüksek otomasyon
- semistructured dosyalarda review ile kurtarma
- aynı klinik şablonlarında zamanla artan doğruluk

## UX
- kullanıcı “neden başarısız oldu?” sorusuna net cevap almalı
- kullanıcı tekrar sıfırdan veri girmemeli
- kısmi başarı desteklenmeli

## Security / Reliability
- job retry
- idempotent import
- duplicate tespiti
- transaction güvenliği
- role-based erişim

---

## 16) MVP → Faz 2 → Faz 3 Yol Haritası

## MVP
- CSV/XLSX güçlü import
- DOCX çoklu tablo desteği
- header synonym mapping
- staging tablolar
- review ekranı
- ingredient alias + fuzzy matching
- import templates

## Faz 2
- text PDF layout parsing
- scan PDF OCR fallback
- duplicate/merge flow
- bulk fix tools
- confidence scoring

## Faz 3
- managed document intelligence fallback
- clinic-specific öğrenen template sistemi
- correction feedback loop
- source-side highlight / span mapping
- otomatik alias önerileri

---

## 17) Claude İçin Uygulama Direktifi
Aşağıdaki bölümü Claude’a doğrudan ver:

---

# Claude Uygulama Görevi

Bu projede web paneldeki tarif içe aktarma sistemini production-grade hale getir.

## Ana hedef
Diyetisyen eski tarif dosyalarını (`csv`, `xlsx`, `docx`, sonra `pdf`) sürükle-bırak ile yüklediğinde sistem:
1. dosyayı async job olarak kabul etsin,
2. belge tipini sınıflandırsın,
3. aday tarif ve aday malzeme kayıtları oluştursun,
4. ingredient dictionary ile normalize etsin,
5. düşük güvenli alanları review ekranına düşürsün,
6. kullanıcı onayı sonrası veriyi production recipe tablolarına aktarsın.

## Kritik kurallar
- Doğrudan upload sonrası production tabloya insert yapma.
- `DOCX` için yalnızca ilk tabloyu okumayı kaldır.
- Çoklu tablo, paragraf ve heading destekle.
- Sabit kolon adı zorunluluğunu gevşet; synonym mapping ekle.
- Import pipeline’da `staging` tablolar kur.
- `Session Failed` gibi genel hata yerine alan bazlı issue üret.
- Review ekranı olmadan düşük güvenli import yapma.
- Mevcut ingredient normalization mantığını import pipeline ile birleştir.
- Kullanıcının yaptığı düzeltmeleri template/feedback olarak sakla.

## Yapılacak backend işleri
1. `ImportJobs`, `ImportRecipeCandidates`, `ImportIngredientCandidates`, `ImportFieldIssues`, `ImportTemplates`, `ImportAuditEvents` tablolarını ekle.
2. Upload endpoint oluştur.
3. Background job / queue tabanlı import pipeline kur.
4. CSV/XLSX parser ve gelişmiş DOCX parser yaz.
5. Header synonym mapping katmanı ekle.
6. Ingredient resolution service’i exact/alias/fuzzy/family/substitute sıralı çalışacak şekilde genişlet.
7. Confidence scoring ekle.
8. Approve endpoint ile staging → production commit akışını transaction içinde kur.
9. Duplicate detection ve import summary oluştur.

## Yapılacak frontend işleri
1. Upload stepper: `Dosya Yükle > İncele > Onayla`
2. Gelişmiş review ekranı
3. Source preview + parsed fields yan yana görünüm
4. Unresolved ingredient resolution UI
5. Bulk fix toolbar
6. Import summary ekranı
7. Job status polling veya canlı ilerleme

## Beklenen çıktı
- Çalışan backend + web panel import flow
- migration dosyaları
- seed/template örnekleri
- en az 3 örnek dosya ile test senaryoları
- “structured import”, “review required import”, “failed but recoverable import” senaryoları
- kısa bir teknik gap analysis + manuel test checklist

## Öncelik sırası
1. Staging mimarisi
2. DOCX parser düzeltmesi
3. Review UI
4. Ingredient resolution doğruluğu
5. Template learning
6. PDF fallback

---

## 18) Son Karar Önerisi
Bu proje için en doğru teknik strateji:

- **Structured parser + layout parser + LLM fallback + human review + template learning**
- yani tek araç değil, **katmanlı sistem**.

Bu mimariyle:
- iyi dosyaları otomatik import edersin,
- kötü dosyaları kurtarırsın,
- kullanıcı düzeltmelerinden öğrenirsin,
- zamanla klinik bazlı çok güçlü bir import motoruna dönüşürsün.

Bu özellik gerçekten ürünün ayırt edici inovasyonlarından biri olabilir.
Çünkü burada yalnızca “dosya yükleme” yapmıyorsun; **dağınık tarif bilgisini klinik veriye dönüştüren akıllı bir veri standardizasyon motoru** kuruyorsun.
