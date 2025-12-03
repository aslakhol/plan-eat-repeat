import { type Dinner } from "@prisma/client";
import { format, isToday } from "date-fns";
import { cn } from "../../lib/utils";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithTags } from "../../utils/types";
import { useState } from "react";
import { PlanDay } from "./PlanDay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
} from "../../components/ResponsiveModal";
import { Plus } from "lucide-react";

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

  const isDateToday = isToday(date);

  return (
    <ResponsiveModal open={dialogOpen} onOpenChange={onOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Card
          className={cn(
            "group relative flex h-full min-h-[140px] cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent/50",
            !plannedDinner &&
              "border-dashed bg-transparent hover:border-primary/50",
            plannedDinner &&
              "border-secondary bg-secondary/30 hover:bg-secondary/50",
            isDateToday && "ring-2 ring-primary ring-offset-2",
          )}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle
              className={cn(
                "flex items-center justify-between font-sans text-sm font-medium text-muted-foreground",
                isDateToday && "font-bold text-primary",
              )}
            >
              {format(date, "EEE do")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center p-4 pt-0">
            {plannedDinner ? (
              <p className="line-clamp-2 font-serif text-lg font-medium leading-tight">
                {plannedDinner.name}
              </p>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/50 transition-colors group-hover:text-primary/50">
                <Plus className="h-8 w-8" />
              </div>
            )}
          </CardContent>
        </Card>
      </ResponsiveModalTrigger>
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
    </ResponsiveModal>
  );
};
