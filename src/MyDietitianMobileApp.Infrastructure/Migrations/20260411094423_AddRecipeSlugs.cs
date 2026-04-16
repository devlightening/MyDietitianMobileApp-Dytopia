using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeSlugs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Recipes",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Recipes"
                SET "Slug" =
                    COALESCE(
                        NULLIF(
                            trim(both '-' from regexp_replace(
                                replace(replace(replace(replace(replace(replace(lower(coalesce("Name", 'tarif')), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'),
                                '[^a-z0-9]+',
                                '-',
                                'g'
                            )),
                            ''
                        ),
                        'tarif'
                    ) || '-' || substr(replace("Id"::text, '-', ''), 1, 6)
                WHERE "Slug" IS NULL OR "Slug" = '';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "Recipes",
                type: "character varying(260)",
                maxLength: 260,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(260)",
                oldMaxLength: 260,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Recipes_Slug",
                table: "Recipes",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Recipes_Slug",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Recipes");
        }
    }
}
