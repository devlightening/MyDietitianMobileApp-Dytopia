namespace MyDietitianMobileApp.Domain.Entities;

public class ClientMeasurementEntry
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public DateTime AtUtc { get; private set; }
    public decimal? WaistCm { get; private set; }
    public decimal? HipCm { get; private set; }
    public decimal? ChestCm { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientMeasurementEntry() { } // EF Core

    public ClientMeasurementEntry(Guid clientId, DateTime atUtc, decimal? waistCm, decimal? hipCm, decimal? chestCm)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        AtUtc = atUtc;
        WaistCm = waistCm;
        HipCm = hipCm;
        ChestCm = chestCm;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(decimal? waistCm, decimal? hipCm, decimal? chestCm)
    {
        WaistCm = waistCm;
        HipCm = hipCm;
        ChestCm = chestCm;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
