import { addWeeks, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { FavouriteListMark } from "~/components/FavouriteMark";
import { Button } from "~/components/ui/button";
import { useAddDinnersToShoppingList } from "~/hooks/use-add-dinners-to-shopping-list";
import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";
import {
  deriveDinnerCollection,
  formatDinnerSummaryLabel,
  type CookbookSort,
  type DinnerContentFilter,
} from "~/lib/cookbook";
import { buildDinnerPlanningWeek } from "~/lib/dinner-planning";
import { cn } from "~/lib/utils";
import { shoppingChoicesQueryOptions } from "~/lib/query-freshness";
import { api } from "~/utils/api";
import { DinnerCollectionControls } from "../DinnerCollectionControls";
import { WeekSelect } from "../WeekSelect";

export type ShoppingDinnerSource = "plan" | "cookbook";

export function DinnerPicker({
  initialSource,
  onClose,
}: {
  initialSource: ShoppingDinnerSource;
  onClose: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContentFilters, setSelectedContentFilters] = useState<
    DinnerContentFilter[]
  >([]);
  const [sort, setSort] = useState<CookbookSort>("not-lately");
  // A planned occurrence and the same Dinner in the Cookbook are separate additions.
  const [selections, setSelections] = useState(
    new Map<string, { id: number; name: string }>(),
  );
  const { query: dinners, today } = useDinnerSummaries();
  const week = buildDinnerPlanningWeek(addWeeks(today, weekOffset));
  const plans = api.plan.plannedDinners.useQuery(
    { startOfWeek: week.start },
    { ...shoppingChoicesQueryOptions, enabled: source === "plan" },
  );
  const add = useAddDinnersToShoppingList(onClose);
  const collection = deriveDinnerCollection(dinners.data?.dinners ?? [], {
    search,
    selectedTags,
    selectedContentFilters,
    sort,
  });
  const toggle = (key: string, dinner: { id: number; name: string }) => {
    setSelections((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, dinner);
      return next;
    });
  };

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveModalContent className="flex h-[90dvh] max-h-[850px] flex-col gap-4 rounded-t-3xl bg-white p-5 md:rounded-2xl md:pt-10">
        <ResponsiveModalTitle className="sr-only">
          Add dinners
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Choose dinners for your shopping list
        </ResponsiveModalDescription>
        <div
          className="bg-muted grid shrink-0 grid-cols-2 gap-1 rounded-xl p-1"
          aria-label="Dinner source"
        >
          {(["plan", "cookbook"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={source === tab}
              onClick={() => setSource(tab)}
              className={cn(
                "text-muted-foreground rounded-lg px-2 py-3 text-sm font-bold",
                source === tab && "text-primary bg-white shadow-sm",
              )}
            >
              {tab === "plan" ? "This week's plan" : "Cookbook"}
            </button>
          ))}
        </div>
        {source === "plan" ? (
          <WeekSelect setWeekOfSet={setWeekOffset} weekLabel={week.label} />
        ) : (
          <DinnerCollectionControls
            dinners={dinners.data?.dinners ?? []}
            search={search}
            onSearchChange={setSearch}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            selectedContentFilters={selectedContentFilters}
            onSelectedContentFiltersChange={setSelectedContentFilters}
            sort={sort}
            onSortChange={setSort}
            placeholder="Search the cookbook…"
            className="shrink-0"
          />
        )}
        <ResponsiveModalScrollViewport className="min-h-0 flex-1 space-y-2.5">
          {source === "plan" ? (
            plans.isPending ? (
              <LoadingIndicator label="Loading week plan…" />
            ) : plans.isError ? (
              <p role="alert" className="text-destructive text-sm">
                Could not load the week plan. Try again.
              </p>
            ) : (
              week.days.map((day) => {
                const plan = plans.data.plans.find((plan) =>
                  isSameDay(plan.date, day.date),
                );
                const date = (
                  <time
                    dateTime={day.dateTime}
                    className="text-muted-foreground mb-1 block text-[11px] font-bold uppercase"
                  >
                    {day.dayLabel}
                  </time>
                );
                return plan ? (
                  <DinnerChoice
                    key={day.dateTime}
                    selected={selections.has(`plan:${plan.id}`)}
                    disabled={!add.isReady}
                    onClick={() => toggle(`plan:${plan.id}`, plan.dinner)}
                  >
                    <span className="min-w-0 flex-1">
                      {date}
                      <span className="font-serif text-[17px]">
                        {plan.dinner.name}
                      </span>
                    </span>
                  </DinnerChoice>
                ) : (
                  <div
                    key={day.dateTime}
                    className="border-border rounded-[14px] border border-dashed px-3.5 py-3"
                  >
                    {date}
                    <span className="text-muted-foreground text-sm">
                      Nothing planned
                    </span>
                  </div>
                );
              })
            )
          ) : dinners.isPending ? (
            <LoadingIndicator label="Loading Cookbook…" />
          ) : dinners.isError ? (
            <p role="alert" className="text-destructive text-sm">
              Could not load Cookbook. Try again.
            </p>
          ) : collection.dinners.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {collection.emptyState === "empty-cookbook"
                ? "Your Cookbook is empty"
                : "No dinners match"}
            </p>
          ) : (
            collection.dinners.map((dinner, index) => (
              <Fragment key={dinner.id}>
                {index === collection.mostPlannedStartIndex && (
                  <p className="text-muted-foreground text-[11px] font-bold uppercase">
                    Most planned
                  </p>
                )}
                <DinnerChoice
                  selected={selections.has(`cookbook:${dinner.id}`)}
                  disabled={!add.isReady}
                  onClick={() => toggle(`cookbook:${dinner.id}`, dinner)}
                >
                  <span className="min-w-0 flex-1 font-serif text-[17px]">
                    {dinner.name}
                    {dinner.favourite && (
                      <span className="ml-1 inline-block">
                        <FavouriteListMark />
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px] font-semibold">
                    {formatDinnerSummaryLabel({
                      today,
                      lastCookedDate: dinner.lastCookedDate,
                      currentWeekPlanDates: dinner.currentWeekPlanDates,
                    })}
                  </span>
                </DinnerChoice>
              </Fragment>
            ))
          )}
        </ResponsiveModalScrollViewport>
        <Button
          className="h-12 shrink-0 rounded-xl text-base"
          disabled={selections.size === 0 || !add.isReady}
          onClick={() => add.add([...selections.values()])}
        >
          {selections.size === 0
            ? "Add dinners"
            : `Add ${selections.size} ${selections.size === 1 ? "dinner" : "dinners"}`}
        </Button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function DinnerChoice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className="bg-secondary/70 hover:bg-secondary focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left outline-none [overflow-wrap:anywhere] focus-visible:ring-2 disabled:opacity-50"
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "border-border flex size-6 shrink-0 items-center justify-center rounded-full border",
          selected && "border-primary bg-primary text-white",
        )}
      >
        {selected && <Check className="size-4" />}
      </span>
    </button>
  );
}
