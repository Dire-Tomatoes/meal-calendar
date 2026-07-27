using Microsoft.AspNetCore.Http;

namespace MealCalendar.Api.Images;

public sealed class FileSystemMealImageStore(string imagesPath) : IMealImageStore
{
    private const long MaximumImageSize = 10 * 1024 * 1024;

    public async Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var extension = GetExtension(file);
        var filename = $"managed-{Guid.NewGuid():N}{extension}";
        var path = Path.Combine(imagesPath, filename);

        Directory.CreateDirectory(imagesPath);

        try
        {
            await using (var destination = new FileStream(
                path,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await file.CopyToAsync(destination, cancellationToken);
            }

            return filename;
        }
        catch
        {
            File.Delete(path);
            throw;
        }
    }

    public Task DeleteManagedAsync(string? filename, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(filename) ||
            !string.Equals(Path.GetFileName(filename), filename, StringComparison.Ordinal) ||
            !filename.StartsWith("managed-", StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        var path = Path.Combine(imagesPath, filename);
        File.Delete(path);
        return Task.CompletedTask;
    }

    private static string GetExtension(IFormFile file)
    {
        if (file.Length == 0 || file.Length > MaximumImageSize)
        {
            throw new MealImageValidationException("Recipe images must be between 1 byte and 10 MiB.");
        }

        return file.ContentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new MealImageValidationException("Recipe images must be JPEG, PNG, or WebP files.")
        };
    }
}
