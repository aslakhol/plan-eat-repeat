import { useUser } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "~/utils/api";
import { LoadingIndicator } from "./LoadingIndicator";
import { Welcome } from "./Welcome";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";

export function HouseholdGate({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const { user } = useUser();
  const utils = api.useUtils();
  const status = api.household.welcomeStatus.useQuery(
    { userId },
    {
      staleTime: Infinity,
    },
  );
  const [dismissed, setDismissed] = useState(false);
  const {
    mutate: start,
    isIdle,
    isError,
  } = api.household.start.useMutation({
    onSuccess: async (data) => {
      await user?.reload();
      await utils.household.household.invalidate();
      utils.household.welcomeStatus.setData({ userId }, data);
    },
  });
  const dismiss = api.household.dismissWelcome.useMutation({
    meta: { handlesError: true },
    onSuccess: (data) => {
      utils.household.welcomeStatus.setData({ userId }, data);
    },
    onError: () => {
      toast({
        description:
          "We couldn't save that you’ve seen the welcome. It may appear next time.",
      });
    },
  });

  useEffect(() => {
    if (status.data && !status.data.householdId && isIdle) start();
  }, [status.data, isIdle, start]);

  if (status.isError || isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p>We couldn&apos;t open your household.</p>
        <Button
          onClick={() => (status.isError ? void status.refetch() : start())}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!status.data?.householdId) {
    return (
      <LoadingIndicator
        label="Opening your household…"
        className="h-[50vh] w-full"
      />
    );
  }

  return (
    <>
      {children}
      {!status.data.welcomeSeenAt && !dismissed && (
        <Welcome
          onClose={() => {
            setDismissed(true);
            dismiss.mutate();
          }}
        />
      )}
    </>
  );
}
