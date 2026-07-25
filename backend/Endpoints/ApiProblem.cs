namespace MealCalendar.Api.Endpoints;

public static class ApiProblem
{
    public static IResult Create(int status, string title, string code, string detail) =>
        Results.Problem(
            statusCode: status,
            title: title,
            detail: detail,
            extensions: new Dictionary<string, object?>
            {
                ["code"] = code
            });
}
