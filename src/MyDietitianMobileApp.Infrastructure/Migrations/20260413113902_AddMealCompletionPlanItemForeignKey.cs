using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMealCompletionPlanItemForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClientMealPlans_Dietitians_DietitianId",
                table: "ClientMealPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_ClientMeals_Recipes_RecipeId",
                table: "ClientMeals");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanMealItems_MealCompletions_CompletionId",
                table: "PlanMealItems");

            migrationBuilder.DropIndex(
                name: "IX_PlanMealItems_CompletionId",
                table: "PlanMealItems");

            migrationBuilder.DropIndex(
                name: "IX_ClientMealPlans_ClientId",
                table: "ClientMealPlans");

            migrationBuilder.DropIndex(
                name: "IX_ClientMealPlans_DietitianId",
                table: "ClientMealPlans");

            migrationBuilder.DropColumn(
                name: "CompletionId",
                table: "PlanMealItems");

            migrationBuilder.AlterColumn<string>(
                name: "MealType",
                table: "ClientMeals",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "ClientMealPlans",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "ClientMealPlans",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_DietPlanMealId",
                table: "MealCompletions",
                column: "DietPlanMealId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeals_ClientMealPlanId_DayOfWeek_MealType",
                table: "ClientMeals",
                columns: new[] { "ClientMealPlanId", "DayOfWeek", "MealType" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_ClientId_IsActive",
                table: "ClientMealPlans",
                columns: new[] { "ClientId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_DietitianId_StartDate",
                table: "ClientMealPlans",
                columns: new[] { "DietitianId", "StartDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_ClientMealPlans_Dietitians_DietitianId",
                table: "ClientMealPlans",
                column: "DietitianId",
                principalTable: "Dietitians",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ClientMeals_Recipes_RecipeId",
                table: "ClientMeals",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Delete orphan MealCompletions that reference non-existent PlanMealItems
            migrationBuilder.Sql(@"
                DELETE FROM ""MealCompletions""
                WHERE ""DietPlanMealId"" IS NOT NULL
                  AND ""DietPlanMealId"" NOT IN (SELECT ""Id"" FROM ""PlanMealItems"");
            ");

            migrationBuilder.AddForeignKey(
                name: "FK_MealCompletions_PlanMealItems_DietPlanMealId",
                table: "MealCompletions",
                column: "DietPlanMealId",
                principalTable: "PlanMealItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClientMealPlans_Dietitians_DietitianId",
                table: "ClientMealPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_ClientMeals_Recipes_RecipeId",
                table: "ClientMeals");

            migrationBuilder.DropForeignKey(
                name: "FK_MealCompletions_PlanMealItems_DietPlanMealId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_MealCompletions_DietPlanMealId",
                table: "MealCompletions");

            migrationBuilder.DropIndex(
                name: "IX_ClientMeals_ClientMealPlanId_DayOfWeek_MealType",
                table: "ClientMeals");

            migrationBuilder.DropIndex(
                name: "IX_ClientMealPlans_ClientId_IsActive",
                table: "ClientMealPlans");

            migrationBuilder.DropIndex(
                name: "IX_ClientMealPlans_DietitianId_StartDate",
                table: "ClientMealPlans");

            migrationBuilder.AddColumn<Guid>(
                name: "CompletionId",
                table: "PlanMealItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MealType",
                table: "ClientMeals",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "ClientMealPlans",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "ClientMealPlans",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanMealItems_CompletionId",
                table: "PlanMealItems",
                column: "CompletionId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_ClientId",
                table: "ClientMealPlans",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientMealPlans_DietitianId",
                table: "ClientMealPlans",
                column: "DietitianId");

            migrationBuilder.AddForeignKey(
                name: "FK_ClientMealPlans_Dietitians_DietitianId",
                table: "ClientMealPlans",
                column: "DietitianId",
                principalTable: "Dietitians",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ClientMeals_Recipes_RecipeId",
                table: "ClientMeals",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanMealItems_MealCompletions_CompletionId",
                table: "PlanMealItems",
                column: "CompletionId",
                principalTable: "MealCompletions",
                principalColumn: "Id");
        }
    }
}
