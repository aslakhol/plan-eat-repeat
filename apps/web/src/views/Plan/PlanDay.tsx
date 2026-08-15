import { format } from "date-fns";
import { AlertCircle, Loader2 } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";

import {
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";
import {
  deriveDinnerPickerCollection,
  formatDinnerSummaryLabel,
  type CookbookSort,
} from "~/lib/cookbook";
import {
  formatDinnerPlanningConfirmation,
  pickSurpriseDinner,
} from "~/lib/dinner-planning";
import { planSlotDateFromDate } from "~/lib/editor-navigation";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { type DinnerWithTags } from "~/utils/types";
import { DinnerCollectionControls } from "~/views/DinnerCollectionControls";
import { useDinnerCreation } from "~/views/Dinners/DinnerCreationContext";

type Props = {
  date: Date;
  closeDialog: () => void;
  plannedDinner?: DinnerWithTags;
};

type DinnerSummary = RouterOutputs["dinner"]["summaries"]["dinners"][number];

const pickerSortOptions = [
  { value: "not-lately" as const, label: "Haven't had lately" },
  { value: "az" as const, label: "A–Z" },
  { value: "favourites" as const, label: "Favourites" },
];

export const PlanDay = ({ date, closeDialog, plannedDinner }: Props) => {
  const posthog = usePostHog();
  const { openAddDinner } = useDinnerCreation();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<CookbookSort>("not-lately");
  const [planningError, setPlanningError] = useState<string | null>(null);
  const surpriseDinnerNameRef = useRef<string | null>(null);

  const { query: dinnersQuery, today } = useDinnerSummaries();
  const collection = deriveDinnerPickerCollection(
    dinnersQuery.data?.dinners ?? [],
    {
      excludedDinnerId: plannedDinner?.id,
      search,
      selectedTags,
      sort,
    },
  );

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onMutate: () => setPlanningError(null),
    onSuccess: (result, variables) => {
      void utils.plan.plannedDinners.invalidate();
      void utils.dinner.summaries.invalidate();
      if (surpriseDinnerNameRef.current) {
        toast({
          title: formatDinnerPlanningConfirmation(
            surpriseDinnerNameRef.current,
            variables.date,
          ),
        });
        surpriseDinnerNameRef.current = null;
      }
      posthog.capture("plan dinner from week page", {
        dinner:
          dinnersQuery.data?.dinners.find(
            (dinner) => dinner.id === result.newPlan.dinnerId,
          )?.name ?? "unknown",
        day: format(date, "EEE do"),
      });
      closeDialog();
    },
    onError: () => {
      surpriseDinnerNameRef.current = null;
      setPlanningError(
        "We couldn't update this Plan Slot. Check your connection and try again.",
      );
    },
  });

  const planDinner = (
    dinnerId: number,
    surpriseDinnerName: string | null = null,
  ) => {
    surpriseDinnerNameRef.current = surpriseDinnerName;
    planDinnerForDateMutation.mutate({ date, dinnerId });
  };

  const surpriseMe = () => {
    const randomDinner = pickSurpriseDinner(collection.dinners);
    if (randomDinner) {
      planDinner(randomDinner.id, randomDinner.name);
    }
  };

  return (
    <ResponsiveModalContent className="flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden bg-white md:max-w-xl">
      <ResponsiveModalTitle className="sr-only">
        Choose a Dinner
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="shrink-0 pb-4 text-center text-[13px] font-semibold">
        {format(date, "EEEE, LLLL do")}
        {plannedDinner
          ? ` · replacing ${plannedDinner.name}`
          : " · nothing planned"}
      </ResponsiveModalDescription>

      {dinnersQuery.isSuccess && (
        <DinnerCollectionControls
          dinners={collection.availableDinners}
          tagVocabularyDinners={dinnersQuery.data.dinners}
          search={search}
          onSearchChange={setSearch}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          sort={sort}
          onSortChange={setSort}
          placeholder="Search the cookbook…"
          sortOptions={pickerSortOptions}
          className="shrink-0"
        />
      )}

      <ResponsiveModalScrollViewport className="min-h-0 flex-1 py-4">
        {dinnersQuery.isPending ? (
          <div className="flex h-full items-center justify-center">
            <Loader2
              className="text-primary animate-spin"
              aria-label="Loading Cookbook"
            />
          </div>
        ) : !dinnersQuery.isSuccess ? (
          <PickerMessage
            icon={<AlertCircle className="text-destructive size-6" />}
            title="Couldn't load Cookbook"
            body="Check your connection and try again."
            action={{
              label: "Try again",
              onClick: () => void dinnersQuery.refetch(),
            }}
          />
        ) : collection.dinners.length > 0 ? (
          <div className="flex flex-col gap-2">
            {collection.dinners.map((dinner) => (
              <DinnerChoice
                key={dinner.id}
                dinner={dinner}
                today={today}
                onChoose={() => planDinner(dinner.id)}
                disabled={planDinnerForDateMutation.isPending}
              />
            ))}
            <p className="text-muted-foreground pt-2 text-center text-[11px] font-semibold">
              {collection.hasActiveFilters
                ? `${collection.matchingCount} ${collection.matchingCount === 1 ? "dinner" : "dinners"} match`
                : "⌄ the whole cookbook ⌄"}
            </p>
          </div>
        ) : collection.emptyState === "empty-cookbook" ? (
          <PickerMessage
            title={plannedDinner ? "No other Dinners yet" : "Cookbook is empty"}
            body="Create a Dinner for this Plan Slot."
          />
        ) : (
          <PickerMessage
            title="No dinners match"
            body="Try another search or clear the selected tags."
            action={{
              label: "Clear filters",
              onClick: () => {
                setSearch("");
                setSelectedTags([]);
              },
            }}
          />
        )}
      </ResponsiveModalScrollViewport>

      {planningError && (
        <p
          role="alert"
          className="text-destructive shrink-0 pb-3 text-center text-sm"
        >
          {planningError}
        </p>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          onClick={() => {
            closeDialog();
            openAddDinner({
              origin: "week",
              date: planSlotDateFromDate(date),
            });
          }}
        >
          New dinner
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          onClick={surpriseMe}
          disabled={
            collection.dinners.length === 0 ||
            planDinnerForDateMutation.isPending ||
            !dinnersQuery.isSuccess
          }
        >
          {planDinnerForDateMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Surprise me!"
          )}
        </Button>
      </div>
    </ResponsiveModalContent>
  );
};

const DinnerChoice = ({
  dinner,
  today,
  onChoose,
  disabled,
}: {
  dinner: DinnerSummary;
  today: Date;
  onChoose: () => void;
  disabled: boolean;
}) => (
  <Button
    type="button"
    variant="secondary"
    disabled={disabled}
    onClick={onChoose}
    className="bg-secondary/70 hover:bg-secondary h-auto w-full items-baseline justify-start gap-3 whitespace-normal rounded-xl px-3.5 py-3 text-left font-normal"
  >
    <span className="min-w-0 flex-1 truncate font-serif text-[15px] leading-tight">
      {dinner.name}
    </span>
    <span
      className={cn(
        "text-muted-foreground shrink-0 text-[11px] font-semibold",
        dinner.currentWeekPlanDates.length > 0 && "text-primary",
      )}
    >
      {formatDinnerSummaryLabel({
        today,
        lastCookedDate: dinner.lastCookedDate,
        currentWeekPlanDates: dinner.currentWeekPlanDates,
      })}
    </span>
  </Button>
);

const PickerMessage = ({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) => (
  <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
    {icon}
    <h2 className="font-serif text-xl">{title}</h2>
    <p className="text-muted-foreground text-sm">{body}</p>
    {action && (
      <Button type="button" variant="outline" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);
