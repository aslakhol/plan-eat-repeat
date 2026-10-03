import { useAuth, useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "~/utils/api";
import {
  missingHousehold,
  observeAppReads,
  type AppStatus,
} from "~/lib/app-status";
import { Welcome } from "./Welcome";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";

// Observe the reads the page already needs. Neither navigation nor page reads
// depend on a separate Household request.
export function HouseholdGate({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const { user } = useUser();
  const { sessionId } = useAuth();
  const client = useQueryClient();
  const utils = api.useUtils();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const dismissalKey = ["welcomeDismissed", userId, sessionId ?? null];
  const [dismissed, setDismissed] = useState(
    () => client.getQueryData<boolean>(dismissalKey) ?? false,
  );
  const active = useRef(true);
  const started = useRef(false);
  const start = api.household.start.useMutation({
    meta: { handlesError: true },
    onSuccess: async (data) => {
      if (!active.current) return;
      setStatus({ ...data, userId, sessionId: sessionId ?? null });
      // Metadata refresh is best-effort; page reads already authorize against DB membership.
      void user?.reload().catch(() => undefined);
      await client.cancelQueries({
        predicate: (query) =>
          !!missingHousehold(
            query.state.error ?? query.state.fetchFailureReason,
          ),
      });
      if (!active.current) return;
      await utils.invalidate();
    },
  });
  const dismiss = api.household.dismissWelcome.useMutation({
    meta: { handlesError: true },
    onSuccess: (data) => {
      if (!active.current) return;
      utils.household.welcomeStatus.setData({ userId }, data);
    },
    onError: () => {
      if (!active.current) return;
      toast({
        description:
          "We couldn't save that you’ve seen the welcome. It may appear next time.",
      });
    },
  });
  const startHousehold = start.mutate;

  useEffect(() => {
    active.current = true;
    // Keep failed-save dismissals for this browser visit, including route remounts.
    client.setQueryDefaults(["welcomeDismissed"], { gcTime: Infinity });
    const unsubscribe = observeAppReads(
      client.getQueryCache(),
      {
        userId,
        sessionId: sessionId ?? null,
      },
      {
        onStatus: (result) => {
          setStatus(result);
          if (result.welcomeSeenAt) {
            client.setQueryData(
              ["welcomeDismissed", userId, sessionId ?? null],
              true,
            );
            setDismissed(true);
          }
        },
        onMissingHousehold: () => {
          if (started.current) return;
          started.current = true;
          startHousehold();
        },
      },
    );
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, [client, userId, sessionId, startHousehold]);

  return (
    <>
      {children}
      {start.isError && (
        <div className="flex flex-col items-center gap-4">
          <p>We couldn&apos;t open your household.</p>
          <Button onClick={() => startHousehold()}>Try again</Button>
        </div>
      )}
      {status?.householdId && !status.welcomeSeenAt && !dismissed && (
        <Welcome
          onClose={() => {
            client.setQueryData(dismissalKey, true);
            setDismissed(true);
            dismiss.mutate();
          }}
        />
      )}
    </>
  );
}
