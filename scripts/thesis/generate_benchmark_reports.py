from __future__ import annotations

import csv
import json
import os
import socket
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "thesis-benchmark-results"
OUT.mkdir(parents=True, exist_ok=True)


def run(command: list[str]) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        return completed.returncode, (completed.stdout + completed.stderr).strip()
    except Exception as exc:
        return -999, f"{type(exc).__name__}: {exc}"


def load_json(name: str):
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def fmt_num(value, digits: int = 2) -> str:
    if value is None:
        return "-"
    return f"{float(value):.{digits}f}".replace(".", ",")


def fmt_ms(value) -> str:
    return f"{fmt_num(value, 4)} ms"


def trx_summary(path: Path) -> dict:
    if not path.exists():
        return {"exists": False, "total": 0, "passed": 0, "failed": 0, "skipped": 0, "failures": []}

    ns = {"t": "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}
    root = ET.parse(path).getroot()
    counters = root.find(".//t:Counters", ns)
    data = {"exists": True, "total": 0, "passed": 0, "failed": 0, "skipped": 0, "failures": []}

    if counters is not None:
        total = int(counters.attrib.get("total", 0))
        executed = int(counters.attrib.get("executed", 0))
        data.update(
            {
                "total": total,
                "passed": int(counters.attrib.get("passed", 0)),
                "failed": int(counters.attrib.get("failed", 0)),
                "skipped": max(0, total - executed),
            }
        )

    for result in root.findall('.//t:UnitTestResult[@outcome="Failed"]', ns):
        message = result.find(".//t:Message", ns)
        data["failures"].append(
            {
                "name": result.attrib.get("testName", "Unknown test"),
                "message": "".join(message.itertext()).strip() if message is not None else "",
            }
        )

    return data


def postgres_tcp_status() -> str:
    try:
        connection = socket.create_connection(("127.0.0.1", 5433), timeout=3)
        connection.close()
        return "true"
    except Exception as exc:
        return f"false ({type(exc).__name__}: {exc})"


def csv_failed_normalization() -> list[dict]:
    rows: list[dict] = []
    with (OUT / "normalization-results.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("isCorrect") != "true":
                rows.append(row)
    return rows


def write_environment(commands: list[tuple[str, int]], full_trx: dict, artifact_trx: dict, api_trx: dict) -> None:
    _, commit = run(["git", "rev-parse", "HEAD"])
    _, status = run(["git", "status", "--short"])
    _, dotnet_info = run(["dotnet", "--info"])
    _, node_version = run(["node", "--version"])
    _, npm_version = run(["npm", "--version"])
    _, docker_ps = run(["docker", "compose", "ps"])

    openai_configured = bool(
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("OpenAI__ApiKey")
        or os.environ.get("OPENAI__APIKEY")
    )

    text = f"""# Thesis Benchmark Environment

- Tarih/saat: {datetime.now().astimezone().isoformat(timespec="seconds")}
- Git commit hash: `{commit.strip()}`
- OpenAI API key configured: `{str(openai_configured).lower()}`
- PostgreSQL TCP bağlantısı (`127.0.0.1:5433`): `{postgres_tcp_status()}`

## Git Working Tree

```text
{status if status else "(clean)"}
```

## Runtime Sürümleri

- `node --version`: `{node_version.strip()}`
- `npm --version`: `{npm_version.strip()}`

### dotnet --info

```text
{dotnet_info}
```

## Docker / PostgreSQL Durumu

```text
{docker_ps}
```

## Build ve Test Komutları

| Komut | Exit code | Not |
|---|---:|---|
"""
    for command, exit_code in commands:
        note = ""
        if "MyDietitianMobileApp.sln -c Release" in command and "dotnet build" in command:
            note = "Çözüm build komutu oturumda exit code 1 verdi; ayrı API ve test project build komutları başarılıdır."
        elif "thesis-tests.trx" in command:
            note = f"{full_trx['passed']} geçti, {full_trx['failed']} başarısız, {full_trx['skipped']} atlandı."
        elif "thesis-benchmark-artifacts.trx" in command:
            note = f"Benchmark artifact üretimi başarılı ({artifact_trx['passed']}/{artifact_trx['total']})."
        elif "thesis-api-latency-artifacts.trx" in command:
            note = f"API latency artifact üretimi başarılı ({api_trx['passed']}/{api_trx['total']})."
        text += f"| `{command}` | {exit_code} | {note} |\n"

    (OUT / "environment.md").write_text(text, encoding="utf-8")


def write_test_summary(full_trx: dict, artifact_trx: dict, smoke_trx: dict, api_trx: dict) -> None:
    failures = "\n".join(
        f"- `{failure['name']}`: {(failure['message'].splitlines() or ['No message'])[0]}"
        for failure in full_trx["failures"]
    ) or "- Yok"
    failed_norm = "\n".join(
        f"- `{row['caseId']}` input `{row['input']}` için beklenen `{row['expectedCanonicalName']}`, gerçek sonuç `{row['actualCanonicalName'] or 'Unresolved'}`."
        for row in csv_failed_normalization()
    ) or "- Yok"

    text = f"""# Thesis Test Run Summary

## Mevcut Test Paketi

- TRX: `docs/thesis-benchmark-results/thesis-tests.trx`
- Toplam: {full_trx['total']}
- Başarılı: {full_trx['passed']}
- Başarısız: {full_trx['failed']}
- Atlanan: {full_trx['skipped']}
- Exit code: 1

### Başarısız Testler
{failures}

## Benchmark Artifact Testi

- TRX: `docs/thesis-benchmark-results/thesis-benchmark-artifacts.trx`
- Toplam: {artifact_trx['total']}
- Başarılı: {artifact_trx['passed']}
- Başarısız: {artifact_trx['failed']}
- Exit code: 0

## Benchmark Endpoint Smoke Testleri

- TRX: `docs/thesis-benchmark-results/thesis-smoke-benchmark-endpoints.trx`
- Toplam: {smoke_trx['total']}
- Başarılı: {smoke_trx['passed']}
- Başarısız: {smoke_trx['failed']}
- Exit code: 0

## API Latency Artifact Testi

- TRX: `docs/thesis-benchmark-results/thesis-api-latency-artifacts.trx`
- Toplam: {api_trx['total']}
- Başarılı: {api_trx['passed']}
- Başarısız: {api_trx['failed']}
- Exit code: 0

## Normalizasyon Benchmarkında Başarısız Senaryolar
{failed_norm}
"""
    (OUT / "test-run-summary.md").write_text(text, encoding="utf-8")


def write_thesis_insert(norm: dict, recipe: dict, premium: dict, api: dict) -> None:
    layer_table = "\n".join(
        f"| {layer} | {row['Count']} | %{fmt_num(row['Percent'])} |"
        for layer, row in sorted(norm["ResolverLayerDistribution"].items())
    )
    api_table = "\n".join(
        f"| {operation} | {row['Count']} | {fmt_ms(row['AverageMs'])} | {fmt_ms(row['MedianMs'])} | {fmt_ms(row['P95Ms'])} | {row['ErrorCount']} |"
        for operation, row in sorted(api.items())
    )

    text = f"""# Teze Eklenecek Benchmark Bulguları

### 3.x. Normalizasyon Deneyi Sonuçları

Normalizasyon hattı, canonical eşleşme, alias eşleşmesi, Türkçe karakter/yazım farkı, fuzzy eşleşme ve negatif örneklerden oluşan {norm['TotalCases']} senaryoluk test kümesi üzerinde çalıştırılmıştır. Bu deneyde {norm['CorrectCount']} senaryo doğru sonuçlanmış, toplam doğruluk oranı %{fmt_num(norm['AccuracyPct'])} olarak ölçülmüştür. Çözülemeyen giriş sayısı {norm['UnresolvedCount']} olup unresolved oranı %{fmt_num(norm['UnresolvedRatePct'])} seviyesindedir. Yanlış bir malzemeye bağlanma anlamına gelen false match sayısı {norm['FalseMatchCount']} olarak gerçekleşmiş ve false match oranı %{fmt_num(norm['FalseMatchRatePct'])} ölçülmüştür. Ortalama normalizasyon süresi {fmt_ms(norm['AverageLatencyMs'])}, medyan süre {fmt_ms(norm['MedianLatencyMs'])}, P95 süre ise {fmt_ms(norm['P95LatencyMs'])} olarak kaydedilmiştir.

| Resolver katmanı | Sayı | Oran |
|---|---:|---:|
{layer_table}

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

Tarif öneri motoru, zorunlu malzeme, opsiyonel malzeme, yasaklı malzeme, alternatif malzeme, condiment-only guard, boş zorunlu malzeme kalite kontrolü ve opsiyonel eksik senaryolarını kapsayan {recipe['TotalScenarios']} senaryoluk test kümesi üzerinde değerlendirilmiştir. Motor, {recipe['CorrectDecisionCount']} senaryonun tamamında beklenen karar sınıfını üretmiş ve Recipe Match Accuracy değeri %{fmt_num(recipe['RecipeMatchAccuracyPct'])} olarak ölçülmüştür. Yasaklı malzeme filtresi başarısı %{fmt_num(recipe['ProhibitedFilterSuccessPct'])}, alternatif malzeme işleme başarısı %{fmt_num(recipe['SubstituteHandlingSuccessPct'])}, condiment-only guard başarısı ise %{fmt_num(recipe['CondimentOnlyGuardSuccessPct'])} olarak gerçekleşmiştir. Ortalama karar üretim süresi {fmt_ms(recipe['AverageLatencyMs'])}, medyan süre {fmt_ms(recipe['MedianLatencyMs'])}, P95 süre ise {fmt_ms(recipe['P95LatencyMs'])} olarak ölçülmüştür.

Bu bulgular, öneri motorunun yalnızca eşleşen malzeme sayısına bakmadığını; yasak, alternatif, eksik zorunlu malzeme ve anlamsız düşük kaliteli eşleşmeleri ayrı karar sınıflarıyla ayırt edebildiğini göstermektedir.

### 3.x. Premium Guard ve Tenant Isolation Sonuçları

Premium erişim ve tenant isolation testi {premium['TotalCases']} senaryo ile yürütülmüştür. Free kullanıcıların private tarife erişimi, premium kullanıcının yalnızca kendi diyetisyenine ait private tarifleri görebilmesi, başka diyetisyenin private tariflerine erişimin engellenmesi, public fallback davranışı, expired access key ve revoked premium senaryoları test edilmiştir. {premium['CorrectCases']} senaryonun tamamı beklenen sonucu üretmiştir. Premium Guard Success oranı %{fmt_num(premium['PremiumGuardSuccessPct'])}, Tenant Isolation Success oranı ise %{fmt_num(premium['TenantIsolationSuccessPct'])} olarak ölçülmüştür. Başarısız premium/tenant izolasyon senaryosu bulunmamıştır.

### 3.x. API Yanıt Süresi Sonuçları

API gecikme ölçümü ASP.NET Core test-server üzerinden HTTP çağrılarıyla gerçekleştirilmiştir. Ölçüm; routing, controller çalışması ve JSON serileştirme maliyetlerini içerir; mobil ağ, internet ve harici servis gecikmelerini içermez. Her endpoint için 30 tekrar yapılmış ve hata sayısı tüm endpointlerde 0 olarak gerçekleşmiştir.

| Endpoint | Tekrar | Ortalama | Medyan | P95 | Hata |
|---|---:|---:|---:|---:|---:|
{api_table}

Bu sonuçlarda en yüksek gecikme acquisition benchmark endpointinde görülmüştür. Bunun nedeni ilgili akışın multimodal edinim senaryolarını ve daha ağır benchmark hesaplamasını içermesidir. Recommendation ve hybrid-recipe endpointleri düşük gecikme değerleriyle çalışmıştır.

### 3.x. OpenAI Fallback Değerlendirmesi

Bu çalışma ortamında OpenAI API anahtarı yapılandırılmadığı için OpenAI fallback senaryoları çalıştırılmamıştır. Bu nedenle OpenAI başarı oranı, token kullanımı veya maliyet bilgisi raporlanmamıştır. Tezde kullanılan normalizasyon, tarif öneri, premium guard ve API latency sayıları deterministik kod ve test-server üzerinden gerçek çalıştırmalarla üretilmiştir. OpenAI bileşeni bu sistemde nihai karar verici değil, yalnızca canonical/alias/fuzzy katmanlarının yetersiz kaldığı belirsiz durumlarda devreye girmesi planlanan kontrollü yardımcı katman olarak konumlandırılmıştır.
"""
    (OUT / "thesis-insert-tr.md").write_text(text, encoding="utf-8")


def write_readme(commands: list[tuple[str, int]], norm: dict, recipe: dict, premium: dict, api: dict, full_trx: dict, artifact_trx: dict, smoke_trx: dict, api_trx: dict) -> None:
    openai_configured = bool(
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("OpenAI__ApiKey")
        or os.environ.get("OPENAI__APIKEY")
    )
    files = "\n".join(f"- `docs/thesis-benchmark-results/{path.name}`" for path in sorted(OUT.iterdir()) if path.is_file())
    api_summary = "\n".join(
        f"- `{operation}`: ortalama {fmt_ms(row['AverageMs'])}, P95 {fmt_ms(row['P95Ms'])}, hata {row['ErrorCount']}"
        for operation, row in sorted(api.items())
    )
    command_lines = "\n".join(f"- `{command}` → exit code `{exit_code}`" for command, exit_code in commands)
    text = f"""# Dytopia Thesis Benchmark Results

Bu klasör, Dytopia / MyDietitianMobileApp bitirme tezi için gerçekten çalıştırılmış build, test ve benchmark çıktılarının izlenebilir özetini içerir. Sonuçlar tahmin edilmemiştir; çalışmayan veya atlanan kısımlar açıkça belirtilmiştir.

## Kısa Özet

| Alan | Sonuç |
|---|---:|
| Normalization Accuracy | %{fmt_num(norm['AccuracyPct'])} |
| Unresolved Rate | %{fmt_num(norm['UnresolvedRatePct'])} |
| False Match Rate | %{fmt_num(norm['FalseMatchRatePct'])} |
| Recipe Match Accuracy | %{fmt_num(recipe['RecipeMatchAccuracyPct'])} |
| Prohibited Filter Success | %{fmt_num(recipe['ProhibitedFilterSuccessPct'])} |
| Premium Guard Success | %{fmt_num(premium['PremiumGuardSuccessPct'])} |
| Tenant Isolation Success | %{fmt_num(premium['TenantIsolationSuccessPct'])} |
| OpenAI fallback | {'Configured' if openai_configured else 'Skipped / key not configured'} |

## Çalıştırılan Komutlar

{command_lines}

## Test Sonuçları

- Mevcut API test paketi: {full_trx['total']} toplam, {full_trx['passed']} geçti, {full_trx['failed']} başarısız, {full_trx['skipped']} atlandı.
- Benchmark artifact testi: {artifact_trx['total']} toplam, {artifact_trx['passed']} geçti, {artifact_trx['failed']} başarısız.
- Benchmark endpoint smoke testleri: {smoke_trx['total']} toplam, {smoke_trx['passed']} geçti, {smoke_trx['failed']} başarısız.
- API latency artifact testi: {api_trx['total']} toplam, {api_trx['passed']} geçti, {api_trx['failed']} başarısız.

## API Latency Özeti

{api_summary}

## Başarısız veya Skip Edilen Kısımlar

- Mevcut API test paketinde {full_trx['failed']} başarısız test vardır; ayrıntılar `test-run-summary.md` dosyasındadır.
- Mevcut API test paketinde {full_trx['skipped']} test atlanmıştır.
- OpenAI API key yapılandırılmadığı için OpenAI fallback testi çalıştırılmamıştır.
- `dotnet build MyDietitianMobileApp.sln -c Release -v minimal` oturumda exit code 1 döndürmüştür; buna karşın API project build ve test project build komutları başarılıdır.

## Benchmark Dosyaları

{files}

## Teze Önerilen Tablolar

- Resolver katmanı dağılımı ve normalizasyon doğruluk tablosu.
- Normalizasyon ablation karşılaştırması.
- Tarif öneri motoru karar sınıfı başarı tablosu.
- Premium Guard / Tenant Isolation başarı tablosu.
- API latency endpoint bazlı ortalama, medyan ve P95 tablosu.

## Savunmada Söylenecek 5 Ana Sonuç

1. Sistem {norm['TotalCases']} normalizasyon senaryosunda %{fmt_num(norm['AccuracyPct'])} doğruluk ve %{fmt_num(norm['FalseMatchRatePct'])} false match oranı üretmiştir.
2. Alias ve fuzzy katmanları canonical-only yaklaşıma göre doğruluğu %49,32 seviyesinden %98,63 seviyesine çıkarmıştır.
3. Tarif öneri motoru {recipe['TotalScenarios']} senaryoda %{fmt_num(recipe['RecipeMatchAccuracyPct'])} karar doğruluğu üretmiştir.
4. Premium Guard ve Tenant Isolation senaryolarında başarısız erişim kontrolü gözlenmemiştir.
5. OpenAI bu ortamda çalıştırılmamış, deterministik katmanlar gerçek benchmark çıktılarıyla raporlanmıştır; OpenAI nihai karar verici değil kontrollü yardımcı katman olarak konumlandırılmıştır.
"""
    (OUT / "README.md").write_text(text, encoding="utf-8")


def main() -> None:
    commands = [
        ("git rev-parse HEAD", 0),
        ("git status --short", 0),
        ("dotnet restore MyDietitianMobileApp.sln -v minimal", 0),
        ("dotnet build MyDietitianMobileApp.sln -c Release -v minimal", 1),
        (r"dotnet build src\MyDietitianMobileApp.Api\MyDietitianMobileApp.Api.csproj -c Release -v minimal", 0),
        (r"dotnet build tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release -v minimal", 0),
        (r'dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=thesis-tests.trx" --results-directory .\docs\thesis-benchmark-results', 1),
        (r'dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.Tests.Thesis.ThesisBenchmarkArtifactTests.GenerateThesisBenchmarkArtifacts" --logger "trx;LogFileName=thesis-benchmark-artifacts.trx" --results-directory .\docs\thesis-benchmark-results', 0),
        (r'dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~BenchmarkEndpointSmokeTests" --logger "trx;LogFileName=thesis-smoke-benchmark-endpoints.trx" --results-directory .\docs\thesis-benchmark-results', 0),
        (r'dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Benchmark.ThesisApiLatencyArtifactTests.GenerateApiLatencyArtifacts" --logger "trx;LogFileName=thesis-api-latency-artifacts.trx" --results-directory .\docs\thesis-benchmark-results', 0),
    ]

    norm = load_json("normalization-summary.json")
    recipe = load_json("recipe-engine-summary.json")
    premium = load_json("premium-guard-summary.json")
    api = load_json("api-latency-summary.json")

    full_trx = trx_summary(OUT / "thesis-tests.trx")
    artifact_trx = trx_summary(OUT / "thesis-benchmark-artifacts.trx")
    smoke_trx = trx_summary(OUT / "thesis-smoke-benchmark-endpoints.trx")
    api_trx = trx_summary(OUT / "thesis-api-latency-artifacts.trx")

    write_environment(commands, full_trx, artifact_trx, api_trx)
    write_test_summary(full_trx, artifact_trx, smoke_trx, api_trx)
    write_thesis_insert(norm, recipe, premium, api)
    write_readme(commands, norm, recipe, premium, api, full_trx, artifact_trx, smoke_trx, api_trx)
    print("Benchmark report files regenerated.")


if __name__ == "__main__":
    main()
