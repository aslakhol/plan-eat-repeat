import { api } from "~/utils/api";
import { UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Filter } from "../Filter";
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
        <UtensilsCrossed className="animate-spin text-primary" />
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Dinners
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
      <DinnerList dinners={dinners} selectedTags={selectedTags} />
    </div>
  );
};
