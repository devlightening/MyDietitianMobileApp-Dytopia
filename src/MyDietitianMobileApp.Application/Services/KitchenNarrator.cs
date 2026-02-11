namespace MyDietitianMobileApp.Application.Services;

public class KitchenNarrator : IKitchenNarrator
{
    public string BuildMotivationText(MatchStatus status, int score, MissingInfo? missing, string recipeName)
    {
        return status switch
        {
            MatchStatus.FullMatch => $"Harika! {recipeName} için tüm zorunlu malzemeler hazır. (Opsiyonel eşleşme: {score})",
            MatchStatus.OneMissing when missing != null => $"Neredeyse hazır! Eksik: {missing.IngredientName}. {(missing.SuggestedSubstitutes.Any() ? $"Alternatif: {string.Join(", ", missing.SuggestedSubstitutes.Take(2))}" : "Alternatif bulunamadı.")}",
            _ => $"{recipeName} için hazırsınız!"
        };
    }
}
