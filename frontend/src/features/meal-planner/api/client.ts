import type { DateKey, DateRange, Meal, MealId, Schedule } from "../model/types";

interface ProblemDetails {
  code?: unknown;
  detail?: unknown;
  title?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

async function readProblemDetails(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T | undefined> {
  const headers = {
    Accept: "application/json",
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...options.headers
  };
  const response = await fetch(path, { ...options, headers });

  if (!response.ok) {
    const problem = await readProblemDetails(response);
    const detail =
      typeof problem.detail === "string"
        ? problem.detail
        : typeof problem.title === "string"
          ? problem.title
          : `Request failed with status ${response.status}`;
    const code = typeof problem.code === "string" ? problem.code : "request_failed";

    throw new ApiError(response.status, code, detail);
  }

  if (response.status === 204) {
    return undefined;
  }

  return (await response.json()) as T;
}

export async function getMeals(): Promise<Meal[]> {
  return (await request<Meal[]>("/api/v1/meals")) ?? [];
}

export async function getSchedule(range: DateRange): Promise<Schedule> {
  const response = await request<{ days: Schedule }>(
    `/api/v1/schedule?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
  );

  return response?.days ?? {};
}

export function assignMeal(date: DateKey, mealId: MealId): Promise<undefined> {
  return request<never>(`/api/v1/schedule/${encodeURIComponent(date)}`, {
    method: "PUT",
    body: JSON.stringify({ mealId })
  });
}

export function moveMeal(fromDate: DateKey, toDate: DateKey): Promise<undefined> {
  return request<never>("/api/v1/schedule/move", {
    method: "POST",
    body: JSON.stringify({ fromDate, toDate })
  });
}

export function removeMeal(date: DateKey): Promise<undefined> {
  return request<never>(`/api/v1/schedule/${encodeURIComponent(date)}`, {
    method: "DELETE"
  });
}
