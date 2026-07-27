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
        const string filename = "managed-0123456789abcdef0123456789abcdef.png";
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

    [Fact]
    public async Task DeleteManagedImageIgnoresPrefixOnlyFilename()
    {
        var imagesPath = Path.Combine(Path.GetTempPath(), $"meal-calendar-images-{Guid.NewGuid():N}");
        Directory.CreateDirectory(imagesPath);
        const string filename = "managed-test.png";
        var path = Path.Combine(imagesPath, filename);
        await File.WriteAllBytesAsync(path, [1]);

        try
        {
            var store = new FileSystemMealImageStore(imagesPath);

            await store.DeleteManagedAsync(filename, CancellationToken.None);

            Assert.True(File.Exists(path));
        }
        finally
        {
            Directory.Delete(imagesPath, recursive: true);
        }
    }
}
