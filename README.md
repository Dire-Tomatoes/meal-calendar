# Family Meal Calendar

Family Meal Calendar is a self-hosted, touch-friendly meal-planning PWA for a shared household display and phones. The MVP provides reusable meal tiles, a six-week calendar, and one meal assignment per date.

## Architecture

Production is intentionally one container and one origin:

- A Node 24 build stage runs the complete `npm run build` lifecycle. The repository's own scripts generate icons and a native service worker; there is no Workbox or `vite-plugin-pwa` dependency.
- A .NET 10 SDK stage publishes the ASP.NET Core API.
- A .NET 10 ASP.NET runtime stage serves the compiled React shell, `/api/*`, and optional meal images as the official non-root `app` user on port `8080`.
- EF Core stores SQLite data in persistent `/app/data`. An optional read-only `/app/images` mount is exposed at `/images/meals`.

Keeping the PWA and REST API in one process avoids CORS, an extra proxy, and another runtime service. The service worker caches only versioned application-shell assets. API responses and meal images are network-only and always use the network; they are not durable offline data.

Repository map:

```text
backend/        ASP.NET Core minimal API, EF Core model, migrations, and seed data
backend.tests/  SQLite-backed API integration tests
frontend/       React, TypeScript, Vite, tests, native PWA assets and build scripts
Dockerfile      Multi-stage production image
compose.yaml    Unraid-oriented runtime configuration
```

## Prerequisites

Local development requires the .NET 10 SDK, Node.js 24 with npm, and Git. Container workflows require a running Docker Engine with the Docker Compose v2 plugin. The committed `frontend/package-lock.json` is the reproducible frontend dependency contract.

## Backend development

From the repository root:

```powershell
dotnet restore MealCalendar.sln
dotnet run --project backend --urls http://localhost:5000
```

The development defaults in `backend/appsettings.json` create `data/meal-calendar.db` relative to the backend process and look for images in `images/meals`. Startup creates the database directory, applies EF Core migrations, and seeds known meals.

Run all backend integration tests with:

```powershell
dotnet test MealCalendar.sln
```

## Frontend development

Install exactly the locked dependencies and start Vite:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

Vite serves the development UI and proxies `/api` and `/images` to `http://localhost:5000`, so run the backend at that address in another terminal.

Run the frontend tests and production build with:

```powershell
npm --prefix frontend test
npm --prefix frontend run build
```

The build command deliberately runs npm's full lifecycle: `prebuild` generates icons, `build` compiles TypeScript and Vite assets, and `postbuild` generates `dist/sw.js` from the native service-worker template.

## Docker

Build the production image:

```powershell
docker build --tag meal-calendar:mvp .
```

The checked-in Compose file uses Unraid host paths. It also drops every Linux capability and enables `no-new-privileges`; the non-root process needs only ordinary file access to the mounted data directory. On an Unraid host, start or update it from this repository with:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

For a disposable image-only smoke run with container-managed storage:

```powershell
docker run --detach --name meal-calendar-smoke --publish 18080:8080 meal-calendar:mvp
Invoke-WebRequest http://127.0.0.1:18080/api/health
Invoke-WebRequest http://127.0.0.1:18080/api/v1/meals
Invoke-WebRequest http://127.0.0.1:18080/
docker stop meal-calendar-smoke
docker rm meal-calendar-smoke
```

Only the named smoke container is removed; the built image remains available.

## Unraid setup

The Compose configuration maps:

```text
/mnt/user/appdata/meal-calendar/data   -> /app/data
/mnt/user/appdata/meal-calendar/images -> /app/images (read-only)
```

Create both host directories before the first start. The bind-mounted data directory must be writable by the official .NET `app` user; the images directory only needs to be readable. Microsoft .NET images currently assign `app` UID/GID `1654`, but verify this when changing base-image versions:

```bash
mkdir -p /mnt/user/appdata/meal-calendar/data
mkdir -p /mnt/user/appdata/meal-calendar/images
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/data
chmod -R a+rX /mnt/user/appdata/meal-calendar/images
docker run --rm mcr.microsoft.com/dotnet/aspnet:10.0-alpine id app
```

On first startup the API applies migrations, creates `meal-calendar.db`, and seeds the meal definitions. Follow progress with:

```bash
docker compose logs --follow meal-calendar
```

Raw `http://UNRAID-IP:8080` on the LAN is an online-only browser fallback, not a supported installed-PWA endpoint. Service workers and PWA installation require a secure browser context except on localhost, so a wall tablet or phone must use HTTPS. Tailscale Serve or an existing TLS-enabled reverse proxy can provide that secure endpoint without adding TLS or a second runtime service to this stack. Forward internally to port `8080`, keep the application at the origin root, and do not cache `/api/*`, `/sw.js`, or `/manifest.webmanifest` at the proxy. WebSockets and sticky sessions are not required. Never add a public router port-forward for this unauthenticated MVP or expose it directly to the public internet.

## Meal images and emoji fallback

Files placed in the Unraid images directory are served under `/images/meals/`. A meal displays an image only when its database `ImagePath` contains that filename. For example, an `ImagePath` of `tacos.webp` maps to:

```text
/mnt/user/appdata/meal-calendar/images/tacos.webp
https://your-meal-calendar.example/images/meals/tacos.webp
```

The MVP has no meal editor or image-management API. Back up the database, stop the service, and use a SQLite administration tool to set a meal's `ImagePath` if custom images are needed; startup seeding preserves that field. Use a single filename rather than a nested path. If `ImagePath` is empty, the file is absent, or image loading fails, the tile automatically shows its seeded emoji.

## Backup and restore

Back up the database and images together. For a simple, consistent offline backup:

```bash
docker compose stop meal-calendar
cp -a /mnt/user/appdata/meal-calendar/data /mnt/user/backups/meal-calendar-data
cp -a /mnt/user/appdata/meal-calendar/images /mnt/user/backups/meal-calendar-images
docker compose start meal-calendar
```

Stopping the service ensures the SQLite database and any `-wal`/`-shm` sidecars are captured consistently. Store backups outside the appdata directories and include them in Unraid's regular backup schedule.

To restore, stop the service, move the current data and images directories aside, copy the selected backup into the two configured paths, restore data ownership and image read permissions, then start the service. Check `/api/health` and `/api/v1/meals` before discarding the moved-aside copy. Never overwrite a live SQLite database.

## Updates and PWA refresh

Update source and rebuild the same single service:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

The database volume and read-only images mount survive image replacement. Startup applies new EF Core migrations automatically, so take a backup before updating.

Each frontend build creates a content-versioned native application-shell cache. An open client downloads a new service worker in the background and shows an **Update available** prompt. Choosing the update activates the waiting worker and reloads once under user control; dismissing it leaves the current shell running until a later visit or update check. This prompted flow avoids an unexpected reload during a drag while preventing permanently stale wall displays.

## Troubleshooting

### Stale frontend assets

Confirm the container was rebuilt, `/api/health` is healthy, and a reverse proxy is not caching `/sw.js` or the manifest. Leave the client online long enough to see the update prompt, accept it, and reload. If a browser remains stuck after the server is verified, close all app tabs, clear site data or unregister that site's service worker, and revisit over HTTPS. Clearing site data also removes the cached offline shell.

### Database or mount permissions

If startup reports `SQLite Error 14`, `attempt to write a readonly database`, or the container is unhealthy, inspect:

```bash
docker compose logs meal-calendar
ls -ldn /mnt/user/appdata/meal-calendar/data
ls -ln /mnt/user/appdata/meal-calendar/data
```

The data directory and database files must be writable by the container's `app` UID/GID. Reapply the ownership described in the Unraid setup section. A bind mount hides the directory permissions baked into the image, so host permissions are authoritative. Images may stay read-only but must be readable and searchable by `app`.

### Offline clients

The shell is available offline only after one successful online load of that build. The API and meal images are deliberately not cached, and offline schedule changes are disabled rather than queued. Reconnect the client, verify `/api/health`, then reload or refocus the page to refetch the visible month. An update prompt cannot finish until the new shell has been downloaded.

## MVP limits and seeded meals

The MVP intentionally omits accounts and authorization, meal/recipe editing, grocery lists, notifications, recurring schedules, multiple meals per day, background sync, conflict dialogs, and real-time push updates. Household edits use last-write-wins semantics.

Meal definitions are currently hard-coded in `backend/Data/MealSeed.cs`. Startup inserts missing definitions and refreshes their names and emoji without deleting schedules or overwriting `ImagePath`. Changing the available meals therefore requires a source change and a rebuilt image; there is no supported in-app editor yet.
