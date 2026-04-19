# Alternatif Tarif Sistemi — Teknik Dokümantasyon

**Dosya:** `AlternativeMealDecisionService.cs`  
**Katman:** Infrastructure → Domain → Application (CQRS: `DecideAlternativeMealQuery`)

---

## Genel Bakış

Kullanıcı elindeki malzemeleri seçip bir öğün için "Alternatif bul" dediğinde devreye giren sistemdir. Sistem iki şeyi yapar:

1. Orijinal planlanmış tarifi pişirip pişiremeyeceğini değerlendirir.
2. Pişiremiyorsa (veya malzeme uyumu düşükse) en uygun alternatifleri sıralayarak önerir.

---

## Akış Diyagramı

```
Kullanıcı malzeme listesi gönderir
            │
            ▼
  Orijinal tarif değerlendirmesi
            │
   ┌────────┴────────┐
   │                 │
Zorunlu malzeme   Uyum ≥ %80
  eksik / yasak      │
   │                 ▼
   │          "Orijinali pişirebilirsin"
   │                 ■
   ▼
Uyum < %80  ──── aynı akışa girer ───►  FindAlternativesAsync
                                                  │
                                    Diyetisyenin tüm tarifleri (orijinal hariç)
                                                  │
                                         Her tarife CombinedScore hesapla
                                                  │
                                         En yüksek 5 tarifi döndür
```

---

## Karar Mantığı

### Adım 1 — Orijinal Tarif Değerlendirmesi

| Durum | Sonuç |
|---|---|
| Zorunlu malzeme eksik | Alternatif ara |
| Yasaklı malzeme içeriyor | Alternatif ara |
| Malzeme uyumu **≥ %80** | ✅ "Orijinali pişirebilirsin" mesajı dön |
| Malzeme uyumu **< %80** | Alternatif ara |

### Adım 2 — Aday Havuzu

- Sadece **aynı diyetisyene** ait tarifler aranır.
- Orijinal tarif listeden çıkarılır.
- Başka diyetisyenlerin tarifleri **hiçbir zaman** önerilmez.

### Adım 3 — Puanlama (CombinedScore)

Her aday tarif iki ayrı skor alır:

```
CombinedScore = (%40 × Malzeme Uyumu) + (%60 × Besin Değeri Yakınlığı)
```

---

## Puanlama Detayları

### Malzeme Uyumu Skoru (%40 ağırlık)

`RecipeRecommendationEngine` tarafından hesaplanır.

- Kullanıcının elindeki malzeme listesi orijinal tarife kıyasla değil, **aday tarife** kıyasla ölçülür.
- **İkame (substitute) malzeme desteği** vardır: Tarif tereyağı istiyorsa, kullanıcının elinde margarin varsa bu da sayılır. Uyumluluk tipi `IngredientTaxonomyService` üzerinden sorgulanır.

### Besin Değeri Yakınlık Skoru (%60 ağırlık)

Aday tarifin orijinalden ne kadar saptığı, makro bazında tolerans bantlarıyla ölçülür:

| Makro | Skor Ağırlığı | Tolerans Bandı | Açıklama |
|---|---|---|---|
| **Protein** | **%40** | ±%20 | En kritik kriter |
| Kalori | %25 | ±%20 | — |
| Yağ | %25 | ±%25 | — |
| Karbonhidrat | %10 | ±%30 | En esnek kriter |

**Formül (her makro için):**

```
makroSkor = max(0, 1 − (|aday − hedef| / hedef) / tolerans) × ağırlık
```

Örnek: Hedef protein 30g, aday 33g, tolerans ±%20:
```
fark oranı = |33 - 30| / 30 = 0.10  (yani %10 sapma)
sapma / tolerans = 0.10 / 0.20 = 0.5
makroSkor = max(0, 1 - 0.5) × 40 = 20 / 40 → %50 tam puandan
```

**Özel durumlar:**
- Orijinal tarifin besin verisi yoksa → Besin skoru nötr **50** atanır.
- Adayın besin verisi yoksa → Besin skoru **0** atanır.
- Ağırlığı olan ama değeri olmayan makro hesaba katılmaz; kalan makrolar normalize edilir.

---

## Maksimum Öneri Sayısı

```csharp
private const int MaxAlternatives = 5;
```

`CombinedScore`'a göre azalan sırada **en iyi 5 tarif** döndürülür.

---

## API Katmanı

### İstek

```
POST /api/client/meals/{mealItemId}/alternatives/decide
```

**Body:**
```json
{
  "availableIngredientIds": ["guid1", "guid2", "..."]
}
```

### Yanıt

```json
{
  "canCookOriginal": false,
  "missingIngredients": ["Somon", "Dereotu"],
  "explanation": "Missing mandatory ingredients: Somon, Dereotu",
  "alternativeRecommendations": [
    {
      "recipeId": "...",
      "recipeName": "Baharatlı Fit Ton Balığı Ezmesi",
      "matchPercentage": 92.5,
      "missingIngredientsForAlternative": [],
      "nutritionalComparison": "+3g Protein · −40 kcal",
      "caloriesKcal": 310,
      "proteinGrams": 28.0,
      "carbsGrams": 12.0,
      "fatGrams": 14.0,
      "nutritionalScore": 87.3,
      "combinedScore": 90.1
    }
  ]
}
```

---

## İkame (Substitute) Malzeme Sistemi

`IngredientTaxonomyService` bileşeni, malzeme uyumluluklarını bir taksonomi ağacı üzerinden çözer. Uyumluluk seviyeleri:

| Seviye | Açıklama |
|---|---|
| `ExactMatch` | Aynı malzeme |
| `SubstituteAllowed` | İkame kabul edilir |
| `PartialSubstitute` | Kısmi ikame (puan düşer) |
| `Incompatible` | Uyumsuz |

Minimum eşik `SubstituteAllowed` olarak ayarlıdır. Bunun altındaki adaylar ikame olarak sayılmaz.

---

## Loglama

Her karar (orijinal pişirilebilir veya alternatif) `RecipeRecommendationLog` tablosuna yazılır. Log kaydı başarısız olsa bile ana karar akışı etkilenmez (`try/catch` ile izole edilmiştir).

**Kaydedilen alanlar:**
- `flow` — "alternative_decision"
- `originalCookable` — orijinal pişirilebilir mi
- `matchPercentage` — malzeme uyum yüzdesi
- `missingMandatoryCount` — eksik zorunlu malzeme sayısı
- `prohibitedRejected` — yasaklı malzeme nedeniyle mi reddedildi
- `usedSubstitutes` — ikame malzeme kullanıldı mı
- `missingMandatoryNamesJson` — eksik malzeme adları
- `rejectionReasonSummary` — red gerekçesi özeti

---

## Özet

> Sistem, **"elindekilerle en rahat pişirebileceğin ve besin değeri olarak orijinaline en yakın"** tarifi öne çıkarır.  
> Protein içeriği en kritik eşleştirme kriteridir (%40 ağırlık).  
> Karbonhidrat en esnek bırakılan kriterdir (%10 ağırlık, ±%30 tolerans).  
> Tüm öneriler yalnızca danışanın bağlı olduğu diyetisyenin tarif havuzundan seçilir.
