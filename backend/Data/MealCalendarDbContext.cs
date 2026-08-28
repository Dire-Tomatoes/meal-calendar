using MealCalendar.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Data;

public sealed class MealCalendarDbContext(DbContextOptions<MealCalendarDbContext> options) : DbContext(options)
{
    public DbSet<Meal> Meals => Set<Meal>();
    public DbSet<ScheduleDay> ScheduleDays => Set<ScheduleDay>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Meal>(meal =>
        {
            meal.HasKey(entity => entity.Id);
            meal.Property(entity => entity.Id).HasMaxLength(64);
            meal.Property(entity => entity.Name).HasMaxLength(120);
            meal.Property(entity => entity.Emoji).HasMaxLength(64);
            meal.Property(entity => entity.Notes).HasMaxLength(2000);
            meal.Property(entity => entity.SourceUrl).HasMaxLength(500);
            meal.Property(entity => entity.Tags).HasMaxLength(309);
        });

        modelBuilder.Entity<ScheduleDay>(scheduleDay =>
        {
            scheduleDay.HasKey(entity => entity.Date);
            scheduleDay.Property(entity => entity.MealId).HasMaxLength(64);
            scheduleDay.HasIndex(entity => entity.MealId);
            scheduleDay.HasOne(entity => entity.Meal)
                .WithMany(entity => entity.ScheduleDays)
                .HasForeignKey(entity => entity.MealId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
