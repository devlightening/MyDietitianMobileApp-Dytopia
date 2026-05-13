using Microsoft.EntityFrameworkCore.Migrations;
using MyDietitianMobileApp.Infrastructure.Persistence;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(AppDbContext))]
    [Migration("20260506033000_AddMealLogAiAnalysis")]
    public partial class AddMealLogAiAnalysis : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FoodName",
                table: "ClientMealLogs",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CaloriesKcal",
                table: "ClientMealLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProteinGrams",
                table: "ClientMealLogs",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CarbsGrams",
                table: "ClientMealLogs",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FatGrams",
                table: "ClientMealLogs",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PortionCount",
                table: "ClientMealLogs",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<decimal>(
                name: "AiConfidence",
                table: "ClientMealLogs",
                type: "numeric(4,2)",
                precision: 4,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnalysisJson",
                table: "ClientMealLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "ClientMealLogs",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "manual");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FoodName", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "CaloriesKcal", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "ProteinGrams", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "CarbsGrams", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "FatGrams", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "PortionCount", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "AiConfidence", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "AnalysisJson", table: "ClientMealLogs");
            migrationBuilder.DropColumn(name: "Source", table: "ClientMealLogs");
        }
    }
}
