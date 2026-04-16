using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class Sprint1_MealTypeAndAlternativeCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MealType",
                table: "PlanMealItems",
                type: "integer",
                nullable: false,
                defaultValue: 6);

            migrationBuilder.AddColumn<Guid>(
                name: "RecipeId",
                table: "PlanMealItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AlternativeRecipeId",
                table: "MealCompletions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanMealItems_RecipeId",
                table: "PlanMealItems",
                column: "RecipeId");

            migrationBuilder.AddForeignKey(
                name: "FK_PlanMealItems_Recipes_RecipeId",
                table: "PlanMealItems",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PlanMealItems_Recipes_RecipeId",
                table: "PlanMealItems");

            migrationBuilder.DropIndex(
                name: "IX_PlanMealItems_RecipeId",
                table: "PlanMealItems");

            migrationBuilder.DropColumn(
                name: "MealType",
                table: "PlanMealItems");

            migrationBuilder.DropColumn(
                name: "RecipeId",
                table: "PlanMealItems");

            migrationBuilder.DropColumn(
                name: "AlternativeRecipeId",
                table: "MealCompletions");
        }
    }
}
