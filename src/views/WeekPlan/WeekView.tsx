import { UtensilsCrossed } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { type Day } from "../../utils/types";
import { BottomNav } from "../BottomNav";
import { DayComponent } from "./DayComponent";
import { PlanDayDialog } from "./PlanDayDialog";
import { useState } from "react";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Day>();
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  const days: Day[] = [
    { day: "Monday", number: 0 },
    { day: "Tuesday", number: 1 },
    { day: "Wednesday", number: 2 },
    { day: "Thursday", number: 3 },
    { day: "Friday", number: 4 },
    { day: "Saturday", number: 5 },
    { day: "Sunday", number: 6 },
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
              plannedDinner={weekPlan[day.number]}
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
