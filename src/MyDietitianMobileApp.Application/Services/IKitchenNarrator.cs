namespace MyDietitianMobileApp.Application.Services;

public enum MatchStatus
{
    FullMatch,
    OneMissing
}

public record MissingInfo(string IngredientName, List<string> SuggestedSubstitutes);

public interface IKitchenNarrator
{
    string BuildMotivationText(MatchStatus status, int score, MissingInfo? missing, string recipeName);
}
