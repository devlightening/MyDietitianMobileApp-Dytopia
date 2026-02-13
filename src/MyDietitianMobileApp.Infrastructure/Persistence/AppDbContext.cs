using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
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
        public DbSet<ClientPantryItem> ClientPantryItems { get; set; }
        public DbSet<PremiumAuditLog> PremiumAuditLogs { get; set; }
        public DbSet<RecipeIngredientSubstitute> RecipeIngredientSubstitutes { get; set; }
        public DbSet<ClientProhibitedIngredient> ClientProhibitedIngredients { get; set; }
        public DbSet<IngredientPack> IngredientPacks { get; set; }
        public DbSet<IngredientPackItem> IngredientPackItems { get; set; }
        
        // EPIC E: Progress tracking
        public DbSet<ClientDailyTracking> ClientDailyTrackings { get; set; }
        public DbSet<ClientWeightEntry> ClientWeightEntries { get; set; }
        public DbSet<ClientMeasurementEntry> ClientMeasurementEntries { get; set; }
        public DbSet<ClientActivity> ClientActivities { get; set; }
        public DbSet<MealCompletion> MealCompletions { get; set; }
        public DbSet<DailyComplianceSnapshot> DailyComplianceSnapshots { get; set; }
        public DbSet<DietitianBrandingConfig> DietitianBrandingConfigs { get; set; }
        public DbSet<DietitianNote> DietitianNotes { get; set; }
        
        // FAZ 3: Permanent Binding & Measurements
        public DbSet<DietitianClientLink> DietitianClientLinks { get; set; }
        public DbSet<UserMeasurement> UserMeasurements { get; set; }

        // Meal Plan System (API-PLAN-01)
        public DbSet<MealPlan> MealPlans { get; set; }
        public DbSet<PlanMealItem> PlanMealItems { get; set; }
        
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
            });

            // Recipe configuration with explicit many-to-many mappings to avoid shadow FK warnings
            modelBuilder.Entity<Recipe>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.IsPublic);

                // Explicit many-to-many: Recipe <-> Ingredient (MandatoryIngredients)
                entity.HasMany(r => r.MandatoryIngredients)
                    .WithMany()
                    .UsingEntity<Dictionary<string, object>>(
                        "RecipeMandatoryIngredients",
                        j => j.HasOne<Ingredient>().WithMany().HasForeignKey("IngredientId"),
                        j => j.HasOne<Recipe>().WithMany().HasForeignKey("RecipeId"),
                        j => j.HasKey("RecipeId", "IngredientId"));

                // Explicit many-to-many: Recipe <-> Ingredient (OptionalIngredients)
                entity.HasMany(r => r.OptionalIngredients)
                    .WithMany()
                    .UsingEntity<Dictionary<string, object>>(
                        "RecipeOptionalIngredients",
                        j => j.HasOne<Ingredient>().WithMany().HasForeignKey("IngredientId"),
                        j => j.HasOne<Recipe>().WithMany().HasForeignKey("RecipeId"),
                        j => j.HasKey("RecipeId", "IngredientId"));

                // Explicit many-to-many: Recipe <-> Ingredient (ProhibitedIngredients)
                entity.HasMany(r => r.ProhibitedIngredients)
                    .WithMany()
                    .UsingEntity<Dictionary<string, object>>(
                        "RecipeProhibitedIngredients",
                        j => j.HasOne<Ingredient>().WithMany().HasForeignKey("IngredientId"),
                        j => j.HasOne<Recipe>().WithMany().HasForeignKey("RecipeId"),
                        j => j.HasKey("RecipeId", "IngredientId"));
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
                
                // Note: MealCompletion relationship removed (EPIC E uses DietPlanMealId directly, not PlanMealItem navigation)
                // PlanMealItem.Completion is kept for backward compatibility but not mapped in EF
            });

            // MealCompletion configuration (EPIC E)
            modelBuilder.Entity<MealCompletion>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Status)
                    .IsRequired();

                entity.Property(e => e.Note)
                    .HasMaxLength(300);

                entity.Property(e => e.AtUtc)
                    .IsRequired();

                // Unique constraint: one completion per (ClientId, DietPlanMealId)
                entity.HasIndex(e => new { e.ClientId, e.DietPlanMealId })
                    .IsUnique();

                entity.HasIndex(e => new { e.ClientId, e.AtUtc })
                    .IsDescending(false, true); // AtUtc DESC

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Restrict);
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
                entity.Property(e => e.StartDate)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
                entity.Property(e => e.EndDate)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
                entity.Property(e => e.Status).IsRequired();

                // Navigation property mapping (backing field) with explicit FK to avoid shadow FK
                entity.HasMany(d => d.Days)
                    .WithOne(d => d.DietPlan)
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

                // DateOnly mapping for PostgreSQL with UTC enforcement
                entity.Property(e => e.Date)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        d => DateTime.SpecifyKind(d.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                        d => DateOnly.FromDateTime(DateTime.SpecifyKind(d, DateTimeKind.Utc)));

                // Navigation property mapping with explicit FK to avoid shadow FK
                entity.HasMany(d => d.Meals)
                    .WithOne(m => m.DietPlanDay)
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
                
                // Map Aliases as JSON array (PostgreSQL) with ValueComparer to avoid EF warnings
                var aliasesComparer = new ValueComparer<IReadOnlyCollection<string>>(
                    (c1, c2) => c1 != null && c2 != null && c1.SequenceEqual(c2, StringComparer.OrdinalIgnoreCase),
                    c => c != null ? c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode(StringComparison.OrdinalIgnoreCase))) : 0,
                    c => c != null ? c.Select(s => s.Trim().ToLowerInvariant()).Distinct().ToList() : new List<string>());

                var aliasesProperty = entity.Property(e => e.Aliases);
                aliasesProperty.HasConversion(
                        v => System.Text.Json.JsonSerializer.Serialize(
                            v != null ? v.Select(s => s.Trim().ToLowerInvariant()).Distinct().ToList() : new List<string>(),
                            (System.Text.Json.JsonSerializerOptions?)null),
                        v => NormalizeAliasesList(System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null)))
                    .HasColumnType("jsonb");
                aliasesProperty.Metadata.SetValueComparer(aliasesComparer);
            });

            // Client pantry items
            modelBuilder.Entity<ClientPantryItem>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.IngredientId });

                entity.Property(e => e.Quantity)
                    .HasPrecision(10, 2);

                entity.Property(e => e.Unit)
                    .HasMaxLength(50);

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Ingredient)
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => new { e.ClientId, e.UpdatedAtUtc });
            });

            // Premium audit logs
            modelBuilder.Entity<PremiumAuditLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Action)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.AtUtc)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.Property(e => e.MetaJson)
                    .HasColumnType("jsonb")
                    .IsRequired(false);

                entity.HasIndex(e => e.ClientId);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.AtUtc);
            });

            // RecipeIngredientSubstitute configuration (explicit join table, no shadow FK)
            modelBuilder.Entity<RecipeIngredientSubstitute>(entity =>
            {
                entity.HasKey(e => new { e.RecipeId, e.RequiredIngredientId, e.SubstituteIngredientId });

                entity.HasIndex(e => e.RecipeId);
                entity.HasIndex(e => new { e.RecipeId, e.RequiredIngredientId });

                entity.HasOne(e => e.Recipe)
                    .WithMany()
                    .HasForeignKey(e => e.RecipeId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.RequiredIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.RequiredIngredientId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.SubstituteIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.SubstituteIngredientId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ClientProhibitedIngredient configuration
            modelBuilder.Entity<ClientProhibitedIngredient>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.IngredientId });

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => e.ClientId);
                entity.HasIndex(e => new { e.ClientId, e.CreatedAtUtc });

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Ingredient)
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // IngredientPack configuration
            modelBuilder.Entity<IngredientPack>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.HasIndex(e => e.IsSystem);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => new { e.IsSystem, e.SortOrder });

                entity.HasMany(e => e.Items)
                    .WithOne(i => i.Pack)
                    .HasForeignKey(i => i.PackId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // IngredientPackItem configuration
            modelBuilder.Entity<IngredientPackItem>(entity =>
            {
                entity.HasKey(e => new { e.PackId, e.IngredientId });

                entity.HasOne(e => e.Pack)
                    .WithMany(p => p.Items)
                    .HasForeignKey(e => e.PackId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Ingredient)
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // EPIC E: ClientDailyTracking configuration
            modelBuilder.Entity<ClientDailyTracking>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.Date });

                entity.Property(e => e.Date)
                    .HasColumnType("date"); // PostgreSQL date type

                entity.Property(e => e.WaterGlasses)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.Steps)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.Notes)
                    .HasMaxLength(500);

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => new { e.ClientId, e.Date })
                    .IsDescending(false, true); // Date DESC

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ClientWeightEntry configuration
            modelBuilder.Entity<ClientWeightEntry>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.WeightKg)
                    .HasPrecision(5, 2)
                    .IsRequired();

                entity.Property(e => e.AtUtc)
                    .IsRequired();

                entity.HasIndex(e => new { e.ClientId, e.AtUtc })
                    .IsDescending(false, true); // AtUtc DESC

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ClientMeasurementEntry configuration
            modelBuilder.Entity<ClientMeasurementEntry>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.WaistCm)
                    .HasPrecision(5, 1);

                entity.Property(e => e.HipCm)
                    .HasPrecision(5, 1);

                entity.Property(e => e.ChestCm)
                    .HasPrecision(5, 1);

                entity.Property(e => e.AtUtc)
                    .IsRequired();

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => new { e.ClientId, e.AtUtc })
                    .IsDescending(false, true); // AtUtc DESC

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ClientActivity configuration
            modelBuilder.Entity<ClientActivity>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Type)
                    .IsRequired()
                    .HasMaxLength(60);

                entity.Property(e => e.AtUtc)
                    .IsRequired();

                entity.Property(e => e.MetaJson)
                    .HasColumnType("jsonb");

                entity.HasIndex(e => new { e.ClientId, e.AtUtc })
                    .IsDescending(false, true); // AtUtc DESC

                entity.HasIndex(e => new { e.DietitianId, e.AtUtc })
                    .IsDescending(false, true)
                    .HasFilter("\"DietitianId\" IS NOT NULL");

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // DailyComplianceSnapshot configuration
            modelBuilder.Entity<DailyComplianceSnapshot>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.Date });

                entity.Property(e => e.Date)
                    .HasColumnType("date"); // PostgreSQL date type

                entity.Property(e => e.PlannedCount)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.CompletedCount)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.SkippedCount)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.Score0_100)
                    .IsRequired()
                    .HasDefaultValue(0);

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // DietitianBrandingConfig configuration
            modelBuilder.Entity<DietitianBrandingConfig>(entity =>
            {
                entity.HasKey(e => e.DietitianId);

                entity.Property(e => e.ClinicName)
                    .IsRequired()
                    .HasMaxLength(120);

                entity.Property(e => e.LogoUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.PrimaryColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#111111");

                entity.Property(e => e.AccentColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#22C55E");

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => e.UpdatedAtUtc);

                entity.HasOne(e => e.Dietitian)
                    .WithOne()
                    .HasForeignKey<DietitianBrandingConfig>(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // DietitianNote configuration
            modelBuilder.Entity<DietitianNote>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Text)
                    .IsRequired()
                    .HasMaxLength(2000);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => new { e.DietitianId, e.ClientId, e.CreatedAtUtc })
                    .IsDescending(false, false, true); // CreatedAtUtc DESC

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Note: Recipe-Ingredient many-to-many relationships are configured automatically
            // by EF Core via Recipe entity's navigation properties (MandatoryIngredients, OptionalIngredients, ProhibitedIngredients).
            // Note: Navigation properties (Days, Meals, Items) are configured
            // via HasMany/WithOne above. EF Core will handle the relationships automatically.
        }

        private static List<string> NormalizeAliasesList(List<string>? aliases)
        {
            return aliases != null ? aliases.Select(s => s.Trim().ToLowerInvariant()).Distinct().ToList() : new List<string>();
        }
    }
}
