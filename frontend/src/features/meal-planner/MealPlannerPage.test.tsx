import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  DropTargetData,
  MealDragData
} from "./model/types";
import { MealPlannerPage } from "./MealPlannerPage";

const dndBoundary = vi.hoisted(() => ({
  onDragEnd: undefined as ((event: unknown) => void) | undefined
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  const RealDndContext = actual.DndContext;

  return {
    ...actual,
    DndContext: (props: ComponentProps<typeof RealDndContext>) => {
      dndBoundary.onDragEnd = props.onDragEnd as
        | ((event: unknown) => void)
        | undefined;
      return <RealDndContext {...props} />;
    }
  };
});

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

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}

describe("MealPlannerPage", () => {
  const fetchMock = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
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

      if (
        path.startsWith("/api/v1/schedule/") ||
        path === "/api/v1/schedule/move"
      ) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.setSystemTime(new Date(2026, 6, 24, 12));
    setNavigatorOnline(true);
    dndBoundary.onDragEnd = undefined;
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

  test("restores compact density and allows returning to comfortable", async () => {
    const view = renderPage();
    await screen.findAllByText("Tacos");
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-density", "compact");
    expect(localStorage.getItem("meal-calendar-density")).toBe("compact");
    view.unmount();
    renderPage();
    await screen.findAllByText("Tacos");
    expect(screen.getByRole("button", { name: "Compact" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("main")).toHaveAttribute("data-density", "compact");
    fireEvent.click(screen.getByRole("button", { name: "Comfortable" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-density", "comfortable");
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  test("persists the selected week count and restores hidden dates", async () => {
    const view = renderPage();
    await screen.findAllByText("Tacos");
    fireEvent.click(screen.getByRole("button", { name: "4 weeks" }));
    expect(screen.getAllByRole("gridcell")).toHaveLength(28);
    expect(localStorage.getItem("meal-calendar-grid-weeks")).toBe("4");
    view.unmount();
    renderPage();
    await screen.findAllByText("Tacos");
    expect(screen.getAllByRole("gridcell")).toHaveLength(28);
    fireEvent.click(screen.getByRole("button", { name: "5 weeks" }));
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    fireEvent.click(screen.getByRole("button", { name: "6 weeks" }));
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  async function finishDrag(
    activeData: MealDragData,
    targetData: DropTargetData
  ) {
    const onDragEnd = dndBoundary.onDragEnd;
    if (!onDragEnd) {
      throw new Error("DndContext did not expose its drag completion boundary.");
    }

    await act(async () => {
      onDragEnd({
        active: { data: { current: activeData } },
        over: { data: { current: targetData } }
      });
    });
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

  test("assigns a dugout meal to a day through the page drag boundary", async () => {
    renderPage();
    await screen.findAllByText("Tacos");

    await finishDrag(
      { source: "dugout", mealId: "tacos" },
      { target: "day", date: "2026-07-25" }
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/schedule/2026-07-25",
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ mealId: "tacos" })
        }
      )
    );
  });

  test("moves a scheduled meal through the page drag boundary", async () => {
    renderPage();
    await screen.findAllByText("Tacos");

    await finishDrag(
      {
        source: "calendar",
        mealId: "tacos",
        date: "2026-07-24"
      },
      { target: "day", date: "2026-07-25" }
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/schedule/move", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fromDate: "2026-07-24",
          toDate: "2026-07-25"
        })
      })
    );
  });

  test("removes a scheduled meal dropped in the dugout through the page drag boundary", async () => {
    renderPage();
    await screen.findAllByText("Tacos");

    await finishDrag(
      {
        source: "calendar",
        mealId: "tacos",
        date: "2026-07-24"
      },
      { target: "dugout" }
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/schedule/2026-07-24",
        {
          method: "DELETE",
          headers: { Accept: "application/json" }
        }
      )
    );
  });

  test("suppresses page drag commands while offline", async () => {
    setNavigatorOnline(false);
    renderPage();
    await screen.findAllByText("Tacos");

    await finishDrag(
      { source: "dugout", mealId: "tacos" },
      { target: "day", date: "2026-07-25" }
    );

    expect(
      fetchMock.mock.calls.filter(
        ([path, options]) =>
          (path as string).startsWith("/api/v1/schedule") &&
          (options as RequestInit | undefined)?.method !== undefined
      )
    ).toHaveLength(0);
  });

  test("suppresses a second page drag completion while a mutation is pending", async () => {
    let resolveMutation!: (response: Response) => void;
    const pendingMutation = new Promise<Response>((resolve) => {
      resolveMutation = resolve;
    });
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/meals") {
        return jsonResponse(mealsFixture);
      }
      if (path.startsWith("/api/v1/schedule?")) {
        return jsonResponse(scheduleFixture);
      }
      if (path === "/api/v1/schedule/2026-07-25") {
        return pendingMutation;
      }
      if (path === "/api/v1/schedule/move") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findAllByText("Tacos");

    await finishDrag(
      { source: "dugout", mealId: "tacos" },
      { target: "day", date: "2026-07-25" }
    );
    await screen.findByText("Saving");

    await finishDrag(
      {
        source: "calendar",
        mealId: "tacos",
        date: "2026-07-24"
      },
      { target: "day", date: "2026-07-26" }
    );

    expect(
      fetchMock.mock.calls.filter(
        ([path, options]) =>
          (path as string).startsWith("/api/v1/schedule") &&
          (options as RequestInit | undefined)?.method !== undefined
      )
    ).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/schedule/move",
      expect.anything()
    );

    resolveMutation(new Response(null, { status: 204 }));
    await waitFor(() =>
      expect(screen.queryByText("Saving")).not.toBeInTheDocument()
    );
  });
});
