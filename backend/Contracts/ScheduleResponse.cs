namespace MealCalendar.Api.Contracts;

public sealed record ScheduleResponse(IReadOnlyDictionary<string, string> Days);
