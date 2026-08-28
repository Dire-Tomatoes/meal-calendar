import type { GridWeekCount } from "../model/gridWeekCount";
import type { DisplayDensity } from "../model/displayDensity";

interface CalendarToolbarProps {
  density: DisplayDensity;
  onDensityChange: (density: DisplayDensity) => void;
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
  onGridWeekCountChange,
  density,
  onDensityChange
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
      <details className="display-options">
        <summary>Display</summary>
        <div className="display-controls">
        <div className="week-count-switch" role="group" aria-label="Grid weeks">
          {([4, 5, 6] as const).map((count) => (
            <button key={count} type="button"
              aria-pressed={gridWeekCount === count}
              onClick={() => onGridWeekCountChange(count)}>
              {count} weeks
            </button>
          ))}
        </div>
        <div className="density-switch" role="group" aria-label="Display density">
          <button type="button" aria-pressed={density === "comfortable"}
            onClick={() => onDensityChange("comfortable")}>
            Comfortable
          </button>
          <button type="button" aria-pressed={density === "compact"}
            onClick={() => onDensityChange("compact")}>
            Compact
          </button>
        </div>
        </div>
      </details>
    </header>
  );
}
