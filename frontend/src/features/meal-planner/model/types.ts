export type DateKey = string;
export type MealId = string;

export interface Meal {
  id: MealId;
  name: string;
  emoji: string;
  imageUrl: string | null;
}

export interface Schedule {
  days: Record<DateKey, MealId>;
}

export interface DateRange {
  from: DateKey;
  to: DateKey;
}

export type MealDragData =
  | { source: "dugout"; mealId: MealId }
  | { source: "calendar"; mealId: MealId; date: DateKey };

export type DropTargetData =
  | { target: "day"; date: DateKey }
  | { target: "dugout" };

export type ScheduleCommand =
  | { kind: "assign"; date: DateKey; mealId: MealId }
  | { kind: "move"; fromDate: DateKey; toDate: DateKey }
  | { kind: "remove"; date: DateKey }
  | { kind: "none" };
