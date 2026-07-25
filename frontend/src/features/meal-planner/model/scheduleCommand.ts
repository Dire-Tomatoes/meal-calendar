import type { DateKey, MealId, ScheduleCommand } from "./types";

interface MutationAction<TVariables> {
  mutate: (variables: TVariables) => void;
  reset: () => void;
}

export interface ScheduleMutationActions {
  assign: MutationAction<{ date: DateKey; mealId: MealId }>;
  move: MutationAction<{ fromDate: DateKey; toDate: DateKey }>;
  remove: MutationAction<{ date: DateKey }>;
}

interface DispatchState {
  isOnline: boolean;
  isPending: boolean;
}

export function dispatchScheduleCommand(
  command: ScheduleCommand,
  state: DispatchState,
  actions: ScheduleMutationActions
): boolean {
  if (command.kind === "none" || !state.isOnline || state.isPending) {
    return false;
  }

  actions.assign.reset();
  actions.move.reset();
  actions.remove.reset();

  switch (command.kind) {
    case "assign":
      actions.assign.mutate({ date: command.date, mealId: command.mealId });
      break;
    case "move":
      actions.move.mutate({
        fromDate: command.fromDate,
        toDate: command.toDate
      });
      break;
    case "remove":
      actions.remove.mutate({ date: command.date });
      break;
  }

  return true;
}
