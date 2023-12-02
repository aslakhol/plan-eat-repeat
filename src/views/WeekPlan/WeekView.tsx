import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { BottomNav } from "../BottomNav";
import { DinnerSlot } from "./DinnerSlot";

export const WeekView = () => {
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

  return (
    <div className="grid h-screen">
      <div className="w-full space-y-4 p-4 ">
        {days.map((day, index) => (
          <Day key={day} day={day} dinner={weekPlan[index]} />
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

type DayProps = { day: string; dinner?: Dinner };

const Day = ({ day, dinner }: DayProps) => {
  return (
    <div className={cn("flex flex-col rounded border px-2 py-2")}>
      <h3 className="mb-2 mr-1 text-xs">{day}</h3>
      <DinnerSlot dinner={dinner} />
    </div>
  );
};
