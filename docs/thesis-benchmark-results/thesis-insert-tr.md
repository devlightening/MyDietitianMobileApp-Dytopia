# Teze Eklenecek Benchmark Bulguları

### 3.x. Normalizasyon Deneyi Sonuçları

Normalizasyon hattı, canonical eşleşme, alias eşleşmesi, Türkçe karakter/yazım farkı, fuzzy eşleşme ve negatif örneklerden oluşan 73 senaryoluk test kümesi üzerinde çalıştırılmıştır. Bu deneyde 72 senaryo doğru sonuçlanmış, toplam doğruluk oranı %98,63 olarak ölçülmüştür. Çözülemeyen giriş sayısı 11 olup unresolved oranı %15,07 seviyesindedir. Yanlış bir malzemeye bağlanma anlamına gelen false match sayısı 0 olarak gerçekleşmiş ve false match oranı %0,00 ölçülmüştür. Ortalama normalizasyon süresi 1,2029 ms, medyan süre 0,7400 ms, P95 süre ise 2,6750 ms olarak kaydedilmiştir.

| Resolver katmanı | Sayı | Oran |
|---|---:|---:|
| Alias | 23 | %31,51 |
| Canonical | 26 | %35,62 |
| Fuzzy | 13 | %17,81 |
| Unresolved | 11 | %15,07 |

Bu sonuçlar, sistemin en güçlü katkısının yanlış pozitif eşleşme üretmeden yüksek kapsama sağlaması olduğunu göstermektedir. Pozitif beklenen senaryolarda yalnızca `pirinc pilav` girdisi `Pirinç` malzemesine bağlanamamış ve unresolved olarak kalmıştır. Bu durum, sistemin belirsiz eşleşmelerde hatalı karar vermek yerine kullanıcı/diyetisyen onayı gerektiren güvenli moda geçme davranışıyla uyumludur.

### 3.x. Normalizasyon Ablation Sonuçları

Ablation deneyi, normalizasyon hattındaki katmanların katkısını ayrı ayrı ölçmek için gerçekleştirilmiştir. Canonical-only modunda doğruluk %49,32 iken canonical ve alias birlikte kullanıldığında doğruluk %80,82 seviyesine çıkmıştır. Fuzzy eşleştirmenin eklenmesiyle doğruluk %98,63 seviyesine ulaşmış, unresolved oranı %15,07 seviyesine düşmüştür. Full pipeline sonucu da OpenAI anahtarı yapılandırılmadığı için deterministik katmanlarla aynı doğruluk seviyesinde kalmıştır. OpenAI fallback modu, çalışma ortamında OpenAI anahtarı bulunmadığı için çalıştırılmamış ve sonuçlar uydurulmamıştır.

| Mod | Doğruluk | Kapsama | Unresolved | False match |
|---|---:|---:|---:|---:|
| Canonical only | %49,32 | %35,62 | %64,38 | %0,00 |
| Canonical + Alias | %80,82 | %67,12 | %32,88 | %0,00 |
| Canonical + Alias + Fuzzy | %98,63 | %84,93 | %15,07 | %0,00 |
| Full pipeline | %98,63 | %84,93 | %15,07 | %0,00 |
| Full pipeline + LLM fallback | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı |

### 3.x. Tarif Öneri Motoru Deneyi Sonuçları

Tarif öneri motoru, zorunlu malzeme, opsiyonel malzeme, yasaklı malzeme, alternatif malzeme, condiment-only guard, boş zorunlu malzeme kalite kontrolü ve opsiyonel eksik senaryolarını kapsayan 36 senaryoluk test kümesi üzerinde değerlendirilmiştir. Motor, 36 senaryonun tamamında beklenen karar sınıfını üretmiş ve Recipe Match Accuracy değeri %100,00 olarak ölçülmüştür. Yasaklı malzeme filtresi başarısı %100,00, alternatif malzeme işleme başarısı %100,00, condiment-only guard başarısı ise %100,00 olarak gerçekleşmiştir. Ortalama karar üretim süresi 0,3894 ms, medyan süre 0,0089 ms, P95 süre ise 4,5122 ms olarak ölçülmüştür.

Bu bulgular, öneri motorunun yalnızca eşleşen malzeme sayısına bakmadığını; yasak, alternatif, eksik zorunlu malzeme ve anlamsız düşük kaliteli eşleşmeleri ayrı karar sınıflarıyla ayırt edebildiğini göstermektedir.

### 3.x. Premium Guard ve Tenant Isolation Sonuçları

Premium erişim ve tenant isolation testi 10 senaryo ile yürütülmüştür. Free kullanıcıların private tarife erişimi, premium kullanıcının yalnızca kendi diyetisyenine ait private tarifleri görebilmesi, başka diyetisyenin private tariflerine erişimin engellenmesi, public fallback davranışı, expired access key ve revoked premium senaryoları test edilmiştir. 10 senaryonun tamamı beklenen sonucu üretmiştir. Premium Guard Success oranı %100,00, Tenant Isolation Success oranı ise %100,00 olarak ölçülmüştür. Başarısız premium/tenant izolasyon senaryosu bulunmamıştır.

### 3.x. API Yanıt Süresi Sonuçları

API gecikme ölçümü ASP.NET Core test-server üzerinden HTTP çağrılarıyla gerçekleştirilmiştir. Ölçüm; routing, controller çalışması ve JSON serileştirme maliyetlerini içerir; mobil ağ, internet ve harici servis gecikmelerini içermez. Her endpoint için 30 tekrar yapılmış ve hata sayısı tüm endpointlerde 0 olarak gerçekleşmiştir.

| Endpoint | Tekrar | Ortalama | Medyan | P95 | Hata |
|---|---:|---:|---:|---:|---:|
| GET /api/dev/benchmark/acquisition | 30 | 449,2229 ms | 393,3030 ms | 845,8628 ms | 0 |
| GET /api/dev/benchmark/hybrid-recipe | 30 | 2,0533 ms | 1,9200 ms | 4,0771 ms | 0 |
| GET /api/dev/benchmark/normalization | 30 | 36,8452 ms | 35,1423 ms | 48,9174 ms | 0 |
| GET /api/dev/benchmark/recommendation | 30 | 1,9010 ms | 1,7965 ms | 2,7283 ms | 0 |

Bu sonuçlarda en yüksek gecikme acquisition benchmark endpointinde görülmüştür. Bunun nedeni ilgili akışın multimodal edinim senaryolarını ve daha ağır benchmark hesaplamasını içermesidir. Recommendation ve hybrid-recipe endpointleri düşük gecikme değerleriyle çalışmıştır.

### 3.x. OpenAI Fallback Değerlendirmesi

Bu çalışma ortamında OpenAI API anahtarı yapılandırılmadığı için OpenAI fallback senaryoları çalıştırılmamıştır. Bu nedenle OpenAI başarı oranı, token kullanımı veya maliyet bilgisi raporlanmamıştır. Tezde kullanılan normalizasyon, tarif öneri, premium guard ve API latency sayıları deterministik kod ve test-server üzerinden gerçek çalıştırmalarla üretilmiştir. OpenAI bileşeni bu sistemde nihai karar verici değil, yalnızca canonical/alias/fuzzy katmanlarının yetersiz kaldığı belirsiz durumlarda devreye girmesi planlanan kontrollü yardımcı katman olarak konumlandırılmıştır.
