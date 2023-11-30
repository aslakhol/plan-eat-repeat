import { type Dinner } from "@prisma/client";
import { cn } from "../lib/utils";
import { api } from "../utils/api";
import { getWeekPlan } from "../utils/dinner";

type Props = { selectedDinner: Dinner };

export const DialogWeek = ({ selectedDinner }: Props) => {
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
    <div className="justify-startp-6 flex flex-col items-end">
      <div className="w-full space-y-4 text-right">
        {days.map((day, index) => (
          <Day
            key={day}
            day={day}
            dayNumber={index}
            plannedDinner={weekPlan[index]}
            selectedDinner={selectedDinner}
          />
        ))}
      </div>
    </div>
  );
};

type DayProps = {
  day: string;
  dayNumber: number;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Day = ({ day, dayNumber, plannedDinner, selectedDinner }: DayProps) => {
  return (
    <div className={cn("flex flex-col rounded border px-2 py-2")}>
      <h3 className="mb-2 mr-1 text-xs">{day}</h3>
      <Slot
        day={dayNumber}
        plannedDinner={plannedDinner}
        selectedDinner={selectedDinner}
      />
    </div>
  );
};

type SlotProps = {
  day: number;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Slot = ({ day, plannedDinner, selectedDinner }: SlotProps) => {
  const planForEmptyDayMutation = api.dinner.planForEmptyDay.useMutation();

  const clickEmptyDay = () => {
    planForEmptyDayMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      day,
    });
  };

  if (!plannedDinner) {
    return (
      <div
        className="h-12 rounded-md  hover:bg-slate-100"
        onClick={clickEmptyDay}
      ></div>
    );
  }

  return (
    <DinnerPlanned
      day={day}
      plannedDinner={plannedDinner}
      selectedDinner={selectedDinner}
    />
  );
};

type DinnerPlannedProps = {
  day: number;
  plannedDinner: Dinner;
  selectedDinner: Dinner;
};

const DinnerPlanned = ({
  day,
  plannedDinner,
  selectedDinner,
}: DinnerPlannedProps) => {
  const utils = api.useUtils();

  const replaceMutation = api.dinner.replace.useMutation();

  const click = () => {
    replaceMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      day,
    });
  };

  return (
    <div
      className={cn(
        "flex h-12 flex-col-reverse rounded-md p-1 hover:bg-slate-100",
      )}
      onClick={click}
    >
      <p className={cn("font-semibold")}>{plannedDinner.name}</p>
    </div>
  );
};
