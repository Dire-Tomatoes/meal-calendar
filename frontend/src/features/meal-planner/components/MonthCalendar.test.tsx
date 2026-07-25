import { DndContext } from "@dnd-kit/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MonthCalendar } from "./MonthCalendar";

afterEach(cleanup);

describe("MonthCalendar", () => {
  test("renders a column-header row followed by six rows of seven gridcells", () => {
    render(
      <DndContext>
        <MonthCalendar month={new Date(2026, 6, 1)} mealsByDate={{}} />
      </DndContext>
    );

    const grid = screen.getByRole("grid", { name: "Monthly meal schedule" });
    const rows = within(grid).getAllByRole("row");

    expect(rows).toHaveLength(7);
    expect(within(rows[0]).getAllByRole("columnheader")).toHaveLength(7);

    for (const week of rows.slice(1)) {
      expect(within(week).getAllByRole("gridcell")).toHaveLength(7);
    }
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
  });
});
