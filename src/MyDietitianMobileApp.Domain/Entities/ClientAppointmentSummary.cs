namespace MyDietitianMobileApp.Domain.Entities;

public class ClientAppointmentSummary
{
    public const string AttendancePending = "pending";
    public const string AttendanceAttended = "attended";
    public const string AttendanceMissed = "missed";

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateTime ScheduledAtUtc { get; private set; }
    public string Mode { get; private set; } = "online";
    public string? Location { get; private set; }
    public string? Note { get; private set; }
    public bool IsCancelled { get; private set; }
    public string AttendanceStatus { get; private set; } = AttendancePending;
    public DateTime? AttendanceMarkedAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;
    public Dietitian? Dietitian { get; private set; }

    private ClientAppointmentSummary() { }

    public ClientAppointmentSummary(
        Guid clientId,
        Guid? dietitianId,
        string title,
        DateTime scheduledAtUtc,
        string mode,
        string? location,
        string? note)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        Title = string.IsNullOrWhiteSpace(title) ? "Check-in" : title.Trim();
        ScheduledAtUtc = DateTime.SpecifyKind(scheduledAtUtc, DateTimeKind.Utc);
        Mode = string.IsNullOrWhiteSpace(mode) ? "online" : mode.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        AttendanceStatus = AttendancePending;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateDetails(string title, DateTime scheduledAtUtc, string mode, string? location, string? note)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Check-in" : title.Trim();
        ScheduledAtUtc = DateTime.SpecifyKind(scheduledAtUtc, DateTimeKind.Utc);
        Mode = string.IsNullOrWhiteSpace(mode) ? "online" : mode.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public void Cancel()
    {
        IsCancelled = true;
    }

    public void MarkAttendance(string status)
    {
        var normalized = string.IsNullOrWhiteSpace(status)
            ? AttendancePending
            : status.Trim().ToLowerInvariant();

        if (normalized != AttendanceAttended && normalized != AttendanceMissed)
        {
            throw new ArgumentOutOfRangeException(nameof(status), "Unsupported appointment attendance status.");
        }

        AttendanceStatus = normalized;
        AttendanceMarkedAtUtc = DateTime.UtcNow;
    }
}
