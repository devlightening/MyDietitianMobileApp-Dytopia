using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIngredientTaxonomy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "StartDate",
                table: "AccessKeys",
                newName: "ExpiresAtUtc");

            migrationBuilder.RenameColumn(
                name: "Key",
                table: "AccessKeys",
                newName: "KeyValue");

            migrationBuilder.RenameColumn(
                name: "EndDate",
                table: "AccessKeys",
                newName: "CreatedAtUtc");

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "AccessKeys",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ClientIngredientProhibitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientIngredientProhibitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientIngredientProhibitions_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientIngredientProhibitions_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMealPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMealPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMealPlans_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMealPlans_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngredientCompatibilityRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequiredIngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidateIngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompatibilityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ScorePenalty = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientCompatibilityRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientCompatibilityRules_Ingredients_CandidateIngredien~",
                        column: x => x.CandidateIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IngredientCompatibilityRules_Ingredients_RequiredIngredient~",
                        column: x => x.RequiredIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "IngredientFamilies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientFamilies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IngredientNormalizationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RawInput = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NormalizedInput = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MatchedBy = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MatchedIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedCanonicalName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Confidence = table.Column<double>(type: "double precision", nullable: false),
                    CandidateSummaryJson = table.Column<string>(type: "jsonb", nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RequestPath = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientNormalizationLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeIngredients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric", nullable: true),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeIngredients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecipeIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeIngredients_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeProhibitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeProhibitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecipeProhibitions_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeProhibitions_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeRecommendationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Flow = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: true),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlannedRecipeId = table.Column<Guid>(type: "uuid", nullable: true),
                    SelectedRecipeId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalCookable = table.Column<bool>(type: "boolean", nullable: false),
                    MatchPercentage = table.Column<decimal>(type: "numeric", nullable: true),
                    MissingMandatoryCount = table.Column<int>(type: "integer", nullable: false),
                    ProhibitedRejected = table.Column<bool>(type: "boolean", nullable: false),
                    UsedSubstitutes = table.Column<bool>(type: "boolean", nullable: false),
                    MissingMandatoryIdsJson = table.Column<string>(type: "jsonb", nullable: true),
                    AdditionalMetaJson = table.Column<string>(type: "jsonb", nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeRecommendationLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeSubstitutes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequiredIngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubstituteIngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeSubstitutes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecipeSubstitutes_Ingredients_RequiredIngredientId",
                        column: x => x.RequiredIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeSubstitutes_Ingredients_SubstituteIngredientId",
                        column: x => x.SubstituteIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeSubstitutes_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientMeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientMealPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    MealType = table.Column<string>(type: "text", nullable: false),
                    Servings = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMeals_ClientMealPlans_ClientMealPlanId",
                        column: x => x.ClientMealPlanId,
                        principalTable: "ClientMealPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientMeals_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngredientFamilyMembers",
                columns: table => new
                {
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientFamilyMembers", x => new { x.FamilyId, x.IngredientId });
                    table.ForeignKey(
                        name: "FK_IngredientFamilyMembers_IngredientFamilies_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "IngredientFamilies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IngredientFamilyMembers_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientIngredientProhibitions_ClientId",
                table: "ClientIngredientProhibitions",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientIngredientProhibitions_IngredientId",
                table: "ClientIngredientProhibitions",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_ClientId",
                table: "ClientMealPlans",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_DietitianId",
                table: "ClientMealPlans",
                column: "DietitianId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeals_ClientMealPlanId",
                table: "ClientMeals",
                column: "ClientMealPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeals_RecipeId",
                table: "ClientMeals",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientCompatibilityRules_CandidateIngredientId",
                table: "IngredientCompatibilityRules",
                column: "CandidateIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientCompatibilityRules_IsActive",
                table: "IngredientCompatibilityRules",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientCompatibilityRules_RequiredIngredientId",
                table: "IngredientCompatibilityRules",
                column: "RequiredIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientCompatibilityRules_RequiredIngredientId_Candidate~",
                table: "IngredientCompatibilityRules",
                columns: new[] { "RequiredIngredientId", "CandidateIngredientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IngredientFamilies_IsActive",
                table: "IngredientFamilies",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientFamilies_Name",
                table: "IngredientFamilies",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IngredientFamilies_SortOrder",
                table: "IngredientFamilies",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientFamilyMembers_IngredientId",
                table: "IngredientFamilyMembers",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNormalizationLogs_CreatedAtUtc",
                table: "IngredientNormalizationLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNormalizationLogs_MatchedBy",
                table: "IngredientNormalizationLogs",
                column: "MatchedBy");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNormalizationLogs_MatchedIngredientId",
                table: "IngredientNormalizationLogs",
                column: "MatchedIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNormalizationLogs_Status",
                table: "IngredientNormalizationLogs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredients_IngredientId",
                table: "RecipeIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredients_RecipeId",
                table: "RecipeIngredients",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeProhibitions_IngredientId",
                table: "RecipeProhibitions",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeProhibitions_RecipeId",
                table: "RecipeProhibitions",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_ClientId",
                table: "RecipeRecommendationLogs",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_CreatedAtUtc",
                table: "RecipeRecommendationLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_DietitianId",
                table: "RecipeRecommendationLogs",
                column: "DietitianId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_Flow",
                table: "RecipeRecommendationLogs",
                column: "Flow");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_PlannedRecipeId",
                table: "RecipeRecommendationLogs",
                column: "PlannedRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeRecommendationLogs_SelectedRecipeId",
                table: "RecipeRecommendationLogs",
                column: "SelectedRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeSubstitutes_RecipeId",
                table: "RecipeSubstitutes",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeSubstitutes_RequiredIngredientId",
                table: "RecipeSubstitutes",
                column: "RequiredIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeSubstitutes_SubstituteIngredientId",
                table: "RecipeSubstitutes",
                column: "SubstituteIngredientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientIngredientProhibitions");

            migrationBuilder.DropTable(
                name: "ClientMeals");

            migrationBuilder.DropTable(
                name: "IngredientCompatibilityRules");

            migrationBuilder.DropTable(
                name: "IngredientFamilyMembers");

            migrationBuilder.DropTable(
                name: "IngredientNormalizationLogs");

            migrationBuilder.DropTable(
                name: "RecipeIngredients");

            migrationBuilder.DropTable(
                name: "RecipeProhibitions");

            migrationBuilder.DropTable(
                name: "RecipeRecommendationLogs");

            migrationBuilder.DropTable(
                name: "RecipeSubstitutes");

            migrationBuilder.DropTable(
                name: "ClientMealPlans");

            migrationBuilder.DropTable(
                name: "IngredientFamilies");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "AccessKeys");

            migrationBuilder.RenameColumn(
                name: "KeyValue",
                table: "AccessKeys",
                newName: "Key");

            migrationBuilder.RenameColumn(
                name: "ExpiresAtUtc",
                table: "AccessKeys",
                newName: "StartDate");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "AccessKeys",
                newName: "EndDate");
        }
    }
}
