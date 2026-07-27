using System;
using MealCalendar.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

#nullable disable

namespace MealCalendar.Api.Data.Migrations;

[DbContext(typeof(MealCalendarDbContext))]
partial class MealCalendarDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.10");
        modelBuilder.HasAnnotation("Relational:MaxIdentifierLength", 64);

        modelBuilder.Entity("MealCalendar.Api.Models.Meal", b =>
        {
            b.Property<string>("Id")
                .HasMaxLength(64)
                .HasColumnType("TEXT");

            b.Property<string>("Emoji")
                .IsRequired()
                .HasMaxLength(16)
                .HasColumnType("TEXT");

            b.Property<string>("ImagePath")
                .HasColumnType("TEXT");

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(120)
                .HasColumnType("TEXT");

            b.HasKey("Id");
            b.ToTable("Meals");
        });

        modelBuilder.Entity("MealCalendar.Api.Models.ScheduleDay", b =>
        {
            b.Property<DateOnly>("Date")
                .HasColumnType("TEXT");

            b.Property<string>("MealId")
                .IsRequired()
                .HasMaxLength(64)
                .HasColumnType("TEXT");

            b.HasKey("Date");
            b.HasIndex("MealId");
            b.ToTable("ScheduleDays");
        });

        modelBuilder.Entity("MealCalendar.Api.Models.ScheduleDay", b =>
        {
            b.HasOne("MealCalendar.Api.Models.Meal", "Meal")
                .WithMany("ScheduleDays")
                .HasForeignKey("MealId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Meal");
        });

        modelBuilder.Entity("MealCalendar.Api.Models.Meal", b =>
        {
            b.Navigation("ScheduleDays");
        });
    }
}
