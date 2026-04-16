# MyDietitian — Session Bazlı Multimodal Ingredient Detection Revize Planı

## Amaç
Bu doküman, mevcut fotoğraf / ingredient scan altyapısını **sıfırdan bozup yeniden kurmak için değil**, mevcut çalışan parçaları analiz edip **Seçenek C** yaklaşımına göre revize etmek için hazırlanmıştır.

**Seçenek C = On-device / ücretsiz first + OpenAI fallback**

Hedef:
- Mobilde kamera / fotoğraf ile ingredient tespiti
- Tespit edilen adayların `Ingredients` tablosu ile **canonical ingredient** seviyesinde eşleşmesi
- Yüksek güvenli eşleşmelerin kullanıcı sepetine / seçili ingredient listesine eklenmesi
- Düşük güvenli durumlarda review/onay akışı
- `Tarif Bul` aşamasından önce yalnızca güvenli şekilde resolve edilmiş ingredient’lerin seçilmiş sayılması

---

## Çok önemli çalışma kuralı
Bu planı **tek seferde uçtan uca implement etmeye çalışma**.

Önce mevcut sistemi analiz et.  
Sonra session session ilerle.

### Devam kuralı
- Her session sonunda:
  - ne yaptığını yaz
  - hangi dosyaları değiştirdiğini yaz
  - hangi risklerin kaldığını yaz
  - nasıl test ettiğini yaz
- Eğer session **hatasız tamamlandıysa**, bir sonraki session’a geç
- Eğer blocking error varsa:
  - dur
  - kök nedeni açıkla
  - fix önerisi ver
  - sonraki session’a geçme

Yani akış şu şekilde olmalı:

**Session N başarıyla biterse → Session N+1’e geç**  
**Session N hata verirse → dur, raporla, çözmeden devam etme**

---

# Ürün Hedefi

## Kullanıcı akışı
1. Kullanıcı mobilde fotoğraf çeker ya da galeriden seçer
2. Sistem önce **on-device / ücretsiz** tespit yolunu dener
3. Sonuçlar backend’e gelir
4. Backend raw label’ları `Ingredients` tablosundaki canonical ingredient’lere resolve eder
5. Yüksek confidence olanlar otomatik seçilir
6. Belirsiz olanlar review ekranına düşer
7. Kullanıcı onayladığında ingredient’ler seçilmiş sayılır
8. Sonra `Tarif Bul` çalışır

---

# Faz 1 Ingredient Kapsamı
İlk sürümde 20–30 adet çok kullanılan ingredient ile başlanacak.  
Bunların **senin Ingredients tablon içinde gerçekten bulunuyor olması** gerekir.

## Faz 1 önerilen ingredient seti
- Domates
- Salatalık
- Limon
- Marul
- Tavuk Göğsü
- Yumurta
- Muz
- Süt
- Yoğurt
- Beyaz Peynir
- Kaşar Peyniri
- Biber
- Kırmızı Biber
- Soğan
- Sarımsak
- Patates
- Havuç
- Kabak
- Brokoli
- Elma
- Portakal
- Çilek
- Yulaf
- Pirinç
- Makarna
- Ton Balığı
- Ekmek
- Avokado
- Ispanak
- Mantar

> Not: Session 1 analiz raporunda bu ingredient’lerin `Ingredients` tablosunda gerçekten bulunup bulunmadığı doğrulansın.  
> Eksik olanlar raporlansın.  
> Gerekirse seed / mapping çalışması önerilsin.

---

# Sistem Mimarisi — Nihai Hedef

## Katman 1 — Detection
Öncelik sırası:
1. On-device / ücretsiz detection
2. Gerekirse OpenAI fallback

## Katman 2 — Resolver
Raw detection label → canonical ingredient çözümleme

Adımlar:
- exact alias match
- normalized label match
- mapping table match
- fuzzy / yakın eşleşme
- unresolved

## Katman 3 — Review
- yüksek confidence: otomatik seç
- düşük confidence: kullanıcı onayı iste

## Katman 4 — Selection
Sadece resolve edilmiş ingredient’ler seçilmiş sayılır.

---

# Session Planı

---

## Session 1 — Sadece analiz
### Kural
Bu session’da:
- kod yazma
- migration oluşturma
- package ekleme
- dosya değiştirme

Sadece mevcut sistemi oku ve analiz et.

### Önce okunacak dosyalar
- `mobile-app/src/screens/IngredientScanScreen.tsx`
- mobil scan ile ilgili diğer camera / image picker / helper dosyaları
- image scan / ingredient analyze ile ilgili controller dosyaları
- benchmark / ingredient / kitchen ile ilişkili controller ve service dosyaları
- ingredient alias / canonical / search / resolver ile ilgili repository ve service dosyaları
- mevcut fotoğraf akışının request/response DTO’ları
- mevcut image detection veya OCR benzeri servisler

### Cevaplanması gereken sorular
1. `IngredientScanScreen` şu an tam olarak ne yapıyor?
2. Kamera / galeri akışı hangi kütüphanelerle kurulmuş?
3. Repo şu an:
   - expo-camera mı
   - react-native-vision-camera mı
   - expo-image-picker mı
   - başka bir çözüm mü
   kullanıyor?
4. `POST /api/ingredients/analyze-image` veya benzeri endpoint var mı?
5. Varsa şu an gerçekten ne yapıyor?
6. Mevcut sistemde raw label → ingredient eşleştirme altyapısı var mı?
7. `Ingredients` tablosundaki `CanonicalName` ve `Aliases` bu iş için ne kadar hazır?
8. Faz 1 ingredient listesi tabloda mevcut mu?
9. Bu repo için en güvenli on-device yol hangisi?
   - expo-camera + ML Kit
   - vision-camera + TFLite
   - mevcut altyapıdan devam
10. Mevcut çalışan parçalar neler, kopuk parçalar neler?

### Beklenen çıktı
Raporu şu başlıklarla yaz:
- Mevcut mobil scan durumu
- Mevcut backend scan durumu
- Canonical / alias readiness
- Faz 1 ingredient readiness
- Teknik riskler
- En uygun on-device yaklaşım önerisi
- Session 2 için net öneri

### Session 1 geçiş kriteri
Bir sonraki session’a ancak:
- repo için en doğru detection yönü seçildiyse
- mevcut altyapının hangi kısmının korunacağı netleştiyse
- Faz 1 ingredient setinin tablo uyumu raporlandıysa
geç.

---

## Session 2 — Backend temel veri modeli ve seed
### Bu session’ın amacı
Detection için gereken backend veri yapılarını kurmak.

### Yapılacaklar
1. `VisionLabelMappings` tablosu oluştur
   - `Id`
   - `RawLabel`
   - `NormalizedLabel`
   - `IngredientId`
   - `ConfidenceThreshold`
   - `IsApproved`
   - `Notes` (opsiyonel)
   - `CreatedAtUtc`

2. `IngredientImageDetectionLogs` tablosu oluştur
   - `Id`
   - `ClientId` veya `UserId` (uygun olan)
   - `ImageSource`
   - `RawLabel`
   - `NormalizedLabel`
   - `PredictedIngredientId`
   - `ConfirmedIngredientId`
   - `Confidence`
   - `MatchType`
   - `WasAccepted`
   - `CreatedAtUtc`

3. Migration üret
4. Faz 1 ingredient seti için **seed script** yaz

### Seed şartı
Her ingredient için mümkün olduğunca şu varyantları üret:
- İngilizce tekil
- İngilizce çoğul
- Türkçe canonical
- yaygın Türkçe varyant
- gerekiyorsa food-specific synonym

Örnek:
- Domates
  - tomato
  - tomatoes
  - domates
  - taze domates

- Tavuk Göğsü
  - chicken breast
  - raw chicken breast
  - tavuk göğsü
  - tavuk gogsu

- Marul
  - lettuce
  - romaine lettuce
  - marul

### Session 2 geçiş kriteri
- migration başarıyla oluşmuş olmalı
- tablo şemaları net olmalı
- seed script yazılmış olmalı
- Faz 1 ingredient mapping başlangıç datası hazır olmalı

Session 2 hata verirse dur ve raporla.

---

## Session 3 — Resolver katmanı
### Amaç
Raw detection label’larını senin `Ingredients` tablonla güvenli şekilde eşleştirmek.

### Yapılacaklar
Yeni bir resolver servisi tasarla:
- `IIngredientDetectionResolver`
- uygun implementation

### Çözümleme sırası
1. exact alias match
2. normalized label match
3. `VisionLabelMappings` match
4. fuzzy / yakın eşleşme
5. unresolved

### Sonuç modeli
Her detection için aşağıdaki gibi bir sonuç üret:
- `rawLabel`
- `normalizedLabel`
- `matchedIngredientId`
- `matchedIngredientName`
- `confidence`
- `matchType`
- `isAutoSelected`
- `requiresReview`

### Kurallar
- yüksek confidence + approved mapping varsa otomatik seçilebilir
- düşük confidence ise review gerekir
- unresolved otomatik seçilmez

### Session 3 geçiş kriteri
- resolver unit testleri olmalı
- Faz 1 ingredient seti için örnek label’lar çözülebilmeli
- unresolved akışı net çalışmalı

---

## Session 4 — On-device detection entegrasyonu
### Amaç
Repo’ya en uygun ücretsiz/on-device detection yolunu aktif etmek.

### Çok önemli
Bu session’a başlamadan önce Session 1’de önerilen teknik yön kullanılmalı.

### Kural
Aşağıdaki seçeneklerden sadece **Session 1 raporunda en uygun bulunanı** uygula:
- expo-camera + Google ML Kit
- react-native-vision-camera + TFLite
- mevcut IngredientScanScreen altyapısından devam

### Yapılacaklar
1. Mevcut scan ekranını bozmadan revize et
2. Fotoğraf çek / galeriden seç akışını stabil hale getir
3. Detection sonucunu backend resolver’a gönderecek akışı kur
4. Faz 1 ingredient seti için çalışan ilk detection akışını çıkar

### Session 4 geçiş kriteri
- mobilde fotoğraf alımı çalışmalı
- detection sonucu backend’e taşınmalı
- resolver sonucu alınmalı
- uygulama çökmeden review akışına geçebilmeli

---

## Session 5 — Review / onay ekranı
### Amaç
Düşük confidence veya çoklu aday durumlarını kullanıcıya güvenli şekilde göstermek.

### Yapılacaklar
1. Detection sonrası bulunan ingredient’leri chip/list halinde göster
2. Her item için:
   - auto-selected
   - review-needed
   - unresolved
   durumlarını göster
3. Kullanıcı onayı ile seçili ingredient listesine ekle
4. `Tarif Bul` öncesi yalnızca resolve edilmiş ingredient’leri sepete yaz

### Kural
- belirsiz ingredient’leri otomatik seçilmiş sayma
- kullanıcı deneyimi temiz ve hızlı olsun

### Session 5 geçiş kriteri
- kullanıcı review edip ingredient seçimini tamamlayabilmeli
- seçilen ingredient’ler mevcut kitchen flow’a sorunsuz düşmeli

---

## Session 6 — OpenAI fallback
### Amaç
Yalnızca zor / belirsiz sahnelerde daha güçlü detection fallback’i eklemek.

### Güvenlik kuralı
- API key mobilde tutulmaz
- yalnızca backend kullanır

### Yapılacaklar
1. `IIngredientVisionService` abstraction kur
2. Primary provider:
   - Session 1’de seçilen on-device yol
3. Fallback provider:
   - OpenAI vision
4. Sadece düşük confidence / unresolved durumlarda fallback çağrısı yap
5. maliyet ve kullanım loglarını detection logs içine yaz

### Çok önemli
OpenAI sonucu bile doğrudan pantry’ye yazılmasın.  
Önce resolver ve confidence kurallarından geçsin.

### Session 6 geçiş kriteri
- fallback sadece gerektiğinde devreye girmeli
- maliyet kontrol logları tutulmalı
- auto-select ve review kuralları korunmalı

---

## Session 7 — Kitchen entegrasyonu ve son polish
### Amaç
Detection sonucu ingredient’lerin mevcut Kitchen / Tarif Bul akışına tam bağlanması

### Yapılacaklar
1. Seçilmiş ingredient ID’lerini mevcut search/manual selection yapısıyla aynı formatta üret
2. `Tarif Bul` öncesi detection ile gelen ingredient’ler manuel seçimle birleşsin
3. UI’da kaynağı net olsun:
   - manuel
   - fotoğraftan bulundu
   - kullanıcı onayladı
4. detection kaynaklı ingredient’ler chip olarak görünsün
5. açıklayıcı hata durumları ve empty state’ler düzenlensin

### Session 7 geçiş kriteri
- kullanıcı fotoğraf çekip ingredient’leri seçebilerek kitchen result’a sorunsuz gidebilmeli

---

# Teknik Kurallar

## 1. API key kuralı
OpenAI key mobilde tutulmaz.  
Backend’de env/config üzerinden kullanılır.

## 2. Mevcut çalışan sistemi bozma
- mevcut manual ingredient search çalışmaya devam etmeli
- mevcut kitchen result akışı bozulmamalı
- mevcut premium / clinic isolation mantığı bozulmamalı

## 3. Önce analiz, sonra implementasyon
Her session önce ilgili mevcut kodu okuyup küçük analiz notu yazmalı.

## 4. Tez için ölçüm değerleri korunmalı
Detection logları şu metrikleri üretmeye uygun olmalı:
- detection success rate
- unresolved rate
- user correction rate
- auto-selected rate
- average confidence
- barcode/text/photo karşılaştırma zemini

---

# Claude’dan her session sonunda istenecek çıktı
Her session sonunda şunları ver:
1. Neleri analiz ettiğin
2. Hangi dosyaları değiştirdiğin
3. Hangi migration / script / endpoint / component eklendiği
4. Nasıl test ettiğin
5. Hangi risklerin kaldığı
6. Sonraki session’a güvenle geçilebilir mi

---

# Uygulama Notu
Bu planın amacı:
- sıfırdan belirsiz bir sistem yazdırmak değil
- mevcut scan altyapısını okuyup,
- kontrollü biçimde,
- session session,
- geri dönüşü yönetilebilir şekilde
güçlendirmektir.

Claude, bu dokümana göre çalışırken mevcut sistemi bozacak büyük refactor’lardan kaçınmalı; her session sonunda çalışan durumu koruyarak ilerlemelidir.
