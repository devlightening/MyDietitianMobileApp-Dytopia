using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class UserAccount
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // "Dietitian" or "Client"
        public string? FullName { get; set; }
        public Guid? LinkedDietitianId { get; set; } // For Dietitian
        public Guid? LinkedClientId { get; set; } // For Client
        public Guid? ActiveDietitianContextId { get; set; } // For Client context
        public string PublicUserId { get; private set; } = string.Empty;
        public string SecurityStamp { get; set; } = SecurityStampGenerator.Create();
        public DateTime? PasswordChangedAtUtc { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }

        public UserAccount() { }

        public UserAccount(Guid id, string email, string passwordHash, string role, string? fullName = null)
        {
            Id = id;
            Email = email;
            PasswordHash = passwordHash;
            Role = role;
            FullName = fullName;
        }

        public void SetPublicUserId(string publicUserId)
        {
            if (!string.IsNullOrEmpty(PublicUserId))
                throw new InvalidOperationException("PublicUserId cannot be changed once set");
            PublicUserId = publicUserId;
        }

        public void EnsureSecurityStamp()
        {
            if (string.IsNullOrWhiteSpace(SecurityStamp))
            {
                SecurityStamp = SecurityStampGenerator.Create();
            }
        }

        public void RotateSecurityStamp()
        {
            SecurityStamp = SecurityStampGenerator.Create();
        }
    }

    public class AuthDbContext : DbContext
    {
        public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }
        public DbSet<UserAccount> UserAccounts { get; set; }
    }

    public class PasswordHasherService
    {
        private readonly PasswordHasher<UserAccount> _hasher = new();
        
        public string HashPassword(string password) 
        {
            return _hasher.HashPassword(null!, password);
        }
        
        public bool VerifyPassword(string hashedPassword, string password) 
        {
            var result = _hasher.VerifyHashedPassword(null!, hashedPassword, password);
            return result == PasswordVerificationResult.Success;
        }
    }
}
