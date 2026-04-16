namespace MyDietitianMobileApp.Infrastructure.Services;

public static class SecurityStampGenerator
{
    public static string Create() => Guid.NewGuid().ToString("N");
}
