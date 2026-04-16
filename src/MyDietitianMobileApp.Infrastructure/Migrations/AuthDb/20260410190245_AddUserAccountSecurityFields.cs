using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyDietitianMobileApp.Infrastructure.Migrations.AuthDb
{
    /// <inheritdoc />
    public partial class AddUserAccountSecurityFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginAtUtc",
                table: "UserAccounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordChangedAtUtc",
                table: "UserAccounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "UserAccounts",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "UserAccounts"
                SET "SecurityStamp" = md5("Id"::text || clock_timestamp()::text || random()::text)
                WHERE "SecurityStamp" IS NULL OR "SecurityStamp" = '';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "SecurityStamp",
                table: "UserAccounts",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastLoginAtUtc",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordChangedAtUtc",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "UserAccounts");
        }
    }
}
