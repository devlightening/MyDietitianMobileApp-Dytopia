# Video Analysis -> Global + Local MD Strategy

## Neden bu dosya var?
Bu not, paylaşılan YouTube videosundaki ana fikri projeye uygulanabilir hale getirmek için hazırlandı.

Video mantığından çıkan temel mesaj şudur:
- AI coding assistant'a aynı şeyi her seferinde yeniden anlatmak verimsizdir.
- Tek seferlik ama doğru yazılmış "skill / instruction" dosyaları, çıktıyı daha tutarlı hale getirir.
- Bu yapı iki katmanda kurulmalıdır:
  1. **Global** -> her projede geçerli çalışma disiplini
  2. **Local** -> sadece bu repo ve bu ürün için geçerli gerçekler

Bu yüzden paket iki katmana ayrıldı:
- **Global MD'ler**: genel mühendislik davranışı, görev yürütme standardı, teslim formatı
- **Local MD'ler**: MyDietitianMobileApp için tez omurgası, ürün mantığı, öncelikler, kabul kuralları

---

## Videodan çıkarılan uygulanabilir prensipler

### 1. Aynı hata tekrar etmemeli
Claude/Cursor benzeri ajanlar her görevde yeniden bağlam kurmak zorunda kalıyorsa:
- gereksiz dosya gezer
- scope büyütür
- bir tur doğru, bir tur yanlış davranır
- önceki kararlarla çelişebilir

Çözüm:
- kalıcı kuralları MD dosyalarına taşı
- her yeni görevde bu dosyaları ilk bağlam katmanı yap

### 2. Global ve local ayrımı şart
Her şeyi tek dosyada toplamak kötü sonuç verir.

Doğru ayrım:
- **Global**: nasıl çalışılacağı
- **Local**: bu projede neyin doğru olduğu

### 3. Skill dosyası prompt değil, işletim sistemi gibi çalışmalı
İyi bir MD dosyası sadece "şunu yap" demez.
Şunları da belirler:
- neyi asla bozma
- neye öncelik ver
- neyi kanıt say
- hangi sırayla ilerle
- işi bitince nasıl rapor ver

### 4. Repository truth her zaman prompttan üstündür
Bu projede assistant:
- kodu görmeden tahmin yapmamalı
- DB davranışını doğrulamadan iddia kurmamalı
- UI görüntüsünü tek gerçek kabul etmemeli

### 5. Local dosya proje omurgasını korumalı
Bu repo için ana omurga:
- multi-layer ingredient normalization
- ingredient taxonomy
- rule-based recommendation engine
- premium tenant isolation
- benchmark + logging + explainability

Bu omurga unutulursa proje generic tarif uygulamasına kayar.

---

## Bu paketin yükleme sırası
Yeni bir görev verirken aşağıdaki sırayla okut:

1. `01_GLOBAL_AI_ENGINEERING_RULES.md`
2. `02_GLOBAL_TASK_EXECUTION_TEMPLATE.md`
3. `10_LOCAL_MYDIETITIAN_PROJECT_CONTEXT.md`
4. `11_LOCAL_MYDIETITIAN_THESIS_AND_PRODUCT_RULES.md`
5. `12_LOCAL_MYDIETITIAN_PRIORITY_BACKLOG.md`
6. `13_LOCAL_MYDIETITIAN_DELIVERY_TEMPLATE.md`

---

## Kullanım şekli

### Hızlı görevlerde
Global + Local Project Context + Local Rules yeterlidir.

### Karmaşık görevlerde
Tüm dosyaları birlikte okut.

### Yeni bir görev verirken ekle
Aşağıdaki kısa açılışı kullan:

```md
Önce ilgili global ve local MD dosyalarını oku.
Sonra bu görevi şu formatta ele al:
- classification
- affected files
- risk
- smallest correct plan
- implementation
- verification
- remaining uncertainty
```

---

## Beklenen sonuç
Bu yapı kullanıldığında Claude'dan beklenen fark:
- daha az gereksiz gezinme
- daha az rastgele refactor
- daha doğru önceliklendirme
- tez odağından daha az kopma
- görevler arasında daha tutarlı kararlar
- daha iyi teslim raporu

---

## Bu proje için en kritik uyarlama
Bu paketin en önemli yönü şudur:

Assistant, bu projeyi
**"mobil uygulama yapıyoruz"** diye değil,
**"serbest malzeme girdisini standardize edip, taksonomi ve kural tabanlı öneri üreten tez odaklı bir sistem geliştiriyoruz"** diye ele almalıdır.
