using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyGameDifficultyIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_DailyGameChallenges_Date_Language_GameType";

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DailyGameChallenges_Date_Language_GameType_Difficulty"
                    ON "DailyGameChallenges" ("Date", "Language", "GameType", "Difficulty");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_DailyGameChallenges_Date_Language_GameType_Difficulty";

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DailyGameChallenges_Date_Language_GameType"
                    ON "DailyGameChallenges" ("Date", "Language", "GameType");
                """);
        }
    }
}
