# Family Meal Calendar

Family Meal Calendar is a self-hosted, touch-friendly meal-planning PWA for a shared household display and phones. The MVP provides reusable meal tiles, a six-week calendar, and one meal assignment per date.

## Architecture

Production is intentionally one container and one origin:

- A Node 24 build stage runs the complete `npm run build` lifecycle. The repository's own scripts generate icons and a native service worker; there is no Workbox or `vite-plugin-pwa` dependency.
- A .NET 10 SDK stage publishes the ASP.NET Core API.
- A .NET 10 ASP.NET runtime stage serves the compiled React shell, `/api/*`, and optional meal images as the official non-root `app` user on port `8080`.
- EF Core stores SQLite data in persistent `/app/data`. Recipe uploads are stored in the writable persistent `/app/images` mount and exposed at `/images/meals`.

Keeping the PWA and REST API in one process avoids CORS, an extra proxy, and another runtime service. The service worker caches only versioned application-shell assets. API responses and meal images are network-only and always use the network; they are not durable offline data.

Repository map:

```text
backend/        ASP.NET Core minimal API, EF Core model, and migrations
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

The development defaults in `backend/appsettings.json` create `data/meal-calendar.db` relative to the backend process and look for images in `images/meals`. Startup creates the database directory and applies EF Core migrations. New databases start empty; manage recipes at `/recipes`.

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
/mnt/user/appdata/meal-calendar/images -> /app/images (writable)
```

Create both host directories before the first start. Both bind-mounted directories must be writable by the official .NET `app` user. Microsoft .NET images currently assign `app` UID/GID `1654`, but verify this when changing base-image versions:

```bash
mkdir -p /mnt/user/appdata/meal-calendar/data
mkdir -p /mnt/user/appdata/meal-calendar/images
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/data
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/images
docker run --rm mcr.microsoft.com/dotnet/aspnet:10.0-alpine id app
```

On first startup the API applies migrations and creates an empty `meal-calendar.db`. Manage recipes at `/recipes`. Follow progress with:

```bash
docker compose logs --follow meal-calendar
```

Raw `http://UNRAID-IP:8080` on the LAN is an online-only browser fallback, not a supported installed-PWA endpoint. Service workers and PWA installation require a secure browser context except on localhost, so a wall tablet or phone must use HTTPS. Tailscale Serve or an existing TLS-enabled reverse proxy can provide that secure endpoint without adding TLS or a second runtime service to this stack. Forward internally to port `8080`, keep the application at the origin root, and do not cache `/api/*`, `/sw.js`, or `/manifest.webmanifest` at the proxy. WebSockets and sticky sessions are not required. Never add a public router port-forward for this unauthenticated MVP or expose it directly to the public internet.

## Recipes, images, and emoji fallback

Open `/recipes` to create, edit, and delete recipes. The recipe form accepts an optional JPEG, PNG, or WebP image up to 10 MiB, and existing images can be replaced or removed there. Uploaded files are assigned managed filenames, written to `/app/images`, and served under `/images/meals/`. Deleting a recipe also removes its scheduled uses and managed image.

The calendar intentionally has no link to `/recipes`; enter that path directly when recipe administration is needed. Recipes can include notes, a source URL, tags, and a favorite marker. Admin search covers names, notes, and tags; the recipe shelf searches names and tags. Both offer favorites-only filtering, and admin cards offer quick favorite actions.

If a recipe has no image or image loading fails, its bundled emoji artwork is shown instead of a device-font glyph. Enter 1–3 supported emojis, with optional spaces; they share one normal icon-sized area. The editor has a compact artwork preview and only shows a validation message for invalid input. Unsupported legacy values or failed artwork requests use a drawn plate. Artwork is self-hosted from `@twemoji/svg` 15.0.0, with notices at `/emoji-notices.txt`; no runtime CDN is required.

The **Display** menu contains the browser-saved 4/5/6-week and Comfortable/Compact settings. On tablet-sized screens the searchable recipe shelf moves above the grid and scrolls horizontally. Mobile toolbar and compact shelf spacing adapt to narrow screens. The planner remains grid-only: no Agenda, Auto layout, day editor, suggestions, or calendar export are included.

Dragging a scheduled meal onto another occupied date swaps both assignments atomically. Dragging to an empty date still moves it. Dragging from the shelf still assigns/replaces the destination, because there is no source date to swap back to.

Back up the database before updating. Startup applies the recipe metadata migration and the metadata-only emoji length expansion to 64 UTF-16 units; existing SQLite data is preserved. Restart/rebuild an already-running backend after changing branches so it serves the promoted API behavior.

The 2026-08-28 promotion includes experiment features 1, 2, 3, 10, 14, 15, 16, and 17 only. Features 4–9 and 11–13 are abandoned, including Surprise me (6). Feature 10 excludes the abandoned day editor and its bottom-sheet layout. The experiment branches are historical references, not a list of features waiting for promotion.

## Backup and restore

Back up the database and images together. For a simple, consistent offline backup:

```bash
docker compose stop meal-calendar
cp -a /mnt/user/appdata/meal-calendar/data /mnt/user/backups/meal-calendar-data
cp -a /mnt/user/appdata/meal-calendar/images /mnt/user/backups/meal-calendar-images
docker compose start meal-calendar
```

Stopping the service ensures the SQLite database and any `-wal`/`-shm` sidecars are captured consistently. Store backups outside the appdata directories and include them in Unraid's regular backup schedule.

To restore, stop the service, move the current data and images directories aside, and copy the selected backup into the two configured paths. Restore writable ownership for both directories before starting the service:

```bash
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/data
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/images
```

Check `/api/health` and `/api/v1/meals` before discarding the moved-aside copy. Never overwrite a live SQLite database.

## Updates and PWA refresh

Update source and rebuild the same single service:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

The database volume and writable images mount survive image replacement. Startup applies new EF Core migrations automatically, so take a backup before updating.

Each frontend build creates a content-versioned native application-shell cache whose identity covers the ordered shell URLs, every precached file's bytes, and the service-worker template. An open client checks for a new service worker hourly while visible and whenever the document becomes visible again. When an update is ready it shows an **Update available** prompt. Choosing the update activates the waiting worker and reloads once under user control; dismissing it leaves the current shell running until a later visit or update check. This prompted flow avoids an unexpected reload during a drag while preventing permanently stale wall displays.

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

The data directory, database files, and images directory must be writable by the container's `app` UID/GID. Reapply the ownership described in the Unraid setup section. A bind mount hides the directory permissions baked into the image, so host permissions are authoritative.

### Offline clients

The shell is available offline only after one successful online load of that build. The API and meal images are deliberately not cached, and offline schedule changes are disabled rather than queued. Reconnect the client, verify `/api/health`, then reload or refocus the page to refetch the visible month. An update prompt cannot finish until the new shell has been downloaded.

## MVP limits

The MVP intentionally omits accounts and authorization, recipe instructions, ingredient lists, image resizing, grocery lists, notifications, recurring schedules, multiple meals per day, background sync, conflict dialogs, and real-time push updates. Household edits use last-write-wins semantics.

New databases start with no recipes. Add and manage them at `/recipes`; recipes that are edited or deleted do not reappear after restart.
