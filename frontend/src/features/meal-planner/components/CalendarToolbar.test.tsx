import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CalendarToolbar } from "./CalendarToolbar";

afterEach(cleanup);

test("Display starts collapsed and exposes only promoted settings", () => {
  const changeWeeks = vi.fn();
  const changeDensity = vi.fn();
  render(<CalendarToolbar month={new Date(2026, 7, 1)} onPrevious={() => {}}
    onToday={() => {}} onNext={() => {}} gridWeekCount={6}
    onGridWeekCountChange={changeWeeks} density="comfortable" onDensityChange={changeDensity} />);
  expect(screen.getByText("Display", { exact: true }).closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Display", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "4 weeks" }));
  fireEvent.click(screen.getByRole("button", { name: "Compact" }));
  expect(changeWeeks).toHaveBeenCalledWith(4);
  expect(changeDensity).toHaveBeenCalledWith("compact");
  expect(screen.queryByRole("button", { name: /Agenda|Auto|Hide recipes|Show recipes/ })).toBeNull();
  expect(screen.queryByRole("link", { name: "Export month" })).toBeNull();
});
