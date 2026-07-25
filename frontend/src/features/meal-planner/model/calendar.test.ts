import { describe, expect, test } from "vitest";
import { fromDateKey, getGridRange, getMonthGrid, toDateKey } from "./calendar";

describe("calendar utilities", () => {
  test("builds a six-week Sunday-first grid for July 2026", () => {
    const grid = getMonthGrid(new Date(2026, 6, 1));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-06-28");
    expect(grid.at(-1)).toBe("2026-08-08");
  });

  test("advances every grid position by one local calendar day", () => {
    const grid = getMonthGrid(new Date(2026, 6, 1));

    for (let index = 1; index < grid.length; index += 1) {
      const previous = fromDateKey(grid[index - 1]);
      const current = fromDateKey(grid[index]);

      expect(
        toDateKey(
          new Date(
            previous.getFullYear(),
            previous.getMonth(),
            previous.getDate() + 1
          )
        )
      ).toBe(toDateKey(current));
    }
  });

  test("includes February 29 in a leap-year grid", () => {
    expect(getMonthGrid(new Date(2028, 1, 1))).toContain("2028-02-29");
  });

  test("returns the full displayed range for July 2026", () => {
    expect(getGridRange(new Date(2026, 6, 1))).toEqual({
      from: "2026-06-28",
      to: "2026-08-08"
    });
  });
});
