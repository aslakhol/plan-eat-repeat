import { api } from "~/utils/api";
import { AlertCircle, BookOpen, UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Filter } from "../Filter";
import { Button } from "~/components/ui/button";
export const DinnersView = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const utils = api.useUtils();
  void utils.dinner.tags.prefetch();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);

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

  const dinners = dinnersQuery.data.dinners
    .filter(
      (dinner) =>
        !search || dinner.name.toLowerCase().includes(search.toLowerCase()),
    )
    .filter(
      (dinner) =>
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          dinner.tags.map((t) => t.value).includes(tag),
        ),
    );

  return (
    <div className="flex flex-col gap-6">
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
        />
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
        <DinnerList dinners={dinners} selectedTags={selectedTags} />
      )}
    </div>
  );
};
