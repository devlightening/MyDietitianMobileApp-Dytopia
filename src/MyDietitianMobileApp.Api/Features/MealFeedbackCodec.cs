using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Api.Features;

public static class MealFeedbackCodec
{
    private static readonly Regex FeedbackPattern = new(
        @"\[\[feedback:(?<key>[a-z_]+)\]\]",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static bool TryParse(string? note, out string? feedbackKey)
    {
        feedbackKey = null;
        if (string.IsNullOrWhiteSpace(note))
            return false;

        var match = FeedbackPattern.Match(note);
        if (!match.Success)
            return false;

        feedbackKey = match.Groups["key"].Value.Trim().ToLowerInvariant();
        return !string.IsNullOrWhiteSpace(feedbackKey);
    }

    public static string Apply(string? existingNote, string feedbackKey)
    {
        var cleaned = Strip(existingNote);
        return string.IsNullOrWhiteSpace(cleaned)
            ? $"[[feedback:{feedbackKey.Trim().ToLowerInvariant()}]]"
            : $"{cleaned}\n[[feedback:{feedbackKey.Trim().ToLowerInvariant()}]]";
    }

    public static string? Strip(string? note)
    {
        if (string.IsNullOrWhiteSpace(note))
            return null;

        var cleaned = FeedbackPattern.Replace(note, string.Empty).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
