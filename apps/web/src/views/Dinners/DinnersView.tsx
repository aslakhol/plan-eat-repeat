import { AlertCircle, BookOpen, UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";
import { deriveDinnerCollection, type CookbookSort } from "~/lib/cookbook";
import { DinnerCollectionControls } from "../DinnerCollectionControls";
import { CookSettingsHeader } from "~/components/CookSettingsHeader";

export const DinnersView = () => {
  const { query: dinnersQuery, today } = useDinnerSummaries();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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

  const collection = deriveDinnerCollection(dinnersQuery.data.dinners, {
    search,
    selectedTags,
    sort,
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-4">
        <CookSettingsHeader title="Cookbook" />
        <DinnerCollectionControls
          dinners={dinnersQuery.data.dinners}
          search={search}
          onSearchChange={setSearch}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          sort={sort}
          onSortChange={setSort}
          placeholder="Search dinners…"
        />
      </div>
      {collection.emptyState === "empty-cookbook" ? (
        <div className="mx-auto flex min-h-[42vh] max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
          <BookOpen className="text-primary size-7" />
          <h2 className="font-serif text-2xl">Your Cookbook is empty</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Use the raised ＋ below to add your first Dinner.
          </p>
        </div>
      ) : (
        <>
          {collection.dinners.length > 0 ? (
            <DinnerList
              dinners={collection.dinners}
              mostPlannedStartIndex={collection.mostPlannedStartIndex}
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
          {collection.hasActiveFilters && (
            <p className="text-muted-foreground text-center text-[11px] font-semibold">
              {collection.matchingCount}{" "}
              {collection.matchingCount === 1 ? "dinner" : "dinners"} match
            </p>
          )}
        </>
      )}
    </div>
  );
};
