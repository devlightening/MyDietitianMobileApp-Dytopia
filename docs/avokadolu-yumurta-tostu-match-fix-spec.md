# Avokadolu Yumurta Tostu Mobil Eşleşmeme Hatası - Runtime Fix Spec

## Amaç

Bu doküman, premium kullanıcı **Selin Aydın** için mobilde `Birleştir ve Tarif Bul` akışında yaşanan kritik hatayı kapatmak için hazırlanmıştır.

Senaryo:
- Kullanıcı: **Selin Aydın**
- Premium: **Evet**
- Aktif diyetisyen/klinik bağlamı: **Dyt. Selin Aydın / Aydın Sağlık Merkezi**
- Web panelde görülen tarif: **Avokadolu Yumurta Tostu**
- Mobilde seçilen malzemeler: **Ekmek + Yumurta + Avokado**
- Beklenen sonuç: Bu tarif, doğru scope ve ingredient eşleşmesi ile sonuçlara gelmeli veya gelmiyorsa sebebi açıklanabilir ve veri/kurala dayalı olmalı.
- Gerçek sonuç: Mobil sonuç ekranında `Uygun tarif bulunamadı` ve `Tarif verisi alınamadı` gösteriliyor.

---

## Gözlenen Durum

Video incelemesine göre:

1. Web panelde tarif listesinde **Avokadolu Yumurta Tostu** görünür durumda.
2. Mobilde kullanıcı `yumurta` aratıyor, seçili malzemeler içinde **Ekmek**, **Avokado**, **Yumurta** bulunuyor.
3. `Birleştir ve Tarif Bul` tetiklendiğinde önce analiz/unboxing akışı başlıyor.
4. Sonuç ekranında `Uygun tarif bulunamadı` ve ayrıca `Tarif verisi alınamadı / Tarif eşleştirme başarısız` hatası gösteriliyor.
5. Backend logları, sorunun algoritmik sıralamadan önce **RecipeMatch endpoint'i içinde runtime exception** ile kırıldığını gösteriyor.

Bu nedenle bu hata şu aşamada "tarif mantıksız sıralanıyor" problemi değil, önce **API çalışamaz hale geliyor** problemidir.

---

## Eldeki Güçlü Kanıtlar

### 1) Premium handshake ve private recipe erişim mantığı
Mevcut proje dokümantasyonuna göre premium kullanıcı, `activeDietitianId` üzerinden diyetisyenine ait özel tarif havuzuna erişmelidir. Diyetisyen tarif girdiğinde veri `DietitianId` ile etiketlenir ve danışan `Birleştir` butonuna bastığında sistem diyetisyenin özel havuzunu tarar. Ayrıca veri izolasyonu her sorguda `activeDietitianId` ile korunmalıdır. fileciteturn7file10

### 2) Tarif öneri motorunun hedef davranışı
Tez dokümanında sistemin yalnızca isim araması değil; **çok katmanlı standardizasyon + zorunlu / opsiyonel / yasaklı / alternatif kuralları** ile karar veren bir öneri motoru olması gerektiği açıkça tanımlanıyor. fileciteturn6file3

### 3) Backend hata kaynağı
Loglarda `RecipeMatchController.Match(KitchenMergeRequest request)` içinde query çalışırken PostgreSQL hatası alındığı görülüyor:
- `column r.IsDemo does not exist`
- hata noktası `RecipeMatchController.cs:line 141`
- query `Recipes` tablosundan `IsDemo`, `IsDraft`, `IsHiddenFromProduction`, `IsPublic`, `DietitianId` alanlarını seçiyor ve filtreliyor. fileciteturn7file18 fileciteturn7file16

### 4) Tarifin gerçekten diyetisyene bağlı olarak var olduğunu gösteren kanıt
Aynı log setinde diyetisyen kimliği için şu sorguların çalıştığı görülüyor:
- `SELECT count(*) FROM "Recipes" WHERE "DietitianId" = @dietitianId`
- `SELECT Id, Name, Description, IsPublic FROM "Recipes" WHERE "DietitianId" = @dietitianId ORDER BY Name`
Bu, tarifin web panelde görünmesinin tesadüf olmadığını ve verinin gerçekten DB'de dietitian scope ile bulunduğunu gösteriyor. Sorun **web panel tarafında değil**, özellikle **match pipeline** tarafında. fileciteturn7file13

---

## Ön Teşhis

### Kritik root cause
`RecipeMatch` akışında kullanılan `Recipe` sorgusu veya projection'ı, veritabanında bulunmayan kolonları (`IsDemo`, muhtemelen devamında `IsDraft`, `IsHiddenFromProduction`) okumaya çalışıyor.

Bu nedenle:
- endpoint exception fırlatıyor,
- mobilde API başarısız oluyor,
- kullanıcıya "tarif bulunamadı" gibi görünen ama gerçekte **server-side schema mismatch** olan bir hata dönüyor.

### Yüksek olasılıklı teknik nedenler
Aşağıdakilerden biri veya birkaçı mevcut olabilir:

1. `Recipe` entity/model güncellenmiş ama migration uygulanmamış.
2. Migration yazılmış ama local DB'ye uygulanmamış.
3. Kod branch'i yeni `Recipe` flag alanlarını kullanıyor, fakat mevcut DB şeması eski.
4. `RecipeMatchController` veya servis/repository, entity'yi tam alanla query ediyor; oysa local DB'de bu alanlar yok.
5. Dashboard listesi daha dar projection kullandığı için çalışıyor; match endpoint ise yeni kolonları select ettiği için patlıyor.

---

## Çok Önemli Not

Bu hatayı **sadece `IsDemo` kolonunu kaldırarak** kapatma.

Çünkü `IsDemo` düzelse bile sıradaki muhtemel kırılımlar:
- `IsDraft`
- `IsHiddenFromProduction`
- varsa başka yeni boolean/visibility alanları
olabilir.

Yani fix:
- ya **DB şemasını** kodun beklediği hale getirmeli,
- ya da **kodun query contract'ını** gerçekten var olan şemaya uyarlamalı,
- ama mutlaka **tek bir source of truth** oluşturmalıdır.

---

## Claude İçin Uygulanacak Görevler

## A. Runtime kırılımını kapat

Aşağıdaki dosyaları ve katmanları incele:
- `RecipeMatchController`
- `KitchenMergeRequest` ve response DTO'ları
- recipe match service / repository / evaluator
- `Recipe` entity
- `AppDbContext`
- `ModelSnapshot`
- son migrations
- `Recipes` tablosu gerçek PostgreSQL şeması

Yapılacaklar:

1. `Recipe` entity ile gerçek DB şemasını karşılaştır.
2. `IsDemo`, `IsDraft`, `IsHiddenFromProduction` alanları gerçekten bu projede olması gereken alanlar mı karar ver.
3. Eğer olması gerekiyorsa:
   - yeni EF migration oluştur
   - `Recipes` tablosuna bu kolonları ekle
   - default değerleri `false` yap
   - existing rows için backfill uygula
   - seed ve tests'i güncelle
4. Eğer bu kolonlar bu branch için canonical değilse:
   - match query'den kaldır
   - eşdeğer mevcut visibility mantığına bağla
   - dead code / stale assumption temizliği yap
5. Fix sonrası `/api/recipes/match` endpoint'i artık exception atmadan cevap dönebilmeli.

---

## B. Scope mantığını doğrula

Fix sonrası ikinci katman test:
Selin Aydın premium kullanıcı olarak **yalnızca**
- public tarifler
- kendi aktif diyetisyenine bağlı erişilebilir private tarifler

görebilmelidir.

Doğrulanacaklar:
1. `activeDietitianId` doğru resolve ediliyor mu?
2. `DietitianClientLinks.IsActive` doğru okunuyor mu?
3. `RecipeMatch` query'si public + own dietitian private birleşimini mi kullanıyor?
4. Başka diyetisyenin private tarifleri sızıyor mu?
5. Public ve clinic tariflerin grouping mantığı doğru mu?

---

## C. Avokadolu Yumurta Tostu eşleşmesini gerçek veri üzerinden doğrula

Fix sonrası yalnızca endpoint'in ayağa kalkması yetmez.
Aşağıdaki senaryoyu gerçek DB ile çalıştır:

### Test senaryosu
- Client: `Selin Aydın`
- Active dietitian: `Dyt. Selin Aydın`
- Selected ingredients:
  - Ekmek
  - Yumurta
  - Avokado

### İncelenecekler
1. `Avokadolu Yumurta Tostu` recipe row'unu doğrudan DB'den çek.
2. Bu tarife bağlı ingredient relation tablolarını incele:
   - mandatory ingredients
   - optional ingredients
   - prohibited ingredients
   - substitute/alternative mappings
3. Bu recipe gerçekten private mı, public mi, hidden mı?
4. Bu recipe'nin mandatory ingredient set'i gerçekten `Ekmek + Yumurta + Avokado` ile karşılanıyor mu?
5. Eğer karşılanmıyorsa, hangi ingredient yüzünden eleniyor?
6. Eğer karşılanıyorsa neden sonuç listesine düşmüyor?

### Özellikle kontrol et
- canonical ingredient ID eşleşmesi
- alias mapping
- parent-child taxonomy
- substitute resolution
- Turkish character normalization
- mobile request payload'ında ingredient IDs mi gidiyor, names mi gidiyor?
- mobile selection ile backend dictionary mapping aynı contract'ı mı kullanıyor?

---

## D. Açıklanabilir debug çıktısı ekle

Geçici ama çok faydalı bir debug modu ekle.

Amaç:
Her recipe için neden geçti / neden elendi görünür olsun.

En azından log seviyesinde aşağıdaki bilgiler çıkmalı:
- recipe id / recipe name
- scope source: `public` / `clinic`
- matched mandatory count
- missing mandatory count
- matched optional count
- prohibited hit var mı
- substitute ile karşılanan ingredient var mı
- final bucket:
  - `FULL_MATCH`
  - `ONE_MISSING`
  - `PARTIAL`
  - `REJECTED_PROHIBITED`
  - `REJECTED_SCOPE`
  - `REJECTED_HIDDEN`
  - `REJECTED_MISSING_REQUIRED`
- reject reason text

Bu log sayesinde tekrar aynı tip hata olduğunda UI semptomuna bakarak tahmin yürütmek zorunda kalmayacağız.

---

## E. Mobile tarafı da kontrol et

Backend fix edilse bile mobile mapping hatalı olabilir.
Bu yüzden şunları da kontrol et:

1. Mobile request doğru endpoint'e gidiyor mu?
2. Request body'de seçili ingredientler doğru formatta gönderiliyor mu?
3. Response 200 gelse bile UI bunu yanlışlıkla `empty` gibi yorumluyor olabilir mi?
4. Error state ile empty state ayrılmış mı?
   - `Tarif yok`
   - `API exception`
   - `network failure`
   - `bad payload`
   aynı state'e düşmemeli.
5. `Tarif verisi alınamadı` mesajı sadece backend exception veya invalid response durumunda gösterilmeli.
6. Match sonucu gelirse `Avokadolu Yumurta Tostu` kartı doğru bucket altında render edilmeli.

---

## Beklenen Nihai Davranış

Aşağıdaki davranış sağlanmış olmalı:

1. Mobilde premium kullanıcı Selin Aydın ile giriş yapılır.
2. Ekmek + Yumurta + Avokado seçilir.
3. `Birleştir ve Tarif Bul` tetiklenir.
4. Backend exception atmaz.
5. `RecipeMatch` aktif diyetisyenin tarif havuzunu doğru scope ile tarar.
6. `Avokadolu Yumurta Tostu` eğer veri modeline göre uygun ise sonuçlarda görünür.
7. Eğer görünmüyorsa, bunun nedeni loglarda ve evaluator çıktısında net olarak açıklanabilir olur.
8. Mobile, error state ile empty state'i karıştırmaz.

---

## Acceptance Criteria

Aşağıdakilerin hepsi sağlanmadan iş bitmiş sayılmayacak:

- [ ] `/api/recipes/match` artık `column r.IsDemo does not exist` hatası vermiyor.
- [ ] `Recipe` entity / migrations / DB schema uyumlu.
- [ ] Selin Aydın premium scope doğru resolve ediliyor.
- [ ] `Avokadolu Yumurta Tostu` DB'de ilgili dietitian altında doğrulanıyor.
- [ ] Ekmek + Yumurta + Avokado senaryosu runtime'da test edildi.
- [ ] Tarif görünüyorsa doğru bucket'ta render ediliyor.
- [ ] Görünmüyorsa reject reason debug log ile açık.
- [ ] Public/private leakage yok.
- [ ] Mobile error state ve no-result state ayrışmış durumda.
- [ ] En az 1 regression/integration test bu vaka için eklendi.

---

## Claude'dan İstenen Çıktı

İş bittiğinde sadece "düzeldi" deme.
Aşağıdaki formatta rapor ver:

1. Root cause
2. Hangi dosyalar değişti
3. Schema mı düzeldi, query mi düzeldi, ikisi de mi
4. Avokadolu Yumurta Tostu neden görünmüyordu
5. Fix sonrası gerçek runtime sonucu
6. Manuel test adımları
7. Varsa kalan riskler / seed data notları

---

## Uygulama Prensibi

Yalnız testleri yeşile çevirmek yetmez.
Bu görevde başarı kriteri:
- gerçek local DB
- gerçek premium kullanıcı
- gerçek dietitian scope
- gerçek mobil akış
üzerinde hatanın kapanmasıdır.
