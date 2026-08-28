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
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(options.body === undefined || isFormData ? {} : { "Content-Type": "application/json" }),
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
  const response = await request<Schedule>(
    `/api/v1/schedule?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
  );

  return response ?? { days: {} };
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

export interface RecipeFormValues {
  name: string;
  emoji: string;
  image: File | null;
  removeImage: boolean;
  notes?: string;
  sourceUrl?: string;
  tags?: string[];
  isFavorite?: boolean;
}

function recipeFormData(values: RecipeFormValues): FormData {
  const form = new FormData();
  form.append("name", values.name);
  form.append("emoji", values.emoji);
  form.append("removeImage", String(values.removeImage));
  form.append("notes", values.notes ?? "");
  form.append("sourceUrl", values.sourceUrl ?? "");
  form.append("tags", (values.tags ?? []).join(","));
  form.append("isFavorite", String(values.isFavorite ?? false));
  if (values.image !== null) {
    form.append("image", values.image);
  }
  return form;
}

export async function createRecipe(values: RecipeFormValues): Promise<Meal> {
  return (await request<Meal>("/api/v1/meals", {
    method: "POST",
    body: recipeFormData(values)
  })) as Meal;
}

export async function updateRecipe(id: MealId, values: RecipeFormValues): Promise<Meal> {
  return (await request<Meal>(`/api/v1/meals/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: recipeFormData(values)
  })) as Meal;
}

export function deleteRecipe(id: MealId): Promise<undefined> {
  return request<never>(`/api/v1/meals/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}
