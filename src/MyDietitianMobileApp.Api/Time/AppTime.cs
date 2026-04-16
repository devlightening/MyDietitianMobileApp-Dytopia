namespace MyDietitianMobileApp.Api.Time;

public static class AppTime
{
    private static readonly Lazy<TimeZoneInfo> IstanbulTimeZone = new(ResolveIstanbulTimeZone);

    public static DateTime UtcNow => DateTime.UtcNow;

    public static DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, IstanbulTimeZone.Value);

    public static DateOnly LocalToday => DateOnly.FromDateTime(LocalNow);

    public static TimeOnly LocalTimeNow => TimeOnly.FromDateTime(LocalNow);

    public static DateTime EnsureUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    public static DateTime? EnsureUtc(DateTime? value) =>
        value.HasValue ? EnsureUtc(value.Value) : null;

    public static DateTime ToStoredPlanDate(DateOnly date) =>
        DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

    public static DateOnly ToPlanDateOnly(DateTime storedDate) =>
        DateOnly.FromDateTime(storedDate);

    public static (DateTime startUtc, DateTime endUtc) ToStoredDayRange(DateOnly date)
    {
        var start = ToStoredPlanDate(date);
        return (start, start.AddDays(1));
    }

    public static bool CanClientActOnMeal(DateTime storedPlanDate, TimeSpan mealTime)
    {
        var planDate = ToPlanDateOnly(storedPlanDate);
        if (planDate < LocalToday)
        {
            return true;
        }

        if (planDate > LocalToday)
        {
            return false;
        }

        return mealTime <= LocalNow.TimeOfDay;
    }

    public static string FormatDateKey(DateTime storedPlanDate) =>
        ToPlanDateOnly(storedPlanDate).ToString("yyyy-MM-dd");

    public static string FormatTimeKey(TimeSpan time) =>
        TimeOnly.FromTimeSpan(time).ToString("HH:mm");

    private static TimeZoneInfo ResolveIstanbulTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
        }
    }
}
