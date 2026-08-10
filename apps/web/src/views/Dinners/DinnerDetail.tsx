import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, MoreHorizontal, UtensilsCrossed } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { Button } from "../../components/ui/button";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  type RecipeEditorValues,
} from "./RecipeEditor";
import { RecipeView } from "./RecipeView";
import { DeleteDinnerButton } from "./DeleteDinnerButton";
import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";
import { formatDinnerSummaryLabel } from "~/lib/cookbook";
import { DinnerPlanningSheet } from "./DinnerPlanningSheet";
import {
  editorCancelHref,
  editorSaveHref,
  parseEditorNavigation,
} from "~/lib/editor-navigation";

export const DinnerDetail = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();
  const { today, query: summariesQuery } = useDinnerSummaries();
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigation = parseEditorNavigation(router.query);
  const rawDinnerId = router.query.dinnerId;
  const dinnerId =
    typeof rawDinnerId === "string" ? Number(rawDinnerId) : Number.NaN;
  const validDinnerId = Number.isInteger(dinnerId);

  useEffect(() => {
    if (router.isReady && router.query.edit === "1") {
      setEditing(true);
    }
  }, [router.isReady, router.query.edit]);

  const dinnerQuery = api.dinner.get.useQuery(
    { dinnerId },
    { enabled: router.isReady && validDinnerId },
  );

  const editMutation = api.dinner.edit.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} updated` });
      await Promise.all([
        utils.dinner.get.invalidate({ dinnerId }),
        utils.dinner.summaries.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
        utils.plan.plannedDinners.invalidate(),
      ]);
      setEditing(false);
      void router.replace(editorSaveHref(result.dinner.id, navigation));
    },
    onError: (error) => {
      setSubmitError(error.message);
      toast({
        variant: "destructive",
        title: "Could not save dinner",
        description: error.message,
      });
    },
  });

  const deleteMutation = api.dinner.delete.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} deleted` });
      await Promise.all([
        utils.dinner.summaries.invalidate(),
        utils.plan.plannedDinners.invalidate(),
      ]);
      void router.replace("/dinners");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not delete dinner",
        description: error.message,
      });
    },
  });

  const favouriteMutation = api.dinner.setFavourite.useMutation({
    onSuccess: async ({ dinner }) => {
      await Promise.all([
        utils.dinner.summaries.invalidate(),
        utils.dinner.get.invalidate({ dinnerId }),
      ]);
      toast({
        title: dinner.favourite
          ? "Added to favourites"
          : "Removed from favourites",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not update favourite",
        description: error.message,
      });
    },
  });

  if (!router.isReady || dinnerQuery.isPending) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <UtensilsCrossed className="text-primary animate-spin" />
      </div>
    );
  }

  if (!validDinnerId || dinnerQuery.isError || !dinnerQuery.data?.dinner) {
    return (
      <div className="mx-auto max-w-[640px] space-y-4 py-12 text-center">
        <h1 className="font-serif text-2xl">Dinner not found</h1>
        <Button asChild variant="outline">
          <Link href="/dinners">
            <ArrowLeft />
            Back to dinners
          </Link>
        </Button>
      </div>
    );
  }

  const dinner = dinnerQuery.data.dinner;
  const summary = summariesQuery.data?.dinners.find(
    (candidate) => candidate.id === dinner.id,
  );
  const favourite = summary?.favourite ?? dinner.favourite;

  const save = (values: RecipeEditorValues) => {
    posthog.capture("update dinner", { dinnerName: values.name });
    setSubmitError(null);
    editMutation.mutate({
      dinnerId: dinner.id,
      ...dinnerFromEditorValues(values),
    });
  };

  if (editing) {
    return (
      <RecipeEditor
        dinner={dinner}
        isPending={editMutation.isPending || deleteMutation.isPending}
        submitError={submitError}
        onCancel={() => void router.push(editorCancelHref(navigation))}
        onSave={save}
        onDelete={() => {
          posthog.capture("delete dinner", { dinnerName: dinner.name });
          deleteMutation.mutate({ dinnerId: dinner.id });
        }}
      />
    );
  }

  const historyLabel = summary
    ? summary.lastCookedDate
      ? `Last cooked ${formatDinnerSummaryLabel({
          today,
          lastCookedDate: summary.lastCookedDate,
          currentWeekPlanDates: [],
        })} · ${summary.cookingFrequency} ${summary.cookingFrequency === 1 ? "time" : "times"}`
      : "Never made · 0 times"
    : undefined;

  return (
    <>
      <RecipeView
        dinner={dinner}
        historyLabel={historyLabel}
        headerAction={
          <details className="relative">
            <summary className="text-muted-foreground flex h-[30px] w-[30px] cursor-pointer list-none items-center justify-center rounded-full border bg-white [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Dinner actions</span>
            </summary>
            <div className="border-border absolute right-0 top-9 z-20 w-[210px] overflow-hidden rounded-[14px] border bg-white shadow-[0_8px_28px_rgba(60,50,40,.22)]">
              <button
                type="button"
                disabled={favouriteMutation.isPending}
                className="hover:bg-muted w-full px-3.5 py-3 text-left text-[13.5px] font-semibold disabled:opacity-50"
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  favouriteMutation.mutate({
                    dinnerId: dinner.id,
                    favourite: !favourite,
                  });
                }}
              >
                {favourite ? "Remove from favourites" : "Add to favourites"}
              </button>
              <DeleteDinnerButton
                dinnerId={dinner.id}
                isPending={deleteMutation.isPending}
                onDelete={() => {
                  posthog.capture("delete dinner", {
                    dinnerName: dinner.name,
                  });
                  deleteMutation.mutate({ dinnerId: dinner.id });
                }}
                trigger={
                  <button
                    type="button"
                    className="text-destructive hover:bg-destructive/5 w-full border-t px-3.5 py-3 text-left text-[13.5px] font-semibold"
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    Delete dinner
                  </button>
                }
              />
            </div>
          </details>
        }
        footerActions={
          <>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={(event) => {
                event.currentTarget.blur();
                setPlanning(true);
              }}
            >
              Plan this dinner
            </Button>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          </>
        }
      />
      <DinnerPlanningSheet
        dinner={dinner}
        open={planning}
        today={today}
        onOpenChange={setPlanning}
        onPlanned={() => {
          setPlanning(false);
          void router.replace("/dinners");
        }}
      />
    </>
  );
};
