using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGamificationEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClientAchievementUnlocks",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    BadgeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CurrentLevel = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    UnlockedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastNotifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientAchievementUnlocks", x => new { x.ClientId, x.BadgeId });
                    table.ForeignKey(
                        name: "FK_ClientAchievementUnlocks_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientEngagementEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DietitianId = table.Column<Guid>(type: "uuid", nullable: true),
                    EventType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EventDate = table.Column<DateOnly>(type: "date", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MetaJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientEngagementEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientEngagementEvents_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientEngagementEvents_Dietitians_DietitianId",
                        column: x => x.DietitianId,
                        principalTable: "Dietitians",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ClientGamificationSnapshots",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    PrimaryTrack = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PrimaryScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    AdherenceScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    EngagementScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    QualifiedForStreak = table.Column<bool>(type: "boolean", nullable: false),
                    CurrentStreak = table.Column<int>(type: "integer", nullable: false),
                    BestStreak = table.Column<int>(type: "integer", nullable: false),
                    PlannedMeals = table.Column<int>(type: "integer", nullable: false),
                    DoneMeals = table.Column<int>(type: "integer", nullable: false),
                    AlternativeMeals = table.Column<int>(type: "integer", nullable: false),
                    SkippedMeals = table.Column<int>(type: "integer", nullable: false),
                    WaterGlasses = table.Column<int>(type: "integer", nullable: false),
                    WaterGoalHit = table.Column<bool>(type: "boolean", nullable: false),
                    KitchenEvents = table.Column<int>(type: "integer", nullable: false),
                    MeasurementLogged = table.Column<bool>(type: "boolean", nullable: false),
                    CareMessageSent = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientGamificationSnapshots", x => new { x.ClientId, x.Date });
                    table.ForeignKey(
                        name: "FK_ClientGamificationSnapshots_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientAchievementUnlocks_UnlockedAtUtc",
                table: "ClientAchievementUnlocks",
                column: "UnlockedAtUtc",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ClientEngagementEvents_ClientId_EventDate_EventType",
                table: "ClientEngagementEvents",
                columns: new[] { "ClientId", "EventDate", "EventType" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientEngagementEvents_DietitianId_EventDate",
                table: "ClientEngagementEvents",
                columns: new[] { "DietitianId", "EventDate" },
                filter: "\"DietitianId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGamificationSnapshots_ClientId_Date",
                table: "ClientGamificationSnapshots",
                columns: new[] { "ClientId", "Date" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ClientGamificationSnapshots_Date_QualifiedForStreak",
                table: "ClientGamificationSnapshots",
                columns: new[] { "Date", "QualifiedForStreak" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientAchievementUnlocks");

            migrationBuilder.DropTable(
                name: "ClientEngagementEvents");

            migrationBuilder.DropTable(
                name: "ClientGamificationSnapshots");
        }
    }
}
