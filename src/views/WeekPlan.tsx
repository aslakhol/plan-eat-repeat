import { type Dinner } from "@prisma/client";
import { api } from "../utils/api";

type Props = { selectedDinnerIds: number[] };

export const WeekPlan = ({ selectedDinnerIds }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  const selectedDinners = selectedDinnerIds.map(
    (id) => dinnersQuery.data?.dinners?.find((dinner) => dinner.id === id),
  );

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
          <Day key={day} day={day} dinner={selectedDinners[index]} />
        ))}
      </div>
    </div>
  );
};

type DayProps = { day: string; dinner?: Dinner };

const Day = ({ day, dinner }: DayProps) => {
  return (
    <div className="flex flex-col rounded border px-4 py-2">
      <h3 className="font-semibold">{day}</h3>
      <p className="mt-2">{dinner ? dinner.name : "No dinner selected"}</p>
    </div>
  );
};
