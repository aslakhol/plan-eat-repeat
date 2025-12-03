import { UtensilsCrossed } from "lucide-react";
import { api } from "../../utils/api";
import { useState } from "react";
import { addDays, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { Day } from "./Day";
import { WeekSelect } from "../WeekSelect";

export const PlanView = () => {
  const [weekOffSet, setWeekOffSet] = useState(0);
  const trpc = api.useUtils();

  const startOfCurrentWeek = startOfWeek(new Date(), {
    weekStartsOn: 1,
  });
  const startOfDisplayedWeek = addDays(startOfCurrentWeek, weekOffSet * 7);

  const week: Date[] = [
    startOfDay(startOfDisplayedWeek),
    startOfDay(addDays(startOfDisplayedWeek, 1)),
    startOfDay(addDays(startOfDisplayedWeek, 2)),
    startOfDay(addDays(startOfDisplayedWeek, 3)),
    startOfDay(addDays(startOfDisplayedWeek, 4)),
    startOfDay(addDays(startOfDisplayedWeek, 5)),
    startOfDay(addDays(startOfDisplayedWeek, 6)),
  ];

  const plannedDinnersQuery = api.plan.plannedDinners.useQuery(
    {
      startOfWeek: startOfDisplayedWeek,
    },
    { keepPreviousData: true },
  );

  void trpc.plan.plannedDinners.prefetch(
    {
      startOfWeek: addDays(startOfDisplayedWeek, 7),
    },
    { staleTime: 60 * 1000 },
  );

  void trpc.plan.plannedDinners.prefetch(
    {
      startOfWeek: addDays(startOfDisplayedWeek, -7),
    },
    { staleTime: 60 * 1000 },
  );

  if (plannedDinnersQuery.isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <UtensilsCrossed className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Weekly Plan
        </h1>
        <WeekSelect
          setWeekOfSet={setWeekOffSet}
          startOfDisplayedWeek={startOfDisplayedWeek}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {week.map((day) => (
          <Day
            key={day.toString()}
            date={day}
            plannedDinner={
              plannedDinnersQuery.data?.plans.find((p) =>
                isSameDay(p.date, day),
              )?.dinner
            }
          />
        ))}
      </div>
    </div>
  );
};
