# Family Meal Calendar — MVP Design

## Purpose

Build a self-hosted Progressive Web App that replaces a household meal-planning whiteboard. The primary display is a wall-mounted Amazon Fire tablet, while iPhones and other mobile devices can use the same application. The experience centers on visual meal tiles that can be dragged from a reusable dugout onto absolute calendar dates.

The MVP deliberately excludes meal editing, recipes, grocery lists, accounts, notifications, recurring schedules, multiple meals per day, and real-time push synchronization.

## Architecture

The repository contains two source projects and one production container:

- `frontend/`: React, TypeScript, Vite, `dnd-kit`, TanStack Query, and PWA support.
- `backend/`: ASP.NET Core minimal REST API, Entity Framework Core, and SQLite.
- Root deployment files: a multi-stage `Dockerfile`, `compose.yaml`, and operational documentation.

The Docker build compiles the Vite application, publishes the ASP.NET Core application, and copies the frontend output into the API's `wwwroot`. ASP.NET Core serves both the SPA and `/api/v1/*` from one origin.

The backend remains one project for the MVP. Its folders separate data access, models, endpoint registration, contracts, and seed data without introducing additional assemblies or abstraction layers.

## Data Model

`Meal` is a reusable definition:

- `Id`: stable string primary key.
- `Name`: display name.
- `Emoji`: required fallback visual.
- `ImagePath`: optional server-relative image filename or path.

`ScheduleDay` is one assignment on one absolute date:

- `Date`: `DateOnly` primary key.
- `MealId`: foreign key to `Meal`.

This schema guarantees at most one meal per date while allowing the same meal on any number of dates. Empty dates have no database row. EF Core migrations manage schema evolution, and startup seeding inserts or updates the initial meal definitions without deleting schedule data.

SQLite is stored at `/app/data/meal-calendar.db` in production. Mounted images are read from `/app/images` and exposed by ASP.NET Core at `/images/meals/*`, avoiding a volume mount over the generated frontend assets in `wwwroot`.

## REST API

The API surface is:

```text
GET    /api/v1/meals
GET    /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
PUT    /api/v1/schedule/{date}
DELETE /api/v1/schedule/{date}
POST   /api/v1/schedule/move
GET    /api/health
```

Dates are parsed strictly as ISO `yyyy-MM-dd` values. Schedule range bounds are inclusive.

Mutation rules:

- Assigning to an empty date creates an assignment.
- Assigning to an occupied date replaces its meal.
- Moving to an empty date removes the source and creates the destination.
- Moving to an occupied date removes the source and replaces the destination.
- Moving a date onto itself succeeds as a no-op when the source exists.
- Removing an empty date is idempotent.

Move operations run inside a database transaction. A missing meal or missing move source returns `404`. Invalid input returns `400`. Unexpected conflicts return `409`, and server failures return `500`. Errors use ASP.NET Core Problem Details with a stable `code` extension where the client benefits from distinguishing cases.

The MVP uses last-write-wins behavior for concurrent household edits. It does not add row versions, placement IDs, or conflict dialogs.

## Frontend Structure

The frontend uses feature-oriented modules and plain TypeScript data:

```text
src/
├── app/
├── features/
│   └── meal-planner/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── model/
│       └── utils/
└── shared/
```

Primary responsibilities:

- `MealPlannerPage` owns the visible month and translates completed drag events into schedule mutations.
- `CalendarToolbar` provides previous month, today, and next month controls.
- `MonthCalendar` computes and renders a Sunday-first, six-week grid.
- `DaySlot` is a date drop target and displays its assigned meal.
- `MealDugout` is both the reusable meal collection and the removal drop target.
- `MealTile` renders the image, emoji fallback, and name with minimal business logic.
- `ConnectionStatus` reports offline, refreshing, mutation, and error states.
- `useMeals`, `useSchedule`, and schedule mutation hooks isolate REST and TanStack Query behavior.
- Pure drag-intent functions map drag source and destination data to assign, move, remove, or no-op operations.

No Redux, Zustand, application-wide domain context, or domain classes are introduced.

## Calendar and Drag Behavior

The calendar is Sunday-first and always displays six complete weeks. Days from adjacent months remain visible and are real drop targets. The schedule request covers the full displayed grid so every visible assignment is available.

Drag data distinguishes reusable dugout meals from scheduled occurrences:

```ts
type MealDragData =
  | { source: "dugout"; mealId: string }
  | { source: "calendar"; mealId: string; date: string };
```

Drop rules:

- Dugout meal to day: assign or replace the destination.
- Calendar meal to another day: move, replacing the destination.
- Calendar meal to dugout: remove the source assignment.
- Dugout meal to dugout or any invalid target: no change.

Replacing the destination is isolated in the schedule API and drag-intent mapping so a future swap, rejection, or confirmation rule does not require redesigning the components.

`dnd-kit` uses pointer/touch activation constraints to distinguish intentional drags from scrolling and a keyboard sensor for accessible operation. A drag overlay preserves visual feedback while a tile crosses layout boundaries. Touch targets are at least 44 CSS pixels, and no action depends on hover.

## Responsive Experience

On a landscape wall tablet, the month calendar occupies the main area and the dugout is a persistent side panel. Controls are deliberately large and sparse.

On phones, the toolbar and calendar use the full width, and the dugout becomes a horizontal tile strip beneath the calendar. Calendar typography and meal labels compact at narrow widths without horizontal page scrolling. Adjacent-month days remain visually subdued but usable.

Meal images fill the visual portion of each tile. A failed or missing image reveals the emoji fallback without leaving a broken-image indicator. Seeded meals remain attractive without external image dependencies through color treatments and large emoji.

## Server State and Synchronization

TanStack Query owns meals and schedule server state. It:

- Invalidates the active schedule after successful mutations.
- Refetches when the browser regains focus.
- Refetches when connectivity returns.
- Polls the visible range every 30 seconds while the application is active.

Mutations are disabled while offline. A failed mutation leaves server state authoritative, shows a concise error, and refetches the active range. The household accepts eventual consistency; the MVP does not use SignalR, WebSockets, or background sync queues.

## PWA Behavior

The Vite PWA integration provides a web app manifest, installable icons, an application-shell service worker, and offline loading of previously cached frontend assets. API responses are not treated as durable offline schedule storage.

Service-worker updates use a prompt. A newly installed worker waits while the calendar is in use, and an “Update available” control lets the user activate it and reload predictably. This avoids both permanently stale wall tablets and surprise reloads during a drag.

## Startup and Deployment

At startup, the backend:

1. Ensures the data directory exists.
2. Applies pending EF Core migrations.
3. Seeds the known meal definitions idempotently.
4. Serves mounted meal images when the image directory exists.
5. Maps API endpoints, static frontend files, and SPA fallback routing.

The final container runs as a non-root user and exposes one HTTP port. Compose mounts:

```text
/mnt/user/appdata/meal-calendar/data   -> /app/data
/mnt/user/appdata/meal-calendar/images -> /app/images
```

The documented update flow remains:

```bash
git pull --ff-only
docker compose up -d --build
```

## Testing

Backend integration tests use ASP.NET Core's test host and SQLite rather than EF Core's in-memory provider, preserving relational constraints and transaction behavior. They cover:

- Assigning a meal to an empty date.
- Replacing the meal on an occupied date.
- Moving to an empty date.
- Moving onto an occupied date and replacing it.
- Removing an assignment.
- Relevant validation and missing-source behavior.

Frontend tests cover:

- Month-grid date calculation.
- Drag-intent mapping for assign, move, remove, replacement destination, and no-op cases.
- Meal image fallback behavior.

Tests avoid brittle simulation of browser pointer geometry. The behavior that determines API operations is kept in pure functions, while backend integration tests prove persistence semantics end to end.

## Material Decisions

- A single-origin, single-container deployment is retained.
- The mounted image directory is separate from `wwwroot` so it cannot mask compiled frontend files.
- EF Core migrations are used instead of `EnsureCreated` to support later upgrades.
- Destination replacement is the explicit MVP rule.
- Sunday is the first day of the week.
- The full six-week grid is queried and droppable.
- SQLite and REST remain the only persistence and synchronization mechanisms.

