# VERİTABANI ANALİZ RAPORU
**MyDietitianMobileApp — PostgreSQL Şema Analizi**
*Tarih: 2026-03-16*

---

## Bağlantı Bilgileri

```
Container  : mydietitian-postgres
Veritabanı : mydietitian_dev
Kullanıcı  : postgres
Port       : 5433 → 5432 (Docker)
pgAdmin    : localhost:5050
Migration  : 14 adet — tümü uygulanmış ✅
```

---

## Genel Bakış

- **47 tablo** tespit edildi
- **65 FK ilişkisi** mevcut
- **Tüm tablolar 0 kayıt** — veritabanı boş, seed data çalıştırılmamış ⚠️
- Son migration: `20260316013958_Sprint1_MealTypeAndAlternativeCompletion`

---

## Migration Geçmişi

| Migration ID | Tarih | Açıklama |
|---|---|---|
| 20251227120335_InitialCreate | 2025-12-27 | İlk şema |
| 20251227172722_AuthInitialCreate | 2025-12-27 | Auth tabloları |
| 20251231232755_AddComplianceTrackingEntities | 2025-12-31 | Uyum takip tabloları |
| 20260101214903_AddIngredientCanonicalNameAndAliases | 2026-01-01 | Normalizasyon alanları |
| 20260107174412_DietPlanRefactoring | 2026-01-07 | Plan yeniden yapılandırma |
| 20260109222909_AddPremiumFields | 2026-01-09 | Premium alanlar |
| 20260110092924_AddClientProfileFields | 2026-01-10 | Danışan profil alanları |
| 20260110200122_AddPublicUserIdToUserAccounts | 2026-01-10 | IDOR koruması için PublicUserId |
| 20260110220040_FAZ3_AddBindingAndMeasurements | 2026-01-10 | Bağlama ve ölçüm tabloları |
| 20260205001737_AddMealPlanSystem | 2026-02-05 | Yemek planı sistemi |
| 20260211223136_FixCompilationErrors | 2026-02-11 | Derleme düzeltmeleri |
| 20260215212829_AddDietitianSettings | 2026-02-15 | Diyetisyen ayarları |
| 20260309230844_AddIngredientTaxonomy | 2026-03-09 | Malzeme taksonomisi |
| 20260316013958_Sprint1_MealTypeAndAlternativeCompletion | 2026-03-16 | Öğün tipi ve alternatif tamamlama |

---

## A) KİMLİK DOĞRULAMA VE KULLANICILAR

### UserAccounts
Auth veritabanının kalbi. JWT token buradan üretilir. `PublicUserId` IDOR koruması için kullanılır.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| Email | text | NO | Kullanıcı e-postası |
| PasswordHash | text | NO | Bcrypt hash |
| Role | text | NO | `"Client"` veya `"Dietitian"` |
| LinkedDietitianId | uuid | YES | Bağlı diyetisyen |
| LinkedClientId | uuid | YES | Bağlı danışan |
| ActiveDietitianContextId | uuid | YES | Aktif diyetisyen bağlamı |
| FullName | text | YES | Tam isim |
| PublicUserId | text | NO | IDOR koruması için genel ID (default: `''`) |

---

### Dietitians
Diyetisyen profil kaydı. `UserAccounts.LinkedDietitianId` ile bağlı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| FullName | varchar(200) | NO | Tam isim |
| ClinicName | varchar(200) | NO | Klinik adı |
| IsActive | boolean | NO | Aktif mi? |

---

### Clients
Danışan profili. `PremiumActivatedAt` dolu ise premium kullanıcı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| FullName | varchar(200) | NO | Tam isim |
| Email | varchar(255) | NO | E-posta (default: `''`) |
| BirthDate | date | NO | Doğum tarihi (default: `-infinity`) |
| Gender | integer | NO | Cinsiyet (enum, default: `0`) |
| ActiveDietitianId | uuid | YES | Aktif diyetisyen FK |
| DietitianId | uuid | YES | Diyetisyen FK (Dietitians.Id) |
| PremiumActivatedAt | timestamptz | YES | Premium aktivasyon tarihi — dolu ise premium |
| ProgramStartDate | timestamptz | YES | Program başlangıcı |
| ProgramEndDate | timestamptz | YES | Program bitişi |
| IsActive | boolean | NO | Aktif mi? |
| CreatedAt | timestamptz | NO | Oluşturulma tarihi |

---

### AccessKeys
Diyetisyen → Danışan premium bağlantı anahtarı. Web panelde üretilip mobilde girilir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| KeyValue | text | NO | Tekil anahtar değeri |
| Code | text | YES | Kullanıcıya gösterilen kısa kod |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| ClientId | uuid | NO | FK → Clients.Id |
| ExpiresAtUtc | timestamptz | NO | Son kullanım tarihi |
| CreatedAtUtc | timestamptz | NO | Oluşturulma tarihi |
| IsActive | boolean | NO | Aktif mi? |

---

### DietitianClientLinks
Diyetisyen-Danışan ilişki tablosu. Geçmiş bağlantılar `UnlinkedAt` ile korunur.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| ClientId | uuid | NO | FK → Clients.Id |
| PublicUserId | text | NO | IDOR koruması |
| LinkedAt | timestamptz | NO | Bağlantı tarihi |
| UnlinkedAt | timestamptz | YES | Bağlantı kesme tarihi (soft delete) |
| IsActive | boolean | NO | Aktif bağlantı mı? |

---

### PremiumAuditLogs
Premium işlem denetim kaydı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietitianId | uuid | YES | FK → Dietitians.Id |
| Action | varchar(32) | NO | `"activated"`, `"expired"`, `"revoked"` |
| AtUtc | timestamptz | NO | İşlem zamanı |
| MetaJson | jsonb | YES | Ek meta veri |

---

## B) MALZEME SİSTEMİ — TEZİN KALBİ

### Ingredients
Ana malzeme tablosu. `CanonicalName` normalizasyonun referans noktası. `Aliases` JSON dizisi alternatif yazımları içerir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| Name | varchar(200) | NO | Görünen isim |
| CanonicalName | varchar(200) | NO | Standart kanonik isim (default: `''`) |
| Aliases | jsonb | YES | Alternatif yazımlar — örn: `["yogurt","yoğurt","yoğürt"]` |
| IsMandatory | boolean | NO | Zorunlu malzeme mi? |
| IsProhibited | boolean | NO | Yasaklı malzeme mi? |
| IsActive | boolean | NO | Aktif mi? (default: `true`) |

---

### IngredientFamilies
Malzeme aileleri. Taksonominin üst katmanı. Örn: "Süt Ürünleri", "Tahıllar".

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| Name | varchar(200) | NO | Aile adı |
| Description | varchar(1000) | YES | Açıklama |
| SortOrder | integer | NO | Sıralama |
| IsActive | boolean | NO | Aktif mi? |
| CreatedAtUtc | timestamptz | NO | — |
| UpdatedAtUtc | timestamptz | NO | — |

---

### IngredientFamilyMembers
Aile-üye birleştirme tablosu. `Role` sütunu taxonomy graph'ın kenarlarını tanımlar.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| FamilyId | uuid | NO | PK + FK → IngredientFamilies.Id |
| IngredientId | uuid | NO | PK + FK → Ingredients.Id |
| Role | varchar(50) | NO | `"primary"`, `"variant"`, `"substitute"` |

---

### IngredientCompatibilityRules
İki malzeme arasındaki uyumluluk kuralı. Öneri motorunun karar verici verisi.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| RequiredIngredientId | uuid | NO | FK → Ingredients.Id |
| CandidateIngredientId | uuid | NO | FK → Ingredients.Id |
| CompatibilityType | varchar(50) | NO | `"substitute"`, `"incompatible"`, `"enhances"` |
| ScorePenalty | numeric | YES | Uyumsuzluk ceza puanı |
| Reason | varchar(500) | YES | İnsan okunabilir gerekçe |
| IsActive | boolean | NO | Aktif mi? |
| CreatedAtUtc | timestamptz | NO | — |
| UpdatedAtUtc | timestamptz | NO | — |

---

### IngredientNormalizationLogs
**Tezin birincil ölçüm tablosu.** Her normalizasyon isteği burada loglanır. `MatchedBy` sütunu hangi katmanın kullandığını gösterir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| CreatedAtUtc | timestamptz | NO | İstek zamanı |
| RawInput | varchar(500) | NO | Kullanıcının girdiği ham metin |
| NormalizedInput | varchar(500) | NO | Normalize edilmiş metin |
| Status | varchar(32) | NO | `"matched"`, `"unmatched"`, `"ambiguous"` |
| **MatchedBy** | varchar(32) | NO | **`"exact"` / `"alias"` / `"fuzzy"` / `"llm"` / `"unmatched"`** |
| MatchedIngredientId | uuid | YES | Eşleşen malzeme ID |
| MatchedCanonicalName | varchar(200) | YES | Eşleşen kanonik isim |
| Confidence | float8 | NO | Güven skoru (0.0–1.0) |
| CandidateSummaryJson | jsonb | YES | Aday özet listesi |
| CorrelationId | varchar(100) | YES | İstek takip ID |
| RequestPath | varchar(300) | YES | API endpoint |

---

### IngredientPacks
Hızlı malzeme paketi şablonu. `IsSystem=true` sistem geneli, `DietitianId` doluysa diyetisyene özel.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| Name | varchar(200) | NO | Paket adı |
| IsSystem | boolean | NO | Sistem paketi mi? |
| DietitianId | uuid | YES | Diyetisyene özel ise FK |
| SortOrder | integer | NO | Sıralama |

---

### IngredientPackItems
Paket-içerik birleştirme tablosu.

| Sütun | Tip | Nullable |
|---|---|---|
| PackId | uuid | NO — PK + FK → IngredientPacks.Id |
| IngredientId | uuid | NO — PK + FK → Ingredients.Id |

---

### ClientIngredientProhibitions
Danışanın bireysel yasak malzemeleri (alerji, intolerans). Gerekçe sütunu içerir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| IngredientId | uuid | NO | FK → Ingredients.Id |
| Reason | text | YES | Yasak gerekçesi |
| IsActive | boolean | NO | Aktif mi? |
| CreatedAtUtc | timestamptz | NO | — |

---

### ClientProhibitedIngredients
`ClientIngredientProhibitions` ile aynı amaca hizmet eden basit versiyon. ⚠️ Paralel tablo.

| Sütun | Tip | Nullable |
|---|---|---|
| ClientId | uuid | NO — PK + FK → Clients.Id |
| IngredientId | uuid | NO — PK + FK → Ingredients.Id |
| CreatedAtUtc | timestamptz | NO |

---

### ClientPantryItems
Danışanın kileri/buzdolabı. Mutfak ekranından "BİRLEŞTİR" butonuna giden veri kaynağı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| ClientId | uuid | NO | PK + FK → Clients.Id |
| IngredientId | uuid | NO | PK + FK → Ingredients.Id |
| Quantity | numeric | YES | Miktar |
| Unit | varchar(50) | YES | Birim (gr, adet, ml…) |
| UpdatedAtUtc | timestamptz | NO | Son güncelleme |

---

## C) TARİF SİSTEMİ

### Recipes
Ana tarif tablosu. `DietitianId=null` genel/sistem tarifi. `IsPublic=false` sadece bağlı danışanlar görür.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | YES | FK → Dietitians.Id — null ise genel tarif |
| Name | varchar(200) | NO | Tarif adı |
| Description | text | NO | Açıklama |
| IsPublic | boolean | NO | Genel mi? (default: `false`) |

---

### RecipeIngredients
Tariften malzemeye ana bağlantı tablosu. `Role` alanı öneri motorunun temel girdisi.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| RecipeId | uuid | NO | FK → Recipes.Id |
| IngredientId | uuid | NO | FK → Ingredients.Id |
| Role | text | NO | `"Mandatory"`, `"Optional"`, `"Prohibited"`, `"Substitute"` |
| Quantity | numeric | YES | Miktar |
| Unit | text | YES | Birim |
| CreatedAtUtc | timestamptz | NO | — |

---

### RecipeMandatoryIngredients
Zorunlu malzeme hızlı erişim tablosu. Eksik → tarif reddedilir.

| Sütun | Tip | Nullable |
|---|---|---|
| RecipeId | uuid | NO — PK + FK → Recipes.Id |
| IngredientId | uuid | NO — PK + FK → Ingredients.Id |

---

### RecipeOptionalIngredients
Opsiyonel malzeme hızlı erişim tablosu. Eksik → puan düşer, tarif kabul edilir.

| Sütun | Tip | Nullable |
|---|---|---|
| RecipeId | uuid | NO — PK + FK → Recipes.Id |
| IngredientId | uuid | NO — PK + FK → Ingredients.Id |

---

### RecipeProhibitedIngredients
Yasaklı malzeme hızlı erişim tablosu. Danışanın kilesinde varsa → tarif elenir.

| Sütun | Tip | Nullable |
|---|---|---|
| RecipeId | uuid | NO — PK + FK → Recipes.Id |
| IngredientId | uuid | NO — PK + FK → Ingredients.Id |

---

### RecipeProhibitions
Gerekçeli yasaklama tablosu. `RecipeProhibitedIngredients`'a kıyasla `Reason` sütunu ekstra.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| RecipeId | uuid | NO | FK → Recipes.Id |
| IngredientId | uuid | NO | FK → Ingredients.Id |
| Reason | text | YES | Yasak gerekçesi |
| CreatedAtUtc | timestamptz | NO | — |

---

### RecipeSubstitutes
Tarif içi malzeme alternatif tanımları. "Yoğurt yerine Kefir olur."

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| RecipeId | uuid | NO | FK → Recipes.Id |
| RequiredIngredientId | uuid | NO | FK → Ingredients.Id — asıl malzeme |
| SubstituteIngredientId | uuid | NO | FK → Ingredients.Id — alternatif malzeme |
| CreatedAtUtc | timestamptz | NO | — |

---

### RecipeIngredientSubstitutes
`RecipeSubstitutes`'ın composite PK versiyonu. ⚠️ Paralel tablo.

| Sütun | Tip | Nullable |
|---|---|---|
| RecipeId | uuid | NO — PK + FK → Recipes.Id |
| RequiredIngredientId | uuid | NO — PK + FK → Ingredients.Id |
| SubstituteIngredientId | uuid | NO — PK + FK → Ingredients.Id |

---

### RecipeRecommendationLogs
**Tezin ikinci ölçüm tablosu.** Her öneri kararı kayıt altında. Tez grafiklerinin veri kaynağı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| CreatedAtUtc | timestamptz | NO | Karar zamanı |
| Flow | varchar(64) | NO | Akış tipi |
| ClientId | uuid | YES | FK → Clients.Id |
| DietitianId | uuid | YES | FK → Dietitians.Id |
| PlannedRecipeId | uuid | YES | Planlanan tarif |
| SelectedRecipeId | uuid | YES | Seçilen tarif |
| OriginalCookable | boolean | NO | Orijinal tarif pişirilebilir miydi? |
| MatchPercentage | numeric | YES | Eşleşme yüzdesi |
| MissingMandatoryCount | integer | NO | Eksik zorunlu malzeme sayısı |
| ProhibitedRejected | boolean | NO | Yasaklı nedeniyle reddedildi mi? |
| UsedSubstitutes | boolean | NO | Alternatif malzeme kullanıldı mı? |
| MissingMandatoryIdsJson | jsonb | YES | Eksik malzeme ID listesi |
| AdditionalMetaJson | jsonb | YES | Ek meta veri |
| CorrelationId | varchar(100) | YES | İstek takip ID |

---

## D) PLAN SİSTEMİ

### DietPlans
Diyetisyen tarafından oluşturulan diyet planı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| ClientId | uuid | NO | FK → Clients.Id |
| Name | varchar(200) | NO | Plan adı |
| StartDate | timestamptz | NO | Başlangıç |
| EndDate | timestamptz | NO | Bitiş |
| Status | integer | NO | Enum: aktif/tamamlandı/iptal (default: `0`) |

---

### DietPlanDays
Plan içindeki günler.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietPlanId | uuid | NO | FK → DietPlans.Id |
| Date | timestamptz | NO | Gün tarihi |
| DailyTargetCalories | integer | YES | Günlük kalori hedefi |

---

### DietPlanMeals
Gün içindeki öğünler. `Type` enum: Kahvaltı, Öğle, Akşam, Ara Öğün…

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietPlanDayId | uuid | NO | FK → DietPlanDays.Id |
| Type | integer | NO | Öğün tipi enum |
| PlannedRecipeId | uuid | YES | Planlanan tarif |
| CustomName | varchar(200) | YES | Özel isim (tarif yoksa) |
| IsMandatory | boolean | NO | Zorunlu öğün mü? |

---

### MealPlans
Daha basit plan modeli. ⚠️ DietPlans ile paralel — üçüncü plan sistemi.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| Date | date | NO | Plan tarihi |
| Status | varchar(20) | NO | Plan durumu |
| CreatedBy | uuid | NO | FK → Dietitians.Id |
| CreatedAt | timestamptz | NO | — |
| UpdatedAt | timestamptz | NO | — |

---

### PlanMealItems
MealPlans içindeki bireysel öğün kalemleri. Makro besin değerleri burada.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| PlanId | uuid | NO | FK → MealPlans.Id |
| Time | time | NO | Öğün saati |
| Title | varchar(200) | NO | Başlık |
| Note | varchar(1000) | YES | Not |
| OrderIndex | integer | NO | Sıra |
| Calories | integer | YES | Kalori |
| ProteinGrams | numeric | YES | Protein (gr) |
| CarbsGrams | numeric | YES | Karbonhidrat (gr) |
| FatGrams | numeric | YES | Yağ (gr) |
| MealType | integer | NO | Öğün tipi enum (default: `6`) |
| RecipeId | uuid | YES | FK → Recipes.Id |
| CompletionId | uuid | YES | FK → MealCompletions.Id |
| CreatedAt | timestamptz | NO | — |

---

### ClientMealPlans
Danışan bazında plan tablosu. ⚠️ MealPlans ile paralel.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| Name | text | NO | Plan adı |
| Description | text | YES | Açıklama |
| StartDate | timestamptz | NO | — |
| EndDate | timestamptz | YES | — |
| IsActive | boolean | NO | — |
| CreatedAtUtc | timestamptz | NO | — |
| UpdatedAtUtc | timestamptz | NO | — |

---

### ClientMeals
ClientMealPlans içindeki öğünler.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientMealPlanId | uuid | NO | FK → ClientMealPlans.Id |
| RecipeId | uuid | NO | FK → Recipes.Id |
| DayOfWeek | integer | NO | Haftanın günü |
| MealType | text | NO | Öğün tipi |
| Servings | integer | NO | Porsiyon |
| CompletedAt | timestamptz | YES | Tamamlanma zamanı |
| CreatedAtUtc | timestamptz | NO | — |

---

### MealItems
Öğün içindeki bireysel malzeme kalemleri.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| MealId | uuid | NO | FK → DietPlanMeals.Id |
| IngredientId | uuid | NO | FK → Ingredients.Id |
| IsMandatory | boolean | NO | Zorunlu malzeme mi? |
| Amount | numeric | YES | Miktar |
| Unit | varchar(50) | YES | Birim |
| DietPlanMealId | uuid | YES | FK → DietPlanMeals.Id (alternatif bağlantı) |

---

## E) UYUM TAKİBİ

### MealCompletions
Danışanın öğünü tamamladığı/atladığı kaydı. `AlternativeRecipeId` doluysa alternatif tarif yenildi.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| DietPlanMealId | uuid | NO | FK → DietPlanMeals.Id |
| Status | integer | NO | Tamamlandı/Atlandı enum (default: `0`) |
| Note | varchar(300) | YES | Danışan notu |
| AtUtc | timestamptz | NO | Tamamlanma zamanı |
| AlternativeRecipeId | uuid | YES | FK → Recipes.Id — varsa alternatif yendi |

---

### MealCompliances
Uyum takibi. ⚠️ `MealCompletions` ile paralel — daha yeni versiyon.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietPlanMealId | uuid | NO | FK → DietPlanMeals.Id |
| Status | integer | NO | Uyum durumu enum |
| AlternativeRecipeId | uuid | YES | Alternatif tarif |
| MarkedAt | timestamptz | NO | İşaretleme zamanı |
| Date | date | NO | Tarih |

---

### MealItemCompliance
Malzeme seviyesinde uyum takibi. "Yoğurt yerine Kefir yedi" bu tablodan izlenir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietPlanId | uuid | NO | FK → DietPlans.Id |
| DietDayId | uuid | NO | FK → DietPlanDays.Id |
| MealId | uuid | NO | FK → DietPlanMeals.Id |
| MealItemId | uuid | NO | FK → MealItems.Id |
| IngredientId | uuid | NO | FK → Ingredients.Id |
| Status | integer | NO | Uyum durumu |
| AlternativeIngredientId | uuid | YES | FK → Ingredients.Id — varsa alternatif kullanıldı |
| MarkedAt | timestamptz | NO | İşaretleme zamanı |
| ClientTimezoneOffsetMinutes | integer | YES | Saat dilimi farkı |

---

### ComplianceScoreConfigs
Uyum skoru hesaplama ağırlıkları. Diyetisyen bunları özelleştirebilir.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | YES | FK → Dietitians.Id |
| DietPlanId | uuid | YES | FK → DietPlans.Id |
| MandatoryDone | integer | NO | Zorunlu yapıldı puanı (default: `10`) |
| MandatoryAlternative | integer | NO | Zorunlu alternatifle yapıldı (default: `7`) |
| MandatorySkipped | integer | NO | Zorunlu atlandı (default: `0`) |
| OptionalDone | integer | NO | Opsiyonel yapıldı (default: `3`) |
| OptionalSkipped | integer | NO | Opsiyonel atlandı (default: `0`) |

---

### DailyComplianceSnapshots
Günlük uyum özeti. `Score0_100` mobil uyum grafiği için kullanılır.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| ClientId | uuid | NO | PK + FK → Clients.Id |
| Date | date | NO | PK — gün |
| PlannedCount | integer | NO | Planlanan öğün sayısı (default: `0`) |
| CompletedCount | integer | NO | Tamamlanan sayı (default: `0`) |
| SkippedCount | integer | NO | Atlanan sayı (default: `0`) |
| Score0_100 | integer | NO | Uyum skoru 0–100 (default: `0`) |
| UpdatedAtUtc | timestamptz | NO | Son güncelleme |

---

### ClientActivities
Genel aktivite log tablosu. `Type`: `"login"`, `"meal_completed"`, `"key_activated"` vb.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| DietitianId | uuid | YES | FK → Dietitians.Id |
| Type | varchar(60) | NO | Aktivite tipi |
| AtUtc | timestamptz | NO | Zaman |
| MetaJson | jsonb | YES | Ek meta veri |

---

### ClientDailyTrackings
Günlük su takibi ve adım sayısı.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| ClientId | uuid | NO | PK + FK → Clients.Id |
| Date | date | NO | PK — gün |
| WaterGlasses | integer | NO | Su bardağı sayısı (default: `0`) |
| Steps | integer | NO | Adım sayısı (default: `0`) |
| Notes | varchar(500) | YES | Günlük not |
| UpdatedAtUtc | timestamptz | NO | Son güncelleme |

---

## F) ÖLÇÜM VE İZLEME

### ClientMeasurementEntries
Bel/kalça/göğüs ölçüm geçmişi. Birden fazla kayıt = zaman serisi grafik.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| AtUtc | timestamptz | NO | Ölçüm zamanı |
| WaistCm | numeric | YES | Bel (cm) |
| HipCm | numeric | YES | Kalça (cm) |
| ChestCm | numeric | YES | Göğüs (cm) |
| UpdatedAtUtc | timestamptz | NO | — |

---

### ClientWeightEntries
Zaman serisi kilo takibi.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| AtUtc | timestamptz | NO | Ölçüm zamanı |
| WeightKg | numeric | NO | Kilo (kg) |

---

### UserMeasurements
Tekil profil ölçümü. BMI/BMR hesaplanmış halde saklanır.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| ClientId | uuid | NO | FK → Clients.Id |
| WeightKg | numeric | NO | Kilo (kg) |
| HeightCm | integer | NO | Boy (cm) |
| Bmi | numeric | NO | Hesaplanmış BMI |
| Bmr | numeric | NO | Hesaplanmış BMR |
| CreatedAt | timestamptz | NO | — |

---

## G) DİYETİSYEN PANELİ

### DietitianNotes
Diyetisyenin danışana özel notları. Mobil "Notlarım" ekranında görünür.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| ClientId | uuid | NO | FK → Clients.Id |
| Text | varchar(2000) | NO | Not içeriği |
| CreatedAtUtc | timestamptz | NO | — |

---

### DietitianSettings
Web panel branding ayarları.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| Id | uuid | NO | Primary Key |
| DietitianId | uuid | NO | FK → Dietitians.Id |
| ClinicName | varchar(100) | NO | Klinik adı |
| DietitianDisplayName | varchar(100) | NO | Gösterilen isim |
| PrimaryColorHex | varchar(7) | NO | Ana renk (default: `#4A7C59`) |
| AccentColorHex | varchar(7) | NO | Vurgu rengi (default: `#8FBC8F`) |
| ThemePresetKey | varchar(50) | YES | Tema önayarı |
| LogoUrl | varchar(500) | YES | Logo URL |
| CreatedAt | timestamptz | NO | — |
| UpdatedAt | timestamptz | NO | — |

---

### DietitianBrandingConfigs
Premium danışanın mobil header'ında kullanılan branding. ⚠️ `DietitianSettings` ile paralel.

| Sütun | Tip | Nullable | Açıklama |
|---|---|---|---|
| DietitianId | uuid | NO | PK + FK → Dietitians.Id |
| ClinicName | varchar(120) | YES | Klinik adı |
| LogoUrl | varchar(500) | YES | Logo URL |
| PrimaryColorHex | varchar(7) | NO | Ana renk (default: `#4A7C59`) |
| AccentColorHex | varchar(7) | NO | Vurgu rengi (default: `#FF8C61`) |
| UpdatedAtUtc | timestamptz | NO | — |

---

## H) DİĞER

### __EFMigrationsHistory
EF Core migration geçmişi. 14 migration uygulanmış.

---

## İLİŞKİ HARİTASI (65 FK)

```
══ KİMLİK DOĞRULAMA ═════════════════════════════════════════
UserAccounts ──(LinkedDietitianId)──────► Dietitians
UserAccounts ──(LinkedClientId)─────────► Clients

══ DİYETİSYEN MERKEZİ ══════════════════════════════════════
Dietitians ──1──N──► Recipes
Dietitians ──1──N──► DietPlans
Dietitians ──1──N──► DietitianClientLinks
Dietitians ──1──1──► DietitianSettings
Dietitians ──1──1──► DietitianBrandingConfigs
Dietitians ──1──N──► DietitianNotes
Dietitians ──1──N──► AccessKeys
Dietitians ──1──N──► MealPlans (CreatedBy)
Dietitians ──1──N──► ClientMealPlans
Dietitians ──1──N──► MealCompletions

══ DANIŞAN MERKEZİ ══════════════════════════════════════════
Clients ──1──N──► AccessKeys
Clients ──1──N──► DietitianClientLinks
Clients ──1──N──► ClientPantryItems
Clients ──1──N──► ClientIngredientProhibitions
Clients ──1──N──► ClientProhibitedIngredients
Clients ──1──N──► ClientMealPlans
Clients ──1──N──► MealPlans
Clients ──1──N──► MealCompletions
Clients ──1──N──► MealCompliances
Clients ──1──N──► MealItemCompliance
Clients ──1──N──► DailyComplianceSnapshots
Clients ──1──N──► ClientActivities
Clients ──1──N──► ClientDailyTrackings
Clients ──1──N──► ClientMeasurementEntries
Clients ──1──N──► ClientWeightEntries
Clients ──1──N──► UserMeasurements
Clients ──1──N──► DietitianNotes
Clients ──(DietitianId)──────────────► Dietitians

══ TARİF SİSTEMİ ════════════════════════════════════════════
Recipes ──1──N──► RecipeIngredients ──N──1──► Ingredients
Recipes ──1──N──► RecipeMandatoryIngredients ──N──1──► Ingredients
Recipes ──1──N──► RecipeOptionalIngredients ──N──1──► Ingredients
Recipes ──1──N──► RecipeProhibitedIngredients ──N──1──► Ingredients
Recipes ──1──N──► RecipeProhibitions ──N──1──► Ingredients
Recipes ──1──N──► RecipeSubstitutes ──N──1──► Ingredients (required)
                                     └──N──1──► Ingredients (substitute)
Recipes ──1──N──► RecipeIngredientSubstitutes (paralel tablo)
ClientMeals ──N──1──► Recipes
PlanMealItems ──N──1──► Recipes

══ TAKSONOMİ (NORMALIZASYON MOTORU) ═════════════════════════
IngredientFamilies ──1──N──► IngredientFamilyMembers ──N──1──► Ingredients
Ingredients ──(RequiredId)───────► IngredientCompatibilityRules
Ingredients ──(CandidateId)──────► IngredientCompatibilityRules

══ PLAN SİSTEMİ ══════════════════════════════════════════════
DietPlans ──1──N──► DietPlanDays ──1──N──► DietPlanMeals
DietPlanMeals ──1──N──► MealItems ──N──1──► Ingredients
DietPlanMeals ──1──N──► MealCompliances
DietPlanMeals ──1──N──► MealItemCompliance
MealPlans ──1──N──► PlanMealItems ──N──1──► Recipes
PlanMealItems ──(CompletionId)──────► MealCompletions
ClientMealPlans ──1──N──► ClientMeals ──N──1──► Recipes

══ PAKET SİSTEMİ ════════════════════════════════════════════
IngredientPacks ──1──N──► IngredientPackItems ──N──1──► Ingredients
```

---

## ÖNEMLİ BULGULAR VE UYARILAR

### ⚠️ KRİTİK — VERİTABANI TAMAMEN BOŞ
Tüm 47 tablo 0 kayıt içeriyor. Migrations uygulanmış fakat `DatabaseSeeder` hiç çalışmamış.
**Etki:** Demo senaryosu çalışmaz, smoke testler anlamsız, tarif öneri motoru test edilemez.
**Çözüm:** Backend çalıştırıldığında seeder otomatik tetiklenmeli ya da seed SQL scriptleri doğrudan çalıştırılmalı.

---

### ⚠️ PARALEL TABLO ÇİFTLERİ

| Çift | Sorun |
|---|---|
| `ClientIngredientProhibitions` + `ClientProhibitedIngredients` | İkisi de aynı amaca hizmet ediyor; biri `Reason` + `IsActive` içeriyor |
| `RecipeSubstitutes` + `RecipeIngredientSubstitutes` | Aynı veri, farklı PK yapısı (biri `Id`'li, diğeri composite PK) |
| `MealCompletions` + `MealCompliances` | Öğün tamamlama için iki tablo — `MealCompliances` daha yeni görünüyor |
| `DietitianSettings` + `DietitianBrandingConfigs` | Branding için iki tablo; `DietitianBrandingConfigs` mobil için özelleştirilmiş |
| `DietPlans/DietPlanDays/DietPlanMeals` + `MealPlans/PlanMealItems` + `ClientMealPlans/ClientMeals` | **Üç farklı plan modeli** aynı anda var — hangi modelin canonical olduğu belirsiz |

---

### ✅ NORMALIZASYON LOG ALTYAPISI HAZIR
`IngredientNormalizationLogs.MatchedBy` sütunu `"exact"` / `"alias"` / `"fuzzy"` / `"llm"` / `"unmatched"` değerlerini tutmak üzere tasarlanmış.
Tez için katman bazlı başarı metrikleri bu tablodan sorgu ile çıkarılabilir:
```sql
SELECT "MatchedBy", COUNT(*) AS count,
       ROUND(AVG("Confidence") * 100, 1) AS avg_confidence
FROM "IngredientNormalizationLogs"
GROUP BY "MatchedBy"
ORDER BY count DESC;
```

---

### ✅ ÖNERİ MOTORU LOG ALTYAPISI HAZIR
`RecipeRecommendationLogs` tablosu `MatchPercentage`, `ProhibitedRejected`, `UsedSubstitutes`, `MissingMandatoryCount` sütunlarıyla tez grafiklerine hazır:
```sql
SELECT
    COUNT(*) AS total_recommendations,
    ROUND(AVG("MatchPercentage"), 1) AS avg_match,
    SUM(CASE WHEN "ProhibitedRejected" THEN 1 ELSE 0 END) AS prohibited_rejections,
    SUM(CASE WHEN "UsedSubstitutes" THEN 1 ELSE 0 END) AS substitute_usages
FROM "RecipeRecommendationLogs";
```

---

### ✅ UYUM SKORU KONFİGÜRE EDİLEBİLİR
`ComplianceScoreConfigs` tablosu diyetisyen bazında özelleştirilebilir ağırlıklar içeriyor.
Varsayılan ağırlıklar: Zorunlu yapıldı=10, Alternatifle yapıldı=7, Atlandı=0, Opsiyonel yapıldı=3.

---

*Bu doküman `docker exec mydietitian-postgres psql` komutuyla canlı veritabanından çekilmiştir.*
