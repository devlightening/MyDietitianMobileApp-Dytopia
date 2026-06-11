# Normalization Ablation

| Mode | Accuracy | Coverage | Unresolved | False Match | Avg Latency | Notes |
|---|---:|---:|---:|---:|---:|---|
| Canonical only | 49,32% | 35,62% | 64,38% | 0,00% | 0,0264 ms |  |
| Canonical + Alias | 80,82% | 67,12% | 32,88% | 0,00% | 0,0616 ms |  |
| Canonical + Alias + Fuzzy | 98,63% | 84,93% | 15,07% | 0,00% | 0,4749 ms |  |
| Full pipeline | 98,63% | 84,93% | 15,07% | 0,00% | 3,9154 ms |  |
| Full pipeline + LLM fallback | - | - | - | - | - | skipped: OpenAI key not configured |
