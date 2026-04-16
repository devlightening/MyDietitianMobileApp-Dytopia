# MyDietitian — Danışan Detay Ekranı + Ölçüm Sistemi Güçlendirme Planı

## Amaç
Bu planın amacı, web paneldeki **danışan detay sayfasını** ve mobil uygulamadaki **ölçüm ekleme / ölçüm geçmişi** akışını profesyonel, klinik kullanıma uygun ve veri açısından sürdürülebilir hale getirmektir.

Plan; UI iyileştirmesi değil, aynı zamanda **ürün kurgusu + veri modeli + API + iş kuralları + kullanıcı rolleri + tarihsel takip** mantığını birlikte ele alır.

---

## Mevcut Problem Özeti

### Web panel — Danışan detay ekranı
Gözlenen sorunlar:
- Üst başlık alanı çok zayıf. Danışan kartında neredeyse sadece ad ve e-posta görünüyor.
- `ID: selin.aydin@test.local` gibi teknik/ham bilgi kullanıcıya gösteriliyor; klinik açıdan faydasız ve amatör görünüyor.
- Sekmeler var ama içerik kurgusu zayıf:
  - Genel bakış yeterince bilgi vermiyor
  - Aktiviteler sekmesi net değil
  - Ölçümler sekmesi boş hissi veriyor
  - Plan sekmesinde aktif plan yoksa güçlü yönlendirme ve geçmiş görünmüyor
  - İletişim çalışıyor ama bütün sayfa ona göre zayıf kalıyor
- Diyetisyenin danışanın değişimini hızlı anlamasını sağlayacak özet görünüm yok.

### Mobil — Ölçüm ekranı
Gözlenen sorunlar:
- Ölçüm ekranı görsel olarak amatör kalıyor.
- Form yalnızca birkaç alanla sınırlı ve klinik ihtiyaçları tam karşılamıyor.
- Ölçüm kaydı başarısız oluyor.
- Ölçümler zaman serisi olarak tutulmuyor ya da kullanıcıya iyi sunulmuyor.
- Kullanıcı geçmiş gelişimini, diyetisyen ise düzenli değişim çizgisini göremiyor.

---

## Ürün Kararı: Ölçümü kim girmeli?

## Önerilen yaklaşım: **hibrit ama kaynak etiketli model**
Tek bir tarafı seçmek yerine şu model kullanılmalı:

### 1. Klinik ölçüm (authoritative / güvenilir ölçüm)
Diyetisyen veya klinik çalışanı girer.
Örnek alanlar:
- boy
- bel çevresi
- kalça çevresi
- göğüs çevresi
- yağ oranı
- kas oranı
- ölçüm notu
- kullanılan cihaz / yöntem

### 2. Öz bildirimli ölçüm (self-reported)
Kullanıcı mobilden girer.
Örnek alanlar:
- kilo
- günlük/haftalık tartı sonucu
- akıllı tartıdan gelen yağ oranı
- su oranı gibi ev tipi cihaz verileri

### Neden hibrit model?
Çünkü:
- Boy, çevresel ölçüler ve klinik takip verileri diyetisyen tarafından girildiğinde daha tutarlı olur.
- Kilo gibi sık güncellenen veriler kullanıcı tarafından da girilebilmelidir.
- Kullanıcının veri girebilmesi engagement artırır.
- Diyetisyen klinik doğrulama yapabildiği için sistem güvenilir kalır.

### Son karar
Her ölçüm kaydı için şu alan zorunlu olsun:
- `sourceType`: `dietitian`, `client`, `smart_scale`, `system`
- `recordedByUserId`
- `recordedAtUtc`

Böylece aynı danışanın hem klinik hem öz bildirimli ölçümleri birlikte saklanır ama karışmaz.

---

## Hedef Ürün Kurgusu

## 1. Web panel — danışan detay sayfası yeniden kurgulanmalı
Sekmeler korunabilir ama içerikleri güçlendirilmeli.

### A. Üst danışan özet başlığı
Şu anki başlık bloğu yeniden tasarlanmalı.

#### Gösterilmesi gereken bilgiler
- Ad Soyad
- Yaş
- Cinsiyet
- Premium durumu
- Kayıt tarihi
- Son aktif olduğu tarih
- Atanmış aktif plan durumu
- Güncel kilo
- Hedef kilo
- Boy
- BMI
- Son ölçüm tarihi
- Diyetisyen not rozeti veya risk uyarısı

#### Gösterilmemesi gereken şey
- Teknik/internal ID düz metin olarak görünmemeli
- E-posta ana bilgi gibi öne çıkmamalı

#### Önerilen yapı
Üst alanda 3 blok olsun:
1. **Kimlik kartı**: isim, yaş, premium, iletişim
2. **Klinik özet**: kilo, hedef kilo, BMI, boy, yağ oranı
3. **Takip özeti**: son ölçüm, 7 günlük uyum, aktif plan, son giriş

---

### B. Genel Bakış sekmesi
Bu sekme danışanın bir “dashboard”ı gibi davranmalı.

#### İçerik
- Son 7/30 günlük uyum yüzdesi
- Güncel kilo vs başlangıç kilosu
- Hedefe kalan fark
- Son ölçümden bu yana değişim
- Son 3 önemli olay:
  - plan atandı
  - ölçüm güncellendi
  - tarif uyumu düştü/yükseldi
- Motivasyon / streak kartı
- Son notlar özeti

#### Kart önerileri
- **Başlangıç Kilosu / Güncel Kilo / Hedef Kilo**
- **BMI değişimi**
- **Bel çevresi değişimi**
- **Son 7 gün plan uyumu**
- **Bekleyen aksiyonlar**
  - yeni ölçüm gerekli
  - aktif plan yok
  - uzun süredir giriş yok

---

### C. Aktiviteler sekmesi
Bu sekme gerçek activity feed olsun.

#### Olası event türleri
- plan atandı
- plan güncellendi
- ölçüm eklendi
- kullanıcı kilo girdi
- tarif tamamlandı
- öğün atlandı
- alternatif tarif kullanıldı
- not eklendi
- premium aktivasyonu oldu

#### Filtreler
- hepsi
- ölçüm
- plan
- uyum
- tarif
- iletişim

Bu sekme diyetisyenin danışan davranışını zaman sırasıyla görmesini sağlar.

---

### D. Ölçümler sekmesi
Bu sekme projenin en güçlü klinik alanlarından biri olabilir.

#### Üst özet kartları
- son kilo
- başlangıçtan değişim
- son BMI
- yağ oranı
- bel/kalça oranı
- son ölçüm tarihi

#### Grafikler
- tarih bazlı kilo grafiği
- BMI trend grafiği
- yağ oranı trend grafiği
- bel çevresi trend grafiği

#### Ölçüm tablosu
Her kayıt için:
- tarih
- kaynak (`diyetisyen` / `kullanıcı`)
- kilo
- boy
- BMI
- yağ oranı
- bel
- kalça
- göğüs
- not

#### Diyetisyen aksiyonları
- yeni klinik ölçüm ekle
- mevcut kaydı düzenle
- kaydı klinik olarak onayla
- anormal ölçüm için işaret koy

---

### E. Plan sekmesi
Şu an aktif plan yok görünümü çok boş.

#### Geliştirilmesi gerekenler
- Aktif plan varsa özet kart göster
- Aktif plan yoksa bile:
  - son atanmış plan
  - geçmiş planlar
  - plan atama CTA
- Plan içeriğinden hızlı görünüm:
  - öğün sayısı
  - günlük toplam kcal
  - tarif bağlı öğün sayısı
  - uyum oranı

---

### F. İletişim sekmesi
Bu zaten çalışıyor ama aşağıdaki geliştirmelerle güçlenebilir:
- iletişim geçmişi zaman çizelgesi
- okunmadı / yanıt bekliyor filtresi
- ölçüm isteme hızlı aksiyonu
- hazır mesaj şablonları

---

## 2. Mobil — Ölçüm sistemi yeniden tasarlanmalı

## Ölçüm ekranı tek form değil, ölçüm modülü olmalı

### A. Mobil ana ölçüm ekranı
Şu bölümler olsun:
1. **Son ölçüm özeti**
2. **Yeni ölçüm ekle**
3. **Ölçüm geçmişi**
4. **Trend kartları**

### B. Yeni ölçüm formu
Şu alanlar desteklenmeli:
- kilo (kg)
- boy (cm)
- yağ oranı (%)
- kas oranı (%) opsiyonel
- su oranı (%) opsiyonel
- bel (cm)
- kalça (cm)
- göğüs (cm)
- not
- ölçüm tarihi

### C. Hesaplanan alanlar
Kayıt sırasında ya da response içinde hesaplanmalı:
- BMI
- BMI kategorisi
- BMR
- bel/kalça oranı

### D. Kaynak mantığı
Mobil kullanıcı girerse:
- `sourceType = client`

Web panelde diyetisyen girerse:
- `sourceType = dietitian`

### E. Geçmiş görünümü
Mobilde sadece son ölçüm değil, tarihsel liste de olmalı:
- bugün
- geçen hafta
- geçen ay
- önceki kayıtlar

Her kayıtta küçük değişim göstergesi:
- +0.8 kg
- -2 cm bel
- BMI düştü

### F. Profesyonel tasarım ilkeleri
- Tek beyaz kart içinde kaba form yerine bölümlemeli yapı
- Alanlar klinik etiket + birim ile net görünmeli
- Son ölçüm kartı ile yeni ölçüm formu ayrılmalı
- Grafik küçük ama okunaklı olmalı
- “Kaydet” yerine daha güçlü CTA: `Ölçümü Kaydet` / `Takibi Güncelle`

---

## Veri Modeli Önerisi

## Yeni / güçlendirilecek tablo: `ClientMeasurements`
Her satır tek bir ölçüm anını temsil etmeli.

### Önerilen alanlar
- `Id`
- `ClientId`
- `RecordedAtUtc`
- `SourceType` (`dietitian`, `client`, `smart_scale`, `system`)
- `RecordedByUserId` nullable
- `WeightKg` nullable
- `HeightCm` nullable
- `BodyFatPercent` nullable
- `MusclePercent` nullable
- `WaterPercent` nullable
- `WaistCm` nullable
- `HipCm` nullable
- `ChestCm` nullable
- `Bmi` nullable or computed snapshot
- `BmiCategory` nullable
- `Bmr` nullable
- `WaistHipRatio` nullable
- `Notes` nullable
- `IsClinicallyVerified` boolean
- `CreatedAtUtc`

### Not
BMI, BMR gibi alanlar teorik olarak hesaplanabilir. Ama geçmiş raporlama ve snapshot kararlılığı için response üretiminde hesaplanıp kayda da yazılabilir.

---

## API Planı

### Mobil / kullanıcı tarafı
- `GET /api/profile/measurements/latest`
- `GET /api/profile/measurements/history`
- `POST /api/profile/measurements`

### Diyetisyen / web panel tarafı
- `GET /api/dietitian/clients/{clientId}/measurements`
- `POST /api/dietitian/clients/{clientId}/measurements`
- `PUT /api/dietitian/clients/{clientId}/measurements/{measurementId}`
- `GET /api/dietitian/clients/{clientId}/overview`

### Response içinde dönmesi gereken özetler
- latest measurement
- baseline measurement
- delta from baseline
- delta from previous
- trend summary

---

## İş Kuralları

### 1. Boy her ölçümde zorunlu mu?
Hayır.
- İlk güvenilir ölçümde alınmalı
- Sonraki kayıtlarda aynı boy kullanılabilir
- Kullanıcı sadece kilo girebilir
- Diyetisyen isterse boyu güncelleyebilir

### 2. BMI ve BMR nasıl hesaplanmalı?
- BMI = kilo / (boy metre)^2
- BMR kullanıcı profiline göre hesaplanmalı
- Profil verisi eksikse BMR `null` dönebilir ve UI'da açıklanmalı

### 3. Aynı gün birden fazla kayıt olabilir mi?
Evet, ama:
- `sourceType` önemli
- diyetisyen ölçümü authoritative kabul edilir
- kullanıcı girdiği ölçüm ayrı tutulur

### 4. Web panelde hangi ölçüm önde gösterilmeli?
- Öncelik: en son `dietitian` kaydı
- yoksa en son `client` kaydı

### 5. Hedef değerler ayrı mı tutulmalı?
Evet. Hedef kilo ve klinik hedefler ölçüm tablosunda değil, danışan profili veya ayrı hedef tablosunda tutulmalı.

---

## UI / UX Tasarım Kararları

## Web panel — danışan başlık alanı
### Mevcut sorun
- boş alan çok fazla
- bilgi az
- teknik kimlik bilgisi öne çıkıyor

### Yeni öneri
Başlık kartı şu bölümlere ayrılsın:
- Sol: isim, yaş, iletişim, premium, danışan etiketi
- Orta: güncel kilo, hedef kilo, BMI, boy
- Sağ: son ölçüm, aktif plan, son 7 gün uyum

`ID:` alanı kullanıcıya görünmesin. Gerekirse sadece admin/debug drawer’da olsun.

---

## Mobil ölçüm ekranı
### Mevcut sorun
- amatör hissediyor
- çok az alan var
- hata mesajı kaba ve açıklamasız

### Yeni öneri
- Üstte son ölçüm kartı
- Ortada sekmeli giriş:
  - Hızlı giriş
  - Klinik detay
- Altta geçmiş liste
- Hata durumları daha açıklayıcı:
  - ağ hatası
  - doğrulama hatası
  - backend kaydetme hatası

---

## Ölçüm kaydetme hatası için olası teknik nedenler
Ekran görüntüsüne göre mobilde `Ölçüm kaydedilemedi` genel hatası var. Bu büyük ihtimalle şu gruplardan biri:
- endpoint contract mismatch
- backend validation failure
- auth/token sorunu
- yeni alanlar ile eski DTO uyumsuzluğu
- save başarılı değil ama response shape beklenenden farklı

Bu plan uygulanırken önce mevcut measurement API uçtan uca trace edilmelidir.

---

## Uygulama Senaryoları

## Senaryo 1 — Kullanıcı evde kilo giriyor
Danışan haftada 3 kez tartılıyor ve mobilden kilo giriyor. Sistem bu kaydı `sourceType=client` olarak ekliyor. Sonraki ekranda kullanıcı:
- son kilosunu
- geçen haftaya göre farkı
- BMI değişimini
- trend grafiğini
 görüyor.

Diyetisyen web panelde bu veriyi “öz bildirimli ölçüm” etiketiyle görüyor.

## Senaryo 2 — Diyetisyen klinikte detaylı ölçüm alıyor
Danışan kontrole geldiğinde diyetisyen:
- kilo
- boy
- bel
- kalça
- göğüs
- yağ oranı
 giriyor.

Bu kayıt `sourceType=dietitian` ve `IsClinicallyVerified=true` ile saklanıyor. Genel bakış ekranındaki ana değerler bu kayda göre güncelleniyor.

## Senaryo 3 — Gelişim takibi
Bir ay sonra diyetisyen danışan detay sayfasında:
- başlangıç kilosundan -3.2 kg
- bel çevresinde -4 cm
- BMI düşüşü
- son 30 günlük plan uyumu
- son ölçüm tarihi
tek bakışta görebiliyor.

## Senaryo 4 — Plan karar desteği
Diyetisyen yeni plan atarken danışanın ölçüm trendlerine bakıyor. Son 2 haftada kilo kaybı hızlıysa kaloriyi çok agresif düşürmüyor. Eğer bel çevresi iyi gidiyor ama kilo sabitse, yine olumlu karar verebiliyor. Böylece sistem yalnızca veri saklamıyor, karar kalitesini artırıyor.

---

## Claude için Uygulama Talimatları

### Önce analiz et
Kod yazmadan önce mevcut sistemi analiz et:
- web panel client detail page
- measurements tab
- mobile `ProfileMeasurementsScreen`
- ilgili API controller / DTO / entity / migration
- danışan overview verisi hangi endpointten geliyor

### Sonra şu kapsamda uygula
1. danışan detay başlığını profesyonel hale getir
2. genel bakış sekmesini klinik dashboard mantığına taşı
3. ölçümler sekmesini tarihsel, grafik destekli hale getir
4. mobil ölçüm ekranını yeniden tasarla
5. measurement veri modelini tarihsel ve kaynak etiketli yap
6. measurement save hatasını düzelt
7. web + mobile ortak veri sözleşmesini netleştir
8. migration gerekiyorsa üret
9. seed değil, gerçek akışa uygun yapı kur

### Çok önemli sınırlar
- mevcut auth yapısını bozma
- mevcut plan/tarif modüllerini bozma
- premium ve klinik tarif sistemine dokunma
- measurement işi için gerekli minimum ama sağlam backend değişikliği yap
- UI değişikliği yaparken mevcut tema dilini koru

---

## Beklenen Çıktı
Claude çalışmayı bitirdiğinde şu çıktıyı raporlamalı:
- değişen dosyalar
- yeni entity / migration / endpoint listesi
- web panelde client detail sayfasında ne değişti
- mobilde measurement akışında ne değişti
- save hatasının kök nedeni ve fix'i
- tarihsel ölçüm kaydının nasıl tutulduğu
- sourceType mantığının nasıl uygulandığı
- diyetisyen ve kullanıcı rollerinin ölçüm girişindeki farkı
- hangi alanların hesaplandığı (BMI/BMR/ratio)
- manuel test senaryoları

---

## Son Ürün Vizyonu
Bu geliştirme tamamlandığında sistem:
- diyetisyen için daha profesyonel bir danışan takip paneli
- danışan için daha güven verici ve anlamlı bir ölçüm deneyimi
- tarihsel değişimi görünür kılan klinik takip altyapısı
- plan kararlarını destekleyen ölçüm geçmişi
sunmalıdır.

Yani ölçüm modülü sadece “veri girişi” değil, **klinik takip ve karar desteği** modülü haline gelmelidir.
