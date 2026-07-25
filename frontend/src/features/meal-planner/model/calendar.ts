import type { DateKey, DateRange } from "./types";

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function toDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: DateKey): Date {
  if (!dateKeyPattern.test(dateKey)) {
    throw new RangeError(`Invalid date key: ${dateKey}`);
  }

  const [yearPart, monthPart, dayPart] = dateKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new RangeError(`Invalid date key: ${dateKey}`);
  }

  return date;
}

export function getMonthGrid(month: Date): DateKey[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstGridDay = 1 - firstOfMonth.getDay();

  return Array.from({ length: 42 }, (_, offset) =>
    toDateKey(new Date(year, monthIndex, firstGridDay + offset))
  );
}

export function getGridRange(month: Date): DateRange {
  const grid = getMonthGrid(month);

  return { from: grid[0], to: grid[grid.length - 1] };
}
