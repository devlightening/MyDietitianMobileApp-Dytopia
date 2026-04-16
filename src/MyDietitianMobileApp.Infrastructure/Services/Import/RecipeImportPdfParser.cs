using System.Diagnostics;
using System.Text;
using System.Text.Json;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class RecipeImportPdfParser : IRecipeImportParser
{
    public bool CanHandle(string fileType) => string.Equals(fileType, "pdf", StringComparison.OrdinalIgnoreCase);

    public async Task<RecipeImportParseResult> ParseAsync(
        RecipeImportParserContext context,
        CancellationToken cancellationToken = default)
    {
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.pdf");
        await File.WriteAllBytesAsync(tempFilePath, context.FileBytes, cancellationToken);

        try
        {
            var extraction = await ExtractTextAsync(tempFilePath, cancellationToken);
            if (!extraction.Success || string.IsNullOrWhiteSpace(extraction.Text))
            {
                return new RecipeImportParseResult
                {
                    DocumentKind = ImportDocumentKind.Unsupported,
                    ParserUsed = nameof(RecipeImportPdfParser),
                    ConfidenceScore = 0.08m,
                    BoundaryMode = "pdf:image-only",
                    TemplateKey = ImportNormalizer.BuildTemplateKey("pdf", new[] { context.OriginalFileName }),
                    Issues = new List<ParsedImportIssueCandidate>
                    {
                        new()
                        {
                            Severity = ImportIssueSeverity.Warning,
                            Code = "UNSUPPORTED_PDF_IMAGE_ONLY",
                            Message = "PDF içinde seçilebilir metin bulunamadı.",
                            Hint = "Metin seçilebilen bir PDF yükleyin. Taranmış PDF ve OCR bu sürümde desteklenmiyor."
                        }
                    }
                };
            }

            var lines = extraction.Text
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Select(line => line.Trim())
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .ToList();

            var (recipes, issues, confidence, boundaryMode) = RecipeImportTextRecipeExtractor.ParseLines(lines, "pdf");
            return new RecipeImportParseResult
            {
                DocumentKind = ImportDocumentKind.TextPdf,
                ParserUsed = nameof(RecipeImportPdfParser),
                ConfidenceScore = Math.Clamp(confidence + 0.04m, 0.2m, 0.82m),
                BoundaryMode = boundaryMode,
                TemplateKey = ImportNormalizer.BuildTemplateKey("pdf", lines.Take(12)),
                Issues = issues,
                Recipes = recipes
            };
        }
        finally
        {
            if (File.Exists(tempFilePath))
                File.Delete(tempFilePath);
        }
    }

    private static async Task<PdfExtractionResult> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        var scriptPath = ResolveScriptPath();
        if (scriptPath == null)
            return new PdfExtractionResult(false, null, "PDF yardımcı betiği bulunamadı.");

        var startInfo = new ProcessStartInfo
        {
            FileName = "py",
            Arguments = $"\"{scriptPath}\" \"{filePath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var output = await outputTask;
        var error = await errorTask;
        if (process.ExitCode != 0)
            return new PdfExtractionResult(false, null, string.IsNullOrWhiteSpace(error) ? "PDF metni çıkarılamadı." : error.Trim());

        try
        {
            var payload = JsonSerializer.Deserialize<PdfScriptResponse>(
                output,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            return new PdfExtractionResult(
                payload?.Success ?? false,
                payload?.Text,
                payload?.Error);
        }
        catch (JsonException)
        {
            return new PdfExtractionResult(false, null, "PDF çözümleme çıktısı beklenen biçimde değildi.");
        }
    }

    private static string? ResolveScriptPath()
    {
        var assemblyDirectory = Path.GetDirectoryName(typeof(RecipeImportPdfParser).Assembly.Location) ?? AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "recipe_import_pdf_extract.py"),
            Path.Combine(AppContext.BaseDirectory, "Services", "Import", "recipe_import_pdf_extract.py"),
            Path.Combine(assemblyDirectory, "recipe_import_pdf_extract.py"),
            Path.Combine(assemblyDirectory, "Services", "Import", "recipe_import_pdf_extract.py")
        };

        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(candidate))
                return candidate;
        }

        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current != null)
        {
            var repoCandidate = Path.Combine(
                current.FullName,
                "src",
                "MyDietitianMobileApp.Infrastructure",
                "Services",
                "Import",
                "recipe_import_pdf_extract.py");

            if (File.Exists(repoCandidate))
                return repoCandidate;

            current = current.Parent;
        }

        return null;
    }

    private sealed record PdfScriptResponse(bool Success, string? Text, string? Error);
    private sealed record PdfExtractionResult(bool Success, string? Text, string? Error);
}
