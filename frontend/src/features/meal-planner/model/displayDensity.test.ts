import { describe, expect, test } from "vitest";
import { initialDisplayDensity } from "./displayDensity";

describe("initialDisplayDensity", () => {
  test("uses valid stored preferences", () => {
    expect(initialDisplayDensity("comfortable")).toBe("comfortable");
    expect(initialDisplayDensity("compact")).toBe("compact");
  });

  test("defaults missing and unknown preferences to comfortable", () => {
    expect(initialDisplayDensity(null)).toBe("comfortable");
    expect(initialDisplayDensity("dense")).toBe("comfortable");
  });
});
