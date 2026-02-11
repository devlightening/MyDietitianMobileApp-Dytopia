using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities
{
    public class Client
    {
        public override bool Equals(object obj)
        {
            if (obj is not Client other) return false;
            return Id == other.Id;
        }
        public override int GetHashCode() => Id.GetHashCode();
        
        public Guid Id { get; private set; }
        public string FullName { get; private set; }
        public string Email { get; private set; }
        public Gender Gender { get; private set; }
        public DateOnly BirthDate { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public Guid? ActiveDietitianId { get; private set; }
        public DateTime? PremiumActivatedAt { get; private set; }
        public DateTime? ProgramStartDate { get; private set; }
        public DateTime? ProgramEndDate { get; private set; }
        public bool IsActive { get; private set; }
        
        // Computed properties
        public bool IsPremium => ActiveDietitianId.HasValue;
        public int Age => CalculateAge(BirthDate);
        
        public IReadOnlyCollection<AccessKey> AccessKeys => _accessKeys.AsReadOnly();

        private readonly List<AccessKey> _accessKeys = new();

        public Client(Guid id, string fullName, string email, Gender gender, DateOnly birthDate, bool isActive = true)
        {
            Id = id;
            FullName = fullName;
            Email = email;
            Gender = gender;
            BirthDate = birthDate;
            CreatedAt = DateTime.UtcNow;
            IsActive = isActive;
        }
        
        private static int CalculateAge(DateOnly birthDate)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var age = today.Year - birthDate.Year;
            if (birthDate > today.AddYears(-age)) age--;
            return age;
        }

        public void SetActiveDietitian(Guid dietitianId, DateTime startDate, DateTime endDate)
        {
            ActiveDietitianId = dietitianId;
            ProgramStartDate = startDate;
            ProgramEndDate = endDate;
        }

        public void Activate() => IsActive = true;
        public void Deactivate() => IsActive = false;

        public void ActivatePremium(Guid dietitianId, DateTime? startDate = null, DateTime? endDate = null)
        {
            ActiveDietitianId = dietitianId;
            PremiumActivatedAt = DateTime.UtcNow;
            ProgramStartDate = startDate;
            ProgramEndDate = endDate;
        }

        public void RevokePremium(DateTime revokedAtUtc)
        {
            // Keep historical dates for reporting, but clear active dietitian context
            ActiveDietitianId = null;
            // If program was open-ended or in the future, mark it as ended now
            if (ProgramEndDate == null || ProgramEndDate > revokedAtUtc)
            {
                ProgramEndDate = revokedAtUtc;
            }
        }

        public void AddAccessKey(AccessKey key)
        {
            if (_accessKeys.Any(k => k.Id == key.Id))
                return;
            if (key.IsActive && _accessKeys.Any(k => k.IsActive && k.DietitianId == key.DietitianId))
                throw new InvalidOperationException("Only one active access key is allowed per client-dietitian pair.");
            _accessKeys.Add(key);
        }
    }
}
