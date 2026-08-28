import { useMemo, useState, type FormEvent } from "react";
import { useMeals, useRecipeMutations } from "../meal-planner/api/queries";
import type { RecipeFormValues } from "../meal-planner/api/client";
import type { Meal, MealId } from "../meal-planner/model/types";
import { RecipeEmoji, emojiArtworks } from "../../components/RecipeEmoji";

type EditorState = {
  id: MealId | null;
  name: string;
  emoji: string;
  image: File | null;
  removeImage: boolean;
  notes: string;
  sourceUrl: string;
  tags: string;
  isFavorite: boolean;
};

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  emoji: "",
  image: null,
  removeImage: false,
  notes: "",
  sourceUrl: "",
  tags: "",
  isFavorite: false
});

function valuesFrom(editor: EditorState): RecipeFormValues {
  return {
    name: editor.name,
    emoji: editor.emoji.trim(),
    image: editor.image,
    removeImage: editor.removeImage,
    notes: editor.notes,
    sourceUrl: editor.sourceUrl,
    tags: editor.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    isFavorite: editor.isFavorite
  };
}

function mealEditor(meal: Meal): EditorState {
  return {
    id: meal.id,
    name: meal.name,
    emoji: meal.emoji,
    image: null,
    removeImage: false,
    notes: meal.notes ?? "",
    sourceUrl: meal.sourceUrl ?? "",
    tags: (meal.tags ?? []).join(", "),
    isFavorite: meal.isFavorite ?? false
  };
}

export function RecipeManagementPage() {
  const mealsQuery = useMeals();
  const mutations = useRecipeMutations();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const meals = mealsQuery.data ?? [];
  const visibleMeals = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return meals.filter((meal) => {
      if (favoritesOnly && !meal.isFavorite) return false;
      if (!needle) return true;
      return [meal.name, meal.notes ?? "", ...(meal.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [favoritesOnly, meals, search]);
  const hasCachedMeals = mealsQuery.data !== undefined;
  const isPending =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.remove.isPending;
  const editedMeal = editor.id
    ? meals.find((meal) => meal.id === editor.id) ?? null
    : null;
  const isEditing = editor.id !== null;
  const hasEmojiArtwork = emojiArtworks(editor.emoji) !== null;

  const clearImageInput = () => setImageInputKey((current) => current + 1);

  const resetEditor = () => {
    clearImageInput();
    setEditor(emptyEditor());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || !hasEmojiArtwork) {
      return;
    }

    setMutationError(null);
    setMutationSuccess(null);
    try {
      if (editor.id) {
        await mutations.update.mutateAsync({
          id: editor.id,
          values: valuesFrom(editor)
        });
        setMutationSuccess("Recipe updated.");
      } else {
        await mutations.create.mutateAsync(valuesFrom(editor));
        setMutationSuccess("Recipe added.");
      }
      resetEditor();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Couldn’t save recipe.");
    }
  };

  const handleDelete = async (meal: Meal) => {
    if (isPending) {
      return;
    }
    const shouldDelete = window.confirm(
      `Delete ${meal.name}? This also removes its scheduled calendar entries.`
    );
    if (!shouldDelete) {
      return;
    }

    setMutationError(null);
    setMutationSuccess(null);
    try {
      await mutations.remove.mutateAsync(meal.id);
      if (editor.id === meal.id) {
        resetEditor();
      }
      setMutationSuccess("Recipe deleted.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Couldn’t delete recipe.");
    }
  };

  const handleFavoriteToggle = async (meal: Meal) => {
    if (isPending) return;
    setMutationError(null);
    setMutationSuccess(null);
    try {
      await mutations.update.mutateAsync({
        id: meal.id,
        values: {
          name: meal.name,
          emoji: meal.emoji,
          image: null,
          removeImage: false,
          notes: meal.notes ?? "",
          sourceUrl: meal.sourceUrl ?? "",
          tags: meal.tags ?? [],
          isFavorite: !meal.isFavorite
        }
      });
      setMutationSuccess(meal.isFavorite
        ? "Recipe removed from favorites."
        : "Recipe added to favorites.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Couldn’t update favorite.");
    }
  };

  const submitLabel = isEditing
    ? mutations.update.isPending
      ? "Saving recipe"
      : "Save recipe"
    : mutations.create.isPending
      ? "Adding recipe"
      : "Add recipe";

  return (
    <main className="recipe-management" aria-busy={isPending || undefined}>
      <header>
        <h1>Recipe management</h1>
        <p>Create and update the recipes available in your meal calendar.</p>
      </header>

      <div className="recipe-management-layout">
        <section className="recipe-form-panel" aria-labelledby="recipe-editor-heading">
          <h2 id="recipe-editor-heading">
            {isEditing ? `Edit ${editedMeal?.name ?? "recipe"}` : "Add a recipe"}
          </h2>
          <form className="recipe-form" onSubmit={handleSubmit}>
            <label htmlFor="recipe-name">
              Recipe name
              <input
                id="recipe-name"
                required
                disabled={isPending}
                maxLength={120}
                value={editor.name}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label htmlFor="recipe-tags">
              Tags
              <input
                id="recipe-tags"
                disabled={isPending}
                maxLength={309}
                placeholder="quick, vegetarian, freezer"
                value={editor.tags}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
            <label htmlFor="recipe-source">
              Source URL
              <input
                id="recipe-source"
                type="url"
                disabled={isPending}
                maxLength={500}
                placeholder="https://example.com/recipe"
                value={editor.sourceUrl}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, sourceUrl: event.target.value }))
                }
              />
            </label>
            <label htmlFor="recipe-notes">
              Notes
              <textarea
                id="recipe-notes"
                disabled={isPending}
                maxLength={2000}
                rows={4}
                value={editor.notes}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            <label className="recipe-checkbox" htmlFor="recipe-favorite">
              <input
                id="recipe-favorite"
                type="checkbox"
                disabled={isPending}
                checked={editor.isFavorite}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, isFavorite: event.target.checked }))
                }
              />
              Favorite recipe
            </label>
            <label htmlFor="recipe-emoji">
              Emoji
              <span className="recipe-emoji-field">
              <input
                id="recipe-emoji"
                aria-describedby={editor.emoji && !hasEmojiArtwork ? "emoji-error" : undefined}
                aria-invalid={editor.emoji && !hasEmojiArtwork ? true : undefined}
                required
                disabled={isPending}
                maxLength={64}
                value={editor.emoji}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, emoji: event.target.value }))
                }
              />
              {hasEmojiArtwork ? <RecipeEmoji emoji={editor.emoji} /> : null}
              </span>
            </label>
            {editor.emoji && !hasEmojiArtwork ? (
              <small id="emoji-error" role="alert">Choose 1–3 supported emojis.</small>
            ) : null}
            <label htmlFor="recipe-image">
              Image
              <input
                id="recipe-image"
                key={imageInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isPending}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    image: event.target.files?.[0] ?? null,
                    removeImage: false
                  }))
                }
              />
            </label>
            {isEditing && editedMeal?.imageUrl ? (
              <label className="recipe-checkbox" htmlFor="remove-recipe-image">
                <input
                  id="remove-recipe-image"
                  type="checkbox"
                  disabled={isPending}
                  checked={editor.removeImage}
                  onChange={(event) => {
                    if (event.target.checked) {
                      clearImageInput();
                    }
                    setEditor((current) => ({
                      ...current,
                      image: null,
                      removeImage: event.target.checked
                    }));
                  }}
                />
                Remove current image
              </label>
            ) : null}
            {editedMeal?.imageUrl && !editor.removeImage ? (
              <img
                className="recipe-image-preview"
                src={editedMeal.imageUrl}
                alt={`Current image for ${editedMeal.name}`}
              />
            ) : null}
            <div className="recipe-form-actions">
              <button type="submit" disabled={isPending || !hasEmojiArtwork}>
                {submitLabel}
              </button>
              {isEditing ? (
                <button
                  className="recipe-form-cancel"
                  type="button"
                  disabled={isPending}
                  onClick={resetEditor}
                >
                  Cancel editing
                </button>
              ) : null}
            </div>
          </form>
          {mutationError ? <p role="alert">{mutationError}</p> : null}
          {mutationSuccess ? <p role="status">{mutationSuccess}</p> : null}
        </section>

        <section className="recipe-list-panel" aria-labelledby="recipe-list-heading">
          <h2 id="recipe-list-heading">Your recipes</h2>
          <div className="recipe-filters">
            <label htmlFor="recipe-search">
              Search recipes
              <input
                id="recipe-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="recipe-checkbox" htmlFor="favorite-filter">
              <input
                id="favorite-filter"
                type="checkbox"
                checked={favoritesOnly}
                onChange={(event) => setFavoritesOnly(event.target.checked)}
              />
              Favorites only
            </label>
          </div>
          {mealsQuery.isPending ? <p role="status">Loading recipes</p> : null}
          {mealsQuery.isError && !hasCachedMeals ? (
            <p role="alert">Couldn’t load recipes. Please try again.</p>
          ) : null}
          {mealsQuery.isError && hasCachedMeals ? (
            <p role="alert">Couldn’t refresh recipes. Showing saved recipes.</p>
          ) : null}
          <div className="recipe-list" aria-live="polite">
            {visibleMeals.map((meal) => (
              <article className="recipe-card" key={meal.id}>
                {meal.imageUrl ? (
                  <img src={meal.imageUrl} alt={`Image of ${meal.name}`} />
                ) : (
                  <span className="recipe-card-emoji" aria-hidden="true">
                    <RecipeEmoji emoji={meal.emoji} />
                  </span>
                )}
                <div>
                  <h3>{meal.name}</h3>
                  <p><RecipeEmoji emoji={meal.emoji} />{meal.isFavorite ? " ★" : ""}</p>
                  {(meal.tags ?? []).length > 0 ? (
                    <ul className="recipe-tags" aria-label={`Tags for ${meal.name}`}>
                      {(meal.tags ?? []).map((tag) => <li key={tag}>{tag}</li>)}
                    </ul>
                  ) : null}
                  {meal.notes ? <p className="recipe-notes">{meal.notes}</p> : null}
                  {meal.sourceUrl ? (
                    <a href={meal.sourceUrl} target="_blank" rel="noreferrer">
                      Open recipe source
                    </a>
                  ) : null}
                </div>
                <div className="recipe-card-actions">
                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={meal.isFavorite ?? false}
                    onClick={() => void handleFavoriteToggle(meal)}
                  >
                    {meal.isFavorite
                      ? `Remove ${meal.name} from favorites`
                      : `Add ${meal.name} to favorites`}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setMutationError(null);
                      setMutationSuccess(null);
                      clearImageInput();
                      setEditor(mealEditor(meal));
                    }}
                  >
                    Edit {meal.name}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void handleDelete(meal)}
                  >
                    Delete {meal.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!mealsQuery.isPending && hasCachedMeals && meals.length === 0 ? (
            <p>No recipes yet. Add your first one above.</p>
          ) : null}
          {!mealsQuery.isPending && meals.length > 0 && visibleMeals.length === 0 ? (
            <p>No recipes match these filters.</p>
          ) : null}
        </section>
      </div>
      <footer><small><a href="/emoji-notices.txt">Emoji artwork credits</a></small></footer>
    </main>
  );
}
