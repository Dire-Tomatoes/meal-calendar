namespace MealCalendar.Api.Contracts;

public sealed record AssignMealRequest(string MealId);

public sealed record MoveMealRequest(string FromDate, string ToDate);
