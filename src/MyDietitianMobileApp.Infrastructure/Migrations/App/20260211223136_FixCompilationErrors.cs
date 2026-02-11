using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class FixCompilationErrors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId",
                table: "Ingredients");

            migrationBuilder.DropForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId1",
                table: "Ingredients");

            migrationBuilder.DropForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId2",
                table: "Ingredients");

            migrationBuilder.DropForeignKey(
                name: "FK_MealCompletions_PlanMealItems_PlanMealItemId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_ClientId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_PlanMealItemId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "UQ_MealCompletions_Client_MealItem",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_Ingredients_RecipeId",
                table: "Ingredients");

            migrationBuilder.DropIndex(
                name: "IX_Ingredients_RecipeId1",
                table: "Ingredients");

            migrationBuilder.DropIndex(
                name: "IX_Ingredients_RecipeId2",
                table: "Ingredients");

            migrationBuilder.DropIndex(
                name: "IX_DietitianClientLinks_IsActive",
                table: "DietitianClientLinks");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "MealCompletions");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "MealCompletions");

            migrationBuilder.DropColumn(
                name: "RecipeId",
                table: "Ingredients");

            migrationBuilder.DropColumn(
                name: "RecipeId1",
                table: "Ingredients");

            migrationBuilder.DropColumn(
                name: "RecipeId2",
                table: "Ingredients");

            migrationBuilder.RenameColumn(
                name: "PlanMealItemId",
                table: "MealCompletions",
                newName: "DietitianId");

            migrationBuilder.AddColumn<Guid>(
                name: "CompletionId",
                table: "PlanMealItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AtUtc",
                table: "MealCompletions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "DietPlanMealId",
                table: "MealCompletions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "MealCompletions",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "MealCompletions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ClientActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    AtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MetaJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientActivities_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientActivities_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ClientDailyTrackings",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    WaterGlasses = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Steps = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientDailyTrackings", x => new { x.ClientId, x.Date });
                    table.ForeignKey(
                        name: "FK_ClientDailyTrackings_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMeasurementEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WaistCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    HipCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    ChestCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMeasurementEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMeasurementEntries_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientPantryItems",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientPantryItems", x => new { x.ClientId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_ClientPantryItems_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientPantryItems_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientProhibitedIngredients",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientProhibitedIngredients", x => new { x.ClientId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_ClientProhibitedIngredients_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientProhibitedIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientWeightEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WeightKg = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientWeightEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientWeightEntries_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DailyComplianceSnapshots",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    PlannedCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CompletedCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    SkippedCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Score0_100 = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyComplianceSnapshots", x => new { x.ClientId, x.Date });
                    table.ForeignKey(
                        name: "FK_DailyComplianceSnapshots_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DietitianBrandingConfigs",
                columns: table => new
                {
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LogoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PrimaryColorHex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false, defaultValue: "#111111"),
                    AccentColorHex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false, defaultValue: "#22C55E"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DietitianBrandingConfigs", x => x.DietitianId);
                    table.ForeignKey(
                        name: "FK_DietitianBrandingConfigs_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DietitianNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DietitianNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DietitianNotes_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DietitianNotes_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngredientPacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientPacks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PremiumAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MetaJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PremiumAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeIngredientSubstitutes",
                columns: table => new
                {
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequiredIngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubstituteIngredientId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeIngredientSubstitutes", x => new { x.RecipeId, x.RequiredIngredientId, x.SubstituteIngredientId });
                    table.ForeignKey(
                        name: "FK_RecipeIngredientSubstitutes_Ingredients_RequiredIngredientId",
                        column: x => x.RequiredIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RecipeIngredientSubstitutes_Ingredients_SubstituteIngredien~",
                        column: x => x.SubstituteIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RecipeIngredientSubstitutes_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeMandatoryIngredients",
                columns: table => new
                {
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeMandatoryIngredients", x => new { x.RecipeId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_RecipeMandatoryIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeMandatoryIngredients_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeOptionalIngredients",
                columns: table => new
                {
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeOptionalIngredients", x => new { x.RecipeId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_RecipeOptionalIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeOptionalIngredients_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeProhibitedIngredients",
                columns: table => new
                {
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeProhibitedIngredients", x => new { x.RecipeId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_RecipeProhibitedIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeProhibitedIngredients_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngredientPackItems",
                columns: table => new
                {
                    PackId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientPackItems", x => new { x.PackId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_IngredientPackItems_IngredientPacks_PackId",
                        column: x => x.PackId,
                        principalTable: "IngredientPacks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IngredientPackItems_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Recipes_IsPublic",
                table: "Recipes",
                column: "IsPublic");

            migrationBuilder.CreateIndex(
                name: "IX_PlanMealItems_CompletionId",
                table: "PlanMealItems",
                column: "CompletionId");

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_ClientId_AtUtc",
                table: "MealCompletions",
                columns: new[] { "ClientId", "AtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_ClientId_DietPlanMealId",
                table: "MealCompletions",
                columns: new[] { "ClientId", "DietPlanMealId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_DietitianId",
                table: "MealCompletions",
                column: "DietitianId");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianClientLinks_ClientId",
                table: "DietitianClientLinks",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientActivities_ClientId_AtUtc",
                table: "ClientActivities",
                columns: new[] { "ClientId", "AtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ClientActivities_DietitianId_AtUtc",
                table: "ClientActivities",
                columns: new[] { "DietitianId", "AtUtc" },
                descending: new[] { false, true },
                filter: "\"DietitianId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientDailyTrackings_ClientId_Date",
                table: "ClientDailyTrackings",
                columns: new[] { "ClientId", "Date" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeasurementEntries_ClientId_AtUtc",
                table: "ClientMeasurementEntries",
                columns: new[] { "ClientId", "AtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ClientPantryItems_ClientId_UpdatedAtUtc",
                table: "ClientPantryItems",
                columns: new[] { "ClientId", "UpdatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientPantryItems_IngredientId",
                table: "ClientPantryItems",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientProhibitedIngredients_ClientId",
                table: "ClientProhibitedIngredients",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientProhibitedIngredients_ClientId_CreatedAtUtc",
                table: "ClientProhibitedIngredients",
                columns: new[] { "ClientId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientProhibitedIngredients_IngredientId",
                table: "ClientProhibitedIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientWeightEntries_ClientId_AtUtc",
                table: "ClientWeightEntries",
                columns: new[] { "ClientId", "AtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_DietitianBrandingConfigs_UpdatedAtUtc",
                table: "DietitianBrandingConfigs",
                column: "UpdatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianNotes_ClientId",
                table: "DietitianNotes",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianNotes_DietitianId_ClientId_CreatedAtUtc",
                table: "DietitianNotes",
                columns: new[] { "DietitianId", "ClientId", "CreatedAtUtc" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_IngredientPackItems_IngredientId",
                table: "IngredientPackItems",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientPacks_DietitianId",
                table: "IngredientPacks",
                column: "DietitianId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientPacks_IsSystem",
                table: "IngredientPacks",
                column: "IsSystem");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientPacks_IsSystem_SortOrder",
                table: "IngredientPacks",
                columns: new[] { "IsSystem", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_PremiumAuditLogs_AtUtc",
                table: "PremiumAuditLogs",
                column: "AtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PremiumAuditLogs_ClientId",
                table: "PremiumAuditLogs",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_PremiumAuditLogs_DietitianId",
                table: "PremiumAuditLogs",
                column: "DietitianId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientSubstitutes_RecipeId",
                table: "RecipeIngredientSubstitutes",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientSubstitutes_RecipeId_RequiredIngredientId",
                table: "RecipeIngredientSubstitutes",
                columns: new[] { "RecipeId", "RequiredIngredientId" });

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientSubstitutes_RequiredIngredientId",
                table: "RecipeIngredientSubstitutes",
                column: "RequiredIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredientSubstitutes_SubstituteIngredientId",
                table: "RecipeIngredientSubstitutes",
                column: "SubstituteIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeMandatoryIngredients_IngredientId",
                table: "RecipeMandatoryIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeOptionalIngredients_IngredientId",
                table: "RecipeOptionalIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeProhibitedIngredients_IngredientId",
                table: "RecipeProhibitedIngredients",
                column: "IngredientId");

            migrationBuilder.AddForeignKey(
                name: "FK_DietitianClientLinks_Clients_ClientId",
                table: "DietitianClientLinks",
                column: "ClientId",
                principalTable: "Clients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MealCompletions_Dietitians_DietitianId",
                table: "MealCompletions",
                column: "DietitianId",
                principalTable: "Dietitians",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanMealItems_MealCompletions_CompletionId",
                table: "PlanMealItems",
                column: "CompletionId",
                principalTable: "MealCompletions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DietitianClientLinks_Clients_ClientId",
                table: "DietitianClientLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_MealCompletions_Dietitians_DietitianId",
                table: "MealCompletions");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanMealItems_MealCompletions_CompletionId",
                table: "PlanMealItems");

            migrationBuilder.DropTable(
                name: "ClientActivities");

            migrationBuilder.DropTable(
                name: "ClientDailyTrackings");

            migrationBuilder.DropTable(
                name: "ClientMeasurementEntries");

            migrationBuilder.DropTable(
                name: "ClientPantryItems");

            migrationBuilder.DropTable(
                name: "ClientProhibitedIngredients");

            migrationBuilder.DropTable(
                name: "ClientWeightEntries");

            migrationBuilder.DropTable(
                name: "DailyComplianceSnapshots");

            migrationBuilder.DropTable(
                name: "DietitianBrandingConfigs");

            migrationBuilder.DropTable(
                name: "DietitianNotes");

            migrationBuilder.DropTable(
                name: "IngredientPackItems");

            migrationBuilder.DropTable(
                name: "PremiumAuditLogs");

            migrationBuilder.DropTable(
                name: "RecipeIngredientSubstitutes");

            migrationBuilder.DropTable(
                name: "RecipeMandatoryIngredients");

            migrationBuilder.DropTable(
                name: "RecipeOptionalIngredients");

            migrationBuilder.DropTable(
                name: "RecipeProhibitedIngredients");

            migrationBuilder.DropTable(
                name: "IngredientPacks");

            migrationBuilder.DropIndex(
                name: "IX_Recipes_IsPublic",
                table: "Recipes");

            migrationBuilder.DropIndex(
                name: "IX_PlanMealItems_CompletionId",
                table: "PlanMealItems");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_ClientId_AtUtc",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_ClientId_DietPlanMealId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_DietitianId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_DietitianClientLinks_ClientId",
                table: "DietitianClientLinks");

            migrationBuilder.DropColumn(
                name: "CompletionId",
                table: "PlanMealItems");

            migrationBuilder.DropColumn(
                name: "AtUtc",
                table: "MealCompletions");

            migrationBuilder.DropColumn(
                name: "DietPlanMealId",
                table: "MealCompletions");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "MealCompletions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "MealCompletions");

            migrationBuilder.RenameColumn(
                name: "DietitianId",
                table: "MealCompletions",
                newName: "PlanMealItemId");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "MealCompletions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "MealCompletions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "RecipeId",
                table: "Ingredients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecipeId1",
                table: "Ingredients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecipeId2",
                table: "Ingredients",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_ClientId",
                table: "MealCompletions",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_PlanMealItemId",
                table: "MealCompletions",
                column: "PlanMealItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_MealCompletions_Client_MealItem",
                table: "MealCompletions",
                columns: new[] { "ClientId", "PlanMealItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Ingredients_RecipeId",
                table: "Ingredients",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_Ingredients_RecipeId1",
                table: "Ingredients",
                column: "RecipeId1");

            migrationBuilder.CreateIndex(
                name: "IX_Ingredients_RecipeId2",
                table: "Ingredients",
                column: "RecipeId2");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianClientLinks_IsActive",
                table: "DietitianClientLinks",
                column: "IsActive");

            migrationBuilder.AddForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId",
                table: "Ingredients",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId1",
                table: "Ingredients",
                column: "RecipeId1",
                principalTable: "Recipes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Ingredients_Recipes_RecipeId2",
                table: "Ingredients",
                column: "RecipeId2",
                principalTable: "Recipes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MealCompletions_PlanMealItems_PlanMealItemId",
                table: "MealCompletions",
                column: "PlanMealItemId",
                principalTable: "PlanMealItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
