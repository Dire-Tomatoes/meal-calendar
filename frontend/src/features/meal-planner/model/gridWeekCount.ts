export type GridWeekCount = 4 | 5 | 6;

export function initialGridWeekCount(
  storedValue: string | null
): GridWeekCount {
  if (storedValue === "4" || storedValue === "5") {
    return Number(storedValue) as GridWeekCount;
  }
  return 6;
}
