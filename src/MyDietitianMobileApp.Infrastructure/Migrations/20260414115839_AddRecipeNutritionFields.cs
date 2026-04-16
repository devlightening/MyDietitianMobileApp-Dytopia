using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeNutritionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CaloriesKcal",
                table: "Recipes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CarbsGrams",
                table: "Recipes",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FatGrams",
                table: "Recipes",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProteinGrams",
                table: "Recipes",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CaloriesKcal",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "CarbsGrams",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "FatGrams",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "ProteinGrams",
                table: "Recipes");
        }
    }
}
