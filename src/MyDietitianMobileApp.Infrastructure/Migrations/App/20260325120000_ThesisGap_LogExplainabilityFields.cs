using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class ThesisGap_LogExplainabilityFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── IngredientNormalizationLogs — GAP 4 ──────────────────────────────
            // Timing and complexity metrics required for thesis Chapter 4 (performance evaluation).

            migrationBuilder.AddColumn<long>(
                name: "ElapsedTimeMs",
                table: "IngredientNormalizationLogs",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "CandidateCount",
                table: "IngredientNormalizationLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AmbiguousCandidateCount",
                table: "IngredientNormalizationLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // ── RecipeRecommendationLogs — GAP 5 ────────────────────────────────
            // Explainability fields required for thesis Chapter 5 (evaluation / rejection analysis).

            migrationBuilder.AddColumn<string>(
                name: "RejectionReasonSummary",
                table: "RecipeRecommendationLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MissingMandatoryNamesJson",
                table: "RecipeRecommendationLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubstituteUsageSummaryJson",
                table: "RecipeRecommendationLogs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ElapsedTimeMs",
                table: "IngredientNormalizationLogs");

            migrationBuilder.DropColumn(
                name: "CandidateCount",
                table: "IngredientNormalizationLogs");

            migrationBuilder.DropColumn(
                name: "AmbiguousCandidateCount",
                table: "IngredientNormalizationLogs");

            migrationBuilder.DropColumn(
                name: "RejectionReasonSummary",
                table: "RecipeRecommendationLogs");

            migrationBuilder.DropColumn(
                name: "MissingMandatoryNamesJson",
                table: "RecipeRecommendationLogs");

            migrationBuilder.DropColumn(
                name: "SubstituteUsageSummaryJson",
                table: "RecipeRecommendationLogs");
        }
    }
}
