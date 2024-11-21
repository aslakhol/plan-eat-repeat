import { UtensilsCrossed } from "lucide-react";
import { api } from "../../utils/api";
import { useState } from "react";
import { addDays, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { BottomNav } from "../BottomNav";
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
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-xl border-r">
      <div className="space-y-4 p-4">
        <WeekSelect
          setWeekOfSet={setWeekOffSet}
          startOfDisplayedWeek={startOfDisplayedWeek}
        />
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
        <WeekSelect
          setWeekOfSet={setWeekOffSet}
          startOfDisplayedWeek={startOfDisplayedWeek}
        />
      </div>

      <BottomNav />
    </div>
  );
};
