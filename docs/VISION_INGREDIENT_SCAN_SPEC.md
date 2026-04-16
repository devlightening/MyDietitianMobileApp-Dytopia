# Vision Ingredient Scan — Özellik Spesifikasyonu

**Versiyon:** 1.0
**Tarih:** 2026-03-28
**Durum:** Implementasyon tamamlandı ✅

---

## Özet

Kullanıcı buzdolabı, market çantası veya mutfak tezgahının fotoğrafını çeker. GPT-4o Vision görüntüdeki tüm yiyecekleri tespit eder. Her tespit, mevcut 4-katmanlı ingredient normalizasyon pipeline'ından geçirilir ve eşleşen malzemeler Kitchen ekranındaki sepete otomatik eklenir.

---

## Kullanıcı Akışı

```
KitchenScreen
  └── [📷] kamera ikonu (IngredientSearch yanında)
        ↓
  IngredientScanScreen — picker fazı
        ↓  (kamera / galeri seç)
  IngredientScanScreen — analyzing fazı
        │  POST /api/ingredients/analyze-image
        ↓
  IngredientScanScreen — results fazı
        │  checkbox listesi (pre-selected = hepsi)
        ↓  [X malzeme ekle]
  KitchenScreen — seçilen malzemeler sepete eklendi
```

---

## Mimari Kararlar

| Konu | Karar | Sebep |
|------|-------|-------|
| Vision modeli | `gpt-4o` | Görsel tanıma kalitesi için mini değil full model |
| Görüntü taşıma | Base64 JSON body | GPT-4o bunu doğrudan destekliyor, multipart gereksiz |
| `detail` seviyesi | `"low"` | ~65 token, yiyecek tespiti için yeterli |
| Mobil paket | `expo-image-picker` | Kamera + galeri tek paket, Expo 54 uyumlu |
| HttpClient | Mevcut `"openai"` client reuse | Aynı API key, ikinci registration guard'ı var |
| Hata yönetimi | Silent-fail (boş liste döner) | `IIngredientLlmClient` ile aynı sözleşme |

---

## Yeni Dosyalar

### Backend

| Dosya | Açıklama |
|-------|----------|
| `Domain/Services/VisionIngredientOptions.cs` | Config: model, timeout, maxItems, maxBytes |
| `Domain/Services/IVisionIngredientService.cs` | Interface: `DetectFoodNamesAsync()` |
| `Infrastructure/Services/VisionIngredientService.cs` | GPT-4o Vision impl — `OpenAiIngredientLlmClient` patternini takip eder |
| `Infrastructure/Services/NullVisionIngredientService.cs` | Disabled hali (boş liste) |
| `Application/Commands/AnalyzeIngredientImageCommand.cs` | Command + Result tipleri |
| `Application/Handlers/AnalyzeIngredientImageCommandHandler.cs` | Vision → parallel normalize → deduplicate |

### Mobile

| Dosya | Açıklama |
|-------|----------|
| `src/api/vision.ts` | `analyzeIngredientImage()` — 35s timeout |
| `src/screens/IngredientScanScreen.tsx` | 3 fazlı ekran: picker / analyzing / results |

### Değiştirilen Dosyalar

**Backend:**
- `Api/Controllers/IngredientController.cs` — `POST /api/ingredients/analyze-image` endpoint'i eklendi
- `Api/Program.cs` — VisionIngredientService kaydı + `"kitchen-vision"` rate limit policy
- `Api/appsettings.json` — `VisionIngredient` config section
- `Api/appsettings.Development.json` — `Enabled: true`

**Mobile:**
- `app.json` — Kamera izinleri (iOS infoPlist + Android permissions + expo-image-picker plugin)
- `src/navigation/routes.ts` — `IngredientScan` route eklendi
- `src/navigation/RootNavigator.tsx` — Modal screen kaydı
- `src/screens/KitchenScreen.tsx` — `handleScanPress()` + kamera butonu + StyleSheet

---

## API Endpoint

```
POST /api/ingredients/analyze-image
Authorization: Bearer <client-token>
Content-Type: application/json
Rate Limit: 10 istek / 5 dakika / kullanıcı

Body:
{
  "base64Image": "<base64-string>",
  "mediaType": "image/jpeg"   // "image/jpeg" | "image/png" | "image/webp"
}

Response 200:
{
  "totalDetected": 3,
  "matched": [
    {
      "ingredientId": "3fa85f64-...",
      "canonicalName": "Domates",
      "confidence": 1.0,
      "detectedName": "domates",
      "matchedBy": "Canonical"
    }
  ],
  "unmatched": ["mozarella peyniri"]
}

Response 400: { "error": "..." }
Response 429: TooManyRequests (rate limit aşıldı)
```

---

## Konfigürasyon

```json
"VisionIngredient": {
  "Enabled": false,        // appsettings.Development.json'da true
  "ModelName": "gpt-4o",
  "ApiKeyEnvVar": "OPENAI_API_KEY",
  "MaxDetectedItems": 20,
  "MaxImageBytes": 4194304,
  "TimeoutSeconds": 30
}
```

Production'da aktif etmek için: `VisionIngredient__Enabled=true` environment variable veya appsettings.Production.json.

---

## Handler Akışı

```
AnalyzeIngredientImageCommandHandler
  1. _visionService.DetectFoodNamesAsync()
     → OpenAI GPT-4o: görüntüdeki yiyecekleri listele
     → { "items": ["domates", "yumurta", "peynir"] }

  2. SemaphoreSlim(5) paralel normalizasyon
     → _normalizationService.NormalizeAsync(rawName)
     → 4-layer: Canonical → Alias → Fuzzy → LLM

  3. Matched / Unmatched ayrımı
     → Status == Matched → matched[]
     → diğerleri → unmatched[]

  4. Deduplication
     → Aynı IngredientId → yüksek confidence'lı tut

  5. AnalyzeIngredientImageResult döndür
```

---

## Veritabanı

**Migrasyon gerekmez.** Yeni tablo açılmıyor.
`IngredientNormalizationLog` tablosu her vision-triggered normalizasyonu otomatik kaydeder (mevcut infrastructure).

---

## Test Planı

### Backend Unit Tests
- `VisionIngredientService`: Mock HTTP 200 → item listesi döner
- `VisionIngredientService`: Mock HTTP 500 → boş liste, exception yok
- `Handler`: Deduplication — aynı IngredientId → tek sonuç

### Smoke Test
```bash
# 1. Backend başlat (OPENAI_API_KEY env var + VisionIngredient__Enabled=true)
# 2. Bruno/Postman ile:
POST /api/ingredients/analyze-image
{
  "base64Image": "<domates fotoğrafı base64>",
  "mediaType": "image/jpeg"
}
# Beklenen: HTTP 200, matched içinde "Domates"
```

### Mobile E2E
1. `npx expo start` → Kitchen → kamera ikonu
2. Galeri seç → analiz
3. Results ekranı → bir item deselect → "X malzeme ekle"
4. KitchenScreen'de sadece seçilenler görünüyor

### Edge Cases
- Görüntüde yiyecek yok → `totalDetected: 0` → "Tespit edilemedi" mesajı
- `Enabled: false` → boş result, HTTP 200 (hata değil)
- 35s Axios timeout → catch → picker fazına dön
- Tüm matched deselect → "Ekle" butonu disabled
- Rate limit (11. istek) → HTTP 429

---

## Önemli Notlar

- `"detail": "low"` kullanımı token maliyetini ~15x düşürür (1000+ → ~65 token)
- GPT-4o vision çağrısı 10-20s sürebilir — mobil Axios timeout 35s'ye ayarlandı
- `NullVisionIngredientService` sayesinde `Enabled: false` ile backend sağlıklı çalışmaya devam eder
- Mevcut ingredient normalizasyonu LLM Layer'ı da bu özellik sayesinde kullanım görür (vision tarafından üretilen Türkçe isimler normalize edilirken)
