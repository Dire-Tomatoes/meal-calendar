import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UpdatePrompt } from "../components/UpdatePrompt";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "readyState"
);
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState"
);

class TestWorker extends EventTarget {
  state: ServiceWorkerState;
  postMessage = vi.fn();

  constructor(state: ServiceWorkerState = "installed") {
    super();
    this.state = state;
  }

  setState(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

type ServiceWorkerHarness = {
  container: ServiceWorkerContainer;
  registration: ServiceWorkerRegistration;
  register: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  waitingWorker: TestWorker | null;
  setInstalling: (worker: TestWorker) => void;
};

function makeServiceWorkerHarness({
  waiting = true,
  controlled = true,
  installing = null
}: {
  waiting?: boolean;
  controlled?: boolean;
  installing?: TestWorker | null;
} = {}): ServiceWorkerHarness {
  const waitingWorker = waiting ? new TestWorker() : null;
  const registrationTarget = new EventTarget();
  const update = vi.fn().mockResolvedValue(undefined);
  const registration = Object.assign(registrationTarget, {
    installing,
    waiting: waitingWorker,
    update
  }) as unknown as ServiceWorkerRegistration;
  const register = vi.fn().mockResolvedValue(registration);
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? new TestWorker("activated") : null,
    register
  }) as unknown as ServiceWorkerContainer;

  return {
    container,
    registration,
    register,
    update,
    waitingWorker,
    setInstalling(worker) {
      Object.defineProperty(registration, "installing", {
        configurable: true,
        value: worker
      });
    }
  };
}

function finishPageLoad() {
  act(() => window.dispatchEvent(new Event("load")));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalReadyStateDescriptor) {
    Object.defineProperty(
      document,
      "readyState",
      originalReadyStateDescriptor
    );
  } else {
    Reflect.deleteProperty(document, "readyState");
  }
  if (originalVisibilityStateDescriptor) {
    Object.defineProperty(
      document,
      "visibilityState",
      originalVisibilityStateDescriptor
    );
  } else {
    Reflect.deleteProperty(document, "visibilityState");
  }
  vi.useRealTimers();
});

describe("useServiceWorkerUpdate", () => {
  test("registers the native worker after page load and reports an already waiting update", async () => {
    const harness = makeServiceWorkerHarness();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading"
    });
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );

    expect(harness.register).not.toHaveBeenCalled();
    finishPageLoad();

    await waitFor(() =>
      expect(harness.register).toHaveBeenCalledWith("/sw.js", {
        updateViaCache: "none"
      })
    );
    await waitFor(() => expect(result.current.needRefresh).toBe(true));
  });

  test("reports a newly installed update when the page already has a controller", async () => {
    const harness = makeServiceWorkerHarness({ waiting: false });
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(harness.register).toHaveBeenCalledOnce());

    const installingWorker = new TestWorker("installing");
    harness.setInstalling(installingWorker);
    act(() => harness.registration.dispatchEvent(new Event("updatefound")));
    act(() => installingWorker.setState("installed"));

    await waitFor(() => expect(result.current.needRefresh).toBe(true));
  });

  test("tracks an installing worker already present when registration resolves", async () => {
    const installingWorker = new TestWorker("installing");
    const harness = makeServiceWorkerHarness({
      waiting: false,
      installing: installingWorker
    });
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(harness.register).toHaveBeenCalledOnce());

    act(() => installingWorker.setState("installed"));

    await waitFor(() => expect(result.current.needRefresh).toBe(true));
  });

  test("does not prompt when the initially installing worker finishes", async () => {
    const installingWorker = new TestWorker("installing");
    const harness = makeServiceWorkerHarness({
      waiting: false,
      controlled: false,
      installing: installingWorker
    });
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(harness.register).toHaveBeenCalledOnce());

    act(() => installingWorker.setState("installed"));

    expect(result.current.needRefresh).toBe(false);
  });

  test("posts SKIP_WAITING and reloads exactly once after controllerchange", async () => {
    const harness = makeServiceWorkerHarness();
    const reload = vi.fn();
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload
      })
    );
    finishPageLoad();
    await waitFor(() => expect(result.current.needRefresh).toBe(true));

    act(() => result.current.activateUpdate());

    expect(harness.waitingWorker?.postMessage).toHaveBeenCalledWith(
      "SKIP_WAITING"
    );
    expect(reload).not.toHaveBeenCalled();

    act(() =>
      harness.container.dispatchEvent(new Event("controllerchange"))
    );
    act(() =>
      harness.container.dispatchEvent(new Event("controllerchange"))
    );

    expect(reload).toHaveBeenCalledOnce();
  });

  test("dismisses the current prompt without activating its worker", async () => {
    const harness = makeServiceWorkerHarness();
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(result.current.needRefresh).toBe(true));

    act(() => result.current.dismissUpdate());

    expect(result.current.needRefresh).toBe(false);
    expect(harness.waitingWorker?.postMessage).not.toHaveBeenCalled();
  });

  test("offers a dismissed waiting update again after a later update check", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    const harness = makeServiceWorkerHarness();
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(result.current.needRefresh).toBe(true));

    act(() => result.current.dismissUpdate());
    expect(result.current.needRefresh).toBe(false);

    act(() => document.dispatchEvent(new Event("visibilitychange")));

    await waitFor(() => expect(harness.update).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.needRefresh).toBe(true));
    expect(harness.waitingWorker?.postMessage).not.toHaveBeenCalled();
  });

  test("logs registration failures while keeping the update state usable", async () => {
    const harness = makeServiceWorkerHarness();
    const registrationError = new Error("registration denied");
    harness.register.mockRejectedValue(registrationError);
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );

    finishPageLoad();

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        "Service worker registration failed.",
        registrationError
      )
    );
    expect(result.current.needRefresh).toBe(false);
  });

  test("checks for updates on the configured interval only while visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete"
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    const harness = makeServiceWorkerHarness();

    renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn(),
        updateIntervalMs: 1_000
      })
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(harness.update).toHaveBeenCalledOnce();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(harness.update).toHaveBeenCalledOnce();
  });

  test("checks for updates when the document becomes visible again", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });
    const harness = makeServiceWorkerHarness();

    renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(harness.register).toHaveBeenCalledOnce());

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    await waitFor(() => expect(harness.update).toHaveBeenCalledOnce());
  });

  test("stops interval and visibility update checks after unmount", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete"
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    const harness = makeServiceWorkerHarness();
    const { unmount } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn(),
        updateIntervalMs: 1_000
      })
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(harness.update).toHaveBeenCalledOnce();
    harness.update.mockClear();

    unmount();
    act(() => {
      vi.advanceTimersByTime(1_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(harness.update).not.toHaveBeenCalled();
  });

  test("logs update-check failures without changing the prompt state", async () => {
    const harness = makeServiceWorkerHarness({ waiting: false });
    const updateError = new Error("offline");
    harness.update.mockRejectedValue(updateError);
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({
        serviceWorker: harness.container,
        reload: vi.fn()
      })
    );
    finishPageLoad();
    await waitFor(() => expect(harness.register).toHaveBeenCalledOnce());

    act(() => document.dispatchEvent(new Event("visibilitychange")));

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        "Service worker update check failed.",
        updateError
      )
    );
    expect(result.current.needRefresh).toBe(false);
  });
});

describe("UpdatePrompt", () => {
  test("offers Update now and Later and activates only from Update now", async () => {
    const harness = makeServiceWorkerHarness();
    render(
      <UpdatePrompt
        serviceWorker={harness.container}
        reload={vi.fn()}
      />
    );
    finishPageLoad();

    expect(
      await screen.findByRole("status", { name: "Update available" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Later" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update now" }));

    expect(harness.waitingWorker?.postMessage).toHaveBeenCalledWith(
      "SKIP_WAITING"
    );
  });

  test("Later hides the prompt without posting to the waiting worker", async () => {
    const harness = makeServiceWorkerHarness();
    render(
      <UpdatePrompt
        serviceWorker={harness.container}
        reload={vi.fn()}
      />
    );
    finishPageLoad();
    await screen.findByRole("status", { name: "Update available" });

    fireEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(
      screen.queryByRole("status", { name: "Update available" })
    ).not.toBeInTheDocument();
    expect(harness.waitingWorker?.postMessage).not.toHaveBeenCalled();
  });
});
