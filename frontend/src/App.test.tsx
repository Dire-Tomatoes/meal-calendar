import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("App routes", () => {
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
        return jsonResponse([]);
      }
      if (path.startsWith("/api/v1/schedule?")) {
        return jsonResponse({ days: {} });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  test("renders recipe management at /recipes instead of the calendar", async () => {
    window.history.replaceState({}, "", "/recipes");

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("heading", { name: "Recipe management" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("grid", { name: "Monthly meal schedule" })
    ).not.toBeInTheDocument();
  });

  test("renders the calendar at the root without a recipes link", async () => {
    window.history.replaceState({}, "", "/");

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("grid", { name: "Monthly meal schedule" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /recipe/i })).not.toBeInTheDocument();
  });
});
