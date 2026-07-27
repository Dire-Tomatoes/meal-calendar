using Microsoft.AspNetCore.Http;

namespace MealCalendar.Api.Images;

public interface IMealImageStore
{
    Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken);
    Task DeleteManagedAsync(string? filename, CancellationToken cancellationToken);
}
