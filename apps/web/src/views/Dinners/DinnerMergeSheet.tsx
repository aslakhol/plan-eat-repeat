import { sourceLabel, type DinnerWithRecipe } from "@planeatrepeat/shared";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Fragment, useEffect, useId, useRef, useState } from "react";

import { FavouriteListMark } from "~/components/FavouriteMark";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import {
  deriveDinnerCollection,
  formatDinnerSummaryLabel,
  type CookbookSort,
} from "~/lib/cookbook";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { DinnerCollectionControls } from "~/views/DinnerCollectionControls";

type DinnerSummary = RouterOutputs["dinner"]["summaries"]["dinners"][number];

type DinnerMergeOption = {
  dinner: DinnerWithRecipe;
  summary: DinnerSummary;
};

type Props = {
  open: boolean;
  origin: DinnerMergeOption;
  dinners: DinnerSummary[];
  today: Date;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
};

type PeekLine = {
  text: string;
  muted?: boolean;
  truncate?: boolean;
};

const sortOptions = [
  { value: "az" as const, label: "A–Z" },
  { value: "not-lately" as const, label: "Haven't had lately" },
  { value: "favourites" as const, label: "Favourites" },
];

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const historyLabel = (summary: DinnerSummary, today: Date) =>
  `${plural(summary.cookingFrequency, "time")} · ${formatDinnerSummaryLabel({
    today,
    lastCookedDate: summary.lastCookedDate,
    currentWeekPlanDates: [],
  })}`;

const dinnerPeek = (dinner: DinnerWithRecipe): PeekLine[] => {
  const ingredients = dinner.parts.flatMap((part) => part.ingredients);
  const stepCount = dinner.parts.reduce(
    (count, part) => count + part.steps.length,
    0,
  );

  if (ingredients.length > 0) {
    const lines: PeekLine[] = ingredients
      .slice(0, 3)
      .map((ingredient) => ({ text: ingredient.name }));
    const summarySegments: string[] = [];
    const remainingCount = ingredients.length - lines.length;
    if (remainingCount > 0) {
      summarySegments.push(`+ ${remainingCount} more`);
    }
    if (stepCount > 0) {
      summarySegments.push(plural(stepCount, "step"));
    }
    if (summarySegments.length > 0) {
      lines.push({ text: summarySegments.join(" · "), muted: true });
    }
    return lines;
  }

  const lines: PeekLine[] = [];
  if (stepCount > 0) {
    lines.push({ text: plural(stepCount, "step"), muted: true });
  }
  if (dinner.notes) {
    lines.push({ text: `“${dinner.notes}”`, truncate: true });
  }
  if (dinner.link) {
    lines.push({ text: sourceLabel(dinner.link), muted: true, truncate: true });
  }
  return lines;
};

export const DinnerMergeSheet = ({
  open,
  origin,
  dinners,
  today,
  onOpenChange,
  onMerged,
}: Props) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<CookbookSort>("az");
  const [loadingCandidateId, setLoadingCandidateId] = useState<number | null>(
    null,
  );
  const [candidate, setCandidate] = useState<DinnerMergeOption | null>(null);
  const [keptDinnerId, setKeptDinnerId] = useState<number | null>(null);
  const pickerViewportRef = useRef<HTMLDivElement>(null);
  const pickerScrollTopRef = useRef(0);
  const noteId = useId();

  const mergeMutation = api.dinner.merge.useMutation({
    onSuccess: async ({ keptDinner }, variables) => {
      posthog.capture("merge dinners", {
        keptDinnerId: variables.keptDinnerId,
        discardedDinnerId: variables.discardedDinnerId,
        originKept: variables.keptDinnerId === origin.dinner.id,
      });
      await Promise.all([utils.dinner.invalidate(), utils.plan.invalidate()]);
      toast({ title: `Merged into ${keptDinner.name}.` });
      onMerged();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Something went wrong." });
    },
  });

  useEffect(() => {
    if (candidate !== null) return;

    const frame = requestAnimationFrame(() => {
      if (pickerViewportRef.current) {
        pickerViewportRef.current.scrollTop = pickerScrollTopRef.current;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [candidate]);

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && mergeMutation.isPending) return;
    onOpenChange(nextOpen);
  };

  const chooseCandidate = async (summary: DinnerSummary) => {
    pickerScrollTopRef.current = pickerViewportRef.current?.scrollTop ?? 0;
    setLoadingCandidateId(summary.id);

    try {
      const result = await utils.dinner.get.fetch({ dinnerId: summary.id });
      if (!result.dinner) {
        toast({ variant: "destructive", title: "Something went wrong." });
        return;
      }
      setCandidate({ dinner: result.dinner, summary });
      setKeptDinnerId(null);
    } catch {
      toast({ variant: "destructive", title: "Something went wrong." });
    } finally {
      setLoadingCandidateId(null);
    }
  };

  const merge = () => {
    if (!candidate || keptDinnerId === null) return;

    mergeMutation.mutate({
      keptDinnerId,
      discardedDinnerId:
        keptDinnerId === origin.dinner.id
          ? candidate.dinner.id
          : origin.dinner.id,
    });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={requestOpenChange}>
      {candidate ? (
        <KeeperContent
          origin={origin}
          candidate={candidate}
          today={today}
          noteId={noteId}
          keptDinnerId={keptDinnerId}
          pending={mergeMutation.isPending}
          onBack={() => {
            setCandidate(null);
            setKeptDinnerId(null);
          }}
          onKeep={setKeptDinnerId}
          onMerge={merge}
        />
      ) : (
        <PickerContent
          originDinner={origin.dinner}
          dinners={dinners}
          today={today}
          search={search}
          selectedTags={selectedTags}
          sort={sort}
          loadingCandidateId={loadingCandidateId}
          viewportRef={pickerViewportRef}
          onViewportScroll={(scrollTop) => {
            pickerScrollTopRef.current = scrollTop;
          }}
          onSearchChange={setSearch}
          onSelectedTagsChange={setSelectedTags}
          onSortChange={setSort}
          onChoose={(summary) => void chooseCandidate(summary)}
        />
      )}
    </ResponsiveModal>
  );
};

type PickerContentProps = {
  originDinner: DinnerWithRecipe;
  dinners: DinnerSummary[];
  today: Date;
  search: string;
  selectedTags: string[];
  sort: CookbookSort;
  loadingCandidateId: number | null;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onViewportScroll: (scrollTop: number) => void;
  onSearchChange: (search: string) => void;
  onSelectedTagsChange: (tags: string[]) => void;
  onSortChange: (sort: CookbookSort) => void;
  onChoose: (summary: DinnerSummary) => void;
};

const PickerContent = ({
  originDinner,
  dinners,
  today,
  search,
  selectedTags,
  sort,
  loadingCandidateId,
  viewportRef,
  onViewportScroll,
  onSearchChange,
  onSelectedTagsChange,
  onSortChange,
  onChoose,
}: PickerContentProps) => {
  const collection = deriveDinnerCollection(dinners, {
    search,
    selectedTags,
    sort,
  });
  const actionableCount = collection.dinners.filter(
    (dinner) => dinner.id !== originDinner.id,
  ).length;
  const originIsVisible = collection.dinners.some(
    (dinner) => dinner.id === originDinner.id,
  );
  const noOtherDinnersMatch =
    collection.hasActiveFilters && actionableCount === 0 && originIsVisible;

  const clearFilters = () => {
    onSearchChange("");
    onSelectedTagsChange([]);
  };

  return (
    <ResponsiveModalContent className="flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden bg-white md:max-w-xl">
      <ResponsiveModalTitle className="text-muted-foreground shrink-0 pb-4 text-center text-[13px] font-semibold">
        Merge{" "}
        <span className="text-foreground font-serif">{originDinner.name}</span>{" "}
        with…
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Choose another Dinner from this Household.
      </ResponsiveModalDescription>

      <DinnerCollectionControls
        dinners={dinners}
        search={search}
        onSearchChange={onSearchChange}
        selectedTags={selectedTags}
        onSelectedTagsChange={onSelectedTagsChange}
        sort={sort}
        onSortChange={onSortChange}
        placeholder="Search dinners…"
        sortOptions={sortOptions}
        className="shrink-0"
      />

      <ResponsiveModalScrollViewport
        ref={viewportRef}
        className="min-h-0 flex-1 py-4"
        onScroll={(event) => onViewportScroll(event.currentTarget.scrollTop)}
      >
        {collection.dinners.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {collection.dinners.map((dinner, index) => (
              <Fragment key={dinner.id}>
                {index === collection.mostPlannedStartIndex && (
                  <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.07em] text-[#a39a8e]">
                    Most planned
                  </p>
                )}
                <PickerDinnerRow
                  dinner={dinner}
                  today={today}
                  origin={dinner.id === originDinner.id}
                  disabled={loadingCandidateId !== null}
                  loading={loadingCandidateId === dinner.id}
                  onChoose={() => onChoose(dinner)}
                />
              </Fragment>
            ))}

            {noOtherDinnersMatch && (
              <div className="flex flex-col items-center gap-3 py-5 text-center">
                <p className="text-muted-foreground text-sm font-semibold">
                  No other dinners match
                </p>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}

            {collection.hasActiveFilters && (
              <p className="text-muted-foreground pt-2 text-center text-[11px] font-semibold">
                {collection.matchingCount}{" "}
                {collection.matchingCount === 1 ? "dinner" : "dinners"}{" "}
                match
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <h2 className="font-serif text-xl">No dinners match</h2>
            <p className="text-muted-foreground text-sm">
              Try another search or clear the selected tags.
            </p>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </ResponsiveModalScrollViewport>
    </ResponsiveModalContent>
  );
};

const PickerDinnerRow = ({
  dinner,
  today,
  origin,
  disabled,
  loading,
  onChoose,
}: {
  dinner: DinnerSummary;
  today: Date;
  origin: boolean;
  disabled: boolean;
  loading: boolean;
  onChoose: () => void;
}) => {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-[5px]">
        <span className="min-w-0 truncate font-serif text-[15px] leading-tight">
          {dinner.name}
        </span>
        {dinner.favourite && <FavouriteListMark />}
        {origin && (
          <span className="text-muted-foreground shrink-0 text-xs font-semibold">
            — this one
          </span>
        )}
      </span>
      {!origin && (
        <span
          className={cn(
            "text-muted-foreground shrink-0 text-[11px] font-semibold",
            dinner.currentWeekPlanDates.length > 0 && "text-primary",
          )}
        >
          {loading ? (
            <Loader2
              className="size-4 animate-spin"
              aria-label="Loading Dinner"
            />
          ) : (
            formatDinnerSummaryLabel({
              today,
              lastCookedDate: dinner.lastCookedDate,
              currentWeekPlanDates: dinner.currentWeekPlanDates,
            })
          )}
        </span>
      )}
    </>
  );

  const className =
    "bg-secondary/70 flex h-auto w-full items-baseline justify-start gap-3 whitespace-normal rounded-xl border-0 px-3.5 py-3 text-left font-normal shadow-none";

  if (origin) {
    return (
      <div aria-disabled="true" className={cn(className, "opacity-70")}>
        {content}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={onChoose}
      className={className}
    >
      {content}
    </Button>
  );
};

type KeeperContentProps = {
  origin: DinnerMergeOption;
  candidate: DinnerMergeOption;
  today: Date;
  noteId: string;
  keptDinnerId: number | null;
  pending: boolean;
  onBack: () => void;
  onKeep: (dinnerId: number) => void;
  onMerge: () => void;
};

const KeeperContent = ({
  origin,
  candidate,
  today,
  noteId,
  keptDinnerId,
  pending,
  onBack,
  onKeep,
  onMerge,
}: KeeperContentProps) => (
  <ResponsiveModalContent className="flex h-auto max-h-[92dvh] flex-col overflow-hidden bg-white md:max-w-[680px]">
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Back to dinner picker"
        onClick={onBack}
        className="absolute -left-2 -top-2 rounded-full"
      >
        <ChevronLeft />
      </Button>
      <ResponsiveModalTitle className="text-muted-foreground px-9 pb-4 text-center text-[13px] font-semibold">
        Which one do you want to keep?
      </ResponsiveModalTitle>
    </div>
    <ResponsiveModalDescription className="sr-only">
      Choose the Dinner that remains unchanged after the merge.
    </ResponsiveModalDescription>

    <ResponsiveModalScrollViewport className="min-h-0 flex-1 py-1">
      <fieldset
        disabled={pending}
        aria-describedby={noteId}
        className="grid grid-cols-2 items-start gap-4"
      >
        <legend className="sr-only">Dinner to keep</legend>
        <KeeperCard
          dinner={origin.dinner}
          summary={origin.summary}
          today={today}
          selectedDinnerId={keptDinnerId}
          onSelect={onKeep}
        />
        <KeeperCard
          dinner={candidate.dinner}
          summary={candidate.summary}
          today={today}
          selectedDinnerId={keptDinnerId}
          onSelect={onKeep}
        />
      </fieldset>
    </ResponsiveModalScrollViewport>

    <p
      id={noteId}
      className="bg-muted mt-4 shrink-0 rounded-xl px-4 py-3 text-[13px] font-semibold leading-relaxed"
    >
      The one you keep stays exactly as it is. The other is deleted. Only the
      planned dates move across.
    </p>
    <Button
      type="button"
      disabled={keptDinnerId === null || pending}
      onClick={onMerge}
      className="mt-3 h-12 w-full shrink-0 rounded-xl text-sm font-bold"
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Merging…
        </>
      ) : (
        "Merge"
      )}
    </Button>
  </ResponsiveModalContent>
);

const KeeperCard = ({
  dinner,
  summary,
  today,
  selectedDinnerId,
  onSelect,
}: {
  dinner: DinnerWithRecipe;
  summary: DinnerSummary;
  today: Date;
  selectedDinnerId: number | null;
  onSelect: (dinnerId: number) => void;
}) => {
  const selected = selectedDinnerId === dinner.id;
  const dimmed = selectedDinnerId !== null && !selected;
  const peek = dinnerPeek(dinner);

  return (
    <label
      className={cn(
        "relative block cursor-pointer transition-opacity",
        dimmed && "opacity-[0.62]",
      )}
    >
      <input
        type="radio"
        name="kept-dinner"
        value={dinner.id}
        checked={selected}
        onChange={() => onSelect(dinner.id)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "bg-muted border-border peer-focus-visible:ring-ring block rounded-[14px] border-[1.5px] p-3.5 transition peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
          selected &&
            "border-primary bg-white shadow-[0_5px_18px_rgba(221,107,66,0.18)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "border-border absolute right-3.5 top-3.5 flex size-[19px] items-center justify-center rounded-full border-[1.5px] bg-white",
            selected && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {selected && <Check className="size-3 stroke-[3]" />}
        </span>

        <span className="block pr-7 font-serif text-[16.5px] leading-tight">
          {dinner.name}
        </span>
        <span className="text-muted-foreground mt-3 block text-[11px] font-semibold">
          {historyLabel(summary, today)}
        </span>

        {peek.length > 0 && (
          <span
            className={cn(
              "border-border mt-4 block border-t pt-3",
              selected && "border-[#efc9ba]",
            )}
          >
            {peek.map((line, index) => (
              <span
                key={`${line.text}-${index}`}
                className={cn(
                  "block text-xs font-semibold leading-relaxed",
                  line.muted && "text-muted-foreground",
                  line.truncate && "truncate",
                )}
              >
                {line.text}
              </span>
            ))}
          </span>
        )}

        <span
          className={cn(
            "text-muted-foreground mt-5 block truncate text-[11px] font-semibold",
            selectedDinnerId !== null &&
              "text-[10.5px] font-bold uppercase tracking-[0.08em]",
            selected && "text-primary",
          )}
        >
          {selectedDinnerId === null
            ? dinner.tags.map((tag) => tag.value).join(" · ")
            : selected
              ? "Keeping"
              : "Deleting"}
        </span>
      </span>
    </label>
  );
};
