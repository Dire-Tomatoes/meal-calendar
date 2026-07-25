import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MealPlannerPage } from "./MealPlannerPage";

const mealsFixture = [
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
];

const scheduleFixture = {
  days: {
    "2026-07-24": "tacos"
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function serviceUnavailableResponse() {
  return jsonResponse(
    {
      type: "https://httpstatuses.com/503",
      title: "Service unavailable",
      status: 503,
      detail: "The meal calendar service is temporarily unavailable.",
      code: "service_unavailable"
    },
    503
  );
}

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
        return jsonResponse(mealsFixture);
      }

      if (path.startsWith("/api/v1/schedule?")) {
        return jsonResponse(scheduleFixture);
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

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MealPlannerPage />
      </QueryClientProvider>
    );
  }

  test("renders the current month with available and scheduled meals", async () => {
    renderPage();

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

  test("queries the exact Sunday-first range after next, previous, and today navigation", async () => {
    renderPage();
    await screen.findAllByText("Tacos");

    const lastScheduleRequest = () =>
      fetchMock.mock.calls
        .map(([path]) => path as string)
        .filter((path) => path.startsWith("/api/v1/schedule?"))
        .at(-1);

    expect(lastScheduleRequest()).toBe(
      "/api/v1/schedule?from=2026-06-28&to=2026-08-08"
    );

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByRole("heading", { name: "August 2026" });
    await waitFor(() =>
      expect(lastScheduleRequest()).toBe(
        "/api/v1/schedule?from=2026-07-26&to=2026-09-05"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await screen.findByRole("heading", { name: "July 2026" });
    await waitFor(() =>
      expect(lastScheduleRequest()).toBe(
        "/api/v1/schedule?from=2026-06-28&to=2026-08-08"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await screen.findByRole("heading", { name: "June 2026" });
    await waitFor(() =>
      expect(lastScheduleRequest()).toBe(
        "/api/v1/schedule?from=2026-05-31&to=2026-07-11"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await screen.findByRole("heading", { name: "July 2026" });
    await waitFor(() =>
      expect(lastScheduleRequest()).toBe(
        "/api/v1/schedule?from=2026-06-28&to=2026-08-08"
      )
    );
  });

  test("shows a fatal initial error and retries both query families", async () => {
    let mealsAttempts = 0;
    let scheduleAttempts = 0;
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/meals") {
        mealsAttempts += 1;
        return mealsAttempts === 1
          ? serviceUnavailableResponse()
          : jsonResponse(mealsFixture);
      }

      if (path.startsWith("/api/v1/schedule?")) {
        scheduleAttempts += 1;
        return jsonResponse(scheduleFixture);
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t load your meal calendar."
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByText("Tacos")).toHaveLength(2);
    expect(mealsAttempts).toBe(2);
    expect(scheduleAttempts).toBe(2);
    expect(
      screen.queryByRole("heading", {
        name: "We couldn’t load your meal calendar."
      })
    ).not.toBeInTheDocument();
  });

  test("keeps cached meals visible and reports a nonfatal background refresh failure", async () => {
    let scheduleAttempts = 0;
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/meals") {
        return jsonResponse(mealsFixture);
      }

      if (path.startsWith("/api/v1/schedule?")) {
        scheduleAttempts += 1;
        return scheduleAttempts === 1
          ? jsonResponse(scheduleFixture)
          : serviceUnavailableResponse();
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findAllByText("Tacos");

    await queryClient.invalidateQueries({ queryKey: ["schedule"] });

    expect(
      await screen.findByText("Couldn’t refresh. Showing saved meals.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "Monthly meal schedule" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Meal slot for 2026-07-24")
    ).toHaveTextContent("Tacos");
  });

  test("allows native panning on draggable meals while retaining touch drag sensors", async () => {
    renderPage();
    await screen.findAllByText("Tacos");

    expect(
      screen.getByLabelText("dugout meal: Tacos")
    ).toHaveAttribute("data-touch-pan", "both");
    expect(
      screen.getByLabelText("scheduled meal: Tacos")
    ).toHaveAttribute("data-touch-pan", "vertical");
  });
});
