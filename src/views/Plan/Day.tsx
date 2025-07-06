import { type Dinner } from "@prisma/client";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { Dialog, DialogTrigger } from "../../components/ui/dialog";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithTags } from "../../utils/types";
import { useState } from "react";
import { PlanDay } from "./PlanDay";
import { Button } from "../../components/ui/button";

type Props = {
  date: Date;
  plannedDinner?: DinnerWithTags;
};

export const Day = ({ date, plannedDinner }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changePlan, setChangePlan] = useState(!plannedDinner);

  const onOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setChangePlan(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex h-auto w-full flex-col items-start"
        >
          <p className="text-xs font-normal">{format(date, "EEE do")}</p>
          <DinnerSlot dinner={plannedDinner} />
        </Button>
      </DialogTrigger>
      <>
        {changePlan || !plannedDinner ? (
          <PlanDay
            date={date}
            closeDialog={() => onOpenChange(false)}
            plannedDinner={plannedDinner}
          />
        ) : (
          <PlannedDinner
            dinner={plannedDinner}
            date={date}
            closeDialog={() => onOpenChange(false)}
            setChangePlan={setChangePlan}
            isOpen={dialogOpen}
          />
        )}
      </>
    </Dialog>
  );
};

type DinnerSlotProps = { dinner?: Dinner };

export const DinnerSlot = ({ dinner }: DinnerSlotProps) => {
  if (!dinner) {
    return <div className="h-8"></div>;
  }

  return (
    <div className={cn("flex h-8 flex-col justify-end")}>
      <p className={cn("pb-2 font-semibold")}>{dinner.name}</p>
    </div>
  );
};
