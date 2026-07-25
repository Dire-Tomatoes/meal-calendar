import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSchedule, useScheduleMutations } from "./queries";

describe("meal planner query hooks", () => {
  const fetchMock = vi.fn();
  const primaryRange = { from: "2026-07-19", to: "2026-08-29" };
  const secondaryRange = { from: "2026-08-30", to: "2026-10-10" };
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

  const mutationCases = [
    {
      label: "assignment",
      mutate: (mutations: ReturnType<typeof useScheduleMutations>) =>
        mutations.assign.mutateAsync({ date: "2026-07-24", mealId: "pasta" })
    },
    {
      label: "move",
      mutate: (mutations: ReturnType<typeof useScheduleMutations>) =>
        mutations.move.mutateAsync({ fromDate: "2026-07-24", toDate: "2026-07-25" })
    },
    {
      label: "removal",
      mutate: (mutations: ReturnType<typeof useScheduleMutations>) =>
        mutations.remove.mutateAsync({ date: "2026-07-24" })
    }
  ];

  test.each(mutationCases)(
    "refetches every cached schedule range after a successful $label",
    async ({ mutate }) => {
      const scheduleRequestCounts = new Map<string, number>();
      fetchMock.mockImplementation(async (path: string) => {
        if (path.startsWith("/api/v1/schedule?")) {
          const requestCount = (scheduleRequestCounts.get(path) ?? 0) + 1;
          scheduleRequestCounts.set(path, requestCount);
          const date = path.includes("from=2026-07-19") ? "2026-07-24" : "2026-09-01";
          return new Response(
            JSON.stringify({
              days: { [date]: requestCount === 1 ? "tacos" : "pasta" }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (
          path === "/api/v1/schedule/2026-07-24" ||
          path === "/api/v1/schedule/move"
        ) {
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected request: ${path}`);
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => ({
          primarySchedule: useSchedule(primaryRange),
          secondarySchedule: useSchedule(secondaryRange),
          mutations: useScheduleMutations()
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.primarySchedule.data?.days).toEqual({ "2026-07-24": "tacos" });
        expect(result.current.secondarySchedule.data?.days).toEqual({ "2026-09-01": "tacos" });
      });
      const scheduleQuery = queryClient.getQueryCache().find({
        queryKey: ["schedule", primaryRange.from, primaryRange.to]
      });
      expect(scheduleQuery?.options).toMatchObject({
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true
      });

      await act(async () => {
        await mutate(result.current.mutations);
      });

      await waitFor(() => {
        expect(result.current.primarySchedule.data?.days).toEqual({ "2026-07-24": "pasta" });
        expect(result.current.secondarySchedule.data?.days).toEqual({ "2026-09-01": "pasta" });
      });
      expect(scheduleRequestCounts).toEqual(
        new Map([
          ["/api/v1/schedule?from=2026-07-19&to=2026-08-29", 2],
          ["/api/v1/schedule?from=2026-08-30&to=2026-10-10", 2]
        ])
      );
    }
  );
});
