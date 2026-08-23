import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { env } from "~/env";
import {
  publicDinnerListPath,
  publicDinnerListUrl,
} from "~/lib/public-dinner-list";
import {
  deriveSharedDinnerCollection,
  formatSharedDinnerMeta,
  sharedDinnerSortOptions,
  type SharedDinnerSort,
} from "~/lib/shared-dinners";
import { api, type RouterOutputs } from "~/utils/api";
import { DinnerCollectionControls } from "~/views/DinnerCollectionControls";

type SharedDinner = RouterOutputs["dinner"]["sharedDinners"]["dinners"][number];

const PublicDinnerListLink = ({
  householdName,
  publicSlug,
}: {
  householdName: string;
  publicSlug: string;
}) => {
  const path = publicDinnerListPath(publicSlug);
  const publicUrl = new URL(
    publicDinnerListUrl(publicSlug, env.NEXT_PUBLIC_APP_URL),
  );

  return (
    <Link
      href={path}
      data-shared-dinners-public-list
      className="border-border bg-muted hover:bg-secondary sticky top-4 z-10 flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors md:top-8"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold">
          {householdName} public page
        </p>
        <p className="text-muted-foreground truncate text-[10.5px] font-semibold">
          {publicUrl.host}
          {publicUrl.pathname}
        </p>
      </div>
      <span className="text-primary shrink-0 text-xs font-bold">View</span>
    </Link>
  );
};

const SharedDinnerList = ({ dinners }: { dinners: SharedDinner[] }) => (
  <div className="flex flex-col gap-2.5">
    {dinners.map((dinner) => (
      <Link key={dinner.id} href={`/dinners/shared/${dinner.id}`}>
        <Card className="bg-secondary/70 hover:bg-secondary flex min-w-0 items-center gap-3 border-0 px-3.5 py-3 shadow-none transition-colors">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[17px] leading-tight">
              {dinner.name}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs font-semibold">
              {formatSharedDinnerMeta(dinner)}
            </p>
          </div>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Card>
      </Link>
    ))}
  </div>
);

export const SharedDinnersView = () => {
  const sharedDinnersQuery = api.dinner.sharedDinners.useQuery();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SharedDinnerSort>("recent");

  if (sharedDinnersQuery.isPending) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <UtensilsCrossed className="text-primary animate-spin" />
      </div>
    );
  }

  if (!sharedDinnersQuery.isSuccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="text-destructive size-6" />
        <h1 className="font-serif text-2xl">
          Couldn&apos;t load shared dinners
        </h1>
        <p className="text-muted-foreground text-sm">
          Check your connection and try again.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="text-primary font-bold"
          onClick={() => void sharedDinnersQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const dinners = sharedDinnersQuery.data.dinners;
  const publicDinnerList = sharedDinnersQuery.data.publicDinnerList;
  const collection = deriveSharedDinnerCollection(dinners, {
    search,
    selectedTags,
    sort,
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header>
        <Link
          href="/dinners"
          className="text-muted-foreground inline-flex items-center gap-0.5 text-sm font-bold"
        >
          <ChevronLeft className="size-4" />
          Cookbook
        </Link>
        <h1 className="mt-5 font-serif text-3xl font-normal">Shared dinners</h1>
      </header>

      {publicDinnerList && <PublicDinnerListLink {...publicDinnerList} />}

      <DinnerCollectionControls
        dinners={dinners}
        search={search}
        onSearchChange={setSearch}
        selectedTags={selectedTags}
        onSelectedTagsChange={setSelectedTags}
        sort={sort}
        onSortChange={setSort}
        sortOptions={sharedDinnerSortOptions}
        placeholder="Search shared dinners…"
      />

      {collection.emptyState === "empty" ? (
        <div className="mx-auto flex min-h-[34vh] max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
          <Users className="text-primary size-7" />
          <h2 className="font-serif text-2xl">No shared dinners yet</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Share a dinner from its Cookbook view to see it here.
          </p>
        </div>
      ) : collection.emptyState === "no-matches" ? (
        <div className="mx-auto flex min-h-[30vh] max-w-sm flex-col items-center justify-center gap-3 text-center">
          <h2 className="font-serif text-xl">No shared dinners match</h2>
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
      ) : (
        <SharedDinnerList dinners={collection.dinners} />
      )}
    </div>
  );
};
