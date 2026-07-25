using System.Globalization;

namespace MealCalendar.Api.Utilities;

public static class IsoDate
{
    public static bool TryParse(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(
            value,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out date);
}
