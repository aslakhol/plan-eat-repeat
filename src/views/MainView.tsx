import { api } from "~/utils/api";
import { Dinners } from "./Dinners";
import { WeekPlan } from "./WeekPlan/WeekPlan";

/**
 * v0 by Vercel.
 * @see https://v0.dev/t/Gun86UHtS3V
 */

export const MainView = () => {
  const dinnerQuery = api.dinner.dinners.useQuery();

  return (
    <div className="grid h-screen grid-cols-2">
      {dinnerQuery.data?.dinners && (
        <Dinners
          dinners={dinnerQuery.data.dinners}
          setSelectedDinnerId={() => {
            return;
          }}
        />
      )}

      <WeekPlan />
    </div>
  );
};
