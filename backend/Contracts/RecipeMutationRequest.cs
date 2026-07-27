using Microsoft.AspNetCore.Http;

namespace MealCalendar.Api.Contracts;

public sealed record RecipeMutationRequest(string? Name, string? Emoji, bool RemoveImage, IFormFile? Image)
{
    public static async Task<RecipeMutationRequest> ReadAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        var form = await request.ReadFormAsync(cancellationToken);

        return new RecipeMutationRequest(
            form["name"].ToString(),
            form["emoji"].ToString(),
            string.Equals(form["removeImage"].ToString(), "true", StringComparison.OrdinalIgnoreCase),
            form.Files.GetFile("image"));
    }
}
