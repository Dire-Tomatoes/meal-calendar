using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealCalendar.Api.Data.Migrations;

[DbContext(typeof(MealCalendarDbContext))]
[Migration("20260726000000_CascadeRecipeDeletes")]
public partial class CascadeRecipeDeletes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        RebuildScheduleDaysTable(migrationBuilder, "CASCADE");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        RebuildScheduleDaysTable(migrationBuilder, "RESTRICT");
    }

    private static void RebuildScheduleDaysTable(MigrationBuilder migrationBuilder, string deleteBehavior)
    {
        migrationBuilder.Sql($"""
            CREATE TABLE "__ScheduleDays" (
                "Date" TEXT NOT NULL CONSTRAINT "PK_ScheduleDays" PRIMARY KEY,
                "MealId" TEXT NOT NULL,
                CONSTRAINT "FK_ScheduleDays_Meals_MealId"
                    FOREIGN KEY ("MealId") REFERENCES "Meals" ("Id") ON DELETE {deleteBehavior}
            );

            INSERT INTO "__ScheduleDays" ("Date", "MealId")
            SELECT "Date", "MealId"
            FROM "ScheduleDays";

            DROP TABLE "ScheduleDays";
            ALTER TABLE "__ScheduleDays" RENAME TO "ScheduleDays";
            CREATE INDEX "IX_ScheduleDays_MealId" ON "ScheduleDays" ("MealId");
            """);
    }
}
