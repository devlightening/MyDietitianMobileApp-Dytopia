using System.Globalization;
using System.Text;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Services;

public static class IngredientAcquisitionPolicy
{
    public static bool RequiresConfirmation(
        AcquisitionSource source,
        MappingType mappingType,
        double confidence)
    {
        if (mappingType is MappingType.CompositeProduct or MappingType.Unresolved)
        {
            return true;
        }

        return source switch
        {
            AcquisitionSource.Text => false,
            AcquisitionSource.Barcode when mappingType == MappingType.ExactIngredient => confidence < 0.90d,
            AcquisitionSource.Barcode when mappingType == MappingType.IngredientFamily => confidence < 0.93d,
            AcquisitionSource.Vision when mappingType == MappingType.ExactIngredient => confidence < 0.85d,
            _ => true,
        };
    }

    public static bool CanAutoAdd(
        AcquisitionSource source,
        MappingType mappingType,
        double confidence)
        => !RequiresConfirmation(source, mappingType, confidence);

    public static string NormalizeLookupKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(trimmed.Length);

        foreach (var rune in trimmed.EnumerateRunes())
        {
            var category = Rune.GetUnicodeCategory(rune);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(rune.ToString());
        }

        return builder
            .ToString()
            .Replace('ı', 'i')
            .Replace('ş', 's')
            .Replace('ğ', 'g')
            .Replace('ü', 'u')
            .Replace('ö', 'o')
            .Replace('ç', 'c');
    }
}
