# Mutfak Öneri Motoru, Sonuç Sınıflandırması ve Tarif Detay Akışı – Kapsamlı Düzeltme Spesifikasyonu

## Amaç
Bu doküman, mobil uygulamadaki **Mutfak / Birleştir / Tarif Bul** akışında görülen yanlış öneri, yanlış sınıflandırma, düşük kaliteli veri sızıntısı ve eksik tarif detay deneyimini kökten düzeltmek için hazırlanmıştır.

Bu görev sadece UI makyajı değildir. Problem; **backend öneri motoru + veritabanı veri kalitesi + premium/clinic scope + mobil sonuç eşleme + web panel tarif yayınlama kuralları** birlikte ele alınarak çözülmelidir.

---

## 1. Kritik Problem Özeti

Kullanıcının paylaştığı video üzerinden görülen anlık problem:

- Kullanıcı sadece **Yumurta** ve **Ayçiçek Yağı** seçiyor.
- Sistem buna rağmen yaklaşık **20 tarif bulundu**, **18 Tam Uyum**, **3 Klinik**, **2 Eksikle** gibi mantıksız sonuçlar üretiyor.
- En üstte **"Önerilen Tarif"** olarak başlığı ve açıklaması anlamsız olan **"aa" / "aa"** içerikli düşük kaliteli kayıt çıkıyor.
- **Patatesli Omlet** gibi bir tarif, kart üstünde **0/0 zorunlu** olmasına rağmen önerilebiliyor.
- **Avokadolu Tost**, **Izgara Somon**, **Kinoa Salatası**, **Mercimek Çorbası** gibi seçilen malzemelerle doğrudan mantıklı olmayan tarifler **Tam Uyum** listesinde gösterilebiliyor.
- Sonuç kartlarında bazı tarifler yapısal olarak yayınlanmaması gereken test/demo/placeholder kayıtlar gibi duruyor.
- Kartlara tıklayınca kullanıcı **nasıl yapıldığı**, yani adım adım tarif detayını göremiyor.

Bu davranış, tezin ana iddiası ile çelişmektedir. Çünkü tezde hedeflenen şey; serbest metin/ingredient standardizasyonu sonrası **zorunlu / opsiyonel / yasaklı / alternatif** kurallarıyla çalışan, **açıklanabilir ve deterministik** bir öneri motorudur.

---

## 2. Bu Fix Neden Kritik

Bu bölüm projenin en önemli akademik ve ürünsel kısmıdır.

Eğer sistem:

- yanlış tarifleri **Tam Uyum** diye gösterirse,
- zorunlu malzeme olmadan tarif önerirse,
- premium kullanıcıya alakasız veya kirli clinic verisi sızdırırsa,
- test/demo kayıtlarını production sonucu gibi sunarsa,
- neden bu tarifi seçtiğini açıklayamazsa,

tezde anlatılan **kural tabanlı öneri motoru** fiilen çalışmıyor demektir.

Bu yüzden burada hedef sadece bug fix değil; **tez savını ispatlayan güvenilir recommendation pipeline** oluşturmaktır.

---

## 3. Tez ve Ürün Vizyonu ile Uyumlu Hedef Davranış

Sistem şu prensiplerle çalışmalıdır:

1. Kullanıcının seçtiği malzemeler önce standart ingredient kimliklerine normalize edilmelidir.
2. Tarifler düz metin gibi değil, yapılandırılmış ingredient rolleri ile değerlendirilmelidir.
3. Bir tarifin uygulanabilirliği;
   - **zorunlu malzemeler**,
   - **opsiyonel malzemeler**,
   - **yasaklı kurallar**,
   - **alternatif/substitute ilişkileri**
   üzerinden belirlenmelidir.
4. Premium kullanıcıda sadece bağlı olunan diyetisyenin erişilebilir özel havuzu kullanılmalıdır.
5. Sonuçlar sadece skora göre değil, önce **geçerlilik filtresi**, sonra **uygunluk filtresi**, sonra **sıralama** ile üretilmelidir.
6. Kullanıcı her tarif için şu soruların cevabını görebilmelidir:
   - Bu tarif neden gösterildi?
   - Hangi zorunlu malzemeler karşılandı?
   - Hangi malzeme eksik?
   - Hangi substitute kabul edildi?
   - Tarif hangi havuzdan geldi: genel mi klinik mi?
   - Nasıl yapılır?

---

## 4. Çözülmesi Gereken Kök Problemler

Claude, implementasyona başlamadan önce aşağıdaki kök nedenleri gerçek kod ve gerçek DB üzerinde doğrulamalıdır.

### 4.1 Veri Kalitesi Problemi
Muhtemel sorunlar:

- placeholder başlıklar (`aa`, `test`, `demo`, anlamsız açıklamalar)
- yapılış adımı olmayan tarifler
- hiç zorunlu ingredient tanımı olmayan tarifler
- sadece opsiyonel ingredient ile publish edilmiş tarifler
- sadece sos/yağ/baharat gibi pantry-condiment verisi içeren tarifler
- structured ingredient relations eksik ama tarif published durumda
- demo/test seed kayıtlarının sonuç havuzuna karışması

### 4.2 Sınıflandırma / Ranking Problemi
Muhtemel sorunlar:

- `Tam Uyum` hesabı, gerçekten tüm zorunlu malzemeler karşılanmadan çalışıyor olabilir
- `requiredCount = 0` olan tarifler yanlışlıkla eligible sayılıyor olabilir
- opsiyonel ingredient eşleşmesi aşırı puan veriyor olabilir
- condiment/pantry item'lar ana ingredient gibi davranıyor olabilir
- partial/full bucket ayrımı yeterince sert olmayabilir
- clinic source ile match quality aynı eksende karıştırılıyor olabilir

### 4.3 Ingredient Taxonomy / Mapping Problemi
Muhtemel sorunlar:

- alias/fuzzy eşleşme fazla gevşek
- ingredient family / substitute ilişkileri yanlış veya aşırı geniş
- "yumurta var" diye alakasız kahvaltılık tarifler tam uyuma taşınıyor
- "ayçiçek yağı" gibi yardımcı malzeme var diye tarif uygulanabilir sanılıyor

### 4.4 Premium / Clinic Scope Problemi
Muhtemel sorunlar:

- clinic tarifleri ile general tarifler yanlış harmanlanıyor
- başka havuzların verisi premium kullanıcıya sızıyor
- `Klinik` sekmesi sadece source filtresi olması gerekirken kalite filtresi gibi davranıyor
- `activeDietitianId` scope’u tam uygulanmıyor olabilir

### 4.5 Mobile Mapping Problemi
Muhtemel sorunlar:

- backend zaten sorunlu ama mobil de ek olarak yanlış bucket mapping yapıyor olabilir
- sayılar (`18 Tam Uyum`, `3 Klinik`, `2 Eksikle`) filtrelenmemiş ham veriden üretiliyor olabilir
- `Top Recommendation` fallback ile ilk gelen kirli kaydı gösteriyor olabilir
- detail page / route yok

---

## 5. Zorunlu İş Kuralları (Non-Negotiable)

Aşağıdaki kurallar backend’de net şekilde uygulanmalıdır.

### 5.1 Production Recommendation Pool Eligibility
Bir tarif, recommendation havuzuna hiç girebilmek için en azından şu koşulları sağlamalıdır:

- published / active durumda olmalı
- hidden / archived / deleted / demo / test / seed-placeholder olmamalı
- anlamlı bir başlığı olmalı
- anlamlı bir açıklaması veya kısa özeti olmalı
- en az 1 adet yapılış adımı olmalı
- structured ingredient relations eksiksiz olmalı
- **en az 1 adet gerçek zorunlu ingredient** içermeli
- sadece condiment / pantry yardımcıları ile yayınlanmış olmamalı

> Geçici ama güvenli MVP kuralı: **`requiredCount = 0` olan hiçbir tarif recommendation sonucuna girmemeli.**

### 5.2 Condiment Guardrail
Aşağıdaki gibi yardımcı ürünler tek başlarına veya yalnızca birbirleriyle birlikte tarifi `Tam Uyum` yapmamalıdır:

- yağlar
- tuz
- karabiber
- pul biber
- baharatlar
- soslar
- sirke
- limon suyu / küçük tamamlayıcılar

Bu tür ingredient'ler puana küçük katkı verebilir, ancak **ana uygulanabilirlik kanıtı** olamaz.

### 5.3 Tam Uyum Tanımı
Bir tarif ancak şu şartlarla `Tam Uyum` olabilir:

- yasaklı kurala takılmıyor olmalı
- tüm zorunlu ingredient grupları karşılanmış olmalı
- substitute ile karşılanan grup varsa bu açıklanmalı
- `requiredCount >= 1` olmalı
- en az bir **non-condiment / gerçek ana ingredient** eşleşmesi olmalı
- recipe quality validation geçmiş olmalı

### 5.4 Eksikle Tanımı
Bir tarif ancak şu durumda `Eksikle` veya `Kısmi Uyum` olabilir:

- tüm sonuçlar içinden gerçekten uygulanabilir adaya yakın olmalı
- tam uyum değil, ama eksikler net ve sınırlı olmalı
- eksik olan malzemeler **zorunlu** eksikler olarak açıkça listelenmeli
- substitute yoksa bu da açıkça belirtilmeli
- çok fazla zorunlu eksik varsa tarif hiç gösterilmemeli

Önerilen kural:

- maksimum 1 kritik zorunlu eksik veya tanımlı küçük eşik
- 2’den fazla ana zorunlu eksik varsa elensin

### 5.5 Klinik Tanımı
`Klinik` bir kalite seviyesi değil, bir **source / erişim kökeni**dir.

Yani klinik tarif:

- aynı zamanda `Tam Uyum` olabilir
- aynı zamanda `Eksikle` olabilir

Bu yüzden backend ve mobile modelinde şu iki eksen ayrılmalıdır:

1. **Source**: `general` | `clinic`
2. **Match Status**: `full_match` | `one_missing` | `partial` | `rejected`

UI’da `Klinik` sekmesi korunabilir, ama orada gösterilen tüm tarifler yine kendi match status bilgisiyle gelmelidir.

---

## 6. Backend Tarafında Yapılacaklar

### 6.1 Recommendation Pipeline’ı 3 Aşamalı Kur

#### Aşama A — Candidate Pool
Gerçek erişilebilir tarifleri topla:

- premium kullanıcı ise önce bağlı diyetisyenin erişilebilir clinic tarifleri
- gerekiyorsa ayrıca erişilebilir public tarifler
- scope, visibility ve production eligibility uygulanmış halde

#### Aşama B — Rule Evaluation
Her tarif için:

- normalized selected ingredient IDs
- ingredient families
- substitute mapping
- prohibited checks
- required coverage
- optional coverage
- condiment-only detection
- data quality validity

hesaplanmalı.

#### Aşama C — Classification + Ranking
Her aday için aşağıdaki alanlar üretilmeli:

- `sourceType`
- `matchStatus`
- `requiredTotal`
- `requiredMatched`
- `requiredMissing`
- `optionalMatched`
- `optionalTotal`
- `substituteMatches`
- `blockedReasons`
- `explanation`
- `qualityFlags`
- `score`

Sıralama **yalnız skor** ile değil, önce kalite ve sınıflandırma önceliği ile yapılmalı.

Önerilen öncelik:

1. valid full match clinic
2. valid full match general
3. valid one-missing clinic
4. valid one-missing general
5. diğerleri elensin veya ayrı debug modunda gösterilsin

### 6.2 Öneri Sonucu Contract’ını Açıklanabilir Yap
Response sadece kart dolduracak kadar yüzeysel olmamalı.

Her recipe result için şu bilgiler dönmeli:

- recipeId
- title
- shortDescription
- sourceType (`clinic` / `general`)
- matchStatus (`full_match`, `one_missing`, `partial`)
- score
- required summary
- optional summary
- missing ingredient list
- substitute usage list
- why recommended text
- quality warnings (debug/dev için)
- detail availability

### 6.3 Zero-Required ve Placeholder Cleanup
Aşağıdaki sınıfları sistematik olarak tespit et:

- requiredCount = 0
- no steps
- title in (`aa`, `test`, `demo`, `sample`, `verified demo`, vb.)
- description boş veya placeholder
- ingredient relations yok
- hidden olması gereken demo seed kayıtları

Bunları:

- fix et,
- mümkün değilse publish dışına çıkar,
- recommendation havuzundan kesin dışla.

### 6.4 Ingredient Category Guardrail
Ingredient dictionary veya taxonomy’de ingredient’leri en azından aşağıdaki kategori mantığıyla sınıflandır:

- protein
- carb
- vegetable
- fruit
- dairy
- fat/oil
- condiment/spice
- sauce
- beverage
- other

Scoring ve tam uyum kurallarında `fat/oil`, `condiment/spice`, `sauce` kategorileri tek başına ana coverage olarak sayılmamalı.

### 6.5 Logging / Benchmark / Debug
Tez için kritik: recommendation engine açıklanabilir log üretmeli.

Dev log örneği her tarif için şunları gösterebilmeli:

- recipe title / id
- source type
- required coverage
- missing required ingredients
- optional matches
- substitute usage
- blocked reasons
- invalid quality reasons
- final classification
- final score

Ayrıca benchmark senaryoları ekle:

- `Yumurta + Ayçiçek Yağı`
- `Ekmek + Avokado + Yumurta`
- `Domates + Tam Buğday Makarna + Ayçiçek Yağı + Karabiber + Kırmızı Pul Biber`
- clinic-only private recipe visibility
- placeholder/demo data exclusion

---

## 7. Mobile Uygulamada Yapılacaklar

### 7.1 Sonuç Ekranının Semantik Düzeltmesi
Mevcut sonuç ekranı kullanıcıya aşırı güven veren ama yanlış bilgi gösteren bir yapı üretiyor.

Düzelt:

- `Top Recommendation` yalnızca gerçekten valid ve explainable sonuçtan oluşsun
- placeholder / kirli veri asla hero card’da görünmesin
- sayılar (`Tam Uyum`, `Eksikle`, `Klinik`) yalnızca **final filtered valid result set** üzerinden hesaplanmalı
- `Klinik` sekmesi source filtresi olarak çalışsın
- kart üzerinde hem source hem match durumu ayrı gösterilsin

Örnek badge yapısı:

- `Klinik`
- `Tam Uyum`
- `Eksik: Tereyağı`
- `Substitute: Yoğurt yerine Kefir`

### 7.2 Recipe Card İyileştirmeleri
Kart üzerinde minimum şu alanlar olsun:

- başlık
- kısa açıklama
- source badge (`Klinik` / `Genel`)
- match badge (`Tam Uyum` / `1 Eksik` / `Kısmi Uyum`)
- score
- required summary (`2/3 zorunlu`, `1 eksik`)
- neden önerildi kısa açıklaması

### 7.3 Recipe Detail Screen (YENİ / ZORUNLU)
Kullanıcı karta tıklayınca detay ekranı açılmalı.

Bu ekran minimum şu bölümlerden oluşmalı:

1. Tarif başlığı
2. Klinik / Genel etiketi
3. Hazırlama süresi / öğün tipi / etiketler
4. Neden önerildi?
5. Karşılanan zorunlu malzemeler
6. Eksik malzemeler
7. Kullanılan substitute varsa listesi
8. Gerekli tüm malzemeler listesi
9. **Nasıl yapılır?** → adım adım instructions
10. İsteğe bağlı besin özeti
11. `Yaptım / Yedim` veya `Planıma Ekle` gibi aksiyonlar

### 7.4 Empty / Error / No-Result Durumları
Mobil uygulama şu durumları ayırmalı:

- backend error
- no valid result
- only partial weak matches
- clinic data unavailable

Özellikle `Yumurta + Ayçiçek Yağı` gibi örnekte sistem mantıklı sonuç üretemiyorsa:

- sahte `Tam Uyum` göstermemeli
- bunun yerine dürüstçe daha iyi ingredient seçimi önermeli
- hızlı ekle paketleri veya ek malzeme önerileri sunmalı

### 7.5 UI / UX Tasarım Düzeltmeleri
Tasarım dokümanına uygun olacak şekilde:

- zemin: `#F9F7F2`
- primary: `#4A7C59`
- action green: `#2F5233`
- warning/upsell: `#FF8C61`
- badge ve chip sistemi sade ve tutarlı olmalı
- kartlarda gereksiz kalın gölge azaltılmalı
- bilgi hiyerarşisi düzeltilmeli
- sonuç ekranında kullanıcıya önce **güven**, sonra **sebep**, sonra **aksiyon** verilmelidir

---

## 8. Web Panelde Yapılacaklar

### 8.1 Recipe Editor Publish Gate
Diyetisyen veya test kullanıcısı şu tip tarifi publish edememeli:

- başlık anlamsızsa
- açıklama boşsa
- yapılış adımları yoksa
- required ingredient yoksa
- sadece opsiyonel ingredient girilmişse
- sadece condiment/yardımcı ürün girilmişse

Publish öncesi validation zorunlu olsun.

### 8.2 Structured Ingredient Authoring Güçlendir
Her ingredient satırı için net rol zorunlu olsun:

- mandatory
- optional
- substitute relation
- prohibited / dietary rule mapping

Ayrıca ingredient category preview veya warning ver:

- “Bu tarifte hiç ana zorunlu ingredient yok.”
- “Bu tarif sadece yardımcı malzemeler içeriyor.”
- “Bu haliyle recommendation pool’a giremez.”

### 8.3 Tarif Detayı İçeriği Zorunlu Hale Getir
Web panel recipe formunda şu alanlar zorunlu hale gelsin:

- title
- summary
- instructions[]
- ingredient relations
- meal type
- visibility
- source scope

### 8.4 Preview / Simulate Recommendation
Çok önemli geliştirme:

Tarif editöründe veya ayrı debug alanında bir `simulate ingredients` preview ekle.

Diyetisyen şu testi panelde görebilsin:

- “Yumurta + Ayçiçek Yağı seçilirse bu tarif tam uyum mu olur, eksikle mi olur, hiç görünmemeli mi?”

Bu, saçma publish edilen tariflerin canlıya çıkmadan yakalanmasını sağlar.

---

## 9. Veri Temizliği ve Migration Planı

Claude sadece runtime kodu düzeltip bırakmamalı; mevcut veri kirliyse onu da temizlemeli.

Yapılması gerekenler:

1. invalid tarifleri tespit et
2. hidden/demo/test olanları production recommendation pool dışına çıkar
3. zero-required tarifleri audit et
4. placeholder başlıkları audit et
5. steps olmayan tarifleri audit et
6. clinic/private tarif scope’unu audit et
7. gerekli migration / seed düzeltmelerini ekle

Gerekirse bir tek-seferlik audit script / command / dev seed cleaner yaz.

---

## 10. Kabul Kriterleri (Acceptance Criteria)

### AC-01 — Yumurta + Ayçiçek Yağı Senaryosu
Bu seçime göre sistem:

- anlamsız `Top Recommendation` göstermemeli
- `aa` gibi placeholder recipe göstermemeli
- requiredCount=0 olan tarifleri göstermemeli
- alakasız tarifleri `Tam Uyum` göstermemeli
- eğer gerçek anlamda güçlü sonuç yoksa bunu dürüstçe ifade etmeli

### AC-02 — Avokado + Ekmek + Yumurta Senaryosu
`Avokadolu Yumurta Tostu` benzeri yapılandırılmış tarif varsa:

- doğru source scope içinde bulunmalı
- `Tam Uyum` veya uygun bucket’ta görünmeli
- detail ekranı açılmalı
- instructions görünmeli

### AC-03 — Klinik İzolasyonu
Premium kullanıcı yalnız bağlı olduğu diyetisyenin erişilebilir clinic tariflerini görmeli.

### AC-04 — Demo / Placeholder Exclusion
`aa`, `test`, `demo`, `verified demo` gibi kirli kayıtlar sonuç ekranında görünmemeli.

### AC-05 — Explainability
Her gösterilen tarif için kullanıcıya ve debug log’a neden gösterildiği açıklanabilmeli.

### AC-06 — UI Tutarlılığı
`Tam Uyum`, `Eksikle`, `Klinik` sayaçları ve sekmeleri aynı valid filtered data set üzerinden beslenmeli.

### AC-07 — Detail Experience
Recipe card’a tıklayınca tarif detay ekranı açılmalı ve yapılış adımları görünmeli.

---

## 11. Claude’un Teslim Etmesi Gereken Çıktılar

Claude görev sonunda şunları vermeli:

1. Değişen dosyalar listesi
2. Kök neden analizi
3. Hangi invalid data kurallarının eklendiği
4. Hangi backend sınıflandırma kurallarının sertleştirildiği
5. Hangi mobile ekranlarının değiştiği
6. Hangi web panel validation’larının eklendiği
7. Hangi migration / seed düzeltmesinin yapıldığı
8. Hangi testlerin eklendiği
9. Gerçek manuel test adımları
10. Hâlâ veri tarafında elle düzeltilecek şey kalmışsa açık liste

---

## 12. Claude İçin Uygulama Talimatı

Bu görevde sadece testleri yeşile çekmek yeterli değildir.

Claude şunları yapmalıdır:

- gerçek code path’leri incelemek
- gerçek database / seed verisini doğrulamak
- gerçek runtime sonucu düzeltmek
- mobil sonuç ekranını semantik olarak düzeltmek
- recipe detail flow eklemek
- web panel publish gate eklemek
- recommendation engine’i tez mantığına uygun, deterministik ve açıklanabilir hale getirmek

**Yarım çözüm kabul edilmez.**

- sadece ranking’i değiştirip kirli veriyi bırakma
- sadece mobile UI düzeltip backend’i bırakma
- sadece tests fix yapıp runtime davranışı bozuk bırakma
- sadece clinic tabını makyajlayıp source/match ayrımını düzeltmeme

Bu iş; **backend + mobile + web panel + data cleanup + explainability** birlikte kapanmalıdır.
