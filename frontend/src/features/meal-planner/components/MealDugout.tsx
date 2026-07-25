import { useDroppable } from "@dnd-kit/core";
import type { DropTargetData, Meal } from "../model/types";
import { DraggableMealTile } from "./DraggableMealTile";

interface MealDugoutProps {
  meals: Meal[];
}

export function MealDugout({ meals }: MealDugoutProps) {
  const dropData = { target: "dugout" } satisfies DropTargetData;
  const { isOver, setNodeRef } = useDroppable({
    id: "dugout",
    data: dropData
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
