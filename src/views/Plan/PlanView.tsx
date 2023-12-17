import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
} from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { BottomNav } from "../BottomNav";
import { Day } from "./Day";
import { PlanDayDialog } from "./PlanDayDialog";
import { type Dispatch, type SetStateAction, useState } from "react";
import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { Button } from "../../components/ui/button";

export const WeekView = () => {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [weekOfSet, setWeekOfSet] = useState(0);

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

type WeekSelectProps = {
  setWeekOfSet: Dispatch<SetStateAction<number>>;
  startOfDisplayedWeek: Date;
};

const WeekSelect = ({
  setWeekOfSet,
  startOfDisplayedWeek,
}: WeekSelectProps) => {
  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet((prev) => prev - 1)}
          >
            <span className="sr-only">Go back 1 week</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet(0)}
          >
            <span className="sr-only">Go to today</span>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet((prev) => prev + 1)}
          >
            <span className="sr-only">Go forward 1 week</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="px-4 text-sm font-medium">
            Week {format(startOfDisplayedWeek, "w, MMMM, yyyy")}
          </div>
        </div>
      </div>
    </>
  );
};