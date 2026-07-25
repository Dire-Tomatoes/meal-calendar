using MealCalendar.Api.Data;
using MealCalendar.Api.Endpoints;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("MealCalendar")
    ?? "Data Source=data/meal-calendar.db";
var databasePath = new SqliteConnectionStringBuilder(connectionString).DataSource;

if (!string.IsNullOrWhiteSpace(databasePath) && databasePath != ":memory:")
{
    var databaseDirectory = Path.GetDirectoryName(Path.GetFullPath(databasePath));

    if (!string.IsNullOrEmpty(databaseDirectory))
    {
        Directory.CreateDirectory(databaseDirectory);
    }
}

builder.Services.AddDbContext<MealCalendarDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
await DatabaseInitialization.InitializeDatabaseAsync(app);

var mealImagesPath = builder.Configuration["MealImagesPath"] ?? "images/meals";

if (Directory.Exists(mealImagesPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(Path.GetFullPath(mealImagesPath)),
        RequestPath = "/images/meals"
    });
}

app.MapMealsEndpoints();
app.MapScheduleEndpoints();
app.MapGet("/api/health", () => Results.Ok());
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
