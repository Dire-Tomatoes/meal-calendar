import type { DateKey, DateRange } from "./types";
import type { GridWeekCount } from "./gridWeekCount";

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

export function getMonthGrid(month: Date, weekCount: GridWeekCount = 6, today?: Date): DateKey[] {
  const isCurrentMonth = today !== undefined &&
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const anchor = isCurrentMonth ? today : new Date(month.getFullYear(), month.getMonth(), 1);
  const priorWeeks = isCurrentMonth ? Math.floor((weekCount - 1) / 2) : 0;
  const firstGridDay = anchor.getDate() - anchor.getDay() - priorWeeks * 7;

  return Array.from({ length: weekCount * 7 }, (_, offset) =>
    toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), firstGridDay + offset))
  );
}

export function getGridRange(month: Date, weekCount: GridWeekCount = 6, today?: Date): DateRange {
  const grid = getMonthGrid(month, weekCount, today);

  return { from: grid[0], to: grid[grid.length - 1] };
}
