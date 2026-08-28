using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MealCalendar.Api.Data;
using MealCalendar.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class MealsEndpointsTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task NewDatabaseStartsWithoutRecipes()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();

        var meals = await client.GetFromJsonAsync<List<MealResponse>>("/api/v1/meals", JsonOptions);

        Assert.NotNull(meals);
        Assert.Empty(meals);
    }

    [Fact]
    public async Task DeletingMealCascadesToScheduledDays()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var healthResponse = await client.GetAsync("/api/health");
        healthResponse.EnsureSuccessStatusCode();

        await using (var createScope = factory.Services.CreateAsyncScope())
        {
            var context = createScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
            context.Meals.Add(new Meal { Id = "cascade-meal", Name = "Cascade meal", Emoji = "🍽️" });
            context.ScheduleDays.Add(new ScheduleDay { Date = new DateOnly(2026, 7, 26), MealId = "cascade-meal" });
            await context.SaveChangesAsync();
        }

        await using (var deleteScope = factory.Services.CreateAsyncScope())
        {
            var context = deleteScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
            var meal = await context.Meals.SingleAsync(entity => entity.Id == "cascade-meal");
            context.Meals.Remove(meal);
            await context.SaveChangesAsync();
        }

        await using var assertScope = factory.Services.CreateAsyncScope();
        var assertContext = assertScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
        Assert.Empty(await assertContext.ScheduleDays.ToListAsync());
    }

    [Fact]
    public async Task CreateRecipeReturnsCreatedRecipe()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲");

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recipe = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(recipe);
        Assert.Equal("Miso Soup", recipe.Name);
        Assert.Equal("🍲", recipe.Emoji);
        Assert.Null(recipe.ImageUrl);
        Assert.Equal("", recipe.Notes);
        Assert.Null(recipe.SourceUrl);
        Assert.Empty(recipe.Tags);
        Assert.False(recipe.IsFavorite);
    }

    [Fact]
    public async Task CreateRecipeNormalizesAndReturnsMetadata()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm(
            "Miso Soup",
            "🍲",
            notes: "  Family favorite  ",
            sourceUrl: "https://example.com/miso",
            tags: " Quick,vegan,quick ",
            isFavorite: true);

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recipe = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(recipe);
        Assert.Equal("Family favorite", recipe.Notes);
        Assert.Equal("https://example.com/miso", recipe.SourceUrl);
        Assert.Equal(["Quick", "vegan"], recipe.Tags);
        Assert.True(recipe.IsFavorite);
    }

    [Theory]
    [InlineData("ftp://example.com/recipe", "tag")]
    [InlineData("not-a-url", "tag")]
    [InlineData("", "one,two,three,four,five,six,seven,eight,nine,ten,eleven")]
    public async Task CreateRecipeRejectsInvalidMetadata(string sourceUrl, string tags)
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲", sourceUrl: sourceUrl, tags: tags);

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsJsonContent()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/meals",
            new { name = "Miso Soup", emoji = "🍲", removeImage = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsMalformedMultipartContent()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var content = new ByteArrayContent(
            Encoding.UTF8.GetBytes(
                "--broken\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nMiso Soup"));
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(
            "multipart/form-data; boundary=broken");

        using var response = await client.PostAsync("/api/v1/meals", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsInvalidRemoveImageText()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲", removeImageText: "yes");

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsWhitespaceOnlyName()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("   ", "🍲");

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsEmojiLongerThanSixtyFourCharacters()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", new string('a', 65));

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task RecipeRoundTripsThreeComplexEmoji()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        const string icons = "👩🏽‍🍳👨🏽‍🍳👩🏻‍🍳";
        using var form = CreateRecipeForm("Combo", icons);
        using var response = await client.PostAsync("/api/v1/meals", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recipe = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(recipe);
        using var updateForm = CreateRecipeForm("Combo updated", icons);
        using var updated = await client.PutAsync($"/api/v1/meals/{recipe.Id}", updateForm);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var meals = await client.GetFromJsonAsync<List<MealResponse>>("/api/v1/meals", JsonOptions);
        Assert.Equal(icons, Assert.Single(meals!).Emoji);
    }

    [Fact]
    public async Task CreateRecipeRejectsNonImageUpload()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲", CreateFileContent("text/plain", [1, 2, 3]));

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe_image", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeRejectsUploadLargerThanTenMiB()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm(
            "Miso Soup",
            "🍲",
            CreateFileContent("image/png", new byte[(10 * 1024 * 1024) + 1]));

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe_image", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task CreateRecipeStoresManagedPngAndReturnsItsUrl()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲", CreateFileContent("image/png", [137, 80, 78, 71]));

        using var response = await client.PostAsync("/api/v1/meals", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var recipe = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(recipe);
        var storedFile = Assert.Single(Directory.GetFiles(factory.ImagesPath, "managed-*.png"));
        Assert.Equal($"/images/meals/{Path.GetFileName(storedFile)}", recipe.ImageUrl);
    }

    [Fact]
    public async Task UpdateRecipeChangesFieldsAndKeepsExistingImageWhenNoImageOptionIsSupplied()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        var created = await CreateRecipeAsync(client, "Miso Soup", "🍲", CreateFileContent("image/png", [1]));
        var originalFile = Assert.Single(Directory.GetFiles(factory.ImagesPath));
        using var form = CreateRecipeForm("Miso Ramen", "🍜");

        using var response = await client.PutAsync($"/api/v1/meals/{created.Id}", form);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Miso Ramen", updated.Name);
        Assert.Equal("🍜", updated.Emoji);
        Assert.Equal($"/images/meals/{Path.GetFileName(originalFile)}", updated.ImageUrl);
        Assert.True(File.Exists(originalFile));
    }

    [Fact]
    public async Task UpdateRecipeRejectsJsonContent()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.PutAsJsonAsync(
            "/api/v1/meals/missing",
            new { name = "Miso Soup", emoji = "🍲", removeImage = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task UpdateRecipeRejectsMalformedMultipartContent()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var content = new ByteArrayContent(
            Encoding.UTF8.GetBytes(
                "--broken\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nMiso Soup"));
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(
            "multipart/form-data; boundary=broken");

        using var response = await client.PutAsync("/api/v1/meals/missing", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task UpdateRecipeRejectsInvalidRemoveImageText()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲", removeImageText: "yes");

        using var response = await client.PutAsync("/api/v1/meals/missing", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task UpdateRecipeWithNewImageDeletesPriorManagedImage()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        var created = await CreateRecipeAsync(client, "Miso Soup", "🍲", CreateFileContent("image/png", [1]));
        var originalFile = Assert.Single(Directory.GetFiles(factory.ImagesPath));
        using var form = CreateRecipeForm("Miso Soup", "🍲", CreateFileContent("image/webp", [2]));

        using var response = await client.PutAsync($"/api/v1/meals/{created.Id}", form);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(updated);
        Assert.False(File.Exists(originalFile));
        var replacement = Assert.Single(Directory.GetFiles(factory.ImagesPath, "managed-*.webp"));
        Assert.Equal($"/images/meals/{Path.GetFileName(replacement)}", updated.ImageUrl);
    }

    [Fact]
    public async Task UpdateRecipeWithRemoveImageClearsUrlAndDeletesPriorManagedImage()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        var created = await CreateRecipeAsync(client, "Miso Soup", "🍲", CreateFileContent("image/png", [1]));
        var originalFile = Assert.Single(Directory.GetFiles(factory.ImagesPath));
        using var form = CreateRecipeForm("Miso Soup", "🍲", removeImage: true);

        using var response = await client.PutAsync($"/api/v1/meals/{created.Id}", form);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Null(updated.ImageUrl);
        Assert.False(File.Exists(originalFile));
    }

    [Fact]
    public async Task UpdateRecipeForMissingIdReturnsRecipeNotFound()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var form = CreateRecipeForm("Miso Soup", "🍲");

        using var response = await client.PutAsync("/api/v1/meals/missing", form);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("recipe_not_found", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task UpdateRecipeRejectsReplacementAndRemovalTogether()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        var created = await CreateRecipeAsync(client, "Miso Soup", "🍲");
        using var form = CreateRecipeForm("Miso Soup", "🍲", CreateFileContent("image/png", [1]), removeImage: true);

        using var response = await client.PutAsync($"/api/v1/meals/{created.Id}", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_recipe", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task DeleteRecipeForMissingIdReturnsRecipeNotFound()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.DeleteAsync("/api/v1/meals/missing");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("recipe_not_found", await ReadProblemCodeAsync(response));
    }

    [Fact]
    public async Task DeleteRecipeRemovesItsScheduledDatesAndManagedImage()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        var created = await CreateRecipeAsync(client, "Miso Soup", "🍲", CreateFileContent("image/png", [1]));
        var image = Assert.Single(Directory.GetFiles(factory.ImagesPath));
        using var scheduleResponse = await client.PutAsJsonAsync(
            "/api/v1/schedule/2026-07-26",
            new { mealId = created.Id });
        Assert.Equal(HttpStatusCode.NoContent, scheduleResponse.StatusCode);

        using var response = await client.DeleteAsync($"/api/v1/meals/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(File.Exists(image));
        var recipes = await client.GetFromJsonAsync<List<MealResponse>>("/api/v1/meals", JsonOptions);
        Assert.NotNull(recipes);
        Assert.Empty(recipes);
        var schedule = await client.GetFromJsonAsync<ScheduleResponse>(
            "/api/v1/schedule?from=2026-07-26&to=2026-07-26",
            JsonOptions);
        Assert.NotNull(schedule);
        Assert.Empty(schedule.Days);
    }

    private static async Task<MealResponse> CreateRecipeAsync(
        HttpClient client,
        string name,
        string emoji,
        HttpContent? image = null)
    {
        using var form = CreateRecipeForm(name, emoji, image);
        using var response = await client.PostAsync("/api/v1/meals", form);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<MealResponse>(JsonOptions))!;
    }

    private static MultipartFormDataContent CreateRecipeForm(
        string name,
        string emoji,
        HttpContent? image = null,
        bool removeImage = false,
        string? removeImageText = null,
        string? notes = null,
        string? sourceUrl = null,
        string? tags = null,
        bool isFavorite = false)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(name), "name" },
            { new StringContent(emoji), "emoji" },
            {
                new StringContent(
                    removeImageText ?? removeImage.ToString().ToLowerInvariant()),
                "removeImage"
            }
        };

        form.Add(new StringContent(notes ?? ""), "notes");
        form.Add(new StringContent(sourceUrl ?? ""), "sourceUrl");
        form.Add(new StringContent(tags ?? ""), "tags");
        form.Add(new StringContent(isFavorite.ToString().ToLowerInvariant()), "isFavorite");

        if (image is not null)
        {
            form.Add(image, "image", "upload.bin");
        }

        return form;
    }

    private static HttpContent CreateFileContent(string contentType, byte[] contents)
    {
        var content = new ByteArrayContent(contents);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        return content;
    }

    private static async Task<string?> ReadProblemCodeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("code").GetString();
    }

    private sealed record MealResponse(
        string Id,
        string Name,
        string Emoji,
        string? ImageUrl,
        string Notes,
        string? SourceUrl,
        IReadOnlyList<string> Tags,
        bool IsFavorite);
    private sealed record ScheduleResponse(IReadOnlyDictionary<string, string> Days);
}
