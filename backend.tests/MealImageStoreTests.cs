using MealCalendar.Api.Images;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class MealImageStoreTests
{
    [Fact]
    public async Task DeleteManagedImageCompletesWhenTheRequestWasCancelled()
    {
        var imagesPath = Path.Combine(Path.GetTempPath(), $"meal-calendar-images-{Guid.NewGuid():N}");
        Directory.CreateDirectory(imagesPath);
        const string filename = "managed-test.png";
        await File.WriteAllBytesAsync(Path.Combine(imagesPath, filename), [1]);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        try
        {
            var store = new FileSystemMealImageStore(imagesPath);

            await store.DeleteManagedAsync(filename, cancellation.Token);

            Assert.False(File.Exists(Path.Combine(imagesPath, filename)));
        }
        finally
        {
            Directory.Delete(imagesPath, recursive: true);
        }
    }
}
