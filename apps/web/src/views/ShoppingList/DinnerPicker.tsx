import { addWeeks, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
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
} from "~/lib/cookbook";
import { buildDinnerPlanningWeek } from "~/lib/dinner-planning";
import { cn } from "~/lib/utils";
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
  const [sort, setSort] = useState<CookbookSort>("not-lately");
  // A planned occurrence and the same Dinner in the Cookbook are separate additions.
  const [selections, setSelections] = useState(new Map<string, number>());
  const { query: dinners, today } = useDinnerSummaries();
  const week = buildDinnerPlanningWeek(addWeeks(today, weekOffset));
  const plans = api.plan.plannedDinners.useQuery(
    { startOfWeek: week.start },
    { enabled: source === "plan" },
  );
  const add = useAddDinnersToShoppingList(onClose);
  const collection = deriveDinnerCollection(dinners.data?.dinners ?? [], {
    search,
    selectedTags,
    sort,
  });
  const toggle = (key: string, dinnerId: number) => {
    setSelections((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, dinnerId);
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
            sort={sort}
            onSortChange={setSort}
            placeholder="Search the cookbook…"
            className="shrink-0"
          />
        )}
        <ResponsiveModalScrollViewport className="min-h-0 flex-1 space-y-2.5">
          {source === "plan" ? (
            plans.isPending ? (
              <p role="status">Loading week plan…</p>
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
                    disabled={add.isPending}
                    onClick={() => toggle(`plan:${plan.id}`, plan.dinner.id)}
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
            <p role="status">Loading Cookbook…</p>
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
                  disabled={add.isPending}
                  onClick={() => toggle(`cookbook:${dinner.id}`, dinner.id)}
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
        {add.isError && (
          <p role="alert" className="text-destructive shrink-0 text-sm">
            Could not add dinners. Check your connection and try again.
          </p>
        )}
        <Button
          className="h-12 shrink-0 rounded-xl text-base"
          disabled={selections.size === 0 || add.isPending}
          onClick={() => add.mutate({ dinnerIds: [...selections.values()] })}
        >
          {add.isPending
            ? "Adding…"
            : selections.size === 0
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
