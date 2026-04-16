using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class AddRecipeImportTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RecipeImportSessionIssues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionRecipeId = table.Column<Guid>(type: "uuid", nullable: true),
                    SessionIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    IsResolved = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeImportSessionIssues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeImportSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FileType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ParsedRecipeCount = table.Column<int>(type: "integer", nullable: false),
                    UnmatchedIngredientCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeImportSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeImportSessionRecipes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawTitle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NormalizedTitle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    HasDuplicate = table.Column<bool>(type: "boolean", nullable: false),
                    ExistingRecipeId = table.Column<Guid>(type: "uuid", nullable: true),
                    DuplicateResolutionMode = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsSkipped = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeImportSessionRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecipeImportSessionRecipes_RecipeImportSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "RecipeImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecipeImportSessionIngredients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionRecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    AmountRaw = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AmountValue = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    UnitNormalized = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    MatchedIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedCanonicalName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    MatchType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    MatchConfidence = table.Column<double>(type: "double precision", nullable: false),
                    IsResolved = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeImportSessionIngredients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecipeImportSessionIngredients_RecipeImportSessionRecipes_S~",
                        column: x => x.SessionRecipeId,
                        principalTable: "RecipeImportSessionRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RecipeImportSessionIngredients_SessionRecipeId",
                table: "RecipeImportSessionIngredients",
                column: "SessionRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeImportSessionIssues_SessionId",
                table: "RecipeImportSessionIssues",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeImportSessionIssues_SessionRecipeId",
                table: "RecipeImportSessionIssues",
                column: "SessionRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeImportSessionRecipes_SessionId",
                table: "RecipeImportSessionRecipes",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_RecipeImportSessions_DietitianId_CreatedAt",
                table: "RecipeImportSessions",
                columns: new[] { "DietitianId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecipeImportSessionIngredients");

            migrationBuilder.DropTable(
                name: "RecipeImportSessionIssues");

            migrationBuilder.DropTable(
                name: "RecipeImportSessionRecipes");

            migrationBuilder.DropTable(
                name: "RecipeImportSessions");
        }
    }
}
