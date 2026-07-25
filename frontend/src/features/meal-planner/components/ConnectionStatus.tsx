interface ConnectionStatusProps {
  isOnline: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  error?: Error | null;
}

export function ConnectionStatus({
  isOnline,
  isSaving,
  isRefreshing,
  error
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

  if (isRefreshing) {
    return <p role="status">Refreshing</p>;
  }

  return null;
}
