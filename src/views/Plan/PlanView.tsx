import { UtensilsCrossed } from "lucide-react";
import { api } from "../../utils/api";
import { useState } from "react";
import { addDays, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { Day } from "./Day";
import { WeekSelect } from "../WeekSelect";
import { keepPreviousData } from "@tanstack/react-query";

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
    { placeholderData: keepPreviousData },
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

  if (plannedDinnersQuery.isPending) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <UtensilsCrossed className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20 sm:gap-6 md:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Weekly Plan
        </h1>
        <div className="hidden sm:block">
          <WeekSelect
            setWeekOfSet={setWeekOffSet}
            startOfDisplayedWeek={startOfDisplayedWeek}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
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
      <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center p-4 md:hidden">
        <div className="rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <WeekSelect
            setWeekOfSet={setWeekOffSet}
            startOfDisplayedWeek={startOfDisplayedWeek}
          />
        </div>
      </div>
    </div>
  );
};
