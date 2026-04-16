# Claude Görev Dosyası — Çok Modlu Ingredient Detection Sistemi (Seçenek C: Ücretsiz/On-device First + OpenAI Fallback)

## Görev Özeti
Bu projede daha önce fotoğraf ile ürün tarama altyapısı için bir temel hazırlandı. Şimdi bu akışı **yeniden sıfırdan bozup yazmak değil**, mevcut yapıyı **analiz edip yeni mimariye uygun şekilde revize ederek** sorunsuz çalışan bir sisteme dönüştürmeni istiyorum.

Hedefimiz:
- Mobilde kullanıcı fotoğraf çekebilsin veya galeriden yükleyebilsin.
- Sistem fotoğraftaki malzemeleri bulsun.
- Bulduğu adayları benim veritabanımdaki `Ingredients` tablosu ile **canonical ingredient düzeyinde** eşleştirsin.
- Yüksek güvenli eşleşmeler otomatik seçilmiş sayılsın.
- Düşük güvenli eşleşmeler kullanıcı onayına düşsün.
- Sonrasında bu ingredient’ler **Tarif Bul** motorundan önce seçilmiş malzemeler olarak kullanılabilsin.

Bu iş için **Seçenek C** mimarisini kurmanı istiyorum:

> **On-device / ücretsiz çözüm first + OpenAI vision fallback**

Yani sistemin ana omurgası düşük maliyetli ve kontrollü olacak; yalnızca gerekli olduğunda fallback olarak OpenAI vision kullanılacak.

---

## Kritik Ürün Kararı
Bu task’ın mantığı şudur:

1. Kullanıcı fotoğraf çeker.
2. Sistem önce ücretsiz / on-device detection dener.
3. Sonuçlar benim `Ingredients` tablomdaki kayıtlarla eşleştirilir.
4. Eğer güvenli eşleşme varsa otomatik seçilir.
5. Eğer düşük güven veya belirsizlik varsa kullanıcı review ekranında onaylar.
6. Ancak **resolved canonical ingredient** olanlar seçilmiş malzeme sayılır.
7. Ondan sonra Kitchen / Tarif Bul akışı çalışır.

Önemli:
- Fotoğraftan çıkan ham label doğrudan seçilmiş ingredient sayılmayacak.
- Nihai seçilmiş malzeme ancak `Ingredients` tablosundaki bir kayıtla resolve edilirse seçilmiş sayılacak.

---

## Önce Analiz, Sonra Uygulama
Önce mevcut projeyi derin analiz et. Kör değişiklik yapma.

İlk aşamada şu soruların cevabını kod üzerinden bul:

1. Şu an mobilde fotoğraf tarama / camera / image picker akışı nerede?
2. Hangi mevcut ekranlar / componentler / service’ler daha önce bunun için yazılmış?
3. Mevcut image analysis endpoint’i var mı? Varsa ne yapıyor?
4. Ingredient search / canonicalization / alias çözümü backend’de nasıl çalışıyor?
5. `Ingredients` tablosu ile recipe matching arasında hangi route / service / DTO zinciri var?
6. Şu an fotoğraftan dönen sonuçlar hangi aşamada kopuyor veya güvenilir değil?
7. Mevcut sistemi tamamen silmeden hangi parçaları revize ederek bu yeni mimariye oturtabiliriz?

Önce bu analizi yap, sonra implementasyona geç.

---

## Nihai Mimari (Kurulacak Sistem)

### 1. Detection Katmanı
Fotoğraftan aday ingredient’ler çıkarılacak.

#### Primary path — On-device / ücretsiz first
Öncelik düşük maliyetli çözümde olacak.
- Expo / React Native tarafında mevcut kurulu altyapıyı analiz et.
- Uygun ise cihaz üstü bir çözüm veya düşük maliyetli local-first akış kur.
- Bu path, mümkün olduğunca hızlı ve ucuz çalışmalı.

#### Fallback path — OpenAI vision
Yalnızca şu durumlarda fallback devreye girmeli:
- on-device sonuç yoksa
- confidence çok düşükse
- çoklu nesne sahnesi karışıksa
- mapping unresolved kaldıysa

Önemli:
- OpenAI API key mobil uygulamada tutulmayacak.
- API key yalnızca backend env var üzerinden kullanılacak.
- Mobil → backend → OpenAI akışı kurulacak.

---

### 2. Resolver Katmanı
Detection çıktısı doğrudan ingredient seçimi sayılmayacak.
Backend’de ayrı bir resolver katmanı kurulmalı.

Bu resolver şunları yapmalı:
- raw label normalization
- alias eşleştirme
- canonical ingredient çözme
- mapping table eşleştirmesi
- gerektiğinde fuzzy fallback
- confidence hesaplama

Hedef çıktı şu olmalı:
- `rawLabel`
- `normalizedLabel`
- `matchedIngredientId`
- `matchedIngredientName`
- `matchType`
- `confidence`
- `isAutoSelected`
- `requiresUserConfirmation`

---

### 3. Review / Confirmation Katmanı
Düşük güvenli veya belirsiz sonuçlar için kullanıcı review ekranı olacak.

Örnek davranış:
- “Bunu Domates olarak algıladım”
- “Bunu Marul olarak algıladım”
- kullanıcı onaylar / değiştirir / reddeder

Yüksek güvenli sonuçlar doğrudan seçili chip olarak gelebilir.

---

### 4. Selection Katmanı
Yalnızca resolve edilmiş ingredient’ler kitchen selection’a düşecek.

Yani sonuç:
- kullanıcı fotoğraf çekiyor
- sistem ingredient id’leri üretiyor
- bu ingredient id’ler selected ingredients state’ine ekleniyor
- sonra Tarif Bul çalışıyor

---

## Faz 1 — Kapalı Set ile Güçlü İlk Sürüm
Bu fazda 5–10 değil, **20–30 çok kullanılan ingredient** ile başlamak istiyorum.

Bu ingredient’ler benim `Ingredients` tablomda bulunmalı.
Bulunmayan varsa:
- analiz et
- eksik olanları raporla
- gerekli ise kontrollü şekilde ekleme/backfill stratejisi öner
- ama mevcut ingredient modelini bozma

### Faz 1 için hedef ingredient seti
Aşağıdaki ingredient’ler en azından ilk sürümde yüksek öncelikli olsun:

1. Domates
2. Salatalık
3. Marul
4. Limon
5. Tavuk Göğsü
6. Yumurta
7. Soğan
8. Sarımsak
9. Havuç
10. Patates
11. Kabak
12. Biber
13. Kırmızı Biber
14. Brokoli
15. Muz
16. Elma
17. Süt
18. Yoğurt
19. Peynir
20. Kaşar Peyniri
21. Zeytinyağı
22. Tereyağı
23. Pirinç
24. Makarna
25. Kuru Fasulye
26. Nohut
27. Mercimek
28. Somon
29. Ton Balığı
30. Ekmek

### Faz 1 başarı kriteri
Bu 20–30 ingredient için sistem:
- fotoğraftan aday tespit yapabilmeli
- bunları `Ingredients` tablosuyla eşleştirebilmeli
- başarılı olanları seçilmiş ingredient olarak kullanabilmeli

---

## `Ingredients` Tablosu ile Birebir Eşleşme Mantığı
Bu çok kritik.

Sistemin yapması gereken:
- `tomato` görürse `Domates` ingredient kaydına bağlanmalı
- `romaine lettuce` görürse `Marul` ingredient kaydına bağlanmalı
- `chicken breast` görürse `Tavuk Göğsü` ingredient kaydına bağlanmalı

Yani hedef raw string değil, **ingredient row / ingredient id**.

### Eşleşme önceliği
1. Exact alias match
2. Canonical name match
3. Normalized alias match
4. Mapping table match
5. Controlled fuzzy fallback
6. User confirmation

Do not let unresolved labels silently become selected ingredients.

---

## Gerekli Backend Katmanları
Backend’de ekstra işler zorunlu. Sadece frontend yeterli değil.

### En azından şu parçaları tasarla / uygula:

#### 1. Endpoint
Örnek:
- `POST /api/ingredients/detect-from-image`

#### 2. Service abstraction
Örnek:
- `IIngredientVisionService`
- `IIngredientDetectionResolver`

#### 3. Mapping storage
Aşağıdakilerden hangisi en temizse onu uygula:
- mevcut ingredient alias yapısını genişlet
- veya yeni bir mapping tablosu kur

Örnek tablo adı:
- `VisionLabelMappings`

Örnek kolonlar:
- Id
- RawLabel
- NormalizedLabel
- IngredientId
- Provider
- ConfidenceThreshold
- IsApproved
- CreatedAtUtc
- UpdatedAtUtc

#### 4. Detection log / audit
Tez için çok önemli.
Örnek tablo:
- `IngredientDetectionLogs`

Örnek alanlar:
- UserId / ClientId
- ImageSource
- RawLabel
- PredictedIngredientId
- FinalIngredientId
- Confidence
- MatchType
- WasAutoSelected
- WasUserConfirmed
- WasRejected
- CreatedAtUtc

Bu loglar daha sonra tez metrikleri için kullanılacak.

---

## Mobil Tarafında Beklenen Akış
Mevcut fotoğraf altyapısını analiz et ve buna göre revize et.

### Kullanıcı akışı şöyle olmalı:
1. Kullanıcı mutfak ekranında kamera ikonuna basar.
2. Fotoğraf çeker veya galeriden seçer.
3. Sistem tarama yapar.
4. Bulunan ingredient’ler chip olarak gösterilir.
5. Emin olunanlar seçili gelir.
6. Emin olunmayanlar review ekranında onay bekler.
7. Kullanıcı onaylayınca ingredient’ler selection state’ine eklenir.
8. Sonra Tarif Bul butonuna basabilir.

### UI beklentileri
- mevcut premium / temiz mutfak tasarımı korunmalı
- kullanıcıyı yormayan review ekranı olmalı
- bulunan ingredient’ler anlaşılır chip’ler halinde görünmeli
- unresolved item’lar açıkça ayrılmalı
- “şunları buldum” hissi güçlü olmalı

---

## OpenAI Fallback Kuralları
Fallback path çok kontrollü olmalı.

### OpenAI sadece şu durumlarda kullanılsın:
- primary detection başarısız
- çok az ingredient bulundu
- çıkan sonuçların confidence’ı düşük
- resolver unresolved kaldı

### Güvenlik kuralları
- API key yalnızca backend env var’da olacak
- mobil bundle içine key koyulmayacak
- response log’ları güvenli tutulacak

### Maliyet kontrolü
- her görüntüyü fallback’e atma
- threshold ve rate control koy
- mümkün olduğunca primary path üzerinde kal
- fallback çağrıları loglansın

---

## Eski Altyapıyı Revize Etme Şartı
Bu task’ta istediklerim:
- mevcut image/photo altyapısını tara
- eski hazırlanmış sistemi analiz et
- tamamen çöpe atma
- yeni mimariye göre revize et
- gereksiz duplicate ekran / endpoint üretme

Yani bu işi “yeniden yaz” değil, “doğru mimariye oturt ve tamamla” şeklinde ele al.

---

## Tez Açısından Ölçülecek Metrikler
Bu sistem sadece ürün özelliği değil, tez katkısı da olacak.
Bu yüzden implementasyon sırasında ölçülebilir log / metrik altyapısı bırak.

Ölçmek istediğim şeyler:
- detection success rate
- canonical resolution accuracy
- unresolved rate
- user confirmation rate
- auto-selection accuracy
- text vs photo vs barcode completion time
- recipe match success after detection

Bunlar ileride benchmark / tez kısmında kullanılacak.

---

## Mevcut Ingredient Düzenine Dikkat
Aşağıdaki kritik noktaları kontrol et:
- duplicate canonical ingredient kayıtları var mı?
- alias yapısı yetersiz mi?
- Türkçe / İngilizce varyasyonlar eksik mi?
- ingredient matching’de yanlış canonical gruplamalar var mı?

Gerekirse raporla:
- hangi ingredient’lerin alias seti genişletilmeli
- hangi canonical family’ler eksik
- detection başarısını arttırmak için hangi ingredient kayıtları normalize edilmeli

Ama mevcut çalışan recipe matching mantığını bozma.

---

## Beklenen Son Ürün Davranışı
Örnek sahne:
Kullanıcı fotoğraf çekiyor ve sahnede şu malzemeler var:
- Domates
- Marul
- Tavuk Göğsü
- Salatalık
- Limon

Sistem şöyle davranmalı:
1. Bunları aday olarak tespit eder
2. `Ingredients` tablosundaki doğru kayıtlarla eşleştirir
3. resolved ingredient’leri kullanıcıya gösterir
4. kullanıcı onaylarsa bunlar selected ingredients olur
5. Tarif Bul motoru bu ingredient’lerle çalışır

---

## Kabul Kriterleri
Bu task ancak aşağıdakiler çalışıyorsa tamam sayılacak:

1. Mevcut fotoğraf altyapısı analiz edildi ve uygun şekilde revize edildi.
2. `detect-from-image` benzeri backend akışı kuruldu.
3. On-device / ücretsiz path önce çalışıyor.
4. OpenAI fallback kontrollü şekilde devreye giriyor.
5. `Ingredients` tablosu ile canonical eşleşme yapılıyor.
6. Yüksek güvenli sonuçlar otomatik seçilebiliyor.
7. Düşük güvenli sonuçlar kullanıcı onayına düşüyor.
8. Resolve edilen ingredient’ler Tarif Bul’dan önce selected state’e ekleniyor.
9. Faz 1 ingredient seti en az 20–30 yaygın ingredient ile çalışıyor.
10. Detection / mapping / confirmation log’ları tutuluyor.
11. Maliyet kontrolü ve env-based key yönetimi doğru kuruluyor.
12. Mevcut kitchen / recipe matching akışı bozulmuyor.

---

## İstediğim Çıktılar
Uygulama bittikten sonra bana şunları ver:

1. Mevcut sistem analizi
2. Hangi dosyaları değiştirdiğin
3. Yeni endpoint/service/mapping yapısı
4. Faz 1 ingredient setinin son listesi
5. `Ingredients` tablosuyla eşleşme mantığı
6. OpenAI fallback ne zaman devreye giriyor
7. Hangi env değişkenleri gerekiyor
8. Detection log metrik yapısı
9. Manuel test akışı
10. Hangi noktaların tez ölçümünde kullanılacağı

---

## Önemli Uyarılar
- Çalışan kitchen match sistemini bozma.
- Mobilde API key tutma.
- Unresolved sonuçları sessizce selected yapma.
- Faz 1’i gereksiz genişletip kalitesizleştirme.
- Önce doğruluk ve explainability, sonra genişleme.
- Çözüm backend-driven ve production-minded olsun.

---

## Son Not
Bu görevde amacım “kameradan bir şeyler görünsün” değil.
Amacım:

> fotoğraftan çıkan adayları benim ingredient sözlüğümle eşleştirip, güvenli şekilde seçilmiş malzemeye dönüştüren, sonra bunu Tarif Bul motoruna bağlayan sağlam bir sistem kurmak.

Önce analiz et, sonra mimariyi öner, sonra implement et, sonra test et.
