import { UtensilsCrossed } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { type Day } from "../../utils/types";
import { BottomNav } from "../BottomNav";
import { DayComponent } from "./DayComponent";
import { PlanDayDialog } from "./PlanDayDialog";
import { useState } from "react";
import { addDays, isSameDay, startOfDay } from "date-fns";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Day>();
  const plannedDinnersQuery = api.plan.plannedDinners.useQuery();
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  console.log(plannedDinnersQuery.data?.plans);

  const days: Day[] = [
    {
      day: "Monday",
      number: 0,
      date: startOfDay(new Date()),
    },
    { day: "Tuesday", number: 1, date: startOfDay(addDays(new Date(), 1)) },
    { day: "Wednesday", number: 2, date: startOfDay(addDays(new Date(), 2)) },
    { day: "Thursday", number: 3, date: startOfDay(addDays(new Date(), 3)) },
    { day: "Friday", number: 4, date: startOfDay(addDays(new Date(), 4)) },
    { day: "Saturday", number: 5, date: startOfDay(addDays(new Date(), 5)) },
    { day: "Sunday", number: 6, date: startOfDay(addDays(new Date(), 6)) },
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
          {days.map((day) => (
            <DayComponent
              key={day.day}
              day={day}
              setSelectedDay={setSelectedDay}
              plannedDinner={
                plannedDinnersQuery.data?.plans.find((p) =>
                  isSameDay(p.date, day.date),
                )?.dinner
              }
            />
          ))}
        </div>
        <PlanDayDialog
          day={selectedDay}
          plannedDinner={
            selectedDay ? weekPlan[selectedDay?.number] : undefined
          }
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};
