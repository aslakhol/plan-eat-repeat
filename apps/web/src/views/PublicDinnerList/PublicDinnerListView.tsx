import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  derivePublicDinnerCollection,
  type PublicDinnerList,
  type PublicDinnerListSort,
} from "~/lib/public-dinner-list";
import { publishedDinnerPath } from "~/lib/published-dinner";
import { cn } from "~/lib/utils";
import { DinnerCollectionControls } from "~/views/DinnerCollectionControls";

const DINNER_BATCH_SIZE = 6;

const publicDinnerListSortOptions = [
  { value: "recent", label: "Recently shared" },
  { value: "az", label: "A–Z" },
  { value: "most-saved", label: "Most saved" },
] as const satisfies ReadonlyArray<{
  value: PublicDinnerListSort;
  label: string;
}>;

const sharedDinnerCount = (count: number) =>
  `${count} ${count === 1 ? "dinner" : "dinners"} shared`;

const StartMyCookbook = ({ className }: { className?: string }) => (
  <Button asChild className={cn("font-bold", className)}>
    <Link href="/onboarding">Start my cookbook</Link>
  </Button>
);

const UpsellCopy = ({ mobile = false }: { mobile?: boolean }) => (
  <div>
    <p className="font-serif text-base font-normal text-[#332e29]">
      {mobile
        ? "Never wonder what's for dinner."
        : "All your recipes in one place."}
    </p>
    <p className="text-muted-foreground mt-1 text-xs font-semibold">
      Plan Eat Repeat is a free cookbook and dinner planner.
    </p>
  </div>
);

const DinnerTags = ({ tags }: { tags: readonly string[] }) =>
  tags.length > 0 ? (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-muted-foreground rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold"
        >
          {tag}
        </span>
      ))}
    </div>
  ) : null;

const PublicDinnerLink = ({
  dinner,
  lastMobileRow,
}: {
  dinner: PublicDinnerList["dinners"][number];
  lastMobileRow: boolean;
}) => (
  <Link
    href={publishedDinnerPath(dinner.publicSlug)}
    data-public-dinner-link
    className={cn(
      "hover:bg-secondary/40 group flex min-w-0 flex-col px-0 py-4 transition-colors md:min-h-[118px] md:rounded-lg md:border md:bg-white md:px-3.5 md:py-3",
      !lastMobileRow && "border-b md:border-b",
    )}
  >
    <div className="flex min-w-0 items-start justify-between gap-3">
      <h2 className="min-w-0 font-serif text-[17px] font-normal leading-tight">
        {dinner.name}
      </h2>
      {dinner.saveCount > 0 && (
        <span className="text-muted-foreground shrink-0 text-[11px] font-semibold md:hidden">
          saved by {dinner.saveCount}
        </span>
      )}
    </div>
    <DinnerTags tags={dinner.tags} />
    {dinner.saveCount > 0 && (
      <span className="text-muted-foreground mt-auto hidden pt-3 text-[10.5px] font-semibold md:block">
        saved by {dinner.saveCount}
      </span>
    )}
  </Link>
);

const NoMatches = ({ onClear }: { onClear: () => void }) => (
  <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center md:col-span-3">
    <h2 className="font-serif text-xl">No dinners match</h2>
    <p className="text-muted-foreground text-sm">
      Try another search or clear the selected tags.
    </p>
    <Button type="button" variant="outline" onClick={onClear}>
      Clear filters
    </Button>
  </div>
);

export const PublicDinnerListView = ({
  dinnerList,
}: {
  dinnerList: PublicDinnerList;
}) => {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<PublicDinnerListSort>("recent");
  const [visibleCount, setVisibleCount] = useState(DINNER_BATCH_SIZE);
  const controlDinners = useMemo(
    () =>
      dinnerList.dinners.map((dinner) => ({
        name: dinner.name,
        tags: dinner.tags.map((value) => ({ value })),
      })),
    [dinnerList.dinners],
  );
  const collection = derivePublicDinnerCollection(dinnerList.dinners, {
    search,
    selectedTags,
    sort,
  });
  const visibleDinners = collection.dinners.slice(0, visibleCount);
  const remainingCount = collection.dinners.length - visibleDinners.length;

  useEffect(
    () => setVisibleCount(DINNER_BATCH_SIZE),
    [search, selectedTags, sort],
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedTags([]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f2efe8] md:bg-[#faf8f5]">
      <header className="border-border hidden h-[82px] shrink-0 items-center justify-between border-b px-8 md:flex">
        <span className="text-primary font-serif text-2xl">
          Plan Eat Repeat
        </span>
        <StartMyCookbook className="h-11 rounded-lg px-7" />
      </header>

      <main className="mx-auto w-full max-w-[824px] flex-1 px-4 pb-6 pt-7 md:px-8 md:py-12">
        <div className="text-primary mb-6 font-serif text-xl md:hidden">
          Plan Eat Repeat
        </div>

        <Card className="rounded-2xl px-5 py-6 shadow-[0_8px_28px_rgba(60,50,40,.08)] md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
          <header className="flex items-center gap-3 md:border-b md:pb-6">
            <span className="bg-primary/15 text-primary flex size-[38px] shrink-0 items-center justify-center rounded-full text-base font-bold md:size-11 md:text-lg">
              {dinnerList.householdName.trim().charAt(0).toUpperCase() || "P"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-[21px] font-normal leading-tight md:text-3xl">
                {dinnerList.householdName}
              </h1>
              <p className="text-muted-foreground mt-1 text-[11px] font-bold md:text-xs">
                {sharedDinnerCount(dinnerList.dinners.length)}
              </p>
            </div>
          </header>

          <DinnerCollectionControls
            dinners={controlDinners}
            search={search}
            onSearchChange={setSearch}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            sort={sort}
            onSortChange={setSort}
            sortOptions={publicDinnerListSortOptions}
            placeholder="Search their dinners…"
            className="mt-6"
          />
        </Card>

        <Card
          data-public-dinner-collection
          className="mt-5 block rounded-2xl px-5 py-1 shadow-[0_8px_28px_rgba(60,50,40,.08)] md:mt-7 md:grid md:grid-cols-3 md:gap-2.5 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none"
        >
          {collection.emptyState === "no-matches" ? (
            <NoMatches onClear={clearFilters} />
          ) : (
            <>
              {visibleDinners.map((dinner, index) => (
                <PublicDinnerLink
                  key={dinner.publicSlug}
                  dinner={dinner}
                  lastMobileRow={
                    index === visibleDinners.length - 1 && remainingCount === 0
                  }
                />
              ))}
              {remainingCount > 0 && (
                <button
                  type="button"
                  aria-label={`Show ${Math.min(DINNER_BATCH_SIZE, remainingCount)} more dinners`}
                  className="text-muted-foreground w-full py-4 text-xs font-bold md:col-span-3 md:py-5"
                  onClick={() =>
                    setVisibleCount((count) => count + DINNER_BATCH_SIZE)
                  }
                >
                  ⌄ {remainingCount} more ⌄
                </button>
              )}
            </>
          )}
        </Card>

        <p className="sr-only" role="status" aria-live="polite">
          Showing {visibleDinners.length} of {collection.dinners.length} dinners
        </p>

        <Card
          data-public-list-mobile-upsell
          className="mt-5 rounded-2xl px-5 py-5 shadow-[0_8px_28px_rgba(60,50,40,.08)] md:hidden"
        >
          <UpsellCopy mobile />
          <StartMyCookbook className="mt-4 h-11 w-full rounded-lg" />
        </Card>
      </main>

      <footer
        data-public-list-desktop-footer
        className="border-border hidden shrink-0 border-t bg-[#f7f4ee] md:block"
      >
        <div className="mx-auto flex max-w-[824px] items-center justify-between gap-6 px-8 py-5">
          <UpsellCopy />
          <StartMyCookbook className="h-11 rounded-lg px-7" />
        </div>
      </footer>
    </div>
  );
};
