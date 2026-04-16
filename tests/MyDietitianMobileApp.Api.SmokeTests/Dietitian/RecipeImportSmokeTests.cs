using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Dietitian;

/// <summary>
/// Integration-proof recipe import smoke tests.
///
/// Verifies the upload -> parse -> session -> preview pipeline works against
/// a fresh seeded database, including the richer sample files used in manual QA.
/// </summary>
public class RecipeImportSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public RecipeImportSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> LoginDietitianAsync(HttpClient http)
    {
        var resp = await http.PostAsJsonAsync("/api/auth/dietitian/login", new
        {
            email = "dietitian1@smoke.local",
            password = "SmokeTest1!"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("token").GetString()!;
    }

    private static string GetSampleFilePath(string fileName)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            var candidate = Path.Combine(current.FullName, "docs", "import-samples", fileName);
            if (File.Exists(candidate))
                return candidate;

            current = current.Parent;
        }

        throw new FileNotFoundException($"Örnek import dosyası bulunamadı: {fileName}");
    }

    private static ByteArrayContent BuildSampleFileContent(string fileName, string mediaType)
    {
        var content = new ByteArrayContent(File.ReadAllBytes(GetSampleFilePath(fileName)));
        content.Headers.ContentType = new(mediaType);
        return content;
    }

    [Fact]
    public async Task Upload_ValidCsv_Returns_SessionId_And_Preview_Shows_Recipes()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        const string csv =
            "Tarif Adı,Malzeme,Miktar,Birim,Rol\r\n" +
            "Smoke Import Tarifi,Domates,2,adet,zorunlu\r\n" +
            "Smoke Import Tarifi,Soğan,1,adet,zorunlu\r\n";

        var csvBytes = Encoding.UTF8.GetBytes(csv);
        using var content = new MultipartFormDataContent();
        content.Add(
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } },
            "file",
            "smoke-import.csv");

        var uploadResp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        uploadResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "geçerli bir CSV yüklemesi sessionId döndürmeli");

        var uploadJson = await uploadResp.Content.ReadFromJsonAsync<JsonElement>();
        uploadJson.TryGetProperty("sessionId", out var sessionIdProp).Should().BeTrue();
        var sessionId = sessionIdProp.GetGuid();
        sessionId.Should().NotBeEmpty();

        var previewResp = await http.GetAsync($"/api/dietitian/recipes/imports/{sessionId}");
        previewResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var previewJson = await previewResp.Content.ReadFromJsonAsync<JsonElement>();
        previewJson.TryGetProperty("recipes", out var recipes).Should().BeTrue();
        recipes.GetArrayLength().Should().BeGreaterThan(0);

        var firstRecipe = recipes[0];
        firstRecipe.GetProperty("title").GetString()!
            .Should().ContainEquivalentOf("Smoke Import Tarifi");

        firstRecipe.TryGetProperty("ingredients", out var ingredients).Should().BeTrue();
        ingredients.GetArrayLength().Should().Be(2);

        previewJson.TryGetProperty("status", out var statusProp).Should().BeTrue();
        var status = statusProp.GetString()!;
        new[] { "NeedsReview", "ReadyToConfirm" }.Should().Contain(status);
    }

    [Fact]
    public async Task Upload_SampleCsv_WithMultilineSteps_Parses_Two_Recipes()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var content = new MultipartFormDataContent();
        content.Add(
            BuildSampleFileContent("01_tarif_import_baslik_kaymali.csv", "text/csv"),
            "file",
            "01_tarif_import_baslik_kaymali.csv");

        var uploadResp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        uploadResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadJson = await uploadResp.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = uploadJson.GetProperty("sessionId").GetGuid();

        var previewResp = await http.GetAsync($"/api/dietitian/recipes/imports/{sessionId}");
        previewResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var previewJson = await previewResp.Content.ReadFromJsonAsync<JsonElement>();
        var recipes = previewJson.GetProperty("recipes");
        recipes.GetArrayLength().Should().Be(2,
            because: "çok satırlı yapılış alanı sahte tarifler oluşturmamalı");

        recipes[0].GetProperty("title").GetString().Should().Be("Fırın Sebzeli Omlet");
        recipes[1].GetProperty("title").GetString().Should().Be("Laktossuz Muzlu Smoothie");
        recipes[0].GetProperty("steps").GetArrayLength().Should().BeGreaterThan(1);
    }

    [Fact]
    public async Task Upload_SampleDocx_Freeform_Does_Not_Create_Section_Headers_As_Recipes()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var content = new MultipartFormDataContent();
        content.Add(
            BuildSampleFileContent("03_tarif_import_serbest_belge.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "file",
            "03_tarif_import_serbest_belge.docx");

        var uploadResp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        uploadResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadJson = await uploadResp.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = uploadJson.GetProperty("sessionId").GetGuid();

        var previewResp = await http.GetAsync($"/api/dietitian/recipes/imports/{sessionId}");
        previewResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var previewJson = await previewResp.Content.ReadFromJsonAsync<JsonElement>();
        var recipes = previewJson.GetProperty("recipes");
        recipes.GetArrayLength().Should().Be(2,
            because: "serbest belge parser'ı bölüm başlıklarını tarif gibi almamalı");

        recipes.EnumerateArray()
            .Select(item => item.GetProperty("title").GetString())
            .Should()
            .NotContain(new[] { "Malzemeler:", "Hazırlanışı:", "Yapılışı:" });
    }

    [Fact]
    public async Task Upload_SamplePdf_WithSelectableText_Is_Parsed()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var content = new MultipartFormDataContent();
        content.Add(
            BuildSampleFileContent("04_tarif_import_metin_pdf.pdf", "application/pdf"),
            "file",
            "04_tarif_import_metin_pdf.pdf");

        var uploadResp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        uploadResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadJson = await uploadResp.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = uploadJson.GetProperty("sessionId").GetGuid();

        var previewResp = await http.GetAsync($"/api/dietitian/recipes/imports/{sessionId}");
        previewResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var previewJson = await previewResp.Content.ReadFromJsonAsync<JsonElement>();
        previewJson.GetProperty("documentKind").GetString().Should().Be("TextPdf");
        previewJson.GetProperty("recipes").GetArrayLength().Should().BeGreaterThan(0,
            because: "seçilebilir metin içeren PDF parse edilebilmeli");
    }

    [Fact]
    public async Task Upload_UnsupportedFileType_Returns_400()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var txtBytes = Encoding.UTF8.GetBytes("not a valid recipe file");
        using var content = new MultipartFormDataContent();
        content.Add(
            new ByteArrayContent(txtBytes) { Headers = { ContentType = new("text/plain") } },
            "file",
            "smoke-test.txt");

        var resp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            because: ".txt uzantısı bilinçli olarak desteklenmiyor");
    }

    [Fact]
    public async Task Preview_UnknownSessionId_Returns_404()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var unknownId = Guid.NewGuid();
        var resp = await http.GetAsync($"/api/dietitian/recipes/imports/{unknownId}");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Upload_Unauthenticated_Returns_401()
    {
        var http = _factory.CreateDefaultClient();

        var csvBytes = Encoding.UTF8.GetBytes("Tarif Adı,Malzeme\r\nTest,Domates\r\n");
        using var content = new MultipartFormDataContent();
        content.Add(
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } },
            "file",
            "test.csv");

        var resp = await http.PostAsync("/api/dietitian/recipes/imports", content);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
