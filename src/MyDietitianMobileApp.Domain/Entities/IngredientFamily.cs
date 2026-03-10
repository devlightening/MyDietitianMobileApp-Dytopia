using System;

namespace MyDietitianMobileApp.Domain.Entities;

public class IngredientFamily
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public ICollection<IngredientFamilyMember> Members { get; private set; } = new List<IngredientFamilyMember>();

    private IngredientFamily() { } // EF Constructor

    public IngredientFamily(Guid id, string name, string? description = null, int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty", nameof(name));
            
        Id = id;
        Name = name.Trim();
        Description = description?.Trim();
        IsActive = true;
        SortOrder = sortOrder;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string name, string? description, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty", nameof(name));

        Name = name.Trim();
        Description = description?.Trim();
        SortOrder = sortOrder;
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
