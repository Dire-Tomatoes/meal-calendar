interface ConnectionStatusProps {
  isOnline: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  error?: Error | null;
  refreshError?: Error | null;
}

export function ConnectionStatus({
  isOnline,
  isSaving,
  isRefreshing,
  error,
  refreshError
}: ConnectionStatusProps) {
  let message: { role: "status" | "alert"; text: string } | null = null;

  if (!isOnline) {
    message = { role: "status", text: "Offline" };
  } else if (isSaving) {
    message = { role: "status", text: "Saving" };
  } else if (error) {
    message = { role: "alert", text: "Unable to save. Try again." };
  } else if (refreshError) {
    message = {
      role: "alert",
      text: "Couldn’t refresh. Showing saved meals."
    };
  } else if (isRefreshing) {
    message = { role: "status", text: "Refreshing" };
  }

  return (
    <div
      className="connection-status-slot"
      aria-live="polite"
      aria-atomic="true"
    >
      {message ? <p role={message.role}>{message.text}</p> : null}
    </div>
  );
}
