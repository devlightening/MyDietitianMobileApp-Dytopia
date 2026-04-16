using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeImportV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ConfidenceScore",
                table: "RecipeImportSessions",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetectedRecipeBoundaryMode",
                table: "RecipeImportSessions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentKind",
                table: "RecipeImportSessions",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ParserUsed",
                table: "RecipeImportSessions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateHeaderHintsJson",
                table: "RecipeImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateKey",
                table: "RecipeImportSessions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WarningsJson",
                table: "RecipeImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CookTimeText",
                table: "RecipeImportSessionRecipes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "NeedsReview",
                table: "RecipeImportSessionRecipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PrepTimeText",
                table: "RecipeImportSessionRecipes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RawSourceBlock",
                table: "RecipeImportSessionRecipes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServingsText",
                table: "RecipeImportSessionRecipes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StepsJson",
                table: "RecipeImportSessionRecipes",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TagsJson",
                table: "RecipeImportSessionRecipes",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Hint",
                table: "RecipeImportSessionIssues",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IssueCodesJson",
                table: "RecipeImportSessionIngredients",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "NeedsReview",
                table: "RecipeImportSessionIngredients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ParseConfidence",
                table: "RecipeImportSessionIngredients",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "RawLineText",
                table: "RecipeImportSessionIngredients",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ImportTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DocumentKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ParserUsed = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    HeaderHintsJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUsedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportTemplates_DietitianId_TemplateKey",
                table: "ImportTemplates",
                columns: new[] { "DietitianId", "TemplateKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportTemplates");

            migrationBuilder.DropColumn(
                name: "ConfidenceScore",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "DetectedRecipeBoundaryMode",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "DocumentKind",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "ParserUsed",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "TemplateHeaderHintsJson",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "TemplateKey",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "WarningsJson",
                table: "RecipeImportSessions");

            migrationBuilder.DropColumn(
                name: "CookTimeText",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "NeedsReview",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "PrepTimeText",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "RawSourceBlock",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "ServingsText",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "StepsJson",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "TagsJson",
                table: "RecipeImportSessionRecipes");

            migrationBuilder.DropColumn(
                name: "Hint",
                table: "RecipeImportSessionIssues");

            migrationBuilder.DropColumn(
                name: "IssueCodesJson",
                table: "RecipeImportSessionIngredients");

            migrationBuilder.DropColumn(
                name: "NeedsReview",
                table: "RecipeImportSessionIngredients");

            migrationBuilder.DropColumn(
                name: "ParseConfidence",
                table: "RecipeImportSessionIngredients");

            migrationBuilder.DropColumn(
                name: "RawLineText",
                table: "RecipeImportSessionIngredients");
        }
    }
}
