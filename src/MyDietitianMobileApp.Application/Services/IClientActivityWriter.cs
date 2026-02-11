namespace MyDietitianMobileApp.Application.Services;

public interface IClientActivityWriter
{
    Task WriteAsync(Guid clientId, Guid? dietitianId, string type, object? metadata = null);
}
