import { describe, expect, test } from "vitest";
import { resolveDragIntent } from "./dragIntent";

describe("resolveDragIntent", () => {
  test("assigns a dugout meal to a calendar day", () => {
    expect(
      resolveDragIntent(
        { source: "dugout", mealId: "tacos" },
        { target: "day", date: "2026-07-24" }
      )
    ).toEqual({ kind: "assign", date: "2026-07-24", mealId: "tacos" });
  });

  test("moves a scheduled meal to another calendar day", () => {
    expect(
      resolveDragIntent(
        { source: "calendar", mealId: "tacos", date: "2026-07-24" },
        { target: "day", date: "2026-07-25" }
      )
    ).toEqual({
      kind: "move",
      fromDate: "2026-07-24",
      toDate: "2026-07-25"
    });
  });

  test("removes a scheduled meal dropped on the dugout", () => {
    expect(
      resolveDragIntent(
        { source: "calendar", mealId: "tacos", date: "2026-07-24" },
        { target: "dugout" }
      )
    ).toEqual({ kind: "remove", date: "2026-07-24" });
  });

  test("does nothing when a scheduled meal is dropped on its current day", () => {
    expect(
      resolveDragIntent(
        { source: "calendar", mealId: "tacos", date: "2026-07-24" },
        { target: "day", date: "2026-07-24" }
      )
    ).toEqual({ kind: "none" });
  });

  test("does nothing when a dugout meal is dropped on the dugout", () => {
    expect(
      resolveDragIntent({ source: "dugout", mealId: "tacos" }, { target: "dugout" })
    ).toEqual({ kind: "none" });
  });

  test("does nothing when no drop target is present", () => {
    expect(resolveDragIntent({ source: "dugout", mealId: "tacos" }, undefined)).toEqual({
      kind: "none"
    });
  });
});
