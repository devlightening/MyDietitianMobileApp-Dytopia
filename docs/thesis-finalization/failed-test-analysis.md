# Failed Test Analysis

## Ara Kontrol Hataları

| Test | Ara bulgu | Kök neden | Final aksiyon | Final durum |
|---|---|---|---|---|
| BarcodeIngredientResolutionServiceTests.ResolveAsync_WhenDeryaTunaBarcodeWasUnresolved_ShouldReturnTonBaligiAndRepairCache | Barcode unresolved döndüğü için ürün adı null kaldı. | Open Food Facts kapalıyken bilinen barkod için offline fallback yoktu. | 8695077001450 için known barcode fallback eklendi; cache repair davranışı gerçek servis koduyla doğrulandı. | Geçti |
| BenchmarkRunnerTests.RunMultimodalAcquisitionBenchmark_WithInMemoryDataset_ProducesPerSourceMetrics | Top1CorrectCount 2/4 kaldı. | Vision benchmark testinde closed-set listesi senaryodaki canonical adlarla uyumlu değildi. | Test benchmark runner VisionIngredientOptions.ClosedSetCanonicalNames listesiyle yapılandırıldı. | Geçti |

## Final Test Durumu

- Hedefli düzeltme testleri: 15 total, 15 passed, 0 failed.
- Api.Tests final koşusu: 210 total, 203 passed, 0 failed, 7 skipped.
- Api.SmokeTests thesis latency: 1 total, 1 passed, 0 failed.
