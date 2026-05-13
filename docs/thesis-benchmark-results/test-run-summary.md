# Thesis Test Run Summary

## Mevcut Test Paketi

- TRX: `docs/thesis-benchmark-results/thesis-tests.trx`
- Toplam: 209
- Başarılı: 200
- Başarısız: 2
- Atlanan: 7
- Exit code: 1

### Başarısız Testler
- `MyDietitianMobileApp.Api.Tests.Infrastructure.BarcodeIngredientResolutionServiceTests.ResolveAsync_WhenDeryaTunaBarcodeWasUnresolved_ShouldReturnTonBaligiAndRepairCache`: Expected result.ProductName to be "Derya Ton Balığı", but found <null>.
- `MyDietitianMobileApp.Api.Tests.Benchmarks.BenchmarkRunnerTests.RunMultimodalAcquisitionBenchmark_WithInMemoryDataset_ProducesPerSourceMetrics`: Expected result.Summary.Top1CorrectCount to be greater than or equal to 3, but found 2.

## Benchmark Artifact Testi

- TRX: `docs/thesis-benchmark-results/thesis-benchmark-artifacts.trx`
- Toplam: 1
- Başarılı: 1
- Başarısız: 0
- Exit code: 0

## Benchmark Endpoint Smoke Testleri

- TRX: `docs/thesis-benchmark-results/thesis-smoke-benchmark-endpoints.trx`
- Toplam: 4
- Başarılı: 4
- Başarısız: 0
- Exit code: 0

## API Latency Artifact Testi

- TRX: `docs/thesis-benchmark-results/thesis-api-latency-artifacts.trx`
- Toplam: 1
- Başarılı: 1
- Başarısız: 0
- Exit code: 0

## Normalizasyon Benchmarkında Başarısız Senaryolar
- `N059` input `pirinc pilav` için beklenen `Pirinç`, gerçek sonuç `Unresolved`.
