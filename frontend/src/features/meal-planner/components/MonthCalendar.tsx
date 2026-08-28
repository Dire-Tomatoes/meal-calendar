import { fromDateKey, getMonthGrid } from "../model/calendar";
import type { GridWeekCount } from "../model/gridWeekCount";
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
  weekCount?: GridWeekCount;
  today?: Date;
  mealsByDate: Partial<Record<DateKey, Meal>>;
}

export function MonthCalendar({ month, mealsByDate, weekCount = 6, today = new Date() }: MonthCalendarProps) {
  const days = getMonthGrid(month, weekCount, today);
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) =>
    days.slice(weekIndex * 7, weekIndex * 7 + 7)
  );

  return (
    <section aria-label="Meal calendar">
      <div role="grid" aria-label="Monthly meal schedule">
        <div role="row" className="weekday-row">
          {weekdays.map((weekday) => (
            <div key={weekday} role="columnheader">
              {weekday}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="calendar-week">
            {week.map((date) => {
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
        ))}
      </div>
    </section>
  );
}
