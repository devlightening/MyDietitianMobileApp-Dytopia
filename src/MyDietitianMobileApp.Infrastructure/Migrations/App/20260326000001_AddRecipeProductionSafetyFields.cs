using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <summary>
    /// Adds production-safety flags to the Recipes table so that demo/test/seed records
    /// and unpublished drafts are never surfaced in live user flows.
    ///
    /// Fields:
    ///   IsDemo                — marks demo / test / seed recipes (DatabaseSeeder leftovers, etc.)
    ///   IsDraft               — recipe not yet published by the dietitian
    ///   IsHiddenFromProduction — master kill-switch independent of the other two flags
    ///
    /// Default = false for all three so existing rows remain visible (no data loss).
    /// </summary>
    public partial class AddRecipeProductionSafetyFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDemo",
                table: "Recipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDraft",
                table: "Recipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsHiddenFromProduction",
                table: "Recipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Recipes_ProductionSafetyFlags",
                table: "Recipes",
                columns: new[] { "IsDemo", "IsDraft", "IsHiddenFromProduction" });

            // Mark any remaining demo / seed records that slipped in via the old DatabaseSeeder.
            // "Verified Demo Pasta" and similar test entries are identified by their names.
            migrationBuilder.Sql(@"
                UPDATE ""Recipes""
                SET ""IsDemo"" = TRUE
                WHERE
                    ""Name"" ILIKE '%demo%'
                    OR ""Name"" ILIKE '%verified demo%'
                    OR ""Name"" ILIKE '%test%'
                    OR ""Name"" ILIKE '%seed%'
                    OR ""Description"" ILIKE '%[demo]%'
                    OR ""Description"" ILIKE '%[test]%'
                    OR ""Description"" ILIKE '%[seed]%';
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Recipes_ProductionSafetyFlags",
                table: "Recipes");

            migrationBuilder.DropColumn(name: "IsDemo",                 table: "Recipes");
            migrationBuilder.DropColumn(name: "IsDraft",                table: "Recipes");
            migrationBuilder.DropColumn(name: "IsHiddenFromProduction", table: "Recipes");
        }
    }
}
