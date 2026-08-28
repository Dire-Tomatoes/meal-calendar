export type DisplayDensity = "comfortable" | "compact";

export function initialDisplayDensity(storedValue: string | null): DisplayDensity {
  return storedValue === "compact" ? "compact" : "comfortable";
}
