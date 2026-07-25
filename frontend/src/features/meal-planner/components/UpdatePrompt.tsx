import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

type UpdatePromptProps = {
  serviceWorker?: ServiceWorkerContainer;
  reload?: () => void;
};

export function UpdatePrompt(props: UpdatePromptProps = {}) {
  const { needRefresh, activateUpdate, dismissUpdate } =
    useServiceWorkerUpdate(props);

  if (!needRefresh) {
    return null;
  }

  return (
    <section
      className="update-prompt"
      role="status"
      aria-label="Update available"
    >
      <p>
        <strong>Update available</strong>
        <span>Refresh when you’re ready.</span>
      </p>
      <div>
        <button type="button" onClick={activateUpdate}>
          Update now
        </button>
        <button type="button" onClick={dismissUpdate}>
          Later
        </button>
      </div>
    </section>
  );
}
