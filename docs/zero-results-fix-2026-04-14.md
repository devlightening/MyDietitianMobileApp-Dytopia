# Sıfır Sonuç Hatası — Kök Neden Analizi ve Uygulanan Düzeltmeler

**Tarih:** 2026-04-14  
**Etkilenen akış:** `POST /api/recipes/match` ve `POST /api/client/kitchen/merge`  
**Senaryo:** Premium kullanıcı (Aydın Sağlık Merkezi'ne bağlı) sepetine Kırmızı Pul Biber, Domates, Tuz, Kuru Fasulye seçiyor → "Tarif Bul" diyor → **sıfır sonuç** geliyor. Kliniklerin tarifi "Etli Kuru Fasulye" hiç görünmüyor.

---

## Neden Sıfır Sonuç Geliyordu?

### Temel Sorun: İki Farklı Tablo, İki Farklı Yazıcı

Sistemde tarif-malzeme ilişkisi **iki ayrı tabloda** tutuluyor:

| Tablo | Kim yazar | Kim okur |
|---|---|---|
| `RecipeMandatoryIngredients` (EF shadow join) | `recipe.AddMandatoryIngredient()` | Eşleşme motoru |
| `RecipeIngredients` (explicit, Role sütunlu) | Web panel kaydetme akışı | Sadece web panel UI |

Eşleşme motoru (`RecipeMatchController`) yalnızca **shadow tablosunu** okur. Web panel tarif kaydederken `RecipeIngredients` tablosunu doldurur ama shadow tablosuna yazmak için farklı bir mekanizma çalışması gerekir. Bu mekanizma bazı tariflerde çalışmamışsa shadow tablo boş kalır.

Shadow tablo boşsa motor şu satırla tarifi sessizce atlar:

```csharp
// RecipeMatchController.cs
if (recipe.MandatoryIngredients.Count + recipe.OptionalIngredients.Count == 0)
    continue;  // Tarif hiç değerlendirilmeden düşülür
```

"Etli Kuru Fasulye" tam olarak bu duruma düşmüştü: `RecipeIngredients` tablosunda malzemeleri vardı ama `RecipeMandatoryIngredients` tablosu boştu.

### İkincil Sorun: PARTIAL_MATCH Eşiği Çok Katıydı

"Etli Kuru Fasulye" gibi 6–8 zorunlu malzemesi olan geleneksel tariflerde, kullanıcı sadece 3–4 malzeme seçtiğinde 2'den fazla zorunlu malzeme eksik kalabilir. Eski kod `missingCount > 2` olan her tarifi düşürüyordu. Bu eşik, geleneksel tarifleri için fazla katı.

---

## Uygulanan Düzeltmeler

### Düzeltme 1 — SQL Onarım Betiği

**Dosya:** `scripts/repair-recipe-shadow-tables.sql`

`RecipeIngredients` tablosundaki satırları `RecipeMandatoryIngredients` ve `RecipeOptionalIngredients` shadow tablolarına kopyalayan, birden fazla çalıştırılsa bile güvenli (idempotent) SQL betiği.

```sql
-- Zorunlu malzemeleri senkronize eder
INSERT INTO "RecipeMandatoryIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
WHERE ri."Role" = 'Mandatory'
  AND NOT EXISTS ( ... )
ON CONFLICT DO NOTHING;
```

Betik sonunda her tarif için `mandatory_shadow`, `optional_shadow`, `explicit_total` sayılarını ve `STILL_ORPHANED / OK` durumunu gösteren bir doğrulama sorgusu çalışır.

> **Bu betiği veritabanınıza çalıştırın** — kalıcı çözüm budur.

---

### Düzeltme 2 — `Recipe.HydrateFromExplicitIngredients()` Metodu

**Dosya:** `src/MyDietitianMobileApp.Domain/Entities/Recipe.cs`

Shadow tablo boş olan tarifler için **çalışma zamanında** `RecipeIngredients` tablosundan malzemeleri yükleyip `_mandatoryIngredients` / `_optionalIngredients` listelerine dolduran yeni bir metot eklendi.

```csharp
public void HydrateFromExplicitIngredients(
    IEnumerable<Ingredient> mandatoryIngredients,
    IEnumerable<Ingredient> optionalIngredients)
{
    if (_mandatoryIngredients.Count > 0 || _optionalIngredients.Count > 0)
        return; // Zaten doluysa dokunma

    foreach (var ing in mandatoryIngredients)
        _mandatoryIngredients.Add(ing);

    foreach (var ing in optionalIngredients)
        _optionalIngredients.Add(ing);
}
```

Bu metot yalnızca geçici bir güvence ağı. Asıl çözüm her zaman SQL onarım betiğidir.

---

### Düzeltme 3 — Sahipsiz Tarif Geri Dönüşü (Orphan Fallback)

**Dosya:** `src/MyDietitianMobileApp.Api/Controllers/RecipeMatchController.cs`  
**Dosya:** `src/MyDietitianMobileApp.Api/Controllers/KitchenController.cs`

Aday tarifler veritabanından yüklendikten sonra, shadow tablosu boş olan tarifler tespit edilir ve `RecipeIngredients` tablosundan malzemeleri yüklenerek `HydrateFromExplicitIngredients()` çağrılır.

```csharp
// Shadow tablosu boş olan tarifleri bul
var orphanedRecipeIds = candidateRecipes
    .Where(r => r.MandatoryIngredients.Count + r.OptionalIngredients.Count == 0)
    .Select(r => r.Id)
    .ToList();

if (orphanedRecipeIds.Any())
{
    _logger.LogWarning(
        "[MATCH] {Count} tarif(ler) boş shadow tabloya sahip — RecipeIngredients'tan yükleniyor. " +
        "Kalıcı çözüm için repair-recipe-shadow-tables.sql çalıştırın.",
        orphanedRecipeIds.Count);

    // RecipeIngredients'tan malzeme yükle ve tariflere aktar
    var explicitRows = await _appDb.RecipeIngredients
        .Where(ri => orphanedRecipeIds.Contains(ri.RecipeId))
        .Include(ri => ri.Ingredient)
        .ToListAsync();

    foreach (var recipe in candidateRecipes)
    {
        // ... recipe.HydrateFromExplicitIngredients(mandatory, optional);
    }
}
```

Bu düzeltme hem `RecipeMatchController` hem de `KitchenController`'a uygulandı.

---

### Düzeltme 4 — PARTIAL_MATCH Eşiği Genişletildi

**Dosya:** `src/MyDietitianMobileApp.Api/Controllers/RecipeMatchController.cs`

Eski davranış: `missingCount == 2` ve kapsama ≥ %50 → PARTIAL_MATCH kabul edilir  
Yeni davranış: `missingCount == 2 veya 3` ve kapsama ≥ **%40** → PARTIAL_MATCH kabul edilir

| Senaryo | Eski | Yeni |
|---|---|---|
| 6 zorunlu malzeme, 2 eksik (%66 kapsama) | ✅ Kabul | ✅ Kabul |
| 6 zorunlu malzeme, 3 eksik (%50 kapsama) | ❌ Düşürüldü | ✅ Kabul |
| 5 zorunlu malzeme, 3 eksik (%40 kapsama) | ❌ Düşürüldü | ✅ Kabul |
| 5 zorunlu malzeme, 4 eksik (%20 kapsama) | ❌ Düşürüldü | ❌ Düşürülür |

"Etli Kuru Fasulye" örneğinde: kullanıcı sepetinde Kuru Fasulye + Domates var, 3 başka malzeme eksik → %40+ kapsama varsa artık PARTIAL_MATCH olarak gösterilir.

---

### Düzeltme 5 — Diagnose Endpoint Geliştirildi

**Endpoint:** `GET /api/recipes/match/diagnose`

Artık her klinik tarifinin shadow tablo sayısının yanı sıra `RecipeIngredients` tablosundaki kayıt sayısını ve iki tablo arasındaki uyumsuzluğu da gösteriyor.

```json
{
  "Id": "d8c4f583-...",
  "Name": "Etli Kuru Fasulye",
  "MandatoryCount": 0,
  "ExplicitIngredientCount": 7,
  "ShadowTableMismatch": true,
  "ProductionReady": true
}
```

`ShadowTableMismatch: true` gördüğünüzde o tarif için SQL onarım betiğini çalıştırmanız gerekiyor demektir.

---

## Değişen Dosyalar

| Dosya | Ne değişti |
|---|---|
| `scripts/repair-recipe-shadow-tables.sql` | **YENİ** — kalıcı veri onarım betiği |
| `src/.../Domain/Entities/Recipe.cs` | `HydrateFromExplicitIngredients()` metodu eklendi |
| `src/.../Api/Controllers/RecipeMatchController.cs` | Orphan fallback + PARTIAL_MATCH eşiği genişletildi + diagnose endpoint geliştirildi |
| `src/.../Api/Controllers/KitchenController.cs` | Aynı orphan fallback eklendi |

---

## Sonraki Adımlar

1. **Veritabanına SQL betiğini çalıştırın:**
   ```
   psql -U <kullanıcı> -d <veritabanı> -f scripts/repair-recipe-shadow-tables.sql
   ```
   Çıktıda `status = OK` görmelisiniz.

2. **Diagnose endpoint'i çağırın:**
   ```
   GET /api/recipes/match/diagnose
   ```
   `ShadowTableMismatch: false` beklentisi var "Etli Kuru Fasulye" için.

3. **Eşleşmeyi test edin:**
   ```json
   POST /api/recipes/match
   { "ingredientIds": ["<kuruFasulyeId>", "<domatesId>", "<tuzId>", "<pulBiberId>"] }
   ```
   Yanıtta `"Etli Kuru Fasulye"` ve `"sourceType": "LINKED_CLINIC_PRIVATE"` beklentisi var.

4. **Test durumu:** 170 test geçiyor, 0 başarısız.
