import { api } from "~/utils/api";
import { BottomNav } from "../BottomNav";
import { Filter, UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { Tags } from "./Tags";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

export const DinnersView = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const utils = api.useUtils();
  void utils.dinner.tags.prefetch();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);

  if (dinnersQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  if (!dinnersQuery.isSuccess) {
    // TODO: Better error state
    return null;
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
    <div className="flex flex-col gap-4 p-6">
      {/* Search and Filters */}
      <div className="flex w-full max-w-sm items-center space-x-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "transition-all duration-300",
            showTags && "rotate-180",
          )}
          onClick={() => setShowTags(!showTags)}
        >
          <Filter />
        </Button>
      </div>
      {showTags && (
        <Tags selectedTags={selectedTags} setSelectedTags={setSelectedTags} />
      )}
      {/* New Dinner */}
      {/* Existing Dinners */}

      <DinnerList dinners={dinners} selectedTags={selectedTags} />

      <BottomNav />
    </div>
  );
};
