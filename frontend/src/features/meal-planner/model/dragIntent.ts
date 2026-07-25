import type {
  DropTargetData,
  MealDragData,
  ScheduleCommand
} from "./types";

export function resolveDragIntent(
  dragData: MealDragData,
  dropTarget: DropTargetData | undefined
): ScheduleCommand {
  if (dropTarget === undefined) {
    return { kind: "none" };
  }

  switch (dragData.source) {
    case "dugout":
      return dropTarget.target === "day"
        ? { kind: "assign", date: dropTarget.date, mealId: dragData.mealId }
        : { kind: "none" };

    case "calendar":
      if (dropTarget.target === "dugout") {
        return { kind: "remove", date: dragData.date };
      }

      return dropTarget.date === dragData.date
        ? { kind: "none" }
        : { kind: "move", fromDate: dragData.date, toDate: dropTarget.date };

    default: {
      const exhaustiveSource: never = dragData;
      return exhaustiveSource;
    }
  }
}
