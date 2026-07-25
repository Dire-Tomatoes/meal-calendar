import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useOnlineStatus } from "./useOnlineStatus";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}

describe("useOnlineStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reflects browser online and offline events and cleans them up", async () => {
    setNavigatorOnline(false);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);

    setNavigatorOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current).toBe(true));

    unmount();

    expect(removeListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
