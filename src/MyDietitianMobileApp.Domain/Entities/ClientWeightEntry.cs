namespace MyDietitianMobileApp.Domain.Entities;

public class ClientWeightEntry
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public DateTime AtUtc { get; private set; }
    public decimal WeightKg { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientWeightEntry() { } // EF Core

    public ClientWeightEntry(Guid clientId, DateTime atUtc, decimal weightKg)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        AtUtc = atUtc;
        WeightKg = weightKg;
    }
}
