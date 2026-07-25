namespace MealCalendar.Api.Models;

public sealed class ScheduleDay
{
    public DateOnly Date { get; init; }
    public required string MealId { get; set; }
    public Meal? Meal { get; set; }
}
