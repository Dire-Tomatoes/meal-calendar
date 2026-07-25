import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ApiError,
  assignMeal,
  getMeals,
  getSchedule,
  moveMeal,
  removeMeal
} from "./client";

describe("meal planner API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test("loads meals from the meals collection endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "tacos", name: "Tacos", emoji: "🌮", imageUrl: null }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(getMeals()).resolves.toEqual([
      { id: "tacos", name: "Tacos", emoji: "🌮", imageUrl: null }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meals", {
      headers: { Accept: "application/json" }
    });
  });

  test("loads a schedule using its complete date range", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ days: { "2026-07-24": "tacos" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(
      getSchedule({ from: "2026-07-19", to: "2026-08-29" })
    ).resolves.toEqual({ days: { "2026-07-24": "tacos" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/schedule?from=2026-07-19&to=2026-08-29",
      { headers: { Accept: "application/json" } }
    );
  });

  test("assigns a meal with the encoded date and a JSON body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(assignMeal("2026-07-24", "tacos")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/schedule/2026-07-24", {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ mealId: "tacos" })
    });
  });

  test("moves a meal with the required source and destination fields", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(moveMeal("2026-07-24", "2026-07-25")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/schedule/move", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: "2026-07-24", toDate: "2026-07-25" })
    });
  });

  test("removes a schedule entry with its encoded date", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(removeMeal("2026-07-24")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/schedule/2026-07-24", {
      method: "DELETE",
      headers: { Accept: "application/json" }
    });
  });

  test("turns a Problem Details response into an API error", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://httpstatuses.com/404",
          title: "Meal not found",
          status: 404,
          detail: "The requested meal does not exist.",
          code: "meal_not_found"
        }),
        { status: 404, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const result = getMeals();

    await expect(result).rejects.toEqual(
      expect.objectContaining({
        status: 404,
        code: "meal_not_found",
        detail: "The requested meal does not exist."
      })
    );
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
