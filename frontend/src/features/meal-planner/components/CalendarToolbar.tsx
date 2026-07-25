interface CalendarToolbarProps {
  month: Date;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}

export function CalendarToolbar({
  month,
  onPrevious,
  onToday,
  onNext
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
    </header>
  );
}
