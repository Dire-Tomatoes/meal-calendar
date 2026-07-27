using Microsoft.AspNetCore.Http;

namespace MealCalendar.Api.Contracts;

public sealed record RecipeMutationRequest(string? Name, string? Emoji, bool RemoveImage, IFormFile? Image)
{
    public static async Task<RecipeMutationRequest> ReadAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            throw new InvalidRecipeMutationRequestException(
                "Recipe requests must use form data.");
        }

        IFormCollection form;
        try
        {
            form = await request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException exception)
        {
            throw new InvalidRecipeMutationRequestException(
                "The recipe form data is malformed.",
                exception);
        }
        catch (BadHttpRequestException exception)
        {
            throw new InvalidRecipeMutationRequestException(
                "The recipe form data is malformed.",
                exception);
        }
        catch (IOException exception)
        {
            throw new InvalidRecipeMutationRequestException(
                "The recipe form data could not be read.",
                exception);
        }

        var removeImage = false;
        if (form.TryGetValue("removeImage", out var removeImageValues))
        {
            var removeImageText = removeImageValues.ToString();
            if (string.Equals(removeImageText, "true", StringComparison.OrdinalIgnoreCase))
            {
                removeImage = true;
            }
            else if (!string.Equals(removeImageText, "false", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidRecipeMutationRequestException(
                    "removeImage must be true or false when provided.");
            }
        }

        return new RecipeMutationRequest(
            form["name"].ToString(),
            form["emoji"].ToString(),
            removeImage,
            form.Files.GetFile("image"));
    }
}

public sealed class InvalidRecipeMutationRequestException : Exception
{
    public InvalidRecipeMutationRequestException(string message)
        : base(message)
    {
    }

    public InvalidRecipeMutationRequestException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
