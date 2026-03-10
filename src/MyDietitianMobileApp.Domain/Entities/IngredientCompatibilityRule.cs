using System;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class IngredientCompatibilityRule
{
    public Guid Id { get; private set; }
    public Guid RequiredIngredientId { get; private set; }
    public Guid CandidateIngredientId { get; private set; }
    public CompatibilityType CompatibilityType { get; private set; }
    public decimal? ScorePenalty { get; private set; }
    public string? Reason { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Ingredient RequiredIngredient { get; private set; } = null!;
    public Ingredient CandidateIngredient { get; private set; } = null!;

    private IngredientCompatibilityRule() { } // EF Constructor

    public IngredientCompatibilityRule(
        Guid id, 
        Guid requiredIngredientId, 
        Guid candidateIngredientId, 
        CompatibilityType compatibilityType,
        decimal? scorePenalty = null,
        string? reason = null)
    {
        Id = id;
        RequiredIngredientId = requiredIngredientId;
        CandidateIngredientId = candidateIngredientId;
        CompatibilityType = compatibilityType;
        ScorePenalty = scorePenalty;
        Reason = reason?.Trim();
        IsActive = true;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(CompatibilityType compatibilityType, decimal? scorePenalty, string? reason)
    {
        CompatibilityType = compatibilityType;
        ScorePenalty = scorePenalty;
        Reason = reason?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetActive(bool isActive)
    {
        if (IsActive != isActive)
        {
            IsActive = isActive;
            UpdatedAtUtc = DateTime.UtcNow;
        }
    }
}
