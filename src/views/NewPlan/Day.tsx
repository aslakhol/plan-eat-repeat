import { type Dinner } from "@prisma/client";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "../../components/ui/dialog";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithTags } from "../../utils/types";

type Props = {
  date: Date;
  plannedDinner?: DinnerWithTags;
};

export const Day = ({ date, plannedDinner }: Props) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            "flex cursor-pointer flex-col rounded border p-2 hover:bg-slate-100",
          )}
        >
          <h3 className="mb-2 mr-1 text-xs">{format(date, "EEE do")}</h3>
          <DinnerSlot dinner={plannedDinner} />
        </div>
      </DialogTrigger>
      <DialogContent>
        {plannedDinner ? <PlannedDinner dinner={plannedDinner} /> : <>foo</>}
      </DialogContent>
    </Dialog>
  );
};

type DinnerSlotProps = { dinner?: Dinner };

export const DinnerSlot = ({ dinner }: DinnerSlotProps) => {
  if (!dinner) {
    return <div className="h-12 rounded-md"></div>;
  }

  return (
    <div className={cn("flex h-12 rounded-md p-1")}>
      <p className={cn("font-semibold")}>{dinner.name}</p>
    </div>
  );
};
