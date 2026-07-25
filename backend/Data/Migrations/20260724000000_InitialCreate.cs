using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealCalendar.Api.Data.Migrations;

[DbContext(typeof(MealCalendarDbContext))]
[Migration("20260724000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Meals",
            columns: table => new
            {
                Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                Name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                Emoji = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                ImagePath = table.Column<string>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Meals", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "ScheduleDays",
            columns: table => new
            {
                Date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                MealId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ScheduleDays", x => x.Date);
                table.ForeignKey(
                    name: "FK_ScheduleDays_Meals_MealId",
                    column: x => x.MealId,
                    principalTable: "Meals",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ScheduleDays_MealId",
            table: "ScheduleDays",
            column: "MealId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ScheduleDays");
        migrationBuilder.DropTable(name: "Meals");
    }
}
