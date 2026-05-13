# Dytopia Thesis Benchmark Results

Bu klasör, Dytopia / MyDietitianMobileApp bitirme tezi için gerçekten çalıştırılmış build, test ve benchmark çıktılarının izlenebilir özetini içerir. Sonuçlar tahmin edilmemiştir; çalışmayan veya atlanan kısımlar açıkça belirtilmiştir.

## Kısa Özet

| Alan | Sonuç |
|---|---:|
| Normalization Accuracy | %98,63 |
| Unresolved Rate | %15,07 |
| False Match Rate | %0,00 |
| Recipe Match Accuracy | %100,00 |
| Prohibited Filter Success | %100,00 |
| Premium Guard Success | %100,00 |
| Tenant Isolation Success | %100,00 |
| OpenAI fallback | Skipped / key not configured |

## Çalıştırılan Komutlar

- `git rev-parse HEAD` → exit code `0`
- `git status --short` → exit code `0`
- `dotnet restore MyDietitianMobileApp.sln -v minimal` → exit code `0`
- `dotnet build MyDietitianMobileApp.sln -c Release -v minimal` → exit code `1`
- `dotnet build src\MyDietitianMobileApp.Api\MyDietitianMobileApp.Api.csproj -c Release -v minimal` → exit code `0`
- `dotnet build tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release -v minimal` → exit code `0`
- `dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=thesis-tests.trx" --results-directory .\docs\thesis-benchmark-results` → exit code `1`
- `dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.Tests.Thesis.ThesisBenchmarkArtifactTests.GenerateThesisBenchmarkArtifacts" --logger "trx;LogFileName=thesis-benchmark-artifacts.trx" --results-directory .\docs\thesis-benchmark-results` → exit code `0`
- `dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~BenchmarkEndpointSmokeTests" --logger "trx;LogFileName=thesis-smoke-benchmark-endpoints.trx" --results-directory .\docs\thesis-benchmark-results` → exit code `0`
- `dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Benchmark.ThesisApiLatencyArtifactTests.GenerateApiLatencyArtifacts" --logger "trx;LogFileName=thesis-api-latency-artifacts.trx" --results-directory .\docs\thesis-benchmark-results` → exit code `0`

## Test Sonuçları

- Mevcut API test paketi: 209 toplam, 200 geçti, 2 başarısız, 7 atlandı.
- Benchmark artifact testi: 1 toplam, 1 geçti, 0 başarısız.
- Benchmark endpoint smoke testleri: 4 toplam, 4 geçti, 0 başarısız.
- API latency artifact testi: 1 toplam, 1 geçti, 0 başarısız.

## API Latency Özeti

- `GET /api/dev/benchmark/acquisition`: ortalama 449,2229 ms, P95 845,8628 ms, hata 0
- `GET /api/dev/benchmark/hybrid-recipe`: ortalama 2,0533 ms, P95 4,0771 ms, hata 0
- `GET /api/dev/benchmark/normalization`: ortalama 36,8452 ms, P95 48,9174 ms, hata 0
- `GET /api/dev/benchmark/recommendation`: ortalama 1,9010 ms, P95 2,7283 ms, hata 0

## Başarısız veya Skip Edilen Kısımlar

- Mevcut API test paketinde 2 başarısız test vardır; ayrıntılar `test-run-summary.md` dosyasındadır.
- Mevcut API test paketinde 7 test atlanmıştır.
- OpenAI API key yapılandırılmadığı için OpenAI fallback testi çalıştırılmamıştır.
- `dotnet build MyDietitianMobileApp.sln -c Release -v minimal` oturumda exit code 1 döndürmüştür; buna karşın API project build ve test project build komutları başarılıdır.

## Benchmark Dosyaları

- `docs/thesis-benchmark-results/api-latency-results.csv`
- `docs/thesis-benchmark-results/api-latency-summary.json`
- `docs/thesis-benchmark-results/api-latency-summary.md`
- `docs/thesis-benchmark-results/environment.md`
- `docs/thesis-benchmark-results/normalization-ablation.csv`
- `docs/thesis-benchmark-results/normalization-ablation.md`
- `docs/thesis-benchmark-results/normalization-cases.json`
- `docs/thesis-benchmark-results/normalization-results.csv`
- `docs/thesis-benchmark-results/normalization-summary.json`
- `docs/thesis-benchmark-results/normalization-summary.md`
- `docs/thesis-benchmark-results/openai-fallback-summary.json`
- `docs/thesis-benchmark-results/openai-fallback-summary.md`
- `docs/thesis-benchmark-results/operation-latency-results.csv`
- `docs/thesis-benchmark-results/operation-latency-summary.json`
- `docs/thesis-benchmark-results/operation-latency-summary.md`
- `docs/thesis-benchmark-results/premium-guard-results.csv`
- `docs/thesis-benchmark-results/premium-guard-summary.json`
- `docs/thesis-benchmark-results/premium-guard-summary.md`
- `docs/thesis-benchmark-results/README.md`
- `docs/thesis-benchmark-results/recipe-engine-cases.json`
- `docs/thesis-benchmark-results/recipe-engine-results.csv`
- `docs/thesis-benchmark-results/recipe-engine-summary.json`
- `docs/thesis-benchmark-results/recipe-engine-summary.md`
- `docs/thesis-benchmark-results/test-run-summary.md`
- `docs/thesis-benchmark-results/thesis-api-latency-artifacts.trx`
- `docs/thesis-benchmark-results/thesis-benchmark-artifacts.trx`
- `docs/thesis-benchmark-results/thesis-insert-tr.md`
- `docs/thesis-benchmark-results/thesis-smoke-benchmark-endpoints.trx`
- `docs/thesis-benchmark-results/thesis-tests.trx`

## Teze Önerilen Tablolar

- Resolver katmanı dağılımı ve normalizasyon doğruluk tablosu.
- Normalizasyon ablation karşılaştırması.
- Tarif öneri motoru karar sınıfı başarı tablosu.
- Premium Guard / Tenant Isolation başarı tablosu.
- API latency endpoint bazlı ortalama, medyan ve P95 tablosu.

## Savunmada Söylenecek 5 Ana Sonuç

1. Sistem 73 normalizasyon senaryosunda %98,63 doğruluk ve %0,00 false match oranı üretmiştir.
2. Alias ve fuzzy katmanları canonical-only yaklaşıma göre doğruluğu %49,32 seviyesinden %98,63 seviyesine çıkarmıştır.
3. Tarif öneri motoru 36 senaryoda %100,00 karar doğruluğu üretmiştir.
4. Premium Guard ve Tenant Isolation senaryolarında başarısız erişim kontrolü gözlenmemiştir.
5. OpenAI bu ortamda çalıştırılmamış, deterministik katmanlar gerçek benchmark çıktılarıyla raporlanmıştır; OpenAI nihai karar verici değil kontrollü yardımcı katman olarak konumlandırılmıştır.
