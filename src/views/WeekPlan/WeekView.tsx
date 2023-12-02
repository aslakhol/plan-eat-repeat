import { type Dinner } from "@prisma/client";
import { Dialog, DialogTrigger } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { BottomNav } from "../BottomNav";
import { DinnerSlot } from "./DinnerSlot";
import { PlanDayDialog } from "./PlanDayDialog";
import { useEffect, useState } from "react";

export const WeekView = () => {
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>();
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  useEffect(() => {
    console.log(selectedDayNumber, "selectedDayNumber");
  }, [selectedDayNumber]);

  return (
    <div className="grid h-screen">
      <Dialog>
        <div className="w-full space-y-4 p-4 ">
          {days.map((day, index) => (
            <Day
              key={day}
              day={day}
              dayNumber={index}
              dinner={weekPlan[index]}
              setSelectedDayNumber={setSelectedDayNumber}
            />
          ))}
        </div>
        <PlanDayDialog
          day={selectedDayNumber ? days[selectedDayNumber] : undefined}
          dayNumber={selectedDayNumber}
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};

type DayProps = {
  day: string;
  dayNumber: number;
  dinner?: Dinner;
  setSelectedDayNumber: (dayNumber: number) => void;
};

const Day = ({ day, dinner, dayNumber, setSelectedDayNumber }: DayProps) => {
  return (
    <DialogTrigger asChild onClick={() => setSelectedDayNumber(dayNumber)}>
      <div className={cn("flex flex-col rounded border px-2 py-2")}>
        <h3 className="mb-2 mr-1 text-xs">{day}</h3>
        <DinnerSlot dinner={dinner} />
      </div>
    </DialogTrigger>
  );
};
