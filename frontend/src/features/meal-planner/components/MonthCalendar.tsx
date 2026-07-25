import { fromDateKey, getMonthGrid } from "../model/calendar";
import type { DateKey, Meal } from "../model/types";
import { DaySlot } from "./DaySlot";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

interface MonthCalendarProps {
  month: Date;
  mealsByDate: Partial<Record<DateKey, Meal>>;
}

export function MonthCalendar({ month, mealsByDate }: MonthCalendarProps) {
  const days = getMonthGrid(month);

  return (
    <section aria-label="Meal calendar">
      <div role="row">
        {weekdays.map((weekday) => (
          <div key={weekday} role="columnheader">
            {weekday}
          </div>
        ))}
      </div>
      <div role="grid" aria-label="Monthly meal schedule">
        {days.map((date) => {
          const day = fromDateKey(date);
          const isCurrentMonth =
            day.getFullYear() === month.getFullYear() &&
            day.getMonth() === month.getMonth();

          return (
            <DaySlot
              key={date}
              date={date}
              meal={mealsByDate[date]}
              isCurrentMonth={isCurrentMonth}
            />
          );
        })}
      </div>
    </section>
  );
}
