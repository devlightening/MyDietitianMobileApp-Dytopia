using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVisionDetectionTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IngredientImageDetectionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: true),
                    ImageSource = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RawLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    NormalizedLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PredictedIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConfirmedIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Confidence = table.Column<double>(type: "double precision", precision: 5, scale: 4, nullable: false),
                    MatchType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    WasAccepted = table.Column<bool>(type: "boolean", nullable: true),
                    WasAutoSelected = table.Column<bool>(type: "boolean", nullable: false),
                    UsedOpenAiFallback = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientImageDetectionLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VisionLabelMappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RawLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    NormalizedLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConfidenceThreshold = table.Column<double>(type: "double precision", precision: 5, scale: 4, nullable: false, defaultValue: 0.69999999999999996),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VisionLabelMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VisionLabelMappings_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IngredientImageDetectionLogs_ClientId_CreatedAtUtc",
                table: "IngredientImageDetectionLogs",
                columns: new[] { "ClientId", "CreatedAtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_IngredientImageDetectionLogs_MatchType",
                table: "IngredientImageDetectionLogs",
                column: "MatchType");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientImageDetectionLogs_UsedOpenAiFallback",
                table: "IngredientImageDetectionLogs",
                column: "UsedOpenAiFallback");

            migrationBuilder.CreateIndex(
                name: "IX_VisionLabelMappings_IngredientId",
                table: "VisionLabelMappings",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_VisionLabelMappings_IsApproved",
                table: "VisionLabelMappings",
                column: "IsApproved");

            migrationBuilder.CreateIndex(
                name: "IX_VisionLabelMappings_NormalizedLabel",
                table: "VisionLabelMappings",
                column: "NormalizedLabel");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngredientImageDetectionLogs");

            migrationBuilder.DropTable(
                name: "VisionLabelMappings");
        }
    }
}
