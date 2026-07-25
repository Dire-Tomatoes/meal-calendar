import { describe, expect, test, vi } from "vitest";
import type { ScheduleCommand } from "./types";
import {
  dispatchScheduleCommand,
  type ScheduleMutationActions
} from "./scheduleCommand";

function createActions(): ScheduleMutationActions {
  return {
    assign: { mutate: vi.fn(), reset: vi.fn() },
    move: { mutate: vi.fn(), reset: vi.fn() },
    remove: { mutate: vi.fn(), reset: vi.fn() }
  };
}

const commandCases: Array<{
  label: string;
  command: ScheduleCommand;
  action: keyof ScheduleMutationActions;
  variables: object;
}> = [
  {
    label: "assign",
    command: { kind: "assign", date: "2026-07-24", mealId: "tacos" },
    action: "assign",
    variables: { date: "2026-07-24", mealId: "tacos" }
  },
  {
    label: "move",
    command: {
      kind: "move",
      fromDate: "2026-07-24",
      toDate: "2026-07-25"
    },
    action: "move",
    variables: { fromDate: "2026-07-24", toDate: "2026-07-25" }
  },
  {
    label: "remove",
    command: { kind: "remove", date: "2026-07-24" },
    action: "remove",
    variables: { date: "2026-07-24" }
  }
];

describe("dispatchScheduleCommand", () => {
  test.each(commandCases)(
    "clears every stale mutation error before dispatching an exact $label command",
    ({ command, action, variables }) => {
      const actions = createActions();

      const dispatched = dispatchScheduleCommand(
        command,
        { isOnline: true, isPending: false },
        actions
      );

      expect(dispatched).toBe(true);
      expect(actions.assign.reset).toHaveBeenCalledOnce();
      expect(actions.move.reset).toHaveBeenCalledOnce();
      expect(actions.remove.reset).toHaveBeenCalledOnce();
      expect(actions[action].mutate).toHaveBeenCalledWith(variables);

      for (const [name, mutation] of Object.entries(actions)) {
        if (name !== action) {
          expect(mutation.mutate).not.toHaveBeenCalled();
        }
      }
    }
  );

  test.each([
    { label: "offline", isOnline: false, isPending: false },
    { label: "pending", isOnline: true, isPending: true }
  ])("suppresses commands while $label", ({ isOnline, isPending }) => {
    const actions = createActions();

    const dispatched = dispatchScheduleCommand(
      { kind: "assign", date: "2026-07-24", mealId: "tacos" },
      { isOnline, isPending },
      actions
    );

    expect(dispatched).toBe(false);
    for (const mutation of Object.values(actions)) {
      expect(mutation.reset).not.toHaveBeenCalled();
      expect(mutation.mutate).not.toHaveBeenCalled();
    }
  });
});
