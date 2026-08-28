using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace MealCalendar.Api.Data.Migrations;

[DbContext(typeof(MealCalendarDbContext))]
[Migration("20260828000000_ExpandRecipeEmoji")]
public class ExpandRecipeEmoji : Migration
{
    // SQLite stores this column as unrestricted TEXT. Only EF's length metadata
    // and request validation change; no table rebuild or data rewrite is needed.
    protected override void Up(MigrationBuilder migrationBuilder) { }
    protected override void Down(MigrationBuilder migrationBuilder) { }
}
