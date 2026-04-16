using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCareHubClientOps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Recipes"
                ADD COLUMN IF NOT EXISTS "StepsJson" text;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "MealType",
                table: "PlanMealItems",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 6);

            migrationBuilder.Sql("""
                ALTER TABLE "Ingredients"
                ADD COLUMN IF NOT EXISTS "IsCondiment" boolean NOT NULL DEFAULT FALSE;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "ClientGoalPreferences" (
                    "ClientId" uuid NOT NULL PRIMARY KEY,
                    "PrimaryGoal" character varying(64) NOT NULL DEFAULT 'Balance',
                    "DietStyle" character varying(64) NOT NULL DEFAULT 'Flexible',
                    "CookingTimePreference" character varying(64) NOT NULL DEFAULT 'Quick',
                    "ReminderTone" character varying(64) NOT NULL DEFAULT 'Supportive',
                    "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_ClientGoalPreferences_Clients_ClientId"
                        FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS "IX_ClientGoalPreferences_UpdatedAtUtc"
                    ON "ClientGoalPreferences" ("UpdatedAtUtc");

                CREATE TABLE IF NOT EXISTS "ClientNotificationPreferences" (
                    "ClientId" uuid NOT NULL PRIMARY KEY,
                    "NotificationsEnabled" boolean NOT NULL DEFAULT TRUE,
                    "HydrationRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                    "HydrationIntervalMinutes" integer NOT NULL DEFAULT 120,
                    "HydrationStartLocalTime" time without time zone NOT NULL DEFAULT TIME '09:00',
                    "HydrationEndLocalTime" time without time zone NOT NULL DEFAULT TIME '21:00',
                    "MealPlanRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                    "MealReminderLeadMinutes" integer NOT NULL DEFAULT 20,
                    "MeasurementRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                    "MeasurementReminderDayOfWeek" integer NOT NULL DEFAULT 1,
                    "MeasurementReminderLocalTime" time without time zone NOT NULL DEFAULT TIME '20:00',
                    "ReengagementRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                    "ReengagementDelayHours" integer NOT NULL DEFAULT 48,
                    "TimeZoneId" character varying(64) NOT NULL DEFAULT 'Europe/Istanbul',
                    "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "LastAppOpenAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "LastNotificationSyncAtUtc" timestamp with time zone NULL,
                    CONSTRAINT "FK_ClientNotificationPreferences_Clients_ClientId"
                        FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS "IX_ClientNotificationPreferences_UpdatedAtUtc"
                    ON "ClientNotificationPreferences" ("UpdatedAtUtc");

                CREATE INDEX IF NOT EXISTS "IX_ClientNotificationPreferences_LastAppOpenAtUtc"
                    ON "ClientNotificationPreferences" ("LastAppOpenAtUtc");

                CREATE TABLE IF NOT EXISTS "ClientShoppingListItems" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "ClientId" uuid NOT NULL,
                    "IngredientId" uuid NULL,
                    "Title" character varying(180) NOT NULL,
                    "Quantity" numeric(10,2) NULL,
                    "Unit" character varying(50) NULL,
                    "IsChecked" boolean NOT NULL DEFAULT FALSE,
                    "SourceType" character varying(32) NOT NULL DEFAULT 'Manual',
                    "SourceReferenceId" character varying(128) NULL,
                    "Note" character varying(240) NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_ClientShoppingListItems_Clients_ClientId"
                        FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_ClientShoppingListItems_Ingredients_IngredientId"
                        FOREIGN KEY ("IngredientId") REFERENCES "Ingredients" ("Id") ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS "IX_ClientShoppingListItems_ClientId_IsChecked_UpdatedAtUtc"
                    ON "ClientShoppingListItems" ("ClientId", "IsChecked", "UpdatedAtUtc");

                CREATE INDEX IF NOT EXISTS "IX_ClientShoppingListItems_ClientId_IngredientId"
                    ON "ClientShoppingListItems" ("ClientId", "IngredientId");

                CREATE INDEX IF NOT EXISTS "IX_ClientShoppingListItems_IngredientId"
                    ON "ClientShoppingListItems" ("IngredientId");

                CREATE TABLE IF NOT EXISTS "ClientCareMessages" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "ClientId" uuid NOT NULL,
                    "DietitianId" uuid NULL,
                    "SenderRole" character varying(32) NOT NULL DEFAULT 'Client',
                    "Text" character varying(2000) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "ReadAtUtc" timestamp with time zone NULL,
                    CONSTRAINT "FK_ClientCareMessages_Clients_ClientId"
                        FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_ClientCareMessages_Dietitians_DietitianId"
                        FOREIGN KEY ("DietitianId") REFERENCES "Dietitians" ("Id") ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS "IX_ClientCareMessages_ClientId_CreatedAtUtc"
                    ON "ClientCareMessages" ("ClientId", "CreatedAtUtc");

                CREATE INDEX IF NOT EXISTS "IX_ClientCareMessages_DietitianId_CreatedAtUtc"
                    ON "ClientCareMessages" ("DietitianId", "CreatedAtUtc");

                CREATE TABLE IF NOT EXISTS "ClientAppointmentSummaries" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "ClientId" uuid NOT NULL,
                    "DietitianId" uuid NULL,
                    "Title" character varying(160) NOT NULL,
                    "ScheduledAtUtc" timestamp with time zone NOT NULL,
                    "Mode" character varying(32) NOT NULL DEFAULT 'online',
                    "Location" character varying(180) NULL,
                    "Note" character varying(300) NULL,
                    "IsCancelled" boolean NOT NULL DEFAULT FALSE,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_ClientAppointmentSummaries_Clients_ClientId"
                        FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_ClientAppointmentSummaries_Dietitians_DietitianId"
                        FOREIGN KEY ("DietitianId") REFERENCES "Dietitians" ("Id") ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS "IX_ClientAppointmentSummaries_ClientId_ScheduledAtUtc"
                    ON "ClientAppointmentSummaries" ("ClientId", "ScheduledAtUtc");

                CREATE INDEX IF NOT EXISTS "IX_ClientAppointmentSummaries_ClientId_IsCancelled"
                    ON "ClientAppointmentSummaries" ("ClientId", "IsCancelled");

                CREATE INDEX IF NOT EXISTS "IX_ClientAppointmentSummaries_DietitianId"
                    ON "ClientAppointmentSummaries" ("DietitianId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "ClientAppointmentSummaries";
                DROP TABLE IF EXISTS "ClientCareMessages";
                DROP TABLE IF EXISTS "ClientGoalPreferences";
                DROP TABLE IF EXISTS "ClientNotificationPreferences";
                DROP TABLE IF EXISTS "ClientShoppingListItems";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Recipes"
                DROP COLUMN IF EXISTS "StepsJson";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Ingredients"
                DROP COLUMN IF EXISTS "IsCondiment";
                """);

            migrationBuilder.AlterColumn<int>(
                name: "MealType",
                table: "PlanMealItems",
                type: "integer",
                nullable: false,
                defaultValue: 6,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
