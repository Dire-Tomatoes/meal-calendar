import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ApiError,
  assignMeal,
  createRecipe,
  deleteRecipe,
  getMeals,
  getSchedule,
  moveMeal,
  removeMeal,
  updateRecipe
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

  test("creates a recipe with multipart form fields and no JSON content type", async () => {
    const image = new File(["recipe image"], "tacos.png", { type: "image/png" });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: "tacos", name: "Tacos", emoji: "🌮", imageUrl: "/images/tacos.png" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(
      createRecipe({ name: "Tacos", emoji: "🌮", image, removeImage: false })
    ).resolves.toEqual({
      id: "tacos",
      name: "Tacos",
      emoji: "🌮",
      imageUrl: "/images/tacos.png"
    });

    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/meals");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.body).toBeInstanceOf(FormData);
    const form = options.body as FormData;
    expect(form.get("name")).toBe("Tacos");
    expect(form.get("emoji")).toBe("🌮");
    expect(form.get("removeImage")).toBe("false");
    expect(form.get("image")).toBe(image);
  });

  test("updates a recipe at its encoded ID with multipart form fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: "family tacos", name: "Family Tacos", emoji: "🌮", imageUrl: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await updateRecipe("family tacos", {
      name: "Family Tacos",
      emoji: "🌮",
      image: null,
      removeImage: true
    });

    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/meals/family%20tacos");
    expect(options.method).toBe("PUT");
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.body).toBeInstanceOf(FormData);
    const form = options.body as FormData;
    expect(form.get("name")).toBe("Family Tacos");
    expect(form.get("emoji")).toBe("🌮");
    expect(form.get("removeImage")).toBe("true");
    expect(form.get("image")).toBeNull();
  });

  test("deletes a recipe at its encoded ID", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteRecipe("family tacos")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meals/family%20tacos", {
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
