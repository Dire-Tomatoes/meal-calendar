import { useState, type FormEvent } from "react";
import { useMeals, useRecipeMutations } from "../meal-planner/api/queries";
import type { RecipeFormValues } from "../meal-planner/api/client";
import type { Meal, MealId } from "../meal-planner/model/types";

type EditorState = {
  id: MealId | null;
  name: string;
  emoji: string;
  image: File | null;
  removeImage: boolean;
};

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  emoji: "",
  image: null,
  removeImage: false
});

function valuesFrom(editor: EditorState): RecipeFormValues {
  return {
    name: editor.name,
    emoji: editor.emoji,
    image: editor.image,
    removeImage: editor.removeImage
  };
}

function mealEditor(meal: Meal): EditorState {
  return {
    id: meal.id,
    name: meal.name,
    emoji: meal.emoji,
    image: null,
    removeImage: false
  };
}

export function RecipeManagementPage() {
  const mealsQuery = useMeals();
  const mutations = useRecipeMutations();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const meals = mealsQuery.data ?? [];
  const hasCachedMeals = mealsQuery.data !== undefined;
  const isPending =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.remove.isPending;
  const editedMeal = editor.id
    ? meals.find((meal) => meal.id === editor.id) ?? null
    : null;
  const isEditing = editor.id !== null;

  const clearImageInput = () => setImageInputKey((current) => current + 1);

  const resetEditor = () => {
    clearImageInput();
    setEditor(emptyEditor());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
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
            <label htmlFor="recipe-emoji">
              Emoji
              <input
                id="recipe-emoji"
                required
                disabled={isPending}
                maxLength={16}
                value={editor.emoji}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, emoji: event.target.value }))
                }
              />
            </label>
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
              <button type="submit" disabled={isPending}>
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
          {mealsQuery.isPending ? <p role="status">Loading recipes</p> : null}
          {mealsQuery.isError && !hasCachedMeals ? (
            <p role="alert">Couldn’t load recipes. Please try again.</p>
          ) : null}
          {mealsQuery.isError && hasCachedMeals ? (
            <p role="alert">Couldn’t refresh recipes. Showing saved recipes.</p>
          ) : null}
          <div className="recipe-list" aria-live="polite">
            {meals.map((meal) => (
              <article className="recipe-card" key={meal.id}>
                {meal.imageUrl ? (
                  <img src={meal.imageUrl} alt={`Image of ${meal.name}`} />
                ) : (
                  <span className="recipe-card-emoji" aria-hidden="true">
                    {meal.emoji}
                  </span>
                )}
                <div>
                  <h3>{meal.name}</h3>
                  <p>{meal.emoji}</p>
                </div>
                <div className="recipe-card-actions">
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
        </section>
      </div>
    </main>
  );
}
