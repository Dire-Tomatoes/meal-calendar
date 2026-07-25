import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_UPDATE_INTERVAL_MS = 60 * 60 * 1_000;

export type ServiceWorkerUpdateState = {
  needRefresh: boolean;
  activateUpdate: () => void;
  dismissUpdate: () => void;
};

export type ServiceWorkerUpdateOptions = {
  serviceWorker?: ServiceWorkerContainer;
  reload?: () => void;
  updateIntervalMs?: number;
};

export function useServiceWorkerUpdate(
  options: ServiceWorkerUpdateOptions = {}
): ServiceWorkerUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const activationRequested = useRef(false);
  const serviceWorker =
    options.serviceWorker ??
    (typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : undefined);
  const reload = options.reload ?? (() => window.location.reload());
  const updateIntervalMs =
    options.updateIntervalMs ?? DEFAULT_UPDATE_INTERVAL_MS;
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!serviceWorker) {
      return;
    }

    let stopped = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let updateIntervalId: number | undefined;

    const showUpdate = (worker: ServiceWorker) => {
      if (!stopped) {
        waitingWorker.current = worker;
        setNeedRefresh(true);
      }
    };

    const handleStateChange = () => {
      if (
        installing?.state === "installed" &&
        serviceWorker.controller
      ) {
        showUpdate(installing);
      }
    };

    const handleUpdateFound = () => {
      installing?.removeEventListener("statechange", handleStateChange);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", handleStateChange);
    };

    const checkForUpdate = async () => {
      try {
        await registration?.update();
      } catch (error) {
        console.error("Service worker update check failed.", error);
      } finally {
        if (registration?.waiting) {
          showUpdate(registration.waiting);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const register = async () => {
      try {
        registration = await serviceWorker.register("/sw.js", {
          updateViaCache: "none"
        });
        if (stopped) {
          return;
        }

        if (registration.waiting) {
          showUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", handleUpdateFound);
        if (registration.installing) {
          handleUpdateFound();
        }
        document.addEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        updateIntervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            void checkForUpdate();
          }
        }, updateIntervalMs);
      } catch (error) {
        console.error("Service worker registration failed.", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      stopped = true;
      window.removeEventListener("load", register);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      if (updateIntervalId !== undefined) {
        window.clearInterval(updateIntervalId);
      }
      registration?.removeEventListener(
        "updatefound",
        handleUpdateFound
      );
      installing?.removeEventListener("statechange", handleStateChange);
    };
  }, [serviceWorker, updateIntervalMs]);

  const activateUpdate = useCallback(() => {
    if (
      !serviceWorker ||
      !waitingWorker.current ||
      activationRequested.current
    ) {
      return;
    }

    activationRequested.current = true;
    serviceWorker.addEventListener(
      "controllerchange",
      () => reloadRef.current(),
      { once: true }
    );
    waitingWorker.current.postMessage("SKIP_WAITING");
  }, [serviceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return {
    needRefresh,
    activateUpdate,
    dismissUpdate
  };
}
