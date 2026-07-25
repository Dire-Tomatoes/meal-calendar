import { useDroppable } from "@dnd-kit/core";
import type { Meal } from "../model/types";
import { DraggableMealTile } from "./DraggableMealTile";

interface MealDugoutProps {
  meals: Meal[];
}

export function MealDugout({ meals }: MealDugoutProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: "dugout",
    data: { target: "dugout" }
  });

  return (
    <aside ref={setNodeRef} aria-label="Meal dugout" data-over={isOver || undefined}>
      <h2>Meal dugout</h2>
      <div className="dugout-list">
        {meals.map((meal) => (
          <DraggableMealTile
            key={meal.id}
            meal={meal}
            dragData={{ source: "dugout", mealId: meal.id }}
          />
        ))}
      </div>
    </aside>
  );
}
