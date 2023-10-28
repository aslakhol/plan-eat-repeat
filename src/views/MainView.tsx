import { api } from "~/utils/api";
import { Dinners } from "./Dinners";
import { WeekPlan } from "./WeekPlan";
import { useState } from "react";
import { type DinnerWithTags } from "../utils/types";

/**
 * v0 by Vercel.
 * @see https://v0.dev/t/Gun86UHtS3V
 */

export const MainView = () => {
  const dinnerQuery = api.dinner.dinners.useQuery();

  const [selectedDinnerIds, setSelectedDinnerIds] = useState<number[]>([]);

  const toggleDinnerSelected = (dinner: DinnerWithTags) => {
    setSelectedDinnerIds((prevState) => {
      if (prevState.includes(dinner.id)) {
        return prevState.filter((id) => id !== dinner.id);
      }

      if (prevState.length >= 7) {
        return prevState;
      }

      return [...prevState, dinner.id];
    });
  };

  return (
    <div className="grid h-screen grid-cols-2">
      {dinnerQuery.data?.dinners && (
        <Dinners
          dinners={dinnerQuery.data.dinners}
          toggleDinnerSelected={toggleDinnerSelected}
          selectedDinnerIds={selectedDinnerIds}
        />
      )}

      <WeekPlan />
    </div>
  );
};
