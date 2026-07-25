import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MealPlannerPage } from "./MealPlannerPage";

describe("MealPlannerPage", () => {
  const fetchMock = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/meals") {
        return new Response(
          JSON.stringify([
            {
              id: "tacos",
              name: "Tacos",
              emoji: "🌮",
              imageUrl: null
            },
            {
              id: "pasta",
              name: "Pasta Primavera",
              emoji: "🍝",
              imageUrl: "/images/pasta.jpg"
            }
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (path.startsWith("/api/v1/schedule?")) {
        return new Response(
          JSON.stringify({
            days: {
              "2026-07-24": "tacos"
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.setSystemTime(new Date(2026, 6, 24, 12));
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    fetchMock.mockReset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("renders the current month with available and scheduled meals", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MealPlannerPage />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("heading", { name: "July 2026" })
    ).toBeInTheDocument();
    expect(await screen.findAllByText("Tacos")).toHaveLength(2);
    expect(screen.getByText("Pasta Primavera")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Meal slot for 2026-07-24")
    ).toHaveTextContent("Tacos");
    expect(
      screen.getByLabelText("Meal slot for 2026-07-24")
    ).toHaveAttribute("data-today", "true");
    expect(
      screen.getByRole("button", { name: "Previous month" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next month" })
    ).toBeInTheDocument();
  });
});
