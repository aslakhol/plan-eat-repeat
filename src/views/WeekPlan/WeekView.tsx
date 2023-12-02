import { Dialog } from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { BottomNav } from "../BottomNav";
import { Day } from "./Day";
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
          day={
            selectedDayNumber !== undefined
              ? days[selectedDayNumber]
              : undefined
          }
          dayNumber={selectedDayNumber}
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};
