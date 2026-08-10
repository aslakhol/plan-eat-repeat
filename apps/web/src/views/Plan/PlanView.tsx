import { UtensilsCrossed } from "lucide-react";
import { api } from "../../utils/api";
import { useState } from "react";
import { addWeeks, isSameDay, startOfDay } from "date-fns";
import { Day } from "./Day";
import { WeekSelect } from "../WeekSelect";
import { keepPreviousData } from "@tanstack/react-query";
import { buildDinnerPlanningWeek } from "~/lib/dinner-planning";

export const PlanView = () => {
  const [weekOffSet, setWeekOffSet] = useState(0);
  const trpc = api.useUtils();

  const today = startOfDay(new Date());
  const week = buildDinnerPlanningWeek(addWeeks(today, weekOffSet));

  const plannedDinnersQuery = api.plan.plannedDinners.useQuery(
    {
      startOfWeek: week.start,
    },
    { placeholderData: keepPreviousData },
  );

  void trpc.plan.plannedDinners.prefetch(
    {
      startOfWeek: addWeeks(week.start, 1),
    },
    { staleTime: 60 * 1000 },
  );

  void trpc.plan.plannedDinners.prefetch(
    {
      startOfWeek: addWeeks(week.start, -1),
    },
    { staleTime: 60 * 1000 },
  );

  if (plannedDinnersQuery.isPending) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <UtensilsCrossed className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 sm:gap-6 md:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground font-serif text-3xl font-normal">
          Week
        </h1>
        <div className="hidden sm:block">
          <WeekSelect setWeekOfSet={setWeekOffSet} weekLabel={week.label} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {week.days.map((day) => (
          <Day
            key={day.dateTime}
            date={day.date}
            today={today}
            plannedDinner={
              plannedDinnersQuery.data?.plans.find((p) =>
                isSameDay(p.date, day.date),
              )?.dinner
            }
          />
        ))}
      </div>
      <div className="pointer-events-none fixed bottom-[94px] left-0 right-0 z-40 flex justify-center px-3 md:hidden">
        <WeekSelect
          setWeekOfSet={setWeekOffSet}
          weekLabel={week.label}
          floating
        />
      </div>
    </div>
  );
};
