# MyDietitian LLM Fallback Konumlandirmasi

## Kisa ozet

Bu projede LLM, ingredient normalization icin ana karar verici degildir.
Sistem once deterministic katmanlari calistirir:

1. Canonical
2. Alias
3. Fuzzy
4. LLM fallback

LLM sadece ilk uc katman guvenli bir eslesme uretemediginde devreye girer.

## Neden bu sekilde konumlandirildi?

- Tezin ana katkisi LLM yapmak degil, cok katmanli standardizasyon sistemi kurmaktir.
- Deterministic katmanlar guvenli, aciklanabilir ve benchmark dostudur.
- LLM yalniz zor orneklerde semantik yardim saglar.
- Bu sayede sistem tamamen LLM'e bagimli hale gelmez.

## Guvenlik kurallari

- LLM'e tum veritabani gonderilmez.
- Sadece bounded shortlist gonderilir.
- Cevap JSON olmak zorundadir:
  - `choice`
  - `confidence`
  - `reason`
- `temperature = 0.0` kullanilir.
- Shortlist disi bir ID donerse cevap reddedilir.
- Dusuk confidence ise sonuc `ambiguous` veya `none` olarak ele alinir.
- Exception olursa normalizasyon kirilmaz; sistem deterministic akisa geri doner.

## Saglayici stratejisi

V1 destekleri:

- `openai`
- `ollama`
- `none`

Tum saglayicilar `IIngredientLlmClient` abstraction'i arkasinda calisir.
Bu sayede normalization pipeline degismeden provider degistirilebilir.

## Konfigurasyon

`appsettings.json`:

```json
"IngredientLlm": {
  "Enabled": false,
  "Provider": "openai",
  "BaseUrl": null,
  "ModelName": "gpt-4o-mini",
  "ApiKeyEnvVar": "OPENAI_API_KEY",
  "MaxCandidates": 12,
  "MinFuzzyScoreForShortlist": 0.55,
  "MaxInputLength": 120,
  "MinConfidenceToAccept": 0.75,
  "MinConfidenceForAmbiguous": 0.50
}
```

### OpenAI ile calistirmak

- `Enabled = true`
- `Provider = "openai"`
- environment variable olarak `OPENAI_API_KEY` ver

### Ollama ile calistirmak

- `Enabled = true`
- `Provider = "ollama"`
- gerekirse `BaseUrl = "http://localhost:11434"`
- varsayilan olarak API key gerekmez

## Benchmark ve tez kullanimi

Tezde su karsilastirmalar verilmelidir:

- Exact only
- Exact + Alias
- Exact + Alias + Fuzzy
- Exact + Alias + Fuzzy + LLM

Yeni benchmark endpoint'i:

- `GET /api/dev/benchmark/normalization`
- `GET /api/dev/benchmark/normalization/llm-compare`

`llm-compare` sonucu su farklari gostermek icin kullanilir:

- accuracy delta
- unmatched delta
- ambiguous delta
- llm match sayisi
- llm correct sayisi
- average latency delta

## Akademik pozisyon

Tezde kullanilacak dogru ifade:

> LLM katmani, deterministic standardizasyon katmanlarinin basarisiz oldugu sinirli senaryolarda,
> bounded candidate shortlist uzerinden semantik eslestirme yapan opsiyonel fallback katmanidir.

Yanlis pozisyon:

- "Bu tezde kendi LLM modelimiz gelistirilmistir."
- "Sistem tamamen LLM tabanlidir."

Dogru pozisyon:

- "Tezin omurgasi deterministic normalization pipeline'dir."
- "LLM, yalniz zor orneklerde kontrollu yardimci katman olarak kullanilmistir."
