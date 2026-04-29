# Market Fişi -> Pantry Takibi -> Akıllı Alternatif Sistemi v2

**Tarih:** 2026-04-27  
**Durum:** Güçlendirilmiş ürün ve implementasyon planı  
**Amaç:** Fiş tarama ile pantry verisini güncelleyen, pantry'yi mutfak ve alternatif sistemine güvenli biçimde besleyen v1 çözümünü kararları tamam şekilde tanımlamak

---

## 1. Executive Summary

Bu özellik, kullanıcının market fişini taratarak evindeki malzemeleri dijital pantry sistemine aktarmasını sağlar. Pantry'deki aktif malzemeler daha sonra mutfak ve alternatif tarif akışlarında otomatik ön seçim olarak kullanılır. Böylece kullanıcı her seferinde tek tek malzeme seçmek zorunda kalmaz.

Bu sürümün ana prensibi şudur:

- Pantry v1 bir stok sistemi değildir; `var / yok` hafızasıdır.
- Alternatif algoritması değişmez; yalnızca daha doğru başlangıç verisiyle beslenir.
- Fiş görseli kalıcı saklanmaz; yalnızca OCR çıktısı ve eşleşme logları tutulur.
- Pantry'ye yalnızca canonical ingredient ID yazılır.
- Kullanıcıya belirsiz eşleşmeler sorulur; sistem sessizce yanlış ingredient eklemez.

Bu planın hedefi hızlı ama güvenilir bir v1 çıkarmaktır. Quantity, expiry ve gelişmiş bildirim davranışları sonraki fazlara bırakılır.

---

## 2. V1 Karar Özeti

### 2.1 Pantry modeli

Bu sürümde pantry yalnızca `aktif / pasif` mantığında çalışır.

- Kullanıcıda ürün varsa `IsActive = true`
- Ürün bittiyse `IsActive = false`
- Aynı ingredient tekrar gelirse yeni satır açılmaz, mevcut kayıt güncellenir

Bu sürümde şunlar yapılmaz:

- net miktar takibi
- gram/adet bazlı stok düşme
- son kullanma tarihi takibi
- otomatik tüketim hesabı

### 2.2 Fiş görsel saklama politikası

Fiş görseli kalıcı olarak saklanmaz.

Saklananlar:

- ham OCR text
- ayrıştırılmış satırlar
- eşleşen / eşleşmeyen sonuçlar
- confidence dağılımı
- matcher version bilgisi

Saklanmayan:

- fiş fotoğrafının kalıcı kopyası

Bu karar hem gizlilik hem de operasyonel sadelik için seçildi.

### 2.3 Pantry source-of-truth kararı

`CheckIngredientsScreen` pantry'den ön seçim alır ama pantry'nin kendisi değildir.

Yani:

- pantry ekranında yapılan değişiklik pantry'yi günceller
- fiş onayı pantry'yi günceller
- `CheckIngredientsScreen` içinde geçici seçim kaldırma pantry'yi otomatik değiştirmez

Bu ayrım kullanıcıyı şaşırtmamak için kritiktir.

### 2.4 Bildirim fazı kararı

Bildirim sistemi bu özelliğin çekirdek v1 kapsamından çıkarılmıştır.

Sebep:

- pantry doğruluğu oturmadan gönderilen bildirimler güven kaybı yaratır
- önce pantry ve match doğruluğu stabil hale getirilmelidir

Bildirimler ayrı `Phase 2` genişlemesi olarak ele alınacaktır.

---

## 3. Ürün Hedefi

Kullanıcının deneyimi şu hale gelmelidir:

1. Kullanıcı fişi taratır.
2. Uygulama market ürünlerini temel ingredient'lara çevirir.
3. Pantry otomatik güncellenir.
4. Kullanıcı mutfak ekranına geçtiğinde evindeki ürünler önceden seçilmiş gelir.
5. Tarif bul / alternatif bul akışı daha hızlı ve daha kişisel çalışır.

Bu özellik şu hissi vermelidir:

> "Uygulama benim evimde ne olduğunu biliyor ve buna göre bana yardımcı oluyor."

---

## 4. Kullanıcı Senaryosu ile Deneyim Anlatımı

### Senaryo 1 — Fişten pantry güncelleme

Ayşe marketten eve gelir. Elinde bir market fişi vardır. Uygulamada `Dolabım` ekranına girer ve `Fiş Tara` butonuna basar.

Kamera açılır. Ayşe fişin fotoğrafını çeker. Uygulama kısa bir analiz ekranı gösterir:

- "Fiş okunuyor"
- "Ürünler ayrıştırılıyor"
- "Malzemeler eşleştiriliyor"

Birkaç saniye sonra sonuç ekranı gelir:

- `Yumurta`, `Süt`, `Tavuk Göğsü`, `Makarna`, `Domates` gibi ürünler yüksek güvenle tanınmıştır
- `PINAR TAM YAG SUT` satırı `Süt` adayıyla orta güven seviyesindedir
- `BISKREM 3LU` gibi satırlar pantry için uygun görülmediği için eşleşmemiştir

Ayşe orta güvenli tek satırı onaylar, eşleşmeyen satırları atlar ve `Dolabıma Ekle` der.

Sonuç:

- Pantry aktif listesine yeni ürünler eklenir
- eski ama artık olmayan ürünler değişmeden kalır
- işlem loglanır

Uygulama Ayşe'ye şöyle bir özet verir:

> "7 ürün dolabına eklendi. 1 ürün senin onayınla eşleştirildi."

### Senaryo 2 — Pantry'den tarif bulma

Aynı akşam Ayşe mutfak ekranına gider. Eskiden her seferinde tek tek malzeme seçmesi gerekiyordu. Şimdi `CheckIngredientsScreen` açıldığında pantry'deki aktif ürünler otomatik seçili gelir.

Ayşe ekrana baktığında:

- tavuk
- süt
- yumurta
- domates
- makarna

zaten seçili görünür. O sadece o gün elinde olmadığını bildiği bir ürünü kaldırır ve `Tarif Bul` der.

Sistem artık bu listeyi sıfırdan toplamak yerine pantry tabanlı bir başlangıçla çalışır. Sonuç daha hızlıdır ve kullanıcıyı daha az yorar.

### Senaryo 3 — Alternatif ekranında kullanıcı güveni

Ayşe planındaki tarifi yapamayacağını düşünür ve alternatif akışına girer. Sistem pantry'den gelen gerçekçi malzeme listesiyle alternatifleri hesaplar. Böylece öneriler "teorik" değil, kullanıcının gerçekten evinde olanlara daha yakın hale gelir.

Kullanıcının hissi şu olur:

> "Uygulama bana rastgele tarif göstermiyor; gerçekten elimdekilere göre düşünüyor."

---

## 5. Sistem Akışı

```text
Fiş Fotoğrafı
   |
   v
OCR Provider (Azure Read API, tr-TR)
   |
   v
Satır Ayrıştırma ve Temizleme
   |
   v
Ingredient Matching Pipeline
(exact -> alias -> fuzzy -> optional LLM assist)
   |
   +--> high confidence -> auto candidate
   +--> medium confidence -> user confirmation
   +--> low confidence -> unmatched
   |
   v
Pantry Confirm Endpoint
   |
   v
UserPantryItems upsert
   |
   +--> PantryScreen
   +--> CheckIngredientsScreen preload
   +--> Kitchen / Alternative flows
   +--> ReceiptScanLogs
```

---

## 6. Veri Modeli

### 6.1 Yeni tablo: `UserPantryItems`

| Kolon | Tip | Açıklama |
|---|---|---|
| `Id` | Guid PK | Pantry kayıt kimliği |
| `ClientId` | Guid FK -> Clients | Pantry sahibi |
| `IngredientId` | Guid FK -> Ingredients | Canonical ingredient ID |
| `IsActive` | bool | `true = evde var`, `false = pasif / bitti` |
| `Source` | string | `receipt_scan`, `manual`, `shopping_list` |
| `AddedAt` | DateTime | İlk eklenme zamanı |
| `LastConfirmedAt` | DateTime | Kullanıcının en son teyit ettiği an |
| `LastScanLogId` | Guid? FK -> ReceiptScanLogs | Son fiş kaydı bağlantısı |

Kurallar:

- `ClientId + IngredientId` üzerinde `UNIQUE constraint`
- Pantry yazımı her zaman canonical ingredient ID üzerinden yapılır
- Aynı ingredient tekrar eklenirse insert değil update yapılır
- Fiziksel silme yok, `IsActive = false` yapılır

### 6.2 Yeni tablo: `ReceiptScanLogs`

| Kolon | Tip | Açıklama |
|---|---|---|
| `Id` | Guid PK | Scan kimliği |
| `ClientId` | Guid FK -> Clients | Scan sahibi |
| `ScannedAt` | DateTime | Tarama zamanı |
| `RawOcrText` | text | OCR ham çıktısı |
| `ExtractedLinesJson` | json | Satır bazlı OCR ayrışımı |
| `MatchedIngredientCount` | int | Yüksek güvenli veya onaylanmış eşleşme sayısı |
| `NeedsConfirmationCount` | int | Kullanıcı onayı gerektiren satır sayısı |
| `UnmatchedLinesJson` | json | Eşleşmeyen satırlar |
| `Status` | string | `completed`, `partial`, `failed` |
| `MatcherVersion` | string | Hangi eşleştirici stratejisiyle işlendi |
| `OcrProvider` | string | Örn. `azure-read-v1` |
| `ErrorSummary` | text? | Fail durumunda kısa özet |

Kurallar:

- Fiş görseli DB'de tutulmaz
- Loglar debug, kalite iyileştirme ve ölçüm amaçlıdır
- Aynı scan ikinci kez confirm edilirse idempotent davranış korunur

---

## 7. Canonical Ingredient Yazım Kuralı

Bu özellikte en kritik teknik kural şudur:

> Pantry'ye ham OCR satırı değil, yalnızca canonical ingredient ID yazılır.

Örnek:

- OCR: `PINAR TAM YAG SUT`
- normalized candidate: `Süt`
- pantry write: `IngredientId = canonical Süt ID`

Bu zorunludur çünkü:

- ingredient duplication geçmişte matcher sorunları üretti
- mutfak ve alternatif akışları canonical ID bekliyor
- alias/fuzzy/marka varyasyonları write katmanında normalize edilmezse sistem güvenilmez olur

---

## 8. OCR ve Matching Pipeline

### 8.1 OCR sağlayıcı kararı

Seçilen sağlayıcı: **Azure Computer Vision Read API**

Gerekçeler:

- Türkçe market fişlerinde yüksek doğruluk
- `tr-TR` locale desteği
- küçük ölçek için kabul edilebilir maliyet

### 8.2 İşleme adımları

1. İstek doğrulama
2. MIME type ve boyut kontrolü
3. OCR çağrısı
4. Ham metinden satır ayrıştırma
5. Ürün olmayan satırların filtrelenmesi
6. Token bazlı temizleme
7. Exact canonical eşleşme
8. Alias eşleşme
9. Fuzzy eşleşme
10. Opsiyonel LLM assist
11. Confidence sınıflandırma
12. Kullanıcı onayı
13. Pantry upsert
14. Log yazımı

### 8.3 Confidence akışı

| Seviye | Davranış |
|---|---|
| `>= 0.80` | Otomatik eşleşme adayı |
| `0.50 - 0.79` | Kullanıcı onayı gerekir |
| `< 0.50` | Eşleşmeyen satır olarak gösterilir |

### 8.4 Marka ve stopword temizleme

Marka listesi config'ten yönetilir. Örnek:

- Pınar
- Ülker
- Torku
- Sek
- Erikli
- Banvit
- Nestle
- Tikveşli

Bu kelimeler ingredient kararında ana ağırlığı taşımaz.

---

## 9. API Sözleşmeleri

### 9.1 `POST /api/pantry/receipt-scan`

Amaç:

- fiş görselini OCR'dan geçirmek
- satırları ingredient adaylarına çevirmek
- kullanıcıya confirm ekranı için yapılandırılmış sonuç dönmek

Request:

```json
{
  "imageBase64": "...",
  "mediaType": "image/jpeg"
}
```

Response:

```json
{
  "scanLogId": "guid",
  "highConfidence": [
    {
      "line": "YUMURTA 10LU",
      "ingredientId": "guid",
      "ingredientName": "Yumurta",
      "score": 0.96
    }
  ],
  "needsConfirmation": [
    {
      "line": "PINAR TAM YAG SUT",
      "candidateIngredientId": "guid",
      "candidateName": "Süt",
      "score": 0.71
    }
  ],
  "unmatched": [
    {
      "line": "BISKREM 3LU"
    }
  ]
}
```

### 9.2 `POST /api/pantry/confirm-scan`

Amaç:

- kullanıcı onayından sonra pantry'yi gerçekten güncellemek

Request:

```json
{
  "scanLogId": "guid",
  "confirmedIngredientIds": ["guid1", "guid2"],
  "acceptedHighConfidenceIds": ["guid3", "guid4"],
  "skippedLines": ["BISKREM 3LU"]
}
```

Kurallar:

- Bu endpoint idempotent olmalı
- Aynı `scanLogId` ile tekrar çağrılırsa duplicate pantry row oluşmamalı

### 9.3 `GET /api/pantry`

Amaç:

- aktif pantry öğelerini döndürmek
- mobil preload için kullanılmak

Opsiyonel query:

- `includeInactive=true|false`

### 9.4 `PATCH /api/pantry/{ingredientId}`

Amaç:

- aktif/pasif geçiş yapmak

Request:

```json
{
  "isActive": false
}
```

### 9.5 `POST /api/pantry/manual-add`

Amaç:

- kullanıcı ingredient picker ile pantry'ye manuel ekleme yapabilsin

Kural:

- manuel ekleme de canonical ingredient ID ile yapılır

---

## 10. Mobil Ekranlar

### 10.1 Yeni ekran: `PantryScreen`

Bu ekran kullanıcının aktif ve pasif pantry öğelerini görmesini sağlar.

Ana aksiyonlar:

- `Fiş Tara`
- `Manuel Ekle`
- `Var / Bitti` toggle

Bölümler:

- `Aktif Ürünler`
- `Pasif / Biten Ürünler`
- `Son fiş tarama özeti`

### 10.2 Yeni ekran: `ReceiptScanScreen`

Fazlar:

1. Görsel seçimi
2. Analiz durumu
3. Sonuç ve onay

Sonuç ekranı üç bölüm içermelidir:

- otomatik eşleşenler
- onay gerekenler
- eşleşmeyenler

### 10.3 `CheckIngredientsScreen` güncellemesi

Mount anında:

- `GET /api/pantry`
- aktif ingredient ID listesi alınır
- `selectedIds` başlangıç state'i bu liste ile doldurulur

Kural:

- ekran üstünde küçük bilgi mesajı gösterilir:
  - `Dolabındaki aktif ürünler otomatik seçildi.`

Kritik davranış:

- kullanıcı burada geçici seçim değiştirirse pantry güncellenmez
- bu ekran pantry'nin write surface'i değildir

---

## 11. Alternatif ve Mutfak Sistemi Entegrasyonu

### 11.1 Mevcut sözleşme korunur

Mevcut sistem:

- `CheckIngredientsScreen`
- `KitchenScreen`
- alternatif ve recipe match endpoint'leri

korunur.

Bu v1'de yapılacak şey:

- ingredient listesi artık pantry preload ile açılır

Yani:

- request contract değişmeyebilir
- yalnızca mobil başlangıç state'i iyileşir

### 11.2 Neden doğru yaklaşım?

Bu sayede:

- matcher kodu yeniden yazılmaz
- regression riski düşer
- pantry özelliği bağımsız geliştirilebilir

---

## 12. Ölçüm ve Başarı Kriterleri

### 12.1 Ürün başarı kriterleri

- Kullanıcı fiş tarama akışını tek oturumda tamamlayabilmeli
- Pantry aktif listesi kullanıcıya anlamlı görünmeli
- Mutfak ekranı açıldığında malzemeler otomatik dolu gelmeli

### 12.2 Teknik kabul kriterleri

Örnek Türk market fişleri üzerinde:

- satırların en az `%80`i `matched` veya `confirmed` sınıfına girmeli
- duplicate pantry kayıt oluşmamalı
- canonical olmayan ingredient pantry'ye yazılmamalı
- `CheckIngredientsScreen` pantry ile preload edilmeli
- alternative/kitchen akışları canonical ID ile çalışmaya devam etmeli

### 12.3 Operasyonel metrikler

Tutulacak metrikler:

- `scan_success_rate`
- `scan_partial_rate`
- `needs_confirmation_rate`
- `unmatched_rate`
- `scan_to_confirm_completion_rate`
- `pantry_preload_usage_rate`
- `pantry_manual_override_rate`

---

## 13. Riskler ve Kararlaştırılmış Çözümler

| Risk | Karar / Çözüm |
|---|---|
| OCR Türkçe karakter hataları | Azure `tr-TR` locale zorunlu |
| Marka adı yüzünden yanlış match | stopword + token temizleme |
| Aynı ingredient farklı ID aileleri | canonical write zorunlu |
| Kullanıcı pantry'yi unutursa | `LastConfirmedAt` tutulur, reminder sonraki faz |
| Fişte pantry'ye uygun olmayan ürünler | unmatched / skip akışı |
| Yanlış otomatik ekleme | medium confidence user confirm |
| Fişte aynı ürün çok geçerse | satır işleme sonrası canonical dedupe |
| Aynı fişin tekrar confirm edilmesi | idempotent confirm endpoint |
| Gizlilik riski | görsel saklanmaz, yalnızca OCR/log saklanır |

---

## 14. Fazlama ve Sprint Planı

### Sprint 1

- `UserPantryItems` ve `ReceiptScanLogs` migration
- repository ve basic CRUD altyapısı
- canonical pantry write kuralı

### Sprint 2

- `PantryController`
- `GET /api/pantry`
- `PATCH /api/pantry/{ingredientId}`
- `POST /api/pantry/manual-add`
- `PantryScreen`

### Sprint 3

- OCR provider adapter
- receipt scan backend skeleton
- exact + alias eşleşme

### Sprint 4

- fuzzy layer
- confirmation payload
- `ReceiptScanScreen`

### Sprint 5

- pantry confirm endpoint
- pantry upsert
- `CheckIngredientsScreen` preload entegrasyonu

### Sprint 6

- matcher kalite ölçümleri
- scan log dashboards / debug visibility
- failure handling polish

### Sprint 7+

- notification phase
- optional LLM assist
- alias learning loop
- quantity / expiry exploration

---

## 15. Gelecek Fazlar

Bu planın dışında ama roadmap için açık bırakılan konular:

- quantity-lite pantry
- expiry-lite pantry
- shopping list entegrasyonu
- stale pantry reminder notification
- fişten öğrenen alias yönetimi
- diyetisyen panelinde pantry insight kartları

---

## 16. Etkilenen Katmanlar

| Katman | Değişiklik |
|---|---|
| Veritabanı | `UserPantryItems`, `ReceiptScanLogs` |
| Domain | `UserPantryItem` entity, pantry repository contract |
| Application | pantry CRUD handlers, receipt scan handlers |
| Infrastructure | `AzureReceiptOcrService`, `IngredientMatchingService`, logging |
| API | `PantryController`, receipt scan endpoint |
| Mobil | `PantryScreen`, `ReceiptScanScreen`, `CheckIngredientsScreen` preload |
| Alternative / Kitchen | request contract korunur, preload davranışı gelişir |

---

## 17. Sonuç

Bu v2 planı, pantry ve fiş tarama özelliğini kontrollü ama güçlü bir v1 olarak tanımlar:

- kullanıcı açısından zahmeti azaltır
- teknik olarak mevcut canonical ingredient mimarisiyle uyumludur
- alternatif sistemini bozmadan iyileştirir
- ileride quantity, expiry ve bildirim gibi genişlemelere alan bırakır

Bu özelliğin doğru tasarımı, uygulamayı "ingredient seçilen bir araç" olmaktan çıkarıp "kullanıcının mutfağını tanıyan bir yardımcı" haline getirir.
