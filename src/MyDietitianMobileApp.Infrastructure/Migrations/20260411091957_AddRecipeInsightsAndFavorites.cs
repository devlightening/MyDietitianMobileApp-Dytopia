using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeInsightsAndFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAtUtc",
                table: "Recipes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CookTimeMinutes",
                table: "Recipes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Recipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PrepTimeMinutes",
                table: "Recipes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Servings",
                table: "Recipes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TagsJson",
                table: "Recipes",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DietitianRecipeFavorites",
                columns: table => new
                {
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DietitianRecipeFavorites", x => new { x.DietitianId, x.RecipeId });
                    table.ForeignKey(
                        name: "FK_DietitianRecipeFavorites_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DietitianRecipeFavorites_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Recipes_IsArchived",
                table: "Recipes",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianRecipeFavorites_CreatedAtUtc",
                table: "DietitianRecipeFavorites",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_DietitianRecipeFavorites_RecipeId",
                table: "DietitianRecipeFavorites",
                column: "RecipeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DietitianRecipeFavorites");

            migrationBuilder.DropIndex(
                name: "IX_Recipes_IsArchived",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "ArchivedAtUtc",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "CookTimeMinutes",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "PrepTimeMinutes",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "Servings",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "TagsJson",
                table: "Recipes");
        }
    }
}
