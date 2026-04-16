# Diyet Planı Sistemi — Gözden Geçirilmiş Mühendislik Planı

> **Tarih:** 2026-04-11  
> **Kapsam:** Web panel plan oluşturma verimliliği + Mobil detay görünümü  
> **Revizyon:** ChatGPT peer-review feedback'i entegre edildi (isimlendirme, faz sırası, conflict mode, service katmanı)

---

## Problem Tanımı

Diyetisyen, her danışan için her günü **elle tek tek** öğün giriyor.  
20 danışan × 7 gün × 4 öğün = **haftada 560 tıklama**.

| # | Sorun | Etki |
|---|-------|------|
| 1 | **Kopya yok** | Pazartesi planı Salı'ya taşınamıyor, her şey sıfırdan |
| 2 | **Şablon yok** | "Standart kahvaltı setim" kaydedilemiyor |
| 3 | **Tarif entegrasyonu yok** | `PlanMealItem.RecipeId` alanı var ama UI'da kullanılmıyor |
| 4 | **Toplu yayın yok** | 7 günü tek tek yayınlamak zorunda |
| 5 | **Mobil sadece başlık gösteriyor** | Makro, tarif içeriği, hazırlık notu görünmüyor |

**Hedef:** Diyetisyen bir haftayı 5 dakikada oluşturup yayınlasın. Danışan mobilde öğününün tam detayını görsün.

---

## Mevcut Sistem — Dokunulmayacak Katmanlar

| Katman | Durum | Not |
|--------|-------|-----|
| `MealPlan` + `PlanMealItem` + `MealCompletion` **(System A)** | ✅ Aktif | **Temel alınacak** |
| `DietPlan` / `DietPlanDay` / `MealItem` **(System B)** | ⚠️ Legacy | Yoksay |
| `ClientMealPlan` / `ClientMeal` **(System C)** | ⚠️ Eski | Yoksay |
| `DietitianDailyPlanController` | ✅ Değiştirilmeyecek | Yeni action'lar eklenecek |
| `ClientPlanController` — mobil API | ✅ Dokunulmayacak | Yeni endpoint gerekmez |
| `web-panel/app/dashboard/plans/page.tsx` | ✅ Genişletilecek | — |
| `mobile-app/src/screens/PlansScreen.tsx` | ✅ Genişletilecek | — |

---

## Mimari Kurallar (Peer-Review Revizyonu)

### 1. İsimlendirme — Aktif Sistemle Tutarlı

Yeni entity'ler `MealPlan...` prefix'i taşımalı. `DietPlan...` prefix'i legacy (System B) anlamına geldiğinden karışıklığa yol açar.

| ❌ Eski Plan | ✅ Doğru |
|-------------|----------|
| `DietPlanTemplate` | `MealPlanTemplate` |
| `DietPlanTemplateItem` | `MealPlanTemplateItem` |
| `DietPlanTemplateController` | `MealPlanTemplateController` |
| Migration `AddDietPlanTemplates` | Migration `AddMealPlanTemplates` |

### 2. Service Katmanı

Copy, bulk-publish ve template işlemleri iş mantığı içerdiğinden controller içine gömülmemelidir. Her yeni işlev için bir service sınıfı oluşturulur, controller sadece request/response dönüşümü yapar.

```
src/MyDietitianMobileApp.Application/
  └── Services/
      ├── CopyMealPlanService.cs        (copy-day + copy-week mantığı)
      ├── BulkPublishMealPlanService.cs  (bulk-publish mantığı)
      └── MealPlanTemplateService.cs     (template CRUD + apply mantığı)
```

Controller action'ları bu service'lere delege eder:
```csharp
[HttpPost("clients/{clientId:guid}/copy-day")]
public async Task<IActionResult> CopyDay(Guid clientId, [FromBody] CopyDayRequest req)
    => Ok(await _copyService.CopyDayAsync(dietitianId, clientId, req));
```

### 3. Conflict Mode — Geleceğe Açık API

Copy endpoint'leri ilk sürümde sadece `skip` destekler ama sözleşme genişletilebilir:

```json
{
  "sourceDate": "...",
  "targetDate": "...",
  "conflictMode": "skip"
}
```

İleride desteklenecek değerler: `skip` | `overwrite` | `merge`. İlk sürümde `skip` dışındaki değerler `400` döner.

### 4. Haftalık Şablon — YAGNI

İlk sürümde **sadece gün şablonu** uygulanır. Haftalık şablon (`WeekTemplate`) veri modelini gereksiz karmaştırır, kullanım ihtiyacı doğrulandıktan sonra ayrı bir migration ile eklenir.

---

## Uygulama Sırası (Revize Edilmiş)

```
Faz 1 — Hızlı Kazanım (backend + web panel, ~1 gün)
  ├── Tarif entegrasyonu — öğün modalına tarif arama + auto-fill
  ├── copy-day endpoint + UI butonu
  └── copy-week endpoint + UI butonu

Faz 2 — Yayın & Mobil (~yarım gün)
  ├── bulk-publish endpoint + "Tümünü Yayınla" butonu
  ├── Mobil makro özet barı (PlansScreen)
  └── Mobil öğün detay bottom sheet (PlansScreen)

Faz 3 — Şablon Sistemi (migration var, dikkatli yürü, ~1-2 gün)
  ├── MealPlanTemplate + MealPlanTemplateItem entity
  ├── AppDbContext güncellemesi
  ├── Migration: AddMealPlanTemplates
  ├── MealPlanTemplateService + MealPlanTemplateController
  └── Web panel şablon paneli

Vizyon — Gelecek Sprint (şimdi uygulanmaz)
  ├── Haftalık şablon (WeekTemplate)
  ├── Drag & drop haftalık planlayıcı
  ├── AI taslak planlayıcı
  └── Öğün geri bildirimi (sevmedim / tok tutmadı / hazırlaması zordu)
```

> **Faz sırası değişikliğinin gerekçesi:** Tarif entegrasyonu saf bir frontend değişikliği — backend zaten `RecipeId` destekliyor. Copy/week operasyonlar var olan kötü içeriği çoğaltır; içerik kalitesini ilk önce iyileştirmek daha mantıklı.

---

## Faz 1 — Detay

### Özellik A: Tarif Entegrasyonu (Öğün Modalında)

**Dosya:** `web-panel/app/dashboard/plans/page.tsx` (AddMealModal bileşeni)

Modal'a opsiyonel **"Tarif Bağla"** bölümü ekle:
- Debounced arama input'u (300ms, min 2 karakter)
- Endpoint: `GET /api/dietitian/recipes?search=x&limit=8` (mevcut endpoint)
- Seçilince: `recipeId` state'e set, `title` + makrolar otomatik dolar (değiştirilebilir)
- "Bağlantıyı Kaldır" butonu

> `AddMealItemRequest` zaten `recipeId?: Guid?` destekliyor. **Backend değişikliği gerekmez.**

```typescript
const [recipeSearch, setRecipeSearch] = useState('');
const debouncedSearch = useDebounce(recipeSearch, 300);

const { data: recipeResults } = useQuery({
  queryKey: ['recipe-search', debouncedSearch],
  queryFn: () => searchRecipes(debouncedSearch),
  enabled: debouncedSearch.length >= 2,
});
```

---

### Özellik B: Günü Kopyala

**Backend — Yeni Servis:**

```csharp
// src/Application/Services/CopyMealPlanService.cs
public class CopyMealPlanService
{
    public async Task<CopyDayResult> CopyDayAsync(
        Guid dietitianId, Guid clientId, CopyDayRequest req, CancellationToken ct)
    {
        // 1. Kaynak plan var mı? → yoksa throw NotFoundException
        // 2. Hedef günde plan var mı? → varsa throw ConflictException
        // 3. PlanMealItem'ları yeni MealPlan'a kopyala (yeni Guid, tarih güncelle, completion yok)
        // 4. Yeni plan Draft statüsünde kaydedilir
    }
}
```

**Backend — Controller Action:**

```csharp
// DietitianDailyPlanController.cs
[HttpPost("clients/{clientId:guid}/copy-day")]
public async Task<IActionResult> CopyDay(Guid clientId, [FromBody] CopyDayRequest req)
    => Ok(await _copyService.CopyDayAsync(GetDietitianId(), clientId, req, ct));

public record CopyDayRequest(
    [Required] DateOnly SourceDate,
    [Required] DateOnly TargetDate,
    string ConflictMode = "skip"   // ilk sürümde yalnızca "skip" geçerli
);
```

**Web Panel:**
- Her gün sütununa `···` action menüsü ekle (hover göster)
- "Günü Kopyala" → modal: hedef tarihi seç → POST copy-day
- Mevcut `publishPlan` / `deletePlan` mutation pattern'ini takip et

```typescript
// web-panel/lib/api/plans.ts'e eklenecek
export async function copyDay(
  clientId: string,
  sourceDate: string,
  targetDate: string,
  conflictMode = 'skip'
): Promise<{ copied: number }>
```

---

### Özellik C: Haftayı Kopyala

**Backend:**

```
POST /api/dietitian/daily-plans/clients/{clientId}/copy-week
Body: {
  sourceWeekStart: "YYYY-MM-DD",   // Pazartesi olmalı
  targetWeekStart: "YYYY-MM-DD",
  conflictMode: "skip"
}
Response: { copied: 5, skipped: 2 }
```

Mantık: `CopyMealPlanService.CopyWeekAsync` — 7 günü döngüyle copy-day mantığını çağırır. Skip modunda çakışan günleri atlar.

**Web Panel:**

Hafta header'ına dropdown butonu:
- "Gelecek haftaya kopyala" → targetWeekStart = +7 gün, otomatik POST
- "Belirli bir haftaya..." → tarih seçici modal

---

## Faz 2 — Detay

### Özellik D: Toplu Yayınla

**Backend:**

```
POST /api/dietitian/daily-plans/clients/{clientId}/bulk-publish
Body: { dates: ["YYYY-MM-DD", ...] }  // max 14
Response: { published: 5, skipped: 2 }
```

Mantık (`BulkPublishMealPlanService`): Her tarih için Draft ≥1 öğün → Published. Diğerleri skip.

**Web Panel:**

Hafta header'ına **"Tümünü Yayınla"** butonu:
- Sadece Draft + ≥1 öğünü olan günleri toplar
- Onay: "3 günlük plan yayınlanacak" → confirm → mutation → invalidate

---

### Özellik E: Mobil Makro Özeti Barı

**Dosya:** `mobile-app/src/screens/PlansScreen.tsx`

Mevcut `items` array'inden `reduce`:
```typescript
const totals = items.reduce((acc, item) => ({
  calories: acc.calories + (item.calories ?? 0),
  protein: acc.protein + (item.proteinGrams ?? 0),
  carbs: acc.carbs + (item.carbsGrams ?? 0),
  fat: acc.fat + (item.fatGrams ?? 0),
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });
```

UI: `P: 148g  |  K: 220g  |  Y: 65g  |  2100 kcal` — renkli pill'ler, hedef yoksa sadece sayı.

---

### Özellik F: Mobil Öğün Detay Bottom Sheet

**Dosya:** `mobile-app/src/screens/PlansScreen.tsx`

Her öğün kartına `onPress` ekle → bottom sheet açılır:

```
┌─────────────────────────────────┐
│  08:00 · Kahvaltı               │
│  Yulaf Ezmesi + Meyve           │
│                                  │
│  Diyetisyen Notu:                │
│  "Süt yerine su ile pişir..."    │
│                                  │
│  P: 12g  K: 45g  Y: 8g  320kcal │
│                                  │
│  [ Tarifini Gör → ]  (opsiyonel) │
│  [ Tamamla ]  [ Alternatif ]     │
└─────────────────────────────────┘
```

Tarif bağlıysa `Routes.App.RecipeDetail` navigate (zaten mevcut). Compliance butonları mevcut logic'i tetikler.

---

## Faz 3 — Detay

### Özellik G: Şablon Sistemi

**Yeni Dosyalar:**

```csharp
// src/Domain/Entities/MealPlanTemplate.cs
public class MealPlanTemplate
{
    public Guid Id { get; private set; }
    public Guid DietitianId { get; private set; }
    public string Name { get; private set; }           // max 100
    public string? Description { get; private set; }   // max 300
    public DateTime CreatedAtUtc { get; private set; }
    public ICollection<MealPlanTemplateItem> Items { get; private set; }

    public static MealPlanTemplate Create(Guid dietitianId, string name, string? description) { ... }
}

// src/Domain/Entities/MealPlanTemplateItem.cs
public class MealPlanTemplateItem
{
    public Guid Id { get; private set; }
    public Guid TemplateId { get; private set; }
    public TimeSpan Time { get; private set; }
    public PlanMealItemType MealType { get; private set; }
    public string Title { get; private set; }          // max 200
    public string? Note { get; private set; }          // max 1000
    public int? Calories { get; private set; }
    public decimal? ProteinGrams { get; private set; }
    public decimal? CarbsGrams { get; private set; }
    public decimal? FatGrams { get; private set; }
    public Guid? RecipeId { get; private set; }
    public int OrderIndex { get; private set; }
}
```

**AppDbContext:**

```csharp
public DbSet<MealPlanTemplate> MealPlanTemplates => Set<MealPlanTemplate>();
public DbSet<MealPlanTemplateItem> MealPlanTemplateItems => Set<MealPlanTemplateItem>();

// OnModelCreating:
modelBuilder.Entity<MealPlanTemplate>(b =>
{
    b.HasKey(x => x.Id);
    b.HasMany(x => x.Items)
     .WithOne()
     .HasForeignKey(x => x.TemplateId)
     .OnDelete(DeleteBehavior.Cascade);
});
```

**Migration:**

```bash
dotnet ef migrations add AddMealPlanTemplates \
  --project src/MyDietitianMobileApp.Infrastructure \
  --startup-project src/MyDietitianMobileApp.Api

dotnet ef database update \
  --project src/MyDietitianMobileApp.Infrastructure \
  --startup-project src/MyDietitianMobileApp.Api
```

**Yeni Controller + Service:**

```
// Endpoints:
GET    /api/dietitian/plan-templates                → liste (id, name, description, itemCount)
POST   /api/dietitian/plan-templates                → yeni şablon (name, description, items[])
DELETE /api/dietitian/plan-templates/{id}           → şablonu sil
POST   /api/dietitian/plan-templates/from-plan      → günden şablon oluştur { planId, name, description }
POST   /api/dietitian/daily-plans/clients/{id}/apply-template → { templateId, targetDate }
```

**Web Panel — Yeni Dosya:** `web-panel/lib/api/plan-templates.ts`

Plans sayfasına şablon yan paneli:
- Şablon listesi (isim + öğün sayısı)
- "Bu günden kaydet" butonu (her gün sütununda)
- Şablon kartına tıkla → "Hangi güne uygulansın?" modalı

---

## Kritik Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/.../Domain/Entities/MealPlanTemplate.cs` | Create |
| `src/.../Domain/Entities/MealPlanTemplateItem.cs` | Create |
| `src/.../Application/Services/CopyMealPlanService.cs` | Create |
| `src/.../Application/Services/BulkPublishMealPlanService.cs` | Create |
| `src/.../Application/Services/MealPlanTemplateService.cs` | Create |
| `src/.../Infrastructure/Persistence/AppDbContext.cs` | Modify — DbSet ekle |
| `src/.../Api/Controllers/DietitianDailyPlanController.cs` | Modify — copy-day, copy-week, bulk-publish, apply-template (delegate to services) |
| `src/.../Api/Controllers/MealPlanTemplateController.cs` | Create |
| Migration `AddMealPlanTemplates` | Create + Apply |
| `web-panel/app/dashboard/plans/page.tsx` | Modify — tarif arama, kopyala butonları, toplu yayınla, şablon panel |
| `web-panel/lib/api/plans.ts` | Modify — copyDay, copyWeek, bulkPublish |
| `web-panel/lib/api/plan-templates.ts` | Create |
| `mobile-app/src/screens/PlansScreen.tsx` | Modify — makro barı + detay bottom sheet |

---

## Doğrulama Adımları

1. `dotnet build` → 0 hata
2. `dotnet ef database update` → migration başarılı, `MealPlanTemplates` tablosu oluştu
3. Öğün modalında tarif ara (min 2 karakter) → dropdown çıkar → seç → başlık + makro dolar
4. Pazartesi planı oluştur → "Günü Kopyala" → Salı → Salı'da öğünler Draft olarak görünür
5. Bir hafta planla → "Tümünü Yayınla" → 7 taslak Published olur
6. Günü şablon kaydet → farklı danışan/tarih → şablon uygula → öğünler gelir
7. Mobil PlansScreen: makro barı görünür (hesaplama doğru)
8. Mobil öğüne tıkla → bottom sheet açılır → not + makro + varsa tarif linki

---

## Faz 2 Sonrası — Usability Checkpoint (Zorunlu)

Faz 2 tamamlandıktan sonra (tarif entegrasyonu + copy-day/week + bulk publish + mobil detay) **gerçek bir diyetisyenle 2-3 gerçek plan oluşturma seansı** yapılmalıdır.

Sorulacak soru: "Hâlâ çok tıklıyor musun?"

- **Evet** → Faz 3 şablon sistemi + drag & drop öncelikli
- **Hayır** → Faz 3 ertelenebilir, mobil compliance iyileştirmeleri öne çekilebilir

Şablon sistemine geçmeden önce bu checkpoint **atlanmamalıdır.**

---

## Gelecek Veri Modeli Notu

`PlanMealItem` tablosuna ileride eklenecek alanlar (şimdi şart değil, migration ile sonra):

```csharp
// Bir öğünün kaynağını izlemek için
public string? SourceType { get; private set; }        // "Manual" | "Recipe" | "Template" | "Copy"
public Guid? SourceReferenceId { get; private set; }   // ilgili template/recipe/plan ID'si
```

Bu alanlar olmadan sistem çalışır. Ama ileride "bu öğün nereden geldi?" sorusunu yanıtlamak, compliance analytics ve hata ayıklama için çok değerli olacak. İlk migration'a dahil edilmesi önerilir ancak zorunlu değildir.

---

## Vizyon — Gelecek Sprintler (Şimdi Uygulanmaz)

| Özellik | Değer |
|---------|-------|
| Haftalık şablon (`WeekTemplate`) | Faz 2 usability checkpoint'ten sonra karar verilecek |
| Drag & drop haftalık planlayıcı | UX leapfrog; müşteri değeri çok yüksek |
| AI taslak planlayıcı | "PCOS başlangıç haftası" prompt → otomatik plan |
| Öğün geri bildirimi (mobil) | "sevmedim / tok tutmadı" → compliance insights |
| Compliance trigger'lar | Düşük uyum → otomatik care hub uyarısı |
