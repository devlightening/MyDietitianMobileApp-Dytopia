namespace MyDietitianMobileApp.Domain.Enums;

/// <summary>
/// Resolution granularity for mapping a raw acquisition signal into the canonical ingredient space.
/// </summary>
public enum MappingType
{
    ExactIngredient = 0,
    IngredientFamily = 1,
    CompositeProduct = 2,
    Unresolved = 3,
}
