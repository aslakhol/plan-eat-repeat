import { api } from "~/utils/api";
import { Dinners } from "../Dinners";
import { BottomNav } from "../BottomNav";

export const DinnersView = () => {
  const dinnerQuery = api.dinner.dinners.useQuery();

  return (
    <div className="grid h-screen">
      <div>
        {dinnerQuery.data?.dinners && (
          <Dinners dinners={dinnerQuery.data.dinners} />
        )}
      </div>
      <BottomNav />
    </div>
  );
};
