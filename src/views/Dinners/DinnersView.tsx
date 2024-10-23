import { api } from "~/utils/api";
import { BottomNav } from "../BottomNav";
import { UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { Filter } from "./Filter";

export const DinnersView = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const [search, setSearch] = useState("");

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

  const dinners = dinnersQuery.data.dinners.filter(
    (dinner) =>
      !search || dinner.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Search and Filter */}
      <Input
        placeholder="Search dinners"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Filter />
      {/* New Dinner */}
      {/* Existing Dinners */}

      <DinnerList dinners={dinners} />

      <BottomNav />
    </div>
  );
};
