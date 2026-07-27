# Change, Test, Build, and Deploy

This is the short workflow for changing Family Meal Calendar and deploying it to Unraid. Run commands from the repository root unless noted otherwise.

## Prerequisites

Install:

- Git
- .NET 10 SDK
- Node.js 24 with npm
- Docker Engine with Docker Compose v2

The application is one React frontend and ASP.NET Core API packaged into a single Docker image. SQLite data lives outside the container in `/app/data`.

## Make changes locally

Create a branch before editing:

```powershell
git switch -c codex/describe-the-change
```

Common source locations:

- `frontend/src/` — calendar UI, drag-and-drop behavior, API calls, and styles
- `frontend/scripts/` — icons and service-worker generation
- `backend/` — API endpoints, database model, migrations, and meal seed data
- `backend.tests/` — API integration tests
- `compose.yaml` — Unraid container configuration

Restore dependencies once:

```powershell
dotnet restore MealCalendar.sln
npm --prefix frontend ci
```

Run the backend in one terminal:

```powershell
dotnet run --project backend --urls http://localhost:5000
```

Run the frontend in another terminal:

```powershell
npm --prefix frontend run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` and `/images` to the backend on port `5000`.

## Test changes

Run both automated test suites:

```powershell
dotnet test MealCalendar.sln
npm --prefix frontend test
```

Run the production frontend build as a separate check:

```powershell
npm --prefix frontend run build
```

For UI changes, also check:

- A landscape tablet-sized browser window
- A phone-sized browser window
- Drag, touch, and keyboard meal movement
- Month navigation and meal removal
- The offline shell and update prompt when PWA behavior changes

## Build and smoke-test the Docker image

Build the same image used by Unraid:

```powershell
docker build --tag meal-calendar:mvp .
```

Run a disposable container:

```powershell
docker run --detach --name meal-calendar-smoke --publish 18080:8080 meal-calendar:mvp
Invoke-WebRequest http://127.0.0.1:18080/api/health
Invoke-WebRequest http://127.0.0.1:18080/api/v1/meals
Invoke-WebRequest http://127.0.0.1:18080/
docker stop meal-calendar-smoke
docker rm meal-calendar-smoke
```

All three requests should return HTTP 200. Removing the smoke container does not remove the built image.

## Deploy to Unraid

The checked-in `compose.yaml` expects these host directories:

```text
/mnt/user/appdata/meal-calendar/data
/mnt/user/appdata/meal-calendar/images
```

Create them and set permissions before the first deployment:

```bash
mkdir -p /mnt/user/appdata/meal-calendar/data
mkdir -p /mnt/user/appdata/meal-calendar/images
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/data
chown -R 1654:1654 /mnt/user/appdata/meal-calendar/images
```

UID/GID `1654` is the `app` user in the current .NET Alpine runtime image. Recheck it after changing that base image:

```bash
docker run --rm mcr.microsoft.com/dotnet/aspnet:10.0-alpine id app
```

Copy or clone the repository onto Unraid, open a terminal in its root, and start the service:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
docker compose logs --tail 100 meal-calendar
```

For later deployments, first make a cold backup:

```bash
docker compose stop meal-calendar
cp -a /mnt/user/appdata/meal-calendar/data /mnt/user/backups/meal-calendar-data
cp -a /mnt/user/appdata/meal-calendar/images /mnt/user/backups/meal-calendar-images
docker compose start meal-calendar
```

Then update and rebuild:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

The bind-mounted database and images survive image replacement. Startup applies database migrations automatically.

The `/app/images` mount is writable so the application can persist recipe uploads. Manage recipes and their optional images at `/recipes`; do not edit SQLite `ImagePath` values manually.

## Final checks

- Use HTTPS through Tailscale Serve or an existing TLS reverse proxy for installation as a PWA.
- Do not expose this unauthenticated application directly to the public internet.
- Do not let a reverse proxy cache `/api/*`, `/sw.js`, or `/manifest.webmanifest`.
- Confirm the browser receives an update prompt after deploying a changed frontend.
- Check `docker compose logs meal-calendar` if the health check fails.

More detail about backups, image files, PWA updates, and troubleshooting is in `README.md`.
