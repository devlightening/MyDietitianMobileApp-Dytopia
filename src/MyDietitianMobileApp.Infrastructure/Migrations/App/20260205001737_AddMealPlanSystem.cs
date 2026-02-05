using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class AddMealPlanSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Recipes_Dietitians_DietitianId",
                table: "Recipes");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Recipes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<Guid>(
                name: "DietitianId",
                table: "Recipes",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "Recipes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Dietitians",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "ClinicName",
                table: "Dietitians",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Clients",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Clients",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateTable(
                name: "MealPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MealPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MealPlans_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MealPlans_Dietitians_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanMealItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Time = table.Column<TimeSpan>(type: "time", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    Calories = table.Column<int>(type: "integer", nullable: true),
                    ProteinGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    CarbsGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    FatGrams = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanMealItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanMealItems_MealPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "MealPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MealCompletions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanMealItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MealCompletions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MealCompletions_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MealCompletions_PlanMealItems_PlanMealItemId",
                        column: x => x.PlanMealItemId,
                        principalTable: "PlanMealItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserMeasurements_ClientId_CreatedAt",
                table: "UserMeasurements",
                columns: new[] { "ClientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DietitianClientLinks_DietitianId_ClientId",
                table: "DietitianClientLinks",
                columns: new[] { "DietitianId", "ClientId" });

            migrationBuilder.CreateIndex(
                name: "IX_DietitianClientLinks_IsActive",
                table: "DietitianClientLinks",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_ClientId",
                table: "MealCompletions",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_MealCompletions_PlanMealItemId",
                table: "MealCompletions",
                column: "PlanMealItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_MealCompletions_Client_MealItem",
                table: "MealCompletions",
                columns: new[] { "ClientId", "PlanMealItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_ClientId_Date",
                table: "MealPlans",
                columns: new[] { "ClientId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_CreatedBy",
                table: "MealPlans",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_Status",
                table: "MealPlans",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PlanMealItems_PlanId",
                table: "PlanMealItems",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanMealItems_Time",
                table: "PlanMealItems",
                column: "Time");

            migrationBuilder.AddForeignKey(
                name: "FK_Recipes_Dietitians_DietitianId",
                table: "Recipes",
                column: "DietitianId",
                principalTable: "Dietitians",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Recipes_Dietitians_DietitianId",
                table: "Recipes");

            migrationBuilder.DropTable(
                name: "MealCompletions");

            migrationBuilder.DropTable(
                name: "PlanMealItems");

            migrationBuilder.DropTable(
                name: "MealPlans");

            migrationBuilder.DropIndex(
                name: "IX_UserMeasurements_ClientId_CreatedAt",
                table: "UserMeasurements");

            migrationBuilder.DropIndex(
                name: "IX_DietitianClientLinks_DietitianId_ClientId",
                table: "DietitianClientLinks");

            migrationBuilder.DropIndex(
                name: "IX_DietitianClientLinks_IsActive",
                table: "DietitianClientLinks");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "Recipes");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Recipes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<Guid>(
                name: "DietitianId",
                table: "Recipes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Dietitians",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "ClinicName",
                table: "Dietitians",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Clients",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Clients",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);

            migrationBuilder.AddForeignKey(
                name: "FK_Recipes_Dietitians_DietitianId",
                table: "Recipes",
                column: "DietitianId",
                principalTable: "Dietitians",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
