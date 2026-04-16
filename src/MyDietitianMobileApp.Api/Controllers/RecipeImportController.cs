using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services.Import;
using ReviewRequest = MyDietitianMobileApp.Infrastructure.Services.Import.ImportReviewRequest;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>Multipart form model for recipe file upload.</summary>
public sealed class RecipeUploadRequest
{
    /// <summary>The file to import (CSV, XLSX, DOCX or PDF).</summary>
    public IFormFile File { get; set; } = null!;

    /// <summary>Parsing mode: auto | table | freeform (default: auto)</summary>
    public string? Mode { get; set; }
}

[Authorize]
[ApiController]
[Route("api/dietitian/recipes/imports")]
public class RecipeImportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuthDbContext _authDb;
    private readonly RecipeImportOrchestrator _orchestrator;
    private readonly ILogger<RecipeImportController> _logger;

    public RecipeImportController(
        AppDbContext db,
        AuthDbContext authDb,
        RecipeImportOrchestrator orchestrator,
        ILogger<RecipeImportController> logger)
    {
        _db = db;
        _authDb = authDb;
        _orchestrator = orchestrator;
        _logger = logger;
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] RecipeUploadRequest request, CancellationToken cancellationToken)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Forbid();

        var file = request.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Dosya boş veya eksik." });

        var extension = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
        if (extension is not ("csv" or "xlsx" or "docx" or "pdf"))
            return BadRequest(new { error = "Yalnızca CSV, XLSX, DOCX ve metin içeren PDF dosyaları desteklenmektedir." });

        var normalizedMode = string.IsNullOrWhiteSpace(request.Mode) ? "auto" : request.Mode.Trim().ToLowerInvariant();
        if (normalizedMode is not ("auto" or "table" or "freeform"))
            return BadRequest(new { error = "Geçersiz içe aktarma modu." });

        try
        {
            await using var stream = file.OpenReadStream();
            var sessionId = await _orchestrator.ProcessUploadAsync(stream, file.FileName, dietitianId.Value, normalizedMode, cancellationToken);
            return Ok(new { sessionId });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recipe import upload failed.");
            return StatusCode(500, new { error = "Dosya işlenirken beklenmeyen bir hata oluştu." });
        }
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<IActionResult> GetPreview(Guid sessionId, CancellationToken cancellationToken)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Forbid();

        var session = await _db.RecipeImportSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == sessionId && item.DietitianId == dietitianId.Value, cancellationToken);

        if (session == null)
            return NotFound();

        var sessionRecipes = await _db.RecipeImportSessionRecipes
            .AsNoTracking()
            .Where(recipe => recipe.SessionId == sessionId)
            .OrderBy(recipe => recipe.DisplayOrder)
            .ToListAsync(cancellationToken);

        var sessionRecipeIds = sessionRecipes.Select(recipe => recipe.Id).ToList();
        var sessionIngredients = await _db.RecipeImportSessionIngredients
            .AsNoTracking()
            .Where(ingredient => sessionRecipeIds.Contains(ingredient.SessionRecipeId))
            .OrderBy(ingredient => ingredient.DisplayOrder)
            .ToListAsync(cancellationToken);

        var sessionIssues = await _db.RecipeImportSessionIssues
            .AsNoTracking()
            .Where(issue => issue.SessionId == sessionId)
            .ToListAsync(cancellationToken);

        var ingredientsByRecipe = sessionIngredients
            .GroupBy(ingredient => ingredient.SessionRecipeId)
            .ToDictionary(group => group.Key, group => group.ToList());
        var issuesByRecipe = sessionIssues
            .Where(issue => issue.SessionRecipeId.HasValue)
            .GroupBy(issue => issue.SessionRecipeId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());
        var globalIssues = sessionIssues.Where(issue => !issue.SessionRecipeId.HasValue).ToList();

        var recipes = sessionRecipes.Select(recipe =>
        {
            var ingredients = ingredientsByRecipe.GetValueOrDefault(recipe.Id, new List<Domain.Entities.RecipeImportSessionIngredient>());
            var issues = issuesByRecipe.GetValueOrDefault(recipe.Id, new List<Domain.Entities.RecipeImportSessionIssue>());

            return new RecipeImportPreviewRecipeDto
            {
                Id = recipe.Id,
                Title = recipe.NormalizedTitle,
                Description = recipe.Description,
                IsPublic = recipe.IsPublic,
                NeedsReview = recipe.NeedsReview,
                RawSourceBlock = recipe.RawSourceBlock,
                Steps = recipe.GetSteps().ToList(),
                Tags = recipe.GetTags().ToList(),
                PrepTimeText = recipe.PrepTimeText,
                CookTimeText = recipe.CookTimeText,
                ServingsText = recipe.ServingsText,
                HasDuplicate = recipe.HasDuplicate,
                ExistingRecipeId = recipe.ExistingRecipeId,
                DuplicateResolutionMode = recipe.DuplicateResolutionMode.ToString(),
                IsSkipped = recipe.IsSkipped,
                DisplayOrder = recipe.DisplayOrder,
                Ingredients = ingredients.Select(ingredient => new RecipeImportPreviewIngredientDto
                {
                    Id = ingredient.Id,
                    RawName = ingredient.RawName,
                    NormalizedName = ingredient.NormalizedName,
                    RawLineText = ingredient.RawLineText,
                    AmountRaw = ingredient.AmountRaw,
                    AmountValue = ingredient.AmountValue,
                    Unit = ingredient.UnitNormalized,
                    Role = ingredient.Role.ToString(),
                    MatchedIngredientId = ingredient.MatchedIngredientId,
                    MatchedCanonicalName = ingredient.MatchedCanonicalName,
                    MatchType = ingredient.MatchType.ToString(),
                    MatchConfidence = ingredient.MatchConfidence,
                    ParseConfidence = ingredient.ParseConfidence,
                    IsResolved = ingredient.IsResolved,
                    NeedsReview = ingredient.NeedsReview,
                    IssueCodes = ingredient.GetIssueCodes().ToList()
                }).ToList(),
                Issues = issues.Select(MapIssue).ToList()
            };
        }).ToList();

        var warnings = DeserializeStringList(session.WarningsJson);
        var dto = new RecipeImportPreviewDto
        {
            SessionId = session.Id,
            Status = session.Status.ToString(),
            OriginalFileName = session.OriginalFileName,
            DocumentKind = session.DocumentKind.ToString(),
            ParserUsed = session.ParserUsed,
            ConfidenceScore = session.ConfidenceScore,
            Warnings = warnings,
            TotalRecipes = session.ParsedRecipeCount,
            MatchedIngredients = sessionIngredients.Count(ingredient => ingredient.IsResolved),
            AmbiguousIngredients = sessionIngredients.Count(ingredient => ingredient.MatchType == ImportIngredientMatchType.Ambiguous),
            UnmatchedIngredients = session.UnmatchedIngredientCount,
            BlockingIssues = sessionIssues.Count(issue => issue.Severity == ImportIssueSeverity.Error),
            WarningsCount = sessionIssues.Count(issue => issue.Severity == ImportIssueSeverity.Warning),
            ErrorMessage = session.ErrorMessage,
            Issues = globalIssues.Select(MapIssue).ToList(),
            Recipes = recipes
        };

        return Ok(dto);
    }

    [HttpPut("{sessionId:guid}/review")]
    public async Task<IActionResult> Review(
        Guid sessionId,
        [FromBody] ReviewRequest request,
        CancellationToken cancellationToken)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Forbid();

        try
        {
            await _orchestrator.ApplyReviewAsync(sessionId, dietitianId.Value, request, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{sessionId:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid sessionId, CancellationToken cancellationToken)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Forbid();

        try
        {
            var (created, updated, skipped, warningCount, reviewedRecipeCount, names) =
                await _orchestrator.ConfirmAsync(sessionId, dietitianId.Value, cancellationToken);

            return Ok(new ConfirmImportResultDto
            {
                CreatedCount = created,
                UpdatedCount = updated,
                SkippedCount = skipped,
                WarningCount = warningCount,
                ReviewedRecipeCount = reviewedRecipeCount,
                CreatedRecipeNames = names
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recipe import confirm failed for session {SessionId}", sessionId);
            return StatusCode(500, new { error = "Onay sırasında beklenmeyen bir hata oluştu." });
        }
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        var user = await _authDb.UserAccounts.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == Guid.Parse(userId));
        return user?.LinkedDietitianId;
    }

    private static RecipeImportIssueDto MapIssue(Domain.Entities.RecipeImportSessionIssue issue)
    {
        return new RecipeImportIssueDto
        {
            Severity = issue.Severity.ToString(),
            Code = issue.Code,
            Message = issue.Message,
            Hint = issue.Hint,
            SessionRecipeId = issue.SessionRecipeId,
            SessionIngredientId = issue.SessionIngredientId
        };
    }

    private static List<string> DeserializeStringList(string? rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return new List<string>();

        try
        {
            return JsonSerializer.Deserialize<List<string>>(rawJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }
}
