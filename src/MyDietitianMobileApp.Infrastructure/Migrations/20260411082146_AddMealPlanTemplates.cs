using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMealPlanTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MealPlanTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MealPlanTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MealPlanTemplateItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Time = table.Column<TimeSpan>(type: "time", nullable: false),
                    MealType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Calories = table.Column<int>(type: "integer", nullable: true),
                    ProteinGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    CarbsGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    FatGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MealPlanTemplateItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MealPlanTemplateItems_MealPlanTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "MealPlanTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MealPlanTemplateItems_TemplateId",
                table: "MealPlanTemplateItems",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_MealPlanTemplates_DietitianId",
                table: "MealPlanTemplates",
                column: "DietitianId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MealPlanTemplateItems");

            migrationBuilder.DropTable(
                name: "MealPlanTemplates");
        }
    }
}
