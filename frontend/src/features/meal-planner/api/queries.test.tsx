import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSchedule, useScheduleMutations } from "./queries";

describe("meal planner query hooks", () => {
  const fetchMock = vi.fn();
  const range = { from: "2026-07-19", to: "2026-08-29" };
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    queryClient.clear();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test("refreshes the active schedule after a successful assignment", async () => {
    let scheduleRequestCount = 0;
    fetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/schedule?")) {
        scheduleRequestCount += 1;
        return new Response(
          JSON.stringify({
            days:
              scheduleRequestCount === 1
                ? { "2026-07-24": "tacos" }
                : { "2026-07-24": "pasta" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (path === "/api/v1/schedule/2026-07-24") {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ schedule: useSchedule(range), mutations: useScheduleMutations() }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.schedule.data).toEqual({ "2026-07-24": "tacos" });
    });
    const scheduleQuery = queryClient.getQueryCache().find({
      queryKey: ["schedule", range.from, range.to]
    });
    expect(scheduleQuery?.options).toMatchObject({
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    });

    await act(async () => {
      await result.current.mutations.assign.mutateAsync({
        date: "2026-07-24",
        mealId: "pasta"
      });
    });

    await waitFor(() => {
      expect(result.current.schedule.data).toEqual({ "2026-07-24": "pasta" });
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/schedule/2026-07-24", {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ mealId: "pasta" })
    });
  });
});
