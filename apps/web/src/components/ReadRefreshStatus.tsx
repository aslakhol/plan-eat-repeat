export function ReadRefreshStatus({
  queries,
}: {
  queries: readonly {
    data: unknown;
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
  const refreshing = saved.some((query) => query.isFetching);
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
