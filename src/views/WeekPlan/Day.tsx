import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { DialogTrigger } from "@radix-ui/react-dialog";

type DayProps = {
  day: string;
  dayNumber: number;
  dinner?: Dinner;
  setSelectedDayNumber: (dayNumber: number) => void;
};

export const Day = ({
  day,
  dinner,
  dayNumber,
  setSelectedDayNumber,
}: DayProps) => {
  return (
    <DialogTrigger asChild onClick={() => setSelectedDayNumber(dayNumber)}>
      <div
        className={cn(
          "flex cursor-pointer flex-col rounded border px-2  py-2 hover:bg-slate-100",
        )}
      >
        <h3 className="mb-2 mr-1 text-xs">{day}</h3>
        <DinnerSlot dinner={dinner} />
      </div>
    </DialogTrigger>
  );
};

type DinnerSlotProps = { dinner?: Dinner };

export const DinnerSlot = ({ dinner }: DinnerSlotProps) => {
  if (!dinner) {
    return <div className="h-12 rounded-md "></div>;
  }

  return <DinnerSelected dinner={dinner} />;
};

type DinnerSelectedProps = { dinner: Dinner };

const DinnerSelected = ({ dinner }: DinnerSelectedProps) => {
  return (
    <div className={cn("flex h-12 flex-col-reverse rounded-md p-1")}>
      <p className={cn("font-semibold")}>{dinner.name}</p>
    </div>
  );
};
