import { useDroppable } from "@dnd-kit/core";
import { fromDateKey } from "../model/calendar";
import type { DateKey, DropTargetData, Meal } from "../model/types";
import { DraggableMealTile } from "./DraggableMealTile";

interface DaySlotProps {
  date: DateKey;
  meal?: Meal;
  isCurrentMonth: boolean;
}

export function DaySlot({ date, meal, isCurrentMonth }: DaySlotProps) {
  const dropData = { target: "day", date } satisfies DropTargetData;
  const { isOver, setNodeRef } = useDroppable({
    id: `day:${date}`,
    data: dropData
  });
  const dayNumber = fromDateKey(date).getDate();

  return (
    <section
      ref={setNodeRef}
      aria-label={`Meal slot for ${date}`}
      data-over={isOver || undefined}
      data-adjacent-month={!isCurrentMonth || undefined}
    >
      <time dateTime={date}>{dayNumber}</time>
      {meal ? (
        <DraggableMealTile
          meal={meal}
          dragData={{ source: "calendar", mealId: meal.id, date }}
        />
      ) : null}
    </section>
  );
}
