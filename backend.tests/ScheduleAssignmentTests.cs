using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class ScheduleAssignmentTests(MealCalendarApiFactory factory) : IClassFixture<MealCalendarApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task AssigningAMealReturnsItInTheRequestedRange()
    {
        using var client = factory.CreateClient();

        var assign = await client.PutAsJsonAsync("/api/v1/schedule/2026-07-24", new { mealId = "tacos" });
        Assert.Equal(HttpStatusCode.NoContent, assign.StatusCode);

        var schedule = await GetScheduleAsync(client, "2026-07-24", "2026-07-24");

        Assert.Equal("tacos", schedule.Days["2026-07-24"]);
    }

    [Fact]
    public async Task AssigningAnotherMealToADateReplacesThePreviousMeal()
    {
        using var client = factory.CreateClient();

        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-07-25", new { mealId = "tacos" }));
        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-07-25", new { mealId = "pizza" }));

        var schedule = await GetScheduleAsync(client, "2026-07-25", "2026-07-25");

        Assert.Single(schedule.Days);
        Assert.Equal("pizza", schedule.Days["2026-07-25"]);
    }

    [Fact]
    public async Task ScheduleRangeIncludesOnlyDatesWithinItsInclusiveBounds()
    {
        using var client = factory.CreateClient();

        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-07-29", new { mealId = "tacos" }));
        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-07-30", new { mealId = "pizza" }));
        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-08-01", new { mealId = "pasta" }));

        var schedule = await GetScheduleAsync(client, "2026-07-30", "2026-07-31");

        Assert.Single(schedule.Days);
        Assert.Equal("pizza", schedule.Days["2026-07-30"]);
        Assert.DoesNotContain("2026-07-29", schedule.Days.Keys);
        Assert.DoesNotContain("2026-08-01", schedule.Days.Keys);
    }

    [Fact]
    public async Task DeletingAnAssignedDateRemovesItFromTheSchedule()
    {
        using var client = factory.CreateClient();

        await AssertNoContentAsync(client.PutAsJsonAsync("/api/v1/schedule/2026-08-02", new { mealId = "curry" }));
        await AssertNoContentAsync(client.DeleteAsync("/api/v1/schedule/2026-08-02"));

        var schedule = await GetScheduleAsync(client, "2026-08-02", "2026-08-02");

        Assert.DoesNotContain("2026-08-02", schedule.Days.Keys);
    }

    [Fact]
    public async Task DeletingAnEmptyDateIsIdempotent()
    {
        using var client = factory.CreateClient();

        await AssertNoContentAsync(client.DeleteAsync("/api/v1/schedule/2026-08-03"));
        await AssertNoContentAsync(client.DeleteAsync("/api/v1/schedule/2026-08-03"));
    }

    [Fact]
    public async Task InvalidScheduleRequestsReturnStructuredProblemDetails()
    {
        using var client = factory.CreateClient();

        await AssertProblemAsync(
            client.PutAsJsonAsync("/api/v1/schedule/2026-7-24", new { mealId = "tacos" }),
            HttpStatusCode.BadRequest,
            "invalid_date");
        await AssertProblemAsync(
            client.PutAsJsonAsync("/api/v1/schedule/2026-02-30", new { mealId = "tacos" }),
            HttpStatusCode.BadRequest,
            "invalid_date");
        await AssertProblemAsync(
            client.GetAsync("/api/v1/schedule?from=2026-08-02&to=2026-08-01"),
            HttpStatusCode.BadRequest,
            "invalid_range");
        await AssertProblemAsync(
            client.PutAsJsonAsync("/api/v1/schedule/2026-08-04", new { mealId = "unknown" }),
            HttpStatusCode.NotFound,
            "meal_not_found");
    }

    private static async Task<ScheduleResponse> GetScheduleAsync(HttpClient client, string from, string to)
    {
        var response = await client.GetAsync($"/api/v1/schedule?from={from}&to={to}");
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<ScheduleResponse>(JsonOptions))
            ?? throw new InvalidOperationException("Schedule response was empty.");
    }

    private static async Task AssertNoContentAsync(Task<HttpResponseMessage> responseTask)
    {
        using var response = await responseTask;

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task AssertProblemAsync(
        Task<HttpResponseMessage> responseTask,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        using var response = await responseTask;

        Assert.Equal(expectedStatus, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal((int)expectedStatus, root.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("title").GetString()));
        Assert.Equal(expectedCode, root.GetProperty("code").GetString());
    }

    private sealed record ScheduleResponse(IReadOnlyDictionary<string, string> Days);
}
