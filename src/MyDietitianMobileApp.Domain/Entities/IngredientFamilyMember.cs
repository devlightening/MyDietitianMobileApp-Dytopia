using System;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class IngredientFamilyMember
{
    public Guid FamilyId { get; private set; }
    public Guid IngredientId { get; private set; }
    public IngredientFamilyMemberRole Role { get; private set; }

    // Navigation
    public IngredientFamily Family { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private IngredientFamilyMember() { } // EF Constructor

    public IngredientFamilyMember(Guid familyId, Guid ingredientId, IngredientFamilyMemberRole role)
    {
        FamilyId = familyId;
        IngredientId = ingredientId;
        Role = role;
    }

    public void UpdateRole(IngredientFamilyMemberRole role)
    {
        Role = role;
    }
}
