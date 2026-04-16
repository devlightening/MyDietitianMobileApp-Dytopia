using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClientMeasurementsUnified : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClientMeasurements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RecordedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    WeightKg = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    HeightCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    BodyFatPercent = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    MusclePercent = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    WaterPercent = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    WaistCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    HipCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    ChestCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    Bmi = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    BmiCategory = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Bmr = table.Column<decimal>(type: "numeric(7,0)", precision: 7, scale: 0, nullable: true),
                    WaistHipRatio = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsClinicallyVerified = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientMeasurements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientMeasurements_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeasurements_ClientId_RecordedAtUtc",
                table: "ClientMeasurements",
                columns: new[] { "ClientId", "RecordedAtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ClientMeasurements_ClientId_SourceType",
                table: "ClientMeasurements",
                columns: new[] { "ClientId", "SourceType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientMeasurements");
        }
    }
}
