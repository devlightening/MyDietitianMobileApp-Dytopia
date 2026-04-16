# MyDietitian — Danışan Detay Sayfası + Aktivite Akışı + Plan Atama + Ölçüm Ekosistemi Revizyon Planı

## Amaç
Bu planın amacı, web paneldeki **danışan detay sayfasını** ve mobildeki **ölçüm / kullanıcı aktivitesi akışını** ürün seviyesinde güçlendirmektir. Hedef yalnızca görsel düzenleme değildir; asıl hedef, diyetisyenin danışanı **tek sayfadan klinik olarak okuyabildiği**, danışanın gelişimini **tarihsel olarak takip edebildiği**, sistemin de **davranışsal sinyaller** üretebildiği bir yapıya ulaşmaktır.

Bu çalışma sonunda:
- danışan detay sayfası “boş sekmeler” hissinden çıkmalı,
- plan atama akışı gerçekten çalışmalı,
- aktivite alanı anlamlı veri göstermeli,
- ölçümler hem mobil hem web’de tarihsel ve güvenilir bir sağlık verisi modülüne dönüşmeli,
- kullanıcı ve diyetisyen tarafındaki veri rolleri netleşmelidir.

---

## 1. Ekran görüntülerine ve videoya göre mevcut durum analizi

### 1.1 Başlık alanı yetersiz
Şu an başlık alanında danışan için neredeyse sadece isim ve mail benzeri bilgi var. Bu alan klinik açıdan zayıf kalıyor. Diyetisyen, danışanın sayfasına girdiğinde ilk bakışta şu soruların cevabını göremiyor:
- Son kilo nedir?
- Boy bilgisi var mı?
- BMI nedir?
- Aktif planı var mı?
- Son ölçüm tarihi ne zaman?
- Ölçümler diyetisyen tarafından mı doğrulandı?
- Son 7/30 günlük uyum durumu nasıl?

### 1.2 Sekmeler var ama ürün mantığı zayıf
Mevcut sekmeler:
- Genel bakış
- Aktiviteler
- Ölçümler
- Plan
- İletişim

Sorun şu: sekme isimleri var, ama sekmelerin **kendine ait karar destek değeri** henüz yeterince güçlü değil. Özellikle:
- **Aktiviteler** boş,
- **Plan** sekmesinde “Plan ata” butonu var ama kullanıcı akışı kopuk,
- **Ölçümler** tarafı yeni gelişmiş olsa da diyetisyen açısından henüz tam klinik panel değil.

### 1.3 “Plan ata” çağrısı boşta kalıyor
Görüntüye göre “Aktif plan yok” kartı ve “Plan ata” butonu var. Ancak tıklanabilir ürün akışının net olmadığı görülüyor. Bunun olası kök nedenleri:
1. Butonun route’u eksik veya yanlış bağlı,
2. plan oluşturma modalı / plan seçme drawer’ı yok,
3. danışana plan bağlama endpoint’i yok veya frontend bağlanmamış,
4. meal plan template / client meal plan creation akışı yarım,
5. seçili client id route’a taşınmıyor,
6. backend tarafında `active plan` okuma ile `plan atama` yazma akışı birbirinden kopuk.

### 1.4 Aktivite alanı boş ve fırsat kaçıyor
Aktivite sekmesi şu anda “Henüz aktivite yok” gibi davranıyor. Oysa bu sekme uygulamanın en değerli davranış analitiği alanlarından biri olabilir.

Burada gösterilebilecek sinyaller:
- mobilde kazanılan rozetler,
- hangi günlerde plan uyumu sağlandı,
- hangi öğün tamamlandı / atlandı,
- hangi tarifler arandı,
- hangi tarifler detay açıldı,
- hangi malzemeler en sık seçildi,
- hangi alternatifler kullanıldı,
- son ölçüm / kilo girişi,
- en son ne zaman aktif oldu,
- danışanın gönderdiği not/mesaj,
- scan ile malzeme ekleme denemeleri,
- alışveriş listesine eklenen öğeler.

### 1.5 Ölçüm modeli daha profesyonel hale gelmeli
Mobil ölçüm ekranı eski halinde daha amatör hissediyordu ve yalnız bel/kalça/göğüs gibi sınırlı alanlar gösteriyordu. Diyetisyenlik bağlamında ölçüm seti daha geniş olmalı.

Eksik/iyileştirilmesi gereken metrikler:
- Kilo
- Boy
- BMI (hesaplanan)
- BMR (hesaplanan)
- Yağ oranı
- Bel
- Kalça
- Göğüs
- Bel/kalça oranı (hesaplanan)
- Not
- Ölçüm tarihi
- Kaynak tipi (diyetisyen / danışan / akıllı tartı)
- Klinik doğrulama durumu

---

## 2. Ürün kararı: ölçümleri kim girmeli?

Bu konuda en sağlıklı çözüm **hibrit modeldir**.

### 2.1 Diyetisyen girmeli
Aşağıdaki veriler daha güvenilir ve klinik değerlidir; diyetisyen tarafından girilmesi veya en azından doğrulanması daha doğru olur:
- Boy
- Bel
- Kalça
- Göğüs
- Yağ oranı
- Klinik not
- Vücut kompozisyon cihazından gelen değerler

### 2.2 Kullanıcı girebilmeli
Aşağıdaki veriler kullanıcı tarafından düzenli girilebilir:
- Güncel kilo
- Günlük/haftalık tartı verisi
- İsteğe bağlı bel/kalça tekrar ölçümü
- Evdeki akıllı tartı verileri

### 2.3 Nihai karar
Sistemde her ölçüm kaydı için `sourceType` tutulmalı:
- `dietitian`
- `client`
- `smart_scale`
- `system_import`

Ve ayrıca:
- `isClinicallyVerified`
- `verifiedByDietitianId`
- `verifiedAtUtc`

böylece diyetisyen, danışanın kendi girdiği veriyi de görür ama hangisinin klinik olarak güvenilir olduğunu ayırt eder.

**Karar:**
- Mobil kullanıcı tarafı **kilo odaklı hafif giriş** için uygun,
- Web panel diyetisyen tarafı **tam klinik ölçüm girişi ve doğrulama** için uygun.

---

## 3. Hedef ürün kurgusu

## 3.1 Danışan detay üst başlık alanı yeniden tasarlanmalı
Başlık alanında şu bilgiler yer almalı:
- Ad soyad
- Premium / aktif danışan etiketi
- Son ölçüm tarihi
- Güncel kilo
- Boy
- BMI
- Son 7 gün uyum oranı
- Aktif plan durumu
- Son giriş zamanı
- Kısa aksiyon butonları:
  - Mesaj gönder
  - Plan ata
  - Ölçüm ekle
  - Not ekle

### Başlık alanı örnek düzen
Sol bölüm:
- Selin Aydın
- Premium danışan
- Son aktif: bugün 14:20
- Son ölçüm: 2 gün önce

Sağ bölüm mini klinik kartlar:
- Kilo: 72.4 kg
- Boy: 168 cm
- BMI: 25.7
- Uyum: %81
- Aktif plan: Var / Yok

Bu alan artık `ID: selin.aydin@test.local` gibi ham teknik bilgi değil, **ürünsel ve klinik** bilgi taşımalı.

---

## 3.2 Genel bakış sekmesi
Bu sekme “özet dashboard” gibi çalışmalı.

### İçerik
1. **Uyum kartı**
   - Son 7 gün / 30 gün compliance
   - tamamlanan öğün sayısı
   - atlanan öğün sayısı

2. **Klinik özet kartı**
   - güncel kilo
   - başlangıca göre değişim
   - BMI + kategori
   - bel/kalça oranı
   - BMR

3. **Davranış özeti kartı**
   - son 7 gün kaç gün uygulamaya girdi
   - en çok baktığı tarif kategorisi
   - en son aradığı tarif
   - en çok seçtiği malzeme tipi

4. **Plan özeti**
   - aktif plan adı
   - başlangıç / bitiş tarihi
   - plan ilerlemesi

5. **Son olaylar mini timeline**
   - dün kilo girdi
   - bugün tarif aradı
   - 2 gün önce ölçüm onaylandı

---

## 3.3 Aktiviteler sekmesi
Bu sekme boş kalmamalı. Bu alanı bir **timeline / activity feed** olarak tasarlayın.

### Aktivite feed event tipleri
Aşağıdaki event tipleri backend’de üretilmeli:

#### Plan davranışı
- meal_completed
- meal_skipped
- meal_alternative_used
- day_fully_completed
- plan_started
- plan_expired

#### Tarif davranışı
- recipe_search
- recipe_result_opened
- recipe_detail_opened
- recipe_favorited
- recipe_used_from_plan
- recipe_alternative_selected

#### Mutfak davranışı
- ingredient_selected_manual
- ingredient_scan_confirmed
- ingredient_added_to_shopping_list
- kitchen_match_run

#### Ölçüm davranışı
- weight_logged
- measurement_logged
- measurement_verified

#### Motivasyon / gamification
- badge_earned
- streak_increased
- streak_broken
- compliance_milestone

#### İletişim
- message_sent
- note_added
- note_read

### Aktivite sekmesi UI önerisi
Her event kartında:
- ikon
- başlık
- kısa açıklama
- timestamp
- kaynak etiketi (`mobil`, `web panel`, `sistem`)
- gerekiyorsa önem seviyesi

### Örnek event metinleri
- “Danışan bugün kahvaltı öğününü tamamladı.”
- “3 günlük seri rozeti kazanıldı.”
- “Tavuk Salatası tarifi arandı ve detay ekranı açıldı.”
- “Yeni kilo girişi yapıldı: 72.4 kg.”
- “Bel ölçümü diyetisyen tarafından klinik olarak doğrulandı.”

### Rozetleri burada gösterme kararı
Evet, **mobilde kazanılan rozetler bu alanda görünmeli**. Çünkü diyetisyen için bunlar yalnız oyunlaştırma değil, danışanın motivasyon ve uyum verisidir.

Rozet kartında:
- rozet adı
- neden kazanıldı
- hangi tarihte alındı
- karşılığı olan davranış (örn. 3 gün plan tamamlama)

---

## 3.4 Ölçümler sekmesi
Ölçümler sekmesi iki parçalı çalışmalı:

### A) Klinik özet alanı
- güncel kilo
- başlangıç kilosuna göre değişim
- BMI
- BMI category
- yağ oranı
- bel/kalça oranı
- son ölçüm tarihi
- doğrulanmış mı

### B) Ölçüm geçmişi
Tarihsel kayıt listesi / tablo:
- Tarih
- Kilo
- Boy
- Yağ oranı
- Bel
- Kalça
- Göğüs
- BMI
- BMR
- Kaynak
- Klinik doğrulama
- Not

### Grafikler
- Kilo trend grafiği
- Bel çevresi trend grafiği
- Yağ oranı trend grafiği
- BMI zaman çizgisi

### Filtreler
- son 7 gün
- son 30 gün
- son 90 gün
- tümü
- sadece diyetisyen girişi
- sadece kullanıcı girişi

---

## 3.5 Plan sekmesi
Şu an “Aktif plan yok” kartı var ama “Plan ata” butonunun akışı eksik.

### Hedef kurgu
Butona tıklayınca 3 seçenekli bir plan atama akışı açılmalı:

1. **Mevcut plan şablonundan ata**
2. **Sıfırdan yeni plan oluştur**
3. **Önceki planı kopyalayarak ata**

### Plan ata drawer / modal içeriği
- plan adı
- başlangıç tarihi
- bitiş tarihi
- hedef
- günlük öğün yapısı
- tarif bağlama seçeneği
- not

### Aktif plan varsa sekme ne göstermeli?
- plan adı
- tarih aralığı
- toplam gün
- tamamlama oranı
- son 7 gün öğün özeti
- plan içindeki öğünler
- tarif bağlı öğünler
- alternatif kullanılan öğünler

### Boş durum kartı artık daha güçlü olmalı
Şu anki boş durum sadece “Aktif plan yok” diyor.
Daha iyi boş durum:
- kısa açıklama
- son plan bilgisi varsa göster
- “Şablondan oluştur”
- “Yeni plan oluştur”
- “Geçmiş planları gör”

### Muhtemel mevcut bug kök nedeni
Claude bunu analiz etmeli. Özellikle şunları kontrol etmeli:
- `Plan ata` butonunun click handler’ı var mı
- route doğru mu
- selected client id taşınıyor mu
- create plan modal component’i mount oluyor mu
- `tab=plan` ile bağlantı kuran state bozuk mu
- meal plan API’leri gerçekten bağlı mı
- active plan sorgusu dönüyor ama create mutation yok mu

---

## 3.6 İletişim sekmesi
Bu sekme çalışıyor ama diğer sekmelerle bağlı hale getirilmeli.

Örneğin:
- diyetisyen ölçüm yorumu bırakabilmeli
- plan değişikliği mesajı bırakabilmeli
- rozet / uyum / aktiviteye dair hızlı geri bildirim şablonları olmalı

Örnek hızlı mesajlar:
- “Son 2 haftadır kilo trendin olumlu gidiyor, devam edelim.”
- “Bu hafta su tüketimi ve kahvaltı uyumu iyi.”
- “Bel ölçümündeki değişimi bir sonraki kontrolde tekrar değerlendirelim.”

---

## 4. Mobil taraf ürün kararı

## 4.1 Ölçüm ekranı profesyonelleştirilmeli
Mobilde ölçüm ekranı artık tek kart içinde 3 alan gösteren amatör bir form olmamalı.

### Yeni yapı
Sekmeli veya bölümlü yapı:
- Hızlı giriş
- Genişletilmiş ölçüm
- Geçmiş

### Hızlı giriş
Kullanıcının en sık girdiği şey:
- kilo
- tarih
- not

### Genişletilmiş ölçüm
İsteğe bağlı alanlar:
- bel
- kalça
- göğüs
- yağ oranı
- su oranı (opsiyonel)
- kas oranı (opsiyonel, cihaz varsa)

### Geçmiş ekranı
- tarih bazlı liste
- son değişim
- küçük grafik
- diyetisyen doğrulama etiketi

### UX notu
Mobil kullanıcıdan boy her seferinde istemek mantıklı değil. Boy nadiren değişir; daha çok profil verisi gibi davranmalı.

---

## 4.2 Mobil kullanıcı neyi görmeli?
Kullanıcı da şu bilgileri görebilmeli:
- güncel kilo
- başlangıca göre fark
- son ölçüm tarihi
- kendi ölçüm geçmişi
- diyetisyenin onayladığı değer etiketi
- planla ilişkili kısa yorumlar

Ama kullanıcı tarafında klinik karmaşıklık azaltılmalı. Yani diyetisyenin gördüğü tüm ham veri kullanıcıya aynı yoğunlukta gösterilmemeli.

---

## 4.3 Rozetler ve aktivite kullanıcıda da görünmeli
Mobilde kullanıcı rozeti kazanıyorsa, web panel aktivitelerde de görünmeli.

Örnek rozetler:
- 3 gün üst üste plan tamamlama
- ilk ölçüm girişi
- ilk tarif tamamlama
- 7 gün mutfak aktifliği
- 5 gün su hedefi uyumu (ileride)

---

## 5. Backend / veri modeli önerisi

## 5.1 ClientMeasurements tablosu
Her kayıt snapshot mantığında tutulmalı.

Önerilen alanlar:
- Id
- ClientId
- RecordedAtUtc
- SourceType
- WeightKg
- HeightCm
- BodyFatPercent
- WaistCm
- HipCm
- ChestCm
- Bmi
- BmiCategory
- BmrKcal
- WaistHipRatio
- Notes
- IsClinicallyVerified
- VerifiedByDietitianId
- VerifiedAtUtc
- CreatedAtUtc

## 5.2 ClientActivityEvents tablosu
Yeni tablo önerisi:
- Id
- ClientId
- EventType
- EventGroup (`plan`, `recipe`, `measurement`, `badge`, `message`, `kitchen`)
- Title
- Description
- MetadataJson
- Source (`mobile`, `web`, `system`)
- CreatedAtUtc
- RelatedEntityType
- RelatedEntityId
- Severity (optional)

Bu tablo aktiviteler sekmesinin temel kaynağı olur.

### MetadataJson örnekleri
- aranan tarif query’si
- açılan recipeId
- kazanılan rozet kodu
- kilo eski/yeni değerleri
- tamamlanan mealItemId

---

## 6. API önerileri

### Ölçümler
- `GET /api/clients/{id}/measurements`
- `POST /api/clients/{id}/measurements`
- `PATCH /api/client-measurements/{measurementId}/verify`
- `GET /api/clients/{id}/measurements/summary`

### Aktiviteler
- `GET /api/clients/{id}/activities`
- `POST /api/client-activity-events` (internal/system use)

### Plan
- `GET /api/clients/{id}/active-plan`
- `GET /api/clients/{id}/plans`
- `POST /api/clients/{id}/plans/assign-from-template`
- `POST /api/clients/{id}/plans/create-and-assign`
- `POST /api/clients/{id}/plans/clone-and-assign`

---

## 7. Claude için uygulama sırası

## Session 1 — Analiz
Önce mevcut kodu okuyup raporlasın:
- client detail page route
- tab render mantığı
- plan ata butonu handler’ı
- measurements mevcut API shape
- activities için var olan veri kaynağı var mı

## Session 2 — Backend
- `ClientActivityEvents` tablosu
- measurement summary / history API’leri
- plan assignment endpoint’leri
- sourceType / verification mantığı

## Session 3 — Web panel
- danışan detay header redesign
- tab içeriklerinin güçlendirilmesi
- plan ata drawer / modal
- activity timeline UI
- measurements history + charts

## Session 4 — Mobil
- ölçüm ekranı redesign
- geçmiş liste
- hızlı kilo girişi
- rozet ve ölçüm event log üretimi

## Session 5 — Entegrasyon
- mobil event’lerin activity feed’e düşmesi
- plan/measurement/message flow entegrasyonu
- QA ve edge case testleri

---

## 8. Kabul kriterleri
Bu çalışma tamamlandığında:
- danışan başlık alanı klinik olarak anlamlı olmalı
- `Plan ata` gerçekten çalışmalı
- aktiviteler sekmesi boş olmamalı
- mobilde ölçüm kaydı sorunsuz çalışmalı
- ölçüm geçmişi tarihsel tutulmalı
- kullanıcı ve diyetisyen veri kaynakları ayırt edilebilmeli
- rozetler ve davranışlar aktivite akışına düşmeli
- web panel, danışanın durumunu tek sayfadan okunur hale getirmeli

---

## 9. Claude’a verilecek uygulama promptu
Aşağıdaki prompt doğrudan uygulanabilir:

"Danışan detay ekranını ürün seviyesinde yeniden tasarla ve backend + web panel + mobil tarafta eksik kurguları tamamla.

Önce mevcut kodu analiz et. Özellikle:
- client detail header neden zayıf
- activities tab neden boş
- plan tab içindeki `Plan ata` butonu neden çalışmıyor
- measurement verisi web ve mobil arasında nasıl taşınıyor
- mevcut measurement API shape nedir

Sonra aşağıdaki hedefleri uygula:
1. Web panel danışan detay başlığını klinik özet başlığına çevir.
2. Genel bakış sekmesini danışan dashboard’una dönüştür.
3. Aktiviteler sekmesini timeline/event feed yap.
4. Mobilde kazanılan rozetler, tarif aramaları, tarif detay açma, meal completion, ingredient scan confirm, measurement log gibi event’leri backend event tablosuna düşür.
5. Ölçümler sekmesini tarihsel ve klinik hale getir.
6. Mobil ölçüm ekranını profesyonel tasarla: hızlı kilo girişi + gelişmiş ölçüm + geçmiş.
7. Ölçümlerde sourceType ve clinically verified mantığı kur.
8. Plan sekmesindeki `Plan ata` butonunu gerçekten çalışan bir akışa bağla:
   - assign from template
   - create and assign
   - clone previous plan
9. Aktif plan yoksa güçlü boş durum kartı göster.
10. Aktif plan varsa plan summary + meal overview + progress göster.
11. Kullanıcı tarafında da ölçüm geçmişi ve özet bilgileri görünür kıl.

Çok önemli:
- sadece UI değil, ürün mantığını da tamamla
- gerekli migration ve endpoint’leri ekle
- boş sekmeleri gerçek veri ile çalışan alanlara dönüştür
- event taxonomy tutarlı olsun
- klinik doğruluk ile kullanıcı kullanım kolaylığı arasında denge kur

Sonunda şunları raporla:
- değişen dosyalar
- yeni migration’lar
- yeni endpoint’ler
- event tipleri
- plan atama akışı nasıl çalışıyor
- activity feed hangi verilerden besleniyor
- mobil ölçüm ekranında hangi alanlar var
- test checklist"
