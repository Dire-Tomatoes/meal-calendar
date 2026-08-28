import { describe, expect, test } from "vitest";
import { initialGridWeekCount } from "./gridWeekCount";

describe("initialGridWeekCount", () => {
  test("restores each supported week count", () => {
    expect(initialGridWeekCount("4")).toBe(4);
    expect(initialGridWeekCount("5")).toBe(5);
    expect(initialGridWeekCount("6")).toBe(6);
  });

  test("defaults missing and unsupported values to six weeks", () => {
    expect(initialGridWeekCount(null)).toBe(6);
    expect(initialGridWeekCount("3")).toBe(6);
    expect(initialGridWeekCount("full")).toBe(6);
  });
});
