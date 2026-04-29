using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Api.Features;

public sealed record CoachTaskDescriptor(
    string ActionKey,
    string Title,
    string Cta,
    string Body);

public static class CoachTaskCodec
{
    private static readonly Regex TaskPattern = new(
        @"^\[TASK\|(?<action>[A-Z_]+)\|(?<title>[^\|\]]+)\|(?<cta>[^\]]+)\]\s*(?<body>.+)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static bool TryParse(string? text, out CoachTaskDescriptor? task)
    {
        task = null;
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var match = TaskPattern.Match(text.Trim());
        if (!match.Success)
            return false;

        task = new CoachTaskDescriptor(
            match.Groups["action"].Value.Trim(),
            match.Groups["title"].Value.Trim(),
            match.Groups["cta"].Value.Trim(),
            match.Groups["body"].Value.Trim());
        return true;
    }
}
