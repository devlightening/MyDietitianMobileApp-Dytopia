using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class AddDietitianSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DietPlanDays_DietPlans_DietPlanId1",
                table: "DietPlanDays");

            migrationBuilder.DropForeignKey(
                name: "FK_DietPlanMeals_DietPlanDays_DietPlanDayId1",
                table: "DietPlanMeals");

            migrationBuilder.DropIndex(
                name: "IX_DietPlanMeals_DietPlanDayId1",
                table: "DietPlanMeals");

            migrationBuilder.DropIndex(
                name: "IX_DietPlanDays_DietPlanId1",
                table: "DietPlanDays");

            migrationBuilder.DropColumn(
                name: "DietPlanDayId1",
                table: "DietPlanMeals");

            migrationBuilder.DropColumn(
                name: "DietPlanId1",
                table: "DietPlanDays");

            migrationBuilder.AlterColumn<string>(
                name: "PrimaryColorHex",
                table: "DietitianBrandingConfigs",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#4A7C59",
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7,
                oldDefaultValue: "#111111");

            migrationBuilder.AlterColumn<string>(
                name: "ClinicName",
                table: "DietitianBrandingConfigs",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);

            migrationBuilder.AlterColumn<string>(
                name: "AccentColorHex",
                table: "DietitianBrandingConfigs",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#FF8C61",
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7,
                oldDefaultValue: "#22C55E");

            migrationBuilder.CreateTable(
                name: "DietitianSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DietitianDisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PrimaryColorHex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false, defaultValue: "#4A7C59"),
                    AccentColorHex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false, defaultValue: "#8FBC8F"),
                    ThemePresetKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    LogoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DietitianSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DietitianSettings_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DietitianSettings_DietitianId",
                table: "DietitianSettings",
                column: "DietitianId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DietitianSettings");

            migrationBuilder.AddColumn<Guid>(
                name: "DietPlanDayId1",
                table: "DietPlanMeals",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "DietPlanId1",
                table: "DietPlanDays",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<string>(
                name: "PrimaryColorHex",
                table: "DietitianBrandingConfigs",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#111111",
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7,
                oldDefaultValue: "#4A7C59");

            migrationBuilder.AlterColumn<string>(
                name: "ClinicName",
                table: "DietitianBrandingConfigs",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AccentColorHex",
                table: "DietitianBrandingConfigs",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#22C55E",
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7,
                oldDefaultValue: "#FF8C61");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlanMeals_DietPlanDayId1",
                table: "DietPlanMeals",
                column: "DietPlanDayId1");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlanDays_DietPlanId1",
                table: "DietPlanDays",
                column: "DietPlanId1");

            migrationBuilder.AddForeignKey(
                name: "FK_DietPlanDays_DietPlans_DietPlanId1",
                table: "DietPlanDays",
                column: "DietPlanId1",
                principalTable: "DietPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DietPlanMeals_DietPlanDays_DietPlanDayId1",
                table: "DietPlanMeals",
                column: "DietPlanDayId1",
                principalTable: "DietPlanDays",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
