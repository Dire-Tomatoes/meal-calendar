import { useDroppable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import type { DropTargetData, Meal } from "../model/types";
import { DraggableMealTile } from "./DraggableMealTile";

interface MealDugoutProps {
  meals: Meal[];
}

export function MealDugout({ meals }: MealDugoutProps) {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const visibleMeals = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return meals.filter((meal) => {
      if (favoritesOnly && !meal.isFavorite) return false;
      return !needle || [meal.name, ...(meal.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [favoritesOnly, meals, search]);
  const dropData = { target: "dugout" } satisfies DropTargetData;
  const { isOver, setNodeRef } = useDroppable({
    id: "dugout",
    data: dropData
  });

  return (
    <aside ref={setNodeRef} aria-label="Meal dugout" data-over={isOver || undefined}>
      <h2>Meal dugout</h2>
      <div className="dugout-filters">
        <label htmlFor="dugout-search">
          <span>Search available recipes</span>
          <input
            id="dugout-search"
            type="search"
            placeholder="Search recipes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="dugout-favorite-filter" htmlFor="dugout-favorites">
          <input
            id="dugout-favorites"
            type="checkbox"
            checked={favoritesOnly}
            onChange={(event) => setFavoritesOnly(event.target.checked)}
          />
          Show favorites only
        </label>
      </div>
      <div className="dugout-list">
        {visibleMeals.map((meal) => (
          <DraggableMealTile
            key={meal.id}
            meal={meal}
            dragData={{ source: "dugout", mealId: meal.id }}
          />
        ))}
        {visibleMeals.length === 0 ? <p>No matching recipes.</p> : null}
      </div>
    </aside>
  );
}
