import { api } from "~/utils/api";
import { BottomNav } from "../BottomNav";
import { UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Tags } from "./Tags";
import { Filter } from "../Filter";
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
      <Filter
        search={search}
        setSearch={setSearch}
        showTags={showTags}
        setShowTags={setShowTags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
      />
      <DinnerList dinners={dinners} selectedTags={selectedTags} />
      <BottomNav />
    </div>
  );
};
