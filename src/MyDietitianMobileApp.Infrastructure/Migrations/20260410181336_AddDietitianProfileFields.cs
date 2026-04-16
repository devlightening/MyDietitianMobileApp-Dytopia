using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDietitianProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Bio",
                table: "DietitianSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "DietitianSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebsiteUrl",
                table: "DietitianSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bio",
                table: "DietitianSettings");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "DietitianSettings");

            migrationBuilder.DropColumn(
                name: "WebsiteUrl",
                table: "DietitianSettings");
        }
    }
}
