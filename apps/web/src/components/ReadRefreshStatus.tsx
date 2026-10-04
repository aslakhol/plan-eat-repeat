export function ReadRefreshStatus({
  queries,
}: {
  queries: readonly {
    data: unknown;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isPaused: boolean;
    isError: boolean;
    failureCount: number;
  }[];
}) {
  const saved = queries.filter((query) => query.data !== undefined);
  if (!saved.length) return null;
  const failed = saved.some((query) => query.isError || query.failureCount > 0);
  const offline = saved.some((query) => query.isPaused);
  // Show startup refreshes, but avoid flashing on every two-second shopping poll.
  const refreshing = saved.some(
    (query) => query.isFetching && !query.isFetchedAfterMount,
  );
  if (!failed && !offline && !refreshing) return null;
  return (
    <p role="status" className="text-muted-foreground mb-3 text-xs">
      {offline
        ? "Offline · Showing saved data"
        : failed
          ? "Couldn't refresh · Showing saved data"
          : "Updating…"}
    </p>
  );
}
