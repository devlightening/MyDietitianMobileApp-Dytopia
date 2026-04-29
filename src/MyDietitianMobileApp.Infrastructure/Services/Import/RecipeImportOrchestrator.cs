using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

public class RecipeImportOrchestrator
{
    private readonly AppDbContext _db;
    private readonly RecipeImportIngredientMatcher _matcher;
    private readonly List<IRecipeImportParser> _parsers;

    public RecipeImportOrchestrator(AppDbContext db)
    {
        _db = db;
        _matcher = new RecipeImportIngredientMatcher(db);
        _parsers =
        [
            new RecipeImportCsvParser(),
            new RecipeImportExcelParser(),
            new RecipeImportDocxParser(),
            new RecipeImportPdfParser()
        ];
    }

    public async Task<Guid> ProcessUploadAsync(
        Stream fileStream,
        string originalFileName,
        Guid dietitianId,
        string mode = "auto",
        CancellationToken cancellationToken = default)
    {
        var fileType = Path.GetExtension(originalFileName).TrimStart('.').ToLowerInvariant();
        if (fileType is not ("csv" or "xlsx" or "docx" or "pdf"))
            throw new InvalidOperationException("Yalnızca CSV, XLSX, DOCX ve seçilebilir metin içeren PDF dosyaları desteklenmektedir.");

        var parser = _parsers.FirstOrDefault(item => item.CanHandle(fileType))
            ?? throw new InvalidOperationException("Bu dosya tipi için uygun parser bulunamadı.");

        var templateHints = await LoadTemplateHintsAsync(dietitianId, fileType, cancellationToken);

        await using var buffer = new MemoryStream();
        await fileStream.CopyToAsync(buffer, cancellationToken);
        var fileBytes = buffer.ToArray();

        var session = new RecipeImportSession(Guid.NewGuid(), dietitianId, originalFileName, fileType);
        _db.RecipeImportSessions.Add(session);
        await _db.SaveChangesAsync(cancellationToken);

        try
        {
            session.SetStatus(ImportSessionStatus.Parsing);
            await _db.SaveChangesAsync(cancellationToken);

            var parseContext = new RecipeImportParserContext
            {
                OriginalFileName = originalFileName,
                FileType = fileType,
                FileBytes = fileBytes,
                Mode = string.IsNullOrWhiteSpace(mode) ? "auto" : mode.Trim().ToLowerInvariant(),
                TemplateHeaderHints = templateHints
            };

            var parseResult = await parser.ParseAsync(parseContext, cancellationToken);
            session.SetDetection(
                parseResult.DocumentKind,
                parseResult.ParserUsed,
                parseResult.ConfidenceScore,
                ImportNormalizer.SerializeWarnings(parseResult.Warnings),
                parseResult.BoundaryMode,
                parseResult.TemplateKey,
                parseResult.TemplateHeaderHints.Count == 0 ? null : JsonSerializer.Serialize(parseResult.TemplateHeaderHints));

            var existingRecipes = await _db.Recipes
                .AsNoTracking()
                .Where(recipe => recipe.DietitianId == dietitianId)
                .Select(recipe => new { recipe.Id, recipe.Name })
                .ToListAsync(cancellationToken);

            var existingByName = existingRecipes.ToDictionary(
                recipe => recipe.Name.Trim(),
                recipe => recipe.Id,
                StringComparer.OrdinalIgnoreCase);

            var recipeIdByDisplayOrder = new Dictionary<int, Guid>();
            var ingredientIdByCompositeKey = new Dictionary<string, Guid>();
            var unresolvedCount = 0;

            foreach (var candidate in parseResult.Recipes.OrderBy(recipe => recipe.DisplayOrder))
            {
                cancellationToken.ThrowIfCancellationRequested();

                var sessionRecipe = new RecipeImportSessionRecipe(
                    Guid.NewGuid(),
                    session.Id,
                    candidate.Title,
                    candidate.Description,
                    candidate.IsPublic,
                    candidate.DisplayOrder,
                    candidate.RawSourceBlock,
                    candidate.Steps,
                    candidate.Tags,
                    candidate.PrepTimeText,
                    candidate.CookTimeText,
                    candidate.ServingsText,
                    candidate.NeedsReview);

                if (existingByName.TryGetValue(candidate.Title.Trim(), out var existingId))
                    sessionRecipe.MarkDuplicate(existingId);

                _db.RecipeImportSessionRecipes.Add(sessionRecipe);
                recipeIdByDisplayOrder[candidate.DisplayOrder] = sessionRecipe.Id;

                if (sessionRecipe.HasDuplicate)
                {
                    _db.RecipeImportSessionIssues.Add(new RecipeImportSessionIssue(
                        Guid.NewGuid(),
                        session.Id,
                        sessionRecipe.Id,
                        null,
                        ImportIssueSeverity.Warning,
                        "DUPLICATE_RECIPE",
                        $"'{candidate.Title}' adlı tarif zaten mevcut.",
                        "Yeni oluştur, mevcut tarifi güncelle veya bu kaydı atla."));
                }

                if (candidate.NeedsReview)
                {
                    _db.RecipeImportSessionIssues.Add(new RecipeImportSessionIssue(
                        Guid.NewGuid(),
                        session.Id,
                        sessionRecipe.Id,
                        null,
                        ImportIssueSeverity.Warning,
                        "LOW_PARSER_CONFIDENCE",
                        $"'{candidate.Title}' tarifinde parser güveni düşük bulundu.",
                        "Başlık, açıklama ve yapılış adımlarını gözden geçirmeniz önerilir."));
                }

                foreach (var ingredientCandidate in candidate.Ingredients.OrderBy(ingredient => ingredient.DisplayOrder))
                {
                    var role = Enum.TryParse<ImportIngredientRole>(ingredientCandidate.Role, true, out var parsedRole)
                        ? parsedRole
                        : ImportIngredientRole.Mandatory;

                    var sessionIngredient = new RecipeImportSessionIngredient(
                        Guid.NewGuid(),
                        sessionRecipe.Id,
                        ingredientCandidate.RawName,
                        ingredientCandidate.AmountRaw,
                        ingredientCandidate.AmountValue,
                        ingredientCandidate.UnitNormalized,
                        role,
                        ingredientCandidate.DisplayOrder,
                        ingredientCandidate.RawLineText,
                        ingredientCandidate.ParseConfidence,
                        ingredientCandidate.IssueCodes,
                        ingredientCandidate.NeedsReview);

                    var matchResult = await _matcher.MatchAsync(ingredientCandidate.RawName, cancellationToken);
                    if (matchResult.IsResolved && matchResult.IngredientId.HasValue && !string.IsNullOrWhiteSpace(matchResult.CanonicalName))
                    {
                        sessionIngredient.SetMatch(
                            matchResult.IngredientId.Value,
                            matchResult.CanonicalName!,
                            matchResult.MatchType,
                            matchResult.Confidence);
                        // Resolved but parser-flagged uncertain → still needs human eye.
                        if (ingredientCandidate.NeedsReview)
                            unresolvedCount++;
                    }
                    else if (matchResult.MatchType == ImportIngredientMatchType.Ambiguous)
                    {
                        unresolvedCount++;
                        sessionIngredient.MarkAmbiguous(
                            matchResult.Confidence,
                            MergeIssueCodes(ingredientCandidate.IssueCodes, matchResult.IssueCode));
                    }
                    else
                    {
                        unresolvedCount++;
                        sessionIngredient.ApplyReview(
                            null,
                            null,
                            null,
                            ingredientCandidate.AmountRaw,
                            ingredientCandidate.AmountValue,
                            ingredientCandidate.UnitNormalized,
                            true,
                            MergeIssueCodes(ingredientCandidate.IssueCodes, matchResult.IssueCode));
                    }

                    _db.RecipeImportSessionIngredients.Add(sessionIngredient);
                    ingredientIdByCompositeKey[$"{candidate.DisplayOrder}:{ingredientCandidate.DisplayOrder}"] = sessionIngredient.Id;

                    if (!matchResult.IsResolved && !string.IsNullOrWhiteSpace(matchResult.IssueCode) && !string.IsNullOrWhiteSpace(matchResult.IssueMessage))
                    {
                        _db.RecipeImportSessionIssues.Add(new RecipeImportSessionIssue(
                            Guid.NewGuid(),
                            session.Id,
                            sessionRecipe.Id,
                            sessionIngredient.Id,
                            ImportIssueSeverity.Warning,
                            matchResult.IssueCode!,
                            matchResult.IssueMessage!,
                            matchResult.Hint));
                    }
                }
            }

            foreach (var issue in parseResult.Issues)
            {
                recipeIdByDisplayOrder.TryGetValue(issue.RecipeDisplayOrder ?? -1, out var sessionRecipeId);
                ingredientIdByCompositeKey.TryGetValue($"{issue.RecipeDisplayOrder}:{issue.IngredientDisplayOrder}", out var sessionIngredientId);

                _db.RecipeImportSessionIssues.Add(new RecipeImportSessionIssue(
                    Guid.NewGuid(),
                    session.Id,
                    sessionRecipeId == Guid.Empty ? null : sessionRecipeId,
                    sessionIngredientId == Guid.Empty ? null : sessionIngredientId,
                    issue.Severity,
                    issue.Code,
                    issue.Message,
                    issue.Hint));
            }

            session.SetSummary(parseResult.Recipes.Count, unresolvedCount);
            session.SetStatus(parseResult.Recipes.Count > 0 && unresolvedCount == 0
                ? ImportSessionStatus.ReadyToConfirm
                : ImportSessionStatus.NeedsReview);

            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            session.SetStatus(ImportSessionStatus.Failed, ex.Message);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return session.Id;
    }

    public async Task ApplyReviewAsync(
        Guid sessionId,
        Guid dietitianId,
        ImportReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var session = await _db.RecipeImportSessions
            .FirstOrDefaultAsync(item => item.Id == sessionId && item.DietitianId == dietitianId, cancellationToken)
            ?? throw new KeyNotFoundException("İçe aktarma oturumu bulunamadı.");

        if (session.Status is not (ImportSessionStatus.NeedsReview or ImportSessionStatus.ReadyToConfirm))
            throw new InvalidOperationException("Bu oturum şu anda inceleme için uygun değil.");

        var sessionRecipes = await _db.RecipeImportSessionRecipes
            .Include(recipe => recipe.Ingredients)
            .Where(recipe => recipe.SessionId == sessionId)
            .ToListAsync(cancellationToken);

        foreach (var reviewedRecipe in request.Recipes)
        {
            var existingRecipe = sessionRecipes.FirstOrDefault(recipe => recipe.Id == reviewedRecipe.Id);
            if (existingRecipe == null)
                continue;

            existingRecipe.ApplyReview(
                reviewedRecipe.Title,
                reviewedRecipe.Description,
                reviewedRecipe.IsPublic,
                reviewedRecipe.DuplicateResolutionMode,
                reviewedRecipe.TargetRecipeId,
                reviewedRecipe.IsSkipped,
                reviewedRecipe.Steps,
                reviewedRecipe.Tags,
                reviewedRecipe.PrepTimeText,
                reviewedRecipe.CookTimeText,
                reviewedRecipe.ServingsText,
                reviewedRecipe.NeedsReview);

            if (reviewedRecipe.Ingredients == null)
                continue;

            foreach (var reviewedIngredient in reviewedRecipe.Ingredients)
            {
                var ingredient = existingRecipe.Ingredients.FirstOrDefault(item => item.Id == reviewedIngredient.Id);
                if (ingredient == null)
                    continue;

                ingredient.ApplyReview(
                    reviewedIngredient.MatchedIngredientId,
                    reviewedIngredient.MatchedCanonicalName,
                    reviewedIngredient.Role,
                    reviewedIngredient.AmountRaw,
                    reviewedIngredient.AmountValue,
                    reviewedIngredient.Unit,
                    reviewedIngredient.NeedsReview,
                    reviewedIngredient.IssueCodes);
            }
        }

        var unresolvedCount = sessionRecipes
            .Where(recipe => !recipe.IsSkipped)
            .SelectMany(recipe => recipe.Ingredients)
            .Count(ingredient =>
                !ingredient.IsResolved &&
                ingredient.Role is not ImportIngredientRole.Optional &&
                ingredient.Role is not ImportIngredientRole.Flavoring);

        session.SetSummary(sessionRecipes.Count(recipe => !recipe.IsSkipped), unresolvedCount);
        session.SetStatus(unresolvedCount == 0 ? ImportSessionStatus.ReadyToConfirm : ImportSessionStatus.NeedsReview);

        if (request.SaveAsTemplate && !string.IsNullOrWhiteSpace(session.TemplateKey))
            UpsertTemplate(session, dietitianId);

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<(int Created, int Updated, int Skipped, int WarningCount, int ReviewedRecipeCount, List<string> Names)> ConfirmAsync(
        Guid sessionId,
        Guid dietitianId,
        CancellationToken cancellationToken = default)
    {
        var session = await _db.RecipeImportSessions
            .FirstOrDefaultAsync(item => item.Id == sessionId && item.DietitianId == dietitianId, cancellationToken)
            ?? throw new KeyNotFoundException("İçe aktarma oturumu bulunamadı.");

        if (session.Status is not (ImportSessionStatus.ReadyToConfirm or ImportSessionStatus.NeedsReview))
            throw new InvalidOperationException("Bu oturum henüz onaya hazır değil.");

        var sessionRecipes = await _db.RecipeImportSessionRecipes
            .Include(recipe => recipe.Ingredients)
            .Where(recipe => recipe.SessionId == sessionId)
            .OrderBy(recipe => recipe.DisplayOrder)
            .ToListAsync(cancellationToken);

        var warningCount = await _db.RecipeImportSessionIssues.CountAsync(
            issue => issue.SessionId == sessionId && issue.Severity == ImportIssueSeverity.Warning,
            cancellationToken);

        var created = 0;
        var updated = 0;
        var skipped = 0;
        var names = new List<string>();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var sessionRecipe in sessionRecipes)
            {
                if (sessionRecipe.IsSkipped)
                {
                    skipped++;
                    continue;
                }

                var resolvedIngredients = sessionRecipe.Ingredients
                    .Where(ingredient => ingredient.IsResolved && ingredient.MatchedIngredientId.HasValue)
                    .ToList();

                var mandatory = resolvedIngredients
                    .Where(ingredient => ingredient.Role == ImportIngredientRole.Mandatory)
                    .Select(ingredient => ingredient.MatchedIngredientId!.Value)
                    .ToList();
                var optional = resolvedIngredients
                    .Where(ingredient => ingredient.Role == ImportIngredientRole.Optional)
                    .Select(ingredient => ingredient.MatchedIngredientId!.Value)
                    .ToList();
                var flavoring = resolvedIngredients
                    .Where(ingredient => ingredient.Role == ImportIngredientRole.Flavoring)
                    .Select(ingredient => ingredient.MatchedIngredientId!.Value)
                    .ToList();
                var prohibited = resolvedIngredients
                    .Where(ingredient => ingredient.Role == ImportIngredientRole.Prohibited)
                    .Select(ingredient => ingredient.MatchedIngredientId!.Value)
                    .ToList();

                if (sessionRecipe.HasDuplicate &&
                    sessionRecipe.DuplicateResolutionMode == ImportDuplicateResolutionMode.UpdateExisting &&
                    sessionRecipe.ExistingRecipeId.HasValue)
                {
                    var existingRecipe = await _db.Recipes
                        .Include(recipe => recipe.MandatoryIngredients)
                        .Include(recipe => recipe.OptionalIngredients)
                        .Include(recipe => recipe.ProhibitedIngredients)
                        .FirstOrDefaultAsync(recipe => recipe.Id == sessionRecipe.ExistingRecipeId.Value, cancellationToken);

                    if (existingRecipe == null)
                    {
                        skipped++;
                        continue;
                    }

                    existingRecipe.UpdateName(sessionRecipe.NormalizedTitle);
                    existingRecipe.UpdateDescription(sessionRecipe.Description ?? string.Empty);
                    existingRecipe.UpdateVisibility(sessionRecipe.IsPublic);
                    ApplyMetadata(existingRecipe, sessionRecipe);
                    existingRecipe.ClearMandatoryIngredients();
                    existingRecipe.ClearOptionalIngredients();
                    existingRecipe.ClearProhibitedIngredients();
                    await ReplaceExplicitRecipeIngredientsAsync(
                        existingRecipe.Id,
                        mandatory,
                        optional,
                        flavoring,
                        prohibited,
                        cancellationToken);
                    await AddIngredientsToRecipe(existingRecipe, mandatory, optional, flavoring, prohibited, cancellationToken);
                    updated++;
                    names.Add(sessionRecipe.NormalizedTitle);
                    continue;
                }

                if (sessionRecipe.HasDuplicate &&
                    sessionRecipe.DuplicateResolutionMode == ImportDuplicateResolutionMode.Skip)
                {
                    skipped++;
                    continue;
                }

                var recipe = new Recipe(Guid.NewGuid(), dietitianId, sessionRecipe.NormalizedTitle, sessionRecipe.Description ?? string.Empty, sessionRecipe.IsPublic);
                ApplyMetadata(recipe, sessionRecipe);
                _db.Recipes.Add(recipe);
                await _db.SaveChangesAsync(cancellationToken);
                await SyncExplicitRecipeIngredientsAsync(recipe.Id, mandatory, optional, flavoring, prohibited, cancellationToken);
                await AddIngredientsToRecipe(recipe, mandatory, optional, flavoring, prohibited, cancellationToken);
                created++;
                names.Add(sessionRecipe.NormalizedTitle);
            }

            session.SetStatus(ImportSessionStatus.Completed);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            session.SetStatus(ImportSessionStatus.Failed, "İçe aktarma onayı sırasında beklenmeyen bir hata oluştu.");
            await _db.SaveChangesAsync(cancellationToken);
            throw;
        }

        var reviewedRecipeCount = sessionRecipes.Count(recipe => recipe.NeedsReview);
        return (created, updated, skipped, warningCount, reviewedRecipeCount, names);
    }

    private void UpsertTemplate(RecipeImportSession session, Guid dietitianId)
    {
        var templateKey = session.TemplateKey!;
        var template = _db.ImportTemplates.FirstOrDefault(item => item.DietitianId == dietitianId && item.TemplateKey == templateKey);
        if (template == null)
        {
            template = new ImportTemplate(
                Guid.NewGuid(),
                dietitianId,
                templateKey,
                Path.GetFileNameWithoutExtension(session.OriginalFileName),
                session.DocumentKind,
                session.ParserUsed ?? "RecipeImport",
                session.TemplateHeaderHintsJson);
            _db.ImportTemplates.Add(template);
            return;
        }

        template.UpdateHints(session.TemplateHeaderHintsJson, Path.GetFileNameWithoutExtension(session.OriginalFileName));
        template.MarkUsed();
    }

    private async Task<Dictionary<string, string>> LoadTemplateHintsAsync(Guid dietitianId, string fileType, CancellationToken cancellationToken)
    {
        var templates = await _db.ImportTemplates
            .AsNoTracking()
            .Where(item => item.DietitianId == dietitianId && item.TemplateKey.StartsWith($"{fileType}:"))
            .OrderByDescending(item => item.LastUsedAtUtc)
            .Take(5)
            .ToListAsync(cancellationToken);

        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var template in templates)
        {
            if (string.IsNullOrWhiteSpace(template.HeaderHintsJson))
                continue;

            try
            {
                var hints = JsonSerializer.Deserialize<Dictionary<string, string>>(template.HeaderHintsJson);
                if (hints == null)
                    continue;

                foreach (var hint in hints)
                    result[hint.Key] = hint.Value;
            }
            catch (JsonException)
            {
                continue;
            }
        }

        return result;
    }

    private static IEnumerable<string> MergeIssueCodes(IEnumerable<string> left, string? right)
    {
        return string.IsNullOrWhiteSpace(right)
            ? left
            : left.Concat(new[] { right! });
    }

    private void ApplyMetadata(Recipe recipe, RecipeImportSessionRecipe sessionRecipe)
    {
        recipe.SetSteps(sessionRecipe.GetSteps());
        recipe.SetTags(sessionRecipe.GetTags());
        recipe.SetMetadata(
            ParseInteger(sessionRecipe.PrepTimeText),
            ParseInteger(sessionRecipe.CookTimeText),
            ParseInteger(sessionRecipe.ServingsText));
    }

    private static int? ParseInteger(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var digits = new string(raw.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out var value) && value > 0 ? value : null;
    }

    private async Task AddIngredientsToRecipe(
        Recipe recipe,
        List<Guid> mandatory,
        List<Guid> optional,
        List<Guid> flavoring,
        List<Guid> prohibited,
        CancellationToken cancellationToken)
    {
        var allIds = mandatory.Concat(optional).Concat(flavoring).Concat(prohibited).Distinct().ToList();
        if (allIds.Count == 0)
            return;

        var ingredients = await _db.Ingredients
            .Where(ingredient => allIds.Contains(ingredient.Id))
            .ToListAsync(cancellationToken);
        var ingredientMap = ingredients.ToDictionary(ingredient => ingredient.Id);

        foreach (var ingredientId in mandatory)
            if (ingredientMap.TryGetValue(ingredientId, out var ingredient))
                recipe.AddMandatoryIngredient(ingredient);

        foreach (var ingredientId in optional)
            if (ingredientMap.TryGetValue(ingredientId, out var ingredient))
                recipe.AddOptionalIngredient(ingredient);

        // Keep flavoring ingredients in the optional shadow relation for legacy consumers.
        foreach (var ingredientId in flavoring)
            if (ingredientMap.TryGetValue(ingredientId, out var ingredient))
                recipe.AddOptionalIngredient(ingredient);

        foreach (var ingredientId in prohibited)
            if (ingredientMap.TryGetValue(ingredientId, out var ingredient))
                recipe.AddProhibitedIngredient(ingredient);

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task SyncExplicitRecipeIngredientsAsync(
        Guid recipeId,
        IEnumerable<Guid> mandatory,
        IEnumerable<Guid> optional,
        IEnumerable<Guid> flavoring,
        IEnumerable<Guid> prohibited,
        CancellationToken cancellationToken)
    {
        foreach (var ingredientId in mandatory.Distinct())
            _db.RecipeIngredients.Add(new RecipeIngredient(recipeId, ingredientId, RecipeIngredient.MandatoryRole));

        foreach (var ingredientId in optional.Distinct())
            _db.RecipeIngredients.Add(new RecipeIngredient(recipeId, ingredientId, RecipeIngredient.OptionalRole));

        foreach (var ingredientId in flavoring.Distinct())
            _db.RecipeIngredients.Add(new RecipeIngredient(recipeId, ingredientId, RecipeIngredient.FlavoringRole));

        foreach (var ingredientId in prohibited.Distinct())
            _db.RecipeIngredients.Add(new RecipeIngredient(recipeId, ingredientId, RecipeIngredient.ProhibitedRole));

        await Task.CompletedTask;
    }

    private async Task ReplaceExplicitRecipeIngredientsAsync(
        Guid recipeId,
        IEnumerable<Guid> mandatory,
        IEnumerable<Guid> optional,
        IEnumerable<Guid> flavoring,
        IEnumerable<Guid> prohibited,
        CancellationToken cancellationToken)
    {
        var existing = await _db.RecipeIngredients
            .Where(item => item.RecipeId == recipeId)
            .ToListAsync(cancellationToken);
        if (existing.Count > 0)
            _db.RecipeIngredients.RemoveRange(existing);

        await SyncExplicitRecipeIngredientsAsync(recipeId, mandatory, optional, flavoring, prohibited, cancellationToken);
    }
}
