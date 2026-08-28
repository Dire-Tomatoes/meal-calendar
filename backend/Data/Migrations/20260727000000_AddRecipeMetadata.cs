using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealCalendar.Api.Data.Migrations;

[DbContext(typeof(MealCalendarDbContext))]
[Migration("20260727000000_AddRecipeMetadata")]
public partial class AddRecipeMetadata : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsFavorite",
            table: "Meals",
            type: "INTEGER",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "Notes",
            table: "Meals",
            type: "TEXT",
            maxLength: 2000,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "SourceUrl",
            table: "Meals",
            type: "TEXT",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "Tags",
            table: "Meals",
            type: "TEXT",
            maxLength: 309,
            nullable: false,
            defaultValue: "");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "IsFavorite", table: "Meals");
        migrationBuilder.DropColumn(name: "Notes", table: "Meals");
        migrationBuilder.DropColumn(name: "SourceUrl", table: "Meals");
        migrationBuilder.DropColumn(name: "Tags", table: "Meals");
    }
}
