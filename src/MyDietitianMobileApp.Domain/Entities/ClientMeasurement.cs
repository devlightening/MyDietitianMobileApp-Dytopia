namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Unified measurement snapshot for a client.
/// Replaces the disconnected ClientWeightEntry + ClientMeasurementEntry model with a single,
/// source-tagged, historically tracked record that supports both self-reported and clinical entries.
/// </summary>
public class ClientMeasurement
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }

    /// <summary>When the measurement was physically taken (may differ from CreatedAtUtc for historical entry).</summary>
    public DateTime RecordedAtUtc { get; private set; }

    /// <summary>Who recorded this measurement: "client" | "dietitian" | "smart_scale" | "system"</summary>
    public string SourceType { get; private set; } = "client";

    /// <summary>User ID of the person who entered the record. Nullable for system/import entries.</summary>
    public Guid? RecordedByUserId { get; private set; }

    // ── Body metrics ──────────────────────────────────────────────────────────
    public decimal? WeightKg { get; private set; }
    public decimal? HeightCm { get; private set; }
    public decimal? BodyFatPercent { get; private set; }
    public decimal? MusclePercent { get; private set; }
    public decimal? WaterPercent { get; private set; }
    public decimal? WaistCm { get; private set; }
    public decimal? HipCm { get; private set; }
    public decimal? ChestCm { get; private set; }

    // ── Computed / snapshot fields (calculated at save time for reporting stability) ──
    public decimal? Bmi { get; private set; }
    public string? BmiCategory { get; private set; }

    /// <summary>Basal Metabolic Rate — computed by controller (needs age + gender from profile).</summary>
    public decimal? Bmr { get; private set; }
    public decimal? WaistHipRatio { get; private set; }

    // ── Metadata ─────────────────────────────────────────────────────────────
    public string? Notes { get; private set; }

    /// <summary>True when a dietitian has verified this record in a clinical setting.</summary>
    public bool IsClinicallyVerified { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientMeasurement() { } // EF Core

    public ClientMeasurement(
        Guid clientId,
        string sourceType,
        Guid? recordedByUserId,
        DateTime? recordedAtUtc,
        decimal? weightKg,
        decimal? heightCm,
        decimal? bodyFatPercent,
        decimal? musclePercent,
        decimal? waterPercent,
        decimal? waistCm,
        decimal? hipCm,
        decimal? chestCm,
        decimal? bmr,
        string? notes,
        bool isClinicallyVerified)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        SourceType = sourceType;
        RecordedByUserId = recordedByUserId;
        RecordedAtUtc = recordedAtUtc ?? DateTime.UtcNow;
        WeightKg = weightKg;
        HeightCm = heightCm;
        BodyFatPercent = bodyFatPercent;
        MusclePercent = musclePercent;
        WaterPercent = waterPercent;
        WaistCm = waistCm;
        HipCm = hipCm;
        ChestCm = chestCm;
        Bmr = bmr;
        Notes = notes;
        IsClinicallyVerified = isClinicallyVerified;
        CreatedAtUtc = DateTime.UtcNow;
        ComputeDerived();
    }

    public void Update(
        decimal? weightKg,
        decimal? heightCm,
        decimal? bodyFatPercent,
        decimal? musclePercent,
        decimal? waterPercent,
        decimal? waistCm,
        decimal? hipCm,
        decimal? chestCm,
        decimal? bmr,
        string? notes,
        bool isClinicallyVerified)
    {
        WeightKg = weightKg;
        HeightCm = heightCm;
        BodyFatPercent = bodyFatPercent;
        MusclePercent = musclePercent;
        WaterPercent = waterPercent;
        WaistCm = waistCm;
        HipCm = hipCm;
        ChestCm = chestCm;
        Bmr = bmr;
        Notes = notes;
        IsClinicallyVerified = isClinicallyVerified;
        ComputeDerived();
    }

    /// <summary>
    /// Compute BMI + BmiCategory + WaistHipRatio from the current field values.
    /// Called on construction and after Update().
    /// </summary>
    private void ComputeDerived()
    {
        if (WeightKg.HasValue && HeightCm.HasValue && HeightCm > 0)
        {
            var heightM = (double)HeightCm.Value / 100.0;
            var bmi = (double)WeightKg.Value / (heightM * heightM);
            Bmi = Math.Round((decimal)bmi, 1);
            BmiCategory = GetBmiCategory(bmi);
        }
        else
        {
            Bmi = null;
            BmiCategory = null;
        }

        WaistHipRatio = (WaistCm.HasValue && HipCm.HasValue && HipCm > 0)
            ? Math.Round(WaistCm.Value / HipCm.Value, 2)
            : null;
    }

    private static string GetBmiCategory(double bmi) => bmi switch
    {
        < 18.5 => "Zayıf",
        < 25.0 => "Normal",
        < 30.0 => "Fazla kilolu",
        < 35.0 => "Obez (S1)",
        < 40.0 => "Obez (S2)",
        _      => "Morbid obez"
    };

    // ── Static helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Compute Basal Metabolic Rate using the Mifflin-St Jeor equation.
    /// Returns null if any required value is missing or invalid.
    /// </summary>
    public static decimal? ComputeBmr(decimal? weightKg, decimal? heightCm, int? ageYears, int? gender)
    {
        if (!weightKg.HasValue || !heightCm.HasValue || !ageYears.HasValue || !gender.HasValue)
            return null;

        // Gender enum: Male=0 → +5, Female=1 → -161 (Mifflin-St Jeor)
        double bmr = (10.0 * (double)weightKg.Value)
                   + (6.25 * (double)heightCm.Value)
                   - (5.0 * ageYears.Value)
                   + (gender.Value == 0 ? 5.0 : -161.0);

        return bmr > 0 ? Math.Round((decimal)bmr, 0) : null;
    }
}
