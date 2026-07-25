using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class ScheduleMoveTests(MealCalendarApiFactory factory) : IClassFixture<MealCalendarApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task MovingAMealRemovesTheSourceAndAssignsTheDestination()
    {
        using var client = factory.CreateClient();
        await ClearDatesAsync(client);
        await AssignAsync(client, "2026-07-24", "tacos");

        await AssertNoContentAsync(client.PostAsJsonAsync("/api/v1/schedule/move", new
        {
            fromDate = "2026-07-24",
            toDate = "2026-07-25"
        }));

        var days = await GetScheduleAsync(client);

        Assert.DoesNotContain("2026-07-24", days.Keys);
        Assert.Equal("tacos", days["2026-07-25"]);
    }

    [Fact]
    public async Task MovingAMealReplacesAnExistingDestinationAssignment()
    {
        using var client = factory.CreateClient();
        await ClearDatesAsync(client);
        await AssignAsync(client, "2026-07-24", "tacos");
        await AssignAsync(client, "2026-07-25", "pizza");

        await AssertNoContentAsync(client.PostAsJsonAsync("/api/v1/schedule/move", new
        {
            fromDate = "2026-07-24",
            toDate = "2026-07-25"
        }));

        var days = await GetScheduleAsync(client);

        Assert.DoesNotContain("2026-07-24", days.Keys);
        Assert.Equal("tacos", days["2026-07-25"]);
    }

    [Fact]
    public async Task MovingAMealToTheSameDateLeavesTheAssignmentUnchanged()
    {
        using var client = factory.CreateClient();
        await ClearDatesAsync(client);
        await AssignAsync(client, "2026-07-24", "tacos");

        await AssertNoContentAsync(client.PostAsJsonAsync("/api/v1/schedule/move", new
        {
            fromDate = "2026-07-24",
            toDate = "2026-07-24"
        }));

        var days = await GetScheduleAsync(client);

        Assert.Equal("tacos", days["2026-07-24"]);
    }

    [Fact]
    public async Task MovingFromAnEmptyDateReturnsNotFoundAndLeavesTheDestinationUnchanged()
    {
        using var client = factory.CreateClient();
        await ClearDatesAsync(client);
        await AssignAsync(client, "2026-07-25", "pizza");

        await AssertProblemAsync(
            client.PostAsJsonAsync("/api/v1/schedule/move", new
            {
                fromDate = "2026-07-24",
                toDate = "2026-07-25"
            }),
            HttpStatusCode.NotFound,
            "source_not_found");

        var days = await GetScheduleAsync(client);

        Assert.DoesNotContain("2026-07-24", days.Keys);
        Assert.Equal("pizza", days["2026-07-25"]);
    }

    [Theory]
    [InlineData("2026-7-24", "2026-07-25")]
    [InlineData("2026-07-24", "2026-7-25")]
    public async Task MovingWithAnInvalidDateReturnsStructuredProblemDetails(string fromDate, string toDate)
    {
        using var client = factory.CreateClient();

        await AssertProblemAsync(
            client.PostAsJsonAsync("/api/v1/schedule/move", new { fromDate, toDate }),
            HttpStatusCode.BadRequest,
            "invalid_date");
    }

    private static async Task ClearDatesAsync(HttpClient client)
    {
        await AssertNoContentAsync(client.DeleteAsync("/api/v1/schedule/2026-07-24"));
        await AssertNoContentAsync(client.DeleteAsync("/api/v1/schedule/2026-07-25"));
    }

    private static Task AssignAsync(HttpClient client, string date, string mealId) =>
        AssertNoContentAsync(client.PutAsJsonAsync($"/api/v1/schedule/{date}", new { mealId }));

    private static async Task<IReadOnlyDictionary<string, string>> GetScheduleAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/v1/schedule?from=2026-07-24&to=2026-07-25");
        response.EnsureSuccessStatusCode();

        var schedule = await response.Content.ReadFromJsonAsync<ScheduleResponse>(JsonOptions)
            ?? throw new InvalidOperationException("Schedule response was empty.");

        return schedule.Days;
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
