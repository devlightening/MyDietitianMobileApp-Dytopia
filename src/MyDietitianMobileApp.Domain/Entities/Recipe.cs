using System.Text.Json;
using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Domain.Entities;

public class Recipe
{
    public override bool Equals(object obj)
    {
        if (obj is not Recipe other) return false;
        return Id == other.Id;
    }

    public override int GetHashCode() => Id.GetHashCode();

    public Guid Id { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string Name { get; private set; }
    public string Slug { get; private set; }
    public string Description { get; private set; }
    public bool IsPublic { get; private set; }

    public bool IsDemo { get; private set; }
    public bool IsDraft { get; private set; }
    public bool IsHiddenFromProduction { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAtUtc { get; private set; }

    public string? StepsJson { get; private set; }
    public string? TagsJson { get; private set; }
    public int? PrepTimeMinutes { get; private set; }
    public int? CookTimeMinutes { get; private set; }
    public int? Servings { get; private set; }
    public int? CaloriesKcal { get; private set; }
    public decimal? ProteinGrams { get; private set; }
    public decimal? CarbsGrams { get; private set; }
    public decimal? FatGrams { get; private set; }

    public IReadOnlyList<string> Steps =>
        string.IsNullOrWhiteSpace(StepsJson)
            ? Array.Empty<string>()
            : JsonSerializer.Deserialize<List<string>>(StepsJson) ?? new List<string>();

    public IReadOnlyList<string> Tags =>
        string.IsNullOrWhiteSpace(TagsJson)
            ? Array.Empty<string>()
            : JsonSerializer.Deserialize<List<string>>(TagsJson) ?? new List<string>();

    public IReadOnlyCollection<Ingredient> MandatoryIngredients => _mandatoryIngredients.AsReadOnly();
    public IReadOnlyCollection<Ingredient> OptionalIngredients => _optionalIngredients.AsReadOnly();
    public IReadOnlyCollection<Ingredient> ProhibitedIngredients => _prohibitedIngredients.AsReadOnly();

    private readonly List<Ingredient> _mandatoryIngredients = new();
    private readonly List<Ingredient> _optionalIngredients = new();
    private readonly List<Ingredient> _prohibitedIngredients = new();

    private Recipe()
    {
        Name = string.Empty;
        Slug = string.Empty;
        Description = string.Empty;
    }

    public Recipe(
        Guid id,
        Guid? dietitianId,
        string name,
        string description,
        bool isPublic = false,
        bool isDemo = false,
        bool isDraft = false,
        bool isHiddenFromProduction = false,
        bool isArchived = false)
    {
        Id = id;
        DietitianId = dietitianId;
        Name = name.Trim();
        Slug = BuildSlug(Name, id);
        Description = description;
        IsPublic = isPublic;
        IsDemo = isDemo;
        IsDraft = isDraft;
        IsHiddenFromProduction = isHiddenFromProduction;
        IsArchived = isArchived;
    }

    public void MarkAsDemo() => IsDemo = true;
    public void MarkAsDraft() => IsDraft = true;
    public void HideFromProduction() => IsHiddenFromProduction = true;

    public void Publish()
    {
        IsDraft = false;
        IsHiddenFromProduction = false;
    }

    public void Archive()
    {
        IsArchived = true;
        ArchivedAtUtc = DateTime.UtcNow;
    }

    public void Restore()
    {
        IsArchived = false;
        ArchivedAtUtc = null;
    }

    public void UpdateVisibility(bool isPublic)
    {
        IsPublic = isPublic;
    }

    public void SetSteps(IEnumerable<string>? steps)
    {
        var list = (steps ?? Enumerable.Empty<string>())
            .Where(step => !string.IsNullOrWhiteSpace(step))
            .Select(step => step.Trim())
            .ToList();

        StepsJson = list.Count > 0
            ? JsonSerializer.Serialize(list)
            : null;
    }

    public void SetTags(IEnumerable<string>? tags)
    {
        var list = (tags ?? Enumerable.Empty<string>())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Select(tag => tag.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();

        TagsJson = list.Count > 0
            ? JsonSerializer.Serialize(list)
            : null;
    }

    public void SetMetadata(int? prepTimeMinutes, int? cookTimeMinutes, int? servings)
    {
        PrepTimeMinutes = prepTimeMinutes > 0 ? prepTimeMinutes : null;
        CookTimeMinutes = cookTimeMinutes > 0 ? cookTimeMinutes : null;
        Servings = servings > 0 ? servings : null;
    }

    public void SetNutrition(int? caloriesKcal, decimal? proteinGrams, decimal? carbsGrams, decimal? fatGrams)
    {
        CaloriesKcal = caloriesKcal >= 0 ? caloriesKcal : null;
        ProteinGrams = proteinGrams >= 0 ? proteinGrams : null;
        CarbsGrams = carbsGrams >= 0 ? carbsGrams : null;
        FatGrams = fatGrams >= 0 ? fatGrams : null;
    }

    public void AddMandatoryIngredient(Ingredient ingredient)
    {
        if (_mandatoryIngredients.Any(i => i.Id == ingredient.Id))
            return;

        _mandatoryIngredients.Add(ingredient);
    }

    public void AddOptionalIngredient(Ingredient ingredient)
    {
        if (_optionalIngredients.Any(i => i.Id == ingredient.Id))
            return;

        _optionalIngredients.Add(ingredient);
    }

    public void AddProhibitedIngredient(Ingredient ingredient)
    {
        if (_prohibitedIngredients.Any(i => i.Id == ingredient.Id))
            return;

        _prohibitedIngredients.Add(ingredient);
    }

    public void UpdateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Recipe name cannot be null or empty", nameof(name));

        Name = name.Trim();
        Slug = BuildSlug(Name, Id);
    }

    public void UpdateDescription(string description)
    {
        Description = description?.Trim() ?? string.Empty;
    }

    public void ClearMandatoryIngredients()
    {
        _mandatoryIngredients.Clear();
    }

    public void ClearOptionalIngredients()
    {
        _optionalIngredients.Clear();
    }

    public void ClearProhibitedIngredients()
    {
        _prohibitedIngredients.Clear();
    }

    public void ClearSubstitutes()
    {
        // Substitutes are managed via RecipeIngredientSubstitute join table.
    }

    /// <summary>
    /// Hydrates MandatoryIngredients and OptionalIngredients from explicit RecipeIngredients
    /// table data when the EF Core shadow join tables (RecipeMandatoryIngredients /
    /// RecipeOptionalIngredients) are empty due to a schema sync issue.
    /// Safe to call multiple times — no-ops if collections are already populated.
    /// </summary>
    public void HydrateFromExplicitIngredients(
        IEnumerable<Ingredient> mandatoryIngredients,
        IEnumerable<Ingredient> optionalIngredients,
        IEnumerable<Ingredient>? prohibitedIngredients = null)
    {
        if (_mandatoryIngredients.Count == 0)
        {
            foreach (var ing in mandatoryIngredients)
                if (_mandatoryIngredients.All(i => i.Id != ing.Id))
                    _mandatoryIngredients.Add(ing);
        }

        if (_optionalIngredients.Count == 0)
        {
            foreach (var ing in optionalIngredients)
                if (_optionalIngredients.All(i => i.Id != ing.Id))
                    _optionalIngredients.Add(ing);
        }

        if (prohibitedIngredients != null && _prohibitedIngredients.Count == 0)
        {
            foreach (var ing in prohibitedIngredients)
                if (_prohibitedIngredients.All(i => i.Id != ing.Id))
                    _prohibitedIngredients.Add(ing);
        }
    }

    public void SetSubstitutes(Guid requiredIngredientId, IEnumerable<Guid> substituteIngredientIds)
    {
        if (!_mandatoryIngredients.Any(i => i.Id == requiredIngredientId))
            throw new InvalidOperationException($"Required ingredient {requiredIngredientId} must be in MandatoryIngredients");

        var prohibitedIds = _prohibitedIngredients.Select(i => i.Id).ToHashSet();
        var invalidSubstitutes = substituteIngredientIds.Where(id => prohibitedIds.Contains(id)).ToList();
        if (invalidSubstitutes.Any())
        {
            throw new InvalidOperationException(
                $"Substitute ingredients cannot be in ProhibitedIngredients: {string.Join(", ", invalidSubstitutes)}");
        }
    }

    private static string BuildSlug(string name, Guid recipeId)
    {
        var normalized = name.ToLowerInvariant()
            .Replace('ç', 'c')
            .Replace('ğ', 'g')
            .Replace('ı', 'i')
            .Replace('ö', 'o')
            .Replace('ş', 's')
            .Replace('ü', 'u');

        var slugBase = Regex.Replace(normalized, @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slugBase))
            slugBase = "tarif";

        var suffix = recipeId.ToString("N")[..6];
        return $"{slugBase}-{suffix}";
    }
}
