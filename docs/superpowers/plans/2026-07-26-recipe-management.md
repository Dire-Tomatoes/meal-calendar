# Recipe Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep calendar status changes from shifting layout and add complete recipe CRUD with managed image uploads at the unlinked `/recipes` URL.

**Architecture:** Preserve the single-origin React and ASP.NET Core application. Select the second page directly from `window.location.pathname`, keep TanStack Query as the client server-state boundary, expose multipart recipe endpoints, and isolate filesystem operations behind `IMealImageStore` so later image processing does not alter the API. SQLite performs schedule cascades, while the image service manages only generated upload filenames.

**Tech Stack:** React 19, TypeScript 5.7, TanStack Query 5, Testing Library, Vitest 4, ASP.NET Core 10 minimal APIs, EF Core 10, SQLite, Docker Compose.

## Global Constraints

- `/recipes` has no link from the calendar.
- Recipe management supports create, edit, delete, image upload, image replacement, and image removal.
- Deleting a recipe cascades to all schedule entries that reference it.
- Runtime recipe seeding is removed; existing rows remain and new databases start empty.
- Uploads accept JPEG, PNG, and WebP up to 10 MiB.
- Client filenames are never used as stored filenames.
- Only generated managed image files may be deleted automatically.
- The calendar status region always reserves one line and never moves the calendar when its message changes.
- `/app/images` is writable by the non-root `app` user in production.
- Do not add a routing or image-processing package.

---

### Task 1: Stabilize the calendar status region

**Files:**
- Create: `frontend/src/features/meal-planner/components/ConnectionStatus.test.tsx`
- Modify: `frontend/src/features/meal-planner/components/ConnectionStatus.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/features/meal-planner/components/ConnectionStatus.test.tsx`

**Interfaces:**
- Consumes: existing `ConnectionStatusProps`.
- Produces: an always-present `.connection-status-slot` wrapper containing zero or one message.

- [ ] **Step 1: Write failing component tests**

Create tests that render the real component, rerender it through idle, saving, refresh-error, and idle states, and assert that the same wrapper remains mounted:

```tsx
const { container, rerender } = render(
  <ConnectionStatus
    isOnline
    isSaving={false}
    isRefreshing={false}
  />
);
const slot = container.querySelector(".connection-status-slot");
expect(slot).not.toBeNull();
expect(slot).toBeEmptyDOMElement();

rerender(
  <ConnectionStatus
    isOnline
    isSaving
    isRefreshing={false}
  />
);
expect(container.querySelector(".connection-status-slot")).toBe(slot);
expect(screen.getByRole("status")).toHaveTextContent("Saving");

rerender(
  <ConnectionStatus
    isOnline
    isSaving={false}
    isRefreshing={false}
    refreshError={new Error("refresh failed")}
  />
);
expect(container.querySelector(".connection-status-slot")).toBe(slot);
expect(screen.getByRole("alert")).toHaveTextContent(
  "Couldn’t refresh. Showing saved meals."
);
```

The production regression these tests catch is returning `null` while idle and inserting a new top-level paragraph when activity starts.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm --prefix frontend test -- ConnectionStatus.test.tsx
```

Expected: FAIL because the idle component currently returns `null` and no `.connection-status-slot` exists.

- [ ] **Step 3: Implement the stable wrapper**

Refactor `ConnectionStatus` to calculate a nullable message descriptor and always return:

```tsx
return (
  <div className="connection-status-slot" aria-live="polite" aria-atomic="true">
    {message ? <p role={message.role}>{message.text}</p> : null}
  </div>
);
```

Preserve the current priority: offline, saving, mutation error, refresh error, refreshing, idle.

Replace the direct-child status CSS with wrapper-based rules:

```css
.connection-status-slot {
  display: flex;
  min-height: 2.45rem;
  align-items: flex-start;
  margin: 0 0 0.75rem;
}

.connection-status-slot p {
  width: fit-content;
  margin: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-weight: 800;
}
```

Move the online, offline, pending, and alert colors to selectors targeting the child paragraph without changing wrapper height.

- [ ] **Step 4: Run focused and page tests and verify GREEN**

Run:

```powershell
npm --prefix frontend test -- ConnectionStatus.test.tsx MealPlannerPage.test.tsx
```

Expected: both test files pass, including the existing pending-mutation behavior.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/meal-planner/components/ConnectionStatus.tsx frontend/src/features/meal-planner/components/ConnectionStatus.test.tsx frontend/src/styles.css
git commit -m "fix: keep calendar status from shifting layout"
```

---

### Task 2: Remove runtime seeding and cascade recipe deletion

**Files:**
- Delete: `backend/Data/MealSeed.cs`
- Create: `backend/Data/Migrations/20260726000000_CascadeRecipeDeletes.cs`
- Modify: `backend/Data/Migrations/MealCalendarDbContextModelSnapshot.cs`
- Modify: `backend/Data/MealCalendarDbContext.cs`
- Modify: `backend/Data/DatabaseInitialization.cs`
- Modify: `backend.tests/MealsEndpointsTests.cs`
- Test: `backend.tests/MealsEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `Meal.ScheduleDays` and `ScheduleDay.Meal` relationship.
- Produces: `DeleteBehavior.Cascade`; startup migrates without inserting or rewriting recipes.

- [ ] **Step 1: Isolate the meal endpoint tests**

Remove `IClassFixture<MealCalendarApiFactory>` from `MealsEndpointsTests`. Each test creates and disposes its own factory:

```csharp
await using var factory = new MealCalendarApiFactory();
using var client = factory.CreateClient();
```

This prevents a create/edit/delete test from changing another test's database or image directory.

- [ ] **Step 2: Replace the seed expectation with failing lifecycle tests**

Replace `GetMealsReturnsStableSeededDefinitions` with:

```csharp
[Fact]
public async Task NewDatabaseStartsWithoutRecipes()
{
    using var client = factory.CreateClient();

    var meals = await client.GetFromJsonAsync<List<MealResponse>>("/api/v1/meals", JsonOptions);

    Assert.NotNull(meals);
    Assert.Empty(meals);
}
```

Add a database-level integration test that inserts a `Meal` and `ScheduleDay`, deletes the meal through EF Core, saves, and asserts that the schedule row is gone. The production mutation this catches is leaving `DeleteBehavior.Restrict`.

- [ ] **Step 3: Run the backend tests and verify RED**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter FullyQualifiedName~MealsEndpointsTests
```

Expected: the empty-database test fails because startup inserts seeded meals, and the cascade test fails with a foreign-key constraint.

- [ ] **Step 4: Implement the migration and startup change**

Change the relationship to:

```csharp
.OnDelete(DeleteBehavior.Cascade);
```

Create migration `20260726000000_CascadeRecipeDeletes` that drops `FK_ScheduleDays_Meals_MealId` and recreates it with `onDelete: ReferentialAction.Cascade`. Update the model snapshot accordingly.

Change initialization to migration only:

```csharp
await context.Database.MigrateAsync();
```

Delete `MealSeed.cs`. Do not delete any recipe rows in the migration.

- [ ] **Step 5: Run the focused backend tests and verify GREEN**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter FullyQualifiedName~MealsEndpointsTests
```

Expected: new databases are empty and database cascade behavior passes.

- [ ] **Step 6: Commit**

```powershell
git add backend/Data backend.tests/MealsEndpointsTests.cs
git commit -m "feat: make recipes user-managed"
```

---

### Task 3: Add managed image storage and recipe CRUD endpoints

**Files:**
- Create: `backend/Images/IMealImageStore.cs`
- Create: `backend/Images/FileSystemMealImageStore.cs`
- Create: `backend/Images/MealImageValidationException.cs`
- Create: `backend/Contracts/RecipeMutationRequest.cs`
- Modify: `backend/Endpoints/MealsEndpoints.cs`
- Modify: `backend/Program.cs`
- Modify: `backend.tests/MealCalendarApiFactory.cs`
- Modify: `backend.tests/MealsEndpointsTests.cs`
- Test: `backend.tests/MealsEndpointsTests.cs`

**Interfaces:**
- Produces:

```csharp
public interface IMealImageStore
{
    Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken);
    Task DeleteManagedAsync(string? filename, CancellationToken cancellationToken);
}
```

- `FileSystemMealImageStore` stores `managed-{Guid.NewGuid():N}{extension}` below the configured `MealImagesPath`.
- `POST /api/v1/meals`, `PUT /api/v1/meals/{id}`, and `DELETE /api/v1/meals/{id}`.

- [ ] **Step 1: Extend the test factory for isolated images**

Give each `MealCalendarApiFactory` a GUID-named temporary image directory, set `MealImagesPath` through `builder.UseSetting`, expose `ImagesPath`, and delete that exact directory in `DisposeAsync`.

Do not reuse the application image directory in tests.

- [ ] **Step 2: Write failing create and validation tests**

Add multipart integration tests using `MultipartFormDataContent`:

```csharp
using var form = new MultipartFormDataContent
{
    { new StringContent("Miso Soup"), "name" },
    { new StringContent("🍲"), "emoji" }
};
var response = await client.PostAsync("/api/v1/meals", form);
Assert.Equal(HttpStatusCode.Created, response.StatusCode);
```

Add separate tests proving:

- whitespace-only name returns 400 with code `invalid_recipe`;
- emoji longer than 16 characters returns 400;
- `text/plain` upload returns 400 with code `invalid_recipe_image`;
- a stream longer than 10 MiB returns 400;
- a PNG upload creates one `managed-*.png` file and returns its `/images/meals/` URL.

Each test catches a distinct missing validation or persistence branch.

- [ ] **Step 3: Run create tests and verify RED**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter "FullyQualifiedName~MealsEndpointsTests"
```

Expected: create requests return 404/405 because the endpoint does not exist.

- [ ] **Step 4: Implement the image-store boundary and create endpoint**

`FileSystemMealImageStore.SaveAsync` must:

- accept only `image/jpeg`, `image/png`, and `image/webp`;
- reject `Length == 0` or `Length > 10 * 1024 * 1024`;
- map content types to `.jpg`, `.png`, and `.webp`;
- generate `managed-{guid:N}{extension}`;
- copy with `FileMode.CreateNew`;
- delete a partial file if copying fails.

`DeleteManagedAsync` must return without action unless `Path.GetFileName(filename) == filename` and the filename starts with `managed-`.

Register the service in `Program.cs` with the same absolute `MealImagesPath` used by `PhysicalFileProvider`.

The create endpoint reads `HttpRequest.ReadFormAsync`, validates trimmed fields, saves the optional image, inserts:

```csharp
new Meal
{
    Id = Guid.NewGuid().ToString("N"),
    Name = name,
    Emoji = emoji,
    ImagePath = storedFilename
}
```

Return HTTP 201 and the existing `MealResponse` shape. If database saving fails after an upload, call `DeleteManagedAsync` for the new filename before rethrowing.

- [ ] **Step 5: Run create tests and verify GREEN**

Run the same focused backend command. Expected: all create and validation tests pass.

- [ ] **Step 6: Write failing edit, image lifecycle, missing-record, and cascade API tests**

Add tests proving:

- PUT updates name and emoji while retaining the current image when no image option is supplied;
- PUT with a new image stores the replacement and deletes the prior managed image;
- PUT with `removeImage=true` clears the URL and deletes the prior managed image;
- PUT for a missing ID returns 404 with code `recipe_not_found`;
- DELETE for a missing ID returns the same 404 code;
- DELETE removes the meal, every scheduled date referencing it, and its managed image.

- [ ] **Step 7: Run edit/delete tests and verify RED**

Run the focused backend test command. Expected: PUT and DELETE return 404/405 because they are not registered.

- [ ] **Step 8: Implement update and delete endpoints**

Update uses the existing ID and the same field validation as create. Reject a request that supplies both an image and `removeImage=true`.

For replacement:

1. Save the new image.
2. Update and commit the database row.
3. Delete the previous managed file.
4. If database commit fails, delete the new image and preserve the old one.

For deletion:

1. Read the existing `ImagePath`.
2. Remove the meal and save, allowing SQLite to cascade schedules.
3. Delete the old managed file after commit.

Log post-commit file deletion failures without converting successful database mutations into HTTP errors.

- [ ] **Step 9: Run all backend tests**

Run:

```powershell
dotnet test MealCalendar.sln
```

Expected: all backend tests pass with isolated databases and image directories.

- [ ] **Step 10: Commit**

```powershell
git add backend/Images backend/Contracts/RecipeMutationRequest.cs backend/Endpoints/MealsEndpoints.cs backend/Program.cs backend.tests
git commit -m "feat: add recipe CRUD and image uploads"
```

---

### Task 4: Add the recipe client and mutation hooks

**Files:**
- Modify: `frontend/src/features/meal-planner/api/client.ts`
- Modify: `frontend/src/features/meal-planner/api/client.test.ts`
- Modify: `frontend/src/features/meal-planner/api/queries.ts`
- Modify: `frontend/src/features/meal-planner/api/queries.test.tsx`
- Test: the two existing API test files

**Interfaces:**
- Produces:

```ts
export interface RecipeFormValues {
  name: string;
  emoji: string;
  image: File | null;
  removeImage: boolean;
}

export function createRecipe(values: RecipeFormValues): Promise<Meal>;
export function updateRecipe(id: MealId, values: RecipeFormValues): Promise<Meal>;
export function deleteRecipe(id: MealId): Promise<undefined>;
export function useRecipeMutations(): {
  create: UseMutationResult<Meal, Error, RecipeFormValues>;
  update: UseMutationResult<Meal, Error, { id: MealId; values: RecipeFormValues }>;
  remove: UseMutationResult<undefined, Error, MealId>;
};
```

- [ ] **Step 1: Write failing client tests**

Test the real `request` boundary with a stubbed `fetch`:

- JSON schedule requests still receive `Content-Type: application/json`.
- `createRecipe` sends `FormData` without manually setting `Content-Type`.
- `updateRecipe` URL-encodes the ID and sends PUT.
- `deleteRecipe` URL-encodes the ID and sends DELETE.

Assert actual `FormData.get("name")`, `emoji`, `removeImage`, and `image` values rather than asserting only that fetch was called.

- [ ] **Step 2: Run client tests and verify RED**

Run:

```powershell
npm --prefix frontend test -- client.test.ts
```

Expected: recipe functions are missing and the current request helper would set JSON content type for `FormData`.

- [ ] **Step 3: Implement multipart-aware client functions**

Change `request` so it adds JSON content type only when `body` exists and is not `FormData`. Add a helper that appends the four recipe fields and implement the three recipe functions with the interfaces above.

- [ ] **Step 4: Run client tests and verify GREEN**

Run the focused client test. Expected: all client tests pass.

- [ ] **Step 5: Write failing query-hook invalidation tests**

Add hook tests proving:

- create and update settle by invalidating `["meals"]`;
- delete settles by invalidating both `["meals"]` and `["schedule"]`;
- invalidation also happens after an HTTP error so stale state is refetched.

- [ ] **Step 6: Run query tests and verify RED**

Run:

```powershell
npm --prefix frontend test -- queries.test.tsx
```

Expected: `useRecipeMutations` is missing.

- [ ] **Step 7: Implement `useRecipeMutations` and verify GREEN**

Use `onSettled`, matching the existing schedule mutation reliability pattern. Run both API test files and expect them to pass.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/features/meal-planner/api
git commit -m "feat: add recipe management client"
```

---

### Task 5: Build and route the recipe-management page

**Files:**
- Create: `frontend/src/features/recipes/RecipeManagementPage.tsx`
- Create: `frontend/src/features/recipes/RecipeManagementPage.test.tsx`
- Create: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Test: the two new test files

**Interfaces:**
- Consumes: `useMeals`, `useRecipeMutations`, `RecipeFormValues`, and `Meal`.
- Produces: `RecipeManagementPage`; `/recipes` route selected by `App`.

- [ ] **Step 1: Write a failing route test**

Set the browser path with:

```ts
window.history.replaceState({}, "", "/recipes");
render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

Assert the `Recipe management` heading appears and the `Monthly meal schedule` grid does not. Add a root-path case that asserts the calendar and verifies there is no link to `/recipes`.

- [ ] **Step 2: Run the route test and verify RED**

Run:

```powershell
npm --prefix frontend test -- App.test.tsx
```

Expected: `/recipes` still renders the calendar.

- [ ] **Step 3: Add path-based routing**

Implement:

```tsx
const page =
  window.location.pathname === "/recipes"
    ? <RecipeManagementPage />
    : <MealPlannerPage />;
```

Keep `UpdatePrompt` mounted for both pages.

- [ ] **Step 4: Write failing management-page behavior tests**

Against a realistic fetch stub, test separately:

- submitting name and emoji creates a recipe and displays the refetched row;
- selecting a file includes it in the create request;
- edit pre-fills current fields and PUT updates the row;
- remove-image is offered only when an image exists;
- delete asks for confirmation, then removes the row;
- a pending mutation disables submit/delete controls;
- a Problem Details response leaves the list visible and shows its detail.

The delete test must assert the confirmation text mentions scheduled calendar entries.

- [ ] **Step 5: Run management tests and verify RED**

Run:

```powershell
npm --prefix frontend test -- RecipeManagementPage.test.tsx
```

Expected: the component does not exist.

- [ ] **Step 6: Implement the management page**

Use one controlled form with state:

```ts
type EditorState = {
  id: MealId | null;
  name: string;
  emoji: string;
  image: File | null;
  removeImage: boolean;
};
```

Create mode has `id: null`; edit copies the selected recipe. Reset the form after successful create/update. Use the native `window.confirm` for destructive confirmation and phrase it explicitly: deleting also removes scheduled calendar entries.

Render current images using `imageUrl`; otherwise render the emoji. Keep all mutation errors within the page and retain the current recipe list.

- [ ] **Step 7: Add responsive management styles**

Add `.recipe-management`, `.recipe-form`, `.recipe-list`, and `.recipe-card` styles using the existing color, radius, shadow, button, and focus tokens. Use a two-column form/list layout on wide screens and one column below 760px. Image previews use `object-fit: cover`.

- [ ] **Step 8: Run focused and full frontend tests**

Run:

```powershell
npm --prefix frontend test -- App.test.tsx RecipeManagementPage.test.tsx
npm --prefix frontend test
```

Expected: all frontend tests pass.

- [ ] **Step 9: Commit**

```powershell
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/features/recipes frontend/src/styles.css
git commit -m "feat: add recipe management page"
```

---

### Task 6: Make uploads deployable and verify the complete application

**Files:**
- Modify: `compose.yaml`
- Modify: `Dockerfile`
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`
- Modify: `backend/Dockerfile`

**Interfaces:**
- Consumes: `MealImagesPath=/app/images` and container user `app` UID/GID 1654.
- Produces: writable persistent `/app/images` storage in the supported Compose deployment.

- [ ] **Step 1: Update container mounts and permissions**

Remove `:ro` from the image bind mount in `compose.yaml`.

Ensure each production Dockerfile creates and owns both directories before switching users:

```dockerfile
RUN mkdir -p /app/data /app/images \
    && chown -R app:app /app/data /app/images \
    && chmod 0755 /app/data /app/images
```

Do not run the final process as root.

In `backend/Dockerfile`, use `/app/images` rather than `/app/wwwroot/images/meals` so Visual Studio and the supported root Dockerfile share the same `MealImagesPath` contract.

- [ ] **Step 2: Update operating documentation**

In `README.md` and `DEVELOPMENT.md`:

- describe `/app/images` as writable;
- require `chown -R 1654:1654` for both Unraid directories;
- replace the former manual SQLite `ImagePath` workflow with `/recipes`;
- retain the HTTPS/PWA, backup, and no-public-forwarding guidance.

- [ ] **Step 3: Validate Compose and run all automated checks**

Run:

```powershell
docker compose config --quiet
dotnet test MealCalendar.sln
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

Expected: all commands exit zero and no tests fail.

- [ ] **Step 4: Build and smoke-test the production image**

Run:

```powershell
docker build --tag meal-calendar:recipe-management .
docker run --detach --name meal-calendar-recipe-smoke --publish 18081:8080 meal-calendar:recipe-management
Invoke-WebRequest http://127.0.0.1:18081/api/health
Invoke-WebRequest http://127.0.0.1:18081/
Invoke-WebRequest http://127.0.0.1:18081/recipes
docker stop meal-calendar-recipe-smoke
docker rm meal-calendar-recipe-smoke
```

Expected: health, `/`, and `/recipes` return HTTP 200. Remove only the named smoke container.

- [ ] **Step 5: Verify upload persistence and cascade behavior in the container**

Use a named volume so the check never touches the production Unraid paths:

```powershell
docker volume create meal-calendar-recipe-smoke-data
docker volume create meal-calendar-recipe-smoke-images
docker run --detach --name meal-calendar-recipe-persistence --publish 18082:8080 --volume meal-calendar-recipe-smoke-data:/app/data --volume meal-calendar-recipe-smoke-images:/app/images meal-calendar:recipe-management
$recipeJson = curl.exe --fail -F "name=Uploaded Soup" -F "emoji=🍲" -F "image=@frontend/public/pwa-192x192.png;type=image/png" http://127.0.0.1:18082/api/v1/meals
$recipe = $recipeJson | ConvertFrom-Json
$assignment = @{ mealId = $recipe.id } | ConvertTo-Json
Invoke-RestMethod -Method Put -ContentType 'application/json' -Body $assignment -Uri 'http://127.0.0.1:18082/api/v1/schedule/2026-07-26'
docker run --rm --volume meal-calendar-recipe-smoke-images:/images alpine:3.22 find /images -maxdepth 1 -name 'managed-*.png'
docker restart meal-calendar-recipe-persistence
Invoke-RestMethod -Uri 'http://127.0.0.1:18082/api/v1/meals'
Invoke-RestMethod -Uri 'http://127.0.0.1:18082/api/v1/schedule?from=2026-07-26&to=2026-07-26'
Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:18082/api/v1/meals/$($recipe.id)"
Invoke-RestMethod -Uri 'http://127.0.0.1:18082/api/v1/meals'
Invoke-RestMethod -Uri 'http://127.0.0.1:18082/api/v1/schedule?from=2026-07-26&to=2026-07-26'
docker run --rm --volume meal-calendar-recipe-smoke-images:/images alpine:3.22 find /images -maxdepth 1 -name 'managed-*.png'
```

Before deletion, the recipe list, scheduled day, and one managed PNG must be present after restart. After deletion, the recipe list and schedule must be empty and `find` must print no managed PNG.

Clean up only the named smoke resources:

```powershell
docker stop meal-calendar-recipe-persistence
docker rm meal-calendar-recipe-persistence
docker volume rm meal-calendar-recipe-smoke-data
docker volume rm meal-calendar-recipe-smoke-images
```

- [ ] **Step 6: Browser-check both layouts**

At phone and landscape-tablet sizes:

- record `.planner-layout` top before, during, and after a pending save and assert the measurements are equal;
- create, edit, replace an image, remove an image, and delete a recipe at `/recipes`;
- confirm no calendar link exposes `/recipes`;
- confirm neither page has horizontal overflow.

- [ ] **Step 7: Commit deployment changes**

```powershell
git add compose.yaml Dockerfile backend/Dockerfile README.md DEVELOPMENT.md
git commit -m "docs: deploy writable recipe images"
```

- [ ] **Step 8: Final verification and review**

Re-run:

```powershell
dotnet test MealCalendar.sln
npm --prefix frontend test
npm --prefix frontend run build
docker compose config --quiet
git diff --check
git status --short --branch
```

Review the complete branch diff against `docs/superpowers/specs/2026-07-26-recipe-management-design.md`. Do not claim completion unless every command is green and no uncommitted implementation files remain.
