import { useDraggable } from "@dnd-kit/core";
import type { Meal, MealDragData } from "../model/types";
import { MealTile } from "./MealTile";

interface DraggableMealTileProps {
  meal: Meal;
  dragData: MealDragData;
}

export function DraggableMealTile({ meal, dragData }: DraggableMealTileProps) {
  const id =
    dragData.source === "dugout"
      ? `dugout:${dragData.mealId}`
      : `calendar:${dragData.date}`;
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: dragData
  });

  return (
    <MealTile
      meal={meal}
      variant={dragData.source === "dugout" ? "dugout" : "scheduled"}
      setNodeRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      transform={transform}
      isDragging={isDragging}
    />
  );
}
