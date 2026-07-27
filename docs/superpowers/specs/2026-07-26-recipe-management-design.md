# Recipe Management and Stable Status Design

## Goal

Prevent loading and saving messages from shifting the meal calendar, and add an unlinked `/recipes` page for complete recipe management with image uploads.

## Scope

The change includes:

- A fixed-height status region on the meal-planning page.
- A recipe-management page at `/recipes` with no navigation link from the calendar.
- Recipe create, edit, delete, image upload, image replacement, and image removal.
- Cascading deletion of schedule entries that reference a deleted recipe.
- Removal of runtime recipe pre-seeding.
- A writable image mount and updated Unraid operating instructions.

The change does not add authentication, recipe instructions, ingredient lists, image resizing, or a general-purpose routing library.

## Frontend Architecture

`App.tsx` selects the page from `window.location.pathname`:

- `/recipes` renders `RecipeManagementPage`.
- Every other path renders the existing `MealPlannerPage`, preserving the API fallback behavior.

This keeps routing dependency-free while the application has only two fixed pages.

The recipe page contains:

- A create form for name, emoji, and an optional image file.
- A list of existing recipes.
- An edit action that reuses the same field structure.
- Controls to replace or remove an existing image.
- A delete action with explicit confirmation that scheduled uses will also be removed.
- Visible loading, success, validation, and server-error states.

TanStack Query remains the server-state layer. Recipe mutations invalidate the shared `["meals"]` query so both pages receive current data.

## Stable Calendar Status

`ConnectionStatus` always renders a status container with a fixed one-line height beneath the calendar toolbar. When idle, the container remains in the layout but has no announced message. Loading, saving, refreshing, offline, and error messages replace the container content without inserting or removing layout height.

The container uses an appropriate live region so assistive technology still announces meaningful state changes.

## API Design

Existing `GET /api/v1/meals` remains unchanged.

New endpoints:

- `POST /api/v1/meals` creates a recipe from multipart form data.
- `PUT /api/v1/meals/{id}` edits a recipe from multipart form data.
- `DELETE /api/v1/meals/{id}` deletes the recipe and its scheduled uses.

Create and update accept:

- `name`: required, trimmed, maximum 120 characters.
- `emoji`: required, trimmed, maximum 16 characters.
- `image`: optional uploaded image.
- `removeImage`: optional boolean for updates.

The server generates a stable opaque recipe ID. Missing recipes return Problem Details with HTTP 404. Invalid fields or uploads return Problem Details with HTTP 400.

## Image Storage

Image persistence is isolated behind a focused service with operations to save and delete managed recipe images. This boundary accepts the uploaded file and returns the stored filename, allowing later resizing, transcoding, or metadata extraction without changing API contracts.

Initial upload rules:

- Accept JPEG, PNG, and WebP.
- Limit files to 10 MiB.
- Generate filenames rather than trusting the client filename.
- Store managed files with a recognizable prefix and safe extension.
- Delete only managed filenames; manually supplied legacy image filenames are never removed automatically.

Database changes and file changes are coordinated conservatively:

- A failed database create/update removes any newly written replacement file.
- A successful replacement or image removal deletes the previous managed file afterward.
- Recipe deletion commits the database cascade before deleting its managed file.
- A file-cleanup failure is logged without rolling back an already committed database change.

## Persistence and Seeding

The `ScheduleDay` foreign key changes from restrictive deletion to cascading deletion. Deleting a recipe therefore removes every schedule row referencing it in the same database transaction.

Runtime recipe seeding is removed from application startup. Existing databases keep their current recipe rows. New databases begin with no recipes and are populated through `/recipes`. Deleted or edited recipes do not reappear on restart.

## Container and Unraid Changes

The application image continues to create `/app/images` and run as the non-root `app` user.

The Compose image mount changes from read-only to writable:

```text
/mnt/user/appdata/meal-calendar/images -> /app/images
```

Unraid setup instructions require both the data and image directories to be writable by the container `app` UID/GID. Backups continue to capture the database and images together while the service is stopped.

## Error Handling

- Form validation remains visible next to the management form.
- Failed mutations leave the current recipe list visible and allow retry.
- An upload failure does not create or update a recipe.
- A database failure does not leave a newly uploaded file behind.
- Concurrent edits use the API's final committed value; successful mutations refetch the recipe list.
- Calendar queries are invalidated after recipe deletion so cascaded schedule removals appear promptly.

## Testing

Backend integration tests cover:

- Creating a recipe without an image.
- Creating a recipe with a valid image.
- Rejecting invalid fields, content types, and oversized images.
- Editing recipe fields.
- Replacing and removing managed images.
- Cascading schedule deletion.
- Returning 404 for missing recipes.
- Avoiding startup re-seeding.

Frontend tests cover:

- `/recipes` route selection without a visible calendar link.
- Creating, editing, and deleting recipes.
- Image selection and removal.
- Error and pending states.
- Meal-query invalidation after mutations.
- A permanently rendered status container whose loading and saving states do not alter its layout role.

Full backend tests, frontend tests, the production frontend build, and the Docker image build must pass before completion.
