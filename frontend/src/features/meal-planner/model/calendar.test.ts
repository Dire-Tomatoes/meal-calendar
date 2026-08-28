import { describe, expect, test } from "vitest";
import { fromDateKey, getGridRange, getMonthGrid, toDateKey } from "./calendar";

describe("calendar utilities", () => {
  test.each([
    [4, "2026-08-16", "2026-09-12"],
    [5, "2026-08-09", "2026-09-12"],
    [6, "2026-08-09", "2026-09-19"]
  ] as const)("centers %i weeks on today rather than the first of the month", (weeks, from, to) => {
    const today = new Date(2026, 7, 28, 12);
    const grid = getMonthGrid(new Date(2026, 7, 1), weeks, today);
    expect(grid).toHaveLength(weeks * 7);
    expect(grid).toContain("2026-08-28");
    expect(grid[0]).toBe(from);
    expect(grid.at(-1)).toBe(to);
    expect(getGridRange(new Date(2026, 7, 1), weeks, today)).toEqual({ from, to });
  });

  test("rolling weeks cross the year boundary", () => {
    expect(getGridRange(new Date(2027, 0, 1), 4, new Date(2027, 0, 1))).toEqual({
      from: "2026-12-20", to: "2027-01-16"
    });
  });

  test("browsing another month starts with that month's first week", () => {
    expect(getGridRange(new Date(2026, 8, 1), 4, new Date(2026, 7, 31))).toEqual({
      from: "2026-08-30", to: "2026-09-26"
    });
  });
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

  test("rejects date keys that do not use the ISO calendar format", () => {
    expect(() => fromDateKey("2026/07/24")).toThrow(RangeError);
  });

  test("rejects date keys that normalize to a different calendar date", () => {
    expect(() => fromDateKey("2026-02-30")).toThrow(RangeError);
  });
});
