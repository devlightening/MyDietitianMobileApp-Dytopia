using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIngredientAcquisitionTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IngredientAcquisitionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RawInput = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ResolvedIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    MappingType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Confidence = table.Column<double>(type: "double precision", precision: 5, scale: 4, nullable: false),
                    RequiredConfirmation = table.Column<bool>(type: "boolean", nullable: false),
                    ConfirmedByUser = table.Column<bool>(type: "boolean", nullable: false),
                    InteractionCount = table.Column<int>(type: "integer", nullable: false),
                    LatencyMs = table.Column<long>(type: "bigint", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientAcquisitionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientAcquisitionLogs_Ingredients_ResolvedIngredientId",
                        column: x => x.ResolvedIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProductBarcodeMappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Barcode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Brand = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CanonicalIngredientId = table.Column<Guid>(type: "uuid", nullable: true),
                    MappingType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Confidence = table.Column<double>(type: "double precision", precision: 5, scale: 4, nullable: false),
                    SourceProvider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IsManualOverride = table.Column<bool>(type: "boolean", nullable: false),
                    LastVerifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductBarcodeMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductBarcodeMappings_Ingredients_CanonicalIngredientId",
                        column: x => x.CanonicalIngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IngredientAcquisitionLogs_CreatedAtUtc",
                table: "IngredientAcquisitionLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientAcquisitionLogs_ResolvedIngredientId",
                table: "IngredientAcquisitionLogs",
                column: "ResolvedIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientAcquisitionLogs_SessionId",
                table: "IngredientAcquisitionLogs",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientAcquisitionLogs_Source",
                table: "IngredientAcquisitionLogs",
                column: "Source");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientAcquisitionLogs_Source_MappingType",
                table: "IngredientAcquisitionLogs",
                columns: new[] { "Source", "MappingType" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductBarcodeMappings_Barcode",
                table: "ProductBarcodeMappings",
                column: "Barcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductBarcodeMappings_CanonicalIngredientId",
                table: "ProductBarcodeMappings",
                column: "CanonicalIngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBarcodeMappings_LastVerifiedAtUtc",
                table: "ProductBarcodeMappings",
                column: "LastVerifiedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBarcodeMappings_MappingType",
                table: "ProductBarcodeMappings",
                column: "MappingType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngredientAcquisitionLogs");

            migrationBuilder.DropTable(
                name: "ProductBarcodeMappings");
        }
    }
}
