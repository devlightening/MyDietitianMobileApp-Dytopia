using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClientRecipeFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClientRecipeFavorites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    FirstFavoritedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastFavoritedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUnfavoritedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientRecipeFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientRecipeFavorites_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClientRecipeFavorites_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientRecipeFavorites_ClientId_RecipeId",
                table: "ClientRecipeFavorites",
                columns: new[] { "ClientId", "RecipeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClientRecipeFavorites_IsActive",
                table: "ClientRecipeFavorites",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ClientRecipeFavorites_LastFavoritedAtUtc",
                table: "ClientRecipeFavorites",
                column: "LastFavoritedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ClientRecipeFavorites_RecipeId",
                table: "ClientRecipeFavorites",
                column: "RecipeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientRecipeFavorites");
        }
    }
}
