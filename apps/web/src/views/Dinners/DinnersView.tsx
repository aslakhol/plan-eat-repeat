import { AlertCircle, BookOpen, UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Filter } from "../Filter";
import { Button } from "~/components/ui/button";
import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";
import {
  orderDinnerSummaries,
  type CookbookSort,
} from "~/lib/cookbook";
import { cn } from "~/lib/utils";

const sortOptions: Array<{ value: CookbookSort; label: string }> = [
  { value: "az", label: "A–Z" },
  { value: "not-lately", label: "Haven't had lately" },
  { value: "favourites", label: "Favourites" },
];

export const DinnersView = () => {
  const { query: dinnersQuery, today } = useDinnerSummaries();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [sort, setSort] = useState<CookbookSort>("az");

  if (dinnersQuery.isPending) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <UtensilsCrossed className="text-primary animate-spin" />
      </div>
    );
  }

  if (!dinnersQuery.isSuccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="text-destructive size-6" />
        <h1 className="font-serif text-2xl">Couldn&apos;t load Cookbook</h1>
        <p className="text-muted-foreground text-sm">
          Check your connection and try again.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="text-primary font-bold"
          onClick={() => void dinnersQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const normalisedSearch = search.trim().toLocaleLowerCase();
  const matchingDinners = dinnersQuery.data.dinners
    .filter(
      (dinner) =>
        !normalisedSearch ||
        dinner.name.toLocaleLowerCase().includes(normalisedSearch) ||
        dinner.tags.some((tag) =>
          tag.value.toLocaleLowerCase().includes(normalisedSearch),
        ),
    )
    .filter(
      (dinner) =>
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          dinner.tags.map((t) => t.value).includes(tag),
        ),
    );
  const dinners = orderDinnerSummaries(matchingDinners, sort);
  const hasFilters = normalisedSearch.length > 0 || selectedTags.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-4">
        <h1 className="text-foreground font-serif text-3xl font-normal">
          Cookbook
        </h1>
        <Filter
          search={search}
          setSearch={setSearch}
          showTags={showTags}
          setShowTags={setShowTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          placeholder="Search dinners…"
        />
        <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              onClick={() => setSort(option.value)}
              className={cn(
                "text-muted-foreground min-w-0 rounded-md px-1 py-2 text-[10px] font-bold transition-colors sm:text-[11px]",
                sort === option.value &&
                  "text-primary bg-white shadow-sm",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {dinnersQuery.data.dinners.length === 0 ? (
        <div className="mx-auto flex min-h-[42vh] max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
          <BookOpen className="text-primary size-7" />
          <h2 className="font-serif text-2xl">Your Cookbook is empty</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Use the raised ＋ below to add your first Dinner.
          </p>
        </div>
      ) : (
        <>
          {dinners.length > 0 ? (
            <DinnerList
              dinners={dinners}
              selectedTags={selectedTags}
              today={today}
            />
          ) : (
            <div className="mx-auto flex min-h-[30vh] max-w-sm flex-col items-center justify-center gap-3 text-center">
              <h2 className="font-serif text-xl">No dinners match</h2>
              <p className="text-muted-foreground text-sm">
                Try another search or clear the selected tags.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setSelectedTags([]);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-center text-[11px] font-semibold">
            {hasFilters
              ? `${dinners.length} ${dinners.length === 1 ? "dinner" : "dinners"} match`
              : `⌄ ${dinners.length} ${dinners.length === 1 ? "dinner" : "dinners"} ⌄`}
          </p>
        </>
      )}
    </div>
  );
};
