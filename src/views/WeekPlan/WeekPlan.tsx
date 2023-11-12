import { type Dinner } from "@prisma/client";
import { api } from "../../utils/api";
import { cn } from "../../lib/utils";
import { getWeekPlan } from "../../utils/dinner";
import { useDroppable } from "@dnd-kit/core";
import { DinnerSlot } from "./DinnerSlot";

export const WeekPlan = () => {
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
    <div className="flex flex-col items-end justify-start bg-gray-50 p-6 dark:bg-gray-900">
      <h2 className="mb-8 text-right text-xl font-bold">Week Plan</h2>
      <div className="w-full space-y-4 text-right">
        {days.map((day, index) => (
          <Day key={day} day={day} dinner={weekPlan[index]} />
        ))}
      </div>
    </div>
  );
};

type DayProps = { day: string; dinner?: Dinner };

const Day = ({ day, dinner }: DayProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: day,
  });

  return (
    <div
      className={cn(
        "flex flex-col rounded border px-2 py-2",
        isOver && "bg-green-400",
      )}
      ref={setNodeRef}
    >
      <h3 className="mb-2 mr-1 text-xs">{day}</h3>
      <DinnerSlot dinner={dinner} />
    </div>
  );
};
