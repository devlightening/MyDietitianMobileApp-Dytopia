# Market Fişi → Dolap Takibi → Akıllı Alternatif Sistemi

**Tarih:** 2026-04-26  
**Durum:** Plan — Henüz implement edilmedi  
**İlgili:** Hoca talebi — kullanıcı fişini okutarak dolabını takip etsin, alternatif algoritmaya entegre olsun

---

## Büyük Resim

```
Fiş Fotoğrafı
     │
     ▼
  OCR Motoru
     │
     ▼
 Ürün İsimleri
     │
     ▼
Ingredient Eşleştirme ──────────────────────────────────────────────────────┐
(Katmanlı: exact → alias → fuzzy → LLM)                                     │
     │                                                                        │
     ▼                                                                        │
UserPantryItems (DB)                                                          │
     │                                                                        │
     ├──→ PantryScreen (Dolabım ekranı)                                       │
     │                                                                        │
     ├──→ CheckIngredientsScreen (önceden dolu gelir) ──→ Alternatif Algo    ◄┘
     │
     └──→ Haftada 2 Bildirim (dolap durumu + eksik malzeme önerisi)
```

**Temel prensip:** Alternatif algoritması hiç değişmez. Mobil taraf, ekran açılırken dolap verisiyle malzemeleri önceden seçili getiriyor. Arayüz kontratı (`clientAvailableIngredients` listesi) zaten doğru tasarlanmış.

---

## Faz 1 — Veritabanı ve Domain Katmanı

### Yeni Tablo: `UserPantryItems`

| Kolon | Tip | Açıklama |
|---|---|---|
| `Id` | Guid PK | |
| `ClientId` | Guid FK → Clients | |
| `IngredientId` | Guid FK → Ingredients | |
| `IsActive` | bool | `true` = dolabında var, `false` = bitti |
| `Source` | string | `"receipt_scan"` \| `"manual"` \| `"shopping_list"` |
| `AddedAt` | DateTime | |
| `LastConfirmedAt` | DateTime | Kullanıcının en son "evet hâlâ var" dediği zaman |

**Kurallar:**
- `IsActive = false` olan kayıtlar **silinmez**, tarihçe için tutulur.
- Aynı `ClientId + IngredientId` çifti tek kayıttır → varsa `IsActive = true` UPDATE, yoksa INSERT (upsert).
- `ClientId + IngredientId` üzerine **UNIQUE constraint**.

### Yeni Tablo: `ReceiptScanLogs`

| Kolon | Tip | Açıklama |
|---|---|---|
| `Id` | Guid PK | |
| `ClientId` | Guid FK | |
| `ScannedAt` | DateTime | |
| `RawOcrText` | text | Ham OCR çıktısı (debug + model iyileştirme için) |
| `ExtractedLines` | json | OCR'dan ayrıştırılan satırlar dizisi |
| `MatchedIngredientCount` | int | |
| `UnmatchedLines` | json | Eşleşemeyen satırlar (gelecekte model iyileştirme için) |
| `Status` | string | `"completed"` \| `"partial"` \| `"failed"` |

### Domain Değişiklikleri

- `UserPantryItem` entity — basit veri nesnesi, business logic içermiyor
- `IUserPantryRepository` interface
- Domain içinde yeni servis **yok** — sade CRUD yeterli

---

## Faz 2 — OCR ve Ingredient Eşleştirme (Backend)

Bu faz sistemin en kritik teknik parçası.

### 2A — OCR Motoru Seçimi

Türkçe market fişleri için karşılaştırma:

| Motor | Avantaj | Dezavantaj |
|---|---|---|
| **Azure Computer Vision Read API** | Türkçe desteği çok iyi, fatura detayını iyi okur | Ücretli (~$0.001/görüntü) |
| **Google Vision API** | En güçlü genel OCR, Türkçe mükemmel | Ücretli |
| **Tesseract (local)** | Ücretsiz | Türkçe fişlerde gürültülü, düşük doğruluk |
| **AWS Textract** | Fatura/fiş için optimize | Ücretli, kurulum daha zor |

**Öneri: Azure Computer Vision `Read API`**  
`tr` locale seçimi, pricing küçük ölçekte çok düşük (1000 tarama ≈ $1).

### 2B — Ingredient Eşleştirme Stratejisi (Katmanlı)

Fiş OCR çıktısı tipik örnek:
```
ERIKLI SU 0,5L         3,50 TL
PINAR TAM YAG SUT     28,90 TL
FILIZ MAKARNA 500G    24,00 TL
YUMURTA 10LU          45,00 TL
```

Bu satırları canonical ingredient'a çevirmek için **4 katmanlı eşleştirme:**

#### Katman 1 — Exact Match
`CanonicalName` ile birebir karşılaştır.  
Örn: `"Yumurta"` → Ingredients tablosunda direkt bulunur.

#### Katman 2 — Alias Match
`Ingredients.aliases` JSON alanındaki takma adlarla karşılaştır.  
Örn: `aliases: ["Yumurta 10lu", "Eggs", "Tavuk yumurtası"]` → eşleşir.

#### Katman 3 — Token Bazlı Fuzzy Match
OCR satırını tokenize et → marka/gramaj stopword'lerini at → kalan anahtar token'ları Levenshtein mesafesiyle eşleştir.

```
"PINAR TAM YAG SUT"
  → ["pinar"(marka:at), "tam"(sıfat:at), "yag"(sıfat:at), "sut"(anahtar:tut)]
  → "Süt" → %85 skor → eşleşti
```

**Marka stop-word listesi** (config veya ayrı tablo):  
Pınar, Ülker, Tikveşli, Torku, Sek, Dimes, Erikli, Nestlé, Aytaç, Banvit, Arifoğlu, Yaşar, vb.

#### Katman 4 — LLM Assisted (Opsiyonel / İleride)
Eşleşemeyen satırları Claude API'ye toplu gönder:  
> "Bu Türk marketi ürünü hangi temel gıda maddesine karşılık gelir?"

Gerçek zamanlı değil — haftada bir batch job olarak çalıştırılabilir, sonuçlar alias tablosuna eklenir.

#### Güven Seviyelerine Göre Akış

| Skor | Eylem |
|---|---|
| **> 80%** | Direkt pantry'e ekle, kullanıcıya sadece özet göster |
| **50–80%** | Kullanıcıya sor: `"PINAR TAM YAG" → Süt mi?` `[Evet]` `[Değiştir]` |
| **< 50%** | "Eşleştirilemeyen ürünler" listesi → kullanıcı manuel eşleştirir veya atlar |

### 2C — Backend Endpoint'leri

```
POST   /api/receipt/scan
  Body:     { imageBase64: string }
  İşlem:    OCR → katmanlı eşleştirme → log kaydet
  Response: {
    highConfidence:     [{ line, ingredientId, ingredientName, score }],
    needsConfirmation:  [{ line, candidateIngredientId, candidateName, score }],
    unmatched:          [{ line }]
  }

POST   /api/pantry/confirm-batch
  Body:     { ingredientIds: Guid[], source: "receipt_scan" | "manual" }
  İşlem:    Upsert — varsa IsActive=true, yoksa INSERT

GET    /api/pantry
  Response: Aktif + pasif pantry öğeleri (ClientId JWT'den)

PATCH  /api/pantry/{ingredientId}/toggle
  İşlem:    IsActive true↔false geçişi + LastConfirmedAt güncelle

DELETE /api/pantry/{ingredientId}
  İşlem:    Soft delete → IsActive = false
```

---

## Faz 3 — Mobil Ekranlar

### 3A — Yeni Ekran: `PantryScreen` (Dolabım)

Bottom bar'a yeni sekme veya Profil altında sayfa olarak eklenebilir.

```
┌─────────────────────────────────────┐
│  🧺 Dolabım                          │
├─────────────────────────────────────┤
│  [📸 Fiş Tarat]  [+ Manuel Ekle]    │
├─────────────────────────────────────┤
│  AKTİF — 17 ürün                    │
│  ✓ Yumurta       [Var ✓] [Bitti ✗]  │
│  ✓ Süt           [Var ✓] [Bitti ✗]  │
│  ✓ Tavuk Göğsü   [Var ✓] [Bitti ✗]  │
│  ✓ Un            [Var ✓] [Bitti ✗]  │
│  ...                                 │
├─────────────────────────────────────┤
│  EKSİK / BİTEN — 5 ürün             │
│  ✗ Soğan                            │
│  ✗ Domates                          │
│  ✗ Zeytinyağı                       │
└─────────────────────────────────────┘
```

Her satırda toggle → `PATCH /api/pantry/{ingredientId}/toggle`

### 3B — Yeni Ekran: `ReceiptScanScreen`

Mevcut `BarcodeScanScreen.tsx` ve `IngredientScanScreen.tsx` yapısına benzer, aynı kamera bileşeni kullanılabilir.

**Aşama 1 — Görüntü al:**
```
┌─────────────────────────────────────┐
│         [ Kamera Görüntüsü ]        │
│                                     │
│  [📷 Fotoğraf Çek] [🖼 Galeriden]   │
└─────────────────────────────────────┘
```

**Aşama 2 — İşleniyor:**
```
  ⏳ Fiş okunuyor...
  Malzemeler eşleştiriliyor...
```

**Aşama 3 — Sonuç ve Onay:**
```
┌─────────────────────────────────────┐
│  ✓ EŞLEŞTİ (12 ürün)               │
│    Yumurta, Süt, Tavuk, Un...       │
│                                     │
│  ? ONAY GEREKİYOR (3 ürün)         │
│  "PINAR TAM YAG" → Süt mü?         │
│    [Evet] [Hayır, değiştir]         │
│                                     │
│  ✗ EŞLEŞTİRİLEMEDİ (2 satır)      │
│    "ELMA SUYU"  [Eşleştir] [Atla]  │
│    "AYRAN 200G" [Eşleştir] [Atla]  │
│                                     │
│       [Dolabıma Ekle 12 Ürün]       │
└─────────────────────────────────────┘
```

### 3C — Mevcut Ekran Güncellemesi: `CheckIngredientsScreen`

**Küçük değişiklik — büyük etki.**

```
Mevcut:  Tüm malzemeler işaretsiz → kullanıcı tek tek seçiyor
Yeni:    GET /api/pantry çağrılır → aktif pantry öğeleri önceden ✓ işaretli gelir
         Kullanıcı sadece farklılıkları düzenler
```

Kod değişikliği: ekran mount'ta `GET /api/pantry` → dönen `ingredientId` listesi → `selectedIds` state'ine yükle. Alternatif algoritması endpoint'i değişmez.

---

## Faz 4 — Bildirim Sistemi (Haftada 2)

### Zamanlama

Backend'de **Hangfire** veya **.NET Hosted Service**:
- **Pazartesi 09:00**
- **Perşembe 09:00**

### Bildirim Mantığı (Her Client İçin)

```
1. Aktif pantry öğelerini çek
2. Bu haftanın plan malzemelerini çek
3. Eşleştir → eksik malzemeleri hesapla
4. Senaryo belirle → bildirim gönder
```

**Senaryo A — Dolap yeterli:**
> "Dolabın hazır! 🥗 Bu hafta 5 tarifini yapabilirsin. Akşam: Fırın Tavuk, Salı: Mercimek Çorbası..."

**Senaryo B — Eksik malzeme var:**
> "3 malzeme eksik! 🛒 Domates, Soğan ve Zeytinyağı alışveriş listene eklendi."

**Senaryo C — Dolap 5+ gündür güncellenmedi:**
> "Dolabın 5 gündür güncellenmedi. Hâlâ aynı ürünler var mı? [Güncelle]"

### Push Notification Altyapısı

- **React Native tarafı:** Expo Notifications
- **Servis:** Firebase Cloud Messaging (FCM) — Android + iOS
- **Yeni DB tablosu:** `DeviceTokens` → `ClientId + DeviceToken + Platform + RegisteredAt`
- **Backend:** `PushNotificationService` → FCM API çağrısı

---

## Faz 5 — Alternatif Algoritması Entegrasyonu

### Mevcut Akış
```
CheckIngredientsScreen
  → kullanıcı elle seçiyor
  → POST /api/alternative/decide { clientAvailableIngredients: [...] }
  → algoritma çalışıyor
```

### Yeni Akış
```
CheckIngredientsScreen açılır
  → GET /api/pantry  (otomatik)
  → aktif pantry öğeleri önceden seçili gelir
  → kullanıcı isteğe göre düzenler
  → POST /api/alternative/decide { clientAvailableIngredients: [...] }  ← değişmez!
```

**Algoritma kodu değişmez.** Sadece mobilde başlangıç state'i dolap verisinden geliyor.

**Gelecek iyileştirme (opsiyonel):** `/api/alternative/decide` endpoint'ine `pantryAsBaseline: true` parametresi eklenebilir → ingredient listesi server-side'da dolap'tan otomatik çekilir, mobil taraf göndermek zorunda kalmaz.

---

## Teknik Riskler ve Çözümleri

| Risk | Çözüm |
|---|---|
| OCR Türkçe özel karakter hatası (ş, ğ, ı) | Azure Vision `tr` locale parametresi zorunlu set edilmeli |
| "Pınar Süt" → "Süt" eşleştirme başarısızlığı | Marka stop-word listesi + token bazlı matching katmanı |
| Kullanıcı dolabını güncellemeyi unutur | 5 günde bir "hâlâ geçerli mi?" micro-notification |
| Aynı malzeme iki kez eklenir | `ClientId + IngredientId` UNIQUE constraint + upsert mantığı |
| OCR API maliyeti | ~$0.001/görüntü → 1000 tarama = $1, ihmal edilebilir |
| Fiş yerine farklı görüntü gönderilirse | MIME type kontrolü + OCR confidence threshold + log |
| Dolap verisi eskiyince algoritma yanlış sonuç verir | `LastConfirmedAt` takibi + bildirim tetikleyicisi |

---

## Geliştirme Sırası (Önerilen)

```
Sprint 1  → UserPantryItems + ReceiptScanLogs tabloları + migration
Sprint 2  → Pantry CRUD endpoint'leri + PantryScreen mobil UI
Sprint 3  → Azure OCR entegrasyonu + exact/alias eşleştirme servisi
Sprint 4  → ReceiptScanScreen + eşleştirme onay akışı
Sprint 5  → CheckIngredientsScreen pantry pre-load entegrasyonu
Sprint 6  → Bildirim sistemi (FCM + Hangfire job)
Sprint 7  → Fuzzy matching iyileştirme + unmatch log analizi
Sprint 8  → (Opsiyonel) LLM-assisted eşleştirme batch job
```

---

## Etkilenen Katmanlar — Özet

| Katman | Değişiklik Türü |
|---|---|
| **Veritabanı** | 2 yeni tablo: `UserPantryItems`, `ReceiptScanLogs` |
| **Domain** | `UserPantryItem` entity, `IUserPantryRepository` interface |
| **Application** | Pantry CRUD commands/queries, Receipt scan query handler |
| **Infrastructure** | `AzureOcrService`, `IngredientMatchingService`, `PantryNotificationJob` |
| **API** | `PantryController`, `ReceiptController` |
| **Mobil** | 2 yeni ekran (`PantryScreen`, `ReceiptScanScreen`), `CheckIngredientsScreen` küçük güncelleme |
| **Alternatif Algoritması** | **Değişmiyor** — mobil taraftan önceden dolu liste geliyor |
