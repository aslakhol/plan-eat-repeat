import { SignInButton, useAuth, useSession } from "@clerk/nextjs";
import { startOfToday } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import {
  type PublishedDinner,
  publishedDinnerSaveIntentPath,
  withoutPublishedDinnerSaveIntent,
} from "~/lib/published-dinner";
import { api } from "~/utils/api";
import { DinnerPlanningSheet } from "~/views/Dinners/DinnerPlanningSheet";
import { PublishedDinnerView } from "./PublishedDinnerView";
import { PublishedDinnerUnavailable } from "./PublishedDinnerUnavailable";

type SavedDinner = { id: number; name: string };

export const PublishedDinnerExperience = ({
  dinner,
  upsell,
}: {
  dinner: PublishedDinner;
  upsell: string;
}) => {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const [today] = useState(startOfToday);
  const [planning, setPlanning] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    dinner: SavedDinner;
    createdNewCopy: boolean;
  } | null>(null);
  const [saveResultOpen, setSaveResultOpen] = useState(false);
  const [sourceUnavailable, setSourceUnavailable] = useState(false);
  const resumedSaveIntent = useRef(false);

  const hasSaveIntent = router.isReady && router.query.save === "1";
  const clearSaveIntent = useCallback(async () => {
    await router.replace(
      {
        pathname: router.pathname,
        query: withoutPublishedDinnerSaveIntent(router.query),
      },
      undefined,
      { shallow: true },
    );
  }, [router]);

  const statusQuery = api.dinner.publishedSaveStatus.useQuery(
    { publicSlug: dinner.publicSlug },
    { enabled: isSignedIn === true },
  );
  const saveMutation = api.dinner.savePublished.useMutation({
    onSuccess: async (result) => {
      await session?.reload();
      setSaveResult(result);
      setSaveResultOpen(true);
      if (hasSaveIntent) await clearSaveIntent();
      await statusQuery.refetch();
    },
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        setSourceUnavailable(true);
        if (hasSaveIntent) void clearSaveIntent();
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not save Dinner",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (!isSignedIn || !hasSaveIntent || resumedSaveIntent.current) return;
    resumedSaveIntent.current = true;
    saveMutation.mutate({ publicSlug: dinner.publicSlug });
  }, [dinner.publicSlug, hasSaveIntent, isSignedIn, saveMutation]);

  if (sourceUnavailable) return <PublishedDinnerUnavailable />;

  const detectedDinner = saveResult?.dinner ?? statusQuery.data?.dinner;
  const createdNewCopy = saveResult?.createdNewCopy ?? false;
  const actionLabel = saveMutation.isPending
    ? "Saving…"
    : "Add to my cookbook";

  const actionButton = (
    <Button
      type="button"
      size="lg"
      className="w-full shrink-0 md:w-auto"
      disabled={!isLoaded || saveMutation.isPending}
      onClick={() => {
        if (!isSignedIn) return;
        if (detectedDinner) {
          setSaveResultOpen(true);
          return;
        }
        saveMutation.mutate({ publicSlug: dinner.publicSlug });
      }}
    >
      {actionLabel}
    </Button>
  );

  const saveAction =
    isLoaded && !isSignedIn ? (
      <SignInButton
        mode="modal"
        forceRedirectUrl={publishedDinnerSaveIntentPath(dinner.publicSlug)}
        signUpForceRedirectUrl={publishedDinnerSaveIntentPath(
          dinner.publicSlug,
        )}
      >
        {actionButton}
      </SignInButton>
    ) : (
      actionButton
    );

  return (
    <>
      <PublishedDinnerView
        dinner={dinner}
        upsell={upsell}
        saveAction={saveAction}
      />

      <ResponsiveModal open={saveResultOpen} onOpenChange={setSaveResultOpen}>
        <ResponsiveModalContent className="h-auto gap-4 bg-white px-5 pb-6 md:max-w-[480px]">
          <ResponsiveModalTitle className="text-center font-serif text-2xl font-normal">
            {createdNewCopy
              ? "Saved to your cookbook"
              : "Already in your cookbook"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center">
            {createdNewCopy
              ? `Your copy. ${dinner.householdName} won’t see your changes.`
              : "Open the Dinner you already saved, or deliberately save another copy."}
          </ResponsiveModalDescription>

          {createdNewCopy ? (
            <div className="grid gap-2">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setSaveResultOpen(false);
                  setPlanning(true);
                }}
              >
                Plan it
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dinners">Open my cookbook</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild size="lg" variant="outline">
                <Link href={`/dinners/${detectedDinner?.id ?? ""}`}>
                  Open it
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({
                    publicSlug: dinner.publicSlug,
                    forceCopy: true,
                  })
                }
              >
                {saveMutation.isPending ? "Saving…" : "Save a copy"}
              </Button>
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {detectedDinner && (
        <DinnerPlanningSheet
          dinner={detectedDinner}
          open={planning}
          onOpenChange={setPlanning}
          onPlanned={() => {
            setPlanning(false);
            void router.push("/");
          }}
          today={today}
        />
      )}
    </>
  );
};
