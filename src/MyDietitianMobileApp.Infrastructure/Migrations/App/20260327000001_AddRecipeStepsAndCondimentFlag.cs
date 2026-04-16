using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.App
{
    /// <inheritdoc />
    public partial class AddRecipeStepsAndCondimentFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Recipes.StepsJson ──────────────────────────────────────────────────
            // Stores preparation steps as a JSON array of strings.
            // NULL means no steps have been authored; an empty array "[]" is semantically
            // equivalent and treated the same by the eligibility filter.
            migrationBuilder.AddColumn<string>(
                name: "StepsJson",
                table: "Recipes",
                type: "text",
                nullable: true);

            // ── Ingredients.IsCondiment ────────────────────────────────────────────
            // Marks ingredients that are pantry helpers (oils, salt, spices, sauces, etc.).
            // Used by the recommendation engine's condiment-only guardrail:
            // a recipe whose only matched mandatory ingredients are all condiments
            // is NOT considered a valid full match.
            migrationBuilder.AddColumn<bool>(
                name: "IsCondiment",
                table: "Ingredients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // ── Seed known condiment canonical names ───────────────────────────────
            // Matches the names used in seed-part1-base.sql.
            // Add or remove entries here as the ingredient dictionary grows.
            migrationBuilder.Sql(@"
UPDATE ""Ingredients""
SET ""IsCondiment"" = TRUE
WHERE ""CanonicalName"" IN (
    'Zeytinyağı',
    'Ayçiçek Yağı',
    'Tuz',
    'Karabiber',
    'Kırmızı Pul Biber',
    'Pul Biber',
    'Kimyon',
    'Limon',
    'Nane',
    'Maydanoz',
    'Sirke',
    'Şeker',
    'Bal',
    'Sarımsak',
    'Soğan',
    'Zencefil',
    'Köri',
    'Zerdeçal',
    'Kekik',
    'Fesleğen',
    'Defne Yaprağı',
    'Biberiye',
    'Hardal',
    'Nar Ekşisi',
    'Soya Sosu',
    'Ketçap',
    'Mayonez'
);
");

            // ── Mark placeholder / demo records as hidden ──────────────────────────
            // These records pass production flag checks (IsDemo=F, IsDraft=F, IsHiddenFromProduction=F)
            // but have meaningless titles or were inserted as seed placeholders.
            // Setting IsHiddenFromProduction=TRUE permanently removes them from all recommendation results.
            migrationBuilder.Sql(@"
UPDATE ""Recipes""
SET ""IsHiddenFromProduction"" = TRUE
WHERE
    -- Very short / obviously placeholder names (≤3 chars)
    LENGTH(TRIM(""Name"")) <= 3
    -- Known bad demo title patterns
    OR LOWER(TRIM(""Name"")) IN ('aa', 'bb', 'test', 'demo', 'sample', 'örnek', 'deneme', 'verified demo')
    OR LOWER(TRIM(""Name"")) LIKE 'test %'
    OR LOWER(TRIM(""Name"")) LIKE 'demo %'
    OR LOWER(TRIM(""Name"")) LIKE '% test'
    OR LOWER(TRIM(""Name"")) LIKE '% demo'
    -- Descriptions that are clearly placeholder
    OR LOWER(TRIM(""Description"")) IN ('aa', 'bb', '', 'test', 'demo', 'açıklama', 'description');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "StepsJson",   table: "Recipes");
            migrationBuilder.DropColumn(name: "IsCondiment", table: "Ingredients");
        }
    }
}
