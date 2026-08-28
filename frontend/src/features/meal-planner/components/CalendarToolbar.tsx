import type { GridWeekCount } from "../model/gridWeekCount";

interface CalendarToolbarProps {
  gridWeekCount: GridWeekCount;
  onGridWeekCountChange: (count: GridWeekCount) => void;
  month: Date;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}

export function CalendarToolbar({
  month,
  onPrevious,
  onToday,
  onNext,
  gridWeekCount,
  onGridWeekCountChange
}: CalendarToolbarProps) {
  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  return (
    <header>
      <button type="button" onClick={onPrevious} aria-label="Previous month">
        Previous
      </button>
      <h1>{monthLabel}</h1>
      <button type="button" onClick={onToday}>
        Today
      </button>
      <button type="button" onClick={onNext} aria-label="Next month">
        Next
      </button>
      <div className="week-count-switch" role="group" aria-label="Grid weeks">
        {([4, 5, 6] as const).map((count) => (
          <button key={count} type="button"
            aria-pressed={gridWeekCount === count}
            onClick={() => onGridWeekCountChange(count)}>
            {count} weeks
          </button>
        ))}
      </div>
    </header>
  );
}
