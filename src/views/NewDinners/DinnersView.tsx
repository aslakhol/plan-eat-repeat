import { api } from "~/utils/api";
import { BottomNav } from "../BottomNav";
import { UtensilsCrossed } from "lucide-react";
import { DinnerList } from "./DinnerList";

export const DinnersView = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();

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

  return (
    <div className="grid h-screen p-6">
      {/* Search and Filter */}
      {/* New Dinner */}
      {/* Existing Dinners */}

      <DinnerList dinners={dinnersQuery.data.dinners} />

      <BottomNav />
    </div>
  );
};
