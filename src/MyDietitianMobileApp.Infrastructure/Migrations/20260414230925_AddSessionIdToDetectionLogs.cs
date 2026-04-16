using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionIdToDetectionLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SessionId",
                table: "IngredientImageDetectionLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_IngredientImageDetectionLogs_SessionId",
                table: "IngredientImageDetectionLogs",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_IngredientImageDetectionLogs_SessionId",
                table: "IngredientImageDetectionLogs");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "IngredientImageDetectionLogs");
        }
    }
}
