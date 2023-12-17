import { UtensilsCrossed } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { BottomNav } from "../BottomNav";
import { Day } from "./Day";
import { PlanDayDialog } from "./PlanDayDialog";
import { useState } from "react";
import { addDays, isSameDay, startOfDay, startOfWeek } from "date-fns";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const plannedDinnersQuery = api.plan.plannedDinners.useQuery();

  const today = startOfDay(new Date());
  const monday = startOfWeek(today, {
    weekStartsOn: 1,
  });

  const week: Date[] = [
    startOfDay(monday),
    startOfDay(addDays(monday, 1)),
    startOfDay(addDays(monday, 2)),
    startOfDay(addDays(monday, 3)),
    startOfDay(addDays(monday, 4)),
    startOfDay(addDays(monday, 5)),
    startOfDay(addDays(monday, 6)),
  ];

  if (plannedDinnersQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid h-screen">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
          closeDialog={() => setDialogOpen(false)}
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};
