import { UtensilsCrossed } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { BottomNav } from "../BottomNav";
import { Day } from "./Day";
import { PlanDayDialog } from "./PlanDayDialog";
import { useState } from "react";
import { addDays, isSameDay, startOfDay } from "date-fns";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const plannedDinnersQuery = api.plan.plannedDinners.useQuery();
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  const week: Date[] = [
    startOfDay(new Date()),
    startOfDay(addDays(new Date(), 1)),
    startOfDay(addDays(new Date(), 2)),
    startOfDay(addDays(new Date(), 3)),
    startOfDay(addDays(new Date(), 4)),
    startOfDay(addDays(new Date(), 5)),
    startOfDay(addDays(new Date(), 6)),
  ];

  if (dinnersQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid h-screen">
      <Dialog>
        <div className="w-full space-y-4 p-4 ">
          {week.map((day) => (
            <Day
              key={day.toString()}
              date={day}
              setSelectedDay={setSelectedDay}
              plannedDinner={
                plannedDinnersQuery.data?.plans.find((p) =>
                  isSameDay(p.date, day),
                )?.dinner
              }
            />
          ))}
        </div>
        <PlanDayDialog
          date={selectedDay}
          plannedDinner={
            selectedDay
              ? plannedDinnersQuery.data?.plans.find((p) =>
                  isSameDay(p.date, selectedDay),
                )?.dinner
              : undefined
          }
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};
