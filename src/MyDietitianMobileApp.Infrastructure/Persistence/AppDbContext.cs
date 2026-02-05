using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class AppDbContext : DbContext
    {
        public DbSet<Dietitian> Dietitians { get; set; }
        public DbSet<Client> Clients { get; set; }
        public DbSet<Recipe> Recipes { get; set; }
        public DbSet<Ingredient> Ingredients { get; set; }
        public DbSet<AccessKey> AccessKeys { get; set; }
        
        // FAZ 3: Permanent Binding & Measurements
        public DbSet<DietitianClientLink> DietitianClientLinks { get; set; }
        public DbSet<UserMeasurement> UserMeasurements { get; set; }

        // Meal Plan System (API-PLAN-01)
        public DbSet<MealPlan> MealPlans { get; set; }
        public DbSet<PlanMealItem> PlanMealItems { get; set; }
        public DbSet<MealCompletion> MealCompletions { get; set; }
        
        // Compliance tracking entities
        public DbSet<DietPlan> DietPlans { get; set; }
        public DbSet<DietPlanDay> DietPlanDays { get; set; }
        public DbSet<DietPlanMeal> DietPlanMeals { get; set; }
        public DbSet<MealItem> MealItems { get; set; }
        public DbSet<MealItemCompliance> MealItemCompliance { get; set; }
        public DbSet<ComplianceScoreConfig> ComplianceScoreConfigs { get; set; }
        public DbSet<MealCompliance> MealCompliances { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Client configuration
            modelBuilder.Entity<Client>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.FullName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Email).HasMaxLength(255);
                
                entity.HasIndex(e => e.ActiveDietitianId);
            });

            // Dietitian configuration
            modelBuilder.Entity<Dietitian>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.FullName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.ClinicName).HasMaxLength(200);
            });

            // DietitianClientLink configuration
            modelBuilder.Entity<DietitianClientLink>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.DietitianId, e.ClientId });
                entity.HasIndex(e => e.IsActive);
            });

            // Recipe configuration
            modelBuilder.Entity<Recipe>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.HasIndex(e => e.DietitianId);
            });

            // UserMeasurement configuration
            modelBuilder.Entity<UserMeasurement>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.ClientId, e.CreatedAt });
            });

            // Multi-tenant filtering: DietitianId on relevant entities
            // modelBuilder.Entity<Client>() // Replaced by more comprehensive config above
            //     .HasIndex(c => c.ActiveDietitianId);
            // modelBuilder.Entity<Recipe>() // Replaced by more comprehensive config above
            //     .HasIndex(r => r.DietitianId);
            modelBuilder.Entity<AccessKey>()
                .HasIndex(a => new { a.DietitianId, a.ClientId });

            // ===== MEAL PLAN SYSTEM (API-PLAN-01) =====
            
            // MealPlan configuration
            modelBuilder.Entity<MealPlan>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.Property(e => e.Date)
                    .IsRequired()
                    .HasColumnType("date"); // Store as date only
                
                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasConversion<string>()
                    .HasMaxLength(20);
                
                entity.Property(e => e.CreatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");
                
                entity.Property(e => e.UpdatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");
                
                // Indexes for performance
                entity.HasIndex(e => new { e.ClientId, e.Date })
                    .HasDatabaseName("IX_MealPlans_ClientId_Date");
                
                entity.HasIndex(e => e.Status)
                    .HasDatabaseName("IX_MealPlans_Status");
                
                // Relationships
                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasOne(e => e.Creator)
                    .WithMany()
                    .HasForeignKey(e => e.CreatedBy)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasMany(e => e.Items)
                    .WithOne(i => i.Plan)
                    .HasForeignKey(i => i.PlanId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // PlanMealItem configuration
            modelBuilder.Entity<PlanMealItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.Property(e => e.Time)
                    .IsRequired()
                    .HasColumnType("time");
                
                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(200);
                
                entity.Property(e => e.Note)
                    .HasMaxLength(1000);
                
                entity.Property(e => e.ProteinGrams)
                    .HasPrecision(5, 1);
                
                entity.Property(e => e.CarbsGrams)
                    .HasPrecision(5, 1);
                
                entity.Property(e => e.FatGrams)
                    .HasPrecision(5, 1);
                
                entity.Property(e => e.CreatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");
                
                // Indexes
                entity.HasIndex(e => e.PlanId)
                    .HasDatabaseName("IX_PlanMealItems_PlanId");
                
                entity.HasIndex(e => e.Time)
                    .HasDatabaseName("IX_PlanMealItems_Time");
                
                // Relationships
                entity.HasOne(e => e.Plan)
                    .WithMany(p => p.Items)
                    .HasForeignKey(e => e.PlanId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasOne(e => e.Completion)
                    .WithOne(c => c.PlanMealItem)
                    .HasForeignKey<MealCompletion>(c => c.PlanMealItemId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // MealCompletion configuration
            modelBuilder.Entity<MealCompletion>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.Property(e => e.CompletedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");
                
                entity.Property(e => e.Source)
                    .IsRequired()
                    .HasConversion<string>()
                    .HasMaxLength(20);
                
                // Unique constraint: one completion per meal item per client
                entity.HasIndex(e => new { e.ClientId, e.PlanMealItemId })
                    .IsUnique()
                    .HasDatabaseName("UQ_MealCompletions_Client_MealItem");
                
                // Indexes
                entity.HasIndex(e => e.ClientId)
                    .HasDatabaseName("IX_MealCompletions_ClientId");
                
                entity.HasIndex(e => e.PlanMealItemId)
                    .HasDatabaseName("IX_MealCompletions_PlanMealItemId");
                
                // Relationships
                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasOne(e => e.PlanMealItem)
                    .WithOne(i => i.Completion)
                    .HasForeignKey<MealCompletion>(e => e.PlanMealItemId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ============================================
            // Compliance Tracking Configuration
            // ============================================

            // DietPlan
            modelBuilder.Entity<DietPlan>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.ClientId);
                entity.HasIndex(e => new { e.ClientId, e.Status });
                
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.StartDate).IsRequired();
                entity.Property(e => e.EndDate).IsRequired();
                entity.Property(e => e.Status).IsRequired();

                // Navigation property mapping (backing field)
                entity.HasMany<DietPlanDay>()
                    .WithOne()
                    .HasForeignKey(d => d.DietPlanId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.Metadata.FindNavigation(nameof(DietPlan.Days))!
                    .SetPropertyAccessMode(PropertyAccessMode.Field);
            });

            // DietPlanDay
            modelBuilder.Entity<DietPlanDay>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DietPlanId);
                
                // Unique constraint: One day per plan per date
                entity.HasIndex(e => new { e.DietPlanId, e.Date })
                    .IsUnique();

                // DateOnly mapping for PostgreSQL
                entity.Property(e => e.Date)
                    .IsRequired()
                    .HasConversion(
                        d => d.ToDateTime(TimeOnly.MinValue),
                        d => DateOnly.FromDateTime(d));

                // Navigation property mapping
                entity.HasMany<DietPlanMeal>()
                    .WithOne()
                    .HasForeignKey(m => m.DietPlanDayId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.Metadata.FindNavigation(nameof(DietPlanDay.Meals))!
                    .SetPropertyAccessMode(PropertyAccessMode.Field);
            });

            // DietPlanMeal
            modelBuilder.Entity<DietPlanMeal>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DietPlanDayId);
                entity.HasIndex(e => new { e.DietPlanDayId, e.Type });

                entity.Property(e => e.Type).IsRequired();
                entity.Property(e => e.CustomName).HasMaxLength(200);

                // Navigation property mapping
                entity.HasMany<MealItem>()
                    .WithOne()
                    .HasForeignKey(mi => mi.MealId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.Metadata.FindNavigation(nameof(DietPlanMeal.Items))!
                    .SetPropertyAccessMode(PropertyAccessMode.Field);
            });

            // MealItem
            modelBuilder.Entity<MealItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.MealId);
                entity.HasIndex(e => e.IngredientId);

                entity.Property(e => e.IsMandatory).IsRequired();
                entity.Property(e => e.Amount).HasPrecision(10, 2);
                entity.Property(e => e.Unit).HasMaxLength(50);
            });

            // MealItemCompliance ⭐ CORE TABLE
            modelBuilder.Entity<MealItemCompliance>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                // Critical indexes for performance
                entity.HasIndex(e => new { e.ClientId, e.MarkedAt });
                entity.HasIndex(e => new { e.ClientId, e.DietPlanId });
                entity.HasIndex(e => e.MarkedAt);
                entity.HasIndex(e => e.DietDayId);
                entity.HasIndex(e => e.MealId);

                entity.Property(e => e.Status).IsRequired();
                entity.Property(e => e.MarkedAt).IsRequired();

                // 🔴 IDEMPOTENT CONSTRAINT: Same client, same meal item, same day = UPDATE, not INSERT
                entity.HasIndex(e => new { e.ClientId, e.MealItemId, e.DietDayId })
                    .IsUnique();

                // Relationships
                entity.HasOne<Client>()
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne<DietPlan>()
                    .WithMany()
                    .HasForeignKey(e => e.DietPlanId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne<DietPlanDay>()
                    .WithMany()
                    .HasForeignKey(e => e.DietDayId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne<DietPlanMeal>()
                    .WithMany()
                    .HasForeignKey(e => e.MealId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne<MealItem>()
                    .WithMany()
                    .HasForeignKey(e => e.MealItemId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne<Ingredient>()
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ComplianceScoreConfig
            modelBuilder.Entity<ComplianceScoreConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.DietPlanId);
                
                // Unique constraint: One config per dietitian (default) or per plan
                entity.HasIndex(e => new { e.DietitianId, e.DietPlanId })
                    .IsUnique();

                entity.Property(e => e.MandatoryDone).IsRequired().HasDefaultValue(10);
                entity.Property(e => e.MandatoryAlternative).IsRequired().HasDefaultValue(7);
                entity.Property(e => e.MandatorySkipped).IsRequired().HasDefaultValue(0);
                entity.Property(e => e.OptionalDone).IsRequired().HasDefaultValue(3);
                entity.Property(e => e.OptionalSkipped).IsRequired().HasDefaultValue(0);
            });

            // Ingredient
            modelBuilder.Entity<Ingredient>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.CanonicalName);
                entity.HasIndex(e => e.IsActive);

                entity.Property(e => e.CanonicalName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Name).HasMaxLength(200); // Legacy field
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
                
                // Map Aliases as JSON array (PostgreSQL)
                // EF Core will serialize/deserialize the collection automatically
                entity.Property(e => e.Aliases)
                    .HasConversion(
                        v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                        v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                    .HasColumnType("jsonb");
            });

            // Note: Recipe-Ingredient many-to-many relationships are configured automatically
            // by EF Core via Recipe entity's navigation properties (MandatoryIngredients, OptionalIngredients, ProhibitedIngredients).
            // Note: Navigation properties (Days, Meals, Items) are configured
            // via HasMany/WithOne above. EF Core will handle the relationships automatically.
        }
    }
}
