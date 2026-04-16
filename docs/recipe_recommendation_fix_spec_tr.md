# Tarif Öneri Motoru Düzeltme Spesifikasyonu

## Amaç
Bu doküman, premium kullanıcılarda seçilen malzemelere göre dönen tarif sonuçlarının anlamsız, dağınık ve güven kaybettiren şekilde gelmesini kalıcı olarak düzeltmek için hazırlanmıştır. Hedef; **çok katmanlı malzeme standardizasyonu + kural tabanlı tarif değerlendirmesi + premium/diyetisyen izolasyonu + açıklanabilir sıralama** ile çalışan güvenilir bir öneri sistemi oluşturmaktır.

Bu düzeltme yalnızca UI makyajı değildir. Asıl çözüm backend eşleştirme motoru, veri modeli, seed/demo veri filtreleme, premium erişim izolasyonu ve mobil sonuç sözleşmesinin birlikte toparlanmasıdır.

---

## Bu Dokümanın Dayandığı Kaynaklar
Bu spesifikasyon şu kaynaklarla uyumlu hazırlanmıştır:

1. `bitirme_tezi_on_bilgilendirme.pdf`
   - Çok katmanlı normalizasyon (exact / alias / fuzzy / LLM fallback)
   - ingredient taxonomy (aile, varyant, alternatif)
   - kural tabanlı öneri motoru (zorunlu / opsiyonel / yasaklı / alternatif)
   - benchmark ve log ihtiyacı

2. `dökümantasyonsom.docx`
   - premium akış, `activeDietitianId`, `Access Key`, özel tarif havuzu
   - private/public recipe ayrımı
   - Mutfak akışı, freemium mimari, klinik odaklı deneyim

3. `Diyet_Uyum_Master_Planı.pdf`
   - premium kullanıcı için diyetisyenin özel havuzunun ve klinik mantığın öne çıkması
   - “Birleştir” deneyiminin güvenilir ve motive edici sonuç vermesi

4. Mobil entegrasyon referansı olarak incelenen mevcut dosyalar
   - `alternative.ts`
   - `diet-plans.ts`
   - `client-state.ts`
   - `AuthContext.tsx`
   - `IngredientSearch.tsx`
   - `AlternativeResultScreen.tsx`
   - `DecisionCard.tsx`
   - `routes.ts`
   - `api.ts`
   - `auth.ts`

Not: Mobil tarafta premium state zaten `/api/client/me` üzerinden okunuyor ve aktivasyon `/api/client/activate-premium` ile yapılıyor. Yeni öneri düzeltmesi bu mantığı bozmamalı.

---

## Gözlenen Somut Problem
Premium kullanıcı **Selin Aydın**, **Aydın Sağlık Merkezi**’ne bağlı durumda. Kullanıcı şu malzemeleri seçiyor:

- Domates
- Tam Buğday Makarna
- Ayçiçek Yağı
- Kırmızı Pul Biber
- Karabiber

Buna rağmen ekranda aşağıdaki gibi anlamsız sonuçlar geliyor:

### Tam Uyum bölümünde görünen ama açıkça yanlış olan örnekler
- Avokadolu Tost
- Izgara Somon
- Proteinli Tavuk Pilav
- Sebzeli Makarna

### Eksikle bölümünde görünen ama eksik mantığı şüpheli olan örnekler
- Tavuk Salatası
- Sebzeli Omlet

### Klinik bölümünde görünen ama alakasız / sızıntı ihtimali olan örnekler
- Patatesli Omlet
- Verified Demo Pasta

Bu sonuç kümesi aşağıdaki güven sorunlarını doğuruyor:

1. **Tam Uyum etiketi güven vermiyor.** Kullanıcının seçtiği malzemelerle somon, tavuk, avokado, pilav veya patates bazlı tariflerin “tam uyum” gelmesi kabul edilemez.
2. **Eksikle açıklaması deterministik değil.** “Eksikle” etiketi bir tarifin gerçekten sadece tek kritik eksiği mi var, yoksa birden fazla zorunlu eksik mi var anlaşılmıyor.
3. **Klinik sekmesi anlamsız öneri listeliyor.** Klinik tarifler sadece o diyetisyene ait diye gelmemeli; seçilen malzemelerle anlamlı ilişki kurmalı.
4. **Demo / seed veri üretime sızmış olabilir.** “Verified Demo Pasta” gibi kayıtların gerçek kullanıcı deneyimine girmesi kalite sorunudur.
5. **Kaynak karmaşası olabilir.** Private clinic tarifleri, public tarifler, demo seed tarifleri ve muhtemelen test verileri aynı havuzda zayıf filtreleme ile dönüyor olabilir.
6. **Sistem metin benzerliğini fazla, malzeme rolünü az kullanıyor olabilir.** Tezde hedeflenen kural tabanlı yaklaşımın yerine gevşek skor mantığı devrede olabilir.

---

## Bu Problemin Arkasındaki Muhtemel Kök Nedenler

### 1. Tarifler metin bazlı veya gevşek benzerlik bazlı eşleniyor olabilir
Tarif adı / açıklaması / genel ingredient listesi üstünden puan veriliyorsa, zorunlu malzeme yokken bile tarif yukarı çıkabilir.

### 2. Zorunlu malzeme kontrolü skordan önce “hard gate” olarak uygulanmıyor olabilir
Doğru akış:
- Önce yasak kontrolü
- Sonra zorunlu malzeme kontrolü
- Sonra opsiyonel puanlama

Eğer sistem doğrudan skor veriyorsa, çok sayıda opsiyonel eşleşme veya genel kategori eşleşmesi sonucu yanlış etiket oluşur.

### 3. “Tam Uyum” ve “Eksikle” etiketleri gerçek iş kuralından değil, yüzdelik eşikten türetiliyor olabilir
Örneğin `%70 üstü tam uyum`, `%30 üstü eksikle` gibi yüzdelik tabanlı etiketler kullanılıyorsa anlamsal doğruluk bozulur. “Tam Uyum” semantik bir karardır; eşik bazlı kozmetik etiket olmamalıdır.

### 4. Premium/clinic tarif havuzu doğru scope edilmemiş olabilir
Premium kullanıcı için sonuç havuzu önce **linked dietitian / activeDietitianId** ile daraltılmalı, sonra gerekirse public fallback uygulanmalıdır. Aksi halde başka veri kaynakları karışır.

### 5. Klinik sekmesi yanlış modellenmiş olabilir
“Klinik” ayrı bir eşleşme tipi değil, **kaynak tipi** olmalıdır.
Doğru model:
- `matchStatus`: `FULL_MATCH | ONE_MISSING | NOT_ELIGIBLE`
- `sourceType`: `CLINIC | PUBLIC`

UI’da “Klinik” tabı, `sourceType = CLINIC` olan ve **gerçekten uygun bulunan** tarifleri göstermelidir. Sadece kliniğe ait diye alakasız her tarif gelmemelidir.

### 6. Demo/test/seed tarifler üretime filtrelenmeden dahil ediliyor olabilir
`Verified Demo Pasta` gibi kayıtlar ya `isDemo`, `isSeedData`, `isHiddenFromProduction`, `environment`, `sourceType` vb. alanlarla filtrelenmeli ya da üretim kullanıcı akışından çıkarılmalıdır.

### 7. Malzeme sözlüğü ve aile-varyant ilişkisi yeterince kullanılmıyor olabilir
Örneğin:
- “Tam Buğday Makarna” -> `PASTA` ailesi
- “Domates” -> `TOMATO` ailesi
- “Ayçiçek Yağı” -> `VEGETABLE_OIL` veya `OIL` ailesi
- baharatlar -> çoğunlukla opsiyonel / bonus katkı

Bu aile ilişkileri doğru kullanılmazsa yanlış tarifler puanlanır.

---

## Non-Negotiable Beklenen Davranış

### 1. Premium kullanıcıda kaynak izolasyonu
Premium kullanıcı için aday tarif havuzu şu sırayla oluşturulmalı:

1. `activeDietitianId` ile eşleşen **aktif klinik/private tarifler**
2. Ürün kararı gerektiriyorsa opsiyonel olarak public tarif fallback
3. Demo/test/internal seed kayıtları hariç

### 2. Tam Uyum tanımı
Bir tarif **Tam Uyum** ise:
- yasaklı çakışma olmayacak
- tüm zorunlu malzemeler seçilmiş olacak **veya** geçerli substitute ile karşılanmış olacak
- tarifin “tam uyum” etiketi salt skorla değil, kural sonucu ile verilecek

### 3. Eksikle tanımı
Bir tarif **Eksikle** ise:
- yasaklı çakışma olmayacak
- tam olarak **1 adet zorunlu ingredient family** eksik olacak
- eksik olan canonical ingredient/family açıkça listelenecek
- varsa uygun substitute önerisi gösterilecek

### 4. Uygun değil tanımı
Aşağıdaki durumlarda tarif listeye hiç girmemeli veya en fazla debug/log seviyesinde kalmalı:
- 2 veya daha fazla zorunlu family eksikse
- yasaklı malzeme çakışması varsa
- clinic dışı ve istenmeyen source’tan geliyorsa
- demo/test tarif ise

### 5. Klinik sekmesi tanımı
“Klinik” sekmesi:
- yalnızca `sourceType = CLINIC` olan tarifleri göstermeli
- ama bunların da en azından **Full Match** veya **One Missing** olması gerekir
- sadece kliniğe ait olduğu için alakasız tarif basılmamalı

### 6. Açıklanabilir sonuç
Her sonuç şu alanları taşımalı:
- `matchedMandatory`
- `matchedOptional`
- `missingMandatory`
- `usedSubstitutes`
- `prohibitedHits`
- `matchStatus`
- `sourceType`
- `score`
- `explanation`

Bu olmadan UI güven üretmez.

---

## Verilen Sepet İçin Beklenen Mantık
Seçilen malzemeler:

- Domates
- Tam Buğday Makarna
- Ayçiçek Yağı
- Kırmızı Pul Biber
- Karabiber

### Bu sepetle mantıken mümkün davranış
Aşağıdaki tarz tarifler yukarı çıkabilir:
- sebzeli makarna / domatesli makarna / klinik pasta tarifi (yalnızca gerçekten makarna + domates + yağ ile yapılabiliyorsa)
- baharatları opsiyonel veya bonus kabul eden tarifler

### Bu sepetle kesinlikle “Tam Uyum” olmaması gereken örnekler
- Avokadolu Tost
- Izgara Somon
- Proteinli Tavuk Pilav
- Patatesli Omlet

Sebep: bu tariflerin isimlerinden bile en az bir veya birden fazla güçlü zorunlu ana malzemenin seçilmediği anlaşılıyor.

### Bu sepetle “Eksikle” olması için gerekli koşul
Örneğin bir tarifin zorunlu ingredient family seti şöyleyse:
- makarna
- domates
- yağ
- tavuk

Kullanıcı seçtiği sepette yalnızca `tavuk` eksikse bu tarif **Eksikle** olabilir.
Ama hem `tavuk` hem başka zorunlu malzeme eksikse “Eksikle” etiketi yanlıştır.

### Klinik sekmesi için doğru beklenti
- Klinikte bu sepete anlamlı uyan tarif varsa gelsin
- Yoksa boş state gösterilsin: `Seçtiğin malzemelerle klinik tarif bulunamadı`
- Alakasız klinik tarifler sırf sahiplik yüzünden basılmasın

---

## Hedef Veri Modeli
Var olan yapıya adapte edilerek şu mantık korunmalı veya eksikse eklenmelidir.

### Ingredient
- `id`
- `canonicalName`
- `normalizedName`
- `aliases[]`
- `familyId`
- `parentIngredientId` (opsiyonel)
- `isActive`
- `searchTokens[]`

### IngredientFamily
- `id`
- `name`
- `normalizedName`
- `allowsGenericMatch` (örn. `pasta`, `oil` gibi aileler için)

### IngredientSubstitutionRule
- `id`
- `fromIngredientId` veya `fromFamilyId`
- `toIngredientId` veya `toFamilyId`
- `strength` (`EXACT_EQUIVALENT`, `ACCEPTABLE_SUBSTITUTE`, `WEAK_SUBSTITUTE`)
- `isActive`

### Recipe
- `id`
- `name`
- `description`
- `dietitianId` (nullable public recipes için)
- `isPublic`
- `isActive`
- `isDraft`
- `isDemo`
- `isSeedData`
- `isHiddenFromProduction`
- `sourceType` (`CLINIC`, `PUBLIC`, `INTERNAL_DEMO`)
- `priorityBoost` (opsiyonel)

### RecipeIngredientRule
- `id`
- `recipeId`
- `ingredientId` veya `ingredientFamilyId`
- `role` (`MANDATORY`, `OPTIONAL`, `PROHIBITED`)
- `allowSubstitution`
- `displayOrder`
- `notes`

Not: Tarifler “serbest text ingredient list” ile değil, mümkün olduğunca bu yapılandırılmış tablo üzerinden değerlendirilmelidir.

---

## Hedef Algoritma

## A. Kullanıcı sepetini normalize et
Kullanıcı seçtiği ingredient’leri önce canonical/family seviyesine çevir:

1. exact canonical match
2. alias match
3. fuzzy match
4. LLM fallback (yalnızca önceki üç katman başarısızsa ve sınırlı aday listesiyle)

Her seçim için log tut:
- input text
- matched ingredient id
- matched family id
- layer used
- confidence
- ambiguous mi

## B. Aday tarif havuzunu oluştur
Premium kullanıcı için:

```text
candidateRecipes =
  active private/clinic recipes where recipe.dietitianId == activeDietitianId
  UNION optional public recipes (only if product rules allow)
```

Ama şu kayıtlar hariç:

```text
isActive = false
isDraft = true
isDemo = true
isSeedData = true
isHiddenFromProduction = true
sourceType = INTERNAL_DEMO
```

## C. Her tarif için deterministic evaluation çalıştır

### 1. Yasak kontrolü
Tarifteki `PROHIBITED` rule sepette varsa -> `NOT_ELIGIBLE`

### 2. Zorunlu kontrolü
Her `MANDATORY` ingredient/family için bak:
- exact ingredient var mı?
- aynı family’den uygun ingredient var mı?
- allowSubstitution varsa substitute var mı?

Sonuç:
- `missingMandatoryCount`
- `missingMandatoryFamilies[]`
- `usedSubstitutes[]`

### 3. Hard decision
- `missingMandatoryCount == 0` => aday `FULL_MATCH`
- `missingMandatoryCount == 1` => aday `ONE_MISSING`
- `missingMandatoryCount >= 2` => `NOT_ELIGIBLE`

### 4. Opsiyonel skor
Sadece FULL_MATCH ve ONE_MISSING adaylar için ek puan ver:
- optional ingredient matched
- stronger normalization confidence
- clinic source bonus
- recipe priority boost
- maybe plan relevance bonus (gelecekte)

Ama bu opsiyonel skor **hard decision**’ı override edemez.

---

## Önerilen Sıralama Formülü
Aşağıdaki gibi deterministik ve açıklanabilir bir skor kullanılabilir:

```text
baseScore = 0

if matchStatus == FULL_MATCH => baseScore += 1000
if matchStatus == ONE_MISSING => baseScore += 700

baseScore += matchedMandatoryCount * 100
baseScore += matchedOptionalCount * 20
baseScore += exactIngredientMatchCount * 15
baseScore += familyMatchCount * 10
baseScore += acceptableSubstituteCount * 5
baseScore += clinicSource ? 15 : 0
baseScore += recipe.priorityBoost

baseScore -= weakSubstituteCount * 10
baseScore -= missingMandatoryCount * 200
```

### Kritik not
- `FULL_MATCH` ile `ONE_MISSING` birbirine karışmamalı
- clinic bonus küçük olmalı; alakasız klinik tarif tam uyum public tariften daha üste çıkmamalı
- isim/açıklama text similarity yardımcı olabilir ama asla ana karar verici olmamalı

---

## API Response Sözleşmesi
Claude mevcut endpoint’i koruyabiliyorsa korusun; gerekirse versiyonlayabilir. Ama UI’nın güvenilir çalışması için response şu mantığı taşımalı:

```json
{
  "requestContext": {
    "clientId": "...",
    "activeDietitianId": "...",
    "sourceScope": ["CLINIC", "PUBLIC"],
    "normalizedBasket": [
      {
        "input": "Domates",
        "ingredientId": "...",
        "familyId": "TOMATO",
        "canonicalName": "Domates",
        "layer": "EXACT"
      }
    ]
  },
  "summary": {
    "total": 0,
    "fullMatchCount": 0,
    "oneMissingCount": 0,
    "clinicCount": 0
  },
  "results": [
    {
      "recipeId": "...",
      "recipeName": "Sebzeli Makarna",
      "sourceType": "CLINIC",
      "matchStatus": "FULL_MATCH",
      "score": 1170,
      "matchedMandatory": ["Tam Buğday Makarna", "Domates"],
      "matchedOptional": ["Karabiber", "Kırmızı Pul Biber"],
      "missingMandatory": [],
      "usedSubstitutes": [],
      "prohibitedHits": [],
      "explanation": "Tüm zorunlu malzemeler hazır. Baharatlar opsiyonel katkı sağlıyor.",
      "badges": ["Klinik", "Tam Uyum", "Hazır"]
    }
  ]
}
```

### UI tarafı için kritik kural
UI kategori üretmemeli; backend’den gelen `matchStatus` ve `sourceType` üstünden sekme filtrelemeli.

---

## Mobil UI Davranış Kuralları

### Sekmeler
- `Tümü`
- `Tam Uyum`
- `Eksikle`
- `Klinik`

### Filtre kuralları
- `Tam Uyum` -> `matchStatus == FULL_MATCH`
- `Eksikle` -> `matchStatus == ONE_MISSING`
- `Klinik` -> `sourceType == CLINIC && matchStatus in (FULL_MATCH, ONE_MISSING)`

### Kart üzerinde zorunlu alanlar
- match badge
- source badge
- score veya readiness indicator
- kısa explanation
- `Eksikle` ise eksik ingredient chip’i
- `Substitute` kullanıldıysa açıkça göster

### Boş state kuralları
- klinik tarif yoksa boş state göster
- demo/test tarif hiçbir durumda görünmemeli
- tüm sonuçlar elendiyse kullanıcıya nedenini söyle
  - `Bu malzemelerle uygun tarif bulunamadı`
  - `1-2 malzeme daha eklersen sonuçlar genişleyebilir`

---

## Web Panel İçin Gerekli Düzeltmeler
Sorun yalnızca runtime matching ile değil, dietitian recipe entry kalitesi ile de ilgilidir.

### Tarif oluşturma/edit ekranı
- ingredient seçimi mutlaka dictionary/autocomplete ile olmalı
- free text ingredient kaydı mümkün olduğunca kaldırılmalı
- her ingredient için `MANDATORY / OPTIONAL / PROHIBITED` rolü zorunlu seçilmeli
- `allowSubstitution` açık/kapalı kontrolü olmalı
- tarif clinic/public/source alanları açık ve doğrulanmış olmalı
- `demo/test/internal` kayıtları üretim datasından ayrılmalı

### Validation
- en az 1 mandatory ingredient olmadan tarif yayınlanmamalı
- `PROHIBITED` ile `MANDATORY` aynı ingredient family’de çakışmamalı
- private tarifte `dietitianId` zorunlu olmalı
- demo recipe production görünürlüğü false olmalı

---

## Loglama ve Benchmark
Tez hedefleriyle uyumlu olarak bu akış ölçülebilir olmalı.

### Normalization log
- input text
- chosen canonical ingredient
- layer used
- confidence
- ambiguous flag
- fallback used

### Recommendation log
- client id
- active dietitian id
- selected basket
- normalized basket
- returned recipe ids
- each result’s status / score / missing mandatory
- filtered out reasons

### İzlenecek metrikler
- exact / alias / fuzzy / llm fallback oranı
- unmatched oranı
- ambiguous oranı
- full match precision
- one missing precision
- yanlış öneri oranı
- clinic isolation doğruluğu
- demo leakage sayısı (hedef: 0)

---

## SQL / Query Kuralları İçin Güvenli Yaklaşım
Şema birebir farklı olabilir; ama mantık şu olmalı:

```sql
SELECT r.*
FROM recipes r
WHERE r.is_active = TRUE
  AND COALESCE(r.is_draft, FALSE) = FALSE
  AND COALESCE(r.is_demo, FALSE) = FALSE
  AND COALESCE(r.is_seed_data, FALSE) = FALSE
  AND COALESCE(r.is_hidden_from_production, FALSE) = FALSE
  AND (
        r.dietitian_id = @activeDietitianId
        OR (r.is_public = TRUE AND @includePublicFallback = TRUE)
      );
```

Ama asıl kritik kısım SQL’den sonra uygulama katmanında deterministic evaluator’dur.

---

## Pseudocode

```ts
function recommendRecipesForPremiumClient(input) {
  const client = getClient(input.clientId);
  assert(client.isPremium === true);
  assert(client.activeDietitianId != null);

  const normalizedBasket = normalizeBasket(input.selectedIngredients);

  const candidateRecipes = getCandidateRecipes({
    activeDietitianId: client.activeDietitianId,
    includePublicFallback: true,
    excludeDemo: true,
  });

  const evaluated = [];

  for (const recipe of candidateRecipes) {
    const evaluation = evaluateRecipeAgainstBasket(recipe, normalizedBasket, client.profileRules);

    if (evaluation.matchStatus === 'NOT_ELIGIBLE') {
      logFilteredOut(recipe.id, evaluation.reason);
      continue;
    }

    const score = computeScore(recipe, evaluation);

    evaluated.push({
      recipe,
      sourceType: recipe.dietitianId ? 'CLINIC' : 'PUBLIC',
      matchStatus: evaluation.matchStatus,
      score,
      matchedMandatory: evaluation.matchedMandatory,
      matchedOptional: evaluation.matchedOptional,
      missingMandatory: evaluation.missingMandatory,
      usedSubstitutes: evaluation.usedSubstitutes,
      prohibitedHits: evaluation.prohibitedHits,
      explanation: buildExplanation(evaluation),
    });
  }

  evaluated.sort(sortByStatusThenScoreDescThenName);

  return {
    summary: buildSummary(evaluated),
    results: dedupeAndLimit(evaluated),
  };
}
```

---

## Test Planı

## 1. Unit test – normalization
- `domates` -> Domates
- `domatess` -> Domates (fuzzy)
- `tam bugday makarna` -> Tam Buğday Makarna
- `aycicek yagi` -> Ayçiçek Yağı
- ambiguous input için deterministic seçim veya explicit ambiguous dönüş

## 2. Unit test – evaluator

### Senaryo A
Sepet:
- Domates
- Tam Buğday Makarna
- Ayçiçek Yağı
- Kırmızı Pul Biber
- Karabiber

Tarif:
- mandatory: Makarna, Domates
- optional: Karabiber, Kırmızı Pul Biber, Yağ

Beklenen:
- `FULL_MATCH`

### Senaryo B
Tarif:
- mandatory: Tavuk, Makarna, Domates

Beklenen:
- `ONE_MISSING` yalnızca tavuk eksikse

### Senaryo C
Tarif:
- mandatory: Somon, Limon

Beklenen:
- `NOT_ELIGIBLE`

### Senaryo D
Tarif:
- mandatory: Avokado, Ekmek

Beklenen:
- `NOT_ELIGIBLE`

## 3. Integration test – premium scope
- Selin Aydın premium ise yalnızca `activeDietitianId = Aydin Saglik Merkezi` clinic recipes + izin verilen public fallback gelsin
- başka dietitian’ın private tarifleri dönmesin

## 4. Integration test – demo isolation
- `Verified Demo Pasta` gibi demo kayıtlar production response’ta görünmesin

## 5. E2E mobile test
- belirtilen sepet seçilsin
- tam uyum tabında alakasız somon/tavuk/avokado tarifleri görünmesin
- klinik tabında yalnızca ilgili klinik ve anlamlı eşleşen tarifler görünsün
- eksikle kartlarında eksik ingredient chip net görünsün

## 6. Regression fixture
En az 20 fixture sepet + beklenen tarif kategorisi hazırlanmalı. Böylece her backend değişikliğinde aynı kalite korunur.

---

## Definition of Done
Aşağıdakiler sağlanmadan iş tamamlanmış sayılmayacak:

1. Premium kullanıcı için sonuçlar `activeDietitianId` ile doğru scope ediliyor.
2. Demo/test/seed tarifler kullanıcıya görünmüyor.
3. `Tam Uyum` etiketi yalnızca tüm zorunlu ingredient family’leri karşılanan tariflere veriliyor.
4. `Eksikle` etiketi yalnızca tam 1 zorunlu family eksik olan tariflere veriliyor.
5. Klinik sekmesi sadece clinic source + anlamlı eşleşen tarifleri gösteriyor.
6. UI explanation alanında neden geldiği anlaşılıyor.
7. En az unit + integration + e2e seviyesinde test eklenmiş oluyor.
8. Build kırılmadan çalışıyor.
9. Eğer migration gerekiyorsa migration dosyası ekleniyor.
10. Eğer seed temizliği gerekiyorsa seed verisi de düzeltiliyor.

---

## Claude’dan Beklenen Çıktılar
Claude bu işi sadece yorumlayıp bırakmamalı; repo içinde gerçekten uygulamalı.

Beklenen teslimatlar:

1. Backend recommendation engine düzeltmesi
2. Gerekliyse DB migration(lar)
3. Demo/seed filtreleme düzeltmesi
4. Premium clinic scope düzeltmesi
5. Mobile results mapping / UI güncellemesi
6. Dietitian recipe editor validation düzeltmesi
7. Unit + integration + e2e testler
8. Kısa migration ve test çalıştırma notu
9. Değişen dosya listesi ve neden değiştiği

---

## Claude İçin Uygulama Stratejisi
Claude repo yapısı farklıysa dosya isimlerine körü körüne bağlı kalmamalı; ama şu sırayı izlemeli:

1. Mevcut ingredient normalization katmanını bul
2. Mevcut recommendation endpoint / service / handler’ı bul
3. Premium client scope’un nasıl çalıştığını bul (`activeDietitianId`, access key, policy)
4. Recipe data modelinde source/demo/public/private alanlarını bul
5. Deterministic evaluator yaz veya mevcut olanı düzelt
6. Response contract’ı UI için açıklanabilir hale getir
7. Mobil sekmeleri backend statülerine göre filtrele
8. Test yaz
9. Seed/demo leakage’ı sıfırla
10. Build ve test raporu üret

---

## Son Not
Bu problem görsel düzenleme ile çözülemez. Asıl ihtiyaç şudur:

- ingredient standardization gerçek çalışmalı
- recipe role semantics gerçek çalışmalı
- premium clinic isolation gerçek çalışmalı
- demo/test veri üretime sızmamalı
- UI backend’den gelen semantik sonucu göstermeli

Yani çözüm: **deterministik, açıklanabilir, ölçülebilir tarif öneri motoru**.
