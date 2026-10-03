import { z } from "zod";

export const appStatusSchema = z.object({
  userId: z.string(),
  sessionId: z.string().nullable(),
  householdId: z.string().nullable(),
  welcomeSeenAt: z.date().nullable(),
});
export type AppStatus = z.infer<typeof appStatusSchema>;

export function responseAppStatus(data: unknown) {
  const result = z.object({ appStatus: appStatusSchema }).safeParse(data);
  return result.success ? result.data.appStatus : null;
}

export function missingHousehold(error: unknown) {
  const result = z
    .object({
      data: z.object({
        code: z.literal("FORBIDDEN"),
        missingHousehold: z.object({
          userId: z.string(),
          sessionId: z.string().nullable(),
        }),
      }),
    })
    .safeParse(error);
  return result.success ? result.data.data.missingHousehold : null;
}

export function sameAppSession(
  scope: Pick<AppStatus, "userId" | "sessionId">,
  userId: string,
  sessionId: string | null,
) {
  return scope.userId === userId && scope.sessionId === sessionId;
}

// QueryCache retains the complete response before any observer select transform.
// Keep one setup owner for the page's concurrent reads.
export function observeAppReads(
  cache: import("@tanstack/react-query").QueryCache,
  session: Pick<AppStatus, "userId" | "sessionId">,
  callbacks: {
    onStatus: (status: AppStatus) => void;
    onMissingHousehold: () => void;
  },
) {
  let started = false;
  let confirmedHousehold = false;
  const start = () => {
    if (started || confirmedHousehold) return;
    started = true;
    callbacks.onMissingHousehold();
  };
  const observe = (data: unknown, error: unknown) => {
    const status = responseAppStatus(data);
    if (status && sameAppSession(status, session.userId, session.sessionId)) {
      if (status.householdId) {
        confirmedHousehold = true;
        callbacks.onStatus(status);
      } else start();
    }
    const absent = missingHousehold(error);
    if (absent && sameAppSession(absent, session.userId, session.sessionId))
      start();
  };
  const unsubscribe = cache.subscribe((event) => {
    if (event.type === "updated")
      observe(
        event.query.state.data,
        event.query.state.error ?? event.query.state.fetchFailureReason,
      );
  });
  // An already-authorized read takes precedence over an older absence.
  const queries = cache.getAll();
  for (const query of queries) {
    const status = responseAppStatus(query.state.data);
    if (status?.householdId) observe(query.state.data, null);
  }
  for (const query of queries)
    observe(
      query.state.data,
      query.state.error ?? query.state.fetchFailureReason,
    );
  return unsubscribe;
}
