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
  if (!isOnline) {
    return <p role="status">Offline</p>;
  }

  if (isSaving) {
    return <p role="status">Saving</p>;
  }

  if (error) {
    return <p role="alert">Unable to save. Try again.</p>;
  }

  if (refreshError) {
    return <p role="alert">Couldn’t refresh. Showing saved meals.</p>;
  }

  if (isRefreshing) {
    return <p role="status">Refreshing</p>;
  }

  return null;
}
