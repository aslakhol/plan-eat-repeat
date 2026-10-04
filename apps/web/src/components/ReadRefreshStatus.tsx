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
  const failed = saved.some((query) => query.isError || query.failureCount > 0);
  const offline = saved.some((query) => query.isPaused);
  const refreshing = saved.some((query) => query.isFetching);
  const message = offline
    ? "Offline · Showing saved data"
    : failed
      ? "Couldn't refresh · Showing saved data"
      : undefined;
  return (
    <div className="size-4 shrink-0" title={message}>
      {message ? (
        <span role="status" className="text-muted-foreground">
          <CloudOff aria-hidden="true" className="size-4" />
          <span className="sr-only">{message}</span>
        </span>
      ) : refreshing ? (
        <LoadingIndicator
          label="Updating"
          className="size-4 py-0 [&_svg]:size-4"
        />
      ) : null}
    </div>
  );
}
import { CloudOff } from "lucide-react";
import { LoadingIndicator } from "./LoadingIndicator";
