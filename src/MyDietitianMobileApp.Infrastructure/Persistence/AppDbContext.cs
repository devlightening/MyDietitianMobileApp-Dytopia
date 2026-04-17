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
        public DbSet<DietitianRecipeFavorite> DietitianRecipeFavorites { get; set; }
        public DbSet<Ingredient> Ingredients { get; set; }
        public DbSet<RecipeIngredient> RecipeIngredients { get; set; } = null!;
        public DbSet<RecipeSubstitute> RecipeSubstitutes { get; set; } = null!;
        public DbSet<RecipeProhibition> RecipeProhibitions { get; set; } = null!;
        public DbSet<ClientIngredientProhibition> ClientIngredientProhibitions { get; set; } = null!;
        public DbSet<AccessKey> AccessKeys { get; set; }
        public DbSet<ClientPantryItem> ClientPantryItems { get; set; }
        public DbSet<ClientGoalPreference> ClientGoalPreferences { get; set; }
        public DbSet<ClientShoppingListItem> ClientShoppingListItems { get; set; }
        public DbSet<ClientCareMessage> ClientCareMessages { get; set; }
        public DbSet<ClientAppointmentSummary> ClientAppointmentSummaries { get; set; }
        public DbSet<PremiumAuditLog> PremiumAuditLogs { get; set; }
        public DbSet<RecipeIngredientSubstitute> RecipeIngredientSubstitutes { get; set; }
        public DbSet<ClientProhibitedIngredient> ClientProhibitedIngredients { get; set; }
        public DbSet<IngredientPack> IngredientPacks { get; set; }
        public DbSet<IngredientPackItem> IngredientPackItems { get; set; }
        public DbSet<IngredientFamily> IngredientFamilies { get; set; }
        public DbSet<IngredientFamilyMember> IngredientFamilyMembers { get; set; }
        public DbSet<IngredientCompatibilityRule> IngredientCompatibilityRules { get; set; }

        // EPIC E: Progress tracking
        public DbSet<ClientDailyTracking> ClientDailyTrackings { get; set; }
        public DbSet<ClientWeightEntry> ClientWeightEntries { get; set; }
        public DbSet<ClientMeasurementEntry> ClientMeasurementEntries { get; set; }
        public DbSet<ClientMeasurement> ClientMeasurements { get; set; }
        public DbSet<ClientNotificationPreference> ClientNotificationPreferences { get; set; }
        public DbSet<ClientActivity> ClientActivities { get; set; }
        public DbSet<ClientEngagementEvent> ClientEngagementEvents { get; set; }
        public DbSet<ClientAchievementUnlock> ClientAchievementUnlocks { get; set; }
        public DbSet<ClientGamificationSnapshot> ClientGamificationSnapshots { get; set; }
        public DbSet<MealCompletion> MealCompletions { get; set; }
        public DbSet<DailyComplianceSnapshot> DailyComplianceSnapshots { get; set; }
        public DbSet<DietitianBrandingConfig> DietitianBrandingConfigs { get; set; }
        public DbSet<DietitianSettings> DietitianSettings { get; set; }
        public DbSet<DietitianNote> DietitianNotes { get; set; }
        
        // FAZ 3: Permanent Binding & Measurements
        public DbSet<DietitianClientLink> DietitianClientLinks { get; set; }
        public DbSet<UserMeasurement> UserMeasurements { get; set; }

        // Meal Plan System (API-PLAN-01)
        public DbSet<MealPlan> MealPlans { get; set; }
        public DbSet<PlanMealItem> PlanMealItems { get; set; }

        // Meal Plan Templates (Faz 3)
        public DbSet<MealPlanTemplate> MealPlanTemplates { get; set; } = null!;
        public DbSet<MealPlanTemplateItem> MealPlanTemplateItems { get; set; } = null!;
        
        // Compliance tracking entities
        public DbSet<DietPlan> DietPlans { get; set; }
        public DbSet<DietPlanDay> DietPlanDays { get; set; }
        public DbSet<DietPlanMeal> DietPlanMeals { get; set; }
        public DbSet<MealItem> MealItems { get; set; }
        public DbSet<MealItemCompliance> MealItemCompliance { get; set; }
        public DbSet<ComplianceScoreConfig> ComplianceScoreConfigs { get; set; }
        public DbSet<MealCompliance> MealCompliances { get; set; }
        
        // New meal plan system
        public DbSet<ClientMealPlan> ClientMealPlans { get; set; }
        public DbSet<ClientMeal> ClientMeals { get; set; }

        // Evaluation / logging
        public DbSet<IngredientNormalizationLog> IngredientNormalizationLogs { get; set; }
        public DbSet<RecipeRecommendationLog> RecipeRecommendationLogs { get; set; }
        public DbSet<ProductBarcodeMapping> ProductBarcodeMappings { get; set; } = null!;
        public DbSet<IngredientAcquisitionLog> IngredientAcquisitionLogs { get; set; } = null!;

        // Client meal journal
        public DbSet<ClientMealLog> ClientMealLogs { get; set; } = null!;

        // Contact form messages (landing page → owner panel)
        public DbSet<ContactMessage> ContactMessages { get; set; } = null!;

        // Vision / image detection (Multimodal ingredient detection — Session 2)
        public DbSet<VisionLabelMapping> VisionLabelMappings { get; set; } = null!;
        public DbSet<IngredientImageDetectionLog> IngredientImageDetectionLogs { get; set; } = null!;

        // Recipe Import (Import Wizard)
        public DbSet<RecipeImportSession> RecipeImportSessions { get; set; } = null!;
        public DbSet<RecipeImportSessionRecipe> RecipeImportSessionRecipes { get; set; } = null!;
        public DbSet<RecipeImportSessionIngredient> RecipeImportSessionIngredients { get; set; } = null!;
        public DbSet<RecipeImportSessionIssue> RecipeImportSessionIssues { get; set; } = null!;
        public DbSet<ImportTemplate> ImportTemplates { get; set; } = null!;

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
                entity.Property(e => e.Slug).IsRequired().HasMaxLength(260);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.Slug).IsUnique();
                entity.HasIndex(e => e.IsPublic);
                entity.HasIndex(e => e.IsArchived);

                // Production safety fields — default false so existing rows are unaffected
                entity.Property(e => e.IsDemo).HasDefaultValue(false);
                entity.Property(e => e.IsDraft).HasDefaultValue(false);
                entity.Property(e => e.IsHiddenFromProduction).HasDefaultValue(false);
                entity.Property(e => e.IsArchived).HasDefaultValue(false);
                entity.Property(e => e.ArchivedAtUtc).IsRequired(false);

                // Steps stored as JSON text; null = no steps authored
                entity.Property(e => e.StepsJson).HasColumnName("StepsJson").IsRequired(false);
                entity.Property(e => e.TagsJson).HasColumnName("TagsJson").HasColumnType("jsonb").IsRequired(false);
                entity.Property(e => e.PrepTimeMinutes).IsRequired(false);
                entity.Property(e => e.CookTimeMinutes).IsRequired(false);
                entity.Property(e => e.Servings).IsRequired(false);
                entity.Property(e => e.CaloriesKcal).IsRequired(false);
                entity.Property(e => e.ProteinGrams).HasPrecision(8, 2).IsRequired(false);
                entity.Property(e => e.CarbsGrams).HasPrecision(8, 2).IsRequired(false);
                entity.Property(e => e.FatGrams).HasPrecision(8, 2).IsRequired(false);

                // Composite index for the production candidate filter
                entity.HasIndex(e => new { e.IsDemo, e.IsDraft, e.IsHiddenFromProduction })
                    .HasDatabaseName("IX_Recipes_ProductionSafetyFlags");

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

            modelBuilder.Entity<DietitianRecipeFavorite>(entity =>
            {
                entity.HasKey(e => new { e.DietitianId, e.RecipeId });

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => e.CreatedAtUtc);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Recipe)
                    .WithMany()
                    .HasForeignKey(e => e.RecipeId)
                    .OnDelete(DeleteBehavior.Cascade);
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

                // MealType: default (Snack) is set by the entity property initializer
                entity.Property(e => e.MealType)
                    .IsRequired()
                    .HasSentinel(PlanMealItemType.Breakfast);

                // Optional recipe link for kitchen integration
                entity.Property(e => e.RecipeId)
                    .IsRequired(false);

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

                // Optional recipe navigation
                entity.HasOne(e => e.Recipe)
                    .WithMany()
                    .HasForeignKey(e => e.RecipeId)
                    .IsRequired(false)
                    .OnDelete(DeleteBehavior.SetNull);

                // Completion: one PlanMealItem has zero or one MealCompletion.
                // MealCompletion.DietPlanMealId is the FK pointing back to this entity.
                entity.HasOne(e => e.Completion)
                    .WithOne()
                    .HasForeignKey<MealCompletion>(c => c.DietPlanMealId)
                    .IsRequired(false)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // MealCompletion configuration (EPIC E)
            modelBuilder.Entity<MealCompletion>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Status)
                    .IsRequired();

                // AlternativeRecipeId — nullable, only set when Status=Alternative
                entity.Property(e => e.AlternativeRecipeId)
                    .IsRequired(false);

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

            modelBuilder.Entity<ClientMealPlan>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Description)
                    .HasMaxLength(1000);

                entity.Property(e => e.StartDate)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.Property(e => e.EndDate)
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
                        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.HasIndex(e => new { e.ClientId, e.IsActive });
                entity.HasIndex(e => new { e.DietitianId, e.StartDate });

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasMany(e => e.Meals)
                    .WithOne(e => e.ClientMealPlan)
                    .HasForeignKey(e => e.ClientMealPlanId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ClientMeal>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.MealType)
                    .IsRequired()
                    .HasMaxLength(40);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired()
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.Property(e => e.CompletedAt)
                    .HasColumnType("timestamp with time zone")
                    .HasConversion(
                        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
                        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

                entity.HasIndex(e => e.ClientMealPlanId);
                entity.HasIndex(e => new { e.ClientMealPlanId, e.DayOfWeek, e.MealType });

                entity.HasOne(e => e.Recipe)
                    .WithMany()
                    .HasForeignKey(e => e.RecipeId)
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
#pragma warning disable CS0618
                entity.Property(e => e.Name).HasMaxLength(200); // Legacy field
#pragma warning restore CS0618
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
                // Condiment/pantry-helper flag — used by the recommendation engine's guardrail
                entity.Property(e => e.IsCondiment).HasDefaultValue(false);
                
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

            modelBuilder.Entity<ProductBarcodeMapping>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Barcode)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.ProductName)
                    .IsRequired()
                    .HasMaxLength(300);

                entity.Property(e => e.Brand)
                    .HasMaxLength(200);

                entity.Property(e => e.MappingType)
                    .HasConversion<string>()
                    .HasMaxLength(32);

                entity.Property(e => e.SourceProvider)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.Confidence)
                    .HasPrecision(5, 4);

                entity.HasIndex(e => e.Barcode)
                    .IsUnique();

                entity.HasIndex(e => e.CanonicalIngredientId);
                entity.HasIndex(e => e.MappingType);
                entity.HasIndex(e => e.LastVerifiedAtUtc);

                entity.HasOne(e => e.CanonicalIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.CanonicalIngredientId)
                    .OnDelete(DeleteBehavior.SetNull);
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

            modelBuilder.Entity<ClientGoalPreference>(entity =>
            {
                entity.HasKey(e => e.ClientId);

                entity.Property(e => e.PrimaryGoal)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.DietStyle)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.CookingTimePreference)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.ReminderTone)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.UpdatedAtUtc);
            });

            modelBuilder.Entity<ClientShoppingListItem>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(180);

                entity.Property(e => e.Quantity)
                    .HasPrecision(10, 2);

                entity.Property(e => e.Unit)
                    .HasMaxLength(50);

                entity.Property(e => e.SourceType)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.SourceReferenceId)
                    .HasMaxLength(128);

                entity.Property(e => e.Note)
                    .HasMaxLength(240);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Ingredient)
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(e => new { e.ClientId, e.IsChecked, e.UpdatedAtUtc });
                entity.HasIndex(e => new { e.ClientId, e.IngredientId });
            });

            modelBuilder.Entity<ClientCareMessage>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.SenderRole)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.Text)
                    .IsRequired()
                    .HasMaxLength(2000);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(e => new { e.ClientId, e.CreatedAtUtc });
                entity.HasIndex(e => new { e.DietitianId, e.CreatedAtUtc });
            });

            modelBuilder.Entity<ClientAppointmentSummary>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(160);

                entity.Property(e => e.Mode)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.Location)
                    .HasMaxLength(180);

                entity.Property(e => e.Note)
                    .HasMaxLength(300);

                entity.Property(e => e.AttendanceStatus)
                    .IsRequired()
                    .HasMaxLength(24)
                    .HasDefaultValue(ClientAppointmentSummary.AttendancePending);

                entity.Property(e => e.AttendanceMarkedAtUtc)
                    .IsRequired(false);

                entity.Property(e => e.ScheduledAtUtc)
                    .IsRequired();

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Dietitian)
                    .WithMany()
                    .HasForeignKey(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(e => new { e.ClientId, e.ScheduledAtUtc });
                entity.HasIndex(e => new { e.ClientId, e.IsCancelled });
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

            // IngredientFamily configuration
            modelBuilder.Entity<IngredientFamily>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Description)
                    .HasMaxLength(1000);

                entity.HasIndex(e => e.Name).IsUnique();
                entity.HasIndex(e => e.IsActive);
                entity.HasIndex(e => e.SortOrder);

                entity.HasMany(e => e.Members)
                    .WithOne(m => m.Family)
                    .HasForeignKey(m => m.FamilyId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // IngredientFamilyMember configuration
            modelBuilder.Entity<IngredientFamilyMember>(entity =>
            {
                entity.HasKey(e => new { e.FamilyId, e.IngredientId });

                entity.Property(e => e.Role)
                    .IsRequired()
                    .HasConversion<string>()
                    .HasMaxLength(50);

                entity.HasOne(e => e.Family)
                    .WithMany(f => f.Members)
                    .HasForeignKey(e => e.FamilyId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Ingredient)
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // IngredientCompatibilityRule configuration
            modelBuilder.Entity<IngredientCompatibilityRule>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.CompatibilityType)
                    .IsRequired()
                    .HasConversion<string>()
                    .HasMaxLength(50);

                entity.Property(e => e.ScorePenalty)
                    .HasPrecision(5, 2);

                entity.Property(e => e.Reason)
                    .HasMaxLength(500);

                entity.HasIndex(e => e.RequiredIngredientId);
                entity.HasIndex(e => e.CandidateIngredientId);
                entity.HasIndex(e => e.IsActive);
                
                // Prevent duplicate rules for the same exact pair
                entity.HasIndex(e => new { e.RequiredIngredientId, e.CandidateIngredientId }).IsUnique();

                entity.HasOne(e => e.RequiredIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.RequiredIngredientId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.CandidateIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.CandidateIngredientId)
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

            // ClientMeasurement configuration (unified measurement table)
            modelBuilder.Entity<ClientMeasurement>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.SourceType)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.WeightKg).HasPrecision(5, 1);
                entity.Property(e => e.HeightCm).HasPrecision(5, 1);
                entity.Property(e => e.BodyFatPercent).HasPrecision(4, 1);
                entity.Property(e => e.MusclePercent).HasPrecision(4, 1);
                entity.Property(e => e.WaterPercent).HasPrecision(4, 1);
                entity.Property(e => e.WaistCm).HasPrecision(5, 1);
                entity.Property(e => e.HipCm).HasPrecision(5, 1);
                entity.Property(e => e.ChestCm).HasPrecision(5, 1);
                entity.Property(e => e.Bmi).HasPrecision(4, 1);
                entity.Property(e => e.BmiCategory).HasMaxLength(30);
                entity.Property(e => e.Bmr).HasPrecision(7, 0);
                entity.Property(e => e.WaistHipRatio).HasPrecision(4, 2);
                entity.Property(e => e.Notes).HasMaxLength(500);
                entity.Property(e => e.RecordedAtUtc).IsRequired();
                entity.Property(e => e.CreatedAtUtc).IsRequired();

                entity.HasIndex(e => new { e.ClientId, e.RecordedAtUtc })
                    .IsDescending(false, true)
                    .HasDatabaseName("IX_ClientMeasurements_ClientId_RecordedAtUtc");

                entity.HasIndex(e => new { e.ClientId, e.SourceType })
                    .HasDatabaseName("IX_ClientMeasurements_ClientId_SourceType");

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ClientNotificationPreference configuration
            modelBuilder.Entity<ClientNotificationPreference>(entity =>
            {
                entity.HasKey(e => e.ClientId);

                entity.Property(e => e.NotificationsEnabled)
                    .IsRequired()
                    .HasDefaultValue(true);

                entity.Property(e => e.HydrationRemindersEnabled)
                    .IsRequired()
                    .HasDefaultValue(true);

                entity.Property(e => e.HydrationIntervalMinutes)
                    .IsRequired()
                    .HasDefaultValue(120);

                entity.Property(e => e.HydrationStartLocalTime)
                    .IsRequired()
                    .HasColumnType("time");

                entity.Property(e => e.HydrationEndLocalTime)
                    .IsRequired()
                    .HasColumnType("time");

                entity.Property(e => e.MealPlanRemindersEnabled)
                    .IsRequired()
                    .HasDefaultValue(true);

                entity.Property(e => e.MealReminderLeadMinutes)
                    .IsRequired()
                    .HasDefaultValue(20);

                entity.Property(e => e.MeasurementRemindersEnabled)
                    .IsRequired()
                    .HasDefaultValue(true);

                entity.Property(e => e.MeasurementReminderDayOfWeek)
                    .IsRequired()
                    .HasDefaultValue(1);

                entity.Property(e => e.MeasurementReminderLocalTime)
                    .IsRequired()
                    .HasColumnType("time");

                entity.Property(e => e.ReengagementRemindersEnabled)
                    .IsRequired()
                    .HasDefaultValue(true);

                entity.Property(e => e.ReengagementDelayHours)
                    .IsRequired()
                    .HasDefaultValue(48);

                entity.Property(e => e.TimeZoneId)
                    .IsRequired()
                    .HasMaxLength(64)
                    .HasDefaultValue("Europe/Istanbul");

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.Property(e => e.LastAppOpenAtUtc)
                    .IsRequired();

                entity.Property(e => e.LastNotificationSyncAtUtc)
                    .IsRequired(false);

                entity.HasIndex(e => e.UpdatedAtUtc);
                entity.HasIndex(e => e.LastAppOpenAtUtc);

                entity.HasOne<Client>()
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

            modelBuilder.Entity<ClientEngagementEvent>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.EventType)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.EventDate)
                    .HasColumnType("date");

                entity.Property(e => e.OccurredAtUtc)
                    .IsRequired();

                entity.Property(e => e.MetaJson)
                    .HasColumnType("jsonb");

                entity.HasIndex(e => new { e.ClientId, e.EventDate, e.EventType });
                entity.HasIndex(e => new { e.DietitianId, e.EventDate })
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

            modelBuilder.Entity<ClientAchievementUnlock>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.BadgeId });

                entity.Property(e => e.BadgeId)
                    .HasMaxLength(64);

                entity.Property(e => e.CurrentLevel)
                    .HasDefaultValue(1);

                entity.Property(e => e.UnlockedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => e.UnlockedAtUtc)
                    .IsDescending();

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ClientGamificationSnapshot>(entity =>
            {
                entity.HasKey(e => new { e.ClientId, e.Date });

                entity.Property(e => e.Date)
                    .HasColumnType("date");

                entity.Property(e => e.PrimaryTrack)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.PrimaryScore)
                    .HasPrecision(5, 2);

                entity.Property(e => e.AdherenceScore)
                    .HasPrecision(5, 2);

                entity.Property(e => e.EngagementScore)
                    .HasPrecision(5, 2);

                entity.HasIndex(e => new { e.ClientId, e.Date })
                    .IsDescending(false, true);

                entity.HasIndex(e => new { e.Date, e.QualifiedForStreak });

                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
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
                    .HasMaxLength(120);

                entity.Property(e => e.LogoUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.PrimaryColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#4A7C59");

                entity.Property(e => e.AccentColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#FF8C61");

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired();

                entity.HasIndex(e => e.UpdatedAtUtc);

                entity.HasOne(e => e.Dietitian)
                    .WithOne()
                    .HasForeignKey<DietitianBrandingConfig>(e => e.DietitianId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // IngredientNormalizationLog configuration
            modelBuilder.Entity<IngredientNormalizationLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.RawInput)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.NormalizedInput)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.MatchedBy)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.MatchedCanonicalName)
                    .HasMaxLength(200);

                entity.Property(e => e.CandidateSummaryJson)
                    .HasColumnType("jsonb")
                    .IsRequired(false);

                entity.Property(e => e.CorrelationId)
                    .HasMaxLength(100);

                entity.Property(e => e.RequestPath)
                    .HasMaxLength(300);

                entity.HasIndex(e => e.CreatedAtUtc);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.MatchedBy);
                entity.HasIndex(e => e.MatchedIngredientId);
            });

            // RecipeRecommendationLog configuration
            modelBuilder.Entity<RecipeRecommendationLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Flow)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.Property(e => e.MissingMandatoryIdsJson)
                    .HasColumnType("jsonb")
                    .IsRequired(false);

                entity.Property(e => e.AdditionalMetaJson)
                    .HasColumnType("jsonb")
                    .IsRequired(false);

                entity.Property(e => e.CorrelationId)
                    .HasMaxLength(100);

                entity.HasIndex(e => e.CreatedAtUtc);
                entity.HasIndex(e => e.Flow);
                entity.HasIndex(e => e.ClientId);
                entity.HasIndex(e => e.DietitianId);
                entity.HasIndex(e => e.PlannedRecipeId);
                entity.HasIndex(e => e.SelectedRecipeId);
            });

            modelBuilder.Entity<IngredientAcquisitionLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Source)
                    .HasConversion<string>()
                    .HasMaxLength(16);

                entity.Property(e => e.RawInput)
                    .IsRequired()
                    .HasMaxLength(512);

                entity.Property(e => e.MappingType)
                    .HasConversion<string>()
                    .HasMaxLength(32);

                entity.Property(e => e.Confidence)
                    .HasPrecision(5, 4);

                entity.HasIndex(e => e.SessionId);
                entity.HasIndex(e => e.Source);
                entity.HasIndex(e => e.ResolvedIngredientId);
                entity.HasIndex(e => e.CreatedAtUtc);
                entity.HasIndex(e => new { e.Source, e.MappingType });

                entity.HasOne(e => e.ResolvedIngredient)
                    .WithMany()
                    .HasForeignKey(e => e.ResolvedIngredientId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // DietitianSettings configuration
            modelBuilder.Entity<DietitianSettings>(entity =>
            {
                entity.HasKey(e => e.Id);

                // Unique constraint: One settings record per dietitian
                entity.HasIndex(e => e.DietitianId)
                    .IsUnique();

                entity.Property(e => e.ClinicName)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.DietitianDisplayName)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.PrimaryColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#4A7C59"); // Sage

                entity.Property(e => e.AccentColorHex)
                    .IsRequired()
                    .HasMaxLength(7)
                    .HasDefaultValue("#8FBC8F"); // Forest

                entity.Property(e => e.ThemePresetKey)
                    .HasMaxLength(50);

                entity.Property(e => e.LogoUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");

                entity.Property(e => e.UpdatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");

                entity.HasOne(e => e.Dietitian)
                    .WithOne()
                    .HasForeignKey<DietitianSettings>(e => e.DietitianId)
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

            // ===== RECIPE IMPORT (Import Wizard) =====
            modelBuilder.Entity<RecipeImportSession>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.OriginalFileName).IsRequired().HasMaxLength(500);
                entity.Property(e => e.FileType).IsRequired().HasMaxLength(10);
                entity.Property(e => e.DocumentKind).HasConversion<string>().HasMaxLength(40);
                entity.Property(e => e.ParserUsed).HasMaxLength(100);
                entity.Property(e => e.ConfidenceScore).HasPrecision(5, 4);
                entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
                entity.Property(e => e.ErrorMessage).HasMaxLength(2000);
                entity.Property(e => e.WarningsJson).HasColumnType("jsonb");
                entity.Property(e => e.DetectedRecipeBoundaryMode).HasMaxLength(200);
                entity.Property(e => e.TemplateKey).HasMaxLength(200);
                entity.Property(e => e.TemplateHeaderHintsJson).HasColumnType("jsonb");
                entity.HasIndex(e => new { e.DietitianId, e.CreatedAtUtc })
                    .HasDatabaseName("IX_RecipeImportSessions_DietitianId_CreatedAt");
                entity.HasMany(e => e.Recipes)
                    .WithOne(r => r.Session)
                    .HasForeignKey(r => r.SessionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RecipeImportSessionRecipe>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.RawTitle).IsRequired().HasMaxLength(500);
                entity.Property(e => e.NormalizedTitle).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Description).HasMaxLength(4000);
                entity.Property(e => e.RawSourceBlock).HasColumnType("text");
                entity.Property(e => e.StepsJson).HasColumnType("jsonb");
                entity.Property(e => e.TagsJson).HasColumnType("jsonb");
                entity.Property(e => e.PrepTimeText).HasMaxLength(100);
                entity.Property(e => e.CookTimeText).HasMaxLength(100);
                entity.Property(e => e.ServingsText).HasMaxLength(100);
                entity.Property(e => e.DuplicateResolutionMode).HasConversion<string>().HasMaxLength(30);
                entity.HasIndex(e => e.SessionId)
                    .HasDatabaseName("IX_RecipeImportSessionRecipes_SessionId");
                entity.HasMany(e => e.Ingredients)
                    .WithOne(i => i.SessionRecipe)
                    .HasForeignKey(i => i.SessionRecipeId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RecipeImportSessionIngredient>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.RawName).IsRequired().HasMaxLength(500);
                entity.Property(e => e.NormalizedName).IsRequired().HasMaxLength(500);
                entity.Property(e => e.RawLineText).HasMaxLength(2000);
                entity.Property(e => e.AmountRaw).HasMaxLength(100);
                entity.Property(e => e.AmountValue).HasPrecision(10, 4);
                entity.Property(e => e.UnitNormalized).HasMaxLength(50);
                entity.Property(e => e.Role).HasConversion<string>().HasMaxLength(30);
                entity.Property(e => e.MatchedCanonicalName).HasMaxLength(500);
                entity.Property(e => e.MatchType).HasConversion<string>().HasMaxLength(30);
                entity.Property(e => e.ParseConfidence).HasPrecision(5, 4);
                entity.Property(e => e.IssueCodesJson).HasColumnType("jsonb");
                entity.HasIndex(e => e.SessionRecipeId)
                    .HasDatabaseName("IX_RecipeImportSessionIngredients_SessionRecipeId");
            });

            modelBuilder.Entity<RecipeImportSessionIssue>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Severity).HasConversion<string>().HasMaxLength(20);
                entity.Property(e => e.Code).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Hint).HasMaxLength(1000);
                entity.HasIndex(e => e.SessionId)
                    .HasDatabaseName("IX_RecipeImportSessionIssues_SessionId");
                entity.HasIndex(e => e.SessionRecipeId)
                    .HasDatabaseName("IX_RecipeImportSessionIssues_SessionRecipeId");
            });

            modelBuilder.Entity<ImportTemplate>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.TemplateKey).IsRequired().HasMaxLength(200);
                entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.DocumentKind).HasConversion<string>().HasMaxLength(40);
                entity.Property(e => e.ParserUsed).IsRequired().HasMaxLength(100);
                entity.Property(e => e.HeaderHintsJson).HasColumnType("jsonb");
                entity.HasIndex(e => new { e.DietitianId, e.TemplateKey }).IsUnique()
                    .HasDatabaseName("IX_ImportTemplates_DietitianId_TemplateKey");
            });

            // ===== MEAL PLAN TEMPLATES (Faz 3) =====

            modelBuilder.Entity<MealPlanTemplate>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Description)
                    .HasMaxLength(300);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");

                entity.Property(e => e.UpdatedAtUtc)
                    .IsRequired()
                    .HasDefaultValueSql("NOW()");

                entity.HasIndex(e => e.DietitianId)
                    .HasDatabaseName("IX_MealPlanTemplates_DietitianId");

                entity.HasMany(e => e.Items)
                    .WithOne(i => i.Template)
                    .HasForeignKey(i => i.TemplateId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<MealPlanTemplateItem>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Time)
                    .IsRequired()
                    .HasColumnType("time");

                entity.Property(e => e.MealType)
                    .IsRequired()
                    .HasConversion<string>()
                    .HasMaxLength(20);

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

                entity.Property(e => e.RecipeId)
                    .IsRequired(false);

                entity.HasIndex(e => e.TemplateId)
                    .HasDatabaseName("IX_MealPlanTemplateItems_TemplateId");
            });

            // ContactMessage — landing page contact form submissions
            modelBuilder.Entity<ContactMessage>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
                entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
                entity.Property(e => e.Phone).HasMaxLength(30);
                entity.Property(e => e.Subject).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.IsRead).HasDefaultValue(false);
                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("IX_ContactMessages_CreatedAt");
                entity.HasIndex(e => e.IsRead)
                    .HasDatabaseName("IX_ContactMessages_IsRead");
            });

            // VisionLabelMapping — cache layer for raw vision labels → canonical ingredients
            modelBuilder.Entity<VisionLabelMapping>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.RawLabel)
                    .IsRequired()
                    .HasMaxLength(300);

                entity.Property(e => e.NormalizedLabel)
                    .IsRequired()
                    .HasMaxLength(300);

                entity.Property(e => e.ConfidenceThreshold)
                    .HasPrecision(5, 4)
                    .HasDefaultValue(0.7);

                entity.Property(e => e.IsApproved)
                    .HasDefaultValue(false);

                entity.Property(e => e.Notes)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                // Fast lookup: given a normalized label, find its mapping
                entity.HasIndex(e => e.NormalizedLabel)
                    .HasDatabaseName("IX_VisionLabelMappings_NormalizedLabel");

                // Filter index: only approved mappings are used at runtime
                entity.HasIndex(e => e.IsApproved)
                    .HasDatabaseName("IX_VisionLabelMappings_IsApproved");

                entity.HasIndex(e => e.IngredientId)
                    .HasDatabaseName("IX_VisionLabelMappings_IngredientId");

                entity.HasOne<Ingredient>()
                    .WithMany()
                    .HasForeignKey(e => e.IngredientId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // IngredientImageDetectionLog — per-scan event log for metrics and cost tracking
            modelBuilder.Entity<IngredientImageDetectionLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                // SessionId groups all per-label entries for one scan (used by confirm endpoint)
                entity.Property(e => e.SessionId).IsRequired();

                entity.Property(e => e.ImageSource)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.RawLabel)
                    .IsRequired()
                    .HasMaxLength(300);

                entity.Property(e => e.NormalizedLabel)
                    .IsRequired()
                    .HasMaxLength(300);

                entity.Property(e => e.Confidence)
                    .HasPrecision(5, 4);

                entity.Property(e => e.MatchType)
                    .IsRequired()
                    .HasMaxLength(32);

                entity.Property(e => e.CreatedAtUtc)
                    .IsRequired();

                // Confirm endpoint: look up all labels from the same scan
                entity.HasIndex(e => e.SessionId)
                    .HasDatabaseName("IX_IngredientImageDetectionLogs_SessionId");

                // Per-client scan history (descending time)
                entity.HasIndex(e => new { e.ClientId, e.CreatedAtUtc })
                    .IsDescending(false, true)
                    .HasDatabaseName("IX_IngredientImageDetectionLogs_ClientId_CreatedAtUtc");

                // Aggregate queries by match type (for thesis metrics)
                entity.HasIndex(e => e.MatchType)
                    .HasDatabaseName("IX_IngredientImageDetectionLogs_MatchType");

                // Cost tracking: filter by OpenAI usage
                entity.HasIndex(e => e.UsedOpenAiFallback)
                    .HasDatabaseName("IX_IngredientImageDetectionLogs_UsedOpenAiFallback");
            });

            modelBuilder.Entity<ClientMealLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.MealType).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Notes).HasMaxLength(1000);
                entity.Property(e => e.PhotoUrl).HasMaxLength(500);
                entity.HasIndex(e => new { e.ClientId, e.Date })
                    .HasDatabaseName("IX_ClientMealLogs_ClientId_Date");
                entity.HasOne(e => e.Client)
                    .WithMany()
                    .HasForeignKey(e => e.ClientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }

        private static List<string> NormalizeAliasesList(List<string>? aliases)
        {
            return aliases != null ? aliases.Select(s => s.Trim().ToLowerInvariant()).Distinct().ToList() : new List<string>();
        }
    }
}
