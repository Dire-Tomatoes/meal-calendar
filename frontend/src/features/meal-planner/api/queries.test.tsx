import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useMeals, useRecipeMutations, useSchedule, useScheduleMutations } from "./queries";

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

  test.each(mutationCases)(
    "refetches every cached schedule range after a failed $label",
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
          return new Response(
            JSON.stringify({
              title: "Schedule conflict",
              status: 409,
              detail: "The schedule changed while this request was being saved.",
              code: "schedule_conflict"
            }),
            { status: 409, headers: { "Content-Type": "application/problem+json" } }
          );
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

      await act(async () => {
        await expect(mutate(result.current.mutations)).rejects.toThrow(
          "The schedule changed while this request was being saved."
        );
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

  test.each([
    {
      label: "create",
      mutate: (mutations: ReturnType<typeof useRecipeMutations>) =>
        mutations.create.mutateAsync({
          name: "Pasta",
          emoji: "🍝",
          image: null,
          removeImage: false
        })
    },
    {
      label: "update",
      mutate: (mutations: ReturnType<typeof useRecipeMutations>) =>
        mutations.update.mutateAsync({
          id: "pasta",
          values: { name: "Pasta", emoji: "🍝", image: null, removeImage: false }
        })
    }
  ])("refetches meals after a successful recipe $label", async ({ mutate }) => {
    let mealRequests = 0;
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        mealRequests += 1;
        return new Response(
          JSON.stringify([
            {
              id: "pasta",
              name: mealRequests === 1 ? "Original pasta" : "Updated pasta",
              emoji: "🍝",
              imageUrl: null
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (
        (path === "/api/v1/meals" && options?.method === "POST") ||
        (path === "/api/v1/meals/pasta" && options?.method === "PUT")
      ) {
        return new Response(
          JSON.stringify({ id: "pasta", name: "Pasta", emoji: "🍝", imageUrl: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ meals: useMeals(), mutations: useRecipeMutations() }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Original pasta");
    });

    await act(async () => {
      await mutate(result.current.mutations);
    });

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Updated pasta");
    });
    expect(mealRequests).toBe(2);
  });

  test("refetches meals and schedules after deleting a recipe", async () => {
    let mealRequests = 0;
    let scheduleRequests = 0;
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        mealRequests += 1;
        return new Response(
          JSON.stringify([
            { id: "pasta", name: `Pasta ${mealRequests}`, emoji: "🍝", imageUrl: null }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path.startsWith("/api/v1/schedule?")) {
        scheduleRequests += 1;
        return new Response(
          JSON.stringify({ days: { "2026-07-24": `pasta-${scheduleRequests}` } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/api/v1/meals/pasta" && options?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        meals: useMeals(),
        schedule: useSchedule(primaryRange),
        mutations: useRecipeMutations()
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Pasta 1");
      expect(result.current.schedule.data?.days).toEqual({ "2026-07-24": "pasta-1" });
    });

    await act(async () => {
      await result.current.mutations.remove.mutateAsync("pasta");
    });

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Pasta 2");
      expect(result.current.schedule.data?.days).toEqual({ "2026-07-24": "pasta-2" });
    });
    expect(mealRequests).toBe(2);
    expect(scheduleRequests).toBe(2);
  });

  test("refetches meals after a failed recipe mutation", async () => {
    let mealRequests = 0;
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        mealRequests += 1;
        return new Response(
          JSON.stringify([
            {
              id: "pasta",
              name: mealRequests === 1 ? "Original pasta" : "Refetched pasta",
              emoji: "🍝",
              imageUrl: null
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/api/v1/meals" && options?.method === "POST") {
        return new Response(
          JSON.stringify({ title: "Invalid recipe", detail: "Name already exists" }),
          { status: 409, headers: { "Content-Type": "application/problem+json" } }
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ meals: useMeals(), mutations: useRecipeMutations() }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Original pasta");
    });

    await act(async () => {
      await expect(
        result.current.mutations.create.mutateAsync({
          name: "Pasta",
          emoji: "🍝",
          image: null,
          removeImage: false
        })
      ).rejects.toThrow("Name already exists");
    });

    await waitFor(() => {
      expect(result.current.meals.data?.[0]?.name).toBe("Refetched pasta");
    });
    expect(mealRequests).toBe(2);
  });
});
