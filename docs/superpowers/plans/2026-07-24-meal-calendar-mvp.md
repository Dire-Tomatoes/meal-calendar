# Family Meal Calendar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a self-hosted, touch-friendly family meal-planning PWA with seeded meals, a draggable month calendar, durable SQLite scheduling, REST synchronization, tests, and a single Unraid-ready container.

**Architecture:** A React/TypeScript/Vite frontend and an ASP.NET Core minimal API remain separate source projects. The API persists one `ScheduleDay` per absolute ISO date through EF Core and SQLite, serves mounted meal images and the compiled PWA, and applies destination-replacement moves transactionally. TanStack Query owns browser server state, while pure calendar and drag-intent functions keep the React interaction understandable and testable.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core SQLite, xUnit, `WebApplicationFactory`, React, TypeScript, Vite, Vitest, Testing Library, `dnd-kit`, TanStack Query, a native service worker generated at build time, Docker Compose.

## Global Constraints

- Use React, TypeScript, Vite, PWA support, and `dnd-kit`; do not introduce Redux, Zustand, or a global application Context.
- Use ASP.NET Core, C#, a plain REST API, Entity Framework Core, and SQLite.
- Store schedule keys as absolute ISO `yyyy-MM-dd` dates; omit empty dates and allow at most one meal per date.
- A dugout meal is reusable; a calendar meal is a scheduled occurrence. Do not add placement IDs.
- Dropping onto an occupied destination replaces its meal. Keep this rule isolated in API and drag-intent boundaries.
- Use REST refetch/invalidation, focus refresh, reconnect refresh, and 30-second polling; do not add SignalR or WebSockets.
- Use one production container serving both `/` and `/api/v1/*`.
- Persist the SQLite database and mounted images outside the replaceable container.
- Keep authentication outside the MVP and preserve all listed MVP non-goals.
- Optimize for a landscape wall tablet, large touch targets, touch dragging, and a responsive phone layout with no hover-only actions.
- Use a Sunday-first, six-week month grid whose adjacent-month days remain droppable.

## Dependency Security Amendment — 2026-07-24

The implementation originally planned `vite-plugin-pwa`. npm's current audit data reports high-severity dependency chains in both available Workbox 7.4 patch releases: 7.4.0 through `@surma/rollup-plugin-off-main-thread`, and 7.4.1 through its replacement `@trickfilm400/rollup-plugin-off-main-thread`. Both chains reach vulnerable EJS/Jake/Filelist/Minimatch packages, and 7.4.0 also reaches a vulnerable `serialize-javascript`.

Because no audit-clean published Workbox release satisfies the plugin, Task 7 must not use `vite-plugin-pwa`, Workbox, or fragile major-version overrides of transitive build packages. It will instead generate a small native service worker after Vite builds. The generator uses Node standard libraries, Vite's build manifest, and a checked-in template. This preserves installability, offline application-shell caching, API cache exclusion, and a prompted update lifecycle while reducing dependencies. `sharp` must be at least 0.35.3, which contains the upstream libvips security fixes.

This amendment supersedes conflicting `vite-plugin-pwa`, Workbox, or `virtual:pwa-register/react` instructions later in this plan.

---

## File Map

### Backend

- `backend/MealCalendar.Api.csproj`: API dependencies and .NET target.
- `backend/Program.cs`: dependency registration, database initialization, middleware, static files, and endpoint composition.
- `backend/appsettings.json`: default SQLite connection and image directory.
- `backend/Data/MealCalendarDbContext.cs`: EF Core sets, keys, relationship, and column constraints.
- `backend/Data/DatabaseInitialization.cs`: data-directory creation, migration, and seed orchestration.
- `backend/Data/MealSeed.cs`: stable premade meal definitions and idempotent seed logic.
- `backend/Data/Migrations/*`: initial SQLite schema migration and model snapshot.
- `backend/Models/Meal.cs`: reusable meal entity.
- `backend/Models/ScheduleDay.cs`: one date-to-meal assignment.
- `backend/Contracts/MealResponse.cs`: public meal DTO with browser image URL.
- `backend/Contracts/ScheduleResponse.cs`: `days` dictionary response.
- `backend/Contracts/ScheduleRequests.cs`: assign and move request records.
- `backend/Endpoints/ApiProblem.cs`: consistent Problem Details construction.
- `backend/Endpoints/MealsEndpoints.cs`: meal-list route group.
- `backend/Endpoints/ScheduleEndpoints.cs`: schedule read, assign, remove, and move route group.
- `backend/Utilities/IsoDate.cs`: strict ISO date parser.

### Backend tests

- `backend.tests/MealCalendar.Api.Tests.csproj`: xUnit and API test-host dependencies.
- `backend.tests/MealCalendarApiFactory.cs`: unique temporary SQLite database per test class.
- `backend.tests/MealsEndpointsTests.cs`: seeded meal contract coverage.
- `backend.tests/ScheduleAssignmentTests.cs`: range, assign, replace, remove, and validation coverage.
- `backend.tests/ScheduleMoveTests.cs`: transactional move and destination replacement coverage.

### Frontend

- `frontend/package.json`: scripts and runtime/test dependencies.
- `frontend/package-lock.json`: deterministic dependency graph.
- `frontend/tsconfig*.json`: browser and build TypeScript settings.
- `frontend/vite.config.ts`: React, Vitest, development proxy, and build-manifest configuration.
- `frontend/index.html`: application shell and metadata.
- `frontend/public/icon.svg`: installable scalable application icon.
- `frontend/src/main.tsx`: React and Query Client bootstrap.
- `frontend/src/App.tsx`: top-level page composition.
- `frontend/src/styles.css`: responsive visual system and touch states.
- `frontend/src/test/setup.ts`: DOM test matchers and browser stubs.
- `frontend/src/app/queryClient.ts`: shared TanStack Query defaults.
- `frontend/src/features/meal-planner/model/types.ts`: meals, schedule, range, drag data, targets, and commands.
- `frontend/src/features/meal-planner/model/calendar.ts`: date-key conversion and 42-day grid calculation.
- `frontend/src/features/meal-planner/model/calendar.test.ts`: calendar boundary tests.
- `frontend/src/features/meal-planner/model/dragIntent.ts`: pure drop-to-command mapping.
- `frontend/src/features/meal-planner/model/dragIntent.test.ts`: assign/move/remove/no-op tests.
- `frontend/src/features/meal-planner/api/client.ts`: fetch wrapper and typed REST functions.
- `frontend/src/features/meal-planner/api/queries.ts`: meals/schedule queries and mutation invalidation.
- `frontend/src/features/meal-planner/hooks/useOnlineStatus.ts`: online/offline event state.
- `frontend/src/features/meal-planner/components/MealTile.tsx`: draggable visual tile with image fallback.
- `frontend/src/features/meal-planner/components/MealTile.test.tsx`: missing and failed image behavior.
- `frontend/src/features/meal-planner/components/DraggableMealTile.tsx`: source-aware `useDraggable` adapter around the presentational tile.
- `frontend/src/features/meal-planner/components/CalendarToolbar.tsx`: month navigation.
- `frontend/src/features/meal-planner/components/DaySlot.tsx`: day drop target.
- `frontend/src/features/meal-planner/components/MonthCalendar.tsx`: accessible calendar grid.
- `frontend/src/features/meal-planner/components/MealDugout.tsx`: reusable tray and removal target.
- `frontend/src/features/meal-planner/components/ConnectionStatus.tsx`: connectivity, refresh, and mutation feedback.
- `frontend/src/features/meal-planner/components/UpdatePrompt.tsx`: controlled service-worker activation.
- `frontend/src/features/meal-planner/hooks/useServiceWorkerUpdate.ts`: native service-worker registration and waiting-worker lifecycle.
- `frontend/src/features/meal-planner/MealPlannerPage.tsx`: visible month, DnD sensors, overlay, and command dispatch.
- `frontend/scripts/generate-icons.mjs`: deterministic SVG-to-PNG PWA icon generation.
- `frontend/scripts/generate-service-worker.mjs`: hash-aware application-shell service-worker generation.
- `frontend/public/manifest.webmanifest`: installable application metadata.
- `frontend/public/sw-template.js`: native service-worker behavior with build placeholders.
- `frontend/public/pwa-192x192.png`: generated Chromium install icon.
- `frontend/public/pwa-512x512.png`: generated large and maskable install icon.
- `frontend/public/apple-touch-icon.png`: generated iOS home-screen icon.

### Deployment

- `.dockerignore`: exclude local outputs and persisted data.
- `.gitignore`: exclude .NET, Node, database, test, and editor outputs.
- `Dockerfile`: Node build, .NET publish, and non-root ASP.NET runtime stages.
- `compose.yaml`: one service with Unraid data/image mounts and health check.
- `README.md`: development, tests, image behavior, Unraid installation, update, backup, and troubleshooting.

---

### Task 1: Backend Foundation, Schema, and Seeded Meals

**Files:**
- Create: `backend/MealCalendar.Api.csproj`
- Create: `backend/Program.cs`
- Create: `backend/appsettings.json`
- Create: `backend/Models/Meal.cs`
- Create: `backend/Models/ScheduleDay.cs`
- Create: `backend/Data/MealCalendarDbContext.cs`
- Create: `backend/Data/MealSeed.cs`
- Create: `backend/Data/DatabaseInitialization.cs`
- Create: `backend/Data/Migrations/20260724000000_InitialCreate.cs`
- Create: `backend/Data/Migrations/MealCalendarDbContextModelSnapshot.cs`
- Create: `backend/Contracts/MealResponse.cs`
- Create: `backend/Endpoints/MealsEndpoints.cs`
- Create: `backend.tests/MealCalendar.Api.Tests.csproj`
- Create: `backend.tests/MealCalendarApiFactory.cs`
- Create: `backend.tests/MealsEndpointsTests.cs`

**Interfaces:**
- Produces: `MealCalendarDbContext`, `DatabaseInitialization.InitializeDatabaseAsync(WebApplication)`, `MealSeed.SeedAsync(MealCalendarDbContext, CancellationToken)`, and `IEndpointRouteBuilder.MapMealsEndpoints()`.
- Produces API: `GET /api/v1/meals -> MealResponse[]`, where `MealResponse(string Id, string Name, string Emoji, string? ImageUrl)`.

- [ ] **Step 1: Scaffold the API and test projects**

Create `backend/MealCalendar.Api.csproj` targeting `net10.0` with nullable and implicit usings enabled. Add `Microsoft.EntityFrameworkCore.Sqlite` and `Microsoft.EntityFrameworkCore.Design`. Create `backend.tests/MealCalendar.Api.Tests.csproj` targeting `net10.0` with references to `Microsoft.AspNetCore.Mvc.Testing`, `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, and the API project.

Create a solution so the verification command is:

```powershell
dotnet new sln --name MealCalendar
dotnet sln MealCalendar.sln add backend/MealCalendar.Api.csproj
dotnet sln MealCalendar.sln add backend.tests/MealCalendar.Api.Tests.csproj
```

- [ ] **Step 2: Write the failing seeded-meals integration test**

`MealsEndpointsTests.GetMealsReturnsStableSeededDefinitions` must request `/api/v1/meals`, require success, deserialize camel-case JSON, and assert at least these stable pairs:

```csharp
("tacos", "Tacos", "🌮")
("pizza", "Pizza", "🍕")
("pasta", "Pasta", "🍝")
("curry", "Curry", "🍛")
```

Also assert every returned ID is unique and every meal has a non-empty name and emoji.

- [ ] **Step 3: Run the test and verify the expected failure**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter GetMealsReturnsStableSeededDefinitions
```

Expected: FAIL because the API host, schema, and endpoint do not exist yet.

- [ ] **Step 4: Implement entities, DbContext, initial migration, and seed**

Use these entity shapes:

```csharp
public sealed class Meal
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public required string Emoji { get; set; }
    public string? ImagePath { get; set; }
    public ICollection<ScheduleDay> ScheduleDays { get; } = [];
}

public sealed class ScheduleDay
{
    public DateOnly Date { get; init; }
    public required string MealId { get; set; }
    public Meal? Meal { get; set; }
}
```

Configure `ScheduleDay.Date` as its primary key, `Meal.Id` with a 64-character maximum, `Meal.Name` with a 120-character maximum, `Meal.Emoji` with a 16-character maximum, and the foreign key with `DeleteBehavior.Restrict`.

The initial migration creates `Meals` and `ScheduleDays`, adds a unique primary key on `ScheduleDays.Date`, and adds an index on `ScheduleDays.MealId`.

Seed these IDs idempotently without deleting existing records:

```text
tacos / Tacos / 🌮
pizza / Pizza / 🍕
pasta / Pasta / 🍝
burgers / Burgers / 🍔
curry / Curry / 🍛
stir-fry / Stir Fry / 🥡
soup / Soup / 🍲
leftovers / Leftovers / ♻️
```

For existing seed IDs, update `Name` and `Emoji` but preserve `ImagePath`.

- [ ] **Step 5: Implement startup and meal endpoint**

`Program.cs` must:

1. Read `ConnectionStrings:MealCalendar`, defaulting to `Data Source=data/meal-calendar.db`.
2. Create the SQLite file's parent directory.
3. Register `MealCalendarDbContext` with SQLite and `AddProblemDetails()`.
4. Build the application, enable `UseExceptionHandler()`, and call `InitializeDatabaseAsync`.
5. Expose an existing configured image directory at `/images/meals`.
6. Map `/api/v1/meals`, `/api/health`, default files, static files, and `MapFallbackToFile("index.html")`.
7. End with `public partial class Program;` for `WebApplicationFactory`.

Map meal entities to:

```csharp
new MealResponse(
    meal.Id,
    meal.Name,
    meal.Emoji,
    meal.ImagePath is null
        ? null
        : $"/images/meals/{Uri.EscapeDataString(meal.ImagePath)}")
```

Return meals ordered by name.

- [ ] **Step 6: Make the temporary SQLite test host deterministic**

`MealCalendarApiFactory` derives from `WebApplicationFactory<Program>`, creates a unique database path beneath `Path.GetTempPath()`, overrides `ConnectionStrings:MealCalendar`, and deletes the database plus `-shm` and `-wal` sidecars in `DisposeAsync`.

- [ ] **Step 7: Run the backend foundation tests**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj
```

Expected: PASS, including the seeded meals test.

- [ ] **Step 8: Commit the foundation**

```powershell
git add MealCalendar.sln backend backend.tests
git commit -m "feat: add persisted meal API foundation"
```

---

### Task 2: Schedule Range, Assignment, Replacement, and Removal

**Files:**
- Create: `backend/Contracts/ScheduleResponse.cs`
- Create: `backend/Contracts/ScheduleRequests.cs`
- Create: `backend/Endpoints/ApiProblem.cs`
- Create: `backend/Utilities/IsoDate.cs`
- Create: `backend/Endpoints/ScheduleEndpoints.cs`
- Create: `backend.tests/ScheduleAssignmentTests.cs`
- Modify: `backend/Program.cs`

**Interfaces:**
- Consumes: `MealCalendarDbContext`.
- Produces: `IsoDate.TryParse(string?, out DateOnly)`.
- Produces API: `GET /api/v1/schedule`, `PUT /api/v1/schedule/{date}`, and `DELETE /api/v1/schedule/{date}`.
- Produces contracts: `ScheduleResponse(IReadOnlyDictionary<string,string> Days)` and `AssignMealRequest(string MealId)`.

- [ ] **Step 1: Write failing assignment, replacement, range, and removal tests**

Create isolated tests that:

1. `PUT` tacos to `2026-07-24`, then assert the range response contains `"2026-07-24": "tacos"`.
2. `PUT` tacos and then pizza to the same date, then assert only pizza remains.
3. Assign meals just inside and outside an inclusive range, then assert only in-range entries return.
4. Assign then `DELETE`, then assert the date key is absent.
5. Delete an empty date twice and assert both responses are `204`.
6. Send `2026-7-24`, `2026-02-30`, reversed range bounds, and an unknown meal, then assert structured `400`, `400`, `400`, and `404` responses respectively.

Every Problem Details assertion must verify `status`, a non-empty `title`, and a stable `code` such as `invalid_date`, `invalid_range`, or `meal_not_found`.

- [ ] **Step 2: Run the new tests and verify failure**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter ScheduleAssignmentTests
```

Expected: FAIL with `404` because schedule endpoints are not mapped.

- [ ] **Step 3: Implement strict date parsing and error helper**

`IsoDate.TryParse` uses invariant culture and the exact `yyyy-MM-dd` format:

```csharp
DateOnly.TryParseExact(
    value,
    "yyyy-MM-dd",
    CultureInfo.InvariantCulture,
    DateTimeStyles.None,
    out date)
```

`ApiProblem.Create(status, title, code, detail)` returns `Results.Problem` with the `code` extension.

- [ ] **Step 4: Implement schedule range query**

Validate both query values and `from <= to`. Query `ScheduleDays` with `AsNoTracking()`, inclusive bounds, and return:

```csharp
new ScheduleResponse(rows.ToDictionary(
    row => row.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
    row => row.MealId))
```

- [ ] **Step 5: Implement assign-or-replace**

Validate the route date and non-empty body meal ID. Confirm the meal exists. Add a `ScheduleDay` when absent or set `existing.MealId` when present. Save once and return `204 No Content`.

- [ ] **Step 6: Implement idempotent removal**

Validate the route date. Remove and save only when a row exists. Return `204 No Content` whether or not it existed.

- [ ] **Step 7: Map endpoints and run tests**

Call `app.MapScheduleEndpoints()` before the SPA fallback.

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj
```

Expected: PASS for seeded meals plus all schedule assignment tests.

- [ ] **Step 8: Commit schedule assignment behavior**

```powershell
git add backend backend.tests
git commit -m "feat: assign replace and remove scheduled meals"
```

---

### Task 3: Transactional Schedule Movement

**Files:**
- Modify: `backend/Contracts/ScheduleRequests.cs`
- Modify: `backend/Endpoints/ScheduleEndpoints.cs`
- Create: `backend.tests/ScheduleMoveTests.cs`

**Interfaces:**
- Consumes: strict ISO parsing and `ScheduleDay`.
- Produces contract: `MoveMealRequest(string FromDate, string ToDate)`.
- Produces API: `POST /api/v1/schedule/move`.

- [ ] **Step 1: Write failing movement tests**

Test these API sequences:

1. Assign tacos to July 24, move to July 25, and assert July 24 is absent while July 25 is tacos.
2. Assign tacos to July 24 and pizza to July 25, move July 24 to July 25, and assert July 24 is absent while July 25 is tacos.
3. Move July 24 to itself and assert the existing assignment remains.
4. Move from an empty source and assert `404` with `code = "source_not_found"` and no destination change.
5. Submit an invalid source or destination date and assert `400` with `code = "invalid_date"`.

- [ ] **Step 2: Run movement tests and verify failure**

Run:

```powershell
dotnet test backend.tests/MealCalendar.Api.Tests.csproj --filter ScheduleMoveTests
```

Expected: FAIL with `404` because the move route is absent.

- [ ] **Step 3: Implement the transactional move endpoint**

Parse both dates before starting a transaction. Inside `BeginTransactionAsync`:

1. Load the source assignment.
2. Return `source_not_found` when absent.
3. Return `204` for the same source and destination.
4. Load the destination.
5. Add a destination with the source meal when absent, otherwise replace `destination.MealId`.
6. Remove the source.
7. Save once and commit.

Do not expose or create placement identifiers.

- [ ] **Step 4: Run all backend tests**

Run:

```powershell
dotnet test MealCalendar.sln
```

Expected: PASS for meal, assignment, replacement, removal, validation, and movement behavior.

- [ ] **Step 5: Commit movement behavior**

```powershell
git add backend backend.tests
git commit -m "feat: move scheduled meals transactionally"
```

---

### Task 4: Frontend Foundation and Pure Calendar/Drag Domain

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/package-lock.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/features/meal-planner/model/types.ts`
- Create: `frontend/src/features/meal-planner/model/calendar.ts`
- Create: `frontend/src/features/meal-planner/model/calendar.test.ts`
- Create: `frontend/src/features/meal-planner/model/dragIntent.ts`
- Create: `frontend/src/features/meal-planner/model/dragIntent.test.ts`

**Interfaces:**
- Produces: `Meal`, `Schedule`, `DateRange`, `MealDragData`, `DropTargetData`, and `ScheduleCommand`.
- Produces: `toDateKey(Date): string`, `fromDateKey(string): Date`, `getMonthGrid(Date): string[]`, and `getGridRange(Date): DateRange`.
- Produces: `resolveDragIntent(MealDragData, DropTargetData | undefined): ScheduleCommand`.

- [ ] **Step 1: Create Vite React TypeScript and Vitest configuration**

Use scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "preview": "vite preview"
}
```

Add runtime dependencies for React, React DOM, `@dnd-kit/core`, and `@tanstack/react-query`; add development dependencies for Vite, TypeScript, React plugin, Vitest, jsdom, Testing Library, jest-dom, and `sharp` 0.35.3 or newer. Do not add `vite-plugin-pwa` or Workbox.

Configure Vitest with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]`. Configure the Vite development server to proxy `/api` and `/images` to `http://localhost:5000`.

- [ ] **Step 2: Write failing calendar tests**

Assert:

```text
July 2026 grid length = 42
first key = 2026-06-28
last key = 2026-08-08
every adjacent pair advances exactly one local calendar day
February 2028 includes 2028-02-29
getGridRange(July 2026) = 2026-06-28 through 2026-08-08
```

- [ ] **Step 3: Write failing drag-intent tests**

Use discriminated unions and assert exact outputs:

```ts
dugout tacos -> day 2026-07-24
  { kind: "assign", date: "2026-07-24", mealId: "tacos" }

calendar tacos on July 24 -> day July 25
  { kind: "move", fromDate: "2026-07-24", toDate: "2026-07-25" }

calendar tacos on July 24 -> dugout
  { kind: "remove", date: "2026-07-24" }

calendar meal -> same day
  { kind: "none" }

dugout meal -> dugout
  { kind: "none" }

missing target
  { kind: "none" }
```

- [ ] **Step 4: Run frontend tests and verify failure**

Run:

```powershell
npm --prefix frontend test
```

Expected: FAIL because domain functions are not implemented.

- [ ] **Step 5: Implement date-safe calendar utilities**

`toDateKey` manually combines local `getFullYear()`, `getMonth() + 1`, and `getDate()` with two-digit month/day padding. `fromDateKey` validates `^\d{4}-\d{2}-\d{2}$`, constructs `new Date(year, month - 1, day)`, and rejects normalized invalid dates.

`getMonthGrid` finds the Sunday on or before the month’s first day, then produces exactly 42 keys using `new Date(year, month, day + offset)` so daylight-saving transitions do not add milliseconds manually.

- [ ] **Step 6: Implement typed drag-intent mapping**

Use:

```ts
export type ScheduleCommand =
  | { kind: "assign"; date: DateKey; mealId: MealId }
  | { kind: "move"; fromDate: DateKey; toDate: DateKey }
  | { kind: "remove"; date: DateKey }
  | { kind: "none" };
```

Implement the four documented drop rules as one pure function with an exhaustive `source` switch.

- [ ] **Step 7: Run tests and production type build**

Run:

```powershell
npm --prefix frontend test
npm --prefix frontend run build
```

Expected: all pure-domain tests PASS and TypeScript compilation succeeds.

- [ ] **Step 8: Commit frontend foundation**

```powershell
git add frontend
git commit -m "feat: add calendar and drag domain"
```

---

### Task 5: REST Client, Query Hooks, and Visual Components

**Files:**
- Create: `frontend/src/app/queryClient.ts`
- Create: `frontend/src/features/meal-planner/api/client.ts`
- Create: `frontend/src/features/meal-planner/api/queries.ts`
- Create: `frontend/src/features/meal-planner/hooks/useOnlineStatus.ts`
- Create: `frontend/src/features/meal-planner/components/MealTile.tsx`
- Create: `frontend/src/features/meal-planner/components/MealTile.test.tsx`
- Create: `frontend/src/features/meal-planner/components/DraggableMealTile.tsx`
- Create: `frontend/src/features/meal-planner/components/CalendarToolbar.tsx`
- Create: `frontend/src/features/meal-planner/components/DaySlot.tsx`
- Create: `frontend/src/features/meal-planner/components/MonthCalendar.tsx`
- Create: `frontend/src/features/meal-planner/components/MealDugout.tsx`
- Create: `frontend/src/features/meal-planner/components/ConnectionStatus.tsx`

**Interfaces:**
- Consumes: domain types and calendar utilities.
- Produces REST functions: `getMeals()`, `getSchedule(DateRange)`, `assignMeal(DateKey, MealId)`, `moveMeal(DateKey, DateKey)`, and `removeMeal(DateKey)`.
- Produces hooks: `useMeals()`, `useSchedule(DateRange)`, `useScheduleMutations()`, and `useOnlineStatus()`.
- Produces presentational/drop components used by `MealPlannerPage`.

- [ ] **Step 1: Write failing MealTile fallback tests**

Test:

1. No `imageUrl` renders emoji and name without an `<img>`.
2. A valid `imageUrl` initially renders an image with descriptive alt text.
3. Firing the image `error` event removes/hides the broken image and reveals the emoji.
4. Both dugout and scheduled variants expose a minimum accessible label containing the meal name.

- [ ] **Step 2: Run the component test and verify failure**

Run:

```powershell
npm --prefix frontend test -- MealTile
```

Expected: FAIL because `MealTile` does not exist.

- [ ] **Step 3: Implement the typed REST client**

`request<T>` must:

- Send and accept JSON.
- Return `undefined` for `204`.
- Parse successful JSON as `T`.
- Parse Problem Details failures and throw `ApiError` containing `status`, `code`, and `detail`.

Use these exact request shapes:

```ts
PUT /api/v1/schedule/{encodedDate} { "mealId": mealId }
POST /api/v1/schedule/move { "fromDate": fromDate, "toDate": toDate }
DELETE /api/v1/schedule/{encodedDate}
```

- [ ] **Step 4: Implement TanStack Query hooks**

Use query keys:

```ts
["meals"]
["schedule", range.from, range.to]
```

Schedule query options include `refetchInterval: 30_000`, `refetchOnWindowFocus: true`, and `refetchOnReconnect: true`.

Each mutation calls its REST function and, on success, invalidates every query whose key begins with `["schedule"]`. Expose the three mutation objects so the page can dispatch commands directly.

- [ ] **Step 5: Implement online status and visual components**

`useOnlineStatus` initializes from `navigator.onLine`, listens to `online` and `offline`, and removes both listeners on cleanup.

`MealTile` tracks failed image state, resets that state when `imageUrl` changes, renders a large emoji fallback, and accepts DOM/drag props without owning schedule business logic.

`DraggableMealTile` accepts exactly one `MealDragData` value. It derives `dugout:${mealId}` or `calendar:${date}` as its ID, calls `useDraggable`, and passes the returned ref, listeners, attributes, transform, and dragging state to `MealTile`. This keeps hook calls inside a component rather than inside a list loop.

`DaySlot` uses `useDroppable({ id: "day:" + date, data: { target: "day", date } })` and renders a calendar-source `DraggableMealTile` when assigned.

`MealDugout` uses `useDroppable({ id: "dugout", data: { target: "dugout" } })` and renders one dugout-source `DraggableMealTile` per meal.

`MonthCalendar` renders weekday headings Sunday through Saturday and the 42 `DaySlot` components.

`ConnectionStatus` renders only concise states: Offline, Saving, Refreshing, or an actionable error message.

- [ ] **Step 6: Run frontend tests**

Run:

```powershell
npm --prefix frontend test
```

Expected: PASS for domain and MealTile tests.

- [ ] **Step 7: Commit data access and presentational UI**

```powershell
git add frontend
git commit -m "feat: add meal planner data and components"
```

---

### Task 6: Integrated Drag-and-Drop Meal Planner

**Files:**
- Create: `frontend/src/features/meal-planner/MealPlannerPage.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/styles.css`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: query hooks, pure drag intent, calendar utilities, and all presentational components.
- Produces: mounted application at `#root`.

- [ ] **Step 1: Add a failing application smoke test**

Create `frontend/src/features/meal-planner/MealPlannerPage.test.tsx` with mocked API responses. Render under `QueryClientProvider` and assert that:

- The current month heading appears.
- Seeded meal names appear in the dugout.
- A scheduled meal appears in its date cell.
- Previous, Today, and Next controls are buttons.

- [ ] **Step 2: Run the smoke test and verify failure**

Run:

```powershell
npm --prefix frontend test -- MealPlannerPage
```

Expected: FAIL because the page is absent.

- [ ] **Step 3: Implement page state, sensors, and drag dispatch**

`MealPlannerPage` owns a `visibleMonth` initialized to the current local month. It derives the 42 keys and `DateRange`, queries meals/schedule, and configures:

```ts
useSensor(MouseSensor, { activationConstraint: { distance: 6 } })
useSensor(TouchSensor, {
  activationConstraint: { delay: 180, tolerance: 8 }
})
useSensor(KeyboardSensor)
```

On drag start, store the active `MealDragData` for the overlay. On drag cancel, clear it. On drag end:

1. Read active drag data and target data.
2. Call `resolveDragIntent`.
3. Dispatch to assign, move, or remove mutation only when online and no mutation is already pending.
4. Clear overlay state.

The overlay renders the dragged meal by ID without adding another draggable hook.

- [ ] **Step 4: Implement navigation and loading/error boundaries**

Previous and next create a new local date on the first of the adjacent month. Today resets to the first of the current local month. Initial loading uses a calendar-shaped skeleton; a fatal meal/schedule load error shows a retry button that invalidates both query families.

- [ ] **Step 5: Implement the responsive visual system**

Use CSS custom properties for a warm neutral background, dark readable text, green/terracotta accents, cell borders, radii, and elevation.

Required layout behavior:

- At widths of at least `900px`, `.planner-layout` is a grid with `minmax(0, 1fr) minmax(220px, 300px)` columns and the dugout remains visible beside the calendar.
- Below `900px`, the layout becomes one column and `.dugout-list` becomes a horizontally scrollable row.
- Calendar stays seven columns without page-level horizontal scrolling.
- Every button and draggable tile has a minimum 44-pixel interactive dimension.
- Meal tiles use image/emoji as the dominant visual, clamp names rather than overflow, and visibly lift while dragging.
- Adjacent-month cells use reduced contrast but remain usable.
- Today, drag-over, offline, focus-visible, and mutation-pending states are visually distinct.
- Honor `prefers-reduced-motion`.

- [ ] **Step 6: Bootstrap React and run the complete frontend checks**

Create one `QueryClient`, render `<App />` under `QueryClientProvider` and `React.StrictMode`, and import the global stylesheet.

Run:

```powershell
npm --prefix frontend test
npm --prefix frontend run build
```

Expected: all tests PASS and Vite emits `frontend/dist`.

- [ ] **Step 7: Commit integrated planner**

```powershell
git add frontend
git commit -m "feat: build draggable responsive meal planner"
```

---

### Task 7: Installable Native PWA and Controlled Updates

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/icon.svg`
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/sw-template.js`
- Create: `frontend/scripts/generate-icons.mjs`
- Create: `frontend/scripts/generate-service-worker.mjs`
- Generate: `frontend/public/pwa-192x192.png`
- Generate: `frontend/public/pwa-512x512.png`
- Generate: `frontend/public/apple-touch-icon.png`
- Create: `frontend/src/features/meal-planner/hooks/useServiceWorkerUpdate.ts`
- Create: `frontend/src/features/meal-planner/components/UpdatePrompt.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/vite-env.d.ts`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: browser `navigator.serviceWorker` APIs and Vite's generated `.vite/manifest.json`.
- Produces: installable manifest and an “Update available” prompt that activates the waiting service worker only after user action.

- [ ] **Step 1: Generate icons, manifest, and a versioned native service worker**

Create a simple plate-and-calendar `icon.svg`. Add a `generate:icons` package script backed by `scripts/generate-icons.mjs`, which uses `sharp` to render the SVG as 192×192, 512×512, and 180×180 PNG files before every build.

Create `manifest.webmanifest` with the application name, short name, description, warm theme/background colors, standalone display, `/` start URL, and the generated 192- and 512-pixel PNG icons. Add manifest, theme-color, and apple-touch-icon links to `index.html`.

Enable `build.manifest` in Vite. `generate-service-worker.mjs` must read `dist/.vite/manifest.json`, collect the entry JavaScript/CSS assets, add `/`, `/index.html`, the web manifest, and generated icons, derive a cache version from a SHA-256 hash of that list, replace placeholders in `sw-template.js`, and write `dist/sw.js`.

The service-worker template must:

- Precache only the generated application shell during installation.
- Remain waiting instead of calling `skipWaiting()` automatically.
- On `SKIP_WAITING`, call `self.skipWaiting()`.
- On activation, delete older application-shell caches and claim clients.
- Ignore non-GET and cross-origin requests.
- Always use the network for `/api/*` and `/images/meals/*`.
- Use network-first navigation with cached `/index.html` only as the offline fallback.
- Use cache-first behavior only for the versioned precache entries.

- [ ] **Step 2: Implement the update prompt**

`useServiceWorkerUpdate` registers `/sw.js` after page load with `updateViaCache: "none"`, detects an already waiting worker and newly installed updates, and exposes `needRefresh`, `activateUpdate`, and `dismissUpdate`. `activateUpdate` posts `SKIP_WAITING`, waits for `controllerchange`, and reloads once. `dismissUpdate` hides the current prompt without activating the worker. Registration errors are logged without breaking the calendar.

`UpdatePrompt` renders a compact banner only when `needRefresh` is true. Its “Update now” and “Later” buttons call the hook actions.

- [ ] **Step 3: Add an offline-shell build assertion**

After building, assert that `frontend/dist/manifest.webmanifest`, `frontend/dist/sw.js`, all three PNG icons, and hashed Vite assets exist. Assert no Workbox bundle is present.

Run:

```powershell
npm --prefix frontend run build
Get-ChildItem frontend/dist
```

Expected: the manifest, generated native service worker, application assets, and icons are present.

- [ ] **Step 4: Commit PWA behavior**

```powershell
git add frontend
git commit -m "feat: add installable PWA update flow"
```

---

### Task 8: Single-Container Deployment and Operational Documentation

**Files:**
- Create: `.dockerignore`
- Create: `.gitignore`
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `README.md`
- Modify: `backend/appsettings.json`

**Interfaces:**
- Consumes: `frontend/dist` build contract and ASP.NET static file hosting.
- Produces: one production image listening on port `8080`, persistent `/app/data`, optional read-only `/app/images`, and `/api/health`.

- [ ] **Step 1: Write the multi-stage Dockerfile**

Use:

1. `node:24-alpine` to run `npm ci` and `npm run build`.
2. `mcr.microsoft.com/dotnet/sdk:10.0-alpine` to restore and publish the API.
3. `mcr.microsoft.com/dotnet/aspnet:10.0-alpine` as the runtime.

Copy `frontend/dist` into the publish output’s `wwwroot`. Create `/app/data` and `/app/images`, give the runtime user ownership of `/app/data`, switch to the image’s non-root application user, set `ASPNETCORE_HTTP_PORTS=8080`, and expose `8080`.

- [ ] **Step 2: Write Compose persistence and health behavior**

Create one `meal-calendar` service with:

```yaml
ports:
  - "8080:8080"
volumes:
  - /mnt/user/appdata/meal-calendar/data:/app/data
  - /mnt/user/appdata/meal-calendar/images:/app/images:ro
environment:
  ConnectionStrings__MealCalendar: Data Source=/app/data/meal-calendar.db
  MealImagesPath: /app/images
restart: unless-stopped
```

The health check requests `http://127.0.0.1:8080/api/health`.

- [ ] **Step 3: Document local and Unraid workflows**

README sections must include:

- Architecture and repository map.
- Prerequisites.
- Backend development and `dotnet test MealCalendar.sln`.
- Frontend development, Vite API proxy, `npm test`, and `npm run build`.
- Docker build/run and `docker compose up -d --build`.
- Unraid paths, permissions, first startup, LAN/Tailscale/reverse-proxy guidance.
- Meal image mapping and emoji fallback.
- Database and images backup/restore.
- Update flow and prompted PWA refresh.
- Troubleshooting stale assets, database permissions, and offline clients.
- Explicit MVP non-goals and where meal definitions are currently seeded.

- [ ] **Step 4: Verify ignored files and source tracking**

Ignore:

```text
**/bin/
**/obj/
frontend/node_modules/
frontend/dist/
data/
*.db
*.db-shm
*.db-wal
.vs/
.vscode/
```

Run:

```powershell
git status --short
```

Expected: source, lockfile, configuration, migration, tests, and docs are visible; build outputs and local databases are absent.

- [ ] **Step 5: Build and smoke-test the production image**

Run:

```powershell
docker build -t meal-calendar:mvp .
docker run --detach --name meal-calendar-smoke --publish 18080:8080 meal-calendar:mvp
```

Verify:

```powershell
Invoke-WebRequest http://127.0.0.1:18080/api/health
Invoke-WebRequest http://127.0.0.1:18080/api/v1/meals
Invoke-WebRequest http://127.0.0.1:18080/
```

Expected: health and meals return `200`, and `/` returns the built React shell. Stop and remove only the named `meal-calendar-smoke` container after the checks.

- [ ] **Step 6: Run the full verification suite**

Run:

```powershell
dotnet test MealCalendar.sln
npm --prefix frontend test
npm --prefix frontend run build
docker build -t meal-calendar:mvp .
```

Expected: every command exits `0`.

- [ ] **Step 7: Commit deployment and documentation**

```powershell
git add .dockerignore .gitignore Dockerfile compose.yaml README.md backend/appsettings.json
git commit -m "docs: add Unraid single-container deployment"
```
