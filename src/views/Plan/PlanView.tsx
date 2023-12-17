import { UtensilsCrossed } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { BottomNav } from "../BottomNav";
import { Day } from "./Day";
import { PlanDayDialog } from "./PlanDayDialog";
import { useState } from "react";
import { addDays, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { WeekSelect } from "../WeekSelect";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [weekOfSet, setWeekOfSet] = useState(0);
  const trpc = api.useUtils();

  const startOfCurrentWeek = startOfWeek(new Date(), {
    weekStartsOn: 1,
  });
  const startOfDisplayedWeek = addDays(startOfCurrentWeek, weekOfSet * 7);

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
    <div className="grid h-screen">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="w-full space-y-4 p-4 ">
          <WeekSelect
            setWeekOfSet={setWeekOfSet}
            startOfDisplayedWeek={startOfDisplayedWeek}
          />
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
